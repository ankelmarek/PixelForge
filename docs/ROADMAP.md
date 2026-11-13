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

**Status: U0–U2 DONE (implementacja i testy), U3 TODO. Priorytet: wysoki. Szczegółowe zadania U0–U3:** [UPDATER-SPEC.md](./UPDATER-SPEC.md).

- [ ] Wprowadzamy wersjonowane paczki `full` i docelowo `delta`, z manifestem, sumami SHA-256 i kompatybilnością wersji.
- [x] Rozwijamy walidator, katalog staging, bezpieczny rollback i log aktualizacji.
- [x] Administrator dostaje panel pozwalający przesłać ZIP, zobaczyć zakres zmian i zatwierdzić instalację.
- [x] Panel ma niezależne uwierzytelnianie i nie jest częścią statycznej gry. Wybrano PHP 8.2+ / ZipArchive.
- [x] Testy uszkodzonych ZIP, zip-slip, limitów rozpakowania, niezgodnych wersji, przerwania instalacji i przywracania poprzedniej.
- [ ] Nie uruchamiać publicznego panelu, nie otwierać uprawnień serwera i nie instalować nowych usług przed osobnym poleceniem.

**U0 wykonane na `feature/p2-u0-packages`**, osobny PR zależny od P1 / PR #6.
Generator `npm run package:release` tworzy full ZIP po udanym buildzie;
`package:validate` sprawdza manifest, wersje, ścieżki, limity, CRC i SHA-256
bez rozpakowania i instalacji. Python 3.11+ standard library, brak nowych
zależności runtime. Paczka 0.6.0 zawiera 272 pliki buildu + manifest v1.

- [x] Full ZIP z wersją, manifestem i sumami.
- [x] Walidator offline oraz testy poprawnych i złośliwych/uszkodzonych archiwów.
- [x] Instrukcja i gotowa paczka do ręcznego wgrania.

Weryfikacja: 47 Vitest + 13 testów Python (z wariantami ataków), E2E 24 PASS

- 2 SKIP, lint/typecheck/build PASS, rozpakowany full ZIP 8/8 PASS.
  [Raport U0](U0-REPORT.md), [format paczki i CLI](RELEASE-PACKAGES.md).
  Wynik U1 opisano poniżej. Nie wdrożono panelu ani gry P3.

**U1 wykonane na `feature/p2-u1-installer` / PR #8**, baza 0.6.1 / PR #7.
Adapter PHP 8.2+ z ZipArchive i wejściem CLI instaluje full ZIP po osobnym
zatwierdzeniu planu. Prywatny staging, blokada, limity miejsca, dziennik,
wersjonowane kopie, kontrola zdrowia, rollback i odzyskiwanie po SIGKILL.
Wariant dwóch rename katalogów ma jawne krótkie okno HTTP 404; przerwanie
w tym oknie wymaga uruchomienia recover. Nie jest to atomowa podmiana.

Weryfikacja: 48 Vitest, 15 testów Python U0 i 22 testy integracji PHP U1;
walidator PHP odrzuca 129 niedozwolonych wariantów archiwów U0.
Przeglądarkowa instalacja i rollback prawdziwego Atlasu: 8/8 PASS
z zachowaniem zapisu, pod / oraz /PixelForge/, desktop i emulacja Pixel 7.
[Raport U1](U1-REPORT.md), [instrukcja](../admin-updater/README.md).
Publiczna strona zgłasza PHP 8.5.12; rozszerzenia i prawa konkretnego konta
sprawdza doctor przed instalacją. Nie wdrażano narzędzia na hosting użytkownika.
**U2 wykonane na `feature/p2-u2-admin-panel` / PR #9**, baza U1 / PR #8.
Panel PHP z własnym logowaniem, HTTPS, CSRF, prywatną sesją i limitem prób.
Upload przygotowuje plan; osobny przycisk zatwierdza instalację. Podgląd
pokazuje pliki i wersje. Dostępne są rollback, recovery i sprzątanie.
Jednorazowa konfiguracja CLI, późniejsze aktualizacje przez przeglądarkę.
Kod PHP i dane administracyjne pozostają poza statycznym buildem.

Weryfikacja: 48 Vitest + 15 Python U0 + 22 U1 + 14 U2 PASS; pełny Playwright
28 PASS + 2 SKIP, U1 browser 8/8. Panel przez HTTPS: desktop i emulacja Pixel 7,
instalacja/rollback z zachowaniem zapisu Atlasu, dodatkowo upload bez JavaScript.
272 pliki buildu gry zgodne bajt w bajt z 0.6.1. Osobny ZIP panelu 1.1.0.
[Raport U2](U2-REPORT.md), [uruchomienie](../admin-updater/README.md).
Bez merge i wdrożenia na hosting. Następny zakres U3 wymaga osobnego zlecenia.

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
- [x] Aktualizator instaluje paczkę ZIP, wykonuje walidację i w razie błędu wraca do poprzedniej wersji.
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

