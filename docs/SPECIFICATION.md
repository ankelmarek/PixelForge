# PixelForge — specyfikacja techniczna i funkcjonalna

**Status:** dokument bazowy dla Codexa. **Repozytorium:** ankelmarek/PixelForge. **Wersja założeń:** 0.1.

## 1. Wizja produktu

PixelForge to **framework autorski nad Phaser 4**, a nie zupełnie nowy renderer/fizyka. Pozwala stworzyć wiele niezależnych, niedużych gier przeglądarkowych w pixel art z jednego współdzielonego zestawu mechanik.

**Docelowa gra**: około 20–35 minut zabawy, 4–6 etapów o zróżnicowanej trudności, prosty cel i fabuła, ekran zwycięstwa oraz możliwość powtórnego uruchomienia. Czas jest celem projektowym, a nie sztucznym ogranicznikiem zegarowym. Rzeczywistą długość potwierdzają playtesty.

**Demo walidacyjne**: około 5–8 minut, 2–3 krótkie mapy, widoczna jakość grafiki i kompletny przepływ start -> gra -> cel -> wygrana. Jego zadaniem jest zweryfikowanie architektury i UX, nie wypełnienie docelowych 30 minut.

Na początku obsługujemy platformówki 2D. Przygody top-down po pierwszej grze i walidacji współdzielenia modułów. Inne gatunki (puzzle, arcade, wyścigi, symulacje) dopiero w kolejnych etapach.

## 2. Technologia i uruchamianie

- **Phaser 4.2.1** jako biblioteka renderowania, kamery, obsługi tekstur, animacji, dźwięku i fizyki Arcade.
- **TypeScript strict + Vite**, moduły ESM.
- **Vitest**, **ESLint**, **Prettier**, **Playwright** do smoke testów.
- Node.js LTS; jedno repozytorium i jeden pakiet npm w MVP, bez monorepo.
- Statyczne pliki HTML/CSS/JS/JSON/PNG/WebP/OGG; **brak backendu, bazy, kont i zewnętrznego API**.
- Publikacja ma działać zarówno pod domeną, jak i ścieżką bazową (np. /PixelForge/). Nie hardkoduj ścieżek zaczynających się od "/".
- Docelowe systemy: desktop Chrome, Firefox, Edge oraz przeglądarki mobilne Android/iOS. Jeśli dana przeglądarka nie została przetestowana, zaznacz to jawnie.

## 3. Architektura katalogów (docelowa dla MVP)

```text
PixelForge/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── assets/
│       └── games/
│           └── forest-demo/
│               ├── images/
│               ├── audio/
│               └── levels/
├── src/
│   ├── app/                  # katalog/launcher, ekran wyboru i uruchamianie gier
│   ├── engine/
│   │   ├── api/              # typy i kontrakty dostępne dla gier
│   │   ├── core/             # host, cykl życia, scene routing, services
│   │   ├── components/       # proste, kompozycyjne zachowania
│   │   ├── systems/          # input, audio, save, event, asset, progress
│   │   ├── scenes/           # boot, preload, menu, gameplay, pause, results
│   │   └── ui/               # wspólne komponenty nakładki UI
│   ├── games/
│   │   ├── registry.ts       # rejestr tytułów
│   │   └── forest-demo/
│   │       ├── index.ts      # GameDefinition
│   │       └── rules.ts      # opcjonalne zarejestrowane zasady
│   ├── styles/
│   └── main.ts
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/
    ├── SPECIFICATION.md
    └── ROADMAP.md
```

To docelowy układ logiczny. Codex może uściślić nazwy, zachowując wyraźny podział na silnik, konkretną grę i aplikację startową.

**Kierunek zależności:** `app -> engine API`, `app -> games/registry`, `games/* -> engine/api`; nigdy `engine -> games/*`. Jeśli engine wymaga zachowania z konkretnej gry, dostaje je przez rejestrację zachowań/interfejs.

## 4. Model silnika

Silnik oferuje:

