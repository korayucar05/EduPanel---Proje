import type { Classroom, Student } from "../types";

const normalizeClassroomKey = (value: unknown) => String(value ?? "")
  .trim()
  .toLocaleUpperCase("tr-TR")
  .replace(/[^0-9A-ZÇĞİÖŞÜ]/gu, "");

export const getAttendanceStudentNumber = (student: Student) => String(
  student.number
  ?? student.studentNumber
  ?? student.schoolNumber
  ?? student.schoolNo
  ?? student.id
  ?? "",
).trim();

export const studentBelongsToClassroom = (student: Student, classroom?: Classroom) => {
  if (!classroom) return false;
  const classroomId = String(classroom.id);
  if ([student.classroomId, student.classId].some((value) => String(value ?? "") === classroomId)) return true;
  const studentClassroom = normalizeClassroomKey(student.classroom);
  return Boolean(studentClassroom && (
    studentClassroom === normalizeClassroomKey(classroom.name)
    || studentClassroom === normalizeClassroomKey(classroom.id)
  ));
};

export const getSortedAttendanceStudents = (students: Student[], classroom?: Classroom) => students
  .filter((student) => student.status !== "Pasif" && studentBelongsToClassroom(student, classroom))
  .sort((a, b) => {
    const firstNumber = getAttendanceStudentNumber(a); const secondNumber = getAttendanceStudentNumber(b);
    if (!firstNumber && secondNumber) return 1;
    if (firstNumber && !secondNumber) return -1;
    return firstNumber.localeCompare(secondNumber, "tr", { numeric: true, sensitivity: "base" })
      || a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
