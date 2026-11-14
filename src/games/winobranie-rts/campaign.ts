import {
  LotBook,
  randomSample,
  type LotState,
} from '../../engine/api/strategy';
import type { VineyardState, Unit } from './model';
import { SEASON_TICKS } from './climate';

export const campaignRules = {
  years: 3,
  bottles: 300,
  quality: 6500,
  house: 800000,
  loan: 500000,
  interest: 50000,
  warningTicks: 1200,
  upgrades: { press: 350000, tank: 250000, control: 300000 },
} as const;
export const crewCatalog = {
  permanent: {
    name: 'Pracownik stały',
    cost: 25000,
    daily: 800,
    capacity: 8000,
    speed: 5,
    radius: 0,
  },
  seasonal: {
    name: 'Pracownik sezonowy',
    cost: 10000,
    daily: 1200,
    capacity: 8000,
    speed: 5.5,
    radius: 0,
  },
  compact: {
    name: 'Traktor mały',
    cost: 450000,
    daily: 400,
    capacity: 24000,
    speed: 9,
    radius: 1,
  },
  strong: {
    name: 'Traktor mocny',
    cost: 750000,
    daily: 700,
    capacity: 36000,
    speed: 12,
    radius: 1,
  },
  hauler: {
    name: 'Duża przyczepa',
    cost: 950000,
    daily: 900,
    capacity: 48000,
    speed: 8,
    radius: 2,
  },
} as const;
export type CrewKind = keyof typeof crewCatalog;
export type Upgrade = keyof typeof campaignRules.upgrades;
export interface CrewContract {
  kind: CrewKind;
  until: number;
  retiring: boolean;
  turn: number;
  heading: string;
  deliveryTo: string | null;
}
export interface Cellar {
  mode: 'young' | 'reserve';
  upgrades: Record<Upgrade, boolean>;
  process: {
    stage: 'ferment' | 'bottle';
    remaining: number;
    work: number;
    reserve: boolean;
  } | null;
}
export interface TradeContract {
  id: string;
  year: number;
  name: string;
  required: number;
  quality: number;
  delivered: number;
  status: 'offered' | 'active' | 'done' | 'missed';
}
export interface CampaignState {
  year: number;
  book: LotState;
  crew: Record<string, CrewContract>;
  cellars: Record<string, Cellar>;
  bottles: number;
  qualityMass: number;
  fermented: number;
  processLoss: number;
  bottledML: number;
  grapeSales: number;
  mustSales: number;
  wineSales: number;
  salesRevenue: number;
  borrowed: number;
  principalPaid: number;
  interestPaid: number;
  loanDue: number;
  crisisSince: number | null;
  result: 'success' | 'partial' | 'failure' | null;
  harvests: Record<string, number>;
  contracts: TradeContract[];
}
export const newCellar = (): Cellar => ({
  mode: 'young',
  upgrades: { press: false, tank: false, control: false },
  process: null,
});
export function newCampaign(): CampaignState {
  return {
    year: 1,
    book: { serial: 1, lots: [] },
    crew: {
      'worker-1': crew('permanent'),
      'worker-2': crew('permanent'),
      'tractor-1': crew('compact'),
    },
    cellars: {},
    bottles: 0,
    qualityMass: 0,
    fermented: 0,
    processLoss: 0,
    bottledML: 0,
    grapeSales: 0,
    mustSales: 0,
    wineSales: 0,
    salesRevenue: 0,
    borrowed: 0,
    principalPaid: 0,
    interestPaid: 0,
    loanDue: 0,
    crisisSince: null,
    result: null,
    harvests: {},
    contracts: offers(1),
  };
}
export function crew(kind: CrewKind, year = 1): CrewContract {
  return {
    kind,
    until: kind === 'seasonal' ? year * SEASON_TICKS : 0,
    retiring: false,
    turn: 0,
    heading: '',
    deliveryTo: null,
  };
}
export function offers(year: number): TradeContract[] {
  return [
    {
      id: `volume-${year}`,
      year,
      name: 'Dostawa do gospody',
      required: 24 + year * 4,
      quality: 6000,
      delivered: 0,
      status: 'offered',
    },
    {
      id: `quality-${year}`,
      year,
      name: 'Kolekcja rocznika',
      required: 12 + year * 2,
      quality: 7500,
      delivered: 0,
      status: 'offered',
    },
  ];
}
export function unitSpec(s: VineyardState, u: Unit) {
  return crewCatalog[
    s.campaign?.crew[u.id]?.kind ??
      (u.kind === 'worker' ? 'permanent' : 'compact')
  ];
}
export function quality(s: VineyardState) {
  const c = s.campaign;
  return c?.bottles ? Math.floor(c.qualityMass / c.bottles) : 0;
}
export function netWorth(s: VineyardState) {
  const c = s.campaign;
  if (!c) return s.ledger.balance - s.ledger.arrears;
  const assets =
    (s.parcels.length - 1) * 300000 +
    s.buildings.reduce((n, b) => n + (b.work ? 0 : 400000), 0) +
    Object.values(c.crew).reduce(
      (n, u) =>
        n +
        (crewCatalog[u.kind].radius
          ? Math.floor(crewCatalog[u.kind].cost / 2)
          : 0),
      0,
    ) +
    s.rows.reduce((n, r) => n + (r.work ? 0 : r.vines * 1000), 0);
  const inventory = c.book.lots.reduce(
    (n, l) =>
      n +
      Math.floor(
        l.quantity *
          (l.resource === 'bottles'
            ? 1500
            : l.resource === 'grapes'
              ? 0.2
              : 0.5),
      ),
    0,
  );
  return (
    s.ledger.balance +
    assets +
    inventory -
    (c.borrowed - c.principalPaid) -
    (c.borrowed ? campaignRules.interest - c.interestPaid : 0) -
    s.ledger.arrears
  );
}
export function productiveVarieties(s: VineyardState) {
  return new Set(
    s.rows
      .filter(
        (r) => (s.campaign?.harvests[`3:${r.variety}`] ?? 0) > 0 && !r.work,
      )
      .map((r) => r.variety),
  ).size;
}
export function campaignSuccess(s: VineyardState) {
  return (
    !!s.campaign &&
    s.campaign.bottles >= campaignRules.bottles &&
    quality(s) >= campaignRules.quality &&
    netWorth(s) >= 0 &&
    productiveVarieties(s) >= 2
  );
}
export function market(seed: number, year: number) {
  return 90 + Math.floor(randomSample(seed, 31, year) * 21);
}
export function recoverable(s: VineyardState) {
  const c = s.campaign!;
  return (
    !c.borrowed ||
    s.ledger.balance >= 12400 ||
    s.units.some((u) => u.kind === 'tractor') ||
    s.buildings.some((b) => !b.work) ||
    new LotBook(c.book).state.lots.length > 0 ||
    s.rows.some(
      (r) =>
        r.stock > 0 ||
        (!r.work && !r.mature && s.units.some((u) => u.kind === 'worker')),
    )
  );
}
