# P0 — inwentaryzacja i wydzielenie rdzenia

Data: 2026-11-13. Plan 0.2. Baza: `main` / `ead7666`.
Gałąź: `feature/p0-core-extraction`.

## Stan historycznych PR

Sprawdzono metadane GitHuba i lokalne drzewa wszystkich czterech gałęzi.
PR #1–#4 są otwarte i niescalone. Nie uruchomiono merge, rebase, zamknięcia PR
ani usuwania historycznych gałęzi.

| Źródło  | Odczytany HEAD                             | Odzyskane elementy                                              |
| ------- | ------------------------------------------ | --------------------------------------------------------------- |
| M0 / #1 | `100e82861935cde3bb9f7f1f96ff972c895315a4` | Host, sceny, kontrakty, walidacja, początkowe wejście i zapis   |
| M1 / #2 | `a1836e18895022cefef342667008c80b42735841` | Encje, kontroler, reguły, postęp, zapis v2, audio               |
| M2 / #3 | `0ac2eba469cf70a31643722ce7758b1077286086` | Poprawki wspólnego runtime; zawartość kampanii pominięta        |
| M3 / #4 | `96b9e73011b72fa65338d5684137d547b00f6605` | Najnowszy spójny snapshot wszystkich usług oraz moduł symulacji |

M3 zawiera wcześniejsze implementacje. Porównanie drzewa `src/engine/` z jego
przypiętym commitem nie wykazuje zmian: zachowano przetestowany runtime zamiast
łączyć cztery nakładające się wersje plików. Jest to selektywny import plików
na nowej gałęzi z aktualnego `main`, a nie merge historycznych produktów.

## Mapa odzyskanych modułów

| Moduł                                          | Zależności                              | Decyzja P0 i dowód niezależności                                                  |
| ---------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `engine/api/`                                  | Typy wejścia, reguł, symulacji          | Zachować publiczny kontrakt oraz walidatory; testy syntetycznych definicji        |
| `core/EngineHost.ts`                           | Phaser, API, sceny, usługi              | Zachować cykl życia, skalowanie, pauzę i izolację; harness uruchamia oba adaptery |
| `scenes/flow.ts`                               | Phaser, deklarowane assety              | Wspólne Boot/Preload/Title, bez importów gier                                     |
| `scenes/scenes.ts`, `components/`              | Adapter fizyki, definicje encji, reguły | Zachować jako adapter kontraktowy, bez aktywnej platformówki                      |
| `systems/input.ts`                             | Brak Phasera                            | Akcje semantyczne, łączenie źródeł, pojedyncze naciśnięcia                        |
| `systems/rules.ts`                             | Publiczne typy                          | Rejestr zaufanych funkcji; nieznane akcje/warunki są odrzucane                    |
| `systems/audio.ts`                             | Web Audio                               | Wspólne SFX, muzyka, unlock, wyciszenie i zwalnianie zasobów                      |
| `systems/storage.ts`, `save.ts`, `progress.ts` | Storage, walidowane dane                | Zachowane klucze i formaty v1/v2, brak migracji zapisów produktów                 |
| `simulation/types.ts`, `validation.ts`         | Typy audio i nawigacja                  | Dane źródeł, pojazdów, receptur i celu bez nazw produktów                         |
| `simulation/model.ts`                          | Typy i Navigator                        | Model bez renderera; kolejki, anulowanie, transfer i zachowanie wartości zasobów  |
| `simulation/navigation.ts`                     | Siatka i prostokąty                     | A* i prześwit pojazdu; zakres małych map, nie gotowe duże światy                  |
| `simulation/pointer.ts`, `runtime.ts`          | Phaser, model, save, shared flow        | Wybór, polecenia, kamera, animacja stanów, zapis pełnego modelu                   |

Dodatkowo odzyskano konfigurację TypeScript/Vite/ESLint/Vitest/Playwright i lockfile.
Nie dodano zależności. Mały generator PNG służy wyłącznie fixture'om testowym.

## Co świadomie pozostaje w historii

Nie importowano `src/games/forest-demo`, `src/games/winobranie`, ich reguł,
map, grafiki, muzyki, raportów, zrzutów, ZIP-ów ani narzędzi produkcyjnych.
Oba produkty pozostają dostępne w oryginalnych gałęziach i PR. Nie zostały usunięte
z historii ani ponownie udostępnione w aktywnej aplikacji.

Nowy `src/games/registry.ts` jest pusty. Ekran aplikacji przedstawia stan rdzenia
i brak aktywnych tytułów. Nie ma ukrytego uruchamiania porzuconych gier.

## Niezależne testy

`tests/fixtures/content.ts` tworzy minimalne syntetyczne dane: dwa źródła,
dwóch wykonawców, pojazd, plac, procesor i magazyn oraz małą geometrię kontraktu
fizyki. Nie importuje żadnej gry. Recepturę można zamienić na inny stosunek
jednostek bez zmiany modelu.

`tests/fixtures/host.html` uruchamia prawdziwy EngineHost tylko na serwerze testowym
Vite. JSON dostarcza Playwright z tych samych fixture'ów. Grafika to proste,
generowane kształty poza `public/`. Główne wejście produkcyjne nie importuje
harnessu, fixture'ów ani testów. Nie jest to nowa gra ani demo dużego świata P1.

Testy obejmują logikę i przeglądarkę: walidację, reguły, transfer, A*, blokady,
równoległe zadania, anulowanie, zapis/wznowienie i izolację, pauzę, kamerę,
wejście klawiaturą/dotykiem, kolizję, koniec sesji oraz diagnostykę błędów.
Wyniki końcowe są w [P0-REPORT.md](P0-REPORT.md).

## Ograniczenia odzyskanego API

- Obecny walidator symulacji ogranicza siatkę do 128 × 128. Nie jest to spełnienie
  wymagania 4096/8192 px; zmianę formatu i nawigacji planuje P1.
- Renderer v1 zakłada jedno tło, tworzy obiekty całej mapy i nie ma chunków,
  cullingu ani regionalnego A*. Nie należy tylko podnosić limitu w walidatorze.
- `GameDefinition` i `scenes/scenes.ts` zachowują historyczny adapter fizyki,
  w tym sloty tekstur `player`, `beacon`, `portal`. Jest zależność od gatunku
  i formatu, lecz nie od konkretnej gry. Nie zmieniano zapisów ani publicznego API
  podczas wydzielania. Dalszy kierunek dotyczy adaptera symulacji.
- Nazwy klas `Input`, `Audio`, `Navigator` i formaty zapisów pozostają niezmienione.
  Nie wykonano kosmetycznych rename ani niepotrzebnych migracji.

## Bezpieczna integracja

P0 jest osobnym PR do bieżącego `main`, z jednym commitem importu i jawnym źródłem
plików. Recenzja obejmuje odzyskany runtime i nowy testowy konsument API.
Nie wymaga scalenia PR #1–#4. Zatwierdzenie i merge pozostają decyzją właściciela.
Następnie P1 i P2/U0 mogą powstawać jako odrębne PR-y według
[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). P3 czeka na wybór tytułu.
