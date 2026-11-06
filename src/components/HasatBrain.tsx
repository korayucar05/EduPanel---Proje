import React from "react";
import localforage from "localforage";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  GraduationCap,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { buildDigitalSchoolTwin, buildHasatLiveSnapshot, hasatLiveEventBus } from "../intelligence-v3";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";

import { sqliteStorage } from "../core/state/SyncStateStore";
type Props = {
  students: any[];
  teachers: any[];
  classrooms: any[];
  onNavigate?: (tab: string) => void;
};

type BrainInsight = {
  id: string;
  priority: number;
  level: "critical" | "warning" | "positive" | "info";
  title: string;
  evidence: string;
  decision: string;
  owner: string;
  horizon: "Şimdi" | "Bugün" | "Bu hafta";
  targetTab: string;
};

type ExamSummary = {
  name: string;
  date: string;
  success: number;
  participantCount: number;
  subjects: Record<string, number>;
};

const levelMeta = {
  critical: { label: "Kritik", className: "border-rose-200 bg-rose-50 text-rose-950", icon: ShieldAlert },
  warning: { label: "İzlem", className: "border-amber-200 bg-amber-50 text-amber-950", icon: AlertTriangle },
  positive: { label: "Olumlu", className: "border-emerald-200 bg-emerald-50 text-emerald-950", icon: TrendingUp },
  info: { label: "Bilgi", className: "border-sky-200 bg-sky-50 text-sky-950", icon: Database },
} as const;

function readArray(keys: string[]) {
  for (const key of keys) {
    try {
      const raw = sqliteStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return Object.values(parsed);
    } catch {
      // Hatalı bir yerel kayıt Brain ekranını durdurmamalı.
    }
  }
  return [];
}

async function readExams() {
  const indexed = await localforage.getItem<any[]>("exams").catch(() => null);
  if (Array.isArray(indexed)) return indexed;
  return readArray(["exams"]);
}

function questionIndexForBooklet(bookletName: string, index: number, count: number) {
  const booklet = String(bookletName || "A").toUpperCase().trim();
  if (booklet === "B") return count - 1 - index;
  if (booklet === "C") return (index + Math.floor(count / 2)) % count;
  if (booklet === "D") return count - 1 - ((index + Math.floor(count / 3)) % count);
  return index;
}

function summarizeExam(exam: any): ExamSummary {
  const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
  const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
  const subjectTotals = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  let total = 0;

  records.forEach((record: any) => {
    const questionCount = structure.reduce(
      (sum: number, test: any) => sum + (Array.isArray(test?.subjects) ? test.subjects : []).reduce(
        (subjectSum: number, subject: any) => subjectSum + Number(subject?.count || 0), 0,
      ), 0,
    );
    const answers = String(record?.answers || "").toUpperCase().padEnd(questionCount, "-").slice(0, questionCount);
    let offset = 0;
    structure.forEach((test: any) => {
      (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
        const name = String(subject?.name || "Ders belirtilmemiş");
        const count = Number(subject?.count || 0);
        const row = subjectTotals.get(name) || { correct: 0, total: 0 };
        for (let index = 0; index < count; index += 1) {
          const originalIndex = questionIndexForBooklet(record?.bookletType, index, count);
          const answer = getQuestionCorrectAnswer(exam?.questions?.[name]?.[originalIndex] || {});
          if (!answer) continue;
          row.total += 1;
          total += 1;
          if ((answers[offset + index] || "-") === answer) {
            row.correct += 1;
            correct += 1;
          }
        }
        subjectTotals.set(name, row);
        offset += count;
      });
    });
  });

  const subjects: Record<string, number> = {};
  subjectTotals.forEach((value, key) => {
    subjects[key] = value.total ? Math.round((value.correct / value.total) * 100) : 0;
  });
  return {
    name: String(exam?.examName || exam?.name || "Adsız sınav"),
    date: String(exam?.examDate || exam?.date || exam?.createdAt || ""),
    success: total ? Math.round((correct / total) * 100) : 0,
    participantCount: records.length,
    subjects,
  };
}

