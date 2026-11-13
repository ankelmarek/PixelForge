# M0 — uruchamialny fundament PixelForge

Data: 2026-11-13. Zakres: wyłącznie M0.

## Implementacja

- Node 24 LTS, Phaser przypięty do 4.2.1, TypeScript strict, Vite, lockfile,
  ESLint, Prettier, Vitest i Playwright.
- `EngineHost` tworzy i niszczy Phaser oraz listenery, anuluje loader podczas
  zamknięcia i izoluje sesje. Sceny: Boot → Preload → Title → Gameplay.
- Typowane `GameDefinition` i `LevelDefinition`, walidacja manifestu i JSON,
  diagnostyka wersji, pól, geometrii, ścieżek i nieznanej akcji.
- Ruch i skok z Arcade Physics, statyczne kolizje, kamera śledząca bohatera,
  animacje idle/run/jump. Wejście stosowane przed krokiem fizyki, obserwowany stan
  publikowany po synchronizacji pozycji sprite’a. Render 320 × 180, ostre piksele, skala całkowita,
  proporcjonalny fallback dla ekranu mniejszego od bazowego viewportu.
- Polski launcher i nakładki HTML: pauza, restart, wyciszenie,
  zakończenie, powrót do katalogu. Klawiatura obsługiwana tylko przez canvas;
  dotyk przez pointer events z capture, cancel i niezależnymi źródłami wejścia.
- `forest-demo`: jedna polana szeroka na 800 pikseli, schodki, latarnia uruchamiana
  interakcją i brama. Własne PNG z ograniczoną paletą, tło z kilkoma planami,
  paralaksa i własne syntezowane SFX po geście użytkownika.
- Minimalny zapis interakcji i zakończenia (`pixelforge:v1:<gameId>`), wznowienie
  przy latarni, bezpieczny fallback dla złej wersji, uszkodzenia i braku dostępu.
  To mały kontrakt prototypu, nie pełny ProgressService z M1.

## Kontrakt i granice

`src/engine/api/index.ts` udostępnia `EngineHost`, typy i walidatory. Gra dostarcza
obiekt `GameDefinition`: ID, teksty, viewport, ścieżki assetów i poziomu oraz
parametry ruchu bez tekstowych instrukcji gameplayowych. Poziom opisuje w JSON granice, spawn, prostokąty kolizji,
interakcję i wyjście. Wszystkie pozycje podawane są w pikselach logicznych;
platformy mają lewy górny punkt, interakcja/wyjście — środek podstawy grafiki.
Sprite gracza ma sześć klatek 16 × 24: idle, trzy run, jump, alternatywny idle.
Tekstura terenu jest powtarzana; pozostałe obrazy są dostarczane przez grę.

Nowa platformówka może użyć tych samych scen: dodaj jej definicję w
`src/games/<slug>/`, własne assety i poziom w `public/assets/games/<slug>/`,
wpis do rejestru oraz wybór w launcherze. Rdzeń nie wymaga znajomości nowego ID.
Test architektury oraz ESLint zabraniają importów z gier/aplikacji do silnika.
Nie tworzono drugiej gry ani testu uniwersalności z M3.

Zamknięty katalog akcji M0 zawiera `activate`: ustawia stan latarni i odblokowuje
wyjście. JSON nie wykonuje kodu. Pełny rejestr rozszerzalnych zachowań i warunków,
fabryka encji oraz przykład modułu TS pozostają zakresem M1. Nie wprowadzano
ECS, edytora, przeciwników, obrażeń, wielopoziomowego demo ani backendu.

## Weryfikacja

W środowisku Node **24.22.1**, npm **11.9.0**, Linux:

| Kontrola                              | Wynik                                                               |
| ------------------------------------- | ------------------------------------------------------------------- |
| `npm install --cache /workspace/.npm` | OK, 153 pakiety; cache poza katalogiem domowym środowiska           |
| `npm run dev`                         | OK, start Vite i ładowanie strony bez błędów JS                     |
| `npm run lint`                        | OK: ESLint i Prettier                                               |
| `npm run typecheck`                   | OK                                                                  |
| `npm run test`                        | **11 zaliczonych**                                                  |
| `npm run build`                       | OK, statyczny `dist/`                                               |
| `npm run test:e2e`                    | **9 zaliczonych, 1 pominięty**                                      |
| Statyczny build `/` i `/PixelForge/`  | OK: start, ruch, skok, lądowanie na platformie; brak błędów JS/HTTP |
| `git diff --check`                    | OK                                                                  |

