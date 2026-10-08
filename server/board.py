"""Quadro de avisos: recados fixados pelo Claude e pendências do hub."""

import json
import re
import threading
import time
import uuid

from config import DATA_DIR, HUB_DIR

_lock = threading.Lock()
NOTES = DATA_DIR / "recados.json"


def notes():
    try:
        data = json.loads(NOTES.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save(items):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = NOTES.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(NOTES)


def add_note(text, who):
    text = " ".join(str(text).split())[:500]
    if not text:
        return None
    with _lock:
        items = notes()
        item = {"id": uuid.uuid4().hex[:8], "t": time.time(), "texto": text, "quem": who}
        items.append(item)
        _save(items[-50:])
    return item


def remove_note(note_id):
    with _lock:
        items = notes()
        kept = [n for n in items if n.get("id") != note_id]
        _save(kept)
        return len(kept) != len(items)


_hub_cache = {"mtime": None, "items": []}


def hub_pending():
    """Pendências de um painel.html opcional na pasta de projetos.

    Formato: uma lista JS de projetos com campos name: "..." e you: "..." (o
    que depende do usuário). Só leitura; se não existir ou o formato mudar, o
    quadro fica sem essa coluna.
    """
    if not HUB_DIR:
        return []
    path = HUB_DIR / "painel.html"
    try:
        mtime = path.stat().st_mtime
        if mtime == _hub_cache["mtime"]:
            return _hub_cache["items"]
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    items = []
    for block in re.split(r"\n\s*\{\s*n:\s*", text)[1:]:
        name = re.search(r'name:\s*"((?:[^"\\]|\\.)*)"', block)
        you = re.search(r'\byou:\s*"((?:[^"\\]|\\.)*)"', block.split("log:")[0])
        if name and you:
            items.append({"projeto": name.group(1), "texto": you.group(1).replace('\\"', '"')})
    _hub_cache.update(mtime=mtime, items=items)
    return items
