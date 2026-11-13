# PixelForge — roadmapa wdrożenia dla Codexa

**Wersja planu:** 0.1. **Stan początkowy:** brak implementacji, dokumentacja przygotowana.

## Reguła wykonywania

Codex realizuje etapy **po kolei**, każdy kończy działającym buildem i raportem. Nie rozpoczynaj kolejnego etapu bez osobnego polecenia użytkownika. W każdym etapie raportuj status `TODO`, `IN PROGRESS`, `DONE` oraz wpisz zwięzłą notatkę o decyzjach i testach.

### M0. Fundament uruchamialnego projektu

**Status: TODO. Priorytet: P0. To jest pierwsze zadanie.**

Zakres:
- Utwórz projekt Vite + TypeScript strict + Phaser **4.2.1** z `package-lock.json` i stabilnymi skryptami.
- Dodaj katalogi `src/app`, `src/engine`, `src/games`, `public/assets/games`, `tests`.
- Wprowadź `GameDefinition`, `LevelDefinition`, minimalny rejestr gier i loader z walidacją.
- Stwórz `EngineHost` i sceny `Boot`, `Preload`, `Title`, `Gameplay`.
- Uruchom mały prototyp platformówki w pixel art: prosty sprite, ruch, skok, grawitacja, podłoga/platformy, kamera i jedna interakcja.
- Dodaj launcher z jednym wybieralnym tytułem `forest-demo`; gra ma działać na komputerze i wstępnie na telefonie (przyciski dotykowe).
- Skonfiguruj ESLint, Prettier, Vitest oraz podstawowy Playwright smoke test.
- Dodaj README z instrukcją `npm install`, `npm run dev` i `npm run build`.
- Nie implementuj edytora i nie próbuj budować pełnej 30-minutowej gry.

