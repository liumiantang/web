from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class UnityBuildHandler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        lower_path = path.lower()
        if lower_path.endswith(".framework.js.br"):
            return "text/javascript"
        if lower_path.endswith(".wasm.br"):
            return "application/wasm"
        if lower_path.endswith(".data.br"):
            return "application/octet-stream"
        return super().guess_type(path)

    def end_headers(self):
        if urlsplit(self.path).path.lower().endswith(".br"):
            self.send_header("Content-Encoding", "br")
        super().end_headers()


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    handler = partial(UnityBuildHandler, directory=str(root))
    ThreadingHTTPServer(("127.0.0.1", 8766), handler).serve_forever()
