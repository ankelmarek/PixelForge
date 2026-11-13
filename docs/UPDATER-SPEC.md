# PixelForge — projekt aktualizatora ZIP

**Status:** U0 zaimplementowane; U1–U3 zaplanowane, bez wdrożenia. **Data decyzji:** 2026-11-13.

## 1. Cel

Użytkownik ma móc pobrać paczkę wydania PixelForge i wgrać ją przez prosty panel administracyjny. Narzędzie weryfikuje paczkę, pokazuje zmiany, wykonuje kopię, bezpiecznie przełącza wersję, sprawdza jej integralność oraz pozwala przywrócić poprzednią.

To aktualizator **statycznych plików PixelForge i jego gier**, nie aktualizator bazy danych i nie instalator dowolnego kodu PHP. Zachowuje istniejące zapisy graczy (localStorage/IndexedDB), ich identyfikatory oraz niezmienioną publiczną bazową ścieżkę gry.

## 2. Istotne ograniczenie architektoniczne

PixelForge jest aplikacją statyczną zbudowaną Vite. **Sama przeglądarka nie może nadpisać plików hostingu po przesłaniu ZIP-a**. Do wdrożenia nowej wersji niezbędny jest odrębny, uwierzytelniony komponent z prawami zapisu na serwerze albo lokalna komenda administratora.

Wariant preferowany dla zwykłego hostingu z PHP: niewielki, izolowany panel `admin-updater` w PHP 8.x z rozszerzeniem `ZipArchive`, bez SQL. Jego pliki i uwierzytelnianie pozostają **poza paczką gry** i nigdy nie są nadpisywane przez aktualizację. Jeśli hosting ma wyłącznie pliki statyczne, panel webowy nie zadziała: trzeba użyć adaptera CLI/SSH albo usług wdrożeniowych dostawcy. Nie udawaj, że JavaScript w przeglądarce ma uprawnienia do zapisywania w katalogu WWW.

Nie wybieraj hostingu ani nie dodawaj zależności serwerowych do runtime gry bez późniejszej decyzji użytkownika. PHP jest propozycją wdrożeniową dla hostingu, który go obsługuje, a nie obowiązkową częścią samego silnika.

## 3. Interfejs aktualizatora

Dostęp wyłącznie dla administratora, niezależny od katalogu gier. Minimum:

1. Ekran z aktualną wersją silnika, wydaniem pakietu i datą wdrożenia.
2. Pole „Wybierz ZIP” / przeciągnij archiwum i naciśnij „Sprawdź pakiet”.
3. Walidacja zawartości i sum SHA-256; czytelna informacja o wersji, rozmiarze, dodawanych, wymienianych i usuwanych plikach.
4. **Oddzielne potwierdzenie** uruchamiające aktualizację po pokazaniu planu zmian. Wgrywanie nie uruchamia automatycznie instalacji.
5. Widoczny wynik operacji z możliwością testu nowej wersji.
6. Przywracanie ostatniej działającej wersji z zachowaniem dziennika czynności.

Panel może wyświetlać komunikaty pisane. Zasada „bez tekstowych podpowiedzi” dotyczy **rozgrywki**, nie bezpiecznego panelu aktualizacyjnego.

## 4. Format pakietu

ZIP generowany przez narzędzie `npm run package:release` (lub osobną komendę) po pomyślnym buildzie. Nie pakuj surowych źródeł, `node_modules`, sekretów, panelu aktualizatora ani katalogów zapisu użytkowników.

Pakiet zawiera pliki statycznej dystrybucji oraz maszynowo sprawdzalny manifest, np.:

```json
{
  "formatVersion": 1,
  "project": "pixelforge",
  "packageType": "full",
  "releaseVersion": "0.4.0",
  "baseVersion": null,
  "requiredUpdaterVersion": "1.0.0",
  "engineSchemaVersion": 1,
  "files": [
    { "path": "index.html", "size": 1234, "sha256": "<64 hex chars>" },
    {
      "path": "assets/index-1234.js",
      "size": 45678,
      "sha256": "<64 hex chars>"
    }
  ],
  "deletions": []
}
```

Przykład ilustruje kontrakt. `sha256` każdego pliku ma zostać wygenerowane automatycznie. Manifest należy trzymać w znanej lokalizacji w archiwum, a jego schemat walidować.

Rodzaje wydań:

- **Full**: kompletny statyczny build, niezależny od zainstalowanej wersji.
- **Delta**: tylko zmienione/dodane pliki, jawna lista usunięć i obowiązkowe `baseVersion`. Delta musi wymagać ścisłej zgodności z aktualną wersją.

`gameId`, format zapisu i kompatybilność manifestów gier muszą pozostać kontrolowane podczas aktualizacji, a nie resetowane. Paczka nie może zmieniać ścieżek danych administratora.

## 5. Bezpieczeństwo

