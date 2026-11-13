"""Initial public_html installation; deliberately NOT a game-update archive."""

import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import zipfile

from release import release_timestamp, validate_file

ROOT = Path(__file__).resolve().parents[1]


def build():
    tool = runpy.run_path(str(ROOT / "tools/package-updater.py"))
    release = json.loads((ROOT / "admin-updater/release.json").read_text())
    game = json.loads((ROOT / "package.json").read_text())["version"]
    archive_path = ROOT / "downloads" / f"pixelforge-{game}-full.zip"
    validate_file(archive_path, expected_version=game)
    entries = {}
    with zipfile.ZipFile(archive_path) as archive:
        entries.update(
            {"PixelForge/" + name: archive.read(name) for name in archive.namelist()}
        )
    for name in tool["FILES"]:
        path = ROOT / "admin-updater" / name
        if path.resolve() != path or not path.is_file():
            raise ValueError("Regular installer source required: " + name)
        target = (
            name.removeprefix("hosting/")
            if name.startswith("hosting/")
            else "_pixelforge/tool/" + name
        )
        entries[target] = path.read_bytes()
    entries["INSTALACJA.txt"] = (ROOT / "docs/PUBLIC-HTML-INSTALL.txt").read_bytes()
    entries["_pixelforge/bundle.json"] = (
        json.dumps(
            {
                "format": "pixelforge-hosting-install-v1",
                "installerVersion": release["version"],
                "gameVersion": game,
                "gameArchiveSha256": hashlib.sha256(
                    archive_path.read_bytes()
                ).hexdigest(),
            },
            indent=2,
        )
        + "\n"
    ).encode()
    entries["_pixelforge/MANIFEST.sha256"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name}\n"
        for name, data in sorted(entries.items())
    ).encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, release_timestamp(release["releaseEpoch"]))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    raw = output.getvalue()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert archive.testzip() is None
        assert {name: archive.read(name) for name in archive.namelist()} == entries
    return f"pixelforge-public-html-{game}-installer-{release['version']}.zip", raw


def main():
    name, raw = build()
    digest = hashlib.sha256(raw).hexdigest()
    destination = ROOT / "downloads"
    destination.mkdir(exist_ok=True)
    for target, data in [
        (destination / name, raw),
        (destination / (name + ".sha256"), f"{digest}  {name}\n".encode()),
    ]:
        if target.is_symlink() or (target.exists() and target.read_bytes() != data):
            raise ValueError(
                "Refusing different content under the same installer version"
            )
        if not target.exists():
            fd, temporary = tempfile.mkstemp(prefix=".hosting-", dir=destination)
            try:
                with os.fdopen(fd, "wb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.link(temporary, target)
            finally:
                Path(temporary).unlink(missing_ok=True)
    print(
        json.dumps(
            {"archive": "downloads/" + name, "bytes": len(raw), "sha256": digest},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
