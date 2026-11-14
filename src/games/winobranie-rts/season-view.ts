import type { Cell } from '../../engine/api/strategy';
import { phase, plotPoint } from './agronomy';
import { siteAt } from './climate';
import { varieties } from './cultivars';
import type { VineyardModel } from './model';
import { WATER_CAPACITY } from './water';

export const weatherNames = {
  sun: '☀ Pogodnie',
  rain: '☂ Deszcz',
  frost: '❄ Przymrozek',
  drought: '♨ Susza',
};
export const deviceNames = {
  tank: 'Zbiornik',
  pump: 'Pompa',
  sprinkler: 'Zraszacz',
};
export function seasonView(
  model: VineyardModel,
  selected: string | undefined,
  hover: Cell | undefined,
) {
  const s = model.state,
    env = s.environment;
  if (!env) return null;
  const w = model.climate.at(s.tick),
    row = s.rows.find((r) => r.id === selected),
    device = env.water.devices.find((d) => d.id === selected);
  const crop = row ? env.crops[row.id] : undefined;
  const point = row ? plotPoint(row, 0) : hover;
  const site = point ? siteAt(env.seed, point) : undefined;
  const mean = (field: 'buds' | 'moisture' | 'mildew') =>
    crop
      ? Math.round(
          crop.plots.reduce((n, p) => n + p[field], 0) /
            crop.plots.length /
            100,
        )
      : 0;
  const ice = crop?.plots.some((p) => p.ice > 0);
  let detail = '';
  if (crop && row)
    detail = `${phase(row, crop)} · ${crop.age ? `${crop.age} lata` : 'Młode nasadzenie (10% plonu)'}\nWilgotność ${mean('moisture')}% · zdrowe pąki ${mean('buds')}%\nMączniak ${mean('mildew')}%${ice ? ' · Lód — zraszaj do odmarznięcia' : ''}\n${varieties[row.variety].note}`;
  if (device) {
    const connected = model.water?.connected.has(device.id);
    detail =
      device.kind === 'tank'
        ? `${Math.floor(device.volume / 1000)} / 1000 L${device.delivery ? ` · dostawa za ${Math.ceil((device.delivery.due - s.tick) / 20)} s` : ''}`
        : `${connected ? 'Połączony ze zbiornikiem i pompą' : 'Brak połączenia — poprowadź rury'}${device.kind === 'sprinkler' ? `\nStrumień ${Math.round((model.water?.flow.get(device.id) ?? 0) * 100)}% · zasięg 7 pól` : '\nWydajność 2 L/s · energia 0,20 ◈/s'}`;
  }
  return {
    weather: `${weatherNames[w.kind]} · ${(w.temperature / 10).toFixed(1)}°C`,
    kind: w.kind,
    day: `Dzień ${w.day} / 30`,
    forecast: model.climate.forecast(s.tick).map((f) => ({
      text: `D${f.day} ${weatherNames[f.kind]} ${f.low}…${f.high}°`,
      confidence: f.confidence,
    })),
    water: `${Math.floor(env.water.devices.reduce((n, d) => n + d.volume, 0) / 1000)} L zapasu · ${Math.floor(env.water.used / 1000)} L zużyte`,
    site: site
      ? `${site.soil} · słońce ${site.sun}% · retencja ${site.retention}% · mikroklimat ${(site.cold / 10).toFixed(1)}°C`
      : '',
    detail,
    mode: device && device.kind !== 'tank' ? device.mode : null,
    tank: device?.kind === 'tank',
    refillCost:
      device?.kind === 'tank'
        ? Math.ceil(Math.min(500000, WATER_CAPACITY - device.volume) / 1000)
        : 0,
    delivery: !!device?.delivery,
    canCare:
      !!crop &&
      !!row &&
      !row.mature &&
      !row.work &&
      !crop.care &&
      crop.plots.some((p) => p.mildew > 0),
    carePending: !!crop?.care,
    deviceName: device ? deviceNames[device.kind] : '',
  };
}
export type SeasonView = ReturnType<typeof seasonView>;
