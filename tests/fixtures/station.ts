import data from '../../public/assets/games/gas-station/world.json' with { type: 'json' };
import { validateWorld } from '../../src/games/gas-station/world';
import type { StationModel } from '../../src/games/gas-station/model';
export const stationWorld = validateWorld(data);
/** Deterministic public commands, no inventory or simulation-state mutations. */
export function operate(m: StationModel) {
  const s = m.state;
  if (s.tick === 100) m.buildPump(m.previewPump().revision);
  if (!s.delivery && s.tick < 4500) {
    if (s.tanks.on.quantity < 1200) m.orderFuel('on', 200);
    else if (s.tanks.e95.quantity < 1600) m.orderFuel('e95', 200);
    else if (Object.values(s.goods).reduce((n, g) => n + g.quantity, 0) < 20)
      m.orderGoods();
  }
}