1. **EngineHost**: tworzy i niszczy instancję Phaser, ładuje wybraną grę i izoluje stan między uruchomieniami.
2. **GameDefinition**: deklaruje ID, tytuł, typ, wersję formatu, rozmiar logiczny, assety, poziomy, reguły.
3. **LevelDefinition**: opisuje geometrię, warstwy, obiekty, punkty wejścia, aktywatory i warunek ukończenia.
4. **SceneFlow**: boot, preload, tytuł, wybór poziomu (opcjonalny), gameplay, pauza, zwycięstwo, porażka, zakończenie.
5. **InputService**: mapuje klawiaturę i dotyk na akcje `left/right/up/down/jump/interact/pause/confirm`; zachowuje stały układ klawiszy opisany w sekcji 7.1; mechaniki nie odwołują się bezpośrednio do klawiszy.
6. **EntityFactory + Behaviors**: tworzy obiekty ze złożonych zachowań, np. move, jump, patrol, collectible, damageable, trigger, door, checkpoint.
7. **RuleSystem**: obsługuje predefiniowane warunki i akcje bez `eval`, `new Function` ani uruchamiania kodu z JSON.
8. **ProgressService**: prowadzi stan gry, cele, punkty kontrolne i informacje o ukończeniu.
9. **SaveService**: localStorage, wersjonowane rekordy osobno dla każdego gameId, walidacja odczytu i bezpieczny reset uszkodzonego rekordu.
10. **AudioService**: muzyka i SFX, wyciszenie, rozsądne głośności, odblokowanie audio po pierwszej interakcji.
11. **UISystem**: nakładka, punkty życia, sygnały wizualne, pauza i ekran końca; bez pisanych podpowiedzi sterowania i samouczków.

Początkowo nie implementuj pełnego systemu encja–komponent–system. Wystarczą kompozycyjne zachowania oraz małe, testowalne serwisy.

## 5. Kontrakt gry i danych

Każda gra deklaruje publiczny obiekt `GameDefinition` i jest widoczna w rejestrze. Docelowy format manifestu może wyglądać tak:

```json
{
  "schemaVersion": 1,
  "id": "forest-demo",
  "title": "Tajemnice Lasu",
  "genre": "platformer",
  "viewport": { "width": 320, "height": 180 },
  "firstLevel": "forest-01",
  "levels": ["forest-01", "forest-02", "forest-03"],
  "targetDurationMinutes": 7,
  "assetsBasePath": "assets/games/forest-demo/"
}
```

Ten przykład to **kontrakt kierunkowy**, nie żądanie tworzenia identycznych nazw pól. Codex ma w M0 zaproponować minimalną wersję i zapewnić spójność schematu z runtime i walidacją.

Poziomy opisuj w JSON, najlepiej z warstwami kompatybilnymi z eksportem Tiled: warstwa tła, kolizji, dekoracji i obiektów. Obiekt ma `type`, `id`, pozycję, parametry i zarejestrowane zachowania. Mapy mogą zawierać powiązane zdarzenia, np.:

```json
{
  "id": "exit-door",
  "type": "door",
  "x": 280,
  "y": 120,
  "properties": {
    "requires": { "allFlags": ["key-collected", "lever-on"] },
    "onInteract": "completeLevel"
  }
}
```

Parser MUSI odrzucać nieznane akcje z czytelnym błędem; sam JSON nie może deklarować arbitralnego JavaScript.

**Dwie ścieżki rozszerzalności:**

- 80% zwykłych gier budujemy z konfiguracji, gotowych zachowań i poziomów.
- Nietypowa mechanika powstaje jako moduł TS implementujący stabilny interfejs rejestrowany przez grę, bez zmian rdzenia.

W M0/M1 wystarczy jeden przykład mechaniki rozszerzalnej i dokumentacja, jak dodać nowy typ zachowania.

## 6. Rozgrywka i system poziomów

### Platformówka w MVP

- Ruch poziomy, przyspieszenie/hamowanie, skok, grawitacja, lądowanie.
- Kolizje z mapą, skok na platformy, strefy obrażeń i punkt odrodzenia.
- Jeden typ prostego przeciwnika patrolującego teren; kontakt zabiera życie z okresem nietykalności.
- Życia, przedmioty kolekcjonerskie, przełącznik, drzwi, checkpoint i wyjście z poziomu.
- Zadania i aktywatory niezależne od nazw konkretnych obiektów.
- Po przejściu poziomu zapis postępu; po wyczerpaniu żyć ekran porażki z opcją ponowienia.
- W finalnym demo: 2–3 różne etapy i jedno proste wyzwanie finałowe.

### Rozszerzenie top-down po MVP

- Poruszanie się w czterech kierunkach, kolizje, interakcja z NPC/przedmiotem, prosty klucz/zamek.
- Wspólne z platformówką pozostają: definicje gier, sceny, UI, input, zapis, audio, trigger system, assets i cel poziomu.
- Dodanie top-down nie może wymagać rozbijania działającej platformówki.

