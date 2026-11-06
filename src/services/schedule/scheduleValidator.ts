import type { Classroom, Teacher } from "../../types";
import type { ScheduleValidationIssue, ScheduleValidationResult } from "../../types/scheduleConstraints";
import { getScheduleDays, getScheduleHours } from "./scheduleRules";
import { coursesConflictInSameClass, getExplicitCourseStudentIds, resolveTeacherIdentityKeys } from "./scheduleIdentity";

const arr = (v: any) => !v ? [] : Array.isArray(v) ? v : [v];
const norm = (v: any) => String(v || "").trim().toLocaleUpperCase("tr-TR");

export function validateSchedule(schedule: Record<string, any>, classrooms: Classroom[], teachers: Teacher[]): ScheduleValidationResult {
  const errors: ScheduleValidationIssue[] = [];
  const warnings: ScheduleValidationIssue[] = [];
  const DAYS = getScheduleDays();
  const HOURS = getScheduleHours();
  for (const day of DAYS) for (const hour of HOURS) {
    const teacherUsage = new Map<string, { classes: string[]; label: string }>();
    const studentUsage = new Map<string, { blockIds: Set<string>; lessons: string[] }>();
    for (const cls of classrooms as any[]) {
      const items = arr(schedule[`class_${cls.id}_${day}_${hour}`]);
      for (const item of items) {
        for (const key of resolveTeacherIdentityKeys(item, teachers)) {
          const label = key.startsWith("ID:")
            ? String((teachers as any[]).find((teacher) => String(teacher.id) === key.slice(3))?.name || key.slice(3))
            : key.replace(/^NAME:/, "");
          const usage = teacherUsage.get(key) || { classes: [], label };
          usage.classes.push(cls.name);
          teacherUsage.set(key, usage);
        }

        const blockId = String(item?.blockId || `${cls.id}:${item?.courseName || item?.name || "Ders"}`);
        for (const studentId of getExplicitCourseStudentIds(item)) {
          const usage = studentUsage.get(studentId) || { blockIds: new Set<string>(), lessons: [] };
          usage.blockIds.add(blockId);
          usage.lessons.push(`${cls.name} / ${item?.courseName || item?.name || "Ders"}`);
          studentUsage.set(studentId, usage);
        }
      }
      if (items.length > 1) {
        let hasConflict = false;
        for (let i = 0; i < items.length && !hasConflict; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (coursesConflictInSameClass(items[i], items[j])) {
              hasConflict = true;
              break;
            }
          }
        }

        if (hasConflict) {
          errors.push({
            id: `class-${cls.id}-${day}-${hour}`,
            severity: "error",
            type: "class_conflict",
            message: `${cls.name} sınıfında aynı saatte hedef grupları çakışan dersler var.`,
            className: cls.name,
            day,
            hour,
          });
        }
      }
    }
    for (const [teacherKey, usage] of teacherUsage) if (new Set(usage.classes).size > 1) errors.push({ id:`teacher-${teacherKey}-${day}-${hour}`, severity:"error", type:"teacher_conflict", message:`${usage.label} aynı saatte ${[...new Set(usage.classes)].join(", ")} sınıflarında görünüyor.`, teacherName:usage.label, day, hour });
    for (const [studentId, usage] of studentUsage) {
      // Ortak dersin fiziksel sınıf kopyaları aynı blockId ile yazıldığı için
      // tek ders sayılır. Farklı iki blockId varsa öğrenci gerçekten çakışmıştır.
      if (usage.blockIds.size > 1) {
        errors.push({
          id: `student-${studentId}-${day}-${hour}`,
          severity: "error",
          type: "student_conflict",
          message: `${studentId} kimlikli öğrenci aynı saatte birden fazla derste görünüyor: ${[...new Set(usage.lessons)].join(", ")}.`,
          day,
          hour,
        });
      }
    }
  }
  for (const teacher of teachers as any[]) {
    if (!teacher.name) warnings.push({ id:`teacher-name-${teacher.id}`, severity:"warning", type:"data_quality", message:"İsimsiz öğretmen kaydı bulundu." });
  }
  return { valid: errors.length === 0, errors, warnings };
}
