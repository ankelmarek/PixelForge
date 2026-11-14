<?php
declare(strict_types=1);
ini_set('display_errors', '0');
try {
    $config = dirname(__DIR__) . '/_pixelforge/data/panel/config.json';
    if (!is_file($config)) {
        header('Location: /setup.php', true, 302);
        exit();
    }
    require dirname(__DIR__) . '/_pixelforge/tool/src/Panel.php';
    \PixelForge\Updater\Panel::serve($config);
} catch (\Throwable $error) {
    http_response_code(503);
    header('Cache-Control: no-store');
    echo 'PixelForge: panel niedostepny. Sprawdz konfiguracje.';
}
