# S4 — trzy warianty i oprawa Stacji na Trasie

15 listopada 2026. Gałąź `feature/s4-stacja-warianty`; kontynuacja S3,
zlecona razem z S2/S3. Klient 0.4.0, zapis v4. Status: **REVIEW — lokalne testy PASS; pełna regresja CI w PR; odbiór Q1 otwarty**.

## Warianty i balans

Ekran przed nową grą pozwala wybrać Krajówkę, Autostradowy weekend albo
Nocną zmianę oraz numer weekendu (seed 0–4294967295). Losowanie korzysta
z lokalnego generatora przeglądarki; ten sam numer odtwarza warunki przy
tych samych decyzjach. Wszystkie warianty trwają 30 minut symulacji przy ×1.

| Wariant              | Różnica                                                                           | Cel opłaconych wizyt |
| -------------------- | --------------------------------------------------------------------------------- | -------------------- |
| Krajówka             | Ruch mieszany, dzień, zmierzch i świt                                             | 60                   |
| Autostradowy weekend | Więcej ciężarówek i dodatkowe możliwości przyjazdu autokaru, wspólne limity ruchu | 55                   |
| Nocna zmiana         | Około 17% mniej fal ruchu, większy popyt na kawę, płace +25%, stała noc           | 50                   |

Każdy wymaga też ≥70% zadowolenia i dodatniego majątku netto. Zmienione
progi uwzględniają dłuższe wizyty dużych pojazdów oraz mniejszy ruch nocny.
Oświetlenie placu kosztuje 20 monet za minutę po zmroku; można je wyłączyć,
co zmniejsza komfort oraz skłonność do zjazdu. Energia trafia do tej samej
księgowości co pozostałe koszty. Pauza, zmiana tempa i zapis nie duplikują
rachunku. Płace w panelu pokazują rzeczywistą stawkę wybranego wariantu.

Macierz 20 pełnych symulacji korzysta z publicznych poleceń modelu:
trzy warianty × seedy 731/9021 × własny sklep/druga kasa/najem, dodatkowo
dwie autostradowe kampanie z dużą pompą ON. Wszystkie zakończyły się
sukcesem, przy maksymalnie 25 jednoczesnych jednostkach. Nocna strategia
z dodatkową kasą dla seeda 731 miała stratę operacyjną 93.07 monety,
ale dodatni majątek; dodatkowa obsada nie jest automatycznie opłacalna.
Własny sklep i najem były zyskowne w każdym badanym wariancie/seedzie.
To kontrolowany automat decyzji, a nie badanie przystępności dla człowieka.

## Obraz i dźwięk

Oryginalna wiata i latarnie uzupełniają istniejące grafiki aut, autokaru,
Skoczki i myjni. Płynne światło wynika z czasu symulacji, także po wznowieniu.
Pixelowe plamy światła, reflektory zgodne ze skrętem, otwierane drzwi aut,
oświetlony sklep oraz kałuże po deszczu powstają po stronie klienta gry.
Cień obejmuje tylko viewport; nie tworzymy tekstury całego świata.

Muzyka ma nocną aranżację i szybszy motyw niedzielnego ruchu. Proceduralne
efekty obejmują silniki, pompy, płatności, ekspres, drzwi, cysternę, myjnię,
wiatr, deszcz, awarie i budowę. Głośność usług zależy od odległości kamery.
Obowiązują wspólne limity 12 głosów (8 efekty, 2 ambient, 2 muzyka),
regulatory kanałów, odblokowanie kliknięciem, pauza i wyciszenie.
Bufory białego/brązowego szumu są współdzielone, mono, po 2 sekundy;
przy 48 kHz razem 768000 bajtów PCM. Nie pobieramy nagrań ani fontów.

Pochodzenie grafik i syntezy jest w LICENSE klienta. ORLAR pozostaje
grafitowo-bursztynowo-turkusową stacją z geometrycznym skrzydłem, Skoczka
ma śliwkowy dach, szałwię i własną żabkę. Przegląd źródeł potwierdza
własne generatory i brak importowanych oznaczeń rzeczywistych sieci.
Ocena czytelności symboli wśród nowych graczy pozostaje częścią Q1.

## Oddzielenie klienta i zgodność

Wspólny runtime otrzymał opcjonalny, typowany formularz ustawień
nowej sesji, ograniczoną syntezę szumu oraz limit ośmiu tekstur w jednym
batchu WebGL. Limit upraszcza shader; nie ogranicza liczby rezydujących
tekstur ani obiektów. Nie importuje gry ani nie
rozgałęzia zachowania według jej identyfikatora. Zasady wariantów, grafika,
światło, dźwięki i formularz należą do `src/games/gas-station`.

Zapis v4 zachowuje oryginalne klucze v1/v2/v3. Wznowienie kontynuuje
ich scenariusz, czas oraz koszty, niezależnie od aktualnego wyboru w menu.
Nie zastępujemy uszkodzonego bieżącego zapisu starszym. Poprawka wyjazdu
dostaw z S3 obejmuje też nowe warianty i zapis zatrzymanej cysterny z CI.
Nie zmieniono kodu aktualizatora ani mechanik pozostałych gier.

