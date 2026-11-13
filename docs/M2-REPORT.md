# M2 — pełniejsza demonstracja „Leśny sygnał”

Status: **IN PROGRESS — implementacja gotowa do testów odbiorowych**.
Gałąź `feature/m2-forest-demo`, baza M1 `a1836e1` (PR #2), M0 w PR #1.
Użytkownik polecił najpierw M1 i M2; Winobranie/M3 pozostaje odłożone.

## Zawartość

Trzy mapy JSON po 3200 pikseli: Leśna polana, Mgliste mokradła i Stare sanktuarium.
W kampanii jest 22 odłamków, 12 punktów kontrolnych, 6 patroli i strefy zagrożeń.
Pierwszy niski próg jest bezpieczny. Kolejne mapy wprowadzają wyższe skoki,
więcej zagrożeń i finałowy odłamek na trzech kondygnacjach sanktuarium.

Gracz zbiera odłamki, wraca do latarni, włącza sygnał i przechodzi przez bramę.
Rząd małych symboli przy latarni odpowiada odłamkom, HUD pokazuje kolekcję,
życia i mapę; zamek znika po spełnieniu warunku. Nie ma pisanych instrukcji,
listy klawiszy ani samouczków. Wyzwania nie są sztucznie zatrzymywane timerem.
Cel projektowy długości to 5–8 minut, do sprawdzenia świeżym playtestem.
Próby trasy ujawniły zbyt ciasny strop nad jednym patrolem; patrole przeniesiono
na otwarte odcinki, a checkpointy na czytelne miejsca między platformami.

Oprawa: własne PNG, trzy palety tła z paralaksą, dekoracje przednie, animacje
idle/run/jump/hit bohatera i patrol/hit przeciwnika, unoszące się odłamki,
cząstki przy zbieraniu i aktywacji, feedback obrażeń i punktów kontrolnych.
Reduced motion usuwa paralaksę, unoszenie, drganie kamery i cząstki.

Dźwięk: pięć rodzajów SFX oraz własny, cichy motyw muzyczny syntezowany lokalnie.
Audio uruchamia się po geście, ma wspólne wyciszenie i zatrzymuje się na pauzie.
Nie ma zewnętrznych sampli, fontów, usług ani telemetrii. Licencja assetów: CC0.

Zapis v2 przechowuje etap, kolekcję, flagi, checkpoint, życia i czas aktywnej gry.
Wersja zawartości 0.2.0 oddziela nową kampanię od niekompatybilnego zapisu M0/M1.
Restart zeruje kampanię; wznowienie wraca do checkpointu, nie dowolnej pozycji.

## Zmiany współdzielonego silnika w M2

- Opcjonalne tytuły poziomów, dane muzyki i walidacja tych danych.
- Dekoracje/palety przez `theme`, symbole kolekcji i zamka przez zasoby gry.
- Wygląd aktywnego checkpointu po wznowieniu, animacja kontaktu przeciwnika,
  krótkie sprzężenie zwrotne po obrażeniach oraz unoszenie kolekcji.
- Brak warunków po nazwie gry lub ID mapy w rdzeniu.
- Poprawa focusu wyniku, aby nie ucinać SFX sukcesu przy otwieraniu menu wyniku.

Sama zawartość, położenia obiektów, parametry, grafiki, melodia i warunek
`allCollected` należą do katalogu gry. Nie zbudowano edytora ani M3.

## Weryfikacja

Kontrole: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` — OK.
Vitest: **17 testów**. Pełny zestaw E2E: **13 zaliczonych, 1 pominięty** tylko
na desktopie (multitouch wykonany w projekcie mobilnym). Krótszy scenariusz
kampanii używa trzech małych map kontraktowych, testuje przejścia, warunki,
zapis między mapami i wznowienie. Regresja M0/M1 pozostaje w zestawie.

**Pełne przejście rzeczywistych map:** automatyczny gracz używał normalnych
strzałek, Spacji i Shifta, bez teleportacji i zmiany prędkości czasu. Zebrał
wszystkie 22 odłamki, aktywował wszystkie latarnie i doszedł do końca.
Wynik: **303.337 s czasu rzeczywistego (5 min 3 s)**,
**302 s czasu aktywnej gry**, **7/7 żyć**, brak błędów JS.
To dowód przechodniości i czasu automatycznej trasy, nie pomiar nowego gracza.
Dane: [M2-PLAYTEST.json](M2-PLAYTEST.json). Odtworzenie: `npm run dev` na porcie
5173, następnie `node tools/play-campaign.mjs`; wyniki trafiają do `work/`.

Próbka płynności: pierwsze 180 klatek Chromium headless na Linuxie, viewport
1280×960; średni odstęp **16.77 ms (~59.6 FPS)**,
p95 **16.8 ms**. Nie jest to pomiar całej sesji ani docelowego
komputera/telefonu. Nie potwierdza wydajności Windows, Safari ani smartfona.

Rozpakowany ZIP sprawdzono na zwykłym serwerze statycznym pod `/` i
`/PixelForge/`: start, ruch, skok, zasoby bez błędów HTTP/JS; sprawdzono także
proporcjonalny fallback przy szerokości 300 px. W emulacji Pixel 7 sprawdzono
dotyk, skok, pauzę, wyciszenie, wznowienie i zmianę orientacji.

Zrzuty: [launcher](screenshots/m2-launcher.png),
[rozgrywka](screenshots/m2-gameplay.png), [mokradła](screenshots/m2-marsh.png),
[sanktuarium](screenshots/m2-sanctuary.png), [wynik](screenshots/m2-finish.png),
[telefon](screenshots/m2-mobile.png), [orientacja pozioma](screenshots/m2-landscape.png).
ZIP: `downloads/PixelForge-M2-static.zip`, instrukcja i SHA-256 w `downloads/README.md`.
Finalny build: JS **1 420,99 kB** (gzip **383,36 kB**), CSS **7,73 kB**.
Znane ostrzeżenie Vite o dużym chunku Phasera. Rozmiar ZIP i suma SHA-256 są
w `downloads/README.md`. Po poprawce obsługi powtarzanego Esc ponownie przeszły
oba scenariusze kampanii (desktop i emulacja mobilna).

Główne zmiany: definicja/rules gry, trzy JSON-y, generatory map i PNG, assety,
rozszerzenia wizualne/audio w engine, UI, testy, dokumentacja, narzędzie pełnego
przejścia oraz skrypt paczkowania. Engine nadal nie importuje gier.

## Pozostały odbiór i ograniczenia

- **Nie wykonano playtestu z nową osobą nieznającą sterowania.** To jawnie
  niezaliczone kryterium M2; dlatego cały etap nie jest oznaczony jako DONE.
- Testy Chromium na Linuxie i emulacja telefonu nie potwierdzają działania na
  fizycznym telefonie, Windows ani w Firefox/Edge/Safari. Brak pomiaru na
  przeciętnym smartfonie i brak ręcznego odsłuchu audio.
- Raport odróżnia automatyczne przejście sterowaniem od playtestu człowieka.
  Czas człowieka i odkrywalność bez instrukcji trzeba potwierdzić na gotowej paczce.
- Powrót do latarni i ponowne przejście krainy to część pętli; jego atrakcyjność
  i trudność wymagają oceny przez nowego gracza.
- Znany duży chunk Phasera. Bez PWA i gwarancji ponownego wejścia offline.
- Nie scalano PR-ów i nie publikowano strony automatycznie.

Następny krok: test odbiorowy demo przez nową osobę, ewentualne poprawki M2.
Nie rozpoczynać Winobrania/M3 automatycznie.
