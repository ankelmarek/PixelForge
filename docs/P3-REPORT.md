# P3 — Życie Dżdżownicy, pierwsza grywalna wersja

Data: 13 listopada 2026. Gałąź `feature/p3-earthworm`, baza U2
`68cad4b9149c30a67a6f8e22ec6105e7749e9e5f` / PR #9. Main i wcześniejsze PR
pozostają bez automatycznego merge. Użytkownik wybrał tytuł i poprosił o ZIP
obsługiwany przez instalator. Nie wdrażano plików na jego hosting.

## Zakres

Powstała gra na mapie 4096 × 4096: ciało z segmentów, ruch myszą, klawiaturą
i dotykiem, drążenie trwałych tuneli, kolizje ze skałami, zbieranie ściółki,
utrzymywanie wilgoci, kałuże, 12 korzeni w czterech ogrodach, cztery fazy pogody,
krety i zwijanie obronne. Rozkwit daje checkpoint; są wygrana, porażka i restart.
Pierwszy ogród jest bezpieczny. Gra nie wyświetla pisanych instrukcji.

Kamera i UI wypełniają okno przeglądarki, również po obrocie telefonu. Zachowano
ostre skalowanie i wyrównanie przy zoomie 0.5. Pauza, wyciszenie, minimapa,
lokalny zapis i obsługa brakujących zasobów działają we wspólnym hoście.
Wersjonowany zapis Dżdżownicy nie zmienia kluczy Atlasu.

Nowe moduły rdzenia to zaufany `ClientDefinition`, `VersionedSave`,
`MutableGrid` i `MutableTerrainRenderer`. Model gry korzysta z publicznego API;
kod silnika nie importuje gier. JSON świata jest walidowany. Renderer utrzymuje
widoczne sektory 256 px, aktualizuje zmienione komórki oraz sąsiada przy szwie.
Nie tworzy całej mapy jako tekstury i nie oblicza globalnej ścieżki w runtime.
Zegar 50 Hz eliminuje zależność ruchu od liczby klatek.

Autorskie PNG i JSON odtwarza deterministyczny generator w Pythonie. Dźwięki
korzystają ze wspólnego Web Audio, bez plików cudzych gier i nowych zależności.

## Najważniejsze pliki

- `src/games/earthworm/`: definicja, parser świata, model i prezentacja Phaser.
- `src/engine/api/client.ts`, `api/terrain.ts`, `world/mutable-*.ts`,
  `systems/versioned-save.ts`: publiczne rozszerzenia wspólne dla kolejnych gier.
- `src/app/game.ts`, `launcher.ts`, `src/styles/main.css`: wspólny ekran gry i katalog.
- `public/assets/games/earthworm/`, `tools/generate-earthworm.py`: mapa i grafika.
- `tests/unit/earthworm.test.ts`, `tests/fixtures/earthworm-route.ts`,
  `tests/e2e/earthworm.spec.ts`, `tests/packages/game-browser.mjs`: testy produktu.
- `tests/updater/panel-browser.mjs`: dodatkowy przebieg z prawdziwym nowym ZIP-em.
- `downloads/`, README, roadmapa, [specyfikacja](EARTHWORM.md) i [API](CLIENT-API.md).

## Weryfikacja

Środowisko lokalne: Node 24.22.1, Phaser 4.2.1, Chromium 158.0.8127.18,
PHP 8.4.24 / ZipArchive. Testy telefonów są emulacją Pixel 7, nie fizycznym urządzeniem.

| Kontrola                                                   | Wynik                                      |
| ---------------------------------------------------------- | ------------------------------------------ |
| ESLint / Prettier, TypeScript strict, build Vite           | PASS                                       |
| Vitest: rdzeń, granice architektury i nowa gra             | 61 PASS                                    |
| U0: format i bezpieczeństwo ZIP                            | 15 PASS                                    |
| U1/U2: integracja PHP, ataki, awarie i rollback            | 36 PASS                                    |
| Playwright: cały runtime, Atlas i Dżdżownica               | 38 PASS, 2 celowe SKIP dotyku na desktopie |
| U1: instalacja i rollback Atlasu na obu mapach i ścieżkach | 8/8 PASS                                   |
| Prawdziwy ZIP 0.7.0: root/podkatalog, desktop/telefon      | 4/4 PASS                                   |
| Panel HTTPS: ZIP 0.7.0, rollback i ponowna instalacja      | desktop + Pixel 7 PASS                     |
| Panel bez JavaScript: upload, podgląd i odrzucenie planu   | PASS                                       |

