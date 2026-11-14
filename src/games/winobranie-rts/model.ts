import {
  RegionalNavigator,
  ScenarioClock,
  Ledger,
  Inventory,
  Reservations,
  ownsAll,
  lineCells,
  rectCells,
  type Cell,
  type GridRect,
  type LedgerState,
} from '../../engine/api/strategy';
import {
  type VineyardWorld,
  type Variety,
  varieties,
  terrainBlocked,
  publicRoad,
} from './world';

export type Tool =
  'select' | 'box' | 'row' | 'road' | 'house' | 'remove' | 'move' | 'parcel';
export type Role = 'auto' | 'harvest' | 'press' | 'build' | 'rest';
export interface Row {
  id: string;
  cells: Cell[];
  variety: Variety;
  stock: number;
  vines: number;
  planted: number;
  work: number;
  mature: boolean;
  access: Cell;
}
export interface Building extends GridRect {
  id: string;
  rotation: number;
  access: Cell;
  dock: Cell;
  work: number;
  stock: Record<string, number>;
  must: Record<string, number>;
  batch: {
    variety: Variety;
    amount: number;
    work: number;
    remaining: number;
  } | null;
}
export interface Job {
  kind: 'harvest' | 'build' | 'press' | 'deposit' | 'load' | 'unload' | 'move';
  target: string;
  goal: Cell;
  progress: number;
  amount: number;
  variety: Variety;
}
export interface Unit extends Cell {
  id: string;
  kind: 'worker' | 'tractor';
  role: Role;
  cargo: Record<string, number>;
  job: Job | null;
  path: Cell[];
  blocked: boolean;
  routeRevision: number;
}
export interface VineyardState {
  version: 1;
  revision: 'vineyard-w1';
  tick: number;
  clock: { speed: 1 | 2 | 4; remainder: number };
  serial: number;
  topology: number;
  ledger: LedgerState;
  vouchers: number;
  rows: Row[];
  buildings: Building[];
  roads: Cell[];
  parcels: GridRect[];
  units: Unit[];
  warehouse: Record<string, number>;
  sold: number;
  processed: number;
  grown: number;
  lost: number;
  completed: boolean;
  failed: boolean;
}
export interface Plan {
  tool: Tool;
  cells: Cell[];
  cost: number;
  valid: boolean;
  reason: string;
  revision: number;
  from: Cell;
  to: Cell;
  rotation: number;
  variety: Variety;
  moving?: string;
  access?: Cell;
}
export const DEPOT = { x: 248, y: 258 },
  STORE: GridRect = { x: 244, y: 250, width: 8, height: 6 };
const key = (p: Cell) => `${p.x},${p.y}`;
const rounded = (p: Cell) => ({ x: Math.round(p.x), y: Math.round(p.y) });
const total = (s: Record<string, number>) =>
  Object.values(s).reduce((a, b) => a + b, 0);
