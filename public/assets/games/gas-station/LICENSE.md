# Stacja na Trasie — zasoby S1–S4

Oryginalne grafiki i mapa wygenerowane skryptem `tools/generate-station.py`
dla PixelForge (2026-11-14–15). Licencja: **CC0-1.0**.

Skrypt korzysta wyłącznie z biblioteki standardowej Pythona i własnego
modułu `tools/pixel_art.py`. Nie pobiera grafik, fontów ani materiałów sieci.
Obejmuje atlas terenu, samochody w czterech kolorach i ośmiu kierunkach,
cysternę, postacie, sklep, dystrybutory, drzewa i ilustrację katalogu.

ORLAR i geometryczny znak skrzydła są roboczą identyfikacją tej gry:
grafit, bursztyn, turkus. Projekt nie korzysta z logo, zdjęć ani materiałów
stacji ORLEN lub sieci Żabka. W S2 lokal Skoczki ma szałwiowe akcenty, śliwkowy dach i autorską skaczącą żabkę.
Dodano także oryginalne atlasy dostawczaka i ciężarówki towarowej.
S3 dodaje ośmiokierunkowy autokar i otwartą myjnię z prowadnicami,
kratkami odpływu, przeszklonym zapleczem i animowaną pianą/szczotkami.

Muzyka i efekty są autorską syntezą Web Audio: deklaracje w
`src/games/gas-station/index.ts` i `sounds.ts`, wykonanie przez publiczne
API dźwięku silnika. Nie zawierają nagrań zewnętrznych.

S4 dodaje oryginalną ażurową wiatę i bursztynową latarnię z tego samego
skryptu. Klient rysuje światło dnia, zmierzchu i nocy, reflektory, drzwi aut
i mokry asfalt. Nocna aranżacja, deszcz, wiatr oraz efekty stacji są autorską
syntezą proceduralną. Silnik udostępnia ograniczone, współdzielone bufory
białego i brązowego szumu, bez zewnętrznych nagrań lub grafik.
