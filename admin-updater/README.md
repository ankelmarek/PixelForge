# PixelForge — panel aktualizacji U2 i instalator U1

Panel PHP instaluje pełne ZIP-y PixelForge po logowaniu i osobnym zatwierdzeniu.
Kod panelu, konfiguracja, sesje i kopie są oddzielone od statycznej gry.
Wydanie narzędzia: **1.1.0**; kontrakt walidatora paczek nadal U0/1.0.0.
Wymagania i polecenia CLI U1 znajdują się dalej w tym pliku.

## Co wgrać na hosting

- **Gra:** `pixelforge-0.6.1-full.zip` do dotychczasowego katalogu PixelForge.
- **Panel:** `pixelforge-updater-u2-1.1.0.zip` rozpakuj **poza public_html**,
  np. w `/home/ACCOUNT/pixelforge-tools/`. Zachowaj `admin-updater/`.
- Nie wgrywaj całego narzędzia do katalogu gry. Jedyny publiczny plik panelu
  (`pixelforge-admin/index.php`) tworzy jednorazowe polecenie konfiguracji.

Pierwsza konfiguracja wymaga SSH/terminala hostingu. Kolejne wydania gry
instalujesz już w przeglądarce. Sam ZIP gry nie tworzy panelu.

## Jednorazowe uruchomienie panelu

Wymagane HTTPS oraz PHP 8.2+ z ZipArchive, zlib i sesjami, działające jako
użytkownik mający dostęp do prywatnych plików i prawo zmiany katalogu gry.
Przy domyślnych limitach ustaw także **w webowym PHP**, nie tylko CLI:

```ini
memory_limit = 256M
upload_max_filesize = 64M
post_max_size = 65M
display_errors = Off
```

Limity panelu są minimum ustawień PHP i konfiguracji pakietów. W razie mniejszego
limitu na hostingu panel pokaże faktyczną wartość. Ustaw również odpowiedni
limit żądania i czas wykonania w serwerze WWW/panelu hostingu. Tymczasowe uploady
PHP muszą znajdować się poza katalogami publicznymi; domyślne systemowe /tmp
zwykle spełnia ten warunek. `upload_tmp_dir` można ustawić na dedykowany
prywatny katalog w konfiguracji hostingu.

1. Rozpakuj narzędzie prywatnie. Skopiuj `config.example.json` do prywatnego
   pliku konfiguracyjnego; wpisz rzeczywiste `documentRoot`, `target`
   i `privateRoot`. Target jest bezpośrednim podkatalogiem documentRoot.
   Użyj tej samej konfiguracji co w U1, jeśli już korzystasz z instalatora.
2. Ustaw plikowi tryb 0600. Wykonaj polecenia poniżej z konta obsługującego PHP.
   ACCOUNT oznacza Twoją ścieżkę konta. Hasło wpisuje się niewidocznie;
   nie trafia do argumentów procesu ani historii poleceń.

```bash
PF_TOOLS=/home/ACCOUNT/pixelforge-tools/admin-updater
PF_CONFIG=/home/ACCOUNT/pixelforge-config.json
chmod 600 "$PF_CONFIG"
php -d memory_limit=256M "$PF_TOOLS/cli.php" doctor "$PF_CONFIG"

read -r -s -p 'Nowe hasło administratora (16–72 bajty): ' PF_PASSWORD
printf '\n'
printf '%s' "$PF_PASSWORD" | php -d memory_limit=256M "$PF_TOOLS/panel-setup.php" "$PF_CONFIG" https://rozumisie.pl administrator
unset PF_PASSWORD
```

3. Otwórz adres wypisany przez konfigurator, domyślnie
   `https://rozumisie.pl/pixelforge-admin/index.php`. Zaloguj się własnym hasłem.
   Jeżeli instalacja nie była jeszcze zarejestrowana w U1, wybierz
   **Sprawdź i zarejestruj instalację**.
4. Narzędzie przyjmie pusty katalog albo kompletną grę z manifestem U0.
   Obce pliki i stare assety pozostałe po FTP wymagają wcześniejszego uporządkowania
   przez administratora na podstawie manifestu. Panel ich sam nie usuwa.

Nie ma domyślnego hasła, publicznej strony konfiguracji ani tworzenia kont graczy.
Dostęp dotyczy jednego administratora. Nazwę katalogu panelu można podać jako
ostatni argument konfiguratora, np. `pixel-admin`; katalog musi być nowy.
Konfigurator odmawia nadpisania istniejącego panelu.

