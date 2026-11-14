<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/Support.php';

/** Explicit hosting layout, never selected by a ZIP, request Host or form field. */
final class ProtectedStorage
{
    public const RULES = "# PixelForge private storage — Apache 2.4 / LiteSpeed\nRequire all denied\nOptions -Indexes\n";
    private static array $verified = [];

    public static function origin(string $value): string
    {
        ensure(
            preg_match(
                '~\Ahttps://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[1-9][0-9]{0,4})?\z~D',
                $value,
            ) === 1,
            'CONFIG: canonical HTTPS origin required',
        );
        $port = parse_url($value, PHP_URL_PORT);
        ensure(
            $port === null || ($port <= 65535 && $port !== 443),
            'CONFIG: use canonical HTTPS port',
        );
        return $value;
    }

    private static function get(string $url): array
    {
        ensure(
            extension_loaded('openssl') && ini_get('allow_url_fopen'),
            'PROTECTION: HTTPS self-check requires OpenSSL and allow_url_fopen',
        );
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 5,
                'follow_location' => 0,
                'ignore_errors' => true,
                'max_redirects' => 0,
                'header' =>
                    "Accept: text/plain\r\nCache-Control: no-cache\r\nConnection: close\r\n",
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'allow_self_signed' => false,
            ],
        ]);
        $body = @file_get_contents($url, false, $context, 0, 4096);
        $headers = $http_response_header ?? [];
        ensure(
            $body !== false &&
                preg_match(
                    '~\AHTTP/\S+ ([0-9]{3})\b~',
                    $headers[0] ?? '',
                    $match,
                ) === 1,
            'PROTECTION: cannot verify this installation over HTTPS',
        );
        return [(int) $match[1], $body];
    }

    public static function check(array $config): void
    {
        $mode = $config['publicStorage'] ?? null;
        ensure(
            is_array($mode) &&
                count($mode) === 2 &&
                ($mode['mode'] ?? null) === 'apache-deny-v1' &&
                is_string($mode['origin'] ?? null),
            'CONFIG: explicit protected storage configuration required',
        );
        $origin = self::origin($mode['origin']);
        $public = $config['documentRoot'];
        $private = $public . '/_pixelforge';
        noLinks($private);
        ensure(
            $config['privateRoot'] === $private . '/data' &&
                $config['target'] === $public . '/PixelForge',
            'CONFIG: protected layout must use _pixelforge/data and PixelForge',
        );
        ensure(
            readBounded($private . '/.htaccess', 1024) === self::RULES,
            'PROTECTION: missing or changed private .htaccess',
        );
        $token = readBounded($public . '/pixelforge-admin/probe.txt', 65);
        ensure(
            preg_match('/\A[0-9a-f]{64}\n\z/D', $token) === 1 &&
                readBounded($private . '/probe.txt', 65) === $token,
            'PROTECTION: installation probes do not match',
        );
        // Cache only within this PHP request, for at most five seconds. Local rules
        // are checked on every call; no persisted "protection OK" bypass exists.
        $key = $origin . $private . $token;
        if (
            isset(self::$verified[$key]) &&
            microtime(true) - self::$verified[$key] < 5
        ) {
            return;
        }
        $query = '?check=' . bin2hex(random_bytes(16));
        [$publicStatus, $publicBody] = self::get(
            $origin . '/pixelforge-admin/probe.txt' . $query,
        );
        ensure(
            $publicStatus === 200 && hash_equals($token, $publicBody),
            'PROTECTION: HTTPS origin does not point to this installation',
        );
        [$privateStatus, $privateBody] = self::get(
            $origin . '/_pixelforge/probe.txt' . $query,
        );
        ensure(
            $privateStatus === 403 && !str_contains($privateBody, trim($token)),
            'PROTECTION: private directory must return HTTP 403',
        );
        self::$verified[$key] = microtime(true);
    }

    public static function contains(string $path, array $config): void
    {
        noLinks($path);
        $root = $config['documentRoot'] . '/_pixelforge/';
        ensure(
            str_starts_with($path . '/', $root),
            'CONFIG: administrative files must stay in _pixelforge',
        );
    }
}
