<?php
declare(strict_types=1);

namespace PixelForge\Updater;

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/src/PanelConfig.php';

umask(0077);
try {
    ensure(count($argv) === 2, 'USAGE: php panel-password.php PRIVATE_PANEL_CONFIG; new password on stdin');
    $config = new PanelConfig($argv[1]);
    $line = fgets(STDIN, 75);
    ensure($line !== false && feof(STDIN), 'PASSWORD: provide one password through stdin without a trailing newline');
    $data = $config->data;
    $data['passwordHash'] = PanelConfig::password($line);
    $data['instanceKey'] = bin2hex(random_bytes(32));
    unset($line);
    atomicJson($argv[1], $data);
    echo "Password changed. Existing sessions revoked.\n";
} catch (\Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(2);
}
