import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { appModules } from "./app/moduleRegistry";
import { isStudentRegistrationRoute } from "./utils/studentRegistrationRoute";
import { Loader2, Menu, Sparkles } from "lucide-react";
import { AppErrorBoundary } from "./core/errors";
import { AccessDeniedState, ModuleLoadingState } from "./components/common";
import Sidebar from "./components/Sidebar";
const {
  Dashboard,
  HasatMissionControl,
  HasatOperationsCenter,
  HasatDigitalSchoolTwin,
  HasatGuidanceCenter,
  HasatDisciplineAnalytics,
  HasatLearningMap,
  HasatTeacherAnalytics,
  HasatInstitutionTrends,
  HasatBrain,
  HasatLive,
  HasatDecision,
  HasatAutonomous,
  HasatWorkflow,
  HasatInterventionInsights,
  HasatPredictiveAi,
  HasatAiCommander,
  Course: CourseModule,
  SchedulePlanner: SchedulePlannerModule,
  APanel: APanelModule,
  ScheduleRules: ScheduleRulesModule,
  Announcement: AnnouncementModule,
  Settings: SettingsModule,
  SchoolInfo: SchoolInfoModule,
  HumanResources: HumanResourcesModule,
  Committees: CommitteesModule,
  AcademicCalendar: AcademicCalendarModule,
  LocalDatabase: LocalDatabaseModule,
  Messages: MessagesModule,
  ExamPrepare: ExamPrepareModule,
  ExamAnalysis: ExamAnalysisModule,
  NetworkExamAnalytics: NetworkExamAnalyticsModule,
  GoogleForms: GoogleFormsModule,
  ExamTools: ExamToolsModule,
  MessageTools: MessageToolsModule,
  VoiceMessages: VoiceMessagesModule,
  ExamResultsWhatsAppModal,
  DutyInfo: DutyInfoModule,
  Behavior: BehaviorModule,
  Discipline: DisciplineModule,
  KelebekSystemA: KelebekSystemAModule,
  KelebekSystemB: KelebekSystemBModule,
  Classes: ClassesModule,
  TestExamPreparer,
  Survey: SurveyModule,
  LostDocuments: LostDocumentsModule,
  AttendanceSlip: AttendanceSlipModule,
  EducationCoach: EducationCoachModule,

} = appModules;

// Yalnızca özel URL modlarında veya giriş sonrasında kullanılan ekranları ilk bundle'dan ayır.
const QuestionPrepareModule = lazy(() => import("./components/QuestionPrepareModule"));
const SocialClubsActivitiesModule = lazy(() => import("./components/SocialClubsActivitiesModule"));
const ProductionAcceptanceCenter = lazy(() => import("./components/ProductionAcceptanceCenter"));
const GlobalRemindersOverlay = lazy(() => import("./components/GlobalRemindersOverlay"));
const TeacherCurriculumLinkView = lazy(() => import("./components/TeacherCurriculumLinkView"));
const TeacherBehaviorLinkView = lazy(() => import("./components/TeacherBehaviorLinkView"));
const TeacherInterfacesModule = lazy(() => import("./components/TeacherInterfacesModule"));
const ParentStudentPortalView = lazy(() => import("./components/ParentStudentPortalView"));
const EducationCoachStudentPortal = lazy(() => import("./components/EducationCoachStudentPortal"));
import PwaPortalStartupScreen from "./components/PwaPortalStartupScreen";
const ParentApprovalCenter = lazy(() => import("./components/ParentApprovalCenter"));
const ResponsibilityExamModule = lazy(() => import("./components/ResponsibilityExamModule"));
const ResponsibilityExamSeatingPlanModule = lazy(() => import("./components/ResponsibilityExamSeatingPlanModule"));
const YearbookAdmin = lazy(() => import("./components/YearbookAdmin"));
const MobileMessagesApp = lazy(() => import("./components/MobileMessagesApp"));
const MobileAttendanceScannerView = lazy(() => import("./components/MobileAttendanceScannerView"));
const PasswordResetView = lazy(() => import("./components/PasswordResetView"));
const StudentRegisterForm = lazy(() => import("./components/StudentRegisterForm"));
const LiveStudentReportView = lazy(() => import("./modules/reports").then(module => ({ default: module.LiveStudentReportView })));
import LoginPanel from "./components/LoginPanel";

import {
  initialStudents,

  initialTeachers,
  initialCourses,
  initialAnnouncements,
  initialDashboardStats,
} from "./data";
import { Student, Teacher, Course, Announcement, Classroom } from "./types";
import { reconcileGermanTeacherAssignments } from "./utils/courseTeacherReconciliation";
import { reconcileAcademicCatalogAssignments } from "./utils/academicCatalog";
import { sortClassrooms } from "./utils/classroomSort";
import { AccessControlState, isSchoolModuleEnabled, loadAccessState, PanelUser, saveAccessState } from "./lib/accessControl";
import {
  buildRoleDataScope,
  canAccessModuleTab,
  firebaseAuthSession,
  getCurrentSchoolMembership,
  hasCapability,
  localRoleToCloudRole,
  type CloudRole,
} from "./core/auth";
import { setActiveSchoolScope } from "./core/tenant";
import { getStudentNumber, normalizeStudentRows } from "./core/student";

import { sqliteStorage } from "./core/state/SyncStateStore";
import { runtimeSessionStorage } from "./lib/runtimeSessionStorage";
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const scheduleBackgroundWrite = (callback: () => void) => {
  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 1500 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 250);
  return () => window.clearTimeout(handle);
};

// Ağır ders programı verisi uygulama açılışında yüklenmez.
// Kullanıcı giriş yaptıktan ve akademik veriler hydrate edildikten sonra boş zamanda ön yüklenir.

const StandaloneLoading = () => (
  <div aria-hidden="true" className="h-screen w-screen bg-white" />
);

const withStandaloneSuspense = (content: React.ReactNode) => (
  <Suspense fallback={<StandaloneLoading />}>{content}</Suspense>
);

const withTeacherSuspense = (content: React.ReactNode) => (
  <Suspense fallback={<PwaPortalStartupScreen />}>{content}</Suspense>
);

type ModuleRenderGateProps = { render: () => React.ReactNode };
const ModuleRenderGate = ({ render }: ModuleRenderGateProps) => <>{render()}</>;