const sum = (a: number, b: number) => a + b;
const near = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
const bounds = (cells: Cell[]): GridRect => {
  const x = Math.min(...cells.map((p) => p.x)),
    y = Math.min(...cells.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...cells.map((p) => p.x)) - x + 1,
    height: Math.max(...cells.map((p) => p.y)) - y + 1,
  };
};
export function houseAt(p: Cell, rotation: number): Building {
  const width = rotation % 2 ? 6 : 8,
    height = rotation % 2 ? 8 : 6;
  const x = p.x - Math.floor(width / 2),
    y = p.y - Math.floor(height / 2);
  const dock = [
    { x: x + 4, y: y + 8 },
    { x: x - 3, y: y + 4 },
    { x: x + 4, y: y - 3 },
    { x: x + 8, y: y + 4 },
  ][rotation];
  const access = [
    { x: x + 4, y: y + 6 },
    { x: x - 1, y: y + 4 },
    { x: x + 4, y: y - 1 },
    { x: x + 6, y: y + 4 },
  ][rotation];
  return {
    id: '',
    x,
    y,
    width,
    height,
    rotation,
    access,
    dock,
    work: 120,
    stock: {},
    must: {},
    batch: null,
  };
}
export class VineyardModel {
  state!: VineyardState;
  readonly clock = new ScenarioClock();
  human!: RegionalNavigator;
  vehicle!: RegionalNavigator;
  private blocked = new Uint8Array(512 * 512);
  private road = new Uint8Array(512 * 512);
  private reservations = new Reservations();
  lastReason = '';
  constructor(readonly world: VineyardWorld) {
    this.reset();
  }
  reset() {
    this.state = {
      version: 1,
      revision: 'vineyard-w1',
      tick: 0,
      clock: { speed: 1, remainder: 0 },
      serial: 10,
      topology: 0,
      ledger: new Ledger(3000000).state,
      vouchers: 2,
      rows: [],
      buildings: [],
      roads: [],
      parcels: [{ x: 208, y: 208, width: 96, height: 96 }],
      warehouse: {},
      units: [
        { id: 'worker-1', kind: 'worker', x: 234, y: 250, role: 'auto' },
        { id: 'worker-2', kind: 'worker', x: 236, y: 250, role: 'auto' },
        { id: 'tractor-1', kind: 'tractor', x: 242, y: 258, role: 'auto' },
      ].map((u) => ({
        ...u,
        cargo: {},
        job: null,
        path: [],
        blocked: false,
        routeRevision: 0,
      })) as Unit[],
      sold: 0,
      processed: 0,
      grown: 96000,
      lost: 0,
      completed: false,
      failed: false,
    };
    (Object.keys(varieties) as Variety[]).forEach((variety, i) => {
      const cells = lineCells(
        { x: 232, y: 238 + 4 * i },
        { x: 262, y: 238 + 4 * i },
      );
      this.state.rows.push({
        id: `row-${i}`,
        cells,
        variety,
        stock: 32000,
        vines: 16,
        planted: 0,
        work: 0,
        mature: true,
        access: { x: 232, y: 239 + 4 * i },
      });
    });
    this.clock.remainder = 0;
    this.clock.speed = 1;
    this.clock.paused = false;
    this.rebuild();
  }
  private rebuild() {
    this.blocked.fill(0);
    this.road.fill(0);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const i = y * 512 + x;
        this.blocked[i] = Number(terrainBlocked(x, y));
        this.road[i] = Number(publicRoad(x, y));
      }
    for (const p of rectCells(STORE)) this.blocked[p.y * 512 + p.x] = 1;
    for (const row of this.state.rows)
      for (const p of row.cells) this.blocked[p.y * 512 + p.x] = 1;
    for (const b of this.state.buildings)
      for (const p of rectCells(b)) this.blocked[p.y * 512 + p.x] = 1;
    for (const p of this.state.roads) this.road[p.y * 512 + p.x] = 1;
    this.human = new RegionalNavigator(this.world, (p) => this.walkable(p));
    this.vehicle = new RegionalNavigator(this.world, (p) =>
      this.walkable(p, true),
    );
    this.reservations = new Reservations();
    for (const u of this.state.units) if (u.job) this.reserve(u, u.job);
  }
  prepare(budget = 4) {
    const a = this.human.prepare(budget),
      b = this.vehicle.prepare(budget);
    return a && b;
  }
  walkable(
    p: Cell,
    vehicle = false,
    blocks?: Set<string>,
    roads?: Set<string>,
    cleared?: Set<string>,
  ) {
    for (let dy = vehicle ? -1 : 0; dy <= (vehicle ? 1 : 0); dy++)
      for (let dx = vehicle ? -1 : 0; dx <= (vehicle ? 1 : 0); dx++) {
        const q = { x: p.x + dx, y: p.y + dy },
          i = q.y * 512 + q.x;
        if (
          q.x < 0 ||
          q.y < 0 ||
          q.x >= 512 ||
          q.y >= 512 ||
          blocks?.has(key(q)) ||
          (this.blocked[i] && !cleared?.has(key(q))) ||
          (vehicle && !this.road[i] && !roads?.has(key(q)))
        )
          return false;
      }
    return true;
  }
  preview(
    tool: Tool,
    from: Cell,
    to = from,
    rotation = 0,
    variety: Variety = 'solaris',
    moving?: string,
  ): Plan {
    if (
      ![from.x, from.y, to.x, to.y].every(
        (n) => Number.isFinite(n) && n >= 0 && n < 512,
      ) ||
      !Number.isInteger(rotation) ||
      rotation < 0 ||
      rotation > 3 ||
      !Object.hasOwn(varieties, variety) ||
      !['row', 'road', 'house', 'move'].includes(tool)
    )
      return {
        tool,
        cells: [],
        cost: 0,
        valid: false,
        reason: 'Niepoprawny plan',
        revision: this.state.topology,
        from,
        to,
        rotation,
        variety,
      };
    const a = rounded(from),
      b = rounded(to);
    let cells = [a],
      cost = 0,
      reason = '';
    const building = houseAt(a, rotation);
    if (tool === 'house' || tool === 'move') {
      cells = rectCells(building);
      cost = tool === 'move' ? 100000 : 0;
    }
    if (tool === 'row' || tool === 'road') {
      if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 63)
        reason = 'Maks. 64 pola';
      else cells = lineCells(a, b);
      if (tool === 'row') cost = Math.ceil(cells.length / 2) * 3000;
      else {
        const expanded = new Map<string, Cell>();
        for (const p of cells)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const q = { x: p.x + dx, y: p.y + dy };
              expanded.set(key(q), q);
            }
        cells = [...expanded.values()].filter(
          (p) => !publicRoad(p.x, p.y) && !this.road[p.y * 512 + p.x],
        );
        cost = cells.length * 400;
      }
    }
    const plan = {
      tool,
      cells,
      cost,
      valid: false,
      reason,
      revision: this.state.topology,
      from: a,
      to: b,
      rotation,
      variety,
      moving,
    };
    const reject = (why: string) => ({ ...plan, reason: why });
    if (reason) return plan;
    if (!cells.length) return reject('Droga istnieje');
    if (!ownsAll(cells, this.state.parcels)) return reject('Cudza parcela');
    if (this.state.completed || this.state.failed)
      return reject('Sezon zakończony');
    if (
      tool === 'house' &&
      (!this.state.vouchers || this.state.buildings.length >= 32)
    )
      return reject('Brak uprawnień');
    if (tool === 'row' && this.state.rows.length >= 64)
      return reject('Limit rzędów');
    if (tool === 'road' && this.state.roads.length + cells.length > 10000)
      return reject('Limit dróg');
    if (cost > this.state.ledger.balance) return reject('Brak środków');
    const old = this.state.buildings.find((item) => item.id === moving);
    if (tool === 'move' && (!old || !this.idle(old)))
      return reject('Domek zajęty');
    const cleared = old ? new Set(rectCells(old).map(key)) : undefined;
    if (
      cells.some(
        (p) =>
          !this.walkable(p, false, undefined, undefined, cleared) ||
          (tool !== 'road' && this.road[p.y * 512 + p.x]),
      )
    )
      return reject('Zajęte pole');
    if (cells.some((p) => p.x > 350 && p.y < 180)) return reject('Stromy stok');
    if (
      this.state.units.some((u) =>
        cells.some(
          (p) =>
            Math.abs(p.x - u.x) <= (u.kind === 'tractor' ? 1.5 : 0.6) &&
            Math.abs(p.y - u.y) <= (u.kind === 'tractor' ? 1.5 : 0.6),
        ),
      )
    )
      return reject('Jednostka na placu');
    const blocks = new Set(tool === 'road' ? [] : cells.map(key)),
      roads = new Set(tool === 'road' ? cells.map(key) : []);
    const human = this.human.fork((p) =>
      this.walkable(p, false, blocks, roads, cleared),
    );
    const vehicle = this.vehicle.fork((p) =>
      this.walkable(p, true, blocks, roads, cleared),
    );
    for (const area of old ? [bounds(cells), old] : [bounds(cells)]) {
      human.invalidate(area);
      vehicle.invalidate(area, 1);
    }
    const ports = this.state.buildings.filter((item) => item.id !== moving);
    if (tool === 'house' || tool === 'move') ports.push(building);
    for (const port of ports)
      if (
        !human.findPath(DEPOT, port.access) ||
        !vehicle.findPath(DEPOT, port.dock)
      )
        return reject('Brak dojazdu');
    for (const u of this.state.units)
      if (!(u.kind === 'tractor' ? vehicle : human).findPath(rounded(u), DEPOT))
        return reject('Odcięta jednostka');
    for (const row of this.state.rows)
      if (!human.findPath(DEPOT, row.access)) return reject('Odcięty rząd');
    let access: Cell | undefined;
    if (tool === 'row') {
      for (const cell of cells) {
        access = [
          [0, 1],
          [-1, 0],
          [1, 0],
          [0, -1],
        ]
          .map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
          .find((point) => human.findPath(DEPOT, point) !== null);
        if (access) break;
      }
      if (!access) return reject('Brak dojścia');
    }
    return { ...plan, access, valid: true, reason: '' };
  }
  commit(plan: Plan) {
    if (plan.revision !== this.state.topology) return false;
    const current = this.preview(
      plan.tool,
      plan.from,
      plan.to,
      plan.rotation,
      plan.variety,
      plan.moving,
    );
    if (!current.valid) {
      this.lastReason = current.reason;
      return false;
    }
    const id = `object-${this.state.serial}`;
    if (!new Ledger(this.state.ledger).transact(id, -current.cost))
      return false;
    this.state.serial++;
    const cells = current.cells;
    const areas = [bounds(cells)];
    if (plan.tool === 'house' || plan.tool === 'move') {
      const b = houseAt(current.from, current.rotation);
      b.id = id;
      if (plan.tool === 'move') {
        const old = this.state.buildings.find(
          (item) => item.id === plan.moving,
        )!;
        for (const p of rectCells(old)) this.blocked[p.y * 512 + p.x] = 0;
        areas.push(old);
        b.id = old.id;
        this.state.buildings = this.state.buildings.filter(
          (item) => item !== old,
        );
      } else this.state.vouchers--;
      this.state.buildings.push(b);
    } else if (plan.tool === 'row') {
      this.state.rows.push({
        id,
        cells,
        variety: plan.variety,
        stock: 0,
        vines: Math.ceil(cells.length / 2),
        work: Math.ceil(cells.length / 2) * 8,
        planted: -1,
        mature: false,
        access: current.access!,
      });
    } else if (plan.tool === 'road') this.state.roads.push(...cells);
    for (const p of cells)
      (plan.tool === 'road' ? this.road : this.blocked)[p.y * 512 + p.x] = 1;
    this.changed(...areas);
    return true;
  }
  private changed(...areas: GridRect[]) {
    this.state.topology++;
    for (const area of areas) {
      this.human.invalidate(area);
      this.vehicle.invalidate(area, 1);
    }
    for (const u of this.state.units) {
      const touched = [u, ...u.path, ...(u.job ? [u.job.goal] : [])].some((p) =>
        areas.some(
          (a) =>
            p.x >= a.x - 1 &&
            p.x < a.x + a.width + 1 &&
            p.y >= a.y - 1 &&
            p.y < a.y + a.height + 1,
        ),
      );
      if (!touched && !u.blocked) u.routeRevision = this.state.topology;
      else this.route(u);
    }
  }
  idle(b: Building) {
    return (
      !b.work &&
      !b.batch &&
      !total(b.stock) &&
      !total(b.must) &&
      !this.state.units.some((u) => u.job?.target === b.id)
    );
  }
  remove(id: string) {
    if (this.state.completed || this.state.failed) return false;
    const row = this.state.rows.find((r) => r.id === id),
      b = this.state.buildings.find((r) => r.id === id);
    if (
      (!row && !b) ||
      (b && !this.idle(b)) ||
      this.state.units.some((u) => u.job?.target === id)
    )
      return false;
    const cells = row ? row.cells : rectCells(b!);
    if (row) {
      this.state.lost += row.stock;
      this.state.rows = this.state.rows.filter((r) => r !== row);
    } else this.state.buildings = this.state.buildings.filter((r) => r !== b);
    new Ledger(this.state.ledger).transact(
      `remove-${this.state.serial++}`,
      row && !row.mature ? row.vines * 300 : 0,
    );
    for (const p of cells) this.blocked[p.y * 512 + p.x] = 0;
    this.changed(bounds(cells));
    return true;
  }
  removeRoad(p: Cell) {
    if (this.state.completed || this.state.failed) return false;
    const cells = this.state.roads.filter(
      (q) => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1,
    );
    if (!cells.length) return false;
    const remaining = new Set(
      this.state.roads
        .filter((q) => !cells.some((c) => key(c) === key(q)))
        .map(key),
    );
    const nav = this.vehicle.fork((q) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (
            !publicRoad(q.x + dx, q.y + dy) &&
            !remaining.has(key({ x: q.x + dx, y: q.y + dy }))
          )
            return false;
      return this.walkable(q, true);
    });
    nav.invalidate(bounds(cells), 1);
    if (
      this.state.buildings.some((b) => !nav.findPath(DEPOT, b.dock)) ||
      this.state.units.some(
        (u) => u.kind === 'tractor' && !nav.findPath(rounded(u), DEPOT),
      )
    )
      return false;
    this.state.roads = this.state.roads.filter((q) => remaining.has(key(q)));
    for (const c of cells) this.road[c.y * 512 + c.x] = 0;
    this.changed(bounds(cells));
    return true;
  }
  buyParcel(p: Cell) {
    if (this.state.completed || this.state.failed) return false;
    if (this.state.parcels.length >= 16) return false;
    const parcel = {
      x: 208 + Math.floor((p.x - 208) / 96) * 96,
      y: 208 + Math.floor((p.y - 208) / 96) * 96,
      width: 96,
      height: 96,
    };
    if (
      parcel.x < 16 ||
      parcel.y < 16 ||
      parcel.x + 96 > 496 ||
      parcel.y + 96 > 496 ||
      this.state.parcels.some((r) => r.x === parcel.x && r.y === parcel.y) ||
      !this.state.parcels.some(
        (r) => Math.abs(r.x - parcel.x) + Math.abs(r.y - parcel.y) === 96,
      )
    )
      return false;
    if (
      !new Ledger(this.state.ledger).transact(
        `parcel-${this.state.serial}`,
        -600000,
      )
    )
      return false;
    this.state.serial++;
    this.state.parcels.push(parcel);
    this.state.topology++;
    return true;
  }
  sell(id: string) {
    if (this.state.completed || this.state.failed) return false;
    const b = this.state.buildings.find((item) => item.id === id);
    if (!b || !total(b.must) || !this.vehicle.findPath(DEPOT, b.dock))
      return false;
    const amount = total(b.must),
      value = Object.entries(b.must).reduce(
        (n, [v, ml]) =>
          n + Math.floor((ml * varieties[v as Variety].price) / 10),
        0,
      );
    if (
      !new Ledger(this.state.ledger).transact(
        `sale-${this.state.serial++}`,
        value,
      )
    )
      return false;
    b.must = {};
    this.state.sold += amount;
    return true;
  }
  role(ids: string[], role: Role) {
    if (this.state.completed || this.state.failed) return;
    for (const u of this.state.units.filter((u) => ids.includes(u.id))) {
      this.reservations.release(u.id);
      u.job = null;
      u.path = [];
      u.role = role;
      u.blocked = false;
      if (total(u.cargo))
        this.assign(u, this.job('deposit', 'warehouse', DEPOT));
    }
  }
  order(ids: string[], target: string | null, point: Cell) {
    if (this.state.completed || this.state.failed) return;
    for (const u of this.state.units.filter((u) => ids.includes(u.id))) {
      if (total(u.cargo)) continue;
      const row = this.state.rows.find((r) => r.id === target),
        b = this.state.buildings.find((b) => b.id === target);
      this.reservations.release(u.id);
      u.job = null;
      u.path = [];
      u.blocked = false;
      if (u.kind === 'worker' && row && !row.work && row.stock) {
        u.role = 'harvest';
        this.assign(
          u,
          this.job(
            'harvest',
            row.id,
            row.access,
            Math.min(1000, row.stock),
            row.variety,
          ),
        );
      } else if (u.kind === 'worker' && b) {
        u.role = b.work ? 'build' : 'press';
      } else if (u.kind === 'tractor' && b) u.role = 'auto';
      else {
        u.role = 'rest';
        this.assign(u, this.job('move', '', rounded(point)));
      }
    }
  }
  private job(
    kind: Job['kind'],
    target: string,
    goal: Cell,
    amount = 0,
    variety: Variety = 'solaris',
  ): Job {
    return { kind, target, goal: { ...goal }, progress: 0, amount, variety };
  }
  private reserve(u: Unit, j: Job) {
    if (j.kind === 'harvest')
      return this.reservations.reserve(
        u.id,
        j.target,
        j.amount,
        this.state.rows.find((r) => r.id === j.target)?.stock ?? 0,
      );
    if (j.kind === 'build' || j.kind === 'press')
      return this.reservations.reserve(u.id, j.target, 1, 1);
    return true;
  }
  private assign(u: Unit, job: Job) {
    if (!this.reserve(u, job)) return false;
    u.job = job;
    this.route(u);
    return true;
  }
  private route(u: Unit) {
    if (!u.job) return;
    const nav = u.kind === 'tractor' ? this.vehicle : this.human;
    const path = nav.findPath(rounded(u), u.job.goal);
    u.routeRevision = this.state.topology;
    u.blocked = !path;
    u.path = path ?? [];
    // Preserve an in-flight fractional position: reach its nearest legal cell first.
    if (path && !near(u, rounded(u))) u.path.unshift(rounded(u));
  }
  private finish(u: Unit) {
    this.reservations.release(u.id);
    u.job = null;
    u.path = [];
    u.blocked = false;
  }
  private choose(u: Unit) {
    if (total(u.cargo)) {
      if (u.kind === 'tractor') {
        const b = this.state.buildings
          .filter((b) => !b.work && total(b.stock) + total(u.cargo) <= 48000)
          .sort((a, b) => total(a.stock) - total(b.stock))[0];
        if (b) this.assign(u, this.job('unload', b.id, b.dock));
      } else this.assign(u, this.job('deposit', 'warehouse', DEPOT));
      return;
    }
    if (u.role === 'rest') return;
    if (u.kind === 'tractor') {
      if (!this.state.buildings.some((b) => !b.work && total(b.stock) < 32000))
        return;
      const v = (Object.keys(varieties) as Variety[]).find(
        (v) => (this.state.warehouse[v] ?? 0) > 0,
      );
      if (v) this.assign(u, this.job('load', 'warehouse', DEPOT, 0, v));
      return;
    }
    if (u.role === 'auto' || u.role === 'build') {
      for (const item of [...this.state.buildings, ...this.state.rows])
        if (
          item.work > 0 &&
          this.assign(u, this.job('build', item.id, item.access))
        )
          return;
    }
    if (u.role === 'auto' || u.role === 'press') {
      for (const b of this.state.buildings)
        if (
          !b.work &&
          total(b.must) <= 42000 &&
          (!b.batch || b.batch.work > 0) &&
          (b.batch || total(b.stock) >= 1000) &&
          this.assign(u, this.job('press', b.id, b.access))
        )
          return;
    }
    if (u.role === 'auto' || u.role === 'harvest') {
      for (const r of this.state.rows) {
        const available = r.stock - this.reservations.amount(r.id);
        if (
          !r.work &&
          available > 0 &&
          this.assign(
            u,
            this.job(
              'harvest',
              r.id,
              r.access,
              Math.min(1000, available),
              r.variety,
            ),
          )
        )
          return;
      }
    }
  }
  advance(ms: number) {
    this.clock.advance(ms, () => this.tick());
  }
  tick() {
    if (this.state.completed || this.state.failed) return;
    this.state.tick++;
    if (this.state.tick % 240 === 0)
      new Ledger(this.state.ledger).transact(
        `day-${this.state.tick / 240}`,
        -(2000 + 300 * this.state.buildings.length),
        true,
      );
    for (const r of this.state.rows)
      if (!r.mature && r.planted >= 0 && this.state.tick - r.planted >= 2400) {
        r.mature = true;
        r.stock = r.vines * 200;
        this.state.grown += r.stock;
      }
    for (const b of this.state.buildings)
      if (b.batch && b.batch.work <= 0 && --b.batch.remaining <= 0) {
        const amount = b.batch.amount * 0.6;
        b.must[b.batch.variety] = (b.must[b.batch.variety] ?? 0) + amount;
        this.state.processed += b.batch.amount;
        b.batch = null;
      }
    for (const u of this.state.units) {
      if (!u.job) {
        this.choose(u);
        continue;
      }
      if (u.routeRevision !== this.state.topology) this.route(u);
      if (u.blocked) continue;
      if (u.path.length) {
        const next = u.path[0],
          distance = Math.hypot(next.x - u.x, next.y - u.y),
          step = (u.kind === 'tractor' ? 9 : 5) * 0.05;
        if (distance <= step) {
          u.x = next.x;
          u.y = next.y;
          u.path.shift();
        } else {
          u.x += ((next.x - u.x) * step) / distance;
          u.y += ((next.y - u.y) * step) / distance;
        }
        continue;
      }
      const j = u.job;
      j.progress++;
      if (j.kind === 'move') {
        this.finish(u);
        continue;
      }
      if (j.kind === 'build') {
        const item = [...this.state.rows, ...this.state.buildings].find(
          (b) => b.id === j.target,
        )!;
        item.work = Math.max(0, item.work - 1);
        if (!item.work) {
          if ('planted' in item) item.planted = this.state.tick;
          this.finish(u);
        }
      } else if (j.kind === 'harvest' && j.progress >= 12) {
        const row = this.state.rows.find((r) => r.id === j.target)!;
        new Inventory({ [j.variety]: row.stock }, 100000).transfer(
          new Inventory(u.cargo, 8000),
          j.variety,
          j.amount,
        );
        row.stock -= j.amount;
        const v = j.variety;
        this.finish(u);
        const available = row.stock - this.reservations.amount(row.id);
        if (total(u.cargo) < 8000 && available > 0)
          this.assign(
            u,
            this.job(
              'harvest',
              row.id,
              row.access,
              Math.min(1000, available, 8000 - total(u.cargo)),
              v,
            ),
          );
      } else if (j.kind === 'press') {
        const b = this.state.buildings.find((b) => b.id === j.target)!;
        if (!b.batch) {
          const v = (Object.keys(varieties) as Variety[]).find(
            (v) => (b.stock[v] ?? 0) >= 1000,
          );
          if (!v) {
            this.finish(u);
            continue;
          }
          const amount = Math.min(10000, b.stock[v]);
          b.stock[v] -= amount;
          b.batch = { variety: v, amount, work: 60, remaining: 100 };
        }
        if (--b.batch.work <= 0) this.finish(u);
      } else if (
        j.progress >= 20 &&
        ['deposit', 'load', 'unload'].includes(j.kind)
      ) {
        const source = j.kind === 'load' ? this.state.warehouse : u.cargo;
        const b = this.state.buildings.find((b) => b.id === j.target);
        const dest =
          j.kind === 'load'
            ? u.cargo
            : j.kind === 'unload'
              ? b!.stock
              : this.state.warehouse;
        const capacity =
          j.kind === 'load' ? 24000 : j.kind === 'unload' ? 48000 : 200000;
        for (const [v, amount] of Object.entries(source)) {
          const n = Math.min(amount, capacity - total(dest));
          if (n > 0)
            new Inventory(source, 200000).transfer(
              new Inventory(dest, capacity),
              v,
              n,
            );
        }
        this.finish(u);
      }
    }
    if (this.state.tick >= this.world.scenario.seconds * 20) {
      this.state.completed =
        this.state.sold >= this.world.scenario.goal &&
        !this.state.ledger.arrears;
      this.state.failed = !this.state.completed;
    }
  }
  get balanceGrams() {
    return (
      this.state.rows.map((r) => r.stock).reduce(sum, 0) +
      total(this.state.warehouse) +
      this.state.units.map((u) => total(u.cargo)).reduce(sum, 0) +
      this.state.buildings
        .map((b) => total(b.stock) + (b.batch?.amount ?? 0))
        .reduce(sum, 0) +
      this.state.processed +
      this.state.lost
    );
  }
  snapshot() {
    return structuredClone({
      ...this.state,
      clock: { speed: this.clock.speed, remainder: this.clock.remainder },
    });
  }
  validateSave(raw: unknown): VineyardState {
    const fail = () => {
      throw Error('Winobranie RTS: uszkodzony zapis');
    };
    if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 1500000)
      return fail();
    const s = structuredClone(raw) as VineyardState;
    const int = (n: unknown, max = 1000000000, min = 0) =>
      typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
    const cell = (p: Cell) => p && int(p.x, 511) && int(p.y, 511);
    const stock = (x: Record<string, number>, cap: number) =>
      x &&
      typeof x === 'object' &&
      !Array.isArray(x) &&
      Object.entries(x).every(
        ([v, n]) => Object.hasOwn(varieties, v) && int(n, cap),
      ) &&
      total(x) <= cap;
    if (
      s.version !== 1 ||
      s.revision !== 'vineyard-w1' ||
      !int(s.tick, 7200) ||
      !int(s.serial, 100000) ||
      !int(s.topology, 100000) ||
      !int(s.vouchers, 2) ||
      !int(s.sold) ||
      !int(s.processed) ||
      !int(s.grown) ||
      !int(s.lost) ||
      typeof s.completed !== 'boolean' ||
      typeof s.failed !== 'boolean' ||
      !Array.isArray(s.rows) ||
      s.rows.length > 64 ||
      !Array.isArray(s.buildings) ||
      s.buildings.length > 32 ||
      !Array.isArray(s.roads) ||
      s.roads.length > 10000 ||
      !Array.isArray(s.parcels) ||
      s.parcels.length > 16 ||
      !Array.isArray(s.units) ||
      s.units.length !== 3 ||
      !stock(s.warehouse, 200000)
    )
      return fail();
    if (
      !s.ledger ||
      ![
        s.ledger.balance,
        s.ledger.costs,
        s.ledger.income,
        s.ledger.arrears,
      ].every((n) => int(n)) ||
      !Array.isArray(s.ledger.ids) ||
      s.ledger.ids.length > 10000 ||
      !s.ledger.ids.every(
        (id) => typeof id === 'string' && /^[\w-]{1,80}$/.test(id),
      ) ||
      new Set(s.ledger.ids).size !== s.ledger.ids.length ||
      3000000 + s.ledger.income - s.ledger.costs !==
        s.ledger.balance - s.ledger.arrears
    )
      return fail();
    if (
      !s.clock ||
      ![1, 2, 4].includes(s.clock.speed) ||
      !Number.isFinite(s.clock.remainder) ||
      s.clock.remainder < 0 ||
      s.clock.remainder >= 50
    )
      return fail();
    const reservations = new Reservations();
    const ids = new Set<string>();
    for (const item of [...s.rows, ...s.buildings, ...s.units]) {
      if (
        typeof item.id !== 'string' ||
        !/^[\w-]{1,80}$/.test(item.id) ||
        ids.has(item.id)
      )
        return fail();
      ids.add(item.id);
    }
    if (
      !s.parcels.every(
        (p) =>
          cell(p) &&
          p.width === 96 &&
          p.height === 96 &&
          p.x + 96 <= 512 &&
          p.y + 96 <= 512,
      ) ||
      !s.roads.every(cell)
    )
      return fail();
    const occupied = new Set(rectCells(STORE).map(key));
    for (const row of s.rows) {
      if (
        !Object.hasOwn(varieties, row.variety) ||
        !int(row.vines, 32, 1) ||
        !int(row.stock, 64000) ||
        !int(row.work, 512) ||
        !int(row.planted, s.tick, -1) ||
        typeof row.mature !== 'boolean' ||
        !cell(row.access) ||
        !Array.isArray(row.cells) ||
        row.cells.length > 64 ||
        !row.cells.length ||
        !row.cells.every(cell) ||
        row.vines !== Math.ceil(row.cells.length / 2) ||
        !ownsAll(row.cells, s.parcels)
      )
        return fail();
      for (const p of row.cells) {
        if (
          occupied.has(key(p)) ||
          terrainBlocked(p.x, p.y) ||
          publicRoad(p.x, p.y)
        )
          return fail();
        occupied.add(key(p));
      }
    }
    for (const b of s.buildings) {
      if (
        !cell(b) ||
        !int(b.rotation, 3) ||
        b.width !== (b.rotation % 2 ? 6 : 8) ||
        b.height !== (b.rotation % 2 ? 8 : 6) ||
        !cell(b.access) ||
        !cell(b.dock) ||
        !stock(b.stock, 48000) ||
        !stock(b.must, 48000) ||
        !int(b.work, 120)
      )
        return fail();
      const expected = houseAt(
        { x: b.x + b.width / 2, y: b.y + b.height / 2 },
        b.rotation,
      );
      if (
        key(b.access) !== key(expected.access) ||
        key(b.dock) !== key(expected.dock) ||
        !ownsAll(rectCells(b), s.parcels)
      )
        return fail();
      if (
        b.batch &&
        (!Object.hasOwn(varieties, b.batch.variety) ||
          !int(b.batch.amount, 10000, 1) ||
          !int(b.batch.work, 60) ||
          !int(b.batch.remaining, 100, 1))
      )
        return fail();
      for (const p of rectCells(b)) {
        if (
          occupied.has(key(p)) ||
          terrainBlocked(p.x, p.y) ||
          publicRoad(p.x, p.y)
        )
          return fail();
        occupied.add(key(p));
      }
    }
    if (
      new Set(s.roads.map(key)).size !== s.roads.length ||
      s.roads.some(
        (p) =>
          occupied.has(key(p)) ||
          terrainBlocked(p.x, p.y) ||
          publicRoad(p.x, p.y),
      ) ||
      !ownsAll(s.roads, s.parcels)
    )
      return fail();
    for (const [i, u] of s.units.entries()) {
      if (
        u.id !== ['worker-1', 'worker-2', 'tractor-1'][i] ||
        u.kind !== (i === 2 ? 'tractor' : 'worker') ||
        ![u.x, u.y].every((n) => Number.isFinite(n) && n >= 0 && n < 512) ||
        !['auto', 'harvest', 'press', 'build', 'rest'].includes(u.role) ||
        !stock(u.cargo, i === 2 ? 24000 : 8000) ||
        !Array.isArray(u.path) ||
        u.path.length > 4096 ||
        !u.path.every(cell) ||
        !int(u.routeRevision, s.topology) ||
        typeof u.blocked !== 'boolean'
      )
        return fail();
      if (
        u.job &&
        (![
          'harvest',
          'build',
          'press',
          'deposit',
          'load',
          'unload',
          'move',
        ].includes(u.job.kind) ||
          !cell(u.job.goal) ||
          !int(u.job.progress, 100000) ||
          !int(u.job.amount, 1000) ||
          !Object.hasOwn(varieties, u.job.variety) ||
          (!['', 'warehouse'].includes(u.job.target) && !ids.has(u.job.target)))
      )
        return fail();
      if (u.job) {
        const j = u.job,
          row = s.rows.find((r) => r.id === j.target),
          building = s.buildings.find((b) => b.id === j.target);
        if (
          j.kind === 'harvest' &&
          (!row ||
            u.kind !== 'worker' ||
            j.variety !== row.variety ||
            j.amount <= 0 ||
            total(u.cargo) + j.amount > 8000 ||
            key(j.goal) !== key(row.access) ||
            !reservations.reserve(u.id, row.id, j.amount, row.stock))
        )
          return fail();
        if (
          j.kind === 'build' &&
          (!(row || building) ||
            u.kind !== 'worker' ||
            key(j.goal) !== key((row || building)!.access) ||
            !reservations.reserve(u.id, j.target, 1, 1))
        )
          return fail();
        if (
          j.kind === 'press' &&
          (!building ||
            u.kind !== 'worker' ||
            key(j.goal) !== key(building.access) ||
            !reservations.reserve(u.id, j.target, 1, 1))
        )
          return fail();
        if (
          j.kind === 'unload' &&
          (!building ||
            u.kind !== 'tractor' ||
            key(j.goal) !== key(building.dock))
        )
          return fail();
        if (
          (j.kind === 'load' || j.kind === 'deposit') &&
          (j.target !== 'warehouse' ||
            key(j.goal) !== key(DEPOT) ||
            (j.kind === 'load' && u.kind !== 'tractor'))
        )
          return fail();
        if (j.kind === 'move' && j.target !== '') return fail();
        if (!u.blocked && key(u.path.at(-1) ?? rounded(u)) !== key(j.goal))
          return fail();
      }
      if (!u.job && u.path.length) return fail();
      let previous = rounded(u);
      for (const p of u.path) {
        if (Math.abs(previous.x - p.x) + Math.abs(previous.y - p.y) > 1)
          return fail();
        previous = p;
      }
    }
    const grams =
      s.rows.map((r) => r.stock).reduce(sum, 0) +
      total(s.warehouse) +
      s.units.map((u) => total(u.cargo)).reduce(sum, 0) +
      s.buildings
        .map((b) => total(b.stock) + (b.batch?.amount ?? 0))
        .reduce(sum, 0) +
      s.processed +
      s.lost;
    if (
      grams !== s.grown ||
      s.sold + s.buildings.map((b) => total(b.must)).reduce(sum, 0) !==
        s.processed * 0.6 ||
      (s.completed || s.failed) !== (s.tick === 7200) ||
      s.completed !== (s.tick === 7200 && s.sold >= 40000 && !s.ledger.arrears)
    )
      return fail();
    return s;
  }
  restore(value: unknown) {
    const valid = this.validateSave(value);
    const candidate = new VineyardModel(this.world);
    candidate.state = valid;
    candidate.rebuild();
    for (const u of valid.units)
      if (
        !candidate.walkable(rounded(u), u.kind === 'tractor') ||
        u.path.some((p) => !candidate.walkable(p, u.kind === 'tractor'))
      )
        throw Error('Winobranie RTS: niepoprawna trasa zapisu');
    for (const r of valid.rows)
      if (!candidate.human.findPath(DEPOT, r.access))
        throw Error('Winobranie RTS: odcięty rząd zapisu');
    for (const b of valid.buildings)
      if (
        !candidate.human.findPath(DEPOT, b.access) ||
        !candidate.vehicle.findPath(DEPOT, b.dock)
      )
        throw Error('Winobranie RTS: odcięty port zapisu');
    this.state = valid;
    this.rebuild();
    this.clock.remainder = valid.clock.remainder;
    this.clock.speed = valid.clock.speed;
  }
}
