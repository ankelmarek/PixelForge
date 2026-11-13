# Życie Dżdżownicy — P3

Wybór użytkownika: 13 listopada 2026. Pierwsza grywalna wersja, identyfikator
`earthworm`, własny katalog `src/games/earthworm/`. Opiera się na zaakceptowanej
koncepcji z archiwalnej roadmapy: sterowanie myszą, drążenie tuneli, pokarm,
wilgotność, krety i cykl pogodowy. Nie rozwija historycznych gier.

## Rozgrywka

Świat 4096 × 4096 to widok z góry na glebę pod ogrodem. Segmentowe ciało podąża
za głową. Przejście zostawia trwały tunel; istniejące korytarze przyspieszają ruch.
Skały i brzeg świata zatrzymują głowę. Ciało nie koliduje samo ze sobą.

Cztery ogrody zawierają po trzy korzenie. Dżdżownica zbiera ściółkę i przenosi
materię organiczną do roślin, które rozkwitają. Dwanaście rozkwitów kończy wyprawę
i tworzy sieć wydrążonych po drodze korytarzy. To pełny przepływ z początkiem,
rozwojem, wygraną, porażką i powtórzeniem; bez zegara blokującego ukończenie.

Pierwszy korzeń wymaga trzech porcji, dalsze czterech. Plecak mieści sześć porcji.
Pokarm odrasta po 75 sekundach; pełny plecak nie niszczy przedmiotu. Ruch nad
pokarmem zbiera go automatycznie, zatrzymanie przy korzeniu zasila roślinę.
Wilgoć poniżej 25 uniemożliwia zasilanie; barwa reakcji korzenia pokazuje stan.
Kałuże uzupełniają wilgoć. Rozkwitnięta roślina daje schronienie, wodę i checkpoint.

Pogoda wynika z postępu: rosa przy 0–2 rozkwitach, susza przy 3–5, deszcz przy
6–8 i wieczór przy 9–12. Dzięki temu cykl nie wymaga sztucznego czekania.
Krety patrolują także poza ekranem. Po pierwszym ogrodzie reagują na zbliżenie,
sygnalizują zagrożenie, następnie gonią. Zwinięcie ciała chroni przed atakiem
i ogranicza utratę wilgoci, ale zatrzymuje ruch oraz karmienie roślin.
Obrażenie lub wyschnięcie zabiera życie i odsyła do ostatniego korzenia.
Trzy utracone życia oznaczają porażkę. Rozkwit przywraca jedno życie.

Pierwsze 30–60 sekund: bezpieczny teren, widoczna ściółka, kałuża, zwiędły korzeń
z trzema pustymi symbolami. Brak instrukcji, tekstowych zadań i tutoriali.
Postęp prezentują rośliny, dźwięki, symbole i minimapa. Zrozumiałość bez pomocy
oraz docelowe 20–35 minut wymagają playtestu człowieka; automatyczny przejazd
nie jest pomiarem czasu potrzebnego nowemu graczowi.

## Sterowanie i zapis

Dokumentacja dla autora (tych opisów nie ma w rozgrywce):

- Kliknięcie/dotknięcie gleby ustawia cel. Przeciąganie prowadzi głowę.
- WASD/strzałki oraz ikonowy krzyżak na telefonie sterują kierunkiem.
- Shift, ikona pierścienia lub dotknięcie głowy przełącza zwinięcie.
- Kółko i przyciski zmieniają zoom. Prawy/środkowy przycisk przesuwa kamerę;
  minimapa pozwala obejrzeć dowolny fragment także dotykiem. Celownik wraca do bohatera.
- Escape i ikona pauzy zatrzymują grę. Utrata fokusu także pauzuje. Nowa gra
  jest dostępna w menu, aby przypadkowy klawisz nie kasował postępu.

Zapis `pixelforge:client:v1:earthworm` przechowuje pozycję, tunele, korzenie,
wilgoć, plecak, życia, czas, checkpoint i stan drapieżników. Powstaje przy zmianach
postępu, pauzie, wyjściu oraz co 10 sekund. Brak localStorage zgłasza komunikat
techniczny. Uszkodzone/obce dane są odrzucane bez awarii. Samo otwarcie menu
nie nadpisuje zapisu. Atlas zachowuje swoje dotychczasowe klucze.

## Granice silnika

Nowy publiczny kontrakt `ClientDefinition` rejestruje zaufany moduł TypeScript
przez `createRuntime`. EngineHost zarządza Phaserem, cyklem życia, wejściem,
pauzą, audio, skalowaniem i błędami. Klient wykorzystuje wspólny preload i scenę
tytułową, `VersionedSave`, `MutableGrid`, `MutableTerrainRenderer` oraz wyrównanie
kamery do siatki pikseli. Wspólny ekran aplikacji obsługuje menu, mierniki i mapę.
Rdzeń nie importuje gry i nie rozpoznaje jej identyfikatora. JSON nie wykonuje kodu.

Gleba używa komórek 8 px i sektorów 256 px. Zapis zawiera tylko zmiany.
Renderer utrzymuje tekstury sektorów widocznych przez kamerę, unieważnia zmienione
sektory i ich granice, usuwa tekstury opuszczonego obszaru. Nie ma tekstury
4096 × 4096 ani wyszukiwania ścieżek całej mapy w runtime. Ruch ma lokalne kolizje;
symulacja 50 Hz jest niezależna od FPS. Jednostki i zasoby poza kamerą nadal żyją.
Deterministyczny świat powstaje z lokalnego JSON i procedury gleby, bez sieciowego
serwisu. Ilustracje odtwarza `npm run assets:earthworm`.

## Wydanie

`pixelforge-0.7.0-full.zip` zawiera wspólny silnik, grę, Atlas oraz manifest U0.
To pełna aktualizacja aplikacji zgodna z U1 1.0.0 / U2 1.1.0, a nie ZIP samych
źródeł ani paczka dodatku do osobnego katalogu. Panel pozostaje poza buildem gry.
Aktualizator instaluje pliki pod tą samą ścieżką, zapisów przeglądarki nie zmienia.
Szczegóły dostarczenia: [downloads/README.md](../downloads/README.md).
