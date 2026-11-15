import { randomSample, rectCells } from '../../engine/api/strategy';
import type { StationModel } from './model';
import type { Customer } from './types';
import { FUELS, GOODS, prices, type Fuel, type Product } from './world';
import { extraPump, tankCapacity, parkingPoints } from './development';
import { siteBounds, StationTopology } from './placement';
import { bodies } from './state';
import { footprint } from './traffic';
import {
  EVENT_KINDS,
  LAST_ADMISSION,
  activeEvent,
  type WeekendEvent,
} from './campaign-data';

/** Weekend rules belong to the client. No wall clock, rendering or hidden rescue. */
export class Weekend {
  constructor(private readonly model: StationModel) {}
  private get s() {
    return this.model.state;
  }
  private get c() {
    return this.s.campaign!;
  }
  nextArrival() {
    const n = ++this.c.arrivalWindow;
    const base =
      n < 48
        ? n * 200
        : n < 138
          ? 9600 + (n - 48) * 160
          : 24000 + (n - 138) * 150;
    return base + Math.floor(randomSample(this.s.seed, 20, n) * 41) - 20;
  }
  wholesale(k: Fuel | Product, litres = 0) {
    let bps = activeEvent(this.s, 'wholesale') ? 12000 : 10000;
    if (
      litres >= 400 &&
      activeEvent(this.s, 'discount') &&
      this.c.event!.accepted
    )
      bps = 8500;
    return Math.round((prices[k].buy * bps) / 10000);
  }
  acceptDiscount() {
    if (
      this.s.result ||
      !activeEvent(this.s, 'discount') ||
      this.c.event!.accepted
    )
      return false;
    this.c.event!.accepted = true;
    return true;
  }
  vehicle(): 'bus' | 'truck' | null {
    const e = this.c.event;
    if (!e || this.s.tick < e.start || !e.remaining) return null;
    if (e.kind !== 'tourists' && e.kind !== 'trucks') return null;
    e.remaining--;
    return e.kind === 'tourists' ? 'bus' : 'truck';
  }
  tick() {
    const s = this.s,
      c = this.c;
    const event = c.event;
    if (event && s.tick === event.start && event.kind === 'fault') {
      const eligible = s.pumps
        .map((p, i) => (p.built && p.open ? i : -1))
        .filter((i) => i >= 0);
      if (eligible.length) {
        const pump =
          eligible[
            Math.floor(randomSample(s.seed, 22, event.id) * eligible.length)
          ];
        c.fault = { pump, since: s.tick, repair: false, progress: 0 };
      } else event.end = s.tick;
    }
    if (event && s.tick >= event.end) this.endEvent();
    if (s.tick >= c.nextEvent && s.tick < LAST_ADMISSION - 1800) {
      const index = c.eventIndex++;
      c.nextEvent += 1800 + Math.floor(randomSample(s.seed, 21, index) * 1201);
      if (!c.event && s.tick >= c.criticalEnd + 900) {
        // Rotated cycles give all six events without runs of repeated disasters.
        const kind =
          EVENT_KINDS[
            (index + Math.floor(randomSample(s.seed, 23, 0) * 6)) %
              EVENT_KINDS.length
          ];
        const start = s.tick + 400;
        c.event = {
          id: index,
          kind,
          announced: s.tick,
          start,
          end: start + (kind === 'fault' ? 1800 : kind === 'rain' ? 1200 : 900),
          remaining: kind === 'tourists' ? 1 : kind === 'trucks' ? 3 : 0,
          accepted: false,
        };
      }
    }
    if (s.tick % 20 === 0) {
      if (this.model.cash > 0 || this.canRecover()) c.warningSince = -1;
      else if (c.warningSince < 0) c.warningSince = s.tick;
      else if (s.tick - c.warningSince >= 2400) this.model.finish('bankrupt');
    }
  }
  private endEvent() {
    const c = this.c,
      e = c.event!;
    c.history.push({ ...e });
    if (e.kind === 'fault') {
      c.criticalEnd = this.s.tick;
      c.fault = null;
      for (const w of this.s.workers)
        if (w.job?.kind === 'repair') w.job = null;
    }
    c.event = null;
  }
  rescue() {
    const c = this.c;
    if (this.s.result || c.rescue.taken) return false;
    if (!this.model.post('weekend-rescue', 'loan', 150000)) return false;
    c.rescue.taken = true;
    c.warningSince = -1;
    return true;
  }
  repay() {
    const c = this.c;
    if (c.rescue.taken && !c.rescue.repaid) {
      this.model.post(
        'weekend-repayment',
        'loan-repayment',
        -150000,
        0,
        0,
        true,
      );
      this.model.post('weekend-loan-fee', 'loan-fee', -15000, -15000, 0, true);
      c.rescue.repaid = true;
    }
  }
  repair() {
    const fault = this.c.fault;
    if (this.s.result || !fault || fault.repair || this.model.cash < 12000)
      return false;
    if (!this.model.post(`repair-${fault.since}`, 'repair', -12000, -12000))
      return false;
    fault.repair = true;
    return true;
  }
  repaired() {
    if (!this.c.fault || !this.c.event) return;
    this.c.event.end = this.s.tick;
    this.endEvent();
  }
  interrupt(c: Customer) {
    if (c.journey) c.journey.interruptions |= 1;
  }
  canSell(id: string): string {
    const s = this.s,
      d = s.development!,
      site = d.sites.find((p) => p.id === id);
    if (s.result || !site) return 'Obiekt niedostępny';
    if (site.progress || s.workers.some((w) => w.job?.id === id))
      return 'Budowa w toku';
    if (
      site.kind === 'wash' &&
      (this.c.wash.queue.length || this.c.wash.customer)
    )
      return 'Myjnia w użyciu';
    const pump = s.pumps.findIndex((_, i) => extraPump(s, i)?.id === id);
    if (pump >= 0 && (s.pumps[pump].customer || this.c.fault?.pump === pump))
      return 'Stanowisko w użyciu';
    if (
      site.kind === 'tank' &&
      s.tanks[site.fuel].quantity +
        (s.delivery?.fuel === site.fuel ? s.delivery.cargo.quantity : 0) >
        tankCapacity(s, site.fuel) - 10000
    )
      return 'Zbiornik nie jest pusty';
    const cells = rectCells(siteBounds(site));
    if (
      bodies(s).some((m) =>
        footprint(m).some((p) => cells.some((q) => p.x === q.x && p.y === q.y)),
      )
    )
      return 'Miejsce zajęte';
    // Removing an island opens cells; roads remain. References are reindexed atomically below.
    return '';
  }
  sell(id: string) {
    if (this.canSell(id)) return false;
    const s = this.s,
      d = s.development!,
      site = d.sites.find((p) => p.id === id)!;
    const pump = s.pumps.findIndex((_, i) => extraPump(s, i)?.id === id);
    const parking =
      site.kind === 'parking'
        ? parkingPoints(s).findIndex(
            (p) => p.x === site.point.x && p.y === site.point.y,
          )
        : -1;
    if (parking >= 0 && s.customers.some((c) => c.parking === parking))
      return false;
    if (!this.model.post(`sell-${id}`, 'resale', Math.floor(site.cost * 0.6)))
      return false;
    d.sites.splice(d.sites.indexOf(site), 1);
    if (pump >= 0) {
      s.pumps.splice(pump, 1);
      s.pumps.forEach((p, i) => (p.id = `pump-${i}`));
      for (const c of s.customers)
        if (c.pump !== null && c.pump > pump) c.pump--;
      if (this.c.fault && this.c.fault.pump > pump) this.c.fault.pump--;
    }
    if (parking >= 0)
      for (const c of s.customers)
        if (c.parking !== null && c.parking > parking) c.parking--;
    s.topology++;
    this.model.topology = new StationTopology(s);
    this.model.navigator.invalidate(siteBounds(site), 5);
    return true;
  }
  private canRecover() {
    const s = this.s,
      c = this.c,
      d = s.development!;
    if (!c.rescue.taken || this.model.cash > 0) return true;
    if (
      s.delivery &&
      !s.delivery.cancelled &&
      (s.delivery.cargo.cost || GOODS.some((k) => s.delivery!.goods[k].cost))
    )
      return true;
    if (d.sites.some((p) => !this.canSell(p.id))) return true;
    if (
      s.customers.some(
        (a) =>
          a.admitted >= 0 && (a.fuelBill || a.paid || a.phase === 'washing'),
      )
    )
      return true;
    if (d.tenant.phase === 'leased') return true;
    // Reopening a pump or reassigning an employee is free and remains a feasible recovery.
    return (
      GOODS.some((k) => s.goods[k].quantity > 0) ||
      (FUELS.some((k) => this.model.available(k) >= 100) &&
        s.pumps.some((p) => p.built))
    );
  }
  get forecast(): WeekendEvent | null {
    return this.c.event;
  }
}
