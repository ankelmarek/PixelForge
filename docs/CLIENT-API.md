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
