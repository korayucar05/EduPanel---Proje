import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export type AppErrorContext = {
  source?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
};

export type StoredAppError = {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
};

const STORAGE_KEY = "hasat_error_log_v1";
const MAX_STORED_ERRORS = 20;

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
};

export const createErrorId = () =>
  `e-Nstitü-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const logAppError = (error: unknown, context: AppErrorContext = {}): StoredAppError => {
  const normalized = normalizeError(error);
  const entry: StoredAppError = {
    id: createErrorId(),
    timestamp: new Date().toISOString(),
    message: normalized.message || "Bilinmeyen uygulama hatası",
    stack: normalized.stack,
    source: context.source,
    componentStack: context.componentStack,
    metadata: context.metadata,
  };

  console.error(`[${entry.id}] ${entry.source || "e-Nstitü"}`, normalized, context);

  try {
    const previous = JSON.parse(sqliteStorage.getItem(STORAGE_KEY) || "[]") as StoredAppError[];
    sqliteStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...previous].slice(0, MAX_STORED_ERRORS)));
    sqliteStorage.setItem("last_error", entry.message);
    sqliteStorage.setItem("last_error_stack", entry.stack || "no stack");
    sqliteStorage.setItem("last_error_id", entry.id);
  } catch {
    // Depolama erişimi kapalı olsa bile uygulama hata ekranı çalışmaya devam eder.
  }

  return entry;
};

export const getStoredAppErrors = (): StoredAppError[] => {
  try {
    return JSON.parse(sqliteStorage.getItem(STORAGE_KEY) || "[]") as StoredAppError[];
  } catch {
    return [];
  }
};
