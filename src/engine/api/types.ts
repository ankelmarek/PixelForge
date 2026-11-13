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
export interface LevelDefinition {
  schemaVersion: 1;
  id: string;
  width: number;
  height: number;
  spawn: Point;
  platforms: Rect[];
  interaction: Point & { action: 'activate' };
  exit: Point;
}
export interface GameDefinition {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  viewport: { width: 320; height: 180 };
  levelUrl: string;
  assets: {
    player: string;
    background: string;
    terrain: string;
    beacon: string;
    portal: string;
  };
  movement: { speed: number; jump: number; gravity: number };
}
export interface Snapshot {
  x: number;
  y: number;
  grounded: boolean;
  activated: boolean;
  completed: boolean;
  paused: boolean;
}
export interface HostOptions {
  parent: HTMLElement;
  definition: GameDefinition;
  onReady: () => void;
  onState: (state: Snapshot) => void;
  onError: (message: string) => void;
}
