import type {
  SectorData,
  SectorReference,
  TerrainWorld,
} from '../simulation/types';

export interface WorldLimits {
  maxCells: number;
  maxSectors: number;
}
export const defaultWorldLimits: WorldLimits = {
  maxCells: 4_194_304,
  maxSectors: 4096,
};
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('Świat: wymagany obiekt');
  return v as Record<string, unknown>;
};
const integer = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const identifier = (v: unknown) =>
  typeof v === 'string' && /^[\w-]{1,80}$/.test(v);

export function validateWorldTerrain(
  raw: unknown,
  limits = defaultWorldLimits,
  viewport = { width: 320, height: 180 },
): void {
  if (!integer(viewport.width, 1, 8192) || !integer(viewport.height, 1, 8192))
    throw Error('Świat: błędny viewport');
  const d = record(raw),
    t = record(d.terrain);
  const width = d.width as number,
    height = d.height as number;
  if (
    !integer(width, 8, limits.maxCells) ||
    !integer(height, 8, limits.maxCells) ||
    width * height > limits.maxCells
  )
    throw Error('Świat: przekroczony budżet komórek');
  if (
    !integer(t.sectorSize, 8, 64) ||
    width % Number(t.sectorSize) ||
    height % Number(t.sectorSize)
  )
    throw Error('Świat: wymiary muszą być wielokrotnością sektora');
  if (
    !identifier(t.revision) ||
    !identifier(t.texture) ||
    !integer(t.frames, 1, 256) ||
    !integer(t.fallbackColor, 0, 0xffffff) ||
    !integer(t.cacheSectors, 4, 64)
  )
    throw Error('Świat: błędna konfiguracja terenu');
  const columns = width / Number(t.sectorSize),
    rows = height / Number(t.sectorSize);
  if (
    !Array.isArray(t.sectors) ||
    t.sectors.length !== columns * rows ||
    t.sectors.length > limits.maxSectors
  )
    throw Error('Świat: niepełny katalog sektorów lub przekroczony budżet');
  const ids = new Set<string>(),
    positions = new Set<string>();
  for (const rawSector of t.sectors) {
    const s = record(rawSector),
      pos = `${s.x},${s.y}`;
    if (
      !identifier(s.id) ||
      ids.has(String(s.id)) ||
      positions.has(pos) ||
      !integer(s.x, 0, columns - 1) ||
      !integer(s.y, 0, rows - 1) ||
      typeof s.url !== 'string' ||
      !/^[\w/-]+\.json$/.test(s.url) ||
      s.url.startsWith('/') ||
      s.url.split('/').includes('..')
    )
      throw Error('Świat: błędny lub powtórzony sektor');
    ids.add(String(s.id));
    positions.add(pos);
  }
  const camera = record(d.camera),
    tile = Number(d.tileSize);
  const sectorPixels = Number(t.sectorSize) * tile;
  // Includes one sector of prefetch on each side, with one partial sector at either edge.
  const minZoom = Number(camera.minZoom);
  const needed =
    Math.min(columns, Math.ceil(viewport.width / minZoom / sectorPixels) + 3) *
    Math.min(rows, Math.ceil(viewport.height / minZoom / sectorPixels) + 3);
  if (
    !Number.isFinite(minZoom) ||
    minZoom <= 0 ||
    needed > Number(t.cacheSectors)
  )
    throw Error('Świat: cache nie mieści widoku i marginesu');
  if (
    width * tile < viewport.width / minZoom ||
    height * tile < viewport.height / minZoom
  )
    throw Error('Świat: zoom odsłania obszar poza mapą');
}

export function validateSector(
  raw: unknown,
  world: TerrainWorld,
  ref: SectorReference,
): SectorData {
  const d = record(raw),
    cells = world.terrain.sectorSize ** 2;
  if (
    d.schemaVersion !== 1 ||
    d.id !== ref.id ||
    d.revision !== world.terrain.revision ||
    !Array.isArray(d.layers) ||
    !d.layers.length ||
    d.layers.length > 4
  )
    throw Error(`Sektor ${ref.id}: niezgodny nagłówek`);
  const names = new Set<string>();
  d.layers.forEach((rawLayer, layerIndex) => {
    const layer = record(rawLayer);
    if (
      !identifier(layer.name) ||
      names.has(String(layer.name)) ||
      !Array.isArray(layer.runs) ||
      layer.runs.length > cells
    )
      throw Error(`Sektor ${ref.id}: błędna warstwa`);
    names.add(String(layer.name));
    let total = 0;
    for (const run of layer.runs) {
      if (
        !Array.isArray(run) ||
        run.length !== 2 ||
        !integer(run[0], layerIndex ? -1 : 0, world.terrain.frames - 1) ||
        !integer(run[1], 1, cells)
      )
        throw Error(`Sektor ${ref.id}: błędny kafel`);
      total += run[1];
    }
    if (total !== cells) throw Error(`Sektor ${ref.id}: niepełna warstwa`);
  });
  return d as unknown as SectorData;
}
