import { sqliteStorage } from "../../lib/sqliteStorageBridge";
import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
import type { SchoolAccount } from "../../lib/accessControl";
import type {
  CommonExamDefinition,
  NetworkExamAnalyticsSnapshot,
  NetworkExamSubmission,
  NetworkSchoolRankingRow,
  NetworkStudentRankingRow,
  NetworkStudentResult,
  NetworkSubjectSchoolRankingRow,
} from "./types";

const EXAMS_KEY = "enstitu_common_exams_v1";
const SUBMISSIONS_KEY = "enstitu_common_exam_submissions_v1";

const safeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round2 = (value: number) => Number(value.toFixed(2));
const normalize = (value: unknown) => String(value ?? "").trim();

function readLocal<T>(key: string): T[] {
  try { return safeArray<T>(JSON.parse(sqliteStorage.getItem(key) || "[]")); }
  catch { return []; }
}
function writeLocal<T>(key: string, rows: T[]) {
  sqliteStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("enstitu-network-exam-changed", { detail: { key } }));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Merkezi sınav sunucusuna ulaşılamadı.");
  return data as T;
}

function examResultsToNetworkStudents(exam: any, school: SchoolAccount): NetworkStudentResult[] {
  const rows = safeArray<any>(exam?.evaluationResults);
  return rows.map((row) => {
    const subjects = safeArray<any>(row?.subjects).map((subject) => ({
      subjectName: normalize(subject?.subjectName || subject?.name || "Ders"),
      correct: Number(subject?.correct || 0),
      wrong: Number(subject?.wrong || 0),
      empty: Number(subject?.empty || 0),
      net: Number(subject?.net || 0),
      score: Number(subject?.score ?? Number(subject?.net || 0) * 4),
    }));
    const score = Number(row?.score ?? row?.puan ?? row?.examScore ?? Number(row?.totals?.net || 0) * 4);
    return {
      studentId: normalize(row?.studentId || row?.recordId || row?.studentNumber),
      studentNumber: normalize(row?.studentNumber),
      studentName: normalize(row?.studentName || "Öğrenci"),
      classroom: normalize(row?.classroom || row?.gradeLevel),
      schoolId: school.id,
      schoolName: school.name,
      net: Number(row?.totals?.net || 0),
      score: Number.isFinite(score) ? score : 0,
      subjects,
    };
  });
}

function buildSnapshot(exam: CommonExamDefinition, submissions: NetworkExamSubmission[]): NetworkExamAnalyticsSnapshot {
  const matching = submissions.filter((item) => item.commonExamId === exam.id);
  const allStudents = matching.flatMap((item) => item.students);
  const bySchool = new Map<string, NetworkStudentResult[]>();
  allStudents.forEach((student) => {
    const rows = bySchool.get(student.schoolId) || [];
    rows.push(student);
    bySchool.set(student.schoolId, rows);
  });

  const rankedStudents: NetworkStudentRankingRow[] = [...allStudents]
    .sort((a, b) => b.score - a.score || b.net - a.net || a.studentName.localeCompare(b.studentName, "tr"))
    .map((student, index, sorted) => {
      const schoolRows = sorted.filter((row) => row.schoolId === student.schoolId)
        .sort((a, b) => b.score - a.score || b.net - a.net || a.studentName.localeCompare(b.studentName, "tr"));
      return { ...student, networkRank: index + 1, schoolRank: schoolRows.findIndex((row) => row.studentId === student.studentId) + 1 };
    });

  const schools: NetworkSchoolRankingRow[] = [...bySchool.entries()].map(([schoolId, students]) => ({
    schoolId,
    schoolName: students[0]?.schoolName || schoolId,
    participantCount: students.length,
    averageNet: round2(average(students.map((student) => student.net))),
    averageScore: round2(average(students.map((student) => student.score))),
    rank: 0,
  })).sort((a, b) => b.averageScore - a.averageScore || b.averageNet - a.averageNet)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const subjectNames = Array.from(new Set(allStudents.flatMap((student) => student.subjects.map((subject) => subject.subjectName))));
  const subjects: NetworkSubjectSchoolRankingRow[] = [];
  subjectNames.forEach((subjectName) => {
    const networkSubjectResults = allStudents
      .map((student) => student.subjects.find((subject) => subject.subjectName === subjectName))
      .filter(Boolean) as NetworkStudentResult["subjects"];
    const networkAverageNet = round2(average(networkSubjectResults.map((result) => Number(result.net || 0))));
    const networkAverageScore = round2(average(networkSubjectResults.map((result) => Number(result.score ?? Number(result.net || 0) * 4))));
    const rows = [...bySchool.entries()].map(([schoolId, students]) => {
      const results = students.map((student) => student.subjects.find((subject) => subject.subjectName === subjectName)).filter(Boolean) as NetworkStudentResult["subjects"];
      return {
        subjectName,
        schoolId,
        schoolName: students[0]?.schoolName || schoolId,
        participantCount: results.length,
        averageNet: round2(average(results.map((result) => Number(result.net || 0)))),
        averageScore: round2(average(results.map((result) => Number(result.score ?? Number(result.net || 0) * 4)))),
        networkAverageNet,
        networkAverageScore,
        rank: 0,
      };
    }).filter((row) => row.participantCount > 0)
      .sort((a, b) => b.averageScore - a.averageScore || b.averageNet - a.averageNet)
      .map((row, index) => ({ ...row, rank: index + 1 }));
    subjects.push(...rows);
  });

  return {
    exam,
    schoolCount: bySchool.size,
    participantCount: allStudents.length,
    networkAverageNet: round2(average(allStudents.map((student) => student.net))),
    networkAverageScore: round2(average(allStudents.map((student) => student.score))),
    students: rankedStudents,
    schools,
    subjects,
    updatedAt: new Date().toISOString(),
  };
}

