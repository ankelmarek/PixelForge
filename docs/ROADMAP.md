# PixelForge — aktualna roadmapa 0.3

**Decyzja:** 14 listopada 2026. **Stan dokumentu:** roadmapa architektoniczna. Prace nad Winobraniem RTS postępują w osobnych PR, a nowa koncepcja **Stacja na Trasie** ma własną specyfikację S0–S4. **Główny dokument produkcyjny:** [WINOBRANIE-RTS.md](./WINOBRANIE-RTS.md).

Poprzednie roadmapy zostały zachowane w [archiwum 0.2](./ROADMAP-ARCHIVE-0.2.md) oraz [archiwum historycznym](./ROADMAP-ARCHIVE-2026-11.md). Oba mają status historyczny. Jeżeli ich zapis przeczy temu dokumentowi lub `docs/WINOBRANIE-RTS.md`, obowiązuje aktualna decyzja z 14 listopada.

## 1. Obowiązujące decyzje właściciela

1. **Pierwsze, uproszczone Winobranie (PR #4) pozostaje porzucone** jako produkt. Nowe **Winobranie RTS** to osobna, dużo ambitniejsza gra strategiczno-ekonomiczna korzystająca ze wspólnego silnika i osobnego katalogu. Nie przywracaj jego dawnej mapy ani podstawowej pętli jako docelowego produktu.
2. **Leśny sygnał (platformówka)** pozostaje porzucony. Nie kontynuować.
3. Nowa gra: 8192×8192, dowolne nasadzenia i rozmieszczenie budynków w obrębie zakupionych parcel, sześć odmian, trzy lata/sezony winiarskie, ryzyko przymrozków i aktywna ochrona zraszaniem, dwa domki winiarskie na start z możliwością dokupienia, traktorki, wynajmowani pracownicy, ekonomia, produkcja, dźwięki i jasny finał.
4. Sterowanie **w całości myszą**, bez obowiązkowych skrótów i tekstowych tutoriali. Dozwolone krótkie etykiety strategiczne, liczby, odmiany, ceny.
5. Projekt korzysta z **PixelForge**, z istniejących sektorów, dużych światów, renderera, audio, obsługi ZIP i zapisu. Nie duplikuje silnika.
6. **Kod na osobnych gałęziach, PR bez automatycznego merge i wdrażania**. Dokumentację wolno aktualizować na main, ale implementacja nie może trafiać tam bez odbioru.

## 2. Stan prac zastanych

| Obszar | Obserwacja na GitHubie | Dalsze postępowanie |
|---|---|---|
| Wspólny silnik i symulacja | PR #5 | Używać kodu niezależnego od dawnych gier |
| Mapy 4096/8192, streaming sektorów i regionalny A* | PR #6 | Rozszerzyć o dynamiczne budowanie, drogi i kolizje |
| Wydania full ZIP, walidacja i rollback | PR #7–#9, #11 | Zachować zgodność, nie tworzyć odrębnego instalatora |
| U2 / panel aktualizacji ZIP | Implementacja w PR #9 i #11; użytkownik potwierdził działanie panelu na hostingu | Traktować jako działającą ścieżkę dystrybucji, nie wdrażać niczego bez polecenia |
| Życie Dżdżownicy | PR #10 i #12, najnowszy widoczny commit #12: `3385c6c` | Nie uszkodzić ani nie nadpisać gry i jej save |
| Winobranie M3 | PR #4, historyczny | Co najwyżej źródło generycznych rozwiązań; bez kopiowania gry |

**Uwaga:** PR-y mogą pozostawać niepołączone z `main`. Codex przed rozpoczęciem W0 musi sprawdzić rzeczywistą aktualną gałąź z najnowszym zaakceptowanym kodem, a nie zakładać, że dokumentacyjny `main` zawiera silnik.

## 3. Główny cykl istniejącej gry: Winobranie RTS

| Etap | Zakres | Status |
|---|---|---|
| **W0** | Inwentaryzacja kodu, projekt architektury, modele danych i balans wstępny | TODO |
| **W1** | Pierwszy grywalny vertical slice: duża mapa, własne rzędy, dwa domki, pracownicy, traktor, zbiór i sprzedaż | TODO |
| **W2** | 6 szczepów, wzrost roślin, pogoda, prognoza, przymrozki i zraszacze z nieprzerwaną pracą | TODO |
| **W3** | 3 lata, zakup nowych domków, pracowników i traktorów, ekonomia, produkcja wina, warunki wygranej/przegranej | TODO |
| **W4** | 3 warianty kampanii, grafika pixel art, audio, balans, wydajność, testy E2E, pełny ZIP przez dotychczasowy panel | TODO |

**Uwaga:** poniższe statusy W0–W4 pochodzą z pierwotnego planu na `main`; rzeczywisty postęp trzeba weryfikować w PR #13–#15 i nowszych. Specyfikacja: [WINOBRANIE-RTS.md](./WINOBRANIE-RTS.md). Każdy etap powinien być ukończony, przetestowany i zrecenzowany przed kolejnym. Nie deklarować ukończenia całej gry po zbudowaniu pierwszego prototypu.

### Pierwsze zadanie Codexa: W0

1. Sprawdź aktualną bazę kodu z PR #12, stan nowszych PR i działające usługi świata; wybierz bezpieczną gałąź bazową.
2. Utwórz oddzielną gałąź implementacji `feature/p3-winobranie-rts` z zatwierdzonego kodu, nie ze starej dokumentacyjnej gałęzi bez silnika.
3. Przeanalizuj `docs/WINOBRANIE-RTS.md` i opracuj `docs/WINOBRANIE-RTS-IMPLEMENTATION.md` opisujący kontrakty, zmiany silnika, dynamiczną nawigację, system parcel i rozmieszczania, model ekonomii i pogody, stany zapisu i kolejność testów.
4. Na końcu W0 przedstaw plan W1 i granice zależności; bez automatycznego tworzenia pełnej gry W1–W4.
5. Nie scalaj PR ani nie wgrywaj ZIP na serwer bez zgody.

## 4. Kolejka pozostałych gier

- **Miodobranie:** zaakceptowana koncepcja, osobny etap w przyszłości.
- **Stacja na Trasie: Wielki Weekend:** [pełna specyfikacja RTS](./STACJA-BENZYNOWA.md), osobna gra ekonomiczna z ruchem pojazdów, usługami, 3 zmianami i końcem po około 30 minutach. Etapy **S0–S4** są zaplanowane, **programowanie nie rozpoczęte**. Nie wstrzymuje aktualnych prac nad Winobraniem RTS.
- **Życie Dżdżownicy:** istniejąca produkcja; zachować kompatybilność.
- Pozostałe koncepcje pozostają propozycjami, nie aktywnymi zadaniami.

### Plan rozwoju Stacji na Trasie (oddzielny cykl)

Specyfikacja: [STACJA-BENZYNOWA.md](./STACJA-BENZYNOWA.md). Status: koncepcja dopracowana, nie wdrażana. **Nowy wariant ekonomiczny:** fikcyjna polska stacja **ORLAR** ma możliwość prowadzenia własnego sklepu lub wynajęcia go sieci **Skoczka**, z czynszem, kontraktem, odmiennymi obowiązkami i ruchem klientów. Funkcja zaplanowana do S2; branding autorski, bez kopiowania realnych znaków ORLEN i Żabka.

| Etap | Cel | Status |
|---|---|---|
| S0 | Inwentaryzacja aktualnego PixelForge, architektura symulacji ruchu i kolejek, projekt ekonomii | TODO |
| S1 | Grywalna stacja, dwa dystrybutory, sklep, pracownicy, cysterna, pierwsza sprzedaż i podstawowy dźwięk | TODO |
| S2 | Swobodna rozbudowa, ruch samochodów, pracownicy, ceny oraz **najem sklepu fikcyjnej sieci Skoczka** | TODO |
| S3 | Myjnia, ekonomia, zdarzenia i 3 zmiany kończące się wynikiem | TODO |
| S4 | Warianty, pixel art, dźwięki, balans, testy, pełny ZIP dla istniejącego panelu | TODO |

**Zależność:** nowa gra używa istniejącego silnika, sektorów, nawigacji i zapisu. Codex przed rozpoczęciem S0 musi sprawdzić ostatni działający kod i PR #15 lub nowszy, ponieważ `main` może zawierać tylko dokumentację. Oddzielna gałąź `feature/p3-stacja-benzynowa`, brak automatycznego scalania i wdrażania. **Nie rozpoczynaj S1 bez akceptacji S0.**

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

## 7. Polecenie do rozpoczęcia prac

> Pracujemy w `ankelmarek/PixelForge`. Użytkownik zatwierdził nowe `Winobranie RTS: Trzy sezony`, zupełnie różne od starego porzuconego prototypu. Przeczytaj `AGENTS.md`, `docs/ROADMAP.md`, `docs/WINOBRANIE-RTS.md` i `docs/LARGE-WORLDS.md` z właściwych gałęzi. Sprawdź najnowszą uruchamialną bazę (PR #12 lub nowsza), nie opieraj nowych prac wyłącznie na dokumentacyjnym main. Zrealizuj tylko **W0**: analizę architektury i plan wdrożenia z kontraktami i testami. Przygotuj osobną gałąź, nie dotykaj kodu innych gier i panelu. Po W0 przedstaw raport oraz plan W1. Nie wykonuj automatycznie W1–W4, nie scalaj do main i nie wdrażaj na serwer.
