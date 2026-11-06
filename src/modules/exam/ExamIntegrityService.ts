import { getQuestionCorrectAnswer } from '../../utils/questionAnswer';

export type ExamIntegritySeverity = 'error' | 'warning';

export interface ExamIntegrityIssue {
  code: string;
  severity: ExamIntegritySeverity;
  message: string;
  studentNumber?: string;
  subjectName?: string;
  questionNumber?: number;
}

export interface ExamIntegrityReport {
  ok: boolean;
  checkedAt: string;
  phase: 'pre-evaluation' | 'post-evaluation' | 'report';
  expectedQuestionCount: number;
  recordCount: number;
  resultCount: number;
  errors: ExamIntegrityIssue[];
  warnings: ExamIntegrityIssue[];
}

const normalizeStudentNumber = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? (raw.replace(/^0+/, '') || '0') : raw.toLocaleLowerCase('tr-TR');
};

const normalizeBooklet = (value: unknown) => String(value || '').trim().toUpperCase();

const structureSubjects = (exam: any) => (Array.isArray(exam?.examStructure) ? exam.examStructure : [])
  .flatMap((test: any) => Array.isArray(test?.subjects) ? test.subjects : []);

export const expectedQuestionCountOf = (exam: any) => structureSubjects(exam)
  .reduce((sum: number, subject: any) => sum + Math.max(0, Number(subject?.count || 0)), 0);

const push = (issues: ExamIntegrityIssue[], issue: ExamIntegrityIssue) => issues.push(issue);

