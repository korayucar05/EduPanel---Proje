import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
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
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import type { Student, Teacher } from "../types";
import { deleteLocalDocument, fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../lib/localDatabase";
import { sqliteStorage } from "../lib/sqliteStorageBridge";
import ExamAnalysisModule from "./ExamAnalysisModule";
import { examAnalysisService } from "../modules/exam/ExamAnalysisService";
import { CURRICULUM_UPDATED_EVENT, loadAuthoritativeCurriculumStore, readLegacyCurriculumStore, type CurriculumStore } from "../services/curriculumRepository";
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
  onNavigate?: (tab: string, context?: any) => void;
}

type CoachView = "registration" | "exam-calendar" | "exam-contents" | "dashboard" | "analysis-center" | "students" | "tasks" | "meetings" | "warnings" | "messages" | "reports" | "mobile";
type StudentCardTab = "overview" | "academic" | "tasks" | "history";
type ControlCenterTab = "tracking" | "champions" | "analysis";

type CoachWarning = {
  id: string;
  studentId: string;
  studentName: string;
  classroom: string;
  level: "critical" | "attention" | "positive";
  title: string;
  detail: string;
};

type TrialClubRegistration = {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  gradeLevel: string;
  teacherIds: string[];
  teacherNames: string[];
  schoolId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};



