# Paczki na serwer statyczny

## M3 — obie gry

[Pobierz PixelForge-M3-static.zip](PixelForge-M3-static.zip?raw=true).
Rozpakuj i wgraj **zawartość**, czyli `index.html` i `assets/`, do katalogu
strony na serwerze HTTP(S). Nie trzeba instalować Node.js, npm, PHP ani bazy.
Szczegóły zawiera `WDROZENIE.txt` w archiwum.

Paczka działa pod domeną główną i podkatalogiem, np. `/PixelForge/`.
Zawiera trzy poziomy Leśnego sygnału i prototyp Winobrania. Raport: `docs/M3-REPORT.md`.
Rozmiar: **442594 bajtów**.

SHA-256:

```text
457644c1aaaa320bd8d6ec2a2088cdd77ec6ac2a1c55faff9ed3ce052fbe023d
```

Odtworzenie: `npm run build`, potem `python3 tools/package-static.py`.
Paczka nie aktualizuje się automatycznie po zmianie źródeł.

## Archiwum M2

[PixelForge-M2-static.zip](PixelForge-M2-static.zip?raw=true) zawiera samą kampanię leśną.

## Archiwum M0

[PixelForge-M0-static.zip](PixelForge-M0-static.zip?raw=true) to wcześniejszy,
jednopoziomowy fundament. Nie zawiera kampanii M2.
