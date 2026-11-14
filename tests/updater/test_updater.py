"""Real PHP/filesystem/HTTP processes; fixture generation uses Python stdlib."""

from email.utils import formatdate
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import selectors
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/packages"))
import test_release as package_fixtures  # noqa: E402

fixture = package_fixtures.fixture

PHP = os.environ.get("PIXELFORGE_PHP", "php")
CLI = ROOT / "admin-updater/cli.php"
DRIVER = ROOT / "tests/updater/driver.php"
if shutil.which(PHP) is None:
    raise RuntimeError(
        "PHP 8.2+ with ZipArchive required; set PIXELFORGE_PHP if needed"
    )


def package(version, *, extra=False, content=None):
    files = {
        "index.html": b'<html><script src="./assets/app.js"></script></html>',
        "assets/app.js": content or f'window.release="{version}";'.encode(),
    }
    if extra:
        files["assets/add.json"] = b'{"new":true}'
    return fixture(files=files, change=lambda m: m.update(releaseVersion=version))


class Site:
    def __init__(self, empty=False):
        self.temp = tempfile.TemporaryDirectory(prefix="pixelforge-u1-")
        self.root = Path(self.temp.name)
        self.public = self.root / "public"
        self.target = self.public / "PixelForge"
        self.target.mkdir(parents=True)
        self.private = self.root / "private"
        self.config = {
            "documentRoot": str(self.public),
            "target": str(self.target),
            "privateRoot": str(self.private),
            "maxStorageBytes": 32 * 1024 * 1024,
            "reserveBytes": 1024 * 1024,
            "limits": {},
        }
        self.config_path = self.root / "config.json"
        self.save_config()
        if not empty:
            with zipfile.ZipFile(io.BytesIO(package("0.6.0"))) as archive:
                archive.extractall(self.target)
        self.initial = self.call("init")

    def save_config(self):
        self.config_path.write_text(json.dumps(self.config))

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.temp.cleanup()

    def command(self, name, *args):
        return [PHP, str(CLI), name, str(self.config_path), *map(str, args)]

    def call(self, name, *args, error=None):
        process = subprocess.run(
            self.command(name, *args), capture_output=True, text=True, timeout=15
        )
        if error:
            assert process.returncode == 2, process.stdout + process.stderr
            assert error in process.stderr, process.stderr
            return process.stderr
        assert process.returncode == 0, process.stdout + process.stderr
        return json.loads(process.stdout)

    def prepare(self, version="0.6.1", **kwargs):
        path = self.root / f"{version}.zip"
        path.write_bytes(package(version, **kwargs))
        return self.call("prepare", path)

    def apply(self, plan, **kwargs):
        return self.call("apply", plan["id"], plan["packageHash"], **kwargs)

    def active(self):
        return self.call("status")["state"]["active"]

    def fault(self, command, point, mode, *args):
        return subprocess.Popen(
            [
                PHP,
                str(DRIVER),
                command,
                str(self.config_path),
                point,
                mode,
                *map(str, args),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

    def kill_at(self, command, point, *args):
        process = self.fault(command, point, "hold", *args)
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                assert selector.select(timeout=10), f"Checkpoint timeout: {point}"
                line = process.stdout.readline()
                if not line:
                    raise AssertionError(process.stderr.read())
                assert json.loads(line) == {"checkpoint": point}, line
            process.kill()  # SIGKILL: no PHP finally/cleanup can run.
            process.wait(timeout=5)
            assert process.returncode < 0
        finally:
            if process.poll() is None:
                process.kill()
            process.communicate(timeout=5)


class Installer(unittest.TestCase):
    def test_doctor_and_full_install_preview_retry_rollback(self):
        with Site() as site:
            self.assertTrue(site.call("doctor")["ready"])
            plan = site.prepare(extra=True)
            self.assertEqual(plan["diff"]["changed"], ["assets/app.js"])
            self.assertEqual(plan["diff"]["added"], ["assets/add.json"])
            self.assertEqual(site.active()["version"], "0.6.0")
            result = site.apply(plan)
            self.assertEqual(result["state"]["active"]["version"], "0.6.1")
            self.assertEqual(result["state"]["previous"], site.initial["active"])
            self.assertEqual(site.apply(plan)["status"], "unchanged")
            current, previous = result["state"]["active"], result["state"]["previous"]
            rolled = site.call("rollback", current["id"], previous["id"])
            self.assertEqual(rolled["state"]["active"]["version"], "0.6.0")
            self.assertEqual(
                site.call("rollback", current["id"], previous["id"])["status"],
                "unchanged",
            )
            self.assertFalse((site.target / "assets/add.json").exists())
            self.assertEqual(len(site.call("prune")["kept"]), 2)
            self.assertFalse((site.private / "transaction.json").exists())

    def test_first_install_and_interrupted_first_install(self):
        for point in [None, "old-moved", "new-moved"]:
            with self.subTest(point=point), Site(empty=True) as site:
                plan = site.prepare()
                if point:
                    site.kill_at("apply", point, plan["id"], plan["packageHash"])
                    self.assertIsNone(site.call("recover")["active"])
                result = site.apply(plan)
                self.assertEqual(result["state"]["active"]["version"], "0.6.1")
                self.assertIsNone(result["state"]["previous"])

    def test_invalid_packages_do_not_change_site(self):
        with Site() as site:
            archive = site.root / "bad.zip"
            archive.write_bytes(b"not a zip")
            site.call("prepare", archive, error="ZIP")
            archive.write_bytes(
                fixture(files={"index.html": b"ok", "assets/a.php.js": b"bad"})
            )
            site.call("prepare", archive, error="PATH")
            self.assertEqual(site.active(), site.initial["active"])
            self.assertEqual(list((site.private / "staging").iterdir()), [])

    def test_same_version_downgrade_and_exact_repeat(self):
        with Site() as site:
            self.assertEqual(site.prepare("0.6.0")["status"], "unchanged")
            path = site.root / "changed.zip"
            path.write_bytes(package("0.6.0", content=b"different"))
            site.call("prepare", path, error="VERSION")
            path.write_bytes(package("0.5.9"))
            site.call("prepare", path, error="VERSION")
            self.assertEqual(site.active(), site.initial["active"])

    def test_stale_preview_and_explicit_confirmation(self):
        with Site() as site:
            first = site.prepare("0.6.1")
            second = site.prepare("0.6.2")
            site.call("apply", first["id"], "0" * 64, error="PLAN")
            site.apply(first)
            site.apply(second, error="PLAN")
            self.assertEqual(site.active()["version"], "0.6.1")

    def test_modified_staging_zip_and_plan_are_rejected(self):
        for changed in ["zip", "file", "manifest-and-plan", "preview"]:
            with self.subTest(changed=changed), Site() as site:
                plan = site.prepare()
                stage = site.private / "staging" / plan["id"]
                if changed == "zip":
                    (stage / "package.zip").write_bytes(package("0.6.2"))
                elif changed == "file":
                    (stage / "release/assets/app.js").write_bytes(b"corrupt")
                elif changed == "preview":
                    plan["diff"]["changed"] = []
                    (stage / "plan.json").write_text(json.dumps(plan))
                else:
                    path = stage / "release/manifest.json"
                    manifest = json.loads(path.read_bytes())
                    manifest["requiredUpdaterVersion"] = "0.9.0"
                    raw = json.dumps(manifest).encode()
                    path.write_bytes(raw)
                    plan["candidate"]["id"] = hashlib.sha256(raw).hexdigest()
                    plan["candidate"]["bytes"] = sum(
                        p.stat().st_size
                        for p in (stage / "release").rglob("*")
                        if p.is_file()
                    )
                    (stage / "plan.json").write_text(json.dumps(plan))
                site.apply(plan, error="PLAN" if changed == "preview" else "HASH")
                self.assertEqual(site.active(), site.initial["active"])

    def test_insufficient_php_memory_refuses_before_touching_site(self):
        with Site() as site:
            process = subprocess.run(
                [
                    PHP,
                    "-d",
                    "memory_limit=64M",
                    str(CLI),
                    "doctor",
                    str(site.config_path),
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(process.returncode, 2)
            self.assertIn("memory_limit", process.stderr)
            self.assertEqual(site.active(), site.initial["active"])

    def test_storage_and_free_space_limits(self):
        for key in ["maxStorageBytes", "reserveBytes"]:
            with self.subTest(key=key), Site() as site:
                site.config[key] = 1 if key == "maxStorageBytes" else 10**18
                site.save_config()
                path = site.root / "next.zip"
                path.write_bytes(package("0.6.1"))
                site.call("prepare", path, error="SPACE")
                self.assertEqual(site.active(), site.initial["active"])

    def test_symlinks_hardlinks_foreign_files_and_directories(self):
        for kind in ["symlink", "hardlink", "file", "empty-directory"]:
            with self.subTest(kind=kind), Site() as site:
                if kind == "symlink":
                    (site.target / "assets/alias.js").symlink_to(
                        site.target / "assets/app.js"
                    )
                elif kind == "hardlink":
                    os.link(
                        site.target / "assets/app.js", site.target / "assets/alias.js"
                    )
                elif kind == "file":
                    (site.target / ".htaccess").write_text("foreign")
                else:
                    (site.target / "storage").mkdir()
                path = site.root / "next.zip"
                path.write_bytes(package("0.6.1"))
                site.call("prepare", path, error="Updater rejected")
                self.assertEqual(
                    json.loads((site.private / "state.json").read_text())["active"],
                    site.initial["active"],
                )

    def test_private_root_and_target_boundaries(self):
        with Site() as site:
            for value in [
                str(site.public / "private"),
                str(site.root),
                str(site.target),
            ]:
                site.config["privateRoot"] = value
                site.save_config()
                site.call("doctor", error="CONFIG")
            site.config["privateRoot"] = str(site.private)
            alias = site.public / "alias"
            alias.symlink_to(site.target, target_is_directory=True)
            site.config["target"] = str(alias)
            site.save_config()
            site.call("doctor", error="symlink")

    def test_read_only_public_parent_refuses_before_changes(self):
        with Site() as site:
            site.public.chmod(0o555)
            try:
                site.call("doctor", error="writable")
            finally:
                site.public.chmod(0o755)
            self.assertEqual(site.active(), site.initial["active"])

    def test_parallel_prepare_has_one_lock_and_discard_cleans_orphan(self):
        with Site() as site:
            archive = site.root / "next.zip"
            archive.write_bytes(package("0.6.1"))
            process = site.fault("prepare", "prepared", "hold", archive)
            try:
                with selectors.DefaultSelector() as selector:
                    selector.register(process.stdout, selectors.EVENT_READ)
                    self.assertTrue(selector.select(timeout=10))
                    self.assertEqual(
                        json.loads(process.stdout.readline())["checkpoint"], "prepared"
                    )
                site.call("prepare", archive, error="LOCK")
            finally:
                process.kill()
                process.communicate(timeout=5)
            plans = site.call("status")["plans"]
            self.assertEqual(len(plans), 1)
            site.call("discard", plans[0])
            self.assertEqual(site.call("status")["plans"], [])
            self.assertEqual(site.active(), site.initial["active"])

    def test_exceptions_recover_before_commit_and_preserve_committed_release(self):
        before_commit = ["intent-written", "old-moved", "new-moved", "health-checked"]
        for point in before_commit + ["state-written", "finished"]:
            with self.subTest(point=point), Site() as site:
                plan = site.prepare()
                process = site.fault(
                    "apply", point, "throw", plan["id"], plan["packageHash"]
                )
                stdout, stderr = process.communicate(timeout=15)
                self.assertEqual(process.returncode, 2, stdout + stderr)
                self.assertEqual(
                    site.active()["version"],
                    "0.6.0" if point in before_commit else "0.6.1",
                )
                self.assertFalse((site.private / "transaction.json").exists())

    def test_actual_sigkill_at_every_install_checkpoint_and_repeat(self):
        before_commit = [
            "release-published",
            "switch-prepared",
            "intent-written",
            "old-moved",
            "new-moved",
            "health-checked",
        ]
        for point in before_commit + ["state-written", "receipt-written", "finished"]:
            with self.subTest(point=point), Site() as site:
                plan = site.prepare()
                site.kill_at("apply", point, plan["id"], plan["packageHash"])
                state = site.call("recover")
                self.assertEqual(
                    state["active"]["version"],
                    "0.6.0" if point in before_commit else "0.6.1",
                )
                self.assertEqual(site.call("recover"), state)
                self.assertEqual(
                    site.apply(plan)["state"]["active"]["version"], "0.6.1"
                )
                self.assertTrue(
                    (site.private / "releases" / site.initial["active"]["id"]).is_dir()
                )
                self.assertFalse((site.private / "transaction.json").exists())

    def test_actual_sigkill_during_rollback(self):
        before_commit = [
            "switch-prepared",
            "intent-written",
            "old-moved",
            "new-moved",
            "health-checked",
        ]
        for point in before_commit + ["state-written", "receipt-written", "finished"]:
            with self.subTest(point=point), Site() as site:
                plan = site.prepare()
                state = site.apply(plan)["state"]
                args = [state["active"]["id"], state["previous"]["id"]]
                site.kill_at("rollback", point, *args)
                recovered = site.call("recover")
                self.assertEqual(
                    recovered["active"]["version"],
                    "0.6.1" if point in before_commit else "0.6.0",
                )
                self.assertEqual(
                    site.call("rollback", *args)["state"]["active"]["version"], "0.6.0"
                )

    def test_recovery_itself_can_be_killed_and_retried(self):
        for point in ["recovery-restored", "recovery-state-written", "receipt-written"]:
            with self.subTest(point=point), Site() as site:
                plan = site.prepare()
                site.kill_at("apply", "new-moved", plan["id"], plan["packageHash"])
                site.kill_at("recover", point)
                self.assertEqual(site.call("recover")["active"], site.initial["active"])
                self.assertEqual(site.call("recover")["active"], site.initial["active"])

    def test_failed_health_check_rolls_back_and_corrupt_backup_is_not_activated(self):
        with Site() as site:
            plan = site.prepare()
            process = site.fault(
                "apply", "new-moved", "corrupt", plan["id"], plan["packageHash"]
            )
            stdout, stderr = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 2, stdout + stderr)
            self.assertIn("HASH", stderr)
            self.assertEqual(site.active(), site.initial["active"])
            state = site.apply(plan)["state"]
            backup = (
                site.private / "releases" / state["previous"]["id"] / "assets/app.js"
            )
            backup.write_bytes(b"broken")
            site.call(
                "rollback", state["active"]["id"], state["previous"]["id"], error="HASH"
            )
            self.assertEqual(site.active(), state["active"])

    def test_pruning_retains_active_previous_and_pending_plans(self):
        with Site() as site:
            site.apply(site.prepare("0.6.1"))
            site.apply(site.prepare("0.6.2"))
            plan = site.prepare("0.6.3")
            removed = site.call("prune")["removed"]
            self.assertEqual(removed, [site.initial["active"]["id"]])
            site.apply(plan)
            self.assertEqual(site.active()["version"], "0.6.3")

    def test_http_new_index_and_rollback_revalidate_cached_html(self):
        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self, *_):
                pass

        with Site() as site:
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0), partial(Quiet, directory=str(site.public))
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}/PixelForge/"
            try:
                old_date = formatdate(
                    (site.target / "index.html").stat().st_mtime, usegmt=True
                )
                state = site.apply(site.prepare())["state"]
                request = urllib.request.Request(
                    base, headers={"If-Modified-Since": old_date}
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    new_date = response.headers["Last-Modified"]
                with urllib.request.urlopen(
                    base + "assets/app.js", timeout=5
                ) as response:
                    self.assertIn(b"0.6.1", response.read())
                site.call("rollback", state["active"]["id"], state["previous"]["id"])
                request = urllib.request.Request(
                    base, headers={"If-Modified-Since": new_date}
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                with urllib.request.urlopen(
                    base + "assets/app.js", timeout=5
                ) as response:
                    self.assertIn(b"0.6.0", response.read())
                self.assertFalse((site.public / "staging").exists())
                self.assertFalse((site.public / "logs").exists())
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_cli_rejects_http_requests(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        process = subprocess.Popen(
            [PHP, "-S", f"127.0.0.1:{port}", "-t", str(ROOT / "admin-updater")],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            for _ in range(50):
                try:
                    urllib.request.urlopen(
                        f"http://127.0.0.1:{port}/cli.php?command=apply", timeout=1
                    )
                except urllib.error.HTTPError as error:
                    self.assertEqual(error.code, 403)
                    self.assertEqual(error.read(), b"")
                    break
                except urllib.error.URLError:
                    time.sleep(0.02)
                else:
                    self.fail("HTTP updater endpoint must not be available")
            else:
                self.fail("PHP server did not start")
        finally:
            process.terminate()
            process.wait(timeout=5)


class PhpPackageContract(unittest.TestCase):
    def test_all_hostile_archive_fixtures_from_u0_are_also_rejected_by_php(self):
        count = 0
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.zip"

            def reject(raw, code=None, **kwargs):
                nonlocal count
                path.write_bytes(raw)
                process = subprocess.run(
                    [PHP, str(DRIVER), "validate", str(path), json.dumps(kwargs)],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertEqual(
                    process.returncode,
                    2,
                    f"accepted hostile fixture {count}: {process.stdout} {process.stderr}",
                )
                count += 1

            names = [
                "test_bombs_and_all_configurable_limits",
                "test_central_local_disagreement_and_unsupported_features",
                "test_corrupt_truncated_crc_and_deflate",
                "test_duplicate_case_aliases_and_json_keys",
                "test_file_metadata_and_hash",
                "test_hidden_deflate_output_cannot_bypass_size_and_crc_limits",
                "test_manifest_contract_and_versions",
                "test_missing_manifest_index_and_inventory_mismatch",
                "test_symlinks_devices_directories_and_executables",
                "test_traversal_alternate_absolute_reserved_and_server_paths",
            ]
            for name in names:
                with self.subTest(source=name):
                    original = package_fixtures.Packages(name)
                    original.reject = reject
                    getattr(original, name)()
            self.assertGreater(count, 50)
            print(f"\nPHP rejected {count} hostile U0 fixtures", flush=True)

    def test_production_archives_and_stored_deflate_members(self):
        for archive in ["pixelforge-0.6.0-full.zip", "pixelforge-0.6.1-full.zip"]:
            process = subprocess.run(
                [PHP, str(CLI), "validate", str(ROOT / "downloads" / archive)],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertTrue(json.loads(process.stdout)["valid"])


if __name__ == "__main__":
    unittest.main()
