# STACJA NA TRASIE — strategia ekonomiczna RTS (PixelForge)

**Status: szczegółowa koncepcja do realizacji, bez rozpoczęcia programowania.**  
**Data:** 14 listopada 2026.  
**Tytuł roboczy:** „Stacja na Trasie: Wielki Weekend”.  
**Repozytorium:** `ankelmarek/PixelForge`.  
**Architektura:** nowa gra na wspólnym silniku PixelForge, bez osobnego renderera ani instalatora.

## 1. Wizja i unikalna tożsamość

Stwórz przyjemną w obsłudze, ale angażującą **mikrostrategię ekonomiczną RTS**, oglądaną z góry w perspektywie 3/4. Gracz rozwija małą stację paliw przy drodze, kieruje pracownikami, kupuje paliwo i wyposażenie, buduje kolejne stanowiska, zarządza sklepem i myjnią, a w finale musi obsłużyć wyjazdowy szczyt. Wszystkie procesy mają być **fizycznie przedstawione na mapie**, a nie reprezentowane wyłącznie przez tabelki.

**Najważniejsze różnice względem prostego Winobrania:** żywy ruch drogowy, różne zachowania klientów, zatykające się kolejki, wiele sposobów zarabiania, szybkie decyzje o zatrudnieniu, cenach i magazynie, zdarzenia zmieniające priorytety, wyraźne konsekwencje złego planowania oraz satysfakcjonująca rozbudowa obiektu.

Cała kampania ma trwać **docelowo 25–35 minut** rzeczywistej rozgrywki, nie nieskończony sandbox. Po zakończeniu kampanii gracz otrzymuje jasny wynik i może rozpocząć nową z innym rozkładem zdarzeń. Nie wolno tworzyć gry opartej na ręcznym klikaniu każdego nalewanego litra paliwa.

## 2. Wspólny PixelForge i zasady UX

- Phaser/TypeScript/Vite wyłącznie poprzez istniejącą architekturę PixelForge. Wspólne: EngineHost, sceny, świat sektorowy, kamera, nawigacja regionalna, renderer, czas fixed-step, audio, trwałe zapisy, katalog, pakiety full ZIP.
- Nowy klient np. `src/games/gas-station/` ze stabilnym `gameId`. Wszystkie nazwy paliw, cenniki, klienci, dystrybutory, sklepy, receptury i wydarzenia należą do gry, nie do `src/engine`.
- **100% akcji koniecznych do ukończenia gry obsługiwane myszką**: klik, zaznaczenie, przeciąganie, kółko, przyciski ekranowe. Klawisze Esc/Spacja mogą być skrótami, ale nie są wymagane.
- Bez obowiązkowych pisanych samouczków i komunikatów „kliknij tutaj”. Dopuszczalne są krótkie nazwy paliw, ceny, kwoty, liczniki, nazwy usprawnień, stan magazynu oraz czytelne piktogramy. Jeżeli pomoc kontekstowa jest potrzebna, ma być opcjonalna, zwijana i niezależna od samego gameplayu; nie przesłaniać nią świata.
- Widok wypełnia okno przeglądarki, menu nakładkowe zajmuje mało miejsca; jasna selekcja i podgląd poleceń, statusy wydarzeń widoczne bez wchodzenia w złożone formularze.
- Stacja działa w czasie rzeczywistym, z pauzą i tempem `×1`, `×2`, `×4`. Wznowienie nie nadrabia czasu zamkniętej karty.

## 3. Sceneria, teren i rozmiar

**Mapa początkowa:** rozległy świat sektorowy **4096 × 4096 px**, docelowo wariant 8192 × 8192, ale bez mnożenia pustych kafli dla samej wielkości. Przy stacji droga krajowa, pola, las, punkt widokowy, mała boczna droga i teren pod rozwój. Zróżnicowanie otoczenia ma być realne w widoku, a nie dekoracją jednego małego placu.

