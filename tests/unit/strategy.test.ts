import { describe, expect, it } from 'vitest';
import {
  RegionalNavigator,
  ScenarioClock,
  Ledger,
  Inventory,
  Reservations,
  lineCells,
  ownsAll,
} from '../../src/engine/api/strategy';

describe('neutralne kontrakty dynamicznej strategii', () => {
  it('zmienia tylko lokalne sektory i zachowuje izolację podglądu', () => {
    const blocked = new Set<string>();
    const geometry = { width: 128, height: 64, terrain: { sectorSize: 16 } };
    const free = (p: { x: number; y: number }) => !blocked.has(`${p.x},${p.y}`);
    const nav = new RegionalNavigator(geometry, free);
    while (!nav.prepare(4)) {
      /* bounded initialization */
    }
    const far = nav.revisionAt({ x: 100, y: 40 });
    expect(nav.findPath({ x: 10, y: 8 }, { x: 24, y: 8 })).not.toBeNull();
    const preview = nav.fork((p) => free(p) && p.x !== 16);
    preview.invalidate({ x: 16, y: 0, width: 1, height: 64 });
    expect(preview.findPath({ x: 10, y: 8 }, { x: 24, y: 8 })).toBeNull();
    expect(nav.findPath({ x: 10, y: 8 }, { x: 24, y: 8 })).not.toBeNull();
    blocked.add('16,8');
    nav.invalidate({ x: 16, y: 8, width: 1, height: 1 }, 1);
    const path = nav.findPath({ x: 10, y: 8 }, { x: 24, y: 8 })!;
    expect(path.some((p) => p.x === 16 && p.y === 8)).toBe(false);
    expect(nav.revisionAt({ x: 100, y: 40 })).toBe(far);
    expect(nav.lastRebuilt).toBeLessThanOrEqual(2);
    blocked.clear();
    nav.invalidate({ x: 16, y: 8, width: 1, height: 1 });
    expect(nav.findPath({ x: 10, y: 8 }, { x: 24, y: 8 })).toHaveLength(14);
  });
  it('zegar nie pomija ticków przy x4 i nie działa na pauzie', () => {
    const a = new ScenarioClock(),
      b = new ScenarioClock();
    let one = 0,
      four = 0;
    for (let i = 0; i < 400; i++) a.advance(17, () => one++);
    b.speed = 4;
    for (let i = 0; i < 100; i++) b.advance(17, () => four++);
    expect(four).toBe(one);
    b.paused = true;
    b.advance(1000, () => four++);
    expect(four).toBe(one);
  });
  it('transfer, rezerwacje i sprzedaż są ograniczone i idempotentne', () => {
    const stock = new Inventory({ ore: 20 }, 30),
      out = new Inventory({}, 10);
    const reservations = new Reservations();
    expect(reservations.reserve('a', 'ore', 8, 20)).toBe(true);
    expect(reservations.reserve('b', 'ore', 13, 20)).toBe(false);
    expect(stock.transfer(out, 'ore', 11)).toBe(false);
    expect(stock.amount('ore')).toBe(20);
    expect(stock.transfer(out, 'ore', 8)).toBe(true);
    expect(stock.total + out.total).toBe(20);
    const ledger = new Ledger(100);
    expect(ledger.transact('buy', -101)).toBe(false);
    expect(ledger.transact('sale-1', 40)).toBe(true);
    expect(ledger.transact('sale-1', 40)).toBe(false);
    expect(ledger.balance).toBe(140);
    expect(() => ledger.transact('bad', NaN)).toThrow();
  });
  it('własność obejmuje cały ukośny odcinek, a nie tylko końce', () => {
    const cells = lineCells({ x: 0, y: 0 }, { x: 8, y: 6 });
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 8, y: 6 });
    expect(
      ownsAll(cells, [
        { x: 0, y: 0, width: 2, height: 2 },
        { x: 7, y: 5, width: 2, height: 2 },
      ]),
    ).toBe(false);
  });
});

it('pojazd wymaga pełnego prześwitu 3×3 także na szwie sektora', () => {
  const cells = new Set<string>();
  for (let x = 0; x < 64; x++)
    for (let y = 14; y <= 18; y++) cells.add(`${x},${y}`);
  const nav = new RegionalNavigator(
    { width: 64, height: 32, terrain: { sectorSize: 16 } },
    (p) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!cells.has(`${p.x + dx},${p.y + dy}`)) return false;
      return true;
    },
  );
  expect(nav.findPath({ x: 2, y: 16 }, { x: 60, y: 16 })).not.toBeNull();
  for (const y of [14, 15, 17, 18]) cells.delete(`32,${y}`);
  nav.invalidate({ x: 32, y: 14, width: 1, height: 5 }, 1);
  expect(nav.findPath({ x: 2, y: 16 }, { x: 60, y: 16 })).toBeNull();
  for (const y of [15, 17]) cells.add(`32,${y}`);
  nav.invalidate({ x: 32, y: 14, width: 1, height: 5 }, 1);
  expect(nav.findPath({ x: 2, y: 16 }, { x: 60, y: 16 })).not.toBeNull();
});

it('receptura nie zużywa wsadu przy pełnym wyjściu', () => {
  const input = new Inventory({ ore: 10000 }, 10000),
    output = new Inventory({ metal: 9500 }, 10000);
  expect(input.process(output, 'ore', 1000, 'metal', 600)).toBe(false);
  expect(input.amount('ore')).toBe(10000);
  output.stock.metal = 9000;
  expect(input.process(output, 'ore', 1000, 'metal', 600)).toBe(true);
  expect(input.amount('ore')).toBe(9000);
  expect(output.amount('metal')).toBe(9600);
});
