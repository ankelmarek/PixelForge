import { it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from '../fixtures/station';
import { operateWeekend, washRoad } from '../fixtures/station-campaign';
import { VARIANTS, darkness } from '../../src/games/gas-station/scenarios';
import { bodies } from '../../src/games/gas-station/state';

it.each(
  VARIANTS.flatMap((variant) =>
    [731, 9021].flatMap((seed) =>
      (['own', 'tenant'] as const).map((strategy) => ({
        variant,
        seed,
        strategy,
      })),
    ),
  ),
)(
  '$variant / $strategy / $seed: pełny weekend, sukces i zgodne rozliczenie',
  ({ variant, seed, strategy }) => {
    const m = new StationModel(stationWorld, seed, true, true, variant);
    let maxUnits = 0;
    for (let i = 0; i < 36000; i++) {
      operateWeekend(m, strategy);
      m.tick();
      maxUnits = Math.max(maxUnits, bodies(m.state).length);
      if (i % 6000 === 0) m.validateSave(m.snapshot());
    }
    expect(m.state.result).toBe('success');
    expect(m.state.served).toBeGreaterThanOrEqual(m.goal);
    expect(m.state.satisfaction / m.state.visits).toBeGreaterThanOrEqual(7000);
    expect(m.profit).toBeGreaterThan(0);
    expect(maxUnits).toBeLessThanOrEqual(32);
    if (variant === 'night')
      expect(m.state.campaign!.scenario!.energyCharged).toBe(60000);
    m.validateSave(m.snapshot());
  },
  60000,
);

it.each([731, 9021])(
  'autostrada i duże ON / %i: dostawy i wyjazd nie blokują pompy',
  (seed) => {
    const m = new StationModel(stationWorld, seed, true, true, 'highway');
    washRoad(m);
    m.hire();
    expect(
      m.build(
        {
          kind: 'heavy-pump',
          point: { x: 84, y: 118 },
          rotation: 0,
          fuel: 'on',
        },
        m.state.topology,
      ),
    ).toBe(true);
    for (let i = 0; i < 36000; i++) {
      operateWeekend(m, 'retail');
      m.tick();
    }
    expect(m.state.result).toBe('success');
    expect(m.profit).toBeGreaterThan(0);
    expect(m.state.served).toBeGreaterThanOrEqual(55);
    m.validateSave(m.snapshot());
  },
  60000,
);

it('oświetlenie i nocne płace są płatne, a wznowienie nie powtarza rachunku', () => {
  const a = new StationModel(stationWorld, 731, true, true, 'night');
  for (let i = 0; i < 600; i++) a.tick();
  expect(a.state.campaign!.scenario!.energyCharged).toBe(1000);
  const b = new StationModel(stationWorld, 1, true, true, 'country');
  b.restore(a.snapshot());
  a.state.campaign!.scenario!.lights = false;
  b.state.campaign!.scenario!.lights = false;
  for (let i = 0; i < 600; i++) {
    a.tick();
    b.tick();
  }
  expect(b.snapshot()).toEqual(a.snapshot());
  expect(b.state.campaign!.scenario!.energyCharged).toBe(1000);
  expect(b.state.development!.wageTotal).toBe(2900);
  const corrupt = b.snapshot();
  corrupt.campaign!.scenario!.energyCharged = 0;
  expect(() => b.restore(corrupt)).toThrow();
  b.validateSave(b.snapshot());
});

it('stary weekend v3 zachowuje scenariusz i brak nowych kosztów po wznowieniu', () => {
  const legacy = new StationModel(stationWorld, 731, true, true);
  for (let i = 0; i < 700; i++) legacy.tick();
  const modern = new StationModel(stationWorld, 9021, true, true, 'night');
  modern.restore(legacy.snapshot());
  for (let i = 0; i < 1200; i++) {
    legacy.tick();
    modern.tick();
  }
  expect(modern.snapshot()).toEqual(legacy.snapshot());
  expect(modern.state.gameVersion).toBe('0.3.0');
  expect(modern.goal).toBe(60);
  expect(modern.state.campaign!.scenario).toBeUndefined();
});

it('zmiana światła jest ciągła na granicach zmian, a noc pozostaje nocą', () => {
  const m = new StationModel(stationWorld, 731, true, true, 'country');
  for (const tick of [9600, 24000]) {
    m.state.tick = tick - 1;
    const before = darkness(m.state);
    m.state.tick = tick;
    expect(Math.abs(darkness(m.state) - before)).toBeLessThan(0.001);
  }
  m.state.campaign!.scenario!.variant = 'night';
  for (const tick of [0, 9600, 24000, 36000]) {
    m.state.tick = tick;
    expect(darkness(m.state)).toBe(0.85);
  }
});