- Początkowa stacja ma użyteczny obszar ok. 800 × 700 px, z miejscem na rozbudowę do co najmniej 1700 × 1200 px. Są to wartości projektowe do sprawdzenia względem skali sprite'ów, nie twarde limity rdzenia.
- Gracz kupuje sąsiadujące działki. Rozbudowuje stanowiska, parking, sklep, myjnię, zaplecze i drogi wewnętrzne samodzielnie.
- Wjazd i wyjazd mają niezależne punkty przyłączenia do drogi publicznej. **Nie da się zablokować jedynego wyjazdu budynkiem lub pompą.** System pokazuje poprawność dojazdu.
- Mapa jest podzielona na sektory/tekstury ładowane tylko w pobliżu kamery. Samochody poza ekranem nadal działają logicznie. Trasy ruchu i zajętość obsługiwane niezależnie od renderowania.
- Mysz: przeciągnięcie pustego terenu przesuwa kamerę, kółko zmienia przybliżenie pod kursorem, minimapa pozwala skoczyć do punktu, klik ikony samochodu skupia kamerę na zdarzeniu.
- Środowisko widoczne: jadące samochody na drodze, autobusy, ciężarówki, drzewa, latarnie, wiaty, znaki, światła pojazdów, deszcz, zmiana pory dnia, ruch ludzi między budynkami.

## 4. Główna pętla strategiczna

**Ruch klientów → wybór usługi → kolejka → obsługa → płatność / zakup → zużycie paliwa i towaru → zarobek → uzupełnienie dostaw → wynajem personelu / rozbudowa → kolejna fala ruchu.**

Klient, którego obsługa trwa, ma być **widoczny na mapie**. Auto naprawdę podjeżdża do wolnego dystrybutora, kierowca wysiada albo przechodzi do sklepu, tankowanie ma animację, a po zakończeniu auto wyjeżdża.

Gracz nie musi klikać każdego klienta. Automatyzacja bazowa robi oczywiste rzeczy; kliknięcia służą **decyzjom**, np. ceny, priorytety, obsada, zakupy, trasy i rozbudowa. Gdy potrzeba natychmiastowej reakcji, ikonka alertu prowadzi do zagrożonego obiektu.

### Dylematy strategiczne

1. Obniżyć marżę paliwa, aby przyciągnąć więcej kierowców, czy utrzymać mniejszy ruch i wyższą marżę?
2. Dokupić dystrybutor, zatrudnić obsługę, czy otworzyć drugą kasę?
3. Zamówić większą dostawę paliwa przed szczytem, czy oszczędzić gotówkę na myjnię?
4. Rozbudować sklep z kawą i jedzeniem, czy zwiększyć parking dla ciężarówek?
5. Obsłużyć dużego klienta flotowego, zajmując stanowisko na dłużej, czy przeznaczyć je dla wielu aut osobowych?

## 5. Startowe gospodarstwo i moduły rozbudowy

**Stan startowy do balansu**: jedna wyspa z dwiema stronami tankowania (2 miejsca obsługi), mały sklep z jedną kasą, zaplecze, wjazd/wyjazd, 2 pracowników, umiarkowana ilość E95 i ON, ograniczona gotówka, brak myjni. Samochody korzystają z automatycznego modelu obsługi; pracownicy poprawiają przepustowość.

### Budynki i elementy możliwe do zakupu

| Obiekt | Efekt w rozgrywce | Warunki |
|---|---|---|
| Dodatkowy dystrybutor | zwiększa liczbę równoległych tankowań | dojazd, miejsce manewrowe, dostępny magazyn paliwa |
| Zbiornik paliwa | podnosi pojemność dla danego rodzaju paliwa | teren własny, miejsce dostawy |
| Kasa / stanowisko sklepu | skraca kolejkę zakupową | powierzchnia sklepu i dostępny pracownik |
| Regały, chłodnia, ekspres | odblokowują napoje, przekąski i kawę | kupione towary, pojemność |
| Myjnia | dodatkowy przychód i osobna kolejka | wjazd/wyjazd, przyłącza, obsada lub automat |
| Parking | pozwala zatrzymać większy ruch i klientów sklepu | dostęp do dróg |
| Duży dystrybutor ON | obsługa ciężarówek, większy ładunek na klienta | większy promień manewrowy |
| Billboard przy drodze | zwiększa szansę na zjazd klientów | rozsądne limity ruchu, nie generuje aut w nieskończoność |
| Ulepszenie urządzeń | przyspiesza tankowanie, kasę lub mycie | koszt, krótkie wyłączenie przy montażu |

