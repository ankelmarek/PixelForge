import type { Point } from './world';

export const SURFACE = 384;
export const ADULT_XP = 300;
export const CAST_DISTANCE = 320;
export const NEST = { x: 640, y: 464 };
export const PLUG = { x: 1312, y: 1392 };
export const BABY = { x: 1888, y: 1904 };
export const FLOOD = { x: 2528, y: 2464, width: 352, height: 480 };
export const AIR_POCKETS = [
  { x: 2592, y: 2592 },
  { x: 2752, y: 2816 },
];
export const CHAMBER = { x: 2752, y: 2912 };
export const FUNGI = [
  { x: 1024, y: 2600 },
  { x: 880, y: 2800 },
  { x: 1056, y: 3000 },
  { x: 1248, y: 3152 },
];
export const DEEP_NEST = { x: 1216, y: 3264 };
export const AMBER = [
  { x: 1104, y: 1056 },
  { x: 1664, y: 1536 },
  { x: 2144, y: 2128 },
  { x: 2752, y: 2656 },
  { x: 2864, y: 2944 },
  { x: 1536, y: 3200 },
  { x: 864, y: 3568 },
  { x: 2336, y: 3680 },
];
export const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export interface AdventureState {
  plug: number;
  baby: 'lost' | 'following' | 'home';
  chamber: boolean;
  fungi: boolean[];
  amber: boolean[];
  depths: boolean[];
  eaten: boolean[];
  fertility: number;
  castDistance: number;
  finale: number;
}
export const freshAdventure = (foodCount: number): AdventureState => ({
  plug: 0,
  baby: 'lost',
  chamber: false,
  fungi: FUNGI.map(() => false),
  amber: AMBER.map(() => false),
  depths: [true, false, false, false, false],
  eaten: Array.from({ length: foodCount }, () => false),
  fertility: 0,
  castDistance: 0,
  finale: 0,
});
export const depthBand = (y: number) =>
  Math.min(4, Math.max(0, Math.floor((y - SURFACE) / 720)));
export const weather = (seconds: number): 'dew' | 'rain' | 'sun' | 'dusk' => {
  const phase = seconds % 180;
  return phase < 35
    ? 'dew'
    : phase < 80
      ? 'rain'
      : phase < 140
        ? 'sun'
        : 'dusk';
};
/** Rain reaches each depth later; the surface can dry while lower soil stays wet. */
export function rainMoisture(y: number, seconds: number) {
  const delayed = seconds - Math.max(0, y - SURFACE) / 35;
  if (delayed < 0) return false;
  const phase = delayed % 180;
  return phase >= 35 && phase < 95;
}
export function submerged(p: Point) {
  return (
    p.x > FLOOD.x &&
    p.x < FLOOD.x + FLOOD.width &&
    p.y > FLOOD.y &&
    p.y < FLOOD.y + FLOOD.height &&
    !AIR_POCKETS.some((air) => gap(p, air) < 31)
  );
}
export type AdventureTarget = Point & {
  kind: 'plug' | 'fungus' | 'nest';
  index: number;
};
export function targets(a: AdventureState): AdventureTarget[] {
  return [
    ...(a.plug < 3 ? [{ ...PLUG, kind: 'plug' as const, index: 0 }] : []),
    ...FUNGI.flatMap((p, index) =>
      a.fungi[index] ? [] : [{ ...p, kind: 'fungus' as const, index }],
    ),
    { ...NEST, kind: 'nest', index: 0 },
    ...(a.fungi.every(Boolean)
      ? [{ ...DEEP_NEST, kind: 'nest' as const, index: 1 }]
      : []),
  ];
}
export function validateAdventure(
  value: unknown,
  foodCount: number,
): AdventureState {
  if (!value || typeof value !== 'object') throw Error('Zapis: brak przygody');
  const a = structuredClone(value) as AdventureState;
  const flags = (v: unknown, length: number) =>
    Array.isArray(v) &&
    v.length === length &&
    v.every((b) => typeof b === 'boolean');
  const n = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (
    !Number.isInteger(a.plug) ||
    !n(a.plug, 0, 3) ||
    !['lost', 'following', 'home'].includes(a.baby) ||
    typeof a.chamber !== 'boolean' ||
    !flags(a.fungi, 4) ||
    !flags(a.amber, AMBER.length) ||
    !flags(a.depths, 5) ||
    !a.depths[0] ||
    !flags(a.eaten, foodCount) ||
    !Number.isInteger(a.fertility) ||
    !n(a.fertility, 0, 24) ||
    !n(a.castDistance, 0, CAST_DISTANCE) ||
    !n(a.finale, 0, 4)
  )
    throw Error('Zapis: nieprawidłowa przygoda');
  return a;
}
