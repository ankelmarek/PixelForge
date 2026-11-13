import type { GameDefinition, LevelDefinition } from '../api/types';
import { readProgress } from './save';
export interface SaveRecord {
  schemaVersion: 2;
  gameId: string;
  gameVersion: string;
  levelIndex: number;
  levelId: string;
  checkpointId: string | null;
  flags: Record<string, boolean>;
  collectibles: string[];
  lives: number;
  elapsedSeconds: number;
  completed: boolean;
  updatedAt: string;
}
export class SaveService {
  constructor(
    private game: GameDefinition,
    private levels: LevelDefinition[],
    private storage?: Pick<Storage, 'getItem' | 'setItem'>,
  ) {}
  fresh(): SaveRecord {
    return {
      schemaVersion: 2,
      gameId: this.game.id,
      gameVersion: this.game.version ?? '0.0.1',
      levelIndex: 0,
      levelId: this.levels[0].id,
      checkpointId: null,
      flags: {},
      collectibles: [],
      lives: this.game.startingLives ?? 3,
      elapsedSeconds: 0,
      completed: false,
      updatedAt: new Date().toISOString(),
    };
  }
  read(): SaveRecord {
    const fresh = this.fresh();
    try {
      const storage = this.storage ?? localStorage;
      const raw = storage.getItem(`pixelforge:v2:${this.game.id}`);
      if (raw === null) {
        const old = readProgress(this.game.id, storage);
        if (old.activated) fresh.flags[`${fresh.levelId}:activated`] = true;
        fresh.completed = old.completed && this.levels.length === 1;
        return fresh;
      }
      const v = JSON.parse(raw) as SaveRecord;
      const maxLives = this.game.startingLives ?? 3;
      if (
        !v ||
        v.schemaVersion !== 2 ||
        v.gameId !== this.game.id ||
        v.gameVersion !== fresh.gameVersion ||
        !Number.isInteger(v.levelIndex) ||
        !this.levels[v.levelIndex] ||
        v.levelId !== this.levels[v.levelIndex].id ||
        !Number.isInteger(v.lives) ||
        v.lives < 0 ||
        v.lives > maxLives ||
        !Number.isFinite(v.elapsedSeconds) ||
        v.elapsedSeconds < 0 ||
        typeof v.completed !== 'boolean' ||
        typeof v.updatedAt !== 'string'
      )
        return fresh;
      if (
        !v.flags ||
        Array.isArray(v.flags) ||
        typeof v.flags !== 'object' ||
        !Object.entries(v.flags).every(
          ([k, value]) => k.includes(':') && typeof value === 'boolean',
        )
      )
        return fresh;
      if (
        !Array.isArray(v.collectibles) ||
        !v.collectibles.every((id) => typeof id === 'string') ||
        new Set(v.collectibles).size !== v.collectibles.length
      )
        return fresh;
      const validItems = new Set(
        this.levels.flatMap((level) =>
          (level.entities ?? [])
            .filter((e) => e.type === 'collectible')
            .map((e) => `${level.id}:${e.id}`),
        ),
      );
      if (v.collectibles.some((id) => !validItems.has(id))) return fresh;
      if (
        v.checkpointId !== null &&
        !this.levels[v.levelIndex].entities?.some(
          (e) => e.id === v.checkpointId && e.type === 'checkpoint',
        )
      )
        return fresh;
      if (
        v.completed &&
        (v.lives === 0 || v.levelIndex !== this.levels.length - 1)
      )
        return fresh;
      return v;
    } catch {
      return fresh;
    }
  }
  write(state: SaveRecord): boolean {
    try {
      state.updatedAt = new Date().toISOString();
      (this.storage ?? localStorage).setItem(
        `pixelforge:v2:${this.game.id}`,
        JSON.stringify(state),
      );
      return true;
    } catch {
      return false;
    }
  }
}
export class ProgressService {
  state: SaveRecord;
  constructor(
    readonly save: SaveService,
    readonly levels: LevelDefinition[],
  ) {
    this.state = save.read();
  }
  get level() {
    return this.levels[this.state.levelIndex];
  }
  context() {
    const prefix = `${this.level.id}:`;
    return {
      level: this.level,
      flags: Object.fromEntries(
        Object.entries(this.state.flags)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key.slice(prefix.length), value]),
      ),
      collected: this.state.collectibles
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
    };
  }
  flag(name: string) {
    return this.state.flags[`${this.level.id}:${name}`] ?? false;
  }
  setFlag(name: string, value: boolean) {
    this.state.flags[`${this.level.id}:${name}`] = value;
  }
  collect(id: string) {
    const key = `${this.level.id}:${id}`;
    if (this.state.collectibles.includes(key)) return false;
    this.state.collectibles.push(key);
    this.persist();
    return true;
  }
  checkpoint(id: string) {
    if (this.state.checkpointId === id) return false;
    this.state.checkpointId = id;
    this.persist();
    return true;
  }
  damage() {
    this.state.lives = Math.max(0, this.state.lives - 1);
    this.persist();
    return this.state.lives > 0;
  }
  completeLevel() {
    if (this.state.completed) return;
    if (this.state.levelIndex + 1 < this.levels.length) {
      this.state.levelIndex++;
      this.state.levelId = this.level.id;
      this.state.checkpointId = null;
    } else this.state.completed = true;
    this.persist();
  }
  reset() {
    this.state = this.save.fresh();
    this.persist();
  }
  persist() {
    return this.save.write(this.state);
  }
}