Nie wszystkie funkcje muszą być gotowe w pierwszym prototypie. Pierwszy vertical slice obejmuje **paliwa, sklep, dwie kolejki, dostawę i jedną sensowną rozbudowę**. Myjnia i ciężarówki mogą wejść w kolejnych etapach.

### Swobodne budowanie

Przeciąganie tworzy drogę i parking. Wybrany budynek ma podgląd `ghost`, zielony/czerwony obrys, obrót ikoną i warunek połączenia z siecią. Ktoś musi móc dojechać do dystrybutora i wyjechać z niego bez teleportowania auta.

Budowanie lub usunięcie drogi aktualizuje lokalnie nawigację. Jeśli nowy układ może uniemożliwić wyjazd obecnemu klientowi, blokuj operację albo pokaż plan ewakuacji i odłóż zmianę do zakończenia obsługi. Zakaz wielosekundowego blokowania całej gry podczas przebudowy indeksu tras.

## 6. Samochody, klienci i ruch drogowy

### Typy klientów

| Typ | Najczęstsze potrzeby | Zachowanie |
|---|---|---|
| Dojeżdżający do pracy | E95, szybka obsługa | krótka cierpliwość, unika kolejek |
| Rodzina / turyści | paliwo, przekąski, toaleta, myjnia | dłuższy pobyt, wyższy koszyk |
| Kierowca dostawczy | ON, kawa, przekąska | średnia cierpliwość, wraca częściej |
| Ciężarówka | duży tank ON, odpoczynek | potrzebuje szerokiego przejazdu i miejsca |
| Autobus wycieczkowy | zbiorowy zakup w sklepie i paliwo | duża, czasowa fala ruchu |
| Klient ekspresowy | kawa lub zakupy bez tankowania | zajmuje parking, nie dystrybutor |

Cechy generowane deterministycznie z seeda: typ, paliwo, litry, zainteresowanie usługami, budżet, maksymalny czas oczekiwania, reakcja na cenę i jakość obsługi. Nie rób pełnej symulacji psychologicznej, wystarczą proste, przewidywalne reguły.

### Przepływ klienta i logika tras

1. Pojazd pojawia się daleko na drodze, ma widoczny zamiar zjazdu.
2. Sprawdza ceny, dostępność paliwa, długość kolejki, zdolność wjazdu i własne potrzeby.
3. Wjeżdża na stację, rezerwuje wolne miejsce albo zajmuje legalne miejsce kolejki.
4. Korzysta z dystrybutora, sklepu, parkingu lub myjni w sensownej sekwencji.
5. Dokonuje płatności i wyjeżdża, zwalniając wszystkie rezerwacje.
6. Dopiero po wyjeździe poza widoczne granice lub w odpowiedniej strefie drogi jest usuwany z renderingu. Wynik ekonomiczny zachowujemy.

**Konieczne mechaniki:** wielkość pojazdu (osobowy / dostawczy / ciężarowy / autobus), rezerwacja stanowisk, zajętość dróg, kolejka FIFO z wyjątkiem wyznaczonych priorytetów, wyprzedzanie/zawracanie tylko gdy trasa na to pozwala, bezkolizyjny skręt, brak przenikania przez ściany i inne auta. W testach sprawdź zator, brak paliwa, zamkniętą pompę, zablokowany wyjazd, anulowanie zamówienia oraz zmianę ścieżek po budowie.

Nie wymagaj od każdego klienta tej samej ścieżki zakupowej. Płacenie przy kasie może być standardowym etapem obsługi, ale nie może stwarzać nieusuwalnego korka. Dopuszczalne jest szybkie rozliczenie przy dystrybutorze jako późniejsza automatyzacja.

