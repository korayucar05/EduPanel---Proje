
import type { Classroom, Course, Teacher } from "../../types";
import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";
import { calculateSchedulePenalty } from "../../utils/penaltyCalculator";
import { loadConstraintSettings } from "./constraintDefaults";
import { analyzeInfeasibility } from "./infeasibilityAnalyzer";
import {
  createCourseIdentity,
  coursesConflictInSameClass,
  getCourseTargetGroups,
  getScheduleCourseName,
  getScheduleWeeklyHours,
  isCommonCourseForClass,
  normalizeGroups,
  normalizeScheduleText,
  resolveTeacherIdentityKeys,
} from "./scheduleIdentity";
import { getScheduleDays, getScheduleHours } from "./scheduleRules";
import { runSchedulePreflight } from "./schedulePreflight";
import { validateSchedule } from "./scheduleValidator";

export const KORAY_UCAR_ENGINE_NAME = "KorayUçar";

export interface KorayUcarSolverConfig {
  scope: "local" | "global";
  selectedId?: string;
  viewType?: "class" | "teacher";
  constraintSettings?: Partial<ScheduleConstraintSettings>;
  /** Toplam arama bütçesi. Büyük okulda varsayılan 45 saniye. */
  timeLimitMs?: number;
  /** Farklı tie-break / random sıralamalarla yeniden başlama sayısı. */
  restarts?: number;
  /** Bir restart'ta gezilecek maksimum arama düğümü. */
  maxNodesPerRestart?: number;

  /**
   * Öğretmensiz Taslak Dağıtım:
   * - öğretmen ataması zorunlu değildir,
   * - öğretmen doluluk/kapalı zaman/çakışma kısıtları uygulanmaz,
   * - sınıf + hedef grup + ders saati + blok kuralları çözülür,
   * - üretilen kayıtlar TASLAK olarak işaretlenir.
   */
  draftWithoutTeachers?: boolean;
}

export interface KorayUcarSolverCallbacks {
  onProgress?: (progress: number, unplacedCount: number, unplacedDetails: any[]) => void;
  shouldPause?: () => boolean | Promise<boolean | void>;
  shouldCancel?: () => boolean;
}

export interface KorayUcarSolverResult {
  success: boolean;
  initialPenalty: number;
  finalPenalty: number;
  durationMs: number;
  schedule: Record<string, any>;
  unplacedBlocks: KorayUcarBlock[];
  details: string;
  statistics: {
    engine: typeof KORAY_UCAR_ENGINE_NAME;
    restartsTried: number;
    nodesVisited: number;
    backtracks: number;
    forwardCheckPrunes: number;
    repairAttempts: number;
    lnsRounds?: number;
    lnsImprovedRounds?: number;
    ejectionChains?: number;
    nogoodCount?: number;
    cpSatHintCount?: number;
    bestPlacedBlocks: number;
    totalBlocks: number;
  };
  infeasibility?: any;
  /**
   * KorayUçar aday çözümünden üretilen CP-SAT başlangıç ipuçları.
   * Python OR-Tools katmanı AddHint desteği kullanıyorsa doğrudan aktarılabilir.
   */
  cpSatWarmStartHint?: Array<{
    blockId: string;
    className: string;
    day: string;
    hour: number;
  }>;
}

export interface KorayUcarBlock {
  id: string;
  identity: string;
  classId: string;
  className: string;
  course: any;
  duration: number;
  blockIndex: number;
  blockId: string;
  teacherKeys: string[];
  groups: string[];
  difficulty: number;
}

interface Slot {
  day: string;
  hour: number;
  score: number;
}

interface Placement {
  block: KorayUcarBlock;
  day: string;
  hour: number;
}

interface SearchStats {
  nodes: number;
  backtracks: number;
  forwardPrunes: number;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? {}));

function seededRandom(seed: number) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function toArray(value: any): any[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function isMeaningfulTeacherKey(key: string) {
  return Boolean(key && !key.endsWith("ÖĞRETMEN ATANMADI") && !key.endsWith("BELİRTİLMEDİ"));
}

function parsePreferredBlocks(course: any, weeklyHours: number): number[] {
  // Okul kuralı: Haftalık 2 saatlik ders ASLA 1+1 şeklinde bölünmez.
  // Bütün KorayUçar stratejilerinde tek ve ardışık 2 saatlik bloktur.
  if (weeklyHours === 2) return [2];

  const direct = Array.isArray(course?.preferredBlocks)
    ? course.preferredBlocks.map(Number).filter((v: number) => Number.isInteger(v) && v > 0)
    : [];

  if (
    direct.length &&
    direct.reduce((a: number, b: number) => a + b, 0) === weeklyHours &&
    course?.strictBlocks === true
  ) {
    return direct;
  }

  const pattern = String(course?.blockPattern || course?.preferredBlockPattern || "").trim();
  if (pattern) {
    const parsed = pattern
      .split(/[+,/xX\s-]+/)
      .map(Number)
      .filter((v) => Number.isInteger(v) && v > 0);
    if (
      parsed.length &&
      parsed.reduce((a, b) => a + b, 0) === weeklyHours &&
      course?.strictBlocks === true
    ) return parsed;
  }

  // Açık bir blok tercihi yoksa çözümü gereksiz yere kilitlemeyiz.
  // Önce tek saatlik atomik birimler yerleştirilir; kalite puanı aynı dersleri
  // mümkün olduğunca dengeli/kompakt yerleştirmeyi teşvik eder.
  return Array.from({ length: weeklyHours }, () => 1);
}

function getTargetClassrooms(
  classrooms: Classroom[],
  config: KorayUcarSolverConfig,
  teachers: Teacher[],
): Classroom[] {
  if (config.scope === "global") return classrooms;
  if (config.viewType === "class") {
    return classrooms.filter((cls: any) => String(cls.id) === String(config.selectedId));
  }
  if (config.viewType === "teacher") {
    const teacher = (teachers as any[]).find((t) => String(t.id) === String(config.selectedId));
    if (!teacher) return [];
    const teacherKey = `ID:${teacher.id}`;
    return classrooms.filter((cls: any) =>
      (cls.assignedCourses || []).some((course: any) =>
        resolveTeacherIdentityKeys(course, teachers).includes(teacherKey),
      ),
    );
  }
  return classrooms;
}


function teacherAvailabilityRatio(
  teacherKey: string,
  teachers: Teacher[],
  days: string[],
  hours: number[],
): number {
  const teacher =
    teacherKey.startsWith("ID:")
      ? (teachers as any[]).find((item) => String(item.id) === teacherKey.slice(3))
      : (teachers as any[]).find(
          (item) => `NAME:${normalizeScheduleText(item.name)}` === teacherKey,
        );

  if (!teacher) return 1;

  let available = days.length * hours.length;
  const unavailable = teacher.unavailableSlots || teacher.blockedSlots || [];

  for (const day of days) {
    for (const hour of hours) {
      if (
        unavailable.some(
          (slot: any) =>
            normalizeScheduleText(slot.day) === normalizeScheduleText(day) &&
            Number(slot.hour) === Number(hour),
        )
      ) {
        available--;
      }
    }
  }

  return Math.max(1, available);
}

function buildBlocks(
  classrooms: Classroom[],
  teachers: Teacher[],
  config: KorayUcarSolverConfig,
  days: string[],
  hours: number[],
): KorayUcarBlock[] {
  const targetClasses = getTargetClassrooms(classrooms, config, teachers);
  const blocks: KorayUcarBlock[] = [];

  for (const cls of targetClasses as any[]) {
    for (const rawCourse of cls.assignedCourses || []) {
      if (config.scope === "local" && config.viewType === "teacher" && config.selectedId) {
        const teacherKeys = resolveTeacherIdentityKeys(rawCourse, teachers);
        if (!teacherKeys.includes(`ID:${config.selectedId}`)) continue;
      }

      const weeklyHours = getScheduleWeeklyHours(rawCourse);
      if (weeklyHours <= 0) continue;

      const course = config.draftWithoutTeachers
        ? {
            ...rawCourse,
            weeklyHours,
            // Taslak modda öğretmen bilgisi çözüm kısıtı değildir.
            // Orijinal bilgi yalnız tanılama amacıyla ayrı alanlarda korunur.
            __draftWithoutTeachers: true,
            __originalTeacherId: rawCourse.teacherId || "",
            __originalTeacherName: rawCourse.teacherName || "",
            __originalTeacherId2: rawCourse.teacherId2 || "",
            __originalTeacherName2: rawCourse.teacherName2 || "",
            teacherId: "",
            teacherName: "",
            teacherId2: "",
            teacherName2: "",
          }
        : { ...rawCourse, weeklyHours };

      const teacherKeys = config.draftWithoutTeachers
        ? []
        : resolveTeacherIdentityKeys(course, teachers).filter(isMeaningfulTeacherKey);

      const groups = getCourseTargetGroups(course);

      const durations = parsePreferredBlocks(course, weeklyHours);
      const baseIdentity = createCourseIdentity(course, String(cls.id));

      durations.forEach((duration, blockIndex) => {
        blocks.push({
          id: `${baseIdentity}__B${blockIndex + 1}`,
          identity: baseIdentity,
          classId: String(cls.id),
          className: cls.name,
          course,
          duration,
          blockIndex,
          blockId: `korayucar_${String(cls.id)}_${blockIndex}_${baseIdentity}`,
          teacherKeys,
          groups,
          difficulty: 0,
        });
      });
    }
  }

  // Sabit zorluk bileşenleri. Dinamik domain büyüklüğü arama sırasında ayrıca kullanılır.
  const teacherLoad = new Map<string, number>();
  for (const block of blocks) {
    for (const key of block.teacherKeys) teacherLoad.set(key, (teacherLoad.get(key) || 0) + block.duration);
  }

  for (const block of blocks) {
    const teacherPressure = block.teacherKeys.reduce(
      (sum, key) => sum + (teacherLoad.get(key) || 0),
      0,
    );
    const bottleneckPressure = block.teacherKeys.reduce((sum, key) => {
      const required = teacherLoad.get(key) || 0;
      const available = teacherAvailabilityRatio(key, teachers, days, hours);
      const ratio = required / Math.max(1, available);
      return sum + ratio * 120;
    }, 0);

    const blockPressure = block.duration * 20;
    const twoTeacherPressure = Math.max(0, block.teacherKeys.length - 1) * 40;
    const groupPressure = block.groups.length * 8;
    const capacity = Math.max(1, days.length * hours.length);

    block.difficulty =
      blockPressure +
      teacherPressure / capacity +
      bottleneckPressure +
      twoTeacherPressure +
      groupPressure;
  }

  return blocks;
}

function clearScopeAssignments(
  schedule: Record<string, any>,
  config: KorayUcarSolverConfig,
  classrooms: Classroom[],
  teachers: Teacher[],
) {
  if (config.scope === "global") {
    for (const key of Object.keys(schedule)) {
      if (key.startsWith("class_") || key.startsWith("teacher_")) delete schedule[key];
    }
    return;
  }

  if (config.viewType === "class" && config.selectedId) {
    const prefix = `class_${config.selectedId}_`;
    for (const key of Object.keys(schedule)) if (key.startsWith(prefix)) delete schedule[key];

    // Öğretmen görünümlerindeki aynı sınıfa ait aynaları da temizle.
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("teacher_")) continue;
      const remaining = toArray(raw).filter((item) => {
        const cls = (classrooms as any[]).find((c) => c.name === item?.className);
        return String(cls?.id || "") !== String(config.selectedId);
      });
      if (remaining.length) schedule[key] = remaining;
      else delete schedule[key];
    }
    return;
  }

  if (config.viewType === "teacher" && config.selectedId) {
    const teacherPrefix = `teacher_${config.selectedId}_`;
    for (const key of Object.keys(schedule)) if (key.startsWith(teacherPrefix)) delete schedule[key];

    const teacher = (teachers as any[]).find((t) => String(t.id) === String(config.selectedId));
    if (!teacher) return;
    const targetKey = `ID:${teacher.id}`;
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("class_")) continue;
      const remaining = toArray(raw).filter(
        (item) => !resolveTeacherIdentityKeys(item, teachers).includes(targetKey),
      );
      if (remaining.length) schedule[key] = remaining;
      else delete schedule[key];
    }
  }
}

