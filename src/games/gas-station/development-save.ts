import { SlotQueue } from '../../engine/api/mobility';
import { inside, ownsAll, rectCells } from '../../engine/api/strategy';
import { FUELS, GOODS, prices } from './world';
import { PARCELS } from './development';
import { roadLine, roadBounds, siteBounds, StationTopology } from './placement';
import type { StationState } from './types';

export function validateDevelopment(s: StationState) {
  const d = s.development;
  if (!d) return;
  const fail = () => {
    throw Error('Stacja: niespójna rozbudowa lub najem');
  };
  const int = (v: unknown, min = 0, max = 1_000_000_000): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
  if (
    d.revision !== 'development-1' ||
    d.duration !== 14400 ||
    JSON.stringify(d.boundaries) !== '[7200,10800,14400]' ||
    !Array.isArray(d.parcels) ||
    !d.parcels.includes('start') ||
    new Set(d.parcels).size !== d.parcels.length ||
    d.parcels.some((id) => !PARCELS.some((p) => p.id === id)) ||
    !Array.isArray(d.roads) ||
    d.roads.length > 64 ||
    !Array.isArray(d.sites) ||
    d.sites.length > 24 ||
    !['customers', 'deliveries'].includes(d.priority) ||
    typeof d.secondCheckout !== 'boolean' ||
    [
      'wages',
      'wageTotal',
      'goodsRevenue',
      'fuelRevenue',
      'constructionSpent',
    ].some((k) => !int(d[k as 'wages'])) ||
    !int(d.wageRemainder, 0, 1199) ||
    [...FUELS, ...GOODS].some(
      (k) =>
        !int(d.prices?.[k], prices[k].buy + 50, prices[k].sell + 300) ||
        d.prices[k] % 10,
    )
  )
    return fail();
  const id = new Set<string>();
  const point = (p: { x: number; y: number }) =>
    p && int(p.x, 8, 247) && int(p.y, 8, 247);
  for (const r of d.roads) {
    if (
      !r ||
      !/^road-\d+$/.test(r.id) ||
      id.has(r.id) ||
      !point(r.from) ||
      !point(r.to) ||
      !int(r.cost) ||
      roadLine(r.from, r.to).length < 3 ||
      roadLine(r.from, r.to).length > 65 ||
      !ownsAll(
        rectCells(roadBounds(r)),
        PARCELS.filter((p) => d.parcels.includes(p.id)),
      )
    )
      return fail();
    id.add(r.id);
  }
  for (const p of d.sites) {
    if (
      !p ||
      !/^site-\d+$/.test(p.id) ||
      id.has(p.id) ||
      !['pump', 'heavy-pump', 'parking', 'tank'].includes(p.kind) ||
      !point(p.point) ||
      !int(p.rotation, 0, 3) ||
      !int(p.progress, 0, 300) ||
      !int(p.cost) ||
      !FUELS.includes(p.fuel) ||
      inside(p.point, PARCELS[0]) ||
      !ownsAll(
        rectCells(siteBounds(p)),
        PARCELS.filter((r) => d.parcels.includes(r.id)),
      )
    )
      return fail();
    id.add(p.id);
  }
  if (!new StationTopology(s).connections()) return fail();
  const t = d.tenant;
  if (
    !t ||
    ![
      'owned',
      'closing',
      'refitting',
      'leased',
      'returning',
      'restoring',
    ].includes(t.phase) ||
    !int(t.since, 0, s.tick) ||
    typeof t.everSigned !== 'boolean' ||
    !Array.isArray(t.queue) ||
    !Array.isArray(t.staff) ||
    t.staff.length !== (['leased', 'returning'].includes(t.phase) ? 2 : 0) ||
    !Array.isArray(t.sales) ||
    t.sales.length > 1000 ||
    !Array.isArray(t.settlements) ||
    t.settlements.length > 3 ||
    !int(t.deliveries, 0, 100) ||
    GOODS.some(
      (k) => !int(t.stock?.[k], 0, 20) || !int(t.supplied?.[k], 0, 2000),
    )
  )
    return fail();
  new SlotQueue(t.queue, 5);
  if (
    t.staff.length &&
    (t.staff[0].id !== 'tenant-cashier' ||
      t.staff[1].id !== 'tenant-stocker' ||
      t.staff.some((m) => m.kind !== 'person'))
  )
    return fail();
  if (
    d.checkout &&
    !s.workers.some(
      (w) => w.motion.id === d.checkout!.worker && w.role === 'checkout',
    )
  )
    return fail();
  const saleIds = new Set<string>();
  for (const sale of t.sales) {
    if (
      !sale ||
      !/^tenant-c-\d+$/.test(sale.id) ||
      saleIds.has(sale.id) ||
      !int(sale.tick, 0, s.tick) ||
      !int(sale.total) ||
      GOODS.some((k) => !int(sale.items?.[k], 0, 3)) ||
      sale.total !==
        GOODS.reduce((n, k) => n + sale.items[k] * prices[k].sell, 0)
    )
      return fail();
    saleIds.add(sale.id);
  }
  for (const k of GOODS)
    if (
      t.stock[k] + t.sales.reduce((n, e) => n + e.items[k], 0) !==
      t.supplied[k]
    )
      return fail();
  const c = t.contract;
  if (c) {
    if (
      !/^lease-\d+$/.test(c.id) ||
      !['fixed', 'share'].includes(c.type) ||
      !int(c.signed, d.boundaries[0], s.tick) ||
      !int(c.active, -1, s.tick) ||
      !int(c.end, -1, s.tick) ||
      typeof c.terminate !== 'boolean' ||
      c.rent !== (c.type === 'fixed' ? 12000 : 5000) ||
      c.share !== (c.type === 'share' ? 800 : 0)
    )
      return fail();
  } else if (
    t.phase !== 'owned' ||
    t.sales.length ||
    t.settlements.length ||
    t.everSigned
  )
    return fail();
  const settlements = new Set<string>();
  for (const e of t.settlements) {
    if (
      !c ||
      !int(e.shift, 0, 2) ||
      s.tick < d.boundaries[e.shift] ||
      e.id !== `lease-${c.id}-${e.shift}` ||
      settlements.has(e.id)
    )
      return fail();
    settlements.add(e.id);
    const start = e.shift ? d.boundaries[e.shift - 1] : 0,
      end = d.boundaries[e.shift];
    const ticks = Math.max(
      0,
      Math.min(end, c.end < 0 ? end : c.end) - Math.max(start, c.active),
    );
    const turnover = t.sales
      .filter((a) => a.tick >= start && a.tick < end)
      .reduce((n, a) => n + a.total, 0);
    if (
      e.ticks !== ticks ||
      e.turnover !== turnover ||
      e.rent !== Math.floor((c.rent * ticks) / (end - start)) ||
      e.share !== Math.floor((turnover * c.share) / 10000)
    )
      return fail();
    for (const type of ['rent', 'share'] as const) {
      const entry = s.journal.entries.find((a) => a.id === `${e.id}-${type}`);
      if (
        !entry ||
        entry.category !== `tenant-${type}` ||
        entry.cash !== e[type] ||
        entry.profit !== e[type] ||
        entry.revenue !== e[type]
      )
        return fail();
    }
  }
  if (t.delivery) {
    const v = t.delivery;
    if (
      !/^tenant-delivery-\d+$/.test(v.id) ||
      !['ordered', 'travelling', 'unloading', 'returning'].includes(v.phase) ||
      !int(v.progress, 0, 100) ||
      !int(v.due, 0, d.duration + 200) ||
      (v.phase === 'ordered') !== !v.motion ||
      (v.motion && (v.motion.id !== v.id || v.motion.kind !== 'van'))
    )
      return fail();
  }
  for (const checkout of [d.checkout, t.checkout])
    if (
      checkout &&
      (!s.customers.some(
        (c) => c.id === checkout.customer && c.pedestrian === 'paying',
      ) ||
        !int(checkout.progress, 0, 600))
    )
      return fail();
  if (d.checkout && !d.secondCheckout) return fail();
  if (
    t.queue.some(
      (e) => !s.customers.some((c) => c.id === e.id && c.tenantVisit),
    )
  )
    return fail();
}
