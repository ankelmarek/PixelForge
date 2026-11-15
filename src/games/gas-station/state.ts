import { TransactionJournal, type CostStock } from '../../engine/api/economy';
import { OccupancyReservations, SlotQueue } from '../../engine/api/mobility';
import { motion, footprint } from './traffic';
import {
  FUELS,
  GOODS,
  prices,
  UNIT,
  type StationWorld,
  type Fuel,
  type Product,
} from './world';
import type { StationState, Motion } from './types';
import { duration, goal, tankCapacity, parkingPoints } from './development';
import { validateDevelopment } from './development-save';
import { StationTopology } from './placement';

export const initialQuantities = {
  e95: 1800,
  on: 1000,
  drink: 16,
  snack: 14,
  coffee: 10,
};
export const emptyGoods = (): Record<Product, CostStock> => ({
  drink: { quantity: 0, cost: 0 },
  snack: { quantity: 0, cost: 0 },
  coffee: { quantity: 0, cost: 0 },
});
export function openingStock(k: Fuel | Product): CostStock {
  const quantity = initialQuantities[k];
  return {
    quantity,
    cost: (quantity * prices[k].buy) / (k === 'e95' || k === 'on' ? 10 : 1),
  };
}
export function createState(world: StationWorld, seed: number): StationState {
  return {
    gameVersion: '0.1.0',
    rulesRevision: world.rulesRevision,
    worldRevision: world.terrain.revision,
    seed: seed >>> 0,
    tick: 0,
    serial: 0,
    candidate: 0,
    nextArrival: 200,
    clock: { speed: 1, remainder: 0 },
    result: null,
    journal: new TransactionJournal(1500000).state,
    tanks: { e95: openingStock('e95'), on: openingStock('on') },
    goods: {
      drink: openingStock('drink'),
      snack: openingStock('snack'),
      coffee: openingStock('coffee'),
    },
    totals: Object.fromEntries(
      [...FUELS, ...GOODS].map((k) => [
        k,
        {
          ordered: 0,
          orderedCost: 0,
          refunded: 0,
          refundCost: 0,
          used: 0,
          usedCost: 0,
        },
      ]),
    ) as StationState['totals'],
    pumps: [0, 1, 2].map((i) => ({
      id: `pump-${i}`,
      built: i < 2,
      open: i < 2,
      construction: 0,
      customer: null,
    })),
    customers: [],
    workers: [
      {
        motion: motion('worker-1', 'person', { x: 110, y: 120 }),
        role: 'forecourt',
        job: null,
        cargo: emptyGoods(),
      },
      {
        motion: motion('worker-2', 'person', { x: 126, y: 112 }),
        role: 'checkout',
        job: null,
        cargo: emptyGoods(),
      },
    ],
    delivery: null,
    fuelQueue: [],
    checkoutQueue: [],
    checkout: null,
    served: 0,
    lost: 0,
    passed: 0,
    satisfaction: 0,
    visits: 0,
    fuelSold: 0,
    articles: 0,
    deliveries: 0,
    wagesUntil: 0,
    topology: 0,
    camera: {
      x: world.camera.center.x * 16,
      y: world.camera.center.y * 16,
      zoom: world.camera.zoom,
    },
  };
}
export function bodies(s: StationState): Motion[] {
  return [
    ...s.workers.map((w) => w.motion),
    ...s.customers.flatMap((c) =>
      c.driver ? [c.vehicle, c.driver] : [c.vehicle],
    ),
    ...(s.delivery?.motion ? [s.delivery.motion] : []),
    ...(s.development?.tenant.staff ?? []),
    ...(s.development?.tenant.delivery?.motion
      ? [s.development.tenant.delivery.motion]
      : []),
  ];
}
export function occupancyOf(s: StationState) {
  const occupancy = new OccupancyReservations();
  for (const m of bodies(s))
    if (!occupancy.tryClaim(m.id, footprint(m)))
      throw Error(`Stacja: kolizja ${m.id}`);
  return occupancy;
}
const integer = (v: unknown, min = 0, max = 1_000_000_000): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const fail = () => {
  throw Error('Stacja: niespójny zapis');
};
export function validateState(world: StationWorld, raw: unknown): StationState {
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 2_000_000)
    return fail();
  const s = structuredClone(raw) as StationState;
  if (s.development) validateDevelopment(s);
  const end = duration(s),
    dev = !!s.development;
  if (
    s.gameVersion !== (dev ? '0.2.0' : '0.1.0') ||
    s.rulesRevision !== world.rulesRevision ||
    s.worldRevision !== world.terrain.revision ||
    !integer(s.seed, 0, 0xffffffff) ||
    !integer(s.tick, 0, end) ||
    !integer(s.serial, 0, 1000) ||
    !integer(s.candidate, 0, 1000) ||
    !integer(s.nextArrival, 0, end + 400) ||
    !s.clock ||
    ![1, 2, 4].includes(s.clock.speed) ||
    !Number.isFinite(s.clock.remainder) ||
    s.clock.remainder < 0 ||
    s.clock.remainder >= 50 ||
    ![null, 'success', 'partial'].includes(s.result) ||
    (s.result !== null) !== (s.tick === end) ||
    !s.camera ||
    ![s.camera.x, s.camera.y, s.camera.zoom].every(Number.isFinite) ||
    s.camera.zoom < 0.5 ||
    s.camera.zoom > 2 ||
    s.camera.x < 0 ||
    s.camera.y < 0 ||
    s.camera.x > 4096 ||
    s.camera.y > 4096
  )
    return fail();
  for (const k of [
    'served',
    'lost',
    'passed',
    'visits',
    'fuelSold',
    'articles',
    'deliveries',
    'wagesUntil',
    'topology',
    'satisfaction',
  ] as const)
    if (!integer(s[k]) || (k === 'wagesUntil' && s[k] > s.tick)) return fail();
  if (
    s.served + s.lost !== s.visits ||
    s.satisfaction > s.visits * 10000 ||
    s.served > s.serial ||
    !Array.isArray(s.customers) ||
    s.customers.length > 14 ||
    !Array.isArray(s.workers) ||
    (dev
      ? s.workers.length < 2 || s.workers.length > 4
      : s.workers.length !== 2) ||
    !Array.isArray(s.pumps) ||
    s.pumps.length !==
      3 +
        (s.development?.sites.filter(
          (p) => p.kind === 'pump' || p.kind === 'heavy-pump',
        ).length ?? 0) ||
    !Array.isArray(s.fuelQueue) ||
    !Array.isArray(s.checkoutQueue)
  )
    return fail();
  TransactionJournal.validate(s.journal);
  if (
    s.journal.opening !== 1500000 ||
    s.journal.entries.some((e) => e.tick > s.tick)
  )
    return fail();
  new SlotQueue(s.fuelQueue, 3);
  new SlotQueue(s.checkoutQueue, 5);
  const ids = new Set<string>();
  const topology = new StationTopology(s);
  for (const m of bodies(s)) {
    if (
      !m ||
      typeof m.id !== 'string' ||
      !/^[a-z0-9-]{1,40}$/.test(m.id) ||
      ids.has(m.id) ||
      !['car', 'van', 'truck', 'person'].includes(m.kind) ||
      !integer(m.x, 0, 256 * UNIT) ||
      !integer(m.y, 0, 256 * UNIT) ||
      !integer(m.heading, 0, 3) ||
      !integer(m.nextHeading, 0, 3) ||
      !integer(m.turn, 0, 16) ||
      !integer(m.remainder, 0, 19) ||
      !integer(m.blocked, 0, end) ||
      !Array.isArray(m.route) ||
      m.route.length > 800 ||
      !topology.legal(m, footprint(m))
    )
      return fail();
    ids.add(m.id);
    let prev = { x: m.x / UNIT, y: m.y / UNIT };
    for (const p of m.route) {
      if (
        !p ||
        typeof p.x !== 'number' ||
        !integer(p.x * UNIT, 0, 255 * UNIT) ||
        typeof p.y !== 'number' ||
        !integer(p.y * UNIT, 0, 255 * UNIT) ||
        (p.x !== prev.x && p.y !== prev.y)
      )
        return fail();
      prev = p;
    }
  }
  if (ids.size > 32) return fail();
  occupancyOf(s);
  const clients = new Set<string>();
  for (const c of s.customers) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      c.id !== c.vehicle.id ||
      clients.has(c.id) ||
      !(dev ? ['car', 'van', 'truck'] : ['car']).includes(c.vehicle.kind) ||
      (c.driver &&
        (c.driver.id !== `driver-${c.id}` || c.driver.kind !== 'person')) ||
      ![
        'approaching',
        'bypass',
        'queue',
        'to-pump',
        'preparing',
        'fueling',
        'checkout',
        'to-shop',
        'leaving',
      ].includes(c.phase) ||
      !['car', 'walking', 'queued', 'paying', 'returning'].includes(
        c.pedestrian,
      ) ||
      ![null, ...FUELS].includes(c.fuel) ||
      !integer(c.requested, 0, dev ? 900 : 400) ||
      !integer(c.reserved, 0, c.requested) ||
      !integer(c.issued, 0, c.requested) ||
      c.reserved + c.issued > c.requested ||
      !integer(c.fuelCost) ||
      !integer(c.bought, 0, 9) ||
      !integer(c.fuelBill) ||
      c.fuelBill !== Math.floor((c.issued * c.price + 5) / 10) ||
      (dev
        ? !integer(c.price, 0, 900)
        : c.price !== (c.fuel ? prices[c.fuel].sell : 0)) ||
      !integer(c.budget) ||
      !integer(c.paidTotal, 0, c.budget) ||
      !integer(c.serial, 0, s.serial) ||
      !integer(c.admitted, -1, s.tick) ||
      !integer(c.wait, 0, end) ||
      !integer(c.patience, 1, end) ||
      !integer(c.color, 0, 3) ||
      (c.pump !== null && !integer(c.pump, 0, s.pumps.length - 1)) ||
      (c.parking !== null &&
        !integer(c.parking, 0, parkingPoints(s).length - 1)) ||
      !['paid', 'checked', 'abandoned'].every(
        (k) => typeof c[k as 'paid'] === 'boolean',
      ) ||
      !c.basket ||
      GOODS.some((k) => !integer(c.basket[k], 0, 3))
    )
      return fail();
    clients.add(c.id);
    if (
      dev &&
      (!['owned', 'tenant', 'none'].includes(c.shopping!) ||
        typeof c.tenantVisit !== 'boolean' ||
        !integer(c.tenantBill) ||
        GOODS.some(
          (k) =>
            !integer(
              c.goodsPrices?.[k],
              prices[k].buy + 50,
              prices[k].sell + 300,
            ),
        ))
    )
      return fail();
    if (
      (c.pedestrian === 'car') !== !c.driver ||
      (c.paid && !c.checked && !c.tenantVisit) ||
      (c.checked && !c.paid) ||
      (c.pump !== null && c.parking !== null)
    )
      return fail();
    if ((c.phase === 'queue') !== s.fuelQueue.some((e) => e.id === c.id))
      return fail();
    if (
      (c.pedestrian === 'walking' || c.pedestrian === 'queued') !==
      (c.tenantVisit ? s.development!.tenant.queue : s.checkoutQueue).some(
        (e) => e.id === c.id,
      )
    )
      return fail();
    if (
      c.issued &&
      c.phase !== 'fueling' &&
      !s.journal.cash.ids.includes(`issued-${c.id}`)
    )
      return fail();
    if (c.paid && c.fuel && !s.journal.cash.ids.includes(`receipt-${c.id}`))
      return fail();
    if (dev && c.paid) {
      const receipt = s.journal.entries.find((e) => e.id === `receipt-${c.id}`);
      if (c.paidTotal && receipt?.cash !== c.paidTotal) return fail();
      if (
        c.tenantVisit &&
        c.checked &&
        s.development!.tenant.sales.find((e) => e.id === `tenant-${c.id}`)
          ?.total !== c.tenantBill
      )
        return fail();
    }
  }
  if ([...s.fuelQueue, ...s.checkoutQueue].some((e) => !clients.has(e.id)))
    return fail();
  for (const [i, p] of s.pumps.entries()) {
    if (i >= 3) {
      const site = s.development!.sites.filter(
        (p) => p.kind === 'pump' || p.kind === 'heavy-pump',
      )[i - 3];
      if (p.built !== (site.progress === 0) || p.construction !== 0)
        return fail();
    }
    if (
      p.id !== `pump-${i}` ||
      typeof p.built !== 'boolean' ||
      typeof p.open !== 'boolean' ||
      !integer(p.construction, 0, 300) ||
      (p.open && !p.built) ||
      (p.customer !== null &&
        !s.customers.some((c) => c.id === p.customer && c.pump === i))
    )
      return fail();
    if (s.customers.filter((c) => c.pump === i).length > 1) return fail();
  }
  for (let i = 0; i < parkingPoints(s).length; i++)
    if (s.customers.filter((c) => c.parking === i).length > 1) return fail();
  if (
    s.checkout &&
    (!clients.has(s.checkout.customer) ||
      !integer(s.checkout.progress, 0, 500) ||
      !s.workers.some(
        (w) => w.motion.id === s.checkout?.worker && w.role === 'checkout',
      ) ||
      !s.customers.some(
        (c) => c.id === s.checkout?.customer && c.pedestrian === 'paying',
      ))
  )
    return fail();
  for (const [i, w] of s.workers.entries()) {
    if (
      w.motion.id !== `worker-${i + 1}` ||
      w.motion.kind !== 'person' ||
      !['forecourt', 'checkout'].includes(w.role) ||
      (w.job &&
        (!['prepare', 'unload', 'restock', 'build'].includes(w.job.kind) ||
          typeof w.job.id !== 'string' ||
          !integer(w.job.progress, 0, end)))
    )
      return fail();
    if (
      w.job?.kind === 'prepare' &&
      !s.customers.some((c) => c.id === w.job!.id && c.phase === 'preparing')
    )
      return fail();
    if (w.job?.kind === 'unload' && s.delivery?.id !== w.job.id) return fail();
    if (
      w.job?.kind === 'build' &&
      (w.job.id !== 'pump-2' || !s.pumps[2].construction) &&
      !s.development?.sites.some((p) => p.id === w.job!.id && p.progress)
    )
      return fail();
  }
  if (s.delivery) {
    const d = s.delivery;
    if (
      typeof d.id !== 'string' ||
      !s.journal.cash.ids.includes(`order-${d.id}`) ||
      !['ordered', 'travelling', 'unloading', 'departing'].includes(d.phase) ||
      !integer(d.due, 0, end + 600) ||
      typeof d.cancelled !== 'boolean' ||
      ![null, ...FUELS].includes(d.fuel) ||
      !integer(d.total, 1, 10000) ||
      !integer(d.received, 0, d.total) ||
      !integer(d.receiptCost) ||
      (d.phase === 'ordered') !== !d.motion ||
      (d.motion && (d.motion.id !== d.id || d.motion.kind !== 'truck'))
    )
      return fail();
  }
  for (const k of [...FUELS, ...GOODS]) {
    const fuel = k === 'e95' || k === 'on',
      stock = fuel ? s.tanks?.[k] : s.goods?.[k];
    const pending = s.delivery
      ? fuel
        ? s.delivery.fuel === k
          ? s.delivery.cargo
          : { quantity: 0, cost: 0 }
        : s.delivery.goods?.[k]
      : { quantity: 0, cost: 0 };
    const cargo = fuel ? [] : s.workers.map((w) => w.cargo?.[k]);
    if (
      [stock, pending, ...cargo].some(
        (v) =>
          !v ||
          !integer(v.quantity, 0, 250000) ||
          !integer(v.cost) ||
          (!v.quantity && v.cost),
      )
    )
      return fail();
    const t = s.totals?.[k],
      initial = openingStock(k);
    if (
      !t ||
      [
        'ordered',
        'orderedCost',
        'refunded',
        'refundCost',
        'used',
        'usedCost',
      ].some((p) => !integer(t[p as keyof typeof t]))
    )
      return fail();
    if (
      stock.quantity +
        pending.quantity +
        cargo.reduce((n, c) => n + c.quantity, 0) +
        t.used +
        t.refunded !==
        initial.quantity + t.ordered ||
      stock.cost +
        pending.cost +
        cargo.reduce((n, c) => n + c.cost, 0) +
        t.usedCost +
        t.refundCost !==
        initial.cost + t.orderedCost
    )
      return fail();
    if (
      fuel &&
      (stock.quantity + pending.quantity > tankCapacity(s, k as Fuel) ||
        s.customers
          .filter((c) => c.fuel === k)
          .reduce((n, c) => n + c.reserved, 0) > stock.quantity)
    )
      return fail();
  }
  const itemCount = GOODS.reduce(
    (n, k) =>
      n +
      s.goods[k].quantity +
      (s.delivery?.goods[k].quantity ?? 0) +
      s.workers.reduce((v, w) => v + w.cargo[k].quantity, 0),
    0,
  );
  if (
    itemCount > 80 ||
    s.fuelSold !== s.totals.e95.used + s.totals.on.used ||
    s.articles !== GOODS.reduce((n, k) => n + s.totals[k].used, 0)
  )
    return fail();
  const inProgress = s.customers.filter((c) => c.phase === 'fueling');
  const fuelRevenue = dev
    ? s.development!.fuelRevenue +
      inProgress.reduce((n, c) => n + c.fuelBill, 0)
    : FUELS.reduce((n, k) => n + (s.totals[k].used * prices[k].sell) / 10, 0);
  const goodsRevenue = dev
    ? s.development!.goodsRevenue
    : GOODS.reduce((n, k) => n + s.totals[k].used * prices[k].sell, 0);
  const leaseRevenue =
    s.development?.tenant.settlements.reduce(
      (n, e) => n + e.rent + e.share,
      0,
    ) ?? 0;
  const revenue =
    fuelRevenue + goodsRevenue - inProgress.reduce((n, c) => n + c.fuelBill, 0);
  const cost =
    [...FUELS, ...GOODS].reduce((n, k) => n + s.totals[k].usedCost, 0) -
    inProgress.reduce((n, c) => n + c.fuelCost, 0);
  const expense = s.journal.entries
    .filter((e) =>
      [
        'staff',
        'maintenance',
        'transport',
        'transport-refund',
        'recruitment',
        'lease-penalty',
      ].includes(e.category),
    )
    .reduce((n, e) => n + e.cash, 0);
  const receipts = s.journal.entries
    .filter((e) => e.category === 'checkout')
    .reduce((n, e) => n + e.cash, 0);
  const receivables = s.customers
    .filter((c) => !c.paid)
    .reduce((n, c) => n + c.fuelBill, 0);
  if (
    s.journal.revenue !== revenue + leaseRevenue ||
    s.journal.profit !== revenue + leaseRevenue - cost + expense ||
    receipts !== fuelRevenue + goodsRevenue - receivables ||
    s.journal.entries
      .filter((e) => e.category === 'staff' || e.category === 'maintenance')
      .reduce((n, e) => n + e.cash, 0) !==
      -(s.development?.wageTotal ?? s.wagesUntil * 2) ||
    (!!s.pumps[2].construction || s.pumps[2].built) !==
      s.journal.cash.ids.includes('build-pump-2') ||
    (!dev &&
      s.topology !== Number(!!s.pumps[2].construction || s.pumps[2].built))
  )
    return fail();
  if (s.result === 'success' && (s.served < goal(s) || s.journal.profit <= 0))
    return fail();
  return s;
}