function groupsConflict(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  return a.some((group) => b.includes(group));
}

function itemGroups(item: any): string[] {
  return getCourseTargetGroups(item);
}

function itemTeacherKeys(item: any, teachers: Teacher[]): string[] {
  return resolveTeacherIdentityKeys(item, teachers).filter(isMeaningfulTeacherKey);
}

function isBlockedByManualKeys(
  schedule: Record<string, any>,
  teacherKey: string,
  day: string,
  hour: number,
): boolean {
  if (!teacherKey.startsWith("ID:")) return false;
  const id = teacherKey.slice(3);
  return Boolean(schedule[`blocked_teacher_${id}_${day}_${hour}`]);
}

function teacherUnavailable(
  teacherKey: string,
  day: string,
  hour: number,
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
): boolean {
  const teacher =
    teacherKey.startsWith("ID:")
      ? (teachers as any[]).find((t) => String(t.id) === teacherKey.slice(3))
      : (teachers as any[]).find(
          (t) => `NAME:${normalizeScheduleText(t.name)}` === teacherKey,
        );
  if (!teacher) return false;

  const unwanted = unwantedTeacherDays[String(teacher.id)] || unwantedTeacherDays[teacher.name] || [];
  if (unwanted.map(normalizeScheduleText).includes(normalizeScheduleText(day))) return true;

  const unavailableSlots = teacher.unavailableSlots || teacher.blockedSlots || [];
  return unavailableSlots.some((slot: any) =>
    normalizeScheduleText(slot.day) === normalizeScheduleText(day) &&
    Number(slot.hour) === Number(hour),
  );
}

function slotHardValid(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  day: string,
  startHour: number,
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
): boolean {
  if (!days.includes(day)) return false;
  const maxHour = Math.max(...hours);
  if (startHour < Math.min(...hours) || startHour + block.duration - 1 > maxHour) return false;

  // Aynı fiziksel sınıfın farklı gruplarında ORTAK ders tek bir ders gibi
  // davranır. Kardeş grupta bu ortak ders daha önce yerleştirilmişse yeniden
  // dağıtılan grup onu başka saate taşıyamaz; aynı gün/saat zorunludur.
  // Kardeş grubun alan/seçmeli dersleri de ortak ders uğruna silinemez.
  const physicalClassName = (value: any) => normalizeScheduleText(value || "")
    .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "")
    .trim();
  const blockPhysicalName = physicalClassName(block.className);
  const blockIsCommon =
    isCommonCourseForClass(block.course) ||
    (block.course as any)?.type === "compulsory" ||
    (block.course as any)?.isCommonElective === true;
  const sameCourse = (item: any) =>
    normalizeScheduleText(item?.courseName || item?.name || item?.subject) ===
    normalizeScheduleText((block.course as any)?.courseName || (block.course as any)?.name || (block.course as any)?.subject);

  let siblingCommonSlot: { day: string; hour: number } | null = null;
  if (blockIsCommon) {
    for (const [key, raw] of Object.entries(schedule)) {
      const match = key.match(/^class_([^_]+)_(.+)_(\d+)$/);
      if (!match || String(match[1]) === String(block.classId)) continue;
      const items = toArray(raw);
      const siblingCopy = items.find((item: any) =>
        physicalClassName(item?.className) === blockPhysicalName &&
        sameCourse(item) &&
        (isCommonCourseForClass(item) || item?.type === "compulsory" || item?.isCommonElective === true),
      );
      if (siblingCopy) {
        siblingCommonSlot = { day: match[2], hour: Number(match[3]) };
        break;
      }
    }
    if (siblingCommonSlot &&
        (normalizeScheduleText(siblingCommonSlot.day) !== normalizeScheduleText(day) ||
         siblingCommonSlot.hour !== Number(startHour))) return false;
  }

  for (let offset = 0; offset < block.duration; offset++) {
    const hour = startHour + offset;
    if (!hours.includes(hour)) return false;

    if (schedule[`blocked_class_${block.classId}_${day}_${hour}`]) return false;

    const classItems = toArray(schedule[`class_${block.classId}_${day}_${hour}`]);
    for (const item of classItems) {
      if (coursesConflictInSameClass(block.course, item)) return false;
    }

    // Ortak ders, kardeş grubun aynı saatteki alan/seçmeli dersinin üstüne
    // yazılamaz. Böylece ikinci grubun "Sınıf Dağıtımı" daha önce tamamen
    // dağıtılmış ilk grubun seçmeli derslerini eksiltmez.
    if (blockIsCommon) {
      for (const [key, raw] of Object.entries(schedule)) {
        if (!key.startsWith("class_") || !key.endsWith(`_${day}_${hour}`)) continue;
        if (key.startsWith(`class_${block.classId}_`)) continue;
        const siblingItems = toArray(raw).filter((item: any) =>
          physicalClassName(item?.className) === blockPhysicalName,
        );
        if (siblingItems.some((item: any) =>
          !(sameCourse(item) &&
            (isCommonCourseForClass(item) || item?.type === "compulsory" || item?.isCommonElective === true)),
        )) return false;
      }
    }

    for (const teacherKey of block.teacherKeys) {
      if (isBlockedByManualKeys(schedule, teacherKey, day, hour)) return false;
      if (teacherUnavailable(teacherKey, day, hour, teachers, unwantedTeacherDays)) return false;

      // Class kayıtlarını source of truth olarak taramak, teacher mirror eksik olsa bile çakışmayı yakalar.
      for (const [key, raw] of Object.entries(schedule)) {
        if (!key.startsWith("class_") || !key.endsWith(`_${day}_${hour}`)) continue;
        if (key.startsWith(`class_${block.classId}_`)) continue;
        if (toArray(raw).some((item) => {
          if (!itemTeacherKeys(item, teachers).includes(teacherKey)) return false;
          // Aynı fiziksel sınıfın kardeş grubundaki aynı ORTAK ders, öğretmen
          // çakışması değildir; gerçekte iki grup birleşip tek öğretmenle dersi görür.
          if (blockIsCommon && physicalClassName(item?.className) === blockPhysicalName && sameCourse(item)) {
            return false;
          }
          return true;
        })) {
          return false;
        }
      }
    }
  }
  return true;
}

