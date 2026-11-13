# PixelForge U1 — instalacja pełnego ZIP-a i rollback

Narzędzie PHP dla administratora, uruchamiane przez SSH/terminal. Biblioteka
jest gotowa do podłączenia panelu WWW w U2. U1 nie udostępnia uploadu ani
publicznego endpointu HTTP. Aktualizuje wyłącznie statyczne pliki PixelForge.

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
