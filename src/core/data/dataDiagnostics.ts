import type { DataOperationEvent, DataSourceKind } from "./types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const STORAGE_KEY = "hasat_data_diagnostics_v1";
const MAX_EVENTS = 80;
const memoryEvents: DataOperationEvent[] = [];

const makeId = () => `data-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function recordDataOperation(input: Omit<DataOperationEvent, "id" | "timestamp">) {
  const event: DataOperationEvent = {
    ...input,
    id: makeId(),
    timestamp: new Date().toISOString(),
  };

  memoryEvents.unshift(event);
  memoryEvents.splice(MAX_EVENTS);

  try {
    sqliteStorage.setItem(STORAGE_KEY, JSON.stringify(memoryEvents));
  } catch {
    // Depolama kotası veya gizli mod, uygulamanın çalışmasını engellememeli.
  }

  return event;
}

export function getDataDiagnostics(): DataOperationEvent[] {
  if (memoryEvents.length > 0) return [...memoryEvents];
  try {
    const parsed = JSON.parse(sqliteStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) {
      memoryEvents.push(...parsed.slice(0, MAX_EVENTS));
    }
  } catch {
    // Bozuk tanılama kaydı göz ardı edilir.
  }
  return [...memoryEvents];
}

export function clearDataDiagnostics() {
  memoryEvents.splice(0);
  try { sqliteStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function inferDataHealth(events = getDataDiagnostics()) {
  const recent = events.slice(0, 30);
  const failures = recent.filter((event) => !event.success).length;
  const legacyReads = recent.filter((event) => event.source === "legacy-local-storage").length;
  return {
    recentOperations: recent.length,
    failures,
    legacyReads,
    status: failures > 2 ? "critical" : failures > 0 || legacyReads > 0 ? "warning" : "healthy",
  } as const;
}

export const dataSourceLabel: Record<DataSourceKind, string> = {
  sqlite: "Yerel veritabanı",
  cache: "Uygulama önbelleği",
  "legacy-local-storage": "Eski tarayıcı kaydı",
  seed: "İlk kurulum verisi",
  memory: "Geçici bellek",
};