function countCourseHoursOnDay(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  day: string,
): number {
  let count = 0;
  for (const [key, raw] of Object.entries(schedule)) {
    if (!key.startsWith(`class_${block.classId}_${day}_`)) continue;
    count += toArray(raw).filter(
      (item) => createCourseIdentity(item, block.classId) === block.identity,
    ).length;
  }
  return count;
}

function countTeacherDayHours(
  schedule: Record<string, any>,
  teacherKey: string,
  day: string,
  teachers: Teacher[],
): number {
  let count = 0;
  for (const [key, raw] of Object.entries(schedule)) {
    if (!key.startsWith("class_") || !key.includes(`_${day}_`)) continue;
    count += toArray(raw).filter((item) => itemTeacherKeys(item, teachers).includes(teacherKey)).length;
  }
  return count;
}

function slotScore(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  day: string,
  hour: number,
  teachers: Teacher[],
): number {
  let score = 0;
  const sameCourseToday = countCourseHoursOnDay(schedule, block, day);
  score += sameCourseToday * 25;

  // Uzun blokları günün çok sonuna sıkıştırmama.
  score += hour * 0.15;

  // Öğretmen yükünü günler arasında dengele.
  for (const teacherKey of block.teacherKeys) {
    score += countTeacherDayHours(schedule, teacherKey, day, teachers) * 3;
  }

  // Aynı dersin farklı bloklarını mümkünse farklı günlere dağıt.
  for (const [key, raw] of Object.entries(schedule)) {
    if (!key.startsWith(`class_${block.classId}_`)) continue;
    for (const item of toArray(raw)) {
      if (createCourseIdentity(item, block.classId) !== block.identity) continue;
      const parts = key.split("_");
      const existingDay = parts[parts.length - 2];
      if (existingDay === day) score += 18;
    }
  }

  return score;
}

function domainForBlock(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
): Slot[] {
  const slots: Slot[] = [];
  for (const day of days) {
    for (const hour of hours) {
      if (!slotHardValid(schedule, block, day, hour, days, hours, teachers, unwantedTeacherDays)) continue;
      slots.push({ day, hour, score: slotScore(schedule, block, day, hour, teachers) });
    }
  }

  return slots.sort((a, b) => {
    const scoreDiff = a.score - b.score;
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    return random() - 0.5;
  });
}

function payloadForBlock(block: KorayUcarBlock) {
  return {
    courseName: getScheduleCourseName(block.course),
    weeklyHours: getScheduleWeeklyHours(block.course),
    teacherId: block.course.teacherId || "",
    teacherName: block.course.teacherName || "",
    teacherId2: block.course.teacherId2 || "",
    teacherName2: block.course.teacherName2 || "",
    className: block.className,
    type: block.course.type || block.course.courseType || "",
    groupName: block.course.groupName || "",
    targetGroups: block.course.targetGroups || [],
    splitGroupId: block.course.splitGroupId || "",
    blockId: block.blockId,
    blockDuration: block.duration,
    blockIndex: block.blockIndex,
    indivisibleTwoHourBlock:
      getScheduleWeeklyHours(block.course) === 2 && block.duration === 2,
    isManual: false,
    engine: KORAY_UCAR_ENGINE_NAME,
    isDraftSchedule: block.course.__draftWithoutTeachers === true,
    draftMode: block.course.__draftWithoutTeachers === true ? "WITHOUT_TEACHERS" : undefined,
    originalTeacherId: block.course.__originalTeacherId || undefined,
    originalTeacherName: block.course.__originalTeacherName || undefined,
    originalTeacherId2: block.course.__originalTeacherId2 || undefined,
    originalTeacherName2: block.course.__originalTeacherName2 || undefined,
  };
}

function addPlacement(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  day: string,
  hour: number,
  teachers: Teacher[],
) {
  const payload = payloadForBlock(block);
  for (let offset = 0; offset < block.duration; offset++) {
    const currentHour = hour + offset;
    const classKey = `class_${block.classId}_${day}_${currentHour}`;
    schedule[classKey] = [...toArray(schedule[classKey]), payload];

    for (const teacherKey of block.teacherKeys) {
      if (!teacherKey.startsWith("ID:")) continue;
      const teacherId = teacherKey.slice(3);
      const teacherKeyName = `teacher_${teacherId}_${day}_${currentHour}`;
      schedule[teacherKeyName] = [...toArray(schedule[teacherKeyName]), payload];
    }
  }
}

function removeBlockPlacement(schedule: Record<string, any>, blockId: string) {
  for (const key of Object.keys(schedule)) {
    if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
    const remaining = toArray(schedule[key]).filter((item) => item?.blockId !== blockId);
    if (remaining.length) schedule[key] = remaining;
    else delete schedule[key];
  }
}

function asyncPause(callbacks?: KorayUcarSolverCallbacks) {
  return new Promise<void>((resolve) => {
    const poll = async () => {
      if (callbacks?.shouldCancel?.()) return resolve();
      const paused = await callbacks?.shouldPause?.();
      if (paused) setTimeout(poll, 30);
      else resolve();
    };
    void poll();
  });
}

function pickNextMRV(
  schedule: Record<string, any>,
  remaining: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
) {
  let best:
    | { block: KorayUcarBlock; domain: Slot[]; index: number }
    | undefined;

  for (let index = 0; index < remaining.length; index++) {
    const block = remaining[index];
    const domain = domainForBlock(schedule, block, days, hours, teachers, unwantedTeacherDays, random);
    if (!best ||
        domain.length < best.domain.length ||
        (domain.length === best.domain.length && block.difficulty > best.block.difficulty) ||
        (domain.length === best.domain.length && block.difficulty === best.block.difficulty && random() < 0.5)) {
      best = { block, domain, index };
    }
    if (domain.length === 0) break;
  }
  return best;
}

function forwardCheck(
  schedule: Record<string, any>,
  remaining: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
): boolean {
  // Tam tarama pahalı olduğundan en zor/MRV adayı olacak ilk 12 bloğa bakılır.
  const candidates = [...remaining]
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 12);
  return candidates.every(
    (block) =>
      domainForBlock(schedule, block, days, hours, teachers, unwantedTeacherDays, random).length > 0,
  );
}

