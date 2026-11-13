import { MutableGrid } from '../../engine/api/terrain';
import type { EarthwormWorld, Point } from './world';

export const TILE = 8;
export const CAPACITY = 6;
export const STEP = 1 / 50;
export interface WormState {
  x: number;
  y: number;
  heading: number;
  seconds: number;
  hydration: number;
  nutrients: number;
  lives: number;
  roots: number[];
  food: number[];
  hiding: boolean;
  invulnerable: number;
  checkpoint: number;
  completed: boolean;
  failed: boolean;
  predators: (Point & { alert: number })[];
  tunnels: [number, number][];
}
export type WormEvent = 'collect' | 'activate' | 'hit' | 'complete';
export class WormModel {
  readonly terrain: MutableGrid;
  state!: WormState;
  segments: Point[] = [];
  target?: Point;
  events: WormEvent[] = [];
  private accumulator = 0;
  private deposit = 0;
  constructor(readonly world: EarthwormWorld) {
    this.terrain = new MutableGrid(
      world.width,
      world.height,
      TILE,
      32,
      (x, y) => this.base(x, y),
    );
    this.reset();
  }
  private base(x: number, y: number) {
    const px = (x + 0.5) * TILE,
      py = (y + 0.5) * TILE;
    if (
      x < 2 ||
      y < 2 ||
      x >= this.world.width / TILE - 2 ||
      y >= this.world.height / TILE - 2
    )
      return 2;
    return this.world.rocks.some(
      (r) => Math.hypot(px - r.x, py - r.y) < r.radius,
    )
      ? 2
      : 0;
  }
  reset() {
    this.state = {
      ...this.world.spawn,
      heading: 0,
      seconds: 0,
      hydration: 100,
      nutrients: 0,
      lives: 3,
      roots: this.world.roots.map(() => 0),
      food: this.world.food.map(() => 0),
      hiding: false,
      invulnerable: 0,
      checkpoint: -1,
      completed: false,
      failed: false,
      predators: this.world.predators.map((p) => ({
        x: p.x,
        y: p.y,
        alert: 0,
      })),
      tunnels: [],
    };
    this.terrain.restore([]);
    this.resetMotion();
    for (const p of this.segments)
      this.terrain.paintCircle(p.x, p.y, 13, 1, (v) => v === 0);
  }
  private resetMotion() {
    this.target = undefined;
    this.accumulator = 0;
    this.deposit = 0;
    this.events = [];
    this.segments = Array.from({ length: 15 }, (_, i) => ({
      x: this.state.x - i * 5,
      y: this.state.y,
    }));
  }
  get blooms() {
    return this.state.roots.filter((n, i) => n === this.world.roots[i].need)
      .length;
  }
  get weather(): 'dew' | 'sun' | 'rain' | 'dusk' {
    return this.blooms < 3
      ? 'dew'
      : this.blooms < 6
        ? 'sun'
        : this.blooms < 9
          ? 'rain'
          : 'dusk';
  }
  get wet() {
    return (
      this.weather === 'rain' ||
      this.world.pools.some(
        (p) => Math.hypot(this.state.x - p.x, this.state.y - p.y) < p.radius,
      )
    );
  }
  steer(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.target = {
      x: Math.max(24, Math.min(this.world.width - 24, x)),
      y: Math.max(24, Math.min(this.world.height - 24, y)),
    };
    this.state.hiding = false;
  }
  toggleHide() {
    if (this.state.completed || this.state.failed) return;
    this.state.hiding = !this.state.hiding;
    this.target = undefined;
    this.events.push('activate');
  }
  private open(x: number, y: number) {
    if (
      x < 24 ||
      y < 24 ||
      x > this.world.width - 24 ||
      y > this.world.height - 24
    )
      return false;
    return [
      [-5, -5],
      [5, -5],
      [-5, 5],
      [5, 5],
    ].every(([dx, dy]) => {
      const cell = this.terrain.get(
        Math.floor((x + dx) / TILE),
        Math.floor((y + dy) / TILE),
      );
      return cell === 0 || cell === 1;
    });
  }
  private dig() {
    this.terrain.paintCircle(this.state.x, this.state.y, 13, 1, (v) => v === 0);
  }
  tick(delta: number, direction: Point = { x: 0, y: 0 }) {
    if (
      !Number.isFinite(delta) ||
      delta <= 0 ||
      this.state.completed ||
      this.state.failed
    )
      return;
    this.accumulator += Math.min(delta, 0.25);
    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator = Math.max(0, this.accumulator - STEP);
      this.step(direction);
      if (this.state.failed || this.state.completed) break;
    }
  }
  private step(direction: Point) {
    const s = this.state;
    s.seconds += STEP;
    s.invulnerable = Math.max(0, s.invulnerable - STEP);
    if (direction.x || direction.y) {
      this.target = undefined;
      s.hiding = false;
    }
    let dx = direction.x,
      dy = direction.y;
    if (this.target && !dx && !dy) {
      dx = this.target.x - s.x;
      dy = this.target.y - s.y;
      if (Math.hypot(dx, dy) < 3) {
        this.target = undefined;
        dx = dy = 0;
      }
    }
    const distance = Math.hypot(dx, dy);
    if (distance && !s.hiding) {
      const inTunnel =
        this.terrain.get(
          Math.floor((s.x + (dx / distance) * 16) / TILE),
          Math.floor((s.y + (dy / distance) * 16) / TILE),
        ) === 1;
      const speed = (s.hydration < 20 ? 48 : 78) * (inTunnel ? 1.12 : 1);
      const step = Math.min(
        speed * STEP,
        distance > 1 ? distance : speed * STEP,
      );
      const nx = s.x + (dx / distance) * step,
        ny = s.y + (dy / distance) * step;
      if (this.open(nx, s.y)) s.x = nx;
      if (this.open(s.x, ny)) s.y = ny;
      s.heading = Math.atan2(dy, dx);
      this.dig();
    }
    this.segments[0] = { x: s.x, y: s.y };
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1],
        next = this.segments[i],
        length = Math.hypot(prev.x - next.x, prev.y - next.y);
      if (length > 5.5) {
        next.x += ((prev.x - next.x) * (length - 5.5)) / length;
        next.y += ((prev.y - next.y) * (length - 5.5)) / length;
      }
    }
    const shelter = this.world.roots.some(
      (r, i) => s.roots[i] === r.need && Math.hypot(s.x - r.x, s.y - r.y) < 64,
    );
    const loss = this.weather === 'sun' ? 0.8 : 0.32;
    s.hydration = Math.max(
      0,
      Math.min(
        100,
        s.hydration +
          STEP * (this.wet ? 19 : shelter ? 9 : -(s.hiding ? loss / 4 : loss)),
      ),
    );
    if (s.hydration === 0) this.hurt();
    if (s.failed) return;
    for (let i = 0; i < this.world.food.length; i++) {
      s.food[i] = Math.max(0, s.food[i] - STEP);
      const food = this.world.food[i];
      if (
        !s.hiding &&
        !s.food[i] &&
        s.nutrients < CAPACITY &&
        Math.hypot(s.x - food.x, s.y - food.y) < 15
      ) {
        s.food[i] = 75;
        s.nutrients++;
        s.hydration = Math.min(100, s.hydration + 5);
        this.events.push('collect');
      }
    }
    const rootIndex = this.world.roots.findIndex(
      (r) => Math.hypot(s.x - r.x, s.y - r.y) < 29,
    );
    this.deposit =
      rootIndex >= 0 && s.nutrients > 0 && s.hydration >= 25 && !s.hiding
        ? this.deposit + STEP
        : 0;
    if (rootIndex >= 0 && this.deposit >= 0.35) {
      const root = this.world.roots[rootIndex];
      this.deposit = 0;
      if (s.roots[rootIndex] < root.need) {
        s.roots[rootIndex]++;
        s.nutrients--;
        s.hydration -= 4;
        this.events.push('activate');
        if (s.roots[rootIndex] === root.need) {
          s.checkpoint = rootIndex;
          s.hydration = 100;
          s.lives = Math.min(3, s.lives + 1);
        }
        if (this.blooms === this.world.roots.length) {
          s.completed = true;
          this.target = undefined;
          this.events.push('complete');
          return;
        }
      }
    }
    for (let i = 0; i < s.predators.length; i++) {
      const p = s.predators[i],
        home = this.world.predators[i];
      // A calm opening garden; danger is revealed beyond the first three roots.
      const chase =
        this.blooms >= 3 &&
        !s.hiding &&
        !shelter &&
        Math.hypot(p.x - s.x, p.y - s.y) < 150 &&
        Math.hypot(s.x - home.x, s.y - home.y) < home.radius + 150;
      p.alert = Math.max(
        0,
        Math.min(1, p.alert + (chase ? STEP * 1.5 : -STEP)),
      );
      const angle = s.seconds * 0.2 + i * 2;
      const goal =
        chase && p.alert >= 0.8
          ? s
          : {
              x: home.x + Math.cos(angle) * home.radius,
              y: home.y + Math.sin(angle) * home.radius * 0.6,
            };
      const gap = Math.hypot(goal.x - p.x, goal.y - p.y);
      if (gap > 1) {
        const speed = home.speed * STEP * (chase ? 1.5 : 0.7);
        const nx = p.x + ((goal.x - p.x) / gap) * speed,
          ny = p.y + ((goal.y - p.y) / gap) * speed;
        if (this.open(nx, p.y)) p.x = nx;
        if (this.open(p.x, ny)) p.y = ny;
      }
      if (chase && p.alert >= 0.8 && Math.hypot(p.x - s.x, p.y - s.y) < 20)
        this.hurt();
    }
  }
  private hurt() {
    const s = this.state;
    if (s.invulnerable > 0 || s.failed) return;
    s.lives--;
    s.hydration = 100;
    s.invulnerable = 5;
    s.hiding = false;
    this.target = undefined;
    const safe =
      s.checkpoint >= 0 ? this.world.roots[s.checkpoint] : this.world.spawn;
    s.x = safe.x;
    s.y = safe.y;
    this.segments = this.segments.map(() => ({ x: s.x, y: s.y }));
    s.failed = s.lives <= 0;
    this.events.push('hit');
  }
  snapshot(): WormState {
    return structuredClone({ ...this.state, tunnels: this.terrain.snapshot() });
  }
  validateSave(value: unknown): WormState {
    if (!value || typeof value !== 'object')
      throw Error('Zapis: wymagany obiekt');
    const s = structuredClone(value) as WormState;
    const n = (v: unknown, min: number, max: number) =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    if (
      !n(s.x, 24, this.world.width - 24) ||
      !n(s.y, 24, this.world.height - 24) ||
      !this.open(s.x, s.y) ||
      !n(s.heading, -Math.PI, Math.PI) ||
      !n(s.seconds, 0, 1e8) ||
      !n(s.hydration, 0, 100) ||
      !Number.isInteger(s.nutrients) ||
      !n(s.nutrients, 0, CAPACITY) ||
      !Number.isInteger(s.lives) ||
      !n(s.lives, 0, 3) ||
      !n(s.invulnerable, 0, 5) ||
      !Number.isInteger(s.checkpoint) ||
      !n(s.checkpoint, -1, this.world.roots.length - 1)
    )
      throw Error('Zapis: nieprawidłowy stan');
    for (const key of ['hiding', 'completed', 'failed'] as const)
      if (typeof s[key] !== 'boolean')
        throw Error('Zapis: nieprawidłowa flaga');
    if (
      !Array.isArray(s.roots) ||
      s.roots.length !== this.world.roots.length ||
      s.roots.some(
        (v, i) => !Number.isInteger(v) || !n(v, 0, this.world.roots[i].need),
      ) ||
      !Array.isArray(s.food) ||
      s.food.length !== this.world.food.length ||
      s.food.some((v) => !n(v, 0, 75))
    )
      throw Error('Zapis: nieprawidłowe zasoby');
    if (
      s.completed !== s.roots.every((v, i) => v === this.world.roots[i].need) ||
      s.failed !== (s.lives === 0) ||
      (s.completed && s.failed) ||
      (s.checkpoint >= 0 &&
        s.roots[s.checkpoint] !== this.world.roots[s.checkpoint].need)
    )
      throw Error('Zapis: niespójny postęp');
    if (
      !Array.isArray(s.predators) ||
      s.predators.length !== this.world.predators.length ||
      s.predators.some(
        (p) =>
          !p ||
          !n(p.x, 16, this.world.width - 16) ||
          !n(p.y, 16, this.world.height - 16) ||
          !n(p.alert, 0, 1),
      )
    )
      throw Error('Zapis: nieprawidłowe jednostki');
    const grid = new MutableGrid(
      this.world.width,
      this.world.height,
      TILE,
      32,
      (x, y) => this.base(x, y),
    );
    grid.restore(s.tunnels);
    if (
      s.tunnels.some(
        ([i, v]) =>
          v !== 1 ||
          this.base(i % grid.columns, Math.floor(i / grid.columns)) !== 0,
      )
    )
      throw Error('Zapis: nieprawidłowe tunele');
    return s;
  }
  restore(value: unknown) {
    this.state = this.validateSave(value);
    this.terrain.restore(this.state.tunnels);
    this.resetMotion();
  }
}
