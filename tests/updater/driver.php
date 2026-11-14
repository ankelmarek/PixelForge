<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit();
}
require_once __DIR__ . '/../../admin-updater/src/Updater.php';

use PixelForge\Updater\Package;
use PixelForge\Updater\Updater;
use PixelForge\Updater\UpdateError;
use function PixelForge\Updater\ensure;

umask(0077);
try {
    if ($argv[1] === 'validate') {
        $options = json_decode($argv[3], true, 64, JSON_THROW_ON_ERROR);
        $package = new Package(
            $argv[2],
            Package::limits($options['overrides'] ?? []),
        );
        ensure(
            !isset($options['expected_version']) ||
                $package->manifest->releaseVersion ===
                    $options['expected_version'],
            'VERSION: mismatch',
        );
        echo json_encode(['valid' => true]), "\n";
        exit();
    }
    $config = json_decode(
        file_get_contents($argv[2]),
        true,
        64,
        JSON_THROW_ON_ERROR,
    );
    $point = $argv[3];
    $mode = $argv[4];
    $checkpoint = static function (string $name) use (
        $point,
        $mode,
        $config,
    ): void {
        if ($name !== $point) {
            return;
        }
        if ($mode === 'throw') {
            throw new UpdateError('FAULT: simulated interruption');
        }
        if ($mode === 'corrupt') {
            file_put_contents($config['target'] . '/assets/app.js', 'corrupt');
            return;
        }
        echo json_encode(['checkpoint' => $name]), "\n";
        fflush(STDOUT);
        while (true) {
            usleep(100000);
        }
    };
    $updater = new Updater($config, $checkpoint);
    $result = $updater->{$argv[1]}(...array_slice($argv, 5));
    echo json_encode($result), "\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Updater rejected: ' . $error->getMessage() . "\n");
    exit(2);
}
