import { useMemo } from "react";
import type { Classroom, Teacher } from "../types";
import { checkClassroomConflict } from "../services/schedule/scheduleRules";
import { createCourseIdentity, getCourseTargetGroups, isCommonCourseForClass, resolveTeacherIdentityKeys } from "../services/schedule/scheduleIdentity";
import type { ScheduleData, ScheduleViewType } from "../types/schedule";

interface UseScheduleOperationsArgs {
  teachers: Teacher[];
  classrooms: Classroom[];
  viewType: ScheduleViewType;
  selectedId: string;
  scheduleData: ScheduleData;
}

/**
 * Çizelge üzerinde okuma, yazma ve silme yapan ortak işlem katmanı.
 * UI component'lerinden bağımsız tutulduğu için aynı kurallar solver, grid ve rapor
 * üretiminde tekrar kullanılabilir.
 */
export function useScheduleOperations({
  teachers,
  classrooms,
  viewType,
  selectedId,
  scheduleData,
}: UseScheduleOperationsArgs) {
  return useMemo(() => {
  const isTeacherBusy = (
    teacherName: string,
    day: string,
    hour: number,
    excludeClassId?: string,
    currentScheduleData: Record<string, any> = scheduleData,
  ) => {
    if (
      !teacherName ||
      teacherName === "Öğretmen Atanmadı" ||
      teacherName === "Belirtilmedi"
    )
      return false;
  
    const teacherObj = teachers.find((t) => t.name === teacherName);
    const teacherId = teacherObj?.id;
  
    if (teacherId) {
      if (currentScheduleData[`blocked_teacher_${teacherId}_${day}_${hour}`]) {
        return true;
      }
    }
  
    const suffix = `_${day}_${hour}`;
  
    for (const [key, value] of Object.entries(currentScheduleData)) {
      if (!value) continue;
      const arr = Array.isArray(value) ? value : [value];
      if (arr.length === 0) continue;
  
      if (key.startsWith("class_") && key.endsWith(suffix)) {
        if (excludeClassId && key.startsWith(`class_${excludeClassId}_`)) {
          continue;
        }
        if (
          arr.some(
            (v: any) =>
              v?.teacherName === teacherName || v?.teacherName2 === teacherName,
          )
        ) {
          return true;
        }
      }
  
      if (
        teacherId &&
        key.startsWith(`teacher_${teacherId}_`) &&
        key.endsWith(suffix)
      ) {
        return true;
      }
    }
    return false;
  };
  
  const isCourseAlreadyScheduledOnDay = (
    courseName: string,
    day: string,
    classId: string,
    currentScheduleData: Record<string, any> = scheduleData,
  ) => {
    for (let h = 1; h <= 8; h++) {
      const key = `class_${classId}_${day}_${h}`;
      const value = currentScheduleData[key];
      if (value) {
        const arr = Array.isArray(value) ? value : [value];
        if (arr.some((v: any) => v?.courseName === courseName)) {
          return true;
        }
      }
    }
    return false;
  };
  
  const getCourseHoursOnDay = (
    courseName: string,
    day: string,
    classId: string,
    currentScheduleData: Record<string, any> = scheduleData,
  ) => {
    let count = 0;
    for (let h = 1; h <= 8; h++) {
      const key = `class_${classId}_${day}_${h}`;
      const value = currentScheduleData[key];
      if (value) {
        const arr = Array.isArray(value) ? value : [value];
        if (arr.some((v: any) => v?.courseName === courseName)) {
          count++;
        }
      }
    }
    return count;
  };
  
  const writeAssignment = (
    newSchedule: Record<string, any>,
    day: string,
    hour: number,
    item: {
      courseName: string;
      teacherName?: string;
      teacherName2?: string;
      className?: string;
      type?: string;
      groupName?: string;
      targetGroups?: string[];
      weeklyHours?: number;
      splitGroupId?: string;
      studentIds?: string[];
      blockId?: string;
      isManual?: boolean;
    },
    currentSelectedId: string,
    currentViewType: "class" | "teacher",
  ) => {
    let classId = "";
    let className = "";
  
    if (currentViewType === "class") {
      classId = currentSelectedId;
      const cls = classrooms.find((c) => c.id === classId);
      className = cls ? cls.name : item.className || "";
    } else {
      className = item.className || "";
      const cls = classrooms.find((c) => c.name === className);
      classId = cls ? cls.id : "";
    }
  
    const isValidTeacherName = (name: any) => {
      const value = String(name || "").trim();
      return value && value !== "Öğretmen Atanmadı" && value !== "Belirtilmedi";
    };
  
    const normalizeCourseForLookup = (value: any) =>
      String(value || "")
        .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "")
        .replace(/İ/g, "I")
        .replace(/ı/g, "I")
        .toLocaleUpperCase("tr-TR")
        .trim()
        .replace(/\s+/g, " ");
  
    const normalizeGroupForLookup = (value: any) =>
      String(value || "")
        .replace(/İ/g, "I")
        .replace(/ı/g, "I")
        .toLocaleUpperCase("tr-TR")
        .trim();
  
    const groupFromCourseNameForLookup = (value: any) => {
      const match = String(value || "").match(/\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i);
      return normalizeGroupForLookup(match?.[1] || "");
    };
  
    const selectedClassObj = classrooms.find((c: any) => c.id === classId || c.name === className) as any;
    const targetCourseName = normalizeCourseForLookup(item.courseName);
    const targetGroupName = normalizeGroupForLookup(item.groupName) || groupFromCourseNameForLookup(item.courseName);
  
    const requestedGroups =
      item.targetGroups?.length
        ? [...getCourseTargetGroups(item)].sort().join("|")
        : targetGroupName;

    const sourceAssignedCourse = (selectedClassObj?.assignedCourses || []).find((course: any) => {
      const courseName = normalizeCourseForLookup(
        course?.courseName || course?.name || course?.subject,
      );
      const courseGroups = getCourseTargetGroups(course).sort().join("|");
      const legacyGroupName =
        normalizeGroupForLookup(course?.groupName) ||
        groupFromCourseNameForLookup(course?.courseName || course?.name || course?.subject);

      const sameCourse = courseName === targetCourseName;
      const sameGroups = requestedGroups
        ? (courseGroups || legacyGroupName) === requestedGroups
        : courseGroups.length === 0;
      const sameHours =
        !item.weeklyHours ||
        !course?.weeklyHours ||
        Number(course.weeklyHours) === Number(item.weeklyHours);

      return sameCourse && sameGroups && sameHours;
    }) as any;
  
    const teacherNameFromId = (teacherId: any) =>
      teachers.find((t: any) => String(t.id) === String(teacherId))?.name || "";
  
    const resolvedTeacherName = isValidTeacherName(item.teacherName)
      ? item.teacherName
      : sourceAssignedCourse?.teacherName ||
        sourceAssignedCourse?.teacher ||
        teacherNameFromId(sourceAssignedCourse?.teacherId) ||
        (currentViewType === "teacher" ? teachers.find((t) => t.id === currentSelectedId)?.name || "" : "");
  
    const resolvedTeacherName2 = isValidTeacherName(item.teacherName2)
      ? item.teacherName2
      : sourceAssignedCourse?.teacherName2 ||
        sourceAssignedCourse?.secondTeacherName ||
        teacherNameFromId(sourceAssignedCourse?.teacherId2) ||
        "";
  
    const teachersList: { id: string; name: string }[] = [];
    if (isValidTeacherName(resolvedTeacherName)) {
      const t = teachers.find((t) => t.name === resolvedTeacherName);
      if (t) teachersList.push({ id: t.id, name: t.name });
    }
    if (isValidTeacherName(resolvedTeacherName2)) {
      const t = teachers.find((t) => t.name === resolvedTeacherName2);
      if (t) teachersList.push({ id: t.id, name: t.name });
    }
  
    if (
      currentViewType === "teacher" &&
      !teachersList.some((t) => t.id === currentSelectedId)
    ) {
      const t = teachers.find((t) => t.id === currentSelectedId);
      if (t) {
        teachersList.push({ id: t.id, name: t.name });
      }
    }
  
    const payload = {
      courseName: item.courseName,
      teacherName: isValidTeacherName(resolvedTeacherName) ? resolvedTeacherName : "",
      teacherName2: isValidTeacherName(resolvedTeacherName2) ? resolvedTeacherName2 : "",
      className: className,
      type: item.type || sourceAssignedCourse?.type || "",
      groupName: item.groupName || sourceAssignedCourse?.groupName || "",
      targetGroups:
        item.targetGroups ||
        sourceAssignedCourse?.targetGroups ||
        [],
      weeklyHours:
        item.weeklyHours ||
        sourceAssignedCourse?.weeklyHours ||
        0,
      splitGroupId: item.splitGroupId || sourceAssignedCourse?.splitGroupId || "",
      studentIds: Array.isArray(item.studentIds) && item.studentIds.length
        ? [...item.studentIds]
        : Array.isArray(sourceAssignedCourse?.studentIds)
          ? [...sourceAssignedCourse.studentIds]
          : [],
      blockId: (item as any).blockId || "",
      isCommonCourse: isCommonCourseForClass({ ...sourceAssignedCourse, ...item }),
      isManual:
        (item as any).isManual !== undefined ? (item as any).isManual : true,
    };
  
    if (classId) {
      const classKey = `class_${classId}_${day}_${hour}`;
      const existing = newSchedule[classKey] || [];
      const arr = Array.isArray(existing) ? existing : [existing];
      if (
        !arr.some((v: any) => createCourseIdentity(v, classId) === createCourseIdentity(payload, classId))
      ) {
        newSchedule[classKey] = [...arr, payload];
      }
    }
  
    teachersList.forEach((tInfo) => {
      const teacherKey = `teacher_${tInfo.id}_${day}_${hour}`;
      const existing = newSchedule[teacherKey] || [];
      const arr = Array.isArray(existing) ? existing : [existing];
      if (
        !arr.some((v: any) => createCourseIdentity(v, String(v?.className || payload.className || "")) === createCourseIdentity(payload, String(payload.className || "")))
      ) {
        newSchedule[teacherKey] = [...arr, payload];
      }
    });
  };
  
  const removeBlockByBlockId = (
    newSchedule: Record<string, any>,
    blockId: string,
  ) => {
    Object.keys(newSchedule).forEach((key) => {
      if (key.startsWith("class_") || key.startsWith("teacher_")) {
        const existing = newSchedule[key];
        if (existing) {
          const arr = Array.isArray(existing) ? existing : [existing];
          const updated = arr.filter((v: any) => v?.blockId !== blockId);
          if (updated.length > 0) {
            newSchedule[key] = updated;
          } else {
            delete newSchedule[key];
          }
        }
      }
    });
  };
  
  const normalizeCourseMatchText = (value: any) =>
    String(value || "")
      .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "")
      .replace(/İ/g, "I")
      .replace(/ı/g, "I")
      .toLocaleUpperCase("tr-TR")
      .trim()
      .replace(/\s+/g, " ");
  
  const normalizeGroupMatchText = (value: any) =>
    String(value || "")
      .replace(/İ/g, "I")
      .replace(/ı/g, "I")
      .toLocaleUpperCase("tr-TR")
      .trim();
  
  const getGroupFromCourseName = (value: any) => {
    const match = String(value || "").match(/\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i);
    return normalizeGroupMatchText(match?.[1] || "");
  };
  
  const getPlacedHoursForEntity = (
    type: "class" | "teacher",
    id: string,
    courseName: string,
    groupName?: string,
    className?: string,
    weeklyHours?: number,
    currentScheduleData: Record<string, any> = scheduleData,
  ) => {
    let count = 0;
    const prefix = `${type}_${id}_`;
    const targetCourseName = normalizeCourseMatchText(courseName);
    const targetGroupName = normalizeGroupMatchText(groupName) || getGroupFromCourseName(courseName);
    const normClassName = String(className || "").trim();
  
    Object.entries(currentScheduleData).forEach(([key, value]) => {
      if (key.startsWith(prefix)) {
        const arr = Array.isArray(value) ? value : [value];
        arr.forEach((v: any) => {
          const placedCourseName = normalizeCourseMatchText(v?.courseName);
          const placedGroupName = normalizeGroupMatchText(v?.groupName) || getGroupFromCourseName(v?.courseName);
          const vClassName = String(v?.className || "").trim();
  
          const sameCourse = placedCourseName === targetCourseName;
          const sameGroup = !targetGroupName || !placedGroupName || placedGroupName === targetGroupName;
          const sameWeeklyHours = !weeklyHours || !v?.weeklyHours || Number(v.weeklyHours) === Number(weeklyHours);
  
          if (type === "class") {
            if (sameCourse && sameGroup && sameWeeklyHours) count++;
          } else {
            if (sameCourse && vClassName === normClassName && sameGroup && sameWeeklyHours) count++;
          }
        });
      }
    });
    return count;
  };
  
  const clearAllNonManualAssignments = (newSchedule: Record<string, any>) => {
    Object.keys(newSchedule).forEach((k) => {
      if (k.startsWith("class_") || k.startsWith("teacher_")) {
        const val = newSchedule[k];
        if (val) {
          const arr = Array.isArray(val) ? val : [val];
          const manual = arr.filter((v: any) => v?.isManual);
          if (manual.length > 0) {
            newSchedule[k] = manual;
          } else {
            delete newSchedule[k];
          }
        }
      }
    });
  };
  
  const deleteAssignment = (
    newSchedule: Record<string, any>,
    day: string,
    hour: number,
    currentSelectedId: string,
    currentViewType: "class" | "teacher",
    onlyNonManual: boolean = false,
  ) => {
    const key =
      currentViewType === "class"
        ? `class_${currentSelectedId}_${day}_${hour}`
        : `teacher_${currentSelectedId}_${day}_${hour}`;
    const existing = newSchedule[key];
    if (!existing) return;
    let assignments = Array.isArray(existing) ? existing : [existing];
  
    if (onlyNonManual) {
      assignments = assignments.filter((a: any) => a && !a.isManual);
    }
  
    assignments.forEach((assignment: any) => {
      let classId = "";
      let className = "";
      if (currentViewType === "class") {
        classId = currentSelectedId;
        const cls = classrooms.find((c) => c.id === classId);
        className = cls ? cls.name : assignment.className || "";
      } else {
        className = assignment.className || "";
        const cls = classrooms.find((c) => c.name === className);
        classId = cls ? cls.id : "";
      }
  
      const teachersList: string[] = [];
      if (
        assignment.teacherName &&
        assignment.teacherName !== "Öğretmen Atanmadı" &&
        assignment.teacherName !== "Belirtilmedi"
      ) {
        const t = teachers.find((t) => t.name === assignment.teacherName);
        if (t) teachersList.push(t.id);
      }
      if (
        assignment.teacherName2 &&
        assignment.teacherName2 !== "Öğretmen Atanmadı" &&
        assignment.teacherName2 !== "Belirtilmedi"
      ) {
        const t = teachers.find((t) => t.name === assignment.teacherName2);
        if (t) teachersList.push(t.id);
      }
  
      if (classId) {
        const classKey = `class_${classId}_${day}_${hour}`;
        const cArr = newSchedule[classKey];
        if (cArr) {
          const cArrParsed = Array.isArray(cArr) ? cArr : [cArr];
          const assignmentIdentity = createCourseIdentity(assignment, classId);
          const updated = cArrParsed.filter(
            (v: any) => createCourseIdentity(v, classId) !== assignmentIdentity,
          );
          if (updated.length > 0) {
            newSchedule[classKey] = updated;
          } else {
            delete newSchedule[classKey];
          }
        }
      }
  
      teachersList.forEach((teacherId) => {
        const teacherKey = `teacher_${teacherId}_${day}_${hour}`;
        const tArr = newSchedule[teacherKey];
        if (tArr) {
          const tArrParsed = Array.isArray(tArr) ? tArr : [tArr];
          const assignmentIdentity = createCourseIdentity(assignment, className);
          const updated = tArrParsed.filter(
            (v: any) => createCourseIdentity(v, String(v?.className || className)) !== assignmentIdentity,
          );
          if (updated.length > 0) {
            newSchedule[teacherKey] = updated;
          } else {
            delete newSchedule[teacherKey];
          }
        }
      });
    });
  
    if (onlyNonManual) {
      const remaining = (
        Array.isArray(newSchedule[key]) ? newSchedule[key] : [newSchedule[key]]
      ).filter((a: any) => a?.isManual);
      if (remaining.length > 0) {
        newSchedule[key] = remaining;
      } else {
        delete newSchedule[key];
      }
    } else {
      delete newSchedule[key];
    }
  };
  
  const clearAllAssignmentsForCurrentSelection = (
    newSchedule: Record<string, any>,
    exceptManual: boolean = false,
  ) => {
    if (viewType === "teacher") {
      const selectedTeacher = teachers.find((teacher) => String(teacher.id) === String(selectedId));
      const selectedTeacherName = normalizeCourseMatchText(selectedTeacher?.name || "");
      const isSelectedTeacherAssignment = (assignment: any) => {
        const ids = [assignment?.teacherId, assignment?.teacherId2].filter(Boolean).map(String);
        if (ids.includes(String(selectedId))) return true;
        const names = [assignment?.teacherName, assignment?.teacherName2]
          .map((value) => normalizeCourseMatchText(value || ""));
        return Boolean(selectedTeacherName && names.includes(selectedTeacherName));
      };

      // Öğretmen görünümündeki ayna kaydı eksik veya eski formatta olsa bile,
      // sınıf hücrelerindeki aynı otomatik atamayı seçili öğretmen kimliğiyle
      // temizle. Manuel kayıtlar yalnızca kullanıcı özellikle dahil ettiyse
      // silinir.
      Object.keys(newSchedule).forEach((key) => {
        if (!key.startsWith("class_") && !key.startsWith("teacher_")) return;
        const raw = newSchedule[key];
        const values = Array.isArray(raw) ? raw : [raw];
        const kept = values.filter((assignment: any) => {
          if (!assignment || !isSelectedTeacherAssignment(assignment)) return true;
          return exceptManual && assignment.isManual;
        });
        if (kept.length) newSchedule[key] = kept;
        else delete newSchedule[key];
      });
      return;
    }

    const prefix =
      viewType === "class" ? `class_${selectedId}_` : `teacher_${selectedId}_`;
    Object.keys(newSchedule).forEach((k) => {
      if (k.startsWith(prefix)) {
        const parts = k.split("_");
        if (parts.length >= 4) {
          const day = parts[parts.length - 2];
          const hour = parseInt(parts[parts.length - 1], 10);
          if (day && !isNaN(hour)) {
            deleteAssignment(
              newSchedule,
              day,
              hour,
              selectedId,
              viewType,
              exceptManual,
            );
          }
        } else {
          if (!exceptManual) {
            delete newSchedule[k];
          }
        }
      }
    });
  };
  
  const getCellData = (day: string, hour: number) => {
    if (!selectedId) return [];
    const key =
      viewType === "class"
        ? `class_${selectedId}_${day}_${hour}`
        : `teacher_${selectedId}_${day}_${hour}`;
    const data = scheduleData[key];
    if (data) return Array.isArray(data) ? data : [data];

    // Sınıf hücreleri kanonik program kaynağıdır. Öğretmen hücreleri yalnızca
    // görünüm aynası olduğundan eski kayıt veya eşzamanlı yazım anında eksik
    // olabilir. Ayna yoksa öğretmenin derslerini sınıf hücrelerinden türetmek,
    // başarıyla yerleştirilen dersin öğretmen planında boş görünmesini önler.
    if (viewType !== "teacher") return [];
    const teacherKey = `ID:${String(selectedId)}`;
    return Object.entries(scheduleData)
      .filter(([scheduleKey]) => scheduleKey.startsWith("class_") && scheduleKey.endsWith(`_${day}_${hour}`))
      .flatMap(([, raw]) => Array.isArray(raw) ? raw : raw ? [raw] : [])
      .filter((assignment: any) => resolveTeacherIdentityKeys(assignment, teachers).includes(teacherKey));
  };

    return {
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
    };
  }, [classrooms, scheduleData, selectedId, teachers, viewType]);
}
