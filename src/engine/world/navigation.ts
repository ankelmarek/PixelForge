import type { Cell, GridRect } from '../simulation/types';
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
  revision: number;
  components: number[];
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
  private serial = 0;
  private revision = 0;
  lastRebuilt = 0;
  constructor(
    readonly level: {
      width: number;
      height: number;
      terrain: { sectorSize: number };
    },
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
  /** Builds a bounded number of regions during loading; commands never scan world cells. */
  prepare(regionBudget = 4): boolean {
    if (this.built) return true;
    const columns = Math.ceil(this.level.width / this.size);
    const total = columns * Math.ceil(this.level.height / this.size);
    for (let n = 0; n < regionBudget && this.regions.size < total; n++) {
      const index = this.regions.size;
      this.buildRegion(
        (index % columns) * this.size,
        Math.floor(index / columns) * this.size,
      );
    }
    if (this.regions.size < total) return false;
    for (const r of this.regions.values()) this.linkRegion(r, false);
    this.built = true;
    this.stats.regions = this.regions.size;
    return true;
  }
  private build() {
    while (!this.prepare(32)) {
      /* compatibility for synchronous clients */
    }
  }
  private buildRegion(x: number, y: number) {
    const s = this.size,
      labels = new Int32Array(s * s),
      components: number[] = [];
    for (let i = 0; i < labels.length; i++) {
      const p = { x: x + (i % s), y: y + Math.floor(i / s) };
      labels[i] =
        p.x < this.level.width && p.y < this.level.height && this.walkable(p)
          ? -1
          : 0;
    }
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== -1) continue;
      const id = ++this.serial,
        queue = [i];
      labels[i] = id;
      components.push(id);
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
    this.regions.set(`${x / s},${y / s}`, {
      x,
      y,
      labels,
      components,
      revision: ++this.revision,
    });
  }
  private linkRegion(r: Region, allSides: boolean) {
    const s = this.size;
    const neighbors = allSides ? directions : directions.slice(0, 2);
    for (const [dx, dy] of neighbors) {
      const neighbor = this.regions.get(`${r.x / s + dx},${r.y / s + dy}`);
      if (!neighbor) continue;
      const pairs = new Map<string, [Portal, Portal]>();
      for (let i = 0; i < s; i++) {
        const a = {
          x: r.x + (dx ? (dx > 0 ? s - 1 : 0) : i),
          y: r.y + (dy ? (dy > 0 ? s - 1 : 0) : i),
        };
        const b = { x: a.x + dx, y: a.y + dy },
          left = this.label(a),
          right = this.label(b);
        if (
          !left ||
          !right ||
          this.edges.get(left)!.some((e) => e.to === right)
        )
          continue;
        const key = `${left}:${right}`;
        let pair = pairs.get(key);
        if (!pair) {
          pair = [
            { to: right, exit: a, entry: b, crossings: [] },
            { to: left, exit: b, entry: a, crossings: [] },
          ];
          pairs.set(key, pair);
        }
        pair[0].crossings.push({ exit: a, entry: b });
        pair[1].crossings.push({ exit: b, entry: a });
      }
      for (const [a, b] of pairs.values()) {
        this.edges.set(b.to, [...this.edges.get(b.to)!, a]);
        this.edges.set(a.to, [...this.edges.get(a.to)!, b]);
      }
    }
  }
  revisionAt(p: Cell) {
    return this.region(p)?.revision ?? 0;
  }
  /** Labels/portals are immutable after publication, so previews share unaffected sectors. */
  fork(walkable: (p: Cell) => boolean) {
    this.build();
    const copy = new RegionalNavigator(this.level, walkable, this.budget);
    copy.regions = new Map(this.regions);
    copy.edges = new Map(this.edges);
    copy.built = true;
    copy.serial = this.serial;
    copy.revision = this.revision;
    copy.stats = { ...this.stats };
    return copy;
  }
  invalidate(bounds: GridRect, halo = 0) {
    this.build();
    const affected: Region[] = [];
    const s = this.size;
    for (
      let y = Math.max(0, Math.floor((bounds.y - halo) / s));
      y <=
      Math.min(
        Math.ceil(this.level.height / s) - 1,
        Math.floor((bounds.y + bounds.height - 1 + halo) / s),
      );
      y++
    )
      for (
        let x = Math.max(0, Math.floor((bounds.x - halo) / s));
        x <=
        Math.min(
          Math.ceil(this.level.width / s) - 1,
          Math.floor((bounds.x + bounds.width - 1 + halo) / s),
        );
        x++
      ) {
        const r = this.regions.get(`${x},${y}`)!;
        affected.push(r);
        for (const id of r.components) {
          for (const edge of this.edges.get(id) ?? [])
            this.edges.set(
              edge.to,
              (this.edges.get(edge.to) ?? []).filter((e) => e.to !== id),
            );
          this.edges.delete(id);
        }
      }
    for (const r of affected) this.buildRegion(r.x, r.y);
    for (const r of affected) this.linkRegion(this.region(r), true);
    this.lastRebuilt = affected.length;
  }
  findPath(from: Cell, to: Cell): Cell[] | null {
    this.build();
    if (
      ![from, to].every(
        (p) =>
          Number.isInteger(p.x) &&
          Number.isInteger(p.y) &&
          p.x >= 0 &&
          p.y >= 0 &&
          p.x < this.level.width &&
          p.y < this.level.height,
      )
    )
      return null;
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
