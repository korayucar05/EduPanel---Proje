import React from "react";

const DashboardLearningInsights = React.lazy(() => import("./DashboardLearningInsights"));
const DashboardBrainDecisions = React.lazy(() => import("./DashboardBrainDecisions"));
const DashboardProductionReadiness = React.lazy(() => import("./DashboardProductionReadiness"));
const DashboardAuditTrail = React.lazy(() => import("./DashboardAuditTrail"));
const DashboardNotificationCenter = React.lazy(() => import("./DashboardNotificationCenter"));
const DashboardManagementBriefing = React.lazy(() => import("./DashboardManagementBriefing"));
const DashboardExecutiveIntelligence = React.lazy(() => import("./DashboardExecutiveIntelligence"));
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { sqliteStorage } from "../../core/state/SyncStateStore";
type DashboardStats = {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  dailyAttendanceRate: number;
  gpaAverage: number;
};

type ExecutiveDashboardHeroProps = {
  stats: DashboardStats;
  students: Array<Record<string, any>>;
  announcements: Array<Record<string, any>>;
  onNavigate: (tab: string) => void;
  taskScope: { schoolId: string; userId: string; userName: string };
};

type ExamSnapshot = {
  id: string;
  name: string;
  date: string;
  studentCount: number;
  averageScore: number | null;
  change: number | null;
};

