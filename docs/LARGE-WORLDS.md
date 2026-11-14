# Duże światy — kontrakt P1

P1 rozszerza wspólny symulator o poziom `schemaVersion: 2`. Publiczny host i
`SimulationDefinition` pozostają takie same. Gra wybiera manifest przez `levelUrl`;
silnik nie importuje demonstracji. Poziomy v1 i ich klucze zapisu działają nadal.

## Dane i granice

- `width`, `height` i pozycje obiektów są w komórkach. Wymiary w pikselach to
  `width * tileSize`, `height * tileSize`; viewport jest niezależny (domyślnie 320 × 180).
- `terrain` zawiera `revision`, `sectorSize` w komórkach, klucz atlasu `texture`,
  liczbę `frames`, kolor tła, `cacheSectors` i kompletny katalog `sectors`.
- Sektor: stabilne `id`, indeksy `x`, `y` i `url` względem **manifestu**, nie domeny.
  Katalog musi pokrywać świat dokładnie raz. Wymiary są wielokrotnością sektora.
- Plik sektora ma `schemaVersion: 1`, pasujące `id` i `revision` oraz do czterech
  warstw. Każda warstwa ma unikalną nazwę i `runs: [[frame, count], ...]`, RLE
  wierszami. Suma długości to `sectorSize²`. Pierwsza warstwa jest nieprzezroczysta;
  kolejne mogą używać `-1`. Nie ma skryptów ani zewnętrznych URL-i w sektorach.
- Drogi, przeszkody, aktorzy, zasoby, obiekty i ich punkty dostępu są trwałą,
  globalną metadaną manifestu. Chunk zawiera tylko warstwy prezentacji. Obiekty
  mogą pracować w sektorze, którego grafika nigdy nie została pobrana.
- Parser sprawdza identyfikatory, pokrycie, wersję, kafle, pozycje, budżety, zoom,
  atlas, drogi i dostępność punktów. Błąd sektora zatrzymuje scenę z diagnostyką
  oraz możliwością powrotu do katalogu. Brak automatycznej pętli ponowień.

Przykłady: `public/assets/demos/large-world/world-4096.json` i `world-8192.json`.
Oba korzystają z tych samych 512 px sektorów, atlasu **256 × 16 px** i osobnych
sprite'ów. Nie istnieje obraz całej mapy. Własny generator demonstracji:
`npm run assets:world` (Python 3, biblioteka standardowa, oryginalne CC0).

Rozmiar świata nie jest limitem 4096/8192 w silniku. `HostOptions.worldLimits`
pozwala ustawić budżet walidacji: domyślnie 4 194 304 komórki / 4096 sektorów.
To ochrona kosztu danych, nie deklaracja wydajności dla maksymalnego rozmiaru.
Sektor ma 8–64 komórki; zoom i cache muszą mieścić viewport z marginesem.
Pozostają limity MVP symulatora: 32 aktorów, 256 obiektów, 256 prostokątów
przeszkód i dróg. Dalsze zwiększanie liczby jednostek wymaga osobnych pomiarów.

## Renderer i kamera

Cache danych LRU ma 48 sektorów w demonstracji. Loader pobiera maksymalnie cztery
sektory jednocześnie, zaczyna od środka widoku i dodaje jeden sektor marginesu.
Szybki skok widoku anuluje nieaktualne żądania. Spóźniona odpowiedź po zmianie
widoku lub zamknięciu hosta nie przywraca zasobów. Sektor ma limit 256 KiB JSON.

Warstwy sektora są składane do jednej niewielkiej tekstury; tworzymy najwyżej
2 tekstury na klatkę. Tekstury i sprite'y opuszczające widok z marginesem są
niszczone. Cache przechowuje wyłącznie dane, a nie stan symulacji. Statyczne
szczegóły są grupowane w teksturach; animacje, cienie i ładunki aktualizują się
tylko dla obecnych sprite'ów. Przy odległym skoku kamery chwilowo widać jednolity
kolor terenu do pobrania kafli; przy braku sektora pojawia się komunikat błędu.
Nie jest to pełne cachowanie offline/PWA.

Kamera: przeciąganie pustego terenu, kółko z kotwicą pod kursorem, ikonowe
przyciski zoomu, reset, minimapa i przejście do obiektu. Granice uwzględniają zoom,
a viewport nigdy nie wychodzi poza świat. Dotyk: przesuwanie i przyciski zoomu;
nie ma gestu pinch. Nearest-neighbor, `roundPixels`, CSS `image-rendering` i
skalowanie całkowite, gdy mieści się w ekranie. Ułamkowy zoom może zmieniać
pozorną szerokość pojedynczego piksela; nie wprowadza filtrowania rozmywającego.

## Nawigacja i symulacja

