# PixelForge — aktualna roadmapa 0.3

**Decyzja:** 14 listopada 2026. **Stan:** W0 nowej gry **Winobranie RTS: Trzy sezony** wykonane — inwentaryzacja, kontrakty i plan. W1 i W2 są bazą kolejnych zleceń. Po poleceniu „Rób nowy zakres” zaimplementowano W3: trzyletnią kampanię, rozbudowę, ekonomię i produkcję wina. W3 jest do odbioru; W4 nie rozpoczęto. **Główny dokument produkcyjny:** [WINOBRANIE-RTS.md](./WINOBRANIE-RTS.md).

**Stacja na Trasie:** S0 zaakceptowane kolejnym poleceniem. **S2 do odbioru** — rozbudowa i najem Skoczki; [raport S2](S2-REPORT.md), [projekt wdrożenia](STACJA-BENZYNOWA-IMPLEMENTATION.md). S2 zaimplementowane; S3–S4 zlecone do kolejnej realizacji.

Poprzednie roadmapy zostały zachowane w [archiwum 0.2](./ROADMAP-ARCHIVE-0.2.md) oraz [archiwum historycznym](./ROADMAP-ARCHIVE-2026-11.md). Oba mają status historyczny. Jeżeli ich zapis przeczy temu dokumentowi lub `docs/WINOBRANIE-RTS.md`, obowiązuje aktualna decyzja z 14 listopada.

