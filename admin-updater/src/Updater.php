<?php
declare(strict_types=1);

namespace PixelForge\Updater;

require_once __DIR__ . '/Package.php';

/**
 * Local PHP adapter. All mutable administrative data is outside documentRoot.
 * Directory rename fallback deliberately does NOT promise continuous HTTP access.
 * The optional checkpoint is dependency injection for tests, never package input.
 */
final class Updater
{
    private array $limits;
    private string $root;
    private string $target;
    private int $storageLimit;
    private int $reserve;

    public function __construct(
        private readonly array $config,
        private readonly mixed $checkpoint = null,
    ) {
        ensure(
            PHP_VERSION_ID >= 80200 &&
                PHP_INT_SIZE === 8 &&
                PHP_OS_FAMILY !== 'Windows',
            'ENVIRONMENT: 64-bit PHP 8.2+ on Unix required',
        );
        ensure(
            class_exists(\ZipArchive::class) &&
                function_exists('inflate_init') &&
                function_exists('fsync'),
            'ENVIRONMENT: ZipArchive, zlib and fsync required',
        );
        $keys = [
            'documentRoot',
            'target',
            'privateRoot',
            'maxStorageBytes',
            'reserveBytes',
            'limits',
        ];
        ensure(
            array_diff(array_keys($config), $keys) === [] &&
                array_diff($keys, array_keys($config)) === [],
            'CONFIG: incorrect fields',
        );
        foreach (['documentRoot', 'target', 'privateRoot'] as $key) {
            ensure(is_string($config[$key]), 'CONFIG: path must be a string');
            noLinks($config[$key]);
        }
        $documentRoot = $config['documentRoot'];
        $this->target = $config['target'];
        $this->root = $config['privateRoot'];
        ensure(
            is_dir($documentRoot) && dirname($this->target) === $documentRoot,
            'CONFIG: target must be a direct child of documentRoot',
        );
        ensure(
            !in_array(
                strtolower(basename($this->target)),
                ['admin-updater', 'storage', 'backups'],
                true,
            ),
            'CONFIG: protected target',
        );
        ensure(
            is_dir(dirname($this->root)) &&
                $this->root !== $documentRoot &&
                !str_starts_with($this->root . '/', $documentRoot . '/') &&
                !str_starts_with($documentRoot . '/', $this->root . '/'),
            'CONFIG: privateRoot must be separate and outside documentRoot',
        );
        ensure(
            stat(dirname($this->root))['dev'] === stat($documentRoot)['dev'],
            'ENVIRONMENT: one filesystem required for rename',
        );
        ensure(
            is_writable($documentRoot) && is_writable(dirname($this->root)),
            'ENVIRONMENT: parent directories must be writable',
        );
        foreach (['maxStorageBytes', 'reserveBytes'] as $key) {
            ensure(
                is_int($config[$key]) && $config[$key] > 0,
                'CONFIG: positive storage limits required',
            );
        }
        $this->storageLimit = $config['maxStorageBytes'];
        $this->reserve = $config['reserveBytes'];
        ensure(is_array($config['limits']), 'CONFIG: limits must be an object');
        $this->limits = Package::limits($config['limits']);
        $memory = ini_get('memory_limit');
        if ($memory !== '-1') {
            ensure(
                preg_match('/\A([0-9]+)([KMG]?)\z/i', $memory, $match) === 1,
                'ENVIRONMENT: unknown memory limit',
            );
            $bytes =
                (int) $match[1] *
                1024 **
                    array_search(
                        strtoupper($match[2]),
                        ['', 'K', 'M', 'G'],
                        true,
                    );
            $needed =
                2 * $this->limits['maxArchiveBytes'] +
                2 * $this->limits['maxFileBytes'] +
                $this->limits['maxMetadataBytes'] +
                33554432;
            ensure(
                $bytes >= $needed,
                'ENVIRONMENT: increase PHP memory_limit (256M for default package limits) or lower package limits',
            );
        }
    }

    private function point(string $name): void
    {
        if ($this->checkpoint !== null) {
            ($this->checkpoint)($name);
        }
    }

