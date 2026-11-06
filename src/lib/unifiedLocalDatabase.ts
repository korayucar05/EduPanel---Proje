import {
  fetchAcademicCatalogFromLocalDatabase,
  fetchCollectionFromLocalDatabase,
  syncAcademicCatalogToLocalDatabase,
  syncCollectionToLocalDatabase,
  upsertLocalDocument,
} from "./localDatabase";

import { sqliteStorage } from "./sqliteStorageBridge";
const APP_STATE_COLLECTION = "app_state";
const MIGRATION_MARKER_KEY = "unified_local_db_migration_v1";

type StateDocument<T = unknown> = {
  id: string;
  value: T;
  updatedAt: string;
};

const normalizeStateDocument = <T>(row: any): StateDocument<T> | null => {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id ?? row.__documentId ?? "").trim();
  if (!id) return null;
  return {
    id,
    value: row.value as T,
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
  };
};

export async function getAppState<T>(key: string): Promise<T | null> {
  const rows = await fetchCollectionFromLocalDatabase(APP_STATE_COLLECTION);
  const found = rows
    .map((row) => normalizeStateDocument<T>(row))
    .find((row): row is StateDocument<T> => Boolean(row && row.id === key));
  return found ? found.value : null;
}

export async function setAppState<T>(key: string, value: T): Promise<void> {
  await upsertLocalDocument(APP_STATE_COLLECTION, key, {
    id: key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

export async function getCollectionOrEmpty<T = any>(collectionName: string): Promise<T[]> {
  try {
    const rows = await fetchCollectionFromLocalDatabase(collectionName);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return [];
  }
}

function parseLegacyValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function readLegacyLocalForage(key: string): Promise<unknown> {
  try {
    const { default: localforage } = await import("localforage");
    return await localforage.getItem(key);
  } catch {
    return null;
  }
}

function readLegacyLocalStorage(key: string): unknown {
  try {
    const raw = sqliteStorage.getItem(key);
    return raw == null ? null : parseLegacyValue(raw);
  } catch {
    return null;
  }
}

async function firstLegacyValue(key: string): Promise<unknown> {
  const indexed = await readLegacyLocalForage(key);
  if (indexed !== null && indexed !== undefined) return indexed;
  return readLegacyLocalStorage(key);
}

async function migrateArrayCollection(
  collectionName: string,
  legacyKeys: string[],
): Promise<number> {
  const existing = await getCollectionOrEmpty(collectionName);
  if (existing.length > 0) return 0;

  for (const key of legacyKeys) {
    const candidate = await firstLegacyValue(key);
    if (Array.isArray(candidate) && candidate.length > 0) {
      await syncCollectionToLocalDatabase(collectionName, candidate);
      return candidate.length;
    }
  }
  return 0;
}

/**
 * Tarayıcıda yıllar içinde oluşmuş kalıcı domain verilerini tek yerel SQLite
 * veritabanına taşır. UI tercihleri/oturum işaretleri özellikle taşınmaz.
 * Migration idempotent'tir; SQLite'ta veri varsa mevcut verinin üzerine yazmaz.
 */
export async function migrateLegacyDomainDataToUnifiedLocalDatabase(): Promise<{
  migrated: boolean;
  counts: Record<string, number>;
}> {
  const existingMarker = await getAppState<{ completed?: boolean }>(MIGRATION_MARKER_KEY).catch(() => null);
  if (existingMarker?.completed) return { migrated: false, counts: {} };

  const counts: Record<string, number> = {};
  counts.students = await migrateArrayCollection("students", ["school_students"]);
  counts.teachers = await migrateArrayCollection("teachers", ["school_teachers"]);
  counts.announcements = await migrateArrayCollection("announcements", ["school_announcements"]);

  // Akademik katalog SQLite'ta boşsa eski localforage/sqliteStorage kopyalarını
  // tek atomik katalog kaydına dönüştür.
  try {
    const catalog = await fetchAcademicCatalogFromLocalDatabase();
    const catalogIsEmpty =
      catalog.classrooms.length === 0 &&
      catalog.courses.length === 0 &&
      catalog.customCreatedCourses.length === 0;
    if (catalogIsEmpty) {
      const [legacyClassrooms, legacyCourses, legacyCustomCourses] = await Promise.all([
        firstLegacyValue("school_classrooms"),
        firstLegacyValue("school_courses"),
        firstLegacyValue("custom_created_courses"),
      ]);
      const classrooms = Array.isArray(legacyClassrooms) ? legacyClassrooms : [];
      const courses = Array.isArray(legacyCourses) ? legacyCourses : [];
      const customCreatedCourses = Array.isArray(legacyCustomCourses) ? legacyCustomCourses : [];
      if (classrooms.length || courses.length || customCreatedCourses.length) {
        await syncAcademicCatalogToLocalDatabase({ classrooms, courses, customCreatedCourses });
        counts.academicCatalog = classrooms.length + courses.length + customCreatedCourses.length;
      }
    }
  } catch (error) {
    console.warn("Akademik katalog legacy migration tamamlanamadı:", error);
  }

  // Eski localforage anahtarlarının tamamını SQLite app_state'e taşı. Bu sayede
  // uyumluluk adaptörü üzerinden mevcut modüller veri kaybetmeden tek DB kullanır.
  try {
    const { default: legacyForage } = await import("localforage");
    const keys = await legacyForage.keys();
    for (const key of keys) {
      const existing = await getAppState(key).catch(() => null);
      if (existing !== null) continue;
      const value = await legacyForage.getItem(key);
      if (value !== null && value !== undefined) {
        await setAppState(key, value);
        counts[`legacy:${key}`] = 1;
      }
    }
  } catch (error) {
    console.warn("IndexedDB/localforage toplu migration atlandı:", error);
  }

  const scheduleData = await getAppState("scheduleData").catch(() => null);
  if (!scheduleData) {
    const legacySchedule = await firstLegacyValue("scheduleData");
    if (legacySchedule && typeof legacySchedule === "object") {
      await setAppState("scheduleData", legacySchedule);
      counts.scheduleData = 1;
    }
  }

  // Eski seçmeli ders/hizmet ayarları domain verisidir. Aktif modüller tamamen
  // SQLite API'ye geçirilene kadar tarayıcı kopyası silinmez; SQLite kanonik yedektir.
  const legacyDomainStateKeys = [
    "selected_electives_pool",
    "custom_electives_pool",
    "school_timetable",
    "school_timetable_by_day",
    "school_timeline",
    "school_weekly_schedule_v2",
    "curriculum_schedule_matrix",
    "curriculum_passive_cells",
    "teacher_passive_slots_v2",
    "curriculum_teacher_off_days",
  ];

  for (const key of legacyDomainStateKeys) {
    const existing = await getAppState(key).catch(() => null);
    if (existing !== null) continue;
    const legacy = await firstLegacyValue(key);
    if (legacy !== null && legacy !== undefined) {
      await setAppState(key, legacy);
      counts[key] = 1;
    }
  }

  await setAppState(MIGRATION_MARKER_KEY, {
    completed: true,
    completedAt: new Date().toISOString(),
    counts,
  });

  return { migrated: true, counts };
}
