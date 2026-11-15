import type { Cell } from '../../engine/api/strategy';
import type { StationModel } from './model';
import type { Customer } from './types';
import { at, path } from './traffic';
import { ENTRY, EXIT } from './development';
import { washSite } from './campaign-data';

/** Waiting cars occupy real parking bays; one car holds the extension lane token. */
export class CarWash {
  constructor(private readonly model: StationModel) {}
  join(c: Customer, from: Cell) {
    const m = this.model,
      s = m.state,
      wash = s.campaign!.wash;
    if (c.journey?.wash !== 'wanted') return false;
    const bay = m.parking.findIndex(
      (_, i) =>
        i < 4 && !s.customers.some((a) => a.id !== c.id && a.parking === i),
    );
    if (
      !washSite(s) ||
      wash.queue.length >= 3 ||
      bay < 0 ||
      c.budget - c.paidTotal - (c.tenantBill ?? 0) < 2500
    ) {
      c.journey.wash = 'missed';
      c.journey.interruptions |= 4;
      return false;
    }
    const target = m.parking[bay];
    const wasPump = c.pump !== null;
    const wasExtension = (c.pump ?? -1) >= 3 || (c.parking ?? -1) >= 4;
    c.pump = null;
    c.parking = bay;
    c.phase = 'wash-wait';
    c.journey.wash = 'queued';
    wash.queue.push(c.id);
    if (at(c.vehicle, target)) return true;
    const outbound = wasExtension
      ? m.topology.route(from, EXIT, c.vehicle.kind)!
      : [
          { x: from.x, y: wasPump ? 118 : 138 },
          { x: 148, y: wasPump ? 118 : 138 },
        ];
    path(c.vehicle, [
      ...outbound,
      { x: 148, y: 164 },
      { x: 98, y: 164 },
      { x: 98, y: 150 },
      { x: target.x, y: 150 },
      target,
    ]);
    return true;
  }
  customer(c: Customer) {
    if (!['wash-wait', 'to-wash', 'washing'].includes(c.phase)) return false;
    const s = this.model.state,
      w = s.campaign!.wash;
    if (c.phase === 'wash-wait') {
      if (at(c.vehicle, EXIT)) c.extension = false;
      if (c.wait >= c.patience && !c.vehicle.route.length && !c.vehicle.turn) {
        w.queue = w.queue.filter((id) => id !== c.id);
        c.journey!.wash = 'missed';
        c.journey!.interruptions |= 4;
        const bay = this.model.parking[c.parking!];
        path(c.vehicle, [
          { x: bay.x, y: 138 },
          { x: 148, y: 138 },
          { x: 148, y: 158 },
          { x: 252, y: 158 },
        ]);
        c.parking = null;
        c.extension = false;
        c.phase = 'leaving';
      }
    } else if (
      c.phase === 'to-wash' &&
      !c.vehicle.route.length &&
      !c.vehicle.turn
    ) {
      if (this.model.cash < 800) return true;
      if (this.model.post(`wash-cost-${c.id}`, 'wash-cost', -800, -800))
        c.phase = 'washing';
    }
    return true;
  }
  tick() {
    const m = this.model,
      s = m.state,
      w = s.campaign!.wash,
      site = washSite(s);
    if (!site) return;
    if (!w.customer) {
      const c = s.customers.find((c) => c.id === w.queue[0]);
      if (
        !c ||
        c.vehicle.route.length ||
        c.vehicle.turn ||
        m.extensionBusy(c.id) ||
        m.cash < 800 ||
        s.customers.some((a) => a.abandoned && a.vehicle.y < 158 * 256)
      )
        return;
      const alternate = { x: 100, y: 134 };
      const entry = m.topology.route(alternate, site.point, c.vehicle.kind)
        ? alternate
        : ENTRY;
      const route = m.topology.route(entry, site.point, c.vehicle.kind);
      if (!route) return;
      w.queue.shift();
      w.customer = c.id;
      w.progress = 0;
      c.phase = 'to-wash';
      c.journey!.wash = 'active';
      c.extension = true;
      const bay = m.parking[c.parking!];
      c.parking = null;
      path(c.vehicle, [
        { x: bay.x, y: 142 },
        { x: 100, y: 142 },
        { x: 100, y: 134 },
        entry,
        ...route,
      ]);
    }
    const c = s.customers.find((c) => c.id === w.customer)!;
    if (c.phase !== 'washing') return;
    w.progress++;
    if (w.progress < 500) return;
    m.post(`wash-sale-${c.id}`, 'wash-sale', 2500, 2500, 2500);
    w.completed++;
    w.customer = null;
    w.progress = 0;
    c.journey!.wash = 'done';
    c.phase = 'leaving';
    const route = m.topology.route(site.point, EXIT, c.vehicle.kind)!;
    path(c.vehicle, [...route, { x: 148, y: 158 }, { x: 252, y: 158 }]);
  }
}
