import type { ScheduleData } from "../../types/schedule";
import { getAppState, setAppState } from "../../lib/unifiedLocalDatabase";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
let preloadPromise: Promise<ScheduleData> | null = null;
let memoryCache: ScheduleData | null = null;

function normalizeScheduleData(value: string | ScheduleData | null): ScheduleData {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ScheduleData;
    } catch {
      return {};
    }
  }
  return value;
}

/** Ders programının tek kalıcı kaynağı yerel SQLite app_state koleksiyonudur. */
export function preloadScheduleData(): Promise<ScheduleData> {
  if (memoryCache) return Promise.resolve(memoryCache);
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      const saved = await getAppState<ScheduleData>("scheduleData");
      const parsed = normalizeScheduleData(saved);
      if (Object.keys(parsed).length > 0) {
        memoryCache = parsed;
        return parsed;
      }

      // Sadece bir defalık geriye dönük kurtarma. Sonraki yazmalar SQLite'a gider.
      let legacy: ScheduleData = {};
      try {
        const { default: localforage } = await import("localforage");
        legacy = normalizeScheduleData(await localforage.getItem<string | ScheduleData>("scheduleData"));
      } catch { /* legacy store olmayabilir */ }
      if (Object.keys(legacy).length === 0) {
        try { legacy = normalizeScheduleData(sqliteStorage.getItem("scheduleData")); } catch { /* noop */ }
      }
      if (Object.keys(legacy).length > 0) {
        await setAppState("scheduleData", legacy);
      }
      memoryCache = legacy;
      return legacy;
    } catch (error) {
      console.warn("Ders programı SQLite ön yükleme başarısız:", error);
      return {};
    }
  })();

  return preloadPromise;
}

export async function persistScheduleData(data: ScheduleData): Promise<void> {
  memoryCache = data;
  await setAppState("scheduleData", data);

  // Yeni SQLite kaydı başarıyla yazıldıktan sonra eski çift kayıtları temizle.
  try {
    const { default: localforage } = await import("localforage");
    await localforage.removeItem("scheduleData");
  } catch { /* eski store olmayabilir */ }
  try { sqliteStorage.removeItem("scheduleData"); } catch { /* noop */ }
}

export function updateScheduleMemoryCache(data: ScheduleData) {
  memoryCache = data;
}
