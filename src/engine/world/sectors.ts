import type {
  SectorData,
  SectorReference,
  TerrainWorld,
} from '../simulation/types';
import { validateSector } from './validation';
export interface WorldView {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function sectorsInView(
  level: TerrainWorld,
  view: WorldView,
  margin = 1,
): SectorReference[] {
  const size = level.terrain.sectorSize * level.tileSize;
  const minX = Math.max(0, Math.floor(view.x / size) - margin),
    minY = Math.max(0, Math.floor(view.y / size) - margin);
  const maxX = Math.min(
    level.width / level.terrain.sectorSize - 1,
    Math.floor((view.x + view.width - 0.001) / size) + margin,
  );
  const maxY = Math.min(
    level.height / level.terrain.sectorSize - 1,
    Math.floor((view.y + view.height - 0.001) / size) + margin,
  );
  const cx = (view.x + view.width / 2) / size,
    cy = (view.y + view.height / 2) / size;
  return level.terrain.sectors
    .filter((s) => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
    .sort(
      (a, b) =>
        Math.hypot(a.x + 0.5 - cx, a.y + 0.5 - cy) -
        Math.hypot(b.x + 0.5 - cx, b.y + 0.5 - cy),
    );
}
export type SectorLoader = (
  ref: SectorReference,
  signal: AbortSignal,
) => Promise<unknown>;
/** Bounded LRU of data only. Persistent simulation state never belongs here. */
export class SectorCache {
  private data = new Map<string, SectorData>();
  private pending = new Map<string, AbortController>();
  private wanted: SectorReference[] = [];
  private dead = false;
  private failed = false;
  requests = 0;
  evictions = 0;
  constructor(
    private level: TerrainWorld,
    private load: SectorLoader,
    private error: (message: string) => void,
    private concurrency = 4,
  ) {}
  get stats() {
    return {
      resident: this.data.size,
      pending: this.pending.size,
      requests: this.requests,
      evictions: this.evictions,
    };
  }
  get(id: string) {
    return this.data.get(id);
  }
  update(wanted: SectorReference[]) {
    if (this.dead || this.failed) return;
    if (wanted.length > this.level.terrain.cacheSectors)
      throw Error('Sektory: widok przekracza budżet cache');
    this.wanted = wanted;
    const ids = new Set(wanted.map((r) => r.id));
    for (const [id, controller] of this.pending)
      if (!ids.has(id)) {
        controller.abort();
        this.pending.delete(id);
      }
    for (const ref of wanted) {
      const data = this.data.get(ref.id);
      if (data) {
        this.data.delete(ref.id);
        this.data.set(ref.id, data);
      }
    }
    this.pump();
  }
  private pump() {
    if (this.dead || this.failed) return;
    for (const ref of this.wanted) {
      if (this.pending.size >= this.concurrency) break;
      if (this.data.has(ref.id) || this.pending.has(ref.id)) continue;
      const controller = new AbortController();
      this.pending.set(ref.id, controller);
      this.requests++;
      void this.load(ref, controller.signal)
        .then((raw) => {
          if (controller.signal.aborted || this.dead) return;
          const data = validateSector(raw, this.level, ref);
          this.data.set(ref.id, data);
          const wantedIds = new Set(this.wanted.map((r) => r.id));
          for (const id of this.data.keys()) {
            if (this.data.size <= this.level.terrain.cacheSectors) break;
            if (!wantedIds.has(id)) {
              this.data.delete(id);
              this.evictions++;
            }
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted && !this.dead) {
            this.failed = true;
            this.error(
              `Sektor ${ref.id}: ${error instanceof Error ? error.message : 'błąd ładowania'}`,
            );
          }
        })
        .finally(() => {
          if (this.pending.get(ref.id) === controller)
            this.pending.delete(ref.id);
          this.pump();
        });
    }
  }
  destroy() {
    this.dead = true;
    for (const controller of this.pending.values()) controller.abort();
    this.pending.clear();
    this.data.clear();
    this.wanted = [];
  }
}
