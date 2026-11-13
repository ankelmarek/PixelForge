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

**Status: DONE (implementacja i testy).** Gałąź `feature/p0-core-extraction`, osobny PR do `main`; bez samodzielnego scalenia.

- [x] Przeanalizować `feature/m3-winobranie` i wcześniejsze gałęzie. Wskazać moduły wspólne oraz zależności od konkretnych gier.
- [x] Utworzyć nową gałąź roboczą z czytelną historią zależności i planem integracji bez utraty dotychczasowego kodu.
- [x] Zachować `EngineHost`, system scen, walidację, audio, zapis, InputService, obsługę myszy, model symulacji, A* i transport zasobów, gdy są rzeczywiście niezależne od gry.
- [x] W nowym aktywnym katalogu gier **nie oferować Winobrania ani Leśnego sygnału**. Historyczne zasoby mogą pozostać w Git/archiwum; żadnych nowych funkcji gry i niepotrzebnych migracji.
- [x] Dodać niezależne testy generycznych modułów, aby nie potrzebowały aktywnego `winobranie` albo `forest-demo` do zaliczenia.
- [x] Przygotować PR, wyniki testów i opis odzyskanych modułów. **Nie scalać bez zgody użytkownika.**

Odzyskano 21 modułów silnika z przypiętego M3 `96b9e73`, bez importowania
produktów ani scalania PR #1–#4. Katalog aktywnych gier jest pusty.
Testy: lint/typecheck/build PASS, 25 jednostkowych PASS, E2E 11 PASS + 1 SKIP.
Build sprawdzono pod `/` i `/PixelForge/`, desktop i emulacja Pixel 7.
Raport: [P0-REPORT.md](P0-REPORT.md), inwentaryzacja:
[CORE-INVENTORY.md](CORE-INVENTORY.md), dalszy podział:
[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).
W chwili zamknięcia P0 etapy P1 i P2 pozostawały niezrealizowane. Aktualny
wynik P1 opisano poniżej; nie wybrano tytułu P3 ani hostingu.

### P1. Duże mapy i kamera 2D

**Status: DONE (implementacja i testy).** Gałąź `feature/p1-large-worlds`,
osobny PR do `main` zależny od P0 / PR #5. Bez samodzielnego merge.

- [x] Docelowy świat 4096 × 4096 pikseli lub większy, konfiguracja rozmiaru i sektorów zależna od gry; limit nie może być zapisany na sztywno w silniku.
- [x] Mapa składa się z kafli i niezależnie ładowanych chunków (np. 256/512 pikseli na chunk zależnie od `tileSize`). Nie renderować całej mapy jako jednego ogromnego PNG.
- [x] Przesuwanie kamery myszką przez przeciąganie pustego terenu, przybliżanie/oddalanie kółkiem, opcjonalna minimapa i skok widoku do zaznaczonego obiektu.
- [x] Kamera rozpoczyna na fragmencie świata, który nie pokazuje całej mapy jednocześnie; brak czarnych pasów/odsłoniętej pustki na krawędziach.
- [x] Sprite’y i dekoracje renderować oraz aktualizować stosownie do widoczności; implementować culling, grupowanie aktualizacji, lazy loading, a przy dużych odległościach uproszczone symulowanie jednostek.
- [x] Nawigację podzielić na regiony lub użyć hierarchicznej ścieżki. Nie wykonywać pełnego A* na całej siatce 4096 × 4096 pikseli dla każdego zlecenia.
- [x] Zadania jednostek poza ekranem muszą nadal działać prawidłowo; rozliczanie surowców i postępu niezależne od renderowania.
- [x] Testy: 4096 × 4096, rozszerzenie do 8192 × 8192, przesuwanie i zoom, dostęp do narożników, zapis/wznowienie, poruszanie w wielu sektorach, długie trasy i brak widocznych szwów na granicach chunków.
- [x] Zmierzyć pamięć i FPS na desktopie oraz w emulacji telefonu; celem jest stabilna rozgrywka, nie deklaracja bez pomiaru.

Atlas uruchamia oba rozmiary świata przez wspólny `EngineHost`. Sektory 512 px,
cache danych 24, culling, graf komponentów/przejść i lokalne A*, model 20 Hz oraz
zapis v2. Dotyk, narożniki, zoom i zadania poza ekranem sprawdzone w Chromium.
45 testów jednostkowych PASS; E2E 22 PASS + 2 oczekiwane SKIP dotyku na desktopie.
Pomiary FPS/pamięci i ograniczenia: [P1-REPORT.md](P1-REPORT.md).
Format świata i sposób pomiaru: [LARGE-WORLDS.md](LARGE-WORLDS.md).
Następny etap: P2/U0. Nie rozpoczęto U1/U2 ani żadnej gry P3.

