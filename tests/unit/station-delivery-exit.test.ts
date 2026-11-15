import { it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from '../fixtures/station';
import save from '../fixtures/station-s3-ci-delivery.json';
import { bodies, occupancyOf } from '../../src/games/gas-station/state';
import { move } from '../../src/games/gas-station/traffic';
import { UNIT } from '../../src/games/gas-station/world';

it('S3: zapis z CI — cysterna i auto przy trzeciej pompie uwalniają wyjazd', () => {
  const m = new StationModel(stationWorld, 731, true, true);
  m.restore(save);
  const tanker = m.state.delivery!.motion!;
  const car = m.state.customers.find((c) => c.id === 'c-92')!.vehicle;
  expect(tanker.x).toBe(save.delivery.motion.x);
  expect(tanker.y).toBe(save.delivery.motion.y);
  expect(tanker.route[0]).toEqual({ x: 144, y: 110 });
  m.validateSave(m.snapshot());
  for (let tick = 0; tick < 2200; tick++) {
    for (const a of bodies(m.state))
      move(a, m.occupancy, m.topology.legal, true);
    occupancyOf(m.state);
    if (tanker.x > 164 * UNIT && car.x > 164 * UNIT) break;
  }
  expect(tanker.x).toBeGreaterThan(164 * UNIT);
  expect(car.x).toBeGreaterThan(164 * UNIT);
  expect(m.state.journal).toEqual(save.journal);
});
