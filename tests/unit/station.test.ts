import { describe, it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { bodies } from '../../src/games/gas-station/state';
import { stationWorld as world, operate } from '../fixtures/station';
describe('Stacja — zmiana otwarcia', () => {
  it.each([20261114, 731])(
    'obsługuje klientów fizycznie, przyjmuje dostawę i kończy zmianę z zyskiem (%s)',
    (seed) => {
      const m = new StationModel(world, seed);
      while (!m.prepare()) {
        /* incremental preparation */
      }
      for (let t = 0; t < 7200; t++) {
        operate(m);
        m.tick();
        if (t % 100 === 0) {
          m.validateSave(m.snapshot());
          expect(bodies(m.state).length).toBeLessThanOrEqual(32);
        }
      }
      expect(m.state.result).toBe('success');
      expect(m.state.deliveries).toBeGreaterThan(0);
      expect(m.state.pumps[2].built).toBe(true);
      expect(m.profit).toBeGreaterThan(0);
      m.validateSave(m.snapshot());
    },
  );
});
