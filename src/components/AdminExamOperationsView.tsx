import React from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileChartColumn,
  Loader2,
  TrendingUp,
} from "lucide-react";

type ExamRow = {
  id?: string;
  examName?: string;
  name?: string;
  examDate?: string;
  date?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  isEvaluated?: boolean;
  examStatus?: string;
  status?: string;
  examType?: string;
  gradeLevel?: string;
  studentTxtRecords?: unknown[];
  evaluationResults?: unknown[];
};

type TabKey = "exams" | "development";

const toTimestamp = (exam: ExamRow) => {
  const candidates = [exam.examDate, exam.date, exam.updatedAt, exam.createdAt];
  for (const value of candidates) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number") return value;
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatDate = (exam: ExamRow) => {
  const value = exam.examDate || exam.date || exam.updatedAt || exam.createdAt;
  if (!value) return "Tarih bilgisi yok";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value).length <= 10 ? `${value}T12:00:00` : String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const examName = (exam: ExamRow) =>
  String(exam.examName || exam.name || "İsimsiz Deneme Sınavı").trim();

export default function AdminExamOperationsView({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [tab, setTab] = React.useState<TabKey>("exams");
  const [rows, setRows] = React.useState<ExamRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/database/collections/exams", {
          cache: "no-store",
          headers: token ? { "X-Enstitu-Token": token } : undefined,
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload?.error || "Deneme sınavları alınamadı.");
        }
        const exams = (Array.isArray(payload) ? payload : [])
          .filter((exam: ExamRow) => {
            const status = String(exam.examStatus || exam.status || "").toLocaleLowerCase("tr-TR");
            const hasResults =
              Array.isArray(exam.studentTxtRecords) && exam.studentTxtRecords.length > 0 ||
              Array.isArray(exam.evaluationResults) && exam.evaluationResults.length > 0;
            return exam.isEvaluated === true || status.includes("değerlendir") || status.includes("tamam") || hasResults;
          })
          .sort((a: ExamRow, b: ExamRow) => toTimestamp(b) - toTimestamp(a));

        if (active) setRows(exams);
      } catch (reason: any) {
        if (active) setError(reason?.message || "Deneme sınavları alınamadı.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-sky-50/40 to-white p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
        <header className="border-b border-slate-100 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black text-slate-950">Sınav İşlemleri</h1>
              <p className="text-[10px] font-bold text-slate-500">Yönetici sınav merkezi</p>
            </div>
          </div>
        </header>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2">
            <button
              type="button"
              onClick={() => setTab("exams")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black ${
                tab === "exams" ? "bg-cyan-600 text-white shadow-sm" : "bg-white text-slate-600"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Deneme Sınavları
            </button>
            <button
              type="button"
              onClick={() => setTab("development")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black ${
                tab === "development" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Gelişim Raporları
            </button>
          </div>

          {tab === "exams" ? (
            <section className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-950">Deneme Sınavları</h2>
                  <p className="text-[10px] font-semibold text-slate-500">En son yapılan denemeden eskiye doğru</p>
                </div>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-black text-cyan-700">
                  {rows.length} sınav
                </span>
              </div>

              {loading ? (
                <div className="flex min-h-52 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                  Değerlendirilmiş deneme sınavı bulunamadı.
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((exam, index) => (
                    <article
                      key={String(exam.id || `${examName(exam)}-${index}`)}
                      className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white p-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-xs font-black text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-950">{examName(exam)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(exam)}
                          </span>
                          {exam.examType ? <span>{exam.examType}</span> : null}
                          {exam.gradeLevel ? <span>{exam.gradeLevel}</span> : null}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-cyan-500" />
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="mt-4 rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
                  <FileChartColumn className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-950">Gelişim Raporları</h2>
                  <p className="text-[10px] font-semibold text-slate-500">Denemeler arası gelişim analizleri için hazır alan</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
