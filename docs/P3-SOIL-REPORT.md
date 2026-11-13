# P3 — Dżdżownica: Pod powierzchnią, wydanie 0.8.0

Gra została przebudowana zgodnie z nową koncepcją użytkownika: pionowy przekrój
gleby zamiast widoku z góry. Rośliny są nad powierzchnią, korzenie schodzą w dół,
a bohater drąży tunele, zjada larwy i użyźnia ziemię. Finałem jest zdobycie
300 punktów i osiągnięcie dorosłości w gnieździe.

## Zakres zmiany

- Świat 4096 × 4096, pięć warstw o odmiennej oprawie, wolniejsze drążenie
  i większe zagrożenia w głębi. Gotowe tunele ułatwiają powroty.
- 112 larw, 12 korzeni, dziewięć drapieżników, wilgotne kieszenie i osiem bursztynów.
- Deszcz przesiąka z opóźnieniem zależnym od głębokości. W zalanej komorze trzeba
  pilnować oddechu i korzystać z dwóch kieszeni powietrznych.
- Cztery przygody: gliniany zator odżywiający korzeń, odprowadzenie dziecka,
  podwodny skarbiec i odnowienie grzybni otwierające głęboką oazę.
- Punkty za pierwsze odkrycia i użyźnienie nowych komórek; ponowny pokarm
  nie pozwala zdobywać punktów w nieskończoność. Rozwój wydłuża ciało i zwiększa
  zapas, prędkość oraz tolerancję zanurzenia.
- Nowe atlasy postaci, owadów, roślin i podziemnych obiektów, ilustracja tytułowa,
  warstwy gleby, reakcje świata i efekty odkryć. Pochodzenie w licencji zasobów.
- Mysz, klawiatura i ikonowe sterowanie dotykowe. Jeden krótki sygnał interakcji,
  pełne okno, zoom, panorama, minimapa przekroju, pauza, wyciszenie i restart.
  Brak tekstowych instrukcji rozgrywki.

Nowe zasady są w `src/games/earthworm/`. Wspólna aplikacja obsługuje generyczne
symbole postępu, ikonę celu i obszary minimapy. Silnik nie importuje gry ani
nie ma warunków po jej identyfikatorze. Atlas, Winobranie i Leśny sygnał nie
otrzymały nowych mechanik. U3 i Studio pozostają poza zakresem.

## Zapis i aktualizacja

Nowy świat ma zapis `pixelforge:client:v3:earthworm`. Stary zapis v1 z 0.7.0
pozostaje bez zmian. Różna geometria i cel gry nie pozwalają uczciwie przenieść
starych tuneli do nowej mapy; nowa wyprawa zaczyna się osobno. Zapisy Atlasu
są zachowane. Wznowienie starej wersji po rollbacku korzysta z jej własnego klucza.

Mapa i okładka mają nowe nazwy `soil-world.json` i `soil-cover.png`, aby
przeglądarka nie podstawiła danych starego świata z pamięci podręcznej.
Stare zasoby i wcześniejsze ZIP-y pozostają niezmienione. Instalator/aktualizator
1.2.0 zachowuje własny kod, konto i konfigurację poza katalogiem gry.

## Weryfikacja

Wykonane lokalnie:

- `npm run lint`, `npm run typecheck`, `npm run build` — PASS.
- `npm test` — 69 Vitest + 15 testów pakietów U0 + 36 integracji PHP — PASS.
- `npm run test:hosting` — 12 testów na rzeczywistym Apache/mod_php/TLS — PASS.
- `npm run test:e2e` — 42 PASS, 2 celowe SKIP testów dotykowych w profilu desktop.
  Po zmianie nazw zasobów ponownie sprawdzono walidację i build; finalne ścieżki
  sprawdzają także testy wyodrębnionego ZIP-a i instalatora.
- Wśród powyższych: 20 testów logiki Dżdżownicy i 14 scenariuszy gry
  w Chromium desktop oraz emulacji Pixel 7.

Pełna trasa modelu używa rzeczywistego ruchu, zbierania zasobów, interakcji,
ukrywania się i kieszeni powietrznych. Nie teleportuje postaci i nie dopisuje
zasobów. Kończy wszystkie korzenie i cztery przygody, wraca do gniazda oraz
osiąga dorosłość: 516 punktów, 3 życia, 13 580 zmienionych komórek, około
504,58 sekundy symulacji. Trasa zna pozycje obiektów i nie mierzy czasu człowieka.

- `npm run test:updater:browser` — 8/8 PASS: obie mapy Atlasu, obie ścieżki
  hostingu, desktop i emulacja telefonu, instalacja oraz rollback.
