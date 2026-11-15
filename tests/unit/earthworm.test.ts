import { describe, expect, it } from 'vitest';
import raw from '../../public/assets/games/earthworm/soil-world.json';
import { validateWorld } from '../../src/games/earthworm/world';
import { WormModel, CAPACITY } from '../../src/games/earthworm/model';
import {
  SURFACE,
  ADULT_XP,
  NEST,
  PLUG,
  BABY,
  FLOOD,
  AIR_POCKETS,
  FUNGI,
  rainMoisture,
  weather,
} from '../../src/games/earthworm/adventure';
import { MutableGrid } from '../../src/engine/api/terrain';
import { VersionedSave } from '../../src/engine/systems/versioned-save';
import { StorageService } from '../../src/engine/systems/storage';
import { validateDefinition } from '../../src/engine/api/validation';
import { earthworm } from '../../src/games/earthworm';
import { playCampaign } from '../fixtures/earthworm-route';
import { mkdirSync, writeFileSync } from 'node:fs';

const world = validateWorld(raw);
const advance = (m: WormModel, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.1); i++) m.tick(0.1);
};
function go(m: WormModel, x: number, y: number) {
  m.steer(x, y);
  for (let i = 0; i < 500 && Math.hypot(m.state.x - x, m.state.y - y) > 3; i++)
    m.tick(0.1);
  expect(Math.hypot(m.state.x - x, m.state.y - y)).toBeLessThan(4);
}
describe('pionowy świat gleby', () => {
  it('waliduje dane i definicję; odrzuca poprzedni świat, skałę na starcie i nieznany pokarm', () => {
    expect(world.width).toBe(4096);
    expect(validateDefinition(earthworm)).toBe(earthworm);
    expect(() =>
      validateWorld({ ...raw, schemaVersion: 1, id: 'under-garden' }),
    ).toThrow(/wersja/);
    expect(() =>
      validateWorld({ ...raw, rocks: [{ ...raw.spawn, radius: 40 }] }),
    ).toThrow(/zablokowany/);
    expect(() =>
      validateWorld({
        ...raw,
        food: raw.food.map((f, i) => (i ? f : { ...f, kind: 5 })),
      }),
    ).toThrow();
    expect(() =>
      validateWorld({ ...raw, roots: [...raw.roots, raw.roots[0]] }),
    ).toThrow();
    expect(() =>
      validateDefinition({ ...earthworm, createRuntime: 'eval()' }),
    ).toThrow(/TypeScript/);
  });
  it('pierwsze larwy, tunele i odżywiony korzeń dają postęp bez tekstowego samouczka', () => {
    const m = new WormModel(world),
      before = m.terrain.count;
    for (const f of world.food.slice(0, 3)) go(m, f.x, f.y);
    expect(m.state.nutrients).toBeGreaterThanOrEqual(3);
    go(m, world.roots[0].x, world.roots[0].y);
    advance(m, 2);
    expect(m.blooms).toBe(1);
    expect(m.experience).toBeGreaterThanOrEqual(21);
    expect(m.state.checkpoint).toBe(0);
    expect(m.terrain.count).toBeGreaterThan(before);
    expect(m.snapshot().tunnels.some(([, v]) => v === 3)).toBe(true);
    expect(m.state.completed).toBe(false);
  });
  it('ruch jest niezależny od FPS, segmenty podążają za głową', () => {
    const a = new WormModel(world),
      b = new WormModel(world);
    a.steer(1000, 420);
    b.steer(1000, 420);
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
  it('nie pozwala wyjść nad powierzchnię ani wydrążyć skały', () => {
    const m = new WormModel(world);
    m.steer(640, -100);
    advance(m, 3);
    expect(m.state.y).toBeGreaterThanOrEqual(SURFACE + 16);
    expect(m.terrain.get(80, 40)).toBe(4);
    const rock = world.rocks[0],
      r = new WormModel({
        ...world,
        spawn: { x: rock.x - rock.radius - 22, y: rock.y },
      });
    r.steer(rock.x + rock.radius + 40, rock.y);
    advance(r, 4);
    expect(r.state.x).toBeLessThan(rock.x - rock.radius);
    expect(r.terrain.get(Math.floor(rock.x / 8), Math.floor(rock.y / 8))).toBe(
      2,
    );
  });
  it('deszcz przenika z opóźnieniem, niezależnie od liczby odżywionych korzeni', () => {
    expect([weather(0), weather(40), weather(100), weather(160)]).toEqual([
      'dew',
      'rain',
      'sun',
      'dusk',
    ]);
    expect(rainMoisture(SURFACE, 40)).toBe(true);
    expect(rainMoisture(SURFACE + 1400, 40)).toBe(false);
    expect(rainMoisture(SURFACE, 120)).toBe(false);
    expect(rainMoisture(SURFACE + 1400, 120)).toBe(true);
    const m = new WormModel({
      ...world,
      rocks: [],
      pools: [],
      predators: [],
      spawn: { x: 400, y: SURFACE + 1400 },
    });
    m.state.seconds = 110;
    m.state.hydration = 40;
    advance(m, 2);
    expect(m.state.hydration).toBeGreaterThan(50);
  });
  it('głębsza gleba spowalnia drążenie i szybciej wysusza; zwinięcie oszczędza wilgoć', () => {
    const shallow = new WormModel({
        ...world,
        rocks: [],
        pools: [],
        predators: [],
        spawn: { x: 400, y: 448 },
      }),
      deep = new WormModel({
        ...world,
        rocks: [],
        pools: [],
        predators: [],
        spawn: { x: 400, y: 2700 },
      });
    shallow.steer(700, 448);
    deep.steer(700, 2700);
    advance(shallow, 1);
    advance(deep, 1);
    expect(shallow.state.x).toBeGreaterThan(deep.state.x);
    expect(shallow.state.hydration).toBeGreaterThan(deep.state.hydration);
    deep.toggleHide();
    const before = deep.state.hydration;
    advance(deep, 2);
    expect(before - deep.state.hydration).toBeLessThan(0.5);
  });
  it('pokarm odnawia zasoby, ale powtórne zjedzenie tej samej larwy nie daje punktów', () => {
    const m = new WormModel(world),
      f = world.food[0];
    go(m, f.x, f.y);
    go(m, world.spawn.x, world.spawn.y);
    const points = m.experience;
    advance(m, 76);
    m.state.nutrients = 0;
    go(m, f.x, f.y);
    expect(m.state.nutrients).toBeGreaterThan(0);
    expect(m.experience).toBe(points);
  });
  it('pełny zapas nie usuwa larwy', () => {
    const m = new WormModel(world),
      f = world.food[0];
    m.state.x = f.x;
    m.state.y = f.y;
    m.state.nutrients = CAPACITY;
    advance(m, 0.1);
    expect(m.state.food[0]).toBe(0);
    expect(m.state.adventure.eaten[0]).toBe(false);
  });
  it('użyźnianie zostawia trwałe pola, a zamknięty tunel nie produkuje nowych punktów', () => {
    const m = new WormModel({
      ...world,
      rocks: [],
      predators: [],
      spawn: { x: 300, y: 1800 },
    });
    m.state.nutrients = 6;
    go(m, 700, 1800);
    expect(m.state.adventure.fertility).toBeGreaterThan(0);
    const points = m.experience;
    m.state.nutrients = 6;
    go(m, 300, 1800);
    go(m, 700, 1800);
    expect(m.experience).toBe(points);
    expect(m.snapshot().tunnels.some(([, v]) => v === 3)).toBe(true);
  });
  it('drapieżnik sygnalizuje atak, zwinięcie chroni, a obrażenia prowadzą do porażki', () => {
    const p = world.predators[0],
      m = new WormModel(world);
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
    for (let i = 0; i < 2; i++) {
      m.state.x = 400;
      m.state.y = 2000;
      m.state.seconds = 0;
      m.state.invulnerable = 0;
      m.state.hydration = 0;
      advance(m, 0.1);
    }
    expect(m.state.failed).toBe(true);
    const elapsed = m.state.seconds;
    advance(m, 2);
    expect(m.state.seconds).toBe(elapsed);
  });
});
describe('przygody i dorastanie', () => {
  it('gliniany zator ma trzy trwałe fazy i jednorazową nagrodę', () => {
    const m = new WormModel(world);
    m.state.x = PLUG.x;
    m.state.y = PLUG.y - 24;
    m.interact();
    expect(m.state.adventure.plug).toBe(1);
    const n = new WormModel(world);
    n.restore(m.snapshot());
    n.interact();
    n.interact();
    expect(n.state.adventure.plug).toBe(3);
    expect(n.state.roots[2]).toBe(world.roots[2].need);
    expect(n.wet).toBe(true);
    const score = n.experience;
    n.interact();
    expect(n.experience).toBe(score);
  });
  it('zagubione dziecko wraca do gniazda, a nagroda jest jednorazowa', () => {
    const m = new WormModel(world);
    m.state.x = BABY.x;
    m.state.y = BABY.y;
    advance(m, 0.1);
    expect(m.state.adventure.baby).toBe('following');
    m.state.x = NEST.x;
    m.state.y = NEST.y;
    advance(m, 0.1);
    expect(m.state.adventure.baby).toBe('home');
    const score = m.experience;
    advance(m, 3);
    expect(m.experience).toBe(score);
  });
  it('obrażenie podczas eskorty odsyła dziecko do jego kryjówki', () => {
    const m = new WormModel(world);
    m.state.x = BABY.x;
    m.state.y = BABY.y;
    advance(m, 0.1);
    m.state.x = 400;
    m.state.y = 2000;
    m.state.hydration = 0;
    m.state.seconds = 0;
    advance(m, 0.1);
    expect(m.state.adventure.baby).toBe('lost');
  });
  it('woda wyczerpuje powietrze, kieszeń powietrzna je odnawia', () => {
    const m = new WormModel(world);
    m.state.x = FLOOD.x + 112;
    m.state.y = FLOOD.y + 240;
    advance(m, 4);
    expect(m.state.air).toBeLessThan(55);
    expect(m.state.lives).toBe(3);
    m.state.x = AIR_POCKETS[0].x;
    m.state.y = AIR_POCKETS[0].y;
    advance(m, 2);
    expect(m.state.air).toBe(100);
    m.state.x = FLOOD.x + 112;
    m.state.y = FLOOD.y + 240;
    advance(m, 9);
    expect(m.state.lives).toBe(2);
    expect(m.state.air).toBe(100);
  });
  it('grzybnia potrzebuje pokarmu i tworzy bezpieczny głęboki punkt powrotu', () => {
    const m = new WormModel(world);
    m.state.x = FUNGI[0].x;
    m.state.y = FUNGI[0].y;
    m.interact();
    expect(m.state.adventure.fungi[0]).toBe(false);
    m.state.nutrients = 6;
    for (const p of FUNGI) {
      m.state.x = p.x;
      m.state.y = p.y;
      m.interact();
    }
    expect(m.state.adventure.fungi.every(Boolean)).toBe(true);
    expect(m.state.checkpoint).toBe(world.roots.length);
    const n = new WormModel(world);
    n.restore(m.snapshot());
    expect(n.state.adventure.fungi.every(Boolean)).toBe(true);
  });
  it('same korzenie nie kończą gry; punkty rozwijają ciało, a gniazdo domyka dorosłość', () => {
    const m = new WormModel(world);
    m.state.roots = world.roots.map((r) => r.need);
    expect(m.experience).toBe(144);
    expect(m.stage).toBe(1);
    expect(m.capacity).toBe(8);
    m.interact();
    expect(m.state.adventure.finale).toBe(0);
    m.state.adventure.eaten.fill(true);
    expect(m.experience).toBeGreaterThanOrEqual(ADULT_XP);
    expect(m.stage).toBe(4);
    m.interact();
    advance(m, 4.2);
    expect(m.state.completed).toBe(true);
    expect(m.state.failed).toBe(false);
    const n = new WormModel(world);
    n.restore(m.snapshot());
    expect(n.state.completed).toBe(true);
    const elapsed = m.state.seconds;
    advance(m, 5);
    expect(m.state.seconds).toBe(elapsed);
    m.reset();
    expect(m.experience).toBe(0);
    expect(m.segments.length).toBe(15);
    expect(m.terrain.count).toBeLessThan(100);
  });
});
describe('bezpieczne zapisy pionowego świata', () => {
  it('odtwarza tunele i postęp, atomowo odrzuca uszkodzone lub niespójne dane', () => {
    const m = new WormModel(world);
    go(m, world.food[0].x, world.food[0].y);
    const n = new WormModel(world);
    n.restore(m.snapshot());
    expect(n.snapshot()).toEqual(m.snapshot());
    const bads = [
      { ...m.snapshot(), y: 20 },
      { ...m.snapshot(), air: -1 },
      { ...m.snapshot(), adventure: { ...m.state.adventure, finale: 4 } },
      { ...m.snapshot(), adventure: { ...m.state.adventure, plug: 99 } },
    ];
    const dup = m.snapshot();
    dup.tunnels.push(dup.tunnels[0]);
    bads.push(dup);
    for (const data of bads) {
      expect(() => n.restore(data)).toThrow();
      expect(n.snapshot()).toEqual(m.snapshot());
    }
  });
  it('osobny zapis v3 zachowuje stary v1 oraz inne gry; błędny JSON i brak storage nie wywracają klienta', () => {
    const m = new WormModel(world),
      data = new Map<string, string>([
        ['pixelforge:client:v1:earthworm', 'old-garden-save'],
      ]);
    const storage = new StorageService({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    });
    const save = new VersionedSave(
      'earthworm',
      3,
      (v) => m.validateSave(v),
      storage,
    );
    expect(save.read()).toBeUndefined();
    expect(save.write(m.snapshot())).toBe(true);
    expect(data.get('pixelforge:client:v1:earthworm')).toBe('old-garden-save');
    expect(
      new VersionedSave('other', 3, (v) => m.validateSave(v), storage).read(),
    ).toBeUndefined();
    data.set(save.key, '{broken');
    expect(save.read()).toBeUndefined();
    const denied = new VersionedSave(
      'earthworm',
      3,
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
});
it('przechodzi produkcyjną mapę, cztery przygody i dorosłość realnym ruchem bez teleportów i darmowych zasobów', () => {
  const campaign = playCampaign(world);
  if (process.env.PIXELFORGE_RECORD_ROUTE) {
    mkdirSync('work', { recursive: true });
    writeFileSync(
      'work/earthworm-campaign.json',
      JSON.stringify({ ...campaign, tunnels: undefined }, null, 2),
    );
  }
  expect(campaign.result.completed).toBe(true);
  expect(campaign.result.adventure.baby).toBe('home');
  expect(campaign.result.adventure.plug).toBe(3);
  expect(campaign.result.adventure.chamber).toBe(true);
  expect(campaign.result.adventure.fungi.every(Boolean)).toBe(true);
  expect(campaign.experience).toBeGreaterThanOrEqual(ADULT_XP);
  expect(campaign.tunnelCells).toBeGreaterThan(3000);
  const restored = new WormModel(world);
  restored.restore(campaign.beforeFinal);
  expect(restored.state.completed).toBe(false);
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
