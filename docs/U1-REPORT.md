# Raport U1 — instalator PHP i rollback

Data: 2026-11-13. Gałąź `feature/p2-u1-installer`, PR #8, zależny od
zaakceptowanego wydania 0.6.1 / PR #7. U1 zaimplementowane i przetestowane
lokalnie. Nie scalano PR i nie wdrażano narzędzia na hosting użytkownika.

## Wybór adaptera

Publiczny odczyt https://rozumisie.pl/ zwrócił nagłówek
`X-Powered-By: PHP/8.5.12`. DNS domeny wskazał `ns1.vh.pl` i `ns2.vh.pl`;
jest to wskazówka dotycząca dostawcy, nie potwierdzenie konfiguracji konta.
[Oferta VH.PL](https://vh.pl/hosting-www) wymienia PHP i SSH.
Pozwoliło to wybrać adapter PHP 8.2+ z wejściem CLI, bez danych dostępowych
i bez zakładania, że samo uruchomienie statycznego Atlasu potwierdza PHP.

Dostępność ZipArchive, prawa, ścieżki i możliwości systemu plików muszą przejść
lokalny preflight `doctor`. Nie zostały sprawdzone na koncie użytkownika.
Biblioteka może zostać wykorzystana przez uwierzytelniony panel U2.

## Wykonane

- PHP-owy walidator zgodny z ograniczonym kontraktem full U0: manifest,
  wersje, ścieżki, allowlista, metadane ZIP, rozmiary, CRC, SHA-256 i faktyczny
  koniec DEFLATE. Duplikaty kluczy JSON są odrzucane. Dekompresja pracuje
  na ograniczonych blokach, także przy fałszywym rozmiarze i CRC.
- Prywatny staging i podgląd dodanych, zmienionych oraz usuniętych plików.
  Osobne zatwierdzenie przez identyfikator planu i hash paczki; ponowna
  walidacja ZIP-a, stagingu oraz aktywnej wersji przed podmianą.
- Blokada jednej operacji, budżet prywatnego miejsca, rezerwa dysku i kontrola
  pamięci PHP. Odrzucanie symlinków, hardlinków, obcych plików/katalogów oraz
  prób umieszczenia danych administratora we wskazanym document root.
- Prywatne wersjonowane kopie, dziennik transakcji zapisany przed podmianą,
  kontrola zdrowia, automatyczny powrót przed zatwierdzeniem, ręczny rollback
  oraz odzyskanie po przerwaniu procesu. Operacje można bezpiecznie ponowić.
- Czasy aktywowanych plików odświeżane również przy rollbacku, aby HTTP
  If-Modified-Since nie utrzymywał nieaktualnego HTML-u.
- Jawne odrzucanie planu i sprzątanie nieużywanych wydań; zachowana aktualna
  i poprzednia wersja oraz wydania wskazane przez oczekujące plany.
- Osobna dystrybucja narzędzia PHP, poza ZIP-em statycznej gry.

## Pliki

| Plik                                                             | Odpowiedzialność                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `admin-updater/src/Package.php`                                  | Kontrakt U0, walidacja ZIP-a i katalogu, bezpieczne rozpakowanie                  |
| `admin-updater/src/Support.php`                                  | JSON bez duplikatów, ograniczone I/O, synchronizacja, operacje plikowe            |
| `admin-updater/src/Updater.php`                                  | Preflight, przygotowanie, instalacja, dziennik, odzyskanie i rollback             |
| `admin-updater/cli.php`                                          | Lokalne polecenia administratora, odmowa dostępu HTTP                             |
| `admin-updater/config.example.json`, `release.json`, `README.md` | Konfiguracja, wersja narzędzia i instrukcja                                       |
| `tests/updater/`                                                 | Testy PHP z Pythonem, procesy SIGKILL, korpus U0 i test rzeczywistej przeglądarki |
| `tools/package-updater.py`                                       | Powtarzalna paczka narzędzia z manifestem SHA-256                                 |

Zaktualizowano także komendy npm, README, instrukcję pobierania, roadmapę
i dokumentację aktualizatora. Runtime gry i format localStorage nie zmieniły się.
Wszystkie 272 pliki nowego `dist/` są identyczne z payloadem ZIP-a gry 0.6.1.

## Weryfikacja

Środowisko: Linux, Node 24, Python 3.12, PHP **8.4.24** z ZipArchive.
PHP użyto z oficjalnych pakietów Debiana, lokalnie w środowisku testowym;
nie instalowano niczego na hostingu użytkownika.

- Lint / formatowanie, TypeScript i build: PASS. Źródła PHP sprawdzone
  parserem i uruchomione przez testy.
- Vitest: **48 PASS**; testy Python U0: **15 PASS**.
- Integracja PHP U1: **22 PASS**, w tym **129** odrzuconych wariantów archiwów
  z tego samego korpusu co U0. Poprawne produkcyjne ZIP-y 0.6.0 i 0.6.1 zaakceptowane.
- Rzeczywisty SIGKILL w 9 punktach instalacji, 8 punktach rollbacku i 3
  punktach odzyskiwania; także przerwanie pierwszej instalacji. Brak wykonania
  finally po SIGKILL jest częścią testu. Ponowienie odzyskuje znany stan.
- Sprawdzono wyjątki, uszkodzenie aktywowanej zawartości, brak miejsca,
  niewystarczającą pamięć i prawa, równoległą operację, podmianę ZIP-a/stagingu,
  przestarzały plan, uszkodzoną kopię i odmowę HTTP dla cli.php.
- Pełny Playwright silnika: **28 PASS + 2 SKIP** dotyku na desktopie.
- Instalacja prawdziwego Atlasu i rollback w Chromium: **8/8 PASS** — mapy
  4096/8192, desktop/Pixel 7, ścieżki / i /PixelForge/. Zachowane klucze zapisu,
  postęp czasowy, zoom i pozycja kamery; bez błędów JS/HTTP.
  [Wyniki maszynowe](U1-BROWSER-RESULTS.json).
- Sprawdzenie wyodrębnionego ZIP-a narzędzia: doctor, przygotowanie, instalacja
  i rollback PASS; CRC i wszystkie sumy zgodne ze źródłami, ponowne pakowanie
  daje identyczne bajty. Walidator gry odrzuca ZIP narzędzia.

W teście przeglądarkowym 0.6.2 jest **wyłącznie tymczasowym fixture'em**
z niezmienionym payloadem 0.6.1; nie opublikowano gry w wersji 0.6.2.

## Granice i sposób użycia

U1 stosuje fallback dwóch rename katalogów, bez symlinków i bez edycji
.htaccess. Między rename występuje krótkie okno HTTP 404. Po SIGKILL w tym
oknie dostępność wraca po wywołaniu recover; nie ma działającego w tle demona.
Przy zwykłym błędzie przed trwałym zatwierdzeniem powrót jest automatyczny.
Po zatwierdzeniu stan nowej wersji jest sprawdzany i domykany.

Kontrola zdrowia w PHP sprawdza integralność plików, nie poprawność dowolnej
rozgrywki. Zapisów nie czyści; zmiany ich formatu w przyszłych wydaniach nadal
wymagają przeglądu i testu migracji. Otwarta sesja może wymagać odświeżenia po
zmianie assetów. Blokada nie koordynuje zewnętrznego FTP ani drugiej konfiguracji.
Ręczny rollback sprawdza również zgodność bieżącego katalogu z zapisanym
stanem; niezależnie zmienione lub obce pliki wymagają diagnostyki administratora
zamiast automatycznego nadpisania.

Testy nie obejmują rzeczywistego zaniku zasilania/dysku, NFS, Windows jako
serwera, fizycznego telefonu ani Safari/Firefox. Przeglądarkę uruchomiono
z programowym WebGL. PHP 8.5 na serwerze użytkownika nie było środowiskiem
wykonania testów. U2/U3 i gry P3 pozostają poza zakresem.

## Paczka

[Instalator U1 1.0.0](../downloads/pixelforge-updater-u1-1.0.0.zip):
**20 333 bajty**, 8 wpisów, w tym manifest SHA-256.

SHA-256: `b2359d83576a1ec5ded63b0300cc4eaaf85f30bb4e5e5bc440cfc07c3040d60d`.

Rozpakowanie poza public_html i polecenia:
[instrukcja administratora](../admin-updater/README.md).
Kolejny etap to **U2 — logowanie, upload i podgląd/instalacja przez panel WWW**.
