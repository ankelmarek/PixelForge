import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import data from '../../public/assets/games/winobranie-rts/world.json';
import { VineyardModel, type Tool } from '../../src/games/winobranie-rts/model';
import {
  validateWorld,
  type Variety,
} from '../../src/games/winobranie-rts/world';
import { LotBook, Ledger } from '../../src/engine/api/strategy';
import { quality, netWorth } from '../../src/games/winobranie-rts/campaign';
import { VineyardClimate } from '../../src/games/winobranie-rts/climate';
const metrics: unknown[] = [];
const climates = Array.from({ length: 64 }, (_, seed) => {
  let dose = 0,
    min = 1000,
    max = -1000;
  for (let year = 1; year <= 3; year++) {
    const climate = new VineyardClimate(seed, year);
    for (let t = (year - 1) * 12000; t < year * 12000; t += 20) {
      const w = climate.at(t);
      dose += Math.max(0, -w.temperature);
      min = Math.min(min, w.temperature);
      max = Math.max(max, w.temperature);
    }
  }
  return { seed, dose, min, max };
}).sort((a, b) => a.dose - b.dose);
const extremes = [climates[0], climates.at(-1)!];
afterAll(() => {
  mkdirSync('work/w3', { recursive: true });
  writeFileSync(
    'work/w3/campaigns.json',
    JSON.stringify({ weather: extremes, metrics }, null, 2),
  );
});
const create = (seed = 731) =>
  new VineyardModel(validateWorld(data), seed, true);
