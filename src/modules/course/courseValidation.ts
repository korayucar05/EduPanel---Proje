import type { Course } from "../../types";
import { Validator, type ValidationIssue } from "../../core/validation";

export class CourseValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "CourseValidationError";
  }
}

export function normalizeCourseName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCourseIdentity(value: string): string {
  return normalizeCourseName(value)
    .toLocaleUpperCase("tr-TR")
    .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/iu, "")
    .replace(/\s+/g, " ");
}

export function validateCourse(course: Course): ValidationIssue[] {
  const result = Validator.validate(course, [
    Validator.required<Course>("id", "Ders kimliği"),
    Validator.required<Course>("name", "Ders adı"),
    Validator.required<Course>("classroom", "Sınıf"),
    (value) => {
      const hours = Number(value.weeklyHours ?? 0);
      return Number.isFinite(hours) && hours >= 0 && hours <= 40
        ? null
        : { field: "weeklyHours", message: "Haftalık ders saati 0 ile 40 arasında olmalıdır." };
    },
    (value) => value.teacherId2 && value.teacherId && String(value.teacherId2) === String(value.teacherId)
      ? { field: "teacherId2", message: "Aynı öğretmen bir dersin 1. ve 2. öğretmeni olarak birlikte atanamaz." }
      : null,
  ]);
  return result.issues;
}

export function assertValidCourse(course: Course): void {
  const issues = validateCourse(course);
  if (issues.length) throw new CourseValidationError(issues);
}
