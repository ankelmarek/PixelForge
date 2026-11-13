# U1 — plan instalacji i przywracania wydania

Status: przygotowanie, bez zaimplementowanego instalatora i bez wdrożenia.
Baza: zaakceptowana przez użytkownika paczka 0.6.1 (`da66565`, PR #7).
Gałąź: `feature/p2-u1-installer`. Wybór adaptera wymaga informacji o hostingu
rozumisie.pl: PHP 8 z ZipArchive, SSH/CLI albo wyłącznie pliki statyczne.
Nie należy utożsamiać działania statycznej paczki z obsługą PHP lub SSH.

## Zakres jednego etapu

U1 instaluje pełną paczkę zgodną z U0 w kontrolowanym katalogu, przechowuje
poprzednią sprawną wersję i umożliwia jej przywrócenie. U2 obejmie panel WWW
i uwierzytelnianie; U3 obejmie delty. Runtime, format zapisu i publiczny adres
gry pozostają niezależne od narzędzia instalacyjnego.

Narzędzie nie może przejmować dowolnego istniejącego katalogu WWW. Pierwsze
podłączenie obecnej instalacji wymaga sprawdzenia manifestu i pełnego spisu
plików oraz jawnej konfiguracji katalogów operatora. Obce pliki i niezgodna
zawartość zatrzymują operację; nie usuwamy konfiguracji serwera ani danych
administratora w ramach porządkowania paczki.

## Operacje i trwały stan

1. **Sprawdzenie środowiska:** prawa, prywatność katalogów, dostępne miejsce,
   możliwość blokady oraz wybrany mechanizm przełączania. Brak wymagań oznacza
   odmowę instalacji przed zmianą aktywnego wydania.
2. **Przygotowanie:** kopia ZIP-a w prywatnym katalogu, walidacja kontraktu U0,
   bezpieczne rozpakowanie do nowego stagingu i ponowna kontrola plików.
   Wynik zawiera wersje, hash paczki i listę dodawanych, zmienianych oraz
   usuwanych plików. Przygotowanie nie podmienia strony.
3. **Zatwierdzenie planu:** pod blokadą ponownie sprawdzamy zgodność aktywnej
   wersji i stagingu z pokazanym planem. Zmieniony ZIP, stan lub pliki wymagają
   nowego przygotowania. Sama zgodność numeru wersji jest niewystarczająca.
4. **Instalacja:** przed podmianą zapisujemy zamiar operacji i punkt powrotu.
   Przełączamy wydanie mechanizmem potwierdzonym dla hostingu. Sprawdzamy
   manifest, sumy, punkt wejścia i zasoby nowej aktywnej wersji.
5. **Zakończenie albo wycofanie:** sukces zapisujemy w prywatnym dzienniku.
   Błąd po przełączeniu przywraca wcześniejszą sprawną wersję. Nie usuwamy
   ostatniego punktu powrotu podczas instalacji lub sprzątania stagingu.
6. **Wznowienie po przerwaniu:** następna operacja pod blokadą rozpoznaje
   niedokończony dziennik, weryfikuje rzeczywisty stan i doprowadza go do
   jednoznacznej aktywnej wersji. Ponowienie nie wykonuje drugiej instalacji
   ani nie nadpisuje jedynej kopii poprzedniego wydania.

Preferowane są wersjonowane katalogi i atomowe przełączenie aktywnego
wskazania. Gdy hosting tego nie umożliwia, fallback musi opisywać okno
maintenance, punkty przerwania i sposób odzyskania dostępności. Nie nazywamy
wieloplikowego kopiowania atomowym. Konkretna struktura katalogów i mechanizm
blokady zostaną wybrane po potwierdzeniu środowiska, bez zgadywania uprawnień
na serwerze użytkownika.

Prywatne dane obejmują ZIP, staging, dziennik, blokadę i metadane kopii.
Limity obejmują także zajętość stagingu i zachowywanych wydań oraz wymagany
zapas miejsca. Żadne pole manifestu paczki nie wskazuje ścieżki instalacji,
komendy, skryptu ani konfiguracji aktualizatora.

## Macierz odbioru implementacji

| Scenariusz                                               | Oczekiwany wynik                                          |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Przygotowanie poprawnej paczki                           | Dokładny podgląd zmian; aktywna strona bez zmian          |
| Pełna instalacja i kontrola zdrowia                      | Aktywna nowa wersja, zachowana poprzednia i dziennik      |
| Ponowienie tej samej paczki                              | Brak dodatkowej podmiany i utraty kopii                   |
| Ten sam numer wersji z innymi bajtami                    | Odrzucenie konfliktu                                      |
| Plan przygotowany dla nieaktualnej instalacji            | Odmowa zatwierdzenia starego planu                        |
| Zmiana stagingu albo paczki po podglądzie                | Odrzucenie przed podmianą                                 |
| Złośliwy/uszkodzony ZIP lub obce pliki w instalacji      | Odrzucenie bez naruszenia aktywnego wydania               |
| Brak miejsca lub uprawnień                               | Czytelny błąd, nienaruszony punkt powrotu                 |
| Dwie równoczesne próby                                   | Jedna blokada, brak mieszania operacji                    |
| Wyjątek oraz zakończenie procesu na każdym trwałym kroku | Odzyskanie jednoznacznego stanu, zachowana sprawna wersja |
| Błąd kontroli zdrowia po przełączeniu                    | Automatyczny powrót i zapis przyczyny                     |
| Ręczny rollback oraz przerwany rollback                  | Spójna starsza wersja, bez utraty obu wydań               |
| Uszkodzony punkt powrotu                                 | Odmowa jego aktywacji, bez nadpisania aktualnej strony    |
| Test HTTP pod `/PixelForge/` po instalacji i rollbacku   | Zgodny HTML i zasoby, zachowane klucze zapisów            |

Testy instalatora wykonujemy w tymczasowych katalogach i na lokalnym serwerze.
Symulacja awarii musi obejmować rzeczywiste zakończenie procesu, nie tylko
wyjątki obsługiwane przez `finally`. Przejście testów lokalnych nie jest
potwierdzeniem możliwości konkretnego hostingu.

Po wyborze adaptera: implementacja, testy z powyższej macierzy, pełne kontrole
repozytorium, instrukcja konfiguracji, raport U1 i osobny PR do `main`, zależny
od PR #7. Publikacja narzędzia na GitHubie nie oznacza instalacji na hostingu.
