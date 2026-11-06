import { coursesConflictInSameClass, getCourseTargetGroups } from "./scheduleIdentity";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export const DISTRIBUTION_REPORT_STORAGE_KEY = "rota_last_distribution_report";
export const DEFAULT_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"] as const;
export const DEFAULT_DAILY_LESSON_COUNT = 8;

export function getScheduleDays(): string[] {
  try {
    const raw = sqliteStorage.getItem("rota_schedule_constraint_settings_v1");
    const parsed = raw ? JSON.parse(raw) : null;
    const settings = parsed?.state?.settings || parsed?.settings || parsed || {};
    return Array.isArray(settings.workDays) && settings.workDays.length
      ? settings.workDays.map((day: unknown) => String(day))
      : [...DEFAULT_DAYS];
  } catch {
    return [...DEFAULT_DAYS];
  }
}

export function getScheduleHours(): number[] {
  try {
    const raw = sqliteStorage.getItem("rota_schedule_constraint_settings_v1");
    const parsed = raw ? JSON.parse(raw) : null;
    const settings = parsed?.state?.settings || parsed?.settings || parsed || {};
    const count = Math.max(1, Math.min(16, Number(settings.dailyLessonCount) || DEFAULT_DAILY_LESSON_COUNT));
    return Array.from({ length: count }, (_, index) => index + 1);
  } catch {
    return Array.from({ length: DEFAULT_DAILY_LESSON_COUNT }, (_, index) => index + 1);
  }
}

// Geriye dönük uyumluluk için varsayılan sabitler. Yeni solver kodu fonksiyonları kullanmalıdır.
export const DAYS = DEFAULT_DAYS;
export const HOURS = Array.from({ length: DEFAULT_DAILY_LESSON_COUNT }, (_, index) => index + 1);

export function getCourseColors(type: string, groupName = "") {
  const compulsory = type === "Zorunlu Ders" || type === "compulsory";
  if (compulsory) return { bg: "bg-emerald-50/70 border-emerald-100/80 hover:bg-emerald-100", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" };
  if (groupName.includes("SAY")) return { bg: "bg-rose-50/70 border-rose-100/80 hover:bg-rose-100", text: "text-rose-800", badge: "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200" };
  if (groupName.includes("EA")) return { bg: "bg-blue-50/70 border-blue-100/80 hover:bg-blue-100", text: "text-blue-800", badge: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" };
  if (groupName.includes("SÖZ")) return { bg: "bg-orange-50/70 border-orange-100/80 hover:bg-orange-100", text: "text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" };
  if (groupName.includes("DİL")) return { bg: "bg-fuchsia-50/70 border-fuchsia-100/80 hover:bg-fuchsia-100", text: "text-fuchsia-800", badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-200" };
  return { bg: "bg-amber-50/60 border-amber-100/80 hover:bg-amber-100", text: "text-amber-800", badge: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200" };
}

export function checkClassroomConflict(courseToPlace: any, existing: any[], classroom: any) {
  const targetGroups = getCourseTargetGroups(courseToPlace);

  // Sınıfın groups alanı yalnızca bu sınıfta hangi grup türlerinin tanımlı olduğunu
  // gösterir. Paralellik izni vermez. Paralellik tamamen derslerin hedef grup
  // kümelerinin kesişimine göre belirlenir.
  //
  // İsteğe bağlı veri güvenliği: Ders açıkça bir gruba atanmışsa ve sınıfta grup
  // tanımı varsa, hedef grubun sınıfta gerçekten tanımlı olup olmadığını kontrol et.
  const classroomGroups = Array.isArray(classroom?.groups)
    ? classroom.groups.map((group: unknown) => String(group).trim().toLocaleUpperCase("tr-TR"))
    : [];

  const declaredTargetGroups = targetGroups.filter((group) => !String(group).startsWith("__SPLIT__") && !String(group).startsWith("SPLIT:"));
  if (
    declaredTargetGroups.length > 0 &&
    classroomGroups.length > 0 &&
    declaredTargetGroups.some((group) => !classroomGroups.includes(group))
  ) {
    return {
      fits: false,
      reason: `Dersin hedef grubu sınıf tanımında yok: ${declaredTargetGroups
        .filter((group) => !classroomGroups.includes(group))
        .join(", ")}`,
    };
  }

  for (const placedCourse of existing || []) {
    if (coursesConflictInSameClass(courseToPlace, placedCourse)) {
      const placedGroups = getCourseTargetGroups(placedCourse);

      if (targetGroups.length === 0 || placedGroups.length === 0) {
        return {
          fits: false,
          reason: "GENEL/ORTAK ders aynı saatte başka dersle paralel yapılamaz.",
        };
      }

      const overlap = targetGroups.filter((group) => placedGroups.includes(group));
      const incomingStudents = Array.isArray(courseToPlace?.studentIds) ? courseToPlace.studentIds : [];
      const placedStudents = Array.isArray(placedCourse?.studentIds) ? placedCourse.studentIds : [];
      if (incomingStudents.length && placedStudents.length) {
        const placedSet = new Set(placedStudents.map((id: unknown) => String(id)));
        const commonStudentCount = incomingStudents.filter((id: unknown) => placedSet.has(String(id))).length;
        return {
          fits: false,
          reason: `Öğrenci çakışması: ${commonStudentCount} öğrenci aynı saatte iki derste kalıyor.`,
        };
      }
      return {
        fits: false,
        reason: `Hedef grup çakışması: ${overlap.join(", ") || "aynı öğrenci kitlesi"}`,
      };
    }
  }

  return { fits: true };
}

