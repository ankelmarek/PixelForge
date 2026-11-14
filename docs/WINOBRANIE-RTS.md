# WINOBRANIE RTS — „Trzy sezony”
**Status:** zatwierdzona nowa koncepcja; specyfikacja do realizacji przez Codexa. **Data:** 2026-11-14. **Silnik:** PixelForge, nie osobna aplikacja technologiczna.

> **Zmiana decyzji:** pierwotny prosty prototyp „Winobrania” z PR #4 pozostaje porzucony. Użytkownik zamawia NOWY, dużo ambitniejszy tytuł o roboczej nazwie **Winobranie RTS: Trzy sezony**. Nie reaktywować starej, 640×416 px mapy ani kopiować jej grywalności. Można wykorzystać tylko wspólne, sprawdzone usługi silnika i dopasowane assety, jeśli spełnią nowe standardy.

## 1. Wizja produktu i ramy

To **real-time strategy / tycoon** o zarządzaniu winnicą i przetwórstwem winogron. Gracz sam planuje parcele, sadzi wybrane odmiany, zatrudnia pracowników, kupuje traktorki, wyznacza drogi i stawia domki winiarskie. Obserwuje wzrost, broni upraw przed przymrozkami, organizuje zbiory, tłoczy i fermentuje, a następnie sprzedaje partie wina. Rozgrywka trwa **docelowo około 30–35 minut** i ma skończoną kampanię oraz jasne warunki sukcesu, częściowego sukcesu i porażki.

- Duży świat **8192 × 8192 px** (lub równoważna duża mapa sektorowa PixelForge); startowa własność zajmuje tylko część świata. Po zakupie nowych parcel gracz stopniowo rozszerza teren. Kamera nie pokazuje całego świata przy wejściu, ale nie można mieć wrażenia ciasnoty. Możliwość późniejszej mapy 4096 w opcjach jakości, bez ograniczania samego silnika.
- Widok 2D z góry/3⁄4, czytelny pixel art, pełne okno przeglądarki. Mysz odpowiada za **100% niezbędnych akcji**; klawiatura jest tylko opcjonalna (Esc pauza; R obrót podczas budowy). Touch jako przystosowanie późniejsze, bez blokowania desktopowego MVP.
- Rozgrywka w czasie rzeczywistym, z przyciskami pauza oraz x1, x2 i x4. Symulacja logiczna niezależna od FPS i widoczności obiektów.
- Bez tekstowych tutoriali, pop-upów „naciśnij…”, obowiązkowych podpowiedzi i długich instrukcji w trakcie gry. **Dopuszczalne są etykiety gatunków, odmian, ceny, liczby i krótkie nazwy paneli strategicznych.** Akcje tłumaczą ikony, animacje, dźwięk, podświetlenia i natychmiastowa informacja zwrotna.
- Nie buduj od razu pełnego edytora gier ani multiplayera. Ta gra ma sprawdzić użyteczność wspólnego silnika, lecz zachować własną, angażującą pętlę decyzyjną.

## 2. Główna pętla i wygrywanie

**Wybór ziemi → rozmieszczenie infrastruktury → dobór odmian i sadzenie → pielęgnacja / ryzyko pogodowe → planowanie pracowników i floty → zbiór → transport → tłoczenie / fermentacja → sprzedaż → inwestycja → kolejny rok.**

### Kampania

