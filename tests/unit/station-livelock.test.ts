import { it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from '../fixtures/station';
import save from '../fixtures/station-s2-ci-livelock.json';
import { bodies, occupancyOf } from '../../src/games/gas-station/state';
import { move, at } from '../../src/games/gas-station/traffic';
it('S2: dwaj piesi z zapisu CI mijają się i docierają do celu bez krążenia', () => {
  const m = new StationModel(stationWorld, 731, true);
  m.restore(save);
  const walkers = [m.state.workers[0].motion, m.state.workers[2].motion];
  const targets = walkers.map((w) => ({ ...w.route.at(-1)! }));
  for (let tick = 0; tick < 1000; tick++) {
    for (const a of bodies(m.state))
      move(a, m.occupancy, m.topology.legal, true);
    occupancyOf(m.state);
    if (walkers.every((w, i) => at(w, targets[i]))) break;
  }
  expect(walkers.map((w, i) => at(w, targets[i]))).toEqual([true, true]);
});
