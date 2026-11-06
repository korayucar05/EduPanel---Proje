import React, { useEffect, useMemo, useState } from "react";
import localforage from "localforage";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  LineChart,
  Loader2,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";

import { sqliteStorage } from "../core/state/SyncStateStore";
type ExamTrend = {
  id: string;
  name: string;
  date: string;
  participantCount: number;
  success: number;
  subjects: Record<string, { correct: number; total: number; success: number }>;
};

type SubjectTrend = {
  subject: string;
  first: number;
  last: number;
  change: number;
  average: number;
  examCount: number;
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

const buildExamTrend = (exam: any): ExamTrend => {
  const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
  const totals = new Map<string, { correct: number; total: number }>();
  let allCorrect = 0;
  let allTotal = 0;

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
        const current = totals.get(subjectName) || { correct: 0, total: 0 };
        for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
          const originalIndex =
            exam?.examSource === "Basılı Yayın"
              ? getPrintedQuestionIndex(exam, record?.bookletType, questionIndex + 1, subjectName, count)
              : getQuestionIndexForBooklet(record?.bookletType, questionIndex, count);
          const question = exam?.questions?.[subjectName]?.[originalIndex] || {};
          const correctAnswer = getQuestionCorrectAnswer(question);
          const studentAnswer = answers[answerOffset + questionIndex] || "-";
          if (correctAnswer) {
            current.total += 1;
            allTotal += 1;
            if (studentAnswer === correctAnswer) {
              current.correct += 1;
              allCorrect += 1;
            }
          }
        }
        totals.set(subjectName, current);
        answerOffset += count;
      });
    });
  });

  const subjects: ExamTrend["subjects"] = {};
  totals.forEach((value, subject) => {
    subjects[subject] = {
      ...value,
      success: value.total ? Math.round((value.correct / value.total) * 100) : 0,
    };
  });

  return {
    id: String(exam?.id || `${exam?.examName || "exam"}-${exam?.examDate || ""}`),
    name: String(exam?.examName || exam?.name || "Adsız sınav"),
    date: String(exam?.examDate || exam?.date || exam?.createdAt || ""),
    participantCount: records.length,
    success: allTotal ? Math.round((allCorrect / allTotal) * 100) : 0,
    subjects,
  };
};

const formatDate = (value: string) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("tr-TR") : "Tarih yok";
};

const trendClass = (change: number) => {
  if (change >= 3) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (change <= -3) return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
};

interface HasatInstitutionTrendsProps {
  onNavigate?: (tab: string) => void;
}