- **Trzy skompresowane lata winiarskie**, każdy obejmuje wiosnę, lato i jesień, po około 9–11 minut realnego czasu przy x1. Oczekiwany czas z pauzami i zarządzaniem: 30–35 minut, zweryfikowany playtestami; tempo należy zbalansować.
- Przez każdy rok przechodzimy automatycznie, nie przez ręczne „zakończ turę”. Wydarzenia pogodowe i dojrzewanie zależą od czasu symulacji.
- Start: dwa małe domki winiarskie dostępne do postawienia na własnym terenie, jeden traktorek, podstawowy magazyn, dwaj pracownicy i ograniczona gotówka. Startowa działka zawiera mały obszar dojrzałych krzewów, aby rok pierwszy dawał dochód. Gracz sam rozstawia pozostałe budynki i nowe rzędy.
- Nowe nasadzenia są inwestycją długoterminową: rok posadzenia = brak lub minimalny plon, następny = ograniczony, trzeci = wysoki potencjał. Tak projektuj kampanię i ekonomię, aby nowe sadzenie opłacało się przed finałem, ale nie dawało natychmiastowego plonu.
- Wartości początkowej gotówki, plonu i kosztów są parametrami balansu, nie kodem na sztywno. Przygotuj fixture i test kampanii.

### Koniec i punktacja

Po jesieni roku trzeciego gra kończy się automatycznie ekranem wyników. Przykładowa **propozycja do zbalansowania**:
- **Wygrana:** wyprodukuj i sprzedaj minimum 500 butelek, utrzymaj średnią jakość sprzedanych partii ≥65/100, osiągnij nieujemną wartość netto i posiadaj przynajmniej dwa produkcyjne szczepy winorośli w roku trzecim.
- **Częściowy sukces:** dotrzyj do finału z działającą winnicą, ale bez spełnienia wszystkich celów.
- **Przedterminowa porażka:** trwała niewypłacalność przy braku możliwości odzyskania płynności lub utrata wszystkich produkcyjnych krzewów bez środków na odbudowę. Zapewnij ostrzeżenia wizualne i realną możliwość ratunku, nie losową ścianę.
- Wynik końcowy pokazuje też łączny plon, straty mrozowe, jakość, saldo, ilość zakupionej ziemi i liczbę ukończonych budynków. Nowa kampania z innym seedem.

**Nie zamieniaj kampanii w monotonne oczekiwanie na pasek.** Przez większość czasu gracz podejmuje decyzje z realnym kosztem alternatywnym.

## 3. Tryby / warianty rozgrywki

W menu wybór jednego z trzech scenariuszy z rozpoznawalną ikoną i krótką etykietą:
1. **Spokojne Wzgórza:** łagodna pogoda, mniejsze ryzyko, na naukę ekonomii.
2. **Dolina Przymrozków:** częste zimne poranki, zagłębienia terenu i konieczność sensownej obrony plantacji.
3. **Kapryśny Sezon:** nieprzewidywalny deszcz, susza, zmienne ceny i umiarkowane przymrozki.

Każdy scenariusz ma deterministyczne ziarno losowości i zestaw parametrów, bez odmiennych implementacji reguł. Na start zrealizuj Spokojne Wzgórza, pozostałe dopiero po pełnej pętli.

## 4. Teren, mapa i wolne budowanie

### Mapa
- World v2 / sektorowy renderer PixelForge; co najmniej 8192×8192 px, sektor 512 px lub kompatybilny z aktualnym engine. Nie rysować jednego PNG całego świata.
- Mapa ma cechy parcel: nasłonecznienie, wysokość, nachylenie, typ/potencjał gleby, wilgotność, ryzyko mrozu, dostęp do drogi i wody. Wskazuj je ikonami, prostą mapą cieplną i symbolami, nie ścianą tekstu.
- Doliny są chłodniejsze, wzniesienia bardziej słoneczne i przewiewne; nie przesadzaj z realizmem GIS. Rozmieszczenie roślin ma wpływać na opłacalność.
- Startowa własność obejmuje centralny płat ziemi. Kolejne działki odblokowuje zakup przez kliknięcie tabliczki/granicy parceli. Obszar niezagospodarowany może być rozległy, ale nie powinien wyglądać jak bezcelowo pusta plansza: pola, zagajniki, wąwóz, strumień, drogi gruntowe, sąsiednie gospodarstwa.
- Swobodna rozbudowa **w granicach kupionych parcel**. Gracz wyznacza kierunek oraz długość rzędu, drogi, miejsca postoju i budynki. Nie narzucać gotowego układu jak w starym Winobraniu.

