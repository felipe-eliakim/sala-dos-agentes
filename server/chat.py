"""Conversa entre a sua sala (página) e as sessões abertas com o canal da sala.

O canal (channel/sala_channel.py) roda dentro de cada sessão do Claude Code
aberta com `claude-sala`. Ele busca aqui as mensagens que você mandou (espera
longa de até 25 s) e devolve as respostas e os pedidos de permissão.
"""

import json
import threading
import time
import uuid

from config import DATA_DIR

CHAT_DIR = DATA_DIR / "chat"
ONLINE_SECONDS = 40      # canal que não busca mensagens há mais que isso caiu
HISTORY_MAX = 300


class Chat:
    def __init__(self):
        self.cond = threading.Condition()
        self.inbox = {}          # sid -> itens esperando o canal buscar
        self.history = {}        # sid -> mensagens da conversa
        self.seen = {}           # sid -> última vez que o canal buscou
        self.perms = {}          # request_id -> pedido de permissão pendente

    # ---------- histórico ----------

    def _load(self, sid):
        if sid in self.history:
            return self.history[sid]
        items = []
        try:
            with (CHAT_DIR / f"{sid}.jsonl").open(encoding="utf-8") as f:
                for line in f:
                    try:
                        items.append(json.loads(line))
                    except ValueError:
                        pass
        except OSError:
            pass
        self.history[sid] = items[-HISTORY_MAX:]
        return self.history[sid]

    def _append(self, sid, item):
        self._load(sid).append(item)
        del self.history[sid][:-HISTORY_MAX]
        try:
            CHAT_DIR.mkdir(parents=True, exist_ok=True)
            with (CHAT_DIR / f"{sid}.jsonl").open("a", encoding="utf-8") as f:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        except OSError:
            pass

    def messages(self, sid):
        with self.cond:
            return list(self._load(sid))

    # ---------- lado da página ----------

    def send(self, sid, text):
        text = str(text).strip()[:8000]
        if not text:
            return None
        item = {"id": uuid.uuid4().hex[:10], "t": time.time(), "de": "voce", "texto": text, "entregue": False}
        with self.cond:
            self._append(sid, item)
            self.inbox.setdefault(sid, []).append({"tipo": "msg", "id": item["id"], "texto": text})
            self.cond.notify_all()
        return item

    def answer_permission(self, request_id, allow):
        with self.cond:
            perm = self.perms.pop(request_id, None)
            if not perm:
                return False
            sid = perm["sid"]
            self.inbox.setdefault(sid, []).append(
                {"tipo": "perm", "request_id": request_id, "behavior": "allow" if allow else "deny"})
            for m in self._load(sid):
                if m.get("perm") == request_id:
                    m["resposta"] = "permitido" if allow else "negado"
            self._append(sid, {"id": uuid.uuid4().hex[:10], "t": time.time(), "de": "sistema",
                               "texto": f"{'Permitido' if allow else 'Negado'}: {perm['tool_name']}"})
            self.cond.notify_all()
            return True

    def online(self, now=None):
        now = now or time.time()
        with self.cond:
            return {sid for sid, t in self.seen.items() if now - t < ONLINE_SECONDS}

    def last_reply(self, sid):
        """Quando chegou a última resposta do Claude nessa conversa (0 = nunca)."""
        with self.cond:
            for m in reversed(self._load(sid)):
                if m.get("de") == "claude" or m.get("perm"):
                    return m["t"]
        return 0

    def pending_perms(self):
        with self.cond:
            return [dict(p, request_id=k) for k, p in self.perms.items()]

    # ---------- lado do canal ----------

    def poll(self, sid, wait=25.0):
        deadline = time.time() + wait
        with self.cond:
            self.seen[sid] = time.time()
            while not self.inbox.get(sid):
                left = deadline - time.time()
                if left <= 0:
                    return []
                self.cond.wait(left)
                self.seen[sid] = time.time()
            items, self.inbox[sid] = self.inbox[sid], []
            ids = {i["id"] for i in items if i["tipo"] == "msg"}
            for m in self._load(sid):
                if m.get("id") in ids:
                    m["entregue"] = True
            return items

    def reply(self, sid, text):
        text = str(text).strip()[:20000]
        if not text:
            return None
        item = {"id": uuid.uuid4().hex[:10], "t": time.time(), "de": "claude", "texto": text}
        with self.cond:
            self._append(sid, item)
        return item

    def ask_permission(self, sid, request_id, tool_name, description, input_preview):
        with self.cond:
            self.perms[request_id] = {"sid": sid, "t": time.time(), "tool_name": tool_name,
                                      "description": description, "input_preview": input_preview[:1500]}
            self._append(sid, {"id": uuid.uuid4().hex[:10], "t": time.time(), "de": "sistema",
                               "perm": request_id, "texto": f"Pedido de permissão: {tool_name}",
                               "detalhe": description, "previa": input_preview[:1500]})
