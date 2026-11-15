import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from './station';

export type Strategy = 'own' | 'retail' | 'tenant';
export const weekend = (seed = 731) =>
  new StationModel(stationWorld, seed, true, true);
/** Only commands available to a player, with the same prices and elapsed work. */
export function operateWeekend(m: StationModel, strategy: Strategy = 'own') {
  const s = m.state,
    i = s.tick;
  if (i === 100) m.buildPump(s.topology);
  if (i === 200) m.hire();
  if (strategy === 'retail') {
    if (i === 220) m.hire();
    if (i === 240) m.secondCheckout();
    if (
      i % 20 === 0 &&
      s.development!.secondCheckout &&
      s.workers.filter((w) => w.role === 'checkout').length < 2
    )
      m.assignWorker(3, 'checkout');
  }
  if (i % 20) return;
  if (strategy === 'tenant' && m.lease.offer()) m.lease.sign('share');
  if (s.campaign!.fault && !s.campaign!.fault.repair) m.weekend.repair();
  if (!s.delivery && i < 32000) {
    if (s.tanks.e95.quantity < 2000) m.orderFuel('e95', 400);
    else if (s.tanks.on.quantity < 1800) m.orderFuel('on', 400);
    else if (Object.values(s.goods).reduce((n, g) => n + g.quantity, 0) < 18)
      m.orderGoods();
  }
}
export function washRoad(m: StationModel) {
  m.buyParcel('west');
  m.buyParcel('north');
  for (const [x, y, tx, ty] of [
    [106, 134, 84, 134],
    [84, 134, 84, 100],
    [84, 100, 148, 100],
    [148, 100, 148, 118],
  ])
    if (
      !m.build(
        {
          kind: 'road',
          point: { x, y },
          to: { x: tx, y: ty },
          rotation: 0,
          fuel: 'e95',
        },
        m.state.topology,
      )
    )
      throw Error('Test: droga myjni');
}
