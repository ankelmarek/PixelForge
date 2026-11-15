import { it, expect } from 'vitest';
import {
  weekend,
  operateWeekend,
  washRoad,
} from '../fixtures/station-campaign';
import { activeEvent } from '../../src/games/gas-station/campaign-data';

it('awaria zachowuje wydane paliwo; naprawa, zapis oraz tempo ×1/×4 są zgodne', () => {
  const a = weekend();
  let id = '';
  for (let i = 0; i < 33000; i++) {
    operateWeekend(a);
    a.tick();
    const fault = a.state.campaign!.fault;
    const customer = a.state.customers.find(
      (c) => c.pump === fault?.pump && c.phase === 'fueling' && c.issued > 0,
    );
    if (customer) {
      id = customer.id;
      break;
    }
  }
  expect(id).not.toBe('');
  const customer = a.state.customers.find((c) => c.id === id)!;
  const issued = customer.issued,
    cost = customer.fuelCost;
  for (let i = 0; i < 40; i++) a.tick();
  expect(customer.issued).toBe(issued);
  expect(customer.fuelCost).toBe(cost);
  const b = weekend();
  b.restore(a.snapshot());
  a.weekend.repair();
  b.weekend.repair();
  a.clock.speed = 1;
  b.clock.speed = 4;
  for (let i = 0; i < 200; i++) {
    for (let j = 0; j < 4; j++) a.advance(50);
    b.advance(50);
  }
  const left = a.snapshot(),
    right = b.snapshot();
  right.clock.speed = 1;
  expect(right).toEqual(left);
  a.validateSave(left);
  expect(a.state.campaign!.fault).toBeNull();
  expect(a.state.journal.entries.some((e) => e.category === 'repair')).toBe(
    true,
  );
}, 60000);

it('podwyżka hurtowa nie zmienia opłaconego zamówienia ani zwrotu', () => {
  const m = weekend(9021);
  while (
    !(
      m.state.campaign!.event?.kind === 'wholesale' &&
      m.state.tick < m.state.campaign!.event!.start
    ) &&
    m.state.tick < 30000
  ) {
    if (m.state.campaign!.fault) m.weekend.repair();
    m.tick();
  }
  expect(m.state.campaign!.event?.kind).toBe('wholesale');
  const quote = m.fuelQuote('e95', 400);
  expect(m.orderFuel('e95', 400)).toBe(true);
  const id = m.state.delivery!.id,
    cost = m.state.delivery!.cargo.cost;
  while (!activeEvent(m.state, 'wholesale')) m.tick();
  expect(m.state.delivery!.phase).toBe('ordered');
  expect(m.state.delivery!.cargo.cost).toBe(cost);
  expect(m.fuelQuote('e95', 400)).toBeGreaterThan(quote);
  const wages = m.state.development!.wageTotal;
  const beforeCancel = m.cash;
  expect(m.cancelDelivery(id)).toBe(true);
  expect(m.cancelDelivery(id)).toBe(false);
  expect(m.cash - beforeCancel).toBe(cost + 8000);
  expect(
    m.state.journal.entries.find((e) => e.id === `refund-${id}`)?.cash,
  ).toBe(cost);
  expect(wages).toBeGreaterThan(0);
  m.validateSave(m.snapshot());
}, 60000);

it('sprzedaż pustej pompy zwraca 60%, usuwa majątek i nie przesuwa zajętych referencji', () => {
  const m = weekend();
  washRoad(m);
  m.hire();
  const p = {
    kind: 'pump' as const,
    point: { x: 84, y: 118 },
    rotation: 0,
    fuel: 'on' as const,
  };
  expect(m.build(p, m.state.topology)).toBe(true);
  const id = m.state.development!.sites[0].id;
  expect(m.weekend.sell(id)).toBe(false);
  for (let i = 0; i < 3000 && m.state.development!.sites[0].progress; i++)
    m.tick();
  m.setPump(3, false);
  for (let i = 0; i < 3000 && m.weekend.canSell(id); i++) m.tick();
  const cash = m.cash,
    worth = m.netWorth;
  expect(m.weekend.sell(id)).toBe(true);
  expect(m.weekend.sell(id)).toBe(false);
  expect(m.cash - cash).toBe(108000);
  expect(m.netWorth).toBe(worth);
  expect(m.state.pumps).toHaveLength(3);
  m.validateSave(m.snapshot());
});

it('walidacja odrzuca wymazany dług, podwójne mycie i podmienioną ocenę', () => {
  const m = weekend();
  m.weekend.rescue();
  const loan = m.snapshot();
  loan.campaign!.rescue.taken = false;
  expect(() => m.restore(loan)).toThrow();
  const wash = m.snapshot();
  wash.campaign!.wash.completed = 1;
  expect(() => m.restore(wash)).toThrow();
  const rating = m.snapshot();
  rating.satisfaction = 10000;
  expect(() => m.restore(rating)).toThrow();
  expect(m.state.campaign!.rescue.taken).toBe(true);
});

it('niewypłacalność wymaga wyczerpania ratunku i pełnych 120 s ostrzeżenia', () => {
  const m = weekend(731);
  washRoad(m);
  m.hire();
  m.buildPump(m.state.topology);
  m.build(
    { kind: 'heavy-pump', point: { x: 84, y: 118 }, rotation: 0, fuel: 'on' },
    m.state.topology,
  );
  m.setPrice('e95', 500);
  m.setPrice('on', 480);
  let liability = false,
    warning = -1,
    resumed = false;
  for (let i = 0; i < 36000 && !m.state.result; i++) {
    if (i % 20 === 0) {
      if (m.state.campaign!.fault) m.weekend.repair();
      if (
        !liability &&
        m.state.tanks.e95.quantity < 100 &&
        m.state.tanks.on.quantity < 100 &&
        !Object.values(m.state.goods).some((g) => g.quantity)
      ) {
        const id = m.state.development!.sites[0]?.id;
        if (!id || m.weekend.sell(id)) {
          m.weekend.rescue();
          // Synthetic insolvency fixture, explicitly separate from player balance runs.
          m.post(
            'fixture-liability',
            'fixture-liability',
            -5000000,
            0,
            0,
            true,
          );
          liability = true;
        }
      }
    }
    m.tick();
    if (m.state.campaign!.warningSince >= 0)
      warning = m.state.campaign!.warningSince;
    if (warning >= 0 && m.state.tick - warning === 1200 && !resumed) {
      m.restore(m.snapshot());
      resumed = true;
    }
    if (warning >= 0 && m.state.tick - warning < 2400)
      expect(m.state.result).toBeNull();
  }
  expect(liability).toBe(true);
  expect(resumed).toBe(true);
  expect(m.state.result).toBe('bankrupt');
  expect(m.state.tick - warning).toBe(2400);
  m.validateSave(m.snapshot());
}, 60000);
