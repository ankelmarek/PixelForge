export interface Point {
  x: number;
  y: number;
}
export interface Root extends Point {
  id: string;
  need: number;
  garden: number;
}
export interface Pool extends Point {
  radius: number;
}
export interface Rock extends Point {
  radius: number;
}
export interface Food extends Point {
  id: string;
}
export interface Predator extends Point {
  id: string;
  radius: number;
  speed: number;
}
export interface EarthwormWorld {
  schemaVersion: 1;
  id: 'under-garden';
  width: number;
  height: number;
  spawn: Point;
  roots: Root[];
  pools: Pool[];
  rocks: Rock[];
  food: Food[];
  predators: Predator[];
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Świat: wymagany obiekt');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error('Świat: nieprawidłowa liczba');
  return value;
}
export function validateWorld(value: unknown): EarthwormWorld {
  const w = record(value);
  if (w.schemaVersion !== 1 || w.id !== 'under-garden')
    throw Error('Świat: nieobsługiwana wersja lub identyfikator');
  const width = number(w.width, 4096, 8192),
    height = number(w.height, 4096, 8192);
  if (width % 256 || height % 256)
    throw Error('Świat: wymiary muszą pasować do sektorów');
  const point = (v: unknown) => {
    const p = record(v);
    return { x: number(p.x, 32, width - 32), y: number(p.y, 32, height - 32) };
  };
  const list = <T>(
    key: string,
    min: number,
    max: number,
    parse: (v: Record<string, unknown>) => T,
  ): T[] => {
    const items = w[key];
    if (!Array.isArray(items) || items.length < min || items.length > max)
      throw Error(`Świat: nieprawidłowe ${key}`);
    return items.map((v) => parse(record(v)));
  };
  const ids = new Set<string>();
  const id = (v: Record<string, unknown>) => {
    if (
      typeof v.id !== 'string' ||
      !/^[a-z0-9-]{1,40}$/.test(v.id) ||
      ids.has(v.id)
    )
      throw Error('Świat: powtórzony lub nieprawidłowy identyfikator');
    ids.add(v.id);
    return v.id;
  };
  const roots = list('roots', 12, 12, (v) => ({
    ...point(v),
    id: id(v),
    need: number(v.need, 1, 6),
    garden: number(v.garden, 0, 3),
  }));
  if (
    roots.some(
      (r) => !Number.isInteger(r.need) || !Number.isInteger(r.garden),
    ) ||
    [0, 1, 2, 3].some((g) => roots.filter((r) => r.garden === g).length !== 3)
  )
    throw Error('Świat: wymagane cztery ogrody');
  const pools = list('pools', 4, 80, (v) => ({
    ...point(v),
    radius: number(v.radius, 16, 100),
  }));
  const rocks = list('rocks', 0, 400, (v) => ({
    ...point(v),
    radius: number(v.radius, 8, 96),
  }));
  const food = list('food', 12, 200, (v) => ({ ...point(v), id: id(v) }));
  const predators = list('predators', 0, 12, (v) => ({
    ...point(v),
    id: id(v),
    radius: number(v.radius, 40, 240),
    speed: number(v.speed, 20, 60),
  }));
  const spawn = point(w.spawn);
  for (const p of [spawn, ...roots, ...pools, ...food])
    if (rocks.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < r.radius + 28))
      throw Error('Świat: obiekt zablokowany skałą');
  return {
    schemaVersion: 1,
    id: 'under-garden',
    width,
    height,
    spawn,
    roots,
    pools,
    rocks,
    food,
    predators,
  };
}
