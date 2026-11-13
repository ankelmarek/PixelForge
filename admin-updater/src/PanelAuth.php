<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/PanelConfig.php';

final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

final class PanelAuth
{
    private string $cookie;
    private array $cookieOptions;

    public function __construct(private readonly PanelConfig $config)
    {
        $this->cookie = '__Secure-PixelForge-' . substr(hash('sha256', $config->data['panelPath']), 0, 12);
        $this->cookieOptions = [
            'lifetime' => 0,
            'path' => $config->data['panelPath'],
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ];
    }

    public function transport(): void
    {
        if (!in_array($_SERVER['HTTPS'] ?? '', ['on', '1'], true)) {
            throw new HttpError(426, 'Panel wymaga połączenia HTTPS.');
        }
        // Forwarded headers are deliberately not accepted as proof of TLS/host.
        if (strtolower($_SERVER['HTTP_HOST'] ?? '') !== substr($this->config->data['origin'], 8)) {
            throw new HttpError(400, 'Nieprawidłowy adres panelu.');
        }
        if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'POST'], true)) {
            header('Allow: GET, POST');
            throw new HttpError(405, 'Ta metoda nie jest obsługiwana.');
        }
    }

    public function start(): void
    {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', '28800');
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
        ini_set('session.serialize_handler', 'php_serialize');
        session_save_path($this->config->directory . '/sessions');
        session_name($this->cookie);
        session_set_cookie_params($this->cookieOptions);
        ensure(session_start(), 'SESSION: cannot start');
        if (!isset($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
    }

    public function csrf(): string
    {
        return $_SESSION['csrf'];
    }

    public function checkPost(): void
    {
        if (($_SERVER['HTTP_ORIGIN'] ?? '') !== $this->config->data['origin']
            || !is_string($_POST['csrf'] ?? null)
            || !hash_equals($this->csrf(), $_POST['csrf'])) {
            throw new HttpError(403, 'Formularz wygasł lub pochodzi z innej strony. Odśwież panel.');
        }
    }

    public function authenticated(): bool
    {
        if (!isset($_SESSION['authenticated'])) {
            return false;
        }
        $now = time();
        if (!hash_equals($this->config->fingerprint(), $_SESSION['authenticated'])
            || $now - ($_SESSION['started'] ?? 0) > 28800
            || $now - ($_SESSION['seen'] ?? 0) > 1800) {
            $_SESSION = ['csrf' => bin2hex(random_bytes(32))];
            session_regenerate_id(true);
            return false;
        }
        $_SESSION['seen'] = $now;
        return true;
    }

    /** Persistent, locked budget: five attempts/IP and twenty globally per 15 minutes. */
    private function attempts(bool $clear = false): void
    {
        $path = $this->config->directory . '/login.lock';
        $attemptsPath = $this->config->directory . '/login-attempts.json';
        if (file_exists($path) || is_link($path)) {
            regularFile($path);
        }
        $stream = @fopen($path, 'c+b');
        ensure($stream !== false, 'AUTH: cannot open rate limit');
        try {
            ensure(flock($stream, LOCK_EX), 'AUTH: rate limit lock');
            chmod($path, 0600);
            $raw = file_exists($attemptsPath) ? readBounded($attemptsPath, 16384) : '[]';
            jsonDocument($raw);
            $entries = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            ensure(is_array($entries) && count($entries) <= 20, 'AUTH: invalid rate limit');
            $now = time();
            $ip = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $this->config->data['instanceKey']);
            $entries = array_values(array_filter($entries, fn($entry) => $entry['time'] > $now - 900));
            $local = count(array_filter($entries, fn($entry) => $entry['ip'] === $ip));
            if ($clear) {
                $entries = array_values(array_filter($entries, fn($entry) => $entry['ip'] !== $ip));
            } else {
                if ($local >= 5 || count($entries) >= 20) {
                    header('Retry-After: 900');
                    throw new HttpError(429, 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.');
                }
                // Reserve before password_verify, including interrupted requests.
                $entries[] = ['time' => $now, 'ip' => $ip];
            }
            atomicJson($attemptsPath, $entries);
        } finally {
            flock($stream, LOCK_UN);
            fclose($stream);
        }
    }

    public function login(string $username, string $password): void
    {
        $this->attempts();
        $bounded = strlen($password) <= 72 && !str_contains($password, "\0");
        $valid = password_verify($bounded ? $password : '', $this->config->data['passwordHash']);
        if (!$bounded || !$valid || !hash_equals($this->config->data['username'], $username)) {
            throw new HttpError(401, 'Nieprawidłowy login lub hasło.');
        }
        $this->attempts(true);
        ensure(session_regenerate_id(true), 'SESSION: cannot rotate');
        $_SESSION = [
            'csrf' => bin2hex(random_bytes(32)),
            'authenticated' => $this->config->fingerprint(),
            'started' => time(),
            'seen' => time(),
        ];
    }

    public function logout(): void
    {
        $_SESSION = [];
        ensure(session_destroy(), 'SESSION: cannot destroy');
        $options = $this->cookieOptions;
        unset($options['lifetime']);
        setcookie($this->cookie, '', $options + ['expires' => time() - 3600]);
    }
}
