import { describe, expect, it } from 'vitest';
import data from '../../public/assets/games/winobranie-rts/world.json';
import { VineyardModel } from '../../src/games/winobranie-rts/model';
import { validateWorld } from '../../src/games/winobranie-rts/world';
const create = () => new VineyardModel(validateWorld(data));
function build(m: VineyardModel) {
  for (const x of [268, 280]) {
    const p = m.preview('house', { x, y: 253 });
    expect(p.valid, p.reason).toBe(true);
    expect(m.commit(p)).toBe(true);
  }
}
describe('Winobranie RTS W1', () => {
  it('odrzuca konfigurację innego scenariusza i ścieżkę zewnętrzną', () => {
    expect(() => validateWorld({ ...data, width: 1024 })).toThrow();
    const bad = structuredClone(data);
    bad.terrain.sectors[0].url = '../secret.json';
    expect(() => validateWorld(bad)).toThrow();
  });
  it('buduje dwa domki, odrzuca zły/stary podgląd i zachowuje pieniądze', () => {
    const m = create(),
      before = m.snapshot();
    expect(m.preview('house', { x: 250, y: 253 }).valid).toBe(false);
    expect(m.preview('row', { x: 207, y: 280 }, { x: 240, y: 280 }).valid).toBe(
      false,
    );
    expect(m.snapshot()).toEqual(before);
    const plan = m.preview('house', { x: 268, y: 253 });
    expect(m.commit(plan)).toBe(true);
    expect(m.commit(plan)).toBe(false);
    expect(m.state.vouchers).toBe(1);
    expect(m.state.ledger.balance).toBe(3000000);
    expect(m.preview('house', { x: 280, y: 253 }, undefined, 1).valid).toBe(
      false,
    );
  });
  it('kończy sezon dzięki prawdziwym zbiorom, transportowi i prasie', () => {
    const m = create();
    build(m);
    let carried = false,
      pressed = false;
    for (let i = 0; i < 7200; i++) {
      m.tick();
      carried ||= Object.values(m.state.units[2].cargo).some((n) => n > 0);
      pressed ||= m.state.buildings.some((b) => b.batch);
      if (i % 200 === 0) for (const b of m.state.buildings) m.sell(b.id);
      expect(m.balanceGrams).toBe(m.state.grown);
    }
    expect(carried).toBe(true);
    expect(pressed).toBe(true);
    expect(m.state.sold).toBeGreaterThanOrEqual(40000);
    expect(m.state.completed).toBe(true);
    expect(m.state.ledger.income).toBeGreaterThan(0);
    expect(() => m.validateSave(m.snapshot())).not.toThrow();
    const final = m.snapshot();
    m.tick();
    expect(m.snapshot()).toEqual(final);
  });
  it('zapis podczas pracy i x4 zachowują identyczny bilans oraz wynik', () => {
    const a = create();
    build(a);
    a.advance(20000);
    const b = create();
    b.restore(a.snapshot());
    b.clock.speed = 4;
    for (let i = 0; i < 100; i++) {
      a.advance(200);
      b.advance(50);
    }
    expect({
      ...b.snapshot(),
      clock: { ...b.snapshot().clock, speed: 1 },
    }).toEqual(a.snapshot());
    const c = a.snapshot();
    c.units[0].cargo.solaris = 999999;
    expect(() => b.restore(c)).toThrow();
    expect({
      ...b.snapshot(),
      clock: { ...b.snapshot().clock, speed: 1 },
    }).toEqual(a.snapshot());
  });
  it('nowe krzewy wymagają sadzenia i nie dają dorosłego plonu', () => {
    const m = create();
    const plan = m.preview(
      'row',
      { x: 232, y: 268 },
      { x: 246, y: 268 },
      0,
      'regent',
    );
    expect(plan.valid, plan.reason).toBe(true);
    m.commit(plan);
    const row = m.state.rows.at(-1)!;
    expect(row.stock).toBe(0);
    for (let i = 0; i < 2600; i++) m.tick();
    expect(m.state.grown).toBe(96000 + 8 * 200);
    expect(row.mature).toBe(true);
  });
});

it('anulowanie zbioru z ładunkiem zwraca zasoby, a błędny cel zadania nie niszczy aktywnego stanu', () => {
  const m = create();
  for (let i = 0; i < 100; i++) m.tick();
  const u = m.state.units[0];
  expect(Object.values(u.cargo).some((n) => n > 0)).toBe(true);
  m.role([u.id], 'rest');
  for (let i = 0; i < 400; i++) m.tick();
  expect(Object.values(u.cargo).reduce((a, n) => a + n, 0)).toBe(0);
  expect(m.balanceGrams).toBe(m.state.grown);
  const bad = m.snapshot();
  bad.units[1].job = {
    kind: 'press',
    target: 'row-0',
    goal: { x: 232, y: 239 },
    progress: 0,
    amount: 0,
    variety: 'solaris',
  };
  const before = m.snapshot();
  expect(() => m.restore(bad)).toThrow();
  expect(m.snapshot()).toEqual(before);
});

it('droga, obrót, przenosiny pustego domku i usunięcie nie naruszają aktywnej topologii', () => {
  const m = create();
  m.role(['worker-1', 'worker-2'], 'rest');
  const road = m.preview('road', { x: 258, y: 258 }, { x: 258, y: 280 });
  expect(road.valid, road.reason).toBe(true);
  m.commit(road);
  const house = m.preview('house', { x: 264, y: 270 }, undefined, 1);
  expect(house.valid, house.reason).toBe(true);
  m.commit(house);
  const b = m.state.buildings[0];
  m.role(['worker-1'], 'build');
  for (let i = 0; i < 500; i++) m.tick();
  expect(b.work).toBe(0);
  m.role(['worker-1'], 'rest');
  const move = m.preview(
    'move',
    { x: 276, y: 253 },
    undefined,
    0,
    'solaris',
    b.id,
  );
  expect(move.valid, move.reason).toBe(true);
  const balance = m.state.ledger.balance;
  expect(m.commit(move)).toBe(true);
  expect(m.state.ledger.balance).toBe(balance - 100000);
  expect(m.state.vouchers).toBe(1);
  expect(m.state.buildings[0].id).toBe(b.id);
  m.role(['worker-1'], 'build');
  for (let i = 0; i < 500; i++) m.tick();
  m.role(['worker-1'], 'rest');
  expect(m.remove(b.id)).toBe(true);
  expect(m.state.buildings).toHaveLength(0);
  expect(m.removeRoad({ x: 258, y: 276 })).toBe(true);
});

it('pionowy rząd ma osiągalne stanowisko niezależnie od kierunku przeciągania', () => {
  for (const [from, to] of [
    [
      { x: 274, y: 270 },
      { x: 274, y: 282 },
    ],
    [
      { x: 274, y: 282 },
      { x: 274, y: 270 },
    ],
  ]) {
    const m = create(),
      plan = m.preview('row', from, to);
    expect(plan.valid, plan.reason).toBe(true);
    expect(m.commit(plan)).toBe(true);
    const row = m.state.rows.at(-1)!;
    expect(
      row.cells.some((p) => p.x === row.access.x && p.y === row.access.y),
    ).toBe(false);
    expect(m.human.findPath({ x: 248, y: 258 }, row.access)).not.toBeNull();
  }
});
