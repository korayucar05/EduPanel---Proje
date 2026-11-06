import React, { useCallback, useMemo, useState } from "react";
import { Classroom, Teacher, Course } from "../types";
import ScheduleGrid from "./schedule/ScheduleGrid";
import { useScheduleVoicePlacement } from "./schedule/useScheduleVoicePlacement";
import AssignedCoursesPanel from "./schedule/AssignedCoursesPanel";
import ClassroomPreviewModal from "./schedule/modals/ClassroomPreviewModal";
import TeacherPreferencesModal from "./schedule/modals/TeacherPreferencesModal";
import CancelAssignmentModal from "./schedule/modals/CancelAssignmentModal";
import CancelDistributionModal from "./schedule/modals/CancelDistributionModal";
import SingleCourseSolverModal from "./schedule/modals/SingleCourseSolverModal";
import TeacherSchedulePreviewModal from "./schedule/modals/TeacherSchedulePreviewModal";
import DistributionProgressModal from "./schedule/modals/DistributionProgressModal";
import { calculateSchedulePenalty } from "../utils/penaltyCalculator";
import { DAYS, HOURS, checkClassroomConflict } from "../services/schedule/scheduleRules";
import { useScheduleStore } from "../stores/scheduleStore";
import { useSchedulePersistence } from "../hooks/useSchedulePersistence";
import { useScheduleOperations } from "../hooks/useScheduleOperations";
import { downloadScheduleDistributionReport } from "../services/schedule/scheduleReportService";
import { buildCourseBlocks, getAssignedCoursesList } from "../services/schedule/courseAssignmentService";
import { useSingleCourseSolver } from "../hooks/useSingleCourseSolver";
import { useSchedulingDatabase } from "../hooks/useSchedulingDatabase";
import { useScheduleOptimizer } from "../hooks/useScheduleOptimizer";
import { useScheduleViewController } from "../hooks/useScheduleViewController";
import { tightenExistingSchedule } from "../utils/schedulingSolvers";
import { getPhysicalClassIdentity, isCommonCourseForClass } from "../services/schedule/scheduleIdentity";

interface SchedulePlannerModuleProps {
  teachers: Teacher[];
  classrooms: Classroom[];
  courses: Course[];
}

// A simple local state to hold the assignments.
// In a real app, this would be persisted in local storage or a database.
// key format: "class_${classId}_${day}_${hour}" -> { courseName, teacherId }
// or "teacher_${teacherId}_${day}_${hour}" -> { courseName, classId }

