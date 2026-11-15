import { describe, it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from '../fixtures/station';
import type { BuildRequest } from '../../src/games/gas-station/placement';
import { bodies } from '../../src/games/gas-station/state';
import { tankCapacity } from '../../src/games/gas-station/development';
import browserSave from '../fixtures/station-s2-resume.json';
import ciSave from '../fixtures/station-s2-ci-resume.json';
const create = (seed = 731) => new StationModel(stationWorld, seed, true);
function route(m: StationModel) {
  expect(m.buyParcel('west')).toBe(true);
  expect(m.buyParcel('north')).toBe(true);
  for (const [x, y, tx, ty] of [
    [106, 134, 84, 134],
    [84, 134, 84, 100],
    [84, 100, 148, 100],
    [148, 100, 148, 118],
  ]) {
    const r: BuildRequest = {
      kind: 'road',
      point: { x, y },
      to: { x: tx, y: ty },
      rotation: 0,
      fuel: 'on',
    };
    const p = m.previewBuild(r);
    expect(p.reason).toBe('');
    expect(m.build(r, p.revision)).toBe(true);
  }
}
function operate(m: StationModel) {
  const s = m.state;
  if (s.tick === 100) m.buildPump(m.previewPump().revision);
  if (s.tick === 200 && s.workers.length < 3) m.hire();
  if (!s.delivery && s.tick < m.duration - 2200) {
    if (s.tanks.e95.quantity < 1600) m.orderFuel('e95', 400);
    else if (s.tanks.on.quantity < 1600) m.orderFuel('on', 400);
    else if (Object.values(s.goods).reduce((n, a) => n + a.quantity, 0) < 18)
      m.orderGoods();
  }
}
describe('Stacja S2', () => {
  it('zachowuje numer parkingu, gdy później zlecona budowa skończy się pierwsza', () => {
    const m = create();
    route(m);
    m.hire();
    for (const y of [100, 118])
      expect(
        m.build(
          { kind: 'parking', point: { x: 84, y }, rotation: 0, fuel: 'e95' },
          m.state.topology,
        ),
      ).toBe(true);
    let savedIndex = -1;
    for (let i = 0; i < 2500; i++) {
      m.tick();
      const sites = m.state.development!.sites;
      if (!sites[1].progress && sites[0].progress)
        savedIndex = m.parking.findIndex((p) => p.y === 118);
      for (const c of m.state.customers)
        if (c.parking !== null && c.parking >= 4)
          expect(sites[c.parking - 4].progress).toBe(0);
    }
    expect(savedIndex).toBe(5);
    expect(m.state.development!.sites.map((p) => p.progress)).toEqual([0, 0]);
    expect(m.parking[savedIndex]).toEqual({ x: 84, y: 118 });
    m.validateSave(m.snapshot());
  });
  it.each([0, 1, 2, 3])(
    'pracownik dociera do pompy obróconej o %s ćwierćobrotów',
    (rotation) => {
      const m = create();
      route(m);
      m.hire();
      const request: BuildRequest = {
        kind: 'pump',
        point: rotation % 2 ? { x: 88, y: 100 } : { x: 84, y: 118 },
        rotation,
        fuel: 'e95',
      };
      expect(m.previewBuild(request).reason).toBe('');
      expect(m.build(request, m.state.topology)).toBe(true);
      for (let i = 0; i < 3000 && m.state.development!.sites[0].progress; i++)
        m.tick();
      expect(m.state.development!.sites[0].progress).toBe(0);
      expect(m.state.pumps[3].built).toBe(true);
      m.validateSave(m.snapshot());
    },
  );
  it('zbiornik zwiększa pojemność dopiero po fizycznym ukończeniu budowy', () => {
    const m = create();
    m.buyParcel('west');
    expect(
      m.build(
        { kind: 'tank', point: { x: 84, y: 118 }, rotation: 0, fuel: 'on' },
        m.state.topology,
      ),
    ).toBe(true);
    expect(tankCapacity(m.state, 'on')).toBe(10000);
    for (let i = 0; i < 3000 && m.state.development!.sites[0].progress; i++)
      m.tick();
    expect(tankCapacity(m.state, 'on')).toBe(20000);
    expect(tankCapacity(m.state, 'e95')).toBe(10000);
    m.validateSave(m.snapshot());
  });
  it('dwie obsadzone kasy pobierają zapłatę równolegle i tylko raz', () => {
    const m = create();
    expect(m.assignWorker(0, 'checkout')).toBe(false);
    expect(m.secondCheckout()).toBe(true);
    expect(m.secondCheckout()).toBe(false);
    m.hire();
    m.hire();
    expect(m.assignWorker(3, 'checkout')).toBe(true);
    let parallel = false;
    while (!m.state.result) {
      operate(m);
      m.tick();
      parallel ||= !!(
        m.state.checkout?.progress && m.state.development!.checkout?.progress
      );
    }
    expect(parallel).toBe(true);
    expect(m.state.served).toBeGreaterThanOrEqual(20);
    m.validateSave(m.snapshot());
  }, 30000);
  it('rozwiązuje umowę dopiero na granicy okresu, zachowuje klientów i własny towar', () => {
    const m = create();
    let scheduled = false,
      signed = false,
      returning = false,
      restoringAt = -1;
    for (let i = 0; i < m.duration; i++) {
      operate(m);
      if (i === 7200) signed = m.lease.sign('fixed');
      if (!scheduled && m.state.development!.tenant.phase === 'leased')
        scheduled = m.lease.termination();
      m.tick();
      returning ||= m.state.development!.tenant.phase === 'returning';
      if (m.state.development!.tenant.phase === 'restoring' && restoringAt < 0)
        restoringAt = m.state.tick;
      if (restoringAt >= 0 && m.state.tick < restoringAt + 400)
        expect(m.state.development!.tenant.phase).toBe('restoring');
      if (m.state.tick < 10800)
        expect(m.state.development!.tenant.contract?.end ?? -1).toBe(-1);
      if (i % 500 === 0) m.validateSave(m.snapshot());
    }
    expect(signed && scheduled && returning).toBe(true);
    expect(restoringAt).toBeGreaterThanOrEqual(10800);
    expect(m.state.development!.tenant.phase).toBe('owned');
    expect(m.state.development!.tenant.contract!.end).toBe(10800);
    expect(m.lease.sign('share')).toBe(false);
    expect(
      m.state.journal.entries.filter((e) => e.category === 'lease-penalty'),
    ).toHaveLength(1);
    m.validateSave(m.snapshot());
  }, 30000);
  it('podgląd jest bezpłatny, stary commit i odcięcie drogi są odrzucane', () => {
    const m = create();
    route(m);
    const r: BuildRequest = {
      kind: 'pump',
      point: { x: 84, y: 118 },
      rotation: 2,
      fuel: 'e95',
    };
    const before = m.snapshot(),
      plan = m.previewBuild(r);
    expect(plan.valid, plan.reason).toBe(true);
    expect(m.snapshot()).toEqual(before);
    expect(m.build(r, plan.revision - 1)).toBe(false);
    expect(m.snapshot()).toEqual(before);
    expect(m.build(r, plan.revision)).toBe(true);
    const cash = m.cash;
    expect(m.build(r, plan.revision)).toBe(false);
    expect(m.cash).toBe(cash);
    const remove: BuildRequest = {
      ...r,
      kind: 'remove-road',
      roadId: m.state.development!.roads[0].id,
    };
    expect(m.previewBuild(remove).reason).toBe('Brak dojazdu lub wyjazdu');
    expect(m.build(remove, m.state.topology)).toBe(false);
    m.validateSave(m.snapshot());
  });
  it('ceny nowych ofert nie zmieniają rozpoczętego tankowania', () => {
    const m = create();
    for (
      let i = 0;
      i < 2000 && !m.state.customers.some((c) => c.phase === 'fueling');
      i++
    )
      m.tick();
    const c = m.state.customers.find((c) => c.phase === 'fueling')!;
    expect(c).toBeDefined();
    const accepted = c.price;
    expect(m.setPrice(c.fuel!, accepted + 100)).toBe(true);
    expect(c.price).toBe(accepted);
    expect(m.setPrice('e95', NaN)).toBe(false);
    for (let i = 0; i < 400; i++) m.tick();
    m.validateSave(m.snapshot());
  });
  it.each([
    { label: 'lokalnie', state: browserSave },
    { label: 'CI', state: ciSave },
  ])(
    'odtwarza zatłoczony układ $label i obie kolejki ruszają bez teleportacji',
    ({ state }) => {
      const m = create();
      m.restore(state);
      let restored: StationModel | undefined,
        maxBlocked = 0;
      while (!m.state.result) {
        for (const a of [m, ...(restored ? [restored] : [])]) {
          const tick = a.state.tick;
          if (tick % 52 === 0) {
            if (a.lease.offer()) a.lease.sign('share');
            if (!a.state.delivery && tick < a.duration - 2400) {
              if (a.state.tanks.e95.quantity < 1600) a.orderFuel('e95', 400);
              else if (a.state.tanks.on.quantity < 1600) a.orderFuel('on', 400);
              else if (
                Object.values(a.state.goods).reduce(
                  (n, g) => n + g.quantity,
                  0,
                ) < 18
              )
                a.orderGoods();
            }
          }
          a.tick();
        }
        maxBlocked = Math.max(
          maxBlocked,
          ...bodies(m.state).map((m) => m.blocked),
        );
        expect(bodies(m.state).length).toBeLessThanOrEqual(32);
        if (m.state.tick % 500 === 0) m.validateSave(m.snapshot());
        if (!restored && m.state.development!.tenant.sales.length) {
          restored = create();
          restored.restore(m.snapshot());
        }
      }
      expect(m.state.development!.tenant.sales.length).toBeGreaterThan(0);
      expect(maxBlocked).toBeLessThan(1200);
      expect(restored?.snapshot()).toEqual(m.snapshot());
      m.validateSave(m.snapshot());
      const bad = m.snapshot();
      bad.development!.tenant.supplied.coffee++;
      expect(() => m.validateSave(bad)).toThrow();
    },
    30000,
  );
  it('buduje skierowane dojazdy, odrzuca odcięcie i obsługuje ciężarówkę', () => {
    const m = create();
    route(m);
    const r: BuildRequest = {
      kind: 'heavy-pump',
      point: { x: 84, y: 118 },
      rotation: 0,
      fuel: 'on',
    };
    expect(m.previewBuild(r).reason).toBe('');
    expect(m.build(r, m.state.topology)).toBe(true);
    expect(m.hire()).toBe(true);
    let serviced = false;
    for (let i = 0; i < m.duration; i++) {
      operate(m);
      m.tick();
      serviced ||= m.state.customers.some(
        (c) => c.vehicle.kind === 'truck' && c.issued > 0,
      );
      if (i % 500 === 0) m.validateSave(m.snapshot());
    }
    expect(
      serviced,
      JSON.stringify({
        sites: m.state.development!.sites,
        workers: m.state.workers,
        customers: m.state.customers,
        delivery: m.state.delivery,
      }),
    ).toBe(true);
    expect(
      m.state.result,
      JSON.stringify({
        served: m.state.served,
        lost: m.state.lost,
        profit: m.profit,
      }),
    ).toBe('success');
    m.validateSave(m.snapshot());
  }, 30000);
  it.each(['fixed', 'share'] as const)(
    'przejmuje lokal i rozlicza %s bez podwójnej marży',
    (type) => {
      const m = create();
      let signed = false;
      for (let i = 0; i < m.duration; i++) {
        operate(m);
        if (m.state.tick === 7200) signed = m.lease.sign(type);
        m.tick();
        if (i % 500 === 0) m.validateSave(m.snapshot());
      }
      expect(signed).toBe(true);
      expect(
        m.state.result,
        JSON.stringify({
          served: m.state.served,
          lost: m.state.lost,
          profit: m.profit,
        }),
      ).toBe('success');
      const t = m.state.development!.tenant;
      expect(t.phase).toBe('leased');
      expect(t.sales.length).toBeGreaterThan(0);
      expect(t.deliveries).toBeGreaterThan(0);
      expect(t.settlements).toHaveLength(2);
      const before = m.cash;
      m.lease.settle(2);
      expect(m.cash).toBe(before);
      m.validateSave(m.snapshot());
    },
    30000,
  );
});
