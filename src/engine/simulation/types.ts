import type { MusicDefinition } from '../systems/audio';
export interface Cell {
  x: number;
  y: number;
}
export interface GridRect extends Cell {
  width: number;
  height: number;
}
export type NodeKind =
  'source' | 'depot' | 'processor' | 'storage' | 'obstacle';
export interface StockVisual {
  texture: string;
  unitSize: number;
  slots: Cell[];
  scale?: number;
}
export interface SimulationNode extends GridRect {
  id: string;
  kind: NodeKind;
  texture: string;
  access: Cell;
  stock: Record<string, number>;
  harvestResource?: string;
  harvestSeconds?: number;
  workPoints?: Cell[];
  recipe?: {
    input: string;
    output: string;
    inputAmount: number;
    outputAmount: number;
    seconds: number;
    destination: string;
  };
  stockVisual?: StockVisual;
  fillTexture?: string;
  fillOffset?: Cell;
  capacity?: number;
}
export interface ActorDefinition extends Cell {
  id: string;
  kind: 'worker' | 'vehicle';
  texture: string;
  capacity: number;
  speed: number;
  depot: string;
  loadSeconds: number;
  unloadSeconds: number;
  cargoTexture: string;
}
export interface SimulationLevelData {
  id: string;
  title: string;
  width: number;
  height: number;
  tileSize: number;
  roads: GridRect[];
  blockers: GridRect[];
  resources: { id: string; unitValue: number; icon: string }[];
  nodes: SimulationNode[];
  actors: ActorDefinition[];
  goal: { storage: string; resource: string; amount: number };
  camera: { zoom: number; center: Cell; minZoom: number; maxZoom: number };
}
export interface SectorReference extends Cell {
  id: string;
  url: string;
}
export interface WorldTerrain {
  revision: string;
  sectorSize: number;
  texture: string;
  frames: number;
  fallbackColor: number;
  cacheSectors: number;
  sectors: SectorReference[];
}
export type SimulationLevel = SimulationLevelData &
  ({ schemaVersion: 1 } | { schemaVersion: 2; terrain: WorldTerrain });
export interface TerrainWorld {
  id: string;
  width: number;
  height: number;
  tileSize: number;
  camera: SimulationLevelData['camera'];
  schemaVersion: 2;
  terrain: WorldTerrain;
}
export type WorldLevel = SimulationLevelData & TerrainWorld;
export interface SectorData {
  schemaVersion: 1;
  id: string;
  revision: string;
  /** Row-major RLE [frame, count]. -1 is transparent in overlay layers. */
  layers: { name: string; runs: [number, number][] }[];
}
export interface SimulationDefinition {
  schemaVersion: 1;
  kind: 'simulation';
  id: string;
  title: string;
  description: string;
  version: string;
  viewport: { width: 320; height: 180 };
  levelUrl: string;
  assets: Record<string, string>;
  spriteSheets?: Record<string, { frameWidth: number; frameHeight: number }>;
  music?: MusicDefinition;
  catalog: {
    cover: string;
    launchLabel: string;
    badge: string;
    detail: string;
    emblem?: string;
  };
}
export type JobKind = 'gather' | 'load' | 'deliver';
export interface Job {
  id: number;
  kind: JobKind;
  target: string;
}
export interface ActiveJob extends Job {
  phase: 'approach' | 'work' | 'return' | 'deposit';
  path: Cell[];
  progress: number;
  waiting: number;
  cancelled: boolean;
}
export interface ActorState extends Cell {
  id: string;
  cargo: Record<string, number>;
  queue: Job[];
  current: ActiveJob | null;
  blocked: boolean;
}
export interface NodeState {
  id: string;
  stock: Record<string, number>;
  enabled: boolean;
  progress: number;
}
export interface SimulationState {
  schemaVersion: 1;
  mapId: string;
  seconds: number;
  remainder?: number;
  serial: number;
  actors: ActorState[];
  nodes: NodeState[];
  completed: boolean;
}
export interface ActorView extends ActorState {
  kind: ActorDefinition['kind'];
  texture: string;
  status: string;
}
export interface CameraView {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}
export type SimulationCommand =
  | { type: 'select'; id: string | null }
  | { type: 'cancel' }
  | { type: 'zoom'; direction: -1 | 0 | 1 }
  | { type: 'focus'; id?: string; point?: Cell };
