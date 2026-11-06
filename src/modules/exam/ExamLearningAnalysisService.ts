import type { ExamStudentResult } from './ExamPipelineService';
import { examAnalysisService } from './ExamAnalysisService';

export interface LearningItemAnalysisRow {
  key: string;
  no: number;
  bookletNumbers: Partial<Record<string, number>>;
  subject: string;
  unit: string;
  topic: string;
  outcome: string;
  answer: string;
  correct: number;
  wrong: number;
  blank: number;
  difficulty: number;
  discrimination: number;
  upper: number;
  lower: number;
  choices: Record<string, number>;
  choiceCounts: Record<string, number>;
  status: string;
  originalIndex: number;
}

export interface LearningTopicRow {
  key: string;
  subject: string;
  unit: string;
  topic: string;
  questions: Set<number>;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  classes: Record<string, { correct: number; total: number }>;
  questionStats: Record<number, { correct: number; wrong: number; blank: number; total: number; outcome: string }>;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const classroomName = (value: unknown) => String(value || 'Sınıfsız').trim().replace(/^\-\s*/, '').replace(/(\d+)\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/g, '$1-$2') || 'Sınıfsız';
const identity = (result: ExamStudentResult) => String(result.recordId || result.studentNumber || result.studentName || '').trim().toLocaleLowerCase('tr-TR');
const itemStatus = (p: number, d: number) => d < 0 ? 'İptal değerlendirilmeli' : d < .20 ? 'Ayırt ediciliği düşük' : p < .20 ? 'Çok zor' : p > .90 ? 'Çok kolay' : 'Uygun';

const questionMeta = (exam: any, subjectName: string, originalIndex: number) => exam?.questions?.[subjectName]?.[originalIndex] || {};

const firstCurriculumText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const questionCurriculumMeta = (meta: any, evaluatedQuestion: any) => ({
  unit: firstCurriculumText(
    meta?.unitName,
    meta?.unit_name,
    meta?.unit,
    meta?.systemUnitName,
    meta?.curriculum?.unitName,
    meta?.curriculum?.unit,
    evaluatedQuestion?.unit,
  ),
  topic: firstCurriculumText(
    meta?.topicName,
    meta?.topic_name,
    meta?.topic,
    meta?.systemTopicName,
    meta?.curriculum?.topicName,
    meta?.curriculum?.topic,
    evaluatedQuestion?.topic,
  ),
  outcome: firstCurriculumText(
    meta?.outcomeName,
    meta?.outcome_name,
    meta?.outcome,
    meta?.systemOutcomeName,
    meta?.learningOutcome,
    meta?.learning_outcome,
    meta?.acquisitionName,
    meta?.acquisition_name,
    meta?.acquisition,
    meta?.kazanim,
    meta?.['kazanım'],
    meta?.curriculum?.outcomeName,
    meta?.curriculum?.outcome,
    evaluatedQuestion?.outcome,
  ),
});

export class ExamLearningAnalysisService {
  results(exam: any): ExamStudentResult[] {
    return examAnalysisService.requireStoredResults(exam);
  }

  private filtered(exam: any, classroom = 'Tümü'): ExamStudentResult[] {
    const results = this.results(exam);
    return results.filter((result) => classroom === 'Tümü' || classroomName(result.classroom) === classroomName(classroom));
  }

  buildItems(exam: any, classroom = 'Tümü', subjectFilter = 'Tümü'): LearningItemAnalysisRow[] {
    const results = this.filtered(exam, classroom);
    if (!results.length) return [];

    const ranked = [...results].sort((a, b) => Number(b.totals?.net || 0) - Number(a.totals?.net || 0));
    const groupSize = Math.max(1, Math.round(results.length * 0.27));
    const upperIds = new Set(ranked.slice(0, groupSize).map(identity));
    const lowerIds = new Set(ranked.slice(-groupSize).map(identity));
    const template = results[0];
    const rows: LearningItemAnalysisRow[] = [];

    for (const subject of template.subjects || []) {
      if (subjectFilter !== 'Tümü' && subject.subjectName !== subjectFilter) continue;
      for (const templateQuestion of subject.questions || []) {
        const originalIndex = Number(templateQuestion.originalIndex ?? templateQuestion.qNum - 1);
        const answers = results.map((student) => {
          const studentSubject = (student.subjects || []).find((entry) => entry.subjectName === subject.subjectName);
          const question = (studentSubject?.questions || []).find((entry) => Number(entry.originalIndex) === originalIndex);
          return { student, question };
        }).filter((entry) => Boolean(entry.question));
        if (!answers.length) continue;

        const choiceCounts: Record<string, number> = Object.fromEntries(LETTERS.map((letter) => [letter, 0]));
        let correctCount = 0, wrongCount = 0, blankCount = 0, upperCorrect = 0, lowerCorrect = 0;
        for (const { student, question } of answers as Array<{student: ExamStudentResult; question: any}>) {
          const answer = String(question.studentAns || '-').toUpperCase();
          if (LETTERS.includes(answer)) choiceCounts[answer] += 1;
          if (question.isCorrect) {
            correctCount += 1;
            if (upperIds.has(identity(student))) upperCorrect += 1;
            if (lowerIds.has(identity(student))) lowerCorrect += 1;
          } else if (question.isEmpty) blankCount += 1;
          else wrongCount += 1;
        }
        const total = answers.length;
        const difficulty = total ? correctCount / total : 0;
        const discrimination = upperCorrect / groupSize - lowerCorrect / groupSize;
        const meta = questionMeta(exam, subject.subjectName, originalIndex);
        const curriculum = questionCurriculumMeta(meta, templateQuestion);
        const aNumber = Number(meta?.bookletNumbers?.A) || Number(templateQuestion.qNum || originalIndex + 1);
        const bookletNumbers: Partial<Record<string, number>> = { A: aNumber };
        for (const booklet of ['B', 'C', 'D']) {
          const value = Number(meta?.bookletNumbers?.[booklet]);
          if (Number.isFinite(value) && value > 0) bookletNumbers[booklet] = value;
        }
        rows.push({
          key: `${subject.subjectName}-${originalIndex + 1}`,
          no: aNumber,
          bookletNumbers,
          subject: subject.subjectName,
          unit: curriculum.unit || 'Belirtilmemiş',
          topic: curriculum.topic || 'Konu Belirtilmemiş',
          outcome: curriculum.outcome || 'Kazanım belirtilmemiş',
          answer: String(templateQuestion.correctAns || '').toUpperCase() || '—',
          correct: Math.round((correctCount / total) * 100),
          wrong: Math.round((wrongCount / total) * 100),
          blank: Math.round((blankCount / total) * 100),
          difficulty,
          discrimination,
          upper: Math.round((upperCorrect / groupSize) * 100),
          lower: Math.round((lowerCorrect / groupSize) * 100),
          choices: Object.fromEntries(LETTERS.map((letter) => [letter, Math.round((choiceCounts[letter] / total) * 100)])),
          choiceCounts,
          status: itemStatus(difficulty, discrimination),
          originalIndex,
        });
      }
    }
    return rows;
  }

