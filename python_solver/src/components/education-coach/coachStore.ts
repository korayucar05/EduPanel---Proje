import localforage from "localforage";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../../lib/localDatabase";
import { sqliteStorage } from "../../core/state/SyncStateStore";
import { getQuestionCorrectAnswer } from "../../utils/questionAnswer";

export type CoachTaskStatus = "planned" | "started" | "completed" | "could-not";

export type CoachTask = {
  id: string;
  title: string;
  subject: string;
  unit?: string;
  topic?: string;
  outcome?: string;
  questionCount?: number;
  plannedDate: string;
  dueDate?: string;
  status: CoachTaskStatus;
  failureReason?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type CoachMeeting = {
  id: string;
  date: string;
  previousWeek: string;
  strengths: string;
  challenges: string;
  priority: string;
  newGoal: string;
  motivation: number;
  nextMeetingDate?: string;
  coachName?: string;
  createdAt: string;
};

export type CoachMessage = {
  id: string;
  direction: "coach-to-student" | "student-to-coach";
  text: string;
  category?: "general" | "help" | "task" | "motivation";
  createdAt: string;
  readAt?: string;
};

export type CoachProfile = {
  id: string;
  studentId: string;
  schoolId?: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  targetUniversity?: string;
  targetDepartment?: string;
  targetExam?: string;
  shortTermGoal?: string;
  longTermGoal?: string;
  nextMeetingDate?: string;
  mobileToken: string;
  tasks: CoachTask[];
  meetings: CoachMeeting[];
  messages: CoachMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AcademicOutcomeStat = {
  key: string;
  subject: string;
  unit: string;
  topic: string;
  outcome: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
};

export type AcademicSubjectStat = {
  subject: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
};

export type AcademicTrendPoint = {
  examId: string;
  examName: string;
  date: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
};

export type AcademicSnapshot = {
  subjects: AcademicSubjectStat[];
  outcomes: AcademicOutcomeStat[];
  trend: AcademicTrendPoint[];
  totalQuestions: number;
  overallSuccess: number;
  strongestSubject?: AcademicSubjectStat;
  prioritySubject?: AcademicSubjectStat;
  priorityOutcomes: AcademicOutcomeStat[];
};

const COLLECTION = "education_coach_profiles";

export const normalizeCoachStudentNumber = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const withoutLeadingZeros = raw.replace(/^0+/, "");
  return withoutLeadingZeros || raw;
};

export const makeCoachId = (prefix = "coach") => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
};

export const makeCoachToken = () => makeCoachId("koc").replace(/^koc_/, "").slice(0, 28);

