<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/Support.php';

/** The same restricted full-ZIP contract as tools/release.py, without extractTo. */
final class Package
{
    public const LIMITS = [
        'maxArchiveBytes' => 67108864,
        'maxFiles' => 4096,
        'maxFileBytes' => 16777216,
        'maxTotalBytes' => 268435456,
        'maxManifestBytes' => 2097152,
        'maxMetadataBytes' => 4194304,
        'maxCompressionRatio' => 200,
    ];
    public readonly \stdClass $manifest;
    public readonly string $hash;
    public readonly string $manifestHash;
    private string $raw;
    private array $members = [];
    private array $files;

    public static function limits(array $overrides = []): array
    {
        ensure(
            array_diff_key($overrides, self::LIMITS) === [],
            'LIMIT_CONFIG: unknown key',
        );
        $limits = array_replace(self::LIMITS, $overrides);
        foreach ($limits as $value) {
            ensure(
                is_int($value) && $value > 0,
                'LIMIT_CONFIG: positive integers required',
            );
        }
        return $limits;
    }

    public static function path(mixed $path, bool $manifest = false): string
    {
        ensure(
            is_string($path) && strlen($path) > 0 && strlen($path) <= 240,
            'PATH: invalid length',
        );
        $parts = explode('/', $path);
        ensure(count($parts) <= 16, 'PATH: depth');
        foreach ($parts as $part) {
            ensure(
                preg_match('/\A[A-Za-z0-9_-][A-Za-z0-9_.-]*\z/D', $part) ===
                    1 && !str_ends_with($part, '.'),
                'PATH: noncanonical name',
            );
            $name = strtolower($part);
            ensure(
                !in_array(
                    $name,
                    [
                        'admin-updater',
                        'storage',
                        'backups',
                        'node_modules',
                        'src',
                    ],
                    true,
                ) &&
                    preg_match(
                        '/\A(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?\z/D',
                        $name,
                    ) !== 1,
                'PATH: reserved name',
            );
            ensure(
                array_intersect(array_slice(explode('.', $name), 1), [
                    'php',
                    'phtml',
                    'phar',
                    'cgi',
                    'pl',
                    'py',
                    'sh',
                    'exe',
                    'dll',
                    'bat',
                    'cmd',
                    'asp',
                    'aspx',
                    'jsp',
                    'shtml',
                    'htaccess',
                    'ini',
                    'env',
                    'config',
                ]) === [],
                'PATH: server file',
            );
        }
        $extensions = [
            'js',
            'css',
            'json',
            'png',
            'webp',
            'svg',
            'jpg',
            'jpeg',
            'ogg',
            'mp3',
            'wav',
            'woff',
            'woff2',
        ];
        ensure(
            ($manifest && $path === 'manifest.json') ||
                $path === 'index.html' ||
                (count($parts) > 1 &&
                    $parts[0] === 'assets' &&
                    (in_array(
                        strtolower(pathinfo($path, PATHINFO_EXTENSION)),
                        $extensions,
                        true,
                    ) ||
                        end($parts) === 'LICENSE.md')),
            'ALLOWLIST: static build files only',
        );
        return strtolower($path);
    }

