import { Ledger, type LedgerState } from './services';

export interface JournalEntry {
  id: string;
  tick: number;
  category: string;
  cash: number;
  profit: number;
  revenue: number;
}
export interface JournalState {
  opening: number;
  cash: LedgerState;
  profit: number;
  revenue: number;
  entries: JournalEntry[];
}
export class TransactionJournal {
  readonly state: JournalState;
  constructor(value: number | JournalState) {
    if (
      typeof value === 'number' &&
      (!Number.isSafeInteger(value) || value < 0)
    )
      throw Error('Niepoprawne otwarcie księgi');
    this.state =
      typeof value === 'number'
        ? {
            opening: value,
            cash: new Ledger(value).state,
            profit: 0,
            revenue: 0,
            entries: [],
          }
        : value;
  }
  post(entry: JournalEntry, mandatory = false) {
    if (
      typeof entry.id !== 'string' ||
      !entry.id ||
      entry.id.length > 100 ||
      typeof entry.category !== 'string' ||
      !entry.category ||
      entry.category.length > 80 ||
      ![entry.tick, entry.cash, entry.profit, entry.revenue].every(
        Number.isSafeInteger,
      ) ||
      entry.tick < 0 ||
      entry.revenue < 0 ||
      this.state.entries.length >= 20000
    )
      return false;
    if (
      ![
        this.state.profit + entry.profit,
        this.state.revenue + entry.revenue,
        this.state.cash.income + Math.max(0, entry.cash),
        this.state.cash.costs - Math.min(0, entry.cash),
        this.state.cash.balance + entry.cash,
        this.state.cash.arrears - entry.cash,
      ].every(Number.isSafeInteger)
    )
      return false;
    if (!new Ledger(this.state.cash).transact(entry.id, entry.cash, mandatory))
      return false;
    this.state.entries.push({ ...entry });
    this.state.profit += entry.profit;
    this.state.revenue += entry.revenue;
    return true;
  }
  static validate(value: JournalState) {
    if (
      !value ||
      !Number.isSafeInteger(value.opening) ||
      value.opening < 0 ||
      !Array.isArray(value.entries) ||
      value.entries.length > 20000
    )
      throw Error('Niepoprawny dziennik');
    const replay = new TransactionJournal(value.opening);
    for (const entry of value.entries)
      if (!replay.post(entry, true)) throw Error('Powtórzona transakcja');
    const expected = replay.state;
    if (
      value.profit !== expected.profit ||
      value.revenue !== expected.revenue ||
      !value.cash ||
      ['balance', 'income', 'costs', 'arrears'].some(
        (k) =>
          value.cash[k as keyof LedgerState] !==
          expected.cash[k as keyof LedgerState],
      ) ||
      JSON.stringify(value.cash.ids) !== JSON.stringify(expected.cash.ids)
    )
      throw Error('Niespójny bilans');
  }
}

export interface CostStock {
  quantity: number;
  cost: number;
}
/** Retain rounding remainder in the source; the last withdrawal takes its whole cost. */
export function takeStock(stock: CostStock, amount: number): CostStock {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > stock.quantity)
    throw Error('Niepoprawny rozchód');
  if (
    ![stock.quantity, stock.cost].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw Error('Niepoprawny zapas');
  const cost = Number(
    (BigInt(stock.cost) * BigInt(amount)) / BigInt(stock.quantity),
  );
  stock.quantity -= amount;
  stock.cost -= cost;
  return { quantity: amount, cost };
}
export function addStock(stock: CostStock, incoming: CostStock) {
  if (
    ![
      incoming.quantity,
      incoming.cost,
      stock.quantity + incoming.quantity,
      stock.cost + incoming.cost,
    ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    (!incoming.quantity && incoming.cost)
  )
    throw Error('Niepoprawne przyjęcie');
  stock.quantity += incoming.quantity;
  stock.cost += incoming.cost;
}