export class ExamIntegrityService {
  check(exam: any, phase: ExamIntegrityReport['phase'] = 'pre-evaluation'): ExamIntegrityReport {
    const errors: ExamIntegrityIssue[] = [];
    const warnings: ExamIntegrityIssue[] = [];
    const subjects = structureSubjects(exam);
    const expectedQuestionCount = expectedQuestionCountOf(exam);
    const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
    const results = Array.isArray(exam?.evaluationResults) ? exam.evaluationResults : [];

    if (!exam?.id) push(errors, { code: 'EXAM_ID_MISSING', severity: 'error', message: 'Sınav kimliği bulunamadı.' });
    if (!subjects.length || expectedQuestionCount <= 0) push(errors, { code: 'QUESTION_STRUCTURE_EMPTY', severity: 'error', message: 'Sınav soru yapısı tanımlı değil veya soru sayısı 0.' });

    subjects.forEach((subject: any) => {
      const subjectName = String(subject?.name || '').trim() || 'Adsız ders';
      const count = Math.max(0, Number(subject?.count || 0));
      for (let i = 0; i < count; i++) {
        const answer = String(getQuestionCorrectAnswer(exam?.questions?.[subjectName]?.[i]) || '').trim().toUpperCase();
        if (!['A','B','C','D','E'].includes(answer)) {
          const issue = { code: 'ANSWER_KEY_MISSING', severity: phase === 'report' ? 'warning' : 'error', message: `${subjectName} ${i + 1}. sorunun doğru cevabı eksik veya geçersiz; raporda bu soru analiz dışı kabul edilir.`, subjectName, questionNumber: i + 1 } as ExamIntegrityIssue;
          push(phase === 'report' ? warnings : errors, issue);
        }
      }
    });

    if (phase === 'pre-evaluation' && records.length === 0) {
      push(errors, { code: 'READ_RECORDS_EMPTY', severity: 'error', message: 'Değerlendirilecek öğrenci/optik kaydı bulunamadı.' });
    }

    const seen = new Set<string>();
    records.forEach((record: any, index: number) => {
      const studentNumber = normalizeStudentNumber(record?.studentNumber);
      const answers = String(record?.answers || '').trim();
      const booklet = normalizeBooklet(record?.bookletType);
      if (!studentNumber) push(errors, { code: 'STUDENT_NUMBER_MISSING', severity: 'error', message: `${index + 1}. kayıtta öğrenci numarası boş.` });
      if (studentNumber && seen.has(studentNumber)) push(errors, { code: 'DUPLICATE_STUDENT', severity: 'error', message: `${studentNumber} numaralı öğrenci birden fazla optik kaydında bulunuyor.`, studentNumber });
      if (studentNumber) seen.add(studentNumber);
      if (!['A','B','C','D'].includes(booklet)) push(errors, { code: 'BOOKLET_INVALID', severity: 'error', message: `${studentNumber || index + 1} kaydında kitapçık türü geçersiz.`, studentNumber });
      if (expectedQuestionCount > 0 && answers.length !== expectedQuestionCount) {
        const issue = { code: 'ANSWER_LENGTH_MISMATCH', severity: phase === 'report' ? 'warning' : 'error', message: `${studentNumber || index + 1} kaydında cevap uzunluğu ${answers.length}; beklenen ${expectedQuestionCount}. Rapor açılır; eksik ham cevaplar boş kabul edilir.`, studentNumber } as ExamIntegrityIssue;
        push(phase === 'report' ? warnings : errors, issue);
      }
      if (record?.systemMatched === false) push(errors, { code: 'STUDENT_NOT_MATCHED', severity: 'error', message: `${studentNumber || index + 1} kaydı sistemdeki öğrenciyle eşleşmemiş.`, studentNumber });
      if (!String(record?.studentName || '').trim()) push(warnings, { code: 'STUDENT_NAME_MISSING', severity: 'warning', message: `${studentNumber || index + 1} kaydında öğrenci adı boş.`, studentNumber });
      if (!String(record?.gradeLevel || '').trim()) push(warnings, { code: 'CLASSROOM_MISSING', severity: 'warning', message: `${studentNumber || index + 1} kaydında sınıf/şube bilgisi boş.`, studentNumber });
    });

    if (phase !== 'pre-evaluation') {
      if (!results.length) push(errors, { code: 'EVALUATION_RESULTS_EMPTY', severity: 'error', message: 'Kayıtlı evaluationResults bulunamadı.' });
      if (records.length && results.length !== records.length) push(errors, { code: 'RESULT_COUNT_MISMATCH', severity: 'error', message: `Optik kayıt sayısı (${records.length}) ile değerlendirme sonucu sayısı (${results.length}) uyuşmuyor.` });
      const resultSeen = new Set<string>();
      results.forEach((result: any, index: number) => {
        const studentNumber = normalizeStudentNumber(result?.studentNumber);
        if (!studentNumber) push(errors, { code: 'RESULT_STUDENT_MISSING', severity: 'error', message: `${index + 1}. değerlendirme sonucunda öğrenci numarası yok.` });
        if (studentNumber && resultSeen.has(studentNumber)) push(errors, { code: 'DUPLICATE_RESULT', severity: 'error', message: `${studentNumber} için birden fazla değerlendirme sonucu var.`, studentNumber });
        if (studentNumber) resultSeen.add(studentNumber);
        const resultQuestions = (Array.isArray(result?.subjects) ? result.subjects : []).reduce((sum: number, s: any) => sum + (Array.isArray(s?.questions) ? s.questions.length : 0), 0);
        if (expectedQuestionCount > 0 && resultQuestions !== expectedQuestionCount) push(errors, { code: 'RESULT_QUESTION_COUNT_MISMATCH', severity: 'error', message: `${studentNumber || index + 1} sonucunda ${resultQuestions} soru var; beklenen ${expectedQuestionCount}.`, studentNumber });
        (Array.isArray(result?.subjects) ? result.subjects : []).forEach((subject: any) => {
          const c = Number(subject?.correct || 0), w = Number(subject?.wrong || 0), e = Number(subject?.empty || 0), total = Number(subject?.totalQuestions || 0);
          if (c + w + e !== total) push(errors, { code: 'SUBJECT_TOTAL_MISMATCH', severity: 'error', message: `${studentNumber || index + 1} - ${subject?.subjectName || 'Ders'} doğru/yanlış/boş toplamı soru sayısıyla uyuşmuyor.`, studentNumber, subjectName: subject?.subjectName });
          (Array.isArray(subject?.questions) ? subject.questions : []).forEach((q: any) => {
            const correctAns = String(q?.correctAns || '').toUpperCase();
            if (!['A','B','C','D','E'].includes(correctAns)) push(errors, { code: 'RESULT_CORRECT_ANSWER_INVALID', severity: 'error', message: `${studentNumber || index + 1} sonucunda kayıtlı doğru cevap geçersiz.`, studentNumber, subjectName: subject?.subjectName, questionNumber: q?.qNum });
            const expectedCorrect = !q?.isEmpty && String(q?.studentAns || '').toUpperCase() === correctAns;
            if (Boolean(q?.isCorrect) !== expectedCorrect) push(errors, { code: 'RESULT_CORRECTNESS_MISMATCH', severity: 'error', message: `${studentNumber || index + 1} - ${subject?.subjectName || 'Ders'} ${q?.qNum || '?'} değerlendirme bayrağı cevaplarla uyuşmuyor.`, studentNumber, subjectName: subject?.subjectName, questionNumber: q?.qNum });
          });
        });
      });
    }

    return { ok: errors.length === 0, checkedAt: new Date().toISOString(), phase, expectedQuestionCount, recordCount: records.length, resultCount: results.length, errors, warnings };
  }

  assert(exam: any, phase: ExamIntegrityReport['phase'] = 'pre-evaluation'): ExamIntegrityReport {
    const report = this.check(exam, phase);
    if (!report.ok) {
      const preview = report.errors.slice(0, 5).map((x) => x.message).join(' | ');
      throw new Error(`Sınav veri bütünlüğü kontrolü başarısız: ${preview}${report.errors.length > 5 ? ` | +${report.errors.length - 5} hata daha` : ''}`);
    }
    return report;
  }
}

export const examIntegrityService = new ExamIntegrityService();
