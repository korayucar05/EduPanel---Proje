import { hasatDataStore } from "../data/hasatDataStore";
import { auditLog } from "../audit";

import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
export type NotificationDigestMode = "instant" | "daily" | "weekly";
export type ManagementNotificationPolicy = {
  schoolId: string;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  digestMode: NotificationDigestMode;
  includeInfo: boolean;
  updatedAt: number;
  updatedBy: string;
};

const keyForSchool = (schoolId: string) => `management_notification_policy_v1:${schoolId || "school-main"}`;
export const MANAGEMENT_NOTIFICATION_POLICY_CHANGED = "hasat-management-notification-policy-changed";

const defaults = (schoolId: string): ManagementNotificationPolicy => ({
  schoolId,
  quietHoursEnabled: true,
  quietStart: "20:00",
  quietEnd: "07:30",
  digestMode: "daily",
  includeInfo: true,
  updatedAt: Date.now(),
  updatedBy: "Sistem",
});

function actorName() {
  if (typeof runtimeSessionStorage === "undefined") return "Sistem";
  return runtimeSessionStorage.getItem("edupanel_authenticated_user_name") || "Sistem";
}

function normalize(schoolId: string, value?: Partial<ManagementNotificationPolicy>): ManagementNotificationPolicy {
  const base = defaults(schoolId);
  return {
    ...base,
    ...value,
    schoolId,
    quietHoursEnabled: value?.quietHoursEnabled !== false,
    digestMode: value?.digestMode === "instant" || value?.digestMode === "weekly" ? value.digestMode : "daily",
    includeInfo: value?.includeInfo !== false,
    updatedAt: Number(value?.updatedAt || base.updatedAt),
    updatedBy: value?.updatedBy || base.updatedBy,
  };
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export const managementNotificationPolicy = {
  async get(schoolId: string): Promise<ManagementNotificationPolicy> {
    const result = await hasatDataStore.read<ManagementNotificationPolicy>(keyForSchool(schoolId), { fallback: defaults(schoolId) });
    return normalize(schoolId, result.value);
  },

  async save(schoolId: string, patch: Partial<ManagementNotificationPolicy>): Promise<ManagementNotificationPolicy> {
    const current = await this.get(schoolId);
    const next = normalize(schoolId, { ...current, ...patch, updatedAt: Date.now(), updatedBy: actorName() });
    await hasatDataStore.write(keyForSchool(schoolId), next);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MANAGEMENT_NOTIFICATION_POLICY_CHANGED, { detail: { schoolId } }));
    await auditLog.record({ action: "update", module: "system", targetType: "managementNotificationPolicy", targetId: schoolId, summary: "Yönetim bildirim politikası güncellendi", metadata: { quietHoursEnabled: next.quietHoursEnabled, quietStart: next.quietStart, quietEnd: next.quietEnd, digestMode: next.digestMode, includeInfo: next.includeInfo } });
    return next;
  },

  isQuietNow(policy: ManagementNotificationPolicy, date = new Date()): boolean {
    if (!policy.quietHoursEnabled) return false;
    const current = date.getHours() * 60 + date.getMinutes();
    const start = timeToMinutes(policy.quietStart);
    const end = timeToMinutes(policy.quietEnd);
    return start <= end ? current >= start && current < end : current >= start || current < end;
  },

  subscribe(schoolId: string, listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ schoolId?: string }>).detail;
      if (!detail?.schoolId || detail.schoolId === schoolId) listener();
    };
    window.addEventListener(MANAGEMENT_NOTIFICATION_POLICY_CHANGED, handler);
    return () => window.removeEventListener(MANAGEMENT_NOTIFICATION_POLICY_CHANGED, handler);
  },
};