### Narzędzia budowy
- Panel ikon: **winorośl, droga, domek winiarski, magazyn, zbiornik wody, pompa, zraszacz, sprzedaż/rozbudowa**.
- Wybór szczepu, potem „malowanie” rzędów przez przeciągnięcie myszy między początkiem i końcem; automatyczne rozstawienie podpór i sadzonek, możliwość anulowania przed potwierdzeniem.
- Budynek: podgląd „ducha”/footprint, zielony lub czerwony obrys kolizji, obrót przyciskiem na ekranie (R opcjonalnie), kliknięcie zatwierdza, anulowanie prawym przyciskiem lub ikoną.
- Możliwość przeniesienia **niepracującego** domku po poniesieniu kosztu/straty czasu, zamiast blokady planowania; podczas przeprowadzki maszyna i pracownicy dostają bezpieczną kolejkę lub jasny stan błędu. Usuwanie nasadzeń nie daje zwrotu pełnej ceny.
- Walidacja: działka kupiona, nachylenie dopuszczalne, brak obiektów, dostęp drogi, przejazd dla traktora, dostęp do wody. Nie stawiaj budynku, który nie ma osiągalnego wejścia.
- Zmiana układu musi aktualizować **topologię** i indeks nawigacji lokalnie/inkrementalnie; obecny indeks P1 opiera się na statycznym terenie i wymaga celowej rozbudowy. Nie przeliczaj A* całego 8192×8192 px po każdym kliknięciu.
- Zapisywać nowe i usunięte obiekty, rewizje obszarów, własność ziemi i trasę dojazdu.

## 5. Szczepy i agronomia

Rozpocznij od **6 odmian spotykanych w polskim winiarstwie**:

| Odmiana | Typ | Styl rozgrywki i kompromis |
|---|---|---|
| Solaris | jasna | wcześnie dojrzewa, szybki przychód, wrażliwy na nieoptymalny termin zbioru |
| Johanniter | jasna | stabilniejszy profil jakości, późniejszy termin, wymaga pielęgnacji |
| Muscaris | jasna | odmiana aromatyczna, premia ceny jakości, ryzyko strat przy wiosennym przymrozku |
| Regent | ciemna | rozsądny balans ryzyka chorób i wydajności, średni termin |
| Rondo | ciemna | wczesne czerwone grona, potencjał koloru, inny profil wrażliwości |
| Cabernet Cortis | ciemna | wyższy potencjał ceny, dłuższe dojrzewanie i większe ryzyko przy chłodnej jesieni |

Te opisy są **uproszczeniem na potrzeby gry**, nie naukowym rankingiem mrozoodporności. Zimotrwałość odmian i odporność młodych pąków na wiosenny przymrozek to różne rzeczy. Przy modelowaniu szkody uwzględnij przede wszystkim fazę pąków, temperaturę, długość zjawiska i mikroklimat parceli.

Każdy szczep z danymi: koszt sadzonki, kolor, termin ruszenia pąków, wymagane ciepło dojrzewania, potencjalny plon, zdrowie, podatność chorobowa, cukier, kwasowość, jakość, cenę skupu/partii, próg stresu suszowego. Wszystkie wartości w jednym konfigurowalnym katalogu (`cultivars.ts/json`) z testami zakresów.

Krzew ma cykl: sadzonka → rozwój pąków → kwitnienie → zawiązanie → dojrzewanie → zbiór → spoczynek. Przebieg jest deterministyczny z temperatury, wilgoci, pracy ludzi i wieku. W trybie x4 wynik ma być taki sam (w granicach błędu numerycznego) jak w x1.

## 6. Pogoda i przymrozek — centralny mechanizm strategiczny

