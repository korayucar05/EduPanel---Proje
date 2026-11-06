import { Classroom, Teacher, Course } from "../types";
import { calculateSchedulePenalty } from "./penaltyCalculator";
import { createDiagnostic, addReason, diagnosticSummary } from "./placementDiagnostics";
import { loadConstraintSettings } from "../services/schedule/constraintDefaults";
import { createSeededRandom } from "./deterministicRandom";
import { validateSchedule } from "../services/schedule/scheduleValidator";
import { buildConflictGraph } from "../services/schedule/conflictGraph";
import { analyzeInfeasibility } from "../services/schedule/infeasibilityAnalyzer";
import type { ScheduleConstraintSettings } from "../types/scheduleConstraints";
import { evaluateConfiguredSoftPenalty } from "../services/schedule/softConstraintEvaluator";
import { createCourseIdentity, coursesConflictInSameClass, getTeacherIdentityKeys, resolveTeacherIdentityKeys, isCommonCourseForClass, getPhysicalClassIdentity, getExplicitCourseStudentIds, getCourseTargetGroups } from "../services/schedule/scheduleIdentity";
import { getScheduleDays, getScheduleHours } from "../services/schedule/scheduleRules";
import { buildCourseBlocks } from "../services/schedule/courseAssignmentService";
import { runSchedulePreflight } from "../services/schedule/schedulePreflight";
export interface SolverConfig {
  algorithm: "hybrid" | "ortools" | "backtracking" | "korayucar" | "korayucarv3" | "korayucardraft";
  mode?: "instant";
  scope: "local" | "global";
  selectedId?: string;
  viewType?: "class" | "teacher";
  constraintSettings?: Partial<ScheduleConstraintSettings>;
}

export interface SolverResult {
  unplacedBlocks?: any[];
  success: boolean;
  initialPenalty: number;
  finalPenalty: number;
  durationMs: number;
  schedule: Record<string, any>;
  details: string;
}

export interface SolverCallbacks {
  onProgress?: (
    progress: number,
    unplacedCount: number,
    unplacedDetails: any[],
    partialSchedule?: Record<string, any>,
  ) => void;
  shouldPause?: () => boolean | Promise<boolean | void>;
  shouldCancel?: () => boolean;
}

type ViewType = "class" | "teacher";

type CommonCourseMember = {
  classId: string;
  className: string;
  course: any;
};

type BlockToPlace = {
  id: string;
  course: any;
  classId: string;
  className: string;
  duration: number;
  blockId: string;
  commonCourseKey?: string;
  linkedMembers?: CommonCourseMember[];
};

type Slot = { day: string; hour: number; score?: number };

let DAYS = getScheduleDays();
let HOURS = getScheduleHours();
const EMPTY_TEACHERS = new Set(["", "Öğretmen Atanmadı", "Belirtilmedi", "undefined", "null"]);
let runtimeConstraintSettings: ScheduleConstraintSettings = loadConstraintSettings();
let runtimeRandom = createSeededRandom(runtimeConstraintSettings.seed);

const COURSE_BRANCH_ALIASES: Record<string, string[]> = {
  "TÜRK DİLİ VE EDEBİYATI": ["TÜRK DİLİ VE EDEBİYATI", "EDEBİYAT", "TÜRKÇE"],
  "MATEMATİK": ["MATEMATİK"],
  "FİZİK": ["FİZİK"],
  "KİMYA": ["KİMYA"],
  "BİYOLOJİ": ["BİYOLOJİ"],
  "TARİH": ["TARİH"],
  "COĞRAFYA": ["COĞRAFYA"],
  "FELSEFE": ["FELSEFE"],
  "DİN KÜLTÜRÜ VE AHLAK BİLGİSİ": ["DİN KÜLTÜRÜ", "DİN KÜLTÜRÜ VE AHLAK BİLGİSİ", "DKAB"],
  "İNGİLİZCE": ["İNGİLİZCE", "İNGILIZCE", "YABANCI DİL"],
  "BİRİNCİ YABANCI DİL": ["İNGİLİZCE", "YABANCI DİL"],
  "SEÇMELİ ALMANCA": ["ALMANCA"],
  "ALMANCA": ["ALMANCA"],
  "BEDEN EĞİTİMİ VE SPOR": ["BEDEN EĞİTİMİ", "BEDEN EĞİTİMİ VE SPOR"],
  "GÖRSEL SANATLAR / MÜZİK": ["GÖRSEL SANATLAR", "RESİM", "MÜZİK"],
  "GÖRSEL SANATLAR/MÜZİK": ["GÖRSEL SANATLAR", "RESİM", "MÜZİK"],
  "REHBERLİK VE YÖNLENDİRME": ["REHBERLİK", "REHBER ÖĞRETMEN"],
};

function getBranchAliases(courseName: string): string[] {
  const name = normalizeText(courseName);
  const direct = COURSE_BRANCH_ALIASES[name];
  if (direct) return direct.map(normalizeText);
  for (const [key, aliases] of Object.entries(COURSE_BRANCH_ALIASES)) {
    if (name.includes(normalizeText(key)) || normalizeText(key).includes(name)) return aliases.map(normalizeText);
  }
  return [name];
}

function inferSingleTeacherForCourse(rawCourse: any, teachers: Teacher[]): Teacher | undefined {
  const aliases = getBranchAliases(getCourseName(rawCourse));
  const activeMatches = (teachers as any[]).filter((teacher) => {
    if (teacher.status && normalizeText(teacher.status) !== "AKTİF") return false;
    const branch = normalizeText(teacher.branch || "");
    if (!branch || branch === "ÖĞRETMEN") return false;
    return aliases.some((alias) => branch.includes(alias) || alias.includes(branch));
  });
  return activeMatches.length === 1 ? activeMatches[0] as any : undefined;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function normalizeText(value: any): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR");
}

function normalizedClassIdentity(classroom: Classroom): string {
  return getPhysicalClassIdentity(classroom);
}

function commonCourseIdentity(classroom: Classroom, course: any): string {
  return `${normalizedClassIdentity(classroom)}::${normalizeText(getCourseName(course))}`;
}

function findCommonCourseMembers(
  classrooms: Classroom[],
  sourceClass: Classroom,
  rawCourse: any,
  teachers: Teacher[],
): CommonCourseMember[] {
  // GENEL/ORTAK ders fiziksel sınıfın tamamına aittir. Aynı fiziksel sınıfın
  // SAY/EA/SÖZ/DİL kopyalarında ders kaydı ayrıca tekrarlanmamış olsa bile
  // yerel "Sınıfı Dağıt" işleminde kardeş grup da aynı ortak bloğa bağlanır.
  // Grup/seçmeli dersleri ise hiçbir zaman burada birleştirilmez.
  if (!isCommonCourseForClass(rawCourse)) return [];

  const sourceKey = commonCourseIdentity(sourceClass, rawCourse);
  const sourceHours = getWeeklyHours(rawCourse);
  const physicalSiblings = (classrooms as any[]).filter(
    (candidate) => normalizedClassIdentity(candidate) === normalizedClassIdentity(sourceClass),
  );

  return physicalSiblings.map((candidate) => {
    const matchingCourse = (candidate.assignedCourses || []).find(
      (candidateCourse: any) =>
        isCommonCourseForClass(candidateCourse) &&
        commonCourseIdentity(candidate, candidateCourse) === sourceKey &&
        getWeeklyHours(candidateCourse) === sourceHours,
    );

    // Kardeş grup üzerinde ayrıca ortak ders satırı yoksa kaynak ortak dersin
    // öğretmen/saat bilgisini kullan. Böylece 11C(SAY) dağıtıldığında aynı ortak
    // ders 11C(EA) hücresine de TEK öğretmenle zorunlu olarak yazılır.
    const memberCourse = matchingCourse || rawCourse;
    return {
      classId: String(candidate.id),
      className: String(candidate.name || sourceClass.name || ""),
      course: hydrateCourse(memberCourse, teachers),
    };
  });
}

function asArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function getCourseName(course: any): string {
  return course?.courseName || course?.name || course?.subject || "Ders";
}

function getWeeklyHours(course: any): number {
  if (typeof course?.weeklyHours === "number") return course.weeklyHours;
  const schedule = String(course?.schedule || "");
  const match = schedule.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isMeaningfulTeacher(name: any): boolean {
  return !EMPTY_TEACHERS.has(String(name || "").trim());
}

function getTeacherByName(teachers: Teacher[], name: string): Teacher | undefined {
  const key = normalizeText(name);
  return teachers.find((t: any) => normalizeText(t.name) === key);
}

function getTeacherById(teachers: Teacher[], id: string): Teacher | undefined {
  return teachers.find((t: any) => String(t.id) === String(id));
}

function hydrateCourse(rawCourse: any, teachers: Teacher[]): any {
  const course = { ...rawCourse };
  course.courseName = getCourseName(course);
  course.weeklyHours = getWeeklyHours(course);
  course.type = course.type || course.courseType || "";
  course.groupName = course.groupName || "";

  if (!isMeaningfulTeacher(course.teacherName) && course.teacherId) {
    const teacher = getTeacherById(teachers, course.teacherId);
    if (teacher) course.teacherName = (teacher as any).name;
  }
  if (!isMeaningfulTeacher(course.teacherName2) && course.teacherId2) {
    const teacher = getTeacherById(teachers, course.teacherId2);
    if (teacher) course.teacherName2 = (teacher as any).name;
  }

  // Verilerde öğretmen adı boş bırakılmışsa, branşı tekil olarak eşleşen aktif öğretmeni otomatik bağla.
  // Birden fazla aday varsa bilinçli şekilde boş bırakılır; yanlış atama yapmaz.
  if (runtimeConstraintSettings.allowTeacherAutoInference && !isMeaningfulTeacher(course.teacherName)) {
    const inferred = inferSingleTeacherForCourse(course, teachers) as any;
    if (inferred) {
      course.teacherId = inferred.id;
      course.teacherName = inferred.name;
      course.__autoTeacherInferred = true;
    }
  }
  return course;
}

function groupOverlaps(a: any, b: any): boolean {
  return coursesConflictInSameClass(a, b);
}

function getCourseStudentAudience(
  course: any,
  classId: string,
  classrooms: Classroom[],
): string[] {
  const explicit = getExplicitCourseStudentIds(course);
  if (explicit.length) return explicit;

  const classroom: any = (classrooms as any[]).find((item) => String(item?.id) === String(classId));
  const groupMap = classroom?.groupStudentIds;
  if (!groupMap || Array.isArray(groupMap) || typeof groupMap !== "object") return [];

  const groups = getCourseTargetGroups(course);
  if (groups.length) {
    const result = new Set<string>();
    for (const group of groups) {
      const normalizedGroup = normalizeText(group);
      for (const [key, ids] of Object.entries(groupMap)) {
        if (normalizeText(key) !== normalizedGroup || !Array.isArray(ids)) continue;
        for (const id of ids) {
          const value = String(id ?? "").trim();
          if (value) result.add(value);
        }
      }
    }
    return [...result];
  }

  if (isCommonCourseForClass(course)) {
    const result = new Set<string>();
    for (const ids of Object.values(groupMap)) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        const value = String(id ?? "").trim();
        if (value) result.add(value);
      }
    }
    return [...result];
  }

  return [];
}

function hasStudentConflictAtSlot(
  course: any,
  classId: string,
  day: string,
  hour: number,
  schedule: Record<string, any>,
  classrooms: Classroom[],
): boolean {
  const incoming = getCourseStudentAudience(course, classId, classrooms);
  if (!incoming.length) return false;
  const incomingSet = new Set(incoming);

  for (const classroom of classrooms as any[]) {
    const existingItems = asArray(schedule[`class_${classroom.id}_${day}_${hour}`]);
    for (const existing of existingItems) {
      const existingStudents = getCourseStudentAudience(existing, String(classroom.id), classrooms);
      if (!existingStudents.length) continue;
      if (existingStudents.some((studentId) => incomingSet.has(studentId))) return true;
    }
  }

  return false;
}

function getTeacherNames(course: any): string[] {
  return [course?.teacherName, course?.teacherName2]
    .filter(isMeaningfulTeacher)
    .map((x) => String(x).trim());
}

function findClassName(classrooms: Classroom[], classId: string): string {
  return (classrooms.find((c: any) => c.id === classId) as any)?.name || "";
}

function findClassIdByName(classrooms: Classroom[], className: string): string {
  const key = normalizeText(className);
  return ((classrooms.find((c: any) => normalizeText(c.name) === key) as any)?.id || "") as string;
}

function courseIdentity(course: any, classId = ""): string {
  return createCourseIdentity(course, classId);
}

function cellHasCourse(value: any, course: any, classId = ""): boolean {
  const target = courseIdentity(course, classId);
  return asArray(value).some((v) => courseIdentity(v, classId) === target);
}

function getPlacedHoursForCourse(
  classId: string,
  course: any,
  schedule: Record<string, any>
): number {
  let count = 0;
  for (const day of DAYS) {
    for (const hour of HOURS) {
      if (cellHasCourse(schedule[`class_${classId}_${day}_${hour}`], course, classId)) count++;
    }
  }
  return count;
}

function getDailyCourseHours(
  classId: string,
  course: any,
  day: string,
  schedule: Record<string, any>
): number {
  let count = 0;
  for (const hour of HOURS) {
    if (cellHasCourse(schedule[`class_${classId}_${day}_${hour}`], course, classId)) count++;
  }
  return count;
}

function hasCourseOnDay(classId: string, course: any, day: string, schedule: Record<string, any>): boolean {
  return getDailyCourseHours(classId, course, day, schedule) > 0;
}

function getMaxDailyCourseHours(course: any): number {
  const explicit = Number(course?.maxDailyHours);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);

  const name = normalizeText(getCourseName(course));
  if (
    (name.includes("SEÇMELİ İNGİLİZCE") || name.includes("S. İNGİLİZCE")) &&
    getWeeklyHours(course) === 12
  ) {
    return Math.max(1, Number(runtimeConstraintSettings.electiveEnglishMaxDailyHours) || 4);
  }

  return Math.max(1, Number(runtimeConstraintSettings.maxDailyCourseHours) || 2);
}

