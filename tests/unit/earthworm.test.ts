import { describe, expect, it } from 'vitest';
import raw from '../../public/assets/games/earthworm/world.json';
import { validateWorld } from '../../src/games/earthworm/world';
import { WormModel, CAPACITY } from '../../src/games/earthworm/model';
import { MutableGrid } from '../../src/engine/api/terrain';
import { VersionedSave } from '../../src/engine/systems/versioned-save';
import { StorageService } from '../../src/engine/systems/storage';
import { validateDefinition } from '../../src/engine/api/validation';
import { earthworm } from '../../src/games/earthworm';
import { playCampaign } from '../fixtures/earthworm-route';
import { mkdirSync, writeFileSync } from 'node:fs';

const world = validateWorld(raw);
function advance(model: WormModel, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / 0.1); i++) model.tick(0.1);
}
function go(model: WormModel, x: number, y: number) {
  model.steer(x, y);
  for (
    let i = 0;
    i < 500 && Math.hypot(model.state.x - x, model.state.y - y) > 3;
    i++
  )
    model.tick(0.1);
  expect(Math.hypot(model.state.x - x, model.state.y - y)).toBeLessThan(4);
}

describe('dżdżownica: mechanika klienta', () => {
  it('ostatni rozkwit kończy symulację przed kolizją w tej samej klatce', () => {
    const root = world.roots.at(-1)!;
    const m = new WormModel({
      ...world,
      predators: [
        { id: 'final-test', x: root.x, y: root.y, radius: 90, speed: 40 },
      ],
    });
    m.state.roots = world.roots.map((r, i) => (i < 11 ? r.need : r.need - 1));
    m.state.x = root.x;
    m.state.y = root.y;
    m.state.nutrients = 1;
    m.state.hydration = 100;
    for (let i = 0; i < 17; i++) m.tick(0.02);
    m.state.predators[0] = { x: root.x, y: root.y, alert: 1 };
    m.tick(0.02);
    expect(m.state.completed).toBe(true);
    expect(m.state.failed).toBe(false);
    expect(m.state.lives).toBe(3);
    const invalid = m.snapshot();
    invalid.lives = 0;
    invalid.failed = true;
    expect(() => m.validateSave(invalid)).toThrow(/niespójny/);
  });
  it('waliduje świat 4096, definicję i odrzuca uszkodzone dane', () => {
    expect(world.width).toBe(4096);
    expect(validateDefinition(earthworm)).toBe(earthworm);
    expect(() => validateWorld({ ...raw, schemaVersion: 99 })).toThrow(
      /wersja/,
    );
    expect(() => validateWorld({ ...raw, width: 4000 })).toThrow();
    expect(() =>
      validateWorld({ ...raw, roots: [...raw.roots, raw.roots[0]] }),
    ).toThrow();
    expect(() =>
      validateWorld({ ...raw, food: [...raw.food, { ...raw.food[0], x: -1 }] }),
    ).toThrow();
    expect(() =>
      validateWorld({ ...raw, rocks: [{ ...raw.spawn, radius: 40 }] }),
    ).toThrow(/zablokowany/);
    expect(() =>
      validateDefinition({ ...earthworm, createRuntime: 'eval()' }),
    ).toThrow(/TypeScript/);
  });
  it('pierwsze jedzenie, drążenie i ożywienie korzenia bez instrukcji lub specjalnego klawisza', () => {
    const m = new WormModel(world),
      before = m.terrain.count;
    for (const food of world.food.slice(0, 3)) go(m, food.x, food.y);
    expect(m.state.nutrients).toBe(3);
    go(m, world.roots[0].x, world.roots[0].y);
    advance(m, 2);
    expect(m.blooms).toBe(1);
    expect(m.state.checkpoint).toBe(0);
    expect(m.state.nutrients).toBe(0);
    expect(m.terrain.count).toBeGreaterThan(before);
  });
  it('zachowuje wynik ruchu przy różnych FPS i łańcuch segmentów', () => {
    const a = new WormModel(world),
      b = new WormModel(world);
    a.steer(1000, 400);
    b.steer(1000, 400);
    for (let i = 0; i < 300; i++) a.tick(1 / 60);
    for (let i = 0; i < 100; i++) b.tick(1 / 20);
    expect(a.state.x).toBeCloseTo(b.state.x, 1);
    expect(a.state.y).toBeCloseTo(b.state.y, 1);
    for (let i = 1; i < a.segments.length; i++)
      expect(
        Math.hypot(
          a.segments[i].x - a.segments[i - 1].x,
          a.segments[i].y - a.segments[i - 1].y,
        ),
      ).toBeLessThan(5.51);
  });
  it('skały i brzeg zatrzymują głowę; tunele nie usuwają skał', () => {
    const rock = world.rocks[0],
      m = new WormModel({
        ...world,
        spawn: { x: rock.x - rock.radius - 22, y: rock.y },
      });
    m.steer(rock.x + rock.radius + 40, rock.y);
    advance(m, 4);
    expect(m.state.x).toBeLessThan(rock.x - rock.radius);
    expect(m.terrain.get(Math.floor(rock.x / 8), Math.floor(rock.y / 8))).toBe(
      2,
    );
    m.steer(-500, -500);
    advance(m, 60);
    expect(m.state.x).toBeGreaterThanOrEqual(20);
    expect(m.state.y).toBeGreaterThanOrEqual(20);
  });
  it('wilgoć spada podczas suszy, rosa uzupełnia zapas i zwinięcie ogranicza utratę', () => {
    const m = new WormModel(world);
    m.state.roots = world.roots.map((r, i) => (i < 3 ? r.need : 0));
    m.state.x = 1600;
    m.state.y = 1500;
    m.state.hydration = 60;
    advance(m, 10);
    expect(m.state.hydration).toBeCloseTo(52, 1);
    m.toggleHide();
    advance(m, 10);
    expect(m.state.hydration).toBeCloseTo(50, 1);
    m.state.x = world.pools[0].x;
    m.state.y = world.pools[0].y;
    advance(m, 4);
    expect(m.state.hydration).toBe(100);
  });
  it('drapieżnik zapowiada atak, zwinięcie chroni; obrażenia prowadzą do porażki', () => {
    const m = new WormModel(world);
    m.state.roots = world.roots.map((r, i) => (i < 3 ? r.need : 0));
    const p = world.predators[0];
    m.state.x = p.x;
    m.state.y = p.y;
    m.toggleHide();
    advance(m, 2);
    expect(m.state.lives).toBe(3);
    expect(m.state.predators[0].alert).toBe(0);
    m.toggleHide();
    m.state.predators[0] = { x: m.state.x, y: m.state.y, alert: 1 };
    advance(m, 0.1);
    expect(m.state.lives).toBe(2);
    expect(m.state.x).toBe(world.spawn.x);
    m.state.invulnerable = 0;
    m.state.hydration = 0;
    m.state.x = 1600;
    m.state.y = 1500;
    advance(m, 0.1);
    expect(m.state.lives).toBe(1);
    m.state.invulnerable = 0;
    m.state.hydration = 0;
    m.state.x = 1600;
    m.state.y = 1500;
    advance(m, 0.1);
    expect(m.state.failed).toBe(true);
    const elapsed = m.state.seconds;
    advance(m, 5);
    expect(m.state.seconds).toBe(elapsed);
  });
  it('pełny plecak nie usuwa pokarmu, zjedzony pokarm odnawia się', () => {
    const m = new WormModel(world),
      food = world.food[0];
    m.state.nutrients = CAPACITY;
    go(m, food.x, food.y);
    expect(m.state.food[0]).toBe(0);
    m.state.nutrients--;
    advance(m, 0.1);
    expect(m.state.food[0]).toBeGreaterThan(74);
    go(m, world.spawn.x, world.spawn.y);
    advance(m, 76);
    expect(m.state.food[0]).toBe(0);
  });
  it('zapis odtwarza teren i postęp; odrzuca obce wersje, skały, duplikaty i uszkodzony JSON', () => {
    const m = new WormModel(world);
    go(m, 528, 488);
    const data = new Map<string, string>(),
      storage = new StorageService({
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
          data.set(key, value);
        },
      });
    const save = new VersionedSave(
      'earthworm',
      1,
      (v) => m.validateSave(v),
      storage,
    );
    expect(save.write(m.snapshot())).toBe(true);
    const other = new VersionedSave(
      'other-game',
      1,
      (v) => m.validateSave(v),
      storage,
    );
    expect(other.read()).toBeUndefined();
    const n = new WormModel(world);
    n.restore(save.read());
    expect(n.snapshot()).toEqual(m.snapshot());
    const saved = m.snapshot();
    saved.tunnels.push(saved.tunnels[0]);
    expect(() => n.restore(saved)).toThrow();
    expect(n.snapshot()).toEqual(m.snapshot());
    for (const raw of [
      '{broken',
      JSON.stringify({
        schemaVersion: 99,
        gameId: 'earthworm',
        state: m.snapshot(),
      }),
    ]) {
      data.set(save.key, raw);
      expect(save.read()).toBeUndefined();
    }
    const denied = new VersionedSave(
      'earthworm',
      1,
      (v) => m.validateSave(v),
      new StorageService({
        getItem: () => {
          throw Error();
        },
        setItem: () => {
          throw Error();
        },
      }),
    );
    expect(denied.read()).toBeUndefined();
    expect(denied.write(m.snapshot())).toBe(false);
  });
  it('wszystkie korzenie domykają cykl pogody i wygraną; restart daje czysty teren', () => {
    const m = new WormModel(world),
      weather = new Set<string>();
    for (let i = 0; i < world.roots.length; i++) {
      const root = world.roots[i];
      weather.add(m.weather);
      // Isolate progression rules; movement/foraging are tested separately and in the full route test.
      m.state.x = root.x;
      m.state.y = root.y;
      m.state.nutrients = root.need;
      m.state.hydration = 100;
      advance(m, 2);
      expect(m.state.roots[i]).toBe(root.need);
    }
    expect(weather).toEqual(new Set(['dew', 'sun', 'rain', 'dusk']));
    expect(m.state.completed).toBe(true);
    m.reset();
    expect(m.blooms).toBe(0);
    expect(m.state.completed).toBe(false);
    expect(m.terrain.count).toBeLessThan(100);
  });
});
it('przechodzi całą produkcyjną mapę ruchem, pokarmem i wodą, bez zmiany stanu lub teleportów', () => {
  const campaign = playCampaign(world);
  if (process.env.PIXELFORGE_RECORD_ROUTE) {
    mkdirSync('work', { recursive: true });
    writeFileSync(
      'work/earthworm-campaign.json',
      JSON.stringify(
        {
          seconds: campaign.result.seconds,
          tunnels: campaign.tunnelCells,
          lives: campaign.result.lives,
          completed: campaign.result.completed,
          beforeFinal: campaign.beforeFinal,
        },
        null,
        2,
      ),
    );
  }
  expect(campaign.result.completed).toBe(true);
  expect(campaign.result.roots).toEqual(world.roots.map((r) => r.need));
  expect(campaign.tunnelCells).toBeGreaterThan(3000);
  const restored = new WormModel(world);
  restored.restore(campaign.beforeFinal);
  expect(restored.blooms).toBe(11);
}, 60000);
it('siatka sektorowa: częściowy zapis, atomowe odrzucenie błędu i unieważnienie sąsiada na szwie', () => {
  const g = new MutableGrid(4096, 4096, 8, 32, () => 0);
  g.set(31, 10, 1);
  expect(g.revision(0, 0)).toBeGreaterThan(0);
  expect(g.revision(1, 0)).toBeGreaterThan(0);
  const before = g.snapshot();
  expect(() =>
    g.restore([
      [1, 1],
      [1, 2],
    ]),
  ).toThrow();
  expect(g.snapshot()).toEqual(before);
  g.set(31, 10, 0);
  expect(g.count).toBe(0);
  expect(() => g.set(-1, 0, 1)).toThrow();
  expect(() => new MutableGrid(4097, 4096, 8, 32, () => 0)).toThrow();
});
