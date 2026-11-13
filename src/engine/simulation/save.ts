import { StorageService } from '../systems/storage';
import type { SimulationDefinition } from './types';
import type { SimulationModel } from './model';
export class SimulationSave {
  private key: string;
  constructor(
    private game: SimulationDefinition,
    private model: SimulationModel,
    private storage = new StorageService(),
  ) {
    this.key = `pixelforge:simulation:v1:${game.id}`;
  }
  read() {
    const raw = this.storage.readRaw(this.key);
    if (!raw) return false;
    try {
      const value = JSON.parse(raw);
      return (
        value?.schemaVersion === 1 &&
        value.gameId === this.game.id &&
        value.gameVersion === this.game.version &&
        this.model.restore(value.state)
      );
    } catch {
      return false;
    }
  }
  write() {
    const result = this.storage.write(this.key, {
      schemaVersion: 1,
      gameId: this.game.id,
      gameVersion: this.game.version,
      state: this.model.state,
    });
    if (result) this.model.dirty = false;
    return result;
  }
}