function isGuidanceCourse(course: any): boolean {
  const name = normalizeText(getCourseName(course));
  return name === "REHBERLİK" || name === "REHBERLİK VE YÖNLENDİRME";
}

function teacherHasDifferentCourseInClassOnDay(
  classId: string,
  course: any,
  day: string,
  schedule: Record<string, any>,
  teachers: Teacher[],
): boolean {
  // Rehberlik, haftalık tek saatlik yönlendirme dersi olduğundan bu gün
  // ayrıştırma kuralının istisnasıdır. Hem kendisi hem de diğer dersler için
  // aynı gün karşı ders sayılmaz.
  if (isGuidanceCourse(course)) return false;
  const courseKey = courseIdentity(course, classId);
  const teacherKeys = new Set(getCourseTeacherKeys(course, teachers));
  if (!teacherKeys.size) return false;

  return HOURS.some((hour) => asArray(schedule[`class_${classId}_${day}_${hour}`]).some((existing) =>
    courseIdentity(existing, classId) !== courseKey &&
    !isGuidanceCourse(existing) &&
    getCourseTeacherKeys(existing, teachers).some((teacherKey) => teacherKeys.has(teacherKey)),
  ));
}

function isTeacherBusyByIdentity(
  teacherKey: string,
  day: string,
  hour: number,
  excludeClassId: string | undefined,
  schedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
): boolean {
  if (!teacherKey) return false;
  if (teacherKey.startsWith("ID:")) {
    const teacherId = teacherKey.slice(3);
    const values = asArray(schedule[`teacher_${teacherId}_${day}_${hour}`]);
    if (values.some((item) => !excludeClassId || findClassIdByName(classrooms, item.className) !== excludeClassId)) return true;
  }

  for (const cls of classrooms as any[]) {
    if (excludeClassId && String(cls.id) === String(excludeClassId)) continue;
    for (const value of asArray(schedule[`class_${cls.id}_${day}_${hour}`])) {
      if (resolveTeacherIdentityKeys(value, teachers).includes(teacherKey)) return true;
    }
  }
  return false;
}

function getCourseTeacherKeys(course: any, teachers: Teacher[]): string[] {
  return resolveTeacherIdentityKeys(course, teachers);
}

/**
 * Kilit, var olan bir yerleşimi korur. Eski kayıtlarda boş hücre için kalmış
 * `locked_*` işaretleri de bulunabiliyor; bunlar UI'da kilit görünmediği halde
 * otomatik çözücünün o saati reddetmesine neden oluyordu. Boş bir hücrede
 * korunacak ders olmadığı için bu işaret dağıtım kısıtı değildir.
 */
function hasLockedAssignment(
  schedule: Record<string, any>,
  entityKey: string,
): boolean {
  return asArray(schedule[entityKey]).some((item) => item?.isLocked);
}

function canPlaceBlock(
  block: BlockToPlace,
  slot: Slot,
  schedule: Record<string, any>,
  teachers: Teacher[],
  classrooms: Classroom[],
  unwantedTeacherDays: Record<string, string[]>
): boolean {
  if (slot.hour + block.duration - 1 > HOURS.length) return false;

  const members: CommonCourseMember[] =
    block.linkedMembers?.length
      ? block.linkedMembers
      : [{ classId: block.classId, className: block.className, course: block.course }];

  // splitGroupId ile aynı sınıfta eş zamanlı yürüyen farklı derslerde aynı
  // öğretmen iki farklı dersi aynı anda veremez. Ortak dersin fiziksel sınıf
  // kopyalarında aynı öğretmenin tekrar etmesi ise bilinçli olduğundan hariçtir.
  if (block.linkedMembers?.length && !block.commonCourseKey) {
    const seenTeacherKeys=new Set<string>();
    for (const member of members) {
      for (const teacherKey of getCourseTeacherKeys(member.course, teachers)) {
        if (seenTeacherKeys.has(teacherKey)) return false;
        seenTeacherKeys.add(teacherKey);
      }
    }
  }

  for (const member of members) {
    const { course, classId } = member;
    // Dersin aynı gün birden fazla bloğa sahip olması artık mutlak yasak değil.
    // Özellikle kurtarma modunda 1+1 saat aynı güne gelebilir. Tek kesin sınır,
    // dersin günlük azami saatidir; bloklu yerleşim kalite puanıyla tercih edilir.
    if (
      getDailyCourseHours(classId, course, slot.day, schedule) + block.duration >
      getMaxDailyCourseHours(course)
    ) return false;

    for (let offset = 0; offset < block.duration; offset++) {
      const hour = slot.hour + offset;
      if (runtimeConstraintSettings.blockedSlotsHard && schedule[`blocked_class_${classId}_${slot.day}_${hour}`]) return false;
      if (hasLockedAssignment(schedule, `class_${classId}_${slot.day}_${hour}`)) return false;

      const classItems = asArray(schedule[`class_${classId}_${slot.day}_${hour}`]);
      if (classItems.some((existing) => groupOverlaps(course, existing))) return false;

      // Öğrenci bazlı atamalarda sınıf adı/grup etiketi farklı olsa bile aynı
      // öğrenci iki derse aynı anda yerleştirilemez.
      if (hasStudentConflictAtSlot(course, classId, slot.day, hour, schedule, classrooms)) return false;

      for (const teacherKey of getCourseTeacherKeys(course, teachers)) {
        const teacherId = teacherKey.startsWith("ID:") ? teacherKey.slice(3) : "";
        if (teacherId) {
          if (runtimeConstraintSettings.blockedSlotsHard && schedule[`blocked_teacher_${teacherId}_${slot.day}_${hour}`]) return false;
          if (hasLockedAssignment(schedule, `teacher_${teacherId}_${slot.day}_${hour}`)) return false;
          if (runtimeConstraintSettings.unwantedTeacherDayHard && (unwantedTeacherDays[teacherId] || []).includes(slot.day)) return false;
        }
        if (isTeacherBusyByIdentity(teacherKey, slot.day, hour, undefined, schedule, classrooms, teachers)) return false;
      }
    }
  }
  return true;
}

function diagnoseBlockPlacement(
  block: BlockToPlace,
  schedule: Record<string, any>,
  teachers: Teacher[],
  classrooms: Classroom[],
  unwantedTeacherDays: Record<string, string[]>
): string {
  const diag = createDiagnostic();

  for (const day of DAYS) {
    for (let hour = 1; hour <= HOURS.length - block.duration + 1; hour++) {
      const slot = { day, hour };

      if (slot.hour + block.duration - 1 > HOURS.length) {
        addReason(diag, "Ders günü sonuna sığmıyor");
        continue;
      }

      if (getDailyCourseHours(block.classId, block.course, slot.day, schedule) + block.duration > getMaxDailyCourseHours(block.course)) {
        addReason(diag, "Aynı gün ders saati sınırı aşılıyor");
        continue;
      }

      for (let offset = 0; offset < block.duration; offset++) {
        const h = slot.hour + offset;

        if (schedule[`blocked_class_${block.classId}_${slot.day}_${h}`]) {
          addReason(diag, "Sınıf bu saatte kapalı");
          continue;
        }

        const classItems = asArray(schedule[`class_${block.classId}_${slot.day}_${h}`]);
        if (classItems.some((existing) => groupOverlaps(block.course, existing))) {
          addReason(diag, "Sınıfta aynı saate çakışan ders/grup var");
          continue;
        }

        for (const teacherKey of getCourseTeacherKeys(block.course, teachers)) {
          const teacherId = teacherKey.startsWith("ID:") ? teacherKey.slice(3) : "";

          if (teacherId && schedule[`blocked_teacher_${teacherId}_${slot.day}_${h}`]) {
            addReason(diag, "Öğretmen bu saatte kapalı");
            continue;
          }

          if (isTeacherBusyByIdentity(teacherKey, slot.day, h, block.classId, schedule, classrooms, teachers)) {
            addReason(diag, "Öğretmen başka sınıfta derste");
            continue;
          }
        }
      }
    }
  }

  return diagnosticSummary(diag) || "Belirgin sebep bulunamadı";
}

function writeAssignment(
  schedule: Record<string, any>,
  block: BlockToPlace,
  slot: Slot,
  teachers: Teacher[]
) {
  const members: CommonCourseMember[] =
    block.linkedMembers?.length
      ? block.linkedMembers
      : [{ classId: block.classId, className: block.className, course: block.course }];

  for (const member of members) {
    const payload = {
      courseName: getCourseName(member.course),
      teacherId: member.course.teacherId || "",
      teacherName: member.course.teacherName || "",
      teacherId2: member.course.teacherId2 || "",
      teacherName2: member.course.teacherName2 || "",
      weeklyHours: getWeeklyHours(member.course),
      splitGroupId: member.course.splitGroupId || "",
      targetGroups: member.course.targetGroups || [],
      studentIds: getExplicitCourseStudentIds(member.course),
      className: member.className,
      type: member.course.type || "",
      groupName: member.course.groupName || "",
      blockId: block.blockId,
      isManual: false,
      isCommonCourse: Boolean(block.commonCourseKey),
      commonCourseKey: block.commonCourseKey || "",
    };

    for (let offset = 0; offset < block.duration; offset++) {
      const hour = slot.hour + offset;
      const classKey = `class_${member.classId}_${slot.day}_${hour}`;
      schedule[classKey] = [...asArray(schedule[classKey]), payload];

      const teacherPairs = [
        [payload.teacherId, payload.teacherName],
        [payload.teacherId2, payload.teacherName2],
      ];
      for (const [teacherId, teacherName] of teacherPairs) {
        const teacher = teacherId
          ? getTeacherById(teachers, String(teacherId))
          : getTeacherByName(teachers, String(teacherName || ""));
        if (!teacher) continue;
        const teacherKey = `teacher_${(teacher as any).id}_${slot.day}_${hour}`;
        const teacherArr = asArray(schedule[teacherKey]);
        const duplicateCommon =
          Boolean(block.commonCourseKey) &&
          teacherArr.some(
            (item) =>
              item?.commonCourseKey === block.commonCourseKey &&
              normalizeText(item?.courseName) === normalizeText(payload.courseName),
          );
        if (!duplicateCommon) schedule[teacherKey] = [...teacherArr, payload];
      }
    }
  }
}

function removeBlock(schedule: Record<string, any>, blockId: string) {
  for (const key of Object.keys(schedule)) {
    if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
    const values = asArray(schedule[key]);
    const kept = values.filter((v) => v?.blockId !== blockId);
    if (kept.length > 0) schedule[key] = kept;
    else delete schedule[key];
  }
}

function clearAssignments(
  schedule: Record<string, any>,
  scope: "local" | "global",
  selectedId: string | undefined,
  viewType: ViewType | undefined,
  teachers: Teacher[],
  classrooms: Classroom[]
) {
  const selectedTeacher = selectedId ? (getTeacherById(teachers, selectedId) as any) : undefined;
  const selectedClass = selectedId ? (classrooms.find((c: any) => c.id === selectedId) as any) : undefined;
  const selectedTeacherCourseIdentities = new Map<string, Set<string>>();

  // Eski program kayıtlarında öğretmen kimliği hiç yazılmamış veya sonradan
  // değişmiş olabilir. Öğretmen dağıtımında yalnız isim/ID aynasına güvenmek,
  // bu kayıtları "yerleşmiş" sayıp seçili öğretmenin planını boş bırakıyordu.
  // Kaynak ders atamasından türetilen kimlik, hangi otomatik derslerin yeniden
  // dağıtılacağını kesin olarak belirler.
  if (scope === "local" && viewType === "teacher" && selectedId) {
    const selectedTeacherKey = `ID:${String(selectedId)}`;
    const selectedTeacherName = normalizeText(selectedTeacher?.name);
    for (const classroom of classrooms as any[]) {
      const identities = new Set<string>();
      for (const rawCourse of classroom.assignedCourses || []) {
        const course = hydrateCourse(rawCourse, teachers);
        const belongsToSelectedTeacher =
          getCourseTeacherKeys(course, teachers).includes(selectedTeacherKey) ||
          normalizeText(course.teacherName) === selectedTeacherName ||
          normalizeText(course.teacherName2) === selectedTeacherName;
        if (belongsToSelectedTeacher) identities.add(courseIdentity(course, String(classroom.id)));
      }
      if (identities.size) selectedTeacherCourseIdentities.set(String(classroom.id), identities);
    }
  }

  for (const key of Object.keys(schedule)) {
    if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
    const kept = asArray(schedule[key]).filter((item) => {
      if (item?.isManual || item?.isLocked) return true;
      if (scope === "global" || !selectedId || !viewType) return false;
      if (viewType === "class") {
        // Yerel sınıf dağıtımında otomatik ORTAK dersleri korumak eski/yarım
        // dağıtımı kilitliyordu: ders seçili grup hücresinde kalırken kardeş
        // grupta eksik olabiliyordu. Manuel/kilitli kayıtlar yukarıda zaten
        // korunuyor. Otomatik ortak kayıtları aynı fiziksel sınıfın bütün grup
        // kopyalarından temizleyip solver'ın linkedMembers ile TEK blok halinde
        // iki gruba da yeniden yazmasına izin veriyoruz.
        const samePhysicalClass =
          getPhysicalClassIdentity(item?.className || "") === getPhysicalClassIdentity(selectedClass || "");
        const belongsToSelectedClass =
          key.startsWith(`class_${selectedId}_`) || samePhysicalClass;
        return !belongsToSelectedClass;
      }
      const classIdFromKey = key.startsWith("class_")
        ? key.slice("class_".length).split("_")[0]
        : String(item?.classId || findClassIdByName(classrooms, item?.className || ""));
      const isSelectedTeacherCourse = selectedTeacherCourseIdentities
        .get(classIdFromKey)
        ?.has(courseIdentity(item, classIdFromKey));
      if (isSelectedTeacherCourse) return false;
      const belongsToSelectedTeacher =
        key.startsWith(`teacher_${selectedId}_`) ||
        resolveTeacherIdentityKeys(item, teachers).includes(`ID:${String(selectedId)}`) ||
        normalizeText(item?.teacherName) === normalizeText(selectedTeacher?.name) ||
        normalizeText(item?.teacherName2) === normalizeText(selectedTeacher?.name);
      return !belongsToSelectedTeacher;
    });
    if (kept.length > 0) schedule[key] = kept;
    else delete schedule[key];
  }
}

