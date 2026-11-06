import type { Classroom, Teacher } from "../../types";
import { validateSchedule } from "./scheduleValidator";
import { getScheduleDays, getScheduleHours } from "./scheduleRules";
import {
  getCourseTargetGroups,
  getScheduleCourseName,
  getScheduleWeeklyHours,
  normalizeScheduleText,
  resolveTeacherIdentityKeys,
} from "./scheduleIdentity";

export interface SmartFullValidation {
  valid: boolean;
  safe: boolean;
  hardErrors: string[];
  safetyErrors: string[];
  completenessErrors: string[];
}

const list = (value: any) => !value ? [] : Array.isArray(value) ? value : [value];

const courseKey = (course: any, teachers: Teacher[]) => {
  const groups = getCourseTargetGroups(course).join("+") || "GENEL";
  const teacherKeys = resolveTeacherIdentityKeys(course, teachers).sort().join("+");
  return `${normalizeScheduleText(getScheduleCourseName(course))}__${groups}__${teacherKeys}`;
};

export function validateSmartFullSchedule(
  schedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
): SmartFullValidation {
  const safetyErrors: string[] = [];
  const completenessErrors: string[] = [];
  const base = validateSchedule(schedule, classrooms, teachers);
  safetyErrors.push(...base.errors.map((issue) => issue.message));

  const days = getScheduleDays();
  const hours = getScheduleHours();

  for (const cls of classrooms as any[]) {
    const expected = new Map<string, number>();
    for (const course of cls.assignedCourses || []) {
      const key = courseKey(course, teachers);
      expected.set(key, (expected.get(key) || 0) + getScheduleWeeklyHours(course));
    }

    const actual = new Map<string, number>();
    for (const day of days) {
      for (const hour of hours) {
        const items = list(schedule[`class_${cls.id}_${day}_${hour}`]);
        for (const item of items) {
          const key = courseKey(item, teachers);
          actual.set(key, (actual.get(key) || 0) + 1);

          if (schedule[`blocked_class_${cls.id}_${day}_${hour}`]) {
            safetyErrors.push(`${cls.name}: ${day} ${hour}. saat sınıf dağıtıma kapalı olmasına rağmen ders yerleştirilmiş.`);
          }

          for (const teacherKey of resolveTeacherIdentityKeys(item, teachers)) {
            if (!teacherKey.startsWith("ID:")) continue;
            const teacherId = teacherKey.slice(3);
            if (schedule[`blocked_teacher_${teacherId}_${day}_${hour}`]) {
              const teacherName = (teachers as any[]).find((t) => String(t.id) === teacherId)?.name || teacherId;
              safetyErrors.push(`${teacherName}: ${day} ${hour}. saat kapalı olmasına rağmen ders yerleştirilmiş.`);
            }
          }
        }
      }
    }

    for (const [key, required] of expected) {
      const placed = actual.get(key) || 0;
      if (placed !== required) {
        const courseName = key.split("__")[0];
        completenessErrors.push(`${cls.name} / ${courseName}: ${required} saat gerekli, ${placed} saat yerleştirildi.`);
      }
    }
  }

  const uniqueSafety = [...new Set(safetyErrors)];
  const uniqueCompleteness = [...new Set(completenessErrors)];
  const hardErrors = [...uniqueSafety, ...uniqueCompleteness];
  return {
    valid: hardErrors.length === 0,
    safe: uniqueSafety.length === 0,
    hardErrors,
    safetyErrors: uniqueSafety,
    completenessErrors: uniqueCompleteness,
  };
}
