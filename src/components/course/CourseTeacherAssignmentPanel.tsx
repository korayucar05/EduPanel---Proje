import React, { useEffect, useMemo, useState } from "react";
import { Check, UserRound } from "lucide-react";
import type { Classroom, Course, Teacher } from "../../types";
import { courseService } from "../../modules/course";
import { compareClassrooms } from "../../utils/classroomSort";

interface Props {
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  courses: Course[];
  customCreatedCourses: any[];
  teachers: Teacher[];
  notify: (message: string) => void;
}

const normalize = (value: unknown) =>
  String(value || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

const isArtEducationCourseName = (value: unknown) => {
  const key = normalize(value)
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  return key === "SANAT TARIHI" || key.startsWith("SANAT EGITIMI");
};

const isElective = (item: any) =>
  String(item?.type || "").toLocaleLowerCase("tr-TR").includes("seçmeli");

const isHtElective = (item: any) =>
  isElective(item) && normalize(item?.courseName || "").startsWith("HT");

const sortAssigned = (a: any, b: any) => {
  const rank = (item: any) => (isHtElective(item) ? 2 : isElective(item) ? 1 : 0);
  return rank(a) - rank(b) ||
    String(a?.courseName || "").localeCompare(String(b?.courseName || ""), "tr-TR");
};


type TeacherHourDetail = { className: string; courseName: string; hours: number };

const classIdentityKey = (classroom: any) => {
  const level = normalize(classroom?.level || classroom?.gradeLevel || "");
  const raw = String(classroom?.name || "").trim();
  const grade = raw.match(/\b(9|10|11|12)\b/)?.[1] || "";
  const branch = raw
    .replace(/\b(9|10|11|12)\b/g, "")
    .replace(/SINIFI|SINIF|ŞUBE|SUBE/gi, "")
    .replace(/[-_/().\s]/g, "")
    .trim();
  return `${level || grade}|${normalize(branch || raw)}`;
};

const courseIdentityKey = (course: any) =>
  normalize(course?.courseId || course?.courseName || "")
    .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL|ORTAK)\)\s*$/i, "");

const buildTeacherHourSummary = (classrooms: Classroom[], teacherId: string) => {
  const details: TeacherHourDetail[] = [];
  const counted = new Set<string>();
  for (const classroom of classrooms || []) {
    for (const course of classroom.assignedCourses || []) {
      const assigned =
        String(course?.teacherId || "") === String(teacherId) ||
        String(course?.teacherId2 || "") === String(teacherId);
      if (!assigned) continue;
      const hours = Math.max(0, Number(course?.weeklyHours) || 0);
      if (!hours) continue;

      // Aynı düzey + aynı şube kimliğindeki ortak ders iki paralel sınıfta
      // aynı öğretmene atanmışsa öğretmen yükünde yalnız bir kez say.
      const key = `${classIdentityKey(classroom)}|${courseIdentityKey(course)}`;
      if (counted.has(key)) continue;
      counted.add(key);
      details.push({
        className: String(classroom.name || "Sınıf"),
        courseName: String(course.courseName || "Ders"),
        hours,
      });
    }
  }
  return { total: details.reduce((s, d) => s + d.hours, 0), details };
};

const isCommonAssignedCourse = (course: any) => {
  if (!course) return false;
  if (String(course?.splitGroupId || "").trim()) return false;
  if (course?.isCommonElective === true) return true;
  if (Array.isArray(course?.targetGroups) && course.targetGroups.some((g: any) => normalize(g) === "ORTAK")) {
    return true;
  }
  // Grup adı yoksa ders sınıfın ortak dersi kabul edilir.
  return !String(course?.groupName || "").trim();
};

const shouldMirrorCommonCourseAssignment = (
  sourceClass: any,
  targetClass: any,
  sourceCourse: any,
  targetCourse: any,
) =>
  sourceClass?.id !== targetClass?.id &&
  classIdentityKey(sourceClass) === classIdentityKey(targetClass) &&
  courseIdentityKey(sourceCourse) === courseIdentityKey(targetCourse) &&
  isCommonAssignedCourse(sourceCourse) &&
  isCommonAssignedCourse(targetCourse);


