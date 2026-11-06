import type { Student } from "../../types";
import { Validator, type ValidationIssue } from "../../core/validation";

export class StudentValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "StudentValidationError";
  }
}

export function validateStudent(student: Student): ValidationIssue[] {
  const result = Validator.validate(student, [
    Validator.required<Student>("id", "Öğrenci numarası"),
    Validator.required<Student>("name", "Öğrenci adı soyadı"),
    (value) => {
      if (value.oob === undefined || value.oob === null || String(value.oob).trim() === "") return null;
      const score = Number(value.oob);
      return Number.isFinite(score) && score >= 0 && score <= 100
        ? null
        : { field: "oob", message: "OÖB 0 ile 100 arasında olmalıdır." };
    },
    (value) => !value.status || value.status === "Aktif" || value.status === "Pasif"
      ? null
      : { field: "status", message: "Öğrenci durumu Aktif veya Pasif olmalıdır." },
  ]);
  return result.issues;
}

export function assertValidStudent(student: Student): void {
  const issues = validateStudent(student);
  if (issues.length) throw new StudentValidationError(issues);
}
