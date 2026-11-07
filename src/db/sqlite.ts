import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { pool } from "./index.ts";
import { MySqlSyncDatabase } from "./mysqlSync.ts";
import {
  deleteRelationalDocument,
  ensureRelationalCoreSchema,
  isRelationalCoreReady,
  loadRelationalCoreDocuments,
  relationalCollectionAliases,
  relationalCollectionInfo,
  replaceRelationalCollection,
  upsertRelationalDocument,
} from "./relationalCore.ts";
import {
  deleteRelationalArchiveDocument,
  ensureRelationalArchivesSchema,
  isRelationalArchivesReady,
  loadRelationalArchiveDocuments,
  relationalArchiveCollectionInfo,
  replaceRelationalArchiveCollection,
  upsertRelationalArchiveDocument,
} from "./relationalArchives.ts";
import {
  deleteRelationalCommunicationDocument,
  ensureRelationalCommunicationsSchema,
  isRelationalCommunicationsReady,
  loadRelationalCommunicationDocuments,
  relationalCommunicationCollectionInfo,
  replaceRelationalCommunicationCollection,
  upsertRelationalCommunicationDocument,
} from "./relationalCommunications.ts";
import {
  deleteRelationalSurveyDocument,
  ensureRelationalSurveysSchema,
  isRelationalSurveysReady,
  loadRelationalSurveyDocuments,
  relationalSurveyCollectionInfo,
  replaceRelationalSurveyCollection,
  upsertRelationalSurveyDocument,
} from "./relationalSurveys.ts";
import {
  deleteRelationalGuidanceDocument,
  ensureRelationalGuidanceSchema,
  isRelationalGuidanceReady,
  loadRelationalGuidanceDocuments,
  relationalGuidanceCollectionInfo,
  replaceRelationalGuidanceCollection,
  upsertRelationalGuidanceDocument,
} from "./relationalGuidance.ts";
import {
  deleteRelationalHomeworkDocument,
  ensureRelationalHomeworkSchema,
  isRelationalHomeworkReady,
  loadRelationalHomeworkDocuments,
  relationalHomeworkCollectionInfo,
  replaceRelationalHomeworkCollection,
  upsertRelationalHomeworkDocument,
} from "./relationalHomework.ts";
import {
  deleteRelationalCurriculumDocument,
  ensureRelationalCurriculumSchema,
  isRelationalCurriculumReady,
  loadRelationalCurriculumDocuments,
  relationalCurriculumCollectionInfo,
  replaceRelationalCurriculumCollection,
  upsertRelationalCurriculumDocument,
} from "./relationalCurriculum.ts";
import {
  deleteRelationalCalendarDocument,
  ensureRelationalCalendarsSchema,
  isRelationalCalendarsReady,
  loadRelationalCalendarDocuments,
  relationalCalendarCollectionInfo,
  replaceRelationalCalendarCollection,
  upsertRelationalCalendarDocument,
} from "./relationalCalendars.ts";
import {
  deleteRelationalExamPlanningDocument,
  ensureRelationalExamPlanningSchema,
  isRelationalExamPlanningReady,
  loadRelationalExamPlanningDocuments,
  relationalExamPlanningCollectionInfo,
  replaceRelationalExamPlanningCollection,
  upsertRelationalExamPlanningDocument,
} from "./relationalExamPlanning.ts";
import {
  deleteRelationalExamArchiveDocument,
  ensureRelationalExamArchiveSchema,
  loadRelationalExamArchiveDocuments,
  relationalExamArchiveCollectionInfo,
  replaceRelationalExamArchiveCollection,
  upsertRelationalExamArchiveDocument,
} from "./relationalExamArchive.ts";
import {
  deleteRelationalAttendanceDocument,
  ensureRelationalAttendanceSchema,
  isRelationalAttendanceReady,
  loadRelationalAttendanceDocuments,
  relationalAttendanceCollectionInfo,
  replaceRelationalAttendanceCollection,
  upsertRelationalAttendanceDocument,
} from "./relationalAttendance.ts";
import {
  deleteRelationalAnnouncementDocument,
  ensureRelationalAnnouncementsSchema,
  isRelationalAnnouncementsReady,
  loadRelationalAnnouncementDocuments,
  relationalAnnouncementCollectionInfo,
  replaceRelationalAnnouncementCollection,
  upsertRelationalAnnouncementDocument,
} from "./relationalAnnouncements.ts";
import {
  deleteRelationalScheduleDocument,
  ensureRelationalScheduleSchema,
  isRelationalScheduleReady,
  loadRelationalScheduleDocuments,
  relationalScheduleDocumentInfo,
  replaceRelationalScheduleDocument,
} from "./relationalSchedule.ts";
import {
  deleteRelationalQuestionBankAuxDocument,
  ensureRelationalQuestionBankAuxSchema,
  isRelationalQuestionBankAuxReady,
  loadRelationalQuestionBankAuxDocuments,
  relationalQuestionBankAuxCollectionInfo,
  replaceRelationalQuestionBankAuxCollection,
  upsertRelationalQuestionBankAuxDocument,
} from "./relationalQuestionBankAux.ts";

