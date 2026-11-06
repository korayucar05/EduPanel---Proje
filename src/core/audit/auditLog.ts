import { loadAccessState } from "../../lib/accessControl";
import { hasatDataStore } from "../data/hasatDataStore";
import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "send"
  | "publish"
  | "read"
  | "login"
  | "logout"
  | "sync"
  | "permission_denied"
  | "rollback_request"
  | "rollback"
  | "rollback_rejected";

export type AuditModule = "messages" | "behavior" | "discipline" | "reports" | "tasks" | "auth" | "system";

export type AuditFieldChange = { field: string; before?: string; after?: string };

export type AuditLogEntry = {
  id: string;
  schoolId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  module: AuditModule;
  targetType: string;
  targetId?: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  changes?: AuditFieldChange[];
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  createdAt: number;
  source: "local" | "cloud";
};

const MAX_LOCAL_LOGS = 1000;
const keyForSchool = (schoolId: string) => `audit_logs_v1:${schoolId || "school-main"}`;

function currentActor() {
  const state = loadAccessState();
  const sessionUserId = typeof runtimeSessionStorage !== "undefined"
    ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || ""
    : "";
  const user = state.users.find((candidate) => candidate.id === sessionUserId)
    || state.users.find((candidate) => candidate.id === state.currentUserId);
  return {
    schoolId: user?.schoolId || "school-main",
    actorId: user?.id || "system",
    actorName: user?.fullName || "Sistem",
    actorRole: user?.role || "system",
  };
}

const cleanMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    if (value === undefined || value === null || ["string", "number", "boolean"].includes(typeof value)) return [key, value as any];
    return [key, String(value)];
  }));
};

const safeSnapshot = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const displayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  } catch {
    return String(value);
  }
};

const buildChanges = (before?: Record<string, unknown>, after?: Record<string, unknown>): AuditFieldChange[] | undefined => {
  if (!before && !after) return undefined;
  const ignored = new Set(["updatedAt", "createdAt", "serverCreatedAt"]);
  const keys = new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]);
  const changes = [...keys]
    .filter((key) => !ignored.has(key))
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .slice(0, 30)
    .map((field) => ({ field, before: displayValue(before?.[field]), after: displayValue(after?.[field]) }));
  return changes.length ? changes : undefined;
};

async function readLocal(schoolId: string): Promise<AuditLogEntry[]> {
  return (await hasatDataStore.readArray<AuditLogEntry>(keyForSchool(schoolId), [])).value;
}

async function writeLocal(entry: AuditLogEntry): Promise<void> {
  const logs = await readLocal(entry.schoolId);
  const next = [entry, ...logs.filter((item) => item.id !== entry.id)].slice(0, MAX_LOCAL_LOGS);
  await hasatDataStore.write(keyForSchool(entry.schoolId), next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hasat-audit-log-changed", { detail: entry }));
  }
}

export const auditLog = {
  async record(input: Omit<AuditLogEntry, "id" | "schoolId" | "actorId" | "actorName" | "actorRole" | "createdAt" | "source" | "changes" | "beforeSnapshot" | "afterSnapshot"> & { metadata?: Record<string, unknown>; before?: unknown; after?: unknown }): Promise<AuditLogEntry> {
    const actor = currentActor();
    const beforeSnapshot = safeSnapshot(input.before);
    const afterSnapshot = safeSnapshot(input.after);
    const { before: _before, after: _after, ...baseInput } = input;
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...actor,
      ...baseInput,
      metadata: cleanMetadata(input.metadata),
      beforeSnapshot,
      afterSnapshot,
      changes: buildChanges(beforeSnapshot, afterSnapshot),
      createdAt: Date.now(),
      source: "local",
    };
    await writeLocal(entry);
    return entry;
  },

  async list(schoolId?: string): Promise<AuditLogEntry[]> {
    const actor = currentActor();
    return readLocal(schoolId || actor.schoolId);
  },

  subscribeLocal(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const handler = () => listener();
    window.addEventListener("hasat-audit-log-changed", handler);
    return () => window.removeEventListener("hasat-audit-log-changed", handler);
  },

  // Firestore gerçek-zamanlı dinleyicisi bilinçli olarak devre dışıdır.
  // Denetim kayıtlarının tek çalışma kaynağı yerel SQLite/hasatDataStore'dur.
  subscribeCloud(_schoolId: string, _listener: (logs: AuditLogEntry[]) => void): () => void {
    return () => undefined;
  },
};
