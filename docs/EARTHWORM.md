# Życie Dżdżownicy — Pod powierzchnią

Aktualna koncepcja, wybrana przez użytkownika 13 listopada 2026: **pionowy przekrój
gleby z boku**. Zastępuje widok z góry i finał oparty na dwunastu korzeniach
z wydania 0.7.0. Klient `earthworm` pozostaje oddzielony od silnika.

## Świat i cel

Świat ma 4096 × 4096 px. Powierzchnia jest na wysokości 384 px. Rośliny rosną
nad nią, a ich korzenie widać w ziemi. Dżdżownica porusza się w obu osiach,
dzieląc świat na trwałe tunele. Nie obowiązuje grawitacja platformówki:
bohater drąży również pionowo. Nie może wyjść w niebo ani przejść przez skałę.

Cel to **300 punktów i osiągnięcie dorosłości w gnieździe**. Samo odżywienie
korzeni nie kończy gry. Etapy rozwoju przy 80, 160 i 240 punktach wydłużają
ciało, zwiększają prędkość, pojemność zapasu i tolerancję zanurzenia.
Dorosła postać ma osobną końcową fazę wzrostu. Po zdobyciu wymaganych punktów
powrót do pierwszego lub odblokowanego głębokiego gniazda i interakcja
uruchamia czterosekundowy finał. Podczas finału obrażenia i symulacja zasobów
są zatrzymane.

| Odkrycie lub działanie                    |            Punkty |
| ----------------------------------------- | ----------------: |
| Pierwsze zjedzenie zwykłej larwy          |                 3 |
| Pierwsze zjedzenie złotej larwy           |                 8 |
| Odżywienie korzenia                       |                12 |
| Nowa porcja użyźnionej gleby              | 1, maksymalnie 24 |
| Pierwsze wejście w kolejną warstwę        |                10 |
| Odblokowanie glinianego zatoru            |                20 |
| Odprowadzenie małej dżdżownicy do gniazda |                30 |
| Odkrycie skarbca w zalanej komorze        |                30 |
| Odżywienie całej głębokiej grzybni        |                30 |
| Odnalezienie bursztynu                    |                 8 |

Punkty wynikają ze zwalidowanego postępu. Nie ma licznika, który rośnie za
samo czekanie. Larwy odnawiają się po 75 sekundach, ale kolejne zjedzenie
tego samego osobnika odnawia tylko zasoby. Przejazd po istniejącym tunelu
nie nalicza nowej gleby. Punkty za przygody i bursztyny są jednorazowe.

## Gleba, woda i zagrożenia

Pięć warstw ma własną paletę. Głębiej drążenie jest wolniejsze, utrata wilgoci
większa, a drapieżniki wykrywają bohatera z większej odległości. Gotowe tunele
przyspieszają podróż. Segmenty podążają za głową, bez kolizji ciała z samym sobą.

Na mapie są 112 larw, 12 korzeni, wilgotne kieszenie, dziewięć chrząszczy
i mrówek oraz osiem bursztynów. Larwa daje dwie porcje pokarmu i trochę
wilgoci. Początkowy zapas mieści sześć porcji, potem osiem i dziesięć.
Pełny zapas nie usuwa pokarmu. Przy nowych tunelach dżdżownica okresowo
zużywa porcję na użyźnienie gleby; blisko korzenia odżywia go co pół sekundy.
Pierwszy korzeń wymaga trzech porcji, kolejne czterech. Użyźnione komórki
zachowują swój stan w zapisie. Rośliny na powierzchni reagują wzrostem.

Pogoda ma cykl 180 sekund: rosa, deszcz, słońce i wieczór. Deszcz wsiąka
z prędkością 35 px/s. Góra może już wyschnąć, gdy wilgoć dopiero dociera
w głąb. Nie trzeba czekać na pogodę, aby ukończyć wyprawę: dostępne są też
stałe kieszenie wilgoci, odżywione korzenie i gniazda. To dyskretny model
wilgoci według głębokości, nie symulacja cieczy w każdym tunelu.

W zalanej komorze spada zapas powietrza. Dwie widoczne kieszenie powietrzne
pozwalają odetchnąć i zaplanować dalszy ruch. W ostatnim etapie rozwoju
oddech wystarcza na dłużej. Zwinięcie chroni przed chrząszczem lub mrówką
i oszczędza wilgoć, ale nie pozwala oddychać pod wodą.

Atak poprzedza widoczny sygnał. Utrata wilgoci, powietrza lub kontakt
z atakującym drapieżnikiem zabiera życie i przenosi do bezpiecznego punktu.
Trzy stracone życia oznaczają porażkę. Odżywiony korzeń przywraca jedno życie,
a odpoczynek w gnieździe uzupełnia zasoby. Eskortowane dziecko po obrażeniu
wraca do swojej kryjówki, więc obrażenia nie skracają misji eskortowej.

