"""Leitura incremental dos arquivos de evento e do registro de sessões."""

import json
import threading
import time
from pathlib import Path

from config import (DATA_DIR, SESSIONS_DIR, HUB_DIR, HISTORY_HOURS, KEEP_DAYS,
                    SILENT_MINUTES, SUBAGENT_LINGER, project_labels)
import state
import roster
import board


class Store:
    def __init__(self, data_dir=DATA_DIR, sessions_dir=SESSIONS_DIR, hub_dir=HUB_DIR):
        self.data_dir = Path(data_dir)
        self.sessions_dir = Path(sessions_dir)
        self.hub_dir = Path(hub_dir)
        self.sessions = {}
        self.feed = []             # tarefas concluídas, para o quadro
        self.offsets = {}          # arquivo -> bytes já lidos
        self.lock = threading.Lock()
        self.labels = project_labels()
        self._cleanup()

    def _cleanup(self):
        cutoff = time.time() - KEEP_DAYS * 86400
        for path in self.data_dir.glob("events-*.jsonl"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink()
            except OSError:
                pass

    def ingest(self):
        """Lê as linhas novas de hoje e de ontem (sessões que viram a meia-noite)."""
        since = time.time() - HISTORY_HOURS * 3600
        days = {time.strftime("%Y-%m-%d", time.localtime(time.time() - d * 86400)) for d in (0, 1)}
        for day in sorted(days):
            path = self.data_dir / f"events-{day}.jsonl"
            try:
                with path.open("rb") as f:
                    f.seek(self.offsets.get(path, 0))
                    while True:
                        start = f.tell()
                        raw = f.readline()
                        if not raw:
                            break
                        if not raw.endswith(b"\n"):     # linha ainda sendo escrita
                            f.seek(start)
                            break
                        try:
                            ev = json.loads(raw)
                        except ValueError:
                            continue
                        if isinstance(ev, dict) and isinstance(ev.get("t"), (int, float)) and ev["t"] >= since:
                            state.apply(self.sessions, ev, self.feed)
                    self.offsets[path] = f.tell()
            except OSError:
                continue

    def registry(self):
        """Sessões que o Claude Code registra como abertas, e se o processo vive."""
        reg, alive = {}, {}
        for path in self.sessions_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            sid = data.get("sessionId") if isinstance(data, dict) else None
            if not isinstance(sid, str):
                continue
            pid = data.get("pid")
            ok = isinstance(pid, int) and pid > 0 and Path(f"/proc/{pid}").exists()
            if ok or sid not in reg:
                reg[sid], alive[sid] = data, ok
        return reg, alive

    def snapshot(self, chat=None):
        with self.lock:
            self.ingest()
            reg, alive = self.registry()
            now = time.time()
            visible = state.reconcile(self.sessions, reg, alive, now,
                                      SILENT_MINUTES, SUBAGENT_LINGER)
            # Esquece sessões encerradas há mais tempo que o histórico.
            old = now - HISTORY_HOURS * 3600
            for sid in [k for k, s in self.sessions.items() if s["state"] == "ended" and s["last"] < old]:
                del self.sessions[sid]
            for s in visible:
                s["projeto"] = state.project_label(s["cwd"], self.hub_dir, self.labels)
                s["dir"] = state.project_of(s["cwd"], self.hub_dir)
            feed = [dict(f, projeto=state.project_label(f["cwd"], self.hub_dir, self.labels))
                    for f in reversed(self.feed) if f["t"] >= old]
        online = chat.online(now) if chat else set()
        for s in visible:
            s["canal"] = s["id"] in online
        return {"now": now, "hooks": any(self.data_dir.glob("events-*.jsonl")),
                "sessions": visible, "departments": roster.departments(),
                "board": {"concluidas": feed[:30], "recados": board.notes()[::-1],
                          "hub": board.hub_pending(), "permissoes": chat.pending_perms() if chat else []}}