**Odbiór użytkownika — 2026-11-13:** bieżąca paczka P1 działa na jego serwerze.
Poprawka prezentacji wykonana w paczce P1 0.5.1:

- [x] Po uruchomieniu Atlas zajmuje cały dostępny obszar okna przeglądarki;
      widok świata wypełnia okno, bez osadzenia w małej karcie strony.
- [x] Kontrolki i minimapa są nakładką na świat; zachować ostre piksele,
      poprawne proporcje, wygodny dotyk oraz dopasowanie po zmianie rozmiaru
      i orientacji ekranu.
- [x] Sprawdzić ten układ na desktopie i w emulacji telefonu oraz wydać nowy ZIP.

Pełne okno oznacza obszar strony, bez wymuszania F11/Fullscreen API.
Weryfikacja: 47 testów jednostkowych, E2E 24 PASS + 2 SKIP; rozpakowany ZIP
8/8 PASS. Szczegóły: [raport poprawki](P1-FULL-WINDOW.md).
Kolejny zakres: **P2/U0: generator paczek full i walidator offline**.

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

- [x] Silnik uruchamia demonstrację dużego świata niezależną od Winobrania i od platformówki.
- [x] Obraz mapy jest stabilny podczas przesuwania i przybliżania; nie ma sztucznie małego obszaru działania.
- [x] Zadania jednostek i zapis działają między sektorami, także poza kamerą.
- [ ] Aktualizator instaluje paczkę ZIP, wykonuje walidację i w razie błędu wraca do poprzedniej wersji.
- [x] Przy dalszych pracach nie są rozwijane `winobranie` ani `forest-demo`.
- [ ] Każdy nowy tytuł posiada osobny zestaw testów i nie duplikuje kodu silnika.

## 5. Pierwsze zadanie dla Codexa po tej decyzji

> Przeczytaj `AGENTS.md`, bieżącą `docs/ROADMAP.md` i `docs/UPDATER-SPEC.md`. Poprzednia roadmapa jest archiwum. Nie rozwijaj „Winobrania” ani platformówki „Leśny sygnał”. Przeprowadź przegląd gałęzi/PR #1–#4, zaproponuj sposób odzyskania wspólnego rdzenia bez automatycznego scalania, a następnie przygotuj plan modułu dużych map i aktualizatora ZIP zgodny z nowymi priorytetami. Wdrażaj etapami i na osobnych gałęziach. Bez samodzielnego merge i publikacji.

## 6. Rejestr realizacji

### 2026-11-13 — P0: wydzielenie rdzenia

- Baza `main` / `ead7666`, gałąź `feature/p0-core-extraction`.
- Odczytano PR #1–#4; wszystkie otwarte, bez merge. Selektywny import wspólnych
  plików, bez aktywnych produktów i bez zmian historycznych gałęzi.
- Syntetyczne fixture'y zastąpiły zależności testów od gier; brak migracji zapisów.
- Kontrole i wyniki: raport P0. Fizyczne urządzenia i inne silniki przeglądarek
  nie zostały sprawdzone. Duże mapy i aktualizator są dopiero zaplanowane.
- Następny krok: przegląd P0, następnie osobny zakres P1. Bez automatycznego merge,
  wdrożenia, rozpoczęcia P3 lub przywracania zakończonych produktów.

### 2026-11-13 — P1: duże światy

- Baza P0 `de1945d`, gałąź `feature/p1-large-worlds`; dokumentacja main nadal
  `ead7666`. PR #5 jest zależnością, bez automatycznego scalenia stosu.
- Wdrożono P1A–P1D: manifest v2, sektory, ograniczony cache, kamera, culling,
  regionalna nawigacja, trwała symulacja i zapis. Atlas jest oddzielnym klientem
  technicznym; aktywny katalog produktów pozostaje pusty.
- Testy, pomiary i ograniczenia opisuje raport P1. Zachowano kontrakty v1,
  przetestowano obie mapy, desktop i emulację Pixel 7. Fizyczny telefon i inne
  silniki przeglądarek wymagają osobnego sprawdzenia.
- P2/U0 to kolejny zakres. Aktualizator, hosting, P3 i P4 pozostają poza P1.
