import { OccupancyReservations } from '../../engine/api/mobility';
import type { Cell } from '../../engine/api/strategy';
import { UNIT, driveable, walkable } from './world';
import type { Motion } from './types';

export function motion(
  id: string,
  kind: Motion['kind'],
  p: Cell,
  heading = 0,
): Motion {
  return {
    id,
    kind,
    x: p.x * UNIT,
    y: p.y * UNIT,
    heading,
    nextHeading: heading,
    turn: 0,
    route: [],
    remainder: 0,
    blocked: 0,
  };
}
export const point = (m: Motion): Cell => ({ x: m.x / UNIT, y: m.y / UNIT });
export const at = (m: Motion, p: Cell) =>
  m.x === p.x * UNIT && m.y === p.y * UNIT && !m.turn;
export function footprint(m: Motion, x = m.x, y = m.y, turn = m.turn) {
  // Vehicles retain a conservative manoeuvring envelope while driving. A
  // follower cannot occupy the rear corner needed by the leader's next turn.
  let w = m.kind === 'person' ? 192 : m.kind === 'truck' ? 2048 : 1024;
  let h = w;
  if (turn && m.kind !== 'person') w = h = m.kind === 'truck' ? 2048 : 1024;
  else if (m.heading % 2 === 0) [w, h] = [h, w];
  const cells: Cell[] = [];
  for (
    let cy = Math.floor((y - h / 2) / UNIT);
    cy < Math.ceil((y + h / 2) / UNIT);
    cy++
  )
    for (
      let cx = Math.floor((x - w / 2) / UNIT);
      cx < Math.ceil((x + w / 2) / UNIT);
      cx++
    )
      cells.push({ x: cx, y: cy });
  return cells;
}
export function legal(m: Motion, cells: Cell[]) {
  return cells.every(m.kind === 'person' ? walkable : driveable);
}
export function path(m: Motion, stops: Cell[]) {
  const route: Cell[] = [];
  let previous = point(m);
  for (const target of stops) {
    if (previous.x !== target.x && previous.y !== target.y)
      route.push({ x: target.x, y: previous.y });
    if (previous.x !== target.x || previous.y !== target.y)
      route.push({ ...target });
    previous = target;
  }
  m.route = route;
  m.blocked = 0;
}

/** Grid reservations include the complete turning square, never just a vehicle's centre. */
export function move(m: Motion, occupancy: OccupancyReservations) {
  if (m.turn) {
    m.turn--;
    if (!m.turn) {
      m.heading = m.nextHeading;
      occupancy.tryClaim(m.id, footprint(m));
    }
    return;
  }
  const target = m.route[0];
  if (!target) return;
  const dx = target.x * UNIT - m.x,
    dy = target.y * UNIT - m.y;
  if (!dx && !dy) {
    m.route.shift();
    return;
  }
  if (dx && dy) throw Error('Stacja: ukośny odcinek trasy');
  const heading = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
  if (m.heading !== heading && m.kind !== 'person') {
    const turning = footprint(m, m.x, m.y, 1);
    if (!legal(m, turning) || !occupancy.tryClaim(m.id, turning)) {
      m.blocked++;
      return;
    }
    m.nextHeading = heading;
    m.turn = m.kind === 'truck' ? 16 : 8;
    m.blocked = 0;
    return;
  }
  m.heading = heading;
  const unitsPerSecond =
    m.kind === 'car' ? 1024 : m.kind === 'truck' ? 896 : 768;
  const numerator = unitsPerSecond + m.remainder,
    step = Math.min(Math.floor(numerator / 20), Math.abs(dx || dy));
  const x = m.x + Math.sign(dx) * step,
    y = m.y + Math.sign(dy) * step;
  const destination = footprint(m, x, y),
    swept = [...footprint(m), ...destination];
  if (!legal(m, destination) || !occupancy.tryMove(m.id, swept, destination)) {
    m.blocked++;
    if (m.kind === 'person' && m.blocked % 20 === 0) detour(m, occupancy);
    return;
  }
  m.x = x;
  m.y = y;
  m.remainder = numerator % 20;
  m.blocked = 0;
  if (x === target.x * UNIT && y === target.y * UNIT) m.route.shift();
}

/** Bounded local avoidance around a person or parked car; no world-sized search. */
function detour(m: Motion, occupancy: OccupancyReservations) {
  const current = point(m),
    origin = { x: Math.round(current.x), y: Math.round(current.y) };
  const clear = (p: Cell) => {
    const cells = footprint(m, p.x * UNIT, p.y * UNIT);
    return legal(m, cells) && occupancy.available(m.id, cells);
  };
  const starts: { p: Cell; route: Cell[] }[] = [];
  // A person may stand between two occupied grid rows. Permit a perpendicular
  // sidestep at the existing fixed-point coordinate before snapping to a row.
  const corners = [
    current,
    ...[-1, 1].map((dx) => ({ x: current.x + dx, y: current.y })),
    ...[-1, 1].map((dy) => ({ x: current.x, y: current.y + dy })),
  ];
  for (const corner of corners) {
    if (!clear(corner)) continue;
    for (const x of new Set([Math.floor(corner.x), Math.ceil(corner.x)]))
      for (const y of new Set([Math.floor(corner.y), Math.ceil(corner.y)])) {
        const p = { x, y };
        // Another obstruction can interrupt a previous sidestep with both
        // coordinates fractional. Keep that second grid join orthogonal too.
        for (const join of [
          { x: p.x, y: corner.y },
          { x: corner.x, y: p.y },
        ]) {
          if (!clear(join) || !clear(p)) continue;
          const route = [corner, join, p].filter(
            (p, i, a) =>
              !(p.x === current.x && p.y === current.y) &&
              (!i || p.x !== a[i - 1].x || p.y !== a[i - 1].y),
          );
          starts.push({ p, route });
        }
      }
  }
  if (!starts.length) return;
  const targets = m.route.slice(0, 20);
  const queue = starts;
  const visited = new Set<string>(starts.map((s) => `${s.p.x},${s.p.y}`));
  for (let i = 0; i < queue.length && i < 289; i++) {
    const { p, route } = queue[i];
    const index = targets.findIndex((t) => t.x === p.x && t.y === p.y);
    if (index >= 0 && route.length > 1) {
      m.route = [...route, ...m.route.slice(index + 1)];
      return;
    }
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
    ]) {
      const next = { x: p.x + dx, y: p.y + dy },
        k = `${next.x},${next.y}`;
      if (
        visited.has(k) ||
        Math.abs(next.x - origin.x) > 8 ||
        Math.abs(next.y - origin.y) > 8
      )
        continue;
      visited.add(k);
      const cells = footprint(m, next.x * UNIT, next.y * UNIT);
      if (legal(m, cells) && occupancy.available(m.id, cells))
        queue.push({ p: next, route: [...route, next] });
    }
  }
}
