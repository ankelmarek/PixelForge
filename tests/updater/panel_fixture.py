"""Local TLS -> PHP fixture. Test certificates are trusted explicitly, never ignored."""

from contextlib import contextmanager
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import socket
import ssl
import subprocess
import tempfile
import threading
import time
import urllib.parse

import test_updater as core

ROOT, PHP = core.ROOT, core.PHP


def certificate(directory):
    ca_key, ca, key, cert = [directory / name for name in ("ca.key", "ca.crt", "tls.key", "tls.crt")]
    commands = [
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
         "-subj", "/CN=PixelForge local tests", "-keyout", str(ca_key), "-out", str(ca)],
        ["openssl", "req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost",
         "-keyout", str(key), "-out", str(directory / "tls.csr")],
    ]
    extension = directory / "tls.ext"
    extension.write_text("subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n")
    commands.append(["openssl", "x509", "-req", "-in", str(directory / "tls.csr"),
                     "-CA", str(ca), "-CAkey", str(ca_key), "-CAcreateserial", "-days", "2",
                     "-extfile", str(extension), "-out", str(cert)])
    for command in commands:
        subprocess.run(command, check=True, capture_output=True, timeout=30)
    return ca, key, cert


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class PanelServer:
    def __init__(self, site, certs, *, production=False, tool_root=None):
        self.site = site
        self.password = secrets.token_urlsafe(24)
        self.username = "administrator"
        self.cookies = {}
        self.csrf = ""
        self.php_port = free_port()
        self.tls_key = secrets.token_hex(24)
        self.ca, key, cert = certs
        fixture = self

        class Proxy(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def forward(self):
                length = int(self.headers.get("Content-Length", "0"))
                if length > 70 * 1024 * 1024:
                    self.send_error(413)
                    return
                data = self.rfile.read(length) if length else None
                headers = {k: v for k, v in self.headers.items()
                           if k.lower() not in ("connection", "transfer-encoding", "x-pf-test-tls")}
                headers["X-PF-Test-TLS"] = fixture.tls_key
                connection = http.client.HTTPConnection("127.0.0.1", fixture.php_port, timeout=30)
                try:
                    connection.request(self.command, self.path, data, headers)
                    response = connection.getresponse()
                    body = response.read()
                    self.send_response(response.status)
                    for name, value in response.getheaders():
                        if name.lower() not in ("connection", "transfer-encoding", "content-length"):
                            self.send_header(name, value)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                finally:
                    connection.close()

            do_GET = do_POST = do_OPTIONS = forward

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
        self.origin = f"https://localhost:{self.server.server_port}"
        self.url = self.origin + "/pixelforge-admin/index.php"
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(cert, key)
        self.server.socket = tls.wrap_socket(self.server.socket, server_side=True)
        site.config_path.chmod(0o600)
        if production:
            # Real production archive, same fixture builder as U1 browser checks.
            import importlib.util
            spec = importlib.util.spec_from_file_location("browser_fixture", ROOT / "tests/updater/browser-fixture.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            import shutil
            shutil.rmtree(site.public)
            shutil.rmtree(site.private)
            module.prepare(site.root)
            site.config = json.loads(site.config_path.read_text())
            site.config_path.chmod(0o600)
            site.initial = site.call("init")
        self.panel_config = site.private / "panel/config.json"
        result = subprocess.run(
            [PHP, str((tool_root or ROOT / "admin-updater") / "panel-setup.php"), str(site.config_path), self.origin, self.username],
            input=self.password, capture_output=True, text=True, timeout=30,
        )
        assert result.returncode == 0, result.stderr
        self.setup = json.loads(result.stdout)
        # Only this private fixture router recognizes its per-process TLS marker.
        router = site.root / "router.php"
        router.write_text("<?php\nif (($_SERVER['HTTP_X_PF_TEST_TLS'] ?? '') === "
                          + repr(self.tls_key) + ") { $_SERVER['HTTPS'] = 'on'; }\n"
                          + "$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);\n"
                          + "if ($path === '/pixelforge-admin/' || $path === '/pixelforge-admin/index.php') { require "
                          + repr(str(site.public / "pixelforge-admin/index.php")) + "; return true; }\nreturn false;\n")
        self.log = open(site.root / "php.log", "wb")
        self.process = subprocess.Popen(
            [PHP, "-d", "memory_limit=256M", "-d", "upload_max_filesize=2M", "-d", "post_max_size=3M",
             "-d", "display_errors=0", "-S", f"127.0.0.1:{self.php_port}", "-t", str(site.public), str(router)],
            stdout=self.log, stderr=self.log,
        )
        for _ in range(100):
            if self.process.poll() is not None:
                raise AssertionError((site.root / "php.log").read_text())
            try:
                with socket.create_connection(("127.0.0.1", self.php_port), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.05)
        else:
            raise AssertionError("PHP start timeout")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.context = ssl.create_default_context(cafile=str(self.ca))

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.process.terminate()
        self.process.wait(timeout=10)
        self.log.close()

    def request(self, method="GET", path="/pixelforge-admin/index.php", body=None, headers=None, *, plain=False):
        headers = dict(headers or {})
        if self.cookies:
            headers.setdefault("Cookie", "; ".join(f"{k}={v}" for k, v in self.cookies.items()))
        if method == "POST":
            headers.setdefault("Origin", self.origin)
        if plain:
            connection = http.client.HTTPConnection("127.0.0.1", self.php_port, timeout=30)
            headers.setdefault("Host", self.origin[8:])
        else:
            connection = http.client.HTTPSConnection("localhost", self.server.server_port, context=self.context, timeout=30)
        try:
            connection.request(method, path, body, headers)
            response = connection.getresponse()
            data = response.read()
            response_headers = response.getheaders()
            for name, value in response_headers:
                if name.lower() == "set-cookie":
                    cookie = SimpleCookie(value)
                    for key, morsel in cookie.items():
                        if morsel.value:
                            self.cookies[key] = morsel.value
                        else:
                            self.cookies.pop(key, None)
            text = data.decode("utf-8", errors="replace")
            match = re.search(r'name="csrf" value="([0-9a-f]{64})"', text)
            if match:
                self.csrf = match[1]
            return response.status, dict(response_headers), text
        finally:
            connection.close()

    def post(self, action, fields=None, *, csrf=None, headers=None):
        values = {"action": action, "csrf": self.csrf if csrf is None else csrf}
        values.update(fields or {})
        return self.request("POST", body=urllib.parse.urlencode(values).encode(),
                            headers={"Content-Type": "application/x-www-form-urlencoded", **(headers or {})})

    def login(self):
        assert self.request()[0] == 200
        result = self.post("login", {"username": self.username, "password": self.password})
        assert result[0] == 303, result
        result = self.request()
        assert result[0] == 200 and "Aktywne wydanie" in result[2], result
        return result

    def upload(self, raw, *, filename="release.zip", csrf=None):
        boundary = "pf-" + secrets.token_hex(16)
        chunks = []
        for name, value in {"action": "upload", "csrf": self.csrf if csrf is None else csrf}.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="package"; filename="{filename}"\r\nContent-Type: application/zip\r\n\r\n'.encode() + raw + b"\r\n")
        chunks.append(f"--{boundary}--\r\n".encode())
        return self.request("POST", body=b"".join(chunks), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})

    def plan(self, raw=None):
        response = self.upload(raw if raw is not None else core.package("0.6.1", extra=True))
        assert response[0] == 303, response
        identifier = urllib.parse.parse_qs(urllib.parse.urlparse(response[1]["Location"]).query)["plan"][0]
        plan = json.loads((self.site.private / "staging" / identifier / "plan.json").read_text())
        return plan


@contextmanager
def panel(certs):
    with core.Site() as site:
        server = PanelServer(site, certs)
        try:
            yield server
        finally:
            server.close()
