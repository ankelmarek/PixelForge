import { expect, it } from 'vitest';
import { validateSimulationLevel } from '../../src/engine/simulation/validation';
import { SimulationModel } from '../../src/engine/simulation/model';
import { Navigator } from '../../src/engine/simulation/navigation';
import { SimulationSave } from '../../src/engine/simulation/save';
import { StorageService } from '../../src/engine/systems/storage';
import { simulationDefinition, simulationLevel } from '../fixtures/content';
const raw = structuredClone(simulationLevel);
const level = validateSimulationLevel(raw);
it('mapa ma dwa źródła, dwóch pracowników i pojazd z przejezdnymi trasami', () => {
  expect(level.nodes.filter((n) => n.kind === 'source')).toHaveLength(2);
  expect(level.actors.filter((a) => a.kind === 'worker')).toHaveLength(2);
  const nav = new Navigator(level),
    depot = level.nodes.find((n) => n.kind === 'depot')!,
    processor = level.nodes.find((n) => n.kind === 'processor')!;
  const route = nav.findPath(depot.access, processor.access, true)!;
  expect(route.length).toBeGreaterThan(0);
  route.forEach((p) => expect(nav.walkable(p, true)).toBe(true));
  expect(nav.walkable({ x: 5, y: 5 })).toBe(false);
  expect(nav.walkable({ x: 5, y: 6 }, true)).toBe(false);
  expect(nav.findPath({ x: 5, y: 5 }, depot.access)).toBeNull();
});
it('pełen cykl zachowuje zasoby i kończy prototyp po rzeczywistej pracy wszystkich aktorów', () => {
  const model = new SimulationModel(level);
  level.nodes
    .filter((n) => n.kind === 'source')
    .forEach((n) => expect(model.gather(n.id)).toBe(true));
  expect(model.gather('source-1')).toBe(false);
  model.toggleProcessor('processor');
  for (let i = 0; i < 2400 && !model.state.completed; i++) {
    const vehicle = model.state.actors.find((a) => a.id === 'vehicle')!;
    if (!vehicle.current && !vehicle.queue.length) {
      if (Object.values(vehicle.cargo).some(Boolean))
        model.transport('deliver', 'processor');
      else {
        model.transport('load', 'depot');
        model.transport('deliver', 'processor');
      }
    }
    model.step(0.5);
    expect(model.resourceValue()).toBe(8);
  }
  expect(model.state.completed).toBe(true);
  expect(model.produced).toBe(8);
  expect(model.state.seconds).toBeGreaterThan(0);
  expect(model.state.seconds).toBeLessThan(300);
});
it('anulowanie zachowuje przewożony ładunek i umożliwia dalszą pracę', () => {
  const model = new SimulationModel(level);
  model.select('worker-1');
  model.gather('source-1');
  while (!Object.values(model.state.actors[0].cargo).some(Boolean))
    model.step(0.5);
  model.cancelSelected();
  expect(model.resourceValue()).toBe(8);
  for (let i = 0; i < 100; i++) model.step(0.5);
  expect(model.node('depot').stock.raw).toBeGreaterThan(0);
  expect(model.state.actors[0].current).toBeNull();
  expect(model.gather('source-1')).toBe(true);
});
it('zapis zachowuje trasy, postęp pracy, kolejki i wersję, izoluje gry i odrzuca uszkodzenia', () => {
  const model = new SimulationModel(level);
  model.gather('source-1');
  model.gather('source-2');
  model.step(5);
  const data = new Map<string, string>();
  const backend = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const save = new SimulationSave(
    simulationDefinition,
    model,
    new StorageService(backend),
  );
  expect(save.write()).toBe(true);
  const restored = new SimulationModel(level);
  expect(
    new SimulationSave(
      simulationDefinition,
      restored,
      new StorageService(backend),
    ).read(),
  ).toBe(true);
  expect(restored.state).toEqual(model.state);
  expect(
    new SimulationSave(
      { ...simulationDefinition, id: 'other' },
      new SimulationModel(level),
      new StorageService(backend),
    ).read(),
  ).toBe(false);
  expect(
    new SimulationSave(
      { ...simulationDefinition, version: 'other' },
      new SimulationModel(level),
      new StorageService(backend),
    ).read(),
  ).toBe(false);
  const broken = structuredClone(model.state);
  broken.nodes[0].stock.raw = -1;
  expect(restored.restore(broken)).toBe(false);
  const lost = structuredClone(model.state);
  lost.nodes[0].stock.raw = 0;
  expect(restored.restore(lost)).toBe(false);
  data.set('pixelforge:simulation:v1:simulation-fixture', '{broken');
  expect(save.read()).toBe(false);
});
it('walidator odrzuca nieznane typy, niezbilansowaną recepturę i zablokowane punkty', () => {
  const unknown = structuredClone(raw);
  Reflect.set(unknown.nodes[0], 'kind', 'eval');
  expect(() => validateSimulationLevel(unknown)).toThrow();
  const recipe = structuredClone(raw);
  recipe.nodes.find((n) => n.kind === 'processor')!.recipe!.outputAmount = 100;
  expect(() => validateSimulationLevel(recipe)).toThrow('bilans');
  const blocked = structuredClone(raw);
  blocked.actors[0].x = 5;
  blocked.actors[0].y = 5;
  expect(() => validateSimulationLevel(blocked)).toThrow('Zablokowany');
});
it('pauza przez brak kroków zachowuje model, różne delty utrzymują bilans', () => {
  for (const delta of [0.016, 0.05, 0.25]) {
    const model = new SimulationModel(level);
    model.gather('source-1');
    const before = structuredClone(model.state);
    model.step(0);
    expect(model.state).toEqual(before);
    for (let i = 0; i < Math.ceil(60 / delta); i++) model.step(delta);
    expect(model.resourceValue()).toBe(8);
    expect(model.harvested).toBeGreaterThan(0);
  }
});
it('niedostępny cel nie teleportuje jednostki ani nie zabiera zasobów', () => {
  const closed = structuredClone(level);
  const source = closed.nodes.find((n) => n.id === 'source-1')!;
  for (const point of source.workPoints!)
    closed.blockers.push({ ...point, width: 1, height: 1 });
  const model = new SimulationModel(closed);
  model.select('worker-1');
  expect(model.gather(source.id)).toBe(true);
  const start = { x: model.state.actors[0].x, y: model.state.actors[0].y };
  model.step(10);
  expect(model.state.actors[0]).toMatchObject({ ...start, blocked: true });
  expect(model.harvested).toBe(0);
  expect(model.resourceValue()).toBe(8);
});
it('ten sam model obsługuje tartak z innym bilansem jednostek', () => {
  const sawmill = structuredClone(level);
  sawmill.id = 'sawmill';
  sawmill.title = 'Tartak';
  sawmill.resources = [
    { id: 'logs', unitValue: 2, icon: 'cargo' },
    { id: 'boards', unitValue: 1, icon: 'cargo' },
  ];
  for (const n of sawmill.nodes) {
    n.stock = Object.fromEntries(
      Object.entries(n.stock).map(([id, quantity]) => [
        id === 'raw' ? 'logs' : 'boards',
        quantity,
      ]),
    );
    if (n.harvestResource) n.harvestResource = 'logs';
    if (n.recipe)
      n.recipe = {
        ...n.recipe,
        input: 'logs',
        output: 'boards',
        inputAmount: 1,
        outputAmount: 2,
      };
    if (n.kind === 'storage') n.capacity = 16;
  }
  sawmill.goal = { ...sawmill.goal, resource: 'boards', amount: 16 };
  const model = new SimulationModel(validateSimulationLevel(sawmill));
  sawmill.nodes
    .filter((n) => n.kind === 'source')
    .forEach((n) => model.gather(n.id));
  model.toggleProcessor('processor');
  for (let i = 0; i < 1600 && !model.state.completed; i++) {
    const vehicle = model.state.actors.find((a) => a.id === 'vehicle')!;
    if (!vehicle.current && !vehicle.queue.length) {
      if (Object.values(vehicle.cargo).some(Boolean))
        model.transport('deliver', 'processor');
      else {
        model.transport('load', 'depot');
        model.transport('deliver', 'processor');
      }
    }
    model.step(0.5);
    expect(model.resourceValue()).toBe(16);
  }
  expect(model.produced).toBe(16);
  expect(model.state.completed).toBe(true);
});
