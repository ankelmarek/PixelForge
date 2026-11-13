# PixelForge

> **Aktualizacja kierunku, 13.11.2026:** nie rozwijamy już **Winobrania** ani platformówki **Leśny sygnał**. PixelForge pozostaje aktywnym, współdzielonym silnikiem dla nowych gier 2D z góry. Priorytety: **duże mapy** i **aktualizator ZIP**. Bieżący plan: [ROADMAP.md](docs/ROADMAP.md), opis aktualizatora: [UPDATER-SPEC.md](docs/UPDATER-SPEC.md). Stary plan zachowano w [archiwum](docs/ROADMAP-ARCHIVE-2026-11.md).

**PixelForge** to uniwersalna, przeglądarkowa platforma do tworzenia małych gier 2D w estetyce pixel art. Docelowo każda gra ma oferować około **20–35 minut rozgrywki** i mieć własny początek, rozwinięcie oraz zakończenie.

Projekt powstaje z myślą o wielokrotnym wykorzystaniu gotowego silnika i produkowaniu kolejnych, niezależnych tytułów, zamiast pisania całych gier od zera.

## Główna zasada

**Silnik nie zna fabuły ani nazwy żadnej gry.** Odpowiada za sceny, wejście, fizykę, interakcje, dźwięk, zapis, UI i wspólny kontrakt zawartości. Każda gra dostarcza konfigurację, poziomy, grafikę, dźwięk i opcjonalne moduły mechanik.

## Technologia początkowa

- Phaser **4.2.1** (zablokowana wersja na start)
- TypeScript w trybie `strict`
- Vite
- Vitest do testów jednostkowych i kontraktowych
- Playwright do testów krytycznych przepływów w przeglądarce
- Statyczna aplikacja bez backendu, kont i obowiązkowego internetu po pobraniu zasobów

## Dokumenty dla Codexa

1. [AGENTS.md](./AGENTS.md): zasady postępowania i zakres prac dla Codexa.
2. [Specyfikacja](./docs/SPECIFICATION.md): cele, architektura, API, formaty zawartości i wymagania.
3. [Roadmapa](./docs/ROADMAP.md): aktualne etapy, zadania, priorytety i kryteria odbioru.
4. [Aktualizator ZIP](./docs/UPDATER-SPEC.md): bezpieczne wydania, upload, walidacja i rollback.

## Stan implementacji

Funkcje silnika powstały w historycznych gałęziach M0–M3 i powiązanych PR, które pozostają do przeglądu i integracji. **Gałąź main nie jest jeszcze opublikowaną wersją kodu.** Gry Winobranie i Leśny sygnał zostały porzucone jako rozwijane produkty; generyczne moduły pozostają do wykorzystania. Nowe mapy muszą być znacznie większe od historycznej próbki 640 × 416 pikseli.

## Gotowa paczka na hosting

[Pobierz wszystko do public_html — gra 0.8.0 + instalator i aktualizator 1.2.0](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p3-soil-adventure/downloads/pixelforge-public-html-0.8.0-installer-1.2.0.zip).

Rozpakuj **zawartość** w `public_html`, razem z ukrytymi `.htaccess`, i otwórz
`https://twoja-domena.pl/setup.php`. Pobierz z instalatora plik konfiguracji,
wgraj go do wskazanego podkatalogu i utwórz własne konto. Nie potrzeba SSH,
Node.js ani bazy danych. Hosting wymaga PHP 8.2+ / ZipArchive, HTTPS oraz
Apache 2.4 lub zgodnego LiteSpeed z działającą blokadą `.htaccess`.
Gra działa pod `/PixelForge/`, panel pod `/pixelforge-admin/`, a chroniony
`_pixelforge/` mieści cały kod narzędzia, konfigurację, staging i kopie.
[Instrukcja krok po kroku](docs/PUBLIC-HTML-INSTALL.txt), [raport](docs/PUBLIC-HTML-REPORT.md).
Paczka zachowuje stronę główną domeny i jej `.htaccess`; dodatkowy skrót do gry
to `/pixelforge.php`. Przy zastępowaniu starej gry wgraj nowy katalog `PixelForge`
w całości, bez pozostawiania starych assetów. Zachowaj wcześniejszą kopię.

