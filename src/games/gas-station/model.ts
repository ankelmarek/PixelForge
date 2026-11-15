import { deliveryExit } from './traffic';
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
  UNIT,
  PARCEL,
  DOCK,
  CASH,
  GOODS,
  FUELS,
  prices,
  queuePoint,
  checkoutPoint,
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
import {
  createDevelopment,
  pumpPoints,
  parkingPoints,
  parkingReady,
  extraPump,
  duration,
  goal,
  tankCapacity,
  retail,
  PARCELS,
  ENTRY,
  EXIT,
  tenantPoint,
} from './development';
import {
  StationTopology,
  preview,
  port,
  servicePort,
  type BuildRequest,
} from './placement';
import { TenantLease } from './tenant-lease';
import { Weekend } from './campaign';
import {
  createCampaign,
  WEEKEND_BOUNDARIES,
  LAST_ADMISSION,
  pumpWorking,
  rating,
  washSite,
  activeEvent,
} from './campaign-data';
import { CarWash } from './car-wash';
import { netWorthOf } from './accounting';
import { createScenario, lit, type Variant } from './scenarios';

export class StationModel {
  state: StationState;
  readonly clock = new ScenarioClock();
  readonly navigator: RegionalNavigator;
  topology: StationTopology;
  readonly lease = new TenantLease(this);
  readonly weekend = new Weekend(this);
  readonly wash = new CarWash(this);
  occupancy: ReturnType<typeof occupancyOf>;
  private routeBudget = 2;
  constructor(
    readonly world: StationWorld,
    seed = world.scenario.seed,
    development = false,
    campaign = false,
    variant?: Variant,
  ) {
    this.state = createState(world, seed, campaign);
    if (development || campaign) {
      this.state.gameVersion = '0.2.0';
      this.state.development = createDevelopment();
      if (campaign) {
        this.state.gameVersion = '0.3.0';
        this.state.campaign = createCampaign();
        if (variant) {
          this.state.campaign.scenario = createScenario(variant);
          this.state.gameVersion = '0.4.0';
        }
        this.state.development.duration = 36000;
        this.state.development.boundaries = [...WEEKEND_BOUNDARIES];
      }
    }
    this.topology = new StationTopology(this.state);
    this.navigator = new RegionalNavigator(world, (p) =>
      footprint(motion('probe', 'person', p)).every(this.topology.pedestrian),
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
  get duration() {
    return duration(this.state);
  }
  get goal() {
    return goal(this.state);
  }
  get pumps() {
    return pumpPoints(this.state);
  }
  get parking() {
    return parkingPoints(this.state);
  }
  get profit() {
    const s = this.state;
    return (
      s.journal.profit +
      s.customers
        .filter((c) => c.phase === 'fueling')
        .reduce((n, c) => n + c.fuelBill - c.fuelCost, 0) -
      (s.development
        ? Math.floor((s.development.wages + s.development.wageRemainder) / 1200)
        : (s.tick - s.wagesUntil) * 2)
    );
  }
  get netWorth() {
    return netWorthOf(this.state);
  }
  post(
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
  walk(m: Motion, target: Cell) {
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
    const variant = s.campaign?.scenario?.variant;
    const special = s.campaign
      ? (this.weekend.vehicle() ??
        (variant === 'highway' &&
        candidate > 2 &&
        randomSample(s.seed, 25, candidate) < 0.035
          ? 'bus'
          : null))
      : null;
    const id = `c-${s.serial++}`,
      vehicle = motion(
        id,
        special
          ? 'truck'
          : s.development && candidate > 2
            ? randomSample(s.seed, 9, candidate) <
              (variant === 'highway' ? 0.28 : 0.18)
              ? 'truck'
              : randomSample(s.seed, 9, candidate) < 0.48
                ? 'van'
                : 'car'
            : 'car',
        { x, y: 158 },
      );
    if (!this.occupancy.tryClaim(id, footprint(vehicle))) {
      s.passed++;
      return;
    }
    const fuel =
      special === 'bus'
        ? null
        : vehicle.kind === 'truck' || vehicle.kind === 'van'
          ? 'on'
          : candidate === 0
            ? 'e95'
            : randomSample(s.seed, 0, candidate) < 0.2
              ? null
              : randomSample(s.seed, 1, candidate) < 0.6
                ? 'e95'
                : 'on';
    const basket = {
      drink: randomSample(s.seed, 2, candidate) < 0.6 ? 1 : 0,
      snack: randomSample(s.seed, 3, candidate) < 0.45 ? 1 : 0,
      coffee:
        randomSample(s.seed, 4, candidate) < (variant === 'night' ? 0.85 : 0.5)
          ? 1
          : 0,
    };
    if (!fuel && !Object.values(basket).some(Boolean)) basket.coffee = 1;
    if (special === 'bus') for (const k of GOODS) basket[k] = 3;
    s.customers.push({
      id,
      serial: s.serial,
      vehicle,
      driver: null,
      phase: 'approaching',
      pedestrian: 'car',
      fuel,
      requested: fuel
        ? (vehicle.kind === 'truck' ? 700 : 200) +
          Math.floor(randomSample(s.seed, 5, candidate) * 201)
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
      ...(s.campaign
        ? {
            journey: {
              fuel: false,
              goods: 0,
              wash: 'none' as const,
              price: 10000,
              interruptions: 0,
              comfort: 10000,
              bus: special === 'bus',
            },
          }
        : {}),
      ...(s.development
        ? {
            shopping: 'none' as const,
            tenantVisit: false,
            tenantBill: 0,
            goodsPrices: Object.fromEntries(
              GOODS.map((k) => [k, retail(s, k)]),
            ) as Record<(typeof GOODS)[number], number>,
          }
        : {}),
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
    if (s.development) {
      s.development.wages +=
        s.workers.length *
          (s.campaign?.scenario?.variant === 'night' ? 1250 : 1000) +
        400;
      this.lease.tick();
      if (s.campaign) this.weekend.tick();
      if (s.result) return;
    }
    if (s.tick >= this.duration) {
      this.finish();
      return;
    }
    if (s.tick >= s.nextArrival && s.tick < this.admissionEnd) {
      this.spawn();
      s.nextArrival = s.campaign
        ? this.weekend.nextArrival()
        : s.nextArrival + 200;
    }
    this.arriveDelivery();
    for (const m of bodies(s))
      move(
        m,
        this.occupancy,
        this.topology.legal,
        !!s.development,
        !!s.campaign &&
          m.y === 158 * UNIT &&
          (m.x < 92 * UNIT || m.x > 164 * UNIT),
      );
    for (const c of [...s.customers]) this.customer(c);
    for (const w of s.workers) this.worker(w);
    if (s.campaign) this.wash.tick();
    this.checkout();
    if (s.development?.secondCheckout) this.checkout(1);
    if (s.tick % 600 === 0) this.costs();
  }
  get admissionEnd() {
    return this.state.campaign ? LAST_ADMISSION : this.duration - 600;
  }
  private customer(c: Customer) {
    const s = this.state,
      v = c.vehicle;
    if (c.extension && at(v, EXIT) && c.phase === 'leaving')
      c.extension = false;
    if (
      c.admitted >= 0 &&
      (s.campaign
        ? c.phase === 'queue' ||
          c.phase === 'preparing' ||
          (c.phase === 'checkout' && c.pedestrian === 'queued') ||
          c.phase === 'wash-wait'
        : !c.paid)
    )
      c.wait++;
    if (s.campaign && this.wash.customer(c)) return;
    if (
      c.phase === 'leaving' &&
      c.admitted >= 0 &&
      c.paid &&
      v.x >= 148 * UNIT &&
      v.y === 158 * UNIT
    ) {
      this.recordVisit(
        c,
        c.paidTotal + (c.tenantBill ?? 0) > 0 &&
          !c.abandoned &&
          c.journey?.wash !== 'missed',
      );
      c.admitted = -1;
    }
    if (v.route.length || v.turn) return;
    if (c.phase === 'approaching') {
      if (
        s.tick >= this.admissionEnd ||
        s.customers.filter((a) => a.admitted >= 0 && a.phase !== 'leaving')
          .length >= 10 ||
        (c.fuel &&
          (!s.pumps.some((p, i) => p.open && pumpWorking(s, i)) ||
            this.available(c.fuel) < 100 ||
            s.fuelQueue.length >= 3))
      ) {
        c.phase = 'bypass';
        s.passed++;
        path(v, [{ x: 252, y: 158 }]);
        return;
      }
      if (s.development) {
        const d = s.development;
        c.price = c.fuel ? retail(s, c.fuel) : 0;
        if (c.fuel)
          c.requested = Math.min(
            c.requested,
            Math.floor(((c.budget - 3000) * 10) / c.price),
          );
        const premium = c.fuel ? (c.price - prices[c.fuel].sell) / 200 : 0;
        const chance = Math.max(
          0.1,
          Math.min(
            0.85,
            (s.campaign ? 0.6 : 0.72) -
              (lit(s) ? 0 : 0.1) -
              premium * 0.3 +
              (d.tenant.phase === 'leased' ? 0.1 : 0),
          ),
        );
        if (
          randomSample(s.seed, 10, c.serial) > chance ||
          (c.vehicle.kind === 'truck' && !c.journey?.bus && !this.admitHeavy(c))
        ) {
          c.phase = 'bypass';
          s.passed++;
          path(v, [{ x: 252, y: 158 }]);
          return;
        }
        c.shopping =
          d.tenant.phase === 'leased'
            ? 'tenant'
            : d.tenant.phase === 'owned'
              ? 'owned'
              : 'none';
        c.goodsPrices = Object.fromEntries(
          GOODS.map((k) => [k, retail(s, k)]),
        ) as Customer['goodsPrices'];
        if (c.journey) {
          const j = c.journey;
          j.fuel = !!c.fuel;
          const hasParking = this.parking.some(
            (_, i) =>
              parkingReady(s, i) && !s.customers.some((a) => a.parking === i),
          );
          const hasWalkway =
            this.topology.pedestrian({ x: 124, y: 114 }) &&
            this.topology.pedestrian({ x: 124, y: 112 });
          // Daytime lighting; the night scenario supplies its own light coverage.
          j.comfort = Math.round(
            (10000 *
              (Number(hasParking) + Number(hasWalkway) + Number(lit(s)))) /
              3,
          );
          j.goods =
            c.shopping === 'none'
              ? 0
              : GOODS.reduce(
                  (n, k) =>
                    n +
                    ((c.shopping === 'tenant'
                      ? d.tenant.stock[k]
                      : s.goods[k].quantity) > 0
                      ? c.basket[k]
                      : 0),
                  0,
                );
          const scores = [
            ...(c.fuel
              ? [
                  Math.max(
                    0,
                    Math.min(1, 1 - (c.price - prices[c.fuel].sell) / 300),
                  ),
                ]
              : []),
            ...GOODS.filter((k) => c.basket[k] && c.shopping !== 'none').map(
              (k) =>
                c.shopping === 'tenant'
                  ? 1
                  : Math.max(
                      0,
                      Math.min(
                        1,
                        1 - (c.goodsPrices![k] - prices[k].sell) / 300,
                      ),
                    ),
            ),
          ];
          j.price = Math.round(
            (10000 * scores.reduce((n, v) => n + v, 0)) /
              Math.max(1, scores.length),
          );
          if (
            v.kind !== 'truck' &&
            washSite(s) &&
            s.tick < this.duration - 4200 &&
            s.customers.filter(
              (a) => a.journey && ['wanted', 'queued'].includes(a.journey.wash),
            ).length < 2 &&
            randomSample(s.seed, 24, c.serial) <
              (activeEvent(s, 'rain') ? 0.05 : 0.25)
          ) {
            j.wash = 'wanted';
            if (c.fuel)
              c.requested = Math.min(
                c.requested,
                Math.floor(((c.budget - 5500) * 10) / c.price),
              );
          }
        }
        if (c.vehicle.kind === 'truck' && !c.journey?.bus) return;
      }
      if (!c.fuel) {
        const slot = this.parking.findIndex(
          (_, i) =>
            parkingReady(s, i) &&
            !s.customers.some((a) => a.parking === i) &&
            (i < 4 || !this.extensionBusy()),
        );
        if (
          (c.journey?.bus && this.extensionBusy()) ||
          slot < 0 ||
          this.tickets() >= 5 ||
          (s.development && c.shopping === 'none') ||
          !GOODS.some(
            (k) =>
              c.basket[k] &&
              (c.shopping === 'tenant'
                ? s.development!.tenant.stock[k]
                : s.goods[k].quantity),
          )
        ) {
          c.phase = 'bypass';
          s.passed++;
          path(v, [{ x: 252, y: 158 }]);
          return;
        }
        c.admitted = s.tick;
        if (s.development) c.tenantVisit = c.shopping === 'tenant';
        c.parking = slot;
        if (c.journey?.bus) c.extension = true;
        c.phase = 'to-pump';
        if (slot >= 4) this.driveExtension(c, this.parking[slot]);
        else
          path(v, [
            { x: 106, y: 158 },
            { x: 106, y: 150 },
            { x: this.parking[slot].x, y: 150 },
            this.parking[slot],
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
      if (c.admitted >= 0)
        this.recordVisit(
          c,
          c.paidTotal + (c.tenantBill ?? 0) > 0 &&
            !c.abandoned &&
            c.journey?.wash !== 'missed',
        );
      this.occupancy.release(v.id);
      s.customers.splice(s.customers.indexOf(c), 1);
      return;
    }
    if (c.phase === 'queue') {
      if (c.wait > c.patience && !this.heavyEntering()) {
        this.fuelQueue().leave(c.id);
        c.abandoned = true;
        c.phase = 'leaving';
        this.recordVisit(c, false);
        c.admitted = -1;
        path(v, [
          { x: s.development ? 102 : 100, y: point(v).y },
          { x: s.development ? 102 : 100, y: 158 },
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
        (p, i) =>
          p.built &&
          p.open &&
          pumpWorking(s, i) &&
          p.customer === null &&
          (i < 3 ||
            (!this.extensionBusy(c.id) &&
              extraPump(s, i)?.kind !== 'heavy-pump')),
      );
      if (pump < 0 || !c.fuel || this.available(c.fuel) < 100) return;
      c.reserved = Math.min(c.requested, this.available(c.fuel));
      c.pump = pump;
      s.pumps[pump].customer = c.id;
      this.fuelQueue().leave(c.id);
      c.phase = 'to-pump';
      if (pump >= 3) this.driveExtension(c, this.pumps[pump]);
      else path(v, [{ x: this.pumps[pump].x, y: 134 }, this.pumps[pump]]);
      return;
    }
    if (c.phase === 'to-pump' || c.phase === 'to-shop') {
      c.phase = c.fuel && !c.tenantVisit ? 'preparing' : 'checkout';
      return;
    }
    if (c.phase === 'fueling' && c.fuel) {
      if (!pumpWorking(s, c.pump!)) {
        this.weekend.interrupt(c);
        return;
      }
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
      const site =
          c.pump !== null ? this.pumps[c.pump] : this.parking[c.parking!],
        door = port(
          site,
          v.kind,
          c.pump !== null ? extraPump(s, c.pump) : undefined,
        ),
        queue = c.tenantVisit ? s.development!.tenant.queue : s.checkoutQueue,
        queueAt = c.tenantVisit ? tenantPoint : checkoutPoint;
      if (!c.driver) {
        const driver = motion(`driver-${c.id}`, 'person', door, 3);
        if (
          queue.length >= 5 ||
          !this.occupancy.tryClaim(driver.id, footprint(driver))
        )
          return;
        c.driver = driver;
        c.pedestrian = 'walking';
        new SlotQueue(queue, 5).join({
          id: c.id,
          tick: s.tick,
          serial: c.serial,
        });
      }
      const m = c.driver;
      if (c.pedestrian === 'walking' || c.pedestrian === 'queued') {
        const target = queueAt(queue.findIndex((e) => e.id === c.id));
        const end = m.route.at(-1);
        if (end && (end.x !== target.x || end.y !== target.y))
          this.walk(m, target);
      }
      if (m.route.length) return;
      if (c.pedestrian === 'returning') {
        if (!at(m, door)) {
          this.walk(m, door);
          return;
        }
        this.occupancy.release(m.id);
        c.driver = null;
        c.pedestrian = 'car';
        if (c.pump !== null) s.pumps[c.pump].customer = null;
        if (
          c.shopping === 'tenant' &&
          !c.tenantVisit &&
          !c.extension &&
          !this.heavyEntering() &&
          s.development?.tenant.phase === 'leased'
        ) {
          const parking = this.parking.findIndex(
            (_, i) => i < 4 && !s.customers.some((a) => a.parking === i),
          );
          if (parking >= 0 && c.vehicle.kind !== 'truck') {
            c.pump = null;
            c.parking = parking;
            c.tenantVisit = true;
            c.checked = false;
            c.phase = 'to-shop';
            path(v, [
              { x: site.x, y: 118 },
              { x: 148, y: 118 },
              { x: 148, y: 164 },
              { x: 98, y: 164 },
              { x: 98, y: 150 },
              { x: 106, y: 150 },
              { x: this.parking[parking].x, y: 150 },
              this.parking[parking],
            ]);
            return;
          }
        }
        if (s.campaign && this.wash.join(c, site)) return;
        c.phase = 'leaving';
        if ((c.pump ?? -1) >= 3 || (c.parking ?? -1) >= 4) {
          const route = this.topology.route(site, EXIT, v.kind);
          if (!route) throw Error('Stacja: utracony wyjazd');
          path(v, [...route, { x: 148, y: 158 }, { x: 252, y: 158 }]);
        } else
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
        const index = queue.findIndex((e) => e.id === c.id),
          target = queueAt(index);
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
    if (this.state.development)
      this.state.development.fuelRevenue += c.fuelBill;
    c.phase = 'checkout';
  }
  private worker(w: Worker) {
    const s = this.state,
      m = w.motion;
    if (m.route.length || m.turn) return;
    if (w.role === 'checkout') {
      const slot = s.workers.filter((a) => a.role === 'checkout').indexOf(w);
      const target = { x: 126 + slot * (s.development ? 4 : 2), y: 112 };
      if (!at(m, target)) this.walk(m, target);
      return;
    }
    if (
      !w.job &&
      s.campaign?.fault?.repair &&
      !s.workers.some((a) => a.job?.kind === 'repair')
    )
      w.job = {
        kind: 'repair',
        id: `repair-${s.campaign.fault.since}`,
        progress: 0,
      };
    if (!w.job) {
      const delivery = s.delivery;
      if (
        delivery?.phase === 'unloading' &&
        !delivery.cancelled &&
        !s.workers.some((a) => a.job?.id === delivery.id) &&
        (s.development?.priority !== 'customers' ||
          !s.customers.some((c) => c.phase === 'preparing'))
      )
        w.job = { kind: 'unload', id: delivery.id, progress: 0 };
      else {
        const c = s.customers.find(
          (c) =>
            c.phase === 'preparing' &&
            pumpWorking(s, c.pump!) &&
            !s.workers.some((a) => a.job?.id === c.id),
        );
        if (c) w.job = { kind: 'prepare', id: c.id, progress: 0 };
        else if (
          s.development?.sites.some(
            (p) => p.progress && !s.workers.some((a) => a.job?.id === p.id),
          )
        ) {
          const site = s.development.sites.find(
            (p) => p.progress && !s.workers.some((a) => a.job?.id === p.id),
          )!;
          w.job = { kind: 'build', id: site.id, progress: 0 };
        } else if (
          s.pumps[2].construction &&
          !s.workers.some((a) => a.job?.kind === 'build')
        )
          w.job = { kind: 'build', id: 'pump-2', progress: 0 };
      }
    }
    const job = w.job;
    if (!job) {
      const home = s.development
        ? { x: 109, y: 108 + s.workers.indexOf(w) * 3 }
        : { x: 110 + s.workers.indexOf(w) * 3, y: 120 };
      if (!at(m, home)) this.walk(m, home);
      return;
    }
    const customer = s.customers.find((c) => c.id === job.id);
    const extension = s.development?.sites.find((p) => p.id === job.id),
      pump =
        customer?.pump !== null && customer?.pump !== undefined
          ? extraPump(s, customer.pump)
          : undefined;
    const fault = s.campaign?.fault;
    const repairSite = fault ? extraPump(s, fault.pump) : undefined;
    const target =
      job.kind === 'repair' && fault
        ? repairSite
          ? servicePort(repairSite)
          : { x: this.pumps[fault.pump].x - 3, y: 122 }
        : extension
          ? servicePort(extension)
          : job.kind === 'prepare'
            ? pump
              ? servicePort(pump)
              : { x: this.pumps[customer!.pump!].x - 3, y: 122 }
            : job.kind === 'build'
              ? { x: 137, y: 122 }
              : job.kind === 'restock'
                ? { x: 131, y: 110 }
                : { x: 139, y: 110 };
    if (!at(m, target)) {
      this.walk(m, target);
      return;
    }
    if (job.kind === 'prepare' && !pumpWorking(s, customer!.pump!)) {
      this.weekend.interrupt(customer!);
      return;
    }
    job.progress++;
    if (job.kind === 'repair') {
      if (!fault) {
        w.job = null;
        return;
      }
      fault.progress++;
      if (fault.progress >= 300) this.weekend.repaired();
    } else if (job.kind === 'prepare') {
      if (job.progress >= 80) {
        customer!.phase = 'fueling';
        w.job = null;
      }
    } else if (job.kind === 'build') {
      if (extension) {
        extension.progress--;
        if (!extension.progress) {
          const index =
            s
              .development!.sites.filter(
                (p) => p.kind === 'pump' || p.kind === 'heavy-pump',
              )
              .indexOf(extension) + 3;
          if (extension.kind === 'pump' || extension.kind === 'heavy-pump') {
            s.pumps[index].built = true;
            s.pumps[index].open = true;
          }
          w.job = null;
        }
        return;
      }
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
  private checkout(lane = 0) {
    const s = this.state;
    const active = () => (lane ? s.development!.checkout : s.checkout);
    const set = (value: StationState['checkout']) => {
      if (lane) s.development!.checkout = value;
      else s.checkout = value;
    };
    const cash = { x: CASH.x + lane * 4, y: CASH.y };
    if (!active()) {
      const id = this.checkoutQueue().head,
        c = s.customers.find((c) => c.id === id);
      const worker = s.workers.find(
        (w) =>
          w.role === 'checkout' &&
          !w.motion.route.length &&
          (s.development
            ? w.motion.x === (126 + lane * 4) * UNIT
            : Math.abs(w.motion.x / UNIT - 126) <= 2) &&
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
      if (!this.walk(c.driver, cash)) return;
      this.checkoutQueue().leave(c.id);
      c.pedestrian = 'paying';
      c.checkoutLane = lane;
      set({ customer: c.id, progress: 0, worker: worker.motion.id });
    }
    const checkout = active()!,
      c = s.customers.find((c) => c.id === checkout.customer)!;
    if (!c.driver || c.driver.route.length || !at(c.driver, cash)) return;
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
      if (s.development && c.shopping !== 'owned') continue;
      const price = c.goodsPrices?.[k] ?? prices[k].sell;
      const count = Math.min(
        c.basket[k],
        s.goods[k].quantity,
        Math.max(
          0,
          Math.floor(
            (c.budget - total - (c.journey?.wash === 'wanted' ? 2500 : 0)) /
              price,
          ),
        ),
      );
      if (!count) continue;
      const goods = takeStock(s.goods[k], count);
      total += count * price;
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
    if (s.development) s.development.goodsRevenue += total - c.fuelBill;
    c.pedestrian = 'returning';
    set(null);
    // Return aisle avoids the incoming FIFO; people still reserve crossing cells.
    path(c.driver, [
      { x: 122, y: 112 },
      { x: 122, y: 130 },
    ]);
  }
  private recordVisit(c: Customer, served: boolean) {
    const s = this.state;
    if (s.campaign) {
      if (s.campaign.ratings.some((r) => r.id === c.id)) return;
      const entry = rating(s, c, served);
      s.campaign.ratings.push(entry);
      s.satisfaction += entry.score;
    }
    s.visits++;
    if (served) s.served++;
    else s.lost++;
    if (!served || s.campaign) return;
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
    const scenario = s.campaign?.scenario;
    if (scenario) {
      const total = Math.floor((scenario.energyTicks * 2000) / 1200);
      const cost = total - scenario.energyCharged;
      if (cost)
        this.post(`lighting-${s.tick}`, 'lighting', -cost, -cost, 0, true);
      scenario.energyCharged = total;
    }
    if (s.development) {
      const d = s.development;
      const cost = Math.floor((d.wages + d.wageRemainder) / 1200);
      d.wageRemainder = (d.wages + d.wageRemainder) % 1200;
      d.wages = 0;
      d.wageTotal += cost;
      this.post(`wages-${s.tick}`, 'staff', -cost, -cost, 0, true);
      s.wagesUntil = s.tick;
      return;
    }
    const wages =
      Math.floor((s.tick * 2000) / 1200) -
      Math.floor((s.wagesUntil * 2000) / 1200);
    const upkeep = (s.tick - s.wagesUntil) * 2 - wages;
    this.post(`wages-${s.tick}`, 'staff', -wages, -wages, 0, true);
    this.post(`upkeep-${s.tick}`, 'maintenance', -upkeep, -upkeep, 0, true);
    s.wagesUntil = s.tick;
  }
  finish(outcome?: 'bankrupt') {
    const s = this.state;
    for (const c of s.customers) {
      if (c.phase === 'fueling') this.closeFuel(c);
      if (c.admitted >= 0) this.recordVisit(c, false);
    }
    this.costs();
    if (s.campaign) this.weekend.repay();
    s.result =
      outcome ??
      (s.served >= this.goal &&
      (s.campaign
        ? s.visits > 0 && s.satisfaction / s.visits >= 7000 && this.netWorth > 0
        : this.profit > 0)
        ? 'success'
        : 'partial');
  }
  fuelQuote(fuel: Fuel, litres: number) {
    return (
      litres *
        (this.state.campaign
          ? this.weekend.wholesale(fuel, litres)
          : prices[fuel].buy) +
      8000
    );
  }
  orderFuel(fuel: Fuel, litres: number) {
    const s = this.state;
    if (
      s.result ||
      !FUELS.includes(fuel) ||
      ![200, 400].includes(litres) ||
      s.delivery ||
      s.tanks[fuel].quantity + litres * 10 > tankCapacity(s, fuel)
    )
      return false;
    const cost = this.fuelQuote(fuel, litres) - 8000;
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
    if (s.campaign && litres >= 400 && activeEvent(s, 'discount'))
      s.campaign.event!.end = s.tick;
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
    if (
      s.result ||
      s.delivery ||
      (s.development && s.development.tenant.phase !== 'owned') ||
      count + 30 > 80 ||
      this.cash < cost + 2000
    )
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
      if (s.development?.tenant.delivery?.motion || this.extensionBusy())
        return;
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
    deliveryExit(d.motion!, !!this.state.campaign);
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
      (this.state.development &&
        role === 'checkout' &&
        this.state.workers.filter((a) => a !== w && a.role === 'checkout')
          .length >= (this.state.development.secondCheckout ? 2 : 1)) ||
      w.job ||
      this.state.checkout?.worker === w.motion.id ||
      this.state.development?.checkout?.worker === w.motion.id
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
  extensionBusy(except = '') {
    return (
      !!this.state.development &&
      (this.state.customers.some((c) => c.id !== except && c.extension) ||
        !!this.state.delivery?.motion ||
        !!this.state.development.tenant.delivery?.motion)
    );
  }
  private driveExtension(c: Customer, destination: Cell) {
    const truckEntry = { x: 100, y: 134 };
    const entry =
      c.vehicle.kind === 'truck' &&
      this.topology.route(truckEntry, destination, 'truck')
        ? truckEntry
        : ENTRY;
    const route = this.topology.route(entry, destination, c.vehicle.kind);
    if (!route) throw Error('Stacja: brak trasy do stanowiska');
    c.extension = true;
    const p = point(c.vehicle);
    path(c.vehicle, [
      ...(p.y === 158 ? [{ x: entry.x, y: 158 }] : []),
      entry,
      ...route,
    ]);
  }
  private admitHeavy(c: Customer) {
    const s = this.state;
    if (
      this.extensionBusy() ||
      this.tickets() >= 5 ||
      s.customers.some(
        (a) =>
          (a.abandoned && a.vehicle.y < 158 * UNIT) || a.phase === 'to-shop',
      )
    )
      return false;
    const index = s.pumps.findIndex(
      (p, i) =>
        p.built &&
        p.open &&
        pumpWorking(s, i) &&
        !p.customer &&
        extraPump(s, i)?.kind === 'heavy-pump',
    );
    if (index < 0 || !c.fuel || this.available(c.fuel) < 100) return false;
    if (
      s.fuelQueue.length &&
      !this.topology.route({ x: 100, y: 134 }, this.pumps[index], 'truck')
    )
      return false;
    c.pump = index;
    c.admitted = s.tick;
    c.reserved = Math.min(c.requested, this.available(c.fuel));
    s.pumps[index].customer = c.id;
    c.phase = 'to-pump';
    this.driveExtension(c, this.pumps[index]);
    return true;
  }
  private heavyEntering() {
    return this.state.customers.some(
      (c) =>
        c.extension &&
        ((c.vehicle.kind === 'truck' && c.phase === 'to-pump') ||
          c.phase === 'to-wash') &&
        c.vehicle.x >= 96 * UNIT,
    );
  }
  setPrice(product: keyof typeof prices, price: number) {
    const s = this.state,
      d = s.development;
    if (
      !d ||
      s.result ||
      !(product in prices) ||
      !Number.isSafeInteger(price) ||
      price < prices[product].buy + 50 ||
      price > prices[product].sell + 300 ||
      price % 10 ||
      (GOODS.includes(product as (typeof GOODS)[number]) &&
        d.tenant.phase !== 'owned')
    )
      return false;
    d.prices[product] = price;
    return true;
  }
  hire() {
    const s = this.state;
    if (
      !s.development ||
      s.result ||
      s.workers.length >= 4 ||
      this.cash < 10000
    )
      return false;
    const m = motion(`worker-${s.workers.length + 1}`, 'person', {
      x: 109,
      y: 108 + s.workers.length * 3,
    });
    if (!this.occupancy.available(m.id, footprint(m))) return false;
    this.costs();
    this.post(`hire-${m.id}`, 'recruitment', -10000, -10000);
    this.occupancy.tryClaim(m.id, footprint(m));
    s.workers.push({
      motion: m,
      role: 'forecourt',
      job: null,
      cargo: emptyGoods(),
    });
    return true;
  }
  secondCheckout() {
    const s = this.state,
      d = s.development;
    if (!d || s.result || d.secondCheckout || this.cash < 90000) return false;
    this.post('second-checkout', 'construction', -90000);
    d.constructionSpent += 90000;
    d.secondCheckout = true;
    return true;
  }
  setPriority(priority: 'customers' | 'deliveries') {
    if (
      !this.state.development ||
      this.state.result ||
      !['customers', 'deliveries'].includes(priority)
    )
      return false;
    this.state.development.priority = priority;
    return true;
  }
  buyParcel(id: string) {
    const s = this.state,
      d = s.development,
      p = PARCELS.find((p) => p.id === id);
    if (!d || s.result || !p || d.parcels.includes(id) || this.cash < p.price)
      return false;
    this.post(`parcel-${id}`, 'construction', -p.price);
    d.constructionSpent += p.price;
    d.parcels.push(id);
    s.topology++;
    this.topology = new StationTopology(s);
    this.navigator.invalidate(p, 5);
    return true;
  }
  previewBuild(request: BuildRequest) {
    return preview(this.state, request, this.cash, bodies(this.state));
  }
  build(request: BuildRequest, revision: number) {
    const s = this.state,
      d = s.development,
      plan = this.previewBuild(request);
    if (!d || !plan.valid || revision !== s.topology) return false;
    const id = `site-${s.serial++}`;
    if (plan.cost) this.post(`build-${id}`, 'construction', -plan.cost);
    d.constructionSpent += plan.cost;
    if (request.kind === 'road')
      d.roads.push({
        id: `road-${s.serial - 1}`,
        from: { ...request.point },
        to: { ...request.to! },
        cost: plan.cost,
      });
    else if (request.kind === 'remove-road')
      d.roads = d.roads.filter((r) => r.id !== request.roadId);
    else {
      d.sites.push({
        id,
        kind: request.kind,
        point: { ...request.point },
        rotation: request.rotation,
        fuel: request.fuel,
        cost: plan.cost,
        progress: 300,
      });
      if (request.kind === 'pump' || request.kind === 'heavy-pump')
        s.pumps.push({
          id: `pump-${s.pumps.length}`,
          built: false,
          open: false,
          construction: 0,
          customer: null,
        });
    }
    s.topology++;
    this.topology = new StationTopology(s);
    this.navigator.invalidate(plan.bounds, 5);
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
    // v3 snapshots may still contain the old crossing through the pump exit.
    // Reverse in the existing service bay, then use the northern lane; never teleport.
    if (valid.campaign)
      for (const m of [
        valid.delivery?.motion,
        valid.development?.tenant.delivery?.motion,
      ]) {
        if (
          m &&
          m.x === 144 * UNIT &&
          m.y >= 110 * UNIT &&
          m.y <= 116 * UNIT &&
          m.route[0]?.x === 144 &&
          m.route[0]?.y === 116
        )
          deliveryExit(m, true);
      }
    this.state = valid;
    this.topology = new StationTopology(valid);
    this.navigator.invalidate({ x: 40, y: 48, width: 176, height: 112 }, 5);
    this.clock.speed = valid.clock.speed;
    this.clock.remainder = valid.clock.remainder;
    this.clock.paused = false;
    this.occupancy = occupancyOf(valid);
  }
}