export const createCoachProfile = (student: any, schoolId = "school-main"): CoachProfile => {
  const now = new Date().toISOString();
  const studentNumber = normalizeCoachStudentNumber(
    student?.studentNumber ?? student?.number ?? student?.schoolNumber ?? student?.id,
  );
  return {
    id: String(student?.id || `student-${studentNumber}`),
    studentId: String(student?.id || `student-${studentNumber}`),
    schoolId,
    studentNumber,
    studentName: String(student?.name || student?.fullName || student?.studentName || "Öğrenci"),
    classroom: String(student?.classroom || student?.className || student?.gradeLevel || "Sınıf belirtilmemiş"),
    mobileToken: makeCoachToken(),
    tasks: [],
    meetings: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeProfile = (row: any): CoachProfile => ({
  id: String(row?.id || row?.studentId || makeCoachId("profile")),
  studentId: String(row?.studentId || row?.id || ""),
  schoolId: String(row?.schoolId || "school-main"),
  studentNumber: normalizeCoachStudentNumber(row?.studentNumber),
  studentName: String(row?.studentName || "Öğrenci"),
  classroom: String(row?.classroom || "Sınıf belirtilmemiş"),
  targetUniversity: String(row?.targetUniversity || ""),
  targetDepartment: String(row?.targetDepartment || ""),
  targetExam: String(row?.targetExam || ""),
  shortTermGoal: String(row?.shortTermGoal || ""),
  longTermGoal: String(row?.longTermGoal || ""),
  nextMeetingDate: String(row?.nextMeetingDate || ""),
  mobileToken: String(row?.mobileToken || makeCoachToken()),
  tasks: Array.isArray(row?.tasks) ? row.tasks : [],
  meetings: Array.isArray(row?.meetings) ? row.meetings : [],
  messages: Array.isArray(row?.messages) ? row.messages : [],
  createdAt: String(row?.createdAt || new Date().toISOString()),
  updatedAt: String(row?.updatedAt || new Date().toISOString()),
});

export async function loadCoachProfiles(): Promise<CoachProfile[]> {
  try {
    const rows = await fetchCollectionFromLocalDatabase(COLLECTION);
    return Array.isArray(rows) ? rows.map(normalizeProfile) : [];
  } catch {
    return [];
  }
}

export async function saveCoachProfile(profile: CoachProfile): Promise<CoachProfile> {
  const next = normalizeProfile({ ...profile, updatedAt: new Date().toISOString() });
  await upsertLocalDocument(COLLECTION, next.id, next);
  return next;
}

export async function loadCoachProfileByToken(token: string): Promise<CoachProfile | null> {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;
  const profiles = await loadCoachProfiles();
  return profiles.find((profile) => profile.mobileToken === normalizedToken) || null;
}

export async function readCoachExams(): Promise<any[]> {
  const indexed = await localforage.getItem<any[]>("exams").catch(() => null);
  if (Array.isArray(indexed) && indexed.length) return indexed;
  try {
    const raw = sqliteStorage.getItem("exams");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const bookletQuestionIndex = (booklet: string, index: number, count: number) => {
  const normalized = String(booklet || "A").trim().toUpperCase();
  if (normalized === "B") return count - 1 - index;
  if (normalized === "C") return (index + Math.floor(count / 2)) % count;
  if (normalized === "D") return count - 1 - ((index + Math.floor(count / 3)) % count);
  return index;
};

const printedQuestionIndex = (
  exam: any,
  booklet: string,
  questionNumber: number,
  subjectName: string,
  count: number,
) => {
  const normalized = String(booklet || "A").trim().toUpperCase();
  const subjectQuestions = exam?.questions?.[subjectName] || {};
  for (let index = 0; index < count; index += 1) {
    const savedNumber = subjectQuestions?.[index]?.bookletNumbers?.[normalized];
    if (savedNumber !== undefined && savedNumber !== null && Number(savedNumber) === questionNumber) return index;
  }
  return bookletQuestionIndex(normalized, questionNumber - 1, count);
};

const normalizeAnswers = (value: unknown, count: number) =>
  String(value || "")
    .toLocaleUpperCase("tr-TR")
    .split("")
    .map((letter) => (["A", "B", "C", "D", "E"].includes(letter) ? letter : "-"))
    .join("")
    .padEnd(count, "-")
    .slice(0, count);

const examDateValue = (exam: any) => {
  const raw = exam?.date || exam?.examDate || exam?.createdAt || exam?.updatedAt || "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function buildStudentAcademicSnapshot(exams: any[], studentNumber: string): AcademicSnapshot {
  const target = normalizeCoachStudentNumber(studentNumber);
  const subjectMap = new Map<string, AcademicSubjectStat>();
  const outcomeMap = new Map<string, AcademicOutcomeStat>();
  const trend: AcademicTrendPoint[] = [];

  (Array.isArray(exams) ? exams : [])
    .filter((exam) => exam?.isEvaluated && Array.isArray(exam?.studentTxtRecords))
    .sort((a, b) => examDateValue(a) - examDateValue(b))
    .forEach((exam) => {
      const records = (exam.studentTxtRecords || []).filter(
        (record: any) => normalizeCoachStudentNumber(record?.studentNumber) === target,
      );
      if (!records.length) return;
      const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
      const questionCount = structure.reduce(
        (total: number, test: any) =>
          total + (Array.isArray(test?.subjects) ? test.subjects : []).reduce(
            (subtotal: number, subject: any) => subtotal + Number(subject?.count || 0),
            0,
          ),
        0,
      );
      let examCorrect = 0;
      let examWrong = 0;
      let examEmpty = 0;

      records.forEach((record: any) => {
        const answers = normalizeAnswers(record?.answers, questionCount);
        let offset = 0;
        structure.forEach((test: any) => {
          (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
            const subjectName = String(subject?.name || "Ders belirtilmemiş");
            const count = Number(subject?.count || 0);
            const subjectCurrent = subjectMap.get(subjectName) || {
              subject: subjectName,
              correct: 0,
              wrong: 0,
              empty: 0,
              total: 0,
              success: 0,
            };
            for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
              const originalIndex = exam?.examSource === "Basılı Yayın"
                ? printedQuestionIndex(exam, record?.bookletType, questionIndex + 1, subjectName, count)
                : bookletQuestionIndex(record?.bookletType, questionIndex, count);
              const question = exam?.questions?.[subjectName]?.[originalIndex] || {};
              const correctAnswer = getQuestionCorrectAnswer(question);
              const studentAnswer = answers[offset + questionIndex] || "-";
              const isEmpty = studentAnswer === "-";
              const isCorrect = Boolean(correctAnswer) && !isEmpty && studentAnswer === correctAnswer;

              subjectCurrent.total += 1;
              if (isEmpty) {
                subjectCurrent.empty += 1;
                examEmpty += 1;
              } else if (isCorrect) {
                subjectCurrent.correct += 1;
                examCorrect += 1;
              } else {
                subjectCurrent.wrong += 1;
                examWrong += 1;
              }

              const unit = String(question?.unit || "Ünite belirtilmemiş");
              const topic = String(question?.topic || "Konu belirtilmemiş");
              const outcome = String(question?.outcome || "Kazanım belirtilmemiş");
              const outcomeKey = `${subjectName}|||${unit}|||${topic}|||${outcome}`;
              const outcomeCurrent = outcomeMap.get(outcomeKey) || {
                key: outcomeKey,
                subject: subjectName,
                unit,
                topic,
                outcome,
                correct: 0,
                wrong: 0,
                empty: 0,
                total: 0,
                success: 0,
              };
              outcomeCurrent.total += 1;
              if (isEmpty) outcomeCurrent.empty += 1;
              else if (isCorrect) outcomeCurrent.correct += 1;
              else outcomeCurrent.wrong += 1;
              outcomeMap.set(outcomeKey, outcomeCurrent);
            }
            subjectMap.set(subjectName, subjectCurrent);
            offset += count;
          });
        });
      });

      const examTotal = examCorrect + examWrong + examEmpty;
      trend.push({
        examId: String(exam?.id || makeCoachId("exam")),
        examName: String(exam?.name || exam?.examName || "Sınav"),
        date: String(exam?.date || exam?.examDate || exam?.createdAt || ""),
        correct: examCorrect,
        wrong: examWrong,
        empty: examEmpty,
        total: examTotal,
        success: examTotal ? Math.round((examCorrect / examTotal) * 100) : 0,
      });
    });

  const subjects = Array.from(subjectMap.values())
    .map((row) => ({ ...row, success: row.total ? Math.round((row.correct / row.total) * 100) : 0 }))
    .sort((a, b) => b.success - a.success || b.total - a.total);
  const outcomes = Array.from(outcomeMap.values())
    .map((row) => ({ ...row, success: row.total ? Math.round((row.correct / row.total) * 100) : 0 }))
    .sort((a, b) => a.success - b.success || b.total - a.total);
  const totalQuestions = subjects.reduce((sum, row) => sum + row.total, 0);
  const totalCorrect = subjects.reduce((sum, row) => sum + row.correct, 0);

  return {
    subjects,
    outcomes,
    trend,
    totalQuestions,
    overallSuccess: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    strongestSubject: subjects[0],
    prioritySubject: subjects.length ? [...subjects].sort((a, b) => a.success - b.success || b.total - a.total)[0] : undefined,
    priorityOutcomes: outcomes.filter((row) => row.total >= 1 && row.success < 60).slice(0, 8),
  };
}

export const coachTaskStatusLabel: Record<CoachTaskStatus, string> = {
  planned: "Planlandı",
  started: "Başladım",
  completed: "Tamamlandı",
  "could-not": "Yapamadım",
};