Playwright: Chromium 158, profile desktop i Pixel 7. Testy uruchamiane są
sekwencyjnie (jeden renderer programowy naraz), z limitem 60 s na scenariusz
obejmujący pełne przejście i ponowne uruchomienie. Dodatkowy test wielodotyku
jest pomijany na desktopie i wykonany w emulacji telefonu: rzeczywiste zdarzenia
Touch przez CDP, równoczesny ruch/skok oraz `touchCancel`. Pozostałe cztery
scenariusze wykonano na obu profilach. Pełne przejście poziomu używa klawiatury
oraz rzeczywistej fizyki; testy nie teleportują bohatera i nie wywołują akcji gry
przez prywatne API. `data-*` na obszarze gry to obserwowalny stan do asercji.

Sprawdzone: walidacja konfiguracji, nieznana akcja, uszkodzony i niezgodny zapis,
zablokowany getter localStorage, izolacja identyfikatorów, łączenie źródeł inputu,
granica importów. E2E obejmuje pełny przepływ, lądowanie na platformach,
interakcję, pauzę, odświeżenie/wznowienie, zakończenie, restart, ponowne
uruchomienie hosta, sterowanie ekranowe, wyciszenie, zmianę orientacji oraz
komunikaty dla złego JSON poziomu i brakującej grafiki.

Przegląd wizualny zrzutów: spójna zielono-granatowa paleta, animowany mały
wędrowiec, czytelne platformy, latarnia i księżycowe tło; canvas bez wygładzania,
z zachowaniem proporcji; duże przyciski dotykowe i czytelne menu mobilne.
Preferencja reduced motion wyłącza paralaksę i animację bezczynności.

- [Launcher — 1280 × 1000](screenshots/m0-launcher.png)
- [Rozgrywka — desktop](screenshots/m0-gameplay.png)
- [Rozgrywka — emulacja Pixel 7](screenshots/m0-mobile.png)

Build: JS **1 405,05 kB**, **378,29 kB gzip**, CSS **7,66 kB** (raport Vite).
Ostrzeżenie o chunku powyżej 500 kB wynika głównie z Phasera; build przechodzi.
Nie zmierzono wydajności na sprzęcie docelowym.

Zmiany obejmują konfigurację npm/Vite/TS/ESLint/Prettier/Playwright,
`index.html`, `src/app`, `src/engine`, `src/games`, style, `public/assets/games`,
`tools/generate-forest.py`, testy, README, roadmapę i ten raport ze zrzutami.
Specyfikacja otrzymała tylko formatowanie odstępu listy; jej założeń nie zmieniano.
Baza repozytorium: `56ec389`. Gałąź: `feature/m0-engine-foundation`.
Kod przekazany do przeglądu przez pull request; bez wdrożenia gry.

## Ograniczenia

- Jedna krótka plansza, zwykle poniżej minuty; nie demo 5–8 minut z M2.
- Zapis przechowuje flagi i koniec, nie dowolną pozycję ani rozbudowany checkpoint.
- Audio: trzy krótkie SFX, bez muzyki i miksowania. Brak ręcznej oceny odsłuchowej.
- Brak obrażeń/hit, przeciwników, żyć, ekranu porażki i pełnych behaviors z M1/M2.
- Przetestowany automatycznie Chromium na Linuxie i emulacja mobilna.
  Fizyczne telefony, Windows, Firefox, Edge i Safari/iOS nie zostały sprawdzone.
  Nie deklarujemy zmierzonej wydajności na tych urządzeniach.
- Phaser zwiększa rozmiar JS; ostrzeżenie Vite o dużym chunku jest znane.
  Optymalizacja bundla może nastąpić po sprawdzeniu współdzielenia runtime.
- Bez PWA: brak gwarancji ponownego wejścia offline. Brak publikacji i usług zewnętrznych.

Następny krok: osobna decyzja użytkownika o rozpoczęciu M1.

## Synchronizacja z aktualną dokumentacją

Uwzględniono aktualizacje z `56ec389`: osobna gałąź i PR, interakcja krótkim
naciśnięciem Shifta (toggle), skok wyłącznie Spacją, Esc pauzuje i wznawia.
Usunięto widoczne instrukcje sterowania i tekstowe wskazówki celu. Obiekt
interaktywny rozświetla się przy zbliżeniu; aktywacja i dezaktywacja zmieniają
wygląd i dźwięk. E2E sprawdza brak pisanych wskazówek, toggle bez powtarzania
podczas przytrzymania i wznowienie Esc. Playtest z nową osobą pozostaje w M2.
