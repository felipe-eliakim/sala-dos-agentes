"""Instala ou remove os hooks da Sala dos Agentes em ~/.claude/settings.json.

    python3 ops/hooks.py install
    python3 ops/hooks.py remove

Faz cópia do settings.json em ~/.claude/backups/ antes de mexer e só toca nas
entradas cujo comando aponta para o hook/capture.py desta pasta.
"""

import json
import shutil
import sys
import time
from pathlib import Path

SETTINGS = Path.home() / ".claude" / "settings.json"
CAPTURE = Path(__file__).resolve().parent.parent / "hook" / "capture.py"
COMMAND = f"/usr/bin/python3 -I -S {CAPTURE}"
EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification",
          "Stop", "SubagentStart", "SubagentStop", "SessionEnd"]
TOOL_EVENTS = {"PreToolUse", "PostToolUse"}


def ours(entry):
    return any(str(CAPTURE) in h.get("command", "") for h in entry.get("hooks", []))


def strip(settings):
    hooks = settings.get("hooks", {})
    for name in list(hooks):
        hooks[name] = [e for e in hooks[name] if not ours(e)]
        if not hooks[name]:
            del hooks[name]
    if not hooks:
        settings.pop("hooks", None)


def main(action):
    settings = json.loads(SETTINGS.read_text(encoding="utf-8")) if SETTINGS.exists() else {}
    backup = SETTINGS.parent / "backups" / f"settings-{time.strftime('%Y%m%d-%H%M%S')}.json"
    if SETTINGS.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SETTINGS, backup)
    strip(settings)
    if action == "install":
        hooks = settings.setdefault("hooks", {})
        for name in EVENTS:
            entry = {"hooks": [{"type": "command", "command": COMMAND, "timeout": 5}]}
            if name in TOOL_EVENTS:
                entry = {"matcher": "*", **entry}
            hooks.setdefault(name, []).append(entry)
    SETTINGS.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(("Hooks instalados" if action == "install" else "Hooks removidos") + f". Cópia anterior: {backup}")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("install", "remove"):
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1])