Plik `privateRoot/panel/config.json` zawiera hash bcrypt, nazwę administratora,
kanoniczny origin HTTPS i ścieżki. Tryb 0600; katalogi prywatne 0700.
Prywatne pliki nie mogą być udostępniane przez inną domenę ani alias serwera.
Serwer musi wykonywać PHP, a nie podawać jego źródła do pobrania.

## Codzienna aktualizacja

1. Zaloguj się, wybierz/przeciągnij pełny ZIP i naciśnij **Sprawdź pakiet**.
2. Przejrzyj wersje, rozmiary, SHA-256 oraz pliki dodawane, zmieniane i usuwane.
   Gra w tym czasie pozostaje w dotychczasowej wersji.
3. Dopiero **Zainstaluj wydanie** zatwierdza przygotowany plan.
4. Po wyniku wybierz **Sprawdź grę**. Przełączenie zachowuje jej publiczny adres.
5. W razie problemu wybierz **Przywróć poprzednią wersję** i potwierdź powrót.

Podgląd i instalacja ponownie weryfikują pliki. Stary plan po innej aktualizacji,
podmieniony staging, błędna suma i downgrade przez upload są odrzucane.
Oczekujące plany można usunąć; porządkowanie wydań zachowuje wersję aktywną,
poprzednią i wydania potrzebne planom. Upload tymczasowy jest usuwany po
zwykłym błędzie; po zabiciu procesu pozostałość sprząta następny upload
pod osobną blokadą. Staging po przerwaniu jest widoczny do jawnego usunięcia.

U1 nadal używa **dwóch rename z krótkim oknem HTTP 404**. Po przerwaniu procesu
panel pokazuje **Odzyskaj przerwaną operację**. Samo otwarcie strony lub podglądu
nie uruchamia odzyskiwania ani nie zmienia aktywnej gry. CLI `recover` pozostaje
dostępne, gdy panel nie działa. Kontrola zdrowia w PHP sprawdza pliki i hashe;
sprawdzenie rozgrywki wymaga otwarcia gry.

## Sesja i hasło

Cookie ma Secure, HttpOnly, SameSite=Strict i ścieżkę panelu. Sesja wygasa po
30 minutach bezczynności lub maksymalnie 8 godzinach. ID i token CSRF zmieniają
się przy logowaniu. Wszystkie zmiany wymagają POST, tokenu CSRF i zgodnego Origin.
HTTP jest odrzucane; nagłówki X-Forwarded-Proto/For nie są dowodem HTTPS/IP.
Za reverse proxy administrator musi skonfigurować prawidłowy sygnał HTTPS
w PHP na zaufanej granicy serwera; nie dodawaj ogólnego zaufania do nagłówków klienta.

Ograniczenie logowania: 5 prób na IP i 20 globalnie w 15 minut; udane logowanie
czyści licznik danego IP. Liczniki są prywatne, trwałe i blokowane. Osiągnięcie
limitu daje HTTP 429. Wylogowanie niszczy sesję. Reset hasła unieważnia również
sesje otwarte wcześniej:

```bash
read -r -s -p 'Nowe hasło administratora: ' PF_PASSWORD
printf '\n'
printf '%s' "$PF_PASSWORD" | php -d memory_limit=256M "$PF_TOOLS/panel-password.php" /home/ACCOUNT/pixelforge-private/panel/config.json
unset PF_PASSWORD
```

Zamień ścieżkę prywatną na własną. Hasło ma 16–72 bajty, bez końcowego znaku
nowej linii w stdin. Obsługiwane są menedżery haseł. Interfejs działa także
bez JavaScript; przeciąganie pliku i komunikat przesyłania są dodatkiem.

Panel i gra w tym wariancie działają pod jednym originem, dlatego publikowane
HTML/JS musi pochodzić od zaufanego wydawcy. Sama ścieżka cookie nie izoluje
panelu od złośliwego JavaScript na tej samej domenie. SHA-256 wykrywa zmianę
plików, nie potwierdza tożsamości wydawcy. Nie instaluj dowolnych paczek z internetu.
Separacja originów i podpisy nie należą do tego etapu.

Panel nie zmienia ustawień serwera i nie aktualizuje samego siebie przez ZIP gry.
Nowe narzędzie PHP wdraża administrator osobno. Kod PHP, konfiguracja i dane
robocze nigdy nie są częścią statycznego `dist/`.

---