- Pogoda per dzień w symulacji: temperatura, deszcz, słońce, wilgotność, wiatr; prognoza na następne 1–3 dni jako ikonki, z pewną niepewnością. Przymrozki głównie wiosną, sporadycznie w scenariuszu specjalnym.
- Mapa chłodnych zastoisk: doliny ryzykowniejsze niż wyżej położone parcelki. Efekt fazy rozwoju krzewu ważniejszy niż ogólna „odporność na mróz”.
- **Aktywny system ochrony przez zraszanie nadkoronowe:** kup pompy, zbiornik/źródło wody, rurociąg i zraszacze; zraszacze pokrywają wybrany obszar, ale kosztują i wymagają wody oraz energii. Gdy zaczyna się epizod, można je aktywować ręcznie albo wcześniej ustawić tryb automatycznej ochrony.
- **Mechanizm fizyczny w uproszczeniu:** stale zamarzająca woda oddaje ciepło i pomaga ochronić tkanki, jeżeli strumień jest wystarczający i nieprzerwany **aż warunki pozwolą na odmarzanie**. To NIE jest pojedynczy „oprysk ratujący”, a przerwanie zraszania w trakcie mrozu może pogorszyć szkody. Model ma symulować ciągłe zużycie wody, wydajność pompy, pokrycie i konsekwencję awarii; nie nagradzaj krótkiego kliknięcia.
- Gracz widzi oblodzone krzewy, działające strumienie zraszaczy, poziom wody oraz alarm mrozu przez ikonę termometru, miganie podświetlonych rzędów i charakterystyczny dźwięk. Nie pisz tutoriali.
- Brak ochrony = częściowa/większa utrata pąków i przyszłego plonu, ale nie automatyczna porażka. Dobre stanowisko i mniej wrażliwa faza ograniczają szkodę. Możliwe zakupienie wody albo rezerwa na szkody.
- Dodatkowe zagrożenia: susza, nadmierne opady, choroby winnicy; dla pierwszego pełnego wydania jedną chorobę i jedną suszę wystarczy zaimplementować jako prostsze zdarzenia. Szczegółowa ochrona chemiczna bez realizmu toksykologicznego i bez porad o doborze środków.

**Warunek testowy:** przedłużony przymrozek przy poprawnym zraszaniu, przy niedoborze wody, przy przerwaniu pompy i bez zraszania daje sensownie różne straty. Nie można uratować upraw przez jednorazowy click.

## 7. Dwa domki winiarskie i rozbudowa

- **Dwa domki na starcie**, możliwe do ustawienia samodzielnie w obrębie działki. Początkowo są to małe budynki o ograniczonej przepustowości i magazynie, każdy może obsługiwać osobne partie (np. wino białe i czerwone) albo te same procesy przydzielane przez gracza. Nie koduj na sztywno obowiązku „biały domek tylko dla białych”.
- Możliwość **kupna co najmniej trzeciego domku**, a po udowodnieniu działania także dalszych, w ramach budżetu mapy i gospodarki.
- Każdy domek posiada: przyjęcie skrzynek, zgniatarkę/prasę, fermentator (uproszczony proces), magazyn partii i limit obsługi. Widoczne animacje oraz wskaźniki obłożenia.
- Ulepszenia: szybkość tłoczenia, większy zbiornik, lepsza kontrola temperatury, większa pojemność. Upgrade nie może być jedynym rozwiązaniem przeciążenia: zakup kolejnego budynku też ma sens.
- Łącz grona w partie według odmiany, zdrowia i jakości. Wino otrzymuje parametry jakości; można sprzedać taniej wcześnie lub zaczekać na lepszą partię. Jeśli prawdziwa fermentacja trwa tygodnie, w grze jest świadomie kompresowana do minut.
- Proces musi bilansować zasoby i zachowywać identyfikator partii: grona → moszcz → wino → butelki → sprzedaż. Bez duplikacji, ujemnych stanów i znikających ładunków.

## 8. Traktorki, pracownicy i automatyzacja

