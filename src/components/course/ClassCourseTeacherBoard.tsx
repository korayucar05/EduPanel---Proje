import React from "react";
import { Plus, BookOpen, Trash2, X, CalendarDays, Upload, Search, Check, Lock, Unlock, School, Users, Clock, MapPin, Sparkles } from "lucide-react";

export default function ClassCourseTeacherBoard(props: any) {
  const { classCourses, classForm, classrooms, editingClassId, setTeacherAssignmentModal, setTempTeacherToAssign, setTempTeacherToAssign2, setVoiceFeedback, startSpeechRecognition, totalClassHours } = props;
  return (<>
        <div className="space-y-5">
          {!editingClassId ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
              <School className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <div className="text-sm font-black text-slate-500">Önce bir sınıf seçin</div>
            </div>
          ) : classCourses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-amber-300" />
              <div className="text-sm font-black text-amber-800">Bu sınıfa atanmış ders bulunmuyor.</div>
              <div className="mt-1 text-xs font-semibold text-amber-600">Ders / Sınıf Atama ekranından ders atadığınızda burada otomatik görünecektir.</div>
            </div>
          ) : (
            (() => {
              const selectedClassroom = classrooms.find((classroom) => classroom.id === editingClassId);
              const classGroups = Array.from(
                new Set(
                  (selectedClassroom?.groups || classForm.groups || [])
                    .map((group) => String(group || "").trim().toLocaleUpperCase("tr-TR"))
                    .filter((group) => group && group !== "GENEL" && group !== "ORTAK"),
                ),
              );

              const courseEntries = classCourses.map((course, index) => {
                const explicitGroups = new Set(
                  [
                    ...(course.groupName
                      ? course.groupName.split(",").map((group) => group.trim())
                      : []),
                    ...(course.targetGroups || []),
                  ]
                    .map((group) => String(group || "").trim().toLocaleUpperCase("tr-TR"))
                    .filter((group) => group && group !== "GENEL" && group !== "ORTAK"),
                );

                const isCompulsory =
                  !course.type ||
                  course.type === "Zorunlu Ders" ||
                  course.type === "compulsory";

                const isCommon =
                  isCompulsory ||
                  course.isCommonElective === true ||
                  explicitGroups.size === 0;

                return {
                  course,
                  index,
                  isCommon,
                  explicitGroups,
                };
              });

              const commonEntries = courseEntries.filter((entry) => entry.isCommon);
              const commonHours = commonEntries.reduce(
                (sum, entry) => sum + Number(entry.course.weeklyHours || 0),
                0,
              );

              const renderCourseCard = (
                entry: (typeof courseEntries)[number],
              ) => {
                const { course, index } = entry;
                const teacherLabels = [course.teacherName, course.teacherName2].filter(
                  (name) =>
                    name &&
                    name !== "Belirtilmedi" &&
                    name !== "Öğretmen Atanmadı",
                );
                const teacherLabel =
                  teacherLabels.length > 0
                    ? teacherLabels.join(" + ")
                    : "Öğretmen seçilmedi";

                return (
                  <button
                    key={`${course.courseName}-${course.groupName || ""}-${index}`}
                    type="button"
                    onClick={() => {
                      setTempTeacherToAssign(course.teacherId || "");
                      setTempTeacherToAssign2(course.teacherId2 || "");
                      setVoiceFeedback("");
                      setTeacherAssignmentModal({
                        isOpen: true,
                        courseIndex: index,
                        courseName: course.courseName,
                      });
                      // Kart tıklaması kullanıcı hareketi olduğu için ilk öğretmen
                      // dinlemesini aynı işlem akışı içinde otomatik başlat.
                      window.setTimeout(() => {
                        startSpeechRecognition(index, 1);
                      }, 120);
                    }}
                    className="group relative rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="pr-16">
                      <div className="truncate text-sm font-black text-slate-900">
                        {course.courseName}
                      </div>
                    </div>

                    <div className="absolute right-3 top-3 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-white">
                      {Number(course.weeklyHours || 0)} Saat
                    </div>

                    <div
                      className={`mt-4 rounded-xl px-3 py-2 text-xs font-bold ${
                        teacherLabel === "Öğretmen seçilmedi"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {teacherLabel}
                    </div>
                  </button>
                );
              };

              if (classGroups.length === 0) {
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                      <div className="text-sm font-black text-indigo-900">Dersler</div>
                      <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-indigo-700 shadow-sm">
                        Toplam {totalClassHours} Saat
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {courseEntries.map(renderCourseCard)}
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {commonEntries.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                        <div className="text-sm font-black text-indigo-900">Ortak Dersler</div>
                        <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-indigo-700 shadow-sm">
                          Toplam {commonHours} Saat
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {commonEntries.map(renderCourseCard)}
                      </div>
                    </section>
                  )}

                  {classGroups.map((rawGroupName) => {
                    const groupName = String(rawGroupName);
                    const groupEntries = courseEntries.filter(
                      (entry) =>
                        !entry.isCommon && entry.explicitGroups.has(groupName),
                    );
                    const groupTotalHours = groupEntries.reduce(
                      (sum, entry) => sum + Number(entry.course.weeklyHours || 0),
                      0,
                    );

                    return (
                      <section key={groupName} className="space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                          <div className="text-sm font-black text-emerald-900">
                            {groupName}
                          </div>
                          <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                            Toplam {groupTotalHours} Saat
                          </div>
                        </div>

                        {groupEntries.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {groupEntries.map(renderCourseCard)}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-bold text-slate-400">
                            Bu gruba atanmış ders bulunmuyor.
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
  </>);
}