### 2026-11-13 — poprawka P1 i U0

- Poprawkę pełnego okna, skalowania, nakładki i dotyku dopisano do PR #6;
  wydano sprawdzony ręczny ZIP 0.5.1.
- U0 ma osobną gałąź opartą na P1 `c884fdf`: pełne paczki, manifest,
  sumy oraz niezależny walidator offline. Wydanie 0.6.0 zawiera ten sam
  statyczny runtime co 0.5.1, z manifestem aktualizatora.
- Zaktualizowano testy i instrukcje. Brak merge, wdrożenia i nowych usług.
  Następny osobny zakres to U1 po poznaniu hostingu.

### 2026-11-13 — poprawka 0.6.1 po teście hostingu

- Odtworzono migotanie terenu przy zoomie 0.5 na desktopowym Chromium:
  skalowany canvas pozwalał na ułamkowe przesunięcia próbkowanego obrazu.
  Kamera wyrównuje teraz początek widoku do siatki pikseli ekranu, również
  przy ułamkowym zoomie, resize i wznowieniu. Granice świata pozostają zachowane.
- Test obrazu z drobnym wzorem wykrywa błąd na obu mapach w 0.6.0 i przechodzi
  po poprawce. Sprawdzono także emulację Pixel 7.
- Paczki mają zapisany czas wydania (`releaseEpoch`), zamiast roku 1980,
  żeby hosting nie podawał błędnej informacji „niezmieniony” o nowszym HTML.
  Powtarzalność ZIP pozostaje zachowana; format manifestu i zapisów bez zmian.
- Kontrole: 48 Vitest, 15 Python, E2E 28 PASS + 2 SKIP; build/lint/typecheck PASS.
  ZIP 0.6.1 i [raport poprawki](HOTFIX-0.6.1.md) w aktywnym PR #7.
  U1–U3 i gry P3 pozostają poza zakresem.

### 2026-11-13 — odbiór 0.6.1 i przygotowanie U1

- Użytkownik potwierdził działanie poprawki 0.6.1 na swoim hostingu i zlecił
  dalsze prace zgodnie z roadmapą.
- Następny zakres to U1. Przygotowano [plan instalacji i macierz testów awarii](U1-INSTALLATION-PLAN.md)
  na osobnej gałęzi `feature/p2-u1-installer`, opartej na `da66565` / PR #7.
- Wybór adaptera pozostaje otwarty do ustalenia możliwości hostingu:
  PHP 8 z ZipArchive albo SSH/CLI. Nie uznajemy działania statycznego Atlasu
  za potwierdzenie tych możliwości. U1 nie jest jeszcze zaimplementowane.

### 2026-11-13 — U1: instalator PHP i rollback

- Odczyt publicznej strony rozumisie.pl wykazał zgłaszane PHP 8.5.12; DNS
  wskazuje VH.PL. Wybrano adapter PHP z kontrolą wymagań przed instalacją,
  bez oczekiwania na niepotrzebne dane dostępowe.
- Zrealizowano plan U1, dodano lokalne testy awarii procesu i test
  przeglądarkowy na prawdziwym produkcyjnym ZIP-ie. Raport opisuje wyniki,
  okno niedostępności fallbacku i ograniczenia sprawdzenia hostingu.
- Osobny ZIP narzędzia U1 1.0.0; paczka gry pozostaje 0.6.1. Testowa wersja
  0.6.2 istnieje wyłącznie w tymczasowych fixture'ach, nie jest wydaniem gry.
- Zaktualizowano PR #8. Bez merge i wdrożenia; U2/U3 i gry P3 nie rozpoczęte.

### 2026-11-13 — U2: panel WWW

- Gałąź `feature/p2-u2-admin-panel` / PR #9, baza U1 `95f310e` / PR #8.
- Zaimplementowano uwierzytelniony panel oraz jednorazowy konfigurator i reset
  hasła. Podgląd GET nie odzyskuje ani nie przełącza instalacji.
- Testy PHP/HTTPS, przeglądarkowe i rozpakowanej paczki przeszły w GitHub Actions.
  Terminal środowiska sesji był niedostępny; nie deklarujemy testów na tym terminalu.
- Wydano osobny ZIP narzędzia U2 1.1.0. Gra i zapisy pozostają w kontrakcie 0.6.1.
- Raport zawiera wyniki i ograniczenia. Bez merge, wdrożenia, U3 i gier P3.
