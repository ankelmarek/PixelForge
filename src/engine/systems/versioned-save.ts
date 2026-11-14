import { StorageService } from './storage';

/** Validate before publishing a save; failed writes never delete the last one. */
export class VersionedSave<T> {
  readonly key: string;
  constructor(
    private gameId: string,
    private schemaVersion: number,
    private validate: (value: unknown) => T,
    private storage = new StorageService(),
  ) {
    this.key = `pixelforge:client:v${schemaVersion}:${gameId}`;
  }
  read(): T | undefined {
    const result = this.inspect();
    return result.status === 'ready' ? result.value : undefined;
  }
  inspect():
    | { status: 'absent' }
    | { status: 'invalid' }
    | { status: 'ready'; value: T } {
    try {
      const raw = this.storage.readRaw(this.key);
      if (!raw) return { status: 'absent' };
      if (raw.length > 4000000) return { status: 'invalid' };
      const data = JSON.parse(raw);
      if (
        data.gameId !== this.gameId ||
        data.schemaVersion !== this.schemaVersion
      )
        return { status: 'invalid' };
      return { status: 'ready', value: this.validate(data.state) };
    } catch {
      return { status: 'invalid' };
    }
  }
  write(state: T): boolean {
    try {
      this.validate(state);
      return this.storage.write(this.key, {
        gameId: this.gameId,
        schemaVersion: this.schemaVersion,
        state,
      });
    } catch {
      return false;
    }
  }
}