export default function SchedulePlannerModule({
  teachers,
  classrooms,
  courses,
}: SchedulePlannerModuleProps) {
  const [previewTeacher, setPreviewTeacher] = useState<Teacher | null>(null);
  const [distributionProgressOpen, setDistributionProgressOpen] = useState(false);
  const lockedCellKeys = useScheduleStore((state) => state.lockedCellKeys);
  const toggleCellLock = useScheduleStore((state) => state.toggleCellLock);
  const {
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
    teacherSettingsOpen: isTeacherSettingsOpen,
    setTeacherSettingsOpen: setIsTeacherSettingsOpen,
    penaltyDetailsVisible: showPenaltyDetails,
    togglePenaltyDetails,
    unwantedTeacherDays,
    setUnwantedTeacherDays,
    timetable,
    goToClass,
  } = useScheduleViewController();
  const { scheduleData, setScheduleData } = useSchedulePersistence(classrooms, teachers);

  const selectedClassIndex = useMemo(
    () => (viewType === "class" ? classrooms.findIndex((item) => String(item.id) === String(selectedId)) : -1),
    [classrooms, selectedId, viewType],
  );

  const navigateClass = useCallback((direction: -1 | 1) => {
    if (viewType !== "class" || classrooms.length < 2 || selectedClassIndex < 0) return;
    const nextIndex = (selectedClassIndex + direction + classrooms.length) % classrooms.length;
    setSelectedId(classrooms[nextIndex].id);
  }, [classrooms, selectedClassIndex, setSelectedId, viewType]);

  // Solver state is shared so navigation or modal transitions do not lose progress.
  const solverRunning = useScheduleStore((state) => state.solverRunning);
  const setSolverRunning = useScheduleStore((state) => state.setSolverRunning);
  const solverProgress = useScheduleStore((state) => state.solverProgress);
  const setSolverProgress = useScheduleStore((state) => state.setSolverProgress);
  const solverResult = useScheduleStore((state) => state.solverResult);
  const setSolverResult = useScheduleStore((state) => state.setSolverResult);
  const unplacedInfo = useScheduleStore((state) => state.unplacedInfo);
  const setUnplacedInfo = useScheduleStore((state) => state.setUnplacedInfo);
  const solverStats = useScheduleStore((state) => state.solverStats);
  const setSolverStats = useScheduleStore((state) => state.setSolverStats);
  const selectedAlgorithm = useScheduleStore((state) => state.selectedAlgorithm);
  const setSelectedAlgorithm = useScheduleStore((state) => state.setSelectedAlgorithm);
  const selectedScope = useScheduleStore((state) => state.selectedScope);
  const setSelectedScope = useScheduleStore((state) => state.setSelectedScope);

  const { refresh: refreshSchedulingDatabase } = useSchedulingDatabase();
  const {
    isTeacherBusy,
    isCourseAlreadyScheduledOnDay,
    getCourseHoursOnDay,
    writeAssignment,
    removeBlockByBlockId,
    getPlacedHoursForEntity,
    clearAllNonManualAssignments,
    deleteAssignment,
    clearAllAssignmentsForCurrentSelection,
    getCellData,
  } = useScheduleOperations({
    teachers,
    classrooms,
    viewType,
    selectedId,
    scheduleData,
  });

  const findTeacherConflict = useCallback((
    teacherName: string,
    day: string,
    hour: number,
    excludeClassId?: string,
    currentScheduleData: Record<string, any> = scheduleData,
  ) => {
    const normalizedTeacher = String(teacherName || "").trim().toLocaleUpperCase("tr-TR");
    if (!normalizedTeacher || normalizedTeacher === "ÖĞRETMEN ATANMADI" || normalizedTeacher === "BELİRTİLMEDİ") return null;

    const suffix = `_${day}_${hour}`;
    for (const [key, value] of Object.entries(currentScheduleData)) {
      if (!key.startsWith("class_") || !key.endsWith(suffix) || !value) continue;
      const classId = key.slice("class_".length, key.length - suffix.length);
      if (excludeClassId && String(classId) === String(excludeClassId)) continue;
      const entries = Array.isArray(value) ? value.filter(Boolean) : [value];
      const conflict = entries.find((entry: any) => {
        const first = String(entry?.teacherName || "").trim().toLocaleUpperCase("tr-TR");
        const second = String(entry?.teacherName2 || "").trim().toLocaleUpperCase("tr-TR");
        return first === normalizedTeacher || second === normalizedTeacher;
      }) as any;
      if (conflict) {
        const classroom = classrooms.find((item) => String(item.id) === String(classId));
        return {
          teacherName: String(teacherName || "").trim(),
          classId,
          className: String(classroom?.name || conflict?.className || "Başka sınıf"),
          courseName: String(conflict?.courseName || "ders"),
        };
      }
    }

    return null;
  }, [classrooms, scheduleData, teachers]);

  const canPlaceBlock = useCallback((day: string, hour: number, blockToPlace: any) => {
    if (!selectedId || !blockToPlace) return false;
    const coursesToPlace = blockToPlace.originalCourses || [blockToPlace];
    if (coursesToPlace.length > 1) {
      const seenTeachers=new Set<string>();
      for (const course of coursesToPlace) {
        for (const teacherName of [course?.teacherName,course?.teacherName2].filter(Boolean)) {
          const key=String(teacherName).trim().toLocaleUpperCase("tr-TR");
          if (seenTeachers.has(key)) return false;
          seenTeachers.add(key);
        }
      }
    }
    for (let i = 0; i < Number(blockToPlace.duration || 1); i++) {
      const currentHour = hour + i;
      if (currentHour > 8) return false;
      if (scheduleData[`blocked_${viewType}_${selectedId}_${day}_${currentHour}`]) return false;
      const existing = [...getCellData(day, currentHour)];
      for (const courseToPlace of coursesToPlace) {
        if (viewType === "teacher") {
          if (existing.length > 0) return false;
        } else {
          const cls = classrooms.find((c) => c.id === selectedId);
          const incomingCommon = isCommonCourseForClass(courseToPlace);
          const existingCommon = existing.some((item: any) => isCommonCourseForClass(item));
          if (incomingCommon) {
            const sourceClass = classrooms.find((c) => String(c.id) === String(selectedId));
            const siblingBusy = classrooms.some((sibling) => {
              if (String(sibling.id) === String(selectedId)) return false;
              if (!sourceClass || getPhysicalClassIdentity(sibling) !== getPhysicalClassIdentity(sourceClass)) return false;
              const raw = scheduleData[`class_${sibling.id}_${day}_${currentHour}`];
              const siblingItems = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
              return siblingItems.some((item: any) => !isCommonCourseForClass(item));
            });
            if (siblingBusy) return false;
          }
          if (existing.length > 0 && (incomingCommon || existingCommon)) return false;
          const maxParallel = Math.max(2, Array.isArray((cls as any)?.groups) ? (cls as any).groups.length : 0);
          if (existing.length >= maxParallel) return false;
          const conflictResult = checkClassroomConflict(courseToPlace, existing, cls);
          if (!conflictResult.fits) return false;
          existing.push(courseToPlace);
        }
        if (viewType === "class") {
          if (courseToPlace.teacherName && findTeacherConflict(courseToPlace.teacherName, day, currentHour, selectedId)) return false;
          if (courseToPlace.teacherName2 && findTeacherConflict(courseToPlace.teacherName2, day, currentHour, selectedId)) return false;
          if (courseToPlace.teacherName && isTeacherBusy(courseToPlace.teacherName, day, currentHour, selectedId)) return false;
          if (courseToPlace.teacherName2 && isTeacherBusy(courseToPlace.teacherName2, day, currentHour, selectedId)) return false;
        } else {
          const currentTeacher = teachers.find((t) => t.id === selectedId);
          if (currentTeacher && findTeacherConflict(currentTeacher.name, day, currentHour)) return false;
          if (currentTeacher && isTeacherBusy(currentTeacher.name, day, currentHour)) return false;
        }
      }
    }
    return true;
  }, [classrooms, findTeacherConflict, getCellData, isTeacherBusy, scheduleData, selectedId, teachers, viewType]);

  const getPlacementIssue = useCallback((day: string, hour: number, blockToPlace: any) => {
    if (!selectedId || !blockToPlace) return "Ders bloğu seçilemedi.";
    const duration = Number(blockToPlace.duration || 1);
    const coursesToPlace = blockToPlace.originalCourses || [blockToPlace];
    if (coursesToPlace.length > 1) {
      const seenTeachers=new Set<string>();
      for (const course of coursesToPlace) {
        for (const teacherName of [course?.teacherName,course?.teacherName2].filter(Boolean)) {
          const key=String(teacherName).trim().toLocaleUpperCase("tr-TR");
          if (seenTeachers.has(key)) return `Eş zamanlı derslerde aynı öğretmen iki farklı derse atanamaz: ${teacherName}.`;
          seenTeachers.add(key);
        }
      }
    }
    for (let offset = 0; offset < duration; offset++) {
      const currentHour = hour + offset;
      if (currentHour > 8) return `${duration} saatlik blok gün sonunu aşacağı için yerleştirilemez.`;
      if (scheduleData[`blocked_${viewType}_${selectedId}_${day}_${currentHour}`]) return `${day} günü ${currentHour}. ders saati dağıtıma kapalıdır.`;
      if (viewType === "teacher" && getCellData(day, currentHour).length > 0) return `${day} günü ${currentHour}. ders saatinde öğretmenin başka bir dersi bulunmaktadır.`;

      for (const courseToPlace of coursesToPlace) {
        if (viewType === "class") {
          for (const teacherName of [courseToPlace.teacherName, courseToPlace.teacherName2].filter(Boolean)) {
            const conflict = findTeacherConflict(String(teacherName), day, currentHour, selectedId);
            if (conflict) return `Çakışma: ${teacherName} öğretmeni ${day} ${currentHour}. ders saatinde ${conflict.className} sınıfında “${conflict.courseName}” dersine atanmıştır.`;
          }
        } else {
          const currentTeacher = teachers.find((item) => String(item.id) === String(selectedId));
          if (currentTeacher) {
            const conflict = findTeacherConflict(currentTeacher.name, day, currentHour);
            if (conflict) return `Çakışma: ${currentTeacher.name} öğretmeni ${day} ${currentHour}. ders saatinde ${conflict.className} sınıfında “${conflict.courseName}” dersine atanmıştır.`;
          }
        }
      }
    }
    return canPlaceBlock(day, hour, blockToPlace) ? null : "Bu ders bloğu seçilen hücrelere yerleştirilemez. Hücre dolu, kapalı veya sınıf/grup kuralıyla çakışıyor olabilir.";
  }, [canPlaceBlock, findTeacherConflict, getCellData, scheduleData, selectedId, teachers, viewType]);

  const placeBlock = useCallback((day: string, hour: number, blockToPlace: any) => {
    const newSchedule = { ...scheduleData };
    let fits = true;
    
    const coursesToPlace = blockToPlace.originalCourses || [blockToPlace];
    if (coursesToPlace.length > 1) {
      const seenTeachers=new Set<string>();
      for (const course of coursesToPlace) {
        for (const teacherName of [course?.teacherName,course?.teacherName2].filter(Boolean)) {
          const key=String(teacherName).trim().toLocaleUpperCase("tr-TR");
          if (seenTeachers.has(key)) {
            alert(`Eş zamanlı derslerde aynı öğretmen iki farklı derse atanamaz: ${teacherName}.`);
            return;
          }
          seenTeachers.add(key);
        }
      }
    }

    for (let i = 0; i < blockToPlace.duration; i++) {
      const currentHour = hour + i;
      if (currentHour > 8) {
        alert("Ders bloğu gün sonunu (8. saati) aşamaz!");
        fits = false;
        break;
      }

      const isCellBlocked =
        scheduleData[`blocked_${viewType}_${selectedId}_${day}_${currentHour}`];
      if (isCellBlocked) {
        alert(`${day} günü saat ${currentHour} dağıtıma kapalıdır!`);
        fits = false;
        break;
      }

      const existing = [...getCellData(day, currentHour)];

      for (const courseToPlace of coursesToPlace) {
        if (!fits) break;

        if (viewType === "teacher") {
          if (existing.length > 0) {
            alert(
              `Bu saatte (${day}, saat ${currentHour}) başka bir ders atanmıştır!`,
            );
            fits = false;
          }
        } else {
          const cls = classrooms.find((c) => c.id === selectedId);
          const incomingCommon = isCommonCourseForClass(courseToPlace);
          const existingCommon = existing.some((item: any) => isCommonCourseForClass(item));

          // Ortak ders, aynı fiziksel sınıfın bütün grup kayıtlarında aynı anda
          // boş bir hücre bulmak zorundadır. Böylece bir grupta ortak ders varken
          // diğer grupta seçmeli/grup dersi kalması engellenir.
          if (incomingCommon) {
            const sourceClass = classrooms.find((c) => String(c.id) === String(selectedId));
            const siblingBusy = classrooms.some((sibling) => {
              if (String(sibling.id) === String(selectedId)) return false;
              if (!sourceClass || getPhysicalClassIdentity(sibling) !== getPhysicalClassIdentity(sourceClass)) return false;
              const raw = newSchedule[`class_${sibling.id}_${day}_${currentHour}`];
              const siblingItems = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
              return siblingItems.some((item: any) => !isCommonCourseForClass(item));
            });
            if (siblingBusy) {
              alert(`Ortak ders için aynı sınıfın diğer grup hücresi de boş olmalıdır! (${day}, saat ${currentHour})`);
              fits = false;
              break;
            }
          }

          if (existing.length > 0 && (incomingCommon || existingCommon)) {
            alert(`Ortak/grupsuz ders bulunan hücreye ikinci ders yerleştirilemez! (${day}, saat ${currentHour})`);
            fits = false;
            break;
          }
          const maxParallel = Math.max(2, Array.isArray((cls as any)?.groups) ? (cls as any).groups.length : 0);
          if (existing.length >= maxParallel) {
            alert(`Bu hücrede paralel grup dersleri için ayrılan alan doludur! (${day}, saat ${currentHour})`);
            fits = false;
            break;
          }
          const conflictResult = checkClassroomConflict(courseToPlace, existing, cls);
          if (!conflictResult.fits) {
            alert(conflictResult.reason + ` (${day}, saat ${currentHour})`);
            fits = false;
          } else {
            existing.push(courseToPlace);
          }
        }

        // Check if teacher(s) are busy in another classroom at this slot
        if (fits) {
          if (viewType === "class") {
            if (courseToPlace.teacherName) {
              const conflict = findTeacherConflict(courseToPlace.teacherName, day, currentHour, selectedId, newSchedule);
              if (conflict) {
                alert(`Atama yapılmadı. Çakışma: ${courseToPlace.teacherName} öğretmeni ${day} ${currentHour}. ders saatinde ${conflict.className} sınıfında “${conflict.courseName}” dersine atanmıştır.`);
                fits = false;
              } else if (isTeacherBusy(courseToPlace.teacherName, day, currentHour, selectedId, newSchedule)) {
                alert(`Atama yapılmadı: ${courseToPlace.teacherName} öğretmeninin ${day} ${currentHour}. ders saati dağıtıma kapalı veya başka bir görevlendirmeyle doludur.`);
                fits = false;
              }
            }
            if (fits && courseToPlace.teacherName2) {
              const conflict = findTeacherConflict(courseToPlace.teacherName2, day, currentHour, selectedId, newSchedule);
              if (conflict) {
                alert(`Atama yapılmadı. Çakışma: ${courseToPlace.teacherName2} öğretmeni ${day} ${currentHour}. ders saatinde ${conflict.className} sınıfında “${conflict.courseName}” dersine atanmıştır.`);
                fits = false;
              } else if (isTeacherBusy(courseToPlace.teacherName2, day, currentHour, selectedId, newSchedule)) {
                alert(`Atama yapılmadı: ${courseToPlace.teacherName2} öğretmeninin ${day} ${currentHour}. ders saati dağıtıma kapalı veya başka bir görevlendirmeyle doludur.`);
                fits = false;
              }
            }
          } else if (viewType === "teacher") {
            const currentTeacher = teachers.find((t) => t.id === selectedId);
            if (currentTeacher) {
              const conflict = findTeacherConflict(currentTeacher.name, day, currentHour, undefined, newSchedule);
              if (conflict) {
                alert(`Atama yapılmadı. Çakışma: ${currentTeacher.name} öğretmeni ${day} ${currentHour}. ders saatinde ${conflict.className} sınıfında “${conflict.courseName}” dersine zaten atanmıştır.`);
                fits = false;
              } else if (isTeacherBusy(currentTeacher.name, day, currentHour, undefined, newSchedule)) {
                alert(`Atama yapılmadı: ${currentTeacher.name} öğretmeninin ${day} ${currentHour}. ders saati dağıtıma kapalı veya başka bir görevlendirmeyle doludur.`);
                fits = false;
              }
            }
          }
        }
      }
      if (!fits) break;
    }

    if (!fits) {
      return;
    }

    const blockId = `block_${Date.now()}`;
    for (let i = 0; i < blockToPlace.duration; i++) {
      for (const courseToPlace of coursesToPlace) {
        const placement = { ...courseToPlace, duration: blockToPlace.duration, isManual: true, blockId };
        writeAssignment(newSchedule, day, hour + i, placement, selectedId, viewType);

        // Aynı fiziksel sınıf iki/çok grup kaydıyla tutuluyorsa GENEL/ORTAK ders
        // tek sınıf dersi sayılır. Bir gruba manuel yerleştirilince aynı dersin
        // diğer grup kayıtları da aynı hücreye, aynı öğretmenle zorunlu yerleşir.
        // Grup dersleri (SAY/EA/SÖZ/DİL) bu senkronizasyona kesinlikle girmez.
        if (viewType === "class" && isCommonCourseForClass(courseToPlace)) {
          const sourceClass = classrooms.find((c) => String(c.id) === String(selectedId));
          const normalize = (value: any) => String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
          const courseName = normalize(courseToPlace.courseName || courseToPlace.name || courseToPlace.subject);
          const weeklyHours = Number(courseToPlace.weeklyHours || 0);

          for (const sibling of classrooms) {
            if (String(sibling.id) === String(selectedId)) continue;
            if (!sourceClass || getPhysicalClassIdentity(sibling) !== getPhysicalClassIdentity(sourceClass)) continue;

            const siblingCourse = (sibling.assignedCourses || []).find((candidate: any) =>
              isCommonCourseForClass(candidate) &&
              normalize(candidate.courseName || candidate.name || candidate.subject) === courseName &&
              (!weeklyHours || !Number(candidate.weeklyHours || 0) || Number(candidate.weeklyHours || 0) === weeklyHours)
            ) || courseToPlace;

            writeAssignment(
              newSchedule,
              day,
              hour + i,
              {
                ...siblingCourse,
                teacherId: courseToPlace.teacherId || siblingCourse.teacherId,
                teacherName: courseToPlace.teacherName || siblingCourse.teacherName,
                teacherId2: courseToPlace.teacherId2 || siblingCourse.teacherId2,
                teacherName2: courseToPlace.teacherName2 || siblingCourse.teacherName2,
                duration: blockToPlace.duration,
                isManual: true,
                blockId,
                isCommonCourse: true,
              },
              String(sibling.id),
              "class",
            );
          }
        }
      }
    }

    setScheduleData(newSchedule);
    setActiveBlock(null);
  }, [
    classrooms,
    getCellData,
    findTeacherConflict,
    isTeacherBusy,
    scheduleData,
    selectedId,
    setActiveBlock,
    setScheduleData,
    teachers,
    viewType,
    writeAssignment,
  ]);

  const handleOpenBlockedCell = useCallback((day: string, hour: number) => {
    if (!selectedId) return;
    const blockKey = `blocked_${viewType}_${selectedId}_${day}_${hour}`;
    setScheduleData((current) => {
      if (!current[blockKey]) return current;
      const next = { ...current };
      delete next[blockKey];
      return next;
    });
  }, [selectedId, setScheduleData, viewType]);

  const handleCellClick = useCallback((day: string, hour: number) => {
    if (!selectedId) {
      alert(
        "Lütfen önce bir " +
          (viewType === "class" ? "sınıf" : "öğretmen") +
          " seçin.",
      );
      return;
    }

    const existingAssignments = getCellData(day, hour);

    if (activeBlock) {
      placeBlock(day, hour, activeBlock);
    } else {
      if (existingAssignments.length > 0) {
        setCancelingAssignment({
          day,
          hour,
          assignment: existingAssignments[0],
        });
      } else {
        // Öğretmen görünümünde boş hücreye sol tıklama artık ders seçiciyi açar.
        // Hücreyi kapatma/açma davranışı sınıf görünümünde eski şekilde korunur.
        if (viewType === "teacher") return;
        const blockKey = `blocked_${viewType}_${selectedId}_${day}_${hour}`;
        const newSchedule = { ...scheduleData };
        if (newSchedule[blockKey]) {
          delete newSchedule[blockKey];
        } else {
          newSchedule[blockKey] = true;
        }
        setScheduleData(newSchedule);
      }
    }
  }, [
    activeBlock,
    getCellData,
    placeBlock,
    scheduleData,
    selectedId,
    setCancelingAssignment,
    setScheduleData,
    viewType,
  ]);

  const handleDragStart = useCallback((e: React.DragEvent, blockData: any) => {
    e.dataTransfer.setData("application/json", JSON.stringify(blockData));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, day: string, hour: number) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const blockData = JSON.parse(dataStr);
      placeBlock(day, hour, blockData);
    } catch (err) {
      console.error("Drop parsing error", err);
    }
  }, [placeBlock, selectedId]);


  // Eski rastgele/greedy toplu dağıtım fonksiyonları kaldırıldı.
  // Tüm toplu dağıtımlar handleRunOptimizer içindeki CSP + Backtracking + Genetik motoruna yönlendirilir.


  const assignedCourses = useMemo(
    () =>
      getAssignedCoursesList({
        selectedId,
        viewType,
        classrooms,
      }),
    [classrooms, selectedId, viewType],
  );



  const clearActiveBlockAfterVoice = useCallback(() => setActiveBlock(null), [setActiveBlock]);
  const {
    isListening: voiceListening,
    voiceFeedback,
    lastTranscript: voiceTranscript,
    speechRecognitionSupported: voiceSupported,
    startVoicePlacement,
    stopVoicePlacement,
  } = useScheduleVoicePlacement({
    viewType,
    selectedId,
    classrooms,
    teachers,
    assignedCourses,
    scheduleData,
    setScheduleData,
    writeAssignment,
    isTeacherBusy,
    getPlacedHoursForEntity,
    onPlacementComplete: clearActiveBlockAfterVoice,
  });

  const hasIncompleteCourses = useCallback(
    (entityType: "class" | "teacher", entityId: string, entityName: string) => {
      const entityCourses = getAssignedCoursesList({
        selectedId: entityId,
        viewType: entityType,
        classrooms,
      });

      return entityCourses.some((listedCourse) => {
        const sourceCourses = Array.isArray(listedCourse.originalCourses)
          ? listedCourse.originalCourses
          : [listedCourse];

        return sourceCourses.some((course: any) => {
          const courseName = String(course?.courseName || course?.name || "").trim();
          const weeklyHours = Number(course?.weeklyHours || 0);
          if (!courseName || weeklyHours <= 0) return false;

          return getPlacedHoursForEntity(
            entityType,
            entityId,
            courseName,
            course?.groupName,
            entityType === "class" ? undefined : entityName,
            weeklyHours,
            scheduleData,
          ) < weeklyHours;
        });
      });
    },
    [classrooms, getPlacedHoursForEntity, scheduleData],
  );

  const incompleteClassIds = useMemo(
    () => new Set(classrooms.filter((classroom) => hasIncompleteCourses("class", classroom.id, classroom.name)).map((classroom) => classroom.id)),
    [classrooms, hasIncompleteCourses],
  );

  const incompleteTeacherIds = useMemo(
    () => new Set(teachers.filter((teacher) => hasIncompleteCourses("teacher", teacher.id, teacher.name)).map((teacher) => teacher.id)),
    [hasIncompleteCourses, teachers],
  );

  const getPlacedHours = useCallback(
    (courseName: string, groupName?: string, className?: string, weeklyHours?: number) =>
      getPlacedHoursForEntity(
        viewType,
        selectedId,
        courseName,
        groupName,
        className,
        weeklyHours,
        scheduleData,
      ),
    [getPlacedHoursForEntity, scheduleData, selectedId, viewType],
  );

  const availableBlocks = useMemo(() => {
    if (!selectedId) return [];

    // Öğretmen dağıtımında blok kuralı kesin olarak 2+2+...+(gerekirse 1)'dir.
    // Böylece haftalık saati tek olan dersin yalnız son bloğu 1 saat görünür.
    const buildTeacherPickerBlocks = (remainingHours: number) => {
      const durations: number[] = [];
      let remaining = Math.max(0, Math.floor(Number(remainingHours || 0)));
      while (remaining > 0) {
        const duration = remaining >= 2 ? 2 : 1;
        durations.push(duration);
        remaining -= duration;
      }
      return durations;
    };

    const blocks = assignedCourses.flatMap((course: any, courseIndex: number) => {
      const className = course.className || classrooms.find((c) => c.id === selectedId)?.name;
      const groupName = course.originalCourses?.[0]?.groupName || course.groupName;
      const weeklyHours = Number(course.weeklyHours || 0);
      const placedHours = getPlacedHours(course.courseName, groupName, className, weeklyHours);
      const remaining = Math.max(0, weeklyHours - placedHours);
      const durations = viewType === "teacher"
        ? buildTeacherPickerBlocks(remaining)
        : buildCourseBlocks(course, remaining);

      return durations.map((duration, blockIndex) => ({
        ...course,
        duration,
        __pickerId: `${courseIndex}-${blockIndex}-${duration}-${remaining}`,
        __blockIndex: blockIndex,
        __blockCount: durations.length,
        __label: `${course.courseName}${viewType === "teacher" && className ? ` • ${className}` : ""} • ${duration} saat`,
      }));
    });

    return blocks.sort((a: any, b: any) =>
      String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr", { sensitivity: "base" })
      || String(a.className || "").localeCompare(String(b.className || ""), "tr", { sensitivity: "base" })
      || Number(a.__blockIndex || 0) - Number(b.__blockIndex || 0)
    );
  }, [assignedCourses, classrooms, getPlacedHours, selectedId, viewType]);

  const penaltyResult = useMemo(
    () =>
      calculateSchedulePenalty(
        scheduleData,
        classrooms,
        teachers,
        unwantedTeacherDays,
      ),
    [classrooms, scheduleData, teachers, unwantedTeacherDays],
  );
  const totalPenalty = penaltyResult.totalPenalty;

  const {
    solverTargetCourse,
    setSolverTargetCourse,
    isSolverPaused,
    lastDistributionReport,
    handleRunOptimizer,
    requestSolverPause,
    requestSolverResume,
    requestSolverCancel,
  } = useScheduleOptimizer({
    teachers,
    classrooms,
    courses,
    scheduleData,
    setScheduleData,
    viewType,
    selectedId,
    selectedAlgorithm,
    selectedScope,
    unwantedTeacherDays,
    totalPenalty,
    unplacedInfo,
    setSolverRunning,
    setSolverProgress,
    setSolverResult,
    setUnplacedInfo,
    setSolverStats,
    writeAssignment,
    refreshSchedulingDatabase,
  });

  const { runSingleCourseSolver } = useSingleCourseSolver({
    teachers,
    classrooms,
    viewType,
    selectedId,
    scheduleData,
    unwantedTeacherDays,
    getPlacedHoursForEntity,
    setScheduleData,
    setSolverRunning,
    setSolverProgress,
    setSolverResult,
    setSolverTargetCourse,
  });

  const handleDownloadScheduleDistributionReport = useCallback(
    () =>
      downloadScheduleDistributionReport({
        viewType,
        selectedId,
        classrooms,
        teachers,
        scheduleData,
        lastDistributionReport,
        unplacedInfo,
        solverResult,
        totalPenalty,
        penaltyDetails: penaltyResult.details,
        getPlacedHoursForEntity,
      }),
    [
      classrooms,
      getPlacedHoursForEntity,
      lastDistributionReport,
      penaltyResult.details,
      scheduleData,
      selectedId,
      solverResult,
      teachers,
      totalPenalty,
      unplacedInfo,
      viewType,
    ],
  );

  const runLocalDistribution = useCallback((targetViewType: "class" | "teacher") => {
    if (!selectedId || viewType !== targetViewType) return;
    setDistributionProgressOpen(true);
    setSelectedScope("local");
    setSelectedAlgorithm("hybrid");
    void handleRunOptimizer({
      scope: "local",
      selectedId,
      viewType: targetViewType,
      algorithm: "hybrid",
    });
  }, [handleRunOptimizer, selectedId, setSelectedAlgorithm, setSelectedScope, viewType]);

  const runClassDistribution = useCallback(
    () => runLocalDistribution("class"),
    [runLocalDistribution],
  );

  const runTeacherDistribution = useCallback(
    () => runLocalDistribution("teacher"),
    [runLocalDistribution],
  );

  const handleRunSmartFull = useCallback(() => {
    setDistributionProgressOpen(true);
    setSelectedScope("global");
    setSelectedAlgorithm("smart-full");
    void handleRunOptimizer({ scope: "global", algorithm: "smart-full" });
  }, [handleRunOptimizer, setSelectedAlgorithm, setSelectedScope]);

  const handleTightenSchedule = useCallback(async () => {
    if (solverRunning) return;
    setDistributionProgressOpen(true);
    setSolverRunning(true);
    setSolverProgress(0);
    setSolverStats({ totalBlocks: 0, placedBlocks: 0, remainingBlocks: 0, stage: "Mevcut program sıkılaştırılıyor..." });
    try {
      const result = await tightenExistingSchedule(scheduleData, classrooms, teachers, unwantedTeacherDays, {
        onProgress: (progress) => setSolverProgress(Math.max(1, Math.min(99, progress))),
      });
      if (result.improved) {
        setScheduleData(result.schedule);
        setSolverResult({ success: true, courseName: "Program sıkılaştırıldı", details: `Ceza puanı ${result.initialPenalty} → ${result.finalPenalty} indirildi.` });
      } else {
        setSolverResult({ success: true, courseName: "Program zaten en iyi adayda", details: "Manuel ve kilitli dersler korunarak daha iyi bir taşıma bulunamadı." });
      }
      setSolverProgress(100);
    } catch (error: any) {
      setSolverResult({ success: false, courseName: "Sıkılaştırma başarısız", reasons: [error?.message || "Program sıkılaştırılamadı."] });
    } finally {
      setSolverRunning(false);
    }
  }, [classrooms, scheduleData, setScheduleData, setSolverProgress, setSolverResult, setSolverRunning, setSolverStats, solverRunning, teachers, unwantedTeacherDays]);

  const openCurrentViewCancel = useCallback(
    () => openCancelModal(viewType === "class" ? "all_classes" : "all_teachers"),
    [openCancelModal, viewType],
  );

  const openSingleCourseSolver = useCallback(
    (course: any) => {
      setSolverTargetCourse(course);
      setSolverResult(null);
    },
    [setSolverResult, setSolverTargetCourse],
  );

  const openAssignmentTeacherPreview = useCallback((assignment: any) => {
    const teacher = [assignment?.teacherId, assignment?.teacherId2]
      .filter(Boolean)
      .map((teacherId) => teachers.find((item) => item.id === teacherId))
      .find(Boolean)
      || teachers.find((item) => item.name === assignment?.teacherName || item.name === assignment?.teacherName2);
    if (teacher) setPreviewTeacher(teacher);
    else window.alert("Bu derse atanmış öğretmen bulunamadı.");
  }, [teachers]);

  const closeSingleCourseSolver = useCallback(() => {
    setSolverTargetCourse(null);
    setSolverResult(null);
  }, [setSolverResult, setSolverTargetCourse]);

  const closePreview = useCallback(
    () => setPreviewClassroom(null),
    [setPreviewClassroom],
  );

  const closeTeacherSettings = useCallback(
    () => setIsTeacherSettingsOpen(false),
    [setIsTeacherSettingsOpen],
  );

  const closeCancelAssignment = useCallback(
    () => setCancelingAssignment(null),
    [setCancelingAssignment],
  );

  const selectedCancelName = useMemo(
    () =>
      cancelModal.type === "class_single"
        ? classrooms.find((item) => item.id === selectedId)?.name
        : cancelModal.type === "teacher_single"
          ? teachers.find((item) => item.id === selectedId)?.name
          : undefined,
    [cancelModal.type, classrooms, selectedId, teachers],
  );

  const confirmCancelAssignment = useCallback(
    (target: typeof cancelingAssignment extends infer T ? Exclude<T, null> : never) => {
      const newSchedule = { ...scheduleData };
      if (target.assignment.blockId) {
        removeBlockByBlockId(newSchedule, target.assignment.blockId);
      } else {
        deleteAssignment(newSchedule, target.day, target.hour, selectedId, viewType);
      }
      setScheduleData(newSchedule);
      setCancelingAssignment(null);
    },
    [
      deleteAssignment,
      removeBlockByBlockId,
      scheduleData,
      selectedId,
      setCancelingAssignment,
      setScheduleData,
      viewType,
    ],
  );

  const confirmCancelDistribution = useCallback(
    ({ type, exceptManual }: { type: typeof cancelModal.type; exceptManual: boolean }) => {
      const newSchedule = { ...scheduleData };
      if (type === "class_single" || type === "teacher_single") {
        clearAllAssignmentsForCurrentSelection(newSchedule, exceptManual);
      } else {
        Object.keys(newSchedule).forEach((key) => {
          if (!key.startsWith("class_") && !key.startsWith("teacher_")) return;
          if (!exceptManual) {
            delete newSchedule[key];
            return;
          }
          const value = newSchedule[key];
          const items = Array.isArray(value) ? value : value ? [value] : [];
          const manualOnly = items.filter((item: any) => item?.isManual);
          if (manualOnly.length > 0) newSchedule[key] = manualOnly;
          else delete newSchedule[key];
        });
      }
      setScheduleData(newSchedule);
      setActiveBlock(null);
      closeCancelModal();
    },
    [
      cancelModal.type,
      clearAllAssignmentsForCurrentSelection,
      closeCancelModal,
      scheduleData,
      setActiveBlock,
      setScheduleData,
    ],
  );

  const handleToggleCellLock = useCallback((day: string, hour: number) => {
    if (!selectedId) return;
    const lockKey = `${viewType}_${selectedId}_${day}_${hour}`;
    const scheduleKey = `${viewType}_${selectedId}_${day}_${hour}`;
    const markerKey = `locked_${lockKey}`;
    setScheduleData((current) => {
      const next = { ...current };
      const locking = !lockedCellKeys.includes(lockKey);

      if (locking) {
        // Hücre kapatılırken içindeki atanmış dersi de dağıtımdan çıkar.
        // Ders bir bloğa aitse (örn. 2 saatlik blok), blockId aynı olan tüm
        // hücreleri sınıf ve öğretmen çizelgelerinden birlikte kaldırılır.
        // Böylece blok tekrar Açılır Buton'daki dağıtılmamış dersler arasına döner.
        const raw = next[scheduleKey];
        const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const blockIds = Array.from(
          new Set(items.map((item: any) => item?.blockId).filter(Boolean)),
        ) as string[];

        blockIds.forEach((blockId) => removeBlockByBlockId(next, blockId));

        // blockId taşımayan eski/tek saatlik kayıt varsa yalnız bu hücredeki
        // atamayı kaldır. Açılır Buton listesi scheduleData'dan türetildiği için
        // ders otomatik olarak yeniden dağıtılabilir hâle gelir.
        if (items.some((item: any) => !item?.blockId)) {
          deleteAssignment(next, day, hour, selectedId, viewType);
        }

        next[markerKey] = true;
      } else {
        delete next[markerKey];
      }
      return next;
    });
    toggleCellLock(lockKey);
  }, [deleteAssignment, lockedCellKeys, removeBlockByBlockId, selectedId, setScheduleData, toggleCellLock, viewType]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 pb-6 pt-3 lg:px-8 lg:pb-8 lg:pt-3">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side: Top bar and Table Area */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full lg:pl-6">


          <ScheduleGrid
            days={DAYS}
            hours={HOURS}
            timetable={timetable}
            selectedId={selectedId}
            viewType={viewType}
            scheduleData={scheduleData}
            activeBlock={activeBlock}
            availableBlocks={availableBlocks}
            getCellData={getCellData}
            onCellClick={handleCellClick}
            onOpenBlockedCell={handleOpenBlockedCell}
            onPlaceBlock={placeBlock}
            canPlaceBlock={canPlaceBlock}
            getPlacementIssue={getPlacementIssue}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onRequestRemove={setCancelingAssignment}
            onPreviewTeacher={openAssignmentTeacherPreview}
            lockedCellKeys={lockedCellKeys}
            onToggleLock={handleToggleCellLock}
            onPreviousClass={() => navigateClass(-1)}
            onNextClass={() => navigateClass(1)}
            canNavigateClasses={classrooms.length > 1}
          />
        </div>
        {/* End of Left Side Column */}

        {/* Right Side Column: Assigned courses */}
        <div className="w-full lg:w-64 xl:w-72 flex flex-col gap-4 shrink-0 sticky top-6">
          <AssignedCoursesPanel
            viewType={viewType}
            selectedId={selectedId}
            classrooms={classrooms}
            teachers={teachers}
            incompleteClassIds={incompleteClassIds}
            incompleteTeacherIds={incompleteTeacherIds}
            onViewTypeChange={changeView}
            onSelectedIdChange={setSelectedId}
            solverRunning={solverRunning}
            onRunGlobal={handleRunSmartFull}
            onOpenGlobalCancel={() => openCancelModal("all_classes")}
            onRunClassDistribution={runClassDistribution}
            onOpenClassCancel={() => openCancelModal("class_single")}
            onRunTeacherDistribution={runTeacherDistribution}
            onOpenTeacherCancel={() => openCancelModal("teacher_single")}
            voiceListening={voiceListening}
            voiceFeedback={voiceFeedback}
            voiceTranscript={voiceTranscript}
            voiceSupported={voiceSupported}
            onStartVoice={startVoicePlacement}
            onStopVoice={() => stopVoicePlacement("Sesli yerleştirme durduruldu.")}
          />
        </div>
      </div>

      <SingleCourseSolverModal
        course={solverTargetCourse}
        solverRunning={solverRunning}
        solverProgress={solverProgress}
        solverPaused={isSolverPaused}
        solverResult={solverResult}
        onClose={closeSingleCourseSolver}
        onStart={runSingleCourseSolver}
        onPause={requestSolverPause}
        onResume={requestSolverResume}
        onCancel={requestSolverCancel}
      />

      <DistributionProgressModal
        open={distributionProgressOpen}
        solverRunning={solverRunning}
        solverProgress={solverProgress}
        solverStats={solverStats}
        unplacedInfo={unplacedInfo}
        solverResult={solverResult}
        onClose={() => setDistributionProgressOpen(false)}
      />

      <ClassroomPreviewModal
        previewClassroom={previewClassroom}
        scheduleData={scheduleData}
        timetable={timetable}
        onClose={closePreview}
        onGoToClass={goToClass}
      />
      <TeacherSchedulePreviewModal
        teacher={previewTeacher}
        scheduleData={scheduleData}
        days={DAYS}
        hours={HOURS}
        onClose={() => setPreviewTeacher(null)}
      />
      <TeacherPreferencesModal
        open={isTeacherSettingsOpen}
        teachers={teachers}
        days={DAYS}
        unwantedTeacherDays={unwantedTeacherDays}
        onChange={setUnwantedTeacherDays}
        onClose={closeTeacherSettings}
      />

      <CancelAssignmentModal
        value={cancelingAssignment}
        onClose={closeCancelAssignment}
        onConfirm={confirmCancelAssignment}
      />

      <CancelDistributionModal
        value={cancelModal}
        selectedName={selectedCancelName}
        onChange={setCancelModal}
        onClose={closeCancelModal}
        onConfirm={confirmCancelDistribution}
      />
</div>
  );
}
