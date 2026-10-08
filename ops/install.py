"""Instala a Sala dos Agentes nesta máquina (Linux, com systemd de usuário).

    python3 ops/install.py            # tudo: hooks, canal, atalho e serviço
    python3 ops/install.py --remove   # desfaz

O que faz:
1. Registra os hooks em ~/.claude/settings.json (com cópia antes; ver hooks.py).
2. Gera channel/mcp.json com o caminho desta pasta (usado pelo claude-sala).
3. Cria o atalho ~/.local/bin/claude-sala.
4. Gera e liga o serviço systemd de usuário sala-dos-agentes (porta 8777).
5. Cria ~/.config/sala-dos-agentes/ com os exemplos, se ainda não existir.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable or "/usr/bin/python3"
SERVICE = ROOT / "ops" / "sala-dos-agentes.service"
UNIT_DIR = Path.home() / ".config" / "systemd" / "user"
LINK = Path.home() / ".local" / "bin" / "claude-sala"
USER_DIR = Path.home() / ".config" / "sala-dos-agentes"


def run(*cmd):
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=False)


def install():
    run(PY, str(ROOT / "ops" / "hooks.py"), "install")
    (ROOT / "channel" / "mcp.json").write_text(json.dumps({"mcpServers": {"sala": {
        "command": PY, "args": ["-I", str(ROOT / "channel" / "sala_channel.py")]}}}, indent=2) + "\n")
    LINK.parent.mkdir(parents=True, exist_ok=True)
    if LINK.is_symlink() or LINK.exists():
        LINK.unlink()
    LINK.symlink_to(ROOT / "ops" / "claude-sala")
    SERVICE.write_text(f"""[Unit]
Description=Sala dos Agentes (escritório local dos agentes do Claude Code)

[Service]
ExecStart={PY} {ROOT / "server" / "sala.py"}
Restart=on-failure

[Install]
WantedBy=default.target
""")
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    unit = UNIT_DIR / SERVICE.name
    if unit.is_symlink() or unit.exists():
        unit.unlink()
    unit.symlink_to(SERVICE)
    if not USER_DIR.exists():
        shutil.copytree(ROOT / "exemplos", USER_DIR)
        print(f"Configuração de exemplo em {USER_DIR}: ajuste config.json (seu nome e pasta de projetos).")
    run("systemctl", "--user", "daemon-reload")
    run("systemctl", "--user", "enable", "--now", SERVICE.name)
    print("\nPronto: abra http://127.0.0.1:8777 e, pra conversar pela sala, use claude-sala no lugar de claude.")


def remove():
    run("systemctl", "--user", "disable", "--now", SERVICE.name)
    for p in (UNIT_DIR / SERVICE.name, LINK):
        if p.is_symlink() or p.exists():
            p.unlink()
    run(PY, str(ROOT / "ops" / "hooks.py"), "remove")
    print(f"Removido. Dados em ~/.local/share/sala-dos-agentes e configuração em {USER_DIR} foram mantidos.")


if __name__ == "__main__":
    remove() if "--remove" in sys.argv else install()