function buildBlocks(
  schedule: Record<string, any>,
  config: SolverConfig,
  classrooms: Classroom[],
  teachers: Teacher[],
  blockMode: "preferred" | "relaxed" = "preferred",
): BlockToPlace[] {
  const blocks: BlockToPlace[] = [];
  const emittedCommon = new Set<string>();
  const emittedSplit = new Set<string>();

  const targetClassIds = new Set<string>();
  let selectedTeacherKey = "";
  let selectedTeacherName = "";
  if (config.scope === "local" && config.selectedId && config.viewType === "class") {
    targetClassIds.add(String(config.selectedId));
  } else if (config.scope === "local" && config.selectedId && config.viewType === "teacher") {
    const teacher = getTeacherById(teachers, config.selectedId) as any;
    selectedTeacherName = normalizeText(teacher?.name);
    selectedTeacherKey = `ID:${String(config.selectedId)}`;
    for (const cls of classrooms as any[]) {
      for (const course of cls.assignedCourses || []) {
        const hydrated = hydrateCourse(course, teachers);
        if (
          getCourseTeacherKeys(hydrated, teachers).includes(selectedTeacherKey) ||
          normalizeText(hydrated.teacherName) === selectedTeacherName ||
          normalizeText(hydrated.teacherName2) === selectedTeacherName
        ) targetClassIds.add(String(cls.id));
      }
    }
  } else {
    for (const cls of classrooms as any[]) targetClassIds.add(String(cls.id));
  }

  const addSingle = (rawCourse: any, cls: Classroom) => {
    const course = hydrateCourse(rawCourse, teachers);
    const weeklyHours = getWeeklyHours(course);
    if (weeklyHours <= 0) return;
    const remaining = weeklyHours - getPlacedHoursForCourse(String(cls.id), course, schedule);
    if (remaining <= 0) return;

    buildCourseBlocks(course, remaining, blockMode).forEach((duration, part) => {
      blocks.push({
        id: `${cls.id}_${courseIdentity(course, String(cls.id))}_${part}`,
        course,
        classId: String(cls.id),
        className: String(cls.name || ""),
        duration,
        blockId: `auto_${Date.now()}_${part}_${runtimeRandom().toString(36).slice(2, 8)}`,
      });
    });
  };

  const addCommon = (rawCourse: any, cls: Classroom, members: CommonCourseMember[]) => {
    const commonKey = commonCourseIdentity(cls, rawCourse);
    if (emittedCommon.has(commonKey)) return;

    const uniqueIds = new Set(members.map((m) => m.classId));
    if (uniqueIds.size < 2) {
      addSingle(rawCourse, cls);
      return;
    }

    const remainingValues = members.map((m) =>
      Math.max(0, getWeeklyHours(m.course) - getPlacedHoursForCourse(m.classId, m.course, schedule)),
    );
    const remaining = Math.max(...remainingValues);
    if (remaining <= 0) {
      emittedCommon.add(commonKey);
      return;
    }

    const master = members[0];
    buildCourseBlocks(master.course, remaining, blockMode).forEach((duration, part) => {
      blocks.push({
        id: `COMMON_${commonKey}_${part}`,
        course: master.course,
        classId: master.classId,
        className: master.className,
        duration,
        blockId: `common_${Date.now()}_${part}_${runtimeRandom().toString(36).slice(2, 8)}`,
        commonCourseKey: commonKey,
        linkedMembers: members,
      });
    });
    emittedCommon.add(commonKey);
  };

  const addSplit = (rawCourse: any, cls: Classroom) => {
    const splitId = String(rawCourse?.splitGroupId || "").trim();
    if (!splitId) { addSingle(rawCourse, cls); return; }
    const splitKey = `${String(cls.id)}::${splitId}`;
    if (emittedSplit.has(splitKey)) return;

    const members: CommonCourseMember[] = (cls.assignedCourses || [])
      .filter((candidate: any) => String(candidate?.splitGroupId || "").trim() === splitId)
      .map((candidate: any) => ({
        classId: String(cls.id),
        className: String(cls.name || ""),
        course: hydrateCourse(candidate, teachers),
      }));

    if (members.length < 2) {
      addSingle(rawCourse, cls);
      emittedSplit.add(splitKey);
      return;
    }

    const remainingValues = members.map((member) =>
      Math.max(0, getWeeklyHours(member.course) - getPlacedHoursForCourse(member.classId, member.course, schedule)),
    );
    const remaining = Math.max(...remainingValues);
    if (remaining <= 0) { emittedSplit.add(splitKey); return; }

    const master = members[0];
    buildCourseBlocks(master.course, remaining, blockMode).forEach((duration, part) => {
      blocks.push({
        id: `SPLIT_${splitKey}_${part}`,
        course: master.course,
        classId: master.classId,
        className: master.className,
        duration,
        blockId: `split_${Date.now()}_${part}_${runtimeRandom().toString(36).slice(2, 8)}`,
        linkedMembers: members,
      });
    });
    emittedSplit.add(splitKey);
  };

  for (const cls of classrooms as any[]) {
    if (!targetClassIds.has(String(cls.id))) continue;
    const seenCourseIdentities = new Set<string>();
    for (const rawCourse of cls.assignedCourses || []) {
      if (selectedTeacherKey) {
        const course = hydrateCourse(rawCourse, teachers);
        const belongsToSelectedTeacher =
          getCourseTeacherKeys(course, teachers).includes(selectedTeacherKey) ||
          normalizeText(course.teacherName) === selectedTeacherName ||
          normalizeText(course.teacherName2) === selectedTeacherName;
        if (!belongsToSelectedTeacher) continue;
      }
      const hydratedForIdentity = hydrateCourse(rawCourse, teachers);
      const duplicateKey = courseIdentity(hydratedForIdentity, String(cls.id));
      if (seenCourseIdentities.has(duplicateKey)) continue;
      seenCourseIdentities.add(duplicateKey);
      if (String((rawCourse as any)?.splitGroupId || "").trim()) {
        addSplit(rawCourse, cls);
        continue;
      }
      const members = findCommonCourseMembers(classrooms, cls, rawCourse, teachers);
      if (new Set(members.map((m) => m.classId)).size >= 2) addCommon(rawCourse, cls, members);
      else addSingle(rawCourse, cls);
    }
  }

  return blocks;
}

function possibleSlotsForBlock(
  block: BlockToPlace,
  schedule: Record<string, any>,
  teachers: Teacher[],
  classrooms: Classroom[],
  unwantedTeacherDays: Record<string, string[]>
): Slot[] {
  const slots: Slot[] = [];
  for (const day of DAYS) {
    for (let hour = 1; hour <= HOURS.length - block.duration + 1; hour++) {
      const slot = { day, hour };
      if (canPlaceBlock(block, slot, schedule, teachers, classrooms, unwantedTeacherDays)) slots.push(slot);
    }
  }
  return slots;
}

