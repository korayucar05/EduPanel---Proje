import React from "react";
import QuestionBankViewerModal from "./QuestionBankViewerModal";
import { sqliteStorage } from "../../core/state/SyncStateStore";

import QuestionBankSqliteIndexSection from "./curriculum/QuestionBankSqliteIndexSection";

const SmartFolderPreviewModal = React.lazy(() => import("./curriculum/SmartFolderPreviewModal"));
const QuestionBankCapacityModal = React.lazy(
  () => import("./QuestionBankCapacityModal"),
);
const QuestionBankSearchModal = React.lazy(
  () => import("./QuestionBankSearchModal"),
);
const QuestionBankPreviewModal = React.lazy(() => import("./curriculum/QuestionBankPreviewModal"));
const QuestionBankBackupRecoverySection = React.lazy(() => import("./curriculum/QuestionBankBackupRecoverySection"));
const QuestionBankThumbnailSection = React.lazy(() => import("./curriculum/QuestionBankThumbnailSection"));
const QuestionBankReadinessSection = React.lazy(() => import("./curriculum/QuestionBankReadinessSection"));
const QuestionBankDatasetProfileSection = React.lazy(() => import("./curriculum/QuestionBankDatasetProfileSection"));
const QuestionBankMaintenanceSection = React.lazy(() => import("./curriculum/QuestionBankMaintenanceSection"));
const QuestionBankHealthScoreSection = React.lazy(() => import("./curriculum/QuestionBankHealthScoreSection"));
const QuestionBankPerformanceBenchmarkSection = React.lazy(() => import("./curriculum/QuestionBankPerformanceBenchmarkSection"));
const QuestionBankDatabaseOptimizationSection = React.lazy(() => import("./curriculum/QuestionBankDatabaseOptimizationSection"));
const QuestionBankQueryPlanAnalysisSection = React.lazy(() => import("./curriculum/QuestionBankQueryPlanAnalysisSection"));
const QuestionBankIntegrityHistorySection = React.lazy(() => import("./curriculum/QuestionBankIntegrityHistorySection"));
const QuestionBankOrphanFilesSection = React.lazy(() => import("./curriculum/QuestionBankOrphanFilesSection"));
const QuestionBankQuarantineVaultSection = React.lazy(() => import("./curriculum/QuestionBankQuarantineVaultSection"));
const QuestionBankWriteJournalSection = React.lazy(() => import("./curriculum/QuestionBankWriteJournalSection"));
const QuestionBankStartupAuditSection = React.lazy(() => import("./curriculum/QuestionBankStartupAuditSection"));
const QuestionBankTechnicalSupportSection = React.lazy(() => import("./curriculum/QuestionBankTechnicalSupportSection"));
const QuestionBankDiagnosticsSection = React.lazy(() => import("./curriculum/QuestionBankDiagnosticsSection"));
const QuestionBankMaintenanceToolsSection = React.lazy(() => import("./curriculum/QuestionBankMaintenanceToolsSection"));
const QuestionBankFileDatabaseIntegritySection = React.lazy(() => import("./curriculum/QuestionBankFileDatabaseIntegritySection"));
const QuestionBankTrashSection = React.lazy(() => import("./curriculum/QuestionBankTrashSection"));
const QuestionBankSchemaVersionSection = React.lazy(() => import("./curriculum/QuestionBankSchemaVersionSection"));
import {
  checkQuestionBankIntegrity,
  cleanupQuestionBankMissingRecords,
  cleanupQuestionBankOrphanFiles,
  createQuestionBankImportSession,
  createQuestionThumbnailFromUrl,
  downloadQuestionBankBackup,
  downloadQuestionBankSupportBundle,
  getQuestionBankCapacity,
  getQuestionBankIndexStatus,
  getQuestionBankStatus,
  getQuestionBankThumbnailStatus,
  getQuestionBankVersion,
  getQuestionBankWriteState,
  getQuestionBankWriteJournalStatus,
  getQuestionBankMigrationRecoveryPlan,
  getQuestionBankIntegrityChanges,
  getQuestionBankIntegrityHistory,
  getQuestionBankHealthScore,
  getQuestionBankHealthScoreHistory,
  getQuestionBankHealthScoreTrend,
  createQuestionBankCoordinatedBackup,
  getQuestionBankDatasetProfile,
  getQuestionBankProductionReadiness,
  getQuestionBankPerformanceBenchmark,
  getQuestionBankPerformanceHistory,
  getQuestionBankDatabaseOptimization,
  getQuestionBankQueryPlanAnalysis,
  getQuestionBankIndexRecommendations,
  getQuestionBankIndexEffectiveness,
  getQuestionBankMaintenancePreview,
  getQuestionBankIntegrityRecommendations,
  getQuestionBankSafeActions,
  getQuestionBankSafeActionAudit,
  getQuestionBankQuarantine,
  cleanupQuestionBankSafeActionAudit,
  downloadQuestionBankSafeActionAudit,
  purgeQuestionBankQuarantine,
  quarantineQuestionBankOrphans,
  listQuestionBankImportSessions,
  listQuestionBankRecords,
  optimizeQuestionBank,
  rebuildQuestionBankIndex,
  restoreQuestionBankBackup,
  rollbackQuestionBankImportSession,
  restoreQuestionBankRecord,
  getQuestionBankStartupAudit,
  cleanupQuestionBankWriteJournal,
  recoverQuestionBankPendingWrites,
  recheckQuestionBankSafeMode,
  runQuestionBankDiagnostics,
  applyQuestionBankRecommendedIndexes,
  runQuestionBankDatabaseAnalyze,
  runQuestionBankDisasterRecoveryDrill,
  runQuestionBankMaintenanceOrchestrator,
  verifyQuestionBankCoordinatedBackup,
  runQuestionBankHealthScoreSnapshot,
  runQuestionBankPerformanceHistorySnapshot,
  runQuestionBankIntegritySnapshot,
  runQuestionBankSafeAction,
  runQuestionBankStartupAudit,
  scanQuestionBankOrphans,
  restoreQuestionBankQuarantineFile,
  updateQuestionBankImportSession,
} from "../../lib/localDatabase";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ClipboardPaste,
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  ImagePlus,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Undo2,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";

const normalizeName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "");


const formatBytes = (value: number): string => {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const amount = bytes / Math.pow(1024, unitIndex);

  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
};
const questionIdentity = (question: any) =>
  String(question?.id || question?.code || question?.fileName || "");

const scopedQuestionSelectionKey = (
  courseId: unknown,
  unitId: unknown,
  topicId: unknown,
  outcomeId: unknown,
  question: any,
) =>
  [
    String(courseId || ""),
    String(unitId || ""),
    String(topicId || ""),
    String(outcomeId || ""),
    questionIdentity(question),
  ].join("::");

