<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/PanelAuth.php';

/** One-time setup. Ownership is proven by uploading a locally generated secret. */
final class HostingSetup
{
    private static function page(string $body): void
    {
        echo '<!doctype html><html lang="pl"><head><meta charset="utf-8">' .
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' .
            '<title>Instalacja · PixelForge</title><link rel="stylesheet" href="/setup.php?asset=css">' .
            '<script defer src="/setup.php?asset=js"></script></head><body>' .
            '<header class="topbar"><a class="brand" href="/setup.php"><span class="mark" aria-hidden="true"></span>PixelForge' .
            '<span class="badge">Instalacja</span></a></header><main><section class="card narrow">' .
            $body .
            '</section></main><footer>PixelForge · instalator 1.2.0</footer></body></html>';
    }

    private static function input(string $name, int $max): string
    {
        $value = $_POST[$name] ?? '';
        ensure(
            is_string($value) && strlen($value) <= $max,
            'FORM: invalid field',
        );
        return $value;
    }

    private static function settings(string $public): array
    {
        $path = $public . '/_pixelforge/install-settings.php';
        regularFile($path);
        if (function_exists('opcache_invalidate')) {
            opcache_invalidate($path, true);
        }
        $value = require $path;
        ensure(
            is_array($value) &&
                count($value) === 2 &&
                is_string($value['origin'] ?? null) &&
                is_string($value['setupKey'] ?? null),
            'CONFIG: installation settings',
        );
        return $value;
    }

    private static function token(string $key): string
    {
        $value = time() . '.' . bin2hex(random_bytes(16));
        return $value . '.' . hash_hmac('sha256', $value, $key);
    }

    private static function checkToken(string $key): void
    {
        $value = self::input('csrf', 128);
        ensure(
            preg_match(
                '/\A([0-9]{10})\.([0-9a-f]{32})\.([0-9a-f]{64})\z/D',
                $value,
                $parts,
            ) === 1,
            'CSRF: refresh the form',
        );
        ensure(
            (int) $parts[1] <= time() &&
                time() - (int) $parts[1] < 1800 &&
                hash_equals(
                    hash_hmac('sha256', $parts[1] . '.' . $parts[2], $key),
                    $parts[3],
                ),
            'CSRF: refresh the form',
        );
    }

