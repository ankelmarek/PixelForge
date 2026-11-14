<?php
declare(strict_types=1);
ini_set('display_errors', '0');
try {
    require __DIR__ . '/_pixelforge/tool/src/HostingSetup.php';
    \PixelForge\Updater\HostingSetup::serve(__DIR__);
} catch (\Throwable $error) {
    http_response_code(503);
    header('Cache-Control: no-store');
    echo 'PixelForge: niekompletna paczka instalacyjna.';
}
