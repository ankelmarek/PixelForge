<?php
declare(strict_types=1);

namespace PixelForge\Updater;

final class UpdateError extends \RuntimeException {}

function ensure(bool $condition, string $message): void
{
    if (!$condition) {
        throw new UpdateError($message);
    }
}

/** Decode JSON without silently accepting duplicate (including escaped) keys. */
function jsonDocument(string $raw): mixed
{
    try {
        $value = json_decode(
            $raw,
            false,
            64,
            JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING,
        );
        $stack = [];
        for ($i = 0, $length = strlen($raw); $i < $length; $i++) {
            $char = $raw[$i];
            if ($char === '"') {
                $start = $i++;
                while ($i < $length && $raw[$i] !== '"') {
                    $i += $raw[$i] === '\\' ? 2 : 1;
                }
                $top = count($stack) - 1;
                if ($top >= 0 && $stack[$top]['key']) {
                    $key =
                        ':' .
                        json_decode(
                            substr($raw, $start, $i - $start + 1),
                            true,
                            64,
                            JSON_THROW_ON_ERROR,
                        );
                    ensure(
                        !isset($stack[$top]['seen'][$key]),
                        'JSON: duplicate key',
                    );
                    $stack[$top]['seen'][$key] = true;
                    $stack[$top]['key'] = false;
                }
            } elseif ($char === '{' || $char === '[') {
                $stack[] = [
                    'object' => $char === '{',
                    'key' => $char === '{',
                    'seen' => [],
                ];
            } elseif ($char === '}' || $char === ']') {
                array_pop($stack);
            } elseif ($char === ',' && $stack !== []) {
                $top = count($stack) - 1;
                $stack[$top]['key'] = $stack[$top]['object'];
            }
        }
        return $value;
    } catch (\JsonException $error) {
        throw new UpdateError('JSON: invalid document', 0, $error);
    }
}

function fields(mixed $value, array $keys, string $code): void
{
    ensure($value instanceof \stdClass, "$code: object required");
    $actual = array_keys(get_object_vars($value));
    sort($actual);
    sort($keys);
    ensure($actual === $keys, "$code: incorrect fields");
}

function version(mixed $value): array
{
    ensure(
        is_string($value) &&
            preg_match(
                '/\A(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\z/D',
                $value,
            ) === 1,
        'VERSION: expected MAJOR.MINOR.PATCH',
    );
    return array_map('intval', explode('.', $value));
}

function noLinks(string $path): void
{
    ensure(
        str_starts_with($path, '/') &&
            $path !== '/' &&
            !str_contains($path, "\0"),
        'CONFIG: absolute non-root path required',
    );
    $current = '';
    foreach (explode('/', substr($path, 1)) as $part) {
        ensure(
            $part !== '' && $part !== '.' && $part !== '..',
            'CONFIG: canonical path required',
        );
        $current .= '/' . $part;
        clearstatcache(true, $current);
        ensure(!is_link($current), 'FILESYSTEM: symlink not allowed');
    }
}

function regularFile(string $path): void
{
    noLinks($path);
    $stat = @lstat($path);
    ensure(
        $stat !== false && ($stat['mode'] & 0170000) === 0100000,
        'FILESYSTEM: regular file required',
    );
    ensure($stat['nlink'] === 1, 'FILESYSTEM: hard link not allowed');
}

function readBounded(string $path, int $limit): string
{
    regularFile($path);
    $stream = @fopen($path, 'rb');
    ensure($stream !== false, 'FILESYSTEM: cannot read file');
    try {
        $info = fstat($stream);
        ensure(
            $info !== false && $info['size'] <= $limit,
            'LIMIT: file too large',
        );
        $data = stream_get_contents($stream, $limit + 1);
        ensure(
            $data !== false && strlen($data) <= $limit,
            'LIMIT: file too large',
        );
        return $data;
    } finally {
        fclose($stream);
    }
}

function syncDirectory(string $path): void
{
    $stream = @fopen($path, 'r');
    ensure($stream !== false, 'FILESYSTEM: cannot open directory for sync');
    try {
        ensure(@fsync($stream), 'FILESYSTEM: directory fsync unavailable');
    } finally {
        fclose($stream);
    }
}

