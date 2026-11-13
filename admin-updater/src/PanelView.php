<?php
declare(strict_types=1);

namespace PixelForge\Updater;

/** Server-rendered HTML: the update flow works without JavaScript. */
final class PanelView
{
    private static function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function size(int $bytes): string
    {
        return number_format($bytes / 1048576, 2, ',', ' ') . ' MiB';
    }

    private static function form(string $action, string $csrf, string $body, array $fields = [], bool $upload = false): string
    {
        $html = '<form method="post" action="./index.php"' . ($upload ? ' enctype="multipart/form-data" data-upload' : '') . '>';
        foreach (['action' => $action, 'csrf' => $csrf] + $fields as $name => $value) {
            $html .= '<input type="hidden" name="' . self::e($name) . '" value="' . self::e($value) . '">';
        }
        return $html . $body . '</form>';
    }

    private static function page(string $title, string $body, string $navigation = ''): void
    {
        echo '<!doctype html><html lang="pl"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            . '<meta name="color-scheme" content="dark"><title>' . self::e($title) . ' · PixelForge</title>'
            . '<link rel="stylesheet" href="./index.php?asset=css"><script defer src="./index.php?asset=js"></script></head>'
            . '<body><a class="skip" href="#main">Przejdź do treści</a><header class="topbar">'
            . '<a class="brand" href="./index.php"><span class="mark" aria-hidden="true"></span>PixelForge<span class="badge">Aktualizacje</span></a>'
            . $navigation . '</header><main id="main">' . $body . '</main>'
            . '<footer>Panel administracyjny · U2 1.2.0</footer></body></html>';
    }

    public static function error(string $message): void
    {
        self::page('Operacja zatrzymana', '<section class="card narrow"><p class="eyebrow">PixelForge</p>'
            . '<h1>Operacja zatrzymana</h1><p role="alert">' . self::e($message) . '</p>'
            . '<a class="button" href="./index.php">Wróć do panelu</a></section>');
    }

    public static function login(string $csrf): void
    {
        $form = self::form('login', $csrf,
            '<label for="username">Login administratora</label><input id="username" name="username" autocomplete="username" maxlength="64" required autofocus>'
            . '<label for="password">Hasło</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="72" required>'
            . '<button type="submit">Zaloguj się</button>');
        self::page('Logowanie', '<section class="card narrow"><p class="eyebrow">Twoje wydania pod kontrolą</p>'
            . '<h1>Panel aktualizacji</h1><p class="muted">Zaloguj się, aby sprawdzić paczkę i zarządzać wersjami PixelForge.</p>' . $form . '</section>');
    }

