import { LotBook } from '../../engine/api/strategy';
import type { VineyardState } from './model';
import {
  campaignRules,
  crewCatalog,
  campaignSuccess,
  offers,
} from './campaign';
import { varieties } from './cultivars';
import { SEASON_TICKS } from './climate';

/** Reject incoherent quantities, ownership, finances and terminal states before restore. */
export function validateCampaign(s: VineyardState) {
  const c = s.campaign;
  if (c === null) return;
  const fail = () => {
    throw Error('Winobranie RTS: uszkodzony zapis kampanii');
  };
  const int = (n: unknown, max = 1000000000000, min = 0) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const record = (n: unknown) =>
    !!n && typeof n === 'object' && !Array.isArray(n);
  if (
    !record(c) ||
    !s.environment ||
    !int(c.year, 3, 1) ||
    c.year !==
      Math.min(
        3,
        Math.floor((s.tick - (c.result && s.tick > 0 ? 1 : 0)) / SEASON_TICKS) +
          1,
      ) ||
    !record(c.book) ||
    !int(c.book.serial, 10000000, 1) ||
    !Array.isArray(c.book.lots) ||
    c.book.lots.length > 2048 ||
    !record(c.crew) ||
    !record(c.cellars) ||
    !record(c.harvests)
  )
    return fail();
  for (const k of [
    'bottles',
    'qualityMass',
    'fermented',
    'processLoss',
    'bottledML',
    'grapeSales',
    'mustSales',
    'wineSales',
    'salesRevenue',
    'borrowed',
    'principalPaid',
    'interestPaid',
    'loanDue',
  ] as const)
    if (!int(c[k])) return fail();
  if (
    c.qualityMass > c.bottles * 10000 ||
    ![0, campaignRules.loan].includes(c.borrowed) ||
    ![0, c.borrowed].includes(c.principalPaid) ||
    c.interestPaid > campaignRules.interest ||
    (!c.borrowed && (c.interestPaid || c.loanDue)) ||
    (c.borrowed && (c.loanDue < 12000 || c.loanDue > 36000)) ||
    (c.crisisSince !== null && !int(c.crisisSince, s.tick))
  )
    return fail();
  if (
    Object.keys(c.crew).length !== s.units.length ||
    Object.keys(c.cellars).length !== s.buildings.length
  )
    return fail();
  for (const u of s.units) {
    const entry = c.crew[u.id];
    if (
      !record(entry) ||
      (entry.deliveryTo !== null &&
        (u.kind !== 'tractor' ||
          !s.buildings.some((b) => b.id === entry.deliveryTo))) ||
      !Object.hasOwn(crewCatalog, entry.kind) ||
      crewCatalog[entry.kind].radius > 0 !== (u.kind === 'tractor') ||
      typeof entry.retiring !== 'boolean' ||
      !int(entry.turn, 6) ||
      !['', '-1,0', '1,0', '0,-1', '0,1', '0,0'].includes(entry.heading) ||
      !int(entry.until, 36000) ||
      (entry.kind === 'seasonal'
        ? !entry.until || entry.until % 12000 !== 0
        : entry.until !== 0)
    )
      return fail();
  }
  for (const b of s.buildings) {
    const cellar = c.cellars[b.id];
    if (
      !record(cellar) ||
      !['young', 'reserve'].includes(cellar.mode) ||
      !record(cellar.upgrades) ||
      !['press', 'tank', 'control'].every(
        (k) =>
          typeof cellar.upgrades[k as keyof typeof cellar.upgrades] ===
          'boolean',
      )
    )
      return fail();
    const p = cellar.process;
    if (
      p !== null &&
      (!record(p) ||
        !['ferment', 'bottle'].includes(p.stage) ||
        typeof p.reserve !== 'boolean' ||
        !int(p.remaining, p.reserve ? 1800 : 600) ||
        !int(p.work, 60) ||
        (p.stage === 'ferment'
          ? p.remaining === 0 || p.work !== 0
          : p.remaining !== 0 || p.work === 0))
    )
      return fail();
  }
  const book = new LotBook(c.book),
    ids = new Set<string>(),
    groups = new Set<string>();
  for (const l of c.book.lots) {
    if (
      !record(l) ||
      typeof l.id !== 'string' ||
      !/^lot-\d+$/.test(l.id) ||
      Number(l.id.slice(4)) >= c.book.serial ||
      ids.has(l.id) ||
      !Object.hasOwn(varieties, l.kind) ||
      !int(l.vintage, c.year, 1) ||
      !int(l.quantity, 100000000, 1) ||
      !int(l.qualityMass, l.quantity * 10000) ||
      !Array.isArray(l.origins) ||
      !l.origins.length ||
      l.origins.length > 192 ||
      !l.origins.every(
        (o) => typeof o === 'string' && /^[\w-]+-year-[123]$/.test(o),
      ) ||
      new Set(l.origins).size !== l.origins.length
    )
      return fail();
    ids.add(l.id);
    const group = `${l.owner}/${l.resource}/${l.kind}/${l.vintage}`;
    if (groups.has(group)) return fail();
    groups.add(group);
    const b = s.buildings.find((b) => l.owner.endsWith(`:${b.id}`));
    if (l.resource === 'grapes') {
      if (!(
        l.owner === 'warehouse' ||
        s.rows.some((r) => r.id === l.owner) ||
        s.units.some((u) => u.id === l.owner) ||
        s.buildings.some((b) => b.id === l.owner) ||
        (b && l.owner === `press:${b.id}` && b.batch)
      ))
        return fail();
    } else if (
      !b ||
      !['must', 'ferment', 'wine', 'bottles'].some(
        (stage) =>
          l.owner === `${stage}:${b.id}` &&
          l.resource === (stage === 'ferment' ? 'must' : stage),
      )
    )
      return fail();
  }
  const quantity = (owner: string, resource?: string, kind?: string) =>
    book.list(owner, resource, kind).reduce((n, l) => n + l.quantity, 0);
  const stock = (
    owner: string,
    resource: string,
    values: Record<string, number>,
  ) =>
    Object.keys(varieties).every(
      (v) => quantity(owner, resource, v) === (values[v] ?? 0),
    );
  if (!stock('warehouse', 'grapes', s.warehouse)) return fail();
  for (const r of s.rows)
    if (
      quantity(r.id) !== r.stock ||
      book
        .list(r.id)
        .some(
          (l) =>
            l.kind !== r.variety ||
            l.vintage !== c.year ||
            l.resource !== 'grapes',
        )
    )
      return fail();
  for (const u of s.units) if (!stock(u.id, 'grapes', u.cargo)) return fail();
  for (const b of s.buildings) {
    const cellar = c.cellars[b.id];
    if (
      !stock(b.id, 'grapes', b.stock) ||
      !stock(`must:${b.id}`, 'must', b.must) ||
      quantity(`press:${b.id}`) !== (b.batch?.amount ?? 0) ||
      book.list(`press:${b.id}`).some((l) => l.kind !== b.batch?.variety) ||
      quantity(`ferment:${b.id}`) > (cellar.upgrades.tank ? 24000 : 12000) ||
      quantity(`wine:${b.id}`) > 96000 ||
      quantity(`bottles:${b.id}`) > (cellar.upgrades.tank ? 256 : 128) ||
      (cellar.process?.stage === 'ferment') !== quantity(`ferment:${b.id}`) > 0
    )
      return fail();
  }
  const sum = (resource: string, exclude = '') =>
    c.book.lots
      .filter(
        (l) => l.resource === resource && !l.owner.startsWith(exclude || '!'),
      )
      .reduce((n, l) => n + l.quantity, 0);
  if (
    sum('must') + c.fermented + c.mustSales !== s.processed * 0.6 ||
    sum('wine') + c.bottledML + c.wineSales !== c.fermented - c.processLoss ||
    (sum('bottles') + c.bottles) * 750 !== c.bottledML ||
    s.sold !== c.bottles * 750 + c.mustSales + c.wineSales ||
    Object.values(c.harvests).reduce((n, v) => n + v, 0) !== s.grown
  )
    return fail();
  if (
    !Object.entries(c.harvests).every(
      ([k, v]) =>
        /^[123]:[a-z]+$/.test(k) &&
        Number(k[0]) <= c.year &&
        Object.hasOwn(varieties, k.slice(2)) &&
        int(v),
    )
  )
    return fail();
  if (!Array.isArray(c.contracts) || c.contracts.length !== c.year * 2)
    return fail();
  const expected = Array.from({ length: c.year }, (_, i) =>
    offers(i + 1),
  ).flat();
  for (const [i, t] of c.contracts.entries()) {
    const e = expected[i];
    if (
      !record(t) ||
      !['id', 'year', 'name', 'required', 'quality'].every(
        (k) => t[k as keyof typeof t] === e[k as keyof typeof e],
      ) ||
      !int(t.delivered, t.required) ||
      !['offered', 'active', 'done', 'missed'].includes(t.status) ||
      (t.status === 'done') !== (t.delivered === t.required) ||
      (t.status === 'offered' && t.delivered !== 0) ||
      (t.status === 'active' && t.year !== c.year)
    )
      return fail();
  }
  for (let year = 1; year <= 3; year++)
    if (
      c.contracts.filter((t) => t.year === year && t.status !== 'offered')
        .length > 1
    )
      return fail();
  if (
    ![null, 'success', 'partial', 'failure'].includes(c.result) ||
    (c.result !== null) !== (s.completed || s.failed) ||
    s.failed !== (c.result === 'failure') ||
    s.completed !== (c.result === 'success' || c.result === 'partial') ||
    (c.result === 'success' && !campaignSuccess(s)) ||
    (s.tick === 36000 && c.result === null) ||
    (c.result !== null &&
      s.tick < 36000 &&
      (c.result !== 'failure' ||
        c.crisisSince === null ||
        s.tick - c.crisisSince < 1200))
  )
    return fail();
}