export default function CourseTeacherAssignmentPanel({
  classrooms,
  setClassrooms,
  courses,
  customCreatedCourses,
  teachers,
  notify,
}: Props) {
  const sortedClasses = useMemo(() => [...classrooms].sort(compareClassrooms), [classrooms]);
  const [classId, setClassId] = useState(() => sortedClasses[0]?.id || "");
  const [courseName, setCourseName] = useState("");
  const [saving, setSaving] = useState(false);
  const [teacherAssignmentMode, setTeacherAssignmentMode] = useState<1 | 2>(1);
  const [openTeacherHoursId, setOpenTeacherHoursId] = useState<string | null>(null);

  const classroom = classrooms.find((item) => item.id === classId) || sortedClasses[0] || null;
  const assignedCourses = useMemo(
    () => [...(classroom?.assignedCourses || [])].sort(sortAssigned),
    [classroom],
  );

  const selectedCourse =
    assignedCourses.find((item: any) => normalize(item.courseName) === normalize(courseName)) ||
    assignedCourses[0] ||
    null;

  const selectedDefinition = useMemo(() => {
    if (!selectedCourse) return null;

    const key = normalize(selectedCourse.courseName);

    return (
      customCreatedCourses.find(
        (item: any) => normalize(item?.courseName || item?.name) === key,
      ) ||
      courses.find((item: any) => normalize(item?.name) === key) ||
      null
    );
  }, [selectedCourse, customCreatedCourses, courses]);
  const unassignTeacher = async (teacher: Teacher) => {
    if (!classroom || !selectedCourse || saving) return;

    const previous = classrooms;
    const currentFirstId = String(selectedCourse.teacherId || "");
    const currentSecondId = String(selectedCourse.teacherId2 || "");

    if (String(teacher.id) !== currentFirstId && String(teacher.id) !== currentSecondId) {
      return;
    }

    let nextTeacherId = currentFirstId;
    let nextTeacherName = String(selectedCourse.teacherName || "");
    let nextTeacherId2 = currentSecondId;
    let nextTeacherName2 = String(selectedCourse.teacherName2 || "");

    if (String(teacher.id) === currentFirstId) {
      nextTeacherId = currentSecondId;
      nextTeacherName = String(selectedCourse.teacherName2 || "");
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else {
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    }

    const next = classrooms.map((item) => {
      const isSourceClass = item.id === classroom.id;
      const hasMirroredCommonCourse = !isSourceClass && (item.assignedCourses || []).some(
        (course: any) =>
          shouldMirrorCommonCourseAssignment(
            classroom,
            item,
            selectedCourse,
            course,
          ),
      );

      if (!isSourceClass && !hasMirroredCommonCourse) return item;

      return {
        ...item,
        assignedCourses: (item.assignedCourses || []).map((course: any) => {
          const shouldUpdate = isSourceClass
            ? courseIdentityKey(course) === courseIdentityKey(selectedCourse)
            : shouldMirrorCommonCourseAssignment(
                classroom,
                item,
                selectedCourse,
                course,
              );

          return shouldUpdate
            ? {
                ...course,
                teacherId: nextTeacherId || undefined,
                teacherName: nextTeacherName || undefined,
                teacherId2: nextTeacherId2 || undefined,
                teacherName2: nextTeacherName2 || undefined,
                teacherAssignmentCleared: !(nextTeacherId || nextTeacherId2),
              }
            : course;
        }),
      };
    });

    setClassrooms(next);
    setSaving(true);
    try {
      await courseService.commitAcademicCatalog({
        classrooms: next,
        courses,
        customCreatedCourses,
      });
      notify(`${teacher.name} → ${classroom.name} / ${selectedCourse.courseName} ataması kaldırıldı`);
    } catch (error) {
      setClassrooms(previous);
      notify(
        `Öğretmen ataması kaldırılamadı: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };


  const courseBranch = isArtEducationCourseName(selectedCourse?.courseName)
    ? ""
    : String(
        selectedCourse?.branch ||
          selectedDefinition?.branch ||
          selectedDefinition?.courseBranch ||
          "",
      ).trim();

  useEffect(() => {
    // Sanat Eğitimi (Müze) / Sanat Eğitimi (Drama) iki öğretmenle yürütülebilir.
    setTeacherAssignmentMode(
      selectedCourse?.teacherId2 || isArtEducationCourseName(selectedCourse?.courseName) ? 2 : 1,
    );
  }, [classId, courseName, selectedCourse?.teacherId2]);


  const branchTeachers = useMemo(() => {
    if (!selectedCourse) return [];
    const branchKey = normalize(courseBranch);
    const courseKey = normalize(selectedCourse.courseName);
    const shouldShowAllTeachers =
      courseKey === "REHBERLİK VE YÖNLENDİRME" ||
      courseKey === "REHBERLİK VE YÖNLENDIRME" ||
      isArtEducationCourseName(selectedCourse.courseName) ||
      branchKey === "ÖĞRETMEN";

    const candidates = shouldShowAllTeachers
      ? [...teachers]
      : teachers.filter((teacher: any) => {
          // Müdür / müdür yardımcısı gibi idari görevler branş öğretmenliğini engellemez.
          if (!branchKey) return true;
          return normalize(teacher?.branch) === branchKey;
        });

    return candidates.sort((a, b) => String(a.name).localeCompare(String(b.name), "tr-TR"));
  }, [teachers, courseBranch, selectedCourse]);

  const selectClass = (nextId: string) => {
    setClassId(nextId);
    const nextClass = classrooms.find((item) => item.id === nextId);
    setCourseName(nextClass?.assignedCourses?.[0]?.courseName || "");
  };

  const assignTeacher = async (teacher: Teacher) => {
    if (!classroom || !selectedCourse || saving) return;

    const previous = classrooms;
    const currentFirstId = String(selectedCourse.teacherId || "");
    const currentSecondId = String(selectedCourse.teacherId2 || "");

    let nextTeacherId = currentFirstId;
    let nextTeacherName = String(selectedCourse.teacherName || "");
    let nextTeacherId2 = currentSecondId;
    let nextTeacherName2 = String(selectedCourse.teacherName2 || "");

    if (teacherAssignmentMode === 1) {
      nextTeacherId = teacher.id;
      nextTeacherName = teacher.name;
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (String(teacher.id) === currentFirstId) {
      nextTeacherId = currentSecondId;
      nextTeacherName = String(selectedCourse.teacherName2 || "");
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (String(teacher.id) === currentSecondId) {
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (!currentFirstId) {
      nextTeacherId = teacher.id;
      nextTeacherName = teacher.name;
    } else {
      nextTeacherId2 = teacher.id;
      nextTeacherName2 = teacher.name;
    }

    const next = classrooms.map((item) => {
      const isSourceClass = item.id === classroom.id;
      const hasMirroredCommonCourse = !isSourceClass && (item.assignedCourses || []).some(
        (course: any) =>
          shouldMirrorCommonCourseAssignment(
            classroom,
            item,
            selectedCourse,
            course,
          ),
      );

      if (!isSourceClass && !hasMirroredCommonCourse) return item;

      return {
        ...item,
        assignedCourses: (item.assignedCourses || []).map((course: any) => {
          const shouldUpdate = isSourceClass
            ? courseIdentityKey(course) === courseIdentityKey(selectedCourse)
            : shouldMirrorCommonCourseAssignment(
                classroom,
                item,
                selectedCourse,
                course,
              );

          return shouldUpdate
            ? {
                ...course,
                teacherId: nextTeacherId || undefined,
                teacherName: nextTeacherName || undefined,
                teacherId2: nextTeacherId2 || undefined,
                teacherName2: nextTeacherName2 || undefined,
                teacherAssignmentCleared: !(nextTeacherId || nextTeacherId2),
              }
            : course;
        }),
      };
    });

    setClassrooms(next);
    setSaving(true);
    try {
      await courseService.commitAcademicCatalog({
        classrooms: next,
        courses,
        customCreatedCourses,
      });
      const label =
        teacherAssignmentMode === 2 && nextTeacherId && nextTeacherId2
          ? `${nextTeacherName} + ${nextTeacherName2}`
          : nextTeacherName || nextTeacherName2 || "Öğretmen ataması kaldırıldı";
      notify(`${label} → ${classroom.name} / ${selectedCourse.courseName}`);
    } catch (error) {
      setClassrooms(previous);
      notify(
        `Öğretmen ataması kaydedilemedi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <label className="text-xs font-black text-slate-600">Sınıf</label>
        <select
          value={classroom?.id || ""}
          onChange={(event) => selectClass(event.target.value)}
          className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
        >
          {sortedClasses.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {classroom && (
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700">
            {assignedCourses.length} ders
          </span>
        )}
      </div>

      <div className="grid min-h-[610px] grid-cols-[minmax(500px,1.55fr)_minmax(300px,0.9fr)]">
        <section className="border-r border-slate-200">
          <div className="grid grid-cols-[1fr_1fr] border-b border-slate-200 bg-emerald-50/60 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <div className="px-3 py-2">Ders</div>
            <div className="border-l border-slate-200 px-3 py-2">Atanan Öğretmen</div>
          </div>

          <div className="max-h-[680px] overflow-y-auto">
            {assignedCourses.map((course: any) => {
              const active = normalize(selectedCourse?.courseName) === normalize(course.courseName);
              const ht = isHtElective(course);
              const elective = isElective(course);

              return (
                <button
                  key={`${classroom?.id}-${course.courseName}`}
                  type="button"
                  onClick={() => setCourseName(course.courseName)}
                  className={`grid w-full grid-cols-[1fr_1fr] border-b border-white/80 text-left transition ${
                    active
                      ? "ring-2 ring-inset ring-indigo-400"
                      : ht
                        ? "bg-pink-50 hover:bg-pink-100"
                        : elective
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "bg-emerald-50 hover:bg-emerald-100"
                  }`}
                >
                  <div className="truncate px-3 py-1.5 text-[11px] font-black text-slate-800">
                    {course.courseName}
                  </div>
                  <div className="flex items-center gap-1.5 border-l border-white/90 px-3 py-1.5">
                    {course.teacherId ? (
                      <>
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate text-[10px] font-black text-slate-700">
                          {course.teacherName}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        Öğretmen atanmadı
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {assignedCourses.length === 0 && (
              <div className="p-12 text-center text-xs font-bold text-slate-400">
                Bu sınıfa henüz ders atanmamış.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-indigo-50/60 px-4 py-2">
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900">Branş Öğretmenleri</div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                {selectedCourse
                  ? `${selectedCourse.courseName}${courseBranch ? ` • ${courseBranch}` : ""}`
                  : "Önce bir ders seçiniz"}
              </div>
            </div>
            {selectedCourse && (
              <div className="flex shrink-0 rounded-lg border border-indigo-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setTeacherAssignmentMode(1)}
                  className={`rounded-md px-2 py-1 text-[10px] font-black ${
                    teacherAssignmentMode === 1 ? "bg-indigo-600 text-white" : "text-slate-500"
                  }`}
                >
                  1 Öğretmen
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherAssignmentMode(2)}
                  className={`rounded-md px-2 py-1 text-[10px] font-black ${
                    teacherAssignmentMode === 2 ? "bg-indigo-600 text-white" : "text-slate-500"
                  }`}
                >
                  2 Öğretmen
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[680px] overflow-y-auto p-2">
            {branchTeachers.map((teacher: any) => {
              const isFirstTeacher = selectedCourse?.teacherId === teacher.id;
              const isSecondTeacher = selectedCourse?.teacherId2 === teacher.id;
              const assigned = isFirstTeacher || isSecondTeacher;
              const hourSummary = buildTeacherHourSummary(classrooms, teacher.id);
              const isHoursOpen = openTeacherHoursId === teacher.id;
              return (
                <div key={teacher.id} className="relative mb-1 flex w-full items-stretch gap-1">
                  <button
                    type="button"
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (assigned) {
                        void unassignTeacher(teacher);
                      } else {
                        void assignTeacher(teacher);
                      }
                    }}
                    className={`flex min-w-0 flex-1 items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      assigned ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/60"
                    }`}
                    title={assigned ? "Çift tıklayınca bu öğretmenin ders ataması kaldırılır" : teacherAssignmentMode === 2 ? "Çift tıklayın: 1. / 2. öğretmen olarak atanır" : "Çift tıklayınca seçili derse atanır"}
                  >
                    <div className="min-w-0"><div className="truncate text-[11px] font-black text-slate-800">{teacher.name}</div></div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      {isFirstTeacher && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-black text-white">1</span>}
                      {isSecondTeacher && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-black text-white">2</span>}
                      {assigned && <UserRound className="h-4 w-4 text-indigo-600" />}
                    </div>
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); setOpenTeacherHoursId(isHoursOpen ? null : teacher.id); }} className="min-w-[40px] rounded-xl border border-rose-100 bg-rose-50 px-2 text-center text-[11px] font-black text-rose-600 hover:bg-rose-100" title="Toplam ders saati ve sınıf dağılımı">{hourSummary.total}</button>
                  {isHoursOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2"><span className="truncate text-[11px] font-black text-slate-800">{teacher.name}</span><span className="text-[12px] font-black text-rose-600">{hourSummary.total} saat</span></div>
                      <div className="max-h-56 space-y-1 overflow-y-auto">
                        {hourSummary.details.length === 0 ? <div className="py-3 text-center text-[11px] font-semibold text-slate-400">Henüz ders atanmamış.</div> :
                          hourSummary.details.map((item, index) => (
                            <div key={`${item.className}-${item.courseName}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2">
                              <div className="min-w-0"><div className="truncate text-[11px] font-black text-slate-700">{item.className}</div><div className="truncate text-[10px] font-semibold text-slate-500">{item.courseName}</div></div>
                              <span className="shrink-0 text-[11px] font-black text-rose-600">{item.hours} sa.</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {selectedCourse && branchTeachers.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
                {courseBranch
                  ? `${courseBranch} branşında kayıtlı öğretmen bulunamadı.`
                  : "Bu ders için branş bilgisi bulunamadı."}
              </div>
            )}
          </div>
        </section>
      </div>

      {saving && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-xl">
            Öğretmen ataması kaydediliyor...
          </div>
        </div>
      )}
    </div>
  );
}


