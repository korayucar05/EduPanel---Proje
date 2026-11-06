export const CLOUD_ROLES = [
  "super_admin",
  "principal",
  "assistant_principal",
  "teacher",
  "counselor",
] as const;

export type CloudRole = (typeof CLOUD_ROLES)[number];

export type Capability =
  | "school.manage"
  | "members.manage"
  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "students.view"
  | "students.manage"
  | "teachers.view"
  | "teachers.manage"
  | "guidance.view"
  | "guidance.manage"
  | "discipline.view"
  | "discipline.manage"
  | "reports.publish"
  | "messages.send"
  | "audit.rollback.request"
  | "audit.rollback.approve";

const ALL_CAPABILITIES: readonly Capability[] = [
  "school.manage",
  "members.manage",
  "tasks.view",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "students.view",
  "students.manage",
  "teachers.view",
  "teachers.manage",
  "guidance.view",
  "guidance.manage",
  "discipline.view",
  "discipline.manage",
  "reports.publish",
  "messages.send",
  "audit.rollback.request",
  "audit.rollback.approve",
];

export const ROLE_CAPABILITIES: Record<CloudRole, readonly Capability[]> = {
  super_admin: ALL_CAPABILITIES,
  principal: ALL_CAPABILITIES,
  assistant_principal: ALL_CAPABILITIES.filter((capability) => !["members.manage", "audit.rollback.approve"].includes(capability)),
  teacher: [
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "students.view",
    "teachers.view",
    "reports.publish",
    "messages.send",
  ],
  counselor: [
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "students.view",
    "teachers.view",
    "guidance.view",
    "guidance.manage",
    "discipline.view",
    "reports.publish",
    "messages.send",
  ],
};

export function normalizeCloudRole(value: unknown): CloudRole | null {
  const role = String(value || "").trim() as CloudRole;
  return CLOUD_ROLES.includes(role) ? role : null;
}

export function hasCapability(role: unknown, capability: Capability): boolean {
  const normalized = normalizeCloudRole(role);
  return normalized ? ROLE_CAPABILITIES[normalized].includes(capability) : false;
}

export function roleLabel(role: unknown): string {
  switch (normalizeCloudRole(role)) {
    case "super_admin": return "Süper Yönetici";
    case "principal": return "Okul Müdürü";
    case "assistant_principal": return "Müdür Yardımcısı";
    case "teacher": return "Öğretmen";
    case "counselor": return "Rehber Öğretmen";
    default: return "Tanımsız Rol";
  }
}
