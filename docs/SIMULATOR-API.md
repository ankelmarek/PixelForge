# TopDown Simulator — konfiguracja drugiej gry

Tryb `kind: 'simulation'` używa tego samego `EngineHost`, scen Boot/Preload/Title,
ładowania zasobów, audio i interfejsu katalogu co platformówka. Model bez Phasera
jest w `engine/simulation/model.ts`; renderer i adapter myszy pozostają w silniku.
Konfiguracja i grafiki Winobrania są wyłącznie w katalogach gry.

## Nowy tytuł: przykład tartaku

1. Utwórz `src/games/tartak/index.ts`, importując `SimulationDefinition` z publicznego
   `engine/api`. Ustaw własne `id`, `version`, `title`, `description`, `catalog`,
   `assets`, `spriteSheets` i `levelUrl`. Dodaj konfigurację do `games/registry.ts`.
2. Umieść mapę i PNG w `public/assets/games/tartak/`. Mapa ma `schemaVersion: 1`,
   własne `id`, `title`, wymiary siatki, `tileSize`, `roads`, `blockers`, `camera`.
3. Zadeklaruj zasoby, np. `logs` o `unitValue: 2` i `boards` o `unitValue: 1`.
   Źródło typu `source` ma początkowy `stock: { logs: 48 }`, `harvestResource: 'logs'`,
   `harvestSeconds`, prostokąt oraz dostępne `workPoints` wzdłuż jego krawędzi.
4. Dodaj `depot` (plac), `processor` (piła) i `storage` (magazyn desek).
   Receptura piły: `{ input: 'logs', output: 'boards', inputAmount: 1,
outputAmount: 2, seconds: 4, destination: 'boards-store' }`.
   Ustaw cel `{ storage: 'boards-store', resource: 'boards', amount: 96 }`.
5. Zdefiniuj aktorów `worker` i `vehicle`, ich `capacity`, `speed` w komórkach/s,
   `depot`, `loadSeconds`, `unloadSeconds`, tekstury i punkty startowe.
   Pojazd wymaga pełnego przejazdu 3×3 komórki po drogach; pracownicy omijają
   prostokąty obiektów i blokery. Zostaw miejsce do manewrowania przy każdym `access`.
6. `stockVisual` pokazuje ilości w slotach (tekstura, `unitSize`, względne offsety
   komórek). `fillTexture`, `fillOffset` w pikselach i `capacity` pokazują napełnianie
   magazynu. Renderer sortuje obiekty po Y. Arkusze pracowników mają cztery klatki:
   spoczynek, dwa kroki, praca; pojazd i procesor po dwie. Przygotuj je w tym układzie.

Nie kopiuj modelu, nawigacji ani scen Winobrania. Bieżący kontrakt wspiera jeden
etap receptury, jeden typ ładunku źródłowego na trasę i prostokątne obiekty.
Nie jest edytorem ani systemem dowolnych skryptów. Zmiana formatu lub zawartości
wymaga świadomej zmiany `version`; niekompatybilny zapis jest odrzucany.

## Sterowanie i zadania

Kliknięcie pracownika wybiera go, źródła dodaje zbiór; bez wybranego pracownika
silnik rozdziela zlecenia między najmniej zajęte jednostki. Kliknięcie placu
przydziela załadunek pojazdowi. Kliknięcie procesora z pojazdem mającym ładunek
lub oczekujący załadunek dodaje dostawę. Bez takiego pojazdu włącza/wyłącza maszynę.
Puste pole usuwa zaznaczenie, jego przeciągnięcie przesuwa kamerę, kółko przybliża.
Publiczne `host.command` udostępnia wybór, anulowanie i zoom dla przycisków HTML.

Anulowanie usuwa kolejkę; pracownik najpierw odkłada niesiony ładunek, pojazd
zachowuje swój. Niedostępna trasa nie teleportuje jednostki — pokazuje stan blokady.
Źródła są rezerwowane zadaniem, aby dwaj pracownicy nie dublowali tego samego zbioru.
Produkcja zachowuje sumę wartości zasobów, walidator odrzuca niezbilansowane receptury.

## Zapis i testy

`pixelforge:simulation:v1:<gameId>` przechowuje wersję gry, pozycje, trasy,
kolejki, postęp pracy, ładunki, magazyny, stan maszyny i czas. Automatyczny zapis
następuje podczas gry, po poleceniu, pauzie, wyjściu i zakończeniu. Kamera i
zaznaczenie są stanem widoku; wznowienie przywraca widok mapy. Uszkodzony zapis
uruchamia świeży model. Platformówka zachowuje własny format v2.

`tests/unit/simulation.test.ts` sprawdza A*, bilans, anulowanie i pełny cykl oraz
odrzucanie uszkodzeń. Test przeglądarkowy używa szybszych parametrów mapy do regresji.
`tools/play-vineyard.mjs` przechodzi rzeczywistą mapę kliknięciami bez przyspieszania
czasu; `PLAY_URL` pozwala wskazać adres uruchomionego serwera.