    public static function dashboard(PanelConfig $config, string $csrf, array $snapshot, ?array $plan, bool $rollback, ?string $notice, int $limit): void
    {
        $navigation = '<nav aria-label="Administrator"><span>' . self::e($config->data['username']) . '</span>'
            . self::form('logout', $csrf, '<button class="quiet" type="submit">Wyloguj</button>') . '</nav>';
        $state = $snapshot['state'];
        $active = $state['active'] ?? null;
        $previous = $state['previous'] ?? null;
        $body = '<div class="heading"><div><p class="eyebrow">Centrum wydań</p><h1>Aktualizacje PixelForge</h1></div>'
            . '<a class="button secondary" href="' . self::e($config->gameUrl()) . '" target="_blank" rel="noopener noreferrer">Sprawdź grę ↗</a></div>';
        if ($notice !== null) {
            $body .= '<p class="notice success" role="status">' . self::e($notice) . '</p>';
        }
        $body .= '<div class="stats"><section class="card"><h2>Aktywne wydanie</h2><p class="version" data-active>'
            . self::e($active['version'] ?? 'Brak') . '</p><p class="muted">Statyczna aplikacja PixelForge</p></section>'
            . '<section class="card"><h2>Punkt przywracania</h2><p class="version" data-previous>'
            . self::e($previous['version'] ?? 'Brak') . '</p><p class="muted">Poprzednie wydanie</p></section>'
            . '<section class="card"><h2>Ostatnia zmiana</h2><p class="date">' . self::e($snapshot['last']['time'] ?? 'Jeszcze nie instalowano')
            . '</p><p class="muted">Czas UTC · dziennik prywatny</p></section></div>';
        if ($snapshot['pending']) {
            $body .= '<section class="card"><h2>Przerwana operacja</h2><p class="notice" role="alert">'
                . 'Wykryto niedokończoną zmianę wersji. Gra może być niedostępna. Odzyskaj spójny stan przed kolejną aktualizacją.</p>'
                . self::form('recover', $csrf, '<button type="submit">Odzyskaj przerwaną operację</button>') . '</section>';
        } elseif ($state === null) {
            $body .= '<section class="card"><h2>Połącz instalację</h2><p>Sprawdzimy obecne pliki gry i utworzymy prywatną kopię. '
                . 'Katalog musi być pusty albo zawierać kompletne wydanie z manifest.json. Obce pliki zatrzymają operację.</p>'
                . self::form('init', $csrf, '<button type="submit">Sprawdź i zarejestruj instalację</button>') . '</section>';
        } elseif (!$snapshot['healthy']) {
            $body .= '<section class="card"><h2>Pliki wymagają sprawdzenia</h2><p class="notice" role="alert">'
                . 'Aktywna instalacja nie odpowiada zapisanej wersji. Wstrzymano aktualizacje. Sprawdź pliki i diagnostykę CLI.</p></section>';
        } elseif ($plan !== null) {
            $body .= self::review($csrf, $plan);
        } elseif ($rollback && $previous !== null) {
            $body .= '<section class="card"><p class="eyebrow">Przywracanie</p><h2>' . self::e($active['version']) . ' → '
                . self::e($previous['version']) . '</h2><p>Przywrócimy sprawdzoną kopię poprzedniego wydania pod tym samym adresem. '
                . 'Zapisy przeglądarki nie są usuwane przez instalator.</p>' . self::availability()
                . self::form('rollback', $csrf, '<div class="actions"><button type="submit">Potwierdź przywrócenie</button>'
                    . '<a href="./index.php">Anuluj</a></div>', ['active' => $active['id'], 'previous' => $previous['id']]) . '</section>';
        } else {
            $body .= '<section class="card"><p class="eyebrow">01 / Sprawdzenie paczki</p><h2>Wgraj nowe wydanie</h2>'
                . '<p>Wybierz pełny ZIP PixelForge. Najpierw pokażemy wersję i listę zmian.</p>'
                . self::form('upload', $csrf, '<div class="dropzone" data-drop><label for="package">Wybierz ZIP lub przeciągnij go tutaj</label>'
                    . '<input id="package" type="file" name="package" accept=".zip,application/zip" required aria-describedby="upload-limit">'
                    . '<p id="upload-limit" class="muted">Limit tego serwera: ' . self::size($limit) . '.</p></div>'
                    . '<button type="submit">Sprawdź pakiet</button><p class="muted" data-progress role="status"></p>', [], true) . '</section>';
            if ($previous !== null) {
                $body .= '<section class="card compact"><div><h2>Powrót do poprzedniej wersji</h2><p>Wersja '
                    . self::e($previous['version']) . ' jest zachowana w prywatnej kopii.</p></div>'
                    . '<a class="button secondary" href="./index.php?rollback=1">Przywróć poprzednią wersję</a></section>';
            }
        }
        if (!$snapshot['pending'] && $state !== null) {
            $body .= '<section class="card"><h2>Przygotowane plany</h2>';
            if ($snapshot['plans'] === []) {
                $body .= '<p class="muted">Brak oczekujących paczek.</p>';
            }
            foreach ($snapshot['plans'] as $id) {
                $body .= '<div class="plan-row"><a href="./index.php?plan=' . self::e($id) . '">Podgląd planu '
                    . self::e(substr($id, 0, 8)) . '</a>'
                    . self::form('discard', $csrf, '<button class="quiet" type="submit">Usuń plan</button>', ['plan' => $id]) . '</div>';
            }
            $body .= '<details><summary>Porządkowanie wydań</summary><p>Usuń nieużywane kopie. Aktywna wersja, poprzednia '
                . 'i wydania z oczekujących planów zostaną zachowane.</p>'
                . self::form('prune', $csrf, '<button class="secondary" type="submit">Usuń nieużywane wydania</button>') . '</details></section>';
        }
        self::page('Aktualizacje', $body, $navigation);
    }

    private static function availability(): string
    {
        return '<p class="notice">Podczas przełączania wystąpi krótka przerwa dostępności gry. '
            . 'Jeśli proces zostanie przerwany, wróć do panelu i wybierz odzyskiwanie.</p>';
    }

    private static function review(string $csrf, array $plan): string
    {
        $body = '<section class="card"><p class="eyebrow">02 / Podgląd przed instalacją</p><h2>'
            . self::e($plan['base']['version'] ?? 'Pierwsza instalacja') . ' → ' . self::e($plan['candidate']['version']) . '</h2>'
            . '<p>ZIP: ' . self::size($plan['archiveBytes']) . ' · Pliki: ' . self::size($plan['candidate']['bytes'])
            . ' · Kontrakt silnika: ' . self::e($plan['engineSchemaVersion']) . '</p>';
        foreach (['added' => 'Dodawane', 'changed' => 'Zmieniane', 'removed' => 'Usuwane'] as $key => $label) {
            $body .= '<details class="changes" open><summary>' . $label . ' <span class="count">'
                . count($plan['diff'][$key]) . '</span></summary><ul class="files">';
            foreach ($plan['diff'][$key] as $path) {
                $body .= '<li>' . self::e($path) . '</li>';
            }
            $body .= '</ul></details>';
        }
        $body .= '<p class="muted">Manifest wydania zostanie podmieniony razem z plikami.</p><details><summary>SHA-256 paczki</summary>'
            . '<code class="hash">' . self::e($plan['packageHash']) . '</code><p class="muted">'
            . 'Suma potwierdza integralność. Instaluj paczki z zaufanego źródła.</p></details>' . self::availability()
            . self::form('apply', $csrf, '<div class="actions"><button type="submit">Zainstaluj wydanie '
                . self::e($plan['candidate']['version']) . '</button><a href="./index.php">Wróć bez instalacji</a></div>',
                ['plan' => $plan['id'], 'hash' => $plan['packageHash']]) . '</section>';
        return $body;
    }
}
