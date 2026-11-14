# Winobranie RTS — pochodzenie materiałów W1

Grafiki `objects.png` i `cover-v1.png` zostały wygenerowane narzędziem OpenAI
Image Generation na potrzeby PixelForge 14 listopada 2026. Bez pobierania cudzych
sprite'ów, znaków towarowych ani zewnętrznych fontów. Użycie i dystrybucja
w tym projekcie zgodnie z warunkami OpenAI dotyczącymi wygenerowanych materiałów;
nie przypisujemy im cudzej licencji CC ani nie deklarujemy wyłączności.

- `objects.png`: oryginalny atlas RGBA 1254 × 1254, 4 × 4 klatki; domki,
  magazyn, traktor, pracownicy, prasa, trzy odmiany winorośli, sadzonka,
  skrzynka, beczka, drzewo i trawy. Granice klatek rejestrowane w runtime.
- `cover-v1.png`: oryginalna ilustracja RGB 1672 × 941, winnica i zbiory.
- `world.json`, `sectors/*.json`: autorskie dane deterministycznego generatora
  `tools/generate-winery.py` (seed scenariusza 731), bez grafiki rastrowej świata.
- Mały atlas terenu powstaje z kodu `view.ts`, sektory składa wspólny renderer.
- Efekty dźwiękowe i melodia: synteza Web Audio we wspólnym silniku, bez nagrań
  ani zewnętrznych zależności w czasie uruchamiania.

Oryginały obrazów zachowano bez kadrowania, usuwania tła lub resamplingu plików.
Filtr NEAREST, culling sprite'ów i strumieniowanie sektorów działają w runtime.
