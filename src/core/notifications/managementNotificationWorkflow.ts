import { loadAccessState } from "../../lib/accessControl";
import { hasatDataStore } from "../data/hasatDataStore";
import { auditLog } from "../audit";

import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
export type ManagementNotificationStatus = "open" | "assigned" | "snoozed" | "resolved";
export type ManagementNotificationLevel = "critical" | "warning" | "info";
export type ManagementNotificationSource = "rollback" | "audit";

export type ManagementNotificationWorkflow = {
  notificationId: string;
  schoolId: string;
  title: string;
  description: string;
  level: ManagementNotificationLevel;
  source: ManagementNotificationSource;
  status: ManagementNotificationStatus;
  assignee: string;
  snoozedUntil?: number;
  resolutionNote: string;
  createdAt: number;
  dueAt: number;
  escalationLevel: 0 | 1 | 2;
  escalationReason?: string;
  escalatedAt?: number;
  updatedAt: number;
  updatedById: string;
  updatedByName: string;
  resolvedAt?: number;
  resolvedById?: string;
  resolvedByName?: string;
};

const keyForSchool = (schoolId: string) => `management_notification_workflows_v2:${schoolId || "school-main"}`;
const legacyKeyForSchool = (schoolId: string) => `management_notification_workflows_v1:${schoolId || "school-main"}`;
export const MANAGEMENT_NOTIFICATION_WORKFLOW_CHANGED = "hasat-management-notification-workflow-changed";

const dueDuration = (level: ManagementNotificationLevel) => level === "critical" ? 4 * 60 * 60 * 1000 : level === "warning" ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

function currentActor() {
  const state = loadAccessState();
  const sessionUserId = typeof runtimeSessionStorage !== "undefined" ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || "" : "";
  const user = state.users.find((candidate) => candidate.id === sessionUserId) || state.users.find((candidate) => candidate.id === state.currentUserId);
  return { id: user?.id || "system", name: user?.fullName || "Sistem", schoolId: user?.schoolId || "school-main" };
}

function normalize(item: Partial<ManagementNotificationWorkflow> & { notificationId: string; schoolId: string }): ManagementNotificationWorkflow {
  const createdAt = Number(item.createdAt || Date.now());
  const level = item.level || "info";
  return {
    notificationId: item.notificationId,
    schoolId: item.schoolId,
    title: item.title || "Yönetim bildirimi",
    description: item.description || "",
    level,
    source: item.source || "audit",
    status: item.status || "open",
    assignee: item.assignee || "",
    snoozedUntil: item.snoozedUntil ? Number(item.snoozedUntil) : undefined,
    resolutionNote: item.resolutionNote || "",
    createdAt,
    dueAt: Number(item.dueAt || createdAt + dueDuration(level)),
    escalationLevel: item.escalationLevel === 2 ? 2 : item.escalationLevel === 1 ? 1 : 0,
    escalationReason: item.escalationReason,
    escalatedAt: item.escalatedAt ? Number(item.escalatedAt) : undefined,
    updatedAt: Number(item.updatedAt || createdAt),
    updatedById: item.updatedById || "system",
    updatedByName: item.updatedByName || "Sistem",
    resolvedAt: item.resolvedAt ? Number(item.resolvedAt) : undefined,
    resolvedById: item.resolvedById,
    resolvedByName: item.resolvedByName,
  };
}

async function readAll(schoolId: string): Promise<ManagementNotificationWorkflow[]> {
  const current = await hasatDataStore.readArray<ManagementNotificationWorkflow>(keyForSchool(schoolId), []);
  let values = current.value;
  if (!values.length) {
    const legacy = await hasatDataStore.readArray<ManagementNotificationWorkflow>(legacyKeyForSchool(schoolId), []);
    values = legacy.value;
    if (values.length) await hasatDataStore.write(keyForSchool(schoolId), values.map((item) => normalize(item)));
  }
  return values.filter((item) => item && item.schoolId === schoolId && item.notificationId).map((item) => normalize(item)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 500);
}

async function writeAll(schoolId: string, items: ManagementNotificationWorkflow[]) {
  await hasatDataStore.write(keyForSchool(schoolId), items.slice(0, 500));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MANAGEMENT_NOTIFICATION_WORKFLOW_CHANGED, { detail: { schoolId } }));
}