### Flota
- Start **1 traktorek**; można kupić minimum 2 kolejne warianty: mały tani, mocniejszy droższy, z większą przyczepą. Każdy ma ładowność, prędkość, promień skrętu, dostępność drogi, koszty eksploatacji.
- Jednostka realizuje pętlę odbiór skrzynek → transport do wybranego domku → rozładunek → powrót. Może jechać ręcznie wyznaczoną trasą przez kliknięcie lub pracować automatycznie w przydzielonym sektorze.
- Zakup traktora powinien pomagać przy rosnących odległościach i natężeniu zbiorów. Nie teleportuj skrzynek.

### Pracownicy
- Start **2 pracowników**. Możliwość zatrudnienia dodatkowych sezonowych i stałych (inne koszty, wydajność, dostępność); zwalniania po zakończeniu przydziału. Płace pomniejszają budżet w czasie.
- Role: sadzenie, pielęgnacja, zbieranie, obsługa winiarni, załadunek/rozładunek. Pierwsza wersja może mieć jedną klasę pracownika z przełączaną rolą, ale zadania muszą faktycznie wpływać na dostępność.
- Kliknięcie ludzi i obszaru przydziela pracę; oznaczanie obszaru wielokrotnym zaznaczeniem pozwala wysłać kilku pracowników. Dostępna kolejka zadań, priorytety sezonowe i tryb automatyczny.
- Zachowaj spójny pathfinding: drogi dla pojazdów, ścieżki/pasaże dla pieszych, dostęp do konkretnych rzędów i wejść do budynków. Pracownicy i traktorki wykonują zadania poza kamerą.
- Sztuczna inteligencja pracownika ma być **przewidywalna**, a nie magiczna: brak drogi powoduje widoczny status blokady, nie stanie bezczynnie bez sygnału. Ogranicz deadlocki, kolizje dynamiczne i podwójne rezerwacje skrzynek.

## 9. Ekonomia, decyzje i tempo

Gospodarka obejmuje gotówkę, pensje, zakup ziemi, sadzonek, budynków, traktorków, części, utrzymanie maszyn, wodę i energię oraz przychody z partii wina. Umożliw małą pożyczkę lub krótką sprzedaż winogron w kryzysie, ale z wyraźną ceną. Nie dopuść do automatycznego bankructwa od jednego losowego mrozu bez uczciwej szansy kontrdziałania.

Kluczowe dylematy: drogie nasadzenia czy sprzęt, ratować dolną parcelę czy oszczędzać wodę, zatrudnić dodatkową ekipę czy kupić traktor, kupić trzeci domek czy ulepszyć istniejące, sprzedać tańszą partię czy poczekać na lepszą.

W wersji planistycznej przykładowy budżet startowy **30 000 umownych monet**. Pozostałe ceny, plony i tempo są wyłącznie propozycją Codexa do zbalansowania testami z automatycznym agentem i ludzkim playtestem. Zakazane jest dobieranie z góry wyniku losowego pod jedną „właściwą” ścieżkę.

## 10. UI i sterowanie

**Mysz wystarcza do ukończenia 100% kampanii.**
- LPM klik: wybór jednostki, budynku, ziemi, zadania i potwierdzenie.
- LPM przeciągnięcie: malowanie rzędów, wyznaczenie drogi, zaznaczanie kilku jednostek albo przesuwanie kamery po pustym terenie. Kontekst i próg ruchu rozstrzygają gest.
- Kółko: zoom z kotwicą pod kursorem.
- PPM lub ikona: anulowanie bieżącego narzędzia.
- Ikony: budowa, odmiany, zatrudnienie, flota, budynki, pogoda, finanse, pauza i prędkość.
- Dopuszczalne liczby, krótkie nazwy i kolorowe piktogramy dla przejrzystości strategii. **Zero pisanych instrukcji sterowania i tutoriali gameplayowych**.
- Przy kliknięciu zadania podświetl obszar docelowy; nieodpowiednie miejsce na budynek czerwonym obrysem; brak środków monetą z wizualnym wygaśnięciem; przymrozek ikoną ostrzeżenia i dźwiękiem.
- HUD: sezon/rok, temperatura, prognoza, środki, pracownicy, dostępne traktory, stan produkcji, trzy cele kampanii i widoczny pasek czasu sezonu. Każdy element może pokazać kontekstowy panel bez zatrzymywania całej symulacji.
- Interfejs ma być czytelny, bez zajmowania połowy mapy rozbudowanymi panelami. Minimapę można kliknąć; alerty kierują kamerę do źródła zdarzenia.
- Dźwięk odblokowany po pierwszej interakcji użytkownika; pauza i wyciszenie działają zawsze.