## 7. Oprawa i ergonomia

- Bazowy viewport **320 × 180** i skalowanie z zachowaniem proporcji; preferuj skale całkowite, a w ciasnych viewportach bezpieczny fallback bez rozmazywania.
- Użyj `pixelArt` / `roundPixels` lub odpowiednika Phaser 4. Tekst i HUD muszą być czytelne na telefonie; UI HTML może skalować się niezależnie od canvasa.
- Minimum trzy warstwy wizualne w demie: dalekie tło, teren i dekoracje przednie.
- Animowany sprite gracza: idle, run, jump, hit; przeciwnik: idle/patrol/hit.
- Drobne efekty cząsteczkowe lub animowane detale, ale ogranicz przeciążenie i migotanie. Respektuj preferencję reduced motion, jeśli możliwe.
- Dźwięki: skok, zbieranie, obrażenia, sukces; muzyka z opcją wyciszenia. Odtwarzanie audio po geście użytkownika.
- Wspólne UI: ekran tytułowy, pauza, restart, wynik i zakończenie, ale **bez ekranu instrukcji sterowania i tekstowych wskazówek**. Na małych ekranach obszary dotykowe mają być duże, ikonowe i czytelne.
- Dopuszczalne nazwy menu, tytuły i komunikaty techniczne przygotuj do lokalizacji (polski jako język początkowy). Nie wykorzystuj tekstów do tłumaczenia mechanik, sterowania ani rozwiązań zagadek.

### 7.1. Zasada nadrzędna: nauka bez słów i wspólna klawiszologia

**Żadnych pisanych wskazówek podczas rozgrywki.** Zabronione są tekstowe samouczki, podpowiedzi kontekstowe, instrukcje „Naciśnij…”, plansze z klawiszologią, opisowe dymki, zadania wyjaśniane tekstem lub wskazówki do zagadek. Gracz rozumie świat poprzez kompozycję scen, zachowanie obiektów, animacje, kolory, dźwięki i konsekwencje własnych działań. Krótkie tytuły i etykiety menu mogą pozostać; nie mogą zastępować nauki mechaniki.

**Stałe przypisanie sterowania, wspólne dla wszystkich gier:**

| Akcja                                     | Komputer                                                 | Dotyk                       |
| ----------------------------------------- | -------------------------------------------------------- | --------------------------- |
| Ruch                                      | strzałki lub WASD                                        | ikonowy krzyżak / kierunki  |
| Skok                                      | Spacja                                                   | ikonowy przycisk skoku      |
| Interakcja, aktywacja, przełącznik ON/OFF | Shift, pojedyncze naciśnięcie                            | ikonowy przycisk działania  |
| Pauza / wznowienie                        | Esc                                                      | ikona pauzy / odtwarzania   |
| Potwierdzenie w menu                      | Spacja lub Enter                                         | dotknięcie elementu         |
| Ponowienie po porażce                     | Spacja lub Enter; ewentualnie R tylko na ekranie porażki | ikonowy przycisk ponowienia |

W grach top-down ruch w czterech kierunkach zastępuje skok; akcje pozostają spójne semantycznie. W platformówce Shift nie uruchamia sprintu. Nie wymagaj skrótów złożonych, długiego przytrzymywania Shifta ani wprowadzania wielu nowych przycisków. Naciśnięcie przełącznika działa jako _toggle_ i musi wyraźnie zmienić wygląd obiektu. Niech początkowe 30–60 sekund bezpiecznie pokaże przepaść do przeskoczenia, reagujący przedmiot i efekt uruchomienia przełącznika, bez choćby jednego słowa instrukcji.

**Rozpoznawalność interakcji:** obiekt, który reaguje na Shift, delikatnie pulsuje/rozświetla się, animuje przy zbliżeniu bohatera lub wydaje krótki dźwięk. Po akcji rezultat jest natychmiast widoczny (np. przełącznik zmienia pozycję, drzwi się otwierają, rozbłyska światło). Nie każ graczowi domyślać się niewidocznych klawiszy.

**Dostępność:** znaczniki dostępności HTML dla screen readerów i wewnętrzna dokumentacja deweloperska mogą opisywać funkcje kontrolek, ale nie pokazuj tych opisów jako podpowiedzi w samej grze. Zapewnij wyraźny focus menu, podstawowe działania na dotyk i możliwość wyciszenia.

