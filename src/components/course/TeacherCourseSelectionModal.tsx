import React from "react";
import { Save, X } from "lucide-react";
import { compareClassrooms } from "../../utils/classroomSort";

export default function TeacherCourseSelectionModal(props: any) {
  const {
    teacherCourseModalTeacherId, currentSubTab, teachers, branchCourseAssignments, assignmentReportRows,
    normalizeReportText, isSameCourseName, isSameBranchCourseName, isCourseAssignedToAnyBranch,
    compareClassrooms: compareClassroomsProp,
    teacherCourseDraftKeys, setTeacherCourseDraftKeys, getTeacherCourseRowKey,
    getTeacherAssignmentCourseColor, setTeacherCourseModalTeacherId, isTeacherCourseSaving, saveTeacherCourseSelections,
  } = props;
  if (!teacherCourseModalTeacherId || currentSubTab === "teacher-course-assign") return null;
  const compareRooms = compareClassroomsProp || compareClassrooms;
  const normalizeText =
    typeof normalizeReportText === "function"
      ? normalizeReportText
      : (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
  const sameCourseName =
    typeof isSameCourseName === "function"
      ? isSameCourseName
      : (firstName: string, secondName: string) =>
          normalizeText(firstName) === normalizeText(secondName);

        const teacher = teachers.find((item) => item.id === teacherCourseModalTeacherId);
        if (!teacher) return null;
        const configuredCourses = branchCourseAssignments[teacher.branch] || [];
        const selectable = assignmentReportRows.filter((row) => {
          const assignedToTeacher =
            row.teacherIds.includes(teacher.id) ||
            row.teacherNames.some(
              (teacherName) =>
                normalizeText(teacherName) === normalizeText(teacher.name),
            );
          return row.teacherNames.length === 0 || assignedToTeacher;
        });
        const branchRows = selectable
          .filter((row) =>
            configuredCourses.some((courseName) =>
              sameCourseName(courseName, row.courseName),
            ),
          )
          .sort(
            (a, b) =>
              compareRooms(
                { id: a.classroomId, name: a.classroomName, level: "" },
                { id: b.classroomId, name: b.classroomName, level: "" },
              ) || a.courseName.localeCompare(b.courseName, "tr"),
          );
        const unassignedBranchRows = selectable
          .filter((row) => !isCourseAssignedToAnyBranch(row.courseName))
          .sort(
            (a, b) =>
              compareRooms(
                { id: a.classroomId, name: a.classroomName, level: "" },
                { id: b.classroomId, name: b.classroomName, level: "" },
              ) || a.courseName.localeCompare(b.courseName, "tr"),
          );
        const orderedCourseNames = [
          ...new Set(
            [...branchRows, ...unassignedBranchRows].map((row) => row.courseName),
          ),
        ].sort((a, b) => a.localeCompare(b, "tr"));
        const renderSelectableRow = (
          row: (typeof assignmentReportRows)[number],
          tone: "indigo" | "rose",
        ) => {
          const key = getTeacherCourseRowKey(row.classroomId, row.courseName);
          const checked = teacherCourseDraftKeys.includes(key);
          const courseColor = getTeacherAssignmentCourseColor(
            row.courseName,
            orderedCourseNames,
          );
          return (
            <label
              key={`${tone}-${key}`}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition ${
                checked
                  ? `${courseColor} ring-2 ring-emerald-500 ring-offset-1`
                  : courseColor
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setTeacherCourseDraftKeys((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  )
                }
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-black text-slate-900">
                  {row.courseName}
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-indigo-800">{row.classroomName}</span>
                  <span className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">
                    {row.weeklyHours} saat
                  </span>
                </span>
              </span>
            </label>
          );
        };

        return (
          <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm">
            <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-indigo-950 px-6 py-5 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-indigo-200">
                    {teacher.branch}
                  </p>
                  <h3 className="mt-1 text-xl font-black">{teacher.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherCourseModalTeacherId(null);
                    setTeacherCourseDraftKeys([]);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  aria-label="Pencereyi kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <section>
                  <div className="mb-3">
                    <h4 className="text-base font-black text-indigo-950">
                      Öğretmenin Girebileceği Dersler
                    </h4>
                    <p className="text-xs font-semibold text-slate-500">
                      Branş / Ders İlişkisi ekranında bu branşa tanımlanan dersler.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {branchRows.map((row) => renderSelectableRow(row, "indigo"))}
                    {branchRows.length === 0 && (
                      <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-400">
                        Bu branşa tanımlanmış boş ders bulunmuyor.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <h4 className="text-base font-black text-rose-800">
                      Herhangi Bir Branşa Atanmayan Dersler
                    </h4>
                    <p className="text-xs font-semibold text-slate-500">
                      Tüm öğretmenlerin seçebileceği branşsız dersler.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {unassignedBranchRows.map((row) => renderSelectableRow(row, "rose"))}
                    {unassignedBranchRows.length === 0 && (
                      <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-400">
                        Branşsız boş ders bulunmuyor.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <span className="text-sm font-black text-slate-600">
                  {teacherCourseDraftKeys.length} ders seçili
                </span>
                <button
                  type="button"
                  disabled={isTeacherCourseSaving}
                  onClick={() => void saveTeacherCourseSelections()}
                  className="flex h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-7 text-sm font-black text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isTeacherCourseSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        );

}
