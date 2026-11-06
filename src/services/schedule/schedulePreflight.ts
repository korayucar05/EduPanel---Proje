import type { Classroom, Teacher } from "../../types";
import { getScheduleDays, getScheduleHours } from "./scheduleRules";
import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";
import { getCourseTargetGroups, getExplicitCourseStudentIds, getPhysicalClassIdentity, getScheduleCourseName, getScheduleWeeklyHours, getTeacherIdentityKeys, isCommonCourseForClass } from "./scheduleIdentity";

export interface SchedulePreflightIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface SchedulePreflightReport {
  ok: boolean;
  issues: SchedulePreflightIssue[];
  capacityPerClass: number;
}

export function runSchedulePreflight(classrooms: Classroom[], teachers: Teacher[], settings?: Partial<ScheduleConstraintSettings>): SchedulePreflightReport {
  const issues: SchedulePreflightIssue[] = [];
  const days = settings?.workDays?.length ? settings.workDays : getScheduleDays();
  const hours = settings?.dailyLessonCount ? Array.from({ length: settings.dailyLessonCount }, (_, index) => index + 1) : getScheduleHours();
  const capacityPerClass = days.length * hours.length;
  const teacherIds = new Set((teachers as any[]).map((teacher) => String(teacher?.id || "")).filter(Boolean));
  const teacherLoad = new Map<string, number>();
  const countedTeacherDemands = new Set<string>();
  const explicitStudentLoad = new Map<string, number>();
  const countedStudentDemands = new Set<string>();

  for (const classroom of classrooms as any[]) {
    const assigned = classroom?.assignedCourses || [];

    // Sınıfın üzerinde SAY/EA/SÖZ/DİL bulunması, bu derslerin otomatik olarak
    // birbirine paralel olduğu anlamına gelmez. Ancak kapasite hesabında farklı
    // hedef gruplara ait dersler aynı fiziksel saatte paralel çalışabileceği için
    // bütün grup saatlerini körlemesine toplamak da yanlıştır.
    //
    // Güvenli alt-sınır hesabı:
    //   ortak/genel saatler + en yüksek grup yükü
    //
    // Çoklu hedefli bir ders (örn. SAY+EA) her iki grubun yüküne de eklenir.
    let commonHours = 0;
    const groupHours = new Map<string, number>();

    for (const course of assigned) {
      const weeklyHours = getScheduleWeeklyHours(course);
      const targetGroups = getCourseTargetGroups(course);
      const normalizedGroups = targetGroups
        .map((group) => String(group || "").trim().toLocaleUpperCase("tr-TR"))
        .filter(Boolean);
      const studentIds = getExplicitCourseStudentIds(course);
      const isCommonCourse = isCommonCourseForClass(course);

      if (isCommonCourse) {
        commonHours += weeklyHours;
      } else if (normalizedGroups.length) {
        // Aynı ders birden fazla ayrık hedef gruba aitse her grubun yüküne eklenir;
        // fiziksel kapasitede ise aşağıda yalnız en yüksek grup yükü kullanılır.
        for (const group of new Set(normalizedGroups)) {
          groupHours.set(group, (groupHours.get(group) || 0) + weeklyHours);
        }
      } else if (studentIds.length) {
        // Etiketlenmemiş ama öğrenci tikleriyle kurulmuş paralel dersler de
        // bütün sınıf dersi sayılmaz. Her benzersiz öğrenci kümesi ayrı kanal
        // olarak yaklaşık kapasite hesabına girer.
        const audienceKey = `STUDENTS:${studentIds.join("-")}`;
        groupHours.set(audienceKey, (groupHours.get(audienceKey) || 0) + weeklyHours);
      }
    }

    const maxGroupHours = Math.max(0, ...groupHours.values());
    const physicalRequiredHours = commonHours + maxGroupHours;

    if (physicalRequiredHours > capacityPerClass) {
      issues.push({
        severity: "warning",
        code: "class_capacity_estimate",
        message:
          `${classroom.name}: ortak dersler ${commonHours} saat, en yüksek paralel grup yükü ${maxGroupHours} saat; ` +
          `toplam fiziksel ihtiyaç ${physicalRequiredHours} saat, haftalık kapasite ${capacityPerClass} saat.`,
      });
    }

    for (const course of assigned) {
      const weeklyHours = getScheduleWeeklyHours(course);
      if (weeklyHours <= 0) {
        issues.push({ severity: "error", code: "invalid_weekly_hours", message: `${classroom.name} / ${getScheduleCourseName(course)}: haftalık ders saati geçersiz.` });
      }
      const teacherKeys = getTeacherIdentityKeys(course);
      if (!teacherKeys.length) {
        issues.push({ severity: "warning", code: "missing_teacher", message: `${classroom.name} / ${getScheduleCourseName(course)}: öğretmen atanmamış.` });
      }

      const physicalClass = getPhysicalClassIdentity(classroom);
      const commonDemandKey = isCommonCourseForClass(course)
        ? `${physicalClass}::${String(getScheduleCourseName(course)).trim().toLocaleUpperCase("tr-TR")}::${weeklyHours}`
        : "";

      for (const key of teacherKeys) {
        if (key.startsWith("ID:")) {
          const id = key.slice(3);
          if (!teacherIds.has(id)) {
            issues.push({ severity: "warning", code: "unknown_teacher", message: `${classroom.name} / ${getScheduleCourseName(course)}: ${id} kimlikli öğretmen bulunamadı.` });
          }
        }

        // Aynı fiziksel sınıfın SAY/EA kopyalarında tekrarlanan ortak ders,
        // öğretmenin haftalık yükünde iki kez sayılmaz.
        const demandKey = commonDemandKey ? `${key}::${commonDemandKey}` : `${key}::${String(classroom.id)}::${getScheduleCourseName(course)}::${weeklyHours}::${getCourseTargetGroups(course).join("+")}`;
        if (!countedTeacherDemands.has(demandKey)) {
          countedTeacherDemands.add(demandKey);
          teacherLoad.set(key, (teacherLoad.get(key) || 0) + weeklyHours);
        }
      }

      const explicitStudents = getExplicitCourseStudentIds(course);
      if (explicitStudents.length) {
        const audienceSignature = explicitStudents.join("-");
        const physicalClass = getPhysicalClassIdentity(classroom);
        const courseSignature = String(getScheduleCourseName(course)).trim().toLocaleUpperCase("tr-TR");
        for (const studentId of explicitStudents) {
          const demandKey = `${studentId}::${physicalClass}::${courseSignature}::${weeklyHours}::${audienceSignature}`;
          if (countedStudentDemands.has(demandKey)) continue;
          countedStudentDemands.add(demandKey);
          explicitStudentLoad.set(studentId, (explicitStudentLoad.get(studentId) || 0) + weeklyHours);
        }
      }
    }
  }

  for (const [teacherKey, load] of teacherLoad) {
    if (load <= capacityPerClass) continue;
    const label = teacherKey.startsWith("ID:")
      ? String((teachers as any[]).find((teacher) => String(teacher?.id) === teacherKey.slice(3))?.name || teacherKey.slice(3))
      : teacherKey.replace(/^NAME:/, "");
    issues.push({
      severity: "error",
      code: "teacher_capacity",
      message: `${label}: haftalık ${load} ders saati atanmış, en fazla ${capacityPerClass} saat yerleştirilebilir.`,
    });
  }

  for (const [studentId, load] of explicitStudentLoad) {
    if (load <= capacityPerClass) continue;
    issues.push({
      severity: "error",
      code: "student_capacity",
      message: `${studentId} kimlikli öğrenci için öğrenci bazlı ders yükü ${load} saat; haftalık kapasite ${capacityPerClass} saat.`,
    });
  }

  return { ok: !issues.some((issue) => issue.severity === "error"), issues, capacityPerClass };
}