type TrialClubLeagueGroup = {
  id: string;
  name: string;
  gradeLevel: string;
  studentIds: string[];
  studentNumbers: string[];
  studentNames: string[];
  teacherIds: string[];
  teacherNames: string[];
  schoolId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type CoachExamCalendarContent = {
  id: string;
  subject: string;
  topics: string;
};

type CoachExamCalendarItem = {
  id: string;
  gradeLevel: string;
  examName: string;
  examNumber: number;
  examDate: string;
  contents: CoachExamCalendarContent[];
  schoolId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type CoachExamCalendarDraft = {
  examName: string;
  examNumber: string;
  examDate: string;
};

type CoachExamBlueprintRow = {
  id: string;
  subject: string;
  courseId: string;
  grade: string;
  unitId: string;
  unitName: string;
  topicId: string;
  topicName: string;
  outcomeId: string;
  outcomeName: string;
  scopeType: "unit" | "topic" | "outcome";
  includeAllTopics: boolean;
  includeAllOutcomes: boolean;
  count: number;
};

type CoachExamContentPlan = {
  id: string;
  calendarId: string;
  schoolId: string;
  gradeLevel: string;
  examName: string;
  examNumber: number;
  examDate: string;
  questionBlueprint: CoachExamBlueprintRow[];
  createdExamId?: string;
  createdExamAt?: string;
  createdAt: string;
  updatedAt: string;
};

type CoachExamContentDraft = {
  courseId: string;
  unitId: string;
  topicId: string;
  outcomeId: string;
  count: number;
};

const emptyExamContentDraft = (): CoachExamContentDraft => ({
  courseId: "",
  unitId: "",
  topicId: "",
  outcomeId: "",
  count: 1,
});

const viewLabels: Record<CoachView, string> = {
  registration: "Kayıt Merkezi",
  "exam-calendar": "Sınav Takvimi",
  "exam-contents": "Deneme İçerikleri",
  dashboard: "Kontrol Merkezi",
  "analysis-center": "Analiz Merkezi",
  students: "Geri Bildirim",
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
const studentGradeLevel = (student: any) => studentClassroom(student).match(/(?:^|\D)(9|10|11|12)(?:\D|$)/)?.[1] || String(student?.gradeLevel || "").match(/^(9|10|11|12)$/)?.[1] || "";

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

export default function EducationCoachModule({ students = [], schoolId = "school-main", currentUserName = "Eğitim Koçu", onNavigate }: EducationCoachModuleProps) {
  const [view, setView] = useState<CoachView>(() => {
    try {
      const saved = sessionStorage.getItem("edupanel_education_coach_subtab") as CoachView | null;
      return saved && saved in viewLabels ? saved : "dashboard";
    } catch { return "dashboard"; }
  });
  const [studentCardTab, setStudentCardTab] = useState<StudentCardTab>("overview");
  const [profiles, setProfiles] = useState<CoachProfile[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [coachTeachers, setCoachTeachers] = useState<Teacher[]>([]);
  const [trialClubRegistrations, setTrialClubRegistrations] = useState<TrialClubRegistration[]>([]);
  const [controlCenterTab, setControlCenterTab] = useState<ControlCenterTab>("tracking");
  const [leagueGroups, setLeagueGroups] = useState<TrialClubLeagueGroup[]>([]);
  const [leagueColumnCount, setLeagueColumnCount] = useState<3 | 4>(4);
  const [leagueGroupNameDrafts, setLeagueGroupNameDrafts] = useState<Record<string, string>>({ "9": "", "10": "", "11": "", "12": "" });
  const [leagueStudentPicker, setLeagueStudentPicker] = useState<{ studentId: string; gradeLevel: string } | null>(null);
  const [leagueGroupStudentModalId, setLeagueGroupStudentModalId] = useState("");
  const [leagueGroupStudentDraftIds, setLeagueGroupStudentDraftIds] = useState<string[]>([]);
  const [expandedLeagueGroupId, setExpandedLeagueGroupId] = useState("");
  const [registrationStudentId, setRegistrationStudentId] = useState("");
  const [registrationStudentSearch, setRegistrationStudentSearch] = useState("");
  const [registrationListGradeFilter, setRegistrationListGradeFilter] = useState("Tümü");
  const [examCalendarItems, setExamCalendarItems] = useState<CoachExamCalendarItem[]>([]);
  const [examCalendarGrade, setExamCalendarGrade] = useState("9");
  const [examCalendarEditingId, setExamCalendarEditingId] = useState("");
  const [examCalendarDraft, setExamCalendarDraft] = useState<CoachExamCalendarDraft>(() => ({
    examName: "",
    examNumber: "1",
    examDate: isoDay(),
  }));
  const [examContentPlans, setExamContentPlans] = useState<CoachExamContentPlan[]>([]);
  const [examContentGrade, setExamContentGrade] = useState("9");
  const [examContentCalendarId, setExamContentCalendarId] = useState("");
  const [examContentEditorOpen, setExamContentEditorOpen] = useState(false);
  const [examContentBlueprint, setExamContentBlueprint] = useState<CoachExamBlueprintRow[]>([]);
  const [examContentDraft, setExamContentDraft] = useState<CoachExamContentDraft>(emptyExamContentDraft);
  const [examCurriculumStore, setExamCurriculumStore] = useState<CurriculumStore>(readLegacyCurriculumStore);
  const [examCurriculumError, setExamCurriculumError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState("Tümü");
  const [feedbackGradeFilter, setFeedbackGradeFilter] = useState("Tümü");
  const [taskDraft, setTaskDraft] = useState({ title: "", subject: "", unit: "", topic: "", outcome: "", questionCount: "", plannedDate: isoDay(), dueDate: "", note: "" });
  const [meetingDraft, setMeetingDraft] = useState({ date: isoDay(), previousWeek: "", strengths: "", challenges: "", priority: "", newGoal: "", motivation: 3, nextMeetingDate: "" });
  const [messageDraft, setMessageDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState({ targetUniversity: "", targetDepartment: "", targetExam: "", shortTermGoal: "", longTermGoal: "", nextMeetingDate: "" });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [savedProfiles, savedExams, savedTeachers, legacyTeachers, savedRegistrations, savedExamCalendar, savedExamContents, savedLeagueGroups] = await Promise.all([
      loadCoachProfiles(),
      readCoachExams(),
      fetchCollectionFromLocalDatabase("teachers").catch(() => []),
      fetchCollectionFromLocalDatabase("school_teachers").catch(() => []),
      fetchCollectionFromLocalDatabase("trial_club_registrations").catch(() => []),
      fetchCollectionFromLocalDatabase("education_coach_exam_calendar").catch(() => []),
      fetchCollectionFromLocalDatabase("education_coach_exam_contents").catch(() => []),
      fetchCollectionFromLocalDatabase("trial_club_league_groups").catch(() => []),
    ]);
    setProfiles(savedProfiles);
    setExams(savedExams);
    const teacherMap = new Map<string, Teacher>();
    [...(Array.isArray(savedTeachers) ? savedTeachers : []), ...(Array.isArray(legacyTeachers) ? legacyTeachers : [])].forEach((teacher: any) => {
      const key = String(teacher?.id || teacher?.teacherId || teacher?.name || "").trim();
      if (key && !teacherMap.has(key)) teacherMap.set(key, teacher as Teacher);
    });
    setCoachTeachers(Array.from(teacherMap.values()));
    setTrialClubRegistrations(
      (Array.isArray(savedRegistrations) ? savedRegistrations : [])
        .filter((item: any) => item && item.active !== false)
        .map((item: any) => ({
          ...item,
          id: String(item.id || item.studentId || ""),
          studentId: String(item.studentId || ""),
          studentNumber: normalizeCoachStudentNumber(item.studentNumber),
          studentName: String(item.studentName || "Öğrenci"),
          classroom: String(item.classroom || ""),
          gradeLevel: String(item.gradeLevel || ""),
          teacherIds: Array.isArray(item.teacherIds) ? item.teacherIds.map(String) : [],
          teacherNames: Array.isArray(item.teacherNames) ? item.teacherNames.map(String) : [],
          schoolId: String(item.schoolId || schoolId),
          active: item.active !== false,
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        }))
        .filter((item: TrialClubRegistration) => Boolean(item.id && item.studentId)),
    );
    setLeagueGroups(
      (Array.isArray(savedLeagueGroups) ? savedLeagueGroups : [])
        .filter((item: any) => item && item.active !== false)
        .map((item: any) => ({
          id: String(item.id || ""),
          name: String(item.name || "Grup"),
          gradeLevel: String(item.gradeLevel || ""),
          studentIds: Array.isArray(item.studentIds) ? item.studentIds.map(String) : [],
          studentNumbers: Array.isArray(item.studentNumbers) ? item.studentNumbers.map((value: unknown) => normalizeCoachStudentNumber(value)) : [],
          studentNames: Array.isArray(item.studentNames) ? item.studentNames.map(String) : [],
          teacherIds: Array.isArray(item.teacherIds) ? item.teacherIds.map(String) : [],
          teacherNames: Array.isArray(item.teacherNames) ? item.teacherNames.map(String) : [],
          schoolId: String(item.schoolId || schoolId),
          active: item.active !== false,
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        }))
        .filter((item: TrialClubLeagueGroup) => Boolean(item.id)),
    );
    setExamCalendarItems(
      (Array.isArray(savedExamCalendar) ? savedExamCalendar : [])
        .filter((item: any) => item && item.active !== false)
        .map((item: any) => ({
          id: String(item.id || ""),
          gradeLevel: String(item.gradeLevel || ""),
          examName: String(item.examName || "Deneme"),
          examNumber: Math.max(1, Number(item.examNumber || 1)),
          examDate: String(item.examDate || ""),
          contents: (Array.isArray(item.contents) ? item.contents : []).map((content: any, index: number) => ({
            id: String(content?.id || `${item.id || "calendar"}-content-${index}`),
            subject: String(content?.subject || ""),
            topics: String(content?.topics || ""),
          })).filter((content: CoachExamCalendarContent) => Boolean(content.subject || content.topics)),
          schoolId: String(item.schoolId || schoolId),
          active: item.active !== false,
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        }))
        .filter((item: CoachExamCalendarItem) => Boolean(item.id && ["9", "10", "11", "12"].includes(item.gradeLevel))),
    );
    setExamContentPlans(
      (Array.isArray(savedExamContents) ? savedExamContents : [])
        .filter((item: any) => item && item.calendarId)
        .map((item: any) => ({
          id: String(item.id || `exam-content-${item.calendarId}`),
          calendarId: String(item.calendarId || ""),
          schoolId: String(item.schoolId || schoolId),
          gradeLevel: String(item.gradeLevel || ""),
          examName: String(item.examName || "Deneme"),
          examNumber: Math.max(1, Number(item.examNumber || 1)),
          examDate: String(item.examDate || ""),
          questionBlueprint: (Array.isArray(item.questionBlueprint) ? item.questionBlueprint : []).map((row: any, index: number) => ({
            id: String(row?.id || `${item.calendarId}-scope-${index}`),
            subject: String(row?.subject || ""),
            courseId: String(row?.courseId || ""),
            grade: String(row?.grade || item.gradeLevel || ""),
            unitId: String(row?.unitId || ""),
            unitName: String(row?.unitName || ""),
            topicId: String(row?.topicId || ""),
            topicName: String(row?.topicName || ""),
            outcomeId: String(row?.outcomeId || ""),
            outcomeName: String(row?.outcomeName || ""),
            scopeType: row?.scopeType === "unit" || row?.scopeType === "topic" ? row.scopeType : "outcome",
            includeAllTopics: row?.includeAllTopics === true,
            includeAllOutcomes: row?.includeAllOutcomes === true,
            count: Math.max(1, Number(row?.count || 1)),
          })).filter((row: CoachExamBlueprintRow) => Boolean(row.subject && row.unitName)),
          createdExamId: String(item.createdExamId || "") || undefined,
          createdExamAt: String(item.createdExamAt || "") || undefined,
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        }))
        .filter((item: CoachExamContentPlan) => Boolean(item.id && item.calendarId)),
    );
    if (!quiet) setLoading(false);
  }, [schoolId]);

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

  useEffect(() => {
    if (!examContentEditorOpen) return;
    let stopped = false;
    const refreshCurriculum = async () => {
      try {
        const store = await loadAuthoritativeCurriculumStore();
        if (!stopped) {
          setExamCurriculumStore(store);
          setExamCurriculumError("");
        }
      } catch (error) {
        if (!stopped) setExamCurriculumError(error instanceof Error ? error.message : String(error));
      }
    };
    void refreshCurriculum();
    window.addEventListener(CURRICULUM_UPDATED_EVENT, refreshCurriculum);
    return () => {
      stopped = true;
      window.removeEventListener(CURRICULUM_UPDATED_EVENT, refreshCurriculum);
    };
  }, [examContentEditorOpen]);

  const curriculumCatalogForExamContents = useMemo(() => {
    const sourceCourses: any[] = [];
    for (const key of ["custom_created_courses", "school_courses"]) {
      try {
        const parsed = JSON.parse(sqliteStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) sourceCourses.push(...parsed);
      } catch {}
    }
    const courses: any[] = [];
    Object.entries(examCurriculumStore || {}).forEach(([storageKey, raw]: any) => {
      const curriculum = raw || {};
      const id = String(storageKey).replace(/^curriculum_/, "");
      const source = sourceCourses.find((item: any) => String(item.id || item.courseId || "") === id) || {};
      const grade = String(
        curriculum.grade || curriculum.gradeLevel || curriculum.__curriculumMeta?.grade ||
        source.gradeLevel || source.level || id.match(/^CURR-(9|10|11|12)-/)?.[1] || "",
      ).match(/\d{1,2}/)?.[0] || "";
      const name = String(
        curriculum.courseName || curriculum.name || curriculum.__curriculumMeta?.courseName ||
        source.courseName || source.name || "",
      ).trim();
      if (grade && name && Array.isArray(curriculum.units)) courses.push({ id, grade, name, units: curriculum.units });
    });
    return courses;
  }, [examCurriculumStore]);

  const availableExamContentCourses = useMemo(() =>
    curriculumCatalogForExamContents
      .filter((course: any) => String(course.grade) === String(examContentGrade))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "tr-TR")),
    [curriculumCatalogForExamContents, examContentGrade],
  );

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.studentId, profile])), [profiles]);
  const numberProfileMap = useMemo(() => new Map(profiles.map((profile) => [normalizeCoachStudentNumber(profile.studentNumber), profile])), [profiles]);
  const studentMap = useMemo(() => new Map(students.map((student) => [String(student.id), student])), [students]);

  const feedbackStudentRows = useMemo(() => {
    const activeRegistrations = trialClubRegistrations.filter((item) => item.active !== false);
    return activeRegistrations
      .map((registration) => {
        const student = studentMap.get(String(registration.studentId))
          || students.find((item) => studentNumber(item) === normalizeCoachStudentNumber(registration.studentNumber));
        return student ? { student, registration } : null;
      })
      .filter((row): row is { student: Student; registration: TrialClubRegistration } => Boolean(row))
      .sort((a, b) => {
        const gradeA = a.registration.gradeLevel || studentGradeLevel(a.student);
        const gradeB = b.registration.gradeLevel || studentGradeLevel(b.student);
        const classroomA = a.registration.classroom || studentClassroom(a.student);
        const classroomB = b.registration.classroom || studentClassroom(b.student);
        return gradeA.localeCompare(gradeB, "tr", { numeric: true })
          || classroomA.localeCompare(classroomB, "tr", { numeric: true })
          || a.registration.studentName.localeCompare(b.registration.studentName, "tr");
      });
  }, [trialClubRegistrations, studentMap, students]);

  const feedbackClassrooms = useMemo(() => Array.from(new Set(
    feedbackStudentRows.map(({ student, registration }) => registration.classroom || studentClassroom(student)).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, "tr", { numeric: true })), [feedbackStudentRows]);

  const filteredFeedbackStudentRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return feedbackStudentRows.filter(({ student, registration }) => {
      const classroom = registration.classroom || studentClassroom(student);
      const gradeLevel = registration.gradeLevel || studentGradeLevel(student);
      const matchesGrade = feedbackGradeFilter === "Tümü" || gradeLevel === feedbackGradeFilter;
      const matchesClassroom = selectedClassroom === "Tümü" || classroom === selectedClassroom;
      const haystack = `${registration.studentName || studentName(student)} ${registration.studentNumber || studentNumber(student)} ${classroom} ${registration.teacherNames.join(" ")}`.toLocaleLowerCase("tr-TR");
      return matchesGrade && matchesClassroom && (!query || haystack.includes(query));
    });
  }, [feedbackStudentRows, feedbackGradeFilter, search, selectedClassroom]);

  const feedbackGradeCounts = useMemo(() => {
    const counts: Record<string, number> = { "9": 0, "10": 0, "11": 0, "12": 0 };
    feedbackStudentRows.forEach(({ student, registration }) => {
      const gradeLevel = registration.gradeLevel || studentGradeLevel(student);
      if (gradeLevel in counts) counts[gradeLevel] += 1;
    });
    return counts;
  }, [feedbackStudentRows]);

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

    // Eğitim Koçu mesajı yalnız koç profiline hapsolmasın; öğrencinin genel
    // Mesajlar > Gelenler kutusuna ve kayıtlı cihazına da ulaşsın.
    void fetch("/api/internal-messages/desktop-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: currentUserName || "Eğitim Koçu",
        title: "Eğitim Koçu Mesajı",
        body: message.text,
        schoolId,
        recipients: [
          {
            role: "Öğrenci",
            name: selectedProfile.studentName,
            studentId: selectedProfile.studentId,
            studentNumber: selectedProfile.studentNumber,
            studentName: selectedProfile.studentName,
            classroom: selectedProfile.classroom,
          },
        ],
      }),
    }).catch(() => undefined);

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

  const registeredStudentIds = useMemo(
    () => new Set(trialClubRegistrations.filter((item) => item.active !== false).map((item) => String(item.studentId))),
    [trialClubRegistrations],
  );

  const registrationStudents = useMemo(() => {
    return [...students]
      .sort((a, b) => studentClassroom(a).localeCompare(studentClassroom(b), "tr", { numeric: true }) || studentName(a).localeCompare(studentName(b), "tr"));
  }, [students]);

  const registrationStudentMatches = useMemo(() => {
    const rawQuery = registrationStudentSearch.trim();
    if (!rawQuery) return [];

    // Yalnızca rakam girildiyse okul numarası tam eşleşir.
    // Örn. 32 aramasında 132, 321 veya 1032 listelenmez.
    if (/^\d+$/.test(rawQuery)) {
      const normalizedQuery = rawQuery.replace(/^0+(?=\d)/, "");
      return registrationStudents
        .filter((student) => String(studentNumber(student)).trim().replace(/^0+(?=\d)/, "") === normalizedQuery)
        .slice(0, 12);
    }

    const query = rawQuery.toLocaleLowerCase("tr-TR");
    return registrationStudents
      .filter((student) => studentName(student).toLocaleLowerCase("tr-TR").includes(query))
      .slice(0, 12);
  }, [registrationStudents, registrationStudentSearch]);

  const filteredTrialClubRegistrations = useMemo(() => {
    const groupedStudentIds = new Set(
      leagueGroups
        .filter((group) => group.active !== false)
        .flatMap((group) => group.studentIds.map(String)),
    );
    return [...trialClubRegistrations]
      .filter((item) => item.active !== false)
      .filter((item) => !groupedStudentIds.has(String(item.studentId)))
      .filter((item) => registrationListGradeFilter === "Tümü" || item.gradeLevel === registrationListGradeFilter)
      .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, "tr", { numeric: true }) || a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.studentName.localeCompare(b.studentName, "tr"));
  }, [trialClubRegistrations, registrationListGradeFilter, leagueGroups]);

  const selectRegistrationStudent = (studentId: string) => {
    setRegistrationStudentId(studentId);
    const student = students.find((item) => String(item.id) === String(studentId));
    setRegistrationStudentSearch(student ? `${studentNumber(student)} • ${studentName(student)}` : "");
  };

  const saveTrialClubRegistration = async (studentId: string = registrationStudentId) => {
    if (saving) return;
    const student = students.find((item) => String(item.id) === String(studentId));
    if (!student) { window.alert("Deneme kulübüne kaydedilecek öğrenciyi seçiniz."); return; }

    const existing = trialClubRegistrations.find((item) => String(item.studentId) === String(student.id));
    const now = new Date().toISOString();
    const record: TrialClubRegistration = {
      id: existing?.id || `trial-club-${String(student.id)}`,
      studentId: String(student.id),
      studentNumber: studentNumber(student),
      studentName: studentName(student),
      classroom: studentClassroom(student),
      gradeLevel: studentGradeLevel(student),
      teacherIds: existing?.teacherIds || [],
      teacherNames: existing?.teacherNames || [],
      schoolId,
      active: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      setSaving(true);
      await upsertLocalDocument("trial_club_registrations", record.id, record);
      setTrialClubRegistrations((current) => [...current.filter((item) => item.id !== record.id), record]);
      setRegistrationStudentId("");
      setRegistrationStudentSearch("");
    } catch (error) {
      console.error("Deneme kulübü kaydı kaydedilemedi:", error);
      window.alert(error instanceof Error ? error.message : "Deneme kulübü kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const removeTrialClubRegistration = async (registration: TrialClubRegistration) => {
    if (!window.confirm(`${registration.studentName} adlı öğrenciyi Deneme Kulübü kayıtlarından çıkarmak istiyor musunuz?`)) return;
    try {
      setSaving(true);
      await deleteLocalDocument("trial_club_registrations", registration.id);
      setTrialClubRegistrations((current) => current.filter((item) => item.id !== registration.id));
      if (registrationStudentId === registration.studentId) {
        setRegistrationStudentId("");
        setRegistrationStudentSearch("");
      }
    } catch (error) {
      console.error("Deneme kulübü kaydı silinemedi:", error);
      window.alert(error instanceof Error ? error.message : "Deneme kulübü kaydı silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const activeTrialClubRegistrations = useMemo(
    () => trialClubRegistrations.filter((item) => item.active !== false),
    [trialClubRegistrations],
  );

  const trialClubAnalysisStudents = useMemo(() => {
    const rows: Student[] = [];
    const seen = new Set<string>();
    activeTrialClubRegistrations.forEach((registration) => {
      const student = studentMap.get(String(registration.studentId))
        || students.find((item) => studentNumber(item) === normalizeCoachStudentNumber(registration.studentNumber));
      if (!student) return;
      const key = String(student.id || registration.studentId);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(student);
    });
    return rows;
  }, [activeTrialClubRegistrations, studentMap, students]);

  const usedLeagueStudentIds = useMemo(() => new Set(
    leagueGroups
      .filter((group) => group.active !== false)
      .flatMap((group) => group.studentIds.map(String)),
  ), [leagueGroups]);

  const trialClubEvaluatedExams = useMemo(() => (Array.isArray(exams) ? exams : [])
    .filter((exam: any) => String(exam?.participantGroup || "").toLowerCase() === "trial-club" || String(exam?.participantLabel || exam?.targetAudience || "").toLocaleLowerCase("tr-TR").includes("deneme kulüb"))
    .filter((exam: any) => exam?.isEvaluated === true || String(exam?.examStatus || "").toLocaleLowerCase("tr-TR") === "değerlendirildi")
    .sort((a: any, b: any) => parseDate(a?.examDate || a?.date || a?.createdAt) - parseDate(b?.examDate || b?.date || b?.createdAt)),
  [exams]);

  const trialClubExamResults = useMemo(() => trialClubEvaluatedExams.map((exam: any) => {
    const byStudentNumber = new Map<string, any>();
    examAnalysisService.requireStoredResults(exam).forEach((result: any) => {
      const key = normalizeCoachStudentNumber(result?.studentNumber);
      if (key) byStudentNumber.set(key, result);
    });
    return { exam, byStudentNumber };
  }), [trialClubEvaluatedExams]);

  const leaguePerformanceByGroup = useMemo(() => {
    const result = new Map<string, Array<{ examId: string; examName: string; examDate: string; participantCount: number; averageNet: number; success: number; delta: number | null }>>();
    leagueGroups.filter((group) => group.active !== false).forEach((group) => {
      const trend: Array<{ examId: string; examName: string; examDate: string; participantCount: number; averageNet: number; success: number; delta: number | null }> = [];
      trialClubExamResults.forEach(({ exam, byStudentNumber }) => {
        const rows = group.studentNumbers
          .map((number) => byStudentNumber.get(normalizeCoachStudentNumber(number)))
          .filter(Boolean);
        if (!rows.length) return;
        const averageNet = rows.reduce((sum, row) => sum + Number(row?.totals?.net || 0), 0) / rows.length;
        const successValues = rows.map((row) => {
          const totalQuestions = (Array.isArray(row?.subjects) ? row.subjects : []).reduce((sum: number, subject: any) => sum + Number(subject?.totalQuestions || 0), 0);
          if (!totalQuestions) return 0;
          return Math.max(0, Math.min(100, (Number(row?.totals?.net || 0) / totalQuestions) * 100));
        });
        const success = successValues.reduce((sum, value) => sum + value, 0) / successValues.length;
        const previous = trend[trend.length - 1];
        trend.push({
          examId: String(exam?.id || ""),
          examName: String(exam?.examName || exam?.name || "Deneme"),
          examDate: String(exam?.examDate || exam?.date || exam?.createdAt || ""),
          participantCount: rows.length,
          averageNet: Number(averageNet.toFixed(2)),
          success: Number(success.toFixed(1)),
          delta: previous ? Number((success - previous.success).toFixed(1)) : null,
        });
      });
      result.set(group.id, trend);
    });
    return result;
  }, [leagueGroups, trialClubExamResults]);

  const createLeagueGroupForGrade = async (gradeLevel: string) => {
    const name = String(leagueGroupNameDrafts[gradeLevel] || "").trim();
    if (!name) {
      window.alert("Grup adını yazınız.");
      return;
    }
    if (leagueGroups.some((group) => group.active !== false && group.gradeLevel === gradeLevel && group.name.trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      window.alert("Bu sınıf seviyesinde aynı isimde bir grup zaten var.");
      return;
    }
    const now = new Date().toISOString();
    const record: TrialClubLeagueGroup = {
      id: makeCoachId("trial-league"),
      name,
      gradeLevel,
      studentIds: [],
      studentNumbers: [],
      studentNames: [],
      teacherIds: [],
      teacherNames: [],
      schoolId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    // Grup oluşturma işlemi ortak "saving" kilidine bağlı değildir. Böylece
    // başka bir kayıt işlemi sürerken grup Kaydet butonu gereksiz yere pasif kalmaz.
    setLeagueGroups((current) => [...current, record]);
    setLeagueGroupNameDrafts((current) => ({ ...current, [gradeLevel]: "" }));
    try {
      await upsertLocalDocument("trial_club_league_groups", record.id, record);
    } catch (error) {
      setLeagueGroups((current) => current.filter((item) => item.id !== record.id));
      console.error("Şampiyonlar Ligi grubu kaydedilemedi:", error);
      window.alert(error instanceof Error ? error.message : "Şampiyonlar Ligi grubu kaydedilemedi.");
    }
  };

  const openLeagueGroupStudentModal = (group: TrialClubLeagueGroup) => {
    setLeagueGroupStudentDraftIds(group.studentIds.map(String));
    setLeagueGroupStudentModalId(group.id);
  };

  const toggleLeagueGroupStudentDraft = (group: TrialClubLeagueGroup, registration: TrialClubRegistration) => {
    const studentId = String(registration.studentId);
    const isSelected = leagueGroupStudentDraftIds.includes(studentId);
    if (isSelected) {
      setLeagueGroupStudentDraftIds((current) => current.filter((id) => id !== studentId));
      return;
    }
    const usedByOtherGroup = leagueGroups.find((item) =>
      item.active !== false &&
      item.id !== group.id &&
      item.studentIds.map(String).includes(studentId),
    );
    if (usedByOtherGroup) {
      window.alert(`${registration.studentName} zaten ${usedByOtherGroup.name} grubunda.`);
      return;
    }
    setLeagueGroupStudentDraftIds((current) => [...current, studentId]);
  };

  const saveLeagueGroupStudents = async (group: TrialClubLeagueGroup) => {
    const registrations = activeTrialClubRegistrations.filter((registration) =>
      registration.gradeLevel === group.gradeLevel && leagueGroupStudentDraftIds.includes(String(registration.studentId)),
    );
    const next: TrialClubLeagueGroup = {
      ...group,
      studentIds: registrations.map((registration) => String(registration.studentId)),
      studentNumbers: registrations.map((registration) => normalizeCoachStudentNumber(registration.studentNumber)),
      studentNames: registrations.map((registration) => registration.studentName),
      updatedAt: new Date().toISOString(),
    };
    try {
      setSaving(true);
      await upsertLocalDocument("trial_club_league_groups", next.id, next);
      setLeagueGroups((current) => current.map((item) => item.id === next.id ? next : item));
      setLeagueGroupStudentModalId("");
      setLeagueGroupStudentDraftIds([]);
    } catch (error) {
      console.error("Grup öğrenci listesi kaydedilemedi:", error);
      window.alert(error instanceof Error ? error.message : "Grup öğrenci listesi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const assignLeagueStudentToGroup = async (registration: TrialClubRegistration, group: TrialClubLeagueGroup) => {
    if (group.gradeLevel !== registration.gradeLevel) return;
    if (group.studentIds.includes(String(registration.studentId))) {
      setLeagueStudentPicker(null);
      return;
    }
    const alreadyUsed = leagueGroups.find((item) => item.active !== false && item.id !== group.id && item.studentIds.includes(String(registration.studentId)));
    if (alreadyUsed) {
      window.alert(`${registration.studentName} zaten ${alreadyUsed.name} grubunda.`);
      return;
    }
    const next: TrialClubLeagueGroup = {
      ...group,
      studentIds: [...group.studentIds, String(registration.studentId)],
      studentNumbers: [...group.studentNumbers, normalizeCoachStudentNumber(registration.studentNumber)],
      studentNames: [...group.studentNames, registration.studentName],
      updatedAt: new Date().toISOString(),
    };
    try {
      setSaving(true);
      await upsertLocalDocument("trial_club_league_groups", next.id, next);
      setLeagueGroups((current) => current.map((item) => item.id === next.id ? next : item));
      setLeagueStudentPicker(null);
      setExpandedLeagueGroupId(next.id);
    } catch (error) {
      console.error("Öğrenci gruba eklenemedi:", error);
      window.alert(error instanceof Error ? error.message : "Öğrenci gruba eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const removeLeagueStudentFromGroup = async (group: TrialClubLeagueGroup, studentId: string) => {
    const index = group.studentIds.findIndex((id) => String(id) === String(studentId));
    if (index < 0) return;
    const next: TrialClubLeagueGroup = {
      ...group,
      studentIds: group.studentIds.filter((_, itemIndex) => itemIndex !== index),
      studentNumbers: group.studentNumbers.filter((_, itemIndex) => itemIndex !== index),
      studentNames: group.studentNames.filter((_, itemIndex) => itemIndex !== index),
      updatedAt: new Date().toISOString(),
    };
    try {
      setSaving(true);
      await upsertLocalDocument("trial_club_league_groups", next.id, next);
      setLeagueGroups((current) => current.map((item) => item.id === next.id ? next : item));
    } catch (error) {
      console.error("Öğrenci gruptan çıkarılamadı:", error);
      window.alert(error instanceof Error ? error.message : "Öğrenci gruptan çıkarılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const toggleLeagueGroupTeacher = async (group: TrialClubLeagueGroup, teacher: Teacher) => {
    const teacherId = String(teacher.id);
    const exists = group.teacherIds.includes(teacherId);
    const next: TrialClubLeagueGroup = {
      ...group,
      teacherIds: exists ? group.teacherIds.filter((id) => id !== teacherId) : [...group.teacherIds, teacherId],
      teacherNames: exists
        ? group.teacherNames.filter((_, index) => group.teacherIds[index] !== teacherId)
        : [...group.teacherNames, String(teacher.name || "Öğretmen")],
      updatedAt: new Date().toISOString(),
    };
    try {
      setSaving(true);
      await upsertLocalDocument("trial_club_league_groups", next.id, next);
      setLeagueGroups((current) => current.map((item) => item.id === next.id ? next : item));
    } catch (error) {
      console.error("Grup öğretmeni güncellenemedi:", error);
      window.alert(error instanceof Error ? error.message : "Grup öğretmeni güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const removeLeagueGroup = async (group: TrialClubLeagueGroup) => {
    if (!window.confirm(`${group.name} grubu silinsin mi?`)) return;
    try {
      setSaving(true);
      await deleteLocalDocument("trial_club_league_groups", group.id);
      setLeagueGroups((current) => current.filter((item) => item.id !== group.id));
    } catch (error) {
      console.error("Şampiyonlar Ligi grubu silinemedi:", error);
      window.alert(error instanceof Error ? error.message : "Şampiyonlar Ligi grubu silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const resetExamCalendarDraft = (gradeLevel = examCalendarGrade) => {
    const nextNumber = Math.max(0, ...examCalendarItems.filter((item) => item.gradeLevel === gradeLevel).map((item) => Number(item.examNumber || 0))) + 1;
    setExamCalendarEditingId("");
    setExamCalendarDraft({ examName: "", examNumber: String(nextNumber), examDate: isoDay() });
  };

  const saveExamCalendarItem = async () => {
    const examName = examCalendarDraft.examName.trim();
    const examNumber = Math.max(1, Math.floor(Number(examCalendarDraft.examNumber || 0)));
    const examDate = examCalendarDraft.examDate.trim();
    if (!examName) { window.alert("Denemenin adını yazınız."); return; }
    if (!examCalendarDraft.examNumber || !Number.isFinite(examNumber)) { window.alert("Deneme sayısını yazınız."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) { window.alert("Denemenin tarihini seçiniz."); return; }

    const existing = examCalendarItems.find((item) => item.id === examCalendarEditingId);
    const now = new Date().toISOString();
    const record: CoachExamCalendarItem = {
      id: existing?.id || makeCoachId("exam-calendar"),
      gradeLevel: examCalendarGrade,
      examName,
      examNumber,
      examDate,
      contents: existing?.contents || [],
      schoolId,
      active: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    try {
      setSaving(true);
      await upsertLocalDocument("education_coach_exam_calendar", record.id, record);
      setExamCalendarItems((current) => [...current.filter((item) => item.id !== record.id), record]);
      setExamCalendarEditingId("");
      setExamCalendarDraft({ examName: "", examNumber: String(examNumber + 1), examDate: examDate });
    } catch (error) {
      console.error("Sınav takvimi kaydedilemedi:", error);
      window.alert(error instanceof Error ? error.message : "Sınav takvimi kaydedilemedi.");
    } finally { setSaving(false); }
  };

  const editExamCalendarItem = (item: CoachExamCalendarItem) => {
    setExamCalendarGrade(item.gradeLevel);
    setExamCalendarEditingId(item.id);
    setExamCalendarDraft({
      examName: item.examName,
      examNumber: String(item.examNumber),
      examDate: item.examDate || isoDay(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeExamCalendarDate = async (item: CoachExamCalendarItem, examDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return;
    const next = { ...item, examDate, updatedAt: new Date().toISOString() };
    setExamCalendarItems((current) => current.map((row) => row.id === item.id ? next : row));
    try {
      await upsertLocalDocument("education_coach_exam_calendar", next.id, next);
    } catch (error) {
      console.error("Sınav tarihi güncellenemedi:", error);
      setExamCalendarItems((current) => current.map((row) => row.id === item.id ? item : row));
      window.alert(error instanceof Error ? error.message : "Sınav tarihi güncellenemedi.");
    }
  };

  const removeExamCalendarItem = async (item: CoachExamCalendarItem) => {
    if (!window.confirm(`${item.examName} (${item.examNumber}. Deneme) planını silmek istiyor musunuz?`)) return;
    try {
      setSaving(true);
      await deleteLocalDocument("education_coach_exam_calendar", item.id);
      setExamCalendarItems((current) => current.filter((row) => row.id !== item.id));
      if (examCalendarEditingId === item.id) resetExamCalendarDraft(item.gradeLevel);
    } catch (error) {
      console.error("Sınav takvimi kaydı silinemedi:", error);
      window.alert(error instanceof Error ? error.message : "Sınav takvimi kaydı silinemedi.");
    } finally { setSaving(false); }
  };

  const outcomeIdentity = (outcome: any, index: number) => String(
    typeof outcome === "string" ? outcome : outcome?.id || outcome?.name || `outcome-${index}`,
  );
  const outcomeLabel = (outcome: any, index: number) => String(
    typeof outcome === "string" ? outcome : outcome?.name || outcome?.id || `Kazanım ${index + 1}`,
  );

  const examContentPlanFor = (calendarId: string) =>
    examContentPlans.find((item) => item.calendarId === calendarId) || null;

  const openExamContentEditor = (item: CoachExamCalendarItem) => {
    const plan = examContentPlanFor(item.id);
    setExamContentGrade(item.gradeLevel);
    setExamContentCalendarId(item.id);
    setExamContentBlueprint(plan?.questionBlueprint?.map((row) => ({ ...row })) || []);
    setExamContentDraft(emptyExamContentDraft());
    setExamContentEditorOpen(true);
  };

  const addExamContentScope = () => {
    const course = availableExamContentCourses.find((item: any) => String(item.id) === String(examContentDraft.courseId));
    const unit = course?.units?.find((item: any) => String(item.id) === String(examContentDraft.unitId));
    const wholeUnit = examContentDraft.topicId === "__ALL_TOPICS__";
    const topic = wholeUnit ? null : unit?.topics?.find((item: any) => String(item.id) === String(examContentDraft.topicId));
    const outcomes = topic?.outcomes || topic?.objectives || [];
    const wholeTopic = !wholeUnit && examContentDraft.outcomeId === "__ALL_OUTCOMES__";
    const outcomeIndex = outcomes.findIndex((item: any, index: number) => outcomeIdentity(item, index) === String(examContentDraft.outcomeId));
    const outcome = outcomeIndex >= 0 ? outcomes[outcomeIndex] : null;
    if (!course || !unit || (!wholeUnit && !topic) || (!wholeUnit && !wholeTopic && !outcome)) return;

    const row: CoachExamBlueprintRow = {
      id: makeCoachId("exam-content-scope"),
      subject: String(course.name || ""),
      courseId: String(course.id || ""),
      grade: String(course.grade || examContentGrade),
      unitId: String(unit.id || ""),
      unitName: String(unit.name || ""),
      topicId: wholeUnit ? "" : String(topic?.id || ""),
      topicName: wholeUnit ? "" : String(topic?.name || ""),
      outcomeId: wholeUnit || wholeTopic ? "" : outcomeIdentity(outcome, outcomeIndex),
      outcomeName: wholeUnit || wholeTopic ? "" : outcomeLabel(outcome, outcomeIndex),
      scopeType: wholeUnit ? "unit" : wholeTopic ? "topic" : "outcome",
      includeAllTopics: wholeUnit,
      includeAllOutcomes: wholeUnit || wholeTopic,
      count: Math.max(1, Math.floor(Number(examContentDraft.count) || 1)),
    };
    setExamContentBlueprint((current) => [...current, row]);
    setExamContentDraft({ courseId: String(course.id || ""), unitId: "", topicId: "", outcomeId: "", count: 1 });
  };

  const examContentScopeLabel = (row: CoachExamBlueprintRow) => {
    if (row.scopeType === "unit") return `${row.unitName} — ünitenin tamamı`;
    if (row.scopeType === "topic") return `${row.unitName} → ${row.topicName} — konunun tamamı`;
    return `${row.unitName} → ${row.topicName} → ${row.outcomeName}`;
  };

  const persistExamContentPlan = async (calendar: CoachExamCalendarItem, blueprint = examContentBlueprint) => {
    if (!blueprint.length) {
      window.alert("Deneme içeriğine en az bir ünite, konu veya kazanım ekleyiniz.");
      return null;
    }
    const existing = examContentPlanFor(calendar.id);
    const now = new Date().toISOString();
    const record: CoachExamContentPlan = {
      id: existing?.id || `exam-content-${calendar.id}`,
      calendarId: calendar.id,
      schoolId,
      gradeLevel: calendar.gradeLevel,
      examName: calendar.examName,
      examNumber: calendar.examNumber,
      examDate: calendar.examDate,
      questionBlueprint: blueprint.map((row) => ({ ...row })),
      createdExamId: existing?.createdExamId,
      createdExamAt: existing?.createdExamAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await upsertLocalDocument("education_coach_exam_contents", record.id, record);
    setExamContentPlans((current) => [...current.filter((item) => item.calendarId !== calendar.id), record]);
    return record;
  };

  const saveExamContentPlan = async () => {
    const calendar = examCalendarItems.find((item) => item.id === examContentCalendarId);
    if (!calendar) { window.alert("Sınav Takvimi kaydı bulunamadı."); return; }
    try {
      setSaving(true);
      const saved = await persistExamContentPlan(calendar);
      if (saved) setExamContentEditorOpen(false);
    } catch (error) {
      console.error("Deneme içeriği kaydedilemedi:", error);
      window.alert(error instanceof Error ? error.message : "Deneme içeriği kaydedilemedi.");
    } finally { setSaving(false); }
  };

  const createExamFromContent = async () => {
    const calendar = examCalendarItems.find((item) => item.id === examContentCalendarId);
    if (!calendar) { window.alert("Sınav Takvimi kaydı bulunamadı."); return; }
    const existingPlan = examContentPlanFor(calendar.id);
    if (existingPlan?.createdExamId) {
      window.alert("Bu deneme içeriği daha önce sınav tanımlamak için kullanılmıştır.");
      return;
    }
    if (!examContentBlueprint.length) {
      window.alert("Önce denemenin müfredat içeriğini hazırlayınız.");
      return;
    }
    if (!window.confirm(`“${calendar.examName}” içeriği kullanılarak yeni sınav tanımlansın mı?\n\nÜnite, konu, kazanım ve soru sayıları yeni sınava aynen aktarılacaktır.`)) return;

    try {
      setSaving(true);
      const savedPlan = await persistExamContentPlan(calendar);
      if (!savedPlan) return;
      const subjectTotals = new Map<string, number>();
      savedPlan.questionBlueprint.forEach((row) => {
        subjectTotals.set(row.subject, (subjectTotals.get(row.subject) || 0) + Math.max(1, Number(row.count || 1)));
      });
      const selectedCourseIds = Array.from(new Set(savedPlan.questionBlueprint.map((row) => row.courseId).filter(Boolean)));
      const selectedCourseNames = Array.from(new Set(savedPlan.questionBlueprint.map((row) => row.subject).filter(Boolean)));
      const now = new Date().toISOString();
      const examId = `exam-${Date.now()}`;
      const examRecord = {
        id: examId,
        examSource: "Sistem",
        examType: "Ders Denemesi",
        gradeLevel: calendar.gradeLevel,
        participantGroup: "trial-club",
        participantLabel: "Deneme Kulübü",
        selectedCourseId: selectedCourseIds[0] || "",
        selectedCourseName: selectedCourseNames[0] || "",
        selectedCourseIds,
        selectedCourseNames,
        courseSelectionMode: selectedCourseIds.length > 1 ? "multiple" : "single",
        selectedUnitId: "",
        selectedUnitName: "",
        selectedUnitIds: Array.from(new Set(savedPlan.questionBlueprint.map((row) => row.unitId).filter(Boolean))),
        selectedUnitNames: Array.from(new Set(savedPlan.questionBlueprint.map((row) => row.unitName).filter(Boolean))),
        bookletType: "A",
        answeringMethod: "Optik",
        continueQuestionNumbers: false,
        questionNumberingMode: "restart-per-subject",
        examDate: `${calendar.examDate}T09:00`,
        opticForm: "",
        opticFormId: "",
        opticTemplate: null,
        publisherName: "",
        examName: calendar.examName,
        examCode: `DK-${calendar.gradeLevel}-${String(calendar.examNumber).padStart(2, "0")}-${Date.now().toString().slice(-6)}`,
        institutionName: "Ordu Lisesi",
        targetAudience: "Deneme Kulübü",
        examStatus: "Hazırlanıyor",
        resultSettings: {
          createResultPdf: true,
          sendToParents: false,
          sendToStudents: false,
          showSchoolRank: true,
          showClassRank: true,
          showTurkeyRank: false,
          includeSubjectAnalysis: true,
          pdfTemplate: "HASAT Analiz Karnesi",
          resultFilePattern: "{YIL}_{SINAV_KODU}_{OGR_ADI}_{OGR_NO}.pdf",
        },
        examStructure: [{
          testName: "Ders Denemesi",
          subjects: Array.from(subjectTotals.entries()).map(([name, count]) => ({ name, count })),
        }],
        questionBlueprint: savedPlan.questionBlueprint.map((row) => ({ ...row })),
        questionAssignments: {},
        questions: {},
        bookletLayoutLock: null,
        teacherSelectionImportedAt: null,
        educationCoachCalendarId: calendar.id,
        educationCoachContentPlanId: savedPlan.id,
        createdAt: now,
        updatedAt: now,
      };
      await upsertLocalDocument("exams", examId, examRecord);
      const nextPlan: CoachExamContentPlan = { ...savedPlan, createdExamId: examId, createdExamAt: now, updatedAt: now };
      await upsertLocalDocument("education_coach_exam_contents", nextPlan.id, nextPlan);
      setExamContentPlans((current) => [...current.filter((item) => item.calendarId !== calendar.id), nextPlan]);
      setExamContentEditorOpen(false);
      window.alert("Deneme içeriği kullanılarak yeni sınav tanımlandı. Sınav Hazırla ekranından diğer sınav bilgilerini gerektiğinde düzenleyebilirsiniz.");
    } catch (error) {
      console.error("Deneme içeriğinden sınav oluşturulamadı:", error);
      window.alert(error instanceof Error ? error.message : "Deneme içeriğinden sınav oluşturulamadı.");
    } finally { setSaving(false); }
  };


  const renderRegistration = (embedded = false) => (
    <div className="space-y-5">
      {!embedded ? <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white"><UsersRound className="h-6 w-6" /></span>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Eğitim Koçu</div>
            <h2 className="text-xl font-black text-slate-900">Kayıt Merkezi — Deneme Kulübü</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Akademik çalışmaya katılacak öğrencileri sınıf seviyesine göre seçerek Deneme Kulübüne kaydedin.</p>
          </div>
        </div>
      </div> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                  <input value={registrationStudentSearch} onChange={(event) => { setRegistrationStudentSearch(event.target.value); setRegistrationStudentId(""); }} onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    const rawQuery = registrationStudentSearch.trim();
                    if (!/^\d+$/.test(rawQuery)) return;
                    const normalizedQuery = rawQuery.replace(/^0+(?=\d)/, "");
                    const exactStudent = registrationStudents.find((student) => String(studentNumber(student)).trim().replace(/^0+(?=\d)/, "") === normalizedQuery);
                    if (!exactStudent) return;
                    event.preventDefault();
                    void saveTrialClubRegistration(String(exactStudent.id));
                  }} placeholder="Öğrenci numarası veya adı soyadı ile ara..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400"/>
                </div>
                <button type="button" disabled={saving || !registrationStudentId} onClick={() => void saveTrialClubRegistration()} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Ekle</button>
              </div>
              {registrationStudentSearch.trim() && !registrationStudentId ? <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                {registrationStudentMatches.length ? registrationStudentMatches.map((student) => <button key={student.id} type="button" onClick={() => selectRegistrationStudent(String(student.id))} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-amber-50">
                  <span className="min-w-0"><strong className="block truncate text-xs font-black text-slate-800">{studentName(student)}</strong><span className="text-[10px] font-bold text-slate-400">{studentClassroom(student)} • No {studentNumber(student)}</span></span>
                  {registeredStudentIds.has(String(student.id)) ? <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Kayıtlı</span> : null}
                </button>) : <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">Eşleşen öğrenci bulunamadı.</div>}
              </div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="text-base font-black text-slate-900">Üye Kaydı</div><div className="text-xs font-bold text-slate-400">Toplam {filteredTrialClubRegistrations.length} öğrenci</div></div>
              <select value={registrationListGradeFilter} onChange={(event) => setRegistrationListGradeFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 sm:w-56">
                <option value="Tümü">Tüm sınıf seviyeleri</option>
                <option value="9">9. Sınıf</option><option value="10">10. Sınıf</option><option value="11">11. Sınıf</option><option value="12">12. Sınıf</option>
              </select>
            </div>
            <div className="mt-4 space-y-2">
              {filteredTrialClubRegistrations.length ? filteredTrialClubRegistrations.map((registration) => (
                <div key={registration.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${registration.gradeLevel === "9" ? "border-blue-200 bg-blue-50" : registration.gradeLevel === "10" ? "border-amber-200 bg-amber-50" : registration.gradeLevel === "11" ? "border-emerald-200 bg-emerald-50" : registration.gradeLevel === "12" ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><strong className="text-xs font-black text-slate-900">{registration.studentName}</strong><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${registration.gradeLevel === "9" ? "bg-blue-100 text-blue-700" : registration.gradeLevel === "10" ? "bg-amber-100 text-amber-700" : registration.gradeLevel === "11" ? "bg-emerald-100 text-emerald-700" : registration.gradeLevel === "12" ? "bg-violet-100 text-violet-700" : "bg-white text-slate-500"}`}>{registration.classroom}</span><span className="text-[9px] font-bold text-slate-400">No: {registration.studentNumber || "—"}</span></div>
                  </div>
                  <button type="button" onClick={() => void removeTrialClubRegistration(registration)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-600" title="Kulüp üyeliğini sonlandır"><X className="h-4 w-4"/></button>
                </div>
              )) : <EmptyState title="Deneme Kulübü kaydı yok" detail="Sınıf seviyesini seçin veya soldan öğrenci arayarak ilk kaydı oluşturun."/>}
            </div>
          </div>
        </div>

        <div className="min-w-0">{renderChampionsLeague(true)}</div>
      </div>
    </div>
  );

  const renderExamCalendar = () => {
    const items = examCalendarItems
      .filter((item) => item.gradeLevel === examCalendarGrade)
      .sort((a, b) => Number(a.examNumber) - Number(b.examNumber) || String(a.examDate).localeCompare(String(b.examDate)));
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><CalendarDays className="h-6 w-6" /></span>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Eğitim Koçu</div>
              <h2 className="text-xl font-black text-slate-900">Sınav Takvimi</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Her sınıf düzeyi için denemenin adını, sıra numarasını ve tarihini planlayın. Müfredat kapsamını Deneme İçerikleri ekranından hazırlayın.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {["9", "10", "11", "12"].map((grade) => (
            <button key={grade} type="button" onClick={() => { setExamCalendarGrade(grade); setExamCalendarEditingId(""); const nextNumber = Math.max(0, ...examCalendarItems.filter((item) => item.gradeLevel === grade).map((item) => Number(item.examNumber || 0))) + 1; setExamCalendarDraft({ examName: "", examNumber: String(nextNumber), examDate: isoDay() }); }} className={`rounded-xl px-3 py-3 text-sm font-black transition ${examCalendarGrade === grade ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{grade}. Sınıf</button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><div className="text-base font-black text-slate-900">{examCalendarEditingId ? "Planı Düzenle" : "Yeni Deneme Planı"}</div><div className="text-xs font-bold text-slate-400">{examCalendarGrade}. sınıf planı</div></div>{examCalendarEditingId ? <button type="button" onClick={() => resetExamCalendarDraft()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Yeni Kayıt</button> : null}</div>
            <div className="mt-4 space-y-4">
              <div><label className="text-xs font-black text-slate-500">Denemenin adı</label><input value={examCalendarDraft.examName} onChange={(event) => setExamCalendarDraft((current) => ({ ...current, examName: event.target.value }))} placeholder="Örn. TYT Genel Deneme" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-black text-slate-500">Deneme sayısı</label><input type="number" min="1" value={examCalendarDraft.examNumber} onChange={(event) => setExamCalendarDraft((current) => ({ ...current, examNumber: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700" /></div>
                <div><label className="text-xs font-black text-slate-500">Tarih</label><input type="date" value={examCalendarDraft.examDate} onChange={(event) => setExamCalendarDraft((current) => ({ ...current, examDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700" /></div>
              </div>
              <button type="button" disabled={saving} onClick={() => void saveExamCalendarItem()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">{examCalendarEditingId ? "Planı Güncelle" : "Planı Kaydet"}</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><div className="text-base font-black text-slate-900">{examCalendarGrade}. Sınıf Deneme Planı</div><div className="text-xs font-bold text-slate-400">{items.length} deneme planlandı</div></div><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">Tarih her zaman değiştirilebilir</span></div>
            <div className="mt-4 space-y-3">
              {items.length ? items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black text-white">{item.examNumber}. DENEME</span><strong className="text-sm font-black text-slate-900">{item.examName}</strong></div>
                      {examContentPlans.some((plan) => plan.calendarId === item.id && plan.questionBlueprint.length > 0)
                        ? <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><BookOpen className="h-4 w-4"/> Deneme içeriği hazır</div>
                        : <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"><BookOpen className="h-4 w-4"/> Deneme içeriği henüz hazırlanmadı</div>}
                    </div>
                    <div className="w-full shrink-0 lg:w-48">
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">Sınav Tarihi</label>
                      <input type="date" value={item.examDate} onChange={(event) => void changeExamCalendarDate(item, event.target.value)} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-black text-indigo-700" />
                      <div className="mt-2 flex gap-2"><button type="button" onClick={() => editExamCalendarItem(item)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">Düzenle</button><button type="button" onClick={() => void removeExamCalendarItem(item)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600" aria-label="Planı sil"><Trash2 className="h-4 w-4"/></button></div>
                    </div>
                  </div>
                </div>
              )) : <EmptyState title={`${examCalendarGrade}. sınıf için plan yok`} detail="Soldaki formdan ilk denemenin adını, sayısını ve tarihini kaydedin."/>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExamContents = () => {
    const items = examCalendarItems
      .filter((item) => item.gradeLevel === examContentGrade)
      .sort((a, b) => Number(a.examNumber) - Number(b.examNumber) || String(a.examDate).localeCompare(String(b.examDate)));
    const selectedCalendar = examCalendarItems.find((item) => item.id === examContentCalendarId) || null;
    const selectedCourse = availableExamContentCourses.find((item: any) => String(item.id) === String(examContentDraft.courseId)) || null;
    const selectedUnit = selectedCourse?.units?.find((item: any) => String(item.id) === String(examContentDraft.unitId)) || null;
    const selectedTopic = examContentDraft.topicId === "__ALL_TOPICS__"
      ? null
      : selectedUnit?.topics?.find((item: any) => String(item.id) === String(examContentDraft.topicId)) || null;
    const outcomes = selectedTopic?.outcomes || selectedTopic?.objectives || [];
    const canAdd = Boolean(
      selectedCourse && selectedUnit && examContentDraft.topicId &&
      (examContentDraft.topicId === "__ALL_TOPICS__" || (selectedTopic && examContentDraft.outcomeId)),
    );

    return (
      <>
        <div className="space-y-5">
          <div className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white"><BookOpen className="h-6 w-6" /></span>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Eğitim Koçu</div>
                <h2 className="text-xl font-black text-slate-900">Deneme İçerikleri</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Sınav Takvimi'ndeki denemeyi seçin; öğrencinin önceden göreceği ünite, konu ve kazanım kapsamını hazırlayın.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {["9", "10", "11", "12"].map((grade) => (
              <button key={grade} type="button" onClick={() => { setExamContentGrade(grade); setExamContentCalendarId(""); setExamContentEditorOpen(false); }} className={`rounded-xl px-3 py-3 text-sm font-black transition ${examContentGrade === grade ? "bg-violet-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{grade}. Sınıf</button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-black text-slate-900">{examContentGrade}. Sınıf Denemeleri</div>
                <div className="text-xs font-bold text-slate-400">İçeriğini hazırlamak istediğiniz sınava tıklayın.</div>
              </div>
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">{items.length} kayıtlı sınav</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {items.length ? items.map((item) => {
                const plan = examContentPlanFor(item.id);
                const groupedSubjects = plan?.questionBlueprint?.reduce((map, row) => {
                  map.set(row.subject, (map.get(row.subject) || 0) + 1);
                  return map;
                }, new Map<string, number>()) || new Map<string, number>();
                return (
                  <button key={item.id} type="button" onClick={() => openExamContentEditor(item)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-black text-white">{item.examNumber}. DENEME</span>{plan?.createdExamId ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-700">SINAV OLUŞTURULDU</span> : null}</div>
                        <div className="mt-2 truncate text-sm font-black text-slate-900">{item.examName}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">{humanDate(item.examDate)}</div>
                      </div>
                      <BookOpen className={`h-5 w-5 shrink-0 ${plan?.questionBlueprint?.length ? "text-emerald-600" : "text-slate-300"}`} />
                    </div>
                    {plan?.questionBlueprint?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Array.from(groupedSubjects.entries()).map(([subject, count]) => <span key={subject} className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-600">{subject} · {count} kapsam</span>)}
                      </div>
                    ) : <div className="mt-3 text-xs font-bold text-amber-600">Müfredat içeriği henüz hazırlanmadı.</div>}
                  </button>
                );
              }) : <div className="lg:col-span-2 xl:col-span-3"><EmptyState title={`${examContentGrade}. sınıf için sınav takvimi kaydı yok`} detail="Önce Sınav Takvimi ekranından denemenin adını, numarasını ve tarihini kaydedin." /></div>}
            </div>
          </div>
        </div>

        {examContentEditorOpen && selectedCalendar ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Deneme İçeriği Hazırla</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-black text-slate-900">{selectedCalendar.examName}</h3>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">{selectedCalendar.gradeLevel}. SINIF · {selectedCalendar.examNumber}. DENEME</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">{humanDate(selectedCalendar.examDate)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setExamContentEditorOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-6 w-6" /></button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <div className="rounded-2xl border border-indigo-100 bg-white px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Soru Planı</div>
                    <div className="mt-1 text-xs font-bold text-slate-600">Öğrencinin mobil uygulamada sınavdan önce göreceği müfredat kapsamını seçin.</div>
                  </div>

                  {examCurriculumError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">Müfredat okunamadı: {examCurriculumError}</div> : null}

                  <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_1.1fr_1.1fr_1.5fr_100px_90px] xl:items-end">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Ders</label>
                      <select value={examContentDraft.courseId} onChange={(event) => setExamContentDraft({ courseId: event.target.value, unitId: "", topicId: "", outcomeId: "", count: examContentDraft.count })} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold text-slate-700">
                        <option value="">Ders seçiniz</option>
                        {availableExamContentCourses.map((course: any) => <option key={course.id} value={course.id}>{course.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Ünite</label>
                      <select disabled={!selectedCourse} value={examContentDraft.unitId} onChange={(event) => setExamContentDraft((current) => ({ ...current, unitId: event.target.value, topicId: "", outcomeId: "" }))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 disabled:bg-slate-100">
                        <option value="">Ünite seçiniz</option>
                        {(selectedCourse?.units || []).map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Konu</label>
                      <select disabled={!selectedUnit} value={examContentDraft.topicId} onChange={(event) => setExamContentDraft((current) => ({ ...current, topicId: event.target.value, outcomeId: "" }))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 disabled:bg-slate-100">
                        <option value="">Konu seçiniz</option>
                        <option value="__ALL_TOPICS__">Tüm Konular (Ünitenin Tamamı)</option>
                        {(selectedUnit?.topics || []).map((topic: any) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Kazanım</label>
                      <select disabled={!selectedTopic || examContentDraft.topicId === "__ALL_TOPICS__"} value={examContentDraft.outcomeId} onChange={(event) => setExamContentDraft((current) => ({ ...current, outcomeId: event.target.value }))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 disabled:bg-slate-100">
                        <option value="">Kazanım seçiniz</option>
                        <option value="__ALL_OUTCOMES__">Tüm Kazanımlar (Konunun Tamamı)</option>
                        {outcomes.map((outcome: any, index: number) => <option key={outcomeIdentity(outcome, index)} value={outcomeIdentity(outcome, index)}>{outcomeLabel(outcome, index)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Soru Sayısı</label>
                      <input type="number" min="1" value={examContentDraft.count} onChange={(event) => setExamContentDraft((current) => ({ ...current, count: Math.max(1, Number(event.target.value) || 1) }))} className="mt-1 w-full rounded-xl border-2 border-indigo-300 bg-white px-2 py-2.5 text-center text-sm font-black text-indigo-950" />
                    </div>
                    <button type="button" disabled={!canAdd} onClick={addExamContentScope} className="rounded-xl bg-indigo-600 px-3 py-3 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">+ Ekle</button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {examContentBlueprint.length ? (
                      <div className="divide-y divide-slate-100">
                        {examContentBlueprint.map((row, index) => (
                          <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-black text-indigo-700">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black text-slate-900">{row.subject} <span className="text-indigo-600">· {row.count} soru</span></div>
                              <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{examContentScopeLabel(row)}</div>
                            </div>
                            <button type="button" onClick={() => setExamContentBlueprint((current) => current.filter((item) => item.id !== row.id))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600" aria-label="İçerik satırını sil"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                    ) : <div className="px-5 py-10 text-center text-xs font-semibold text-slate-400">Ders, ünite, konu veya kazanımı seçip soru sayısını belirleyerek <b>+ Ekle</b> butonuna basınız.</div>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
                <button type="button" onClick={() => setExamContentEditorOpen(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 sm:w-44">İptal</button>
                <button type="button" disabled={saving || !examContentBlueprint.length} onClick={() => void saveExamContentPlan()} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40 sm:flex-1">Deneme İçeriğini Kaydet</button>
                <button type="button" disabled={saving || !examContentBlueprint.length || Boolean(examContentPlanFor(selectedCalendar.id)?.createdExamId)} onClick={() => void createExamFromContent()} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40 sm:flex-1">{examContentPlanFor(selectedCalendar.id)?.createdExamId ? "Sınav Tanımlandı" : "Deneme İçeriğini Sınav Tanımlama İçin Kullan"}</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  };

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

  const renderDashboardOverview = () => {
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

  const renderChampionsLeague = (_embedded = false) => {
    const gradeLevels = ["9", "10", "11", "12"];
    const gradeTone: Record<string, { border: string; soft: string; strong: string; text: string }> = {
      "9": { border: "border-blue-200", soft: "bg-blue-50", strong: "bg-blue-600", text: "text-blue-800" },
      "10": { border: "border-amber-200", soft: "bg-amber-50", strong: "bg-amber-500", text: "text-amber-800" },
      "11": { border: "border-emerald-200", soft: "bg-emerald-50", strong: "bg-emerald-600", text: "text-emerald-800" },
      "12": { border: "border-violet-200", soft: "bg-violet-50", strong: "bg-violet-600", text: "text-violet-800" },
    };
    const modalGroup = leagueGroups.find((group) => group.id === leagueGroupStudentModalId && group.active !== false) || null;
    const modalTone = modalGroup ? gradeTone[modalGroup.gradeLevel] || gradeTone["9"] : gradeTone["9"];
    const modalRegistrations = modalGroup
      ? activeTrialClubRegistrations
          .filter((registration) => registration.gradeLevel === modalGroup.gradeLevel)
          .sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.studentName.localeCompare(b.studentName, "tr"))
      : [];
    const modalTrend = modalGroup ? (leaguePerformanceByGroup.get(modalGroup.id) || []) : [];
    const modalLatest = modalTrend[modalTrend.length - 1];

    return <div className="space-y-3">
      <div className={`grid gap-3 ${leagueColumnCount === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {gradeLevels.map((gradeLevel) => {
          const tone = gradeTone[gradeLevel];
          const groups = leagueGroups
            .filter((group) => group.active !== false && group.gradeLevel === gradeLevel)
            .sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true }));

          return <section key={gradeLevel} className={`min-w-0 rounded-2xl border ${tone.border} bg-white p-3 shadow-sm`}>
            <div className={`rounded-xl ${tone.soft} px-3 py-2`}>
              <div className={`text-sm font-black ${tone.text}`}>{gradeLevel}. Sınıf</div>
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                value={leagueGroupNameDrafts[gradeLevel] || ""}
                onChange={(event) => setLeagueGroupNameDrafts((current) => ({ ...current, [gradeLevel]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createLeagueGroupForGrade(gradeLevel);
                  }
                }}
                placeholder="Grup adı"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold outline-none focus:border-amber-400"
              />
              <button
                type="button"
                disabled={!String(leagueGroupNameDrafts[gradeLevel] || "").trim()}
                onClick={() => void createLeagueGroupForGrade(gradeLevel)}
                className={`shrink-0 rounded-lg px-2.5 py-2 text-[11px] font-black text-white disabled:opacity-40 ${tone.strong}`}
              >
                Kaydet
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {groups.length ? groups.map((group) => (
                <div key={group.id} className="rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => openLeagueGroupStudentModal(group)}
                    className={`flex min-w-0 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-white transition ${gradeLevel === "9" ? "bg-blue-900 hover:bg-blue-950" : gradeLevel === "10" ? "bg-amber-900 hover:bg-amber-950" : gradeLevel === "11" ? "bg-emerald-900 hover:bg-emerald-950" : "bg-violet-900 hover:bg-violet-950"}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{group.name}</span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black text-white">{group.studentIds.length}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/80"/>
                  </button>
                </div>
              )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center text-[10px] font-bold text-slate-400">Henüz grup yok.</div>}
            </div>
          </section>;
        })}
      </div>

      {modalGroup ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setLeagueGroupStudentModalId(""); setLeagueGroupStudentDraftIds([]); } }}>
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className={`flex items-center gap-3 border-b ${modalTone.border} ${modalTone.soft} px-5 py-4`}>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-black uppercase tracking-wide ${modalTone.text}`}>{modalGroup.gradeLevel}. Sınıf</div>
              <div className="truncate text-lg font-black text-slate-900">{modalGroup.name}</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">Soldan takip öğretmenlerini, sağdan bu sınıf seviyesindeki öğrencileri tikleyerek gruba dahil edin.</div>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-black ${modalTone.strong} text-white`}>{leagueGroupStudentDraftIds.length} öğrenci</div>
            <button type="button" onClick={() => { setLeagueGroupStudentModalId(""); setLeagueGroupStudentDraftIds([]); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:text-slate-800"><X className="h-5 w-5"/></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Öğretmenler</div>
                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                  {coachTeachers.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "tr")).map((teacher) => {
                    const checked = modalGroup.teacherIds.includes(String(teacher.id));
                    return <button key={teacher.id} type="button" onClick={() => void toggleLeagueGroupTeacher(modalGroup, teacher)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-bold ${checked ? `${modalTone.soft} ${modalTone.text}` : "bg-slate-50 text-slate-600"}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? `${modalTone.strong} border-transparent text-white` : "border-slate-300 bg-white"}`}>{checked ? <Check className="h-3 w-3"/> : null}</span>
                      <span className="truncate">{teacher.name}{teacher.branch ? ` • ${teacher.branch}` : ""}</span>
                    </button>;
                  })}
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Öğrenciler</div>
                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                  {modalRegistrations.length ? modalRegistrations.map((registration) => {
                    const studentId = String(registration.studentId);
                    const checked = leagueGroupStudentDraftIds.includes(studentId);
                    const otherGroup = leagueGroups.find((group) => group.active !== false && group.id !== modalGroup.id && group.studentIds.map(String).includes(studentId));
                    const disabled = Boolean(otherGroup);
                    return <button
                      key={registration.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLeagueGroupStudentDraft(modalGroup, registration)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${checked ? `${modalTone.border} ${modalTone.soft}` : "border-slate-200 bg-slate-50 hover:bg-slate-100"} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? `${modalTone.strong} border-transparent text-white` : "border-slate-300 bg-white"}`}>{checked ? <Check className="h-3 w-3"/> : null}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[10px] font-black text-slate-800">{registration.studentName}</strong>
                        <span className="text-[9px] font-bold text-slate-400">{registration.classroom} • No {registration.studentNumber || "—"}</span>
                      </span>
                      {otherGroup ? <span className="max-w-24 truncate rounded-full bg-slate-200 px-2 py-0.5 text-[8px] font-black text-slate-500">{otherGroup.name}</span> : null}
                    </button>;
                  }) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-400">Bu sınıf seviyesinde kayıtlı Deneme Kulübü öğrencisi bulunmuyor.</div>}
                </div>
              </section>
            </div>

            {modalLatest ? <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-50 p-2 text-center"><div className="text-[9px] font-black uppercase text-slate-400">Ort. Net</div><div className="text-sm font-black text-indigo-700">{modalLatest.averageNet}</div></div>
                <div className="rounded-xl bg-slate-50 p-2 text-center"><div className="text-[9px] font-black uppercase text-slate-400">Başarı</div><div className="text-sm font-black text-emerald-700">%{modalLatest.success}</div></div>
                <div className="rounded-xl bg-slate-50 p-2 text-center"><div className="text-[9px] font-black uppercase text-slate-400">Değişim</div><div className={`text-sm font-black ${modalLatest.delta === null ? "text-slate-400" : modalLatest.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{modalLatest.delta === null ? "—" : `${modalLatest.delta >= 0 ? "+" : ""}${modalLatest.delta}`}</div></div>
              </div>
            </div> : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button type="button" onClick={() => void removeLeagueGroup(modalGroup)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600"><Trash2 className="h-4 w-4"/> Grubu sil</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setLeagueGroupStudentModalId(""); setLeagueGroupStudentDraftIds([]); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600">Vazgeç</button>
              <button type="button" disabled={saving} onClick={() => void saveLeagueGroupStudents(modalGroup)} className={`rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${modalTone.strong}`}>Grubu Kaydet</button>
            </div>
          </div>
        </div>
      </div> : null}
    </div>;
  };

  const renderDashboard = () => (
    <div className="space-y-5">
      {controlCenterTab === "tracking" ? <div className="space-y-6">{renderRegistration(true)}</div> : null}
      {controlCenterTab === "champions" ? renderChampionsLeague() : null}
      {controlCenterTab === "analysis" ? <ExamAnalysisModule key="trial-club-analysis" examScope="trial-club" allowedStudents={trialClubAnalysisStudents} onNavigate={onNavigate}/> : null}
    </div>
  );

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

    const gradeLevels = ["9", "10", "11", "12"];
    const visibleGrades = feedbackGradeFilter === "Tümü" ? gradeLevels : [feedbackGradeFilter];

    const renderFeedbackStudentCard = ({ student, registration }: { student: Student; registration: TrialClubRegistration }) => {
      const profile = profileMap.get(String(student.id)) || numberProfileMap.get(studentNumber(student));
      const snapshot = profile ? snapshotByProfile.get(profile.id) : undefined;
      const rate = completionRate(profile);
      const displayName = registration.studentName || studentName(student);
      const classroom = registration.classroom || studentClassroom(student);
      const number = registration.studentNumber || studentNumber(student);
      return <button key={registration.id || student.id} onClick={() => void activateStudent(student)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-white">{displayName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-black text-slate-900 group-hover:text-amber-700">{displayName}</div>
            <div className="mt-1 text-xs font-bold text-slate-500">{classroom} • No {number || "—"}</div>
            {registration.teacherNames.length ? <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">Koç: {registration.teacherNames.join(", ")}</div> : null}
          </div>
          <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-amber-500"/>
        </div>
        {profile ? <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold text-slate-400">Akademik</div><div className="text-lg font-black text-slate-800">%{snapshot?.overallSuccess || 0}</div></div><div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold text-slate-400">Plan</div><div className="text-lg font-black text-slate-800">%{rate}</div></div></div> : <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Geri bildirim dosyasını açmak için tıklayın.</div>}
      </button>;
    };

    return <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-600"><UsersRound className="h-4 w-4"/> Deneme Kulübü</div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Geri Bildirim</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Bu ekranda yalnız Kayıt Merkezi'nde Deneme Kulübüne kayıtlı öğrenciler yer alır.</p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Toplam Öğrenci</div><div className="mt-1 text-3xl font-black">{feedbackStudentRows.length}</div></div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <button type="button" onClick={() => { setFeedbackGradeFilter("Tümü"); setSelectedClassroom("Tümü"); }} className={`rounded-2xl border p-3 text-left transition ${feedbackGradeFilter === "Tümü" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"}`}><div className="text-xs font-black uppercase">Tüm Sınıflar</div><div className="mt-1 text-2xl font-black">{feedbackStudentRows.length}</div></button>
          {gradeLevels.map((grade) => <button key={grade} type="button" onClick={() => { setFeedbackGradeFilter(grade); setSelectedClassroom("Tümü"); }} className={`rounded-2xl border p-3 text-left transition ${feedbackGradeFilter === grade ? "border-amber-500 bg-amber-500 text-white" : "border-amber-100 bg-amber-50/60 text-amber-800 hover:border-amber-300"}`}><div className="text-xs font-black uppercase">{grade}. Sınıf</div><div className="mt-1 text-2xl font-black">{feedbackGradeCounts[grade] || 0}</div></button>)}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Deneme Kulübü öğrencisi ara" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-amber-400"/></div>
        <select value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"><option>Tümü</option>{feedbackClassrooms.map((classroom) => <option key={classroom}>{classroom}</option>)}</select>
        <div className="whitespace-nowrap text-sm font-bold text-slate-500">{filteredFeedbackStudentRows.length} öğrenci</div>
      </div>

      {feedbackStudentRows.length ? <div className="space-y-5">{visibleGrades.map((grade) => {
        const gradeRows = filteredFeedbackStudentRows.filter(({ student, registration }) => (registration.gradeLevel || studentGradeLevel(student)) === grade);
        if (!gradeRows.length && feedbackGradeFilter === "Tümü") return null;
        return <section key={grade} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/70">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><div className="text-lg font-black text-slate-900">{grade}. Sınıf Geri Bildirimleri</div><div className="text-xs font-bold text-slate-400">Deneme Kulübü öğrencileri</div></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">{gradeRows.length} öğrenci</span></div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{gradeRows.length ? gradeRows.map(renderFeedbackStudentCard) : <div className="md:col-span-2 xl:col-span-3"><EmptyState title={`${grade}. sınıfta öğrenci bulunamadı`} detail="Kayıt Merkezi'nde bu sınıf seviyesine kayıtlı Deneme Kulübü öğrencisi bulunmuyor veya seçili filtreyle eşleşmiyor."/></div>}</div>
        </section>;
      })}</div> : <EmptyState title="Deneme Kulübü öğrencisi yok" detail="Geri Bildirim ekranında öğrenci göstermek için önce Kayıt Merkezi'nden Deneme Kulübü kaydı oluşturun."/>}
    </div>;
  };

  const renderTasks = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile ? <><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900"><Plus className="h-5 w-5 text-amber-600"/> Yeni Görev — {selectedProfile.studentName}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input value={taskDraft.title} onChange={(e)=>setTaskDraft({...taskDraft,title:e.target.value})} placeholder="Görev: 20 Fonksiyon sorusu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/><input value={taskDraft.subject} onChange={(e)=>setTaskDraft({...taskDraft,subject:e.target.value})} placeholder="Ders" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.questionCount} onChange={(e)=>setTaskDraft({...taskDraft,questionCount:e.target.value})} inputMode="numeric" placeholder="Soru sayısı" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.unit} onChange={(e)=>setTaskDraft({...taskDraft,unit:e.target.value})} placeholder="Ünite" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.topic} onChange={(e)=>setTaskDraft({...taskDraft,topic:e.target.value})} placeholder="Konu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.outcome} onChange={(e)=>setTaskDraft({...taskDraft,outcome:e.target.value})} placeholder="Kazanım" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/><input type="date" value={taskDraft.plannedDate} onChange={(e)=>setTaskDraft({...taskDraft,plannedDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input type="date" value={taskDraft.dueDate} onChange={(e)=>setTaskDraft({...taskDraft,dueDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={taskDraft.note} onChange={(e)=>setTaskDraft({...taskDraft,note:e.target.value})} placeholder="Koç notu" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"/></div><button disabled={saving||!taskDraft.title.trim()} onClick={()=>void addTask()} className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">Görevi Öğrenciye Ata</button></div><div className="space-y-3">{selectedProfile.tasks.length?selectedProfile.tasks.map((task)=><div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-black text-slate-900">{task.title}</div><div className="mt-1 text-xs font-bold text-slate-500">{task.subject}{task.topic?` • ${task.topic}`:""}{task.questionCount?` • ${task.questionCount} soru`:""} • Son: {humanDate(task.dueDate||task.plannedDate)}</div></div><div className="flex flex-wrap gap-2">{(["planned","started","completed","could-not"] as CoachTask["status"][]).map((status)=><button key={status} onClick={()=>void updateTaskStatus(task.id,status,status==="could-not"?(task.failureReason||"Öğrenci tamamlayamadı"):"")} className={`rounded-full border px-3 py-1.5 text-xs font-black ${task.status===status?taskStatusClass(status):"border-slate-200 bg-white text-slate-500"}`}>{coachTaskStatusLabel[status]}</button>)}</div></div></div>):<EmptyState title="Henüz görev yok" detail="Yukarıdaki formdan ilk çalışma görevini oluşturun."/>}</div></>:<EmptyState title="Öğrenci seçiniz" detail="Görev oluşturmak için önce koçluk takibine alınmış bir öğrenci seçin."/>}</div>;

  const renderMeetings = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 text-lg font-black text-slate-900">Yeni Koç Görüşmesi — {selectedProfile.studentName}</div><div className="grid gap-3 md:grid-cols-2"><input type="date" value={meetingDraft.date} onChange={(e)=>setMeetingDraft({...meetingDraft,date:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input type="date" value={meetingDraft.nextMeetingDate} onChange={(e)=>setMeetingDraft({...meetingDraft,nextMeetingDate:e.target.value})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={meetingDraft.previousWeek} onChange={(e)=>setMeetingDraft({...meetingDraft,previousWeek:e.target.value})} placeholder="Geçen haftanın hedefleri / ne oldu?" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.strengths} onChange={(e)=>setMeetingDraft({...meetingDraft,strengths:e.target.value})} placeholder="Bu hafta neyi iyi yaptı?" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.challenges} onChange={(e)=>setMeetingDraft({...meetingDraft,challenges:e.target.value})} placeholder="Zorlandığı alan / engel" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.priority} onChange={(e)=>setMeetingDraft({...meetingDraft,priority:e.target.value})} placeholder="Bu haftanın önceliği" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm"/><textarea value={meetingDraft.newGoal} onChange={(e)=>setMeetingDraft({...meetingDraft,newGoal:e.target.value})} placeholder="Yeni hedef / karar" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm md:col-span-2"/><div className="md:col-span-2"><label className="text-xs font-black text-slate-500">Motivasyon düzeyi: {meetingDraft.motivation}/5</label><input type="range" min={1} max={5} value={meetingDraft.motivation} onChange={(e)=>setMeetingDraft({...meetingDraft,motivation:Number(e.target.value)})} className="mt-2 w-full accent-amber-500"/></div></div><button onClick={()=>void addMeeting()} className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white">Görüşmeyi Kaydet</button></div><div className="space-y-3">{selectedProfile.meetings.map((meeting)=><div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div className="font-black text-slate-900">{humanDate(meeting.date)}</div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Motivasyon {meeting.motivation}/5</span></div><div className="mt-3 grid gap-2 text-sm lg:grid-cols-2"><div><b>İyi giden:</b> {meeting.strengths||"—"}</div><div><b>Zorlanılan:</b> {meeting.challenges||"—"}</div><div><b>Öncelik:</b> {meeting.priority||"—"}</div><div><b>Yeni hedef:</b> {meeting.newGoal||"—"}</div></div></div>)}</div></>:<EmptyState title="Öğrenci seçiniz" detail="Koç görüşmesini kaydetmek için öğrenci seçin."/>}</div>;

  const renderWarnings = () => <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><div className="text-xs font-black uppercase text-rose-600">Kritik</div><div className="mt-1 text-3xl font-black text-rose-800">{warnings.filter(w=>w.level==="critical").length}</div></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="text-xs font-black uppercase text-amber-600">Dikkat</div><div className="mt-1 text-3xl font-black text-amber-800">{warnings.filter(w=>w.level==="attention").length}</div></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="text-xs font-black uppercase text-emerald-600">Olumlu</div><div className="mt-1 text-3xl font-black text-emerald-800">{warnings.filter(w=>w.level==="positive").length}</div></div></div>{warnings.length?<div className="space-y-2">{warnings.map((warning)=><button key={warning.id} onClick={()=>{const p=profiles.find(x=>x.id===warning.studentId);if(p){chooseProfile(p);setStudentCardTab("overview");setView("students");}}} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${warningClass(warning.level)}`}>{warning.level==="positive"?<TrendingUp className="mt-0.5 h-5 w-5"/>:<AlertTriangle className="mt-0.5 h-5 w-5"/>}<span className="min-w-0 flex-1"><strong className="block">{warning.studentName} • {warning.classroom}</strong><span className="mt-1 block text-sm font-bold">{warning.title}</span><span className="mt-1 block text-xs opacity-80">{warning.detail}</span></span><ArrowRight className="mt-2 h-4 w-4"/></button>)}</div>:<EmptyState title="Uyarı oluşmadı" detail="Takip verileri arttıkça erken uyarı motoru burada otomatik sinyaller üretecektir."/>}</div>;

  const renderMessages = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="grid gap-5 xl:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2 font-black text-slate-900"><MessageCircle className="h-5 w-5 text-blue-500"/> {selectedProfile.studentName} ile Koçluk Mesajları</div><div className="max-h-[520px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">{selectedProfile.messages.length?selectedProfile.messages.map((message)=><div key={message.id} className={`flex ${message.direction==="coach-to-student"?"justify-end":"justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.direction==="coach-to-student"?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-800"}`}><div>{message.text}</div><div className={`mt-1 text-[10px] font-bold ${message.direction==="coach-to-student"?"text-slate-400":"text-slate-400"}`}>{humanDate(message.createdAt)}</div></div></div>):<div className="py-12 text-center text-sm text-slate-400">Henüz mesaj yok.</div>}</div><div className="mt-3 flex gap-2"><input value={messageDraft} onChange={(e)=>setMessageDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void sendMessage();}} placeholder="Kısa koçluk mesajı yazın..." className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button onClick={()=>void sendMessage()} className="rounded-xl bg-blue-600 px-4 text-white"><Send className="h-4 w-4"/></button></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-black text-slate-900">Hazır Geri Bildirimler</div><div className="mt-3 space-y-2">{["Bu haftaki gelişimin iyi, aynı düzeni koruyalım.","Planında geride kalan görevleri birlikte toparlayalım.","Son sınavdaki yükseliş dikkat çekici. Tebrik ederim.","Anlamadığın konuyu işaretle; bir sonraki görüşmede birlikte ele alalım."].map((text)=><button key={text} onClick={()=>setMessageDraft(text)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50">{text}</button>)}</div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Mesajlaşmak için takipteki öğrencilerden birini seçin."/>}</div>;

  const renderReports = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-xs font-black uppercase tracking-widest text-amber-600">Aylık Gelişim Raporu</div><h2 className="mt-1 text-2xl font-black text-slate-900">{selectedProfile.studentName}</h2><div className="text-sm font-bold text-slate-500">{selectedProfile.classroom} • {new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date())}</div></div><button onClick={()=>printMonthlyReport(selectedProfile,selectedSnapshot)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"><Printer className="h-4 w-4"/> Yazdır / PDF</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs font-bold text-emerald-600">Akademik</div><div className="text-3xl font-black text-emerald-800">%{selectedSnapshot.overallSuccess}</div></div><div className="rounded-2xl bg-blue-50 p-4"><div className="text-xs font-bold text-blue-600">Plan Uyumu</div><div className="text-3xl font-black text-blue-800">%{completionRate(selectedProfile)}</div></div><div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs font-bold text-amber-600">Görüşme</div><div className="text-3xl font-black text-amber-800">{selectedProfile.meetings.length}</div></div><div className="rounded-2xl bg-violet-50 p-4"><div className="text-xs font-bold text-violet-600">Açık Görev</div><div className="text-3xl font-black text-violet-800">{selectedProfile.tasks.filter(t=>t.status!=="completed").length}</div></div></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><div className="font-black text-slate-800">Güçlü Alanlar</div><div className="mt-3 space-y-2 text-sm">{selectedSnapshot.subjects.slice(0,3).map(row=><div key={row.subject} className="flex justify-between"><span>{row.subject}</span><b className="text-emerald-700">%{row.success}</b></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-4"><div className="font-black text-slate-800">Geliştirilmesi Gereken Alanlar</div><div className="mt-3 space-y-2 text-sm">{selectedSnapshot.priorityOutcomes.slice(0,3).map(row=><div key={row.key}><b className="text-rose-700">{row.subject}</b> — {row.outcome} <span className="font-black">%{row.success}</span></div>)}</div></div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Aylık gelişim raporunu oluşturmak için öğrenci seçin."/>}</div>;

  const renderMobile = () => <div className="space-y-5">{renderProfileSelector()}{selectedProfile?<div className="grid gap-5 xl:grid-cols-[1fr_390px]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Smartphone className="h-6 w-6"/></div><div><h3 className="text-lg font-black text-slate-900">Öğrenci Mobil Koçluk Bağlantısı</h3><p className="text-sm text-slate-500">Öğrenci kendi telefonundan görev, ilerleme ve koç mesajlarını görür.</p></div></div><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-400">Güvenli öğrenci bağlantısı</div><div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-600">{mobileLink}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={async()=>{try{await navigator.clipboard.writeText(mobileLink);}catch{}}} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"><Copy className="h-4 w-4"/> Kopyala</button><button onClick={()=>window.open(mobileLink,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white"><ExternalLink className="h-4 w-4"/> Telefonda Önizle</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500">Öğrencinin göreceği</div><div className="mt-2 text-sm font-semibold text-slate-700">Bugünkü görevler • Haftalık hedef • İlerleme • Koç mesajları • Yardım isteği</div></div><div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500">Öğrencinin yapacağı</div><div className="mt-2 text-sm font-semibold text-slate-700">Başladım • Tamamladım • Yapamadım • Koça mesaj gönder</div></div></div></div><div className="rounded-[32px] border-[8px] border-slate-900 bg-slate-50 p-4 shadow-xl"><div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-slate-800"/><div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white"><div className="text-xs font-bold opacity-80">EĞİTİM KOÇU</div><div className="mt-1 text-xl font-black">{selectedProfile.studentName}</div><div className="text-xs font-bold opacity-80">{selectedProfile.classroom}</div></div><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between text-xs font-black text-slate-500"><span>Haftalık plan</span><span>%{completionRate(selectedProfile)}</span></div><div className="mt-2"><ProgressBar value={completionRate(selectedProfile)}/></div></div><div className="mt-3 space-y-2">{selectedProfile.tasks.filter(t=>t.status!=="completed").slice(0,3).map(task=><div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="text-xs font-black text-slate-800">{task.title}</div><div className="mt-1 text-[10px] font-bold text-slate-400">{task.subject} • {humanDate(task.dueDate||task.plannedDate)}</div></div>)}</div></div></div>:<EmptyState title="Öğrenci seçiniz" detail="Mobil bağlantı oluşturmak ve önizlemek için öğrenci seçin."/>}</div>;

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500"/><div className="mt-3 text-sm font-bold text-slate-500">Eğitim Koçu verileri hazırlanıyor...</div></div></div>;

  if (view === "analysis-center") {
    return <ExamAnalysisModule key="trial-club-analysis-center" examScope="trial-club" allowedStudents={trialClubAnalysisStudents} onNavigate={onNavigate}/>;
  }

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <div className="mx-auto max-w-[1600px] space-y-5">
      {view === "registration" ? renderRegistration() : null}
      {view === "exam-calendar" ? renderExamCalendar() : null}
      {view === "exam-contents" ? renderExamContents() : null}
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
