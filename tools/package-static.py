"""Package the existing Vite dist for static hosting (Python 3 stdlib)."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
if not (dist / 'index.html').is_file():
    raise SystemExit('Najpierw uruchom npm run build.')
out = root / 'downloads'
out.mkdir(exist_ok=True)
archive = out / 'PixelForge-M3-static.zip'
instructions = '''PixelForge — M3: Leśny sygnał + Winobranie

1. Rozpakuj to archiwum na komputerze.
2. Wgraj index.html i cały katalog assets/ do katalogu strony na serwerze.
   Przykład: public_html/PixelForge/index.html + public_html/PixelForge/assets/
3. Otwórz https://twoja-domena.pl/PixelForge/ (z końcowym ukośnikiem).

Nie musisz instalować Node.js, npm, PHP ani bazy. To gotowy build, nie ZIP źródeł.
Można go wgrać również do katalogu głównego domeny. Serwer musi obsługiwać
statyczne HTML, JavaScript, CSS, JSON i PNG. Nie uruchamiaj przez file://.

Aby zaktualizować grę, ponownie wgraj index.html i cały katalog assets/.
Zapis każdej gry pozostaje osobny i wersjonowany.
Postęp pozostaje lokalnie w przeglądarce, osobno dla domeny. Brak PWA.

M3 dodaje pełny prototyp Winobrania, mysz, kolejki, transport i produkcję.
Testy fizycznych urządzeń pozostają do wykonania; patrz docs/M3-REPORT.md.
Licencje własnych grafik: assets/games/<gra>/LICENSE.md.
'''
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(dist).as_posix())
    z.writestr('WDROZENIE.txt', instructions)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'index.html' in z.namelist()
    assert all(not path.startswith(('dist/', 'src/', 'node_modules/', '/')) for path in z.namelist())
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / 'README.md').write_text(f'''# Paczki na serwer statyczny

## M3 — obie gry

[Pobierz PixelForge-M3-static.zip](PixelForge-M3-static.zip?raw=true).
Rozpakuj i wgraj **zawartość**, czyli `index.html` i `assets/`, do katalogu
strony na serwerze HTTP(S). Nie trzeba instalować Node.js, npm, PHP ani bazy.
Szczegóły zawiera `WDROZENIE.txt` w archiwum.

Paczka działa pod domeną główną i podkatalogiem, np. `/PixelForge/`.
Zawiera trzy poziomy Leśnego sygnału i prototyp Winobrania. Raport: `docs/M3-REPORT.md`.
Rozmiar: **{archive.stat().st_size} bajtów**.

SHA-256:

```text
{checksum}
```

Odtworzenie: `npm run build`, potem `python3 tools/package-static.py`.
Paczka nie aktualizuje się automatycznie po zmianie źródeł.

## Archiwum M2

[PixelForge-M2-static.zip](PixelForge-M2-static.zip?raw=true) zawiera samą kampanię leśną.

## Archiwum M0

[PixelForge-M0-static.zip](PixelForge-M0-static.zip?raw=true) to wcześniejszy,
jednopoziomowy fundament. Nie zawiera kampanii M2.
''')
print(f'{archive.name}: {archive.stat().st_size} bajtów, SHA-256 {checksum}')
