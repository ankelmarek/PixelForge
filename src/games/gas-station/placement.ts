import {
  inside,
  rectCells,
  ownsAll,
  type Cell,
  type GridRect,
} from '../../engine/api/strategy';
import { PUMPS, SHOP, driveable, walkable, UNIT, type Fuel } from './world';
import {
  ENTRY,
  EXIT,
  PARCELS,
  type Site,
  type SiteKind,
  type Road,
} from './development';
import { footprint, motion, point } from './traffic';
import type { StationState, Motion } from './types';

const key = (p: Cell) => p.y * 256 + p.x;
export const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const offset = (
  p: Cell,
  rotation: number,
  x: number,
  y: number,
): Cell => {
  for (let i = 0; i < rotation; i++) [x, y] = [-y, x];
  return { x: p.x + x, y: p.y + y };
};
export function siteBounds(site: Site): GridRect {
  const size = site.kind === 'heavy-pump' ? 16 : site.kind === 'tank' ? 6 : 10;
  return {
    x: site.point.x - size / 2,
    y: site.point.y - size / 2,
    width: size,
    height: size,
  };
}
export function island(site: Site) {
  const center = offset(
    site.point,
    site.rotation,
    site.kind === 'heavy-pump' ? -6 : -3,
    0,
  );
  return site.kind === 'tank'
    ? siteBounds(site)
    : site.kind === 'parking'
      ? null
      : {
          x: center.x - (site.rotation % 2 ? 1 : 0),
          y: center.y - (site.rotation % 2 ? 0 : 1),
          width: site.rotation % 2 ? 3 : 1,
          height: site.rotation % 2 ? 1 : 3,
        };
}
export const port = (p: Cell, kind: Motion['kind'], site?: Site) =>
  offset(p, site?.rotation ?? 0, kind === 'truck' ? 5 : 3, 0);
export const servicePort = (site: Site) =>
  site.kind === 'tank'
    ? offset(site.point, site.rotation, 4, 0)
    : offset(
        site.point,
        site.rotation,
        site.kind === 'heavy-pump' ? -6 : -3,
        -3,
      );
