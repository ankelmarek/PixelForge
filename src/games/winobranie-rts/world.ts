import {
  validateWorldTerrain,
  type TerrainWorld,
} from '../../engine/api/strategy';
export type Variety = 'solaris' | 'regent' | 'johanniter';
export const varieties: Record<
  Variety,
  { name: string; frame: number; color: number; price: number }
> = {
  solaris: { name: 'Solaris', frame: 8, color: 0xd8ce65, price: 18 },
  regent: { name: 'Regent', frame: 9, color: 0x9e6cb0, price: 22 },
  johanniter: { name: 'Johanniter', frame: 10, color: 0xb7d48b, price: 20 },
};
export interface VineyardWorld extends TerrainWorld {
  scenario: {
    id: 'first-harvest';
    seconds: 360;
    seed: 731;
    initialCash: 30000;
    goal: 40000;
  };
}
export function validateWorld(data: unknown): VineyardWorld {
  validateWorldTerrain(data, undefined, { width: 640, height: 960 });
  const d = data as VineyardWorld;
  if (
    d.schemaVersion !== 2 ||
    d.id !== 'vineyard-w1' ||
    d.width !== 512 ||
    d.height !== 512 ||
    d.tileSize !== 16 ||
    d.terrain.revision !== 'vineyard-w1' ||
    d.terrain.texture !== 'vineyard-ground' ||
    d.terrain.frames !== 7 ||
    d.terrain.sectorSize !== 32 ||
    d.camera.minZoom !== 0.5 ||
    d.camera.maxZoom !== 2 ||
    d.camera.zoom !== 0.5 ||
    d.camera.center?.x !== 253 ||
    d.camera.center.y !== 250 ||
    d.scenario?.id !== 'first-harvest' ||
    d.scenario.seconds !== 360 ||
    d.scenario.seed !== 731 ||
    d.scenario.initialCash !== 30000 ||
    d.scenario.goal !== 40000
  )
    throw Error('Winobranie RTS: niezgodny scenariusz W1');
  return d;
}
export const riverAt = (y: number) => 120 + Math.trunc(18 * Math.sin(y / 45));
export const publicRoad = (x: number, y: number) =>
  x >= 0 &&
  x < 512 &&
  ((y >= 256 && y <= 260) || (y >= 64 && y <= 66 && x < 300));
export const terrainBlocked = (x: number, y: number) =>
  x < 0 ||
  y < 0 ||
  x >= 512 ||
  y >= 512 ||
  (Math.abs(x - riverAt(y)) < 5 && !publicRoad(x, y)) ||
  (x > 350 && y < 180 && (x + y) % 31 < 6);
