import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScheduleConstraintSettings } from "../types/scheduleConstraints";
import { DEFAULT_CONSTRAINT_SETTINGS, CONSTRAINT_SETTINGS_STORAGE_KEY } from "../services/schedule/constraintDefaults";

import { sqliteStorage } from "../lib/sqliteStorageBridge";
interface ConstraintState {
  settings: ScheduleConstraintSettings;
  settingsOpen: boolean;
  setSettings: (value: Partial<ScheduleConstraintSettings>) => void;
  resetSettings: () => void;
  setSettingsOpen: (value: boolean) => void;
}

export const useScheduleConstraintStore = create<ConstraintState>()(
  persist(
    (set) => ({
      settings: DEFAULT_CONSTRAINT_SETTINGS,
      settingsOpen: false,
      setSettings: (value) => set((state) => ({ settings: { ...state.settings, ...value } })),
      resetSettings: () => set({ settings: DEFAULT_CONSTRAINT_SETTINGS }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: CONSTRAINT_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ConstraintState> | undefined;
        const savedSettings: Partial<ScheduleConstraintSettings> = saved?.settings || {};
        const legacyFreeDayDefault = savedSettings.requireTeacherFreeDay === false
          && Number(savedSettings.teacherWorkingDayPenalty) === 0;
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_CONSTRAINT_SETTINGS,
            ...savedSettings,
            // Eski kayıtların kullanıcı tercihini koru; yeni kayıtlar varsayılan
            // olarak 24 saatin altındaki öğretmenler için boş gün tercih eder.
            requireTeacherFreeDay: legacyFreeDayDefault
              ? DEFAULT_CONSTRAINT_SETTINGS.requireTeacherFreeDay
              : (savedSettings.requireTeacherFreeDay ?? DEFAULT_CONSTRAINT_SETTINGS.requireTeacherFreeDay),
            teacherWorkingDayPenalty: legacyFreeDayDefault
              ? DEFAULT_CONSTRAINT_SETTINGS.teacherWorkingDayPenalty
              : (savedSettings.teacherWorkingDayPenalty ?? DEFAULT_CONSTRAINT_SETTINGS.teacherWorkingDayPenalty),
            // Eski varsayılanları kullanan kayıtları, öğretmen bloklarını daha
            // yakın tutan yeni ağırlığa geçir; kullanıcının özel değerlerine dokunma.
            teacherGapPenalty: savedSettings.teacherGapPenalty === 15 || savedSettings.teacherGapPenalty === 30
              ? DEFAULT_CONSTRAINT_SETTINGS.teacherGapPenalty
              : (savedSettings.teacherGapPenalty ?? DEFAULT_CONSTRAINT_SETTINGS.teacherGapPenalty),
            classGapPenalty: savedSettings.classGapPenalty === 8
              ? DEFAULT_CONSTRAINT_SETTINGS.classGapPenalty
              : (savedSettings.classGapPenalty ?? DEFAULT_CONSTRAINT_SETTINGS.classGapPenalty),
          },
        };
      },
    },
  ),
);
