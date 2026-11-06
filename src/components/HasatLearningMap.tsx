import React, { useEffect, useMemo, useState } from "react";
import localforage from "localforage";
import {
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Filter,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";

import { sqliteStorage } from "../core/state/SyncStateStore";
type LearningStatus = "mastered" | "developing" | "priority" | "no-data";

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
  status: LearningStatus;
};

type SubjectSummary = {
  subject: string;
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  success: number;
  mastered: number;
  developing: number;
  priority: number;
};

interface HasatLearningMapProps {
  students?: any[];
  onNavigate?: (tab: string) => void;
}

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

const normalizeClassroom = (value: unknown) =>
  String(value || "Sınıfsız")
    .trim()
    .replace(/^(\d+)\s*[-/]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)$/u, "$1-$2")
    .toLocaleUpperCase("tr-TR");

const normalizeStudentNumber = (value: unknown) => {
  const raw = String(value || "").trim();
  const withoutLeadingZeros = raw.replace(/^0+/, "");
  return withoutLeadingZeros || raw || "N/A";
};

const statusForSuccess = (success: number, total: number): LearningStatus => {
  if (!total) return "no-data";
  if (success >= 75) return "mastered";
  if (success >= 50) return "developing";
  return "priority";
};

const statusLabel: Record<LearningStatus, string> = {
  mastered: "Öğrenildi",
  developing: "Gelişiyor",
  priority: "Öncelikli",
  "no-data": "Veri yok",
};

