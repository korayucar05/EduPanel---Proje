import React from "react";
import { activeCustomReminders, displayExamMoment, inNext48Hours, localExamTimestamp } from "../utils/mobileReminderInformation";
import EduPanelMobileButton from "./common/EduPanelMobileButton";
import MobileIdentityBanner from "./common/MobileIdentityBanner";
import SchoolRadioView from "./SchoolRadioView";
import TrialClubView from "./TrialClubView";
import MobileSurveyView from "./MobileSurveyView";
import { disableWebPush, enableWebPush, hasWebPushSubscription } from "../lib/webPushClient";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import { contradictionRecordsForStudent, readAcademicContradictionRecords, type AcademicContradictionDeliveryRecord } from "../core/intelligence/academicContradictionDelivery";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  Heart,
  Mail,
  MailOpen,
  Loader2,
  MessageCircleMore,
  ClipboardList,
  Sparkles,
  Bell,
  BellRing,
  Download,
  BellOff,
  X,
  UserRound,
  BookOpen,
  Target,
  PartyPopper,
  Radio,
} from "lucide-react";

type PortalKind = "parent" | "student";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};


type PortalPayload = {
  kind: PortalKind;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classroom: string;
  schoolName?: string;
  schoolId?: string;
};

type PortalMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

type PortalMessage = {
  id: string;
  receiptId: string;
  title: string;
  body: string;
  teacherName: string;
  teacherId?: string;
  createdAt: string;
  sentAt: string;
  openedAt?: string | null;
  lastOpenedAt?: string | null;
  recipientType: PortalKind;
  attachment?: PortalMessageAttachment | null;
};

type PortalSentMessage = {
  id: string;
  messageId: string;
  recipientTeacherId: string;
  senderType: PortalKind;
  senderName: string;
  body: string;
  createdAt: string;
  openedAt?: string | null;
};


type PortalAnnouncement = {
  id: string;
  title: string;
  content: string;
  date: string;
  examDate: string;
  examTime: string;
  courseName: string;
  buildingName: string;
  floorName?: string;
  roomName: string;
  seatNumber: string;
  supervisorName: string;
  createdAt: string;
  expiresAt: string;
};

type PortalMobileFeedItem = {
  id: string;
  title: string;
  content: string;
  date: string;
  time?: string;
  createdAt?: string;
  source?: string;
  url?: string;
};

type ParentConsent = {
  id: string;
  campaignId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classroom: string;
  parentPhone?: string;
  title: string;
  description: string;
  principalName: string;
  eventDate?: string;
  expiresAt?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  respondedAt?: string | null;
};

type YearbookClassmate = { id: string; name: string; number: string; classroom: string; };
type YearbookSurveyQuestion = { id: string; text: string; answerType: "short" | "paragraph" | "number" | "phone" | "choice" | "multiple" | "dropdown"; options: string[]; required: boolean; };
type YearbookSurvey = { id: string; title: string; description?: string; questions: YearbookSurveyQuestion[]; };
type YearbookEntry = { targetStudentId: string; comment: string; surveyAnswers: Record<string, string | string[]>; updatedAt?: string; };
type YearbookPayload = { open: boolean; surveyId: string; survey: YearbookSurvey | null; currentStudent: YearbookClassmate | null; classmates: YearbookClassmate[]; myEntries: YearbookEntry[]; };

type StudentBehaviorRecord = {
  id: string;
  studentId: string;
  behaviorName: string;
  behaviorType?: string;
  teacherName: string;
  date: string;
  createdAt?: string | number;
  submittedAt?: string;
};

type StudentScheduleAssignment = {
  courseName: string;
  teacherName: string;
};

type StudentScheduleSlot = {
  hour: number;
  start: string;
  end: string;
  assignment?: StudentScheduleAssignment | null;
};

type StudentWeeklySchedule = {
  now: { date: string; day: string; time: string };
  days: Array<{ day: string; slots: StudentScheduleSlot[] }>;
};

type StudentExamSubjectQuestionResult = {
  questionNumber: number;
  originalIndex: number;
  status: "correct" | "wrong" | "empty";
  correctRate: number;
  correctAnswer?: string;
  studentAnswer?: string;
  unit?: string;
  topic?: string;
  outcome?: string;
};

type StudentExamSubjectResult = {
  subjectName: string;
  questionCount: number;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  score?: number;
  studentSuccess?: number;
  schoolSuccess?: number;
  generalSuccess?: number | null;
  hasGeneralComparison?: boolean;
  classroomRank: number;
  schoolRank: number;
  generalRank: number;
  questions?: StudentExamSubjectQuestionResult[];
};

const normalizeSubjectQuestions = (value: unknown): StudentExamSubjectQuestionResult[] => {
  if (Array.isArray(value)) return value as StudentExamSubjectQuestionResult[];
  if (!value || typeof value !== "object") return [];
  const values = Object.values(value as Record<string, unknown>);
  if (values.length === 1 && Array.isArray(values[0])) {
    return values[0] as StudentExamSubjectQuestionResult[];
  }
  return values.filter((item): item is StudentExamSubjectQuestionResult =>
    Boolean(item && typeof item === "object")
  );
};

type StudentExamResult = {
  id: string;
  examName: string;
  examDate: string;
  student: {
    id: string;
    name: string;
    number: string;
    classroom: string;
    photoUrl?: string;
  };
  overall: {
    correct: number;
    wrong: number;
    empty: number;
    net: number;
    classroomRank: number;
    schoolRank: number;
    generalRank: number;
  };
  subjects: StudentExamSubjectResult[];
};



type StudentHomeExam = {
  id: string;
  examName: string;
  examDate: string;
  examType: string;
  gradeLevel: string;
  subjects: Array<{ name: string; count: number }>;
  totalQuestionCount: number;
  submitted: boolean;
  submittedAt?: string | null;
};

type StudentExamCalendarItem = {
  id: string;
  gradeLevel: string;
  examName: string;
  examNumber: number;
  examDate: string;
  contents: Array<{ subject: string; topics: string }>;
};


const requestJson = async <T,>(
  url: string,
  timeoutMs = 7000,
  init?: RequestInit,
): Promise<T> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Bağlantı açılamadı.");
    return data as T;
  } finally {
    window.clearTimeout(timer);
  }
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatTime = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};


const base64UrlToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};


const STUDENT_SCHEDULE_DAYS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
];

const STUDENT_DEFAULT_LESSON_TIMES: StudentScheduleSlot[] = [
  { hour: 1, start: "08:30", end: "09:10", assignment: null },
  { hour: 2, start: "09:20", end: "10:00", assignment: null },
  { hour: 3, start: "10:10", end: "10:50", assignment: null },
  { hour: 4, start: "11:00", end: "11:40", assignment: null },
  { hour: 5, start: "11:50", end: "12:30", assignment: null },
  { hour: 6, start: "13:30", end: "14:10", assignment: null },
  { hour: 7, start: "14:20", end: "15:00", assignment: null },
  { hour: 8, start: "15:10", end: "15:50", assignment: null },
];

const emptyStudentWeeklySchedule = (): StudentWeeklySchedule => {
  const now = new Date();
  const rawDay = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
  }).format(now);
  const day =
    rawDay.charAt(0).toLocaleUpperCase("tr-TR") +
    rawDay.slice(1).toLocaleLowerCase("tr-TR");

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return {
    now: { date, day, time },
    days: STUDENT_SCHEDULE_DAYS.map((scheduleDay) => ({
      day: scheduleDay,
      slots: STUDENT_DEFAULT_LESSON_TIMES.map((slot) => ({ ...slot })),
    })),
  };
};

