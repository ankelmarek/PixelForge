import { SlotQueue } from '../../engine/api/mobility';
import { GOODS, prices, DOCK } from './world';
import { TENANT_CASH, tenantPoint, type Tenant } from './development';
import { motion, footprint, path, at } from './traffic';
import type { StationModel } from './model';
import type { Customer } from './types';

/** Tenant stock, staff and turnover never enter the owner's inventory or sales. */
export class TenantLease {
  constructor(private model: StationModel) {}
  get state() {
    return this.model.state.development!.tenant;
  }
  get turnover() {
    return this.state.sales.reduce((n, e) => n + e.total, 0);
  }
  offer() {
    const s = this.model.state,
      d = s.development,
      t = d?.tenant;
    return (
      !!d &&
      !s.result &&
      s.tick >= d.boundaries[0] &&
      s.tick < d.boundaries[1] &&
      t?.phase === 'owned' &&
      !t.everSigned &&
      this.model.parking.length >= 4 &&
      s.workers.length <= 4
    );
  }
  sign(type: 'fixed' | 'share') {
    if (!['fixed', 'share'].includes(type) || !this.offer()) return false;
    const s = this.model.state,
      t = this.state;
    t.contract = {
      id: `lease-${s.serial++}`,
      type,
      signed: s.tick,
      active: -1,
      end: -1,
      terminate: false,
      rent: type === 'fixed' ? 12000 : 5000,
      share: type === 'share' ? 800 : 0,
    };
    t.phase = 'closing';
    t.since = s.tick;
    return true;
  }
  termination() {
    const t = this.state;
    if (this.model.state.result || t.phase !== 'leased' || !t.contract)
      return false;
    t.contract.terminate = !t.contract.terminate;
    return true;
  }
  tick() {
    const s = this.model.state,
      d = s.development;
    if (!d) return;
    const t = d.tenant;
    if (t.phase === 'closing') {
      const pending = s.customers.some(
        (c) => c.shopping === 'owned' && !c.checked && c.admitted >= 0,
      );
      if (!pending) {
        t.phase = 'refitting';
        t.since = s.tick;
      } else if (s.tick - t.since >= 1200) {
        t.phase = 'owned';
        t.contract = null;
      }
    }
    if (t.phase === 'refitting' && s.tick - t.since >= 400) {
      const staff = [
        motion('tenant-cashier', 'person', { x: 115, y: 110 }),
        motion('tenant-stocker', 'person', { x: 131, y: 108 }),
      ];
      if (
        staff.every((m) => this.model.occupancy.available(m.id, footprint(m)))
      ) {
        for (const m of staff)
          this.model.occupancy.tryClaim(m.id, footprint(m));
        t.staff = staff;
        t.phase = 'leased';
        t.since = s.tick;
        t.contract!.active = s.tick;
        t.everSigned = true;
      }
    }
    if (t.phase === 'leased' || t.phase === 'returning') {
      this.checkout();
      this.deliver();
      if (
        t.phase === 'returning' &&
        !t.delivery &&
        !s.customers.some((c) => c.tenantVisit && (!c.checked || c.driver))
      ) {
        for (const m of t.staff) this.model.occupancy.release(m.id);
        t.staff = [];
        t.phase = 'restoring';
        t.since = s.tick;
      }
    }
    if (t.phase === 'restoring' && s.tick - t.since >= 400) {
      t.phase = 'owned';
      t.since = s.tick;
    }
    const shift = d.boundaries.indexOf(s.tick);
    if (shift >= 0) {
      this.settle(shift);
      if (
        t.contract?.terminate &&
        t.phase === 'leased' &&
        s.tick < d.duration &&
        this.model.cash >= 10000
      ) {
        this.model.post(
          `lease-end-${t.contract.id}`,
          'lease-penalty',
          -10000,
          -10000,
        );
        t.contract.end = s.tick;
        t.phase = 'returning';
        t.since = s.tick;
      }
    }
  }
  settle(shift: number) {
    const s = this.model.state,
      d = s.development!,
      t = d.tenant,
      c = t.contract;
    if (!c || c.active < 0) return;
    const id = `lease-${c.id}-${shift}`;
    if (t.settlements.some((e) => e.id === id)) return;
    const start = shift ? d.boundaries[shift - 1] : 0,
      end = d.boundaries[shift];
    const ticks = Math.max(
      0,
      Math.min(s.tick, end, c.end < 0 ? end : c.end) -
        Math.max(start, c.active),
    );
    const turnover = t.sales
      .filter((e) => e.tick >= start && e.tick < end)
      .reduce((n, e) => n + e.total, 0);
    const rent = Math.floor((c.rent * ticks) / (end - start)),
      share = Math.floor((turnover * c.share) / 10000);
    this.model.post(`${id}-rent`, 'tenant-rent', rent, rent, rent);
    this.model.post(`${id}-share`, 'tenant-share', share, share, share);
    t.settlements.push({ id, shift, ticks, turnover, rent, share });
  }
  private checkout() {
    const s = this.model.state,
      t = this.state;
    if (!t.checkout) {
      const c = s.customers.find((c) => c.id === t.queue[0]?.id);
      if (
        !c?.driver ||
        c.pedestrian !== 'queued' ||
        !at(c.driver, tenantPoint(0)) ||
        !this.model.walk(c.driver, TENANT_CASH)
      )
        return;
      new SlotQueue(t.queue, 5).leave(c.id);
      c.pedestrian = 'paying';
      t.checkout = { customer: c.id, progress: 0 };
    }
    const c = s.customers.find((c) => c.id === t.checkout!.customer)!;
    if (!c.driver || c.driver.route.length || !at(c.driver, TENANT_CASH))
      return;
    if (
      ++t.checkout.progress <
      100 + 40 * Object.values(c.basket).reduce((n, a) => n + a, 0)
    )
      return;
    let total = 0;
    const items = { drink: 0, snack: 0, coffee: 0 };
    for (const k of GOODS) {
      const count = Math.min(
        c.basket[k],
        t.stock[k],
        Math.max(
          0,
          Math.floor(
            (c.budget -
              c.paidTotal -
              total -
              (c.journey?.wash === 'wanted' ? 2500 : 0)) /
              prices[k].sell,
          ),
        ),
      );
      items[k] = count;
      t.stock[k] -= count;
      total += count * prices[k].sell;
      c.bought += count;
    }
    t.sales.push({ id: `tenant-${c.id}`, tick: s.tick, total, items });
    c.tenantBill = total;
    c.paid = true;
    c.checked = true;
    c.pedestrian = 'returning';
    t.checkout = null;
    path(c.driver, [
      { x: 122, y: 110 },
      { x: 122, y: 130 },
    ]);
  }
  private deliver() {
    const s = this.model.state,
      t = this.state;
    if (
      !t.delivery &&
      t.phase === 'leased' &&
      GOODS.some((k) => t.stock[k] < 5) &&
      s.tick < this.model.duration - 1400
    ) {
      t.delivery = {
        id: `tenant-delivery-${s.serial++}`,
        motion: null,
        phase: 'ordered',
        progress: 0,
        due: s.tick + 200,
      };
    }
    const d = t.delivery;
    if (!d) return;
    if (d.phase === 'ordered' && s.tick >= d.due) {
      if (s.delivery?.motion || this.model.extensionBusy()) return;
      const m = motion(d.id, 'van', { x: 4, y: 158 });
      if (!this.model.occupancy.tryClaim(m.id, footprint(m))) return;
      d.motion = m;
      d.phase = 'travelling';
      path(m, [
        { x: 156, y: 158 },
        { x: 156, y: 100 },
        { x: 144, y: 100 },
        DOCK,
      ]);
    } else if (d.motion && !d.motion.route.length && !d.motion.turn) {
      if (d.phase === 'travelling') d.phase = 'unloading';
      if (d.phase === 'unloading') {
        const worker = t.staff[1];
        if (!worker.route.length && !at(worker, { x: 139, y: 110 }))
          this.model.walk(worker, { x: 139, y: 110 });
        if (!at(worker, { x: 139, y: 110 }) || ++d.progress < 100) return;
        // Inventory is accepted only after the operator has carried the crates inside.
        this.model.walk(worker, { x: 131, y: 110 });
        d.phase = 'returning';
        d.progress = 0;
      }
      if (d.phase === 'returning' && d.progress === 0) {
        const w = t.staff[1];
        if (!at(w, { x: 131, y: 110 })) {
          if (!w.route.length) this.model.walk(w, { x: 131, y: 110 });
          return;
        }
        for (const k of GOODS) {
          const amount = 20 - t.stock[k];
          t.stock[k] += amount;
          t.supplied[k] += amount;
        }
        t.deliveries++;
        d.progress = 1;
        path(d.motion, [
          ...(s.campaign?.scenario
            ? [{ x: 156, y: 110 }]
            : [
                { x: 144, y: 116 },
                { x: 156, y: 116 },
              ]),
          { x: 156, y: 158 },
          { x: 252, y: 158 },
        ]);
      } else if (d.phase === 'returning' && d.progress === 1) {
        this.model.occupancy.release(d.id);
        t.delivery = null;
      }
    }
  }
}
export const tenantQueueFor = (t: Tenant, c: Customer) =>
  c.tenantVisit ? t.queue : null;
