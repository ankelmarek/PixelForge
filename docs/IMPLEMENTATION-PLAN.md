# Plan po P0 — duże światy i aktualizator ZIP

Zakres wynika z roadmapy 0.2 i `UPDATER-SPEC.md`. P1A–P1D zrealizowano na gałęzi `feature/p1-large-worlds` —
[raport P1](P1-REPORT.md), [kontrakt świata](LARGE-WORLDS.md). P2/U0 zrealizowano w osobnym PR — [raport U0](U0-REPORT.md).
U1 ma adapter PHP i wejście CLI — [raport U1](U1-REPORT.md). U2–U3 pozostają planem.
Nie wdrożono aktualizatora na hosting ani nie rozpoczęto którejkolwiek gry.

Po odbiorze 0.6.1 rozpoczęto przygotowanie U1:
[operacje instalatora i macierz testów awarii](U1-INSTALLATION-PLAN.md).
Implementacja PHP jest gotowa; środowisko konkretnego konta sprawdza `doctor`.

## P1 — duże mapy

| Krok / osobny zakres recenzji | Implementacja                                                                                                                                      | Kryterium weryfikacji                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P1A: format świata            | Wersjonowany manifest świata, wymiary w komórkach i pikselach, sektory, warstwy kafli, obiekty, punkty dostępu; oddzielić viewport od świata       | Syntetyczne światy 4096 i 8192 px przechodzą ten sam parser co runtime; złe sektory i wymiary są odrzucane               |
| P1B: renderer i kamera        | Ładowanie widocznych chunków z marginesem, limitowany cache, usuwanie niewidocznych sprite'ów, ograniczenia i kotwica zoomu; wspólne wejście myszy | Przesunięcie do czterech narożników, zoom, brak szwów i pustki; liczba obiektów renderowanych zależy od widoku           |
| P1C: nawigacja i model        | Graf przejść regionów oraz ograniczone lokalne A*, przejazd pojazdu według dróg i prześwitu, budżet obliczeń i obsługa nieosiągalności             | Długie trasy przez sektory bez przeszukiwania całej siatki przy każdym poleceniu; zachowany bilans i postęp poza ekranem |
| P1D: zapis i pomiary          | Trwały model poza cache'em renderera, identyfikatory sektorów/obiektów, wersjonowany zapis, testy widoku i wydajności                              | Zapis/wznowienie w innym sektorze; zmierzone FPS/pamięć desktop + emulacja telefonu wraz z warunkami pomiaru             |

P1 wykorzystuje osobną demonstrację techniczną, niezwiązaną z dawnymi produktami.
Nie budować pojedynczego PNG świata. Nie podnosić jedynie limitu 128 komórek:
dawny renderer i pełne A* nie spełniały tych wymagań; P1 zastąpił je sektorami i nawigacją regionalną. Model zasobów pozostaje
niezależny od widoczności i czasu klatek. Próg świata i rozmiar sektora są danymi,
nie warunkami po `gameId`. Nie zmieniać istniejących kluczy zapisów produktów.

## P2 — aktualizator, kolejność U0–U3

| Krok | Granica i rezultat                                                                                           | Testy wymagane przed następnym krokiem                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U0   | Offline generator `full`, manifest, SHA-256 i walidator pakietu; niezależne od gry narzędzie                 | Dobry ZIP, uszkodzenie, zip-slip, absolutne/alternatywne ścieżki, duplikaty, symlinki, limity plików/rozpakowania/kompresji, zgodność wersji i dozwolone pliki statyczne |
| U1   | Adapter instalacji wybrany po poznaniu hostingu; prywatny staging, blokada, wersjonowane wydania i rollback  | Instalacja w katalogu tymczasowym, błąd/przerwanie na każdym kroku, health check, idempotencja i zachowanie ostatniego sprawnego wydania                                 |
| U2   | Oddzielny panel administratora, poza paczką gry; logowanie, HTTPS, CSRF, ograniczenia prób, upload i podgląd | Brak dostępu bez logowania, odrzucenie CSRF, brak automatycznej instalacji po uploadzie, osobna zgoda po pokazaniu zmian, niepubliczne staging/logi                      |
| U3   | Delta z obowiązkowym dokładnym `baseVersion`; składanie pełnego wydania w staging, jawne usunięcia           | Zła baza, podwójne i równoległe próby, przerwany transfer, zakazane usunięcia i pełna kontrola sum po złożeniu                                                           |

U0 oparto na statycznym buildzie P1, bez oczekiwania na wybór gry.
Generator i walidator: `tools/release.py`, Python 3.11+ bez dodatkowych pakietów.
Kontrakt i komendy: [RELEASE-PACKAGES.md](RELEASE-PACKAGES.md).
Wersja pakietu, schematu silnika i aktualizatora są odrębnymi polami.
Manifest nie może zlecać wykonania skryptu, migracji ani komend powłoki.
`admin-updater/`, prywatne katalogi, konfiguracja serwera i dane administratora
nie wchodzą do paczki i nie mogą być celem instalacji lub usunięcia.

U1 wybrano dla PHP 8.2+ z ZipArchive. Publiczna strona rozumisie.pl zgłasza PHP
8.5.12; uprawnienia i rozszerzenia konkretnego konta wymagają lokalnego sprawdzenia.
P0 nie potrzebuje dostępu do hostingu ani haseł. Panel WWW nie działa na hostingu
wyłącznie statycznym. Wieloplikowego nadpisywania nie wolno nazywać atomowym.

Sumy SHA-256 kontrolują integralność; nie dowodzą autentyczności wydawcy.
Zaufane podpisy pakietów są oddzielnym rozszerzeniem, jeśli pojawi się
zdalna dystrybucja. W P0 nie dodano uploadu, panelu, usług ani uprawnień serwera.

## Zależności i punkty odbioru

1. P0 gotowe w PR #5; P1 opiera się na jego kodzie. Przegląd i merge pozostają
   decyzją właściciela, bez automatycznego scalania.
2. P1A–P1D wykonane: osobny PR, demonstracja dużego świata i pomiary w raporcie.
3. U0 jako oddzielny PR narzędzia offline; U1/U2 dopiero po ustaleniu hostingu
   i osobnym poleceniu wdrożeniowym. Żaden etap nie publikuje automatycznie.
4. P3 dopiero po wybraniu tytułu i jego specyfikacji. P4 pozostaje odłożony.

Winobranie i Leśny sygnał nie są projektami dalszych prac ani danymi nowych testów.
