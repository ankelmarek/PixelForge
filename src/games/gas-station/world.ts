import {
  validateWorldTerrain,
  inside,
  type Cell,
  type GridRect,
  type TerrainWorld,
} from '../../engine/api/strategy';

export const TILE = 16,
  UNIT = 256,
  DURATION = 7200,
  GOAL = 12;
export const PARCEL: GridRect = { x: 102, y: 106, width: 50, height: 44 };
export const SHOP: GridRect = { x: 112, y: 106, width: 22, height: 8 };
export const PUMPS = [
  { x: 116, y: 124 },
  { x: 128, y: 124 },
  { x: 140, y: 124 },
];
export const PARKING = [112, 120, 128, 136].map((x) => ({ x, y: 146 }));
export const DOCK = { x: 144, y: 110 },
  CASH = { x: 124, y: 112 };
export const GOODS = ['drink', 'snack', 'coffee'] as const;
export type Product = (typeof GOODS)[number];
export const FUELS = ['e95', 'on'] as const;
export type Fuel = (typeof FUELS)[number];
export const prices: Record<
  Fuel | Product,
  { buy: number; sell: number; label: string }
> = {
  e95: { buy: 450, sell: 600, label: 'E95' },
  on: { buy: 430, sell: 580, label: 'ON' },
  drink: { buy: 400, sell: 700, label: 'Napój' },
  snack: { buy: 500, sell: 900, label: 'Przekąska' },
  coffee: { buy: 200, sell: 800, label: 'Kawa' },
};
export interface StationWorld extends TerrainWorld {
  rulesRevision: 'opening-1';
  scenario: { id: 'opening-slice'; seed: number; duration: 7200; goal: 12 };
}
export function validateWorld(raw: unknown): StationWorld {
  const d = raw as StationWorld;
  if (
    !d ||
    d.schemaVersion !== 2 ||
    d.id !== 'orlar-krajowka' ||
    d.width !== 256 ||
    d.height !== 256 ||
    d.tileSize !== 16 ||
    d.rulesRevision !== 'opening-1' ||
    d.scenario?.id !== 'opening-slice' ||
    d.scenario.duration !== DURATION ||
    d.scenario.goal !== GOAL ||
    !Number.isSafeInteger(d.scenario.seed) ||
    d.scenario.seed < 0 ||
    d.scenario.seed > 0xffffffff ||
    !d.camera ||
    d.camera.minZoom !== 0.5 ||
    d.camera.maxZoom !== 2 ||
    !Number.isFinite(d.camera.zoom) ||
    d.camera.zoom < 0.5 ||
    d.camera.zoom > 2 ||
    !d.camera.center ||
    ![d.camera.center.x, d.camera.center.y].every(
      (v) => Number.isSafeInteger(v) && v >= 0 && v < 256,
    )
  )
    throw Error('Stacja: niezgodny scenariusz lub mapa');
  validateWorldTerrain(d, undefined, { width: 640, height: 960 });
  if (
    d.terrain.texture !== 'station-tiles' ||
    d.terrain.frames !== 16 ||
    d.terrain.sectorSize !== 32
  )
    throw Error('Stacja: niezgodny atlas');
  return structuredClone(d);
}

export function paved(p: Cell) {
  return (
    (p.y >= 153 && p.y <= 166) ||
    inside(p, { x: 96, y: 115, width: 57, height: 40 }) ||
    inside(p, { x: 136, y: 96, width: 25, height: 64 })
  );
}
export function walkable(p: Cell) {
  if (p.x < 98 || p.x > 151 || p.y < 105 || p.y > 151) return false;
  if (inside(p, SHOP) && (p.y === 106 || p.x === 112 || p.x === 133))
    return false;
  if (p.y === 113 && p.x >= 112 && p.x <= 133 && (p.x < 121 || p.x > 128))
    return false;
  return !PUMPS.some(
    (q) => p.x === q.x - 3 && p.y >= q.y - 1 && p.y <= q.y + 1,
  );
}
export function driveable(p: Cell) {
  return (
    p.x >= 0 &&
    p.x < 256 &&
    p.y >= 0 &&
    p.y < 256 &&
    paved(p) &&
    !inside(p, SHOP) &&
    !PUMPS.some((q) => p.x === q.x - 3 && p.y >= q.y - 1 && p.y <= q.y + 1)
  );
}
export const queuePoint = (index: number) => ({ x: 106, y: 134 + index * 6 });
export const checkoutPoint = (index: number) => ({
  x: 124,
  y: 114 + index * 3,
});
export const driverPort = (p: Cell) => ({ x: p.x + 3, y: p.y });
