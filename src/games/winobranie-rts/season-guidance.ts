import type { VineyardState } from './model';
import type { Guidance } from './guidance';
import { VineyardClimate } from './climate';
import { WaterNetwork, SPRINKLER_RADIUS } from './water';

export function seasonGuidance(s: VineyardState): Guidance | null {
  const e = s.environment;
  if (!e) return null;
  if (s.rows.every((r) => r.mature)) return null;
  const climate = new VineyardClimate(e.seed),
    weather = climate.at(s.tick);
  const say = (
    id: string,
    text: string,
    target?: string,
    tone: Guidance['tone'] = 'info',
  ): Guidance => ({ id, text, tone, ...(target ? { target } : {}) });
  const threatened = weather.kind === 'frost';
  if (!s.buildings.length && !threatened) return null;
  const tanks = e.water.devices.filter((d) => d.kind === 'tank'),
    pumps = e.water.devices.filter((d) => d.kind === 'pump'),
    nozzles = e.water.devices.filter((d) => d.kind === 'sprinkler');
  if (!tanks.length)
    return say(
      'water-tank',
      'Przygotuj ochronę upraw: postaw zbiornik obok rzędów i zamów wodę w jego panelu. Pogoda zmieni się w trakcie sezonu.',
    );
  const low = tanks.find((t) => t.volume < 50000 && !t.delivery);
  if (low)
    return say(
      'water-low',
      'Kończy się woda. Wybierz zbiornik i zamów dostawę; przyjedzie za 20 sekund czasu gry.',
      low.id,
      'warning',
    );
  if (!pumps.length)
    return say(
      'water-pump',
      'Postaw pompę przy zbiorniku. Rurami połączysz oba urządzenia ze zraszaczami.',
    );
  if (!nozzles.length)
    return say(
      'water-sprinkler',
      'Rozmieść zraszacze przy rzędach. Okrąg podglądu pokazuje zasięg; połącz je rurami ze zbiornikiem i pompą.',
    );
  const net = new WaterNetwork(e.water);
  net.refresh();
  const disconnected = nozzles.find((d) => !net.connected.has(d.id));
  if (disconnected)
    return say(
      'water-disconnected',
      'Zraszacz nie ma połączenia. Przeciągnij rury przez zbiornik, pompę i zraszacz; odcinki muszą się stykać.',
      disconnected.id,
      'warning',
    );
  const ice = s.rows.find((r) => e.crops[r.id].plots.some((p) => p.ice > 0));
  const off = e.water.devices.find(
    (d) => d.kind !== 'tank' && d.mode === 'off',
  );
  if ((threatened || ice) && off)
    return say(
      'water-off',
      'Mróz lub lód na krzewach: włącz pompę i zraszacze. Przerwanie strumienia przed odmarznięciem zwiększa straty.',
      off.id,
      'warning',
    );
  if ((threatened || ice) && s.ledger.balance < 100)
    return say(
      'water-energy',
      'Brakuje środków na energię pompy. Sprzedaj gotowy moszcz, aby przywrócić dopływ wody.',
      undefined,
      'warning',
    );
  if (ice)
    return say(
      'thaw',
      'Na krzewach jest lód. Utrzymaj zraszanie aż odmarzną, także po wzroście temperatury powyżej zera.',
      ice.id,
      'warning',
    );
  const uncovered = s.rows.find(
    (r) =>
      !r.mature &&
      r.cells
        .filter((_, i) => i % 2 === 0)
        .some(
          (p) =>
            !nozzles.some(
              (d) => Math.hypot(p.x - d.x, p.y - d.y) <= SPRINKLER_RADIUS,
            ),
        ),
  );
  if (
    uncovered &&
    (threatened || climate.forecast(s.tick).some((f) => f.kind === 'frost'))
  )
    return say(
      'frost-coverage',
      'Nadchodzi mróz, a część rzędu jest poza zasięgiem zraszaczy. Uzupełnij ochronę; zadbaj o wodę i wydajność pomp.',
      uncovered.id,
      'warning',
    );
  if (threatened)
    return say(
      'frost',
      'Trwa przymrozek. Sprawdzaj poziom wody i strumień zraszaczy: potrzebne jest 100% aż do odmarznięcia.',
      undefined,
      'warning',
    );
  const sick = s.rows.find(
    (r) =>
      !r.mature &&
      !e.crops[r.id].care &&
      e.crops[r.id].plots.some((p) => p.mildew >= 800),
  );
  if (sick)
    return say(
      'mildew',
      'Wilgoć sprzyja mączniakowi. Wybierz rząd i zleć pielęgnację; wykona ją pracownik w trybie Auto lub Budowa.',
      sick.id,
      'warning',
    );
  const dry = s.rows.find(
    (r) => !r.mature && e.crops[r.id].plots.some((p) => p.moisture < 2500),
  );
  if (dry)
    return say(
      'drought',
      'Krzewom brakuje wilgoci. Doprowadź wodę do tego rzędu; tryb Auto podlewa przesychające uprawy.',
      dry.id,
      'warning',
    );
  return null;
}
