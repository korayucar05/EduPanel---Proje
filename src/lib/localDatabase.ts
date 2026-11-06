import { getActiveSchoolScope, tenantCollectionName, tenantTransactionCollections } from "../core/tenant";
import { runtimeSessionStorage } from "./runtimeSessionStorage";
import { normalizeStudentRows } from "../core/student";

const request = async (url: string, init?: RequestInit) => {
  const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      "X-eNstitu-School-Id": getActiveSchoolScope(),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Yerel veritabanı isteği başarısız");
  return response.json();
};

const collectionWriteQueues = new Map<string, Promise<void>>();

const enqueueWrite = (key: string, operation: () => Promise<void>) => {
  const previous = collectionWriteQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  collectionWriteQueues.set(key, current);
  return current.finally(() => {
    if (collectionWriteQueues.get(key) === current) collectionWriteQueues.delete(key);
  });
};

export async function flushLocalDatabaseWrites() {
  const pending = Array.from(collectionWriteQueues.values());
  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

export function hasPendingLocalDatabaseWrites() {
  return collectionWriteQueues.size > 0;
}

const isStudentCollection = (collectionName: string) =>
  collectionName === "students" || collectionName === "school_students";

export async function fetchCollectionFromLocalDatabase(collectionName: string): Promise<any[]> {
  const scoped = tenantCollectionName(collectionName);
  const rows = await request(`/api/database/collections/${encodeURIComponent(scoped)}`);
  return isStudentCollection(collectionName) ? normalizeStudentRows(rows) : rows;
}

export async function syncCollectionToLocalDatabase(collectionName: string, dataArray: any[]) {
  const scoped = tenantCollectionName(collectionName);
  const payload = isStudentCollection(collectionName) ? normalizeStudentRows(dataArray) : dataArray;
  await enqueueWrite(`collection:${scoped}`, async () => {
    await request(`/api/database/collections/${encodeURIComponent(scoped)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });
}

export interface AcademicCatalogSnapshot {
  classrooms: any[];
  courses: any[];
  customCreatedCourses: any[];
}

export async function fetchAcademicCatalogFromLocalDatabase(): Promise<AcademicCatalogSnapshot> {
  if (getActiveSchoolScope() === "school-main") return request("/api/database/academic-catalog");
  const [classrooms, courses, customCreatedCourses] = await Promise.all([
    fetchCollectionFromLocalDatabase("classrooms"),
    fetchCollectionFromLocalDatabase("courses"),
    fetchCollectionFromLocalDatabase("customCreatedCourses"),
  ]);
  return { classrooms, courses, customCreatedCourses };
}

export async function syncAcademicCatalogToLocalDatabase(snapshot: AcademicCatalogSnapshot) {
  if (getActiveSchoolScope() === "school-main") {
    await enqueueWrite("academic-catalog", async () => {
      await request("/api/database/academic-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
    });
    return;
  }
  await transactLocalCollections({
    classrooms: snapshot.classrooms || [],
    courses: snapshot.courses || [],
    customCreatedCourses: snapshot.customCreatedCourses || [],
  });
}

export async function upsertLocalDocument(collectionName: string, documentId: string, data: any) {
  const scoped = tenantCollectionName(collectionName);
  await request(`/api/database/collections/${encodeURIComponent(scoped)}/${encodeURIComponent(documentId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return true;
}

export async function searchLostDocumentRecords(type: "diploma" | "tasdikname", searchBy: "name" | "number" | "tc", query: string) {
  return request(`/api/lost-documents/${type}?by=${searchBy}&q=${encodeURIComponent(query)}`) as Promise<{ count: number; records: any[] }>;
}

export async function searchStudentRecords(query: string) {
  const result = await request(`/api/students/search?q=${encodeURIComponent(query)}`) as { count: number; records: any[] };
  return {
    ...result,
    records: normalizeStudentRows(Array.isArray(result?.records) ? result.records : []),
  };
}

export async function testLocalDatabaseConnection() {
  try {
    const result = await request("/api/database/status");
    return result?.status === "ok";
  } catch {
    return false;
  }
}

export async function createLocalDatabaseBackup() {
  return request("/api/database/backup", { method: "POST" });
}

export async function transactLocalCollections(collections: Record<string, unknown[]>) {
  const scopedCollections = tenantTransactionCollections(collections);
  await request("/api/database/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collections: scopedCollections }),
  });
}


/**
 * Geriye dönük uyumluluk yardımcıları.
 * Eski modüller bu adları import ediyor olabilir.
 */
export async function getLocalCollection(collectionName: string): Promise<any[]> {
  return fetchCollectionFromLocalDatabase(collectionName);
}

export async function replaceLocalCollection(collectionName: string, dataArray: any[]) {
  return syncCollectionToLocalDatabase(collectionName, dataArray);
}

export async function readAcademicCatalogFromLocalDatabase(): Promise<AcademicCatalogSnapshot> {
  return fetchAcademicCatalogFromLocalDatabase();
}

export async function deleteLocalDocument(collectionName: string, documentId: string) {
  const scoped = tenantCollectionName(collectionName);
  await enqueueWrite(`collection:${scoped}`, async () => {
    await request(`/api/database/collections/${encodeURIComponent(scoped)}/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    });
  });
  return true;
}



export const createQuestionThumbnailBlob = async (file: File): Promise<Blob | null> => {
  if (typeof window === "undefined") return null;
  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });

      const maxEdge = 360;
      const ratio = Math.min(
        1,
        maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height),
      );
      const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.72),
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};

// Soru bankası görselleri dosya sisteminde tutulur; SQLite yalnız metadata/path tutar.
export async function createQuestionBankImportSession(payload: {
  label?: string;
  source?: string;
  grade?: number;
  courseCount?: number;
  expectedFiles?: number;
  expectedOutcomes?: number;
}) {
  return request("/api/question-bank/import-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateQuestionBankImportSession(id: string, payload: any) {
  return request(`/api/question-bank/import-sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listQuestionBankImportSessions(limit = 30) {
  return request(
    `/api/question-bank/import-sessions?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function rollbackQuestionBankImportSession(id: string) {
  return request(
    `/api/question-bank/import-sessions/${encodeURIComponent(id)}/rollback`,
    { method: "POST" },
  );
}

export async function getQuestionBankCapacity(params: {
  grade?: number;
  courseId?: string;
  minimumStock?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      search.set(key, String(value));
    }
  });
  return request(`/api/question-bank/capacity?${search.toString()}`);
}

export async function getQuestionBankThumbnailStatus(params: {
  limit?: number;
  offset?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  return request(`/api/question-bank/thumbnails/status?${search.toString()}`);
}

export async function createQuestionThumbnailFromUrl(
  questionId: string,
  imageUrl: string,
) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Tam çözünürlüklü soru görseli okunamadı.");
  }
  const blob = await response.blob();
  const file = new File(
    [blob],
    `question-${questionId}.${blob.type.includes("png") ? "png" : "jpg"}`,
    { type: blob.type || "image/jpeg" },
  );
  const thumbnail = await createQuestionThumbnailBlob(file);
  if (!thumbnail) {
    throw new Error("Thumbnail oluşturulamadı.");
  }

  const thumbnailResponse = await fetch(
    `/api/question-bank/thumbnails/${encodeURIComponent(questionId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: thumbnail,
    },
  );
  const body = await thumbnailResponse.json().catch(() => ({}));
  if (!thumbnailResponse.ok) {
    throw new Error(body?.error || "Thumbnail kaydedilemedi.");
  }
  return body;
}

export async function uploadQuestionBankImage(file: File, metadata: {
  grade: number; courseId: string; unitId: string; topicId: string; outcomeId: string;
  questionCode: string; answer: string; importSessionId?: string; questionType?: "exam" | "study";
  role?: "question" | "instruction";
}) {
  const response = await fetch("/api/question-bank/images", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Question-Grade": String(metadata.grade || ""),
      "X-Question-Course": encodeURIComponent(metadata.courseId || ""),
      "X-Question-Unit": encodeURIComponent(metadata.unitId || ""),
      "X-Question-Topic": encodeURIComponent(metadata.topicId || ""),
      "X-Question-Outcome": encodeURIComponent(metadata.outcomeId || ""),
      "X-Question-Code": encodeURIComponent(metadata.questionCode || ""),
      "X-Question-Answer": String(metadata.answer || ""),
      "X-Question-Import-Session": String(metadata.importSessionId || ""),
      "X-Question-Type": String(metadata.questionType || "study"),
      "X-Question-Role": String(metadata.role || "question"),
      "X-Original-Name": encodeURIComponent(file.name || "question.jpg"),
    },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Soru görseli kaydedilemedi.");
  }
  const record = await response.json();

  // Yönerge görseli soru değildir; thumbnail üretimine gerek yoktur.
  if (record?.instruction) return record;

  // Mükerrer içerik sunucuda güvenli biçimde atlanır; tekrar thumbnail üretilmez.
  if (record?.duplicate || record?.skipped) return record;

  // Thumbnail performans katmanıdır; başarısız olması tam soru yüklemesini bozmaz.
  try {
    const thumbnail = await createQuestionThumbnailBlob(file);
    if (thumbnail && record?.id) {
      const thumbnailResponse = await fetch(
        `/api/question-bank/thumbnails/${encodeURIComponent(record.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: thumbnail,
        },
      );
      if (thumbnailResponse.ok) {
        const thumbnailRecord = await thumbnailResponse.json();
        return { ...record, ...thumbnailRecord };
      }
    }
  } catch {
    // Tam çözünürlüklü soru kaydı başarılıysa thumbnail hatası yüklemeyi iptal etmez.
  }

  return record;
}

export async function moveQuestionBankImage(payload: any) {
  return request("/api/question-bank/images/move", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export async function deleteQuestionBankImage(storagePath: string) {
  return request("/api/question-bank/images", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath }),
  });
}


export async function getQuestionBankStatus() {
  return request("/api/question-bank/status");
}


export async function getQuestionBankVersion() {
  return request("/api/question-bank/version");
}


export async function getQuestionBankWriteState() {
  return request("/api/question-bank/write-state");
}


export async function recheckQuestionBankSafeMode() {
  return request("/api/question-bank/safe-mode/recheck", {
    method: "POST",
  });
}


export async function runQuestionBankStartupAudit() {
  return request("/api/question-bank/startup-audit/run", {
    method: "POST",
  });
}

export async function getQuestionBankStartupAudit(limit = 20) {
  return request(`/api/question-bank/startup-audit?limit=${encodeURIComponent(String(limit))}`);
}


export async function getQuestionBankHealthScore() {
  return request("/api/question-bank/health-score");
}


export async function getQuestionBankDatasetProfile() {
  return request("/api/question-bank/dataset-profile");
}


export async function getQuestionBankProductionReadiness() {
  return request("/api/question-bank/production-readiness");
}

export async function runQuestionBankDisasterRecoveryDrill(
  backupRoot: string,
) {
  return request("/api/question-bank/disaster-recovery/drill", {
    method: "POST",
    body: JSON.stringify({ backupRoot }),
  });
}

export async function createQuestionBankCoordinatedBackup() {
  return request("/api/question-bank/coordinated-backup", {
    method: "POST",
  });
}

export async function verifyQuestionBankCoordinatedBackup(
  backupRoot: string,
) {
  return request("/api/question-bank/coordinated-backup/verify", {
    method: "POST",
    body: JSON.stringify({ backupRoot }),
  });
}

export async function getQuestionBankPerformanceBenchmark() {
  return request("/api/question-bank/performance-benchmark");
}


export async function getQuestionBankQueryPlanAnalysis() {
  return request("/api/question-bank/query-plan-analysis");
}


export async function getQuestionBankIndexEffectiveness() {
  return request("/api/question-bank/index-effectiveness");
}


export async function getQuestionBankMaintenancePreview() {
  return request("/api/question-bank/maintenance-orchestrator/preview");
}

export async function runQuestionBankMaintenanceOrchestrator() {
  return request("/api/question-bank/maintenance-orchestrator/run", {
    method: "POST",
  });
}

export async function getQuestionBankIndexRecommendations() {
  return request("/api/question-bank/index-recommendations");
}

export async function applyQuestionBankRecommendedIndexes() {
  return request("/api/question-bank/index-recommendations/apply", {
    method: "POST",
  });
}

export async function getQuestionBankDatabaseOptimization() {
  return request("/api/question-bank/database-optimization");
}

export async function runQuestionBankDatabaseAnalyze() {
  return request("/api/question-bank/database-optimization/analyze", {
    method: "POST",
  });
}

export async function getQuestionBankPerformanceHistory(limit = 30) {
  return request(
    `/api/question-bank/performance-history?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function runQuestionBankPerformanceHistorySnapshot() {
  return request("/api/question-bank/performance-history/run", {
    method: "POST",
  });
}

export async function getQuestionBankHealthScoreTrend(limit = 30) {
  return request(
    `/api/question-bank/health-score/trend?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function getQuestionBankHealthScoreHistory(limit = 30) {
  return request(
    `/api/question-bank/health-score/history?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function runQuestionBankHealthScoreSnapshot() {
  return request("/api/question-bank/health-score/history/run", {
    method: "POST",
  });
}

export async function getQuestionBankIntegrityRecommendations() {
  return request("/api/question-bank/integrity-recommendations");
}


export async function getQuestionBankSafeActions() {
  return request("/api/question-bank/safe-actions");
}

export async function runQuestionBankSafeAction(actionId: string) {
  return request(
    `/api/question-bank/safe-actions/${encodeURIComponent(actionId)}/run`,
    { method: "POST" },
  );
}

export async function getQuestionBankSafeActionAudit(limit = 50) {
  return request(
    `/api/question-bank/safe-actions/audit?limit=${encodeURIComponent(String(limit))}`,
  );
}


export async function cleanupQuestionBankSafeActionAudit(
  retentionDays = 90,
) {
  return request("/api/question-bank/safe-actions/audit/cleanup", {
    method: "POST",
    body: JSON.stringify({ retentionDays }),
  });
}

export async function downloadQuestionBankSafeActionAudit(
  status = "",
  limit = 500,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("limit", String(limit));

  const response = await fetch(
    `/api/question-bank/safe-actions/audit/export?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body?.error || "Güvenli eylem geçmişi dışa aktarılamadı.",
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    fileName:
      match?.[1] ||
      `e-nstitu-safe-action-audit-${Date.now()}.json`,
  };
}

export async function getQuestionBankIntegrityChanges(limit = 30) {
  return request(
    `/api/question-bank/integrity-changes?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function getQuestionBankIntegrityHistory(limit = 30) {
  return request(
    `/api/question-bank/integrity-history?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function runQuestionBankIntegritySnapshot() {
  return request("/api/question-bank/integrity-history/run", {
    method: "POST",
  });
}

export async function getQuestionBankQuarantine() {
  return request("/api/question-bank/orphans/quarantine");
}


export async function purgeQuestionBankQuarantine(retentionDays = 30) {
  return request("/api/question-bank/orphans/quarantine/purge", {
    method: "POST",
    body: JSON.stringify({ retentionDays }),
  });
}

export async function restoreQuestionBankQuarantineFile(
  quarantinePath: string,
) {
  return request("/api/question-bank/orphans/quarantine/restore", {
    method: "POST",
    body: JSON.stringify({ quarantinePath }),
  });
}

export async function scanQuestionBankOrphans() {
  return request("/api/question-bank/orphans/scan");
}

export async function quarantineQuestionBankOrphans() {
  return request("/api/question-bank/orphans/quarantine", {
    method: "POST",
  });
}

export async function getQuestionBankWriteJournalStatus() {
  return request("/api/question-bank/write-journal/status");
}

export async function recoverQuestionBankPendingWrites() {
  return request("/api/question-bank/write-journal/recover", {
    method: "POST",
  });
}


export async function cleanupQuestionBankWriteJournal(retentionDays = 30) {
  return request("/api/question-bank/write-journal/cleanup", {
    method: "POST",
    body: JSON.stringify({ retentionDays }),
  });
}

export async function downloadQuestionBankSupportBundle() {
  const response = await fetch("/api/question-bank/support-bundle", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Soru bankası destek paketi oluşturulamadı.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    fileName:
      match?.[1] ||
      `e-nstitu-question-bank-support-${Date.now()}.json`,
  };
}


export async function getQuestionBankMigrationRecoveryPlan() {
  return request("/api/question-bank/migration/recovery-plan");
}

export async function checkQuestionBankIntegrity() {
  return request("/api/question-bank/integrity");
}


export async function cleanupQuestionBankMissingRecords() {
  return request("/api/question-bank/maintenance/cleanup-missing", {
    method: "POST",
  });
}

export async function cleanupQuestionBankOrphanFiles() {
  return request("/api/question-bank/maintenance/cleanup-orphans", {
    method: "POST",
  });
}

export async function optimizeQuestionBank() {
  return request("/api/question-bank/maintenance/optimize", {
    method: "POST",
  });
}


export async function runQuestionBankDiagnostics() {
  return request("/api/question-bank/diagnostics");
}


export async function getQuestionBankIndexStatus() {
  return request("/api/question-bank/index/status");
}

export async function rebuildQuestionBankIndex() {
  return request("/api/question-bank/index/rebuild", {
    method: "POST",
  });
}

export async function getQuestionBankNextSequence(params: {
  grade: number;
  courseId: string;
  unitId: string;
  topicId: string;
  outcomeId?: string;
}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, String(value));
  });
  return request(`/api/question-bank/next-sequence?${search.toString()}`);
}

export async function getQuestionBankDeletionProtection(questionId: string) {
  return request(
    `/api/question-bank/questions/${encodeURIComponent(questionId)}/protection`,
  );
}

export async function deleteQuestionBankRecord(questionId: string) {
  return request(`/api/question-bank/questions/${encodeURIComponent(questionId)}`, {
    method: "DELETE",
  });
}

export async function deleteQuestionBankRecordsBulk(questionIds: string[]) {
  return request("/api/question-bank/questions/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionIds }),
  });
}

export async function rebindQuestionBankHierarchy(payload: {
  source: {
    grade: number;
    courseId: string;
    unitId: string;
    topicId: string;
    outcomeId?: string;
    questionType?: "exam" | "study";
  };
  target: {
    grade: number;
    courseId: string;
    unitId: string;
    topicId: string;
    outcomeId?: string;
    questionType?: "exam" | "study";
  };
}) {
  return request("/api/question-bank/rebind-hierarchy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getQuestionBankCounts(params: {
  grade?: number;
  courseId?: string;
  questionType?: "exam" | "study";
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      search.set(key, String(value));
    }
  });
  return request(`/api/question-bank/counts?${search.toString()}`);
}

export async function listQuestionBankRecords(params: {
  status?: "active" | "deleted";
  grade?: number;
  courseId?: string;
  unitId?: string;
  topicId?: string;
  outcomeId?: string;
  unassignedOnly?: boolean;
  questionType?: "exam" | "study";
  answer?: "A" | "B" | "C" | "D" | "E";
  usage?: "used" | "unused";
  examId?: string;
  q?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      search.set(key, String(value));
    }
  });
  return request(`/api/question-bank/questions?${search.toString()}`);
}

export async function assignQuestionBankOutcome(
  questionId: string,
  target: { outcomeId: string; unitName: string; topicName: string; outcomeName: string },
) {
  return request(`/api/question-bank/questions/${encodeURIComponent(questionId)}/curriculum`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
}

export async function restoreQuestionBankRecord(id: string) {
  return request(`/api/question-bank/restore/${encodeURIComponent(id)}`, {
    method: "POST",
  });
}


export async function downloadQuestionBankBackup(templates: any[] = []) {
  const response = await fetch("/api/question-bank/backup/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Soru bankası yedeği oluşturulamadı.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    blob,
    fileName: match?.[1] || `e-nstitu-soru-bankasi-${Date.now()}.enqbackup.gz`,
  };
}

export async function restoreQuestionBankBackup(file: File) {
  const response = await fetch("/api/question-bank/backup/restore", {
    method: "POST",
    headers: { "Content-Type": "application/x-enstitu-question-backup" },
    body: file,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || "Soru bankası yedeği geri yüklenemedi.");
  }
  return body;
}


export async function recordQuestionBankUsage(payload: {
  questionId: string;
  examId: string;
  examName?: string;
  examDate?: string;
  bookType?: string;
  questionNumber?: number;
  source?: string;
}) {
  return request("/api/question-bank/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function removeQuestionBankUsage(questionId: string, examId: string) {
  return request("/api/question-bank/usage", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, examId }),
  });
}

export async function getQuestionBankUsage(questionId: string) {
  return request(`/api/question-bank/usage/${encodeURIComponent(questionId)}`);
}

export async function checkQuestionBankExamConflicts(examId: string, questionIds: string[]) {
  return request("/api/question-bank/usage/check-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examId, questionIds }),
  });
}
