import type { Classroom } from "../../types";
import { createCourseIdentity, getCourseTargetGroups, getScheduleCourseName, getScheduleWeeklyHours, normalizeScheduleText } from "./scheduleIdentity";
import type { ScheduleViewType } from "../../types/schedule";

interface GetAssignedCoursesArgs {
  selectedId: string;
  viewType: ScheduleViewType;
  classrooms: Classroom[];
}

function canonicalCourseName(value: unknown): string {
  const normalized = normalizeScheduleText(value)
    .replace(/Ä/g, "G")
    .replace(/Ãœ/g, "U")
    .replace(/Å/g, "S")
    .replace(/Ã–/g, "O")
    .replace(/Ã‡/g, "C")
    .replace(/Ä°/g, "I");

  // Eski otomatik migration sadece "Rehberlik" adını kullanıyordu. Güncel
  // resmi ders adıyla aynı kimlik kabul edilerek çift kayıt tekilleştirilir.
  if (normalized === "REHBERLIK") return "REHBERLIK VE YONLENDIRME";
  return normalized;
}

function courseRichnessScore(course: any): number {
  return [
    course?.id, course?.teacherId, course?.teacherId2, course?.teacherName,
    course?.teacherName2, course?.type, course?.groupName, course?.targetGroups,
    course?.splitGroupId, course?.preferredBlocks,
  ].reduce((score, value) => score + (Array.isArray(value) ? value.length : value ? 1 : 0), 0);
}

/**
 * classrooms[].assignedCourses içindeki legacy/çift kayıtları yalnız dağıtım
 * açısından tekilleştirir. Kaynak veriyi mutate etmez. Aynı sınıf + ders + saat +
 * hedef grup için daha zengin (öğretmen/kimlik bilgisi bulunan) kayıt korunur.
 */
export function getCurrentAssignedCourses(classroom: any): any[] {
  const source = Array.isArray(classroom?.assignedCourses) ? classroom.assignedCourses.filter(Boolean) : [];
  const byKey = new Map<string, any>();

  for (const course of source) {
    const groups = getCourseTargetGroups(course).join("+") || "GENEL";
    const key = [
      canonicalCourseName(getScheduleCourseName(course)),
      String(getScheduleWeeklyHours(course)),
      groups,
      normalizeScheduleText(course?.splitGroupId || ""),
    ].join("__");
    const existing = byKey.get(key);
    if (!existing || courseRichnessScore(course) > courseRichnessScore(existing)) byKey.set(key, course);
  }

  return [...byKey.values()];
}

/**
 * Seçili sınıf veya öğretmen için dağıtılabilir ders listesini üretir.
 * Saf fonksiyondur; UI state'i değiştirmez ve test edilebilir.
 */
export function getAssignedCoursesList({
  selectedId,
  viewType,
  classrooms,
}: GetAssignedCoursesArgs): any[] {
  if (!selectedId) return [];

  if (viewType === "class") {
    const classroom = classrooms.find((item) => item.id === selectedId);
    if (!classroom) return [];

    const rawCourses = getCurrentAssignedCourses(classroom);
    const uniqueCourses: any[] = [];
    const seen = new Set<string>();

    rawCourses.forEach((course: any) => {
      if (!course) return;
      const key = createCourseIdentity(course, classroom.id);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCourses.push(course);
      }
    });

    const grouped: any[] = [];
    const handledGroups = new Set<string>();
    uniqueCourses.forEach((course: any) => {
      if (!course.splitGroupId) {
        grouped.push({ ...course, isGrouped: false, originalCourses: [course] });
        return;
      }
      if (handledGroups.has(course.splitGroupId)) return;
      handledGroups.add(course.splitGroupId);
      const groupCourses = uniqueCourses.filter(
        (item: any) => item.splitGroupId === course.splitGroupId,
      );
      grouped.push({
        ...course,
        groupName: groupCourses
          .map((item: any) => item.groupName)
          .filter(Boolean)
          .join(" + "),
        isGrouped: true,
        originalCourses: groupCourses,
      });
    });
    return grouped;
  }

  const teacherCourses: any[] = [];
  classrooms.forEach((classroom: any) => {
    getCurrentAssignedCourses(classroom).forEach((course: any) => {
      if (course.teacherId !== selectedId && course.teacherId2 !== selectedId) return;
      teacherCourses.push({
        courseName: course.courseName,
        className: classroom.name,
        weeklyHours: course.weeklyHours || 0,
        type: course.type,
        groupName: course.groupName,
        teacherName: course.teacherName || "",
        teacherName2: course.teacherName2 || "",
        teacherId: course.teacherId,
        teacherId2: course.teacherId2,
      });
    });
  });

  const uniqueTeacherCourses: any[] = [];
  const seenTeacherCourses = new Set<string>();
  teacherCourses.forEach((course) => {
    const key = createCourseIdentity(course, String(course.className || ""));
    if (!seenTeacherCourses.has(key)) {
      seenTeacherCourses.add(key);
      uniqueTeacherCourses.push(course);
    }
  });
  return uniqueTeacherCourses;
}

