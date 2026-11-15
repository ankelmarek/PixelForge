# Życie Dżdżownicy — zasoby

Grafiki `garden-atlas.png`, `worm-atlas.png`, `soil-atlas.png` i `soil-cover.png`
zostały wygenerowane narzędziem obrazowym OpenAI na potrzeby PixelForge,
według własnego projektu postaci, roślin i pionowego przekroju gleby.
Nie wykorzystują załączonych zdjęć, cudzych postaci ani zasobów innych gier.
Arkusze zachowano w oryginalnej postaci; kadry i ostre filtrowanie tekstur
opisuje `src/games/earthworm/soil-view.ts`. Nie są generowane podczas builda.

Pozostałe PNG to historyczne, proceduralne zasoby pierwszej wersji 0.7.0;
nie są ładowane przez nową grę. Ich źródło jest w historii
`tools/generate-earthworm.py` (commit dc919f58).

Świat jest deterministyczny: `npm run assets:earthworm` odtwarza `soil-world.json`,
bez nadpisywania ilustracji. Dźwięki pochodzą ze wspólnego syntezatora Web Audio.
Brak płatnych materiałów, zewnętrznych fontów i pobierania zasobów w runtime.
Zasoby można wykorzystywać i publikować wraz z PixelForge.
