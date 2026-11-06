import type { Classroom, Teacher } from "../../types";
import { getScheduleDays, getScheduleHours } from "./scheduleRules";
import { coursesConflictInSameClass, getCourseTargetGroups, getExplicitCourseStudentIds, isCommonCourseForClass, resolveTeacherIdentityKeys } from "./scheduleIdentity";
import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";

const asArray = (value: any): any[] => !value ? [] : Array.isArray(value) ? value : [value];
const norm = (value: any) => String(value || "").trim().toLocaleUpperCase("tr-TR");

export type InfeasibilitySeverity = "critical" | "warning" | "info";

export interface InfeasibilityReason {
  code: string;
  label: string;
  count: number;
  severity: InfeasibilitySeverity;
  detail: string;
}

export interface InfeasibilityItem {
  blockId: string;
  className: string;
  courseName: string;
  teacherNames: string[];
  duration: number;
  summary: string;
  reasons: string[];
  reasonDetails: InfeasibilityReason[];
  totalCandidateSlots: number;
  legalCandidateSlots: number;
  suggestedActions: string[];
}

export interface InfeasibilityContext {
  schedule?: Record<string, any>;
  classrooms?: Classroom[];
  teachers?: Teacher[];
  unwantedTeacherDays?: Record<string, string[]>;
  settings?: Partial<ScheduleConstraintSettings>;
}

function getTeacherNames(block: any): string[] {
  const course = block?.course || block;
  return [course?.teacherName, course?.teacherName2]
    .filter(Boolean)
    .map((value) => String(value).trim());
}

function addReason(target: Map<string, InfeasibilityReason>, reason: Omit<InfeasibilityReason, "count">) {
  const current = target.get(reason.code);
  if (current) current.count += 1;
  else target.set(reason.code, { ...reason, count: 1 });
}

function teacherBusyKind(schedule: Record<string, any>, classrooms: Classroom[], teachers: Teacher[], teacherName: string, day: string, hour: number, targetClassId: string): "locked" | "automatic" | false {
  const teacher = (teachers as any[]).find((item) => norm(item?.name) === norm(teacherName));
  const teacherKey = teacher ? `ID:${teacher.id}` : `NAME:${norm(teacherName)}`;
  let automatic = false;
  for (const classroom of classrooms as any[]) {
    if (String(classroom.id) === String(targetClassId)) continue;
    for (const item of asArray(schedule[`class_${classroom.id}_${day}_${hour}`])) {
      const keys = resolveTeacherIdentityKeys(item, teachers);
      if (!keys.includes(teacherKey)) continue;
      if (item?.isManual || item?.isLocked || !item?.blockId) return "locked";
      automatic = true;
    }
  }
  return automatic ? "automatic" : false;
}

function groupConflict(course: any, existing: any): boolean {
  return coursesConflictInSameClass(course, existing);
}

function studentBusy(
  schedule: Record<string, any>,
  classrooms: Classroom[],
  course: any,
  day: string,
  hour: number,
): boolean {
  const incoming = getExplicitCourseStudentIds(course);
  if (!incoming.length) return false;
  const incomingSet = new Set(incoming);

  for (const classroom of classrooms as any[]) {
    for (const existing of asArray(schedule[`class_${classroom.id}_${day}_${hour}`])) {
      const existingStudents = getExplicitCourseStudentIds(existing);
      if (existingStudents.some((studentId) => incomingSet.has(studentId))) return true;
    }
  }

  return false;
}

