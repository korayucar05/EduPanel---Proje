import ParentApprovalCenter from "./ParentApprovalCenter";
import YearbookAdmin from "./YearbookAdmin";
import EduPanelMobileButton from "./common/EduPanelMobileButton";
import MobileIdentityBanner from "./common/MobileIdentityBanner";
import SchoolRadioView from "./SchoolRadioView";
import TrialClubView from "./TrialClubView";
import MobileSurveyView from "./MobileSurveyView";
import React from "react";
import { activeCustomReminders } from "../utils/mobileReminderInformation";
import AdminBehaviorDisciplineView from "./AdminBehaviorDisciplineView";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Heart,
  MessageCircle,
  MoreVertical,
  Pencil,
  MessageCircleMore,
  Search,
  Settings,
  BellOff,
  BellRing,
  Share2,
  Trophy,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  Building2,
  ClipboardList,
  BadgeCheck,
  BedDouble,
  BookOpenText,
  CalendarRange,
  ExternalLink,
  GraduationCap,
  HeartHandshake,
  ListChecks,
  MessagesSquare,
  Mic,
  MicOff,
  ShieldCheck,
  Radio,
} from "lucide-react";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import adminPhoneSplashPhoto from "../assets/splash/mobile-role-1.jpg";
import teacherPhoneSplashPhoto from "../assets/splash/mobile-role-2.jpg";
import enstituSplashLogo from "../assets/splash/enstitu-logo-transparent.png";
import "../styles/admin-phone-splash.css";
import TeacherQuestionSelectionView from "./TeacherQuestionSelectionView";
import TeacherScheduleView from "./TeacherScheduleView";
import { TeacherItemAnalysisReportV2Modal } from "../reports-v2/item-analysis/TeacherItemAnalysisReportV2Modal";
import { installEnstituSoundUnlock, playEnstituNotificationSound } from "../lib/enstituSound";
import { disableWebPush, enableWebPush, hasWebPushSubscription } from "../lib/webPushClient";
import { exportTablePdf } from "../utils/tablePdf";
import { PdfEngine } from "../pdf/core/PdfEngine";
import {
  submitTeacherBehaviorRecords,
  type TeacherBehaviorLinkDocument,
} from "./behavior/teacherBehaviorCloud";

type BehaviorMode = "single" | "bulk" | "search";
type Screen = "home" | "behavior" | "homework" | "questions" | "schedule" | "curriculum-info" | "admin-programs" | "admin-duty" | "admin-staff-roles" | "admin-behavior" | "admin-exams" | "admin-study-plans" | "admin-parent-approvals" | "admin-yearbook" | "exam-results" | "messages" | "guidance-students" | "school-radio" | "trial-club" | "survey" | "announcements";
type Student = TeacherBehaviorLinkDocument["students"][number];

type StaffExamAnnouncement = {
  id: string;
  title: string;
  content: string;
  recipientType: "admin" | "teacher" | string;
  recipientTeacherName?: string;
  recipientTeacherKey?: string;
  examDate: string;
  examTime: string;
  expiresAt: string;
  exams: Array<{ gradeLevel?: string; courseName?: string; classrooms?: string[] }>;
  roomAssignments: Array<{ roomName?: string; buildingName?: string; floorName?: string; teacherName?: string }>;
  assignedRooms: string[];
};

type StaffMobileFeedItem = {
  id: string;
  title: string;
  content: string;
  date: string;
  time?: string;
  createdAt?: string;
  source?: string;
  url?: string;
};

const normalizeStaffAnnouncementKey = (value: unknown) => String(value || "")
  .trim()
  .toLocaleLowerCase("tr-TR")
  .replace(/[^a-z0-9çğıöşü_-]+/gi, "_")
  .replace(/^_+|_+$/g, "");

const canonicalStudentNumber = (student: Partial<Student> | null | undefined) =>
  String(student?.id || student?.number || "").trim();

const normalizeTeacherLinkStudentNumbers = (
  value: TeacherBehaviorLinkDocument,
): TeacherBehaviorLinkDocument => ({
  ...value,
  students: (Array.isArray(value.students) ? value.students : []).map((student) => ({
    ...student,
    number: canonicalStudentNumber(student),
  })),
});
type Behavior = TeacherBehaviorLinkDocument["behaviors"][number];
type BehaviorHistoryRecord = {
  id: string;
  studentId?: string;
  studentName?: string;
  studentNumber?: string;
  studentClassroom?: string;
  behaviorType?: string;
  behaviorName?: string;
  date?: string;
  description?: string;
  teacherName?: string;
  createdAt?: number;
  submittedAt?: string;
  source?: string;
};

type HomeworkStatus =
  | "Tam"
  | "Kısmi Eksik"
  | "Geliştirilmeli"
  | "Teslim Edilmedi";

type TeacherFamilyReceipt = {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classroom: string;
  sentAt: string;
  pushedAt?: string;
  deliveredAt?: string;
  clickedAt?: string;
  openedAt?: string;
  reminderCount?: number;
};

type TeacherMessageReply = {
  id: string;
  messageId: string;
  senderType: "student" | "parent" | "desktop" | "admin" | "teacher";
  senderName: string;
  senderTeacherId?: string;
  senderUserId?: string;
  studentId: string;
  studentNumber: string;
  classroom: string;
  body: string;
  createdAt: string;
  openedAt?: string | null;
};

type TeacherMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

type TeacherFamilyMessage = {
  id: string;
  title?: string;
  body: string;
  teacherName: string;
  createdAt: string;
  recipientCount: number;
  receipts: TeacherFamilyReceipt[];
  replies?: TeacherMessageReply[];
  attachment?: TeacherMessageAttachment | null;
};

type TeacherExamQuestionDetail = {
  qNum: number;
  originalIndex: number;
  studentAns: string;
  correctAns: string;
  isCorrect: boolean;
  isEmpty: boolean;
  unit: string;
  topic: string;
  outcome: string;
  imageUrl?: string;
};

type TeacherExamRankingRow = {
  studentNumber: string;
  studentName: string;
  classroom: string;
  bookletType: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  totalQuestions: number;
  classroomRank: number;
  schoolRank: number;
  questions: TeacherExamQuestionDetail[];
};

type TeacherExamClassStat = {
  classroom: string;
  participantCount: number;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  rank: number;
  isTeacherClass: boolean;
};

type TeacherExamItemStat = {
  questionNumber: number;
  bookletNumbers: Partial<Record<"A" | "B" | "C" | "D", number>>;
  correctAnswer: string;
  imageUrl?: string;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  totalCount: number;
  correctRate: number;
  choiceCounts: Record<string, number>;
};

type TeacherExamSubjectResult = {
  subjectName: string;
  assignedClassrooms: string[];
  teacherAverageNet: number;
  schoolAverageNet: number;
  assignedParticipantCount: number;
  schoolParticipantCount: number;
  rows: TeacherExamRankingRow[];
  classroomStats: TeacherExamClassStat[];
  items: TeacherExamItemStat[];
};

type TeacherExamResult = {
  id: string;
  examName: string;
  examDate: string;
  examType?: string;
  examSource?: string;
  subjects: TeacherExamSubjectResult[];
};

type TeacherExamResultsResponse = {
  exams: TeacherExamResult[];
  assignedSubjects: Array<{ courseName: string; classrooms: string[] }>;
};


type MobileSubHeaderProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  accent?: "teal" | "emerald" | "orange" | "indigo" | "amber";
  rightAction?: {
    label: string;
    onClick: () => void;
  };
};

