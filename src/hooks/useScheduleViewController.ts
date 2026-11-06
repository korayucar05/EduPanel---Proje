import { useEffect, useState } from "react";
import type { ScheduleViewType } from "../types/schedule";
import { useScheduleStore } from "../stores/scheduleStore";
import { useScheduleUiStore } from "../stores/scheduleUiStore";

import { sqliteStorage } from "../lib/sqliteStorageBridge";
const DEFAULT_TIMETABLE = [
  { hour: 1, start: "08:30", end: "09:10" },
  { hour: 2, start: "09:20", end: "10:00" },
  { hour: 3, start: "10:10", end: "10:50" },
  { hour: 4, start: "11:00", end: "11:40" },
  { hour: 5, start: "11:50", end: "12:30" },
  { hour: 6, start: "13:30", end: "14:10" },
  { hour: 7, start: "14:20", end: "15:00" },
  { hour: 8, start: "15:10", end: "15:50" },
];

export function useScheduleViewController() {
  const viewType = useScheduleStore((state) => state.viewType);
  const setViewType = useScheduleStore((state) => state.setViewType);
  const selectedId = useScheduleStore((state) => state.selectedId);
  const setSelectedId = useScheduleStore((state) => state.setSelectedId);

  const activeBlock = useScheduleUiStore((state) => state.activeBlock);
  const setActiveBlock = useScheduleUiStore((state) => state.setActiveBlock);
  const previewClassroom = useScheduleUiStore((state) => state.previewClassroom);
  const setPreviewClassroom = useScheduleUiStore((state) => state.setPreviewClassroom);
  const cancelingAssignment = useScheduleUiStore((state) => state.cancelingAssignment);
  const setCancelingAssignment = useScheduleUiStore((state) => state.setCancelingAssignment);
  const cancelModal = useScheduleUiStore((state) => state.cancelModal);
  const setCancelModal = useScheduleUiStore((state) => state.setCancelModal);
  const openCancelModal = useScheduleUiStore((state) => state.openCancelModal);
  const closeCancelModal = useScheduleUiStore((state) => state.closeCancelModal);
  const optimizerOpen = useScheduleUiStore((state) => state.optimizerOpen);
  const setOptimizerOpen = useScheduleUiStore((state) => state.setOptimizerOpen);
  const teacherSettingsOpen = useScheduleUiStore((state) => state.teacherSettingsOpen);
  const setTeacherSettingsOpen = useScheduleUiStore((state) => state.setTeacherSettingsOpen);
  const penaltyDetailsVisible = useScheduleUiStore((state) => state.penaltyDetailsVisible);
  const togglePenaltyDetails = useScheduleUiStore((state) => state.togglePenaltyDetails);

  const [unwantedTeacherDays, setUnwantedTeacherDaysState] = useState<Record<string, string[]>>({});
  const [timetable, setTimetable] = useState<any[]>(DEFAULT_TIMETABLE);

  useEffect(() => {
    try {
      const saved = sqliteStorage.getItem("scheduling_teacher_unwanted_days");
      if (saved) setUnwantedTeacherDaysState(JSON.parse(saved));
    } catch (error) {
      console.warn("Öğretmen gün tercihleri okunamadı:", error);
    }

    try {
      const saved = sqliteStorage.getItem("school_timetable");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setTimetable(parsed);
      }
    } catch (error) {
      console.warn("Ders saatleri okunamadı:", error);
    }
  }, []);

  const setUnwantedTeacherDays = (next: Record<string, string[]>) => {
    setUnwantedTeacherDaysState(next);
    try {
      sqliteStorage.setItem("scheduling_teacher_unwanted_days", JSON.stringify(next));
    } catch (error) {
      console.warn("Öğretmen gün tercihleri kaydedilemedi:", error);
    }
  };

  const changeView = (nextView: ScheduleViewType) => {
    setViewType(nextView);
    setActiveBlock(null);
    setPreviewClassroom(null);
  };

  const goToClass = (classId: string) => {
    setViewType("class");
    setSelectedId(classId);
    setPreviewClassroom(null);
    setActiveBlock(null);
  };

  return {
    viewType,
    selectedId,
    setSelectedId,
    changeView,
    activeBlock,
    setActiveBlock,
    previewClassroom,
    setPreviewClassroom,
    cancelingAssignment,
    setCancelingAssignment,
    cancelModal,
    setCancelModal,
    openCancelModal,
    closeCancelModal,
    optimizerOpen,
    setOptimizerOpen,
    teacherSettingsOpen,
    setTeacherSettingsOpen,
    penaltyDetailsVisible,
    togglePenaltyDetails,
    unwantedTeacherDays,
    setUnwantedTeacherDays,
    timetable,
    goToClass,
  };
}