export default function HasatInstitutionTrends({ onNavigate }: HasatInstitutionTrendsProps) {
  const [exams, setExams] = useState<ExamTrend[]>([]);
  const [period, setPeriod] = useState<"5" | "10" | "all">("5");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const saved = await readExams();
    const trends = saved
      .filter((exam) => exam?.isEvaluated && Array.isArray(exam?.studentTxtRecords))
      .map(buildExamTrend)
      .filter((exam) => exam.participantCount > 0)
      .sort((a, b) => {
        const aTime = Date.parse(a.date) || 0;
        const bTime = Date.parse(b.date) || 0;
        return aTime - bTime;
      });
    setExams(trends);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleExams = useMemo(() => {
    if (period === "all") return exams;
    return exams.slice(-Number(period));
  }, [exams, period]);

  const subjectTrends = useMemo<SubjectTrend[]>(() => {
    const subjects = new Set<string>();
    visibleExams.forEach((exam) => Object.keys(exam.subjects).forEach((subject) => subjects.add(subject)));
    return Array.from(subjects)
      .map((subject) => {
        const values = visibleExams
          .map((exam) => exam.subjects[subject]?.success)
          .filter((value): value is number => Number.isFinite(value));
        const first = values[0] ?? 0;
        const last = values[values.length - 1] ?? 0;
        return {
          subject,
          first,
          last,
          change: last - first,
          average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
          examCount: values.length,
        };
      })
      .filter((row) => row.examCount > 0)
      .sort((a, b) => a.change - b.change || a.average - b.average);
  }, [visibleExams]);

  const overallChange = useMemo(() => {
    if (visibleExams.length < 2) return 0;
    return visibleExams[visibleExams.length - 1].success - visibleExams[0].success;
  }, [visibleExams]);

  const declining = subjectTrends.filter((row) => row.change <= -3);
  const rising = [...subjectTrends].filter((row) => row.change >= 3).sort((a, b) => b.change - a.change);
  const priority = declining[0] || subjectTrends[0];
  const best = rising[0] || [...subjectTrends].sort((a, b) => b.average - a.average)[0];
  const maxSuccess = Math.max(100, ...visibleExams.map((exam) => exam.success));

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-indigo-300">
              <LineChart className="h-5 w-5" /> e-Nstitü Intelligence
            </div>
            <h1 className="text-3xl font-black">Kurum Trendleri ve Zümre Karar Paneli</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
              Değerlendirilmiş sınavları zaman içinde karşılaştırır; yükselen ve gerileyen dersleri belirleyerek zümrelere uygulanabilir karar önerileri üretir.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">
            <RefreshCw className="h-4 w-4" /> Verileri yenile
          </button>
        </div>
      </section>

      {visibleExams.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-slate-900">Trend oluşturacak sınav bulunamadı</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">En az bir değerlendirilmiş sınav ve öğrenci cevap kaydı gereklidir.</p>
          <button type="button" onClick={() => onNavigate?.("exam-analysis")} className="mt-5 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-black text-white">Sınav Analize Git</button>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <CalendarRange className="h-6 w-6 text-indigo-700" />
              <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">İncelenen sınav</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{visibleExams.length}</p>
            </article>
            <article className={`rounded-2xl border p-5 shadow-sm ${trendClass(overallChange)}`}>
              {overallChange >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              <p className="mt-4 text-xs font-black uppercase tracking-wider">Kurum değişimi</p>
              <p className="mt-1 text-3xl font-black">{overallChange > 0 ? "+" : ""}{overallChange} puan</p>
            </article>
            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
              <AlertTriangle className="h-6 w-6" />
              <p className="mt-4 text-xs font-black uppercase tracking-wider">Gerileyen ders</p>
              <p className="mt-1 text-3xl font-black">{declining.length}</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
              <p className="mt-4 text-xs font-black uppercase tracking-wider">Yükselen ders</p>
              <p className="mt-1 text-3xl font-black">{rising.length}</p>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Kurum başarı eğilimi</h2>
                  <p className="text-sm font-semibold text-slate-500">Sınavların doğru cevap yüzdesine göre kronolojik görünüm</p>
                </div>
                <select value={period} onChange={(event) => setPeriod(event.target.value as "5" | "10" | "all")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
                  <option value="5">Son 5 sınav</option>
                  <option value="10">Son 10 sınav</option>
                  <option value="all">Tüm sınavlar</option>
                </select>
              </div>
              <div className="mt-7 flex h-64 items-end gap-3 overflow-x-auto border-b border-l border-slate-200 px-3 pb-0">
                {visibleExams.map((exam) => (
                  <div key={exam.id} className="flex min-w-[76px] flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-sm font-black text-slate-800">%{exam.success}</span>
                    <div className="w-full rounded-t-xl bg-indigo-600" style={{ height: `${Math.max(8, (exam.success / maxSuccess) * 190)}px` }} title={`${exam.name}: %${exam.success}`} />
                    <span className="h-10 max-w-[90px] overflow-hidden text-center text-[10px] font-bold leading-tight text-slate-500">{formatDate(exam.date)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-900"><Target className="h-6 w-6" /><h2 className="text-xl font-black">Zümre için ilk karar</h2></div>
              {priority ? (
                <>
                  <p className="mt-5 text-lg font-black text-slate-950">{priority.subject}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                    {priority.change <= -3
                      ? `Başarı ${Math.abs(priority.change)} puan geriledi. Son sınavdaki düşük kazanımlar zümre toplantısında incelenmeli ve iki haftalık ortak telafi planı hazırlanmalıdır.`
                      : `Ortalama başarı %${priority.average}. Kazanım bazlı ölçüm sonuçlarıyla kısa süreli ortak destek planı hazırlanması önerilir.`}
                  </p>
                  <button type="button" onClick={() => onNavigate?.("teacher-analytics")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white">
                    Öğretmen Analitiği Aç <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : <p className="mt-5 text-sm font-semibold text-slate-600">Karar üretmek için yeterli ders verisi yok.</p>}
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Ders trendleri</h2>
              <div className="mt-5 space-y-3">
                {subjectTrends.map((row) => (
                  <div key={row.subject} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${trendClass(row.change)}`}>
                    <div>
                      <p className="font-black">{row.subject}</p>
                      <p className="mt-1 text-xs font-bold opacity-75">{row.examCount} sınav · Ortalama %{row.average}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black">{row.change > 0 ? "+" : ""}{row.change}</p>
                      <p className="text-xs font-bold">%{row.first} → %{row.last}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Yönetim özeti</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Korunacak güçlü alan</p>
                  <p className="mt-2 text-lg font-black text-emerald-950">{best?.subject || "Yeterli veri yok"}</p>
                  {best && <p className="mt-1 text-sm font-semibold text-emerald-800">Ortalama %{best.average}, değişim {best.change > 0 ? "+" : ""}{best.change} puan</p>}
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-rose-700">Öncelikli müdahale</p>
                  <p className="mt-2 text-lg font-black text-rose-950">{priority?.subject || "Yeterli veri yok"}</p>
                  {priority && <p className="mt-1 text-sm font-semibold text-rose-800">Son ölçüm %{priority.last}, değişim {priority.change} puan</p>}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                  Sonuçlar yalnızca sistemde kayıtlı ve değerlendirilmiş sınavlardan üretilir. Sınav kapsamları farklıysa değişim yorumları zümre tarafından kazanım kapsamıyla birlikte değerlendirilmelidir.
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
