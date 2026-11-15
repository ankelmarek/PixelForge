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
    ensure(count($argv) === 4 || count($argv) === 5, 'USAGE: php panel-setup.php UPDATER_CONFIG HTTPS_ORIGIN USERNAME [panel-slug]; password on stdin');
    $configPath = $argv[1];
    $origin = PanelConfig::origin($argv[2]);
    $username = $argv[3];
    $slug = $argv[4] ?? 'pixelforge-admin';
    ensure(preg_match('/\A[a-z0-9][a-z0-9-]{2,47}\z/D', $slug) === 1, 'CONFIG: invalid panel slug');
    ensure(preg_match('/\A[A-Za-z0-9_.-]{3,64}\z/D', $username) === 1, 'CONFIG: invalid username');
    $config = PanelConfig::read($configPath);
    $updater = new Updater($config);
    PanelConfig::outside($configPath, $config['documentRoot']);
    PanelConfig::outside(__DIR__, $config['documentRoot']);
    $public = $config['documentRoot'] . '/' . $slug;
    noLinks($public);
    ensure($public !== $config['target'] && !file_exists($public), 'CONFIG: new panel directory required');
    $directory = $config['privateRoot'] . '/panel';
    $panelConfig = $directory . '/config.json';
    ensure(!file_exists($panelConfig) && !is_link($panelConfig), 'CONFIG: panel already configured');
    // Read a secret from stdin, never from argv or an HTTP setup page.
    $line = fgets(STDIN, 75);
    ensure($line !== false && feof(STDIN), 'PASSWORD: provide one password through stdin without a trailing newline');
    $hash = PanelConfig::password($line);
    unset($line);
    $updater->doctor();
    makeDirectory($directory);
    writeFile($panelConfig, json_encode([
        'formatVersion' => 1,
        'updaterConfig' => $configPath,
        'origin' => $origin,
        'panelPath' => '/' . $slug . '/',
        'username' => $username,
        'passwordHash' => $hash,
        'instanceKey' => bin2hex(random_bytes(32)),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
    new PanelConfig($panelConfig);
    makeDirectory($public, 0755);
    chmod($public, 0755);
    $bootstrap = "<?php\ndeclare(strict_types=1);\nini_set('display_errors', '0');\ntry {\n    require "
        . var_export(__DIR__ . '/src/Panel.php', true) . ";\n    \\PixelForge\\Updater\\Panel::serve("
        . var_export($panelConfig, true) . ");\n} catch (\\Throwable \$error) {\n    http_response_code(503);\n"
        . "    header('Cache-Control: no-store');\n    echo 'PixelForge: panel niedostepny. Sprawdz konfiguracje.';\n}\n";
    writeFile($public . '/index.php', $bootstrap, 0644);
    echo json_encode(['url' => $origin . '/' . $slug . '/index.php', 'config' => $panelConfig], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
} catch (\Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(2);
}
