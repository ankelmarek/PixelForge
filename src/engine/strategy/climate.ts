/** Stateless independent random streams: sampling a forecast cannot advance weather. */
export function randomSample(
  seed: number,
  stream: number,
  index: number,
): number {
  let x =
    (seed ^
      Math.imul(stream + 1, 0x9e3779b9) ^
      Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export interface TimedEvent<T> {
  start: number;
  end: number;
  value: T;
}
export class ClimateEventService<T> {
  readonly events: readonly TimedEvent<T>[];
  constructor(events: TimedEvent<T>[]) {
    if (
      events.some(
        (e) =>
          !Number.isSafeInteger(e.start) ||
          !Number.isSafeInteger(e.end) ||
          e.start < 0 ||
          e.end <= e.start,
      )
    )
      throw Error('Invalid climate event interval');
    this.events = structuredClone(events).sort((a, b) => a.start - b.start);
  }
  active(tick: number) {
    return this.events.filter((e) => e.start <= tick && tick < e.end);
  }
}
