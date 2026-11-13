import type { Cell, GridRect, SimulationLevel } from './types';
const contains = (rect: GridRect, cell: Cell) =>
  cell.x >= rect.x &&
  cell.x < rect.x + rect.width &&
  cell.y >= rect.y &&
  cell.y < rect.y + rect.height;
export class Navigator {
  constructor(readonly level: SimulationLevel) {}
  walkable(cell: Cell, vehicle = false) {
    const radius = vehicle ? 1 : 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const test = { x: cell.x + dx, y: cell.y + dy };
        if (
          !Number.isInteger(test.x) ||
          !Number.isInteger(test.y) ||
          test.x < 0 ||
          test.y < 0 ||
          test.x >= this.level.width ||
          test.y >= this.level.height
        )
          return false;
        if (
          this.level.blockers.some((rect) => contains(rect, test)) ||
          this.level.nodes.some((node) => contains(node, test))
        )
          return false;
        if (vehicle && !this.level.roads.some((road) => contains(road, test)))
          return false;
      }
    return true;
  }
  findPath(from: Cell, to: Cell, vehicle = false): Cell[] | null {
    if (!this.walkable(from, vehicle) || !this.walkable(to, vehicle))
      return null;
    const key = (cell: Cell) => cell.y * this.level.width + cell.x;
    const start = key(from),
      finish = key(to),
      frontier = new Set([start]);
    const costs = new Map([[start, 0]]),
      parents = new Map<number, number>();
    const point = (index: number) => ({
      x: index % this.level.width,
      y: Math.floor(index / this.level.width),
    });
    const heuristic = (index: number) => {
      const p = point(index);
      return Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
    };
    while (frontier.size) {
      let current = -1,
        best = Infinity;
      for (const index of frontier) {
        const score = costs.get(index)! + heuristic(index);
        if (score < best) {
          best = score;
          current = index;
        }
      }
      if (current === finish) {
        const path: Cell[] = [];
        let index = finish;
        while (index !== start) {
          path.unshift(point(index));
          index = parents.get(index)!;
        }
        return path;
      }
      frontier.delete(current);
      const p = point(current);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const next = { x: p.x + dx, y: p.y + dy };
        if (!this.walkable(next, vehicle)) continue;
        const index = key(next),
          cost = costs.get(current)! + 1;
        if (cost < (costs.get(index) ?? Infinity)) {
          costs.set(index, cost);
          parents.set(index, current);
          frontier.add(index);
        }
      }
    }
    return null;
  }
}
