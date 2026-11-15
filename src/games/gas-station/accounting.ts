import type { StationState } from './types';
import { FUELS, GOODS } from './world';
import { PARCELS } from './development';
import { debt } from './campaign-data';

export function netWorthOf(s: StationState) {
  return (
    s.journal.cash.balance -
    debt(s) -
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
    (s.pumps[2].built ? 108000 : 0) +
    (s.development
      ? Math.floor(
          (s.development.sites.reduce((n, p) => n + p.cost, 0) +
            s.development.roads.reduce((n, p) => n + p.cost, 0) +
            PARCELS.filter((p) => s.development!.parcels.includes(p.id)).reduce(
              (n, p) => n + p.price,
              0,
            ) +
            (s.development.secondCheckout ? 90000 : 0)) *
            0.6,
        )
      : 0)
  );
}
