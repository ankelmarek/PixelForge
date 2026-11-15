import type { StationState } from './types';

export const VARIANTS = ['country', 'highway', 'night'] as const;
export type Variant = (typeof VARIANTS)[number];
export interface Scenario {
  variant: Variant;
  lights: boolean;
  energyTicks: number;
  energyCharged: number;
}
export const scenarios = {
  country: {
    name: 'Krajówka',
    icon: '☀',
    goal: 60,
    detail: 'Ruch mieszany · dzień i zmierzch',
  },
  highway: {
    name: 'Autostradowy weekend',
    icon: '▰',
    goal: 55,
    detail: 'Więcej ciężarówek i autokarów',
  },
  night: {
    name: 'Nocna zmiana',
    icon: '☾',
    goal: 50,
    detail: 'Mniej ruchu · kawa · nocne koszty',
  },
} as const;
export function createScenario(variant: Variant): Scenario {
  if (!VARIANTS.includes(variant)) throw Error('Stacja: nieznany wariant');
  return { variant, lights: true, energyTicks: 0, energyCharged: 0 };
}
/** Smooth light changes, derived from simulation time, including after resume. */
export function darkness(s: StationState) {
  if (!s.campaign?.scenario) return 0;
  if (s.campaign.scenario.variant === 'night') return 0.85;
  const shiftStart = s.tick < 9600 ? 0 : s.tick < 24000 ? 9600 : 24000;
  const shiftEnd = s.tick < 9600 ? 9600 : s.tick < 24000 ? 24000 : 36000;
  const phase = (s.tick - shiftStart) / (shiftEnd - shiftStart);
  // The last quarter is dusk; the next shift starts with dawn, not a flash.
  if (phase < 0.08) return 0.7 * (1 - phase / 0.08);
  return 0.7 * Math.max(0, Math.min(1, (phase - 0.7) / 0.3));
}
export const isNight = (s: StationState) => darkness(s) > 0.35;
export const lit = (s: StationState) =>
  !isNight(s) || !!s.campaign?.scenario?.lights;

export function validateScenario(s: StationState) {
  const v = s.campaign?.scenario;
  if (!v) return;
  if (
    !VARIANTS.includes(v.variant) ||
    typeof v.lights !== 'boolean' ||
    !Number.isSafeInteger(v.energyTicks) ||
    v.energyTicks < 0 ||
    v.energyTicks > s.tick ||
    !Number.isSafeInteger(v.energyCharged) ||
    v.energyCharged < 0 ||
    v.energyCharged > Math.floor((v.energyTicks * 2000) / 1200)
  )
    throw Error('Stacja: niespójny wariant');
  const entries = s.journal.entries.filter((e) => e.category === 'lighting');
  if (
    entries.reduce((n, e) => n - e.cash, 0) !== v.energyCharged ||
    entries.some(
      (e) =>
        !/^lighting-\d+$/.test(e.id) ||
        e.profit !== e.cash ||
        e.revenue ||
        e.cash > 0,
    )
  )
    throw Error('Stacja: niespójne koszty oświetlenia');
}