**Test akceptacyjny:** obserwuj osobę, która nie zna klawiszologii projektu i nie otrzyma instrukcji. Powinna samodzielnie odkryć najważniejsze akcje w pierwszej scenie. Jeśli nie, popraw projekt otoczenia lub reakcje obiektów, a nie dodawaj tekst.

## 8. Stan i zapis

Przykładowe pola: `schemaVersion`, `gameId`, `gameVersion`, `levelId`, `checkpointId`, `flags`, `collectibles`, `lives`, `elapsedSeconds`, `completed`, `updatedAt`.

Nie zapisuj co klatkę. Zapisuj po checkpointach, wyjściu z etapu i ważnych interakcjach; obsługuj sytuacje niedostępnego localStorage. Zapisy różnych tytułów nie mogą się nadpisywać. Zapewnij przycisk rozpoczęcia nowej gry oraz wznawiania. Zadbaj o politykę migracji formatu: minimum rozpoznanie wersji i bezpieczny fallback.

## 9. Wymagania niefunkcjonalne

- **Dostępność:** użyteczne oznaczenia kontrolek, focus w menu, bez konfliktów z klawiszami przeglądarki, wyciszenie. Nie blokuj strony przewijaniem, gdy gra nie ma focusu.
- **Wydajność:** cel 60 FPS na typowym desktopie i stabilne 30+ FPS na przeciętnym telefonie; zmierz rzeczywistą wydajność podczas testów, nie deklaruj jej bez pomiaru.
- **Zasoby:** grafiki skompresowane bez niszczenia ostrości pixel art, atlas sprite'ów gdy ma to sens, ładowanie tylko zasobów wybranej gry.
- **Błędy:** brak assetu, niepoprawna mapa lub wadliwy zapis nie mogą powodować niezrozumiałego czarnego ekranu; pokaż komunikat i możliwość powrotu.
- **Bezpieczeństwo:** brak wykonywania kodu z konfiguracji, brak sekretów w repozytorium, brak telemetrii bez zgody, brak naruszania licencji assetów.
- **Publikacja:** statyczne `dist/`, poprawne ścieżki podkatalogu, czytelne wersjonowanie gry i silnika.
- **Dostęp offline:** silnik nie potrzebuje backendu. PWA i pełne cachowanie offline to osobny, przyszły etap.

## 10. Kontrakty testowania

1. Test parsera pozytywnej i błędnej definicji gry/poziomu.
2. Test zasad: zebranie przedmiotu ustawia flagę; otwarcie drzwi wymaga warunku; zakończenie etapu zapisuje postęp.
3. Test odczytu zapisu poprawnego, niezgodnego wersją i uszkodzonego.
4. Test izolacji gameId oraz restartu nowej sesji.
5. Smoke e2e: wybór demonstracji, start, ruch, kolizja, interakcja, pauza/wznowienie, checkpoint, zwycięstwo i ponowne wejście.
6. Ręczne testy mobilne: orientacja, sterowanie dotykowe bez napisów, ekran pauzy, wyciszanie, czytelność i zrozumiałość interakcji bez podpowiedzi tekstowych.
7. Build pod domenę główną i nie-root base path.
8. W drugim etapie test niezależności: druga gra wykorzystuje wspólne usługi bez edycji `src/engine`.

## 11. Czego świadomie nie robimy teraz

Brak edytora poziomów w pierwszej wersji, multiplayera, achievementów online, statystyk globalnych, monetyzacji, kont, chmury, AI w runtime, skomplikowanego skryptowania, systemu DLC i infrastruktury serwerowej. Przyszły **PixelForge Studio** zaczyna się od katalogu gier i prostego podglądu, a nie rozbudowanego panelu administracyjnego.

## 12. Definicja powodzenia

Projekt jest technicznie sensowny, gdy da się dodać drugą grę, modyfikując wyłącznie jej katalog, rejestr i ewentualnie **publiczny kontrakt rozszerzenia** (bez zmiany implementacji rdzenia). Jeżeli dodanie prostej gry wymaga kopiowania `GameplayScene`, całego menu lub SaveService, architektura nie spełnia celu i należy ją poprawić przed budową edytora.

**Kolejność prac, bieżący zakres i warunki odbioru opisuje [ROADMAP.md](./ROADMAP.md).**