export function analyzeInfeasibility(
  unplacedBlocks: any[],
  diagnostics: Record<string, string[]> = {},
  context: InfeasibilityContext = {},
): InfeasibilityItem[] {
  const schedule = context.schedule || {};
  const classrooms = context.classrooms || [];
  const DAYS = getScheduleDays();
  const HOURS = getScheduleHours();
  const teachers = context.teachers || [];
  const unwantedTeacherDays = context.unwantedTeacherDays || {};
  const settings = context.settings || {};

  return (unplacedBlocks || []).map((block: any) => {
    const blockId = String(block?.id || block?.blockId || "unknown");
    const course = block?.course || block || {};
    const classId = String(block?.classId || "");
    const className = block?.className || (classrooms as any[]).find((item) => String(item.id) === classId)?.name || "Sınıf";
    const courseName = course?.courseName || course?.name || block?.courseName || "Ders";
    const teacherNames = getTeacherNames(block);
    const duration = Math.max(1, Number(block?.duration || 1));
    const reasonMap = new Map<string, InfeasibilityReason>();
    let totalCandidateSlots = 0;
    let legalCandidateSlots = 0;

    if (!teacherNames.length) {
      addReason(reasonMap, {
        code: "missing_teacher",
        label: "Öğretmen ataması eksik",
        severity: "critical",
        detail: "Ders için geçerli bir öğretmen tanımlanmamış.",
      });
    }

    const capacity = DAYS.length * HOURS.length;
    const classroom = (classrooms as any[]).find((item) => String(item.id) === classId);

    let commonHours = 0;
    const groupHours = new Map<string, number>();
    for (const assignedCourse of classroom?.assignedCourses || []) {
      const weeklyHours = Number(assignedCourse?.weeklyHours || 0);
      const groups = getCourseTargetGroups(assignedCourse);
      const studentIds = getExplicitCourseStudentIds(assignedCourse);
      if (isCommonCourseForClass(assignedCourse)) {
        commonHours += weeklyHours;
      } else if (groups.length) {
        for (const group of groups) {
          groupHours.set(group, (groupHours.get(group) || 0) + weeklyHours);
        }
      } else if (studentIds.length) {
        const audienceKey = `STUDENTS:${studentIds.join("-")}`;
        groupHours.set(audienceKey, (groupHours.get(audienceKey) || 0) + weeklyHours);
      }
    }

    const physicalWeeklyTotal = commonHours + Math.max(0, ...groupHours.values());
    if (physicalWeeklyTotal > capacity) {
      addReason(reasonMap, {
        code: "class_capacity",
        label: "Sınıf haftalık kapasitesi aşılıyor",
        severity: "critical",
        detail:
          `${className} için hedef gruplar dikkate alındığında ${physicalWeeklyTotal} fiziksel saat gerekiyor, ` +
          `kapasite ${capacity} saat.`,
      });
    }

    for (const day of DAYS) {
      for (let startHour = 1; startHour <= HOURS.length - duration + 1; startHour++) {
        totalCandidateSlots += 1;
        let legal = true;
        const slotReasons = new Set<string>();

        for (let offset = 0; offset < duration; offset++) {
          const hour = startHour + offset;
          if (schedule[`blocked_class_${classId}_${day}_${hour}`]) {
            legal = false;
            slotReasons.add("blocked_class");
          }

          const existingItems = asArray(schedule[`class_${classId}_${day}_${hour}`]);
          if (existingItems.some((existing) => groupConflict(course, existing))) {
            legal = false;
            slotReasons.add("class_or_group_conflict");
          }

          if (studentBusy(schedule, classrooms, course, day, hour)) {
            legal = false;
            slotReasons.add("student_conflict");
          }

          for (const teacherName of teacherNames) {
            const teacher = (teachers as any[]).find((item) => norm(item?.name) === norm(teacherName));
            if (teacher && schedule[`blocked_teacher_${teacher.id}_${day}_${hour}`]) {
              legal = false;
              slotReasons.add("blocked_teacher");
            }
            if (teacher && (unwantedTeacherDays[String(teacher.id)] || []).includes(day)) {
              if (settings.unwantedTeacherDayHard) {
                legal = false;
                slotReasons.add("unwanted_day");
              }
            }
            const busyKind = teacherBusyKind(schedule, classrooms, teachers, teacherName, day, hour, classId);
            if (busyKind) {
              legal = false;
              slotReasons.add(busyKind === "locked" ? "teacher_locked_conflict" : "teacher_auto_conflict");
            }
          }
        }

        if (legal) legalCandidateSlots += 1;
        for (const code of slotReasons) {
          const definitions: Record<string, Omit<InfeasibilityReason, "count">> = {
            blocked_class: { code, label: "Sınıf kapalı saatleri", severity: "warning", detail: "Sınıfın dağıtıma kapalı saatleri uygun alanları azaltıyor." },
            class_or_group_conflict: { code, label: "Sınıf / grup çakışması", severity: "critical", detail: "Aynı sınıf veya seçmeli grup aynı saatlerde başka derslerle çakışıyor." },
            blocked_teacher: { code, label: "Öğretmen kapalı saatleri", severity: "warning", detail: "Öğretmenin kapalı saatleri uygun domaini daraltıyor." },
            unwanted_day: { code, label: "İstenmeyen gün hard constraint", severity: "warning", detail: "Öğretmenin istemediği günler kesin kural olarak uygulanıyor." },
            teacher_locked_conflict: { code, label: "Öğretmenin sabit dersi var", severity: "critical", detail: "Aday saatlerde öğretmenin başka sınıfta manuel veya kilitli dersi bulunuyor; otomatik onarım bu kaydı taşımaz." },
            teacher_auto_conflict: { code, label: "Öğretmenin taşınabilir otomatik dersi var", severity: "warning", detail: "Aday saatlerde öğretmenin başka sınıfta otomatik yerleştirilmiş dersi var; ejection-chain onarımı bu blokları yeniden konumlandırmayı deneyebilir." },
            student_conflict: { code, label: "Öğrenci çakışması", severity: "critical", detail: "Öğrenci bazlı ders atamalarında aynı öğrenci aday saatte başka derste görünüyor." },
          };
          addReason(reasonMap, definitions[code]);
        }
      }
    }

    for (const reason of diagnostics[blockId] || []) {
      addReason(reasonMap, { code: `diagnostic_${reason}`, label: reason, severity: "info", detail: reason });
    }

    if (duration > 1 && totalCandidateSlots > 0 && legalCandidateSlots === 0) {
      addReason(reasonMap, {
        code: "no_consecutive_slot",
        label: "Ardışık blok alanı yok",
        severity: "critical",
        detail: `${duration} saatlik blok için kesintisiz boş alan bulunamadı.`,
      });
    }

    if (!reasonMap.size) {
      addReason(reasonMap, {
        code: "search_limit",
        label: "Arama süresi / düğüm sınırı",
        severity: "info",
        detail: "Domain mevcut olabilir; solver süre veya düğüm sınırında durmuş olabilir.",
      });
    }

    const reasonDetails = [...reasonMap.values()].sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 } as const;
      return order[a.severity] - order[b.severity] || b.count - a.count;
    });
    const reasons = reasonDetails.map((reason) => `${reason.label} (${reason.count})`);
    const suggestedActions: string[] = [];
    if (reasonMap.has("missing_teacher")) suggestedActions.push("Derse öğretmen atayın veya branş eşleşmesini düzeltin.");
    if (reasonMap.has("class_capacity")) suggestedActions.push("Sınıfın haftalık ders toplamını 40 saatin altına indirin.");
    if (reasonMap.has("blocked_teacher") || reasonMap.has("blocked_class")) suggestedActions.push("Kapalı saatlerden bazılarını açın veya bloğu küçültün.");
    if (reasonMap.has("unwanted_day")) suggestedActions.push("İstenmeyen günü soft constraint yapmayı değerlendirin.");
    if (reasonMap.has("teacher_locked_conflict")) suggestedActions.push("Öğretmenin diğer sınıflardaki kilitli/manüel atamalarını kontrol edin; gerekirse kilidi açın veya saati değiştirin.");
    if (reasonMap.has("teacher_auto_conflict")) suggestedActions.push("Bu engel otomatik dersten kaynaklanıyor; Akıllı Onarım diğer sınıftaki otomatik blokları taşıyarak yeniden deneyecek.");
    if (reasonMap.has("student_conflict")) suggestedActions.push("Öğrenci bazlı ders tiklerini ve ortaklaştırılan sınıf/grup üyeliklerini kontrol edin.");
    if (reasonMap.has("no_consecutive_slot")) suggestedActions.push(`${duration} saatlik blok otomatik kurtarma turunda 1 saatlik parçalara ayrılabilir; strictBlocks açıksa blok kuralını gevşetin.`);
    if (reasonMap.has("search_limit")) suggestedActions.push("Backtracking süre ve düğüm sınırını artırın; aynı seed ile tekrar deneyin.");

    return {
      blockId,
      className,
      courseName,
      teacherNames,
      duration,
      summary: legalCandidateSlots === 0
        ? `Mevcut kısmi programda incelenen ${totalCandidateSlots} adayın hiçbiri doğrudan boş değil.`
        : `${legalCandidateSlots}/${totalCandidateSlots} yasal aday var; arama sınırı veya küresel çakışmalar çözümü engellemiş olabilir.`,
      reasons,
      reasonDetails,
      totalCandidateSlots,
      legalCandidateSlots,
      suggestedActions: [...new Set(suggestedActions)],
    };
  });
}

export function summarizeInfeasibility(items: InfeasibilityItem[]) {
  const reasonTotals = new Map<string, number>();
  items.forEach((item) => item.reasonDetails.forEach((reason) => reasonTotals.set(reason.label, (reasonTotals.get(reason.label) || 0) + reason.count)));
  return {
    totalBlocks: items.length,
    zeroDomainBlocks: items.filter((item) => item.legalCandidateSlots === 0).length,
    topReasons: [...reasonTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count })),
  };
}