/**
 * Dersin kalan saatlerini, dağıtımın zorunlu blok politikasına göre ayırır.
 * Normal dersler 2+2+...+(gerekirse 1) şeklindedir. Yalnızca haftada tam
 * 12 saat olan S. İngilizce dersi 4+4+4 kullanır; diğer derslerdeki legacy
 * preferredBlocks değeri bu zorunlu kuralı değiştiremez.
 */
export type CourseBlockMode = "preferred" | "relaxed";

function parsePreferredBlocks(course: any): number[] {
  if (Array.isArray(course?.preferredBlocks)) {
    const values = course.preferredBlocks
      .map(Number)
      .filter((value: number) => Number.isInteger(value) && value > 0);
    if (values.length) return values;
  }

  const raw = String(course?.blockPattern || course?.preferredBlockPattern || "").trim();
  if (!raw) return [];

  return raw
    .split(/[+,/xX\s-]+/)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
}

function fitPatternToRemaining(pattern: number[], remainingHours: number): number[] {
  const result: number[] = [];
  let remaining = Math.max(0, Math.floor(Number(remainingHours || 0)));

  for (const rawSize of pattern) {
    if (remaining <= 0) break;
    const size = Math.max(1, Math.min(Math.floor(rawSize), remaining));
    result.push(size);
    remaining -= size;
  }

  while (remaining > 0) {
    const size = remaining >= 2 ? 2 : 1;
    result.push(size);
    remaining -= size;
  }

  return result;
}

/**
 * Dersin kalan saatlerini bloklara ayırır.
 *
 * preferred:
 * - açıkça strictBlocks/preferredBlocks varsa buna saygı duyar,
 * - aksi halde 2+2+...+(gerekirse 1) tercih edilir,
 * - 12 saatlik S. İngilizce için 4+4+4 korunur.
 *
 * relaxed:
 * - strictBlocks olmayan dersleri 1 saatlik atomlara ayırır.
 * - Bu mod yalnız tercih edilen bloklarla tam dağıtım bulunamadığında
 *   kurtarma turunda kullanılır. Günlük ders saati sınırı solver tarafından
 *   yine korunur; böylece 1+1 aynı gün yan yana gelebilir.
 */
export function buildCourseBlocks(
  courseOrName: string | any,
  remainingHours: number,
  mode: CourseBlockMode = "preferred",
): number[] {
  const total = Math.max(0, Math.floor(Number(remainingHours || 0)));
  if (total === 0) return [];

  const course = typeof courseOrName === "string" ? null : courseOrName;
  const courseName = typeof courseOrName === "string"
    ? courseOrName
    : String(courseOrName?.courseName || courseOrName?.name || "");

  const preferred = course ? parsePreferredBlocks(course) : [];
  const strictBlocks = Boolean(course?.strictBlocks);

  if (mode === "relaxed" && !strictBlocks) {
    return Array.from({ length: total }, () => 1);
  }

  if (preferred.length) {
    return fitPatternToRemaining(preferred, total);
  }

  const normalized = String(courseName || "")
    .replace(/Ä°|I|Ä±|i/g, "I")
    .replace(/Ä|ÄŸ/g, "G")
    .replace(/Ãœ|Ã¼/g, "U")
    .replace(/Å|ÅŸ/g, "S")
    .replace(/Ã–|Ã¶/g, "O")
    .replace(/Ã‡|Ã§/g, "C")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const isSpecialEnglish =
    normalized.includes("SECMELI INGILIZCE") ||
    normalized.includes("S. INGILIZCE") ||
    normalized.includes("S INGILIZCE");

  if (isSpecialEnglish && total === 12) return [4, 4, 4];

  const blocks: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const duration = remaining >= 2 ? 2 : 1;
    blocks.push(duration);
    remaining -= duration;
  }
  return blocks;
}
