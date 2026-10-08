"""Hook do Claude Code: grava só metadados do evento, nunca conversa.

Lê o JSON do hook na entrada padrão e acrescenta uma linha no arquivo do dia
em ~/.local/share/sala-dos-agentes/. Qualquer erro é engolido: um hook nunca
pode atrapalhar o Claude Code.
"""

import json
import os
import sys
import time

# Campos de identificação e estado. Do conteúdo, só o que o usuário pediu pra
# ver na sala (decisão de 2026-10-08): o começo do pedido e a tarefa curta que
# a sessão passa a cada subagente. Nada de resposta, nem entrada/saída das
# outras ferramentas.
FIELDS = ("hook_event_name", "session_id", "cwd", "agent_id", "agent_type",
          "tool_name", "notification_type", "reason")
PROMPT_CHARS = 100


def data_dir():
    base = os.environ.get("SALA_AGENTES_DIR") or os.path.join(
        os.path.expanduser("~"), ".local", "share", "sala-dos-agentes")
    return base


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict) or not payload.get("session_id"):
            return
        event = {k: payload[k] for k in FIELDS if isinstance(payload.get(k), str)}
        name = payload.get("hook_event_name")
        if name == "UserPromptSubmit" and isinstance(payload.get("prompt"), str):
            text = " ".join(payload["prompt"].split())
            event["pedido"] = text[:PROMPT_CHARS] + ("…" if len(text) > PROMPT_CHARS else "")
        tool_input = payload.get("tool_input")
        if name == "PreToolUse" and payload.get("tool_name") in ("Agent", "Task") and isinstance(tool_input, dict):
            for src, dst in (("description", "tarefa"), ("subagent_type", "tipo")):
                if isinstance(tool_input.get(src), str):
                    event[dst] = tool_input[src][:120]
        event["t"] = time.time()
        folder = data_dir()
        os.makedirs(folder, exist_ok=True)
        fname = "events-" + time.strftime("%Y-%m-%d") + ".jsonl"
        line = json.dumps(event, ensure_ascii=False) + "\n"
        # Uma única escrita em modo append: linhas curtas não se misturam
        # entre sessões que gravam ao mesmo tempo.
        fd = os.open(os.path.join(folder, fname), os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.write(fd, line.encode("utf-8"))
        finally:
            os.close(fd)
    except Exception:
        pass


if __name__ == "__main__":
    main()