export const networkExamService = {
  async listExams(): Promise<CommonExamDefinition[]> {
    try {
      const data = await requestJson<{ exams: CommonExamDefinition[] }>("/api/network-exams", { cache: "no-store" });
      const exams = safeArray<CommonExamDefinition>(data.exams);
      writeLocal(EXAMS_KEY, exams);
      return exams;
    } catch {
      return readLocal<CommonExamDefinition>(EXAMS_KEY);
    }
  },

  async createExam(input: Omit<CommonExamDefinition, "id" | "createdAt" | "updatedAt">): Promise<CommonExamDefinition> {
    const now = new Date().toISOString();
    const exam: CommonExamDefinition = { ...input, id: `common-exam-${Date.now()}`, createdAt: now, updatedAt: now };
    try {
      const data = await requestJson<{ exam: CommonExamDefinition }>("/api/network-exams", { method: "POST", body: JSON.stringify(exam) });
      return data.exam;
    } catch {
      const exams = readLocal<CommonExamDefinition>(EXAMS_KEY).filter((item) => item.id !== exam.id);
      writeLocal(EXAMS_KEY, [...exams, exam]);
      return exam;
    }
  },

  async publishExam(commonExamId: string, localExam: any, school: SchoolAccount): Promise<NetworkExamSubmission> {
    const students = examResultsToNetworkStudents(localExam, school);
    if (!students.length) throw new Error("Bu sınav için değerlendirilmiş öğrenci sonucu bulunamadı.");
    const submission: NetworkExamSubmission = {
      id: `${commonExamId}:${school.id}`,
      commonExamId,
      schoolId: school.id,
      schoolName: school.name,
      localExamId: String(localExam?.id || ""),
      localExamName: normalize(localExam?.examName || localExam?.name || "Sınav"),
      publishedAt: new Date().toISOString(),
      students,
    };
    try {
      const data = await requestJson<{ submission: NetworkExamSubmission }>(`/api/network-exams/${encodeURIComponent(commonExamId)}/submissions`, { method: "POST", body: JSON.stringify(submission) });
      return data.submission;
    } catch {
      const rows = readLocal<NetworkExamSubmission>(SUBMISSIONS_KEY).filter((item) => item.id !== submission.id);
      writeLocal(SUBMISSIONS_KEY, [...rows, submission]);
      return submission;
    }
  },

  async analytics(commonExamId: string): Promise<NetworkExamAnalyticsSnapshot | null> {
    try {
      const data = await requestJson<{ analytics: NetworkExamAnalyticsSnapshot }>(`/api/network-exams/${encodeURIComponent(commonExamId)}/analytics`, { cache: "no-store" });
      return data.analytics;
    } catch {
      const exam = readLocal<CommonExamDefinition>(EXAMS_KEY).find((item) => item.id === commonExamId);
      if (!exam) return null;
      return buildSnapshot(exam, readLocal<NetworkExamSubmission>(SUBMISSIONS_KEY));
    }
  },

  localSnapshot(commonExamId: string): NetworkExamAnalyticsSnapshot | null {
    const exam = readLocal<CommonExamDefinition>(EXAMS_KEY).find((item) => item.id === commonExamId);
    return exam ? buildSnapshot(exam, readLocal<NetworkExamSubmission>(SUBMISSIONS_KEY)) : null;
  },
};
