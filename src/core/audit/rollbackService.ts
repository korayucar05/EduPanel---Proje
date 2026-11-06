import { hasCapability, normalizeCloudRole } from "../auth/rolePermissions";
import { loadAccessState } from "../../lib/accessControl";
import localforage from "../state/AppStateService";
import { hasatDataStore } from "../data/hasatDataStore";

const readStorageArray = async <T,>(key: string): Promise<T[]> => {
  try {
    const value = await localforage.getItem<T[]>(key);
    if (Array.isArray(value)) return value;
  } catch { /* fallback below */ }
  try {
    const raw = sqliteStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeStorageArray = async <T,>(key: string, value: T[]): Promise<void> => {
  await localforage.setItem(key, value);
  try { sqliteStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be restricted */ }
};
import { auditLog, type AuditLogEntry } from "./auditLog";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
export type RollbackRequestStatus = "pending" | "approved" | "rejected" | "applied" | "failed";

export type RollbackRequest = {
  id: string;
  schoolId: string;
  auditLogId: string;
  targetType: string;
  targetId: string;
  module: string;
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: number;
  dueAt: number;
  status: RollbackRequestStatus;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: number;
  reviewNote?: string;
  appliedAt?: number;
  closedAt?: number;
  notificationSeenAt?: number;
  error?: string;
  restoreSnapshot: Record<string, unknown>;
  currentSnapshot?: Record<string, unknown>;
};

const keyForSchool = (schoolId: string) => `audit_rollback_requests_v1:${schoolId || "school-main"}`;

function currentActor() {
  const state = loadAccessState();
  const sessionUserId = typeof runtimeSessionStorage !== "undefined" ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || "" : "";
  const user = state.users.find((candidate) => candidate.id === sessionUserId) || state.users.find((candidate) => candidate.id === state.currentUserId);
  return {
    schoolId: user?.schoolId || "school-main",
    actorId: user?.id || "system",
    actorName: user?.fullName || "Sistem",
    actorRole: user?.role || "system",
  };
}

function storageKeyForTarget(targetType: string): string | null {
  if (targetType === "behaviorRecord") return "behaviorRecords";
  if (targetType === "guidanceForm" || targetType === "boardDecision") return "disciplineBoardRecords";
  return null;
}

async function readRequests(schoolId: string): Promise<RollbackRequest[]> {
  const requests = (await hasatDataStore.readArray<RollbackRequest>(keyForSchool(schoolId), [])).value;
  return requests.map((request) => ({
    ...request,
    dueAt: Number(request.dueAt || request.requestedAt + 24 * 60 * 60 * 1000),
    closedAt: request.closedAt || request.appliedAt || request.reviewedAt,
  }));
}

async function writeRequests(schoolId: string, requests: RollbackRequest[]): Promise<void> {
  await hasatDataStore.write(keyForSchool(schoolId), requests.slice(0, 300));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hasat-rollback-request-changed"));
    window.dispatchEvent(new CustomEvent("hasat-management-notification", { detail: { type: "rollback", pending: requests.filter((item) => item.status === "pending").length } }));
  }
}

async function applyRestore(request: RollbackRequest): Promise<void> {
  const storageKey = storageKeyForTarget(request.targetType);
  if (!storageKey) throw new Error("Bu kayıt türü otomatik geri alma için desteklenmiyor.");
  const records = await readStorageArray<Record<string, unknown>>(storageKey);
  const index = records.findIndex((record) => String(record.id || "") === request.targetId);
  if (index < 0) throw new Error("Geri alınacak güncel kayıt bulunamadı.");
  const current = records[index];
  const restored = { ...request.restoreSnapshot, id: request.targetId, updatedAt: Date.now() };
  const next = [...records];
  next[index] = restored;
  await writeStorageArray(storageKey, next);
  await auditLog.record({
    action: "rollback",
    module: request.module as any,
    targetType: request.targetType,
    targetId: request.targetId,
    summary: `${request.targetType} kaydı onaylı taleple geri alındı`,
    metadata: { rollbackRequestId: request.id, originalAuditLogId: request.auditLogId, reason: request.reason },
    before: current,
    after: restored,
  });
}

export const rollbackService = {
  canRequest(): boolean {
    const actor = currentActor();
    return hasCapability(actor.actorRole, "audit.rollback.request");
  },

  canApprove(): boolean {
    const actor = currentActor();
    return hasCapability(actor.actorRole, "audit.rollback.approve");
  },

  isSupported(log: AuditLogEntry): boolean {
    return log.action === "update" && !!log.beforeSnapshot && !!log.targetId && storageKeyForTarget(log.targetType) !== null;
  },

  async list(schoolId?: string): Promise<RollbackRequest[]> {
    const actor = currentActor();
    return readRequests(schoolId || actor.schoolId);
  },

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    window.addEventListener("hasat-rollback-request-changed", handler);
    return () => window.removeEventListener("hasat-rollback-request-changed", handler);
  },

  async request(log: AuditLogEntry, reason: string): Promise<RollbackRequest> {
    const actor = currentActor();
    if (!hasCapability(actor.actorRole, "audit.rollback.request")) throw new Error("Geri alma talebi oluşturma yetkiniz yok.");
    if (!this.isSupported(log)) throw new Error("Bu işlem otomatik geri alma için uygun değil.");
    if (!reason.trim()) throw new Error("Geri alma gerekçesi zorunludur.");
    const requests = await readRequests(actor.schoolId);
    const duplicate = requests.find((item) => item.auditLogId === log.id && item.status === "pending");
    if (duplicate) throw new Error("Bu değişiklik için zaten bekleyen bir geri alma talebi var.");
    const request: RollbackRequest = {
      id: `rollback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      schoolId: actor.schoolId,
      auditLogId: log.id,
      targetType: log.targetType,
      targetId: String(log.targetId),
      module: log.module,
      reason: reason.trim(),
      requestedById: actor.actorId,
      requestedByName: actor.actorName,
      requestedByRole: actor.actorRole,
      requestedAt: Date.now(),
      dueAt: Date.now() + 24 * 60 * 60 * 1000,
      status: "pending",
      restoreSnapshot: log.beforeSnapshot || {},
      currentSnapshot: log.afterSnapshot,
    };
    await writeRequests(actor.schoolId, [request, ...requests]);
    await auditLog.record({ action: "rollback_request", module: "system", targetType: log.targetType, targetId: log.targetId, summary: "Geri alma talebi oluşturuldu", metadata: { rollbackRequestId: request.id, reason: request.reason } });
    return request;
  },

  async review(requestId: string, decision: "approve" | "reject", note = ""): Promise<RollbackRequest> {
    const actor = currentActor();
    if (!hasCapability(actor.actorRole, "audit.rollback.approve")) throw new Error("Geri alma talebini onaylama yetkiniz yok.");
    const requests = await readRequests(actor.schoolId);
    const index = requests.findIndex((item) => item.id === requestId);
    if (index < 0) throw new Error("Geri alma talebi bulunamadı.");
    const existing = requests[index];
    if (existing.status !== "pending") throw new Error("Bu talep daha önce sonuçlandırılmış.");
    const cloudRole = normalizeCloudRole(actor.actorRole);
    if (existing.requestedById === actor.actorId && cloudRole !== "super_admin") throw new Error("Talebi oluşturan kullanıcı kendi talebini onaylayamaz.");
    let updated: RollbackRequest = {
      ...existing,
      status: decision === "reject" ? "rejected" : "approved",
      reviewedById: actor.actorId,
      reviewedByName: actor.actorName,
      reviewedAt: Date.now(),
      reviewNote: note.trim(),
      closedAt: decision === "reject" ? Date.now() : undefined,
    };
    if (decision === "approve") {
      try {
        await applyRestore(updated);
        updated = { ...updated, status: "applied", appliedAt: Date.now(), closedAt: Date.now() };
      } catch (error) {
        updated = { ...updated, status: "failed", closedAt: Date.now(), error: error instanceof Error ? error.message : String(error) };
      }
    } else {
      await auditLog.record({ action: "rollback_rejected", module: "system", targetType: existing.targetType, targetId: existing.targetId, summary: "Geri alma talebi reddedildi", metadata: { rollbackRequestId: existing.id, note } });
    }
    const next = [...requests];
    next[index] = updated;
    await writeRequests(actor.schoolId, next);
    return updated;
  },

  slaState(request: RollbackRequest, now = Date.now()): "on_time" | "due_soon" | "overdue" | "closed" {
    if (request.status !== "pending") return "closed";
    const remaining = request.dueAt - now;
    if (remaining < 0) return "overdue";
    if (remaining <= 4 * 60 * 60 * 1000) return "due_soon";
    return "on_time";
  },

  async markNotificationsSeen(schoolId?: string): Promise<void> {
    const actor = currentActor();
    const resolvedSchoolId = schoolId || actor.schoolId;
    const requests = await readRequests(resolvedSchoolId);
    const now = Date.now();
    const next = requests.map((request) => request.status === "pending" && !request.notificationSeenAt ? { ...request, notificationSeenAt: now } : request);
    await writeRequests(resolvedSchoolId, next);
  },
};
