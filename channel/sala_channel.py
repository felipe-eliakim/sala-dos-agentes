"""Canal da Sala dos Agentes: servidor MCP (stdio) que o Claude Code carrega
quando a sessão é aberta com `claude-sala`.

- Busca no servidor da sala (127.0.0.1:8777) as mensagens que você digitou na
  sua sala e entrega à sessão como evento de canal.
- Dá à sessão as ferramentas `reply` (responder na sala) e `recado` (fixar um
  aviso no quadro).
- Repassa os pedidos de permissão da sessão para a sala e devolve a sua
  resposta (Permitir/Negar).

Só biblioteca padrão. Mensagens JSON-RPC uma por linha (transporte stdio do MCP).
"""

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:" + os.environ.get("SALA_AGENTES_PORT", "8777")
DATA_DIR = Path(os.environ.get("SALA_AGENTES_DIR") or Path.home() / ".local" / "share" / "sala-dos-agentes")
SESSIONS_DIR = Path.home() / ".claude" / "sessions"
CONFIG = Path(os.environ.get("SALA_AGENTES_CONFIG") or Path.home() / ".config" / "sala-dos-agentes") / "config.json"


def user_name():
    try:
        name = json.loads(CONFIG.read_text(encoding="utf-8")).get("usuario")
        return name if isinstance(name, str) and name.strip() else None
    except (OSError, ValueError, AttributeError):
        return None


USER = user_name()

INSTRUCTIONS = (
    f"O usuário{f' ({USER})' if USER else ''} está falando com você pela Sala dos Agentes, uma página local "
    "(http://127.0.0.1:8777), não pelo terminal. Mensagens dele chegam como "
    '<channel source="sala" ...>. Ele lê a sala, não este terminal: tudo que ele '
    "precisa ver tem que ir pela ferramenta reply (o texto normal da sua resposta não "
    "aparece lá). Responda em português do Brasil, em markdown simples. Em tarefas "
    "longas, mande um reply curto dizendo o que vai fazer e outro no fim com o resultado. "
    "Use a ferramenta recado só para fixar no quadro de avisos algo que ele precisa "
    "lembrar depois (ex.: 'deploy feito, falta testar no celular'), não para conversa. "
    "Pedidos de permissão aparecem para ele na sala com botões Permitir/Negar."
)

TOOLS = [
    {"name": "reply", "description": "Responde ao usuário na Sala dos Agentes (a página local onde ele está conversando com você).",
     "inputSchema": {"type": "object", "properties": {"text": {"type": "string", "description": "Mensagem em markdown simples."}},
                     "required": ["text"]}},
    {"name": "recado", "description": "Fixa um recado curto no quadro de avisos da sala, para o usuário ver depois.",
     "inputSchema": {"type": "object", "properties": {"text": {"type": "string", "description": "Recado de uma ou duas frases."}},
                     "required": ["text"]}},
]

out_lock = threading.Lock()
state = {"sid": None, "token": None}


def log(msg):
    sys.stderr.write(f"sala-channel: {msg}\n")
    sys.stderr.flush()


def send(obj):
    data = json.dumps(obj, ensure_ascii=False)
    with out_lock:
        sys.stdout.write(data + "\n")
        sys.stdout.flush()


def http(method, path, body=None, timeout=10):
    token = state["token"] or (DATA_DIR / "token").read_text().strip()
    state["token"] = token
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "X-Sala-Token": token})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read() or b"null")


def find_session():
    """Sobe pelos processos pais até achar a sessão do Claude Code que abriu este canal."""
    pid = os.getppid()
    for _ in range(6):
        reg = SESSIONS_DIR / f"{pid}.json"
        if reg.exists():
            try:
                return json.loads(reg.read_text()).get("sessionId")
            except (OSError, ValueError):
                return None
        try:
            stat = Path(f"/proc/{pid}/stat").read_text()
            pid = int(stat.rsplit(")", 1)[1].split()[1])
        except (OSError, ValueError, IndexError):
            return None
        if pid <= 1:
            return None
    return None


def poll_loop():
    while not state["sid"]:
        state["sid"] = find_session()
        if not state["sid"]:
            time.sleep(2)
    log(f"sessão {state['sid']}")
    while True:
        try:
            items = http("GET", f"/api/canal/inbox?sid={state['sid']}", timeout=35) or []
        except (OSError, urllib.error.URLError, ValueError) as e:
            log(f"sala fora do ar ({e}); tentando de novo")
            time.sleep(5)
            continue
        for it in items:
            if it.get("tipo") == "msg":
                send({"jsonrpc": "2.0", "method": "notifications/claude/channel",
                      "params": {"content": it["texto"],
                                 "meta": {"chat_id": "sala", "message_id": it["id"], "user": (USER or "usuario").lower(),
                                          "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}}})
            elif it.get("tipo") == "perm":
                send({"jsonrpc": "2.0", "method": "notifications/claude/channel/permission",
                      "params": {"request_id": it["request_id"], "behavior": it["behavior"]}})


def call_tool(name, args):
    text = str(args.get("text", "")).strip()
    if not text:
        return {"content": [{"type": "text", "text": "texto vazio"}], "isError": True}
    if not state["sid"]:
        return {"content": [{"type": "text", "text": "canal ainda não achou a sessão"}], "isError": True}
    path = {"reply": "/api/canal/resposta", "recado": "/api/canal/recado"}.get(name)
    if not path:
        return {"content": [{"type": "text", "text": f"ferramenta desconhecida: {name}"}], "isError": True}
    try:
        http("POST", path, {"sid": state["sid"], "text": text})
    except (OSError, urllib.error.URLError, ValueError) as e:
        return {"content": [{"type": "text", "text": f"sala fora do ar: {e}"}], "isError": True}
    return {"content": [{"type": "text", "text": "entregue na sala" if name == "reply" else "recado fixado no quadro"}]}


def handle(msg):
    method, mid = msg.get("method"), msg.get("id")
    params = msg.get("params") or {}
    if method == "initialize":
        send({"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": params.get("protocolVersion", "2025-06-18"),
            "capabilities": {"tools": {}, "experimental": {"claude/channel": {}, "claude/channel/permission": {}}},
            "serverInfo": {"name": "sala", "version": "1.0.0"},
            "instructions": INSTRUCTIONS}})
    elif method == "notifications/initialized":
        threading.Thread(target=poll_loop, daemon=True).start()
    elif method == "tools/list":
        send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
    elif method == "tools/call":
        send({"jsonrpc": "2.0", "id": mid, "result": call_tool(params.get("name"), params.get("arguments") or {})})
    elif method == "notifications/claude/channel/permission_request":
        try:
            http("POST", "/api/canal/permissao", {"sid": state["sid"], **{k: str(params.get(k, "")) for k in
                 ("request_id", "tool_name", "description", "input_preview")}})
        except (OSError, urllib.error.URLError, ValueError) as e:
            log(f"não consegui repassar o pedido de permissão: {e}")
    elif method == "ping":
        send({"jsonrpc": "2.0", "id": mid, "result": {}})
    elif mid is not None:
        send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"método desconhecido: {method}"}})


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            handle(json.loads(line))
        except Exception as e:  # um erro numa mensagem não derruba o canal
            log(f"erro: {e}")


if __name__ == "__main__":
    main()
