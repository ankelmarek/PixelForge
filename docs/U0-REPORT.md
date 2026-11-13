# Raport U0 — pełne paczki ZIP i walidacja offline

Aktualne wydanie: [poprawka 0.6.1](HOTFIX-0.6.1.md). Poniżej zachowano wynik U0 0.6.0.

Data: 2026-11-13. Gałąź `feature/p2-u0-packages`, baza P1 `c884fdf` / PR #6,
wersja wydania **0.6.0**. Osobny PR do main zależny od P1 i P0; bez merge
oraz bez wdrożenia na hosting.

## Wynik

- `npm run package:release` buduje projekt, a po sukcesie generuje pełny ZIP,
  `manifest.json` oraz zewnętrzną sumę SHA-256. Wersja pochodzi z package.json.
- `npm run package:validate -- <ZIP>` weryfikuje format, projekt, wersje,
  kompletność, ścieżki, typy wpisów, limity, rozmiary, CRC i SHA-256.
  Nie rozpakowuje, nie instaluje i nie wykonuje kodu z paczki.
- Dekompozycja pozostaje prosta: jedno narzędzie `tools/release.py` poza silnikiem,
  Python 3.11+ standard library, bez nowych bibliotek runtime ani serwera.
- Format v1 obsługuje `full`; kontrakt silnika 2 i narzędzie 1.0.0 mają osobne
  wersje. Odrzucane są nieznane pola i komendy, delta, zła kompatybilność oraz
  zawartość spoza jawnej listy plików statycznych.
- Generator daje powtarzalny wynik, sam go sprawdza i odmawia nadpisania innej
  paczki o tej samej wersji. Obsługa błędów usuwa plik tymczasowy.

## Weryfikacja

- `npm run lint`, `npm run typecheck`, `npm run build`: PASS.
- `npm test`: **47 Vitest + 13 Python PASS**. Python uruchomiony w wersji 3.12.14.
- `npm run test:e2e`: **24 PASS + 2 SKIP**, tylko dotyk na profilu desktopowym.
- `package:release` oraz `package:validate -- ... --expect-version 0.6.0`: PASS.
- Ponowne pakowanie do innego katalogu: ZIP identyczny bajt w bajt.
- Rozpakowany full ZIP pod `/` i `/PixelForge/`, mapy 4096/8192,
  desktop/Pixel 7: **8/8 PASS**, bez błędów JS i HTTP zasobów.
- Każdy z 272 plików porównany bajt w bajt z aktualnym `dist/` oraz z P1 0.5.1.
  Runtime, ID gier, rewizje, formaty i klucze zapisów nie zmieniły się w U0.

Fixture'y testów powstają deterministycznie w `tests/packages/test_release.py`:
poprawny ZIP, uszkodzenia CRC/DEFLATE, manifest/sumy, brakujące i nadmiarowe pliki,
zip-slip, ścieżki absolutne i Windows, backslash/NUL, aliasy wielkości liter,
symlinki, katalogi, urządzenia, uprawnienia wykonywalne, pliki serwera i sekrety,
limity liczby/rozmiaru/metadanych/kompresji, niezgodne nagłówki lokalne/centralne,
ZIP64/szyfrowanie/nieznane metody, ucięty ZIP i dodatkowe dane.

Osobny scenariusz fałszuje rozmiar i CRC w obu nagłówkach, dopasowuje manifest
oraz hash do małego prefiksu danych, pozostawiając duży strumień DEFLATE.
Walidator odrzuca rzeczywisty nadmiar podczas ograniczonej dekompresji.
Testy CLI sprawdzają kody 0/2 oraz brak rozpakowanych plików. Testy generatora
obejmują symlinki, sekrety, ponowienie, kolizję wersji i sprzątanie po błędzie.

## Dostarczone wydanie

`downloads/pixelforge-0.6.0-full.zip`: **545 252 bajty**, 272 pliki statyczne
(2 906 136 bajtów) oraz manifest — razem 273 wpisy. SHA-256:

```text
ff6acbe185b06fe57d4d7cd322ca27cc534b451f87b6d6295906039813c093d4
```

[Instrukcja wgrania](../downloads/README.md),
[pełny kontrakt i limity](RELEASE-PACKAGES.md).

## Ograniczenia i następny zakres

Sumy kontrolne wykrywają uszkodzenie, nie potwierdzają autentyczności wydawcy.
Obsługiwany jest udokumentowany podzbiór ZIP generowany przez to narzędzie;
archiwa z obcych programów mogą wymagać ponownego zbudowania. Walidator jest
lokalny, nie usługą sieciową; skompresowany ZIP zajmuje do domyślnych 64 MiB RAM.

Nie testowano fizycznych telefonów ani Safari/Firefox. Pomiar runtime jest
aktualny z P1 0.5.1, bo pliki buildu są identyczne. Pozostaje ostrzeżenie Vite
o dużym module Phasera. Nie ma uploadu, stagingu, instalacji, rollbacku,
autoryzacji panelu ani delt. **U1** wymaga poznania możliwości docelowego hostingu
(PHP 8 + ZipArchive, SSH/CLI lub wyłącznie statyczne pliki). Gry P3 pozostają
niezaczęte. Historyczne gałęzie i archiwalna roadmapa są zachowane.
