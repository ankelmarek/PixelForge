<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/Updater.php';

/** Trusted local configuration only. No credentials or paths come from HTTP/ZIP. */
final class PanelConfig
{
    public readonly array $data;
    public readonly array $updater;
    public readonly string $directory;

    public static function read(string $path): array
    {
        $raw = readBounded($path, 16384);
        ensure((fileperms($path) & 0077) === 0, 'CONFIG: private configuration permissions required');
        ensure(jsonDocument($raw) instanceof \stdClass, 'CONFIG: object required');
        return json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    }

    public static function outside(string $path, string $public): void
    {
        noLinks($path);
        ensure($path !== $public && !str_starts_with($path . '/', $public . '/'), 'CONFIG: private path is public');
    }

    public static function origin(string $value): string
    {
        ensure(
            preg_match('~\Ahttps://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[1-9][0-9]{0,4})?\z~D', $value) === 1,
            'CONFIG: canonical HTTPS origin required',
        );
        $port = parse_url($value, PHP_URL_PORT);
        ensure($port === null || ($port <= 65535 && $port !== 443), 'CONFIG: use canonical HTTPS port');
        return $value;
    }

    public static function password(string $password): string
    {
        ensure(strlen($password) >= 16 && strlen($password) <= 72 && !str_contains($password, "\0"), 'PASSWORD: use 16 to 72 bytes');
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public function __construct(string $path)
    {
        ensure(function_exists('session_start') && function_exists('password_hash'), 'ENVIRONMENT: PHP sessions and password hashing required');
        $data = self::read($path);
        $keys = ['formatVersion', 'updaterConfig', 'origin', 'panelPath', 'username', 'passwordHash', 'instanceKey'];
        ensure(array_diff(array_keys($data), $keys) === [] && array_diff($keys, array_keys($data)) === [], 'CONFIG: panel fields');
        ensure($data['formatVersion'] === 1, 'CONFIG: panel version');
        foreach (array_slice($keys, 1) as $key) {
            ensure(is_string($data[$key]), 'CONFIG: string required');
        }
        self::origin($data['origin']);
        ensure(preg_match('~\A/[a-z0-9][a-z0-9-]{2,47}/\z~D', $data['panelPath']) === 1, 'CONFIG: panel path');
        ensure(preg_match('/\A[A-Za-z0-9_.-]{3,64}\z/D', $data['username']) === 1, 'CONFIG: administrator name');
        ensure(preg_match('/\A[0-9a-f]{64}\z/D', $data['instanceKey']) === 1, 'CONFIG: instance key');
        ensure(password_get_info($data['passwordHash'])['algoName'] === 'bcrypt', 'CONFIG: password hash');
        $this->updater = self::read($data['updaterConfig']);
        new Updater($this->updater);
        $public = $this->updater['documentRoot'];
        foreach ([$path, $data['updaterConfig'], dirname(__DIR__)] as $private) {
            self::outside($private, $public);
        }
        $panel = $public . rtrim($data['panelPath'], '/');
        ensure($panel !== $this->updater['target'], 'CONFIG: panel must be outside the game');
        $temporary = ini_get('upload_tmp_dir') ?: sys_get_temp_dir();
        self::outside($temporary, $public);
        $this->directory = $this->updater['privateRoot'] . '/panel';
        ensure(dirname($path) === $this->directory, 'CONFIG: keep panel configuration in privateRoot/panel');
        foreach ([$this->directory, $this->directory . '/sessions', $this->directory . '/uploads'] as $directory) {
            makeDirectory($directory);
            ensure((fileperms($directory) & 0077) === 0, 'CONFIG: private panel directory permissions required');
        }
        $this->data = $data;
    }

    public function fingerprint(): string
    {
        return hash('sha256', $this->data['passwordHash'] . $this->data['instanceKey']);
    }

    public function gameUrl(): string
    {
        return $this->data['origin'] . '/' . rawurlencode(basename($this->updater['target'])) . '/index.html';
    }
}
