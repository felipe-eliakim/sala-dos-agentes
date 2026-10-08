"""Equipe fixa do escritório: um funcionário por tipo de agente disponível.

Os tipos embutidos do Claude Code não aparecem em arquivo nenhum, então ficam
listados aqui; os criados pelo usuário vêm de ~/.claude/agents/*.md e de
.claude/agents/ do hub.
"""

import re
from pathlib import Path

from config import ROOT, HUB_DIR, USER_DIR, read_json

BUILTIN = ["general-purpose", "Explore", "Plan", "claude", "claude-code-guide", "statusline-setup"]
AGENT_DIRS = [Path.home() / ".claude" / "agents"] + ([HUB_DIR / ".claude" / "agents"] if HUB_DIR else [])


def _front(text, key):
    m = re.search(rf"^{key}:\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def _custom_types():
    """Agentes criados pelo usuário: (tipo, descrição tirada do próprio arquivo)."""
    found = []
    for folder in AGENT_DIRS:
        for path in sorted(folder.glob("*.md")):
            try:
                head = path.read_text(encoding="utf-8")[:4000]
            except OSError:
                continue
            desc = _front(head, "description")
            found.append((_front(head, "name") or path.stem, desc[:400] + ("…" if len(desc) > 400 else "")))
    return found


def departments():
    names = read_json(ROOT / "departamentos.json", {})
    names.update(read_json(USER_DIR / "departamentos.json", {}))
    out, seen = [], set()
    for kind, desc in [(k, "") for k in BUILTIN] + _custom_types():
        if kind in seen:
            continue
        seen.add(kind)
        info = names.get(kind) or {}
        out.append({"type": kind, "nome": info.get("nome") or kind, "cor": info.get("cor") or "",
                    "funcionario": info.get("funcionario") or kind,
                    "descricao": info.get("descricao") or desc or "Agente personalizado.",
                    "quando": info.get("quando") or ("Quando a sessão decide que a tarefa combina com a descrição acima." if desc else ""),
                    "proprio": kind not in BUILTIN})
    return out
