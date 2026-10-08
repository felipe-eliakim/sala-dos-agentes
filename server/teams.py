"""Nova equipe: abre um terminal novo na pasta de um projeto já rodando o
claude-sala. A sessão aparece sozinha na sala quando o canal liga.

Só aceita pastas dentro da pasta de projetos (ou ela mesma). O comando é
sempre o mesmo; só a pasta vem da página.
"""

import shutil
import subprocess
from pathlib import Path

from config import HUB_DIR, ROOT

LAUNCHER = ROOT / "ops" / "claude-sala"


def _folder(dir_name):
    if not HUB_DIR:
        return None
    if dir_name in ("", "hub"):
        return HUB_DIR
    if "/" in dir_name or dir_name.startswith(".") or not dir_name:
        return None
    p = (HUB_DIR / dir_name).resolve()
    return p if p.parent == HUB_DIR.resolve() and p.is_dir() else None


def new_team(dir_name, title):
    folder = _folder(str(dir_name or ""))
    if not folder:
        return False, "Pasta de projeto não encontrada."
    title = " ".join(str(title or folder.name).split())[:60] or folder.name
    # bash -ic: carrega o ambiente do usuário; "exec bash" deixa o terminal aberto se o Claude sair
    inner = f"'{LAUNCHER}'; exec bash"
    if shutil.which("gnome-terminal"):
        cmd = ["gnome-terminal", f"--working-directory={folder}", f"--title=Equipe {title}", "--", "bash", "-ic", inner]
    elif shutil.which("x-terminal-emulator"):
        cmd = ["x-terminal-emulator", "-e", "bash", "-ic", f"cd '{folder}' && {inner}"]
    elif shutil.which("xterm"):
        cmd = ["xterm", "-T", f"Equipe {title}", "-e", "bash", "-ic", f"cd '{folder}' && {inner}"]
    else:
        return False, "Não achei um programa de terminal pra abrir (gnome-terminal, x-terminal-emulator ou xterm)."
    try:
        subprocess.Popen(cmd, cwd=folder, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
    except OSError as e:
        return False, f"Não consegui abrir o terminal: {e}"
    return True, "Abri o terminal da nova equipe. Na primeira tela, aperte Enter em “I am using this for local development” e ela aparece aqui."