const statusClass: Record<LearningStatus, string> = {
  mastered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  developing: "border-amber-200 bg-amber-50 text-amber-800",
  priority: "border-rose-200 bg-rose-50 text-rose-800",
  "no-data": "border-slate-200 bg-slate-50 text-slate-600",
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

const buildRows = (exam: any, records: any[]): OutcomeRow[] => {
  const aggregate = new Map<string, OutcomeRow>();
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];

  records.forEach((record) => {
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
            status: "no-data" as LearningStatus,
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
    .map((row) => {
      const success = row.total ? Math.round((row.correct / row.total) * 100) : 0;
      return { ...row, success, status: statusForSuccess(success, row.total) };
    })
    .sort((a, b) => a.success - b.success || b.total - a.total || a.outcome.localeCompare(b.outcome, "tr"));
};

export default function HasatLearningMap({ students = [], onNavigate }: HasatLearningMapProps) {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState("Tümü");
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("Tümü");
  const [selectedSubject, setSelectedSubject] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const saved = await readExams();
    const evaluated = saved.filter((exam) => exam?.isEvaluated && Array.isArray(exam?.studentTxtRecords));
    setExams(evaluated);
    setSelectedExamId((current) => (evaluated.some((exam) => exam.id === current) ? current : evaluated[0]?.id || ""));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const activeExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId), [exams, selectedExamId]);
  const examRecords = useMemo(() => (Array.isArray(activeExam?.studentTxtRecords) ? activeExam.studentTxtRecords : []), [activeExam]);

  const classrooms = useMemo(
    () => Array.from(new Set<string>(examRecords.map((record: any) => normalizeClassroom(record?.gradeLevel)))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true })),
    [examRecords],
  );

  const studentOptions = useMemo(() => {
    const fromRecords = examRecords.map((record: any) => ({
      number: normalizeStudentNumber(record?.studentNumber),
      name: String(record?.studentName || "Bilinmeyen öğrenci"),
      classroom: normalizeClassroom(record?.gradeLevel),
    }));
    const merged = new Map<string, { number: string; name: string; classroom: string }>();
    fromRecords.forEach((item) => merged.set(item.number, item));
    students.forEach((student: any) => {
      const number = normalizeStudentNumber(student?.studentNumber ?? student?.number ?? student?.schoolNumber ?? student?.id);
      if (merged.has(number)) {
        const current = merged.get(number)!;
        merged.set(number, {
          number,
          name: String(student?.name || student?.fullName || student?.studentName || current.name),
          classroom: normalizeClassroom(student?.classroom || student?.className || student?.gradeLevel || current.classroom),
        });
      }
    });
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [examRecords, students]);

  const selectedRecords = useMemo(
    () =>
      examRecords.filter((record: any) => {
        const classroomMatches = selectedClassroom === "Tümü" || normalizeClassroom(record?.gradeLevel) === selectedClassroom;
        const studentMatches = selectedStudentNumber === "Tümü" || normalizeStudentNumber(record?.studentNumber) === selectedStudentNumber;
        return classroomMatches && studentMatches;
      }),
    [examRecords, selectedClassroom, selectedStudentNumber],
  );

  const rows = useMemo(() => buildRows(activeExam, selectedRecords), [activeExam, selectedRecords]);
  const subjects = useMemo(() => Array.from(new Set<string>(rows.map((row) => row.subject))).sort((a, b) => a.localeCompare(b, "tr")), [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((row) => {
      if (selectedSubject !== "Tümü" && row.subject !== selectedSubject) return false;
      if (!normalizedSearch) return true;
      return [row.subject, row.unit, row.topic, row.outcome].some((value) => value.toLocaleLowerCase("tr-TR").includes(normalizedSearch));
    });
  }, [rows, search, selectedSubject]);

  const summaries = useMemo<SubjectSummary[]>(() => {
    const map = new Map<string, SubjectSummary>();
    rows.forEach((row) => {
      const current = map.get(row.subject) || {
        subject: row.subject,
        correct: 0,
        wrong: 0,
        empty: 0,
        total: 0,
        success: 0,
        mastered: 0,
        developing: 0,
        priority: 0,
      };
      current.correct += row.correct;
      current.wrong += row.wrong;
      current.empty += row.empty;
      current.total += row.total;
      if (row.status === "mastered") current.mastered += 1;
      if (row.status === "developing") current.developing += 1;
      if (row.status === "priority") current.priority += 1;
      map.set(row.subject, current);
    });
    return Array.from(map.values())
      .map((item) => ({ ...item, success: item.total ? Math.round((item.correct / item.total) * 100) : 0 }))
      .sort((a, b) => a.success - b.success);
  }, [rows]);

  const overall = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    return {
      success: total ? Math.round((correct / total) * 100) : 0,
      mastered: rows.filter((row) => row.status === "mastered").length,
      developing: rows.filter((row) => row.status === "developing").length,
      priority: rows.filter((row) => row.status === "priority").length,
    };
  }, [rows]);

  const selectedStudent = studentOptions.find((item) => item.number === selectedStudentNumber);

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                <BrainCircuit className="h-4 w-4" /> e-Nstitü Learning Intelligence 1.0
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Öğrenme Haritası</h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 md:text-base">
                Sınav cevaplarını ders, ünite, konu ve kazanım düzeyinde birleştirir; öğrenilmiş alanları ve öncelikli eksikleri görünür hâle getirir.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {[
                ["Başarı", `%${overall.success}`, TrendingUp],
                ["Öğrenildi", String(overall.mastered), CheckCircle2],
                ["Gelişiyor", String(overall.developing), Target],
                ["Öncelikli", String(overall.priority), CircleAlert],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <Icon className="mb-3 h-5 w-5 text-emerald-300" />
                  <div className="text-2xl font-black">{value}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-5">
            <label className="space-y-2 lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Sınav</span>
              <select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400">
                {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name || exam.examName || exam.title || "İsimsiz sınav"}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Sınıf</span>
              <select value={selectedClassroom} onChange={(event) => { setSelectedClassroom(event.target.value); setSelectedStudentNumber("Tümü"); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400">
                <option>Tümü</option>
                {classrooms.map((classroom) => <option key={classroom}>{classroom}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Öğrenci</span>
              <select value={selectedStudentNumber} onChange={(event) => setSelectedStudentNumber(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400">
                <option value="Tümü">Tüm öğrenciler</option>
                {studentOptions.filter((item) => selectedClassroom === "Tümü" || item.classroom === selectedClassroom).map((item) => <option key={item.number} value={item.number}>{item.name} · {item.number}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => void load()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-700">
                <RefreshCw className="h-4 w-4" /> Veriyi Yenile
              </button>
            </div>
          </div>
          {selectedStudent && <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-900">Aktif profil: {selectedStudent.name} · {selectedStudent.classroom} · No {selectedStudent.number}</div>}
        </section>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-3xl border border-slate-200 bg-white"><Loader2 className="mr-3 h-6 w-6 animate-spin text-indigo-600" /><span className="font-bold text-slate-600">Öğrenme verileri hazırlanıyor...</span></div>
        ) : exams.length === 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center">
            <BookOpenCheck className="mx-auto h-12 w-12 text-amber-600" />
            <h2 className="mt-4 text-xl font-black text-amber-950">Değerlendirilmiş sınav bulunamadı</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-amber-800">Öğrenme Haritası için cevap anahtarı ve öğrenci cevapları bulunan en az bir sınavı Sınav Analiz ekranında değerlendirin.</p>
            <button type="button" onClick={() => onNavigate?.("exam-analysis")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-3 text-sm font-black text-white hover:bg-amber-800">Sınav Analize Git <ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : selectedRecords.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600"><Users className="mx-auto h-11 w-11 text-slate-400" /><h2 className="mt-4 text-xl font-black text-slate-900">Seçime uygun öğrenci kaydı yok</h2><p className="mt-2 text-sm font-medium">Sınıf veya öğrenci filtresini değiştirin.</p></div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaries.map((summary) => (
                <button key={summary.subject} type="button" onClick={() => setSelectedSubject(summary.subject)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-slate-400">Ders başarı haritası</div><h3 className="mt-1 text-lg font-black text-slate-900">{summary.subject}</h3></div><div className="rounded-xl bg-indigo-50 px-3 py-2 text-lg font-black text-indigo-700">%{summary.success}</div></div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${summary.success}%` }} /></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black"><div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700">{summary.mastered}<span className="block text-[10px] font-bold">Öğrenildi</span></div><div className="rounded-lg bg-amber-50 px-2 py-2 text-amber-700">{summary.developing}<span className="block text-[10px] font-bold">Gelişiyor</span></div><div className="rounded-lg bg-rose-50 px-2 py-2 text-rose-700">{summary.priority}<span className="block text-[10px] font-bold">Öncelikli</span></div></div>
                </button>
              ))}
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-600"><GraduationCap className="h-4 w-4" /> Kazanım matrisi</div><h2 className="mt-2 text-2xl font-black text-slate-950">Öncelikli öğrenme alanları</h2><p className="mt-1 text-sm font-medium text-slate-500">Başarı oranı düşük kazanımlar listenin üstünde gösterilir.</p></div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kazanım, konu veya ünite ara" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-bold outline-none focus:border-indigo-400 sm:w-72" /></label>
                    <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="h-11 min-w-44 appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm font-bold outline-none focus:border-indigo-400"><option>Tümü</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Ders / Ünite</th><th className="px-5 py-4">Konu / Kazanım</th><th className="px-5 py-4 text-center">D-Y-B</th><th className="px-5 py-4">Başarı</th><th className="px-5 py-4">Durum</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => (
                      <tr key={row.key} className="align-top hover:bg-slate-50/80"><td className="px-5 py-4"><div className="font-black text-slate-900">{row.subject}</div><div className="mt-1 text-xs font-bold text-slate-500">{row.unit}</div></td><td className="max-w-2xl px-5 py-4"><div className="text-sm font-black text-slate-800">{row.topic}</div><div className="mt-1 text-xs font-medium leading-5 text-slate-500">{row.outcome}</div></td><td className="px-5 py-4 text-center text-xs font-black"><span className="text-emerald-700">{row.correct}</span> · <span className="text-rose-700">{row.wrong}</span> · <span className="text-slate-500">{row.empty}</span></td><td className="min-w-44 px-5 py-4"><div className="flex items-center justify-between text-xs font-black text-slate-700"><span>%{row.success}</span><span>{row.correct}/{row.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.status === "mastered" ? "bg-emerald-500" : row.status === "developing" ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${row.success}%` }} /></div></td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass[row.status]}`}>{statusLabel[row.status]}</span></td></tr>
                    ))}
                  </tbody>
                </table>
                {filteredRows.length === 0 && <div className="p-10 text-center text-sm font-bold text-slate-500">Arama ve filtre ölçütlerine uygun kazanım bulunamadı.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
