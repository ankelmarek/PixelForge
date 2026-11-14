import type { Cell, GridRect } from '../simulation/types';

export class ScenarioClock {
  speed: 1 | 2 | 4 = 1;
  paused = false;
  remainder = 0;
  advance(milliseconds: number, tick: () => void) {
    if (this.paused || !Number.isFinite(milliseconds) || milliseconds < 0)
      return;
    this.remainder += milliseconds * this.speed;
    while (this.remainder >= 50) {
      this.remainder -= 50;
      tick();
    }
  }
}
export interface LedgerState {
  balance: number;
  income: number;
  costs: number;
  arrears: number;
  ids: string[];
}
export class Ledger {
  readonly state: LedgerState;
  constructor(balance: number | LedgerState) {
    this.state =
      typeof balance === 'number'
        ? { balance, income: 0, costs: 0, arrears: 0, ids: [] }
        : balance;
  }
  get balance() {
    return this.state.balance;
  }
  transact(id: string, amount: number, mandatory = false) {
    if (!Number.isSafeInteger(amount)) throw Error('Niepoprawna kwota');
    if (
      this.state.ids.includes(id) ||
      (!mandatory && this.balance + amount < 0)
    )
      return false;
    this.state.ids.push(id);
    if (amount > 0) this.state.income += amount;
    else this.state.costs -= amount;
    this.state.balance += amount;
    if (this.balance < 0) {
      this.state.arrears -= this.balance;
      this.state.balance = 0;
    }
    if (amount > 0 && this.state.arrears) {
      const payment = Math.min(this.balance, this.state.arrears);
      this.state.balance -= payment;
      this.state.arrears -= payment;
    }
    return true;
  }
}
export class Inventory {
  constructor(
    readonly stock: Record<string, number>,
    readonly capacity: number,
  ) {}
  get total() {
    return Object.values(this.stock).reduce((a, b) => a + b, 0);
  }
  amount(resource: string) {
    return this.stock[resource] ?? 0;
  }
  transfer(to: Inventory, resource: string, amount: number) {
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      this.amount(resource) < amount ||
      to.total + amount > to.capacity
    )
      return false;
    this.stock[resource] -= amount;
    to.stock[resource] = to.amount(resource) + amount;
    return true;
  }
  process(
    output: Inventory,
    input: string,
    inputAmount: number,
    product: string,
    outputAmount: number,
  ) {
    if (
      ![inputAmount, outputAmount].every(
        (n) => Number.isSafeInteger(n) && n > 0,
      ) ||
      this.amount(input) < inputAmount ||
      output.total + outputAmount > output.capacity
    )
      return false;
    this.stock[input] -= inputAmount;
    output.stock[product] = output.amount(product) + outputAmount;
    return true;
  }
}
export class Reservations {
  private entries = new Map<string, { resource: string; amount: number }>();
  amount(resource: string) {
    return [...this.entries.values()]
      .filter((r) => r.resource === resource)
      .reduce((a, r) => a + r.amount, 0);
  }
  reserve(owner: string, resource: string, amount: number, available: number) {
    if (
      this.entries.has(owner) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      this.amount(resource) + amount > available
    )
      return false;
    this.entries.set(owner, { resource, amount });
    return true;
  }
  release(owner: string) {
    this.entries.delete(owner);
  }
}
export const inside = (p: Cell, r: GridRect) =>
  p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;
export const ownsAll = (cells: Cell[], parcels: GridRect[]) =>
  cells.every((p) => parcels.some((r) => inside(p, r)));
export function lineCells(a: Cell, b: Cell): Cell[] {
  const cells: Cell[] = [],
    dx = Math.abs(b.x - a.x),
    dy = -Math.abs(b.y - a.y),
    sx = a.x < b.x ? 1 : -1,
    sy = a.y < b.y ? 1 : -1;
  let x = a.x,
    y = a.y,
    error = dx + dy;
  for (;;) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) return cells;
    const e = 2 * error;
    if (e >= dy) {
      error += dy;
      x += sx;
    }
    if (e <= dx) {
      error += dx;
      y += sy;
    }
  }
}
export function rectCells(r: GridRect): Cell[] {
  const result: Cell[] = [];
  for (let y = r.y; y < r.y + r.height; y++)
    for (let x = r.x; x < r.x + r.width; x++) result.push({ x, y });
  return result;
}
