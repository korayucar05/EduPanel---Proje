import type { Classroom, Course, Teacher } from "../types";

const EMPTY_TEACHER_NAMES = new Set([
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
    .toLocaleUpperCase("tr-TR");

const isGermanCourse = (value: unknown) => normalize(value).includes("ALMANCA");

const hasTeacher = (teacherId: unknown, teacherName: unknown) =>
  Boolean(String(teacherId || "").trim()) || !EMPTY_TEACHER_NAMES.has(normalize(teacherName));

const isAvailableTeacher = (teacher: Teacher) => {
  const status = normalize(teacher.status);
  return !status || status === "AKTİF";
};

export interface GermanTeacherReconciliationResult {
  classrooms: Classroom[];
  courses: Course[];
  teacher?: Teacher;
  changed: boolean;
}

/**
 * Almanca branşında yalnızca bir aktif öğretmen varsa öğretmensiz Almanca
 * kayıtlarını bu öğretmene bağlar. Birden fazla aday bulunduğunda yanlış
 * atama yapmamak için kayıtları değiştirmez.
 */
export function reconcileGermanTeacherAssignments(
  classrooms: Classroom[],
  courses: Course[],
  teachers: Teacher[],
): GermanTeacherReconciliationResult {
  const candidates = teachers.filter(
    (teacher) => isAvailableTeacher(teacher) && normalize(teacher.branch).includes("ALMANCA"),
  );

  if (candidates.length !== 1) {
    return { classrooms, courses, changed: false };
  }

  const teacher = candidates[0];
  let changed = false;

  const nextClassrooms = classrooms.map((classroom) => {
    let classroomChanged = false;
    const assignedCourses = (classroom.assignedCourses || []).map((course) => {
      if (course.teacherAssignmentCleared || !isGermanCourse(course.courseName) || hasTeacher(course.teacherId, course.teacherName)) {
        return course;
      }

      changed = true;
      classroomChanged = true;
      return { ...course, teacherId: teacher.id, teacherName: teacher.name };
    });

    return classroomChanged ? { ...classroom, assignedCourses } : classroom;
  });

  const nextCourses = courses.map((course) => {
    if (course.teacherAssignmentCleared || !isGermanCourse(course.name) || hasTeacher(course.teacherId, course.teacherName)) {
      return course;
    }

    changed = true;
    return { ...course, teacherId: teacher.id, teacherName: teacher.name };
  });

  return {
    classrooms: changed ? nextClassrooms : classrooms,
    courses: changed ? nextCourses : courses,
    teacher,
    changed,
  };
}
