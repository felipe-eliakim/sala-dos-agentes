"""Servidor da Sala dos Agentes: só em 127.0.0.1, sem dependências.

    python3 server/sala.py
"""

import json
import secrets
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from config import HOST, PORT, WEB_DIR, DATA_DIR
from store import Store
from chat import Chat
import board

store = Store()
chat = Chat()

# Token que só processos deste usuário leem (arquivo 600): o canal manda no
# cabeçalho X-Sala-Token. A página não precisa dele: as rotas dela exigem que o
# pedido venha da própria página (Origin/Host), o que barra outro site aberto
# no navegador de mandar comandos pra cá.
DATA_DIR.mkdir(parents=True, exist_ok=True)
TOKEN_FILE = DATA_DIR / "token"
if not TOKEN_FILE.exists():
    TOKEN_FILE.touch(mode=0o600)
    TOKEN_FILE.write_text(secrets.token_hex(24))
TOKEN = TOKEN_FILE.read_text().strip()
SELF_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    # ---------- utilidades ----------

    def json_out(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 64_000:
            return None
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
            return data if isinstance(data, dict) else None
        except ValueError:
            return None

    def host_ok(self):
        # Barra "DNS rebinding": um site que aponta o próprio domínio pra 127.0.0.1.
        return self.headers.get("Host") in SELF_HOSTS

    def from_page(self):
        origin = self.headers.get("Origin", "")
        return self.host_ok() and origin in {f"http://{h}" for h in SELF_HOSTS} \
            and self.headers.get("X-Sala") == "1"

    def from_channel(self):
        return self.host_ok() and secrets.compare_digest(self.headers.get("X-Sala-Token", ""), TOKEN)

    # ---------- rotas ----------

    def do_GET(self):
        if not self.host_ok():
            return self.json_out({"erro": "host"}, 403)
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/api/state":
            return self.json_out(store.snapshot(chat))
        if url.path == "/api/chat":
            return self.json_out(chat.messages(q.get("sid", "")))
        if url.path == "/api/canal/inbox":
            if not self.from_channel():
                return self.json_out({"erro": "token"}, 403)
            return self.json_out(chat.poll(q.get("sid", "")))
        if url.path.startswith("/api/"):
            return self.json_out({"erro": "rota"}, 404)
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        data = self.body()
        if data is None:
            return self.json_out({"erro": "corpo"}, 400)
        if path.startswith("/api/canal/"):
            if not self.from_channel():
                return self.json_out({"erro": "token"}, 403)
            sid = str(data.get("sid") or "")
            if not sid:
                return self.json_out({"erro": "sid"}, 400)
            if path == "/api/canal/resposta":
                return self.json_out(chat.reply(sid, data.get("text", "")))
            if path == "/api/canal/recado":
                return self.json_out(board.add_note(data.get("text", ""), "Claude"))
            if path == "/api/canal/permissao":
                chat.ask_permission(sid, str(data.get("request_id", "")), str(data.get("tool_name", "")),
                                    str(data.get("description", "")), str(data.get("input_preview", "")))
                return self.json_out({"ok": True})
            return self.json_out({"erro": "rota"}, 404)
        if not self.from_page():
            return self.json_out({"erro": "origem"}, 403)
        if path == "/api/chat":
            item = chat.send(str(data.get("sid") or ""), data.get("text", ""))
            return self.json_out(item or {"erro": "vazio"}, 200 if item else 400)
        if path == "/api/permissao":
            ok = chat.answer_permission(str(data.get("request_id", "")), data.get("behavior") == "allow")
            return self.json_out({"ok": ok}, 200 if ok else 404)
        if path == "/api/recado/apagar":
            return self.json_out({"ok": board.remove_note(str(data.get("id", "")))})
        return self.json_out({"erro": "rota"}, 404)

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # sem log a cada consulta de 1 s


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as e:
        print(f"Não consegui abrir {HOST}:{PORT}: {e}", file=sys.stderr)
        return 1
    server.daemon_threads = True
    print(f"Sala dos Agentes em http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
