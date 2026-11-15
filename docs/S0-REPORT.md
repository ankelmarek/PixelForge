# S0 — Stacja na Trasie: Wielki Weekend

**Data:** 14 listopada 2026. **Status:** projekt S0 do odbioru.
Stacja nie ma jeszcze runtime, wpisu w katalogu ani nowego ZIP-a.
[PR #17](https://github.com/ankelmarek/PixelForge/pull/17) pozostaje roboczy
ze względu na opisany niżej błąd regresji odziedziczonej bazy.

## Zakres i wybrana baza

Polecenie użytkownika: „możesz budowac stację benzunową, zerknij w roadmapę”.
Zgodnie z [AGENTS](../AGENTS.md), [roadmapą](ROADMAP.md) i sekcją 19
[specyfikacji](STACJA-BENZYNOWA.md) rozpoczęcie tego tytułu obejmuje wyłącznie
S0. Przeczytano też README, pełne SPECIFICATION i kontrakt LARGE-WORLDS,
sprawdzono GitHub, ostatnie PR oraz rzeczywiste API silnika.

Najnowsza baza kodu: **`7f678a103c6825a98f12f08fdafb1a04454765d7`**,
[PR #16 — Winobranie W3](https://github.com/ankelmarek/PixelForge/pull/16).
`main` na `45dcfa2` ma dokumentację; nie zawiera pełnego działającego silnika.
Nowa gałąź **`feature/p3-stacja-benzynowa`** zachowuje kod W3 i dokumentację
najmu Skoczki. Nie scalano PR #16 ani nie zmieniano gałęzi Winobrania.

Runtime, testy, zależności, narzędzia, CI i paczki tej bazy są identyczne
z `c295bb0`, dla którego pełne [CI #19](https://github.com/ankelmarek/PixelForge/actions/runs/43633785720)
przeszło testy logiki, E2E, instalacji, rollbacku i hostingu.
Różnice `c295bb0..7f678a1` to tylko cztery pliki dokumentacji.
W S0 dodatkowo wykonano lokalne kontrole na swojej gałęzi; wyniki poniżej.

**Nowsza regresja nie jest w pełni zielona:** podczas S0 zakończyło się
[CI #20 dla `7f678a1`](https://github.com/ankelmarek/PixelForge/actions/runs/43636198213).
Wynik E2E: **46 PASS, 7 SKIP, 1 FAIL**. Test pełnej kampanii W3 przekroczył
720 s przy `tests/e2e/winery.spec.ts:188`: po sprawdzeniu widoczności i stanu
przycisku `[data-care]` automat czekał na jego kliknięcie, gdy przycisk stał
się niewidoczny. To test odziedziczonej bazy, nie Stacji. Kod pomiędzy
CI #19 i #20 jest identyczny; wynik wskazuje na problem zależny od przebiegu
czasowego, ale nie uznajemy samego timeoutu za dowód jego dokładnej przyczyny.
Kolejne kontrole przeglądarkowe instalatora w CI #20 zostały pominięte po
błędzie E2E. Przed odbiorem S1 należy rozstrzygnąć tę niestabilność.

Lokalna próba testu W3 odtworzyła ten sam timeout. W `trace.zip`:
`isVisible` zwróciło true przy 471148 ms, `isEnabled` true przy 471251 ms,
a kliknięcie przy 471343 ms znalazło już `<button hidden data-care>`.
Potwierdza to zmianę dostępności między sprawdzeniem a akcją automatu.
Podczas oczekiwania gra doszła do ticka 36000 i ekranu częściowego sukcesu
(286 butelek), a test nie zakończył swojego scenariusza. Raport nie zalicza
tej próby jako poprawnego przejścia W3. Trace i kontekst są lokalnie
w `test-results/winery-W3-*/`; kod testu i gry pozostawiono na etapie S0
bez zmian. Naprawa powinna obsłużyć zmianę stanu przed kliknięciem i ponownie
sprawdzić cały finał, bez osłabiania wymaganych asercji.
Pełny lokalny zestaw E2E zakończył się wynikiem **46 PASS, 7 SKIP, 1 FAIL**
w 22.4 min. Atlas i Dżdżownica przeszły regresję; jedyny błąd to opisany W3.

## Wynik projektowania

[STACJA-BENZYNOWA-IMPLEMENTATION.md](STACJA-BENZYNOWA-IMPLEMENTATION.md) zawiera:

- inwentaryzację rzeczywistych publicznych usług i brakujących elementów;
- rozdział klienta od silnika, minimalne kontrakty zajętości, FIFO i finansów;
- świat 4096², dynamiczną topologię, pasy i obrysy pojazdów, limit 32 jednostek;
- maszyny stanów klientów, personelu, dostaw, kolejek i punktów obsługi;
- zachowanie litrów i kosztu zapasów, transakcje idempotentne, odrębne pojęcia
  gotówki, wyniku operacyjnego i wartości netto;
- własny sklep ORLAR oraz najem Skoczki: przejęcie jednego lokalu, autonomiczny
  operator, osobna kasa paliwowa, czynsz/udział, parking i wspólny limit ruchu;
- zapis `gas-station`, walidację i zakres zgodności po rollbacku;
- pętlę 8/12/10 minut, wagi satysfakcji, startowe ceny i wynik kampanii;
- budżety grafiki, dźwięku, pamięci i plików; plan S1a–S1d i macierz testów.

Najważniejsza luka w bazie: dynamiczny `RegionalNavigator` istnieje, ale
nie zapewnia kierunkowych pasów, fizycznego FIFO ani rezerwacji skrętów.
`Ledger` nie rozróżnia sam kosztu zakupu zapasu od kosztu sprzedanego towaru,
a obecne audio nie oferuje miksu przestrzennych pętli. Plan nie przedstawia
tych funkcji jako gotowych i nie uzależnia S1 od przepisania Winobrania.

Przykładowy czynsz 450 / 200 + 8% wymagałby obrotu 3125, by druga umowa
dogoniła pierwszą. Przy proponowanym tempie ruchu i koszykach to zbyt wysoko
dla zwykłego sklepu. Nowa propozycja **120 / 50 + 8%** ma próg **875**.
Startowe zbiorniki mają pojemność po 1000 L, lecz wycinek S1 zaczyna z 280 L
łącznie, aby dostawa miała znaczenie. To liczby do balansu, nie wynik playtestu.

## Zmienione pliki

- Nowe: `docs/STACJA-BENZYNOWA-IMPLEMENTATION.md` i ten raport.
- Zaktualizowane: `AGENTS.md`, `README.md`, `docs/ROADMAP.md`,
  `docs/STACJA-BENZYNOWA.md` — status S0, odnośniki, kolejny zakres.

S0 nie zmienia `src/`, `public/`, `tests/`, `tools/`, `admin-updater/`, wersji
aplikacji 0.11.0, zależności, workflow ani zawartości `downloads/`.
Istniejących archiwów nie oznaczono jako wydania Stacji.

## Weryfikacja

Kontrole dotyczą odziedziczonego PixelForge i dokumentacji S0, nie
niezaimplementowanych mechanik Stacji.

| Kontrola                                            | Wynik                                                        |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `npm run typecheck`                                 | PASS                                                         |
| `npm test`                                          | PASS: 115 Vitest, 15 testów paczek, 36 integracji PHP/Python |
| `npm run test:hosting`                              | PASS: 12 testów Apache/PHP                                   |
| `npm run build`                                     | PASS; znane ostrzeżenie Vite o rozmiarze pakietu Phaser      |
| `npm run lint`                                      | PASS                                                         |
| `npm run test:e2e`                                  | FAIL — odtworzony timeout testu kampanii W3, opis powyżej    |
| Kontrola odnośników, rachunków i zgodności archiwów | PASS — szczegóły poniżej                                     |

Sprawdzono 73 lokalne odnośniki. Niezależne przeliczenie potwierdza przykład
S1 (316 monet wyniku paliwowego), sklep własny (238), najem (108 / 100.40),
próg umów (875), czasy, sumę wag satysfakcji oraz budżety jednostek/sektorów.
To kontrola arytmetyki projektu, nie test symulacji Stacji.

Wszystkie **551 plików `dist/`** odpowiadają bajt w bajt opublikowanej paczce
0.11.0. SHA-256 istniejących archiwów pozostają zgodne:

- `pixelforge-0.11.0-full.zip`:
  `96068bfad85b48e7c0f6b16495e5aa01e3ea1ea4e344257125c6c0ffe44c3ad6`.
- `pixelforge-public-html-0.11.0-installer-1.2.0.zip`:
  `9212054414ce8dd762a138764c34441407b0ec42823fefeb024a06e19354fc10`.

Nie tworzono testów sprawdzających jedynie treść dokumentacji. Pełne CI bazy
#19 obejmuje dodatkowo przeglądarkowe testy updatera, panelu, paczki gry,
instalacji wydania i public_html. Żadna z tych ścieżek nie została zmieniona
w S0; porównano ich źródła i dane z dokładnym sprawdzonym commitem.

## Kolejny etap i ograniczenia

S1 ma dostarczyć sześciominutową grę: dwie pompy E95/ON, własny sklep,
dwie osoby, kolejki, fizyczna cysterna, jedna rozbudowa, pełne sterowanie
myszą, audio, zapis i cel ≥12 obsłużonych przy dodatnim wyniku operacyjnym.
Najem Skoczki jest dopiero S2; myjnia, pełne trzy zmiany i nieunikniony finał
to S3; dopracowanie i odbiór całej gry to S4.

Balans obu sklepów, płynność ruchu, odbiór wizualny i dźwiękowy oraz czas
25–35 minut wymagają implementacji i playtestów. Nie zaliczono ich przez
testy istniejącej bazy. Nie wykonano badania znaków ORLAR/Skoczka ani
playtestu z nowymi osobami. S1 pozostaje do zlecenia po akceptacji S0;
bez automatycznego merge, wdrożenia hostingu lub rozpoczęcia W4.
