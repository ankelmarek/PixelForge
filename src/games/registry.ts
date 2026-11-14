import type { AnyGameDefinition } from '../engine/api';
import { earthworm } from './earthworm';
import { winery } from './winobranie-rts';
import { station } from './gas-station';
export const games: readonly AnyGameDefinition[] = [earthworm, winery, station];
