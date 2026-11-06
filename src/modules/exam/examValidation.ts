import type { ExamCalendarRecord, ExamRecord } from "./examTypes";

export class ExamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamValidationError";
  }
}

export function assertValidExam(exam: ExamRecord): void {
  // Legacy sınavlar farklı şemalardan gelebilir; çekirdekte zorunlu olan tek alan kalıcı kimliktir.
  if (!String(exam.id || "").trim()) throw new ExamValidationError("Sınav kimliği boş olamaz.");
}

export function assertValidExamCollection(exams: ExamRecord[]): void {
  const ids = new Set<string>();
  for (const exam of exams) {
    assertValidExam(exam);
    const id = String(exam.id).trim().toLocaleLowerCase("tr-TR");
    if (ids.has(id)) throw new ExamValidationError(`'${exam.id}' sınav kimliği birden fazla kez kayıtlı.`);
    ids.add(id);
  }
}

export function assertValidExamCalendar(calendar: ExamCalendarRecord): void {
  if (!String(calendar.id || "").trim()) throw new ExamValidationError("Sınav takvimi kimliği boş olamaz.");
  if (!String(calendar.selectedTerm || "").trim()) throw new ExamValidationError("Dönem bilgisi boş olamaz.");
  if (!String(calendar.selectedExamNo || "").trim()) throw new ExamValidationError("Sınav numarası boş olamaz.");
  if (!Array.isArray(calendar.computedDates)) throw new ExamValidationError("Sınav takvimi oturumları geçersiz.");
}