## Instalator CLI U1 — pełny ZIP i rollback

Polecenia CLI pozostają dostępne do diagnostyki, instalacji i odzyskiwania.
Wejście cli.php odmawia dostępu przez HTTP. Aktualizuje wyłącznie statyczne pliki PixelForge.

## Wymagania

- Unix/Linux, 64-bitowe PHP **8.2+**, ZipArchive, zlib, flock, fsync.
- Przy domyślnych limitach paczek: PHP `memory_limit=256M` lub więcej.
- Katalog aplikacji jest bezpośrednim podkatalogiem publicznego document root,
  np. `public_html/PixelForge`.
- Prywatny katalog roboczy leży poza **wszystkimi** katalogami udostępnianymi
  przez WWW i poza aliasami serwera; tryb 0700. Prywatność wymaga poprawnego
  wskazania rzeczywistego document root przez administratora.
- Katalog roboczy i katalog aplikacji znajdują się na jednym lokalnym
  systemie plików. Proces może tworzyć i przemianowywać katalog aplikacji.
  Nie obsługujemy symlinków, hardlinków, NFS ani magazynów obiektowych.

`doctor` sprawdza wymagania dostępne lokalnie, blokadę, zapis, rename, fsync
i miejsce. Nie sprawdza konfiguracji wszystkich domen/aliasów hostingu ani
ustawień konta SSH. Błąd wymagań zatrzymuje instalator przed zmianą aplikacji.

## Pierwsza konfiguracja

Rozpakuj **osobny ZIP aktualizatora** poza public_html, np. do
`/home/ACCOUNT/pixelforge-tools/`. Zachowaj strukturę `admin-updater/`.
Skopiuj `config.example.json` do prywatnego pliku konfiguracyjnego i wpisz
rzeczywiste ścieżki z hostingu. Przykładowe ACCOUNT nie jest nazwą Twojego konta.
Paczka gry nigdy nie aktualizuje kodu instalatora ani jego konfiguracji.

`maxStorageBytes` ogranicza prywatne wydania, staging i logi. `reserveBytes`
to wymagany zapas wolnego miejsca. `limits` nadpisuje limity kontraktu U0.
Konfiguracja pochodzi wyłącznie od administratora, nigdy z ZIP-a.

```bash
PF_UPDATER=/home/ACCOUNT/pixelforge-tools/admin-updater/cli.php
PF_CONFIG=/home/ACCOUNT/pixelforge-config.json
chmod 600 "$PF_CONFIG"
php -d memory_limit=256M "$PF_UPDATER" doctor "$PF_CONFIG"
php -d memory_limit=256M "$PF_UPDATER" init "$PF_CONFIG"
php -d memory_limit=256M "$PF_UPDATER" status "$PF_CONFIG"
```

W dalszych przykładach zakładamy, że PHP ma co najmniej 256M. Jeśli nie,
dodawaj `-d memory_limit=256M` do poleceń albo skonfiguruj niższe limity paczek.

`init` przyjmuje pusty katalog lub kompletną dystrybucję z manifestem U0
(np. działające 0.6.1). Sprawdza wszystkie pliki i zapisuje prywatną kopię
początkową. Nie podmienia strony. Przy starych assetach pozostawionych po
ręcznych aktualizacjach albo przy obcych plikach odmawia przejęcia katalogu.
Zachowaj wtedy jego kopię i uporządkuj instalację na podstawie manifestu
sprawdzonego wydania; instalator sam niczego obcego nie usuwa. Konfiguracja
serwera, logi i pliki innych aplikacji muszą pozostać poza zarządzanym katalogiem.

## Przygotowanie i osobne zatwierdzenie

```bash
php "$PF_UPDATER" prepare "$PF_CONFIG" /home/ACCOUNT/pixelforge-NEW-full.zip
```

Wynik JSON zawiera `id` planu, `packageHash`, wersje `base`/`candidate`
i listy `diff.added`, `diff.changed`, `diff.removed`. Manifest jest zawsze
częścią przełączenia wydania; diff opisuje pliki payloadu. Przygotowanie
nie zmienia aktywnej strony. ZIP i staging są przechowywane prywatnie.

Po sprawdzeniu tego wyniku przepisz **id i hash dokładnie z przygotowanego planu**:

```bash
php "$PF_UPDATER" apply "$PF_CONFIG" PLAN_ID PACKAGE_SHA256
```

