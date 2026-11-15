"""Trusted production fixture and local HTTP server for the U1 browser test."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import release


def prepare(directory):
    public = directory / "public"
    target = public / "PixelForge"
    target.mkdir(parents=True)
    with zipfile.ZipFile(ROOT / "downloads/pixelforge-0.6.1-full.zip") as archive:
        archive.extractall(target)
    source = directory / "source"
    shutil.copytree(target, source)
    (source / "manifest.json").unlink()
    release.package_release(
        source, directory / "packages", "0.6.2", release_epoch=1794581214
    )
    (directory / "config.json").write_text(
        json.dumps(
            {
                "documentRoot": str(public),
                "target": str(target),
                "privateRoot": str(directory / "private"),
                "maxStorageBytes": 134217728,
                "reserveBytes": 1048576,
                "limits": {},
            }
        )
    )


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def translate_path(self, path):
        if path.startswith("/PixelForge/"):
            path = path[len("/PixelForge") :]
        return super().translate_path(path)


if __name__ == "__main__":
    directory = Path(sys.argv[2])
    if sys.argv[1] == "prepare":
        prepare(directory)
    elif sys.argv[1] == "serve":
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            partial(Handler, directory=str(directory / "public/PixelForge")),
        )
        print(server.server_port, flush=True)
        server.serve_forever()
    else:
        raise SystemExit("Expected prepare or serve")