export const managementNotificationWorkflow = {
  async list(schoolId?: string): Promise<ManagementNotificationWorkflow[]> {
    const actor = currentActor();
    return readAll(schoolId || actor.schoolId);
  },

  async ensure(input: { notificationId: string; schoolId: string; title: string; description: string; level: ManagementNotificationLevel; source: ManagementNotificationSource; createdAt: number; }): Promise<ManagementNotificationWorkflow> {
    const actor = currentActor();
    const items = await readAll(input.schoolId);
    const existing = items.find((item) => item.notificationId === input.notificationId);
    if (existing) return existing;
    const created = normalize({ ...input, status: "open", assignee: "", resolutionNote: "", updatedAt: Date.now(), updatedById: actor.id, updatedByName: actor.name, escalationLevel: 0 });
    await writeAll(input.schoolId, [created, ...items]);
    return created;
  },

  async autoEscalate(schoolId: string, now = Date.now()): Promise<number> {
    const actor = currentActor();
    const items = await readAll(schoolId);
    let changed = 0;
    const next = items.map((item) => {
      if (item.status === "resolved" || (item.status === "snoozed" && Number(item.snoozedUntil || 0) > now)) return item;
      const overdueMs = now - item.dueAt;
      const desired: 0 | 1 | 2 = overdueMs >= 24 * 60 * 60 * 1000 ? 2 : overdueMs >= 0 ? 1 : 0;
      if (desired <= item.escalationLevel) return item;
      changed += 1;
      return {
        ...item,
        escalationLevel: desired,
        escalationReason: desired === 2 ? "Bildirim 24 saatten uzun süredir gecikmiş durumda." : "Bildirim hedef çözüm süresini aştı.",
        escalatedAt: now,
        assignee: item.assignee || (desired === 2 ? "Okul Müdürü" : "Okul Yönetimi"),
        status: "assigned" as const,
        updatedAt: now,
        updatedById: actor.id,
        updatedByName: actor.name,
      };
    });
    if (changed) {
      await writeAll(schoolId, next);
      await auditLog.record({ action: "update", module: "system", targetType: "managementNotification", targetId: schoolId, summary: `${changed} yönetim bildirimi otomatik olarak üst yönetime eskale edildi`, metadata: { changed } });
    }
    return changed;
  },

  async assign(schoolId: string, notificationId: string, assignee: string): Promise<void> {
    const actor = currentActor();
    const items = await readAll(schoolId);
    const next = items.map((item) => item.notificationId === notificationId ? { ...item, assignee: assignee.trim(), status: assignee.trim() ? "assigned" as const : "open" as const, snoozedUntil: undefined, updatedAt: Date.now(), updatedById: actor.id, updatedByName: actor.name } : item);
    await writeAll(schoolId, next);
    await auditLog.record({ action: "update", module: "system", targetType: "managementNotification", targetId: notificationId, summary: assignee.trim() ? `Yönetim bildirimi ${assignee.trim()} sorumlusuna atandı` : "Yönetim bildirimi ataması kaldırıldı", metadata: { assignee: assignee.trim() } });
  },

  async snooze(schoolId: string, notificationId: string, until: number): Promise<void> {
    const actor = currentActor();
    const items = await readAll(schoolId);
    const next = items.map((item) => item.notificationId === notificationId ? { ...item, status: "snoozed" as const, snoozedUntil: until, updatedAt: Date.now(), updatedById: actor.id, updatedByName: actor.name } : item);
    await writeAll(schoolId, next);
    await auditLog.record({ action: "update", module: "system", targetType: "managementNotification", targetId: notificationId, summary: "Yönetim bildirimi ertelendi", metadata: { snoozedUntil: until } });
  },

  async resolve(schoolId: string, notificationId: string, note: string): Promise<void> {
    if (!note.trim()) throw new Error("Çözüm notu zorunludur.");
    const actor = currentActor();
    const items = await readAll(schoolId);
    const next = items.map((item) => item.notificationId === notificationId ? { ...item, status: "resolved" as const, resolutionNote: note.trim(), resolvedAt: Date.now(), resolvedById: actor.id, resolvedByName: actor.name, snoozedUntil: undefined, updatedAt: Date.now(), updatedById: actor.id, updatedByName: actor.name } : item);
    await writeAll(schoolId, next);
    await auditLog.record({ action: "update", module: "system", targetType: "managementNotification", targetId: notificationId, summary: "Yönetim bildirimi çözüm notuyla kapatıldı", metadata: { resolutionNote: note.trim() } });
  },

  async reopen(schoolId: string, notificationId: string): Promise<void> {
    const actor = currentActor();
    const items = await readAll(schoolId);
    const next = items.map((item) => item.notificationId === notificationId ? { ...item, status: item.assignee ? "assigned" as const : "open" as const, resolutionNote: "", resolvedAt: undefined, resolvedById: undefined, resolvedByName: undefined, dueAt: Date.now() + dueDuration(item.level), escalationLevel: 0 as const, escalationReason: undefined, escalatedAt: undefined, updatedAt: Date.now(), updatedById: actor.id, updatedByName: actor.name } : item);
    await writeAll(schoolId, next);
    await auditLog.record({ action: "update", module: "system", targetType: "managementNotification", targetId: notificationId, summary: "Yönetim bildirimi yeniden açıldı" });
  },

  subscribe(schoolId: string, listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ schoolId?: string }>).detail;
      if (!detail?.schoolId || detail.schoolId === schoolId) listener();
    };
    window.addEventListener(MANAGEMENT_NOTIFICATION_WORKFLOW_CHANGED, handler);
    return () => window.removeEventListener(MANAGEMENT_NOTIFICATION_WORKFLOW_CHANGED, handler);
  },
};
