import type { Cell } from '../../engine/api/strategy';
import type { QueueEntry } from '../../engine/api/mobility';
import type { JournalState, CostStock } from '../../engine/api/economy';
import type { Fuel, Product } from './world';
import type { Campaign, Journey } from './campaign-data';
import type { Development } from './development';

export interface Motion {
  id: string;
  kind: 'car' | 'van' | 'truck' | 'person';
  x: number;
  y: number;
  heading: number;
  turn: number;
  nextHeading: number;
  route: Cell[];
  remainder: number;
  blocked: number;
}
export interface Customer {
  id: string;
  serial: number;
  vehicle: Motion;
  driver: Motion | null;
  phase:
    | 'approaching'
    | 'bypass'
    | 'queue'
    | 'to-pump'
    | 'preparing'
    | 'fueling'
    | 'checkout'
    | 'to-shop'
    | 'wash-wait'
    | 'to-wash'
    | 'washing'
    | 'leaving';
  pedestrian: 'car' | 'walking' | 'queued' | 'paying' | 'returning';
  fuel: Fuel | null;
  requested: number;
  reserved: number;
  issued: number;
  fuelCost: number;
  fuelBill: number;
  price: number;
  basket: Record<Product, number>;
  budget: number;
  pump: number | null;
  parking: number | null;
  patience: number;
  admitted: number;
  wait: number;
  paid: boolean;
  paidTotal: number;
  bought: number;
  checked: boolean;
  abandoned: boolean;
  color: number;
  shopping?: 'owned' | 'tenant' | 'none';
  tenantVisit?: boolean;
  tenantBill?: number;
  goodsPrices?: Record<Product, number>;
  checkoutLane?: number;
  extension?: boolean;
  journey?: Journey;
}
export interface Worker {
  motion: Motion;
  role: 'forecourt' | 'checkout';
  job: {
    kind: 'prepare' | 'unload' | 'restock' | 'build' | 'repair';
    id: string;
    progress: number;
  } | null;
  cargo: Record<Product, CostStock>;
}
export interface Delivery {
  id: string;
  phase: 'ordered' | 'travelling' | 'unloading' | 'departing';
  motion: Motion | null;
  due: number;
  cancelled: boolean;
  fuel: Fuel | null;
  cargo: CostStock;
  goods: Record<Product, CostStock>;
  total: number;
  received: number;
  receiptCost: number;
}
export interface Pump {
  id: string;
  built: boolean;
  open: boolean;
  construction: number;
  customer: string | null;
}
export interface ResourceTotals {
  ordered: number;
  orderedCost: number;
  refunded: number;
  refundCost: number;
  used: number;
  usedCost: number;
}
export interface StationState {
  gameVersion: '0.1.0' | '0.2.0' | '0.3.0' | '0.4.0';
  rulesRevision: 'opening-1';
  worldRevision: string;
  seed: number;
  tick: number;
  serial: number;
  candidate: number;
  nextArrival: number;
  clock: { speed: 1 | 2 | 4; remainder: number };
  result: 'success' | 'partial' | 'bankrupt' | null;
  journal: JournalState;
  tanks: Record<Fuel, CostStock>;
  goods: Record<Product, CostStock>;
  totals: Record<Fuel | Product, ResourceTotals>;
  pumps: Pump[];
  customers: Customer[];
  workers: Worker[];
  delivery: Delivery | null;
  fuelQueue: QueueEntry[];
  checkoutQueue: QueueEntry[];
  checkout: { customer: string; progress: number; worker: string } | null;
  served: number;
  lost: number;
  passed: number;
  satisfaction: number;
  visits: number;
  fuelSold: number;
  articles: number;
  deliveries: number;
  wagesUntil: number;
  topology: number;
  camera: { x: number; y: number; zoom: number };
  development?: Development;
  campaign?: Campaign;
}
