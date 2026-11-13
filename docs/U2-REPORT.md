# U2 — uwierzytelniony panel aktualizacji ZIP

**Status: weryfikacja w toku.** Gałąź `feature/p2-u2-admin-panel` / PR #9,
baza U1 `95f310e` / PR #8. Runtime gry pozostaje 0.6.1.

## Zakres

PHP 8.2+ bez SQL i dodatkowych bibliotek runtime. Jednorazowy konfigurator CLI
tworzy prywatny hash hasła oraz jeden publiczny bootstrap. Panel obsługuje
logowanie, upload full ZIP, walidację, listy zmian, osobne zatwierdzenie,
wynik, rollback, rejestrację istniejącej instalacji, recovery i sprzątanie.

U1 pozostaje mechanizmem instalacji. Dodane odczyty `inspect` i `preview`
nie wywołują recovery ani nie przełączają gry przy GET. Operacje zapisu wymagają
POST, sesji administratora, tokenu CSRF i zgodnego Origin.

## Zabezpieczenia i granice

- HTTPS i kanoniczny Host; brak zaufania do nagłówków forwarded klienta.
- Cookie Secure/HttpOnly/SameSite Strict, rotacja ID i CSRF, wygaśnięcie
  po 30 minutach bezczynności / 8 godzinach; reset hasła unieważnia sesje.
- Trwały limit 5 prób logowania/IP i 20 globalnie na 15 minut.
- Nazwa uploadu od użytkownika nie jest ścieżką. Prywatny losowy plik,
  limit rozmiaru, budżet miejsca, sprzątanie i walidator U1.
- Kod panelu, sesje, logi i konfiguracja są poza paczką gry; publiczny jest
  wyłącznie wygenerowany index.php. Brak publicznego setupu i domyślnego hasła.
- CSP, brak cache stron panelu, kontrola błędów bez ścieżek/sekretów w odpowiedzi.

Fallback U1 zachowuje krótkie okno HTTP 404 między rename. Po SIGKILL w tym
oknie potrzebne jest jawne recovery. Kontrola zdrowia PHP sprawdza integralność,
nie logikę gameplayu. Na jednym originie publikowany JavaScript musi być zaufany;
podpisy i separacja domen nie są częścią U2.

## Testy

Terminal środowiska roboczego w tej sesji jest niedostępny. Kontrole są wykonywane
przez GitHub Actions, w jednorazowym runnerze bez sekretów hostingu i bez wdrożenia.
Testy HTTP używają prawdziwego PHP, multipart i lokalnego TLS z jawnym zaufaniem
do testowego CA. Test przeglądarkowy obejmuje komputer, emulację Pixel 7,
brak JavaScript, upload/podgląd/instalację/rollback oraz zachowanie zapisu Atlasu.

Wynik końcowy zostanie uzupełniony po wszystkich kontrolach. Nie uznawać tej
roboczej wersji za gotową paczkę do wdrożenia.

## Uruchomienie

[Instrukcja panelu i CLI](../admin-updater/README.md). Pierwsza konfiguracja
wymaga prywatnych ścieżek konta i SSH; codzienne aktualizacje są webowe.
Nie wdrażano panelu na rozumisie.pl, nie testowano PHP-FPM konkretnego konta,
fizycznego telefonu ani innych silników przeglądarek. PR nie został scalony.
U3 oraz nowe gry P3 pozostają poza zakresem.
