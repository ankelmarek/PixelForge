# PixelForge 0.9.3 — Winobranie RTS W1 + Życie Dżdżownicy + Atlas

## Pierwsza instalacja wszystkiego w public_html

[Pobierz jeden ZIP: PixelForge + instalator + aktualizator](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/w1-winobranie-rts/downloads/pixelforge-public-html-0.9.3-installer-1.2.0.zip).

1. Rozpakuj zawartość w `public_html`, także ukryte pliki `.htaccess`.
2. Otwórz `https://twoja-domena.pl/setup.php`.
3. Pobierz konfigurację z instalatora i wgraj ją jako
   `public_html/_pixelforge/install-settings.php`, zastępując pusty wzór.
4. Odśwież instalator, podaj `setupKey` z pliku, własny login i hasło.
5. Gra: `/PixelForge/index.html`; panel: `/pixelforge-admin/index.php`.

Wszystkie pliki projektu, kopie i dane panelu pozostają pod `public_html`.
Wymagane PHP 8.2+ / ZipArchive, HTTPS i Apache 2.4 lub zgodny LiteSpeed.
Nie wymaga SSH. Instalator sprawdza ochronę prywatnego podkatalogu przez HTTPS.
Paczka jest przeznaczona do pierwszej instalacji panelu. Zachowuje stronę główną
domeny i jej `.htaccess`; skrót do gry to `/pixelforge.php`. Stary katalog
`PixelForge` zachowaj w kopii i zastąp kompletnym nowym, bez mieszania assetów.
Nie rozpakowuj paczki startowej ponownie na skonfigurowany panel.
[Pełna instrukcja i wymagania](../docs/PUBLIC-HTML-INSTALL.txt),
[raport testów](../docs/PUBLIC-HTML-REPORT.md).

## Paczka samej gry do aktualizatora

[Pobierz gotowy ZIP gry](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/w1-winobranie-rts/downloads/pixelforge-0.9.3-full.zip).

**Do instalatora wgrywasz `pixelforge-0.9.3-full.zip` w całości, bez rozpakowywania.**
Zawiera silnik, Winobranie RTS W1, Dżdżownicę, dotychczasowy Atlas, zasoby i manifest z SHA-256.
Nie jest to ZIP źródeł z przycisku „Code → Download ZIP”.

Większe grafiki wymagają odpowiedniego limitu uploadu w PHP. Zalecane:
`upload_max_filesize=16M`, `post_max_size=17M` lub więcej. Panel pokazuje limit
ustawiony na hostingu; jego zmiana należy do ustawień PHP w panelu hostingowym.

## Instalacja przez panel U2

1. Otwórz skonfigurowany panel administratora i zaloguj się.
2. Wybierz `pixelforge-0.9.3-full.zip` i kliknij **Sprawdź pakiet**.
3. Sprawdź wersję i listę zmian, następnie **Zainstaluj wydanie 0.9.3**.
4. Otwórz stronę gry pod dotychczasowym adresem, np.
   `https://twoja-domena.pl/PixelForge/index.html?v=0.9.3`.
5. Przy Życiu Dżdżownicy wybierz **Zagraj** i **Nowa gra** albo **Wznów**.

Panel U2 musi wcześniej zostać zainstalowany i skonfigurowany według
[instrukcji](../admin-updater/README.md). Wymaga PHP 8.2+, ZipArchive i HTTPS.
ZIP gry nie instaluje panelu. Można także użyć CLI instalatora U1 (`prepare`,
następnie `apply` z identyfikatorem planu i sumą pokazaną przez `prepare`).
U3 i paczki delta nie są do tego potrzebne.

Rollback w panelu przywraca poprzednią wersję aplikacji. Zapis Dżdżownicy
pozostaje w przeglądarce i wraca po ponownej instalacji 0.9.3. Pionowa przygoda
korzysta z osobnego zapisu v3; zapis starego ogrodu v1 nie jest kasowany ani
przenoszony do odmiennej mapy. Zachowaj ten sam
adres i przeglądarkę, żeby odczytać dotychczasowe zapisy.

## Hosting wyłącznie statyczny

Rozpakuj ZIP i wgraj **całą zawartość** do katalogu strony: `index.html`,
`manifest.json` i całe `assets/`. Gra nie potrzebuje PHP ani Node.js.
Jeśli adres kończący się `/` nie otwiera strony, dopisz `index.html`.
W tej paczce nie ma dodatkowego katalogu nadrzędnego.

Kontrola lokalna: `npm run package:validate -- downloads/pixelforge-0.9.3-full.zip`.
Odtworzenie z kodu: `npm ci`, następnie `npm run package:release`.
[Specyfikacja gry](../docs/EARTHWORM.md), [raport nowej gry](../docs/P3-SOIL-REPORT.md).

## Archiwum: PixelForge 0.7.0

[Poprzednia Dżdżownica z widokiem z góry](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/u2-public-html-bundle/downloads/pixelforge-0.7.0-full.zip).
Archiwum pozostaje niezmienione. W panelu do powrotu służy rollback,
nie instalacja niższej wersji jako nowej aktualizacji.

## Archiwum: PixelForge 0.6.1

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
Paczki P1 0.5.0/0.5.1 i U0 0.6.0/0.6.1 zachowano jako archiwum; bieżąca to **0.9.3-full**.

## Osobny panel aktualizacji U2 — wariant prywatny poza public_html

[Pobierz panel PHP U2 1.2.0](https://github.com/ankelmarek/PixelForge/raw/refs/heads/feature/u2-public-html-bundle/downloads/pixelforge-updater-u2-1.2.0.zip).
Ten ZIP rozpakowuje się **poza public_html**. Jednorazowy konfigurator CLI
ustawia własne hasło i tworzy publiczny plik panelu. Kolejne pełne ZIP-y gry
wgrywa się już przez przeglądarkę: logowanie, podgląd, osobne zatwierdzenie.

Nie wgrywaj ZIP-a panelu do katalogu gry ani do formularza paczek full.
Wymagane PHP 8.2+, ZipArchive i HTTPS. Gra pozostaje statyczna; bieżące wydanie to 0.9.3.
[Instrukcja konfiguracji i obsługi](../admin-updater/README.md),
[raport U2](../docs/U2-REPORT.md).
Poprzednie ZIP-y U1 1.0.0 i U2 1.1.0 zachowano bez zmiany bajtów.
