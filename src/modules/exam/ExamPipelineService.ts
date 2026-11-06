import { BaseService } from "../../core/services";
import { examRepository, ExamRepository } from "./ExamRepository";
import { findCurrentUser, loadAccessState } from "../../lib/accessControl";
import { networkExamService } from "../network-exams";
import { EXAM_EVENTS } from "./examEvents";
import type { ExamRecord } from "./examTypes";
import { getQuestionCorrectAnswer } from "../../utils/questionAnswer";
import { examIntegrityService } from "./ExamIntegrityService";

export interface ExamStudentResult {
  recordId?: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  bookletType: string;
  score?: number;
  generalRank?: number;
  totals: { correct: number; wrong: number; empty: number; net: number };
  subjects: Array<{
    subjectName: string;
    correct: number;
    wrong: number;
    empty: number;
    net: number;
    totalQuestions: number;
    questions: Array<{
      qNum: number;
      originalIndex: number;
      studentAns: string;
      correctAns: string;
      isCorrect: boolean;
      isEmpty: boolean;
      unit: string;
      topic: string;
      outcome: string;
    }>;
  }>;
}

const normalizeBooklet = (value: unknown) => String(value || "A").trim().toUpperCase() || "A";

const normalizeAnswerChoice = (value: unknown) => {
  const answer = String(value || "").trim().toLocaleUpperCase("tr-TR");
  return ["A", "B", "C", "D", "E"].includes(answer) ? answer : "";
};

type LockedBookletQuestion = {
  printedNumber: number;
  answer: string;
  sourceIndex?: number;
};

const getLockedBookletQuestions = (exam: any, bookletKey: string, subjectName: string): LockedBookletQuestion[] => {
  const normalizedBooklet = normalizeBooklet(bookletKey);
  const lock = exam?.bookletLayoutLock;
  const rawBooklet = lock?.booklets?.[normalizedBooklet];
  if (!rawBooklet || !Array.isArray(rawBooklet?.pages)) return [];

  const normalizedSubject = String(subjectName || "").trim().toLocaleLowerCase("tr-TR");
  const rows: LockedBookletQuestion[] = [];

  rawBooklet.pages.forEach((page: any) => {
    const pageSubject = String(page?.testName || "").trim().toLocaleLowerCase("tr-TR");
    if (pageSubject !== normalizedSubject) return;
    const columns = Array.isArray(page?.columns) ? page.columns : [[], []];
    [0, 1].forEach((columnIndex) => {
      const column = Array.isArray(columns?.[columnIndex]) ? columns[columnIndex] : [];
      column.forEach((item: any) => {
        const printedNumber = Number(item?.number || 0);
        const answer = normalizeAnswerChoice(item?.answer);
        const sourceIndexRaw = Number(item?.sourceIndex);
        rows.push({
          printedNumber,
          answer,
          ...(Number.isInteger(sourceIndexRaw) && sourceIndexRaw >= 0 ? { sourceIndex: sourceIndexRaw } : {}),
        });
      });
    });
  });

  const hasUsableNumbers = rows.length > 0 && rows.every((row) => Number.isFinite(row.printedNumber) && row.printedNumber > 0);
  if (hasUsableNumbers) rows.sort((a, b) => a.printedNumber - b.printedNumber);
  return rows;
};

const getQuestionIndexForBooklet = (bookletName: string, i: number, count: number) => {
  const norm = normalizeBooklet(bookletName);
  if (norm === "B") return count - 1 - i;
  if (norm === "C") return (i + Math.floor(count / 2)) % count;
  if (norm === "D") return count - 1 - ((i + Math.floor(count / 3)) % count);
  return i;
};

const getPrintedQuestionIndex = (exam: any, bookletKey: string, targetNum1Based: number, subjectName: string, count: number) => {
  const normBookletKey = normalizeBooklet(bookletKey);
  const subjectQuestions = exam.questions?.[subjectName] || {};
  for (let originalIdx = 0; originalIdx < count; originalIdx++) {
    const q = subjectQuestions[originalIdx];
    const savedNum = q?.bookletNumbers?.[normBookletKey];
    if (savedNum !== undefined && savedNum !== null && savedNum !== "" && Number(savedNum) === targetNum1Based) {
      return originalIdx;
    }
  }
  return getQuestionIndexForBooklet(normBookletKey, targetNum1Based - 1, count);
};

const getAnswerForQuestion = (exam: any, subjectName: string, index: number) =>
  getQuestionCorrectAnswer(exam.questions?.[subjectName]?.[index]).toUpperCase();

const assertAnswerKeyComplete = (exam: any) => {
  const missing: string[] = [];
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
  structure.forEach((test: any) => (test.subjects || []).forEach((subject: any) => {
    const subjectName = String(subject.name || "");
    const count = Number(subject.count || 0);
    for (let index = 0; index < count; index++) {
      if (!getAnswerForQuestion(exam, subjectName, index)) missing.push(`${subjectName} ${index + 1}`);
    }
  }));
  if (missing.length > 0) {
    const preview = missing.slice(0, 8).join(", ");
    throw new Error(`Cevap anahtarı eksik. Değerlendirme durduruldu: ${preview}${missing.length > 8 ? ` ve ${missing.length - 8} soru daha` : ""}.`);
  }
};

