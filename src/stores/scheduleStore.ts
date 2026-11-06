import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScheduleAlgorithm, ScheduleData, ScheduleScope, ScheduleViewType, SolverResult, UnplacedInfo } from "../types/schedule";

import { sqliteStorage } from "../lib/sqliteStorageBridge";
const HISTORY_LIMIT = 40;
const cloneSchedule = (value: ScheduleData): ScheduleData => JSON.parse(JSON.stringify(value || {}));

interface ScheduleState {
  scheduleData: ScheduleData;
  past: ScheduleData[];
  future: ScheduleData[];
  lockedCellKeys: string[];
  viewType: ScheduleViewType;
  selectedId: string;
  selectedAlgorithm: ScheduleAlgorithm;
  selectedScope: ScheduleScope;
  solverRunning: boolean;
  solverPaused: boolean;
  solverProgress: number;
  solverResult: SolverResult | null;
  unplacedInfo: UnplacedInfo;
  solverStats: {
    totalBlocks: number;
    placedBlocks: number;
    remainingBlocks: number;
    stage: string;
  };
  setScheduleData: (value: ScheduleData | ((prev: ScheduleData) => ScheduleData), options?: { skipHistory?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  toggleCellLock: (cellKey: string) => void;
  isCellLocked: (cellKey: string) => boolean;
  setViewType: (value: ScheduleViewType) => void;
  setSelectedId: (value: string) => void;
  setSelectedAlgorithm: (value: ScheduleAlgorithm) => void;
  setSelectedScope: (value: ScheduleScope) => void;
  setSolverRunning: (value: boolean) => void;
  setSolverPaused: (value: boolean) => void;
  setSolverProgress: (value: number) => void;
  setSolverResult: (value: SolverResult | null) => void;
  setUnplacedInfo: (value: UnplacedInfo) => void;
  setSolverStats: (value: Partial<ScheduleState["solverStats"]>) => void;
  resetSolver: () => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      scheduleData: {}, past: [], future: [], lockedCellKeys: [], viewType: "class", selectedId: "", selectedAlgorithm: "smart-full",
      selectedScope: "global", solverRunning: false, solverPaused: false, solverProgress: 0,
      solverResult: null,
      unplacedInfo: { count: 0, details: [] },
      solverStats: { totalBlocks: 0, placedBlocks: 0, remainingBlocks: 0, stage: "Beklemede" },
      setScheduleData: (value, options) => set((state) => {
        const next = typeof value === "function" ? value(state.scheduleData) : value;
        if (next === state.scheduleData) return state;
        if (options?.skipHistory) return { ...state, scheduleData: next };
        return {
          ...state,
          scheduleData: next,
          past: [...state.past, cloneSchedule(state.scheduleData)].slice(-HISTORY_LIMIT),
          future: [],
        };
      }),
      undo: () => set((state) => {
        if (!state.past.length) return state;
        const previous = state.past[state.past.length - 1];
        return { ...state, scheduleData: cloneSchedule(previous), past: state.past.slice(0, -1), future: [cloneSchedule(state.scheduleData), ...state.future].slice(0, HISTORY_LIMIT) };
      }),
      redo: () => set((state) => {
        if (!state.future.length) return state;
        const next = state.future[0];
        return { ...state, scheduleData: cloneSchedule(next), past: [...state.past, cloneSchedule(state.scheduleData)].slice(-HISTORY_LIMIT), future: state.future.slice(1) };
      }),
      clearHistory: () => set({ past: [], future: [] }),
      toggleCellLock: (cellKey) => set((state) => ({ lockedCellKeys: state.lockedCellKeys.includes(cellKey) ? state.lockedCellKeys.filter((key) => key !== cellKey) : [...state.lockedCellKeys, cellKey] })),
      isCellLocked: (cellKey) => get().lockedCellKeys.includes(cellKey),
      setViewType: (viewType) => set({ viewType, selectedId: "" }),
      setSelectedId: (selectedId) => set({ selectedId }),
      setSelectedAlgorithm: (selectedAlgorithm) => set({ selectedAlgorithm }),
      setSelectedScope: (selectedScope) => set({ selectedScope }),
      setSolverRunning: (solverRunning) => set({ solverRunning }),
      setSolverPaused: (solverPaused) => set({ solverPaused }),
      setSolverProgress: (solverProgress) => set({ solverProgress }),
      setSolverResult: (solverResult) => set({ solverResult }),
      setUnplacedInfo: (unplacedInfo) => set({ unplacedInfo }),
      setSolverStats: (value) => set((state) => ({
        solverStats: { ...state.solverStats, ...value },
      })),
      resetSolver: () => set({
        solverRunning: false,
        solverPaused: false,
        solverProgress: 0,
        solverResult: null,
        unplacedInfo: { count: 0, details: [] },
        solverStats: { totalBlocks: 0, placedBlocks: 0, remainingBlocks: 0, stage: "Beklemede" },
      }),
    }),
    {
      name: "rota-schedule-store",
      storage: createJSONStorage(() => sqliteStorage),
      version: 3,
      migrate: (persistedState: any) => ({
        // Eski büyük kayıt ilk açılışta belleğe alınır; useSchedulePersistence
        // bunu IndexedDB'ye aktarır. Yeni sqliteStorage kaydına tekrar yazılmaz.
        scheduleData: persistedState?.scheduleData || {},
        lockedCellKeys: Array.isArray(persistedState?.lockedCellKeys) ? persistedState.lockedCellKeys : [],
        viewType: persistedState?.viewType || "class",
        selectedId: persistedState?.selectedId || "",
        selectedAlgorithm: (["smart-full", "korayucardraft", "korayucarv3", "korayucar", "ortools", "hybrid", "backtracking"] as const).includes(persistedState?.selectedAlgorithm)
          ? persistedState.selectedAlgorithm
          : "smart-full",
        selectedScope: persistedState?.selectedScope || "global",
      }),
      // Büyük ders programı ve geri alma geçmişi IndexedDB/bellekte tutulur.
      // sqliteStorage yalnızca birkaç baytlık arayüz tercihlerini saklar.
      partialize: (state) => ({
        lockedCellKeys: state.lockedCellKeys,
        viewType: state.viewType,
        selectedId: state.selectedId,
        selectedAlgorithm: state.selectedAlgorithm,
        selectedScope: state.selectedScope,
      }),
    },
  ),
);