- `npm run test:panel:browser` — PASS: desktop, emulacja telefonu oraz upload
  i odrzucenie paczki bez JavaScript.
- `npm run test:release:browser` — PASS: rzeczywisty ZIP 0.8.0 nad 0.6.1,
  rollback do 0.6.1, ponowna instalacja i wznowienie Dżdżownicy; zachowane
  zapisy i kamera Atlasu. [Wyniki instalatora](P3-SOIL-INSTALLER-BROWSER-RESULTS.json).
- `npm run test:hosting:browser` — 3/3 PASS: konfiguracja i chroniony katalog
  z HTTP 403, aktualizacja testowa i rollback, desktop/mobile/no-JS.
  Wariant no-JS sprawdza panel; sama gra wymaga JavaScript.
  [Wyniki public_html](P3-SOIL-HOSTING-BROWSER-RESULTS.json).
- `npm run test:game:browser` — 4/4 PASS: rozpakowany ZIP pod `/` i `/PixelForge/`,
  pierwszy korzeń, zapis/wznowienie, ruch przy zoomie 0.5, brak błędów JS.
  [Wyniki gry](P3-SOIL-GAME-BROWSER-RESULTS.json).

Pomiary ostatniego scenariusza w Chromium 158.0.8127.18, po sześciu sekundach
ruchu przy zoomie 0.5:

| Profil            | Ścieżka        | Średni FPS | p95 klatki | Sektory | Tekstury sektorów |
| ----------------- | -------------- | ---------: | ---------: | ------: | ----------------: |
| Desktop           | `/`            |       59,8 |    16,8 ms |       8 |             2 MiB |
| Desktop           | `/PixelForge/` |       59,8 |    16,8 ms |       8 |             2 MiB |
| Emulacja telefonu | `/`            |       59,7 |    16,8 ms |      28 |             7 MiB |
| Emulacja telefonu | `/PixelForge/` |       59,3 |    16,7 ms |      28 |             7 MiB |

To pomiar lokalnego środowiska testowego, nie gwarancja FPS na telefonie.
Zrzuty rzeczywistej gry z finalnego ZIP-a:
[desktop](screenshots/p3-soil-desktop.png), [telefon](screenshots/p3-soil-mobile.png).

## Paczki

| Zastosowanie                                  | Plik                                               |     Rozmiar |
| --------------------------------------------- | -------------------------------------------------- | ----------: |
| Aktualizacja przez istniejący panel           | `pixelforge-0.8.0-full.zip`                        | 7 746 922 B |
| Pierwsza instalacja wszystkiego w public_html | `pixelforge-public-html-0.8.0-installer-1.2.0.zip` | 7 819 911 B |

SHA-256 pełnej aktualizacji:
`066d23235ea5f2fd0cc53d919479917752c8419f396ac04885d8a3491413a6e4`.

SHA-256 paczki public_html:
`388a2272cc9dbacbdfe78d2dd8cf2b38f11cde80c63d858e99f8d0b88445a0de`.

Pełny ZIP ma 288 plików aplikacji i manifest. Paczka public_html ma 315 plików;
nie zastępuje głównego index.html/index.php ani .htaccess istniejącej strony.
Do skonfigurowanego panelu wybiera się ZIP `full`, bez rozpakowywania. Paczka
public_html służy pierwszej instalacji, nie ponownemu nadpisaniu konta panelu.

Dla nowych grafik zalecany limit PHP to `upload_max_filesize=16M` i
`post_max_size=17M` lub większe wartości. Rzeczywisty limit pokazuje panel.
Gra pozostaje statyczna i można ją uruchomić także bez PHP po rozpakowaniu ZIP-a.

## Granice pomiaru

Odbiór czytelności bez instrukcji, balans oraz czas pierwszego przejścia przez
człowieka pozostają do playtestu. Cel 20–35 minut nie jest deklaracją zmierzonego
czasu. Sprawdzenia mobilne to emulacja, a nie pomiar fizycznego telefonu;
nie wykonano testu Safari/iOS ani osobnego uruchomienia Edge na Windows.

Atlasy i okładka zajmują około 24 MiB po dekodowaniu RGBA. Statystyka
`textureBytes` w diagnostyce dotyczy wyłącznie tekstur sektorów, nie wszystkich
obrazów ani całej pamięci GPU. Nie ma jednej tekstury 4096 × 4096. Vite zgłasza
znane ostrzeżenie o wielkości pakietu renderera Phaser; build kończy się poprawnie.

Bez wdrożenia na publiczny hosting i bez samodzielnego merge do main.
