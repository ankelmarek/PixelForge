<?php
declare(strict_types=1);

// U1 exposes no HTTP endpoint. U2 will add an independently authenticated panel.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit();
}
require_once __DIR__ . '/src/Updater.php';

use PixelForge\Updater\Package;
use PixelForge\Updater\Updater;
use function PixelForge\Updater\ensure;
use function PixelForge\Updater\jsonDocument;
use function PixelForge\Updater\readBounded;

umask(0077);
try {
    $command = $argv[1] ?? '';
    if ($command === 'help' || $command === '--help') {
        echo "PixelForge U1 — PHP 8.2+ / ZipArchive / local administrator\n";
        echo "php cli.php validate PACKAGE.zip\n";
        echo "php cli.php doctor|init|status|recover|prune CONFIG.json\n";
        echo "php cli.php prepare CONFIG.json PACKAGE.zip\n";
        echo "php cli.php apply CONFIG.json PLAN_ID PACKAGE_SHA256\n";
        echo "php cli.php rollback CONFIG.json ACTIVE_ID PREVIOUS_ID\n";
        echo "php cli.php discard CONFIG.json PLAN_ID\n";
        exit(0);
    }
    $absolute = static fn(string $path): string => str_starts_with($path, '/')
        ? $path
        : getcwd() . '/' . $path;
    if ($command === 'validate') {
        ensure($argc === 3, 'USAGE: validate PACKAGE.zip');
        $package = new Package($absolute($argv[2]), Package::limits());
        $result = [
            'valid' => true,
            'releaseVersion' => $package->manifest->releaseVersion,
            'sha256' => $package->hash,
        ];
    } else {
        $counts = [
            'doctor' => 3,
            'init' => 3,
            'status' => 3,
            'recover' => 3,
            'prune' => 3,
            'prepare' => 4,
            'apply' => 5,
            'rollback' => 5,
            'discard' => 4,
        ];
        ensure(
            isset($counts[$command]) && $argc === $counts[$command],
            'USAGE: php cli.php help',
        );
        $raw = readBounded($absolute($argv[2]), 65536);
        ensure(
            jsonDocument($raw) instanceof stdClass,
            'CONFIG: object required',
        );
        $updater = new Updater(
            json_decode($raw, true, 64, JSON_THROW_ON_ERROR),
        );
        $result = match ($command) {
            'prepare' => $updater->prepare($absolute($argv[3])),
            'apply' => $updater->apply($argv[3], $argv[4]),
            'rollback' => $updater->rollback($argv[3], $argv[4]),
            'discard' => $updater->discard($argv[3]),
            default => $updater->$command(),
        };
    }
    echo json_encode(
    $result,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
),
        "\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Updater rejected: ' . $error->getMessage() . "\n");
    exit(2);
}
