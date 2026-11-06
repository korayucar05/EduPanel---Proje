import type { PanelUser } from "../../lib/accessControl";
import type { CloudRole } from "./rolePermissions";

export type ScopedDataResult<TStudent = Record<string, any>, TTeacher = Record<string, any>, TCourse = Record<string, any>, TClassroom = Record<string, any>> = {
  students: TStudent[];
  teachers: TTeacher[];
  courses: TCourse[];
  classrooms: TClassroom[];
  teacherRecord?: TTeacher;
  allowedClassroomIds: string[];
  allowedClassroomNames: string[];
  allowedCourseIds: string[];
  configured: boolean;
  reason?: string;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("tr-TR");
const compact = (value: unknown) => normalize(value).replace(/\s+/g, "").replace(/[^a-z0-9çğıöşü@.-]/g, "");
const values = (item: Record<string, any>, keys: string[]) => keys.map((key) => item?.[key]).filter(Boolean);

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

function matchesCurrentTeacher(user: PanelUser | undefined, teacher: Record<string, any>) {
  if (!user) return false;
  const userIds = unique([user.id, user.email, user.username, user.fullName].map(compact));
  const teacherIds = unique(values(teacher, ["id", "userId", "firebaseUid", "email", "username", "name", "fullName"]).map(compact));
  return userIds.some((candidate) => candidate && teacherIds.includes(candidate));
}

function classroomIdentity(classroom: Record<string, any>) {
  return {
    id: String(classroom?.id || classroom?.classId || classroom?.classroomId || "").trim(),
    name: String(classroom?.name || classroom?.classroom || classroom?.className || "").trim(),
  };
}

function courseBelongsToTeacher(course: Record<string, any>, teacher: Record<string, any> | undefined, user: PanelUser | undefined) {
  if (!teacher && !user) return false;
  const ownerValues = unique([
    teacher?.id,
    teacher?.name,
    teacher?.email,
    user?.id,
    user?.fullName,
    user?.email,
    user?.username,
  ].map(compact));
  const courseTeacherValues = unique(values(course, ["teacherId", "teacherId2", "teacherName", "teacherName2", "teacher", "teacherEmail"]).map(compact));
  return ownerValues.some((candidate) => candidate && courseTeacherValues.includes(candidate));
}

function classroomBelongsToCounselor(classroom: Record<string, any>, teacher: Record<string, any> | undefined, user: PanelUser | undefined) {
  const ownerValues = unique([
    teacher?.id,
    teacher?.name,
    teacher?.email,
    user?.id,
    user?.fullName,
    user?.email,
    user?.username,
  ].map(compact));
  const counselorValues = unique(values(classroom, [
    "counselorTeacherId",
    "counselorTeacherName",
    "advisorTeacherId",
    "advisorTeacherName",
    "guidanceTeacherId",
    "guidanceTeacherName",
    "classTeacherId",
    "classTeacherName",
  ]).map(compact));
  return ownerValues.some((candidate) => candidate && counselorValues.includes(candidate));
}

export function buildRoleDataScope<TStudent extends Record<string, any>, TTeacher extends Record<string, any>, TCourse extends Record<string, any>, TClassroom extends Record<string, any>>({
  user,
  role,
  students,
  teachers,
  courses,
  classrooms,
}: {
  user?: PanelUser;
  role: CloudRole;
  students: TStudent[];
  teachers: TTeacher[];
  courses: TCourse[];
  classrooms: TClassroom[];
}): ScopedDataResult<TStudent, TTeacher, TCourse, TClassroom> {
  if (role === "super_admin" || role === "principal" || role === "assistant_principal") {
    return {
      students,
      teachers,
      courses,
      classrooms,
      allowedClassroomIds: classrooms.map((item) => classroomIdentity(item).id).filter(Boolean),
      allowedClassroomNames: classrooms.map((item) => classroomIdentity(item).name).filter(Boolean),
      allowedCourseIds: courses.map((item) => String(item?.id || "")).filter(Boolean),
      configured: true,
    };
  }

  const teacherRecord = teachers.find((teacher) => matchesCurrentTeacher(user, teacher));
  const allowedCourses = role === "teacher"
    ? courses.filter((course) => courseBelongsToTeacher(course, teacherRecord, user))
    : [];

  const courseClassNames = allowedCourses.map((course) => String(course?.classroom || course?.className || "").trim()).filter(Boolean);
  const courseClassIds = allowedCourses.map((course) => String(course?.classroomId || course?.classId || "").trim()).filter(Boolean);

  const allowedClassrooms = classrooms.filter((classroom) => {
    const identity = classroomIdentity(classroom);
    if (role === "counselor") return classroomBelongsToCounselor(classroom, teacherRecord, user);
    if (courseClassIds.includes(identity.id) || courseClassNames.map(normalize).includes(normalize(identity.name))) return true;
    const assignedCourses = Array.isArray(classroom?.assignedCourses) ? classroom.assignedCourses : [];
    return assignedCourses.some((course: Record<string, any>) => courseBelongsToTeacher(course, teacherRecord, user));
  });

  const allowedClassroomIds = unique(allowedClassrooms.map((item) => classroomIdentity(item).id).concat(courseClassIds));
  const allowedClassroomNames = unique(allowedClassrooms.map((item) => classroomIdentity(item).name).concat(courseClassNames));
  const allowedClassroomNamesNormalized = allowedClassroomNames.map(normalize);

  const scopedStudents = students.filter((student) => {
    const classId = String(student?.classroomId || student?.classId || "").trim();
    const className = String(student?.classroom || student?.className || student?.branch || "").trim();
    return (classId && allowedClassroomIds.includes(classId)) || (className && allowedClassroomNamesNormalized.includes(normalize(className)));
  });

  const scopedCourses = role === "teacher"
    ? allowedCourses
    : courses.filter((course) => {
        const classId = String(course?.classroomId || course?.classId || "").trim();
        const className = String(course?.classroom || course?.className || "").trim();
        return (classId && allowedClassroomIds.includes(classId)) || (className && allowedClassroomNamesNormalized.includes(normalize(className)));
      });

  const configured = Boolean(teacherRecord) && allowedClassrooms.length > 0;
  return {
    students: scopedStudents,
    teachers: teacherRecord ? [teacherRecord] : [],
    courses: scopedCourses,
    classrooms: allowedClassrooms,
    teacherRecord,
    allowedClassroomIds,
    allowedClassroomNames,
    allowedCourseIds: scopedCourses.map((item) => String(item?.id || "")).filter(Boolean),
    configured,
    reason: configured
      ? undefined
      : role === "counselor"
        ? "Kullanıcı hesabı bir öğretmen kaydı ve rehberlik sınıfıyla eşleştirilmemiş."
        : "Kullanıcı hesabı öğretmen kaydı veya ders atamalarıyla eşleştirilmemiş.",
  };
}