async function possibleSlotsForBlockResponsive(
  block: BlockToPlace,
  schedule: Record<string, any>,
  teachers: Teacher[],
  classrooms: Classroom[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks
): Promise<Slot[]> {
  const slots: Slot[] = [];
  let checked = 0;

  for (const day of DAYS) {
    for (let hour = 1; hour <= HOURS.length - block.duration + 1; hour++) {
      if (callbacks?.shouldCancel?.()) return slots;

      const slot = { day, hour };
      if (canPlaceBlock(block, slot, schedule, teachers, classrooms, unwantedTeacherDays)) {
        slots.push(slot);
      }

      checked++;
      // En ağır nokta burasıdır. Sık aralıklarla tarayıcıya nefes vermezsek
      // Durdur / Devam / İptal düğmeleri tıklansa bile geç cevap verir.
      if (checked % 4 === 0) {
        await yieldToUi(callbacks);
      }
    }
  }

  return slots;
}

function scoreSlot(
  block: BlockToPlace,
  slot: Slot,
  schedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>
): number {
  const sandbox = clone(schedule);
  writeAssignment(sandbox, block, slot, teachers);

  // Dynamic penalty: global penalty plus compactness and spread heuristics.
  let score = calculateSchedulePenalty(sandbox, classrooms, teachers, unwantedTeacherDays).totalPenalty;

  // Prefer not always using the same hour for the same course in a class.
  for (const day of DAYS) {
    if (day !== slot.day && cellHasCourse(sandbox[`class_${block.classId}_${day}_${slot.hour}`], block.course, block.classId)) score += 20;
  }

  // Prefer compact day shapes and avoid unnecessary last-hour usage.
  const dayLessons = HOURS.filter((h) => asArray(sandbox[`class_${block.classId}_${slot.day}_${h}`]).length > 0);
  if (dayLessons.length > 0) {
    const first = Math.min(...dayLessons);
    const last = Math.max(...dayLessons);
    const gaps = HOURS.slice(first - 1, last).filter((h) => asArray(sandbox[`class_${block.classId}_${slot.day}_${h}`]).length === 0).length;
    // Boşluk cezası kapalı: dağıtımı tamamlamak önceliklidir.
    score += gaps * 0;
  }
  // Atomik kurtarma turunda 1 saatlik parçalar kullanılsa bile aynı dersin
  // saatlerini mümkün olduğunca yan yana tut. Bu bir soft tercihtir; tam
  // dağıtımı engellemez.
  if (block.duration === 1) {
    const previous = slot.hour > 1
      ? asArray(sandbox[`class_${block.classId}_${slot.day}_${slot.hour - 1}`])
      : [];
    const next = slot.hour < HOURS.length
      ? asArray(sandbox[`class_${block.classId}_${slot.day}_${slot.hour + 1}`])
      : [];
    const adjacentSameCourse = [...previous, ...next].some((item) =>
      courseIdentity(item, block.classId) === courseIdentity(block.course, block.classId),
    );
    if (adjacentSameCourse) score -= 80;
  }

  const teacherIds = getCourseTeacherKeys(block.course, teachers)
    .filter((key) => key.startsWith("ID:"))
    .map((key) => key.slice(3));
  score += evaluateConfiguredSoftPenalty(
    sandbox,
    block.classId,
    slot.day,
    teacherIds,
    unwantedTeacherDays,
    runtimeConstraintSettings,
  );
  return score;
}

async function yieldToUi(callbacks?: SolverCallbacks) {
  while (callbacks?.shouldPause && (await callbacks.shouldPause())) {
    if (callbacks?.shouldCancel?.()) break;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  // 0 ms yerine küçük bir bekleme kullanıyoruz; tarayıcı tıklama olaylarını daha güvenilir işler.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function shuffleBlocks<T>(blocks: T[]): T[] {
  const shuffled = blocks.slice();
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(runtimeRandom() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function fastGreedySeed(
  baseSchedule: Record<string, any>,
  blocks: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
) {
  const schedule = clone(baseSchedule);
  const remaining: BlockToPlace[] = [];

  // Ders türü, süresi veya öğretmeni bir öncelik oluşturmaz. Bu tur yalnızca
  // geçici aday üretir; tam çözüm bulunmadıkça sonuç takvime uygulanmaz.
  const ordered = shuffleBlocks(blocks);

  const classDayLoad = (classId: string, day: string) =>
    HOURS.reduce((sum, hour) => sum + (asArray(schedule[`class_${classId}_${day}_${hour}`]).length ? 1 : 0), 0);

  for (let index = 0; index < ordered.length; index++) {
    if (callbacks?.shouldCancel?.()) {
      remaining.push(...ordered.slice(index));
      break;
    }

    const block = ordered[index];
    const slots = await possibleSlotsForBlockResponsive(
      block,
      schedule,
      teachers,
      classrooms,
      unwantedTeacherDays,
      callbacks,
    );

    if (!slots.length) {
      remaining.push(block);
    } else {
      // Ağır global penalty hesabı yerine hızlı, deterministik slot skoru.
      slots.sort((a, b) => {
        const aLoad = classDayLoad(block.classId, a.day);
        const bLoad = classDayLoad(block.classId, b.day);
        const aLate = a.hour + block.duration - 1 >= HOURS.length ? 2 : 0;
        const bLate = b.hour + block.duration - 1 >= HOURS.length ? 2 : 0;
        return aLoad - bLoad || aLate - bLate || a.hour - b.hour || DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      });
      writeAssignment(schedule, block, slots[0], teachers);
    }

    if (index === 0 || index % 4 === 0 || index === ordered.length - 1) {
      const processed = index + 1;
      const notYetProcessed = ordered.length - processed;
      const currentRemaining = remaining.length + notYetProcessed;
      const progress = Math.min(35, 5 + Math.round((processed / Math.max(1, ordered.length)) * 30));
      callbacks?.onProgress?.(
        progress,
        currentRemaining,
        [...remaining, ...ordered.slice(processed)],
        schedule,
      );
      await yieldToUi(callbacks);
    }
  }

  return {
    bestSchedule: schedule,
    bestUnplaced: remaining,
    bestPlaced: blocks.length - remaining.length,
    bestPenalty: calculateSchedulePenalty(schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty,
    explored: blocks.length,
  };
}

async function robustBeamSearch(
  baseSchedule: Record<string, any>,
  blocks: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
  options?: { timeLimitMs?: number; restarts?: number; beamWidth?: number }
) {
  const started = Date.now();
  const timeLimitMs = options?.timeLimitMs ?? (blocks.length > 120 ? 9000 : 7000);
  const restarts = options?.restarts ?? (blocks.length > 120 ? 4 : 5);
  const beamWidth = options?.beamWidth ?? (blocks.length > 120 ? 6 : 8);

  let bestSchedule = clone(baseSchedule);
  let bestPlaced = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestUnplaced = blocks;
  let explored = 0;

  const evaluateCandidate = (sched: Record<string, any>, placed: number, unplaced: BlockToPlace[]) => {
    const penalty = calculateSchedulePenalty(sched, classrooms, teachers, unwantedTeacherDays).totalPenalty;
    const hardMiss = unplaced.length * 100000;
    return hardMiss + penalty - placed * 10;
  };

  for (let restart = 0; restart < restarts; restart++) {
    if (callbacks?.shouldCancel?.()) break;
    if (Date.now() - started > timeLimitMs) break;

    let beam = [{ schedule: clone(baseSchedule), remaining: clone(blocks), placed: 0, score: 0 }];

    while (beam.length > 0) {
      if (callbacks?.shouldCancel?.()) break;
      if (Date.now() - started > timeLimitMs) break;
      explored++;

      const nextBeam: typeof beam = [];

      for (const state of beam) {
        if (state.remaining.length === 0) {
          const penalty = calculateSchedulePenalty(state.schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
          if (state.placed > bestPlaced || (state.placed === bestPlaced && penalty < bestPenalty)) {
            bestSchedule = clone(state.schedule);
            bestPlaced = state.placed;
            bestPenalty = penalty;
            bestUnplaced = [];
          }
          continue;
        }

        // MRV: always place the block with the fewest legal positions first.
        // ÖNEMLİ: Bu bölüm ağır çalıştığı için sık sık UI'a nefes veriyoruz.
        // Böylece Durdur / Devam Et / İptal Et tıklamaları tarayıcı tarafından işlenebilir.
        const withSlots: { block: BlockToPlace; slots: Slot[] }[] = [];
        for (let blockIndex = 0; blockIndex < state.remaining.length; blockIndex++) {
          if (callbacks?.shouldCancel?.()) break;
          if (blockIndex % 2 === 0) await yieldToUi(callbacks);
          const block = state.remaining[blockIndex];
          withSlots.push({
            block,
            slots: await possibleSlotsForBlockResponsive(block, state.schedule, teachers, classrooms, unwantedTeacherDays, callbacks),
          });
        }
        if (callbacks?.shouldCancel?.()) break;
        withSlots.sort((a, b) => {
          const aTeacherCount = getCourseTeacherKeys(a.block.course, teachers).length;
          const bTeacherCount = getCourseTeacherKeys(b.block.course, teachers).length;
          return a.slots.length - b.slots.length || b.block.duration - a.block.duration || bTeacherCount - aTeacherCount;
        });

        const selected = withSlots[0];
        const rest = state.remaining.filter((b) => b.id !== selected.block.id);

        if (selected.slots.length === 0) {
          const penalty = calculateSchedulePenalty(state.schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
          const candidateUnplaced = [selected.block, ...rest];
          if (state.placed > bestPlaced || (state.placed === bestPlaced && penalty < bestPenalty)) {
            bestSchedule = clone(state.schedule);
            bestPlaced = state.placed;
            bestPenalty = penalty;
            bestUnplaced = candidateUnplaced;
          }
          continue;
        }

        // LCV: try the slots that damage the total score the least.
        // scoreSlot çok maliyetli olabilir; bu yüzden skorlamayı parçalara bölüyoruz.
        const scoredSlots: Slot[] = [];
        const slotsToScore = selected.slots.slice(0, 12);
        for (let slotIndex = 0; slotIndex < slotsToScore.length; slotIndex++) {
          if (callbacks?.shouldCancel?.()) break;
          if (slotIndex % 2 === 0) await yieldToUi(callbacks);
          const slot = slotsToScore[slotIndex];
          scoredSlots.push({
            ...slot,
            score: scoreSlot(selected.block, slot, state.schedule, classrooms, teachers, unwantedTeacherDays) + runtimeRandom() * (restart + 1),
          });
        }
        scoredSlots.sort((a, b) => (a.score || 0) - (b.score || 0));
        const selectedScoredSlots = scoredSlots.slice(0, Math.max(4, Math.floor(beamWidth / 2)));

        for (const slot of selectedScoredSlots) {
          if (callbacks?.shouldCancel?.()) break;
          const nextSchedule = clone(state.schedule);
          writeAssignment(nextSchedule, selected.block, slot, teachers);
          const nextPlaced = state.placed + 1;
          const nextUnplaced = rest;
          const nextScore = evaluateCandidate(nextSchedule, nextPlaced, nextUnplaced);
          nextBeam.push({ schedule: nextSchedule, remaining: nextUnplaced, placed: nextPlaced, score: nextScore });
        }
      }

      nextBeam.sort((a, b) => a.score - b.score);
      beam = nextBeam.slice(0, beamWidth);

      const placedRatio = blocks.length ? bestPlaced / blocks.length : 1;
      callbacks?.onProgress?.(
        Math.min(98, Math.round(5 + placedRatio * 90)),
        bestUnplaced.length,
        bestUnplaced,
        bestSchedule,
      );

      if (explored % 3 === 0) await yieldToUi(callbacks);
      if (bestUnplaced.length === 0) break;
    }

    if (bestUnplaced.length === 0) break;
    await yieldToUi(callbacks);
  }

  return { bestSchedule, bestPenalty, bestUnplaced, bestPlaced, explored };
}



type DomainCache = Map<string, Slot[]>;

type BacktrackingSearchResult = {
  schedule: Record<string, any>;
  unplaced: BlockToPlace[];
  complete: boolean;
  exploredNodes: number;
  backtracks: number;
  cacheHits: number;
  elapsedMs: number;
  stoppedByLimit: boolean;
  nogoodHits: number;
  nogoodCount: number;
  visitedStateHits: number;
};

function findBlockSlotInSchedule(
  schedule: Record<string, any>,
  block: BlockToPlace,
): Slot | undefined {
  for (const day of DAYS) {
    for (const hour of HOURS) {
      const found = asArray(schedule[`class_${block.classId}_${day}_${hour}`])
        .some((item) => item?.blockId === block.blockId);
      if (found) return { day, hour };
    }
  }
  return undefined;
}

function cloneDomainCache(cache: DomainCache): DomainCache {
  const next: DomainCache = new Map();
  for (const [blockId, slots] of cache.entries()) {
    next.set(blockId, slots.map((slot) => ({ ...slot })));
  }
  return next;
}

/**
 * Gerçek recursive CSP backtracking çözücüsü.
 *
 * - MRV: domain'i en küçük olan bloğu seçer.
 * - Degree tie-break: uzun ve çok öğretmenli blokları önce seçer.
 * - LCV: diğer domainleri en az daraltan slotları önce dener.
 * - Forward checking: her atamadan sonra kalan bütün domainleri daraltır.
 * - Domain cache: her recursion düğümü, yeniden hesaplamak yerine ebeveynin
 *   daraltılmış domain haritasını devralır.
 * - Backtracking: çıkmazda son atamayı tamamen geri alıp sıradaki slotu dener.
 */
async function recursiveBacktrackingSearch(
  baseSchedule: Record<string, any>,
  blocks: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
  options: {
    timeLimitMs?: number;
    nodeLimit?: number;
    preferredSchedule?: Record<string, any>;
  } = {},
): Promise<BacktrackingSearchResult> {
  const started = Date.now();
  const timeLimitMs = Math.max(1000, options.timeLimitMs ?? runtimeConstraintSettings.backtrackingTimeLimitMs);
  const nodeLimit = Math.max(1000, options.nodeLimit ?? runtimeConstraintSettings.maxBacktrackingNodes);
  const preferredSlots = new Map<string, Slot>();
  const conflictGraph = buildConflictGraph(classrooms);
  const degreeByBlock = new Map<string, number>();
  for (const block of blocks) {
    const node = [...conflictGraph.values()].find((item) =>
      String(item.classId) === String(block.classId) &&
      createCourseIdentity(item.course, item.classId) === createCourseIdentity(block.course, block.classId),
    );
    degreeByBlock.set(block.id, node?.degree || 0);
  }
  const nogoods = new Set<string>();
  const visitedStates = new Set<string>();
  let visitedStateHits = 0;
  let nogoodHits = 0;

  if (options.preferredSchedule) {
    for (const block of blocks) {
      const slot = findBlockSlotInSchedule(options.preferredSchedule, block);
      if (slot) preferredSlots.set(block.id, slot);
    }
  }

  let exploredNodes = 0;
  let backtracks = 0;
  let cacheHits = 0;
  let stoppedByLimit = false;
  let completeSchedule: Record<string, any> | null = null;
  let bestSchedule = clone(baseSchedule);
  let bestRemaining = blocks.slice();
  let bestPlaced = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;

  const initialDomains: DomainCache = new Map();
  for (let index = 0; index < blocks.length; index++) {
    if (callbacks?.shouldCancel?.()) break;
    const block = blocks[index];
    const slots = await possibleSlotsForBlockResponsive(
      block,
      baseSchedule,
      teachers,
      classrooms,
      unwantedTeacherDays,
      callbacks,
    );
    initialDomains.set(block.id, slots);
    if (index % 3 === 0) await yieldToUi(callbacks);
  }

  const updateBest = (
    schedule: Record<string, any>,
    remaining: BlockToPlace[],
  ) => {
    const placed = blocks.length - remaining.length;
    if (placed < bestPlaced) return;
    const penalty = calculateSchedulePenalty(
      schedule,
      classrooms,
      teachers,
      unwantedTeacherDays,
    ).totalPenalty;
    if (placed > bestPlaced || penalty < bestPenalty) {
      bestPlaced = placed;
      bestPenalty = penalty;
      bestSchedule = clone(schedule);
      bestRemaining = remaining.slice();
      callbacks?.onProgress?.(
        Math.min(99, Math.round((placed / Math.max(1, blocks.length)) * 100)),
        remaining.length,
        remaining,
        bestSchedule,
      );
    }
  };

  const lcvImpact = (
    selected: BlockToPlace,
    slot: Slot,
    schedule: Record<string, any>,
    remaining: BlockToPlace[],
    domains: DomainCache,
  ): number => {
    const sandbox = clone(schedule);
    writeAssignment(sandbox, selected, slot, teachers);
    let removedValues = 0;
    for (const block of remaining) {
      if (block.id === selected.id) continue;
      const domain = domains.get(block.id) || [];
      for (const candidateSlot of domain) {
        if (!canPlaceBlock(block, candidateSlot, sandbox, teachers, classrooms, unwantedTeacherDays)) {
          removedValues++;
        }
      }
    }
    return removedValues;
  };

  const search = async (
    schedule: Record<string, any>,
    remaining: BlockToPlace[],
    domains: DomainCache,
  ): Promise<boolean> => {
    if (callbacks?.shouldCancel?.()) return false;
    if (Date.now() - started >= timeLimitMs || exploredNodes >= nodeLimit) {
      stoppedByLimit = true;
      return false;
    }

    // Tam gün kimliği kullanılır. Eski `${slot.day[0]}` biçimi Pazartesi ve
    // Perşembe'yi aynı "P" ile kodladığı için farklı CSP durumlarını yanlışlıkla
    // aynı visited-state sayıyor ve geçerli çözümleri budayabiliyordu.
    const stateSignature = remaining
      .map((block) => `${block.id}:${(domains.get(block.id) || [])
        .map((slot) => `${DAYS.indexOf(slot.day)}@${slot.hour}`)
        .join(",")}`)
      .sort()
      .join("|");
    if (runtimeConstraintSettings.visitedStateCacheEnabled && visitedStates.has(stateSignature)) {
      visitedStateHits++;
      return false;
    }
    if (runtimeConstraintSettings.visitedStateCacheEnabled) visitedStates.add(stateSignature);
    if (runtimeConstraintSettings.nogoodLearningEnabled && nogoods.has(stateSignature)) {
      nogoodHits++;
      return false;
    }

    exploredNodes++;
    if (exploredNodes % 20 === 0) await yieldToUi(callbacks);

    if (remaining.length === 0) {
      completeSchedule = clone(schedule);
      bestSchedule = clone(schedule);
      bestRemaining = [];
      bestPlaced = blocks.length;
      return true;
    }

    updateBest(schedule, remaining);

    // MRV + degree tie-break. Domain cache sayesinde burada domain yeniden üretilmez.
    const ordered = remaining.slice().sort((a, b) => {
      const aDomain = domains.get(a.id) || [];
      const bDomain = domains.get(b.id) || [];
      cacheHits += 2;
      return (
        aDomain.length - bDomain.length ||
        (degreeByBlock.get(b.id) || 0) - (degreeByBlock.get(a.id) || 0) ||
        b.duration - a.duration ||
        getCourseTeacherKeys(b.course, teachers).length - getCourseTeacherKeys(a.course, teachers).length
      );
    });

    const selected = ordered[0];
    const selectedDomain = domains.get(selected.id) || [];
    cacheHits++;
    if (selectedDomain.length === 0) {
      if (runtimeConstraintSettings.nogoodLearningEnabled) nogoods.add(stateSignature);
      backtracks++;
      return false;
    }

    const rest = remaining.filter((block) => block.id !== selected.id);
    const preferred = preferredSlots.get(selected.id);

    // LCV: gerçek domain daralması ölçülür. Beam sonucundaki slot yalnızca öncelik bonusudur.
    const scoredSlots = selectedDomain.map((slot) => {
      const preferredBonus = preferred && preferred.day === slot.day && preferred.hour === slot.hour ? -100000 : 0;
      return {
        ...slot,
        score:
          preferredBonus +
          lcvImpact(selected, slot, schedule, rest, domains) * 1000 +
          scoreSlot(selected, slot, schedule, classrooms, teachers, unwantedTeacherDays),
      };
    }).sort((a, b) => (a.score || 0) - (b.score || 0));

    for (const slot of scoredSlots) {
      if (callbacks?.shouldCancel?.()) return false;
      if (Date.now() - started >= timeLimitMs || exploredNodes >= nodeLimit) {
        stoppedByLimit = true;
        return false;
      }

      const nextSchedule = clone(schedule);
      writeAssignment(nextSchedule, selected, slot, teachers);

      // Forward checking: kalan domainler yalnızca küçültülür.
      const nextDomains = cloneDomainCache(domains);
      nextDomains.delete(selected.id);
      let domainWipeout = false;

      for (const block of rest) {
        const parentDomain = nextDomains.get(block.id) || [];
        cacheHits++;
        const filtered = parentDomain.filter((candidateSlot) =>
          canPlaceBlock(
            block,
            candidateSlot,
            nextSchedule,
            teachers,
            classrooms,
            unwantedTeacherDays,
          ),
        );
        nextDomains.set(block.id, filtered);
        if (filtered.length === 0) {
          domainWipeout = true;
          break;
        }
      }

      if (!domainWipeout) {
        const solved = await search(nextSchedule, rest, nextDomains);
        if (solved) return true;
      }

      // Atama nextSchedule kopyasında olduğu için bu noktada tam rollback gerçekleşir.
      backtracks++;
    }

    if (runtimeConstraintSettings.nogoodLearningEnabled) nogoods.add(stateSignature);
    return false;
  };

  // Başlangıçta domain'i boş olan bir değişken varsa yine de tanı raporu için best partial döndürülür.
  const hasInitialWipeout = blocks.some((block) => (initialDomains.get(block.id) || []).length === 0);
  if (!hasInitialWipeout && !callbacks?.shouldCancel?.()) {
    await search(clone(baseSchedule), blocks.slice(), initialDomains);
  }

  return {
    schedule: completeSchedule || bestSchedule,
    unplaced: completeSchedule ? [] : bestRemaining,
    complete: Boolean(completeSchedule),
    exploredNodes,
    backtracks,
    cacheHits,
    elapsedMs: Date.now() - started,
    stoppedByLimit,
    nogoodHits,
    visitedStateHits,
    nogoodCount: nogoods.size,
  };
}

async function repairSchedule(
  schedule: Record<string, any>,
  unplaced: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks
): Promise<{ schedule: Record<string, any>; unplaced: BlockToPlace[] }> {
  let working = clone(schedule);
  const stillUnplaced: BlockToPlace[] = [];

  for (let i = 0; i < unplaced.length; i++) {
    const block = unplaced[i];
    const directSlots = possibleSlotsForBlock(block, working, teachers, classrooms, unwantedTeacherDays)
      .map((slot) => ({ ...slot, score: scoreSlot(block, slot, working, classrooms, teachers, unwantedTeacherDays) }))
      .sort((a, b) => (a.score || 0) - (b.score || 0));

    if (directSlots[0]) {
      writeAssignment(working, block, directSlots[0], teachers);
      continue;
    }

    // Limited rip-up: remove one non-manual block from the target class and retry.
    let repaired = false;
    const candidateBlockIds = new Set<string>();
    for (const day of DAYS) {
      for (const hour of HOURS) {
        for (const item of asArray(working[`class_${block.classId}_${day}_${hour}`])) {
          if (item?.blockId && !item?.isManual) candidateBlockIds.add(item.blockId);
        }
      }
    }

    for (const removeId of Array.from(candidateBlockIds).slice(0, 25)) {
      const sandbox = clone(working);
      const removedItems: any[] = [];
      for (const day of DAYS) {
        for (const hour of HOURS) {
          for (const item of asArray(sandbox[`class_${block.classId}_${day}_${hour}`])) {
            if (item?.blockId === removeId) removedItems.push(item);
          }
        }
      }
      removeBlock(sandbox, removeId);
      const slots = possibleSlotsForBlock(block, sandbox, teachers, classrooms, unwantedTeacherDays);
      if (!slots.length) continue;
      writeAssignment(sandbox, block, slots[0], teachers);

      const removedCourse = removedItems[0];
      const removedDuration = Math.max(1, removedItems.length);
      const displaced: BlockToPlace = {
        id: `${block.id}_repair_${removeId}`,
        course: removedCourse,
        classId: block.classId,
        className: block.className,
        duration: removedDuration,
        blockId: removeId,
      };
      const replacementSlots = possibleSlotsForBlock(displaced, sandbox, teachers, classrooms, unwantedTeacherDays);
      if (replacementSlots.length) {
        writeAssignment(sandbox, displaced, replacementSlots[0], teachers);
        working = sandbox;
        repaired = true;
        break;
      }
    }

    if (!repaired) stillUnplaced.push(block);
    if (i % 5 === 0) await yieldToUi(callbacks);
  }

  return { schedule: working, unplaced: stillUnplaced };
}

function removeDuplicateEmptyArrays(schedule: Record<string, any>) {
  for (const key of Object.keys(schedule)) {
    if (Array.isArray(schedule[key]) && schedule[key].length === 0) delete schedule[key];
  }
}



/**
 * Geçerli bir CSP çözümünü bozmadan genetik olarak iyileştirir.
 * Her mutasyon önce bloğu kaldırır, sonra yalnızca hard-constraint kontrolünden
 * geçen bir slota yeniden yerleştirir. Bu nedenle popülasyondaki bireyler
 * öğretmen/sınıf çakışması üretmez.
 */
async function geneticRefineSchedule(
  baseSchedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
  options: { populationSize?: number; generations?: number; timeLimitMs?: number } = {},
): Promise<Record<string, any>> {
  const populationSize = Math.max(6, options.populationSize ?? 14);
  const generations = Math.max(4, options.generations ?? 24);
  const timeLimitMs = Math.max(500, options.timeLimitMs ?? 3500);
  const started = Date.now();

  const score = (schedule: Record<string, any>) =>
    calculateSchedulePenalty(schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;

  const collectMovableBlocks = (schedule: Record<string, any>) => {
    const seen = new Set<string>();
    const result: BlockToPlace[] = [];
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("class_")) continue;
      const parts = key.split("_");
      if (parts.length < 4) continue;
      const classId = parts[1];
      const className = findClassName(classrooms, classId);
      for (const item of asArray(raw)) {
        if (!item?.blockId || item?.isManual || seen.has(item.blockId)) continue;
        seen.add(item.blockId);
        let duration = 0;
        for (const d of DAYS) {
          for (const h of HOURS) {
            duration += asArray(schedule[`class_${classId}_${d}_${h}`]).some(
              (entry) => entry?.blockId === item.blockId,
            ) ? 1 : 0;
          }
        }
        result.push({
          id: `ga_${item.blockId}`,
          course: item,
          classId,
          className,
          duration: Math.max(1, duration),
          blockId: item.blockId,
        });
      }
    }
    return result;
  };

  const mutate = (source: Record<string, any>): Record<string, any> => {
    const candidate = clone(source);
    const blocks = collectMovableBlocks(candidate);
    if (!blocks.length) return candidate;
    // Bir mutasyonda tek blok taşınır. Birden fazla bloğu rastgele söküp
    // geri koymak, iyi yerleşmiş öğretmen bloklarını gereksiz bozabiliyordu.
    const changes = 1;

    for (let i = 0; i < changes; i++) {
      const block = blocks[Math.floor(runtimeRandom() * blocks.length)];
      if (!block) continue;
      removeBlock(candidate, block.blockId);
      const slots = possibleSlotsForBlock(
        block, candidate, teachers, classrooms, unwantedTeacherDays,
      );
      if (!slots.length) {
        // Güvenli geri dönüş: bloğu eski bireyden aynen geri getir.
        for (const [key, raw] of Object.entries(source)) {
          const matches = asArray(raw).filter((entry) => entry?.blockId === block.blockId);
          if (matches.length) candidate[key] = clone(raw);
        }
        continue;
      }
      // En iyi adaylar rastgele ilk boşluktan değil, gerçek kalite puanından
      // seçilir. Böylece öğretmen günü ve boşluk tercihleri her turda korunur.
      const rankedSlots = slots
        .map((slot) => ({
          ...slot,
          score: scoreSlot(block, slot, candidate, classrooms, teachers, unwantedTeacherDays),
        }))
        .sort((a, b) => (a.score || 0) - (b.score || 0));
      const eliteSlots = rankedSlots.slice(0, Math.min(4, rankedSlots.length));
      const chosen = eliteSlots[Math.floor(runtimeRandom() * eliteSlots.length)];
      writeAssignment(candidate, block, chosen, teachers);
    }
    removeDuplicateEmptyArrays(candidate);
    return candidate;
  };

  let population = Array.from({ length: populationSize }, (_, index) =>
    index === 0 ? clone(baseSchedule) : mutate(baseSchedule),
  );
  let best = clone(baseSchedule);
  let bestScore = score(best);

  for (let generation = 0; generation < generations; generation++) {
    if (callbacks?.shouldCancel?.() || Date.now() - started >= timeLimitMs) break;
    await yieldToUi(callbacks);

    const ranked = population
      .map((schedule) => ({ schedule, penalty: score(schedule) }))
      .sort((a, b) => a.penalty - b.penalty);

    if (ranked[0] && ranked[0].penalty < bestScore) {
      best = clone(ranked[0].schedule);
      bestScore = ranked[0].penalty;
    }
    if (bestScore === 0) break;

    const eliteCount = Math.max(2, Math.floor(populationSize * 0.25));
    const elites = ranked.slice(0, eliteCount).map((item) => item.schedule);
    const next = elites.map(clone);
    while (next.length < populationSize) {
      const parent = elites[Math.floor(runtimeRandom() * elites.length)] || best;
      next.push(mutate(parent));
    }
    population = next;
    callbacks?.onProgress?.(94 + Math.floor(((generation + 1) / generations) * 5), 0, []);
    if (generation % 3 === 0) await yieldToUi(callbacks);
  }

  return best;
}

/**
 * Mevcut programı yeniden dağıtmadan sıkılaştırır. Manuel/kilitli bloklar
 * taşınmaz; yalnız kalite puanı gerçekten düşerse yeni program kabul edilir.
 */
export async function tightenExistingSchedule(
  schedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
): Promise<{ schedule: Record<string, any>; improved: boolean; initialPenalty: number; finalPenalty: number }> {
  runtimeConstraintSettings = loadConstraintSettings();
  DAYS = runtimeConstraintSettings.workDays?.length ? [...runtimeConstraintSettings.workDays] : getScheduleDays();
  HOURS = Array.from(
    { length: Math.max(1, Math.min(16, Number(runtimeConstraintSettings.dailyLessonCount) || getScheduleHours().length)) },
    (_, index) => index + 1,
  );
  runtimeRandom = createSeededRandom(runtimeConstraintSettings.seed);

  const initialPenalty = calculateSchedulePenalty(schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
  const refined = await geneticRefineSchedule(
    schedule,
    classrooms,
    teachers,
    unwantedTeacherDays,
    callbacks,
    { populationSize: 28, generations: 64, timeLimitMs: 10000 },
  );
  const finalPenalty = calculateSchedulePenalty(refined, classrooms, teachers, unwantedTeacherDays).totalPenalty;
  const valid = validateSchedule(refined, classrooms, teachers).valid;
  const improved = valid && finalPenalty < initialPenalty;
  return { schedule: improved ? refined : schedule, improved, initialPenalty, finalPenalty: improved ? finalPenalty : initialPenalty };
}

function buildSolverDiagnostics(blocks: BlockToPlace[], classrooms: Classroom[], teachers: Teacher[]) {
  const teacherless = new Set<string>();
  const autoInferred = new Set<string>();
  const overloadedClasses = new Set<string>();

  for (const block of blocks) {
    if (getCourseTeacherKeys(block.course, teachers).length === 0) teacherless.add(`${block.className} / ${getCourseName(block.course)}`);
    if (block.course.__autoTeacherInferred) autoInferred.add(`${block.className} / ${getCourseName(block.course)} → ${block.course.teacherName}`);
  }

  for (const cls of classrooms as any[]) {
    const total = (cls.assignedCourses || []).reduce((sum: number, c: any) => sum + getWeeklyHours(c), 0);
    if (total > DAYS.length * HOURS.length) overloadedClasses.add(`${cls.name}: ${total} saat / ${DAYS.length * HOURS.length} kapasite`);
  }

  const passiveTeacherNames = (teachers as any[])
    .filter((t) => t.status && normalizeText(t.status) !== "AKTİF")
    .map((t) => `${t.name} (${t.status})`)
    .slice(0, 10);

  return {
    teacherless: Array.from(teacherless).slice(0, 20),
    autoInferred: Array.from(autoInferred).slice(0, 20),
    overloadedClasses: Array.from(overloadedClasses),
    passiveTeacherNames,
  };
}



type GlobalLnsResult = {
  schedule: Record<string, any>;
  unplaced: BlockToPlace[];
  attempts: number;
  improvements: number;
  elapsedMs: number;
};

function blockPayloadId(block: BlockToPlace): string {
  return String(block?.blockId || block?.id || "");
}

function blockTeacherKeys(block: BlockToPlace, teachers: Teacher[]): Set<string> {
  const keys = new Set<string>();
  const members = block.linkedMembers?.length
    ? block.linkedMembers
    : [{ classId: block.classId, className: block.className, course: block.course }];
  for (const member of members) {
    for (const key of getCourseTeacherKeys(member.course, teachers)) keys.add(key);
  }
  return keys;
}

function blockAudience(block: BlockToPlace, classrooms: Classroom[]): Set<string> {
  const ids = new Set<string>();
  const members = block.linkedMembers?.length
    ? block.linkedMembers
    : [{ classId: block.classId, className: block.className, course: block.course }];
  for (const member of members) {
    for (const id of getCourseStudentAudience(member.course, member.classId, classrooms)) ids.add(id);
  }
  return ids;
}

function blocksShareHardResource(
  left: BlockToPlace,
  right: BlockToPlace,
  teachers: Teacher[],
  classrooms: Classroom[],
): boolean {
  const leftTeachers = blockTeacherKeys(left, teachers);
  if (leftTeachers.size) {
    for (const key of blockTeacherKeys(right, teachers)) if (leftTeachers.has(key)) return true;
  }

  const leftMembers = left.linkedMembers?.length
    ? left.linkedMembers
    : [{ classId: left.classId, className: left.className, course: left.course }];
  const rightMembers = right.linkedMembers?.length
    ? right.linkedMembers
    : [{ classId: right.classId, className: right.className, course: right.course }];
  for (const a of leftMembers) {
    for (const b of rightMembers) {
      if (String(a.classId) === String(b.classId) && groupOverlaps(a.course, b.course)) return true;
    }
  }

  const leftAudience = blockAudience(left, classrooms);
  if (leftAudience.size) {
    for (const id of blockAudience(right, classrooms)) if (leftAudience.has(id)) return true;
  }
  return false;
}

function addMovablePayloadBlockId(target: Set<string>, item: any) {
  if (!item || item?.isManual === true || item?.isLocked === true) return;
  const id = String(item?.blockId || "").trim();
  if (id) target.add(id);
}

/**
 * Bir slotu hedef blok için açmak gerektiğinde taşınabilecek otomatik blokları bulur.
 * Buradaki amaç slotu "yasak" saymak yerine, o slotu işgal eden otomatik dersleri
 * küçük bir komşuluk problemi içinde yeniden çözmektir. Manuel/kilitli kayıtlar
 * hiçbir zaman sökülmez.
 */
function collectMovableBlockersForSlot(
  block: BlockToPlace,
  slot: Slot,
  schedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
): Set<string> {
  const blockers = new Set<string>();
  const members = block.linkedMembers?.length
    ? block.linkedMembers
    : [{ classId: block.classId, className: block.className, course: block.course }];

  for (const member of members) {
    const incomingAudience = new Set(getCourseStudentAudience(member.course, member.classId, classrooms));
    const incomingTeachers = new Set(getCourseTeacherKeys(member.course, teachers));

    for (let offset = 0; offset < block.duration; offset++) {
      const hour = slot.hour + offset;

      // Aynı sınıf/grup hücresini işgal eden otomatik bloklar.
      for (const item of asArray(schedule[`class_${member.classId}_${slot.day}_${hour}`])) {
        if (groupOverlaps(member.course, item)) addMovablePayloadBlockId(blockers, item);
      }

      // Aynı öğretmeni aynı saatte kullanan bütün otomatik bloklar.
      if (incomingTeachers.size) {
        for (const classroom of classrooms as any[]) {
          for (const item of asArray(schedule[`class_${classroom.id}_${slot.day}_${hour}`])) {
            const keys = resolveTeacherIdentityKeys(item, teachers);
            if (keys.some((key) => incomingTeachers.has(key))) addMovablePayloadBlockId(blockers, item);
          }
        }
      }

      // Öğrenci bazlı grup/ortaklaştırma çakışmaları.
      if (incomingAudience.size) {
        for (const classroom of classrooms as any[]) {
          for (const item of asArray(schedule[`class_${classroom.id}_${slot.day}_${hour}`])) {
            const audience = getCourseStudentAudience(item, String(classroom.id), classrooms);
            if (audience.some((id) => incomingAudience.has(id))) addMovablePayloadBlockId(blockers, item);
          }
        }
      }
    }

    // Günlük ders saati sınırı yalnız aynı dersin o günkü otomatik blokları
    // yüzünden doluysa, LNS bu blokları başka güne taşıyabilsin.
    if (
      getDailyCourseHours(member.classId, member.course, slot.day, schedule) + block.duration >
      getMaxDailyCourseHours(member.course)
    ) {
      const identity = courseIdentity(member.course, member.classId);
      for (const hour of HOURS) {
        for (const item of asArray(schedule[`class_${member.classId}_${slot.day}_${hour}`])) {
          if (courseIdentity(item, member.classId) === identity) addMovablePayloadBlockId(blockers, item);
        }
      }
    }
  }

  blockers.delete(blockPayloadId(block));
  return blockers;
}

async function scarcityGreedyPortfolio(
  baseSchedule: Record<string, any>,
  blocks: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
  options: { restarts?: number; maxProbe?: number; progressStart?: number; progressEnd?: number } = {},
) {
  const restarts = Math.max(1, options.restarts ?? 7);
  const maxProbe = Math.max(4, options.maxProbe ?? 14);
  const progressStart = options.progressStart ?? 45;
  const progressEnd = options.progressEnd ?? 70;
  // 500+ blokluk okul problemlerinde bir portföy restart'ı, özellikle son
  // onlarca zor blokta çok uzun sürebiliyordu. Bu fazın amacı tek başına
  // tam çözüm bulmak değil, sonraki LNS/exact turlarına güçlü bir aday
  // bırakmaktır. Bu nedenle faza güvenli bir süre bütçesi ve canlı ilerleme
  // kalp atışı veriyoruz; süre dolunca en iyi bulunan adayla sonraki faza
  // geçilir, dağıtım penceresi aynı yüzde takılı kalmaz.
  const phaseTimeLimitMs = blocks.length > 450 ? 30000 : blocks.length > 250 ? 40000 : 50000;
  let stagnantRestarts = 0;

  const staticDomains = new Map<string, Slot[]>();
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    staticDomains.set(
      block.id,
      possibleSlotsForBlock(block, baseSchedule, teachers, classrooms, unwantedTeacherDays),
    );
    if (index % 24 === 0) await yieldToUi(callbacks);
  }

  const resourceDegree = new Map<string, number>();
  for (const block of blocks) {
    let degree = 0;
    for (const other of blocks) {
      if (block.id === other.id) continue;
      if (blocksShareHardResource(block, other, teachers, classrooms)) degree++;
    }
    resourceDegree.set(block.id, degree);
    if (resourceDegree.size % 24 === 0) await yieldToUi(callbacks);
  }

  // Süre bütçesi pahalı fakat bir defalık domain/çatışma ön hesabından sonra
  // başlar. Böylece büyük okul verisinde portföy turlarına gerçek çalışma
  // süresi kalır.
  const phaseStartedAt = Date.now();

  let bestSchedule = clone(baseSchedule);
  let bestUnplaced = blocks.slice();
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let restart = 0; restart < restarts; restart++) {
    if (callbacks?.shouldCancel?.() || Date.now() - phaseStartedAt >= phaseTimeLimitMs) break;
    const schedule = clone(baseSchedule);
    const pending = blocks.slice().sort((a, b) => {
      const domainDiff = (staticDomains.get(a.id)?.length || 0) - (staticDomains.get(b.id)?.length || 0);
      if (domainDiff) return domainDiff;
      const degreeDiff = (resourceDegree.get(b.id) || 0) - (resourceDegree.get(a.id) || 0);
      if (degreeDiff) return degreeDiff;
      return runtimeRandom() < 0.5 ? -1 : 1;
    });
    const unplaced: BlockToPlace[] = [];
    const restartInitialCount = pending.length;
    let processedInRestart = 0;
    let phaseTimedOut = false;

    while (pending.length) {
      if (callbacks?.shouldCancel?.()) {
        unplaced.push(...pending);
        pending.length = 0;
        break;
      }
      if (Date.now() - phaseStartedAt >= phaseTimeLimitMs) {
        unplaced.push(...pending);
        pending.length = 0;
        phaseTimedOut = true;
        break;
      }

      // Tam dinamik MRV çok pahalıdır. En kıt ilk N blok arasından gerçek
      // güncel domaini en küçük olanı seçmek, 500+ blokta iyi bir denge sağlar.
      const probeCount = Math.min(maxProbe, pending.length);
      let selectedIndex = 0;
      let selectedSlots: Slot[] | null = null;
      let bestDomainSize = Number.POSITIVE_INFINITY;

      for (let probe = 0; probe < probeCount; probe++) {
        const candidate = pending[probe];
        const legal = (staticDomains.get(candidate.id) || []).filter((slot) =>
          canPlaceBlock(candidate, slot, schedule, teachers, classrooms, unwantedTeacherDays),
        );
        if (legal.length < bestDomainSize) {
          selectedIndex = probe;
          selectedSlots = legal;
          bestDomainSize = legal.length;
          if (bestDomainSize === 0) break;
        }
      }

      const [block] = pending.splice(selectedIndex, 1);
      const legalSlots = selectedSlots ?? (staticDomains.get(block.id) || []).filter((slot) =>
        canPlaceBlock(block, slot, schedule, teachers, classrooms, unwantedTeacherDays),
      );

      if (!legalSlots.length) {
        unplaced.push(block);
      } else {
        legalSlots.sort((a, b) => {
          const classLoad = (slot: Slot) => HOURS.reduce(
            (sum, hour) => sum + (asArray(schedule[`class_${block.classId}_${slot.day}_${hour}`]).length ? 1 : 0),
            0,
          );
          const sameCourseHours = (slot: Slot) => getDailyCourseHours(block.classId, block.course, slot.day, schedule);
          const late = (slot: Slot) => slot.hour + block.duration - 1 >= HOURS.length ? 1 : 0;
          return (
            classLoad(a) - classLoad(b) ||
            sameCourseHours(a) - sameCourseHours(b) ||
            late(a) - late(b) ||
            (runtimeRandom() < 0.5 ? -1 : 1)
          );
        });
        writeAssignment(schedule, block, legalSlots[0], teachers);
      }

      processedInRestart += 1;
      // Tek bir restart boyunca da ilerleme bildir. Önceden yüzde yalnız restart
      // bittiğinde değiştiği için büyük programlarda ekran %55 gibi bir değerde
      // uzun süre donmuş görünüyordu.
      if (processedInRestart % 24 === 0 || pending.length === 0) {
        const restartStart = progressStart + (restart / restarts) * (progressEnd - progressStart);
        const restartEnd = progressStart + ((restart + 1) / restarts) * (progressEnd - progressStart);
        const fraction = Math.min(1, processedInRestart / Math.max(1, restartInitialCount));
        const heartbeatProgress = restartStart + fraction * (restartEnd - restartStart);
        callbacks?.onProgress?.(
          Math.min(95, Math.max(progressStart, Math.round(heartbeatProgress))),
          bestUnplaced.length,
          bestUnplaced,
          bestSchedule,
        );
        await yieldToUi(callbacks);
      }
    }

    const penalty = calculateSchedulePenalty(schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
    const unplacedHours = unplaced.reduce((sum, block) => sum + Math.max(1, Number(block.duration || 1)), 0);
    const bestHours = bestUnplaced.reduce((sum, block) => sum + Math.max(1, Number(block.duration || 1)), 0);
    const improved = unplacedHours < bestHours || (unplacedHours === bestHours && penalty < bestPenalty);
    if (improved) {
      bestSchedule = clone(schedule);
      bestUnplaced = unplaced.slice();
      bestPenalty = penalty;
      stagnantRestarts = 0;
    } else {
      stagnantRestarts += 1;
    }

    const progress = progressStart + ((restart + 1) / restarts) * (progressEnd - progressStart);
    callbacks?.onProgress?.(
      Math.min(95, Math.round(progress)),
      bestUnplaced.length,
      bestUnplaced,
      bestSchedule,
    );
    await yieldToUi(callbacks);
    if (!bestUnplaced.length || phaseTimedOut) break;
    // Büyük okul problemlerinde art arda iki restart yeni bir blok dahi
    // kurtaramadıysa aynı pahalı taramayı sürdürmek yerine LNS fazına geç.
    // LNS zaten otomatik blokları birlikte söküp yeniden yerleştirmek için var.
    if (blocks.length > 450 && restart >= 2 && stagnantRestarts >= 2) break;
  }

  return { bestSchedule, bestUnplaced, bestPenalty, staticDomains };
}

async function largeNeighborhoodRepair(
  immutableBaseSchedule: Record<string, any>,
  sourceSchedule: Record<string, any>,
  sourceUnplaced: BlockToPlace[],
  allBlocks: BlockToPlace[],
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks,
  options: { timeLimitMs?: number; neighborhoodCap?: number; maxAttempts?: number } = {},
): Promise<GlobalLnsResult> {
  const started = Date.now();
  const timeLimitMs = Math.max(5000, options.timeLimitMs ?? 45000);
  const neighborhoodCap = Math.max(8, options.neighborhoodCap ?? 26);
  const maxAttempts = Math.max(4, options.maxAttempts ?? 60);
  const byPayloadId = new Map(allBlocks.map((block) => [blockPayloadId(block), block]));
  const staticDomains = new Map<string, Slot[]>();
  for (const block of allBlocks) {
    staticDomains.set(block.id, possibleSlotsForBlock(block, immutableBaseSchedule, teachers, classrooms, unwantedTeacherDays));
  }

  let schedule = clone(sourceSchedule);
  let unplaced = sourceUnplaced.slice();
  let attempts = 0;
  let improvements = 0;

  const makeNeighborhood = (target: BlockToPlace): BlockToPlace[] => {
    const ids = new Set<string>([blockPayloadId(target)]);
    const slots = (staticDomains.get(target.id) || [])
      .map((slot) => ({
        slot,
        blockers: collectMovableBlockersForSlot(target, slot, schedule, classrooms, teachers),
      }))
      .sort((a, b) => a.blockers.size - b.blockers.size || a.slot.hour - b.slot.hour);

    for (const plan of slots.slice(0, 8)) {
      for (const id of plan.blockers) {
        ids.add(id);
        if (ids.size >= neighborhoodCap) break;
      }
      if (ids.size >= neighborhoodCap) break;
    }

    // Aynı öğretmen/sınıf/öğrenci kitlesindeki diğer eksik blokları da aynı
    // exact alt probleme al. Böylece bir bloğu kurtarıp ötekini kilitlemeyiz.
    for (const pending of unplaced) {
      if (ids.size >= neighborhoodCap) break;
      if (pending.id === target.id) continue;
      if (blocksShareHardResource(target, pending, teachers, classrooms)) ids.add(blockPayloadId(pending));
    }

    // Bir seviye genişletme: ilk engelleyicilerin alternatif saatlerini açmak
    // için onların da birkaç engelleyicisini komşuluğa ekle.
    const firstLayer = [...ids];
    for (const id of firstLayer) {
      if (ids.size >= neighborhoodCap) break;
      const block = byPayloadId.get(id);
      if (!block || block.id === target.id) continue;
      const alternatives = (staticDomains.get(block.id) || [])
        .map((slot) => ({ slot, blockers: collectMovableBlockersForSlot(block, slot, schedule, classrooms, teachers) }))
        .sort((a, b) => a.blockers.size - b.blockers.size)
        .slice(0, 3);
      for (const alt of alternatives) {
        for (const blockerId of alt.blockers) {
          ids.add(blockerId);
          if (ids.size >= neighborhoodCap) break;
        }
        if (ids.size >= neighborhoodCap) break;
      }
    }

    const result: BlockToPlace[] = [];
    for (const id of ids) {
      const block = byPayloadId.get(id);
      if (block) result.push(block);
    }
    if (!result.some((item) => item.id === target.id)) result.push(target);
    return result;
  };

  while (unplaced.length && attempts < maxAttempts && Date.now() - started < timeLimitMs) {
    if (callbacks?.shouldCancel?.()) break;
    let improvedPass = false;

    const orderedTargets = unplaced.slice().sort((a, b) =>
      (staticDomains.get(a.id)?.length || 0) - (staticDomains.get(b.id)?.length || 0) ||
      (blockTeacherKeys(b, teachers).size - blockTeacherKeys(a, teachers).size),
    );

    for (const target of orderedTargets) {
      if (attempts >= maxAttempts || Date.now() - started >= timeLimitMs || callbacks?.shouldCancel?.()) break;
      attempts++;

      const neighborhood = makeNeighborhood(target);
      if (neighborhood.length <= 1) continue;
      const neighborhoodPayloadIds = new Set(neighborhood.map(blockPayloadId));
      const previouslyUnplaced = unplaced.filter((block) => neighborhoodPayloadIds.has(blockPayloadId(block)));
      const beforeGlobalCount = unplaced.length;

      const base = clone(schedule);
      for (const block of neighborhood) removeBlock(base, blockPayloadId(block));

      const exact = await recursiveBacktrackingSearch(
        base,
        neighborhood,
        classrooms,
        teachers,
        unwantedTeacherDays,
        callbacks,
        {
          timeLimitMs: Math.min(6000, Math.max(1800, Math.floor((timeLimitMs - (Date.now() - started)) / 4))),
          nodeLimit: 90000,
        },
      );

      const outsideUnplaced = unplaced.filter((block) => !neighborhoodPayloadIds.has(blockPayloadId(block)));
      const candidateUnplaced = [...outsideUnplaced, ...exact.unplaced];
      const beforeHours = unplaced.reduce((sum, block) => sum + Math.max(1, Number(block.duration || 1)), 0);
      const afterHours = candidateUnplaced.reduce((sum, block) => sum + Math.max(1, Number(block.duration || 1)), 0);

      if (afterHours < beforeHours || (afterHours === 0 && beforeGlobalCount > 0)) {
        schedule = exact.schedule;
        unplaced = candidateUnplaced;
        improvements++;
        improvedPass = true;
        callbacks?.onProgress?.(
          Math.min(98, 72 + Math.round((1 - unplaced.length / Math.max(1, sourceUnplaced.length)) * 24)),
          unplaced.length,
          unplaced,
          schedule,
        );
        await yieldToUi(callbacks);
        if (!unplaced.length) break;
      }
    }

    if (!improvedPass) break;
  }

  return { schedule, unplaced, attempts, improvements, elapsedMs: Date.now() - started };
}

function relaxUnplacedBlocksToAtomic(blocks: BlockToPlace[]): BlockToPlace[] {
  const result: BlockToPlace[] = [];

  for (const block of blocks) {
    if (block.duration <= 1 || block.course?.strictBlocks === true) {
      result.push(block);
      continue;
    }

    for (let part = 0; part < block.duration; part++) {
      result.push({
        ...block,
        id: `${block.id}__ATOM_${part + 1}`,
        duration: 1,
        blockId: `${block.blockId}__ATOM_${part + 1}`,
      });
    }
  }

  return result;
}


export async function runOptimizationSolver(
  requestedConfig: SolverConfig,
  currentSchedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  courses: Course[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: SolverCallbacks
): Promise<SolverResult> {
  // V4: algoritma seçimini artık zorla backtracking'e çevirmiyoruz.
  // Hibrit modda farklı çözüm stratejileri aday üretir; bağımsız hakem
  // hard-constraint geçerliliği -> yerleşmeyen blok -> ceza puanı sırasıyla
  // en iyi sonucu seçer.
  const config: SolverConfig = {
    ...requestedConfig,
    mode: undefined,
  };
  const started = Date.now();
  runtimeConstraintSettings = { ...loadConstraintSettings(), ...(config.constraintSettings || {}) };
  DAYS = runtimeConstraintSettings.workDays?.length
    ? [...runtimeConstraintSettings.workDays]
    : getScheduleDays();
  HOURS = Array.from(
    { length: Math.max(1, Math.min(16, Number(runtimeConstraintSettings.dailyLessonCount) || getScheduleHours().length)) },
    (_, index) => index + 1,
  );
  runtimeRandom = createSeededRandom(runtimeConstraintSettings.seed);

  const preflightClassrooms = (() => {
    if (config.scope !== "local" || !config.selectedId || !config.viewType) return classrooms;

    if (config.viewType === "class") {
      return (classrooms as any[]).filter((classroom) => String(classroom.id) === String(config.selectedId));
    }

    const selectedTeacher = getTeacherById(teachers, String(config.selectedId));
    const selectedTeacherName = normalizeText(selectedTeacher?.name);
    const selectedTeacherKey = `ID:${String(config.selectedId)}`;
    return (classrooms as any[])
      .map((classroom) => ({
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).filter((course: any) => {
          const hydrated = hydrateCourse(course, teachers);
          return getCourseTeacherKeys(hydrated, teachers).includes(selectedTeacherKey)
            || normalizeText(hydrated.teacherName) === selectedTeacherName
            || normalizeText(hydrated.teacherName2) === selectedTeacherName;
        }),
      }))
      .filter((classroom) => classroom.assignedCourses.length > 0);
  })();

  const preflight = runSchedulePreflight(preflightClassrooms, teachers, runtimeConstraintSettings);
  if (!preflight.ok) {
    const critical = preflight.issues.filter((issue) => issue.severity === "error");
    const unchangedPenalty = calculateSchedulePenalty(currentSchedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
    return {
      success: false,
      initialPenalty: unchangedPenalty,
      finalPenalty: unchangedPenalty,
      durationMs: Date.now() - started,
      schedule: currentSchedule,
      unplacedBlocks: critical.map((issue) => ({
        courseName: "Geçersiz ders tanımı",
        className: String(issue.message || "").split(" / ")[0] || "Sınıf",
        reason: issue.message,
      })),
      details: `Dağıtım başlatılmadı. Ön kontrol ${critical.length} kritik veri/kısıt sorunu buldu: ${critical.slice(0, 12).map((issue) => issue.message).join(" | ")}`,
    };
  }

  const initialPenalty = calculateSchedulePenalty(currentSchedule, classrooms, teachers, unwantedTeacherDays).totalPenalty;
  const workingSchedule = clone(currentSchedule || {});
  clearAssignments(workingSchedule, config.scope, config.selectedId, config.viewType, teachers, classrooms);
  removeDuplicateEmptyArrays(workingSchedule);

  const blocks = buildBlocks(workingSchedule, config, classrooms, teachers);
  if (blocks.length === 0) {
    return {
      success: true,
      initialPenalty,
      finalPenalty: initialPenalty,
      durationMs: Date.now() - started,
      schedule: currentSchedule,
      details: "Yerleştirilecek ders bloğu bulunamadı. Ders-sınıf-haftalık saat tanımlarını kontrol ediniz.",
      unplacedBlocks: [],
    };
  }

  const diagnostics = buildSolverDiagnostics(blocks, classrooms, teachers);
  callbacks?.onProgress?.(3, blocks.length, blocks, workingSchedule);

  type StrategyCandidate = {
    name: string;
    schedule: Record<string, any>;
    unplaced: BlockToPlace[];
    unplacedHours: number;
    penalty: number;
    valid: boolean;
    hardErrors: number;
    meta?: string;
  };

  const candidates: StrategyCandidate[] = [];

  const registerCandidate = (
    name: string,
    schedule: Record<string, any>,
    unplaced: BlockToPlace[],
    meta = "",
  ): StrategyCandidate => {
    const validation = validateSchedule(schedule, classrooms, teachers);
    const candidate: StrategyCandidate = {
      name,
      schedule: clone(schedule),
      unplaced: unplaced.slice(),
      unplacedHours: unplaced.reduce((sum, block) => sum + Math.max(1, Number(block?.duration || 1)), 0),
      penalty: calculateSchedulePenalty(schedule, classrooms, teachers, unwantedTeacherDays).totalPenalty,
      valid: validation.valid,
      hardErrors: validation.errors.length,
      meta,
    };
    candidates.push(candidate);
    return candidate;
  };

  const compareCandidates = (a: StrategyCandidate, b: StrategyCandidate) => {
    // 1) Hard constraint doğruluğu vazgeçilmezdir.
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    if (a.hardErrors !== b.hardErrors) return a.hardErrors - b.hardErrors;
    // 2) Sonra mümkün olan en fazla DERS SAATİ yerleşsin. Kurtarma modunda
    // 2 saatlik bloklar 1+1 atomlarına ayrılabildiği için yalnız blok sayısını
    // karşılaştırmak yanlış sonuç verirdi.
    if (a.unplacedHours !== b.unplacedHours) return a.unplacedHours - b.unplacedHours;
    if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length - b.unplaced.length;
    // 3) Ancak bundan sonra soft kalite / ceza puanı karşılaştırılır.
    return a.penalty - b.penalty;
  };

  const bestCandidate = () => candidates.slice().sort(compareCandidates)[0];

  // STRATEJİ A — hızlı greedy başlangıç. Sonuç hemen canlı görünür ve diğer
  // motorlara iyi bir başlangıç tercihi sağlar.
  const firstPass = await fastGreedySeed(
    workingSchedule,
    blocks,
    classrooms,
    teachers,
    unwantedTeacherDays,
    callbacks,
  );
  registerCandidate(
    "Hızlı Greedy",
    firstPass.bestSchedule,
    firstPass.bestUnplaced,
    `${firstPass.bestPlaced}/${blocks.length} blok`,
  );

  callbacks?.onProgress?.(35, firstPass.bestUnplaced.length, firstPass.bestUnplaced, firstPass.bestSchedule);

  if (callbacks?.shouldCancel?.()) {
    const best = bestCandidate();
    return {
      success: false,
      initialPenalty,
      finalPenalty: best.penalty,
      durationMs: Date.now() - started,
      schedule: best.schedule,
      unplacedBlocks: best.unplaced,
      details: `Dağıtım kullanıcı tarafından iptal edildi. O ana kadarki en iyi aday: ${best.name}.`,
    };
  }

  // STRATEJİ B — hibrit/ortools profilinde Beam Search ayrı bir çözüm adayıdır.
  // Bu arama MRV+LCV kullanır fakat recursive motorla aynı yolu izlemez; böylece
  // farklı bir yerleşim bölgesini keşfeder.
  let beamResult: Awaited<ReturnType<typeof robustBeamSearch>> | null = null;
  if (config.algorithm === "hybrid" || config.algorithm === "ortools") {
    beamResult = await robustBeamSearch(
      workingSchedule,
      blocks,
      classrooms,
      teachers,
      unwantedTeacherDays,
      callbacks,
      {
        timeLimitMs: blocks.length > 120 ? 9000 : 7000,
        restarts: blocks.length > 120 ? 3 : 4,
        beamWidth: blocks.length > 120 ? 6 : 8,
      },
    );
    registerCandidate(
      "MRV + LCV Beam Search",
      beamResult.bestSchedule,
      beamResult.bestUnplaced,
      `${beamResult.explored} durum tarandı`,
    );
  }

  if (callbacks?.shouldCancel?.()) {
    const best = bestCandidate();
    return {
      success: false,
      initialPenalty,
      finalPenalty: best.penalty,
      durationMs: Date.now() - started,
      schedule: best.schedule,
      unplacedBlocks: best.unplaced,
      details: `Dağıtım kullanıcı tarafından iptal edildi. O ana kadarki en iyi aday: ${best.name}.`,
    };
  }

  // STRATEJİ C — exact recursive CSP/backtracking.
  const backtrackingBudget: Record<string, { timeLimitMs: number; nodeLimit: number }> = {
    hybrid: { timeLimitMs: 45000, nodeLimit: 350000 },
    backtracking: { timeLimitMs: 60000, nodeLimit: 500000 },
    ortools: { timeLimitMs: 50000, nodeLimit: 400000 },
    korayucar: { timeLimitMs: 50000, nodeLimit: 400000 },
    korayucarv3: { timeLimitMs: 60000, nodeLimit: 500000 },
    korayucardraft: { timeLimitMs: 35000, nodeLimit: 250000 },
  };
  const profileBudget = backtrackingBudget[config.algorithm] || backtrackingBudget.hybrid;
  const exactBudget = {
    timeLimitMs: runtimeConstraintSettings.backtrackingTimeLimitMs || profileBudget.timeLimitMs,
    nodeLimit: runtimeConstraintSettings.maxBacktrackingNodes || profileBudget.nodeLimit,
    preferredSchedule: (beamResult && beamResult.bestPlaced >= firstPass.bestPlaced)
      ? beamResult.bestSchedule
      : firstPass.bestSchedule,
  };

  const exact = await recursiveBacktrackingSearch(
    workingSchedule,
    blocks,
    classrooms,
    teachers,
    unwantedTeacherDays,
    callbacks,
    exactBudget,
  );
  registerCandidate(
    "Recursive CSP / Backtracking",
    exact.schedule,
    exact.unplaced,
    `${exact.exploredNodes} düğüm, ${exact.backtracks} geri dönüş`,
  );

  if (callbacks?.shouldCancel?.()) {
    const best = bestCandidate();
    return {
      success: false,
      initialPenalty,
      finalPenalty: best.penalty,
      durationMs: Date.now() - started,
      schedule: best.schedule,
      unplacedBlocks: best.unplaced,
      details: `Dağıtım kullanıcı tarafından iptal edildi. O ana kadarki en iyi aday: ${best.name}.`,
    };
  }

  // STRATEJİ D — her adayın en iyisine sınırlı rip-up/repair uygula.
  // Böylece recursive aramanın süre sınırında bıraktığı birkaç zor blok için
  // bütün programı yeniden çözmeden yer açmayı deneriz.
  const beforeRepair = bestCandidate();
  if (beforeRepair.unplaced.length > 0) {
    const repaired = await repairSchedule(
      beforeRepair.schedule,
      beforeRepair.unplaced,
      classrooms,
      teachers,
      unwantedTeacherDays,
      callbacks,
    );
    registerCandidate(
      `Akıllı Onarım (${beforeRepair.name})`,
      repaired.schedule,
      repaired.unplaced,
      `${beforeRepair.unplacedHours - repaired.unplaced.reduce((sum, block) => sum + Math.max(1, Number(block?.duration || 1)), 0)} ders saati kurtarıldı`,
    );
  }

  // V2 GLOBAL ÇÖZÜM — TÜM PROGRAMI ATOMİK OLARAK YENİDEN KUR + LNS
  //
  // Eski kurtarma yaklaşımı yalnız yerleşmeyen blokları 1 saate bölüyor, daha önce
  // yerleşmiş 486 bloğu fiilen sabit bırakıyordu. Son 68 bloğun 0/40 domain
  // görünmesinin ana sebeplerinden biri bu: yasal saatler vardı fakat erken
  // yerleşimler bütün seçenekleri doldurmuştu. Bu tur bütün otomatik programı
  // immutable (manuel/kilitli) tabandan yeniden kurar; dolayısıyla önce yerleşen
  // dersler de gerektiğinde başka saate taşınabilir.
  const globalAtomicBlocks = buildBlocks(
    workingSchedule,
    config,
    classrooms,
    teachers,
    "relaxed",
  );

  if (globalAtomicBlocks.length > 0 && !callbacks?.shouldCancel?.()) {
    callbacks?.onProgress?.(46, globalAtomicBlocks.length, globalAtomicBlocks, workingSchedule);
    const atomicPortfolio = await scarcityGreedyPortfolio(
      workingSchedule,
      globalAtomicBlocks,
      classrooms,
      teachers,
      unwantedTeacherDays,
      callbacks,
      {
        restarts: globalAtomicBlocks.length > 450 ? 8 : 6,
        maxProbe: globalAtomicBlocks.length > 450 ? 12 : 16,
        progressStart: 46,
        progressEnd: 70,
      },
    );

    registerCandidate(
      "V2 Global Atomik / Kıtlık Öncelikli Portföy",
      atomicPortfolio.bestSchedule,
      atomicPortfolio.bestUnplaced,
      `${globalAtomicBlocks.length - atomicPortfolio.bestUnplaced.length}/${globalAtomicBlocks.length} atom yerleşti`,
    );

    if (atomicPortfolio.bestUnplaced.length > 0 && !callbacks?.shouldCancel?.()) {
      const lns = await largeNeighborhoodRepair(
        workingSchedule,
        atomicPortfolio.bestSchedule,
        atomicPortfolio.bestUnplaced,
        globalAtomicBlocks,
        classrooms,
        teachers,
        unwantedTeacherDays,
        callbacks,
        {
          timeLimitMs: globalAtomicBlocks.length > 450 ? 65000 : 45000,
          neighborhoodCap: globalAtomicBlocks.length > 450 ? 30 : 24,
          maxAttempts: globalAtomicBlocks.length > 450 ? 80 : 55,
        },
      );
      registerCandidate(
        "V2 Global Büyük Komşuluk / Exact Yeniden Çözüm",
        lns.schedule,
        lns.unplaced,
        `${lns.improvements} iyileştirme, ${lns.attempts} komşuluk, ${lns.elapsedMs} ms`,
      );
    }
  }

  // STRATEJİ E — BLOK ESNETME / ATOMİK KURTARMA
  //
  // Diğer programların yerleştirebildiği halde bizim 2 saatlik ardışık blok
  // zorunluluğunda takıldığımız durumların ana kaynağı buydu. Önce 2+2+...
  // tercih edilir; yalnız eksik kalan ve strictBlocks olmayan bloklar 1 saatlik
  // atomlara ayrılır. Günlük azami ders saati ve bütün hard constraint'ler
  // korunur. Böylece kalite tercihi, tam dağıtımın önüne geçmez.
  const beforeAtomicRescue = bestCandidate();
  const atomicBlocks = relaxUnplacedBlocksToAtomic(beforeAtomicRescue.unplaced);
  const atomicChanged =
    atomicBlocks.length !== beforeAtomicRescue.unplaced.length ||
    atomicBlocks.some((block, index) => block.id !== beforeAtomicRescue.unplaced[index]?.id);

  if (beforeAtomicRescue.unplacedHours > 0 && atomicBlocks.length > 0 && atomicChanged) {
    callbacks?.onProgress?.(
      90,
      atomicBlocks.length,
      atomicBlocks,
      beforeAtomicRescue.schedule,
    );

    const atomicGreedy = await fastGreedySeed(
      beforeAtomicRescue.schedule,
      atomicBlocks,
      classrooms,
      teachers,
      unwantedTeacherDays,
      callbacks,
    );
    registerCandidate(
      "Esnek Blok Kurtarma / Hızlı",
      atomicGreedy.bestSchedule,
      atomicGreedy.bestUnplaced,
      `${atomicBlocks.length - atomicGreedy.bestUnplaced.length}/${atomicBlocks.length} atom yerleşti`,
    );

    if (atomicGreedy.bestUnplaced.length > 0 && !callbacks?.shouldCancel?.()) {
      const atomicExact = await recursiveBacktrackingSearch(
        beforeAtomicRescue.schedule,
        atomicBlocks,
        classrooms,
        teachers,
        unwantedTeacherDays,
        callbacks,
        {
          timeLimitMs: Math.max(20000, Math.min(45000, runtimeConstraintSettings.backtrackingTimeLimitMs || 30000)),
          nodeLimit: Math.max(250000, Math.min(750000, runtimeConstraintSettings.maxBacktrackingNodes || 500000)),
          preferredSchedule: atomicGreedy.bestSchedule,
        },
      );
      registerCandidate(
        "Esnek Blok Kurtarma / Recursive CSP",
        atomicExact.schedule,
        atomicExact.unplaced,
        `${atomicExact.exploredNodes} düğüm, ${atomicExact.backtracks} geri dönüş`,
      );

      if (atomicExact.unplaced.length > 0) {
        const atomicRepaired = await repairSchedule(
          atomicExact.schedule,
          atomicExact.unplaced,
          classrooms,
          teachers,
          unwantedTeacherDays,
          callbacks,
        );
        registerCandidate(
          "Esnek Blok Kurtarma / Onarım",
          atomicRepaired.schedule,
          atomicRepaired.unplaced,
          "1 saatlik atomlar için rip-up / repair",
        );
      }
    }
  }

  // STRATEJİ F — yalnız tam ve geçerli çözüm varsa kalite optimizasyonu.
  // Genetik iyileştirme hiçbir zaman eksik bir programı "daha güzel" diye
  // tam programın önüne geçiremez; hakem sıralaması bunu ayrıca garanti eder.
  const completeCandidate = bestCandidate();
  if (completeCandidate.valid && completeCandidate.unplaced.length === 0) {
    const refinedSchedule = await geneticRefineSchedule(
      completeCandidate.schedule,
      classrooms,
      teachers,
      unwantedTeacherDays,
      callbacks,
      { populationSize: 24, generations: 48, timeLimitMs: 8000 },
    );
    registerCandidate(
      `Yönlendirilmiş Kalite İyileştirme (${completeCandidate.name})`,
      refinedSchedule,
      [],
      "Tam çözüm üzerinde soft optimizasyon",
    );
  }

  const winner = bestCandidate();
  const finalValidation = validateSchedule(winner.schedule, classrooms, teachers);
  const finalInfeasibility = analyzeInfeasibility(
    winner.unplaced,
    {},
    { schedule: winner.schedule, classrooms, teachers, unwantedTeacherDays },
  );
  const immutableDomainAnalysis = analyzeInfeasibility(
    winner.unplaced,
    {},
    { schedule: workingSchedule, classrooms, teachers, unwantedTeacherDays },
  );
  const immutableById = new Map<string, any>(
    immutableDomainAnalysis.map((item: any) => [String(item.blockId), item]),
  );
  const infeasibility = finalInfeasibility.map((item: any) => {
    const immutable: any = immutableById.get(String(item.blockId));
    if (immutable && immutable.legalCandidateSlots > 0 && item.legalCandidateSlots === 0) {
      return {
        ...item,
        summary:
          `${immutable.legalCandidateSlots}/${immutable.totalCandidateSlots} temel yasal aday mevcut; ` +
          `mevcut otomatik yerleşimler bu adayların tamamını dolduruyor. Bu gerçek bir kapalı-domain değil, global yeniden yerleştirme problemidir.`,
        suggestedActions: [
          "V2 büyük komşuluk yeniden çözümü otomatik dersleri birlikte taşıyarak yer açmayı dener.",
          ...(item.suggestedActions || []).filter((action) => !String(action).includes("kilitli/manuel")),
        ],
      };
    }
    return item;
  });
  const success = winner.unplaced.length === 0 && finalValidation.valid;
  const infeasibilityById = new Map(
    infeasibility.map((item) => [String(item.blockId), item]),
  );
  const enrichedUnplaced = winner.unplaced.map((block) => {
    const analysis = infeasibilityById.get(String(block?.id || block?.blockId || ""));
    return {
      ...block,
      courseName: block?.courseName || getCourseName(block?.course || block),
      teacherName: block?.teacherName || block?.course?.teacherName || "",
      teacherName2: block?.teacherName2 || block?.course?.teacherName2 || "",
      reason: analysis?.summary || block?.reason || "Uygun saat bulunamadı.",
      reasonDetails: analysis?.reasonDetails || [],
      suggestedActions: analysis?.suggestedActions || [],
      legalCandidateSlots: analysis?.legalCandidateSlots,
      totalCandidateSlots: analysis?.totalCandidateSlots,
    };
  });

  callbacks?.onProgress?.(100, enrichedUnplaced.length, enrichedUnplaced, winner.schedule);

  const exactStatus = exact.complete
    ? "Recursive backtracking tam çözüm buldu."
    : exact.stoppedByLimit
      ? "Recursive backtracking süre/düğüm sınırında en iyi kısmi çözümü döndürdü."
      : "Recursive backtracking arama uzayını tüketti ancak tam çözüm bulamadı.";

  const candidateSummary = candidates
    .slice()
    .sort(compareCandidates)
    .map((candidate, index) =>
      `${index + 1}) ${candidate.name}: hard=${candidate.hardErrors}, eksikSaat=${candidate.unplacedHours}, yerleşmeyenBlok=${candidate.unplaced.length}, ceza=${candidate.penalty}${candidate.meta ? `, ${candidate.meta}` : ""}`,
    )
    .join(" | ");

  const algorithmName: Record<string, string> = {
    hybrid: "e-Nstitü V2 Global Atomik + Büyük Komşuluk Motoru",
    ortools: "e-Nstitü V2 CP-SAT profilli Global Motor",
    backtracking: "e-Nstitü V2 Recursive + Büyük Komşuluk Motoru",
    korayucar: "Koray Uçar profilli V4 Çoklu Strateji Motoru",
    korayucarv3: "Koray Uçar V3 profilli V4 Çoklu Strateji Motoru",
    korayucardraft: "Koray Uçar Taslak profilli V4 Motoru",
  };

  return {
    success,
    initialPenalty,
    finalPenalty: winner.penalty,
    durationMs: Date.now() - started,
    schedule: winner.schedule,
    unplacedBlocks: enrichedUnplaced,
    details: `${algorithmName[config.algorithm] || "EduPanel V4 Ders Programı Motoru"} çalıştırıldı. Kazanan strateji: ${winner.name}. Hakem önceliği: hard-constraint geçerliliği -> eksik ders saati -> yerleşmeyen blok sayısı -> soft ceza puanı. ${exactStatus} Recursive düğüm: ${exact.exploredNodes}; geri dönüş: ${exact.backtracks}; domain cache erişimi: ${exact.cacheHits}; nogood isabeti: ${exact.nogoodHits || 0}; nogood kaydı: ${exact.nogoodCount || 0}; visited-state isabeti: ${exact.visitedStateHits || 0}; recursive süre: ${exact.elapsedMs} ms. Aday sıralaması: ${candidateSummary}. ${finalValidation.errors.length ? `Doğrulayıcı ${finalValidation.errors.length} hard constraint hatası buldu. ` : ""}${infeasibility.length ? `Çözümsüzlük analizi: ${infeasibility.slice(0, 3).map((item) => `${item.className}/${item.courseName}: ${item.summary}`).join("; ")}. ` : ""}${success ? "Tüm bloklar yerleştirildi ve bağımsız doğrulayıcıdan geçti." : `${winner.unplacedHours} ders saati (${winner.unplaced.length} blok) için uygun yer bulunamadı; ayrıntılı nedenler sonuç penceresine eklendi.`} ${diagnostics.autoInferred.length ? `Otomatik branş eşleştirme: ${diagnostics.autoInferred.join("; ")}.` : ""} ${diagnostics.teacherless.length ? `Öğretmeni boş kalan dersler: ${diagnostics.teacherless.join("; ")}.` : ""} ${diagnostics.overloadedClasses.length ? `Kapasite uyarısı: ${diagnostics.overloadedClasses.join("; ")}.` : ""}`,
  };
}
