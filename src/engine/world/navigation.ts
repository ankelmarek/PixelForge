import type { Cell, WorldLevel } from '../simulation/types';
interface Portal {
  to: number;
  exit: Cell;
  entry: Cell;
  crossings: { exit: Cell; entry: Cell }[];
}
interface Region {
  x: number;
  y: number;
  labels: Int32Array;
}
export interface NavigationStats {
  regions: number;
  abstractExpanded: number;
  localExpanded: number;
  maxLocalExpanded: number;
  outcome: 'idle' | 'found' | 'unreachable' | 'budget';
}
/** Static topology is indexed once per movement class. Commands only search the
 * component/portal graph, then bounded local grids. No world-sized A* frontier. */
export class RegionalNavigator {
  stats: NavigationStats = {
    regions: 0,
    abstractExpanded: 0,
    localExpanded: 0,
    maxLocalExpanded: 0,
    outcome: 'idle',
  };
  private regions = new Map<string, Region>();
  private edges = new Map<number, Portal[]>();
  private size: number;
  private built = false;
  constructor(
    readonly level: WorldLevel,
    private walkable: (p: Cell) => boolean,
    private budget = { abstract: 8192, local: 65536 },
  ) {
    this.size = level.terrain.sectorSize;
  }
  private region(p: Cell) {
    return this.regions.get(
      `${Math.floor(p.x / this.size)},${Math.floor(p.y / this.size)}`,
    )!;
  }
  private label(p: Cell) {
    const r = this.region(p);
    return r?.labels[(p.y - r.y) * this.size + p.x - r.x] ?? 0;
  }
  private build() {
    if (this.built) return;
    this.built = true;
    const s = this.size;
    let serial = 0;
    for (let y = 0; y < this.level.height; y += s)
      for (let x = 0; x < this.level.width; x += s) {
        const labels = new Int32Array(s * s);
        for (let i = 0; i < labels.length; i++)
          labels[i] = this.walkable({
            x: x + (i % s),
            y: y + Math.floor(i / s),
          })
            ? -1
            : 0;
        for (let i = 0; i < labels.length; i++) {
          if (labels[i] !== -1) continue;
          const id = ++serial,
            queue = [i];
          labels[i] = id;
          this.edges.set(id, []);
          for (let head = 0; head < queue.length; head++) {
            const at = queue[head],
              cx = at % s,
              cy = Math.floor(at / s);
            for (const [dx, dy] of directions) {
              const nx = cx + dx,
                ny = cy + dy,
                next = ny * s + nx;
              if (nx < 0 || ny < 0 || nx >= s || ny >= s || labels[next] !== -1)
                continue;
              labels[next] = id;
              queue.push(next);
            }
          }
        }
        this.regions.set(`${x / s},${y / s}`, { x, y, labels });
      }
    // One graph edge per connected component pair, with all legal crossings.
    // Choose a nearby crossing at query time to avoid detours to region corners.
    const connected = new Map<string, [Portal, Portal]>();
    const link = (a: Cell, b: Cell) => {
      const left = this.label(a),
        right = this.label(b),
        key = `${left}:${right}`;
      if (!left || !right) return;
      let pair = connected.get(key);
      if (!pair) {
        pair = [
          { to: right, exit: a, entry: b, crossings: [] },
          { to: left, exit: b, entry: a, crossings: [] },
        ];
        connected.set(key, pair);
        this.edges.get(left)!.push(pair[0]);
        this.edges.get(right)!.push(pair[1]);
      }
      pair[0].crossings.push({ exit: a, entry: b });
      pair[1].crossings.push({ exit: b, entry: a });
    };
    for (const r of this.regions.values())
      for (let offset = 0; offset < s; offset++) {
        if (r.x + s < this.level.width)
          link(
            { x: r.x + s - 1, y: r.y + offset },
            { x: r.x + s, y: r.y + offset },
          );
        if (r.y + s < this.level.height)
          link(
            { x: r.x + offset, y: r.y + s - 1 },
            { x: r.x + offset, y: r.y + s },
          );
      }
    this.stats.regions = this.regions.size;
  }
  findPath(from: Cell, to: Cell): Cell[] | null {
    this.build();
    this.stats = {
      ...this.stats,
      abstractExpanded: 0,
      localExpanded: 0,
      maxLocalExpanded: 0,
      outcome: 'unreachable',
    };
    const start = this.label(from),
      finish = this.label(to);
    if (!start || !finish) return null;
    const queue = [start],
      parents = new Map<number, { parent: number; portal: Portal }>();
    const seen = new Set([start]);
    for (let head = 0; head < queue.length && !seen.has(finish); head++) {
      if (++this.stats.abstractExpanded > this.budget.abstract) {
        this.stats.outcome = 'budget';
        return null;
      }
      for (const portal of this.edges.get(queue[head])!)
        if (!seen.has(portal.to)) {
          seen.add(portal.to);
          parents.set(portal.to, { parent: queue[head], portal });
          queue.push(portal.to);
        }
    }
    if (!seen.has(finish)) return null;
    const portals: Portal[] = [];
    for (let id = finish; id !== start;) {
      const step = parents.get(id)!;
      portals.push(step.portal);
      id = step.parent;
    }
    portals.reverse();
    const path: Cell[] = [];
    let at = from;
    for (const portal of portals) {
      const distance = (p: { exit: Cell; entry: Cell }) =>
        Math.abs(at.x - p.exit.x) +
        Math.abs(at.y - p.exit.y) +
        Math.abs(to.x - p.entry.x) +
        Math.abs(to.y - p.entry.y);
      const p = portal.crossings.reduce((best, next) =>
        distance(next) < distance(best) ? next : best,
      );
      const local = this.local(at, p.exit);
      if (!local) return null;
      path.push(...local, p.entry);
      at = p.entry;
    }
    const last = this.local(at, to);
    if (!last) return null;
    path.push(...last);
    this.stats.outcome = 'found';
    return path;
  }
  private local(from: Cell, to: Cell): Cell[] | null {
    const r = this.region(from),
      s = this.size,
      component = this.label(from);
    const index = (p: Cell) => (p.y - r.y) * s + p.x - r.x;
    const point = (i: number) => ({
      x: r.x + (i % s),
      y: r.y + Math.floor(i / s),
    });
    const start = index(from),
      finish = index(to),
      cost = new Float64Array(s * s).fill(Infinity);
    const parents = new Int32Array(s * s).fill(-1),
      open = new MinHeap();
    cost[start] = 0;
    open.push(start, 0);
    const closed = new Uint8Array(s * s);
    let expanded = 0;
    while (open.length) {
      const current = open.pop();
      if (closed[current]) continue;
      closed[current] = 1;
      expanded++;
      this.stats.localExpanded++;
      this.stats.maxLocalExpanded = Math.max(
        this.stats.maxLocalExpanded,
        expanded,
      );
      if (this.stats.localExpanded > this.budget.local) {
        this.stats.outcome = 'budget';
        return null;
      }
      if (current === finish) {
        const path: Cell[] = [];
        for (let at = finish; at !== start; at = parents[at])
          path.push(point(at));
        return path.reverse();
      }
      const x = current % s,
        y = Math.floor(current / s);
      for (const [dx, dy] of directions) {
        const nx = x + dx,
          ny = y + dy,
          next = ny * s + nx;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= s ||
          ny >= s ||
          r.labels[next] !== component ||
          closed[next]
        )
          continue;
        const g = cost[current] + 1;
        if (g >= cost[next]) continue;
        cost[next] = g;
        parents[next] = current;
        open.push(
          next,
          g + Math.abs(r.x + nx - to.x) + Math.abs(r.y + ny - to.y),
        );
      }
    }
    return null;
  }
}
const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
class MinHeap {
  private items: { id: number; score: number }[] = [];
  get length() {
    return this.items.length;
  }
  push(id: number, score: number) {
    const item = { id, score };
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].score <= score) break;
      this.items[i] = this.items[p];
      i = p;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0],
      last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.items.length &&
          this.items[child + 1].score < this.items[child].score
        )
          child++;
        if (last.score <= this.items[child].score) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return first.id;
  }
}
