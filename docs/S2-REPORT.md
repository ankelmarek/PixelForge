# S2 — rozbudowa ORLAR i najem Skoczki

Data: 2026-11-15. Gałąź `feature/s2-stacja-rozbudowa`, baza `6dafa75`
/ [PR #18](https://github.com/ankelmarek/PixelForge/pull/18), którego pełne
CI #24 przeszło. Zlecenie: „ok, realizujj kolejne etapy”, kolejno S2–S4.
Klient `gas-station` 0.2.0; przygotowywane wydanie PixelForge 0.13.0,
instalator bez zmiany: 1.2.0. Status: **REVIEW — implementacja i pełne CI #28 PASS, PR gotowy do przeglądu**.

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

Lokalnie przeszły lint, typecheck, build, pełne 148 testów Vitest,
15 testów pakietów i 36 PHP/Python. Następnie regresja numerów parkingów
zwiększyła zestaw Stacji do 28 testów; wszystkie przeszły. Bieżący zestaw
zawiera 150 różnych testów logiki po dodaniu odtworzenia zapisu z CI. Sześć E2E Stacji PASS, dwa pominięcia
pełnych kampanii na mobile: dotyk ma osobny scenariusz. Pełna regresja
pozostałych klientów jest w toku; wyniki CI zostaną dopisane.

[CI #25](https://github.com/ankelmarek/PixelForge/actions/runs/43696884646)
zaliczyło zadanie `verify`: lint, typy, 149 Vitest, 15 testów pakietów,
36 PHP/Python, 12 Apache/PHP oraz wszystkie 25 przypadków dystrybucji.
Odtworzyło identyczne archiwa. Scenariusz S2 nie przeszedł, bo po kliknięciu
umowy nie uwzględniał jej wygaśnięcia podczas zamykania starych koszyków.
Zapis z CI potwierdził brak aktywnego najmu, nie błąd naliczania dostawy.
Test reaguje teraz na ponownie dostępną ofertę i nadal wymaga aktywnego
najmu, fizycznej dostawy, sprzedaży oraz przychodu właściciela. Nowy test
modelu odtwarza dokładnie checkpoint CI. Nie zmieniono zasad gry,
limitu czasu ani kryteriów sukcesu. Ślad zachowuje DOM, zdarzenia i zapis,
bez zapisywania każdej renderowanej klatki długiej kampanii.
Odtworzenie obu zapisów i ponowny pełny E2E S2 przeszły lokalnie.
Zadanie `e2e (core)` CI #25 również zakończyło się sukcesem: **47 PASS,
7 uzasadnionych pominięć**. Z lokalnym zestawem Stacji daje to 53 PASS
oraz 9 pominięć według platformy; następne CI powtórzy cały zestaw
z poprawionym scenariuszem najmu.

Lokalnie także 12 testów Apache/PHP i 25 przypadków dystrybucji PASS:
8 aktualizatora, 2 panelu, 10 rzeczywistych gier z ZIP-a, 2 aktualizacji
pełnego wydania i 3 instalacji public_html. HTTPS pozostaje włączony.
Instalacja 0.6.1 → 0.13.0, rollback i ponowna instalacja zachowują zapisy
Atlasu, Dżdżownicy, Winobrania i Stacji; osobne próby obejmują `/` oraz
`/PixelForge/`, emulację telefonu, HTTP 403 prywatnego katalogu i setup bez JS.
[Wyniki dystrybucji](reports/S2-distribution.json).

[Dodatkowy balans](reports/S2-balance.json): seedy 731 i 9021, własny sklep,
obie umowy i wariant ciężarowy. Wszystkie próby kończą się sukcesem, przy
20–23 jednostkach w bardziej zatłoczonych przypadkach. Polityka zamawia
400 L przy zapasie poniżej 160 L, towary poniżej 18 sztuk, buduje trzecią
pompę po 5 s i zatrudnia trzecią osobę po 10 s. Na seedzie 9021 pojedyncza
oferta najmu wygasa z powodu starych koszyków; ponawianie dostępnej oferty
co sekundę daje rzeczywiste przejęcie od ticka 9076, dostawy, sprzedaż
i dwa rozliczenia. Ta próba osiąga 29 obsłużonych, zysk 857.53 / 758.01 monet
dla umowy stałej / partnerskiej. W obu wariantach obrót najemcy to 50 monet.

Testy S2 obejmują cztery orientacje pompy, fizyczną budowę zbiornika,
dwie równoległe kasy, zmianę cennika, budowę ciężarowego stanowiska,
bezpłatny podgląd i powtórzony commit, zakaz odcięcia drogi, obie umowy,
rozwiązanie, pełne rozliczenia i zgodność wznowienia zatłoczonego układu.
Osobny scenariusz Playwright wykonuje projekt myszą, zapis/reload i najem.
Test parkingów sprawdza też odwróconą kolejność ukończenia dwóch budów: numer
oddanego miejsca pozostaje stabilny, a budowa nie przyjmuje pojazdów.
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

`pixelforge-0.13.0-full.zip` jest sprawdzoną lokalnie paczką do istniejącego
aktualizatora. `pixelforge-public-html-0.13.0-installer-1.2.0.zip` jest tylko
do pierwszej instalacji. Archiwa 0.12.0 i starsze mają pozostać niezmienione.
Bez automatycznego merge i instalacji na hostingu.

Paczki są zbudowane: full **13 266 008 B**, SHA-256
`c73ca8fe817436b4520fe8a49f4dc103fc440916fe4c83994fdbfc71853eeecd`;
public_html **13 361 439 B**, SHA-256
`e8bbbca6c40b50d3e6b22cbba79a2706b75bb7ab088b8de0cc5af7f89b01deaa`.
[Metryki i sumy poprzednich archiwów](reports/S2-release.json).
Pobranie obu paczek z GitHuba potwierdziło te same SHA-256. Poprzednie
0.12.0 oraz instalator 1.2.0 zachowały rozmiary i sumy. Generator odtworzył
wszystkie assety Stacji identycznie bajt w bajt. Runtime klienta zajmuje
około 26 kB gzip, bez kodu współdzielonego silnika.

[Budowa myszą](reports/S2-development.png),
[emulowany telefon](reports/S2-mobile.png),
[ekran 320 px](reports/S2-mobile-narrow.png).
[Zasoby](reports/S2-assets.json): PNG 61 738 B, 4 898 816 B RGBA,
sektory JSON 11 476 B po gzip.

[Próba 32 jednostek](reports/S2-stress-performance.json): 60 s, ×4,
zoom 0.5, pięć pozycji kamery, około **56.9 FPS**, p95 **16.8 ms**,
48 sektorów, maksimum lokalnego wyszukiwania 189 pól, brak błędów.
[Wcześniejszy pomiar](reports/S2-stress-before-isolation.json) miał p95
33.3 ms i nie zaliczył progu 33 ms. Powtórzenie wykonano bez równoległych
testów; nie usuwamy pierwszego wyniku ani nie zmieniamy progu.
[Zwykły scenariusz na buildzie](reports/S2-performance.json): 56.4 FPS,
p95 33.3 ms, do 15 jednostek, zapis 12 320 B i maks. trzy głosy audio.
Jego p95 jest nieco powyżej celu; stabilność wydajności pozostaje przedmiotem
pomiarów i dopracowania S4. To wyniki programowego renderowania Chromium
na opisanym w JSON procesorze, nie deklaracja wydajności fizycznego telefonu.

Następny zlecony etap: S3. W4 Winobrania pozostaje poza tym zadaniem.
S4 wymaga później także trzech nowych graczy; automatyzacja nie zastępuje
tego badania ani odsłuchu i pomiarów na fizycznym urządzeniu.

## Poprawka 0.13.1 — mijanie się pieszych

CI #26 wykryło zakleszczenie dwóch pracowników: obaj wybierali ten sam
boczny objazd i wracali naprzeciwko siebie. Zapis z CI jest zachowany jako
`station-s2-ci-livelock.json`. Piesi S2 mają teraz stałe pierwszeństwo według
ID oraz wybór dalszego punktu ponownego wejścia na trasę. Budżet poszukiwania
pozostaje 625 pozycji. Ruch S1 zachowuje poprzednią regułę.

Regresja przypadku, wszystkie 30 testów modelu Stacji oraz pełny scenariusz
S2 w przeglądarce przeszły lokalnie. Nowy przebieg CI zweryfikuje cały zestaw.
Paczki 0.13.0 pozostają niezmienione; poprawka otrzymuje osobną wersję 0.13.1.
Pomiary wydajności powyżej pochodzą z 0.13.0; nie są nowym pomiarem poprawki.

## Końcowa regresja 0.13.1

[CI #28](https://github.com/ankelmarek/PixelForge/actions/runs/43700846192)
na `767b164f79d6b82e4e470a4a1110b0e1cd2e599c` zakończyło wszystkie zadania
(`verify`, `e2e core`, `e2e station`) sukcesem. PR #19 jest gotowy do przeglądu.
W CI #27 poprawiono wyłącznie numer syntetycznej aktualizacji hostingu,
która musi być nowsza od testowanego wydania. Nie zmieniono paczek 0.13.1.
S3 bazuje na tym zweryfikowanym stanie; wcześniejsze wpisy powyżej zachowują
historię wykrycia i naprawy błędów.
