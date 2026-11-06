import { BaseService } from "../../core/services";
import type { Student } from "../../types";
import { examRepository, ExamRepository } from "./ExamRepository";
import { EXAM_EVENTS } from "./examEvents";
import type { ExamRecord } from "./examTypes";

export type TxtImportMode = "replace" | "append";

export interface ExamReadRecord {
  id: string;
  studentNumber: string;
  studentName?: string;
  gradeLevel?: string;
  bookletType?: string;
  answers?: string;
  rawLine?: string;
  fieldValues?: Record<string, string>;
  opticTemplateName?: string;
  matchedSystemStudentId?: string;
  systemMatched?: boolean;
  [key: string]: unknown;
}

export interface ExamReadConflict {
  recordId: string;
  studentNumber: string;
  reasons: string[];
}

export interface ExamReadReconciliation {
  records: ExamReadRecord[];
  conflicts: ExamReadConflict[];
  matchedCount: number;
  unmatchedCount: number;
}

const normalizeTurkish = (value: unknown) => String(value || "")
  .toLocaleLowerCase("tr-TR")
  .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
  .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
  .trim();

export const normalizeStudentIdentity = (value: unknown) => {
  const compact = normalizeTurkish(value).replace(/[^a-z0-9]/g, "");
  if (!compact) return "";
  return /^\d+$/.test(compact) ? (compact.replace(/^0+/, "") || "0") : compact;
};

const studentNumberOf = (student: any) => String(
  student?.id ?? student?.studentNumber ?? student?.studentNo ?? student?.schoolNumber ??
  student?.schoolNo ?? student?.number ?? student?.okulNo ?? student?.no ?? "",
).trim();

const studentNameOf = (student: any) => String(
  student?.name || student?.fullName || [student?.firstName, student?.lastName].filter(Boolean).join(" ") || "",
).trim();

const studentClassOf = (student: any) => String(
  student?.classroom || student?.gradeLevel || student?.className ||
  [student?.grade, student?.section].filter(Boolean).join(" ") || "",
).trim();

const extractGradeAndSection = (value: unknown) => {
  const raw = String(value || "").trim();
  const gradeMatch = raw.match(/\b(9|10|11|12)\b/);
  const compact = normalizeTurkish(raw).replace(/[^a-z0-9]/g, "");
  const sectionMatch = compact.match(/(?:9|10|11|12)([a-z]+)/);
  return { grade: gradeMatch?.[1] || "", section: sectionMatch?.[1] || "" };
};

const examGradeOf = (exam: any) => {
  const raw = String(exam?.gradeLevel || "").trim();
  if (raw.toLocaleUpperCase("tr-TR") === "YKS") return "12";
  return raw.match(/\b(9|10|11|12)\b/)?.[1] || "";
};

