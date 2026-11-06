import type { Classroom, Course } from "../types";

const EMPTY_TEACHERS = new Set([
  "",
  "BELİRTİLMEDİ",
  "ÖĞRETMEN ATANMADI",
  "UNDEFINED",
  "NULL",
]);

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .toLocaleUpperCase("tr-TR");

const hasTeacher = (teacherId: unknown, teacherName: unknown) =>
  Boolean(String(teacherId || "").trim()) || !EMPTY_TEACHERS.has(normalize(teacherName));

const courseKey = (
  classroomName: unknown,
  courseName: unknown,
  weeklyHours?: unknown,
  groupName?: unknown,
  splitGroupId?: unknown,
) =>
  [
    normalize(classroomName),
    normalize(courseName),
    String(Number(weeklyHours) || 0),
    normalize(groupName),
    normalize(splitGroupId),
  ].join("|");

const broadCourseKey = (classroomName: unknown, courseName: unknown) =>
  [normalize(classroomName), normalize(courseName)].join("|");

const stableCourseId = (classroom: Classroom, courseName: string, index: number) => {
  const safeName = normalize(courseName).replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, "-").replace(/^-|-$/g, "");
  return `CRS-${classroom.id}-${safeName || "DERS"}-${index}`;
};

export interface AcademicCatalogReconciliationResult {
  classrooms: Classroom[];
  courses: Course[];
  recoveredAssignmentCount: number;
  changed: boolean;
}

/**
 * Sınıfın assignedCourses alanını ana kayıt kabul eder. Eski sürümlerde yalnız
 * courses koleksiyonunda kalmış öğretmenleri önce kurtarır, ardından courses
 * listesini sınıf kayıtlarından yeniden ve tekil olarak üretir.
 */
