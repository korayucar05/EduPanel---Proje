import { create } from "zustand";
import type { CancelDistributionState, CancelDistributionType } from "../components/schedule/modals/CancelDistributionModal";

export interface ScheduleActiveBlock {
  courseName: string;
  teacherName?: string;
  teacherName2?: string;
  duration: number;
  type?: string;
  groupName?: string;
  className?: string;
  originalIndex: number;
  originalCourses?: any[];
}

export interface CancelingAssignment {
  day: string;
  hour: number;
  assignment: any;
}

interface ScheduleUiState {
  activeBlock: ScheduleActiveBlock | null;
  previewClassroom: any | null;
  cancelingAssignment: CancelingAssignment | null;
  cancelModal: CancelDistributionState;
  optimizerOpen: boolean;
  teacherSettingsOpen: boolean;
  penaltyDetailsVisible: boolean;
  setActiveBlock: (value: ScheduleActiveBlock | null) => void;
  setPreviewClassroom: (value: any | null) => void;
  setCancelingAssignment: (value: CancelingAssignment | null) => void;
  setCancelModal: (value: CancelDistributionState) => void;
  openCancelModal: (type: CancelDistributionType) => void;
  closeCancelModal: () => void;
  setOptimizerOpen: (value: boolean) => void;
  setTeacherSettingsOpen: (value: boolean) => void;
  setPenaltyDetailsVisible: (value: boolean) => void;
  togglePenaltyDetails: () => void;
  resetTransientUi: () => void;
}

const initialCancelModal: CancelDistributionState = {
  isOpen: false,
  type: "class_single",
  exceptManual: false,
};

export const useScheduleUiStore = create<ScheduleUiState>((set) => ({
  activeBlock: null,
  previewClassroom: null,
  cancelingAssignment: null,
  cancelModal: initialCancelModal,
  optimizerOpen: false,
  teacherSettingsOpen: false,
  penaltyDetailsVisible: false,
  setActiveBlock: (activeBlock) => set({ activeBlock }),
  setPreviewClassroom: (previewClassroom) => set({ previewClassroom }),
  setCancelingAssignment: (cancelingAssignment) => set({ cancelingAssignment }),
  setCancelModal: (cancelModal) => set({ cancelModal }),
  openCancelModal: (type) => set({ cancelModal: { isOpen: true, type, exceptManual: false } }),
  closeCancelModal: () => set((state) => ({ cancelModal: { ...state.cancelModal, isOpen: false } })),
  setOptimizerOpen: (optimizerOpen) => set({ optimizerOpen }),
  setTeacherSettingsOpen: (teacherSettingsOpen) => set({ teacherSettingsOpen }),
  setPenaltyDetailsVisible: (penaltyDetailsVisible) => set({ penaltyDetailsVisible }),
  togglePenaltyDetails: () => set((state) => ({ penaltyDetailsVisible: !state.penaltyDetailsVisible })),
  resetTransientUi: () => set({
    activeBlock: null,
    previewClassroom: null,
    cancelingAssignment: null,
    cancelModal: initialCancelModal,
    optimizerOpen: false,
    teacherSettingsOpen: false,
    penaltyDetailsVisible: false,
  }),
}));
