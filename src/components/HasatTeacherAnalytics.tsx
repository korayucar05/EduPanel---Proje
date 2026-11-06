import React, { useEffect, useMemo, useState } from "react";
import localforage from "localforage";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Filter,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";

import { sqliteStorage } from "../core/state/SyncStateStore";
import { loadAccessState } from "../lib/accessControl";
import { contradictionRecordsForTeacher, readAcademicContradictionRecords, type AcademicContradictionDeliveryRecord } from "../core/intelligence/academicContradictionDelivery";
type DetailRow = {
  key: string;
  subject: string;
  classroom: string;
  unit: string;
  topic: string;
  outcome: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
};

type SubjectSummary = {
  subject: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
  classroomCount: number;
  priorityOutcomeCount: number;
};

interface HasatTeacherAnalyticsProps {
  teachers?: any[];
  courses?: any[];
  classrooms?: any[];
  onNavigate?: (tab: string) => void;
}

const normalizeClassroom = (value: unknown) =>
  String(value || "Sınıfsız")
    .trim()
    .replace(/^(\d+)\s*[-/]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)$/u, "$1-$2")
    .toLocaleUpperCase("tr-TR");

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

const buildRows = (exam: any): DetailRow[] => {
  const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
  const aggregate = new Map<string, DetailRow>();

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
    const classroom = normalizeClassroom(record?.gradeLevel ?? record?.classroom ?? record?.className);
    let answerOffset = 0;

    structure.forEach((test: any) => {
      (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
        const subjectName = String(subject?.name || "Ders belirtilmemiş");
        const count = Number(subject?.count || 0);
        for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
          const originalIndex =
            exam?.examSource === "Basılı Yayın"
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
          const key = `${subjectName}|||${classroom}|||${unit}|||${topic}|||${outcome}`;
          const current = aggregate.get(key) || {
            key,
            subject: subjectName,
            classroom,
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
    .sort((a, b) => a.success - b.success || b.total - a.total || a.outcome.localeCompare(b.outcome, "tr"));
};

const scoreClass = (score: number) => {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
};

export default function HasatTeacherAnalytics({ onNavigate }: HasatTeacherAnalyticsProps) {
  const [exams, setExams] = useState<any[]>([]);
  const [academicContradictions, setAcademicContradictions] = useState<AcademicContradictionDeliveryRecord[]>([]);

  const currentPanelIdentity = useMemo(() => {
    if (typeof window === "undefined") return { id: "", name: "" };
    const id = String(sessionStorage.getItem("edupanel_authenticated_user") || "").trim();
    try {
      const users = loadAccessState().users;
      const user = users.find((item: any) => String(item?.id || "").trim() === id)
        || users.find((item: any) => String(item?.status || "") === "active" && item?.role === "teacher");
      return {
        id: String(user?.teacherId || user?.id || id || "").trim(),
        name: String(user?.fullName || user?.name || user?.displayName || "").replace(/\s+/g, " ").trim(),
      };
    } catch {
      return { id, name: "" };
    }
  }, []);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Tümü");
  const [selectedClassroom, setSelectedClassroom] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [saved, contradictionRows] = await Promise.all([
      readExams(),
      readAcademicContradictionRecords().catch(() => [] as AcademicContradictionDeliveryRecord[]),
    ]);
    const evaluated = saved.filter((exam) => exam?.isEvaluated && Array.isArray(exam?.studentTxtRecords));
    setExams(evaluated);
    setAcademicContradictions(Array.isArray(contradictionRows) ? contradictionRows : []);
    setSelectedExamId((current) => (evaluated.some((exam) => exam.id === current) ? current : evaluated[0]?.id || ""));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const activeExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId), [exams, selectedExamId]);
  const allRows = useMemo(() => (activeExam ? buildRows(activeExam) : []), [activeExam]);
  const subjects = useMemo(
    () => Array.from(new Set<string>(allRows.map((row) => row.subject))).sort((a, b) => a.localeCompare(b, "tr")),
    [allRows],
  );
  const classrooms = useMemo(
    () => Array.from(new Set<string>(allRows.map((row) => row.classroom))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true })),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
    return allRows.filter((row) => {
      if (selectedSubject !== "Tümü" && row.subject !== selectedSubject) return false;
      if (selectedClassroom !== "Tümü" && row.classroom !== selectedClassroom) return false;
      if (!normalizedSearch) return true;
      return `${row.subject} ${row.classroom} ${row.unit} ${row.topic} ${row.outcome}`
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedSearch);
    });
  }, [allRows, search, selectedClassroom, selectedSubject]);

  const summaries = useMemo<SubjectSummary[]>(() => {
    const map = new Map<string, SubjectSummary & { classrooms: Set<string> }>();
    filteredRows.forEach((row) => {
      const current = map.get(row.subject) || {
        subject: row.subject,
        correct: 0,
        wrong: 0,
        empty: 0,
        total: 0,
        success: 0,
        classroomCount: 0,
        priorityOutcomeCount: 0,
        classrooms: new Set<string>(),
      };
      current.correct += row.correct;
      current.wrong += row.wrong;
      current.empty += row.empty;
      current.total += row.total;
      current.classrooms.add(row.classroom);
      if (row.success < 50) current.priorityOutcomeCount += 1;
      map.set(row.subject, current);
    });
    return Array.from(map.values())
      .map((item) => ({
        subject: item.subject,
        correct: item.correct,
        wrong: item.wrong,
        empty: item.empty,
        total: item.total,
        success: item.total ? Math.round((item.correct / item.total) * 100) : 0,
        classroomCount: item.classrooms.size,
        priorityOutcomeCount: item.priorityOutcomeCount,
      }))
      .sort((a, b) => a.success - b.success || a.subject.localeCompare(b.subject, "tr"));
  }, [filteredRows]);

  const overall = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + row.total, 0);
    const correct = filteredRows.reduce((sum, row) => sum + row.correct, 0);
    const wrong = filteredRows.reduce((sum, row) => sum + row.wrong, 0);
    const empty = filteredRows.reduce((sum, row) => sum + row.empty, 0);
    return {
      total,
      correct,
      wrong,
      empty,
      success: total ? Math.round((correct / total) * 100) : 0,
      priority: filteredRows.filter((row) => row.success < 50).length,
    };
  }, [filteredRows]);

  const priorityRows = useMemo(() => filteredRows.filter((row) => row.success < 50).slice(0, 12), [filteredRows]);
  const strongestRows = useMemo(
    () => [...filteredRows].filter((row) => row.total > 0).sort((a, b) => b.success - a.success || b.total - a.total).slice(0, 6),
    [filteredRows],
  );

  const courseTeacherContradictions = useMemo(
    () => contradictionRecordsForTeacher(
      academicContradictions,
      currentPanelIdentity.id,
      currentPanelIdentity.name,
      "course",
    ),
    [academicContradictions, currentPanelIdentity.id, currentPanelIdentity.name],
  );
  const mentorContradictions = useMemo(
    () => contradictionRecordsForTeacher(
      academicContradictions,
      currentPanelIdentity.id,
      currentPanelIdentity.name,
      "mentor",
    ),
    [academicContradictions, currentPanelIdentity.id, currentPanelIdentity.name],
  );

  if (loading) {
    return (
      <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1 pb-10">
      <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              <GraduationCap className="h-4 w-4" /> e-Nstitü Teacher Intelligence 1.0
            </div>
            <h1 className="text-3xl font-black tracking-tight">Öğretmen Analitik</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">
              Branş, sınıf ve kazanım performansını tek ekranda izleyin; zümre çalışması gerektiren alanları kanıta dayalı olarak belirleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15"
          >
            <RefreshCw className="h-4 w-4" /> Verileri yenile
          </button>
        </div>
      </section>

      {(courseTeacherContradictions.length > 0 || mentorContradictions.length > 0) ? (
        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-amber-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Akademik Çelişki Bildirimleri
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-950">Öğrenci alan profiliyle çelişen ders sonuçları</h2>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                Yalnız öğrencinin kendi alanındaki dersler karşılaştırılır. Bu kayıtlar başarısızlık etiketi değil, öğretmen ve mentör için erken müdahale sinyalidir.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center">
                <div className="text-[9px] font-black uppercase text-amber-700">Ders Öğretmeni</div>
                <div className="mt-1 text-2xl font-black text-amber-950">{courseTeacherContradictions.length}</div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-center">
                <div className="text-[9px] font-black uppercase text-indigo-700">Mentör</div>
                <div className="mt-1 text-2xl font-black text-indigo-950">{mentorContradictions.length}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {[
              { title: "Ders Öğretmeni Olarak", rows: courseTeacherContradictions, tone: "amber" },
              { title: "Mentör Olarak", rows: mentorContradictions, tone: "indigo" },
            ].map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-950">{group.title}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${group.tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                    {group.rows.length} kayıt
                  </span>
                </div>
                <div className="mt-3 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                  {group.rows.slice(0, 20).map((row) => {
                    const badge = row.severity === "sharp"
                      ? "bg-rose-700 text-white"
                      : row.severity === "clear"
                        ? "bg-orange-500 text-white"
                        : "bg-amber-400 text-amber-950";
                    return (
                      <article key={`${group.title}-${row.id}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-950">{row.studentName}</div>
                            <div className="mt-0.5 text-[10px] font-bold text-slate-500">
                              {row.classroom || "Sınıf yok"} · {row.areaLabel || row.area} · {row.examName}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black ${badge}`}>{row.severityLabel}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-white px-2 py-2">
                            <div className="text-[8px] font-black uppercase text-slate-400">Alan Tipik</div>
                            <div className="mt-0.5 text-sm font-black text-slate-900">%{Number(row.typicalSuccess || 0).toFixed(1)}</div>
                          </div>
                          <div className="rounded-xl bg-rose-50 px-2 py-2">
                            <div className="truncate text-[8px] font-black uppercase text-rose-500">{row.subject}</div>
                            <div className="mt-0.5 text-sm font-black text-rose-800">%{Number(row.targetSuccess || 0).toFixed(1)}</div>
                          </div>
                          <div className="rounded-xl bg-indigo-50 px-2 py-2">
                            <div className="text-[8px] font-black uppercase text-indigo-500">Kurum Ort.</div>
                            <div className="mt-0.5 text-sm font-black text-indigo-800">%{Number(row.institutionAverage || 0).toFixed(1)}</div>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-600">{row.explanation}</p>
                      </article>
                    );
                  })}
                  {group.rows.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">Bu kapsamda çelişki kaydı yok.</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {exams.length === 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
          <h2 className="mt-3 text-xl font-black text-amber-950">Değerlendirilmiş sınav bulunamadı</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-amber-800">
            Öğretmen analitiği oluşturmak için önce bir sınavın cevaplarını okuyup değerlendirin.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("exam-analysis")}
            className="mt-5 rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white"
          >
            Sınav Analize Git
          </button>
        </section>
      ) : (
        <>
          <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.35fr_1fr_1fr_1.4fr]">
            <label className="space-y-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Sınav
              <select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900">
                {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name || exam.examName || "Adsız sınav"}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Ders
              <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900">
                <option>Tümü</option>
                {subjects.map((subject) => <option key={subject}>{subject}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Sınıf
              <select value={selectedClassroom} onChange={(event) => setSelectedClassroom(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900">
                <option>Tümü</option>
                {classrooms.map((classroom) => <option key={classroom}>{classroom}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Kazanım ara
              <span className="relative block">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ünite, konu veya kazanım" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-bold text-slate-900" />
              </span>
            </label>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Genel başarı", value: `%${overall.success}`, icon: BarChart3 },
              { label: "İncelenen cevap", value: overall.total.toLocaleString("tr-TR"), icon: BookOpenCheck },
              { label: "Doğru", value: overall.correct.toLocaleString("tr-TR"), icon: CheckCircle2 },
              { label: "Yanlış + boş", value: (overall.wrong + overall.empty).toLocaleString("tr-TR"), icon: TrendingDown },
              { label: "Öncelikli kazanım", value: overall.priority.toString(), icon: Target },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <item.icon className="h-5 w-5 text-indigo-600" />
                <div className="mt-3 text-2xl font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">{item.label}</div>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Branş performansı</h2>
                  <p className="text-sm font-medium text-slate-500">Zümre toplantısında öncelik verilecek dersleri gösterir.</p>
                </div>
                <Filter className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 space-y-3">
                {summaries.map((summary) => (
                  <article key={summary.subject} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-black text-slate-950">{summary.subject}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">{summary.classroomCount} sınıf · {summary.priorityOutcomeCount} öncelikli kazanım</div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-sm font-black ${scoreClass(summary.success)}`}>%{summary.success}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${summary.success}%` }} /></div>
                  </article>
                ))}
                {summaries.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">Seçilen filtrelerle eşleşen veri yok.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Zümre için hızlı karar</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Mevcut veriden üretilebilen ilk uygulanabilir adım.</p>
              {summaries[0] ? (
                <div className="mt-5 space-y-4">
                  <div className={`rounded-2xl border p-4 ${scoreClass(summaries[0].success)}`}>
                    <div className="text-xs font-black uppercase tracking-wide">İlk öncelik</div>
                    <div className="mt-1 text-xl font-black">{summaries[0].subject}</div>
                    <p className="mt-2 text-sm font-semibold leading-6">
                      Başarı %{summaries[0].success}. İlk zümre çalışmasında en düşük kazanımlar için ortak soru çözümü ve kısa ölçme uygulaması planlanmalı.
                    </p>
                  </div>
                  <button type="button" onClick={() => onNavigate?.("learning-map")} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Öğrenme Haritasında İncele</button>
                </div>
              ) : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Karar üretmek için filtreleri genişletin.</p>}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" /><h2 className="text-lg font-black text-slate-950">Öncelikli kazanımlar</h2></div>
              <div className="mt-4 space-y-3">
                {priorityRows.map((row) => (
                  <article key={row.key} className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                    <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black text-rose-700">{row.subject} · {row.classroom}</div><div className="mt-1 font-black text-slate-950">{row.outcome}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.unit} / {row.topic}</div></div><span className="rounded-full bg-rose-700 px-3 py-1 text-sm font-black text-white">%{row.success}</span></div>
                  </article>
                ))}
                {priorityRows.length === 0 && <p className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800">%50 altında kazanım bulunmuyor.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-black text-slate-950">Güçlü kazanımlar</h2></div>
              <div className="mt-4 space-y-3">
                {strongestRows.map((row) => (
                  <article key={row.key} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black text-emerald-700">{row.subject} · {row.classroom}</div><div className="mt-1 font-black text-slate-950">{row.outcome}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.correct} doğru · {row.total} cevap</div></div><span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-black text-white">%{row.success}</span></div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
