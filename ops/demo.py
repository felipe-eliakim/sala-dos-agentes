"""Modo demonstração: sala com agentes fictícios, sem tocar nos dados reais.

    python3 ops/demo.py            # abre em http://127.0.0.1:8778

Usa uma pasta temporária de eventos e uma pasta de sessões vazia, e fica
gerando eventos de mentira a cada poucos segundos.
"""

import json
import os
import random
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUB = "/tmp/projetos-demo"
TOOLS = ["Read", "Grep", "Edit", "Write", "Bash", "WebSearch", "Glob"]
SESSIONS = {"demo-1": "meu-app", "demo-2": "site-da-loja", "demo-3": "", "demo-4": "api-de-pedidos"}
SUBS = ["Explore", "Plan", "general-purpose", "claude-code-guide"]
TASKS = ["Mapear telas do app", "Revisar migrações SQL", "Planejar fase 2", "Procurar uso de Number()", "Ler docs de hooks"]
PEDIDOS = ["corrige o bug do saldo negativo", "publica o site e testa no celular", "planeja a tela de agenda", "revisa a segurança do checkout"]


def main():
    # kill/systemctl mandam SIGTERM: trata igual a Ctrl+C pra derrubar o servidor filho junto.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    tmp = Path(tempfile.mkdtemp(prefix="sala-demo-"))
    (tmp / "sessions").mkdir()
    (tmp / "token").write_text("demo")
    env = {**os.environ, "SALA_AGENTES_DIR": str(tmp), "SALA_AGENTES_SESSIONS_DIR": str(tmp / "sessions"),
           "SALA_AGENTES_HUB_DIR": HUB, "SALA_AGENTES_CONFIG": str(tmp / "config"),
           "SALA_AGENTES_PORT": os.environ.get("SALA_AGENTES_PORT", "8778")}
    server = subprocess.Popen([sys.executable, str(ROOT / "server" / "sala.py")], env=env)
    path = tmp / f"events-{time.strftime('%Y-%m-%d')}.jsonl"
    state = {sid: {"busy": False, "subs": {}} for sid in SESSIONS}
    n = 0

    def emit(sid, name, **kw):
        sub = SESSIONS[sid]
        cwd = HUB + ("/" + sub if sub else "")
        with path.open("a") as f:
            f.write(json.dumps({"hook_event_name": name, "session_id": sid, "cwd": cwd, "t": time.time(), **kw}) + "\n")

    for sid in SESSIONS:
        emit(sid, "SessionStart")
    try:
        while True:
            time.sleep(2.5)
            for sid, st in state.items():
                r = random.random()
                if not st["busy"] and r < 0.35:
                    st["busy"] = True
                    emit(sid, "UserPromptSubmit", pedido=random.choice(PEDIDOS))
                elif st["busy"]:
                    if r < 0.12:
                        st["busy"] = False
                        emit(sid, "Stop")
                    elif r < 0.18:
                        emit(sid, "PreToolUse", tool_name="AskUserQuestion")
                    elif r < 0.28 and len(st["subs"]) < 3:
                        n += 1
                        aid = f"{sid}-a{n}"
                        st["subs"][aid] = random.choice(SUBS)
                        emit(sid, "PreToolUse", tool_name="Agent", tipo=st["subs"][aid], tarefa=random.choice(TASKS))
                        emit(sid, "SubagentStart", agent_id=aid, agent_type=st["subs"][aid])
                    else:
                        emit(sid, "PreToolUse", tool_name=random.choice(TOOLS))
                else:
                    emit(sid, "Notification", notification_type="idle_prompt")  # mantém vivo
                for aid, kind in list(st["subs"].items()):
                    if random.random() < 0.15:
                        del st["subs"][aid]
                        emit(sid, "SubagentStop", agent_id=aid, agent_type=kind)
                    else:
                        emit(sid, "PreToolUse", agent_id=aid, tool_name=random.choice(TOOLS))
    except KeyboardInterrupt:
        pass
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