## 11. Oprawa, dźwięki i życie świata

- Estetyka ciepłego, nasyconego pixel art; wyraźne rzędy winorośli, odmiany różnią się barwą owoców i pokrojem, animacje zmian sezonów i rozwoju roślin.
- Co najmniej 3 typy gruntu, kilka wariantów dekoracji, zwierzęta w tle (ptaki, motyle), kurz za traktorem, podnoszone skrzynki, ruszające się liście i detale winiarni. Nie stosuj ogromnych jednolitych pustych parcel.
- **SFX:** jazda traktora (przyspieszanie, zatrzymanie), koszenie i zbiór, skrzynki, kroki, budowa i stawianie podpór, deszcz i burza, zraszacze i pompa, alarm przymrozku, prasa, fermentator, nalewanie/butelkowanie, sprzedaż, sukces/porażka.
- Ambient: wiatr wśród winorośli, ptaki i owady, dźwięki winiarni słyszane zależnie od kamery; wieczorem przyciszone tło. Płynna, lekka muzyka oryginalna lub z prawidłową licencją. Oddzielna regulacja muzyka/efekty/ambient, przycisk mute.
- Optymalizuj miks: kilka traktorów i pracowników nie może nałożyć 30 identycznych efektów; priorytety i ograniczenie głosów, tłumienie zależne od odległości kamery.
- Przy słabszym sprzęcie ogranicz cząsteczki, nie wyłączaj logicznych skutków pogody lub produkcji. Zachowaj spójny pixel art przy zoomie.

## 12. Architektura w PixelForge i stan

**Nie pisz osobnej aplikacji Phaser.** Dodaj `src/games/winobranie-rts/` jako nowego klienta z własnym `GameDefinition/ClientDefinition` i osobnymi plikami world, parcel, cultivar, costs, recipes, scenarios, assets, audio. Użyj istniejących `EngineHost`, sektorowego świata v2, symulacji fixed-step, regionalnej nawigacji, audio, UI, zapisów i pakowania statycznego ZIP. Nie importuj kodu gry z `src/engine`.

Uzupełnienia generyczne silnika:
1. `LandOwnershipService` / moduł własności parcel i granic.
2. `PlacementService`: placement, rotate, conflict, undo-before-commit, dynamic blockers/roads, inkrementalna aktualizacja grafu nawigacji.
3. `JobQueueService`: wielu pracowników, priorytety, zlecenia obszarowe, rezerwacje zasobów.
4. `ClimateEventService`: zdarzenia prognozowane, strefowe i o mierzalnych skutkach (zamiast warunków nazwanych „frost-vineyard”).
5. `ResourceProcessingService`: kilkustopniowe receptury, partie, magazyny, limity.
6. `EconomyService`: koszty/zakupy, stałe obciążenia, przejrzysty ledger.
7. `ScenarioClock`: dzień/faza/rok, prędkość 1/2/4, zapauzowanie.
8. `Snapshot/Save`: atomowy, wersjonowany zapis gry, bez mieszania z Dżdżownicą/Atlasem. Nie nadpisuj zapisów starych gier.