  classroomComparison(exam: any, item: Pick<LearningItemAnalysisRow, 'subject'|'originalIndex'>) {
    const results = this.results(exam);
    const grouped: Record<string, {total: number; correct: number}> = {};
    for (const result of results) {
      const classroom = classroomName(result.classroom);
      grouped[classroom] ||= { total: 0, correct: 0 };
      const subject = result.subjects.find((entry) => entry.subjectName === item.subject);
      const question = subject?.questions.find((entry) => Number(entry.originalIndex) === Number(item.originalIndex));
      if (!question) continue;
      grouped[classroom].total += 1;
      if (question.isCorrect) grouped[classroom].correct += 1;
    }
    return Object.entries(grouped).map(([name, value]) => ({ name, rate: value.total ? Math.round(value.correct / value.total * 100) : 0, total: value.total })).sort((a,b) => b.rate-a.rate);
  }

  correctStudents(exam: any, item: Pick<LearningItemAnalysisRow, 'subject'|'originalIndex'>, classroomFilter = 'Tümü') {
    const results = this.filtered(exam, classroomFilter);
    const classStatsMap = new Map<string, {classroom:string;correct:number;wrong:number;empty:number;total:number}>();
    const students: Array<{id:string;name:string;number:string;classroom:string}> = [];
    for (const result of results) {
      const classroom = classroomName(result.classroom);
      const stats = classStatsMap.get(classroom) || { classroom, correct:0, wrong:0, empty:0, total:0 };
      const subject = result.subjects.find((entry) => entry.subjectName === item.subject);
      const question = subject?.questions.find((entry) => Number(entry.originalIndex) === Number(item.originalIndex));
      if (!question) continue;
      stats.total += 1;
      if (question.isCorrect) {
        stats.correct += 1;
        students.push({ id: String(result.recordId || result.studentNumber || result.studentName), name: result.studentName || 'İsimsiz Öğrenci', number: result.studentNumber || '', classroom });
      } else if (question.isEmpty) stats.empty += 1;
      else stats.wrong += 1;
      classStatsMap.set(classroom, stats);
    }
    students.sort((a,b) => a.classroom.localeCompare(b.classroom,'tr-TR',{numeric:true}) || a.name.localeCompare(b.name,'tr-TR'));
    const classStats = Array.from(classStatsMap.values()).sort((a,b)=>a.classroom.localeCompare(b.classroom,'tr-TR',{numeric:true}));
    return { students, classStats };
  }

  buildTopicRows(results: ExamStudentResult[], classroom = 'Tümü', subjectFilter = 'Tümü'): LearningTopicRow[] {
    const map: Record<string, LearningTopicRow> = {};
    for (const student of results) {
      const cls = classroomName(student.classroom);
      if (classroom !== 'Tümü' && cls !== classroomName(classroom)) continue;
      for (const subject of student.subjects || []) {
        if (subjectFilter !== 'Tümü' && subject.subjectName !== subjectFilter) continue;
        for (const question of subject.questions || []) {
          const unit = question.unit || 'Belirtilmemiş';
          const topic = question.topic || 'Konu Belirtilmemiş';
          const key = `${subject.subjectName}::${unit}::${topic}`;
          map[key] ||= { key, subject: subject.subjectName, unit, topic, questions:new Set<number>(), correct:0, wrong:0, blank:0, total:0, classes:{}, questionStats:{} };
          const row = map[key];
          const qNo = Number(question.originalIndex ?? question.qNum - 1) + 1;
          row.questions.add(qNo); row.total += 1;
          if (question.isCorrect) row.correct += 1; else if (question.isEmpty) row.blank += 1; else row.wrong += 1;
          row.classes[cls] ||= {correct:0,total:0}; row.classes[cls].total += 1; if (question.isCorrect) row.classes[cls].correct += 1;
          row.questionStats[qNo] ||= {correct:0,wrong:0,blank:0,total:0,outcome:question.outcome || 'Kazanım belirtilmemiş'};
          const stat = row.questionStats[qNo]; stat.total += 1; if (question.isCorrect) stat.correct += 1; else if (question.isEmpty) stat.blank += 1; else stat.wrong += 1;
        }
      }
    }
    return Object.values(map);
  }
}

export const examLearningAnalysisService = new ExamLearningAnalysisService();