export default function CourseCurriculumPanel(props: any) {
  const {
    curriculumActiveGrade,
    setCurriculumActiveGrade,
    deletedCurriculumCourses,
    setDeletedCurriculumCourses,
    setCurriculumModalState,
    downloadCurriculumTemplate,
    handleGradeCurriculumUpload,
    applyPastedCurriculumRows,
    curriculumCourses = [],
    hasCourseCurriculum,
    getCourseCurriculum,
    uploadQuestionImages,
    removeQuestionsByImportSession,
    deleteQuestion,
    deleteQuestionsBulk,
    curriculumMoveCatalog = [],
    moveQuestion,
  } = props;

  const [curriculumBuilderOpen, setCurriculumBuilderOpen] = React.useState(false);
  const [curriculumBuilderGrade, setCurriculumBuilderGrade] = React.useState(
    String(curriculumActiveGrade || "").match(/(9|10|11|12)/)?.[1] || "9",
  );
  const [curriculumBuilderCourseId, setCurriculumBuilderCourseId] = React.useState("");
  const [expandedCourses, setExpandedCourses] = React.useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = React.useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = React.useState<Record<string, boolean>>({});
  const [expandedOutcomes, setExpandedOutcomes] = React.useState<Record<string, boolean>>({});
  const [answersByOutcome, setAnswersByOutcome] = React.useState<Record<string, string>>({});
  const [questionUploadChoiceTarget, setQuestionUploadChoiceTarget] = React.useState<any>(null);
  const [pendingQuestionType, setPendingQuestionType] = React.useState<"exam" | "study" | null>(null);
  const [questionUploadStatus, setQuestionUploadStatus] = React.useState<string>("");
  const [questionUploadRunning, setQuestionUploadRunning] = React.useState(false);

  // Soru kartları müfredat JSON'undan değil canonical SQLite soru tablosundan okunur.
  const [canonicalQuestionCounts, setCanonicalQuestionCounts] = React.useState<Record<string, number>>({});
  const [canonicalQuestionCache, setCanonicalQuestionCache] = React.useState<Record<string, any[]>>({});
  const [canonicalQuestionTotals, setCanonicalQuestionTotals] = React.useState<Record<string, number>>({});
  const [canonicalQuestionLoading, setCanonicalQuestionLoading] = React.useState<Record<string, boolean>>({});

  const canonicalCourseIdFromHierarchy = (
    fallbackCourseId: unknown,
    unitId: unknown,
    topicId: unknown,
    outcomeId: unknown = "",
  ) => {
    for (const value of [outcomeId, topicId, unitId]) {
      const parts = String(value || "").split(".").filter(Boolean);
      if (parts.length >= 2 && /^(9|10|11|12)$/.test(parts[0])) return parts[1];
    }
    const fallback = String(fallbackCourseId || "");
    const virtualMatch = fallback.match(/^CURR-(?:9|10|11|12)-(.+)$/i);
    return virtualMatch?.[1] || fallback;
  };

  const canonicalTargetKey = (
    courseId: unknown,
    unitId: unknown,
    topicId: unknown,
    outcomeId: unknown = "",
  ) => [
    canonicalCourseIdFromHierarchy(courseId, unitId, topicId, outcomeId),
    unitId,
    topicId,
    outcomeId,
  ].map((value) => String(value || "")).join("::");

  const loadCanonicalCounts = React.useCallback(async () => {
    const grade = Number(String(curriculumActiveGrade || "").match(/\d+/)?.[0] || 0);
    if (!grade) return;

    try {
      /*
       * Tek gerçek kaynak: aktif canonical soru kayıtları.
       * Test Paneli hangi kayıtları görüyorsa Müfredat sayaçları da aynı
       * /api/question-bank/questions akışından sayılır. Ayrı counts cache/index
       * yüzünden "Test Paneli 27 - Müfredat 0" ayrışması oluşamaz.
       */
      const allQuestions: any[] = [];
      let offset = 0;
      let total = 0;

      do {
        const payload: any = await listQuestionBankRecords({
          status: "active",
          grade,
          limit: 500,
          offset,
        });

        const rows = Array.isArray(payload?.questions)
          ? payload.questions
          : Array.isArray(payload)
            ? payload
            : [];

        allQuestions.push(...rows);
        total = Number(payload?.total || allQuestions.length);
        offset += rows.length;

        if (rows.length === 0) break;
      } while (offset < total);

      const next: Record<string, number> = {};
      for (const item of allQuestions) {
        const key = canonicalTargetKey(
          item.courseId ?? item.course_id,
          item.unitId ?? item.unit_id,
          item.topicId ?? item.topic_id,
          item.outcomeId ?? item.outcome_id ?? "",
        );
        next[key] = Number(next[key] || 0) + 1;
      }

      setCanonicalQuestionCounts(next);
    } catch (error) {
      console.error("Canonical soru sayıları okunamadı:", error);
    }
  }, [curriculumActiveGrade]);

  const loadCanonicalQuestions = React.useCallback(
    async (
      courseId: string,
      unitId: string,
      topicId: string,
      outcomeId = "",
      options: { append?: boolean; offset?: number } = {},
    ) => {
      const key = canonicalTargetKey(courseId, unitId, topicId, outcomeId);
      const grade = Number(String(curriculumActiveGrade || "").match(/\d+/)?.[0] || 0);
      if (!grade) return;
      const offset = Number(options.offset || 0);
      setCanonicalQuestionLoading((current) => ({ ...current, [key]: true }));
      try {
        const canonicalCourseId = canonicalCourseIdFromHierarchy(courseId, unitId, topicId, outcomeId);
        const payload: any = await listQuestionBankRecords({
          status: "active",
          grade,
          courseId: canonicalCourseId,
          unitId,
          topicId,
          ...(outcomeId ? { outcomeId } : {}),
          limit: 100,
          offset,
        });
        const rows = Array.isArray(payload?.questions) ? payload.questions : [];
        setCanonicalQuestionTotals((current) => ({
          ...current,
          [key]: Number(payload?.total || rows.length),
        }));
        setCanonicalQuestionCache((current) => ({
          ...current,
          [key]: options.append ? [...(current[key] || []), ...rows] : rows,
        }));
      } catch (error) {
        console.error("Canonical soru kayıtları okunamadı:", error);
      } finally {
        setCanonicalQuestionLoading((current) => ({ ...current, [key]: false }));
      }
    },
    [curriculumActiveGrade],
  );

  React.useEffect(() => {
    setCanonicalQuestionCache({});
    setCanonicalQuestionTotals({});
    void loadCanonicalCounts();
  }, [curriculumActiveGrade, loadCanonicalCounts]);

  React.useEffect(() => {
    const refreshCounts = () => {
      if (document.visibilityState === "visible") {
        void loadCanonicalCounts();
      }
    };

    window.addEventListener("focus", refreshCounts);
    document.addEventListener("visibilitychange", refreshCounts);
    return () => {
      window.removeEventListener("focus", refreshCounts);
      document.removeEventListener("visibilitychange", refreshCounts);
    };
  }, [loadCanonicalCounts]);

  const questionUploadSingleInputRef = React.useRef<HTMLInputElement | null>(null);
  const questionUploadMultipleInputRef = React.useRef<HTMLInputElement | null>(null);
  const questionUploadFolderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [draggingOutcome, setDraggingOutcome] = React.useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [pasteRows, setPasteRows] = React.useState<any[]>([]);
  const [pasteErrors, setPasteErrors] = React.useState<string[]>([]);
  const [focusedCourseName, setFocusedCourseName] = React.useState<string | null>(null);
  const [capacityUploadTarget, setCapacityUploadTarget] = React.useState<{
    grade: number;
    courseId: string;
    courseName: string;
    unitId: string;
    topicId: string;
    outcomeId: string;
  } | null>(null);
  const [smartFolderImportRunning, setSmartFolderImportRunning] = React.useState(false);
  const [smartFolderImportResult, setSmartFolderImportResult] = React.useState<any>(null);
  const [smartFolderPreviewOpen, setSmartFolderPreviewOpen] = React.useState(false);
  const [smartFolderPreview, setSmartFolderPreview] = React.useState<any>(null);
  const [smartFolderPendingFiles, setSmartFolderPendingFiles] = React.useState<File[]>([]);
  const [smartFolderExcludedOutcomes, setSmartFolderExcludedOutcomes] = React.useState<Record<string, boolean>>({});
  const [smartFolderRouteOverrides, setSmartFolderRouteOverrides] = React.useState<Record<string, string>>({});
  const [importSessionHistory, setImportSessionHistory] = React.useState<any[]>([]);
  const [importSessionHistoryOpen, setImportSessionHistoryOpen] = React.useState(false);
  const [importSessionHistoryLoading, setImportSessionHistoryLoading] = React.useState(false);
  const [rollingBackImportSessionId, setRollingBackImportSessionId] = React.useState<string | null>(null);





  const toggleQuestionDeleteSelection = (
    courseId: unknown,
    unitId: unknown,
    topicId: unknown,
    outcomeId: unknown,
    question: any,
  ) => {
    const key = scopedQuestionSelectionKey(
      courseId,
      unitId,
      topicId,
      outcomeId,
      question,
    );

    setSelectedQuestionDeleteKeys((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const setOutcomeQuestionSelection = (
    courseId: unknown,
    unitId: unknown,
    topicId: unknown,
    outcomeId: unknown,
    questions: any[],
    selected: boolean,
  ) => {
    setSelectedQuestionDeleteKeys((current) => {
      const next = { ...current };

      (questions || []).forEach((question: any) => {
        const key = scopedQuestionSelectionKey(
          courseId,
          unitId,
          topicId,
          outcomeId,
          question,
        );
        if (selected) next[key] = true;
        else delete next[key];
      });

      return next;
    });
  };

  const deleteSelectedOutcomeQuestions = async (
    courseId: string,
    unitId: string,
    topicId: string,
    outcomeId: string,
    questions: any[],
  ) => {
    const selectedQuestions = (questions || []).filter(
      (question: any) =>
        Boolean(
          selectedQuestionDeleteKeys[
            scopedQuestionSelectionKey(
              courseId,
              unitId,
              topicId,
              outcomeId,
              question,
            )
          ],
        ),
    );

    if (selectedQuestions.length === 0) return;

    const approved = window.confirm(
      `${selectedQuestions.length} seçili soru kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`,
    );
    if (!approved) return;

    const outcomeKey = [
      courseId,
      unitId,
      topicId,
      outcomeId,
    ].join("::");

    setBulkDeletingOutcomeKey(outcomeKey);

    try {
      const ids = selectedQuestions.map((question: any) =>
        questionIdentity(question),
      );

      if (typeof deleteQuestionsBulk === "function") {
        await deleteQuestionsBulk(
          courseId,
          unitId,
          topicId,
          outcomeId,
          ids,
        );
      } else {
        // Eski prop kullanan ortamlarda güvenli geri dönüş.
        for (const id of ids) {
          await Promise.resolve(
            deleteQuestion?.(
              courseId,
              unitId,
              topicId,
              outcomeId,
              id,
            ),
          );
        }
      }

      setSelectedQuestionDeleteKeys((current) => {
        const next = { ...current };
        selectedQuestions.forEach((question: any) => {
          delete next[
            scopedQuestionSelectionKey(
              courseId,
              unitId,
              topicId,
              outcomeId,
              question,
            )
          ];
        });
        return next;
      });
      await loadCanonicalQuestions(courseId, unitId, topicId, outcomeId);
      await loadCanonicalCounts();
    } finally {
      setBulkDeletingOutcomeKey("");
    }
  };


  const smartFolderInputRef = React.useRef<HTMLInputElement>(null);


  const [questionViewer, setQuestionViewer] = React.useState<any>(null);
  const [selectedQuestionDeleteKeys, setSelectedQuestionDeleteKeys] =
    React.useState<Record<string, boolean>>({});
  const [bulkDeletingOutcomeKey, setBulkDeletingOutcomeKey] =
    React.useState<string>("");
  const [brokenQuestionImages, setBrokenQuestionImages] = React.useState<Record<string, boolean>>({});
  const [questionImageError, setQuestionImageError] = React.useState("");
  const [moveDraft, setMoveDraft] = React.useState<any>(null);
  const [viewerZoom, setViewerZoom] = React.useState(1);
  const [expandedMoveUnitId, setExpandedMoveUnitId] = React.useState<string>("");
  const [bankHealthOpen, setBankHealthOpen] = React.useState(false);
  const [bankHealthLoading, setBankHealthLoading] = React.useState(false);
  const [bankStatus, setBankStatus] = React.useState<any>(null);
  const [bankVersion, setBankVersion] = React.useState<any>(null);
  const [bankWriteState, setBankWriteState] = React.useState<any>(null);
  const [safeModeRecheckRunning, setSafeModeRecheckRunning] = React.useState(false);
  const [safeModeRecheckResult, setSafeModeRecheckResult] = React.useState<any>(null);
  const [startupAudit, setStartupAudit] = React.useState<any[]>([]);
  const [startupAuditRunning, setStartupAuditRunning] = React.useState(false);
  const [supportBundleLoading, setSupportBundleLoading] = React.useState(false);
  const [writeJournalStatus, setWriteJournalStatus] = React.useState<any>(null);
  const [writeJournalRecovering, setWriteJournalRecovering] = React.useState(false);
  const [writeJournalCleaning, setWriteJournalCleaning] = React.useState(false);
  const [orphanScan, setOrphanScan] = React.useState<any>(null);
  const [orphanScanning, setOrphanScanning] = React.useState(false);
  const [orphanQuarantining, setOrphanQuarantining] = React.useState(false);
  const [quarantineInventory, setQuarantineInventory] = React.useState<any>(null);
  const [quarantineLoading, setQuarantineLoading] = React.useState(false);
  const [quarantineRestoring, setQuarantineRestoring] = React.useState<string | null>(null);
  const [quarantinePurging, setQuarantinePurging] = React.useState(false);
  const [quarantinePurgeResult, setQuarantinePurgeResult] = React.useState<any>(null);
  const [integrityHistory, setIntegrityHistory] = React.useState<any[]>([]);
  const [integrityRunning, setIntegrityRunning] = React.useState(false);
  const [integrityChanges, setIntegrityChanges] = React.useState<any>(null);
  const [integrityRecommendations, setIntegrityRecommendations] = React.useState<any>(null);
  const [questionBankHealthScore, setQuestionBankHealthScore] = React.useState<any>(null);
  const [healthScoreHistory, setHealthScoreHistory] = React.useState<any>(null);
  const [healthScoreTrend, setHealthScoreTrend] = React.useState<any>(null);
  const [performanceBenchmark, setPerformanceBenchmark] = React.useState<any>(null);
  const [performanceBenchmarkRunning, setPerformanceBenchmarkRunning] = React.useState(false);
  const [performanceHistory, setPerformanceHistory] = React.useState<any>(null);
  const [performanceHistoryRecording, setPerformanceHistoryRecording] = React.useState(false);
  const [databaseOptimization, setDatabaseOptimization] = React.useState<any>(null);
  const [databaseOptimizationRunning, setDatabaseOptimizationRunning] = React.useState(false);
  const [queryPlanAnalysis, setQueryPlanAnalysis] = React.useState<any>(null);
  const [queryPlanLoading, setQueryPlanLoading] = React.useState(false);
  const [indexRecommendations, setIndexRecommendations] = React.useState<any>(null);
  const [indexApplyRunning, setIndexApplyRunning] = React.useState(false);
  const [indexEffectiveness, setIndexEffectiveness] = React.useState<any>(null);
  const [indexEffectivenessLoading, setIndexEffectivenessLoading] = React.useState(false);
  const [maintenancePreview, setMaintenancePreview] = React.useState<any>(null);
  const [maintenancePreviewLoading, setMaintenancePreviewLoading] = React.useState(false);
  const [maintenanceRunning, setMaintenanceRunning] = React.useState(false);
  const [maintenanceResult, setMaintenanceResult] = React.useState<any>(null);
  const [datasetProfile, setDatasetProfile] = React.useState<any>(null);
  const [coordinatedBackupRunning, setCoordinatedBackupRunning] = React.useState(false);
  const [coordinatedBackupResult, setCoordinatedBackupResult] = React.useState<any>(null);
  const [coordinatedBackupVerifying, setCoordinatedBackupVerifying] = React.useState(false);
  const [coordinatedBackupVerification, setCoordinatedBackupVerification] = React.useState<any>(null);
  const [disasterRecoveryRunning, setDisasterRecoveryRunning] = React.useState(false);
  const [disasterRecoveryResult, setDisasterRecoveryResult] = React.useState<any>(null);
  const [productionReadiness, setProductionReadiness] = React.useState<any>(null);
  const [productionReadinessLoading, setProductionReadinessLoading] = React.useState(false);
  const [technicalDiagnosticsOpen, setTechnicalDiagnosticsOpen] = React.useState(false);
  const [healthScoreRecording, setHealthScoreRecording] = React.useState(false);
  const [safeActions, setSafeActions] = React.useState<any[]>([]);
  const [safeActionRunning, setSafeActionRunning] = React.useState<string | null>(null);
  const [safeActionResult, setSafeActionResult] = React.useState<any>(null);
  const [safeActionAudit, setSafeActionAudit] = React.useState<any[]>([]);
  const [safeActionAuditLoading, setSafeActionAuditLoading] = React.useState(false);
  const [safeActionAuditCleaning, setSafeActionAuditCleaning] = React.useState(false);
  const [safeActionAuditExporting, setSafeActionAuditExporting] = React.useState(false);
  const [safeActionAuditFilter, setSafeActionAuditFilter] = React.useState("");
  const [migrationRecoveryPlan, setMigrationRecoveryPlan] = React.useState<any>(null);
  const [migrationRecoveryOpen, setMigrationRecoveryOpen] = React.useState(false);
  const [migrationRecoveryLoading, setMigrationRecoveryLoading] = React.useState(false);
  const [bankIntegrity, setBankIntegrity] = React.useState<any>(null);
  const [deletedQuestions, setDeletedQuestions] = React.useState<any[]>([]);
  const [restoringQuestionId, setRestoringQuestionId] = React.useState<string | null>(null);
  const [bankBackupLoading, setBankBackupLoading] = React.useState(false);
  const [bankRestoreLoading, setBankRestoreLoading] = React.useState(false);
  const [bankRestoreResult, setBankRestoreResult] = React.useState<any>(null);
  const [bankIndexStatus, setBankIndexStatus] = React.useState<any>(null);
  const [bankIndexRebuilding, setBankIndexRebuilding] = React.useState(false);
  const [bankMaintenanceRunning, setBankMaintenanceRunning] = React.useState<string | null>(null);
  const [bankMaintenanceResult, setBankMaintenanceResult] = React.useState<any>(null);
  const [bankDiagnosticsRunning, setBankDiagnosticsRunning] = React.useState(false);
  const [bankDiagnostics, setBankDiagnostics] = React.useState<any>(null);


  const [thumbnailStatus, setThumbnailStatus] = React.useState<any>(null);
  const [thumbnailBatchRunning, setThumbnailBatchRunning] = React.useState(false);
  const [thumbnailProgress, setThumbnailProgress] = React.useState<{
    completed: number;
    failed: number;
    total: number;
  } | null>(null);
  const [bankCapacityOpen, setBankCapacityOpen] = React.useState(false);
  const [bankCapacityLoading, setBankCapacityLoading] = React.useState(false);
  const [bankCapacity, setBankCapacity] = React.useState<any>(null);
  const [bankCapacityGrade, setBankCapacityGrade] = React.useState<string>("");
  const [bankCapacityCourseId, setBankCapacityCourseId] = React.useState<string>("");
  const [bankMinimumStock, setBankMinimumStock] = React.useState(5);



  const bankRestoreInputRef = React.useRef<HTMLInputElement>(null);

  const [bankSearchOpen, setBankSearchOpen] = React.useState(false);
  const [bankSearchLoading, setBankSearchLoading] = React.useState(false);
  const [bankSearchResults, setBankSearchResults] = React.useState<any[]>([]);
  const [bankSearchTotal, setBankSearchTotal] = React.useState(0);
  const [bankSearchOffset, setBankSearchOffset] = React.useState(0);
  const [bankSearchPreview, setBankSearchPreview] = React.useState<any>(null);
  const [bankSearchFilters, setBankSearchFilters] = React.useState<any>({
    grade: "",
    courseId: "",
    unitId: "",
    topicId: "",
    outcomeId: "",
    answer: "",
    usage: "",
    q: "",
  });





  React.useEffect(() => {
    setPasteOpen(false);
    setPasteText("");
    setPasteRows([]);
    setPasteErrors([]);
    setFocusedCourseName(null);
    setCurriculumBuilderGrade(
      String(curriculumActiveGrade || "").match(/(9|10|11|12)/)?.[1] || "9",
    );
    setCurriculumBuilderCourseId("");
  }, [curriculumActiveGrade]);

  // Aktif sınıf seviyesindeki tüm dersleri göster. Müfredatı yüklenmiş dersler
  // önce, yüklenmemiş dersler sonra gelir; her iki grup da alfabetik sıralanır.
  const visibleCourses = curriculumCourses
    .filter(
      (course: any) =>
        !deletedCurriculumCourses.includes(course.id) &&
        (!focusedCourseName ||
          normalizeName(course.courseName) === normalizeName(focusedCourseName)),
    )
    .sort((a: any, b: any) => {
      const aLoaded = hasCourseCurriculum(a.id);
      const bLoaded = hasCourseCurriculum(b.id);
      if (aLoaded !== bLoaded) return aLoaded ? -1 : 1;
      return String(a.courseName || "").localeCompare(
        String(b.courseName || ""),
        "tr-TR",
        { sensitivity: "base" },
      );
    });

  const loadedCourseCount = visibleCourses.filter((course: any) =>
    hasCourseCurriculum(course.id),
  ).length;

  const toggleCourseFocus = (courseName: string) => {
    setFocusedCourseName((current) =>
      current && normalizeName(current) === normalizeName(courseName)
        ? null
        : courseName,
    );
  };

  const toggleMapKey = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    key: string,
  ) => setter((prev) => ({ ...prev, [key]: !prev[key] }));

  const uploadToTarget = async (
    courseId: string,
    unitId: string,
    topicId: string,
    outcomeId: string,
    targetType: "topic" | "outcome",
    questionType: "exam" | "study",
    files: File[],
  ) => {
    const imageFiles = files.filter((file) => {
      const name = String(file.name || "").toLocaleLowerCase("tr-TR");
      return (
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg")
      );
    });

    if (imageFiles.length === 0) return;

    const answerKey = outcomeId || topicId;
    const answer = answersByOutcome[answerKey] || "A";
    if (typeof uploadQuestionImages !== "function") {
      throw new Error("Soru yükleme servisi bağlı değil.");
    }
    const result = await uploadQuestionImages(
      courseId,
      unitId,
      topicId,
      outcomeId,
      imageFiles,
      answer,
      undefined,
      targetType,
      questionType,
    );

    setExpandedCourses((prev) => ({ ...prev, [courseId]: true }));
    setExpandedUnits((prev) => ({ ...prev, [unitId]: true }));
    setExpandedTopics((prev) => ({ ...prev, [topicId]: true }));
    if (outcomeId) setExpandedOutcomes((prev) => ({ ...prev, [outcomeId]: true }));
    return result;
  };

  const openQuestionUploadChoice = (target: any) => {
    setQuestionUploadChoiceTarget(target);
    setPendingQuestionType(null);
    setQuestionUploadStatus("");
  };

  const chooseQuestionType = (questionType: "exam" | "study") => {
    setPendingQuestionType(questionType);
  };

  const chooseQuestionUploadMode = (mode: "single" | "multiple" | "folder") => {
    window.setTimeout(() => {
      if (mode === "single") questionUploadSingleInputRef.current?.click();
      else if (mode === "multiple") questionUploadMultipleInputRef.current?.click();
      else questionUploadFolderInputRef.current?.click();
    }, 0);
  };

  const processQuestionUploadFiles = async (files: File[]) => {
    const target = questionUploadChoiceTarget;
    const questionType = pendingQuestionType;
    if (!target || !questionType || files.length === 0) {
      setQuestionUploadStatus("Yüklenecek dosya seçilmedi.");
      return;
    }
    if (typeof uploadQuestionImages !== "function") {
      setQuestionUploadStatus("Soru yükleme servisi bağlı değil. Sayfayı yenileyip tekrar deneyin.");
      return;
    }
    setQuestionUploadRunning(true);
    setQuestionUploadStatus(`${files.length} dosya kontrol ediliyor ve yükleniyor…`);
    try {
      const result = await uploadToTarget(
        target.courseId,
        target.unitId,
        target.topicId,
        target.outcomeId || "",
        target.targetType,
        questionType,
        files,
      );
      const uploaded = Number((result as any)?.uploaded || 0);
      const relinked = Number((result as any)?.relinked || 0);
      const skipped = Number((result as any)?.skipped || (result as any)?.duplicate || 0);
      if (result && (uploaded > 0 || relinked > 0 || skipped > 0)) {
        await loadCanonicalQuestions(
          target.courseId,
          target.unitId,
          target.topicId,
          target.outcomeId || "",
        );
        await loadCanonicalCounts();
        setQuestionUploadStatus(
          (result as any)?.message ||
            `${uploaded} yeni soru yüklendi.${relinked > 0 ? ` ${relinked} mevcut soru bu hedefe bağlandı.` : ""}${skipped > 0 ? ` ${skipped} soru zaten kayıtlı.` : ""}`,
        );
        window.setTimeout(() => {
          setQuestionUploadChoiceTarget(null);
          setPendingQuestionType(null);
          setQuestionUploadStatus("");
        }, 900);
      } else {
        setQuestionUploadStatus((result as any)?.error || "Soru yüklenemedi. Sunucu yanıtı alınamadı.");
      }
    } catch (error) {
      console.error("Soru yükleme akışı hatası:", error);
      setQuestionUploadStatus(
        `Soru yüklenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setQuestionUploadRunning(false);
    }
  };

  const handleQuestionUploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await processQuestionUploadFiles(files);
  };


  const openQuestionViewer = (
    course: any,
    unit: any,
    topic: any,
    outcome: any,
    question: any,
  ) => {
    const grade =
      Number(String(curriculumActiveGrade || "").match(/\d+/)?.[0] || 0);
    const identity = questionIdentity(question);
    const nextViewer = {
      grade,
      courseId: course.id,
      courseName: course.courseName,
      unitId: unit.id,
      topicId: topic.id,
      outcomeId: outcome.id,
      questionId: identity,
    };
    setQuestionViewer(nextViewer);
    setMoveDraft({
      grade,
      courseId: course.id,
      unitId: unit.id,
      topicId: topic.id,
      outcomeId: outcome.id,
      answer: String(question.answer || "A").toUpperCase(),
    });
    setExpandedMoveUnitId(String(unit.id));
    setViewerZoom(1);
  };

  const viewerContext = React.useMemo(() => {
    if (!questionViewer) return null;
    const curriculum = getCourseCurriculum?.(questionViewer.courseId) || { units: [] };
    const unit = (curriculum.units || []).find(
      (item: any) => String(item.id) === String(questionViewer.unitId),
    );
    const topic = unit?.topics?.find(
      (item: any) => String(item.id) === String(questionViewer.topicId),
    );
    const outcome = topic?.outcomes?.find(
      (item: any) => String(item.id) === String(questionViewer.outcomeId),
    );
    const questions = [...(outcome?.questions || [])].sort(
      (a: any, b: any) => Number(a.order || 0) - Number(b.order || 0),
    );
    const index = questions.findIndex(
      (item: any) => questionIdentity(item) === String(questionViewer.questionId),
    );
    return {
      curriculum,
      unit,
      topic,
      outcome,
      questions,
      index,
      question: index >= 0 ? questions[index] : null,
    };
  }, [questionViewer, getCourseCurriculum, curriculumMoveCatalog]);

  const navigateViewer = React.useCallback(
    (direction: number) => {
      if (!questionViewer || !viewerContext || viewerContext.questions.length === 0) return;
      const currentIndex = Math.max(0, viewerContext.index);
      const nextIndex =
        (currentIndex + direction + viewerContext.questions.length) %
        viewerContext.questions.length;
      const nextQuestion = viewerContext.questions[nextIndex];
      setQuestionViewer((prev: any) => ({
        ...prev,
        questionId: questionIdentity(nextQuestion),
      }));
      setMoveDraft((prev: any) => ({
        ...prev,
        answer: String(nextQuestion.answer || "A").toUpperCase(),
      }));
      setExpandedMoveUnitId(String(questionViewer.unitId));
      setViewerZoom(1);
    },
    [questionViewer, viewerContext],
  );

  React.useEffect(() => {
    if (!questionViewer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuestionViewer(null);
      if (event.key === "ArrowLeft") navigateViewer(-1);
      if (event.key === "ArrowRight") navigateViewer(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [questionViewer, navigateViewer]);

  const selectedMoveGrade = curriculumMoveCatalog.find(
    (entry: any) => Number(entry.grade) === Number(moveDraft?.grade),
  );
  const selectedMoveCourse = selectedMoveGrade?.courses?.find(
    (course: any) => String(course.id) === String(moveDraft?.courseId),
  );
  const selectedMoveUnit = selectedMoveCourse?.curriculum?.units?.find(
    (unit: any) => String(unit.id) === String(moveDraft?.unitId),
  );
  const selectedMoveTopic = selectedMoveUnit?.topics?.find(
    (topic: any) => String(topic.id) === String(moveDraft?.topicId),
  );

  const updateMoveGrade = (grade: number) => {
    const gradeEntry = curriculumMoveCatalog.find(
      (entry: any) => Number(entry.grade) === Number(grade),
    );
    const course = gradeEntry?.courses?.find(
      (item: any) => (item.curriculum?.units || []).length > 0,
    ) || gradeEntry?.courses?.[0];
    const unit = course?.curriculum?.units?.[0];
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setMoveDraft((prev: any) => ({
      ...prev,
      grade,
      courseId: course?.id || "",
      unitId: unit?.id || "",
      topicId: topic?.id || "",
      outcomeId: outcome?.id || "",
    }));
    setExpandedMoveUnitId(String(unit?.id || ""));
  };

  const updateMoveCourse = (courseId: string) => {
    const course = selectedMoveGrade?.courses?.find(
      (item: any) => String(item.id) === String(courseId),
    );
    const unit = course?.curriculum?.units?.[0];
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setMoveDraft((prev: any) => ({
      ...prev,
      courseId,
      unitId: unit?.id || "",
      topicId: topic?.id || "",
      outcomeId: outcome?.id || "",
    }));
    setExpandedMoveUnitId(String(unit?.id || ""));
  };

  const updateMoveUnit = (unitId: string) => {
    const unit = selectedMoveCourse?.curriculum?.units?.find(
      (item: any) => String(item.id) === String(unitId),
    );
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setMoveDraft((prev: any) => ({
      ...prev,
      unitId,
      topicId: topic?.id || "",
      outcomeId: outcome?.id || "",
    }));
  };

  const updateMoveTopic = (topicId: string) => {
    const topic = selectedMoveUnit?.topics?.find(
      (item: any) => String(item.id) === String(topicId),
    );
    const outcome = topic?.outcomes?.[0];
    setMoveDraft((prev: any) => ({
      ...prev,
      topicId,
      outcomeId: outcome?.id || "",
    }));
  };

  const saveQuestionMove = async () => {
    if (!questionViewer || !moveDraft?.courseId || !moveDraft?.outcomeId) return;
    const result = await moveQuestion?.(
      {
        courseId: questionViewer.courseId,
        unitId: questionViewer.unitId,
        topicId: questionViewer.topicId,
        outcomeId: questionViewer.outcomeId,
        questionId: questionViewer.questionId,
      },
      moveDraft,
    );
    if (result) {
      setQuestionViewer((prev: any) => ({ ...prev, ...result }));
      setMoveDraft((prev: any) => ({ ...prev, ...result }));
      setExpandedMoveUnitId(String(result.unitId || ""));
      setViewerZoom(1);
    }
  };

  const pasteHeaders = [
    "SINIF_KODU",
    "DERS_KODU",
    "DERS_ADI",
    "UNITE_NO",
    "UNITE_ADI",
    "KONU_NO",
    "KONU_ADI",
    "KAZANIM_NO",
    "KAZANIM_ADI",
    "KAZANIM_KODU",
    "SORU_SIRA_NO",
    "SORU_CEVABI",
    "SORU_KODU",
  ];

  const gradeNumber = Number(String(curriculumActiveGrade || "").match(/\d+/)?.[0] || 0);

  const parsePastedCurriculum = (rawText: string) => {
    const normalized = String(rawText || "").replace(/\r/g, "").trim();
    if (!normalized) {
      setPasteRows([]);
      setPasteErrors([]);
      return;
    }

    const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
    const matrix = lines.map((line) => line.split("\t"));
    const normalizeHeader = (value: unknown) =>
      String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const headerAliases: Record<string, string> = {
      SINIF_DUZEYI: "SINIF_KODU",
      SINIF: "SINIF_KODU",
      SINIF_SEVIYESI: "SINIF_KODU",
      DERS_ID: "DERS_KODU",
      DERS_NO: "DERS_KODU",
    };

    const firstRow = matrix[0] || [];
    const normalizedFirstRow = firstRow.map((cell) => normalizeHeader(cell));
    const hasHeader = normalizedFirstRow.some((cell) =>
      ["SINIF_KODU", "SINIF_DUZEYI", "DERS_KODU", "DERS_ID", "DERS_ADI", "UNITE_NO", "KAZANIM_ADI"].includes(cell),
    );

    const sourceHeaders = hasHeader
      ? normalizedFirstRow.map((header) => headerAliases[header] || header)
      : pasteHeaders;
    const dataRows = hasHeader ? matrix.slice(1) : matrix;

    const result: any[] = [];
    const errors: string[] = [];
    const carry: Record<string, any> = {};
    const carryFields = [
      "SINIF_KODU",
      "DERS_KODU",
      "DERS_ADI",
      "UNITE_NO",
      "UNITE_ADI",
      "KONU_NO",
      "KONU_ADI",
    ];

    dataRows.forEach((cells, index) => {
      const excelRow = index + (hasHeader ? 2 : 1);
      const row: Record<string, any> = {};
      sourceHeaders.forEach((header, columnIndex) => {
        if (!header) return;
        row[header] = String(cells[columnIndex] ?? "").trim();
      });

      carryFields.forEach((field) => {
        if (String(row[field] ?? "").trim()) {
          carry[field] = row[field];
        } else if (carry[field] !== undefined) {
          row[field] = carry[field];
        }
      });

      // Sınıf kodu Excel satırından okunur; yalnızca boş bırakılmışsa aktif sınıf geri dönüş olarak kullanılır.
      if (!row.SINIF_KODU) row.SINIF_KODU = gradeNumber;

      const grade = Number(String(row.SINIF_KODU || "").match(/(9|10|11|12)/)?.[1] || 0);
      const courseCode = String(row.DERS_KODU || "").trim();
      const unitNo = Number(row.UNITE_NO);
      const topicNo = Number(row.KONU_NO);
      const outcomeNo = Number(row.KAZANIM_NO);
      const answer = String(row.SORU_CEVABI || "").toLocaleUpperCase("tr-TR");

      if (![9, 10, 11, 12].includes(grade)) {
        errors.push(`${excelRow}. satır: Sınıf kodu 9, 10, 11 veya 12 olmalıdır.`);
        return;
      }
      if (!courseCode) {
        errors.push(`${excelRow}. satır: Ders kodu eksik.`);
        return;
      }
      if (!unitNo || !String(row.UNITE_ADI || "").trim()) {
        errors.push(`${excelRow}. satır: Ünite numarası veya adı eksik.`);
        return;
      }
      if (!topicNo || !String(row.KONU_ADI || "").trim()) {
        errors.push(`${excelRow}. satır: Konu numarası veya adı eksik.`);
        return;
      }
      if (!outcomeNo || !String(row.KAZANIM_ADI || "").trim()) {
        errors.push(`${excelRow}. satır: Kazanım numarası veya adı eksik.`);
        return;
      }

      const outcomeCode = `${grade}.${courseCode}.${unitNo}.${topicNo}.${outcomeNo}`;
      row.KAZANIM_KODU = outcomeCode;

      const questionNo = Number(row.SORU_SIRA_NO || 0);
      if (questionNo > 0) {
        if (!["A", "B", "C", "D", "E"].includes(answer)) {
          errors.push(`${excelRow}. satır: Soru cevabı A, B, C, D veya E olmalıdır.`);
          return;
        }
        row.SORU_CEVABI = answer;
        row.SORU_KODU = `${outcomeCode}_${questionNo}_${answer}`;
      }

      result.push(row);
    });

    setPasteRows(result);
    setPasteErrors(errors);
  };

  const importPastedCurriculum = () => {
    if (pasteRows.length === 0) return;
    const ok = applyPastedCurriculumRows?.(pasteRows);
    if (ok !== false) {
      setPasteText("");
      setPasteRows([]);
      setPasteErrors([]);
      setPasteOpen(false);
    }
  };

  const bankSearchGradeEntry = curriculumMoveCatalog.find(
    (entry: any) => String(entry.grade) === String(bankSearchFilters.grade),
  );
  const bankSearchCourse = bankSearchGradeEntry?.courses?.find(
    (course: any) => String(course.id) === String(bankSearchFilters.courseId),
  );
  const bankSearchUnit = bankSearchCourse?.curriculum?.units?.find(
    (unit: any) => String(unit.id) === String(bankSearchFilters.unitId),
  );
  const bankSearchTopic = bankSearchUnit?.topics?.find(
    (topic: any) => String(topic.id) === String(bankSearchFilters.topicId),
  );

  const updateBankSearchFilter = (key: string, value: string) => {
    setBankSearchOffset(0);
    setBankSearchFilters((prev: any) => {
      const next = { ...prev, [key]: value };
      if (key === "grade") {
        next.courseId = "";
        next.unitId = "";
        next.topicId = "";
        next.outcomeId = "";
      } else if (key === "courseId") {
        next.unitId = "";
        next.topicId = "";
        next.outcomeId = "";
      } else if (key === "unitId") {
        next.topicId = "";
        next.outcomeId = "";
      } else if (key === "topicId") {
        next.outcomeId = "";
      }
      return next;
    });
  };

  const runQuestionBankSearch = async (offset = 0) => {
    setBankSearchLoading(true);
    try {
      const result = await listQuestionBankRecords({
        status: "active",
        grade: bankSearchFilters.grade ? Number(bankSearchFilters.grade) : undefined,
        courseId: bankSearchFilters.courseId || undefined,
        unitId: bankSearchFilters.unitId || undefined,
        topicId: bankSearchFilters.topicId || undefined,
        outcomeId: bankSearchFilters.outcomeId || undefined,
        answer: bankSearchFilters.answer || undefined,
        usage: bankSearchFilters.usage || undefined,
        q: bankSearchFilters.q || undefined,
        limit: 24,
        offset,
      });
      setBankSearchResults(Array.isArray(result?.questions) ? result.questions : []);
      setBankSearchTotal(Number(result?.total || 0));
      setBankSearchOffset(offset);
    } catch (error) {
      console.error("Soru bankası araması yapılamadı:", error);
      setBankSearchResults([]);
      setBankSearchTotal(0);
    } finally {
      setBankSearchLoading(false);
    }
  };

  const openQuestionBankSearch = () => {
    setBankSearchOpen(true);
    setBankSearchOffset(0);
    void runQuestionBankSearch(0);
  };

  const resetQuestionBankSearch = () => {
    setBankSearchFilters({
      grade: "",
      courseId: "",
      unitId: "",
      topicId: "",
      outcomeId: "",
      answer: "",
      q: "",
    });
    setBankSearchOffset(0);
    setBankSearchResults([]);
    setBankSearchTotal(0);
    setTimeout(() => void runQuestionBankSearch(0), 0);
  };

  const curriculumCoverage = React.useMemo(() => {
    const selectedGrades =
      bankCapacityGrade
        ? curriculumMoveCatalog.filter(
            (entry: any) => String(entry.grade) === String(bankCapacityGrade),
          )
        : curriculumMoveCatalog;

    const allOutcomes: any[] = [];
    const courseSummaries: any[] = [];

    selectedGrades.forEach((gradeEntry: any) => {
      (gradeEntry.courses || []).forEach((course: any) => {
        if (
          bankCapacityCourseId &&
          String(course.id) !== String(bankCapacityCourseId)
        ) {
          return;
        }

        let totalOutcomeCount = 0;
        const courseOutcomes: any[] = [];

        (course.curriculum?.units || []).forEach((unit: any) => {
          (unit.topics || []).forEach((topic: any) => {
            (topic.outcomes || []).forEach((outcome: any) => {
              totalOutcomeCount += 1;
              const item = {
                grade: Number(gradeEntry.grade),
                courseId: String(course.id),
                courseName: course.courseName,
                unitId: String(unit.id),
                unitName: unit.name,
                topicId: String(topic.id),
                topicName: topic.name,
                outcomeId: String(outcome.id),
                outcomeName: outcome.name || outcome.text || "",
              };
              courseOutcomes.push(item);
              allOutcomes.push(item);
            });
          });
        });

        courseSummaries.push({
          grade: Number(gradeEntry.grade),
          courseId: String(course.id),
          courseName: course.courseName,
          totalOutcomeCount,
          outcomes: courseOutcomes,
        });
      });
    });

    const statsByOutcome = new Map<string, any>(
      (bankCapacity?.outcomes || []).map((item: any) => [
        `${item.grade}::${item.courseId}::${item.outcomeId}`,
        item,
      ]),
    );

    const detailed = allOutcomes.map((outcome) => {
      const stats = statsByOutcome.get(
        `${outcome.grade}::${outcome.courseId}::${outcome.outcomeId}`,
      ) || {
        totalQuestions: 0,
        unusedQuestions: 0,
        usedQuestions: 0,
      };

      const unusedQuestions = Number(stats.unusedQuestions || 0);
      return {
        ...outcome,
        totalQuestions: Number(stats.totalQuestions || 0),
        unusedQuestions,
        usedQuestions: Number(stats.usedQuestions || 0),
        shortage: Math.max(0, bankMinimumStock - unusedQuestions),
        status:
          Number(stats.totalQuestions || 0) === 0
            ? "empty"
            : unusedQuestions < bankMinimumStock
              ? "low"
              : "healthy",
      };
    });

    const summaryByCourse = courseSummaries.map((course) => {
      const rows = detailed.filter(
        (item) =>
          item.grade === course.grade &&
          item.courseId === course.courseId,
      );
      return {
        grade: course.grade,
        courseId: course.courseId,
        courseName: course.courseName,
        totalOutcomes: rows.length,
        emptyOutcomes: rows.filter((item) => item.status === "empty").length,
        lowOutcomes: rows.filter((item) => item.status === "low").length,
        healthyOutcomes: rows.filter((item) => item.status === "healthy").length,
        totalQuestions: rows.reduce(
          (sum, item) => sum + item.totalQuestions,
          0,
        ),
        unusedQuestions: rows.reduce(
          (sum, item) => sum + item.unusedQuestions,
          0,
        ),
      };
    });

    return {
      outcomes: detailed,
      courses: summaryByCourse,
      emptyOutcomes: detailed.filter((item) => item.status === "empty"),
      lowOutcomes: detailed.filter((item) => item.status === "low"),
      healthyOutcomes: detailed.filter((item) => item.status === "healthy"),
      totalCurriculumOutcomes: detailed.length,
    };
  }, [
    curriculumMoveCatalog,
    bankCapacity,
    bankCapacityGrade,
    bankCapacityCourseId,
    bankMinimumStock,
  ]);

  const curriculumOutcomeRouteMap = React.useMemo(() => {
    const map = new Map<string, {
      courseId: string;
      courseName: string;
      unitId: string;
      topicId: string;
      outcomeId: string;
    }>();

    curriculumCourses.forEach((course: any) => {
      const curriculum = getCourseCurriculum?.(course.id) || { units: [] };
      (curriculum.units || []).forEach((unit: any) => {
        (unit.topics || []).forEach((topic: any) => {
          (topic.outcomes || []).forEach((outcome: any) => {
            const ids = [
              String(outcome.id || "").trim(),
              String(outcome.code || "").trim(),
            ].filter(Boolean);

            ids.forEach((id) => {
              map.set(id, {
                courseId: String(course.id),
                courseName: String(course.courseName || ""),
                unitId: String(unit.id),
                topicId: String(topic.id),
                outcomeId: String(outcome.id || outcome.code || ""),
              });
            });
          });
        });
      });
    });

    return map;
  }, [
    curriculumCourses,
    getCourseCurriculum,
    curriculumActiveGrade,
  ]);

  const detectOutcomeRouteForFile = (file: File) => {
    const relativePath = String(
      (file as any).webkitRelativePath || file.name || "",
    )
      .replace(/\\/g, "/")
      .trim();

    const segments = relativePath
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    // En güvenli yöntem: klasör/segment adı doğrudan kazanım koduysa eşleştir.
    for (let index = segments.length - 2; index >= 0; index -= 1) {
      const segment = segments[index];
      const direct = curriculumOutcomeRouteMap.get(segment);
      if (direct) return direct;
    }

    // İkinci yöntem: dosya adı kazanım koduyla başlıyorsa eşleştir.
    const fileStem = String(file.name || "").replace(/\.[^.]+$/, "");
    const sortedIds = [...curriculumOutcomeRouteMap.keys()].sort(
      (a, b) => b.length - a.length,
    );
    for (const outcomeId of sortedIds) {
      if (
        fileStem === outcomeId ||
        fileStem.startsWith(`${outcomeId}_`) ||
        fileStem.startsWith(`${outcomeId}-`)
      ) {
        return curriculumOutcomeRouteMap.get(outcomeId) || null;
      }
    }

    return null;
  };

  const detectAnswerFromQuestionFileName = (fileName: string) => {
    const stem = String(fileName || "").replace(/\.[^.]+$/, "");
    const match = stem.match(/(?:^|[_\-\s])([A-E])$/i);
    return match ? match[1].toUpperCase() : "";
  };

  const smartFolderFileSignature = (file: File) =>
    [
      String(file.name || "").toLocaleLowerCase("tr-TR"),
      String(file.size || 0),
      String(file.lastModified || 0),
    ].join("::");

  const analyzeSmartQuestionFolder = (files: File[]) => {
    const imageFiles = files.filter((file) => {
      const name = String(file.name || "").toLocaleLowerCase("tr-TR");
      return (
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg")
      );
    });

    if (imageFiles.length === 0) {
      setSmartFolderImportResult({
        success: false,
        message: "Seçilen klasörde JPG/JPEG/PNG soru kartı bulunamadı.",
      });
      return;
    }

    const groups = new Map<string, {
      route: {
        courseId: string;
        courseName: string;
        unitId: string;
        topicId: string;
        outcomeId: string;
      };
      files: File[];
    }>();

    const unmatched: Array<{ name: string; path: string }> = [];
    const invalidAnswer: Array<{ name: string; path: string }> = [];
    const duplicates: Array<{ name: string; path: string }> = [];
    const seenSignatures = new Set<string>();
    const validFiles: File[] = [];

    imageFiles.forEach((file) => {
      const relativePath = String(
        (file as any).webkitRelativePath || file.name || "",
      );

      const signature = smartFolderFileSignature(file);
      if (seenSignatures.has(signature)) {
        duplicates.push({
          name: file.name,
          path: relativePath,
        });
        return;
      }
      seenSignatures.add(signature);

      const answer = detectAnswerFromQuestionFileName(file.name);
      if (!answer) {
        invalidAnswer.push({
          name: file.name,
          path: relativePath,
        });
        return;
      }

      const route = detectOutcomeRouteForFile(file);
      if (!route) {
        unmatched.push({
          name: file.name,
          path: relativePath,
        });
        return;
      }

      validFiles.push(file);

      const key = `${route.courseId}::${route.outcomeId}`;
      const group = groups.get(key) || { route, files: [] };
      group.files.push(file);
      groups.set(key, group);
    });

    const matchedGroups = [...groups.values()]
      .map((group) => ({
        ...group,
        fileCount: group.files.length,
        answerDistribution: group.files.reduce<Record<string, number>>(
          (acc, file) => {
            const answer = detectAnswerFromQuestionFileName(file.name);
            if (answer) acc[answer] = Number(acc[answer] || 0) + 1;
            return acc;
          },
          {},
        ),
        sampleFiles: group.files.slice(0, 5).map((file) => ({
          name: file.name,
          path: String((file as any).webkitRelativePath || file.name || ""),
          answer: detectAnswerFromQuestionFileName(file.name),
        })),
      }))
      .sort((a, b) =>
        String(a.route.outcomeId).localeCompare(
          String(b.route.outcomeId),
          "tr-TR",
          { numeric: true },
        ),
      );

    const matchedCount = matchedGroups.reduce(
      (sum, group) => sum + group.fileCount,
      0,
    );

    setSmartFolderPendingFiles(validFiles);
    setSmartFolderExcludedOutcomes({});
    setSmartFolderRouteOverrides({});
    setSmartFolderPreview({
      totalImages: imageFiles.length,
      matchedCount,
      unmatchedCount: unmatched.length,
      invalidAnswerCount: invalidAnswer.length,
      duplicateCount: duplicates.length,
      rejectedCount:
        unmatched.length + invalidAnswer.length + duplicates.length,
      matchedGroups,
      unmatched,
      invalidAnswer,
      duplicates,
    });
    setSmartFolderPreviewOpen(true);
    setSmartFolderImportResult(null);

    if (smartFolderInputRef.current) {
      smartFolderInputRef.current.value = "";
    }
  };


  const smartFolderOutcomeOptions = React.useMemo(() => {
    const options: Array<{
      outcomeId: string;
      courseId: string;
      courseName: string;
      unitId: string;
      unitName: string;
      topicId: string;
      topicName: string;
    }> = [];

    curriculumCourses.forEach((course: any) => {
      const curriculum = getCourseCurriculum?.(course.id) || { units: [] };
      (curriculum.units || []).forEach((unit: any) => {
        (unit.topics || []).forEach((topic: any) => {
          (topic.outcomes || []).forEach((outcome: any) => {
            options.push({
              outcomeId: String(outcome.id || outcome.code || ""),
              courseId: String(course.id),
              courseName: String(course.courseName || ""),
              unitId: String(unit.id),
              unitName: String(unit.name || ""),
              topicId: String(topic.id),
              topicName: String(topic.name || ""),
            });
          });
        });
      });
    });

    return options.sort((a, b) =>
      a.outcomeId.localeCompare(b.outcomeId, "tr-TR", { numeric: true }),
    );
  }, [curriculumCourses, getCourseCurriculum, curriculumActiveGrade]);

  const loadImportSessionHistory = async () => {
    setImportSessionHistoryLoading(true);
    try {
      const result = await listQuestionBankImportSessions(30);
      setImportSessionHistory(
        Array.isArray(result?.sessions) ? result.sessions : [],
      );
    } catch (error) {
      console.error("İçe aktarma geçmişi okunamadı:", error);
    } finally {
      setImportSessionHistoryLoading(false);
    }
  };

  const openImportSessionHistory = () => {
    setImportSessionHistoryOpen(true);
    void loadImportSessionHistory();
  };

  const rollbackImportSession = async (session: any) => {
    const activeCount = Number(session?.activeQuestionCount || 0);
    if (activeCount <= 0) return;

    const approved = window.confirm(
      `"${session.label || "İçe aktarma"}" oturumunda eklenen ${activeCount} aktif soru geri alınacak. Sorular çöp kutusuna taşınacak. Devam edilsin mi?`,
    );
    if (!approved) return;

    setRollingBackImportSessionId(String(session.id));
    try {
      const result = await rollbackQuestionBankImportSession(String(session.id));
      removeQuestionsByImportSession?.(String(session.id));
      await loadImportSessionHistory();
      await loadQuestionBankHealth(true);
      setSmartFolderImportResult({
        success: Boolean(result?.success),
        message: result?.success
          ? `${result.rolledBack || 0} soru son içe aktarma oturumundan geri alındı.`
          : `${result.rolledBack || 0} soru geri alındı; ${result.failed || 0} soru geri alınamadı.`,
      });
    } catch (error) {
      console.error("İçe aktarma geri alınamadı:", error);
    } finally {
      setRollingBackImportSessionId(null);
    }
  };

  const smartFolderGroupKey = (group: any) =>
    `${group?.route?.courseId || ""}::${group?.route?.outcomeId || ""}`;

  const smartFolderSelectedGroups = React.useMemo(
    () =>
      (smartFolderPreview?.matchedGroups || []).filter(
        (group: any) => !smartFolderExcludedOutcomes[smartFolderGroupKey(group)],
      ),
    [smartFolderPreview, smartFolderExcludedOutcomes],
  );

  const smartFolderSelectedFileCount = React.useMemo(
    () =>
      smartFolderSelectedGroups.reduce(
        (sum: number, group: any) => sum + Number(group.fileCount || 0),
        0,
      ),
    [smartFolderSelectedGroups],
  );

  const toggleSmartFolderOutcome = (group: any) => {
    const key = smartFolderGroupKey(group);
    setSmartFolderExcludedOutcomes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const executeSmartQuestionFolderImport = async () => {
    if (smartFolderImportRunning || !smartFolderPreview) return;

    const imageFiles = smartFolderPendingFiles;
    if (imageFiles.length === 0) {
      setSmartFolderPreviewOpen(false);
      return;
    }

    setSmartFolderImportRunning(true);
    setSmartFolderImportResult(null);

    let importSession: any = null;

    try {
      importSession = await createQuestionBankImportSession({
        label: `Akıllı Klasör İçe Aktarma • ${new Date().toLocaleString("tr-TR")}`,
        source: "CourseCurriculumPanel",
        grade: Number(String(curriculumActiveGrade).replace(/[^0-9]/g, "") || 0),
        courseCount: new Set(
          smartFolderSelectedGroups.map((group: any) => String(group.route.courseId)),
        ).size,
        expectedFiles: smartFolderSelectedFileCount,
        expectedOutcomes: smartFolderSelectedGroups.length,
      });

      const groups = new Map<string, {
        route: {
          courseId: string;
          courseName: string;
          unitId: string;
          topicId: string;
          outcomeId: string;
        };
        files: File[];
      }>();

      imageFiles.forEach((file) => {
        const detectedRoute = detectOutcomeRouteForFile(file);
        if (!detectedRoute) return;

        const originalKey = `${detectedRoute.courseId}::${detectedRoute.outcomeId}`;
        if (smartFolderExcludedOutcomes[originalKey]) return;

        const overrideOutcomeId = smartFolderRouteOverrides[originalKey];
        const override = overrideOutcomeId
          ? smartFolderOutcomeOptions.find(
              (item) => item.outcomeId === overrideOutcomeId,
            )
          : null;

        const route = override
          ? {
              courseId: override.courseId,
              courseName: override.courseName,
              unitId: override.unitId,
              topicId: override.topicId,
              outcomeId: override.outcomeId,
            }
          : detectedRoute;

        const key = `${route.courseId}::${route.outcomeId}`;
        const group = groups.get(key) || { route, files: [] };
        group.files.push(file);
        groups.set(key, group);
      });

      let importedFiles = 0;
      let completedOutcomes = 0;
      const failedGroups: Array<{
        outcomeId: string;
        count: number;
        error: string;
      }> = [];

      for (const group of groups.values()) {
        try {
          const answer = answersByOutcome[group.route.outcomeId] || "A";
          await uploadQuestionImages?.(
            group.route.courseId,
            group.route.unitId,
            group.route.topicId,
            group.route.outcomeId,
            group.files,
            answer,
            String(importSession?.id || ""),
          );

          importedFiles += group.files.length;
          completedOutcomes += 1;

          setExpandedCourses((prev) => ({
            ...prev,
            [group.route.courseId]: true,
          }));
          setExpandedUnits((prev) => ({
            ...prev,
            [group.route.unitId]: true,
          }));
          setExpandedTopics((prev) => ({
            ...prev,
            [group.route.topicId]: true,
          }));
          setExpandedOutcomes((prev) => ({
            ...prev,
            [group.route.outcomeId]: true,
          }));
        } catch (error) {
          failedGroups.push({
            outcomeId: group.route.outcomeId,
            count: group.files.length,
            error:
              error instanceof Error
                ? error.message
                : "Yükleme başarısız.",
          });
        }
      }

      if (importSession?.id) {
        await updateQuestionBankImportSession(String(importSession.id), {
          status: failedGroups.length > 0 ? "completed-with-errors" : "completed",
          importedFiles,
          completedOutcomes,
          failedGroups: failedGroups.length,
          completedAt: new Date().toISOString(),
        });
      }

      setSmartFolderPreviewOpen(false);
      setSmartFolderPendingFiles([]);
      setSmartFolderExcludedOutcomes({});
      setSmartFolderRouteOverrides({});
      setSmartFolderImportResult({
        success: failedGroups.length === 0,
        importedFiles,
        completedOutcomes,
        unmatchedCount: Number(smartFolderPreview.unmatchedCount || 0),
        unmatched: (smartFolderPreview.unmatched || [])
          .slice(0, 50)
          .map((item: any) => item.path || item.name),
        failedGroups,
        totalImages: Number(smartFolderPreview.totalImages || imageFiles.length),
        importSessionId: String(importSession?.id || ""),
      });
    } catch (error) {
      if (importSession?.id) {
        try {
          await updateQuestionBankImportSession(String(importSession.id), {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date().toISOString(),
          });
        } catch {}
      }
      setSmartFolderImportResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Akıllı klasör içe aktarma başarısız oldu.",
      });
    } finally {
      setSmartFolderImportRunning(false);
    }
  };

  const cancelSmartFolderPreview = () => {
    setSmartFolderPreviewOpen(false);
    setSmartFolderPreview(null);
    setSmartFolderPendingFiles([]);
    setSmartFolderExcludedOutcomes({});
    setSmartFolderRouteOverrides({});
  };


  const focusCapacityOutcomeForUpload = (item: any) => {
    const target = {
      grade: Number(item.grade || 0),
      courseId: String(item.courseId || ""),
      courseName: String(item.courseName || ""),
      unitId: String(item.unitId || ""),
      topicId: String(item.topicId || ""),
      outcomeId: String(item.outcomeId || ""),
    };

    setBankCapacityOpen(false);
    setCapacityUploadTarget(target);

    const requestedGrade = `${target.grade}. Sınıf`;
    if (
      requestedGrade &&
      String(curriculumActiveGrade) !== requestedGrade &&
      typeof setCurriculumActiveGrade === "function"
    ) {
      setCurriculumActiveGrade(requestedGrade);
    }

    setFocusedCourseName(target.courseName || null);
    setExpandedCourses((prev) => ({ ...prev, [target.courseId]: true }));
    setExpandedUnits((prev) => ({ ...prev, [target.unitId]: true }));
    setExpandedTopics((prev) => ({ ...prev, [target.topicId]: true }));
    setExpandedOutcomes((prev) => ({ ...prev, [target.outcomeId]: true }));
  };

  React.useEffect(() => {
    if (!capacityUploadTarget) return;

    const requestedGrade = `${capacityUploadTarget.grade}. Sınıf`;
    if (
      String(curriculumActiveGrade) !== requestedGrade
    ) {
      return;
    }

    const courseExists = curriculumCourses.some(
      (course: any) =>
        String(course.id) === String(capacityUploadTarget.courseId) ||
        normalizeName(course.courseName) ===
          normalizeName(capacityUploadTarget.courseName),
    );
    if (!courseExists) return;

    setFocusedCourseName(capacityUploadTarget.courseName || null);
    setExpandedCourses((prev) => ({
      ...prev,
      [capacityUploadTarget.courseId]: true,
    }));
    setExpandedUnits((prev) => ({
      ...prev,
      [capacityUploadTarget.unitId]: true,
    }));
    setExpandedTopics((prev) => ({
      ...prev,
      [capacityUploadTarget.topicId]: true,
    }));
    setExpandedOutcomes((prev) => ({
      ...prev,
      [capacityUploadTarget.outcomeId]: true,
    }));

    const timer = window.setTimeout(() => {
      const element = document.querySelector(
        `[data-curriculum-outcome-id="${CSS.escape(
          capacityUploadTarget.outcomeId,
        )}"]`,
      ) as HTMLElement | null;

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        const folderButton = element.querySelector(
          `[data-capacity-folder-upload="${CSS.escape(
            capacityUploadTarget.outcomeId,
          )}"]`,
        ) as HTMLElement | null;

        if (folderButton) {
          folderButton.focus({ preventScroll: true });
        } else {
          element.focus?.({ preventScroll: true });
        }
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    capacityUploadTarget,
    curriculumActiveGrade,
    curriculumCourses,
  ]);

  const loadQuestionBankCapacity = async () => {
    setBankCapacityLoading(true);
    try {
      const result = await getQuestionBankCapacity({
        grade: bankCapacityGrade ? Number(bankCapacityGrade) : undefined,
        courseId: bankCapacityCourseId || undefined,
        minimumStock: bankMinimumStock,
      });
      setBankCapacity(result);
    } catch (error) {
      console.error("Soru bankası kapasite analizi alınamadı:", error);
    } finally {
      setBankCapacityLoading(false);
    }
  };

  const openQuestionBankCapacity = () => {
    setBankCapacityOpen(true);
    void loadQuestionBankCapacity();
  };

  const createQuestionBankBackup = async () => {
    setBankBackupLoading(true);
    try {
      let templates: any[] = [];
      try {
        const raw = sqliteStorage.getItem("question_auto_select_templates_v1");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) templates = parsed;
      } catch {}

      const result = await downloadQuestionBankBackup(templates);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Soru bankası yedeği indirilemedi:", error);
    } finally {
      setBankBackupLoading(false);
    }
  };

  const restoreQuestionBankFromFile = async (file: File | null) => {
    if (!file) return;
    const approved = window.confirm(
      "Yedek mevcut soru bankasına güvenli birleştirme yöntemiyle eklenecek. Mevcut sorular topluca silinmeyecek. Devam edilsin mi?",
    );
    if (!approved) return;

    setBankRestoreLoading(true);
    setBankRestoreResult(null);
    try {
      const result = await restoreQuestionBankBackup(file);
      setBankRestoreResult(result);

      if (Array.isArray(result?.templates) && result.templates.length > 0) {
        let existingTemplates: any[] = [];
        try {
          const raw = sqliteStorage.getItem("question_auto_select_templates_v1");
          const parsed = raw ? JSON.parse(raw) : [];
          existingTemplates = Array.isArray(parsed) ? parsed : [];
        } catch {}

        const byId = new Map<string, any>();
        existingTemplates.forEach((item) => {
          if (item?.id) byId.set(String(item.id), item);
        });
        result.templates.forEach((item: any) => {
          if (!item?.id) return;
          if (!byId.has(String(item.id))) {
            byId.set(String(item.id), item);
          }
        });
        sqliteStorage.setItem(
          "question_auto_select_templates_v1",
          JSON.stringify([...byId.values()]),
        );
      }

      await loadQuestionBankHealth(true);
    } catch (error) {
      console.error("Soru bankası yedeği geri yüklenemedi:", error);
      setBankRestoreResult({
        success: false,
        error: error instanceof Error ? error.message : "Geri yükleme başarısız.",
      });
    } finally {
      setBankRestoreLoading(false);
      if (bankRestoreInputRef.current) {
        bankRestoreInputRef.current.value = "";
      }
    }
  };

  const exportSafeActionAudit = async () => {
    setSafeActionAuditExporting(true);
    try {
      const result = await downloadQuestionBankSafeActionAudit(
        safeActionAuditFilter,
        1000,
      );
      const url = URL.createObjectURL(result.blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = result.fileName;
      document.body.appendChild(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Güvenli eylem geçmişi dışa aktarılamadı:", error);
    } finally {
      setSafeActionAuditExporting(false);
    }
  };

  const cleanSafeActionAudit = async () => {
    const confirmed = window.confirm(
      "90 günden eski ve başarıyla tamamlanmış güvenli eylem kayıtları silinecek. Hatalı veya çalışan kayıtlar korunacak. Devam edilsin mi?",
    );
    if (!confirmed) return;

    setSafeActionAuditCleaning(true);
    try {
      await cleanupQuestionBankSafeActionAudit(90);
      await refreshSafeActionAudit();
    } catch (error) {
      console.error("Güvenli eylem geçmişi temizlenemedi:", error);
    } finally {
      setSafeActionAuditCleaning(false);
    }
  };

  const refreshSafeActionAudit = async () => {
    setSafeActionAuditLoading(true);
    try {
      const result = await getQuestionBankSafeActionAudit(100);
      const items = Array.isArray(result?.items) ? result.items : [];
      setSafeActionAudit(
        safeActionAuditFilter
          ? items.filter(
              (item: any) =>
                String(item.status || "") === safeActionAuditFilter,
            )
          : items,
      );
    } catch {
      setSafeActionAudit([]);
    } finally {
      setSafeActionAuditLoading(false);
    }
  };

  const loadSafeActions = async () => {
    try {
      const result = await getQuestionBankSafeActions();
      setSafeActions(Array.isArray(result?.actions) ? result.actions : []);
    } catch {
      setSafeActions([]);
    }
  };

  const executeSafeRecommendation = async (item: any) => {
    const actionId = String(item?.action || "");
    if (!actionId) return;

    if (actionId === "support-bundle") {
      await downloadSupportBundle();
      return;
    }

    const action = safeActions.find(
      (candidate: any) => String(candidate.id) === actionId,
    );

    if (!action || action.destructive) {
      setSafeActionResult({
        success: false,
        message: "Bu işlem otomatik güvenli işlem listesinde değil.",
      });
      return;
    }

    setSafeActionRunning(actionId);
    setSafeActionResult(null);

    try {
      const result = await runQuestionBankSafeAction(actionId);
      setSafeActionResult({
        success: true,
        actionId,
        label: action.label,
        result,
      });

      await Promise.all([
        loadQuestionBankHealth(true),
        refreshIntegrityHistory(true),
        refreshSafeActionAudit(),
      ]);
    } catch (error) {
      setSafeActionResult({
        success: false,
        actionId,
        label: action?.label || item?.title || actionId,
        message:
          error instanceof Error
            ? error.message
            : "Güvenli işlem tamamlanamadı.",
      });
    } finally {
      setSafeActionRunning(null);
    }
  };

  const refreshProductionReadiness = async () => {
    setProductionReadinessLoading(true);
    try {
      const result = await getQuestionBankProductionReadiness();
      setProductionReadiness(result || null);
    } catch (error) {
      console.error("Üretim hazırlığı alınamadı:", error);
      setProductionReadiness(null);
    } finally {
      setProductionReadinessLoading(false);
    }
  };

  const runDisasterRecoveryDrill = async () => {
    const backupRoot = String(coordinatedBackupResult?.backupRoot || "");
    if (!backupRoot) return;
    setDisasterRecoveryRunning(true);
    setDisasterRecoveryResult(null);
    try {
      const result = await runQuestionBankDisasterRecoveryDrill(backupRoot);
      setDisasterRecoveryResult(result || null);
      await refreshSafeActionAudit();
    } catch (error) {
      setDisasterRecoveryResult({
        success: false,
        message: error instanceof Error ? error.message : "Felaket kurtarma provası başarısız.",
      });
    } finally {
      setDisasterRecoveryRunning(false);
    }
  };

  const createCoordinatedBackup = async () => {
    setCoordinatedBackupRunning(true);
    setCoordinatedBackupResult(null);
    setCoordinatedBackupVerification(null);

    try {
      const result = await createQuestionBankCoordinatedBackup();
      setCoordinatedBackupResult(result || null);
      await refreshSafeActionAudit();
    } catch (error) {
      setCoordinatedBackupResult({
        error:
          error instanceof Error
            ? error.message
            : "Tutarlı yedek oluşturulamadı.",
      });
    } finally {
      setCoordinatedBackupRunning(false);
    }
  };

  const verifyCoordinatedBackup = async () => {
    const backupRoot = String(
      coordinatedBackupResult?.backupRoot || "",
    );
    if (!backupRoot) return;

    setCoordinatedBackupVerifying(true);
    setCoordinatedBackupVerification(null);

    try {
      const result =
        await verifyQuestionBankCoordinatedBackup(
          backupRoot,
        );
      setCoordinatedBackupVerification(result || null);
    } catch (error) {
      setCoordinatedBackupVerification({
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : "Yedek doğrulanamadı.",
      });
    } finally {
      setCoordinatedBackupVerifying(false);
    }
  };

  const refreshDatasetProfile = async () => {
    try {
      const result = await getQuestionBankDatasetProfile();
      setDatasetProfile(result || null);
    } catch (error) {
      console.error("Soru bankası veri hacmi profili alınamadı:", error);
      setDatasetProfile(null);
    }
  };

  const refreshMaintenancePreview = async () => {
    setMaintenancePreviewLoading(true);
    try {
      const result = await getQuestionBankMaintenancePreview();
      setMaintenancePreview(result || null);
    } catch (error) {
      console.error("Bakım orkestrasyonu ön izlemesi alınamadı:", error);
      setMaintenancePreview(null);
    } finally {
      setMaintenancePreviewLoading(false);
    }
  };

  const runMaintenanceOrchestrator = async () => {
    const confirmed = window.confirm(
      "Güvenli bakım akışı çalıştırılacak. Sistem yalnız geri alınabilir bakım adımlarını uygulayacak; kalıcı silme, VACUUM ve veritabanı geri yükleme çalıştırılmayacak. Devam edilsin mi?",
    );
    if (!confirmed) return;

    setMaintenanceRunning(true);
    setMaintenanceResult(null);

    try {
      const result = await runQuestionBankMaintenanceOrchestrator();
      setMaintenanceResult(result);

      await Promise.all([
        refreshMaintenancePreview(),
        refreshIntegrityHistory(false),
        refreshHealthScoreHistory(false),
        refreshPerformanceHistory(false),
        refreshIndexEffectiveness(),
        refreshIndexRecommendations(),
        refreshQueryPlanAnalysis(),
        refreshDatabaseOptimization(),
        refreshWriteJournalStatus(),
        scanOrphanFiles(),
        refreshSafeActionAudit(),
      ]);
    } catch (error) {
      setMaintenanceResult({
        status: "error",
        criticalReasons: [
          error instanceof Error
            ? error.message
            : "Güvenli bakım akışı tamamlanamadı.",
        ],
      });
    } finally {
      setMaintenanceRunning(false);
    }
  };

  const refreshIndexEffectiveness = async () => {
    setIndexEffectivenessLoading(true);
    try {
      const result = await getQuestionBankIndexEffectiveness();
      setIndexEffectiveness(result || null);
    } catch (error) {
      console.error("İndeks etkinliği doğrulanamadı:", error);
      setIndexEffectiveness(null);
    } finally {
      setIndexEffectivenessLoading(false);
    }
  };

  const refreshIndexRecommendations = async () => {
    try {
      const result = await getQuestionBankIndexRecommendations();
      setIndexRecommendations(result || null);
    } catch (error) {
      console.error("İndeks önerileri alınamadı:", error);
      setIndexRecommendations(null);
    }
  };

  const applyRecommendedIndexes = async () => {
    const count = Number(indexRecommendations?.actionableCount || 0);
    if (count <= 0) return;

    const confirmed = window.confirm(
      `${count} adet güvenli SQLite indeksi oluşturulacak. Soru kayıtları değiştirilmeyecek. Devam edilsin mi?`,
    );
    if (!confirmed) return;

    setIndexApplyRunning(true);
    try {
      await applyQuestionBankRecommendedIndexes();
      await Promise.all([
        refreshIndexRecommendations(),
        refreshIndexEffectiveness(),
        refreshQueryPlanAnalysis(),
        refreshDatabaseOptimization(),
        refreshPerformanceHistory(true),
        refreshSafeActionAudit(),
      ]);
    } catch (error) {
      console.error("Önerilen indeksler uygulanamadı:", error);
    } finally {
      setIndexApplyRunning(false);
    }
  };

  const refreshQueryPlanAnalysis = async () => {
    setQueryPlanLoading(true);
    try {
      const result = await getQuestionBankQueryPlanAnalysis();
      setQueryPlanAnalysis(result || null);
    } catch (error) {
      console.error("Sorgu planı analizi alınamadı:", error);
      setQueryPlanAnalysis(null);
    } finally {
      setQueryPlanLoading(false);
    }
  };

  const refreshDatabaseOptimization = async () => {
    try {
      const result = await getQuestionBankDatabaseOptimization();
      setDatabaseOptimization(result || null);
    } catch (error) {
      console.error("Veritabanı optimizasyon analizi alınamadı:", error);
      setDatabaseOptimization(null);
    }
  };

  const executeDatabaseAnalyze = async () => {
    setDatabaseOptimizationRunning(true);
    try {
      await runQuestionBankDatabaseAnalyze();
      await Promise.all([
        refreshDatabaseOptimization(),
        refreshQueryPlanAnalysis(),
        refreshIndexRecommendations(),
        refreshPerformanceHistory(true),
        refreshSafeActionAudit(),
      ]);
    } catch (error) {
      console.error("SQLite ANALYZE çalıştırılamadı:", error);
    } finally {
      setDatabaseOptimizationRunning(false);
    }
  };

  const refreshPerformanceHistory = async (recordNow = false) => {
    setPerformanceHistoryRecording(true);
    try {
      if (recordNow) {
        await runQuestionBankPerformanceHistorySnapshot();
      }
      const result = await getQuestionBankPerformanceHistory(30);
      setPerformanceHistory(result || null);
      if (result?.latest) {
        setPerformanceBenchmark({
          generatedAt: result.latest.measuredAt,
          activeQuestions: result.latest.activeQuestions,
          capacityClass: result.latest.capacityClass,
          performanceGrade: result.latest.performanceGrade,
          averageLatencyMs: result.latest.averageLatencyMs,
          slowestLatencyMs: result.latest.slowestLatencyMs,
          durationMs: result.latest.durationMs,
          tests: result.latest.tests || [],
          recommendation: result.regression
            ? "Son ölçüme göre performans gerilemesi tespit edildi."
            : result.improvement
              ? "Son ölçüme göre performans iyileşti."
              : "Performans önceki ölçüme yakın.",
        });
      }
    } catch (error) {
      console.error("Performans geçmişi alınamadı:", error);
    } finally {
      setPerformanceHistoryRecording(false);
    }
  };

  const runPerformanceBenchmark = async () => {
    setPerformanceBenchmarkRunning(true);
    try {
      const result = await getQuestionBankPerformanceBenchmark();
      setPerformanceBenchmark(result || null);
    } catch (error) {
      console.error("Soru bankası performans testi çalıştırılamadı:", error);
      setPerformanceBenchmark(null);
    } finally {
      setPerformanceBenchmarkRunning(false);
    }
  };

  const refreshHealthScoreHistory = async (recordNow = false) => {
    setHealthScoreRecording(true);
    try {
      if (recordNow) {
        await runQuestionBankHealthScoreSnapshot();
      }
      const [result, trend] = await Promise.all([
        getQuestionBankHealthScoreHistory(30),
        getQuestionBankHealthScoreTrend(30),
      ]);
      setHealthScoreHistory(result || null);
      setHealthScoreTrend(trend || null);
      if (result?.latest) {
        setQuestionBankHealthScore({
          score: result.latest.score,
          grade: result.latest.grade,
          status: result.latest.status,
          calculatedAt: result.latest.calculatedAt,
          metrics: {
            activeRecords: result.latest.activeRecords,
            indexedRecords: result.latest.indexedRecords,
            missingFiles: result.latest.missingFiles,
            orphanFiles: result.latest.orphanFiles,
            quarantineFiles: result.latest.quarantineFiles,
            duplicateHashGroups: result.latest.duplicateHashGroups,
            pendingWrites: result.latest.pendingWrites,
            failedWrites: result.latest.failedWrites,
          },
          deductions: result.latest.deductions || [],
        });
      }
    } catch (error) {
      console.error("Soru bankası sağlık puanı geçmişi alınamadı:", error);
    } finally {
      setHealthScoreRecording(false);
    }
  };

  const refreshIntegrityHistory = async (runNow = false) => {
    setIntegrityRunning(true);
    try {
      if (runNow) {
        await runQuestionBankIntegritySnapshot();
      }
      const [result, changes, recommendations, healthScore] =
        await Promise.all([
          getQuestionBankIntegrityHistory(20),
          getQuestionBankIntegrityChanges(20),
          getQuestionBankIntegrityRecommendations(),
          getQuestionBankHealthScore(),
        ]);
      setIntegrityHistory(Array.isArray(result?.items) ? result.items : []);
      setIntegrityChanges(changes || null);
      setIntegrityRecommendations(recommendations || null);
      setQuestionBankHealthScore(healthScore || null);
    } catch (error) {
      console.error("Soru bankası bütünlük geçmişi alınamadı:", error);
      setIntegrityHistory([]);
    } finally {
      setIntegrityRunning(false);
    }
  };

  const purgeOldQuarantine = async () => {
    const confirmed = window.confirm(
      "30 günden eski karantina dosyaları kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?",
    );
    if (!confirmed) return;

    setQuarantinePurging(true);
    setQuarantinePurgeResult(null);
    try {
      const result = await purgeQuestionBankQuarantine(30);
      setQuarantinePurgeResult(result);
      await refreshQuarantineInventory();
    } catch (error) {
      console.error("Eski karantina dosyaları temizlenemedi:", error);
    } finally {
      setQuarantinePurging(false);
    }
  };

  const refreshQuarantineInventory = async () => {
    setQuarantineLoading(true);
    try {
      const result = await getQuestionBankQuarantine();
      setQuarantineInventory(result);
    } catch (error) {
      console.error("Karantina alanı okunamadı:", error);
      setQuarantineInventory(null);
    } finally {
      setQuarantineLoading(false);
    }
  };

  const restoreQuarantinedFile = async (quarantinePath: string) => {
    setQuarantineRestoring(quarantinePath);
    try {
      await restoreQuestionBankQuarantineFile(quarantinePath);
      await refreshQuarantineInventory();
      await scanOrphanFiles();
    } catch (error) {
      console.error("Karantina dosyası geri yüklenemedi:", error);
    } finally {
      setQuarantineRestoring(null);
    }
  };

  const scanOrphanFiles = async () => {
    setOrphanScanning(true);
    try {
      const result = await scanQuestionBankOrphans();
      setOrphanScan(result);
    } catch (error) {
      console.error("Sahipsiz soru dosyaları taranamadı:", error);
    } finally {
      setOrphanScanning(false);
    }
  };

  const quarantineOrphanFiles = async () => {
    setOrphanQuarantining(true);
    try {
      const result = await quarantineQuestionBankOrphans();
      setOrphanScan({
        ...result,
        orphanCount: Math.max(
          0,
          Number(result?.orphanCount || 0) -
            Number(result?.quarantined || 0),
        ),
      });
      await loadQuestionBankHealth(true);
      await refreshQuarantineInventory();
    } catch (error) {
      console.error("Sahipsiz soru dosyaları karantinaya alınamadı:", error);
    } finally {
      setOrphanQuarantining(false);
    }
  };

  const cleanWriteJournal = async () => {
    setWriteJournalCleaning(true);
    try {
      await cleanupQuestionBankWriteJournal(30);
      await refreshWriteJournalStatus();
    } catch (error) {
      console.error("Soru bankası yazma günlüğü temizlenemedi:", error);
    } finally {
      setWriteJournalCleaning(false);
    }
  };

  const refreshWriteJournalStatus = async () => {
    try {
      const result = await getQuestionBankWriteJournalStatus();
      setWriteJournalStatus(result);
    } catch {
      setWriteJournalStatus(null);
    }
  };

  const recoverPendingWrites = async () => {
    setWriteJournalRecovering(true);
    try {
      await recoverQuestionBankPendingWrites();
      await refreshWriteJournalStatus();
      await loadQuestionBankHealth(true);
    } catch (error) {
      console.error("Yarım kalmış soru yazımları kurtarılamadı:", error);
    } finally {
      setWriteJournalRecovering(false);
    }
  };

  const downloadSupportBundle = async () => {
    setSupportBundleLoading(true);
    try {
      const result = await downloadQuestionBankSupportBundle();
      const url = URL.createObjectURL(result.blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = result.fileName;
      document.body.appendChild(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Soru bankası destek paketi indirilemedi:", error);
    } finally {
      setSupportBundleLoading(false);
    }
  };

  const refreshStartupAudit = async (runNow = false) => {
    setStartupAuditRunning(true);
    try {
      if (runNow) {
        await runQuestionBankStartupAudit();
      }
      const result = await getQuestionBankStartupAudit(10);
      setStartupAudit(Array.isArray(result?.items) ? result.items : []);
    } catch {
      setStartupAudit([]);
    } finally {
      setStartupAuditRunning(false);
    }
  };

  const recheckSafeMode = async () => {
    setSafeModeRecheckRunning(true);
    setSafeModeRecheckResult(null);
    try {
      const result = await recheckQuestionBankSafeMode();
      setSafeModeRecheckResult(result);
      setBankWriteState(result?.gate
        ? {
            readOnly: !result.gate.writable,
            ...result.gate,
            readiness: result.readiness,
          }
        : null,
      );
      await loadQuestionBankHealth(true);
    } catch (error) {
      setSafeModeRecheckResult({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Güvenli mod yeniden kontrolü başarısız.",
      });
    } finally {
      setSafeModeRecheckRunning(false);
    }
  };

  const openMigrationRecoveryPlan = async () => {
    setMigrationRecoveryLoading(true);
    try {
      const result = await getQuestionBankMigrationRecoveryPlan();
      setMigrationRecoveryPlan(result);
      setMigrationRecoveryOpen(true);
    } catch (error) {
      setMigrationRecoveryPlan({
        needed: true,
        status: "error",
        lastError:
          error instanceof Error
            ? error.message
            : "Migration kurtarma planı okunamadı.",
        instructions: [],
      });
      setMigrationRecoveryOpen(true);
    } finally {
      setMigrationRecoveryLoading(false);
    }
  };

  const runBankDiagnostics = async () => {
    setBankDiagnosticsRunning(true);
    try {
      const result = await runQuestionBankDiagnostics();
      setBankDiagnostics(result);
    } catch (error) {
      setBankDiagnostics({
        ready: false,
        grade: "error",
        summary: { totalChecks: 0, ok: 0, warnings: 0, errors: 1 },
        checks: [
          {
            id: "diagnostics",
            label: "Tanılama motoru",
            status: "error",
            detail:
              error instanceof Error
                ? error.message
                : "Tanılama testi çalıştırılamadı.",
          },
        ],
      });
    } finally {
      setBankDiagnosticsRunning(false);
    }
  };

  const runMissingRecordCleanup = async () => {
    const count = Number(bankIntegrity?.missingFiles?.length || 0);
    if (count <= 0) return;

    const approved = window.confirm(
      `${count} aktif soru kaydının fiziksel dosyası bulunamıyor. Bu kayıtlar silinmiş durumuna alınacak; diğer sorular etkilenmeyecek. Devam edilsin mi?`,
    );
    if (!approved) return;

    setBankMaintenanceRunning("missing");
    setBankMaintenanceResult(null);
    try {
      const result = await cleanupQuestionBankMissingRecords();
      setBankMaintenanceResult({
        type: "missing",
        ...result,
      });
      await loadQuestionBankHealth(true);
    } catch (error) {
      setBankMaintenanceResult({
        type: "error",
        error:
          error instanceof Error
            ? error.message
            : "Eksik dosya kayıtları temizlenemedi.",
      });
    } finally {
      setBankMaintenanceRunning(null);
    }
  };

  const runOrphanFileCleanup = async () => {
    const count = Number(bankIntegrity?.orphanFiles?.length || 0);
    if (count <= 0) return;

    const approved = window.confirm(
      `${count} dosyanın soru bankası metadata kaydı bulunmuyor. Bu sahipsiz fiziksel dosyalar kalıcı olarak silinecek. Devam edilsin mi?`,
    );
    if (!approved) return;

    setBankMaintenanceRunning("orphans");
    setBankMaintenanceResult(null);
    try {
      const result = await cleanupQuestionBankOrphanFiles();
      setBankMaintenanceResult({
        type: "orphans",
        ...result,
      });
      await loadQuestionBankHealth(true);
    } catch (error) {
      setBankMaintenanceResult({
        type: "error",
        error:
          error instanceof Error
            ? error.message
            : "Sahipsiz dosyalar temizlenemedi.",
      });
    } finally {
      setBankMaintenanceRunning(null);
    }
  };

  const runQuestionBankOptimization = async () => {
    setBankMaintenanceRunning("optimize");
    setBankMaintenanceResult(null);
    try {
      const result = await optimizeQuestionBank();
      setBankMaintenanceResult({
        type: "optimize",
        ...result,
      });
      await loadQuestionBankHealth(true);
    } catch (error) {
      setBankMaintenanceResult({
        type: "error",
        error:
          error instanceof Error
            ? error.message
            : "Soru bankası optimize edilemedi.",
      });
    } finally {
      setBankMaintenanceRunning(null);
    }
  };

  const rebuildBankIndex = async () => {
    setBankIndexRebuilding(true);
    try {
      await rebuildQuestionBankIndex();
      const status = await getQuestionBankIndexStatus();
      setBankIndexStatus(status);
      await loadQuestionBankHealth(false);
    } catch (error) {
      console.error("Soru bankası indeksi yeniden oluşturulamadı:", error);
    } finally {
      setBankIndexRebuilding(false);
    }
  };

  const buildMissingThumbnails = async () => {
    if (thumbnailBatchRunning) return;
    setThumbnailBatchRunning(true);
    setThumbnailProgress({ completed: 0, failed: 0, total: 0 });

    try {
      let completed = 0;
      let failed = 0;
      let offset = 0;
      const batchSize = 20;

      const initial = await getQuestionBankThumbnailStatus({
        limit: batchSize,
        offset: 0,
      });
      const total = Number(initial?.missingCount || 0);
      setThumbnailProgress({ completed: 0, failed: 0, total });

      if (total <= 0) {
        setThumbnailStatus(initial);
        return;
      }

      // Her başarılı thumbnail eksik listesinden çıktığı için offset sabit 0 kalır.
      while (true) {
        const batch = await getQuestionBankThumbnailStatus({
          limit: batchSize,
          offset: 0,
        });
        const questions = Array.isArray(batch?.questions)
          ? batch.questions
          : [];

        if (questions.length === 0) break;

        let batchSuccess = 0;

        for (const question of questions) {
          try {
            await createQuestionThumbnailFromUrl(
              String(question.id),
              String(question.imageUrl || ""),
            );
            completed += 1;
            batchSuccess += 1;
          } catch (error) {
            console.error(
              `Thumbnail oluşturulamadı: ${question.questionCode || question.id}`,
              error,
            );
            failed += 1;
          }

          setThumbnailProgress({
            completed,
            failed,
            total,
          });

          // Uzun işlemlerde ana UI thread'e nefes ver.
          await new Promise((resolve) => setTimeout(resolve, 15));
        }

        if (batchSuccess === 0) {
          // Aynı hatalı kayıtlar sonsuz döngüye girmesin.
          break;
        }
      }

      const finalStatus = await getQuestionBankThumbnailStatus({
        limit: 1,
        offset: 0,
      });
      setThumbnailStatus(finalStatus);
      await loadQuestionBankHealth(false);
    } catch (error) {
      console.error("Toplu thumbnail oluşturma hatası:", error);
    } finally {
      setThumbnailBatchRunning(false);
    }
  };

  const formatBankBytes = (bytes: unknown) => {
    const value = Math.max(0, Number(bytes || 0));
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    return `${(value / 1024 ** 3).toFixed(2)} GB`;
  };

  const loadQuestionBankHealth = async (withIntegrity = false) => {
    setBankHealthLoading(true);
    try {
      const [statusResult, deletedResult, integrityResult, indexStatusResult, thumbnailStatusResult, versionResult, writeStateResult] = await Promise.all([
        getQuestionBankStatus(),
        listQuestionBankRecords({ status: "deleted", limit: 100, offset: 0 }),
        withIntegrity ? checkQuestionBankIntegrity() : Promise.resolve(null),
        getQuestionBankIndexStatus(),
        getQuestionBankThumbnailStatus({ limit: 1, offset: 0 }),
        getQuestionBankVersion(),
        getQuestionBankWriteState(),
      ]);
      setBankStatus(statusResult);
      setBankVersion(versionResult);
      setBankWriteState(writeStateResult);
      void refreshStartupAudit(false);
      void refreshWriteJournalStatus();
      void scanOrphanFiles();
      void refreshQuarantineInventory();
      void refreshIntegrityHistory(false);
      void loadSafeActions();
      void refreshSafeActionAudit();
      void refreshHealthScoreHistory(false);
      void runPerformanceBenchmark();
      void refreshPerformanceHistory(false);
      void refreshDatabaseOptimization();
      void refreshQueryPlanAnalysis();
      void refreshIndexRecommendations();
      void refreshIndexEffectiveness();
      void refreshProductionReadiness();
      void refreshMaintenancePreview();
      void refreshDatasetProfile();
      setBankIndexStatus(indexStatusResult);
      setThumbnailStatus(thumbnailStatusResult);
      setDeletedQuestions(Array.isArray(deletedResult?.questions) ? deletedResult.questions : []);
      if (integrityResult) setBankIntegrity(integrityResult);
    } catch (error) {
      console.error("Soru bankası sağlık bilgisi alınamadı:", error);
    } finally {
      setBankHealthLoading(false);
    }
  };

  const openQuestionBankHealth = () => {
    setBankHealthOpen(true);
    void loadQuestionBankHealth(false);
  };

  const runQuestionBankIntegrity = () => {
    void loadQuestionBankHealth(true);
  };

  const restoreDeletedQuestion = async (questionId: string) => {
    setRestoringQuestionId(questionId);
    try {
      await restoreQuestionBankRecord(questionId);
      await loadQuestionBankHealth(Boolean(bankIntegrity));
    } catch (error) {
      console.error("Soru geri yüklenemedi:", error);
    } finally {
      setRestoringQuestionId(null);
    }
  };

  const integrityProblemCount =
    Number(bankIntegrity?.missingFiles?.length || 0) +
    Number(bankIntegrity?.orphanFiles?.length || 0) +
    Number(bankIntegrity?.duplicateHashes?.length || 0);



  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-3">
          <div className="flex w-full flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPasteOpen((prev) => !prev)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-700 bg-red-600 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-red-700"
            >
              <ClipboardPaste className="h-4 w-4" /> Excel'den Yapıştır
            </button>

            {["9", "10", "11", "12"].map((grade) => {
              const activeGrade =
                String(curriculumActiveGrade || "").match(/(9|10|11|12)/)?.[1] === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setCurriculumActiveGrade(`${grade}. Sınıf`)}
                  className={`inline-flex h-11 min-w-[92px] items-center justify-center rounded-2xl border px-4 text-[12px] font-black transition ${
                    activeGrade
                      ? "border-purple-950 bg-purple-950 text-white shadow-sm"
                      : "border-purple-200 bg-white text-purple-950 hover:border-purple-400 hover:bg-purple-50"
                  }`}
                >
                  {grade}. Sınıf
                </button>
              );
            })}

            {curriculumBuilderOpen && (
              <>
                <label className="sr-only" htmlFor="curriculum-builder-grade">Sınıf seviyesi seçin</label>
                <select
                  id="curriculum-builder-grade"
                  value={curriculumBuilderGrade}
                  onChange={(event) => {
                    const grade = event.target.value;
                    setCurriculumBuilderGrade(grade);
                    setCurriculumBuilderCourseId("");
                    setCurriculumActiveGrade(`${grade}. Sınıf`);
                  }}
                  className="h-11 min-w-[150px] rounded-2xl border border-purple-200 bg-white px-4 text-xs font-black text-slate-800 outline-none focus:ring-4 focus:ring-purple-100"
                >
                  <option value="9">9. Sınıf</option>
                  <option value="10">10. Sınıf</option>
                  <option value="11">11. Sınıf</option>
                  <option value="12">12. Sınıf</option>
                </select>
                <label className="sr-only" htmlFor="curriculum-builder-course">Ders seçin</label>
                <select
                  id="curriculum-builder-course"
                  value={curriculumBuilderCourseId}
                  onChange={(event) => setCurriculumBuilderCourseId(event.target.value)}
                  className="h-11 min-w-[240px] rounded-2xl border border-purple-200 bg-white px-4 text-xs font-black text-slate-800 outline-none focus:ring-4 focus:ring-purple-100"
                >
                  <option value="">Ders seçin</option>
                  {curriculumCourses.map((course: any) => (
                    <option key={course.id} value={course.id}>{course.courseName}</option>
                  ))}
                </select>
              <button
                type="button"
                disabled={!curriculumBuilderCourseId}
                onClick={() => {
                  const course = curriculumCourses.find(
                    (item: any) => String(item.id) === String(curriculumBuilderCourseId),
                  );
                  if (!course) return;
                  setDeletedCurriculumCourses((current: string[]) =>
                    current.filter((courseId) => String(courseId) !== String(course.id)),
                  );
                  setExpandedCourses((current) => ({ ...current, [course.id]: true }));
                  setCurriculumModalState({ isOpen: true, courseId: course.id });
                }}
                className="h-11 rounded-2xl bg-purple-950 px-5 text-xs font-black text-white hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ağaç Yapısını Aç
              </button>
              </>
            )}
          </div>
        </div>

        {pasteOpen && (
          <div className="rounded-3xl border border-purple-200 bg-purple-50/50 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-purple-950">Excel Hücrelerini Yapıştır</div>
                <div className="mt-1 text-[10px] font-bold leading-relaxed text-purple-600">
                  Excel'de şablondaki hücreleri seçip Ctrl+C yapın, ardından aşağıdaki alana Ctrl+V ile yapıştırın.
                  Sınıf, ders, ünite ve konu hücreleri boş bırakılmışsa bir üst satırdaki değer otomatik devralınır.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                  setPasteRows([]);
                  setPasteErrors([]);
                }}
                className="rounded-xl p-2 text-purple-400 hover:bg-white hover:text-purple-800"
                title="Yapıştırma alanını kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={pasteText}
              onChange={(event) => {
                const value = event.target.value;
                setPasteText(value);
                parsePastedCurriculum(value);
              }}
              onPaste={(event) => {
                const value = event.clipboardData.getData("text/plain");
                if (value) {
                  event.preventDefault();
                  setPasteText(value);
                  parsePastedCurriculum(value);
                }
              }}
              rows={8}
              placeholder={"SINIF_KODU\tDERS_KODU\tDERS_ADI\tUNITE_NO\tUNITE_ADI\tKONU_NO\tKONU_ADI\tKAZANIM_NO\tKAZANIM_ADI\n10\t1\tTürk Dili ve Edebiyatı\t1\tGiriş\t1\tEdebiyata Giriş\t1\tKazanım açıklaması"}
              className="w-full resize-y rounded-2xl border border-purple-200 bg-white p-3 font-mono text-[10px] leading-5 text-slate-700 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
                  {pasteRows.length} geçerli satır
                </span>
                {pasteErrors.length > 0 && (
                  <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-700">
                    {pasteErrors.length} uyarı
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={pasteRows.length === 0}
                onClick={importPastedCurriculum}
                className="rounded-xl bg-purple-950 px-4 py-2.5 text-[11px] font-black text-white shadow-sm transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Müfredata Aktar
              </button>
            </div>

            {pasteErrors.length > 0 && (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50 p-2.5">
                {pasteErrors.slice(0, 20).map((error, index) => (
                  <div key={`${error}-${index}`} className="text-[9px] font-bold leading-5 text-rose-700">
                    {error}
                  </div>
                ))}
                {pasteErrors.length > 20 && (
                  <div className="mt-1 text-[9px] font-black text-rose-500">
                    + {pasteErrors.length - 20} ek uyarı
                  </div>
                )}
              </div>
            )}

            {pasteRows.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600">
                  Ön İzleme • İlk {Math.min(12, pasteRows.length)} satır
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-[980px] w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100 text-[9px] font-black text-slate-500">
                        <th className="px-2 py-2">Sınıf</th>
                        <th className="px-2 py-2">ID</th>
                        <th className="px-2 py-2">Ders</th>
                        <th className="px-2 py-2">Ünite</th>
                        <th className="px-2 py-2">Konu</th>
                        <th className="px-2 py-2">Kazanım Kodu</th>
                        <th className="px-2 py-2">Kazanım</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pasteRows.slice(0, 12).map((row, index) => (
                        <tr key={`${row.KAZANIM_KODU}-${index}`} className="border-b border-slate-50 text-[9px] font-semibold text-slate-700">
                          <td className="px-2 py-2">{row.SINIF_KODU}</td>
                          <td className="px-2 py-2">{row.DERS_KODU}</td>
                          <td className="px-2 py-2 font-black">{row.DERS_ADI}</td>
                          <td className="px-2 py-2">{row.UNITE_NO}. {row.UNITE_ADI}</td>
                          <td className="px-2 py-2">{row.KONU_NO}. {row.KONU_ADI}</td>
                          <td className="px-2 py-2 font-mono font-black text-purple-700">{row.KAZANIM_KODU}</td>
                          <td className="max-w-[280px] px-2 py-2">{row.KAZANIM_ADI}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {bankWriteState?.readOnly && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-black text-rose-900">
                  <AlertTriangle className="h-4 w-4" />
                  Soru Bankası Güvenli Çalışma Modu
                </div>
                <div className="mt-1 text-[9px] font-semibold leading-4 text-rose-700">
                  Yazma işlemleri geçici olarak durduruldu. Okuma, sağlık, tanılama ve kurtarma araçları kullanılabilir.
                </div>
                <div className="mt-1 text-[8px] font-bold text-rose-600">
                  Şema v{Number(bankWriteState.currentVersion || 0)} / v{Number(bankWriteState.targetVersion || 0)}
                  {" • "}
                  Migration: {bankWriteState.migrationStatus || "—"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={safeModeRecheckRunning}
                  onClick={() => void recheckSafeMode()}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-[9px] font-black text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${safeModeRecheckRunning ? "animate-spin" : ""}`} />
                  {safeModeRecheckRunning
                    ? "Yeniden kontrol ediliyor…"
                    : "Yeniden Kontrol Et"}
                </button>

                {bankWriteState.failed && (
                  <button
                    type="button"
                    onClick={() => void openMigrationRecoveryPlan()}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-700 px-3 text-[9px] font-black text-white hover:bg-rose-800"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Kurtarma Planını Aç
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {bankWriteState?.readOnly && bankWriteState?.readiness && (
          <div className="grid gap-2 md:grid-cols-3">
            {(bankWriteState.readiness.checks || []).map((check: any) => (
              <div
                key={check.id}
                className={`rounded-xl border p-3 ${
                  check.ok
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className={`text-[9px] font-black ${
                  check.ok ? "text-emerald-800" : "text-rose-800"
                }`}>
                  {check.id === "schema"
                    ? "Şema"
                    : check.id === "index"
                      ? "SQLite İndeksi"
                      : "Fiziksel Dosyalar"}
                </div>
                <div className="mt-1 text-[8px] font-semibold leading-4 text-slate-600">
                  {check.detail}
                </div>
              </div>
            ))}
          </div>
        )}

        {safeModeRecheckResult && (
          <div
            className={`rounded-xl border px-3 py-2 text-[9px] font-black ${
              safeModeRecheckResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {safeModeRecheckResult.success
              ? "Kontroller başarılı. Soru bankası yazma kilidi kaldırıldı."
              : safeModeRecheckResult.error ||
                "Yazma kilidi devam ediyor. Başarısız kontrol kartlarını inceleyin."}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <div>
            <div className="text-[13px] font-black text-violet-950">Müfredat Dersleri</div>
            <div className="mt-0.5 text-[10px] font-bold text-violet-600">
              {curriculumActiveGrade} • {loadedCourseCount} müfredatı yüklü / {visibleCourses.length} ders
            </div>
          </div>
        </div>

        {visibleCourses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm font-bold text-slate-400">
            Bu sınıf düzeyinde ders bulunamadı.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleCourses.map((course: any) => {
              const loaded = hasCourseCurriculum(course.id);
              const curriculum = getCourseCurriculum(course.id);
              const units = Array.isArray(curriculum.units) ? curriculum.units : [];
              const unitCount = units.length;
              const topicCount = units.reduce(
                (sum: number, unit: any) => sum + (unit.topics?.length || 0),
                0,
              );
              const outcomeCount = units.reduce(
                (sum: number, unit: any) =>
                  sum +
                  (unit.topics || []).reduce(
                    (topicSum: number, topic: any) => topicSum + (topic.outcomes?.length || 0),
                    0,
                  ),
                0,
              );
              const questionCount = units.reduce(
                (sum: number, unit: any) =>
                  sum +
                  (unit.topics || []).reduce((topicSum: number, topic: any) => {
                    const topicKey = canonicalTargetKey(course.id, unit.id, topic.id, "");
                    const directTopicCount = Number(canonicalQuestionCounts[topicKey] || 0);
                    const outcomeTotal = (topic.outcomes || []).reduce(
                      (outcomeSum: number, outcome: any) =>
                        outcomeSum +
                        Number(
                          canonicalQuestionCounts[
                            canonicalTargetKey(course.id, unit.id, topic.id, outcome.id)
                          ] || 0,
                        ),
                      0,
                    );
                    return topicSum + directTopicCount + outcomeTotal;
                  }, 0),
                0,
              );
              const courseId = Number(course.curriculumCourseId) || "—";
              const courseOpen = Boolean(expandedCourses[course.id]);

              return (
                <div
                  key={course.id}
                  className={`overflow-hidden rounded-3xl border shadow-sm ${
                    focusedCourseName &&
                    normalizeName(focusedCourseName) === normalizeName(course.courseName)
                      ? "border-purple-950 bg-purple-950"
                      : loaded
                        ? "border-violet-300 bg-violet-100/80"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleMapKey(setExpandedCourses, course.id)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleCourseFocus(course.courseName);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title={
                        focusedCourseName &&
                        normalizeName(focusedCourseName) === normalizeName(course.courseName)
                          ? "Çift tıklayın: tüm dersleri yeniden göster"
                          : "Çift tıklayın: yalnız bu dersi göster"
                      }
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-950 text-white">
                        {courseOpen ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[12px] font-black uppercase tracking-wider ${focusedCourseName && normalizeName(focusedCourseName) === normalizeName(course.courseName) ? "text-purple-200" : "text-slate-500"}`}>
                          {curriculumActiveGrade} • Ders ID {courseId}
                        </span>
                        <span className={`block truncate text-base font-black ${focusedCourseName && normalizeName(focusedCourseName) === normalizeName(course.courseName) ? "text-white" : "text-slate-900"}`}>
                          {course.courseName}
                        </span>
                      </span>
                      {courseOpen ? (
                        <ChevronDown className={`h-4 w-4 shrink-0 ${focusedCourseName && normalizeName(focusedCourseName) === normalizeName(course.courseName) ? "text-white" : "text-purple-700"}`} />
                      ) : (
                        <ChevronRight className={`h-4 w-4 shrink-0 ${focusedCourseName && normalizeName(focusedCourseName) === normalizeName(course.courseName) ? "text-white" : "text-purple-700"}`} />
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {[`${unitCount} Ünite`, `${topicCount} Konu`, `${outcomeCount} Kazanım`, `${questionCount} Soru`].map((label) => (
                        <span key={label} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-black text-slate-600">
                          {label}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCurriculumModalState({ isOpen: true, courseId: course.id })}
                        className="rounded-xl bg-purple-950 px-3 py-2 text-[12px] font-black text-white hover:bg-purple-900"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletedCurriculumCourses((prev: string[]) => [...prev, course.id])}
                        className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Bu dersi müfredat ekranından gizle"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {courseOpen && (
                    <div className="border-t border-purple-100 bg-white p-3 md:p-4">
                      {!loaded || units.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-[11px] font-bold text-slate-400">
                          Bu dersin müfredatını Excel ile yükleyin veya Düzenle ile manuel oluşturun.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {units.map((unit: any) => {
                            const unitOpen = Boolean(expandedUnits[unit.id]);
                            return (
                              <div key={unit.id} className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/40">
                                <button
                                  type="button"
                                  onClick={() => toggleMapKey(setExpandedUnits, unit.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                                >
                                  {unitOpen ? <ChevronDown className="h-4 w-4 text-indigo-700" /> : <ChevronRight className="h-4 w-4 text-indigo-700" />}
                                  {unitOpen ? <FolderOpen className="h-4 w-4 text-indigo-700" /> : <Folder className="h-4 w-4 text-indigo-700" />}
                                  <span className="text-[15px] font-black text-red-600">{unit.id} • {unit.name}</span>
                                </button>

                                {unitOpen && (
                                  <div className="space-y-2 border-t border-indigo-100 bg-white p-2 pl-5 md:pl-8">
                                    {(unit.topics || []).map((topic: any) => {
                                      const topicOpen = Boolean(expandedTopics[topic.id]);
                                      const topicOutcomes = Array.isArray(topic.outcomes) ? topic.outcomes : [];
                                      const topicHasOutcomes = topicOutcomes.length > 0;
                                      const topicTargetKey = canonicalTargetKey(course.id, unit.id, topic.id, "");
                                      const topicQuestions = canonicalQuestionCache[topicTargetKey] || [];
                                      const topicQuestionCount = Number(canonicalQuestionCounts[topicTargetKey] || 0);
                                      return (
                                        <div key={topic.id} className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-100/80">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              toggleMapKey(setExpandedTopics, topic.id);
                                              if (!topicOpen && !topicHasOutcomes) {
                                                void loadCanonicalQuestions(course.id, unit.id, topic.id, "");
                                              }
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left"
                                          >
                                            {topicOpen ? <ChevronDown className="h-4 w-4 text-emerald-700" /> : <ChevronRight className="h-4 w-4 text-emerald-700" />}
                                            {topicOpen ? <FolderOpen className="h-4 w-4 text-emerald-700" /> : <Folder className="h-4 w-4 text-emerald-700" />}
                                            <span className="min-w-0 flex-1 text-[14px] font-black text-emerald-950">{topic.id} • {topic.name}</span>
                                            {!topicHasOutcomes && (
                                              <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[12px] font-black text-emerald-700">
                                                {topicQuestions.length}
                                              </span>
                                            )}
                                          </button>
                                          {!topicHasOutcomes && (
                                            <div className="px-3 pb-2">
                                              <button
                                                type="button"
                                                onClick={() => openQuestionUploadChoice({
                                                  courseId: course.id,
                                                  unitId: unit.id,
                                                  topicId: topic.id,
                                                  outcomeId: "",
                                                  targetType: "topic",
                                                  targetName: topic.name,
                                                })}
                                                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-800"
                                              >
                                                Soru Yükle
                                              </button>
                                            </div>
                                          )}

                                          {topicOpen && (
                                            <div className="space-y-2 border-t border-emerald-200 bg-white p-2 pl-5 md:pl-8">
                                              {!topicHasOutcomes && canonicalQuestionLoading[topicTargetKey] && (
                                                <div className="py-4 text-center text-[11px] font-bold text-slate-400">Sorular yükleniyor…</div>
                                              )}
                                              {!topicHasOutcomes && !canonicalQuestionLoading[topicTargetKey] && topicQuestionCount === 0 && (
                                                <div className="py-4 text-center text-[11px] font-bold text-slate-400">Bu konuda henüz soru kartı yok.</div>
                                              )}
                                              {!topicHasOutcomes && topicQuestions.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                                  {topicQuestions.map((question: any, questionIndex: number) => {
                                                    const identity = questionIdentity(question);
                                                    const source = String(question.thumbnailUrl || question.imageUrl || question.imageDataUrl || "").trim();
                                                    const isProblematic = !source || Boolean(brokenQuestionImages[identity]);
                                                    return (
                                                      <div
                                                        key={identity || questionIndex}
                                                        className={`group relative rounded-xl border p-2 ${
                                                          isProblematic ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50"
                                                        }`}
                                                      >
                                                        {source && !brokenQuestionImages[identity] ? (
                                                          <img
                                                            src={source}
                                                            alt={question.code || `Soru ${questionIndex + 1}`}
                                                            className="h-28 w-full rounded-lg bg-white object-contain"
                                                            onError={() => {
                                                              setBrokenQuestionImages((current) => ({ ...current, [identity]: true }));
                                                              setQuestionImageError(`${question.fileName || question.code || "Soru"} görseli okunamadı.`);
                                                            }}
                                                          />
                                                        ) : (
                                                          <div className="flex h-28 flex-col items-center justify-center rounded-lg bg-rose-50 text-[10px] font-black text-rose-600">
                                                            <AlertTriangle className="mb-1 h-5 w-5" />
                                                            Görsel okunamadı
                                                          </div>
                                                        )}
                                                        <div className="mt-1 truncate text-[10px] font-black text-slate-600">{question.code || `Soru ${questionIndex + 1}`}</div>
                                                        <div className="mt-1 text-[9px] font-bold text-slate-400">{question.questionType === "exam" ? "Sınav Sorusu" : "Çalışma Sorusu"}</div>
                                                        <button
                                                          type="button"
                                                          onClick={(event) => {
                                                            event.stopPropagation();
                                                            void (async () => {
                                                              await Promise.resolve(
                                                                deleteQuestion?.(course.id, unit.id, topic.id, "", identity),
                                                              );
                                                              await loadCanonicalQuestions(course.id, unit.id, topic.id, "");
                                                              await loadCanonicalCounts();
                                                            })();
                                                          }}
                                                          className={`absolute right-2 top-2 rounded-lg p-1.5 shadow-sm ${
                                                            isProblematic
                                                              ? "bg-rose-600 text-white"
                                                              : "bg-white/95 text-slate-500 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                                                          }`}
                                                          title="Soruyu depodan ve veritabanından sil"
                                                        >
                                                          <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                              {!topicHasOutcomes && topicQuestions.length < topicQuestionCount && (
                                                <div className="flex justify-center pt-2">
                                                  <button
                                                    type="button"
                                                    disabled={Boolean(canonicalQuestionLoading[topicTargetKey])}
                                                    onClick={() =>
                                                      void loadCanonicalQuestions(
                                                        course.id,
                                                        unit.id,
                                                        topic.id,
                                                        "",
                                                        { append: true, offset: topicQuestions.length },
                                                      )
                                                    }
                                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-700 hover:border-purple-300 hover:text-purple-900 disabled:opacity-50"
                                                  >
                                                    {canonicalQuestionLoading[topicTargetKey]
                                                      ? "Yükleniyor…"
                                                      : `Daha fazla yükle (${topicQuestions.length}/${topicQuestionCount})`}
                                                  </button>
                                                </div>
                                              )}
                                              {topicOutcomes.map((outcome: any) => {
                                                const outcomeOpen = Boolean(expandedOutcomes[outcome.id]);
                                                const outcomeTargetKey = canonicalTargetKey(course.id, unit.id, topic.id, outcome.id);
                                                const questions = canonicalQuestionCache[outcomeTargetKey] || [];
                                                const totalOutcomeQuestions = Number(canonicalQuestionCounts[outcomeTargetKey] || 0);
                                                const readableQuestionCount = questions.filter((question: any) => {
                                                  const identity = questionIdentity(question);
                                                  const source = String(question.thumbnailUrl || question.imageUrl || question.imageDataUrl || "").trim();
                                                  return Boolean(source) && !brokenQuestionImages[identity];
                                                }).length;
                                                const selectedDeleteCount = questions.filter(
                                                  (question: any) =>
                                                    Boolean(
                                                      selectedQuestionDeleteKeys[
                                                        scopedQuestionSelectionKey(
                                                          course.id,
                                                          unit.id,
                                                          topic.id,
                                                          outcome.id,
                                                          question,
                                                        )
                                                      ],
                                                    ),
                                                ).length;
                                                const allQuestionsSelectedForDelete =
                                                  questions.length > 0 &&
                                                  selectedDeleteCount === questions.length;
                                                const outcomeDeleteKey = [
                                                  String(course.id),
                                                  String(unit.id),
                                                  String(topic.id),
                                                  String(outcome.id),
                                                ].join("::");
                                                const isBulkDeleting =
                                                  bulkDeletingOutcomeKey === outcomeDeleteKey;
                                                return (
                                                  <div
                                                    key={outcome.id}
                                                    data-curriculum-outcome-id={String(outcome.id)}
                                                    tabIndex={-1}
                                                    className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/30 transition"
                                                  >
                                                    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          toggleMapKey(setExpandedOutcomes, outcome.id);
                                                          if (!outcomeOpen) {
                                                            void loadCanonicalQuestions(course.id, unit.id, topic.id, outcome.id);
                                                          }
                                                        }}
                                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                      >
                                                        {outcomeOpen ? <ChevronDown className="h-4 w-4 text-emerald-700" /> : <ChevronRight className="h-4 w-4 text-emerald-700" />}
                                                        {outcomeOpen ? <FolderOpen className="h-4 w-4 text-emerald-700" /> : <Folder className="h-4 w-4 text-emerald-700" />}
                                                        <span className="min-w-0 text-[13px] font-black text-emerald-950">
                                                          <span className="font-mono">{outcome.code || outcome.id}</span> • {outcome.name}
                                                        </span>
                                                        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[12px] font-black text-emerald-700">
                                                          {totalOutcomeQuestions}
                                                        </span>
                                                        {questions.length > 0 && readableQuestionCount < questions.length && (
                                                          <span className="shrink-0 rounded-lg bg-rose-100 px-2 py-1 text-[9px] font-black text-rose-700">
                                                            {questions.length - readableQuestionCount} problemli
                                                          </span>
                                                        )}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => openQuestionUploadChoice({
                                                          courseId: course.id,
                                                          unitId: unit.id,
                                                          topicId: topic.id,
                                                          outcomeId: outcome.id,
                                                          targetType: "outcome",
                                                          targetName: outcome.name,
                                                        })}
                                                        className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-800"
                                                      >
                                                        Soru Yükle
                                                      </button>
                                                    </div>

                                                    {outcomeOpen && (
                                                      <div className="border-t border-emerald-100 bg-white p-2.5">
                                                        {questionImageError && (
                                                          <div className="mb-2 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700">
                                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                                            {questionImageError}
                                                          </div>
                                                        )}
                                                        {questions.length === 0 ? (
                                                          <div className="py-4 text-center text-[10px] font-bold text-slate-400">Bu kazanımda henüz soru kartı yok.</div>
                                                        ) : (
                                                          <>
                                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black text-slate-600">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={allQuestionsSelectedForDelete}
                                                                  onChange={(event) =>
                                                                    setOutcomeQuestionSelection(
                                                                      course.id,
                                                                      unit.id,
                                                                      topic.id,
                                                                      outcome.id,
                                                                      questions,
                                                                      event.target.checked,
                                                                    )
                                                                  }
                                                                  className="h-4 w-4 rounded border-slate-300 accent-rose-600"
                                                                />
                                                                Tümünü seç
                                                              </label>

                                                              <div className="flex items-center gap-2">
                                                                {selectedDeleteCount > 0 && (
                                                                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[9px] font-black text-rose-700">
                                                                    {selectedDeleteCount} seçili
                                                                  </span>
                                                                )}
                                                                <button
                                                                  type="button"
                                                                  disabled={selectedDeleteCount === 0 || isBulkDeleting}
                                                                  onClick={() =>
                                                                    void deleteSelectedOutcomeQuestions(
                                                                      course.id,
                                                                      unit.id,
                                                                      topic.id,
                                                                      outcome.id,
                                                                      questions,
                                                                    )
                                                                  }
                                                                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                                                                >
                                                                  <Trash2 className="h-3.5 w-3.5" />
                                                                  {isBulkDeleting
                                                                    ? "Siliniyor…"
                                                                    : `Seçilenleri Sil${selectedDeleteCount > 0 ? ` (${selectedDeleteCount})` : ""}`}
                                                                </button>
                                                              </div>
                                                            </div>

                                                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                                            {questions.map((question: any) => {
                                                              const identity = questionIdentity(question);
                                                              const selectionKey = scopedQuestionSelectionKey(
                                                                course.id,
                                                                unit.id,
                                                                topic.id,
                                                                outcome.id,
                                                                question,
                                                              );
                                                              const selectedForDelete = Boolean(
                                                                selectedQuestionDeleteKeys[selectionKey],
                                                              );
                                                              const imageSource = String(question.thumbnailUrl || question.imageUrl || question.imageDataUrl || "").trim();
                                                              const isProblematic = !imageSource || Boolean(brokenQuestionImages[identity]);
                                                              return (
                                                              <div
                                                                key={identity}
                                                                onClick={() => openQuestionViewer(course, unit, topic, outcome, question)}
                                                                className={`group relative cursor-zoom-in overflow-hidden rounded-xl border transition hover:shadow-md ${
                                                                  selectedForDelete
                                                                    ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                                                                    : isProblematic
                                                                      ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100"
                                                                      : "border-slate-200 bg-slate-50 hover:border-purple-300"
                                                                }`}
                                                                title="Soruyu tam ekran incelemek için tıklayın"
                                                              >
                                                                <label
                                                                  className={`absolute left-1.5 top-1.5 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border shadow-sm ${
                                                                    selectedForDelete
                                                                      ? "border-rose-600 bg-rose-600"
                                                                      : "border-slate-200 bg-white/95"
                                                                  }`}
                                                                  title="Toplu silme için seç"
                                                                  onClick={(event) => event.stopPropagation()}
                                                                >
                                                                  <input
                                                                    type="checkbox"
                                                                    checked={selectedForDelete}
                                                                    onChange={() =>
                                                                      toggleQuestionDeleteSelection(
                                                                        course.id,
                                                                        unit.id,
                                                                        topic.id,
                                                                        outcome.id,
                                                                        question,
                                                                      )
                                                                    }
                                                                    className="h-4 w-4 accent-rose-600"
                                                                  />
                                                                </label>

                                                                {!isProblematic ? (
                                                                  <img
                                                                    src={imageSource}
                                                                    alt={question.fileName || question.code}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    className="h-28 w-full bg-white object-contain"
                                                                    onError={(event) => {
                                                                      const originalSource = String(question.imageUrl || question.imageDataUrl || "").trim();
                                                                      if (
                                                                        originalSource &&
                                                                        event.currentTarget.dataset.originalFallback !== "tried"
                                                                      ) {
                                                                        event.currentTarget.dataset.originalFallback = "tried";
                                                                        event.currentTarget.src = originalSource;
                                                                        return;
                                                                      }
                                                                      setBrokenQuestionImages((current) => ({ ...current, [identity]: true }));
                                                                      setQuestionImageError(
                                                                        `${question.fileName || question.code || "Soru"} görseli okunamadı. Soru sayısına dahil edilmedi. Kırmızı Sil düğmesi bu bozuk kaydı görsel dosyası bulunmasa bile müfredattan kaldırır.`,
                                                                      );
                                                                    }}
                                                                  />
                                                                ) : (
                                                                  <div className="flex h-28 flex-col items-center justify-center bg-rose-50 px-3 text-center text-rose-500">
                                                                    <AlertTriangle className="h-7 w-7" />
                                                                    <span className="mt-1 text-[9px] font-black">Görsel okunamadı</span>
                                                                  </div>
                                                                )}
                                                                <div className="p-2">
                                                                  <div className="truncate font-mono text-[9px] font-black text-slate-800" title={question.fileName || question.code}>
                                                                    {question.fileName || question.code}
                                                                  </div>
                                                                  <div className="mt-1 text-[9px] font-bold text-slate-400">Cevap: {question.answer || "—"}</div>
                                                                </div>
                                                                <button
                                                                  type="button"
                                                                  onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    void (async () => {
                                                                      await Promise.resolve(
                                                                        deleteQuestion?.(
                                                                          course.id,
                                                                          unit.id,
                                                                          topic.id,
                                                                          outcome.id,
                                                                          questionIdentity(question),
                                                                        ),
                                                                      );
                                                                      await loadCanonicalQuestions(course.id, unit.id, topic.id, outcome.id);
                                                                      await loadCanonicalCounts();
                                                                    })();
                                                                  }}
                                                                  className={`absolute right-1.5 top-1.5 rounded-lg p-1.5 shadow-sm transition ${
                                                                    isProblematic
                                                                      ? "bg-rose-600 text-white hover:bg-rose-700"
                                                                      : "bg-white/90 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                                                                  }`}
                                                                  title={
                                                                    isProblematic
                                                                      ? "Bozuk/kayıp görselli soru kaydını zorla sil"
                                                                      : "Soru kartını sil"
                                                                  }
                                                                >
                                                                  {isProblematic ? <Trash2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                                </button>
                                                              </div>
                                                              );
                                                            })}
                                                            </div>
                                                            {questions.length < totalOutcomeQuestions && (
                                                              <div className="flex justify-center pt-2">
                                                                <button
                                                                  type="button"
                                                                  disabled={Boolean(canonicalQuestionLoading[outcomeTargetKey])}
                                                                  onClick={() =>
                                                                    void loadCanonicalQuestions(
                                                                      course.id,
                                                                      unit.id,
                                                                      topic.id,
                                                                      outcome.id,
                                                                      { append: true, offset: questions.length },
                                                                    )
                                                                  }
                                                                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-700 hover:border-purple-300 hover:text-purple-900 disabled:opacity-50"
                                                                >
                                                                  {canonicalQuestionLoading[outcomeTargetKey]
                                                                    ? "Yükleniyor…"
                                                                    : `Daha fazla yükle (${questions.length}/${totalOutcomeQuestions})`}
                                                                </button>
                                                              </div>
                                                            )}
                                                          </>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {importSessionHistoryOpen && (
        <div className="fixed inset-0 z-[241] flex items-center justify-center bg-slate-950/75 p-5 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="İçe aktarma geçmişini kapat"
            onClick={() => setImportSessionHistoryOpen(false)}
          />
          <div
            className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <div>
                <div className="text-base font-black">Akıllı İçe Aktarma Geçmişi</div>
                <div className="mt-1 text-[10px] font-semibold text-slate-400">
                  Her toplu yükleme ayrı oturumdur. Yalnız o oturumdaki aktif sorular geri alınır.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportSessionHistoryOpen(false)}
                className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {importSessionHistoryLoading ? (
                <div className="flex h-48 items-center justify-center text-[11px] font-black text-slate-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Geçmiş yükleniyor…
                </div>
              ) : importSessionHistory.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-[11px] font-bold text-slate-400">
                  Kayıtlı içe aktarma oturumu bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2">
                  {importSessionHistory.map((session: any, index: number) => {
                    const activeCount = Number(session.activeQuestionCount || 0);
                    const rolledBack = String(session.status || "").startsWith("rolled-back");
                    return (
                      <div
                        key={session.id}
                        className={`rounded-2xl border p-4 ${
                          index === 0
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black text-slate-900">
                                {session.label || "Akıllı İçe Aktarma"}
                              </span>
                              {index === 0 && (
                                <span className="rounded bg-amber-500 px-2 py-0.5 text-[8px] font-black text-white">
                                  SON OTURUM
                                </span>
                              )}
                              <span className={`rounded px-2 py-0.5 text-[8px] font-black ${
                                rolledBack
                                  ? "bg-slate-200 text-slate-600"
                                  : String(session.status) === "completed"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}>
                                {session.status || "—"}
                              </span>
                            </div>
                            <div className="mt-1 text-[9px] font-semibold text-slate-400">
                              {session.createdAt
                                ? new Date(session.createdAt).toLocaleString("tr-TR")
                                : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold">
                              <span className="text-slate-600">
                                {Number(session.questionCount || 0)} toplam soru
                              </span>
                              <span className="text-emerald-700">
                                {activeCount} aktif
                              </span>
                              <span className="text-slate-500">
                                {Number(session.deletedQuestionCount || 0)} geri alınmış/silinmiş
                              </span>
                              <span className="text-blue-700">
                                {Number(session.completedOutcomes || 0)} kazanım
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={
                              activeCount <= 0 ||
                              rollingBackImportSessionId === String(session.id)
                            }
                            onClick={() => void rollbackImportSession(session)}
                            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-3 text-[9px] font-black text-white hover:bg-rose-700 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {rollingBackImportSessionId === String(session.id)
                              ? "Geri alınıyor…"
                              : index === 0
                                ? `Son İçe Aktarmayı Geri Al (${activeCount})`
                                : `Oturumu Geri Al (${activeCount})`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SmartFolderPreviewModal
        open={smartFolderPreviewOpen}
        preview={smartFolderPreview}
        excludedOutcomes={smartFolderExcludedOutcomes}
        setExcludedOutcomes={setSmartFolderExcludedOutcomes}
        routeOverrides={smartFolderRouteOverrides}
        setRouteOverrides={setSmartFolderRouteOverrides}
        outcomeOptions={smartFolderOutcomeOptions}
        selectedGroups={smartFolderSelectedGroups}
        selectedFileCount={smartFolderSelectedFileCount}
        importRunning={smartFolderImportRunning}
        groupKey={smartFolderGroupKey}
        toggleOutcome={toggleSmartFolderOutcome}
        onCancel={cancelSmartFolderPreview}
        onImport={executeSmartQuestionFolderImport}
      />
      {migrationRecoveryOpen && migrationRecoveryPlan && (
        <div className="fixed inset-0 z-[246] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Migration kurtarma planını kapat"
            onClick={() => setMigrationRecoveryOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-rose-700 px-5 py-4 text-white">
              <div>
                <div className="text-base font-black">Migration Kurtarma Planı</div>
                <div className="mt-1 text-[10px] font-semibold text-rose-100">
                  Veritabanını geri yüklemeden önce backend sunucusu kapatılmalıdır.
                </div>
              </div>
              <button type="button" onClick={() => setMigrationRecoveryOpen(false)} className="rounded-xl bg-white/10 p-2 hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-black uppercase text-slate-400">Mevcut Şema</div>
                  <div className="mt-1 text-lg font-black text-slate-900">v{Number(migrationRecoveryPlan.currentVersion || 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-black uppercase text-slate-400">Hedef Şema</div>
                  <div className="mt-1 text-lg font-black text-slate-900">v{Number(migrationRecoveryPlan.targetVersion || 0)}</div>
                </div>
              </div>

              {migrationRecoveryPlan.lastError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <div className="text-[9px] font-black uppercase text-rose-600">Son Migration Hatası</div>
                  <div className="mt-1 text-[9px] font-semibold leading-4 text-rose-800">{migrationRecoveryPlan.lastError}</div>
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[9px] font-black uppercase text-amber-700">Migration Öncesi Yedek</div>
                <div className="mt-1 break-all font-mono text-[9px] font-bold text-amber-900">
                  {migrationRecoveryPlan.backupPath || "Yedek yolu bulunamadı."}
                </div>
              </div>

              <div className="space-y-2">
                {(migrationRecoveryPlan.instructions || []).map((instruction: string, index: number) => (
                  <div key={`${index}-${instruction}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-black text-white">{index + 1}</span>
                    <span className="text-[9px] font-semibold leading-5 text-slate-600">{instruction}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[9px] font-semibold leading-4 text-blue-800">
                Canlı SQLite dosyasının üzerine bu ekrandan yazılmaz. Paket içindeki
                <span className="font-black"> MIGRATION_GERI_YUKLE_V34.ps1 </span>
                aracı backend kapalıyken kullanılmalıdır.
              </div>
            </div>
          </div>
        </div>
      )}

      {bankCapacityOpen && (
        <React.Suspense fallback={null}>
          <QuestionBankCapacityModal
            bankCapacity={bankCapacity}
            bankCapacityLoading={bankCapacityLoading}
            bankCapacityGrade={bankCapacityGrade}
            bankCapacityCourseId={bankCapacityCourseId}
            bankMinimumStock={bankMinimumStock}
            curriculumMoveCatalog={curriculumMoveCatalog}
            curriculumCoverage={curriculumCoverage}
            setBankCapacityGrade={setBankCapacityGrade}
            setBankCapacityCourseId={setBankCapacityCourseId}
            setBankMinimumStock={setBankMinimumStock}
            loadQuestionBankCapacity={loadQuestionBankCapacity}
            focusCapacityOutcomeForUpload={focusCapacityOutcomeForUpload}
            onClose={() => setBankCapacityOpen(false)}
          />
        </React.Suspense>
      )}

      {bankSearchOpen && (
        <React.Suspense fallback={null}>
          <QuestionBankSearchModal
            open={bankSearchOpen}
            loading={bankSearchLoading}
            filters={bankSearchFilters}
            results={bankSearchResults}
            total={bankSearchTotal}
            offset={bankSearchOffset}
            curriculumMoveCatalog={curriculumMoveCatalog}
            gradeEntry={bankSearchGradeEntry}
            course={bankSearchCourse}
            unit={bankSearchUnit}
            topic={bankSearchTopic}
            onClose={() => setBankSearchOpen(false)}
            onFilterChange={updateBankSearchFilter}
            onSearch={runQuestionBankSearch}
            onReset={resetQuestionBankSearch}
            onPreview={setBankSearchPreview}
          />
        </React.Suspense>
      )}

      {bankSearchPreview && (
        <React.Suspense fallback={null}>
          <QuestionBankPreviewModal
            preview={bankSearchPreview}
            onClose={() => setBankSearchPreview(null)}
          />
        </React.Suspense>
      )}
      {bankHealthOpen && (
        <div className="fixed inset-0 z-[245] flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Soru bankası sağlık penceresini kapat"
            className="absolute inset-0 cursor-default"
            onClick={() => setBankHealthOpen(false)}
          />
          <div
            className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
              <div>
                <div className="flex items-center gap-2 text-base font-black">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  Soru Bankası Sağlığı
                </div>
                <div className="mt-1 text-[10px] font-semibold text-slate-400">
                  Dosya deposu ve SQLite soru kayıtlarının durumunu kontrol eder.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBankHealthOpen(false)}
                className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">
                    Aktif Soru
                  </div>
                  <div className="mt-1 text-2xl font-black text-emerald-950">
                    {Number(bankStatus?.activeRecords || 0).toLocaleString("tr-TR")}
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wide text-blue-600">
                    Fiziksel Görsel
                  </div>
                  <div className="mt-1 text-2xl font-black text-blue-950">
                    {Number(bankStatus?.files || 0).toLocaleString("tr-TR")}
                  </div>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wide text-violet-600">
                    Kullanılan Alan
                  </div>
                  <div className="mt-1 text-2xl font-black text-violet-950">
                    {formatBankBytes(bankStatus?.bytes)}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                    Çöp Kutusu
                  </div>
                  <div className="mt-1 text-2xl font-black text-amber-950">
                    {Number(bankStatus?.deletedRecords || 0).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>

              <React.Suspense fallback={null}>
                <QuestionBankBackupRecoverySection
                  bankBackupLoading={bankBackupLoading}
                  bankRestoreLoading={bankRestoreLoading}
                  bankRestoreInputRef={bankRestoreInputRef}
                  bankRestoreResult={bankRestoreResult}
                  createQuestionBankBackup={createQuestionBankBackup}
                  restoreQuestionBankFromFile={restoreQuestionBankFromFile}
                />

                <QuestionBankThumbnailSection
                  thumbnailBatchRunning={thumbnailBatchRunning}
                  thumbnailStatus={thumbnailStatus}
                  thumbnailProgress={thumbnailProgress}
                  bankStatus={bankStatus}
                  buildMissingThumbnails={buildMissingThumbnails}
                  formatBankBytes={formatBankBytes}
                />
              </React.Suspense>
              {productionReadiness && (
                <React.Suspense fallback={null}>
                  <QuestionBankReadinessSection
                    productionReadiness={productionReadiness}
                    productionReadinessLoading={productionReadinessLoading}
                    refreshProductionReadiness={refreshProductionReadiness}
                    technicalDiagnosticsOpen={technicalDiagnosticsOpen}
                    setTechnicalDiagnosticsOpen={setTechnicalDiagnosticsOpen}
                  />
                </React.Suspense>
              )}
              {technicalDiagnosticsOpen && (
                <div className="mt-2">
              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">
                      Tutarlı Soru Bankası Yedeği
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      SQLite metadata, indeks ve soru görsellerini aynı yedek oturumunda manifest ve SHA-256 doğrulamasıyla saklar.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={coordinatedBackupRunning}
                      onClick={() => void createCoordinatedBackup()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-teal-700 px-3 text-[9px] font-black text-white hover:bg-teal-800 disabled:opacity-40"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {coordinatedBackupRunning
                        ? "Yedek oluşturuluyor…"
                        : "Tutarlı Yedek Oluştur"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        coordinatedBackupVerifying ||
                        !coordinatedBackupResult?.backupRoot
                      }
                      onClick={() => void verifyCoordinatedBackup()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-teal-200 bg-white px-3 text-[9px] font-black text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {coordinatedBackupVerifying
                        ? "Doğrulanıyor…"
                        : "Yedeği Doğrula"}
                    </button>

                    <button
                      type="button"
                      disabled={disasterRecoveryRunning || !coordinatedBackupVerification?.valid}
                      onClick={() => void runDisasterRecoveryDrill()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-[9px] font-black text-violet-800 hover:bg-violet-50 disabled:opacity-40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {disasterRecoveryRunning ? "Kurtarma provası…" : "Kurtarma Provası"}
                    </button>
                  </div>
                </div>

                {coordinatedBackupResult?.manifest && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Aktif Kayıt
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(
                          coordinatedBackupResult.manifest.questionBank
                            ?.activeRecords || 0,
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Kopyalanan Dosya
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(
                          coordinatedBackupResult.manifest.questionBank
                            ?.copiedFiles || 0,
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Eksik Dosya
                      </div>
                      <div
                        className={`mt-1 text-sm font-black ${
                          Number(
                            coordinatedBackupResult.manifest.questionBank
                              ?.missingFiles || 0,
                          ) > 0
                            ? "text-rose-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {Number(
                          coordinatedBackupResult.manifest.questionBank
                            ?.missingFiles || 0,
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Şema
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        v{Number(
                          coordinatedBackupResult.manifest.schemaVersion || 0,
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {coordinatedBackupResult?.backupRoot && (
                  <div className="mt-3 break-all rounded-xl border border-teal-100 bg-white/80 px-3 py-2 font-mono text-[8px] font-semibold text-teal-900">
                    {coordinatedBackupResult.backupRoot}
                  </div>
                )}

                {coordinatedBackupVerification && (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 text-[9px] font-black ${
                      coordinatedBackupVerification.valid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {coordinatedBackupVerification.valid
                      ? `Yedek doğrulandı. SQLite SHA-256 ve ${Number(
                          coordinatedBackupVerification.checkedFiles || 0,
                        )} soru dosyası tutarlı.`
                      : coordinatedBackupVerification.error ||
                        `Yedek doğrulaması başarısız. ${Number(
                          coordinatedBackupVerification.invalidFiles || 0,
                        )} sorunlu dosya bulundu.`}
                  </div>
                )}

                {disasterRecoveryResult && (
                  <div className={`mt-3 rounded-xl border p-3 ${
                    disasterRecoveryResult.success
                      ? "border-violet-200 bg-violet-50"
                      : "border-rose-200 bg-rose-50"
                  }`}>
                    <div className={`text-[9px] font-black ${
                      disasterRecoveryResult.success ? "text-violet-800" : "text-rose-800"
                    }`}>
                      {disasterRecoveryResult.message}
                    </div>

                    {Array.isArray(disasterRecoveryResult.checks) && (
                      <div className="mt-2 space-y-1.5">
                        {disasterRecoveryResult.checks.map((check: any) => (
                          <div key={check.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/80 px-2.5 py-2">
                            <div>
                              <div className="text-[8px] font-black text-slate-700">{check.label}</div>
                              <div className="mt-0.5 text-[7px] font-semibold text-slate-500">{check.detail}</div>
                            </div>
                            <span className={`rounded px-2 py-0.5 text-[7px] font-black ${
                              check.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}>
                              {check.ok ? "GEÇTİ" : "HATA"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-white bg-white/70 px-3 py-2 text-[8px] font-semibold leading-4 text-slate-500">
                  Geri yükleme bu ekrandan canlı olarak yapılmaz. Önce yedek manifesti ve SHA-256 doğrulaması geçmelidir; gerçek geri yükleme çevrimdışı kurtarma akışında uygulanacaktır.
                </div>
              </div>

              <QuestionBankDatasetProfileSection
                datasetProfile={datasetProfile}
                formatBytes={formatBytes}
              />

              <React.Suspense fallback={null}>
                <QuestionBankMaintenanceSection
                  maintenancePreview={maintenancePreview}
                  maintenancePreviewLoading={maintenancePreviewLoading}
                  maintenanceRunning={maintenanceRunning}
                  maintenanceResult={maintenanceResult}
                  refreshMaintenancePreview={refreshMaintenancePreview}
                  runMaintenanceOrchestrator={runMaintenanceOrchestrator}
                />
              </React.Suspense>

              {questionBankHealthScore && (
                <React.Suspense fallback={null}>
                  <QuestionBankHealthScoreSection
                    questionBankHealthScore={questionBankHealthScore}
                    healthScoreHistory={healthScoreHistory}
                    healthScoreTrend={healthScoreTrend}
                    healthScoreRecording={healthScoreRecording}
                    refreshHealthScoreHistory={refreshHealthScoreHistory}
                  />
                </React.Suspense>
              )}

              {performanceBenchmark && (
                <React.Suspense fallback={null}>
                  <QuestionBankPerformanceBenchmarkSection
                    performanceBenchmark={performanceBenchmark}
                    performanceBenchmarkRunning={performanceBenchmarkRunning}
                    runPerformanceBenchmark={runPerformanceBenchmark}
                    performanceHistory={performanceHistory}
                    performanceHistoryRecording={performanceHistoryRecording}
                    refreshPerformanceHistory={refreshPerformanceHistory}
                  />
                </React.Suspense>
              )}

              {databaseOptimization && (
                <React.Suspense fallback={null}>
                  <QuestionBankDatabaseOptimizationSection
                    databaseOptimization={databaseOptimization}
                    databaseOptimizationRunning={databaseOptimizationRunning}
                    executeDatabaseAnalyze={executeDatabaseAnalyze}
                  />
                </React.Suspense>
              )}

              {queryPlanAnalysis && (
                <React.Suspense fallback={null}>
                  <QuestionBankQueryPlanAnalysisSection
                    queryPlanAnalysis={queryPlanAnalysis}
                    queryPlanLoading={queryPlanLoading}
                    refreshQueryPlanAnalysis={refreshQueryPlanAnalysis}
                    indexEffectiveness={indexEffectiveness}
                    indexEffectivenessLoading={indexEffectivenessLoading}
                    refreshIndexEffectiveness={refreshIndexEffectiveness}
                    indexRecommendations={indexRecommendations}
                    indexApplyRunning={indexApplyRunning}
                    applyRecommendedIndexes={applyRecommendedIndexes}
                  />
                </React.Suspense>
              )}

                </div>
              )}

              <React.Suspense fallback={null}>
                <QuestionBankIntegrityHistorySection
                  integrityHistory={integrityHistory}
                  integrityRunning={integrityRunning}
                  integrityChanges={integrityChanges}
                  integrityRecommendations={integrityRecommendations}
                  refreshIntegrityHistory={refreshIntegrityHistory}
                  safeActions={safeActions}
                  safeActionRunning={safeActionRunning}
                  safeActionResult={safeActionResult}
                  executeSafeRecommendation={executeSafeRecommendation}
                  safeActionAudit={safeActionAudit}
                  safeActionAuditLoading={safeActionAuditLoading}
                  safeActionAuditCleaning={safeActionAuditCleaning}
                  safeActionAuditExporting={safeActionAuditExporting}
                  safeActionAuditFilter={safeActionAuditFilter}
                  setSafeActionAuditFilter={setSafeActionAuditFilter}
                  refreshSafeActionAudit={refreshSafeActionAudit}
                  exportSafeActionAudit={exportSafeActionAudit}
                  cleanSafeActionAudit={cleanSafeActionAudit}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankOrphanFilesSection
                  orphanScan={orphanScan}
                  orphanScanning={orphanScanning}
                  orphanQuarantining={orphanQuarantining}
                  scanOrphanFiles={scanOrphanFiles}
                  quarantineOrphanFiles={quarantineOrphanFiles}
                  formatBytes={formatBytes}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankQuarantineVaultSection
                  quarantineInventory={quarantineInventory}
                  quarantineLoading={quarantineLoading}
                  quarantineRestoring={quarantineRestoring}
                  quarantinePurging={quarantinePurging}
                  quarantinePurgeResult={quarantinePurgeResult}
                  refreshQuarantineInventory={refreshQuarantineInventory}
                  restoreQuarantinedFile={restoreQuarantinedFile}
                  purgeOldQuarantine={purgeOldQuarantine}
                  formatBytes={formatBytes}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankWriteJournalSection
                  writeJournalStatus={writeJournalStatus}
                  writeJournalCleaning={writeJournalCleaning}
                  writeJournalRecovering={writeJournalRecovering}
                  cleanWriteJournal={cleanWriteJournal}
                  recoverPendingWrites={recoverPendingWrites}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankStartupAuditSection
                  startupAudit={startupAudit}
                  startupAuditRunning={startupAuditRunning}
                  refreshStartupAudit={refreshStartupAudit}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankSchemaVersionSection
                  bankVersion={bankVersion}
                  bankWriteState={bankWriteState}
                  migrationRecoveryLoading={migrationRecoveryLoading}
                  openMigrationRecoveryPlan={openMigrationRecoveryPlan}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankSqliteIndexSection
                  bankIndexStatus={bankIndexStatus}
                  bankIndexRebuilding={bankIndexRebuilding}
                  rebuildBankIndex={rebuildBankIndex}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankTechnicalSupportSection
                  supportBundleLoading={supportBundleLoading}
                  downloadSupportBundle={downloadSupportBundle}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankDiagnosticsSection
                  bankDiagnostics={bankDiagnostics}
                  bankDiagnosticsRunning={bankDiagnosticsRunning}
                  runBankDiagnostics={runBankDiagnostics}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankMaintenanceToolsSection
                  bankMaintenanceRunning={bankMaintenanceRunning}
                  bankIntegrity={bankIntegrity}
                  bankMaintenanceResult={bankMaintenanceResult}
                  runQuestionBankOptimization={runQuestionBankOptimization}
                  runMissingRecordCleanup={runMissingRecordCleanup}
                  runOrphanFileCleanup={runOrphanFileCleanup}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankFileDatabaseIntegritySection
                  bankIntegrity={bankIntegrity}
                  bankHealthLoading={bankHealthLoading}
                  integrityProblemCount={integrityProblemCount}
                  runQuestionBankIntegrity={runQuestionBankIntegrity}
                />
              </React.Suspense>

              <React.Suspense fallback={null}>
                <QuestionBankTrashSection
                  deletedQuestions={deletedQuestions}
                  restoringQuestionId={restoringQuestionId}
                  restoreDeletedQuestion={restoreDeletedQuestion}
                />
              </React.Suspense>

              {bankStatus?.root && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[9px] font-semibold text-slate-400">
                  <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-all">{bankStatus.root}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={questionUploadSingleInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleQuestionUploadFiles}
      />
      <input
        ref={questionUploadMultipleInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        multiple
        className="hidden"
        onChange={handleQuestionUploadFiles}
      />
      <input
        ref={questionUploadFolderInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
        onChange={handleQuestionUploadFiles}
      />

      {questionUploadChoiceTarget && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-lg font-black text-slate-900">
              {pendingQuestionType ? "Yükleme yöntemini seçin" : "Soru türünü seçin"}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{questionUploadChoiceTarget.targetName}</div>
            {questionUploadStatus && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${questionUploadRunning ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                {questionUploadStatus}
              </div>
            )}

            {!pendingQuestionType ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseQuestionType("exam")}
                  className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-5 text-sm font-black text-rose-700 hover:bg-rose-100"
                >
                  Sınav Sorusu
                </button>
                <button
                  type="button"
                  onClick={() => chooseQuestionType("study")}
                  className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-5 text-sm font-black text-sky-700 hover:bg-sky-100"
                >
                  Çalışma Sorusu
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
                  Tür: {pendingQuestionType === "exam" ? "Sınav Sorusu" : "Çalışma Sorusu"}
                </div>
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold leading-5 text-slate-700">
                  <div className="font-black text-amber-800">Dosya isimlendirme kuralı</div>
                  <div className="mt-1">
                    Normal soru: <span className="font-black">001_A.jpg</span>
                    <span className="text-slate-500"> (S01_A.jpg da kabul edilir)</span>
                  </div>
                  <div>
                    Son harf doğru cevaptır: <span className="font-black">A, B, C, D veya E</span>.
                  </div>
                  <div className="mt-1">
                    Grup sorusu: <span className="font-black">001__G01Y.jpg</span> öncül, ardından
                    <span className="font-black"> 002_A_G01.jpg, 003_C_G01.jpg...</span>
                  </div>
                  <div className="mt-1 text-slate-500">Yalnızca PNG, JPG veya JPEG dosyaları yüklenebilir.</div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={questionUploadRunning}
                    onClick={() => chooseQuestionUploadMode("single")}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-purple-300 hover:bg-purple-50"
                  >
                    Tek Dosya Seç
                  </button>
                  <button
                    type="button"
                    disabled={questionUploadRunning}
                    onClick={() => chooseQuestionUploadMode("multiple")}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-purple-300 hover:bg-purple-50"
                  >
                    Çoklu Dosya Seç
                  </button>
                  <button
                    type="button"
                    disabled={questionUploadRunning}
                    onClick={() => chooseQuestionUploadMode("folder")}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-purple-300 hover:bg-purple-50"
                  >
                    Klasör Seç
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingQuestionType(null)}
                  className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-200"
                >
                  Soru Türüne Dön
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setQuestionUploadChoiceTarget(null); setPendingQuestionType(null); }}
              className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-200"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <QuestionBankViewerModal
        questionViewer={questionViewer}
        viewerContext={viewerContext}
        moveDraft={moveDraft}
        viewerZoom={viewerZoom}
        selectedMoveCourse={selectedMoveCourse}
        expandedMoveUnitId={expandedMoveUnitId}
        setViewerZoom={setViewerZoom}
        setQuestionViewer={setQuestionViewer}
        setMoveDraft={setMoveDraft}
        setExpandedMoveUnitId={setExpandedMoveUnitId}
        navigateViewer={navigateViewer}
        saveQuestionMove={saveQuestionMove}
      />

      </div>
    </div>
  );
}























