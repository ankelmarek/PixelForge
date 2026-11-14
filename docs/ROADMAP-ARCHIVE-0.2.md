# PixelForge — archiwum roadmapy 0.2 (13 listopada 2026)

To historyczny zapis decyzji o porzuceniu pierwszego prototypu „Winobranie”. **Nie jest już aktualną instrukcją dla Codexa.** Nowe „Winobranie RTS: Trzy sezony” zostało zatwierdzone 14 listopada 2026; obowiązuje [roadmapa 0.3](./ROADMAP.md) i [specyfikacja RTS](./WINOBRANIE-RTS.md).

---

# PixelForge — aktualna roadmapa

**Wersja planu:** 0.2. **Decyzja:** 2026-11-13. **Status:** zmiana kierunku rozwoju. Poprzednia roadmapa jest zachowana w [archiwum](./ROADMAP-ARCHIVE-2026-11.md).

## 1. Decyzje nadrzędne właściciela

1. **Winobranie: prace zakończone i wstrzymane bezterminowo.** Pomysł oceniony jako nudny; nie rozwijać gry, nie realizować dawnego M5, nie promować prototypu jako docelowego tytułu. Zachować tylko użyteczne, uniwersalne mechanizmy symulacji.
2. **Platformówka Leśny sygnał / forest-demo: rozwój anulowany.** Nie projektować nowych poziomów, grafiki, bosów, świata platformowego ani kolejnych wydań tej gry. Można zachować historyczne testy jako walidację regresyjną silnika do czasu zastąpienia ich testami bez aktywnej gry.
3. **Projekt PixelForge jako wspólny silnik pozostaje aktywny.** Koncentrujemy się na dużych mapach 2D z góry, grach obsługiwanych myszą, symulacjach/logistyce i wybranych tytułach przygodowych.
4. **Duże mapy:** dotychczasowa mapa Winobrania ma zaledwie 40 × 26 pól przy `tileSize=16`, czyli **640 × 416 pikseli świata**. To zdecydowanie za mało. Dla następnej produkcji jako punkt wyjścia przyjmujemy **minimum 4096 × 4096 pikseli świata**, z możliwością rozbudowy do 8192 × 8192 i map sektorowych. To wymaganie dotyczy rozmiaru świata, nie rozdzielczości ekranu ani jednej ogromnej tekstury.
5. **Aktualizator plikowy ZIP:** przygotować osobny, bezpieczny moduł pozwalający administratorowi wgrywać wydania z panelu WWW, sprawdzać pliki, instalować i cofać aktualizacje. Szczegóły w [UPDATER-SPEC.md](./UPDATER-SPEC.md). Statyczna gra sama nie może podmieniać plików na hostingu.
6. **Brak pisanych podpowiedzi w grach** pozostaje obowiązkową regułą. W grach symulacyjnych głównym wejściem jest mysz; instrukcje tekstowe można stosować w dokumentacji i zabezpieczonym panelu administratora.
7. Wszelka implementacja odbywa się na **osobnych gałęziach i przez Pull Request**, bez samodzielnego scalania do `main` i bez automatycznych wdrożeń.

## 2. Stan kodu na GitHubie

`main` zawiera przede wszystkim dokumentację. Implementacje etapów są w gałęziach i PR:

