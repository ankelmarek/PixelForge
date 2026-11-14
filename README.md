# PixelForge

> **Nowa decyzja, 14.11.2026:** porzucony stary prototyp Winobrania pozostaje historyczny, ale przygotowujemy **[Winobranie RTS: Trzy sezony](docs/WINOBRANIE-RTS.md)** jako nową strategię na dużej mapie. Platformówka **Leśny sygnał** nadal nie jest rozwijana. Aktualne zadania są w [roadmapie 0.3](docs/ROADMAP.md); starszy plan w [archiwum 0.2](docs/ROADMAP-ARCHIVE-0.2.md).


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
5. [Winobranie RTS](./docs/WINOBRANIE-RTS.md): pełne wymagania i etapy strategii ekonomicznej.

## Stan implementacji

Funkcje silnika powstały w historycznych gałęziach M0–M3 i powiązanych PR, które pozostają do przeglądu i integracji. **Gałąź main nie jest jeszcze opublikowaną wersją kodu.** Stare Winobranie i Leśny sygnał zostały porzucone, natomiast nowy projekt **Winobranie RTS** powstanie w osobnym katalogu na współdzielonym silniku; generyczne moduły pozostają do wykorzystania. Nowe mapy muszą być znacznie większe od historycznej próbki 640 × 416 pikseli.

## Uruchamianie

Po bezpiecznym włączeniu rdzenia Codex musi zachować standardowe polecenia:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

Aktualizuj ten opis po każdej zmianie publicznego sposobu uruchamiania. Nie oznaczaj projektu jako ukończonego przed przejściem kryteriów odbioru z roadmapy.

## Zasoby

Grafiki, muzyka i fonty muszą mieć prawa pozwalające na publikację. Domyślnie używaj własnych zasobów lub odpowiednio licencjonowanych materiałów z zapisaną informacją o pochodzeniu.
