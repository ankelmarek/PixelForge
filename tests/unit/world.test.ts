import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateSimulationLevel } from '../../src/engine/simulation/validation';
import { validateSector } from '../../src/engine/world/validation';
import { SectorCache, sectorsInView } from '../../src/engine/world/sectors';
import { RegionalNavigator } from '../../src/engine/world/navigation';
import { Navigator } from '../../src/engine/simulation/navigation';
import { SimulationModel } from '../../src/engine/simulation/model';
import { SimulationSave } from '../../src/engine/simulation/save';
import { StorageService } from '../../src/engine/systems/storage';
import type {
  SectorReference,
  WorldLevel,
} from '../../src/engine/simulation/types';
import { worldDemo } from '../../src/demos/large-world';
const base = 'public/assets/demos/large-world/';
const world = (size = 4096) =>
  validateSimulationLevel(
    JSON.parse(readFileSync(`${base}world-${size}.json`, 'utf8')),
  ) as WorldLevel;
const sector = (l: WorldLevel, ref: SectorReference) =>
  validateSector(JSON.parse(readFileSync(base + ref.url, 'utf8')), l, ref);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
describe('wersjonowane światy i sektory', () => {
  it.each([4096, 8192])(
    '%i px: komplet sektorów i warstw przechodzi parser runtime',
    (size) => {
      const l = world(size);
      expect(l.width * l.tileSize).toBe(size);
      for (const ref of l.terrain.sectors)
        expect(sector(l, ref).layers).toHaveLength(2);
    },
  );
  it('wymiary są danymi, także powyżej 8192; budżety pozostają konfigurowalne', () => {
    const l = world(8192);
    l.width *= 2;
    l.terrain.sectors.push(
      ...l.terrain.sectors.map((r) => ({
        ...r,
        id: `${r.id}-east`,
        x: r.x + 16,
      })),
    );
    expect(validateSimulationLevel(l).width * l.tileSize).toBe(16384);
    expect(() =>
      validateSimulationLevel(l, { maxCells: 1024, maxSectors: 1024 }),
    ).toThrow(/budżet/);
  });
  it.each([
    'duplicate',
    'missing',
    'bounds',
    'path',
    'version',
    'cache',
    'zoom',
  ])('odrzuca wadliwy manifest: %s', (kind) => {
    const l = world();
    if (kind === 'duplicate') l.terrain.sectors[1] = l.terrain.sectors[0];
    if (kind === 'missing') l.terrain.sectors.pop();
    if (kind === 'bounds') l.width--;
    if (kind === 'path') l.terrain.sectors[0].url = '../secret.json';
    if (kind === 'version') l.terrain.revision = '';
    if (kind === 'cache') l.terrain.cacheSectors = 4;
    if (kind === 'zoom') l.camera.minZoom = 0.01;
    expect(() => validateSimulationLevel(l)).toThrow();
  });
  it('odrzuca zły sektor, wersję, niepełną warstwę, przezroczyste podłoże i obcy kafel', () => {
    const l = world(),
      ref = l.terrain.sectors[0],
      raw = sector(l, ref);
    for (const value of [
      { ...raw, id: 'other' },
      { ...raw, revision: 'other' },
      { ...raw, layers: [{ name: 'ground', runs: [[0, 1023]] }] },
      { ...raw, layers: [{ name: 'ground', runs: [[-1, 1024]] }] },
      { ...raw, layers: [{ name: 'ground', runs: [[16, 1024]] }] },
    ])
      expect(() => validateSector(value, l, ref)).toThrow();
  });
  it('RLE roads and water agree across sector seams in absolute coordinates', () => {
    const l = world(),
      expand = (ref: SectorReference) =>
        sector(l, ref).layers[0].runs.flatMap(([f, n]) =>
          Array<number>(n).fill(f),
        );
    for (let sx = 0; sx < 7; sx++) {
      const a = expand(l.terrain.sectors.find((r) => r.x === sx && r.y === 0)!);
      const b = expand(
        l.terrain.sectors.find((r) => r.x === sx + 1 && r.y === 0)!,
      );
      expect(a[31 * 32 + 31]).toBe(4);
      expect(b[31 * 32]).toBe(4);
    }
  });
});
it('cache ma limit, ewakuuje stare dane i pobiera tylko widoczne regiony z marginesem', async () => {
  const l = world(8192),
    error = vi.fn();
  l.terrain.cacheSectors = 24;
  const cache = new SectorCache(l, async (r) => sector(l, r), error);
  for (let i = 0; i < 12; i++) {
    const wanted = sectorsInView(l, {
      x: i * 512,
      y: i * 512,
      width: 640,
      height: 360,
    });
    cache.update(wanted);
    await flush();
    await flush();
    await flush();
    expect(wanted.every((r) => cache.get(r.id))).toBe(true);
    expect(cache.stats.resident).toBeLessThanOrEqual(24);
    expect(cache.stats.pending).toBeLessThanOrEqual(4);
  }
  expect(cache.stats.evictions).toBeGreaterThan(0);
  expect(error).not.toHaveBeenCalled();
  cache.destroy();
  expect(cache.stats.resident).toBe(0);
});
it('zmiana widoku i destroy unieważniają spóźnione odpowiedzi; błąd nie zapętla retry', async () => {
  const l = world(),
    error = vi.fn();
  const waiting: {
    resolve: (v: unknown) => void;
    signal: AbortSignal;
    ref: SectorReference;
  }[] = [];
  const cache = new SectorCache(
    l,
    (ref, signal) =>
      new Promise((resolve) => waiting.push({ resolve, signal, ref })),
    error,
    1,
  );
  cache.update([l.terrain.sectors[0]]);
  cache.update([l.terrain.sectors[1]]);
  expect(waiting[0].signal.aborted).toBe(true);
  waiting[0].resolve(sector(l, waiting[0].ref));
  await flush();
  expect(cache.get(waiting[0].ref.id)).toBeUndefined();
  cache.destroy();
  waiting[1].resolve(sector(l, waiting[1].ref));
  await flush();
  expect(cache.stats.resident).toBe(0);
  const broken = new SectorCache(
    l,
    async () => {
      throw Error('404');
    },
    error,
  );
  broken.update([l.terrain.sectors[0]]);
  await flush();
  broken.update([l.terrain.sectors[0]]);
  await flush();
  expect(error).toHaveBeenCalledOnce();
  expect(broken.stats.requests).toBe(1);
  broken.destroy();
});
it.each([4096, 8192])(
  'długie trasy %i: regionalne przejścia, ciągłość i prześwit pojazdu',
  (size) => {
    const l = world(size),
      nav = new Navigator(l);
    const to = { x: l.width - 2, y: 32 };
    const path = nav.findPath({ x: 1, y: 32 }, to, true)!;
    expect(path.at(-1)).toEqual(to);
    let prev = { x: 1, y: 32 };
    for (const p of path) {
      expect(nav.walkable(p, true)).toBe(true);
      expect(Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y)).toBe(1);
      prev = p;
    }
    expect(nav.stats[0].maxLocalExpanded).toBeLessThanOrEqual(1024);
    expect(nav.stats[0].localExpanded).toBeLessThan((l.width * l.height) / 4);
    expect(nav.findPath({ x: 1, y: 32 }, { x: 100, y: 100 }, true)).toBeNull();
  },
);
it('graf rozróżnia rozłączne komponenty regionu i potrafi obejść ścianę przez odległe przejście', () => {
  const l = world();
  l.blockers = [{ x: 31, y: 0, width: 1, height: 230 }];
  l.nodes = [];
  const nav = new Navigator(l),
    from = { x: 30, y: 2 },
    to = { x: 32, y: 2 };
  const path = nav.findPath(from, to)!;
  expect(path.some((p) => p.y >= 230)).toBe(true);
  expect(path.at(-1)).toEqual(to);
  l.blockers[0].height = l.height;
  expect(new Navigator(l).findPath(from, to)).toBeNull();
  const limited = new RegionalNavigator(l, () => true, {
    abstract: 1,
    local: 1,
  });
  expect(limited.findPath({ x: 1, y: 1 }, { x: 250, y: 250 })).toBeNull();
  expect(limited.stats.outcome).toBe('budget');
});
it('zapis v2 zachowuje zadanie, kamerę i krok czasu; izolacja oraz zgodność wersji świata', () => {
  const l = world(8192),
    model = new SimulationModel(l),
    values = new Map<string, string>();
  const storage = new StorageService({
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  });
  model.gather('remote-source');
  model.step(15.023);
  const save = new SimulationSave(worldDemo(8192), model, storage);
  save.camera = { x: 7500, y: 7500, zoom: 0.5 };
  expect(save.write()).toBe(true);
  const copy = new SimulationModel(l),
    resume = new SimulationSave(worldDemo(8192), copy, storage);
  expect(resume.read()).toBe(true);
  expect(copy.state).toEqual(model.state);
  expect(resume.camera).toEqual(save.camera);
  expect(copy.state.actors[0].current!.path.length).toBeGreaterThan(500);
  expect(
    new SimulationSave(
      worldDemo(4096),
      new SimulationModel(world()),
      storage,
    ).read(),
  ).toBe(false);
  const changed = structuredClone(l);
  changed.terrain.revision = 'terrain-2';
  expect(
    new SimulationSave(
      worldDemo(8192),
      new SimulationModel(changed),
      storage,
    ).read(),
  ).toBe(false);
  const key = 'pixelforge:world:v2:world-lab-8192',
    valid = values.get(key)!;
  const invalid = JSON.parse(valid);
  invalid.state.actors[0].current.path[0] = { x: 0, y: 0 };
  values.set(key, JSON.stringify(invalid));
  expect(resume.read()).toBe(false);
  values.set(key, '{broken');
  expect(resume.read()).toBe(false);
  expect(values.has('pixelforge:simulation:v1:world-lab-8192')).toBe(false);
});
it('model poza rendererem wykonuje dalekie zadania i pełen cykl bez utraty zasobów', () => {
  const model = new SimulationModel(world());
  model.gather('source');
  model.gather('remote-source');
  model.toggleProcessor('processor');
  for (let i = 0; i < 3600 && !model.state.completed; i++) {
    const vehicle = model.state.actors.find((a) => a.id === 'vehicle')!;
    if (!vehicle.current && !vehicle.queue.length) {
      model.transport('load', 'depot');
      model.transport('deliver', 'processor');
    }
    model.step(1);
    expect(model.resourceValue()).toBe(48);
  }
  expect(model.state.completed).toBe(true);
  expect(model.produced).toBe(48);
  const a = new SimulationModel(world()),
    b = new SimulationModel(world());
  a.gather('source');
  b.gather('source');
  a.step(5.023);
  for (let i = 0; i < 500; i++) b.step(0.01);
  b.step(0.023);
  expect(a.state.actors).toEqual(b.state.actors);
  expect(a.state.nodes).toEqual(b.state.nodes);
  expect(a.state.remainder).toBeCloseTo(b.state.remainder!, 8);
});

it('przejście przez granicę wybiera bliski portal zamiast narożnika sektora', () => {
  const nav = new Navigator(world());
  const path = nav.findPath({ x: 43, y: 26 }, { x: 29, y: 32 })!;
  expect(path.length).toBeLessThanOrEqual(26);
});
