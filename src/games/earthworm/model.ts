import { MutableGrid } from '../../engine/api/terrain';
import type { EarthwormWorld, Point } from './world';
import {
  SURFACE,
  ADULT_XP,
  CAST_DISTANCE,
  NEST,
  PLUG,
  BABY,
  CHAMBER,
  DEEP_NEST,
  AMBER,
  freshAdventure,
  validateAdventure,
  depthBand,
  weather,
  rainMoisture,
  submerged,
  targets,
  gap,
  type AdventureState,
  type AdventureTarget,
} from './adventure';

export const TILE = 8;
export const CAPACITY = 6;
export const STEP = 1 / 50;
export interface WormState {
  x: number;
  y: number;
  heading: number;
  seconds: number;
  hydration: number;
  air: number;
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
  adventure: AdventureState;
}
export type WormEvent = 'collect' | 'activate' | 'hit' | 'complete';
export class WormModel {
  readonly terrain: MutableGrid;
  private readonly ground: Uint8Array;
  state!: WormState;
  segments: Point[] = [];
  target?: Point;
  events: WormEvent[] = [];
  private accumulator = 0;
  private deposit = 0;
  private pending?: AdventureTarget;
  constructor(readonly world: EarthwormWorld) {
    const columns = world.width / TILE,
      rows = world.height / TILE;
    this.ground = new Uint8Array(columns * rows);
    for (let y = 0; y < rows; y++) {
      if (y * TILE < SURFACE)
        this.ground.fill(4, y * columns, (y + 1) * columns);
      else if (y >= rows - 2)
        this.ground.fill(2, y * columns, (y + 1) * columns);
      else
        for (const x of [0, 1, columns - 2, columns - 1])
          this.ground[y * columns + x] = 2;
    }
    for (const r of world.rocks)
      for (
        let y = Math.max(0, Math.floor((r.y - r.radius) / TILE));
        y < Math.min(rows, Math.ceil((r.y + r.radius) / TILE));
        y++
      )
        for (
          let x = Math.max(0, Math.floor((r.x - r.radius) / TILE));
          x < Math.min(columns, Math.ceil((r.x + r.radius) / TILE));
          x++
        )
          if (
            Math.hypot((x + 0.5) * TILE - r.x, (y + 0.5) * TILE - r.y) <
            r.radius
          )
            this.ground[y * columns + x] = 2;
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
    return this.ground[y * (this.world.width / TILE) + x];
  }
  reset() {
    this.state = {
      ...this.world.spawn,
      heading: 0,
      seconds: 0,
      hydration: 100,
      air: 100,
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
      adventure: freshAdventure(this.world.food.length),
    };
    this.terrain.restore([]);
    this.resetMotion();
    for (const p of this.segments)
      this.terrain.paintCircle(p.x, p.y, 13, 1, (v) => v === 0);
  }
  private resetMotion() {
    this.target = this.pending = undefined;
    this.accumulator = this.deposit = 0;
    this.events = [];
    this.segments = Array.from({ length: 15 + this.stage * 2 }, (_, i) => ({
      x: this.state.x - i * 5,
      y: this.state.y + Math.sin(i * 0.3) * 6,
    }));
  }
  get blooms() {
    return this.state.roots.filter((n, i) => n === this.world.roots[i].need)
      .length;
  }
  get experience() {
    return this.score(this.state);
  }
  private score(state: WormState) {
    const a = state.adventure;
    return (
      state.roots.filter((n, i) => n === this.world.roots[i].need).length * 12 +
      a.eaten.reduce(
        (sum, eaten, i) =>
          sum + (eaten ? (this.world.food[i].kind === 3 ? 8 : 3) : 0),
        0,
      ) +
      a.fertility +
      a.depths.slice(1).filter(Boolean).length * 10 +
      (a.plug === 3 ? 20 : 0) +
      (a.baby === 'home' ? 30 : 0) +
      (a.chamber ? 30 : 0) +
      (a.fungi.every(Boolean) ? 30 : 0) +
      a.amber.filter(Boolean).length * 8
    );
  }
  get stage() {
    return this.experience >= ADULT_XP
      ? 4
      : Math.min(3, Math.floor(this.experience / 80));
  }
  get capacity() {
    return CAPACITY + Math.min(2, this.stage) * 2;
  }
  get weather() {
    return weather(this.state.seconds);
  }
  get depth() {
    return depthBand(this.state.y);
  }
  get underwater() {
    return submerged(this.state);
  }
  get wet() {
    const s = this.state;
    return (
      rainMoisture(s.y, s.seconds) ||
      this.underwater ||
      (s.adventure.plug === 3 && gap(s, PLUG) < 100) ||
      this.world.pools.some((p) => gap(s, p) < p.radius)
    );
  }
  steer(x: number, y: number) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      this.state.completed ||
      this.state.failed
    )
      return;
    this.target = {
      x: Math.max(24, Math.min(this.world.width - 24, x)),
      y: Math.max(SURFACE + 16, Math.min(this.world.height - 24, y)),
    };
    this.pending = undefined;
    this.state.hiding = false;
  }
  click(x: number, y: number) {
    const t = targets(this.state.adventure)
      .filter((p) => gap(p, { x, y }) < 24)
      .sort((a, b) => gap(a, { x, y }) - gap(b, { x, y }))[0];
    this.steer(t?.x ?? x, t?.y ?? y);
    if (t) this.pending = t;
  }
  toggleHide() {
    if (
      this.state.completed ||
      this.state.failed ||
      this.state.adventure.finale
    )
      return;
    this.state.hiding = !this.state.hiding;
    this.target = this.pending = undefined;
    this.events.push('activate');
  }
  interact(target?: AdventureTarget) {
    const s = this.state,
      a = s.adventure;
    if (s.completed || s.failed || a.finale) return;
    const t =
      target ??
      targets(a)
        .filter((p) => gap(s, p) <= 32)
        .sort((p, q) => gap(s, p) - gap(s, q))[0];
    if (!t || gap(s, t) > 34) {
      this.toggleHide();
      return;
    }
    this.target = this.pending = undefined;
    s.hiding = false;
    if (t.kind === 'plug' && a.plug < 3) {
      a.plug++;
      if (a.plug === 3) {
        s.hydration = 100;
        s.nutrients = Math.min(this.capacity, s.nutrients + 2);
        s.roots[2] = this.world.roots[2].need;
      }
    }
    if (t.kind === 'fungus' && !a.fungi[t.index] && s.nutrients > 0) {
      a.fungi[t.index] = true;
      s.nutrients--;
      if (a.fungi.every(Boolean)) {
        s.checkpoint = this.world.roots.length;
        s.hydration = 100;
        s.lives = 3;
      }
    }
    if (t.kind === 'nest') {
      s.hydration = s.air = 100;
      s.lives = 3;
      s.checkpoint = t.index ? this.world.roots.length : -1;
      if (this.experience >= ADULT_XP) a.finale = STEP;
    }
    this.events.push('activate');
  }
  private open(x: number, y: number) {
    if (
      x < 24 ||
      y < SURFACE + 16 ||
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
      return cell === 0 || cell === 1 || cell === 3;
    });
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
    const s = this.state,
      a = s.adventure;
    s.seconds += STEP;
    s.invulnerable = Math.max(0, s.invulnerable - STEP);
    if (a.finale) {
      a.finale = Math.min(4, a.finale + STEP);
      if (a.finale === 4) {
        s.completed = true;
        this.events.push('complete');
      }
      return;
    }
    if (direction.x || direction.y) {
      this.target = this.pending = undefined;
      s.hiding = false;
    }
    if (this.pending && gap(s, this.pending) < 25) this.interact(this.pending);
    if (a.finale) return;
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
      const ahead = this.terrain.get(
          Math.floor((s.x + (dx / distance) * 16) / TILE),
          Math.floor((s.y + (dy / distance) * 16) / TILE),
        ),
        tunnel = ahead === 1 || ahead === 3,
        speed =
          (s.hydration < 20 ? 42 : 78 + this.stage * 7) *
          (tunnel ? 1.18 : 1 - this.depth * 0.09) *
          (this.underwater ? 0.68 : 1),
        step = Math.min(speed * STEP, distance > 1 ? distance : speed * STEP),
        nx = s.x + (dx / distance) * step,
        ny = s.y + (dy / distance) * step;
      if (this.open(nx, s.y)) s.x = nx;
      if (this.open(s.x, ny)) s.y = ny;
      s.heading = Math.atan2(dy, dx);
      const newSoil = this.terrain.paintCircle(s.x, s.y, 13, 1, (v) => v === 0);
      if (newSoil)
        a.castDistance = Math.min(CAST_DISTANCE, a.castDistance + newSoil * 4);
      if (a.castDistance >= CAST_DISTANCE && s.nutrients > 0) {
        const fertile = this.terrain.paintCircle(
          s.x,
          s.y,
          14,
          3,
          (v) => v === 1,
        );
        if (fertile) {
          s.nutrients--;
          a.fertility = Math.min(24, a.fertility + 1);
          a.castDistance = 0;
          this.events.push('activate');
        }
      }
    }
    const count = 15 + this.stage * 2;
    while (this.segments.length < count)
      this.segments.push({ ...this.segments[this.segments.length - 1] });
    this.segments[0] = { x: s.x, y: s.y };
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1],
        next = this.segments[i],
        length = gap(prev, next);
      if (length > 5.5) {
        next.x += ((prev.x - next.x) * (length - 5.5)) / length;
        next.y += ((prev.y - next.y) * (length - 5.5)) / length;
      }
    }
    const shelter =
      gap(s, NEST) < 45 ||
      (a.fungi.every(Boolean) && gap(s, DEEP_NEST) < 55) ||
      this.world.roots.some((r, i) => s.roots[i] === r.need && gap(s, r) < 45);
    const loss = 0.3 + this.depth * 0.16;
    s.hydration = Math.max(
      0,
      Math.min(
        100,
        s.hydration +
          STEP * (shelter ? 12 : this.wet ? 7 : -(s.hiding ? loss / 4 : loss)),
      ),
    );
    s.air = Math.max(
      0,
      Math.min(
        100,
        s.air + STEP * (this.underwater ? -(this.stage >= 3 ? 7 : 12) : 28),
      ),
    );
    if (s.hydration === 0 || s.air === 0) this.hurt();
    if (s.failed) return;
    a.depths[this.depth] = true;
    if (a.baby === 'lost' && gap(s, BABY) < 25) {
      a.baby = 'following';
      this.events.push('collect');
    }
    if (a.baby === 'following' && gap(s, NEST) < 40) {
      a.baby = 'home';
      s.lives = 3;
      this.events.push('activate');
    }
    if (!a.chamber && gap(s, CHAMBER) < 25) {
      a.chamber = true;
      this.events.push('collect');
    }
    AMBER.forEach((p, i) => {
      if (!a.amber[i] && gap(s, p) < 22) {
        a.amber[i] = true;
        this.events.push('collect');
      }
    });
    for (let i = 0; i < this.world.food.length; i++) {
      s.food[i] = Math.max(0, s.food[i] - STEP);
      const food = this.world.food[i];
      if (
        !s.hiding &&
        !s.food[i] &&
        s.nutrients < this.capacity &&
        gap(s, food) < 17
      ) {
        s.food[i] = 75;
        s.nutrients = Math.min(this.capacity, s.nutrients + 2);
        s.hydration = Math.min(100, s.hydration + 8);
        a.eaten[i] = true;
        this.events.push('collect');
      }
    }
    const rootIndex = this.world.roots.findIndex(
      (r, i) => s.roots[i] < r.need && gap(s, r) < 29,
    );
    this.deposit =
      rootIndex >= 0 && s.nutrients > 0 && !s.hiding ? this.deposit + STEP : 0;
    if (rootIndex >= 0 && this.deposit >= 0.5) {
      const root = this.world.roots[rootIndex];
      this.deposit = 0;
      s.roots[rootIndex]++;
      s.nutrients--;
      this.terrain.paintCircle(
        root.x,
        root.y,
        30,
        3,
        (v) => v === 0 || v === 1,
      );
      if (s.roots[rootIndex] === root.need) {
        s.checkpoint = rootIndex;
        s.hydration = 100;
        s.lives = Math.min(3, s.lives + 1);
      }
      this.events.push('activate');
    }
    for (let i = 0; i < s.predators.length; i++) {
      const p = s.predators[i],
        home = this.world.predators[i],
        chase =
          !s.hiding &&
          !shelter &&
          gap(p, s) < 100 + this.depth * 12 &&
          gap(s, home) < home.radius + 150;
      p.alert = Math.max(
        0,
        Math.min(1, p.alert + (chase ? STEP * 1.1 : -STEP)),
      );
      const angle = s.seconds * 0.25 + i * 2,
        goal =
          chase && p.alert >= 0.8
            ? s
            : {
                x: home.x + Math.cos(angle) * home.radius,
                y: home.y + Math.sin(angle) * home.radius * 0.5,
              },
        distance = gap(goal, p);
      if (distance > 1) {
        const speed = home.speed * STEP * (chase ? 1.4 : 0.6),
          nx = p.x + ((goal.x - p.x) / distance) * speed,
          ny = p.y + ((goal.y - p.y) / distance) * speed;
        if (this.open(nx, p.y)) p.x = nx;
        if (this.open(p.x, ny)) p.y = ny;
      }
      if (chase && p.alert >= 0.8 && gap(p, s) < 19) this.hurt();
    }
  }
  private hurt() {
    const s = this.state;
    if (s.invulnerable > 0 || s.failed) return;
    s.lives--;
    s.hydration = s.air = 100;
    s.invulnerable = 5;
    s.hiding = false;
    if (s.adventure.baby === 'following') s.adventure.baby = 'lost';
    this.target = this.pending = undefined;
    const safe =
      s.checkpoint === this.world.roots.length
        ? DEEP_NEST
        : s.checkpoint >= 0
          ? this.world.roots[s.checkpoint]
          : this.world.spawn;
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
      !n(s.y, SURFACE + 16, this.world.height - 24) ||
      !this.open(s.x, s.y) ||
      !n(s.heading, -Math.PI, Math.PI) ||
      !n(s.seconds, 0, 1e8) ||
      !n(s.hydration, 0, 100) ||
      !n(s.air, 0, 100) ||
      !Number.isInteger(s.nutrients) ||
      !n(s.nutrients, 0, 10) ||
      !Number.isInteger(s.lives) ||
      !n(s.lives, 0, 3) ||
      !n(s.invulnerable, 0, 5) ||
      !Number.isInteger(s.checkpoint) ||
      !n(s.checkpoint, -1, this.world.roots.length)
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
    s.adventure = validateAdventure(s.adventure, this.world.food.length);
    const score = this.score(s);
    if (
      (s.adventure.finale > 0 && (score < ADULT_XP || s.failed)) ||
      s.nutrients > CAPACITY + Math.min(2, Math.floor(score / 80)) * 2
    )
      throw Error('Zapis: niespójna dojrzałość');
    if (
      s.completed !== (s.adventure.finale === 4) ||
      s.failed !== (s.lives === 0) ||
      (s.completed && s.failed) ||
      (s.checkpoint === this.world.roots.length &&
        !s.adventure.fungi.every(Boolean)) ||
      (s.checkpoint >= 0 &&
        s.checkpoint < this.world.roots.length &&
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
          !n(p.y, SURFACE, this.world.height - 16) ||
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
          (v !== 1 && v !== 3) ||
          this.base(i % grid.columns, Math.floor(i / grid.columns)) !== 0,
      )
    )
      throw Error('Zapis: nieprawidłowe tunele');
    return s;
  }
  restore(value: unknown) {
    const next = this.validateSave(value);
    this.state = next;
    this.terrain.restore(next.tunnels);
    this.resetMotion();
  }
}