## 7. Paliwa i dostawy

W MVP **dwa rodzaje paliwa**: E95 i ON (olej napędowy). LPG opcjonalne po stworzeniu działającej ekonomii i powierzchni stacji.

Paliwa mają magazyn w litrach, pojemność, cenę zakupu, cenę sprzedaży, marżę, czas dostawy i minimalny bezpieczny stan operacyjny. Nie stosować prawdziwych aktualnych cenników jako grywalności, ceny są umowne, realistycznie zróżnicowane i zbalansowane.

- Zmiana ceny paliwa wpływa na popyt, ale nie natychmiastowo i nie w magiczny sposób. Część ruchu drogowego jedzie dalej, jeśli stacja nieatrakcyjna lub nie obsłuży kolejki.
- Dostawę zamawiamy z panelu. Po określonym czasie przyjeżdża **cysterna** z własną trasą i miejscem rozładunku. Dostawa blokuje wskazany fragment stacji i po zakończeniu podnosi stany magazynu.
- Nie pozwól kupować więcej paliwa niż pojemność, minus planowany stan w chwili dostawy. Brak środków i pełny magazyn powinny być czytelnie sygnalizowane.
- Nie dopuszczaj ujemnego stanu litrów ani dwukrotnego przypisania jednej cysterny. Zapis w trakcie dostawy ma odtwarzać jej prawidłową fazę.
- Zdarzenie awarii dystrybutora oznacza widoczną blokadę i koszt naprawy; nie wymaga instrukcji rzeczywistego postępowania z substancjami łatwopalnymi.

## 8. Sklep, myjnia i usługi dodatkowe

**Sklep:** trzy proste grupy produktów: napoje, przekąski, kawa. Można kupować zapas, zwiększać pojemność, zmieniać marże i dołożyć drugą kasę. Koszyk klientów zależy od pory dnia i typu kierowcy. Pracownik przy kasie decyduje o tempie obsługi. Towary faktycznie ubywają.

**Myjnia:** kupowana po pierwszym większym przychodzie. Kolejka maksymalnie kilku aut; pojazdy muszą fizycznie wjechać, zostać umyte i wyjechać. Animacje piany, szczotek i mokrego asfaltu. Deszcz obniża popyt, słoneczny szczyt zwiększa. Myjnia zwiększa przychód, ale ma koszty wody i obsługi.

**Toaleta i parking:** na początku proste czynniki komfortu i zdolności obsługi większej liczby turystów, bez własnej mikrogierki sprzątania w MVP.

Nie wprowadzaj trzech równoległych, monotonicznych minigier wymagających spamowania przyciskami. Zarządzanie ma być realnie strategiczne.

## 9. Pracownicy i automatyzacja

Start: 2 pracowników, np. jeden do obsługi stacji, drugi do sklepu. Dokupienie kasy, dystrybutora lub myjni stwarza racjonalną potrzebę kolejnych osób. Gracz może:
- przydzielić pracownika do dystrybutorów, kasy, magazynu albo myjni,
- zatrudnić dodatkowe osoby na zmianę, czasowo lub na całą kampanię,
- przestawić priorytet zadań (szybka kasa, obsługa ciężarówek, dostawy),
- kupić automatyzację (płatność przy dystrybutorze, bezobsługowa myjnia) kosztem inwestycji.

Stany: dostępny → idzie → obsługuje → przenosi towar → przerwa/zmiana. Nie wymagaj ręcznego kierowania do każdego pojazdu.

## 10. Ekonomia i reguły balansu

Prowadź **jeden jawny księgowy ledger** operacji: gotówka, koszt zakupu paliwa, koszt dostawy, płace, utrzymanie, koszt towarów, energia/woda, inwestycje, przychód z litrów i sprzedaży, zysk operacyjny. Stan kasy nie jest tym samym co wynik finansowy.