export const normalizeAnswerStream = (answers: unknown, totalQuestionCount: number) =>
  String(answers || "")
    .toLocaleUpperCase("tr-TR")
    .split("")
    .map((ch) => ["A", "B", "C", "D", "E"].includes(ch) ? ch : "-")
    .join("")
    .padEnd(totalQuestionCount, "-")
    .slice(0, totalQuestionCount);

export const evaluateExamRecords = (exam: any): ExamStudentResult[] => {
  const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
  if (!exam || records.length === 0) return [];
  const structure = Array.isArray(exam.examStructure) ? exam.examStructure : [];
  const totalQuestionCount = structure.reduce((total: number, test: any) => total +
    (test.subjects || []).reduce((sum: number, subject: any) => sum + Number(subject.count || 0), 0), 0);

  return records.map((record: any) => {
    const bookletKey = normalizeBooklet(record.bookletType);
    const rawAnswers = normalizeAnswerStream(record.answers, totalQuestionCount);
    let currentIdx = 0;
    let totCorrect = 0, totWrong = 0, totEmpty = 0;
    const subjects: ExamStudentResult["subjects"] = [];

    structure.forEach((test: any) => (test.subjects || []).forEach((subj: any) => {
      const subjectName = String(subj.name || "");
      const count = Number(subj.count || 0);
      let correct = 0, wrong = 0, empty = 0;
      const questions: ExamStudentResult["subjects"][number]["questions"] = [];
      const lockedQuestions = getLockedBookletQuestions(exam, bookletKey, subjectName);
      for (let i = 0; i < count; i++) {
        const ansChar = rawAnswers[currentIdx + i] || "-";
        const lockedQuestion = lockedQuestions[i];
        const fallbackOriginalIdx = exam.examSource === "Basılı Yayın"
          ? getPrintedQuestionIndex(exam, bookletKey, i + 1, subjectName, count)
          : getQuestionIndexForBooklet(bookletKey, i, count);
        const originalIdx = Number.isInteger(lockedQuestion?.sourceIndex)
          ? Number(lockedQuestion.sourceIndex)
          : fallbackOriginalIdx;
        const q = exam.questions?.[subjectName]?.[originalIdx];
        const lockedAnswer = normalizeAnswerChoice(lockedQuestion?.answer);
        const correctAns = lockedAnswer || getAnswerForQuestion(exam, subjectName, originalIdx);
        const answerKeyValid = ["A", "B", "C", "D", "E"].includes(correctAns);
        // Eski veride cevap anahtarı eksikse soru raporlamada analiz dışıdır.
        // Öğrenci bu nedenle yanlış sayılmaz; güvenli biçimde boş kabul edilir.
        const isEmpty = ansChar === "-" || !answerKeyValid;
        const isCorrect = answerKeyValid && !isEmpty && ansChar === correctAns;
        if (isCorrect) correct++; else if (isEmpty) empty++; else wrong++;
        questions.push({
          qNum: i + 1, originalIndex: originalIdx, studentAns: isEmpty ? "-" : ansChar,
          correctAns, isCorrect, isEmpty,
          unit: q?.unit || "Belirtilmemiş", topic: q?.topic || "Konu Belirtilmemiş",
          outcome: q?.outcome || "Kazanım Belirtilmemiş",
        });
      }
      const net = correct - wrong * 0.25;
      subjects.push({ subjectName, correct, wrong, empty, net: Number(net.toFixed(2)), totalQuestions: count, questions });
      totCorrect += correct; totWrong += wrong; totEmpty += empty; currentIdx += count;
    }));

    return {
      recordId: record.id,
      studentNumber: (() => { const raw = String(record.studentNumber || "").trim(); if (!raw) return "N/A"; return raw.replace(/^0+/, "") || "0"; })(),
      studentName: record.studentName || "Bilinmeyen Öğrenci",
      classroom: (() => { const raw = String(record.gradeLevel || "").trim(); if (!raw) return "Sınıfsız"; return raw.replace(/^\-\s*/, "").replace(/(\d+)\s*([A-Za-z]+)/g, "$1-$2").replace(/\s+\-\s+/g, "-"); })(),
      bookletType: bookletKey,
      score: Number(record.score ?? record.puan ?? record.examScore ?? 0) || undefined,
      generalRank: record.generalRank ?? record.genelSiralama ?? record.genelSira ?? record.overallRank,
      totals: { correct: totCorrect, wrong: totWrong, empty: totEmpty, net: Number((totCorrect - totWrong * 0.25).toFixed(2)) },
      subjects,
    };
  });
};

export class ExamPipelineService extends BaseService<ExamRecord> {
  constructor(private readonly exams: ExamRepository = examRepository) { super(exams, "exam-pipeline"); }

