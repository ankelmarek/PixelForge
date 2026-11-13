# Paczki na serwer statyczny

## Leśny sygnał M2 — aktualna kampania

[Pobierz PixelForge-M2-static.zip](PixelForge-M2-static.zip?raw=true).
Rozpakuj i wgraj **zawartość**, czyli `index.html` i `assets/`, do katalogu
strony na serwerze HTTP(S). Nie trzeba instalować Node.js, npm, PHP ani bazy.
Szczegóły zawiera `WDROZENIE.txt` w archiwum.

Paczka działa pod domeną główną i podkatalogiem, np. `/PixelForge/`.
Ma trzy poziomy i wersję zawartości 0.2.0. Status odbioru: `docs/M2-REPORT.md`.
Rozmiar: **403422 bajtów**.

SHA-256:

```text
b166eb6060391dfdebe4d48649e19d69942b71a5407c7e0df0e86948f4333a4b
```

Odtworzenie: `npm run build`, potem `python3 tools/package-static.py`.
Paczka nie aktualizuje się automatycznie po zmianie źródeł.

## Archiwum M0

[PixelForge-M0-static.zip](PixelForge-M0-static.zip?raw=true) to wcześniejszy,
jednopoziomowy fundament. Nie zawiera kampanii M2.
