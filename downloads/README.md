# PixelForge M0 — paczka statyczna

Pobierz [PixelForge-M0-static.zip](PixelForge-M0-static.zip), rozpakuj i wgraj
**zawartość** archiwum do katalogu strony na serwerze. `index.html` i `assets/`
muszą znajdować się obok siebie. Nie trzeba instalować Node.js ani npm.

Otwórz adres strony przez HTTP(S), np. `https://twoja-domena.pl/PixelForge/`.
Paczka obsługuje też katalog główny domeny. Szczegóły: `WDROZENIE.txt` w ZIP.

Źródła: `cb6434593a18ecd6336d02c4000c275a57cbfb87`. Archiwum zawiera gotowy build M0, a nie kod źródłowy.
Po zmianie źródeł trzeba ponownie uruchomić `npm run build` i utworzyć ZIP
z zawartości `dist/`; paczka nie aktualizuje się automatycznie.

SHA-256:

```text
7fbf74ea19b799e1c48873d2ab32ac5bb29a61bc736484732d73f845973e9a29
```
