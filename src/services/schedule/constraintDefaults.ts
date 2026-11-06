import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export const CONSTRAINT_SETTINGS_STORAGE_KEY = "rota_schedule_constraint_settings_v1";

export const DEFAULT_CONSTRAINT_SETTINGS: ScheduleConstraintSettings = {
  seed: 20260714,
  workDays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],
  dailyLessonCount: 8,
  allowTeacherAutoInference: false,
  maxDailyCourseHours: 2,
  electiveEnglishMaxDailyHours: 4,
  maxTeacherDailyHours: 8,
  maxTeacherConsecutiveHours: 6,
  // Haftalık yükü 24 saatin altındaki öğretmenlere, yerleşebilirlik bozulmadan
  // bir gün boş bırakılması tercih edilir.
  requireTeacherFreeDay: true,
  preserveManualAssignments: true,
  teacherConflictHard: true,
  classConflictHard: true,
  groupConflictHard: true,
  blockedSlotsHard: true,
  weeklyHoursHard: true,
  unwantedTeacherDayHard: false,
  unwantedTeacherDayPenalty: 50,
  // Öğretmenin aynı gündeki ders bloklarını mümkün olduğunca bir arada tut.
  // Bu soft tercihtir; tüm derslerin yerleşmesi her zaman önceliklidir.
  teacherGapPenalty: 50,
  teacherShortDayPenalty: 30,
  teacherWorkingDayPenalty: 45,
  classGapPenalty: 12,
  lastHourPenalty: 3,
  sameCourseSameHourPenalty: 20,
  maxBacktrackingNodes: 250000,
  backtrackingTimeLimitMs: 30000,
  domainCacheEnabled: true,
  nogoodLearningEnabled: true,
  visitedStateCacheEnabled: true,
};

export function loadConstraintSettings(): ScheduleConstraintSettings {
  try {
    const raw = sqliteStorage.getItem(CONSTRAINT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CONSTRAINT_SETTINGS;
    const parsed = JSON.parse(raw);
    const saved = parsed?.state?.settings || parsed?.settings || parsed;
    // Bu iki değer eski sürümlerde zorunlu olarak false/0'a yazılıyordu;
    // kullanıcı tercihi değildi. Yalnızca bu eski ikiliyi yeni varsayılanla
    // güncelle; kullanıcı yeni ekrandan kuralı kapatırsa ceza değeri korunur.
    const legacyFreeDayDefault = saved?.requireTeacherFreeDay === false
      && Number(saved?.teacherWorkingDayPenalty) === 0;
    const legacyTeacherGapDefault = Number(saved?.teacherGapPenalty) === 15
      || Number(saved?.teacherGapPenalty) === 30;
    return {
      ...DEFAULT_CONSTRAINT_SETTINGS,
      ...saved,
      ...(legacyFreeDayDefault
        ? {
            requireTeacherFreeDay: DEFAULT_CONSTRAINT_SETTINGS.requireTeacherFreeDay,
            teacherWorkingDayPenalty: DEFAULT_CONSTRAINT_SETTINGS.teacherWorkingDayPenalty,
          }
        : {}),
      ...(legacyTeacherGapDefault
        ? { teacherGapPenalty: DEFAULT_CONSTRAINT_SETTINGS.teacherGapPenalty }
        : {}),
    };
  } catch {
    return DEFAULT_CONSTRAINT_SETTINGS;
  }
}