const ensureRecordId = (record: ExamReadRecord, index: number): ExamReadRecord => ({
  ...record,
  id: String(record.id || `txt-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
  studentNumber: normalizeStudentIdentity(record.studentNumber),
  bookletType: String(record.bookletType || "").trim().toUpperCase(),
  answers: String(record.answers || "").trim().toUpperCase(),
});

export class ExamReadEditService extends BaseService<ExamRecord> {
  constructor(private readonly exams: ExamRepository = examRepository) {
    super(exams, "exam-read-edit");
  }

  reconcile(exam: ExamRecord, incoming: ExamReadRecord[], students: Student[]): ExamReadReconciliation {
    const studentMap = new Map<string, Student>();
    students.forEach((student) => {
      const key = normalizeStudentIdentity(studentNumberOf(student));
      if (key) studentMap.set(key, student);
    });

    const seen = new Set<string>();
    const conflicts: ExamReadConflict[] = [];
    let matchedCount = 0;

    const records = incoming.map((raw, index) => {
      const record = ensureRecordId(raw, index);
      const key = normalizeStudentIdentity(record.studentNumber);
      const reasons: string[] = [];
      const systemStudent = key ? studentMap.get(key) : undefined;

      if (!key) reasons.push("Öğrenci numarası boş.");
      if (key && seen.has(key)) reasons.push("TXT dosyasında aynı öğrenci numarası birden fazla kez bulunuyor.");
      if (key) seen.add(key);
      if (key && !systemStudent) reasons.push("Öğrenci numarası sistemde kayıtlı bir öğrenciyle eşleşmedi.");
      if (!String(record.bookletType || "").trim()) reasons.push("Kitapçık türü boş.");

      const enriched: ExamReadRecord = systemStudent ? {
        ...record,
        studentName: studentNameOf(systemStudent) || record.studentName || "",
        gradeLevel: studentClassOf(systemStudent) || record.gradeLevel || "",
        matchedSystemStudentId: studentNumberOf(systemStudent),
        systemMatched: true,
      } : { ...record, systemMatched: false };

      const examGrade = examGradeOf(exam);
      const recordClass = extractGradeAndSection(enriched.gradeLevel);
      const systemClass = systemStudent ? extractGradeAndSection(studentClassOf(systemStudent)) : { grade: "", section: "" };
      if (!String(enriched.studentName || "").trim()) reasons.push("Öğrenci adı soyadı boş.");
      if (!recordClass.grade || !recordClass.section) reasons.push("Sınıf düzeyi veya şube bilgisi eksik.");
      if (examGrade && recordClass.grade && examGrade !== recordClass.grade) reasons.push(`Sınav ${examGrade}. sınıf düzeyine ait; TXT kaydı ${recordClass.grade}. sınıf.`);
      if (systemStudent && recordClass.grade && systemClass.grade && recordClass.grade !== systemClass.grade) reasons.push("Sınıf düzeyi sistemdeki öğrenci kaydıyla uyuşmuyor.");
      if (systemStudent && recordClass.section && systemClass.section && recordClass.section !== systemClass.section) reasons.push("Şube bilgisi sistemdeki öğrenci kaydıyla uyuşmuyor.");

      if (systemStudent) matchedCount++;
      if (reasons.length) conflicts.push({ recordId: enriched.id, studentNumber: enriched.studentNumber, reasons });
      return enriched;
    });

    return { records, conflicts, matchedCount, unmatchedCount: records.length - matchedCount };
  }

  merge(current: ExamReadRecord[], incoming: ExamReadRecord[], mode: TxtImportMode): ExamReadRecord[] {
    if (mode === "replace") return incoming.slice();
    const merged = current.slice();
    incoming.forEach((record) => {
      const key = normalizeStudentIdentity(record.studentNumber);
      const index = key ? merged.findIndex((item) => normalizeStudentIdentity(item.studentNumber) === key) : -1;
      if (index >= 0) merged[index] = { ...merged[index], ...record, id: merged[index].id };
      else merged.push(record);
    });
    return merged;
  }

  async importRecords(examId: string, incoming: ExamReadRecord[], mode: TxtImportMode, students: Student[]): Promise<{ exam: ExamRecord; reconciliation: ExamReadReconciliation }> {
    const exams = await this.exams.findAll();
    const exam = exams.find((item) => String(item.id) === String(examId));
    if (!exam) throw new Error("Sınav bulunamadı.");

    const reconciliation = this.reconcile(exam, incoming, students);
    const current = Array.isArray((exam as any).studentTxtRecords) ? (exam as any).studentTxtRecords as ExamReadRecord[] : [];
    const nextRecords = this.merge(current, reconciliation.records, mode);
    const next: ExamRecord = { ...exam, studentTxtRecords: nextRecords, updatedAt: new Date().toISOString() };
    await this.exams.save(next);
    await this.events.emit(EXAM_EVENTS.recordsSaved, { examId, count: nextRecords.length, importedCount: incoming.length, conflictCount: reconciliation.conflicts.length, mode });
    return { exam: next, reconciliation: { ...reconciliation, records: nextRecords } };
  }

  async saveEditedRecords(examId: string, records: ExamReadRecord[], students: Student[]): Promise<{ exam: ExamRecord; reconciliation: ExamReadReconciliation }> {
    return this.importRecords(examId, records, "replace", students);
  }
}

export const examReadEditService = new ExamReadEditService();
