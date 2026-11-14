import {
  validateWorldTerrain,
  type TerrainWorld,
} from '../../engine/api/strategy';
export { varieties, type Variety } from './cultivars';
export interface VineyardWorld extends TerrainWorld {
  scenario: {
    id: 'living-season';
    seconds: 600;
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
    d.scenario?.id !== 'living-season' ||
    d.scenario.seconds !== 600 ||
    d.scenario.seed !== 731 ||
    d.scenario.initialCash !== 30000 ||
    d.scenario.goal !== 40000
  )
    throw Error('Winobranie RTS: niezgodny scenariusz W2');
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
