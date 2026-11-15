import type { Customer, StationState } from './types';

export const WEEKEND_END = 36000;
export const LAST_ADMISSION = 34200;
export const WEEKEND_BOUNDARIES = [9600, 24000, WEEKEND_END];
export const WASH_COST = 250000;
export const WASH_UNLOCK = 150000;
export const EVENT_KINDS = [
  'rain',
  'fault',
  'wholesale',
  'tourists',
  'trucks',
  'discount',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export interface WeekendEvent {
  id: number;
  kind: EventKind;
  announced: number;
  start: number;
  end: number;
  remaining: number;
  accepted: boolean;
}
export interface Journey {
  fuel: boolean;
  goods: number;
  wash: 'none' | 'wanted' | 'queued' | 'active' | 'done' | 'missed';
  price: number;
  interruptions: number;
  comfort: number;
  bus: boolean;
}
export interface VisitRating {
  id: string;
  tick: number;
  served: boolean;
  wait: number;
  score: number;
  parts: [number, number, number, number, number];
}
export interface Campaign {
  revision: 'weekend-1';
  arrivalWindow: number;
  nextEvent: number;
  eventIndex: number;
  event: WeekendEvent | null;
  history: WeekendEvent[];
  criticalEnd: number;
  fault: {
    pump: number;
    since: number;
    repair: boolean;
    progress: number;
  } | null;
  rescue: { taken: boolean; repaid: boolean };
  warningSince: number;
  ratings: VisitRating[];
  wash: {
    queue: string[];
    customer: string | null;
    progress: number;
    completed: number;
  };
}
export function createCampaign(): Campaign {
  return {
    revision: 'weekend-1',
    arrivalWindow: 1,
    nextEvent: 1800,
    eventIndex: 0,
    event: null,
    history: [],
    criticalEnd: -900,
    fault: null,
    rescue: { taken: false, repaid: false },
    warningSince: -1,
    ratings: [],
    wash: { queue: [], customer: null, progress: 0, completed: 0 },
  };
}
export const shiftIndex = (s: StationState) =>
  s.tick < 9600 ? 0 : s.tick < 24000 ? 1 : 2;
export const activeEvent = (s: StationState, kind: EventKind) =>
  s.campaign?.event?.kind === kind &&
  s.tick >= s.campaign.event.start &&
  s.tick < s.campaign.event.end;
export const pumpWorking = (s: StationState, index: number) =>
  s.campaign?.fault?.pump !== index;
export const washSite = (s: StationState) =>
  s.development?.sites.find((p) => p.kind === 'wash' && !p.progress);
export const washWanted = (c: Customer) => c.journey?.wash === 'wanted';
export const debt = (s: StationState) =>
  s.campaign?.rescue.taken && !s.campaign.rescue.repaid ? 165000 : 0;
export function rating(
  s: StationState,
  c: Customer,
  served: boolean,
): VisitRating {
  const j = c.journey!;
  const quantities = [
    ...(j.fuel ? [c.issued / Math.max(1, c.requested)] : []),
    ...(j.goods ? [Math.min(1, c.bought / j.goods)] : []),
    ...(j.wash !== 'none' ? [Number(j.wash === 'done')] : []),
  ];
  const parts: VisitRating['parts'] = [
    Math.round(10000 * Math.max(0, 1 - c.wait / c.patience)),
    Math.round(
      (10000 * quantities.reduce((n, v) => n + v, 0)) /
        Math.max(1, quantities.length),
    ),
    j.price,
    Math.round(
      (10000 *
        Math.max(
          0,
          quantities.length -
            [1, 2, 4].filter((bit) => j.interruptions & bit).length,
        )) /
        Math.max(1, quantities.length),
    ),
    j.comfort,
  ];
  return {
    id: c.id,
    tick: s.tick,
    served,
    wait: c.wait,
    score: Math.round(
      parts.reduce((n, v, i) => n + v * [30, 25, 20, 15, 10][i], 0) / 100,
    ),
    parts,
  };
}
