import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  ClipboardList,
  Copy,
  ExternalLink,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type { Student } from "../types";
import {
  type AcademicSnapshot,
  type CoachMeeting,
  type CoachMessage,
  type CoachProfile,
  type CoachTask,
  buildStudentAcademicSnapshot,
  coachTaskStatusLabel,
  createCoachProfile,
  loadCoachProfiles,
  makeCoachId,
  normalizeCoachStudentNumber,
  readCoachExams,
  saveCoachProfile,
} from "./education-coach/coachStore";

interface EducationCoachModuleProps {
  students?: Student[];
  schoolId?: string;
  currentUserName?: string;
}

type CoachView = "dashboard" | "students" | "tasks" | "meetings" | "warnings" | "messages" | "reports" | "mobile";
type StudentCardTab = "overview" | "academic" | "tasks" | "history";

type CoachWarning = {
  id: string;
  studentId: string;
  studentName: string;
  classroom: string;
  level: "critical" | "attention" | "positive";
  title: string;
  detail: string;
};

const viewLabels: Record<CoachView, string> = {
  dashboard: "Kontrol Merkezi",
  students: "Öğrenciler",
  tasks: "Plan & Görevler",
  meetings: "Koç Görüşmeleri",
  warnings: "Erken Uyarılar",
  messages: "Mesajlar",
  reports: "Aylık Raporlar",
  mobile: "Öğrenci Mobil",
};

const isoDay = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const parseDate = (value?: string) => {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

const daysSince = (value?: string) => {
  const ms = parseDate(value);
  if (!ms) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - ms) / 86_400_000);
};

const humanDate = (value?: string) => {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(ms));
};

const studentNumber = (student: any) => normalizeCoachStudentNumber(
  student?.studentNumber ?? student?.number ?? student?.schoolNumber ?? student?.id,
);

const studentName = (student: any) => String(student?.name || student?.fullName || student?.studentName || "Öğrenci");
const studentClassroom = (student: any) => String(student?.classroom || student?.className || student?.gradeLevel || "Sınıfsız");

const completionRate = (profile?: CoachProfile) => {
  const tasks = profile?.tasks || [];
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100);
};

const taskStatusClass = (status: CoachTask["status"]) => ({
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  started: "border-blue-200 bg-blue-50 text-blue-700",
  planned: "border-amber-200 bg-amber-50 text-amber-700",
  "could-not": "border-rose-200 bg-rose-50 text-rose-700",
}[status]);

const warningClass = (level: CoachWarning["level"]) => ({
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
}[level]);

