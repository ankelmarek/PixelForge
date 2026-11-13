# U2 — cały PixelForge w public_html

Data: 2026-11-13. Odrębne polecenie użytkownika: jedna instalacja gry
i aktualizatora w `public_html`. Gałąź `feature/u2-public-html-bundle`,
baza P3 / PR #10 (`2c068ffe`). Bez merge i wdrożenia na konto hostingu.

## Wynik

Gotowy [ZIP pierwszej instalacji](../downloads/pixelforge-public-html-0.7.0-installer-1.2.0.zip)
zawiera niezmienioną grę **0.7.0** (Życie Dżdżownicy i Atlas), panel,
instalator WWW i narzędzie **1.2.0**. Wszystkie pliki projektu i jego kopie
mieszczą się pod `public_html`. Nie potrzeba SSH, Node.js ani SQL.
[Instrukcja](PUBLIC-HTML-INSTALL.txt) jest też w ZIP-ie jako `INSTALACJA.txt`.

```text
public_html/
├── PixelForge/                 # statyczna gra i manifest wydania
├── pixelforge-admin/index.php  # publiczne wejście do panelu
├── _pixelforge/
│   ├── .htaccess               # obowiązkowe Require all denied
│   ├── tool/                   # kod PHP, poza katalogiem gry
│   └── data/                   # konfiguracja, sesje, staging, kopie, logi
├── setup.php                   # jednorazowy konfigurator WWW
├── pixelforge.php              # skrót do /PixelForge/index.html
└── INSTALACJA.txt
```

Paczka zachowuje główne `index.php`, `index.html` i `.htaccess` domeny.
Publiczny odczyt `https://rozumisie.pl/` potwierdził działającą stronę
„Małe zadania, wielkie odkrycia · Rozumisie”; instalacja PixelForge jej nie
zastępuje. Na pustej domenie można zmienić `pixelforge.php` na `index.php`.
Starą grę należy zachować w kopii i zastąpić kompletnym nowym katalogiem
`PixelForge`, bez mieszania assetów. Obce pliki blokują konfigurację.

## Konfiguracja i ochrona

Przeglądarka generuje plik konfiguracji z kanonicznym origin HTTPS i losowym
kluczem 256 bitów. Właściciel wgrywa plik przez menedżer hostingu. Tylko osoba
znająca wgrany klucz może utworzyć konto. Nie ma domyślnego hasła ani możliwości
przejęcia konta samą pierwszą wizytą na stronie. Formularz wymaga HTTPS, zgodnego
origin i tokenu HMAC z terminem ważności; blokada wyklucza równoczesny setup.
Hasło jest hashowane bcrypt, a konto zatwierdzane na końcu. Wcześniejszy błąd
pozwala ponowić próbę. Gotowe konto zamyka setup z HTTP 410; jednorazowy klucz
jest usuwany z serwera. Formularze działają także bez JavaScript.

Nowy tryb wymaga jawnego `publicStorage.mode = apache-deny-v1` w zaufanej
lokalnej konfiguracji. Domyślny wariant z danymi poza WWW pozostaje dostępny.
Ścieżki gry i danych są stałe; obowiązuje odrzucanie linków i obcych plików.
Lokalny `.htaccess` musi odpowiadać dołączonym regułom. Przed zapisaniem konta
i przy żądaniach panelu połączenie HTTPS sprawdza publiczny losowy znacznik
(200 i dokładna treść), następnie prywatny znacznik (403). Test nie śledzi
przekierowań i nie wyłącza TLS. Origin pochodzi z pliku właściciela, nigdy
z formularza, ZIP-a ani nagłówka Host. Wynik jest pamiętany tylko w bieżącym
żądaniu PHP, maksymalnie 5 sekund; nie ma trwałego wyłączenia kontroli.

Konfiguracja ma prawa 0600, dane 0700. Zachowano mechanizmy U2: sesję
Secure/HttpOnly/SameSite, CSRF, limit logowania, podgląd paczki i osobne
zatwierdzenie aktualizacji lub rollbacku. ZIP pierwszej instalacji oraz ZIP
narzędzia są odrzucane przez formularz aktualizacji gry. Kod PHP aktualizuje
administrator osobno; gra nie może zastąpić panelu ani zabezpieczeń.

**Ochronę zapewnia konfiguracja serwera.** Usunięcie/wyłączenie `.htaccess`
może ujawnić istniejące dane. Panel blokuje wtedy kolejne operacje, ale trzeba
przywrócić reguły i zmienić hasło. Wymagane Apache 2.4 lub zgodny LiteSpeed,
HTTPS, PHP 8.2+ 64 bit / ZipArchive / OpenSSL, `allow_url_fopen`, pamięć 256M
i możliwość połączenia PHP z własną domeną. Wariant nie obsługuje Nginx
ani hostingu wyłącznie statycznego. Systemowy katalog uploadów tymczasowych
PHP jest usługą hostingu poza WWW, a nie dodatkowym katalogiem projektu.

## Weryfikacja

Debian 13, Apache 2.4.68, mod_php/PHP 8.4.24, Node 24.22.1, Chromium
158.0.8127.18. Desktop i emulacja Pixel 7. Certyfikat lokalnego CA jest jawnie
zaufany, TLS pozostaje weryfikowany. Ochronę `.htaccess` sprawdza rzeczywisty
Apache, nie router symulujący odpowiedź 403.

