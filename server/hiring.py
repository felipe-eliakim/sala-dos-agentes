"""RH: contratar, editar e demitir agentes personalizados do Claude Code.

Cada agente é um arquivo ~/.claude/agents/<id>.md (formato oficial do Claude
Code: cabeçalho com name, description, tools, model, color e o corpo com as
instruções). Nome de departamento, nome do funcionário e cor hex da sala ficam
em ~/.config/sala-dos-agentes/departamentos.json.

Demitir não apaga: move o arquivo pra ~/.claude/agents/.demitidos/.
"""

import json
import re
import threading
import time
from pathlib import Path

from config import USER_DIR, read_json

AGENTS_DIR = Path.home() / ".claude" / "agents"
FIRED_DIR = AGENTS_DIR / ".demitidos"
DEPTS_FILE = USER_DIR / "departamentos.json"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")
BUILTIN = {"general-purpose", "explore", "plan", "claude", "claude-code-guide", "statusline-setup"}  # comparados em minúsculas

# Permissões em linguagem simples -> ferramentas do Claude Code
PERMS = {
    "ler": ["Read", "Grep", "Glob"],
    "web": ["WebFetch", "WebSearch"],
    "editar": ["Edit", "Write", "NotebookEdit"],
    "terminal": ["Bash"],
}
MODELS = {"inherit", "haiku", "sonnet", "opus"}
# cores aceitas pelo Claude Code no campo color, e o tom usado na sala
COLORS = {"red": "#d65a5a", "blue": "#3b82f6", "green": "#3fae6a", "yellow": "#e2b84a",
          "purple": "#8a5cd6", "orange": "#e07b39", "pink": "#d6609a", "cyan": "#2fb3c6"}
_lock = threading.Lock()


def _clean(text, limit):
    return str(text or "").replace("\r", "").strip()[:limit]


def _one_line(text, limit):
    return " ".join(_clean(text, limit * 2).split())[:limit]


def _parse(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    head, body = (m.group(1), m.group(2)) if m else ("", text)
    meta = {}
    for line in head.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip("'\"")
    return meta, body.strip()


def agents():
    """Agentes personalizados do usuário, com o que a ficha de contratação precisa."""
    depts = read_json(DEPTS_FILE, {})
    out = []
    for path in sorted(AGENTS_DIR.glob("*.md")):
        try:
            meta, body = _parse(path)
        except (OSError, UnicodeError):
            continue
        aid = meta.get("name") or path.stem
        tools = [t.strip() for t in meta.get("tools", "").split(",") if t.strip()]
        perms = ["tudo"] if not tools else [k for k, v in PERMS.items() if all(t in tools for t in v)]
        d = depts.get(aid, {})
        out.append({"id": aid, "arquivo": path.name, "descricao": meta.get("description", ""), "instrucoes": body,
                    "modelo": meta.get("model", "inherit"), "cor": meta.get("color", ""), "perms": perms,
                    "nome": d.get("funcionario") or aid, "departamento": d.get("nome") or aid,
                    "editavel": path.parent == AGENTS_DIR})
    return out


def hire(data):
    """Cria ou atualiza um agente. Devolve (ok, mensagem)."""
    aid = _clean(data.get("id"), 41).lower()
    if not SLUG.match(aid):
        return False, "O identificador precisa ter de 2 a 41 letras minúsculas, números ou hífen (ex.: revisor-de-codigo)."
    if aid.lower() in BUILTIN:
        return False, "Esse identificador é de um agente embutido do Claude Code."
    desc = _one_line(data.get("descricao"), 600)
    body = _clean(data.get("instrucoes"), 12000)
    if len(desc) < 15:
        return False, "Escreva o que ele faz (pelo menos uma frase): é por essa descrição que o Claude decide quando chamá-lo."
    if not body:
        return False, "Escreva as instruções de trabalho dele."
    perms = [p for p in data.get("perms") or [] if p in PERMS or p == "tudo"]
    model = data.get("modelo") if data.get("modelo") in MODELS else "inherit"
    color = data.get("cor") if data.get("cor") in COLORS else "blue"
    path = AGENTS_DIR / f"{aid}.md"
    novo = not path.exists()
    if data.get("novo") and not novo:
        return False, "Já existe um agente com esse identificador: escolha outro ou edite o que já existe."
    extras = []
    if not novo:
        # Campos do cabeçalho que a ficha não edita (ex.: skills) são mantidos como estão.
        head = re.match(r"^---\n(.*?)\n---", path.read_text(encoding="utf-8"), re.S)
        if head:
            keep, cur = True, None
            for line in head.group(1).splitlines():
                key = line.split(":", 1)[0].strip() if line[:1] not in (" ", "\t", "-") else None
                if key is not None:
                    keep = key not in ("name", "description", "tools", "model", "color")
                if keep:
                    extras.append(line)
    lines = ["---", f"name: {aid}", f"description: {json.dumps(desc, ensure_ascii=False)}"]
    if "tudo" not in perms:
        tools = []
        for p in ["ler"] + [p for p in perms if p != "ler"]:
            tools += [t for t in PERMS[p] if t not in tools]
        lines.append("tools: " + ", ".join(tools))
    if model != "inherit":
        lines.append(f"model: {model}")
    lines += [f"color: {color}", *extras, "---", "", body, ""]
    with _lock:
        AGENTS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text("\n".join(lines), encoding="utf-8")
        tmp.replace(path)
        depts = read_json(DEPTS_FILE, {})
        depts[aid] = {"nome": _one_line(data.get("departamento"), 40) or aid,
                      "funcionario": _one_line(data.get("nome"), 24) or aid,
                      "cor": COLORS[color], "descricao": desc,
                      "quando": "Quando a sessão decide que a tarefa combina com o que ele faz."}
        USER_DIR.mkdir(parents=True, exist_ok=True)
        DEPTS_FILE.write_text(json.dumps(depts, ensure_ascii=False, indent=2), encoding="utf-8")
    return True, ("Contratado" if novo else "Ficha atualizada") + ": vale para as sessões do Claude Code abertas daqui pra frente."


def fire(aid):
    aid = _clean(aid, 41)
    path = AGENTS_DIR / f"{aid}.md"
    if aid.lower() in BUILTIN or not SLUG.match(aid.lower()) or not path.exists():
        return False, "Agente não encontrado entre os que você contratou."
    with _lock:
        FIRED_DIR.mkdir(parents=True, exist_ok=True)
        path.replace(FIRED_DIR / f"{aid}-{time.strftime('%Y%m%d-%H%M%S')}.md")
        depts = read_json(DEPTS_FILE, {})
        if depts.pop(aid, None) is not None:
            DEPTS_FILE.write_text(json.dumps(depts, ensure_ascii=False, indent=2), encoding="utf-8")
    return True, f"Demitido. O arquivo foi guardado em {FIRED_DIR} (dá pra recontratar movendo de volta)."
