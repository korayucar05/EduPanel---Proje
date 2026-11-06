import type { Classroom } from "../../types";
import { Validator, type ValidationIssue } from "../../core/validation";

const ALLOWED_LEVELS = new Set(["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"]);

export class ClassroomValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "ClassroomValidationError";
  }
}

export function normalizeClassroomName(value: string): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/^[-\s]+/, "")
    .replace(/(\d+)\s*-?\s*([A-ZÇĞİÖŞÜ]+)/iu, "$1 - $2")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
}

export function validateClassroom(classroom: Classroom): ValidationIssue[] {
  const result = Validator.validate(classroom, [
    Validator.required<Classroom>("id", "Sınıf kimliği"),
    Validator.required<Classroom>("name", "Sınıf adı"),
    Validator.required<Classroom>("level", "Sınıf düzeyi"),
    (value) => ALLOWED_LEVELS.has(String(value.level || ""))
      ? null
      : { field: "level", message: "Sınıf düzeyi 9, 10, 11 veya 12. sınıf olmalıdır." },
    (value) => {
      const totalHours = (value.assignedCourses || []).reduce(
        (sum, course) => sum + (Number(course.weeklyHours) || 0),
        0,
      );
      return totalHours <= 80
        ? null
        : { field: "assignedCourses", message: `Bir sınıfa en fazla 80 saat ders atanabilir. Mevcut toplam: ${totalHours} saat.` };
    },
  ]);
  return result.issues;
}

export function assertValidClassroom(classroom: Classroom): void {
  const issues = validateClassroom(classroom);
  if (issues.length) throw new ClassroomValidationError(issues);
}