| Kontrola                                                            | Wynik                                               |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| ESLint/Prettier, TypeScript, składnia PHP, build                    | PASS                                                |
| Vitest                                                              | 61 PASS                                             |
| Paczki U0 Python                                                    | 15 PASS                                             |
| Integracje U1/U2 PHP, w tym 129 niedozwolonych wariantów ZIP        | 36 PASS                                             |
| Nowe integracje instalacji w public_html                            | 12 PASS                                             |
| Playwright gry i rdzenia                                            | 38 PASS, 2 celowe SKIP dotyku na desktopie          |
| U1: instalacja i rollback Atlasu, dwie ścieżki i rozmiary           | 8/8 PASS                                            |
| Panel U2 z danymi poza WWW                                          | desktop, emulacja telefonu i formularze bez JS PASS |
| 0.6.1 → 0.7.0 → rollback → ponowna instalacja                       | PASS, zapisy Dżdżownicy i Atlasu zachowane          |
| Rozpakowany ZIP gry pod `/` i `/PixelForge/`                        | 4/4 PASS                                            |
| Setup i aktualizacja z rzeczywistego ZIP-a instalacji w public_html | desktop, emulacja telefonu i formularze bez JS PASS |
| Odtworzenie nowych ZIP-ów i niezmienionej gry                       | zgodność bajt w bajt                                |

12 nowych testów obejmuje brak i ignorowanie `.htaccess`, nieufny certyfikat,
brak dowodu własności, błędny klucz, CSRF/origin, hasła, ponowienie po błędzie
gry, równoległy setup, zamknięcie konfiguracji konta, ochronę plików i kopii
przez HTTP, zmianę zabezpieczenia po instalacji, aktualizację, rollback,
SIGKILL między rename i odzyskanie przez panel. Sprawdza również zachowanie
istniejącej strony głównej.

Przeglądarka pobiera konfigurację, a test symuluje uprawnione wgranie pliku
przez właściciela. Potem używa normalnych formularzy, uruchamia Dżdżownicę,
ożywia pierwszy korzeń, zapisuje grę, aktualizuje i przywraca wydanie oraz
wznawia zapis. Testowa **0.7.1** ma identyczny payload 0.7.0 i istnieje tylko
w tymczasowym fixture; nie jest publikowanym wydaniem gry.

[Wyniki przeglądarki](HOSTING-BROWSER-RESULTS.json),
[instalator na telefonie](hosting-setup-mobile.png),
[panel po rollbacku](hosting-panel-desktop.png).

Polecenia: standardowe kontrole z README oraz `npm run test:hosting`,
`npm run test:hosting:browser`, `npm run package:updater`, `npm run package:hosting`.
Testy hostingu wymagają `apache2` i `libapache2-mod-php`. Własne binarki można
wskazać przez `PIXELFORGE_APACHE`, `PIXELFORGE_APACHE_MODULES`,
`PIXELFORGE_APACHE_LIBRARY_PATH`, `PIXELFORGE_PHP` i `PIXELFORGE_PHP_ZIP`.
CI instaluje te zależności i wykonuje także nowe testy.

## Artefakty i zmiany

| Paczka                                             |  Rozmiar | Zawartość                             |
| -------------------------------------------------- | -------: | ------------------------------------- |
| `pixelforge-public-html-0.7.0-installer-1.2.0.zip` | 657832 B | 310 plików, 3221556 B po rozpakowaniu |
| `pixelforge-updater-u2-1.2.0.zip`                  |  51183 B | 24 pliki, osobne narzędzie            |
| `pixelforge-0.7.0-full.zip`                        | 585255 B | dotychczasowa paczka gry, bez zmian   |

SHA-256 pierwszej instalacji:
`02873c61424dbb57054dd52737b37b46953c857ecf2bf4448fa3d5a9e2a3e152`.
Suma gry pozostaje
`0d5a302ae4cf7bd11c0529c655a876825b76bf2f02dcedda6a7c97e1d392f492`.
Sumy zapisano również obok archiwów.

Nowe `ProtectedStorage.php`, `HostingSetup.php`, bootstrappy w
`admin-updater/hosting/` i generator `web/setup.js` realizują wariant hostingu.
Istniejące `Updater.php` i `PanelConfig.php` otrzymały jawną obsługę tego trybu;
walidator i algorytm przełączania wydań pozostają wspólne. Paczkę składa
`tools/package-hosting.py`, testy są w `tests/hosting/`. Zaktualizowano
instrukcje, roadmapę i CI. Silnik, gameplay i pliki gry pozostały niezmienione.

## Ograniczenia i następny krok

Publiczna odpowiedź hostingu zgłasza LiteSpeed; nie sprawdzono praw zapisu,
rozszerzeń PHP ani konfiguracji konta użytkownika. Setup sprawdzi je po wgraniu.
Nie wykonano wdrożenia, testów na fizycznym telefonie, Safari ani Firefoxie.
Reset zapomnianego hasła nadal wymaga komendy administratora/terminala hostingu;
nie ma publicznego resetu. U1 zachowuje krótkie okno 404 między rename i recovery.

Następny krok to wgranie paczki przez właściciela i odbiór na docelowym hostingu.
Nie rozpoczęto U3, Studio ani kolejnej gry.
