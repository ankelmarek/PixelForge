# M1 — współdzielony runtime i kontrakty

Zakres zatwierdzony przez użytkownika: M1, potem M2; M3/Winobranie odłożone.
Gałąź `feature/m1-runtime` bazuje na kodzie M0 (`1420b8f`), który nie został
jeszcze scalony do main. Nie scalano PR-ów automatycznie.

Dodano factory encji, controller ruchu z przyspieszeniem, hamowaniem, buforem
skoku i tolerancją krawędzi, patrol, damage, collectible, checkpoint, switch,
door oraz przejście między poziomami. Zamknięty RuleSystem rejestruje akcje
oraz warunki; gra dostarcza przykład rozszerzenia `allCollected` przez publiczne
API, bez zależności engine → games.

Nowy ProgressService i SaveService v2 przechowują poziom, checkpoint, flagi,
kolekcje, życia, czas, zakończenie i wersję gry. Jest migracja v1 M0, izolacja
poziomów/gier i walidacja zapisów. Pauza zapisuje stan i zatrzymuje scenę.
Wspólne UI pokazuje życia, kolekcje, mapę, porażkę i wynik; bez pisanych wskazówek.
Audio rozszerzono o zbieranie i obrażenia. API opisano w ENGINE-API.md.

Weryfikacja 2026-11-13: `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run build` — OK. Vitest: **15 zaliczonych**. Playwright: **11 zaliczonych,
1 świadomie pominięty na desktopie** (multitouch wykonany w emulacji mobilnej).
E2E obejmuje regresję M0, zbieranie, trigger, checkpoint, patrol/damage,
odrodzenie z zapisem flag i życia, porażkę, restart, pauzę i wznowienie.
Rozmiar JS: 1 417,44 kB, gzip 382,28 kB; znane ostrzeżenie dużego chunka Phasera.

Ograniczenia: rozszerzone zachowania testowane na małej mapie kontraktowej;
pełna zawartość, oprawa i test długości należą do M2. Testy przeglądarkowe używają
Chromium i emulacji dotyku; fizyczne telefony i pozostałe przeglądarki nie są
potwierdzone. Rekord v2 wraca do checkpointu, nie dowolnej pozycji. Brak PWA.
