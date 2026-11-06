import type { Teacher } from "../../types";
import { Validator, type ValidationIssue } from "../../core/validation";

export class TeacherValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "TeacherValidationError";
  }
}

export function validateTeacher(teacher: Teacher): ValidationIssue[] {
  const result = Validator.validate(teacher, [
    Validator.required<Teacher>("id", "Öğretmen kimliği"),
    Validator.required<Teacher>("name", "Öğretmen adı soyadı"),
    Validator.required<Teacher>("branch", "Branş"),
    Validator.required<Teacher>("phone", "İrtibat telefonu"),
    (value) => {
      const hours = Number(value.weeklyHours);
      return Number.isFinite(hours) && hours >= 0 && hours <= 60
        ? null
        : { field: "weeklyHours", message: "Haftalık ders yükü 0 ile 60 saat arasında olmalıdır." };
    },
    (value) => !value.status || value.status === "Aktif" || value.status === "İzinli"
      ? null
      : { field: "status", message: "Öğretmen durumu Aktif veya İzinli olmalıdır." },
  ]);
  return result.issues;
}

export function assertValidTeacher(teacher: Teacher): void {
  const issues = validateTeacher(teacher);
  if (issues.length) throw new TeacherValidationError(issues);
}