function place(
  m: VineyardModel,
  tool: Tool,
  x: number,
  y: number,
  end = { x, y },
  variety: Variety = 'solaris',
) {
  const p = m.preview(tool, { x, y }, end, 0, variety);
  expect(p.valid, `${tool} ${x},${y}: ${p.reason}`).toBe(true);
  expect(m.commit(p)).toBe(true);
}
function setup(m: VineyardModel, policy: number) {
  place(m, 'house', 268, 253);
  place(m, 'house', 280, 253);
  for (const y of [210, 214, 218, 222, 226, 230, 234])
    place(
      m,
      'row',
      216,
      y,
      { x: 262, y },
      (
        [
          'rondo',
          'solaris',
          'regent',
          'johanniter',
          'muscaris',
          'cortis',
          'solaris',
        ] as Variety[]
      )[
        policy === 2
          ? (y - 210) / 4
          : policy === 1
            ? ((y - 210) / 4) % 2 === 0
              ? 4
              : 5
            : ((y - 210) / 4) % 2
      ],
    );
  for (let n = 0; n < 5; n++) expect(m.hire('permanent')).toBe(true);
  if (policy === 0) expect(m.hire('compact')).toBe(true);
  place(m, 'tank', 212, 240);
  place(m, 'tank', 212, 242);
  for (const y of [212, 224, 236, 248]) {
    place(m, 'pump', 212, y);
    for (const x of [220, 231, 242, 253, 264]) place(m, 'sprinkler', x, y);
    place(m, 'pipe', 212, y, { x: 264, y });
  }
  place(m, 'pipe', 212, 212, { x: 212, y: 248 });
  for (const d of m.state.environment!.water.devices.filter(
    (d) => d.kind === 'tank',
  ))
    m.refill(d.id);
  for (const b of m.state.buildings)
    m.cellarMode(b.id, policy === 1 ? 'reserve' : 'young');
  if (policy === 1) {
    expect(m.loan()).toBe(true);
    place(m, 'house', 292, 253);
    m.cellarMode(m.state.buildings.at(-1)!.id, 'reserve');
  }
}
function manage(m: VineyardModel, policy: number) {
  const s = m.state;
  for (const b of s.buildings) {
    m.sell(b.id);
    if (policy === 1 && s.tick >= 33000) m.cellarMode(b.id, 'young');
    if (
      policy === 1 &&
      !b.work &&
      !s.campaign!.cellars[b.id].upgrades.tank &&
      s.ledger.balance > 300000
    )
      m.upgrade(b.id, 'tank');
    if (
      policy === 1 &&
      !b.work &&
      s.ledger.balance > 500000 &&
      Object.values(s.campaign!.cellars).every((c) => c.upgrades.tank)
    )
      m.upgrade(b.id, 'control');
  }
  m.acceptContract(
    `${policy === 1 ? 'quality' : 'volume'}-${s.campaign!.year}`,
  );
  for (const d of s.environment!.water.devices)
    if (d.kind === 'tank' && d.volume < 350000 && !d.delivery) m.refill(d.id);
  for (const r of s.rows)
    if (s.environment!.crops[r.id].plots.some((p) => p.mildew >= 1000))
      m.care(r.id);
}
describe('W3 campaign', () => {
  it('preserves integer quantity and quality through split and merge', () => {
    const state = { serial: 1, lots: [] },
      book = new LotBook(state);
    book.add({
      owner: 'a',
      resource: 'fruit',
      kind: 'red',
      vintage: 1,
      quantity: 7,
      qualityMass: 12345,
      origins: ['field'],
    });
    expect(book.transfer('a', 'b', 'fruit', 'red', 8)).toBe(false);
    for (let i = 0; i < 7; i++)
      expect(book.transfer('a', 'b', 'fruit', 'red', 1)).toBe(true);
    expect(book.list('b')[0]).toMatchObject({
      quantity: 7,
      qualityMass: 12345,
    });
  });
  it.each(
    [0, 1, 2].flatMap((policy) =>
      extremes.map(({ seed }) => ({ policy, seed })),
    ),
  )(
    'completes three years: $policy / $seed',
    ({ policy, seed }) => {
      const m = create(seed);
      setup(m, policy);
      for (let t = 0; t < 36000; t++) {
        if (t % 100 === 0) manage(m, policy);
        m.tick();
        if (t % 400 === 0) {
          expect(m.balanceGrams).toBe(m.state.grown);
          m.validateSave(m.snapshot());
        }
        if (m.state.tick === 11999 || m.state.tick === 24000) {
          const copy = create();
          copy.restore(m.snapshot());
          expect(copy.snapshot()).toEqual(m.snapshot());
          expect(m.state.environment!.crops[m.state.rows[3].id].age).toBe(
            m.state.tick === 11999 ? 0 : 2,
          );
        }
      }
      metrics.push({
        policy,
        seed,
        bottles: m.state.campaign!.bottles,
        quality: quality(m.state) / 100,
        netWorth: netWorth(m.state) / 100,
        grapes: m.state.grown / 1000,
        result: m.state.campaign!.result,
        contracts: m.state.campaign!.contracts.filter(
          (t) => t.status === 'done',
        ).length,
      });
      expect(m.state.campaign!.result).toBe('success');
      const final = m.snapshot();
      m.tick();
      expect(m.snapshot()).toEqual(final);
      const copy = create();
      copy.restore(final);
      expect(copy.state.campaign!.result).toBe('success');
    },
    60000,
  );
  it('accounts for a single loan separately from income and repayment', () => {
    const m = create(),
      initial = m.state.ledger.balance;
    expect(m.loan()).toBe(true);
    expect(m.loan()).toBe(false);
    expect(m.state.ledger.income).toBe(0);
    expect(m.state.ledger.balance).toBe(initial + 500000);
    expect(m.loan(true)).toBe(true);
    expect(m.loan(true)).toBe(false);
    expect(m.state.ledger.balance).toBe(initial - 50000);
    expect(m.state.ledger.costs).toBe(50000);
    m.validateSave(m.snapshot());
  });
  it('purchases houses, staff and vehicles atomically, pays wages and retires safely', () => {
    const m = create();
    place(m, 'house', 268, 253);
    place(m, 'house', 280, 253);
    const cash = m.state.ledger.balance;
    place(m, 'house', 292, 253);
    expect(m.state.ledger.balance).toBe(cash - 800000);
    expect(m.hire('strong')).toBe(true);
    expect(m.hire('hauler')).toBe(true);
    expect(m.hire('seasonal')).toBe(true);
    const seasonal = m.state.units.at(-1)!;
    for (let i = 0; i < 500; i++) m.tick();
    const b = m.state.buildings[0];
    expect(m.upgrade(b.id, 'press')).toBe(true);
    const before = m.snapshot();
    expect(m.upgrade(b.id, 'press')).toBe(false);
    expect(m.snapshot()).toEqual(before);
    m.dismiss(seasonal.id);
    m.tick();
    expect(m.state.units.some((u) => u.id === seasonal.id)).toBe(false);
    m.validateSave(m.snapshot());
    expect(m.state.ledger.ids).toContain('wages-400');
    expect(m.walkable({ x: 260, y: 257 }, true)).toBe(true);
    expect(m.walkable({ x: 260, y: 257 }, 2)).toBe(false);
  });
  it('keeps old seasons and rejects corrupted provenance or financial totals', () => {
    const m = create(),
      old = new VineyardModel(validateWorld(data), 731).snapshot();
    const raw = { ...old, version: 2, revision: 'vineyard-w2' };
    Reflect.deleteProperty(raw, 'campaign');
    const text = JSON.stringify(raw),
      migrated = m.migrateV2(raw);
    m.restore(migrated);
    expect(m.duration).toBe(600);
    expect(m.state.campaign).toBeNull();
    expect(JSON.stringify(raw)).toBe(text);
    const c = create();
    setup(c, 0);
    for (let i = 0; i < 5000; i++) {
      if (i % 100 === 0) manage(c, 0);
      c.tick();
    }
    const saved = c.snapshot();
    expect(saved.campaign!.book.lots.length).toBeGreaterThan(0);
    for (const corrupt of [
      (s: typeof saved) => {
        s.campaign!.book.lots[0].quantity++;
      },
      (s: typeof saved) => {
        s.campaign!.borrowed = 500000;
      },
      (s: typeof saved) => {
        s.campaign!.book.lots[0].owner = 'missing';
      },
      (s: typeof saved) => {
        s.campaign!.book.lots[0].qualityMass = -1;
      },
      (s: typeof saved) => {
        s.campaign!.year = 3;
      },
    ]) {
      const bad = structuredClone(saved);
      corrupt(bad);
      expect(() => c.restore(bad)).toThrow();
      expect(c.snapshot()).toEqual(saved);
    }
  }, 20000);
  it('matches x1, x4 and a mid-process restore without creating inventory', () => {
    const a = create(),
      b = create();
    setup(a, 0);
    b.restore(a.snapshot());
    b.clock.speed = 4;
    for (let n = 0; n < 1200; n++) {
      a.advance(200);
      b.advance(50);
    }
    expect({ ...a.snapshot(), clock: null }).toEqual({
      ...b.snapshot(),
      clock: null,
    });
    const copy = create();
    copy.restore(a.snapshot());
    for (let n = 0; n < 400; n++) {
      a.tick();
      copy.tick();
    }
    expect(a.snapshot()).toEqual(copy.snapshot());
    copy.clock.paused = true;
    const before = copy.snapshot();
    copy.advance(1000);
    expect(copy.snapshot()).toEqual(before);
  }, 20000);
  it('finishes a working small vineyard with a partial result and preserves it on reload', () => {
    const m = create();
    place(m, 'house', 268, 253);
    place(m, 'house', 280, 253);
    for (let i = 0; i < 36000; i++) {
      if (i % 100 === 0) for (const b of m.state.buildings) m.sell(b.id);
      m.tick();
    }
    expect(m.state.campaign!.result).toBe('partial');
    const saved = m.snapshot();
    m.restore(saved);
    expect(m.snapshot()).toEqual(saved);
  }, 15000);
  it('offers rescue before insolvency; irrecoverable fixture fails only after warning', () => {
    const m = create();
    for (const r of [...m.state.rows]) expect(m.remove(r.id)).toBe(true);
    for (const u of [...m.state.units]) m.dismiss(u.id);
    m.tick();
    // Synthetic insolvency boundary, separate from the unmodified campaigns above.
    new Ledger(m.state.ledger).transact('test-liability', -5000000, true);
    for (let i = 0; i < 1300; i++) m.tick();
    expect(m.state.failed).toBe(false);
    expect(m.loan()).toBe(true);
    m.tick();
    expect(m.state.failed).toBe(true);
    expect(m.state.campaign!.result).toBe('failure');
    m.validateSave(m.snapshot());
  });
});
