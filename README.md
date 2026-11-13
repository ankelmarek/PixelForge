# PixelForge

Modułowy runtime gier 2D w pixel art: **Phaser 4.2.1**, TypeScript `strict`, Vite.
Silnik nie zna nazw ani fabuły gier. M0 dostarcza uruchamialny fundament i jedną
krótką platformówkę **Leśny sygnał** (`forest-demo`). To prototyp jednego poziomu,
nie docelowa demonstracja 5–8 minut ani ukończony silnik MVP.

## Uruchomienie

Wymagany **Node.js 24 LTS** (`.nvmrc`, `engines`) i npm 11.

```bash
npm install
npm run dev
```

Otwórz adres podany przez Vite (domyślnie `http://localhost:5173`).
Kod M0 znajduje się na gałęzi `feature/m0-engine-foundation`.

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
- Wejdź po platformach do latarni i wciśnij **Shift**. Potem dotrzyj do bramy po prawej.
- Przyciski ekranowe: **← →**, **↑** (skok), **✦** (interakcja), także wielodotyk.
- **Esc** lub **Pauza** zatrzymuje grę; **Esc** lub przycisk **Wróć do gry** ją wznawia.
- Dostępne są restart, wyciszenie, ekran zakończenia i powrót do katalogu bez
  przeładowania strony. Klawisze gry działają po nadaniu fokusowi canvasowi.
- Zapis lokalny zachowuje zapalenie latarni i ukończenie, osobno dla każdego `gameId`.
  Wznowienie przenosi do latarni. Nowa wyprawa zeruje zapis. Brak dostępu do
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
- `tools/generate-forest.py` — odtwarzanie własnych PNG (Python 3, bez bibliotek).

Kontrakt M0 i raport: [docs/M0-REPORT.md](docs/M0-REPORT.md).
Założenia: [AGENTS.md](AGENTS.md), [specyfikacja](docs/SPECIFICATION.md),
[roadmapa](docs/ROADMAP.md). **M1 i kolejne etapy wymagają osobnego polecenia.**

Zasoby są oryginalne; ich pochodzenie i warunki użycia zapisano w
[licencji assetów](public/assets/games/forest-demo/LICENSE.md). Brak zewnętrznych
fontów, telemetrii, kont i usług sieciowych w runtime. Projekt nie jest automatycznie publikowany.
