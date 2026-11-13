import { StorageService } from '../systems/storage';
import type { SimulationDefinition } from './types';
import type { SimulationModel } from './model';
export class SimulationSave {
  private key: string;
  camera?: { x: number; y: number; zoom: number };
  constructor(
    private game: SimulationDefinition,
    private model: SimulationModel,
    private storage = new StorageService(),
  ) {
    this.key =
      model.level.schemaVersion === 2
        ? `pixelforge:world:v2:${game.id}`
        : `pixelforge:simulation:v1:${game.id}`;
  }
  private get world() {
    const l = this.model.level;
    return l.schemaVersion === 2
      ? {
          id: l.id,
          revision: l.terrain.revision,
          width: l.width,
          height: l.height,
          tileSize: l.tileSize,
          sectorSize: l.terrain.sectorSize,
        }
      : undefined;
  }
  read() {
    const raw = this.storage.readRaw(this.key);
    if (!raw) return false;
    try {
      const value = JSON.parse(raw),
        level = this.model.level;
      if (
        value?.schemaVersion !== level.schemaVersion ||
        value.gameId !== this.game.id ||
        value.gameVersion !== this.game.version
      )
        return false;
      if (level.schemaVersion === 2) {
        if (
          !value.world ||
          Object.entries(this.world!).some(([k, v]) => value.world[k] !== v)
        )
          return false;
        const c = value.camera;
        if (
          c &&
          (!Number.isFinite(c.x) ||
            !Number.isFinite(c.y) ||
            !Number.isFinite(c.zoom) ||
            c.x < 0 ||
            c.y < 0 ||
            c.x > level.width * level.tileSize ||
            c.y > level.height * level.tileSize ||
            c.zoom < level.camera.minZoom ||
            c.zoom > level.camera.maxZoom)
        )
          return false;
      }
      if (!this.model.restore(value.state)) return false;
      this.camera = value.camera;
      return true;
    } catch {
      return false;
    }
  }
  write() {
    const result = this.storage.write(this.key, {
      schemaVersion: this.model.level.schemaVersion,
      gameId: this.game.id,
      gameVersion: this.game.version,
      ...(this.world ? { world: this.world, camera: this.camera } : {}),
      state: this.model.state,
    });
    if (result) this.model.dirty = false;
    return result;
  }
}
