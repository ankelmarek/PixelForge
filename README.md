# PixelForge

Modułowy runtime gier 2D w pixel art: **Phaser 4.2.1**, TypeScript `strict`, Vite.
Silnik nie zna nazw ani fabuły gier. M1 dostarcza współdzielony runtime,
a M2 — kampanię **Leśny sygnał** (`forest-demo`): trzy mapy, kolekcje, patrole,
checkpointy i zakończenie. Użytkownik wdrożył i pozytywnie przetestował paczkę M2. Niezależny test
z nową osobą nieznającą sterowania nie został jeszcze potwierdzony.

## Gotowa paczka na serwer statyczny

[Pobierz ZIP M2](downloads/PixelForge-M2-static.zip?raw=true). Rozpakuj i wgraj
`index.html` oraz cały katalog `assets/` do katalogu strony na serwerze HTTP(S).
Nie potrzebujesz Node.js, npm ani PHP. [Szczegóły i suma kontrolna](downloads/README.md).

## Uruchomienie

Wymagany **Node.js 24 LTS** (`.nvmrc`, `engines`) i npm 11.

```bash
npm install
npm run dev
```

Otwórz adres podany przez Vite (domyślnie `http://localhost:5173`).
Kod M1: `feature/m1-runtime`. Demo M2: `feature/m2-forest-demo`.
Etapy są przekazywane w osobnych PR-ach; `main` może nie zawierać jeszcze implementacji.

W katalogu wybierz **Odkryj las**, potem **Nowa wyprawa** lub **Wznów wyprawę**.
Na telefonie w tej samej sieci użyj adresu LAN komputera i portu Vite;
firewall musi przepuszczać ten port.

```bash
npm run build
npm run preview
```

`dist/` jest samodzielnym statycznym buildem. Serwuj go przez HTTP(S), także
pod `/PixelForge/` (z końcowym ukośnikiem). Domyślne `base: './'` obsługuje domenę
oraz podkatalog. Można też jawnie zbudować `npm run build -- --base=/PixelForge/`.
Nie otwieraj `index.html` przez `file://`. Po pobraniu zasobów gra nie potrzebuje
backendu; ponowne uruchomienie w pełni offline/PWA nie jest częścią M0.

## Sterowanie (dokumentacja deweloperska)

- Ruch: **← → / A D**, skok: **Spacja**.
- W grze nie ma pisanych instrukcji; nauka odbywa się wizualnie.
- Zbierz odłamki w każdej krainie, wróć do latarni i wciśnij **Shift**.
  Potem przejdź przez otwartą bramę. To opis dla dewelopera, niewyświetlany w grze.
- Przyciski ekranowe: **← →**, **↑** (skok), **✦** (interakcja), także wielodotyk.
- **Esc** lub **Pauza** zatrzymuje grę; **Esc** lub przycisk **Wróć do gry** ją wznawia.
- Dostępne są restart, wyciszenie, ekran zakończenia i powrót do katalogu bez
  przeładowania strony. Klawisze gry działają po nadaniu fokusowi canvasowi.
- Zapis v2 zachowuje etap, checkpoint, flagi, kolekcje, życia i czas, osobno dla
  każdego `gameId`. Wznowienie przenosi do checkpointu. Nowa wyprawa zeruje zapis. Brak dostępu do
  localStorage lub uszkodzony zapis nie blokują sesji. Po ukryciu karty lub utracie
  fokusu gra automatycznie pauzuje.

## Kontrole jakości

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Pełne przejście rzeczywistych map, po uruchomieniu `npm run dev` na porcie 5173:

```bash
node tools/play-campaign.mjs
```

To dłuższy test automatycznego gracza przez zwykłe klawisze, bez teleportacji
i zmiany czasu silnika. Zapisuje pomiar, stan i zrzuty w `work/`.

Playwright sam uruchamia Vite. Testuje Chromium desktop i emulację Pixel 7,
przejście całego poziomu przez rzeczywiste sterowanie, kolizje, interakcję,
pauzę, zapis/wznowienie, restart, powrót do katalogu, przyciski ekranowe, orientację,
błędną mapę, brak assetu i uszkodzony JSON zapisu. Emulacja nie zastępuje testu
na fizycznym Androidzie/iPhonie. `npm run format` formatuje pliki.

## Organizacja

- `src/app/` — launcher i interfejs HTML.
- `src/engine/api/` — publiczne typy, walidacja i `EngineHost`.
- `src/engine/core/`, `scenes/`, `systems/` — host, Boot/Preload/Title/Gameplay,
  minimalne wejście, zapis i syntetyzowane efekty dźwiękowe.
- `src/games/forest-demo/`, `public/assets/games/forest-demo/` — konfiguracja,
  grafiki i JSON poziomu; wyłącznie specyfika demonstracji.
- `tests/` — Vitest i Playwright.
- `tools/generate-forest.py` — odtwarzanie własnych PNG (Python 3, bez bibliotek);
  `tools/generate-campaign.py` — mapy kampanii.

API runtime M1: [ENGINE-API.md](docs/ENGINE-API.md),
[raport M1](docs/M1-REPORT.md).

Demo M2 i ograniczenia odbioru: [M2-REPORT.md](docs/M2-REPORT.md).

Kontrakt M0 i raport: [docs/M0-REPORT.md](docs/M0-REPORT.md).
Założenia: [AGENTS.md](AGENTS.md), [specyfikacja](docs/SPECIFICATION.md),
[roadmapa](docs/ROADMAP.md). **Winobranie/M3 pozostaje odłożone do zakończenia odbioru M1/M2 i osobnego polecenia.**

Zasoby są oryginalne; ich pochodzenie i warunki użycia zapisano w
[licencji assetów](public/assets/games/forest-demo/LICENSE.md). Brak zewnętrznych
fontów, telemetrii, kont i usług sieciowych w runtime. Projekt nie jest automatycznie publikowany.
