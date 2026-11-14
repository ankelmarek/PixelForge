import type { AnyGameDefinition } from '../engine/api';
import { earthworm } from './earthworm';
import { winery } from './winobranie-rts';
export const games: readonly AnyGameDefinition[] = [earthworm, winery];