async function searchRestart(
  initialSchedule: Record<string, any>,
  blocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  deadline: number,
  maxNodes: number,
  random: () => number,
  callbacks?: KorayUcarSolverCallbacks,
): Promise<{
  schedule: Record<string, any>;
  unplaced: KorayUcarBlock[];
  stats: SearchStats;
}> {
  const schedule = clone(initialSchedule);
  const stats: SearchStats = { nodes: 0, backtracks: 0, forwardPrunes: 0 };
  let bestSchedule = clone(schedule);
  let bestRemaining = [...blocks];

  const recurse = async (remaining: KorayUcarBlock[]): Promise<boolean> => {
    if (!remaining.length) {
      bestSchedule = clone(schedule);
      bestRemaining = [];
      return true;
    }
    if (Date.now() >= deadline || stats.nodes >= maxNodes || callbacks?.shouldCancel?.()) return false;

    if (stats.nodes % 150 === 0) await asyncPause(callbacks);
    if (callbacks?.shouldCancel?.()) return false;

    const choice = pickNextMRV(
      schedule,
      remaining,
      days,
      hours,
      teachers,
      unwantedTeacherDays,
      random,
    );
    if (!choice || choice.domain.length === 0) {
      if (remaining.length < bestRemaining.length) {
        bestRemaining = [...remaining];
        bestSchedule = clone(schedule);
      }
      stats.backtracks++;
      return false;
    }

    const nextRemaining = remaining.filter((_, index) => index !== choice.index);

    // V3 Least-Constraining-Value: özellikle ilk birkaç slot için gerçek etkiyi ölç.
    const rankedDomain = choice.domain
      .slice(0, Math.min(14, choice.domain.length))
      .map((slot) => ({
        slot,
        impact: impactScore(
          schedule,
          choice.block,
          slot,
          nextRemaining,
          days,
          hours,
          teachers,
          unwantedTeacherDays,
          random,
        ),
      }))
      .sort((a, b) => {
        const diff = a.impact - b.impact;
        if (diff !== 0) return diff;
        return a.slot.score - b.slot.score;
      })
      .map((item) => item.slot)
      .concat(choice.domain.slice(Math.min(14, choice.domain.length)));

    for (const slot of rankedDomain) {
      if (Date.now() >= deadline || stats.nodes >= maxNodes || callbacks?.shouldCancel?.()) break;
      stats.nodes++;
      addPlacement(schedule, choice.block, slot.day, slot.hour, teachers);

      const okay = forwardCheck(
        schedule,
        nextRemaining,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        random,
      );
      if (okay) {
        if (nextRemaining.length < bestRemaining.length) {
          bestRemaining = [...nextRemaining];
          bestSchedule = clone(schedule);
        }
        if (await recurse(nextRemaining)) return true;
      } else {
        stats.forwardPrunes++;
      }

      removeBlockPlacement(schedule, choice.block.blockId);
    }

    stats.backtracks++;
    return false;
  };

  await recurse(blocks);
  return { schedule: bestSchedule, unplaced: bestRemaining, stats };
}

function placedBlockIds(schedule: Record<string, any>): Set<string> {
  const ids = new Set<string>();
  for (const [key, raw] of Object.entries(schedule)) {
    if (!key.startsWith("class_")) continue;
    for (const item of toArray(raw)) if (item?.blockId) ids.add(String(item.blockId));
  }
  return ids;
}

function findConflictingSolverBlocks(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  day: string,
  hour: number,
  teachers: Teacher[],
): string[] {
  const conflicts = new Set<string>();

  for (let offset = 0; offset < block.duration; offset++) {
    const currentHour = hour + offset;
    for (const item of toArray(schedule[`class_${block.classId}_${day}_${currentHour}`])) {
      if (groupsConflict(block.groups, itemGroups(item)) && item?.blockId) conflicts.add(String(item.blockId));
    }

    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("class_") || !key.endsWith(`_${day}_${currentHour}`)) continue;
      for (const item of toArray(raw)) {
        if (!item?.blockId) continue;
        const keys = itemTeacherKeys(item, teachers);
        if (block.teacherKeys.some((teacherKey) => keys.includes(teacherKey))) {
          conflicts.add(String(item.blockId));
        }
      }
    }
  }

  return [...conflicts].filter((id) => id.startsWith("korayucar_"));
}

async function repairWithSmallNeighborhood(
  schedule: Record<string, any>,
  unplaced: KorayUcarBlock[],
  allBlocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  deadline: number,
  random: () => number,
  callbacks?: KorayUcarSolverCallbacks,
): Promise<{ schedule: Record<string, any>; unplaced: KorayUcarBlock[]; attempts: number }> {
  let working = clone(schedule);
  let pending = [...unplaced];
  let attempts = 0;
  const blockMap = new Map(allBlocks.map((block) => [block.blockId, block]));

  for (const target of [...pending]) {
    if (Date.now() >= deadline || callbacks?.shouldCancel?.()) break;

    const candidates: Slot[] = [];
    for (const day of days) {
      for (const hour of hours) {
        if (hour + target.duration - 1 > Math.max(...hours)) continue;
        const conflicts = findConflictingSolverBlocks(working, target, day, hour, teachers);
        if (conflicts.length > 0 && conflicts.length <= 2) {
          candidates.push({ day, hour, score: conflicts.length * 100 + random() });
        }
      }
    }
    candidates.sort((a, b) => a.score - b.score);

    for (const candidate of candidates.slice(0, 12)) {
      attempts++;
      const trial = clone(working);
      const conflictIds = findConflictingSolverBlocks(trial, target, candidate.day, candidate.hour, teachers);
      const displaced = conflictIds.map((id) => blockMap.get(id)).filter(Boolean) as KorayUcarBlock[];
      conflictIds.forEach((id) => removeBlockPlacement(trial, id));

      if (!slotHardValid(trial, target, candidate.day, candidate.hour, days, hours, teachers, unwantedTeacherDays)) continue;
      addPlacement(trial, target, candidate.day, candidate.hour, teachers);

      let repairFailed = false;
      for (const displacedBlock of displaced.sort((a, b) => b.difficulty - a.difficulty)) {
        const domain = domainForBlock(trial, displacedBlock, days, hours, teachers, unwantedTeacherDays, random);
        if (!domain.length) {
          repairFailed = true;
          break;
        }
        const slot = domain[0];
        addPlacement(trial, displacedBlock, slot.day, slot.hour, teachers);
      }

      if (!repairFailed) {
        working = trial;
        pending = pending.filter((block) => block.blockId !== target.blockId);
        break;
      }
    }
  }

  return { schedule: working, unplaced: pending, attempts };
}


interface KorayUcarDiagnostic {
  code: string;
  severity: "warning" | "error";
  message: string;
}

function courseIsCommon(course: any): boolean {
  const groups = normalizeGroups(course?.targetGroups?.length ? course.targetGroups : course?.groupName)
    .filter((group) => group !== "GENEL" && group !== "ORTAK");
  return groups.length === 0 || course?.isCommonElective === true || course?.type === "compulsory";
}