Test pełnej trasy steruje rzeczywistym modelem, zbiera jedzenie, odwiedza wodę,
omija skały i używa zwinięcia przy kretach. Bez teleportowania lub dopisywania
zasobów ukończył 12 korzeni po 398,42 sekundach czasu symulacji, z 8535 zmienionymi
komórkami i trzema życiami. To przejazd automatu znającego mapę, **nie pomiar czasu
gracza**. Osobny test pokrywa kolizję w klatce kończącego rozkwitu.

Przeglądarka sprawdza normalne zebranie trzech porcji i pierwszy rozkwit,
sterowanie, pauzę, Escape, utratę fokusu, wyciszenie, zapis/odświeżenie,
minimapę, zoom, obrót, błędny JSON, brak PNG oraz uszkodzony zapis. Ekrany końca
sprawdza z kontrolowanego zapisu tuż przed końcem; całą trasę sprawdza test modelu.
Zaktualizowano oczekiwania historycznych testów pustego katalogu po dodaniu gry.

Panel sprawdzono również w dotychczasowym przebiegu U2 z fixture 0.6.2.
Nowy przebieg korzysta z **prawdziwej paczki 0.7.0**: zachowuje zapis Atlasu,
instaluje nową grę, ożywia pierwszy korzeń, zapisuje tunele, cofa do 0.6.1,
sprawdza zachowanie obcego dla starej wersji zapisu i ponownie instaluje 0.7.0.
Wznawia Dżdżownicę z tym samym postępem i liczbą komórek tunelu. TLS jest
weryfikowany przez tymczasowy lokalny CA; certyfikat jest usuwany po teście.

Pomiary na rozpakowanym ZIP-ie, 6 sekund ruchu przy zoomie 0.5:

| Widok                                    | Średnie FPS | 95. percentyl klatki | Tekstury sektorów   | JS heap po GC |
| ---------------------------------------- | ----------- | -------------------- | ------------------- | ------------- |
| Desktop 1280 × 800, `/` i `/PixelForge/` | 59,7–59,8   | 16,7 ms              | 2 MiB / 8 sektorów  | 7,3–7,4 MiB   |
| Emulacja Pixel 7, obie ścieżki           | 37,6–57,2   | 16,8–50 ms           | 7 MiB / 28 sektorów | 7,2–7,3 MiB   |

To krótki pomiar headless Chromium w środowisku współdzielonym; emulacja telefonu
nie odwzorowuje jego CPU/GPU. Niższy drugi wynik mobilny pozostaje w raporcie.
Nie traktujemy tych wyników jako gwarancji FPS na fizycznym urządzeniu.
Surowe wyniki: [gra](P3-GAME-BROWSER-RESULTS.json),
[instalator](P3-INSTALLER-BROWSER-RESULTS.json).
Zrzuty: [desktop](screenshots/p3-desktop.png), [telefon](screenshots/p3-mobile.png).

## Paczka

Wydanie `pixelforge-0.7.0-full.zip` obejmuje silnik, grę, Atlas i manifest v1
zgodny z instalatorem U1 1.0.0 / panelem U2 1.1.0. Kontrakt silnika pozostaje 2.
283 pliki buildu + manifest, 585255 bajtów ZIP, 2980511 bajtów po rozpakowaniu.
SHA-256: `0d5a302ae4cf7bd11c0529c655a876825b76bf2f02dcedda6a7c97e1d392f492`.

Instrukcja: [downloads/README.md](../downloads/README.md). W panelu wysyła się
cały ZIP bez rozpakowania. Paczka nie zawiera panelu PHP, źródeł, testów ani
node_modules. U3 nie jest potrzebne do instalacji pełnego wydania.

## Ograniczenia odbioru

Do sprawdzenia z użytkownikiem pozostają zrozumiałość bez instrukcji, balans
i docelowe 20–35 minut. Nie deklarujemy playtestu na człowieku, fizycznym
telefonie, Firefoxie ani Safari. Build zgłasza znany rozmiar wspólnego chunku
Phasera (około 1,4 MB przed gzip); jest pobierany dopiero po wyborze gry/dema.
Pełne okno oznacza obszar strony, bez wymuszania F11. Instalator zachowuje
udokumentowane ograniczenie dwóch rename z krótkim oknem niedostępności.

Następny krok: odbiór tej gry i ewentualny tuning na podstawie uwag.
Nie rozpoczęto U3, Studio, kolejnego tytułu ani publikacji na hostingu.
