import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  GraduationCap,
  HeartPulse,
  ListChecks,
  Loader2,
  RefreshCw,
  School,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  WandSparkles,
} from "lucide-react";
import { auditLog } from "../../core/audit";
import {
  decisionTaskRepository,
  type DecisionTaskRecord,
  type DecisionTaskScope,
} from "../../core/data";

import { sqliteStorage } from "../../core/state/SyncStateStore";
type Props = {
  students: Array<Record<string, any>>;
  onNavigate: (tab: string) => void;
  taskScope: DecisionTaskScope;
  refreshVersion?: number;
};

type ExamSnapshot = {
  name: string;
  average: number | null;
  timestamp: number;
};

type IntelligenceAction = {
  id: string;
  title: string;
  evidence: string;
  action: string;
  owner: string;
  priority: number;
  horizon: "Şimdi" | "Bugün" | "Bu hafta";
  targetTab: string;
  tone: "critical" | "warning" | "positive" | "info";
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readArray = (keys: string[]): any[] => {
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
      // Bozuk bir kayıt yönetim zekâ merkezinin açılmasını engellememeli.
    }
  }
  return [];
};

const normalizeClassroom = (student: Record<string, any>) =>
  String(student.classroom || student.className || student.class || student.grade || "Sınıfsız").trim() || "Sınıfsız";

const studentName = (student: Record<string, any>) =>
  String(student.fullName || student.name || [student.firstName, student.lastName].filter(Boolean).join(" ") || "İsimsiz öğrenci");

const studentAbsence = (student: Record<string, any>) =>
  Math.max(0, Number(student.absences ?? student.totalAbsence ?? student.absenceDays ?? 0) || 0);

const studentAcademic = (student: Record<string, any>): number | null => {
  const candidates = [
    student.successRate,
    student.averageScore,
    student.examAverage,
    student.gpa,
    student.gradeAverage,
    student.average,
  ];
  for (const candidate of candidates) {
    const value = finiteNumber(candidate);
    if (value !== null) return clamp(value <= 5 ? value * 20 : value);
  }
  return null;
};

const recordStudentId = (record: Record<string, any>) =>
  String(record.studentId || record.studentNumber || record.schoolNumber || record.number || "").trim();

const studentIdentity = (student: Record<string, any>) =>
  String(student.id || student.studentId || student.studentNumber || student.schoolNumber || student.number || "").trim();

