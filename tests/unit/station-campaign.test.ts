import { it, expect, describe } from 'vitest';
import {
  weekend,
  operateWeekend,
  washRoad,
  type Strategy,
} from '../fixtures/station-campaign';
import { bodies } from '../../src/games/gas-station/state';
import { debt } from '../../src/games/gas-station/campaign-data';

describe('Stacja S3 — cały weekend', () => {
  it.each(
    [731, 9021].flatMap((seed) =>
      (['own', 'retail', 'tenant'] as Strategy[]).map((strategy) => ({
        seed,
        strategy,
      })),
    ),
  )(
    '$strategy / $seed: trzy zmiany, prawdziwe płatności, wynik i zgodny zapis',
    ({ seed, strategy }) => {
      const m = weekend(seed);
      let maxUnits = 0;
      for (let i = 0; i < 36000; i++) {
        operateWeekend(m, strategy);
        m.tick();
        maxUnits = Math.max(maxUnits, bodies(m.state).length);
        if (i % 3600 === 0) m.validateSave(m.snapshot());
      }
      const s = m.state;
      expect(s.result).toBe('success');
      expect(s.served).toBeGreaterThanOrEqual(60);
      expect(s.satisfaction / s.visits).toBeGreaterThanOrEqual(7000);
      expect(m.profit).toBeGreaterThan(0);
      expect(m.netWorth).toBeGreaterThan(0);
      expect(maxUnits).toBeLessThanOrEqual(32);
      expect(new Set(s.campaign!.ratings.map((r) => r.id)).size).toBe(s.visits);
      if (strategy === 'tenant') {
        expect(s.development!.tenant.phase).toBe('leased');
        expect(s.development!.tenant.sales.length).toBeGreaterThan(0);
        expect(s.development!.tenant.settlements.length).toBe(2);
      }
      const final = m.snapshot();
      m.validateSave(final);
      m.advance(5000);
      expect(m.state.tick).toBe(36000);
      expect(m.state.journal).toEqual(final.journal);
    },
    60000,
  );
  it('pożyczka to zobowiązanie, ma jedną wypłatę i jedną spłatę', () => {
    const m = weekend(),
      original = m.netWorth;
    expect(m.weekend.rescue()).toBe(true);
    expect(m.weekend.rescue()).toBe(false);
    expect(m.profit).toBe(0);
    expect(m.state.journal.revenue).toBe(0);
    expect(debt(m.state)).toBe(165000);
    expect(m.netWorth).toBe(original - 15000);
    const restored = weekend();
    restored.restore(m.snapshot());
    expect(restored.weekend.rescue()).toBe(false);
    for (let i = 0; i < 36000; i++) restored.tick();
    expect(restored.state.campaign!.rescue.repaid).toBe(true);
    expect(
      restored.state.journal.entries.filter(
        (e) => e.id === 'weekend-repayment',
      ),
    ).toHaveLength(1);
    expect(debt(restored.state)).toBe(0);
    restored.validateSave(restored.snapshot());
  }, 60000);
  it('finał bez pełnego celu jest częściowym sukcesem i zamyka przyjęte wizyty', () => {
    const m = weekend();
    for (let i = 0; i < 36000; i++) m.tick();
    expect(m.state.result).toBe('partial');
    const s = m.state;
    expect(s.visits).toBe(s.served + s.lost);
    expect(s.campaign!.ratings.some((r) => !r.served)).toBe(true);
    m.validateSave(m.snapshot());
  }, 60000);
  it('myjnia wymaga przychodu, dojazdu i budowy, myje fizycznie oraz rozlicza raz', () => {
    const m = weekend();
    washRoad(m);
    const request = {
      kind: 'wash' as const,
      point: { x: 84, y: 118 },
      rotation: 0,
      fuel: 'e95' as const,
    };
    expect(m.previewBuild(request).valid).toBe(false);
    let built = false,
      saved = false;
    for (let i = 0; i < 24000; i++) {
      operateWeekend(m);
      if (!built && m.state.journal.revenue >= 150000)
        built = m.build(request, m.state.topology);
      m.tick();
      const w = m.state.campaign!.wash;
      if (w.progress === 200 && !saved) {
        const copy = weekend();
        copy.restore(m.snapshot());
        expect(copy.state.campaign!.wash).toEqual(w);
        m.restore(copy.snapshot());
        saved = true;
      }
      if (w.completed >= 2) break;
    }
    expect(built).toBe(true);
    expect(saved).toBe(true);
    expect(m.state.campaign!.wash.completed).toBeGreaterThanOrEqual(2);
    const sales = m.state.journal.entries.filter(
      (e) => e.category === 'wash-sale',
    );
    expect(sales.every((e) => e.cash === 2500)).toBe(true);
    expect(
      m.state.journal.entries.filter((e) => e.category === 'wash-cost').length,
    ).toBeGreaterThanOrEqual(sales.length);
    m.validateSave(m.snapshot());
  }, 60000);
});