Dla każdej użytej klasy ruchu powstaje raz indeks przechodniości: spójne
komponenty w sektorach oraz ich przejścia przez granice. Drogi i kolizje mają
indeks przestrzenny. Pojazd wymaga przejezdnego **3 × 3** obszaru drogi także
na granicy sektorów. Pracownik omija wodę/przeszkody i obrysy obiektów.

Polecenie przeszukuje graf komponentów, wybiera bliskie przejścia, a następnie
wyznacza lokalne A* ograniczone do jednego sektora. To trasa poprawna, nie
obietnica globalnego optimum odległości. Rozłączne fragmenty tego samego sektora
mają osobne wierzchołki. Budżet jednego polecenia: 8192 rozwinięcia grafu i 65 536
lokalnych rozwinięć; pojedyncze lokalne wyszukiwanie obejmuje najwyżej sektor.
Nie ma awaryjnego pełnego A* całego świata. Nieosiągalność lub wyczerpanie budżetu
przerywa zlecenie z oznaczeniem zablokowania i diagnostyką `outcome`.

Indeks powstaje synchronicznie przy pierwszej trasie danej klasy, a następne
zlecenia go współdzielą. Topologia w P1 jest statyczna; budowa drogi/przeszkody
w trakcie gry wymaga przyszłego mechanizmu unieważniania indeksu.

Model v2 wykonuje prostą symulację logiczną w kroku 50 ms niezależnie od FPS.
Jednostki poza ekranem mają tylko stan/trasy i rozliczenie zasobów, bez obiektów
Phasera, animacji i cieni. Widoczne pozycje interpolują między krokami. Czas
ukrytej/rozmytej karty nie jest nadrabiany: host pauzuje. Transport i produkcja
zachowują bilans; zapis nie zależy od obecności sektora w cache.

## Zapis i diagnostyka

Nowy namespace: `pixelforge:world:v2:<gameId>`. Rekord zawiera wersję gry,
identyfikator i rewizję świata, wymiary/sektor, kamerę oraz pełny stan modelu:
pozycje, ładunki, kolejki, ścieżki, fazy/progres zadań, zapasy i resztę kroku czasu.
Identyfikatory sektorów wynikają z katalogu i współrzędnych; obiekty mają własne
stabilne ID. Zmiana rewizji/wymiarów/wersji odrzuca niezgodny zapis; nie migrujemy
ani nie kasujemy zapisów v1. Uszkodzenie daje bezpieczny start nowej sesji.
Samo otwarcie ekranu tytułowego i powrót nie nadpisuje zapisu.

`Snapshot.world` udostępnia tylko odczyt: liczbę żądań, resident/rendered/pending,
brakujące sektory, evictions, szacowane bajty tekstur i liczniki nawigacji.
Parametr `?diagnostics=1` pokazuje je w laboratorium oraz w testach. Zwykły widok
nie pokazuje szczegółów silnika ani instrukcji gameplayu. Nie ma telemetrii sieciowej.

## Weryfikacja

`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
`npm run test:e2e`. Testy korzystają z parserów i hosta używanych w runtime.

Pomiar buildu: w pierwszym terminalu `npm run preview -- --port 4194`, w drugim
`npm run measure:world` (zainstalowany Chromium Playwright). Opcjonalnie
`PIXELFORGE_BENCH_URL` i `PIXELFORGE_BENCH_OUTPUT`. Pomiar obejmuje 20 sekund,
20 zmian kamery, aktywne zadanie, zoom 0.5, oba rozmiary świata i dwa profile.
Wynik: FPS/rAF, percentyl czasu klatki, pamięć JS CDP i estymacja powierzchni
tekstur. Emulacja Pixel 7 korzysta z CPU/GPU hosta; nie zastępuje urządzenia.
Wyniki i rzeczywiste ograniczenia znajdują się w [raporcie P1](P1-REPORT.md).

## Pełne okno (P1 0.5.1)

`EngineHost({ display: 'fill', ... })` dla poziomu sektorowego v2 dopasowuje
kamerę do rodzica. Atlas nadaje rodzicowi rozmiar całego okna (`100dvh`), a HUD
jest nakładką z safe-area i celami dotyku minimum 44 px. Katalog zachowuje
zwykłe przewijanie po wyjściu z demonstracji.

Silnik wybiera wspólną całkowitą skalę obu osi. Rozmiar logiczny jest ograniczony
do 640 × 960, także na bardzo dużym monitorze; maksymalnie `skala - 1` pikseli
CSS nadmiaru canvasa jest przyciętych przy krawędzi. Nie rozciąga proporcji i nie
wywołuje Fullscreen API. Walidacja sprawdza cache i świat dla maksymalnego
viewportu przy minimalnym zoomie: w Atlasie potrzeba najwyżej 42 sektorów
z marginesem, cache ma 48. Zmiana rozmiaru zachowuje środek kamery (z ograniczeniem
do granic świata), a input i minimapa korzystają z bieżących wymiarów.
Domyślny tryb `fit` i kontrakt v1 pozostają zgodne.