[Archiwum stanu wykonania z PR #12](ROADMAP-ARCHIVE-0.2-RUNTIME.md) zachowuje dodatkowo raporty realizacji P0–P3/U0–U2 i wydania 0.8.0 z gałęzi zawierającej silnik.

## 1. Obowiązujące decyzje właściciela

1. **Pierwsze, uproszczone Winobranie (PR #4) pozostaje porzucone** jako produkt. Nowe **Winobranie RTS** to osobna, dużo ambitniejsza gra strategiczno-ekonomiczna korzystająca ze wspólnego silnika i osobnego katalogu. Nie przywracaj jego dawnej mapy ani podstawowej pętli jako docelowego produktu.
2. **Leśny sygnał (platformówka)** pozostaje porzucony. Nie kontynuować.
3. Nowa gra: 8192×8192, dowolne nasadzenia i rozmieszczenie budynków w obrębie zakupionych parcel, sześć odmian, trzy lata/sezony winiarskie, ryzyko przymrozków i aktywna ochrona zraszaniem, dwa domki winiarskie na start z możliwością dokupienia, traktorki, wynajmowani pracownicy, ekonomia, produkcja, dźwięki i jasny finał.
4. Sterowanie **w całości myszą**, bez obowiązkowych skrótów i modalnych tutoriali. Dozwolone krótkie etykiety strategiczne, liczby, odmiany, ceny oraz — na późniejsze polecenie użytkownika — zwijane komunikaty „Co teraz?” z aktualnym celem, następnym krokiem i przyczyną blokady.
5. Projekt korzysta z **PixelForge**, z istniejących sektorów, dużych światów, renderera, audio, obsługi ZIP i zapisu. Nie duplikuje silnika.
6. **Kod na osobnych gałęziach, PR bez automatycznego merge i wdrażania**. Dokumentację wolno aktualizować na main, ale implementacja nie może trafiać tam bez odbioru.

## 2. Stan prac zastanych

| Obszar                                             | Obserwacja na GitHubie                                                           | Dalsze postępowanie                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Wspólny silnik i symulacja                         | PR #5                                                                            | Używać kodu niezależnego od dawnych gier                                         |
| Mapy 4096/8192, streaming sektorów i regionalny A* | PR #6                                                                            | Rozszerzyć o dynamiczne budowanie, drogi i kolizje                               |
| Wydania full ZIP, walidacja i rollback             | PR #7–#9, #11                                                                    | Zachować zgodność, nie tworzyć odrębnego instalatora                             |
| U2 / panel aktualizacji ZIP                        | Implementacja w PR #9 i #11; użytkownik potwierdził działanie panelu na hostingu | Traktować jako działającą ścieżkę dystrybucji, nie wdrażać niczego bez polecenia |
| Życie Dżdżownicy                                   | PR #10 i #12, najnowszy widoczny commit #12: `3385c6c`                           | Nie uszkodzić ani nie nadpisać gry i jej save                                    |
| Winobranie M3                                      | PR #4, historyczny                                                               | Co najwyżej źródło generycznych rozwiązań; bez kopiowania gry                    |

**Uwaga:** PR-y mogą pozostawać niepołączone z `main`. Codex przed rozpoczęciem W0 musi sprawdzić rzeczywistą aktualną gałąź z najnowszym zaakceptowanym kodem, a nie zakładać, że dokumentacyjny `main` zawiera silnik.

## 3. Główny cykl istniejącej gry: Winobranie RTS

| Etap   | Zakres                                                                                                           | Status                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **W0** | Inwentaryzacja kodu, projekt architektury, modele danych i balans wstępny                                        | DONE — dokumentacja i weryfikacja bazy |
| **W1** | Pierwszy grywalny vertical slice: duża mapa, własne rzędy, dwa domki, pracownicy, traktor, zbiór i sprzedaż      | DONE — baza dalszego zlecenia W2       |
| **W2** | 6 szczepów, wzrost roślin, pogoda, prognoza, przymrozki i zraszacze z nieprzerwaną pracą                         | DONE — baza dalszego zlecenia W3       |
| **W3** | 3 lata, zakup nowych domków, pracowników i traktorów, ekonomia, produkcja wina, warunki wygranej/przegranej      | REVIEW — implementacja i testy         |
| **W4** | 3 warianty kampanii, grafika pixel art, audio, balans, wydajność, testy E2E, pełny ZIP przez dotychczasowy panel | TODO                                   |

**Uwaga:** statusy w tej gałęzi uwzględniają implementację W0–W3 z PR #13–#16. Przed kolejnym etapem sprawdź aktualne PR i ich raporty; dokumentacyjny `main` może nie zawierać kodu. Specyfikacja: [WINOBRANIE-RTS.md](./WINOBRANIE-RTS.md). Każdy etap powinien być ukończony, przetestowany i zrecenzowany przed kolejnym. Nie deklarować ukończenia całej gry po zbudowaniu pierwszego prototypu.

### Wykonane zadanie: W0

1. Sprawdź aktualną bazę kodu z PR #12, stan nowszych PR i działające usługi świata; wybierz bezpieczną gałąź bazową.
2. Utwórz oddzielną gałąź implementacji `feature/p3-winobranie-rts` z zatwierdzonego kodu, nie ze starej dokumentacyjnej gałęzi bez silnika.
3. Przeanalizuj `docs/WINOBRANIE-RTS.md` i opracuj `docs/WINOBRANIE-RTS-IMPLEMENTATION.md` opisujący kontrakty, zmiany silnika, dynamiczną nawigację, system parcel i rozmieszczania, model ekonomii i pogody, stany zapisu i kolejność testów.
4. Na końcu W0 przedstaw plan W1 i granice zależności; bez automatycznego tworzenia pełnej gry W1–W4.
5. Nie scalaj PR ani nie wgrywaj ZIP na serwer bez zgody.

Wynik: [plan wdrożenia i kontrakty](WINOBRANIE-RTS-IMPLEMENTATION.md),
[raport W0](W0-REPORT.md). Bazą jest `3385c6c7` / PR #12; bieżące wymagania
z `main` `cdbe163` włączono tylko do gałęzi roboczej. Runtime i paczki 0.8.0
pozostają bez zmian. Następny zakres to W1a–W1d, po osobnym zleceniu;
nowy tytuł nie jest jeszcze dostępny w launcherze ani ZIP-ie.

## 4. Kolejka pozostałych gier

- **Miodobranie:** zaakceptowana koncepcja, osobny etap w przyszłości.
- **Stacja na Trasie: Wielki Weekend:** [pełna specyfikacja RTS](./STACJA-BENZYNOWA.md), osobna gra ekonomiczna z ruchem pojazdów, usługami, 3 zmianami i końcem po około 30 minutach. **S2 do odbioru**: rozbudowa na 12 minut; S3–S4 zlecone do kolejnej realizacji. Nie wstrzymuje prac nad Winobraniem RTS.
- **Życie Dżdżownicy:** istniejąca produkcja; zachować kompatybilność.
- Pozostałe koncepcje pozostają propozycjami, nie aktywnymi zadaniami.

### Plan rozwoju Stacji na Trasie (oddzielny cykl)

Specyfikacja: [STACJA-BENZYNOWA.md](./STACJA-BENZYNOWA.md). Status: S0 zaprojektowane na bazie PR #16; [kontrakty i plan S1](STACJA-BENZYNOWA-IMPLEMENTATION.md). **Nowy wariant ekonomiczny:** fikcyjna polska stacja **ORLAR** ma możliwość prowadzenia własnego sklepu lub wynajęcia go sieci **Skoczka**, z czynszem, kontraktem, odmiennymi obowiązkami i ruchem klientów. Implementacja S2 w weryfikacji; branding autorski, bez kopiowania realnych znaków ORLEN i Żabka.

| Etap | Cel                                                                                                   | Status                         |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| S0   | Inwentaryzacja aktualnego PixelForge, architektura symulacji ruchu i kolejek, projekt ekonomii        | DONE — baza zleconego S1       |
| S1   | Grywalna stacja, dwa dystrybutory, sklep, pracownicy, cysterna, pierwsza sprzedaż i podstawowy dźwięk | REVIEW — implementacja i testy |
| S2   | Swobodna rozbudowa, ruch samochodów, pracownicy, ceny oraz **najem sklepu fikcyjnej sieci Skoczka**   | REVIEW                         |
| S3   | Myjnia, ekonomia, zdarzenia i 3 zmiany kończące się wynikiem                                          | TODO                           |
| S4   | Warianty, pixel art, dźwięki, balans, testy, pełny ZIP dla istniejącego panelu                        | TODO                           |

**Zależność:** nowa gra używa istniejącego silnika, sektorów, nawigacji i zapisu. Codex przed rozpoczęciem S0 musi sprawdzić ostatni działający kod i PR #15 lub nowszy, ponieważ `main` może zawierać tylko dokumentację. Oddzielna gałąź `feature/p3-stacja-benzynowa`, brak automatycznego scalania i wdrażania. **Nie rozpoczynaj S1 bez akceptacji S0.**

S0 zostało następnie zaakceptowane poleceniem „Możesz kontynuować”.
S1 jest na osobnej gałęzi `feature/s1-stacja-benzynowa`; opis wykonania
i dowody znajdują się w sekcji 12 oraz [raporcie S1](S1-REPORT.md).

### Wykonane S0 — 14 listopada 2026

Baza `7f678a1` / PR #16, osobna gałąź `feature/p3-stacja-benzynowa`.
Inwentaryzacja odróżnia istniejącą dynamiczną nawigację od projektowanych
pasów ruchu, zajętości i FIFO. Plan definiuje świat 4096², limit 32 jednostek,
stany auta/dostawy/pracownika, podgląd i zatwierdzenie budowy, koszt zapasów,
finanse, osobny zapis `gas-station`, budżety grafiki/audio oraz macierz testów.

S1: sześciominutowy wycinek z dwiema pompami, własnym sklepem, dwoma ludźmi,
cysterną i jedną rozbudową; cel 12 obsłużonych oraz dodatni wynik operacyjny.
S2: dobrowolny najem z oddzielnym obrotem Skoczki, kasą paliwową ORLAR,
przejęciem lokalu i idempotentnym czynszem. S0 proponuje do balansu 120
czynszu lub 50 + 8% obrotu zamiast przykładowych 450 / 200 + 8% ze specyfikacji.
S3: zmiany 8/12/10 minut, finał ≥60 aut, satysfakcja ≥70%, wartość netto >0.

Wykonane kontrole i ograniczenia zapisano w [raporcie S0](S0-REPORT.md).
Nowsze CI #20 bazy wykryło timeout E2E pełnej kampanii W3; pozostałe 46
scenariuszy przeszło. Niestabilność wymaga wyjaśnienia przed odbiorem S1.
Testy bazy nie potwierdzają jeszcze grywalności Stacji. Runtime, zależności,
instalator i paczki 0.11.0 pozostają bez zmian; brak nowego wpisu w katalogu.
Następny zakres po odbiorze: S1a–S1d, bez samoczynnego przejścia do S2.

## 5. Dalsza infrastruktura

- **U3 / paczki delta:** opcjonalny kolejny etap, nie jest blokadą dla Winobrania RTS. Na początek wystarczą paczki full zgodne z działającym panelem.
- **PixelForge Studio:** osobny przyszły etap. Winobranie może mieć narzędzia do budowania podczas gry, co nie oznacza projektowania ogólnego edytora silnika.
- **Duże światy:** streaming i regionalny A* istnieją. W tej grze priorytetem jest dynamiczna zmiana dróg i parcel, nie ponowne budowanie sektora od zera.

## 6. Kryteria odbioru całego przedsięwzięcia

- [ ] Nowa winnica ma rzeczywistą przestrzeń do rozwoju, a nie dawną małą mapę.
- [ ] Gracz sam rysuje rzędy i drogi oraz ustawia dwa domki winiarskie i może kupować kolejne.
- [ ] Dostępne są pracownicy do zatrudniania, traktory do zakupu, zasoby i wieloetapowa produkcja.
- [ ] Sześć odmian różni się zachowaniem oraz ekonomią; nowe nasadzenia wymagają czasu.
- [ ] Realistycznie uproszczony przymrozek i zraszanie ciągłe zmieniają wynik plonów.
- [ ] Wszystkie działania wymagane do wygranej działają samą myszą.
- [ ] Atmosfera żyjącego świata z animacjami i dźwiękami; mute działa.
- [ ] Kampania trwa około 30–35 minut w zweryfikowanych playtestach i zawsze ma zakończenie.
- [ ] Atlas i Dżdżownica przechodzą regresję, zapis gry nie narusza ich zapisów.
- [ ] ZIP gry przechodzi walidację i może być obsługiwany przez istniejący aktualizator; instalacja na hostingu tylko po decyzji użytkownika.

## 7. Zrealizowane polecenie W0

> Pracujemy w `ankelmarek/PixelForge`. Użytkownik zatwierdził nowe `Winobranie RTS: Trzy sezony`, zupełnie różne od starego porzuconego prototypu. Przeczytaj `AGENTS.md`, `docs/ROADMAP.md`, `docs/WINOBRANIE-RTS.md` i `docs/LARGE-WORLDS.md` z właściwych gałęzi. Sprawdź najnowszą uruchamialną bazę (PR #12 lub nowsza), nie opieraj nowych prac wyłącznie na dokumentacyjnym main. Zrealizuj tylko **W0**: analizę architektury i plan wdrożenia z kontraktami i testami. Przygotuj osobną gałąź, nie dotykaj kodu innych gier i panelu. Po W0 przedstaw raport oraz plan W1. Nie wykonuj automatycznie W1–W4, nie scalaj do main i nie wdrażaj na serwer.

## 8. Rejestr wykonania — 2026-11-14

- Sprawdzono PR #1–#12; brak nowszej implementacji niż #12. Wybrano działający
  kod 0.8.0 z potwierdzonym CI, zachowując odrębny odbiór grywalności Dżdżownicy.
- Utworzono `feature/p3-winobranie-rts`; uzgodniono dokumentację roadmapy 0.3
  z działającą bazą, zachowano historię wykonania P0–P3 i aktualizatora.
- Opracowano kontrakty klienta, stan/zapis, transakcje budowania, lokalną
  invalidację nawigacji, zegar x1/x2/x4, rezerwacje i partie, ekonomię, przymrozek
  z ciągłym zraszaniem, trzyletni finał oraz macierz testów i przyrosty W1.
- Ponownie wykonano typecheck, testy logiki/pakietów/PHP, build i E2E bazy.
  Szczegóły oraz kontrola identyczności źródeł i paczek: [raport W0](W0-REPORT.md).
- Nie dodano runtime nowej gry, nie rozpoczęto W1–W4/U3/Studio, nie wdrożono
  niczego na hosting i nie scalono PR do main.

## 9. W1 — pierwszy sezon (2026-11-14)

Gałąź `feature/w1-winobranie-rts`, baza W0 / PR #13. Implementacja obejmuje
W1a–W1d: publiczny teren bez statycznego schematu symulatora, lokalną zmianę
nawigacji i bezpieczny preview, zegar, budżet/rezerwacje, osobny klient z własnymi
panelami, 256 sektorów mapy 8192², parcelę startową i zakup sąsiednich, trzy
odmiany, własne rzędy/drogi, dwa domki, 2 ludzi i traktor, rzeczywiste zbiory,
transport, tłoczenie, sprzedaż moszczu i finał po 360 s. W1 ma własny zapis v1.

[Raport W1](W1-REPORT.md) podaje testy, pomiar i ograniczenia. Wydanie 0.9.2
zawiera także dotychczasową Dżdżownicę i Atlas; instalator pozostaje 1.2.0.
Archiwa 0.8.0 nie są zmieniane. Pełny sezon sprawdzono automatycznie przez UI
przy ×4, bez ustawiania środków/zasobów poza rozgrywką. Odbiór przez użytkownika
i badanie z osobami nieznającymi gry pozostają osobne. Dalsze zlecenie W2 opisano w sekcji 10.

W1: 85 Vitest, 15 testów paczek, 36 PHP/Python, 12 Apache/PHP,
45 Playwright PASS (5 uzasadnionych pominięć), build, lint, typecheck oraz
komplet przeglądarkowych install/rollback/reinstall PASS. [PR #14](https://github.com/ankelmarek/PixelForge/pull/14).

### Poprawka W1 po uwadze użytkownika — 0.9.3

Zwijany panel „Co teraz?” wskazuje aktualny cel, najbliższy krok i przyczynę
blokady. Potrafi wskazać kamerą domek z gotowym moszczem albo jednostkę
wymagającą uwagi. Działa także po wznowieniu i nie zmienia formatu zapisu.
Ta decyzja zastępuje wcześniejszy zakaz podpowiedzi tekstowych dla Winobrania;
nie zmienia zakresu W2. [Raport poprawki](W1-GUIDANCE.md), bieżący ZIP 0.9.3.

## 10. W2 — żywy sezon (2026-11-14)

Użytkownik po W1 polecił: „ok, teraz rozwiń grę, zróżnicuj, losuj, zrób ciekawszą”.
Zakres przełożono na W2 z istniejącej roadmapy. Gałąź
`feature/w2-winobranie-seasons`, baza `b5c80d1` / PR #14; wydanie 0.10.0,
klient Winobrania 0.2.0. [Raport W2](W2-REPORT.md).

Sześć odmian, fazy wzrostu, wiek/gleba/słońce, losowany seed nowej gry,
pogoda i prognoza 1–3 dni, przymrozek i odmarzanie, susza oraz pielęgnacja.
Instalacja wody: zbiorniki, pompy, rury, zraszacze, Auto/Ciągle/Wyłączony,
płatna dostawa i energia. Ochrona wymaga ciągłego strumienia i zachowuje
bilans zasobów. Nowy sezon trwa 600 s, stary zapis W1 kończy swoje 360 s.
Zapis v2 migruje v1 bez jego nadpisania. Nowe efekty oraz komunikaty są
ograniczone do klienta gry. Instalator pozostaje 1.2.0.

Lokalnie: 100 Vitest, 15 testów paczek, 36 PHP/Python, 12 Apache/PHP oraz
46 Playwright PASS (6 pominięć zgodnych z platformą); TypeScript, build
i walidacja pełnego ZIP PASS. Kontrole produkcyjnego archiwum, instalacji,
rollbacku i public_html są także objęte CI; szczegóły podaje raport W2.
W3 zostało następnie osobno zlecone; wykonanie opisuje sekcja 11.

## 11. W3 — trzy roczniki (2026-11-14)

Polecenie: „Rób nowy zakres”. Gałąź `feature/w3-winobranie-campaign` powstała
z `3fdb6f9` / PR #15, którego pełne CI przeszło. Wydanie aplikacji 0.11.0,
klient 0.3.0; instalator nadal 1.2.0. [Raport W3](W3-REPORT.md).

Trzy automatyczne roczniki po 600 s, starzenie nasadzeń i nowa pogoda każdego
roku; dodatkowi pracownicy, trzy warianty floty i drogi 5 pól, kolejne domki,
ulepszenia, identyfikowane partie gron/moszczu/wina/butelek, jakość,
kontrakty, płace, utrzymanie, płynność i trzy wyniki kampanii. Cel 300 butelek
został dobrany po symulacjach; 500 z planu W0 było propozycją, nie wymaganiem
zamkniętego balansu. Pozostałe warunki: jakość ≥65, wartość netto ≥0 i dwa
szczepy z plonem w roku 3. Zapis v3 kontynuuje starsze W1/W2 w trybie zgodności.

115 testów logiki PASS, w tym sześć pełnych kampanii z prawdziwymi komendami,
zgodność ×1/×4 i wznowienia oraz pełny magazyn butelek. Kampania przez UI
osiągnęła 415 butelek i sukces; 46 wcześniejszych scenariuszy przeglądarkowych
przeszło regresję. Pełne CI #19 zaliczyło 47 E2E oraz kontrole paczek,
instalacji, rollbacku i hostingu. Raport zawiera wyniki, obrazy i archiwa.
W4 wymaga kolejnego polecenia; bez samodzielnego merge lub wdrożenia.

## 12. S1 — pierwsza zmiana ORLAR (2026-11-14)

Polecenie „Możesz kontynuować” po S0. Gałąź `feature/s1-stacja-benzynowa`
powstała z `4feec4e` / PR #17. Wydanie PixelForge **0.12.0**, nowy klient
`gas-station` **0.1.0**, instalator nadal **1.2.0**. [Raport S1](S1-REPORT.md).

Świat 4096² i 64 sektory, sześciominutowa zmiana, dwie pompy E95/ON,
własny sklep i dwóch pracowników. Auta podjeżdżają, stoją w fizycznych
kolejkach, tankują; kierowcy idą do kasy i wracają. Punktacja dopiero przy
wyjeździe po zapłacie. Cysterna rozładowuje rzeczywisty zapas, artykuły
pracownik przenosi do sklepu. Trzeci dystrybutor wymaga zakupu i budowy.
Zysk jest oddzielony od gotówki i zapasów; sukces to ≥12 klientów i zysk >0.

Rezerwacje przestrzeni/FIFO, dziennik transakcji i miks audio są generycznym
API silnika. Reguły stacji, oryginalny pixel art, UI, kamera i zapis v1
są oddzielnym klientem. Obsługa myszą i podstawowy dotyk, pełne okno,
zoom 0.5–2, minimapa, pauza, ×1/×2/×4 i wyciszenie. Brak tutorialu tekstowego.

Pełna zmiana przez UI zakończyła się 14 obsłużonymi i zyskiem +371 monet.
Testy modelu obejmują dwa seedy, momenty budowy, kolejki, braki obsady,
częściowy rozładunek, wznowienie i bilans zasobów. 135 Vitest, 15 testów
paczek, 36 PHP/Python, 12 Apache/PHP i 52 E2E PASS (8 pominięć według
platformy), w tym naprawiona regresja W3. 25 prób dystrybucji także PASS.
Pomiar S1 przy ×4 i zoomie 0.5: 56.6 FPS, p95 16.8 ms przy obserwowanych
17 jednostkach; limit 32 wymaga osobnego testu obciążenia przed S2.
Raport podaje metody i ograniczenia. ZIP `full` służy istniejącemu panelowi,
`public-html` pierwszej instalacji. Archiwalne wydania 0.11.0 są niezmienione.
[PR #18](https://github.com/ankelmarek/PixelForge/pull/18),
[pełne CI #23 — PASS](https://github.com/ankelmarek/PixelForge/actions/runs/43649290650)
dla kodu i paczek `f861147`; końcowe uzupełnienie dotyczy wyłącznie dokumentacji.

**Historyczny stan po S1:** S1 REVIEW, S2–S4 TODO. Następne polecenie opisano w sekcji 13.
Najem Skoczki, swobodne budowanie, myjnia i trzy zmiany nie są jeszcze
dostępne. Nie wdrożono gry na hosting i nie scalono PR do `main`.

## 13. S2 — rozbudowa i Skoczka (2026-11-15)

Polecenie „ok, realizujj kolejne etapy” upoważnia do S2 → S3 → S4,
każdego na osobnej gałęzi i w PR, bez automatycznego merge i hostingu.
Baza S2: `6dafa75` / PR #18, pełne CI #24 PASS.
`feature/s2-stacja-rozbudowa`: klient 0.2.0, przygotowywane wydanie 0.13.0,
instalator pozostaje 1.2.0. [Raport S2](S2-REPORT.md).

Swobodna rozbudowa na zakupionych działkach, skierowane drogi z kontrolą
wjazdu/wyjazdu, zwykłe i ciężarowe pompy, parkingi i dodatkowe zbiorniki.
Ceny nowych ofert, czterech pracowników, priorytety i druga kasa.
Własny sklep lub dwa kontrakty Skoczki, rzeczywiste dostawy, personel,
odrębna kolejka i obrót; proporcjonalne, jednokrotne rozliczenie najmu.
Wcześniejsze rozwiązanie na granicy okresu z karą i zachowaniem zapasów.

S2 pozostaje osobnym wycinkiem 12 minut (6 + 3 + 3), cel ≥20 wizyt
zakończonych i opłaconych oraz zysk operacyjny >0. Nie zastępuje kampanii S3
8/12/10 minut ani jej celu ≥60 aut / ≥70% satysfakcji / wartość netto >0.
Zapis v2 zachowuje v1 i wznawia scenariusz S1 w trybie zgodności.
Paczki 0.13.0 są zbudowane i sprawdzone w istniejącym aktualizatorze.
Poprawka 0.13.1 usuwa mijanie się pieszych w pętli wykryte w CI #26;
regresja tego zapisu oraz scenariusz S2 przeszły lokalnie, pełne CI ponowione.
[PR #19](https://github.com/ankelmarek/PixelForge/pull/19) pozostaje szkicem
na czas pełnej regresji CI. Lokalnie lint, typecheck, build, logika, zapis
S1/S2, desktop i emulacja dotyku, 12 testów hostingu oraz 25 prób dystrybucji
przeszły. Raport zachowuje również pomiar p95 33.3 ms powyżej celu.
Najem ma test wygasłej i ponowionej oferty z checkpointu CI.
Bez automatycznego merge i wdrożenia; następny zlecony etap to S3.
