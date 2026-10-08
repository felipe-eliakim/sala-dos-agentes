"""Caminhos, limites e configuração pessoal do usuário.

Nada pessoal mora no repositório: nome, pasta de projetos, nomes de projetos e
departamentos extras ficam em ~/.config/sala-dos-agentes/ (ver exemplos/).
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
HOST = "127.0.0.1"
PORT = int(os.environ.get("SALA_AGENTES_PORT", "8777"))

USER_DIR = Path(os.environ.get("SALA_AGENTES_CONFIG")
                or Path.home() / ".config" / "sala-dos-agentes")
DATA_DIR = Path(os.environ.get("SALA_AGENTES_DIR")
                or Path.home() / ".local" / "share" / "sala-dos-agentes")
SESSIONS_DIR = Path(os.environ.get("SALA_AGENTES_SESSIONS_DIR")
                    or Path.home() / ".claude" / "sessions")

HISTORY_HOURS = 12        # eventos mais velhos que isso não entram no escritório
KEEP_DAYS = 7             # arquivos de evento mais velhos são apagados
SILENT_MINUTES = 10       # sessão sem registro e sem sinal por esse tempo saiu
SUBAGENT_LINGER = 20      # segundos que um subagente concluído fica visível


def read_json(path, default):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, type(default)) else default
    except (OSError, ValueError):
        return default


USER = read_json(USER_DIR / "config.json", {})
# Pasta onde ficam os projetos: a sessão é identificada pela subpasta em que
# está. Sem ela, vale o nome da última pasta do caminho.
_hub = os.environ.get("SALA_AGENTES_HUB_DIR") or USER.get("pasta_projetos")
HUB_DIR = Path(_hub).expanduser() if _hub else None


def project_labels():
    """Nomes bonitos por pasta de projeto (opcional)."""
    return read_json(USER_DIR / "projetos.json", {})
