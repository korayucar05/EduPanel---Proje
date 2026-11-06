import React from "react";
import { compareClassrooms } from "../../utils/classroomSort";

const unpack = (props: any) => props;

export function TeacherCourseAssignmentBoard(props: any) {
  const {
    teachers, normalizeReportText, teacherCourseBranch, branchCourseAssignments, assignmentReportRows,
    isSameBranchCourseName, isCourseAssignedToAnyBranch, isSameCourseName, classrooms,
    draggedAssignedCourseKey, setDraggedAssignedCourseKey, toggleTeacherCourseAssignment,
    setDraggedBranchTeacherId, getTeacherAssignedHours, draggedBranchTeacherId, getTeacherCourseRowKey,
    getTeacherAssignmentCourseColor, teacherCourseModalTeacherId, teacherCourseListMode,
    setTeacherCourseListMode, openTeacherCourseSelection, isTeacherCourseSaving, saveTeacherCourseSelections,
    teacherCourseDraftKeys, setTeacherCourseDraftKeys,
  } = unpack(props);
  const renderTeacherCourseAssignmentBoard = () => {
    const branchTeachers = teachers
      .filter(
        (teacher) =>
          normalizeReportText(teacher.branch) === normalizeReportText(teacherCourseBranch),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const configuredCourses = branchCourseAssignments[teacherCourseBranch] || [];
    const branchSpecificRows = assignmentReportRows
      .filter((row) =>
        configuredCourses.some((courseName) =>
          isSameBranchCourseName(courseName, row.courseName),
        ),
      )
      .sort(
        (a, b) =>
          compareClassrooms(
            { id: a.classroomId, name: a.classroomName, level: "" },
            { id: b.classroomId, name: b.classroomName, level: "" },
          ) || a.courseName.localeCompare(b.courseName, "tr"),
      );
    const unassignedBranchRows = assignmentReportRows
      .filter((row) => !isCourseAssignedToAnyBranch(row.courseName))
      .filter(
        (row) =>
          !branchSpecificRows.some(
            (branchRow) =>
              branchRow.classroomId === row.classroomId &&
              isSameCourseName(branchRow.courseName, row.courseName),
          ),
      )
      .sort(
        (a, b) =>
          compareClassrooms(
            { id: a.classroomId, name: a.classroomName, level: "" },
            { id: b.classroomId, name: b.classroomName, level: "" },
          ) || a.courseName.localeCompare(b.courseName, "tr"),
      );
    const branchRows = [...branchSpecificRows, ...unassignedBranchRows];
    const gradeLevels = [
      ...new Set(
        branchRows
          .map(
            (row) =>
              classrooms.find((classroom) => classroom.id === row.classroomId)?.level || "",
          )
          .filter(Boolean),
      ),
    ].sort(
      (a, b) =>
        Number(a.match(/\d+/)?.[0] || 999) - Number(b.match(/\d+/)?.[0] || 999),
    );
    const totalHours = branchRows.reduce((total, row) => total + row.weeklyHours, 0);
    const assignedHours = branchRows
      .filter((row) => row.teacherNames.length > 0)
      .reduce((total, row) => total + row.weeklyHours, 0);
    const courseNames = [...new Set(branchRows.map((row) => row.courseName))].sort(
      (a, b) => a.localeCompare(b, "tr"),
    );

    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div
          className="bg-indigo-950 px-3 py-2 text-white"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (!draggedAssignedCourseKey) return;
            const row = branchRows.find(
              (item) =>
                getTeacherCourseRowKey(item.classroomId, item.courseName) ===
                draggedAssignedCourseKey,
            );
            const assignedTeacher = row
              ? branchTeachers.find((teacher) => row.teacherIds.includes(teacher.id))
              : undefined;
            if (row && assignedTeacher) {
              void toggleTeacherCourseAssignment(assignedTeacher, row);
            }
            setDraggedAssignedCourseKey(null);
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              ["Branştaki toplam ders", totalHours, "bg-white/10 text-white"],
              ["Atanan", assignedHours, "bg-emerald-400 text-emerald-950"],
              ["Atanmayan", Math.max(totalHours - assignedHours, 0), "bg-amber-400 text-amber-950"],
            ].map(([label, hours, color]) => (
              <div key={String(label)} className={`rounded-lg px-2 py-1 text-center ${color}`}>
                <p className="text-[8px] font-black uppercase">{label}</p>
                <p className="text-sm font-black">{hours} saat</p>
              </div>
            ))}
            <span className="ml-1 text-[9px] font-bold text-indigo-200">
              Öğretmeni derse sürükleyin · Atamayı kaldırmak için kartın sağını buraya sürükleyin
            </span>
            <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            {branchTeachers.map((teacher) => (
              <div
                key={teacher.id}
                draggable
                onDragStart={() => {
                  setDraggedBranchTeacherId(teacher.id);
                  setDraggedAssignedCourseKey(null);
                }}
                onDragEnd={() => setDraggedBranchTeacherId(null)}
                className="flex cursor-grab items-center gap-2 rounded-lg bg-white/10 px-2 py-1 active:cursor-grabbing"
              >
                <span className="text-[11px] font-black">{teacher.name}</span>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black text-indigo-950">
                  {getTeacherAssignedHours(teacher)} saat
                </span>
              </div>
            ))}
            </div>
          </div>
        </div>

        {!teacherCourseBranch || gradeLevels.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            {teacherCourseBranch
              ? "Bu branşa bağlı ve sınıflara verilmiş ders bulunmuyor."
              : "Üstteki branş listesinden seçim yapın."}
          </div>
        ) : (
          <div className="overflow-x-auto p-5">
            <div
              className="grid min-w-max items-start gap-4"
              style={{
                gridTemplateColumns: `repeat(${gradeLevels.length}, minmax(280px, 1fr))`,
              }}
            >
              {gradeLevels.map((gradeLevel) => (
                <section
                  key={gradeLevel}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <h3 className="bg-indigo-600 px-4 py-3 text-center text-lg font-black text-white">
                    {gradeLevel}
                  </h3>
                  <div className="space-y-3 p-3">
                    {branchRows
                      .filter(
                        (row) =>
                          classrooms.find(
                            (classroom) => classroom.id === row.classroomId,
                          )?.level === gradeLevel,
                      )
                      .map((row, rowIndex, gradeRows) => {
                        const rowKey = getTeacherCourseRowKey(
                          row.classroomId,
                          row.courseName,
                        );
                        const isUnassignedBranchCourse =
                          !isCourseAssignedToAnyBranch(row.courseName);
                        const startsUnassignedSection =
                          isUnassignedBranchCourse &&
                          (rowIndex === 0 ||
                            isCourseAssignedToAnyBranch(
                              gradeRows[rowIndex - 1]?.courseName || "",
                            ));
                        const assignedTeacher = branchTeachers.find((teacher) =>
                          row.teacherIds.includes(teacher.id),
                        );
                        const courseColor = getTeacherAssignmentCourseColor(
                          row.courseName,
                          courseNames,
                        );
                        return (
                          <React.Fragment key={rowKey}>
                          {startsUnassignedSection && (
                            <div className="pt-2 text-center text-[9px] font-black uppercase tracking-wide text-rose-600">
                              Hiçbir branşa atanmayan dersler
                            </div>
                          )}
                          <article
                            className={`rounded-xl border-2 p-1.5 transition ${courseColor}`}
                          >
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="min-w-0 px-1 py-0.5">
                                <p className="text-[10px] font-black text-slate-700">
                                  {row.classroomName}
                                </p>
                                <p className="truncate text-[11px] font-black text-red-600">
                                  {row.courseName}
                                </p>
                                <p className="text-[10px] font-black text-red-600">
                                  {row.weeklyHours} saat
                                </p>
                              </div>
                              <div
                                draggable={Boolean(assignedTeacher)}
                                onDragStart={() => {
                                  if (!assignedTeacher) return;
                                  setDraggedAssignedCourseKey(rowKey);
                                  setDraggedBranchTeacherId(null);
                                }}
                                onDragEnd={() => setDraggedAssignedCourseKey(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  const teacher = branchTeachers.find(
                                    (item) => item.id === draggedBranchTeacherId,
                                  );
                                  if (teacher && teacher.id !== assignedTeacher?.id) {
                                    void toggleTeacherCourseAssignment(teacher, row);
                                  }
                                  setDraggedBranchTeacherId(null);
                                }}
                                className={`flex min-h-10 items-center justify-center rounded-lg border-2 border-dashed px-2 text-center text-[10px] font-black ${
                                  assignedTeacher
                                    ? "cursor-grab border-emerald-400 bg-emerald-100 text-emerald-800 active:cursor-grabbing"
                                    : "border-slate-300 bg-white/80 text-slate-400"
                                }`}
                              >
                                {assignedTeacher ? "Atandı · Geri sürükle" : "Öğretmeni buraya bırak"}
                              </div>
                            </div>
                          </article>
                          </React.Fragment>
                        );
                      })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };


  return renderTeacherCourseAssignmentBoard();
}

export function SimpleTeacherCourseAssignmentBoard(props: any) {
  const {
    teachers, normalizeReportText, teacherCourseBranch, branchCourseAssignments, assignmentReportRows,
    isSameBranchCourseName, isCourseAssignedToAnyBranch, isSameCourseName, classrooms,
    draggedAssignedCourseKey, setDraggedAssignedCourseKey, toggleTeacherCourseAssignment,
    setDraggedBranchTeacherId, getTeacherAssignedHours, draggedBranchTeacherId, getTeacherCourseRowKey,
    getTeacherAssignmentCourseColor, teacherCourseModalTeacherId, teacherCourseListMode,
    setTeacherCourseListMode, openTeacherCourseSelection, isTeacherCourseSaving, saveTeacherCourseSelections,
    teacherCourseDraftKeys, setTeacherCourseDraftKeys,
  } = unpack(props);
  const renderSimpleTeacherCourseAssignmentBoard = () => {
    const branchTeachers = teachers
      .filter(
        (teacher) =>
          normalizeReportText(teacher.branch) === normalizeReportText(teacherCourseBranch),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const selectedTeacher = branchTeachers.find(
      (teacher) => teacher.id === teacherCourseModalTeacherId,
    );
    const configuredCourses = branchCourseAssignments[teacherCourseBranch] || [];
    const branchRows = assignmentReportRows.filter((row) =>
      configuredCourses.some((courseName) =>
        isSameBranchCourseName(courseName, row.courseName),
      ),
    );
    const noBranchRows = assignmentReportRows.filter(
      (row) => !isCourseAssignedToAnyBranch(row.courseName),
    );
    const selectedModeRows =
      teacherCourseListMode === "branch" ? branchRows : noBranchRows;
    const gradeLevels: string[] = [
      ...new Set<string>(
        selectedModeRows
          .map(
            (row) =>
              String(classrooms.find((classroom) => classroom.id === row.classroomId)?.level || ""),
          )
          .filter((level): level is string => Boolean(level)),
      ),
    ].sort(
      (a, b) =>
        Number(a.match(/\d+/)?.[0] || 999) - Number(b.match(/\d+/)?.[0] || 999),
    );

    const sortRows = (rows: typeof assignmentReportRows) =>
      [...rows].sort(
        (a, b) =>
          a.courseName.localeCompare(b.courseName, "tr") ||
          compareClassrooms(
            { id: a.classroomId, name: a.classroomName, level: "" },
            { id: b.classroomId, name: b.classroomName, level: "" },
          ),
      );

    const getHourSummary = (rows: typeof assignmentReportRows) => {
      const total = rows.reduce((sum, row) => sum + row.weeklyHours, 0);
      const assigned = rows
        .filter((row) => row.teacherNames.length > 0)
        .reduce((sum, row) => sum + row.weeklyHours, 0);
      return { total, assigned, unassigned: Math.max(total - assigned, 0) };
    };
    const branchSummary = getHourSummary(branchRows);
    const noBranchSummary = getHourSummary(noBranchRows);

    const renderRow = (row: (typeof assignmentReportRows)[number]) => {
      const key = getTeacherCourseRowKey(row.classroomId, row.courseName);
      const checked = teacherCourseDraftKeys.includes(key);
      const alreadyAssignedToSelected = Boolean(
        selectedTeacher &&
          (row.teacherIds.includes(selectedTeacher.id) ||
            row.teacherNames.some(
              (name) =>
                normalizeReportText(name) === normalizeReportText(selectedTeacher.name),
            )),
      );
      const assignedToAnotherTeacher =
        row.teacherNames.length > 0 && !alreadyAssignedToSelected;
      return (
        <label
          key={key}
          className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
            alreadyAssignedToSelected
              ? "border-emerald-400 bg-emerald-100"
              : assignedToAnotherTeacher
                ? "pointer-events-none cursor-not-allowed border-amber-300 bg-amber-100 opacity-65"
              : checked
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 bg-white hover:border-indigo-300"
          } ${selectedTeacher ? "" : "pointer-events-none opacity-60"}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-black text-slate-800">
              {row.classroomName} · {row.courseName}
            </span>
            <span className="block truncate text-left text-[10px] font-black text-indigo-700">
              {row.teacherNames.join(" / ")}
            </span>
          </span>
          <span className="shrink-0 text-sm font-black text-rose-600">
            {row.weeklyHours}
          </span>
          <input
            type="checkbox"
            checked={checked}
            disabled={!selectedTeacher || assignedToAnotherTeacher}
            onChange={() =>
              setTeacherCourseDraftKeys((current) =>
                current.includes(key)
                  ? current.filter((item) => item !== key)
                  : [...current, key],
              )
            }
            className="h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
      );
    };

    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
          {branchTeachers.map((teacher) => {
            const selected = teacher.id === selectedTeacher?.id;
            return (
              <button
                key={teacher.id}
                type="button"
                onClick={() => openTeacherCourseSelection(teacher)}
                className={`flex items-center overflow-hidden rounded-xl border-2 transition ${
                  selected
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"
                }`}
              >
                <span className={`border-r px-2 py-2 text-xs font-black ${
                  selected ? "border-white/20 bg-indigo-700" : "border-slate-200 bg-amber-100"
                }`}>
                  {getTeacherAssignedHours(teacher)} saat
                </span>
                <span className="px-3 py-2 text-sm font-black">{teacher.name}</span>
              </button>
            );
          })}
          {selectedTeacher && (
            <button
              type="button"
              disabled={isTeacherCourseSaving}
              onClick={() => void saveTeacherCourseSelections()}
              className="ml-auto rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-60"
            >
              {isTeacherCourseSaving ? "Kaydediliyor..." : "Seçilen Dersleri Kaydet"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-2">
          {[
            {
              mode: "branch" as const,
              label: "Branşa Atanan Dersler",
              summary: branchSummary,
            },
            {
              mode: "unassigned" as const,
              label: "Herhangi Bir Branşa Atanmayan Dersler",
              summary: noBranchSummary,
            },
          ].map((item) => {
            const active = teacherCourseListMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => setTeacherCourseListMode(item.mode)}
                className={`w-full rounded-xl border-2 px-3 py-2 text-center transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300"
                }`}
              >
                <span className="block text-sm font-black">{item.label}</span>
                <span className={`mt-1 flex items-center justify-center gap-3 text-[10px] font-black ${
                  active ? "text-indigo-100" : "text-slate-500"
                }`}>
                  <span>Toplam: {item.summary.total} saat</span>
                  <span>Atanan: {item.summary.assigned} saat</span>
                  <span>Atanmayan: {item.summary.unassigned} saat</span>
                </span>
              </button>
            );
          })}
        </div>

        {!teacherCourseBranch ? (
          <div className="p-10 text-center text-sm font-bold text-slate-400">
            Üst bölümden branş seçin.
          </div>
        ) : gradeLevels.length === 0 ? (
          <div className="p-10 text-center text-sm font-bold text-slate-400">
            Bu branş için atanabilir ders bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto p-3">
            <div
              className="grid min-w-max items-start gap-3"
              style={{
                gridTemplateColumns: `repeat(${gradeLevels.length}, minmax(260px, 1fr))`,
              }}
            >
              {gradeLevels.map((gradeLevel) => {
                const inGrade = (row: (typeof assignmentReportRows)[number]) =>
                  classrooms.find((classroom) => classroom.id === row.classroomId)?.level ===
                  gradeLevel;
                const gradeRows = sortRows(selectedModeRows.filter(inGrade));
                return (
                  <section
                    key={gradeLevel}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <h3 className="bg-indigo-950 px-3 py-2 text-center text-sm font-black text-white">
                      {gradeLevel}
                    </h3>
                    <div className="space-y-1.5 p-2">
                      {gradeRows.map(renderRow)}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };
  return renderSimpleTeacherCourseAssignmentBoard();
}
