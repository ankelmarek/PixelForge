import { expect, it } from 'vitest';
import data from '../../public/assets/games/winobranie-rts/world.json';
import { VineyardModel } from '../../src/games/winobranie-rts/model';
import { guidance } from '../../src/games/winobranie-rts/guidance';
import { validateWorld } from '../../src/games/winobranie-rts/world';

const create = () => new VineyardModel(validateWorld(data));
const read = (m: VineyardModel) => guidance(m.state, m.world.scenario.goal);
function build(m: VineyardModel) {
  for (const x of [268, 280])
    expect(m.commit(m.preview('house', { x, y: 253 }))).toBe(true);
}

it('komunikaty podążają za rzeczywistym sezonem, a wznowienie nie wymaga osobnego postępu tutorialu', () => {
  const m = create(),
    before = m.snapshot();
  expect(read(m)?.id).toBe('first-house');
  expect(m.snapshot()).toEqual(before);
  build(m);
  const seen = new Set<string>();
  for (let i = 0; i < 7200; i++) {
    m.tick();
    if (i % 40 === 0) {
      const hint = read(m);
      if (hint) seen.add(hint.id);
    }
    if (i === 1200) {
      const resumed = create();
      resumed.restore(m.snapshot());
      expect(read(resumed)).toEqual(read(m));
    }
    if (i % 200 === 0) for (const b of m.state.buildings) m.sell(b.id);
  }
  for (const stage of ['building', 'transport', 'pressing', 'sale', 'goal'])
    expect(seen.has(stage), stage).toBe(true);
  expect(m.state.completed).toBe(true);
  expect(read(m)).toBeNull();
});

it('wyjaśnia blokadę i brak odpowiedniej roli zamiast obiecywać automatyczny postęp', () => {
  const m = create();
  build(m);
  for (const u of m.state.units) u.role = 'rest';
  expect(read(m)).toMatchObject({
    id: 'builder',
    target: 'worker-1',
    tone: 'warning',
  });
  for (const b of m.state.buildings) b.work = 0;
  m.state.buildings[0].stock.solaris = 10000;
  expect(read(m)?.id).toBe('operator');
  m.state.buildings[0].stock = {};
  m.state.warehouse.solaris = 10000;
  expect(read(m)).toMatchObject({ id: 'driver', target: 'tractor-1' });
  m.state.units[2].role = 'auto';
  expect(read(m)?.id).toBe('harvester');
  m.order(['worker-1'], null, { x: 248, y: 252 });
  expect(m.state.units[0].blocked).toBe(true);
  expect(read(m)).toMatchObject({ id: 'blocked', target: 'worker-1' });
});

it('priorytet ma gotowa sprzedaż, potem cel bez zaległości; komunikat nie zostaje po sprzedaży', () => {
  const m = create();
  build(m);
  m.state.buildings[0].work = 0;
  m.state.buildings[0].must.solaris = 6000;
  m.state.ledger.arrears = 100;
  expect(read(m)).toMatchObject({
    id: 'sale',
    target: m.state.buildings[0].id,
  });
  expect(read(m)?.text).toContain('zaległości');
  expect(m.sell(m.state.buildings[0].id)).toBe(true);
  expect(read(m)?.id).not.toBe('sale');
  m.state.sold = m.world.scenario.goal;
  expect(read(m)?.id).toBe('goal');
  m.state.ledger.arrears = 100;
  expect(read(m)?.id).not.toBe('goal');
  m.state.failed = true;
  expect(read(m)).toBeNull();
});

it('opisuje przyczynę złego podglądu i wraca do aktualnej sytuacji po anulowaniu narzędzia', () => {
  const m = create();
  const plan = m.preview('house', { x: 280, y: 275 });
  expect(plan.reason).toBe('Brak dojazdu');
  const hint = guidance(m.state, 40000, 'house', plan);
  expect(hint).toMatchObject({ id: 'placement:Brak dojazdu', tone: 'warning' });
  expect(hint?.text).toContain('rozładunku');
  expect(guidance(m.state, 40000, 'road')?.text).toContain('Przeciągnij drogę');
  expect(read(m)?.id).toBe('first-house');
});
