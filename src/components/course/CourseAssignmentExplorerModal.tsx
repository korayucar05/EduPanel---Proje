import React from "react";
import { Check, ChevronDown, Grid2X2, X } from "lucide-react";
import { Classroom, Teacher } from "../../types";
import { compareClassrooms } from "../../utils/classroomSort";

export type AssignmentExplorerSelection = {
  type: "branch" | "teacher" | "course" | "classroom";
  id: string;
  label: string;
};

export type AssignmentExplorerRow = {
  classroomId: string;
  classroomName: string;
  courseName: string;
  weeklyHours: number;
  teacherIds: string[];
  teacherNames: string[];
  isElective: boolean;
};

export type AssignmentExplorerDropdown = {
  type: AssignmentExplorerSelection["type"];
  label: string;
  icon: React.ReactNode;
  options: Array<{ id: string; label: string; group?: string; secondary?: string }>;
};

interface CourseAssignmentExplorerModalProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeMainDropdown: string | null;
  setActiveMainDropdown: React.Dispatch<React.SetStateAction<string | null>>;
  assignmentExplorerDropdowns: AssignmentExplorerDropdown[];
  assignmentExplorerSelection: AssignmentExplorerSelection | null;
  setAssignmentExplorerSelection: React.Dispatch<
    React.SetStateAction<AssignmentExplorerSelection | null>
  >;
  teachers: Teacher[];
  classrooms: Classroom[];
  normalizeReportText: (value: unknown) => string;
  branchCourseAssignments: Record<string, string[]>;
  assignmentReportRows: AssignmentExplorerRow[];
  isSameCourseName: (firstName: string, secondName: string) => boolean;
  isCourseAssignedToAnyBranch: (courseName: string) => boolean;
  selectedBranchTeacherId: string | null;
  setSelectedBranchTeacherId: React.Dispatch<React.SetStateAction<string | null>>;
  getTeacherAssignedHours: (teacher: Teacher) => number;
  getTeacherAssignmentRows: (teacher: Teacher) => AssignmentExplorerRow[];
  isTeacherCourseSaving: boolean;
  toggleTeacherCourseAssignment: (
    teacher: Teacher,
    row: AssignmentExplorerRow,
  ) => void | Promise<void>;
}

