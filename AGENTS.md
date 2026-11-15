# AGENTS.md — stałe wytyczne dla Codexa

## Cel

Zbuduj **PixelForge**, modułowy silnik przeglądarkowych gier 2D w pixel art, umożliwiający tworzenie niezależnych, prostych gier o docelowej długości 20–35 minut. **Nie pisz jednorazowej gry pod nazwą PixelForge.** Najpierw zbuduj współdzielony runtime, następnie gry będące jego klientami.

Przed zmianami przeczytaj `README.md`, `docs/SPECIFICATION.md` i `docs/ROADMAP.md`. Decyzje w tych plikach są obowiązujące, dopóki użytkownik ich nie zmieni.

## Aktualne decyzje projektowe (2026-11-14, nadrzędne nad dawnymi instrukcjami)

**Nowa decyzja:** stary uproszczony prototyp `winobranie` z PR #4 jest porzucony, ale użytkownik zatwierdził **nowy, osobny produkt `Winobranie RTS: Trzy sezony`**, wielką strategię 2D z góry, z sześcioma odmianami, swobodnym układaniem plantacji, ochroną przed przymrozkami, zakupem domków i traktorów, zatrudnianiem ludzi, dźwiękiem i finałem kampanii. Obowiązuje szczegółowa [specyfikacja](docs/WINOBRANIE-RTS.md) i roadmapa 0.3. Nie reaktywuj mapy ani pętli starego Winobrania; wykorzystuj generyczny rdzeń. **Platformówka `Leśny sygnał` / `forest-demo` pozostaje porzucona.** Nie usuwaj ani nie scalaj hurtowo historycznych gałęzi bez polecenia.

Nowym kierunkiem są **duże światy 2D z góry, widok z góry 3/4, sterowanie myszą, przyjazne symulatory i krótkie gry na 20–35 minut**. Docelowy świat nowej gry ma startować od 4096 × 4096 pikseli, z architekturą sektorową/chunkową pozwalającą na większe wymiary. Nie buduj jednej ogromnej tekstury ani nie uruchamiaj pełnego A* na całej mapie przy każdym ruchu.

Nowym zadaniem infrastrukturalnym jest **bezpieczny aktualizator ZIP** z podglądem zmian, kontrolą wersji, stagingiem, kopią poprzedniego wydania i rollbackiem. Sam statyczny frontend nie aktualizuje hostingu. Opcjonalny moduł webowy wymaga osobnego, uwierzytelnionego komponentu serwerowego. Nie uruchamiaj publicznego uploadu bez logowania.

**Bieżąca dokumentacja:** `docs/ROADMAP.md` (wersja 0.3), `docs/WINOBRANIE-RTS.md` i dokumenty obecnego engine. Roadmapy 0.2 oraz historyczne są archiwum. Nowe Winobranie RTS jest odrębną grą, stare Winobranie nie może być rozwijane. Nie rozpoczynaj automatycznie implementacji kolejnego etapu.

**Stan W0:** wykonano inwentaryzację i [plan wdrożenia](docs/WINOBRANIE-RTS-IMPLEMENTATION.md) na `feature/p3-winobranie-rts`, bazując na kodzie PR #12. [Raport W0](docs/W0-REPORT.md) oddziela sprawdzone funkcje bazy od projektowanych usług. W1 został następnie zlecony i zaimplementowany na `feature/w1-winobranie-rts`; [raport W1](docs/W1-REPORT.md) opisuje weryfikację. Użytkownik następnie zlecił W2: „ok, teraz rozwiń grę, zróżnicuj, losuj, zrób ciekawszą”. W2 jest zaimplementowane na `feature/w2-winobranie-seasons`; [raport W2](docs/W2-REPORT.md) dokumentuje wynik. Użytkownik następnie zlecił W3: „Rób nowy zakres”. W3 jest zaimplementowane na `feature/w3-winobranie-campaign`; [raport W3](docs/W3-REPORT.md) podaje stan weryfikacji. Nie rozpoczynaj W4 bez następnego polecenia.

