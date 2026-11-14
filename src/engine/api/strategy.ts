/** Headless, game-independent strategy contracts. */
export { RegionalNavigator } from '../world/navigation';
export {
  ScenarioClock,
  Ledger,
  Inventory,
  Reservations,
  inside,
  ownsAll,
  lineCells,
  rectCells,
} from '../strategy/services';
export type { LedgerState } from '../strategy/services';
export type { Cell, GridRect, TerrainWorld } from '../simulation/types';
export { validateSector, validateWorldTerrain } from '../world/validation';