const MobileSubHeader = ({
  title,
  subtitle,
  onBack,
  accent = "orange",
  rightAction,
}: MobileSubHeaderProps) => {
  const theme =
    accent === "emerald"
      ? {
          button: "border-slate-200 bg-white text-emerald-700 shadow-sm",
          title: "text-emerald-900",
          line: "bg-emerald-200",
          action: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : accent === "teal"
        ? {
            button: "border-slate-200 bg-white text-teal-700 shadow-sm",
            title: "text-teal-900",
            line: "bg-teal-200",
            action: "border-teal-200 bg-teal-50 text-teal-700",
          }
        : accent === "indigo"
          ? {
              button: "border-slate-200 bg-white text-indigo-700 shadow-sm",
              title: "text-indigo-950",
              line: "bg-indigo-200",
              action: "border-indigo-200 bg-indigo-50 text-indigo-700",
            }
          : accent === "amber"
            ? {
                button: "border-slate-200 bg-white text-amber-700 shadow-sm",
                title: "text-amber-950",
                line: "bg-amber-200",
                action: "border-amber-200 bg-amber-50 text-amber-700",
              }
            : {
                button: "border-slate-200 bg-white text-orange-700 shadow-sm",
                title: "text-orange-950",
                line: "bg-orange-200",
            action: "border-orange-200 bg-orange-50 text-orange-700",
          };

  return (
    <header className="relative border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
      <div className="flex min-h-[52px] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.button} transition active:scale-95`}
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className={`truncate text-[16px] font-black ${theme.title}`}>{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {rightAction ? (
          <button
            type="button"
            onClick={rightAction.onClick}
            className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-black transition active:scale-95 ${theme.action}`}
          >
            {rightAction.label}
          </button>
        ) : null}
      </div>
      <span className={`absolute bottom-0 left-0 h-0.5 w-full ${theme.line}`} aria-hidden="true" />
    </header>
  );
};

type GuidanceStudent = { id: string; number: string; name: string; classroom: string };
type GuidanceStudentOverview = {
  student: GuidanceStudent;
  behaviorHistory: BehaviorHistoryRecord[];
  exams: {
    lastExam: null | { id: string; examName: string; examDate: string; subjects: Array<{ subjectName: string; questionCount: number; correct: number; wrong: number; empty: number; net: number; successPercentage: number }> };
    courseProgress: Array<{ subjectName: string; changePercentagePoint: number; latest: { examName: string; examDate: string; successPercentage: number; net: number; correct: number; wrong: number; empty: number; questionCount: number }; first: { successPercentage: number }; history: Array<{ examName: string; examDate: string; successPercentage: number }> }>;
  };
};

const GuidanceStudentsView = ({ token, onBack }: { token: string; onBack: () => void }) => {
  const [query, setQuery] = React.useState("");
  const [students, setStudents] = React.useState<GuidanceStudent[]>([]);
  const [scope, setScope] = React.useState<"all" | "classroom" | "">("");
  const [selected, setSelected] = React.useState<GuidanceStudent | null>(null);
  const [overview, setOverview] = React.useState<GuidanceStudentOverview | null>(null);
  const [tab, setTab] = React.useState<"behavior" | "exams">("behavior");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadStudents = React.useCallback(async (search = "") => {
    setBusy(true); setError("");
    try {
      const result = await requestJson<{ students?: GuidanceStudent[]; scope?: "all" | "classroom" }>(`/api/behavior/teacher-links/${encodeURIComponent(token)}/guidance/students?q=${encodeURIComponent(search)}`);
      setStudents((Array.isArray(result.students) ? result.students : []).map((student) => ({
        ...student,
        number: String(student.number || student.id || "").trim(),
      })));
      setScope(result.scope || "");
    } catch (reason: any) { setError(reason?.message || "Öğrenciler getirilemedi."); }
    finally { setBusy(false); }
  }, [token]);

  React.useEffect(() => { void loadStudents(""); }, [loadStudents]);
  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadStudents(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, loadStudents]);

  const openStudent = async (student: GuidanceStudent) => {
    setSelected(student); setOverview(null); setBusy(true); setError(""); setTab("behavior");
    try {
      const result = await requestJson<GuidanceStudentOverview>(`/api/behavior/teacher-links/${encodeURIComponent(token)}/guidance/students/${encodeURIComponent(student.id)}/overview`);
      setOverview(result);
    } catch (reason: any) { setError(reason?.message || "Öğrenci dosyası getirilemedi."); }
    finally { setBusy(false); }
  };

  if (selected) return <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-indigo-50 p-3 text-slate-800 sm:p-5"><div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]"><MobileSubHeader title="Öğrenci Dosyası" subtitle={`${selected.name || selected.number || "Öğrenci"} · ${selected.classroom || "Sınıf bilgisi yok"}`} onBack={() => { setSelected(null); setOverview(null); setError(""); }} accent="teal" /><div className="p-4 sm:p-5"><div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3"><span className="inline-flex rounded-lg bg-cyan-700 px-2.5 py-1 text-[11px] font-black text-white">{selected.number || "—"}</span><strong className="mt-2 block text-base text-slate-900">{selected.name || "Öğrenci"}</strong><span className="mt-1 block text-xs font-bold text-slate-500">{selected.classroom || "Sınıf bilgisi yok"}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setTab("behavior")} className={`rounded-xl px-3 py-3 text-xs font-black ${tab === "behavior" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>Davranış / Disiplin</button><button type="button" onClick={() => setTab("exams")} className={`rounded-xl px-3 py-3 text-xs font-black ${tab === "exams" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>Sınav İşlemleri</button></div>{error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div> : null}{busy ? <div className="py-10 text-center text-xs font-bold text-slate-400">Öğrenci bilgileri yükleniyor…</div> : tab === "behavior" ? <div className="mt-4 space-y-2">{overview?.behaviorHistory?.length ? overview.behaviorHistory.map((record) => <article key={record.id} className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3"><strong className="block text-xs text-slate-900">{record.behaviorName || record.behaviorType || "Davranış kaydı"}</strong><span className="mt-1 block text-[10px] font-bold text-slate-500">{record.date || record.submittedAt || "Tarih bilgisi yok"}{record.teacherName ? ` · ${record.teacherName}` : ""}</span>{record.description ? <p className="mt-2 text-[11px] leading-4 text-slate-600">{record.description}</p> : null}</article>) : <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-10 text-center text-xs font-bold text-slate-400">Davranış / disiplin kaydı bulunamadı.</div>}</div> : <div className="mt-4 space-y-3">{overview?.exams?.lastExam ? <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3"><span className="text-[10px] font-black uppercase tracking-wide text-indigo-600">En son deneme · {overview.exams.lastExam.examDate || "Tarih yok"}</span><strong className="mt-1 block text-sm text-indigo-950">{overview.exams.lastExam.examName}</strong><div className="mt-3 grid grid-cols-2 gap-2">{overview.exams.lastExam.subjects.map((subject) => <div key={subject.subjectName} className="rounded-xl bg-white p-2"><strong className="block truncate text-[11px] text-slate-800">{subject.subjectName}</strong><span className="mt-1 block text-lg font-black text-indigo-700">%{subject.successPercentage.toFixed(1)}</span><span className="text-[9px] font-bold text-slate-500">{subject.correct}D · {subject.wrong}Y · {subject.net.toFixed(2)} net</span></div>)}</div></section> : <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">Bu öğrenci için değerlendirilmiş deneme bulunamadı.</div>}<section>{overview?.exams?.courseProgress?.map((course) => <article key={course.subjectName} className="mb-2 rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-slate-900">{course.subjectName}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black ${course.changePercentagePoint >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{course.changePercentagePoint >= 0 ? "+" : ""}{course.changePercentagePoint.toFixed(1)} puan</span></div><div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500"><span>İlk: %{course.first.successPercentage.toFixed(1)}</span><span>Güncel: %{course.latest.successPercentage.toFixed(1)}</span><span>{course.history.length} deneme</span></div></article>)}</section></div>}</div></div></main>;

  return <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-indigo-50 p-3 text-slate-800 sm:p-5"><div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]"><MobileSubHeader title="Öğrenciler" subtitle={scope === "all" ? "Tüm öğrenciler" : scope === "classroom" ? "Sorumlu olduğunuz sınıflar" : "Öğrenci rehberlik dosyaları"} onBack={onBack} accent="teal" /><div className="p-4 sm:p-5"><div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Okul numarası, ad veya soyad ile ara" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></div>{error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div> : null}<div className="mt-4 max-h-[calc(100vh-240px)] space-y-2 overflow-y-auto">{busy ? <div className="py-10 text-center text-xs font-bold text-slate-400">Öğrenciler yükleniyor…</div> : students.length ? students.map((student) => <button key={student.id} type="button" onClick={() => void openStudent(student)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50"><span className="flex min-w-14 justify-center rounded-xl bg-cyan-100 px-2 py-2 text-sm font-black text-cyan-800">{student.number || "—"}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{student.name || "İsim bilgisi yok"}</strong><span className="mt-0.5 block text-[10px] font-bold text-slate-500">{student.classroom || "Sınıf bilgisi yok"}</span></span><ChevronRight className="h-5 w-5 text-slate-400" /></button>) : <div className="py-10 text-center text-xs font-bold text-slate-400">Aramanızla eşleşen öğrenci bulunamadı.</div>}</div></div></div></main>;
};


type BehaviorSelectProps = {
  value: Behavior | null;
  onChange: (value: Behavior | null) => void;
  options: Behavior[];
};

const BehaviorSelect = ({ value, onChange, options }: BehaviorSelectProps) => {
  return (
    <section>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        Davranış
      </label>
      <select
        value={value?.id || ""}
        onChange={(event) => {
          const selected = options.find((item) => item.id === event.target.value) || null;
          onChange(selected);
        }}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500"
      >
        <option value="">Davranış seçiniz…</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.type} · {item.name}
          </option>
        ))}
      </select>
    </section>
  );
};

type StudentSearchProps = {
  query: string;
  setQuery: (value: string) => void;
  results: Student[];
  onSelect: (student: Student) => void;
};

const StudentSearch = ({ query, setQuery, results, onSelect }: StudentSearchProps) => {
  const hasQuery = query.trim().length > 0;

  return (
    <section>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        Öğrenci Ara
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Öğrenci no, ad soyad veya sınıf"
          autoComplete="off"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-orange-500"
        />
      </div>

      {hasQuery && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
          {results.length > 0 ? (
            results.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelect(student)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 active:bg-orange-50"
              >
                <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-orange-50 px-2 text-[11px] font-black text-orange-700">
                  {studentSchoolNumber(student) || "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-black text-slate-900">
                    {student.name}
                  </strong>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
                    {student.classroom || "Sınıf bilgisi yok"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-center text-xs font-bold text-slate-500">
              Aramanızla eşleşen öğrenci bulunamadı.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const SelectedStudentCard = ({ student }: { student: Student }) => (
  <section className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
    <div className="flex items-center gap-3">
      <span className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-white px-2 text-xs font-black text-orange-700 shadow-sm">
        {studentSchoolNumber(student) || "—"}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-black text-slate-900">{student.name}</strong>
        <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-600">
          {student.classroom || "Sınıf bilgisi yok"}
        </span>
      </div>
      <CheckCircle2 className="h-5 w-5 shrink-0 text-orange-600 whitespace-normal break-words leading-tight [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden" />
    </div>
  </section>
);

type HomeworkOccurrence = {
  date: string;
  day: string;
  hour: number;
  start: string;
  end: string;
  reminderTime: string;
};

type HomeworkAssignment = {
  classroomId: string;
  classroom: string;
  courseName: string;
  studentIds?: string[];
  slots: Array<{ day: string; hour: number; start: string; end: string }>;
  nextOccurrences: HomeworkOccurrence[];
};


type HomeworkScheduleResponse = {
  now: { date: string; day: string; time: string };
  days: Array<{
    day: string;
    slots: Array<{
      hour: number;
      start: string;
      end: string;
      assignment: null | {
        classroomId?: string;
        classroomName?: string;
        courseName?: string;
      };
    }>;
  }>;
};

const homeworkAssignmentKey = (classroom: string, courseName: string) =>
  `${normalize(classroom)}|${normalize(courseName)}`;

const addDaysIso = (date: string, amount: number) => {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
};

const dayNameForIso = (date: string) => {
  const names = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const parsed = new Date(`${date}T12:00:00Z`);
  return names[parsed.getUTCDay()] || "";
};

const addMinutesToHomeworkTime = (value: string, minutes: number) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};

const homeworkAssignmentsFromSchedule = (schedule: HomeworkScheduleResponse): HomeworkAssignment[] => {
  const unique = new Map<string, HomeworkAssignment>();

  for (const day of schedule.days || []) {
    for (const slot of day.slots || []) {
      const assignment = slot.assignment;
      const classroom = String(assignment?.classroomName || "").trim();
      const courseName = String(assignment?.courseName || "").trim();
      if (!assignment || !classroom || !courseName) continue;

      const key = homeworkAssignmentKey(classroom, courseName);
      const current = unique.get(key) || {
        classroomId: String(assignment.classroomId || ""),
        classroom,
        courseName,
        slots: [],
        nextOccurrences: [],
      };
      current.slots.push({ day: day.day, hour: slot.hour, start: slot.start, end: slot.end });
      unique.set(key, current);
    }
  }

  for (const assignment of unique.values()) {
    const occurrences: HomeworkOccurrence[] = [];
    for (let offset = 1; offset <= 35 && occurrences.length < 4; offset += 1) {
      const date = addDaysIso(schedule.now.date, offset);
      const day = dayNameForIso(date);
      const daySlots = assignment.slots
        .filter((slot) => slot.day === day)
        .sort((a, b) => a.hour - b.hour);
      if (!daySlots.length) continue;
      const first = daySlots[0];
      occurrences.push({
        date,
        day,
        hour: first.hour,
        start: first.start,
        end: first.end,
        reminderTime: addMinutesToHomeworkTime(first.start, 5),
      });
    }
    assignment.nextOccurrences = occurrences;
  }

  return [...unique.values()].sort((a, b) =>
    classroomSort(a.classroom, b.classroom) || a.courseName.localeCompare(b.courseName, "tr-TR"),
  );
};

type HomeworkSession = {
  id: string;
  classroom: string;
  courseName?: string;
  topic: string;
  homeworkDate: string;
  controlDate?: string;
  evaluatedCount?: number;
  totalStudents?: number;
  fullyEvaluated?: boolean;
  reminderDate?: string;
  reminderDay?: string;
  reminderHour?: number;
  reminderStartTime?: string;
  reminderTime?: string;
  reminderAcknowledgedAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const HOMEWORK_STATUSES: Array<{
  value: HomeworkStatus;
  className: string;
  selectedClassName: string;
}> = [
  {
    value: "Tam",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    selectedClassName:
      "border-emerald-600 bg-emerald-600 text-white shadow-md",
  },
  {
    value: "Kısmi Eksik",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    selectedClassName: "border-amber-500 bg-amber-500 text-white shadow-md",
  },
  {
    value: "Geliştirilmeli",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    selectedClassName: "border-sky-600 bg-sky-600 text-white shadow-md",
  },
  {
    value: "Teslim Edilmedi",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    selectedClassName: "border-rose-600 bg-rose-600 text-white shadow-md",
  },
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const studentSchoolNumber = (student: Student | any) =>
  String(
    student?.number ??
    student?.studentNumber ??
    student?.studentNo ??
    student?.schoolNumber ??
    student?.schoolNo ??
    student?.ogrenciNo ??
    student?.okulNo ??
    student?.okulNumarasi ??
    student?.student_number ??
    student?.no ??
    "",
  ).trim();

const matches = (query: string, student: Student) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const haystack = normalize(
    `${student.name} ${studentSchoolNumber(student)} ${student.classroom}`,
  );
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactHaystack = haystack.replace(/\s+/g, "");
  return (
    terms.every((term) => haystack.includes(term)) ||
    compactHaystack.includes(compactQuery)
  );
};

const numericStudentNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const sortStudentsByNumber = (rows: Student[]) =>
  [...rows].sort(
    (a, b) =>
      numericStudentNumber(studentSchoolNumber(a)) - numericStudentNumber(studentSchoolNumber(b)) ||
      a.name.localeCompare(b.name, "tr-TR"),
  );

const classroomSort = (a: string, b: string) =>
  a.localeCompare(b, "tr-TR", { numeric: true, sensitivity: "base" });

const today = () => new Date().toISOString().slice(0, 10);

const isStandaloneTeacherApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const homeworkAssignmentCacheKey = (token: string) =>
  `enstitu_teacher_homework_assignments_${token}`;

const readHomeworkAssignmentCache = (token: string): HomeworkAssignment[] => {
  if (!token) return [];
  try {
    const raw = window.sessionStorage.getItem(homeworkAssignmentCacheKey(token));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHomeworkAssignmentCache = (token: string, rows: HomeworkAssignment[]) => {
  if (!token) return;
  try {
    window.sessionStorage.setItem(homeworkAssignmentCacheKey(token), JSON.stringify(rows));
  } catch {
    // Session storage may be unavailable in restrictive mobile browsers.
  }
};

const readInstalledFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const writeInstalledFlag = (key: string) => {
  try {
    window.localStorage.setItem(key, "1");
  } catch {}
};

const teacherLinkCacheKey = (token: string) => `enstitu_teacher_link_cache_v2:${token}`;

const isAdminStaffLike = (value: any) => {
  if (!value) return false;
  const directRole = String(value?.role || value?.staffRole || "").trim().toUpperCase();
  if (directRole === "ADMIN") return true;
  const probe = [value?.role, value?.staffRole, value?.position, value?.title]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return /admin|administrator|principal|vice[_ -]?principal|deputy[_ -]?principal|assistant[_ -]?principal|müdür|mudur|yönetici|yonetici/.test(probe);
};

const readTeacherLinkCache = (token: string): TeacherBehaviorLinkDocument | null => {
  if (!token) return null;
  try {
    const raw = window.localStorage.getItem(teacherLinkCacheKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? normalizeTeacherLinkStudentNumbers(parsed as TeacherBehaviorLinkDocument)
      : null;
  } catch {
    return null;
  }
};

const writeTeacherLinkCache = (token: string, value: TeacherBehaviorLinkDocument) => {
  if (!token || !value) return;
  try {
    window.localStorage.setItem(teacherLinkCacheKey(token), JSON.stringify(value));
  } catch {}
};

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal || controller.signal,
      // Öğretmen bağlantıları token ile yetkilidir; oturum cookie'lerine ihtiyaç yoktur.
      // Büyük/eskimiş cookie başlıklarının 431 üretmesini engelle.
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Sunucu ${Math.round(timeoutMs / 1000)} saniye içinde yanıt vermedi.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `Sunucu hatası (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = String(body.error);
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}


type AdminProgramSlot = {
  hour: number;
  start: string;
  end: string;
  assignment?: { classroomName?: string; courseName?: string } | null;
  assignments?: Array<{ teacherName?: string; teacherName2?: string; courseName?: string }>;
};

type AdminProgramDay = { day: string; slots: AdminProgramSlot[] };
type AdminProgramTeacher = { id: string; name: string; branch?: string; days: AdminProgramDay[] };
type AdminProgramClassroom = { id: string; name: string; days: AdminProgramDay[] };

function AdminProgramsView({ token, onBack }: { token: string; onBack: () => void }) {
  type AdminProgramMode = "teacher" | "classroom" | "now" | "duty";
  const [teachers, setTeachers] = React.useState<AdminProgramTeacher[]>([]);
  const [classrooms, setClassrooms] = React.useState<AdminProgramClassroom[]>([]);
  const [mode, setMode] = React.useState<AdminProgramMode>("teacher");
  const [teacherIndex, setTeacherIndex] = React.useState(0);
  const [classIndex, setClassIndex] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dutyData, setDutyData] = React.useState<any>(null);
  const [dutyBusy, setDutyBusy] = React.useState(false);
  const [dutyError, setDutyError] = React.useState("");
  const [nowTick, setNowTick] = React.useState(() => new Date());
  const [voiceListening, setVoiceListening] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");
  const voiceRecognitionRef = React.useRef<any>(null);
  const touchX = React.useRef<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    requestJson<{ teachers: AdminProgramTeacher[]; classrooms: AdminProgramClassroom[] }>(`/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/programs`)
      .then((data) => {
        if (!alive) return;
        setTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
        setClassrooms(Array.isArray(data?.classrooms) ? data.classrooms : []);
        setError("");
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Programlar yüklenemedi."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [token]);

  React.useEffect(() => {
    if (mode !== "duty" || dutyData || dutyBusy) return;
    let alive = true;
    setDutyBusy(true);
    requestJson<any>(`/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/duty`)
      .then((value) => { if (alive) { setDutyData(value); setDutyError(""); } })
      .catch((e) => { if (alive) setDutyError(e instanceof Error ? e.message : "Nöbet listesi yüklenemedi."); })
      .finally(() => { if (alive) setDutyBusy(false); });
    return () => { alive = false; };
  }, [mode, token, dutyData, dutyBusy]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => () => {
    try { voiceRecognitionRef.current?.abort?.(); } catch {}
  }, []);

  React.useEffect(() => { setQuery(""); }, [mode]);

  const move = (delta: number) => {
    if (mode === "teacher") {
      if (!teachers.length) return;
      setTeacherIndex((current) => Math.max(0, Math.min(teachers.length - 1, current + delta)));
    } else if (mode === "classroom") {
      if (!classrooms.length) return;
      setClassIndex((current) => Math.max(0, Math.min(classrooms.length - 1, current + delta)));
    }
  };

  const selectByQuery = (value: string) => {
    setQuery(value);
    const normalized = value.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return;
    if (mode === "teacher") {
      const found = teachers.findIndex((item) => item.name.toLocaleLowerCase("tr-TR").includes(normalized));
      if (found >= 0) setTeacherIndex(found);
    } else if (mode === "classroom") {
      const found = classrooms.findIndex((item) => item.name.toLocaleLowerCase("tr-TR").includes(normalized));
      if (found >= 0) setClassIndex(found);
    }
  };

  const startVoiceSearch = () => {
    setVoiceError("");
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceError("Bu tarayıcı sesli aramayı desteklemiyor. Chrome veya Edge kullanabilirsiniz.");
      return;
    }

    if (voiceListening && voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    voiceRecognitionRef.current = recognition;
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => setVoiceListening(true);
    recognition.onend = () => {
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
    };
    recognition.onerror = (event: any) => {
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
      const code = String(event?.error || "");
      if (code === "not-allowed" || code === "service-not-allowed") {
        setVoiceError("Mikrofon izni verilmedi. Tarayıcıdan mikrofon iznini açın.");
      } else if (code !== "no-speech" && code !== "aborted") {
        setVoiceError("Ses anlaşılamadı. Tekrar deneyin.");
      }
    };
    recognition.onresult = (event: any) => {
      const spoken = String(event?.results?.[0]?.[0]?.transcript || "").trim();
      if (spoken) selectByQuery(spoken);
    };
    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceError("Sesli arama başlatılamadı. Tekrar deneyin.");
    }
  };

  const current = mode === "teacher" ? teachers[teacherIndex] : mode === "classroom" ? classrooms[classIndex] : null;
  const currentIndex = mode === "teacher" ? teacherIndex : classIndex;
  const total = mode === "teacher" ? teachers.length : classrooms.length;

  const adminProgramWeekDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

  const normalizedProgramDays = React.useMemo<AdminProgramDay[]>(() => {
    const sourceDays = Array.isArray(current?.days) ? current.days : [];
    return adminProgramWeekDays.map((dayName) => {
      const found = sourceDays.find((item) => normalize(item?.day) === normalize(dayName));
      return {
        day: dayName,
        slots: Array.isArray(found?.slots) ? found.slots : [],
      };
    });
  }, [current]);

  const hours = React.useMemo(
    () =>
      [...new Set(
        normalizedProgramDays.flatMap((day) =>
          (day.slots || []).map((slot) => Number(slot.hour)).filter((hour) => Number.isFinite(hour)),
        ),
      )].sort((a, b) => a - b),
    [normalizedProgramDays],
  );

  const slotFor = (dayName: string, hour: number) =>
    normalizedProgramDays
      .find((day) => normalize(day.day) === normalize(dayName))
      ?.slots?.find((slot) => Number(slot.hour) === Number(hour));

  const istanbulParts = React.useMemo(() => {
    const parts = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(nowTick);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
    return { day: get("weekday"), time: `${get("hour")}:${get("minute")}` };
  }, [nowTick]);

  const isCurrentTeacherLessonCell = (dayName: string, slot?: AdminProgramSlot) => {
    if (mode !== "teacher" || !slot?.assignment) return false;
    if (normalize(dayName) !== normalize(istanbulParts.day)) return false;
    const toMinutes = (value: string) => {
      const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
    };
    const nowMinutes = toMinutes(istanbulParts.time);
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    return start >= 0 && end >= 0 && nowMinutes >= start && nowMinutes < end;
  };

  const activeNowRows = React.useMemo(() => {
    const toMinutes = (value: string) => {
      const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
    };
    const nowMinutes = toMinutes(istanbulParts.time);
    const rows: Array<{ teacherName: string; classroomName: string; courseName: string; hour: number; start: string; end: string }> = [];
    for (const teacher of teachers) {
      const day = (teacher.days || []).find((item) => normalize(item.day) === normalize(istanbulParts.day));
      if (!day) continue;
      for (const slot of day.slots || []) {
        const start = toMinutes(slot.start);
        const end = toMinutes(slot.end);
        if (start < 0 || end < 0 || nowMinutes < start || nowMinutes >= end || !slot.assignment) continue;
        rows.push({
          teacherName: teacher.name,
          classroomName: String(slot.assignment.classroomName || "-"),
          courseName: String(slot.assignment.courseName || "Ders"),
          hour: slot.hour,
          start: slot.start,
          end: slot.end,
        });
      }
    }
    return rows.sort((a, b) => classroomSort(a.classroomName, b.classroomName) || a.teacherName.localeCompare(b.teacherName, "tr-TR"));
  }, [teachers, istanbulParts]);

  const dutyItems = Array.isArray(dutyData?.items) ? dutyData.items : [];
  const dutyGrouped = React.useMemo(() => dutyItems.reduce((map: Map<string, any[]>, item: any) => {
    const key = String(item.location || "Görev Yeri Belirtilmemiş");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
    return map;
  }, new Map<string, any[]>()), [dutyItems]);

  const tabs: Array<{ id: AdminProgramMode; label: string }> = [
    { id: "teacher", label: "Öğretmen" },
    { id: "classroom", label: "Sınıf" },
    { id: "now", label: "Şu an" },
    { id: "duty", label: "Nöbet" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <MobileSubHeader title="Programlar" subtitle="Öğretmen, sınıf, anlık ders ve nöbet bilgileri" onBack={onBack} accent="indigo" />
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`min-w-0 rounded-xl px-1 py-2.5 text-[10px] font-black transition sm:text-xs ${mode === tab.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(mode === "teacher" || mode === "classroom") ? (
            <div>
              <div className="flex items-stretch gap-2">
                <label className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    list={mode === "teacher" ? "admin-program-teachers" : "admin-program-classrooms"}
                    value={query}
                    onChange={(e) => selectByQuery(e.target.value)}
                    placeholder={mode === "teacher" ? "Öğretmen ara..." : "Sınıf ara..."}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white"
                  />
                  <datalist id="admin-program-teachers">{teachers.map((item) => <option key={item.id || item.name} value={item.name} />)}</datalist>
                  <datalist id="admin-program-classrooms">{classrooms.map((item) => <option key={item.id || item.name} value={item.name} />)}</datalist>
                </label>
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={`flex w-12 shrink-0 items-center justify-center rounded-2xl border transition ${voiceListening ? "border-rose-300 bg-rose-50 text-rose-600 ring-2 ring-rose-100" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
                  aria-label={voiceListening ? "Sesli aramayı durdur" : "Sesli arama"}
                  title={voiceListening ? "Dinleniyor… Durdur" : "Sesli arama"}
                >
                  {voiceListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              </div>
              {voiceListening ? <div className="mt-1.5 pl-1 text-[10px] font-black text-rose-600">Dinliyorum… öğretmen veya sınıf adını söyleyin.</div> : null}
              {voiceError ? <div className="mt-1.5 pl-1 text-[10px] font-bold text-rose-600">{voiceError}</div> : null}
            </div>
          ) : null}

          {busy && mode !== "duty" ? <div className="py-12 text-center text-sm font-bold text-slate-400">Programlar yükleniyor...</div> : null}
          {error && mode !== "duty" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div> : null}

          {!busy && !error && (mode === "teacher" || mode === "classroom") && current ? (
            <section
              onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
              onTouchEnd={(e) => {
                if (touchX.current == null) return;
                const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
                touchX.current = null;
                if (Math.abs(dx) < 45) return;
                move(dx < 0 ? 1 : -1);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse" || event.button !== 0) return;
                touchX.current = event.clientX;
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== "mouse" || touchX.current == null) return;
                const dx = event.clientX - touchX.current;
                touchX.current = null;
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                if (Math.abs(dx) < 45) return;
                move(dx < 0 ? 1 : -1);
              }}
              onPointerCancel={() => { touchX.current = null; }}
              className="cursor-grab overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm active:cursor-grabbing"
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-3 text-white">
                <button type="button" onClick={() => move(-1)} disabled={currentIndex === 0} className="rounded-xl bg-white/15 p-2 disabled:opacity-30" aria-label="Önceki">‹</button>
                <div className="min-w-0 text-center">
                  <div className="truncate text-base font-black">{current.name}</div>
                  <div className="mt-0.5 text-[10px] font-bold text-indigo-100">
                    {mode === "teacher" ? ((current as AdminProgramTeacher).branch || "Branş bilgisi") : "Haftalık Sınıf Programı"} · {currentIndex + 1}/{total}
                  </div>
                </div>
                <button type="button" onClick={() => move(1)} disabled={currentIndex >= total - 1} className="rounded-xl bg-white/15 p-2 disabled:opacity-30" aria-label="Sonraki">›</button>
              </div>

              <div className="p-2">
                <div className="grid grid-cols-[36px_repeat(5,minmax(0,1fr))] overflow-hidden rounded-2xl border border-slate-200 text-center">
                  <div className="bg-slate-100 p-1.5 text-[8px] font-black text-slate-500">Ders</div>
                  {normalizedProgramDays.map((day) => <div key={day.day} className="border-l border-slate-200 bg-slate-100 p-1.5 text-[8px] font-black text-slate-600">{day.day.slice(0,3)}</div>)}
                  {hours.map((hour) => (
                    <React.Fragment key={hour}>
                      <div className="flex items-center justify-center border-t border-slate-200 bg-slate-50 px-1 py-2 text-[9px] font-black text-slate-500">{hour}</div>
                      {normalizedProgramDays.map((day) => {
                        const slot = slotFor(day.day, hour);
                        if (mode === "teacher") {
                          const a = slot?.assignment;
                          const activeTeacherCell = isCurrentTeacherLessonCell(day.day, slot);
                          return <div key={`${day.day}-${hour}`} className={`min-h-[58px] border-l border-t border-slate-200 p-1 text-[8px] leading-tight transition-colors ${activeTeacherCell ? "bg-yellow-300 ring-1 ring-inset ring-amber-400" : "bg-white"}`}>
                            {a ? <><div className={`font-black ${activeTeacherCell ? "text-amber-950" : "text-indigo-700"}`}>{a.classroomName || "-"}</div><div className={`mt-1 line-clamp-2 font-bold ${activeTeacherCell ? "text-amber-900" : "text-slate-600"}`}>{a.courseName || "Ders"}</div></> : <span className="text-slate-300">—</span>}
                          </div>;
                        }
                        const assignments = Array.isArray(slot?.assignments) ? slot.assignments : [];
                        return <div key={`${day.day}-${hour}`} className="min-h-[58px] border-l border-t border-slate-200 p-1 text-[8px] leading-tight">
                          {assignments.length ? assignments.map((a, i) => <div key={`${a.teacherName}-${i}`} className={i ? "mt-1 border-t border-slate-100 pt-1" : ""}><div className="line-clamp-2 font-black text-indigo-700">{a.courseName || "Ders"}</div><div className="mt-0.5 line-clamp-2 font-bold text-slate-600">{[a.teacherName, a.teacherName2].filter(Boolean).join(" / ") || "-"}</div></div>) : <span className="text-slate-300">—</span>}
                        </div>;
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-2 text-center text-[9px] font-bold text-slate-400">Sağa / sola kaydır: her hareket tam 1 {mode === "teacher" ? "öğretmen" : "sınıf"} değiştirir.</p>
              </div>
            </section>
          ) : null}

          {!busy && !error && mode === "now" ? (
            <section className="space-y-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-indigo-600">Şu an</div>
                <div className="text-sm font-black text-slate-900">{istanbulParts.day} · {istanbulParts.time}</div>
              </div>
              {activeNowRows.length ? activeNowRows.map((item) => (
                <div key={`${item.teacherName}-${item.classroomName}-${item.hour}`} className="grid grid-cols-[64px_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-center bg-slate-800 px-2 py-3 text-center text-xs font-black text-white">{item.classroomName}</div>
                  <div className="px-3 py-2.5">
                    <div className="text-sm font-black text-slate-900">{item.teacherName}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{item.courseName} · {item.hour}. ders · {item.start}-{item.end}</div>
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Şu anda devam eden ders bulunmuyor.</div>}
            </section>
          ) : null}

          {mode === "duty" ? (
            <section className="space-y-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-700">Bugün</div>
                <div className="text-sm font-black text-slate-900">{dutyData?.now?.day || istanbulParts.day} · {dutyData?.now?.date || "-"}</div>
              </div>
              {dutyBusy ? <div className="py-12 text-center text-sm font-bold text-slate-400">Nöbet listesi yükleniyor...</div> : null}
              {dutyError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{dutyError}</div> : null}
              {!dutyBusy && !dutyError && dutyItems.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Bugün için nöbetçi öğretmen kaydı bulunamadı.</div> : null}
              {!dutyBusy && !dutyError ? [...dutyGrouped.entries()].map(([location, dutyTeachers]) => (
                <section key={location} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-slate-800 px-4 py-2.5 text-sm font-black text-white">{location}</div>
                  <div className="divide-y divide-slate-100">
                    {dutyTeachers.map((item: any) => <div key={item.id} className="px-4 py-3 text-sm font-normal text-slate-800">{item.teacherName}</div>)}
                  </div>
                </section>
              )) : null}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}


type AdminStaffRole = "ADMIN" | "GUIDANCE" | "TEACHER";
type AdminStaffProfileRow = {
  teacherId: string;
  teacherName: string;
  branch?: string;
  role: AdminStaffRole;
  staffRole?: AdminStaffRole;
  position?: string;
  updatedAt?: string;
};


type CurriculumProgressCourse = {
  id: string;
  courseName: string;
  topics: Array<{
    id: string;
    unitName: string;
    topicName: string;
    outcomeName: string;
    sequence: number;
  }>;
};

function TeacherCurriculumProgressView({ token, onBack }: { token: string; onBack: () => void }) {
  const [courses, setCourses] = React.useState<CurriculumProgressCourse[]>([]);
  const [records, setRecords] = React.useState<any[]>([]);
  const [courseName, setCourseName] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [completionDate, setCompletionDate] = React.useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [busy, setBusy] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const payload = await requestJson<{ courses?: CurriculumProgressCourse[]; records?: any[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/curriculum-progress`,
      );
      const nextCourses = Array.isArray(payload?.courses) ? payload.courses : [];
      setCourses(nextCourses);
      setRecords(Array.isArray(payload?.records) ? payload.records : []);
      if (!courseName && nextCourses[0]) setCourseName(nextCourses[0].courseName);
    } catch (reason: any) {
      setMessage(reason?.message || "Müfredat bilgisi alınamadı.");
    } finally {
      setBusy(false);
    }
  }, [token, courseName]);

  React.useEffect(() => { void load(); }, [token]);

  const selectedCourse = courses.find((item) => item.courseName === courseName) || courses[0] || null;
  const selectedTopic = selectedCourse?.topics.find((item) => item.id === topicId) || null;

  React.useEffect(() => {
    if (!selectedCourse?.topics?.length) {
      setTopicId("");
      return;
    }
    if (!selectedCourse.topics.some((item) => item.id === topicId)) {
      setTopicId(selectedCourse.topics[0].id);
    }
  }, [selectedCourse?.courseName, selectedCourse?.topics?.length]);

  const save = async () => {
    if (!selectedCourse || !selectedTopic || !completionDate) {
      setMessage("Lütfen biten konuyu ve bitiş tarihini seçin.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await requestJson(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/curriculum-progress`,
        {
          method: "POST",
          body: JSON.stringify({
            courseName: selectedCourse.courseName,
            topicId: selectedTopic.id,
            unitName: selectedTopic.unitName,
            topicName: selectedTopic.topicName,
            outcomeName: selectedTopic.outcomeName,
            sequence: selectedTopic.sequence,
            completionDate,
          }),
        },
      );
      setMessage(`${selectedTopic.topicName} bitiş tarihi kaydedildi.`);
      await load();
    } catch (reason: any) {
      setMessage(reason?.message || "Konu bitiş tarihi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-slate-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-violet-100 bg-white shadow-xl">
        <MobileSubHeader
          title="Müfredat Bilgisi"
          subtitle="Yalnız biten konu ve bitiş tarihi"
          onBack={onBack}
          accent="indigo"
        />
        <div className="space-y-3 p-3">
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-[10px] font-semibold leading-5 text-violet-900">
            Bir konu tamamen bittiğinde seçip bitiş tarihini kaydedin. Öğrenci çalışma planı, bu kayıttan önceki iki konuyu tekrar programına otomatik ekler.
          </div>

          {busy ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-black text-slate-500">
              Müfredat yükleniyor...
            </div>
          ) : courses.length ? (
            <>
              {courses.length > 1 ? (
                <select
                  value={selectedCourse?.courseName || ""}
                  onChange={(event) => setCourseName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.courseName}>{course.courseName}</option>
                  ))}
                </select>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Biten Konu</span>
                <select
                  value={topicId}
                  onChange={(event) => setTopicId(event.target.value)}
                  className="w-full rounded-2xl border border-violet-200 bg-white px-3 py-3 text-xs font-black text-slate-800"
                >
                  {(selectedCourse?.topics || []).map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.unitName ? `${topic.unitName} · ` : ""}{topic.topicName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Bitiş Tarihi</span>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(event) => setCompletionDate(event.target.value)}
                  className="w-full rounded-2xl border border-violet-200 bg-white px-3 py-3 text-xs font-black text-slate-800"
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Konu Bitti · Tarihi Kaydet"}
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500">
              Müfredatı yüklenmiş ders bulunamadı. Yönetici Müfredat Yönetimi ekranını bir kez açtığında mevcut müfredatlar otomatik eşitlenir.
            </div>
          )}

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-700">
              {message}
            </div>
          ) : null}

          {records.length ? (
            <div className="space-y-1.5">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Son Kaydedilenler</div>
              {records.slice(0, 8).map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-black text-slate-900">{record.courseName} · {record.topicName}</div>
                  <div className="mt-0.5 text-[8px] font-bold text-slate-400">{record.completionDate}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function AdminStudyPlanOperationsView({
  token,
  onBack,
  onGenerated,
}: {
  token: string;
  onBack: () => void;
  onGenerated?: () => void;
}) {
  const [status, setStatus] = React.useState<any>(null);
  const [examId, setExamId] = React.useState("");
  const [busy, setBusy] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const [statusPayload, examsPayload] = await Promise.all([
        requestJson<any>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/study-plan-status`,
        ),
        requestJson<{ exams?: AdminExamListRow[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/exams`,
        ),
      ]);
      const exams = Array.isArray(examsPayload?.exams) ? examsPayload.exams : [];
      setStatus({ ...statusPayload, exams });
      setExamId((current) => current || statusPayload?.latestExam?.id || exams[0]?.id || "");
    } catch (reason: any) {
      setMessage(reason?.message || "Çalışma planı bilgileri alınamadı.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  React.useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    if (!examId || !status?.weekStart) return;
    setGenerating(true);
    setMessage("");
    try {
      const result = await requestJson<any>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/study-plans/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            examId,
            weekStart: status.weekStart,
          }),
        },
      );
      setMessage(`${result?.planCount || 0} öğrenci için 7 günlük çalışma planı hazırlandı.`);
      await load();
      onGenerated?.();
    } catch (reason: any) {
      setMessage(reason?.message || "Çalışma planları hazırlanamadı.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-emerald-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-xl">
        <MobileSubHeader
          title="Öğrenci Çalışma Planı İşlemleri"
          subtitle="Haftalık kişisel program üretimi"
          onBack={onBack}
          accent="indigo"
        />
        <div className="space-y-3 p-3">
          {busy ? (
            <div className="rounded-2xl bg-indigo-50 p-6 text-center text-xs font-black text-indigo-700">
              Bilgiler hazırlanıyor...
            </div>
          ) : (
            <>
              <div className={`rounded-2xl border p-3 ${
                status?.generated
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}>
                <div className="text-[9px] font-black uppercase tracking-wide">
                  {status?.weekStart} → {status?.weekEnd}
                </div>
                <div className="mt-1 text-xs font-black">
                  {status?.generated
                    ? "Bu haftanın çalışma planı hazır."
                    : "Bu haftanın çalışma planı henüz hazırlanmadı."}
                </div>
                {status?.run ? (
                  <div className="mt-1 text-[9px] font-bold text-slate-500">
                    {status.run.generatedBy} · {status.run.planCount} öğrenci
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-1 block text-[9px] font-black uppercase text-slate-500">
                  Kaynak Deneme
                </span>
                <select
                  value={examId}
                  onChange={(event) => setExamId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black"
                >
                  {(status?.exams || []).map((exam: AdminExamListRow) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.examName} · {adminExamDateLabel(exam.examDate)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-[9px] font-semibold leading-5 text-sky-900">
                Plan; seçilen denemedeki öğrenciye özel konu/kazanım eksiklerini, geçmişten devreden eksikleri, ertesi günün gerçek ders programını ve öğretmenin Müfredat Bilgisi ekranında bitirdiği konudan önceki iki konuyu birlikte kullanır.
              </div>

              <button
                type="button"
                disabled={generating || !examId}
                onClick={() => void generate()}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {generating ? "Planlar Hazırlanıyor..." : "7 Günlük Çalışma Planlarını Hazırla"}
              </button>
            </>
          )}

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-black text-slate-700">
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}


function AdminStaffRolesView({ token, onBack }: { token: string; onBack: () => void }) {
  const [items, setItems] = React.useState<AdminStaffProfileRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const [savingId, setSavingId] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<{ items?: AdminStaffProfileRow[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/staff-profiles`,
      );
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (reason: any) {
      setError(reason?.message || "Personel rolleri yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  React.useEffect(() => { void load(); }, [load]);

  const filtered = React.useMemo(() => {
    const clean = normalize(query);
    if (!clean) return items;
    return items.filter((item) =>
      normalize(`${item.teacherName} ${item.teacherId} ${item.branch || ""} ${item.position || ""}`).includes(clean),
    );
  }, [items, query]);

  const updateLocal = (teacherId: string, patch: Partial<AdminStaffProfileRow>) => {
    setItems((current) => current.map((item) => item.teacherId === teacherId ? { ...item, ...patch } : item));
    setMessage("");
  };

  const save = async (item: AdminStaffProfileRow) => {
    if (!item.teacherId) {
      setMessage(`${item.teacherName}: teacherId bulunamadığı için rol kaydedilemedi.`);
      return;
    }
    setSavingId(item.teacherId);
    setMessage("");
    try {
      await requestJson(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/staff-profiles/${encodeURIComponent(item.teacherId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            teacherName: item.teacherName,
            role: item.role,
            position: item.position || "",
          }),
        },
      );
      setMessage(`${item.teacherName} rolü kaydedildi.`);
      await load();
    } catch (reason: any) {
      setMessage(reason?.message || "Rol kaydedilemedi.");
    } finally {
      setSavingId("");
    }
  };

  const roleLabel = (role: AdminStaffRole) =>
    role === "ADMIN" ? "Yönetici" : role === "GUIDANCE" ? "Rehber Öğretmen" : "Öğretmen";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <MobileSubHeader
          title="Personel Rolleri"
          subtitle="e-Nstitü mobil ekran yetkileri"
          onBack={onBack}
          accent="indigo"
        />
        <div className="space-y-3 p-3">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-semibold leading-5 text-indigo-900">
            Ders ve branş bilgileri değişmez. Buradaki seçim yalnız e-Nstitü mobil ana ekranını belirler.
          </div>

          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Personel ara..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white"
            />
          </label>

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
              {message}
            </div>
          ) : null}

          {busy ? <div className="py-12 text-center text-sm font-bold text-slate-400">Personel rolleri yükleniyor...</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div> : null}

          {!busy && !error ? (
            <div className="space-y-2">
              {filtered.map((item) => (
                <section key={`${item.teacherId}-${item.teacherName}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-slate-950">{item.teacherName}</div>
                      <div className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                        {item.branch || "Branş bilgisi yok"}{item.teacherId ? ` · ${item.teacherId}` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black ${
                      item.role === "ADMIN"
                        ? "bg-violet-100 text-violet-700"
                        : item.role === "GUIDANCE"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-slate-100 text-slate-600"
                    }`}>
                      {roleLabel(item.role)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={item.role}
                      onChange={(event) => {
                        const role = event.target.value as AdminStaffRole;
                        const position =
                          role === "ADMIN"
                            ? (item.position === "Öğretmen" || !item.position ? "Müdür Yardımcısı" : item.position)
                            : role === "GUIDANCE"
                              ? "Rehber Öğretmen / PDR"
                              : (item.branch || "Öğretmen");
                        updateLocal(item.teacherId, { role, staffRole: role, position });
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800 outline-none"
                    >
                      <option value="TEACHER">Öğretmen</option>
                      <option value="GUIDANCE">Rehber Öğretmen</option>
                      <option value="ADMIN">Yönetici</option>
                    </select>
                    <button
                      type="button"
                      disabled={!item.teacherId || savingId === item.teacherId}
                      onClick={() => void save(item)}
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
                    >
                      {savingId === item.teacherId ? "..." : "Kaydet"}
                    </button>
                  </div>

                  <input
                    value={item.position || ""}
                    onChange={(event) => updateLocal(item.teacherId, { position: event.target.value })}
                    placeholder="Görev / unvan"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                  />
                </section>
              ))}

              {!filtered.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                  Personel bulunamadı.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}



type AdminExamListRow = {
  id: string;
  examName: string;
  examDate: string;
  examStatus?: string;
  questionCount?: number;
  subjectCount?: number;
  gradeLevels?: string[];
};

type AdminExamSubjectSummary = {
  subjectName: string;
  questionCount: number;
  participantCount: number;
  averageCorrect: number;
  averageWrong: number;
  averageEmpty: number;
  averageNet: number;
  classroomStats: Array<{
    classroom: string;
    participantCount: number;
    correct: number;
    wrong: number;
    empty: number;
    net: number;
    successPercentage: number;
    rank: number;
  }>;
  outcomeStats: Array<{
    outcomeName: string;
    questionNumbers: number[];
    successPercentage: number;
    historicalSuccessPercentage: number | null;
    historicalExamCount: number;
    historicalAnswerCount: number;
    changePercentagePoint: number | null;
    developmentStatus: "IMPROVED" | "NOT_IMPROVED" | "UNCHANGED" | "NO_HISTORY";
  }>;
  itemAnalysis: Array<{
    questionNumber: number;
    correctAnswer: string;
    totalResponses: number;
    answerCounts: Record<string, number>;
    answerPercentages: Record<string, number>;
  }>;
};

type AdminExamSummaryPayload = {
  exam: {
    id: string;
    examName: string;
    examDate: string;
    examStatus?: string;
  };
  subjects: AdminExamSubjectSummary[];
};

type AdminStudyPlanPayload = {
  planVersion: string;
  exam: { id: string; examName: string; examDate: string };
  plans: Array<{
    studentNumber: string; studentName: string; classroom: string;
    priorityWeaknesses: Array<{subjectName:string;topicName:string;outcomeName:string;score:number;carryOver:number;questionNumbers:number[]}>;
    days: Array<{
      date:string;dayName:string;tomorrowDate:string;tomorrowDay:string;remediationMinutes:number;preparationMinutes:number;isWeeklyReview:boolean;
      remediation:Array<{subjectName:string;outcomeName:string;topicName:string;minutes:number;questionNumbers:number[];carryOver:number;activity:string}>;
      preparation:Array<{subjectName:string;minutes:number;targetTopic:string;targetOutcome:string;previousTopics:Array<{topicName:string;outcomeName:string;plannedDate:string}>;activity:string}>;
    }>;
  }>;
};

const adminExamNumber = (value: unknown) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
};

const adminExamDateLabel = (value: string) => {
  if (!value) return "Tarih bilgisi yok";
  const parsed = new Date(
    String(value).length <= 10 ? `${value}T12:00:00` : String(value),
  );
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const adminExamTotalQuestionCount = (summary: AdminExamSummaryPayload | null) =>
  (summary?.subjects || []).reduce(
    (sum, subject) => sum + Math.max(0, Number(subject.questionCount || 0)),
    0,
  );

const adminExamItemPercentage = (value: unknown) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(number) ? number : 0);
};

function DevelopmentReportCards({ rows, busy, error }: { rows: any[]; busy: boolean; error: string }) {
  if (busy) return <div className="rounded-2xl bg-white p-5 text-center text-xs font-bold text-violet-700">Gelişim bilgileri hazırlanıyor...</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>;
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-5 text-center text-xs font-bold text-slate-500">Seçime uygun değerlendirilmiş deneme verisi bulunamadı.</div>;
  const ordered=[...rows].reverse();
  return <div className="space-y-2">{ordered.map((item:any,index:number)=>{const previous=index>0?ordered[index-1]:null; const delta=previous?Number(item.net)-Number(previous.net):null; return <div key={`${item.examId}-${index}`} className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs font-black text-slate-900">{item.examName}</strong><span className="text-[9px] font-bold text-slate-400">{adminExamDateLabel(item.examDate)}</span></div>{delta!==null?<span className={`rounded-lg px-2 py-1 text-[9px] font-black ${delta>0?"bg-emerald-50 text-emerald-700":delta<0?"bg-rose-50 text-rose-700":"bg-slate-100 text-slate-600"}`}>{delta>0?"↑ ":delta<0?"↓ ":""}{delta>0?"+":""}{adminExamNumber(delta)} net</span>:null}</div><div className="mt-2 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-violet-50 p-2"><span className="block text-[8px] font-black uppercase text-violet-500">Net</span><strong className="text-sm text-violet-900">{adminExamNumber(item.net)}</strong></div><div className="rounded-xl bg-cyan-50 p-2"><span className="block text-[8px] font-black uppercase text-cyan-600">Başarı</span><strong className="text-sm text-cyan-900">{item.success==null?"—":`%${adminExamItemPercentage(item.success)}`}</strong></div><div className="rounded-xl bg-amber-50 p-2"><span className="block text-[8px] font-black uppercase text-amber-600">Sıra</span><strong className="text-sm text-amber-900">{item.rank?item.rank:"—"}</strong></div></div></div>})}</div>;
}

function AdminExamOperationsView({ token, onBack }: { token: string; onBack: () => void }) {
  const [tab, setTab] = React.useState<"exams" | "development">("exams");
  const [rows, setRows] = React.useState<AdminExamListRow[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState("");
  const [summary, setSummary] = React.useState<AdminExamSummaryPayload | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [summaryBusy, setSummaryBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [summaryError, setSummaryError] = React.useState("");
  const [studyPlans, setStudyPlans] = React.useState<AdminStudyPlanPayload | null>(null);
  const [selectedStudyStudent, setSelectedStudyStudent] = React.useState("");
  const [examPageIndex, setExamPageIndex] = React.useState(0);
  const examSwipeStartX = React.useRef<number | null>(null);
  const [gradeLevel, setGradeLevel] = React.useState("12");
  const [examSummaries, setExamSummaries] = React.useState<Record<string, AdminExamSummaryPayload>>({});
  const [developmentSubject, setDevelopmentSubject] = React.useState("Tüm Dersler");
  const [developmentStudent, setDevelopmentStudent] = React.useState("");
  const [developmentRange, setDevelopmentRange] = React.useState<"3" | "5" | "7">("3");
  const [developmentPage, setDevelopmentPage] = React.useState<0 | 1>(0);
  const [studentSearch, setStudentSearch] = React.useState("");
  const developmentSwipeStartX = React.useRef<number | null>(null);
  const [portalLinks, setPortalLinks] = React.useState<any[]>([]);
  const [examCatalog, setExamCatalog] = React.useState<any[]>([]);
  const [studentDevelopment, setStudentDevelopment] = React.useState<any[]>([]);
  const [developmentBusy, setDevelopmentBusy] = React.useState(false);
  const [developmentError, setDevelopmentError] = React.useState("");

  const loadExamList = React.useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const payload = await requestJson<{ exams?: AdminExamListRow[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/exams`,
      );
      setRows(Array.isArray(payload?.exams) ? payload.exams : []);
    } catch (reason: any) {
      setError(reason?.message || "Deneme sınavları alınamadı.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadExamList();
  }, [loadExamList]);

  React.useEffect(() => {
    if (!rows.length) return;
    let alive = true;
    const missing = rows.filter((exam) => !examSummaries[exam.id]);
    if (!missing.length) return;
    Promise.all(missing.map(async (exam) => {
      try {
        const value = await requestJson<AdminExamSummaryPayload>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/exams/${encodeURIComponent(exam.id)}/summary`,
          undefined,
          45000,
        );
        return [exam.id, value] as const;
      } catch { return null; }
    })).then((items) => {
      if (!alive) return;
      setExamSummaries((current) => {
        const next = { ...current };
        items.forEach((item) => { if (item) next[item[0]] = item[1]; });
        return next;
      });
    });
    return () => { alive = false; };
  }, [rows, token]);

  React.useEffect(() => {
    if (tab !== "development") return;
    let alive = true;
    Promise.all([
      fetch("/api/database/collections/publicPortalLinks", { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() : []),
      fetch("/api/database/collections/exams", { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() : []),
    ])
      .then(([portalPayload, examPayload]) => {
        if (!alive) return;
        const links = Array.isArray(portalPayload) ? portalPayload : Array.isArray(portalPayload?.items) ? portalPayload.items : [];
        const exams = Array.isArray(examPayload) ? examPayload : Array.isArray(examPayload?.items) ? examPayload.items : [];
        setPortalLinks(links.filter((item: any) => String(item?.kind || "") === "student" && !item?.revokedAt && item?.recoverableToken));
        setExamCatalog(exams);
      })
      .catch(() => { if (alive) { setPortalLinks([]); setExamCatalog([]); } });
    return () => { alive = false; };
  }, [tab]);

  const gradeOfClassroom = (value: unknown) => {
    const match = String(value || "").trim().match(/^(9|10|11|12)(?:\D|$)/);
    return match?.[1] || "";
  };

  const examGradeLevels = (examId: string) => {
    const summaryValue = examSummaries[examId];
    return Array.from(new Set((summaryValue?.subjects || []).flatMap((subject) =>
      (subject.classroomStats || []).map((row) => gradeOfClassroom(row.classroom)).filter(Boolean),
    )));
  };

  const filteredExamRows = rows.filter((exam) => {
    const levels = examGradeLevels(exam.id);
    return !gradeLevel || !levels.length || levels.includes(gradeLevel);
  });

  const gradeStudents = React.useMemo(() => {
    const map = new Map<string, any>();
    portalLinks.forEach((item: any) => {
      if (gradeOfClassroom(item?.classroom) !== gradeLevel) return;
      const key = String(item?.studentNumber || item?.studentId || item?.studentName || "");
      if (key && !map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) => String(a.studentName || "").localeCompare(String(b.studentName || ""), "tr-TR"));
  }, [portalLinks, gradeLevel]);

  const catalogSubjectNames = React.useMemo(() => {
    const names = new Set<string>();
    const allowedExamIds = new Set(filteredExamRows.map((exam) => String(exam.id)));
    examCatalog.forEach((exam: any) => {
      const examId = String(exam?.id || "").trim();
      if (examId && allowedExamIds.size && !allowedExamIds.has(examId)) return;
      const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
      structure.forEach((test: any) => {
        (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
          const name = String(subject?.name || subject?.subjectName || "").trim();
          if (name) names.add(name);
        });
      });
      const questions = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
      Object.keys(questions).forEach((name) => { if (String(name).trim()) names.add(String(name).trim()); });
    });
    return [...names];
  }, [examCatalog, filteredExamRows]);

  const developmentSubjectOrder = React.useMemo(() => [
    "Türkçe",
    "Türk Dili ve Edebiyatı",
    "Tarih",
    "Coğrafya",
    "Felsefe",
    "Din Kültürü ve Ahlak Bilgisi",
    "Matematik",
    "Fizik",
    "Kimya",
    "Biyoloji",
    "Tüm Dersler",
  ], []);

  const sortDevelopmentSubjects = React.useCallback((subjects: string[]) => {
    const normalizedOrder = developmentSubjectOrder.map((name) => name.toLocaleLowerCase("tr-TR"));
    return [...subjects].sort((a, b) => {
      const ai = normalizedOrder.indexOf(String(a).trim().toLocaleLowerCase("tr-TR"));
      const bi = normalizedOrder.indexOf(String(b).trim().toLocaleLowerCase("tr-TR"));
      const ar = ai >= 0 ? ai : normalizedOrder.length - 1;
      const br = bi >= 0 ? bi : normalizedOrder.length - 1;
      if (ar !== br) return ar - br;
      return a.localeCompare(b, "tr-TR");
    });
  }, [developmentSubjectOrder]);

  const classDevelopmentSubjects = React.useMemo(() => {
    const values = new Set<string>();
    rows.forEach((exam) => {
      const levels = examGradeLevels(exam.id);
      if (levels.length && !levels.includes(gradeLevel)) return;
      (examSummaries[exam.id]?.subjects || []).forEach((subject) => {
        const name = String(subject?.subjectName || "").trim();
        if (name) values.add(name);
      });
    });
    catalogSubjectNames.forEach((name) => values.add(name));
    return sortDevelopmentSubjects([...values, "Tüm Dersler"]);
  }, [rows, examSummaries, gradeLevel, examCatalog, catalogSubjectNames, sortDevelopmentSubjects]);

  const studentDevelopmentSubjects = React.useMemo(() => {
    const values = new Set<string>();
    studentDevelopment.forEach((exam: any) => {
      (Array.isArray(exam?.subjects) ? exam.subjects : []).forEach((subject: any) => {
        const name = String(subject?.subjectName || subject?.name || "").trim();
        if (name) values.add(name);
      });
    });
    return sortDevelopmentSubjects([...values, "Tüm Dersler"]);
  }, [studentDevelopment, sortDevelopmentSubjects]);

  React.useEffect(() => {
    setDevelopmentSubject("Tüm Dersler");
    setDevelopmentStudent("");
    setStudentSearch("");
    setStudentDevelopment([]);
  }, [gradeLevel]);

  React.useEffect(() => {
    const options = developmentPage === 1 && developmentStudent ? studentDevelopmentSubjects : classDevelopmentSubjects;
    if (!options.includes(developmentSubject)) setDevelopmentSubject("Tüm Dersler");
  }, [developmentPage, developmentStudent, classDevelopmentSubjects, studentDevelopmentSubjects, developmentSubject]);

  React.useEffect(() => {
    if (!developmentStudent) { setStudentDevelopment([]); setDevelopmentError(""); return; }
    const link = gradeStudents.find((item: any) => String(item.studentNumber || item.studentId || item.studentName) === developmentStudent);
    if (!link?.recoverableToken) return;
    let alive = true;
    setDevelopmentBusy(true);
    setDevelopmentError("");
    requestJson<{ exams?: any[] }>(`/api/public-portal/${encodeURIComponent(String(link.recoverableToken))}/exam-results`, undefined, 60000)
      .then((payload) => { if (alive) setStudentDevelopment(Array.isArray(payload?.exams) ? payload.exams : []); })
      .catch((reason: any) => { if (alive) setDevelopmentError(reason?.message || "Öğrenci gelişim bilgisi alınamadı."); })
      .finally(() => { if (alive) setDevelopmentBusy(false); });
    return () => { alive = false; };
  }, [developmentStudent, gradeStudents]);

  const rangeLimit = Number(developmentRange);
  const developmentRows = React.useMemo(() => {
    const studentMode = developmentPage === 1 && Boolean(developmentStudent);
    if (studentMode) {
      return studentDevelopment.slice(0, rangeLimit).map((exam: any) => {
        if (developmentSubject === "Tüm Dersler") {
          const subjects = Array.isArray(exam?.subjects) ? exam.subjects : [];
          if (!subjects.length) return null;
          const net = subjects.reduce((sum: number, item: any) => sum + Number(item?.net || 0), 0) / subjects.length;
          const successValues = subjects.map((item: any) => Number(item?.studentSuccess ?? item?.successPercentage ?? 0)).filter((value: number) => Number.isFinite(value));
          const success = successValues.length ? successValues.reduce((sum: number, value: number) => sum + value, 0) / successValues.length : null;
          return { examId: exam.id, examName: exam.examName, examDate: exam.examDate, net, success, rank: Number(exam?.overall?.schoolRank || 0) };
        }
        const subject = (exam?.subjects || []).find((item: any) => item.subjectName === developmentSubject);
        if (!subject) return null;
        return { examId: exam.id, examName: exam.examName, examDate: exam.examDate, net: Number(subject.net || 0), success: Number(subject.studentSuccess || 0), rank: Number(subject.schoolRank || 0) };
      }).filter(Boolean) as any[];
    }
    return rows.filter((exam) => {
      const levels = examGradeLevels(exam.id);
      return !levels.length || levels.includes(gradeLevel);
    }).slice(0, rangeLimit).map((exam) => {
      const summaryValue = examSummaries[exam.id];
      if (!summaryValue) return null;
      const subjects = developmentSubject === "Tüm Dersler" ? summaryValue.subjects : summaryValue.subjects.filter((item) => item.subjectName === developmentSubject);
      if (!subjects.length) return null;
      const classRows = subjects.flatMap((subject) => subject.classroomStats.filter((row) => gradeOfClassroom(row.classroom) === gradeLevel));
      if (!classRows.length) return null;
      const net = classRows.reduce((sum, row) => sum + Number(row.net || 0), 0) / classRows.length;
      const success = classRows.reduce((sum, row) => sum + Number(row.successPercentage || 0), 0) / classRows.length;
      return { examId: exam.id, examName: exam.examName, examDate: exam.examDate, net, success, rank: 0 };
    }).filter(Boolean) as any[];
  }, [developmentPage, developmentStudent, studentDevelopment, developmentSubject, developmentRange, rows, examSummaries, gradeLevel]);

  const openExam = async (examId: string) => {
    setSelectedExamId(examId);
    setSummary(null);
    setStudyPlans(null);
    setSelectedStudyStudent("");
    setSummaryError("");
    setSummaryBusy(true);
    setExamPageIndex(0);

    try {
      const payload = await requestJson<AdminExamSummaryPayload>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/exams/${encodeURIComponent(examId)}/summary`,
        undefined,
        45000,
      );
      setSummary(payload);

      // Çalışma planı, deneme analiz ekranını bloklamadan arka planda gelir.
      void requestJson<AdminStudyPlanPayload>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/exams/${encodeURIComponent(examId)}/personal-study-plans`,
        undefined,
        60000,
      )
        .then((studyPayload) => {
          setStudyPlans(studyPayload);
          const firstStudy = studyPayload?.plans?.[0];
          setSelectedStudyStudent(
            firstStudy
              ? `${firstStudy.studentNumber}::${firstStudy.studentName}::${firstStudy.classroom}`
              : "",
          );
        })
        .catch((reason) => {
          console.warn("[Admin Exam Study Plan Background]", reason);
          setStudyPlans(null);
        });
    } catch (reason: any) {
      setSummaryError(reason?.message || "Sınav özeti alınamadı.");
    } finally {
      setSummaryBusy(false);
    }
  };

  const closeExam = () => {
    setSelectedExamId("");
    setSummary(null);
    setSummaryError("");
    setExamPageIndex(0);
  };

  const examPageCount = summary ? 3 + summary.subjects.length : 1;
  const moveExamPage = (delta: number) => {
    setExamPageIndex((current) => Math.max(0, Math.min(examPageCount - 1, current + delta)));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-cyan-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <MobileSubHeader
          title="Sınav İşlemleri"
          subtitle="Deneme sınavları ve gelişim raporları"
          onBack={onBack}
          accent="teal"
        />

        <div className="space-y-4 p-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setTab("exams")}
              className={`min-h-[54px] rounded-xl px-2 py-2 text-[11px] font-black transition ${
                tab === "exams" ? "bg-cyan-600 text-white shadow-sm" : "bg-white text-slate-600"
              }`}
            >
              <BarChart3 className="mx-auto mb-1 h-4 w-4" />
              Deneme Sınavları
            </button>
            <button
              type="button"
              onClick={() => setTab("development")}
              className={`min-h-[54px] rounded-xl px-2 py-2 text-[11px] font-black transition ${
                tab === "development" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600"
              }`}
            >
              <Trophy className="mx-auto mb-1 h-4 w-4" />
              Gelişim Raporları
            </button>
          </div>

          {tab === "exams" ? (
            !selectedExamId ? (
              <section>
                <div className="mb-3 rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm">
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-500">Sınıf Seviyesi</label>
                  <div className="grid grid-cols-4 gap-2">
                    {["9", "10", "11", "12"].map((level) => (
                      <button key={level} type="button" onClick={() => setGradeLevel(level)} className={`rounded-xl border px-2 py-2.5 text-xs font-black ${gradeLevel === level ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{level}. Sınıf</button>
                    ))}
                  </div>
                </div>
                {busy ? (
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-6 text-center text-sm font-bold text-cyan-700">
                    Deneme listesi yükleniyor...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                    {error}
                  </div>
                ) : filteredExamRows.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                    Değerlendirilmiş deneme sınavı bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredExamRows.map((exam) => (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => void openExam(exam.id)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white p-3.5 text-left shadow-sm"
                      >
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-black text-slate-950">
                            {exam.examName}
                          </strong>
                          <span className="mt-1 block text-[10px] font-bold text-slate-500">
                            {adminExamDateLabel(exam.examDate)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-cyan-600" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="space-y-3">
                {summaryBusy ? (
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-6 text-center text-sm font-bold text-cyan-700">
                    Seçilen sınav hesaplanıyor...
                  </div>
                ) : summaryError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                    {summaryError}
                  </div>
                ) : summary ? (
                  <div
                    className="cursor-grab overflow-hidden touch-pan-y active:cursor-grabbing"
                    onTouchStart={(event) => {
                      examSwipeStartX.current = event.touches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                      if (examSwipeStartX.current == null) return;
                      const endX = event.changedTouches[0]?.clientX ?? examSwipeStartX.current;
                      const deltaX = endX - examSwipeStartX.current;
                      examSwipeStartX.current = null;
                      if (Math.abs(deltaX) < 45) return;
                      moveExamPage(deltaX < 0 ? 1 : -1);
                    }}
                    onPointerDown={(event) => {
                      if (event.pointerType !== "mouse" || event.button !== 0) return;
                      examSwipeStartX.current = event.clientX;
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    onPointerUp={(event) => {
                      if (event.pointerType !== "mouse" || examSwipeStartX.current == null) return;
                      const deltaX = event.clientX - examSwipeStartX.current;
                      examSwipeStartX.current = null;
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                      if (Math.abs(deltaX) < 45) return;
                      moveExamPage(deltaX < 0 ? 1 : -1);
                    }}
                    onPointerCancel={() => { examSwipeStartX.current = null; }}
                  >
                    <div
                      className="flex transition-transform duration-300 ease-out"
                      style={{ transform: `translateX(-${examPageIndex * 100}%)` }}
                    >
                    <div className="w-full shrink-0">
                      <div className="rounded-[26px] border border-slate-200 bg-gradient-to-b from-white via-cyan-50/30 to-white p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
                        <div className="mb-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-black text-cyan-950">
                                {summary.exam.examName}
                              </div>
                              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-700">
                                Genel Ders Başarı Özeti
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-cyan-700 shadow-sm">
                                {summary.subjects.length} ders
                              </div>
                              <div className="mt-1 text-[9px] font-black text-slate-500">
                                {adminExamTotalQuestionCount(summary)} soru
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="grid grid-cols-[minmax(100px,1.55fr)_42px_repeat(4,minmax(42px,0.7fr))] items-center bg-slate-800 px-2 py-2.5 text-center text-[9px] font-black text-white">
                            <div className="text-left">Ders</div>
                            <div>Soru</div>
                            <div>D</div>
                            <div>Y</div>
                            <div>B</div>
                            <div>Net</div>
                          </div>

                          {summary.subjects.map((subject, index) => (
                            <div
                              key={subject.subjectName}
                              className={`grid grid-cols-[minmax(100px,1.55fr)_42px_repeat(4,minmax(42px,0.7fr))] items-center px-2 py-2.5 text-center text-[10px] font-bold ${
                                index > 0 ? "border-t border-slate-100" : ""
                              }`}
                            >
                              <div className="min-w-0 truncate pr-2 text-left font-black text-slate-900">
                                {subject.subjectName}
                              </div>
                              <div className="font-black text-slate-700">
                                {subject.questionCount}
                              </div>
                              <div className="text-emerald-700">
                                {adminExamNumber(subject.averageCorrect)}
                              </div>
                              <div className="text-rose-700">
                                {adminExamNumber(subject.averageWrong)}
                              </div>
                              <div className="text-slate-600">
                                {adminExamNumber(subject.averageEmpty)}
                              </div>
                              <div className="font-black text-indigo-700">
                                {adminExamNumber(subject.averageNet)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-center text-[8px] font-bold text-slate-400">
                          Ders ayrıntıları için sola kaydırın
                        </div>
                      </div>
                    </div>

                    {summary.subjects.map((subject) => (
                      <div
                        key={`subject-${subject.subjectName}`}
                        className="w-full shrink-0"
                      >
                        <div className="mb-3 rounded-2xl bg-cyan-600 px-3 py-3 text-white shadow-sm">
                          <div className="truncate text-[10px] font-bold text-cyan-100">
                            {summary.exam.examName}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 truncate text-sm font-black">
                              {subject.subjectName}
                            </div>
                            <span className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[9px] font-black text-white">
                              {subject.questionCount} soru
                            </span>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-cyan-200 bg-cyan-50/35 shadow-[0_4px_14px_rgba(8,145,178,0.08)]">
                          <div className="grid grid-cols-[58px_repeat(4,minmax(0,1fr))_54px_38px] bg-slate-800 px-1 py-2.5 text-center text-[8px] font-black text-white">
                            <div className="text-left">Şube</div>
                            <div>D</div>
                            <div>Y</div>
                            <div>B</div>
                            <div>Net</div>
                            <div>Başarı %</div>
                            <div>Sıra</div>
                          </div>

                          {subject.classroomStats.map((row) => (
                            <div
                              key={`${subject.subjectName}-${row.classroom}`}
                              className="grid grid-cols-[58px_repeat(4,minmax(0,1fr))_54px_38px] items-center border-t border-slate-100 px-1 py-3 text-center text-[9px] font-bold"
                            >
                              <div className="truncate text-left font-black text-slate-900">{row.classroom}</div>
                              <div className="text-emerald-700">{adminExamNumber(row.correct)}</div>
                              <div className="text-rose-700">{adminExamNumber(row.wrong)}</div>
                              <div className="text-slate-600">{adminExamNumber(row.empty)}</div>
                              <div className="font-black text-indigo-700">{adminExamNumber(row.net)}</div>
                              <div className="font-black text-cyan-700">{adminExamNumber(row.successPercentage)}</div>
                              <div className="font-black text-slate-900">{row.rank}.</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/45 p-2.5 shadow-[0_4px_14px_rgba(124,58,237,0.08)]">
                          <div className="mb-2 flex items-center justify-between rounded-xl bg-violet-100/80 px-2.5 py-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800">
                              2 · Kazanım Başarıları
                            </span>
                            <span className="text-[8px] font-bold text-slate-400">
                              {subject.outcomeStats?.length || 0} kazanım
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {(subject.outcomeStats || []).map((outcome, outcomeIndex) => (
                              <div
                                key={`${subject.subjectName}-outcome-${outcomeIndex}`}
                                className="rounded-xl border border-violet-100 bg-white px-2 py-1.5 shadow-[0_2px_7px_rgba(124,58,237,0.05)]"
                              >
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5">
                                  <div className="min-w-0">
                                    <div className="line-clamp-2 text-[9px] font-black leading-[12px] text-slate-800">
                                      {outcome.outcomeName}
                                    </div>
                                    <div className="mt-1 max-w-[120px] truncate text-[7px] font-bold text-slate-400">
                                      S: {(outcome.questionNumbers || []).join(", ")}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <div className="rounded-lg bg-slate-100 px-1.5 py-1 text-center">
                                      <div className="text-[6px] font-black uppercase text-slate-400">Geçmiş</div>
                                      <div className="text-[8px] font-black text-slate-700">
                                        {outcome.historicalSuccessPercentage === null
                                          ? "—"
                                          : adminExamItemPercentage(outcome.historicalSuccessPercentage)}
                                      </div>
                                    </div>

                                    <div
                                      className={`rounded-lg px-1.5 py-1 text-center ${
                                        outcome.successPercentage >= 75
                                          ? "bg-emerald-100 text-emerald-700"
                                          : outcome.successPercentage >= 50
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-rose-100 text-rose-700"
                                      }`}
                                    >
                                      <div className="text-[6px] font-black uppercase opacity-70">Son</div>
                                      <div className="text-[8px] font-black">
                                        {adminExamItemPercentage(outcome.successPercentage)}
                                      </div>
                                    </div>

                                    <div
                                      className={`min-w-[72px] rounded-lg px-1.5 py-1 text-center text-[7px] font-black ${
                                        outcome.developmentStatus === "IMPROVED"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : outcome.developmentStatus === "NOT_IMPROVED"
                                            ? "bg-rose-100 text-rose-700"
                                            : outcome.developmentStatus === "UNCHANGED"
                                              ? "bg-slate-100 text-slate-600"
                                              : "bg-violet-100 text-violet-600"
                                      }`}
                                    >
                                      {outcome.developmentStatus === "IMPROVED"
                                        ? `↑ İyileşme Var +${adminExamItemPercentage(outcome.changePercentagePoint)}`
                                        : outcome.developmentStatus === "NOT_IMPROVED"
                                          ? `↓ İyileşme Yok ${adminExamItemPercentage(outcome.changePercentagePoint)}`
                                          : outcome.developmentStatus === "UNCHANGED"
                                            ? "Değişim Yok"
                                            : "Geçmiş Veri Yok"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {!subject.outcomeStats?.length ? (
                              <div className="rounded-xl border border-dashed border-slate-200 px-2 py-1.5 text-center text-[9px] font-bold text-slate-400">
                                Kazanım bilgisi bulunamadı.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/45 p-2.5 shadow-[0_4px_14px_rgba(217,119,6,0.08)]">
                          <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-100/80 px-2.5 py-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
                              3 · Madde Analizi
                            </span>
                            <span className="text-[8px] font-bold text-amber-700">
                              {subject.itemAnalysis?.length || 0} soru
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(subject.itemAnalysis?.length
                              ? subject.itemAnalysis
                              : Array.from({ length: subject.questionCount }, (_, index) => ({
                                  questionNumber: index + 1,
                                  correctAnswer: "",
                                  totalResponses: subject.participantCount || 0,
                                  answerCounts: { A: 0, B: 0, C: 0, D: 0, E: 0 },
                                  answerPercentages: { A: 0, B: 0, C: 0, D: 0, E: 0 },
                                }))
                            ).map((item) => {
                              const correctChoice = String(item.correctAnswer || "").toLocaleUpperCase("tr-TR");
                              const correctCount = Number(item.answerCounts?.[correctChoice] || 0);
                              const totalResponses = Number(
                                item.totalResponses || subject.participantCount || 0,
                              );
                              const correctPercentage = Number(
                                item.answerPercentages?.[correctChoice] ??
                                (totalResponses > 0 ? (correctCount / totalResponses) * 100 : 0),
                              );
                              const isLowSuccess = totalResponses > 0 && correctPercentage < 50;

                              return (
                              <div
                                key={`${subject.subjectName}-item-${item.questionNumber}`}
                                className={`rounded-xl border px-2 py-2 shadow-[0_2px_7px_rgba(217,119,6,0.06)] ${
                                  isLowSuccess
                                    ? "border-rose-300 bg-rose-100/90"
                                    : "border-amber-200 bg-white"
                                }`}
                              >
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <div className="rounded-lg bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-900">
                                    {item.questionNumber}. Soru
                                  </div>
                                  <div className="text-[8px] font-bold text-slate-400">
                                    {item.totalResponses || subject.participantCount || 0} öğrenci
                                  </div>
                                </div>

                                <div className="grid grid-cols-5 gap-1">
                                  {["A", "B", "C", "D", "E"].map((choice) => {
                                    const isCorrect = item.correctAnswer === choice;
                                    const count = Number(item.answerCounts?.[choice] || 0);
                                    const percentage = Number(
                                      item.answerPercentages?.[choice] ??
                                      ((item.totalResponses || subject.participantCount || 0) > 0
                                        ? (count / Number(item.totalResponses || subject.participantCount || 1)) * 100
                                        : 0),
                                    );

                                    return (
                                      <div
                                        key={`${item.questionNumber}-${choice}`}
                                        className={`rounded-lg border px-1 py-1.5 text-center ${
                                          isCorrect
                                            ? "border-emerald-600 bg-emerald-500 text-white shadow-sm"
                                            : "border-slate-200 bg-slate-50 text-slate-700"
                                        }`}
                                      >
                                        <div className="text-[8px] font-black uppercase">
                                          {choice}
                                        </div>
                                        <div className="mt-0.5 text-[10px] font-black">
                                          {adminExamItemPercentage(percentage)}
                                        </div>
                                        <div className={`mt-0.5 text-[7px] font-bold ${isCorrect ? "text-emerald-50" : "text-slate-400"}`}>
                                          {count} öğr.
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>

                        {(() => {
                          const repeatOutcomes = [...(subject.outcomeStats || [])]
                            .filter((outcome) => Number(outcome.successPercentage || 0) < 50)
                            .sort(
                              (a, b) =>
                                Number(a.successPercentage || 0) - Number(b.successPercentage || 0),
                            );

                          const priorityQuestions = [...(subject.itemAnalysis || [])]
                            .map((item) => {
                              const correctChoice = String(item.correctAnswer || "").toLocaleUpperCase("tr-TR");
                              const totalResponses = Number(
                                item.totalResponses || subject.participantCount || 0,
                              );
                              const correctCount = Number(item.answerCounts?.[correctChoice] || 0);
                              const correctPercentage = Number(
                                item.answerPercentages?.[correctChoice] ??
                                (totalResponses > 0 ? (correctCount / totalResponses) * 100 : 0),
                              );
                              return {
                                questionNumber: item.questionNumber,
                                correctPercentage,
                              };
                            })
                            .filter((item) => item.correctPercentage < 50)
                            .sort(
                              (a, b) =>
                                a.correctPercentage - b.correctPercentage ||
                                a.questionNumber - b.questionNumber,
                            );

                          return (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/45 p-2.5 shadow-[0_4px_14px_rgba(5,150,105,0.08)]">
                              <div className="mb-2 flex items-center justify-between rounded-xl bg-emerald-100/80 px-2.5 py-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800">
                                  4 · Ders Öğretmenine Öneriler
                                </span>
                              </div>

                              <div className="grid gap-2">
                                <div className="rounded-xl border border-emerald-100 bg-white px-2.5 py-2">
                                  <div className="mb-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-700">
                                    Tekrar Edilecek Kazanımlar / Konular
                                  </div>

                                  {repeatOutcomes.length > 0 ? (
                                    <div className="space-y-1">
                                      {repeatOutcomes.map((outcome, index) => (
                                        <div
                                          key={`${subject.subjectName}-repeat-${index}`}
                                          className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50/70 px-2 py-1.5"
                                        >
                                          <div className="min-w-0 flex-1 text-[9px] font-bold leading-[12px] text-slate-700">
                                            {outcome.outcomeName}
                                          </div>
                                          <div className="shrink-0 text-[9px] font-black text-emerald-700">
                                            {adminExamItemPercentage(outcome.successPercentage)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[9px] font-bold text-slate-400">
                                      Öncelikli tekrar gerektiren kazanım bulunmadı.
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-rose-100 bg-white px-2.5 py-2">
                                  <div className="mb-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-rose-700">
                                    Öncelikli Çözümü Yapılacak Sorular
                                  </div>

                                  {priorityQuestions.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {priorityQuestions.map((item) => (
                                        <div
                                          key={`${subject.subjectName}-priority-${item.questionNumber}`}
                                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700"
                                        >
                                          {item.questionNumber}. Soru · {adminExamItemPercentage(item.correctPercentage)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[9px] font-bold text-slate-400">
                                      Öncelikli çözüm gerektiren soru bulunmadı.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                    <div className="w-full shrink-0">
                      {(() => {
                        const classroomNames = Array.from(
                          new Set(
                            (summary.subjects || []).flatMap((subject) =>
                              (subject.classroomStats || []).map((row) => row.classroom),
                            ),
                          ),
                        ).sort((a, b) =>
                          String(a || "").localeCompare(String(b || ""), "tr-TR", {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        );

                        return (
                          <div className="rounded-[26px] border border-slate-200 bg-gradient-to-b from-white via-sky-50/40 to-white p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
                            <div className="mb-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2.5">
                              <div className="truncate text-[12px] font-black text-sky-950">
                                {summary.exam.examName}
                              </div>
                              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-sky-700">
                                Derslere Göre Şube Başarı Sıraları
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <table className="w-full table-fixed border-collapse text-[8px]">
                                <colgroup>
                                  <col style={{ width: "31%" }} />
                                  {classroomNames.slice(0, 6).map((classroom) => (
                                    <col key={`matrix-col-${classroom}`} style={{ width: "11.5%" }} />
                                  ))}
                                </colgroup>

                                <thead>
                                  <tr className="bg-slate-800 text-white">
                                    <th className="border-r border-slate-700 px-1.5 py-2 text-left text-[8px] font-black">
                                      Ders
                                    </th>
                                    {classroomNames.slice(0, 6).map((classroom) => (
                                      <th
                                        key={`matrix-head-${classroom}`}
                                        className="border-r border-slate-700 px-0.5 py-2 text-center text-[7px] font-black leading-tight last:border-r-0"
                                      >
                                        <span className="block truncate">{classroom}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>

                                <tbody>
                                  {summary.subjects.map((subject, subjectIndex) => {
                                    const rankMap = new Map(
                                      (subject.classroomStats || []).map((row) => [
                                        row.classroom,
                                        row.rank,
                                      ]),
                                    );

                                    return (
                                      <tr
                                        key={`matrix-row-${subject.subjectName}`}
                                        className={subjectIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                      >
                                        <td className="border-r border-t border-slate-200 px-1.5 py-2 font-black text-slate-900">
                                          <div className="truncate text-[8px] leading-tight">
                                            {subject.subjectName}
                                          </div>
                                        </td>

                                        {classroomNames.slice(0, 6).map((classroom) => {
                                          const rank = rankMap.get(classroom);
                                          return (
                                            <td
                                              key={`${subject.subjectName}-${classroom}`}
                                              className="border-r border-t border-slate-200 px-0.5 py-2 text-center last:border-r-0"
                                            >
                                              {rank ? (
                                                <span
                                                  className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1 py-0.5 text-[8px] font-black ${
                                                    rank === 1
                                                      ? "bg-amber-400 text-amber-950"
                                                      : rank === 2
                                                        ? "bg-slate-200 text-slate-700"
                                                        : rank === 3
                                                          ? "bg-orange-100 text-orange-800"
                                                          : "bg-sky-50 text-sky-700"
                                                  }`}
                                                >
                                                  {rank}.
                                                </span>
                                              ) : (
                                                <span className="text-slate-300">—</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {classroomNames.length > 6 ? (
                              <div className="mt-2 rounded-xl bg-sky-50 px-2 py-1.5 text-center text-[8px] font-bold text-sky-700">
                                İlk 6 şube ekrana sığdırıldı.
                              </div>
                            ) : null}

                            <div className="mt-2 text-center text-[8px] font-bold text-slate-400">
                              Satırlar dersleri, sütunlar şubeleri gösterir.
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="w-full shrink-0">
                      <div className="rounded-[26px] border border-indigo-200 bg-gradient-to-b from-indigo-50 via-white to-violet-50 p-2.5">
                        <div className="mb-2 rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 px-3 py-2.5 text-white">
                          <div className="text-[11px] font-black">Kişisel Çalışma Planı</div>
                          <div className="mt-0.5 text-[8px] font-bold text-indigo-100">
                            7 gün · 60 dk deneme eksiği + 60–90 dk yarının dersleri
                          </div>
                        </div>
                        {studyPlans?.plans?.length ? (
                          <>
                            <select value={selectedStudyStudent} onChange={(e)=>setSelectedStudyStudent(e.target.value)}
                              className="mb-2 w-full rounded-xl border border-indigo-100 bg-white px-2 py-2 text-[9px] font-black">
                              {studyPlans.plans.map((p)=>{
                                const k=`${p.studentNumber}::${p.studentName}::${p.classroom}`;
                                return <option key={k} value={k}>{p.studentName} · {p.classroom}{p.studentNumber?` · ${p.studentNumber}`:""}</option>;
                              })}
                            </select>
                            {studyPlans.plans.filter((p)=>`${p.studentNumber}::${p.studentName}::${p.classroom}`===selectedStudyStudent).map((p)=>(
                              <div key={selectedStudyStudent} className="space-y-2">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                                  <div className="text-[7px] font-black uppercase text-amber-700">Öncelikli Eksikler</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {p.priorityWeaknesses.slice(0,5).map((w,i)=><span key={i} className="rounded-md bg-white px-1.5 py-1 text-[7px] font-bold">{w.subjectName} · {w.outcomeName}{w.carryOver?` · devreden ${w.carryOver}`:""}</span>)}
                                  </div>
                                </div>
                                {p.days.map((d)=>(
                                  <div key={d.date} className={`rounded-xl border p-2 ${d.isWeeklyReview?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-white"}`}>
                                    <div className="flex justify-between text-[8px] font-black"><span>{d.dayName}</span><span>{d.isWeeklyReview?"HAFTALIK KONTROL":d.date}</span></div>
                                    <div className="mt-1 rounded-lg bg-rose-50 p-1.5">
                                      <div className="text-[7px] font-black text-rose-700">60 dk · Deneme Kaynaklı Eksikler</div>
                                      {d.remediation.map((x,i)=><div key={i} className="mt-1 text-[7px]"><b>{x.subjectName} · {x.outcomeName}</b> — {x.minutes} dk<br/><span className="text-slate-500">{x.activity}{x.questionNumbers.length?` · Sorular: ${x.questionNumbers.join(", ")}`:""}</span></div>)}
                                    </div>
                                    <div className="mt-1 rounded-lg bg-sky-50 p-1.5">
                                      <div className="text-[7px] font-black text-sky-700">{d.preparationMinutes} dk · {d.tomorrowDay} Derslerine Hazırlık</div>
                                      {d.preparation.map((x,i)=><div key={i} className="mt-1 text-[7px]"><b>{x.subjectName}</b> — {x.minutes} dk{x.previousTopics.length?<><br/><span className="font-bold text-violet-700">Önce tekrar: {x.previousTopics.map(t=>t.topicName).join(" → ")}</span></>:null}<br/><span className="text-slate-500">{x.targetTopic?`Yarın: ${x.targetTopic}`:x.activity}</span></div>)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </>
                        ) : <div className="rounded-xl bg-white p-4 text-center text-[9px] font-bold text-slate-500">Bu sınav için öğrenci planı üretilemedi.</div>}
                      </div>
                    </div>
                    </div>
                  </div>
                ) : null}
              </section>
            )
          ) : (
            <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white">
              <div className="flex items-center justify-between border-b border-violet-100 bg-white/80 px-4 py-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">Gelişim Raporları</div>
                  <div className="mt-0.5 text-[9px] font-bold text-slate-400">{developmentPage === 0 ? "Sınıf gelişimi" : "Öğrenci gelişimi"}</div>
                </div>
                <div className="flex gap-1.5">
                  {[0,1].map((page)=><button key={page} type="button" onClick={()=>setDevelopmentPage(page as 0|1)} className={`h-2.5 rounded-full transition-all ${developmentPage===page ? "w-7 bg-violet-600" : "w-2.5 bg-violet-200"}`} aria-label={`${page+1}. sayfa`} />)}
                </div>
              </div>

              <div className="cursor-grab overflow-hidden touch-pan-y active:cursor-grabbing"
                onTouchStart={(event)=>{ developmentSwipeStartX.current=event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event)=>{ if(developmentSwipeStartX.current==null)return; const endX=event.changedTouches[0]?.clientX ?? developmentSwipeStartX.current; const dx=endX-developmentSwipeStartX.current; developmentSwipeStartX.current=null; if(Math.abs(dx)<45)return; setDevelopmentPage(dx<0?1:0); }}
                onPointerDown={(event)=>{ if(event.pointerType!=="mouse" || event.button!==0)return; developmentSwipeStartX.current=event.clientX; event.currentTarget.setPointerCapture?.(event.pointerId); }}
                onPointerUp={(event)=>{ if(event.pointerType!=="mouse" || developmentSwipeStartX.current==null)return; const dx=event.clientX-developmentSwipeStartX.current; developmentSwipeStartX.current=null; event.currentTarget.releasePointerCapture?.(event.pointerId); if(Math.abs(dx)<45)return; setDevelopmentPage(dx<0?1:0); }}
                onPointerCancel={()=>{ developmentSwipeStartX.current=null; }}>
                <div className="flex transition-transform duration-300 ease-out" style={{transform:`translateX(-${developmentPage*100}%)`}}>
                  <div className="w-full shrink-0 space-y-3 p-4">
                    <div className="rounded-2xl bg-violet-600 px-3 py-3 text-white">
                      <div className="text-xs font-black">Sınıf Gelişimi</div>
                      <div className="mt-0.5 text-[9px] font-bold text-violet-100">Sınıf seviyesi ve ders bazında son denemeleri karşılaştırın.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Sınıf</span><select value={gradeLevel} onChange={(e)=>setGradeLevel(e.target.value)} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-xs font-black">{["9","10","11","12"].map(level=><option key={level} value={level}>{level}. Sınıf</option>)}</select></label>
                      <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Ders</span><select value={developmentSubject} onChange={(e)=>setDevelopmentSubject(e.target.value)} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-xs font-black">{classDevelopmentSubjects.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></label>
                    </div>
                    <div><span className="mb-1.5 block text-[9px] font-black uppercase text-slate-500">Denemeler</span><div className="grid grid-cols-3 gap-1.5">{[["3","Son 3 Deneme"],["5","Son 5 Deneme"],["7","Son 7 Deneme"]].map(([value,label])=><button key={value} type="button" onClick={()=>setDevelopmentRange(value as any)} className={`rounded-xl border px-1 py-2.5 text-[9px] font-black ${developmentRange===value?"border-violet-600 bg-violet-600 text-white":"border-violet-100 bg-white text-slate-600"}`}>{label}</button>)}</div></div>
                    <DevelopmentReportCards rows={developmentRows} busy={developmentBusy} error={developmentError} />
                    <div className="text-center text-[9px] font-bold text-violet-500">Öğrenci gelişimi için sola kaydırın →</div>
                  </div>

                  <div className="w-full shrink-0 space-y-3 p-4">
                    <div className="rounded-2xl bg-indigo-600 px-3 py-3 text-white">
                      <div className="text-xs font-black">Öğrenci Gelişimi</div>
                      <div className="mt-0.5 text-[9px] font-bold text-indigo-100">Numara, ad veya soyad ile öğrenciyi bulun ve gelişimini izleyin.</div>
                    </div>
                    <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Sınıf</span><select value={gradeLevel} onChange={(e)=>setGradeLevel(e.target.value)} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-black">{["9","10","11","12"].map(level=><option key={level} value={level}>{level}. Sınıf</option>)}</select></label>
                    <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Öğrenci Ara</span><input value={studentSearch} onChange={(e)=>{ setStudentSearch(e.target.value); if (developmentStudent) { setDevelopmentStudent(""); setStudentDevelopment([]); setDevelopmentSubject("Tüm Dersler"); } }} placeholder="Öğrenci no, ad veya soyad..." className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500" /></label>
                    {!developmentStudent && studentSearch.trim().length >= 2 ? (
                      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-2xl border border-indigo-100 bg-white p-2">
                        {gradeStudents.filter((student:any)=>{const q=studentSearch.trim().toLocaleLowerCase("tr-TR"); return `${student.studentNumber||""} ${student.studentName||""}`.toLocaleLowerCase("tr-TR").includes(q);}).slice(0,12).map((student:any)=>{const key=String(student.studentNumber||student.studentId||student.studentName); return <button key={key} type="button" onClick={()=>{setDevelopmentStudent(key); setStudentSearch(`${student.studentNumber?`${student.studentNumber} · `:""}${student.studentName||""}`); setDevelopmentSubject("Tüm Dersler");}} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50"><span className="min-w-0"><strong className="block truncate text-[10px] font-black text-slate-900">{student.studentName}</strong><span className="text-[8px] font-bold text-slate-400">{student.studentNumber?`${student.studentNumber} · `:""}{student.classroom}</span></span><span className="text-[9px] font-black text-indigo-600">SEÇ</span></button>})}
                        {!gradeStudents.some((student:any)=>{const q=studentSearch.trim().toLocaleLowerCase("tr-TR"); return `${student.studentNumber||""} ${student.studentName||""}`.toLocaleLowerCase("tr-TR").includes(q);}) ? <div className="p-3 text-center text-[9px] font-bold text-slate-400">Öğrenci bulunamadı.</div> : null}
                      </div>
                    ) : null}
                    {developmentStudent ? <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2"><div className="text-[9px] font-black text-indigo-800">Seçili öğrenci</div><button type="button" onClick={()=>{setDevelopmentStudent("");setStudentSearch("");setStudentDevelopment([]);setDevelopmentSubject("Tüm Dersler");}} className="rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-black text-indigo-700 shadow-sm">Değiştir</button></div> : studentSearch.trim().length < 2 ? <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 text-center text-[9px] font-bold text-indigo-600">Aramaya başlamak için en az 2 karakter yazın.</div> : null}
                    {developmentStudent ? <>
                      <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Ders</span><select value={developmentSubject} onChange={(e)=>setDevelopmentSubject(e.target.value)} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-black">{studentDevelopmentSubjects.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></label>
                      <div><span className="mb-1.5 block text-[9px] font-black uppercase text-slate-500">Denemeler</span><div className="grid grid-cols-3 gap-1.5">{[["3","Son 3 Deneme"],["5","Son 5 Deneme"],["7","Son 7 Deneme"]].map(([value,label])=><button key={value} type="button" onClick={()=>setDevelopmentRange(value as any)} className={`rounded-xl border px-1 py-2.5 text-[9px] font-black ${developmentRange===value?"border-indigo-600 bg-indigo-600 text-white":"border-indigo-100 bg-white text-slate-600"}`}>{label}</button>)}</div></div>
                      <DevelopmentReportCards rows={developmentRows} busy={developmentBusy} error={developmentError} />
                    </> : <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-center text-[10px] font-bold text-indigo-700">Gelişim raporunu görmek için bir öğrenci seçin.</div>}
                    <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-[9px] font-semibold leading-4 text-indigo-900"><b>Tüm Dersler</b>, öğrencinin o denemede girdiği derslerin net ve başarı ortalamasını gösterir. Bir ders seçildiğinde yalnızca o dersin gelişimi gösterilir.</div>
                    <div className="text-center text-[9px] font-bold text-indigo-400">← Sınıf gelişimine dönmek için sağa kaydırın</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="text-center text-[9px] font-black tracking-wide text-slate-300">
            SINAV MERKEZİ v56
          </div>
        </div>
      </div>
    </main>
  );
}


function AdminDutyView({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    requestJson<any>(`/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/duty`)
      .then((value) => { if (alive) { setData(value); setError(""); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Nöbet listesi yüklenemedi."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [token]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const grouped = items.reduce((map: Map<string, any[]>, item: any) => {
    const key = String(item.location || "Görev Yeri Belirtilmemiş");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
    return map;
  }, new Map<string, any[]>());

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-amber-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <MobileSubHeader title="Nöbet" subtitle="Günün nöbetçi öğretmenleri" onBack={onBack} accent="amber" />
        <div className="space-y-3 p-3">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-[9px] font-black uppercase tracking-wider text-amber-700">Bugün</div>
            <div className="text-sm font-black text-slate-900">{data?.now?.day || "-"} · {data?.now?.date || "-"}</div>
          </div>
          {busy ? <div className="py-12 text-center text-sm font-bold text-slate-400">Nöbet listesi yükleniyor...</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div> : null}
          {!busy && !error && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Bugün için nöbetçi öğretmen kaydı bulunamadı.</div> : null}
          {!busy && !error ? [...grouped.entries()].map(([location, teachers]) => (
            <section key={location} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-800 px-4 py-2.5 text-sm font-black text-white">{location}</div>
              <div className="divide-y divide-slate-100">
                {teachers.map((item: any) => <div key={item.id} className="px-4 py-3 text-sm font-normal text-slate-800">{item.teacherName}</div>)}
              </div>
            </section>
          )) : null}
        </div>
      </div>
    </main>
  );
}

const messageFileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      if (comma < 0) return reject(new Error("Dosya okunamadı."));
      resolve(value.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });

const isSupportedMessageFile = (file: File) => {
  const extension = String(file.name || "").toLocaleLowerCase("tr-TR").split(".").pop() || "";
  return ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "webp", "gif", "bmp", "heic", "heif"].includes(extension) ||
    String(file.type || "").toLowerCase().startsWith("image/");
};

export default function TeacherBehaviorLinkView() {
  const pathToken = decodeURIComponent(
    window.location.pathname.match(/^\/t\/([^/]+)\/?$/)?.[1] || "",
  );
  const token =
    pathToken || new URLSearchParams(window.location.search).get("token") || "";

  const cachedStartupLink = React.useRef<TeacherBehaviorLinkDocument | null>(readTeacherLinkCache(token));
  const [link, setLink] = React.useState<TeacherBehaviorLinkDocument | null>(() => cachedStartupLink.current);
  const [serverStaffProfile, setServerStaffProfile] = React.useState<{
    role?: string;
    staffRole?: string;
    position?: string;
    staffProfileVersion?: string;
  } | null>(null);
  const adminPhoneSplashSessionKey = `enstitu:pwa:splash-shown:${token}`;
  const [adminPhoneSplashVisible, setAdminPhoneSplashVisible] = React.useState(() => {
    if (!isStandaloneTeacherApp() || !cachedStartupLink.current) return false;
    try {
      return sessionStorage.getItem(adminPhoneSplashSessionKey) !== "1";
    } catch {
      return true;
    }
  });
  const adminPhoneSplashStartedRef = React.useRef(false);
  const adminPhoneSplashTimerRef = React.useRef<number | null>(null);
  const [error, setError] = React.useState("");
  const [screen, setScreen] = React.useState<Screen>("home");
  const [staffExamAnnouncements, setStaffExamAnnouncements] = React.useState<StaffExamAnnouncement[]>([]);
  const [staffExamAnnouncementsLoading, setStaffExamAnnouncementsLoading] = React.useState(false);
  const [staffExamAnnouncementsError, setStaffExamAnnouncementsError] = React.useState("");
  const [staffGeneralAnnouncements, setStaffGeneralAnnouncements] = React.useState<StaffMobileFeedItem[]>([]);
  const [staffNewsItems, setStaffNewsItems] = React.useState<StaffMobileFeedItem[]>([]);
  const [staffAnnouncementTab, setStaffAnnouncementTab] = React.useState<"announcements" | "news">("announcements");
  const [selectedStaffFeedId, setSelectedStaffFeedId] = React.useState("");
  const staffAnnouncementSwipeStartX = React.useRef<number | null>(null);
  const staffAnnouncementDismissStorageKey = `enstitu:staff-dismissed-announcements:${token}`;
  const [staffDismissedAnnouncementIds, setStaffDismissedAnnouncementIds] = React.useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`enstitu:staff-dismissed-announcements:${token}`) || "[]");
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "")).filter(Boolean) : [];
    } catch { return []; }
  });
  const [staffAnnouncementMenuItem, setStaffAnnouncementMenuItem] = React.useState<StaffMobileFeedItem | null>(null);
  const staffAnnouncementLongPressTimer = React.useRef<number | null>(null);
  const staffAnnouncementLongPressTriggered = React.useRef(false);
  const portalHistoryMarker = React.useMemo(() => `enstitu-staff-portal:${token}`, [token]);

  const goToScreen = React.useCallback((next: Screen) => {
    if (screen === next) return;
    try {
      const currentState = window.history.state || {};
      const currentDepth = currentState?.enstituPortalMarker === portalHistoryMarker
        ? Number(currentState.enstituPortalDepth || 0)
        : 0;
      window.history.pushState(
        {
          ...currentState,
          enstituPortalMarker: portalHistoryMarker,
          enstituPortalScreen: next,
          enstituPortalDepth: currentDepth + 1,
        },
        "",
        window.location.href,
      );
    } catch {}
    setScreen(next);
  }, [portalHistoryMarker, screen]);

  const goBackScreen = React.useCallback(() => {
    try {
      const currentState = window.history.state || {};
      const depth = currentState?.enstituPortalMarker === portalHistoryMarker
        ? Number(currentState.enstituPortalDepth || 0)
        : 0;
      if (depth > 0) {
        window.history.back();
        return;
      }
      window.history.replaceState(
        {
          ...currentState,
          enstituPortalMarker: portalHistoryMarker,
          enstituPortalScreen: "home",
          enstituPortalDepth: 0,
        },
        "",
        window.location.href,
      );
    } catch {}
    setScreen("home");
  }, [portalHistoryMarker]);


  const loadStaffExamAnnouncements = React.useCallback(async () => {
    if (!link && !serverStaffProfile) return;
    setStaffExamAnnouncementsLoading(true);
    setStaffExamAnnouncementsError("");
    try {
      const safeCollection = async (collectionName: string) => {
        try {
          const response = await fetch(`/api/database/collections/${collectionName}`, { cache: "no-store" });
          if (!response.ok) return [] as any[];
          const rows = await response.json().catch(() => []);
          return Array.isArray(rows) ? rows : [];
        } catch {
          return [] as any[];
        }
      };
      const mobileSchoolId = String((link as any)?.schoolId || (serverStaffProfile as any)?.schoolId || "school-main").trim() || "school-main";
      const safePublishedNews = async () => {
        try {
          const response = await fetch(`/api/mobile/news/published?schoolId=${encodeURIComponent(mobileSchoolId)}`, { cache: "no-store" });
          if (!response.ok) return [] as any[];
          const payload = await response.json().catch(() => ({}));
          return Array.isArray(payload?.items) ? payload.items : [];
        } catch { return [] as any[]; }
      };
      const [examRows, generalRows, latestNewsRows] = await Promise.all([
        safeCollection("studentAppAnnouncements"),
        safeCollection("announcements"),
        safePublishedNews(),
      ]);
      const isAdmin = isAdminStaffLike(serverStaffProfile || link);
      const teacherNameCandidates = [
        (link as any)?.teacherName,
        (serverStaffProfile as any)?.teacherName,
        (serverStaffProfile as any)?.name,
        (serverStaffProfile as any)?.fullName,
        (serverStaffProfile as any)?.displayName,
      ].map((value) => String(value || "").trim()).filter(Boolean);
      const teacherKeys = new Set(teacherNameCandidates.map(normalizeStaffAnnouncementKey).filter(Boolean));
      const now = Date.now();
      const items: StaffExamAnnouncement[] = examRows
        .filter((row: any) => {
          if (String(row?.source || "") !== "exam-plan-lock") return false;
          const expires = row?.expiresAt ? new Date(row.expiresAt).getTime() : Number.POSITIVE_INFINITY;
          if (Number.isFinite(expires) && expires <= now) return false;
          if (isAdmin) return String(row?.recipientType || "") === "admin";
          if (String(row?.recipientType || "") !== "teacher") return false;
          const rowKey = String(row?.recipientTeacherKey || normalizeStaffAnnouncementKey(row?.recipientTeacherName || ""));
          if (rowKey && teacherKeys.has(rowKey)) return true;
          const rowName = normalizeStaffAnnouncementKey(row?.recipientTeacherName || "");
          return !!rowName && Array.from(teacherKeys).some((teacherKey) => teacherKey === rowName || teacherKey.includes(rowName) || rowName.includes(teacherKey));
        })
        .map((row: any) => ({
          id: String(row?.id || ""),
          title: String(row?.title || "ORTAK SINAV BİLGİSİ"),
          content: String(row?.content || ""),
          recipientType: String(row?.recipientType || ""),
          recipientTeacherName: String(row?.recipientTeacherName || ""),
          recipientTeacherKey: String(row?.recipientTeacherKey || ""),
          examDate: String(row?.examDate || row?.date || ""),
          examTime: String(row?.examTime || ""),
          expiresAt: String(row?.expiresAt || ""),
          exams: Array.isArray(row?.exams) ? row.exams : [],
          roomAssignments: Array.isArray(row?.roomAssignments) ? row.roomAssignments : [],
          assignedRooms: Array.isArray(row?.assignedRooms) ? row.assignedRooms.map((item: any) => String(item || "")).filter(Boolean) : [],
        }))
        .sort((a, b) => String(a.examDate + a.examTime).localeCompare(String(b.examDate + b.examTime)));

      const normalizeGenericFeed = (rows: any[], prefix: string): StaffMobileFeedItem[] => rows
        .map((row: any, index: number) => ({
          id: `${prefix}:${String(row?.id || index)}`,
          title: String(row?.title || row?.subject || (prefix === "news" ? "Haber" : "Duyuru")),
          content: String(row?.content || row?.body || row?.description || ""),
          date: String(row?.date || row?.publishedAt || row?.createdAt || ""),
          time: String(row?.time || ""),
          createdAt: String(row?.createdAt || row?.publishedAt || row?.date || ""),
        }))
        .filter((item) => item.title || item.content)
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));

      const latestNewsItems: StaffMobileFeedItem[] = latestNewsRows
        .map((row: any, index: number) => ({
          id: `published-news:${String(row?.id || index)}`,
          title: String(row?.title || "Haber"),
          content: String(row?.content || ""),
          date: String(row?.date || row?.publishedAt || ""),
          time: String(row?.time || ""),
          createdAt: String(row?.publishedAt || row?.date || ""),
          source: String(row?.source || ""),
          url: String(row?.url || ""),
        }))
        .filter((item: StaffMobileFeedItem) => item.title && item.url)
        .sort((a: StaffMobileFeedItem, b: StaffMobileFeedItem) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));

      setStaffExamAnnouncements(items);
      setStaffGeneralAnnouncements(normalizeGenericFeed(generalRows, "announcement"));
      setStaffNewsItems(latestNewsItems);
    } catch (reason: any) {
      setStaffExamAnnouncementsError(reason?.message || "Duyurular yüklenemedi.");
    } finally {
      setStaffExamAnnouncementsLoading(false);
    }
  }, [link, serverStaffProfile]);

  React.useEffect(() => {
    if (!link && !serverStaffProfile) return;
    void loadStaffExamAnnouncements();
  }, [link, serverStaffProfile, loadStaffExamAnnouncements]);

  React.useEffect(() => {
    if (screen !== "announcements") return;
    setStaffAnnouncementTab("announcements");
    setSelectedStaffFeedId("");
  }, [screen]);

  React.useEffect(() => {
    const refreshAnnouncements = () => {
      const now = Date.now();
      setStaffExamAnnouncements((current) => current.filter((item) => {
        if (!item.expiresAt) return true;
        const expires = new Date(item.expiresAt).getTime();
        return !Number.isFinite(expires) || expires > now;
      }));
      void loadStaffExamAnnouncements();
    };
    refreshAnnouncements();
    const timer = window.setInterval(refreshAnnouncements, 30000);
    return () => window.clearInterval(timer);
  }, [loadStaffExamAnnouncements]);

  const beginStaffAnnouncementLongPress = React.useCallback((item: StaffMobileFeedItem) => {
    staffAnnouncementLongPressTriggered.current = false;
    if (staffAnnouncementLongPressTimer.current != null) window.clearTimeout(staffAnnouncementLongPressTimer.current);
    staffAnnouncementLongPressTimer.current = window.setTimeout(() => {
      staffAnnouncementLongPressTriggered.current = true;
      setStaffAnnouncementMenuItem(item);
    }, 550);
  }, []);

  const cancelStaffAnnouncementLongPress = React.useCallback(() => {
    if (staffAnnouncementLongPressTimer.current != null) {
      window.clearTimeout(staffAnnouncementLongPressTimer.current);
      staffAnnouncementLongPressTimer.current = null;
    }
  }, []);

  const dismissStaffAnnouncement = React.useCallback((item: StaffMobileFeedItem) => {
    setStaffDismissedAnnouncementIds((current) => {
      const next = current.includes(item.id) ? current : [...current, item.id];
      try { localStorage.setItem(staffAnnouncementDismissStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    setSelectedStaffFeedId("");
    setStaffAnnouncementMenuItem(null);
  }, [staffAnnouncementDismissStorageKey]);

  React.useEffect(() => {
    try {
      const currentState = window.history.state || {};
      if (currentState?.enstituPortalMarker === portalHistoryMarker) {
        const savedScreen = String(currentState.enstituPortalScreen || "home") as Screen;
        setScreen(savedScreen);
      } else {
        window.history.replaceState(
          {
            ...currentState,
            enstituPortalMarker: portalHistoryMarker,
            enstituPortalScreen: "home",
            enstituPortalDepth: 0,
          },
          "",
          window.location.href,
        );
      }
    } catch {}

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state || {};
      if (state?.enstituPortalMarker === portalHistoryMarker) {
        setScreen((state.enstituPortalScreen || "home") as Screen);
        return;
      }

      // Mobil portalın ana ekranından geri gidildiğinde açılış/splash ekranına
      // veya portal dışına düşme. Ana modül ekranında kal.
      setScreen("home");
      try {
        window.history.pushState(
          {
            ...(window.history.state || {}),
            enstituPortalMarker: portalHistoryMarker,
            enstituPortalScreen: "home",
            enstituPortalDepth: 0,
          },
          "",
          window.location.href,
        );
      } catch {}
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [portalHistoryMarker]);

const [messageTab, setMessageTab] = React.useState<"compose" | "inbox" | "sent">("compose");
  const [messageRecipientType, setMessageRecipientType] = React.useState<"student" | "parent">("parent");
  const [teacherIncomingMessages, setTeacherIncomingMessages] = React.useState<TeacherMessageReply[]>([]);
  const [teacherUnreadMessageCount, setTeacherUnreadMessageCount] = React.useState(0);
  const [selectedTeacherIncomingId, setSelectedTeacherIncomingId] = React.useState("");
  const [teacherReplyTargetId, setTeacherReplyTargetId] = React.useState("");
  const [teacherReplyBody, setTeacherReplyBody] = React.useState("");
  const teacherMessageSwipeStartX = React.useRef<number | null>(null);
  const [messageClassroom, setMessageClassroom] = React.useState("");
  const [messageRecipientSearch, setMessageRecipientSearch] = React.useState("");
  const [messageRecipientIds, setMessageRecipientIds] = React.useState<string[]>([]);
  const [messageBody, setMessageBody] = React.useState("");
  const [messageAttachmentFile, setMessageAttachmentFile] = React.useState<File | null>(null);
  const messageAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const [teacherMessages, setTeacherMessages] = React.useState<TeacherFamilyMessage[]>([]);
  const [teacherMessagesBusy, setTeacherMessagesBusy] = React.useState(false);
  const [teacherMessagesInfo, setTeacherMessagesInfo] = React.useState("");
  const [teacherDesktopBadgeCount, setTeacherDesktopBadgeCount] =
    React.useState(0);
  const [teacherSettingsOpen, setTeacherSettingsOpen] = React.useState(false);
  const [teacherNotificationSoundEnabled, setTeacherNotificationSoundEnabled] =
    React.useState(() => {
      try {
        return localStorage.getItem("enstitu-teacher-notification-sound") !== "0";
      } catch {
        return true;
      }
    });
  const [teacherClosedMessageNotificationEnabled, setTeacherClosedMessageNotificationEnabled] =
    React.useState(() => {
      try {
        return localStorage.getItem("enstitu-teacher-closed-message-notification") === "1";
      } catch {
        return false;
      }
    });
  const [teacherNotificationInfo, setTeacherNotificationInfo] = React.useState("");

  const [examResultsView, setExamResultsView] = React.useState<"exam-list" | "exam-menu" | "ranking" | "student-list" | "student" | "item" | "compare">("exam-list");
  const [showTeacherItemAnalysisReportV2, setShowTeacherItemAnalysisReportV2] = React.useState(false);
  const [teacherExamResults, setTeacherExamResults] = React.useState<TeacherExamResultsResponse>({
    exams: [],
    assignedSubjects: [],
  });
  const [teacherExamResultsBusy, setTeacherExamResultsBusy] = React.useState(false);
  const [teacherExamResultsError, setTeacherExamResultsError] = React.useState("");
  const [selectedTeacherExamId, setSelectedTeacherExamId] = React.useState("");
  const [selectedTeacherExamSubject, setSelectedTeacherExamSubject] = React.useState("");
  const [selectedTeacherExamStudentKey, setSelectedTeacherExamStudentKey] = React.useState("");
  const [teacherQuestionPreview, setTeacherQuestionPreview] = React.useState<{ url: string; title: string } | null>(null);

  const [behaviorMode, setBehaviorMode] =
    React.useState<BehaviorMode>("single");
  const [query, setQuery] = React.useState("");
  const [selectedStudent, setSelectedStudent] =
    React.useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = React.useState<Student[]>([]);
  const [behavior, setBehavior] = React.useState<Behavior | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  installEnstituSoundUnlock();
  const [startupReminderOpen, setStartupReminderOpen] = React.useState(false);
  const [startupReminderBusy, setStartupReminderBusy] = React.useState(false);
  const [startupReminders, setStartupReminders] = React.useState<Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    action?: string;
    meta?: { collection?: string; sourceId?: string };
  }>>([]);


  const [behaviorSearchQuery, setBehaviorSearchQuery] = React.useState("");
  const [behaviorHistoryStudent, setBehaviorHistoryStudent] =
    React.useState<Student | null>(null);
  const [behaviorHistory, setBehaviorHistory] =
    React.useState<BehaviorHistoryRecord[]>([]);
  const [behaviorHistoryBusy, setBehaviorHistoryBusy] = React.useState(false);
  const [behaviorHistoryError, setBehaviorHistoryError] = React.useState("");

  const [bulkClassroom, setBulkClassroom] = React.useState("");
  const [bulkQuery, setBulkQuery] = React.useState("");

  const [selectedClassroom, setSelectedClassroom] = React.useState("");
  const [selectedHomeworkCourse, setSelectedHomeworkCourse] = React.useState("");
  const [homeworkAssignments, setHomeworkAssignments] = React.useState<HomeworkAssignment[]>(() =>
    readHomeworkAssignmentCache(token),
  );
  const [homeworkAssignmentsBusy, setHomeworkAssignmentsBusy] = React.useState(false);
  const [selectedReminder, setSelectedReminder] = React.useState<HomeworkOccurrence | null>(null);
  const [homeworkFilter, setHomeworkFilter] =
    React.useState<"all" | "pending">("all");
  const [homeworkResults, setHomeworkResults] = React.useState<
    Record<string, HomeworkStatus>
  >({});
  const [homeworkSession, setHomeworkSession] =
    React.useState<HomeworkSession | null>(null);
  const [homeworkSessions, setHomeworkSessions] = React.useState<HomeworkSession[]>([]);
  const [homeworkSessionsBusy, setHomeworkSessionsBusy] = React.useState(false);
  const [homeworkHistoryMode, setHomeworkHistoryMode] = React.useState<"list" | "detail">("list");
  const [homeworkTopicDraft, setHomeworkTopicDraft] = React.useState("");
  const [showTopicEditor, setShowTopicEditor] = React.useState(false);
  const [homeworkBusy, setHomeworkBusy] = React.useState(false);
  const [homeworkMessage, setHomeworkMessage] = React.useState("");
  const [homeworkWorkspaceMode, setHomeworkWorkspaceMode] =
    React.useState<"assign" | "control">("assign");
  const [homeworkControlDateDraft, setHomeworkControlDateDraft] =
    React.useState(() => today());
  const [homeworkOverviewSessions, setHomeworkOverviewSessions] =
    React.useState<HomeworkSession[]>([]);
  const [homeworkOverviewBusy, setHomeworkOverviewBusy] = React.useState(false);
  const homeworkOverviewLoadedRef = React.useRef(false);
  const homeworkOverviewRequestRef = React.useRef<Promise<void> | null>(null);
  const installStorageKey = `enstitu_teacher_app_installed_v1:${token}`;
  const [teacherAppInstalled, setTeacherAppInstalled] = React.useState(false);
  const [showInstallGuide, setShowInstallGuide] = React.useState(false);
  const [installPromptReady, setInstallPromptReady] = React.useState(
    () => Boolean(window.__hasatPwaInstallPrompt),
  );
  const [installBusy, setInstallBusy] = React.useState(false);
  const [teacherInfoNow, setTeacherInfoNow] = React.useState(() => new Date());
  const [teacherInfoSchedule, setTeacherInfoSchedule] = React.useState<HomeworkScheduleResponse | null>(null);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);


  React.useEffect(() => {
    const timer = window.setInterval(() => setTeacherInfoNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!token || !link) return;

    let active = true;
    const load = async () => {
      try {
        const result = await requestJson<HomeworkScheduleResponse>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/schedule`,
        );
        if (active) setTeacherInfoSchedule(result);
      } catch {
        if (active) setTeacherInfoSchedule(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, link]);

  const markTeacherAppInstalled = React.useCallback(() => {
    writeInstalledFlag(installStorageKey);
    setTeacherAppInstalled(true);
    setShowInstallGuide(false);
    setInstallPromptReady(false);
  }, [installStorageKey]);

  React.useEffect(() => {
    // "Daha önce kurulmuştu" localStorage kaydı artık kurulum akışını susturmaz.
    // Yalnızca uygulamanın O ANDA standalone/PWA modunda açılması gerçek kurulum kabul edilir.
    const runningStandalone = isStandaloneTeacherApp();

    if (runningStandalone) {
      setTeacherAppInstalled(true);
      setShowInstallGuide(false);
    } else {
      // Ana ekran simgesi kaldırılmışsa veya bağlantı tarayıcıdan açılmışsa
      // tek dokunuşlu kurulum akışını yeniden göster.
      setTeacherAppInstalled(false);
      setShowInstallGuide(true);
    }

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncDisplayMode = () => {
      if (isStandaloneTeacherApp()) markTeacherAppInstalled();
    };
    const handlePromptReady = () => {
      setInstallPromptReady(true);
      if (!isStandaloneTeacherApp()) {
        setTeacherAppInstalled(false);
        setShowInstallGuide(true);
      }
    };
    const handleInstalled = () => markTeacherAppInstalled();

    displayMode.addEventListener?.("change", syncDisplayMode);
    window.addEventListener("hasat:pwa-install-ready", handlePromptReady);
    window.addEventListener("hasat:pwa-installed", handleInstalled);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      displayMode.removeEventListener?.("change", syncDisplayMode);
      window.removeEventListener("hasat:pwa-install-ready", handlePromptReady);
      window.removeEventListener("hasat:pwa-installed", handleInstalled);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [installStorageKey, markTeacherAppInstalled]);

  React.useEffect(() => {
    const recheckInstallSurface = () => {
      if (isStandaloneTeacherApp()) {
        setTeacherAppInstalled(true);
        setShowInstallGuide(false);
      } else {
        setTeacherAppInstalled(false);
        setShowInstallGuide(true);
      }
    };

    window.addEventListener("focus", recheckInstallSurface);
    document.addEventListener("visibilitychange", recheckInstallSurface);

    return () => {
      window.removeEventListener("focus", recheckInstallSurface);
      document.removeEventListener("visibilitychange", recheckInstallSurface);
    };
  }, []);

  const installTeacherApp = async () => {
    const promptEvent = window.__hasatPwaInstallPrompt;
    if (!promptEvent) return;

    setInstallBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.__hasatPwaInstallPrompt = null;
      setInstallPromptReady(false);
      if (choice.outcome === "accepted") markTeacherAppInstalled();
    } finally {
      setInstallBusy(false);
    }
  };

  React.useEffect(() => {
    const admin = isAdminStaffLike(serverStaffProfile || link);
    document.title = link
      ? `${link.teacherName} · e-Nstitü ${admin ? "YÖNETİCİ" : "ÖĞRETMEN"}`
      : `e-Nstitü ${admin ? "YÖNETİCİ" : "ÖĞRETMEN"}`;

    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    if (token) manifest.href = `/api/behavior/teacher-links/${encodeURIComponent(token)}/manifest.webmanifest?v=33`;

    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = "/enstitu-transparent-192.png?v=33";
  }, [link, serverStaffProfile, token]);

  React.useEffect(() => {
    let active = true;
    requestJson<TeacherBehaviorLinkDocument>(
      `/api/behavior/teacher-links/${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    )
      .then((value) => {
        if (!active) return;
        if (!value) setError("Bu bağlantı geçersiz veya süresi dolmuş.");
        else {
          setServerStaffProfile({
            role: String((value as any)?.role || ""),
            staffRole: String((value as any)?.staffRole || ""),
            position: String((value as any)?.position || ""),
            staffProfileVersion: String((value as any)?.staffProfileVersion || ""),
          });
          const normalizedValue = normalizeTeacherLinkStudentNumbers(value);
          setLink(normalizedValue);
          writeTeacherLinkCache(token, normalizedValue);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) setError(reason?.message || "Bağlantı açılamadı.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  React.useEffect(() => {
    if (adminPhoneSplashStartedRef.current) return;
    if (!isStandaloneTeacherApp()) {
      adminPhoneSplashStartedRef.current = true;
      setAdminPhoneSplashVisible(false);
      return;
    }

    const profile = serverStaffProfile || link;
    if (!profile) return;
    const isAdmin = isAdminStaffLike(profile);

    try {
      localStorage.setItem(`enstitu:pwa:portal-role:${token}`, isAdmin ? "ADMIN" : "TEACHER");
      if (link?.teacherName) localStorage.setItem(`enstitu:pwa:portal-name:${token}`, String(link.teacherName));
    } catch {}

    try {
      if (sessionStorage.getItem(adminPhoneSplashSessionKey) === "1") {
        adminPhoneSplashStartedRef.current = true;
        setAdminPhoneSplashVisible(false);
        return;
      }
      sessionStorage.setItem(adminPhoneSplashSessionKey, "1");
    } catch {}

    adminPhoneSplashStartedRef.current = true;
    setAdminPhoneSplashVisible(true);

    // Splash yalnızca bir tanıtım katmanıdır. 5 saniye sonunda ana ekranı
    // kesin olarak serbest bırak. Mobil tarayıcı zamanlayıcıyı geciktirse bile
    // interval/visibility denetimi splash'in ekranda kilitli kalmasını önler.
    const startedAt = Date.now();
    const closeSplash = () => {
      setAdminPhoneSplashVisible(false);
      if (adminPhoneSplashTimerRef.current !== null) {
        window.clearTimeout(adminPhoneSplashTimerRef.current);
        adminPhoneSplashTimerRef.current = null;
      }
    };
    adminPhoneSplashTimerRef.current = window.setTimeout(closeSplash, 5000);
    const watchdog = window.setInterval(() => {
      if (Date.now() - startedAt >= 5000) {
        window.clearInterval(watchdog);
        closeSplash();
      }
    }, 250);
    const onVisibility = () => {
      if (Date.now() - startedAt >= 5000) closeSplash();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [serverStaffProfile, link, token]);

  React.useEffect(() => {
    return () => {
      if (adminPhoneSplashTimerRef.current !== null) {
        window.clearTimeout(adminPhoneSplashTimerRef.current);
        adminPhoneSplashTimerRef.current = null;
      }
    };
  }, []);

  const searchResults = React.useMemo(() => {
    if (!link) return [];
    const rows = query.trim()
      ? link.students.filter((student) => matches(query, student))
      : link.students;
    return sortStudentsByNumber(rows).slice(0, 30);
  }, [link, query]);

  const behaviorHistorySearchResults = React.useMemo(() => {
    if (!link) return [];
    const clean = behaviorSearchQuery.trim();
    if (!clean) return [];
    return sortStudentsByNumber(
      link.students.filter((student) => matches(clean, student)),
    ).slice(0, 30);
  }, [link, behaviorSearchQuery]);


  const classrooms = React.useMemo(() => {
    if (!link) return [];
    return Array.from(
      new Set(
        link.students
          .map((student) => String(student.classroom || "").trim())
          .filter(Boolean),
      ),
    ).sort(classroomSort);
  }, [link]);

  const selectedHomeworkAssignment = React.useMemo(
    () => homeworkAssignments.find(
      (item) =>
        normalize(item.classroom) === normalize(selectedClassroom) &&
        normalize(item.courseName) === normalize(selectedHomeworkCourse),
    ) || null,
    [homeworkAssignments, selectedClassroom, selectedHomeworkCourse],
  );

  const classroomStudentsAll = React.useMemo(() => {
    if (!link || !selectedClassroom) return [];
    const assignedStudentIds = new Set(
      (selectedHomeworkAssignment?.studentIds || []).map(String).filter(Boolean),
    );
    if (assignedStudentIds.size > 0) {
      return sortStudentsByNumber(
        link.students.filter((student) => assignedStudentIds.has(String(student.id || ""))),
      );
    }
    const selectedClassroomKey = normalize(selectedClassroom);
    return sortStudentsByNumber(
      link.students.filter(
        (student) => normalize(student.classroom) === selectedClassroomKey,
      ),
    );
  }, [link, selectedClassroom, selectedHomeworkAssignment]);

  const classroomStudents = React.useMemo(() => {
    return homeworkFilter === "pending"
      ? classroomStudentsAll.filter(
          (student) => !homeworkResults[student.id],
        )
      : classroomStudentsAll;
  }, [classroomStudentsAll, homeworkFilter, homeworkResults]);

  const classroomTotal = classroomStudentsAll.length;

  const evaluatedCount = React.useMemo(
    () =>
      classroomStudentsAll.filter((student) =>
        Boolean(homeworkResults[student.id]),
      ).length,
    [classroomStudentsAll, homeworkResults],
  );

  const progress =
    classroomTotal > 0
      ? Math.round((evaluatedCount / classroomTotal) * 100)
      : 0;

  const bulkStudents = React.useMemo(() => {
    if (!link || !bulkClassroom) return [];
    const rows = sortStudentsByNumber(
      link.students.filter(
        (student) => String(student.classroom) === bulkClassroom,
      ),
    );
    if (!bulkQuery.trim()) return rows;
    return rows.filter((student) => matches(bulkQuery, student));
  }, [link, bulkClassroom, bulkQuery]);


  const loadTeacherExamResults = React.useCallback(async () => {
    if (!token) return;
    setTeacherExamResultsBusy(true);
    setTeacherExamResultsError("");
    try {
      const result = await requestJson<TeacherExamResultsResponse>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/exam-results`,
      );
      const safeResult: TeacherExamResultsResponse = {
        exams: Array.isArray(result.exams) ? result.exams : [],
        assignedSubjects: Array.isArray(result.assignedSubjects) ? result.assignedSubjects : [],
      };
      setTeacherExamResults(safeResult);

      const currentExamExists = safeResult.exams.some((exam) => exam.id === selectedTeacherExamId);
      const examId = currentExamExists ? selectedTeacherExamId : (safeResult.exams[0]?.id || "");
      setSelectedTeacherExamId(examId);

      const exam = safeResult.exams.find((item) => item.id === examId) || safeResult.exams[0];
      const subjectExists = exam?.subjects.some((subject) => subject.subjectName === selectedTeacherExamSubject);
      if (!subjectExists) setSelectedTeacherExamSubject(exam?.subjects[0]?.subjectName || "");
      setSelectedTeacherExamStudentKey("");
    } catch (reason: any) {
      setTeacherExamResultsError(reason?.message || "Sınav sonuçları yüklenemedi.");
    } finally {
      setTeacherExamResultsBusy(false);
    }
  }, [token, selectedTeacherExamId, selectedTeacherExamSubject]);

  React.useEffect(() => {
    if (screen !== "exam-results") return;
    void loadTeacherExamResults();
  }, [screen, loadTeacherExamResults]);

  const selectedTeacherExam = React.useMemo(
    () => teacherExamResults.exams.find((exam) => exam.id === selectedTeacherExamId) || teacherExamResults.exams[0] || null,
    [teacherExamResults.exams, selectedTeacherExamId],
  );

  const selectedTeacherSubjectResult = React.useMemo(
    () =>
      selectedTeacherExam?.subjects.find((subject) => subject.subjectName === selectedTeacherExamSubject) ||
      selectedTeacherExam?.subjects[0] ||
      null,
    [selectedTeacherExam, selectedTeacherExamSubject],
  );


  const loadStartupReminders = React.useCallback(async () => {
    if (!token || !link) return;
    setStartupReminderBusy(true);
    setStartupReminderOpen(true);
    try {
      const result = await requestJson<{ reminders?: any[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/startup-reminders`,
        { method: "GET" },
      );
      const nextReminders = Array.isArray(result.reminders) ? result.reminders : [];
      // Deneme takvimindeki etkinlikler de öğretmen hatırlatmalarında gösterilir.
      try {
        const trials = await requestJson<{ reminders?: any[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/trial-exam-reminders`,
          { method: "GET" },
        );
        const trialRows = Array.isArray(trials.reminders) ? trials.reminders : [];
        nextReminders.push(...trialRows.filter((item: any) => Number(item?.meta?.daysLeft) <= 2));
      } catch {}
      try {
        const response = await fetch("/api/database/collections/reminderInformation", { cache: "no-store" });
        if (response.ok) {
          const rows = await response.json();
          const schoolId = String((link as any)?.schoolId || "school-main");
          nextReminders.push(...activeCustomReminders(rows, "teacher", schoolId).map(item => ({
            id: "manual:" + item.id, type: "notice", title: item.title,
            body: item.body + " · " + (item.kind || ""), action: "",
          })));
        }
      } catch {}
      setStartupReminders(nextReminders);
      if (nextReminders.length > 0) void playEnstituNotificationSound();
    } catch {
      setStartupReminders([]);
    } finally {
      setStartupReminderBusy(false);
    }
  }, [token, link]);

  React.useEffect(() => {
    if (!link || !token) return;
    void loadStartupReminders();
  }, [link, token, loadStartupReminders]);

  const openTeacherReminderAction = async (item: any) => {
    if (item?.type === "message" && item?.meta?.collection && item?.meta?.sourceId) {
      try {
        await requestJson(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/startup-reminders/message-read`,
          {
            method: "POST",
            body: JSON.stringify({
              collection: item.meta.collection,
              sourceId: item.meta.sourceId,
            }),
          },
        );
      } catch {}
    }

    if (item?.action === "homework") goToScreen("homework");
    else if (item?.action === "exam-results") goToScreen("exam-results");
    else if (item?.action === "messages") goToScreen("messages");
    else if (item?.action === "schedule") goToScreen("schedule");
    else if (item?.action === "questions") goToScreen("questions");
    else if (item?.action === "admin-study-plans") goToScreen("admin-study-plans");

    if (item?.action) setStartupReminderOpen(false);
  };

  const messageClassrooms = React.useMemo(() => {
    if (!link) return [];
    return Array.from(new Set(link.students.map((student) => String(student.classroom || "").trim()).filter(Boolean))).sort(classroomSort);
  }, [link]);

  const messageRecipients = React.useMemo(() => {
    if (!link) return [];

    const classroomKey = normalize(messageClassroom);
    const searchQuery = normalize(messageRecipientSearch).trim();
    const searchTerms = searchQuery.split(" ").filter(Boolean);

    const candidates = link.students.filter((student: any) => {
      if (classroomKey && normalize(student.classroom) !== classroomKey) return false;
      if (!searchTerms.length) return true;

      const name = normalize(
        student?.name ||
        student?.fullName ||
        student?.studentName ||
        [student?.firstName, student?.lastName].filter(Boolean).join(" "),
      ).replace(/\s+/g, " ").trim();
      const nameWords = name.split(" ").filter(Boolean);
      const number = normalize(studentSchoolNumber(student)).replace(/\s+/g, "");
      const compactSearch = searchQuery.replace(/\s+/g, "");

      // Okul numarasında yalnız baştan eşleşme: 12 -> 1234, fakat 3124 değil.
      if (/^\d+$/.test(compactSearch)) return number.startsWith(compactSearch);

      // İsim aramasında her yazılan parça bir kelimenin BAŞINDAN eşleşmeli.
      // Tek kelime, ad-soyadın herhangi bir kelimesinin başıyla eşleşebilir:
      // "ber" -> "Zehra Beren Uçar".
      // Birden fazla kelime ise ART ARDA ve aynı sırada eşleşmelidir:
      // "zehra be" -> "Zehra Beren" / "Zehra Beyza"; "Zümra ..." eşleşmez.
      // "zehra ber" -> "Zehra Beren"; "Zehra Beyza" eşleşmez.
      if (searchTerms.length === 1) {
        return nameWords.some((word) => word.startsWith(searchTerms[0]));
      }

      for (let startIndex = 0; startIndex <= nameWords.length - searchTerms.length; startIndex += 1) {
        const consecutiveMatch = searchTerms.every((term, offset) =>
          nameWords[startIndex + offset]?.startsWith(term),
        );
        if (consecutiveMatch) return true;
      }
      return false;
    });

    if (!searchQuery) return sortStudentsByNumber(candidates);

    return [...candidates].sort((left: any, right: any) => {
      const leftNumber = normalize(studentSchoolNumber(left));
      const rightNumber = normalize(studentSchoolNumber(right));
      const leftName = normalize(left?.name || left?.fullName || left?.studentName || "");
      const rightName = normalize(right?.name || right?.fullName || right?.studentName || "");

      const rank = (name: string, number: string) => {
        if (number === searchQuery) return 0;
        if (number.startsWith(searchQuery)) return 1;
        if (name === searchQuery) return 2;
        if (name.startsWith(searchQuery)) return 3;

        const words = name.split(" ").filter(Boolean);
        if (searchTerms.length === 1 && words.some((word) => word.startsWith(searchTerms[0]))) return 4;
        if (searchTerms.length > 1) {
          for (let startIndex = 0; startIndex <= words.length - searchTerms.length; startIndex += 1) {
            if (searchTerms.every((term, offset) => words[startIndex + offset]?.startsWith(term))) return 4;
          }
        }
        return 5;
      };

      const rankDiff = rank(leftName, leftNumber) - rank(rightName, rightNumber);
      if (rankDiff !== 0) return rankDiff;
      return leftName.localeCompare(rightName, "tr");
    });
  }, [link, messageClassroom, messageRecipientSearch]);

  const loadTeacherMessages = React.useCallback(async () => {
    if (!token) return;
    setTeacherMessagesBusy(true);
    try {
      const [messagesResponse, receiptsResponse, repliesResponse] = await Promise.all([
        fetch("/api/database/collections/teacherAppMessages", { cache: "no-store" }),
        fetch("/api/database/collections/teacherAppMessageReceipts", { cache: "no-store" }),
        fetch("/api/database/collections/teacherAppMessageReplies", { cache: "no-store" }),
      ]);

      const messagesRows = await messagesResponse.json().catch(() => []);
      const receiptsRows = await receiptsResponse.json().catch(() => []);
      const repliesRows = await repliesResponse.json().catch(() => []);

      if (!messagesResponse.ok) {
        throw new Error("Gönderilen mesajlar okunamadı.");
      }
      if (!receiptsResponse.ok) {
        throw new Error("Mesaj alıcı kayıtları okunamadı.");
      }
      if (!repliesResponse.ok) {
        throw new Error("Mesaj cevapları okunamadı.");
      }

      const messages = (Array.isArray(messagesRows) ? messagesRows : [])
        .filter(
          (item: any) =>
            String(item?.linkToken || "") === token &&
            String(item?.teacherId || "") === String((link as any)?.teacherId || ""),
        )
        .sort((a: any, b: any) =>
          String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
        )
        .slice(0, 100)
        .map((message: any) => ({
          ...message,
          receipts: (Array.isArray(receiptsRows) ? receiptsRows : [])
            .filter(
              (receipt: any) =>
                String(receipt?.messageId || "") === String(message?.id || ""),
            )
            .sort((a: any, b: any) =>
              String(a?.studentName || "").localeCompare(
                String(b?.studentName || ""),
                "tr-TR",
              ),
            ),
          replies: (Array.isArray(repliesRows) ? repliesRows : [])
            .filter(
              (reply: any) =>
                String(reply?.messageId || "") === String(message?.id || "") &&
                String(reply?.recipientTeacherId || "") === String((link as any)?.teacherId || ""),
            )
            .sort((a: any, b: any) =>
              String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
            ),
        }));

      setTeacherMessages(messages);

      const incoming = (Array.isArray(repliesRows) ? repliesRows : [])
        .filter(
          (reply: any) =>
            String(reply?.recipientTeacherId || "") === String((link as any)?.teacherId || ""),
        )
        .sort((a: any, b: any) =>
          String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
        )
        .slice(0, 200);

      setTeacherIncomingMessages(incoming);
      setTeacherUnreadMessageCount(incoming.filter((reply: any) => !reply?.openedAt).length);
    } catch (reason: any) {
      setTeacherMessagesInfo(
        reason?.message || "Gönderilen bilgilendirmeler yüklenemedi.",
      );
    } finally {
      setTeacherMessagesBusy(false);
    }
  }, [token, link]);

  React.useEffect(() => {
    if (screen === "messages") void loadTeacherMessages();
  }, [screen, loadTeacherMessages]);

  const refreshTeacherUnreadMessageCount = React.useCallback(async () => {
    if (!token || !(link as any)?.teacherId) return;
    try {
      const response = await fetch("/api/database/collections/teacherAppMessageReplies", { cache: "no-store" });
      const rows = await response.json().catch(() => []);
      if (!response.ok) return;
      const incoming = (Array.isArray(rows) ? rows : [])
        .filter(
          (reply: any) =>
            String(reply?.recipientTeacherId || "") === String((link as any)?.teacherId || ""),
        )
        .sort((a: any, b: any) =>
          String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
        )
        .slice(0, 200);
      setTeacherIncomingMessages(incoming);
      setTeacherUnreadMessageCount(incoming.filter((reply: any) => !reply?.openedAt).length);
    } catch {}
  }, [token, link]);

  React.useEffect(() => {
    if (!token || !(link as any)?.teacherId) return;
    void refreshTeacherUnreadMessageCount();
    const timer = window.setInterval(() => void refreshTeacherUnreadMessageCount(), 30000);
    return () => window.clearInterval(timer);
  }, [token, link, refreshTeacherUnreadMessageCount]);

  const openTeacherIncomingMessage = async (reply: TeacherMessageReply) => {
    setSelectedTeacherIncomingId((current) => (current === reply.id ? "" : reply.id));
    if (reply.openedAt) return;

    const openedAt = new Date().toISOString();
    setTeacherIncomingMessages((current) =>
      current.map((item) => (item.id === reply.id ? { ...item, openedAt } : item)),
    );
    setTeacherUnreadMessageCount((current) => Math.max(0, current - 1));

    try {
      await fetch(
        `/api/database/collections/teacherAppMessageReplies/${encodeURIComponent(String(reply.id || ""))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...reply, openedAt }),
        },
      );
    } catch {
      // Mesaj gösterilmeye devam eder; yalnız okundu bilgisi tekrar denenir.
    }
  };

  const handleTeacherMessageSwipeStart = (event: React.TouchEvent) => {
    teacherMessageSwipeStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTeacherMessageSwipeEnd = (event: React.TouchEvent) => {
    const startX = teacherMessageSwipeStartX.current;
    teacherMessageSwipeStartX.current = null;
    if (startX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 55) return;

    const order: Array<"compose" | "inbox" | "sent"> = ["compose", "inbox", "sent"];
    const currentIndex = Math.max(0, order.indexOf(messageTab));
    const nextIndex = delta < 0
      ? Math.min(order.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    const nextTab = order[nextIndex];
    if (nextTab === messageTab) return;
    setMessageTab(nextTab);
    if (nextTab !== "compose") void loadTeacherMessages();
    setTeacherReplyTargetId("");
    setTeacherReplyBody("");
  };

  const sendTeacherFamilyMessage = async () => {
    if ((!messageBody.trim() && !messageAttachmentFile) || messageRecipientIds.length === 0 || !link) return;

    setTeacherMessagesBusy(true);
    setTeacherMessagesInfo("");

    let uploadedAttachment: TeacherMessageAttachment | null = null;
    let messageId = "";
    let messageRecordSaved = false;

    try {
      const selectedIds = new Set(messageRecipientIds.map(String));
      const recipients = link.students.filter((student) =>
        selectedIds.has(String(student.id)),
      );

      if (!recipients.length) {
        throw new Error("Gönderilecek öğrenci/veli seçilmedi.");
      }

      const now = new Date().toISOString();
      messageId = `tam-${Date.now()}-${crypto.randomUUID()}`;

      if (messageAttachmentFile) {
        if (!isSupportedMessageFile(messageAttachmentFile)) {
          throw new Error("Yalnız PDF, DOC/DOCX, XLS/XLSX ve resim dosyaları gönderilebilir.");
        }
        if (messageAttachmentFile.size > 20 * 1024 * 1024) {
          throw new Error("Dosya en fazla 20 MB olabilir.");
        }
        const dataBase64 = await messageFileToBase64(messageAttachmentFile);
        const uploadResponse = await fetch(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/messages/${encodeURIComponent(messageId)}/attachment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: messageAttachmentFile.name,
              mimeType: messageAttachmentFile.type || "application/octet-stream",
              size: messageAttachmentFile.size,
              dataBase64,
            }),
          },
        );
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
          throw new Error(uploadResult?.error || "Dosya yüklenemedi.");
        }
        uploadedAttachment = uploadResult?.attachment || null;
        if (!uploadedAttachment?.id) throw new Error("Dosya yükleme kaydı oluşturulamadı.");
      }

      const messageRecord = {
        id: messageId,
        linkToken: token,
        schoolId: String((link as any).schoolId || ""),
        teacherId: String((link as any).teacherId || ""),
        teacherName: String(link.teacherName || ""),
        title: "",
        body: messageBody.trim() || (messageAttachmentFile ? `${messageAttachmentFile.name} dosyası gönderildi.` : ""),
        attachment: uploadedAttachment,
        recipientType: messageRecipientType,
        recipientCount: recipients.length,
        createdAt: now,
        status: "saved",
      };

      const messageResponse = await fetch(
        `/api/database/collections/teacherAppMessages/${encodeURIComponent(messageId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageRecord),
        },
      );

      const messageResult = await messageResponse.json().catch(() => ({}));
      if (!messageResponse.ok) {
        throw new Error(
          messageResult?.error ||
            `Mesaj kaydedilemedi (HTTP ${messageResponse.status}).`,
        );
      }
      messageRecordSaved = true;

      const receipts = [];
      for (const student of recipients) {
        const studentId = String(student.id || "");
        const receiptId = `tar-${messageId}-${studentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const receipt = {
          id: receiptId,
          messageId,
          linkToken: token,
          schoolId: String((link as any).schoolId || ""),
          teacherId: String((link as any).teacherId || ""),
          teacherName: String(link.teacherName || ""),
          recipientType: messageRecipientType,
          studentId,
          studentName: String(student.name || ""),
          studentNumber: canonicalStudentNumber(student),
          classroom: String(student.classroom || ""),
          sentAt: now,
          openedAt: null,
          reminderCount: 0,
        };

        const receiptResponse = await fetch(
          `/api/database/collections/teacherAppMessageReceipts/${encodeURIComponent(receiptId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receipt),
          },
        );

        const receiptResult = await receiptResponse.json().catch(() => ({}));
        if (!receiptResponse.ok) {
          throw new Error(
            receiptResult?.error ||
              `${student.name} için alıcı kaydı oluşturulamadı (HTTP ${receiptResponse.status}).`,
          );
        }

        receipts.push(receipt);
      }

      void fetch(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/messages/${encodeURIComponent(messageId)}/push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ).catch(() => undefined);

      setMessageBody("");
      setMessageAttachmentFile(null);
      if (messageAttachmentInputRef.current) messageAttachmentInputRef.current.value = "";
      setMessageRecipientIds([]);
      setTeacherMessagesInfo(
        `${messageRecipientType === "parent" ? "Veli" : "Öğrenci"} mesajı ${recipients.length} kişiye başarıyla kaydedildi.`,
      );
      setMessageTab("sent");
      await loadTeacherMessages();
    } catch (reason: any) {
      if (uploadedAttachment?.id && messageId && !messageRecordSaved) {
        void fetch(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/messages/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(uploadedAttachment.id)}`,
          { method: "DELETE" },
        ).catch(() => undefined);
      }
      setTeacherMessagesInfo(
        reason?.message || "Bilgilendirme gönderilemedi.",
      );
    } finally {
      setTeacherMessagesBusy(false);
    }
  };

  const replyToTeacherIncomingMessage = async (reply: TeacherMessageReply) => {
    const body = teacherReplyBody.trim();
    if (!body || !link) return;

    setTeacherMessagesBusy(true);
    setTeacherMessagesInfo("");
    try {
      const now = new Date().toISOString();

      if ((reply.senderType === "student" || reply.senderType === "parent") && reply.studentId) {
        const student = link.students.find((item) => String(item.id || "") === String(reply.studentId || ""));
        if (!student) throw new Error("Mesajı gönderen öğrenci kaydı bulunamadı.");

        const messageId = `tam-${Date.now()}-${crypto.randomUUID()}`;
        const messageRecord = {
          id: messageId,
          linkToken: token,
          schoolId: String((link as any).schoolId || ""),
          teacherId: String((link as any).teacherId || ""),
          teacherName: String(link.teacherName || ""),
          title: "",
          body,
          recipientType: reply.senderType,
          recipientCount: 1,
          createdAt: now,
          status: "saved",
          inReplyTo: reply.id,
        };

        const messageResponse = await fetch(
          `/api/database/collections/teacherAppMessages/${encodeURIComponent(messageId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messageRecord),
          },
        );
        const messageResult = await messageResponse.json().catch(() => ({}));
        if (!messageResponse.ok) throw new Error(messageResult?.error || "Cevap mesajı kaydedilemedi.");

        const receiptId = `tar-${messageId}-${String(student.id || "").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const receipt = {
          id: receiptId,
          messageId,
          linkToken: token,
          schoolId: String((link as any).schoolId || ""),
          teacherId: String((link as any).teacherId || ""),
          teacherName: String(link.teacherName || ""),
          recipientType: reply.senderType,
          studentId: String(student.id || ""),
          studentName: String(student.name || reply.senderName || ""),
          studentNumber: canonicalStudentNumber(student),
          classroom: String(student.classroom || reply.classroom || ""),
          sentAt: now,
          openedAt: null,
          reminderCount: 0,
        };
        const receiptResponse = await fetch(
          `/api/database/collections/teacherAppMessageReceipts/${encodeURIComponent(receiptId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receipt),
          },
        );
        const receiptResult = await receiptResponse.json().catch(() => ({}));
        if (!receiptResponse.ok) throw new Error(receiptResult?.error || "Cevap alıcı kaydı oluşturulamadı.");

        void fetch(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/messages/${encodeURIComponent(messageId)}/push`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
        ).catch(() => undefined);
      } else {
        const recipientTeacherId = String(reply.senderTeacherId || "").trim();
        const recipientUserId = String(reply.senderUserId || "").trim();
        if (!recipientTeacherId && !recipientUserId) {
          throw new Error("Bu mesajın göndericisine ait geri dönüş kimliği bulunmuyor.");
        }
        const responseId = `reply-${Date.now()}-${crypto.randomUUID()}`;
        const responseRecord = {
          id: responseId,
          messageId: reply.messageId || reply.id,
          recipientTeacherId: recipientTeacherId || undefined,
          recipientUserId: recipientUserId || undefined,
          senderType: String((link as any)?.role || "").toLocaleUpperCase("tr-TR") === "ADMIN" ? "admin" : "teacher",
          senderName: String(link.teacherName || ""),
          senderTeacherId: String((link as any).teacherId || ""),
          studentId: "",
          studentNumber: "",
          classroom: "",
          body,
          createdAt: now,
          openedAt: null,
          inReplyTo: reply.id,
        };
        const response = await fetch(
          `/api/database/collections/teacherAppMessageReplies/${encodeURIComponent(responseId)}`,
          { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(responseRecord) },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || "Cevap mesajı kaydedilemedi.");
      }

      setTeacherReplyBody("");
      setTeacherReplyTargetId("");
      setTeacherMessagesInfo("Cevabınız gönderildi.");
      setMessageTab("sent");
      await loadTeacherMessages();
    } catch (reason: any) {
      setTeacherMessagesInfo(reason?.message || "Cevap gönderilemedi.");
    } finally {
      setTeacherMessagesBusy(false);
    }
  };

  const deleteTeacherIncomingMessage = async (reply: TeacherMessageReply) => {
    if (!window.confirm("Bu gelen mesaj silinsin mi?")) return;
    setTeacherMessagesBusy(true);
    setTeacherMessagesInfo("");
    try {
      const response = await fetch(
        `/api/database/collections/teacherAppMessageReplies/${encodeURIComponent(String(reply.id || ""))}`,
        { method: "DELETE" },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Mesaj silinemedi.");
      setSelectedTeacherIncomingId("");
      setTeacherReplyTargetId("");
      setTeacherReplyBody("");
      await loadTeacherMessages();
      setTeacherMessagesInfo("Gelen mesaj silindi.");
    } catch (reason: any) {
      setTeacherMessagesInfo(reason?.message || "Mesaj silinemedi.");
    } finally {
      setTeacherMessagesBusy(false);
    }
  };

  const deleteTeacherSentMessage = async (message: TeacherFamilyMessage) => {
    if (!window.confirm("Bu gönderilen mesaj silinsin mi?")) return;
    setTeacherMessagesBusy(true);
    setTeacherMessagesInfo("");
    try {
      if (message.attachment?.id) {
        const attachmentResponse = await fetch(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/messages/${encodeURIComponent(message.id)}/attachment/${encodeURIComponent(message.attachment.id)}`,
          { method: "DELETE" },
        );
        if (!attachmentResponse.ok && attachmentResponse.status !== 404) {
          const attachmentResult = await attachmentResponse.json().catch(() => ({}));
          throw new Error(attachmentResult?.error || "Mesaj dosyası silinemedi.");
        }
      }
      const targets = [
        ...((message.receipts || []).map((receipt) => ({ collection: "teacherAppMessageReceipts", id: receipt.id }))),
        ...((message.replies || []).map((reply) => ({ collection: "teacherAppMessageReplies", id: reply.id }))),
        { collection: "teacherAppMessages", id: message.id },
      ];
      for (const target of targets) {
        if (!target.id) continue;
        const response = await fetch(
          `/api/database/collections/${target.collection}/${encodeURIComponent(String(target.id))}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result?.error || "Gönderilen mesaj silinemedi.");
        }
      }
      await loadTeacherMessages();
      setTeacherMessagesInfo("Gönderilen mesaj silindi.");
    } catch (reason: any) {
      setTeacherMessagesInfo(reason?.message || "Gönderilen mesaj silinemedi.");
    } finally {
      setTeacherMessagesBusy(false);
    }
  };

  const remindUnreadTeacherMessage = async (messageId: string) => {
    setTeacherMessagesBusy(true);
    setTeacherMessagesInfo("");
    try {
      const response = await fetch(
        "/api/database/collections/teacherAppMessageReceipts",
        { cache: "no-store" },
      );
      const rows = await response.json().catch(() => []);
      if (!response.ok) throw new Error("Alıcı kayıtları okunamadı.");

      const unread = (Array.isArray(rows) ? rows : []).filter(
        (receipt: any) =>
          String(receipt?.messageId || "") === messageId &&
          !receipt?.openedAt,
      );

      const now = new Date().toISOString();
      for (const receipt of unread) {
        const next = {
          ...receipt,
          reminderCount: Number(receipt?.reminderCount || 0) + 1,
          lastReminderAt: now,
        };
        const saveResponse = await fetch(
          `/api/database/collections/teacherAppMessageReceipts/${encodeURIComponent(String(receipt.id))}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          },
        );
        if (!saveResponse.ok) {
          throw new Error("Hatırlatma kaydı güncellenemedi.");
        }
      }

      setTeacherMessagesInfo(
        `${unread.length} okunmamış alıcı için hatırlatma kaydı oluşturuldu.`,
      );
      await loadTeacherMessages();
    } catch (reason: any) {
      setTeacherMessagesInfo(
        reason?.message || "Hatırlatma kaydedilemedi.",
      );
    } finally {
      setTeacherMessagesBusy(false);
    }
  };


  const syncTeacherDesktopBadge = React.useCallback(async (count: number) => {
    const safeCount = Math.max(0, Math.min(99, Number(count || 0)));
    setTeacherDesktopBadgeCount(safeCount);

    try {
      const nav = navigator as Navigator & {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };

      if (safeCount > 0 && nav.setAppBadge) {
        await nav.setAppBadge(safeCount);
      } else if (safeCount === 0 && nav.clearAppBadge) {
        await nav.clearAppBadge();
      }
    } catch {
      // Badging API yoksa aşağıdaki başlık rozeti yedek olarak çalışır.
    }

    document.title =
      safeCount > 0
        ? `(${safeCount}) e-Nstitü Öğretmen`
        : "e-Nstitü Öğretmen";
  }, []);

  React.useEffect(() => {
    if (!token) return;

    let active = true;

    const refreshTeacherDesktopBadge = async () => {
      try {
        const result = await requestJson<{ reminders?: any[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/startup-reminders`,
          { method: "GET" },
        );

        if (!active) return;

        const reminders = Array.isArray(result?.reminders)
          ? result.reminders
          : [];

        // Yalnız uygulamadaki bir modül/butona bağlı yeni gelişmeleri
        // masaüstü/PWA toplam rozetine dahil et.
        const actionable = reminders.filter((item: any) =>
          ["homework", "exam-results", "messages", "schedule", "questions"].includes(
            String(item?.action || ""),
          ),
        );

        const unique = new Set<string>();

        actionable.forEach((item: any) => {
          const type = String(item?.type || "info");
          const action = String(item?.action || "");
          const id = String(
            item?.id ||
            item?.meta?.sourceId ||
            item?.sessionId ||
            item?.assignmentId ||
            JSON.stringify(item),
          );

          unique.add(`${action}:${type}:${id}`);
        });

        const total = unique.size;

        await syncTeacherDesktopBadge(total);

        const safeTotal = Math.max(0, Math.min(total, 99));
        document.title =
          safeTotal > 0
            ? `(${safeTotal}) e-Nstitü Öğretmen`
            : "e-Nstitü Öğretmen";
      } catch {
        // Ağ kesintisinde mevcut rozet değeri korunur.
      }
    };

    void refreshTeacherDesktopBadge();

    const timer = window.setInterval(
      () => void refreshTeacherDesktopBadge(),
      30000,
    );

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshTeacherDesktopBadge();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token, syncTeacherDesktopBadge]);

  const changeBehaviorMode = (next: BehaviorMode) => {
    setBehaviorMode(next);
    setQuery("");
    setBulkQuery("");
    setBulkClassroom("");
    setSelectedStudent(null);
    setSelectedStudents([]);
    setBehavior(null);
    setMessage("");
    setBehaviorSearchQuery("");
    setBehaviorHistoryStudent(null);
    setBehaviorHistory([]);
    setBehaviorHistoryError("");
  };

  const toggleBulkStudent = (student: Student) => {
    setSelectedStudents((current) =>
      current.some((item) => item.id === student.id)
        ? current.filter((item) => item.id !== student.id)
        : [...current, student],
    );
  };

  const bulkClassSelectedIds = React.useMemo(
    () =>
      new Set(
        selectedStudents
          .filter((student) => student.classroom === bulkClassroom)
          .map((student) => student.id),
      ),
    [selectedStudents, bulkClassroom],
  );

  const allVisibleBulkSelected =
    bulkStudents.length > 0 &&
    bulkStudents.every((student) => bulkClassSelectedIds.has(student.id));

  const toggleAllVisibleBulk = () => {
    setSelectedStudents((current) => {
      const visibleIds = new Set(bulkStudents.map((student) => student.id));
      if (allVisibleBulkSelected) {
        return current.filter((student) => !visibleIds.has(student.id));
      }
      const existingIds = new Set(current.map((student) => student.id));
      return [
        ...current,
        ...bulkStudents.filter((student) => !existingIds.has(student.id)),
      ];
    });
  };

  const loadBehaviorHistory = React.useCallback(
    async (student: Student) => {
      setBehaviorHistoryStudent(student);
      setBehaviorHistory([]);
      setBehaviorHistoryError("");
      setBehaviorHistoryBusy(true);

      try {
        const result = await requestJson<{ items?: BehaviorHistoryRecord[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(
            token,
          )}/behavior-history?studentId=${encodeURIComponent(student.id)}`,
          { method: "GET" },
        );
        setBehaviorHistory(Array.isArray(result.items) ? result.items : []);
      } catch (reason: any) {
        setBehaviorHistoryError(
          reason?.message || "Davranış kayıtları getirilemedi.",
        );
      } finally {
        setBehaviorHistoryBusy(false);
      }
    },
    [token],
  );

  const makeRecord = (student: Student, index = 0) => ({
    id: `teacher-${Date.now()}-${index}-${crypto.randomUUID()}`,
    studentId: student.id,
    studentName: student.name,
    studentClassroom: student.classroom,
    studentNumber: canonicalStudentNumber(student),
    studentsList: [],
    behaviorType: behavior?.type,
    behaviorName: behavior?.name,
    date: today(),
    description: "Öğretmen bağlantısı üzerinden kaydedildi.",
    teacherName: link?.teacherName,
    createdAt: Date.now() + index,
  });

  const saveBehavior = async () => {
    if (!link || !behavior) return;
    const targets =
      behaviorMode === "single"
        ? selectedStudent
          ? [selectedStudent]
          : []
        : selectedStudents;
    if (!targets.length) return;

    setSaving(true);
    setMessage("");
    try {
      await submitTeacherBehaviorRecords(token, targets.map(makeRecord));
      setMessage(
        behaviorMode === "single"
          ? "Davranış kaydı başarıyla kaydedildi."
          : `${targets.length} öğrenci için davranış kaydı başarıyla kaydedildi.`,
      );
      setQuery("");
      setBulkQuery("");
      setSelectedStudent(null);
      setSelectedStudents([]);
      setBehavior(null);
    } catch (reason: any) {
      setMessage(reason?.message || "Kayıt tamamlanamadı.");
    } finally {
      setSaving(false);
    }
  };

  const loadHomework = React.useCallback(
    async (classroom: string) => {
      if (!classroom) return;
      setHomeworkBusy(true);
      setHomeworkMessage("");
      try {
        const result = await requestJson<{
          session: HomeworkSession | null;
          evaluations?: Record<string, HomeworkStatus>;
        }>(
          `/api/behavior/teacher-links/${encodeURIComponent(
            token,
          )}/homework?classroom=${encodeURIComponent(
            classroom,
          )}&date=${encodeURIComponent(today())}&courseName=${encodeURIComponent(selectedHomeworkCourse)}`,
        );
        setHomeworkSession(result.session || null);
        setHomeworkResults(result.evaluations || {});
        setHomeworkTopicDraft(result.session?.topic || "");
        const savedReminder = result.session?.reminderDate
          ? selectedHomeworkAssignment?.nextOccurrences.find((item) => item.date === result.session?.reminderDate) || null
          : null;
        setSelectedReminder(savedReminder);
        setShowTopicEditor(!result.session);
      } catch (reason: any) {
        setHomeworkSession(null);
        setHomeworkResults({});
        setHomeworkTopicDraft("");
        setShowTopicEditor(true);
        setHomeworkMessage(
          reason?.message || "Ödev bilgileri yüklenemedi.",
        );
      } finally {
        setHomeworkBusy(false);
      }
    },
    [token, selectedHomeworkCourse, selectedHomeworkAssignment],
  );

  const loadHomeworkAssignments = React.useCallback(async (silent = false) => {
    if (!token) return;

    const cached = readHomeworkAssignmentCache(token);
    if (cached.length > 0) setHomeworkAssignments(cached);
    if (!silent && cached.length === 0) setHomeworkAssignmentsBusy(true);

    try {
      // Ana kaynak yönetici tarafında kaydedilen gerçek sınıf/ders atamasıdır.
      // Ders programı henüz üretilmemiş olsa bile öğretmenin sınıfları görünür.
      const assignmentResult = await requestJson<{ assignments?: HomeworkAssignment[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/assignments`,
        { method: "GET" },
        15000,
      );
      const assignedRows = Array.isArray(assignmentResult.assignments)
        ? assignmentResult.assignments
        : [];

      const merged = new Map<string, HomeworkAssignment>();
      for (const row of assignedRows) {
        const classroom = String(row?.classroom || "").trim();
        const courseName = String(row?.courseName || "").trim();
        if (!classroom || !courseName) continue;
        merged.set(homeworkAssignmentKey(classroom, courseName), {
          ...row,
          classroom,
          courseName,
          slots: Array.isArray(row.slots) ? row.slots : [],
          nextOccurrences: Array.isArray(row.nextOccurrences) ? row.nextOccurrences : [],
        });
      }

      // Program sadece gün/saat bilgisini tamamlar. Program endpointi başarısız
      // olsa bile yönetici tarafından atanmış sınıf ve ders kartlarını silme.
      try {
        const scheduleResult = await requestJson<HomeworkScheduleResponse>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/schedule`,
          { method: "GET" },
          15000,
        );
        for (const row of homeworkAssignmentsFromSchedule(scheduleResult)) {
          const key = homeworkAssignmentKey(row.classroom, row.courseName);
          const current = merged.get(key);
          merged.set(key, current
            ? {
                ...current,
                classroomId: current.classroomId || row.classroomId,
                slots: row.slots.length ? row.slots : current.slots,
                nextOccurrences: row.nextOccurrences.length ? row.nextOccurrences : current.nextOccurrences,
              }
            : row);
        }
      } catch {
        // Sınıf/ders ataması ana kaynak olduğu için program hatası ödev ekranını kapatmaz.
      }

      const rows = [...merged.values()].sort((a, b) =>
        classroomSort(a.classroom, b.classroom) ||
        a.courseName.localeCompare(b.courseName, "tr-TR"),
      );
      setHomeworkAssignments(rows);
      writeHomeworkAssignmentCache(token, rows);
      if (!silent) {
        setHomeworkMessage(rows.length ? "" : "Size atanmış sınıf/ders bulunamadı.");
      }
    } catch (reason: any) {
      if (cached.length === 0 && !silent) {
        setHomeworkMessage(reason?.message || "Ders atamaları yüklenemedi.");
      }
    } finally {
      if (!silent) setHomeworkAssignmentsBusy(false);
    }
  }, [token]);

  // Öğretmen bağlantısı açılır açılmaz dersleri arka planda hazırla.
  // 4 saniyelik açılış ekranı sürerken bu istek tamamlandığı için Ödev Kontrolü
  // ekranı çoğu durumda hiç yükleniyor mesajı göstermeden hazır açılır.
  React.useEffect(() => {
    if (!link || !token) return;
    void loadHomeworkAssignments(true);
  }, [link, token, loadHomeworkAssignments]);

  React.useEffect(() => {
    if (screen === "homework" && !selectedClassroom && homeworkAssignments.length === 0) {
      void loadHomeworkAssignments(false);
    }
  }, [screen, selectedClassroom, homeworkAssignments.length, loadHomeworkAssignments]);


  const ensureHomeworkNotificationPermission = async () => {
    if (!("Notification" in window)) return "unsupported" as const;
    if (Notification.permission === "granted") return "granted" as const;
    if (Notification.permission === "denied") return "denied" as const;
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied" as const;
    }
  };

  const playHomeworkAlarm = React.useCallback(() => {
    if (!teacherNotificationSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.3);
      gain.connect(context.destination);
      [0, 0.32, 0.64].forEach((offset) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        oscillator.connect(gain);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.18);
      });
      window.setTimeout(() => void context.close(), 1800);
    } catch {}
  }, [teacherNotificationSoundEnabled]);

  const showHomeworkAlarm = React.useCallback(async (reminder: any) => {
    playHomeworkAlarm();
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]);
    void playEnstituNotificationSound();
    const title = "Ödev hatırlatma alarmı";
    const body = `${reminder.classroom || ""} ${reminder.courseName || ""} · ${reminder.topic || "Ödev kontrolü"}`.trim();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (registration?.showNotification) {
          await registration.showNotification(title, {
            body,
            tag: `homework-${reminder.id}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [250, 120, 250, 120, 500],
          } as NotificationOptions);
        } else {
          new Notification(title, { body, tag: `homework-${reminder.id}` });
        }
      }
    } catch {}
    window.alert(`${title}

${body}`);
  }, [playHomeworkAlarm]);

  React.useEffect(() => {
    if (!token) return;
    let active = true;
    const check = async () => {
      try {
        const result = await requestJson<{ reminders: any[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/reminders`,
        );
        if (!active || !Array.isArray(result.reminders)) return;
        for (const reminder of result.reminders) {
          await showHomeworkAlarm(reminder);
          await requestJson(
            `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/reminders/${encodeURIComponent(String(reminder.id))}/ack`,
            { method: "POST", body: JSON.stringify({}) },
          );
        }
      } catch {}
    };
    void check();
    const timer = window.setInterval(() => void check(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, showHomeworkAlarm]);


  const homeworkControlDate = React.useCallback((session: HomeworkSession) => {
    return String(session.controlDate || session.reminderDate || session.homeworkDate || "");
  }, []);

  const homeworkSessionRank = React.useCallback((session: HomeworkSession) => {
    if (session.completedAt) return 2;
    const controlDate = homeworkControlDate(session);
    if (controlDate && controlDate < today()) return 1;
    return 0;
  }, [homeworkControlDate]);

  const sortedHomeworkSessions = React.useMemo(() => {
    return [...homeworkSessions].sort((a, b) => {
      const rank = homeworkSessionRank(a) - homeworkSessionRank(b);
      if (rank) return rank;
      const ad = homeworkControlDate(a);
      const bd = homeworkControlDate(b);
      if (homeworkSessionRank(a) === 0) {
        return ad.localeCompare(bd) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      }
      return bd.localeCompare(ad) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }, [homeworkSessions, homeworkSessionRank, homeworkControlDate]);

  const classroomHomeworkGroups = React.useMemo(() => {
    const groups = new Map<string, { classroom: string; courses: string[] }>();
    for (const assignment of homeworkAssignments) {
      const classroom = String(assignment.classroom || "").trim();
      if (!classroom) continue;
      const current = groups.get(classroom) || { classroom, courses: [] };
      if (assignment.courseName && !current.courses.includes(assignment.courseName)) {
        current.courses.push(assignment.courseName);
      }
      groups.set(classroom, current);
    }
    return [...groups.values()].sort((a, b) => classroomSort(a.classroom, b.classroom));
  }, [homeworkAssignments]);

  const loadHomeworkOverview = React.useCallback(async (force = false) => {
    if (!token) return;

    if (!force && homeworkOverviewLoadedRef.current) return;
    if (!force && homeworkOverviewRequestRef.current) {
      await homeworkOverviewRequestRef.current;
      return;
    }

    const run = (async () => {
      setHomeworkOverviewBusy(true);
      try {
        const result = await requestJson<{ sessions?: HomeworkSession[] }>(
          `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/overview`,
          { method: "GET" },
        );
        setHomeworkOverviewSessions(
          Array.isArray(result.sessions) ? result.sessions : [],
        );
        homeworkOverviewLoadedRef.current = true;
      } catch (reason: any) {
        setHomeworkMessage(reason?.message || "Ödev bilgileri yüklenemedi.");
      } finally {
        setHomeworkOverviewBusy(false);
      }
    })();

    homeworkOverviewRequestRef.current = run;
    try {
      await run;
    } finally {
      if (homeworkOverviewRequestRef.current === run) {
        homeworkOverviewRequestRef.current = null;
      }
    }
  }, [token]);

  const loadHomeworkSessions = React.useCallback(async (classroom: string) => {
    if (!token || !classroom) return;
    setHomeworkSessionsBusy(true);
    setHomeworkMessage("");
    try {
      const result = await requestJson<{ sessions: HomeworkSession[] }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/sessions?classroom=${encodeURIComponent(classroom)}`,
      );
      setHomeworkSessions(Array.isArray(result.sessions) ? result.sessions : []);
    } catch (reason: any) {
      setHomeworkSessions([]);
      setHomeworkMessage(reason?.message || "Ödev geçmişi yüklenemedi.");
    } finally {
      setHomeworkSessionsBusy(false);
    }
  }, [token]);

  React.useEffect(() => {
    homeworkOverviewLoadedRef.current = false;
    homeworkOverviewRequestRef.current = null;
    setHomeworkOverviewSessions([]);
  }, [token]);

  React.useEffect(() => {
    if (!link || !token) return;
    void loadHomeworkOverview();
  }, [link, token, loadHomeworkOverview]);

  React.useEffect(() => {
    if (screen === "homework" && !homeworkOverviewLoadedRef.current) {
      void loadHomeworkOverview();
    }
  }, [screen, loadHomeworkOverview]);

  React.useEffect(() => {
    if (screen === "homework" && selectedClassroom) {
      setHomeworkHistoryMode("list");
      setHomeworkSession(null);
      setHomeworkResults({});
      void loadHomeworkSessions(selectedClassroom);
    }
  }, [screen, selectedClassroom, loadHomeworkSessions]);

  const openHomeworkSession = React.useCallback(async (session: HomeworkSession) => {
    if (!token) return;
    setHomeworkBusy(true);
    setHomeworkMessage("");
    try {
      const result = await requestJson<{ session: HomeworkSession; evaluations: Record<string, HomeworkStatus> }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/session/${encodeURIComponent(session.id)}`,
      );
      setHomeworkSession(result.session);
      setHomeworkResults(result.evaluations || {});
      setHomeworkTopicDraft(result.session.topic || "");
      setSelectedHomeworkCourse(result.session.courseName || "");
      setSelectedReminder(
        result.session.reminderDate
          ? {
              date: result.session.reminderDate,
              day: result.session.reminderDay || "",
              hour: Number(result.session.reminderHour || 0),
              start: result.session.reminderStartTime || "",
              end: "",
              reminderTime: result.session.reminderTime || "",
            }
          : null,
      );
      setShowTopicEditor(false);
      setHomeworkHistoryMode("detail");
    } catch (reason: any) {
      setHomeworkMessage(reason?.message || "Ödev kaydı açılamadı.");
    } finally {
      setHomeworkBusy(false);
    }
  }, [token]);

  const setHomeworkCompletion = React.useCallback(async (completed: boolean) => {
    if (!token || !homeworkSession) return;
    setHomeworkBusy(true);
    setHomeworkMessage("");
    try {
      const result = await requestJson<{ session: HomeworkSession }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework/${encodeURIComponent(homeworkSession.id)}/completion`,
        {
          method: "POST",
          body: JSON.stringify({ completed }),
        },
      );
      setHomeworkSession(result.session);
      await loadHomeworkSessions(selectedClassroom);
      setHomeworkMessage(
        completed
          ? "Ödev kontrolü tamamlandı. Kayıt listenin en altına taşındı."
          : "Kayıt yeniden düzenlemeye açıldı.",
      );
    } catch (reason: any) {
      setHomeworkMessage(reason?.message || "Ödev kontrol durumu güncellenemedi.");
    } finally {
      setHomeworkBusy(false);
    }
  }, [token, homeworkSession, loadHomeworkSessions, selectedClassroom]);

  const saveHomeworkTopic = async () => {
    const topic = homeworkTopicDraft.trim();
    if (!selectedClassroom || !selectedHomeworkCourse || !topic || !homeworkControlDateDraft) return;
    setHomeworkBusy(true);
    setHomeworkMessage("");
    try {
      const result = await requestJson<{ session: HomeworkSession }>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/homework`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: homeworkSession?.id || undefined,
            classroom: selectedClassroom,
            courseName: selectedHomeworkCourse,
            topic,
            date: today(),
            controlDate: homeworkControlDateDraft,
          }),
        },
      );
      setHomeworkSession(result.session);
      setHomeworkTopicDraft("");
      setHomeworkControlDateDraft(today());
      setShowTopicEditor(false);
      setHomeworkHistoryMode("list");
      setSelectedClassroom("");
      setSelectedHomeworkCourse("");
      setHomeworkMessage("Ödev kaydedildi.");
      await loadHomeworkOverview(true);
    } catch (reason: any) {
      setHomeworkMessage(reason?.message || "Ödev kaydedilemedi.");
    } finally {
      setHomeworkBusy(false);
    }
  };

  const saveHomeworkEvaluation = async (
    student: Student,
    status: HomeworkStatus,
  ) => {
    if (!homeworkSession) {
      setShowTopicEditor(true);
      setHomeworkMessage("Önce ödev konusunu kaydedin.");
      return;
    }

    const previous = homeworkResults[student.id];
    setHomeworkResults((current) => ({
      ...current,
      [student.id]: status,
    }));
    setHomeworkMessage("");

    try {
      await requestJson(
        `/api/behavior/teacher-links/${encodeURIComponent(
          token,
        )}/homework/${encodeURIComponent(
          homeworkSession.id,
        )}/evaluations`,
        {
          method: "POST",
          body: JSON.stringify({
            studentId: student.id,
            studentName: student.name,
            studentNumber: canonicalStudentNumber(student),
            status,
          }),
        },
      );
    } catch (reason: any) {
      setHomeworkResults((current) => {
        const next = { ...current };
        if (previous) next[student.id] = previous;
        else delete next[student.id];
        return next;
      });
      setHomeworkMessage(
        reason?.message || "Değerlendirme kaydedilemedi.",
      );
    }
  };


  const toggleTeacherNotificationSound = () => {
    const next = !teacherNotificationSoundEnabled;
    setTeacherNotificationSoundEnabled(next);
    try {
      localStorage.setItem(
        "enstitu-teacher-notification-sound",
        next ? "1" : "0",
      );
    } catch {}
  };

  const toggleTeacherClosedMessageNotification = async () => {
    const next = !teacherClosedMessageNotificationEnabled;

    setTeacherClosedMessageNotificationEnabled(next);
    try {
      localStorage.setItem("enstitu-teacher-closed-message-notification", next ? "1" : "0");
    } catch {}

    if (!next) {
      try {
        await disableWebPush({
          subscribeUrl: `/api/behavior/teacher-links/${encodeURIComponent(token)}/push/subscribe`,
        });
      } catch {}
      setTeacherNotificationInfo("Kapalıyken mesaj bildirimi kapalı.");
      return;
    }

    try {
      await enableWebPush({
        subscribeUrl: `/api/behavior/teacher-links/${encodeURIComponent(token)}/push/subscribe`,
        startUrl: window.location.href,
      });
      setTeacherNotificationInfo("Kapalıyken mesaj bildirimi açık. Yeni mesajlar telefon ekranına bildirim olarak gelir.");
    } catch (reason: any) {
      setTeacherClosedMessageNotificationEnabled(false);
      try { localStorage.setItem("enstitu-teacher-closed-message-notification", "0"); } catch {}
      setTeacherNotificationInfo(reason?.message || "Push bildirimi etkinleştirilemedi.");
    }
  };

  React.useEffect(() => {
    let requested = false;
    try { requested = localStorage.getItem("enstitu-teacher-closed-message-notification") === "1"; } catch {}
    if (!requested) return;
    void hasWebPushSubscription().then((active) => {
      setTeacherClosedMessageNotificationEnabled(active);
      if (!active) { try { localStorage.setItem("enstitu-teacher-closed-message-notification", "0"); } catch {} }
    });
  }, []);


  if (!link && error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <h1 className="text-lg font-black">Öğretmen bağlantısı açılamadı</h1>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
        </div>
      </main>
    );
  }

  const teacherInfoLessonStatus = React.useMemo(() => {
    const nowText = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(teacherInfoNow);

    const todayName = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      weekday: "long",
    }).format(teacherInfoNow);

    const toMinutes = (value: string) => {
      const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
    };

    const nowMinutes = toMinutes(nowText.slice(0, 5));
    const today = teacherInfoSchedule?.days?.find(
      (day) => normalize(day.day) === normalize(todayName),
    );
    const slots = Array.isArray(today?.slots) ? today!.slots : [];

    const current = slots.find((slot) => {
      const start = toMinutes(slot.start);
      const end = toMinutes(slot.end);
      return start >= 0 && end >= 0 && nowMinutes >= start && nowMinutes < end;
    });

    const remaining =
      current && toMinutes(current.end) >= 0
        ? Math.max(0, toMinutes(current.end) - nowMinutes)
        : null;

    return {
      nowText,
      lessonNumber: current?.hour ?? null,
      remaining,
    };
  }, [teacherInfoNow, teacherInfoSchedule]);

  if (screen === "announcements") {
    const isAdminAnnouncementView = isAdminStaffLike(serverStaffProfile || link);
    const formatAnnouncementDate = (value: string) => {
      if (!value) return "Tarih bilgisi yok";
      const direct = new Date(value);
      if (Number.isFinite(direct.getTime())) return direct.toLocaleDateString("tr-TR");
      const date = new Date(`${value}T12:00:00`);
      return Number.isFinite(date.getTime()) ? date.toLocaleDateString("tr-TR") : value;
    };
    const dismissedStaffIds = new Set(staffDismissedAnnouncementIds);
    const announcementCards = [
      ...staffExamAnnouncements.map((announcement) => ({ kind: "exam" as const, id: `exam:${announcement.id}`, announcement })),
      ...staffGeneralAnnouncements.filter((item) => !dismissedStaffIds.has(item.id)).map((item) => ({ kind: "general" as const, id: item.id, item })),
    ];
    const visibleAnnouncementCards = selectedStaffFeedId
      ? announcementCards.filter((entry) => entry.id === selectedStaffFeedId)
      : announcementCards;
    const visibleNewsItems = selectedStaffFeedId
      ? staffNewsItems.filter((item) => item.id === selectedStaffFeedId)
      : staffNewsItems;
    const handleSwipeStart = (event: React.TouchEvent) => {
      staffAnnouncementSwipeStartX.current = event.changedTouches[0]?.clientX ?? null;
    };
    const handleSwipeEnd = (event: React.TouchEvent) => {
      const startX = staffAnnouncementSwipeStartX.current;
      const endX = event.changedTouches[0]?.clientX ?? null;
      staffAnnouncementSwipeStartX.current = null;
      if (startX == null || endX == null) return;
      const delta = endX - startX;
      if (Math.abs(delta) < 45) return;
      setSelectedStaffFeedId("");
      if (delta < 0) setStaffAnnouncementTab("news");
      else setStaffAnnouncementTab("announcements");
    };
    return (
      <main
        className="min-h-screen cursor-grab p-3 text-slate-800 active:cursor-grabbing"
        style={{ background: "linear-gradient(180deg, #ecfeff 0%, #f8fafc 52%, #ffffff 100%)" }}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          staffAnnouncementSwipeStartX.current = event.clientX;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "mouse" || staffAnnouncementSwipeStartX.current == null) return;
          const delta = event.clientX - staffAnnouncementSwipeStartX.current;
          staffAnnouncementSwipeStartX.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          if (Math.abs(delta) < 45) return;
          setSelectedStaffFeedId("");
          if (delta < 0) setStaffAnnouncementTab("news");
          else setStaffAnnouncementTab("announcements");
        }}
        onPointerCancel={() => { staffAnnouncementSwipeStartX.current = null; }}
      >
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-cyan-200 bg-white shadow-xl">
          <header
            className="px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #0e7490 0%, #0284c7 55%, #4f46e5 100%)", color: "#ffffff" }}
          >
            <div className="flex items-center gap-3">
              <button type="button" onClick={goBackScreen} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-label="Ana ekrana dön">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100">e-Nstitü</span>
                <h1 className="text-lg font-black leading-tight" style={{ color: "#ffffff" }}>{staffAnnouncementTab === "announcements" ? "Duyurular" : "Haberler"}</h1>
              </div>
            </div>
          </header>


          <section className="space-y-2 p-3">
            {staffAnnouncementTab === "announcements" ? (
              <>
                {staffExamAnnouncementsError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{staffExamAnnouncementsError}</div> : null}
                {staffExamAnnouncementsLoading ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Duyurular yükleniyor…</div>
                ) : announcementCards.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-600">Duyuru bulunmuyor.</p>
                  </div>
                ) : visibleAnnouncementCards.map((entry) => {
                  const isOpen = selectedStaffFeedId === entry.id;
                  if (entry.kind === "general") {
                    const item = entry.item;
                    return (
                      <article key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onTouchStart={() => beginStaffAnnouncementLongPress(item)}
                          onTouchMove={cancelStaffAnnouncementLongPress}
                          onTouchEnd={cancelStaffAnnouncementLongPress}
                          onTouchCancel={cancelStaffAnnouncementLongPress}
                          onContextMenu={(event) => { event.preventDefault(); setStaffAnnouncementMenuItem(item); }}
                          onClick={() => {
                            if (staffAnnouncementLongPressTriggered.current) { staffAnnouncementLongPressTriggered.current = false; return; }
                            setSelectedStaffFeedId(isOpen ? "" : entry.id);
                          }}
                          className="w-full px-4 py-3 text-left"
                        >
                          <strong className="block text-sm font-black text-slate-900">{item.title || "Duyuru"}</strong>
                          <span className="mt-1 block text-[10px] font-bold text-slate-400">{formatAnnouncementDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                        </button>
                        {isOpen ? <div className="border-t border-slate-100 px-4 py-4 text-xs font-semibold leading-5 text-slate-700 whitespace-pre-wrap">{item.content || "Duyuru detayı bulunmuyor."}</div> : null}
                      </article>
                    );
                  }
                  const announcement = entry.announcement;
                  return (
                    <article key={entry.id} className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
                      <button type="button" onClick={() => setSelectedStaffFeedId(isOpen ? "" : entry.id)} className="w-full px-4 py-3 text-left">
                        <strong className="block text-sm font-black text-slate-900">Ortak sınav planı göreviniz</strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-400">{formatAnnouncementDate(announcement.examDate)} · {announcement.examTime || "-"}</span>
                      </button>
                      {isOpen ? (
                        <div className="space-y-3 border-t border-cyan-100 p-4 text-[11px] font-bold text-slate-700">
                          {isAdminAnnouncementView ? (
                            <>
                              <section className="rounded-2xl bg-slate-50 p-3">
                                <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Sınıf / Ders Sınavları</span>
                                <div className="mt-2 space-y-1.5">
                                  {announcement.exams.length ? announcement.exams.map((exam, index) => (
                                    <div key={`${exam.gradeLevel}-${exam.courseName}-${index}`} className="rounded-xl bg-white px-3 py-2">
                                      <strong className="text-slate-900">{exam.gradeLevel || "Sınıf"} · {exam.courseName || "Sınav"}</strong>
                                      <span className="mt-0.5 block text-[10px] text-slate-500">{(exam.classrooms || []).join(", ") || "Şube bilgisi yok"}</span>
                                    </div>
                                  )) : <p className="text-slate-400">Sınav bilgisi bulunamadı.</p>}
                                </div>
                              </section>
                              <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                                <span className="text-[9px] font-black uppercase tracking-wide text-indigo-400">Salon / Görevli Öğretmen</span>
                                <div className="mt-2 space-y-1.5">
                                  {announcement.roomAssignments.length ? announcement.roomAssignments.map((room, index) => (
                                    <div key={`${room.roomName}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                                      <div><strong className="block text-slate-900">{room.roomName || "Salon"}</strong><span className="text-[9px] text-slate-400">{[room.buildingName, room.floorName].filter(Boolean).join(" / ")}</span></div>
                                      <strong className="text-right text-indigo-700">{room.teacherName || "Belirlenmedi"}</strong>
                                    </div>
                                  )) : <p className="text-indigo-400">Salon görevi bulunamadı.</p>}
                                </div>
                              </section>
                            </>
                          ) : (
                            <>
                              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                <span className="block text-[9px] font-black uppercase tracking-wide text-emerald-500">Görev Yeriniz</span>
                                <strong className="mt-1 block text-sm text-emerald-900">{announcement.assignedRooms.join(", ") || "Belirlenmedi"}</strong>
                              </div>
                              <section className="rounded-2xl bg-slate-50 p-3">
                                <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Bu Oturumdaki Sınavlar</span>
                                <div className="mt-2 space-y-1.5">
                                  {announcement.exams.length ? announcement.exams.map((exam, index) => (
                                    <div key={`${exam.gradeLevel}-${exam.courseName}-${index}`} className="rounded-xl bg-white px-3 py-2">
                                      <strong className="text-slate-900">{exam.gradeLevel || "Sınıf"} · {exam.courseName || "Sınav"}</strong>
                                      <span className="mt-0.5 block text-[10px] text-slate-500">{(exam.classrooms || []).join(", ")}</span>
                                    </div>
                                  )) : <p className="text-slate-400">Sınav bilgisi bulunamadı.</p>}
                                </div>
                              </section>
                            </>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </>
            ) : (
              staffNewsItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <BookOpenText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-600">Haber bulunmuyor.</p>
                </div>
              ) : visibleNewsItems.map((item) => {
                const isOpen = selectedStaffFeedId === item.id;
                return (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setSelectedStaffFeedId(isOpen ? "" : item.id)} className="w-full px-4 py-3 text-left">
                      <strong className="block text-sm font-black text-slate-900">{item.title || "Haber"}</strong>
                      <span className="mt-1 block text-[10px] font-bold text-slate-400">{item.source ? `${item.source} · ` : ""}{formatAnnouncementDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                    </button>
                    {isOpen ? (
                      <div className="border-t border-indigo-100 px-4 py-4 text-xs font-semibold leading-5 text-slate-700">
                        {item.content ? <p className="whitespace-pre-wrap">{item.content}</p> : <p className="text-slate-500">Haberin ayrıntılarını kaynak sitesinden okuyabilirsiniz.</p>}
                        {item.url ? (
                          <button type="button" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700">Haberi Kaynağında Aç</button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>
          {staffAnnouncementMenuItem ? (
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/25 p-3" onClick={() => setStaffAnnouncementMenuItem(null)}>
              <div className="w-full max-w-xl rounded-3xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="px-2 pb-2">
                  <p className="truncate text-xs font-black text-slate-700">{staffAnnouncementMenuItem.title || "Duyuru"}</p>
                </div>
                <button type="button" onClick={() => dismissStaffAnnouncement(staffAnnouncementMenuItem)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-5 w-5" />
                  Duyuruyu kaldır
                </button>
                <button type="button" onClick={() => setStaffAnnouncementMenuItem(null)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50">İptal</button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (screen === "school-radio") {
    const radioRoleProbe = [
      serverStaffProfile?.role, serverStaffProfile?.staffRole, serverStaffProfile?.position,
      (link as any)?.role, (link as any)?.staffRole, (link as any)?.position, (link as any)?.title,
    ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    const canManageRadio = String(serverStaffProfile?.role || serverStaffProfile?.staffRole || "").toUpperCase() === "ADMIN"
      || /müdür|mudur|principal|vice[_ -]?principal|deputy[_ -]?principal|assistant[_ -]?principal|school[_ -]?admin|admin|administrator/.test(radioRoleProbe);
    return <SchoolRadioView onBack={goBackScreen} adminToken={token} canManage={canManageRadio} />;
  }

  if (screen === "trial-club") {
    return <TrialClubView onBack={goBackScreen} token={token} mode="staff" />;
  }

  if (screen === "survey") {
    return <MobileSurveyView onBack={goBackScreen} apiBase={`/api/behavior/teacher-links/${encodeURIComponent(token)}`} />;
  }


  if (screen === "home") {
    const teacherName = String(link?.teacherName || "Öğretmen").trim();
    const teacherNameParts = teacherName.split(/\s+/).filter(Boolean);
    const teacherInitials = teacherNameParts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    const teacherPhoto = String(
      (serverStaffProfile as any)?.teacherPhotoUrl ||
      (serverStaffProfile as any)?.avatar ||
      (link as any)?.teacherPhotoUrl ||
      (link as any)?.photoUrl ||
      (link as any)?.photo ||
      "",
    ).trim();

    const teacherBranch = String(
      (link as any)?.branch ||
      (link as any)?.branchName ||
      (link as any)?.subjectName ||
      teacherExamResults.assignedSubjects?.[0]?.courseName ||
      homeworkAssignments?.[0]?.courseName ||
      "Branş bilgisi",
    ).trim();

    type StaffRole = "ADMIN" | "GUIDANCE" | "TEACHER";
    const serverRole = String(
      serverStaffProfile?.role ||
      serverStaffProfile?.staffRole ||
      "",
    ).trim().toUpperCase();

    const roleProbe = [
      serverStaffProfile?.role,
      serverStaffProfile?.staffRole,
      serverStaffProfile?.position,
      (link as any)?.role,
      (link as any)?.staffRole,
      (link as any)?.userRole,
      (link as any)?.position,
      (link as any)?.title,
      teacherBranch,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");

    const staffRole: StaffRole =
      serverRole === "ADMIN"
        ? "ADMIN"
        : serverRole === "GUIDANCE"
          ? "GUIDANCE"
          : serverRole === "TEACHER"
            ? "TEACHER"
            : /müdür|mudur|principal|vice[_ -]?principal|deputy[_ -]?principal|assistant[_ -]?principal|school[_ -]?admin|admin|administrator/.test(roleProbe)
              ? "ADMIN"
              : /rehber|pdr|psikolojik|guidance|counsel/.test(roleProbe)
                ? "GUIDANCE"
                : "TEACHER";

    const explicitPosition = String(
      serverStaffProfile?.position ||
      (link as any)?.position ||
      (link as any)?.title ||
      "",
    ).trim();
    const staffRoleLabel =
      staffRole === "ADMIN"
        ? (explicitPosition || "Okul Yöneticisi")
        : staffRole === "GUIDANCE"
          ? (explicitPosition || "Rehberlik / PDR")
          : teacherBranch;

    const teacherModules = [
      {
        key: "behavior",
        label: "Davranış Kaydı",
        description: "Öğrenci davranışlarını kaydet",
        icon: Heart,
        border: "border-orange-300",
        panel: "from-orange-50 to-white",
        iconBg: "from-orange-400 to-amber-500",
        onClick: () => goToScreen("behavior"),
      },
      {
        key: "homework",
        label: "Ödev Kontrolü",
        description: "Ödev ve kontrol işlemleri",
        icon: BookOpenCheck,
        border: "border-emerald-300",
        panel: "from-emerald-50 to-white",
        iconBg: "from-emerald-400 to-teal-500",
        onClick: () => {
          setSelectedClassroom("");
          setHomeworkFilter("all");
          goToScreen("homework");
        },
      },
      {
        key: "questions",
        label: "Soru İşlemleri",
        description: "Test ve soru görevleri",
        icon: ClipboardCheck,
        border: "border-amber-300",
        panel: "from-amber-50 to-white",
        iconBg: "from-amber-400 to-orange-500",
        onClick: () => goToScreen("questions"),
      },
      {
        key: "schedule",
        label: "Ders Programı",
        description: "Günlük ve haftalık program",
        icon: CalendarDays,
        border: "border-indigo-300",
        panel: "from-indigo-50 to-white",
        iconBg: "from-indigo-400 to-violet-500",
        onClick: () => goToScreen("schedule"),
      },
      {
        key: "exam-results",
        label: "Sınav Sonuçları",
        description: "Sıralama ve analizler",
        icon: BarChart3,
        border: "border-cyan-300",
        panel: "from-cyan-50 to-white",
        iconBg: "from-cyan-400 to-sky-500",
        onClick: () => {
          setExamResultsView("exam-list");
          goToScreen("exam-results");
        },
      },
      {
        key: "messages",
        label: "Mesajlar",
        description: "Veli bilgilendirme merkezi",
        icon: MessageCircleMore,
        border: "border-pink-300",
        panel: "from-pink-50 to-white",
        iconBg: "from-pink-400 to-rose-500",
        onClick: () => goToScreen("messages"),
      },
      {
        key: "activities",
        label: "Mentör",
        description: "Yakında kullanıma açılacak",
        icon: Trophy,
        border: "border-amber-200",
        panel: "from-amber-50 to-white",
        iconBg: "from-amber-300 to-orange-400",
        disabled: true,
      },
      {
        key: "resources",
        label: "Veli Bilgilendirme",
        description: "Yakında kullanıma açılacak",
        icon: Users,
        border: "border-sky-200",
        panel: "from-sky-50 to-white",
        iconBg: "from-sky-400 to-blue-500",
        disabled: true,
      },
      {
        key: "tasks",
        label: "Devamsızlık",
        description: "Yakında kullanıma açılacak",
        icon: CalendarClock,
        border: "border-emerald-200",
        panel: "from-emerald-50 to-white",
        iconBg: "from-emerald-400 to-green-500",
        disabled: true,
      },
      {
        key: "boarding",
        label: "Pansiyon",
        description: "Yakında kullanıma açılacak",
        icon: Building2,
        border: "border-rose-200",
        panel: "from-rose-50 to-white",
        iconBg: "from-rose-400 to-red-500",
        disabled: true,
      },
      {
        key: "students-center",
        label: "Öğrenciler",
        description: "Sorumlu olunan sınıfların öğrenci dosyaları",
        icon: Users,
        border: "border-cyan-300",
        panel: "from-cyan-50 to-white",
        iconBg: "from-cyan-500 to-sky-600",
        onClick: () => goToScreen("guidance-students"),
      },
      {
        key: "sok",
        label: "Müfredat Bilgisi",
        description: "Biten konu ve bitiş tarihini kaydet",
        icon: ClipboardList,
        border: "border-violet-200",
        panel: "from-violet-50 to-white",
        iconBg: "from-violet-400 to-purple-500",
        onClick: () => goToScreen("curriculum-info"),
      },
    ];

    const adminModules = [
      { key: "admin-programs", label: "DERS PROĞRAMI", description: "Öğretmen ve sınıf haftalık programları", icon: CalendarRange, border: "border-indigo-300", panel: "from-indigo-50 to-white", iconBg: "from-indigo-500 to-violet-600", onClick: () => goToScreen("admin-programs") },
      { key: "admin-behavior", label: "DAVRANIŞ", description: "Davranış sıralama, filtre ve istatistikler", icon: ShieldCheck, border: "border-rose-300", panel: "from-rose-50 to-white", iconBg: "from-rose-500 to-red-600", onClick: () => goToScreen("admin-behavior") },
      { key: "admin-exams", label: "BAŞARI TAKİBİ", description: "Deneme sınavları ve gelişim raporları", icon: BarChart3, border: "border-cyan-300", panel: "from-cyan-50 to-white", iconBg: "from-cyan-500 to-sky-600", onClick: () => goToScreen("admin-exams") },
      { key: "admin-study-plans", label: "ÇALIŞMA PLANI", description: "7 günlük kişisel çalışma planlarını hazırla", icon: ListChecks, border: "border-indigo-300", panel: "from-indigo-50 to-white", iconBg: "from-indigo-500 to-violet-600", onClick: () => goToScreen("admin-study-plans") },
      { key: "admin-messages", label: "Mesajlar", description: "Personel, veli ve öğrenci iletişimi", icon: MessagesSquare, border: "border-pink-300", panel: "from-pink-50 to-white", iconBg: "from-pink-500 to-rose-600", onClick: () => goToScreen("messages") },
      { key: "admin-students", label: "Öğrenciler", description: "Öğrenci dosyaları, davranış ve sınav gelişimi", icon: GraduationCap, border: "border-blue-300", panel: "from-blue-50 to-white", iconBg: "from-blue-500 to-indigo-600", onClick: () => goToScreen("guidance-students") },
      { key: "admin-boarding", label: "Pansiyon", description: "Pansiyon yönetim işlemleri", icon: BedDouble, border: "border-orange-300", panel: "from-orange-50 to-white", iconBg: "from-orange-500 to-red-500", disabled: true },
      { key: "admin-reports", label: "ÇALIŞMA TAKVİMİ", description: "Yönetici rapor merkezi", icon: CalendarClock, border: "border-slate-300", panel: "from-slate-50 to-white", iconBg: "from-slate-600 to-slate-800", disabled: true },
      { key: "admin-guidance", label: "Rehberlik", description: "Risk ve rehberlik izlemleri", icon: HeartHandshake, border: "border-teal-300", panel: "from-teal-50 to-white", iconBg: "from-teal-500 to-emerald-600", disabled: true },
      { key: "admin-parent-approvals", label: "VELİ ONAYI", description: "Veli izin ve onay işlemleri", icon: BadgeCheck, border: "border-violet-300", panel: "from-violet-50 to-white", iconBg: "from-violet-500 to-purple-600", onClick: () => goToScreen("admin-parent-approvals") },
      { key: "admin-tasks", label: "Randevu Sistemi", description: "MEB okul randevu sistemine git", icon: ExternalLink, border: "border-lime-300", panel: "from-lime-50 to-white", iconBg: "from-lime-500 to-green-600", onClick: () => { window.location.href = "https://okulrandevu.meb.gov.tr/"; } },
      { key: "admin-yearbook", label: "YILLIK", description: "Öğrenci yıllık düşünceleri ve anketleri", icon: BookOpenText, border: "border-amber-300", panel: "from-amber-50 to-white", iconBg: "from-amber-500 to-orange-600", onClick: () => goToScreen("admin-yearbook") },
    ];

    const guidanceModules = [
      { key: "guidance-students", label: "Öğrenciler", description: "Öğrenci rehberlik dosyaları", icon: Users, border: "border-cyan-300", panel: "from-cyan-50 to-white", iconBg: "from-cyan-500 to-sky-600", onClick: () => goToScreen("guidance-students") },
      { key: "guidance-interviews", label: "Görüşmeler", description: "Öğrenci ve veli görüşmeleri", icon: MessageCircle, border: "border-violet-300", panel: "from-violet-50 to-white", iconBg: "from-violet-500 to-purple-600", disabled: true },
      { key: "guidance-risk", label: "Risk Takibi", description: "Riskli öğrenciler ve izleme", icon: Heart, border: "border-rose-300", panel: "from-rose-50 to-white", iconBg: "from-rose-500 to-red-600", disabled: true },
      { key: "guidance-behavior", label: "Davranış Takibi", description: "Davranış kayıtlarını incele", icon: ClipboardCheck, border: "border-orange-300", panel: "from-orange-50 to-white", iconBg: "from-orange-500 to-amber-600", onClick: () => goToScreen("behavior") },
      { key: "guidance-attendance", label: "Devamsızlık", description: "Devamsızlık risklerini izle", icon: CalendarClock, border: "border-emerald-300", panel: "from-emerald-50 to-white", iconBg: "from-emerald-500 to-teal-600", disabled: true },
      { key: "guidance-messages", label: "Mesajlar", description: "Veli ve öğrenci iletişimi", icon: MessageCircleMore, border: "border-pink-300", panel: "from-pink-50 to-white", iconBg: "from-pink-500 to-rose-600", onClick: () => goToScreen("messages") },
      { key: "guidance-analysis", label: "Sınav Analizi", description: "Akademik risk ve gelişim", icon: BarChart3, border: "border-blue-300", panel: "from-blue-50 to-white", iconBg: "from-blue-500 to-indigo-600", onClick: () => { setExamResultsView("exam-list"); goToScreen("exam-results"); } },
      { key: "guidance-classrooms", label: "Sınıf Analizleri", description: "Şube bazlı rehberlik görünümü", icon: Building2, border: "border-indigo-300", panel: "from-indigo-50 to-white", iconBg: "from-indigo-500 to-violet-600", disabled: true },
      { key: "guidance-parents", label: "Veli Görüşmeleri", description: "Veli iletişim ve takip kayıtları", icon: UserPlus, border: "border-amber-300", panel: "from-amber-50 to-white", iconBg: "from-amber-500 to-orange-600", disabled: true },
      { key: "guidance-referrals", label: "Yönlendirmeler", description: "RAM ve kurum yönlendirmeleri", icon: Share2, border: "border-teal-300", panel: "from-teal-50 to-white", iconBg: "from-teal-500 to-emerald-600", disabled: true },
      { key: "guidance-sok", label: "ŞÖK", description: "ŞÖK rehberlik hazırlıkları", icon: ClipboardList, border: "border-fuchsia-300", panel: "from-fuchsia-50 to-white", iconBg: "from-fuchsia-500 to-purple-600", disabled: true },
      { key: "guidance-schedule", label: "Ders Programı", description: "Günlük ve haftalık program", icon: CalendarDays, border: "border-slate-300", panel: "from-slate-50 to-white", iconBg: "from-slate-500 to-slate-700", onClick: () => goToScreen("schedule") },
    ];

    const homeModules = staffRole === "ADMIN" ? adminModules : staffRole === "GUIDANCE" ? guidanceModules : teacherModules;
    const homeModuleSlots = [
      ...homeModules,
      ...Array.from({ length: Math.max(0, 20 - homeModules.length) }, (_, index) => {
        const label = ["ANKET", "HABERLER VE DUYURULAR", "OKUL RADYOSU", "DENEME KULÜBÜ"][index] || "YENİ MODÜL";
        const isSurvey = label === "ANKET";
        const isAnnouncements = label === "HABERLER VE DUYURULAR";
        const isRadio = label === "OKUL RADYOSU";
        const isTrialClub = label === "DENEME KULÜBÜ";
        return {
          key: isSurvey ? "survey" : isAnnouncements ? "announcements" : isRadio ? "school-radio" : isTrialClub ? "trial-club" : `reserved-module-${index + 1}`,
          label,
          description: isSurvey ? "Size tanımlanan anketleri görüntüle ve yanıtla" : isAnnouncements ? "Ortak sınav planı ve görev duyuruları" : isRadio ? "Canlı yayın, program akışı ve podcastler" : isTrialClub ? "Deneme tarihleri, içerikler ve hedef netler" : "Yeni modül için ayrılan alan",
          icon: isSurvey ? ClipboardCheck : isAnnouncements ? Bell : isRadio ? Radio : isTrialClub ? Trophy : Settings,
          disabled: !isSurvey && !isAnnouncements && !isRadio && !isTrialClub,
          onClick: isSurvey ? () => goToScreen("survey") : isAnnouncements ? () => { setStaffAnnouncementTab("announcements"); setSelectedStaffFeedId(""); void loadStaffExamAnnouncements(); goToScreen("announcements"); } : isRadio ? () => goToScreen("school-radio") : isTrialClub ? () => goToScreen("trial-club") : undefined,
        };
      }),
    ].slice(0, 20);

    return (
      <main className="h-[100dvh] overflow-hidden bg-gradient-to-b from-[#f7f9ff] via-white to-[#f3f6fb] p-1.5 text-slate-800">
        {adminPhoneSplashVisible ? (
          <div className={`admin-phone-splash ${staffRole === "ADMIN" ? "is-admin" : "is-teacher"}`} aria-label={`e-Nstitü ${staffRole === "ADMIN" ? "yönetici" : "öğretmen"} açılış ekranı`}>
            <div className="admin-phone-splash-card">
              <div className="admin-phone-splash-photo">
                <img src={staffRole === "ADMIN" ? adminPhoneSplashPhoto : teacherPhoneSplashPhoto} alt="" />
              </div>

              <section className="admin-phone-splash-panel">
                <div className="admin-phone-splash-wave admin-phone-splash-wave-a" />
                <div className="admin-phone-splash-wave admin-phone-splash-wave-b" />
                <div className="admin-phone-splash-wave admin-phone-splash-wave-c" />
                <div className="admin-phone-splash-wave-logo">
                  <img src={enstituSplashLogo} alt="" />
                  <span>e-Nstitü</span>
                </div>
                <div className="admin-phone-splash-role">{staffRole === "ADMIN" ? "YÖNETİCİ" : "ÖĞRETMEN"}</div>
                <div className="admin-phone-splash-rule" />
                <div className="admin-phone-splash-greeting">Sayın {teacherName},<br />iyi çalışmalar{staffRole === "ADMIN" ? "." : " dileriz."}</div>
                <div className="admin-phone-splash-subtitle">{staffRole === "ADMIN" ? "Okulunuzun tüm süreçleri burada." : "Geleceği birlikte inşa ediyoruz."}</div>
                <div className="admin-phone-splash-progress"><span /></div>
                <div className="admin-phone-splash-loading">Uygulama hazırlanıyor...</div>
                <div className="admin-phone-splash-school">
                  <img src={schoolLogo} alt="Ordu Lisesi" />
                  <div><strong>Ordu Lisesi</strong><span>Ordu'nun taa kendisi</span></div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex h-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(30,41,59,0.12)]">
          <header className="relative shrink-0 bg-white px-3 pb-3 pt-4">
            <div className="relative mx-auto max-w-[520px] px-1 pb-1 pt-1">
              <MobileIdentityBanner
                fullName={teacherName}
                roleLabel={staffRoleLabel}
                schoolName="Ordu Lisesi"
                schoolLogoSrc={schoolLogo}
                photoSrc={teacherPhoto}
                fallbackText={teacherInitials || (staffRole === "ADMIN" ? "YN" : "ÖĞ")}
                tone={staffRole === "ADMIN" ? "admin" : "teacher"}
                onClick={() => setTeacherSettingsOpen(true)}
              />
            </div>
          </header>
          <section className="flex min-h-0 flex-1 flex-col p-2.5">
            {error ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-[10px] font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-x-1.5 gap-y-1.5 px-0.5 pb-0.5 pt-1">
              {homeModuleSlots.map((module, moduleIndex) => {
                const Icon = module.icon;
                const disabled = Boolean(module.disabled);

                return (
                  <EduPanelMobileButton
                    key={module.key}
                    title={module.label}
                    description={module.description}
                    icon={Icon}
                    accentIndex={moduleIndex}
                    disabled={disabled}
                    onClick={module.onClick}
                    badge={
                      String(module.key || "").includes("messages") && teacherUnreadMessageCount > 0 ? (
                        <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[8px] font-black text-white shadow-sm">
                          {teacherUnreadMessageCount > 99 ? "99+" : teacherUnreadMessageCount}
                        </span>
                      ) : String(module.key || "") === "announcements" && staffExamAnnouncements.length > 0 ? (
                        <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-cyan-600 px-1 text-[8px] font-black text-white shadow-sm">
                          {staffExamAnnouncements.length > 99 ? "99+" : staffExamAnnouncements.length}
                        </span>
                      ) : disabled ? (
                        <span className="rounded-full border border-white bg-white/95 px-1.5 py-0.5 text-[6px] font-black text-orange-600 shadow-sm">
                          YENİ
                        </span>
                      ) : null
                    }
                    variant="speech"
                    compact
                    microMotion
                    motionDelayMs={-(moduleIndex % 7) * 430}
                  />
                );
              })}
            </div>

                        <div className="mt-1 shrink-0 overflow-hidden rounded-[14px] border border-orange-100 bg-gradient-to-r from-[#fff7ed] via-white to-[#fffaf0] px-2 py-1 shadow-[0_6px_16px_rgba(234,88,12,0.05)]">
              <div className="grid min-h-[44px] grid-cols-3 items-center gap-1.5">
                <div className="rounded-xl bg-white/90 px-2 py-1 text-center shadow-sm">
                  <span className="block text-[6.5px] font-black uppercase tracking-[0.08em] text-slate-400">
                    Kaçıncı Ders
                  </span>
                  <strong className="mt-0.5 block text-[11px] font-black leading-none text-orange-700">
                    {teacherInfoLessonStatus.lessonNumber
                      ? `${teacherInfoLessonStatus.lessonNumber}. Ders`
                      : "Ders Yok"}
                  </strong>
                </div>

                <div className="rounded-xl bg-white/90 px-2 py-1 text-center shadow-sm">
                  <span className="block text-[6.5px] font-black uppercase tracking-[0.08em] text-slate-400">
                    Bitmesine
                  </span>
                  <strong className="mt-0.5 block text-[11px] font-black leading-none text-emerald-700">
                    {teacherInfoLessonStatus.remaining != null
                      ? `${teacherInfoLessonStatus.remaining} dk`
                      : "—"}
                  </strong>
                </div>

                <div className="rounded-xl bg-slate-900 px-2 py-1 text-center shadow-sm">
                  <span className="block text-[6.5px] font-black uppercase tracking-[0.08em] text-white/55">
                    Saat
                  </span>
                  <strong className="mt-0.5 block text-[12px] font-black leading-none text-white">
                    {teacherInfoLessonStatus.nowText}
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        {startupReminderOpen ? (
          <div
            className="fixed inset-0 z-[110000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={() => setStartupReminderOpen(false)}
          >
            <section
              className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">
                    e-Nstitü
                  </span>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    Günün Hatırlatmaları
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setStartupReminderOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                  aria-label="Hatırlatmaları kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[68vh] overflow-y-auto p-4">
                {startupReminderBusy ? (
                  <div className="rounded-2xl bg-orange-50 p-6 text-center text-xs font-black text-orange-700">
                    Hatırlatmalar hazırlanıyor…
                  </div>
                ) : startupReminders.length ? (
                  <div className="space-y-2.5">
                    {startupReminders.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void openTeacherReminderAction(item)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            item.type === "duty" ? "bg-amber-100 text-amber-700" :
                            item.type === "homework" ? "bg-emerald-100 text-emerald-700" :
                            item.type === "exam" ? "bg-indigo-100 text-indigo-700" :
                            item.type === "result" ? "bg-cyan-100 text-cyan-700" :
                            item.type === "message" ? "bg-violet-100 text-violet-700" :
                            item.type === "question" ? "bg-fuchsia-100 text-fuchsia-700" :
                            item.type === "study-plan" ? "bg-indigo-100 text-indigo-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {item.type === "homework" ? <BookOpenCheck className="h-4 w-4" /> :
                             item.type === "exam" || item.type === "result" ? <BarChart3 className="h-4 w-4" /> :
                             item.type === "message" ? <MessageCircleMore className="h-4 w-4" /> :
                             item.type === "question" ? <ClipboardCheck className="h-4 w-4" /> :
                             item.type === "study-plan" ? <CalendarDays className="h-4 w-4" /> :
                             item.type === "duty" ? <BellRing className="h-4 w-4" /> :
                             <CalendarClock className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block text-xs font-black text-slate-900">
                              {item.title}
                            </strong>
                            <span className="mt-1 block text-[10px] font-semibold leading-4 text-slate-500">
                              {item.body}
                            </span>
                          </span>
                          {item.action ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" /> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <strong className="mt-2 block text-sm text-slate-700">
                      Bugün için yeni hatırlatma yok.
                    </strong>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {teacherSettingsOpen ? (
          <div
            className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
            onClick={() => setTeacherSettingsOpen(false)}
          >
            <section
              className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">
                    e-Nstitü Öğretmen
                  </span>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    Ayarlar
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setTeacherSettingsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                  aria-label="Ayarları kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {staffRole === "ADMIN" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSettingsOpen(false);
                      goToScreen("admin-staff-roles");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
                      <Settings className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[12px] font-black text-slate-900">
                        Personel Rolleri
                      </strong>
                      <span className="mt-0.5 block text-[9px] font-bold leading-4 text-slate-500">
                        Öğretmen, rehber öğretmen ve yönetici rollerini düzenle.
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-violet-500" />
                  </button>
                ) : null}

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    teacherNotificationSoundEnabled
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {teacherNotificationSoundEnabled ? (
                      <BellRing className="h-5 w-5" />
                    ) : (
                      <BellOff className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[12px] font-black text-slate-900">
                      Bildirim Sesi
                    </strong>
                    <span className="mt-0.5 block text-[9px] font-bold leading-4 text-slate-500">
                      Öğretmen uygulamasındaki uyarı ve hatırlatmalarda ses kullan.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTeacherNotificationSound}
                    className={`min-w-[58px] rounded-full px-3 py-2 text-[9px] font-black ${
                      teacherNotificationSoundEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {teacherNotificationSoundEnabled ? "AÇIK" : "KAPALI"}
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    teacherClosedMessageNotificationEnabled
                      ? "bg-violet-100 text-violet-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    <Bell className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[12px] font-black text-slate-900">
                      Kapalıyken Mesaj Bildirimi
                    </strong>
                    <span className="mt-0.5 block text-[9px] font-bold leading-4 text-slate-500">
                      Uygulama kapalıyken yeni mesajları telefon ekranına getir.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleTeacherClosedMessageNotification()}
                    className={`min-w-[58px] rounded-full px-3 py-2 text-[9px] font-black ${
                      teacherClosedMessageNotificationEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {teacherClosedMessageNotificationEnabled ? "AÇIK" : "KAPALI"}
                  </button>
                </div>

                {teacherNotificationInfo ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold text-slate-500">
                    {teacherNotificationInfo}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {showInstallGuide && !teacherAppInstalled && (
          <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
            <section className="max-h-[92vh] w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-orange-700">
                    TEK DOKUNUŞLU KURULUM
                  </span>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    e-Nstitü Öğretmen’i Telefona Kur
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  aria-label="Kurulum açıklamasını kapat"
                  className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-100 text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 flex items-center gap-4 border border-slate-200 bg-slate-50 p-3">
                <img
                  src="/enstitu-family-192.png?v=4"
                  alt="e-Nstitü Öğretmen uygulama butonu"
                  className="h-16 w-16 object-contain"
                />
                <div>
                  <strong className="block text-sm text-slate-900">e-Nstitü Öğretmen</strong>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                    Ana ekranda bu logolu bir uygulama butonu oluşacak.
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {(isIos
                  ? [
                      "Safari'nin altındaki Paylaş düğmesine dokunun.",
                      "Açılan listeden Ana Ekrana Ekle seçeneğini seçin.",
                      "Sağ üstteki Ekle düğmesine dokunun.",
                    ]
                  : installPromptReady
                    ? [
                        "Aşağıdaki Ana Ekrana Ekle düğmesine dokunun.",
                        "Telefonun açtığı pencerede Yükle seçeneğini onaylayın.",
                        "Ana ekrandaki e-Nstitü Öğretmen butonundan uygulamaya girin.",
                      ]
                    : [
                        "TELEFONUMA KUR düğmesi görünmüyorsa Chrome menüsünü açın.",
                        "Uygulamayı yükle veya Ana ekrana ekle seçeneğini seçin.",
                        "Uygulama daha önce kurulmuş ama simgesi kaldırılmışsa yine bu ekrandan yeniden ana ekrana ekleyin.",
                      ]
                ).map((step, index) => (
                  <div key={step} className="flex items-start gap-3 border border-slate-200 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-teal-700 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-xs font-bold leading-5 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>

              {installPromptReady ? (
                <button
                  type="button"
                  onClick={installTeacherApp}
                  disabled={installBusy}
                  className="mt-5 flex w-full items-center justify-center gap-2 bg-teal-700 px-4 py-4 text-sm font-black text-white shadow-lg disabled:bg-slate-400"
                >
                  <Download className="h-5 w-5" />
                  {installBusy ? "Kurulum açılıyor…" : "TELEFONUMA KUR"}
                </button>
              ) : (
                <div className="mt-5 border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-900">
                  <div className="flex items-start gap-2">
                    {isIos ? <Share2 className="mt-0.5 h-4 w-4 shrink-0" /> : <MoreVertical className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>
                      {isIos
                        ? "Kurulumu Safari'nin Paylaş menüsünden tamamlayın."
                        : "Kurulum düğmesi görünmüyorsa Chrome'un üç nokta menüsünü kullanın."}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    );
  }

  if (screen === "questions") {
    if (!link) {
      return (
        <main className="min-h-screen bg-gradient-to-b from-amber-50/70 via-orange-50/30 to-white p-3 text-slate-900 sm:p-5">
          <div className="mx-auto max-w-xl rounded-[28px] border border-amber-200 bg-white p-6 text-center shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
            <h1 className="text-base font-black text-slate-900">
              Soru İşlemleri hazırlanıyor
            </h1>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Öğretmen bilgileri henüz yüklenmedi. Birkaç saniye sonra yeniden deneyin.
            </p>
            <button
              type="button"
              onClick={() => goBackScreen()}
              className="mt-5 rounded-[14px] bg-slate-900 px-4 py-3 text-xs font-black text-white"
            >
              Ana ekrana dön
            </button>
          </div>
        </main>
      );
    }

    return (
      <TeacherQuestionSelectionView
        token={token}
        teacherId={String((link as any)?.teacherId || "")}
        teacherName={String(link?.teacherName || "")}
        onBack={() => goBackScreen()}
      />
    );
  }

  if (screen === "admin-programs") {
    return <AdminProgramsView token={token} onBack={() => goBackScreen()} />;
  }

  if (screen === "guidance-students") {
    return <GuidanceStudentsView token={token} onBack={() => goBackScreen()} />;
  }

  if (screen === "curriculum-info") {
    return <TeacherCurriculumProgressView token={token} onBack={() => goBackScreen()} />;
  }

  if (screen === "admin-yearbook") {
    return (
      <div className="h-[100dvh] overflow-hidden bg-slate-50">
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => goBackScreen()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white"
            >
              Ana Ekrana Dön
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <YearbookAdmin />
          </div>
        </div>
      </div>
    );
  }

  if (screen === "admin-parent-approvals") {
    return (
      <div className="h-[100dvh] overflow-hidden bg-slate-50">
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => goBackScreen()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white"
            >
              Ana Ekrana Dön
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <ParentApprovalCenter
              currentUserName={String(link?.teacherName || "Yönetici")}
            />
          </div>
        </div>
      </div>
    );
  }
  if (screen === "admin-study-plans") {
    return (
      <AdminStudyPlanOperationsView
        token={token}
        onBack={() => goBackScreen()}
        onGenerated={() => void loadStartupReminders()}
      />
    );
  }

  if (screen === "admin-staff-roles") {
    return <AdminStaffRolesView token={token} onBack={() => goBackScreen()} />;
  }

  if (screen === "admin-behavior") {
    return (
      <AdminBehaviorDisciplineView
        token={token}
        onBack={() => goBackScreen()}
      />
    );
  }

  if (screen === "admin-exams") {
    return (
      <AdminExamOperationsView
        token={token}
        onBack={() => goBackScreen()}
      />
    );
  }

  if (screen === "admin-duty") {
    return <AdminDutyView token={token} onBack={() => goBackScreen()} />;
  }

  if (screen === "schedule") {
    return (
      <TeacherScheduleView
        token={token}
        teacherName={String(link?.teacherName || "")}
        onBack={() => goBackScreen()}
      />
    );
  }

  if (screen === "messages") {
    const messagePageTitle =
      messageTab === "compose"
        ? "MESAJ GÖNDER"
        : messageTab === "inbox"
          ? "GELEN MESAJLAR"
          : "GÖNDERİLEN MESAJLAR";

    return (
      <main
        className="min-h-screen cursor-grab bg-gradient-to-b from-pink-50 via-rose-50/45 to-white p-3 text-slate-800 uppercase active:cursor-grabbing sm:p-5"
        onTouchStart={handleTeacherMessageSwipeStart}
        onTouchEnd={handleTeacherMessageSwipeEnd}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          teacherMessageSwipeStartX.current = event.clientX;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "mouse" || teacherMessageSwipeStartX.current == null) return;
          const startX = teacherMessageSwipeStartX.current;
          teacherMessageSwipeStartX.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          const delta = event.clientX - startX;
          if (Math.abs(delta) < 55) return;
          const order: Array<"compose" | "inbox" | "sent"> = ["compose", "inbox", "sent"];
          const currentIndex = Math.max(0, order.indexOf(messageTab));
          const nextIndex = delta < 0
            ? Math.min(order.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);
          const nextTab = order[nextIndex];
          if (nextTab === messageTab) return;
          setMessageTab(nextTab);
          if (nextTab !== "compose") void loadTeacherMessages();
          setTeacherReplyTargetId("");
          setTeacherReplyBody("");
        }}
        onPointerCancel={() => { teacherMessageSwipeStartX.current = null; }}
      >
        <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <MobileSubHeader
            title="Mesajlar"
            subtitle={`${link?.teacherName || "Öğretmen"} · e-Nstitü Mesaj Merkezi`}
            onBack={() => goBackScreen()}
            accent="teal"
          />

          <div className="border-b border-slate-100 bg-white px-4 py-3 text-center">
            <div className="text-[16px] font-black tracking-[0.04em] text-red-600 sm:text-[18px]">
              {messagePageTitle}
            </div>
          </div>

          {teacherMessagesInfo ? (
            <div className="mx-3 mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600 sm:mx-5">
              {teacherMessagesInfo}
            </div>
          ) : null}

          {messageTab === "compose" ? (
            <div className="space-y-3 p-3 sm:p-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_48px] gap-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMessageRecipientType("student");
                        setMessageRecipientIds([]);
                      }}
                      className={`h-11 rounded-xl border px-2 text-[11px] font-black transition ${
                        messageRecipientType === "student"
                          ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-100"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Öğrenci
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessageRecipientType("parent");
                        setMessageRecipientIds([]);
                      }}
                      className={`h-11 rounded-xl border px-2 text-[11px] font-black transition ${
                        messageRecipientType === "parent"
                          ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-100"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Veli
                    </button>
                  </div>

                  <select
                    value={messageClassroom}
                    onChange={(event) => {
                      setMessageClassroom(event.target.value);
                      setMessageRecipientIds([]);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">Sınıf seçiniz</option>
                    {messageClassrooms.map((classroom) => (
                      <option key={classroom} value={classroom}>{classroom}</option>
                    ))}
                  </select>

                  <label
                    className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border-2 transition active:scale-[0.96] ${
                      messageAttachmentFile
                        ? "border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm"
                        : "border-amber-300 bg-amber-100 text-amber-700"
                    }`}
                    title={messageAttachmentFile ? `Gönderime hazır: ${messageAttachmentFile.name}` : "Dosya yükle"}
                    aria-label={messageAttachmentFile ? `Gönderime hazır: ${messageAttachmentFile.name}` : "Dosya yükle"}
                  >
                    {messageAttachmentFile ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                    <input
                      ref={messageAttachmentInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] || null;
                        if (!selectedFile) return;
                        if (!isSupportedMessageFile(selectedFile)) {
                          setMessageAttachmentFile(null);
                          setTeacherMessagesInfo("Yalnız PDF, DOC/DOCX, XLS/XLSX ve resim dosyaları seçilebilir.");
                          event.currentTarget.value = "";
                          return;
                        }
                        if (selectedFile.size > 20 * 1024 * 1024) {
                          setMessageAttachmentFile(null);
                          setTeacherMessagesInfo("Dosya en fazla 20 MB olabilir.");
                          event.currentTarget.value = "";
                          return;
                        }
                        setMessageAttachmentFile(selectedFile);
                        setTeacherMessagesInfo("");
                      }}
                    />
                  </label>
                </div>

                {messageAttachmentFile ? (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-[9px] font-black text-emerald-800">
                      {messageAttachmentFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMessageAttachmentFile(null);
                        if (messageAttachmentInputRef.current) messageAttachmentInputRef.current.value = "";
                      }}
                      className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
                      aria-label="Seçilen dosyayı kaldır"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={messageRecipientSearch}
                    onChange={(event) => {
                      setMessageRecipientSearch(event.target.value);
                      setMessageRecipientIds([]);
                    }}
                    placeholder={
                      messageRecipientType === "parent"
                        ? "Öğrenci adı, soyadı veya okul no ile velisini ara"
                        : "Öğrenci adı, soyadı veya okul no ile ara"
                    }
                    className="h-11 w-full rounded-xl border border-amber-200 bg-amber-50 pl-10 pr-3 text-[11px] font-bold text-slate-900 outline-none placeholder:text-amber-700/60 focus:border-amber-400 focus:bg-amber-50 focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                {messageClassroom || messageRecipientSearch.trim() ? (
                  <>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                        {messageRecipientType === "parent" ? "Veliler" : "Öğrenciler"}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] tracking-normal text-slate-500">
                          {messageRecipients.length} sonuç
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[9px] font-black text-sky-700">
                          {messageRecipientIds.length} seçili
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const ids = messageRecipients.map((student) => student.id);
                            const allSelected = ids.length > 0 && ids.every((id) => messageRecipientIds.includes(id));
                            setMessageRecipientIds(allSelected ? [] : ids);
                          }}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-black text-sky-700"
                        >
                          {messageRecipients.length > 0 &&
                          messageRecipients.every((student) => messageRecipientIds.includes(student.id))
                            ? "Seçimi kaldır"
                            : "Tümünü seç"}
                        </button>
                      </div>
                    </div>

                    <div
                      key={`${messageRecipientType}-${messageClassroom}-${normalize(messageRecipientSearch)}`}
                      className="mt-2 max-h-[300px] space-y-1 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50 p-2"
                    >
                      {messageRecipients.map((student, recipientIndex) => {
                        const selected = messageRecipientIds.includes(student.id);
                        const renderKey = [
                          String(student?.id || ""),
                          studentSchoolNumber(student),
                          String(student?.name || student?.fullName || student?.studentName || ""),
                          String(student?.classroom || ""),
                          String(recipientIndex),
                        ].join("|");
                        return (
                          <button
                            key={renderKey}
                            type="button"
                            onClick={() =>
                              setMessageRecipientIds((current) =>
                                current.includes(student.id)
                                  ? current.filter((id) => id !== student.id)
                                  : [...current, student.id],
                              )
                            }
                            className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.99] ${
                              selected
                                ? "border-sky-300 bg-white ring-1 ring-sky-100"
                                : "border-transparent bg-white/70"
                            }`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                              selected ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-400"
                            }`}>
                              {selected ? "✓" : "–"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-[11px] font-black text-slate-900">
                                {messageRecipientType === "parent" ? `${student.name} Velisi` : student.name}
                              </strong>
                              <span className="block truncate text-[8px] font-bold text-slate-400">
                                No {studentSchoolNumber(student) || "—"} · {student.classroom || ""}
                              </span>
                            </span>
                          </button>
                        );
                      })}

                      {messageRecipients.length === 0 ? (
                        <div className="p-4 text-center text-[10px] font-bold text-slate-400">
                          Aramanızla eşleşen öğrenci bulunamadı.
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  rows={5}
                  placeholder={messageRecipientType === "parent" ? "Veliye iletilecek mesajı yazınız…" : "Öğrenciye iletilecek mesajı yazınız…"}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-5 outline-none focus:border-sky-500 focus:bg-white"
                />
              </section>

              <div className="sticky bottom-0 z-20 -mx-3 border-t border-slate-100 bg-white/95 px-3 pb-2 pt-2 backdrop-blur sm:-mx-5 sm:px-5">
                <button
                  type="button"
                  disabled={teacherMessagesBusy || messageRecipientIds.length === 0 || (!messageBody.trim() && !messageAttachmentFile)}
                  onClick={() => void sendTeacherFamilyMessage()}
                  className="w-full rounded-2xl bg-sky-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-100 transition active:scale-[0.99] disabled:bg-slate-300 disabled:shadow-none"
                >
                  {teacherMessagesBusy
                    ? "Gönderiliyor…"
                    : `${messageRecipientType === "parent" ? "Velilere" : "Öğrencilere"} Gönder${messageRecipientIds.length ? ` · ${messageRecipientIds.length}` : ""}`}
                </button>
              </div>
            </div>
          ) : messageTab === "inbox" ? (
            <div className="space-y-1.5 p-3 sm:p-4">
              {teacherMessagesBusy && teacherIncomingMessages.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-[10px] font-black text-slate-600">
                  Gelen mesajlar yükleniyor…
                </div>
              ) : teacherIncomingMessages.map((reply) => {
                const opened = Boolean(reply.openedAt);
                const expanded = selectedTeacherIncomingId === reply.id;
                const replying = teacherReplyTargetId === reply.id;
                return (
                  <article
                    key={reply.id}
                    className={`overflow-hidden rounded-xl border ${opened ? "border-slate-200 bg-white" : "border-red-200 bg-red-50"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void openTeacherIncomingMessage(reply);
                        if (expanded) {
                          setTeacherReplyTargetId("");
                          setTeacherReplyBody("");
                        }
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opened ? "bg-slate-300" : "bg-red-600"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <strong className="truncate text-[11px] font-black text-slate-950">
                            {reply.senderName || "Gönderen"}
                          </strong>
                          <span className="shrink-0 text-[8px] font-bold text-slate-400">
                            {String(reply.createdAt || "").replace("T", " ").slice(0, 16)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-500">
                          {reply.body}
                        </span>
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${expanded ? "rotate-90" : ""}`} />
                    </button>

                    {expanded ? (
                      <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                          <div className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                            {reply.senderName || "Gönderen"} · {String(reply.createdAt || "").replace("T", " ").slice(0, 16)}
                          </div>
                          <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-900">{reply.body}</p>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherReplyTargetId((current) => current === reply.id ? "" : reply.id);
                              setTeacherReplyBody("");
                            }}
                            className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-[10px] font-black text-white"
                          >
                            Cevap Yaz
                          </button>
                          <button
                            type="button"
                            disabled={teacherMessagesBusy}
                            onClick={() => void deleteTeacherIncomingMessage(reply)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black text-red-600 disabled:opacity-50"
                          >
                            Sil
                          </button>
                        </div>

                        {replying ? (
                          <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50 p-2">
                            <textarea
                              value={teacherReplyBody}
                              onChange={(event) => setTeacherReplyBody(event.target.value)}
                              rows={3}
                              autoFocus
                              placeholder={`${reply.senderName || "Gönderene"} cevap yazınız…`}
                              className="w-full resize-none rounded-lg border border-sky-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-sky-500"
                            />
                            <button
                              type="button"
                              disabled={teacherMessagesBusy || !teacherReplyBody.trim()}
                              onClick={() => void replyToTeacherIncomingMessage(reply)}
                              className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:bg-slate-300"
                            >
                              {teacherMessagesBusy ? "Gönderiliyor…" : "Gönder"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {!teacherMessagesBusy && teacherIncomingMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[10px] font-bold text-slate-500">
                  Gelen mesaj bulunmuyor.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5 p-3 sm:p-4">
              {teacherMessagesBusy && teacherMessages.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-[10px] font-black text-slate-600">
                  Gönderilen mesajlar yükleniyor…
                </div>
              ) : teacherMessages.map((message) => {
                const receipts = message.receipts || [];
                const allOpened = receipts.length > 0 && receipts.every((receipt) => Boolean(receipt.openedAt));
                const recipientLabels = Array.from(
                  new Set(
                    receipts
                      .map((receipt) => {
                        const studentName = String(receipt.studentName || "").trim();
                        if (!studentName) return "";
                        return (message as any)?.recipientType === "parent" ? `${studentName} Velisi` : studentName;
                      })
                      .filter(Boolean),
                  ),
                );
                const recipientText =
                  recipientLabels.length === 0
                    ? "Alıcı"
                    : recipientLabels.length <= 2
                      ? recipientLabels.join(", ")
                      : `${recipientLabels.slice(0, 2).join(", ")} +${recipientLabels.length - 2}`;

                return (
                  <details key={message.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer list-none px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${allOpened ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="truncate text-[11px] font-black text-slate-950">{recipientText}</strong>
                            <span className="shrink-0 text-[8px] font-bold text-slate-400">
                              {String(message.createdAt || "").replace("T", " ").slice(0, 16)}
                            </span>
                          </div>
                          <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-500">{message.body}</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-90" />
                      </div>
                    </summary>

                    <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">
                      <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                        <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-900">{message.body}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[8px] font-bold text-slate-400">
                          {receipts.length} alıcı · {allOpened ? "Okundu" : "Okunmayı bekliyor"}
                        </span>
                        <button
                          type="button"
                          disabled={teacherMessagesBusy}
                          onClick={(event) => {
                            event.preventDefault();
                            void deleteTeacherSentMessage(message);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[9px] font-black text-red-600 disabled:opacity-50"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </details>
                );
              })}
              {!teacherMessagesBusy && teacherMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[10px] font-bold text-slate-500">
                  Henüz mesaj gönderilmedi.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (screen === "exam-results") {
    const rankingRows = selectedTeacherSubjectResult?.rows || [];
    const teacherExamStudentKey = (row: TeacherExamRankingRow) => `${row.classroom}|${row.studentNumber}|${row.studentName}`;
    const studentListRows = [...rankingRows].sort((a, b) =>
      String(a.classroom || "").localeCompare(String(b.classroom || ""), "tr-TR", { numeric: true }) ||
      String(a.studentNumber || "").localeCompare(String(b.studentNumber || ""), "tr-TR", { numeric: true }) ||
      String(a.studentName || "").localeCompare(String(b.studentName || ""), "tr-TR"),
    );
    const selectedTeacherExamStudent = rankingRows.find((row) => teacherExamStudentKey(row) === selectedTeacherExamStudentKey) || null;
    const daysSinceExam = (examDate: string) => {
      if (!examDate) return 0;
      const exam = new Date(`${examDate}T12:00:00`);
      const now = new Date();
      const diff = now.getTime() - exam.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const teacherExportBaseName = (suffix: string) => {
      const raw = `${selectedTeacherExam?.examName || "sinav"}-${selectedTeacherSubjectResult?.subjectName || "ders"}-${suffix}`;
      return raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || suffix;
    };

    const exportTeacherRankingExcel = async () => {
      if (!selectedTeacherExam || !selectedTeacherSubjectResult) return;
      const XLSX = await import("xlsx");
      const teacherName = String(link?.teacherName || "Öğretmen").trim();
      const examMeta = `${selectedTeacherExam.examDate || ""}${selectedTeacherExam.examType ? ` · ${selectedTeacherExam.examType}` : ""}`.trim();

      const sheetRows: any[][] = [
        ["SINAV SONUÇ BİLGİLERİ", "", "", "", "", "", ""],
        [teacherName, "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["DERSİNİZ", "", "", "", "", "", ""],
        [selectedTeacherSubjectResult.subjectName, "", "", "", "", "", ""],
        [selectedTeacherExam.examName, "", "", "", "", "", ""],
        [examMeta || "Sınav bilgisi", "", "", "", "", "", ""],
        ["Öğrenci satırına dokunarak ayrıntılı sonucu açabilirsiniz.", "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["SİZİN SINIFLARINIZ", "", "", "OKUL ORTALAMASI", "", "", ""],
        [`${selectedTeacherSubjectResult.teacherAverageNet.toFixed(2)} net`, "", "", `${selectedTeacherSubjectResult.schoolAverageNet.toFixed(2)} net`, "", "", ""],
        ["", "", "", "", "", "", ""],
        ["Öğrenci", "D", "Y", "B", "Net", "Sınıf", "Okul"],
        ...rankingRows.map((row) => [
          `${row.studentName}\n${row.studentNumber || "-"} · ${row.classroom || "-"}`,
          row.correct,
          row.wrong,
          row.empty,
          Number(row.net.toFixed(2)),
          row.classroomRank,
          row.schoolRank,
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 6 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 6 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
        { s: { r: 9, c: 3 }, e: { r: 9, c: 6 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 2 } },
        { s: { r: 10, c: 3 }, e: { r: 10, c: 6 } },
      ];
      worksheet["!cols"] = [
        { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 11 }, { wch: 10 }, { wch: 10 },
      ];
      worksheet["!rows"] = [
        { hpt: 27 }, { hpt: 18 }, { hpt: 8 }, { hpt: 16 }, { hpt: 28 }, { hpt: 25 }, { hpt: 18 }, { hpt: 18 },
        { hpt: 8 }, { hpt: 18 }, { hpt: 30 }, { hpt: 8 }, { hpt: 23 },
        ...rankingRows.map(() => ({ hpt: 34 })),
      ];
      (worksheet as any)["!freeze"] = { xSplit: 1, ySplit: 13, topLeftCell: "B14", activePane: "bottomRight", state: "frozen" };

      const thinBorder = {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } },
      };
      const applyStyle = (ref: string, style: any) => {
        if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" } as any;
        (worksheet[ref] as any).s = style;
      };
      const styleRange = (r1: number, r2: number, c1: number, c2: number, factory: (r: number, c: number) => any) => {
        for (let r = r1; r <= r2; r += 1) {
          for (let c = c1; c <= c2; c += 1) {
            applyStyle(XLSX.utils.encode_cell({ r, c }), factory(r, c));
          }
        }
      };

      styleRange(0, 0, 0, 6, () => ({
        font: { bold: true, sz: 16, color: { rgb: "0F172A" } },
        alignment: { vertical: "center", horizontal: "left" },
      }));
      styleRange(1, 1, 0, 6, () => ({
        font: { bold: true, sz: 10, color: { rgb: "64748B" } },
        alignment: { vertical: "center", horizontal: "left" },
      }));
      styleRange(3, 3, 0, 6, () => ({
        font: { bold: true, sz: 9, color: { rgb: "64748B" } },
        alignment: { vertical: "center", horizontal: "left" },
      }));
      styleRange(4, 4, 0, 6, () => ({
        fill: { fgColor: { rgb: "FFFFFF" } },
        font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
        alignment: { vertical: "center", horizontal: "left" },
        border: { ...thinBorder, top: { style: "thin", color: { rgb: "D8B4FE" } }, bottom: { style: "thin", color: { rgb: "D8B4FE" } }, left: { style: "thin", color: { rgb: "D8B4FE" } }, right: { style: "thin", color: { rgb: "D8B4FE" } } },
      }));
      styleRange(5, 7, 0, 6, (r) => ({
        fill: { fgColor: { rgb: "F5F0FF" } },
        font: { bold: r === 5, sz: r === 5 ? 12 : 9, color: { rgb: r === 7 ? "7C3AED" : r === 5 ? "0F172A" : "64748B" } },
        alignment: { vertical: "center", horizontal: "left", wrapText: true },
        border: r === 5 ? { ...thinBorder, top: { style: "thin", color: { rgb: "C4B5FD" } }, left: { style: "thin", color: { rgb: "C4B5FD" } }, right: { style: "thin", color: { rgb: "C4B5FD" } } }
          : r === 7 ? { ...thinBorder, bottom: { style: "thin", color: { rgb: "C4B5FD" } }, left: { style: "thin", color: { rgb: "C4B5FD" } }, right: { style: "thin", color: { rgb: "C4B5FD" } } }
          : { left: { style: "thin", color: { rgb: "C4B5FD" } }, right: { style: "thin", color: { rgb: "C4B5FD" } } },
      }));
      styleRange(9, 10, 0, 2, (r) => ({
        fill: { fgColor: { rgb: "F3E8FF" } },
        font: { bold: true, sz: r === 10 ? 15 : 9, color: { rgb: r === 10 ? "0F172A" : "7E22CE" } },
        alignment: { vertical: "center", horizontal: "left" },
      }));
      styleRange(9, 10, 3, 6, (r) => ({
        fill: { fgColor: { rgb: "F1F5F9" } },
        font: { bold: true, sz: r === 10 ? 15 : 9, color: { rgb: r === 10 ? "0F172A" : "64748B" } },
        alignment: { vertical: "center", horizontal: "left" },
      }));
      styleRange(12, 12, 0, 6, (_r, c) => ({
        fill: { fgColor: { rgb: "F8FAFC" } },
        font: { bold: true, sz: 9, color: { rgb: "475569" } },
        alignment: { vertical: "center", horizontal: c === 0 ? "left" : "center" },
        border: thinBorder,
      }));
      rankingRows.forEach((row, rowIndex) => {
        const excelRow = 13 + rowIndex;
        const belowAverage = row.net < selectedTeacherSubjectResult.schoolAverageNet;
        const fill = belowAverage ? "F1F5F9" : "FFFFFF";
        styleRange(excelRow, excelRow, 0, 6, (_r, c) => ({
          fill: { fgColor: { rgb: fill } },
          font: {
            bold: c === 0 || c >= 4,
            sz: c === 0 ? 9 : 10,
            color: { rgb: c === 1 ? "047857" : c === 2 ? "BE123C" : c === 3 ? "64748B" : c === 4 ? "155E75" : "334155" },
          },
          alignment: { vertical: "center", horizontal: c === 0 ? "left" : "center", wrapText: c === 0 },
          border: thinBorder,
        }));
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sıralı Liste");
      XLSX.writeFile(workbook, `${teacherExportBaseName("sirali-liste")}.xlsx`, { compression: true, cellStyles: true });
    };

    const exportTeacherRankingPdf = async () => {
      if (!selectedTeacherExam || !selectedTeacherSubjectResult) return;
      const filename = `${teacherExportBaseName("sirali-liste")}.pdf`;
      const teacherName = String(link?.teacherName || "Öğretmen").trim();
      const examMeta = `${selectedTeacherExam.examDate || ""}${selectedTeacherExam.examType ? ` · ${selectedTeacherExam.examType}` : ""}`.trim();
      const averageCard = (label: string, value: string, fillColor: string, labelColor: string) => ({
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              { text: label, bold: true, fontSize: 7.5, color: labelColor, margin: [0, 0, 0, 5] },
              { text: value, bold: true, fontSize: 15, color: "#0F172A" },
            ],
            fillColor,
            margin: [10, 9, 10, 9],
          }]],
        },
        layout: "noBorders",
      });

      const headerBody = [[
        { text: "Öğrenci", bold: true, fontSize: 7.5, color: "#475569", fillColor: "#F8FAFC", margin: [6, 6, 4, 6] },
        ...["D", "Y", "B", "Net", "Sınıf", "Okul"].map((label) => ({ text: label, bold: true, fontSize: 7.5, color: "#475569", fillColor: "#F8FAFC", alignment: "center", margin: [2, 6, 2, 6] })),
      ]];
      const bodyRows = rankingRows.map((row) => {
        const belowAverage = row.net < selectedTeacherSubjectResult.schoolAverageNet;
        const fillColor = belowAverage ? "#F1F5F9" : "#FFFFFF";
        return [
          {
            stack: [
              { text: row.studentName, bold: true, fontSize: 8.2, color: "#0F172A" },
              { text: `${row.studentNumber || "-"} · ${row.classroom || "-"}`, fontSize: 6.7, color: "#94A3B8", margin: [0, 2, 0, 0] },
            ],
            fillColor,
            margin: [6, 6, 4, 6],
          },
          { text: String(row.correct), bold: true, fontSize: 8, color: "#047857", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
          { text: String(row.wrong), bold: true, fontSize: 8, color: "#BE123C", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
          { text: String(row.empty), bold: true, fontSize: 8, color: "#64748B", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
          { text: row.net.toFixed(2), bold: true, fontSize: 8, color: "#155E75", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
          { text: String(row.classroomRank), bold: true, fontSize: 8, color: "#334155", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
          { text: String(row.schoolRank), bold: true, fontSize: 8, color: "#334155", alignment: "center", fillColor, margin: [2, 8, 2, 8] },
        ];
      });

      const definition = {
        pageSize: "A4",
        pageOrientation: "portrait",
        pageMargins: [28, 26, 28, 34],
        content: [
          {
            stack: [
              { text: "SINAV SONUÇ BİLGİLERİ", bold: true, fontSize: 14, color: "#0F172A" },
              { text: teacherName, bold: true, fontSize: 8.5, color: "#64748B", margin: [0, 3, 0, 0] },
            ],
            margin: [0, 0, 0, 14],
          },
          { text: "DERSİNİZ", bold: true, fontSize: 7.5, color: "#64748B", margin: [0, 0, 0, 4] },
          {
            table: { widths: ["*"], body: [[{ text: selectedTeacherSubjectResult.subjectName, bold: true, fontSize: 9.5, color: "#0F172A", margin: [9, 8, 9, 8] }]] },
            layout: {
              hLineColor: () => "#D8B4FE", vLineColor: () => "#D8B4FE", hLineWidth: () => 0.7, vLineWidth: () => 0.7,
              paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
            },
            margin: [0, 0, 0, 8],
          },
          {
            table: {
              widths: ["*"],
              body: [[{
                stack: [
                  { text: selectedTeacherExam.examName, bold: true, fontSize: 10.5, color: "#0F172A" },
                  { text: examMeta || "Sınav bilgisi", fontSize: 7.5, color: "#64748B", margin: [0, 4, 0, 0] },
                  { text: "Öğrenci satırına dokunarak ayrıntılı sonucu açabilirsiniz.", bold: true, fontSize: 6.8, color: "#7C3AED", margin: [0, 5, 0, 0] },
                ],
                fillColor: "#F5F0FF",
                margin: [9, 9, 9, 9],
              }]],
            },
            layout: {
              hLineColor: () => "#C4B5FD", vLineColor: () => "#C4B5FD", hLineWidth: () => 0.7, vLineWidth: () => 0.7,
              paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
            },
            margin: [0, 0, 0, 9],
          },
          {
            columns: [
              averageCard("SİZİN SINIFLARINIZ", `${selectedTeacherSubjectResult.teacherAverageNet.toFixed(2)} net`, "#F3E8FF", "#7E22CE"),
              averageCard("OKUL ORTALAMASI", `${selectedTeacherSubjectResult.schoolAverageNet.toFixed(2)} net`, "#F1F5F9", "#64748B"),
            ],
            columnGap: 8,
            margin: [0, 0, 0, 9],
          },
          {
            table: {
              headerRows: 1,
              widths: ["*", 30, 30, 30, 42, 42, 42],
              body: [...headerBody, ...bodyRows],
            },
            layout: {
              hLineColor: () => "#E2E8F0",
              vLineColor: () => "#E2E8F0",
              hLineWidth: () => 0.45,
              vLineWidth: () => 0.45,
              paddingLeft: () => 0,
              paddingRight: () => 0,
              paddingTop: () => 0,
              paddingBottom: () => 0,
            },
          },
        ],
        footer: (currentPage: number, pageCount: number) => ({
          text: `${currentPage} / ${pageCount}`,
          alignment: "center",
          fontSize: 7,
          color: "#94A3B8",
          margin: [0, 8, 0, 0],
        }),
        info: { title: `${selectedTeacherExam.examName} - ${selectedTeacherSubjectResult.subjectName} Sıralı Liste` },
      };

      await PdfEngine.generate(definition, { mode: "download", filename });
    };

    const exportTeacherItemExcel = async () => {
      if (!selectedTeacherExam || !selectedTeacherSubjectResult) return;
      const XLSX = await import("xlsx");
      const rows = selectedTeacherSubjectResult.items.map((item) => ({
        "A Soru": item.bookletNumbers.A || item.questionNumber,
        "B Soru": item.bookletNumbers.B || "",
        "C Soru": item.bookletNumbers.C || "",
        "D Soru": item.bookletNumbers.D || "",
        "Doğru Cevap": item.correctAnswer || "-",
        "Doğru": item.correctCount,
        "Yanlış": item.wrongCount,
        "Boş": item.emptyCount,
        "Katılım": item.totalCount,
        "Başarı %": Number(item.correctRate.toFixed(1)),
        "A İşaretleyen": item.choiceCounts.A || 0,
        "B İşaretleyen": item.choiceCounts.B || 0,
        "C İşaretleyen": item.choiceCounts.C || 0,
        "D İşaretleyen": item.choiceCounts.D || 0,
        "E İşaretleyen": item.choiceCounts.E || 0,
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = Array.from({ length: 15 }, () => ({ wch: 13 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Madde Analizi");
      XLSX.writeFile(workbook, `${teacherExportBaseName("madde-analizi")}.xlsx`);
    };

    const exportTeacherItemPdf = async () => {
      if (!selectedTeacherExam || !selectedTeacherSubjectResult) return;
      await exportTablePdf(
        `${teacherExportBaseName("madde-analizi")}.pdf`,
        "Madde Analizi",
        [{
          title: `${selectedTeacherExam.examName} · ${selectedTeacherSubjectResult.subjectName}`,
          subtitle: `${selectedTeacherSubjectResult.assignedParticipantCount} öğrenci`,
          headers: ["Soru", "Doğru", "D", "Y", "B", "Başarı %", "A", "B", "C", "D", "E"],
          widths: [12, 9, 8, 8, 8, 11, 8, 8, 8, 8, 8],
          rows: selectedTeacherSubjectResult.items.map((item) => [
            `A:${item.bookletNumbers.A || item.questionNumber}${item.bookletNumbers.B ? ` B:${item.bookletNumbers.B}` : ""}`,
            item.correctAnswer || "-", item.correctCount, item.wrongCount, item.emptyCount,
            item.correctRate.toFixed(1),
            item.choiceCounts.A || 0, item.choiceCounts.B || 0, item.choiceCounts.C || 0,
            item.choiceCounts.D || 0, item.choiceCounts.E || 0,
          ]),
        }],
        { orientation: "landscape", rowsPerPage: 28, fullWidth: true, stripedRows: true, centerCells: true },
      );
    };

    const openTeacherQuestionImage = (item: TeacherExamItemStat) => {
      const imageUrl = String(item.imageUrl || "").trim();
      if (!imageUrl) return;
      setTeacherQuestionPreview({
        url: imageUrl,
        title: `${selectedTeacherSubjectResult?.subjectName || "Ders"} · Soru ${item.bookletNumbers.A || item.questionNumber}`,
      });
    };

    return (
      <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-sky-50/45 to-white p-3 text-slate-800 sm:p-5">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <MobileSubHeader
            title="Sınav Sonuç Bilgileri"
            subtitle={link.teacherName}
            onBack={() => {
              if (examResultsView === "exam-list") {
                goBackScreen();
              } else if (examResultsView === "exam-menu") {
                setExamResultsView("exam-list");
              } else if (examResultsView === "student") {
                setExamResultsView("student-list");
              } else {
                setExamResultsView("exam-menu");
              }
            }}
            accent="teal"
          />

          {examResultsView === "exam-list" ? (
            <div className="p-4 sm:p-6">
              <div className="mb-3">
                <strong className="block text-sm font-black text-slate-900">Sınavlar</strong>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">
                  En son sınav en üstte gösterilir.
                </span>
              </div>

              {teacherExamResultsBusy && teacherExamResults.exams.length === 0 ? (
                <div className="rounded-2xl bg-cyan-50 p-5 text-center text-xs font-black text-cyan-700">
                  Sınav sonuçları yükleniyor…
                </div>
              ) : teacherExamResultsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                  {teacherExamResultsError}
                </div>
              ) : teacherExamResults.exams.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
                  Size atanmış derslerle eşleşen değerlendirilmiş sınav sonucu bulunamadı.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {teacherExamResults.exams.map((exam, index) => {
                    const oldExam = daysSinceExam(exam.examDate) > 7;
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeacherExamId(exam.id);
                          setSelectedTeacherExamSubject(exam.subjects[0]?.subjectName || "");
                          setExamResultsView("exam-menu");
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${
                          oldExam
                            ? "border-slate-200 bg-slate-100 text-slate-500"
                            : index === 0
                              ? "border-cyan-200 bg-cyan-50 shadow-sm"
                              : "border-cyan-100 bg-white shadow-sm"
                        }`}
                      >
                        <span className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[10px] font-black ${
                          oldExam
                            ? "bg-slate-200 text-slate-600"
                            : "bg-cyan-100 text-cyan-800"
                        }`}>
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <strong className={`block truncate text-sm font-black ${oldExam ? "text-slate-600" : "text-slate-900"}`}>
                            {exam.examName}
                          </strong>
                          <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
                            {exam.examDate || "Tarih bilgisi yok"}
                            {exam.examType ? ` · ${exam.examType}` : ""}
                            {oldExam ? " · 1 haftadan eski" : ""}
                          </span>
                          <span className="mt-1 block truncate text-[9px] font-black text-cyan-700">
                            {exam.subjects.map((subject) => `${subject.subjectName} (${subject.assignedParticipantCount})`).join(" · ")}
                          </span>
                        </div>

                        <ChevronRight className={`h-5 w-5 shrink-0 ${oldExam ? "text-slate-400" : "text-cyan-600"}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : examResultsView === "exam-menu" ? (
            <>
            <div className="space-y-3 p-4 sm:p-6">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <span className="block text-[10px] font-black uppercase tracking-wide text-cyan-700">
                  Seçili sınav
                </span>
                <strong className="mt-1 block text-base font-black text-slate-900">
                  {selectedTeacherExam?.examName || "Sınav"}
                </strong>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">
                  {selectedTeacherExam?.examDate || "Tarih bilgisi yok"}
                  {selectedTeacherExam?.examType ? ` · ${selectedTeacherExam.examType}` : ""}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExamResultsView("ranking")}
                  className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-slate-900">Sıralı Liste</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                      Ders ve sınıflarınızdaki öğrencileri net, sınıf ve okul sırasıyla görün.
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-cyan-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setExamResultsView("student-list")}
                  className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                    <Users className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-slate-900">Öğrencileri Tek Tek İncele</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                      Her öğrencinin doğru, yanlış, net ve soru bazlı cevaplarını açın.
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-indigo-600" />
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExamResultsView("item")}
                  className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <ClipboardCheck className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-slate-900">Madde Analizi</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                      A kitapçığı sırasına göre soru başarısı ve seçenek dağılımlarını inceleyin.
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-orange-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowTeacherItemAnalysisReportV2(true)}
                  className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-white">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-slate-900">Madde Analizi V2 Premium</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                      Size atanmış ders ve sınıflar için Premium soru analizi ve eylem planı.
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-violet-600" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setExamResultsView("compare")}
                className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <BarChart3 className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-slate-900">Karşılaştırmalı Analiz</strong>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                    Bu sınavdaki ders ortalamalarınızı okul ortalamasıyla karşılaştırın.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 text-violet-600" />
              </button>
            </div>
            {showTeacherItemAnalysisReportV2 && selectedTeacherExam ? (
              <TeacherItemAnalysisReportV2Modal
                exam={selectedTeacherExam}
                subjects={selectedTeacherExam.subjects}
                initialSubject={selectedTeacherSubjectResult?.subjectName}
                onClose={() => setShowTeacherItemAnalysisReportV2(false)}
              />
            ) : null}
            </>
          ) : (
            <div className="p-3 sm:p-4">
              {teacherExamResultsBusy && teacherExamResults.exams.length === 0 ? (
                <div className="rounded-2xl bg-cyan-50 p-5 text-center text-xs font-black text-cyan-700">
                  Sınav sonuçları yükleniyor…
                </div>
              ) : teacherExamResultsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                  {teacherExamResultsError}
                </div>
              ) : !selectedTeacherExam ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
                  Sınav seçilemedi.
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Dersiniz
                    </span>
                    <select
                      value={selectedTeacherSubjectResult?.subjectName || ""}
                      onChange={(event) => setSelectedTeacherExamSubject(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-500"
                    >
                      {(selectedTeacherExam?.subjects || []).map((subject) => (
                        <option key={subject.subjectName} value={subject.subjectName}>
                          {subject.subjectName}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedTeacherSubjectResult && examResultsView === "ranking" && (
                    <>
                      <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                        <strong className="block text-sm font-black text-slate-900">
                          {selectedTeacherExam.examName}
                        </strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-500">
                          {selectedTeacherExam.examDate}{selectedTeacherExam.examType ? ` · ${selectedTeacherExam.examType}` : ""}
                        </span>
                        <span className="mt-1 block text-[9px] font-bold text-cyan-700">
                          Öğrenci satırına dokunarak ayrıntılı sonucu açabilirsiniz.
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void exportTeacherRankingExcel()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <Download className="h-4 w-4" /> Excel İndir
                        </button>
                        <button
                          type="button"
                          onClick={() => void exportTeacherRankingPdf()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-black text-rose-800 transition hover:bg-rose-100"
                        >
                          <Download className="h-4 w-4" /> PDF İndir
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-cyan-50 p-3">
                          <span className="block text-[9px] font-black uppercase text-cyan-700">Sizin sınıflarınız</span>
                          <strong className="mt-1 block text-lg font-black text-slate-900">
                            {selectedTeacherSubjectResult.teacherAverageNet.toFixed(2)} net
                          </strong>
                        </div>
                        <div className="rounded-xl bg-slate-100 p-3">
                          <span className="block text-[9px] font-black uppercase text-slate-500">Okul ortalaması</span>
                          <strong className="mt-1 block text-lg font-black text-slate-900">
                            {selectedTeacherSubjectResult.schoolAverageNet.toFixed(2)} net
                          </strong>
                        </div>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-[minmax(130px,1.6fr)_repeat(6,minmax(42px,.55fr))] gap-px bg-slate-200 px-0 text-[9px] font-black text-slate-600">
                          <div className="bg-slate-50 px-2 py-2">Öğrenci</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">D</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">Y</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">B</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">Net</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">Sınıf</div>
                          <div className="bg-slate-50 px-1 py-2 text-center">Okul</div>
                        </div>
                        <div className="max-h-[65vh] overflow-y-auto">
                          {rankingRows.map((row) => {
                            const isBelowSchoolAverage = row.net < selectedTeacherSubjectResult.schoolAverageNet;
                            return (
                            <button
                              key={`${row.classroom}-${row.studentNumber}-${row.studentName}`}
                              type="button"
                              onClick={() => { setSelectedTeacherExamStudentKey(teacherExamStudentKey(row)); setExamResultsView("student"); }}
                              className={`grid w-full grid-cols-[minmax(130px,1.6fr)_repeat(6,minmax(42px,.55fr))] items-center gap-px border-t border-slate-100 text-left text-[10px] transition ${isBelowSchoolAverage ? "bg-slate-100 hover:bg-slate-200 active:bg-slate-200" : "bg-white hover:bg-slate-50 active:bg-slate-100"}`}
                            >
                              <div className="min-w-0 px-2 py-2.5">
                                <strong className="block truncate font-black text-slate-900">{row.studentName}</strong>
                                <span className="block truncate text-[9px] font-bold text-slate-400">
                                  {row.studentNumber} · {row.classroom}
                                </span>
                              </div>
                              <div className="px-1 text-center font-black text-emerald-700">{row.correct}</div>
                              <div className="px-1 text-center font-black text-rose-700">{row.wrong}</div>
                              <div className="px-1 text-center font-black text-slate-500">{row.empty}</div>
                              <div className="px-1 text-center font-black text-cyan-800">{row.net.toFixed(2)}</div>
                              <div className="px-1 text-center font-black text-slate-700">{row.classroomRank}</div>
                              <div className="px-1 text-center font-black text-slate-700">{row.schoolRank}</div>
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedTeacherSubjectResult && examResultsView === "student-list" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                        <strong className="block text-sm font-black text-slate-900">
                          {selectedTeacherExam.examName} · {selectedTeacherSubjectResult.subjectName}
                        </strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-500">
                          {selectedTeacherSubjectResult.assignedParticipantCount} öğrenciden birini seçin.
                        </span>
                      </div>
                      <div className="space-y-2">
                        {studentListRows.map((row) => (
                          <button
                            key={teacherExamStudentKey(row)}
                            type="button"
                            onClick={() => { setSelectedTeacherExamStudentKey(teacherExamStudentKey(row)); setExamResultsView("student"); }}
                            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99]"
                          >
                            <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-indigo-100 px-2 text-xs font-black text-indigo-800">
                              {row.studentNumber || "—"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm font-black text-slate-900">{row.studentName}</strong>
                              <span className="mt-0.5 block text-[10px] font-bold text-slate-500">{row.classroom} · {row.bookletType || "A"} kitapçığı</span>
                            </span>
                            <span className="text-right">
                              <strong className="block text-sm font-black text-indigo-700">{row.net.toFixed(2)} net</strong>
                              <span className="block text-[9px] font-bold text-slate-400">Sınıf {row.classroomRank}. · Okul {row.schoolRank}.</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-indigo-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTeacherSubjectResult && examResultsView === "student" && selectedTeacherExamStudent && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex rounded-lg bg-indigo-700 px-2.5 py-1 text-[10px] font-black text-white">{selectedTeacherExamStudent.studentNumber || "—"}</span>
                            <strong className="mt-2 block truncate text-base font-black text-slate-900">{selectedTeacherExamStudent.studentName}</strong>
                            <span className="mt-1 block text-[10px] font-bold text-slate-500">{selectedTeacherExamStudent.classroom} · {selectedTeacherExamStudent.bookletType || "A"} kitapçığı · {selectedTeacherSubjectResult.subjectName}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] font-black uppercase text-slate-400">Net</span>
                            <strong className="text-2xl font-black text-indigo-700">{selectedTeacherExamStudent.net.toFixed(2)}</strong>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                          <div className="rounded-xl bg-emerald-50 px-1 py-2"><span className="block text-[8px] font-black uppercase text-emerald-700">Doğru</span><strong className="text-sm font-black text-emerald-800">{selectedTeacherExamStudent.correct}</strong></div>
                          <div className="rounded-xl bg-rose-50 px-1 py-2"><span className="block text-[8px] font-black uppercase text-rose-700">Yanlış</span><strong className="text-sm font-black text-rose-800">{selectedTeacherExamStudent.wrong}</strong></div>
                          <div className="rounded-xl bg-slate-100 px-1 py-2"><span className="block text-[8px] font-black uppercase text-slate-500">Boş</span><strong className="text-sm font-black text-slate-700">{selectedTeacherExamStudent.empty}</strong></div>
                          <div className="rounded-xl bg-cyan-50 px-1 py-2"><span className="block text-[8px] font-black uppercase text-cyan-700">Sınıf</span><strong className="text-sm font-black text-cyan-800">{selectedTeacherExamStudent.classroomRank}.</strong></div>
                          <div className="rounded-xl bg-violet-50 px-1 py-2"><span className="block text-[8px] font-black uppercase text-violet-700">Okul</span><strong className="text-sm font-black text-violet-800">{selectedTeacherExamStudent.schoolRank}.</strong></div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <strong className="text-sm font-black text-slate-900">Soru Bazlı Cevaplar</strong>
                          <span className="text-[9px] font-bold text-slate-400">{selectedTeacherExamStudent.totalQuestions || selectedTeacherExamStudent.questions.length} soru</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                          {selectedTeacherExamStudent.questions.map((question) => {
                            const boxClass = question.isEmpty
                              ? "border-slate-300 bg-white text-slate-900"
                              : question.isCorrect
                                ? "border-emerald-300 bg-emerald-500 text-white"
                                : "border-rose-300 bg-rose-500 text-white";
                            return (
                              <button
                                key={`${question.originalIndex}-${question.qNum}`}
                                type="button"
                                disabled={!question.imageUrl}
                                onClick={() => {
                                  if (!question.imageUrl) return;
                                  setTeacherQuestionPreview({
                                    url: question.imageUrl,
                                    title: `${selectedTeacherSubjectResult.subjectName} · Soru ${question.qNum}`,
                                  });
                                }}
                                className={`rounded-xl border p-2 text-center transition ${boxClass} ${question.imageUrl ? "cursor-pointer hover:ring-2 hover:ring-indigo-300" : "cursor-default"}`}
                                title={question.imageUrl ? "Soruyu görüntüle" : ([question.unit, question.topic, question.outcome].filter(Boolean).join(" · ") || "Soru görseli bulunamadı")}
                              >
                                <span className="block text-[8px] font-black opacity-80">{question.qNum}. Soru</span>
                                <div className="mt-1 flex items-center justify-center gap-1.5">
                                  <strong className={`text-base font-black ${question.isEmpty ? "text-slate-900" : "text-black"}`}>{question.studentAns || "-"}</strong>
                                  <span className={`text-[10px] font-black ${question.isEmpty ? "text-slate-500" : "text-white"}`}>/ {question.correctAns || "-"}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-slate-500">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Yeşil: doğru</span>
                          <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Kırmızı: yanlış</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">Beyaz: boş</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">Siyah: öğrenci cevabı · Beyaz: doğru cevap</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTeacherSubjectResult && examResultsView === "item" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
                        <strong className="block text-sm font-black text-slate-900">
                          {selectedTeacherExam.examName} · {selectedTeacherSubjectResult.subjectName}
                        </strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-500">
                          Sorular A kitapçığı sırasına göre gösterilir. Analiz yalnızca size atanmış sınıflardaki öğrencileri kapsar.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void exportTeacherItemExcel()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <Download className="h-4 w-4" /> Excel İndir
                        </button>
                        <button
                          type="button"
                          onClick={() => void exportTeacherItemPdf()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-black text-rose-800 transition hover:bg-rose-100"
                        >
                          <Download className="h-4 w-4" /> PDF İndir
                        </button>
                      </div>

                      {selectedTeacherSubjectResult.items.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
                          Bu ders için soru bazlı cevap verisi bulunamadı.
                        </div>
                      ) : (
                        selectedTeacherSubjectResult.items.map((item) => (
                          <button
                            key={item.questionNumber}
                            type="button"
                            disabled={!item.imageUrl}
                            onClick={() => openTeacherQuestionImage(item)}
                            title={item.imageUrl ? "Soru görselini aç" : "Bu soru için görsel bulunamadı"}
                            className={`w-full rounded-2xl border border-orange-100 bg-white p-4 text-left shadow-sm transition ${item.imageUrl ? "cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 hover:shadow-md" : "cursor-default"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-lg bg-orange-700 px-2 py-1 text-[10px] font-black text-white">
                                    A · {item.bookletNumbers.A || item.questionNumber}
                                  </span>
                                  {item.bookletNumbers.B ? (
                                    <span className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-800">
                                      B · {item.bookletNumbers.B}
                                    </span>
                                  ) : null}
                                  {item.bookletNumbers.C ? (
                                    <span className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-800">
                                      C · {item.bookletNumbers.C}
                                    </span>
                                  ) : null}
                                  {item.bookletNumbers.D ? (
                                    <span className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-800">
                                      D · {item.bookletNumbers.D}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mt-2 block text-[10px] font-bold text-slate-500">
                                  Doğru seçenek: {item.correctAnswer || "—"} · {item.totalCount} öğrenci
                                </span>
                              </div>

                              <div className="shrink-0 text-right">
                                <span className="block text-[9px] font-black uppercase text-slate-400">Yapılma oranı</span>
                                <strong className={`mt-1 block text-xl font-black ${
                                  item.correctRate >= 60
                                    ? "text-emerald-700"
                                    : item.correctRate >= 40
                                      ? "text-amber-700"
                                      : "text-rose-700"
                                }`}>
                                  %{item.correctRate.toFixed(1)}
                                </strong>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-5 gap-1.5">
                              {["A", "B", "C", "D", "E"].map((option) => (
                                <div
                                  key={option}
                                  className={`rounded-xl border px-1 py-2 text-center ${
                                    option === item.correctAnswer
                                      ? "border-emerald-300 bg-emerald-50"
                                      : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <strong className={`block text-xs font-black ${
                                    option === item.correctAnswer ? "text-emerald-700" : "text-slate-700"
                                  }`}>
                                    {option}
                                  </strong>
                                  <span className="mt-1 block text-sm font-black text-slate-900">
                                    {item.choiceCounts[option] || 0}
                                  </span>
                                  <span className="block text-[8px] font-bold text-slate-400">kişi</span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-xl bg-emerald-50 px-2 py-2">
                                <span className="block text-[8px] font-black uppercase text-emerald-700">Doğru</span>
                                <strong className="text-sm font-black text-emerald-800">{item.correctCount}</strong>
                              </div>
                              <div className="rounded-xl bg-rose-50 px-2 py-2">
                                <span className="block text-[8px] font-black uppercase text-rose-700">Yanlış</span>
                                <strong className="text-sm font-black text-rose-800">{item.wrongCount}</strong>
                              </div>
                              <div className="rounded-xl bg-slate-100 px-2 py-2">
                                <span className="block text-[8px] font-black uppercase text-slate-500">Boş</span>
                                <strong className="text-sm font-black text-slate-700">{item.emptyCount}</strong>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedTeacherSubjectResult && examResultsView === "compare" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                        <strong className="block text-sm font-black text-slate-900">
                          {selectedTeacherExam.examName} · {selectedTeacherSubjectResult.subjectName}
                        </strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-500">
                          Sınıflar net ortalamasına göre başarı sırasındadır. Turuncu işaretli sınıflar sizin ders verdiğiniz sınıflardır.
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedTeacherSubjectResult.classroomStats.map((row) => (
                          <div
                            key={row.classroom}
                            className={`rounded-2xl border p-3 ${
                              row.isTeacherClass
                                ? "border-orange-300 bg-orange-50 ring-1 ring-orange-100"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                row.isTeacherClass
                                  ? "bg-orange-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}>
                                {row.rank}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-sm font-black text-slate-900">{row.classroom}</strong>
                                  {row.isTeacherClass ? (
                                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[8px] font-black uppercase text-orange-700">
                                      Sizin sınıfınız
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mt-0.5 block text-[9px] font-bold text-slate-400">
                                  {row.participantCount} öğrenci
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[8px] font-black uppercase text-slate-400">Net Ort.</span>
                                <strong className="text-lg font-black text-violet-700">{row.net.toFixed(2)}</strong>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                              <div className="rounded-xl bg-emerald-50 px-1 py-2">
                                <span className="block text-[8px] font-black uppercase text-emerald-700">Doğru</span>
                                <strong className="text-sm font-black text-emerald-800">{row.correct.toFixed(2)}</strong>
                              </div>
                              <div className="rounded-xl bg-rose-50 px-1 py-2">
                                <span className="block text-[8px] font-black uppercase text-rose-700">Yanlış</span>
                                <strong className="text-sm font-black text-rose-800">{row.wrong.toFixed(2)}</strong>
                              </div>
                              <div className="rounded-xl bg-slate-100 px-1 py-2">
                                <span className="block text-[8px] font-black uppercase text-slate-500">Boş</span>
                                <strong className="text-sm font-black text-slate-700">{row.empty.toFixed(2)}</strong>
                              </div>
                              <div className="rounded-xl bg-violet-50 px-1 py-2">
                                <span className="block text-[8px] font-black uppercase text-violet-700">Net</span>
                                <strong className="text-sm font-black text-violet-800">{row.net.toFixed(2)}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {teacherQuestionPreview ? (
          <div
            className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm"
            onClick={() => setTeacherQuestionPreview(null)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <strong className="min-w-0 truncate text-sm font-black text-slate-900">{teacherQuestionPreview.title}</strong>
                <button
                  type="button"
                  onClick={() => setTeacherQuestionPreview(null)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                  title="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 overflow-auto bg-slate-100 p-3">
                <img
                  src={teacherQuestionPreview.url}
                  alt={teacherQuestionPreview.title}
                  className="mx-auto max-h-[80vh] max-w-full rounded-2xl bg-white object-contain shadow"
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (screen === "homework") {
    const sortedAssignments = [...homeworkAssignments].sort(
      (a, b) =>
        classroomSort(a.classroom, b.classroom) ||
        String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr-TR"),
    );

    const controlRows = [...homeworkOverviewSessions]
      .sort((a, b) =>
        String(b.createdAt || b.homeworkDate || "").localeCompare(
          String(a.createdAt || a.homeworkDate || ""),
        ),
      )
      .map((session) => ({
        key: `session:${session.id}`,
        session,
      }));

    const openAssignmentEditor = (assignment: HomeworkAssignment) => {
      setSelectedClassroom(assignment.classroom);
      setSelectedHomeworkCourse(assignment.courseName);
      setHomeworkSession(null);
      setHomeworkTopicDraft("");
      setHomeworkControlDateDraft(today());
      setHomeworkMessage("");
      setShowTopicEditor(true);
    };

    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50/45 to-white p-3 text-slate-800 sm:p-5">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <MobileSubHeader
            title="Ödev Kontrolü"
            subtitle={homeworkHistoryMode === "detail" && homeworkSession ? `${homeworkSession.classroom} · ${homeworkSession.courseName || "Ders"}` : link.teacherName}
            onBack={() => {
              if (homeworkHistoryMode === "detail") {
                setHomeworkHistoryMode("list");
                setHomeworkSession(null);
                setSelectedClassroom("");
                setSelectedHomeworkCourse("");
                setHomeworkResults({});
                void loadHomeworkOverview(true);
              } else goBackScreen();
            }}
            accent="emerald"
          />

          {homeworkHistoryMode !== "detail" ? (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <button type="button" onClick={() => { setHomeworkWorkspaceMode("assign"); setHomeworkMessage(""); }} className={`rounded-xl px-3 py-3 text-xs font-black ${homeworkWorkspaceMode === "assign" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>Ödev Kayıt</button>
                <button type="button" onClick={() => { setHomeworkWorkspaceMode("control"); setHomeworkMessage(""); }} className={`rounded-xl px-3 py-3 text-xs font-black ${homeworkWorkspaceMode === "control" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>Ödev Kontrol</button>
              </div>

              {homeworkMessage ? <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{homeworkMessage}</div> : null}

              {homeworkWorkspaceMode === "assign" ? (
                homeworkAssignmentsBusy && homeworkAssignments.length === 0 ? (
                  <div className="mt-4 rounded-2xl bg-emerald-50 p-5 text-center text-xs font-black text-emerald-700">
                    Sınıflar hazırlanıyor…
                  </div>
                ) : (
                <div className="mt-4">
                  <div className="mb-3"><strong className="block text-sm font-black text-slate-900">Sınıflarınız</strong><span className="text-[10px] font-bold text-slate-500">Her ders ataması ayrı bir butondur.</span></div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {sortedAssignments.map((assignment, index) => (
                      <button key={`${homeworkAssignmentKey(assignment.classroom, assignment.courseName)}:${index}`} type="button" onClick={() => openAssignmentEditor(assignment)} title={`${assignment.classroom} · ${assignment.courseName}`} className="min-h-[72px] rounded-2xl border-2 border-emerald-100 bg-white px-3 py-3 text-center shadow-sm transition active:scale-[0.98]">
                        <strong className="block text-base font-black text-slate-900">{assignment.classroom}</strong>
                        <span className="mt-1 block truncate text-[9px] font-bold text-emerald-700">{assignment.courseName}</span>
                      </button>
                    ))}
                  </div>
                  {sortedAssignments.length === 0 ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">Size atanmış sınıf/ders bulunamadı.</div> : null}
                </div>
                )
              ) : (
                <div className="mt-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><strong className="block text-sm font-black text-slate-900">Ödevler</strong><span className="text-[10px] font-bold text-slate-500">En yeni ödev en üsttedir.</span></div>
                    <div className="flex items-center gap-2 text-[8px] font-black"><span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Aktif</span><span className="rounded-full bg-slate-200 px-2 py-1 text-slate-600">Tamam</span></div>
                  </div>
                  <div className="space-y-2.5">
                    {controlRows.map((row) => {
                      const session = row.session;
                      const completed = Boolean(session.fullyEvaluated || session.completedAt);
                      return (
                        <button key={row.key} type="button" onClick={() => { setSelectedClassroom(session.classroom); setSelectedHomeworkCourse(session.courseName || ""); void openHomeworkSession(session); }} className={`flex min-h-[78px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${completed ? "border-slate-200 bg-slate-100" : "border-rose-300 bg-rose-50"}`}>
                          <span className={`flex h-11 min-w-16 items-center justify-center rounded-xl px-2 text-sm font-black ${completed ? "bg-slate-200 text-slate-600" : "bg-rose-600 text-white"}`}>{session.classroom}</span>
                          <div className="min-w-0 flex-1"><strong className="block truncate text-xs font-black text-slate-900">{session.topic}</strong><span className="mt-0.5 block truncate text-[9px] font-bold text-slate-500">{session.courseName || "Ders"} · Kontrol: {homeworkControlDate(session)}</span><span className="mt-0.5 block text-[8.5px] font-semibold text-slate-400">Değerlendirilen: {Number(session.evaluatedCount || 0)}/{Number(session.totalStudents || 0) || "—"}</span></div>
                          <ChevronRight className={`h-5 w-5 ${completed ? "text-slate-400" : "text-rose-500"}`} />
                        </button>
                      );
                    })}
                    {homeworkOverviewBusy && controlRows.length === 0 ? (
                      <div className="rounded-2xl bg-rose-50 p-5 text-center text-xs font-black text-rose-700">
                        Ödevler hazırlanıyor…
                      </div>
                    ) : null}
                    {!homeworkOverviewBusy && controlRows.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
                        Kayıt yapılmış ödev bulunmuyor.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              {homeworkSession ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3"><strong className="block text-sm font-black text-slate-900">{homeworkSession.topic}</strong><span className="mt-1 block text-[10px] font-bold text-slate-500">{homeworkSession.classroom} · {homeworkSession.courseName || "Ders"} · Kontrol: {homeworkControlDate(homeworkSession)}</span></div> : null}
              <div className="mb-3"><strong className="text-sm font-black text-slate-800">Öğrenciler</strong><span className="ml-2 text-[10px] font-bold text-slate-500">{evaluatedCount}/{classroomTotal} değerlendirildi</span></div>
              <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-0.5">
                {classroomStudentsAll.map((student) => {
                  const current = homeworkResults[student.id];
                  return <div key={student.id} className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-9 min-w-11 items-center justify-center rounded-xl bg-slate-100 px-2 text-xs font-black text-slate-700">{studentSchoolNumber(student) || "—"}</span><strong className="min-w-0 flex-1 truncate text-sm text-slate-900">{student.name}</strong>{current ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : null}</div><div className="mt-3 grid grid-cols-2 gap-2">{HOMEWORK_STATUSES.map((status) => <button key={status.value} disabled={homeworkBusy} onClick={() => void saveHomeworkEvaluation(student, status.value)} className={`min-h-10 rounded-xl border px-2 py-2 text-[10px] font-black transition active:scale-[0.98] disabled:opacity-60 ${current === status.value ? status.selectedClassName : status.className}`}>{status.value}</button>)}</div></div>;
                })}
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold leading-4 text-slate-500">Her öğrenci değerlendirmesi anında kaydedilir. Tüm öğrencilerin değerlendirilmesi zorunlu değildir. Tümü değerlendirildiğinde bu ödevin butonu otomatik olarak açık griye döner.</div>
            </div>
          )}
        </div>

        {showTopicEditor && selectedClassroom ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
            <div className="w-full max-w-xl rounded-[26px] bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between"><div><strong className="block text-base font-black text-slate-900">Ödev Kayıt</strong><span className="text-[10px] font-bold text-slate-500">{selectedClassroom} · {selectedHomeworkCourse}</span></div><button type="button" onClick={() => { setShowTopicEditor(false); setSelectedClassroom(""); setSelectedHomeworkCourse(""); setHomeworkTopicDraft(""); }} className="rounded-xl bg-slate-100 p-2 text-slate-600"><X className="h-5 w-5" /></button></div>
              <label className="mt-4 block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Ödev Konusu</span><textarea autoFocus value={homeworkTopicDraft} onChange={(event) => setHomeworkTopicDraft(event.target.value)} rows={4} placeholder="Ödev konusunu yazınız" className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
              <label className="mt-3 block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Ödev Kontrol Tarihi</span><input type="date" min={today()} value={homeworkControlDateDraft} onChange={(event) => setHomeworkControlDateDraft(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-emerald-500" /></label>
              <button type="button" disabled={homeworkBusy || !homeworkTopicDraft.trim() || !homeworkControlDateDraft} onClick={() => void saveHomeworkTopic()} className="mt-4 w-full rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-black text-white shadow-lg disabled:bg-slate-300">{homeworkBusy ? "Kaydediliyor…" : "Ödevi Kaydet"}</button>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (screen === "behavior") {
    const behaviorOptions = link.behaviors;

    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50/45 to-white p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
        <MobileSubHeader
          title="Davranış Kaydı"
          subtitle={link.teacherName}
          onBack={() => goBackScreen()}
          accent="orange"
        />

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <button
              onClick={() => changeBehaviorMode("single")}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-black sm:text-sm ${
                behaviorMode === "single"
                  ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
                  : "text-slate-500"
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              Kayıt
            </button>
            <button
              onClick={() => changeBehaviorMode("bulk")}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-black sm:text-sm ${
                behaviorMode === "bulk"
                  ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
                  : "text-slate-500"
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              Çoklu Kayıt
            </button>
            <button
              onClick={() => changeBehaviorMode("search")}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-black sm:text-sm ${
                behaviorMode === "search"
                  ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
                  : "text-slate-500"
              }`}
            >
              <Search className="h-4 w-4 shrink-0" />
              Kayıt Ara
            </button>
          </div>

          {behaviorMode === "single" ? (
            <div className="mt-5 space-y-4">
              <BehaviorSelect
                value={behavior}
                onChange={setBehavior}
                options={behaviorOptions}
              />
              <StudentSearch
                query={query}
                setQuery={(value) => {
                  setQuery(value);
                  setSelectedStudent(null);
                }}
                results={searchResults}
                onSelect={(student) => {
                  setSelectedStudent(student);
                  setQuery(`${canonicalStudentNumber(student)} · ${student.name}`);
                }}
              />
              {selectedStudent && (
                <SelectedStudentCard student={selectedStudent} />
              )}
              <button
                disabled={saving || !selectedStudent || !behavior}
                onClick={saveBehavior}
                className="w-full rounded-2xl bg-orange-600 px-5 py-4 text-sm font-black text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300"
              >
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          ) : behaviorMode === "bulk" ? (
            <div className="mt-5 space-y-4">
              <BehaviorSelect
                value={behavior}
                onChange={(value) => {
                  setBehavior(value);
                  setSelectedStudents([]);
                }}
                options={behaviorOptions}
              />

              <section>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Sınıf
                </label>
                <select
                  value={bulkClassroom}
                  onChange={(event) => {
                    setBulkClassroom(event.target.value);
                    setBulkQuery("");
                    setSelectedStudents([]);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-orange-500"
                >
                  <option value="">Sınıf seçiniz…</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom} value={classroom}>
                      {classroom}
                    </option>
                  ))}
                </select>
              </section>

              {behavior && bulkClassroom && (
                <>
                  <section>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Öğrenci No / Ad
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <input
                        value={bulkQuery}
                        onChange={(event) =>
                          setBulkQuery(event.target.value)
                        }
                        placeholder="Numara veya öğrenci adı"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-teal-100"
                      />
                    </div>
                  </section>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                      <strong className="text-[11px] text-slate-700">
                        {bulkClassroom} · Numara sırası
                      </strong>
                      <button
                        onClick={toggleAllVisibleBulk}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black text-orange-700 shadow-sm"
                      >
                        {allVisibleBulkSelected
                          ? "Seçimi Kaldır"
                          : "Tümünü Seç"}
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-2">
                      {bulkStudents.map((student) => {
                        const selected = selectedStudents.some(
                          (item) => item.id === student.id,
                        );
                        return (
                          <button
                            key={student.id}
                            onClick={() => toggleBulkStudent(student)}
                            className={`mb-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                              selected
                                ? "border-teal-300 bg-teal-50"
                                : "border-transparent bg-white hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`flex h-8 min-w-10 items-center justify-center rounded-lg px-2 text-[11px] font-black ${
                                selected
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {studentSchoolNumber(student) || "—"}
                            </span>
                            <strong className="min-w-0 flex-1 truncate text-xs text-slate-900">
                              {student.name}
                            </strong>
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                selected
                                  ? "border-teal-600 bg-teal-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedStudents.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2 text-xs">
                      <strong className="text-teal-900">
                        {selectedStudents.length} öğrenci seçildi
                      </strong>
                      <button
                        onClick={() => setSelectedStudents([])}
                        className="font-black text-rose-600"
                      >
                        Temizle
                      </button>
                    </div>
                  )}
                </>
              )}

              <button
                disabled={
                  saving ||
                  !behavior ||
                  !bulkClassroom ||
                  !selectedStudents.length
                }
                onClick={saveBehavior}
                className="w-full rounded-2xl bg-teal-700 px-5 py-4 text-sm font-black text-white shadow-lg disabled:bg-slate-300"
              >
                {saving
                  ? "Kaydediliyor…"
                  : selectedStudents.length
                    ? `${selectedStudents.length} Öğrenciyi Kaydet`
                    : "Öğrencileri Seçin"}
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <section>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Öğrenci No / Ad Soyad
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    value={behaviorSearchQuery}
                    onChange={(event) => {
                      setBehaviorSearchQuery(event.target.value);
                      setBehaviorHistoryStudent(null);
                      setBehaviorHistory([]);
                      setBehaviorHistoryError("");
                    }}
                    placeholder="Öğrenci numarası, adı veya soyadı"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </section>

              {!behaviorHistoryStudent && behaviorSearchQuery.trim() ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <strong className="text-[11px] text-slate-700">
                      Öğrenci seçiniz
                    </strong>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {behaviorHistorySearchResults.length ? (
                      behaviorHistorySearchResults.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => void loadBehaviorHistory(student)}
                          className="mb-1.5 flex w-full items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 text-left transition hover:bg-orange-50 active:bg-orange-50"
                        >
                          <span className="flex h-9 min-w-11 items-center justify-center rounded-lg bg-orange-100 px-2 text-[11px] font-black text-orange-800">
                            {studentSchoolNumber(student) || "—"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-xs text-slate-900">
                              {student.name}
                            </strong>
                            <span className="mt-0.5 block text-[9px] font-bold text-slate-500">
                              {student.classroom || "Sınıf bilgisi yok"}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-8 text-center text-xs font-bold text-slate-400">
                        Aramanızla eşleşen öğrenci bulunamadı.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {behaviorHistoryStudent ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 min-w-12 items-center justify-center rounded-xl bg-orange-600 px-2 text-xs font-black text-white">
                        {behaviorHistoryStudent.number || "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-black text-slate-900">
                          {behaviorHistoryStudent.name}
                        </strong>
                        <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
                          {behaviorHistoryStudent.classroom || "Sınıf bilgisi yok"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBehaviorHistoryStudent(null);
                          setBehaviorHistory([]);
                          setBehaviorHistoryError("");
                        }}
                        className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-orange-700 shadow-sm"
                      >
                        Değiştir
                      </button>
                    </div>
                  </div>

                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">
                          Davranış Geçmişi
                        </span>
                        <strong className="mt-0.5 block text-xs text-slate-800">
                          {behaviorHistoryBusy ? "Kayıtlar getiriliyor…" : `${behaviorHistory.length} kayıt`}
                        </strong>
                      </div>
                      <button
                        type="button"
                        disabled={behaviorHistoryBusy}
                        onClick={() => void loadBehaviorHistory(behaviorHistoryStudent)}
                        className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-orange-700 shadow-sm disabled:text-slate-400"
                      >
                        Yenile
                      </button>
                    </div>

                    {behaviorHistoryError ? (
                      <div className="m-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700">
                        {behaviorHistoryError}
                      </div>
                    ) : null}

                    <div className="max-h-[430px] overflow-y-auto p-2.5">
                      {behaviorHistoryBusy ? (
                        <div className="px-3 py-10 text-center text-xs font-bold text-slate-400">
                          Davranış kayıtları yükleniyor…
                        </div>
                      ) : behaviorHistory.length ? (
                        behaviorHistory.map((record) => (
                          <article key={record.id} className="mb-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <strong className="block text-xs font-black text-slate-900">
                                  {record.behaviorName || record.behaviorType || "Davranış Kaydı"}
                                </strong>
                                <span className="mt-1 block text-[9px] font-bold text-slate-500">
                                  {record.date || "Tarih bilgisi yok"}
                                  {record.teacherName ? ` · ${record.teacherName}` : ""}
                                </span>
                              </div>
                              <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[8px] font-black text-orange-700">
                                {record.behaviorType || "Kayıt"}
                              </span>
                            </div>
                            {record.description ? (
                              <p className="mt-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[9px] font-semibold leading-4 text-slate-600">
                                {record.description}
                              </p>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <div className="px-3 py-10 text-center">
                          <CheckCircle2 className="mx-auto h-7 w-7 text-slate-300" />
                          <strong className="mt-2 block text-xs text-slate-500">
                            Davranış kaydı bulunamadı
                          </strong>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          )}

          {message && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-2xl border p-3 text-xs font-bold ${
                message.includes("başarıyla")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
    );
  }

  return null;
}