function makeDirectory(string $path, int $mode = 0700): void
{
    noLinks($path);
    if (!is_dir($path)) {
        ensure(
            @mkdir($path, $mode, true),
            'FILESYSTEM: cannot create directory',
        );
    }
}

function writeFile(string $path, string $data, int $mode = 0600): void
{
    noLinks($path);
    $stream = @fopen($path, 'xb');
    ensure(
        $stream !== false,
        'FILESYSTEM: destination already exists or is not writable',
    );
    try {
        ensure(@chmod($path, $mode), 'FILESYSTEM: cannot set file permissions');
        $offset = 0;
        while ($offset < strlen($data)) {
            $written = fwrite($stream, substr($data, $offset));
            ensure(
                $written !== false && $written > 0,
                'FILESYSTEM: incomplete write',
            );
            $offset += $written;
        }
        ensure(
            fflush($stream) && fsync($stream),
            'FILESYSTEM: cannot sync file',
        );
    } finally {
        fclose($stream);
    }
}

function atomicJson(string $path, mixed $value): void
{
    noLinks($path);
    $temporary = dirname($path) . '/.json-' . bin2hex(random_bytes(12));
    try {
        writeFile(
            $temporary,
            json_encode(
                $value,
                JSON_PRETTY_PRINT |
                    JSON_UNESCAPED_SLASHES |
                    JSON_THROW_ON_ERROR,
            ) . "\n",
        );
        ensure(
            @rename($temporary, $path),
            'FILESYSTEM: cannot commit metadata',
        );
        syncDirectory(dirname($path));
    } finally {
        if (is_file($temporary)) {
            unlink($temporary);
        }
    }
}

/** Never follows links, even in directories not supplied by an archive. */
function treeFiles(string $root): array
{
    noLinks($root);
    ensure(is_dir($root), 'FILESYSTEM: directory required');
    $result = [];
    $walk = function (string $directory, string $prefix, int $depth) use (
        &$walk,
        &$result,
    ): void {
        ensure($depth <= 24, 'LIMIT: directory depth');
        $names = scandir($directory);
        ensure($names !== false, 'FILESYSTEM: cannot list directory');
        foreach ($names as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $path = $directory . '/' . $name;
            $stat = lstat($path);
            ensure($stat !== false, 'FILESYSTEM: cannot stat entry');
            $type = $stat['mode'] & 0170000;
            if ($type === 0040000) {
                $walk($path, $prefix . $name . '/', $depth + 1);
            } else {
                ensure(
                    $type === 0100000 && $stat['nlink'] === 1,
                    'FILESYSTEM: links and special files forbidden',
                );
                $result[$prefix . $name] = $stat;
            }
        }
    };
    $walk($root, '', 0);
    ksort($result);
    return $result;
}

function removeTree(string $path): void
{
    noLinks($path);
    if (!file_exists($path)) {
        return;
    }
    if (is_dir($path)) {
        foreach (scandir($path) as $name) {
            if ($name !== '.' && $name !== '..') {
                removeTree($path . '/' . $name);
            }
        }
        ensure(rmdir($path), 'FILESYSTEM: cannot remove directory');
    } else {
        regularFile($path);
        ensure(unlink($path), 'FILESYSTEM: cannot remove file');
    }
}

function copyTree(string $source, string $destination): void
{
    ensure(!file_exists($destination), 'FILESYSTEM: copy destination exists');
    $files = treeFiles($source);
    makeDirectory($destination, 0755);
    foreach ($files as $relative => $stat) {
        $path = $destination . '/' . $relative;
        makeDirectory(dirname($path), 0755);
        // A release member is bounded by Package::verifyDirectory before copying.
        writeFile(
            $path,
            readBounded($source . '/' . $relative, $stat['size']),
            0644,
        );
    }
    // umask may restrict mkdir despite the explicit mode.
    $iterator = new \RecursiveIteratorIterator(
        new \RecursiveDirectoryIterator(
            $destination,
            \FilesystemIterator::SKIP_DOTS,
        ),
        \RecursiveIteratorIterator::CHILD_FIRST,
    );
    foreach ($iterator as $entry) {
        if ($entry->isDir()) {
            chmod($entry->getPathname(), 0755);
            syncDirectory($entry->getPathname());
        }
    }
    chmod($destination, 0755);
    syncDirectory($destination);
    syncDirectory(dirname($destination));
}
