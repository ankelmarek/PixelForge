# U2 — uwierzytelniony panel aktualizacji ZIP

**Status: DONE (implementacja i testy).** Gałąź `feature/p2-u2-admin-panel` /
[PR #9](https://github.com/ankelmarek/PixelForge/pull/9), baza U1 `95f310e` / PR #8.
Runtime gry pozostaje **0.6.1**. Bez merge i wdrożenia na hosting.

## Wynik

Administrator może przesłać pełny ZIP w przeglądarce, zobaczyć wersję, rozmiary,
SHA-256 i listy zmian, a następnie osobno zatwierdzić instalację. Wynik prowadzi
do gry; powrót do poprzedniej wersji wymaga potwierdzenia aktualnych wersji.
Panel obsługuje też rejestrację instalacji, odzyskiwanie przerwanej operacji,
usuwanie planów i nieużywanych wydań.

Jednorazowa konfiguracja CLI zapisuje prywatny hash własnego hasła oraz tworzy
jeden publiczny bootstrap. Codzienne aktualizacje wykonuje się przez WWW.
Nie ma domyślnego hasła, publicznego setupu, SQL ani dodatkowych bibliotek runtime.
Interfejs jest po polsku, responsywny i działa bez JavaScript; JS dodaje
przeciąganie pliku i informację o przesyłaniu.

## Pliki i architektura

- `admin-updater/src/PanelConfig.php`, `PanelAuth.php`: prywatna konfiguracja,
  HTTPS/Host/Origin, sesja, CSRF i trwały limit logowania.
- `Panel.php`, `PanelView.php`, `web/`: endpoint, formularze, podgląd,
  obsługa uploadu oraz interfejs.
- `panel-setup.php`, `panel-password.php`: konfiguracja i reset hasła przez CLI.
- `Updater.php`: dodatkowe odczyty `inspect` i `preview`, które nie uruchamiają
  recovery ani nie przełączają gry przy GET. Mechanizm U1 pozostaje wspólny.
- `tests/updater/test_panel.py` i fixture'y: testy realnego PHP/HTTP/TLS.
  `panel-browser.mjs`: testy Chromium i produkcyjnej paczki Atlasu.
- `tools/package-updater.py`: osobny, powtarzalny ZIP narzędzia 1.1.0.
  `.github/workflows/ci.yml`: kontrole PR z prawem tylko do odczytu repozytorium.

Nie zmieniono silnika, gry, map ani formatu zapisów. Zbudowane `dist/`
ma **272 pliki identyczne bajt w bajt** z payloadem zaakceptowanego 0.6.1.

## Zabezpieczenia

- HTTPS i kanoniczny Host; brak zaufania do forwarded nagłówków klienta.
- Cookie Secure/HttpOnly/SameSite Strict i ścieżka panelu; rotacja ID i CSRF.
  Sesja wygasa po 30 minutach bezczynności lub 8 godzinach; reset hasła
  unieważnia wcześniejsze sesje. Wymagane ustawienia PHP są sprawdzane.
- Trwały, blokowany limit 5 prób logowania/IP i 20 globalnie na 15 minut.
  Zapis licznika jest atomowy; hasła nie są logowane.
- Wszystkie zmiany wymagają uwierzytelnionego POST, CSRF i zgodnego Origin.
  Upload przygotowuje plan, osobne zatwierdzenie wywołuje U1.
- Nazwa pliku klienta nie jest ścieżką. Upload trafia do losowego pliku
  prywatnego, z limitem PHP/pakietu i kontrolą miejsca; jest usuwany po błędzie.
  Pozostałość po SIGKILL sprząta następny upload pod wyłączną blokadą.
- Walidator U1 ponownie kontroluje ZIP, staging, aktywną wersję, hashe i plan.
  Kod panelu, konfiguracja, sesje i kopie nie należą do paczki gry.
- CSP, odmowa osadzania w ramce, brak cache panelu i błędy bez prywatnych ścieżek.

## Weryfikacja

Terminal środowiska sesji był niedostępny. Wszystkie poniższe kontrole wykonano
w **GitHub Actions** na Ubuntu 24.04, PHP **8.3.6**, Node **24.22.2**,
Chromium **158.0.8127.18**. Runner nie miał sekretów hostingu i nie wdrażał aplikacji.

| Kontrola                                                     | Wynik                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| ESLint / Prettier, TypeScript, składnia PHP, build           | PASS                                                     |
| Vitest                                                       | 48 PASS                                                  |
| Python U0                                                    | 15 PASS                                                  |
| Integracja PHP U1                                            | 22 PASS, w tym 129 niedozwolonych wariantów ZIP          |
| Panel U2 przez realne HTTP/TLS                               | 14 PASS                                                  |
| Pełny Playwright silnika i Atlasu                            | 28 PASS + 2 oczekiwane SKIP dotyku na desktopie          |
| U1 browser: mapy 4096/8192, / i /PixelForge/, desktop/mobile | 8/8 PASS                                                 |
| U2 browser: desktop i Pixel 7 przez HTTPS                    | Instalacja i rollback PASS, zapisy i kamera zachowane    |
| Panel bez JavaScript                                         | Logowanie, upload, podgląd i usunięcie planu PASS        |
| Rozpakowany ZIP narzędzia                                    | Logowanie, CSS/JS, instalacja, rollback, CRC i sumy PASS |
| Powtarzalność pakowania i oddzielenie buildu                 | Identyczny ZIP; 272 pliki gry zgodne z 0.6.1             |

Testy obejmują odmowę niezalogowanych operacji, HTTP i spoofingu proxy,
CSRF/Origin, rotację i wygaśnięcie sesji, logout/reset hasła, limit prób,
uszkodzony i zbyt duży upload, sprzątanie, zmieniony staging, nieaktualny plan,
powtórzenie instalacji/rollbacku i recovery po SIGKILL. GET nie zmienia aktywnej
gry, także przy przerwanej transakcji. Test dystrybucji korzysta z rzeczywiście
rozpakowanego ZIP-a, a nie tylko źródeł repozytorium.

Test browser używa własnego CA na localhost; na czas testu dodaje go do NSS
i usuwa po zakończeniu. **Weryfikacja TLS pozostaje włączona.** Desktop sprawdza
przeciągnięcie pliku; emulacja telefonu wybór pliku. Brak błędów JS/HTTP
w sprawdzonych przepływach. Wersja **0.6.2 jest wyłącznie tymczasowym fixture'em**,
nie nowym wydaniem gry.

[Wynik przeglądarkowy](U2-BROWSER-RESULTS.json),
[desktop](screenshots/u2-desktop.png), [telefon](screenshots/u2-mobile.png).
[Kontrole GitHub Actions](https://github.com/ankelmarek/PixelForge/actions?query=branch%3Afeature%2Fp2-u2-admin-panel).

## Paczka i uruchomienie

`downloads/pixelforge-updater-u2-1.1.0.zip`: 39 805 bajtów,
16 wpisów (15 plików narzędzia i MANIFEST.sha256).

SHA-256: `7305e7de90abb02134c652c28e533816a615d60cacc023db3498db126c0d0e3b`.

[Instrukcja konfiguracji i obsługi](../admin-updater/README.md).
Archiwum narzędzia rozpakowuje się poza public_html; konfigurator tworzy
publiczny `pixelforge-admin/index.php`. Gra nadal korzysta z osobnego ZIP-a 0.6.1.
Paczka nie zawiera prywatnej konfiguracji ani hasła administratora.

## Ograniczenia

U1 zachowuje krótkie okno HTTP 404 między dwoma rename. Po SIGKILL w tym oknie
potrzebne jest jawne recovery. PHP sprawdza integralność plików, nie gameplay.
Kod HTML/JS publikowany na tym samym originie co panel musi być zaufany;
ścieżka cookie nie izoluje od złośliwego JS. Podpisy i separacja domen nie są
częścią U2. Pierwsza konfiguracja wymaga prywatnych ścieżek i SSH/terminala hostingu.

Nie wdrażano panelu na rozumisie.pl ani nie testowano PHP-FPM konkretnego konta.
Nie sprawdzono fizycznego telefonu ani innych silników przeglądarek. U3
(paczki delta) i gry P3 pozostają poza zakresem; kolejny etap wymaga osobnego zlecenia.