    private static function install(string $public, array $settings): void
    {
        // Validate all HTTP input before any filesystem mutation or HTTP self-probe.
        ensure(
            ($_SERVER['HTTP_ORIGIN'] ?? '') === $settings['origin'],
            'CSRF: origin mismatch',
        );
        self::checkToken($settings['setupKey']);
        ensure(
            hash_equals($settings['setupKey'], self::input('setupKey', 64)),
            'OWNERSHIP: invalid installation key',
        );
        $username = self::input('username', 64);
        ensure(
            preg_match('/\A[A-Za-z0-9_.-]{3,64}\z/D', $username) === 1,
            'USERNAME: use 3–64 letters, digits, dots, underscores or hyphens',
        );
        $password = self::input('password', 72);
        ensure(
            hash_equals($password, self::input('passwordAgain', 72)),
            'PASSWORD: passwords do not match',
        );
        $hash = PanelConfig::password($password);
        unset($password);
        $private = $public . '/_pixelforge';
        noLinks($private);
        $lockPath = $private . '/setup.lock';
        if (file_exists($lockPath) || is_link($lockPath)) {
            regularFile($lockPath);
        }
        $lock = @fopen($lockPath, 'c+b');
        ensure($lock !== false, 'LOCK: setup lock unavailable');
        try {
            ensure(
                flock($lock, LOCK_EX | LOCK_NB),
                'LOCK: setup already running',
            );
            chmod($lockPath, 0600);
            $panelPath = $private . '/data/panel/config.json';
            ensure(
                !file_exists($panelPath) && !is_link($panelPath),
                'INSTALLED: setup is closed',
            );
            $token = bin2hex(random_bytes(32)) . "\n";
            // Only nonsensitive canaries exist until HTTP denial is verified.
            foreach (
                [
                    $private . '/probe.txt',
                    $public . '/pixelforge-admin/probe.txt',
                ]
                as $path
            ) {
                if (file_exists($path) || is_link($path)) {
                    regularFile($path);
                    ensure(unlink($path), 'FILESYSTEM: cannot replace probe');
                }
                writeFile($path, $token, 0644);
            }
            $config = [
                'documentRoot' => $public,
                'target' => $public . '/PixelForge',
                'privateRoot' => $private . '/data',
                'maxStorageBytes' => 1073741824,
                'reserveBytes' => 33554432,
                'limits' => [],
                'publicStorage' => [
                    'mode' => 'apache-deny-v1',
                    'origin' => $settings['origin'],
                ],
            ];
            $updater = new Updater($config);
            $updater->doctor();
            $state = $updater->init();
            ensure(
                $state['active'] !== null,
                'INVENTORY: bundled game missing',
            );
            $configPath = $private . '/data/updater.json';
            atomicJson($configPath, $config);
            makeDirectory(dirname($panelPath));
            $pending = dirname($panelPath) . '/config.pending.json';
            atomicJson($pending, [
                'formatVersion' => 1,
                'updaterConfig' => $configPath,
                'origin' => $settings['origin'],
                'panelPath' => '/pixelforge-admin/',
                'username' => $username,
                'passwordHash' => $hash,
                'instanceKey' => bin2hex(random_bytes(32)),
            ]);
            new PanelConfig($pending);
            // Commit credentials last. Interrupted earlier work can be retried with
            // the same ownership key; an existing account can never be replaced.
            ensure(
                rename($pending, $panelPath),
                'FILESYSTEM: cannot finish setup',
            );
            syncDirectory(dirname($panelPath));
            @unlink($private . '/install-settings.php');
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public static function serve(string $public): void
    {
        umask(0077);
        ini_set('display_errors', '0');
        header('Cache-Control: no-store, private');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header(
            "Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
        );
        header('Content-Type: text/html; charset=utf-8');
        try {
            ensure(
                in_array($_SERVER['HTTPS'] ?? '', ['on', '1'], true),
                'HTTPS: use HTTPS',
            );
            ensure(
                in_array(
                    $_SERVER['REQUEST_METHOD'] ?? '',
                    ['GET', 'POST'],
                    true,
                ),
                'METHOD: GET or POST required',
            );
            if (isset($_GET['asset'])) {
                ensure(
                    $_SERVER['REQUEST_METHOD'] === 'GET' &&
                        in_array($_GET['asset'], ['css', 'js'], true),
                    'FORM: unknown asset',
                );
                $css = $_GET['asset'] === 'css';
                header(
                    'Content-Type: ' .
                        ($css ? 'text/css' : 'text/javascript') .
                        '; charset=utf-8',
                );
                echo readBounded(
                    dirname(__DIR__) .
                        '/web/' .
                        ($css ? 'panel.css' : 'setup.js'),
                    65536,
                );
                return;
            }
            noLinks($public);
            if (file_exists($public . '/_pixelforge/data/panel/config.json')) {
                http_response_code(410);
                self::page(
                    '<h1>Instalacja zakończona</h1><p>Instalator jest zamknięty. Konto administratora już istnieje.</p><a class="button" href="/pixelforge-admin/index.php">Otwórz panel</a>',
                );
                return;
            }
            $settings = self::settings($public);
            if ($settings['origin'] === '' && $settings['setupKey'] === '') {
                ensure(
                    $_SERVER['REQUEST_METHOD'] === 'GET',
                    'CONFIG: upload the installation settings first',
                );
                self::page(
                    '<p class="eyebrow">1 / Potwierdź dostęp do hostingu</p><h1>Wszystko w public_html</h1>' .
                        '<p>PixelForge i panel są już na serwerze. Pobierz konfigurację z losowym kluczem i wgraj ją przez menedżer plików hostingu jako <code>public_html/_pixelforge/install-settings.php</code>, zastępując pusty wzór.</p>' .
                        '<button type="button" id="download-settings">Pobierz konfigurację</button><p id="download-status" role="status"></p>' .
                        '<p>To potwierdza, że zarządzasz hostingiem. Następnie odśwież tę stronę.</p><a class="button secondary" href="/setup.php">Konfiguracja wgrana — dalej</a>' .
                        '<details><summary>Konfiguracja ręczna</summary><p>W pliku <code>_pixelforge/install-settings.php</code> wpisz adres HTTPS domeny bez końcowego ukośnika w <code>origin</code> i własny losowy klucz: 64 małe znaki szesnastkowe w <code>setupKey</code>. Zachowaj klucz do następnego kroku.</p></details>',
                );
                return;
            }
            PanelConfig::origin($settings['origin']);
            ensure(
                preg_match('/\A[0-9a-f]{64}\z/D', $settings['setupKey']) === 1,
                'CONFIG: setupKey must be 64 lowercase hexadecimal characters',
            );
            ensure(
                strtolower($_SERVER['HTTP_HOST'] ?? '') ===
                    substr($settings['origin'], 8),
                'ORIGIN: use the domain from install-settings.php',
            );
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                ensure(
                    (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) <= 8192 &&
                        $_FILES === [],
                    'FORM: request too large',
                );
                self::install($public, $settings);
                header('Location: /setup.php', true, 303);
                return;
            }
            self::page(
                '<p class="eyebrow">2 / Utwórz konto</p><h1>Administrator PixelForge</h1>' .
                    '<p>Sprawdzimy ochronę prywatnego katalogu i zarejestrujemy dołączoną grę. Instalator zamknie się po utworzeniu konta.</p>' .
                    '<form method="post" action="/setup.php"><input type="hidden" name="csrf" value="' .
                    self::token($settings['setupKey']) .
                    '">' .
                    '<label for="setupKey">Klucz instalacji z pliku konfiguracji</label><input id="setupKey" name="setupKey" type="password" pattern="[0-9a-f]{64}" maxlength="64" autocomplete="off" required>' .
                    '<label for="username">Login administratora</label><input id="username" name="username" pattern="[A-Za-z0-9_.\\-]{3,64}" maxlength="64" autocomplete="username" required>' .
                    '<label for="password">Hasło (16–72 bajty)</label><input id="password" name="password" type="password" minlength="16" maxlength="72" autocomplete="new-password" required>' .
                    '<label for="passwordAgain">Powtórz hasło</label><input id="passwordAgain" name="passwordAgain" type="password" minlength="16" maxlength="72" autocomplete="new-password" required>' .
                    '<button type="submit">Sprawdź i zainstaluj</button></form>',
            );
        } catch (\Throwable $error) {
            $code =
                $error instanceof UpdateError
                    ? explode(':', $error->getMessage(), 2)[0]
                    : 'SERVER';
            http_response_code(
                match ($code) {
                    'HTTPS' => 426,
                    'OWNERSHIP', 'CSRF' => 403,
                    'LOCK', 'INSTALLED' => 409,
                    default => 400,
                },
            );
            $message = match ($code) {
                'HTTPS' => 'Otwórz instalator przez HTTPS.',
                'OWNERSHIP'
                    => 'Klucz instalacji nie pasuje do wgranego pliku konfiguracji.',
                'CSRF'
                    => 'Formularz wygasł lub pochodzi z innego adresu. Odśwież instalator.',
                'ORIGIN'
                    => 'Użyj dokładnie adresu domeny wpisanego w pliku konfiguracji.',
                'PASSWORD'
                    => 'Hasła muszą być identyczne i mieć od 16 do 72 bajtów.',
                'USERNAME'
                    => 'Login: 3–64 litery bez polskich znaków, cyfry, kropki, podkreślenia lub myślniki.',
                'PROTECTION'
                    => 'Nie potwierdzono ochrony _pixelforge. Wgraj dołączony plik .htaccess razem z ukrytymi plikami. Hosting musi obsługiwać Apache 2.4 lub LiteSpeed, regułę Require all denied i połączenie PHP z własną domeną HTTPS. Nie utworzono konta.',
                'ENVIRONMENT'
                    => 'Hosting wymaga PHP 8.2+ (64 bit), ZipArchive, pamięci 256M, prawa zapisu i rename w public_html.',
                'INVENTORY',
                'HASH'
                    => 'Pliki gry są niekompletne albo zmienione. Wgraj komplet katalogu PixelForge z paczki.',
                'LOCK'
                    => 'Instalacja jest już w toku. Odczekaj i odśwież stronę.',
                'CONFIG'
                    => 'Sprawdź plik _pixelforge/install-settings.php: origin i setupKey. Nie zmieniaj struktury katalogów paczki.',
                default
                    => 'Instalacja nie została ukończona. Sprawdź kompletność paczki i prawa zapisu. Możesz ponowić próbę.',
            };
            error_log('PixelForge setup: ' . $code);
            self::page(
                '<h1>Instalacja zatrzymana</h1><p role="alert">' .
                    htmlspecialchars(
                        $message,
                        ENT_QUOTES | ENT_SUBSTITUTE,
                        'UTF-8',
                    ) .
                    '</p><a class="button" href="/setup.php">Wróć do instalatora</a>',
            );
        }
    }
}