function buildFeasibilityDiagnostics(
  classrooms: Classroom[],
  teachers: Teacher[],
  settings: ScheduleConstraintSettings,
): KorayUcarDiagnostic[] {
  const diagnostics: KorayUcarDiagnostic[] = [];
  const days = settings.workDays?.length ? settings.workDays : getScheduleDays();
  const dailyCount = Math.max(1, Number(settings.dailyLessonCount) || getScheduleHours().length);
  const capacity = days.length * dailyCount;
  const teacherIds = new Set(
    (teachers as any[]).map((teacher) => String(teacher?.id || "")).filter(Boolean),
  );

  for (const classroom of classrooms as any[]) {
    const assigned = classroom.assignedCourses || [];
    let commonHours = 0;
    const groupHours = new Map<string, number>();

    for (const course of assigned) {
      const hours = getScheduleWeeklyHours(course);
      if (hours <= 0) {
        diagnostics.push({
          code: "invalid_hours",
          severity: "warning",
          message: `${classroom.name} / ${getScheduleCourseName(course)}: haftalık saat geçersiz; bu kayıt atlanabilir.`,
        });
        continue;
      }

      const groups = normalizeGroups(course?.targetGroups?.length ? course.targetGroups : course?.groupName)
        .filter((group) => group !== "GENEL" && group !== "ORTAK");

      if (courseIsCommon(course)) {
        commonHours += hours;
      } else {
        for (const group of groups) {
          groupHours.set(group, (groupHours.get(group) || 0) + hours);
        }
      }

      const teacherKeys = resolveTeacherIdentityKeys(course, teachers).filter(isMeaningfulTeacherKey);
      if (!teacherKeys.length) {
        diagnostics.push({
          code: "missing_teacher",
          severity: "warning",
          message: `${classroom.name} / ${getScheduleCourseName(course)}: öğretmen atanmamış. Motor diğer dersleri yine dağıtmaya devam eder.`,
        });
      }
      for (const key of teacherKeys.filter((value) => value.startsWith("ID:"))) {
        const id = key.slice(3);
        if (!teacherIds.has(id)) {
          diagnostics.push({
            code: "unknown_teacher",
            severity: "warning",
            message: `${classroom.name} / ${getScheduleCourseName(course)}: ${id} öğretmen kimliği bulunamadı.`,
          });
        }
      }
    }

    // Grup dersleri paralel olabileceği için SAY+EA+... saatlerini üst üste TOPLAMIYORUZ.
    // Sınıfın fiziksel haftalık ihtiyacı = ortak saatler + en yoğun grubun saatleri.
    const maxGroupHours = Math.max(0, ...groupHours.values());
    const physicalRequirement = commonHours + maxGroupHours;
    if (physicalRequirement > capacity) {
      diagnostics.push({
        code: "class_capacity",
        severity: "error",
        message: `${classroom.name}: paralel gruplar dikkate alındığında gereken ${physicalRequirement} saat, haftalık ${capacity} slot kapasitesini aşıyor.`,
      });
    }
  }

  return diagnostics;
}

function greedyConstruct(
  initialSchedule: Record<string, any>,
  blocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
): { schedule: Record<string, any>; unplaced: KorayUcarBlock[] } {
  const schedule = clone(initialSchedule);
  const remaining = [...blocks];
  const unplaced: KorayUcarBlock[] = [];

  while (remaining.length) {
    let bestIndex = -1;
    let bestDomain: Slot[] | null = null;
    let bestDifficulty = -Infinity;

    // MRV + difficulty: her turda şu an en sıkışık olanı seç.
    for (let index = 0; index < remaining.length; index++) {
      const block = remaining[index];
      const domain = domainForBlock(
        schedule,
        block,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        random,
      );
      if (
        bestDomain === null ||
        domain.length < bestDomain.length ||
        (domain.length === bestDomain.length && block.difficulty > bestDifficulty)
      ) {
        bestIndex = index;
        bestDomain = domain;
        bestDifficulty = block.difficulty;
      }
      if (domain.length === 0) break;
    }

    if (bestIndex < 0 || bestDomain === null) break;
    const [block] = remaining.splice(bestIndex, 1);

    if (!bestDomain.length) {
      // Greedy aşamada kilitlenen bloğu kenara al; bütün dağıtımı durdurma.
      unplaced.push(block);
      continue;
    }

    // En iyi birkaç aday arasından küçük random çeşitlilik: farklı restart'lar
    // aynı deterministik çıkmaza saplanmasın.
    const candidateCount = Math.min(4, bestDomain.length);
    const bias = random();
    const pickIndex = bias < 0.72 ? 0 : Math.floor(random() * candidateCount);
    const slot = bestDomain[pickIndex];
    addPlacement(schedule, block, slot.day, slot.hour, teachers);
  }

  return { schedule, unplaced: [...unplaced, ...remaining] };
}

function zeroDomainDiagnostics(
  schedule: Record<string, any>,
  blocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
): string[] {
  const messages: string[] = [];
  const random = seededRandom(424242);

  for (const block of blocks.slice(0, 20)) {
    const domain = domainForBlock(
      schedule,
      block,
      days,
      hours,
      teachers,
      unwantedTeacherDays,
      random,
    );
    if (domain.length > 0) continue;

    let classBlocked = 0;
    let teacherBlocked = 0;
    let rawCandidateCount = 0;

    for (const day of days) {
      for (const hour of hours) {
        if (hour + block.duration - 1 > Math.max(...hours)) continue;
        rawCandidateCount++;
        let classConflict = false;
        let teacherConflict = false;

        for (let offset = 0; offset < block.duration; offset++) {
          const currentHour = hour + offset;
          if (schedule[`blocked_class_${block.classId}_${day}_${currentHour}`]) classConflict = true;
          const classItems = toArray(schedule[`class_${block.classId}_${day}_${currentHour}`]);
          if (classItems.some((item) => groupsConflict(block.groups, itemGroups(item)))) {
            classConflict = true;
          }

          for (const teacherKey of block.teacherKeys) {
            if (
              isBlockedByManualKeys(schedule, teacherKey, day, currentHour) ||
              teacherUnavailable(teacherKey, day, currentHour, teachers, unwantedTeacherDays)
            ) {
              teacherConflict = true;
            }
          }
        }

        if (classConflict) classBlocked++;
        if (teacherConflict) teacherBlocked++;
      }
    }

    messages.push(
      `${block.className} / ${getScheduleCourseName(block.course)} (${block.duration} saatlik blok): ` +
        `uygun slot 0; aday ${rawCandidateCount}, sınıf/grup engeli ${classBlocked}, öğretmen/kapalı zaman engeli ${teacherBlocked}.`,
    );
  }

  return messages;
}


function blockNogoodKey(
  block: KorayUcarBlock,
  day: string,
  hour: number,
  neighborhoodTag = "",
): string {
  return `${block.blockId}@@${day}@@${hour}@@${neighborhoodTag}`;
}

function impactScore(
  schedule: Record<string, any>,
  block: KorayUcarBlock,
  slot: Slot,
  remaining: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
): number {
  // Least-constraining-value yaklaşımı:
  // Bu yerleştirmenin kalan en kritik bloklardan kaç domain seçeneği götürdüğünü yaklaşık ölç.
  const beforeSample = [...remaining]
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 10);

  const before = beforeSample.map((candidate) =>
    Math.min(
      12,
      domainForBlock(
        schedule,
        candidate,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        random,
      ).length,
    ),
  );

  addPlacement(schedule, block, slot.day, slot.hour, teachers);
  const after = beforeSample.map((candidate) =>
    Math.min(
      12,
      domainForBlock(
        schedule,
        candidate,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        random,
      ).length,
    ),
  );
  removeBlockPlacement(schedule, block.blockId);

  let loss = 0;
  for (let i = 0; i < before.length; i++) {
    loss += Math.max(0, before[i] - after[i]);
    if (before[i] > 0 && after[i] === 0) loss += 80;
  }
  return loss;
}

