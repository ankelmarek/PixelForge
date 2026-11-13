"""Installation security and update lifecycle using the shipped public_html layout."""

import hashlib
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
import runpy
import selectors
import subprocess
import tempfile
import unittest
import urllib.parse
import zipfile

from fixture import HostingServer, ROOT, PHP, certificate, package


class HostingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="pixelforge-hosting-certs-")
        cls.certs = certificate(Path(cls.temp.name))
        cls.builder = staticmethod(
            runpy.run_path(str(ROOT / "tools/package-hosting.py"))["build"]
        )
        cls.name, cls.bundle = cls.builder()

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def server(self, **kwargs):
        return HostingServer(self.certs, bundle=self.bundle, **kwargs)

    def test_archive_is_reproducible_complete_separate_from_game(self):
        self.assertEqual((self.name, self.bundle), self.builder())
        with zipfile.ZipFile(io.BytesIO(self.bundle)) as archive:
            self.assertIsNone(archive.testzip())
            names = archive.namelist()
            self.assertEqual(len(names), len(set(names)))
            with zipfile.ZipFile(ROOT / "downloads/pixelforge-0.7.0-full.zip") as game:
                self.assertEqual(
                    {
                        name.removeprefix("PixelForge/"): archive.read(name)
                        for name in names
                        if name.startswith("PixelForge/")
                    },
                    {name: game.read(name) for name in game.namelist()},
                )
            self.assertNotIn("manifest.json", names)
            self.assertNotIn("index.php", names)
            self.assertNotIn("index.html", names)
            self.assertNotIn(".htaccess", names)
            self.assertNotIn("_pixelforge/data/panel/config.json", names)
            self.assertIn(
                "Require all denied", archive.read("_pixelforge/.htaccess").decode()
            )
            for line in (
                archive.read("_pixelforge/MANIFEST.sha256").decode().splitlines()
            ):
                digest, path = line.split("  ", 1)
                self.assertEqual(digest, hashlib.sha256(archive.read(path)).hexdigest())

    def test_unconfigured_requires_file_ownership_no_default_account(self):
        with self.server(settings=False) as server:
            self.assertIn("Pobierz konfigurację", server.request(path="/setup.php")[2])
            self.assertEqual(
                server.request("POST", "/setup.php", "username=intruder")[0], 400
            )
            self.assertFalse(server.site.private.exists())
            self.assertEqual(server.request()[0], 302)
            self.assertEqual(
                server.request(path="/_pixelforge/install-settings.php")[0], 403
            )

    def test_bad_key_csrf_origin_password_host_no_side_effects(self):
        with self.server() as server:
            for fields, headers, status in [
                ({"setupKey": "0" * 64}, {}, 403),
                ({"csrf": "bad"}, {}, 403),
                ({}, {"Origin": "https://attacker.invalid"}, 403),
                ({"passwordAgain": "mismatch"}, {}, 400),
                ({"password": "short", "passwordAgain": "short"}, {}, 400),
            ]:
                with self.subTest(fields=list(fields), headers=headers):
                    self.assertEqual(
                        server.setup(fields=fields, headers=headers)[0], status
                    )
                    self.assertFalse(server.site.private.exists())
            self.assertEqual(
                server.request(path="/setup.php", headers={"Host": "attacker.invalid"})[
                    0
                ],
                400,
            )

    def test_disabled_overrides_do_not_create_account_or_private_state(self):
        with self.server(override=False) as server:
            response = server.setup()
            self.assertEqual(response[0], 400, response)
            self.assertIn("Nie potwierdzono ochrony", response[2])
            self.assertEqual(server.request(path="/_pixelforge/probe.txt")[0], 200)
            self.assertFalse(server.site.private.exists())

    def test_missing_rules_stop_setup_and_can_retry_after_repair(self):
        with self.server() as server:
            guard = server.public / "_pixelforge/.htaccess"
            original = guard.read_bytes()
            guard.unlink()
            self.assertEqual(server.setup()[0], 400)
            self.assertFalse(server.panel_config.exists())
            guard.write_bytes(original)
            self.assertEqual(server.setup()[0], 303)
            self.assertEqual(server.request(path="/setup.php")[0], 410)

    def test_broken_game_retry_preserves_setup_and_seals_existing_account(self):
        with self.server() as server:
            game = server.public / "PixelForge/index.html"
            original = game.read_bytes()
            game.write_text("broken")
            self.assertEqual(server.setup()[0], 400)
            self.assertFalse(server.panel_config.exists())
            self.assertTrue(server.settings_path.exists())
            game.write_bytes(original)
            self.assertEqual(server.setup()[0], 303)
            first = server.panel_config.read_bytes()
            self.assertFalse(server.settings_path.exists())
            server.write_settings()
            self.assertEqual(
                server.request("POST", "/setup.php", "username=intruder")[0], 410
            )
            self.assertEqual(first, server.panel_config.read_bytes())

    def test_concurrent_setup_commits_exactly_one_account(self):
        with self.server() as server:
            token = server.setup_form()

            def submit(username):
                body = urllib.parse.urlencode(
                    {
                        "csrf": token,
                        "setupKey": server.key,
                        "username": username,
                        "password": server.password,
                        "passwordAgain": server.password,
                    }
                )
                return server.request(
                    "POST",
                    "/setup.php",
                    body,
                    {"Content-Type": "application/x-www-form-urlencoded"},
                )[0]

            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(submit, ["first-admin", "second-admin"]))
            self.assertEqual(statuses.count(303), 1, statuses)
            self.assertTrue(
                all(status in [303, 409, 410] for status in statuses), statuses
            )
            saved = json.loads(server.panel_config.read_text())
            self.assertEqual(
                saved["username"], ["first-admin", "second-admin"][statuses.index(303)]
            )

    def test_runtime_guard_closes_panel_when_protection_changes(self):
        with self.server() as server:
            self.assertEqual(server.setup()[0], 303)
            server.login()
            guard = server.public / "_pixelforge/.htaccess"
            original = guard.read_bytes()
            guard.write_text("Require all granted\n")
            response = server.request()
            self.assertEqual(response[0], 409, response)
            self.assertIn("PROTECTION", response[2])
            guard.write_bytes(original)
            self.assertEqual(server.request()[0], 200)

    def test_public_probe_binds_origin_to_this_installation(self):
        with self.server() as server:
            self.assertEqual(server.setup()[0], 303)
            probe = server.public / "pixelforge-admin/probe.txt"
            probe.write_text("0" * 64 + "\n")
            response = server.request()
            self.assertEqual(response[0], 409, response)
            self.assertIn("PROTECTION", response[2])

    def test_untrusted_tls_certificate_stops_before_private_state(self):
        with self.server(trust_self=False) as server:
            response = server.setup()
            self.assertEqual(response[0], 400, response)
            self.assertIn("Nie potwierdzono ochrony", response[2])
            self.assertFalse(server.site.private.exists())

    def test_sigkill_gap_recover_through_panel_with_private_backup(self):
        with self.server() as server:
            self.assertEqual(server.setup()[0], 303)
            server.login()
            plan = server.plan(package("0.7.1", extra=True))
            process = subprocess.Popen(
                [
                    PHP,
                    "-d",
                    f"openssl.cafile={server.ca}",
                    str(ROOT / "tests/updater/driver.php"),
                    "apply",
                    str(server.site.config_path),
                    "old-moved",
                    "hold",
                    plan["id"],
                    plan["packageHash"],
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            try:
                with selectors.DefaultSelector() as selector:
                    selector.register(process.stdout, selectors.EVENT_READ)
                    self.assertTrue(selector.select(timeout=10), "checkpoint timeout")
                    line = process.stdout.readline()
                    self.assertEqual(line.strip(), '{"checkpoint":"old-moved"}')
                process.kill()
                process.wait(timeout=5)
                self.assertEqual(server.request(path="/PixelForge/index.html")[0], 404)
                self.assertIn("Przerwana operacja", server.request()[2])
                self.assertTrue((server.site.private / "transaction.json").is_file())
                self.assertEqual(
                    server.request(path="/_pixelforge/data/transaction.json")[0], 403
                )
                self.assertEqual(server.post("recover")[0], 303)
                self.assertEqual(server.request(path="/PixelForge/index.html")[0], 200)
                self.assertEqual(
                    json.loads((server.site.private / "state.json").read_text())[
                        "active"
                    ]["version"],
                    "0.7.0",
                )
            finally:
                if process.poll() is None:
                    process.kill()
                process.communicate(timeout=5)

    def test_install_login_update_rollback_private_files_remain_denied(self):
        with self.server() as server:
            self.assertEqual(server.setup()[0], 303)
            self.assertEqual(
                server.request(path="/pixelforge.php")[1]["Location"],
                "./PixelForge/index.html",
            )
            self.assertEqual(server.request(path="/")[0], 200)
            self.assertEqual(server.request(path="/")[2], "Existing website")
            self.assertEqual(
                (server.public / ".htaccess").read_text(),
                "DirectoryIndex index.html index.php\nOptions -Indexes\n",
            )
            server.login()
            for path in [
                "",
                ".htaccess",
                "tool/src/PanelAuth.php",
                "data/updater.json",
                "data/panel/config.json",
                "data/panel/sessions/",
                "data/state.json",
            ]:
                self.assertEqual(
                    server.request(path="/_pixelforge/" + path)[0], 403, path
                )
            self.assertEqual(server.upload(self.bundle)[0], 409)
            plan = server.plan(package("0.7.1", extra=True))
            self.assertIn("0.7.0", server.request()[2])
            staged = f"/_pixelforge/data/staging/{plan['id']}/"
            self.assertEqual(server.request(path=staged + "plan.json")[0], 403)
            self.assertEqual(
                server.post("apply", {"plan": plan["id"], "hash": plan["packageHash"]})[
                    0
                ],
                303,
            )
            server.request()
            state = json.loads((server.site.private / "state.json").read_text())
            self.assertEqual(state["active"]["version"], "0.7.1")
            backup = f"/_pixelforge/data/releases/{state['previous']['id']}/index.html"
            self.assertEqual(server.request(path=backup)[0], 403)
            self.assertEqual(
                server.post(
                    "rollback",
                    {
                        "active": state["active"]["id"],
                        "previous": state["previous"]["id"],
                    },
                )[0],
                303,
            )
            server.request()
            self.assertEqual(
                json.loads((server.site.private / "state.json").read_text())["active"][
                    "version"
                ],
                "0.7.0",
            )
            self.assertEqual(server.request(path="/PixelForge/index.html")[0], 200)
            self.assertEqual(server.panel_config.stat().st_mode & 0o777, 0o600)
            self.assertEqual(server.site.private.stat().st_mode & 0o777, 0o700)
            self.assertEqual(server.post("logout")[0], 303)


if __name__ == "__main__":
    unittest.main()