    public static function manifestFiles(mixed $manifest, array $limits): array
    {
        fields(
            $manifest,
            [
                'formatVersion',
                'project',
                'packageType',
                'releaseVersion',
                'baseVersion',
                'requiredUpdaterVersion',
                'engineSchemaVersion',
                'files',
                'deletions',
            ],
            'MANIFEST',
        );
        ensure($manifest->formatVersion === 1, 'FORMAT: unsupported version');
        ensure($manifest->project === 'pixelforge', 'PROJECT: mismatch');
        ensure(
            $manifest->packageType === 'full' &&
                $manifest->baseVersion === null &&
                $manifest->deletions === [],
            'TYPE: only full packages supported',
        );
        version($manifest->releaseVersion);
        ensure(
            version($manifest->requiredUpdaterVersion) <= [1, 0, 0],
            'VERSION: newer updater required',
        );
        ensure(
            $manifest->engineSchemaVersion === 2,
            'SCHEMA: unsupported engine contract',
        );
        ensure(
            is_array($manifest->files) &&
                count($manifest->files) > 0 &&
                count($manifest->files) < $limits['maxFiles'],
            'MANIFEST: file count',
        );
        $files = $names = [];
        $total = 0;
        foreach ($manifest->files as $entry) {
            fields($entry, ['path', 'size', 'sha256'], 'MANIFEST');
            $key = self::path($entry->path);
            ensure(!isset($names[$key]), 'DUPLICATE: manifest path');
            $names[$key] = true;
            ensure(
                is_int($entry->size) &&
                    $entry->size >= 0 &&
                    $entry->size <= $limits['maxFileBytes'],
                'LIMIT: file size',
            );
            ensure(
                is_string($entry->sha256) &&
                    preg_match('/\A[0-9a-f]{64}\z/D', $entry->sha256) === 1,
                'MANIFEST: sha256',
            );
            $total += $entry->size;
            ensure($total <= $limits['maxTotalBytes'], 'LIMIT: total size');
            $files[$entry->path] = $entry;
        }
        ensure(
            isset($files['index.html']) && $files['index.html']->size > 0,
            'MANIFEST: missing index.html',
        );
        return $files;
    }

    public function __construct(string $path, private readonly array $limits)
    {
        ensure(
            PHP_VERSION_ID >= 80200 && PHP_INT_SIZE === 8,
            'ENVIRONMENT: 64-bit PHP 8.2+ required',
        );
        ensure(
            class_exists(\ZipArchive::class),
            'ENVIRONMENT: ZipArchive required',
        );
        $this->raw = readBounded($path, $limits['maxArchiveBytes']);
        $this->hash = hash('sha256', $this->raw);
        $this->preflight();
        $zip = new \ZipArchive();
        ensure(
            $zip->open($path, \ZipArchive::RDONLY) === true,
            'ZIP: cannot open archive',
        );
        try {
            ensure(
                $zip->numFiles === count($this->members),
                'ZIP: inconsistent entry count',
            );
            foreach (array_keys($this->members) as $index => $name) {
                ensure(
                    $zip->getNameIndex($index) === $name,
                    'ZIP: inconsistent names',
                );
            }
        } finally {
            $zip->close();
        }
        ensure(
            isset($this->members['manifest.json']),
            'MANIFEST: missing manifest.json',
        );
        $rawManifest = '';
        foreach ($this->decode($this->members['manifest.json']) as $block) {
            $rawManifest .= $block;
        }
        $manifest = jsonDocument($rawManifest);
        $this->files = self::manifestFiles($manifest, $limits);
        $this->manifest = $manifest;
        $this->manifestHash = hash('sha256', $rawManifest);
        $actual = array_keys($this->members);
        $expected = [...array_keys($this->files), 'manifest.json'];
        sort($actual);
        sort($expected);
        ensure($actual === $expected, 'MANIFEST: undeclared or missing file');
        foreach ($this->files as $name => $entry) {
            ensure(
                $this->members[$name]['size'] === $entry->size,
                'SIZE: manifest mismatch',
            );
            $hash = hash_init('sha256');
            foreach ($this->decode($this->members[$name]) as $block) {
                hash_update($hash, $block);
            }
            ensure(
                hash_final($hash) === $entry->sha256,
                'HASH: payload mismatch',
            );
        }
    }

