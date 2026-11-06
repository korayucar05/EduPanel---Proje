import { databaseGateway } from "../database/LocalDatabaseGateway";

const APP_STATE_COLLECTION = "app_state";

type AppStateDocument<T = unknown> = {
  id: string;
  value: T;
  updatedAt: string;
};

/**
 * Merkezi uygulama-durumu servisi.
 *
 * UI bileşenlerinin localforage/localStorage/SQLite adaptörlerini doğrudan
 * bilmesini engeller. Kalıcı kaynak SQLite'taki app_state koleksiyonudur.
 */
export class AppStateService {
  private cache = new Map<string, unknown>();
  private hydrated = false;
  private hydrationPromise: Promise<void> | null = null;

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = (async () => {
      const rows = await databaseGateway.readCollection<AppStateDocument>(APP_STATE_COLLECTION);
      for (const row of rows || []) {
        const id = String((row as any)?.id ?? (row as any)?.__documentId ?? "").trim();
        if (!id) continue;
        this.cache.set(id, (row as any)?.value);
      }
      this.hydrated = true;
    })().finally(() => {
      this.hydrationPromise = null;
    });

    return this.hydrationPromise;
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    await this.hydrate();
    return this.cache.has(key) ? (this.cache.get(key) as T) : null;
  }

  async setItem<T = unknown>(key: string, value: T): Promise<T> {
    await this.hydrate();
    this.cache.set(key, value);
    await databaseGateway.upsert(APP_STATE_COLLECTION, key, {
      id: key,
      value,
      updatedAt: new Date().toISOString(),
    });
    return value;
  }

  async removeItem(key: string): Promise<void> {
    await this.hydrate();
    this.cache.delete(key);
    await databaseGateway.remove(APP_STATE_COLLECTION, key);
  }

  async hasItem(key: string): Promise<boolean> {
    await this.hydrate();
    return this.cache.has(key);
  }

  async keys(): Promise<string[]> {
    await this.hydrate();
    return [...this.cache.keys()];
  }

  clearMemoryCache(): void {
    this.cache.clear();
    this.hydrated = false;
  }
}

export const appStateService = new AppStateService();
export default appStateService;