type StoredSnapshot = {
  behaviorCount: number;
  disciplineCount: number;
  evaluatedExams: ExamSnapshot[];
  examTrend: ExamSnapshot[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function DashboardSectionSkeleton({ label = "Panel hazırlanıyor" }: { label?: string }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm" role="status" aria-live="polite">
      <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-6 w-64 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

const DeferredPanel = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <React.Suspense fallback={<DashboardSectionSkeleton label={label} />}>{children}</React.Suspense>
);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
};

const normalizeClassroom = (student: Record<string, any>) =>
  String(student.classroom || student.className || student.grade || "Sınıfsız").trim() || "Sınıfsız";

const readStoredArray = (keys: string[]): any[] => {
  if (typeof window === "undefined") return [];
  for (const key of keys) {
    try {
      const raw = sqliteStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      if (parsed && typeof parsed === "object") return Object.values(parsed);
    } catch {
      // Bozuk bir yerel kayıt yönetici ekranının açılmasını engellememeli.
    }
  }
  return [];
};


const finiteNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;

const extractExamAverage = (exam: Record<string, any>): number | null => {
  const directCandidates = [
    exam.averageScore, exam.examAverage, exam.institutionAverage, exam.schoolAverage,
    exam.averageSuccess, exam.successRate, exam.statistics?.averageScore,
    exam.statistics?.successRate, exam.analysis?.averageScore, exam.analysis?.successRate,
  ];
  for (const candidate of directCandidates) {
    const value = finiteNumber(candidate);
    if (value !== null) return clamp(value <= 5 ? value * 20 : value);
  }

  const results = Array.isArray(exam.studentResults)
    ? exam.studentResults
    : Array.isArray(exam.results)
      ? exam.results
      : [];
  const values = results
    .map((result: Record<string, any>) =>
      finiteNumber(result.successRate ?? result.score ?? result.percentage ?? result.totalScore ?? result.totals?.successRate),
    )
    .filter((value: number | null): value is number => value !== null)
    .map((value) => clamp(value <= 5 ? value * 20 : value));
  const resultAverage = average(values);
  return resultAverage === null ? null : Number(resultAverage.toFixed(1));
};

const getExamName = (exam: Record<string, any>, index: number) =>
  String(exam.name || exam.title || exam.examName || exam.testName || `Sınav ${index + 1}`);

const getExamDate = (exam: Record<string, any>) => {
  const raw = exam.examDate || exam.date || exam.createdAt || exam.updatedAt;
  if (!raw) return "Tarih bilgisi yok";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(raw);
  return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

const isEvaluatedExam = (exam: Record<string, any>) => {
  const status = String(exam.status || exam.state || exam.analysisStatus || "").toLocaleLowerCase("tr-TR");
  return Boolean(
    exam.evaluated ||
    exam.isEvaluated ||
    exam.results ||
    exam.studentResults ||
    exam.analysis ||
    status.includes("değerlendir") ||
    status.includes("tamam") ||
    status.includes("sonuç"),
  );
};

const readOperationalSnapshot = (): StoredSnapshot => {
  const behavior = readStoredArray(["behaviorRecords", "behavior_records", "edupanel_behavior_records"]);
  const warnings = readStoredArray(["disciplineWarnings", "discipline_warnings"]);
  const board = readStoredArray(["disciplineBoardRecords", "discipline_records", "disciplineRecords"]);
  const archive = readStoredArray(["disciplineArchiveRecords", "discipline_archive_records"]);
  const exams = readStoredArray(["exams", "examRecords", "edupanel_exams"]);

  const chronological = exams
    .filter((exam) => exam && typeof exam === "object" && isEvaluatedExam(exam))
    .map((exam, index) => ({
      id: String(exam.id || exam.examId || `exam-${index}`),
      name: getExamName(exam, index),
      date: getExamDate(exam),
      studentCount: Number(
        exam.studentCount || exam.participantCount || exam.results?.length || exam.studentResults?.length || 0,
      ),
      averageScore: extractExamAverage(exam),
      sortDate: new Date(exam.examDate || exam.date || exam.updatedAt || exam.createdAt || 0).getTime(),
    }))
    .sort((a, b) => a.sortDate - b.sortDate)
    .slice(-6);

  const withChanges: ExamSnapshot[] = chronological.map((exam, index) => {
    const previous = index > 0 ? chronological[index - 1].averageScore : null;
    const change = exam.averageScore !== null && previous !== null
      ? Number((exam.averageScore - previous).toFixed(1))
      : null;
    const { sortDate: _sortDate, ...snapshot } = exam;
    return { ...snapshot, change };
  });

  return {
    behaviorCount: behavior.length,
    disciplineCount: warnings.length + board.length + archive.length,
    evaluatedExams: [...withChanges].reverse().slice(0, 3),
    examTrend: withChanges,
  };
};
export default function ExecutiveDashboardHero({
  stats,
  students,
  announcements,
  onNavigate,
  taskScope,
}: ExecutiveDashboardHeroProps) {
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const [lastUpdated, setLastUpdated] = React.useState(() => new Date());
  const [selectedClassroom, setSelectedClassroom] = React.useState<string | null>(null);

  React.useEffect(() => {
    const refresh = () => {
      setRefreshVersion((value) => value + 1);
      setLastUpdated(new Date());
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("storage", refresh);
    window.addEventListener("hasat:data-changed", refresh as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("hasat:data-changed", refresh as EventListener);
    };
  }, []);

  const operational = React.useMemo(() => readOperationalSnapshot(), [refreshVersion]);

  const dashboard = React.useMemo(() => {
    const activeStudents = students.filter((student) => student.status === "Aktif" || !student.status);
    const criticalStudents = activeStudents.filter((student) => Number(student.absences || 0) > 10);
    const warningStudents = activeStudents.filter((student) => {
      const absence = Number(student.absences || 0);
      return absence > 5 && absence <= 10;
    });

    const attendanceScore = stats.dailyAttendanceRate > 0
      ? clamp(stats.dailyAttendanceRate)
      : activeStudents.length > 0
        ? clamp(100 - (criticalStudents.length / activeStudents.length) * 100)
        : 0;

    const academicScore = stats.gpaAverage > 0
      ? clamp(stats.gpaAverage <= 5 ? stats.gpaAverage * 20 : stats.gpaAverage)
      : operational.evaluatedExams.length > 0
        ? 70
        : 0;

    const dataSignals = [
      stats.totalStudents > 0,
      stats.totalTeachers > 0,
      stats.totalClasses > 0,
      announcements.length > 0,
      operational.evaluatedExams.length > 0,
      operational.behaviorCount + operational.disciplineCount > 0,
    ];
    const dataCoverage = clamp((dataSignals.filter(Boolean).length / dataSignals.length) * 100);

    const behaviorScore = clamp(100 - Math.min(45, operational.behaviorCount * 2 + operational.disciplineCount * 4));
    const schoolHealth = activeStudents.length > 0
      ? clamp(academicScore * 0.35 + attendanceScore * 0.35 + behaviorScore * 0.15 + dataCoverage * 0.15)
      : 0;

    const classrooms = new Map<string, { count: number; critical: number; warning: number }>();
    activeStudents.forEach((student) => {
      const key = normalizeClassroom(student);
      const current = classrooms.get(key) || { count: 0, critical: 0, warning: 0 };
      current.count += 1;
      const absence = Number(student.absences || 0);
      if (absence > 10) current.critical += 1;
      else if (absence > 5) current.warning += 1;
      classrooms.set(key, current);
    });

    const classroomHeat = Array.from(classrooms.entries())
      .map(([name, value]) => {
        const riskRate = value.count > 0 ? ((value.critical * 2 + value.warning) / (value.count * 2)) * 100 : 0;
        return {
          name,
          ...value,
          riskRate: clamp(riskRate),
          level: riskRate >= 30 ? "critical" : riskRate >= 12 ? "watch" : "good",
        } as const;
      })
      .sort((a, b) => b.riskRate - a.riskRate || a.name.localeCompare(b.name, "tr"))
      .slice(0, 12);

    return {
      criticalStudents,
      warningStudents,
      attendanceScore,
      academicScore,
      behaviorScore,
      dataCoverage,
      schoolHealth,
      classroomHeat,
    };
  }, [announcements.length, operational, stats, students]);

  const selectedClass = React.useMemo(
    () => dashboard.classroomHeat.find((classroom) => classroom.name === selectedClassroom) || null,
    [dashboard.classroomHeat, selectedClassroom],
  );

  const priorities = React.useMemo(() => {
    const items: Array<{ level: "critical" | "watch" | "positive"; title: string; detail: string; tab: string }> = [];

    if (dashboard.criticalStudents.length > 0) {
      items.push({
        level: "critical",
        title: `${dashboard.criticalStudents.length} öğrenci kritik devamsızlık sınırında`,
        detail: "Veli iletişimi ve rehberlik takibi bugün başlatılmalı.",
        tab: "guidance-center",
      });
    }
    if (operational.disciplineCount > 0) {
      items.push({
        level: operational.disciplineCount >= 5 ? "critical" : "watch",
        title: `${operational.disciplineCount} disiplin kaydı takip bekliyor`,
        detail: "Bekleyen uyarı ve kurul süreçlerini öncelik sırasına göre inceleyin.",
        tab: "discipline-analytics",
      });
    }
    if (dashboard.warningStudents.length > 0) {
      items.push({
        level: "watch",
        title: `${dashboard.warningStudents.length} öğrenci devamsızlık izleme listesinde`,
        detail: "5–10 gün devamsızlığı bulunan öğrencileri sınıf bazında inceleyin.",
        tab: "students",
      });
    }
    if (operational.evaluatedExams.length === 0) {
      items.push({
        level: "watch",
        title: "Değerlendirilmiş sınav verisi bulunamadı",
        detail: "Akademik kararların güçlenmesi için son sınav sonuçlarını sisteme aktarın.",
        tab: "exam-prepare",
      });
    } else {
      items.push({
        level: "positive",
        title: `${operational.evaluatedExams.length} güncel sınav analize hazır`,
        detail: "Sonuçları kurum trendleri ve öğrenme haritasında inceleyebilirsiniz.",
        tab: "exam-reports",
      });
    }
    if (items.length < 3) {
      items.push({
        level: dashboard.dataCoverage < 75 ? "watch" : "positive",
        title: dashboard.dataCoverage < 75 ? "Bazı yönetim verileri henüz eksik" : "Yönetim verisi yeterli kapsamda",
        detail: `Veri kapsamı %${dashboard.dataCoverage}. Karar güveni veri girişiyle artar.`,
        tab: "database",
      });
    }

    return items.slice(0, 4);
  }, [dashboard, operational]);

  const quickActions = [
    { label: "Sınav Hazırla", detail: "Yeni sınav oluştur", tab: "exam-prepare", icon: BookOpenCheck },
    { label: "Sınav Raporları", detail: "Sonuçları incele", tab: "exam-reports", icon: FileText },
    { label: "Rehberlik", detail: "Risk ve görüşmeler", tab: "guidance-center", icon: HeartHandshake },
    { label: "Disiplin", detail: "Süreç ve kayıtlar", tab: "discipline", icon: Scale },
    { label: "Mesaj Gönder", detail: "Veli ve öğretmen", tab: "messages", icon: MessageSquare },
    { label: "e-Nstitü Brain", detail: "Kurumsal karar zekâsı", tab: "hasat-brain", icon: Brain },
  ];

  const handleRefresh = () => {
    setRefreshVersion((value) => value + 1);
    setLastUpdated(new Date());
  };

  return (
    <section className="space-y-5" aria-label="e-Nstitü Yönetici Kontrol Merkezi">
      <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_.75fr] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">
                e-Nstitü v1.0 Release Candidate
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-300">
                Veri güveni %{dashboard.dataCoverage}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-300 transition hover:bg-white/10"
                title="Dashboard verilerini yenile"
              >
                <RefreshCw className="h-3 w-3" />
                {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </button>
            </div>
            <p className="mt-6 text-sm font-semibold text-slate-300">{getGreeting()} Koray Hocam</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Okulun bugünkü durumunu tek ekrandan yönetin.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Kritik öğrenciler, sınavlar, davranış kayıtları ve öncelikli işlemler mevcut veriler üzerinden canlı olarak özetlendi.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Aktif öğrenci", stats.activeStudents || stats.totalStudents, GraduationCap],
                ["Öğretmen", stats.totalTeachers, Users],
                ["Sınıf", stats.totalClasses, ShieldCheck],
                ["Kritik öğrenci", dashboard.criticalStudents.length, Activity],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  {React.createElement(Icon as React.ElementType, { className: "h-5 w-5 text-emerald-300" })}
                  <strong className="mt-3 block text-2xl font-black">{String(value)}</strong>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{String(label)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-white/[.06] p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Okul Sağlık Puanı</span>
                  <div className="mt-2 flex items-end gap-2">
                    <strong className="text-6xl font-black">{dashboard.schoolHealth}</strong>
                    <span className="pb-2 text-sm font-bold text-slate-400">/100</span>
                  </div>
                </div>
                <Sparkles className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${dashboard.schoolHealth}%` }} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-black/20 p-3">
                  <span className="text-slate-400">Akademik</span>
                  <strong className="mt-1 block text-lg">{dashboard.academicScore}</strong>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <span className="text-slate-400">Devam</span>
                  <strong className="mt-1 block text-lg">{dashboard.attendanceScore}</strong>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <span className="text-slate-400">Davranış</span>
                  <strong className="mt-1 block text-lg">{dashboard.behaviorScore}</strong>
                </div>
              </div>
              <p className="mt-4 text-[10px] leading-5 text-slate-400">
                Puan; akademik, devam, davranış ve veri kapsamı göstergelerinden hesaplanır. Eksik veri kesin sonuç gibi sunulmaz.
              </p>
            </div>
          </div>
        </div>
      </div>

      <DeferredPanel label="Yönetim zekâ merkezi yükleniyor">
        <DashboardExecutiveIntelligence
          students={students}
          onNavigate={onNavigate}
          taskScope={taskScope}
          refreshVersion={refreshVersion}
        />
      </DeferredPanel>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Yönetici Copilot</span>
              <h2 className="mt-1 text-lg font-black text-slate-900">Bugün dikkat edilmesi gerekenler</h2>
            </div>
            <button onClick={() => onNavigate("hasat-ai-commander")} className="rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white hover:bg-slate-800">
              Copilot’u aç
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {priorities.map((item) => {
              const Icon = item.level === "critical" ? TrendingDown : item.level === "positive" ? TrendingUp : Activity;
              const tone = item.level === "critical"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : item.level === "positive"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700";
              return (
                <button key={item.title} onClick={() => onNavigate(item.tab)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tone}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs">{item.title}</strong>
                    <span className="mt-1 block text-[10px] leading-4 opacity-80">{item.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Hızlı İşlemler</span>
          <h2 className="mt-1 text-lg font-black text-slate-900">En sık kullanılan alanlar</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map(({ label, detail, tab, icon: Icon }) => (
              <button key={tab} onClick={() => onNavigate(tab)} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm group-hover:text-blue-700"><Icon className="h-5 w-5" /></span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600" />
                </div>
                <strong className="mt-3 block text-xs text-slate-900">{label}</strong>
                <span className="mt-1 block text-[10px] text-slate-500">{detail}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600">Günlük Yönetim Özeti</span>
              <h2 className="mt-1 text-lg font-black text-slate-900">Kayıtlardan gelen canlı durum</h2>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Davranış kaydı", value: operational.behaviorCount, tab: "behavior", icon: AlertTriangle, tone: "text-amber-700 bg-amber-50 border-amber-200" },
              { label: "Disiplin süreci", value: operational.disciplineCount, tab: "discipline-analytics", icon: Scale, tone: "text-rose-700 bg-rose-50 border-rose-200" },
              { label: "Analiz hazır sınav", value: operational.evaluatedExams.length, tab: "exam-reports", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
              { label: "Aktif duyuru", value: announcements.length, tab: "announcements", icon: CalendarDays, tone: "text-sky-700 bg-sky-50 border-sky-200" },
            ].map(({ label, value, tab, icon: Icon, tone }) => (
              <button key={label} type="button" onClick={() => onNavigate(tab)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tone}`}>
                <Icon className="h-5 w-5" />
                <strong className="mt-3 block text-2xl font-black">{value}</strong>
                <span className="mt-1 block text-[10px] font-bold">{label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-600">Son Sınavlar</span>
              <h2 className="mt-1 text-lg font-black text-slate-900">Değerlendirilmiş sınavlar</h2>
            </div>
            <button type="button" onClick={() => onNavigate("exam-reports")} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
              Tüm raporlar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {operational.evaluatedExams.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {operational.evaluatedExams.map((exam) => (
                <button key={exam.id} type="button" onClick={() => onNavigate("exam-reports")} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><BookOpenCheck className="h-4 w-4" /></span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-700">Hazır</span>
                  </div>
                  <strong className="mt-3 block truncate text-xs text-slate-900">{exam.name}</strong>
                  <span className="mt-1 block text-[10px] text-slate-500">{exam.date}</span>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-[9px] font-bold text-slate-600">{exam.studentCount > 0 ? `${exam.studentCount} öğrenci` : "Katılımcı bilgisi yok"}</span>
                    {exam.averageScore !== null ? (
                      <span className="text-right">
                        <strong className="block text-base font-black text-slate-900">%{exam.averageScore}</strong>
                        <small className={`text-[8px] font-black ${exam.change === null ? "text-slate-400" : exam.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {exam.change === null ? "İlk ölçüm" : `${exam.change >= 0 ? "+" : ""}${exam.change} puan`}
                        </small>
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-slate-400">Ölçüm yok</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => onNavigate("exam-prepare")} className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-xs font-bold text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              <BookOpenCheck className="h-5 w-5" /> Değerlendirilmiş sınav bulunamadı. Sınav verisi eklemek için tıklayın.
            </button>
          )}
        </article>
      </div>

      <DeferredPanel label="e-Nstitü Brain kararları yükleniyor">
        <DashboardBrainDecisions
          students={students}
          announcements={announcements}
          onNavigate={onNavigate}
          refreshVersion={refreshVersion}
          taskScope={taskScope}
        />
      </DeferredPanel>

      <DeferredPanel label="Akademik karar alanı yükleniyor">
        <DashboardLearningInsights onNavigate={onNavigate} refreshVersion={refreshVersion} />
      </DeferredPanel>

      <DeferredPanel label="Üretim kabul merkezi yükleniyor">
        <DashboardProductionReadiness taskScope={taskScope} />
      </DeferredPanel>

      <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Kurum Başarı Eğilimi</span>
            <h2 className="mt-1 text-lg font-black text-slate-900">Son değerlendirilmiş sınavların karşılaştırması</h2>
          </div>
          <button type="button" onClick={() => onNavigate("institution-trends")} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
            <TrendingUp className="h-4 w-4" /> Kurum Trendleri
          </button>
        </div>
        {operational.examTrend.some((exam) => exam.averageScore !== null) ? (
          <div className="mt-5">
            <div className="flex h-44 items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              {operational.examTrend.map((exam) => {
                const score = exam.averageScore ?? 0;
                return (
                  <div key={exam.id} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[9px] font-black text-slate-600">{exam.averageScore === null ? "—" : `%${exam.averageScore}`}</span>
                    <div className="flex h-28 w-full items-end justify-center overflow-hidden rounded-xl bg-white">
                      <div className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-cyan-400 transition-all group-hover:from-blue-700" style={{ height: `${Math.max(4, score)}%` }} />
                    </div>
                    <span className="w-full truncate text-center text-[8px] font-bold text-slate-500" title={exam.name}>{exam.name}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[9px] leading-4 text-slate-500">Grafik yalnızca sınav kayıtlarında gerçek başarı veya puan ölçümü bulunan sonuçları kullanır.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            Trend grafiği için değerlendirilmiş sınavlarda başarı yüzdesi veya puan verisi bekleniyor.
          </div>
        )}
      </article>

      <DeferredPanel label="Yönetim brifingi yükleniyor">
        <DashboardManagementBriefing schoolId={taskScope.schoolId} />
      </DeferredPanel>

      <DeferredPanel label="Yönetim bildirimleri yükleniyor">
        <DashboardNotificationCenter schoolId={taskScope.schoolId} />
      </DeferredPanel>

      <DeferredPanel label="İşlem denetimi yükleniyor">
        <DashboardAuditTrail schoolId={taskScope.schoolId} />
      </DeferredPanel>

      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-600">Canlı Kurum Haritası</span>
            <h2 className="mt-1 text-lg font-black text-slate-900">Sınıf bazlı devamsızlık görünümü</h2>
          </div>
          <button onClick={() => onNavigate("digital-school-twin")} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
            <BarChart3 className="h-4 w-4" /> Dijital Okul İkizi
          </button>
        </div>
        {dashboard.classroomHeat.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {dashboard.classroomHeat.map((classroom) => {
              const tone = classroom.level === "critical"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : classroom.level === "watch"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700";
              return (
                <button key={classroom.name} onClick={() => setSelectedClassroom(classroom.name)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tone} ${selectedClassroom === classroom.name ? "ring-2 ring-slate-900/20" : ""}`}>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm">{classroom.name}</strong>
                    <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  </div>
                  <span className="mt-3 block text-[10px] opacity-80">{classroom.count} öğrenci</span>
                  <span className="mt-1 block text-[10px] font-bold">{classroom.critical} kritik · {classroom.warning} izlem</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            Sınıf haritası için öğrenci ve sınıf kayıtları bekleniyor.
          </div>
        )}
        {selectedClass && (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Seçili sınıf</span>
              <h3 className="mt-1 text-base font-black text-slate-900">{selectedClass.name}</h3>
              <p className="mt-1 text-[10px] text-slate-600">{selectedClass.count} öğrenci · {selectedClass.critical} kritik · {selectedClass.warning} izlem · risk %{selectedClass.riskRate}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => onNavigate("students")} className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black text-white hover:bg-slate-800">Öğrencileri aç</button>
              <button type="button" onClick={() => setSelectedClassroom(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-100">Kapat</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

