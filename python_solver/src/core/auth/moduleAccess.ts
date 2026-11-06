import type { PanelUser } from "../../lib/accessControl";
import { canAccessTab } from "../../lib/accessControl";
import type { CloudRole } from "./rolePermissions";

const teacherTabs = new Set([
  "dashboard",
  "teacher-analytics",
  "learning-map",
  "education-coach",
  "exam-reports",
  "exam-analysis",
  "exam-prepare",
  "exam-tools",
  "google-forms",
  "messages",
  "voice-messages",
  "message-tools",
  "academic-calendar",
  "announcements",
  "attendance-slip",
  "question-prepare",
]);

const counselorTabs = new Set([
  "dashboard",
  "guidance-center",
  "behavior",
  "guidance",
  "discipline",
  "discipline-analytics",
  "learning-map",
  "education-coach",
  "exam-reports",
  "messages",
  "voice-messages",
  "message-tools",
  "academic-calendar",
  "announcements",
]);

const assistantPrincipalDeniedTabs = new Set([
  "settings",
]);

export function localRoleToCloudRole(role?: PanelUser["role"]): CloudRole {
  if (role === "super_admin") return "super_admin";
  if (role === "principal") return "principal";
  if (role === "school_admin") return "assistant_principal";
  return "teacher";
}

export function isTabAllowedForCloudRole(role: CloudRole, tabId: string): boolean {
  if (tabId === "dashboard") return true;
  if (role === "super_admin" || role === "principal") return true;
  if (role === "assistant_principal") return !assistantPrincipalDeniedTabs.has(tabId);
  if (role === "counselor") return counselorTabs.has(tabId);
  return teacherTabs.has(tabId);
}

/**
 * İki katmanlı erişim kontrolü:
 * 1) Bulut rolü modülün rol açısından uygun olup olmadığını belirler.
 * 2) Yerel EDUPANEL izinleri öğretmen gibi kısıtlı hesaplarda ek daraltma yapar.
 */
export function canAccessModuleTab(
  user: PanelUser | undefined,
  cloudRole: CloudRole,
  tabId: string,
): boolean {
  if (!user || user.status !== "active") return false;
  if (!isTabAllowedForCloudRole(cloudRole, tabId)) return false;
  if (cloudRole === "super_admin" || cloudRole === "principal") return true;
  if (cloudRole === "assistant_principal" && tabId === "teacher-interfaces") return true;
  // Yerel "school_admin" hesabı müdür yardımcısı seviyesinde çalışır fakat
  // okul yöneticisinin verdiği modül izinleriyle sınırlandırılır.
  if (cloudRole === "assistant_principal" && user.role === "school_admin") {
    return canAccessTab(user, tabId);
  }
  if (cloudRole === "assistant_principal" || cloudRole === "counselor") return true;
  if (tabId === "teacher-analytics" || tabId === "learning-map") return true;
  return canAccessTab(user, tabId);
}
