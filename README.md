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

## Uruchamianie

Gałąź `feature/p0-core-extraction` zawiera odzyskany rdzeń i niezależne testy.
Katalog aktywnych gier jest pusty — to oczekiwany stan P0. Oba zamknięte produkty
pozostają wyłącznie w historycznych gałęziach. Nie scalono PR #1–#4.

Wymagane Node.js **24 LTS** i npm 11. Po przełączeniu na gałąź P0:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

`npm run dev` podaje lokalny adres Vite. `npm run build` tworzy statyczny `dist/`
z ekranem rdzenia, bez aktywnych tytułów, testów i fixture'ów. Build działa także
z podkatalogu dzięki `base: './'`. `npm run preview` służy do jego sprawdzenia.

Przed pierwszym E2E: `npx playwright install chromium`, następnie `npm run test:e2e`.
Playwright uruchamia własny Vite na porcie 4190 i testuje prawdziwy EngineHost
przez syntetyczny harness poza katalogiem produkcyjnym. Testy nie importują
dawnych gier. PNG testowe odtwarza `python3 tools/generate-test-assets.py`.

[Inwentaryzacja i pochodzenie modułów](docs/CORE-INVENTORY.md),
[raport P0](docs/P0-REPORT.md),
[plan dużych map i aktualizatora](docs/IMPLEMENTATION-PLAN.md).

Aktualizuj ten opis po każdej zmianie publicznego sposobu uruchamiania. Nie oznaczaj projektu jako ukończonego przed przejściem kryteriów odbioru z roadmapy.

## Zasoby

Grafiki, muzyka i fonty muszą mieć prawa pozwalające na publikację. Domyślnie używaj własnych zasobów lub odpowiednio licencjonowanych materiałów z zapisaną informacją o pochodzeniu.