export default function ParentStudentPortalView() {
  const path = window.location.pathname;
  const kind: PortalKind = /^\/veli\//i.test(path) ? "parent" : "student";
  const token = decodeURIComponent(path.split("/").filter(Boolean)[1] || "");

  const portalIdentityCacheKey = `enstitu-portal-identity:${kind}:${token}`;
  const [payload, setPayload] = React.useState<PortalPayload | null>(() => {
    try {
      const cached = sessionStorage.getItem(portalIdentityCacheKey) || localStorage.getItem(portalIdentityCacheKey);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed && parsed.studentId ? parsed as PortalPayload : null;
    } catch {
      return null;
    }
  });
  const [openingReminders, setOpeningReminders] = React.useState<Array<{ id: string; title: string; detail: string }>>([]);
  const [openingReminderVisible, setOpeningReminderVisible] = React.useState(false);
  const openingReminderLoaded = React.useRef(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(() => payload === null);
  const cachePortalIdentity = React.useCallback((value: PortalPayload) => {
    try {
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(portalIdentityCacheKey, serialized);
      localStorage.setItem(portalIdentityCacheKey, serialized);
    } catch {}
  }, [portalIdentityCacheKey]);

  type PortalView = "home" | "announcements" | "messages" | "behavior" | "homework" | "schedule" | "study" | "exams" | "consents" | "yearbook" | "radio" | "trial-club" | "survey";
  const [view, setView] = React.useState<PortalView>("home");
  const [announcements, setAnnouncements] = React.useState<PortalAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = React.useState(false);
  const [announcementsError, setAnnouncementsError] = React.useState("");
  const [generalAnnouncements, setGeneralAnnouncements] = React.useState<PortalMobileFeedItem[]>([]);
  const [newsItems, setNewsItems] = React.useState<PortalMobileFeedItem[]>([]);
  const [announcementTab, setAnnouncementTab] = React.useState<"announcements" | "news">("announcements");
  const [selectedAnnouncementFeedId, setSelectedAnnouncementFeedId] = React.useState("");
  const announcementSwipeStartX = React.useRef<number | null>(null);
  const [messages, setMessages] = React.useState<PortalMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [messagesError, setMessagesError] = React.useState("");
  const [selectedMessageId, setSelectedMessageId] = React.useState("");
  const [portalMessageTab, setPortalMessageTab] = React.useState<"inbox" | "sent">("inbox");
  const [portalSentMessages, setPortalSentMessages] = React.useState<PortalSentMessage[]>([]);
  const [portalReplyBody, setPortalReplyBody] = React.useState("");
  const [portalReplyBusy, setPortalReplyBusy] = React.useState(false);
  const portalMessageSwipeStartX = React.useRef<number | null>(null);
  const [parentConsents, setParentConsents] = React.useState<ParentConsent[]>([]);
  const [consentsLoading, setConsentsLoading] = React.useState(false);
  const [consentsError, setConsentsError] = React.useState("");
  const [selectedConsentId, setSelectedConsentId] = React.useState("");
  const [yearbook, setYearbook] = React.useState<YearbookPayload | null>(null);
  const [yearbookLoading, setYearbookLoading] = React.useState(false);
  const [yearbookError, setYearbookError] = React.useState("");
  const [yearbookTargetId, setYearbookTargetId] = React.useState("");
  const [yearbookComment, setYearbookComment] = React.useState("");
  const [yearbookSurveyAnswers, setYearbookSurveyAnswers] = React.useState<Record<string, string | string[]>>({});
  const [yearbookSaving, setYearbookSaving] = React.useState(false);
  const [yearbookPage, setYearbookPage] = React.useState<0 | 1>(0);
  const yearbookTouchStartX = React.useRef<number | null>(null);
  const [behaviorRecords, setBehaviorRecords] = React.useState<StudentBehaviorRecord[]>([]);
  const [behaviorLoading, setBehaviorLoading] = React.useState(false);
  const [behaviorError, setBehaviorError] = React.useState("");
  const [installPrompt, setInstallPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalledThisSession, setAppInstalledThisSession] =
    React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(() => {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      );
    } catch {
      return false;
    }
  });
  const portalHistoryMarker = React.useMemo(
    () => `enstitu-family-portal:${kind}:${token}`,
    [kind, token],
  );

  const goToView = React.useCallback((next: PortalView) => {
    if (view === next) return;
    try {
      const currentState = window.history.state || {};
      const currentDepth = currentState?.enstituPortalMarker === portalHistoryMarker
        ? Number(currentState.enstituPortalDepth || 0)
        : 0;
      window.history.pushState(
        {
          ...currentState,
          enstituPortalMarker: portalHistoryMarker,
          enstituPortalView: next,
          enstituPortalDepth: currentDepth + 1,
        },
        "",
        window.location.href,
      );
    } catch {}
    setView(next);
  }, [portalHistoryMarker, view]);

  const goBackView = React.useCallback(() => {
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
          enstituPortalView: "home",
          enstituPortalDepth: 0,
        },
        "",
        window.location.href,
      );
    } catch {}
    setView("home");
  }, [portalHistoryMarker]);

  React.useEffect(() => {
    try {
      const currentState = window.history.state || {};
      if (currentState?.enstituPortalMarker === portalHistoryMarker) {
        setView((currentState.enstituPortalView || "home") as PortalView);
      } else {
        window.history.replaceState(
          {
            ...currentState,
            enstituPortalMarker: portalHistoryMarker,
            enstituPortalView: "home",
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
        setView((state.enstituPortalView || "home") as PortalView);
        return;
      }

      // Öğrenci/veli mobil ana ekranından geri gidildiğinde portalın açılışına
      // dönme; modül ekranında kal.
      setView("home");
      try {
        window.history.pushState(
          {
            ...(window.history.state || {}),
            enstituPortalMarker: portalHistoryMarker,
            enstituPortalView: "home",
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
  const [studentSchedule, setStudentSchedule] =
    React.useState<StudentWeeklySchedule>(() => emptyStudentWeeklySchedule());
  const [scheduleLoading, setScheduleLoading] = React.useState(false);
  const [scheduleError, setScheduleError] = React.useState("");
  const [studentExams, setStudentExams] =
    React.useState<StudentExamResult[]>([]);
  const [academicContradictions, setAcademicContradictions] =
    React.useState<AcademicContradictionDeliveryRecord[]>([]);
  const [academicContradictionsLoading, setAcademicContradictionsLoading] =
    React.useState(false);
  const [studentExamsLoading, setStudentExamsLoading] =
    React.useState(false);
  const [studentExamsError, setStudentExamsError] =
    React.useState("");
  const [selectedStudentExamId, setSelectedStudentExamId] =
    React.useState("");

  const [studentHomeExams, setStudentHomeExams] = React.useState<StudentHomeExam[]>([]);
  const [studentHomeExamsLoading, setStudentHomeExamsLoading] = React.useState(false);
  const [studentHomeExamsError, setStudentHomeExamsError] = React.useState("");
  const [selectedStudentHomeExamId, setSelectedStudentHomeExamId] = React.useState("");
  const [studentHomeExamAnswers, setStudentHomeExamAnswers] = React.useState<Record<string, string[]>>({});
  const [studentHomeExamSaving, setStudentHomeExamSaving] = React.useState(false);
  const [studentHomeExamNotice, setStudentHomeExamNotice] = React.useState("");
  const [studentExamCalendar, setStudentExamCalendar] = React.useState<StudentExamCalendarItem[]>([]);
  const [studentExamCalendarLoading, setStudentExamCalendarLoading] = React.useState(false);
  const [studentExamCalendarError, setStudentExamCalendarError] = React.useState("");

  React.useEffect(() => {
    if (!payload?.studentId && !payload?.studentNumber) {
      setAcademicContradictions([]);
      return;
    }
    let active = true;
    const refresh = async (showLoader = false) => {
      if (showLoader && active) setAcademicContradictionsLoading(true);
      try {
        const rows = await readAcademicContradictionRecords();
        if (!active) return;
        setAcademicContradictions(
          contradictionRecordsForStudent(rows, payload?.studentId, payload?.studentNumber),
        );
      } catch {
        if (active) setAcademicContradictions([]);
      } finally {
        if (showLoader && active) setAcademicContradictionsLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 60000);
    const onFocus = () => void refresh(false);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [payload?.studentId, payload?.studentNumber]);
  const [examTrendsOpen, setExamTrendsOpen] = React.useState(false);
  const [trendSubjectPickerOpen, setTrendSubjectPickerOpen] = React.useState(false);
  const [selectedTrendSubject, setSelectedTrendSubject] = React.useState("");
  const [trendTab, setTrendTab] = React.useState<"percent" | "question" | "outcome" | "suggestion">("percent");
  const [trendCommentOpen, setTrendCommentOpen] = React.useState(false);
  const [selectedTrendQuestionExamId, setSelectedTrendQuestionExamId] = React.useState("");
  const [selectedExamSubjectDetail, setSelectedExamSubjectDetail] = React.useState<{ examId: string; subjectName: string } | null>(null);
  const [examEntryMode, setExamEntryMode] = React.useState<"menu" | "calendar" | "home" | "examList" | "development" | "overview">("menu");
  const [scheduleDayIndex, setScheduleDayIndex] = React.useState(0);
  const scheduleScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [pushEnabled, setPushEnabled] = React.useState(() => {
    try {
      return localStorage.getItem(`enstitu-${kind}-closed-message-notification`) === "1";
    } catch {
      return false;
    }
  });
  const [pushInfo, setPushInfo] = React.useState("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);



  const [notificationCounts, setNotificationCounts] = React.useState({
    behavior: 0,
    homework: 0,
    exams: 0,
    messages: 0,
  });
  const [notificationSoundEnabled, setNotificationSoundEnabled] =
    React.useState(() => {
      try {
        return localStorage.getItem("enstitu-student-notification-sound") === "1";
      } catch {
        return false;
      }
    });

  const previousNotificationTotalRef = React.useRef<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const playEnstituNotificationSound = React.useCallback(async () => {
    if (!notificationSoundEnabled) return;

    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as any).webkitAudioContext;

      if (!AudioContextCtor) return;

      let context = audioContextRef.current;
      if (!context) {
        context = new AudioContextCtor();
        audioContextRef.current = context;
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      const now = context.currentTime;
      const master = context.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.18, now + 0.025);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      master.connect(context.destination);

      const first = context.createOscillator();
      first.type = "sine";
      first.frequency.setValueAtTime(880, now);
      first.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18);
      first.connect(master);
      first.start(now);
      first.stop(now + 0.28);

      const second = context.createOscillator();
      const secondGain = context.createGain();
      second.type = "sine";
      second.frequency.setValueAtTime(1318.5, now + 0.28);
      secondGain.gain.setValueAtTime(0.0001, now);
      secondGain.gain.setValueAtTime(0.8, now + 0.28);
      secondGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      second.connect(secondGain);
      secondGain.connect(master);
      second.start(now + 0.28);
      second.stop(now + 0.62);
    } catch {
      // Ses oynatılamazsa bildirim rozeti yine çalışmaya devam eder.
    }
  }, [notificationSoundEnabled]);

  const enableNotificationSound = React.useCallback(async () => {
    try {
      localStorage.setItem("enstitu-student-notification-sound", "1");
    } catch {}
    setNotificationSoundEnabled(true);

    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {}

    // Kullanıcı dokunuşu sırasında AudioContext'i aç ve tek kısa test sesi çal.
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        let context = audioContextRef.current;
        if (!context) {
          context = new AudioContextCtor();
          audioContextRef.current = context;
        }
        if (context.state === "suspended") await context.resume();
      }
    } catch {}

    window.setTimeout(() => {
      void playEnstituNotificationSound();
    }, 50);
  }, [playEnstituNotificationSound]);

  const disableNotificationSound = React.useCallback(() => {
    try {
      localStorage.setItem("enstitu-student-notification-sound", "0");
    } catch {}
    setNotificationSoundEnabled(false);
  }, []);

  const disableStudentPush = React.useCallback(async () => {
    setPushEnabled(false);
    try {
      localStorage.setItem(`enstitu-${kind}-closed-message-notification`, "0");
    } catch {}

    try {
      await disableWebPush({
        subscribeUrl: `/api/public-portal/${encodeURIComponent(token)}/push/subscribe`,
      });
    } catch {}

    setPushInfo("Kapalıyken mesaj bildirimi kapatıldı.");
  }, [kind, token]);


  const seenStorageKey = React.useMemo(
    () => `enstitu-student-seen:${kind}:${payload?.studentId || "unknown"}`,
    [kind, payload?.studentId],
  );

  const readSeenState = React.useCallback(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(seenStorageKey) || "{}");
      return {
        behavior: Number(parsed?.behavior || 0),
        homework: Number(parsed?.homework || 0),
        exams: Number(parsed?.exams || 0),
        messages: Number(parsed?.messages || 0),
      };
    } catch {
      return { behavior: 0, homework: 0, exams: 0, messages: 0 };
    }
  }, [seenStorageKey]);

  const markModuleSeen = React.useCallback(
    (module: "behavior" | "homework" | "exams" | "messages") => {
      const current = readSeenState();
      try {
        localStorage.setItem(
          seenStorageKey,
          JSON.stringify({ ...current, [module]: Date.now() }),
        );
      } catch {}
      setNotificationCounts((counts) => ({ ...counts, [module]: 0 }));
    },
    [readSeenState, seenStorageKey],
  );



  React.useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");

    const refreshStandalone = () => {
      setIsStandalone(
        media.matches || (window.navigator as any).standalone === true,
      );
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setAppInstalledThisSession(true);
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    refreshStandalone();
    media.addEventListener?.("change", refreshStandalone);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      media.removeEventListener?.("change", refreshStandalone);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installStudentApp = React.useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setAppInstalledThisSession(true);
          setInstallPrompt(null);
        }
      } catch {}
      return;
    }

    // iOS ve beforeinstallprompt desteklemeyen tarayıcılarda kullanıcıya
    // tarayıcının kendi "Ana Ekrana Ekle / Uygulamayı Yükle" menüsünü kullanması söylenir.
    try {
      if (
        /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !(window.navigator as any).standalone
      ) {
        alert(
          'Safari paylaşım menüsünü açıp "Ana Ekrana Ekle" seçeneğini kullanınız.',
        );
      } else {
        alert(
          'Tarayıcı menüsünden "Uygulamayı yükle" veya "Ana ekrana ekle" seçeneğini kullanınız.',
        );
      }
    } catch {}
  }, [installPrompt]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      const endpoints = [
        `/api/public-portal/${encodeURIComponent(token)}`,
        `/api/behavior/teacher-links/public-portal/${encodeURIComponent(token)}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const result = await requestJson<PortalPayload>(endpoint, 5000);
          if (!active) return;
          if (result && result.studentId) {
            setPayload(result);
            cachePortalIdentity(result);
            setLoading(false);
            return;
          }
        } catch {}
      }

      try {
        const rows = await requestJson<any[]>(
          "/api/database/collections/publicPortalLinks",
          5000,
        );

        const row = Array.isArray(rows)
          ? rows.find(
              (item: any) =>
                String(item?.recoverableToken || "") === token &&
                String(item?.kind || "") === kind &&
                !item?.revokedAt,
            )
          : null;

        if (!active) return;

        if (row) {
          const identity: PortalPayload = {
            kind,
            studentId: String(row.studentId || ""),
            studentName: String(row.studentName || ""),
            studentNumber: String(row.studentNumber || ""),
            classroom: String(row.classroom || ""),
            schoolName: String(row.schoolName || "Ordu Lisesi"),
          };
          setPayload(identity);
          cachePortalIdentity(identity);
          setLoading(false);
          return;
        }

        setError("Bu uygulama bağlantısı bulunamadı veya geçersiz.");
      } catch (reason: any) {
        if (!active) return;
        setError(
          reason?.name === "AbortError"
            ? "Uygulama bilgileri sunucudan alınamadı."
            : reason?.message || "Uygulama bilgileri alınamadı.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [token, kind, cachePortalIdentity]);

  React.useEffect(() => {
    if (!payload) return;
    document.title =
      kind === "parent"
        ? `${payload.studentName || "Veli"} · e-Nstitü`
        : `${payload.studentName || "Öğrenci"} · e-Nstitü`;
  }, [payload, kind]);


  const loadNotificationCounts = React.useCallback(async () => {
    if (!payload?.studentId) return;

    const studentId = String(payload.studentId || "").trim();
    const studentNumber = String(payload.studentNumber || "").trim();
    const seen = readSeenState();

    const safeRows = async (collection: string) => {
      try {
        const response = await fetch(
          `/api/database/collections/${encodeURIComponent(collection)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return [];
        const rows = await response.json().catch(() => []);
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    };

    const rowTime = (row: any) => {
      for (const value of [
        row?.updatedAt,
        row?.submittedAt,
        row?.sentAt,
        row?.createdAt,
        row?.publishedAt,
        row?.releasedAt,
        row?.examDate,
        row?.date,
      ]) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (value) {
          const parsed = new Date(value).getTime();
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return 0;
    };

    const belongsToStudent = (row: any) => {
      const ids = [
        row?.studentId,
        row?.student_id,
        row?.student?.id,
        row?.ogrenciId,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map(String);
      if (ids.includes(studentId)) return true;

      if (studentNumber) {
        const numbers = [
          row?.studentNumber,
          row?.studentNo,
          row?.number,
          row?.ogrenciNo,
          row?.student?.number,
        ]
          .filter((value) => value !== undefined && value !== null)
          .map((value) => String(value).trim());
        if (numbers.includes(studentNumber)) return true;
      }
      return false;
    };

    const [
      behaviorRows,
      homeworkRows,
      receiptRows,
      examResults,
      studentExamResults,
      examStudentResults,
      opticalResults,
      examAnalysisResults,
    ] = await Promise.all([
      safeRows("behaviorTeacherSubmissions"),
      safeRows("teacherHomeworkEvaluations"),
      safeRows("teacherAppMessageReceipts"),
      safeRows("examResults"),
      safeRows("studentExamResults"),
      safeRows("examStudentResults"),
      safeRows("opticalResults"),
      safeRows("examAnalysisResults"),
    ]);

    const behavior = behaviorRows.filter(
      (row: any) => belongsToStudent(row) && rowTime(row) > seen.behavior,
    ).length;

    const homework = homeworkRows.filter(
      (row: any) => belongsToStudent(row) && rowTime(row) > seen.homework,
    ).length;

    const messages = receiptRows.filter(
      (row: any) =>
        belongsToStudent(row) &&
        String(row?.recipientType || "parent") === kind &&
        !row?.openedAt,
    ).length;

    const examRows = [
      ...examResults,
      ...studentExamResults,
      ...examStudentResults,
      ...opticalResults,
      ...examAnalysisResults,
    ];

    const exams = examRows.filter((row: any) => {
      if (!belongsToStudent(row)) return false;
      const published =
        row?.published !== false &&
        row?.isPublished !== false &&
        row?.visible !== false &&
        String(row?.status || "").toLowerCase() !== "draft" &&
        String(row?.status || "").toLocaleLowerCase("tr-TR") !== "taslak";
      return published && rowTime(row) > seen.exams;
    }).length;

    setNotificationCounts({ behavior, homework, exams, messages });
  }, [kind, payload?.studentId, payload?.studentNumber, readSeenState]);

  React.useEffect(() => {
    if (!payload?.studentId) return;
    void loadNotificationCounts();
    const timer = window.setInterval(() => void loadNotificationCounts(), 30000);
    return () => window.clearInterval(timer);
  }, [payload?.studentId, loadNotificationCounts]);


  React.useEffect(() => {
    const total =
      Number(notificationCounts.behavior || 0) +
      Number(notificationCounts.homework || 0) +
      Number(notificationCounts.exams || 0) +
      Number(notificationCounts.messages || 0);

    const syncBadge = async () => {
      try {
        const nav = navigator as Navigator & {
          setAppBadge?: (count?: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };

        if (total > 0 && nav.setAppBadge) {
          await nav.setAppBadge(Math.min(total, 99));
        } else if (total <= 0 && nav.clearAppBadge) {
          await nav.clearAppBadge();
        }
      } catch {
        // Badging API desteklenmiyorsa uygulama içi rozetler çalışmaya devam eder.
      }
    };

    void syncBadge();
  }, [notificationCounts]);

  React.useEffect(() => {
    const total =
      notificationCounts.behavior +
      notificationCounts.homework +
      notificationCounts.exams +
      notificationCounts.messages;

    const previous = previousNotificationTotalRef.current;
    previousNotificationTotalRef.current = total;

    // İlk yüklemede geçmiş bildirimler için ses çalma.
    if (previous === null || total <= previous || total <= 0) return;

    void playEnstituNotificationSound();

    try {
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        const notification = new Notification("e-Nstitü · Yeni Bildirim", {
          body: kind === "parent" ? "Veli uygulamanızda yeni bir bilgilendirme var." : "Öğrenci uygulamanızda yeni bir bilgilendirme var.",
          tag: "enstitu-student-single-notification",
          renotify: true,
        } as NotificationOptions);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    } catch {}
  }, [notificationCounts, playEnstituNotificationSound]);




  const enableStudentPush = React.useCallback(async () => {
    if (!token) return;

    setPushEnabled(true);
    try {
      localStorage.setItem(`enstitu-${kind}-closed-message-notification`, "1");
    } catch {}

    try {
      await enableWebPush({
        subscribeUrl: `/api/public-portal/${encodeURIComponent(token)}/push/subscribe`,
        startUrl: window.location.href,
      });
      setPushInfo("Kapalıyken mesaj bildirimi etkin. Yeni mesajlar telefon ekranına bildirim olarak gelir.");
    } catch (reason: any) {
      setPushEnabled(false);
      try { localStorage.setItem(`enstitu-${kind}-closed-message-notification`, "0"); } catch {}
      setPushInfo(reason?.message || "Push bildirimi etkinleştirilemedi.");
    }
  }, [kind, token]);

  React.useEffect(() => {
    let requested = false;
    try { requested = localStorage.getItem(`enstitu-${kind}-closed-message-notification`) === "1"; } catch {}
    if (!requested) return;
    void hasWebPushSubscription().then((active) => {
      setPushEnabled(active);
      if (!active) { try { localStorage.setItem(`enstitu-${kind}-closed-message-notification`, "0"); } catch {} }
    });
  }, [kind]);


  const loadStudentExamResults = React.useCallback(async () => {
    if (!token || kind !== "student") return;
    setStudentExamsLoading(true);
    setStudentExamsError("");

    try {
      const response = await fetch(
        `/api/public-portal/${encodeURIComponent(token)}/exam-results`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.error || "Sınav sonuçları alınamadı.",
        );
      }

      const exams = (Array.isArray(data?.exams) ? data.exams : []).map((exam: any) => ({
        ...exam,
        subjects: (Array.isArray(exam?.subjects) ? exam.subjects : []).map((subject: any) => ({
          ...subject,
          questions: normalizeSubjectQuestions(subject?.questions),
        })),
      }));
      setStudentExams(exams);
    } catch (reason: any) {
      setStudentExamsError(
        reason?.message || "Sınav sonuçları yüklenemedi.",
      );
    } finally {
      setStudentExamsLoading(false);
    }
  }, [kind, token]);

  const loadStudentHomeExams = React.useCallback(async () => {
    if (!token || kind !== "student") return;
    setStudentHomeExamsLoading(true);
    setStudentHomeExamsError("");
    try {
      const data = await requestJson<{ exams?: StudentHomeExam[] }>(
        `/api/public-portal/${encodeURIComponent(token)}/home-exams`,
      );
      setStudentHomeExams(Array.isArray(data?.exams) ? data.exams : []);
    } catch (reason: any) {
      setStudentHomeExamsError(reason?.message || "Evde denemeler yüklenemedi.");
    } finally {
      setStudentHomeExamsLoading(false);
    }
  }, [kind, token]);

  const loadStudentExamCalendar = React.useCallback(async () => {
    if (!token || kind !== "student") return;
    setStudentExamCalendarLoading(true);
    setStudentExamCalendarError("");
    try {
      const data = await requestJson<{ items?: StudentExamCalendarItem[] }>(
        `/api/public-portal/${encodeURIComponent(token)}/exam-calendar`,
      );
      setStudentExamCalendar(Array.isArray(data?.items) ? data.items : []);
    } catch (reason: any) {
      setStudentExamCalendarError(reason?.message || "Sınav takvimi yüklenemedi.");
      setStudentExamCalendar([]);
    } finally {
      setStudentExamCalendarLoading(false);
    }
  }, [kind, token]);

  const openStudentExamCalendar = async () => {
    setExamEntryMode("calendar");
    await loadStudentExamCalendar();
  };

  const openStudentHomeExams = async () => {
    setSelectedStudentHomeExamId("");
    setStudentHomeExamAnswers({});
    setStudentHomeExamNotice("");
    setExamEntryMode("home");
    await loadStudentHomeExams();
  };

  const submitStudentHomeExam = async (exam: StudentHomeExam) => {
    if (studentHomeExamSaving || exam.submitted) return;
    const unanswered = exam.subjects.reduce((sum, subject) => {
      const answers = studentHomeExamAnswers[subject.name] || [];
      return sum + Array.from({ length: subject.count }, (_, index) => answers[index] || "").filter((answer) => !answer).length;
    }, 0);
    const confirmation = unanswered > 0
      ? `Bu denemede ${unanswered} soru boş bırakıldı. Cevaplar yalnızca bir kez kaydedilebilir. Kaydetmek istiyor musunuz?`
      : "Cevaplar yalnızca bir kez kaydedilebilir ve daha sonra değiştirilemez. Kaydetmek istiyor musunuz?";
    if (!window.confirm(confirmation)) return;

    setStudentHomeExamSaving(true);
    setStudentHomeExamsError("");
    try {
      const result = await requestJson<{ success: boolean; submittedAt?: string }>(
        `/api/public-portal/${encodeURIComponent(token)}/home-exams/${encodeURIComponent(exam.id)}/submit`,
        10000,
        {
          method: "POST",
          body: JSON.stringify({ answers: studentHomeExamAnswers }),
        },
      );
      setStudentHomeExams((current) => current.filter((item) => item.id !== exam.id));
      setSelectedStudentHomeExamId("");
      setStudentHomeExamAnswers({});
      setStudentHomeExamNotice("Cevaplarınız kaydedildi. Bu deneme için tekrar cevap girişi yapılamaz.");
    } catch (reason: any) {
      const message = reason?.message || "Cevaplar kaydedilemedi.";
      setStudentHomeExamsError(message);
      if (String(message).toLocaleLowerCase("tr-TR").includes("daha önce kaydedilmiş")) {
        setSelectedStudentHomeExamId("");
        setStudentHomeExamAnswers({});
        await loadStudentHomeExams();
      }
    } finally {
      setStudentHomeExamSaving(false);
    }
  };

  const openStudentExams = async () => {
    markModuleSeen("exams");
    setSelectedStudentExamId("");
    setSelectedStudentHomeExamId("");
    setStudentHomeExamAnswers({});
    setStudentHomeExamNotice("");
    setExamEntryMode("menu");
    goToView("exams");
    await Promise.all([loadStudentExamResults(), loadStudentHomeExams(), loadStudentExamCalendar()]);
  };

  React.useEffect(() => {
    if (kind !== "student" || !payload?.studentId || studentExams.length > 0) return;
    void loadStudentExamResults();
  }, [kind, payload?.studentId, studentExams.length, loadStudentExamResults]);

  const loadStudentSchedule = React.useCallback(async () => {
    if (!token || kind !== "student") return;
    setScheduleLoading(true);
    setScheduleError("");
    try {
      const response = await fetch(
        `/api/public-portal/${encodeURIComponent(token)}/schedule`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Haftalık ders programı alınamadı.");
      }

      const incoming = data as StudentWeeklySchedule;
      const fallback = emptyStudentWeeklySchedule();

      const next: StudentWeeklySchedule = {
        now: incoming?.now || fallback.now,
        days: STUDENT_SCHEDULE_DAYS.map((day) => {
          const incomingDay = Array.isArray(incoming?.days)
            ? incoming.days.find((item) => item?.day === day)
            : undefined;

          const incomingByHour = new Map(
            (Array.isArray(incomingDay?.slots) ? incomingDay.slots : []).map(
              (slot) => [Number(slot?.hour || 0), slot],
            ),
          );

          return {
            day,
            slots: STUDENT_DEFAULT_LESSON_TIMES.map((fallbackSlot) => {
              const incomingSlot = incomingByHour.get(fallbackSlot.hour);
              return {
                hour: fallbackSlot.hour,
                start:
                  String(incomingSlot?.start || fallbackSlot.start),
                end:
                  String(incomingSlot?.end || fallbackSlot.end),
                assignment: incomingSlot?.assignment || null,
              };
            }),
          };
        }),
      };

      setStudentSchedule(next);
      const todayIndex = Math.max(
        0,
        (next.days || []).findIndex((item) => item.day === next.now?.day),
      );
      setScheduleDayIndex(todayIndex);

      window.requestAnimationFrame(() => {
        const scroller = scheduleScrollerRef.current;
        if (!scroller) return;
        scroller.scrollTo({
          left: scroller.clientWidth * todayIndex,
          behavior: "auto",
        });
      });
    } catch (reason: any) {
      setStudentSchedule((current) => current || emptyStudentWeeklySchedule());
      setScheduleError(
        reason?.message ||
          "Ders atamaları alınamadı. Boş haftalık program gösteriliyor.",
      );
    } finally {
      setScheduleLoading(false);
    }
  }, [kind, token]);

  const openStudentSchedule = async () => {
    goToView("schedule");
    await loadStudentSchedule();
  };

  const loadBehaviorRecords = React.useCallback(async () => {
    if (!payload?.studentId) return;
    setBehaviorLoading(true);
    setBehaviorError("");
    try {
      const response = await fetch(
        "/api/database/collections/behaviorTeacherSubmissions",
        { cache: "no-store" },
      );
      const rows = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error("Davranış kayıtları okunamadı.");
      }

      const studentId = String(payload.studentId || "").trim();
      const studentNumber = String(payload.studentNumber || "").trim();

      const items = (Array.isArray(rows) ? rows : [])
        .filter((row: any) => {
          if (String(row?.studentId || "").trim() === studentId) return true;
          if (
            studentNumber &&
            String(row?.studentNumber || "").trim() === studentNumber
          ) return true;
          return false;
        })
        .map((row: any) => ({
          id: String(row?.id || ""),
          studentId: String(row?.studentId || ""),
          behaviorName: String(row?.behaviorName || row?.behavior || "Davranış Kaydı"),
          behaviorType: String(row?.behaviorType || ""),
          teacherName: String(row?.teacherName || "Öğretmen"),
          date: String(row?.date || ""),
          createdAt: row?.createdAt,
          submittedAt: row?.submittedAt,
        }))
        .sort((a: StudentBehaviorRecord, b: StudentBehaviorRecord) => {
          const ta = new Date(a.submittedAt || a.date || a.createdAt || 0).getTime();
          const tb = new Date(b.submittedAt || b.date || b.createdAt || 0).getTime();
          return tb - ta;
        });

      setBehaviorRecords(items);
    } catch (reason: any) {
      setBehaviorError(reason?.message || "Davranış kayıtları yüklenemedi.");
    } finally {
      setBehaviorLoading(false);
    }
  }, [payload?.studentId, payload?.studentNumber]);

  const openBehavior = async () => {
    markModuleSeen("behavior");
    goToView("behavior");
    await loadBehaviorRecords();
  };

  const loadMessages = React.useCallback(async () => {
    if (!token) return;
    setMessagesLoading(true);
    setMessagesError("");

    try {
      // Özel portal mesaj endpoint'ini kullanma:
      // çalışan genel SQLite koleksiyonlarından doğrudan oku.
      const [portalLinksResponse, messagesResponse, receiptsResponse, repliesResponse] =
        await Promise.all([
          fetch("/api/database/collections/publicPortalLinks", {
            cache: "no-store",
          }),
          fetch("/api/database/collections/teacherAppMessages", {
            cache: "no-store",
          }),
          fetch("/api/database/collections/teacherAppMessageReceipts", {
            cache: "no-store",
          }),
          fetch("/api/database/collections/teacherAppMessageReplies", {
            cache: "no-store",
          }),
        ]);

      const portalLinksRows = await portalLinksResponse.json().catch(() => []);
      const messageRows = await messagesResponse.json().catch(() => []);
      const receiptRows = await receiptsResponse.json().catch(() => []);
      const replyRows = await repliesResponse.json().catch(() => []);

      if (!portalLinksResponse.ok) {
        throw new Error("Öğrenci uygulama bilgisi okunamadı.");
      }
      if (!messagesResponse.ok) {
        throw new Error("Mesaj kayıtları okunamadı.");
      }
      if (!receiptsResponse.ok) {
        throw new Error("Mesaj alıcı kayıtları okunamadı.");
      }
      if (!repliesResponse.ok) {
        throw new Error("Gönderilen mesaj kayıtları okunamadı.");
      }

      const portalRow = (Array.isArray(portalLinksRows) ? portalLinksRows : []).find(
        (item: any) =>
          String(item?.recoverableToken || "") === token &&
          String(item?.kind || "") === kind &&
          !item?.revokedAt,
      );

      if (!portalRow) {
        throw new Error("Öğrenci uygulama bağlantısı bulunamadı.");
      }

      const studentId = String(portalRow?.studentId || "").trim();
      if (!studentId) {
        throw new Error("Öğrenci kimliği bulunamadı.");
      }

      const portalStudentNumber = String(portalRow?.studentNumber || payload?.studentNumber || "").trim();
      const matchingReceipts = (Array.isArray(receiptRows) ? receiptRows : [])
        .filter((receipt: any) => {
          const sameStudentId =
            studentId &&
            String(receipt?.studentId || "").trim() === studentId;
          const sameStudentNumber =
            portalStudentNumber &&
            String(receipt?.studentNumber || "").trim() === portalStudentNumber;
          return (sameStudentId || sameStudentNumber) &&
            String(receipt?.recipientType || "parent") === kind;
        });

      const messageById = new Map(
        (Array.isArray(messageRows) ? messageRows : []).map((message: any) => [
          String(message?.id || ""),
          message,
        ]),
      );

      const items: PortalMessage[] = matchingReceipts
        .map((receipt: any) => {
          const message: any = messageById.get(String(receipt?.messageId || ""));
          if (!message) return null;

          return {
            id: String(message.id || ""),
            receiptId: String(receipt.id || ""),
            title: String(message.title || "Bilgilendirme"),
            body: String(message.body || ""),
            teacherName: String(message.teacherName || "Öğretmen"),
            teacherId: String(message.teacherId || ""),
            createdAt: String(message.createdAt || receipt.sentAt || ""),
            sentAt: String(receipt.sentAt || message.createdAt || ""),
            openedAt: receipt.openedAt || null,
            lastOpenedAt: receipt.lastOpenedAt || null,
            recipientType: kind,
            attachment: message?.attachment?.id
              ? {
                  id: String(message.attachment.id || ""),
                  name: String(message.attachment.name || "Dosya"),
                  mimeType: String(message.attachment.mimeType || "application/octet-stream"),
                  size: Number(message.attachment.size || 0),
                }
              : null,
          } as PortalMessage;
        })
        .filter(Boolean)
        .sort((a: PortalMessage, b: PortalMessage) =>
          String(b.sentAt || b.createdAt || "").localeCompare(
            String(a.sentAt || a.createdAt || ""),
          ),
        );

      setMessages(items);

      const sentItems: PortalSentMessage[] = (Array.isArray(replyRows) ? replyRows : [])
        .filter((reply: any) => {
          const sameStudentId =
            studentId &&
            String(reply?.studentId || reply?.senderStudentId || "").trim() === studentId;
          const sameStudentNumber =
            portalStudentNumber &&
            String(reply?.studentNumber || "").trim() === portalStudentNumber;
          return (sameStudentId || sameStudentNumber) &&
            String(reply?.senderType || "") === kind;
        })
        .map((reply: any) => ({
          id: String(reply?.id || ""),
          messageId: String(reply?.messageId || ""),
          recipientTeacherId: String(reply?.recipientTeacherId || ""),
          senderType: kind,
          senderName: String(reply?.senderName || payload?.studentName || ""),
          body: String(reply?.body || reply?.message || ""),
          createdAt: String(reply?.createdAt || ""),
          openedAt: reply?.openedAt || null,
        }))
        .filter((reply: PortalSentMessage) => reply.id && reply.body)
        .sort((a: PortalSentMessage, b: PortalSentMessage) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
        );

      setPortalSentMessages(sentItems);
    } catch (reason: any) {
      setMessagesError(reason?.message || "Mesajlar yüklenemedi.");
    } finally {
      setMessagesLoading(false);
    }
  }, [token, kind, payload?.studentNumber]);

  const openMessages = async () => {
    markModuleSeen("messages");
    setPortalMessageTab("inbox");
    setSelectedMessageId("");
    setPortalReplyBody("");
    goToView("messages");
    await loadMessages();
  };

  const openMessage = async (message: PortalMessage) => {
    setSelectedMessageId(message.id);

    const now = new Date().toISOString();

    try {
      const response = await fetch(
        `/api/database/collections/teacherAppMessageReceipts/${encodeURIComponent(
          message.receiptId,
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: message.receiptId,
            messageId: message.id,
            studentId: String(payload?.studentId || ""),
            studentName: String(payload?.studentName || ""),
            studentNumber: String(payload?.studentNumber || ""),
            classroom: String(payload?.classroom || ""),
            recipientType: kind,
            openedAt: message.openedAt || now,
            lastOpenedAt: now,
            openCount: 1,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Mesaj okundu bilgisi kaydedilemedi.");
      }

      setMessages((current) =>
        current.map((item) =>
          item.receiptId === message.receiptId
            ? {
                ...item,
                openedAt: item.openedAt || now,
                lastOpenedAt: now,
              }
            : item,
        ),
      );
      if (!message.openedAt) {
        setNotificationCounts((current) => ({
          ...current,
          messages: Math.max(0, Number(current.messages || 0) - 1),
        }));
      }
    } catch {
      // Mesaj içeriği yine gösterilir; yalnız okundu bilgisi kaydı başarısız olabilir.
    }
  };

  const sendPortalReply = async (message: PortalMessage) => {
    const body = portalReplyBody.trim();
    if (!body || !message.teacherId || message.teacherId === "desktop-app") return;

    setPortalReplyBusy(true);
    setMessagesError("");
    try {
      const id = `portal-reply-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date().toISOString();
      const senderName =
        kind === "parent"
          ? `${String(payload?.studentName || "Öğrenci").trim()} Velisi`
          : String(payload?.studentName || "Öğrenci").trim();

      const reply = {
        id,
        messageId: message.id,
        recipientTeacherId: message.teacherId,
        senderType: kind,
        senderName,
        studentId: String(payload?.studentId || ""),
        studentNumber: String(payload?.studentNumber || ""),
        classroom: String(payload?.classroom || ""),
        body,
        createdAt: now,
        openedAt: null,
      };

      const response = await fetch(
        `/api/database/collections/teacherAppMessageReplies/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reply),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "Yanıt gönderilemedi.");
      }

      setPortalSentMessages((current) => [reply as PortalSentMessage, ...current]);
      setPortalReplyBody("");
      setPortalMessageTab("sent");
    } catch (reason: any) {
      setMessagesError(reason?.message || "Yanıt gönderilemedi.");
    } finally {
      setPortalReplyBusy(false);
    }
  };

  const handlePortalMessageSwipeStart = (event: React.TouchEvent) => {
    portalMessageSwipeStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handlePortalMessageSwipeEnd = (event: React.TouchEvent) => {
    const startX = portalMessageSwipeStartX.current;
    portalMessageSwipeStartX.current = null;
    if (startX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 55) return;
    if (delta < 0) setPortalMessageTab("inbox");
    else setPortalMessageTab("sent");
    setSelectedMessageId("");
  };

  const openParentConsents = async () => {
    if (kind !== "parent") return;
    goToView("consents");
    setConsentsLoading(true);
    setConsentsError("");
    try {
      const data = await requestJson<{ items: ParentConsent[] }>(
        `/api/public-portal/${encodeURIComponent(token)}/parent-consents`,
        7000,
      );
      setParentConsents(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      setConsentsError(error?.message || "Veli onay belgeleri alınamadı.");
    } finally {
      setConsentsLoading(false);
    }
  };

  const respondParentConsent = async (item: ParentConsent, decision: "approved" | "rejected") => {
    const label = decision === "approved" ? "ONAYLAMAK" : "REDDETMEK";
    if (!window.confirm(`${item.title} belgesini ${label} istediğinize emin misiniz? Bu karar kaydedildikten sonra değiştirilemez.`)) return;
    setConsentsLoading(true);
    setConsentsError("");
    try {
      await requestJson(
        `/api/public-portal/${encodeURIComponent(token)}/parent-consents/${encodeURIComponent(item.id)}/respond`,
        7000,
        { method: "POST", body: JSON.stringify({ decision, parentDisplayName: "Veli" }) },
      );
      await openParentConsents();
    } catch (error: any) {
      setConsentsError(error?.message || "Veli kararı kaydedilemedi.");
      setConsentsLoading(false);
    }
  };

  const loadAnnouncements = React.useCallback(async () => {
    if ((kind !== "student" && kind !== "parent") || !payload?.studentId) return;
    setAnnouncementsLoading(true);
    setAnnouncementsError("");
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
      const mobileSchoolId = String(payload?.schoolId || "school-main").trim() || "school-main";
      const safePublishedNews = async () => {
        try {
          const response = await fetch(`/api/mobile/news/published?schoolId=${encodeURIComponent(mobileSchoolId)}`, { cache: "no-store" });
          if (!response.ok) return [] as any[];
          const newsPayload = await response.json().catch(() => ({}));
          return Array.isArray(newsPayload?.items) ? newsPayload.items : [];
        } catch { return [] as any[]; }
      };
      const [examRows, generalRows, latestNewsRows] = await Promise.all([
        safeCollection("studentAppAnnouncements"),
        safeCollection("announcements"),
        safePublishedNews(),
      ]);
      const studentId = String(payload.studentId || "").trim();
      const studentNumber = String(payload.studentNumber || "").trim();
      const now = Date.now();
      const items: PortalAnnouncement[] = examRows
        .filter((row: any) => {
          if (String(row?.source || "") !== "exam-seating") return false;
          const matchesStudent = String(row?.recipientStudentId || "").trim() === studentId ||
            (!!studentNumber && String(row?.recipientStudentNumber || "").trim() === studentNumber);
          if (!matchesStudent) return false;
          const expires = row?.expiresAt ? new Date(row.expiresAt).getTime() : Number.POSITIVE_INFINITY;
          return !Number.isFinite(expires) || expires > now;
        })
        .map((row: any) => ({
          id: String(row?.id || ""),
          title: String(row?.title || "SINAV BİLGİSİ"),
          content: String(row?.content || ""),
          date: String(row?.date || row?.examDate || ""),
          examDate: String(row?.examDate || row?.date || ""),
          examTime: String(row?.examTime || ""),
          courseName: String(row?.courseName || row?.examName || "Sınav"),
          buildingName: String(row?.buildingName || ""),
          floorName: String(row?.floorName || ""),
          roomName: String(row?.roomName || ""),
          seatNumber: String(row?.seatNumber ?? ""),
          supervisorName: String(row?.supervisorName || ""),
          createdAt: String(row?.createdAt || ""),
          expiresAt: String(row?.expiresAt || ""),
        }))
        .sort((a, b) => String(a.examDate + a.examTime).localeCompare(String(b.examDate + b.examTime)));

      const normalizeFeed = (rows: any[], prefix: string): PortalMobileFeedItem[] => rows
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
      const latestNewsItems: PortalMobileFeedItem[] = latestNewsRows
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
        .filter((item: PortalMobileFeedItem) => item.title && item.url)
        .sort((a: PortalMobileFeedItem, b: PortalMobileFeedItem) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
      setAnnouncements(items);
      setGeneralAnnouncements(normalizeFeed(generalRows, "announcement"));
      setNewsItems(latestNewsItems);
    } catch (reason: any) {
      setAnnouncementsError(reason?.message || "Duyurular yüklenemedi.");
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [kind, payload?.studentId, payload?.studentNumber]);

  // Öğrencinin kendi sınavlarına ait hatırlatmalar, açılıştan itibaren 48 saatlik pencerede görünür.
  React.useEffect(() => {
    if (!payload?.studentId || openingReminderLoaded.current) return;
    openingReminderLoaded.current = true;
    let active = true;
    const getRows = async (url: string, field = "reminders") => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return [] as any[];
        const json = await response.json();
        return Array.isArray(json) ? json : Array.isArray(json?.[field]) ? json[field] : [];
      } catch { return [] as any[]; }
    };
    const eventTime = (date: unknown, time: unknown): string => {
      const raw = String(date || "").trim();
      if (/T\\d{2}:\\d{2}/.test(raw)) return raw;
      return localExamTimestamp(raw, time) || ( /^\\d{4}-\\d{2}-\\d{2}/.test(raw) ? raw.slice(0, 10) + "T00:00" : "" );
    };
    const momentLabel = (date: unknown, time: unknown): string => {
      const raw = eventTime(date, time);
      const ms = Date.parse(/(?:Z|[+-]\\d{2}:?\\d{2})$/.test(raw) ? raw : raw + ":00+03:00");
      const day = Number.isFinite(ms) ? new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
      }).format(ms) : String(date || "").slice(0, 10);
      const clock = String(time || "").trim() || (/T(\\d{2}:\\d{2})/.exec(raw)?.[1] || "");
      return day + (clock ? " · Saat " + clock.slice(0, 5) : " · Saat belirtilmedi");
    };
    const load = async () => {
      // Bu ekranın verileri yalnızca öğrencinin kendi bağlantısıyla sorgulanır.
      const [seating, trialClub, manual] = await Promise.all([
        getRows("/api/database/collections/studentAppAnnouncements", "reminders"),
        kind === "student" ? getRows(`/api/public-portal/${encodeURIComponent(token)}/trial-club`, "exams") : Promise.resolve([] as any[]),
        getRows(`/api/public-portal/${encodeURIComponent(token)}/reminder-information`),
      ]);
      if (!active) return;
      const sid = String(payload.studentId || "").trim();
      const snum = String(payload.studentNumber || "").trim();
      const schoolId = String(payload.schoolId || "school-main");
      const placement = seating.filter((row: any) => {
        if (row?.source !== "exam-seating") return false;
        if (row?.schoolId && String(row.schoolId) !== schoolId) return false;
        const belongs = (sid && String(row?.recipientStudentId || "").trim() === sid) ||
          (snum && String(row?.recipientStudentNumber || "").trim() === snum);
        return belongs && inNext48Hours(eventTime(row.examDate || row.date, row.examTime || row.startTime));
      }).map((row: any) => ({
        id: "seating:" + String(row.id),
        title: "Ortak sınav: " + String(row.courseName || row.subjectName || row.lessonName || row.examName || row.title || "Sınav"),
        detail: [
          momentLabel(row.examDate || row.date, row.examTime || row.startTime),
          row.buildingName ? "Bina: " + row.buildingName : "",
          row.roomName || row.classroomName ? "Sınıf/Salon: " + String(row.roomName || row.classroomName) : "",
          row.seatNumber != null && row.seatNumber !== "" ? "Sıra No: " + row.seatNumber : "",
          "Modül: Ortak Sınavlar",
        ].filter(Boolean).join(" · "),
      }));
      const trialItems = trialClub.filter((exam: any) =>
        exam && exam.electronic === true && exam.submitted !== true &&
        inNext48Hours(exam.startsAt)
      ).map((exam: any) => {
        const start = Number(exam.startsAt);
        const duration = Number(exam.durationMinutes);
        const date = Number.isFinite(start) && start > 0 ? new Date(start).toISOString() : exam.examDate;
        return {
          id: "trial-club:" + String(exam.id),
          title: "Deneme sınavı: " + String(exam.examName || "Deneme"),
          detail: [
            "Başlangıç: " + momentLabel(date, ""),
            Number.isFinite(duration) && duration > 0 ? "Süre: " + duration + " dakika" : "",
            "Deneme Kulübü → Sınav butonundan elektronik optik formunu doldurun.",
            "Cevaplamayı bitirdiğinizde Kaydet butonuna tıklamayı unutmayın.",
            "Kaydetme işlemi tek seferliktir.",
          ].filter(Boolean).join(" · "),
        };
      });
      const manualItems = manual.map((row: any) => ({
        id: "manual:" + String(row.id), title: String(row.title || "Hatırlatma"),
        detail: [row.body, row.kind].filter(Boolean).join(" · "),
      }));
      const items = [...placement, ...trialItems, ...manualItems];
      setOpeningReminders(items);
      if (items.length) setOpeningReminderVisible(true);
    };
    void load();
    return () => { active = false; };
  }, [payload?.studentId, payload?.studentNumber, payload?.schoolId, kind, token]);

  const openAnnouncements = async () => {
    setAnnouncementTab("announcements");
    setSelectedAnnouncementFeedId("");
    goToView("announcements");
    await loadAnnouncements();
  };

  React.useEffect(() => {
    if (view !== "announcements") return;
    setAnnouncementTab("announcements");
    setSelectedAnnouncementFeedId("");
  }, [view]);

  React.useEffect(() => {
    if ((kind === "student" || kind === "parent") && payload?.studentId) void loadAnnouncements();
  }, [kind, payload?.studentId, loadAnnouncements]);

  React.useEffect(() => {
    if (kind !== "student" && kind !== "parent") return;
    const refreshAnnouncements = () => {
      const now = Date.now();
      setAnnouncements((current) => current.filter((item) => {
        if (!item.expiresAt) return true;
        const expires = new Date(item.expiresAt).getTime();
        return !Number.isFinite(expires) || expires > now;
      }));
      void loadAnnouncements();
    };
    refreshAnnouncements();
    const timer = window.setInterval(refreshAnnouncements, 30000);
    return () => window.clearInterval(timer);
  }, [kind, loadAnnouncements]);

  const selectYearbookTarget = (targetId: string, source?: YearbookPayload | null) => {
    const data = source || yearbook;
    setYearbookTargetId(targetId);
    const existing = data?.myEntries?.find(item => item.targetStudentId === targetId);
    setYearbookComment(existing?.comment || "");
    setYearbookSurveyAnswers(existing?.surveyAnswers && typeof existing.surveyAnswers === "object" ? existing.surveyAnswers : {});
    setYearbookPage(0);
  };

  const openYearbook = async () => {
    if (kind !== "student") return;
    goToView("yearbook");
    setYearbookLoading(true);
    setYearbookError("");
    try {
      const data = await requestJson<YearbookPayload>(`/api/public-portal/${encodeURIComponent(token)}/yearbook`, 7000);
      setYearbook(data);
      const preferred = yearbookTargetId && data.classmates.some(x => x.id === yearbookTargetId) ? yearbookTargetId : (data.classmates[0]?.id || "");
      selectYearbookTarget(preferred, data);
    } catch (error: any) {
      setYearbookError(error?.message || "Yıllık bilgileri alınamadı.");
    } finally { setYearbookLoading(false); }
  };

  const saveYearbookEntry = async () => {
    if (!yearbookTargetId || !yearbook) return;
    if (!yearbook.open) { setYearbookError("Yıllık yönetici tarafından öğrencilere kapatıldı."); return; }
    if (!yearbookComment.trim()) { setYearbookError("Arkadaşınız hakkındaki düşüncenizi yazınız."); setYearbookPage(0); return; }
    if (yearbookComment.trim().length > 200) { setYearbookError("Düşünceniz en fazla 200 karakter olabilir."); setYearbookPage(0); return; }
    if (!yearbook.survey) { setYearbookError("Yıllık anketi yönetici tarafından henüz seçilmedi."); setYearbookPage(1); return; }
    const missingRequired = yearbook.survey.questions.find(q => q.required && (Array.isArray(yearbookSurveyAnswers[q.id]) ? !(yearbookSurveyAnswers[q.id] as string[]).length : !String(yearbookSurveyAnswers[q.id] || "").trim()));
    if (missingRequired) { setYearbookError(`“${missingRequired.text}” sorusunu yanıtlamalısın.`); setYearbookPage(1); return; }
    setYearbookSaving(true); setYearbookError("");
    try {
      await requestJson(`/api/public-portal/${encodeURIComponent(token)}/yearbook/${encodeURIComponent(yearbookTargetId)}`, 7000, {
        method: "PUT", body: JSON.stringify({ comment: yearbookComment.trim(), surveyAnswers: yearbookSurveyAnswers }),
      });
      const data = await requestJson<YearbookPayload>(`/api/public-portal/${encodeURIComponent(token)}/yearbook`, 7000);
      setYearbook(data);
      selectYearbookTarget(yearbookTargetId, data);
    } catch (error: any) { setYearbookError(error?.message || "Yıllık kaydı yapılamadı."); }
    finally { setYearbookSaving(false); }
  };

  const parentButtons = [
    { key: "behavior", label: "Davranış Bilgileri", icon: Heart, tone: "rose", count: notificationCounts.behavior },
    { key: "homework", label: "Ödev Kontrolü", icon: BookOpenCheck, tone: "emerald", count: notificationCounts.homework },
    { key: "exams", label: "Sınav Sonuçları", icon: BarChart3, tone: "cyan", count: notificationCounts.exams },
    { key: "announcements", label: "Haberler ve Duyurular", icon: Bell, tone: "cyan", active: true, count: announcements.length + generalAnnouncements.length },
    { key: "radio", label: "Okul Radyosu", icon: Radio, tone: "rose", count: 0 },
    { key: "trial-club", label: "Deneme Kulübü", icon: Target, tone: "violet", count: 0 },
    { key: "survey", label: "Anket", icon: ClipboardList, tone: "amber", count: 0 },
    { key: "messages", label: "Mesajlar", icon: MessageCircleMore, tone: "violet", active: true, count: notificationCounts.messages },
    { key: "consents", label: "VELİ ONAYI", icon: ClipboardList, tone: "amber", count: parentConsents.filter((item) => item.status === "pending").length },
  ];

  const studentButtons = [
    {
      key: "exams",
      label: "Akademik Analiz",
      icon: BarChart3,
      tone: "cyan",
      count: notificationCounts.exams,
    },
    {
      key: "study",
      label: "Çalışma Planı",
      icon: ClipboardList,
      tone: "amber",
      count: 0,
    },
    {
      key: "behavior",
      label: "Davranış Kaydı",
      icon: Heart,
      tone: "rose",
      count: notificationCounts.behavior,
    },
    {
      key: "homework",
      label: "Ödev Kontrolü",
      icon: BookOpenCheck,
      tone: "emerald",
      count: notificationCounts.homework,
    },
    {
      key: "radio",
      label: "Okul Radyosu",
      icon: Radio,
      tone: "rose",
      count: 0,
    },
    {
      key: "trial-club",
      label: "Deneme Kulübü",
      icon: Target,
      tone: "violet",
      count: 0,
    },
    {
      key: "survey",
      label: "Anket",
      icon: ClipboardList,
      tone: "amber",
      count: 0,
    },
    {
      key: "schedule",
      label: "Haftalık Ders Programı",
      icon: CalendarDays,
      tone: "indigo",
      count: 0,
    },
    {
      key: "announcements",
      label: "Haberler ve Duyurular",
      icon: Bell,
      tone: "cyan",
      active: true,
      count: announcements.length + generalAnnouncements.length,
    },
    {
      key: "messages",
      label: "Mesajlar",
      icon: MessageCircleMore,
      tone: "violet",
      active: true,
      count: notificationCounts.messages,
    },
    {
      key: "yearbook",
      label: "Yıllık",
      icon: PartyPopper,
      tone: "amber",
      count: 0,
    },
    {
      key: "resources",
      label: "Kaynak Merkezi",
      icon: BookOpen,
      tone: "indigo",
      count: 0,
      future: true,
    },
    {
      key: "targets",
      label: "Hedef Takibi",
      icon: Target,
      tone: "emerald",
      count: 0,
      future: true,
    },
  ];

  const buttons = kind === "parent" ? parentButtons : studentButtons;

  const toneMap: Record<string, string> = {
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    cyan: "border-cyan-300 bg-cyan-50 text-cyan-700",
    violet: "border-violet-300 bg-violet-50 text-violet-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
  };
  if (view === "yearbook" && kind === "student") {
    const selectedFriend = yearbook?.classmates.find(item => item.id === yearbookTargetId) || null;
    const savedIds = new Set((yearbook?.myEntries || []).map(item => item.targetStudentId));
    return (
      <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-fuchsia-50 p-3 text-slate-800">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-violet-200 bg-white shadow-xl">
          <header className="bg-gradient-to-br from-violet-700 via-fuchsia-700 to-purple-700 px-4 py-5 text-white">
            <button type="button" onClick={() => goBackView()} className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15" aria-label="Ana ekrana dön"><ArrowLeft className="h-5 w-5" /></button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">e-Nstitü</span>
            <h1 className="mt-1 text-2xl font-black">Yıllık</h1>
            <p className="mt-1 text-xs font-semibold text-violet-100">Sınıf arkadaşını seç, düşünceni yaz ve onu anlatan özellikleri işaretle.</p>
          </header>
          <div className="space-y-4 p-4">
            {yearbookError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{yearbookError}</div> : null}
            {yearbookLoading && !yearbook ? <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin"/>Yıllık hazırlanıyor…</div> : null}
            {yearbook ? <>
              <div className={`rounded-2xl border p-3 text-xs font-black ${yearbook.open ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{yearbook.open ? "Yıllık açık. Yazdıklarını yönetici sistemi kapatana kadar istediğin zaman değiştirebilirsin." : "Yıllık yönetici tarafından kapatıldı. Kayıtların artık değiştirilemez."}</div>
              <section><h2 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Sınıf arkadaşını seç</h2><div className="grid grid-cols-2 gap-2">{yearbook.classmates.map(friend => <button type="button" key={friend.id} onClick={() => selectYearbookTarget(friend.id)} className={`rounded-2xl border p-3 text-left transition ${friend.id === yearbookTargetId ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 bg-white"}`}><span className="block text-[9px] font-black text-slate-400">{friend.number ? `NO ${friend.number}` : "SINIF ARKADAŞI"}</span><strong className="mt-1 block text-xs font-black text-slate-900">{friend.name}</strong>{savedIds.has(friend.id) ? <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-700">KAYDEDİLDİ</span> : <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black text-amber-700">BEKLİYOR</span>}</button>)}</div></section>
              {selectedFriend ? <section className="overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50">
                <div className="border-b border-violet-100 bg-white/80 px-4 py-3">
                  <span className="text-[9px] font-black uppercase text-violet-500">Yıllık görüşü</span>
                  <div className="mt-1 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{selectedFriend.name}</h2><p className="text-xs font-bold text-slate-500">{selectedFriend.number ? `Okul No: ${selectedFriend.number}` : ""}</p></div><div className="flex gap-1"><span className={`h-2 w-6 rounded-full ${yearbookPage === 0 ? "bg-violet-600" : "bg-violet-200"}`}/><span className={`h-2 w-6 rounded-full ${yearbookPage === 1 ? "bg-violet-600" : "bg-violet-200"}`}/></div></div>
                </div>
                <div className="overflow-hidden" onTouchStart={e => { yearbookTouchStartX.current = e.touches[0]?.clientX ?? null; }} onTouchEnd={e => { const start = yearbookTouchStartX.current; const end = e.changedTouches[0]?.clientX ?? null; yearbookTouchStartX.current = null; if (start == null || end == null) return; const delta = end - start; if (delta < -50 && yearbookPage === 0) { if (!yearbookComment.trim()) { setYearbookError("Önce arkadaşın hakkındaki düşünceni yazmalısın."); return; } setYearbookError(""); setYearbookPage(1); } else if (delta > 50 && yearbookPage === 1) { setYearbookPage(0); } }}>
                  <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${yearbookPage * 100}%)` }}>
                    <div className="w-full shrink-0 p-4">
                      <div className={`mb-3 rounded-2xl border p-3 text-xs font-bold ${yearbook.open ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{yearbook.open ? "Yönetici Yıllık'ı açtı. Arkadaşın için en fazla 200 karakterlik düşünceni yazabilirsin." : "Yıllık şu anda yönetici tarafından kapalı. Düşünce yazma ve değiştirme işlemleri kapalıdır."}</div>
                      <label className="text-xs font-black text-slate-600">Arkadaşın hakkında ne düşünüyorsun?
                        <textarea value={yearbookComment} maxLength={200} disabled={!yearbook.open} onChange={e => setYearbookComment(e.target.value.slice(0, 200))} rows={6} placeholder="Arkadaşın hakkında yıllıkta kalmasını istediğin düşünceni yaz…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium leading-6 outline-none focus:border-violet-400 disabled:bg-slate-100"/>
                      </label>
                      <div className="mt-2 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400">En fazla 200 karakter</span><span className={`text-xs font-black ${yearbookComment.length >= 190 ? "text-rose-600" : "text-violet-700"}`}>{yearbookComment.length}/200</span></div>
                      <button type="button" disabled={!yearbook.open || !yearbookComment.trim()} onClick={() => { if (!yearbookComment.trim()) return; setYearbookError(""); setYearbookPage(1); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">Ankete geç <ChevronRight className="h-4 w-4"/></button>
                      <p className="mt-3 text-center text-[10px] font-black uppercase tracking-wide text-violet-500">Sola kaydırarak da ankete geçebilirsin ←</p>
                    </div>
                    <div className="w-full shrink-0 p-4">
                      <button type="button" onClick={() => setYearbookPage(0)} className="mb-3 inline-flex items-center gap-1 text-xs font-black text-violet-700"><ArrowLeft className="h-4 w-4"/> Düşünceye dön</button>
                      <h3 className="text-sm font-black text-slate-800">{yearbook.survey?.title || "Yıllık anketi"}</h3>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">{yearbook.survey?.description || `${selectedFriend.name} hakkındaki anketi doldur.`}</p>
                      {!yearbook.survey ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">Yönetici Anket Panelinden Yıllıkta kullanılacak anketi henüz seçmedi.</div> : <div className="mt-4 space-y-4">{yearbook.survey.questions.map((q, index) => {
                        const value = yearbookSurveyAnswers[q.id];
                        const setValue = (next: string | string[]) => setYearbookSurveyAnswers(current => ({ ...current, [q.id]: next }));
                        return <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="text-xs font-black text-slate-800"><span className="mr-1 text-violet-600">{index + 1}.</span>{q.text}{q.required ? <span className="ml-1 text-rose-500">*</span> : null}</div>
                          {q.answerType === "multiple" ? <div className="mt-3 space-y-2">{q.options.map(option => { const values = Array.isArray(value) ? value : []; const checked = values.includes(option); return <label key={option} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold text-slate-700"><input type="checkbox" disabled={!yearbook.open} checked={checked} onChange={() => setValue(checked ? values.filter(x => x !== option) : [...values, option])} className="h-4 w-4 accent-violet-700"/>{option}</label>; })}</div>
                          : q.answerType === "choice" ? <div className="mt-3 space-y-2">{q.options.map(option => <label key={option} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold text-slate-700"><input type="radio" name={`yearbook-${selectedFriend.id}-${q.id}`} disabled={!yearbook.open} checked={String(value || "") === option} onChange={() => setValue(option)} className="h-4 w-4 accent-violet-700"/>{option}</label>)}</div>
                          : q.answerType === "dropdown" ? <select disabled={!yearbook.open} value={String(value || "")} onChange={e => setValue(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold"><option value="">Seçiniz</option>{q.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
                          : q.answerType === "paragraph" ? <textarea disabled={!yearbook.open} value={String(value || "")} onChange={e => setValue(e.target.value)} rows={4} className="mt-3 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs" placeholder="Yanıtını yaz…"/>
                          : <input disabled={!yearbook.open} type={q.answerType === "number" ? "number" : q.answerType === "phone" ? "tel" : "text"} value={String(value || "")} onChange={e => setValue(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-xs" placeholder="Yanıtını yaz…"/>}
                        </div>;
                      })}</div>}
                      <button type="button" disabled={!yearbook.open || yearbookSaving || !yearbookComment.trim() || !yearbook.survey} onClick={() => void saveYearbookEntry()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 disabled:bg-slate-300">{yearbookSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <ClipboardList className="h-5 w-5"/>}{savedIds.has(selectedFriend.id) ? "Değişiklikleri Kaydet" : "Yıllığa Kaydet"}</button>
                    </div>
                  </div>
                </div>
              </section> : null}
            </> : null}
          </div>
        </div>
      </main>
    );
  }

  if (view === "consents" && kind === "parent") {
    const selectedConsent = parentConsents.find((item) => item.id === selectedConsentId) || null;
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-slate-50 to-white p-3 text-slate-800">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-amber-200 bg-white shadow-xl">
          <header className="bg-gradient-to-br from-amber-600 via-orange-500 to-orange-600 px-4 py-5 text-white">
            <button type="button" onClick={() => { goBackView(); setSelectedConsentId(""); }} className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15" aria-label="Ana ekrana dön">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">e-Nstitü</span>
            <h1 className="mt-1 text-xl font-black">Veli Onay Bilgisi</h1>
            <p className="mt-1 text-xs font-semibold text-amber-100">{payload?.studentName || "Öğrenci"}</p>
          </header>
          <section className="p-4">
            {consentsError ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{consentsError}</div> : null}
            {consentsLoading && parentConsents.length === 0 ? <div className="p-8 text-center text-xs font-bold text-slate-400">Onay belgeleri yükleniyor…</div> : selectedConsent ? (
              <div>
                <button onClick={() => setSelectedConsentId("")} className="mb-4 text-xs font-black text-orange-700">← Belge listesine dön</button>
                <article className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-orange-600">Veli Onay Belgesi</p><h2 className="mt-1 text-xl font-black text-slate-900">{selectedConsent.title}</h2></div>
                    <span className={`rounded-full px-3 py-1 text-[9px] font-black ${selectedConsent.status==="approved"?"bg-emerald-100 text-emerald-700":selectedConsent.status==="rejected"?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>{selectedConsent.status==="approved"?"ONAYLANDI":selectedConsent.status==="rejected"?"REDDEDİLDİ":"ONAY BEKLİYOR"}</span>
                  </div>
                  <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-medium leading-7 text-slate-700 whitespace-pre-wrap">{selectedConsent.description}</div>
                  {selectedConsent.eventDate ? <p className="mt-4 text-xs font-bold text-slate-600">Etkinlik tarihi: {formatDate(selectedConsent.eventDate)}</p> : null}
                  <div className="mt-6 border-t border-amber-200 pt-4 text-right"><strong className="block text-sm font-black">{selectedConsent.principalName}</strong><span className="text-xs font-bold text-slate-500">Okul Müdürü</span></div>
                </article>
                {selectedConsent.status === "pending" ? <div className="mt-4 grid grid-cols-2 gap-3">
                  <button disabled={consentsLoading} onClick={() => void respondParentConsent(selectedConsent,"rejected")} className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-3 py-4 text-sm font-black text-rose-700">Onaylamıyorum</button>
                  <button disabled={consentsLoading} onClick={() => void respondParentConsent(selectedConsent,"approved")} className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-4 text-sm font-black text-emerald-700">Onaylıyorum</button>
                </div> : <div className={`mt-4 rounded-2xl p-4 text-center text-sm font-black ${selectedConsent.status==="approved"?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>Kararınız {formatDate(selectedConsent.respondedAt || "")} tarihinde kaydedildi.</div>}
              </div>
            ) : parentConsents.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-black text-slate-500">Bekleyen veya geçmiş veli onay belgesi bulunmuyor.</div> : (
              <div className="space-y-3">{parentConsents.map((item) => <button key={item.id} onClick={() => setSelectedConsentId(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${item.status==="approved"?"border-emerald-300 bg-emerald-50":item.status==="rejected"?"border-rose-300 bg-rose-50":"border-amber-300 bg-amber-50"}`}>
                {item.status==="approved"?<Award className="h-6 w-6 text-emerald-700"/>:<Clock3 className="h-6 w-6 text-amber-700"/>}<span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black">{item.title}</strong><small className="mt-1 block text-[10px] font-bold text-slate-500">{item.status==="approved"?"Onaylandı":item.status==="rejected"?"Reddedildi":"Onayınız bekleniyor"}</small></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div>
            )}
          </section>
        </div>
      </main>
    );
  }

  if (view === "behavior") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-slate-50 to-white p-3 text-slate-800">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-rose-100 bg-white shadow-xl">
          <header className="bg-gradient-to-br from-rose-700 via-rose-600 to-orange-500 px-4 py-5 text-white">
            <button
              type="button"
              onClick={() => goBackView()}
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"
              aria-label="Ana ekrana dön"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100">
              e-Nstitü
            </span>
            <h1 className="mt-1 text-xl font-black">Davranış Kaydı</h1>
            <p className="mt-1 text-xs font-semibold text-rose-100">
              {payload?.studentName || "Öğrenci"}
            </p>
          </header>

          <section className="p-4">
            {behaviorError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {behaviorError}
              </div>
            ) : null}

            {behaviorLoading ? (
              <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                Davranış kayıtları yükleniyor…
              </div>
            ) : behaviorRecords.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                <Heart className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-600">
                  Henüz davranış kaydı bulunmuyor.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {behaviorRecords.map((record) => {
                  const negative =
                    String(record.behaviorType || "").toLocaleLowerCase("tr-TR") ===
                    "olumsuz";
                  const eventValue =
                    record.submittedAt || record.date || String(record.createdAt || "");

                  return (
                    <article
                      key={record.id}
                      className={`rounded-2xl border p-4 ${
                        negative
                          ? "border-red-200 bg-red-50/70"
                          : "border-emerald-300 bg-emerald-50/60"
                      }`}
                    >
                      <strong
                        className={`block text-sm font-black leading-5 ${
                          negative ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {record.behaviorName}
                      </strong>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
                        <div className="rounded-xl bg-white/80 p-2.5">
                          <span className="block text-[8px] font-black uppercase tracking-wide text-slate-400">
                            Kaydeden
                          </span>
                          <span className="mt-1 block text-slate-700">
                            {record.teacherName || "Öğretmen"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white/80 p-2.5">
                          <span className="block text-[8px] font-black uppercase tracking-wide text-slate-400">
                            Tarih
                          </span>
                          <span className="mt-1 block text-slate-700">
                            {formatDate(eventValue)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }


  if (view === "schedule") {
    const days = studentSchedule?.days || [];
    const visibleDay = days[scheduleDayIndex];

    const syncVisibleDay = () => {
      const scroller = scheduleScrollerRef.current;
      if (!scroller || !days.length || scroller.clientWidth <= 0) return;
      const index = Math.max(
        0,
        Math.min(
          days.length - 1,
          Math.round(scroller.scrollLeft / scroller.clientWidth),
        ),
      );
      setScheduleDayIndex(index);
    };

    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-50 text-slate-800">
        <div className="mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white">
          <header className="shrink-0 bg-gradient-to-r from-indigo-900 via-sky-800 to-emerald-700 px-3 py-3 text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => goBackView()}
                className="flex h-9 w-9 shrink-0 items-center justify-center bg-white/15 ring-1 ring-white/15"
                aria-label="Geri"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-black">
                  Haftalık Ders Programı
                </h1>
                <p className="mt-0.5 truncate text-[10px] text-sky-100">
                  {payload?.studentName || "Öğrenci"}
                  {payload?.studentNumber
                    ? ` · No ${payload.studentNumber}`
                    : ""}
                  {studentSchedule
                    ? ` · ${visibleDay?.day || studentSchedule.now.day} ${studentSchedule.now.time}`
                    : ""}
                </p>
              </div>

              <CalendarDays className="h-5 w-5 text-sky-100" />
            </div>
          </header>

          {scheduleError ? (
            <div className="mx-3 mt-2 shrink-0 border border-rose-200 bg-rose-50 p-2 text-[10px] font-bold text-rose-700">
              {scheduleError}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            {scheduleLoading ? (
              <div className="mx-3 mt-2 flex shrink-0 items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[9px] font-bold text-sky-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Ders atamaları kontrol ediliyor…
              </div>
            ) : null}
              <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2">
                <div>
                  <h2 className="text-sm font-black text-red-600">
                    {visibleDay?.day || studentSchedule.now.day}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400">
                    Sağa veya sola kaydırarak gün değiştirin
                  </p>
                </div>
                <span className="text-[9px] font-bold text-slate-500">
                  Ders · Öğretmen
                </span>
              </div>

              <div
                ref={scheduleScrollerRef}
                onScroll={syncVisibleDay}
                className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-none"
                style={{
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {days.map((item) => (
                  <section
                    key={item.day}
                    className="flex h-full w-full shrink-0 snap-center snap-always flex-col bg-white px-3 pb-3"
                  >
                    <div className="grid min-h-0 flex-1 grid-rows-8 gap-1.5">
                      {item.slots.slice(0, 8).map((slot) => {
                        const active =
                          studentSchedule.now.day === item.day &&
                          (() => {
                            const now = studentSchedule.now.time;
                            return (
                              String(now) >= String(slot.start) &&
                              String(now) <= String(slot.end)
                            );
                          })();

                        return (
                          <div
                            key={`${item.day}-${slot.hour}`}
                            className={`relative grid min-h-0 w-full grid-cols-[58px_minmax(0,1fr)] items-center gap-2 border px-2.5 py-1 ${
                              slot.assignment
                                ? active
                                  ? "border-emerald-500 bg-yellow-200 text-slate-900 ring-1 ring-emerald-500"
                                  : "border-yellow-300 bg-yellow-100 text-slate-900"
                                : "border-slate-300 bg-slate-200 text-slate-600"
                            }`}
                          >
                            <div className="min-w-0">
                              <span
                                className={`block text-[10px] font-black ${
                                  active
                                    ? "text-emerald-800"
                                    : "text-slate-600"
                                }`}
                              >
                                {slot.hour}. DERS
                              </span>
                              <span className="mt-0.5 block text-[9px] font-bold leading-3 text-slate-500">
                                {slot.start}
                              </span>
                              <span className="block text-[9px] font-bold leading-3 text-slate-500">
                                {slot.end}
                              </span>
                            </div>

                            <div className="min-w-0">
                              {slot.assignment ? (
                                <>
                                  <strong className="block truncate text-[12px] font-black leading-4">
                                    {slot.assignment.courseName || "Ders"}
                                  </strong>
                                  <span
                                    className={`mt-0.5 block truncate text-[10px] font-bold ${
                                      active
                                        ? "text-emerald-800"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {slot.assignment.teacherName ||
                                      "Öğretmen bilgisi yok"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <strong className="block text-[11px] font-black text-slate-500">
                                    Ders atanmamış
                                  </strong>
                                  <span className="mt-0.5 block text-[9px] font-bold text-slate-400">
                                    —
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="flex shrink-0 justify-center gap-1.5 pb-2">
                {days.map((item, index) => (
                  <span
                    key={item.day}
                    className={`h-1.5 rounded-full transition-all ${
                      index === scheduleDayIndex
                        ? "w-5 bg-indigo-700"
                        : "w-1.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
        </div>
      </main>
    );
  }

  if (view === "homework" || view === "study") {
    const titles = {
      homework: "Ödev Kontrolü",
      study: "Çalışma Planı",
    } as const;
    const title = titles[view];

    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 via-slate-50 to-white p-3 text-slate-800">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-orange-300 bg-white shadow-xl">
          <header className="bg-gradient-to-br from-[#9a3412] via-[#ea580c] to-[#f59e0b] px-4 py-5 text-white">
            <button
              type="button"
              onClick={() => goBackView()}
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-black">{title}</h1>
            <p className="mt-1 text-xs font-semibold text-orange-100">
              {payload?.studentName || "Öğrenci"}
            </p>
          </header>
          <section className="p-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">{title}</p>
              <p className="mt-2 text-[10px] font-bold leading-5 text-slate-400">
                Modül aktif. İçerik bağlantısı bir sonraki düzenlemede doldurulacak.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }


  if (view === "exams") {
    const selectedExam =
      studentExams.find(
        (exam) => exam.id === selectedStudentExamId,
      ) || null;

    const rankValue = (value: number) =>
      Number(value || 0) > 0 ? `${Number(value)}.` : "—";

    const compactHeaderClass =
      "flex h-16 shrink-0 items-center gap-3 bg-gradient-to-br from-cyan-800 via-sky-700 to-indigo-700 px-4 text-white";

    const trendSubjects = Array.from(
      new Set<string>(
        studentExams.flatMap((exam) =>
          exam.subjects.map((subject) => subject.subjectName).filter(Boolean),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b, "tr"));

    const trendRows = selectedTrendSubject
      ? studentExams
          .map((exam) => {
            const subject = exam.subjects.find(
              (item) => item.subjectName === selectedTrendSubject,
            );
            if (!subject) return null;
            const questionCount = Number(subject.questionCount || 0);
            const studentSuccess = Number(
              subject.studentSuccess ??
                (questionCount > 0
                  ? (Number(subject.correct || 0) / questionCount) * 100
                  : 0),
            );
            return {
              examId: exam.id,
              examName: exam.examName,
              examDate: exam.examDate,
              questionCount,
              net: Number(subject.net || 0),
              studentSuccess: Math.max(0, Math.min(100, studentSuccess)),
              schoolSuccess: Math.max(
                0,
                Math.min(100, Number(subject.schoolSuccess ?? studentSuccess)),
              ),
              generalSuccess:
                subject.hasGeneralComparison &&
                subject.generalSuccess !== null &&
                subject.generalSuccess !== undefined
                  ? Math.max(
                      0,
                      Math.min(100, Number(subject.generalSuccess || 0)),
                    )
                  : null,
              hasGeneralComparison: Boolean(subject.hasGeneralComparison),
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => {
            const left = new Date(a.examDate || 0).getTime();
            const right = new Date(b.examDate || 0).getTime();
            if (left !== right) return left - right;
            return String(a.examName).localeCompare(String(b.examName), "tr");
          }) as Array<{
          examId: string;
          examName: string;
          examDate: string;
          questionCount: number;
          net: number;
          studentSuccess: number;
          schoolSuccess: number;
          generalSuccess: number | null;
          hasGeneralComparison: boolean;
        }>
      : [];

    const openExamTrends = async () => {
      await loadStudentExamResults();
      setExamTrendsOpen(false);
      setTrendCommentOpen(false);
      setTrendTab("percent");
      setTrendSubjectPickerOpen(true);
    };

    const chooseTrendSubject = (subjectName: string) => {
      setSelectedTrendSubject(subjectName);
      setTrendCommentOpen(false);
      setTrendTab("percent");
      setTrendSubjectPickerOpen(false);
      const subjectExams = studentExams
        .filter((exam) => exam.subjects.some((item) => item.subjectName === subjectName))
        .sort((a, b) => new Date(b.examDate || 0).getTime() - new Date(a.examDate || 0).getTime());
      const newestExamId = subjectExams[0]?.id || "";
      setSelectedTrendQuestionExamId(newestExamId);
      if (!selectedStudentExamId && newestExamId) setSelectedStudentExamId(newestExamId);
      setExamTrendsOpen(true);
    };

    const openExamSubjectDetail = async (examId: string, subjectName: string) => {
      await loadStudentExamResults();
      setSelectedExamSubjectDetail({ examId, subjectName });
      setTrendSubjectPickerOpen(false);
      setExamTrendsOpen(false);
      setTrendCommentOpen(false);
    };

    if (!selectedExam) {
      const totalExamCount = studentExams.length;
      const examSuccessValues = studentExams.flatMap((exam) =>
        exam.subjects.map((subject) => {
          const q = Number(subject.questionCount || 0);
          return Number(subject.studentSuccess ?? (q > 0 ? (Number(subject.correct || 0) / q) * 100 : 0));
        }),
      ).filter((value) => Number.isFinite(value));
      const overallAverageSuccess = examSuccessValues.length
        ? examSuccessValues.reduce((sum, value) => sum + value, 0) / examSuccessValues.length
        : 0;
      const subjectAverages = trendSubjects.map((subjectName) => {
        const rows = studentExams
          .map((exam) => exam.subjects.find((subject) => subject.subjectName === subjectName))
          .filter(Boolean) as StudentExamSubjectResult[];
        const avg = rows.length
          ? rows.reduce((sum, subject) => {
              const q = Number(subject.questionCount || 0);
              return sum + Number(subject.studentSuccess ?? (q > 0 ? Number(subject.correct || 0) / q * 100 : 0));
            }, 0) / rows.length
          : 0;
        return { subjectName, avg, count: rows.length };
      }).sort((a, b) => b.avg - a.avg);

      const pageShell = (content: React.ReactNode, title: string, back: () => void) => (
        <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white p-3 text-slate-800">
          <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-xl flex-col overflow-hidden rounded-[30px] border border-indigo-100 bg-white shadow-xl">
            <header className={compactHeaderClass}>
              <button
                type="button"
                onClick={back}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15"
                aria-label="Geri dön"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-base font-black">{title}</h1>
            </header>
            {content}
          </div>
        </main>
      );

      if (examEntryMode === "menu") {
        return (
          <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#312e81_0%,#172554_34%,#020617_78%)] p-3 text-white">
            <div className="relative mx-auto flex h-[calc(100vh-1.5rem)] max-w-xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/55 shadow-2xl backdrop-blur-xl">
              <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
              <header className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
                <button type="button" onClick={() => goBackView()} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-base font-black tracking-wide">Sınav Sonuçları</h1>
                  <p className="mt-0.5 text-[9px] font-bold text-indigo-200">Analiz merkezini seç</p>
                </div>
              </header>

              <section className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.07] p-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.24em] text-cyan-300">Akademik Kontrol Merkezi</span>
                  <h2 className="mt-2 text-2xl font-black leading-tight">Sonuçlarına sadece bakma.<br/>Onları anlamlandır.</h2>
                  <p className="mt-2 text-[10px] font-bold leading-5 text-indigo-100/80">Denemeyi incele, gelişimini izle veya tüm akademik durumunu tek ekranda gör.</p>
                </div>

                <div className="space-y-3">
                  {studentExamCalendar.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void openStudentExamCalendar()}
                      className="group relative w-full overflow-hidden rounded-[28px] border border-indigo-300/25 bg-gradient-to-br from-indigo-500/25 via-blue-500/15 to-cyan-500/10 p-4 text-left shadow-[0_18px_40px_rgba(99,102,241,0.12)] transition active:scale-[0.985]"
                    >
                      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-indigo-300/20 bg-indigo-300/10" />
                      <div className="relative flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-indigo-300 text-slate-950 shadow-lg shadow-indigo-500/20"><CalendarDays className="h-7 w-7" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200">Sınavdan önce incele</span>
                          <strong className="mt-1 block text-xl font-black">Sınav Takvimi</strong>
                          <span className="mt-1 block text-[10px] font-bold text-indigo-100/80">{studentExamCalendar.length} planlı deneme ve içerikleri</span>
                        </span>
                        <ChevronRight className="h-6 w-6 text-indigo-200" />
                      </div>
                    </button>
                  ) : null}

                  {studentHomeExams.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void openStudentHomeExams()}
                      className="group relative w-full overflow-hidden rounded-[28px] border border-emerald-300/25 bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-cyan-500/10 p-4 text-left shadow-[0_18px_40px_rgba(16,185,129,0.12)] transition active:scale-[0.985]"
                    >
                      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-emerald-300/20 bg-emerald-300/10" />
                      <div className="relative flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20"><BookOpenCheck className="h-7 w-7" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">Mobil cevap girişi</span>
                          <strong className="mt-1 block text-xl font-black">Elektronik Optik</strong>
                          <span className="mt-1 block text-[10px] font-bold text-emerald-100/80">{studentHomeExams.length} atanmış sınav</span>
                        </span>
                        <ChevronRight className="h-6 w-6 text-emerald-200" />
                      </div>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setExamEntryMode("examList")}
                    className="group relative w-full overflow-hidden rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/25 via-sky-500/15 to-indigo-500/10 p-4 text-left shadow-[0_18px_40px_rgba(14,165,233,0.12)] transition active:scale-[0.985]"
                  >
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-cyan-300/20 bg-cyan-300/10" />
                    <div className="relative flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"><Award className="h-7 w-7" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200">Tek sınavı derinlemesine incele</span>
                        <strong className="mt-1 block text-xl font-black">Deneme Analizi</strong>
                        <span className="mt-1 block text-[10px] font-bold text-cyan-100/80">{totalExamCount} deneme sonucu</span>
                      </span>
                      <ChevronRight className="h-6 w-6 text-cyan-200" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamEntryMode("development")}
                    className="group relative w-full overflow-hidden rounded-[28px] border border-fuchsia-300/20 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-pink-500/10 p-4 text-left shadow-[0_18px_40px_rgba(168,85,247,0.12)] transition active:scale-[0.985]"
                  >
                    <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10" />
                    <div className="relative flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-fuchsia-300 text-slate-950 shadow-lg shadow-fuchsia-500/20"><BarChart3 className="h-7 w-7" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-200">Derslerin zaman içindeki değişimi</span>
                        <strong className="mt-1 block text-xl font-black">Gelişim Analizi</strong>
                        <span className="mt-1 block text-[10px] font-bold text-fuchsia-100/80">{trendSubjects.length} ders izleniyor</span>
                      </span>
                      <ChevronRight className="h-6 w-6 text-fuchsia-200" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamEntryMode("overview")}
                    className="group relative w-full overflow-hidden rounded-[28px] border border-amber-300/20 bg-gradient-to-br from-amber-400/25 via-orange-400/15 to-rose-500/10 p-4 text-left shadow-[0_18px_40px_rgba(245,158,11,0.10)] transition active:scale-[0.985]"
                  >
                    <div className="absolute right-5 top-3 text-amber-200/20"><Sparkles className="h-16 w-16" /></div>
                    <div className="relative flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/20"><ClipboardList className="h-7 w-7" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-amber-200">Büyük resmi gör</span>
                        <strong className="mt-1 block text-xl font-black">Genel Görünüm</strong>
                        <span className="mt-1 block text-[10px] font-bold text-amber-100/80">Tüm sınavların birleşik özeti</span>
                      </span>
                      <ChevronRight className="h-6 w-6 text-amber-200" />
                    </div>
                  </button>
                </div>
              </section>
            </div>
          </main>
        );
      }

      if (examEntryMode === "calendar") {
        return pageShell(
          <section className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50/80 to-white p-4">
            <div className="mb-4 rounded-[24px] border border-indigo-200 bg-white p-4 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">Deneme Kulübü</span>
              <h2 className="mt-1 text-lg font-black text-slate-950">Sınav Takvimi ve Deneme İçerikleri</h2>
              <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">Yaklaşan denemelerin tarihini ve her derste hangi konulardan soru geleceğini sınavdan önce inceleyebilirsin.</p>
            </div>

            {studentExamCalendarError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{studentExamCalendarError}</div>
            ) : null}

            {studentExamCalendarLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 text-xs font-bold text-slate-500 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" />Sınav takvimi yükleniyor…</div>
            ) : studentExamCalendar.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><CalendarDays className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">Sınıfın için planlanmış deneme bulunmuyor.</p></div>
            ) : (
              <div className="space-y-3">
                {studentExamCalendar.map((item) => {
                  const examMs = item.examDate ? Date.parse(`${item.examDate}T00:00:00`) : NaN;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = Number.isFinite(examMs) && examMs < today.getTime();
                  return (
                    <div key={item.id} className={`overflow-hidden rounded-[24px] border bg-white shadow-sm ${isPast ? "border-slate-200 opacity-70" : "border-indigo-200"}`}>
                      <div className="flex items-start gap-3 border-b border-slate-100 p-4">
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isPast ? "bg-slate-100 text-slate-500" : "bg-indigo-100 text-indigo-700"}`}><CalendarDays className="h-6 w-6" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[8px] font-black text-white">{item.examNumber}. DENEME</span>{isPast ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black text-slate-500">GEÇMİŞ</span> : null}</div>
                          <span className="mt-2 block text-[10px] font-black text-indigo-600">{item.examDate ? formatDate(item.examDate) : "Tarih bilgisi yok"}</span>
                        </div>
                      </div>
                      <div className="space-y-2 p-3">
                        {item.contents.map((content, index) => (
                          <div key={`${item.id}-${content.subject}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600">{content.subject}</div>
                            <div className="mt-1 text-xs font-semibold leading-5 text-slate-700">{content.topics}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>,
          "Sınav Takvimi",
          () => setExamEntryMode("menu"),
        );
      }

      if (examEntryMode === "home") {
        const selectedHomeExam = studentHomeExams.find((exam) => exam.id === selectedStudentHomeExamId) || null;

        if (selectedHomeExam && !selectedHomeExam.submitted) {
          const answeredCount = selectedHomeExam.subjects.reduce((sum, subject) => {
            const answers = studentHomeExamAnswers[subject.name] || [];
            return sum + Array.from({ length: subject.count }, (_, index) => answers[index] || "").filter(Boolean).length;
          }, 0);
          const remainingCount = Math.max(0, selectedHomeExam.totalQuestionCount - answeredCount);

          return pageShell(
            <section className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/80 to-white p-4">
              <div className="mb-4 rounded-[24px] border border-emerald-200 bg-white p-4 shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Elektronik Optik</span>
                <h2 className="mt-1 text-lg font-black text-slate-950">{selectedHomeExam.examName}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{selectedHomeExam.totalQuestionCount} soru</span>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-700">{answeredCount} işaretli</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{remainingCount} boş</span>
                </div>
                <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">Her soru için A, B, C, D veya E seçeneğini işaretleyin. Kaydetme işlemi yalnızca bir kez yapılabilir.</p>
              </div>

              <div className="space-y-4">
                {selectedHomeExam.subjects.map((subject) => {
                  const answers = studentHomeExamAnswers[subject.name] || [];
                  return (
                    <div key={subject.name} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <strong className="text-sm font-black text-slate-900">{subject.name}</strong>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-slate-500 shadow-sm">{subject.count} soru</span>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-[38px_repeat(5,minmax(0,1fr))] gap-1.5 px-1 pb-2 text-center text-[9px] font-black text-slate-400">
                          <span>Soru</span>
                          {(["A", "B", "C", "D", "E"] as const).map((option) => <span key={option}>{option}</span>)}
                        </div>
                        <div className="space-y-1.5">
                          {Array.from({ length: subject.count }, (_, questionIndex) => (
                            <div key={`${subject.name}-${questionIndex}`} className="grid grid-cols-[38px_repeat(5,minmax(0,1fr))] items-center gap-1.5">
                              <span className="text-center text-[11px] font-black text-slate-600">{questionIndex + 1}</span>
                              {(["A", "B", "C", "D", "E"] as const).map((option) => {
                                const selected = answers[questionIndex] === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setStudentHomeExamAnswers((current) => {
                                      const nextSubject = [...(current[subject.name] || [])];
                                      nextSubject[questionIndex] = selected ? "" : option;
                                      return { ...current, [subject.name]: nextSubject };
                                    })}
                                    className={`flex h-9 items-center justify-center rounded-xl border text-xs font-black transition ${selected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 active:bg-emerald-50"}`}
                                    aria-label={`${subject.name} ${questionIndex + 1}. soru ${option} seçeneği`}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {studentHomeExamsError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{studentHomeExamsError}</div>
              ) : null}

              <button
                type="button"
                disabled={studentHomeExamSaving}
                onClick={() => void submitStudentHomeExam(selectedHomeExam)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[22px] bg-emerald-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {studentHomeExamSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpenCheck className="h-5 w-5" />}
                {studentHomeExamSaving ? "Kaydediliyor…" : "Cevapları Kaydet"}
              </button>
            </section>,
            "Elektronik Optik",
            () => { setSelectedStudentHomeExamId(""); setStudentHomeExamAnswers({}); setStudentHomeExamsError(""); },
          );
        }

        return pageShell(
          <section className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/70 to-white p-4">
            {studentHomeExamNotice ? (
              <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-700">{studentHomeExamNotice}</div>
            ) : null}
            {studentHomeExamsError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{studentHomeExamsError}</div>
            ) : null}
            {studentHomeExamsLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 text-xs font-bold text-slate-500 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" />Denemeler yükleniyor…</div>
            ) : studentHomeExams.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">Cevap girişi yapılacak tanımlı deneme bulunmuyor.</p></div>
            ) : (
              <div className="space-y-3">
                {studentHomeExams.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    disabled={exam.submitted}
                    onClick={() => { setStudentHomeExamNotice(""); setStudentHomeExamsError(""); setStudentHomeExamAnswers({}); setSelectedStudentHomeExamId(exam.id); }}
                    className={`flex w-full items-center gap-3 rounded-[24px] border p-4 text-left shadow-sm transition ${exam.submitted ? "cursor-default border-slate-200 bg-slate-100/80 opacity-75" : "border-emerald-300 bg-white active:scale-[0.99]"}`}
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${exam.submitted ? "bg-slate-200 text-slate-500" : "bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-700"}`}><BookOpenCheck className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-black text-slate-900">{exam.examName}</strong>
                      <span className="mt-1 block text-[10px] font-bold text-slate-500">{exam.examDate ? formatDate(exam.examDate) : "Tarih bilgisi yok"} · {exam.totalQuestionCount} soru</span>
                      <span className="mt-1 block text-[9px] font-bold text-slate-400">{exam.subjects.map((subject) => `${subject.name} ${subject.count}`).join(" · ")}</span>
                    </span>
                    {exam.submitted ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[8px] font-black text-emerald-700">KAYDEDİLDİ</span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>,
          "Evde Deneme",
          () => { setSelectedStudentHomeExamId(""); setStudentHomeExamAnswers({}); setExamEntryMode("menu"); },
        );
      }

      if (examEntryMode === "development") {
        return pageShell(
          <section className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50 to-white p-4">
            <div className="mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-500">Gelişim Analizi</span>
              <h2 className="mt-1 text-xl font-black text-slate-950">Bir ders seç</h2>
              <p className="mt-1 text-[10px] font-bold leading-5 text-slate-500">Seçtiğin dersin sınavlar boyunca akademik gelişimini göreceksin.</p>
            </div>
            <div className="overflow-hidden rounded-[26px] border border-indigo-100 bg-white shadow-sm">
              {subjectAverages.map((row, index) => (
                <button
                  key={row.subjectName}
                  type="button"
                  onClick={() => chooseTrendSubject(row.subjectName)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition active:bg-violet-50 ${index ? "border-t border-slate-100" : ""}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700"><BarChart3 className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-black text-slate-900">{row.subjectName}</strong>
                    <span className="mt-1 block text-[9px] font-bold text-slate-500">{row.count} sınav</span>
                  </span>
                  <span className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">%{row.avg.toFixed(1)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </section>,
          "Gelişim Analizi",
          () => setExamEntryMode("menu"),
        );
      }

      if (examEntryMode === "overview") {
        const best = subjectAverages[0];
        const latest = [...studentExams].sort((a, b) => new Date(b.examDate || 0).getTime() - new Date(a.examDate || 0).getTime())[0];
        return pageShell(
          <section className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-amber-50/70 to-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-indigo-100 bg-white p-4 shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-wide text-indigo-500">Toplam Deneme</span>
                <strong className="mt-2 block text-3xl font-black text-indigo-900">{totalExamCount}</strong>
              </div>
              <div className="rounded-[24px] border border-emerald-300 bg-white p-4 shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-wide text-emerald-500">Ortalama Başarı</span>
                <strong className="mt-2 block text-3xl font-black text-emerald-800">%{overallAverageSuccess.toFixed(1)}</strong>
              </div>
            </div>
            <div className="mt-3 rounded-[26px] border border-violet-300 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-5 text-white shadow-lg">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200">En güçlü ders</span>
              <strong className="mt-2 block text-2xl font-black">{best?.subjectName || "—"}</strong>
              <span className="mt-1 block text-sm font-black text-cyan-300">{best ? `%${best.avg.toFixed(1)}` : "—"}</span>
            </div>
            <div className="mt-3 rounded-[26px] border border-amber-300 bg-white p-4 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-wide text-amber-600">Son sınav</span>
              <strong className="mt-2 block text-base font-black text-slate-900">{latest?.examName || "—"}</strong>
              <span className="mt-1 block text-[10px] font-bold text-slate-500">{latest?.examDate ? formatDate(latest.examDate) : "Tarih bilgisi yok"}</span>
            </div>
          </section>,
          "Genel Görünüm",
          () => setExamEntryMode("menu"),
        );
      }

      return pageShell(
        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          {studentExamsError ? (
            <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{studentExamsError}</div>
          ) : null}
          {studentExamsLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl bg-slate-50 p-8 text-xs font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Sınav sonuçları yükleniyor…</div>
          ) : studentExams.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center"><BarChart3 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">Açıklanmış sınav sonucu bulunmuyor.</p></div>
          ) : (
            <div className="space-y-3">
              {studentExams.map((exam, index) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => setSelectedStudentExamId(exam.id)}
                  className="flex w-full items-center gap-3 rounded-[24px] border border-cyan-300 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-indigo-100 text-cyan-700"><Award className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-slate-900">{exam.examName}</strong>
                    <span className="mt-1 block text-[10px] font-bold text-slate-500">{exam.examDate ? formatDate(exam.examDate) : "Tarih bilgisi yok"}</span>
                  </span>
                  {index === 0 ? <span className="rounded-full bg-cyan-600 px-2 py-1 text-[8px] font-black text-white">SON SINAV</span> : null}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </section>,
        "Deneme Analizi",
        () => setExamEntryMode("menu"),
      );
    }
    const studentIdentityAndRanks = (
      <div className="shrink-0 bg-white px-4 pt-4 pb-3">
        <div className="relative overflow-hidden rounded-[24px] border border-teal-300/80 bg-gradient-to-r from-white via-white to-teal-50/70 p-3 shadow-[0_8px_28px_rgba(15,118,110,0.08)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border border-teal-200/70 bg-teal-100/40" />
          <div className="pointer-events-none absolute -bottom-10 right-14 h-24 w-36 rotate-[-8deg] rounded-[50%] border border-cyan-300 bg-cyan-50/70" />
          <div className="relative flex items-stretch gap-4">
            <div className="flex h-[108px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-100 text-2xl font-black text-teal-700 shadow-sm">
              {selectedExam.student.photoUrl ? (
                <img src={selectedExam.student.photoUrl} alt={selectedExam.student.name} className="h-full w-full object-cover" />
              ) : (
                selectedExam.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR")
              )}
            </div>

            <div className="min-w-0 flex flex-1 flex-col justify-center">
              <h2 className="truncate text-lg font-black tracking-tight text-slate-950">{selectedExam.student.name}</h2>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span>Sınıfı: <strong className="text-slate-950">{selectedExam.student.classroom || "—"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <span>Okul Numarası: <strong className="text-slate-950">{selectedExam.student.number || "—"}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-slate-50 to-white p-3 text-slate-800">
        <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-[30px] border border-cyan-300 bg-white shadow-xl">
          <header className={compactHeaderClass}>
            <button type="button" onClick={() => { setSelectedStudentExamId(""); setExamEntryMode("examList"); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15" aria-label="Sınav listesine dön">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-base font-black">{selectedExam.examName}</h1>
          </header>

          <section className="min-h-0 flex-1 overflow-hidden bg-white">
            <div className="flex h-full min-h-0 flex-col">
              {/* Öğrenci kimliği ve genel sıralamalar kaydırma sırasında yerinde kalır. */}
              {studentIdentityAndRanks}

              {/* Yalnızca alttaki iki sonuç tablosu yatay kayar. */}
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="h-full w-full shrink-0 snap-start snap-always overflow-y-auto px-4 pb-4">
                    <div className="mb-4 grid grid-cols-5 gap-1.5 rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                      <div className="rounded-2xl border border-blue-300 bg-white px-1 py-2 text-center shadow-[0_5px_16px_rgba(37,99,235,0.08)]">
                        <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-blue-600"><ClipboardList className="h-4 w-4" /></span>
                        <span className="block text-[7px] font-black uppercase tracking-wide text-blue-700">Soru Sayısı</span>
                        <strong className="mt-0.5 block text-lg font-black text-blue-700">{selectedExam.subjects.reduce((sum, subject) => sum + Number(subject.questionCount || 0), 0)}</strong>
                      </div>
                      <div className="rounded-2xl border border-emerald-300 bg-white px-1 py-2 text-center shadow-[0_5px_16px_rgba(16,185,129,0.08)]">
                        <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-600"><Award className="h-4 w-4" /></span>
                        <span className="block text-[7px] font-black uppercase tracking-wide text-emerald-700">Doğru</span>
                        <strong className="mt-0.5 block text-lg font-black text-emerald-700">{selectedExam.overall.correct}</strong>
                      </div>
                      <div className="rounded-2xl border border-rose-300 bg-white px-1 py-2 text-center shadow-[0_5px_16px_rgba(244,63,94,0.08)]">
                        <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-rose-500 bg-rose-50 text-rose-600"><X className="h-4 w-4" /></span>
                        <span className="block text-[7px] font-black uppercase tracking-wide text-rose-700">Yanlış</span>
                        <strong className="mt-0.5 block text-lg font-black text-rose-700">{selectedExam.overall.wrong}</strong>
                      </div>
                      <div className="rounded-2xl border border-amber-300 bg-white px-1 py-2 text-center shadow-[0_5px_16px_rgba(245,158,11,0.08)]">
                        <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 text-amber-600"><span className="text-base font-black leading-none">−</span></span>
                        <span className="block text-[7px] font-black uppercase tracking-wide text-amber-700">Boş</span>
                        <strong className="mt-0.5 block text-lg font-black text-amber-700">{selectedExam.overall.empty}</strong>
                      </div>
                      <div className="rounded-2xl border border-violet-300 bg-white px-1 py-2 text-center shadow-[0_5px_16px_rgba(139,92,246,0.08)]">
                        <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-violet-500 bg-violet-50 text-violet-600"><BarChart3 className="h-4 w-4" /></span>
                        <span className="block text-[7px] font-black uppercase tracking-wide text-violet-700">Net</span>
                        <strong className="mt-0.5 block text-lg font-black text-violet-700">{Number(selectedExam.overall.net).toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="w-[32%] px-2 py-3 text-left font-black">
                              <button
                                type="button"
                                onClick={undefined}
                                title="Ders trendlerini aç"
                                className="group inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/70 bg-gradient-to-r from-cyan-500/95 via-sky-500/95 to-indigo-500/95 px-2 py-1.5 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.10),0_6px_16px_rgba(14,165,233,0.28)] transition active:scale-95"
                              >
                                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                                  <BarChart3 className="h-3.5 w-3.5" />
                                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 ring-2 ring-sky-600" />
                                </span>
                                <span className="leading-none">Ders</span>
                                <Sparkles className="h-3 w-3 text-amber-200" />
                              </button>
                            </th>
                            <th className="w-[13.6%] px-1 py-3 text-center font-black">Soru</th>
                            <th className="w-[13.6%] px-1 py-3 text-center font-black">Doğru</th>
                            <th className="w-[13.6%] px-1 py-3 text-center font-black">Yanlış</th>
                            <th className="w-[13.6%] px-1 py-3 text-center font-black">Boş</th>
                            <th className="w-[13.6%] px-1 py-3 text-center font-black">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedExam.subjects.map((subject, index) => (
                            <tr key={`${subject.subjectName}-summary-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="break-words border-t border-slate-100 px-2 py-2.5 font-black leading-tight text-slate-900">
                                <button
                                  type="button"
                                  onClick={() => openExamSubjectDetail(selectedExam.id, subject.subjectName)}
                                  title={`${selectedExam.examName} ${subject.subjectName} başarısını aç`}
                                  className="group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-cyan-300 bg-gradient-to-r from-cyan-50 to-sky-50 px-2 py-1.5 text-left text-slate-900 shadow-sm transition active:scale-[0.98]"
                                >
                                  <span className="min-w-0 break-words font-black">{subject.subjectName}</span>
                                  <BarChart3 className="h-3.5 w-3.5 shrink-0 text-cyan-600 transition-transform group-active:scale-110" />
                                </button>
                              </td>
                              <td className="border-t border-slate-100 px-1 py-3 text-center font-bold text-slate-600">{subject.questionCount}</td>
                              <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-emerald-700">{subject.correct}</td>
                              <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-red-700">{subject.wrong}</td>
                              <td className="border-t border-slate-100 px-1 py-3 text-center font-bold text-slate-500">{subject.empty}</td>
                              <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-indigo-700">{Number(subject.net).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-center text-[9px] font-bold text-slate-400">Ders sıralamaları ve puanlar için sola kaydırın.</p>
                  </div>

                  <div className="h-full w-full shrink-0 snap-start snap-always overflow-y-auto px-4 pb-4">
                    <div className="mb-4 grid grid-cols-3 gap-2 rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                      <div className="rounded-2xl border border-teal-300 bg-gradient-to-br from-white to-teal-50/60 p-3 text-center shadow-[0_5px_18px_rgba(13,148,136,0.08)]">
                        <span className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-teal-500 bg-white text-teal-600"><Award className="h-5 w-5" /></span>
                        <span className="block text-[8px] font-black uppercase tracking-wide text-teal-700">Sınıf Sırası</span>
                        <strong className="mt-1 block text-xl font-black text-teal-700">{rankValue(selectedExam.overall.classroomRank)}</strong>
                      </div>
                      <div className="rounded-2xl border border-blue-300 bg-gradient-to-br from-white to-blue-50/60 p-3 text-center shadow-[0_5px_18px_rgba(37,99,235,0.08)]">
                        <span className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-blue-600"><ClipboardList className="h-5 w-5" /></span>
                        <span className="block text-[8px] font-black uppercase tracking-wide text-blue-700">Okul Sırası</span>
                        <strong className="mt-1 block text-xl font-black text-blue-700">{rankValue(selectedExam.overall.schoolRank)}</strong>
                      </div>
                      <div className="rounded-2xl border border-violet-300 bg-gradient-to-br from-white to-violet-50/60 p-3 text-center shadow-[0_5px_18px_rgba(139,92,246,0.08)]">
                        <span className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-violet-500 bg-white text-violet-600"><BarChart3 className="h-5 w-5" /></span>
                        <span className="block text-[8px] font-black uppercase tracking-wide text-violet-700">Genel Sıra</span>
                        <strong className="mt-1 block text-xl font-black text-violet-700">{rankValue(selectedExam.overall.generalRank)}</strong>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed border-collapse text-[9px]">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="w-[30%] px-2 py-3 text-left font-black">
                              <button
                                type="button"
                                onClick={openExamTrends}
                                title="Ders trendlerini aç"
                                className="group inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/70 bg-gradient-to-r from-cyan-500/95 via-sky-500/95 to-indigo-500/95 px-2 py-1.5 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.10),0_6px_16px_rgba(14,165,233,0.28)] transition active:scale-95"
                              >
                                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                                  <BarChart3 className="h-3.5 w-3.5" />
                                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 ring-2 ring-sky-600" />
                                </span>
                                <span className="leading-none">Ders</span>
                                <Sparkles className="h-3 w-3 text-amber-200" />
                              </button>
                            </th>
                            <th className="w-[16%] px-1 py-3 text-center font-black">Sınıf</th>
                            <th className="w-[16%] px-1 py-3 text-center font-black">Okul</th>
                            <th className="w-[16%] px-1 py-3 text-center font-black">Genel</th>
                            <th className="w-[22%] px-1 py-3 text-center font-black">Puan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedExam.subjects.map((subject, index) => {
                            const subjectScore = Number(subject.score ?? Number(subject.net || 0) * 4);
                            return (
                              <tr key={`${subject.subjectName}-ranking-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="break-words border-t border-slate-100 px-2 py-2.5 font-black leading-tight text-slate-900">
                                <button
                                  type="button"
                                  onClick={() => openExamSubjectDetail(selectedExam.id, subject.subjectName)}
                                  title={`${selectedExam.examName} ${subject.subjectName} başarısını aç`}
                                  className="group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-cyan-300 bg-gradient-to-r from-cyan-50 to-sky-50 px-2 py-1.5 text-left text-slate-900 shadow-sm transition active:scale-[0.98]"
                                >
                                  <span className="min-w-0 break-words font-black">{subject.subjectName}</span>
                                  <BarChart3 className="h-3.5 w-3.5 shrink-0 text-cyan-600 transition-transform group-active:scale-110" />
                                </button>
                              </td>
                                <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-orange-700">{rankValue(subject.classroomRank)}</td>
                                <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-sky-700">{rankValue(subject.schoolRank)}</td>
                                <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-violet-700">{rankValue(subject.generalRank)}</td>
                                <td className="border-t border-slate-100 px-1 py-3 text-center font-black text-indigo-700">{Number.isFinite(subjectScore) ? subjectScore.toFixed(2) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-[9px] font-bold leading-4 text-slate-400">Genel sıralama verisi sınav kaynağında bulunmuyorsa “—” gösterilir; sistem bu değeri tahmin etmez.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {selectedExamSubjectDetail ? (() => {
            const detailExam = studentExams.find((exam) => exam.id === selectedExamSubjectDetail.examId) || null;
            const detailSubject = detailExam?.subjects.find((subject) => subject.subjectName === selectedExamSubjectDetail.subjectName) || null;
            const detailQuestions = normalizeSubjectQuestions(detailSubject?.questions);
            const qSlot = 44;
            const qWidth = Math.max(detailQuestions.length, 8) * qSlot;
            const detailTitle = `${detailExam?.examName || "Deneme"} ${selectedExamSubjectDetail.subjectName} Başarısı`;
            const outcomeMap = new Map<string, { name: string; total: number; correct: number; wrong: number; empty: number }>();
            detailQuestions.forEach((question) => {
              const name = String(question.outcome || question.topic || question.unit || "Kazanım bilgisi olmayan sorular").trim();
              const row = outcomeMap.get(name) || { name, total: 0, correct: 0, wrong: 0, empty: 0 };
              row.total += 1;
              if (question.status === "correct") row.correct += 1;
              else if (question.status === "empty") row.empty += 1;
              else row.wrong += 1;
              outcomeMap.set(name, row);
            });
            const outcomeRows = Array.from(outcomeMap.values()).map((row) => ({
              ...row,
              success: row.total > 0 ? (row.correct / row.total) * 100 : 0,
            })).sort((a, b) => a.success - b.success || b.total - a.total);
            const weakOutcomes = outcomeRows.filter((row) => row.success < 70).slice(0, 5);
            const overallSuccess = detailQuestions.length > 0
              ? (detailQuestions.filter((question) => question.status === "correct").length / detailQuestions.length) * 100
              : 0;
            return (
              <div className="fixed inset-0 z-[145] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-4">
                <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-violet-300 bg-[#f8f7ff] shadow-2xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-[30px]">
                  <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-800 px-4 py-3 text-white">
                    <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                    <h3 className="min-w-0 flex-1 truncate px-2 text-center text-sm font-black tracking-wide sm:text-base">{detailTitle}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedExamSubjectDetail(null)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 transition active:scale-95"
                      aria-label="Ders başarı penceresini kapat"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    <div className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain">
                      <section className="h-full min-w-full snap-start snap-always overflow-y-auto p-3 sm:p-4">
                        <div className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-violet-500">Soru Bazlı Başarı</span>
                              <strong className="mt-1 block text-sm font-black text-slate-900">{selectedExamSubjectDetail.subjectName}</strong>
                            </div>
                            <div className="rounded-2xl border border-violet-300 bg-violet-50 px-3 py-2 text-right">
                              <span className="block text-[8px] font-black uppercase tracking-wide text-violet-500">Soru</span>
                              <strong className="block text-lg font-black text-violet-800">{detailSubject?.questionCount || detailQuestions.length || 0}</strong>
                            </div>
                          </div>

                          {detailQuestions.length ? (
                            <div className="flex h-[390px] sm:h-[430px]">
                              <div className="flex w-10 shrink-0 flex-col justify-between pb-9 pt-3 text-right text-[8px] font-black text-slate-500 sm:w-11 sm:text-[9px]">
                                {[100, 75, 50, 25, 0].map((value) => <span key={`detail-y-${value}`}>%{value}</span>)}
                              </div>
                              <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain">
                                <div className="relative h-full" style={{ width: `${qWidth}px`, minWidth: "100%" }}>
                                  <div className="pointer-events-none absolute inset-x-0 bottom-9 top-3 flex flex-col justify-between">
                                    {[0, 1, 2, 3, 4].map((index) => <span key={`detail-grid-${index}`} className="block border-t border-slate-100" />)}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-9 top-3 flex items-end gap-2 px-2">
                                    {detailQuestions.map((question) => {
                                      const rate = Math.max(0, Math.min(100, Number(question.correctRate || 0)));
                                      const barTone = question.status === "correct"
                                        ? "border-slate-300 bg-white text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
                                        : question.status === "empty"
                                          ? "border-slate-300 bg-slate-200 text-slate-600"
                                          : "border-rose-300 bg-rose-200 text-rose-700";
                                      return (
                                        <div key={`detail-q-${question.questionNumber}`} className="flex h-full w-[36px] shrink-0 items-end justify-center">
                                          <div
                                            className={`relative flex w-8 flex-col items-center justify-start rounded-t-lg border pt-1.5 ${barTone}`}
                                            style={{ height: `${Math.max(9, rate)}%` }}
                                            title={`${question.questionNumber}. soru doğru cevaplanma oranı %${rate.toFixed(0)}`}
                                          >
                                            <span className="text-[8px] font-black leading-none">%</span>
                                            <span className="mt-0.5 text-[10px] font-black leading-none">{rate.toFixed(0)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 flex h-9 items-start gap-2 px-2 pt-1.5 text-center text-[8px] font-black text-slate-700">
                                    {detailQuestions.map((question) => (
                                      <span key={`detail-q-label-${question.questionNumber}`} className="w-[36px] shrink-0">{question.questionNumber}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 p-8 text-center text-xs font-bold leading-5 text-slate-500">Bu denemenin {selectedExamSubjectDetail.subjectName} dersi için soru bazlı veri bulunamadı.</div>
                          )}

                          <div className="mt-3 flex flex-wrap justify-center gap-4 rounded-2xl bg-slate-50 px-3 py-2.5 text-[9px] font-black text-slate-600">
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white" />Doğru</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-slate-300 bg-slate-200" />Boş</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-rose-300 bg-rose-200" />Yanlış</span>
                          </div>
                          <p className="mt-3 text-center text-[9px] font-black text-violet-500">Kazanım Bazlı Başarı için sola kaydırın →</p>
                        </div>
                      </section>

                      <section className="h-full min-w-full snap-start snap-always overflow-y-auto p-3 sm:p-4">
                        <div className="rounded-[26px] border border-sky-300 bg-white p-4 shadow-sm">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-sky-500">Kazanım Bazlı Başarı</span>
                              <strong className="mt-1 block text-sm font-black text-slate-900">{selectedExamSubjectDetail.subjectName}</strong>
                            </div>
                            <div className="rounded-2xl bg-sky-50 px-3 py-2 text-right">
                              <span className="block text-[8px] font-black uppercase text-sky-500">Kazanım</span>
                              <strong className="text-lg font-black text-sky-800">{outcomeRows.length}</strong>
                            </div>
                          </div>

                          {outcomeRows.length ? (
                            <div className="space-y-3">
                              {outcomeRows.map((row, index) => {
                                const tone = row.success >= 75 ? "bg-emerald-500" : row.success >= 50 ? "bg-amber-400" : "bg-rose-500";
                                return (
                                  <div key={`outcome-${index}-${row.name}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <strong className="block text-xs font-black leading-5 text-slate-800">{row.name}</strong>
                                        <span className="mt-1 block text-[9px] font-bold text-slate-500">{row.total} soru · {row.correct} doğru · {row.wrong} yanlış · {row.empty} boş</span>
                                      </div>
                                      <span className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-xs font-black text-slate-800 shadow-sm">%{row.success.toFixed(0)}</span>
                                    </div>
                                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, row.success)}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 p-8 text-center text-xs font-bold leading-5 text-slate-500">Bu sınavda kazanım bilgisi bulunmuyor.</div>
                          )}
                          <p className="mt-4 text-center text-[9px] font-black text-sky-500">Öneriler için sola kaydırın →</p>
                        </div>
                      </section>

                      <section className="h-full min-w-full snap-start snap-always overflow-y-auto p-3 sm:p-4">
                        <div className="rounded-[26px] border border-emerald-300 bg-white p-4 shadow-sm">
                          <div className="mb-4">
                            <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-emerald-500">Öneriler</span>
                            <strong className="mt-1 block text-sm font-black text-slate-900">{selectedExamSubjectDetail.subjectName}</strong>
                          </div>

                          <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-4 text-white">
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-200">Bu sınavdaki ders başarın</span>
                            <div className="mt-2 flex items-end gap-2">
                              <strong className="text-4xl font-black">%{overallSuccess.toFixed(0)}</strong>
                              <span className="pb-1 text-xs font-bold text-indigo-100">{detailQuestions.length} soru üzerinden</span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {weakOutcomes.length ? weakOutcomes.map((row, index) => (
                              <div key={`suggest-${index}-${row.name}`} className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
                                <span className="text-[9px] font-black uppercase tracking-wide text-amber-700">Öncelik {index + 1}</span>
                                <strong className="mt-1 block text-xs font-black leading-5 text-slate-800">{row.name}</strong>
                                <p className="mt-1 text-[10px] font-bold leading-5 text-slate-600">Bu alandaki başarın %{row.success.toFixed(0)}. Yanlış ve boş bıraktığın soruları yeniden çöz; ardından aynı kazanımdan kısa bir tekrar testi uygula.</p>
                              </div>
                            )) : (
                              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold leading-6 text-emerald-800">Bu derste belirgin zayıf kazanım görünmüyor. Mevcut seviyeni korumak için düzenli tekrar ve karışık soru çözümüne devam et.</div>
                            )}
                          </div>

                          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[10px] font-bold leading-5 text-slate-600">
                            Öneriler yalnızca bu sınavdaki soru ve kazanım sonuçlarından üretilir. Yeni sınavlar geldikçe Akademik Gelişim ekranındaki öneriler daha kapsamlı hale gelecektir.
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}

          {trendSubjectPickerOpen ? (
            <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[3px] sm:items-center sm:p-4">
              <div className="w-full max-w-xl overflow-hidden border border-indigo-100 bg-white shadow-2xl sm:rounded-[30px]">
                <div className="flex items-center justify-between bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-800 px-4 py-4 text-white">
                  <div>
                    <h3 className="text-base font-black tracking-wide">Ders Seçimi</h3>
                    <p className="mt-1 text-[10px] font-bold text-indigo-100">Bugüne kadar sınava girdiğiniz derslerin ortalama başarı yüzdeleri.</p>
                  </div>
                  <button type="button" onClick={() => setTrendSubjectPickerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10" aria-label="Ders seçimini kapat">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[78vh] overflow-y-auto bg-slate-50 p-3">
                  {trendSubjects.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">Sınav sonucu bulunan ders yok.</div>
                  ) : (
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                      {trendSubjects.map((subjectName, index) => {
                        const rows = studentExams
                          .map((exam) => exam.subjects.find((subject) => subject.subjectName === subjectName))
                          .filter(Boolean) as StudentExamSubjectResult[];
                        const avg = rows.length
                          ? rows.reduce((sum, subject) => {
                              const q = Number(subject.questionCount || 0);
                              const pct = Number(subject.studentSuccess ?? (q > 0 ? Number(subject.correct || 0) / q * 100 : 0));
                              return sum + pct;
                            }, 0) / rows.length
                          : 0;
                        const examCount = rows.length;
                        return (
                          <button
                            key={subjectName}
                            type="button"
                            onClick={() => chooseTrendSubject(subjectName)}
                            className={`flex w-full items-center gap-3 px-4 py-4 text-left transition active:bg-indigo-50 ${index ? "border-t border-slate-100" : ""}`}
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700">
                              <BarChart3 className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm font-black text-slate-900">{subjectName}</strong>
                              <span className="mt-1 block text-[9px] font-bold text-slate-500">{examCount} sınav</span>
                            </span>
                            <span className="mr-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">%{avg.toFixed(1)}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {examTrendsOpen ? (
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[3px] sm:items-center sm:p-4">
              <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-violet-300 bg-[#f8f7ff] shadow-2xl sm:h-[96vh] sm:max-h-[96vh] sm:rounded-[30px]">
                <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-800 px-4 py-3 text-white">
                  <button type="button" onClick={() => { setExamTrendsOpen(false); setSelectedStudentExamId(""); setExamEntryMode("development"); }} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10" aria-label="Ders seçimine dön">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h3 className="truncate px-2 text-base font-black tracking-wide">{selectedTrendSubject ? `${selectedTrendSubject} Akademik Gelişim` : "Akademik Gelişim"}</h3>
                  <button type="button" onClick={() => { setExamTrendsOpen(false); setSelectedStudentExamId(""); setExamEntryMode("development"); }} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10" aria-label="Ders seçimine dön">
                    <X className="h-5 w-5" />
                  </button>
                </div>
<div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                  {selectedTrendSubject && trendRows.length > 0 ? (() => {
                    const last = trendRows[trendRows.length - 1];
                    const studentAvg = trendRows.reduce((sum, row) => sum + row.studentSuccess, 0) / trendRows.length;
                    const schoolAvg = trendRows.reduce((sum, row) => sum + row.schoolSuccess, 0) / trendRows.length;
                    const generalRows = trendRows.filter((row) => row.generalSuccess !== null);
                    const generalAvg = generalRows.length ? generalRows.reduce((sum, row) => sum + Number(row.generalSuccess || 0), 0) / generalRows.length : null;
                    const target = 80;
                    const visibleSlots = 6;
                    const slotWidth = 54;
                    const chartWidth = Math.max(visibleSlots, trendRows.length) * slotWidth;
                    const chartNeedsScroll = trendRows.length > visibleSlots;
                    const goalHeight = 190;
                    const goalTop = 16;
                    const goalBottom = 30;
                    const goalPlot = goalHeight - goalTop - goalBottom;
                    const gx = (index: number) => 20 + index * slotWidth;
                    const gy = (value: number) => goalTop + goalPlot - Math.max(0, Math.min(100, value)) / 100 * goalPlot;
                    const goalPoints = trendRows.map((row, index) => `${gx(index)},${gy(row.studentSuccess)}`).join(" ");

                    const outcomeMap = new Map<string, { total: number; correct: number; wrong: number; empty: number }>();
                    studentExams.forEach((exam) => {
                      const subject = exam.subjects.find((item) => item.subjectName === selectedTrendSubject);
                      normalizeSubjectQuestions(subject?.questions).forEach((question) => {
                        const label = String(question.outcome || question.topic || question.unit || "").trim();
                        if (!label) return;
                        const current = outcomeMap.get(label) || { total: 0, correct: 0, wrong: 0, empty: 0 };
                        current.total += 1;
                        if (question.status === "correct") current.correct += 1;
                        else if (question.status === "wrong") current.wrong += 1;
                        else current.empty += 1;
                        outcomeMap.set(label, current);
                      });
                    });
                    const outcomeRows = Array.from(outcomeMap.entries())
                      .map(([name, value]) => ({
                        name,
                        ...value,
                        success: value.total > 0 ? (value.correct / value.total) * 100 : 0,
                      }))
                      .sort((a, b) => a.success - b.success || a.name.localeCompare(b.name, "tr"));

                    const firstTrend = trendRows[0];
                    const changeValue = firstTrend && last ? last.studentSuccess - firstTrend.studentSuccess : 0;
                    const weakestOutcome = outcomeRows[0] || null;
                    const strongestOutcome = outcomeRows.length ? outcomeRows[outcomeRows.length - 1] : null;

                    return (
                      <div className="h-full overflow-hidden">
                        <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
                          <section className="h-full min-w-full snap-start snap-always overflow-y-auto">
                            <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-2xl border border-rose-100 bg-white p-3 text-center shadow-sm">
                            <span className="block text-[9px] font-black text-slate-500">Öğrenci Ortalaması</span>
                            <strong className="mt-1 block text-xl font-black text-red-600">%{studentAvg.toFixed(1)}</strong>
                          </div>
                          <div className="rounded-2xl border border-blue-300 bg-white p-3 text-center shadow-sm">
                            <span className="block text-[9px] font-black text-slate-500">Okul Ortalaması</span>
                            <strong className="mt-1 block text-xl font-black text-blue-600">%{schoolAvg.toFixed(1)}</strong>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                            <span className="block text-[9px] font-black text-slate-500">Genel Ortalama</span>
                            <strong className="mt-1 block text-xl font-black text-slate-800">{generalAvg === null ? "—" : `%${generalAvg.toFixed(1)}`}</strong>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-900">Sınavlara Göre Başarı Dağılımı</h4>
                            <div className="flex gap-2 text-[8px] font-black">
                              <span className="text-red-600">■ Öğrenci</span><span className="text-blue-600">■ Okul</span>{generalAvg !== null ? <span className="text-slate-700">■ Genel</span> : null}
                            </div>
                          </div>
                          <div className="flex h-[250px]">
                            <div className="flex w-9 shrink-0 flex-col justify-between pb-7 pt-1 text-right text-[8px] font-bold text-slate-500">
                              {[100,75,50,25,0].map((v) => <span key={v}>%{v}</span>)}
                            </div>
                            <div className={`min-w-0 flex-1 overflow-y-hidden ${chartNeedsScroll ? "overflow-x-auto" : "overflow-x-hidden"}`}>
                              <div className="relative h-full" style={{ width: chartNeedsScroll ? `${chartWidth}px` : "100%", minWidth: "100%" }}>
                                <div className="absolute inset-x-0 bottom-7 top-0 flex flex-col justify-between pointer-events-none">
                                  {[0,1,2,3,4].map((i) => <span key={i} className="block border-t border-slate-100" />)}
                                </div>
                                <div className="absolute inset-x-0 bottom-7 top-0 flex items-end gap-1.5 px-2">
                                  {trendRows.map((row, index) => (
                                    <div key={row.examId} className="flex h-full shrink-0 items-end justify-center gap-[2px]" style={{ width: chartNeedsScroll ? "48px" : `${100 / visibleSlots}%` }}>
                                      <div className="w-3 rounded-t bg-red-400" style={{ height: `${Math.max(2,row.studentSuccess)}%` }} title={`Öğrenci %${row.studentSuccess.toFixed(1)}`} />
                                      <div className="w-3 rounded-t bg-blue-500" style={{ height: `${Math.max(2,row.schoolSuccess)}%` }} title={`Okul %${row.schoolSuccess.toFixed(1)}`} />
                                      {row.generalSuccess !== null ? <div className="w-3 rounded-t bg-slate-500" style={{ height: `${Math.max(2,Number(row.generalSuccess))}%` }} title={`Genel %${Number(row.generalSuccess).toFixed(1)}`} /> : null}
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute inset-x-0 bottom-0 flex h-7 items-start gap-1.5 px-2 pt-1 text-center text-[8px] font-black text-slate-600">
                                  {trendRows.map((row, index) => <span key={`${row.examId}-label`} className="shrink-0" style={{ width: chartNeedsScroll ? "48px" : `${100 / visibleSlots}%` }}>{index + 1}</span>)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-violet-300 bg-white p-3 shadow-sm">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-900">Hedef İlerlemesi</h4>
                            <span className="text-[10px] font-black text-violet-700">Hedef: %{target}</span>
                          </div>
                          <div className="flex h-[190px]">
                            <div className="flex w-9 shrink-0 flex-col justify-between pb-7 pt-1 text-right text-[8px] font-bold text-slate-500">
                              {[100,75,50,25,0].map((v) => <span key={v}>%{v}</span>)}
                            </div>
                            <div className={`min-w-0 flex-1 overflow-y-hidden ${chartNeedsScroll ? "overflow-x-auto" : "overflow-x-hidden"}`}>
                              <svg
                                viewBox={`0 0 ${chartWidth} ${goalHeight}`}
                                preserveAspectRatio="none"
                                className="block h-[190px]"
                                style={{ width: chartNeedsScroll ? `${chartWidth}px` : "100%", minWidth: "100%" }}
                                role="img"
                                aria-label={`${selectedTrendSubject} hedef ilerleme grafiği`}
                              >
                                {[0,25,50,75,100].map((tick) => <line key={tick} x1="0" x2={chartWidth} y1={gy(tick)} y2={gy(tick)} stroke="#ede9fe" strokeWidth="1" />)}
                                <line x1="0" x2={chartWidth} y1={gy(target)} y2={gy(target)} stroke="#7c3aed" strokeDasharray="5 4" strokeWidth="1.5" />
                                <polyline points={goalPoints} fill="none" stroke="#6d28d9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                {trendRows.map((row,index) => <g key={`${row.examId}-goal`}><circle cx={gx(index)} cy={gy(row.studentSuccess)} r="4.5" fill="#6d28d9"/><text x={gx(index)} y={gy(row.studentSuccess)-8} textAnchor="middle" fontSize="8" fontWeight="800" fill="#4c1d95">%{row.studentSuccess.toFixed(0)}</text><text x={gx(index)} y={goalHeight-8} textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b">{index+1}</text></g>)}
                              </svg>
                            </div>
                          </div>
                        </div>

                        <button type="button" onClick={() => setTrendCommentOpen((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-violet-300 bg-white px-4 py-3 text-left shadow-sm">
                          <span><strong className="block text-xs font-black text-violet-800">Yorum</strong><span className="mt-0.5 block text-[9px] font-bold text-slate-500">Ders gelişimini kısa yorumla</span></span><ChevronRight className={`h-4 w-4 text-violet-500 transition ${trendCommentOpen ? "rotate-90" : ""}`} />
                        </button>
                        {trendCommentOpen ? (() => {
                          const first = trendRows[0];
                          const change = first && last ? last.studentSuccess - first.studentSuccess : 0;
                          const schoolGap = last ? last.studentSuccess - last.schoolSuccess : 0;
                          const direction = change > 2 ? "yükselen" : change < -2 ? "düşen" : "dengeli";
                          const schoolText = schoolGap > 2 ? "Son sınavda okul ortalamasının üzerindesin." : schoolGap < -2 ? "Son sınavda okul ortalamasının altındasın." : "Son sınavda okul ortalamasına yakınsın.";
                          return <div className="rounded-2xl border border-violet-300 bg-violet-50 p-4 text-[11px] font-bold leading-5 text-slate-700"><strong className="text-violet-800">{selectedTrendSubject}</strong> dersindeki başarı eğilimin <strong>{direction}</strong>. {schoolText}</div>;
                        })() : null}
                            </div>
                          </section>

                          <section className="h-full min-w-full snap-start snap-always overflow-y-auto px-1">
                            <div className="space-y-3">
                              <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">2 / 3</span>
                                <h4 className="mt-1 text-lg font-black text-slate-900">{selectedTrendSubject} Kazanım Gelişimi</h4>
                                <p className="mt-1 text-[10px] font-bold leading-5 text-slate-500">
                                  Sınavlarda ölçülen kazanımların başarı düzeyleri birlikte değerlendirilir.
                                </p>
                              </div>

                              {outcomeRows.length > 0 ? (
                                <div className="space-y-2">
                                  {outcomeRows.map((row) => (
                                    <div key={row.name} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <strong className="block text-[11px] font-black leading-5 text-slate-800">{row.name}</strong>
                                          <span className="mt-1 block text-[9px] font-bold text-slate-500">
                                            {row.total} soru • {row.correct} doğru • {row.wrong} yanlış • {row.empty} boş
                                          </span>
                                        </div>
                                        <span className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black ${
                                          row.success >= 70 ? "bg-emerald-100 text-emerald-700" :
                                          row.success >= 50 ? "bg-amber-100 text-amber-700" :
                                          "bg-rose-100 text-rose-700"
                                        }`}>
                                          %{row.success.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                          className={`h-full rounded-full ${
                                            row.success >= 70 ? "bg-emerald-500" :
                                            row.success >= 50 ? "bg-amber-500" :
                                            "bg-rose-500"
                                          }`}
                                          style={{ width: `${Math.max(3, Math.min(100, row.success))}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                                  <p className="text-sm font-black text-slate-700">Kazanım verisi henüz bulunmuyor.</p>
                                  <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">
                                    Soru kayıtlarına kazanım bilgileri eklendikçe bu ekran otomatik oluşacaktır.
                                  </p>
                                </div>
                              )}
                            </div>
                          </section>

                          <section className="h-full min-w-full snap-start snap-always overflow-y-auto px-1">
                            <div className="space-y-3">
                              <div className="rounded-[24px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm">
                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">3 / 3</span>
                                <h4 className="mt-1 text-lg font-black text-slate-900">{selectedTrendSubject} Gelişim Önerileri</h4>
                                <p className="mt-1 text-[10px] font-bold leading-5 text-slate-500">
                                  Mevcut sınav performansına göre öncelikli çalışma alanları.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm">
                                  <span className="block text-[9px] font-black text-slate-500">Genel Eğilim</span>
                                  <strong className={`mt-1 block text-base font-black ${
                                    changeValue > 2 ? "text-emerald-600" : changeValue < -2 ? "text-rose-600" : "text-indigo-700"
                                  }`}>
                                    {changeValue > 2 ? "Yükseliyor" : changeValue < -2 ? "Düşüyor" : "Dengeli"}
                                  </strong>
                                  <span className="mt-1 block text-[9px] font-bold text-slate-400">
                                    {changeValue >= 0 ? "+" : ""}{changeValue.toFixed(1)} puan
                                  </span>
                                </div>
                                <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                                  <span className="block text-[9px] font-black text-slate-500">Son Başarı</span>
                                  <strong className="mt-1 block text-base font-black text-violet-700">%{last.studentSuccess.toFixed(1)}</strong>
                                  <span className="mt-1 block text-[9px] font-bold text-slate-400">{trendRows.length} sınav verisi</span>
                                </div>
                              </div>

                              {weakestOutcome ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                  <span className="text-[9px] font-black uppercase tracking-wide text-rose-600">Öncelikli Kazanım</span>
                                  <strong className="mt-1 block text-sm font-black leading-5 text-slate-900">{weakestOutcome.name}</strong>
                                  <p className="mt-2 text-[10px] font-bold leading-5 text-slate-600">
                                    Bu kazanımda başarı %{weakestOutcome.success.toFixed(0)}. Önce konu özeti, ardından temel ve orta düzey soru tekrarı önerilir.
                                  </p>
                                </div>
                              ) : null}

                              {strongestOutcome ? (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                  <span className="text-[9px] font-black uppercase tracking-wide text-emerald-600">Güçlü Alan</span>
                                  <strong className="mt-1 block text-sm font-black leading-5 text-slate-900">{strongestOutcome.name}</strong>
                                  <p className="mt-2 text-[10px] font-bold leading-5 text-slate-600">
                                    Bu kazanımda başarı %{strongestOutcome.success.toFixed(0)}. Seviyeyi korumak için aralıklı tekrar ve karma soru çözümü yeterlidir.
                                  </p>
                                </div>
                              ) : null}

                              <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                                <span className="text-[9px] font-black uppercase tracking-wide text-indigo-600">Çalışma Planı</span>
                                <div className="mt-3 space-y-2 text-[10px] font-bold leading-5 text-slate-700">
                                  <div className="rounded-xl bg-slate-50 px-3 py-2">1. En düşük başarıdaki kazanımdan başla.</div>
                                  <div className="rounded-xl bg-slate-50 px-3 py-2">2. Yanlış ve boş soruları yeniden çöz.</div>
                                  <div className="rounded-xl bg-slate-50 px-3 py-2">3. Bir sonraki denemede aynı kazanımın değişimini kontrol et.</div>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    );
                  })() : null}

                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (view === "radio") {
    return <SchoolRadioView onBack={() => goBackView()} />;
  }

  if (view === "trial-club") {
    return <TrialClubView onBack={() => goBackView()} token={token} mode="portal" />;
  }

  if (view === "survey") {
    return <MobileSurveyView onBack={() => goBackView()} apiBase={`/api/public-portal/${encodeURIComponent(token)}`} />;
  }

  if (view === "announcements") {
    const formatFeedDate = (value: string) => {
      if (!value) return "Tarih bilgisi yok";
      const direct = new Date(value);
      if (Number.isFinite(direct.getTime())) return direct.toLocaleDateString("tr-TR");
      return value;
    };
    const announcementCards = [
      ...announcements.map((announcement) => ({ kind: "exam" as const, id: `exam:${announcement.id}`, announcement })),
      ...generalAnnouncements.map((item) => ({ kind: "general" as const, id: item.id, item })),
    ];
    const visibleAnnouncementCards = selectedAnnouncementFeedId
      ? announcementCards.filter((entry) => entry.id === selectedAnnouncementFeedId)
      : announcementCards;
    const visibleNewsItems = selectedAnnouncementFeedId
      ? newsItems.filter((item) => item.id === selectedAnnouncementFeedId)
      : newsItems;
    const handleAnnouncementSwipeStart = (event: React.TouchEvent) => {
      announcementSwipeStartX.current = event.changedTouches[0]?.clientX ?? null;
    };
    const handleAnnouncementSwipeEnd = (event: React.TouchEvent) => {
      const startX = announcementSwipeStartX.current;
      const endX = event.changedTouches[0]?.clientX ?? null;
      announcementSwipeStartX.current = null;
      if (startX == null || endX == null) return;
      const delta = endX - startX;
      if (Math.abs(delta) < 45) return;
      setSelectedAnnouncementFeedId("");
      if (delta < 0) setAnnouncementTab("news");
      else setAnnouncementTab("announcements");
    };
    return (
      <main
        className="min-h-screen p-3 text-slate-800"
        style={{ background: "linear-gradient(180deg, #ecfeff 0%, #f8fafc 52%, #ffffff 100%)" }}
        onTouchStart={handleAnnouncementSwipeStart}
        onTouchEnd={handleAnnouncementSwipeEnd}
      >
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-cyan-200 bg-white shadow-xl">
          <header
            className="px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #0e7490 0%, #0284c7 55%, #4f46e5 100%)", color: "#ffffff" }}
          >
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => goBackView()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-label="Ana ekrana dön">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100">e-Nstitü</span>
                <h1 className="text-lg font-black leading-tight" style={{ color: "#ffffff" }}>{announcementTab === "announcements" ? "Duyurular" : "Haberler"}</h1>
              </div>
            </div>
          </header>


          <section className="space-y-2 p-3">
            {announcementTab === "announcements" ? (
              <>
                {announcementsError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{announcementsError}</div> : null}
                {announcementsLoading ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Duyurular yükleniyor…</div>
                ) : announcementCards.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-600">Duyuru bulunmuyor.</p>
                  </div>
                ) : visibleAnnouncementCards.map((entry) => {
                  const isOpen = selectedAnnouncementFeedId === entry.id;
                  if (entry.kind === "general") {
                    const item = entry.item;
                    return (
                      <article key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <button type="button" onClick={() => setSelectedAnnouncementFeedId(isOpen ? "" : entry.id)} className="w-full px-4 py-3 text-left">
                          <strong className="block text-sm font-black text-slate-900">{item.title || "Duyuru"}</strong>
                          <span className="mt-1 block text-[10px] font-bold text-slate-400">{formatFeedDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                        </button>
                        {isOpen ? <div className="border-t border-slate-100 px-4 py-4 text-xs font-semibold leading-5 text-slate-700 whitespace-pre-wrap">{item.content || "Duyuru detayı bulunmuyor."}</div> : null}
                      </article>
                    );
                  }
                  const announcement = entry.announcement;
                  return (
                    <article key={entry.id} className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
                      <button type="button" onClick={() => setSelectedAnnouncementFeedId(isOpen ? "" : entry.id)} className="w-full px-4 py-3 text-left">
                        <strong className="block text-sm font-black text-slate-900">Ortak sınav planı bilginiz</strong>
                        <span className="mt-1 block text-[10px] font-bold text-slate-400">{announcement.examDate ? formatDate(announcement.examDate) : announcement.date} · {announcement.examTime || "-"}</span>
                      </button>
                      {isOpen ? (
                        <div className="space-y-2 border-t border-cyan-100 p-4 text-[11px] font-bold text-slate-700">
                          <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[8px] uppercase text-slate-400">Sınav</span><strong className="mt-1 block text-slate-900">{announcement.courseName || "Sınav"}</strong></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[8px] uppercase text-slate-400">Sınav Salonu</span><strong className="mt-1 block text-slate-900">{announcement.roomName || "-"}</strong></div>
                            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[8px] uppercase text-slate-400">Sıra No</span><strong className="mt-1 block text-slate-900">{announcement.seatNumber || "-"}</strong></div>
                          </div>
                          {announcement.buildingName ? <div className="rounded-xl bg-slate-50 px-3 py-2">Bina / Kat: {[announcement.buildingName, announcement.floorName].filter(Boolean).join(" / ")}</div> : null}
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-800">Görevli Öğretmen: {announcement.supervisorName || "Belirlenmedi"}</div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </>
            ) : (
              newsItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-600">Haber bulunmuyor.</p>
                </div>
              ) : visibleNewsItems.map((item) => {
                const isOpen = selectedAnnouncementFeedId === item.id;
                return (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setSelectedAnnouncementFeedId(isOpen ? "" : item.id)} className="w-full px-4 py-3 text-left">
                      <strong className="block text-sm font-black text-slate-900">{item.title || "Haber"}</strong>
                      <span className="mt-1 block text-[10px] font-bold text-slate-400">{item.source ? `${item.source} · ` : ""}{formatFeedDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
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
        </div>
      </main>
    );
  }

  if (view === "messages") {
    const selectedMessage =
      messages.find((item) => item.id === selectedMessageId) || null;
    const unreadMessageCount = messages.filter((item) => !item.openedAt).length;

    return (
      <main
        className="min-h-screen bg-gradient-to-b from-violet-50 via-slate-50 to-white p-3 text-slate-800"
        onTouchStart={handlePortalMessageSwipeStart}
        onTouchEnd={handlePortalMessageSwipeEnd}
      >
        <div className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-violet-300 bg-white shadow-xl">
          <header className="bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 px-4 py-5 text-white">
            <button
              type="button"
              onClick={() => {
                goBackView();
                setSelectedMessageId("");
              }}
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"
              aria-label="Ana ekrana dön"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">
              e-Nstitü
            </span>
            <h1 className="mt-1 text-xl font-black">Mesajlar</h1>
            <p className="mt-1 text-xs font-semibold text-violet-100">
              {payload?.studentName || (kind === "parent" ? "Veli" : "Öğrenci")}
            </p>
          </header>

          <div className="grid grid-cols-2 gap-2 border-b border-violet-100 bg-violet-50/60 p-3">
            <button
              type="button"
              onClick={() => {
                setPortalMessageTab("inbox");
                setSelectedMessageId("");
                void loadMessages();
              }}
              className={`relative rounded-xl px-3 py-2.5 text-xs font-black ${
                portalMessageTab === "inbox"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Gelenler
              {unreadMessageCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMessageTab("sent");
                setSelectedMessageId("");
                void loadMessages();
              }}
              className={`rounded-xl px-3 py-2.5 text-xs font-black ${
                portalMessageTab === "sent"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Gönderilenler
            </button>
          </div>
          <div className="border-b border-slate-100 bg-white px-3 py-1.5 text-center text-[8px] font-bold text-slate-400">
            Sola kaydır: Gelenler · Sağa kaydır: Gönderilenler
          </div>

          <section className="p-4">
            {messagesError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {messagesError}
              </div>
            ) : null}

            {portalMessageTab === "inbox" ? (
              messagesLoading ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                  Mesajlar yükleniyor…
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <Mail className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-600">
                    Henüz gelen mesajınız yok.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const opened = Boolean(message.openedAt);
                    const expanded = selectedMessageId === message.id;
                    const eventTime = message.sentAt || message.createdAt;

                    return (
                      <article
                        key={message.receiptId}
                        className={`overflow-hidden rounded-2xl border ${
                          opened
                            ? "border-slate-200 bg-white"
                            : "border-violet-200 bg-violet-50/60"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void openMessage(message)}
                          className="flex w-full items-start gap-3 p-3 text-left"
                        >
                          <span
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              opened
                                ? "bg-slate-100 text-slate-500"
                                : "bg-violet-600 text-white"
                            }`}
                          >
                            {opened ? (
                              <MailOpen className="h-5 w-5" />
                            ) : (
                              <Mail className="h-5 w-5" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <strong className="block truncate text-[12px] font-black text-slate-900">
                                {message.title || "Bilgilendirme"}
                              </strong>
                              {!opened ? (
                                <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[8px] font-black text-white">
                                  YENİ
                                </span>
                              ) : null}
                            </span>

                            <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <UserRound className="h-3.5 w-3.5" />
                              Gönderen: {message.teacherName || "e-Nstitü"}
                            </span>

                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
                              <span>{formatDate(eventTime)}</span>
                              <span className="flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {formatTime(eventTime)}
                              </span>
                            </span>
                          </span>
                        </button>

                        {expanded ? (
                          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                {message.body}
                              </p>
                            </div>

                            {message.attachment?.id ? (
                              <a
                                href={`/api/message-attachments/${encodeURIComponent(message.attachment.id)}?token=${encodeURIComponent(token)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left transition active:scale-[0.99]"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                  <Download className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <strong className="block truncate text-[11px] font-black text-emerald-900">
                                    {message.attachment.name}
                                  </strong>
                                  <span className="mt-0.5 block text-[9px] font-bold text-emerald-700">
                                    DOSYAYI AÇ / İNDİR
                                    {message.attachment.size ? ` · ${(message.attachment.size / (1024 * 1024)).toFixed(message.attachment.size >= 1024 * 1024 ? 1 : 2)} MB` : ""}
                                  </span>
                                </span>
                              </a>
                            ) : null}

                            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-500">
                              <div className="rounded-xl bg-slate-50 p-2.5">
                                <span className="block text-[8px] uppercase text-slate-400">
                                  Gönderen
                                </span>
                                <strong className="mt-1 block text-slate-700">
                                  {message.teacherName || "e-Nstitü"}
                                </strong>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-2.5">
                                <span className="block text-[8px] uppercase text-slate-400">
                                  Tarih / Saat
                                </span>
                                <strong className="mt-1 block text-slate-700">
                                  {formatDate(eventTime)} · {formatTime(eventTime)}
                                </strong>
                              </div>
                            </div>

                            {message.teacherId && message.teacherId !== "desktop-app" ? (
                              <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
                                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.12em] text-violet-700">
                                  Yanıtla
                                </span>
                                <textarea
                                  value={portalReplyBody}
                                  onChange={(event) => setPortalReplyBody(event.target.value)}
                                  rows={3}
                                  placeholder="Mesajınızı yazınız…"
                                  className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                                />
                                <button
                                  type="button"
                                  disabled={portalReplyBusy || !portalReplyBody.trim()}
                                  onClick={() => void sendPortalReply(message)}
                                  className="mt-2 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                                >
                                  {portalReplyBusy ? "Gönderiliyor…" : "Yanıtı Gönder"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )
            ) : messagesLoading ? (
              <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                Gönderilenler yükleniyor…
              </div>
            ) : portalSentMessages.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                <MessageCircleMore className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-600">
                  Henüz gönderilmiş mesajınız yok.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {portalSentMessages.map((reply) => (
                  <article key={reply.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <MessageCircleMore className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-[12px] font-black text-slate-900">
                            Gönderilen Mesaj
                          </strong>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${
                            reply.openedAt
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {reply.openedAt ? "OKUNDU" : "BEKLİYOR"}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {reply.body}
                        </p>
                        <span className="mt-2 block text-[9px] font-bold text-slate-400">
                          {formatDate(reply.createdAt)} · {formatTime(reply.createdAt)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  const latestExamPhoto = studentExams
    .map((exam) => exam.student?.photoUrl)
    .find((value) => Boolean(value));
  const futureExams = studentExams
    .filter((exam) => {
      const time = new Date(exam.examDate || "").getTime();
      return Number.isFinite(time) && time > Date.now();
    })
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  const upcomingExam = futureExams[0] || null;
  const upcomingDays = upcomingExam
    ? Math.max(0, Math.ceil((new Date(upcomingExam.examDate).getTime() - Date.now()) / 86400000))
    : null;
  const messageBadgeCount = Number(notificationCounts.messages || 0);
  const studentInitials = String(payload?.studentName || "Öğrenci")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <>
      {openingReminderVisible && view === "home" && openingReminders.length > 0 ? (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Yaklaşan sınav hatırlatmaları">
          <section className="w-full max-w-md overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><div className="text-[10px] font-black uppercase tracking-widest text-rose-700">e-Nstitü</div><h2 className="text-lg font-black text-slate-950">Sınav Hatırlatmaları</h2></div>
              <button type="button" onClick={() => setOpeningReminderVisible(false)} aria-label="Hatırlatmaları kapat" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-800">Kapat</button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {openingReminders.map((item) => <div key={item.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3"><div className="text-sm font-black text-slate-900">{item.title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.detail}</div></div>)}
            </div>
          </section>
        </div>
      ) : null}
    <main className="min-h-screen bg-gradient-to-b from-[#f7f9ff] via-white to-[#f3f6fb] p-2 text-slate-800 sm:p-3">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-xl overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_22px_60px_rgba(30,41,59,0.12)] sm:min-h-[calc(100vh-1.5rem)]">
        <header className="relative border-b border-slate-100 bg-white px-3 pb-3 pt-3">
          <MobileIdentityBanner
            fullName={payload?.studentName || (loading ? "Bilgiler hazırlanıyor…" : kind === "parent" ? "Veli" : "Öğrenci")}
            roleLabel={kind === "parent" ? "Veli" : "Öğrenci"}
            meta={[payload?.classroom || "", payload?.studentNumber ? `Öğrenci No: ${payload.studentNumber}` : ""].filter(Boolean).join(" · ")}
            schoolName={payload?.schoolName || "Ordu Lisesi"}
            schoolLogoSrc={schoolLogo}
            photoSrc={latestExamPhoto}
            fallbackText={kind === "parent" ? "VL" : studentInitials}
            tone={kind === "parent" ? "parent" : "student"}
            onClick={() => setSettingsOpen(true)}
          />
        </header>

        <section className="p-3.5">
          {kind === "student" && !isStandalone && !appInstalledThisSession ? (
            <button
              type="button"
              onClick={() => void installStudentApp()}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-3 text-left shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md"><Download className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[11px] font-black text-slate-900">Öğrenci Uygulamasını Yükle</strong>
                <span className="mt-0.5 block text-[8px] font-bold leading-4 text-slate-500">Telefon ana ekranına ekleyin.</span>
              </span>
            </button>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-[10px] font-bold text-rose-700">{error}</div>
          ) : null}

          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
            {buttons.map(({ key, label, icon: Icon, count, future }: any, buttonIndex: number) => {
              const moduleDescriptions: Record<string, string> = {
                exams: "Sınav sonuçların ve akademik gelişimin",
                study: "Planını oluştur, hedefe odaklan",
                behavior: kind === "parent" ? "Öğrencinin davranış kayıtlarını görüntüle" : "Davranışlarını ve durumlarını gör",
                homework: kind === "parent" ? "Ödev ve kontrol durumunu görüntüle" : "Ödevlerini ve kontrol durumunu gör",
                schedule: "Derslerini ve saatlerini gör",
                announcements: "Sınav yer ve saat duyurularını gör",
                messages: "Okuldan gelen mesajları oku",
                radio: "Canlı okul yayınını ve podcastleri dinle",
                "trial-club": "Deneme tarihlerini, içerikleri ve hedef netlerini gör",
                survey: "Size tanımlanan anketleri görüntüle ve yanıtla",
                consents: "Veli izin ve onay belgelerini incele",
                yearbook: "Sınıf arkadaşların için yıllık düşüncelerini yaz",
                events: "Okul etkinliklerini takip et",
                resources: "Ders notları ve kaynaklara ulaş",
                targets: "Hedeflerini belirle ve takip et",
              };
              const handleClick = () => {
                if (future) return;
                if (key === "radio") { goToView("radio"); return; }
                if (key === "trial-club") { goToView("trial-club"); return; }
                if (key === "survey") { goToView("survey"); return; }
                if (key === "announcements") { void openAnnouncements(); return; }
                if (key === "messages") { void openMessages(); return; }
                if (key === "consents") { void openParentConsents(); return; }
                if (key === "yearbook") { void openYearbook(); return; }
                if (key === "behavior") { void openBehavior(); return; }
                if (key === "schedule") { void openStudentSchedule(); return; }
                if (key === "exams") { void openStudentExams(); return; }
                if (key === "homework") markModuleSeen(key);
                goToView(key as "homework" | "study");
              };

              const badge = future ? (
                <span className="rounded-full border border-white bg-white/95 px-1.5 py-0.5 text-[6px] font-black text-orange-600 shadow-sm">YENİ</span>
              ) : Number(count || 0) > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[7px] font-black text-white shadow-md">
                  {Number(count) > 99 ? "99+" : Number(count)}
                </span>
              ) : null;

              return (
                <EduPanelMobileButton
                  key={key}
                  title={label}
                  description={moduleDescriptions[key]}
                  icon={Icon}
                  accentIndex={buttonIndex}
                  disabled={Boolean(future)}
                  onClick={handleClick}
                  badge={badge}
                  variant="speech"
                />
              );
            })}
          </div>

          {(academicContradictionsLoading || academicContradictions.length > 0) ? (
            <section className="mt-4 overflow-hidden rounded-[22px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-[0_10px_24px_rgba(180,83,9,0.08)]">
              <div className="flex items-start gap-3 border-b border-amber-100 px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                    Akademik Çelişki Analizi
                  </div>
                  <h2 className="mt-0.5 text-[13px] font-black text-slate-950">
                    {kind === "parent" ? "Öğrencinin dikkat edilmesi gereken dersleri" : "Dikkat edilmesi gereken derslerin"}
                  </h2>
                  <p className="mt-1 text-[8.5px] font-semibold leading-4 text-slate-600">
                    Bu değerlendirme, öğrencinin yalnız kendi alanındaki derslerdeki tipik başarı düzeyinden beklenmeyen sapmaları gösterir. Başarısızlık etiketi değildir; gelişim için erken uyarıdır.
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-3">
                {academicContradictionsLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-4 text-[9px] font-bold text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analiz bilgileri yükleniyor…
                  </div>
                ) : (
                  academicContradictions.slice(0, 5).map((row) => {
                    const tone = row.severity === "sharp"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : row.severity === "clear"
                        ? "border-orange-200 bg-orange-50 text-orange-800"
                        : "border-amber-200 bg-amber-50 text-amber-800";
                    return (
                      <article key={row.id} className="rounded-2xl border border-white bg-white/90 p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[10px] font-black text-slate-950">{row.subject}</div>
                            <div className="mt-0.5 text-[7.5px] font-bold text-slate-500">
                              {row.examName} · {row.areaLabel || row.area}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-black ${tone}`}>
                            {row.severityLabel}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
                            <span className="block text-[6.5px] font-black uppercase text-slate-400">Alan Tipik</span>
                            <strong className="mt-0.5 block text-[12px] font-black text-slate-900">%{Number(row.typicalSuccess || 0).toFixed(1)}</strong>
                          </div>
                          <div className="rounded-xl bg-rose-50 px-2 py-2 text-center">
                            <span className="block text-[6.5px] font-black uppercase text-rose-500">{row.subject}</span>
                            <strong className="mt-0.5 block text-[12px] font-black text-rose-800">%{Number(row.targetSuccess || 0).toFixed(1)}</strong>
                          </div>
                          <div className="rounded-xl bg-indigo-50 px-2 py-2 text-center">
                            <span className="block text-[6.5px] font-black uppercase text-indigo-500">Kurum Ort.</span>
                            <strong className="mt-0.5 block text-[12px] font-black text-indigo-800">%{Number(row.institutionAverage || 0).toFixed(1)}</strong>
                          </div>
                        </div>
                        <p className="mt-2 text-[8px] font-semibold leading-4 text-slate-600">{row.explanation}</p>
                      </article>
                    );
                  })
                )}
                {!academicContradictionsLoading && academicContradictions.length > 5 ? (
                  <p className="px-1 text-center text-[7.5px] font-bold text-slate-500">
                    +{academicContradictions.length - 5} çelişki kaydı daha bulunuyor.
                  </p>
                ) : null}
                {!academicContradictionsLoading && academicContradictions.length > 0 ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[7.5px] font-bold leading-4 text-indigo-700">
                    Bu bilgi ilgili ders öğretmeniyle ve öğrencinin kayıtlı mentörü varsa mentörüyle de paylaşılır.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="mt-4 mt-3 overflow-hidden rounded-[22px] border border-indigo-100 bg-gradient-to-r from-[#eef3ff] via-white to-[#f4f1ff] p-3 shadow-[0_10px_24px_rgba(79,70,229,0.07)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><CalendarDays className="h-4 w-4" /></span>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-500">Yaklaşan Sınav</span>
                  <h2 className="mt-0.5 text-[13px] font-black text-slate-950">{upcomingExam?.examName || "Planlanan sınav yok"}</h2>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white/80 px-3 py-2 text-center shadow-sm">
                <span className="block text-[7px] font-black uppercase text-slate-400">Kalan Gün</span>
                <strong className="mt-0.5 block text-xl font-black leading-none text-indigo-700">{upcomingDays ?? "—"}</strong>
              </div>
            </div>
            {upcomingExam ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold text-slate-500">{formatDate(upcomingExam.examDate)}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {upcomingExam.subjects.slice(0, 4).map((subject) => (
                      <span key={subject.subjectName} className="rounded-xl border border-white bg-white/80 px-2 py-1 text-[7.5px] font-black text-slate-600 shadow-sm">{subject.subjectName}</span>
                    ))}
                  </div>
                </div>
                <Sparkles className="h-9 w-9 shrink-0 text-violet-400" />
              </div>
            ) : (
              <p className="mt-2 text-[8.5px] font-semibold leading-4 text-slate-500">Sınav takvimi yayınlandığında burada sınav adı ve kalan gün otomatik görünecek.</p>
            )}
          </div>

        </section>

        {settingsOpen ? (
          <div
            className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
            onClick={() => setSettingsOpen(false)}
          >
            <section
              className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600">
                    e-Nstitü
                  </span>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    Bildirim Ayarları
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                  aria-label="Ayarları kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    notificationSoundEnabled
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {notificationSoundEnabled ? (
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
                      Yeni davranış, ödev, sınav veya mesaj geldiğinde tek tip e-Nstitü sesi.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      notificationSoundEnabled
                        ? disableNotificationSound()
                        : void enableNotificationSound()
                    }
                    className={`min-w-[58px] rounded-full px-3 py-2 text-[9px] font-black ${
                      notificationSoundEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {notificationSoundEnabled ? "AÇIK" : "KAPALI"}
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    pushEnabled
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
                      {kind === "parent" ? "Uygulama kapalıyken veli mesajları telefon ekranına gelsin." : "Uygulama kapalıyken öğretmen mesajları telefon ekranına gelsin."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      pushEnabled
                        ? void disableStudentPush()
                        : void enableStudentPush()
                    }
                    className={`min-w-[58px] rounded-full px-3 py-2 text-[9px] font-black ${
                      pushEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {pushEnabled ? "AÇIK" : "KAPALI"}
                  </button>
                </div>

                {pushInfo ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold text-slate-500">
                    {pushInfo}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
    </>
  );
}