async function ejectionChainPlace(
  schedule: Record<string, any>,
  target: KorayUcarBlock,
  allBlocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  random: () => number,
  deadline: number,
  maxDepth: number,
  nogoods: Set<string>,
  visited: Set<string> = new Set(),
): Promise<boolean> {
  if (Date.now() >= deadline || maxDepth < 0) return false;
  if (visited.has(target.blockId)) return false;
  visited.add(target.blockId);

  const direct = domainForBlock(
    schedule,
    target,
    days,
    hours,
    teachers,
    unwantedTeacherDays,
    random,
  );
  for (const slot of direct.slice(0, 10)) {
    const ng = blockNogoodKey(target, slot.day, slot.hour, `D${maxDepth}`);
    if (nogoods.has(ng)) continue;
    addPlacement(schedule, target, slot.day, slot.hour, teachers);
    return true;
  }

  if (maxDepth === 0) {
    visited.delete(target.blockId);
    return false;
  }

  const blockMap = new Map(allBlocks.map((block) => [block.blockId, block]));
  const candidateMoves: Array<{ day: string; hour: number; conflicts: string[]; score: number }> = [];

  for (const day of days) {
    for (const hour of hours) {
      if (hour + target.duration - 1 > Math.max(...hours)) continue;

      const conflicts = findConflictingSolverBlocks(
        schedule,
        target,
        day,
        hour,
        teachers,
      ).filter((id) => id !== target.blockId);

      if (!conflicts.length || conflicts.length > 2) continue;
      candidateMoves.push({
        day,
        hour,
        conflicts,
        score: conflicts.length * 100 + slotScore(schedule, target, day, hour, teachers) + random(),
      });
    }
  }

  candidateMoves.sort((a, b) => a.score - b.score);

  for (const move of candidateMoves.slice(0, 18)) {
    if (Date.now() >= deadline) break;
    const ng = blockNogoodKey(target, move.day, move.hour, `E${maxDepth}`);
    if (nogoods.has(ng)) continue;

    const snapshot = clone(schedule);
    const displaced = move.conflicts
      .map((id) => blockMap.get(id))
      .filter(Boolean) as KorayUcarBlock[];

    move.conflicts.forEach((id) => removeBlockPlacement(schedule, id));

    if (
      !slotHardValid(
        schedule,
        target,
        move.day,
        move.hour,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
      )
    ) {
      Object.keys(schedule).forEach((key) => delete schedule[key]);
      Object.assign(schedule, snapshot);
      nogoods.add(ng);
      continue;
    }

    addPlacement(schedule, target, move.day, move.hour, teachers);

    let ok = true;
    for (const displacedBlock of displaced.sort((a, b) => b.difficulty - a.difficulty)) {
      if (
        !(await ejectionChainPlace(
          schedule,
          displacedBlock,
          allBlocks,
          days,
          hours,
          teachers,
          unwantedTeacherDays,
          random,
          deadline,
          maxDepth - 1,
          nogoods,
          new Set(visited),
        ))
      ) {
        ok = false;
        break;
      }
    }

    if (ok) {
      visited.delete(target.blockId);
      return true;
    }

    Object.keys(schedule).forEach((key) => delete schedule[key]);
    Object.assign(schedule, snapshot);
    nogoods.add(ng);
  }

  visited.delete(target.blockId);
  return false;
}

function neighborhoodBlockIds(
  schedule: Record<string, any>,
  unplaced: KorayUcarBlock[],
  allBlocks: KorayUcarBlock[],
  teachers: Teacher[],
  fraction: number,
  random: () => number,
  mode: "conflict" | "teacher" | "class" | "group" | "day" | "random" = "conflict",
  tabuUntil?: Map<string, number>,
  round = 0,
): Set<string> {
  const scores = new Map<string, number>();
  const unplacedTeachers = new Set(unplaced.flatMap((block) => block.teacherKeys));
  const unplacedClasses = new Set(unplaced.map((block) => block.classId));
  const unplacedGroups = new Set(unplaced.flatMap((block) => block.groups));

  // Day destroy için yerleşimlerden yoğun/problemli günü bul.
  const dayLoad = new Map<string, number>();
  if (mode === "day") {
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("class_")) continue;
      const parts = key.split("_");
      const day = parts[parts.length - 2];
      dayLoad.set(day, (dayLoad.get(day) || 0) + toArray(raw).length);
    }
  }
  const targetDay =
    mode === "day"
      ? [...dayLoad.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;

  for (const block of allBlocks) {
    if ((tabuUntil?.get(block.blockId) || 0) > round) {
      scores.set(block.blockId, -999999);
      continue;
    }

    let score = random() * 3;

    if (mode === "conflict") {
      if (unplacedClasses.has(block.classId)) score += 12;
      if (block.teacherKeys.some((key) => unplacedTeachers.has(key))) score += 16;
      if (block.groups.some((group) => unplacedGroups.has(group))) score += 5;
    } else if (mode === "teacher") {
      if (block.teacherKeys.some((key) => unplacedTeachers.has(key))) score += 30;
      score += block.teacherKeys.length * 2;
    } else if (mode === "class") {
      if (unplacedClasses.has(block.classId)) score += 30;
    } else if (mode === "group") {
      if (block.groups.some((group) => unplacedGroups.has(group))) score += 28;
    } else if (mode === "day" && targetDay) {
      // O gün yerleşmiş blokları önceliklendir.
      const placedOnTarget = Object.entries(schedule).some(([key, raw]) => {
        if (!key.startsWith(`class_${block.classId}_`) || !key.includes(`_${targetDay}_`)) return false;
        return toArray(raw).some((item) => item?.blockId === block.blockId);
      });
      if (placedOnTarget) score += 35;
    } else if (mode === "random") {
      score += random() * 40;
    }

    score += block.difficulty * 0.04;
    scores.set(block.blockId, score);
  }

  const placed = placedBlockIds(schedule);
  const candidates = allBlocks
    .filter((block) => placed.has(block.blockId))
    .sort((a, b) => (scores.get(b.blockId) || 0) - (scores.get(a.blockId) || 0));

  const count = Math.max(
    Math.min(8, candidates.length),
    Math.min(candidates.length, Math.ceil(candidates.length * fraction)),
  );

  return new Set(
    candidates
      .filter((block) => (scores.get(block.blockId) || 0) > -100000)
      .slice(0, count)
      .map((block) => block.blockId),
  );
}

async function runLargeNeighborhoodSearch(
  initialSchedule: Record<string, any>,
  initialUnplaced: KorayUcarBlock[],
  allBlocks: KorayUcarBlock[],
  days: string[],
  hours: number[],
  teachers: Teacher[],
  classrooms: Classroom[],
  unwantedTeacherDays: Record<string, string[]>,
  deadline: number,
  seed: number,
  callbacks?: KorayUcarSolverCallbacks,
): Promise<{
  schedule: Record<string, any>;
  unplaced: KorayUcarBlock[];
  rounds: number;
  improvedRounds: number;
  nodes: number;
}> {
  let bestSchedule = clone(initialSchedule);
  let bestUnplaced = [...initialUnplaced];
  let bestPenalty = calculateSchedulePenalty(
    bestSchedule,
    classrooms,
    teachers,
    unwantedTeacherDays,
  ).totalPenalty;

  let rounds = 0;
  let improvedRounds = 0;
  let nodes = 0;
  let stagnation = 0;
  const tabuUntil = new Map<string, number>();
  const destroyModes: Array<"conflict" | "teacher" | "class" | "group" | "day" | "random"> = [
    "conflict",
    "teacher",
    "class",
    "group",
    "day",
    "random",
  ];
  const modeRewards = new Map<string, number>(destroyModes.map((mode) => [mode, 1]));

  while (
    Date.now() < deadline &&
    bestUnplaced.length > 0 &&
    rounds < 18 &&
    stagnation < 6 &&
    !callbacks?.shouldCancel?.()
  ) {
    rounds++;
    const random = seededRandom(seed + rounds * 15485863);
    const fraction = 0.10 + Math.min(0.18, rounds * 0.012);

    // Adaptive destroy: başarılı stratejiler daha sık seçilir, ama tüm modlar denenmeye devam eder.
    const weightedModes = destroyModes.flatMap((mode) =>
      Array.from(
        { length: Math.max(1, Math.round(modeRewards.get(mode) || 1)) },
        () => mode,
      ),
    );
    const mode = weightedModes[Math.floor(random() * weightedModes.length)] || "conflict";

    const destroyIds = neighborhoodBlockIds(
      bestSchedule,
      bestUnplaced,
      allBlocks,
      teachers,
      fraction,
      random,
      mode,
      tabuUntil,
      rounds,
    );

    const trial = clone(bestSchedule);
    destroyIds.forEach((id) => removeBlockPlacement(trial, id));

    const destroyedBlocks = allBlocks.filter((block) => destroyIds.has(block.blockId));
    const repairPool = [...bestUnplaced, ...destroyedBlocks];

    // Aynı bloğu iki kez çözme.
    const uniquePool = Array.from(
      new Map(repairPool.map((block) => [block.blockId, block])).values(),
    );

    const remainingTime = Math.max(1500, deadline - Date.now());
    const search = await searchRestart(
      trial,
      uniquePool,
      days,
      hours,
      teachers,
      unwantedTeacherDays,
      Math.min(deadline, Date.now() + Math.min(12000, remainingTime)),
      Math.max(18000, Math.min(140000, remainingTime * 20)),
      random,
      callbacks,
    );
    nodes += search.stats.nodes;

    const penalty = calculateSchedulePenalty(
      search.schedule,
      classrooms,
      teachers,
      unwantedTeacherDays,
    ).totalPenalty;

    const better =
      search.unplaced.length < bestUnplaced.length ||
      (search.unplaced.length === bestUnplaced.length && penalty < bestPenalty);

    if (better) {
      bestSchedule = search.schedule;
      bestUnplaced = search.unplaced;
      bestPenalty = penalty;
      improvedRounds++;
      stagnation = 0;
      modeRewards.set(mode, Math.min(8, (modeRewards.get(mode) || 1) + 1.25));

      // Başarılı destroy edilen blokları kısa süre tabu yap; hemen eski döngüye dönmesin.
      for (const id of destroyIds) {
        tabuUntil.set(id, rounds + 2 + Math.floor(random() * 3));
      }
    } else {
      stagnation++;
      modeRewards.set(mode, Math.max(1, (modeRewards.get(mode) || 1) * 0.88));
    }

    callbacks?.onProgress?.(
      Math.min(97, 80 + rounds),
      bestUnplaced.length,
      bestUnplaced,
    );
  }

  return { schedule: bestSchedule, unplaced: bestUnplaced, rounds, improvedRounds, nodes };
}

