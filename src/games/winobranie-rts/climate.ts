import {
  ClimateEventService,
  randomSample,
  type Cell,
} from '../../engine/api/strategy';
export const DAY_TICKS = 400,
  SEASON_TICKS = 12000;
export interface Weather {
  day: number;
  temperature: number;
  rain: number;
  sun: number;
  wind: number;
  humidity: number;
  kind: 'sun' | 'rain' | 'frost' | 'drought';
}
export interface Site {
  soil: 'Piasek' | 'Glina' | 'Próchnica';
  sun: number;
  retention: number;
  cold: number;
}
export function siteAt(seed: number, p: Cell): Site {
  const n = randomSample(
    seed,
    4,
    Math.floor(p.x / 24) + Math.floor(p.y / 24) * 22,
  );
  const soil = n < 0.33 ? 'Piasek' : n < 0.66 ? 'Glina' : 'Próchnica';
  return {
    soil,
    sun: Math.round(88 + 24 * randomSample(seed, 5, Math.floor(p.x / 16))),
    retention: soil === 'Piasek' ? 35 : soil === 'Glina' ? 75 : 60,
    cold: Math.round(8 * Math.sin(p.x / 24) - 18 * Math.sin((p.y - 225) / 22)),
  };
}
export class VineyardClimate {
  readonly fronts: ClimateEventService<number>;
  constructor(readonly seed: number) {
    const first = (3 + Math.floor(randomSample(seed, 0, 0) * 3)) * DAY_TICKS;
    const second = (7 + Math.floor(randomSample(seed, 0, 1) * 2)) * DAY_TICKS;
    this.fronts = new ClimateEventService([
      {
        start: first,
        end: first + 700 + Math.floor(randomSample(seed, 0, 2) * 400),
        value: 35 + Math.floor(randomSample(seed, 0, 3) * 20),
      },
      ...(randomSample(seed, 0, 4) < 0.65
        ? [
            {
              start: second,
              end: second + 500,
              value: 30 + Math.floor(randomSample(seed, 0, 5) * 15),
            },
          ]
        : []),
    ]);
  }
  at(tick: number): Weather {
    const day = Math.min(29, Math.floor(tick / DAY_TICKS));
    const warm = day < 9 ? 120 : day < 22 ? 220 : 170;
    const dryStart = 11 + Math.floor(randomSample(this.seed, 1, 100) * 4);
    const drought = day >= dryStart && day < dryStart + 4;
    const rain =
      !drought && randomSample(this.seed, 1, day) < 0.3
        ? 1 + Math.floor(randomSample(this.seed, 2, day) * 3)
        : 0;
    let temperature = Math.round(
      warm +
        randomSample(this.seed, 2, day + 30) * 50 +
        35 * Math.sin(((tick % DAY_TICKS) / DAY_TICKS) * Math.PI * 2) +
        (drought ? 70 : 0),
    );
    for (const front of this.fronts.active(tick))
      temperature = Math.min(
        temperature,
        Math.round(
          20 -
            front.value *
              Math.sin(
                (Math.PI * (tick - front.start)) / (front.end - front.start),
              ),
        ),
      );
    return {
      day: day + 1,
      temperature,
      rain,
      sun: rain ? 40 : drought ? 115 : 85,
      wind: 1 + Math.floor(randomSample(this.seed, 3, day) * 4),
      humidity: rain ? 95 : drought ? 25 : 60,
      kind:
        temperature < 10
          ? 'frost'
          : rain
            ? 'rain'
            : drought
              ? 'drought'
              : 'sun',
    };
  }
  forecast(tick: number) {
    const day = Math.floor(tick / DAY_TICKS);
    return [1, 2, 3]
      .filter((a) => day + a < 30)
      .map((a) => {
        const start = (day + a) * DAY_TICKS;
        const samples = Array.from({ length: 20 }, (_, i) =>
          this.at(start + i * 20),
        );
        const low = Math.min(...samples.map((w) => w.temperature)),
          high = Math.max(...samples.map((w) => w.temperature));
        return {
          day: day + a + 1,
          low: Math.floor((low - a * 5) / 10),
          high: Math.ceil((high + a * 5) / 10),
          kind: samples.some((w) => w.kind === 'frost')
            ? 'frost'
            : samples[0].kind,
          confidence: a === 1 ? 'wysoka' : a === 2 ? 'średnia' : 'niska',
        };
      });
  }
}
