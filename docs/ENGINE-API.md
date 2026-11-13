# Publiczne API runtime — M1

Gra importuje typy i `RuleSystem` z `src/engine/api`. Engine nie importuje gier.
`GameDefinition` jest zaufanym modułem TS. Mapy są walidowanymi danymi JSON.

## Dodanie gry lub poziomu

1. Utwórz `src/games/<slug>/index.ts` z `GameDefinition` oraz własne zasoby
   pod `public/assets/games/<slug>/`.
2. Podaj `id`, `version`, `startingLives` (1–9), rozmiar 320×180, assety,
   parametry ruchu, `levelUrl` oraz opcjonalną listę `levels`. Jej pierwszy wpis
   musi być identyczny z `levelUrl`. Zarejestruj definicję w katalogu aplikacji.
3. Poziom podaje granice, spawn, geometrię `platforms`, interakcję zgodności M0
   i wyjście. Opcjonalne `entities` tworzą konfigurowalne obiekty; `exitRequires`
   określa warunek zakończenia. Sceny nie wymagają edycji przy dodaniu poziomu.
4. Obrazy są wskazywane przez klucze z `assets`; `spriteSheets` deklaruje rozmiar
   klatki. Gracz używa klatek 16×24: idle, trzy run, jump, drugi idle, opcjonalny hit.
5. Pierwszy poziom jest ładowany razem z pozostałymi mapami wybranej gry.
   Niepoprawne ID, encje, tekstury i reguły kończą się diagnostyką przed startem.

Współrzędne platform oznaczają lewy górny róg, gracza — środek sprite'a,
a encji i wyjścia — środek podstawy. Patrole wymagają podłoża pod całą trasą.

## Encje i zachowania

Factory komponuje sprite, ciało Arcade i zachowanie według `type`:

- `collectible`: jednorazowe zebranie i zapis (unikalne ID).
- `checkpoint`: zapis i punkt odrodzenia po kontakcie.
- `enemy`: grawitacja, kolizje z podłożem, patrol `min/max/speed`, obrażenia.
- `trigger`: jednorazowa reakcja po kontakcie, warunek i zamknięte akcje.
- `hazard`: strefa obrażeń o konfigurowanym rozmiarze.
- `switch`: pojedyncza kontekstowa interakcja, warunek i lista akcji.
- `door`: ten sam kontrakt interakcji, np. akcja `completeLevel`.

`PlayerController` dostaje semantyczne wejście, przyspieszenie/hamowanie,
skok z krótkim buforem i tolerancją krawędzi. Nie zna klawiszy ani nazwy gry.
Obrażenia zabierają życie i odradzają przy checkpointcie, z nietykalnością 1,4 s.
Przy zerze żyć wspólna nakładka pokazuje porażkę i ponowienie.

Przykład obiektu (JSON):

```json
{
  "id": "beacon-a",
  "type": "switch",
  "x": 240,
  "y": 156,
  "texture": "beacon",
  "requires": { "condition": "allCollected" },
  "onInteract": [{ "action": "toggleFlag", "flag": "activated" }]
}
```

## Rozszerzenie reguł przez grę

`RuleSystem` domyślnie rejestruje `setFlag`, `toggleFlag` i `completeLevel`.
Warunek `allFlags` obsługuje nazwy flag. Inne nazwy trzeba zarejestrować w TS
**przed** walidacją map. Nieznane akcje/warunki są odrzucane; brak wykonywania JS
z JSON. Przykład jest w `src/games/forest-demo/rules.ts`:

```ts
registerRules(rules) {
  rules.registerCondition('allCollected', ({ level, collected }) =>
    (level.entities ?? [])
      .filter(entity => entity.type === 'collectible')
      .every(entity => collected.includes(entity.id)),
  );
}
```

Nową, nietypową reakcję dodaj jako `registerAction` w module gry. Otrzymuje
`RuleAction`, aktualny `RuleContext` i ograniczone efekty (`setFlag`, `complete`).
Nie zmieniaj sceny i nie rozpoznawaj `gameId` w rdzeniu. Nowy rodzaj fizycznego
zachowania wymaga jawnego rozszerzenia typów/factory; nie ma internetowych pluginów.

## Postęp, zapis i sceny

`ProgressService` prowadzi flagi i kolekcje z prefiksem ID poziomu, checkpoint,
życia, bieżący poziom, czas aktywnej symulacji i zakończenie. `SaveService` zapisuje
rekord v2 w `pixelforge:v2:<gameId>` z wersją gry. Nie zapisuje każdej klatki.
Zapis następuje przy zbieraniu, checkpointcie, obrażeniach, interakcji, końcu mapy,
pauzie i wyjściu. Wznowienie wraca do checkpointu, nie dowolnej pozycji.

Brak dostępu do localStorage, zła wersja, niepoprawne życia, ID lub JSON dają
bezpieczną nową sesję. Zmiana niekompatybilnej zawartości wymaga zmiany `version`.
M0 v1 jest migrowane do flagi `activated` i zakończenia tylko w grze
jednopoziomowej. Nowa kampania wielopoziomowa zaczyna się od czystego stanu. Nowa sesja zapisuje v2 i nie wraca do starych flag.

Host zachowuje sceny Boot/Preload/Title/Gameplay. HTML aplikacji obsługuje pauzę,
porażkę i zwycięstwo; pauza zatrzymuje scenę, fizykę i czas. Restart i wyjście
usuwają listenery, obiekty oraz timery. UI nie pokazuje pisanych samouczków.
Audio współdzielone: skok, interakcja, zebranie, obrażenia, ukończenie; wyciszenie.

## Uzupełnienia M2

`LevelDefinition.title` to krótka nazwa poziomu dla HUD-u. `theme` wskazuje
teksturę tła, kolor terenu i opcjonalną dekorację przednią. Wszystkie wskazane
klucze muszą istnieć w assetach gry. Zasoby `gem`, `lock` i `enemy` są dostarczane
przez grę; sceny nie zawierają jej nazw ani geometrii.

Opcjonalne `music` w definicji gry zawiera `notes` (MIDI 0–100, 0 oznacza pauzę),
`beatSeconds` (0,1–3) i `volume` (0–0,03). `Audio` syntezuje ton, wspólny master
obsługuje wyciszenie, a zawieszenie kontekstu zatrzymuje muzykę na pauzie.
Motyw i parametry są danymi gry, bez zewnętrznych plików i kont.
