import type { MusicDefinition } from '../systems/audio';
import type { RuleSystem } from '../systems/rules';
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Requirement {
  allFlags?: string[];
  condition?: string;
}
export interface RuleAction {
  action: string;
  flag?: string;
  value?: boolean;
}
export type EntityType =
  | 'trigger'
  | 'collectible'
  | 'enemy'
  | 'hazard'
  | 'checkpoint'
  | 'switch'
  | 'door';
export interface EntityDefinition extends Point {
  id: string;
  type: EntityType;
  width?: number;
  height?: number;
  texture?: string;
  flag?: string;
  requires?: Requirement;
  onInteract?: RuleAction[];
  patrol?: { min: number; max: number; speed: number };
}
export interface LevelDefinition {
  schemaVersion: 1;
  id: string;
  title?: string;
  width: number;
  height: number;
  spawn: Point;
  platforms: Rect[];
  interaction: Point & { action: 'activate' };
  exit: Point;
  entities?: EntityDefinition[];
  exitRequires?: Requirement;
  theme?: { tint: number; background: string; decoration?: string };
}
export interface GameDefinition {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  viewport: { width: 320; height: 180 };
  levelUrl: string;
  levels?: string[];
  version?: string;
  startingLives?: number;
  assets: {
    player: string;
    background: string;
    terrain: string;
    beacon: string;
    portal: string;
    [key: string]: string;
  };
  spriteSheets?: Record<string, { frameWidth: number; frameHeight: number }>;
  movement: {
    speed: number;
    jump: number;
    gravity: number;
    acceleration?: number;
  };
  music?: MusicDefinition;
  registerRules?: (rules: RuleSystem) => void;
}
export interface Snapshot {
  x: number;
  y: number;
  grounded: boolean;
  activated: boolean;
  completed: boolean;
  paused: boolean;
  failed?: boolean;
  lives?: number;
  collected?: number;
  total?: number;
  levelIndex?: number;
  levelCount?: number;
  levelName?: string;
  checkpoint?: string | null;
  elapsed?: number;
}
export interface HostOptions {
  parent: HTMLElement;
  definition: GameDefinition;
  onReady: () => void;
  onState: (state: Snapshot) => void;
  onError: (message: string) => void;
}
