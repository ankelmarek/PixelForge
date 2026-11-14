# W0 — Winobranie RTS: Trzy sezony

**Data:** 2026-11-14. **Status:** wykonane projektowanie W0 i weryfikacja
odziedziczonej bazy. **Gra W1–W4 nie jest zaimplementowana.**

## Wykonane zadanie

Odczytano aktualne AGENTS, README, specyfikację fundamentów, roadmapę 0.3,
pełną specyfikację Winobrania RTS oraz kontrakt dużych światów. Sprawdzono
PR #1–#12, stan gałęzi, CI i kod usług. Najnowsza uruchamialna baza to PR #12
`3385c6c712de186f4caf6ce01fcdbb6756055694`; nowszego PR z kodem nie znaleziono.
Jej [CI](https://github.com/ankelmarek/PixelForge/actions/runs/43519491435)
zakończyło się sukcesem. Odbiór grywalności Dżdżownicy pozostaje odrębną sprawą.

Utworzono `feature/p3-winobranie-rts` z tego kodu. Nowe dokumenty `main`
(`cdbe163`) włączono do gałęzi roboczej, nie odwrotnie. Zachowano aktualne
wymagania 0.3 oraz rejestr wykonanych wcześniejszych etapów w osobnym archiwum.
Nie scalano żadnego PR do `main`, nie zmieniano gałęzi innych etapów.

[Plan wdrożenia](WINOBRANIE-RTS-IMPLEMENTATION.md) zawiera:

- inwentaryzację dostępnych usług i braków, diagram zależności i docelowy podział plików;
- kontrakty świata 8192², własności, preview/commit i dynamicznej nawigacji;
- stany zadań, rezerwacje, bilans partii, finanse i atomowy zapis z migracjami;
- zegar x1/x2/x4, wiek roślin, pogodę i ciągłe zużycie wody podczas mrozu;
- wstępne ceny, rachunek plonu, warunki trzech lat i uczciwy ratunek przed porażką;
- przyrosty W1a–W1d, macierz testów W1–W4, budżety oraz kryteria odbioru.

Najważniejsze ustalenia z kodu: istniejący `RegionalNavigator` i indeks
prostokątów są statyczne; zmiana `MutableGrid` nie zmienia ich topologii.
`WorldLevel` jest związany z danymi prostego symulatora i wymaga wydzielenia
kontraktu terenu. Obecny model nie ma identyfikowanych partii, pieniędzy,
ogólnej kolejki prac ani dynamicznej budowy. Audio oferuje podstawowe tony,
a nie docelowy miks maszyn i ambientu. Plan oznacza te usługi jako przyszłe.

## Zmienione pliki i granice

Nowe dokumenty: `WINOBRANIE-RTS-IMPLEMENTATION.md`, ten raport oraz
`ROADMAP-ARCHIVE-0.2-RUNTIME.md`. Z `main` przeniesiono specyfikację nowej gry
i archiwum 0.2. Uzgodniono AGENTS, README, SPECIFICATION i roadmapę; checklistę
W0 oznaczono jako wykonaną. Parametry w planie są propozycjami do zbadania,
nie gotowym katalogiem runtime.

Nie zmieniono `src/`, `public/`, `tests/`, `tools/`, `admin-updater/`, zależności,
CI, wersji pakietu ani bajtów w `downloads/`. Nie dodano dekoracyjnego wpisu
Winobrania do launchera. Nowa gra będzie mieć ID `winobranie-rts`; stary
produkt `winobranie` nadal pozostaje porzucony.

## Weryfikacja wykonana w W0

Lokalne kontrole odziedziczonego kodu:

| Kontrola            | Wynik                                              |
| ------------------- | -------------------------------------------------- |
| `npm run lint`      | PASS                                               |
| `npm run typecheck` | PASS                                               |
| `npm test`          | PASS: 69 Vitest + 15 Python U0 + 36 integracji PHP |
| `npm run build`     | PASS; znane ostrzeżenie o wielkości pakietu Phaser |
| `npm run test:e2e`  | 42 PASS + 2 celowe SKIP dotyku na desktopie        |

E2E obejmuje Atlas 4096/8192, pracę poza kamerą, zapis/wznowienie, pełne okno,
zoom 0.5, uszkodzone dane, brakujące zasoby oraz Dżdżownicę na desktopie
i w emulacji telefonu. Są to testy **bazy PixelForge**, nie nieistniejącej gry RTS.
Nie dodawano sztucznych testów sprawdzających wyłącznie tekst dokumentacji.

Rachunek balansu przeliczono niezależnie: w przykładowym wariancie plon wynosi
121.60 / 236.80 / 352.00 kg, po fermentacji 69.312 / 134.976 / 200.640 L,
górne limity pełnych butelek 92 / 179 / 267. Przykładowe inwestycje kosztują
28 230 z początkowych 30 000. To kontrola arytmetyki, nie test kampanii:
nie uwzględnia jakości, logistyki, podziału partii ani strat pogodowych.

Porównanie katalogów źródeł, assetów, testów, narzędzi, zależności i CI z
`3385c6c7` nie wykazało zmian. Wszystkie **288 plików** nowo zbudowanego `dist/`
są identyczne bajt w bajt z pełnym ZIP-em 0.8.0. Sprawdzono SHA-256 obu
archiwów i odnośniki względne w dokumentacji; `git diff --check` przechodzi.

Wydanie nadal ma numer 0.8.0. Istniejące paczki nie są wydaniem Winobrania:

- `pixelforge-0.8.0-full.zip`:
  `066d23235ea5f2fd0cc53d919479917752c8419f396ac04885d8a3491413a6e4`.
- `pixelforge-public-html-0.8.0-installer-1.2.0.zip`:
  `388a2272cc9dbacbdfe78d2dd8cf2b38f11cde80c63d858e99f8d0b88445a0de`.

## Następny zakres

W1a: kontrakty i testy dynamicznej nawigacji. W1b: nowy klient, własność i budowa.
W1c: dwóch ludzi, traktor, rzeczywisty transport i prasa. W1d: pierwsza sprzedaż
moszczu, wynik sześciominutowego wycinka, zapis i odbiór. Plan nie udaje gotowej
fermentacji ani kampanii 500 butelek przed W3.

Zgodnie z roadmapą W1 pozostaje do osobnego zlecenia. W0 nie wdraża nowej gry,
panelu ani ZIP-a, nie uruchamia W2–W4/U3/Studio. Balans, wykonanie 100% akcji
myszą, wydajność docelowych jednostek i czas 30–35 minut wymagają późniejszych
testów nowego runtime oraz playtestów ludzi; nie są zaliczone przez CI bazy.