Buduj tylko rzeczywiście ponownie używalne usługi. **Szczepy, nazwy budynków, winiarskie receptury, pąki, krzewy i reguły jakości** należą wyłącznie do `src/games/winobranie-rts/`. Nie dokładaj sztucznego ECS ani ogólnego interpretera dowolnych skryptów.

Model: deterministyczny seeded RNG, krok stały (np. istniejące 50 ms), praca poza ekranem, czas gry x4 bez pominiętych zdarzeń. Zmiany budowania i sezonów w wersjonowanym snapshot z podstawową migracją. Duże partie obiektów reprezentuj agregacją rzędów; nie aktualizuj setek krzewów jako pełnych niezależnych obiektów Phasera poza ekranem.

**Ważne ograniczenia techniczne P1:** aktualna nawigacja ma statyczną topologię, dotychczasowe limity 32 aktorów / 256 obiektów. Nowy budowniczy wymaga bezpiecznej invalidacji regionalnych indeksów i pomiarów przy docelowych limitach. Nie zwiększaj limitów tylko przez zmianę stałej.

## 13. Zakres etapów dla Codexa

### W0. Plan techniczny i gra projektowa (bez pełnego runtime)
- [ ] Zbadaj PR #12 / `feature/p3-soil-adventure`, dokument `docs/LARGE-WORLDS.md`, stare PR #4 oraz bieżący instalator. Sprawdź, czy jest nowsza zatwierdzona baza.
- [ ] Zaproponuj gałąź `feature/p3-winobranie-rts` od ostatniego działającego i zaakceptowanego kodu, **nie od starego dokumentacyjnego main**.
- [ ] Utwórz `docs/WINOBRANIE-RTS-IMPLEMENTATION.md` z diagramem zależności, modelami stanu, schematami, etapami, zakresem testów i ryzykami.
- [ ] Wyodrębnij listę funkcji już dostępnych i brakujących (dynamiczna nawigacja, budowanie, agronomia, wieloetapowa produkcja, ekonomia).
- [ ] Nie przepisywać Dżdżownicy, Atlasu ani aktualizatora.

### W1. Grywalny rdzeń na dużej mapie
- [ ] Nowy tytuł widoczny w katalogu, duża mapa, kamera, minimapa, atrakcyjne podłoże.
- [ ] Własność parcel, swobodne stawianie dwóch domków, rysowanie 3 odmian winorośli i dróg, podstawowy budżet.
- [ ] 2 pracowników, 1 traktor, zadania i dynamiczna nawigacja po budowie.
- [ ] Produkcja: zbiór → transport → tłoczenie → pierwsza sprzedaż. Zapis/wznowienie i prosta ocena wyniku.
- [ ] Pierwszy 5–8 minutowy **vertical slice** zawierający rzeczywiste decyzje. Bez fałszywych dekoracyjnych przycisków.
- [ ] Pull Request i odbiór przed rozbudową.

### W2. Pełna agronomia i przymrozek
- [ ] 6 odmian, fazy rozwoju i wiek nasadzeń, różne gleby/nasłonecznienie.
- [ ] Pogoda, prognoza, temperatura i przymrozek z ochroną przez nieprzerwane zraszanie.
- [ ] Dynamiczna sieć wody/pompy/zraszacze oraz symulacja stresu i utraty części plonu.
- [ ] Testy porównawcze strat z/bez ochrony i test przerwanej pompy, bez wymuszonej porażki.

### W3. Strategia ekonomiczna i trzy lata
- [ ] Kupowanie ziemi, nowych traktorków, ludzi i kolejnych domków, upgrade, obciążenia finansowe.
- [ ] Kilka etapów produkcji, partie jakościowe i sprzedaż, podstawowe kontrakty.
- [ ] Cały cykl trzech lat, scena sukcesu/niepełnego sukcesu/porażki, co najmniej 3 sensowne strategie osiągnięcia celu.
- [ ] Co najmniej jedna realizacja od startu do końca w każdej z dwóch skrajnych pogód, bez cheatów i teleportacji.