export default function App() {
  const [isRegistration, setIsRegistration] = useState(() => isStudentRegistrationRoute(window.location));
  useEffect(() => {
    const updateRoute = () => setIsRegistration(isStudentRegistrationRoute(window.location));
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);
  if (isRegistration) {
    return withStandaloneSuspense(<StudentRegisterForm />);
  }
  return <PanelApp />;
}

function PanelApp() {
  const isShortStudentReport=/^\/r\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}\/?$/i.test(window.location.pathname);
  const isPermanentStudentProfile=/^\/s\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}\/?$/i.test(window.location.pathname);
  const queryMode=new URLSearchParams(window.location.search).get("mode")||"";
  const standaloneFamilyLaunch =
    window.matchMedia?.("(display-mode: standalone)").matches === true &&
    Boolean(sqliteStorage.getItem("hasat_family_last_token"));

  // e-Nstitü AİLE never falls back to the administrator login screen.
  // Once a student's secure link has been opened on the device, the installed
  // PWA reuses that saved token and goes straight back to the family report.
  if (isPermanentStudentProfile || isShortStudentReport || ["live-report","family-report"].includes(queryMode) || standaloneFamilyLaunch) {
    return withStandaloneSuspense(<LiveStudentReportView />);
  }
  if (new URLSearchParams(window.location.search).get("mode") === "password-reset") {
    return withStandaloneSuspense(<PasswordResetView />);
  }
  if (new URLSearchParams(window.location.search).get("mode") === "mobile-messages") {
    return withStandaloneSuspense(<MobileMessagesApp />);
  }
  if (new URLSearchParams(window.location.search).get("mode") === "curriculum-link") {
    return withStandaloneSuspense(<TeacherCurriculumLinkView />);
  }
  const isEducationCoachStudent=/^\/koc\/[^/]+\/?$/i.test(window.location.pathname) || queryMode === "education-coach-student";
  if (isEducationCoachStudent) {
    return withStandaloneSuspense(<EducationCoachStudentPortal />);
  }
  const isParentStudentPortal=/^\/(?:veli|ogrenci)\/[^/]+\/?$/i.test(window.location.pathname);
  if (isParentStudentPortal) {
    return withStandaloneSuspense(<ParentStudentPortalView />);
  }
  const isPermanentTeacherBehavior=/^\/t\/[^/]+\/?$/i.test(window.location.pathname);
  if (isPermanentTeacherBehavior || new URLSearchParams(window.location.search).get("mode") === "behavior-link") {
    return withTeacherSuspense(<TeacherBehaviorLinkView />);
  }
  if (new URLSearchParams(window.location.search).get("mode") === "attendance-scan") {
    return withStandaloneSuspense(<MobileAttendanceScannerView />);
  }
  const [accessState, setAccessState] = useState<AccessControlState>(() => {
    const loaded = loadAccessState();
    const authenticatedId = runtimeSessionStorage.getItem("edupanel_auth_token")
      ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || ""
      : "";
    const loadedUser = loaded.users.find((user) => user.id === authenticatedId && user.status === "active");
    setActiveSchoolScope(
      loadedUser?.role === "super_admin"
        ? loaded.activeSchoolId || loaded.schools[0]?.id || "school-main"
        : loadedUser?.schoolId || loaded.activeSchoolId || "school-main",
    );
    return loaded;
  });
  const [authenticatedUserId, setAuthenticatedUserId] = useState(() => runtimeSessionStorage.getItem("edupanel_auth_token") ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || "" : "");
  const currentPanelUser = accessState.users.find((user) => user.id === authenticatedUserId && user.status === "active");
  const [effectiveCloudRole, setEffectiveCloudRole] = useState<CloudRole>(() => localRoleToCloudRole(currentPanelUser?.role));

  useEffect(() => {
    setActiveSchoolScope(
      currentPanelUser?.role === "super_admin"
        ? accessState.activeSchoolId || accessState.schools[0]?.id || "school-main"
        : currentPanelUser?.schoolId || accessState.activeSchoolId || "school-main",
    );
  }, [currentPanelUser?.id, currentPanelUser?.role, currentPanelUser?.schoolId, accessState.activeSchoolId, accessState.schools]);

  useEffect(() => {
    let active = true;
    const fallbackRole = localRoleToCloudRole(currentPanelUser?.role);
    setEffectiveCloudRole(fallbackRole);
    if (!currentPanelUser) return () => { active = false; };

    void getCurrentSchoolMembership(true)
      .then((membership) => {
        if (active && (!currentPanelUser.schoolId || membership.schoolId === currentPanelUser.schoolId)) {
          setEffectiveCloudRole(membership.role);
        }
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [currentPanelUser?.id, currentPanelUser?.role, currentPanelUser?.schoolId]);
  const handleLogin = (user: PanelUser, sessionToken: string, serverAccessState: AccessControlState) => {
    const next = {
      ...serverAccessState,
      currentUserId: user.id,
      activeSchoolId: user.role === "super_admin"
        ? serverAccessState.activeSchoolId || serverAccessState.schools[0]?.id || "school-main"
        : user.schoolId || serverAccessState.activeSchoolId || "school-main",
    };
    setActiveSchoolScope(next.activeSchoolId);
    runtimeSessionStorage.setItem("edupanel_auth_token", sessionToken);
    runtimeSessionStorage.setItem("edupanel_authenticated_user", user.id);
    saveAccessState(next);
    setAccessState(next);
    setAuthenticatedUserId(user.id);
  };
  const handleLogout = () => {
    const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
    if (sessionToken) void fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` } }).catch(() => null);
    void firebaseAuthSession.disconnect();
    runtimeSessionStorage.removeItem("edupanel_auth_token");
    runtimeSessionStorage.removeItem("edupanel_authenticated_user");
    setAuthenticatedUserId("");
    setActiveTab("dashboard");
  };

  useEffect(() => {
    const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
    if (!sessionToken) return;
    fetch("/api/auth/session", { cache: "no-store", headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Oturum doğrulanamadı.");
        const next = {
          ...data.accessState,
          currentUserId: data.user.id,
          activeSchoolId: data.user.role === "super_admin"
            ? data.accessState?.activeSchoolId || data.accessState?.schools?.[0]?.id || "school-main"
            : data.user.schoolId || data.accessState?.activeSchoolId || "school-main",
        } as AccessControlState;
        setActiveSchoolScope(next.activeSchoolId);
        sqliteStorage.setItem("edupanel_access_control_v1", JSON.stringify(next));
        setAccessState(next);
        setAuthenticatedUserId(data.user.id);
      })
      .catch(() => {
        runtimeSessionStorage.removeItem("edupanel_auth_token");
        runtimeSessionStorage.removeItem("edupanel_authenticated_user");
        setAuthenticatedUserId("");
      });
  }, []);

  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    sqliteStorage.setItem("hasat_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const refreshAccess = (event: Event) => {
      const next = (event as CustomEvent<AccessControlState>).detail || loadAccessState();
      setAccessState(next);
    };
    window.addEventListener("edupanel-access-changed", refreshAccess);
    return () => window.removeEventListener("edupanel-access-changed", refreshAccess);
  }, []);

  useEffect(() => {
    if (!currentPanelUser) setActiveTab("dashboard");
  }, [currentPanelUser]);
  const [behaviorInitialFilter, setBehaviorInitialFilter] = useState("All");
  const [disciplineInitialTab, setDisciplineInitialTab] = useState("Uyarı Bildirimi");
  const [whatsappExamContext,setWhatsappExamContext]=useState<{examId?:string;examName?:string;returnTab?:string;reportCategory?:"admin"|"teacher"|"student"}>({});
  const [examPrepareContext,setExamPrepareContext]=useState<{examId?:string}>({});
  const navigateFromExam=(tab:string,context?:{examId?:string;examName?:string;returnTab?:string;reportCategory?:"admin"|"teacher"|"student"})=>{
    if(tab==="whatsapp"&&context)setWhatsappExamContext(context);
    if(tab==="exam-prepare"&&context?.examId)setExamPrepareContext({examId:context.examId});
    setActiveTab(tab);
  };

  // Check if we are in Student Self Registration Mode via QR scan or URL param

  useEffect(() => {
    const handleUrlCheck = () => {
      const searchParams = new URLSearchParams(window.location.search);
      
      if (searchParams.get("teacher") || searchParams.get("addRecord")) {
        setActiveTab("behavior");
      }
    };
    handleUrlCheck();
    window.addEventListener("hashchange", handleUrlCheck);
    return () => window.removeEventListener("hashchange", handleUrlCheck);
  }, []);

  const [isDbLoading, setIsDbLoading] = useState(true);
  const [students, rawSetStudents] = useState<Student[]>(() => normalizeStudentRows(initialStudents));
  // Öğrenci numarası uygulamanın eski ekranlarında `id`, yeni ekranlarında
  // `number` / `studentNumber` alanlarından okunabiliyor. State'e giren her kaydı
  // tek biçime çevirerek tüm modüllerde aynı okul numarasının görünmesini sağla.
  const setStudents = useCallback<React.Dispatch<React.SetStateAction<Student[]>>>((update) => {
    rawSetStudents((previous) => {
      const next = typeof update === "function"
        ? (update as (prevState: Student[]) => Student[])(previous)
        : update;
      return normalizeStudentRows(next);
    });
  }, []);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [classrooms, rawSetClassrooms] = useState<Classroom[]>([]);
  const roleDataScope = useMemo(() => buildRoleDataScope({
    user: currentPanelUser,
    role: effectiveCloudRole,
    students,
    teachers,
    courses,
    classrooms,
  }), [currentPanelUser, effectiveCloudRole, students, teachers, courses, classrooms]);
  const [customCreatedCourses, setCustomCreatedCourses] = useState<any[]>([]);
  const academicRecoveryCompletedRef = useRef(false);
  const hydratedFromSqliteRef = useRef(false);
  const skippedInitialStudentWriteRef = useRef(false);
  const skippedInitialTeacherWriteRef = useRef(false);
  const skippedInitialCatalogWriteRef = useRef(false);

  const setClassrooms = (
    val: Classroom[] | ((prev: Classroom[]) => Classroom[])
  ) => {
    rawSetClassrooms((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      return sortClassrooms(next.map((cls) => {
        const is11A =
          cls &&
          cls.name &&
          (cls.name.trim() === "11-A" ||
            cls.name.trim() === "11 A" ||
            cls.name.trim() === "11A");
        if (is11A && cls.assignedCourses) {
          return {
            ...cls,
            assignedCourses: cls.assignedCourses.filter((ac) => {
              if (!ac || !ac.courseName) return true;
              const lowerName = ac.courseName.toLowerCase();
              return (
                !lowerName.includes("seçmeli ingilizce") &&
                !lowerName.includes("s. ingilizce")
              );
            }),
          };
        }
        return cls;
      }));
    });
  };

  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [stats, setStats] = useState(initialDashboardStats);

  // SQLite veritabanından yükle; ilk geçişte tarayıcı kayıtlarını koru.
  // Login ekranında ağır DB/localforage işleri başlatılmaz; kullanıcı doğrulandıktan sonra çalışır.
  useEffect(() => {
    if (!authenticatedUserId) return;

    let cancelled = false;
    setIsDbLoading(true);
    async function initDB() {
      try {
        const { migrateLegacyDomainDataToUnifiedLocalDatabase } = await import("./lib/unifiedLocalDatabase");
        await migrateLegacyDomainDataToUnifiedLocalDatabase().catch((error) =>
          console.warn("Eski tarayıcı verileri SQLite migration uyarısı:", error),
        );
        const lf = (await import("./core/state/AppStateService")).default;

        // 2026-07-07 yedek dosyasındaki gerçek okul verilerini ilk açılışta sisteme yükle.
        // Böylece Öğretmenler, Öğrenciler, Sınıflar ve Dersler modülleri boş gelmez.
        const backupSeedVersion = "backup_seed_20260707_v1";
        const backupSeedRequested = sqliteStorage.getItem(backupSeedVersion) !== "true";
        let hasPersistedAcademicData = false;

        if (backupSeedRequested) {
          try {
            const { fetchAcademicCatalogFromLocalDatabase } = await import("./core/data/LegacyDatabaseFacade");
            const existingCatalog = await fetchAcademicCatalogFromLocalDatabase();
            hasPersistedAcademicData =
              existingCatalog.classrooms.length > 0 ||
              existingCatalog.courses.length > 0 ||
              existingCatalog.customCreatedCourses.length > 0;
          } catch {
            const cachedClassrooms = await lf.getItem("school_classrooms");
            const cachedCourses = await lf.getItem("school_courses");
            hasPersistedAcademicData =
              (Array.isArray(cachedClassrooms) && cachedClassrooms.length > 0) ||
              (Array.isArray(cachedCourses) && cachedCourses.length > 0);
          }
        }

        const shouldApplyBackupSeed = backupSeedRequested && !hasPersistedAcademicData;
        if (backupSeedRequested && hasPersistedAcademicData) {
          try { sqliteStorage.setItem(backupSeedVersion, "true"); } catch { /* Veriler yine de korunur. */ }
        }

        if (shouldApplyBackupSeed) {
          // 250+ KB'lık seed verisini yalnızca gerçekten ilk kurulum gerekiyorsa yükle.
          const { default: backupSeed } = await import("./seed/backupSeed");
          if (cancelled) return;
          const seededStudents = [...((backupSeed as any).school_students || [])] as Student[];
          const seededTeachers = [...((backupSeed as any).school_teachers || [])] as Teacher[];
          const seededClassrooms = [...((backupSeed as any).school_classrooms || [])] as Classroom[];
          const seededCourses = [...((backupSeed as any).school_courses || [])] as Course[];
          const seededCustomCourses = [...((backupSeed as any).custom_created_courses || [])];

          setStudents(seededStudents);
          setTeachers(seededTeachers);
          setClassrooms(seededClassrooms);
          setCourses(seededCourses);
          setCustomCreatedCourses(seededCustomCourses);

          await lf.setItem("school_students", seededStudents);
          await lf.setItem("school_teachers", seededTeachers);
          await lf.setItem("school_classrooms", seededClassrooms);
          await lf.setItem("school_courses", seededCourses);
          await lf.setItem("custom_created_courses", seededCustomCourses);

          const backupLocalStorageKeys = [
            "school_students",
            "school_teachers",
            "school_classrooms",
            "school_courses",
            "custom_created_courses",
            "school_timetable",
            "school_timetable_by_day",
            "school_info_a_profile",
            "schoolName",
            "selected_electives_pool",
            "custom_electives_pool",
            "school_timeline",
            "school_weekly_schedule_v2",
            "curriculum_schedule_matrix",
            "curriculum_passive_cells",
            "teacher_passive_slots_v2",
            "curriculum_teacher_off_days",
            "curriculum_avoid_gaps",
            "curriculum_prioritize_blocks",
            "curriculum_max_hours_per_day",
            "curriculum_selected_engine_algo",
          ];

          backupLocalStorageKeys.forEach((key) => {
            const value = (backupSeed as any)[key];
            if (value !== undefined) {
              try {
                sqliteStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
              } catch (e) {
                console.warn(`Yedek veri sqliteStorage'a yazılamadı: ${key}`, e);
              }
            }
          });

          try {
            sqliteStorage.setItem("teachers_cleared_v4", "true");
            sqliteStorage.setItem("courses_cleared_v1", "true");
            sqliteStorage.setItem("classrooms_cleared_v1", "true");
            sqliteStorage.setItem(backupSeedVersion, "true");
          } catch (e) {
            console.warn("Yedek veri işaretleyici yazılamadı", e);
          }

          setStats((prev) => ({
            ...prev,
            totalStudents: seededStudents.length,
            activeStudents: seededStudents.filter((s: any) => !s.status || s.status === "Aktif").length || seededStudents.length,
            totalTeachers: seededTeachers.length,
            totalClasses: seededClassrooms.length,
          }));

          setIsDbLoading(false);
          return;
        }

        // Önce bilgisayardaki SQLite veritabanından getir.
        let fsStudents: any[] = [];
        let fsTeachers: any[] = [];
        let fsCourses: any[] = [];
        let fsClassrooms: any[] = [];
        let fsCustomCourses: any[] = [];
        let fsAcademicCatalogLoaded = false;

        try {
          const { fetchAcademicCatalogFromLocalDatabase, fetchCollectionFromLocalDatabase, syncCollectionToLocalDatabase } = await import("./core/data/LegacyDatabaseFacade");
          const [academicCatalog, databaseStudents, legacyDatabaseStudents, databaseTeachers] = await Promise.all([
            fetchAcademicCatalogFromLocalDatabase(),
            fetchCollectionFromLocalDatabase("students"),
            fetchCollectionFromLocalDatabase("school_students").catch(() => []),
            fetchCollectionFromLocalDatabase("teachers"),
          ]);
          const normalizeAcademicGroup = (value: unknown) => {
            const original = String(value ?? "").trim();
            const normalized = original.toLocaleUpperCase("tr-TR");
            if (normalized === "SAY" || normalized === "SAYISAL") return "SAY";
            if (normalized === "EA" || normalized === "EŞİT AĞIRLIK" || normalized === "ESIT AGIRLIK") return "EA";
            if (normalized === "SÖZ" || normalized === "SÖZEL" || normalized === "SOZ" || normalized === "SOZEL") return "SÖZ";
            if (normalized === "DİL" || normalized === "DIL") return "DİL";
            return original;
          };
          const readStudentAcademicGroup = (student: any) => normalizeAcademicGroup(
            student?.group ?? student?.alan ?? student?.area ?? student?.field ?? student?.bolum ?? student?.bölüm ?? student?.program,
          );
          const studentIdentity = (student: any) => {
            // Eski `school_students` kayıtlarında id okul numarası, yeni `students`
            // kayıtlarında ise belge/UUID olabiliyor. Alan bilgisini aynı öğrenciye
            // geri bağlayabilmek için önce gerçek okul numarasını kullan.
            const number = getStudentNumber(student);
            if (number) return `number:${number}`;
            const id = String(student?.id ?? student?.__documentId ?? "").trim();
            if (id) return `id:${id}`;
            const classroom = String(student?.classroom ?? "").trim().toLocaleLowerCase("tr-TR");
            return `name:${String(student?.name ?? "").trim().toLocaleLowerCase("tr-TR")}:${classroom}`;
          };
          const mergedStudents = new Map<string, any>();
          for (const student of Array.isArray(legacyDatabaseStudents) ? legacyDatabaseStudents : []) {
            if (student && (student.id || student.name || student.studentNumber || student.number)) {
              mergedStudents.set(studentIdentity(student), student);
            }
          }
          let recoveredStudentArea = false;
          for (const student of Array.isArray(databaseStudents) ? databaseStudents : []) {
            if (student && (student.id || student.name || student.studentNumber || student.number)) {
              const key = studentIdentity(student);
              const legacyStudent = mergedStudents.get(key);
              const currentGroup = readStudentAcademicGroup(student);
              const legacyGroup = readStudentAcademicGroup(legacyStudent);
              const recoveredGroup = currentGroup || legacyGroup;
              if (!currentGroup && recoveredGroup) recoveredStudentArea = true;
              // Yeni `students` kaydı önceliklidir; yalnız kaybolmuş alan/grup bilgisi
              // eski `school_students` kaydından geri tamamlanır.
              mergedStudents.set(key, recoveredGroup ? { ...student, group: recoveredGroup } : student);
            }
          }
          fsStudents = Array.from(mergedStudents.values());
          fsTeachers = databaseTeachers;
          // Classrooms and courses are master academic data. Their existence must never
          // depend on whether students are currently enrolled in that grade.
          // Previously grade-9 classrooms/courses were filtered out when no grade-9
          // student record existed, which caused the Sınıf / Ders / Öğretmen view to
          // lose 9th-grade classes and could later persist that loss back to SQLite.
          fsCourses = Array.isArray(academicCatalog.courses) ? academicCatalog.courses : [];
          fsClassrooms = Array.isArray(academicCatalog.classrooms) ? academicCatalog.classrooms : [];

          // Legacy kayıtta da alan yoksa sınıf içi SAY/EA/SÖZ/DİL dağılımından geri kur.
          // Bu yalnızca group alanı boş öğrencileri tamamlar; mevcut alan bilgisine dokunmaz.
          const classroomGroupByStudent = new Map<string, string>();
          for (const classroom of fsClassrooms) {
            const groupMap = !Array.isArray(classroom?.groupStudentIds) && classroom?.groupStudentIds
              ? classroom.groupStudentIds as Record<string, string[]>
              : {};
            for (const [groupName, ids] of Object.entries(groupMap)) {
              const group = normalizeAcademicGroup(groupName);
              if (!group || !Array.isArray(ids)) continue;
              for (const studentId of ids) {
                const key = String(studentId ?? "").trim();
                if (key) classroomGroupByStudent.set(key, group);
              }
            }
          }
          fsStudents = fsStudents.map((student) => {
            if (readStudentAcademicGroup(student)) return student;
            const candidates = [
              getStudentNumber(student),
              String(student?.id ?? "").trim(),
              String(student?.studentId ?? "").trim(),
            ].filter(Boolean);
            const recoveredGroup = candidates.map((key) => classroomGroupByStudent.get(key)).find(Boolean) || "";
            if (!recoveredGroup) return student;
            recoveredStudentArea = true;
            return { ...student, group: recoveredGroup };
          });

          if (fsStudents.length > databaseStudents.length || recoveredStudentArea) {
            // Kurtarılan alan bilgisini canonical koleksiyona geri yaz ki sonraki
            // açılışlarda tekrar kaybolmasın.
            await syncCollectionToLocalDatabase("students", fsStudents);
          }

          fsCustomCourses = academicCatalog.customCreatedCourses;
          fsAcademicCatalogLoaded = true;
          hydratedFromSqliteRef.current = true;
        } catch (err) {
          console.error("SQLite verileri yüklenemedi; tarayıcı yedeği kullanılacak:", err);
        }

        // Students
        if (fsStudents && fsStudents.length > 0) {
          setStudents(fsStudents);
          // Legacy kopyayı silme: kurtarma tamamlanana kadar geri dönüş kaynağı olarak
          // koru ve güncel birleşik listeyi AppState önbelleğine yaz.
          await lf.setItem("school_students", fsStudents);
        } else {
          const lfStudents = await lf.getItem("school_students");
          const cachedStudents = Array.isArray(lfStudents)
            ? (lfStudents as Student[]).filter((student) => student && (student.id || student.name || student.studentNumber || student.number))
            : [];
          if (cachedStudents.length > 0) {
            setStudents(cachedStudents);
          } else {
            // AppState boş bir dizi döndürebilir; bu gerçek bir "tüm öğrenciler silindi"
            // kaydı değildir. Bu durumda uyumlu school_students kaynağını mutlaka kontrol et.
            const lsStudents = sqliteStorage.getItem("school_students");
            if (lsStudents) {
              try {
                const parsed = JSON.parse(lsStudents);
                const legacyStudents = Array.isArray(parsed)
                  ? (parsed as Student[]).filter((student) => student && (student.id || student.name || student.studentNumber || student.number))
                  : [];
                if (legacyStudents.length > 0) {
                  setStudents(legacyStudents);
                  await lf.setItem("school_students", legacyStudents);
                }
              } catch (error) {
                console.warn("Eski öğrenci kayıtları okunamadı; mevcut ekran verisi korunuyor:", error);
              }
            }
          }
        }

        // Teachers
        if (fsTeachers && fsTeachers.length > 0) {
          setTeachers(fsTeachers);
          await lf.setItem("school_teachers", fsTeachers);
        } else {
          const lfTeachers = await lf.getItem("school_teachers");
          const cachedTeachers = Array.isArray(lfTeachers)
            ? (lfTeachers as Teacher[]).filter((teacher) => teacher && (teacher.id || teacher.name))
            : [];
          if (cachedTeachers.length > 0) {
            setTeachers(cachedTeachers);
          } else {
            // AppState boş bir dizi döndürebilir; bu gerçek bir "tüm öğretmenler silindi"
            // kaydı değildir. Bu durumda uyumlu school_teachers kaynağını mutlaka kontrol et.
            const lsTeachers = sqliteStorage.getItem("school_teachers");
            if (lsTeachers) {
              try {
                const parsed = JSON.parse(lsTeachers);
                const legacyTeachers = Array.isArray(parsed)
                  ? (parsed as Teacher[]).filter((teacher) => teacher && (teacher.id || teacher.name))
                  : [];
                if (legacyTeachers.length > 0) {
                  setTeachers(legacyTeachers);
                  await lf.setItem("school_teachers", legacyTeachers);
                }
              } catch (error) {
                console.warn("Eski öğretmen kayıtları okunamadı; mevcut ekran verisi korunuyor:", error);
              }
            }
          }
        }

        // Courses
        if (fsAcademicCatalogLoaded) {
          setCourses(fsCourses);
          await lf.setItem("school_courses", fsCourses);
        } else {
          const lfCourses = await lf.getItem("school_courses");
          if (lfCourses) {
            setCourses(lfCourses as Course[]);
          } else {
            const cleared = sqliteStorage.getItem("courses_cleared_v1");
            if (!cleared) {
              setCourses([]);
              try { sqliteStorage.setItem("courses_cleared_v1", "true"); } catch (e) {}
            } else {
              const lsCourses = sqliteStorage.getItem("school_courses");
              if (lsCourses) {
                const parsed = JSON.parse(lsCourses);
                setCourses(parsed);
                await lf.setItem("school_courses", parsed);
              }
            }
          }
        }

        // Classrooms
        if (fsAcademicCatalogLoaded) {
          setClassrooms(fsClassrooms);
          await lf.setItem("school_classrooms", fsClassrooms);
        } else {
          const lfClassrooms = await lf.getItem("school_classrooms");
          if (lfClassrooms) {
            setClassrooms(lfClassrooms as Classroom[]);
          } else {
            const cleared = sqliteStorage.getItem("classrooms_cleared_v1");
            if (!cleared) {
              setClassrooms([]);
              try { sqliteStorage.setItem("classrooms_cleared_v1", "true"); } catch (e) {}
            } else {
              const lsClassrooms = sqliteStorage.getItem("school_classrooms");
              if (lsClassrooms) {
                const parsed = JSON.parse(lsClassrooms);
                setClassrooms(parsed);
                await lf.setItem("school_classrooms", parsed);
              }
            }
          }
        }

        // Announcements — kalıcı kaynak yalnızca yerel SQLite.
        try {
          const { fetchCollectionFromLocalDatabase } = await import("./core/data/LegacyDatabaseFacade");
          const databaseAnnouncements = await fetchCollectionFromLocalDatabase("announcements");
          if (Array.isArray(databaseAnnouncements) && databaseAnnouncements.length > 0) {
            setAnnouncements(databaseAnnouncements as Announcement[]);
          } else {
            // Sadece ilk migration/kurtarma için eski tarayıcı kopyasını oku.
            const legacyAnnouncements = await lf.getItem("school_announcements");
            if (Array.isArray(legacyAnnouncements) && legacyAnnouncements.length > 0) {
              setAnnouncements(legacyAnnouncements as Announcement[]);
            }
          }
        } catch (error) {
          console.warn("Duyurular SQLite'tan yüklenemedi; legacy cache deneniyor:", error);
          const legacyAnnouncements = await lf.getItem("school_announcements");
          if (Array.isArray(legacyAnnouncements)) setAnnouncements(legacyAnnouncements as Announcement[]);
        }

        // Custom Created Courses
        if (fsAcademicCatalogLoaded) {
          setCustomCreatedCourses(fsCustomCourses);
          await lf.setItem("custom_created_courses", fsCustomCourses);
        } else {
          const lfCustomCourses = await lf.getItem("custom_created_courses");
          if (lfCustomCourses) {
            setCustomCreatedCourses(lfCustomCourses as any[]);
          } else {
            const lsCustomCourses = sqliteStorage.getItem("custom_created_courses");
            if (lsCustomCourses) {
              const parsed = JSON.parse(lsCustomCourses);
              setCustomCreatedCourses(parsed);
              await lf.setItem("custom_created_courses", parsed);
            }
          }
        }
      } catch (e) {
        console.error("DB Init Error:", e);
      } finally {
        if (!cancelled) setIsDbLoading(false);
      }
    }
    initDB();
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId]);

  // Ders programı büyük ders programı kaydını login/DB başlangıcıyla yarıştırma.
  // Ana ekran hazır olduktan sonra tarayıcının boş zamanında yükle; Schedule modülü açıldığında veri hazır olur.
  useEffect(() => {
    if (!authenticatedUserId || isDbLoading) return;

    let cancelled = false;
    const cancelScheduledLoad = scheduleBackgroundWrite(() => {
      Promise.all([
        import("./services/schedule/schedulePersistenceCache"),
        import("./stores/scheduleStore"),
      ])
        .then(async ([{ preloadScheduleData }, { useScheduleStore }]) => {
          const saved = await preloadScheduleData();
          if (cancelled || Object.keys(saved).length === 0) return;
          const store = useScheduleStore.getState();
          if (Object.keys(store.scheduleData).length === 0) {
            store.setScheduleData(saved, { skipHistory: true });
          }
        })
        .catch((error) => console.warn("Ders programı boş-zaman ön yüklemesi başarısız:", error));
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, [authenticatedUserId, isDbLoading]);

  // Değişiklikleri SQLite'a yaz; kalıcı domain verilerinin tek kaynağı yerel SQLite veritabanıdır.
  useEffect(() => {
    if (isDbLoading) return;
    if (hydratedFromSqliteRef.current && !skippedInitialStudentWriteRef.current) {
      skippedInitialStudentWriteRef.current = true;
      return;
    }
    return scheduleBackgroundWrite(() => {
      import("./core/data/LegacyDatabaseFacade").then(({ syncCollectionToLocalDatabase }) => {
        syncCollectionToLocalDatabase("students", students).catch(e => console.error(e));
      });
    });
  }, [students, isDbLoading]);

  useEffect(() => {
    if (isDbLoading) return;
    if (hydratedFromSqliteRef.current && !skippedInitialTeacherWriteRef.current) {
      skippedInitialTeacherWriteRef.current = true;
      return;
    }
    return scheduleBackgroundWrite(() => {
      import("./core/data/LegacyDatabaseFacade").then(({ syncCollectionToLocalDatabase }) => {
        syncCollectionToLocalDatabase("teachers", teachers).catch(e => console.error(e));
      });
    });
  }, [teachers, isDbLoading]);

  useEffect(() => {
    if (isDbLoading) return;
    // Courses, classrooms ve customCreatedCourses aşağıdaki atomik
    // syncAcademicCatalogToLocalDatabase effect'i ile tek SQLite işleminde yazılır.
    return;

  }, [courses, isDbLoading]);

  useEffect(() => {
    if (isDbLoading) return;
    // Sınıflar akademik katalog ile atomik olarak SQLite'a yazılır.
    return;

  }, [classrooms, isDbLoading]);

  // Sınıf dersleri ana kayıttır. Eski courses kayıtlarında kalmış öğretmenleri
  // kurtar, Almanca eşleştirmesini uygula ve türetilen ders listesini eşitle.
  useEffect(() => {
    if (isDbLoading || classrooms.length === 0) return;

    const shouldRecoverLegacyAssignments = !academicRecoveryCompletedRef.current;
    const recovered = reconcileAcademicCatalogAssignments(classrooms, courses, {
      recoverLegacyAssignments: shouldRecoverLegacyAssignments,
      customCreatedCourses,
    });
    const germanReconciled = shouldRecoverLegacyAssignments
      ? reconcileGermanTeacherAssignments(recovered.classrooms, recovered.courses, teachers)
      : { classrooms: recovered.classrooms, courses: recovered.courses, changed: false };
    const canonical = reconcileAcademicCatalogAssignments(
      germanReconciled.classrooms,
      germanReconciled.courses,
      { recoverLegacyAssignments: false, customCreatedCourses },
    );
    academicRecoveryCompletedRef.current = true;
    if (!recovered.changed && !germanReconciled.changed && !canonical.changed) return;

    rawSetClassrooms(sortClassrooms(canonical.classrooms));
    setCourses(canonical.courses);
  }, [classrooms, courses, teachers, customCreatedCourses, isDbLoading]);

  useEffect(() => {
    if (isDbLoading) return;
    // Özel oluşturulan dersler akademik katalog ile atomik olarak SQLite'a yazılır.
    return;

  }, [customCreatedCourses, isDbLoading]);

  // Akademik katalog tek istek ve tek SQLite işlemiyle kaydedilir. İstemci
  // kuyruğu hızlı değişikliklerde eski isteğin yeni veriyi ezmesini engeller.
  useEffect(() => {
    if (isDbLoading) return;
    if (hydratedFromSqliteRef.current && !skippedInitialCatalogWriteRef.current) {
      skippedInitialCatalogWriteRef.current = true;
      return;
    }
    return scheduleBackgroundWrite(() => {
      import("./core/data/LegacyDatabaseFacade").then(({ syncAcademicCatalogToLocalDatabase }) => {
        syncAcademicCatalogToLocalDatabase({ classrooms, courses, customCreatedCourses })
          .catch(e => console.error(e));
      });
    });
  }, [classrooms, courses, customCreatedCourses, isDbLoading]);

  useEffect(() => {
    if (isDbLoading) return;
    return scheduleBackgroundWrite(() => {
      import("./core/data/LegacyDatabaseFacade").then(({ syncCollectionToLocalDatabase }) => {
        syncCollectionToLocalDatabase("announcements", announcements).catch(e => console.error(e));
      });
    });
  }, [announcements, isDbLoading]);

  useEffect(() => {
    // Migration: ensure all class names and student classrooms have hyphens (e.g. 12 - A)
    // Also format the existing data and sort teachers and classes
    const migratedStr = sqliteStorage.getItem("migrated_hyphens_v3");
    if (!migratedStr) {
      setClassrooms(prev => {
        const mapped = prev.map(c => {
          let newName = c.name.replace(/^-\s*/, "").replace(/(\d+)\s*-?\s*([A-Za-z]+)/g, "$1 - $2").replace(/\s*-\s*/g, " - ");
          return { ...c, name: newName };
        });
        return mapped.sort((a, b) => {
          const getGradeLevel = (lvl: string) => {
            const match = lvl.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 99;
          };
          const levelA = getGradeLevel(a.level);
          const levelB = getGradeLevel(b.level);
          if (levelA !== levelB) return levelA - levelB;
          return a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" });
        });
      });
      setStudents(prev => prev.map(s => {
        if (!s.classroom) return s;
        let newClassroom = s.classroom.replace(/^-\s*/, "").replace(/(\d+)\s*-?\s*([A-Za-z]+)/g, "$1 - $2").replace(/\s*-\s*/g, " - ");
        return { ...s, classroom: newClassroom };
      }));
      setCourses(prev => prev.map(c => {
         if (!c.classroom) return c;
         let newClassroom = c.classroom.replace(/^-\s*/, "").replace(/(\d+)\s*-?\s*([A-Za-z]+)/g, "$1 - $2").replace(/\s*-\s*/g, " - ");
         return { ...c, classroom: newClassroom };
      }));
      setTeachers(prev => {
        return [...prev].sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" }));
      });
      try { sqliteStorage.setItem("migrated_hyphens_v3", "true"); } catch (e) {}
    }

    // Forcefully remove old distribution plans and slot statuses to start completely clean!
    const hddCleared = sqliteStorage.getItem("hdd_plan_cleared_v10");
    if (!hddCleared) {
      sqliteStorage.removeItem("hdd_schedule_data");
      sqliteStorage.removeItem("hdd_slot_status");
      try { sqliteStorage.setItem("hdd_plan_cleared_v10", "true"); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    // Migration: Remove METİN TAHLİLLERİ and SEÇMELİ İKİNCİ YABANCI DİL from 10th grade compulsory/common courses if present
    const migratedCompulsory10 = sqliteStorage.getItem("migrated_compulsory_10_v2");
    if (!migratedCompulsory10) {
      setClassrooms(prev => {
        return prev.map(c => {
          if (c.level === "10. Sınıf") {
            const filteredAssigned = (c.assignedCourses || []).filter(ac => {
              if (!ac || !ac.courseName) return false;
              const nameLower = ac.courseName.toUpperCase()
                .replace(/I/g, "I")
                .replace(/ı/g, "I")
                .replace(/İ/g, "I");
              
              const isTargetDeleted = 
                nameLower.includes("METIN TAHLIL") || 
                nameLower.includes("IKINCI YABANCI");
              return !isTargetDeleted;
            });
            return { ...c, assignedCourses: filteredAssigned };
          }
          return c;
        });
      });
      
      setCourses(prev => {
        return prev.filter(c => {
          if (!c || !c.name) return false;
          const is10thClass = c.classroom && (c.classroom.startsWith("10") || c.classroom.includes("10-") || c.classroom.includes("10 -"));
          if (is10thClass) {
            const nameLower = c.name.toUpperCase()
              .replace(/I/g, "I")
              .replace(/ı/g, "I")
              .replace(/İ/g, "I");
            
            const isTargetDeleted = 
              nameLower.includes("METIN TAHLIL") || 
              nameLower.includes("IKINCI YABANCI");
            if (isTargetDeleted) {
              return false;
            }
          }
          return true;
        });
      });

      try { sqliteStorage.setItem("migrated_compulsory_10_v2", "true"); } catch(e) {}
    }
  }, []);

  useEffect(() => {
    const migratedRehberlik = sqliteStorage.getItem("migrated_rehberlik_v1");
    if (!migratedRehberlik) {
      setClassrooms(prevClassrooms => {
        let changed = false;
        const updated = prevClassrooms.map(c => {
          const hasRehberlik = (c.assignedCourses || []).some(
            ac => ac && ac.courseName && ac.courseName.toLowerCase().includes("rehberlik")
          );
          if (!hasRehberlik) {
            changed = true;
            const matched = teachers.find(t => t && (t.branch || "").toLowerCase().includes("rehber"));
            const teacherId = matched ? matched.id : "";
            const teacherName = matched ? matched.name : "Belirtilmedi";
            return {
              ...c,
              assignedCourses: [
                ...(c.assignedCourses || []),
                {
                  courseName: "Rehberlik",
                  teacherId,
                  teacherName,
                  weeklyHours: 1,
                }
              ]
            };
          }
          return c;
        });

        if (changed) {
          // Add corresponding global courses
          setCourses(prevCourses => {
            const newCourses = [...prevCourses];
            updated.forEach((c) => {
              const hasGlobalCourse = prevCourses.some(
                gc => gc.classroom === c.name && gc.name && gc.name.toLowerCase().includes("rehberlik")
              );
              if (!hasGlobalCourse) {
                const matched = teachers.find(t => t && (t.branch || "").toLowerCase().includes("rehber"));
                const teacherId = matched ? matched.id : "";
                const teacherName = matched ? matched.name : "Belirtilmedi";
                newCourses.push({
                  id: `CRS-REH-${c.name}-${Date.now()}`,
                  name: "Rehberlik",
                  code: `REH-${c.name}`,
                  classroom: c.name,
                  teacherId,
                  teacherName,
                  schedule: "Haftalık 1 Saat",
                  studentCount: 24,
                });
              }
            });
            return newCourses;
          });
          return updated;
        }
        return prevClassrooms;
      });
      try { sqliteStorage.setItem("migrated_rehberlik_v1", "true"); } catch(e) {}
    }
  }, [teachers]);

  // Dynamically calculate and synchronize KPI counts as student/teacher collections change
  useEffect(() => {
    const validStudents = (students || []).filter(Boolean);
    const validTeachers = (teachers || []).filter(Boolean);
    const validClassrooms = (classrooms || []).filter(Boolean);
    const validCourses = (courses || []).filter(Boolean);

    const totalCount = validStudents.length;
    const activeCount = validStudents.filter((s) => s.status === "Aktif").length;

    // Average GPA calculation
    const avgGpa =
      totalCount > 0
        ? validStudents.reduce(
            (acc, current) => acc + (current.gpa ?? current.oob ?? 0),
            0,
          ) / totalCount
        : 0;

    setStats((prev) => ({
      ...prev,
      totalStudents: totalCount,
      activeStudents: activeCount,
      totalTeachers: validTeachers.length,
      totalClasses: validClassrooms.length,
      gpaAverage: avgGpa,
    }));
  }, [students, teachers, courses, classrooms]);

  // Main UI selector mapping
  const renderTabContent = () => {
    const retiredStrategicTabs = new Set<string>([
      "operations-center",
      "mission-control",
      "digital-school-twin",
      "guidance-center",
      "discipline-analytics",
      "learning-map",
      "teacher-analytics",
      "hasat-brain",
      "institution-trends",
      "hasat-live",
      "hasat-decision",
      "hasat-ai-commander",
      "hasat-predictive-ai",
      "hasat-intervention-insights",
      "hasat-workflow",
      "hasat-autonomous",
      "production-acceptance",
    ]);

    if (retiredStrategicTabs.has(activeTab)) {
      return (
        <Dashboard
          stats={stats}
          students={roleDataScope.students}
          teachers={roleDataScope.teachers}
          courses={roleDataScope.courses}
          classrooms={roleDataScope.classrooms}
          setActiveTab={setActiveTab}
          setTeachers={setTeachers}
          announcements={announcements}
          setAnnouncements={setAnnouncements}
          currentUser={currentPanelUser}
        />
      );
    }

    if (!canAccessModuleTab(currentPanelUser, effectiveCloudRole, activeTab) || !isSchoolModuleEnabled(accessState, currentPanelUser, activeTab)) {
      return (
        <AccessDeniedState
          role={effectiveCloudRole}
          moduleId={activeTab}
          onBack={() => setActiveTab("dashboard")}
          onHome={() => setActiveTab("dashboard")}
        />
      );
    }

    switch (activeTab) {
      case "production-acceptance":
        return (
          <ProductionAcceptanceCenter
            taskScope={{
              schoolId: currentPanelUser?.schoolId || "school-main",
              userId: currentPanelUser?.id || "system",
              userName: currentPanelUser?.fullName || "Sistem",
            }}
          />
        );
      case "hasat-live":
        return <HasatLive students={students} teachers={teachers} classrooms={classrooms} />;
      case "hasat-decision":
        return <HasatDecision students={students} teachers={teachers} classrooms={classrooms} />;
      case "hasat-autonomous":
        return <HasatAutonomous students={students} teachers={teachers} classrooms={classrooms} />;
      case "hasat-workflow":
        return <HasatWorkflow teachers={teachers} />;
      case "hasat-intervention-insights":
        return <HasatInterventionInsights />;
      case "hasat-predictive-ai":
        return <HasatPredictiveAi students={students} teachers={teachers} classrooms={classrooms} />;
      case "hasat-ai-commander":
        return <HasatAiCommander students={students} teachers={teachers} classrooms={classrooms} onNavigate={setActiveTab} />;
      case "operations-center":
        return <HasatOperationsCenter students={students} teachers={teachers} classrooms={classrooms} onNavigate={setActiveTab} />;
      case "mission-control":
        return <HasatMissionControl students={students} teachers={teachers} classrooms={classrooms} onNavigate={setActiveTab} />;
      case "digital-school-twin":
        return <HasatDigitalSchoolTwin students={students} teachers={teachers} classrooms={classrooms} onNavigate={setActiveTab} />;
      case "guidance-center":
        return <HasatGuidanceCenter students={roleDataScope.students} onNavigate={setActiveTab} />;
      case "discipline-analytics":
        return <HasatDisciplineAnalytics onNavigate={setActiveTab} />;
      case "learning-map":
        return <HasatLearningMap students={roleDataScope.students} onNavigate={setActiveTab} />;
      case "teacher-analytics":
        return <HasatTeacherAnalytics teachers={roleDataScope.teachers} courses={roleDataScope.courses} classrooms={roleDataScope.classrooms} onNavigate={setActiveTab} />;
      case "institution-trends":
        return <HasatInstitutionTrends onNavigate={setActiveTab} />;
      case "hasat-brain":
        return <HasatBrain students={students} teachers={teachers} classrooms={classrooms} onNavigate={setActiveTab} />;
      case "dashboard":
        return (
          <Dashboard
            stats={stats}
            students={roleDataScope.students}
            teachers={roleDataScope.teachers}
            courses={roleDataScope.courses}
            classrooms={roleDataScope.classrooms}
            setActiveTab={setActiveTab}
            setTeachers={setTeachers}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            currentUser={currentPanelUser}
          />
        );
      case "school-info":
        return <SchoolInfoModule />;
      case "human-resources":
        return (
          <HumanResourcesModule
            students={students}
            setStudents={setStudents}
            teachers={teachers}
            setTeachers={setTeachers}
            classrooms={classrooms}
            setClassrooms={setClassrooms}
            courses={courses}
            setCourses={setCourses}
            customCreatedCourses={customCreatedCourses}
            setCustomCreatedCourses={setCustomCreatedCourses}
            initialSubTab="teachers"
          />
        );
      case "students":
        return (
          <HumanResourcesModule
            students={students}
            setStudents={setStudents}
            teachers={teachers}
            setTeachers={setTeachers}
            classrooms={classrooms}
            setClassrooms={setClassrooms}
            courses={courses}
            setCourses={setCourses}
            customCreatedCourses={customCreatedCourses}
            setCustomCreatedCourses={setCustomCreatedCourses}
            initialSubTab="students"
          />
        );
      case "teachers":
        return (
          <HumanResourcesModule
            students={students}
            setStudents={setStudents}
            teachers={teachers}
            setTeachers={setTeachers}
            classrooms={classrooms}
            setClassrooms={setClassrooms}
            courses={courses}
            setCourses={setCourses}
            customCreatedCourses={customCreatedCourses}
            setCustomCreatedCourses={setCustomCreatedCourses}
            initialSubTab="teachers"
          />
        );
      case "schedule-planner":
        return (
          <AppErrorBoundary scope="tab-section">
            <SchedulePlannerModule 
              teachers={teachers} 
              classrooms={classrooms}
              courses={courses}
            />
          </AppErrorBoundary>
        );
      case "a-panel":
        return <APanelModule teachers={teachers} classrooms={classrooms} students={students} />;
      case "rules-panel":
        return <ScheduleRulesModule />;
      case "classes":
        return (
          <AppErrorBoundary scope="tab-section">
            <ClassesModule
              classrooms={classrooms}
              setClassrooms={setClassrooms}
              teachers={teachers}
              courses={courses}
              setCourses={setCourses}
              students={students}
              customCreatedCourses={customCreatedCourses}
              setCustomCreatedCourses={setCustomCreatedCourses}
            />
          </AppErrorBoundary>
        );
      case "parent-consents":
        return <ParentApprovalCenter currentUserName={currentPanelUser?.fullName || "Yönetici"} />;
      case "responsibility-exams":
        return <ResponsibilityExamModule students={students} teachers={teachers} courses={courses} classrooms={classrooms} />;
      case "responsibility-exam-seating":
        return <ResponsibilityExamSeatingPlanModule />;
      case "yearbook":
        return <YearbookAdmin />;
      case "courses":
        return (
          <AppErrorBoundary scope="tab-section">
            <CourseModule
              courses={courses}
              setCourses={setCourses}
              teachers={teachers}
              classrooms={classrooms}
              setClassrooms={setClassrooms}
              students={students}
              displayMode="connections"
              customCreatedCourses={customCreatedCourses}
              setCustomCreatedCourses={setCustomCreatedCourses}
            />
          </AppErrorBoundary>
        );
      case "committees":
        return <CommitteesModule teachers={teachers} students={students} classrooms={classrooms} schoolId={currentPanelUser?.schoolId || accessState.activeSchoolId || "school-main"} />;
      case "academic-calendar":
        return <AcademicCalendarModule />;
      case "exam-tools":
        return <ExamToolsModule />;
      case "message-tools":
        return <MessageToolsModule />;
      case "database":
        return <LocalDatabaseModule />;
      case "duty-info":
        return (
          <AppErrorBoundary scope="tab-section">
            <DutyInfoModule teachers={teachers} />
          </AppErrorBoundary>
        );
      case "announcements":
        return (
          <AnnouncementModule
            announcements={announcements}
            setAnnouncements={setAnnouncements}
          />
        );
      case "messages":
        return <MessagesModule
          studentsOverride={roleDataScope.students}
          teachersOverride={roleDataScope.teachers}
          classroomsOverride={roleDataScope.classrooms}
          scopeConfigured={roleDataScope.configured}
          scopeReason={roleDataScope.reason}
          canSendMessages={hasCapability(effectiveCloudRole, "messages.send")}
        />;
      case "whatsapp":
        return (
          <>
            <ExamAnalysisModule onNavigate={navigateFromExam} canPublishReports={hasCapability(effectiveCloudRole, "reports.publish")} />
            <ExamResultsWhatsAppModal selectedExam={whatsappExamContext} onClose={() => setActiveTab(whatsappExamContext.returnTab || "exam-analysis")} />
          </>
        );
      case "voice-messages":
        return <VoiceMessagesModule />;
      case "settings":
        return <SettingsModule stats={stats} setStats={setStats} accessState={accessState} onAccessStateChange={setAccessState} />;
      case "teacher-interfaces":
        return (
          <TeacherInterfacesModule
            teachers={teachers}
            students={students}
            schoolId={currentPanelUser?.schoolId || accessState.activeSchoolId || "school-main"}
          />
        );
      case "education-coach":
        return (
          <EducationCoachModule
            students={roleDataScope.students}
            schoolId={currentPanelUser?.schoolId || accessState.activeSchoolId || "school-main"}
            currentUserName={currentPanelUser?.fullName || "Eğitim Koçu"}
          />
        );
      case "exam-prepare":
        return <ExamPrepareModule setAppActiveTab={setActiveTab} initialExamId={examPrepareContext.examId} onInitialExamHandled={()=>setExamPrepareContext({})} classrooms={classrooms} students={students} />;
      case "exam-analysis":
        return <ExamAnalysisModule key="exam-analysis" onNavigate={navigateFromExam} allowedStudents={roleDataScope.students} scopeConfigured={roleDataScope.configured} scopeReason={roleDataScope.reason} canPublishReports={hasCapability(effectiveCloudRole, "reports.publish")} />;
      case "network-exams":
        return <NetworkExamAnalyticsModule accessState={accessState} currentUser={currentPanelUser!} />;
      case "exam-reports":
        return <ExamAnalysisModule key="exam-reports" onNavigate={navigateFromExam} initialMode="reports" allowedStudents={roleDataScope.students} scopeConfigured={roleDataScope.configured} scopeReason={roleDataScope.reason} canPublishReports={hasCapability(effectiveCloudRole, "reports.publish")} accessState={accessState} currentUser={currentPanelUser!} />;
      case "google-forms":
        return <GoogleFormsModule />;
      case "behavior":
        return (
          <BehaviorModule
            students={roleDataScope.students}
            teachers={roleDataScope.teachers}
            enforceStudentScope={effectiveCloudRole === "teacher" || effectiveCloudRole === "counselor"}
            scopeReason={roleDataScope.reason}
            canManageRecords={hasCapability(effectiveCloudRole, "guidance.manage")}
            initialFilterType={behaviorInitialFilter}
            onOpenDisciplineTab={(tab) => {
              setDisciplineInitialTab(tab);
              setActiveTab("discipline");
            }}
          />
        );
      case "behavior-definitions":
        return (
          <AppErrorBoundary scope="tab-section">
            <BehaviorModule
              students={roleDataScope.students}
              teachers={roleDataScope.teachers}
              enforceStudentScope={effectiveCloudRole === "teacher" || effectiveCloudRole === "counselor"}
              scopeReason={roleDataScope.reason}
              canManageRecords={hasCapability(effectiveCloudRole, "guidance.manage")}
              initialFilterType="Davranışlar / Ödüller - Yaptırımlar"
              hideFilterHeader={true}
            />
          </AppErrorBoundary>
        );
      case "guidance":
        return <div className="p-8 text-slate-500 font-medium">Rehberlik modülü yapım aşamasındadır.</div>;
      case "discipline":
        return (
          <DisciplineModule
            initialTab={disciplineInitialTab}
            classrooms={roleDataScope.classrooms}
            teachers={roleDataScope.teachers}
            students={roleDataScope.students}
            enforceStudentScope={effectiveCloudRole === "teacher" || effectiveCloudRole === "counselor"}
            scopeReason={roleDataScope.reason}
            canManageDiscipline={hasCapability(effectiveCloudRole, "discipline.manage")}
            onOpenBehaviorTab={(filter) => {
              setBehaviorInitialFilter(filter);
              setActiveTab("behavior");
            }}
          />
        );
      case "kelebek-a":
        return <KelebekSystemAModule students={students} courses={courses} />;
      case "kelebek-b":
        return <KelebekSystemBModule students={students} courses={courses} classrooms={classrooms} customCreatedCourses={customCreatedCourses} />;
      case "test":
        return (
          <TestExamPreparer
            classrooms={classrooms}
            courses={courses}
            customCreatedCourses={customCreatedCourses}
          />
        );
      case "survey":
        return <SurveyModule />;
      case "lost-documents":
        return <LostDocumentsModule />;
      case "social-clubs-activities":
        return <SocialClubsActivitiesModule teachers={teachers} classrooms={classrooms} accessState={accessState} currentUser={currentPanelUser!} />;
      case "attendance-slip":
        return <AttendanceSlipModule classrooms={classrooms} students={students} />;
      case "question-cropper":
        return <QuestionPrepareModule />;
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-medium">
            <p>Bölüm bulunamadı.</p>
          </div>
        );
    }
  };


  if (!currentPanelUser) {
    return <LoginPanel accessState={accessState} onLogin={handleLogin} />;
  }

  if (isDbLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Veritabanı Başlatılıyor...</h2>
          <p className="text-xs text-slate-400">Verileriniz senkronize ediliyor, lütfen bekleyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edupanel-performance flex h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans antialiased print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* Interactive left sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentPanelUser} accessState={accessState} cloudRole={effectiveCloudRole} onLogout={handleLogout} />

      {/* Main viewport segment */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full print:h-auto print:w-full print:overflow-visible print:block bg-slate-50">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
          className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-md md:hidden"
          title="Menüyü aç"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Selected workspace viewing panel */}
        <main className={`flex-1 ${activeTab === "dashboard" ? "overflow-hidden" : "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200"} print:h-auto print:overflow-visible print:static print:block`}>
          <div className={`${activeTab === "dashboard" ? "h-full min-h-0 p-0 overflow-hidden" : "p-4 md:p-6 lg:p-8"} print:h-auto print:overflow-visible print:block`}>
            <AppErrorBoundary key={activeTab} scope={`module:${activeTab}`}>
              <Suspense fallback={<ModuleLoadingState />}>
                <ModuleRenderGate render={renderTabContent} />
              </Suspense>
            </AppErrorBoundary>
          </div>
        </main>
      </div>

      {/* App-wide global overlays */}
      <Suspense fallback={null}>
        <GlobalRemindersOverlay />
      </Suspense>
    </div>
  );
}