**Do kolejnych aktualizacji gry albo samego hostingu statycznego:**
[Pobierz PixelForge 0.8.0 — Życie Dżdżownicy + Atlas](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p3-soil-adventure/downloads/pixelforge-0.8.0-full.zip).
W panelu U2 wybierz ten ZIP → **Sprawdź pakiet** → **Zainstaluj wydanie 0.8.0**.
Po instalacji otwórz stronę gry i wybierz **Zagraj** przy Życiu Dżdżownicy.
Panel trzeba wcześniej jednorazowo skonfigurować; jest osobnym narzędziem PHP.
Możliwe jest również ręczne wgranie na hosting statyczny:
Rozpakuj i wgraj `index.html`, cały katalog `assets/` oraz `manifest.json` do
katalogu strony, np. `public_html/pixelforge/`. Otwórz potem
`https://twoja-domena.pl/pixelforge/`. Na hostingu nie potrzebujesz Node.js,
Pythona ani PHP. [Pełna instrukcja](downloads/README.md).
Dżdżownica i Atlas zajmują całe okno przeglądarki, także po obrocie telefonu.
Wydanie 0.6.1 poprawia migotanie przy maksymalnym oddaleniu i daty plików ZIP
wpływające na cache przeglądarki. [Raport poprawki](docs/HOTFIX-0.6.1.md).

