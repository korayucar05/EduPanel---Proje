import localDatabaseForage from "../state/AppStateService";
import { recordDataOperation } from "./dataDiagnostics";
import type { DataReadResult, ReadThroughOptions } from "./types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function safeParseLegacy(raw: string | null): unknown {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function isValid<T>(value: unknown, options: ReadThroughOptions<T>): value is T {
  return options.validate ? options.validate(value) : value !== undefined && value !== null;
}

const read = async <T>(key: string, options: ReadThroughOptions<T>): Promise<DataReadResult<T>> => {
  const startedAt = now();
  try {
    const persisted = await localDatabaseForage.getItem<T>(key);
    if (isValid(persisted, options)) {
      recordDataOperation({ operation: "read", key, source: "sqlite", success: true, durationMs: now() - startedAt });
      return { value: persisted, source: "sqlite" };
    }

    const legacyKey = options.legacyLocalStorageKey || key;
    const legacy = safeParseLegacy(sqliteStorage.getItem(legacyKey));
    if (isValid(legacy, options)) {
      let migrated = false;
      if (options.migrateLegacy !== false) {
        await localDatabaseForage.setItem(key, legacy);
        migrated = true;
        try { sqliteStorage.removeItem(legacyKey); } catch { /* noop */ }
        recordDataOperation({ operation: "migration", key, source: "legacy-local-storage", success: true, durationMs: now() - startedAt });
      } else {
        recordDataOperation({ operation: "read", key, source: "legacy-local-storage", success: true, durationMs: now() - startedAt });
      }
      return { value: legacy, source: "legacy-local-storage", migrated };
    }

    recordDataOperation({ operation: "read", key, source: "memory", success: true, durationMs: now() - startedAt, message: "Varsayılan değer kullanıldı." });
    return { value: options.fallback, source: "memory" };
  } catch (error) {
    recordDataOperation({ operation: "read", key, source: "sqlite", success: false, durationMs: now() - startedAt, message: error instanceof Error ? error.message : String(error) });
    return { value: options.fallback, source: "memory", warning: error instanceof Error ? error.message : String(error) };
  }
};

export const hasatDataStore = {
  read,

  async write<T>(key: string, value: T): Promise<T> {
    const startedAt = now();
    try {
      const result = await localDatabaseForage.setItem(key, value);
      recordDataOperation({ operation: "write", key, source: "sqlite", success: true, durationMs: now() - startedAt });
      return result;
    } catch (error) {
      recordDataOperation({ operation: "write", key, source: "sqlite", success: false, durationMs: now() - startedAt, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },

  async remove(key: string, legacyLocalStorageKey?: string): Promise<void> {
    const startedAt = now();
    try {
      await localDatabaseForage.removeItem(key);
      try { sqliteStorage.removeItem(legacyLocalStorageKey || key); } catch { /* noop */ }
      recordDataOperation({ operation: "remove", key, source: "sqlite", success: true, durationMs: now() - startedAt });
    } catch (error) {
      recordDataOperation({ operation: "remove", key, source: "sqlite", success: false, durationMs: now() - startedAt, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },

  async readArray<T>(key: string, fallback: T[] = []): Promise<DataReadResult<T[]>> {
    return read<T[]>(key, { fallback, validate: Array.isArray, migrateLegacy: true });
  },
};
