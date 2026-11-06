import localforage from "../../core/state/AppStateService";
import { welfareService } from "../../modules/welfare";

// Fail-safe storage utility for iframe environments where storage is blocked or restricted.
const memoryStorage: Record<string, any> = {};

export const safeStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    if (welfareService.isDomainCollection(key)) {
      const rows = await welfareService.readCollection<any>(key);
      memoryStorage[key] = rows;
      return rows as T;
    }

    if (memoryStorage[key] !== undefined && memoryStorage[key] !== null) {
      return memoryStorage[key] as T;
    }

    try {
      const value = await localforage.getItem<T>(key);
      if (value !== null && value !== undefined) {
        memoryStorage[key] = value;
        return value;
      }
    } catch (e) {
      console.warn(`localforage read failed for "${key}":`, e);
    }

    return (memoryStorage[key] as T) || null;
  },

  async setItem<T>(key: string, value: T): Promise<T> {
    if (welfareService.isDomainCollection(key) && Array.isArray(value)) {
      await welfareService.writeCollection(key, value as any[]);
      memoryStorage[key] = value;
      return value;
    }

    memoryStorage[key] = value;

    try {
      await localforage.setItem(key, value);
    } catch (e) {
      console.warn(`localforage write failed for "${key}":`, e);
    }

    return value;
  },
};