Wszystkie wartości pieniężne w najmniejszych jednostkach liczbowych całkowitych, litry paliwa jako liczby całkowite lub fixed-point. Zakaz pływających błędów sumowania, ujemnych stanów paliwa i zdublowanych transakcji po odświeżeniu.

**Konkurencyjne strategie:**
1. **Szybka obsługa:** niskie ceny, dużo pomp, krótka kolejka, duży obrót.
2. **Sklep premium:** nieco wyższe ceny, mocny sklep z kawą i przekąskami, spokojniejszy ruch.
3. **Transport ciężki:** większy dystrybutor ON, parking, wysokie pojedyncze transakcje.

Warianty muszą być porównywalnie grywalne, a nie tylko dekoracyjnymi „perk-ami”. Balans sprawdzić kilkoma seedami i automatycznymi strategiami.

**Przykładowe wartości startowe** dla pierwszego balansu, do zmiany po playtestach: 15 000 jednostek waluty, dwa dystrybutory, po 1 000 litrów każdego paliwa, 2 pracowników, magazyn towarów na 30–50 zakupów. Nie deklaruj tych liczb jako rzeczywistych kosztów polskiej stacji.

## 11. Kampania i zakończenie

**Kampania: „Wielki Weekend”**. Trzy skompresowane zmiany bez ręcznego przechodzenia tur, sumarycznie **30 minut przy ×1**:

| Część | Orientacyjny czas realny | Dominujący problem |
|---|---:|---|
| **Piątek. Otwarcie** | 8 min | zarobienie pierwszych pieniędzy, sklep, pierwsza dostawa |
| **Sobota. Rozbudowa** | 12 min | większy ruch turystów, rozbudowa pomp, zatrudnienie i myjnia |
| **Niedziela. Wielki Powrót** | 10 min | duża fala klientów i aut dostawczych, oddech finansowy oraz finał |

Na granicy zmiany krótka animacja zmiany światła, godziny i fala dojazdów; nie wymuszaj przejścia do osobnego poziomu. Zmiana pory to płynna kontynuacja mapy i stanu.

Po ostatniej fali gra **zawsze kończy się**, niezależnie od oceny, chyba że gracz dobrowolnie wybrał tryb sandbox (po MVP).

**Wstępne warunki sukcesu (parametry do balansu):**
- Obsłuż minimum 60 samochodów i zdobądź średnią satysfakcję ≥70%.
- Zakończ z dodatnią wartością netto przedsiębiorstwa; gra nie może wymagać wyłącznie maksymalizacji gotówki, gdy gracz inwestował w trwałe budynki.
- Za osiągnięcie dodatkowych celów (sklep, myjnia, brak długich kolejek) otrzymaj lepszą ocenę. **Nie jest wymagana jedna jedyna ścieżka zakupów.**
- **Częściowy sukces:** przetrwanie weekendu i działalność stacji, ale brak części celów.
- **Porażka przed finałem:** wyłącznie trwała niewypłacalność bez realnej możliwości odzyskania płynności, po czytelnym ostrzeżeniu, a nie jeden źle wyliczony zakup.

Ekran wyników: samochody obsłużone i utracone, litry sprzedane, przychód, koszt, zysk, satysfakcja, czas kolejek, inwestycje, ocena gwiazdkowa lub puchary. Możliwość natychmiastowego ponownego rozpoczęcia inną strategią.

### Warianty rozgrywki po MVP

- **Krajówka:** zrównoważony ruch, najlepszy wariant podstawowy.
- **Autostradowy weekend:** więcej ciężarówek i autokarów, większe znaczenie parkingu.
- **Nocna zmiana:** mniejszy ruch, wysokie zapotrzebowanie na kawę, koszty oświetlenia i obsady.

Warianty korzystają ze wspólnego modelu. Nie implementować trzech pełnych scenariuszy przed dopracowaniem podstawowego.

## 12. Zdarzenia dynamiczne i rytm