const dataDirectory = path.join(process.cwd(), "data");
const backupDirectory = path.join(process.cwd(), "backups");
fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(backupDirectory, { recursive: true });

// Eski kodun soru dosyalarının kökünü bulmak için kullandığı yol değişkenidir.
// Bu dosya açılmaz veya SQLite veritabanı olarak kullanılmaz.
export const sqlitePath = path.join(dataDirectory, ".mysql-primary");
export const sqlite = new MySqlSyncDatabase();

type CachedDocument = { documentId: string; data: any; updatedAt: string };
const documentCache = new Map<string, Map<string, CachedDocument>>();
let documentStoreInitialized = false;
let documentStoreInitialization: Promise<void> | null = null;
let documentWriteQueue: Promise<void> = Promise.resolve();
let documentWriteError = "";
let relationalCoreEnabled = false;
let relationalArchivesEnabled = false;
let relationalCommunicationsEnabled = false;
let relationalSurveysEnabled = false;
let relationalGuidanceEnabled = false;
let relationalHomeworkEnabled = false;
let relationalCurriculumEnabled = false;
let relationalCalendarsEnabled = false;
let relationalExamPlanningEnabled = false;
let relationalExamArchiveEnabled = false;
let relationalAttendanceEnabled = false;
let relationalAnnouncementsEnabled = false;
let relationalScheduleEnabled = false;
let relationalQuestionBankAuxEnabled = false;

const cacheCollection = (collectionName: string) => {
  let collection = documentCache.get(collectionName);
  if (!collection) {
    collection = new Map<string, CachedDocument>();
    documentCache.set(collectionName, collection);
  }
  return collection;
};
const queueDocumentWrite = (operation: () => Promise<void>) => {
  const pending = documentWriteQueue.then(operation);
  documentWriteQueue = pending.catch((error) => {
    documentWriteError = error instanceof Error ? error.message : String(error);
    console.error("[mysql-documents] write failed:", error);
  });
  return pending;
};

export const waitForDocumentStoreWrites = async () => {
  await documentWriteQueue;
  if (documentWriteError) {
    const message = documentWriteError;
    documentWriteError = "";
    throw new Error(`MySQL belge yazma hatası: ${message}`);
  }
};
export const getDocumentStoreStatus = () => ({
  initialized: documentStoreInitialized,
  engine: "mysql",
  collections: documentCache.size,
  documents: [...documentCache.values()].reduce((total, collection) => total + collection.size, 0),
  pendingWriteError: documentWriteError || null,
  questionBankEngine: "mysql",
  relationalCore: relationalCoreEnabled,
  relationalArchives: relationalArchivesEnabled,
  relationalCommunications: relationalCommunicationsEnabled,
  relationalSurveys: relationalSurveysEnabled,
  relationalGuidance: relationalGuidanceEnabled,
  relationalHomework: relationalHomeworkEnabled,
  relationalCurriculum: relationalCurriculumEnabled,
  relationalCalendars: relationalCalendarsEnabled,
  relationalExamPlanning: relationalExamPlanningEnabled,
  relationalExamArchive: relationalExamArchiveEnabled,
  relationalAttendance: relationalAttendanceEnabled,
  relationalAnnouncements: relationalAnnouncementsEnabled,
  relationalSchedule: relationalScheduleEnabled,
  relationalQuestionBankAux: relationalQuestionBankAuxEnabled,
});

