import type { Cell } from '../../engine/api/strategy';
import type { Weather } from './climate';
export type WaterKind = 'tank' | 'pump' | 'sprinkler';
export type WaterMode = 'off' | 'auto' | 'on';
export const waterCosts = {
  tank: 120000,
  pump: 100000,
  sprinkler: 30000,
  pipe: 400,
};
export const WATER_CAPACITY = 1000000,
  SPRINKLER_RADIUS = 7;
export interface WaterDevice extends Cell {
  id: string;
  kind: WaterKind;
  mode: WaterMode;
  volume: number;
  delivery: { due: number; amount: number } | null;
}
export interface WaterState {
  revision: number;
  devices: WaterDevice[];
  pipes: Cell[];
  used: number;
  supplied: number;
  rain: number;
  discarded: number;
  energy: number;
  paidEnergy: number;
}
export const newWater = (): WaterState => ({
  revision: 0,
  devices: [],
  pipes: [],
  used: 0,
  supplied: 0,
  rain: 0,
  discarded: 0,
  energy: 0,
  paidEnergy: 0,
});
const key = (p: Cell) => `${p.x},${p.y}`;
export class WaterNetwork {
  private revision = -1;
  private groups: WaterDevice[][] = [];
  readonly flow = new Map<string, number>();
  readonly connected = new Set<string>();
  readonly running = new Set<string>();
  constructor(readonly state: WaterState) {}
  refresh() {
    if (this.revision !== this.state.revision) this.rebuild();
  }
  private rebuild() {
    this.revision = this.state.revision;
    this.groups = [];
    this.connected.clear();
    const cells = new Map(
      [...this.state.pipes, ...this.state.devices].map((p) => [key(p), p]),
    );
    const devices = new Map(this.state.devices.map((d) => [key(d), d]));
    while (cells.size) {
      const start = cells.values().next().value!;
      const queue: Cell[] = [start],
        group: WaterDevice[] = [];
      cells.delete(key(start));
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i],
          d = devices.get(key(p));
        if (d) group.push(d);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = cells.get(key({ x: p.x + dx, y: p.y + dy }));
          if (n) {
            cells.delete(key(n));
            queue.push(n);
          }
        }
      }
      this.groups.push(group);
      if (
        group.some((d) => d.kind === 'pump') &&
        group.some((d) => d.kind === 'tank')
      )
        for (const d of group) this.connected.add(d.id);
    }
  }
  step(
    tick: number,
    weather: Weather,
    powered: boolean,
    needed: (d: WaterDevice) => boolean,
  ) {
    this.refresh();
    this.flow.clear();
    this.running.clear();
    for (const d of this.state.devices)
      if (d.kind === 'tank') {
        if (d.delivery && tick >= d.delivery.due) {
          const n = Math.min(d.delivery.amount, WATER_CAPACITY - d.volume);
          d.volume += n;
          this.state.supplied += n;
          d.delivery = null;
        }
        if (weather.rain && tick % 20 === 0) {
          const n = Math.min(
            weather.rain * 1000,
            WATER_CAPACITY - d.volume - (d.delivery?.amount ?? 0),
          );
          d.volume += n;
          this.state.rain += n;
        }
      }
    if (!powered) return;
    for (const group of this.groups) {
      const pumps = group.filter((d) => d.kind === 'pump' && d.mode !== 'off');
      const tanks = group.filter((d) => d.kind === 'tank');
      const active = group.filter(
        (d) =>
          d.kind === 'sprinkler' &&
          (d.mode === 'on' || (d.mode === 'auto' && needed(d))),
      );
      if (!pumps.length || !active.length) continue;
      const demand = 10 + weather.wind * 2;
      let available = Math.min(
        pumps.length * 100,
        tanks.reduce((n, t) => n + t.volume, 0),
      );
      // Equal share, then stable ID order for the remaining millilitres.
      const each = Math.min(demand, Math.floor(available / active.length));
      let extra = Math.min(active.length, available - each * active.length),
        used = 0;
      for (const d of active) {
        const amount = Math.min(demand, each + (extra-- > 0 ? 1 : 0));
        this.flow.set(d.id, amount / demand);
        used += amount;
      }
      available = used;
      for (const tank of tanks) {
        const n = Math.min(tank.volume, available);
        tank.volume -= n;
        available -= n;
      }
      this.state.used += used;
      if (used) {
        this.state.energy += pumps.length;
        for (const p of pumps) this.running.add(p.id);
      }
    }
  }
  coverage(p: Cell) {
    let best = 0;
    for (const d of this.state.devices)
      if (
        d.kind === 'sprinkler' &&
        Math.hypot(d.x - p.x, d.y - p.y) <= SPRINKLER_RADIUS
      )
        best = Math.max(best, this.flow.get(d.id) ?? 0);
    return best;
  }
}