Zdarzenia mają wymuszać wybór, ale nie losowo niszczyć kampanii:
- niespodziewany autokar z klientami sklepu,
- podwyżka cen hurtowych przed dostawą,
- deszcz ograniczający ruch do myjni,
- awaria jednego dystrybutora wymagająca czasowego wyłączenia,
- przyjazd trzech ciężarówek w krótkim odstępie,
- oferta dostawcy na tańszy zakup większej partii.

W jednym momencie maksymalnie jedno krytyczne zdarzenie. Każde ma telegraphed sygnał (ikonka na drodze, alarm, animacja, zmiana prognozy), przewidziany czas na reakcję i więcej niż jedno sensowne rozwiązanie. Możliwa spora różnorodność przy każdym rozpoczęciu z nowym seedem.

**Brak pustego oczekiwania:** jeśli nie ma pilnego zadania, gracz ma długoterminową decyzję o rozbudowie lub cenach. Część czasu jest na obserwację żywego świata, ale 30 minut nie może polegać na oglądaniu monotonnie przesuwających się pasków.

## 13. Oprawa graficzna

Wizualnie gra ma wyglądać jak mały, szczegółowy, przyjazny świat:
- kolorowe, rozpoznawalne auta i ciężarówki, różne sylwetki, lampy, cienie i kierunkowskazy,
- animowane paliwowe stanowiska, pracownicy, otwierane drzwi samochodów, napełniane zbiorniki,
- sklep ze światłem wewnątrz, ruchomym klientem i urządzeniami,
- myjnia z pianą, szczotkami, wodą i mokrą nawierzchnią,
- dzień, zmierzch i noc, świecące latarnie, reflektory i deszcz,
- subtelne ślady opon, trawniki, drzewa, reklamy bez prawdziwych znaków towarowych, drobne dekoracje drogi.

Grafika pixel art 2D z góry 3/4, płynna kamera i stabilny pixel snapping. Nie generuj całej mapy do jednego dużego obrazu. Przy dużym zoomie liczy się ostrość detalu, przy małym czytelna struktura dróg i stanowisk.

## 14. Dźwięk i muzyka

**Dźwięki są obowiązkowe, nie dodatkiem:**
- ambient drogi, wiatr, ptaki, deszcz, odległe silniki i ruch klientów,
- silnik samochodu: przyjazd, wolna jazda, zatrzymanie, odjazd,
- pompa, szybki odgłos dystrybutora, terminal płatniczy, kasa, drzwi sklepu, ekspres,
- cysterna, dostawa towaru, praca myjni, awaria, naprawa, ukończenie rozbudowy,
- ciepła, lekka oryginalna muzyka z dyskretną zmianą aranżacji podczas szczytu i nocy.

AudioService z limitami jednoczesnych dźwięków, tłumieniem przez odległość kamery, osobnymi regulatorami SFX/ambient/muzyka, opcją wyciszenia, odblokowaniem po kliknięciu. Przy dziesięciu silnikach naraz nie może być hałasu. Nie używaj nielegalnych lub nieudokumentowanych assetów.

## 15. Architektura implementacji w PixelForge

### Klient gry

Proponowana struktura:
```text
src/games/gas-station/
  index.ts
  world.ts
  scenarios.ts
  traffic.ts
  customers.ts
  fuel.ts
  shop.ts
  car-wash.ts
  economy.ts
  placement.ts
  sounds.ts
public/assets/games/gas-station/
  world/           # sektory/chunki
  sprites/
  audio/
```

Rozmieszczenie plików dopasować do istniejącej architektury. Wspólny silnik nie importuje z katalogu gry.

### Generyczne możliwości do oceny

- **TrafficAndQueueService:** regionalny ruch samochodów, rezerwacja zasobów/stanowisk, ograniczenie korków i deadlocków. Nazwy `pump` i `fuel` pozostają w grze.
- **DynamicPlacementService:** footprinty, rotacja, drogi, walidacja dostępności, lokalna invalidacja indeksów i bieżących tras.
- **ServiceStation/ResourceService:** ogólne przetwarzanie wejść, usług i przepustowości, bez nazwy stacji paliw.
- **EconomyLedger:** jawne transakcje, kontrola dokładności, zakup/sprzedaż.
- **ScenarioScheduler:** zdarzenia czasu rzeczywistego, seed RNG, alert i wygaśnięcie.
- **SaveService:** oddzielny, wersjonowany namespace i spójny snapshot działań/rezerwacji.

