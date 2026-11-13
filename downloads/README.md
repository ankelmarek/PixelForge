# PixelForge 0.6.1 — gotowe pliki na serwer statyczny

[Pobierz ZIP](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p2-u0-packages/downloads/pixelforge-0.6.1-full.zip)

Archiwum zawiera produkcyjny Atlas w pełnym oknie oraz manifest U0.
Utworzono je przez `npm run package:release`: 272 pliki buildu (`index.html`
i `assets/`) oraz `manifest.json`, łącznie 273 wpisy ZIP. Suma SHA-256 jest obok ZIP-a.

1. Pobierz i rozpakuj ZIP na komputerze albo w menedżerze plików hostingu.
2. Wgraj **całą rozpakowaną zawartość** do katalogu strony, np.
   `public_html/pixelforge/`. Zachowaj strukturę `assets/` i jego podkatalogów.
3. Otwórz `https://twoja-domena.pl/pixelforge/` i wybierz Atlas 4096 lub 8192.

Po wgraniu układ ma wyglądać tak:

```text
public_html/pixelforge/
├── index.html
├── manifest.json
└── assets/
    ├── index-....css
    ├── index-....js
    ├── world-lab-....js
    └── demos/large-world/...
```

Możesz też wgrać te pliki bezpośrednio do `public_html/`, aby działały pod głównym
adresem domeny. Wtedy `index.html` ma być bezpośrednio w `public_html/`.
Nie potrzeba Node.js, npm, PHP ani bazy danych na hostingu. Serwer ma udostępniać
pliki HTML, JS, CSS, JSON i PNG przez HTTP(S). Po aktualizacji otwórz `https://twoja-domena.pl/pixelforge/index.html?v=0.6.1`
i odśwież stronę z pominięciem pamięci podręcznej przeglądarki. To istotne przy
przejściu z 0.6.0: zapamiętany HTML mógł wskazywać stare, usunięte pliki JS/CSS.

Zwykły ZIP źródeł z przycisku GitHub „Code → Download ZIP” nie zastępuje tej
paczki. Gotowe archiwum zawiera zawartość `dist/` bez dodatkowego katalogu
nadrzędnego. Repozytorium, `src/`, `node_modules/` i testy nie trafiają na hosting.

Paczka `full` nadaje się do **ręcznego wgrania** i do walidacji offline U0.
`manifest.json` jest zwykłym plikiem danych; nie wymaga serwera aplikacyjnego.
Nie zawiera panelu ani instalatora U1/U2. Rozpakowane archiwum sprawdzono pod
`/` i `/PixelForge/` w Chromium na desktopie i w emulacji Pixel 7.

Opcjonalna kontrola lokalna z repozytorium:

```bash
npm run package:validate -- downloads/pixelforge-0.6.1-full.zip
```

Wynik poprawnej kontroli ma `valid: true`. Szczegóły i limity:
[RELEASE-PACKAGES.md](../docs/RELEASE-PACKAGES.md).
Poprzednie paczki P1 0.5.0/0.5.1 i U0 0.6.0 zachowano jako archiwum; bieżąca to **0.6.1-full**.

## Osobny panel aktualizacji U2

[Pobierz panel PHP U2 1.1.0](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p2-u2-admin-panel/downloads/pixelforge-updater-u2-1.1.0.zip).
Ten ZIP rozpakowuje się **poza public_html**. Jednorazowy konfigurator CLI
ustawia własne hasło i tworzy publiczny plik panelu. Kolejne pełne ZIP-y gry
wgrywa się już przez przeglądarkę: logowanie, podgląd, osobne zatwierdzenie.

Nie wgrywaj ZIP-a panelu do katalogu gry ani do formularza paczek full.
Wymagane PHP 8.2+, ZipArchive i HTTPS. Gra pozostaje statyczna w wersji 0.6.1.
[Instrukcja konfiguracji i obsługi](../admin-updater/README.md),
[raport U2](../docs/U2-REPORT.md).
Poprzedni ZIP U1 1.0.0 zachowano jako archiwum narzędzia CLI.
