# S1 — Stacja na Trasie: pierwsza zmiana, PixelForge 0.12.0

## Zakres i baza

Polecenie „Możesz kontynuować” po S0 uruchomiło wyłącznie S1.
Gałąź `feature/s1-stacja-benzynowa` powstała z `4feec4e` / PR #17;
zawiera wcześniejszy silnik, Dżdżownicę i Winobranie W3. Przyrost S1
należy oglądać od tego commita. Nie scalono PR ani nie wdrożono hostingu.

[PR #18](https://github.com/ankelmarek/PixelForge/pull/18), kod i paczki
w commicie `f861147`. Status: **REVIEW — kontrole lokalne i pełne CI PASS**.
[CI #23](https://github.com/ankelmarek/PixelForge/actions/runs/43649290650)
zaliczyło 135 Vitest, 15 testów paczek, 36 PHP/Python, 12 Apache/PHP,
52 E2E (17.6 min, 8 uzasadnionych pominięć) oraz wszystkie kontrole
instalacji, rollbacku i hostingu. CI odtworzyło identyczne SHA-256 obu ZIP-ów.
Końcowe uzupełnienie tego raportu i roadmapy zmienia wyłącznie dokumentację
oraz załączone wyniki/obrazy; kod, testy, zależności, workflow i paczki są
identyczne ze sprawdzonym `f861147`. Automatyczne CI po tym uzupełnieniu
dokumentacji ma własny status w PR.

Nowy klient `gas-station` 0.1.0: świat 4096 × 4096, 64 sektory, zmiana
6 minut, dwie pompy E95/ON, własny sklep, dwóch pracowników, fizyczne
kolejki i parking, cysterna i dostawa towaru, trzeci dystrybutor z budową.
Koniec zawsze po 7200 tickach; sukces przy ≥12 obsłużonych na wyjeździe
i zysku operacyjnym >0. Finał oddziela przychód, koszty, gotówkę i majątek.

Sterowanie obejmuje mysz i podstawowy dotyk, pełne okno, przeciąganie
kamery, zoom 0.5–2, minimapę, pauzę, ×1/×2/×4, wyciszenie i miks audio.
Zapis `pixelforge:client:v1:gas-station` jest niezależny od innych gier;
działa co 15 sekund symulacji, przy operacjach gospodarczych, pauzie i wyjściu.
Źródłem oryginalnych grafik jest `tools/generate-station.py`; pochodzenie
i licencja: [LICENSE.md](../public/assets/games/gas-station/LICENSE.md).

## Ważne decyzje

- Silnik dostał generyczne rezerwacje przestrzeni/FIFO, księgę transakcji
  oraz magistrale i limit głosów audio. Reguły stacji pozostają w kliencie.
- Pojazdy rezerwują całą obwiednię manewru również na prostym odcinku,
  aby jadący z tyłu nie zablokował skrętu. Kierowcy i pracownicy obchodzą
  przeszkody lokalnie; boczny krok rozwiązuje konflikt między osobami
  stojącymi po obu stronach niepełnej komórki.
- W S1 drogi i fundamenty są stałe. Jedna rozbudowa jest realnym zakupem
  i zadaniem pracownika; nie udaje swobodnego budowania z S2.
- Zakup zapasu nie jest kosztem operacyjnym do chwili rozchodu. Paliwo
  wydane przed płatnością tworzy należność. Powtórzone ID nie księguje drugi raz.
- Stały scenariusz otwarcia ma seed 20261114. Zmienne koszyki, paliwo,
  cierpliwość i budżety nie zależą od kamery ani FPS.

## Weryfikacja

Model sprawdzono dla dwóch seedów, czterech momentów rozpoczęcia budowy,
wznowienia częściowej usługi i rozładunku, anulowania dostawy, FIFO,
zamknięcia pomp, braku obsady, nieaktualnego podglądu budowy, niepoprawnych
zapisów i konfiguracji. Osobny test sprawdza fizyczne przeniesienie towaru
z dostawy do sklepu. Księgowanie zachowuje ilości, koszt i saldo.

Pełna zmiana przez UI, samą myszą: dwie dostawy po 200 L, trzeci dystrybutor,
odświeżenie podczas częściowego rozładunku i trwały finał po 7200 tickach.
Wynik: **14 klientów, 387 L paliwa, 22 artykuły, +371 monet zysku**
(liczby monet w interfejsie są zaokrąglane). Wznowienie wyniku również przeszło.

[Widok stacji](reports/S1-station.png), [wynik](reports/S1-result.png),
[emulacja telefonu](reports/S1-mobile.png), [ekran 320 px](reports/S1-mobile-narrow.png).

Przeszły lint, TypeScript, build, **135 testów Vitest**, 15 testów paczek,
36 PHP/Python oraz 12 Apache/PHP. Składnia 17 plików PHP jest poprawna.
Pełne lokalne E2E: **52 PASS, 8 SKIP, 0 FAIL** (19.1 min). Pominięcia:
dwa testy wyłącznie dotykowe na desktopie, pięć desktopowych scenariuszy
Winobrania na telefonie i pełna zmiana Stacji na telefonie, objęta osobną
próbą podstawowej obsługi. Dodatkowo ponowiono test mobilny z ekranem 320 px:
cele ≥44 px, brak zasłaniania środka przycisków, zamówienie i anulowanie PASS.
Wszystkie pięć poleceń przeglądarkowej weryfikacji dystrybucji przeszło;
szczegóły poniżej.

Zastany test W3 miał wyścig między obserwacją dostępnej pielęgnacji a kliknięciem
po jej zniknięciu; podobnie finał mógł zasłonić przycisk anulowania. Test
ponownie sprawdza stan oferty/końca po krótkim nieudanym kliknięciu.
Inne błędy nadal przerywają test; kryteria sukcesu kampanii i limit 720 s
pozostają takie same. Pełna kampania W3 przeszła w 8.0 min; przeszły też
starsze sezony W1/W2. Kod Winobrania i jego formaty zapisu nie są zmieniane.

## Budżety i dystrybucja

[Inwentaryzacja zasobów](reports/S1-assets.json): osiem małych PNG zamiast
czterech pełnych atlasów 1024² — **40 237 bajtów pobrania, 3 100 672 bajty
RGBA po dekodowaniu**. Osobne pliki odpowiadają różnym rozmiarom klatek;
są znacznie poniżej limitu 16 MiB. 64 sektory zajmują razem 11 476 bajtów
gzip. Generator odtworzył wszystkie pliki identycznie bajt w bajt.
Własny moduł runtime Stacji ma około 16.6 kB gzip w buildzie Vite;
definicja i kontrolki są w małym wspólnym module katalogu.

[Pomiar buildu](reports/S1-performance.json), `tools/measure-station.mjs`:
Chromium 158 headless, renderowanie programowe, Xeon Platinum 8573C,
5 dostępnych CPU, viewport 1280 × 900, bez ograniczania CPU/sieci.
Przez 60 s: ×4, zoom 0.5, dostawa, budowa i 30 skoków kamery między
sektorami. Liczniki stanu próbkowane co sekundę, czasy klatek przez rAF.
Średnio **56.6 FPS**, mediana 16.7 ms, **p95 16.8 ms**, 9 klatek
powyżej 50 ms. Największy krok symulacji 6 ms, lokalna trasa 90 rozwinięć.
Cache najwyżej 48 sektorów, tekstury sektorów 25 MiB (z atlasami około
28 MiB), zapis **13 202 bajty**, do 3 głosów audio w próbkach. Po powrocie do
stacji 0 brakujących sektorów i 0 błędów JS. Heap JS po GC: około 10.2 MiB;
nie jest to pomiar całej pamięci procesu ani GPU.

Próba osiągnęła **17 jednostek** w zwykłej rozgrywce S1. Potwierdza budżety
dla tego scenariusza; nie zastępuje syntetycznego testu 32 jednostek z planu
S0 ani pomiaru na fizycznym telefonie. Ten test obciążenia należy uzupełnić
przed zwiększeniem populacji w S2.

- `pixelforge-0.12.0-full.zip`: **13 235 274 bajty**, 626 plików buildu
  oraz manifest; przyrost **83 943 bajty** względem 0.11.0.
  SHA-256: `838e1f9dad346ea20ca256de055f05457ddd507845599affc664ac083ab8ce69`.
- `pixelforge-public-html-0.12.0-installer-1.2.0.zip`: **13 330 491 bajtów**.
  SHA-256: `e61487a3222ca2fd01dcb23fef529b0f7b448972c222dc21677b3b44bb158b68`.

Pierwszy ZIP służy istniejącemu panelowi aktualizacji lub hostingowi
statycznemu. Drugi jest kompletną pierwszą instalacją w `public_html`.
[Instrukcja i pobieranie](../downloads/README.md). Instalator pozostaje 1.2.0;
wcześniejsze wydania 0.11.0 i ich sumy SHA-256 nie zostały zmienione.
Pobrano też oba nowe archiwa z GitHuba i porównano ich SHA-256 z lokalnymi;
są identyczne. [Metryki wydania](reports/S1-release.json).

[25 wyników dystrybucji](reports/S1-distribution.json), wszystkie PASS:

| Polecenie              | Przypadki | Sprawdzony przepływ                                                                                                  |
| ---------------------- | --------: | -------------------------------------------------------------------------------------------------------------------- |
| `test:updater:browser` |         8 | Atlas 4096/8192, `/` i `/PixelForge/`, desktop/mobile, install/rollback i kamera                                     |
| `test:panel:browser`   |         2 | HTTPS, logowanie, upload tylko przygotowuje plan, instalacja i rollback                                              |
| `test:game:browser`    |        10 | Rzeczywisty ZIP 0.12.0: Dżdżownica i Stacja na obu urządzeniach/ścieżkach, Winobranie na desktopie                   |
| `test:release:browser` |         2 | 0.6.1 → 0.12.0 → rollback → 0.12.0; wznowienie Stacji i Dżdżownicy, również Winobrania na desktopie                  |
| `test:hosting:browser` |         3 | Nowe `public_html`, setup, aktualizacja i rollback, HTTP 403 plików prywatnych; desktop/mobile i konfiguracja bez JS |

Stacja w tych próbach zamawia paliwo, zapisuje się i po odświeżeniu lub
ponownej instalacji zachowuje zamówienie oraz postęp. `public_html` używa
tymczasowego pakietu testowego 0.12.1 o niezmienionym payloadzie 0.12.0;
to fixture, nie osobne wydanie. Weryfikacja TLS pozostawała włączona.

## Ograniczenia i kolejny etap

To pierwszy grywalny wycinek, nie pełny „Wielki Weekend”. S2 (swobodne
budowanie, więcej personelu/pojazdów, ceny i najem Skoczki), S3 (myjnia
i trzy zmiany) oraz S4 nie są rozpoczęte. Badania z nowymi graczami
i pomiary na fizycznych telefonach pozostają osobnym odbiorem. Testy
automatyczne używają Chromium i emulacji Pixel 7; nie są badaniem Safari,
Firefox ani odsłuchem człowieka. S1 stosuje stałe drogi, konserwatywne
odstępy pojazdów i jeden scenariusz otwarcia; swobodna przebudowa wymaga S2.
