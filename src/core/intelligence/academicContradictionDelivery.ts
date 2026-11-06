import {
  fetchCollectionFromLocalDatabase,
  syncCollectionToLocalDatabase,
} from "../data/LegacyDatabaseFacade";
import { sqliteStorage } from "../state/SyncStateStore";

export const ACADEMIC_CONTRADICTION_COLLECTION = "student_academic_contradictions";

export type AcademicContradictionDeliveryRecord = {
  id: string;
  examId: string;
  examName: string;
  examDate?: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  area: "SAY" | "EA" | "SÖZ" | "DİL" | string;
  areaLabel: string;
  subject: string;
  severity: "attention" | "clear" | "sharp" | string;
  severityLabel: string;
  targetSuccess: number;
  typicalSuccess: number;
  institutionAverage: number;
  profileGap: number;
  relativeGap?: number;
  explanation: string;
  subjectResults: Array<{ subject: string; success: number; institutionAverage: number }>;
  courseTeacherIds: string[];
  courseTeacherNames: string[];
  mentorTeacherIds: string[];
  mentorTeacherNames: string[];
  createdAt: string;
  updatedAt: string;
};

const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

export const normalizePersonText = (value: unknown) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");

export async function readAcademicContradictionRecords(): Promise<AcademicContradictionDeliveryRecord[]> {
  try {
    const rows = await fetchCollectionFromLocalDatabase(ACADEMIC_CONTRADICTION_COLLECTION);
    if (Array.isArray(rows)) {
      try { sqliteStorage.setItem(ACADEMIC_CONTRADICTION_COLLECTION, JSON.stringify(rows)); } catch {}
      return rows as AcademicContradictionDeliveryRecord[];
    }
  } catch {
    // Yerel SQLite yedeğine geçilir.
  }
  try {
    return safeArray<AcademicContradictionDeliveryRecord>(
      JSON.parse(sqliteStorage.getItem(ACADEMIC_CONTRADICTION_COLLECTION) || "[]"),
    );
  } catch {
    return [];
  }
}

export async function replaceExamAcademicContradictions(
  examId: string,
  records: AcademicContradictionDeliveryRecord[],
) {
  const current = await readAcademicContradictionRecords();
  const next = [
    ...current.filter((row) => String(row?.examId || "") !== String(examId || "")),
    ...records,
  ];
  try {
    await syncCollectionToLocalDatabase(ACADEMIC_CONTRADICTION_COLLECTION, next);
  } finally {
    try { sqliteStorage.setItem(ACADEMIC_CONTRADICTION_COLLECTION, JSON.stringify(next)); } catch {}
  }
  return next;
}

export function contradictionRecordsForStudent(
  rows: AcademicContradictionDeliveryRecord[],
  studentId: unknown,
  studentNumber?: unknown,
) {
  const id = String(studentId || "").trim();
  const number = String(studentNumber || "").trim();
  return safeArray<AcademicContradictionDeliveryRecord>(rows)
    .filter((row) =>
      (id && String(row?.studentId || "").trim() === id)
      || (number && String(row?.studentNumber || "").trim() === number),
    )
    .sort((a, b) => {
      const bt = new Date(b?.examDate || b?.updatedAt || 0).getTime();
      const at = new Date(a?.examDate || a?.updatedAt || 0).getTime();
      return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0)
        || Number(b?.profileGap || 0) - Number(a?.profileGap || 0);
    });
}

export function contradictionRecordsForTeacher(
  rows: AcademicContradictionDeliveryRecord[],
  teacherId: unknown,
  teacherName: unknown,
  mode: "course" | "mentor",
) {
  const id = String(teacherId || "").trim();
  const name = normalizePersonText(teacherName);
  return safeArray<AcademicContradictionDeliveryRecord>(rows)
    .filter((row) => {
      const ids = mode === "course" ? row?.courseTeacherIds : row?.mentorTeacherIds;
      const names = mode === "course" ? row?.courseTeacherNames : row?.mentorTeacherNames;
      return Boolean(
        (id && safeArray<string>(ids).some((item) => String(item || "").trim() === id))
        || (name && safeArray<string>(names).some((item) => normalizePersonText(item) === name)),
      );
    })
    .sort((a, b) => {
      const severityRank: Record<string, number> = { sharp: 0, clear: 1, attention: 2 };
      return (severityRank[a?.severity] ?? 9) - (severityRank[b?.severity] ?? 9)
        || Number(b?.profileGap || 0) - Number(a?.profileGap || 0)
        || String(a?.studentName || "").localeCompare(String(b?.studentName || ""), "tr-TR");
    });
}