function buildCpSatWarmStartHint(schedule: Record<string, any>): Array<{
  blockId: string;
  className: string;
  day: string;
  hour: number;
}> {
  const hints: Array<{ blockId: string; className: string; day: string; hour: number }> = [];
  const seen = new Set<string>();

  for (const [key, raw] of Object.entries(schedule)) {
    if (!key.startsWith("class_")) continue;
    const parts = key.split("_");
    const hour = Number(parts[parts.length - 1]);
    const day = parts[parts.length - 2];

    for (const item of toArray(raw)) {
      if (!item?.blockId || seen.has(item.blockId)) continue;
      seen.add(item.blockId);
      hints.push({
        blockId: String(item.blockId),
        className: String(item.className || ""),
        day,
        hour,
      });
    }
  }
  return hints;
}

export async function runKorayUcarEngine(
  config: KorayUcarSolverConfig,
  currentSchedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  courses: Course[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: KorayUcarSolverCallbacks,
): Promise<KorayUcarSolverResult> {
  const started = Date.now();
  const settings: ScheduleConstraintSettings = {
    ...loadConstraintSettings(),
    ...(config.constraintSettings || {}),
  };
  const days = settings.workDays?.length ? [...settings.workDays] : getScheduleDays();
  const dailyCount = Math.max(
    1,
    Math.min(16, Number(settings.dailyLessonCount) || getScheduleHours().length),
  );
  const hours = Array.from({ length: dailyCount }, (_, index) => index + 1);

  const initialPenalty = calculateSchedulePenalty(
    currentSchedule,
    classrooms,
    teachers,
    unwantedTeacherDays,
  ).totalPenalty;

  // V40'taki en önemli hata: preflight "uyarı" yüzünden bütün motoru durdurabiliyordu.
  // V41'de preflight TANISALDIR. Sadece gerçek arama modeli çözümün olup olmadığını belirler.
  const legacyPreflight = runSchedulePreflight(classrooms, teachers, settings);
  const diagnostics = buildFeasibilityDiagnostics(classrooms, teachers, settings);

  const baseSchedule = clone(currentSchedule || {});
  clearScopeAssignments(baseSchedule, config, classrooms, teachers);

  const blocks = buildBlocks(classrooms, teachers, config, days, hours);
  if (!blocks.length) {
    return {
      success: false,
      initialPenalty,
      finalPenalty: initialPenalty,
      durationMs: Date.now() - started,
      schedule: currentSchedule,
      unplacedBlocks: [],
      details:
        `${KORAY_UCAR_ENGINE_NAME}: Ders bloğu üretilemedi. ` +
        `assignedCourses / weeklyHours verisini kontrol edin. Ön kontrol: ` +
        diagnostics.slice(0, 8).map((item) => item.message).join(" | "),
      statistics: {
        engine: KORAY_UCAR_ENGINE_NAME,
        restartsTried: 0,
        nodesVisited: 0,
        backtracks: 0,
        forwardCheckPrunes: 0,
        repairAttempts: 0,
        bestPlacedBlocks: 0,
        totalBlocks: 0,
      },
    };
  }

  // Gerçek okul programı için 5 saniyelik erken vazgeçme yok.
  // Kullanıcı açıkça süre vermezse problem büyüklüğüne göre 60-150 sn bütçe.
  const timeLimitMs =
    config.timeLimitMs ||
    (blocks.length > 450
      ? 150000
      : blocks.length > 300
        ? 120000
        : blocks.length > 180
          ? 90000
          : 60000);

  const deadline = started + timeLimitMs;

  let bestSchedule = clone(baseSchedule);
  let bestUnplaced = [...blocks];
  let bestPenalty = Number.POSITIVE_INFINITY;

  let totalNodes = 0;
  let totalBacktracks = 0;
  let totalForwardPrunes = 0;
  let restartsTried = 0;
  let repairAttempts = 0;

  // ---------------------------------------------------------------------------
  // PHASE A — GREEDY PORTFOLIO
  // Hedef: birkaç saniyede mümkün olduğunca dolu bir başlangıç çözümü üretmek.
  // "Hiçbir blok yerleşmedi" durumunu önleyen ana fark budur.
  // ---------------------------------------------------------------------------
  const greedyRuns = Math.max(
    8,
    Math.min(28, config.restarts ? config.restarts * 2 : Math.ceil(blocks.length / 18)),
  );

  for (let run = 0; run < greedyRuns; run++) {
    if (Date.now() >= deadline || callbacks?.shouldCancel?.()) break;
    restartsTried++;

    const random = seededRandom(
      Number(settings.seed || 1729) + run * 104729 + blocks.length * 17,
    );

    const ordered = [...blocks].sort((a, b) => {
      const difficultyDiff = b.difficulty - a.difficulty;
      return Math.abs(difficultyDiff) > 0.001 ? difficultyDiff : random() - 0.5;
    });

    const greedy = greedyConstruct(
      baseSchedule,
      ordered,
      days,
      hours,
      teachers,
      unwantedTeacherDays,
      random,
    );

    const penalty = calculateSchedulePenalty(
      greedy.schedule,
      classrooms,
      teachers,
      unwantedTeacherDays,
    ).totalPenalty;

    if (
      greedy.unplaced.length < bestUnplaced.length ||
      (greedy.unplaced.length === bestUnplaced.length && penalty < bestPenalty)
    ) {
      bestSchedule = greedy.schedule;
      bestUnplaced = greedy.unplaced;
      bestPenalty = penalty;
    }

    callbacks?.onProgress?.(
      Math.min(35, 4 + Math.floor(((run + 1) / greedyRuns) * 31)),
      bestUnplaced.length,
      bestUnplaced,
    );

    if (!bestUnplaced.length) break;
  }

  // ---------------------------------------------------------------------------
  // PHASE B — RESIDUAL CSP/BACKTRACKING
  // Greedy'nin yerleştirdiğini koru, yalnız kalan blokları derin aramayla tamamla.
  // Bir tek dev arama ağacı yerine birkaç farklı seed denenir.
  // ---------------------------------------------------------------------------
  if (bestUnplaced.length && Date.now() < deadline && !callbacks?.shouldCancel?.()) {
    const residualRestarts = Math.max(3, Math.min(10, config.restarts || 6));

    for (let restart = 0; restart < residualRestarts; restart++) {
      if (Date.now() >= deadline || callbacks?.shouldCancel?.()) break;
      restartsTried++;

      const random = seededRandom(
        Number(settings.seed || 1729) + 500009 + restart * 65537,
      );
      const remainingBudget = Math.max(3000, deadline - Date.now());
      const nodeBudget = Math.max(
        12000,
        Math.min(
          config.maxNodesPerRestart || 90000,
          Math.floor(remainingBudget * 18),
        ),
      );

      const result = await searchRestart(
        bestSchedule,
        [...bestUnplaced].sort((a, b) => b.difficulty - a.difficulty),
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        deadline,
        nodeBudget,
        random,
        callbacks,
      );

      totalNodes += result.stats.nodes;
      totalBacktracks += result.stats.backtracks;
      totalForwardPrunes += result.stats.forwardPrunes;

      const penalty = calculateSchedulePenalty(
        result.schedule,
        classrooms,
        teachers,
        unwantedTeacherDays,
      ).totalPenalty;

      if (
        result.unplaced.length < bestUnplaced.length ||
        (result.unplaced.length === bestUnplaced.length && penalty < bestPenalty)
      ) {
        bestSchedule = result.schedule;
        bestUnplaced = result.unplaced;
        bestPenalty = penalty;
      }

      callbacks?.onProgress?.(
        Math.min(72, 38 + Math.floor(((restart + 1) / residualRestarts) * 34)),
        bestUnplaced.length,
        bestUnplaced,
      );

      if (!bestUnplaced.length) break;
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE C — ITERATIVE EJECTION / SMALL LNS
  // Birkaç kilit bloğu sökerek zincirleme yer değiştirme dene.
  // Tek sefer değil, iyileşme oldukça tekrar et.
  // ---------------------------------------------------------------------------
  if (bestUnplaced.length && Date.now() < deadline && !callbacks?.shouldCancel?.()) {
    let noImprovementRounds = 0;
    let round = 0;

    while (
      bestUnplaced.length &&
      Date.now() < deadline &&
      noImprovementRounds < 3 &&
      round < 10 &&
      !callbacks?.shouldCancel?.()
    ) {
      round++;
      const before = bestUnplaced.length;
      const random = seededRandom(
        Number(settings.seed || 1729) + 900001 + round * 8191,
      );

      const repair = await repairWithSmallNeighborhood(
        bestSchedule,
        bestUnplaced,
        blocks,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        deadline,
        random,
        callbacks,
      );

      repairAttempts += repair.attempts;
      bestSchedule = repair.schedule;
      bestUnplaced = repair.unplaced;

      if (bestUnplaced.length < before) noImprovementRounds = 0;
      else noImprovementRounds++;

      callbacks?.onProgress?.(
        Math.min(94, 74 + round * 2),
        bestUnplaced.length,
        bestUnplaced,
      );
    }
  }


  // ---------------------------------------------------------------------------
  // PHASE D — DEEP EJECTION CHAINS
  // İnsan eliyle yapılan "A'yı çıkar, B'yi taşı, C'yi kaydır, A'yı yerleştir"
  // zincirinin otomatik karşılığı. Derinlik kontrollü ve nogood hafızalıdır.
  // ---------------------------------------------------------------------------
  const nogoods = new Set<string>();
  let ejectionChains = 0;

  if (bestUnplaced.length && Date.now() < deadline && !callbacks?.shouldCancel?.()) {
    const random = seededRandom(Number(settings.seed || 1729) + 1700003);
    const orderedTargets = [...bestUnplaced].sort((a, b) => b.difficulty - a.difficulty);

    for (const target of orderedTargets) {
      if (Date.now() >= deadline || callbacks?.shouldCancel?.()) break;
      ejectionChains++;

      const trial = clone(bestSchedule);
      const placed = await ejectionChainPlace(
        trial,
        target,
        blocks,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
        random,
        deadline,
        4,
        nogoods,
      );

      if (placed) {
        const validationTrial = validateSchedule(trial, classrooms, teachers);
        if (validationTrial.valid) {
          bestSchedule = trial;
          bestUnplaced = bestUnplaced.filter((block) => block.blockId !== target.blockId);
        }
      }

      callbacks?.onProgress?.(
        Math.min(79, 70 + Math.floor((ejectionChains / Math.max(1, orderedTargets.length)) * 9)),
        bestUnplaced.length,
        bestUnplaced,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE E — TRUE LARGE NEIGHBORHOOD SEARCH
  // Problemli sınıf/öğretmen/grup çevresindeki %10-28'lik bölgeyi yıkıp yeniden çözer.
  // ---------------------------------------------------------------------------
  let lnsRounds = 0;
  let lnsImprovedRounds = 0;

  if (bestUnplaced.length && Date.now() < deadline && !callbacks?.shouldCancel?.()) {
    const lns = await runLargeNeighborhoodSearch(
      bestSchedule,
      bestUnplaced,
      blocks,
      days,
      hours,
      teachers,
      classrooms,
      unwantedTeacherDays,
      deadline,
      Number(settings.seed || 1729) + 2000003,
      callbacks,
    );
    bestSchedule = lns.schedule;
    bestUnplaced = lns.unplaced;
    lnsRounds = lns.rounds;
    lnsImprovedRounds = lns.improvedRounds;
    totalNodes += lns.nodes;
  }

  // CP-SAT entegrasyonu için candidate hint üret.
  // Mevcut Python CP-SAT servisi hint kabul edecek şekilde genişletildiğinde bu dizi
  // doğrudan model.AddHint(...) girişine dönüştürülebilir.
  const cpSatWarmStartHint = buildCpSatWarmStartHint(bestSchedule);

  const validation = validateSchedule(bestSchedule, classrooms, teachers);
  const finalPenalty = calculateSchedulePenalty(
    bestSchedule,
    classrooms,
    teachers,
    unwantedTeacherDays,
  ).totalPenalty;

  const success = bestUnplaced.length === 0 && validation.valid;

  const infeasibility = bestUnplaced.length
    ? analyzeInfeasibility(
        bestUnplaced as any,
        {},
        {
          schedule: bestSchedule,
          classrooms,
          teachers,
          unwantedTeacherDays,
          settings,
        },
      )
    : undefined;

  const placed = blocks.length - bestUnplaced.length;
  const zeroDomain = bestUnplaced.length
    ? zeroDomainDiagnostics(
        bestSchedule,
        bestUnplaced,
        days,
        hours,
        teachers,
        unwantedTeacherDays,
      )
    : [];

  const preflightWarnings = diagnostics
    .concat(
      legacyPreflight.issues.map((issue) => ({
        code: `legacy_${issue.code}`,
        severity: issue.severity,
        message: issue.message,
      })),
    )
    .slice(0, 12)
    .map((issue) => issue.message);

  const modeLabel = config.draftWithoutTeachers
    ? "ÖĞRETMENSİZ TASLAK — öğretmen çakışmaları kontrol edilmedi. "
    : "";

  const details = success
    ? `${modeLabel}${KORAY_UCAR_ENGINE_NAME} Portfolio: ${blocks.length}/${blocks.length} blok yerleştirildi. ` +
      `Greedy portfolio + residual CSP + iterative repair + derin ejection-chain + LNS tamamlandı.`
    : `${modeLabel}${KORAY_UCAR_ENGINE_NAME} Portfolio: ${placed}/${blocks.length} blok yerleştirildi; ` +
      `${bestUnplaced.length} blok kaldı. Motor erken vazgeçmedi. ` +
      `${zeroDomain.slice(0, 6).join(" | ")} ` +
      `${preflightWarnings.length ? "Tanı: " + preflightWarnings.join(" | ") : ""}`;

  const advancedSummary =
    ` LNS: ${lnsRounds} tur/${lnsImprovedRounds} iyileşme; ` +
    `ejection-chain: ${ejectionChains}; nogood: ${nogoods.size}; ` +
    `CP-SAT warm-start hint: ${cpSatWarmStartHint.length}.`;

  callbacks?.onProgress?.(100, bestUnplaced.length, bestUnplaced);

  return {
    success,
    initialPenalty,
    finalPenalty,
    durationMs: Date.now() - started,
    schedule: bestSchedule,
    unplacedBlocks: bestUnplaced,
    details: details + advancedSummary,
    statistics: {
      engine: KORAY_UCAR_ENGINE_NAME,
      restartsTried,
      nodesVisited: totalNodes,
      backtracks: totalBacktracks,
      forwardCheckPrunes: totalForwardPrunes,
      repairAttempts,
      lnsRounds,
      lnsImprovedRounds,
      ejectionChains,
      nogoodCount: nogoods.size,
      cpSatHintCount: cpSatWarmStartHint.length,
      bestPlacedBlocks: placed,
      totalBlocks: blocks.length,
    },
    infeasibility,
    cpSatWarmStartHint,
  };
}
