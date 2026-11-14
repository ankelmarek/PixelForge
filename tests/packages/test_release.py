"""Hostile archives are constructed locally; no payload is ever extracted."""

import copy
import hashlib
from datetime import datetime, timezone
from email.utils import formatdate
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import threading
import urllib.request
import importlib.util
import io
import json
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("release", ROOT / "tools/release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def fixture(files=None, change=None, extra=None, compression=zipfile.ZIP_STORED):
    files = (
        files
        if files is not None
        else {
            "index.html": b'<script src="./assets/app.js"></script>',
            "assets/app.js": b'console.log("PixelForge")',
        }
    )
    manifest = {
        "formatVersion": 1,
        "project": "pixelforge",
        "packageType": "full",
        "releaseVersion": "0.6.0",
        "baseVersion": None,
        "requiredUpdaterVersion": "1.0.0",
        "engineSchemaVersion": 2,
        "files": [
            {"path": p, "size": len(d), "sha256": hashlib.sha256(d).hexdigest()}
            for p, d in files.items()
        ],
        "deletions": [],
    }
    if change:
        change(manifest)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
        archive.writestr("manifest.json", json.dumps(manifest))
        if extra:
            extra(archive)
    return output.getvalue()


class Packages(unittest.TestCase):
    def reject(self, raw, code=None, **kwargs):
        with self.assertRaisesRegex(release.PackageError, code or "."):
            release.validate_bytes(raw, **kwargs)

    def test_valid_full_and_read_only_cli(self):
        raw = fixture()
        result = release.validate_bytes(raw, expected_version="0.6.0")
        self.assertEqual(result["files"], 2)
        self.assertEqual(result["sha256"], hashlib.sha256(raw).hexdigest())
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "valid.zip"
            archive.write_bytes(raw)
            before = sorted(Path(directory).iterdir())
            process = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "tools/release.py"),
                    "validate",
                    str(archive),
                ],
                capture_output=True,
                text=True,
                cwd=directory,
            )
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertTrue(json.loads(process.stdout)["valid"])
            self.assertEqual(before, sorted(Path(directory).iterdir()))
            archive.write_bytes(b"corrupt")
            process = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "tools/release.py"),
                    "validate",
                    str(archive),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(process.returncode, 2)
            self.assertIn("Package rejected", process.stderr)
            self.assertNotIn("Traceback", process.stderr)

    def test_reproducible_roundtrip_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "dist"
            (source / "assets").mkdir(parents=True)
            (source / "index.html").write_text("<html>Atlas</html>")
            (source / "assets/data.json").write_bytes(b"0" * 50000)
            first = release.package_release(
                source, base / "a", "0.6.0", release_epoch=1794484800
            )
            second = release.package_release(
                source, base / "b", "0.6.0", release_epoch=1794484800
            )
            self.assertEqual(first["sha256"], second["sha256"])
            self.assertEqual(
                first,
                release.package_release(
                    source, base / "a", "0.6.0", release_epoch=1794484800
                ),
            )
            with zipfile.ZipFile(first["archive"]) as archive:
                # Highly compressible legitimate content is stored, not emitted as a bomb.
                self.assertEqual(
                    archive.getinfo("assets/data.json").compress_type,
                    zipfile.ZIP_STORED,
                )
                self.assertEqual(archive.read("assets/data.json"), b"0" * 50000)
            (source / "index.html").write_text("changed")
            with self.assertRaisesRegex(release.PackageError, "OUTPUT"):
                release.package_release(
                    source, base / "a", "0.6.0", release_epoch=1794484800
                )
            self.assertEqual(
                hashlib.sha256(Path(first["archive"]).read_bytes()).hexdigest(),
                first["sha256"],
            )
            self.assertFalse(list((base / "a").glob(".pixelforge-*")))

    def test_new_release_is_not_http_304_when_extraction_preserves_zip_dates(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "dist"
            source.mkdir()
            (source / "index.html").write_bytes(b"new release")
            old_epoch, epoch = 1794484800, 1794571200
            result = release.package_release(
                source, base / "out", "0.6.1", release_epoch=epoch
            )
            site = base / "site"
            with zipfile.ZipFile(result["archive"]) as archive:
                archive.extractall(site)
                for info in archive.infolist():
                    mtime = datetime(*info.date_time, tzinfo=timezone.utc).timestamp()
                    self.assertEqual(mtime, epoch)
                    os.utime(site / info.filename, (mtime, mtime))

            class QuietHandler(SimpleHTTPRequestHandler):
                def log_message(self, *_args):
                    pass

            server = ThreadingHTTPServer(
                ("127.0.0.1", 0), partial(QuietHandler, directory=str(site))
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                request = urllib.request.Request(
                    f"http://127.0.0.1:{server.server_port}/index.html",
                    headers={"If-Modified-Since": formatdate(old_epoch, usegmt=True)},
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), b"new release")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_release_epoch_must_be_explicit_and_fit_zip_dates(self):
        for epoch in [None, True, 0, 4354819199, "1794571200", 1794571200.5]:
            with self.subTest(epoch=epoch):
                with self.assertRaisesRegex(release.PackageError, "RELEASE_EPOCH"):
                    release.release_timestamp(epoch)

    def test_missing_manifest_index_and_inventory_mismatch(self):
        self.reject(fixture(files={"assets/app.js": b"ok"}), "MANIFEST")
        self.reject(fixture(change=lambda m: m["files"].pop()), "MANIFEST")
        self.reject(
            fixture(
                change=lambda m: m["files"].append(
                    {
                        "path": "assets/missing.png",
                        "size": 0,
                        "sha256": hashlib.sha256(b"").hexdigest(),
                    }
                )
            ),
            "MANIFEST",
        )
        self.reject(
            fixture(extra=lambda z: z.writestr("assets/extra.js", b"extra")), "MANIFEST"
        )
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, "w") as archive:
            archive.writestr("index.html", "no manifest")
        self.reject(raw.getvalue(), "MANIFEST")

    def test_manifest_contract_and_versions(self):
        for key, values in {
            "formatVersion": [True, 0, 2, "1"],
            "project": ["other", None],
            "packageType": ["delta", "commands"],
            "baseVersion": ["0.5.0"],
            "requiredUpdaterVersion": ["1.0.1", "2.0.0", "bad", "1.0.0-beta", "01.0.0"],
            "releaseVersion": [None, "latest", "0.6.0+meta"],
            "engineSchemaVersion": [True, 1, 3, "2"],
            "deletions": [["index.html"], None],
            "files": [None, [], {}],
        }.items():
            for value in values:
                with self.subTest(key=key, value=value):
                    self.reject(fixture(change=lambda m: m.update({key: value})))
        self.reject(
            fixture(change=lambda m: m.update({"postInstall": "echo forbidden"})),
            "MANIFEST",
        )
        self.reject(fixture(), "VERSION", expected_version="0.5.0")

    def test_file_metadata_and_hash(self):
        for key, value in [
            ("size", True),
            ("size", -1),
            ("size", 999999999),
            ("size", 3),
            ("sha256", "bad"),
            ("sha256", "0" * 64),
            ("path", "assets/missing.js"),
        ]:
            with self.subTest(key=key, value=value):
                self.reject(
                    fixture(change=lambda m: m["files"][0].update({key: value}))
                )
        self.reject(
            fixture(change=lambda m: m["files"].append(copy.deepcopy(m["files"][0]))),
            "DUPLICATE",
        )

    def test_traversal_alternate_absolute_reserved_and_server_paths(self):
        for path in [
            "../escape.js",
            "/assets/a.js",
            "C:/assets/a.js",
            "assets\\a.js",
            "assets/../a.js",
            "assets//a.js",
            "assets/./a.js",
            "assets/%2e%2e/a.js",
            "assets/a.js.",
            "assets/a.js ",
            "assets/con.png",
            "assets/NUL.js",
            "assets/a.php",
            "assets/a.php.js",
            "assets/.env",
            "assets/.htaccess",
            "assets/.user.ini",
            "assets/storage/a.json",
            "admin-updater/app.js",
            "storage/a.json",
            "backups/a.json",
            "src/main.js",
            "node_modules/a.js",
            "assets/source.ts",
            "assets/debug.map",
            "assets/ż.png",
            "assets/a\x00.js",
        ]:
            with self.subTest(path=path):
                self.reject(fixture(extra=lambda z: z.writestr(path, b"bad")))
                self.reject(
                    fixture(change=lambda m: m["files"][0].update({"path": path}))
                )

    def test_duplicate_case_aliases_and_json_keys(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            self.reject(
                fixture(extra=lambda z: z.writestr("assets/app.js", b"duplicate")),
                "DUPLICATE",
            )
        self.reject(
            fixture(extra=lambda z: z.writestr("assets/APP.js", b"alias")), "DUPLICATE"
        )
        with self.assertRaises(release.PackageError):
            release.parse_json(b'{"files": [], "files": []}')
        for raw in [b"{broken", b'{"x": NaN}', b"\xff", b"[" * 2000]:
            with self.assertRaises(release.PackageError):
                release.parse_json(raw)

    def test_symlinks_devices_directories_and_executables(self):
        for mode in [
            stat.S_IFLNK | 0o777,
            stat.S_IFDIR | 0o755,
            stat.S_IFIFO | 0o644,
            stat.S_IFCHR | 0o644,
            stat.S_IFSOCK | 0o644,
            stat.S_IFREG | 0o755,
            stat.S_IFREG | 0o4600,
        ]:
            info = zipfile.ZipInfo("assets/special.js")
            info.create_system = 3
            info.external_attr = mode << 16
            with self.subTest(mode=mode):
                self.reject(
                    fixture(extra=lambda z: z.writestr(info, b"/outside")), "ZIP"
                )
        self.reject(fixture(extra=lambda z: z.writestr("assets/", b"")), "PATH")

    def test_bombs_and_all_configurable_limits(self):
        for key in release.DEFAULT_LIMITS:
            with self.subTest(limit=key):
                self.reject(
                    fixture(compression=zipfile.ZIP_DEFLATED), overrides={key: 1}
                )
        self.reject(
            fixture(
                files={"index.html": b"x" * 100000}, compression=zipfile.ZIP_DEFLATED
            ),
            "LIMIT",
        )
        for limits in [
            {"unknown": 1},
            {"maxFiles": False},
            {"maxFileBytes": -1},
            {"maxFiles": 1.2},
        ]:
            with self.assertRaises(release.PackageError):
                release.limits_from(limits)
        self.assertTrue(release.validate_bytes(fixture(), {"maxFiles": 3})["valid"])

    def test_corrupt_truncated_crc_and_deflate(self):
        raw = fixture()
        self.reject(raw[:20])
        self.reject(raw[:-1])
        self.reject(b"prefix" + raw)
        self.reject(raw + b"trailer")
        corrupt = bytearray(raw)
        corrupt[30 + len("index.html")] ^= 0x40
        self.reject(bytes(corrupt), "ZIP")
        corrupt = bytearray(fixture(compression=zipfile.ZIP_DEFLATED))
        corrupt[30 + len("index.html")] = 255
        self.reject(bytes(corrupt), "ZIP")

    def test_central_local_disagreement_and_unsupported_features(self):
        raw = fixture()
        central = raw.index(b"PK\x01\x02")
        for offset, data in [
            (central + 16, struct.pack("<I", 0)),
            (central + 8, struct.pack("<H", 1)),
            (central + 10, struct.pack("<H", 99)),
            (central + 42, struct.pack("<I", 1)),
            (central + 46, b"X"),
            (len(raw) - 12, struct.pack("<H", 65535)),
            (len(raw) - 16, struct.pack("<H", 1)),
            (central + 6, struct.pack("<H", 45)),
        ]:
            changed = bytearray(raw)
            changed[offset : offset + len(data)] = data
            with self.subTest(offset=offset, data=data):
                self.reject(bytes(changed))
        # Even when local and central declared sizes agree, CRC/hash detects lies.
        changed = bytearray(raw)
        struct.pack_into("<I", changed, 22, 1)
        struct.pack_into("<I", changed, central + 24, 1)
        self.reject(bytes(changed))

    def test_hidden_deflate_output_cannot_bypass_size_and_crc_limits(self):
        raw = bytearray(
            fixture(
                files={"index.html": b"x" * 100000},
                compression=zipfile.ZIP_DEFLATED,
                change=lambda m: m["files"][0].update(
                    {"size": 1, "sha256": hashlib.sha256(b"x").hexdigest()}
                ),
            )
        )
        central = raw.index(b"PK\x01\x02")
        import zlib

        for offset in [14, central + 16]:
            struct.pack_into("<I", raw, offset, zlib.crc32(b"x"))
        for offset in [22, central + 24]:
            struct.pack_into("<I", raw, offset, 1)
        self.reject(bytes(raw), "actual expanded size")

    def test_generator_rejects_secrets_and_symlinks_without_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source, output = base / "dist", base / "out"
            source.mkdir()
            (source / "index.html").write_text("ok")
            for name in [".env", "admin-updater/panel.php", "src/main.ts"]:
                path = source / name
                path.parent.mkdir(exist_ok=True)
                path.write_text("must not ship")
                with self.assertRaises(release.PackageError):
                    release.package_release(
                        source, output, "0.6.0", release_epoch=1794484800
                    )
                path.unlink()
            (source / "assets").mkdir()
            link = source / "assets/link.js"
            link.symlink_to(source / "index.html")
            with self.assertRaises(release.PackageError):
                release.package_release(
                    source, output, "0.6.0", release_epoch=1794484800
                )
            link.unlink()
            link.symlink_to(source, target_is_directory=True)
            with self.assertRaises(release.PackageError):
                release.package_release(
                    source, output, "0.6.0", release_epoch=1794484800
                )
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