    private function locked(callable $operation, bool $recover = true): mixed
    {
        makeDirectory($this->root);
        clearstatcache();
        ensure(
            (fileperms($this->root) & 0077) === 0,
            'ENVIRONMENT: privateRoot must have mode 0700',
        );
        $path = $this->root . '/update.lock';
        if (file_exists($path) || is_link($path)) {
            regularFile($path);
        }
        $lock = @fopen($path, 'c+b');
        ensure($lock !== false, 'LOCK: cannot open lock');
        try {
            ensure(
                flock($lock, LOCK_EX | LOCK_NB),
                'LOCK: another operation is running',
            );
            chmod($path, 0600);
            foreach (['releases', 'staging', 'switch', 'logs'] as $directory) {
                makeDirectory($this->root . '/' . $directory);
            }
            if ($recover && file_exists($this->root . '/transaction.json')) {
                $this->recoverLocked();
            }
            return $operation();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function metadata(string $path): array
    {
        $raw = readBounded($path, $this->limits['maxMetadataBytes']);
        ensure(
            jsonDocument($raw) instanceof \stdClass,
            'STATE: object required',
        );
        return json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    }

    private function id(string $value, int $length = 32): string
    {
        ensure(
            preg_match('/\A[0-9a-f]{' . $length . '}\z/D', $value) === 1,
            'STATE: invalid identifier',
        );
        return $value;
    }

    private function descriptor(array $verified): array
    {
        return [
            'id' => $verified['id'],
            'version' => $verified['version'],
            'bytes' => $verified['bytes'],
        ];
    }

    private function checkDescriptor(mixed $value): void
    {
        if ($value === null) {
            return;
        }
        ensure(
            is_array($value) &&
                array_keys($value) === ['id', 'version', 'bytes'],
            'STATE: invalid release',
        );
        ensure(is_string($value['id']), 'STATE: invalid release id');
        $this->id($value['id'], 64);
        version($value['version']);
        ensure(
            is_int($value['bytes']) &&
                $value['bytes'] > 0 &&
                $value['bytes'] <= $this->limits['maxTotalBytes'],
            'STATE: invalid release size',
        );
    }

    private function checkState(array $state): void
    {
        ensure(
            array_keys($state) === [
                'formatVersion',
                'target',
                'active',
                'previous',
                'lastOperation',
            ] &&
                $state['formatVersion'] === 1 &&
                $state['target'] === $this->target,
            'STATE: incompatible installation',
        );
        $this->checkDescriptor($state['active']);
        $this->checkDescriptor($state['previous']);
        if ($state['lastOperation'] !== null) {
            ensure(
                is_string($state['lastOperation']),
                'STATE: invalid operation',
            );
            $this->id($state['lastOperation']);
        }
    }

    private function state(): array
    {
        ensure(
            file_exists($this->root . '/state.json'),
            'SETUP: run init first',
        );
        $state = $this->metadata($this->root . '/state.json');
        $this->checkState($state);
        return $state;
    }

    private function releasePath(array $release): string
    {
        $this->checkDescriptor($release);
        return $this->root . '/releases/' . $release['id'];
    }

    private function verify(string $path, ?array $expected): ?array
    {
        noLinks($path);
        if ($expected === null) {
            ensure(
                !file_exists($path) ||
                    (is_dir($path) && scandir($path) === ['.', '..']),
                'INVENTORY: expected an empty installation',
            );
            return null;
        }
        $verified = Package::verifyDirectory($path, $this->limits);
        ensure(
            $this->descriptor($verified) === $expected,
            'HASH: release changed',
        );
        return $verified;
    }

    private function space(int $additional): void
    {
        $used = array_sum(array_column(treeFiles($this->root), 'size'));
        ensure(
            $additional >= 0 && $used + $additional <= $this->storageLimit,
            'SPACE: private storage limit exceeded; discard unused plans or prune releases',
        );
        $free = disk_free_space($this->root);
        ensure(
            $free !== false && $free >= $additional + $this->reserve,
            'SPACE: insufficient free disk reserve',
        );
    }

    public function doctor(): array
    {
        return $this->locked(function (): array {
            $this->space(4096);
            $probe = $this->root . '/.probe-' . bin2hex(random_bytes(8));
            try {
                writeFile($probe, 'PixelForge');
                ensure(
                    rename($probe, $probe . '-moved'),
                    'ENVIRONMENT: rename unavailable',
                );
                syncDirectory($this->root);
            } finally {
                foreach ([$probe, $probe . '-moved'] as $path) {
                    if (is_file($path)) {
                        unlink($path);
                    }
                }
            }
            return [
                'ready' => true,
                'php' => PHP_VERSION,
                'zip' => \ZipArchive::LIBZIP_VERSION,
                'mode' => 'directory-rename',
                'availability' =>
                    'brief HTTP 404 between renames; recover after process interruption',
                'target' => $this->target,
                'privateRoot' => $this->root,
            ];
        }, false);
    }

    public function init(): array
    {
        return $this->locked(function (): array {
            if (file_exists($this->root . '/state.json')) {
                $state = $this->state();
                $this->verify($this->target, $state['active']);
                return $state;
            }
            $active = null;
            $this->space(8192);
            if (
                file_exists($this->target) &&
                scandir($this->target) !== ['.', '..']
            ) {
                $verified = Package::verifyDirectory(
                    $this->target,
                    $this->limits,
                );
                $active = $this->descriptor($verified);
                $this->space($active['bytes'] + 8192);
                $path = $this->releasePath($active);
                if (!is_dir($path)) {
                    $temporary =
                        $this->root . '/staging/' . bin2hex(random_bytes(16));
                    try {
                        copyTree($this->target, $temporary);
                        $this->verify($temporary, $active);
                        ensure(
                            rename($temporary, $path),
                            'FILESYSTEM: cannot save initial release',
                        );
                        syncDirectory(dirname($path));
                    } finally {
                        removeTree($temporary);
                    }
                }
                $this->verify($path, $active);
            } else {
                $this->verify($this->target, null);
            }
            $state = [
                'formatVersion' => 1,
                'target' => $this->target,
                'active' => $active,
                'previous' => null,
                'lastOperation' => null,
            ];
            atomicJson($this->root . '/state.json', $state);
            return $state;
        });
    }

    /** A web GET must never recover or switch the public installation. */
    public function inspect(): array
    {
        return $this->locked(function (): array {
            $pending = file_exists($this->root . '/transaction.json');
            $state = file_exists($this->root . '/state.json') ? $this->state() : null;
            $healthy = false;
            if ($state !== null && !$pending) {
                try {
                    $this->verify($this->target, $state['active']);
                    $healthy = true;
                } catch (UpdateError $error) {
                    // The panel reports damage without exposing filesystem paths.
                }
            }
            $plans = array_values(array_filter(
                scandir($this->root . '/staging'),
                fn($name) => preg_match('/\A[0-9a-f]{32}\z/D', $name) === 1,
            ));
            $last = null;
            if ($state !== null && $state['lastOperation'] !== null && !$pending) {
                $last = $this->metadata($this->root . '/logs/' . $state['lastOperation'] . '.json');
            }
            return compact('state', 'pending', 'healthy', 'plans', 'last');
        }, false);
    }

    /** Revalidate a plan for display; apply still performs its own checks under lock. */
    public function preview(string $id): array
    {
        return $this->locked(function () use ($id): array {
            $this->id($id);
            ensure(!file_exists($this->root . '/transaction.json'), 'RECOVERY: recover first');
            $state = $this->state();
            $stage = $this->root . '/staging/' . $id;
            $plan = $this->metadata($stage . '/plan.json');
            ensure(
                array_keys($plan) === ['formatVersion', 'id', 'base', 'candidate', 'packageHash', 'createdAt', 'diff']
                && $plan['formatVersion'] === 1 && $plan['id'] === $id
                && $plan['base'] === $state['active'],
                'PLAN: invalid or stale plan',
            );
            $this->checkDescriptor($plan['candidate']);
            $package = new Package($stage . '/package.zip', $this->limits);
            $after = $this->verify($stage . '/release', $plan['candidate']);
            $before = $this->verify($this->target, $state['active']);
            ensure(
                $plan['packageHash'] === $package->hash
                && $after['id'] === $package->manifestHash
                && $plan['diff'] === $this->diff($before, $after),
                'HASH: prepared files changed',
            );
            return $plan + [
                'archiveBytes' => filesize($stage . '/package.zip'),
                'engineSchemaVersion' => $package->manifest->engineSchemaVersion,
            ];
        }, false);
    }

    public function status(): array
    {
        return $this->locked(function (): array {
            $state = $this->state();
            $this->verify($this->target, $state['active']);
            $ids = fn(string $directory): array => array_values(
                array_filter(
                    scandir($this->root . '/' . $directory),
                    fn($name) => preg_match('/\A[0-9a-f]{32}\z/D', $name) === 1,
                ),
            );
            return [
                'state' => $state,
                'plans' => $ids('staging'),
                'orphanSwitches' => $ids('switch'),
            ];
        });
    }

    public function recover(): array
    {
        return $this->locked(fn() => $this->state());
    }

    private function diff(?array $before, array $after): array
    {
        $old = $before['files'] ?? [];
        $new = $after['files'];
        $changed = [];
        foreach (array_intersect(array_keys($old), array_keys($new)) as $name) {
            if ($old[$name]->sha256 !== $new[$name]->sha256) {
                $changed[] = $name;
            }
        }
        $diff = [
            'added' => array_values(
                array_diff(array_keys($new), array_keys($old)),
            ),
            'changed' => $changed,
            'removed' => array_values(
                array_diff(array_keys($old), array_keys($new)),
            ),
        ];
        foreach ($diff as &$paths) {
            sort($paths);
        }
        return $diff;
    }

    public function prepare(string $archive): array
    {
        return $this->locked(function () use ($archive): array {
            $state = $this->state();
            $before = $this->verify($this->target, $state['active']);
            $package = new Package($archive, $this->limits);
            $this->space(
                filesize($archive) +
                    $package->expandedBytes() +
                    $this->limits['maxMetadataBytes'],
            );
            $id = bin2hex(random_bytes(16));
            $stage = $this->root . '/staging/' . $id;
            makeDirectory($stage);
            try {
                $raw = readBounded($archive, $this->limits['maxArchiveBytes']);
                ensure(
                    hash('sha256', $raw) === $package->hash,
                    'HASH: source ZIP changed during preparation',
                );
                writeFile($stage . '/package.zip', $raw);
                $candidate = $package->extract($stage . '/release');
                $descriptor = $this->descriptor($candidate);
                if (
                    $state['active'] !== null &&
                    $state['active']['version'] === $descriptor['version']
                ) {
                    ensure(
                        $state['active'] === $descriptor,
                        'VERSION: same version has different content',
                    );
                    removeTree($stage);
                    return [
                        'status' => 'unchanged',
                        'active' => $descriptor,
                        'packageHash' => $package->hash,
                    ];
                }
                ensure(
                    $state['active'] === null ||
                        version($descriptor['version']) >
                            version($state['active']['version']),
                    'VERSION: downgrade requires rollback',
                );
                // A retained release version cannot acquire a new identity after rollback.
                foreach (scandir($this->root . '/releases') as $releaseId) {
                    if ($releaseId === '.' || $releaseId === '..') {
                        continue;
                    }
                    $this->id($releaseId, 64);
                    $retained = Package::verifyDirectory(
                        $this->root . '/releases/' . $releaseId,
                        $this->limits,
                    );
                    ensure(
                        $retained['version'] !== $descriptor['version'] ||
                            $retained['id'] === $descriptor['id'],
                        'VERSION: retained version has different content',
                    );
                }
                $plan = [
                    'formatVersion' => 1,
                    'id' => $id,
                    'base' => $state['active'],
                    'candidate' => $descriptor,
                    'packageHash' => $package->hash,
                    'createdAt' => gmdate('c'),
                    'diff' => $this->diff($before, $candidate),
                ];
                atomicJson($stage . '/plan.json', $plan);
                syncDirectory($stage);
                $this->point('prepared');
                return $plan;
            } catch (\Throwable $error) {
                removeTree($stage);
                throw $error;
            }
        });
    }

    public function apply(string $id, string $packageHash): array
    {
        return $this->locked(function () use ($id, $packageHash): array {
            $this->id($id);
            $this->id($packageHash, 64);
            $state = $this->state();
            $stage = $this->root . '/staging/' . $id;
            // A repeated confirmation after a committed operation is harmless.
            $receipt = $this->root . '/logs/' . $id . '.json';
            if (!is_dir($stage) && is_file($receipt)) {
                $record = $this->metadata($receipt);
                ensure(
                    $record['packageHash'] === $packageHash &&
                        $record['result'] === 'committed' &&
                        $record['to'] === $state['active'],
                    'PLAN: completed plan no longer matches active release',
                );
                $this->verify($this->target, $state['active']);
                return ['status' => 'unchanged', 'state' => $state];
            }
            $plan = $this->metadata($stage . '/plan.json');
            ensure(
                array_keys($plan) === [
                    'formatVersion',
                    'id',
                    'base',
                    'candidate',
                    'packageHash',
                    'createdAt',
                    'diff',
                ] &&
                    $plan['formatVersion'] === 1 &&
                    $plan['id'] === $id,
                'PLAN: invalid plan',
            );
            ensure(
                $plan['base'] === $state['active'],
                'PLAN: active release changed; prepare again',
            );
            ensure(
                $plan['packageHash'] === $packageHash,
                'PLAN: explicit package hash confirmation required',
            );
            $package = new Package($stage . '/package.zip', $this->limits);
            ensure(
                $package->hash === $packageHash,
                'HASH: prepared ZIP changed',
            );
            $this->checkDescriptor($plan['candidate']);
            $release = $this->releasePath($plan['candidate']);
            $source = is_dir($stage . '/release')
                ? $stage . '/release'
                : $release;
            $candidate = $this->verify($source, $plan['candidate']);
            ensure(
                $candidate['id'] === $package->manifestHash,
                'HASH: staging manifest differs from package',
            );
            ensure(
                $state['active'] === null ||
                    version($candidate['version']) >
                        version($state['active']['version']),
                'VERSION: install must advance version',
            );
            // Bind the staged tree to the validated ZIP, not just editable plan metadata.
            $expectedFiles = Package::manifestFiles(
                $package->manifest,
                $this->limits,
            );
            ensure(
                json_encode($expectedFiles) ===
                    json_encode($candidate['files']),
                'HASH: staging differs from package',
            );
            $before = $this->verify($this->target, $state['active']);
            ensure(
                $this->diff($before, $candidate) === $plan['diff'],
                'PLAN: preview changed',
            );
            if (!is_dir($release)) {
                ensure(
                    rename($source, $release),
                    'FILESYSTEM: cannot publish release',
                );
                syncDirectory(dirname($release));
            }
            $this->verify($release, $plan['candidate']);
            $this->point('release-published');
            return $this->switchRelease(
                $state,
                $plan['candidate'],
                $id,
                $packageHash,
                'install',
            );
        });
    }

    public function rollback(
        string $expectedActive,
        string $expectedPrevious,
    ): array {
        return $this->locked(function () use (
            $expectedActive,
            $expectedPrevious,
        ): array {
            $state = $this->state();
            if (
                $state['active'] !== null &&
                $state['previous'] !== null &&
                $state['active']['id'] === $expectedPrevious &&
                $state['previous']['id'] === $expectedActive &&
                $state['lastOperation'] !== null
            ) {
                $receipt = $this->metadata(
                    $this->root . '/logs/' . $state['lastOperation'] . '.json',
                );
                if (
                    $receipt['kind'] === 'rollback' &&
                    $receipt['result'] === 'committed'
                ) {
                    $this->verify($this->target, $state['active']);
                    return ['status' => 'unchanged', 'state' => $state];
                }
            }
            ensure(
                $state['active'] !== null &&
                    $state['previous'] !== null &&
                    $state['active']['id'] === $expectedActive &&
                    $state['previous']['id'] === $expectedPrevious,
                'ROLLBACK: confirm current and previous release IDs from status',
            );
            return $this->switchRelease(
                $state,
                $state['previous'],
                bin2hex(random_bytes(16)),
                null,
                'rollback',
            );
        });
    }

    private function move(string $from, string $to): void
    {
        noLinks($from);
        noLinks($to);
        ensure(
            !file_exists($to) && rename($from, $to),
            'FILESYSTEM: release rename failed',
        );
        syncDirectory(dirname($from));
        syncDirectory(dirname($to));
    }

    private function refreshDates(int $epoch): void
    {
        foreach (treeFiles($this->target) as $name => $_stat) {
            ensure(
                touch($this->target . '/' . $name, $epoch),
                'FILESYSTEM: cannot set activation date',
            );
        }
    }

    private function switchRelease(
        array $state,
        array $candidate,
        string $id,
        ?string $packageHash,
        string $kind,
    ): array {
        $before = $this->verify($this->target, $state['active']);
        if ($state['active'] !== null) {
            $this->verify(
                $this->releasePath($state['active']),
                $state['active'],
            );
        }
        $this->verify($this->releasePath($candidate), $candidate);
        $switch = $this->root . '/switch/' . $id;
        // An earlier process may have died before the intent was written.
        removeTree($switch);
        $this->space($candidate['bytes'] + 32768);
        makeDirectory($switch);
        copyTree($this->releasePath($candidate), $switch . '/next');
        $this->verify($switch . '/next', $candidate);
        $this->point('switch-prepared');
        $transaction = [
            'formatVersion' => 1,
            'id' => $id,
            'kind' => $kind,
            'oldState' => $state,
            'to' => $candidate,
            'packageHash' => $packageHash,
            'epoch' => max(time(), ($before['mtime'] ?? 0) + 2),
        ];
        atomicJson($this->root . '/transaction.json', $transaction);
        try {
            $this->point('intent-written');
            if (file_exists($this->target)) {
                $this->move($this->target, $switch . '/old');
            }
            $this->point('old-moved');
            $this->move($switch . '/next', $this->target);
            $this->refreshDates($transaction['epoch']);
            $this->point('new-moved');
            $this->verify($this->target, $candidate);
            $this->point('health-checked');
            $newState = [
                'formatVersion' => 1,
                'target' => $this->target,
                'active' => $candidate,
                'previous' => $state['active'],
                'lastOperation' => $id,
            ];
            atomicJson($this->root . '/state.json', $newState);
            $this->point('state-written');
            $this->finish($transaction, 'committed');
            return ['status' => 'committed', 'state' => $newState];
        } catch (\Throwable $error) {
            // If recovery fails too, keep the intent and all recoverable files.
            if (file_exists($this->root . '/transaction.json')) {
                $this->recoverLocked();
            }
            throw $error;
        }
    }

    private function transaction(): array
    {
        $transaction = $this->metadata($this->root . '/transaction.json');
        ensure(
            array_keys($transaction) === [
                'formatVersion',
                'id',
                'kind',
                'oldState',
                'to',
                'packageHash',
                'epoch',
            ] &&
                $transaction['formatVersion'] === 1 &&
                in_array($transaction['kind'], ['install', 'rollback'], true),
            'STATE: invalid transaction',
        );
        $this->id($transaction['id']);
        $this->checkState($transaction['oldState']);
        $this->checkDescriptor($transaction['to']);
        ensure(
            $transaction['to'] !== null &&
                is_int($transaction['epoch']) &&
                $transaction['epoch'] > 0,
            'STATE: invalid transaction target',
        );
        if ($transaction['packageHash'] !== null) {
            $this->id($transaction['packageHash'], 64);
        }
        return $transaction;
    }

    private function recoverLocked(): void
    {
        $transaction = $this->transaction();
        $state = $this->state();
        $oldState = $transaction['oldState'];
        $committed =
            $state['lastOperation'] === $transaction['id'] &&
            $state['active'] === $transaction['to'] &&
            $state['previous'] === $oldState['active'];
        ensure(
            $committed || $state === $oldState,
            'STATE: transaction does not match installation',
        );
        if ($committed) {
            try {
                $this->verify($this->target, $transaction['to']);
                $this->finish($transaction, 'committed');
                return;
            } catch (UpdateError $error) {
                // A failed post-commit integrity check still restores the old snapshot.
            }
        }
        $switch = $this->root . '/switch/' . $transaction['id'];
        makeDirectory($switch);
        $old = $oldState['active'];
        if ($old !== null) {
            $this->verify($this->releasePath($old), $old);
            try {
                $this->verify($this->target, $old);
                $alreadyRestored = true;
            } catch (UpdateError $error) {
                $alreadyRestored = false;
            }
            if (!$alreadyRestored) {
                $restored = $switch . '/old';
                if (!is_dir($restored)) {
                    $restored = $switch . '/restore';
                    removeTree($restored);
                    $this->space($old['bytes'] + 8192);
                    copyTree($this->releasePath($old), $restored);
                }
                $this->verify($restored, $old);
                // Retain a failed candidate until the old release is available again.
                if (file_exists($this->target)) {
                    $failed = $switch . '/failed-' . bin2hex(random_bytes(8));
                    $this->move($this->target, $failed);
                }
                $this->move($restored, $this->target);
            }
            $this->refreshDates(max(time(), $transaction['epoch'] + 2));
        } elseif (file_exists($this->target)) {
            $this->move(
                $this->target,
                $switch . '/failed-' . bin2hex(random_bytes(8)),
            );
        }
        $this->point('recovery-restored');
        atomicJson($this->root . '/state.json', $oldState);
        $this->point('recovery-state-written');
        $this->finish($transaction, 'rolled-back');
    }

    private function finish(array $transaction, string $result): void
    {
        $id = $transaction['id'];
        atomicJson($this->root . '/logs/' . $id . '.json', [
            'operation' => $id,
            'time' => gmdate('c'),
            'kind' => $transaction['kind'],
            'from' => $transaction['oldState']['active'],
            'to' => $transaction['to'],
            'packageHash' => $transaction['packageHash'],
            'result' => $result,
        ]);
        $this->point('receipt-written');
        // Keep the recovery journal until destructive cleanup has completed.
        removeTree($this->root . '/switch/' . $id);
        if ($result === 'committed' && $transaction['kind'] === 'install') {
            removeTree($this->root . '/staging/' . $id);
        }
        ensure(
            unlink($this->root . '/transaction.json'),
            'FILESYSTEM: cannot finish transaction',
        );
        syncDirectory($this->root);
        $this->point('finished');
    }

    public function discard(string $id): array
    {
        return $this->locked(function () use ($id): array {
            $this->id($id);
            removeTree($this->root . '/staging/' . $id);
            removeTree($this->root . '/switch/' . $id);
            return ['discarded' => $id];
        });
    }

    public function prune(): array
    {
        return $this->locked(function (): array {
            $state = $this->state();
            $this->verify($this->target, $state['active']);
            $keep = [];
            foreach ([$state['active'], $state['previous']] as $release) {
                if ($release !== null) {
                    $this->verify($this->releasePath($release), $release);
                    $keep[$release['id']] = true;
                }
            }
            foreach (scandir($this->root . '/staging') as $id) {
                if ($id === '.' || $id === '..') {
                    continue;
                }
                $this->id($id);
                $planPath = $this->root . '/staging/' . $id . '/plan.json';
                ensure(
                    is_file($planPath),
                    'PLAN: discard incomplete staging before pruning',
                );
                $plan = $this->metadata($planPath);
                $this->checkDescriptor($plan['candidate']);
                $keep[$plan['candidate']['id']] = true;
            }
            $removed = [];
            foreach (scandir($this->root . '/releases') as $id) {
                if ($id === '.' || $id === '..') {
                    continue;
                }
                $this->id($id, 64);
                if (!isset($keep[$id])) {
                    removeTree($this->root . '/releases/' . $id);
                    $removed[] = $id;
                }
            }
            $switches = [];
            foreach (scandir($this->root . '/switch') as $id) {
                if ($id !== '.' && $id !== '..') {
                    $this->id($id);
                    removeTree($this->root . '/switch/' . $id);
                    $switches[] = $id;
                }
            }
            return [
                'removed' => $removed,
                'kept' => array_keys($keep),
                'orphanSwitchesRemoved' => $switches,
            ];
        });
    }
}
