"""Package the isolated U2 tool; never include it in a static game release."""

import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile

from release import release_timestamp, version

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "README.md",
    "config.example.json",
    "release.json",
    "cli.php",
    "src/Support.php",
    "src/Package.php",
    "src/Updater.php",
    "src/PanelConfig.php",
    "src/PanelAuth.php",
    "src/Panel.php",
    "src/PanelView.php",
    "panel-setup.php",
    "panel-password.php",
    "web/panel.css",
    "web/panel.js",
]


def main():
    metadata = json.loads((ROOT / "admin-updater/release.json").read_text())
    version(metadata["version"])
    timestamp = release_timestamp(metadata["releaseEpoch"])
    output = io.BytesIO()
    entries = {}
    for name in FILES:
        path = ROOT / "admin-updater" / name
        if path.resolve() != path or not path.is_file():
            raise ValueError("Regular updater source required: " + name)
        entries["admin-updater/" + name] = path.read_bytes()
    entries["admin-updater/MANIFEST.sha256"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name.removeprefix('admin-updater/')}\n"
        for name, data in sorted(entries.items())
    ).encode()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, timestamp)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    raw = output.getvalue()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert archive.testzip() is None
        assert {name: archive.read(name) for name in archive.namelist()} == entries
    digest = hashlib.sha256(raw).hexdigest()
    destination = ROOT / "downloads"
    destination.mkdir(exist_ok=True)
    path = destination / f"pixelforge-updater-u2-{metadata['version']}.zip"
    checksum = path.with_suffix(".zip.sha256")
    for target, data in [(path, raw), (checksum, f"{digest}  {path.name}\n".encode())]:
        if target.is_symlink() or (target.exists() and target.read_bytes() != data):
            raise ValueError("Refusing different content under the same version")
        if not target.exists():
            fd, temporary = tempfile.mkstemp(prefix=".updater-", dir=destination)
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
            {
                "archive": str(path.relative_to(ROOT)),
                "bytes": len(raw),
                "files": len(entries),
                "sha256": digest,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(str(error))