**Zmiana koncepcji „Życia Dżdżownicy” na polecenie użytkownika (2026-11-13):** ta gra pokazuje pionowy przekrój gleby z boku, a nie widok z góry. Rośliny rosną na powierzchni, pod nimi są korzenie, pędraki i larwy. Bohater porusza się w obu osiach, drąży i użyźnia glebę. Głębiej rośnie trudność; deszcz przenika od powierzchni w dół. Punkty i stopniowy rozwój prowadzą do dorosłości. Poprzedni pomysł czterech ogrodów i odrodzenia centralnego drzewa jest zastąpiony tą koncepcją. Pozostały rdzeń i laboratorium dużego świata pozostają niezależne od perspektywy tej gry.

## Zaplanowana nowa gra: Stacja na Trasie (2026-11-14)

Użytkownik zlecił szczegółowy projekt nowej strategii ekonomicznej **„Stacja na Trasie: Wielki Weekend”**, nie jej natychmiastową implementację. Dokument obowiązujący: [docs/STACJA-BENZYNOWA.md](docs/STACJA-BENZYNOWA.md). Roadmapa zawiera etapy S0–S4.

Gra ma korzystać z PixelForge, obsługi dużych map, dynamicznych dróg i nawigacji, systemów zadań i zapisu oraz istniejącego aktualizatora ZIP. Pierwszoplanowe mechaniki: ruch samochodów, kolejki do paliwa i sklepu, dostawy cysterną, własna rozbudowa stacji, pracownicy, myjnia, ekonomia i trzy skompresowane zmiany z zakończeniem. Pełna obsługa myszą, dopracowany pixel art i dźwięki, bez obowiązkowego tekstowego tutorialu.

Przy poleceniu rozpoczęcia tego tytułu wykonaj **wyłącznie S0**, po sprawdzeniu aktualnej działającej bazy i PR #15 lub nowszych. Nie przerywaj, nie przepisuj i nie scalaj automatycznie bieżących prac nad Winobraniem RTS. Nie wdrażaj gry na hosting bez osobnego polecenia.

**Stan S0:** po poleceniu „możesz budowac stację benzunową, zerknij w roadmapę” przygotowano [projekt wdrożenia](docs/STACJA-BENZYNOWA-IMPLEMENTATION.md) i [raport S0](docs/S0-REPORT.md) na `feature/p3-stacja-benzynowa`, z bazy `7f678a1` / PR #16. W S0 Stacja nie miała jeszcze runtime ani ZIP-a. Plan wymagał akceptacji S0 przed implementacją; nastąpiła ona kolejnym poleceniem opisanym poniżej. Najem Skoczki pozostaje S2, pełna kampania S3. Nie rozpoczynaj ich automatycznie.

**Stan S1:** następne polecenie „Możesz kontynuować” zatwierdziło przejście do S1.
Na `feature/s1-stacja-benzynowa`, z bazy `4feec4e` / PR #17, powstał klient
`gas-station` 0.1.0 i wydanie PixelForge 0.12.0: pierwsza sześciominutowa
zmiana, dwie pompy, własny sklep, dwóch pracowników, fizyczny ruch/kolejki,
dostawy, jedna rozbudowa, dźwięk i osobny zapis. [Raport S1](docs/S1-REPORT.md)
opisuje testy i ograniczenia. S1 jest do odbioru. Poprawki prowadź na tej
samej gałęzi; S2–S4 oraz W4 wymagają kolejnego polecenia. Najem Skoczki,
swobodne budowanie i pełna kampania nie są jeszcze zaimplementowane.

