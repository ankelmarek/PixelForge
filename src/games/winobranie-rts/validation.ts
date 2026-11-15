import { ownsAll } from '../../engine/api/strategy';
import type { VineyardState } from './model';
import { varieties, terrainBlocked } from './world';
import { WATER_CAPACITY } from './water';

/** Validate the persisted simulation, including the water mass balance. Caches are rebuilt. */
export function validateEnvironment(s: VineyardState) {
  const fail = () => {
    throw Error('Winobranie RTS: uszkodzony zapis sezonu');
  };
  const int = (n: unknown, max = 1000000000) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
  const record = (o: unknown) =>
    !!o && typeof o === 'object' && !Array.isArray(o);
  const e = s.environment;
  if (e === null) return;
  if (
    !record(e) ||
    !int(e.seed, 0xffffffff) ||
    !int(e.potentialLost) ||
    !record(e.crops) ||
    Object.keys(e.crops).length !== s.rows.length ||
    !record(e.water)
  )
    return fail();
  for (const r of s.rows) {
    if (
      !r ||
      !Object.hasOwn(varieties, r.variety) ||
      !Array.isArray(r.cells) ||
      !Object.hasOwn(e.crops, r.id)
    )
      return fail();
    const c = e.crops[r.id];
    if (
      !record(c) ||
      !int(c.age, 3) ||
      !int(c.care, 120) ||
      !Array.isArray(c.plots) ||
      c.plots.length !== Math.ceil(r.cells.length / 8) ||
      !c.plots.length
    )
      return fail();
    for (const p of c.plots) {
      if (
        !record(p) ||
        !int(p.heat, varieties[r.variety].heat + 1000) ||
        !int(p.moisture, 10000) ||
        !int(p.buds, 10000) ||
        !int(p.mildew, 3500) ||
        !int(p.ice, 200) ||
        !int(p.thaw, 200) ||
        typeof p.interrupted !== 'boolean' ||
        typeof p.yielded !== 'boolean' ||
        p.yielded !== p.heat >= varieties[r.variety].heat ||
        (p.interrupted && !p.ice)
      )
        return fail();
    }
    if (r.mature !== c.plots.every((p) => p.yielded)) return fail();
  }
  const w = e.water;
  if (
    ![
      w.revision,
      w.used,
      w.supplied,
      w.rain,
      w.discarded,
      w.energy,
      w.paidEnergy,
    ].every((n) => int(n)) ||
    w.paidEnergy > w.energy ||
    w.energy - w.paidEnergy > 80 ||
    !Array.isArray(w.devices) ||
    w.devices.length > 32 ||
    !Array.isArray(w.pipes) ||
    w.pipes.length > 2048
  )
    return fail();
  const positions = new Set<string>();
  for (const d of w.devices) {
    if (
      !record(d) ||
      !int(d.x, 511) ||
      !int(d.y, 511) ||
      typeof d.id !== 'string' ||
      !/^[\w-]{1,80}$/.test(d.id) ||
      !['tank', 'pump', 'sprinkler'].includes(d.kind) ||
      !['off', 'auto', 'on'].includes(d.mode) ||
      !int(d.volume, WATER_CAPACITY) ||
      (d.kind !== 'tank' && (d.volume !== 0 || d.delivery !== null)) ||
      positions.has(`${d.x},${d.y}`)
    )
      return fail();
    positions.add(`${d.x},${d.y}`);
    if (
      d.delivery !== null &&
      (!record(d.delivery) ||
        !int(d.delivery.due, s.tick + 400) ||
        d.delivery.due <= s.tick ||
        !int(d.delivery.amount, 500000) ||
        d.delivery.amount <= 0 ||
        d.delivery.amount + d.volume > WATER_CAPACITY)
    )
      return fail();
  }
  for (const kind of ['tank', 'pump', 'sprinkler'])
    if (
      w.devices.filter((d) => d.kind === kind).length >
      (kind === 'sprinkler' ? 24 : 4)
    )
      return fail();
  positions.clear();
  for (const p of w.pipes) {
    if (
      !record(p) ||
      !int(p.x, 511) ||
      !int(p.y, 511) ||
      terrainBlocked(p.x, p.y) ||
      !ownsAll([p], s.parcels) ||
      positions.has(`${p.x},${p.y}`)
    )
      return fail();
    positions.add(`${p.x},${p.y}`);
  }
  if (
    w.devices.reduce((n, d) => n + d.volume, 0) + w.used + w.discarded !==
    w.supplied + w.rain
  )
    return fail();
}