## Weryfikacja i odbiór

Nowe testy modelu obejmują 14 pełnych kampanii, rozliczenie energii i płac,
wznowienie, odrzucenie uszkodzonego rachunku, zgodność starego weekendu
oraz ciągłość światła. Test audio sprawdza ograniczenie pamięci/głosów,
mute, pauzę i usunięcie buforów. Lokalnie: 187 Vitest, 15 testów pakietów, 36 PHP/Python, lint, typecheck
i produkcyjny build PASS. Cztery nowe scenariusze Playwright (desktop i
emulowany Pixel 7) PASS: wybór wariantu, światła, audio, migracja v3 i
wznowienie. Pełna regresja wcześniejszych gier i długich kampanii ma
odrębne wyniki w CI powiązanego PR.

Nie przeprowadzono jeszcze badania z trzema osobami nieznającymi projektu,
odsłuchu przez człowieka ani testu na fizycznym telefonie. [Protokół Q1](S4-PLAYTEST.md)
ma puste wyniki, przeznaczone na rzeczywiste obserwacje. Automatyczne
przejście 30 minut symulacji nie potwierdza czasu 25–35 minut zabawy
u nowych graczy. **Cała gra nie jest oznaczona DONE.**

Wydanie obejmuje pełny ZIP do istniejącego panelu i osobną paczkę pierwszej
instalacji w `public_html`, z niezmienionym aktualizatorem 1.2.0.
Bez automatycznego merge i wdrożenia na hosting; bez W4 Winobrania.

## Odtworzenie kontroli

Standardowo: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, `npm run test:e2e`. Testy hostingu wymagają Apache/PHP
z ZipArchive i konfiguracji HTTPS opisanej w dokumentach aktualizatora.

Macierz 20 pełnych weekendów:

```bash
npx esbuild tests/fixtures/station-balance.ts --bundle --platform=node --format=esm --outfile=work/s4/balance-run.mjs
node work/s4/balance-run.mjs
```

Pomiar 32 jednostek: `node tools/build-station-stress.mjs`, następnie
statyczny serwer katalogu `work/s4/stress-dist` i
`PIXELFORGE_STRESS_URL=http://127.0.0.1:PORT node tools/measure-station-stress.mjs`.
Pomiar zwykłej sesji: serwer produkcyjnego `dist` oraz
`PIXELFORGE_BENCH_URL=http://127.0.0.1:PORT/ node tools/measure-station.mjs`.
Oba pomiary uruchamiać oddzielnie, bez równoległych testów i kompilacji.
Fixture obciążenia nie trafia do wydania ani do zapisów gracza.

## Pomiary i archiwa 0.15.0

[32 jednostki, noc i deszcz](reports/S4-stress-performance.json):
60 sekund, tempo ×4, zoom 0.5, pięć położeń kamery, Chromium 158 / SwiftShader,
Xeon Platinum 8573C (5 widocznych CPU, limit kontenera 4 rdzenie), viewport
1280×900. **p95 16.8 ms**, średnio 56.8 kl./s, maksymalnie 48 sektorów,
24 MiB tekstur sektorów, 189 lokalnych rozwinięć tras, bez błędów.
Wcześniejszy pomiar miał p95 33.2 ms; po wprowadzeniu małych masek świateł
oraz ograniczeniu samplera do 8 cel tego testu ≤33 ms został spełniony.
Nie zwiększono limitu ani nie zmniejszono liczby jednostek.

[Zwykła sesja nocna](reports/S4-performance.json) z ekonomią, UI i audio:
60 s, ×4, zoom 0.5, do 14 jednostek, średnio 56.0 kl./s i **p95 33.3 ms**.
Ten drugi wynik pozostaje nieco powyżej celu 33 ms i jest ograniczeniem
pomiaru na programowym rendererze, a nie zaliczonym wynikiem tego progu.
Zapis 14066 bajtów, maksymalnie 5 głosów, 705600 bajtów PCM przy 44.1 kHz,
48 sektorów, około 25 MiB ich tekstur, bez błędów. Nie zastępuje pomiarów
na fizycznym telefonie/komputerze nowych graczy.

[Menu](reports/S4-menu.png), [noc](reports/S4-night.png),
[emulacja telefonu](reports/S4-mobile.png). Obejrzano ułożenie menu,
widoczność świata nocą oraz oryginalne sprite'y ORLAR/Skoczka. Nie jest to
badanie rozpoznawalności marki wśród ludzi ani odsłuch.

[Metryki wydania i SHA-256](reports/S4-release.json):
`pixelforge-0.15.0-full.zip` do istniejącego panelu; osobno
`pixelforge-public-html-0.15.0-installer-1.2.0.zip` do pierwszej instalacji.
Manifesty zweryfikowane; 33 wcześniejsze archiwa pozostają identyczne.
Instrukcja znajduje się w README, downloads/README i INSTALACJA.txt paczki.

Zasoby Stacji: 71921 bajtów PNG, 5886976
bajtów RGBA po dekodowaniu, 12332 bajtów map JSON gzip.
Dynamiczny chunk runtime: 33976 bajtów gzip;
cały ZIP jest większy od 0.11.0 o 137183 bajtów.
