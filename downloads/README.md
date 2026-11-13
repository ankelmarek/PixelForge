# PixelForge P1 — gotowe pliki na serwer statyczny

[Pobierz ZIP](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p1-large-worlds/downloads/pixelforge-p1-0.5.0-static.zip)

Archiwum zawiera produkcyjny build P1 / Atlas 0.5.0 z commitu
`92614438a5ae52f879c9706858b10ef1e2d28641`, zbudowany przez `npm run build`.
Zawiera 272 pliki: `index.html` oraz `assets/`. Suma SHA-256 jest obok ZIP-a.

1. Pobierz i rozpakuj ZIP na komputerze albo w menedżerze plików hostingu.
2. Wgraj **całą rozpakowaną zawartość** do katalogu strony, np.
   `public_html/pixelforge/`. Zachowaj strukturę `assets/` i jego podkatalogów.
3. Otwórz `https://twoja-domena.pl/pixelforge/` i wybierz Atlas 4096 lub 8192.

Po wgraniu układ ma wyglądać tak:

```text
public_html/pixelforge/
├── index.html
└── assets/
    ├── index-....css
    ├── index-....js
    ├── world-lab-....js
    └── demos/large-world/...
```

Możesz też wgrać te pliki bezpośrednio do `public_html/`, aby działały pod głównym
adresem domeny. Wtedy `index.html` ma być bezpośrednio w `public_html/`.
Nie potrzeba Node.js, npm, PHP ani bazy danych na hostingu. Serwer ma udostępniać
pliki HTML, JS, CSS, JSON i PNG przez HTTP(S). Po aktualizacji odśwież stronę
z pominięciem pamięci podręcznej przeglądarki.

Zwykły ZIP źródeł z przycisku GitHub „Code → Download ZIP” nie zastępuje tej
paczki. Gotowe archiwum zawiera zawartość `dist/` bez dodatkowego katalogu
nadrzędnego. Repozytorium, `src/`, `node_modules/` i testy nie trafiają na hosting.

Jest to paczka do **ręcznego wgrania**. Nie zawiera panelu ani manifestu przyszłego
aktualizatora U0; nie oznacza wdrożenia P2. Rozpakowane archiwum sprawdzono pod
`/` i `/PixelForge/` w Chromium na desktopie i w emulacji Pixel 7.
