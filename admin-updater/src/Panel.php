<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/PanelAuth.php';
require_once __DIR__ . '/PanelView.php';

final class Panel
{
    private PanelAuth $auth;
    private Updater $updater;

    private function __construct(private readonly PanelConfig $config)
    {
        $this->auth = new PanelAuth($config);
        $this->updater = new Updater($config->updater);
    }

    public static function serve(string $configPath): void
    {
        umask(0077);
        ini_set('display_errors', '0');
        header('Cache-Control: no-store, private');
        header('Pragma: no-cache');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header("Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'");
        header('Content-Type: text/html; charset=utf-8');
        try {
            (new self(new PanelConfig($configPath)))->request();
        } catch (\Throwable $error) {
            $code = $error instanceof UpdateError ? explode(':', $error->getMessage(), 2)[0] : 'SERVER';
            if (!preg_match('/\A[A-Z_]{1,24}\z/D', $code)) {
                $code = 'SERVER';
            }
            if ($error instanceof HttpError) {
                http_response_code($error->status);
                $message = $error->getMessage();
            } else {
                http_response_code($error instanceof UpdateError ? 409 : 500);
                $message = match ($code) {
                    'LOCK' => 'Inna operacja trwa. Poczekaj i odśwież panel.',
                    'SPACE' => 'Za mało miejsca. Odrzuć zbędne plany lub usuń nieużywane wydania.',
                    'PLAN' => 'Plan jest nieaktualny lub niekompletny. Sprawdź paczkę ponownie.',
                    'VERSION' => 'Wersja paczki jest niezgodna. Starszą wersję przywraca się przez rollback.',
                    'HASH', 'ZIP', 'PATH', 'MANIFEST', 'FORMAT', 'CRC', 'LIMIT', 'JSON', 'PROJECT' =>
                        'Paczka lub pliki nie przeszły kontroli. Instalacja została zatrzymana.',
                    'INVENTORY' => 'Katalog gry zawiera obce lub zmienione pliki. Wymaga sprawdzenia przez administratora.',
                    default => 'Operacja nie została ukończona. Sprawdź stan panelu; w razie potrzeby użyj diagnostyki CLI.',
                };
                error_log('PixelForge panel: ' . $code);
                $message .= ' Kod: ' . $code . '.';
            }
            PanelView::error($message);
        } finally {
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }
        }
    }

    private function input(string $key, int $max = 128): string
    {
        $value = $_POST[$key] ?? '';
        if (!is_string($value) || strlen($value) > $max) {
            throw new HttpError(400, 'Nieprawidłowe dane formularza.');
        }
        return $value;
    }

    private function redirect(string $query = ''): void
    {
        header('Location: ' . $this->config->data['panelPath'] . 'index.php' . $query, true, 303);
    }

    private static function iniBytes(string $name): int
    {
        $value = trim((string) ini_get($name));
        ensure(preg_match('/\A([0-9]+)([KMG]?)\z/i', $value, $parts) === 1, 'ENVIRONMENT: upload limit');
        $bytes = (int) $parts[1] * 1024 ** array_search(strtoupper($parts[2]), ['', 'K', 'M', 'G'], true);
        return $bytes === 0 ? PHP_INT_MAX : $bytes;
    }

    private function uploadLimit(): int
    {
        return max(0, min(
            Package::limits($this->config->updater['limits'])['maxArchiveBytes'],
            self::iniBytes('upload_max_filesize'),
            self::iniBytes('post_max_size') - 65536,
        ));
    }

    private function upload(): array
    {
        $file = $_FILES['package'] ?? null;
        if (count($_FILES) !== 1 || !is_array($file) || !is_int($file['error'] ?? null)) {
            throw new HttpError(400, 'Wybierz jeden plik ZIP.');
        }
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new HttpError(413, 'Plik przekracza limit przesyłania tego serwera.');
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null)
            || !is_uploaded_file($file['tmp_name'])) {
            throw new HttpError(400, 'Przesyłanie nie zostało ukończone. Wybierz plik ponownie.');
        }
        $size = filesize($file['tmp_name']);
        if ($size === false || $size < 1 || $size > $this->uploadLimit()) {
            throw new HttpError(413, 'Plik jest pusty lub przekracza limit przesyłania.');
        }
        PanelConfig::outside($file['tmp_name'], $this->config->updater['documentRoot']);
        $lockPath = $this->config->directory . '/upload.lock';
        if (file_exists($lockPath) || is_link($lockPath)) {
            regularFile($lockPath);
        }
        $lock = @fopen($lockPath, 'c+b');
        ensure($lock !== false, 'LOCK: upload lock');
        $destination = null;
        try {
            ensure(flock($lock, LOCK_EX | LOCK_NB), 'LOCK: another upload is running');
            chmod($lockPath, 0600);
            $inbox = $this->config->directory . '/uploads';
            // This exclusive lock also makes cleanup after SIGKILL safe.
            foreach (scandir($inbox) as $name) {
                if ($name !== '.' && $name !== '..') {
                    ensure(preg_match('/\A[0-9a-f]{32}\.zip\z/D', $name) === 1, 'INVENTORY: unexpected upload file');
                    removeTree($inbox . '/' . $name);
                }
            }
            $root = $this->config->updater['privateRoot'];
            $used = array_sum(array_column(treeFiles($root), 'size'));
            $free = disk_free_space($root);
            ensure($used + $size <= $this->config->updater['maxStorageBytes']
                && $free !== false && $free >= $size + $this->config->updater['reserveBytes'], 'SPACE: upload budget');
            $destination = $inbox . '/' . bin2hex(random_bytes(16)) . '.zip';
            ensure(move_uploaded_file($file['tmp_name'], $destination), 'FILESYSTEM: upload move');
            ensure(chmod($destination, 0600), 'FILESYSTEM: upload permissions');
            return $this->updater->prepare($destination);
        } finally {
            if ($destination !== null && is_file($destination)) {
                unlink($destination);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function request(): void
    {
        $this->auth->transport();
        if (isset($_GET['asset'])) {
            if ($_SERVER['REQUEST_METHOD'] !== 'GET' || !is_string($_GET['asset'])
                || !in_array($_GET['asset'], ['css', 'js'], true)) {
                throw new HttpError(404, 'Nie znaleziono zasobu.');
            }
            $extension = $_GET['asset'];
            header('Content-Type: ' . ($extension === 'css' ? 'text/css' : 'text/javascript') . '; charset=utf-8');
            echo readBounded(dirname(__DIR__) . '/web/panel.' . $extension, 65536);
            return;
        }
        $this->auth->start();
        $signedIn = $this->auth->authenticated();
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $this->uploadLimit() + 65536) {
                throw new HttpError(413, 'Żądanie przekracza limit przesyłania tego serwera.');
            }
            $action = $this->input('action', 24);
            if ($action !== 'login' && !$signedIn) {
                throw new HttpError(401, 'Zaloguj się ponownie, aby wykonać operację.');
            }
            $this->auth->checkPost();
            if ($action === 'login') {
                $this->auth->login($this->input('username', 64), $this->input('password', 1024));
                $this->redirect();
                return;
            }
            if ($action === 'logout') {
                $this->auth->logout();
                $this->redirect();
                return;
            }
            if (!in_array($action, ['upload', 'apply', 'rollback', 'init', 'recover', 'discard', 'prune'], true)) {
                throw new HttpError(400, 'Nieznana operacja.');
            }
            if ($action !== 'recover' && $this->updater->inspect()['pending']) {
                throw new HttpError(409, 'Najpierw odzyskaj przerwaną operację.');
            }
            if ($action === 'upload') {
                $plan = $this->upload();
                if (isset($plan['id'])) {
                    $this->redirect('?plan=' . $plan['id']);
                } else {
                    $_SESSION['notice'] = 'Ta sama wersja jest już aktywna. Pliki nie zostały zmienione.';
                    $this->redirect();
                }
                return;
            }
            match ($action) {
                'apply' => $this->updater->apply($this->input('plan'), $this->input('hash')),
                'rollback' => $this->updater->rollback($this->input('active'), $this->input('previous')),
                'init' => $this->updater->init(),
                'recover' => $this->updater->recover(),
                'discard' => $this->updater->discard($this->input('plan')),
                'prune' => $this->updater->prune(),
            };
            $_SESSION['notice'] = match ($action) {
                'apply' => 'Wydanie zostało zainstalowane. Sprawdź grę.',
                'rollback' => 'Przywrócono poprzednie wydanie. Sprawdź grę.',
                'init' => 'Instalacja została sprawdzona i zarejestrowana.',
                'recover' => 'Odzyskiwanie zakończone. Sprawdź aktywną wersję.',
                'discard' => 'Plan został usunięty.',
                'prune' => 'Usunięto nieużywane wydania. Zachowano aktywną i poprzednią wersję.',
            };
            $this->redirect();
            return;
        }
        if (!$signedIn) {
            PanelView::login($this->auth->csrf());
            return;
        }
        $snapshot = $this->updater->inspect();
        $plan = null;
        if (isset($_GET['plan'])) {
            if (!is_string($_GET['plan'])) {
                throw new HttpError(400, 'Nieprawidłowy plan.');
            }
            $plan = $this->updater->preview($_GET['plan']);
        }
        $notice = $_SESSION['notice'] ?? null;
        unset($_SESSION['notice']);
        PanelView::dashboard($this->config, $this->auth->csrf(), $snapshot, $plan, isset($_GET['rollback']), $notice, $this->uploadLimit());
    }
}
