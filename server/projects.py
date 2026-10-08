"""Projetos da pasta de projetos: dados de um painel.html opcional + git de cada pasta.

- painel.html (opcional, na pasta de projetos): lista JS de projetos com
  campos n, name, dir, area, status, desc, stack, next, you, updated e links.
  Lido só pra mostrar; formato diferente = só a parte do git aparece.
- git: último commit (data e mensagem), quantos arquivos com mudança não
  salva e se tem cópia remota. Guardado por 60 s.
"""

import re
import subprocess
import threading
import time

from config import HUB_DIR, project_labels

CACHE_SECONDS = 60
_lock = threading.Lock()
_cache = {"t": 0, "items": []}


def _str(block, key):
    m = re.search(rf'\b{key}:\s*"((?:[^"\\]|\\.)*)"', block)
    return m.group(1).replace('\\"', '"').replace("\\\\", "\\") if m else ""


def _painel():
    path = HUB_DIR / "painel.html"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    gh = re.search(r'const GH\s*=\s*"([^"]*)"', text)
    gh = gh.group(1) if gh else ""
    items = []
    for block in re.split(r"\n\s*\{\s*n:\s*", text)[1:]:
        num = re.match(r"(\d+)", block)
        head = block.split("log:")[0]
        links = []
        lm = re.search(r"links:\s*\[(.*?)\]\s*,\s*\n", head, re.S)
        if lm:
            for title, rest in re.findall(r'\[\s*"((?:[^"\\]|\\.)*)"\s*,\s*([^\]]+)\]', lm.group(1)):
                url = re.search(r'"([^"]*)"', rest)
                if url:
                    links.append([title, (gh if "GH" in rest else "") + url.group(1)])
        log = re.findall(r'\[\s*"(\d{4}-\d\d-\d\d)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]', block.split("log:", 1)[1]) if "log:" in block else []
        items.append({"n": int(num.group(1)) if num else 0, "nome": _str(head, "name"), "dir": _str(head, "dir"),
                      "area": _str(head, "area"), "status": _str(head, "status"), "desc": _str(head, "desc"),
                      "stack": _str(head, "stack"), "proximo": _str(head, "next"), "voce": _str(head, "you"),
                      "atualizado": _str(head, "updated"), "links": links, "historico": log[:5]})
    return items


def _git(folder):
    def run(*args):
        try:
            r = subprocess.run(["git", "-C", str(folder), *args], capture_output=True, text=True, timeout=3)
            return r.stdout.strip() if r.returncode == 0 else ""
        except (OSError, subprocess.TimeoutExpired):
            return ""
    last = run("log", "-1", "--format=%ct\t%s")
    t, _, msg = last.partition("\t")
    return {"commit_t": int(t) if t.isdigit() else None, "commit": msg[:120],
            "pendentes": len([l for l in run("status", "--porcelain").splitlines() if l.strip()]),
            "remoto": bool(run("remote"))}


def projects():
    if not HUB_DIR:
        return []
    with _lock:
        if time.time() - _cache["t"] < CACHE_SECONDS:
            return _cache["items"]
        labels = project_labels()
        items = {p["dir"]: p for p in _painel() if p["dir"]}
        try:
            folders = sorted(p for p in HUB_DIR.iterdir() if p.is_dir() and not p.name.startswith("."))
        except OSError:
            folders = []
        for f in folders:
            p = items.setdefault(f.name, {"n": 999, "nome": labels.get(f.name) or f.name, "dir": f.name, "status": "",
                                          "area": "", "desc": "", "stack": "", "proximo": "", "voce": "",
                                          "atualizado": "", "links": [], "historico": []})
            p["existe"] = True
            p.update(_git(f) if (f / ".git").exists() else {"commit_t": None, "commit": "", "pendentes": 0, "remoto": False, "semgit": True})
        out = sorted(items.values(), key=lambda p: (p["n"], p["nome"].lower()))
        _cache.update(t=time.time(), items=out)
        return out