| Etap historyczny | Istniejący kod                                           | Postępowanie                                                                                                  |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| M0               | PR [#1](https://github.com/ankelmarek/PixelForge/pull/1) | Zachować działający fundament silnika, nie rozwijać gry demonstracyjnej                                       |
| M1               | PR [#2](https://github.com/ankelmarek/PixelForge/pull/2) | Rozważyć włączenie generycznych usług, zachować testy                                                         |
| M2               | PR [#3](https://github.com/ankelmarek/PixelForge/pull/3) | **Zamrozić** platformówkę i jej rozwój; nie uznawać jej za przyszły produkt                                   |
| M3               | PR [#4](https://github.com/ankelmarek/PixelForge/pull/4) | **Nie rozwijać Winobrania**; odzyskać generyczny TopDown Simulator, A*, zadania, audio, zapis i model zasobów |

Kod M3 był technicznie testowany, ale **produkt nie został zaakceptowany pod względem grywalności**. Raporty dawnych etapów pozostają materiałem historycznym. **Nie scalać mechanicznie całego stosu PR #1–#4**, jeśli oznaczałoby to przywrócenie porzuconych tytułów jako aktywnych gier. Najpierw przegląd i uporządkowanie integracji; nie usuwać wartościowego kodu ani historii Git.

## 3. Nowy harmonogram

### P0. Inwentaryzacja i bezpieczne wydzielenie rdzenia

**Status: TODO.**

- [ ] Przeanalizować `feature/m3-winobranie` i wcześniejsze gałęzie. Wskazać moduły wspólne oraz zależności od konkretnych gier.
- [ ] Utworzyć nową gałąź roboczą z czytelną historią zależności i planem integracji bez utraty dotychczasowego kodu.
- [ ] Zachować `EngineHost`, system scen, walidację, audio, zapis, InputService, obsługę myszy, model symulacji, A* i transport zasobów, gdy są rzeczywiście niezależne od gry.
- [ ] W nowym aktywnym katalogu gier **nie oferować Winobrania ani Leśnego sygnału**. Historyczne zasoby mogą pozostać w Git/archiwum; żadnych nowych funkcji gry i niepotrzebnych migracji.
- [ ] Dodać niezależne testy generycznych modułów, aby nie potrzebowały aktywnego `winobranie` albo `forest-demo` do zaliczenia.
- [ ] Przygotować PR, wyniki testów i opis odzyskanych modułów. **Nie scalać bez zgody użytkownika.**

### P1. Duże mapy i kamera 2D

**Status: TODO. Priorytet: wysoki.**

- [ ] Docelowy świat 4096 × 4096 pikseli lub większy, konfiguracja rozmiaru i sektorów zależna od gry; limit nie może być zapisany na sztywno w silniku.
- [ ] Mapa składa się z kafli i niezależnie ładowanych chunków (np. 256/512 pikseli na chunk zależnie od `tileSize`). Nie renderować całej mapy jako jednego ogromnego PNG.
- [ ] Przesuwanie kamery myszką przez przeciąganie pustego terenu, przybliżanie/oddalanie kółkiem, opcjonalna minimapa i skok widoku do zaznaczonego obiektu.
- [ ] Kamera rozpoczyna na fragmencie świata, który nie pokazuje całej mapy jednocześnie; brak czarnych pasów/odsłoniętej pustki na krawędziach.
- [ ] Sprite’y i dekoracje renderować oraz aktualizować stosownie do widoczności; implementować culling, grupowanie aktualizacji, lazy loading, a przy dużych odległościach uproszczone symulowanie jednostek.
- [ ] Nawigację podzielić na regiony lub użyć hierarchicznej ścieżki. Nie wykonywać pełnego A* na całej siatce 4096 × 4096 pikseli dla każdego zlecenia.
- [ ] Zadania jednostek poza ekranem muszą nadal działać prawidłowo; rozliczanie surowców i postępu niezależne od renderowania.
- [ ] Testy: 4096 × 4096, rozszerzenie do 8192 × 8192, przesuwanie i zoom, dostęp do narożników, zapis/wznowienie, poruszanie w wielu sektorach, długie trasy i brak widocznych szwów na granicach chunków.
- [ ] Zmierzyć pamięć i FPS na desktopie oraz w emulacji telefonu; celem jest stabilna rozgrywka, nie deklaracja bez pomiaru.

### P2. Aktualizator plikowy ZIP

**Status: TODO. Priorytet: wysoki. Szczegółowe zadania U0–U3:** [UPDATER-SPEC.md](./UPDATER-SPEC.md).

- [ ] Wprowadzamy wersjonowane paczki `full` i docelowo `delta`, z manifestem, sumami SHA-256 i kompatybilnością wersji.
- [ ] Rozwijamy walidator, katalog staging, bezpieczny rollback i log aktualizacji.
- [ ] Administrator dostaje panel pozwalający przesłać ZIP, zobaczyć zakres zmian i zatwierdzić instalację.
- [ ] Panel ma niezależne uwierzytelnianie i nie jest częścią statycznej gry. Wybór PHP lub CLI zależy od wybranego hostingu.
- [ ] Testy uszkodzonych ZIP, zip-slip, limitów rozpakowania, niezgodnych wersji, przerwania instalacji i przywracania poprzedniej.
- [ ] Nie uruchamiać publicznego panelu, nie otwierać uprawnień serwera i nie instalować nowych usług przed osobnym poleceniem.

### P3. Pierwsza nowa gra na dużej mapie

**Status: oczekuje na wybranie tytułu.** Kandydaci z zaakceptowaną koncepcją:

- **Miodobranie**: zarządzanie pasieką, terenami pożytkowymi, ulami, ramkami i wirówką.
- **Stacja Benzynowa**: ruch samochodów, dostawy cysterną, dystrybutory, obsługa sklepu i myjni.
- **Życie Dżdżownicy**: kierowanie dżdżownicą myszką, modyfikacja gleby, wilgoć i drapieżniki.

Każdy tytuł ma własną specyfikację i gałąź oraz wykorzystuje wspólny silnik. Czas rozgrywki celujemy w 20–35 minut. Nie zaczynaj implementacji żadnego z trzech tytułów bez wyboru i odrębnego polecenia.

### P4. PixelForge Studio i katalog

**Status: odłożone.** Edytor poziomów, katalog gier, import/eksport poziomów i narzędzia autorów dopiero po działającym systemie dużych map i pierwszej zaakceptowanej grze. Bez nadmiarowych funkcji.

## 4. Kryteria odbioru nowego kierunku

- [ ] Silnik uruchamia demonstrację dużego świata niezależną od Winobrania i od platformówki.
- [ ] Obraz mapy jest stabilny podczas przesuwania i przybliżania; nie ma sztucznie małego obszaru działania.
- [ ] Zadania jednostek i zapis działają między sektorami, także poza kamerą.
- [ ] Aktualizator instaluje paczkę ZIP, wykonuje walidację i w razie błędu wraca do poprzedniej wersji.
- [ ] Przy dalszych pracach nie są rozwijane `winobranie` ani `forest-demo`.
- [ ] Każdy nowy tytuł posiada osobny zestaw testów i nie duplikuje kodu silnika.

## 5. Pierwsze zadanie dla Codexa po tej decyzji

> Przeczytaj `AGENTS.md`, bieżącą `docs/ROADMAP.md` i `docs/UPDATER-SPEC.md`. Poprzednia roadmapa jest archiwum. Nie rozwijaj „Winobrania” ani platformówki „Leśny sygnał”. Przeprowadź przegląd gałęzi/PR #1–#4, zaproponuj sposób odzyskania wspólnego rdzenia bez automatycznego scalania, a następnie przygotuj plan modułu dużych map i aktualizatora ZIP zgodny z nowymi priorytetami. Wdrażaj etapami i na osobnych gałęziach. Bez samodzielnego merge i publikacji.
