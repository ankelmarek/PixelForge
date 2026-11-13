"""Private process fixture; its stdout configuration is consumed, never logged."""

import json
from pathlib import Path
import tempfile

import panel_fixture as fixtures
import test_updater as core

with tempfile.TemporaryDirectory(prefix="pixelforge-panel-certs-") as temp:
    certs = fixtures.certificate(Path(temp))
    with core.Site() as site:
        server = fixtures.PanelServer(site, certs, production=True)
        try:
            print(json.dumps({
                "url": server.url, "origin": server.origin,
                "username": server.username, "password": server.password,
                "ca": str(server.ca),
                "package": str(site.root / "packages/pixelforge-0.6.2-full.zip"),
            }), flush=True)
            input()
        finally:
            server.close()
