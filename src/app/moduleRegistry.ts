import { lazy } from "react";

// Sınav çalışma alanı sık kullanılan ve büyük iki modülden oluşuyor.
// React.lazy bunları ilk tıklamada indirmek yerine, aynı import Promise'lerini
// girişten hemen sonra arka planda ısıtabilmek için yükleyicileri paylaşıyoruz.
let examPrepareImport: Promise<typeof import("../components/ExamPrepareModule")> | null = null;
let examAnalysisImport: Promise<typeof import("../components/ExamAnalysisModule")> | null = null;

const loadExamPrepareModule = () =>
  examPrepareImport ??= import("../components/ExamPrepareModule");

const loadExamAnalysisModule = () =>
  examAnalysisImport ??= import("../components/ExamAnalysisModule");

export const preloadExamWorkspaceModules = () =>
  Promise.allSettled([loadExamPrepareModule(), loadExamAnalysisModule()]);

/**
 * Rota ana modül kayıt defteri.
 *
 * Amaç: App.tsx ve diğer kabuk bileşenlerinin feature implementasyonlarına
 * doğrudan bağlanmasını engellemek. Bir feature için public entrypoint varsa
 * yalnızca o entrypoint buradan yüklenir.
 *
 * Yeni bir modül eklerken:
 * 1) Mümkünse src/modules/<feature>/index.ts public API oluşturun.
 * 2) Implementasyon dosyasını App.tsx içinden doğrudan import etmeyin.
 * 3) Bu registry üzerinden lazy-load edin.
 */
export const appModules = {
  Dashboard: lazy(() => import("../components/Dashboard")),
  HasatMissionControl: lazy(() => import("../components/HasatMissionControl")),
  HasatOperationsCenter: lazy(() => import("../components/HasatOperationsCenter")),
  HasatDigitalSchoolTwin: lazy(() => import("../components/HasatDigitalSchoolTwin")),
  HasatGuidanceCenter: lazy(() => import("../components/HasatGuidanceCenter")),
  HasatDisciplineAnalytics: lazy(() => import("../components/HasatDisciplineAnalytics")),
  HasatLearningMap: lazy(() => import("../components/HasatLearningMap")),
  HasatTeacherAnalytics: lazy(() => import("../components/HasatTeacherAnalytics")),
  HasatInstitutionTrends: lazy(() => import("../components/HasatInstitutionTrends")),
  HasatBrain: lazy(() => import("../components/HasatBrain")),
  HasatLive: lazy(() => import("../components/HasatLiveCenter")),
  HasatDecision: lazy(() => import("../components/HasatAiDecisionCenter")),
  HasatAutonomous: lazy(() => import("../components/HasatAutonomousCenter")),
  HasatWorkflow: lazy(() => import("../components/HasatActionWorkflow")),
  HasatInterventionInsights: lazy(() => import("../components/HasatInterventionInsights")),
  HasatPredictiveAi: lazy(() => import("../components/HasatPredictiveAi")),
  HasatAiCommander: lazy(() => import("../components/HasatAiCommander")),
  Course: lazy(() => import("../components/CourseModule")),

  // Canonical feature entrypoints: implementation dosyasına doğrudan gitmez.
  SchedulePlanner: lazy(() => import("../modules/schedule")),
  Messages: lazy(() => import("../modules/messages")),

  APanel: lazy(() => import("../components/APanelModule")),
  ScheduleRules: lazy(() => import("../components/ScheduleRulesModule")),
  Announcement: lazy(() => import("../components/AnnouncementModule")),
  Settings: lazy(() => import("../components/SettingsModule")),
  SchoolInfo: lazy(() => import("../components/SchoolInfoModule")),
  HumanResources: lazy(() => import("../components/HumanResourcesModule")),
  Committees: lazy(() => import("../components/CommitteesModule")),
  AcademicCalendar: lazy(() => import("../components/AcademicCalendarModule")),
  LocalDatabase: lazy(() => import("../components/LocalDatabaseModule")),
  ExamPrepare: lazy(loadExamPrepareModule),
  ExamAnalysis: lazy(loadExamAnalysisModule),
  NetworkExamAnalytics: lazy(() => import("../components/NetworkExamAnalyticsModule")),
  ExamTools: lazy(() => import("../components/ExamToolsModule")),
  MessageTools: lazy(() => import("../components/MessageToolsModule")),
  VoiceMessages: lazy(() => import("../components/VoiceMessagesModule")),
  ExamResultsWhatsAppModal: lazy(() => import("../components/ExamResultsWhatsAppModal")),
  DutyInfo: lazy(() => import("../components/DutyInfoModule")),
  Behavior: lazy(() => import("../components/BehaviorModule")),
  Discipline: lazy(() => import("../components/DisciplineModule")),
  KelebekSystemA: lazy(() => import("../components/KelebekSystemAModule")),
  KelebekSystemB: lazy(() => import("../components/KelebekSystemBModule")),
  Classes: lazy(() => import("../components/ClassesModule")),
  TestExamPreparer: lazy(() => import("../components/TestExamPreparer")),
  Survey: lazy(() => import("../components/SurveyModule")),
  LostDocuments: lazy(() => import("../components/LostDocumentsModule")),
  SocialClubsActivities: lazy(() => import("../components/SocialClubsActivitiesModule")),
  AttendanceSlip: lazy(() => import("../components/AttendanceSlipModule")),
  SchoolRadioAdmin: lazy(() => import("../components/SchoolRadioAdminModule")),
  EducationCoach: lazy(() => import("../components/EducationCoachModule")),
  QuestionPrepare: lazy(() => import("../components/QuestionPrepareModule")),
} as const;
