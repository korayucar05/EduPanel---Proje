import React from "react";
import { BarChart3, FileDown, FileSpreadsheet, List, Printer, X } from "lucide-react";
import { Student } from "../../types";

type ReportClassroom = {
  classroom: string; total: number;
  groups: { SAY: number; EA: number; "DİL": number; "SÖZ": number };
  genders: { "Kız": number; "Erkek": number; "Belirtilmemiş": number };
};

interface StudentStatisticsPanelProps {
  statisticsMode: "counts" | "lists";
  setStatisticsMode: React.Dispatch<React.SetStateAction<"counts" | "lists" | null>>;
  reportStudents: Student[];
  createStatisticsPdf: (mode: "download" | "print") => Promise<void>;
  downloadStudentListsExcel: () => void;
  availableGradeLevels: number[];
  selectedGradeLevels: number[];
  setSelectedGradeLevels: React.Dispatch<React.SetStateAction<number[]>>;
  availableClassroomBranches: string[];
  selectedClassroomBranches: string[];
  setSelectedClassroomBranches: React.Dispatch<React.SetStateAction<string[]>>;
  listOptionalColumns: Array<"group" | "phone" | "parentName" | "parentPhone">;
  setListOptionalColumns: React.Dispatch<React.SetStateAction<Array<"group" | "phone" | "parentName" | "parentPhone">>>;
  reportClassrooms: ReportClassroom[];
  sortedReportStudents: Student[];
  resolveStudentGroup: (student: Student) => string;
}

