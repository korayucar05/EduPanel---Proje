import { useCallback, useEffect, useMemo, useState } from "react";
import type { Classroom, Teacher } from "../types";
import { useScheduleStore } from "../stores/scheduleStore";
import type { ScheduleData } from "../types/schedule";
import { persistScheduleData, preloadScheduleData, updateScheduleMemoryCache } from "../services/schedule/schedulePersistenceCache";
import { getCurrentAssignedCourses } from "../services/schedule/courseAssignmentService";
import { getCourseTargetGroups, getScheduleCourseName, getScheduleWeeklyHours, normalizeScheduleText } from "../services/schedule/scheduleIdentity";

function courseMatchesCurrentAssignment(item: any, classroom: any): boolean {
  if (!item?.courseName || !classroom) return false;
  const itemName = normalizeScheduleText(getScheduleCourseName(item));
  const itemGroups = getCourseTargetGroups(item).join("+");
  const itemHours = getScheduleWeeklyHours(item);

  return getCurrentAssignedCourses(classroom).some((assigned: any) => {
    if (normalizeScheduleText(getScheduleCourseName(assigned)) !== itemName) return false;
    if (getCourseTargetGroups(assigned).join("+") !== itemGroups) return false;
    const assignedHours = getScheduleWeeklyHours(assigned);
    return !itemHours || !assignedHours || Number(itemHours) === Number(assignedHours);
  });
}

function rebuildTeacherScheduleMirror(
  schedule: ScheduleData,
  teachers: Teacher[],
): ScheduleData {
  const rebuilt: ScheduleData = { ...schedule };

  // Sınıf hücreleri programın kanonik kaynağıdır. Öğretmen hücreleri yalnızca
  // aynı derslerin görünüm/indeks aynasıdır; eski kayıtlarda bu ayna eksik
  // kalabildiği için önce tamamen yeniden üretiriz.
  Object.keys(rebuilt).forEach((key) => {
    if (key.startsWith("teacher_")) delete rebuilt[key];
  });

  const teacherIdFor = (id: unknown, name: unknown) => {
    if (id !== undefined && id !== null && String(id).trim()) return String(id);
    const normalizedName = normalizeScheduleText(name);
    return teachers.find((teacher) => normalizeScheduleText(teacher.name) === normalizedName)?.id || "";
  };

  Object.entries(schedule).forEach(([classKey, raw]) => {
    if (!classKey.startsWith("class_")) return;
    const [, classId, day, hour] = classKey.split("_");
    if (!classId || !day || !hour) return;

    const assignments = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
    assignments.forEach((assignment: any) => {
      const teacherIds = new Set([
        teacherIdFor(assignment.teacherId, assignment.teacherName),
        teacherIdFor(assignment.teacherId2, assignment.teacherName2),
      ].filter(Boolean));

      teacherIds.forEach((teacherId) => {
        const teacherKey = `teacher_${teacherId}_${day}_${hour}`;
        const existing = Array.isArray(rebuilt[teacherKey])
          ? rebuilt[teacherKey] as any[]
          : rebuilt[teacherKey] ? [rebuilt[teacherKey]] : [];
        const duplicate = existing.some((item: any) =>
          item?.blockId === assignment.blockId &&
          item?.courseName === assignment.courseName &&
          item?.className === assignment.className,
        );
        if (!duplicate) rebuilt[teacherKey] = [...existing, assignment];
      });
    });
  });

  return rebuilt;
}

function sanitizeScheduleData(data: ScheduleData, classrooms: Classroom[], teachers: Teacher[] = []): ScheduleData {
  if (!data) return {};
  const byId = new Map((classrooms || []).map((cls: any) => [String(cls.id), cls]));
  const byName = new Map((classrooms || []).map((cls: any) => [normalizeScheduleText(cls.name), cls]));
  const cleaned: ScheduleData = {};

  for (const [key, raw] of Object.entries(data)) {
    // Kullanıcının kapattığı saat/slot bilgileri ders ataması değildir; korunur.
    if (key.startsWith("blocked_")) {
      cleaned[key] = raw;
      continue;
    }

    if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
    const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
    if (!values.length) continue;

    const classIdFromKey = key.startsWith("class_")
      ? key.slice("class_".length).split("_")[0]
      : "";
    const keyClassroom = classIdFromKey ? byId.get(classIdFromKey) : undefined;
    const seen = new Set<string>();
    const valid = values.filter((item: any) => {
      const classroom = keyClassroom ||
        byId.get(String(item?.classId || "")) ||
        byName.get(normalizeScheduleText(item?.className || ""));
      if (!courseMatchesCurrentAssignment(item, classroom)) return false;

      const identity = [
        String(classroom?.id || ""),
        normalizeScheduleText(getScheduleCourseName(item)),
        getCourseTargetGroups(item).join("+") || "GENEL",
        String(getScheduleWeeklyHours(item) || ""),
        String(item?.blockId || ""),
      ].join("__");
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });

    if (valid.length) cleaned[key] = valid;
  }

  return rebuildTeacherScheduleMirror(cleaned, teachers);
}

export function useSchedulePersistence(classrooms: Classroom[], teachers: Teacher[] = []) {
  const rawScheduleData = useScheduleStore((state) => state.scheduleData);
  const storeSetScheduleData = useScheduleStore((state) => state.setScheduleData);
  const [isDbLoading, setIsDbLoading] = useState(true);

  const scheduleData = useMemo(
    () => sanitizeScheduleData(rawScheduleData, classrooms, teachers),
    [rawScheduleData, classrooms, teachers],
  );

  const setScheduleData = useCallback(
    (value: ScheduleData | ((prev: ScheduleData) => ScheduleData)) => {
      storeSetScheduleData((previous) => {
        const next = typeof value === "function" ? value(previous) : value;
        return sanitizeScheduleData(next, classrooms, teachers);
      });
    },
    [classrooms, storeSetScheduleData, teachers],
  );

  useEffect(() => {
    let cancelled = false;

    // App açılışında başlatılan ortak ön yüklemeyi kullanır. Böylece bu ekrana
    // girildiğinde yerel SQLite okuması yeniden başlamaz ve yaklaşık 20 sn'lik bekleme oluşmaz.
    preloadScheduleData()
      .then((saved) => {
        if (!cancelled && Object.keys(rawScheduleData).length === 0 && Object.keys(saved).length > 0) {
          storeSetScheduleData(saved, { skipHistory: true });
        }
      })
      .catch((error) => console.warn("Ders programı verileri yüklenemedi:", error))
      .finally(() => {
        if (!cancelled) setIsDbLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isDbLoading) return;
    updateScheduleMemoryCache(scheduleData);
    persistScheduleData(scheduleData)
      .catch((error) => console.warn("Ders programı yerel SQLite kaydı başarısız:", error));
  }, [scheduleData, isDbLoading]);

  return { scheduleData, setScheduleData, isDbLoading };
}
