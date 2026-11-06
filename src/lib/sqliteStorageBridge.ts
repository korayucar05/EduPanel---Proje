/**
 * Synchronous browser-state compatibility facade.
 *
 * Business data is persisted by relational repositories. This facade is only
 * for device-specific UI preferences and short-lived compatibility values, so
 * it deliberately uses the browser's own localStorage and never writes to the
 * MySQL `documents/browser_storage` compatibility collection.
 */
const memory = new Map<string, string>();
let initialized = false;
let nativeStorage: Storage | null = null;

const loadNativeSnapshot = () => {
  if (!nativeStorage) return;
  memory.clear();
  try {
    for (let index = 0; index < nativeStorage.length; index += 1) {
      const key = nativeStorage.key(index);
      if (!key) continue;
      const value = nativeStorage.getItem(key);
      if (value !== null) memory.set(key, value);
    }
  } catch (error) {
    console.warn("[e-Nstitü Browser State] Tarayıcı depolaması okunamadı:", error);
  }
};

export async function initializeSqliteStorageBridge(): Promise<void> {
  if (typeof window === "undefined" || initialized) return;
  try {
    nativeStorage = window.localStorage;
  } catch {
    nativeStorage = null;
  }
  loadNativeSnapshot();
  initialized = true;
  console.info(`[e-Nstitü Browser State] ${memory.size} yerel tercih yüklendi.`);
}

export const sqliteStorage = {
  get length(): number { return memory.size; },
  getItem(key: string): string | null {
    const normalizedKey = String(key);
    if (nativeStorage) {
      try {
        const value = nativeStorage.getItem(normalizedKey);
        if (value !== null) memory.set(normalizedKey, value);
        else memory.delete(normalizedKey);
        return value;
      } catch { /* Bellek kopyasına düş. */ }
    }
    return memory.get(normalizedKey) ?? null;
  },
  setItem(key: string, value: string): void {
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    memory.set(normalizedKey, normalizedValue);
    try { nativeStorage?.setItem(normalizedKey, normalizedValue); } catch (error) {
      console.warn(`[e-Nstitü Browser State] ${normalizedKey} yalnız bellekte tutuluyor:`, error);
    }
  },
  removeItem(key: string): void {
    const normalizedKey = String(key);
    memory.delete(normalizedKey);
    try { nativeStorage?.removeItem(normalizedKey); } catch { /* noop */ }
  },
  clear(): void {
    memory.clear();
    try { nativeStorage?.clear(); } catch { /* noop */ }
  },
  key(index: number): string | null { return Array.from(memory.keys())[index] ?? null; },
};

export function getSqliteStorageSnapshot() {
  loadNativeSnapshot();
  return Array.from(memory, ([key, value]) => ({ key, value }));
}

export async function flushSqliteStorageBridge(): Promise<void> {
  // localStorage writes are synchronous; there is no server-side queue.
}
