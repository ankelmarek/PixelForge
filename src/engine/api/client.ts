import type Phaser from 'phaser';
import type { Input } from '../systems/input';
import type { Audio, MusicDefinition } from '../systems/audio';
import type { Snapshot } from './types';

/** Trusted, bundled TypeScript extension. JSON can only provide validated data. */
export interface ClientDefinition {
  kind: 'client';
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  description: string;
  viewport: { width: 320; height: 180 };
  levelUrl: string;
  assets: Record<string, string>;
  spriteSheets?: Record<string, { frameWidth: number; frameHeight: number }>;
  music?: MusicDefinition;
  presentation: {
    completionTitle: string;
    failureTitle: string;
    objectiveLabel: string;
    actionLabel: string;
  };
  catalog: {
    cover: string;
    launchLabel: string;
    badge: string;
    detail: string;
  };
  createRuntime: (
    context: ClientContext,
    data: unknown,
  ) => ClientRuntime | Promise<ClientRuntime>;
}
export interface ClientContext {
  input: Input;
  audio: Audio;
  ready: () => void;
  state: (snapshot: Snapshot) => void;
  error: (message: string) => void;
  message: (message: string) => void;
}
export type ClientCommand =
  | { type: 'zoom'; direction: number }
  | { type: 'focus'; point?: { x: number; y: number } }
  | { type: 'interact' };
export interface ClientRuntime {
  scenes: (typeof Phaser.Scene)[];
  start: (resume: boolean) => void;
  persist: () => boolean;
  command: (command: ClientCommand) => void;
}