Kryteria odbioru:
- [ ] `npm install` i `npm run dev` uruchamiają stronę bez błędów.
- [ ] Launcher uruchamia demonstrację i pozwala z niej wyjść bez przeładowania całej strony.
- [ ] Bohater reaguje na sterowanie, skacze, nie przenika przez podłoże.
- [ ] Silnik nie importuje kodu gry; konfiguracja nie jest na sztywno wpisana w silnik.
- [ ] Jeden test walidacji konfiguracji i jeden smoke test przechodzą.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` kończą się powodzeniem.
- [ ] Powstaje raport M0 z ograniczeniami, zrzutami ekranu lub opisem testu wizualnego.

**Dopiero po zaliczeniu M0 przejdź do M1 na osobne polecenie.**

### M1. Współdzielony runtime i kontrakty

**Status: TODO. Priorytet: P0.**

Zakres:
- Wydziel InputService z mapą akcji i adapterem klawiatura/dotyk.
- Zaimplementuj obsługę kolizji, entity factory i podstawowe behaviors: walk, jump, patrol, damage, collectible, trigger, checkpoint, door.
- Wydziel State/ProgressService, SaveService (localStorage i wersjonowanie) i AudioService.
- Dodaj RuleSystem z rejestrowanymi akcjami i warunkami. JSON bez kodu wykonywalnego.
- Dodaj sceny pauzy, porażki i zwycięstwa; podstawowy HUD i ekran sterowania.
- Dodaj kontrolę nieprawidłowych assetów, błędnej mapy i błędnego zapisu.
- Opisz publiczne API silnika i prosty przepis na kolejną grę.

Kryteria odbioru:
- [ ] Nowy poziom można dodać przez definicję, bez zmiany implementacji scen.
- [ ] Co najmniej jeden prefab i zachowanie są konfigurowalne.
- [ ] Zapis i wznowienie działają; uszkodzony zapis nie blokuje gry.
- [ ] Pauza zatrzymuje gameplay i wznowienie działa prawidłowo.
- [ ] Automatyczne testy kontraktów, reguł i zapisów przechodzą.
- [ ] Kontrole build/lint/typecheck/test przechodzą.

### M2. Dopieszczona gra demonstracyjna

**Status: TODO. Priorytet: P0.**

Zakres:
- Zbuduj `forest-demo` jako kompletną grę 5–8 minut z 2–3 małymi poziomami.
- Dodaj spójną oprawę pixel art: animacje idle/run/jump/hit, tło z paralaksą, dekoracje, efekty zbierania i trafień.
- Wprowadź prostego przeciwnika, przełącznik, drzwi, przedmiot kolekcjonerski, checkpoint, licznik żyć.
- Zrób krótki tutorial w samej grze, finał i ekran gratulacji.
- Dostosuj doświadczenie do dotyku i małych ekranów; zadbaj o ciszę/audio unlock i o dostępność menu.
- Zmierz wielkość builda i płynność na co najmniej jednym komputerze i urządzeniu mobilnym, jeśli dostępne.

Kryteria odbioru:
- [ ] Grę da się ukończyć od startu do zakończenia bez konsoli deweloperskiej.
- [ ] Zapis i wznowienie działają po odświeżeniu strony.
- [ ] Menu pauzy, restart, wyciszenie, porażka i zwycięstwo działają.
- [ ] Wszystkie zasoby mają ustalony status licencji.
- [ ] Przeglądarkowe smoke e2e i testy logiki przechodzą.
- [ ] Raport zawiera faktyczny wynik playtestu, przybliżony czas gry i znane ograniczenia.

### M3. Test uniwersalności: druga, niezależna gra

**Status: TODO. Priorytet: P1.**

Zakres:
- Zbuduj drugą krótką grę z widokiem `topdown` (3–5 minut), w innym katalogu `src/games/<slug>`.
- Wykorzystaj ten sam launcher, UI, audio, zapis, progres, loader i RuleSystem.
- Dodaj tylko rzeczywiście konieczne rozszerzenia silnika (np. model ruchu topdown) przez mały publiczny kontrakt.
- Oznacz w raporcie wszystkie miejsca, w których musiano zmieniać istniejący engine i uzasadnij je.
- Dodaj testy izolacji zapisów między grami i przełączania tytułów w jednej sesji.

Kryteria odbioru:
- [ ] Obie gry uruchamiają się z launchera.
- [ ] Żaden plik pierwszej gry nie jest kopiowany do drugiej w charakterze „silnika”.
- [ ] Zapis stanu jednej gry nie zmienia stanu drugiej.
- [ ] Główne systemy (menu, save, audio, sceny) są wspólne.
- [ ] Pomyślne testy regresji obu gier.

### M4. PixelForge Studio Lite

**Status: TODO. Priorytet: P2. Rozpocznij wyłącznie po M3.**

Zakres:
- Katalog projektów z miniaturą, opisem, czasem rozgrywki i przyciskiem uruchomienia.
- Podgląd mapy i inspector obiektów, a później proste przeciąganie elementów po siatce.
- Import/eksport definicji poziomów z walidacją i komunikatami.
- Zapisywanie zmian w pliku poprzez pobranie JSON albo działający interfejs File System Access z fallbackiem, **bez backendu**.
- Edytor musi używać tego samego parsera i schematu co gra, bez osobnego, niezgodnego modelu danych.

Kryteria odbioru:
- [ ] Da się utworzyć/zmodyfikować mapę i uruchomić ją w trybie testowym.
- [ ] Eksportowany poziom wczytuje się w silniku bez ręcznych poprawek.
- [ ] Nie da się zapisać niepoprawnego poziomu bez ostrzeżenia.

### M5. Szablon tworzenia gier 20–35 minut

**Status: TODO. Priorytet: P2.**

Zakres:
- Przygotuj wzorzec produkcyjny: koncepcja -> mechaniki -> 4–6 etapów -> grafika/dźwięk -> playtest -> publikacja.
- Dodaj skrypt inicjalizacji nowej gry lub prosty kreator, korzystający z gotowego szablonu.
- Stwórz jedną niezależną grę około 30 minut opartą na wspólnym silniku (osobne zadanie projektowe).
- Zbieraj czas ukończenia z dobrowolnych playtestów lokalnych, bez analityki sieciowej.

Kryteria odbioru:
- [ ] Dodanie gry nie wymaga przepisywania silnika.
- [ ] Nowa gra ma start, 4–6 etapów, kulminację i zakończenie.
- [ ] Playtesty wykazują rozgrywkę zbliżoną do 20–35 minut, a nie sztuczne odliczanie czasu.

### M6. Publikacja i utrzymanie

**Status: TODO. Priorytet: P2.**

Zakres:
- Przygotuj statyczny build pod wybrany hosting i ścieżkę bazową.
- Uporządkuj wersjonowanie silnika i kompatybilność manifestów, changelog i proces wydawania.
- Opcjonalnie dołącz PWA, pakiety offline, katalog ukończonych gier i eksport lokalnego stanu.
- Nie uruchamiaj usług zewnętrznych ani automatycznych wdrożeń bez oddzielnej decyzji.

Kryteria odbioru:
- [ ] Co najmniej dwie gry działają na środowisku docelowym.
- [ ] Aktualizacja silnika nie niszczy istniejących zapisów.
- [ ] Procedura wydania i przywrócenia poprzedniej wersji jest opisana.

## Rejestr zmian statusów

Przy zakończeniu kamienia milowego Codex dopisuje: data, etap, zakres, commit, wyniki testów, ryzyka, następne działanie. Nie oznaczaj etapu jako DONE bez sprawdzenia checklisty.

## Polecenie startowe do Codexa

> Pracujemy w repozytorium `ankelmarek/PixelForge`. Przeczytaj `AGENTS.md`, `README.md`, `docs/SPECIFICATION.md` i `docs/ROADMAP.md`. Rozpocznij **wyłącznie M0**. Najpierw krótko opisz plan, potem zbuduj działający szkielet PixelForge w Phaser 4.2.1, TypeScript i Vite. Oddziel `src/engine` od `src/games`, przygotuj prostą platformówkę demonstracyjną, standardowe komendy npm oraz testy. Na koniec uruchom testy, odnotuj status M0 i podsumuj zmiany. **Nie twórz edytora ani pełnej gry 30-minutowej.**
