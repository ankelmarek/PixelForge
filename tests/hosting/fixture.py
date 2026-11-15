"""Real Apache/mod_php/TLS. .htaccess is enforced by the server, not a test router."""

import io
import os
from pathlib import Path
import pwd
import re
import runpy
import secrets
import ssl
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "tests/updater"), str(ROOT / "tools")]
from panel_fixture import PanelServer, certificate, free_port  # noqa: E402
from test_updater import PHP, package  # noqa: E402


class HostingServer(PanelServer):
    def __init__(
        self, certs, *, override=True, settings=True, bundle=None, trust_self=True
    ):
        self.temp = tempfile.TemporaryDirectory(prefix="pixelforge-hosting-")
        self.root = Path(self.temp.name)
        self.ca, key, cert = certs
        self.public = self.root / "public_html"
        self.public.mkdir()
        # A real hosting account can already serve another homepage.
        (self.public / "index.html").write_text("Existing website")
        (self.public / ".htaccess").write_text(
            "DirectoryIndex index.html index.php\nOptions -Indexes\n"
        )
        if bundle is None:
            _, bundle = runpy.run_path(str(ROOT / "tools/package-hosting.py"))[
                "build"
            ]()
        with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
            archive.extractall(self.public)
        self.key = secrets.token_hex(32)
        self.username = "administrator-1"
        self.password = secrets.token_urlsafe(24)
        self.cookies, self.csrf = {}, ""
        self.port = free_port()
        self.origin = f"https://localhost:{self.port}"
        self.url = self.origin + "/pixelforge-admin/index.php"
        self.site = SimpleNamespace(
            public=self.public,
            private=self.public / "_pixelforge/data",
            config_path=self.public / "_pixelforge/data/updater.json",
        )
        self.panel_config = self.site.private / "panel/config.json"
        self.settings_path = self.public / "_pixelforge/install-settings.php"
        if settings:
            self.write_settings()
        apache = os.environ.get("PIXELFORGE_APACHE", "/usr/sbin/apache2")
        modules = Path(
            os.environ.get("PIXELFORGE_APACHE_MODULES", "/usr/lib/apache2/modules")
        )
        php_module = next(modules.glob("libphp*.so"), None)
        if php_module is None or not Path(apache).is_file():
            raise RuntimeError(
                "Apache and libapache2-mod-php required; configure PIXELFORGE_APACHE and PIXELFORGE_APACHE_MODULES"
            )
        extensions = subprocess.check_output(
            [PHP, "-r", 'echo ini_get("extension_dir");'], text=True
        )
        zip_module = os.environ.get("PIXELFORGE_PHP_ZIP", extensions + "/zip.so")
        trusted_ca = (
            self.ca if trust_self else Path("/etc/ssl/certs/ca-certificates.crt")
        )
        (self.root / "php.ini").write_text(
            f"extension={zip_module}\nmemory_limit=256M\nupload_max_filesize=16M\npost_max_size=17M\n"
            f"openssl.cafile={trusted_ca}\ndisplay_errors=Off\nlog_errors=On\nallow_url_fopen=On\n"
        )
        module_names = [
            "mpm_prefork",
            "authz_core",
            "authz_host",
            "dir",
            "mime",
            "ssl",
            "socache_shmcb",
        ]
        config = "\n".join(
            f'LoadModule {name}_module "{modules}/mod_{name}.so"'
            for name in module_names
        )
        config += f"""
LoadModule php_module "{php_module}"
ServerRoot "{self.root}"
PidFile "{self.root}/httpd.pid"
DefaultRuntimeDir "{self.root}"
Listen 127.0.0.1:{self.port}
ServerName localhost
User {pwd.getpwuid(os.getuid()).pw_name}
Group #{os.getgid()}
StartServers 3
MinSpareServers 2
MaxSpareServers 4
MaxRequestWorkers 8
ErrorLog "{self.root}/error.log"
LogLevel warn
PHPIniDir "{self.root}"
TypesConfig /etc/mime.types
AddType application/javascript .js
AddType text/css .css
DirectoryIndex index.php index.html
DocumentRoot "{self.public}"
<Directory "{self.public}">
    AllowOverride {"All" if override else "None"}
    Require all granted
</Directory>
<FilesMatch "\\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
SSLEngine on
SSLCertificateFile "{cert}"
SSLCertificateKeyFile "{key}"
SSLProtocol -all +TLSv1.2 +TLSv1.3
SSLSessionCache none
"""
        (self.root / "httpd.conf").write_text(config)
        self.log = open(self.root / "process.log", "wb")
        self.process = subprocess.Popen(
            [apache, "-f", str(self.root / "httpd.conf"), "-DFOREGROUND"],
            stdout=self.log,
            stderr=self.log,
            start_new_session=True,
            env={
                **os.environ,
                "PHP_INI_SCAN_DIR": "",
                "LD_LIBRARY_PATH": os.environ.get(
                    "PIXELFORGE_APACHE_LIBRARY_PATH",
                    os.environ.get("LD_LIBRARY_PATH", ""),
                ),
            },
        )
        self.server = SimpleNamespace(server_port=self.port)
        self.context = ssl.create_default_context(cafile=str(self.ca))
        try:
            for _ in range(100):
                if self.process.poll() is not None:
                    raise AssertionError(
                        (self.root / "process.log").read_text()
                        + (self.root / "error.log").read_text()
                        if (self.root / "error.log").exists()
                        else (self.root / "process.log").read_text()
                    )
                try:
                    if self.request(path="/PixelForge/index.html")[0] == 200:
                        break
                except OSError:
                    pass
                time.sleep(0.05)
            else:
                raise AssertionError("Apache start timeout")
        except BaseException:
            self.close()
            raise

    def write_settings(self, *, origin=None):
        self.settings_path = self.public / "_pixelforge/install-settings.php"
        self.settings_path.write_text(
            "<?php\nreturn ['origin' => "
            + repr(origin or self.origin)
            + ", 'setupKey' => "
            + repr(self.key)
            + "];\n"
        )

    def setup_form(self):
        response = self.request(path="/setup.php")
        assert response[0] == 200, response
        return re.search(r'name="csrf" value="([^"]+)"', response[2])[1]

    def setup(self, *, fields=None, headers=None):
        values = {
            "csrf": self.setup_form(),
            "setupKey": self.key,
            "username": self.username,
            "password": self.password,
            "passwordAgain": self.password,
        }
        values.update(fields or {})
        return self.request(
            "POST",
            "/setup.php",
            urllib.parse.urlencode(values),
            {"Content-Type": "application/x-www-form-urlencoded", **(headers or {})},
        )

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=10)
        self.log.close()
        self.temp.cleanup()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