Generator U0 i instalator U1 są gotowe. Panel WWW **U2** jest gotowy
na osobnej gałęzi / [PR #9](https://github.com/ankelmarek/PixelForge/pull/9). [Instrukcja](admin-updater/README.md) opisuje
jednorazową konfigurację oraz upload, podgląd, instalację i rollback w przeglądarce.
Paczka gry nie wdraża się samodzielnie.

## Uruchamianie

Gałąź `feature/p3-soil-adventure` rozwija Dżdżownicę w pionowym przekroju gleby
na bazie instalacji public_html z PR #11. Zawiera grę **Życie Dżdżownicy**, rdzeń P0/P1,
demonstrację **Atlas** i narzędzia U0/U1/U2;
wcześniejsze PR pozostają zależnościami, bez automatycznego merge.
Wybierz **Zagraj**, następnie **Nowa gra** lub **Wznów**. Atlas pozostaje
dostępny pod przyciskami **Otwórz 4096 × 4096** / **8192 × 8192**.
Gra ma własne mechaniki i zapis, poza kodem silnika.
[Specyfikacja gry](docs/EARTHWORM.md), [raport nowej wersji](docs/P3-SOIL-REPORT.md).

Wymagane Node.js **24 LTS**, npm 11 oraz Python **3.11+** do testów i paczek U0.
Pełny zestaw testów obejmuje także PHP **8.2+**, ZipArchive i system Unix/Linux
(na Windows można użyć WSL). PHP służy aktualizatorowi, nie statycznej grze.
Po przełączeniu na bieżącą gałąź:

```bash
git clone --branch feature/p3-soil-adventure https://github.com/ankelmarek/PixelForge.git
cd PixelForge
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

`npm run dev` podaje lokalny adres Vite. `npm run build` tworzy statyczny `dist/`
z grą i demonstracją świata, bez testów oraz fixture'ów. Build działa także
z podkatalogu dzięki `base: './'`. `npm run preview` służy do jego sprawdzenia.

Przed pierwszym E2E: `npx playwright install chromium`, następnie `npm run test:e2e`.
Playwright uruchamia własny Vite na porcie 4190 i testuje prawdziwy EngineHost
w laboratorium P1 oraz przez syntetyczny harness rdzenia poza buildem. Testy nie importują
dawnych gier. PNG testowe odtwarza `python3 tools/generate-test-assets.py`.

[Inwentaryzacja i pochodzenie modułów](docs/CORE-INVENTORY.md),
[raport P0](docs/P0-REPORT.md), [raport P1](docs/P1-REPORT.md),
[format dużych światów i pomiary](docs/LARGE-WORLDS.md),
[plan dużych map i aktualizatora](docs/IMPLEMENTATION-PLAN.md).

Grafikę i sektory Atlasu odtwarza `npm run assets:world` (Python 3 bez bibliotek).
Pomiary: `npm run preview -- --port 4194`, w drugim terminalu `npm run measure:world`.
`?diagnostics=1` w adresie włącza lokalne liczniki techniczne. Nie jest to panel
aktualizatora.

## Paczki wydania U0

```bash
npm run package:release
npm run package:validate -- downloads/pixelforge-0.8.0-full.zip
npm run test:packages
```

Pierwsze polecenie buduje projekt i dopiero po sukcesie tworzy wersjonowany ZIP,
manifest oraz plik sumy SHA-256. Drugie sprawdza paczkę bez instalacji i bez
rozpakowywania. `npm test` obejmuje Vitest oraz testy paczek i aktualizatora
w Pythonie/PHP (biblioteka standardowa, bez pip). [Format, limity i polecenia](docs/RELEASE-PACKAGES.md),
[raport U0](docs/U0-REPORT.md).

## Panel U2 i instalator U1

[Osobny ZIP narzędzia PHP 1.2.0](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/p3-soil-adventure/downloads/pixelforge-updater-u2-1.2.0.zip)
rozpakowuje się poza katalogiem publicznym. Nie jest paczką gry do wgrania
do PixelForge. Aktualizacja gry 0.8.0 zachowuje zapisy Atlasu i starej Dżdżownicy. Nowy pionowy świat ma osobny zapis v3; mapa z widokiem z góry pozostaje dostępna po rollbacku do 0.7.0.

```bash
npm run test:updater
npm run test:updater:browser
npm run test:panel:browser
npm run test:release:browser
npm run package:updater
npm run package:hosting
npm run test:hosting
npm run test:hosting:browser
php admin-updater/cli.php help
```

Domyślnie testy używają `php` z PATH; `PIXELFORGE_PHP` może wskazać inną
binarkę/wrapper z PHP 8.2+, ZipArchive i memory_limit co najmniej 256M.
Test przeglądarkowy używa produkcyjnego ZIP-a i tymczasowej wersji 0.6.2
wyłącznie jako fixture. Sprawdza instalację, rollback i zachowanie zapisu.
[Konfiguracja i polecenia](admin-updater/README.md), [raport U1](docs/U1-REPORT.md),
[raport U2](docs/U2-REPORT.md). Test panelu używa lokalnego HTTPS i własnego
CA dodawanego na czas testu do NSS; wymaga OpenSSL oraz certutil (libnss3-tools).
Weryfikacja TLS pozostaje włączona.
Testy `hosting` wymagają dodatkowo Apache i modułu PHP (`apache2`,
`libapache2-mod-php` na Debianie/Ubuntu). Sprawdzają prawdziwe `.htaccess`,
konfigurację przez WWW, odrzucenie braku ochrony/TLS, SIGKILL, instalację
i rollback. Zmienne dla niestandardowych binarek opisuje [raport](docs/PUBLIC-HTML-REPORT.md).
`test:release:browser` używa rzeczywistego ZIP-a 0.8.0: instaluje go nad 0.6.1,
uruchamia Dżdżownicę, cofa wydanie, instaluje ponownie i wznawia zachowany zapis.
`npm run assets:earthworm` odtwarza autorską grafikę i mapę nowej gry.
U1 używa dwóch rename katalogów z krótkim oknem HTTP 404; po zabiciu procesu
w tym oknie potrzebne jest `recover`. Nie obiecuje atomowej podmiany.

Aktualizuj ten opis po każdej zmianie publicznego sposobu uruchamiania. Nie oznaczaj projektu jako ukończonego przed przejściem kryteriów odbioru z roadmapy.

## Zasoby

Grafiki, muzyka i fonty muszą mieć prawa pozwalające na publikację. Domyślnie używaj własnych zasobów lub odpowiednio licencjonowanych materiałów z zapisaną informacją o pochodzeniu.

## Dżdżownica: Pod powierzchnią (0.8.0)

Gra ma teraz pionowy przekrój gleby: rośliny u góry, korzenie i larwy pod ziemią,
pięć warstw, użyźnianie tuneli oraz deszcz przesiąkający w dół. Cztery przygody
obejmują gliniany zator, eskortę małej dżdżownicy, zalany skarbiec i głęboką oazę.
Finał to 300 punktów i dorosłość w gnieździe. [Opis gry](docs/EARTHWORM.md).

Nowa oprawa zawiera większe atlasy: dla aktualizatora zalecane są PHP
`upload_max_filesize=16M` i `post_max_size=17M` lub większe wartości. Panel pokazuje
rzeczywisty limit hostingu. Paczka pierwszej instalacji jest rozpakowywana przez
menedżer plików hostingu, a ZIP `full` wybiera się wewnątrz panelu aktualizacji.
