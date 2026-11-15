import type { Cell, GridRect } from '../../engine/api/strategy';
import type { CostStock } from '../../engine/api/economy';
import type { QueueEntry } from '../../engine/api/mobility';
import type { Motion, StationState } from './types';
import {
  PUMPS,
  PARKING,
  prices,
  GOODS,
  type Fuel,
  type Product,
} from './world';

export type SiteKind = 'pump' | 'heavy-pump' | 'parking' | 'tank';
export interface Site {
  id: string;
  kind: SiteKind;
  point: Cell;
  rotation: number;
  cost: number;
  progress: number;
  fuel: Fuel;
}
export interface Road {
  id: string;
  from: Cell;
  to: Cell;
  cost: number;
}
export interface Lease {
  id: string;
  type: 'fixed' | 'share';
  signed: number;
  active: number;
  end: number;
  terminate: boolean;
  rent: number;
  share: number;
}
export interface Tenant {
  phase:
    'owned' | 'closing' | 'refitting' | 'leased' | 'returning' | 'restoring';
  since: number;
  contract: Lease | null;
  everSigned: boolean;
  queue: QueueEntry[];
  checkout: { customer: string; progress: number } | null;
  staff: Motion[];
  stock: Record<Product, number>;
  supplied: Record<Product, number>;
  sales: {
    id: string;
    tick: number;
    total: number;
    items: Record<Product, number>;
  }[];
  settlements: {
    id: string;
    shift: number;
    ticks: number;
    turnover: number;
    rent: number;
    share: number;
  }[];
  delivery: {
    id: string;
    motion: Motion | null;
    phase: 'ordered' | 'travelling' | 'unloading' | 'returning';
    progress: number;
    due: number;
  } | null;
  deliveries: number;
}
export interface Development {
  revision: 'development-1';
  duration: number;
  boundaries: number[];
  parcels: string[];
  sites: Site[];
  roads: Road[];
  prices: Record<Fuel | Product, number>;
  priority: 'customers' | 'deliveries';
  secondCheckout: boolean;
  checkout: StationState['checkout'];
  wages: number;
  wageRemainder: number;
  wageTotal: number;
  goodsRevenue: number;
  fuelRevenue: number;
  constructionSpent: number;
  tenant: Tenant;
}
export const PARCELS: (GridRect & { id: string; price: number })[] = [
  { id: 'start', x: 96, y: 96, width: 64, height: 57, price: 0 },
  { id: 'west', x: 48, y: 94, width: 48, height: 59, price: 220000 },
  { id: 'north', x: 96, y: 56, width: 64, height: 40, price: 260000 },
  { id: 'east', x: 160, y: 94, width: 48, height: 59, price: 240000 },
];
export const ENTRY = { x: 106, y: 134 },
  EXIT = { x: 148, y: 118 };
export const TENANT_CASH = { x: 117, y: 110 };
export const tenantPoint = (index: number) => ({ x: 118, y: 115 + index * 3 });
export function createDevelopment(): Development {
  return {
    revision: 'development-1',
    duration: 14400,
    boundaries: [7200, 10800, 14400],
    parcels: ['start'],
    sites: [],
    roads: [],
    prices: Object.fromEntries(
      Object.entries(prices).map(([k, v]) => [k, v.sell]),
    ) as Development['prices'],
    priority: 'deliveries',
    secondCheckout: false,
    checkout: null,
    wages: 0,
    wageRemainder: 0,
    wageTotal: 0,
    goodsRevenue: 0,
    fuelRevenue: 0,
    constructionSpent: 0,
    tenant: {
      phase: 'owned',
      since: 0,
      contract: null,
      everSigned: false,
      queue: [],
      checkout: null,
      staff: [],
      stock: { drink: 0, snack: 0, coffee: 0 },
      supplied: { drink: 0, snack: 0, coffee: 0 },
      sales: [],
      settlements: [],
      delivery: null,
      deliveries: 0,
    },
  };
}
export const pumpPoints = (s: StationState): Cell[] => [
  ...PUMPS,
  ...(s.development?.sites
    .filter((p) => p.kind === 'pump' || p.kind === 'heavy-pump')
    .map((p) => p.point) ?? []),
];
export const parkingPoints = (s: StationState): Cell[] => [
  ...PARKING,
  ...(s.development?.sites
    .filter((p) => p.kind === 'parking')
    .map((p) => p.point) ?? []),
];
/** Indices are assigned at placement; finishing another site cannot move an occupied bay. */
export const parkingReady = (s: StationState, index: number) =>
  index < PARKING.length ||
  s.development?.sites.filter((p) => p.kind === 'parking')[
    index - PARKING.length
  ]?.progress === 0;
export const extraPump = (s: StationState, i: number) =>
  i < 3
    ? undefined
    : s.development?.sites.filter(
        (p) => p.kind === 'pump' || p.kind === 'heavy-pump',
      )[i - 3];
export const duration = (s: StationState) => s.development?.duration ?? 7200;
export const goal = (s: StationState) => (s.development ? 20 : 12);
export const tankCapacity = (s: StationState, f: Fuel) =>
  10000 +
  (s.development?.sites.filter(
    (p) => p.kind === 'tank' && p.fuel === f && !p.progress,
  ).length ?? 0) *
    10000;
export const retail = (s: StationState, k: Fuel | Product) =>
  s.development?.prices[k] ?? prices[k].sell;
export const emptyCargo = (): Record<Product, CostStock> =>
  Object.fromEntries(GOODS.map((k) => [k, { quantity: 0, cost: 0 }])) as Record<
    Product,
    CostStock
  >;
