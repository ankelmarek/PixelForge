import { Navigator } from './navigation';
import type { Cell, GridRect, SimulationLevel } from './types';
import {
  defaultWorldLimits,
  validateWorldTerrain,
  type WorldLimits,
} from '../world/validation';
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error(`${name}: wymagany obiekt`);
  return value as Record<string, unknown>;
}
function positive(value: unknown, name: string, min = 0, max = 100000) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error(`${name}: błędna liczba`);
}
function text(value: unknown, name: string) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value))
    throw Error(`${name}: błędny identyfikator`);
}
export function validateSimulationLevel(
  raw: unknown,
  limits: WorldLimits = defaultWorldLimits,
  viewport = { width: 320, height: 180 },
): SimulationLevel {
  const data = object(raw, 'Symulacja');
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2)
    throw Error('Symulacja: nieobsługiwana wersja');
  if (data.schemaVersion === 2) validateWorldTerrain(raw, limits, viewport);
  text(data.id, 'id');
  if (typeof data.title !== 'string' || !data.title)
    throw Error('title: wymagany tekst');
  for (const key of ['width', 'height']) {
    positive(
      data[key],
      key,
      8,
      data.schemaVersion === 2 ? limits.maxCells : 128,
    );
    if (!Number.isInteger(data[key]))
      throw Error(`${key}: wymagana liczba całkowita`);
  }
  positive(data.tileSize, 'tileSize', 8, 32);
  if (!Number.isInteger(data.tileSize))
    throw Error('tileSize: liczba całkowita');
  const point = (value: unknown, name: string) => {
    const p = object(value, name);
    positive(p.x, `${name}.x`, 0, (data.width as number) - 1);
    positive(p.y, `${name}.y`, 0, (data.height as number) - 1);
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y))
      throw Error(`${name}: pozycja musi leżeć na siatce`);
    return p as unknown as Cell;
  };
  const rect = (value: unknown, name: string) => {
    const p = point(value, name) as GridRect;
    positive(p.width, `${name}.width`, 1);
    positive(p.height, `${name}.height`, 1);
    if (
      !Number.isInteger(p.width) ||
      !Number.isInteger(p.height) ||
      p.x + p.width > (data.width as number) ||
      p.y + p.height > (data.height as number)
    )
      throw Error(`${name}: prostokąt poza mapą`);
    return p;
  };
  const list = (key: string, max: number) => {
    if (!Array.isArray(data[key]) || data[key].length > max)
      throw Error(`${key}: błędna lista`);
    return data[key] as unknown[];
  };
  list('roads', 256).forEach((r, i) => rect(r, `roads[${i}]`));
  list('blockers', 256).forEach((r, i) => rect(r, `blockers[${i}]`));
  const resources = new Map<string, number>();
  for (const raw of list('resources', 32)) {
    const r = object(raw, 'resource');
    text(r.id, 'resource.id');
    text(r.icon, 'resource.icon');
    positive(r.unitValue, 'unitValue', 0.001);
    if (resources.has(r.id as string)) throw Error('Powtórzony zasób');
    resources.set(r.id as string, r.unitValue as number);
  }
  if (!resources.size) throw Error('Brak zasobów');
  const ids = new Set<string>();
  for (const raw of list('nodes', 256)) {
    const node = object(raw, 'node');
    text(node.id, 'node.id');
    if (ids.has(node.id as string)) throw Error('Powtórzone ID');
    ids.add(node.id as string);
    if (
      !['source', 'depot', 'processor', 'storage', 'obstacle'].includes(
        String(node.kind),
      )
    )
      throw Error(`Nieznany typ obiektu: ${node.kind}`);
    rect(node, `node.${node.id}`);
    point(node.access, `access.${node.id}`);
    text(node.texture, 'texture');
    const stock = object(node.stock, 'stock');
    for (const [resource, amount] of Object.entries(stock)) {
      if (!resources.has(resource)) throw Error('Nieznany zasób');
      positive(amount, 'stock');
      if (!Number.isInteger(amount)) throw Error('stock: ilość całkowita');
    }
    if (node.kind === 'source') {
      if (
        !resources.has(String(node.harvestResource)) ||
        !(Number(stock[String(node.harvestResource)]) > 0)
      )
        throw Error('source: brak zasobu');
      positive(node.harvestSeconds, 'harvestSeconds', 0.1, 60);
      if (
        !Array.isArray(node.workPoints) ||
        !node.workPoints.length ||
        node.workPoints.length > 128
      )
        throw Error('workPoints: błędna lista');
      node.workPoints.forEach((p, i) => point(p, `workPoints[${i}]`));
    }
    if (node.kind === 'processor') {
      const recipe = object(node.recipe, 'recipe');
      for (const key of ['input', 'output'])
        if (!resources.has(String(recipe[key])))
          throw Error('recipe: nieznany zasób');
      for (const key of ['inputAmount', 'outputAmount']) {
        positive(recipe[key], key, 1);
        if (!Number.isInteger(recipe[key]))
          throw Error('recipe: ilość całkowita');
      }
      positive(recipe.seconds, 'recipe.seconds', 0.1, 120);
      text(recipe.destination, 'destination');
      if (
        Math.abs(
          resources.get(recipe.input as string)! *
            (recipe.inputAmount as number) -
            resources.get(recipe.output as string)! *
              (recipe.outputAmount as number),
        ) > 0.00001
      )
        throw Error('recipe: niezachowany bilans zasobów');
    }
    if (node.stockVisual !== undefined) {
      const v = object(node.stockVisual, 'stockVisual');
      text(v.texture, 'stockVisual.texture');
      positive(v.unitSize, 'unitSize', 1);
      if (!Array.isArray(v.slots) || v.slots.length > 128)
        throw Error('slots: błędna lista');
      for (const raw of v.slots) {
        const p = object(raw, 'slot');
        positive(p.x, 'slot.x', -16, 16);
        positive(p.y, 'slot.y', -16, 16);
      }
      if (v.scale !== undefined) positive(v.scale, 'scale', 0.1, 4);
    }
    if (node.fillTexture !== undefined) {
      text(node.fillTexture, 'fillTexture');
      positive(node.capacity, 'capacity', 1);
      const p = object(node.fillOffset, 'fillOffset');
      positive(p.x, 'fill.x', -64, 64);
      positive(p.y, 'fill.y', -64, 64);
    }
  }
  const nodes = data.nodes as SimulationLevel['nodes'];
  for (const node of nodes)
    if (
      node.recipe &&
      !nodes.some(
        (n) => n.id === node.recipe!.destination && n.kind === 'storage',
      )
    )
      throw Error('recipe: brak magazynu docelowego');
  const actorIds = new Set<string>();
  for (const raw of list('actors', 32)) {
    const a = object(raw, 'actor');
    text(a.id, 'actor.id');
    text(a.texture, 'actor.texture');
    text(a.cargoTexture, 'cargoTexture');
    if (ids.has(a.id as string) || actorIds.has(a.id as string))
      throw Error('Powtórzone ID aktora');
    actorIds.add(a.id as string);
    if (!['worker', 'vehicle'].includes(String(a.kind)))
      throw Error('actor.kind: nieznany typ');
    point(a, 'actor');
    positive(a.capacity, 'capacity', 1, 256);
    if (!Number.isInteger(a.capacity))
      throw Error('capacity: wymagana liczba całkowita');
    positive(a.speed, 'speed', 0.1, 12);
    positive(a.loadSeconds, 'loadSeconds', 0.05, 20);
    positive(a.unloadSeconds, 'unloadSeconds', 0.05, 20);
    if (!nodes.some((n) => n.id === a.depot && n.kind === 'depot'))
      throw Error('actor.depot: brak składu');
  }
  if (!actorIds.size) throw Error('Brak aktorów');
  const goal = object(data.goal, 'goal');
  positive(goal.amount, 'goal.amount', 1);
  if (
    !Number.isInteger(goal.amount) ||
    !resources.has(String(goal.resource)) ||
    !nodes.some((n) => n.id === goal.storage && n.kind === 'storage')
  )
    throw Error('Nieprawidłowy cel');
  const camera = object(data.camera, 'camera');
  for (const key of ['zoom', 'minZoom', 'maxZoom'])
    positive(camera[key], key, 0.2, 4);
  point(camera.center, 'camera.center');
  if (
    (camera.minZoom as number) > (camera.zoom as number) ||
    (camera.zoom as number) > (camera.maxZoom as number)
  )
    throw Error('camera: błędne granice zoomu');
  const level = raw as SimulationLevel,
    navigator = new Navigator(level);
  for (const a of level.actors)
    if (!navigator.walkable(a, a.kind === 'vehicle'))
      throw Error(`Zablokowany start: ${a.id}`);
  for (const n of level.nodes)
    if (n.kind !== 'obstacle') {
      if (
        !navigator.walkable(
          n.access,
          n.kind === 'depot' || n.kind === 'processor',
        )
      )
        throw Error(`Zablokowany dostęp: ${n.id}`);
      for (const p of n.workPoints ?? [])
        if (!navigator.walkable(p))
          throw Error(`Zablokowany punkt pracy: ${n.id}`);
    }
  return level;
}
