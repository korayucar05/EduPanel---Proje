import { sqliteStorage } from "./sqliteStorageBridge";
import { runtimeSessionStorage } from "./runtimeSessionStorage";
export type UserRole = "super_admin" | "principal" | "school_admin" | "teacher";
export type UserStatus = "active" | "passive";
export type PermissionAction = "view" | "create" | "update";

export interface ModulePermission {
  view: boolean;
  create: boolean;
  update: boolean;
}

export interface SchoolAccount {
  id: string;
  code: string;
  name: string;
  city: string;
  slogan?: string;
  status: UserStatus;
  /**
   * Süper Admin tarafından bu okula açılan modül paketleri.
   * Eski kayıtlarda alan yoksa geriye dönük uyumluluk için tüm modüller açık kabul edilir.
   */
  enabledModules?: string[];
  licenseNote?: string;
}

export interface PanelUser {
  id: string;
  schoolId: string | null;
  fullName: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  permissions: Record<string, ModulePermission>;
  passwordHash?: string;
  passwordSalt?: string;
}

export interface AccessControlState {
  schemaVersion?: number;
  schools: SchoolAccount[];
  users: PanelUser[];
  currentUserId: string;
  /**
   * Süper Admin'in o anda hangi okul verisiyle çalıştığını belirtir.
   * Normal okul kullanıcılarında kendi schoolId değeri kullanılır.
   */
  activeSchoolId?: string;
}

export const PERMISSION_MODULES = [
  { id: "students", label: "Öğrenci İşlemleri", description: "Kayıt, iletişim, devamsızlık ve öğrenci bilgileri", tabs: ["students"] },
  { id: "staff", label: "Öğretmen ve Personel", description: "Öğretmen kadrosu ve insan kaynakları", tabs: ["teachers", "human-resources"] },
  { id: "classes_courses", label: "Sınıf ve Dersler", description: "Sınıflar, dersler, kurul ve komisyonlar", tabs: ["classes", "courses", "committees", "duty-info"] },
  { id: "schedule", label: "Ders Programı", description: "Ders dağıtımı ve haftalık program", tabs: ["schedule-planner", "a-panel"] },
  { id: "exams", label: "Sınav ve Akademik Takip", description: "Sınav hazırlama, analiz, ortak sınav, test ve anketler", tabs: ["exam-tools", "exam-prepare", "exam-analysis", "exam-reports", "google-forms", "kelebek-a", "kelebek-b", "test", "survey", "lost-documents", "attendance-slip", "question-prepare", "network-exams"] },
  { id: "student_support", label: "Rehberlik ve Disiplin", description: "Davranış, rehberlik, disiplin ve eğitim koçluğu kayıtları", tabs: ["behavior", "behavior-definitions", "guidance", "discipline", "homework-control", "education-coach"] },
  { id: "communication", label: "İletişim", description: "Mesaj, WhatsApp ve sesli mesaj işlemleri", tabs: ["messages", "voice-messages", "message-tools", "whatsapp"] },
  { id: "calendar", label: "Takvim ve Duyurular", description: "Akademik takvim ve kurum duyuruları", tabs: ["academic-calendar", "announcements"] },
  { id: "social_activities", label: "Kulüpler / Sosyal Etkinlikler", description: "Öğrenci kulüpleri, danışman öğretmenler ve belirli gün/hafta planlaması", tabs: ["social-clubs-activities"] },
  { id: "school_settings", label: "Okul Bilgileri ve Ayarlar", description: "Kurumsal bilgiler ve okul ayarları", tabs: ["school-info", "settings"] },
  { id: "reports_database", label: "Raporlar ve Veritabanı", description: "Toplu raporlar, dışa aktarma ve yedekleme", tabs: ["database"] },
] as const;

const emptyPermissions = (): Record<string, ModulePermission> =>
  Object.fromEntries(PERMISSION_MODULES.map((module) => [module.id, { view: false, create: false, update: false }]));

export const MAX_SUPER_ADMINS = 3;
export const MAX_SCHOOL_DELEGATED_ADMINS = 3;

export function allModuleIds(): string[] {
  return PERMISSION_MODULES.map((module) => module.id);
}

