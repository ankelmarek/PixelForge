"""Private browser fixture; stdout is consumed by Playwright, never logged."""

from contextlib import ExitStack
import json
from pathlib import Path
import runpy
import tempfile
import zipfile

from fixture import HostingServer, ROOT, certificate
from test_release import fixture

with tempfile.TemporaryDirectory(
    prefix="pixelforge-hosting-browser-"
) as temp, ExitStack() as stack:
    root = Path(temp)
    certs = certificate(root)
    name, bundle = runpy.run_path(str(ROOT / "tools/package-hosting.py"))["build"]()
    # Exercise the published bytes when present, and reject a stale archive.
    published = ROOT / "downloads" / name
    if published.exists():
        assert published.read_bytes() == bundle, "Hosting archive differs from source"
        bundle = published.read_bytes()
    with zipfile.ZipFile(ROOT / "downloads/pixelforge-0.7.0-full.zip") as archive:
        files = {
            name: archive.read(name)
            for name in archive.namelist()
            if name != "manifest.json"
        }
    release = root / "fixture-0.7.1-full.zip"
    release.write_bytes(
        fixture(
            files=files,
            change=lambda value: value.update(releaseVersion="0.7.1"),
            compression=zipfile.ZIP_DEFLATED,
        )
    )
    configurations = []
    for device in ("desktop", "mobile", "no-js"):
        server = stack.enter_context(
            HostingServer(certs, bundle=bundle, settings=device == "no-js")
        )
        configurations.append(
            {
                "device": device,
                "url": server.url,
                "origin": server.origin,
                "username": server.username,
                "password": server.password,
                "key": server.key,
                "settingsPath": str(server.settings_path),
            }
        )
    print(
        json.dumps(
            {"ca": str(certs[0]), "package": str(release), "servers": configurations}
        ),
        flush=True,
    )
    input()
