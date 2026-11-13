import { WormModel } from '../../src/games/earthworm/model';
import type { EarthwormWorld, Point } from '../../src/games/earthworm/world';

import {
  SURFACE,
  ADULT_XP,
  NEST,
  PLUG,
  BABY,
  CHAMBER,
  FUNGI,
  AIR_POCKETS,
  FLOOD,
  gap,
} from '../../src/games/earthworm/adventure';

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
      y < SURFACE + 24 ||
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
      for (let i = 0; i < 15; i++) model.tick(0.1);
      model.steer(goal.x, goal.y);
    }
    model.tick(0.1);
  }
  function path(goal: Point, water: boolean) {
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
          blocked[next] ||
          (!water &&
            nx * size > FLOOD.x - 32 &&
            nx * size < FLOOD.x + FLOOD.width + 32 &&
            ny * size > FLOOD.y - 32 &&
            ny * size < FLOOD.y + FLOOD.height + 32)
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
  function move(goal: Point, water = false) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let interrupted = false;
      for (const p of path(goal, water)) {
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
  function wait(seconds: number) {
    for (let i = 0; i < Math.ceil(seconds / 0.1); i++) safeStep(model.state);
  }
  function feedNear(point: Point, wanted = model.capacity) {
    const candidates = [...world.food].sort(
      (a, b) => gap(a, point) - gap(b, point),
    );
    for (const food of candidates.slice(0, 12)) {
      if (model.state.nutrients >= wanted) break;
      if (model.state.food[world.food.indexOf(food)] > 0) continue;
      move(food);
    }
  }
  for (const root of world.roots) {
    const pool = [...world.pools].sort(
      (a, b) => gap(a, root) - gap(b, root),
    )[0];
    move(pool);
    wait(5);
    for (
      let attempt = 0;
      attempt < 4 && model.state.roots[world.roots.indexOf(root)] < root.need;
      attempt++
    ) {
      feedNear(
        root,
        Math.min(
          model.capacity,
          root.need - model.state.roots[world.roots.indexOf(root)] + 2,
        ),
      );
      move(root);
      wait(2.6);
    }
    if (model.state.roots[world.roots.indexOf(root)] !== root.need)
      throw Error(
        'Unfed root ' +
          root.id +
          ' progress=' +
          model.state.roots[world.roots.indexOf(root)] +
          ' resources=' +
          model.state.nutrients +
          ' time=' +
          model.state.seconds +
          ' food=' +
          world.food
            .filter((f) => gap(f, root) < 150)
            .map((f) => model.state.food[world.food.indexOf(f)])
            .join(','),
      );
  }
  move({ x: PLUG.x, y: PLUG.y - 25 });
  for (let i = 0; i < 3; i++) model.interact();
  if (model.state.adventure.plug !== 3) throw Error('Plug not opened');
  move(BABY);
  wait(0.2);
  if (model.state.adventure.baby !== 'following')
    throw Error('Baby not following');
  move(NEST);
  wait(0.2);
  if (String(model.state.adventure.baby) !== 'home')
    throw Error('Baby not returned');
  move({ x: 2512, y: 2432 });
  move(AIR_POCKETS[0], true);
  wait(4);
  move(AIR_POCKETS[1], true);
  wait(4);
  move(CHAMBER, true);
  wait(0.2);
  move(AIR_POCKETS[1], true);
  wait(4);
  move(AIR_POCKETS[0], true);
  wait(4);
  move({ x: 2512, y: 2432 }, true);
  if (!model.state.adventure.chamber) throw Error('Chamber not discovered');
  for (const fungus of FUNGI) {
    feedNear(fungus, 3);
    move({ x: fungus.x, y: fungus.y - 24 });
    model.interact();
  }
  if (!model.state.adventure.fungi.every(Boolean))
    throw Error('Oasis not restored');
  if (model.experience < ADULT_XP)
    throw Error('Not enough XP: ' + model.experience);
  move(NEST);
  const beforeFinal = model.snapshot(),
    experience = model.experience;
  model.interact();
  wait(4.2);
  if (!model.state.completed) throw Error('Adulthood did not complete');
  return {
    beforeFinal,
    result: model.snapshot(),
    tunnelCells: model.terrain.count,
    experience,
  };
}
