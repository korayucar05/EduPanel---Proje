import React from "react";
import localforage from "localforage";
import { decisionTaskRepository, type DecisionTaskRecord, type DecisionTaskStatus } from "../../core/data";
import { firebaseAuthSession, readFirebaseAuthState, type FirebaseAuthState } from "../../core/auth";
import {
  AlertTriangle,
  BellRing,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleCheckBig,
  ClipboardPlus,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  Download,
  Printer,
  Filter,
  ListTodo,
  NotebookPen,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { sqliteStorage } from "../../core/state/SyncStateStore";
type Props = {
  students: Array<Record<string, any>>;
  announcements: Array<Record<string, any>>;
  onNavigate: (tab: string) => void;
  refreshVersion?: number;
  taskScope: { schoolId: string; userId: string; userName: string };
};

type DecisionLevel = "critical" | "warning" | "positive" | "info";

type Decision = {
  id: string;
  priority: number;
  level: DecisionLevel;
  title: string;
  evidence: string;
  action: string;
  owner: string;
  horizon: "Şimdi" | "Bugün" | "Bu hafta";
  targetTab: string;
};

type ExamPoint = {
  id: string;
  name: string;
  timestamp: number;
  average: number | null;
};

type DecisionTask = DecisionTaskRecord;


const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultDueDate = (horizon: Decision["horizon"]) => {
  const date = new Date();
  if (horizon === "Bu hafta") date.setDate(date.getDate() + 7);
  else if (horizon === "Bugün") date.setDate(date.getDate());
  else date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const downloadTextFile = (content: string, filename: string, mime = "text/plain;charset=utf-8") => {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const taskStatusMeta = {
  planned: { label: "Planlandı", icon: ListTodo, className: "bg-sky-100 text-sky-700" },
  in_progress: { label: "İşlemde", icon: PlayCircle, className: "bg-amber-100 text-amber-700" },
  done: { label: "Tamamlandı", icon: CircleCheckBig, className: "bg-emerald-100 text-emerald-700" },
} as const;


const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readLocalArray = (keys: string[]): any[] => {
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
      // Bozuk bir kayıt karar merkezinin açılmasını engellememeli.
    }
  }
  return [];
};

const isEvaluatedExam = (exam: Record<string, any>) => {
  const status = String(exam.status || exam.state || exam.analysisStatus || "").toLocaleLowerCase("tr-TR");
  return Boolean(
    exam.evaluated ||
      exam.isEvaluated ||
      exam.results ||
      exam.studentResults ||
      exam.studentTxtRecords ||
      exam.analysis ||
      status.includes("değerlendir") ||
      status.includes("tamam") ||
      status.includes("sonuç"),
  );
};

const extractAverage = (exam: Record<string, any>): number | null => {
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
    .map((result: Record<string, any>) =>
      finiteNumber(result.successRate ?? result.score ?? result.percentage ?? result.totalScore ?? result.totals?.successRate),
    )
    .filter((value: number | null): value is number => value !== null)
    .map((value) => clamp(value <= 5 ? value * 20 : value));
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

const loadExamPoints = async (): Promise<ExamPoint[]> => {
  const indexed = await localforage.getItem<any[]>("exams").catch(() => null);
  const exams = Array.isArray(indexed) ? indexed : readLocalArray(["exams", "examRecords", "edupanel_exams"]);
  return exams
    .filter((exam) => exam && typeof exam === "object" && isEvaluatedExam(exam))
    .map((exam, index) => ({
      id: String(exam.id || exam.examId || `exam-${index}`),
      name: String(exam.name || exam.title || exam.examName || exam.testName || `Sınav ${index + 1}`),
      timestamp: new Date(exam.examDate || exam.date || exam.updatedAt || exam.createdAt || 0).getTime(),
      average: extractAverage(exam),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const levelMeta = {
  critical: {
    label: "Kritik",
    icon: ShieldAlert,
    className: "border-rose-200 bg-rose-50 text-rose-950",
    badge: "bg-rose-100 text-rose-700",
  },
  warning: {
    label: "İzlem",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-950",
    badge: "bg-amber-100 text-amber-700",
  },
  positive: {
    label: "Olumlu",
    icon: TrendingUp,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-100 text-emerald-700",
  },
  info: {
    label: "Bilgi",
    icon: Database,
    className: "border-sky-200 bg-sky-50 text-sky-950",
    badge: "bg-sky-100 text-sky-700",
  },
} as const;

export default function DashboardBrainDecisions({
  students,
  announcements,
  onNavigate,
  refreshVersion = 0,
  taskScope,
}: Props) {
  const [examPoints, setExamPoints] = React.useState<ExamPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);
  const [localRefresh, setLocalRefresh] = React.useState(0);
  const [tasks, setTasks] = React.useState<DecisionTask[]>([]);
  const [tasksLoading, setTasksLoading] = React.useState(true);
  const [taskStoreError, setTaskStoreError] = React.useState("");
  const [syncingTasks, setSyncingTasks] = React.useState(false);
  const [taskSyncError, setTaskSyncError] = React.useState("");
  const [lastTaskSyncAt, setLastTaskSyncAt] = React.useState<Date | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = React.useState<"all" | DecisionTaskStatus | "overdue">("all");
  const [taskSearch, setTaskSearch] = React.useState("");
  const [cloudAuth, setCloudAuth] = React.useState<FirebaseAuthState>(() => readFirebaseAuthState());

  React.useEffect(() => firebaseAuthSession.subscribe(setCloudAuth), []);

  const reloadTasks = React.useCallback(async () => {
    setTasksLoading(true);
    try {
      const storedTasks = await decisionTaskRepository.list(taskScope);
      setTasks(storedTasks);
      setTaskStoreError("");
    } catch (error) {
      setTaskStoreError(error instanceof Error ? error.message : String(error));
    } finally {
      setTasksLoading(false);
    }
  }, [taskScope.schoolId, taskScope.userId]);

  React.useEffect(() => {
    void reloadTasks();
    return decisionTaskRepository.subscribe(taskScope, () => {
      void reloadTasks();
    });
  }, [reloadTasks]);

  const runTaskSync = React.useCallback(async () => {
    if (syncingTasks) return;
    if (cloudAuth.configured && !cloudAuth.authenticated) {
      setTaskSyncError("Bulut senkronizasyonu için Firebase Authentication oturumu açılamadı. Firebase kullanıcı hesabını ve okul üyeliğini kontrol edin.");
      return;
    }
    setSyncingTasks(true);
    setTaskSyncError("");
    try {
      const result = await decisionTaskRepository.sync(taskScope);
      setTasks(result.tasks);
      setLastTaskSyncAt(new Date(result.syncedAt));
    } catch (error) {
      setTaskSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncingTasks(false);
    }
  }, [syncingTasks, taskScope.schoolId, taskScope.userId, cloudAuth.configured, cloudAuth.authenticated]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void runTaskSync(), 1200);
    const interval = window.setInterval(() => void runTaskSync(), 120000);
    const unsubscribeRemote = decisionTaskRepository.subscribeRemote(
      taskScope,
      () => void runTaskSync(),
      (error) => setTaskSyncError(error.message),
    );
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      unsubscribeRemote();
    };
  }, [runTaskSync, taskScope.schoolId]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void loadExamPoints().then((points) => {
      if (!active) return;
      setExamPoints(points);
      setLoadedAt(new Date());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshVersion, localRefresh]);

  const snapshot = React.useMemo(() => {
    const behavior = readLocalArray(["behaviorRecords", "behavior_records", "edupanel_behavior_records"]);
    const warnings = readLocalArray(["disciplineWarnings", "discipline_warnings"]);
    const board = readLocalArray(["disciplineBoardRecords", "discipline_records", "disciplineRecords"]);
    const archive = readLocalArray(["disciplineArchiveRecords", "discipline_archive_records"]);
    const activeStudents = students.filter((student) => student.status === "Aktif" || !student.status);
    const criticalAbsence = activeStudents.filter((student) => Number(student.absences || 0) > 10);
    const warningAbsence = activeStudents.filter((student) => {
      const absence = Number(student.absences || 0);
      return absence > 5 && absence <= 10;
    });
    return {
      behaviorCount: behavior.length,
      disciplineCount: warnings.length + board.length + archive.length,
      activeStudents,
      criticalAbsence,
      warningAbsence,
    };
  }, [students, refreshVersion, localRefresh]);

  const decisions = React.useMemo<Decision[]>(() => {
    const result: Decision[] = [];
    const lastExam = examPoints.length > 0 ? examPoints[examPoints.length - 1] : null;
    const previousExam = examPoints.length > 1 ? examPoints[examPoints.length - 2] : null;

    if (snapshot.criticalAbsence.length > 0) {
      const combinedRisk = snapshot.disciplineCount > 0 || snapshot.behaviorCount > 0;
      result.push({
        id: "critical-attendance",
        priority: combinedRisk ? 98 : 92,
        level: "critical",
        title: `${snapshot.criticalAbsence.length} öğrenci için acil devam müdahalesi`,
        evidence: combinedRisk
          ? `Kritik devamsızlığa ek olarak sistemde ${snapshot.behaviorCount} davranış ve ${snapshot.disciplineCount} disiplin kaydı bulunuyor.`
          : "10 günün üzerinde devamsızlığı bulunan öğrenciler tespit edildi.",
        action: "Öğrencileri sınıf bazında ayırın; veli iletişimi ve rehberlik görüşmesini bugün başlatın.",
        owner: "Rehberlik servisi ve sınıf rehber öğretmenleri",
        horizon: "Şimdi",
        targetTab: "guidance-center",
      });
    }

    if (lastExam && previousExam && lastExam.average !== null && previousExam.average !== null) {
      const change = Number((lastExam.average - previousExam.average).toFixed(1));
      result.push({
        id: "academic-trend",
        priority: change <= -3 ? 94 : change >= 3 ? 62 : 74,
        level: change <= -3 ? "critical" : change >= 3 ? "positive" : "warning",
        title: change <= -3
          ? "Kurum başarısında belirgin gerileme"
          : change >= 3
            ? "Kurum başarısında ölçülebilir yükseliş"
            : "Kurum başarısı yatay seyrediyor",
        evidence: `${previousExam.name} (%${previousExam.average}) ile ${lastExam.name} (%${lastExam.average}) arasında ${change >= 0 ? "+" : ""}${change} puan değişim var.`,
        action: change <= -3
          ? "Düşüşü ders ve kazanım bazında inceleyip iki haftalık zümre telafi planı oluşturun."
          : change >= 3
            ? "Yükselişi sağlayan uygulamaları belirleyip zümreler arasında paylaşın."
            : "Durağan alanları Öğrenme Haritasından inceleyerek kısa süreli müdahale planlayın.",
        owner: "Ölçme değerlendirme birimi ve zümre başkanları",
        horizon: change <= -3 ? "Bugün" : "Bu hafta",
        targetTab: "institution-trends",
      });
    } else if (!lastExam) {
      result.push({
        id: "missing-exam-data",
        priority: 76,
        level: "info",
        title: "Akademik karar için sınav verisi bekleniyor",
        evidence: "Değerlendirilmiş sınav kaydı bulunamadı.",
        action: "En az bir sınavı değerlendirerek kurum trendi ve kazanım analizini etkinleştirin.",
        owner: "Ölçme değerlendirme birimi",
        horizon: "Bu hafta",
        targetTab: "exam-prepare",
      });
    } else if (lastExam.average === null) {
      result.push({
        id: "missing-exam-score",
        priority: 72,
        level: "info",
        title: "Sınav var ancak kurum başarı ölçümü yok",
        evidence: `${lastExam.name} değerlendirilmiş görünüyor; başarı yüzdesi veya puan alanı okunamadı.`,
        action: "Sınav sonuç eşleşmesini ve puan alanlarını kontrol edin.",
        owner: "Ölçme değerlendirme birimi",
        horizon: "Bugün",
        targetTab: "exam-reports",
      });
    }

    if (snapshot.disciplineCount >= 5 || snapshot.behaviorCount >= 10) {
      result.push({
        id: "behavior-density",
        priority: snapshot.disciplineCount >= 10 ? 95 : 86,
        level: snapshot.disciplineCount >= 10 ? "critical" : "warning",
        title: "Davranış ve disiplin kayıtlarında yoğunluk",
        evidence: `${snapshot.behaviorCount} davranış ve ${snapshot.disciplineCount} disiplin kaydı mevcut.`,
        action: "Tekrarlayan öğrencileri, sınıfları ve olay türlerini ayırarak önleyici rehberlik planı hazırlayın.",
        owner: "Disiplin kurulu ve rehberlik servisi",
        horizon: snapshot.disciplineCount >= 10 ? "Şimdi" : "Bugün",
        targetTab: "discipline-analytics",
      });
    }

    if (snapshot.warningAbsence.length > 0) {
      result.push({
        id: "attendance-watch",
        priority: 79,
        level: "warning",
        title: `${snapshot.warningAbsence.length} öğrenci erken devam izleminde`,
        evidence: "5–10 gün arasında devamsızlığı bulunan öğrenciler kritik sınıra yaklaşmadan tespit edildi.",
        action: "Sınıf rehber öğretmenlerine erken uyarı listesi gönderin ve bir haftalık takip başlatın.",
        owner: "Sınıf rehber öğretmenleri",
        horizon: "Bugün",
        targetTab: "students",
      });
    }

    if (announcements.length === 0) {
      result.push({
        id: "announcement-data",
        priority: 48,
        level: "info",
        title: "Güncel duyuru kaydı bulunmuyor",
        evidence: "Dashboard üzerinde aktif duyuru verisi alınamadı.",
        action: "Bugünün sınav, toplantı veya okul içi görev duyurularını kontrol edin.",
        owner: "Okul yönetimi",
        horizon: "Bu hafta",
        targetTab: "announcements",
      });
    }

    if (result.length === 0) {
      result.push({
        id: "stable",
        priority: 42,
        level: "positive",
        title: "Kritik çapraz risk görünmüyor",
        evidence: "Mevcut akademik, devam ve davranış sinyallerinde acil müdahale gerektiren ortak risk tespit edilmedi.",
        action: "Rutin izlemeyi sürdürün ve veri güncelliğini koruyun.",
        owner: "Okul yönetimi",
        horizon: "Bu hafta",
        targetTab: "operations-center",
      });
    }

    return result.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [announcements.length, examPoints, snapshot]);

  const confidence = React.useMemo(() => {
    const signals = [
      students.length > 0,
      examPoints.length > 0,
      snapshot.behaviorCount + snapshot.disciplineCount > 0,
      announcements.length > 0,
    ];
    return clamp((signals.filter(Boolean).length / signals.length) * 100);
  }, [announcements.length, examPoints.length, snapshot.behaviorCount, snapshot.disciplineCount, students.length]);

  const criticalCount = decisions.filter((decision) => decision.level === "critical").length;
  const warningCount = decisions.filter((decision) => decision.level === "warning").length;

  const persistTasks = React.useCallback((nextTasks: DecisionTask[]) => {
    setTasks(nextTasks);
    setTaskStoreError("");
    void decisionTaskRepository.replaceAll(nextTasks, taskScope).catch((error) => {
      setTaskStoreError(error instanceof Error ? error.message : String(error));
      void reloadTasks();
    });
  }, [reloadTasks, taskScope]);

  const createTask = React.useCallback((decision: Decision) => {
    const existing = tasks.find((task) => task.decisionId === decision.id && task.status !== "done");
    if (existing) return;
    const now = new Date().toISOString();
    const normalizedHorizon =
      decision.horizon === "Bu hafta"
        ? "Bu hafta"
        : String(decision.horizon).includes("Bug")
          ? "Bugün"
          : "Şimdi";

    persistTasks([
      {
        id: `task-${decision.id}-${Date.now()}`,
        decisionId: decision.id,
        title: decision.title,
        action: decision.action,
        owner: decision.owner,
        horizon: normalizedHorizon,
        targetTab: decision.targetTab,
        priority: decision.priority,
        status: "planned",
        createdAt: now,
        updatedAt: now,
        dueDate: defaultDueDate(decision.horizon),
        assignee: "",
        notes: "",
        completionEvidence: "",
        schoolId: taskScope.schoolId,
        createdBy: taskScope.userId,
        createdByName: taskScope.userName,
        updatedBy: taskScope.userId,
        syncStatus: "pending",
      },
      ...tasks,
    ]);
  }, [persistTasks, taskScope, tasks]);

  const updateTaskStatus = React.useCallback((taskId: string, status: DecisionTaskStatus) => {
    const now = new Date().toISOString();
    persistTasks(tasks.map((task) => task.id === taskId
      ? { ...task, status, updatedAt: now, completedAt: status === "done" ? now : undefined }
      : task));
  }, [persistTasks, taskScope, tasks]);

  const updateTaskField = React.useCallback((taskId: string, patch: Partial<Pick<DecisionTask, "assignee" | "dueDate" | "notes" | "completionEvidence">>) => {
    const now = new Date().toISOString();
    persistTasks(tasks.map((task) => task.id === taskId ? { ...task, ...patch, updatedAt: now } : task));
  }, [persistTasks, taskScope, tasks]);

  const removeTask = React.useCallback((taskId: string) => {
    const previous = tasks;
    setTasks(tasks.filter((task) => task.id !== taskId));
    setTaskStoreError("");
    void decisionTaskRepository.remove(taskId, taskScope).catch((error) => {
      setTasks(previous);
      setTaskStoreError(error instanceof Error ? error.message : String(error));
    });
  }, [taskScope, tasks]);

  const todayValue = toDateInputValue(new Date());
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");
  const overdueTasks = activeTasks.filter((task) => task.dueDate && task.dueDate < todayValue);
  const dueTodayTasks = activeTasks.filter((task) => task.dueDate === todayValue);
  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    const aOverdue = a.status !== "done" && a.dueDate < todayValue;
    const bOverdue = b.status !== "done" && b.dueDate < todayValue;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return String(a.dueDate).localeCompare(String(b.dueDate));
  });

  const normalizedTaskSearch = taskSearch.trim().toLocaleLowerCase("tr-TR");
  const visibleTasks = orderedTasks.filter((task) => {
    const isOverdue = task.status !== "done" && Boolean(task.dueDate) && task.dueDate < todayValue;
    if (taskStatusFilter === "overdue" && !isOverdue) return false;
    if (taskStatusFilter !== "all" && taskStatusFilter !== "overdue" && task.status !== taskStatusFilter) return false;
    if (!normalizedTaskSearch) return true;
    return [task.title, task.action, task.owner, task.assignee, task.notes]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedTaskSearch);
  });
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const weeklyPerformance = React.useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const createdThisWeek = tasks.filter((task) => new Date(task.createdAt).getTime() >= weekStart.getTime());
    const completedThisWeek = tasks.filter((task) => task.completedAt && new Date(task.completedAt).getTime() >= weekStart.getTime());
    const onTimeCompleted = completedThisWeek.filter((task) => {
      if (!task.completedAt || !task.dueDate) return false;
      return toDateInputValue(new Date(task.completedAt)) <= task.dueDate;
    });
    const completionDurations = completedThisWeek
      .map((task) => task.completedAt ? (new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 86400000 : null)
      .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
    return {
      created: createdThisWeek.length,
      completed: completedThisWeek.length,
      onTimeRate: completedThisWeek.length > 0 ? Math.round((onTimeCompleted.length / completedThisWeek.length) * 100) : 0,
      averageDays: completionDurations.length > 0
        ? Number((completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length).toFixed(1))
        : 0,
    };
  }, [tasks]);

  const ownerSummary = React.useMemo(() => {
    const map = new Map<string, { total: number; active: number; done: number }>();
    tasks.forEach((task) => {
      const owner = task.owner || "Belirtilmemiş birim";
      const current = map.get(owner) || { total: 0, active: 0, done: 0 };
      current.total += 1;
      if (task.status === "done") current.done += 1;
      else current.active += 1;
      map.set(owner, current);
    });
    return [...map.entries()]
      .map(([owner, values]) => ({ owner, ...values }))
      .sort((a, b) => b.active - a.active || b.total - a.total)
      .slice(0, 5);
  }, [tasks]);

  const exportTasksCsv = React.useCallback(() => {
    const rows = [
      ["Görev", "Durum", "Öncelik", "Birim", "Sorumlu", "Son Tarih", "Gecikme", "Not", "Tamamlama Kanıtı", "Oluşturma", "Tamamlanma"],
      ...visibleTasks.map((task) => [
        task.title,
        taskStatusMeta[task.status].label,
        task.priority,
        task.owner,
        task.assignee,
        task.dueDate,
        task.status !== "done" && task.dueDate < todayValue ? "Gecikti" : "",
        task.notes,
        task.completionEvidence,
        new Date(task.createdAt).toLocaleString("tr-TR"),
        task.completedAt ? new Date(task.completedAt).toLocaleString("tr-TR") : "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
    downloadTextFile(csv, `HASAT_Yonetim_Gorevleri_${todayValue}.csv`, "text/csv;charset=utf-8");
  }, [todayValue, visibleTasks]);

  const printTaskReport = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!reportWindow) return;
    const rows = visibleTasks.map((task) => {
      const overdue = task.status !== "done" && task.dueDate < todayValue;
      return `<tr><td>${task.title}</td><td>${taskStatusMeta[task.status].label}</td><td>${task.priority}</td><td>${task.owner}</td><td>${task.assignee || "—"}</td><td>${task.dueDate || "—"}${overdue ? " (Gecikti)" : ""}</td><td>${task.notes || "—"}</td><td>${task.completionEvidence || "—"}</td></tr>`;
    }).join("");
    reportWindow.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>e-Nstitü Yönetim Görev Raporu</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111827}h1{font-size:22px;margin:0}p{color:#475569}.summary{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.box{border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px}.box strong{font-size:20px;display:block}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top;text-align:left}th{background:#e2e8f0}@media print{body{margin:12mm}.no-print{display:none}}</style></head><body><h1>e-Nstitü Yönetim Görev Raporu</h1><p>Rapor tarihi: ${new Date().toLocaleString("tr-TR")}</p><div class="summary"><div class="box"><strong>${tasks.length}</strong>Toplam görev</div><div class="box"><strong>${activeTasks.length}</strong>Aktif</div><div class="box"><strong>${overdueTasks.length}</strong>Geciken</div><div class="box"><strong>%${completionRate}</strong>Tamamlama</div></div><table><thead><tr><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Birim</th><th>Sorumlu</th><th>Son tarih</th><th>Not</th><th>Kanıt</th></tr></thead><tbody>${rows || '<tr><td colspan="8">Görev bulunamadı.</td></tr>'}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    reportWindow.document.close();
  }, [activeTasks.length, completionRate, overdueTasks.length, tasks.length, todayValue, visibleTasks]);

  const printMeetingAgenda = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const agendaWindow = window.open("", "_blank", "noopener,noreferrer,width=1000,height=800");
    if (!agendaWindow) return;
    const agendaTasks = [...activeTasks]
      .sort((a, b) => {
        const aOverdue = Boolean(a.dueDate) && a.dueDate < todayValue;
        const bOverdue = Boolean(b.dueDate) && b.dueDate < todayValue;
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        return b.priority - a.priority || String(a.dueDate).localeCompare(String(b.dueDate));
      })
      .slice(0, 12);
    const agendaRows = agendaTasks.map((task, index) => {
      const overdue = Boolean(task.dueDate) && task.dueDate < todayValue;
      return `<tr><td>${index + 1}</td><td><strong>${task.title}</strong><br><span>${task.action}</span></td><td>${task.owner}</td><td>${task.assignee || "Belirlenecek"}</td><td>${task.dueDate || "—"}${overdue ? " (Gecikti)" : ""}</td><td style="height:42px"></td></tr>`;
    }).join("");
    const decisionsHtml = decisions.slice(0, 5).map((decision, index) => `<li><strong>${index + 1}. ${decision.title}</strong><br>${decision.evidence}<br><em>Öneri: ${decision.action}</em></li>`).join("");
    agendaWindow.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>e-Nstitü Yönetim Toplantısı Gündemi</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111827}h1{font-size:22px;margin:0}h2{font-size:15px;margin-top:22px;border-bottom:2px solid #111827;padding-bottom:5px}.meta{color:#475569;margin-top:6px}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.box{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px}.box strong{font-size:18px;display:block}ol{padding-left:22px}li{margin:0 0 10px;line-height:1.45}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #94a3b8;padding:7px;vertical-align:top;text-align:left}th{background:#e2e8f0}.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;margin-top:50px;text-align:center}@media print{body{margin:12mm}}</style></head><body><h1>e-Nstitü Yönetim Toplantısı Gündemi</h1><div class="meta">Tarih/Saat: ${new Date().toLocaleString("tr-TR")} &nbsp; | &nbsp; Toplantı Başkanı: ....................................</div><div class="summary"><div class="box"><strong>${activeTasks.length}</strong>Aktif görev</div><div class="box"><strong>${overdueTasks.length}</strong>Geciken</div><div class="box"><strong>${dueTodayTasks.length}</strong>Bugün</div><div class="box"><strong>%${weeklyPerformance.onTimeRate}</strong>Haftalık zamanında kapanış</div></div><h2>1. e-Nstitü Brain karar gündemi</h2><ol>${decisionsHtml || "<li>Aktif karar bulunamadı.</li>"}</ol><h2>2. Öncelikli görevler ve alınan kararlar</h2><table><thead><tr><th>No</th><th>Gündem / Yapılacak işlem</th><th>Birim</th><th>Sorumlu</th><th>Son tarih</th><th>Toplantı kararı</th></tr></thead><tbody>${agendaRows || '<tr><td colspan="6">Aktif görev bulunamadı.</td></tr>'}</tbody></table><h2>3. Diğer görüş ve öneriler</h2><div style="height:90px;border:1px solid #94a3b8"></div><div class="signatures"><div>Hazırlayan<br><br>................................</div><div>Toplantı Başkanı<br><br>................................</div><div>Onay<br><br>................................</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
    agendaWindow.document.close();
  }, [activeTasks, decisions, dueTodayTasks.length, overdueTasks.length, todayValue, weeklyPerformance.onTimeRate]);

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-blue-500/10 to-emerald-500/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">e-Nstitü Brain 2.0</span>
                <h2 className="mt-1 text-xl font-black">Kurumsal karar gündemi</h2>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-400">
              Akademik, devam, davranış ve yönetim verileri birlikte değerlendirilerek en önemli kararlar önceliklendirildi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black text-slate-300">
              Karar güveni %{confidence}
            </span>
            <button
              type="button"
              onClick={() => setLocalRefresh((value) => value + 1)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
            </button>
            <button
              type="button"
              onClick={() => onNavigate("hasat-brain")}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[9px] font-black text-slate-950 hover:bg-slate-100"
            >
              Brain’i aç <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Karar", decisions.length, Sparkles],
            ["Kritik", criticalCount, ShieldAlert],
            ["İzlem", warningCount, AlertTriangle],
            ["Veri kaynağı", confidence === 100 ? 4 : Math.round((confidence / 100) * 4), Database],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.05] p-3">
              {React.createElement(Icon as React.ElementType, { className: "h-4 w-4 text-violet-300" })}
              <strong className="mt-2 block text-xl font-black">{String(value)}</strong>
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{String(label)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-8 text-xs text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" /> Karar verileri hazırlanıyor…
          </div>
        ) : (
          decisions.map((decision, index) => {
            const meta = levelMeta[decision.level];
            const Icon = meta.icon;
            return (
              <div
                key={decision.id}
                className={`group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${meta.className}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${meta.badge}`}>{meta.label}</span>
                        <span className="text-[8px] font-black uppercase tracking-wide opacity-60">Öncelik {decision.priority}</span>
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wide opacity-60">
                          <Clock3 className="h-3 w-3" /> {decision.horizon}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-black">{index + 1}. {decision.title}</h3>
                      <p className="mt-1 text-[10px] leading-5 opacity-75"><strong>Kanıt:</strong> {decision.evidence}</p>
                      <p className="mt-1 text-[10px] leading-5"><strong>İlk karar:</strong> {decision.action}</p>
                    </div>
                  </div>
                  <div className="shrink-0 space-y-2 lg:w-60">
                    <div className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate text-[9px] font-black">{decision.owner}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(decision.targetTab)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-[9px] font-black transition hover:bg-white"
                      >
                        İncele <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => createTask(decision)}
                        disabled={activeTasks.some((task) => task.decisionId === decision.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-[9px] font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        <ClipboardPlus className="h-3.5 w-3.5" />
                        {activeTasks.some((task) => task.decisionId === decision.id) ? "Görevde" : "Göreve çevir"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.16em] text-violet-300">Yönetim Görev Panosu</span>
              <h3 className="mt-1 text-sm font-black text-white">Karardan uygulamaya geçiş</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[8px] font-black">
              {tasks.length > 0 && (
                <>
                  <button type="button" onClick={exportTasksCsv} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-200 hover:bg-white/10"><Download className="h-3 w-3" /> CSV</button>
                  <button type="button" onClick={printTaskReport} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-200 hover:bg-white/10"><Printer className="h-3 w-3" /> Rapor</button>
                  <button type="button" onClick={printMeetingAgenda} className="flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-violet-200 hover:bg-violet-500/20"><FileText className="h-3 w-3" /> Toplantı gündemi</button>
                </>
              )}
              <button
                type="button"
                onClick={() => void runTaskSync()}
                disabled={syncingTasks}
                title={lastTaskSyncAt ? `Son senkron: ${lastTaskSyncAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : "Görevleri bulutla senkronize et"}
                className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${syncingTasks ? "animate-spin" : ""}`} />
                {syncingTasks ? "Senkronize" : "Bulut senkron"}
              </button>
              <span className={`rounded-full px-2.5 py-1.5 ${taskStoreError ? "bg-rose-500/20 text-rose-200" : "bg-cyan-500/15 text-cyan-200"}`}>
                {tasksLoading ? "Görev deposu okunuyor" : taskStoreError ? "Görev deposu hatası" : "Ortak veri deposu aktif"}
              </span>
              <span className={`rounded-full px-2.5 py-1.5 ${!cloudAuth.configured ? "bg-slate-500/15 text-slate-300" : cloudAuth.authenticated ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`} title={cloudAuth.error || cloudAuth.email || "Firebase Authentication"}>
                {!cloudAuth.configured ? "Bulut kapalı" : cloudAuth.authenticated ? "Güvenli bulut oturumu" : "Bulut oturumu yok"}
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-1.5 text-slate-300" title={`Kurum: ${taskScope.schoolId}`}>
                {taskScope.userName}
              </span>
              {tasks.filter((task) => task.syncStatus === "pending").length > 0 && (
                <span className="rounded-full bg-orange-500/15 px-2.5 py-1.5 text-orange-200">
                  Senkron bekleyen {tasks.filter((task) => task.syncStatus === "pending").length}
                </span>
              )}
              {overdueTasks.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1.5 text-rose-200"><BellRing className="h-3 w-3" /> Geciken {overdueTasks.length}</span>
              )}
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1.5 text-amber-200">Bugün {dueTodayTasks.length}</span>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-1.5 text-sky-200">Aktif {activeTasks.length}</span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1.5 text-emerald-200">Tamamlanan {completedTasks.length}</span>
              <span className="rounded-full bg-violet-500/15 px-2.5 py-1.5 text-violet-200">Tamamlama %{completionRate}</span>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/[.06] p-4">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-violet-300" />
                <div>
                  <span className="block text-[8px] font-black uppercase tracking-[.15em] text-violet-300">Son 7 Gün Yönetim Performansı</span>
                  <strong className="text-[11px] text-white">Görev kapanış ve zamanında tamamlama özeti</strong>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  ["Oluşturulan", weeklyPerformance.created, ClipboardPlus],
                  ["Tamamlanan", weeklyPerformance.completed, CircleCheckBig],
                  ["Zamanında", `%${weeklyPerformance.onTimeRate}`, CalendarCheck2],
                  ["Ort. kapanış", `${weeklyPerformance.averageDays} gün`, BarChart3],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    {React.createElement(Icon as React.ElementType, { className: "h-3.5 w-3.5 text-violet-300" })}
                    <strong className="mt-2 block text-lg font-black text-white">{String(value)}</strong>
                    <span className="text-[8px] font-black uppercase text-slate-500">{String(label)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {ownerSummary.map((item) => (
                <div key={item.owner} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <span className="block truncate text-[8px] font-black uppercase text-slate-500" title={item.owner}>{item.owner}</span>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <strong className="text-lg font-black text-white">{item.active}</strong>
                    <span className="text-[8px] font-bold text-slate-400">aktif / {item.total} toplam</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-500" />
                <input
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Görev, birim, sorumlu veya not ara"
                  className="min-w-0 flex-1 bg-transparent text-[9px] font-bold text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={taskStatusFilter}
                  onChange={(event) => setTaskStatusFilter(event.target.value as typeof taskStatusFilter)}
                  className="bg-transparent text-[9px] font-black text-white outline-none [color-scheme:dark]"
                >
                  <option value="all">Tüm görevler</option>
                  <option value="overdue">Gecikenler</option>
                  <option value="planned">Planlananlar</option>
                  <option value="in_progress">İşlemdekiler</option>
                  <option value="done">Tamamlananlar</option>
                </select>
              </label>
            </div>
          )}

          {taskSyncError && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[.08] p-3 text-[9px] text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <span>Bulut senkronizasyonu yapılamadı. Yerel görevler kullanılmaya devam ediyor: {taskSyncError}</span>
              <button type="button" onClick={() => void runTaskSync()} className="rounded-lg bg-amber-500 px-3 py-1.5 font-black text-slate-950">Tekrar dene</button>
            </div>
          )}

          {taskStoreError && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[.08] p-3 text-[9px] text-rose-100 sm:flex-row sm:items-center sm:justify-between">
              <span>Görevler ortak veri deposuna kaydedilemedi: {taskStoreError}</span>
              <button type="button" onClick={() => void reloadTasks()} className="rounded-lg bg-rose-500 px-3 py-1.5 font-black text-white">Yeniden dene</button>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-[10px] text-slate-400">
              Karar kartlarındaki <strong className="text-white">Göreve çevir</strong> düğmesini kullanarak yönetim görevlerinizi burada izleyin.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {visibleTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-[10px] text-slate-400">
                  Seçilen filtreye veya arama ifadesine uygun görev bulunamadı.
                </div>
              )}
              {visibleTasks.slice(0, 20).map((task) => {
                const status = taskStatusMeta[task.status];
                const StatusIcon = status.icon;
                const isOverdue = task.status !== "done" && Boolean(task.dueDate) && task.dueDate < todayValue;
                const isDueToday = task.status !== "done" && task.dueDate === todayValue;
                return (
                  <div key={task.id} className={`rounded-xl border p-3 ${
                    task.status === "done"
                      ? "border-emerald-500/15 bg-emerald-500/[.06] opacity-75"
                      : isOverdue
                        ? "border-rose-500/40 bg-rose-500/[.09]"
                        : "border-white/10 bg-slate-900/70"
                  }`}>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black ${status.className}`}>
                            <StatusIcon className="h-3 w-3" /> {status.label}
                          </span>
                          {isOverdue && <span className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[8px] font-black text-white"><BellRing className="h-3 w-3" /> Gecikti</span>}
                          {isDueToday && <span className="rounded-full bg-amber-500 px-2 py-1 text-[8px] font-black text-slate-950">Bugün</span>}
                          <span className="text-[8px] font-black uppercase text-slate-500">{task.horizon}</span>
                          <span className="text-[8px] font-black uppercase text-slate-500">Öncelik {task.priority}</span>
                        </div>
                        <strong className={`mt-2 block text-[11px] ${task.status === "done" ? "line-through text-slate-400" : "text-white"}`}>{task.title}</strong>
                        <span className="mt-1 block text-[9px] text-slate-400">Birim: {task.owner}</span>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                            <UserRound className="h-3.5 w-3.5 text-slate-500" />
                            <input
                              value={task.assignee}
                              onChange={(event) => updateTaskField(task.id, { assignee: event.target.value })}
                              disabled={task.status === "done"}
                              placeholder="Sorumlu kişi"
                              className="min-w-0 flex-1 bg-transparent text-[9px] font-bold text-white outline-none placeholder:text-slate-600 disabled:text-slate-500"
                            />
                          </label>
                          <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isOverdue ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-black/10"}`}>
                            <CalendarDays className={`h-3.5 w-3.5 ${isOverdue ? "text-rose-300" : "text-slate-500"}`} />
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={(event) => updateTaskField(task.id, { dueDate: event.target.value })}
                              disabled={task.status === "done"}
                              className="min-w-0 flex-1 bg-transparent text-[9px] font-bold text-white outline-none [color-scheme:dark] disabled:text-slate-500"
                            />
                          </label>
                        </div>
                        <div className="mt-2 grid gap-2 lg:grid-cols-2">
                          <label className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                            <span className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase text-slate-500"><NotebookPen className="h-3 w-3" /> Görev notu</span>
                            <textarea
                              value={task.notes}
                              onChange={(event) => updateTaskField(task.id, { notes: event.target.value })}
                              disabled={task.status === "done"}
                              rows={2}
                              placeholder="Görüşme, ara işlem veya takip notu"
                              className="w-full resize-none bg-transparent text-[9px] leading-4 text-white outline-none placeholder:text-slate-600 disabled:text-slate-500"
                            />
                          </label>
                          <label className={`rounded-lg border px-2.5 py-2 ${task.status === "done" ? "border-emerald-500/30 bg-emerald-500/[.07]" : "border-white/10 bg-black/10"}`}>
                            <span className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase text-slate-500"><FileCheck2 className="h-3 w-3" /> Tamamlama kanıtı</span>
                            <textarea
                              value={task.completionEvidence}
                              onChange={(event) => updateTaskField(task.id, { completionEvidence: event.target.value })}
                              disabled={task.status === "done"}
                              rows={2}
                              placeholder="Yapılan işlem, görüşme sonucu veya belge bilgisi"
                              className="w-full resize-none bg-transparent text-[9px] leading-4 text-white outline-none placeholder:text-slate-600 disabled:text-slate-500"
                            />
                          </label>
                        </div>
                        {task.status === "done" && task.completedAt && (
                          <span className="mt-2 block text-[8px] font-bold text-emerald-300">Tamamlanma: {new Date(task.completedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xl:max-w-[260px] xl:justify-end">
                        <button type="button" onClick={() => onNavigate(task.targetTab)} className="rounded-lg border border-white/10 px-2.5 py-2 text-[8px] font-black text-slate-200 hover:bg-white/10">Aç</button>
                        {task.status === "planned" && (
                          <button type="button" onClick={() => updateTaskStatus(task.id, "in_progress")} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-2 text-[8px] font-black text-slate-950 hover:bg-amber-400">
                            <PlayCircle className="h-3 w-3" /> Başlat
                          </button>
                        )}
                        {task.status !== "done" && (
                          <button type="button" onClick={() => updateTaskStatus(task.id, "done")} disabled={!task.completionEvidence.trim()} title={!task.completionEvidence.trim() ? "Tamamlamak için kanıt alanını doldurun" : undefined} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-2 text-[8px] font-black text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400">
                            <CircleCheckBig className="h-3 w-3" /> Tamamla
                          </button>
                        )}
                        <button type="button" onClick={() => removeTask(task.id)} aria-label="Görevi sil" className="rounded-lg border border-white/10 p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[9px] text-slate-500">
          <span className="flex items-center gap-2">
            {criticalCount === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
            Kararlar yalnızca erişilebilen kayıtlardan üretilir; eksik veri tahminle tamamlanmaz.
          </span>
          <span>{loadedAt ? `Son analiz: ${loadedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : "Analiz bekleniyor"}</span>
        </div>
      </div>
    </article>
  );
}