- Dostęp tylko po logowaniu administracyjnym, HTTPS, ochronie CSRF, ograniczeniu prób i bezpiecznej sesji. Panel nie może mieć domyślnego publicznego hasła.
- Ogranicz liczbę plików w ZIP-ie, rozmiar ZIP, maksymalny rozmiar po rozpakowaniu i współczynnik kompresji. Wszystkie limity konfigurowalne.
- Odrzuć ścieżki absolutne, `..`, separator alternatywny, duplikaty ścieżek po normalizacji, symlinki, wpisy specjalne, próby wyjścia z katalogu wydania i niedozwolone nazwy.
- Przyjmuj wyłącznie pliki z listy dozwolonych ścieżek i rozszerzeń **statycznego buildu**. Nigdy nie nadpisuj `admin-updater/`, `storage/`, `backups/`, plików konfiguracji serwera, .env, .htaccess, .user.ini ani wykonywalnych skryptów serwerowych.
- Nie wykonuj skryptów z ZIP-a, komend powłoki ani migracji bazy zadeklarowanych przez paczkę.
- Sprawdzaj SHA-256 każdego pliku, wersję, identyfikator projektu i zgodność formatu. Sumy kontrolne wykrywają uszkodzenie, ale nie dowodzą autentyczności; w razie zdalnego dystrybuowania paczek rozważ podpisy cyfrowe oraz zaufany klucz publiczny.
- Upload przechowuj poza publicznym katalogiem WWW; usuń pliki tymczasowe także po błędach i nie udostępniaj logów publicznie.
- Nie udzielaj uprawnień zapisu do całego hostingu. Proces aktualizatora może zapisywać tylko wskazany katalog wydań i prywatne katalogi robocze.

## 6. Przebieg instalacji

1. Uwierzytelnij administratora, załóż blokadę jednej aktualizacji i sprawdź prawa katalogów.
2. Odbierz plik do prywatnego katalogu tymczasowego.
3. Zweryfikuj manifest, poprawność ZIP, limity, zgodność wersji i każdą ścieżkę.
4. Rozpakuj do nowego katalogu staging bez możliwości wykonania z niego skryptów.
5. Zweryfikuj sumy i strukturę nowego wydania, odtwórz pełne wydanie z delty w staging.
6. Przetestuj istnienie `index.html`, zasobów i manifestu, sprawdź kompatybilność wersji. Udostępnij administratorowi listę zmian.
7. Po osobnym potwierdzeniu oznacz poprzednią działającą wersję jako punkt przywracania.
8. Preferuj **wersjonowane katalogi wydań** i przełączenie aktywnego wydania przez mechanizm serwera; jeśli hosting nie wspiera atomowego przełączenia katalogu/symlinka, zastosuj udokumentowany wariant maintenance + staging + ostrożną podmianę, jawnie oznaczając krótkie okno niespójności. Nie obiecuj atomowości wieloplikowego nadpisania.
9. Wykonaj test zdrowia nowej instalacji; przy błędzie przywróć poprzednią wersję. Zwolnij blokadę i wyczyść staging.
10. Zachowaj co najmniej jedną poprzednią sprawną wersję i dziennik aktualizacji (czas, wersje, hash paczki, wynik, ewentualny rollback).

**Ważne:** testy i retry mają być idempotentne. Przerwana aktualizacja nie może pozostawić nieznanego aktywnego wydania ani usunąć ostatniej działającej wersji.

## 7. Zapis danych i zgodność

Zapis gier w localStorage/IndexedDB nie jest aktualizowany przez serwerowy ZIP, ale aplikacja musi respektować te same klucze danych i wersjonowanie. Aktualizacja nie może samoczynnie wyczyścić zapisów. Jeśli nowa wersja wymaga migracji, zaprojektuj migrację runtime z kopią danych i testem; bez zgodności blokuj instalację albo wymagaj jawnej procedury.

## 8. Minimalne etapy

### U0: format paczki i walidator offline

- [x] Generowanie `full` ZIP z manifestem i kontrolą SHA-256.
- [x] Walidator, który odrzuca naruszenia formatu, wersji, ścieżek, limitów i sum.
- [x] Testy jednostkowe i fixture z poprawnym oraz celowo uszkodzonym archiwum.

Implementacja: [format i CLI](RELEASE-PACKAGES.md), [raport U0](U0-REPORT.md).
Wersja wydania 0.6.0; manifest v1, kontrakt silnika 2, narzędzie 1.0.0.

### U1: bezpieczny mechanizm instalacji i rollback

- [ ] Prywatny staging, blokada i limit przestrzeni.
- [ ] Wersjonowane wydania i wskazanie aktywnej wersji lub bezpieczny fallback dla wybranego hostingu.
- [ ] Test pełnego wdrożenia, przerwanego wdrożenia i przywracania poprzedniej wersji.
- [ ] Zależnie od hostingu: adapter PHP z `ZipArchive` albo narzędzie CLI.

### U2: panel WWW do uploadu

- [ ] Logowanie, HTTPS, CSRF, kontrola uprawnień.
- [ ] Upload, analiza, podgląd plików, osobne zatwierdzenie instalacji, wynik i rollback.
- [ ] Panel pozostaje niezależny od statycznego buildu PixelForge.

### U3: paczki delta i testy regresji

- [ ] `delta` ZIP wymagający zgodności `baseVersion`.
- [ ] Kontrola usuwanych plików i weryfikacja kompletnego wyniku po złożeniu delty.
- [ ] Test ponownego wgrania tej samej paczki, przerwanych przesyłów, dwóch jednoczesnych prób aktualizacji, wadliwego archiwum i niezgodnej wersji.

## 9. Kryteria końcowe

Administrator potrafi zainstalować pełną paczkę ZIP bez FTP i bez ręcznego kopiowania plików, zobaczyć wynik walidacji przed instalacją, a następnie w razie problemu jednym działaniem wrócić do poprzedniej działającej wersji. Gracze nie dostają dostępu do panelu, a ich lokalne zapisy pozostają nienaruszone.

**Uwaga realizacyjna:** wyboru adaptera PHP/CLI dokonamy po potwierdzeniu środowiska docelowego. Nie zmieniaj statycznego runtime gry tylko po to, aby umożliwić upload na serwer.
