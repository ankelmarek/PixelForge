"""Serve a validated, extracted release at / and /PixelForge/ for browser checks."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import tempfile
import threading
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
import release


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def translate_path(self, path):
        if path.startswith("/PixelForge/"):
            path = path[len("/PixelForge") :]
        return super().translate_path(path)


release.validate_file(Path(sys.argv[1]))
with tempfile.TemporaryDirectory(prefix="pixelforge-game-") as directory:
    with zipfile.ZipFile(sys.argv[1]) as archive:
        archive.extractall(directory)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Handler, directory=directory)
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(json.dumps({"port": server.server_port}), flush=True)
    try:
        input()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
