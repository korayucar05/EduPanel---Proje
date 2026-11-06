import React from "react";
import { Check, Plus } from "lucide-react";
import { isSameCourseName } from "./courseCatalog";

interface CourseBranchInfoPanelProps {
  availableTeacherBranches: string[];
  selectedBranchForCourses: string;
  setSelectedBranchForCourses: (value: string) => void;
  branchCourseAssignments: Record<string, string[]>;
  branchCourseSearch: string;
  setBranchCourseSearch: (value: string) => void;
  branchCourseOptions: string[];
  toggleBranchCourseAssignment: (branch: string, courseName: string) => void;
  normalizeReportText: (value: unknown) => string;
}

export default function CourseBranchInfoPanel({
  availableTeacherBranches,
  selectedBranchForCourses,
  setSelectedBranchForCourses,
  branchCourseAssignments,
  branchCourseSearch,
  setBranchCourseSearch,
  branchCourseOptions,
  toggleBranchCourseAssignment,
  normalizeReportText,
}: CourseBranchInfoPanelProps) {
  return (
    <div className="grid min-h-[640px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-indigo-950 px-5 py-5 text-white">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Branşlar</p>
          <h3 className="mt-1 text-xl font-black">Branş Seçimi</h3>
        </div>
        <div className="max-h-[570px] space-y-1 overflow-y-auto p-3">
          {availableTeacherBranches.map((branch) => {
            const selected = selectedBranchForCourses === branch;
            const courseCount = branchCourseAssignments[branch]?.length || 0;
            return (
              <button
                key={branch}
                type="button"
                onClick={() => {
                  setSelectedBranchForCourses(branch);
                  setBranchCourseSearch("");
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                  selected
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
                }`}
              >
                <span>{branch}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${
                  selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {courseCount} ders
                </span>
              </button>
            );
          })}
          {availableTeacherBranches.length === 0 && (
            <p className="p-6 text-center text-sm font-bold text-slate-400">
              Kayıtlı öğretmen branşı bulunmuyor.
            </p>
          )}
        </div>
      </aside>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {selectedBranchForCourses ? (
          <>
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-indigo-500">Seçili branş</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{selectedBranchForCourses}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Bu branştaki öğretmenlerin girebileceği dersleri seçin. Aynı ders başka branşlarda da seçilebilir.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-black text-amber-950">
                  {branchCourseAssignments[selectedBranchForCourses]?.length || 0} ders seçili
                </span>
                <input
                  type="search"
                  value={branchCourseSearch}
                  onChange={(event) => setBranchCourseSearch(event.target.value)}
                  placeholder="Ders ara..."
                  className="h-11 w-64 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="grid max-h-[570px] grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2 xl:grid-cols-3">
              {branchCourseOptions
                .filter((courseName) =>
                  normalizeReportText(courseName).includes(normalizeReportText(branchCourseSearch)),
                )
                .map((courseName) => {
                  const selected = (branchCourseAssignments[selectedBranchForCourses] || [])
                    .some((assignedCourse) => isSameCourseName(assignedCourse, courseName));
                  const assignedToAnyBranch = (Object.values(branchCourseAssignments) as string[][])
                    .some((assignedCourses) =>
                      assignedCourses.some((assignedCourse) => isSameCourseName(assignedCourse, courseName)),
                    );
                  return (
                    <button
                      key={courseName}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleBranchCourseAssignment(selectedBranchForCourses, courseName)}
                      className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-black transition ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                          : !assignedToAnyBranch
                            ? "border-rose-400 bg-rose-50 text-rose-800 shadow-sm hover:border-rose-500 hover:bg-rose-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                      }`}
                    >
                      <span>{courseName}</span>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        selected
                          ? "bg-emerald-600 text-white"
                          : !assignedToAnyBranch
                            ? "bg-rose-600 text-white"
                            : "bg-slate-100 text-slate-400"
                      }`}>
                        {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
            </div>
          </>
        ) : (
          <div className="flex min-h-[640px] items-center justify-center p-10 text-center text-sm font-bold text-slate-400">
            Ders tanımlamak için soldan bir branş seçin.
          </div>
        )}
      </section>
    </div>
  );
}