export default function HasatBrain({ students, teachers, classrooms, onNavigate }: Props) {
  const [events, setEvents] = React.useState(() => hasatLiveEventBus.snapshot());
  const [examSummaries, setExamSummaries] = React.useState<ExamSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const exams = await readExams();
    const summaries = exams
      .filter((exam: any) => exam?.isEvaluated && Array.isArray(exam?.studentTxtRecords))
      .map(summarizeExam)
      .filter((exam: ExamSummary) => exam.participantCount > 0)
      .sort((a: ExamSummary, b: ExamSummary) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
    setExamSummaries(summaries);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
    return hasatLiveEventBus.subscribe(() => setEvents(hasatLiveEventBus.snapshot()));
  }, [load]);

  const live = React.useMemo(() => buildHasatLiveSnapshot({
    events,
    studentCount: students.length,
    teacherCount: teachers.length,
    classroomCount: classrooms.length,
  }), [events, students.length, teachers.length, classrooms.length]);

  const twin = React.useMemo(
    () => buildDigitalSchoolTwin({ students, teachers, classrooms, live }),
    [students, teachers, classrooms, live],
  );

  const behaviorCount = readArray(["behavior_records", "behaviorRecords", "edupanel_behavior_records"]).length;
  const disciplineCount = readArray(["discipline_records", "disciplineRecords", "edupanel_discipline_records"]).length;
  const lastExam = examSummaries.at(-1);
  const previousExam = examSummaries.at(-2);
  const academicChange = lastExam && previousExam ? lastExam.success - previousExam.success : 0;

  const subjectChanges = React.useMemo(() => {
    if (!lastExam || !previousExam) return [];
    const names = new Set([...Object.keys(lastExam.subjects), ...Object.keys(previousExam.subjects)]);
    return Array.from(names).map((subject) => ({
      subject,
      change: (lastExam.subjects[subject] ?? 0) - (previousExam.subjects[subject] ?? 0),
      current: lastExam.subjects[subject] ?? 0,
    })).sort((a, b) => a.change - b.change);
  }, [lastExam, previousExam]);

  const insights = React.useMemo<BrainInsight[]>(() => {
    const result: BrainInsight[] = [];
    twin.alerts.slice(0, 3).forEach((alert: any, index: number) => result.push({
      id: `twin-${index}`,
      priority: alert.severity === "critical" ? 96 - index : 78 - index,
      level: alert.severity === "critical" ? "critical" : "warning",
      title: alert.title,
      evidence: alert.description || `Okul sağlık puanı ${twin.schoolHealthScore}, veri güveni %${twin.confidence}.`,
      decision: alert.action,
      owner: alert.title?.toLocaleLowerCase("tr-TR").includes("devam") ? "Rehberlik servisi" : "Okul yönetimi",
      horizon: alert.severity === "critical" ? "Şimdi" : "Bugün",
      targetTab: alert.title?.toLocaleLowerCase("tr-TR").includes("devam") ? "guidance-center" : "digital-school-twin",
    }));

    if (lastExam && previousExam) {
      result.push({
        id: "academic-trend",
        priority: academicChange <= -3 ? 92 : academicChange >= 3 ? 58 : 66,
        level: academicChange <= -3 ? "critical" : academicChange >= 3 ? "positive" : "warning",
        title: academicChange <= -3 ? "Kurum başarısında gerileme sinyali" : academicChange >= 3 ? "Kurum başarısında yükseliş" : "Kurum başarısı yatay seyrediyor",
        evidence: `${previousExam.name} ile ${lastExam.name} arasında başarı ${academicChange >= 0 ? "+" : ""}${academicChange} puan değişti.`,
        decision: academicChange <= -3 ? "Gerileyen dersleri zümre bazında inceleyip iki haftalık telafi planı oluşturun." : academicChange >= 3 ? "Yükselişi sağlayan uygulamaları belirleyip diğer zümrelerle paylaşın." : "Kazanım bazlı veriyi inceleyerek durağan alanlara kısa müdahale planlayın.",
        owner: "Zümre başkanları",
        horizon: academicChange <= -3 ? "Bugün" : "Bu hafta",
        targetTab: "institution-trends",
      });
    }

    const weakest = subjectChanges[0];
    if (weakest && weakest.change <= -3) result.push({
      id: "weak-subject",
      priority: 88,
      level: "critical",
      title: `${weakest.subject} dersinde ortak düşüş`,
      evidence: `Son sınavda başarı %${weakest.current}; önceki sınava göre ${weakest.change} puan değişim var.`,
      decision: "Soru ve kazanım analizi yaparak ortak eksiklere yönelik zümre çalışması başlatın.",
      owner: `${weakest.subject} zümresi`,
      horizon: "Bugün",
      targetTab: "teacher-analytics",
    });

    if (disciplineCount >= 5 || behaviorCount >= 10) result.push({
      id: "discipline-density",
      priority: disciplineCount >= 10 ? 94 : 82,
      level: disciplineCount >= 10 ? "critical" : "warning",
      title: "Davranış ve disiplin kayıtlarında yoğunluk",
      evidence: `${behaviorCount} davranış ve ${disciplineCount} disiplin kaydı sistemde bulunuyor.`,
      decision: "Tekrarlayan öğrencileri sınıf ve olay türüne göre ayırıp rehberlik müdahalesi planlayın.",
      owner: "Rehberlik ve disiplin kurulu",
      horizon: disciplineCount >= 10 ? "Şimdi" : "Bugün",
      targetTab: "discipline-analytics",
    });

    if (!lastExam) result.push({
      id: "exam-data",
      priority: 72,
      level: "info",
      title: "Akademik karar için sınav verisi bekleniyor",
      evidence: "Değerlendirilmiş ve öğrenci cevapları bulunan sınav kaydı bulunamadı.",
      decision: "En az bir sınavı değerlendirerek e-Nstitü Brain akademik analizini etkinleştirin.",
      owner: "Ölçme değerlendirme birimi",
      horizon: "Bu hafta",
      targetTab: "exam-analysis",
    });

    if (result.length === 0) result.push({
      id: "stable",
      priority: 40,
      level: "positive",
      title: "Kritik çapraz risk görünmüyor",
      evidence: `Okul sağlık puanı ${twin.schoolHealthScore}; mevcut veriler dengeli bir görünüm sunuyor.`,
      decision: "Rutin izlemeyi sürdürün ve veri girişlerinin güncelliğini koruyun.",
      owner: "Okul yönetimi",
      horizon: "Bu hafta",
      targetTab: "operations-center",
    });

    return result.sort((a, b) => b.priority - a.priority).slice(0, 8);
  }, [twin, lastExam, previousExam, academicChange, subjectChanges, behaviorCount, disciplineCount]);

  const brainScore = Math.max(0, Math.min(100, Math.round(
    twin.schoolHealthScore - insights.filter((item) => item.level === "critical").length * 6 + insights.filter((item) => item.level === "positive").length * 2,
  )));
  const greeting = new Date().getHours() < 12 ? "Günaydın" : new Date().getHours() < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <main className="mx-auto max-w-[1700px] space-y-5">
        <header className="overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-violet-950 to-indigo-900 p-7 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-3xl">
              <span className="text-[10px] font-black uppercase tracking-[.24em] text-violet-200">e-Nstitü Beyin 1.0 · Kurumsal Karar Zekâsı</span>
              <h1 className="mt-2 text-3xl font-black">{greeting} Koray Hocam</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">Akademik, davranış, rehberlik ve okul sağlığı verileri tek karar gündeminde birleştirildi.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{insights.length} karar sinyali</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{insights.filter((item) => item.level === "critical").length} kritik</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">Veri güveni %{twin.confidence}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{examSummaries.length} sınav</span>
              </div>
            </div>
            <div className="flex h-44 w-44 shrink-0 flex-col items-center justify-center rounded-full border-[10px] border-white/15 bg-white/10 text-center shadow-inner backdrop-blur">
              <BrainCircuit className="h-7 w-7 text-violet-200" />
              <strong className="mt-1 text-5xl font-black">{brainScore}</strong>
              <span className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/65">Karar Sağlığı</span>
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><span className="text-[9px] font-black uppercase tracking-[.16em] text-violet-600">Önceliklendirilmiş gündem</span><h2 className="mt-1 text-lg font-black text-slate-950">e-Nstitü’ın bugün gördüğü önemli konular</h2></div>
              <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Yenile</button>
            </div>
            <div className="mt-5 space-y-3">
              {insights.map((insight) => {
                const meta = levelMeta[insight.level];
                const Icon = meta.icon;
                return <button key={insight.id} type="button" onClick={() => onNavigate?.(insight.targetTab)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${meta.className}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70"><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{insight.title}</strong><span className="rounded-full bg-white/70 px-2 py-1 text-[8px] font-black">{meta.label}</span><span className="rounded-full bg-white/70 px-2 py-1 text-[8px] font-black">Öncelik {insight.priority}</span></div>
                      <p className="mt-1.5 text-[10px] leading-5 opacity-75">{insight.evidence}</p>
                      <div className="mt-3 rounded-xl bg-white/60 p-3"><span className="text-[8px] font-black uppercase tracking-[.12em] opacity-55">Önerilen karar</span><p className="mt-1 text-[10px] font-bold leading-5">{insight.decision}</p></div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[8px] font-black opacity-70"><span>{insight.owner}</span><span>•</span><span>{insight.horizon}</span></div>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0 opacity-45" />
                  </div>
                </button>;
              })}
            </div>
          </article>

          <div className="space-y-5">
            <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-violet-700" /><h2 className="text-sm font-black text-slate-950">Çapraz Veri Özeti</h2></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric icon={HeartPulse} label="Okul sağlığı" value={twin.schoolHealthScore} suffix="/100" />
                <Metric icon={GraduationCap} label="Son sınav" value={lastExam?.success ?? 0} suffix={lastExam ? "%" : " veri yok"} />
                <Metric icon={Users} label="Öğrenci" value={students.length} />
                <Metric icon={ShieldAlert} label="Disiplin" value={disciplineCount} />
              </div>
              {lastExam && <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><span className="text-[8px] font-black uppercase tracking-[.12em] text-white/50">Son akademik ölçüm</span><strong className="mt-1 block text-sm">{lastExam.name}</strong><p className="mt-1 text-[10px] text-white/65">{lastExam.participantCount} öğrenci · Başarı %{lastExam.success} · Değişim {academicChange >= 0 ? "+" : ""}{academicChange} puan</p></div>}
            </article>

            <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-indigo-700" /><h2 className="text-sm font-black text-slate-950">Karar Takvimi</h2></div>
              <div className="mt-4 space-y-3">
                {(["Şimdi", "Bugün", "Bu hafta"] as const).map((horizon) => {
                  const count = insights.filter((item) => item.horizon === horizon).length;
                  return <div key={horizon} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-black text-slate-800">{horizon}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${count ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>{count ? `${count} işlem` : "Temiz"}</span></div>;
                })}
              </div>
            </article>

            <article className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm">
              <CheckCircle2 className="h-6 w-6" /><strong className="mt-3 block text-sm">Brain çalışma ilkesi</strong><p className="mt-2 text-[10px] leading-5 opacity-75">Bu ekran üretken yapay zekâ ile sayı uydurmaz. Yalnızca e-Nstitü içindeki kayıtları çaprazlar, kanıtı gösterir ve kural tabanlı karar önerisi üretir.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, suffix = "" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; suffix?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><Icon className="h-4 w-4 text-slate-500" /><span className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-slate-400">{label}</span><strong className="mt-1 block text-2xl text-slate-950">{value}{suffix}</strong></div>;
}