  async listEvaluated(): Promise<ExamRecord[]> {
    return (await this.exams.findAll()).filter((exam: any) => {
      if (exam?.isEvaluated === true) return true;
      if (String(exam?.examStatus || "").toLocaleLowerCase("tr-TR") === "değerlendirildi") return true;

      // Deneme Kulübü elektronik optikleri öğrenci kaydettiği anda ham optik
      // kaydı oluşur. Bu sınavlar için ayrı bir yönetici "Değerlendir" adımı
      // beklenmez; Analiz Merkezi mevcut deterministik değerlendirme motoruyla
      // studentTxtRecords üzerinden sonucu anında üretir. Genel Sınav Analiz
      // ekranı Deneme Kulübü sınavlarını zaten examScope ile dışarıda bırakır.
      const participantGroup = String(exam?.participantGroup || "").trim().toLocaleLowerCase("tr-TR");
      const participantLabel = String(exam?.participantLabel || exam?.targetAudience || "").toLocaleLowerCase("tr-TR");
      const isTrialClub = participantGroup === "trial-club" || participantLabel.includes("deneme kulüb");
      const hasStudentRecords = Array.isArray(exam?.studentTxtRecords) && exam.studentTxtRecords.length > 0;
      return isTrialClub && hasStudentRecords;
    });
  }

  evaluate(exam: ExamRecord): ExamStudentResult[] { return evaluateExamRecords(exam); }

  async saveReadRecords(examId: string, records: any[], mode: "replace" | "append" = "replace"): Promise<ExamRecord> {
    const exams = await this.exams.findAll();
    const exam: any = exams.find((item) => String(item.id) === String(examId));
    if (!exam) throw new Error("Sınav bulunamadı.");
    const existing = Array.isArray(exam.studentTxtRecords) ? exam.studentTxtRecords : [];
    const nextRecords = mode === "append" ? [...existing, ...records] : [...records];
    const next = { ...exam, studentTxtRecords: nextRecords, updatedAt: new Date().toISOString() };
    await this.exams.save(next);
    await this.events.emit(EXAM_EVENTS.recordsSaved, { examId, count: nextRecords.length, mode });
    return next;
  }

  async markEvaluated(examId: string): Promise<ExamRecord> {
    const exams = await this.exams.findAll();
    const exam: any = exams.find((item) => String(item.id) === String(examId));
    if (!exam) throw new Error("Sınav bulunamadı.");
    assertAnswerKeyComplete(exam);
    const preIntegrity = examIntegrityService.assert(exam, "pre-evaluation");
    const results = evaluateExamRecords(exam);
    const candidate = { ...exam, evaluationResults: results };
    const postIntegrity = examIntegrityService.assert(candidate, "post-evaluation");
    const next = { ...exam, isEvaluated: true, examStatus: "Değerlendirildi", evaluationResults: results, integrityReport: postIntegrity, preEvaluationIntegrityReport: preIntegrity, evaluatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.exams.save(next);
    await this.events.emit(EXAM_EVENTS.evaluated, { examId, resultCount: results.length });

    // Sınav bir merkezi ortak sınava bağlandıysa değerlendirme tamamlandığında
    // okul sonucu ağ havuzuna kendiliğinden yeniden yayımlanır.
    const networkExamId = String((next as any).networkExamId || "").trim();
    if (networkExamId) {
      try {
        const accessState = loadAccessState();
        const currentUser = findCurrentUser(accessState);
        const school = accessState.schools.find((item) => item.id === currentUser?.schoolId);
        if (school) await networkExamService.publishExam(networkExamId, next, school);
      } catch (error) {
        console.warn("Ortak sınav ağına otomatik yayın yapılamadı; yerel değerlendirme korundu.", error);
      }
    }
    return next;
  }

  async returnToPreparation(examId: string): Promise<ExamRecord> {
    const exams = await this.exams.findAll();
    const exam: any = exams.find((item) => String(item.id) === String(examId));
    if (!exam) throw new Error("Sınav bulunamadı.");
    const next: any = JSON.parse(JSON.stringify(exam));
    next.isEvaluated = false;
    next.examStatus = next.questions && Object.keys(next.questions).length > 0 ? "Sorular Girildi" : "Hazırlanıyor";
    next.studentTxtRecords = [];
    next.updatedAt = new Date().toISOString();
    ["evaluationResults","analysisResults","rankedResults","reportResults","calculatedResults","studentResults","resultRecords","evaluationSummary","itemAnalysis","topicAnalysis","classroomAnalysis","subjectAnalysis","rankings","reports","generatedReports","evaluatedAt","evaluationDate","lastEvaluationAt","completedAt","resultPdfFiles","sentResultFiles","whatsappResults"].forEach((key) => delete next[key]);
    await this.exams.save(next);
    await this.events.emit(EXAM_EVENTS.returnedToPreparation, { examId });
    return next;
  }
}

export const examPipelineService = new ExamPipelineService();
