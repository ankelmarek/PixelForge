# PixelForge

> **Aktualizacja kierunku, 13.11.2026:** nie rozwijamy już **Winobrania** ani platformówki **Leśny sygnał**. PixelForge pozostaje aktywnym, współdzielonym silnikiem dla nowych gier 2D z góry. Priorytety: **duże mapy** i **aktualizator ZIP**. Bieżący plan: [ROADMAP.md](docs/ROADMAP.md), opis aktualizatora: [UPDATER-SPEC.md](docs/UPDATER-SPEC.md). Stary plan zachowano w [archiwum](docs/ROADMAP-ARCHIVE-2026-11.md).

**PixelForge** to uniwersalna, przeglądarkowa platforma do tworzenia małych gier 2D w estetyce pixel art. Docelowo każda gra ma oferować około **20–35 minut rozgrywki** i mieć własny początek, rozwinięcie oraz zakończenie.

Projekt powstaje z myślą o wielokrotnym wykorzystaniu gotowego silnika i produkowaniu kolejnych, niezależnych tytułów, zamiast pisania całych gier od zera.

## Główna zasada

**Silnik nie zna fabuły ani nazwy żadnej gry.** Odpowiada za sceny, wejście, fizykę, interakcje, dźwięk, zapis, UI i wspólny kontrakt zawartości. Każda gra dostarcza konfigurację, poziomy, grafikę, dźwięk i opcjonalne moduły mechanik.

## Technologia początkowa

- Phaser **4.2.1** (zablokowana wersja na start)
- TypeScript w trybie `strict`
- Vite
- Vitest do testów jednostkowych i kontraktowych
- Playwright do testów krytycznych przepływów w przeglądarce
- Statyczna aplikacja bez backendu, kont i obowiązkowego internetu po pobraniu zasobów

## Dokumenty dla Codexa

1. [AGENTS.md](./AGENTS.md): zasady postępowania i zakres prac dla Codexa.
2. [Specyfikacja](./docs/SPECIFICATION.md): cele, architektura, API, formaty zawartości i wymagania.
3. [Roadmapa](./docs/ROADMAP.md): aktualne etapy, zadania, priorytety i kryteria odbioru.
4. [Aktualizator ZIP](./docs/UPDATER-SPEC.md): bezpieczne wydania, upload, walidacja i rollback.

## Stan implementacji

Funkcje silnika powstały w historycznych gałęziach M0–M3 i powiązanych PR, które pozostają do przeglądu i integracji. **Gałąź main nie jest jeszcze opublikowaną wersją kodu.** Gry Winobranie i Leśny sygnał zostały porzucone jako rozwijane produkty; generyczne moduły pozostają do wykorzystania. Nowe mapy muszą być znacznie większe od historycznej próbki 640 × 416 pikseli.

## Gotowa paczka na hosting

[Pobierz PixelForge 0.6.0 — pełny ZIP na serwer statyczny](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p2-u0-packages/downloads/pixelforge-0.6.0-full.zip).
Rozpakuj i wgraj `index.html`, cały katalog `assets/` oraz `manifest.json` do
katalogu strony, np. `public_html/pixelforge/`. Otwórz potem
`https://twoja-domena.pl/pixelforge/`. Na hostingu nie potrzebujesz Node.js,
Pythona ani PHP. [Pełna instrukcja](downloads/README.md).
Atlas zajmuje całe okno przeglądarki, także po obrocie telefonu.

Generator i walidator offline **P2/U0** są gotowe; instalator i panel U1/U2
pozostają osobnymi etapami. Paczka nie wdraża się samodzielnie.

## Uruchamianie

Gałąź `feature/p2-u0-packages` zawiera rdzeń P0, demonstrację **Atlas** z P1
i narzędzia U0. Opiera się na P1 `c884fdf` / PR #6, zależnym od PR #5.
Na ekranie głównym wybierz **Otwórz 4096 × 4096** albo **8192 × 8192**, następnie
**Nowa sesja** lub **Wznów**. Katalog produktów pozostaje pusty — demonstracja
techniczna jest poza `src/games/`. P1 zależy od PR #5; żaden PR nie został scalony
automatycznie. Dawne gry pozostają w historycznych gałęziach.

Wymagane Node.js **24 LTS**, npm 11 oraz Python **3.11+** do testów i paczek U0.
Po przełączeniu na gałąź U0:

```bash
git clone --branch feature/p2-u0-packages https://github.com/ankelmarek/PixelForge.git
cd PixelForge
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

`npm run dev` podaje lokalny adres Vite. `npm run build` tworzy statyczny `dist/`
z ekranem rdzenia i demonstracją świata, bez testów oraz fixture'ów. Build działa także
z podkatalogu dzięki `base: './'`. `npm run preview` służy do jego sprawdzenia.

Przed pierwszym E2E: `npx playwright install chromium`, następnie `npm run test:e2e`.
Playwright uruchamia własny Vite na porcie 4190 i testuje prawdziwy EngineHost
w laboratorium P1 oraz przez syntetyczny harness rdzenia poza buildem. Testy nie importują
dawnych gier. PNG testowe odtwarza `python3 tools/generate-test-assets.py`.

[Inwentaryzacja i pochodzenie modułów](docs/CORE-INVENTORY.md),
[raport P0](docs/P0-REPORT.md), [raport P1](docs/P1-REPORT.md),
[format dużych światów i pomiary](docs/LARGE-WORLDS.md),
[plan dużych map i aktualizatora](docs/IMPLEMENTATION-PLAN.md).

Grafikę i sektory Atlasu odtwarza `npm run assets:world` (Python 3 bez bibliotek).
Pomiary: `npm run preview -- --port 4194`, w drugim terminalu `npm run measure:world`.
`?diagnostics=1` w adresie włącza lokalne liczniki techniczne. Nie jest to panel
aktualizatora.

## Paczki wydania U0

```bash
npm run package:release
npm run package:validate -- downloads/pixelforge-0.6.0-full.zip
npm run test:packages
```

Pierwsze polecenie buduje projekt i dopiero po sukcesie tworzy wersjonowany ZIP,
manifest oraz plik sumy SHA-256. Drugie sprawdza paczkę bez instalacji i bez
rozpakowywania. `npm test` obejmuje Vitest i testy paczek w Pythonie (biblioteka
standardowa, bez pip). [Format, limity i polecenia](docs/RELEASE-PACKAGES.md),
[raport U0](docs/U0-REPORT.md). Następny etap U1 wymaga ustalenia możliwości hostingu.

Aktualizuj ten opis po każdej zmianie publicznego sposobu uruchamiania. Nie oznaczaj projektu jako ukończonego przed przejściem kryteriów odbioru z roadmapy.

## Zasoby

Grafiki, muzyka i fonty muszą mieć prawa pozwalające na publikację. Domyślnie używaj własnych zasobów lub odpowiednio licencjonowanych materiałów z zapisaną informacją o pochodzeniu.