Pod blokadą instalator ponownie sprawdza paczkę, staging, aktywną wersję
i zgodność podglądu zmian. Nie przyjmuje starego planu po innej aktualizacji,
podmienionych plików, innej zawartości pod tym samym numerem wersji ani
downgrade przez install. Ponowienie zatwierdzonej, ukończonej operacji jest
bezpieczne i nie nadpisuje poprzedniej kopii.

## Przełączenie, przerwanie i przywracanie

U1 używa wariantu **directory-rename**: cały nowy katalog jest przygotowany
wcześniej; aktywny katalog zostaje przeniesiony do prywatnego katalogu
transakcji, a nowy zajmuje jego miejsce. Nie wymaga symlinków ani zmian .htaccess.

**Między dwoma rename istnieje krótkie okno niedostępności HTTP 404.**
To nie jest atomowa operacja obejmująca oba katalogi. Wykonuj ją w oknie
serwisowym. Jeśli proces zostanie zabity dokładnie w tej przerwie, strona
pozostanie niedostępna do uruchomienia `recover`. Zwykły błąd przed trwałym
zatwierdzeniem wywołuje automatyczny powrót. Dziennik jednoznacznie wskazuje
stare i docelowe wydanie; ostatnia sprawna kopia nie jest usuwana.

```bash
php "$PF_UPDATER" recover "$PF_CONFIG"
php "$PF_UPDATER" status "$PF_CONFIG"
```

Każda operacja poza `doctor` najpierw odzyskuje niedokończoną transakcję.
Przed trwałym zapisem nowego stanu odzyskiwanie przywraca starą wersję.
Po zapisie stanu sprawdza nową i kończy operację; przy uszkodzeniu wraca do kopii.
Ponowienie odzyskiwania jest bezpieczne, również po jego przerwaniu.

Ręczny rollback wymaga dwóch identyfikatorów z `status`:

```bash
php "$PF_UPDATER" rollback "$PF_CONFIG" ACTIVE_ID PREVIOUS_ID
```

Przed powrotem sprawdzana jest integralność poprzedniego wydania. Powtórzenie
tego samego rollbacku nie przełącza wersji z powrotem. Zapisów przeglądarki
instalator nie dotyka; publiczny adres aplikacji pozostaje ten sam.

Kontrola zdrowia obejmuje pełny spis plików, index.html, manifest i SHA-256
zasobów. Nie uruchamia dowolnego kodu z paczki ani nie wykrywa wszystkich
błędów gameplayu. Po aktualizacji sprawdź aplikację w przeglądarce.
Otwarte sesje warto odświeżyć: stare hashowane assety nie pozostają dostępne
pod aktywnym adresem po przełączeniu. Czasy plików odświeżane są także przy
rollbacku, aby serwer nie odpowiadał 304 dla zmienionego HTML-u.

## Sprzątanie i dziennik

```bash
php "$PF_UPDATER" discard "$PF_CONFIG" PLAN_ID
php "$PF_UPDATER" prune "$PF_CONFIG"
```

`discard` usuwa wskazany staging i porzuconą kopię przełączenia. `status`
pokazuje identyfikatory nieukończonych przygotowań i `orphanSwitches`.
`prune` usuwa nieużywane wydania i porzucone katalogi przełączania;
zachowuje aktywne, poprzednie oraz wskazane przez oczekujące plany.
Niekompletny staging trzeba najpierw jawnie odrzucić.

W prywatnym katalogu są `state.json`, ewentualny `transaction.json`,
`releases/`, `staging/`, `switch/`, `logs/` i `update.lock`.
Log każdej transakcji zawiera czas, wersje, hash paczki oraz wynik.
Nie usuwaj ręcznie dziennika transakcji ani pliku blokady podczas pracy.
Używaj jednej konfiguracji i jednego privateRoot dla danego katalogu aplikacji.
Blokada koordynuje ten instalator; równoległe kopiowanie przez FTP lub inne
narzędzie omija ją i nie jest obsługiwane.
SHA-256 sprawdza integralność, nie tożsamość wydawcy paczki.

## Sprawdzenie samego ZIP-a

```bash
php cli.php validate /pełna/ścieżka/pixelforge-0.6.1-full.zip
```

Polecenie jest tylko do odczytu. Akceptuje ten sam ograniczony format full co
U0: bez ZIP64, extra fields, komentarzy, symlinków, kodu serwerowego i delty.
Sukces zwraca JSON i kod 0; odmowa kod 2 i komunikat diagnostyczny.