### W4. Warianty, grafika, dźwięk i publikacja
- [ ] Trzy scenariusze, pełna oprawa pixel art, przejścia sezonów, audio, animacje urządzeń i ludzi.
- [ ] Balans i testy grywalności: 3–5 osób nieznających gry, pomiar średniej i rozrzutu czasu ukończenia.
- [ ] Badania FPS/pamięci, także poza ekranem, na światowych mapach, desktop i emulacji telefonu.
- [ ] Full ZIP zgodny z istniejącym panelem aktualizacji, nie wgrywać automatycznie ani nie zmieniać samego aktualizatora.
- [ ] Raport, checklista, PR, decyzja użytkownika o wdrożeniu.

**Uwaga:** jeśli zakres W1 wymaga istotnych zmian silnika, najpierw pisz testy kontraktowe i wykonuj małe przyrosty. Nie próbuj zrealizować W0–W4 w jednym nieprzejrzystym PR.

## 14. Kryteria odbioru gry

1. Całość działa pod hostem PixelForge i nie uszkadza Atlasu, Dżdżownicy ani zapisu lokalnego.
2. Gra nie składa się z małego placu z kilkunastoma rzędami. Są istotne strefy świata, rozwój parcel i rzeczywisty zoom/kamera w 8192×8192.
3. Gracz może sam wyznaczyć rzędy winorośli i drogi, rozmieścić dwa domki, dokupić trzeci, traktory, pracowników oraz budynki ochronne.
4. Odmiany różnią się ekonomicznie i agronomicznie. Nowe nasadzenia nie wydają pełnego plonu natychmiast.
5. Przymrozek wymaga sensownej obrony; przy poprawnym zraszaniu straty są niższe, przerwanie zbyt wcześnie nie daje darmowej ochrony.
6. Traktor faktycznie przewozi plon, ludzie mają role, wino przechodzi przez łańcuch produkcyjny, bilans ilościowy jest zgodny.
7. Wszystkie konieczne działania wykonuje się myszą, gra nie zawiera pisanych instrukcji sterowania. Przykładowe nazwy odmian i ceny są dozwolone.
8. Dźwięki i muzyka działają, mają mute i niezależne głośności, nie są głośno nakładane przy wielu jednostkach.
9. Każda kampania kończy się automatycznie po trzech latach, posiada sukces/częściowy sukces/porażkę i logiczny ekran wyników.
10. Testy: unit, integracja, E2E, browser, bezpieczeństwo parametrów JSON, deterministyczność x1/x4, zapis/wznowienie, regresja istniejących gier, wydajność i paczka ZIP.
11. Gra jest strategicznie różnorodna: przynajmniej trzy ścieżki rozwoju (intensywny plon, jakość premium, dywersyfikacja/odporność) są wykonalne i testowane.
12. Nie wolno oznaczyć projektu jako `DONE` wyłącznie na podstawie kompilacji; konieczny jest test rzeczywistej rozgrywki i ocena długości.

## 15. Wiedza referencyjna

Odmiany spotykane w Polsce: https://polish.wine/grape-varieties/ . Przebieg ochrony przez nadkoronowe zraszanie podczas mrozu: https://content.ces.ncsu.edu/prevention-and-management-of-frost-injury-in-wine-grapes . Dane referencyjne służą realizmowi mechanik; parametry gry podlegają balansowi i nie mogą udawać precyzyjnej symulacji agronomicznej.

## 16. Ograniczenia i decyzje niezależne

- Nowy produkt **Winobranie RTS** nie oznacza odwieszenia starego `winobranie` PR #4.
- **Leśny sygnał** pozostaje porzucony.
- Nie implementuj dodatkowego backendu ani gospodarki online. Gra działa statycznie i używa istniejącego systemu ZIP.
- Nie modyfikuj ani nie instaluj panelu administratora na serwerze w ramach pracy nad grą.
- Rozwój tylko na osobnej gałęzi, z PR i bez automatycznego merge do main.
