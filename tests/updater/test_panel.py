"""HTTP boundary tests against real PHP, uploaded ZIPs and verified local TLS."""

from http.cookies import SimpleCookie
import json
import hashlib
import zipfile
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import unittest

import panel_fixture as fixtures
import test_updater as core


class WebPanel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cert_dir = tempfile.TemporaryDirectory(prefix="pixelforge-tls-")
        cls.certs = fixtures.certificate(Path(cls.cert_dir.name))

    @classmethod
    def tearDownClass(cls):
        cls.cert_dir.cleanup()

    def test_https_host_methods_and_forwarded_spoof(self):
        with fixtures.panel(self.certs) as app:
            self.assertEqual(app.request(plain=True)[0], 426)
            self.assertEqual(app.request(plain=True, headers={"X-Forwarded-Proto": "https"})[0], 426)
            self.assertEqual(app.request(headers={"Host": "evil.example"})[0], 400)
            self.assertEqual(app.request("OPTIONS")[0], 405)
            self.assertEqual(app.request()[0], 200)

    def test_cookie_rotation_headers_logout_and_session_fixation(self):
        with fixtures.panel(self.certs) as app:
            app.cookies["__Secure-PixelForge-" + "fake"] = "attacker"
            status, headers, _ = app.request()
            self.assertEqual(status, 200)
            cookie = SimpleCookie(headers["Set-Cookie"])
            name = next(iter(cookie))
            self.assertTrue(cookie[name]["secure"])
            self.assertTrue(cookie[name]["httponly"])
            self.assertEqual(cookie[name]["samesite"], "Strict")
            self.assertEqual(cookie[name]["path"], "/pixelforge-admin/")
            self.assertEqual(cookie[name]["domain"], "")
            self.assertIn("no-store", headers["Cache-Control"])
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
            app.cookies[name] = "chosen-by-attacker-123456789"
            app.request()
            self.assertNotEqual(app.cookies[name], "chosen-by-attacker-123456789")
            before = app.cookies[name]
            token = app.csrf
            app.login()
            self.assertNotEqual(app.cookies[name], before)
            self.assertNotEqual(app.csrf, token)
            session_id = app.cookies[name]
            self.assertEqual(app.post("logout")[0], 303)
            app.cookies[name] = session_id
            self.assertIn('name="password"', app.request()[2])
            self.assertEqual(app.post("prune")[0], 401)

    def test_unauthenticated_upload_and_actions_do_not_touch_game(self):
        with fixtures.panel(self.certs) as app:
            original = (app.site.private / "state.json").read_bytes()
            for action in ("apply", "rollback", "init", "recover", "discard", "prune"):
                self.assertEqual(app.post(action)[0], 401)
            self.assertEqual(app.upload(core.package("0.6.1"))[0], 401)
            self.assertEqual((app.site.private / "state.json").read_bytes(), original)
            self.assertEqual(list((app.site.private / "staging").iterdir()), [])

    def test_csrf_and_origin_on_login_and_all_mutations(self):
        with fixtures.panel(self.certs) as app:
            app.request()
            credentials = {"username": app.username, "password": app.password}
            self.assertEqual(app.post("login", credentials, csrf="wrong")[0], 403)
            self.assertEqual(app.post("login", credentials, headers={"Origin": "https://evil.example"})[0], 403)
            app.login()
            original = (app.site.private / "state.json").read_bytes()
            for action in ("upload", "apply", "rollback", "init", "recover", "discard", "prune", "logout"):
                with self.subTest(action=action):
                    self.assertEqual(app.post(action, csrf="wrong")[0], 403)
                    self.assertEqual(app.post(action, headers={"Origin": "null"})[0], 403)
            self.assertEqual((app.site.private / "state.json").read_bytes(), original)
            self.assertIn("Aktywne wydanie", app.request()[2])

    def test_persistent_rate_limit_does_not_trust_forwarded_ip(self):
        with fixtures.panel(self.certs) as app:
            app.request()
            for attempt in range(5):
                status, _, text = app.post("login", {"username": "missing", "password": secrets.token_hex(16)})
                self.assertEqual(status, 401)
                self.assertIn("Nieprawidłowy login lub hasło", text)
            app.cookies = {}
            app.request()
            status, headers, _ = app.post("login", {"username": app.username, "password": app.password},
                                          headers={"X-Forwarded-For": "203.0.113.99"})
            self.assertEqual(status, 429)
            self.assertEqual(headers["Retry-After"], "900")
            path = app.site.private / "panel/login-attempts.json"
            self.assertEqual(len(json.loads(path.read_text())), 5)
            self.assertNotIn(app.password, path.read_text())
            path.write_text(json.dumps([{"time": int(time.time()), "ip": str(i)} for i in range(20)]))
            self.assertEqual(app.post("login", {"username": app.username, "password": app.password})[0], 429)
            path.write_text(json.dumps([{"time": int(time.time()) - 901, "ip": "old"}]))
            app.login()

    def test_upload_preview_apply_repeat_and_confirmed_rollback(self):
        with fixtures.panel(self.certs) as app:
            app.login()
            plan = app.plan()
            self.assertEqual(app.site.active()["version"], "0.6.0")
            status, _, text = app.request(path="/pixelforge-admin/index.php?plan=" + plan["id"])
            self.assertEqual(status, 200)
            for expected in ("assets/add.json", "assets/app.js", plan["packageHash"], "Zainstaluj wydanie 0.6.1"):
                self.assertIn(expected, text)
            self.assertEqual(app.post("apply", {"plan": plan["id"], "hash": "0" * 64})[0], 409)
            fields = {"plan": plan["id"], "hash": plan["packageHash"]}
            self.assertEqual(app.post("apply", fields)[0], 303)
            self.assertEqual(app.post("apply", fields)[0], 303)
            state = app.site.call("status")["state"]
            self.assertEqual(state["active"]["version"], "0.6.1")
            self.assertEqual(state["previous"]["version"], "0.6.0")
            self.assertIn("Wydanie zostało zainstalowane", app.request()[2])
            self.assertIn("Potwierdź przywrócenie", app.request(path="/pixelforge-admin/index.php?rollback=1")[2])
            self.assertEqual(app.site.active()["version"], "0.6.1")
            fields = {"active": state["active"]["id"], "previous": state["previous"]["id"]}
            self.assertEqual(app.post("rollback", fields)[0], 303)
            self.assertEqual(app.post("rollback", fields)[0], 303)
            self.assertEqual(app.site.active()["version"], "0.6.0")
            self.assertTrue((app.site.public / "pixelforge-admin/index.php").is_file())
            self.assertEqual(list((app.site.private / "panel/uploads").iterdir()), [])

    def test_invalid_upload_limits_cleanup_and_untrusted_filename(self):
        with fixtures.panel(self.certs) as app:
            app.login()
            for raw in (b"broken ZIP", b"", b"x" * (2 * 1024 * 1024 + 1)):
                with self.subTest(size=len(raw)):
                    self.assertIn(app.upload(raw)[0], (400, 409, 413))
                    self.assertEqual(app.site.active()["version"], "0.6.0")
                    self.assertEqual(list((app.site.private / "panel/uploads").iterdir()), [])
                    self.assertEqual(list((app.site.private / "staging").iterdir()), [])
            status, _, _ = app.upload(core.package("0.6.1"), filename="../../<script>alert(1)</script>.zip")
            self.assertEqual(status, 303)
            self.assertNotIn("<script>alert", app.request()[2])
            self.assertFalse((app.site.root / "<script>").exists())

    def test_get_cannot_apply_or_recover_interrupted_transaction(self):
        with fixtures.panel(self.certs) as app:
            app.login()
            plan = app.plan()
            self.assertEqual(app.request(path="/pixelforge-admin/index.php?action=apply&plan=" + plan["id"])[0], 200)
            self.assertEqual(app.site.active()["version"], "0.6.0")
            app.site.kill_at("apply", "old-moved", plan["id"], plan["packageHash"])
            self.assertFalse(app.site.target.exists())
            self.assertTrue((app.site.private / "transaction.json").exists())
            self.assertIn("Przerwana operacja", app.request()[2])
            self.assertFalse(app.site.target.exists())
            self.assertEqual(app.post("prune")[0], 409)
            self.assertEqual(app.post("recover")[0], 303)
            self.assertEqual(app.site.active()["version"], "0.6.0")

    def test_stale_plan_and_tampered_staging_are_rejected(self):
        with fixtures.panel(self.certs) as app:
            app.login()
            old = app.plan()
            newer = app.plan(core.package("0.6.2"))
            self.assertEqual(app.post("apply", {"plan": newer["id"], "hash": newer["packageHash"]})[0], 303)
            self.assertEqual(app.request(path="/pixelforge-admin/index.php?plan=" + old["id"])[0], 409)
            self.assertEqual(app.post("apply", {"plan": old["id"], "hash": old["packageHash"]})[0], 409)
            self.assertEqual(app.post("discard", {"plan": old["id"]})[0], 303)
            self.assertEqual(app.post("prune")[0], 303)
            latest = app.plan(core.package("0.6.3"))
            (app.site.private / "staging" / latest["id"] / "release/assets/app.js").write_text("tampered")
            self.assertEqual(app.request(path="/pixelforge-admin/index.php?plan=" + latest["id"])[0], 409)
            self.assertEqual(app.post("apply", {"plan": latest["id"], "hash": latest["packageHash"]})[0], 409)
            self.assertEqual(app.site.active()["version"], "0.6.2")

    def test_idle_absolute_expiry_and_password_reset_revoke_sessions(self):
        with fixtures.panel(self.certs) as app:
            for field, seconds in (("seen", 1801), ("started", 28801)):
                app.login()
                name = next(name for name in app.cookies if name.startswith("__Secure-PixelForge-"))
                path = app.site.private / "panel/sessions" / ("sess_" + app.cookies[name])
                subprocess.run([core.PHP, "-r",
                    '$p=$argv[1]; $d=unserialize(file_get_contents($p)); $d[$argv[2]]=time()-(int)$argv[3]; file_put_contents($p,serialize($d));',
                    str(path), field, str(seconds)], check=True, capture_output=True)
                self.assertIn('name="password"', app.request()[2])
            app.login()
            replacement = secrets.token_urlsafe(24)
            reset = subprocess.run([core.PHP, str(core.ROOT / "admin-updater/panel-password.php"), str(app.panel_config)],
                                   input=replacement, capture_output=True, text=True)
            self.assertEqual(reset.returncode, 0, reset.stderr)
            self.assertIn('name="password"', app.request()[2])
            self.assertEqual(app.post("login", {"username": app.username, "password": app.password})[0], 401)
            app.password = replacement
            app.login()

    def test_initialization_requires_post_and_preserves_public_files(self):
        with fixtures.panel(self.certs) as app:
            (app.site.private / "state.json").unlink()
            app.login()
            self.assertFalse((app.site.private / "state.json").exists())
            self.assertIn("Sprawdź i zarejestruj instalację", app.request()[2])
            self.assertEqual(app.post("init")[0], 303)
            self.assertEqual(app.site.active()["version"], "0.6.0")

    def test_private_files_paths_and_cli_are_not_exposed(self):
        with fixtures.panel(self.certs) as app:
            self.assertEqual(sorted(p.name for p in (app.site.public / "pixelforge-admin").iterdir()), ["index.php"])
            for path in ("/private/panel/config.json", "/admin-updater/cli.php", "/panel/config.json"):
                self.assertEqual(app.request(path=path)[0], 404)
            app.login()
            status, _, text = app.request(path="/pixelforge-admin/index.php?plan=../../config.json")
            self.assertEqual(status, 409)
            self.assertNotIn(str(app.site.root), text)
            self.assertNotIn(app.password, text)
            app.panel_config.chmod(0o644)
            status, _, text = app.request()
            self.assertEqual(status, 409)
            self.assertNotIn(str(app.site.root), text)
            app.panel_config.chmod(0o600)
            config = json.loads(app.panel_config.read_text())
            self.assertNotIn(app.password, json.dumps(config))
            self.assertTrue(config["passwordHash"].startswith("$2y$"))

    def test_same_package_and_orphan_upload_cleanup(self):
        with fixtures.panel(self.certs) as app:
            app.login()
            orphan = app.site.private / "panel/uploads" / ("a" * 32 + ".zip")
            orphan.write_bytes(b"interrupted")
            self.assertEqual(app.upload(core.package("0.6.0"))[0], 303)
            self.assertFalse(orphan.exists())
            self.assertIn("Ta sama wersja", app.request()[2])
            self.assertEqual(app.site.active()["version"], "0.6.0")
            self.assertEqual(list((app.site.private / "staging").iterdir()), [])

    def test_distribution_zip_is_complete_and_panel_runs_after_extraction(self):
        subprocess.run(["python3", str(core.ROOT / "tools/package-updater.py")],
                       check=True, capture_output=True, timeout=30)
        path = core.ROOT / "downloads/pixelforge-updater-u2-1.1.0.zip"
        before = path.read_bytes()
        subprocess.run(["python3", str(core.ROOT / "tools/package-updater.py")],
                       check=True, capture_output=True, timeout=30)
        self.assertEqual(path.read_bytes(), before)
        with core.Site() as site:
            extracted = site.root / "tools"
            with zipfile.ZipFile(path) as archive:
                self.assertIsNone(archive.testzip())
                archive.extractall(extracted)
            tool_root = extracted / "admin-updater"
            for line in (tool_root / "MANIFEST.sha256").read_text().splitlines():
                digest, name = line.split("  ", 1)
                self.assertEqual(hashlib.sha256((tool_root / name).read_bytes()).hexdigest(), digest)
            server = fixtures.PanelServer(site, self.certs, tool_root=tool_root)
            try:
                server.login()
                for extension, expected in (("css", "text/css"), ("js", "text/javascript")):
                    response = server.request(path="/pixelforge-admin/index.php?asset=" + extension)
                    self.assertEqual(response[0], 200, response[2])
                    self.assertIn(expected, response[1]["Content-Type"])
                plan = server.plan()
                self.assertEqual(server.post("apply", {"plan": plan["id"], "hash": plan["packageHash"]})[0], 303)
                state = site.call("status")["state"]
                self.assertEqual(state["active"]["version"], "0.6.1")
                self.assertEqual(server.post("rollback", {"active": state["active"]["id"], "previous": state["previous"]["id"]})[0], 303)
                self.assertEqual(site.active()["version"], "0.6.0")
                self.assertIn(str(tool_root), (site.public / "pixelforge-admin/index.php").read_text())
            finally:
                server.close()
