type ModulePermission = {
  view: boolean;
  create: boolean;
  update: boolean;
};

const permissionModuleIds = [
  "students",
  "staff",
  "classes_courses",
  "schedule",
  "exams",
  "student_support",
  "communication",
  "calendar",
  "social_activities",
  "school_settings",
  "reports_database",
] as const;

const emptyPermissions = (): Record<string, ModulePermission> =>
  Object.fromEntries(
    permissionModuleIds.map((id) => [id, { view: false, create: false, update: false }]),
  );

/**
 * Browser depolama köprülerini yüklemeden sunucunun kullanabileceği başlangıç
 * yetkilendirme kaydı. Bu dosya Node.js/Passenger başlangıç zincirinde güvenlidir.
 */
export const createInitialAccessState = () => ({
  schemaVersion: 2,
  schools: [
    {
      id: "school-main",
      code: "KORAY",
      name: "Ordu Lisesi",
      city: "Ordu",
      slogan: "Ordu'nun taa kendisi ...",
      status: "active",
    },
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