export function reconcileAcademicCatalogAssignments(
  classrooms: Classroom[],
  courses: Course[],
  options: { recoverLegacyAssignments?: boolean; customCreatedCourses?: any[] } = {},
): AcademicCatalogReconciliationResult {
  const recoverLegacyAssignments = options.recoverLegacyAssignments !== false;
  let injectedAssignmentCount = 0;
  const sourceClassrooms = classrooms.map((classroom) => {
    const assignments = [...(classroom.assignedCourses || [])];
    const selectedDefinitions = (options.customCreatedCourses || []).filter((definition) =>
      Array.isArray(definition?.selectedClassrooms) &&
      definition.selectedClassrooms.includes(classroom.id),
    );

    selectedDefinitions.forEach((definition) => {
      if (!definition?.courseName) return;

      const classGroups = Array.isArray(definition.classGroups?.[classroom.id])
        ? definition.classGroups[classroom.id]
        : [];
      const common = definition.isCommonElective === true ||
        (Array.isArray(definition.targetGroups) && definition.targetGroups.includes("ORTAK"));
      const expectedGroupName = common
        ? ""
        : (classGroups.length ? classGroups.join(", ") : definition.courseGroup || "");
      const expectedHours = Number(definition.weeklyHours) || 2;
      const existingIndex = assignments.findIndex((assignment) =>
        normalize(assignment.courseName) === normalize(definition.courseName) &&
        Number(assignment.weeklyHours || 0) === expectedHours &&
        normalize(assignment.groupName || "") === normalize(expectedGroupName),
      );
      if (existingIndex >= 0) {
        const existing = assignments[existingIndex];
        const expectedTargets = common ? ["ORTAK"] : definition.targetGroups;
        if (
          Boolean(existing.isCommonElective) !== common ||
          JSON.stringify(existing.targetGroups || []) !== JSON.stringify(expectedTargets || [])
        ) {
          assignments[existingIndex] = {
            ...existing,
            isCommonElective: common,
            targetGroups: expectedTargets,
            groupName: common
              ? undefined
              : (existing.groupName || (classGroups.length ? classGroups.join(", ") : definition.courseGroup)),
          };
          injectedAssignmentCount += 1;
        }
        return;
      }

      assignments.push({
        courseName: definition.courseName,
        teacherId: "",
        teacherName: "Belirtilmedi",
        weeklyHours: Number(definition.weeklyHours) || 2,
        type: definition.courseType === "Zorunlu Ders" ? "compulsory" : "elective",
        groupName: common ? undefined : (classGroups.length ? classGroups.join(", ") : definition.courseGroup),
        isCommonElective: common,
        targetGroups: common ? ["ORTAK"] : definition.targetGroups,
      });
      injectedAssignmentCount += 1;
    });

    return assignments.length === (classroom.assignedCourses || []).length
      ? classroom
      : { ...classroom, assignedCourses: assignments };
  });
  const exactLegacy = new Map<string, Course[]>();
  const broadLegacy = new Map<string, Course[]>();
  courses.forEach((course) => {
    const exact = courseKey(course.classroom, course.name, course.weeklyHours, course.groupName, course.splitGroupId);
    const broad = broadCourseKey(course.classroom, course.name);
    exactLegacy.set(exact, [...(exactLegacy.get(exact) || []), course]);
    broadLegacy.set(broad, [...(broadLegacy.get(broad) || []), course]);
  });

  let recoveredAssignmentCount = 0;
  const recoveredClassrooms = sourceClassrooms.map((classroom) => {
    let classroomChanged = false;
    const assignedCourses = (classroom.assignedCourses || []).map((assignment) => {
      if (assignment.teacherAssignmentCleared || !recoverLegacyAssignments || hasTeacher(assignment.teacherId, assignment.teacherName)) {
        return assignment;
      }

      const exactCandidates = exactLegacy.get(
        courseKey(classroom.name, assignment.courseName, assignment.weeklyHours, assignment.groupName, assignment.splitGroupId),
      ) || [];
      const broadCandidates = broadLegacy.get(broadCourseKey(classroom.name, assignment.courseName)) || [];
      const legacy = [...exactCandidates, ...broadCandidates].find((candidate) =>
        hasTeacher(candidate.teacherId, candidate.teacherName) &&
        (!assignment.weeklyHours || !candidate.weeklyHours || Number(candidate.weeklyHours) === Number(assignment.weeklyHours)),
      );
      if (!legacy) return assignment;

      recoveredAssignmentCount += 1;
      classroomChanged = true;
      return {
        ...assignment,
        teacherId: legacy.teacherId,
        teacherName: legacy.teacherName,
        teacherId2: assignment.teacherId2 || legacy.teacherId2,
        teacherName2: assignment.teacherName2 || legacy.teacherName2,
      };
    });
    return classroomChanged ? { ...classroom, assignedCourses } : classroom;
  });

  const usedLegacyIds = new Set<string>();
  const derivedCourses: Course[] = [];

  recoveredClassrooms.forEach((classroom) => {
    (classroom.assignedCourses || []).forEach((assignment, index) => {
      const exactCandidates = exactLegacy.get(
        courseKey(classroom.name, assignment.courseName, assignment.weeklyHours, assignment.groupName, assignment.splitGroupId),
      ) || [];
      const broadCandidates = broadLegacy.get(broadCourseKey(classroom.name, assignment.courseName)) || [];
      const legacy = [...exactCandidates, ...broadCandidates].find(
        (candidate) => !usedLegacyIds.has(String(candidate.id)),
      );
      if (legacy?.id) usedLegacyIds.add(String(legacy.id));

      const weeklyHours = Number(assignment.weeklyHours) || 2;
      const safeCode = normalize(assignment.courseName).slice(0, 3).replace(/[^A-Z0-9]/g, "DRS");
      derivedCourses.push({
        ...(legacy || {}),
        id: legacy?.id || stableCourseId(classroom, assignment.courseName, index),
        name: assignment.courseName,
        code: legacy?.code || `${safeCode}-${normalize(classroom.name).replace(/\s+/g, "")}-${index}`,
        classroom: classroom.name,
        teacherId: assignment.teacherId || "",
        teacherName: assignment.teacherName || "Belirtilmedi",
        teacherId2: assignment.teacherId2,
        teacherName2: assignment.teacherName2,
        teacherAssignmentCleared: assignment.teacherAssignmentCleared,
        schedule: `Haftalık ${weeklyHours} Saat`,
        studentCount: legacy?.studentCount || assignment.studentIds?.length || 24,
        groupName: assignment.groupName,
        splitGroupId: assignment.splitGroupId,
        weeklyHours,
        type: assignment.type,
      } as Course);
    });
  });

  const changed =
    injectedAssignmentCount > 0 || recoveredAssignmentCount > 0 || JSON.stringify(derivedCourses) !== JSON.stringify(courses);

  return {
    classrooms: recoveredClassrooms,
    courses: changed ? derivedCourses : courses,
    recoveredAssignmentCount,
    changed,
  };
}