export const initializeDocumentStore = async () => {
  if (documentStoreInitialization) return documentStoreInitialization;
  documentStoreInitialization = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS edupanel_migrations (
      migration_key VARCHAR(191) NOT NULL PRIMARY KEY,
      applied_at VARCHAR(40) NOT NULL,
      details JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const requiredMigrations = ["sqlite-documents-import-v1", "sqlite-question-bank-import-v1"];
    const migration = await pool.query(
      "SELECT migration_key FROM edupanel_migrations WHERE migration_key IN (?, ?)",
      requiredMigrations,
    );
    const applied = new Set(migration.rows.map((row: any) => String(row.migration_key)));
    const missing = requiredMigrations.filter((key) => !applied.has(key));
    if (missing.length > 0) throw new Error(`MySQL geçişleri tamamlanmamış: ${missing.join(", ")}`);

    documentCache.clear();
    await ensureRelationalCoreSchema();
    relationalCoreEnabled = await isRelationalCoreReady();
    if (relationalCoreEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const relationalRows = await loadRelationalCoreDocuments();
      for (const row of relationalRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational] Loaded ${relationalRows.length} relational records.`);
    }
    await ensureRelationalArchivesSchema();
    relationalArchivesEnabled = await isRelationalArchivesReady();
    if (relationalArchivesEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalArchiveCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const archiveRows = await loadRelationalArchiveDocuments();
      for (const row of archiveRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-archives] Loaded ${archiveRows.length} relational archive records.`);
    }
    await ensureRelationalCommunicationsSchema();
    relationalCommunicationsEnabled = await isRelationalCommunicationsReady();
    if (relationalCommunicationsEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalCommunicationCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const communicationRows = await loadRelationalCommunicationDocuments();
      for (const row of communicationRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-communications] Loaded ${communicationRows.length} relational communication records.`);
    }
    await ensureRelationalSurveysSchema();
    relationalSurveysEnabled = await isRelationalSurveysReady();
    if (relationalSurveysEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalSurveyCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const surveyRows = await loadRelationalSurveyDocuments();
      for (const row of surveyRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-surveys] Loaded ${surveyRows.length} relational survey records.`);
    }
    await ensureRelationalGuidanceSchema();
    relationalGuidanceEnabled = await isRelationalGuidanceReady();
    if (relationalGuidanceEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalGuidanceCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const guidanceRows = await loadRelationalGuidanceDocuments();
      for (const row of guidanceRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-guidance] Loaded ${guidanceRows.length} relational guidance records.`);
    }
    await ensureRelationalHomeworkSchema();
    relationalHomeworkEnabled = await isRelationalHomeworkReady();
    if (relationalHomeworkEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalHomeworkCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const homeworkRows = await loadRelationalHomeworkDocuments();
      for (const row of homeworkRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-homework] Loaded ${homeworkRows.length} relational homework records.`);
    }
    await ensureRelationalCurriculumSchema();
    relationalCurriculumEnabled = await isRelationalCurriculumReady();
    if (relationalCurriculumEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalCurriculumCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const curriculumRows = await loadRelationalCurriculumDocuments();
      for (const row of curriculumRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-curriculum] Loaded ${curriculumRows.length} relational curriculum records.`);
    }
    await ensureRelationalCalendarsSchema();
    relationalCalendarsEnabled = await isRelationalCalendarsReady();
    if (relationalCalendarsEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalCalendarCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const calendarRows = await loadRelationalCalendarDocuments();
      for (const row of calendarRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-calendars] Loaded ${calendarRows.length} relational calendar records.`);
    }
    await ensureRelationalExamPlanningSchema();
    relationalExamPlanningEnabled = await isRelationalExamPlanningReady();
    if (relationalExamPlanningEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalExamPlanningCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const planningRows = await loadRelationalExamPlanningDocuments();
      for (const row of planningRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-exam-planning] Loaded ${planningRows.length} relational exam planning records.`);
    }
    await ensureRelationalExamArchiveSchema();
    relationalExamArchiveEnabled = true;
    const examArchiveRows = await loadRelationalExamArchiveDocuments();
    for (const row of examArchiveRows) {
      cacheCollection(row.collectionName).set(row.documentId, {
        documentId: row.documentId,
        data: row.data,
        updatedAt: row.updatedAt,
      });
    }
    console.log(`[mysql-relational-exam-archive] Loaded ${examArchiveRows.length} records.`);
    await ensureRelationalAttendanceSchema();
    relationalAttendanceEnabled = await isRelationalAttendanceReady();
    if (relationalAttendanceEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalAttendanceCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const attendanceRows = await loadRelationalAttendanceDocuments();
      for (const row of attendanceRows) {
        cacheCollection(row.collectionName).set(row.documentId, { documentId: row.documentId, data: row.data, updatedAt: row.updatedAt });
      }
      console.log(`[mysql-relational-attendance] Loaded ${attendanceRows.length} relational attendance records.`);
    }
    await ensureRelationalAnnouncementsSchema();
    relationalAnnouncementsEnabled = await isRelationalAnnouncementsReady();
    if (relationalAnnouncementsEnabled) {
      documentCache.delete("announcements");
      const announcementRows = await loadRelationalAnnouncementDocuments();
      for (const row of announcementRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-announcements] Loaded ${announcementRows.length} relational announcement records.`);
    }
    await ensureRelationalScheduleSchema();
    relationalScheduleEnabled = await isRelationalScheduleReady();
    if (relationalScheduleEnabled) {
      for (const [collectionName, collection] of documentCache.entries()) {
        if (relationalScheduleDocumentInfo(collectionName)) collection.delete("scheduleData");
      }
      const scheduleRows = await loadRelationalScheduleDocuments();
      for (const row of scheduleRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-schedule] Loaded ${scheduleRows.length} relational schedule records.`);
    }
    await ensureRelationalQuestionBankAuxSchema();
    relationalQuestionBankAuxEnabled = await isRelationalQuestionBankAuxReady();
    if (relationalQuestionBankAuxEnabled) {
      for (const collectionName of [...documentCache.keys()]) {
        if (relationalQuestionBankAuxCollectionInfo(collectionName)) documentCache.delete(collectionName);
      }
      const questionBankAuxRows = await loadRelationalQuestionBankAuxDocuments();
      for (const row of questionBankAuxRows) {
        cacheCollection(row.collectionName).set(row.documentId, {
          documentId: row.documentId,
          data: row.data,
          updatedAt: row.updatedAt,
        });
      }
      console.log(`[mysql-relational-question-bank-aux] Loaded ${questionBankAuxRows.length} relational records.`);
    }
    documentStoreInitialized = true;
    console.log("[mysql-relational] Generic documents compatibility table is disabled.");
  })();
  return documentStoreInitialization;
};

const validName = (value: string) => /^[A-Za-z0-9_-]{1,80}$/.test(value);
const requireInitialized = () => {
  if (!documentStoreInitialized) throw new Error("MySQL belge deposu henüz hazır değil.");
};
const hasRelationalCollectionRepository = (collectionName: string) => Boolean(
  (relationalCoreEnabled && relationalCollectionInfo(collectionName))
  || (relationalArchivesEnabled && relationalArchiveCollectionInfo(collectionName))
  || (relationalCommunicationsEnabled && relationalCommunicationCollectionInfo(collectionName))
  || (relationalSurveysEnabled && relationalSurveyCollectionInfo(collectionName))
  || (relationalGuidanceEnabled && relationalGuidanceCollectionInfo(collectionName))
  || (relationalHomeworkEnabled && relationalHomeworkCollectionInfo(collectionName))
  || (relationalCurriculumEnabled && relationalCurriculumCollectionInfo(collectionName))
  || (relationalCalendarsEnabled && relationalCalendarCollectionInfo(collectionName))
  || (relationalExamPlanningEnabled && relationalExamPlanningCollectionInfo(collectionName))
  || (relationalExamArchiveEnabled && relationalExamArchiveCollectionInfo(collectionName))
  || (relationalAttendanceEnabled && relationalAttendanceCollectionInfo(collectionName))
  || (relationalAnnouncementsEnabled && relationalAnnouncementCollectionInfo(collectionName))
  || (relationalQuestionBankAuxEnabled && relationalQuestionBankAuxCollectionInfo(collectionName))
);
const hasRelationalDocumentRepository = (collectionName: string, documentId: string) =>
  hasRelationalCollectionRepository(collectionName)
  || (relationalScheduleEnabled && relationalScheduleDocumentInfo(collectionName, documentId));

export function listDocuments(collectionName: string) {
  if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
  requireInitialized();
  return [...(documentCache.get(collectionName)?.values() || [])]
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).map((row) => row.data);
}
export function getDocument(collectionName: string, documentId: string) {
  if (!validName(collectionName) || !validName(documentId.replace(/[:.]/g, "-"))) throw new Error("Geçersiz kayıt adresi");
  requireInitialized();
  return documentCache.get(collectionName)?.get(documentId)?.data ?? null;
}
export function listDocumentLocations(documentId: string) {
  requireInitialized();
  const rows: Array<{ collectionName: string; data: any; updatedAt: string }> = [];
  for (const [collectionName, collection] of documentCache.entries()) {
    const row = collection.get(documentId);
    if (row) rows.push({ collectionName, data: row.data, updatedAt: row.updatedAt });
  }
  return rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
export function countDocuments(collectionName: string) {
  if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
  requireInitialized();
  return documentCache.get(collectionName)?.size || 0;
}
export function searchDocuments(collectionName: string, fieldName: string, query: string, limit = 50) {
  if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
  requireInitialized();
  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");
  return [...(documentCache.get(collectionName)?.values() || [])]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .filter((row) => String(row.data?.[fieldName] ?? "").toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    .slice(0, safeLimit).map((row) => ({ ...row.data, __documentId: row.documentId }));
}
export function searchDocumentsAny(collectionName: string, fieldNames: string[], query: string, limit = 50) {
  if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
  if (fieldNames.length === 0) return [];
  requireInitialized();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
  const normalizedQuery = normalize(query);
  return [...(documentCache.get(collectionName)?.values() || [])]
    .filter((row) => fieldNames.some((fieldName) => normalize(row.data?.[fieldName]).includes(normalizedQuery)))
    .sort((left, right) => String(left.data?.name || left.documentId).localeCompare(String(right.data?.name || right.documentId), "tr-TR"))
    .slice(0, safeLimit).map((row) => ({ ...row.data, __documentId: row.documentId }));
}

export function replaceCollection(collectionName: string, documents: any[]) {
  if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
  requireInitialized();
  if (!hasRelationalCollectionRepository(collectionName)) {
    throw new Error(`İlişkisel repository tanımlanmamış koleksiyon: ${collectionName}`);
  }
  const now = new Date().toISOString();
  const nextCollection = new Map<string, CachedDocument>();
  documents.forEach((document, index) => {
    const documentId = String(document?.id ?? `${collectionName}-${index}`);
    nextCollection.set(documentId, { documentId, data: document, updatedAt: now });
  });
  const aliases = relationalCoreEnabled && relationalCollectionInfo(collectionName)
    ? relationalCollectionAliases(collectionName)
    : [collectionName];
  for (const alias of aliases) documentCache.set(alias, new Map(nextCollection));
  return queueDocumentWrite(async () => {
    if (relationalCoreEnabled && relationalCollectionInfo(collectionName)) {
      await replaceRelationalCollection(collectionName, documents);
      return;
    }
    if (relationalArchivesEnabled && relationalArchiveCollectionInfo(collectionName)) {
      await replaceRelationalArchiveCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalCommunicationsEnabled && relationalCommunicationCollectionInfo(collectionName)) {
      await replaceRelationalCommunicationCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalSurveysEnabled && relationalSurveyCollectionInfo(collectionName)) {
      await replaceRelationalSurveyCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalGuidanceEnabled && relationalGuidanceCollectionInfo(collectionName)) {
      await replaceRelationalGuidanceCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalHomeworkEnabled && relationalHomeworkCollectionInfo(collectionName)) {
      await replaceRelationalHomeworkCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalCurriculumEnabled && relationalCurriculumCollectionInfo(collectionName)) {
      await replaceRelationalCurriculumCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalCalendarsEnabled && relationalCalendarCollectionInfo(collectionName)) {
      await replaceRelationalCalendarCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalExamPlanningEnabled && relationalExamPlanningCollectionInfo(collectionName)) {
      await replaceRelationalExamPlanningCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalExamArchiveEnabled && relationalExamArchiveCollectionInfo(collectionName)) {
      await replaceRelationalExamArchiveCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalAttendanceEnabled && relationalAttendanceCollectionInfo(collectionName)) {
      await replaceRelationalAttendanceCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalAnnouncementsEnabled && relationalAnnouncementCollectionInfo(collectionName)) {
      await replaceRelationalAnnouncementCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    if (relationalQuestionBankAuxEnabled && relationalQuestionBankAuxCollectionInfo(collectionName)) {
      await replaceRelationalQuestionBankAuxCollection(collectionName, [...nextCollection.values()]);
      return;
    }
    throw new Error(`İlişkisel repository tanımlanmamış koleksiyon: ${collectionName}`);
  });
}

export function replaceCollections(collections: Record<string, any[]>) {
  const entries = Object.entries(collections);
  entries.forEach(([collectionName, documents]) => {
    if (!validName(collectionName)) throw new Error("Geçersiz koleksiyon adı");
    if (!Array.isArray(documents)) throw new Error(`${collectionName} için kayıt listesi bekleniyor`);
  });
  requireInitialized();
  const unsupported = entries.map(([collectionName]) => collectionName)
    .filter((collectionName) => !hasRelationalCollectionRepository(collectionName));
  if (unsupported.length) throw new Error(`İlişkisel repository tanımlanmamış koleksiyonlar: ${unsupported.join(", ")}`);
  const now = new Date().toISOString();
  const cachedEntries = entries.map(([collectionName, documents]) => {
    const collection = new Map<string, CachedDocument>();
    documents.forEach((document, index) => {
      const documentId = String(document?.id ?? `${collectionName}-${index}`);
      collection.set(documentId, { documentId, data: document, updatedAt: now });
    });
    const aliases = relationalCoreEnabled && relationalCollectionInfo(collectionName)
      ? relationalCollectionAliases(collectionName)
      : [collectionName];
    for (const alias of aliases) documentCache.set(alias, new Map(collection));
    return [collectionName, collection] as const;
  });
  return queueDocumentWrite(async () => {
    for (const [collectionName, collection] of cachedEntries) {
      if (relationalCoreEnabled && relationalCollectionInfo(collectionName)) {
        await replaceRelationalCollection(collectionName, [...collection.values()].map((row) => row.data));
      } else if (relationalArchivesEnabled && relationalArchiveCollectionInfo(collectionName)) {
        await replaceRelationalArchiveCollection(collectionName, [...collection.values()]);
      } else if (relationalCommunicationsEnabled && relationalCommunicationCollectionInfo(collectionName)) {
        await replaceRelationalCommunicationCollection(collectionName, [...collection.values()]);
      } else if (relationalSurveysEnabled && relationalSurveyCollectionInfo(collectionName)) {
        await replaceRelationalSurveyCollection(collectionName, [...collection.values()]);
      } else if (relationalGuidanceEnabled && relationalGuidanceCollectionInfo(collectionName)) {
        await replaceRelationalGuidanceCollection(collectionName, [...collection.values()]);
      } else if (relationalHomeworkEnabled && relationalHomeworkCollectionInfo(collectionName)) {
        await replaceRelationalHomeworkCollection(collectionName, [...collection.values()]);
      } else if (relationalCurriculumEnabled && relationalCurriculumCollectionInfo(collectionName)) {
        await replaceRelationalCurriculumCollection(collectionName, [...collection.values()]);
      } else if (relationalCalendarsEnabled && relationalCalendarCollectionInfo(collectionName)) {
        await replaceRelationalCalendarCollection(collectionName, [...collection.values()]);
      } else if (relationalExamPlanningEnabled && relationalExamPlanningCollectionInfo(collectionName)) {
        await replaceRelationalExamPlanningCollection(collectionName, [...collection.values()]);
      } else if (relationalExamArchiveEnabled && relationalExamArchiveCollectionInfo(collectionName)) {
        await replaceRelationalExamArchiveCollection(collectionName, [...collection.values()]);
      } else if (relationalAttendanceEnabled && relationalAttendanceCollectionInfo(collectionName)) {
        await replaceRelationalAttendanceCollection(collectionName, [...collection.values()]);
      } else if (relationalAnnouncementsEnabled && relationalAnnouncementCollectionInfo(collectionName)) {
        await replaceRelationalAnnouncementCollection(collectionName, [...collection.values()]);
      } else if (relationalQuestionBankAuxEnabled && relationalQuestionBankAuxCollectionInfo(collectionName)) {
        await replaceRelationalQuestionBankAuxCollection(collectionName, [...collection.values()]);
      }
    }
  });
}

export function upsertDocument(collectionName: string, documentId: string, data: any) {
  if (!validName(collectionName) || !validName(documentId.replace(/[:.]/g, "-"))) throw new Error("Geçersiz kayıt adresi");
  requireInitialized();
  if (!hasRelationalDocumentRepository(collectionName, documentId)) {
    throw new Error(`İlişkisel repository tanımlanmamış kayıt: ${collectionName}/${documentId}`);
  }
  const updatedAt = new Date().toISOString();
  const aliases = relationalCoreEnabled && relationalCollectionInfo(collectionName)
    ? relationalCollectionAliases(collectionName)
    : [collectionName];
  for (const alias of aliases) cacheCollection(alias).set(documentId, { documentId, data, updatedAt });
  return queueDocumentWrite(async () => {
    if (relationalCoreEnabled && relationalCollectionInfo(collectionName)) {
      await upsertRelationalDocument(collectionName, data);
      return;
    }
    if (relationalArchivesEnabled && relationalArchiveCollectionInfo(collectionName)) {
      await upsertRelationalArchiveDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalCommunicationsEnabled && relationalCommunicationCollectionInfo(collectionName)) {
      await upsertRelationalCommunicationDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalSurveysEnabled && relationalSurveyCollectionInfo(collectionName)) {
      await upsertRelationalSurveyDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalGuidanceEnabled && relationalGuidanceCollectionInfo(collectionName)) {
      await upsertRelationalGuidanceDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalHomeworkEnabled && relationalHomeworkCollectionInfo(collectionName)) {
      await upsertRelationalHomeworkDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalCurriculumEnabled && relationalCurriculumCollectionInfo(collectionName)) {
      await upsertRelationalCurriculumDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalCalendarsEnabled && relationalCalendarCollectionInfo(collectionName)) {
      await upsertRelationalCalendarDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalExamPlanningEnabled && relationalExamPlanningCollectionInfo(collectionName)) {
      await upsertRelationalExamPlanningDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalExamArchiveEnabled && relationalExamArchiveCollectionInfo(collectionName)) {
      await upsertRelationalExamArchiveDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalAttendanceEnabled && relationalAttendanceCollectionInfo(collectionName)) {
      await upsertRelationalAttendanceDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalAnnouncementsEnabled && relationalAnnouncementCollectionInfo(collectionName)) {
      await upsertRelationalAnnouncementDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalQuestionBankAuxEnabled && relationalQuestionBankAuxCollectionInfo(collectionName)) {
      await upsertRelationalQuestionBankAuxDocument(collectionName, documentId, data, updatedAt);
      return;
    }
    if (relationalScheduleEnabled && relationalScheduleDocumentInfo(collectionName, documentId)) {
      await replaceRelationalScheduleDocument(collectionName, data, updatedAt);
      return;
    }
    throw new Error(`İlişkisel repository tanımlanmamış kayıt: ${collectionName}/${documentId}`);
  });
}
export function deleteDocument(collectionName: string, documentId: string) {
  if (!validName(collectionName) || !validName(documentId.replace(/[:.]/g, "-"))) throw new Error("Geçersiz kayıt adresi");
  requireInitialized();
  if (!hasRelationalDocumentRepository(collectionName, documentId)) {
    throw new Error(`İlişkisel repository tanımlanmamış kayıt: ${collectionName}/${documentId}`);
  }
  const aliases = relationalCoreEnabled && relationalCollectionInfo(collectionName)
    ? relationalCollectionAliases(collectionName)
    : [collectionName];
  for (const alias of aliases) documentCache.get(alias)?.delete(documentId);
  return queueDocumentWrite(async () => {
    if (relationalCoreEnabled && relationalCollectionInfo(collectionName)) {
      await deleteRelationalDocument(collectionName, documentId);
      return;
    }
    if (relationalArchivesEnabled && relationalArchiveCollectionInfo(collectionName)) {
      await deleteRelationalArchiveDocument(collectionName, documentId);
      return;
    }
    if (relationalCommunicationsEnabled && relationalCommunicationCollectionInfo(collectionName)) {
      await deleteRelationalCommunicationDocument(collectionName, documentId);
      return;
    }
    if (relationalSurveysEnabled && relationalSurveyCollectionInfo(collectionName)) {
      await deleteRelationalSurveyDocument(collectionName, documentId);
      return;
    }
    if (relationalGuidanceEnabled && relationalGuidanceCollectionInfo(collectionName)) {
      await deleteRelationalGuidanceDocument(collectionName, documentId);
      return;
    }
    if (relationalHomeworkEnabled && relationalHomeworkCollectionInfo(collectionName)) {
      await deleteRelationalHomeworkDocument(collectionName, documentId);
      return;
    }
    if (relationalCurriculumEnabled && relationalCurriculumCollectionInfo(collectionName)) {
      await deleteRelationalCurriculumDocument(collectionName, documentId);
      return;
    }
    if (relationalCalendarsEnabled && relationalCalendarCollectionInfo(collectionName)) {
      await deleteRelationalCalendarDocument(collectionName, documentId);
      return;
    }
    if (relationalExamPlanningEnabled && relationalExamPlanningCollectionInfo(collectionName)) {
      await deleteRelationalExamPlanningDocument(collectionName, documentId);
      return;
    }
    if (relationalExamArchiveEnabled && relationalExamArchiveCollectionInfo(collectionName)) {
      await deleteRelationalExamArchiveDocument(collectionName, documentId);
      return;
    }
    if (relationalAttendanceEnabled && relationalAttendanceCollectionInfo(collectionName)) {
      await deleteRelationalAttendanceDocument(collectionName, documentId);
      return;
    }
    if (relationalAnnouncementsEnabled && relationalAnnouncementCollectionInfo(collectionName)) {
      await deleteRelationalAnnouncementDocument(collectionName, documentId);
      return;
    }
    if (relationalQuestionBankAuxEnabled && relationalQuestionBankAuxCollectionInfo(collectionName)) {
      await deleteRelationalQuestionBankAuxDocument(collectionName, documentId);
      return;
    }
    if (relationalScheduleEnabled && relationalScheduleDocumentInfo(collectionName, documentId)) {
      await deleteRelationalScheduleDocument(collectionName);
      return;
    }
    throw new Error(`İlişkisel repository tanımlanmamış kayıt: ${collectionName}/${documentId}`);
  });
}

export function createBackup() {
  requireInitialized();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `edupanel-mysql-${stamp}.json.gz`;
  const documents = [...documentCache.entries()].flatMap(([collectionName, collection]) =>
    [...collection.values()].map((row) => ({ collectionName, documentId: row.documentId, data: row.data, updatedAt: row.updatedAt })),
  );
  const questionTables = [
    "question_bank_questions",
    "question_bank_index",
    "question_bank_schema_migrations",
    "question_bank_migration_state",
    "question_bank_performance_history",
    "question_bank_health_score_history",
    "question_bank_safe_action_audit",
    "question_bank_integrity_snapshot",
    "question_bank_write_journal",
    "question_bank_startup_audit",
  ];
  const questionBank = Object.fromEntries(
    questionTables.map((tableName) => [tableName, sqlite.prepare(`SELECT * FROM ${tableName}`).all()]),
  );
  const backupPath = path.join(backupDirectory, filename);
  fs.writeFileSync(backupPath, gzipSync(JSON.stringify({
    format: "edupanel-mysql-backup",
    version: 1,
    engine: "mysql",
    createdAt: new Date().toISOString(),
    documents,
    questionBank,
  })));
  return { filename, path: backupPath };
}