const extractExamAverage = (exam: Record<string, any>): number | null => {
  const direct = [
    exam.averageScore,
    exam.examAverage,
    exam.institutionAverage,
    exam.schoolAverage,
    exam.averageSuccess,
    exam.successRate,
    exam.statistics?.averageScore,
    exam.statistics?.successRate,
    exam.analysis?.averageScore,
    exam.analysis?.successRate,
  ];
  for (const candidate of direct) {
    const value = finiteNumber(candidate);
    if (value !== null) return clamp(value <= 5 ? value * 20 : value);
  }
  const results = Array.isArray(exam.studentResults)
    ? exam.studentResults
    : Array.isArray(exam.results)
      ? exam.results
      : [];
  const values = results
    .map((result: Record<string, any>) => finiteNumber(result.successRate ?? result.score ?? result.percentage ?? result.totalScore))
    .filter((value: number | null): value is number => value !== null)
    .map((value) => clamp(value <= 5 ? value * 20 : value));
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

const isEvaluatedExam = (exam: Record<string, any>) => {
  const status = String(exam.status || exam.state || exam.analysisStatus || "").toLocaleLowerCase("tr-TR");
  return Boolean(
    exam.evaluated || exam.isEvaluated || exam.results || exam.studentResults || exam.analysis ||
      status.includes("değerlendir") || status.includes("tamam") || status.includes("sonuç"),
  );
};

const loadExamTrend = (): ExamSnapshot[] =>
  readArray(["exams", "examRecords", "edupanel_exams"])
    .filter((exam) => exam && typeof exam === "object" && isEvaluatedExam(exam))
    .map((exam, index) => ({
      name: String(exam.name || exam.title || exam.examName || `Sınav ${index + 1}`),
      average: extractExamAverage(exam),
      timestamp: new Date(exam.examDate || exam.date || exam.updatedAt || exam.createdAt || 0).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6);

const toneMeta = {
  critical: { badge: "bg-rose-100 text-rose-700", border: "border-rose-200 bg-rose-50", icon: ShieldAlert },
  warning: { badge: "bg-amber-100 text-amber-700", border: "border-amber-200 bg-amber-50", icon: AlertTriangle },
  positive: { badge: "bg-emerald-100 text-emerald-700", border: "border-emerald-200 bg-emerald-50", icon: TrendingUp },
  info: { badge: "bg-sky-100 text-sky-700", border: "border-sky-200 bg-sky-50", icon: BarChart3 },
} as const;

export default function DashboardExecutiveIntelligence({ students, onNavigate, taskScope, refreshVersion = 0 }: Props) {
  const [localRefresh, setLocalRefresh] = React.useState(0);
  const [tasks, setTasks] = React.useState<DecisionTaskRecord[]>([]);
  const [creatingPlan, setCreatingPlan] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let active = true;
    decisionTaskRepository.list(taskScope).then((items) => active && setTasks(items)).catch(() => undefined);
    const unsubscribe = decisionTaskRepository.subscribe(taskScope, () => {
      decisionTaskRepository.list(taskScope).then((items) => active && setTasks(items)).catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [taskScope.schoolId, taskScope.userId, localRefresh]);

  const intelligence = React.useMemo(() => {
    const behavior = readArray(["behaviorRecords", "behavior_records", "edupanel_behavior_records"]);
    const discipline = [
      ...readArray(["disciplineWarnings", "discipline_warnings"]),
      ...readArray(["disciplineBoardRecords", "discipline_records", "disciplineRecords"]),
      ...readArray(["disciplineArchiveRecords", "discipline_archive_records"]),
    ];
    const guidance = readArray(["guidanceRecords", "guidance_records", "counselingRecords", "rehberlikRecords"]);
    const exams = loadExamTrend();

    const behaviorByStudent = new Map<string, number>();
    behavior.forEach((record) => {
      const id = recordStudentId(record);
      if (id) behaviorByStudent.set(id, (behaviorByStudent.get(id) || 0) + 1);
    });
    const disciplineByStudent = new Map<string, number>();
    discipline.forEach((record) => {
      const id = recordStudentId(record);
      if (id) disciplineByStudent.set(id, (disciplineByStudent.get(id) || 0) + 1);
    });

    const studentRisks = students.map((student, index) => {
      const id = studentIdentity(student) || `student-${index}`;
      const absence = studentAbsence(student);
      const academic = studentAcademic(student);
      const behaviorCount = behaviorByStudent.get(id) || 0;
      const disciplineCount = disciplineByStudent.get(id) || 0;
      let risk = 0;
      const reasons: string[] = [];
      if (absence > 10) { risk += Math.min(40, 20 + (absence - 10) * 2); reasons.push(`${absence} gün devamsızlık`); }
      else if (absence > 5) { risk += 15; reasons.push(`${absence} gün devamsızlık`); }
      if (academic !== null && academic < 50) { risk += Math.min(35, 15 + (50 - academic)); reasons.push(`Akademik başarı %${academic}`); }
      else if (academic !== null && academic < 65) { risk += 10; reasons.push(`Akademik başarı %${academic}`); }
      if (behaviorCount > 0) { risk += Math.min(20, behaviorCount * 5); reasons.push(`${behaviorCount} davranış kaydı`); }
      if (disciplineCount > 0) { risk += Math.min(30, disciplineCount * 10); reasons.push(`${disciplineCount} disiplin kaydı`); }
      return {
        id,
        name: studentName(student),
        classroom: normalizeClassroom(student),
        risk: clamp(risk),
        reasons,
      };
    }).sort((a, b) => b.risk - a.risk);

    const classMap = new Map<string, typeof studentRisks>();
    studentRisks.forEach((student) => {
      const list = classMap.get(student.classroom) || [];
      list.push(student);
      classMap.set(student.classroom, list);
    });
    const classRisks = [...classMap.entries()].map(([classroom, list]) => ({
      classroom,
      studentCount: list.length,
      criticalCount: list.filter((item) => item.risk >= 70).length,
      averageRisk: list.length ? clamp(list.reduce((sum, item) => sum + item.risk, 0) / list.length) : 0,
    })).sort((a, b) => b.averageRisk - a.averageRisk);

    const latestExam = exams.at(-1)?.average ?? null;
    const previousExam = exams.at(-2)?.average ?? null;
    const examChange = latestExam !== null && previousExam !== null ? Number((latestExam - previousExam).toFixed(1)) : null;
    const academicScore = latestExam ?? (() => {
      const values = students.map(studentAcademic).filter((value): value is number => value !== null);
      return values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    })();
    const attendanceScore = students.length
      ? clamp(100 - studentRisks.filter((item) => item.reasons.some((reason) => reason.includes("devamsızlık"))).length / students.length * 100)
      : 0;
    const behaviorScore = students.length
      ? clamp(100 - (behavior.length + discipline.length * 2) / Math.max(students.length, 1) * 12)
      : 0;
    const activeTasks = tasks.filter((task) => task.status !== "done");
    const completedTasks = tasks.filter((task) => task.status === "done");
    const taskScore = tasks.length ? clamp(completedTasks.length / tasks.length * 100) : 70;
    const guidanceScore = guidance.length > 0 ? clamp(65 + Math.min(30, guidance.length)) : 50;
    const availableSignals = [academicScore > 0, students.length > 0, behavior.length + discipline.length > 0, tasks.length > 0, exams.length > 0];
    const dataConfidence = clamp(availableSignals.filter(Boolean).length / availableSignals.length * 100);
    const healthScore = clamp(
      academicScore * 0.3 + attendanceScore * 0.2 + behaviorScore * 0.15 + guidanceScore * 0.1 + taskScore * 0.15 + (examChange === null ? 60 : clamp(60 + examChange * 4)) * 0.1,
    );

    const actions: IntelligenceAction[] = [];
    const criticalStudents = studentRisks.filter((item) => item.risk >= 70);
    if (criticalStudents.length) actions.push({
      id: "critical-students",
      title: `${criticalStudents.length} öğrenci kritik risk düzeyinde`,
      evidence: criticalStudents.slice(0, 3).map((item) => `${item.name}: ${item.reasons.slice(0, 2).join(", ")}`).join(" • "),
      action: "Kritik öğrenciler için rehberlik görüşmesi ve veli iletişimi planlayın.",
      owner: "Rehberlik servisi",
      priority: 96,
      horizon: "Şimdi",
      targetTab: "guidance-center",
      tone: "critical",
    });
    if (examChange !== null && examChange <= -3) actions.push({
      id: "academic-decline",
      title: `Kurum sınav başarısı ${Math.abs(examChange)} puan geriledi`,
      evidence: `${exams.at(-2)?.name || "Önceki sınav"}: %${previousExam} → ${exams.at(-1)?.name || "Son sınav"}: %${latestExam}`,
      action: "Branş ve kazanım analizini inceleyerek iki haftalık telafi planı oluşturun.",
      owner: "Zümre başkanları",
      priority: 90,
      horizon: "Bugün",
      targetTab: "institution-trends",
      tone: "critical",
    });
    if (discipline.length > 0) actions.push({
      id: "discipline-load",
      title: `${discipline.length} disiplin kaydı yönetim takibinde`,
      evidence: `Davranış kaydı: ${behavior.length}, disiplin kaydı: ${discipline.length}`,
      action: "Tekrarlayan öğrenci ve sınıf yoğunluğunu Disiplin Analitik ekranında inceleyin.",
      owner: "Okul yönetimi",
      priority: Math.min(88, 65 + discipline.length * 3),
      horizon: "Bugün",
      targetTab: "discipline-analytics",
      tone: discipline.length >= 5 ? "critical" : "warning",
    });
    const overdueTasks = activeTasks.filter((task) => task.dueDate && new Date(`${task.dueDate}T23:59:59`).getTime() < Date.now());
    if (overdueTasks.length) actions.push({
      id: "overdue-tasks",
      title: `${overdueTasks.length} yönetim görevi gecikti`,
      evidence: overdueTasks.slice(0, 3).map((task) => task.title).join(" • "),
      action: "Geciken görevleri sorumlularıyla birlikte yeniden planlayın.",
      owner: "Okul yönetimi",
      priority: Math.min(92, 72 + overdueTasks.length * 4),
      horizon: "Şimdi",
      targetTab: "dashboard",
      tone: "critical",
    });
    if (!actions.length && healthScore >= 75) actions.push({
      id: "stable-school",
      title: "Kurum göstergeleri dengeli seyrediyor",
      evidence: `Sağlık skoru ${healthScore}/100, kritik öğrenci ${criticalStudents.length}, aktif görev ${activeTasks.length}.`,
      action: "Güçlü göstergeleri koruyun; veri girişlerinin düzenli sürmesini sağlayın.",
      owner: "Okul yönetimi",
      priority: 55,
      horizon: "Bu hafta",
      targetTab: "digital-school-twin",
      tone: "positive",
    });
    if (dataConfidence < 80) actions.push({
      id: "data-confidence",
      title: `Karar güveni %${dataConfidence}`,
      evidence: "Bazı akademik, rehberlik veya operasyon verileri eksik olabilir.",
      action: "Eksik veri kaynaklarını Veri Sağlığı ekranından tamamlayın.",
      owner: "Veri sorumlusu",
      priority: 58,
      horizon: "Bu hafta",
      targetTab: "database",
      tone: "info",
    });

    return {
      healthScore,
      dataConfidence,
      metrics: [
        { label: "Akademik", value: academicScore, icon: GraduationCap },
        { label: "Devam", value: attendanceScore, icon: Users },
        { label: "Davranış", value: behaviorScore, icon: ShieldAlert },
        { label: "Rehberlik", value: guidanceScore, icon: HeartPulse },
        { label: "Görev", value: taskScore, icon: ListChecks },
      ],
      criticalStudents: studentRisks.filter((item) => item.risk > 0).slice(0, 10),
      classRisks: classRisks.slice(0, 12),
      actions: actions.sort((a, b) => b.priority - a.priority).slice(0, 5),
      examChange,
      latestExam,
      activeTasks: activeTasks.length,
    };
  }, [students, tasks, refreshVersion, localRefresh]);

  const createImprovementPlan = async () => {
    setCreatingPlan(true);
    setMessage("");
    try {
      const current = await decisionTaskRepository.list(taskScope);
      const existingDecisionIds = new Set(current.filter((task) => task.status !== "done").map((task) => task.decisionId));
      const now = new Date();
      const additions: DecisionTaskRecord[] = intelligence.actions
        .filter((action) => !existingDecisionIds.has(`executive-${action.id}`))
        .slice(0, 4)
        .map((action, index) => {
          const normalizedHorizon =
            action.horizon === "Bu hafta"
              ? "Bu hafta"
              : String(action.horizon).includes("Bug")
                ? "Bugün"
                : "Şimdi";

          const due = new Date(now);
          due.setDate(due.getDate() + (normalizedHorizon === "Bu hafta" ? 7 : normalizedHorizon === "Bugün" ? 1 : 0));
          const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
          const timestamp = new Date().toISOString();
          return {
            id: `executive-task-${Date.now()}-${index}`,
            decisionId: `executive-${action.id}`,
            title: action.title,
            action: action.action,
            owner: action.owner,
            horizon: normalizedHorizon,
            targetTab: action.targetTab,
            priority: action.priority,
            status: "planned",
            createdAt: timestamp,
            updatedAt: timestamp,
            dueDate,
            assignee: action.owner,
            notes: `Kanıt: ${action.evidence}`,
            completionEvidence: "",
            schoolId: taskScope.schoolId,
            createdBy: taskScope.userId,
            createdByName: taskScope.userName || "Sistem",
            updatedBy: taskScope.userId,
            syncStatus: "pending",
          };
        });
      if (!additions.length) {
        setMessage("Önerilen iyileştirme görevlerinin tamamı zaten aktif görevler arasında bulunuyor.");
        return;
      }
      const next = await decisionTaskRepository.replaceAll([...additions, ...current], taskScope);
      setTasks(next);
      await auditLog.record({
        action: "create",
        module: "tasks",
        targetType: "school_improvement_plan",
        summary: `${additions.length} maddelik okul iyileştirme planı oluşturuldu.`,
        metadata: { taskCount: additions.length, healthScore: intelligence.healthScore },
      });
      setMessage(`${additions.length} öncelikli iyileştirme görevi Yönetim Görev Panosuna eklendi.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İyileştirme planı oluşturulamadı.");
    } finally {
      setCreatingPlan(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-950 to-cyan-950 text-white shadow-xl" aria-label="e-Nstitü Yönetim Zekâ Merkezi">
      <div className="border-b border-white/10 px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-300"><BrainCircuit className="h-6 w-6" /></span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Sprint 3.19</span>
              <h2 className="mt-1 text-xl font-black">e-Nstitü Executive Intelligence Center</h2>
              <p className="mt-1 text-xs text-slate-400">Kurum sağlığı, riskler ve uygulanabilir yönetim kararları tek merkezde.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setLocalRefresh((value) => value + 1)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-slate-200 hover:bg-white/10">
              <RefreshCw className="h-3.5 w-3.5" /> Yenile
            </button>
            <button type="button" onClick={createImprovementPlan} disabled={creatingPlan} className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-[10px] font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
              {creatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              Okulu İyileştir
            </button>
          </div>
        </div>
        {message && <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-xs text-cyan-100">{message}</div>}
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-[.72fr_1.28fr] lg:p-8">
        <article className="rounded-[26px] border border-white/10 bg-white/[.06] p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">Kurum Sağlık Skoru</span>
              <div className="mt-3 flex items-end gap-2"><strong className="text-6xl font-black">{intelligence.healthScore}</strong><span className="pb-2 text-sm text-slate-400">/100</span></div>
            </div>
            <Gauge className="h-9 w-9 text-cyan-300" />
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${intelligence.healthScore}%` }} /></div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400"><span>Karar güveni %{intelligence.dataConfidence}</span><span>{intelligence.activeTasks} aktif görev</span></div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {intelligence.metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-black/20 p-3">
                <div className="flex items-center gap-2 text-slate-400"><Icon className="h-3.5 w-3.5" /><span className="text-[9px] font-bold">{label}</span></div>
                <strong className="mt-2 block text-xl">{value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[26px] border border-white/10 bg-white/[.06] p-5">
          <div className="flex items-center justify-between gap-3">
            <div><span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">Öncelik Motoru</span><h3 className="mt-1 text-lg font-black">Yönetimin ilk gündemi</h3></div>
            <button type="button" onClick={() => onNavigate("hasat-brain")} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black hover:bg-white/10">e-Nstitü Beyin</button>
          </div>
          <div className="mt-4 space-y-3">
            {intelligence.actions.map((action) => {
              const meta = toneMeta[action.tone];
              const Icon = meta.icon;
              return (
                <button key={action.id} type="button" onClick={() => onNavigate(action.targetTab)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-slate-900 transition hover:-translate-y-0.5 ${meta.border}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><strong className="text-xs">{action.title}</strong><small className={`rounded-full px-2 py-1 text-[8px] font-black ${meta.badge}`}>{action.priority} öncelik</small></span>
                    <span className="mt-1 block text-[9px] leading-4 text-slate-600">{action.evidence}</span>
                    <span className="mt-2 block text-[10px] font-bold text-slate-800">Öneri: {action.action}</span>
                    <span className="mt-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">{action.owner} · {action.horizon}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0" />
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <div className="grid gap-5 border-t border-white/10 p-6 lg:grid-cols-2 lg:p-8">
        <article className="rounded-[24px] border border-white/10 bg-white/[.05] p-5">
          <div className="flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.16em] text-rose-300">Kritik Öğrenciler</span><h3 className="mt-1 text-base font-black">En yüksek risk puanları</h3></div><button onClick={() => onNavigate("guidance-center")} className="text-[9px] font-black text-cyan-300">Tümünü aç</button></div>
          {intelligence.criticalStudents.length ? <div className="mt-4 space-y-2">{intelligence.criticalStudents.slice(0, 6).map((student) => (
            <div key={student.id} className="rounded-xl bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-xs">{student.name}</strong><span className="text-[9px] text-slate-400">{student.classroom} · {student.reasons.slice(0, 2).join(" · ") || "Sınırlı veri"}</span></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${student.risk >= 70 ? "bg-rose-500/20 text-rose-200" : student.risk >= 40 ? "bg-amber-500/20 text-amber-200" : "bg-sky-500/20 text-sky-200"}`}>{student.risk}</span></div>
            </div>
          ))}</div> : <div className="mt-4 rounded-xl bg-black/20 p-4 text-xs text-slate-400">Risk hesaplamak için yeterli öğrenci verisi bulunmuyor.</div>}
        </article>

        <article className="rounded-[24px] border border-white/10 bg-white/[.05] p-5">
          <div className="flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">Canlı Risk Haritası</span><h3 className="mt-1 text-base font-black">Sınıf düzeyi risk yoğunluğu</h3></div><School className="h-5 w-5 text-amber-300" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {intelligence.classRisks.map((item) => (
              <button key={item.classroom} type="button" onClick={() => onNavigate("students")} className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${item.averageRisk >= 60 ? "border-rose-400/30 bg-rose-500/10" : item.averageRisk >= 30 ? "border-amber-400/30 bg-amber-500/10" : "border-emerald-400/30 bg-emerald-500/10"}`}>
                <div className="flex items-center justify-between"><strong className="text-xs">{item.classroom}</strong><span className="text-[9px] font-black">{item.averageRisk}</span></div>
                <span className="mt-2 block text-[8px] text-slate-400">{item.studentCount} öğrenci · {item.criticalCount} kritik</span>
              </button>
            ))}
          </div>
          {intelligence.examChange !== null && <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/20 p-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${intelligence.examChange >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{intelligence.examChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span><div><strong className="block text-xs">Son sınav değişimi {intelligence.examChange >= 0 ? "+" : ""}{intelligence.examChange} puan</strong><span className="text-[9px] text-slate-400">Son ölçüm: %{intelligence.latestExam}</span></div></div>}
        </article>
      </div>
    </section>
  );
}



