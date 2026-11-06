import React from "react";
import localforage from "localforage";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getQuestionCorrectAnswer } from "../../utils/questionAnswer";

import { sqliteStorage } from "../../core/state/SyncStateStore";
type Props = {
  onNavigate: (tab: string) => void;
  refreshVersion?: number;
};

type OutcomeRow = {
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

type SubjectRow = {
  subject: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
  priorityCount: number;
};

const getQuestionIndexForBooklet = (bookletName: string, index: number, count: number) => {
  const normalized = String(bookletName || "A").toUpperCase().trim();
  if (normalized === "B") return count - 1 - index;
  if (normalized === "C") return (index + Math.floor(count / 2)) % count;
  if (normalized === "D") return count - 1 - ((index + Math.floor(count / 3)) % count);
  return index;
};

const getPrintedQuestionIndex = (
  exam: any,
  bookletKey: string,
  targetQuestionNumber: number,
  subjectName: string,
  count: number,
) => {
  const normalized = String(bookletKey || "A").toUpperCase().trim();
  const questions = exam?.questions?.[subjectName] || {};
  for (let originalIndex = 0; originalIndex < count; originalIndex += 1) {
    const savedNumber = questions?.[originalIndex]?.bookletNumbers?.[normalized];
    if (savedNumber !== undefined && savedNumber !== null && Number(savedNumber) === targetQuestionNumber) {
      return originalIndex;
    }
  }
  return getQuestionIndexForBooklet(normalized, targetQuestionNumber - 1, count);
};

const readExams = async () => {
  const indexedDbValue = await localforage.getItem<any[]>("exams").catch(() => null);
  if (Array.isArray(indexedDbValue)) return indexedDbValue;
  try {
    const raw = sqliteStorage.getItem("exams");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const examDateValue = (exam: any) => {
  const value = new Date(exam?.examDate || exam?.date || exam?.updatedAt || exam?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
};

const isEvaluated = (exam: any) => {
  const status = String(exam?.status || exam?.state || "").toLocaleLowerCase("tr-TR");
  return Boolean(
    (exam?.isEvaluated || exam?.evaluated || status.includes("değerlendir") || status.includes("tamam")) &&
      Array.isArray(exam?.studentTxtRecords) &&
      Array.isArray(exam?.examStructure),
  );
};

const buildOutcomeRows = (exam: any): OutcomeRow[] => {
  const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
  const aggregate = new Map<string, OutcomeRow>();

  records.forEach((record: any) => {
    const questionCount = structure.reduce(
      (testTotal: number, test: any) =>
        testTotal +
        (Array.isArray(test?.subjects) ? test.subjects : []).reduce(
          (subjectTotal: number, subject: any) => subjectTotal + Number(subject?.count || 0),
          0,
        ),
      0,
    );
    const answers = String(record?.answers || "")
      .toLocaleUpperCase("tr-TR")
      .split("")
      .map((value) => (["A", "B", "C", "D", "E"].includes(value) ? value : "-"))
      .join("")
      .padEnd(questionCount, "-")
      .slice(0, questionCount);
    let answerOffset = 0;

    structure.forEach((test: any) => {
      (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
        const subjectName = String(subject?.name || "Ders belirtilmemiş");
        const count = Number(subject?.count || 0);
        for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
          const originalIndex = exam?.examSource === "Basılı Yayın"
            ? getPrintedQuestionIndex(exam, record?.bookletType, questionIndex + 1, subjectName, count)
            : getQuestionIndexForBooklet(record?.bookletType, questionIndex, count);
          const question = exam?.questions?.[subjectName]?.[originalIndex] || {};
          const correctAnswer = getQuestionCorrectAnswer(question);
          const studentAnswer = answers[answerOffset + questionIndex] || "-";
          const isEmpty = studentAnswer === "-";
          const isCorrect = Boolean(correctAnswer) && !isEmpty && studentAnswer === correctAnswer;
          const unit = String(question?.unit || "Ünite belirtilmemiş");
          const topic = String(question?.topic || "Konu belirtilmemiş");
          const outcome = String(question?.outcome || "Kazanım belirtilmemiş");
          const key = `${subjectName}|||${unit}|||${topic}|||${outcome}`;
          const current = aggregate.get(key) || {
            key,
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
          current.total += 1;
          if (isEmpty) current.empty += 1;
          else if (isCorrect) current.correct += 1;
          else current.wrong += 1;
          aggregate.set(key, current);
        }
        answerOffset += count;
      });
    });
  });

  return Array.from(aggregate.values())
    .map((row) => ({ ...row, success: row.total ? Math.round((row.correct / row.total) * 100) : 0 }))
    .sort((a, b) => a.success - b.success || b.total - a.total);
};

const buildSubjects = (rows: OutcomeRow[]): SubjectRow[] => {
  const map = new Map<string, SubjectRow>();
  rows.forEach((row) => {
    const current = map.get(row.subject) || {
      subject: row.subject,
      correct: 0,
      wrong: 0,
      empty: 0,
      total: 0,
      success: 0,
      priorityCount: 0,
    };
    current.correct += row.correct;
    current.wrong += row.wrong;
    current.empty += row.empty;
    current.total += row.total;
    if (row.success < 50) current.priorityCount += 1;
    map.set(row.subject, current);
  });
  return Array.from(map.values())
    .map((row) => ({ ...row, success: row.total ? Math.round((row.correct / row.total) * 100) : 0 }))
    .sort((a, b) => a.success - b.success || b.total - a.total);
};

const toneForScore = (score: number) => {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
};

export default function DashboardLearningInsights({ onNavigate, refreshVersion = 0 }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [exam, setExam] = React.useState<any | null>(null);
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const exams = await readExams();
    const latest = exams.filter(isEvaluated).sort((a, b) => examDateValue(b) - examDateValue(a))[0] || null;
    setExam(latest);
    setLoadedAt(new Date());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, refreshVersion]);

  const outcomes = React.useMemo(() => (exam ? buildOutcomeRows(exam) : []), [exam]);
  const subjects = React.useMemo(() => buildSubjects(outcomes), [outcomes]);
  const priorityOutcomes = React.useMemo(
    () => outcomes.filter((row) => row.success < 50 && !row.outcome.includes("belirtilmemiş")).slice(0, 4),
    [outcomes],
  );
  const strongest = subjects.length > 0 ? [...subjects].sort((a, b) => b.success - a.success)[0] : null;
  const weakest = subjects[0] || null;

  if (loading) {
    return (
      <article className="rounded-[26px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin" /> Öğrenme verileri hazırlanıyor…
        </div>
      </article>
    );
  }

  if (!exam || subjects.length === 0) {
    return (
      <article className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Akademik Karar Alanı</span>
            <h2 className="mt-1 text-lg font-black text-slate-900">Öğrenme haritası verisi bekleniyor</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Ders ve kazanım özetinin oluşması için soru yapısı ve öğrenci cevapları bulunan değerlendirilmiş bir sınav gereklidir.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate("exam-prepare")} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-black text-white hover:bg-slate-800">
            <BookOpenCheck className="h-4 w-4" /> Sınav verisine git
          </button>
        </div>
      </article>
    );
  }

  const examName = String(exam?.name || exam?.title || exam?.examName || "Son değerlendirilmiş sınav");

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Akademik Karar Alanı</span>
          <h2 className="mt-1 text-lg font-black text-slate-900">Ders ve kazanım görünümü</h2>
          <p className="mt-1 text-[10px] text-slate-500">{examName} · {loadedAt?.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50" title="Akademik verileri yenile">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onNavigate("learning-map")} className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-black text-white hover:bg-violet-700">
            Öğrenme Haritası <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {subjects.slice(0, 4).map((subject) => (
          <button key={subject.subject} type="button" onClick={() => onNavigate("teacher-analytics")} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${toneForScore(subject.success)}`}>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-xs">{subject.subject}</strong>
              {subject.success >= 75 ? <TrendingUp className="h-4 w-4" /> : subject.success < 50 ? <TrendingDown className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            </div>
            <strong className="mt-3 block text-2xl font-black">%{subject.success}</strong>
            <span className="mt-1 block text-[9px] font-bold">{subject.priorityCount} öncelikli kazanım</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-600" />
            <h3 className="text-xs font-black text-slate-900">Öncelikli kazanımlar</h3>
          </div>
          {priorityOutcomes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {priorityOutcomes.map((row) => (
                <button key={row.key} type="button" onClick={() => onNavigate("learning-map")} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-rose-200 hover:bg-rose-50">
                  <span className="min-w-0">
                    <strong className="block truncate text-[10px] text-slate-900">{row.outcome}</strong>
                    <small className="mt-1 block truncate text-[9px] text-slate-500">{row.subject} · {row.topic}</small>
                  </span>
                  <strong className="shrink-0 text-xs text-rose-700">%{row.success}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> %50 altında tanımlı kazanım bulunmadı.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-700" />
            <h3 className="text-xs font-black text-violet-950">Zümre için ilk karar</h3>
          </div>
          {weakest ? (
            <>
              <p className="mt-3 text-xs leading-5 text-violet-900">
                <strong>{weakest.subject}</strong> %{weakest.success} başarıyla öncelikli destek alanıdır. İlk olarak en düşük kazanımlar için kısa süreli telafi planı hazırlanması önerilir.
              </p>
              {strongest && strongest.subject !== weakest.subject ? (
                <p className="mt-3 rounded-xl bg-white/70 p-3 text-[10px] leading-4 text-violet-800">
                  Korunacak güçlü alan: <strong>{strongest.subject} (%{strongest.success})</strong>
                </p>
              ) : null}
              <button type="button" onClick={() => onNavigate("teacher-analytics")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2.5 text-[10px] font-black text-white hover:bg-violet-800">
                Öğretmen Analitiğini Aç <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <p className="mt-3 text-xs text-violet-800">Karar oluşturmak için yeterli ders verisi bulunamadı.</p>
          )}
        </div>
      </div>
    </article>
  );
}
