import { describe, it, expect } from 'vitest';
import { StationModel } from '../../src/games/gas-station/model';
import { GOODS, validateWorld } from '../../src/games/gas-station/world';
import data from '../../public/assets/games/gas-station/world.json';
import { stationWorld as world, operate } from '../fixtures/station';
describe('Stacja — przerwania, zapis i ograniczenia', () => {
  it.each([0, 27, 100, 400])(
    'dostawa po rozbudowie w ticku %s nie blokuje pracownika',
    (buildTick) => {
      const m = new StationModel(world);
      for (let t = 0; t < 7200; t++) {
        if (t === 14) m.orderFuel('on', 200);
        if (t === buildTick) m.buildPump(0);
        m.tick();
      }
      expect(m.state.deliveries).toBeGreaterThan(0);
    },
  );
  it('wznawia częściowe tankowanie i rozładunek bez zmiany wyniku', () => {
    const a = new StationModel(world);
    let b: StationModel | undefined,
      restoredFuel = false,
      restoredTruck = false;
    for (let t = 0; t < 7200; t++) {
      operate(a);
      a.tick();
      if (b) {
        operate(b);
        b.tick();
      }
      const fuel = a.state.customers.some(
        (c) => c.phase === 'fueling' && c.issued > 10,
      );
      const truck =
        a.state.delivery?.phase === 'unloading' &&
        a.state.delivery.received > 0;
      if ((fuel && !restoredFuel) || (truck && !restoredTruck)) {
        if (b) expect(b.snapshot()).toEqual(a.snapshot());
        b = new StationModel(world, 99);
        b.restore(a.snapshot());
        restoredFuel ||= fuel;
        restoredTruck ||= !!truck;
      }
    }
    expect(restoredFuel && restoredTruck).toBe(true);
    expect(b!.snapshot()).toEqual(a.snapshot());
  });
  it('prędkość ×4 i kamera nie zmieniają symulacji; pauza nie nalicza kosztów', () => {
    const a = new StationModel(world),
      b = new StationModel(world);
    b.clock.speed = 4;
    for (let t = 0; t < 1600; t += 4) {
      if (t === 0) {
        a.orderFuel('on', 200);
        b.orderFuel('on', 200);
      }
      if (t === 100) {
        a.buildPump(0);
        b.buildPump(0);
      }
      a.advance(200);
      b.advance(50);
      b.state.camera = { x: 0, y: 4096, zoom: 2 };
    }
    const sa = a.snapshot(),
      sb = b.snapshot();
    sb.clock = sa.clock;
    sb.camera = sa.camera;
    expect(sb).toEqual(sa);
    a.clock.paused = true;
    const before = a.snapshot();
    a.advance(200000);
    expect(a.snapshot()).toEqual(before);
  });
  it('anuluje dostawę przed wyjazdem oraz zwraca tylko resztę po częściowym rozładunku', () => {
    const a = new StationModel(world),
      initial = a.cash;
    expect(a.orderFuel('on', 200)).toBe(true);
    const first = a.state.delivery!.id;
    expect(a.cancelDelivery(first)).toBe(true);
    expect(a.cash).toBe(initial);
    expect(a.profit).toBe(0);
    expect(a.cancelDelivery(first)).toBe(false);
    a.validateSave(a.snapshot());
    a.orderFuel('on', 200);
    for (let t = 0; t < 4000 && !a.state.delivery!.received; t++) a.tick();
    const d = a.state.delivery!;
    expect(d.received).toBeGreaterThan(0);
    const cash = a.cash,
      refund = d.cargo.cost,
      received = d.received,
      id = d.id;
    expect(a.cancelDelivery(id)).toBe(true);
    expect(a.cash).toBe(cash + refund);
    expect(a.state.totals.on.refunded).toBe(4000 - received);
    const once = a.snapshot();
    expect(a.cancelDelivery(id)).toBe(false);
    expect(a.snapshot()).toEqual(once);
    a.validateSave(once);
  });
  it('zamknięcie pomp nie pobiera paliwa; rozbudowa odrzuca stary i powtórzony podgląd', () => {
    const a = new StationModel(world);
    a.setPump(0, false);
    a.setPump(1, false);
    for (let i = 0; i < 800; i++) a.tick();
    expect(a.state.fuelSold).toBe(0);
    expect(a.state.fuelQueue).toHaveLength(0);
    const before = a.snapshot();
    expect(a.buildPump(999)).toBe(false);
    expect(a.snapshot()).toEqual(before);
    expect(a.buildPump(0)).toBe(true);
    expect(a.buildPump(0)).toBe(false);
    a.validateSave(a.snapshot());
  });
  it('towar trafia na półki dopiero po dostawie i przeniesieniu go przez pracownika', () => {
    const a = new StationModel(world),
      initial = structuredClone(a.state.goods);
    expect(a.orderGoods()).toBe(true);
    expect(a.state.goods).toEqual(initial);
    let carried = false;
    for (let t = 0; t < 7200 && !a.state.deliveries; t++) {
      a.tick();
      if (a.state.workers.some((w) => w.cargo.drink.quantity > 0)) {
        carried = true;
        for (const k of GOODS)
          expect(a.state.goods[k].quantity + a.state.totals[k].used).toBe(
            initial[k].quantity,
          );
      }
      if (t % 100 === 0) a.validateSave(a.snapshot());
    }
    expect(carried).toBe(true);
    expect(a.state.deliveries).toBe(1);
    for (const k of GOODS)
      expect(a.state.goods[k].quantity + a.state.totals[k].used).toBe(
        initial[k].quantity + 10,
      );
    a.validateSave(a.snapshot());
  });
  it('kolejka bez obsady odchodzi fizycznie i nie zjada zapasu', () => {
    const a = new StationModel(world);
    expect(a.assignWorker(0, 'checkout')).toBe(true);
    for (let i = 0; i < 3600; i++) a.tick();
    expect(a.state.lost).toBeGreaterThan(0);
    expect(a.state.fuelSold).toBe(0);
    expect(
      a.state.customers.some((c) => c.abandoned && c.vehicle.route.length > 0),
    ).toBe(true);
    a.validateSave(a.snapshot());
  });
  it('sklep potrzebuje kasjera, a po przywróceniu obsady kolejka rusza', () => {
    const a = new StationModel(world);
    a.assignWorker(1, 'forecourt');
    for (let i = 0; i < 2400; i++) a.tick();
    expect(a.state.articles).toBe(0);
    expect(a.state.checkoutQueue.length).toBeGreaterThan(0);
    const free = a.state.workers.findIndex((w) => !w.job);
    expect(free).toBeGreaterThanOrEqual(0);
    expect(a.assignWorker(free, 'checkout')).toBe(true);
    for (let i = 0; i < 1800; i++) a.tick();
    expect(a.state.articles).toBeGreaterThan(0);
    a.validateSave(a.snapshot());
  });
  it('odrzuca uszkodzone referencje, zasoby, bilans, kolizje i konfigurację', () => {
    const a = new StationModel(world);
    for (const mutate of [
      (s: ReturnType<typeof a.snapshot>) => s.tanks.e95.quantity++,
      (s: ReturnType<typeof a.snapshot>) => s.journal.cash.balance++,
      (s: ReturnType<typeof a.snapshot>) =>
        (s.customers[0].vehicle.x = s.customers[1].vehicle.x),
      (s: ReturnType<typeof a.snapshot>) => (s.pumps[0].customer = 'missing'),
      (s: ReturnType<typeof a.snapshot>) => (s.seed = NaN),
      (s: ReturnType<typeof a.snapshot>) =>
        (s.gameVersion = '0.2.0' as '0.1.0'),
    ]) {
      const s = a.snapshot();
      mutate(s);
      expect(() => a.validateSave(s)).toThrow();
    }
    expect(() =>
      validateWorld({ ...data, camera: { ...data.camera, zoom: NaN } }),
    ).toThrow();
    const bad = structuredClone(data);
    bad.terrain.sectors[0].url = '../remote.json';
    expect(() => validateWorld(bad)).toThrow();
  });
});
