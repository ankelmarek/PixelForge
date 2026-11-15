import { describe, expect, it } from 'vitest';
import {
  OccupancyReservations,
  SlotQueue,
} from '../../src/engine/api/mobility';
import {
  TransactionJournal,
  takeStock,
  addStock,
} from '../../src/engine/api/economy';
describe('neutralne rezerwacje i księga transakcji', () => {
  it('nie zwalnia tyłu pojazdu przy odrzuconym ruchu ani nie przechodzi przez pieszego', () => {
    const map = new OccupancyReservations();
    expect(
      map.tryClaim('car', [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBe(true);
    expect(map.tryClaim('person', [{ x: 2, y: 1 }])).toBe(true);
    expect(
      map.tryMove(
        'car',
        [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
        [
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
      ),
    ).toBe(false);
    expect(map.ownerAt({ x: 0, y: 1 })).toBe('car');
    map.release('person');
    expect(
      map.tryMove(
        'car',
        [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
        [
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
      ),
    ).toBe(true);
    expect(map.ownerAt({ x: 0, y: 1 })).toBeUndefined();
    expect(map.tryClaim('bad', [{ x: NaN, y: 0 }])).toBe(false);
  });
  it('trzyma kolejność FIFO i limit slotów po serializacji', () => {
    const queue = new SlotQueue([], 2);
    expect(queue.join({ id: 'a', tick: 1, serial: 1 })).toBe(true);
    expect(queue.join({ id: 'c', tick: 1, serial: 0 })).toBe(false);
    expect(queue.join({ id: 'b', tick: 1, serial: 2 })).toBe(true);
    expect(queue.join({ id: 'c', tick: 2, serial: 3 })).toBe(false);
    const restored = new SlotQueue(structuredClone(queue.entries), 2);
    restored.leave('a');
    expect(restored.head).toBe('b');
    expect(
      () =>
        new SlotQueue(
          [
            { id: 'a', tick: 1, serial: 1 },
            { id: 'a', tick: 2, serial: 2 },
          ],
          2,
        ),
    ).toThrow();
  });
  it('oddziela zakup zapasu od wyniku i odtwarza zaległości dokładnie raz', () => {
    const book = new TransactionJournal(1000);
    expect(
      book.post({
        id: 'buy',
        category: 'stock',
        tick: 1,
        cash: -600,
        profit: 0,
        revenue: 0,
      }),
    ).toBe(true);
    expect(book.state.profit).toBe(0);
    expect(
      book.post({
        id: 'buy',
        category: 'stock',
        tick: 1,
        cash: -600,
        profit: 0,
        revenue: 0,
      }),
    ).toBe(false);
    expect(
      book.post(
        {
          id: 'wage',
          category: 'staff',
          tick: 2,
          cash: -500,
          profit: -500,
          revenue: 0,
        },
        true,
      ),
    ).toBe(true);
    expect(book.state.cash.arrears).toBe(100);
    book.post({
      id: 'sale',
      category: 'sale',
      tick: 3,
      cash: 900,
      profit: 300,
      revenue: 900,
    });
    expect(book.state.cash.balance).toBe(800);
    expect(book.state.cash.arrears).toBe(0);
    TransactionJournal.validate(book.state);
    const corrupt = structuredClone(book.state);
    corrupt.cash.balance++;
    expect(() => TransactionJournal.validate(corrupt)).toThrow();
  });
  it('zachowuje ostatni grosz i odrzuca przekroczenie bezpiecznej liczby', () => {
    const stock = { quantity: 11, cost: 7 },
      out = { quantity: 0, cost: 0 };
    for (let i = 0; i < 11; i++) addStock(out, takeStock(stock, 1));
    expect(out).toEqual({ quantity: 11, cost: 7 });
    expect(stock).toEqual({ quantity: 0, cost: 0 });
    expect(() => takeStock(stock, 1)).toThrow();
    expect(() =>
      addStock(
        { quantity: Number.MAX_SAFE_INTEGER, cost: 0 },
        { quantity: 1, cost: 0 },
      ),
    ).toThrow();
    const book = new TransactionJournal(Number.MAX_SAFE_INTEGER);
    expect(
      book.post({
        id: 'overflow',
        category: 'cash',
        tick: 0,
        cash: 1,
        profit: 0,
        revenue: 0,
      }),
    ).toBe(false);
  });
});
