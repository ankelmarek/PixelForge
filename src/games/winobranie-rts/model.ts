import {
  RegionalNavigator,
  ScenarioClock,
  Ledger,
  Inventory,
  Reservations,
  ownsAll,
  lineCells,
  rectCells,
  randomSample,
  LotBook,
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
import { VineyardClimate, SEASON_TICKS } from './climate';
import {
  newEnvironment,
  newCrop,
  needsWater,
  stepCrop,
  type EnvironmentState,
} from './agronomy';
import {
  WaterNetwork,
  waterCosts,
  WATER_CAPACITY,
  type WaterKind,
  type WaterMode,
} from './water';
import { validateEnvironment } from './validation';
import {
  campaignRules,
  newCampaign,
  newCellar,
  crewCatalog,
  crew,
  unitSpec,
  offers,
  campaignSuccess,
  netWorth,
  recoverable,
  type CampaignState,
  type CrewKind,
  type Upgrade,
} from './campaign';
import {
  recordGrowth,
  finishPress,
  stepCellars,
  needsBottler,
  bottle,
  sellProduction,
} from './production';
import { validateCampaign } from './campaign-validation';

export type Tool =
  | 'select'
  | 'box'
  | 'row'
  | 'road'
  | 'avenue'
  | 'house'
  | 'remove'
  | 'move'
  | 'parcel'
  | WaterKind
  | 'pipe';
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
  kind:
    | 'harvest'
    | 'build'
    | 'press'
    | 'deposit'
    | 'load'
    | 'unload'
    | 'move'
    | 'care'
    | 'cellar';
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
  version: 3;
  revision: 'vineyard-w3';
  campaign: CampaignState | null;
  environment: EnvironmentState | null;
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
  hauler!: RegionalNavigator;
  private blocked = new Uint8Array(512 * 512);
  private road = new Uint8Array(512 * 512);
  private reservations = new Reservations();
  climate!: VineyardClimate;
  water!: WaterNetwork | null;
  lastReason = '';
  constructor(
    readonly world: VineyardWorld,
    readonly seed: number | null = world.scenario.seed,
    readonly fullCampaign = false,
  ) {
    this.reset(seed);
  }
  reset(seed = this.seed) {
    this.state = {
      version: 3,
      revision: 'vineyard-w3',
      campaign: this.fullCampaign && seed !== null ? newCampaign() : null,
      environment: seed === null ? null : newEnvironment(seed),
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
      grown: seed === null ? 96000 : 0,
      lost: 0,
      completed: false,
      failed: false,
    };
    const initial: Variety[] =
      seed === null
        ? ['solaris', 'regent', 'johanniter']
        : [
            randomSample(seed, 20, 0) < 0.5 ? 'solaris' : 'rondo',
            randomSample(seed, 20, 1) < 0.5 ? 'regent' : 'johanniter',
            randomSample(seed, 20, 2) < 0.5 ? 'muscaris' : 'cortis',
          ];
    initial.forEach((variety, i) => {
      const cells = lineCells(
        { x: 232, y: 238 + 4 * i },
        { x: 262, y: 238 + 4 * i },
      );
      this.state.rows.push({
        id: `row-${i}`,
        cells,
        variety,
        stock: seed === null ? 32000 : 0,
        vines: 16,
        planted: 0,
        work: 0,
        mature: seed === null,
        access: { x: 232, y: 239 + 4 * i },
      });
      if (this.state.environment) {
        const row = this.state.rows.at(-1)!;
        this.state.environment.crops[row.id] = newCrop(row, 3);
      }
    });
    this.clock.remainder = 0;
    this.clock.speed = 1;
    this.clock.paused = false;
    this.rebuild();
  }
  private rebuild() {
    this.climate = new VineyardClimate(
      this.state.environment?.seed ?? 731,
      this.state.campaign?.year ?? 1,
    );
    this.water = this.state.environment
      ? new WaterNetwork(this.state.environment.water)
      : null;
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
    for (const d of this.state.environment?.water.devices ?? [])
      this.blocked[d.y * 512 + d.x] = 1;
    for (const p of this.state.roads) this.road[p.y * 512 + p.x] = 1;
    this.human = new RegionalNavigator(this.world, (p) => this.walkable(p));
    this.vehicle = new RegionalNavigator(this.world, (p) =>
      this.walkable(p, true),
    );
    this.hauler = new RegionalNavigator(this.world, (p) => this.walkable(p, 2));
    this.reservations = new Reservations();
    for (const u of this.state.units) if (u.job) this.reserve(u, u.job);
  }
  prepare(budget = 4) {
    const a = this.human.prepare(budget),
      b = this.vehicle.prepare(budget);
    const c = !this.state.campaign || this.hauler.prepare(budget);
    return a && b && c;
  }
  walkable(
    p: Cell,
    vehicle: boolean | number = false,
    blocks?: Set<string>,
    roads?: Set<string>,
    cleared?: Set<string>,
  ) {
    const radius = typeof vehicle === 'number' ? vehicle : Number(vehicle);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
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
      (!this.state.environment &&
        !['solaris', 'regent', 'johanniter'].includes(variety)) ||
      ![
        'row',
        'road',
        'avenue',
        'house',
        'move',
        'tank',
        'pump',
        'sprinkler',
        'pipe',
      ].includes(tool)
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
    const env = this.state.environment;
    if (['tank', 'pump', 'sprinkler', 'pipe'].includes(tool)) {
      if (!env) reason = 'Dokończ zapis W1; nowe sezony mają nawadnianie';
      else if (tool === 'pipe') {
        if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 63)
          reason = 'Maks. 64 pola';
        else {
          const line = lineCells(a, b);
          const connected = line.flatMap((p, i) =>
            i && line[i - 1].x !== p.x && line[i - 1].y !== p.y
              ? [p, { x: line[i - 1].x, y: p.y }]
              : [p],
          );
          const existing = new Set(env.water.pipes.map(key));
          cells = connected.filter((p) => !existing.has(key(p)));
          cost = cells.length * waterCosts.pipe;
          if (env.water.pipes.length + cells.length > 2048)
            reason = 'Limit rur';
        }
      } else {
        cost = waterCosts[tool as WaterKind];
        const limit = tool === 'sprinkler' ? 24 : 4;
        if (env.water.devices.filter((d) => d.kind === tool).length >= limit)
          reason = 'Limit urządzeń';
      }
    }
    if (tool === 'house' || tool === 'move') {
      cells = rectCells(building);
      cost =
        tool === 'move'
          ? 100000
          : this.state.vouchers
            ? 0
            : campaignRules.house;
    }
    if (tool === 'row' || tool === 'road' || tool === 'avenue') {
      if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 63)
        reason = 'Maks. 64 pola';
      else cells = lineCells(a, b);
      if (tool === 'row')
        cost =
          Math.ceil(cells.length / 2) * (env ? varieties[variety].cost : 3000);
      else {
        const expanded = new Map<string, Cell>();
        // Fill both orthogonal steps at diagonal corners before applying the
        // 3×3 brush. A visual diagonal must also be traversable by a wide actor.
        const centers = cells.flatMap((point, index) => {
          const previous = cells[index - 1];
          return previous && previous.x !== point.x && previous.y !== point.y
            ? [
                point,
                { x: previous.x, y: point.y },
                { x: point.x, y: previous.y },
              ]
            : [point];
        });
        for (const p of centers)
          for (
            let dy = tool === 'avenue' ? -2 : -1;
            dy <= (tool === 'avenue' ? 2 : 1);
            dy++
          )
            for (
              let dx = tool === 'avenue' ? -2 : -1;
              dx <= (tool === 'avenue' ? 2 : 1);
              dx++
            ) {
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
    if (!cells.length)
      return reject(tool === 'pipe' ? 'Rura istnieje' : 'Droga istnieje');
    if (!ownsAll(cells, this.state.parcels)) return reject('Cudza parcela');
    if (this.state.completed || this.state.failed)
      return reject('Sezon zakończony');
    if (
      tool === 'house' &&
      ((!this.state.vouchers && !this.state.campaign) ||
        this.state.buildings.length >= 32)
    )
      return reject('Brak uprawnień');
    if (tool === 'row' && this.state.rows.length >= 64)
      return reject('Limit rzędów');
    if (
      ['road', 'avenue'].includes(tool) &&
      this.state.roads.length + cells.length > 10000
    )
      return reject('Limit dróg');
    if (cost > this.state.ledger.balance) return reject('Brak środków');
    // Underground pipes may cross roads and planted rows, without affecting navigation.
    if (tool === 'pipe')
      return cells.some((p) => terrainBlocked(p.x, p.y))
        ? reject('Zajęte pole')
        : { ...plan, valid: true };
    const old = this.state.buildings.find((item) => item.id === moving);
    if (tool === 'move' && (!old || !this.idle(old)))
      return reject('Domek zajęty');
    const cleared = old ? new Set(rectCells(old).map(key)) : undefined;
    if (
      cells.some(
        (p) =>
          !this.walkable(p, false, undefined, undefined, cleared) ||
          (!['road', 'avenue'].includes(tool) && this.road[p.y * 512 + p.x]),
      )
    )
      return reject('Zajęte pole');
    if (cells.some((p) => p.x > 350 && p.y < 180)) return reject('Stromy stok');
    if (
      this.state.units.some((u) =>
        cells.some(
          (p) =>
            Math.abs(p.x - u.x) <= unitSpec(this.state, u).radius + 0.6 &&
            Math.abs(p.y - u.y) <= unitSpec(this.state, u).radius + 0.6,
        ),
      )
    )
      return reject('Jednostka na placu');
    const isRoad = ['road', 'avenue'].includes(tool);
    const blocks = new Set(isRoad ? [] : cells.map(key)),
      roads = new Set(isRoad ? cells.map(key) : []);
    const human = this.human.fork((p) =>
      this.walkable(p, false, blocks, roads, cleared),
    );
    const vehicle = this.vehicle.fork((p) =>
      this.walkable(p, true, blocks, roads, cleared),
    );
    const hauler = this.hauler.fork((p) =>
      this.walkable(p, 2, blocks, roads, cleared),
    );
    for (const area of old ? [bounds(cells), old] : [bounds(cells)]) {
      human.invalidate(area);
      vehicle.invalidate(area, 1);
      hauler.invalidate(area, 2);
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
      if (
        !(
          unitSpec(this.state, u).radius === 2
            ? hauler
            : u.kind === 'tractor'
              ? vehicle
              : human
        ).findPath(rounded(u), DEPOT)
      )
        return reject('Odcięta jednostka');
    if (
      this.state.units.some((u) => unitSpec(this.state, u).radius === 2) &&
      ports.some((b) => !hauler.findPath(DEPOT, b.dock))
    )
      return reject('Duża przyczepa potrzebuje drogi 5 pól');
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
      } else if (this.state.vouchers) this.state.vouchers--;
      this.state.buildings.push(b);
      if (this.state.campaign && plan.tool !== 'move')
        this.state.campaign.cellars[b.id] = newCellar();
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
      if (this.state.environment)
        this.state.environment.crops[id] = newCrop(this.state.rows.at(-1)!, 0);
    } else if (['road', 'avenue'].includes(plan.tool))
      this.state.roads.push(...cells);
    else if (this.state.environment) {
      const w = this.state.environment.water;
      if (plan.tool === 'pipe') w.pipes.push(...cells);
      else {
        const volume = plan.tool === 'tank' ? 100000 : 0;
        w.devices.push({
          id,
          ...current.from,
          kind: plan.tool as WaterKind,
          mode: 'auto',
          volume,
          delivery: null,
        });
        w.supplied += volume;
      }
      w.revision++;
    }
    if (plan.tool === 'pipe') {
      this.changed();
      return true;
    }
    for (const p of cells)
      (['road', 'avenue'].includes(plan.tool) ? this.road : this.blocked)[
        p.y * 512 + p.x
      ] = 1;
    this.changed(...areas);
    return true;
  }
  private changed(...areas: GridRect[]) {
    this.state.topology++;
    for (const area of areas) {
      this.human.invalidate(area);
      this.vehicle.invalidate(area, 1);
      this.hauler.invalidate(area, 2);
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
      (!this.state.campaign ||
        (!this.state.campaign.cellars[b.id].process &&
          !this.state.campaign.book.lots.some((l) =>
            l.owner.endsWith(`:${b.id}`),
          ))) &&
      !this.state.units.some((u) => u.job?.target === b.id)
    );
  }
  remove(id: string) {
    if (this.state.completed || this.state.failed) return false;
    const water = this.state.environment?.water;
    const device = water?.devices.find((d) => d.id === id);
    if (water && device) {
      if (device.delivery) return false;
      water.discarded += device.volume;
      water.devices = water.devices.filter((d) => d !== device);
      water.revision++;
      this.blocked[device.y * 512 + device.x] = 0;
      this.changed({ ...device, width: 1, height: 1 });
      return true;
    }
    const row = this.state.rows.find((r) => r.id === id),
      b = this.state.buildings.find((r) => r.id === id);
    const refund =
      row &&
      !row.mature &&
      (!this.state.environment || this.state.environment.crops[id]?.age === 0)
        ? row.vines *
          (this.state.environment ? varieties[row.variety].cost / 10 : 300)
        : b && this.state.campaign && !b.work
          ? 400000
          : 0;
    if (
      (!row && !b) ||
      (b && !this.idle(b)) ||
      this.state.units.some((u) => u.job?.target === id)
    )
      return false;
    const cells = row ? row.cells : rectCells(b!);
    if (row) {
      this.state.lost += row.stock;
      if (this.state.campaign)
        this.state.campaign.book.lots = this.state.campaign.book.lots.filter(
          (l) => l.owner !== row.id,
        );
      this.state.rows = this.state.rows.filter((r) => r !== row);
      if (this.state.environment) delete this.state.environment.crops[row.id];
    } else {
      this.state.buildings = this.state.buildings.filter((r) => r !== b);
      if (this.state.campaign) delete this.state.campaign.cellars[id];
      for (const u of Object.values(this.state.campaign?.crew ?? {}))
        if (u.deliveryTo === id) u.deliveryTo = null;
    }
    new Ledger(this.state.ledger).transact(
      `remove-${this.state.serial++}`,
      refund,
    );
    for (const p of cells) this.blocked[p.y * 512 + p.x] = 0;
    this.changed(bounds(cells));
    return true;
  }
  removePipe(p: Cell) {
    const w = this.state.environment?.water;
    if (!w || this.state.completed || this.state.failed) return false;
    const i = w.pipes.findIndex((q) => key(q) === key(p));
    if (i < 0) return false;
    w.pipes.splice(i, 1);
    w.revision++;
    this.changed();
    return true;
  }
  waterMode(id: string, mode: WaterMode) {
    if (
      this.state.completed ||
      this.state.failed ||
      !['off', 'auto', 'on'].includes(mode)
    )
      return false;
    const d = this.state.environment?.water.devices.find((d) => d.id === id);
    if (!d || d.kind === 'tank') return false;
    d.mode = mode;
    return true;
  }
  refill(id: string) {
    if (this.state.completed || this.state.failed) return false;
    const d = this.state.environment?.water.devices.find((d) => d.id === id);
    if (!d || d.kind !== 'tank' || d.delivery) return false;
    const amount = Math.min(500000, WATER_CAPACITY - d.volume);
    if (
      amount <= 0 ||
      ![
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) =>
        this.human.findPath(DEPOT, { x: d.x + dx, y: d.y + dy }),
      )
    )
      return false;
    if (
      !new Ledger(this.state.ledger).transact(
        `water-${this.state.serial}`,
        -Math.ceil(amount / 10),
      )
    )
      return false;
    this.state.serial++;
    d.delivery = { due: this.state.tick + 400, amount };
    return true;
  }
  care(id: string) {
    if (this.state.completed || this.state.failed) return false;
    const crop = this.state.environment?.crops[id];
    const row = this.state.rows.find((r) => r.id === id);
    if (
      !crop ||
      !row ||
      row.work ||
      row.mature ||
      crop.care ||
      !crop.plots.some((p) => p.mildew > 0)
    )
      return false;
    if (
      !new Ledger(this.state.ledger).transact(
        `care-${this.state.serial}`,
        -10000,
      )
    )
      return false;
    this.state.serial++;
    crop.care = 120;
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
    const wide = this.hauler.fork((q) => {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (
            !publicRoad(q.x + dx, q.y + dy) &&
            !remaining.has(key({ x: q.x + dx, y: q.y + dy }))
          )
            return false;
      return this.walkable(q, 2);
    });
    wide.invalidate(bounds(cells), 2);
    if (
      this.state.buildings.some((b) => !nav.findPath(DEPOT, b.dock)) ||
      this.state.units.some(
        (u) => u.kind === 'tractor' && !nav.findPath(rounded(u), DEPOT),
      ) ||
      (this.state.units.some((u) => unitSpec(this.state, u).radius === 2) &&
        (this.state.buildings.some((b) => !wide.findPath(DEPOT, b.dock)) ||
          this.state.units.some(
            (u) =>
              unitSpec(this.state, u).radius === 2 &&
              !wide.findPath(rounded(u), DEPOT),
          )))
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
    if (this.state.campaign) {
      const b = this.state.buildings.find((b) => b.id === id);
      return (
        !!b &&
        !!this.vehicle.findPath(DEPOT, b.dock) &&
        sellProduction(this.state, id)
      );
    }
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
  hire(kind: CrewKind) {
    const s = this.state,
      c = s.campaign;
    if (
      !c ||
      s.completed ||
      s.failed ||
      !Object.hasOwn(crewCatalog, kind) ||
      s.units.length >= 24
    )
      return false;
    const spec = crewCatalog[kind],
      tractor = spec.radius > 0;
    const nav =
      spec.radius === 2 ? this.hauler : tractor ? this.vehicle : this.human;
    if (tractor && s.buildings.some((b) => !nav.findPath(DEPOT, b.dock))) {
      this.lastReason = 'Najpierw zapewnij dojazd do domków';
      return false;
    }
    let point: Cell | undefined;
    for (let offset = 0; offset < 40 && !point; offset++) {
      const p = { x: DEPOT.x - 8 + offset, y: tractor ? 258 : 254 };
      if (
        this.walkable(p, spec.radius) &&
        !s.units.some(
          (u) =>
            Math.hypot(u.x - p.x, u.y - p.y) <
            spec.radius + unitSpec(s, u).radius + 1,
        ) &&
        nav.findPath(p, DEPOT)
      )
        point = p;
    }
    if (!point) {
      this.lastReason = 'Brak miejsca przy magazynie';
      return false;
    }
    if (!new Ledger(s.ledger).transact(`hire-${s.serial}`, -spec.cost))
      return false;
    const id = `${tractor ? 'tractor' : 'worker'}-${s.serial++}`;
    s.units.push({
      id,
      kind: tractor ? 'tractor' : 'worker',
      ...point,
      role: 'auto',
      cargo: {},
      job: null,
      path: [],
      blocked: false,
      routeRevision: s.topology,
    });
    c.crew[id] = crew(kind, c.year);
    return true;
  }
  dismiss(id: string) {
    const s = this.state,
      c = s.campaign,
      u = s.units.find((u) => u.id === id);
    if (!c || !u || s.completed || s.failed) return false;
    c.crew[id].retiring = true;
    this.finish(u);
    u.role = 'rest';
    if (total(u.cargo)) this.assign(u, this.job('deposit', 'warehouse', DEPOT));
    return true;
  }
  upgrade(id: string, upgrade: Upgrade) {
    const s = this.state,
      c = s.campaign,
      b = s.buildings.find((b) => b.id === id);
    if (
      !c ||
      !b ||
      b.work ||
      s.completed ||
      s.failed ||
      !Object.hasOwn(campaignRules.upgrades, upgrade) ||
      c.cellars[id].upgrades[upgrade]
    )
      return false;
    if (
      !new Ledger(s.ledger).transact(
        `upgrade-${s.serial}`,
        -campaignRules.upgrades[upgrade],
      )
    )
      return false;
    s.serial++;
    c.cellars[id].upgrades[upgrade] = true;
    return true;
  }
  cellarMode(id: string, mode: 'young' | 'reserve') {
    const c = this.state.campaign;
    if (
      !c ||
      !c.cellars[id] ||
      this.state.completed ||
      this.state.failed ||
      !['young', 'reserve'].includes(mode)
    )
      return false;
    c.cellars[id].mode = mode;
    return true;
  }
  earlySale(id: string) {
    const s = this.state,
      b = s.buildings.find((b) => b.id === id);
    return (
      !!s.campaign &&
      !s.completed &&
      !s.failed &&
      !!b &&
      !!this.vehicle.findPath(DEPOT, b.dock) &&
      sellProduction(s, id, true)
    );
  }
  sellGrapes() {
    const s = this.state,
      c = s.campaign;
    if (!c || s.completed || s.failed || !total(s.warehouse)) return false;
    const n = total(s.warehouse),
      value = n; // 10 monet/kg, below processed wine.
    const book = new LotBook(c.book);
    for (const l of book.list('warehouse')) book.take(l.id, l.quantity);
    c.grapeSales += n;
    c.salesRevenue += value;
    s.warehouse = {};
    new Ledger(s.ledger).transact(`grapes-${s.serial++}`, value);
    return true;
  }
  loan(repay = false) {
    const s = this.state,
      c = s.campaign;
    if (!c || s.completed || s.failed) return false;
    if (repay) {
      const principal = c.borrowed - c.principalPaid,
        interest = c.borrowed ? campaignRules.interest - c.interestPaid : 0;
      if (!principal || s.ledger.balance < principal + interest) return false;
      s.ledger.balance -= principal;
      c.principalPaid += principal;
      new Ledger(s.ledger).transact(`interest-${s.serial++}`, -interest);
      c.interestPaid += interest;
      return true;
    }
    if (c.borrowed) return false;
    c.borrowed = campaignRules.loan;
    c.loanDue = Math.min(36000, s.tick + 12000);
    const paid = Math.min(s.ledger.arrears, c.borrowed);
    s.ledger.arrears -= paid;
    s.ledger.balance += c.borrowed - paid;
    return true;
  }
  acceptContract(id: string) {
    const s = this.state,
      c = s.campaign,
      t = c?.contracts.find((t) => t.id === id);
    if (
      !c ||
      !t ||
      s.completed ||
      s.failed ||
      t.year !== c.year ||
      t.status !== 'offered' ||
      c.contracts.some((t) => t.year === c.year && t.status !== 'offered')
    )
      return false;
    t.status = 'active';
    return true;
  }
  role(ids: string[], role: Role) {
    if (this.state.completed || this.state.failed) return;
    for (const u of this.state.units.filter((u) => ids.includes(u.id))) {
      this.reservations.release(u.id);
      u.job = null;
      u.path = [];
      u.role = role;
      if (this.state.campaign) this.state.campaign.crew[u.id].deliveryTo = null;
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
      } else if (u.kind === 'tractor' && b) {
        u.role = 'auto';
        if (this.state.campaign)
          this.state.campaign.crew[u.id].deliveryTo = b.id;
      } else {
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
    if (this.state.campaign && (j.kind === 'load' || j.kind === 'unload'))
      return this.reservations.reserve(u.id, `dock-${j.target}`, 1, 1);
    if (j.kind === 'harvest')
      return this.reservations.reserve(
        u.id,
        j.target,
        j.amount,
        this.state.rows.find((r) => r.id === j.target)?.stock ?? 0,
      );
    if (
      j.kind === 'build' ||
      j.kind === 'press' ||
      j.kind === 'care' ||
      j.kind === 'cellar'
    )
      return this.reservations.reserve(u.id, `work-${j.target}`, 1, 1);
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
    const nav =
      unitSpec(this.state, u).radius === 2
        ? this.hauler
        : u.kind === 'tractor'
          ? this.vehicle
          : this.human;
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
          .filter(
            (b) =>
              !b.work &&
              (!this.state.campaign?.crew[u.id].deliveryTo ||
                this.state.campaign.crew[u.id].deliveryTo === b.id) &&
              total(b.stock) + total(u.cargo) <= 48000 &&
              (!this.state.campaign ||
                !this.reservations.amount(`dock-${b.id}`)),
          )
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
      for (const row of this.state.rows)
        if (
          this.state.environment?.crops[row.id].care &&
          this.assign(u, this.job('care', row.id, row.access))
        )
          return;
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
          needsBottler(this.state, b) &&
          this.assign(u, this.job('cellar', b.id, b.access))
        )
          return;
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
  private campaignTick() {
    const s = this.state,
      c = s.campaign!;
    for (const u of [...s.units]) {
      const contract = c.crew[u.id];
      if (contract.until && s.tick >= contract.until && !contract.retiring)
        this.dismiss(u.id);
      if (contract.retiring && !total(u.cargo) && !u.job) {
        this.finish(u);
        s.units = s.units.filter((other) => other !== u);
        if (u.kind === 'tractor')
          new Ledger(s.ledger).transact(
            `vehicle-sale-${s.serial++}`,
            Math.floor(crewCatalog[contract.kind].cost / 2),
          );
        delete c.crew[u.id];
      }
    }
    if (s.tick % 400 === 0) {
      const cost =
        Object.values(c.crew).reduce(
          (n, u) => n + crewCatalog[u.kind].daily,
          0,
        ) +
        s.buildings.length * 300;
      new Ledger(s.ledger).transact(`wages-${s.tick}`, -cost, true);
    }
    if (c.borrowed > c.principalPaid && s.tick >= c.loanDue) this.loan(true);
    const crisis =
      s.ledger.arrears > 0 ||
      (c.borrowed > c.principalPaid && s.tick >= c.loanDue) ||
      (!s.rows.length && s.ledger.balance < 12400 && !recoverable(s));
    if (crisis) c.crisisSince ??= s.tick;
    else c.crisisSince = null;
    if (
      c.crisisSince !== null &&
      s.tick - c.crisisSince >= campaignRules.warningTicks &&
      !recoverable(s)
    ) {
      c.result = 'failure';
      s.failed = true;
      return;
    }
    if (s.tick % SEASON_TICKS !== 0) return;
    for (const t of c.contracts.filter(
      (t) => t.year === c.year && t.status === 'active',
    )) {
      t.status = 'missed';
      new Ledger(s.ledger).transact(`contract-${t.id}`, -20000, true);
    }
    if (c.year === 3) {
      c.result = campaignSuccess(s)
        ? 'success'
        : s.rows.some((r) => !r.work) &&
            s.units.some((u) => u.kind === 'worker') &&
            s.buildings.some((b) => !b.work) &&
            netWorth(s) >= 0
          ? 'partial'
          : 'failure';
      s.completed = c.result !== 'failure';
      s.failed = !s.completed;
      return;
    }
    for (const u of s.units)
      if (u.job?.kind === 'harvest' || u.job?.kind === 'care') this.finish(u);
    const book = new LotBook(c.book),
      env = s.environment!;
    for (const row of s.rows) {
      s.lost += row.stock;
      row.stock = 0;
      row.mature = false;
      for (const lot of book.list(row.id)) book.take(lot.id, lot.quantity);
      env.crops[row.id] = newCrop(
        row,
        Math.min(3, env.crops[row.id].age + (row.work ? 0 : 1)),
      );
    }
    c.year++;
    c.contracts.push(...offers(c.year));
    this.climate = new VineyardClimate(env.seed, c.year);
  }
  tick() {
    if (this.state.completed || this.state.failed) return;
    this.state.tick++;
    if (!this.state.campaign && this.state.tick % 240 === 0)
      new Ledger(this.state.ledger).transact(
        `day-${this.state.tick / 240}`,
        -(2000 + 300 * this.state.buildings.length),
        true,
      );
    const env = this.state.environment;
    if (env && this.water) {
      const weather = this.climate.at(this.state.tick);
      this.water.step(
        this.state.tick,
        weather,
        this.state.ledger.balance >= 100 && !this.state.ledger.arrears,
        (d) => needsWater(d, this.state.rows, env, weather),
      );
      if (
        this.state.tick % 20 === 0 &&
        env.water.energy > env.water.paidEnergy
      ) {
        new Ledger(this.state.ledger).transact(
          `energy-${this.state.tick}`,
          -(env.water.energy - env.water.paidEnergy),
          true,
        );
        env.water.paidEnergy = env.water.energy;
      }
      for (const r of this.state.rows) {
        const grown = stepCrop(
          r,
          env.crops[r.id],
          env,
          weather,
          this.water,
          this.state.tick,
        );
        this.state.grown += grown;
        if (grown && this.state.campaign) recordGrowth(this.state, r, grown);
      }
    } else
      for (const r of this.state.rows)
        if (
          !r.mature &&
          r.planted >= 0 &&
          this.state.tick - r.planted >= 2400
        ) {
          r.mature = true;
          r.stock = r.vines * 200;
          this.state.grown += r.stock;
        }
    for (const b of this.state.buildings)
      if (b.batch && b.batch.work <= 0 && --b.batch.remaining <= 0) {
        const amount = b.batch.amount * 0.6;
        b.must[b.batch.variety] = (b.must[b.batch.variety] ?? 0) + amount;
        this.state.processed += b.batch.amount;
        if (this.state.campaign) finishPress(this.state, b);
        b.batch = null;
      }
    if (this.state.campaign) stepCellars(this.state);
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
          step = unitSpec(this.state, u).speed * 0.05;
        const contract = this.state.campaign?.crew[u.id];
        if (contract && u.kind === 'tractor') {
          if (contract.turn > 0) {
            contract.turn--;
            continue;
          }
          const heading = `${Math.sign(next.x - u.x)},${Math.sign(next.y - u.y)}`;
          if (
            contract.heading &&
            contract.heading !== heading &&
            distance > 0.01
          ) {
            contract.heading = heading;
            contract.turn = unitSpec(this.state, u).radius === 2 ? 6 : 2;
            continue;
          }
          contract.heading = heading;
        }
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
      if (j.kind === 'care') {
        const crop = this.state.environment!.crops[j.target];
        crop.care = Math.max(0, crop.care - 1);
        if (!crop.care) {
          for (const plot of crop.plots)
            plot.mildew = Math.max(0, plot.mildew - 2500);
          this.finish(u);
        }
      } else if (j.kind === 'cellar') {
        const b = this.state.buildings.find((b) => b.id === j.target)!;
        if (bottle(this.state, b)) this.finish(u);
      } else if (j.kind === 'build') {
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
        if (this.state.campaign)
          new LotBook(this.state.campaign.book).transfer(
            row.id,
            u.id,
            'grapes',
            j.variety,
            j.amount,
          );
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
          if (this.state.campaign) {
            new LotBook(this.state.campaign.book).transfer(
              b.id,
              `press:${b.id}`,
              'grapes',
              v,
              amount,
            );
            if (this.state.campaign.cellars[b.id].upgrades.press) {
              b.batch.work = 30;
              b.batch.remaining = 50;
            }
          }
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
          j.kind === 'load'
            ? unitSpec(this.state, u).capacity
            : j.kind === 'unload'
              ? 48000
              : 200000;
        for (const [v, amount] of Object.entries(source)) {
          const n = Math.min(amount, capacity - total(dest));
          if (n > 0) {
            new Inventory(source, 200000).transfer(
              new Inventory(dest, capacity),
              v,
              n,
            );
            if (this.state.campaign)
              new LotBook(this.state.campaign.book).transfer(
                j.kind === 'load' ? 'warehouse' : u.id,
                j.kind === 'load'
                  ? u.id
                  : j.kind === 'unload'
                    ? b!.id
                    : 'warehouse',
                'grapes',
                v,
                n,
              );
          }
        }
        this.finish(u);
      }
    }
    if (this.state.campaign) this.campaignTick();
    else if (this.state.tick >= this.duration * 20) {
      this.state.completed =
        this.state.sold >= this.world.scenario.goal &&
        !this.state.ledger.arrears;
      this.state.failed = !this.state.completed;
    }
  }
  get duration() {
    return this.state.campaign
      ? 1800
      : this.state.environment
        ? SEASON_TICKS / 20
        : 360;
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
      this.state.lost +
      (this.state.campaign?.grapeSales ?? 0)
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
        ([v, n]) =>
          Object.hasOwn(varieties, v) &&
          (s.environment !== null ||
            ['solaris', 'regent', 'johanniter'].includes(v)) &&
          int(n, cap),
      ) &&
      total(x) <= cap;
    if (
      s.version !== 3 ||
      s.revision !== 'vineyard-w3' ||
      !int(
        s.tick,
        s.campaign ? 36000 : s.environment === null ? 7200 : SEASON_TICKS,
      ) ||
      !int(s.serial, 100000) ||
      !int(s.topology, 100000) ||
      !int(s.vouchers, 2) ||
      !int(s.sold) ||
      !int(s.processed) ||
      !int(s.grown) ||
      !int(s.lost) ||
      typeof s.completed !== 'boolean' ||
      typeof s.failed !== 'boolean' ||
      (s.completed && s.failed) ||
      !Array.isArray(s.rows) ||
      s.rows.length > 64 ||
      !Array.isArray(s.buildings) ||
      s.buildings.length > 32 ||
      !Array.isArray(s.roads) ||
      s.roads.length > 10000 ||
      !Array.isArray(s.parcels) ||
      s.parcels.length > 16 ||
      !Array.isArray(s.units) ||
      (s.campaign ? s.units.length > 24 : s.units.length !== 3) ||
      !stock(s.warehouse, 200000)
    )
      return fail();
    validateEnvironment(s);
    validateCampaign(s);
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
      3000000 +
        s.ledger.income -
        s.ledger.costs +
        (s.campaign ? s.campaign.borrowed - s.campaign.principalPaid : 0) !==
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
        (s.environment === null &&
          !['solaris', 'regent', 'johanniter'].includes(row.variety)) ||
        !int(row.vines, 32, 1) ||
        !int(row.stock, s.environment ? 100000 : 64000) ||
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
    for (const d of s.environment?.water.devices ?? []) {
      if (
        ids.has(d.id) ||
        occupied.has(key(d)) ||
        terrainBlocked(d.x, d.y) ||
        publicRoad(d.x, d.y) ||
        !ownsAll([d], s.parcels)
      )
        return fail();
      ids.add(d.id);
      occupied.add(key(d));
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
          (s.environment === null &&
            !['solaris', 'regent', 'johanniter'].includes(b.batch.variety)) ||
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
        (!s.campaign && u.id !== ['worker-1', 'worker-2', 'tractor-1'][i]) ||
        (!s.campaign && u.kind !== (i === 2 ? 'tractor' : 'worker')) ||
        !['worker', 'tractor'].includes(u.kind) ||
        ![u.x, u.y].every((n) => Number.isFinite(n) && n >= 0 && n < 512) ||
        !['auto', 'harvest', 'press', 'build', 'rest'].includes(u.role) ||
        !stock(u.cargo, unitSpec(s, u).capacity) ||
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
          'care',
          'cellar',
        ].includes(u.job.kind) ||
          !cell(u.job.goal) ||
          !int(u.job.progress, 100000) ||
          !int(u.job.amount, 1000) ||
          !Object.hasOwn(varieties, u.job.variety) ||
          (s.environment === null &&
            !['solaris', 'regent', 'johanniter'].includes(u.job.variety)) ||
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
            !reservations.reserve(u.id, `work-${j.target}`, 1, 1))
        )
          return fail();
        if (
          (j.kind === 'press' || j.kind === 'cellar') &&
          (!building ||
            (j.kind === 'cellar' &&
              (!s.campaign ||
                s.campaign.cellars[j.target].process?.stage !== 'bottle')) ||
            u.kind !== 'worker' ||
            key(j.goal) !== key(building.access) ||
            !reservations.reserve(u.id, `work-${j.target}`, 1, 1))
        )
          return fail();
        if (
          s.campaign &&
          (j.kind === 'load' || j.kind === 'unload') &&
          !reservations.reserve(u.id, `dock-${j.target}`, 1, 1)
        )
          return fail();
        if (
          j.kind === 'care' &&
          (!row ||
            u.kind !== 'worker' ||
            !s.environment?.crops[row.id].care ||
            key(j.goal) !== key(row.access) ||
            !reservations.reserve(u.id, `work-${j.target}`, 1, 1))
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
      s.lost +
      (s.campaign?.grapeSales ?? 0);
    if (
      grams !== s.grown ||
      (!s.campaign &&
        (s.sold + s.buildings.map((b) => total(b.must)).reduce(sum, 0) !==
          s.processed * 0.6 ||
          (s.completed || s.failed) !==
            (s.tick === (s.environment ? SEASON_TICKS : 7200)) ||
          s.completed !==
            (s.tick === (s.environment ? SEASON_TICKS : 7200) &&
              s.sold >= 40000 &&
              !s.ledger.arrears)))
    )
      return fail();
    return s;
  }
  migrateV1(raw: unknown) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('version' in raw) ||
      raw.version !== 1 ||
      !('revision' in raw) ||
      raw.revision !== 'vineyard-w1'
    )
      throw Error('Winobranie RTS: uszkodzony zapis W1');
    return this.validateSave({
      ...raw,
      version: 3,
      revision: 'vineyard-w3',
      campaign: null,
      environment: null,
    });
  }
  migrateV2(raw: unknown) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('version' in raw) ||
      raw.version !== 2 ||
      !('revision' in raw) ||
      raw.revision !== 'vineyard-w2'
    )
      throw Error('Winobranie RTS: uszkodzony zapis W2');
    return this.validateSave({
      ...raw,
      version: 3,
      revision: 'vineyard-w3',
      campaign: null,
    });
  }
  restore(value: unknown) {
    const valid = this.validateSave(value);
    const candidate = new VineyardModel(this.world);
    candidate.state = valid;
    candidate.rebuild();
    for (const u of valid.units)
      if (
        !candidate.walkable(rounded(u), unitSpec(valid, u).radius) ||
        u.path.some((p) => !candidate.walkable(p, unitSpec(valid, u).radius))
      )
        throw Error('Winobranie RTS: niepoprawna trasa zapisu');
    for (const r of valid.rows)
      if (!candidate.human.findPath(DEPOT, r.access))
        throw Error('Winobranie RTS: odcięty rząd zapisu');
    for (const b of valid.buildings)
      if (
        !candidate.human.findPath(DEPOT, b.access) ||
        !candidate.vehicle.findPath(DEPOT, b.dock) ||
        (valid.units.some((u) => unitSpec(valid, u).radius === 2) &&
          !candidate.hauler.findPath(DEPOT, b.dock))
      )
        throw Error('Winobranie RTS: odcięty port zapisu');
    this.state = valid;
    this.rebuild();
    this.clock.remainder = valid.clock.remainder;
    this.clock.speed = valid.clock.speed;
  }
}