**Nie kopiuj W1/W2 Winobrania RTS** do nowej gry. Wspólne systemy rozbudowy mapy i ekonomii mogą zostać wyekstrahowane, jeśli są naprawdę generyczne, bez regresji istniejącej gry. Upewnij się, że po aktualizacji pakietu zapis Dżdżownicy, Atlasu i Winobrania RTS jest zgodny.

**Ograniczenia znane z P1:** sektorowy świat 4096/8192 i regionalne A* istnieją, ale historyczne budżety to ok. 32 aktorów i 256 obiektów. Ruch 40–60 samochodów w całej kampanii nie oznacza 60 aktywnych sprite'ów jednocześnie. Domyślny limit aktualnie widocznych/obsługiwanych jednostek dobierz testami; nie podnoś jedynie stałej z nadzieją, że wydajność będzie dobra.

### Zapis

Stan: `schemaVersion`, `gameId`, `gameVersion`, seed, zmiana i zegar, status kampanii, parcela/własność, budynki i drogi, ceny, paliwa, zaopatrzenie, saldo i ledger, ludzie/role, pojazdy/trasy/rezerwacje, klienci i cierpliwość, kolejki, stan sklepu/myjni, pending deliveries, zdarzenia, historia sprzedaży, kamera i zoom. Wszystkie rekordy odseparowane od innych gier. Wznowienie w połowie dostawy nie tworzy nowej cysterny ani nie rozlicza drugi raz sprzedaży.

## 16. Kamienie milowe dla Codexa

### S0. Projekt techniczny i gameplay design
- [ ] Przejrzyj najnowszą działającą gałąź silnika, PR #15 lub późniejszy, nie bazuj ślepo na dokumentacyjnym `main`.
- [ ] Utwórz `docs/STACJA-BENZYNOWA-IMPLEMENTATION.md`: dokładny model stanów, kontrakty, zakres systemów generycznych, schematy, budżet assetów, plan E2E i ryzyka.
- [ ] Opracuj jednoznaczną tabelę pętli 3 zmian, koszty, marże, wagi satysfakcji i ograniczenia liczby jednostek.
- [ ] Załóż nową gałąź `feature/p3-stacja-benzynowa` od sprawdzonej bazy. Nie scalaj ani nie publikuj automatycznie.

### S1. Vertical slice 5–8 minut
- [ ] Mapa drogowa i mała stacja, ruch losowanych aut, 2 dystrybutory, E95/ON, zapasy i marże.
- [ ] Sklep/kasa, 2 pracowników, kolejki tankowania i płatności.
- [ ] Zamówienie i przyjazd cysterny, rzeczywiste uzupełnienie stanu paliwa.
- [ ] Jedna możliwość rozbudowy, np. dodatkowy dystrybutor.
- [ ] Pierwszy mini-cel: obsłuż 12 samochodów i uzyskaj dodatni wynik po 5–8 minutach. Widoczny ekran wyników.
- [ ] Dźwięk ruchu, dystrybutora, kasy i motyw tła, kamera i zoom, zapis/wznowienie.
- [ ] Wszystkie konieczne akcje tylko myszą. Bez dekoracyjnych, nieaktywnych kontrolek.

### S2. Rozbudowa, ruch i personel
- [ ] Samochody osobowe, dostawcze, ciężarówki; różne dojazdy, kolejki i zachowania.
- [ ] Kupowanie parcel i swobodne rozmieszczenie dystrybutorów, parkingów, drugiej kasy, drogi.
- [ ] Pracownicy, płace, zmiany i priorytety.
- [ ] Zmienne ceny, różna marża, sklep i popyt na usługi.
- [ ] Brak zakleszczeń i regresji regionalnego pathfindingu.

