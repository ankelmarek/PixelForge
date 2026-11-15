import { describe, expect, it } from 'vitest';
import data from '../../public/assets/games/winobranie-rts/world.json';
import { VineyardModel, type Tool } from '../../src/games/winobranie-rts/model';
import {
  validateWorld,
  varieties,
  type Variety,
} from '../../src/games/winobranie-rts/world';
import {
  VineyardClimate,
  type Weather,
} from '../../src/games/winobranie-rts/climate';
import { stepCrop } from '../../src/games/winobranie-rts/agronomy';
import {
  randomSample,
  ClimateEventService,
} from '../../src/engine/api/strategy';
import { seasonGuidance } from '../../src/games/winobranie-rts/season-guidance';
const create = (seed = 731) => new VineyardModel(validateWorld(data), seed);
function place(
  m: VineyardModel,
  tool: Tool,
  x: number,
  y: number,
  end = { x, y },
) {
  const p = m.preview(tool, { x, y }, end);
  expect(p.valid, `${tool} ${x},${y}: ${p.reason}`).toBe(true);
  expect(m.commit(p)).toBe(true);
}
function irrigate(m: VineyardModel) {
  place(m, 'tank', 228, 243);
  place(m, 'pump', 228, 241);
  place(m, 'pump', 228, 242);
  for (const y of [240, 244]) {
    for (const x of [236, 247, 258]) place(m, 'sprinkler', x, y);
    place(m, 'pipe', 228, y, { x: 258, y });
  }
  place(m, 'pipe', 228, 240, { x: 228, y: 244 });
  expect(m.refill(m.state.environment!.water.devices[0].id)).toBe(true);
}
describe('W2: sezon i nawadnianie', () => {
  it('losuje niezależne strumienie, przedziały zdarzeń i prognozę bez zużywania losowości', () => {
    expect(randomSample(731, 1, 5)).toBe(randomSample(731, 1, 5));
    expect(randomSample(731, 1, 5)).not.toBe(randomSample(731, 2, 5));
    const events = new ClimateEventService([
      { start: 2, end: 4, value: 'frost' },
    ]);
    expect(events.active(2)).toHaveLength(1);
    expect(events.active(4)).toEqual([]);
    expect(
      () => new ClimateEventService([{ start: 4, end: 2, value: 0 }]),
    ).toThrow();
    const a = new VineyardClimate(731),
      b = new VineyardClimate(731),
      c = new VineyardClimate(732);
    const weather = Array.from({ length: 120 }, (_, i) => a.at(i * 100));
    for (let t = 0; t < 100; t++) b.forecast(t * 100);
    expect(weather).toEqual(weather.map((_, i) => b.at(i * 100)));
    expect(weather).not.toEqual(weather.map((_, i) => c.at(i * 100)));
    expect(a.forecast(0)).toHaveLength(3);
  });
  it('odmiany różnią się dojrzewaniem i plonem; plon pojawia się tylko raz', () => {
    const results: { time: number; grown: number }[] = [];
    for (const variety of Object.keys(varieties) as Variety[]) {
      const m = create(),
        e = m.state.environment!,
        r = m.state.rows[0];
      r.variety = variety;
      const w: Weather = {
        day: 1,
        temperature: 220,
        rain: 1,
        sun: 90,
        wind: 1,
        humidity: 60,
        kind: 'sun',
      };
      let grown = 0,
        t = 0;
      while (!r.mature && t < 6000)
        grown += stepCrop(r, e.crops[r.id], e, w, m.water!, ++t);
      expect(r.mature).toBe(true);
      expect(grown).toBeGreaterThan(0);
      expect(stepCrop(r, e.crops[r.id], e, w, m.water!, ++t)).toBe(0);
      results.push({ time: t, grown });
    }
    expect(new Set(results.map((r) => r.time)).size).toBe(6);
    expect(new Set(results.map((r) => r.grown)).size).toBeGreaterThan(2);
  });
  it('chroniony, losowany sezon kończy się prawdziwą produkcją i zachowuje zasoby', () => {
    const m = create();
    irrigate(m);
    place(m, 'house', 268, 253);
    place(m, 'house', 280, 253);
    for (let i = 0; i < 12000; i++) {
      m.tick();
      if (i % 200 === 0) {
        for (const b of m.state.buildings) m.sell(b.id);
        expect(m.balanceGrams).toBe(m.state.grown);
        expect(() => m.validateSave(m.snapshot())).not.toThrow();
      }
    }
    expect(m.state.grown).toBeGreaterThan(70000);
    expect(m.state.sold).toBeGreaterThanOrEqual(40000);
    expect(m.state.completed).toBe(true);
    expect(m.state.environment!.water.used).toBeGreaterThan(0);
    expect(m.state.environment!.water.paidEnergy).toBe(
      m.state.environment!.water.energy,
    );
  });
  it('wznawia mróz i odmarzanie identycznie przy x1 i x4', () => {
    const a = create();
    irrigate(a);
    while (
      !Object.values(a.state.environment!.crops).some((c) =>
        c.plots.some((p) => p.ice),
      )
    )
      a.tick();
    const b = create(999);
    b.restore(a.snapshot());
    b.clock.speed = 4;
    for (let i = 0; i < 600; i++) {
      a.advance(200);
      b.advance(50);
    }
    expect({
      ...b.snapshot(),
      clock: { ...b.snapshot().clock, speed: 1 },
    }).toEqual(a.snapshot());
    expect(() => b.validateSave(b.snapshot())).not.toThrow();
    const before = b.snapshot(),
      bad = b.snapshot();
    bad.environment!.water.devices[0].volume++;
    expect(() => b.restore(bad)).toThrow();
    expect(b.snapshot()).toEqual(before);
  });
  it('migruje W1 bez dopisywania pogody i odrzuca fałszywe stany', () => {
    const old = new VineyardModel(validateWorld(data), null);
    for (let i = 0; i < 100; i++) old.tick();
    const { environment: _unused, ...base } = old.snapshot();
    void _unused;
    const raw = { ...base, version: 1, revision: 'vineyard-w1' };
    const m = create();
    m.restore(m.migrateV1(raw));
    expect(m.duration).toBe(360);
    expect(m.snapshot()).toEqual(old.snapshot());
    const bad = m.snapshot();
    bad.units[0].cargo.solaris = 100000;
    expect(() =>
      m.migrateV1({ ...bad, version: 1, revision: 'vineyard-w1' }),
    ).toThrow();
    const foreignVariety = new VineyardModel(
      validateWorld(data),
      null,
    ).snapshot();
    const u = foreignVariety.units[0];
    u.job = {
      kind: 'move',
      target: '',
      goal: { x: u.x, y: u.y },
      progress: 0,
      amount: 0,
      variety: 'cortis',
    };
    expect(() =>
      m.migrateV1({ ...foreignVariety, version: 1, revision: 'vineyard-w1' }),
    ).toThrow();
  });
  it('wymaga ciągłego, pełnego strumienia: brak wody, przerwana rura i krótki oprysk nie chronią', () => {
    const result: Record<string, number> = {};
    for (const variant of [
      'full',
      'none',
      'one-second',
      'empty',
      'pump-off',
      'pipe-break',
      'early-off',
      'overloaded',
      'no-power',
    ]) {
      const m = create();
      irrigate(m);
      const e = m.state.environment!,
        water = m.water!;
      for (const c of Object.values(e.crops))
        for (const p of c.plots) p.heat = 100000;
      for (const d of e.water.devices) {
        if (d.kind === 'sprinkler') d.mode = 'on';
        if (d.kind === 'tank') {
          d.delivery = null;
          d.volume = variant === 'empty' ? 1500 : 1000000;
        }
      }
      if (variant === 'none') for (const d of e.water.devices) d.mode = 'off';
      if (variant === 'overloaded') {
        e.water.devices.find((d) => d.kind === 'pump')!.mode = 'off';
        for (const x of [240, 252]) place(m, 'sprinkler', x, 240);
        for (const d of e.water.devices)
          if (d.kind === 'sprinkler') d.mode = 'on';
      }
      for (let t = 1; t <= 1000; t++) {
        if (
          (variant === 'one-second' && t === 21) ||
          (variant === 'pump-off' && t === 201) ||
          (variant === 'early-off' && t === 801)
        )
          for (const d of e.water.devices)
            if (d.kind === 'pump') d.mode = 'off';
        if (variant === 'pipe-break' && t === 201) {
          e.water.pipes = e.water.pipes.filter((p) => p.x !== 229);
          e.water.revision++;
        }
        const weather: Weather = {
          day: 1,
          temperature: t <= 800 ? -45 : 35,
          rain: 0,
          sun: 70,
          wind: 4,
          humidity: 70,
          kind: t <= 800 ? 'frost' : 'sun',
        };
        water.step(t, weather, variant !== 'no-power', () => true);
        for (const r of m.state.rows)
          stepCrop(r, e.crops[r.id], e, weather, water, t);
        if (variant === 'overloaded' && t === 50) {
          expect(water.flow.size).toBe(8);
          expect([...water.flow.values()].every((n) => n < 0.8)).toBe(true);
        }
      }
      result[variant] = e.crops['row-0'].plots[0].buds;
      expect(e.crops['row-0'].plots[0].ice).toBe(0);
    }
    expect(result.full).toBe(10000);
    for (const variant of Object.keys(result).filter((v) => v !== 'full'))
      expect(result[variant], variant).toBeLessThan(result.full);
    expect(result['one-second']).toBeLessThanOrEqual(result.none);
    expect(result['pump-off']).toBeLessThan(result.overloaded);
  });
  it('zleca skończoną dostawę i pielęgnację, nie dubluje opłat, zachowuje wodę przy rozbiórce', () => {
    const m = create();
    irrigate(m);
    place(m, 'house', 268, 253);
    const e = m.state.environment!,
      tank = e.water.devices[0],
      balance = m.state.ledger.balance;
    expect(m.refill(tank.id)).toBe(false);
    expect(m.state.ledger.balance).toBe(balance);
    expect(m.remove(tank.id)).toBe(false);
    for (const p of e.crops['row-0'].plots) p.mildew = 2000;
    expect(seasonGuidance(m.state)?.id).toBe('mildew');
    expect(m.care('row-0')).toBe(true);
    expect(m.care('row-0')).toBe(false);
    for (let i = 0; i < 600; i++) m.tick();
    expect(e.crops['row-0'].care).toBe(0);
    expect(e.crops['row-0'].plots.every((p) => p.mildew < 2000)).toBe(true);
    expect(tank.delivery).toBeNull();
    expect(tank.volume).toBeGreaterThan(500000);
    expect(m.remove(tank.id)).toBe(true);
    expect(e.water.discarded).toBeGreaterThan(0);
    expect(() => m.validateSave(m.snapshot())).not.toThrow();
  });
  it('odrzuca uszkodzone fazy, urządzenia i sieć bez zmiany aktywnego sezonu', () => {
    const m = create();
    irrigate(m);
    const before = m.snapshot();
    const changes = [
      (s: typeof before) => {
        s.environment!.seed = -1;
      },
      (s: typeof before) => {
        s.environment!.crops['row-0'].plots[0].yielded = true;
      },
      (s: typeof before) => {
        s.environment!.water.pipes.push({ x: -1, y: 1 });
      },
      (s: typeof before) => {
        s.environment!.water.devices[1].id = s.environment!.water.devices[0].id;
      },
      (s: typeof before) => {
        s.environment!.water.devices[0].delivery!.due = s.tick;
      },
      (s: typeof before) => {
        s.environment!.water.devices[1].volume = 1;
      },
    ];
    for (const change of changes) {
      const bad = m.snapshot();
      change(bad);
      expect(() => m.restore(bad)).toThrow();
      expect(m.snapshot()).toEqual(before);
    }
  });
  it('młode nasadzenia dają mały plon, a długa susza uszkadza pąki i ogranicza zbiór', () => {
    const yields: number[] = [];
    for (const [age, rain] of [
      [3, 1],
      [0, 1],
      [3, 0],
    ]) {
      const m = create(),
        e = m.state.environment!,
        r = m.state.rows[0],
        c = e.crops[r.id];
      c.age = age;
      r.variety = 'solaris';
      if (!rain) for (const p of c.plots) p.moisture = 1200;
      for (let t = 1; t <= 7000; t++)
        stepCrop(
          r,
          c,
          e,
          {
            day: 15,
            temperature: 280,
            rain,
            sun: 100,
            wind: 1,
            humidity: rain ? 95 : 20,
            kind: rain ? 'rain' : 'drought',
          },
          m.water!,
          t,
        );
      yields.push(r.stock);
      if (!rain) expect(c.plots.every((p) => p.buds < 10000)).toBe(true);
    }
    expect(yields[0]).toBeGreaterThan(yields[1] * 8);
    expect(yields[1]).toBeGreaterThan(0);
    expect(yields[2]).toBeLessThan(yields[0]);
  });
  it('wznawia również rozpoczęte odmarzanie bez kasowania lodu i czasu', () => {
    const a = create();
    irrigate(a);
    while (
      a.state.tick < 6000 &&
      !Object.values(a.state.environment!.crops).some((c) =>
        c.plots.some((p) => p.ice > 0 && p.thaw > 40),
      )
    )
      a.tick();
    expect(a.state.tick).toBeLessThan(6000);
    const b = create();
    b.restore(a.snapshot());
    for (let i = 0; i < 250; i++) {
      a.tick();
      b.tick();
    }
    expect(b.snapshot()).toEqual(a.snapshot());
  });
  it('daje osiągalny cel w różnych losowaniach po ochronie, podlewaniu i pielęgnacji', () => {
    const outcomes = [];
    for (const seed of [1, 42, 731, 2026, 0xffffffff]) {
      const m = create(seed);
      irrigate(m);
      place(m, 'house', 268, 253);
      place(m, 'house', 280, 253);
      for (let t = 0; t < 12000; t++) {
        m.tick();
        if (t % 200 === 0) {
          for (const b of m.state.buildings) m.sell(b.id);
          for (const r of m.state.rows)
            if (
              m.state.environment!.crops[r.id].plots.some(
                (p) => p.mildew >= 800,
              )
            )
              m.care(r.id);
          for (const d of m.state.environment!.water.devices)
            if (d.kind === 'tank' && d.volume < 100000) m.refill(d.id);
        }
      }
      expect(
        m.state.completed,
        `seed ${seed}, sprzedano ${m.state.sold} ml`,
      ).toBe(true);
      expect(() => m.validateSave(m.snapshot())).not.toThrow();
      outcomes.push(m.state.grown);
    }
    expect(new Set(outcomes).size).toBeGreaterThan(2);
  });
});
