# Zaufane klienty silnika

P3 dodaje drugą ścieżkę rozszerzeń obok konfiguracji platformówki i symulatora.
Nietypowa mechanika dostarcza `ClientDefinition` (`src/engine/api/client.ts`).
Rejestr w `src/games/registry.ts` udostępnia definicję aplikacji; nie trzeba dodawać
warunków po ID w EngineHost. Import runtime może być asynchroniczny, aby Phaser
i kod gry były ładowane dopiero po wyborze tytułu.

`createRuntime(context, data)` dostaje JSON po odczycie oraz wspólne input/audio
i callbacki. Klient **waliduje dane przed tworzeniem sceny**. Zwraca listę scen,
`start(resume)`, `persist()` i `command(command)`. Scena aktywna nazywa się
`Gameplay`, sceny preload/tytułu zapewnia `createFlowScenes`. Silnik jest
właścicielem canvasu, zdarzeń globalnych, pauzy, skalowania i zniszczenia instancji.
Scena klienta czyści własne listenery/tekstury na `SHUTDOWN`.

`Snapshot` ma generyczne pola postępu, mierniki, fazę, kamerę, mapę i statystyki.
Prezentacja tytułu, celu i wyniku pochodzi z definicji. Publiczne komendy klienta
to focus, zoom i kontekstowa interakcja. JSON nie dostarcza funkcji ani skryptów.

Opcjonalne `objectiveIcon` zmienia symbol postępu także na ekranie wyniku.
`tokens` to lista `{ icon, label, active }` wyświetlana jako dodatkowy rząd
wskaźników; etykiety służą dostępności, a widoczne są symbole i wartości.
`map.regions` zawiera prostokąty `{ x, y, width, height, color }` w jednostkach
świata, rysowane pod znacznikami minimapy. Klient może w ten sposób pokazać
warstwy lub obszary dowolnej gry bez zmiany aplikacji i warunków po gameId.

`VersionedSave<T>` izoluje zapis przez gameId i wersję. Walidator `unknown -> T`
jest obowiązkowy, odczyt obcej wersji zwraca brak zapisu, nieudany zapis zwraca
`false` i nie usuwa poprzedniego. Klient nie może nadpisywać danych na ekranie tytułowym.

`MutableGrid` to oszczędna mapa zmian nad deterministyczną funkcją bazową,
z rewizjami sektorów i kontrolą przy odtwarzaniu. Publiczny moduł
`engine/api/terrain` działa bez DOM/Phasera. `MutableTerrainRenderer` dostaje
funkcję rysującą komórkę, utrzymuje wyłącznie tekstury widocznych sektorów
i odświeża sektory zmienione. Funkcja malująca może sprawdzać sąsiednie komórki;
zmiana przy szwie unieważnia również sąsiada. To moduły wspólne, bez wiedzy
o tunelach, dżdżownicach, pogodzie lub roślinach.

## Rozszerzenia W1 (addytywne)

`createControls({ root, send })` jest opcjonalną fabryką panelu klienta.
Zwraca `update(snapshot)` i `destroy()`. Host zachowuje wspólne start, pauzę,
wyciszenie, minimapę i wynik; aplikacja ukrywa domyślny krzyżak/HUD, gdy klient
ma własny panel. `client-action` niesie nazwę akcji i opcjonalny `JsonValue`.
Klient przyjmuje tylko zamknięty katalog akcji i waliduje dane; żaden JSON nie
wykonuje skryptów. `Snapshot.client` to projekcja prezentacji, `results` to
pary etykieta/wartość do wspólnego ekranu końca. Cleanup usuwa listenery DOM.

`preferredViewport` pozwala klientowi wybrać gęstszy widok, nadal ograniczony
do 640 × 960 logicznych pikseli i całkowitego skalowania canvasu.
Domyślne zachowanie Atlasu i Dżdżownicy nie ulega zmianie.

`TerrainWorld` odłącza teren i kamerę od statycznych aktorów/receptur.
`SectorRenderer` jest dostępny publicznie. Headless `engine/api/strategy`
udostępnia regionalną nawigację, `ScenarioClock`, `Ledger`, `Inventory`,
`Reservations` oraz geometrię własności. `prepare(n)` indeksuje ograniczoną
liczbę regionów, `fork()` izoluje podgląd, `invalidate(rect, halo)` wymienia
wyłącznie komponenty zmienionych sektorów i ich portale. Nie uruchamia A* na
całej mapie. Zegar ma stały tick 50 ms i tempo 1/2/4; logika działa bez renderera.

`VersionedSave.inspect()` rozróżnia `absent`, `invalid`, `ready`, zachowując
zgodność dotychczasowego `read()`. Nowa gra nie odczytuje zapisów innych tytułów.
