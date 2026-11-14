import { Navigator } from './navigation';
import type {
  ActorState,
  Cell,
  JobKind,
  SimulationLevel,
  SimulationNode,
  SimulationState,
} from './types';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const amount = (stock: Record<string, number>) =>
  Object.values(stock).reduce((sum, value) => sum + value, 0);
export class SimulationModel {
  state: SimulationState;
  selected: string | null = null;
  dirty = false;
  revision = 0;
  private previous = new Map<string, Cell>();
  readonly navigator: Navigator;
  readonly initialValue: number;
  constructor(readonly level: SimulationLevel) {
    this.navigator = new Navigator(level);
    this.state = this.fresh();
    this.initialValue = this.resourceValue();
  }
  fresh(): SimulationState {
    return {
      schemaVersion: 1,
      ...(this.level.schemaVersion === 2 ? { remainder: 0 } : {}),
      mapId: this.level.id,
      seconds: 0,
      serial: 0,
      completed: false,
      actors: this.level.actors.map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        cargo: {},
        queue: [],
        current: null,
        blocked: false,
      })),
      nodes: this.level.nodes.map((n) => ({
        id: n.id,
        stock: { ...n.stock },
        enabled: false,
        progress: 0,
      })),
    };
  }
  reset() {
    this.state = this.fresh();
    this.previous.clear();
    this.selected = null;
    this.changed();
  }
  changed() {
    this.dirty = true;
    this.revision++;
  }
  node(id: string) {
    return this.state.nodes.find((n) => n.id === id)!;
  }
  definition(id: string) {
    return this.level.nodes.find((n) => n.id === id)!;
  }
  actorDefinition(id: string) {
    return this.level.actors.find((a) => a.id === id)!;
  }
  resourceValue(state = this.state) {
    const value = (stock: Record<string, number>) =>
      Object.entries(stock).reduce(
        (sum, [id, n]) =>
          sum +
          n * (this.level.resources.find((r) => r.id === id)?.unitValue ?? NaN),
        0,
      );
    return (
      state.nodes.reduce((sum, n) => sum + value(n.stock), 0) +
      state.actors.reduce((sum, a) => sum + value(a.cargo), 0)
    );
  }
  get produced() {
    return (
      this.node(this.level.goal.storage).stock[this.level.goal.resource] ?? 0
    );
  }
  get harvested() {
    return this.level.nodes
      .filter((n) => n.kind === 'source')
      .reduce(
        (sum, def) => sum + amount(def.stock) - amount(this.node(def.id).stock),
        0,
      );
  }
  get total() {
    return this.level.nodes
      .filter((n) => n.kind === 'source')
      .reduce((sum, def) => sum + amount(def.stock), 0);
  }
  select(id: string | null) {
    if (id === null || this.state.actors.some((a) => a.id === id))
      this.selected = id;
  }
  private reserved(target: string) {
    return this.state.actors.some(
      (a) =>
        (a.current?.target === target && !a.current.cancelled) ||
        a.queue.some((j) => j.target === target),
    );
  }
  gather(target: string) {
    const source = this.level.nodes.find(
      (n) => n.id === target && n.kind === 'source',
    );
    if (
      !source ||
      this.state.completed ||
      amount(this.node(target).stock) === 0 ||
      this.reserved(target)
    )
      return false;
    const workers = this.state.actors.filter(
      (a) => this.actorDefinition(a.id).kind === 'worker',
    );
    const selected = workers.find((a) => a.id === this.selected);
    const actor =
      selected ??
      workers.sort(
        (a, b) =>
          a.queue.length +
          Number(!!a.current) -
          (b.queue.length + Number(!!b.current)),
      )[0];
    return !!actor && this.enqueue(actor, 'gather', target);
  }
  transport(kind: 'load' | 'deliver', target: string) {
    if (this.state.completed) return false;
    const node = this.level.nodes.find(
      (n) =>
        n.id === target && n.kind === (kind === 'load' ? 'depot' : 'processor'),
    );
    const actor =
      this.state.actors.find(
        (a) =>
          a.id === this.selected &&
          this.actorDefinition(a.id).kind === 'vehicle',
      ) ??
      this.state.actors.find(
        (a) => this.actorDefinition(a.id).kind === 'vehicle',
      );
    if (
      !node ||
      !actor ||
      (kind === 'deliver' &&
        !amount(actor.cargo) &&
        actor.current?.kind !== 'load' &&
        !actor.queue.some((j) => j.kind === 'load'))
    )
      return false;
    this.selected = actor.id;
    return this.enqueue(actor, kind, target);
  }
  private enqueue(actor: ActorState, kind: JobKind, target: string) {
    if (
      actor.queue.length >= 32 ||
      (actor.current?.kind === kind && actor.current.target === target) ||
      actor.queue.some((j) => j.kind === kind && j.target === target)
    )
      return false;
    actor.queue.push({ id: ++this.state.serial, kind, target });
    actor.blocked = false;
    this.changed();
    return true;
  }
  toggleProcessor(id: string) {
    if (this.definition(id)?.kind !== 'processor' || this.state.completed)
      return;
    this.node(id).enabled = !this.node(id).enabled;
    this.changed();
  }
  cancelSelected() {
    const actor = this.state.actors.find((a) => a.id === this.selected);
    if (!actor) return;
    actor.queue = [];
    actor.blocked = false;
    if (
      this.actorDefinition(actor.id).kind === 'worker' &&
      amount(actor.cargo) &&
      actor.current
    ) {
      actor.current.cancelled = true;
      actor.current.phase = 'return';
      actor.current.progress = 0;
      this.route(
        actor,
        this.definition(this.actorDefinition(actor.id).depot).access,
      );
    } else actor.current = null;
    this.changed();
  }
  status(actor: ActorState) {
    if (actor.blocked) return 'blocked';
    const task = actor.current;
    if (!task) return 'idle';
    if (task.path.length) return 'moving';
    if (task.kind === 'load' && !amount(this.node(task.target).stock))
      return 'waiting';
    return task.phase === 'work'
      ? 'working'
      : task.phase === 'deposit'
        ? 'unloading'
        : 'moving';
  }
  private route(actor: ActorState, target: Cell) {
    const task = actor.current!;
    const from = { x: Math.round(actor.x), y: Math.round(actor.y) };
    const path = this.navigator.findPath(
      from,
      target,
      this.actorDefinition(actor.id).kind === 'vehicle',
    );
    if (path === null) {
      actor.blocked = true;
      actor.current = null;
      this.changed();
      return false;
    }
    task.path =
      Math.hypot(actor.x - from.x, actor.y - from.y) > 0.001
        ? [from, ...path]
        : path;
    actor.blocked = false;
    return true;
  }
  private workPoint(def: SimulationNode) {
    const resource = def.harvestResource!,
      initial = def.stock[resource],
      remaining = this.node(def.id).stock[resource] ?? 0;
    const points = def.workPoints!;
    return points[
      Math.min(
        points.length - 1,
        Math.floor(((initial - remaining) / initial) * points.length),
      )
    ];
  }
  private start(actor: ActorState) {
    const next = actor.queue.shift();
    if (!next) return;
    actor.current = {
      ...next,
      phase: 'approach',
      path: [],
      progress: 0,
      waiting: 0,
      cancelled: false,
    };
    const target = this.definition(next.target);
    this.route(
      actor,
      next.kind === 'gather' ? this.workPoint(target) : target.access,
    );
    this.changed();
  }
  private transfer(
    from: Record<string, number>,
    to: Record<string, number>,
    resource: string,
    count: number,
  ) {
    if (!Number.isInteger(count) || count < 1 || (from[resource] ?? 0) < count)
      throw Error('Nieprawidłowy transfer zasobów');
    from[resource] -= count;
    to[resource] = (to[resource] ?? 0) + count;
    this.changed();
  }
  visualPosition(actor: ActorState): Cell {
    const previous = this.previous.get(actor.id);
    if (!previous || this.level.schemaVersion === 1) return actor;
    const t = Math.min(1, (this.state.remainder ?? 0) / 0.05);
    return {
      x: previous.x + (actor.x - previous.x) * t,
      y: previous.y + (actor.y - previous.y) * t,
    };
  }
  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60)
      throw Error('Nieprawidłowy czas symulacji');
    if (this.state.completed) return;
    if (this.level.schemaVersion === 2) {
      this.state.remainder = (this.state.remainder ?? 0) + seconds;
      while (this.state.remainder >= 0.05 - 1e-9 && !this.state.completed) {
        this.previous = new Map(
          this.state.actors.map((a) => [a.id, { x: a.x, y: a.y }]),
        );
        this.tick(0.05);
        this.state.remainder = Math.max(0, this.state.remainder - 0.05);
      }
      if (this.state.completed) this.state.remainder = 0;
      return;
    }
    let remaining = seconds;
    while (remaining > 0.000001 && !this.state.completed) {
      const delta = Math.min(0.05, remaining);
      this.tick(delta);
      remaining -= delta;
    }
  }
  private tick(delta: number) {
    this.state.seconds += delta;
    for (const actor of this.state.actors) this.updateActor(actor, delta);
    for (const definition of this.level.nodes.filter(
      (n) => n.kind === 'processor',
    )) {
      const node = this.node(definition.id),
        recipe = definition.recipe!,
        destination = this.node(recipe.destination),
        cap = this.definition(recipe.destination).capacity ?? Infinity;
      if (
        !node.enabled ||
        (node.stock[recipe.input] ?? 0) < recipe.inputAmount ||
        amount(destination.stock) + recipe.outputAmount > cap
      )
        continue;
      node.progress += delta;
      if (node.progress >= recipe.seconds) {
        node.progress -= recipe.seconds;
        node.stock[recipe.input] -= recipe.inputAmount;
        destination.stock[recipe.output] =
          (destination.stock[recipe.output] ?? 0) + recipe.outputAmount;
        this.changed();
      }
    }
    if (this.produced >= this.level.goal.amount) {
      this.state.completed = true;
      this.changed();
    }
  }
  private updateActor(actor: ActorState, delta: number) {
    if (!actor.current) this.start(actor);
    const task = actor.current;
    if (!task) return;
    const definition = this.actorDefinition(actor.id),
      target = this.definition(task.target);
    if (task.path.length) {
      const point = task.path[0],
        dx = point.x - actor.x,
        dy = point.y - actor.y,
        distance = Math.hypot(dx, dy),
        travel = definition.speed * delta;
      if (distance <= travel) {
        actor.x = point.x;
        actor.y = point.y;
        task.path.shift();
      } else {
        actor.x += (dx / distance) * travel;
        actor.y += (dy / distance) * travel;
      }
      return;
    }
    if (task.phase === 'approach') {
      task.phase = 'work';
      task.progress = 0;
    }
    if (task.kind === 'gather') {
      if (task.phase === 'work') {
        const source = this.node(target.id),
          resource = target.harvestResource!;
        if (
          !source.stock[resource] ||
          amount(actor.cargo) >= definition.capacity
        ) {
          task.phase = 'return';
          task.progress = 0;
          this.route(actor, this.definition(definition.depot).access);
          return;
        }
        task.progress += delta;
        if (task.progress >= target.harvestSeconds!) {
          task.progress -= target.harvestSeconds!;
          this.transfer(source.stock, actor.cargo, resource, 1);
          if (
            amount(actor.cargo) >= definition.capacity ||
            source.stock[resource] === 0
          ) {
            task.phase = 'return';
            this.route(actor, this.definition(definition.depot).access);
          } else {
            task.phase = 'approach';
            this.route(actor, this.workPoint(target));
          }
        }
      } else if (task.phase === 'return' || task.phase === 'deposit') {
        task.phase = 'deposit';
        task.progress += delta;
        if (task.progress >= definition.unloadSeconds) {
          const depot = this.node(definition.depot);
          for (const [resource, count] of Object.entries(actor.cargo))
            if (count) this.transfer(actor.cargo, depot.stock, resource, count);
          if (!task.cancelled && amount(this.node(target.id).stock)) {
            task.phase = 'approach';
            task.progress = 0;
            this.route(actor, this.workPoint(target));
          } else {
            actor.current = null;
            this.changed();
          }
        }
      }
    } else if (task.kind === 'load') {
      const stock = this.node(target.id).stock,
        resource = this.level.resources.find((r) => (stock[r.id] ?? 0) > 0)?.id;
      if (amount(actor.cargo) >= definition.capacity) {
        actor.current = null;
        this.changed();
        return;
      }
      if (!resource) {
        task.waiting += delta;
        if (amount(actor.cargo) > 0 && task.waiting > 2) {
          actor.current = null;
          this.changed();
        }
      } else {
        task.waiting = 0;
        task.progress += delta;
        if (task.progress >= definition.loadSeconds) {
          task.progress -= definition.loadSeconds;
          this.transfer(stock, actor.cargo, resource, 1);
        }
      }
    } else if (task.kind === 'deliver') {
      const resource = target.recipe!.input;
      if (!(actor.cargo[resource] > 0)) {
        actor.current = null;
        this.changed();
        return;
      }
      task.phase = 'deposit';
      task.progress += delta;
      if (task.progress >= definition.unloadSeconds) {
        task.progress -= definition.unloadSeconds;
        this.transfer(actor.cargo, this.node(target.id).stock, resource, 1);
      }
    }
  }
  restore(raw: unknown): boolean {
    try {
      const state = clone(raw) as SimulationState;
      if (
        !state ||
        state.schemaVersion !== 1 ||
        (this.level.schemaVersion === 2 &&
          (!Number.isFinite(state.remainder) ||
            state.remainder! < 0 ||
            state.remainder! >= 0.05)) ||
        state.mapId !== this.level.id ||
        !Number.isFinite(state.seconds) ||
        state.seconds < 0 ||
        !Number.isInteger(state.serial) ||
        state.serial < 0 ||
        typeof state.completed !== 'boolean' ||
        !Array.isArray(state.actors) ||
        !Array.isArray(state.nodes) ||
        state.actors.length !== this.level.actors.length ||
        state.nodes.length !== this.level.nodes.length
      )
        return false;
      const validStock = (stock: unknown) =>
        !!stock &&
        typeof stock === 'object' &&
        !Array.isArray(stock) &&
        Object.entries(stock).every(
          ([resource, value]) =>
            this.level.resources.some((r) => r.id === resource) &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 100000,
        );
      if (
        new Set(state.nodes.map((n) => n.id)).size !== state.nodes.length ||
        new Set(state.actors.map((a) => a.id)).size !== state.actors.length
      )
        return false;
      for (const n of state.nodes)
        if (
          !this.level.nodes.some((d) => d.id === n.id) ||
          !validStock(n.stock) ||
          typeof n.enabled !== 'boolean' ||
          !Number.isFinite(n.progress) ||
          n.progress < 0 ||
          n.progress > 120
        )
          return false;
      const jobIds = new Set<number>();
      for (const a of state.actors) {
        const d = this.level.actors.find((d) => d.id === a.id);
        if (
          !d ||
          !Number.isFinite(a.x) ||
          !Number.isFinite(a.y) ||
          !this.navigator.walkable(
            { x: Math.round(a.x), y: Math.round(a.y) },
            d.kind === 'vehicle',
          ) ||
          !validStock(a.cargo) ||
          amount(a.cargo) > d.capacity ||
          typeof a.blocked !== 'boolean' ||
          !Array.isArray(a.queue) ||
          a.queue.length > 32
        )
          return false;
        for (const task of [...a.queue, ...(a.current ? [a.current] : [])]) {
          if (
            !task ||
            !Number.isInteger(task.id) ||
            task.id < 1 ||
            task.id > state.serial ||
            jobIds.has(task.id)
          )
            return false;
          jobIds.add(task.id);
          const expected = {
            gather: 'source',
            load: 'depot',
            deliver: 'processor',
          }[task.kind];
          if (
            !expected ||
            !this.level.nodes.some(
              (n) => n.id === task.target && n.kind === expected,
            ) ||
            (d.kind === 'worker') !== (task.kind === 'gather')
          )
            return false;
        }
        if (a.current) {
          const t = a.current;
          if (
            !['approach', 'work', 'return', 'deposit'].includes(t.phase) ||
            !Number.isFinite(t.progress) ||
            t.progress < 0 ||
            t.progress > 120 ||
            !Number.isFinite(t.waiting) ||
            t.waiting < 0 ||
            typeof t.cancelled !== 'boolean' ||
            !Array.isArray(t.path) ||
            t.path.length > this.level.width * this.level.height
          )
            return false;
          let previous: Cell = { x: Math.round(a.x), y: Math.round(a.y) };
          for (const p of t.path) {
            if (
              !p ||
              !this.navigator.walkable(p, d.kind === 'vehicle') ||
              Math.abs(p.x - previous.x) + Math.abs(p.y - previous.y) > 1
            )
              return false;
            previous = p;
          }
        }
      }
      if (
        Math.abs(this.resourceValue(state) - this.initialValue) > 0.00001 ||
        state.completed !==
          (state.nodes.find((n) => n.id === this.level.goal.storage)?.stock[
            this.level.goal.resource
          ] ?? 0) >=
            this.level.goal.amount
      )
        return false;
      this.previous.clear();
      this.state = state;
      this.selected = null;
      this.dirty = false;
      return true;
    } catch {
      return false;
    }
  }
}