export default function StudentStatisticsPanel(props: StudentStatisticsPanelProps) {
  const { statisticsMode, setStatisticsMode, reportStudents, createStatisticsPdf, downloadStudentListsExcel, availableGradeLevels, selectedGradeLevels, setSelectedGradeLevels, availableClassroomBranches, selectedClassroomBranches, setSelectedClassroomBranches, listOptionalColumns, setListOptionalColumns, reportClassrooms, sortedReportStudents, resolveStudentGroup } = props;
  return (
<div className={statisticsMode === "lists" ? "order-first w-full" : "fixed inset-0 z-[100] flex bg-slate-950/70 p-3 backdrop-blur-sm md:p-6"}>
  <div className={statisticsMode === "lists" ? "flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm" : "mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"}>
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
          {statisticsMode === "counts" ? <BarChart3 className="h-6 w-6 text-indigo-600" /> : <List className="h-6 w-6 text-indigo-600" />}
          {statisticsMode === "counts" ? "Sınıf Öğrenci Sayıları" : "Öğrenci Listeleri"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Sınıf düzeylerini seçerek rapor ön izlemesini güncelleyin.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={reportStudents.length === 0} onClick={() => { void createStatisticsPdf("print"); }} className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Printer className="h-4 w-4" /> Yazdır</button>
        <button disabled={reportStudents.length === 0} onClick={() => { void createStatisticsPdf("download"); }} className="flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"><FileDown className="h-4 w-4" /> PDF İndir</button>
        {statisticsMode === "lists" && <button disabled={reportStudents.length === 0 || selectedClassroomBranches.length === 0} onClick={downloadStudentListsExcel} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" /> Excel İndir</button>}
        {statisticsMode === "counts" && <button onClick={() => setStatisticsMode("lists")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800" aria-label="Kapat"><X className="h-5 w-5" /></button>}
      </div>
    </header>

    <div className="border-b border-slate-200 bg-white px-5 py-4">
      {statisticsMode === "counts" ? <>
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Sınıf düzeyleri</p>
        <div className="flex flex-wrap gap-2">
          {availableGradeLevels.map((grade) => {
            const checked = selectedGradeLevels.includes(grade);
            return <label key={grade} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"}`}>
              <input type="checkbox" checked={checked} onChange={() => setSelectedGradeLevels((current) => checked ? current.filter((item) => item !== grade) : [...current, grade].sort((a, b) => a - b))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              {grade}. Sınıf
            </label>;
          })}
        </div>
      </> : <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr_190px] lg:items-end">
          <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Sınıf düzeyi</span>
          <select
            value={selectedGradeLevels[0] ?? ""}
            onChange={(event) => {
              const grade = Number(event.target.value);
              setSelectedGradeLevels([grade]);
              setSelectedClassroomBranches([]);
            }}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {availableGradeLevels.map((grade) => <option key={grade} value={grade}>{grade}. Sınıf</option>)}
          </select>
          </label>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Sınıf şubeleri</p>
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              {availableClassroomBranches.map((classroom) => {
                const checked = selectedClassroomBranches.includes(classroom);
                return <label key={classroom} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${checked ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedClassroomBranches((current) => checked ? current.filter((item) => item !== classroom) : [...current, classroom])} className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                  {classroom}
                </label>;
              })}
            </div>
          </div>
          <div className="flex h-11 items-center justify-between rounded-xl bg-indigo-600 px-4 text-white">
            <span className="text-xs font-bold text-indigo-100">Toplam Öğrenci</span>
            <span className="text-2xl font-black">{reportStudents.length}</span>
          </div>
        </div>
      </div>}
    </div>

    <main className={statisticsMode === "lists" ? "hidden" : "min-h-0 flex-1 overflow-auto p-5"}>
      {statisticsMode === "counts" && <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-indigo-600 p-4 text-white"><p className="text-xs font-bold text-indigo-100">Toplam Öğrenci</p><p className="mt-1 text-3xl font-black">{reportStudents.length}</p></div>
        {statisticsMode === "counts" && <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Seçili Sınıf Düzeyi</p><p className="mt-1 text-3xl font-black text-slate-900">{selectedGradeLevels.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Şube Sayısı</p><p className="mt-1 text-3xl font-black text-slate-900">{reportClassrooms.length}</p></div>
        </>}
      </div>}

      {statisticsMode === "counts" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">Sınıf</th><th className="px-4 py-3">Toplam</th><th className="px-4 py-3">SAY</th><th className="px-4 py-3">EA</th><th className="px-4 py-3">DİL</th><th className="px-4 py-3">SÖZ</th><th className="px-4 py-3">Kız</th><th className="px-4 py-3">Erkek</th><th className="px-4 py-3">Belirtilmemiş</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{reportClassrooms.map((row) => <tr key={row.classroom} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-slate-800">{row.classroom}</td><td className="px-4 py-3 font-black text-indigo-700">{row.total}</td><td className="px-4 py-3">{row.groups.SAY}</td><td className="px-4 py-3">{row.groups.EA}</td><td className="px-4 py-3">{row.groups["DİL"]}</td><td className="px-4 py-3">{row.groups["SÖZ"]}</td><td className="px-4 py-3">{row.genders["Kız"]}</td><td className="px-4 py-3">{row.genders["Erkek"]}</td><td className="px-4 py-3">{row.genders["Belirtilmemiş"]}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[680px] table-fixed text-left text-xs">
            <thead className="bg-slate-900 text-white"><tr>
              <th className="w-24 px-2 py-2.5">Sınıf-Şube</th>
              <th className="w-24 px-2 py-2.5">Öğrenci No</th>
              <th className="w-56 px-2 py-2.5">Öğrenci Ad Soyad</th>
              {listOptionalColumns.includes("group") && <th className="w-16 px-2 py-2.5">Grup</th>}
              {listOptionalColumns.includes("phone") && <th className="w-32 px-2 py-2.5">Öğrenci Tel</th>}
              {listOptionalColumns.includes("parentName") && <th className="w-44 px-2 py-2.5">Veli Adı</th>}
              {listOptionalColumns.includes("parentPhone") && <th className="w-32 px-2 py-2.5">Veli Telefon</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{sortedReportStudents.map((student) => <tr key={student.id} className="hover:bg-slate-50">
              <td className="truncate px-2 py-2 font-bold">{student.classroom}</td>
              <td className="truncate px-2 py-2 font-mono">{student.id}</td>
              <td className="truncate px-2 py-2 font-bold text-slate-800">{student.name}</td>
              {listOptionalColumns.includes("group") && <td className="truncate px-2 py-2">{resolveStudentGroup(student) || "-"}</td>}
              {listOptionalColumns.includes("phone") && <td className="truncate px-2 py-2">{student.phone || "-"}</td>}
              {listOptionalColumns.includes("parentName") && <td className="truncate px-2 py-2">{student.parentName || "-"}</td>}
              {listOptionalColumns.includes("parentPhone") && <td className="truncate px-2 py-2">{student.parentPhone || "-"}</td>}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </main>
  </div>
</div>
  );
}
