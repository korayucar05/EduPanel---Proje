export type ConstraintReasonCode =
  | "OUT_OF_DAY"
  | "DAILY_COURSE_LIMIT"
  | "CLASS_BLOCKED"
  | "CLASS_GROUP_CONFLICT"
  | "TEACHER_BLOCKED"
  | "TEACHER_BUSY";

export interface ConstraintReason {
  code: ConstraintReasonCode;
  message: string;
  day?: string;
  hour?: number;
}

export interface ConstraintResult {
  valid: boolean;
  reasons: ConstraintReason[];
}

export function validResult(): ConstraintResult {
  return {
    valid: true,
    reasons: [],
  };
}

export function invalidResult(reason: ConstraintReason): ConstraintResult {
  return {
    valid: false,
    reasons: [reason],
  };
}

export function mergeConstraintResults(results: ConstraintResult[]): ConstraintResult {
  const reasons = results.flatMap((r) => r.reasons);

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function summarizeConstraintReasons(reasons: ConstraintReason[]): string {
  const counts: Record<string, number> = {};

  for (const reason of reasons) {
    counts[reason.message] = (counts[reason.message] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([message, count]) => `${message}: ${count}`)
    .join(", ");
}

export interface TeacherBusyCheckParams {
  schedule: Record<string, any>;
  teacherNames: string[];
  classId: string;
  day: string;
  hour: number;
}

export function checkTeacherBusy(
  params: TeacherBusyCheckParams
): ConstraintResult {

  const result = validResult();

  const { schedule, teacherNames, classId, day, hour } = params;

  for (const key of Object.keys(schedule)) {

    if (!key.startsWith("class_")) continue;

    const value = schedule[key];

    const lessons = Array.isArray(value) ? value : [value];

    for (const lesson of lessons) {

      if (!lesson) continue;

      if (lesson.classId === classId) continue;

      const lessonTeachers = [
        lesson.teacherName,
        lesson.teacherName2,
      ].filter(Boolean);

      const conflict =
        lessonTeachers.some(t => teacherNames.includes(t));

      if (conflict) {

        result.valid = false;

        result.reasons.push({
          code: "TEACHER_BUSY",
          message:
            `${lessonTeachers.join(", ")} öğretmeni ${day} ${hour}. saatte başka sınıfta.`,
          day,
          hour,
        });

      }

    }

  }

  return result;

}