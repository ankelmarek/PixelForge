# S2 — rozbudowa ORLAR i najem Skoczki

Data: 2026-11-15. Gałąź `feature/s2-stacja-rozbudowa`, baza `6dafa75`
/ [PR #18](https://github.com/ankelmarek/PixelForge/pull/18), którego pełne
CI #24 przeszło. Zlecenie: „ok, realizujj kolejne etapy”, kolejno S2–S4.
Klient `gas-station` 0.2.0; przygotowywane wydanie PixelForge 0.13.0,
instalator bez zmiany: 1.2.0. Status: **weryfikacja w toku**.

## Zakres

S2 dodaje własne działki, skierowane drogi i budowę pomp, dużego stanowiska
ON, parkingów oraz zbiorników. Podgląd nie kosztuje; zatwierdzenie ponawia
kontrolę własności, pieniędzy, rewizji, zajętości i istniejących tras.
Droga musi zapewniać dojazd i wyjazd ze wszystkich stanowisk. Usunięcie
odcinka odcinającego stanowisko albo ruch jest odrzucane. Pracownik fizycznie
dochodzi na budowę; obiekt działa po jej ukończeniu. Zbiornik zwiększa
pojemność o 1000 L. Zmiana unieważnia lokalne dane nawigacji.

Do czterech pracowników ORLAR, dwie obsadzane oddzielnie kasy, priorytet
obsługi klientów albo dostaw i ceny paliwa/towarów. Nowa cena wpływa na
nowe oferty; przyjęty klient zachowuje cennik swojego paragonu. Płace
uwzględniają moment zatrudnienia i zachowaną resztę dzielenia. Flota zawiera
auta osobowe, dostawczaki i ciężarówki. Kierowcy nadal opuszczają pojazdy,
przechodzą do kasy i wracają, a obsłużenie liczy się po opłaconym wyjeździe.

Sklep można prowadzić samemu albo wynająć Skoczce. Dwie umowy: 120 monet
za pełny okres lub 50 + 8% obrotu. Przejęcie kończy stare koszyki i obejmuje
20 sekund przebudowy. Gdy zamknięcie przekroczy 60 sekund, oferta zostaje
anulowana bez usuwania klientów. Towary właściciela pozostają w magazynie.
Najemca ma osobną kolejkę, dwoje pracowników, zapasy, dostawczaka i księgę
sprzedaży. Jego obrót nie trafia do przychodów ORLAR. Czynsz jest proporcjonalny
do faktycznej aktywności; rozliczenia mają trwałe identyfikatory.

Klient paliwowy może po zapłacie zaparkować i kupić u najemcy z osobnego
paragonu. Umowę można zakończyć na granicy okresu za 100 monet. Po obsłużeniu
przyjętych klientów i dostaw następuje 20 sekund przebudowy, a własny sklep
wraca z zachowanym towarem. Pracownicy najemcy nie stają się załogą właściciela.
Wcześniejsze rozwiązanie wyklucza ponowny najem w tej rozgrywce.

## Scenariusz, ruch i granice

To **12-minutowy wycinek rozbudowy**, nie pełny Wielki Weekend. Okresy
6 + 3 + 3 minuty pozwalają obejrzeć ofertę, proporcjonalny czynsz i wcześniejsze
rozwiązanie przed finałem. Cel: ≥20 opłaconych, zakończonych wizyt i dodatni
zysk operacyjny. Trzy zmiany 8/12/10 minut, myjnia, zdarzenia, ratunek
finansowy i cel ≥60 aut pozostają S3.

Budżet to 14 pojazdów klientów, do 10 kierowców, 4 pracowników ORLAR,
2 Skoczki i 2 dostawy, łącznie najwyżej 32 jednostki. Ograniczone kolejki
powodują odmowę nowych przyjęć; nie generują nieskończonego tłumu.
Drogi mają szerokość 10 pól i kierunki, a graf obejmuje wyłącznie lokalne
rozszerzenia. Maksimum: 24 nowe obiekty, 64 odcinki po 2–64 pola.

Rozszerzenia mają konserwatywną bramkę: jednocześnie jeden klient w ich
sieci; dostawy korzystają z tego samego podjazdu w oddzielnych oknach.
Zapobiega to blokowaniu małego podjazdu przez dwie cysterny albo ciężarówkę
na dowolnym skrzyżowaniu gracza. Nie jest to swobodna symulacja wielu pasów.
Ciężarówka korzysta z wjazdu przy x=100, jeśli własna sieć go obejmuje;
inaczej czeka na wolną kolejkę podstawowego wjazdu. Przejazd do sklepu po
paliwie prowadzi osobnym pasem drogi publicznej. Lokalne obejście pieszego
ma ograniczenie 625 pól, bez wyszukiwania po całej mapie.

## Zapis i architektura

`VersionedSave('gas-station', 2)` zachowuje poprzedni klucz v1. Gdy v2 nie
istnieje, można wznowić sześciominutową zmianę S1 i zapisać ją jako v2 bez
zmiany scenariusza i bez nadpisania v1. Nowa gra uruchamia S2. Uszkodzony
v2 daje komunikat i nowy scenariusz, nie ciche przywrócenie starszej kopii.
Walidacja obejmuje bilans ilości i kosztów, drogi, obiekty, personel,
paragony, towar i obrót najemcy, czynsz oraz stan przejęcia.

Cała specyfika pozostaje w `src/games/gas-station`. Moduły
`development`, `placement`, `tenant-lease`, `development-save` i
`development-controls` rozszerzają klienta; silnik nie zna Skoczki, paliw
ani identyfikatora gry. Brak nowych zależności i usług sieciowych.

## Grafika i obsługa

Trzy nowe autorskie atlasy: dostawczak, ciężarówka i lokal Skoczki.
Grafiki powstają ze skryptu `tools/generate-station.py`, bez pobierania
materiałów zewnętrznych. Skoczka ma śliwkowy dach, szałwiowe akcenty i
własną skaczącą żabkę; ORLAR zachowuje bursztyn, grafit i turkus.
To robocze marki, bez prawnego badania dostępności nazwy.

Pełne okno, ostry pixel art, zoom 0.5–2, minimapa, pauza i tempo ×1/×2/×4.
Projekt zamyka panel boczny, pozostawiając ikonowe potwierdzenie nad mapą.
Budowa drogą przeciągnięcia, obiekt przez wskazanie miejsca i obrót.
Podstawowe sterowanie działa dotykiem; pełna rozbudowa jest testowana myszą.
Nie ma obowiązkowego tutorialu; etykiety kosztów, umów i blokad służą decyzjom.

## Weryfikacja

Wyniki pełnych kontroli, pomiarów i dystrybucji zostaną uzupełnione po ich
zakończeniu. Nie uznajemy częściowego testu za odbiór całego etapu.

Testy S2 obejmują cztery orientacje pompy, fizyczną budowę zbiornika,
dwie równoległe kasy, zmianę cennika, budowę ciężarowego stanowiska,
bezpłatny podgląd i powtórzony commit, zakaz odcięcia drogi, obie umowy,
rozwiązanie, pełne rozliczenia i zgodność wznowienia zatłoczonego układu.
Osobny scenariusz Playwright wykonuje projekt myszą, zapis/reload i najem.
Poprzednia zmiana S1 ma rzeczywisty zapis v1 jako wejście testu zgodności.

Syntetyczny benchmark 32 jednostek używa produkcyjnej nawigacji, rezerwacji,
ruchu, renderera i assetów, przy ×4 i zoomie 0.5 przez 60 sekund. Kamera
zmienia sektory. Nie wykonuje pełnej ekonomii; stan testowy nigdy nie trafia
do zapisu gry. Jest osobnym, kompilowanym wejściem w `work/s2/stress-dist`;
nie znajduje się w ZIP-ie produkcyjnym. Wydajność całej gry jest mierzona
oddzielnie. Wynik headless nie zastępuje fizycznego telefonu.

CI rozdziela wszystkie dotychczasowe testy przeglądarkowe i scenariusze
Stacji na dwa zadania. Kontrole kodu, PHP i rzeczywistych paczek mają trzecie
zadanie. Nie usuwa to testów ani nie zwiększa limitów kampanii.

## Dostarczenie

Po weryfikacji `pixelforge-0.13.0-full.zip` będzie paczką do istniejącego
aktualizatora. `pixelforge-public-html-0.13.0-installer-1.2.0.zip` jest tylko
do pierwszej instalacji. Archiwa 0.12.0 i starsze mają pozostać niezmienione.
Bez automatycznego merge i instalacji na hostingu.

Następny zlecony etap: S3. W4 Winobrania pozostaje poza tym zadaniem.
S4 wymaga później także trzech nowych graczy; automatyzacja nie zastępuje
tego badania ani odsłuchu i pomiarów na fizycznym urządzeniu.
