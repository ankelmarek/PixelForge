import { WormModel, type WormState } from '../../src/games/earthworm/model';
import type { EarthwormWorld, Point } from '../../src/games/earthworm/world';

/** Test driver only: navigate the real model without teleporting, free resources or time gates. */
export function playCampaign(world: EarthwormWorld) {
  const model = new WormModel(world),
    size = 32,
    cols = world.width / size,
    rows = world.height / size;
  const blocked = Array.from({ length: cols * rows }, (_, i) => {
    const x = ((i % cols) + 0.5) * size,
      y = (Math.floor(i / cols) + 0.5) * size;
    return (
      x < 32 ||
      y < 32 ||
      x > world.width - 32 ||
      y > world.height - 32 ||
      world.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.radius + 26)
    );
  });
  function safeStep(goal: Point) {
    const near = () =>
      model.state.predators.some(
        (p) =>
          p.alert > 0.5 &&
          Math.hypot(p.x - model.state.x, p.y - model.state.y) < 80,
      );
    if (near()) {
      model.toggleHide();
      for (let i = 0; i < 300; i++) {
        model.tick(0.1);
        if (
          model.state.predators.every(
            (p) => Math.hypot(p.x - model.state.x, p.y - model.state.y) > 130,
          )
        )
          break;
      }
      model.steer(goal.x, goal.y);
    }
    model.tick(0.1);
  }
  function path(goal: Point) {
    const index = (p: Point) =>
      Math.floor(p.y / size) * cols + Math.floor(p.x / size);
    const start = index(model.state),
      finish = index(goal),
      parents = new Int32Array(cols * rows).fill(-1),
      queue = [start];
    parents[start] = start;
    for (let i = 0; i < queue.length && parents[finish] === -1; i++) {
      const cur = queue[i],
        x = cur % cols,
        y = Math.floor(cur / cols);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          next = ny * cols + nx;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= cols ||
          ny >= rows ||
          parents[next] !== -1 ||
          blocked[next]
        )
          continue;
        parents[next] = cur;
        queue.push(next);
      }
    }
    if (parents[finish] === -1) throw Error('Campaign target unreachable');
    const route: Point[] = [goal];
    for (let cur = finish; cur !== start; cur = parents[cur])
      route.unshift({
        x: ((cur % cols) + 0.5) * size,
        y: (Math.floor(cur / cols) + 0.5) * size,
      });
    return route;
  }
  function move(goal: Point) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let interrupted = false;
      for (const p of path(goal)) {
        model.steer(p.x, p.y);
        for (
          let i = 0;
          i < 35 && Math.hypot(model.state.x - p.x, model.state.y - p.y) > 3;
          i++
        )
          safeStep(p);
        if (model.state.failed)
          throw Error(
            `Campaign failed: blooms=${model.blooms}, seconds=${model.state.seconds}, target=${JSON.stringify(goal)}, predators=${JSON.stringify(model.state.predators)}`,
          );
        if (Math.hypot(model.state.x - p.x, model.state.y - p.y) > 4) {
          interrupted = true;
          break;
        }
      }
      if (!interrupted) return;
    }
    throw Error(
      `Campaign stuck at ${model.state.x},${model.state.y} en route to ${goal.x},${goal.y}`,
    );
  }
  let beforeFinal: WormState | undefined;
  for (const [i, root] of world.roots.entries()) {
    const pool = [...world.pools].sort(
      (a, b) =>
        Math.hypot(a.x - root.x, a.y - root.y) -
        Math.hypot(b.x - root.x, b.y - root.y),
    )[0];
    move(pool);
    for (let j = 0; j < 60; j++) model.tick(0.1);
    for (const food of world.food.slice(i * 6, i * 6 + 6)) {
      if (model.state.nutrients >= root.need) break;
      move(food);
    }
    if (model.state.nutrients < root.need)
      throw Error('Insufficient campaign food');
    if (i === world.roots.length - 1) beforeFinal = model.snapshot();
    move(root);
    for (let j = 0; j < 20; j++) safeStep(root);
    if (model.state.roots[i] !== root.need)
      throw Error(`Root ${root.id} incomplete`);
  }
  if (!model.state.completed || !beforeFinal)
    throw Error('Campaign did not complete');
  return {
    beforeFinal,
    result: model.snapshot(),
    tunnelCells: model.terrain.count,
  };
}
