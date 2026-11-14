import {
  RegionalNavigator,
  ScenarioClock,
  randomSample,
  rectCells,
  ownsAll,
  type Cell,
} from '../../engine/api/strategy';
import { SlotQueue } from '../../engine/api/mobility';
import {
  TransactionJournal,
  takeStock,
  addStock,
} from '../../engine/api/economy';
import {
  DURATION,
  GOAL,
  UNIT,
  PARCEL,
  PUMPS,
  PARKING,
  DOCK,
  CASH,
  GOODS,
  FUELS,
  prices,
  walkable,
  queuePoint,
  checkoutPoint,
  driverPort,
  type Fuel,
  type StationWorld,
} from './world';
import { motion, path, point, at, move, footprint } from './traffic';
import {
  createState,
  occupancyOf,
  bodies,
  validateState,
  emptyGoods,
} from './state';
import type { Customer, Worker, Motion, StationState } from './types';

export class StationModel {
  state: StationState;
  readonly clock = new ScenarioClock();
  readonly navigator: RegionalNavigator;
  occupancy: ReturnType<typeof occupancyOf>;
  private routeBudget = 2;
  constructor(
    readonly world: StationWorld,
    seed = world.scenario.seed,
  ) {
    this.state = createState(world, seed);
    this.navigator = new RegionalNavigator(world, (p) =>
      footprint(motion('probe', 'person', p)).every(walkable),
    );
    this.occupancy = occupancyOf(this.state);
    for (const x of [88, 48, 8]) this.spawn(x);
  }
  prepare(budget = 4) {
    return this.navigator.prepare(budget);
  }
  get journal() {
    return new TransactionJournal(this.state.journal);
  }
  get cash() {
    return this.state.journal.cash.balance;
  }
  get profit() {
    const s = this.state;
    return (
      s.journal.profit +
      s.customers
        .filter((c) => c.phase === 'fueling')
        .reduce((n, c) => n + c.fuelBill - c.fuelCost, 0) -
      (s.tick - s.wagesUntil) * 2
    );
  }
  get netWorth() {
    const s = this.state;
    return (
      this.cash -
      s.journal.cash.arrears +
      FUELS.reduce((n, k) => n + s.tanks[k].cost, 0) +
      GOODS.reduce(
        (n, k) =>
          n +
          s.goods[k].cost +
          s.workers.reduce((v, w) => v + w.cargo[k].cost, 0) +
          (s.delivery?.goods[k].cost ?? 0),
        0,
      ) +
      (s.delivery?.cargo.cost ?? 0) +
      s.customers.filter((c) => !c.paid).reduce((n, c) => n + c.fuelBill, 0) +
      600000 +
      (s.pumps[2].built ? 108000 : 0)
    );
  }
  private post(
    id: string,
    category: string,
    cash: number,
    profit = 0,
    revenue = 0,
    mandatory = false,
  ) {
    return this.journal.post(
      { id, category, cash, profit, revenue, tick: this.state.tick },
      mandatory,
    );
  }
  private fuelQueue() {
    return new SlotQueue(this.state.fuelQueue, 3);
  }
  private checkoutQueue() {
    return new SlotQueue(this.state.checkoutQueue, 5);
  }
  available(fuel: Fuel) {
    return (
      this.state.tanks[fuel].quantity -
      this.state.customers
        .filter((c) => c.fuel === fuel)
        .reduce((n, c) => n + c.reserved, 0)
    );
  }
  private tickets() {
    return this.state.customers.filter(
      (c) => (c.pump !== null || c.parking !== null) && !c.checked,
    ).length;
  }
  private walk(m: Motion, target: Cell) {
    if (at(m, target)) {
      m.route = [];
      return true;
    }
    if (this.routeBudget <= 0) return false;
    this.routeBudget--;
    const from = { x: Math.round(m.x / UNIT), y: Math.round(m.y / UNIT) };
    const route = this.navigator.findPath(from, target);
    if (!route) return false;
    path(m, [from, ...route]);
    return true;
  }
  private spawn(x = 4) {
    const s = this.state,
      candidate = s.candidate++;
    if (
      s.customers.length >= 14 ||
      s.customers.filter((c) => ['approaching', 'bypass'].includes(c.phase))
        .length >= 4
    ) {
      s.passed++;
      return;
    }
    const id = `c-${s.serial++}`,
      vehicle = motion(id, 'car', { x, y: 158 });
    if (!this.occupancy.tryClaim(id, footprint(vehicle))) {
      s.passed++;
      return;
    }
    const fuel =
      candidate === 0
        ? 'e95'
        : randomSample(s.seed, 0, candidate) < 0.2
          ? null
          : randomSample(s.seed, 1, candidate) < 0.6
            ? 'e95'
            : 'on';
    const basket = {
      drink: randomSample(s.seed, 2, candidate) < 0.6 ? 1 : 0,
      snack: randomSample(s.seed, 3, candidate) < 0.45 ? 1 : 0,
      coffee: randomSample(s.seed, 4, candidate) < 0.5 ? 1 : 0,
    };
    if (!fuel && !Object.values(basket).some(Boolean)) basket.coffee = 1;
    s.customers.push({
      id,
      serial: s.serial,
      vehicle,
      driver: null,
      phase: 'approaching',
      pedestrian: 'car',
      fuel,
      requested: fuel
        ? 200 + Math.floor(randomSample(s.seed, 5, candidate) * 201)
        : 0,
      reserved: 0,
      issued: 0,
      fuelCost: 0,
      fuelBill: 0,
      price: fuel ? prices[fuel].sell : 0,
      basket,
      budget: 32000 + Math.floor(randomSample(s.seed, 6, candidate) * 28000),
      pump: null,
      parking: null,
      patience: 1600 + Math.floor(randomSample(s.seed, 7, candidate) * 1200),
      admitted: -1,
      wait: 0,
      paid: false,
      checked: false,
      paidTotal: 0,
      bought: 0,
      abandoned: false,
      color: Math.floor(randomSample(s.seed, 8, candidate) * 4),
    });
    path(vehicle, [{ x: 96, y: 158 }]);
  }
  advance(ms: number) {
    this.clock.advance(ms, () => this.tick());
  }
  tick() {
    const s = this.state;
    if (s.result) return;
    s.tick++;
    this.routeBudget = 2;
    if (s.tick >= DURATION) {
      this.finish();
      return;
    }
    if (s.tick >= s.nextArrival && s.tick < DURATION - 600) {
      this.spawn();
      s.nextArrival += 200;
    }
    this.arriveDelivery();
    for (const m of bodies(s)) move(m, this.occupancy);
    for (const c of [...s.customers]) this.customer(c);
    for (const w of s.workers) this.worker(w);
    this.checkout();
    if (s.tick % 600 === 0) this.costs();
  }
  private customer(c: Customer) {
    const s = this.state,
      v = c.vehicle;
    if (c.admitted >= 0 && !c.paid) c.wait++;
    if (
      c.phase === 'leaving' &&
      c.admitted >= 0 &&
      c.paid &&
      v.x >= 148 * UNIT &&
      v.y === 158 * UNIT
    ) {
      this.recordVisit(c, c.paidTotal > 0);
      c.admitted = -1;
    }
    if (v.route.length || v.turn) return;
    if (c.phase === 'approaching') {
      if (
        s.tick >= DURATION - 600 ||
        s.customers.filter((a) => a.admitted >= 0 && a.phase !== 'leaving')
          .length >= 10 ||
        (c.fuel &&
          (!s.pumps.some((p) => p.open) ||
            this.available(c.fuel) < 100 ||
            s.fuelQueue.length >= 3))
      ) {
        c.phase = 'bypass';
        s.passed++;
        path(v, [{ x: 252, y: 158 }]);
        return;
      }
      if (!c.fuel) {
        const slot = PARKING.findIndex(
          (_, i) => !s.customers.some((a) => a.parking === i),
        );
        if (
          slot < 0 ||
          this.tickets() >= 5 ||
          !GOODS.some((k) => c.basket[k] && s.goods[k].quantity)
        ) {
          c.phase = 'bypass';
          s.passed++;
          path(v, [{ x: 252, y: 158 }]);
          return;
        }
        c.admitted = s.tick;
        c.parking = slot;
        c.phase = 'to-pump';
        path(v, [
          { x: 106, y: 158 },
          { x: 106, y: 150 },
          { x: PARKING[slot].x, y: 150 },
          PARKING[slot],
        ]);
      } else {
        c.admitted = s.tick;
        c.phase = 'queue';
        this.fuelQueue().join({ id: c.id, tick: s.tick, serial: c.serial });
        path(v, [{ x: 106, y: 158 }, queuePoint(s.fuelQueue.length - 1)]);
      }
      return;
    }
    if (c.phase === 'bypass' || c.phase === 'leaving') {
      if (c.admitted >= 0) this.recordVisit(c, c.paidTotal > 0 && !c.abandoned);
      this.occupancy.release(v.id);
      s.customers.splice(s.customers.indexOf(c), 1);
      return;
    }
    if (c.phase === 'queue') {
      if (c.wait > c.patience) {
        this.fuelQueue().leave(c.id);
        c.abandoned = true;
        c.phase = 'leaving';
        this.recordVisit(c, false);
        c.admitted = -1;
        path(v, [
          { x: 100, y: point(v).y },
          { x: 100, y: 158 },
          { x: 252, y: 158 },
        ]);
        return;
      }
      const index = s.fuelQueue.findIndex((e) => e.id === c.id),
        target = queuePoint(index);
      if (!at(v, target)) {
        path(v, [target]);
        return;
      }
      if (index !== 0 || this.tickets() >= 5) return;
      const pump = s.pumps.findIndex(
        (p) => p.built && p.open && p.customer === null,
      );
      if (pump < 0 || !c.fuel || this.available(c.fuel) < 100) return;
      c.reserved = Math.min(c.requested, this.available(c.fuel));
      c.pump = pump;
      s.pumps[pump].customer = c.id;
      this.fuelQueue().leave(c.id);
      c.phase = 'to-pump';
      path(v, [{ x: PUMPS[pump].x, y: 134 }, PUMPS[pump]]);
      return;
    }
    if (c.phase === 'to-pump') {
      c.phase = c.fuel ? 'preparing' : 'checkout';
      return;
    }
    if (c.phase === 'fueling' && c.fuel) {
      const amount = Math.min(1, c.reserved);
      if (amount) {
        const load = takeStock(s.tanks[c.fuel], amount);
        c.reserved -= amount;
        c.issued += amount;
        c.fuelCost += load.cost;
        s.totals[c.fuel].used += amount;
        s.totals[c.fuel].usedCost += load.cost;
        s.fuelSold += amount;
        c.fuelBill = Math.floor((c.issued * c.price + 5) / 10);
      }
      if (!c.reserved) this.closeFuel(c);
      return;
    }
    if (c.phase === 'checkout') {
      const site = c.pump !== null ? PUMPS[c.pump] : PARKING[c.parking!],
        port = driverPort(site);
      if (!c.driver) {
        const driver = motion(`driver-${c.id}`, 'person', port, 3);
        if (
          s.checkoutQueue.length >= 5 ||
          !this.occupancy.tryClaim(driver.id, footprint(driver))
        )
          return;
        c.driver = driver;
        c.pedestrian = 'walking';
        this.checkoutQueue().join({ id: c.id, tick: s.tick, serial: c.serial });
      }
      const m = c.driver;
      if (c.pedestrian === 'walking' || c.pedestrian === 'queued') {
        const target = checkoutPoint(
          s.checkoutQueue.findIndex((e) => e.id === c.id),
        );
        const end = m.route.at(-1);
        if (end && (end.x !== target.x || end.y !== target.y))
          this.walk(m, target);
      }
      if (m.route.length) return;
      if (c.pedestrian === 'returning') {
        if (!at(m, port)) {
          this.walk(m, port);
          return;
        }
        this.occupancy.release(m.id);
        c.driver = null;
        c.pedestrian = 'car';
        if (c.pump !== null) s.pumps[c.pump].customer = null;
        c.phase = 'leaving';
        path(v, [
          { x: site.x, y: c.pump !== null ? 118 : 138 },
          { x: 148, y: c.pump !== null ? 118 : 138 },
          { x: 148, y: 158 },
          { x: 252, y: 158 },
        ]);
        c.pump = null;
        c.parking = null;
        return;
      }
      if (c.pedestrian !== 'paying') {
        const index = s.checkoutQueue.findIndex((e) => e.id === c.id),
          target = checkoutPoint(index);
        if (at(m, target)) c.pedestrian = 'queued';
        else {
          c.pedestrian = 'walking';
          this.walk(m, target);
        }
      }
    }
  }
  private closeFuel(c: Customer) {
    if (
      !this.post(
        `issued-${c.id}`,
        'fuel-sale',
        0,
        c.fuelBill - c.fuelCost,
        c.fuelBill,
      )
    )
      throw Error('Stacja: powtórzona sprzedaż');
    c.reserved = 0;
    c.phase = 'checkout';
  }
  private worker(w: Worker) {
    const s = this.state,
      m = w.motion;
    if (m.route.length || m.turn) return;
    if (w.role === 'checkout') {
      const slot = s.workers.filter((a) => a.role === 'checkout').indexOf(w);
      const target = { x: 126 + slot * 2, y: 112 };
      if (!at(m, target)) this.walk(m, target);
      return;
    }
    if (!w.job) {
      const delivery = s.delivery;
      if (
        delivery?.phase === 'unloading' &&
        !delivery.cancelled &&
        !s.workers.some((a) => a.job?.id === delivery.id)
      )
        w.job = { kind: 'unload', id: delivery.id, progress: 0 };
      else {
        const c = s.customers.find(
          (c) =>
            c.phase === 'preparing' &&
            !s.workers.some((a) => a.job?.id === c.id),
        );
        if (c) w.job = { kind: 'prepare', id: c.id, progress: 0 };
        else if (
          s.pumps[2].construction &&
          !s.workers.some((a) => a.job?.kind === 'build')
        )
          w.job = { kind: 'build', id: 'pump-2', progress: 0 };
      }
    }
    const job = w.job;
    if (!job) {
      const home = { x: 110 + s.workers.indexOf(w) * 3, y: 120 };
      if (!at(m, home)) this.walk(m, home);
      return;
    }
    const customer = s.customers.find((c) => c.id === job.id);
    const target =
      job.kind === 'prepare'
        ? { x: PUMPS[customer!.pump!].x - 3, y: 122 }
        : job.kind === 'build'
          ? { x: 137, y: 122 }
          : job.kind === 'restock'
            ? { x: 131, y: 110 }
            : { x: 139, y: 110 };
    if (!at(m, target)) {
      this.walk(m, target);
      return;
    }
    job.progress++;
    if (job.kind === 'prepare') {
      if (job.progress >= 80) {
        customer!.phase = 'fueling';
        w.job = null;
      }
    } else if (job.kind === 'build') {
      s.pumps[2].construction--;
      if (!s.pumps[2].construction) {
        s.pumps[2].built = true;
        s.pumps[2].open = true;
        w.job = null;
      }
    } else if (job.kind === 'restock') {
      for (const k of GOODS) {
        addStock(s.goods[k], w.cargo[k]);
        w.cargo[k] = { quantity: 0, cost: 0 };
      }
      s.deliveries++;
      w.job = null;
    } else {
      const d = s.delivery!;
      if (d.fuel && d.cargo.quantity) {
        const load = takeStock(d.cargo, Math.min(10, d.cargo.quantity));
        addStock(s.tanks[d.fuel], load);
        d.received += load.quantity;
        d.receiptCost += load.cost;
        if (!d.cargo.quantity) {
          s.deliveries++;
          this.departDelivery();
          w.job = null;
        }
      } else if (!d.fuel && job.progress >= 40) {
        for (const k of GOODS) {
          w.cargo[k] = { ...d.goods[k] };
          d.received += d.goods[k].quantity;
          d.receiptCost += d.goods[k].cost;
          d.goods[k] = { quantity: 0, cost: 0 };
        }
        this.departDelivery();
        w.job = { kind: 'restock', id: d.id, progress: 0 };
      } else if (d.cancelled) {
        w.job = null;
        this.departDelivery();
      }
    }
  }
  private checkout() {
    const s = this.state;
    if (!s.checkout) {
      const id = this.checkoutQueue().head,
        c = s.customers.find((c) => c.id === id);
      const worker = s.workers.find(
        (w) =>
          w.role === 'checkout' &&
          !w.motion.route.length &&
          Math.abs(w.motion.x / UNIT - 126) <= 2 &&
          w.motion.y === 112 * UNIT,
      );
      if (
        !c ||
        c.pedestrian !== 'queued' ||
        !c.driver ||
        !worker ||
        !at(c.driver, checkoutPoint(0))
      )
        return;
      if (!this.walk(c.driver, CASH)) return;
      this.checkoutQueue().leave(c.id);
      c.pedestrian = 'paying';
      s.checkout = { customer: c.id, progress: 0, worker: worker.motion.id };
    }
    const checkout = s.checkout,
      c = s.customers.find((c) => c.id === checkout.customer)!;
    if (!c.driver || c.driver.route.length || !at(c.driver, CASH)) return;
    checkout.progress++;
    if (
      checkout.progress <
      120 + Object.values(c.basket).reduce((n, a) => n + a, 0) * 40
    )
      return;
    let total = c.fuelBill,
      cost = 0,
      articles = 0;
    for (const k of GOODS) {
      const count = Math.min(
        c.basket[k],
        s.goods[k].quantity,
        Math.floor((c.budget - total) / prices[k].sell),
      );
      if (!count) continue;
      const goods = takeStock(s.goods[k], count);
      total += count * prices[k].sell;
      cost += goods.cost;
      articles += count;
      s.totals[k].used += count;
      s.totals[k].usedCost += goods.cost;
    }
    this.post(
      `receipt-${c.id}`,
      'checkout',
      total,
      total - c.fuelBill - cost,
      total - c.fuelBill,
    );
    c.paid = true;
    c.checked = true;
    c.paidTotal = total;
    c.bought = articles;
    s.articles += articles;
    c.pedestrian = 'returning';
    s.checkout = null;
    // Return aisle avoids the incoming FIFO; people still reserve crossing cells.
    path(c.driver, [
      { x: 122, y: 112 },
      { x: 122, y: 130 },
    ]);
  }
  private recordVisit(c: Customer, served: boolean) {
    const s = this.state;
    s.visits++;
    if (served) s.served++;
    else s.lost++;
    if (!served) return;
    const wants = Object.values(c.basket).reduce((n, a) => n + a, 0);
    const needs =
      ((c.fuel ? c.issued / Math.max(1, c.requested) : 1) +
        (wants ? c.bought / wants : 1)) /
      2;
    s.satisfaction += Math.round(
      3000 * Math.max(0, 1 - c.wait / c.patience) + 2500 * needs + 4500,
    );
  }
  private costs() {
    const s = this.state;
    if (s.tick === s.wagesUntil) return;
    const wages =
      Math.floor((s.tick * 2000) / 1200) -
      Math.floor((s.wagesUntil * 2000) / 1200);
    const upkeep = (s.tick - s.wagesUntil) * 2 - wages;
    this.post(`wages-${s.tick}`, 'staff', -wages, -wages, 0, true);
    this.post(`upkeep-${s.tick}`, 'maintenance', -upkeep, -upkeep, 0, true);
    s.wagesUntil = s.tick;
  }
  private finish() {
    const s = this.state;
    for (const c of s.customers) {
      if (c.phase === 'fueling') this.closeFuel(c);
      if (c.admitted >= 0) this.recordVisit(c, false);
    }
    this.costs();
    s.result = s.served >= GOAL && this.profit > 0 ? 'success' : 'partial';
  }
  orderFuel(fuel: Fuel, litres: number) {
    const s = this.state;
    if (
      s.result ||
      !FUELS.includes(fuel) ||
      ![200, 400].includes(litres) ||
      s.delivery ||
      s.tanks[fuel].quantity + litres * 10 > 10000
    )
      return false;
    const cost = litres * prices[fuel].buy;
    if (this.cash < cost + 8000) return false;
    const id = `delivery-${s.serial++}`;
    if (!this.post(`order-${id}`, 'fuel-purchase', -cost)) return false;
    // Preflight includes the transport fee, so the complete order is affordable.
    this.post(`transport-${id}`, 'transport', -8000, -8000, 0, true);
    s.totals[fuel].ordered += litres * 10;
    s.totals[fuel].orderedCost += cost;
    s.delivery = {
      id,
      phase: 'ordered',
      due: s.tick + 600,
      motion: null,
      fuel,
      cargo: { quantity: litres * 10, cost },
      goods: emptyGoods(),
      total: litres * 10,
      received: 0,
      receiptCost: 0,
      cancelled: false,
    };
    return true;
  }
  orderGoods() {
    const s = this.state,
      count = GOODS.reduce(
        (n, k) =>
          n +
          s.goods[k].quantity +
          s.workers.reduce((v, w) => v + w.cargo[k].quantity, 0),
        0,
      );
    const cost = GOODS.reduce((n, k) => n + 10 * prices[k].buy, 0);
    if (s.result || s.delivery || count + 30 > 80 || this.cash < cost + 2000)
      return false;
    const id = `delivery-${s.serial++}`;
    this.post(`order-${id}`, 'shop-stock', -cost);
    this.post(`transport-${id}`, 'transport', -2000, -2000);
    const goods = emptyGoods();
    for (const k of GOODS) {
      goods[k] = { quantity: 10, cost: prices[k].buy * 10 };
      s.totals[k].ordered += 10;
      s.totals[k].orderedCost += goods[k].cost;
    }
    s.delivery = {
      id,
      phase: 'ordered',
      due: s.tick + 400,
      motion: null,
      fuel: null,
      cargo: { quantity: 0, cost: 0 },
      goods,
      total: 30,
      received: 0,
      receiptCost: 0,
      cancelled: false,
    };
    return true;
  }
  cancelDelivery(id: string) {
    const s = this.state,
      d = s.delivery;
    if (s.result || !d || d.id !== id || d.phase === 'departing' || d.cancelled)
      return false;
    let refund = 0;
    for (const k of [...FUELS, ...GOODS]) {
      const cargo =
        k === 'e95' || k === 'on'
          ? d.fuel === k
            ? d.cargo
            : null
          : d.goods[k];
      if (cargo) {
        refund += cargo.cost;
        s.totals[k].refunded += cargo.quantity;
        s.totals[k].refundCost += cargo.cost;
        cargo.quantity = 0;
        cargo.cost = 0;
      }
    }
    this.post(`refund-${id}`, 'refund', refund);
    d.cancelled = true;
    for (const w of s.workers)
      if (w.job?.id === id && w.job.kind === 'unload') w.job = null;
    if (d.phase === 'ordered') {
      const fee = d.fuel ? 8000 : 2000;
      this.post(`transport-refund-${id}`, 'transport-refund', fee, fee);
      s.delivery = null;
    } else if (d.phase === 'unloading') this.departDelivery();
    return true;
  }
  private arriveDelivery() {
    const s = this.state,
      d = s.delivery;
    if (!d) return;
    if (d.phase === 'ordered' && s.tick >= d.due) {
      const m = motion(d.id, 'truck', { x: 4, y: 158 });
      if (!this.occupancy.tryClaim(m.id, footprint(m))) return;
      d.motion = m;
      d.phase = 'travelling';
      path(m, [
        { x: 156, y: 158 },
        { x: 156, y: 100 },
        { x: 144, y: 100 },
        DOCK,
      ]);
    } else if (d.motion && !d.motion.route.length && !d.motion.turn) {
      if (d.phase === 'travelling') {
        d.phase = 'unloading';
        if (d.cancelled) this.departDelivery();
      } else if (d.phase === 'departing') {
        this.occupancy.release(d.id);
        s.delivery = null;
      }
    }
  }
  private departDelivery() {
    const d = this.state.delivery!;
    d.phase = 'departing';
    path(d.motion!, [
      { x: 144, y: 116 },
      { x: 156, y: 116 },
      { x: 156, y: 158 },
      { x: 252, y: 158 },
    ]);
  }
  setPump(index: number, open: boolean) {
    const p = this.state.pumps[index];
    if (this.state.result || !p?.built || typeof open !== 'boolean')
      return false;
    p.open = open;
    return true;
  }
  assignWorker(index: number, role: Worker['role']) {
    const w = this.state.workers[index];
    if (
      this.state.result ||
      !w ||
      !['forecourt', 'checkout'].includes(role) ||
      w.job ||
      this.state.checkout?.worker === w.motion.id
    )
      return false;
    w.role = role;
    w.motion.route = w.motion.route.slice(0, 1);
    return true;
  }
  previewPump() {
    const cells = rectCells({ x: 136, y: 120, width: 6, height: 9 }),
      s = this.state;
    const reason = s.result
      ? 'Zmiana zakończona'
      : s.pumps[2].built || s.pumps[2].construction
        ? 'Stanowisko istnieje'
        : this.cash < 180000
          ? 'Brak środków'
          : !ownsAll(cells, [PARCEL])
            ? 'Teren niewłasny'
            : !this.occupancy.available('construction', cells)
              ? 'Miejsce zajęte'
              : '';
    return {
      valid: !reason,
      reason,
      cost: 180000,
      revision: s.topology,
      cells,
    };
  }
  buildPump(revision: number) {
    const s = this.state,
      plan = this.previewPump();
    if (!plan.valid || revision !== plan.revision) return false;
    if (!this.post('build-pump-2', 'construction', -plan.cost)) return false;
    s.pumps[2].construction = 300;
    s.topology++;
    this.navigator.invalidate({ x: 136, y: 120, width: 6, height: 9 }, 1);
    return true;
  }
  snapshot(): StationState {
    return structuredClone({
      ...this.state,
      clock: { speed: this.clock.speed, remainder: this.clock.remainder },
    });
  }
  validateSave(raw: unknown) {
    return validateState(this.world, raw);
  }
  restore(raw: unknown) {
    const valid = this.validateSave(raw);
    this.state = valid;
    this.clock.speed = valid.clock.speed;
    this.clock.remainder = valid.clock.remainder;
    this.clock.paused = false;
    this.occupancy = occupancyOf(valid);
  }
}
