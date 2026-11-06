/**
 * localforage uyumluluk katmanı.
 *
 * Eski asenkron getItem/setItem/removeItem çağrılarını değiştirmeden tek kalıcı
 * kaynak olan yerel SQLite `app_state` koleksiyonuna yönlendirir.
 * Bellek cache'i aynı oturumdaki tekrarlı okumaları hızlandırır; kaynak-of-truth SQLite'tır.
 */
import { deleteLocalDocument, fetchCollectionFromLocalDatabase } from "./localDatabase";
import { setAppState } from "./unifiedLocalDatabase";

const cache = new Map<string, unknown>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

async function hydrateCache(): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const rows = await fetchCollectionFromLocalDatabase("app_state");
    for (const row of rows || []) {
      const key = String((row as any)?.id ?? (row as any)?.__documentId ?? "").trim();
      if (!key) continue;
      cache.set(key, (row as any)?.value);
    }
    hydrated = true;
  })().finally(() => {
    hydrationPromise = null;
  });

  return hydrationPromise;
}

const api = {
  async getItem<T = unknown>(key: string): Promise<T | null> {
    await hydrateCache();
    return cache.has(key) ? (cache.get(key) as T) : null;
  },

  async setItem<T = unknown>(key: string, value: T): Promise<T> {
    cache.set(key, value);
    await setAppState(key, value);
    return value;
  },

  async removeItem(key: string): Promise<void> {
    cache.delete(key);
    await deleteLocalDocument("app_state", key);
  },
};

export default api;
