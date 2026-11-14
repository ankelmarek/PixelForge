# Poprawka 0.6.1 — obraz przy oddaleniu i cache wydania

Data: 2026-11-13. Gałąź `feature/p2-u0-packages`, aktywny PR #7.
Zakres: zgłoszone migotanie mapy na komputerze w Chrome/Edge przy maksymalnym
oddaleniu oraz wcześniejsze ładowanie starego HTML po aktualizacji ZIP-em.

## Kamera

Przy zoomie 0.5 Phaser 4.2.1 wyłącza `renderRoundPixels`, nawet gdy kamera ma
włączone `roundPixels`. Canvas powiększony przez CSS zamienia ruch myszy
o jeden piksel na ułamkowe przesunięcie obrazu. Przy próbkowaniu nearest-neighbor
zmienia to wybierane piksele tekstury: drobne detale znikają i pojawiają się
ponownie. Sprawdzenie ładowania sektorów nie wykazało brakujących fragmentów.

`src/engine/simulation/camera.ts` wyrównuje początek widoku po uwzględnieniu
zoomu do siatki pikseli canvasu. `PointerInputService` używa tego samego
obliczenia przy przeciąganiu, zoomie, zmianie rozmiaru, minimapie i wznowieniu.
Dokładne granice świata są zachowane także przy ułamkowym zoomie. Ruch kamery
odbywa się w krokach jednego piksela renderowanego obrazu. Nie zmieniono
formatu map, zapisów ani oddzielenia silnika od klientów.

Test regresji zastępuje atlas terenu wzorem o szczegółach szerokości jednego
piksela i odczytuje kolor z WebGL podczas ruchu w obu osiach. Na wydaniu 0.6.0
oba przypadki desktopowe (mapy 4096 i 8192) wykrywają zmianę koloru; oba
przypadki mobilne już wcześniej przechodziły. Po poprawce przechodzą wszystkie
cztery przypadki, bez brakujących sektorów.

## Cache plików na hostingu

Wklejony przez użytkownika HTML wskazywał assety wydania 0.5.0, które zwracały 404. Odczyt serwera wskazał nowszy HTML wydania 0.6.0, ale z `Last-Modified`
z roku 1979/1980. Przyczyną były stałe daty wpisów ZIP-a ustawione na rok 1980.
Żądanie warunkowe z datą wcześniejszego wydania z listopada 2026 otrzymywało
HTTP 304 mimo zmienionego HTML, pozwalając przeglądarce zachować stary dokument.

Generator używa teraz jawnego czasu wydania `releaseEpoch` z `package.json`
lub `--epoch`. W 0.6.1 jest to `1794578584` (2026-11-13 14:03:04 UTC).
Ponowne pakowanie tych samych danych pozostaje powtarzalne. Walidator 0.6.0
akceptuje nowy ZIP: format manifestu pozostaje zgodny.

## Weryfikacja

- `npm run lint`, `npm run typecheck`, `npm run build`: PASS.
- `npm test`: 48 Vitest i 15 Python PASS. Nowe przypadki obejmują pozycję
  kamery, granice świata i rzeczywiste żądanie HTTP po rozpakowaniu ZIP-a
  z zachowaniem dat; nowszy HTML otrzymuje 200 zamiast 304.
- Pełny Playwright: 28 PASS, 2 SKIP (testy dotyku w profilu desktopowym).
  Obejmuje oba rozmiary map, panoramowanie, zoom, narożniki, pełne okno,
  zmianę rozmiaru, interakcje, zapis i obsługę błędów.
- Gotowy ZIP: identyczny wynik ponownego pakowania, poprawne CRC,
  SHA-256 każdego pliku i zgodność wszystkich 272 plików payloadu z `dist/`.
  Serwer statyczny z datami z ZIP-a zwraca nowy HTML dla daty starego wydania.
- Rozpakowany ZIP pod `/` i `/PixelForge/`, obie mapy i oba profile:
  8/8 PASS, bez błędów JS/HTTP. Osobno test obrazu przy zoomie 0.5 uruchomiony
  na plikach z ZIP-a: 4/4 PASS.

Testy przeglądarkowe wykonano na Chromium, z profilem desktopowym i emulacją
Pixel 7, z programowym renderowaniem WebGL. Nie zastępują sprawdzenia na
fizycznym telefonie ani na komputerze użytkownika. Odczyt publicznego hostingu
obejmował HTTP; poprawkę uruchomiono lokalnie. Nie wdrażano niczego na serwer.

## Paczka

[PixelForge 0.6.1 full ZIP](../downloads/pixelforge-0.6.1-full.zip):
545 304 bajty, 272 pliki buildu oraz manifest.

SHA-256: `e9b06ca8950de804d56056ea28a10d6dafd2eaf2e5f185430490d8f8f3554797`.

Rozpakuj i wgraj `index.html`, cały `assets/` oraz `manifest.json`, zastępując
poprzednią zawartość tych plików. Po wgraniu otwórz
`https://rozumisie.pl/PixelForge/index.html?v=0.6.1`, aby ominąć zapamiętany HTML.
[Pełna instrukcja](../downloads/README.md).

Poprawka pozostaje w aktywnym PR U0. U1–U3 i gry P3 nie zostały rozpoczęte.
