export interface OccupiedCell {
  x: number;
  y: number;
}
const key = (p: OccupiedCell) => `${p.x},${p.y}`;
const valid = (p: OccupiedCell) =>
  p && Number.isSafeInteger(p.x) && Number.isSafeInteger(p.y);

/** Atomic spatial claims. Rendering and the meaning of a resource belong to clients. */
export class OccupancyReservations {
  private owners = new Map<string, string>();
  private claims = new Map<string, string[]>();
  ownerAt(p: OccupiedCell) {
    return this.owners.get(key(p));
  }
  available(owner: string, cells: readonly OccupiedCell[]) {
    return cells.every((p) => !this.ownerAt(p) || this.ownerAt(p) === owner);
  }
  tryMove(
    owner: string,
    swept: readonly OccupiedCell[],
    destination: readonly OccupiedCell[],
  ) {
    if (
      !owner ||
      !destination.length ||
      ![...swept, ...destination].every(valid) ||
      !this.available(owner, [...swept, ...destination])
    )
      return false;
    this.release(owner);
    const keys = [...new Set(destination.map(key))];
    keys.forEach((k) => this.owners.set(k, owner));
    this.claims.set(owner, keys);
    return true;
  }
  tryClaim(owner: string, cells: readonly OccupiedCell[]) {
    return this.tryMove(owner, cells, cells);
  }
  release(owner: string) {
    for (const k of this.claims.get(owner) ?? []) this.owners.delete(k);
    this.claims.delete(owner);
  }
  get size() {
    return this.claims.size;
  }
}

export interface QueueEntry {
  id: string;
  tick: number;
  serial: number;
}
/** Stable FIFO, serializable without retaining view objects. */
export class SlotQueue {
  constructor(
    readonly entries: QueueEntry[],
    readonly capacity: number,
  ) {
    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      entries.length > capacity ||
      new Set(entries.map((e) => e.id)).size !== entries.length ||
      entries.some(
        (e, i) =>
          !e.id ||
          !Number.isSafeInteger(e.tick) ||
          e.tick < 0 ||
          !Number.isSafeInteger(e.serial) ||
          e.serial < 0 ||
          (i > 0 &&
            (entries[i - 1].tick > e.tick ||
              (entries[i - 1].tick === e.tick &&
                entries[i - 1].serial >= e.serial))),
      )
    )
      throw Error('Niepoprawna kolejka');
  }
  get head() {
    return this.entries[0]?.id;
  }
  join(entry: QueueEntry) {
    if (
      !entry.id ||
      this.entries.length >= this.capacity ||
      this.entries.some((e) => e.id === entry.id)
    )
      return false;
    const last = this.entries.at(-1);
    if (
      !Number.isSafeInteger(entry.tick) ||
      !Number.isSafeInteger(entry.serial) ||
      entry.tick < 0 ||
      entry.serial < 0 ||
      (last &&
        (last.tick > entry.tick ||
          (last.tick === entry.tick && last.serial >= entry.serial)))
    )
      return false;
    this.entries.push({ ...entry });
    return true;
  }
  leave(id: string) {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index < 0) return false;
    this.entries.splice(index, 1);
    return true;
  }
}