## Cztery przygody

1. **Spragniony korzeń.** Za glinianym zatyczkiem widać wodę. Trzy krótkie
   interakcje kruszą zator. Otwarta szczelina staje się źródłem wilgoci i ożywia trzeci korzeń.
2. **Zagubiona mała dżdżownica.** Odnaleziony maluch podąża za końcem ciała.
   Nagrodę daje bezpieczny powrót do pierwszego gniazda.
3. **Zalana komora.** Skarbiec leży za wodą. Trzeba wykorzystać kieszenie
   powietrzne i wrócić na suchą ziemię; skarb nie blokuje dalszej gry.
4. **Światła w głębi.** Cztery grzybnie potrzebują po jednej porcji pokarmu.
   Kolejne światła wskazują drogę i otwierają głęboką oazę z nowym punktem
   powrotu oraz drugim miejscem zakończenia dorastania.

Te opisy są dokumentacją dla autora. W grze nie ma napisanych zadań,
listy klawiszy ani instrukcji rozwiązań. Odkrycia sygnalizują obrazy, odgłosy,
pulsowanie obiektów, symbole, zmiana koloru i mapa przekroju. Pierwsza scena
jest bezpieczna i zawiera gniazdo, larwy, wilgoć oraz widoczny korzeń.

## Sterowanie i zapis

- Kliknięcie lub dotknięcie gleby ustawia cel; przeciąganie prowadzi bohatera.
- Kliknięcie wyróżnionego obiektu prowadzi do niego i wykonuje jedną akcję.
- WASD/strzałki oraz ikonowy krzyżak sterują kierunkiem.
- Krótki Shift, przycisk pierścienia lub dotknięcie głowy wykonują akcję
  pobliskiego obiektu; poza nim przełączają zwinięcie. Przytrzymanie nie powtarza akcji.
- Kółko i przyciski zmieniają zoom. Prawy/środkowy przycisk przesuwa kamerę.
  Minimapą można obejrzeć dowolny fragment, a celownik wraca do bohatera.
- Escape, przycisk pauzy i utrata fokusu zatrzymują grę. Restart jest w menu.

Nowy zapis: **`pixelforge:client:v3:earthworm`**. Zachowuje tunele, użyźnioną glebę,
zasoby, czas pogody, korzenie, rozwój, przygody, checkpoint i drapieżniki.
Powstaje przy postępie, pauzie, wyjściu i co dziesięć sekund. Nie nadpisuje
`pixelforge:client:v1:earthworm` z gry 0.7.0 ani kluczy Atlasu. Poprzednia mapa
ma inną geometrię i zasady; nowa przygoda zaczyna się od własnego gniazda.
Rollback pozwala ponownie odczytać stary zapis, a ponowna instalacja 0.8.0 — nowy.
Uszkodzone dane są odrzucane atomowo. Brak localStorage daje komunikat techniczny.

## Architektura, grafika i wydanie

Cała specyfika gleby i przygód jest w `src/games/earthworm/`. Klient korzysta
z publicznego kontraktu silnika, wspólnego wejścia, audio, pauzy, scen ładowania,
`MutableGrid`, `MutableTerrainRenderer` i `VersionedSave`. Mapa, mierniki i symbole
w aplikacji dostają generyczne dane. Silnik nie rozpoznaje identyfikatora gry.

Komórka gleby ma 8 px, sektor 256 px. Renderer trzyma tylko widoczne sektory
i zwalnia opuszczone. Statyczna siatka kolizji zajmuje 256 KiB przy mapie 4096²;
nie jest teksturą. Nie ma tekstury całego świata ani pełnego A* w runtime.
Symulacja pracuje w stałym kroku 50 Hz. Ruch, pogoda i zasoby zatrzymują się przy pauzie.

Nowe ilustracje postaci, roślin i podziemnych mieszkańców są zapisane w atlasach.
Filtrowanie NEAREST i wyrównanie kamery zachowują ostre krawędzie. Zmniejszony ruch
ogranicza efekty ozdobne. `npm run assets:earthworm` odtwarza tylko świat JSON;
nie nadpisuje ilustracji. Pochodzenie grafik opisuje licencja w katalogu zasobów.

Wydanie `pixelforge-0.8.0-full.zip` aktualizuje całą aplikację przez istniejący
panel U2. PHP nie jest częścią samej gry. Pierwsza instalacja ma osobny ZIP
`pixelforge-public-html-0.8.0-installer-1.2.0.zip`; układ public_html i instalator
pozostają zgodne z poprzednim wydaniem. [Instrukcja paczek](../downloads/README.md).

Celem projektu nadal jest 20–35 minut pierwszego przejścia. To wymaga pomiaru
z nowym graczem: automatyczna trasa zna wszystkie położenia, nie ocenia czytelności
ani przyjemności rozgrywki i nie stanowi pomiaru czasu człowieka.
