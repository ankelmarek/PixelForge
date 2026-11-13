# U0 — paczki full i walidator offline

U0 tworzy wydanie po udanym buildzie i sprawdza ZIP bez rozpakowywania,
instalowania, uruchamiania jego kodu ani dostępu do sieci. Narzędzie jest poza
`src/engine` i poza statyczną dystrybucją. Nie jest panelem WWW.

## Uruchomienie

Potrzebne lokalnie: Node.js 24 LTS, npm 11 i **Python 3.11+** (biblioteka
standardowa, bez pip). Na serwer statyczny trafiają tylko pliki gotowego ZIP-a.

```bash
npm ci
npm run package:release
npm run package:validate -- downloads/pixelforge-0.6.0-full.zip
npm run package:validate -- downloads/pixelforge-0.6.0-full.zip --expect-version 0.6.0
npm run test:packages
```

`package:release` wykonuje najpierw `npm run build`; błąd buildu zatrzymuje
pakowanie. Wersja pochodzi z `package.json`. Wynik to
`downloads/pixelforge-<wersja>-full.zip` i sąsiedni plik `.zip.sha256`.
Manifest znajduje się w głównym katalogu jako **`manifest.json`**. Obok niego
są `index.html` i `assets/`, bez nadrzędnego `dist/`. ZIP można też rozpakować
ręcznie i wgrać te trzy elementy na hosting; manifest jest zwykłym JSON-em.

Generator weryfikuje własny wynik przed udostępnieniem pliku. Te same bajty
buildu, wersja, limity i wersja zlib dają identyczny ZIP: kolejność wpisów,
uprawnienia i czas są stałe (1980-01-01). Paczka o tej samej wersji i innych
bajtach jest odrzucana — zwiększ wersję wydania. Ponowienie identycznego
pakowania jest dozwolone. Plik tymczasowy jest usuwany również po błędzie.

Bezpośrednie polecenie dla już sprawdzonego buildu:

```bash
python3 tools/release.py pack --source dist --output downloads --version 0.6.0
python3 tools/release.py validate downloads/pixelforge-0.6.0-full.zip
```

Walidator zwraca JSON z wersją, liczbą plików, rozmiarem i SHA-256 całego ZIP-a.
Sukces ma kod 0; odrzucenie paczki kod 2 i krótki komunikat na stderr. Nie
zapisuje żadnych plików. Wynik jest kontrolą integralności i kontraktu, nie
potwierdzeniem autentyczności wydawcy. SHA-256 nie zastępuje podpisu cyfrowego.

## Kontrakt v1

Wszystkie pola manifestu są wymagane; nieznane i powtórzone pola są błędem:

- `formatVersion: 1`, `project: "pixelforge"`, `packageType: "full"`.
- `releaseVersion`: stabilne `MAJOR.MINOR.PATCH`, bez prefiksu `v`, zer wiodących,
  prerelease ani metadanych. Opcjonalne `--expect-version` wymaga dokładnej wersji.
- `baseVersion: null`, `deletions: []`; delta czeka na U3.
- `requiredUpdaterVersion: "1.0.0"`: wersja kontraktu narzędzia U0. Wymaganie
  nowsze niż obsługiwane `1.0.0` odrzuca paczkę.
- `engineSchemaVersion: 2`: bieżący kontrakt silnika obsługujący poziomy v1/v2
  i dotychczasowe zapisy. U0 akceptuje tylko 2; nie jest to wersja Phasera.
- `files`: pełny spis plików buildu, każdy z `path`, `size` i małym hex SHA-256
  (64 znaki). Manifest nie hashuje samego siebie. Zbiór wpisów ZIP-a musi być
  dokładnie zgodny ze spisem plus `manifest.json`; `index.html` musi być niepusty.

U0 nie zmienia ID gier, rewizji światów ani kluczy/formatów localStorage.
Deklaracja `engineSchemaVersion` nie dowodzi zachowania dowolnego kodu JS;
zmiana zapisu nadal wymaga przeglądu, testów i ewentualnej migracji runtime.
Zasady aktualizacji starszego wydania i kontroli aktualnej instalacji należą
do U1. Walidacja samego `full` nie potrzebuje zainstalowanej wersji.

## Ograniczenia ZIP i ścieżek

Akceptujemy celowo wąski, zgodny z generatorem wariant ZIP: pojedynczy dysk,
metody STORE/DEFLATE, zwykłe pliki, bez szyfrowania, ZIP64, deskryptorów danych,
extra fields, komentarzy i wpisów katalogowych. Inne archiwa należy ponownie
zbudować generatorem, zamiast rozluźniać kontrolę. Metadane centralne i lokalne
muszą być zgodne, wpisy nie mogą się nakładać ani pozostawiać ukrytych przerw,
prefiksów lub danych za końcem archiwum.

Ścieżki są względne, ASCII, mają maksymalnie 240 znaków i 16 segmentów.
Dopuszczone: `index.html`, `assets/` z JS/CSS/JSON, PNG/WebP/SVG/JPEG,
OGG/MP3/WAV, WOFF/WOFF2 oraz plik `LICENSE.md`. Manifest jest osobnym wyjątkiem.
Odrzucamy traversal, ścieżki bezwzględne, dyski Windows, backslash, NUL,
segmenty `.`/`..`, puste segmenty, końcowe kropki/spacje, nazwy urządzeń Windows,
duplikaty także przy różnicy wielkości liter, symlinki, urządzenia i pliki
wykonywalne UNIX. Kod serwerowy, konfiguracja, sekrety, mapy źródłowe, źródła,
`node_modules`, `admin-updater`, `storage` i `backups` nie należą do allowlisty.
Generator odrzuca również dowiązania w źródłowym katalogu buildu.

Walidacja ogranicza metadane przed utworzeniem obiektów `ZipFile`. Dekompresja
używa ograniczonych bloków, sprawdza faktyczny koniec strumienia DEFLATE, rozmiar,
CRC i SHA-256. Fałszywy mały rozmiar/CRC w obu nagłówkach nie ukrywa nadmiarowych
danych. Mocno kompresowalne prawidłowe pliki generator zapisuje bez kompresji,
żeby nie tworzyć paczki przekraczającej dopuszczalny współczynnik.

## Konfigurowalne limity

| Klucz                          | Domyślny limit |
| ------------------------------ | -------------: |
| `maxArchiveBytes`              |         64 MiB |
| `maxFiles` (z manifestem)      |           4096 |
| `maxFileBytes`                 |         16 MiB |
| `maxTotalBytes` (z manifestem) |        256 MiB |
| `maxManifestBytes`             |          2 MiB |
| `maxMetadataBytes`             |          4 MiB |
| `maxCompressionRatio`          |            200 |

`--limits plik.json` dla obu komend nadpisuje wybrane limity, np.
`{"maxArchiveBytes": 33554432, "maxFiles": 1024}`. Wartości muszą być dodatnimi
liczbami całkowitymi; nieznane klucze są błędem. Konfiguracja pochodzi od
lokalnego operatora, nigdy z ZIP-a. Domyślny walidator trzyma skompresowany ZIP
w pamięci (do 64 MiB), a zawartość sprawdza blokami; nie jest serwerem uploadu.

## Granica etapu

U1 obejmie prywatny staging, blokadę, instalację i rollback po ustaleniu możliwości
hostingu. U2 doda uwierzytelniony panel i oddzielne potwierdzanie instalacji.
U3 obejmie delty. W U0 nie ma serwera, kont, uploadu, podmiany aktywnej strony,
czyszczenia zapisów ani automatycznego wdrożenia.
