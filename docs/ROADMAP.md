# PixelForge — aktualna roadmapa 0.3

**Decyzja:** 14 listopada 2026. **Stan:** W0 nowej gry **Winobranie RTS: Trzy sezony** wykonane — inwentaryzacja, kontrakty i plan; W1 jest zaimplementowane i ma komplet zielonych kontroli lokalnych, W2–W4 nie rozpoczęto. **Główny dokument produkcyjny:** [WINOBRANIE-RTS.md](./WINOBRANIE-RTS.md).

Poprzednie roadmapy zostały zachowane w [archiwum 0.2](./ROADMAP-ARCHIVE-0.2.md) oraz [archiwum historycznym](./ROADMAP-ARCHIVE-2026-11.md). Oba mają status historyczny. Jeżeli ich zapis przeczy temu dokumentowi lub `docs/WINOBRANIE-RTS.md`, obowiązuje aktualna decyzja z 14 listopada.

[Archiwum stanu wykonania z PR #12](ROADMAP-ARCHIVE-0.2-RUNTIME.md) zachowuje dodatkowo raporty realizacji P0–P3/U0–U2 i wydania 0.8.0 z gałęzi zawierającej silnik.

## 1. Obowiązujące decyzje właściciela

1. **Pierwsze, uproszczone Winobranie (PR #4) pozostaje porzucone** jako produkt. Nowe **Winobranie RTS** to osobna, dużo ambitniejsza gra strategiczno-ekonomiczna korzystająca ze wspólnego silnika i osobnego katalogu. Nie przywracaj jego dawnej mapy ani podstawowej pętli jako docelowego produktu.
2. **Leśny sygnał (platformówka)** pozostaje porzucony. Nie kontynuować.
3. Nowa gra: 8192×8192, dowolne nasadzenia i rozmieszczenie budynków w obrębie zakupionych parcel, sześć odmian, trzy lata/sezony winiarskie, ryzyko przymrozków i aktywna ochrona zraszaniem, dwa domki winiarskie na start z możliwością dokupienia, traktorki, wynajmowani pracownicy, ekonomia, produkcja, dźwięki i jasny finał.
4. Sterowanie **w całości myszą**, bez obowiązkowych skrótów i tekstowych tutoriali. Dozwolone krótkie etykiety strategiczne, liczby, odmiany, ceny.
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

## 3. Nowy główny cykl: Winobranie RTS

| Etap   | Zakres                                                                                                           | Status                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **W0** | Inwentaryzacja kodu, projekt architektury, modele danych i balans wstępny                                        | DONE — dokumentacja i weryfikacja bazy  |
| **W1** | Pierwszy grywalny vertical slice: duża mapa, własne rzędy, dwa domki, pracownicy, traktor, zbiór i sprzedaż      | REVIEW — testy PASS, odbiór użytkownika |
| **W2** | 6 szczepów, wzrost roślin, pogoda, prognoza, przymrozki i zraszacze z nieprzerwaną pracą                         | TODO                                    |
| **W3** | 3 lata, zakup nowych domków, pracowników i traktorów, ekonomia, produkcja wina, warunki wygranej/przegranej      | TODO                                    |
| **W4** | 3 warianty kampanii, grafika pixel art, audio, balans, wydajność, testy E2E, pełny ZIP przez dotychczasowy panel | TODO                                    |

**Szczegółowe mechaniki, etapy i checklisty znajdują się w [specyfikacji Winobrania RTS](./WINOBRANIE-RTS.md).** Każdy etap powinien być ukończony, przetestowany i zrecenzowany przed kolejnym. Nie deklarować ukończenia całej gry po zbudowaniu pierwszego prototypu.

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
- **Stacja Benzynowa:** zaakceptowana koncepcja, osobny etap w przyszłości.
- **Życie Dżdżownicy:** istniejąca produkcja; zachować kompatybilność.
- Pozostałe koncepcje pozostają propozycjami, nie aktywnymi zadaniami.

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
i badanie z osobami nieznającymi gry pozostają osobne. W2 nie jest rozpoczęte.

W1: 85 Vitest, 15 testów paczek, 36 PHP/Python, 12 Apache/PHP,
45 Playwright PASS (5 uzasadnionych pominięć), build, lint, typecheck oraz
komplet przeglądarkowych install/rollback/reinstall PASS. [PR #14](https://github.com/ankelmarek/PixelForge/pull/14).