**Nowe zlecenie (15.11.2026):** „ok, realizujj kolejne etapy” upoważnia do
wykonania kolejno **S2, S3 i S4** Stacji. Każdy etap zachowuje oddzielną
gałąź, weryfikację, raport i PR do `main`. Nie jest to zlecenie W4 Winobrania,
automatycznego merge ani instalacji na hostingu. S2 powstaje z `6dafa75`
/ PR #18, którego pełne CI #24 przeszło. Wymagane badanie S4 z trzema nowymi
graczami należy odróżnić od automatycznych testów; bez takiego badania nie
oznaczać całej gry jako ukończonej.

**Stan S2 (15.11.2026):** implementacja i paczki PixelForge 0.13.0 są na
`feature/s2-stacja-rozbudowa` / [PR #19](https://github.com/ankelmarek/PixelForge/pull/19).
[Raport S2](docs/S2-REPORT.md) opisuje swobodną rozbudowę, personel, ceny,
najem Skoczki i zapis v2. Lokalnie przeszły scenariusze Stacji, pakiety,
instalacja, rollback oraz zachowanie zapisów. Zadanie `verify` CI #25 przeszło;
E2E otrzymało poprawkę obsługi wygasłej oferty i checkpoint z CI. CI #26 ujawniło dodatkowo zapętlenie mijania pieszych. Poprawka 0.13.1
ma odtwarzalny test i przeszła lokalny scenariusz S2. Pełne CI #28 na
`767b164f79d6b82e4e470a4a1110b0e1cd2e599c` przeszło wszystkie trzy zadania;
PR #19 jest gotowy do przeglądu. Kolejno zlecone S3 i S4 pozostają autoryzowane;
nie wymagają kolejnego pytania o rozpoczęcie.

**Stan S3 (15.11.2026):** `feature/s3-stacja-weekend` bazuje na sprawdzonym
`767b164` / PR #19. Klient 0.3.0 dodaje pełne 30 minut (8/12/10), myjnię,
sześć zdarzeń, ocenę wizyt, pożyczkę, odsprzedaż i trzy wyniki kampanii.
Zapis v3 zachowuje klucze i scenariusze v1/v2. [Raport S3](docs/S3-REPORT.md)
podaje aktualne wyniki kontroli. Następny zlecony etap to S4; pełne ukończenie
gry wymaga nadal badania z trzema nowymi graczami. Bez W4, merge i hostingu.

**Stan S4 (15.11.2026):** `feature/s4-stacja-warianty`, klient 0.4.0,
PixelForge 0.15.1. Trzy warianty, seed, nocna ekonomia, światło i audio,
zapis v4 z zachowaniem v1/v2/v3. [Raport S4](docs/S4-REPORT.md) podaje
wyniki techniczne; [odbiór Q1](docs/S4-PLAYTEST.md) nadal wymaga trzech
nowych graczy. Poprawki pozostają na tej gałęzi. Nie oznaczać gry DONE
bez Q1 ani nie rozpoczynać nowego etapu, W4, merge lub hostingu.

**Uzupełnienie dla Stacji na Trasie (14.11.2026):** robocze marki to **ORLAR** (stacja z orłem) oraz **Skoczka** (fikcyjna sieć niewielkich sklepów z motywem żabki). Gracz ma móc **prowadzić sklep sam lub oddać lokal w najem Skoczce**. W najmie przychód stacji to czynsz oraz umówiony udział, a nie pełny obrót sklepu; najemca zapewnia swoich pracowników i towary. Zadbaj o parking, oddzielne kolejki, realną animację dostaw i wpływ sklepu na ruch. Mechanikę implementować w S2 po S0 i S1, zgodnie z sekcją 8.1 `docs/STACJA-BENZYNOWA.md`. Nazwy i znaki są robocze, nie kopiuj oznaczeń ORLEN ani Żabka, sprawdź odróżnialność przed publikacją.

## Gałęzie i pull requesty

- `main` jest gałęzią stabilną. Dokumentacja bazowa może w niej pozostać, ale **implementacja kodu każdego etapu musi być wykonywana na osobnej gałęzi roboczej**.
- Dla Winobrania RTS przygotuj nową gałąź `feature/p3-winobranie-rts` od **najnowszej działającej i zaakceptowanej bazy kodu**, po sprawdzeniu bieżących PR (np. PR #12), ponieważ dokumentacyjny `main` może nie zawierać implementacji silnika.
- Dla kolejnych etapów używaj osobnych, czytelnych gałęzi albo kolejnych małych PR, bez niekontrolowanego scalania niesprawdzonych zależności.
- Na koniec etapu przygotuj pull request do `main` z podsumowaniem zmian, testami i kryteriami odbioru. Nie scalaj samodzielnie PR bez wyraźnej zgody użytkownika.
- Poprawki do aktywnego etapu dopisuj do jego gałęzi, bez tworzenia kolejnego PR na każdą drobną zmianę.

## Sposób pracy

1. Sprawdź status etapów Winobrania RTS w `docs/ROADMAP.md` (wersja 0.3) i realizuj wyłącznie wskazany zakres. W0 jest udokumentowane; W1–W4 wymagają kolejnych zleceń zgodnie z roadmapą.
2. Sprawdzaj istniejący kod przed edycją. Nie niszcz działających rozwiązań, nie zastępuj całych modułów bez konieczności.
3. Wykonuj małe, czytelne zmiany i dodawaj testy. Po każdym etapie uruchamiaj wszystkie dostępne kontrole.
4. Zakończenie każdego etapu udokumentuj w `docs/ROADMAP.md`: status, istotne decyzje, testy, ograniczenia i następny krok.
5. Jeśli pojawia się nierozstrzygnięta decyzja architektoniczna, wybierz prosty, odwracalny wariant i opisz go w dokumentacji. Nie dodawaj rozbudowanych funkcji spoza MVP.
6. W raporcie końcowym podaj wykonane zadania, zmienione pliki, uruchomione testy, wyniki oraz ewentualne problemy. Nie deklaruj funkcji, których nie sprawdziłeś.
7. Nie publikuj gry automatycznie i nie włączaj zewnętrznych usług, telemetrii ani zależności wymagających kont bez wyraźnego polecenia.

## Stos technologiczny

- Phaser **4.2.1**, TypeScript `strict`, Vite.
- Vitest do logiki bez przeglądarki, Playwright do krytycznych scenariuszy.
- Node.js w aktualnej, wspieranej wersji LTS zgodnej z zależnościami. W repozytorium zapisz `engines` i plik blokady zależności.
- Runtime gry: statyczny build bez PHP, bazy SQL, logowania i serwera aplikacyjnego. **Wyjątek odseparowany od gry:** administracyjny aktualizator ZIP może wymagać niewielkiego, uwierzytelnionego komponentu serwerowego zależnego od hostingu.
- Minimalna liczba bibliotek. Unikaj Reacta w samym runtime gry, chyba że ma to konkretne uzasadnienie.

## Nieprzekraczalne granice architektury

- `src/engine/` nie importuje nic z `src/games/`. Zależność jest jednokierunkowa: gra -> publiczny interfejs silnika.
- `src/games/<slug>/` zawiera całą specyfikę danej gry: deklaracje, mapy, assety, opcjonalne mechaniki.
- `src/app/` odpowiada za katalog gier, wybór i uruchomienie tytułu.
- W kodzie silnika **nie używaj warunków po `gameId`**, nazwie bohatera, konkretnej mapie lub fabule.
- Publiczne interfejsy muszą być typowane. Dane z plików JSON przechodzą walidację przy ładowaniu z komunikatem diagnostycznym.
- Preferuj kompozycję prostych zachowań (ruch, skok, zbieranie, patrol, trigger) zamiast od razu projektować pełny ECS lub edytor no-code.
- Dane poziomów nie mogą wykonywać dowolnego JavaScript. Do zdarzeń stosuj zamknięty, rejestrowany katalog akcji i warunków.
- Gameplay powinien działać niezależnie od szybkości klatek; pracuj na czasie delta i zachowaj kontrolę nad pauzą/wznowieniem.
- Zapis lokalny ma być wersjonowany i odseparowany przestrzenią nazw `gameId`. W razie uszkodzenia danych aplikacja nie może się wywracać.

## Stała reguła: sterowanie bez pisanych podpowiedzi

**Wyjątek zatwierdzony przez użytkownika 2026-11-14 — Winobranie RTS:** dodaj
krótkie, kontekstowe komunikaty mówiące, co warto zrobić w bieżącej sytuacji.
Jeden zwijany panel „Co teraz?” pokazuje cel, następny krok albo przyczynę
blokady; może wskazać obiekt kamerą. Bez modalnego samouczka, zatrzymywania
gry i obowiązkowego przeklikiwania. Treść wynika z aktualnego stanu także po
wznowieniu, nie z kolejki dawno zakończonych zdarzeń. Ten wyjątek ma
pierwszeństwo nad zakazami poniżej; pozostałe gry zachowują dotychczasowe UX.

**Obowiązuje wszystkie gry i demo PixelForge od M0.** Gracz nie dostaje żadnych tekstowych instrukcji sterowania, samouczków, dymków typu „Naciśnij Shift”, opisów zagadek, strzałek z podpisami ani pop-upów objaśniających mechanikę. Nie dodawaj także ekranu z listą klawiszy. Mechanikę poznaje przez układ poziomu, animację, reakcję świata, dźwięk i obrazowe symbole. Krótkie nazwy menu i tytuł gry są dopuszczalne, ale nie mogą być instrukcją ani warunkiem rozwiązania zagadki.

**Wspólny schemat klawiszy na desktopie:**

- `←/→` lub `A/D`: ruch poziomy; `↑/↓` lub `W/S`: ruch pionowy tylko w gatunkach, które go wymagają.
- `Spacja`: skok podczas platformówki; na ekranie startu/wyniku potwierdzenie lub ponowne rozpoczęcie, gdy nie ma skakania.
- `Shift`: jedna kontekstowa akcja, np. użyj, podnieś, pociągnij lub włącz/wyłącz przełącznik. **Krótkie naciśnięcie**, a nie przytrzymywanie, jeśli akcja ma zmienić stan. Brak konieczności używania osobnego przycisku dla każdej zagadki.
- `Esc`: pauza/wznowienie; z menu powrót bez niezamierzonej utraty postępu.
- `Enter`: opcjonalne potwierdzenie w menu (równoważne Spacji). `R`: restart dopiero w stanie porażki lub w menu, żeby nie zresetować przypadkowo rozgrywki.
- Nie wymagaj kombinacji klawiszy, skrótów wieloklawiszowych ani znajomości niestandardowych bindów. Nie wykorzystuj Shifta równocześnie do sprintu i interakcji.
- InputService expose'uje akcje semantyczne, a nie klawisze; jedna gra może mieć dodatkową akcję, ale tylko wtedy, gdy gracz odkrywa ją intuicyjnie, a podstawowe sterowanie pozostaje niezmienione.
- Dotyk: przyciski **ikonowe bez podpisów** o tych samych znaczeniach, odpowiednio duże i wygodne; nie używaj wirtualnego przycisku Shift z napisem „Shift”.

Projektuj pierwsze 30–60 sekund każdego tytułu jako **niewerbalną naukę**: bezpieczna przestrzeń, intuicyjne czynności wykonywane myszą, widoczny reagujący obiekt i bezkarna możliwość ponowienia. Dla nowych gier symulacyjnych nie zakładaj skakania. Element interaktywny wyróżnia się animacją, światłem, ruchem lub dźwiękiem po zbliżeniu. Działanie przełącznika musi dawać natychmiastowy, wyraźny sygnał wizualny i dźwiękowy, również przy jego wyłączeniu. Nie stosuj zagadek polegających na odgadnięciu niepokazanego skrótu.

**Kryterium odbioru:** osoba bez instrukcji przechodzi pierwszą scenę i odkrywa niezbędne działania na podstawie zachowania świata. Testuj to w M2 na osobie, która nie zna projektu. Tekst diagnostyczny widoczny wyłącznie podczas developmentu i komunikaty techniczne w razie krytycznego błędu nie są wskazówkami gameplayowymi.

## Jakość i UX

- Pixel art bez rozmycia. Rozdzielczość **viewportu** może nadal wynosić 320 × 180, lecz **rozmiar świata** jest niezależny, dla nowych gier minimum 4096 × 4096 z kamerą, chunkami i płynnym zoomem.
- Pełna obsługa klawiatury i przygotowana abstrakcja pod dotyk/pada. Dotykowe sterowanie podstawowe w MVP.
- Gry muszą mieć pauzę, restart, wyciszenie, czytelny cel przedstawiony wizualnie i ekran końca. **Nie pokazuj ekranów tutorialowych.** Krótkie wskazówki w Winobraniu RTS są dozwolone zgodnie z wyjątkiem powyżej; pozostałe gry zachowują naukę bez pisanych podpowiedzi.
- Nawet demo powinno wyglądać spójnie: ograniczona paleta barw, animowany bohater, tło, podstawowe efekty i dźwięki. Nie zostawiaj surowych prostokątów debugowych jako finalnej oprawy.
- Możliwość uruchomienia na Windows w przeglądarce i na smartfonie. Bez stałego połączenia z backendem.
- Nie dodawaj reklam, analityki, zbędnych uprawnień, zewnętrznych fontów pobieranych w runtime ani elementów naruszających prawa autorskie.

## Testy wymagane na każdym etapie

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Po dodaniu demonstracji: `npm run test:e2e` obejmujący start gry, ruch, interakcję, przejście poziomu, pauzę i zapis/wznowienie. W Winobraniu RTS sprawdź aktualność, zwijanie i wskazywanie komunikatów; w pozostałych grach zachowaj test braku tekstów instruktażowych.
- Sprawdź obsługę błędnej konfiguracji, brakującego assetu, odświeżenia strony i zapisu uszkodzonego JSON.
- Zapisuj ograniczenia testów ręcznych; nie udawaj, że testy wykonano, jeśli środowisko na to nie pozwala.

## Zakaz przedwczesnego rozbudowywania

Nie buduj kont użytkowników, chmury zapisów, multiplayera, sklepu, systemu pluginów instalowanych z internetu, rozbudowanego ECS ani ogólnego edytora grafiki. **Wyjątek:** nowa strategia Winobranie RTS ma wprost zatwierdzone budowanie, zakup parcel i 30-minutową kampanię; te funkcje rozwijaj etapami W1–W4, nie interpretuj starego zakazu MVP jako zakazu tworzenia tej gry.

W0 określiło kontrakty i plan. Następnie powstaje jeden grywalny vertical slice W1; dopiero po jego odbiorze kolejny zakres.

## Następne polecenie dla Codexa

> Przed kolejnym zleceniem przeczytaj `docs/ROADMAP.md`, `docs/WINOBRANIE-RTS.md`, `docs/WINOBRANIE-RTS-IMPLEMENTATION.md` i `docs/W0-REPORT.md`. W0 i implementacja W1 są zakończone. Sprawdź raport W1 oraz jego PR; poprawki W1 prowadź na tej samej gałęzi. W2 zostało osobno zlecone i jest zaimplementowane na `feature/w2-winobranie-seasons`. Przeczytaj raport W2 i jego PR; poprawki prowadź na tej samej gałęzi. W3 zostało następnie zlecone: „Rób nowy zakres”; sprawdź `docs/W3-REPORT.md` i jego PR. Nie rozpoczynaj samodzielnie W4. Starego Winobrania ani Leśnego sygnału nie rozwijaj. Bez automatycznego merge lub instalacji na hostingu.
