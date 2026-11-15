# S3 — Wielki Weekend, myjnia i zdarzenia

15 listopada 2026. Gałąź `feature/s3-stacja-weekend`, baza `767b164` /
[PR #19](https://github.com/ankelmarek/PixelForge/pull/19), pełne CI #28 PASS.
Zlecenie „ok, realizujj kolejne etapy” obejmuje kolejno S2, S3 i S4.
Klient `gas-station` 0.3.0, wydanie PixelForge 0.14.1,
instalator pozostaje 1.2.0. **REVIEW — pełne CI #30 PASS na `39f9a08`.**

## Kampania

Nowa gra trwa 36000 kroków po 50 ms: piątek 8 minut, sobota 12 i niedziela 10.
Tempo ×2/×4 przyspiesza ten sam model; kamera i odświeżanie obrazu nie sterują
losowaniem. Ostatnie 90 sekund służy dokończeniu wizyt. Wynik pojawia się
zawsze na końcu, także gdy ktoś jeszcze korzysta z usługi. Sukces wymaga
60 opłaconych, zakończonych wizyt, średniej oceny ≥70% i majątku netto >0.
Niespełnienie części warunków daje częściowy sukces; trwała niewypłacalność
może zakończyć weekend wcześniej.

Start: 15000 monet, po 600 L E95/ON, dwie pompy, sklep i dwóch pracowników.
Nowe okna ruchu to około 10/8/7.5 sekundy, z deterministyczną zmiennością.
Na odcinkach drogi publicznej poza skrzyżowaniami auta jadą 8 pól/s;
prędkości manewrowe i limity jednostek pozostają ograniczone. Nie ma
dodatkowych aut dodawanych poza wspólnym budżetem.

Sześć typów zdarzeń tworzy rotowane według seeda cykle: deszcz, awaria
pompy, podwyżka hurtowa, autokar, trzy ciężarówki i jednorazowa oferta
dostawcy. Zapowiedź wyprzedza zdarzenie o 20 sekund. Jedno zdarzenie działa
naraz; po awarii pozostaje minimum 45 sekund przerwy. Część okien może
zostać pominięta, gdy poprzednie zdarzenie jeszcze trwa. Awarię można
przeczekać (90 sekund obsługi gwarancyjnej) lub zamówić naprawę za 120 monet:
pracownik musi dojść i przepracować 15 sekund. Częściowo wydane paliwo nie znika.

Autokar jest dużym pojazdem z jednym reprezentantem grupy i większym
koszykiem; korzysta z parkingu i rzeczywistej kasy. Deszcz obniża popyt
na myjnię. Podwyżka +20% dotyczy nowych zamówień, nie opłaconego ładunku.
Oferta −15% obejmuje jedno zaakceptowane zamówienie 400 L; identyfikator
transakcji i stan wydarzenia zapobiegają wielokrotnemu rabatowi.

## Myjnia i finanse

Myjnia kosztuje 2500 monet i odblokowuje się przy 1500 przychodu. Wymaga
własnej działki, skierowanej drogi z wyjazdem i fizycznej budowy. Kolejka
zajmuje rzeczywiste parkingi. Wjazd korzysta z bramki rozszerzeń; oczekujące
auta nie blokują dostaw przez samą rezerwację. Szczotki i piana pokazują
25 sekund usługi. Koszt 8 monet jest pobierany przy rozpoczęciu, zapłata
25 przy ukończeniu. Przyjęty koszyk pozostawia środki na obiecaną myjnię.
Ograniczone przyjęcia i zamknięcie nowych obietnic przed finałem nie usuwają
już istniejących klientów. Zapis zachowuje kolejkę, przejazd i postęp mycia.

Pożyczka 1500 monet jest jednorazowa; nie jest przychodem ani zyskiem.
Zobowiązanie 1650 pomniejsza majątek i jest spłacane raz przy zakończeniu.
Ukończone, wolne rozszerzenia można odsprzedać za 60% kosztu. Operacja
sprawdza zajętość, rezerwacje, awarię i pojemność zbiorników oraz atomowo
aktualizuje referencje klientów. Bazowe obiekty, drogi i parcele pozostają.

Bankructwo wymaga pustej kasy, wykorzystanej rezerwy, braku możliwości
sprzedaży/odzyskania zapasu lub wpływu z usług i ciągłego ostrzeżenia przez
120 sekund. Darmowe otwarcie pompy lub zmiana roli pracownika nadal mogą
ratować działalność. Test bankructwa używa jawnej, syntetycznej zaległości
po wyczerpaniu zapasów; nie jest dowodem balansu ani ukrytym zdarzeniem gry.

Ocena każdej przyjętej wizyty uwzględnia oczekiwanie (30%), spełnione
potrzeby (25%), ceny (20%), ciągłość usług (15%) i komfort (10%). Komfort
uwzględnia wolny parking i przejście piesze; oświetlenie rozwinie S4.
Także rezygnacje i niezakończone wizyty wpływają na średnią. Przejeżdżający
bez zjazdu nie wystawiają oceny. Wynik pokazuje również kolejki, myjnię,
inwestycje, finanse i gwiazdki.

## Zapis i zgodność

Zapis v3 zachowuje klucze v1/v2. Gdy v3 nie istnieje, wznowienie kontynuuje
poprzedni scenariusz S1 albo S2 bez wydłużenia do 30 minut. Uszkodzonego
bieżącego zapisu nie zastępujemy po cichu starszym. Walidator kontroluje
historię zdarzeń, rezerwacje myjni, oceny, pożyczkę, sprzedaż i naprawy,
oprócz wcześniejszych bilansów paliwa, towarów i najmu.

Cały kod gry pozostaje w `src/games/gas-station`. Nie zmieniono silnika,
innych klientów, ich formatów zapisu ani kodu aktualizatora. Autokar i myjnia
są nowymi oryginalnymi grafikami generatora, z opisem pochodzenia w LICENSE.
Interfejs działa w pełnym oknie, ma piąty panel weekendu, prognozę zdarzenia,
obsługę dotyku i cele co najmniej 44 px. Nie dodano obowiązkowego tutorialu.

## Weryfikacja i dostarczenie

17 nowych testów S3 PASS: dziewięć pełnych kampanii (trzy strategie:
własny sklep, druga kasa i najem; seedy 731, 9021, 20261114), budowa i mycie,
spłata, częściowy wynik, niewypłacalność, naprawa, rabaty i zapis.
Każda z dziewięciu strategii osiąga sukces, z dodatnim zyskiem i majątkiem.
Panel weekendu przeszedł Playwright na desktopie i emulowanym telefonie.
Pełny weekend przeszedł także przez UI: trzy zmiany, naprawa, zapowiedzi
i sukces, bez ustawiania zasobów poza grą. Osobny E2E przeszedł od zakupu
myjni do zapłaty, z odświeżeniem strony w połowie mycia. Typecheck, lint i pełna regresja nowego archiwum przeszły w CI #30.

S4 pozostaje zlecone. Trzy osoby nieznające projektu, pomiar czasu przy ×1,
odsłuch oraz fizyczny telefon są osobnym odbiorem; automatyczne przejścia
nie upoważniają do oznaczenia całej gry jako ukończonej. Bez merge i hostingu.

Lokalny zestaw: lint, typecheck, 168 Vitest, 15 testów pakietów,
36 PHP/Python i produkcyjny build PASS. Przejście UI osiągnęło
**78 klientów, 86% oceny i 1380 monet zysku** przy 30:00.
[Ekran wyniku](reports/S3-result.png), [panel](reports/S3-desktop.png).

Archiwa 0.14.0 są zbudowane i przechodzą walidację manifestu. Istniejący
panel przyjmuje `pixelforge-0.14.0-full.zip`. Paczka `public-html` zawiera
również niezmieniony instalator 1.2.0 i służy tylko pierwszej instalacji.
[Sumy, rozmiary i kontrola 29 poprzednich archiwów](reports/S3-release.json).
Testy dystrybucji obejmują rzeczywiste bajty ZIP-a, rollback, ponowną
instalację i zachowanie zapisów; końcowe wyniki zostaną dodane do PR.

## Poprawka 0.14.1 po CI #29

CI #29 potwierdziło wszystkie kontrole kodu, paczek i instalatora oraz E2E
pozostałych gier. Pełny weekend ujawnił wzajemną blokadę cysterny opuszczającej
zaplecze i auta przy trzeciej pompie (44 zakończone wizyty zamiast ≥60).
Nie obniżono celu testu. Wyjazd dostaw prowadzi teraz wschodem przez zaplecze,
przed skrętem na drogę wyjazdową. Przy wznowieniu istniejąca cysterna na
starym zakręcie najpierw cofa wzdłuż własnego pasa; nie przenosimy pojazdów
ani nie zmieniamy księgowości. Dotyczy kampanii S3 i późniejszych;
stare scenariusze S1/S2 zachowują swoją trasę.

Rzeczywisty zapis z CI jest fixture testu regresyjnego: oba pojazdy
opuszczają skrzyżowanie przy rzeczywistej kontroli zajętości i niezmienionej
historii finansów. Regresja wraz z kampaniami i transakcjami: 18/18 PASS.
Wersja 0.14.0 pozostaje niezmienionym archiwum; do instalacji przeznaczona
jest 0.14.1. Pełna regresja nowego wydania jest ponowiona.

Lokalna dystrybucja 0.14.0: 12 testów Apache/PHP oraz 25 scenariuszy
przeglądarkowych PASS (8 aktualizatora, 2 panelu, 10 statycznej paczki,
2 rzeczywistej aktualizacji i rollbacku, 3 pierwszej instalacji).

0.14.1: lint, typecheck, 169 Vitest, 15 testów pakietów, 36 PHP/Python
oraz produkcyjny build PASS. Manifesty obu nowych ZIP-ów poprawne;
31 wcześniejszych archiwów zachowuje bajty. Pełna macierz CI zostaje
uruchomiona na poprawionym wydaniu. Aktualne sumy w S3-release.json.

## Odbiór techniczny S3 — CI #30 PASS

[CI #30](https://github.com/ankelmarek/PixelForge/actions/runs/43712354210)
na `39f9a08a0d8497a0d3678c2af27dfa5e99a676e8` zakończyło wszystkie trzy
zadania sukcesem: `verify`, `e2e (station)` i `e2e (core)`.
Stacja: 10 scenariuszy PASS, 4 jawnie pominięte długie przebiegi mobilne,
14.8 min łącznie; pełny weekend po poprawce wyjazdu osiąga wymagany sukces.
Pakiety 0.14.1 zostały odtworzone identycznie w CI, z rzeczywistą instalacją,
rollbackiem, ponowną instalacją i zachowaniem zapisów. Wcześniejsze akapity
o trwającej weryfikacji opisują historię przed tym wynikiem.

PR #20 jest gotowy do przeglądu. Implementacja S3 i dystrybucja są sprawdzone;
odrębny odbiór całej gry przez trzech nowych graczy należy do S4/Q1.
