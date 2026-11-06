export type DataSourceKind = "sqlite" | "cache" | "legacy-local-storage" | "seed" | "memory";

export interface DataReadResult<T> {
  value: T;
  source: DataSourceKind;
  migrated?: boolean;
  warning?: string;
}

export interface DataOperationEvent {
  id: string;
  operation: "read" | "write" | "remove" | "migration";
  key: string;
  source: DataSourceKind;
  success: boolean;
  durationMs: number;
  timestamp: string;
  message?: string;
}

export interface ReadThroughOptions<T> {
  fallback: T;
  legacyLocalStorageKey?: string;
  validate?: (value: unknown) => value is T;
  migrateLegacy?: boolean;
}