export interface BuildRequest {
  kind: SiteKind | 'road' | 'remove-road';
  point: Cell;
  to?: Cell;
  rotation: number;
  fuel: Fuel;
  roadId?: string;
}
export interface BuildPlan {
  valid: boolean;
  reason: string;
  cost: number;
  revision: number;
  bounds: GridRect;
}
/** Small directed lane graph. Only player roads are indexed; no whole-world search per car. */
export class StationTopology {
  private asphalt = new Set<number>();
  private obstacles = new Set<number>();
  private edges = new Map<number, number[]>();
  expanded = 0;
  constructor(readonly state: StationState) {
    for (const road of state.development?.roads ?? []) {
      const cells = roadLine(road.from, road.to);
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        for (const c of rectCells({
          x: p.x - 5,
          y: p.y - 5,
          width: 10,
          height: 10,
        }))
          this.asphalt.add(key(c));
        if (i < cells.length - 1) {
          const a = key(p),
            b = key(cells[i + 1]);
          this.edges.set(
            a,
            [...new Set([...(this.edges.get(a) ?? []), b])].sort(
              (a, b) => a - b,
            ),
          );
        }
      }
    }
    for (const site of state.development?.sites ?? []) {
      const obstacle = island(site);
      if (obstacle)
        for (const p of rectCells(obstacle)) this.obstacles.add(key(p));
    }
  }
  pedestrian = (p: Cell) => {
    if (this.obstacles.has(key(p))) return false;
    if (PUMPS.some((q) => p.x === q.x - 3 && Math.abs(p.y - q.y) <= 1))
      return false;
    if (walkable(p)) return true;
    if (inside(p, SHOP)) return false;
    return (
      !!this.state.development &&
      PARCELS.some(
        (r) => this.state.development!.parcels.includes(r.id) && inside(p, r),
      )
    );
  };
  vehicle = (p: Cell) =>
    p.x >= 0 &&
    p.x < 256 &&
    p.y >= 0 &&
    p.y < 256 &&
    !this.obstacles.has(key(p)) &&
    (driveable(p) || this.asphalt.has(key(p)));
  legal = (m: Motion, cells: Cell[]) =>
    cells.every(m.kind === 'person' ? this.pedestrian : this.vehicle);
  route(from: Cell, to: Cell, kind: Motion['kind'] = 'car'): Cell[] | null {
    this.expanded = 0;
    if (same(from, to)) return [];
    const start = key(from),
      finish = key(to),
      queue = [start],
      parents = new Map<number, number>([[start, -1]]);
    for (let i = 0; i < queue.length && i < 4096; i++) {
      this.expanded++;
      for (const n of this.edges.get(queue[i]) ?? []) {
        if (parents.has(n)) continue;
        const p = { x: n % 256, y: Math.floor(n / 256) };
        if (
          !this.legal(
            motion('route', kind, p),
            footprint(motion('route', kind, p)),
          )
        )
          continue;
        parents.set(n, queue[i]);
        if (n === finish) {
          const route: Cell[] = [];
          for (let at = n; at !== start; at = parents.get(at)!)
            route.push({ x: at % 256, y: Math.floor(at / 256) });
          return route.reverse();
        }
        queue.push(n);
      }
    }
    return null;
  }
  connections() {
    return (this.state.development?.sites ?? []).every(
      (site) =>
        site.kind === 'tank' ||
        (this.route(
          ENTRY,
          site.point,
          site.kind === 'heavy-pump' ? 'truck' : 'car',
        ) !== null &&
          this.route(
            site.point,
            EXIT,
            site.kind === 'heavy-pump' ? 'truck' : 'car',
          ) !== null),
    );
  }
  preserves(m: Motion) {
    if (!this.legal(m, footprint(m))) return false;
    let previous = point(m);
    for (const p of m.route) {
      const dx = p.x - previous.x,
        dy = p.y - previous.y,
        steps = Math.ceil(Math.abs(dx || dy));
      for (let i = 1; i <= steps; i++) {
        const x = previous.x + (dx * i) / steps,
          y = previous.y + (dy * i) / steps;
        if (
          !this.legal(
            m,
            footprint(m, Math.round(x * UNIT), Math.round(y * UNIT)),
          )
        )
          return false;
      }
      previous = p;
    }
    return true;
  }
}
export function roadLine(from: Cell, to: Cell): Cell[] {
  if (from.x !== to.x && from.y !== to.y) return [];
  const dx = Math.sign(to.x - from.x),
    dy = Math.sign(to.y - from.y),
    length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  return Array.from({ length: length + 1 }, (_, i) => ({
    x: from.x + dx * i,
    y: from.y + dy * i,
  }));
}
export function roadBounds(road: Pick<Road, 'from' | 'to'>): GridRect {
  return {
    x: Math.min(road.from.x, road.to.x) - 5,
    y: Math.min(road.from.y, road.to.y) - 5,
    width: Math.abs(road.to.x - road.from.x) + 10,
    height: Math.abs(road.to.y - road.from.y) + 10,
  };
}
export function preview(
  s: StationState,
  request: BuildRequest,
  cash: number,
  actors: Motion[],
): BuildPlan {
  const d = s.development,
    p = request.point;
  const base = {
    revision: s.topology,
    cost: 0,
    bounds: { x: p.x, y: p.y, width: 1, height: 1 },
  };
  const reject = (reason: string): BuildPlan => ({
    ...base,
    valid: false,
    reason,
  });
  if (!d || s.result) return reject('Niedostępne w tej zmianie');
  if (
    !['pump', 'heavy-pump', 'parking', 'tank', 'road', 'remove-road'].includes(
      request.kind,
    ) ||
    ![p.x, p.y].every((v) => Number.isSafeInteger(v) && v >= 8 && v < 248) ||
    ![0, 1, 2, 3].includes(request.rotation) ||
    !['e95', 'on'].includes(request.fuel)
  )
    return reject('Nieprawidłowy projekt');
  const next = structuredClone(s),
    nd = next.development!;
  if (request.kind === 'road') {
    const to = request.to;
    if (
      !to ||
      ![to.x, to.y].every((v) => Number.isSafeInteger(v) && v >= 8 && v < 248)
    )
      return reject('Koniec drogi');
    const line = roadLine(p, to);
    if (line.length < 3 || line.length > 65 || d.roads.length >= 64)
      return reject('Droga: prosty odcinek 2–64 pól');
    if (
      d.roads.some((r) =>
        roadLine(r.from, r.to).some(
          (c, i, a) =>
            i &&
            line.some((q, j) => j && same(q, a[i - 1]) && same(line[j - 1], c)),
        ),
      )
    )
      return reject('Przeciwny kierunek');
    const road = {
      id: `road-${s.serial}`,
      from: p,
      to,
      cost: (line.length - 1) * 500,
    };
    base.bounds = roadBounds(road);
    base.cost = road.cost;
    if (d.roads.some((r) => same(r.from, p) && same(r.to, to)))
      return reject('Droga istnieje');
    nd.roads.push(road);
  } else if (request.kind === 'remove-road') {
    const road = d.roads.find((r) => r.id === request.roadId);
    if (!road) return reject('Brak drogi');
    base.bounds = roadBounds(road);
    nd.roads = nd.roads.filter((r) => r.id !== road.id);
  } else {
    if (d.sites.length >= 24) return reject('Limit obiektów');
    const cost = {
      pump: 180000,
      'heavy-pump': 240000,
      parking: 20000,
      tank: 120000,
    }[request.kind];
    const site: Site = {
      id: `site-${s.serial}`,
      kind: request.kind,
      point: p,
      rotation: request.rotation,
      cost,
      progress: 300,
      fuel: request.fuel,
    };
    base.bounds = siteBounds(site);
    base.cost = cost;
    if (inside(p, PARCELS[0])) return reject('Strefa ruchu stacji');
    if (
      d.sites.some((a) =>
        rectCells(base.bounds).some((c) => inside(c, siteBounds(a))),
      )
    )
      return reject('Obiekt w tym miejscu');
    nd.sites.push(site);
  }
  if (base.cost > cash) return reject('Brak środków');
  if (
    request.kind !== 'remove-road' &&
    !ownsAll(
      rectCells(base.bounds),
      PARCELS.filter((p) => d.parcels.includes(p.id)),
    )
  )
    return reject('Teren niewłasny');
  if (
    request.kind === 'road' &&
    rectCells(base.bounds).some(
      (p) =>
        inside(p, SHOP) ||
        PUMPS.some((q) => p.x === q.x - 3 && Math.abs(p.y - q.y) <= 1),
    )
  )
    return reject('Budynek na trasie');
  const topology = new StationTopology(next);
  if (!topology.connections()) return reject('Brak dojazdu lub wyjazdu');
  const cells = rectCells(base.bounds),
    changedStructure = request.kind !== 'road';
  if (
    changedStructure &&
    actors.some((m) => footprint(m).some((p) => cells.some((c) => same(c, p))))
  )
    return reject('Miejsce zajęte');
  if (changedStructure && actors.some((m) => !topology.preserves(m)))
    return reject('Trasa w użyciu');
  if (request.kind === 'tank') {
    const access = offset(p, request.rotation, 4, 0);
    if (!topology.pedestrian(access))
      return reject('Brak dojścia do zbiornika');
  }
  return { ...base, valid: true, reason: '' };
}