export function isSchoolModuleEnabled(
  state: AccessControlState,
  user: PanelUser | undefined,
  tabId: string,
): boolean {
  if (!user || user.status !== "active") return false;
  if (user.role === "super_admin" || tabId === "dashboard" || tabId === "settings") return true;
  const module = permissionModuleForTab(tabId);
  if (!module) return true;
  const school = state.schools.find((item) => item.id === user.schoolId);
  if (!school) return false;
  const enabled = Array.isArray(school.enabledModules) ? school.enabledModules : allModuleIds();
  return enabled.includes(module.id);
}

const STORAGE_KEY = "edupanel_access_control_v1";

export const createInitialAccessState = (): AccessControlState => ({
  schemaVersion: 2,
  schools: [
    { id: "school-main", code: "KORAY", name: "Ordu Lisesi", city: "Ordu", slogan: "Ordu'nun taa kendisi ...", status: "active" },
  ],
  users: [
    {
      id: "super-admin",
      schoolId: null,
      fullName: "Sistem Süper Admini",
      email: "admin@edupanel.local",
      username: "superadmin",
      role: "super_admin",
      status: "active",
      permissions: emptyPermissions(),
      passwordSalt: "edupanel-super-2026",
      passwordHash: "d20ca8b17bc9dfdba459a13d72f8cfe611bbff11fdec4feef07fa9a25ab1763a",
    },
    {
      id: "principal-main",
      schoolId: "school-main",
      fullName: "Yönetici",
      email: "korayucar61@gmail.com",
      username: "Yönetici",
      role: "principal",
      status: "active",
      permissions: emptyPermissions(),
      passwordSalt: "edupanel-koray-2026",
      passwordHash: "7ae733d7aa1617103d805392c8c0f5dd757780c6d3369b05242670e4cfc56d6d",
    },
  ],
  currentUserId: "super-admin",
  activeSchoolId: "school-main",
});

export function loadAccessState(): AccessControlState {
  try {
    const parsed = JSON.parse(sqliteStorage.getItem(STORAGE_KEY) || "null") as AccessControlState | null;
    if (parsed?.schools?.length && parsed?.users?.length) {
      const defaults = createInitialAccessState();
      parsed.users = parsed.users.map((user) => {
        const defaultUser = defaults.users.find((candidate) => candidate.id === user.id);
        return user.passwordHash ? user : {
          ...user,
          passwordHash: defaultUser?.passwordHash,
          passwordSalt: defaultUser?.passwordSalt,
        };
      });

      parsed.activeSchoolId = parsed.activeSchoolId || parsed.schools[0]?.id || "school-main";

      parsed.schools = parsed.schools.map((school) => {
        const existingModules = Array.isArray(school.enabledModules) ? school.enabledModules : allModuleIds();
        const enabledModules = school.id === "school-main" && !existingModules.includes("social_activities")
          ? [...existingModules, "social_activities"]
          : existingModules;
        const migrated = {
          ...school,
          enabledModules,
        };
        return school.id === "school-main"
          ? {
              ...migrated,
              name: "Ordu Lisesi",
              slogan: "Ordu'nun taa kendisi ...",
              city: school.city || "Ordu",
            }
          : migrated;
      });

      return parsed;
    }
  } catch (error) {
    console.warn("Yetkilendirme verisi okunamadı", error);
  }
  return createInitialAccessState();
}

export function saveAccessState(state: AccessControlState) {
  sqliteStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("edupanel-access-changed", { detail: state }));
  const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  if (sessionToken) {
    void fetch("/api/auth/directory", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(state),
    }).catch(() => null);
  }
}

export function findCurrentUser(state: AccessControlState) {
  return state.users.find((user) => user.id === state.currentUserId) || state.users[0];
}

export function permissionModuleForTab(tabId: string) {
  return PERMISSION_MODULES.find((module) => (module.tabs as readonly string[]).includes(tabId));
}

export function canAccessTab(user: PanelUser | undefined, tabId: string, action: PermissionAction = "view") {
  if (!user || user.status !== "active") return false;
  if (user.role === "super_admin" || user.role === "principal" || tabId === "dashboard") return true;
  const module = permissionModuleForTab(tabId);
  return module ? Boolean(user.permissions?.[module.id]?.[action]) : false;
}

export const blankPermissions = emptyPermissions;

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, salt: string) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function createPasswordCredential(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const passwordSalt = bytesToHex(saltBytes);
  return { passwordSalt, passwordHash: await hashPassword(password, passwordSalt) };
}

export async function verifyPassword(user: PanelUser, password: string) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  return (await hashPassword(password, user.passwordSalt)) === user.passwordHash;
}
