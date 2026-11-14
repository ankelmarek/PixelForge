import { Ledger, LotBook, type ResourceLot } from '../../engine/api/strategy';
import type { Building, Row, VineyardState } from './model';
import { varieties, type Variety } from './cultivars';
import { market } from './campaign';

export const amountOf = (lots: ResourceLot[]) =>
  lots.reduce((n, l) => n + l.quantity, 0);
export function grapeQuality(s: VineyardState, row: Row) {
  const p = s.environment!.crops[row.id].plots;
  const health = p.reduce((n, p) => n + p.buds - p.mildew, 0) / p.length;
  const v = varieties[row.variety];
  return Math.max(
    3500,
    Math.min(
      8800,
      Math.round(6200 + (v.sugar - v.acid) * 60 + (health - 10000) * 0.22),
    ),
  );
}
export function recordGrowth(s: VineyardState, row: Row, amount: number) {
  const c = s.campaign!;
  new LotBook(c.book).add({
    owner: row.id,
    resource: 'grapes',
    kind: row.variety,
    vintage: c.year,
    quantity: amount,
    qualityMass: amount * grapeQuality(s, row),
    origins: [`${row.id}-year-${c.year}`],
  });
  const key = `${c.year}:${row.variety}`;
  c.harvests[key] = (c.harvests[key] ?? 0) + amount;
}
export function finishPress(s: VineyardState, b: Building) {
  const book = new LotBook(s.campaign!.book);
  for (const l of book.list(`press:${b.id}`)) {
    const part = book.take(l.id, l.quantity)!;
    const amount = part.quantity * 0.6;
    book.add({
      ...part,
      owner: `must:${b.id}`,
      resource: 'must',
      quantity: amount,
      qualityMass: Math.floor(part.qualityMass / part.quantity) * amount,
    });
  }
}
export function stepCellars(s: VineyardState) {
  const c = s.campaign!,
    book = new LotBook(c.book);
  for (const b of s.buildings) {
    const cellar = c.cellars[b.id];
    if (b.work) continue;
    const process = cellar.process;
    if (process) {
      if (process.stage === 'ferment' && --process.remaining <= 0) {
        for (const l of book.list(`ferment:${b.id}`)) {
          const part = book.take(l.id, l.quantity)!;
          const amount = Math.floor((part.quantity * 95) / 100);
          const quality = Math.min(
            10000,
            Math.floor(part.qualityMass / part.quantity) +
              (process.reserve ? 1000 : 0) +
              (cellar.upgrades.control ? 600 : 0),
          );
          c.fermented += part.quantity;
          c.processLoss += part.quantity - amount;
          book.add({
            ...part,
            owner: `wine:${b.id}`,
            resource: 'wine',
            quantity: amount,
            qualityMass: quality * amount,
          });
        }
        process.stage = 'bottle';
        process.remaining = 0;
        process.work = 60;
      }
      continue;
    }
    if (
      amountOf(book.list(`bottles:${b.id}`)) >=
      (cellar.upgrades.tank ? 256 : 128)
    )
      continue;
    // Keep rocznik/odmiana separate; leftovers wait for a compatible next lot.
    const first = book
      .list(`must:${b.id}`)
      .find((l) => l.quantity >= 6000 || s.tick % 12000 >= 8400);
    if (!first) continue;
    const amount = Math.min(
      first.quantity,
      cellar.upgrades.tank ? 24000 : 12000,
    );
    const part = book.take(first.id, amount)!;
    b.must[first.kind] -= amount;
    book.add({ ...part, owner: `ferment:${b.id}` });
    cellar.process = {
      stage: 'ferment',
      remaining: cellar.mode === 'reserve' ? 1800 : 600,
      work: 0,
      reserve: cellar.mode === 'reserve',
    };
  }
}
export function needsBottler(s: VineyardState, b: Building) {
  const c = s.campaign,
    cellar = c?.cellars[b.id];
  return (
    !!cellar &&
    cellar.process?.stage === 'bottle' &&
    amountOf(new LotBook(c!.book).list(`bottles:${b.id}`)) <
      (cellar.upgrades.tank ? 256 : 128)
  );
}
export function bottle(s: VineyardState, b: Building) {
  const c = s.campaign!,
    cellar = c.cellars[b.id],
    book = new LotBook(c.book);
  if (!cellar.process || cellar.process.stage !== 'bottle') return true;
  if (--cellar.process.work > 0) return false;
  let space =
    (cellar.upgrades.tank ? 256 : 128) - amountOf(book.list(`bottles:${b.id}`));
  for (const l of book.list(`wine:${b.id}`)) {
    const n = Math.min(space, Math.floor(l.quantity / 750));
    if (!n) continue;
    const part = book.take(l.id, n * 750)!;
    const quality = Math.floor(part.qualityMass / part.quantity);
    book.add({
      ...part,
      owner: `bottles:${b.id}`,
      resource: 'bottles',
      quantity: n,
      qualityMass: quality * n,
    });
    c.bottledML += n * 750;
    space -= n;
  }
  cellar.process = null;
  return true;
}
export function sellProduction(s: VineyardState, id: string, early = false) {
  const c = s.campaign!,
    book = new LotBook(c.book);
  const lots = early
    ? [...book.list(`must:${id}`), ...book.list(`wine:${id}`)]
    : book.list(`bottles:${id}`);
  if (!lots.length) return false;
  let value = 0;
  for (const source of lots) {
    const l = { ...source };
    const q = Math.floor(l.qualityMass / l.quantity),
      v = varieties[l.kind as Variety];
    let price =
      l.resource === 'bottles'
        ? Math.floor(
            ((3000 + q / 5) *
              (v.price / 20) *
              market(s.environment!.seed, c.year)) /
              100,
          )
        : Math.floor(l.resource === 'must' ? v.price / 10 : v.price / 7);
    const contract = c.contracts.find(
      (t) => t.status === 'active' && t.year === c.year && q >= t.quality,
    );
    let bonus = 0;
    if (contract && l.resource === 'bottles') {
      const n = Math.min(l.quantity, contract.required - contract.delivered);
      bonus = Math.floor(n * price * 0.25);
      contract.delivered += n;
      if (contract.delivered === contract.required) contract.status = 'done';
    }
    price = Math.max(1, price);
    value += l.quantity * price + bonus;
    book.take(l.id, l.quantity);
    if (l.resource === 'bottles') {
      c.bottles += l.quantity;
      c.qualityMass += l.qualityMass;
      s.sold += l.quantity * 750;
    } else if (l.resource === 'must') {
      c.mustSales += l.quantity;
      s.buildings.find((b) => b.id === id)!.must[l.kind] -= l.quantity;
      s.sold += l.quantity;
    } else {
      c.wineSales += l.quantity;
      s.sold += l.quantity;
    }
  }
  new Ledger(s.ledger).transact(`wine-sale-${s.serial++}`, value);
  c.salesRevenue += value;
  return true;
}
