# AGENTS.md — stałe wytyczne dla Codexa

## Cel

Zbuduj **PixelForge**, modułowy silnik przeglądarkowych gier 2D w pixel art, umożliwiający tworzenie niezależnych, prostych gier o docelowej długości 20–35 minut. **Nie pisz jednorazowej gry pod nazwą PixelForge.** Najpierw zbuduj współdzielony runtime, następnie gry będące jego klientami.

Przed zmianami przeczytaj `README.md`, `docs/SPECIFICATION.md` i `docs/ROADMAP.md`. Decyzje w tych plikach są obowiązujące, dopóki użytkownik ich nie zmieni.

## Gałęzie i pull requesty

- `main` jest gałęzią stabilną. Dokumentacja bazowa może w niej pozostać, ale **implementacja kodu każdego etapu musi być wykonywana na osobnej gałęzi roboczej**.
- Pierwszy etap M0 realizuj na istniejącej gałęzi `feature/m0-engine-foundation`. Nie commituj kodu bezpośrednio do `main`.
- Kolejne etapy otrzymują oddzielne gałęzie `feature/m1-runtime`, `feature/m2-forest-demo` itd., tworzone z aktualnego `main` po zatwierdzeniu poprzedniego etapu.
- Na koniec etapu przygotuj pull request do `main` z podsumowaniem zmian, testami i kryteriami odbioru. Nie scalaj samodzielnie PR bez wyraźnej zgody użytkownika.
- Poprawki do aktywnego etapu dopisuj do jego gałęzi, bez tworzenia kolejnego PR na każdą drobną zmianę.

## Sposób pracy

1. Zacznij od etapu **M0** roadmapy. W jednym zadaniu realizuj tylko bieżący, niezamknięty etap lub wyraźnie wskazany zakres.
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
- Statyczny build, bez PHP, bazy SQL, logowania i serwera aplikacyjnego.
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

Projektuj pierwsze 30–60 sekund każdego tytułu jako **niewerbalną naukę**: bezpieczna przestrzeń, pierwszy niski próg do przeskoczenia, widoczny reagujący obiekt i bezkarna możliwość ponowienia. Element interaktywny wyróżnia się animacją, światłem, ruchem lub dźwiękiem po zbliżeniu. Działanie przełącznika musi dawać natychmiastowy, wyraźny sygnał wizualny i dźwiękowy, również przy jego wyłączeniu. Nie stosuj zagadek polegających na odgadnięciu niepokazanego skrótu.

**Kryterium odbioru:** osoba bez instrukcji przechodzi pierwszą scenę i odkrywa niezbędne działania na podstawie zachowania świata. Testuj to w M2 na osobie, która nie zna projektu. Tekst diagnostyczny widoczny wyłącznie podczas developmentu i komunikaty techniczne w razie krytycznego błędu nie są wskazówkami gameplayowymi.

## Jakość i UX

- Pixel art bez rozmycia, logiczna rozdzielczość startowa **320 x 180**; dopasowanie obrazu do dostępnego ekranu z zachowaniem proporcji.
- Pełna obsługa klawiatury i przygotowana abstrakcja pod dotyk/pada. Dotykowe sterowanie podstawowe w MVP.
- Gry muszą mieć pauzę, restart, wyciszenie, czytelny cel przedstawiony wizualnie i ekran końca. **Nie pokazuj instrukcji sterowania, ekranów tutorialowych ani podpowiedzi pisanych.**
- Nawet demo powinno wyglądać spójnie: ograniczona paleta barw, animowany bohater, tło, podstawowe efekty i dźwięki. Nie zostawiaj surowych prostokątów debugowych jako finalnej oprawy.
- Możliwość uruchomienia na Windows w przeglądarce i na smartfonie. Bez stałego połączenia z backendem.
- Nie dodawaj reklam, analityki, zbędnych uprawnień, zewnętrznych fontów pobieranych w runtime ani elementów naruszających prawa autorskie.

## Testy wymagane na każdym etapie

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Po dodaniu demonstracji: `npm run test:e2e` obejmujący start gry, ruch, interakcję, przejście poziomu, pauzę i zapis/wznowienie. Sprawdź także, że w gameplayu nie pojawiają się teksty instruktażowe.
- Sprawdź obsługę błędnej konfiguracji, brakującego assetu, odświeżenia strony i zapisu uszkodzonego JSON.
- Zapisuj ograniczenia testów ręcznych; nie udawaj, że testy wykonano, jeśli środowisko na to nie pozwala.

## Zakaz przedwczesnego rozbudowywania

W MVP NIE BUDUJ edytora drag-and-drop, kont użytkowników, chmury zapisów, multiplayera, sklepu, systemu pluginów instalowanych z internetu, rozbudowanego ECS, edytora grafiki, pełnej obsługi sześciu gatunków ani 30-minutowej gry komercyjnej.

Najpierw musi powstać jedna działająca gra demonstracyjna i czytelny interfejs umożliwiający dodanie następnej gry bez modyfikowania rdzenia.

## Pierwsze polecenie do wykonania

> Zapoznaj się z dokumentacją repozytorium PixelForge. Zrealizuj wyłącznie etap **M0** z `docs/ROADMAP.md`, zachowując separację silnika i danych gry. Utwórz uruchamialny szkielet i prototyp pętli rozgrywki, dodaj skrypty kontroli jakości, uruchom testy i opisz wynik. Nie przechodź automatycznie do M1.
