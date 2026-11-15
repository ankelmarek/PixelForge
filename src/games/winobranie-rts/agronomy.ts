import type { Cell } from '../../engine/api/strategy';
import type { Row } from './model';
import { varieties } from './cultivars';
import { siteAt, type Weather } from './climate';
import {
  newWater,
  type WaterState,
  type WaterDevice,
  WaterNetwork,
  SPRINKLER_RADIUS,
} from './water';
export interface Plot {
  heat: number;
  moisture: number;
  buds: number;
  mildew: number;
  ice: number;
  thaw: number;
  interrupted: boolean;
  yielded: boolean;
}
export interface Crop {
  age: number;
  care: number;
  plots: Plot[];
}
export interface EnvironmentState {
  seed: number;
  crops: Record<string, Crop>;
  water: WaterState;
  potentialLost: number;
}
export const newEnvironment = (seed: number): EnvironmentState => ({
  seed,
  crops: {},
  water: newWater(),
  potentialLost: 0,
});
export function newCrop(row: Row, age: number): Crop {
  return {
    age,
    care: 0,
    plots: Array.from({ length: Math.ceil(row.cells.length / 8) }, () => ({
      heat: 0,
      moisture: 6200,
      buds: 10000,
      mildew: 0,
      ice: 0,
      thaw: 0,
      interrupted: false,
      yielded: false,
    })),
  };
}
export function plotCells(row: Row, i: number) {
  return row.cells.slice(i * 8, (i + 1) * 8).filter((_, j) => j % 2 === 0);
}
export function plotPoint(row: Row, i: number): Cell {
  const cells = plotCells(row, i);
  return cells[Math.floor(cells.length / 2)];
}
export function phase(row: Row, crop: Crop) {
  if (row.work || row.planted < 0) return 'Sadzenie';
  if (crop.plots.every((p) => p.yielded))
    return row.stock ? 'Zbiór' : 'Spoczynek';
  const h =
    crop.plots.reduce((n, p) => n + p.heat, 0) /
    crop.plots.length /
    varieties[row.variety].heat;
  return h < 0.12
    ? 'Pąki'
    : h < 0.32
      ? 'Kwitnienie'
      : h < 0.65
        ? 'Zawiązanie'
        : 'Dojrzewanie';
}
export function needsWater(
  d: WaterDevice,
  rows: Row[],
  env: EnvironmentState,
  w: Weather,
) {
  if (w.temperature + siteAt(env.seed, d).cold < 15) return true;
  return rows.some((r) =>
    env.crops[r.id].plots.some(
      (p, i) =>
        Math.hypot(plotPoint(r, i).x - d.x, plotPoint(r, i).y - d.y) <=
          SPRINKLER_RADIUS + 4 &&
        (p.ice > 0 || (!p.yielded && p.moisture < 3500)),
    ),
  );
}
export function stepCrop(
  row: Row,
  crop: Crop,
  env: EnvironmentState,
  w: Weather,
  water: WaterNetwork,
  tick: number,
) {
  if (row.work || row.planted < 0) return 0;
  const v = varieties[row.variety];
  let grown = 0;
  crop.plots.forEach((p, i) => {
    const cells = plotCells(row, i),
      site = siteAt(env.seed, plotPoint(row, i));
    const temperature = w.temperature + site.cold;
    const flow =
      cells.reduce((n, c) => n + water.coverage(c), 0) / cells.length;
    if (flow > 0.95 && temperature < 10) {
      p.ice = Math.min(200, p.ice + 1);
      p.thaw = 0;
    }
    if (p.ice > 0 && flow < 0.95) p.interrupted = true;
    if (temperature >= 10) {
      p.thaw = Math.min(200, p.thaw + 1);
      if (p.thaw >= 200) {
        p.ice = 0;
        p.interrupted = false;
      }
    } else p.thaw = 0;
    if (p.yielded) return;
    const critical =
      p.heat < v.heat * 0.12 ? -25 : p.heat < v.heat * 0.65 ? -5 : -12;
    const deficit = Math.max(0, critical - temperature);
    const damage = Math.ceil(
      ((deficit * v.frost) / 500) *
        (1 - Math.min(1, flow)) *
        (p.ice && flow < 0.95 ? 1.5 : 1),
    );
    p.buds = Math.max(0, p.buds - damage - (p.ice > 0 && flow < 0.95 ? 1 : 0));
    if (tick % 20 === 0) {
      const evaporation = Math.round(
        ((v.drought * (100 - site.retention)) / 70) *
          (w.kind === 'drought' ? 2 : 1),
      );
      p.moisture = Math.min(
        10000,
        Math.max(
          0,
          p.moisture + w.rain * 160 + Math.floor(flow * 180) - evaporation,
        ),
      );
      p.mildew = Math.min(
        3500,
        Math.max(
          0,
          p.mildew +
            (p.moisture > 8000 && w.temperature > 140 ? v.disease : -2),
        ),
      );
      if (p.moisture < 1800) p.buds = Math.max(0, p.buds - v.drought);
    }
    p.heat += Math.max(
      0,
      Math.floor(
        (((((temperature - 40) * site.sun) / 100) * w.sun) / 85) *
          (p.moisture < 1800 ? 0.5 : 1),
      ),
    );
    if (p.heat >= v.heat) {
      p.yielded = true;
      const age = crop.age === 0 ? 0.1 : crop.age === 1 ? 0.55 : 1;
      const potential = ((cells.length * 2000 * v.yield) / 100) * age;
      const actual =
        Math.floor(
          (((potential * p.buds) / 10000) * (10000 - p.mildew)) / 10000 / 100,
        ) * 100;
      grown += actual;
      env.potentialLost += Math.round(potential - actual);
    }
  });
  row.mature = crop.plots.every((p) => p.yielded);
  row.stock += grown;
  return grown;
}
