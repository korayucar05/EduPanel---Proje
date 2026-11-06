import React from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  MessageCircle,
  School,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { buildDigitalSchoolTwin, buildHasatLiveSnapshot, hasatLiveEventBus } from "../intelligence-v3";

import { sqliteStorage } from "../core/state/SyncStateStore";
type Props = {
  students: any[];
  teachers: any[];
  classrooms: any[];
  onNavigate?: (tab: string) => void;
};

type OperationItem = {
  id: string;
  title: string;
  detail: string;
  urgency: "critical" | "today" | "week";
  targetTab: string;
};

const urgencyMeta = {
  critical: { label: "Hemen", className: "border-rose-200 bg-rose-50 text-rose-900", dot: "bg-rose-500" },
  today: { label: "Bugün", className: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  week: { label: "Bu hafta", className: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" },
} as const;

function readCount(keys: string[]) {
  for (const key of keys) {
    try {
      const raw = sqliteStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    } catch {
      // Geçersiz yerel kayıt operasyon ekranını durdurmamalı.
    }
  }
  return 0;
}

export default function HasatOperationsCenter({ students, teachers, classrooms, onNavigate }: Props) {
  const [events, setEvents] = React.useState(() => hasatLiveEventBus.snapshot());
  React.useEffect(() => hasatLiveEventBus.subscribe(() => setEvents(hasatLiveEventBus.snapshot())), []);

  const live = React.useMemo(
    () => buildHasatLiveSnapshot({
      events,
      studentCount: students.length,
      teacherCount: teachers.length,
      classroomCount: classrooms.length,
    }),
    [events, students.length, teachers.length, classrooms.length],
  );

  const twin = React.useMemo(
    () => buildDigitalSchoolTwin({ students, teachers, classrooms, live }),
    [students, teachers, classrooms, live],
  );

  const operationalCounts = React.useMemo(() => ({
    behavior: readCount(["behavior_records", "behaviorRecords", "edupanel_behavior_records"]),
    discipline: readCount(["discipline_records", "disciplineRecords", "edupanel_discipline_records"]),
    messages: readCount(["message_history", "messageHistory", "edupanel_message_history"]),
    announcements: readCount(["announcements", "edupanel_announcements"]),
  }), [events.length]);

  const operations = React.useMemo<OperationItem[]>(() => {
    const items: OperationItem[] = [];
    twin.alerts.slice(0, 3).forEach((alert, index) => {
      items.push({
        id: `twin-${index}`,
        title: alert.title,
        detail: alert.action,
        urgency: alert.severity === "critical" ? "critical" : "today",
        targetTab: alert.title.toLocaleLowerCase("tr-TR").includes("devam") ? "guidance-center" : "hasat-ai-commander",
      });
    });
    if (operationalCounts.discipline > 0) {
      items.push({
        id: "discipline",
        title: `${operationalCounts.discipline} disiplin kaydı takipte`,
        detail: "Bekleyen kayıtları ve kurul sürecini kontrol edin.",
        urgency: operationalCounts.discipline >= 5 ? "critical" : "today",
        targetTab: "discipline",
      });
    }
    if (operationalCounts.behavior > 0) {
      items.push({
        id: "behavior",
        title: `${operationalCounts.behavior} davranış kaydı mevcut`,
        detail: "Tekrarlayan davranışları rehberlik riskiyle birlikte inceleyin.",
        urgency: "week",
        targetTab: "behavior",
      });
    }
    if (items.length === 0) {
      items.push({
        id: "healthy",
        title: "Acil yönetsel işlem görünmüyor",
        detail: "Rutin izlemeyi sürdürün ve yeni veri girişlerini takip edin.",
        urgency: "week",
        targetTab: "digital-school-twin",
      });
    }
    return items.slice(0, 6);
  }, [twin.alerts, operationalCounts]);

  const today = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const greeting = new Date().getHours() < 12 ? "Günaydın" : new Date().getHours() < 18 ? "İyi günler" : "İyi akşamlar";

  const quickActions = [
    { label: "Veli mesajı", tab: "messages", icon: MessageCircle },
    { label: "Rehberlik", tab: "guidance-center", icon: Users },
    { label: "Disiplin", tab: "discipline", icon: ShieldAlert },
    { label: "Sınav raporları", tab: "exam-reports", icon: ClipboardList },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <main className="mx-auto max-w-[1700px] space-y-5">
        <header className="overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-indigo-950 to-sky-900 p-7 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.22em] text-white/55">e-Nstitü Operations 1.0</span>
              <h1 className="mt-2 text-3xl font-black">{greeting} Koray Hocam</h1>
              <p className="mt-2 text-sm text-white/70">{today} · Okulun bugünkü akademik ve yönetsel görünümü hazır.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{students.length} öğrenci</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{teachers.length} öğretmen</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{classrooms.length} sınıf</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">Veri güveni %{twin.confidence}</span>
              </div>
            </div>
            <div className="flex h-44 w-44 shrink-0 flex-col items-center justify-center rounded-full border-[10px] border-white/15 bg-white/10 text-center shadow-inner backdrop-blur">
              <HeartPulse className="h-7 w-7 text-emerald-300" />
              <strong className="mt-1 text-5xl font-black">{twin.schoolHealthScore}</strong>
              <span className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/65">Okul Sağlık Puanı</span>
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr_.8fr]">
          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-rose-600" /><h2 className="text-sm font-black text-slate-900">Operasyon Kuyruğu</h2></div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500">{operations.length} işlem</span>
            </div>
            <div className="mt-4 space-y-3">
              {operations.map((item) => {
                const meta = urgencyMeta[item.urgency];
                return <button key={item.id} type="button" onClick={() => onNavigate?.(item.targetTab)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${meta.className}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs">{item.title}</strong><span className="rounded-full bg-white/70 px-2 py-1 text-[8px] font-black">{meta.label}</span></div><p className="mt-1.5 text-[10px] leading-5 opacity-70">{item.detail}</p></div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 opacity-50" />
                  </div>
                </button>;
              })}
            </div>
          </article>

          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><School className="h-5 w-5 text-teal-700" /><h2 className="text-sm font-black text-slate-900">Okul Nabzı</h2></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {twin.metrics.slice(0, 6).map((metric) => <div key={metric.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-[8px] font-black uppercase tracking-[.1em] text-slate-400">{metric.label}</span>
                <div className="mt-2 flex items-end justify-between gap-2"><strong className="text-2xl text-slate-900">{metric.score}</strong><span className="text-[8px] font-bold text-slate-400">Güven %{metric.confidence}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-slate-800" style={{ width: `${metric.score}%` }} /></div>
              </div>)}
            </div>
            <button type="button" onClick={() => onNavigate?.("digital-school-twin")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-xs font-black text-white"><Activity className="h-4 w-4" />Dijital ikizi aç</button>
          </article>

          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-indigo-700" /><h2 className="text-sm font-black text-slate-900">Bugünün Kontrolü</h2></div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="h-5 w-5" /><strong className="mt-2 block text-xs">Veri senkronizasyonu</strong><p className="mt-1 text-[10px] opacity-70">Öğrenci, öğretmen ve sınıf verileri operasyon ekranına alındı.</p></div>
              <div className="rounded-2xl bg-amber-50 p-4 text-amber-900"><AlertCircle className="h-5 w-5" /><strong className="mt-2 block text-xs">Takip gerektiren alan</strong><p className="mt-1 text-[10px] opacity-70">{twin.alerts[0]?.title ?? "Yeni kritik uyarı bulunmuyor."}</p></div>
              <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-900"><Sparkles className="h-5 w-5" /><strong className="mt-2 block text-xs">e-Nstitü önerisi</strong><p className="mt-1 text-[10px] leading-5 opacity-70">{twin.alerts[0]?.action ?? "Rutin izlemeyi sürdürün ve gün sonu veri girişlerini tamamlayın."}</p></div>
            </div>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(({ label, tab, icon: Icon }) => <button key={tab} type="button" onClick={() => onNavigate?.(tab)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon className="h-4 w-4" /></span><span className="text-xs font-black text-slate-900">{label}</span><ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
          </button>)}
        </section>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[10px] leading-5 text-sky-900">
          Operasyon Merkezi yalnızca sistemde bulunan kayıtlardan karar desteği üretir. Veri bulunmayan alanlarda sayı uydurulmaz; sonuçların güven düzeyi Dijital Okul İkizi üzerinden gösterilir.
        </div>
      </main>
    </div>
  );
}
