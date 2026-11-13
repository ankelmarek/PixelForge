export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;
export class StorageService {
  constructor(private backend?: StorageBackend) {}
  readRaw(key: string): string | null {
    try {
      return (this.backend ?? localStorage).getItem(key);
    } catch {
      return null;
    }
  }
  write(key: string, value: unknown): boolean {
    try {
      (this.backend ?? localStorage).setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}