### S3. Myjnia, ekonomia, trzy zmiany, zakończenie
- [ ] Myjnia z rzeczywistym dojazdem, animacją, kosztami i kolejką.
- [ ] Dynamiczne wydarzenia, deszcz, fala turystów, awarie i dostawy.
- [ ] Pełne piątek/sobota/niedziela i nieunikniony finał po trzeciej zmianie.
- [ ] Co najmniej trzy opłacalne strategie, wygrana/częściowy sukces/porażka, bilans ekonomiczny.

### S4. Dopracowanie i wydanie
- [ ] Trzy scenariusze, pełna grafika, animacje, audio i dynamiczne światło.
- [ ] Playtesty z co najmniej 3 osobami, pomiar czasu i problemów z odkrywalnością.
- [ ] Regresja wcześniejszych gier, pełna kampania na kilku seedach, testy wydajności i rozmiaru builda.
- [ ] Wydanie `full ZIP` zgodne z istniejącym aktualizatorem U2, bez aktualizacji jego kodu.
- [ ] PR i raport; nie scalać ani nie wdrażać bez zgody użytkownika.

## 17. Testy i definicja ukończenia

- [ ] Pełny cykl samochodu od drogi do odjazdu, z uwolnieniem wszystkich rezerwacji.
- [ ] Tankowanie zużywa właściwy rodzaj paliwa, przyrost gotówki i koszt poprawnie rozliczany.
- [ ] Cysterna podnosi zapas dokładnie o dostarczoną ilość, nie przepełnia zbiornika.
- [ ] Sklep rozlicza towar i kasę dokładnie raz.
- [ ] Budowa nie blokuje bezpowrotnie wejść, wyjść i tras obecnych samochodów.
- [ ] Kolejki i zachowania klientów są logiczne przy zmianie ceny, braku towaru i awarii.
- [ ] Pauza, ×1/×2/×4, zapis i restart nie zmieniają bilansu oraz nie tworzą podwójnych klientów.
- [ ] Rozgrywka nie wymaga żadnego klawisza; interfejs jest czytelny i w pełni klikalny.
- [ ] Wszystkie trzy zmiany i finał działają. Kilka seedów i różnych strategii pozwala osiągnąć sukces.
- [ ] Dźwięk i obraz są dopracowane; brak pustych placeholderów w wydaniu produkcyjnym.
- [ ] Testy lint, TypeScript strict, Vitest, Playwright E2E, niezależny test ZIP i brak regresji Atlasu, Dżdżownicy i Winobrania RTS.
- [ ] Zachowanie kluczy zapisów po aktualizacji ZIP oraz poprawne wznowienie klienta.
- [ ] Gra nie zostaje oznaczona jako ukończona bez playtestu człowieka potwierdzającego przystępność i średni czas 25–35 minut.

## 18. Zakres poza MVP

Nie dodawaj od razu multiplayera, rozliczeń realnego podatku, programu lojalnościowego z danymi osobowymi, marketingowego backendu, tankowania ręcznego „do litra”, obsługi wielkiej sieci stacji, prawdziwych marek paliw czy zewnętrznych API cen. Nie implementuj prawdziwych procedur bezpieczeństwa obsługi materiałów niebezpiecznych, to uproszczony symulator ekonomiczny.

## 19. Polecenie startowe dla Codexa

> Zbudujemy `Stacja na Trasie: Wielki Weekend` na silniku PixelForge. Przeczytaj `docs/STACJA-BENZYNOWA.md`, `AGENTS.md`, `docs/ROADMAP.md` i kontrakt dużych światów z aktualnej gałęzi roboczej. Sprawdź najnowszą działającą bazę (PR #15 lub nowszy) i przeanalizuj wspólne moduły RTS z Winobrania, ale nie kopiuj gry i nie zmieniaj jej mechanik bez powodu. **Wykonaj na razie wyłącznie S0:** projekt implementacyjny, kontrakty, harmonogram S1, plan testów i ryzyka. Nie zaczynaj S1–S4, nie scalaj i nie publikuj ZIP bez odbioru.
