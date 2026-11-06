import React, { useEffect, useMemo, useState } from "react";
import localforage from "../core/state/AppStateService";
import { BarChart3, CalendarDays, Filter, RotateCcw, Search, UserX } from "lucide-react";
import type { Classroom } from "../types";
import { compareClassrooms } from "../utils/classroomSort";
import type { AttendanceOpticalRecord } from "./AttendanceOpticalReader";
import EOkulAttendanceTransferPreview from "./EOkulAttendanceTransferPreview";

const RECORD_KEY = "attendance_optical_records";

const normalize = (value: unknown) => String(value || "").toLocaleLowerCase("tr-TR").trim();

export default function AttendanceOpticalReports({ classrooms }: { classrooms: Classroom[] }) {
  const [records, setRecords] = useState<AttendanceOpticalRecord[]>([]);
  const [query, setQuery] = useState("");
  const [classroomId, setClassroomId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lesson, setLesson] = useState("all");
  const [status, setStatus] = useState<"all" | "absent" | "complete">("all");

  useEffect(() => {
    const load = () => Promise.all([
      localforage.getItem<AttendanceOpticalRecord[]>(RECORD_KEY).catch(() => []),
      fetch("/api/public/attendance-optical/records", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).catch(() => []),
    ]).then(([localRecords, remoteRecords]) => {
      const merged = new Map<string, AttendanceOpticalRecord>();
      [...(Array.isArray(localRecords) ? localRecords : []), ...(Array.isArray(remoteRecords) ? remoteRecords : [])]
        .forEach((record) => merged.set(record.id, record));
      setRecords([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
    load();
    const timer = window.setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);

  const orderedClassrooms = useMemo(() => [...classrooms].sort(compareClassrooms), [classrooms]);
  const filteredRecords = useMemo(() => records.filter((record) => {
    if (classroomId !== "all" && record.classroomId !== classroomId) return false;
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;
    if (status === "absent" && record.absentStudents.length === 0) return false;
    if (status === "complete" && record.absentStudents.length > 0) return false;
    if (lesson !== "all" && !record.absentStudents.some((student) => student.lessons.includes(Number(lesson)))) return false;
    const needle = normalize(query);
    if (!needle) return true;
    return normalize(`${record.classroomName} ${record.sourceName}`).includes(needle)
      || record.absentStudents.some((student) => normalize(`${student.studentNumber} ${student.studentName} ${student.lessons.join(" ")}`).includes(needle));
  }), [records, classroomId, startDate, endDate, status, lesson, query]);

  const uniqueAbsentStudents = new Set(filteredRecords.flatMap((record) => record.absentStudents.map((student) => student.studentId))).size;
  const markedLessonCount = filteredRecords.reduce((sum, record) => sum + record.absentStudents.reduce((studentSum, student) => studentSum + student.lessons.length, 0), 0);
  const completeCount = filteredRecords.filter((record) => record.absentStudents.length === 0).length;

  const clearFilters = () => {
    setQuery("");
    setClassroomId("all");
    setStartDate("");
    setEndDate("");
    setLesson("all");
    setStatus("all");
  };

  return <div className="mx-auto w-full max-w-7xl space-y-4">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#704267] to-[#9B628E] px-5 py-4 text-white">
        <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5" /><div><h2 className="text-base font-black">Optik Yoklama Raporları</h2><p className="mt-0.5 text-[11px] font-medium text-white/75">Kaydedilen fişleri ayrıntılı olarak arayın ve filtreleyin.</p></div></div>
      </div>

      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#704267]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Öğrenci adı, okul numarası, sınıf veya dosya adı ara..." className="h-12 w-full rounded-xl border border-[#C9A7C3] bg-[#FBF7FA] pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#B58AAE]/30" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr_0.85fr_1fr_auto]">
          <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Sınıf</span><select value={classroomId} onChange={(event) => setClassroomId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="all">Tüm sınıflar</option>{orderedClassrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Başlangıç</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700" /></label>
          <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Bitiş</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700" /></label>
          <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Ders Saati</span><select value={lesson} onChange={(event) => setLesson(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="all">Tüm dersler</option>{Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>{index + 1}. ders</option>)}</select></label>
          <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Durum</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="all">Tüm kayıtlar</option><option value="absent">Devamsızlık var</option><option value="complete">Tam katılım</option></select></label>
          <button type="button" onClick={clearFilters} className="mt-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 text-[14.67px] font-black text-slate-600 hover:bg-slate-200"><RotateCcw className="h-4 w-4" /> Temizle</button>
        </div>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[{ label: "Filtrelenen Fiş", value: filteredRecords.length, icon: Filter, tone: "bg-violet-50 text-violet-700" }, { label: "Gelmeyen Öğrenci", value: uniqueAbsentStudents, icon: UserX, tone: "bg-rose-50 text-rose-700" }, { label: "İşaretli Ders", value: markedLessonCount, icon: CalendarDays, tone: "bg-amber-50 text-amber-700" }, { label: "Tam Katılım", value: completeCount, icon: BarChart3, tone: "bg-emerald-50 text-emerald-700" }].map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div></div>)}
    </div>

    <EOkulAttendanceTransferPreview records={filteredRecords} />

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-black text-slate-900">Rapor Sonuçları</h3><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{filteredRecords.length} kayıt</span></div>
      {filteredRecords.length === 0 ? <p className="p-10 text-center text-sm font-bold text-slate-400">Seçili ölçütlere uygun yoklama kaydı bulunamadı.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Sınıf</th><th className="px-4 py-3 text-center">Gelmeyen</th><th className="px-4 py-3 text-left">Öğrenci ve Dersler</th><th className="px-4 py-3 text-left">Kaynak</th><th className="px-4 py-3 text-left">Kayıt Zamanı</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70"><td className="px-4 py-3 font-bold text-slate-700">{record.date.split("-").reverse().join(".")}</td><td className="px-4 py-3 font-black text-slate-900">{record.classroomName}</td><td className="px-4 py-3 text-center"><span className={`rounded-lg px-2 py-1 font-black ${record.absentStudents.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{record.absentStudents.length}</span></td><td className="max-w-xl px-4 py-3 leading-relaxed text-slate-700">{record.absentStudents.length ? record.absentStudents.map((student) => <span key={student.studentId} className="mr-2 inline-block"><b>{student.studentNumber} {student.studentName}</b> <span className="text-rose-600">({student.lessons.join(", ")}. ders)</span></span>) : <span className="font-bold text-emerald-700">Tam katılım</span>}</td><td className="px-4 py-3 text-slate-500">{record.sourceName}</td><td className="px-4 py-3 text-slate-500">{new Date(record.createdAt).toLocaleString("tr-TR")}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