    private function preflight(): void
    {
        $length = strlen($this->raw);
        ensure($length >= 22, 'ZIP: too short');
        $end = unpack(
            'Vsig/vdisk/vstart/vcount/vtotal/Vsize/Voffset/vcomment',
            substr($this->raw, -22),
        );
        ensure(
            $end['sig'] === 0x06054b50 &&
                $end['disk'] === 0 &&
                $end['start'] === 0 &&
                $end['comment'] === 0 &&
                $end['count'] === $end['total'],
            'ZIP: single disk, no comments or trailing data required',
        );
        ensure(
            $end['count'] > 0 &&
                $end['count'] <= $this->limits['maxFiles'] &&
                $end['count'] < 65535,
            'LIMIT: ZIP entry count',
        );
        ensure(
            $end['size'] <= $this->limits['maxMetadataBytes'] &&
                $end['offset'] + $end['size'] === $length - 22,
            'ZIP: central directory',
        );
        $position = $end['offset'];
        $localEnd = $total = 0;
        $names = [];
        for ($i = 0; $i < $end['count']; $i++) {
            ensure(
                $position + 46 <= $length - 22,
                'ZIP: truncated central entry',
            );
            $c = unpack(
                'Vsig/vmade/vneeded/vflags/vmethod/vtime/vdate/Vcrc/Vcompressed/Vsize/vnl/vel/vcl/vdisk/vinternal/Vexternal/Voffset',
                substr($this->raw, $position, 46),
            );
            ensure(
                $c['sig'] === 0x02014b50 &&
                    $c['needed'] <= 20 &&
                    in_array($c['flags'], [0, 0x800], true) &&
                    in_array($c['method'], [0, 8], true) &&
                    $c['el'] === 0 &&
                    $c['cl'] === 0 &&
                    $c['disk'] === 0,
                'ZIP: unsupported entry features',
            );
            ensure(
                $c['nl'] > 0 &&
                    $c['nl'] <= 240 &&
                    $position + 46 + $c['nl'] <= $length - 22,
                'ZIP: name length',
            );
            $name = substr($this->raw, $position + 46, $c['nl']);
            $key = self::path($name, true);
            ensure(!isset($names[$key]), 'DUPLICATE: ZIP path');
            $names[$key] = true;
            $mode = $c['external'] >> 16;
            ensure(
                in_array($c['made'] >> 8, [0, 3], true) &&
                    in_array($mode & 0170000, [0, 0100000], true) &&
                    ($mode & 07111) === 0 &&
                    ($c['external'] & 0xffde) === 0,
                'ZIP: regular non-executable files required',
            );
            ensure(
                $c['size'] <= $this->limits['maxFileBytes'] &&
                    $c['size'] <=
                        max(1, $c['compressed']) *
                            $this->limits['maxCompressionRatio'],
                'LIMIT: file size or compression ratio',
            );
            ensure(
                $name !== 'manifest.json' ||
                    $c['size'] <= $this->limits['maxManifestBytes'],
                'LIMIT: manifest size',
            );
            $total += $c['size'];
            ensure(
                $total <= $this->limits['maxTotalBytes'],
                'LIMIT: total expanded size',
            );
            ensure(
                $c['offset'] === $localEnd &&
                    $c['offset'] + 30 <= $end['offset'],
                'ZIP: overlap, prefix or gap',
            );
            $header = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                $c['needed'],
                $c['flags'],
                $c['method'],
                $c['time'],
                $c['date'],
                $c['crc'],
                $c['compressed'],
                $c['size'],
                $c['nl'],
                0,
            );
            ensure(
                substr($this->raw, $c['offset'], 30) === $header,
                'ZIP: local header mismatch',
            );
            ensure(
                substr($this->raw, $c['offset'] + 30, $c['nl']) === $name,
                'ZIP: local filename mismatch',
            );
            $localEnd = $c['offset'] + 30 + $c['nl'] + $c['compressed'];
            ensure($localEnd <= $end['offset'], 'ZIP: entry exceeds payload');
            $this->members[$name] = $c;
            $position += 46 + $c['nl'];
        }
        ensure(
            $position === $end['offset'] + $end['size'] &&
                $localEnd === $end['offset'],
            'ZIP: directory count or size',
        );
    }

    /** Bounded compressed blocks; verify the real stream end, not libzip's clipped size. */
    private function decode(array $entry): \Generator
    {
        $start = $entry['offset'] + 30 + $entry['nl'];
        $decoder =
            $entry['method'] === 8 ? inflate_init(ZLIB_ENCODING_RAW) : null;
        $hash = hash_init('crc32b');
        $count = 0;
        for ($offset = 0; $offset < $entry['compressed']; $offset += 1024) {
            $input = substr(
                $this->raw,
                $start + $offset,
                min(1024, $entry['compressed'] - $offset),
            );
            if ($decoder !== null) {
                ensure(
                    inflate_get_status($decoder) !== ZLIB_STREAM_END,
                    'ZIP: trailing compressed data',
                );
                $block = @inflate_add($decoder, $input, ZLIB_SYNC_FLUSH);
                ensure($block !== false, 'ZIP: corrupt deflate');
            } else {
                $block = $input;
            }
            $count += strlen($block);
            ensure(
                $count <= $entry['size'],
                'LIMIT: actual expanded size exceeds declaration',
            );
            hash_update($hash, $block);
            yield $block;
        }
        ensure(
            $decoder === null ||
                (inflate_get_status($decoder) === ZLIB_STREAM_END &&
                    inflate_get_read_len($decoder) === $entry['compressed']),
            'ZIP: incomplete or trailing deflate',
        );
        ensure(
            $count === $entry['size'] &&
                hexdec(hash_final($hash)) === $entry['crc'],
            'ZIP: size or CRC mismatch',
        );
    }

    public function extract(string $destination): array
    {
        ensure(
            !file_exists($destination),
            'FILESYSTEM: extraction destination exists',
        );
        makeDirectory($destination);
        try {
            foreach ($this->members as $name => $entry) {
                $path = $destination . '/' . $name;
                makeDirectory(dirname($path));
                $stream = fopen($path, 'xb');
                ensure($stream !== false, 'FILESYSTEM: cannot create member');
                try {
                    foreach ($this->decode($entry) as $block) {
                        $offset = 0;
                        while ($offset < strlen($block)) {
                            $written = fwrite($stream, substr($block, $offset));
                            ensure(
                                $written !== false && $written > 0,
                                'FILESYSTEM: incomplete extraction',
                            );
                            $offset += $written;
                        }
                    }
                    ensure(
                        fflush($stream) && fsync($stream),
                        'FILESYSTEM: extraction fsync',
                    );
                } finally {
                    fclose($stream);
                }
            }
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(
                    $destination,
                    \FilesystemIterator::SKIP_DOTS,
                ),
                \RecursiveIteratorIterator::CHILD_FIRST,
            );
            foreach ($iterator as $entry) {
                if ($entry->isDir()) {
                    syncDirectory($entry->getPathname());
                }
            }
            syncDirectory($destination);
            syncDirectory(dirname($destination));
            return self::verifyDirectory($destination, $this->limits);
        } catch (\Throwable $error) {
            removeTree($destination);
            throw $error;
        }
    }

    public function expandedBytes(): int
    {
        return array_sum(array_column($this->members, 'size'));
    }

    public static function verifyDirectory(
        string $directory,
        array $limits,
    ): array {
        $raw = readBounded(
            $directory . '/manifest.json',
            $limits['maxManifestBytes'],
        );
        $manifest = jsonDocument($raw);
        $files = self::manifestFiles($manifest, $limits);
        $actual = treeFiles($directory);
        $expected = [...array_keys($files), 'manifest.json'];
        sort($expected);
        ensure(
            array_keys($actual) === $expected,
            'INVENTORY: undeclared or missing file',
        );
        $directories = [];
        foreach (array_keys($files) as $name) {
            for (
                $parent = dirname($name);
                $parent !== '.';
                $parent = dirname($parent)
            ) {
                $directories[$parent] = true;
            }
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $directory,
                \FilesystemIterator::SKIP_DOTS,
            ),
            \RecursiveIteratorIterator::SELF_FIRST,
        );
        foreach ($iterator as $entry) {
            if ($entry->isDir()) {
                ensure(
                    isset(
                        $directories[
                            substr(
                                $entry->getPathname(),
                                strlen($directory) + 1,
                            )
                        ],
                    ),
                    'INVENTORY: undeclared directory',
                );
            }
        }
        $total = strlen($raw);
        $latest = 0;
        foreach ($actual as $name => $stat) {
            $latest = max($latest, $stat['mtime']);
            if ($name === 'manifest.json') {
                continue;
            }
            ensure(
                $stat['size'] === $files[$name]->size &&
                    hash_file('sha256', $directory . '/' . $name) ===
                        $files[$name]->sha256,
                'HASH: installed file mismatch',
            );
            $total += $stat['size'];
        }
        ensure($total <= $limits['maxTotalBytes'], 'LIMIT: installed size');
        return [
            'id' => hash('sha256', $raw),
            'version' => $manifest->releaseVersion,
            'bytes' => $total,
            'files' => $files,
            'mtime' => $latest,
        ];
    }
}