const ProgressBar = ({ value, label }: { value: number; label?: string }) => (
  <div className="space-y-1.5">
    {label ? <div className="flex items-center justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>%{value}</span></div> : null}
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-300" />
    <div className="font-black text-slate-700">{title}</div>
    <div className="mt-1 text-sm text-slate-500">{detail}</div>
  </div>
);

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export default function EducationCoachModule({ students = [], schoolId = "school-main", currentUserName = "Eğitim Koçu" }: EducationCoachModuleProps) {
  const [view, setView] = useState<CoachView>(() => {
    try {
      const saved = sessionStorage.getItem("edupanel_education_coach_subtab") as CoachView | null;
      return saved && saved in viewLabels ? saved : "dashboard";
    } catch { return "dashboard"; }
  });
  const [studentCardTab, setStudentCardTab] = useState<StudentCardTab>("overview");
  const [profiles, setProfiles] = useState<CoachProfile[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState("Tümü");
  const [taskDraft, setTaskDraft] = useState({ title: "", subject: "", unit: "", topic: "", outcome: "", questionCount: "", plannedDate: isoDay(), dueDate: "", note: "" });
  const [meetingDraft, setMeetingDraft] = useState({ date: isoDay(), previousWeek: "", strengths: "", challenges: "", priority: "", newGoal: "", motivation: 3, nextMeetingDate: "" });
  const [messageDraft, setMessageDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState({ targetUniversity: "", targetDepartment: "", targetExam: "", shortTermGoal: "", longTermGoal: "", nextMeetingDate: "" });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [savedProfiles, savedExams] = await Promise.all([loadCoachProfiles(), readCoachExams()]);
    setProfiles(savedProfiles);
    setExams(savedExams);
    if (!quiet) setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    try { sessionStorage.setItem("edupanel_education_coach_subtab", view); } catch {}
    window.dispatchEvent(new CustomEvent("edupanel-education-coach-subtab", { detail: { subTab: view } }));
  }, [view]);

  useEffect(() => {
    const handler = (event: Event) => {
      const requested = String((event as CustomEvent)?.detail?.subTab || "") as CoachView;
      if (requested && requested in viewLabels) {
        setView(requested);
        try { sessionStorage.setItem("edupanel_education_coach_subtab", requested); } catch {}
      }
    };
    window.addEventListener("edupanel-education-coach-subtab", handler);
    return () => window.removeEventListener("edupanel-education-coach-subtab", handler);
  }, []);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.studentId, profile])), [profiles]);
  const numberProfileMap = useMemo(() => new Map(profiles.map((profile) => [normalizeCoachStudentNumber(profile.studentNumber), profile])), [profiles]);
  const studentMap = useMemo(() => new Map(students.map((student) => [String(student.id), student])), [students]);

  const classrooms = useMemo(() => Array.from(new Set(students.map(studentClassroom))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true })), [students]);
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return students.filter((student) => {
      const classroom = studentClassroom(student);
      const matchesClassroom = selectedClassroom === "Tümü" || classroom === selectedClassroom;
      const haystack = `${studentName(student)} ${studentNumber(student)} ${classroom}`.toLocaleLowerCase("tr-TR");
      return matchesClassroom && (!query || haystack.includes(query));
    });
  }, [students, search, selectedClassroom]);

  const trackedStudents = useMemo(() => profiles.map((profile) => {
    const student = studentMap.get(profile.studentId) || students.find((item) => studentNumber(item) === normalizeCoachStudentNumber(profile.studentNumber));
    return { profile, student };
  }), [profiles, studentMap, students]);

  const selectedProfile = useMemo(() => {
    if (!selectedStudentId) return undefined;
    return profileMap.get(selectedStudentId) || numberProfileMap.get(normalizeCoachStudentNumber(selectedStudentId));
  }, [selectedStudentId, profileMap, numberProfileMap]);

  const selectedStudent = useMemo(() => {
    if (!selectedProfile) return studentMap.get(selectedStudentId) || students.find((student) => String(student.id) === selectedStudentId);
    return studentMap.get(selectedProfile.studentId) || students.find((student) => studentNumber(student) === normalizeCoachStudentNumber(selectedProfile.studentNumber));
  }, [selectedProfile, selectedStudentId, studentMap, students]);

  const selectedSnapshot = useMemo<AcademicSnapshot>(() => buildStudentAcademicSnapshot(
    exams,
    selectedProfile?.studentNumber || (selectedStudent ? studentNumber(selectedStudent) : ""),
  ), [exams, selectedProfile?.studentNumber, selectedStudent]);

  const snapshotByProfile = useMemo(() => {
    const map = new Map<string, AcademicSnapshot>();
    profiles.forEach((profile) => map.set(profile.id, buildStudentAcademicSnapshot(exams, profile.studentNumber)));
    return map;
  }, [profiles, exams]);

  const warnings = useMemo<CoachWarning[]>(() => {
    const result: CoachWarning[] = [];
    trackedStudents.forEach(({ profile, student }) => {
      const rate = completionRate(profile);
      const overdue = profile.tasks.filter((task) => task.status !== "completed" && task.dueDate && task.dueDate < isoDay()).length;
      const lastMeeting = [...profile.meetings].sort((a, b) => parseDate(b.date) - parseDate(a.date))[0];
      const snapshot = snapshotByProfile.get(profile.id);
      const trend = snapshot?.trend || [];
      const absence = Number((student as any)?.absences ?? (student as any)?.absence ?? 0);
      if (overdue >= 3) result.push({ id: `${profile.id}-overdue`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "critical", title: `${overdue} geciken görev`, detail: "Plan uygulanmasında belirgin aksama var. Öğrenciyle görev yükü ve engeller görüşülmeli." });
      if (profile.tasks.length >= 4 && rate < 50) result.push({ id: `${profile.id}-plan`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "attention", title: `Plan uyumu %${rate}`, detail: "Haftalık çalışma planı tamamlama oranı düşük." });
      if (profile.meetings.length && daysSince(lastMeeting?.date) >= 14) result.push({ id: `${profile.id}-meeting`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "attention", title: "Görüşme gecikti", detail: `Son koç görüşmesinin üzerinden ${daysSince(lastMeeting?.date)} gün geçti.` });
      if (trend.length >= 2 && trend[trend.length - 1].success + 8 <= trend[trend.length - 2].success) result.push({ id: `${profile.id}-trend`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "critical", title: "Akademik düşüş", detail: `Son iki sınav arasında başarı ${trend[trend.length - 2].success}% → ${trend[trend.length - 1].success}% geriledi.` });
      if (snapshot?.priorityOutcomes?.length) result.push({ id: `${profile.id}-outcome`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "attention", title: `${snapshot.priorityOutcomes.length} öncelikli kazanım`, detail: `${snapshot.priorityOutcomes[0].subject}: ${snapshot.priorityOutcomes[0].outcome}` });
      if (absence >= 5) result.push({ id: `${profile.id}-absence`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: absence >= 10 ? "critical" : "attention", title: `${absence} gün devamsızlık`, detail: "Devamsızlık akademik süreçle birlikte değerlendirilmelidir." });
      if (profile.tasks.length >= 4 && rate >= 80) result.push({ id: `${profile.id}-positive`, studentId: profile.id, studentName: profile.studentName, classroom: profile.classroom, level: "positive", title: `Plan uyumu %${rate}`, detail: "Öğrenci çalışma planında güçlü bir istikrar gösteriyor." });
    });
    return result.sort((a, b) => ({ critical: 0, attention: 1, positive: 2 }[a.level] - { critical: 0, attention: 1, positive: 2 }[b.level]));
  }, [trackedStudents, snapshotByProfile]);

  const persistProfile = async (next: CoachProfile) => {
    setSaving(true);
    try {
      const saved = await saveCoachProfile(next);
      setProfiles((current) => {
        const exists = current.some((profile) => profile.id === saved.id);
        return exists ? current.map((profile) => profile.id === saved.id ? saved : profile) : [...current, saved];
      });
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const activateStudent = async (student: Student, openCard = true) => {
    const current = profileMap.get(String(student.id)) || numberProfileMap.get(studentNumber(student));
    const profile = current || await persistProfile(createCoachProfile(student, schoolId));
    setSelectedStudentId(profile.studentId);
    setGoalDraft({
      targetUniversity: profile.targetUniversity || "",
      targetDepartment: profile.targetDepartment || "",
      targetExam: profile.targetExam || "",
      shortTermGoal: profile.shortTermGoal || "",
      longTermGoal: profile.longTermGoal || "",
      nextMeetingDate: profile.nextMeetingDate || "",
    });
    if (openCard) {
      setStudentCardTab("overview");
      setView("students");
    }
  };

  const chooseProfile = (profile: CoachProfile) => {
    setSelectedStudentId(profile.studentId);
    setGoalDraft({
      targetUniversity: profile.targetUniversity || "",
      targetDepartment: profile.targetDepartment || "",
      targetExam: profile.targetExam || "",
      shortTermGoal: profile.shortTermGoal || "",
      longTermGoal: profile.longTermGoal || "",
      nextMeetingDate: profile.nextMeetingDate || "",
    });
  };

  const saveGoals = async () => {
    if (!selectedProfile) return;
    await persistProfile({ ...selectedProfile, ...goalDraft, updatedAt: new Date().toISOString() });
  };

  const addTask = async () => {
    if (!selectedProfile || !taskDraft.title.trim()) return;
    const now = new Date().toISOString();
    const task: CoachTask = {
      id: makeCoachId("task"),
      title: taskDraft.title.trim(),
      subject: taskDraft.subject.trim() || "Genel",
      unit: taskDraft.unit.trim(),
      topic: taskDraft.topic.trim(),
      outcome: taskDraft.outcome.trim(),
      questionCount: Number(taskDraft.questionCount || 0) || undefined,
      plannedDate: taskDraft.plannedDate || isoDay(),
      dueDate: taskDraft.dueDate || undefined,
      status: "planned",
      note: taskDraft.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await persistProfile({ ...selectedProfile, tasks: [task, ...selectedProfile.tasks] });
    setTaskDraft({ title: "", subject: "", unit: "", topic: "", outcome: "", questionCount: "", plannedDate: isoDay(), dueDate: "", note: "" });
  };

  const updateTaskStatus = async (taskId: string, status: CoachTask["status"], failureReason = "") => {
    if (!selectedProfile) return;
    await persistProfile({
      ...selectedProfile,
      tasks: selectedProfile.tasks.map((task) => task.id === taskId ? { ...task, status, failureReason, updatedAt: new Date().toISOString() } : task),
    });
  };

  const addMeeting = async () => {
    if (!selectedProfile) return;
    const meeting: CoachMeeting = {
      id: makeCoachId("meeting"),
      date: meetingDraft.date || isoDay(),
      previousWeek: meetingDraft.previousWeek.trim(),
      strengths: meetingDraft.strengths.trim(),
      challenges: meetingDraft.challenges.trim(),
      priority: meetingDraft.priority.trim(),
      newGoal: meetingDraft.newGoal.trim(),
      motivation: Number(meetingDraft.motivation || 3),
      nextMeetingDate: meetingDraft.nextMeetingDate || undefined,
      coachName: currentUserName,
      createdAt: new Date().toISOString(),
    };
    await persistProfile({
      ...selectedProfile,
      meetings: [meeting, ...selectedProfile.meetings],
      nextMeetingDate: meeting.nextMeetingDate || selectedProfile.nextMeetingDate,
    });
    setMeetingDraft({ date: isoDay(), previousWeek: "", strengths: "", challenges: "", priority: "", newGoal: "", motivation: 3, nextMeetingDate: "" });
  };

  const sendMessage = async () => {
    if (!selectedProfile || !messageDraft.trim()) return;
    const message: CoachMessage = {
      id: makeCoachId("msg"),
      direction: "coach-to-student",
      text: messageDraft.trim(),
      category: "general",
      createdAt: new Date().toISOString(),
    };
    await persistProfile({ ...selectedProfile, messages: [...selectedProfile.messages, message] });
    setMessageDraft("");
  };

  const printMonthlyReport = (profile: CoachProfile, snapshot: AcademicSnapshot) => {
    const month = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date());
    const recentMeetings = profile.meetings.slice(0, 4);
    const rate = completionRate(profile);
    const popup = window.open("", "_blank", "width=980,height=900");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(profile.studentName)} Eğitim Koçu Raporu</title><style>
      body{font-family:Arial,sans-serif;color:#172033;margin:30px}h1{font-size:24px;margin:0}h2{font-size:16px;color:#925f00;border-bottom:2px solid #f1c04b;padding-bottom:7px;margin-top:24px}.head{border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fffaf0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.card{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.big{font-size:22px;font-weight:800}.muted{color:#64748b;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}.footer{margin-top:28px;font-size:11px;color:#64748b}@media print{body{margin:15mm}.no-print{display:none}}</style></head><body>
      <div class="head"><h1>EĞİTİM KOÇU — AYLIK GELİŞİM RAPORU</h1><div class="muted">${escapeHtml(month)} • ${escapeHtml(profile.studentName)} • ${escapeHtml(profile.classroom)} • No: ${escapeHtml(profile.studentNumber)}</div>
      <div class="grid"><div class="card"><div class="muted">Akademik başarı</div><div class="big">%${snapshot.overallSuccess}</div></div><div class="card"><div class="muted">Plan uyumu</div><div class="big">%${rate}</div></div><div class="card"><div class="muted">Güçlü ders</div><div class="big">${escapeHtml(snapshot.strongestSubject?.subject || "—")}</div></div><div class="card"><div class="muted">Öncelikli ders</div><div class="big">${escapeHtml(snapshot.prioritySubject?.subject || "—")}</div></div></div></div>
      <h2>Hedefler</h2><table><tr><th>Hedef sınav</th><td>${escapeHtml(profile.targetExam || "—")}</td><th>Üniversite / Bölüm</th><td>${escapeHtml([profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" / ") || "—")}</td></tr><tr><th>Kısa vadeli</th><td colspan="3">${escapeHtml(profile.shortTermGoal || "—")}</td></tr><tr><th>Uzun vadeli</th><td colspan="3">${escapeHtml(profile.longTermGoal || "—")}</td></tr></table>
      <h2>Ders Bazında Akademik Durum</h2><table><tr><th>Ders</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Başarı</th></tr>${snapshot.subjects.map((row) => `<tr><td>${escapeHtml(row.subject)}</td><td>${row.correct}</td><td>${row.wrong}</td><td>${row.empty}</td><td>%${row.success}</td></tr>`).join("") || '<tr><td colspan="5">Henüz sınav verisi yok.</td></tr>'}</table>
      <h2>Öncelikli Kazanımlar</h2><table><tr><th>Ders</th><th>Konu</th><th>Kazanım</th><th>Başarı</th></tr>${snapshot.priorityOutcomes.slice(0,8).map((row) => `<tr><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.topic)}</td><td>${escapeHtml(row.outcome)}</td><td>%${row.success}</td></tr>`).join("") || '<tr><td colspan="4">Öncelikli kazanım tespit edilmedi.</td></tr>'}</table>
      <h2>Son Koç Görüşmeleri</h2><table><tr><th>Tarih</th><th>İyi Giden</th><th>Zorlanılan</th><th>Yeni Hedef</th></tr>${recentMeetings.map((row) => `<tr><td>${escapeHtml(humanDate(row.date))}</td><td>${escapeHtml(row.strengths)}</td><td>${escapeHtml(row.challenges)}</td><td>${escapeHtml(row.newGoal)}</td></tr>`).join("") || '<tr><td colspan="4">Henüz görüşme kaydı yok.</td></tr>'}</table>
      <div class="footer">e-Nstitü • Eğitim Koçu • Rapor otomatik oluşturulmuştur.</div><script>window.onload=()=>window.print();</script></body></html>`);
    popup.document.close();
  };

  const mobileLink = selectedProfile ? `${window.location.origin}/koc/${encodeURIComponent(selectedProfile.mobileToken)}?school=${encodeURIComponent(schoolId)}` : "";

  const renderProfileSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      <select value={selectedProfile?.studentId || ""} onChange={(event) => {
        const profile = profiles.find((item) => item.studentId === event.target.value);
        if (profile) chooseProfile(profile);
      }} className="min-w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-amber-400">
        <option value="">Öğrenci seçiniz</option>
        {profiles.slice().sort((a,b) => a.studentName.localeCompare(b.studentName,"tr")).map((profile) => <option key={profile.id} value={profile.studentId}>{profile.studentName} • {profile.classroom}</option>)}
      </select>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Yenile</button>
    </div>
  );

  const renderAcademic = (snapshot: AcademicSnapshot) => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="text-xs font-bold uppercase text-emerald-600">Genel Başarı</div><div className="mt-1 text-3xl font-black text-emerald-800">%{snapshot.overallSuccess}</div></div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="text-xs font-bold uppercase text-blue-600">Değerlendirilen Soru</div><div className="mt-1 text-3xl font-black text-blue-800">{snapshot.totalQuestions}</div></div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><div className="text-xs font-bold uppercase text-teal-600">Güçlü Ders</div><div className="mt-1 truncate text-xl font-black text-teal-800">{snapshot.strongestSubject?.subject || "—"}</div></div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><div className="text-xs font-bold uppercase text-rose-600">Öncelikli Ders</div><div className="mt-1 truncate text-xl font-black text-rose-800">{snapshot.prioritySubject?.subject || "—"}</div></div>
      </div>
      {snapshot.subjects.length ? <div className="grid gap-3 lg:grid-cols-2">{snapshot.subjects.map((row) => <div key={row.subject} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="font-black text-slate-800">{row.subject}</div><div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">%{row.success}</div></div><ProgressBar value={row.success} /><div className="mt-3 flex gap-4 text-xs font-bold text-slate-500"><span className="text-emerald-600">D {row.correct}</span><span className="text-rose-600">Y {row.wrong}</span><span>B {row.empty}</span></div></div>)}</div> : <EmptyState title="Henüz sınav verisi yok" detail="Öğrencinin değerlendirilmiş sınavları oluştuğunda ders ve kazanım analizi otomatik gelecektir." />}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 font-black text-slate-800"><Target className="h-5 w-5 text-rose-500" /> Öncelikli Kazanımlar</div>
        {snapshot.priorityOutcomes.length ? <div className="space-y-2">{snapshot.priorityOutcomes.map((row) => <div key={row.key} className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black text-rose-700">{row.subject} • {row.topic}</div><div className="mt-1 text-sm font-semibold text-slate-700">{row.outcome}</div></div><span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700">%{row.success}</span></div>)}</div> : <div className="text-sm text-slate-500">Öncelikli kazanım bulunmuyor.</div>}
      </div>
      {snapshot.trend.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-4 font-black text-slate-800">Sınav Gelişim Eğrisi</div><div className="flex min-h-44 items-end gap-3 overflow-x-auto border-b border-slate-100 pb-2">{snapshot.trend.slice(-8).map((point) => <div key={point.examId} className="flex min-w-20 flex-1 flex-col items-center gap-2"><div className="text-xs font-black text-slate-600">%{point.success}</div><div className="w-8 rounded-t-lg bg-gradient-to-t from-amber-400 to-emerald-500" style={{ height: `${Math.max(8, point.success * 1.25)}px` }} /><div className="max-w-24 truncate text-[10px] font-bold text-slate-500" title={point.examName}>{point.examName}</div></div>)}</div></div> : null}
    </div>
  );

  const renderDashboard = () => {
    const criticalCount = warnings.filter((warning) => warning.level === "critical").length;
    const today = isoDay();
    const todayMeetings = profiles.filter((profile) => profile.nextMeetingDate === today).length;
    const lateTasks = profiles.reduce((sum, profile) => sum + profile.tasks.filter((task) => task.status !== "completed" && task.dueDate && task.dueDate < today).length, 0);
    const positiveCount = warnings.filter((warning) => warning.level === "positive").length;
    return <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Bugünkü görüşme", todayMeetings, CalendarDays, "bg-blue-50 text-blue-700 border-blue-100"],
          ["Müdahale gereken", criticalCount, BellRing, "bg-rose-50 text-rose-700 border-rose-100"],
          ["Geciken görev", lateTasks, ClipboardList, "bg-amber-50 text-amber-700 border-amber-100"],
          ["Olumlu gelişim", positiveCount, TrendingUp, "bg-emerald-50 text-emerald-700 border-emerald-100"],
        ].map(([label, value, Icon, cls]: any) => <div key={label} className={`rounded-2xl border p-5 ${cls}`}><div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-wide opacity-70">{label}</div><div className="mt-2 text-4xl font-black">{value}</div></div><Icon className="h-9 w-9 opacity-50" /></div></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-black text-slate-900">Öncelikli Öğrenciler</h3><p className="text-sm text-slate-500">Koçun bugün bakması gereken durumlar</p></div><button onClick={() => setView("warnings")} className="text-sm font-black text-amber-700">Tüm uyarılar <ArrowRight className="inline h-4 w-4" /></button></div>
          {warnings.filter((item) => item.level !== "positive").slice(0, 8).length ? <div className="space-y-2">{warnings.filter((item) => item.level !== "positive").slice(0,8).map((warning) => <button key={warning.id} onClick={() => { const p=profiles.find(x=>x.id===warning.studentId); if(p){chooseProfile(p);setStudentCardTab("overview");setView("students");}}} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${warningClass(warning.level)}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1"><strong className="block text-sm">{warning.studentName} • {warning.classroom}</strong><span className="mt-0.5 block text-xs font-bold">{warning.title}</span><span className="mt-0.5 block text-xs opacity-80">{warning.detail}</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0" /></button>)}</div> : <EmptyState title="Acil uyarı yok" detail="Takip edilen öğrencilerde müdahale gerektiren kritik bir durum görünmüyor." />}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="text-lg font-black text-slate-900">Koçluk Portföyü</h3><p className="text-sm text-slate-500">Aktif takip özeti</p></div><div className="space-y-4"><ProgressBar value={students.length ? Math.round((profiles.length / students.length) * 100) : 0} label={`Takipte ${profiles.length} / ${students.length} öğrenci`} /><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Toplam görev</div><div className="mt-1 text-2xl font-black text-slate-800">{profiles.reduce((sum,p)=>sum+p.tasks.length,0)}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Görüşme</div><div className="mt-1 text-2xl font-black text-slate-800">{profiles.reduce((sum,p)=>sum+p.meetings.length,0)}</div></div></div><button onClick={() => setView("students")} className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600">Öğrenci Takibine Git</button></div></div>
      </div>
    </div>;
  };

  const renderStudents = () => {
    if (selectedProfile) {
      const rate = completionRate(selectedProfile);
      const lastMeeting = [...selectedProfile.meetings].sort((a,b)=>parseDate(b.date)-parseDate(a.date))[0];
      return <div className="space-y-5">
        <button onClick={() => setSelectedStudentId("")} className="text-sm font-black text-slate-500 hover:text-slate-800">← Öğrenci listesine dön</button>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl font-black text-white">{selectedProfile.studentName.split(" ").slice(0,2).map((part)=>part[0]).join("")}</div><div><h2 className="text-2xl font-black text-slate-900">{selectedProfile.studentName}</h2><div className="text-sm font-bold text-slate-500">{selectedProfile.classroom} • No {selectedProfile.studentNumber}</div></div></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Akademik %{selectedSnapshot.overallSuccess}</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">Plan %{rate}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">Son görüşme {humanDate(lastMeeting?.date)}</span></div></div>
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-100">{(["overview","academic","tasks","history"] as StudentCardTab[]).map((tab) => <button key={tab} onClick={() => setStudentCardTab(tab)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-black ${studentCardTab===tab?"border-amber-500 text-amber-700":"border-transparent text-slate-500 hover:text-slate-800"}`}>{tab==="overview"?"Genel Bakış":tab==="academic"?"Akademik Analiz":tab==="tasks"?"Plan & Görevler":"Koçluk Geçmişi"}</button>)}</div>
          <div className="pt-5">
            {studentCardTab === "overview" ? <div className="grid gap-5 xl:grid-cols-2"><div className="space-y-4"><h3 className="font-black text-slate-800">Hedef ve Koçluk Çerçevesi</h3><div className="grid gap-3 sm:grid-cols-2"><input value={goalDraft.targetExam} onChange={(e)=>setGoalDraft({...goalDraft,targetExam:e.target.value})} placeholder="Hedef sınav" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={goalDraft.targetUniversity} onChange={(e)=>setGoalDraft({...goalDraft,targetUniversity:e.target.value})} placeholder="Hedef üniversite" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={goalDraft.targetDepartment} onChange={(e)=>setGoalDraft({...goalDraft,targetDepartment:e.target.value})} placeholder="Hedef bölüm" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input type="date" value={goalDraft.nextMeetingDate} onChange={(e)=>setGoalDraft({...goalDraft,nextMeetingDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={goalDraft.shortTermGoal} onChange={(e)=>setGoalDraft({...goalDraft,shortTermGoal:e.target.value})} placeholder="Kısa vadeli hedef" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm sm:col-span-2"/><textarea value={goalDraft.longTermGoal} onChange={(e)=>setGoalDraft({...goalDraft,longTermGoal:e.target.value})} placeholder="Uzun vadeli hedef" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm sm:col-span-2"/></div><button disabled={saving} onClick={()=>void saveGoals()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">Hedefleri Kaydet</button></div><div className="space-y-4"><h3 className="font-black text-slate-800">Koç İçin Hızlı Özet</h3><div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white"><div className="text-xs font-bold uppercase tracking-wider text-slate-300">Bu görüşmede odaklan</div><div className="mt-3 space-y-2 text-sm font-semibold"><div>• {selectedSnapshot.prioritySubject ? `${selectedSnapshot.prioritySubject.subject} dersinde başarı %${selectedSnapshot.prioritySubject.success}.` : "Akademik veri geldikçe öncelikli ders burada oluşacak."}</div><div>• Plan tamamlama oranı %{rate}.</div><div>• {selectedSnapshot.priorityOutcomes[0] ? `${selectedSnapshot.priorityOutcomes[0].outcome} kazanımı tekrar edilmeli.` : "Kritik kazanım görünmüyor."}</div><div>• Son görüşme: {humanDate(lastMeeting?.date)}.</div></div></div></div></div> : null}
            {studentCardTab === "academic" ? renderAcademic(selectedSnapshot) : null}
            {studentCardTab === "tasks" ? <div className="space-y-3">{selectedProfile.tasks.length ? selectedProfile.tasks.map((task) => <div key={task.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-black text-slate-800">{task.title}</div><div className="mt-1 text-xs font-bold text-slate-500">{task.subject}{task.topic?` • ${task.topic}`:""}{task.questionCount?` • ${task.questionCount} soru`:""} • {humanDate(task.plannedDate)}</div></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${taskStatusClass(task.status)}`}>{coachTaskStatusLabel[task.status]}</span></div>{task.outcome?<div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">Kazanım: {task.outcome}</div>:null}</div>) : <EmptyState title="Görev bulunmuyor" detail="Plan & Görevler bölümünden öğrenciye somut çalışma görevleri oluşturabilirsiniz." />}</div> : null}
            {studentCardTab === "history" ? <div className="space-y-3">{selectedProfile.meetings.length ? selectedProfile.meetings.map((meeting) => <div key={meeting.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div className="font-black text-slate-800">{humanDate(meeting.date)} Koç Görüşmesi</div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Motivasyon {meeting.motivation}/5</span></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><span className="font-bold text-emerald-700">İyi giden:</span> {meeting.strengths || "—"}</div><div><span className="font-bold text-rose-700">Zorlanılan:</span> {meeting.challenges || "—"}</div><div><span className="font-bold text-blue-700">Öncelik:</span> {meeting.priority || "—"}</div><div><span className="font-bold text-amber-700">Yeni hedef:</span> {meeting.newGoal || "—"}</div></div></div>) : <EmptyState title="Görüşme kaydı yok" detail="İlk görüşmeyi Koç Görüşmeleri bölümünden kaydedin." />}</div> : null}
          </div>
        </div>
      </div>;
    }

    return <div className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Öğrenci adı, numarası veya sınıfı ile ara" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-amber-400"/></div><select value={selectedClassroom} onChange={(e)=>setSelectedClassroom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"><option>Tümü</option>{classrooms.map((classroom)=><option key={classroom}>{classroom}</option>)}</select><div className="text-sm font-bold text-slate-500">{filteredStudents.length} öğrenci</div></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredStudents.map((student) => { const profile=profileMap.get(String(student.id))||numberProfileMap.get(studentNumber(student)); const snapshot=profile?snapshotByProfile.get(profile.id):undefined; const rate=completionRate(profile); return <button key={student.id} onClick={()=>void activateStudent(student)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"><div className="flex items-start justify-between"><div><div className="text-base font-black text-slate-900">{studentName(student)}</div><div className="mt-1 text-xs font-bold text-slate-500">{studentClassroom(student)} • No {studentNumber(student)}</div></div>{profile?<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">TAKİPTE</span>:<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">KOÇLUĞA AL</span>}</div>{profile?<div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold text-slate-400">Akademik</div><div className="text-lg font-black text-slate-800">%{snapshot?.overallSuccess||0}</div></div><div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold text-slate-400">Plan</div><div className="text-lg font-black text-slate-800">%{rate}</div></div></div>:<div className="mt-4 text-xs font-semibold text-slate-500">Tıklayın; hedef, görev, görüşme ve mobil takip dosyası oluşturulsun.</div>}</button>;})}</div>
    </div>;
  };

  const renderTasks = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile ? <><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900"><Plus className="h-5 w-5 text-amber-600"/> Yeni Görev — {selectedProfile.studentName}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input value={taskDraft.title} onChange={(e)=>setTaskDraft({...taskDraft,title:e.target.value})} placeholder="Görev: 20 Fonksiyon sorusu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/><input value={taskDraft.subject} onChange={(e)=>setTaskDraft({...taskDraft,subject:e.target.value})} placeholder="Ders" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.questionCount} onChange={(e)=>setTaskDraft({...taskDraft,questionCount:e.target.value})} inputMode="numeric" placeholder="Soru sayısı" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.unit} onChange={(e)=>setTaskDraft({...taskDraft,unit:e.target.value})} placeholder="Ünite" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.topic} onChange={(e)=>setTaskDraft({...taskDraft,topic:e.target.value})} placeholder="Konu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.outcome} onChange={(e)=>setTaskDraft({...taskDraft,outcome:e.target.value})} placeholder="Kazanım" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/><input type="date" value={taskDraft.plannedDate} onChange={(e)=>setTaskDraft({...taskDraft,plannedDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input type="date" value={taskDraft.dueDate} onChange={(e)=>setTaskDraft({...taskDraft,dueDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.note} onChange={(e)=>setTaskDraft({...taskDraft,note:e.target.value})} placeholder="Koç notu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/></div><button disabled={saving||!taskDraft.title.trim()} onClick={()=>void addTask()} className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">Görevi Öğrenciye Ata</button></div><div className="space-y-3">{selectedProfile.tasks.length?selectedProfile.tasks.map((task)=><div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-black text-slate-900">{task.title}</div><div className="mt-1 text-xs font-bold text-slate-500">{task.subject}{task.topic?` • ${task.topic}`:""}{task.questionCount?` • ${task.questionCount} soru`:""} • Son: {humanDate(task.dueDate||task.plannedDate)}</div></div><div className="flex flex-wrap gap-2">{(["planned","started","completed","could-not"] as CoachTask["status"][]).map((status)=><button key={status} onClick={()=>void updateTaskStatus(task.id,status,status==="could-not"?(task.failureReason||"Öğrenci tamamlayamadı"):"")} className={`rounded-full border px-3 py-1.5 text-xs font-black ${task.status===status?taskStatusClass(status):"border-slate-200 bg-white text-slate-500"}`}>{coachTaskStatusLabel[status]}</button>)}</div></div></div>):<EmptyState title="Henüz görev yok" detail="Yukarıdaki formdan ilk çalışma görevini oluşturun."/>}</div></>:<EmptyState title="Öğrenci seçiniz" detail="Görev oluşturmak için önce koçluk takibine alınmış bir öğrenci seçin."/>}</div>;

  const renderMeetings = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 text-lg font-black text-slate-900">Yeni Koç Görüşmesi — {selectedProfile.studentName}</div><div className="grid gap-3 md:grid-cols-2"><input type="date" value={meetingDraft.date} onChange={(e)=>setMeetingDraft({...meetingDraft,date:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input type="date" value={meetingDraft.nextMeetingDate} onChange={(e)=>setMeetingDraft({...meetingDraft,nextMeetingDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={meetingDraft.previousWeek} onChange={(e)=>setMeetingDraft({...meetingDraft,previousWeek:e.target.value})} placeholder="Geçen haftanın hedefleri / ne oldu?" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.strengths} onChange={(e)=>setMeetingDraft({...meetingDraft,strengths:e.target.value})} placeholder="Bu hafta neyi iyi yaptı?" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.challenges} onChange={(e)=>setMeetingDraft({...meetingDraft,challenges:e.target.value})} placeholder="Zorlandığı alan / engel" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.priority} onChange={(e)=>setMeetingDraft({...meetingDraft,priority:e.target.value})} placeholder="Bu haftanın önceliği" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.newGoal} onChange={(e)=>setMeetingDraft({...meetingDraft,newGoal:e.target.value})} placeholder="Yeni hedef / karar" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm md:col-span-2"/><div className="md:col-span-2"><label className="text-xs font-black text-slate-500">Motivasyon düzeyi: {meetingDraft.motivation}/5</label><input type="range" min={1} max={5} value={meetingDraft.motivation} onChange={(e)=>setMeetingDraft({...meetingDraft,motivation:Number(e.target.value)})} className="mt-2 w-full accent-amber-500"/></div></div><button onClick={()=>void addMeeting()} className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white">Görüşmeyi Kaydet</button></div><div className="space-y-3">{selectedProfile.meetings.map((meeting)=><div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div className="font-black text-slate-900">{humanDate(meeting.date)}</div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Motivasyon {meeting.motivation}/5</span></div><div className="mt-3 grid gap-2 text-sm lg:grid-cols-2"><div><b>İyi giden:</b> {meeting.strengths||"—"}</div><div><b>Zorlanılan:</b> {meeting.challenges||"—"}</div><div><b>Öncelik:</b> {meeting.priority||"—"}</div><div><b>Yeni hedef:</b> {meeting.newGoal||"—"}</div></div></div>)}</div></>:<EmptyState title="Öğrenci seçiniz" detail="Koç görüşmesini kaydetmek için öğrenci seçin."/>}</div>;

  const renderWarnings = () => <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><div className="text-xs font-black uppercase text-rose-600">Kritik</div><div className="mt-1 text-3xl font-black text-rose-800">{warnings.filter(w=>w.level==="critical").length}</div></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="text-xs font-black uppercase text-amber-600">Dikkat</div><div className="mt-1 text-3xl font-black text-amber-800">{warnings.filter(w=>w.level==="attention").length}</div></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="text-xs font-black uppercase text-emerald-600">Olumlu</div><div className="mt-1 text-3xl font-black text-emerald-800">{warnings.filter(w=>w.level==="positive").length}</div></div></div>{warnings.length?<div className="space-y-2">{warnings.map((warning)=><button key={warning.id} onClick={()=>{const p=profiles.find(x=>x.id===warning.studentId);if(p){chooseProfile(p);setStudentCardTab("overview");setView("students");}}} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${warningClass(warning.level)}`}>{warning.level==="positive"?<TrendingUp className="mt-0.5 h-5 w-5"/>:<AlertTriangle className="mt-0.5 h-5 w-5"/>}<span className="min-w-0 flex-1"><strong className="block">{warning.studentName} • {warning.classroom}</strong><span className="mt-1 block text-sm font-bold">{warning.title}</span><span className="mt-1 block text-xs opacity-80">{warning.detail}</span></span><ArrowRight className="mt-2 h-4 w-4"/></button>)}</div>:<EmptyState title="Uyarı oluşmadı" detail="Takip verileri arttıkça erken uyarı motoru burada otomatik sinyaller üretecektir."/>}</div>;

  const renderMessages = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="grid gap-5 xl:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2 font-black text-slate-900"><MessageCircle className="h-5 w-5 text-blue-500"/> {selectedProfile.studentName} ile Koçluk Mesajları</div><div className="max-h-[520px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">{selectedProfile.messages.length?selectedProfile.messages.map((message)=><div key={message.id} className={`flex ${message.direction==="coach-to-student"?"justify-end":"justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.direction==="coach-to-student"?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-800"}`}><div>{message.text}</div><div className={`mt-1 text-[10px] font-bold ${message.direction==="coach-to-student"?"text-slate-400":"text-slate-400"}`}>{humanDate(message.createdAt)}</div></div></div>):<div className="py-12 text-center text-sm text-slate-400">Henüz mesaj yok.</div>}</div><div className="mt-3 flex gap-2"><input value={messageDraft} onChange={(e)=>setMessageDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void sendMessage();}} placeholder="Kısa koçluk mesajı yazın..." className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button onClick={()=>void sendMessage()} className="rounded-xl bg-blue-600 px-4 text-white"><Send className="h-4 w-4"/></button></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-black text-slate-900">Hazır Geri Bildirimler</div><div className="mt-3 space-y-2">{["Bu haftaki gelişimin iyi, aynı düzeni koruyalım.","Planında geride kalan görevleri birlikte toparlayalım.","Son sınavdaki yükseliş dikkat çekici. Tebrik ederim.","Anlamadığın konuyu işaretle; bir sonraki görüşmede birlikte ele alalım."].map((text)=><button key={text} onClick={()=>setMessageDraft(text)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50">{text}</button>)}</div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Mesajlaşmak için takipteki öğrencilerden birini seçin."/>}</div>;

  const renderReports = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-xs font-black uppercase tracking-widest text-amber-600">Aylık Gelişim Raporu</div><h2 className="mt-1 text-2xl font-black text-slate-900">{selectedProfile.studentName}</h2><div className="text-sm font-bold text-slate-500">{selectedProfile.classroom} • {new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date())}</div></div><button onClick={()=>printMonthlyReport(selectedProfile,selectedSnapshot)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"><Printer className="h-4 w-4"/> Yazdır / PDF</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs font-bold text-emerald-600">Akademik</div><div className="text-3xl font-black text-emerald-800">%{selectedSnapshot.overallSuccess}</div></div><div className="rounded-2xl bg-blue-50 p-4"><div className="text-xs font-bold text-blue-600">Plan Uyumu</div><div className="text-3xl font-black text-blue-800">%{completionRate(selectedProfile)}</div></div><div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs font-bold text-amber-600">Görüşme</div><div className="text-3xl font-black text-amber-800">{selectedProfile.meetings.length}</div></div><div className="rounded-2xl bg-violet-50 p-4"><div className="text-xs font-bold text-violet-600">Açık Görev</div><div className="text-3xl font-black text-violet-800">{selectedProfile.tasks.filter(t=>t.status!=="completed").length}</div></div></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><div className="font-black text-slate-800">Güçlü Alanlar</div><div className="mt-3 space-y-2 text-sm">{selectedSnapshot.subjects.slice(0,3).map(row=><div key={row.subject} className="flex justify-between"><span>{row.subject}</span><b className="text-emerald-700">%{row.success}</b></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-4"><div className="font-black text-slate-800">Geliştirilmesi Gereken Alanlar</div><div className="mt-3 space-y-2 text-sm">{selectedSnapshot.priorityOutcomes.slice(0,3).map(row=><div key={row.key}><b className="text-rose-700">{row.subject}</b> — {row.outcome} <span className="font-black">%{row.success}</span></div>)}</div></div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Aylık gelişim raporunu oluşturmak için öğrenci seçin."/>}</div>;

  const renderMobile = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="grid gap-5 xl:grid-cols-[1fr_390px]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Smartphone className="h-6 w-6"/></div><div><h3 className="text-lg font-black text-slate-900">Öğrenci Mobil Koçluk Bağlantısı</h3><p className="text-sm text-slate-500">Öğrenci kendi telefonundan görev, ilerleme ve koç mesajlarını görür.</p></div></div><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-400">Güvenli öğrenci bağlantısı</div><div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-600">{mobileLink}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={async()=>{try{await navigator.clipboard.writeText(mobileLink);}catch{}}} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"><Copy className="h-4 w-4"/> Kopyala</button><button onClick={()=>window.open(mobileLink,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white"><ExternalLink className="h-4 w-4"/> Telefonda Önizle</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500">Öğrencinin göreceği</div><div className="mt-2 text-sm font-semibold text-slate-700">Bugünkü görevler • Haftalık hedef • İlerleme • Koç mesajları • Yardım isteği</div></div><div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500">Öğrencinin yapacağı</div><div className="mt-2 text-sm font-semibold text-slate-700">Başladım • Tamamladım • Yapamadım • Koça mesaj gönder</div></div></div></div><div className="rounded-[32px] border-[8px] border-slate-900 bg-slate-50 p-4 shadow-xl"><div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-slate-800"/><div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white"><div className="text-xs font-bold opacity-80">EĞİTİM KOÇU</div><div className="mt-1 text-xl font-black">{selectedProfile.studentName}</div><div className="text-xs font-bold opacity-80">{selectedProfile.classroom}</div></div><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between text-xs font-black text-slate-500"><span>Haftalık plan</span><span>%{completionRate(selectedProfile)}</span></div><div className="mt-2"><ProgressBar value={completionRate(selectedProfile)}/></div></div><div className="mt-3 space-y-2">{selectedProfile.tasks.filter(t=>t.status!=="completed").slice(0,3).map(task=><div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="text-xs font-black text-slate-800">{task.title}</div><div className="mt-1 text-[10px] font-bold text-slate-400">{task.subject} • {humanDate(task.dueDate||task.plannedDate)}</div></div>)}</div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Mobil bağlantı oluşturmak ve önizlemek için öğrenci seçin."/>}</div>;

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500"/><div className="mt-3 text-sm font-bold text-slate-500">Eğitim Koçu verileri hazırlanıyor...</div></div></div>;

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300"><HeartHandshake className="h-4 w-4"/> e-Nstitü Eğitim Koçu</div><h1 className="mt-2 text-2xl font-black md:text-3xl">Ölç → Analiz Et → Hedef Koy → Uygula → İzle</h1><p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">Akademik veriyi, çalışma davranışını, görüşmeleri ve öğrenci iletişimini tek koçluk dosyasında birleştiren profesyonel takip merkezi.</p></div><div className="flex gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center"><div className="text-2xl font-black text-amber-300">{profiles.length}</div><div className="text-[10px] font-bold uppercase text-slate-400">Takipte</div></div><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center"><div className="text-2xl font-black text-rose-300">{warnings.filter(w=>w.level==="critical").length}</div><div className="text-[10px] font-bold uppercase text-slate-400">Kritik</div></div></div></div>
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{(Object.keys(viewLabels) as CoachView[]).map((item) => <button key={item} onClick={()=>{setView(item);try{sessionStorage.setItem("edupanel_education_coach_subtab",item);}catch{}}} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition ${view===item?"bg-amber-500 text-white shadow-sm":"text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>{viewLabels[item]}</button>)}</div>
      {view === "dashboard" ? renderDashboard() : null}
      {view === "students" ? renderStudents() : null}
      {view === "tasks" ? renderTasks() : null}
      {view === "meetings" ? renderMeetings() : null}
      {view === "warnings" ? renderWarnings() : null}
      {view === "messages" ? renderMessages() : null}
      {view === "reports" ? renderReports() : null}
      {view === "mobile" ? renderMobile() : null}
      {saving ? <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-xl"><Loader2 className="h-4 w-4 animate-spin"/> Kaydediliyor</div> : null}
    </div>
  </div>;
}