export default function CourseAssignmentExplorerModal({
  isOpen,
  setIsOpen,
  activeMainDropdown,
  setActiveMainDropdown,
  assignmentExplorerDropdowns,
  assignmentExplorerSelection,
  setAssignmentExplorerSelection,
  teachers,
  classrooms,
  normalizeReportText,
  branchCourseAssignments,
  assignmentReportRows,
  isSameCourseName,
  isCourseAssignedToAnyBranch,
  selectedBranchTeacherId,
  setSelectedBranchTeacherId,
  getTeacherAssignedHours,
  getTeacherAssignmentRows,
  isTeacherCourseSaving,
  toggleTeacherCourseAssignment,
}: CourseAssignmentExplorerModalProps) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-[260] flex flex-col bg-slate-50 animate-fadeIn">
          <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-amber-950">
                <Grid2X2 className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-black text-slate-900">Sınıf / Ders / Öğretmen Seçimi</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Aynı anda yalnızca bir başlıktan seçim yapılabilir.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveMainDropdown(null);
                setIsOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Pencereyi kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-8">
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-2 gap-4">
                {assignmentExplorerDropdowns.map((dropdown) => {
                  const isOpen = activeMainDropdown === dropdown.type;
                  const selected =
                    assignmentExplorerSelection?.type === dropdown.type
                      ? assignmentExplorerSelection
                      : null;

                  return (
                    <div key={dropdown.type} className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentExplorerSelection(null);
                          setActiveMainDropdown(isOpen ? null : dropdown.type);
                        }}
                        className={`flex h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left text-sm font-black transition ${
                          isOpen || selected
                            ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                        aria-expanded={isOpen}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {dropdown.icon}
                          <span className="truncate">{selected?.label || dropdown.label}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[55vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                          {dropdown.options.length > 0 ? (
                            dropdown.options.map((option, optionIndex) => {
                              const previousGroup = dropdown.options[optionIndex - 1]?.group;
                              return (
                                <React.Fragment key={option.id}>
                                  {option.group && option.group !== previousGroup && (
                                    <div className="sticky top-0 z-10 mt-1 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                      {option.group}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                    setAssignmentExplorerSelection({
                                      type: dropdown.type,
                                      id: option.id,
                                      label: option.label,
                                    });
                                    setSelectedBranchTeacherId(null);
                                    setActiveMainDropdown(null);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-800"
                                  >
                                    <span>{option.label}</span>
                                    {option.secondary && (
                                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">
                                        {option.secondary}
                                      </span>
                                    )}
                                  </button>
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                              Kayıt bulunamadı
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8">
                {!assignmentExplorerSelection && (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="text-sm font-bold text-slate-500">
                      Yukarıdaki açılır butonlardan birini kullanarak seçim yapın.
                    </p>
                  </div>
                )}

                {assignmentExplorerSelection?.type === "branch" && (() => {
                  const branchTeachers = teachers
                    .filter(
                      (teacher) =>
                        normalizeReportText(teacher.branch) ===
                        normalizeReportText(assignmentExplorerSelection.id),
                    )
                    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
                  const configuredCourses =
                    branchCourseAssignments[assignmentExplorerSelection.id] || [];
                  const branchCourseRows = assignmentReportRows.filter((row) =>
                    configuredCourses.some((courseName) =>
                      isSameCourseName(courseName, row.courseName),
                    ),
                  );
                  const assignedCourseHours = branchCourseRows.reduce(
                    (total, row) => total + row.weeklyHours,
                    0,
                  );
                  const distributedCourseHours = branchCourseRows
                    .filter((row) => row.teacherNames.length > 0)
                    .reduce((total, row) => total + row.weeklyHours, 0);
                  const remainingCourseHours = Math.max(
                    assignedCourseHours - distributedCourseHours,
                    0,
                  );
                  const selectedTeacher = branchTeachers.find(
                    (teacher) => teacher.id === selectedBranchTeacherId,
                  );
                  const selectableRows = selectedTeacher
                    ? assignmentReportRows
                        .filter((row) => {
                          const allowedForBranch = configuredCourses.some((courseName) =>
                            isSameCourseName(courseName, row.courseName),
                          );
                          const hasNoBranch = !isCourseAssignedToAnyBranch(row.courseName);
                          if (!allowedForBranch && !hasNoBranch) return false;

                          const assignedToSelectedTeacher =
                            row.teacherIds.includes(selectedTeacher.id) ||
                            row.teacherNames.some(
                              (teacherName) =>
                                normalizeReportText(teacherName) ===
                                normalizeReportText(selectedTeacher.name),
                            );
                          return row.teacherNames.length === 0 || assignedToSelectedTeacher;
                        })
                        .sort(
                          (a, b) =>
                            compareClassrooms(
                              { id: a.classroomId, name: a.classroomName, level: "" },
                              { id: b.classroomId, name: b.classroomName, level: "" },
                            ) || a.courseName.localeCompare(b.courseName, "tr"),
                        )
                    : [];

                  return (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                      <div className="bg-indigo-950 px-6 py-5 text-white">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Branş</p>
                          <h4 className="mt-1 text-2xl font-black">{assignmentExplorerSelection.label}</h4>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {configuredCourses.map((courseName) => (
                              <span
                                key={courseName}
                                className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-indigo-100"
                              >
                                {courseName}
                              </span>
                            ))}
                            {configuredCourses.length === 0 && (
                              <span className="text-xs font-bold text-indigo-300">
                                Bu branşa henüz ders tanımlanmamış.
                              </span>
                            )}
                          </div>
                        </div>
                          <div className="grid shrink-0 grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-white/10 px-5 py-3 text-center">
                              <p className="text-[10px] font-black uppercase text-indigo-200">Sınıflara atanan</p>
                              <p className="mt-1 text-2xl font-black">{assignedCourseHours} saat</p>
                            </div>
                            <div className="rounded-2xl bg-emerald-400 px-5 py-3 text-center text-emerald-950">
                              <p className="text-[10px] font-black uppercase">Dağıtılan</p>
                              <p className="mt-1 text-2xl font-black">{distributedCourseHours} saat</p>
                            </div>
                            <div className="rounded-2xl bg-amber-400 px-5 py-3 text-center text-amber-950">
                              <p className="text-[10px] font-black uppercase">Kalan</p>
                              <p className="mt-1 text-2xl font-black">{remainingCourseHours} saat</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {branchTeachers.length > 0 ? (
                        <div
                          className="grid min-h-[430px] divide-x divide-slate-200"
                          style={{
                            gridTemplateColumns: `repeat(${branchTeachers.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {branchTeachers.map((teacher) => {
                            const rows = branchCourseRows
                              .filter(
                                (row) =>
                                  row.teacherIds.includes(teacher.id) ||
                                  row.teacherNames.some(
                                    (teacherName) =>
                                      normalizeReportText(teacherName) ===
                                      normalizeReportText(teacher.name),
                                  ),
                              )
                              .sort(
                                (a, b) =>
                                  compareClassrooms(
                                    { id: a.classroomId, name: a.classroomName, level: "" },
                                    { id: b.classroomId, name: b.classroomName, level: "" },
                                  ) || a.courseName.localeCompare(b.courseName, "tr"),
                              );
                            const totalHours = rows.reduce(
                              (total, row) => total + row.weeklyHours,
                              0,
                            );
                            return (
                              <article key={teacher.id} className="min-w-0 bg-white">
                                <div className={`border-b px-4 py-5 text-center transition ${
                                  selectedBranchTeacherId === teacher.id
                                    ? "border-indigo-400 bg-indigo-600 text-white"
                                    : "border-slate-200 bg-indigo-50"
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedBranchTeacherId((current) =>
                                        current === teacher.id ? null : teacher.id,
                                      )
                                    }
                                    className={`break-words text-base font-black underline-offset-4 hover:underline ${
                                      selectedBranchTeacherId === teacher.id
                                        ? "text-white"
                                        : "text-indigo-950"
                                    }`}
                                  >
                                    {teacher.name}
                                  </button>
                                  <span className="mt-3 inline-flex rounded-2xl bg-amber-400 px-4 py-2 text-lg font-black text-amber-950">
                                    Toplam {totalHours} saat
                                  </span>
                                </div>
                                {rows.length > 0 ? (
                                  <div className="divide-y divide-slate-100">
                                    {rows.map((row, index) => (
                                      <div
                                        key={`${row.classroomId}-${row.courseName}-${index}`}
                                        className="px-4 py-4"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="break-words text-sm font-black text-slate-800">
                                            {row.classroomName}
                                          </span>
                                          <span className="shrink-0 rounded-xl bg-indigo-100 px-2.5 py-1 text-sm font-black text-indigo-800">
                                            {row.weeklyHours} saat
                                          </span>
                                        </div>
                                        <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                                          {row.courseName}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                                    Atanmış ders bulunmuyor.
                                  </p>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-10 text-center text-sm font-bold text-slate-400">
                          Bu branşta kayıtlı öğretmen bulunmuyor.
                        </div>
                      )}

                      {selectedTeacher && (
                        <section className="border-t-4 border-indigo-600 bg-slate-50 p-5">
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-indigo-500">
                                Çoklu ders atama
                              </p>
                              <h5 className="mt-1 text-xl font-black text-slate-900">
                                {selectedTeacher.name}
                              </h5>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                İşaretlenen dersler öğretmene atanır. İşareti kaldırılan ders yeniden boşta kalır.
                              </p>
                            </div>
                            <span className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-black text-amber-950">
                              {getTeacherAssignedHours(selectedTeacher)} saat toplam
                            </span>
                          </div>

                          {selectableRows.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {selectableRows.map((row, index) => {
                                const checked =
                                  row.teacherIds.includes(selectedTeacher.id) ||
                                  row.teacherNames.some(
                                    (teacherName) =>
                                      normalizeReportText(teacherName) ===
                                      normalizeReportText(selectedTeacher.name),
                                  );
                                const hasNoBranch = !isCourseAssignedToAnyBranch(row.courseName);
                                return (
                                  <button
                                    key={`${row.classroomId}-${row.courseName}-${index}`}
                                    type="button"
                                    disabled={isTeacherCourseSaving}
                                    aria-pressed={checked}
                                    onClick={() =>
                                      void toggleTeacherCourseAssignment(selectedTeacher, row)
                                    }
                                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                                      checked
                                        ? "border-emerald-500 bg-emerald-50"
                                        : hasNoBranch
                                          ? "border-rose-300 bg-rose-50 hover:border-rose-500"
                                          : "border-slate-200 bg-white hover:border-indigo-400"
                                    }`}
                                  >
                                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                                      checked
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-slate-300 bg-white text-transparent"
                                    }`}>
                                      <Check className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block break-words text-sm font-black text-slate-900">
                                        {row.courseName}
                                      </span>
                                      <span className="mt-2 flex items-center justify-between gap-2">
                                        <span className="font-black text-indigo-800">{row.classroomName}</span>
                                        <span className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">
                                          {row.weeklyHours} saat
                                        </span>
                                      </span>
                                      {hasNoBranch && (
                                        <span className="mt-2 block text-[10px] font-black uppercase text-rose-600">
                                          Hiçbir branşa tanımlanmamış
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-400">
                              Bu öğretmen için atanabilir veya kaldırılabilir ders bulunmuyor.
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                  );
                })()}

                {assignmentExplorerSelection?.type === "teacher" && (() => {
                  const teacher = teachers.find((item) => item.id === assignmentExplorerSelection.id);
                  if (!teacher) return null;
                  const rows = getTeacherAssignmentRows(teacher).sort(
                    (a, b) =>
                      compareClassrooms(
                        { id: a.classroomId, name: a.classroomName, level: "" },
                        { id: b.classroomId, name: b.classroomName, level: "" },
                      ) || a.courseName.localeCompare(b.courseName, "tr"),
                  );
                  const totalHours = rows.reduce((total, row) => total + row.weeklyHours, 0);
                  return (
                    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between bg-indigo-950 px-6 py-5 text-white">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-indigo-200">{teacher.branch}</p>
                          <h4 className="mt-1 text-2xl font-black">{teacher.name}</h4>
                        </div>
                        <div className="rounded-2xl bg-amber-400 px-6 py-3 text-center text-amber-950">
                          <p className="text-[11px] font-black uppercase">Toplam ders</p>
                          <p className="text-3xl font-black">{totalHours} saat</p>
                        </div>
                      </div>
                      {rows.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-indigo-50 text-left text-xs font-black uppercase text-indigo-800">
                            <tr><th className="px-6 py-3">Sınıf</th><th className="px-6 py-3">Ders</th><th className="px-6 py-3 text-right">Haftalık saat</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((row, index) => (
                              <tr key={`${row.classroomId}-${row.courseName}-${index}`}>
                                <td className="px-6 py-3 font-black text-slate-800">{row.classroomName}</td>
                                <td className="px-6 py-3 font-semibold text-slate-700">{row.courseName}</td>
                                <td className="px-6 py-3 text-right text-base font-black text-indigo-700">{row.weeklyHours}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-8 text-center text-sm font-bold text-slate-400">Atanmış ders bulunmuyor.</p>
                      )}
                    </section>
                  );
                })()}

                {assignmentExplorerSelection?.type === "course" && (() => {
                  const rows = assignmentReportRows.filter(
                    (row) =>
                      normalizeReportText(row.courseName) ===
                      normalizeReportText(assignmentExplorerSelection.id),
                  );
                  const teacherColumns = [...new Set(rows.flatMap((row) => row.teacherNames))]
                    .sort((a, b) => a.localeCompare(b, "tr"))
                    .map((teacherName) => {
                      const classroomHours = new Map<string, number>();
                      rows
                        .filter((row) => row.teacherNames.includes(teacherName))
                        .forEach((row) => {
                          classroomHours.set(
                            row.classroomName,
                            (classroomHours.get(row.classroomName) || 0) + row.weeklyHours,
                          );
                        });
                      return {
                        teacherName,
                        totalHours: [...classroomHours.values()].reduce(
                          (total, hours) => total + hours,
                          0,
                        ),
                        classrooms: [...classroomHours.entries()]
                          .map(([classroomName, weeklyHours]) => {
                            const classroom = classrooms.find(
                              (item) =>
                                normalizeReportText(item.name) ===
                                normalizeReportText(classroomName),
                            );
                            return {
                              classroomId: classroom?.id || classroomName,
                              classroomName,
                              weeklyHours,
                            };
                          })
                          .sort((a, b) =>
                            compareClassrooms(
                              { id: a.classroomId, name: a.classroomName, level: "" },
                              { id: b.classroomId, name: b.classroomName, level: "" },
                            ),
                          ),
                      };
                    });
                  return (
                    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <div className="bg-indigo-950 px-6 py-5 text-white">
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Ders</p>
                        <h4 className="mt-1 text-2xl font-black">{assignmentExplorerSelection.label}</h4>
                      </div>
                      {teacherColumns.length > 0 ? (
                        <div
                          className="grid min-h-[420px] divide-x divide-slate-200"
                          style={{
                            gridTemplateColumns: `repeat(${teacherColumns.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {teacherColumns.map((teacherColumn) => (
                            <article key={teacherColumn.teacherName} className="min-w-0 bg-white">
                              <div className="border-b border-slate-200 bg-indigo-50 px-4 py-5 text-center">
                                <h5 className="break-words text-base font-black text-indigo-950">
                                  {teacherColumn.teacherName}
                                </h5>
                                <div className="mx-auto mt-3 inline-flex rounded-2xl bg-amber-400 px-4 py-2 text-amber-950 shadow-sm">
                                  <span className="text-xl font-black">
                                    Toplam {teacherColumn.totalHours} saat
                                  </span>
                                </div>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {teacherColumn.classrooms.map((classroom) => (
                                  <div
                                    key={classroom.classroomId}
                                    className="flex items-center justify-between gap-2 px-4 py-4"
                                  >
                                    <span className="break-words text-sm font-black text-slate-800">
                                      {classroom.classroomName}
                                    </span>
                                    <span className="shrink-0 rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-black text-indigo-800">
                                      {classroom.weeklyHours} saat
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="p-10 text-center text-sm font-bold text-slate-400">
                          Bu derse atanmış öğretmen bulunmuyor.
                        </div>
                      )}
                    </section>
                  );
                })()}

                {assignmentExplorerSelection?.type === "classroom" && (() => {
                  const rows = assignmentReportRows
                    .filter((row) => row.classroomId === assignmentExplorerSelection.id)
                    .sort(
                      (a, b) =>
                        Number(a.isElective) - Number(b.isElective) ||
                        a.courseName.localeCompare(b.courseName, "tr"),
                    );
                  return (
                    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <div className="bg-indigo-950 px-6 py-5 text-white">
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Sınıf</p>
                        <h4 className="mt-1 text-2xl font-black">{assignmentExplorerSelection.label}</h4>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-indigo-50 text-left text-xs font-black uppercase text-indigo-800">
                          <tr><th className="px-6 py-3">Ders türü</th><th className="px-6 py-3">Ders</th><th className="px-6 py-3">Öğretmen</th><th className="px-6 py-3 text-right">Saat</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row, index) => (
                            <tr key={`${row.courseName}-${index}`}>
                              <td className="px-6 py-3">
                                <span className={`rounded-full px-3 py-1 text-[11px] font-black ${row.isElective ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {row.isElective ? "Seçmeli" : "Zorunlu"}
                                </span>
                              </td>
                              <td className="px-6 py-3 font-black text-slate-800">{row.courseName}</td>
                              <td className="px-6 py-3 font-semibold text-slate-700">{row.teacherNames.join(" / ")}</td>
                              <td className="px-6 py-3 text-right text-base font-black text-indigo-700">{row.weeklyHours}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
  );
}

