import { netWorthOf } from './accounting';
import type { StationState } from './types';
import { EVENT_KINDS, WEEKEND_END, type WeekendEvent } from './campaign-data';

/** Reject inconsistent v3 snapshots rather than replaying payments or healing lost services. */
export function validateCampaign(s: StationState) {
  const c = s.campaign!;
  const fail = (): never => {
    throw Error('Stacja: niespójny zapis weekendu');
  };
  const int = (v: unknown, min = 0, max = WEEKEND_END): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
  if (
    !s.development ||
    c.revision !== 'weekend-1' ||
    !int(c.arrivalWindow, 1, 400) ||
    !int(c.nextEvent, 0, WEEKEND_END + 3000) ||
    !int(c.eventIndex, 0, 30) ||
    !int(c.criticalEnd, -900, s.tick) ||
    !int(c.warningSince, -1, s.tick) ||
    !Array.isArray(c.history) ||
    c.history.length > 30 ||
    !Array.isArray(c.ratings) ||
    c.ratings.length > 400 ||
    !c.rescue ||
    typeof c.rescue.taken !== 'boolean' ||
    typeof c.rescue.repaid !== 'boolean' ||
    (c.rescue.repaid && !c.rescue.taken) ||
    (s.result && c.rescue.taken && !c.rescue.repaid) ||
    !c.wash ||
    !Array.isArray(c.wash.queue) ||
    c.wash.queue.length > 3 ||
    new Set(c.wash.queue).size !== c.wash.queue.length ||
    !int(c.wash.progress, 0, 499) ||
    !int(c.wash.completed, 0, 400)
  )
    fail();
  const validateEvent = (e: WeekendEvent) => {
    if (
      !e ||
      !int(e.id, 0, c.eventIndex - 1) ||
      !EVENT_KINDS.includes(e.kind) ||
      !int(e.announced, 0, s.tick) ||
      !int(e.start, e.announced + 400) ||
      !int(e.end, e.start, e.start + 1800) ||
      !int(
        e.remaining,
        0,
        e.kind === 'tourists' ? 1 : e.kind === 'trucks' ? 3 : 0,
      ) ||
      typeof e.accepted !== 'boolean' ||
      (e.accepted && e.kind !== 'discount')
    )
      fail();
  };
  for (const e of c.history) validateEvent(e);
  if (c.event) validateEvent(c.event);
  const history = [...c.history, ...(c.event ? [c.event] : [])];
  if (
    new Set(history.map((e) => e.id)).size !== history.length ||
    c.history.some(
      (e, i) => e.end > s.tick || (i > 0 && e.announced < c.history[i - 1].end),
    ) ||
    (c.event && c.history.length && c.event.announced < c.history.at(-1)!.end)
  )
    fail();
  for (let i = 1; i < history.length; i++)
    if (
      history[i - 1].kind === 'fault' &&
      history[i].announced < history[i - 1].end + 900
    )
      fail();
  if (s.result === 'success' && netWorthOf(s) <= 0) fail();
  const ids = new Set<string>();
  for (const r of c.ratings) {
    if (
      !r ||
      !/^c-\d+$/.test(r.id) ||
      ids.has(r.id) ||
      !int(r.tick, 0, s.tick) ||
      typeof r.served !== 'boolean' ||
      !int(r.wait) ||
      !int(r.score, 0, 10000) ||
      !Array.isArray(r.parts) ||
      r.parts.length !== 5 ||
      r.parts.some((v) => !int(v, 0, 10000)) ||
      r.score !==
        Math.round(
          r.parts.reduce((n, v, i) => n + v * [30, 25, 20, 15, 10][i], 0) / 100,
        )
    )
      fail();
    ids.add(r.id);
  }
  if (
    c.ratings.length !== s.visits ||
    c.ratings.filter((r) => r.served).length !== s.served ||
    c.ratings.reduce((n, r) => n + r.score, 0) !== s.satisfaction
  )
    fail();
  const entries = s.journal.entries;
  const exact = (
    id: string,
    category: string,
    cash: number,
    profit: number,
    revenue: number,
  ) => {
    const e = entries.find((e) => e.id === id);
    if (
      !e ||
      e.category !== category ||
      e.cash !== cash ||
      e.profit !== profit ||
      e.revenue !== revenue
    )
      fail();
  };
  if (
    c.rescue.taken !== entries.some((e) => e.id === 'weekend-rescue') ||
    c.rescue.repaid !== entries.some((e) => e.id === 'weekend-repayment')
  )
    fail();
  if (c.rescue.taken) exact('weekend-rescue', 'loan', 150000, 0, 0);
  if (c.rescue.repaid) {
    exact('weekend-repayment', 'loan-repayment', -150000, 0, 0);
    exact('weekend-loan-fee', 'loan-fee', -15000, -15000, 0);
  }
  const sales = entries.filter((e) => e.category === 'wash-sale');
  if (
    sales.length !== c.wash.completed ||
    (!c.wash.customer && c.wash.progress)
  )
    fail();
  for (const sale of sales) {
    if (!/^wash-sale-c-\d+$/.test(sale.id)) fail();
    exact(sale.id, 'wash-sale', 2500, 2500, 2500);
    exact(sale.id.replace('sale', 'cost'), 'wash-cost', -800, -800, 0);
  }
  for (const e of entries) {
    if (e.category === 'resale') {
      const id = e.id.slice(5),
        purchase = entries.find((a) => a.id === `build-${id}`);
      if (
        !/^sell-site-\d+$/.test(e.id) ||
        !purchase ||
        purchase.category !== 'construction' ||
        e.cash !== Math.floor(-purchase.cash * 0.6) ||
        e.profit ||
        e.revenue ||
        s.development!.sites.some((p) => p.id === id)
      )
        fail();
    }
    if (e.category === 'repair') {
      if (!/^repair-\d+$/.test(e.id)) fail();
      exact(e.id, 'repair', -12000, -12000, 0);
    }
  }
  const f = c.fault;
  if (f) {
    if (
      !int(f.pump, 0, s.pumps.length - 1) ||
      !s.pumps[f.pump].built ||
      !int(f.since, 0, s.tick) ||
      typeof f.repair !== 'boolean' ||
      !int(f.progress, 0, 299) ||
      c.event?.kind !== 'fault' ||
      c.event.start !== f.since ||
      (!f.repair && f.progress)
    )
      fail();
    if (f.repair) exact(`repair-${f.since}`, 'repair', -12000, -12000, 0);
  }
  for (const w of s.workers)
    if (
      w.job?.kind === 'repair' &&
      (!f?.repair || w.job.id !== `repair-${f.since}`)
    )
      fail();
  for (const a of s.customers) {
    const j = a.journey;
    if (
      !j ||
      typeof j.fuel !== 'boolean' ||
      !int(j.goods, 0, 9) ||
      !['none', 'wanted', 'queued', 'active', 'done', 'missed'].includes(
        j.wash,
      ) ||
      !int(j.price, 0, 10000) ||
      !int(j.comfort, 0, 10000) ||
      !int(j.interruptions, 0, 7) ||
      typeof j.bus !== 'boolean' ||
      (j.bus && (a.vehicle.kind !== 'truck' || a.fuel !== null)) ||
      (j.wash === 'queued') !== c.wash.queue.includes(a.id) ||
      (j.wash === 'active') !== (c.wash.customer === a.id) ||
      (a.phase === 'wash-wait') !== (j.wash === 'queued') ||
      ['to-wash', 'washing'].includes(a.phase) !== (j.wash === 'active')
    )
      fail();
    if (a.phase === 'washing')
      exact(`wash-cost-${a.id}`, 'wash-cost', -800, -800, 0);
    if (j!.wash === 'done')
      exact(`wash-sale-${a.id}`, 'wash-sale', 2500, 2500, 2500);
  }
  if (
    c.wash.queue.some((id) => !s.customers.some((a) => a.id === id)) ||
    (c.wash.customer !== null &&
      !s.customers.some((a) => a.id === c.wash.customer)) ||
    s.development!.sites.filter((p) => p.kind === 'wash').length > 1 ||
    ((c.wash.customer || c.wash.queue.length) &&
      !s.development!.sites.some((p) => p.kind === 'wash' && !p.progress))
  )
    fail();
  if (
    s.result === 'bankrupt' &&
    (c.warningSince < 0 ||
      s.tick - c.warningSince < 2400 ||
      !c.rescue.taken ||
      s.journal.cash.balance > 0)
  )
    fail();
}
