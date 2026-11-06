import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, Send, WifiOff } from "lucide-react";
import type { Student } from "../../types";
import { getAttendanceStudentNumber } from "../../utils/attendanceStudents";
import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
import PwaInstallCard from "../pwa/PwaInstallCard";

type Bootstrap = {
  date: string;
  recipientStudentId?: string;
  recipientStudentName?: string;
  classroomId: string;
  classroomName: string;
  used?: boolean;
  usedAt?: string | null;
  students: Student[];
};

const studentNo = (student: Student) => getAttendanceStudentNumber(student) || "";

export default function MobileAttendanceLinkView() {
  const [token] = useState(() => {
    const incoming = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
    if (incoming) runtimeSessionStorage.setItem("attendance_entry_token", incoming);
    window.history.replaceState(null, "", `${window.location.pathname}?mode=attendance-entry`);
    return incoming || runtimeSessionStorage.getItem("attendance_entry_token") || "";
  });
  const [data, setData] = useState<Bootstrap | null>(null);
  const [absenceHours, setAbsenceHours] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = "e-Nstitü Öğrenci";
    const currentStart = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    let manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    manifest.href = `/api/pwa/manifest?role=student&start=${encodeURIComponent(currentStart)}&v=13`;

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = "/enstitu-pwa-icon-180.png?v=2";

    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = "/enstitu-pwa-icon-64.png?v=2";
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Yoklama bağlantısında güvenlik anahtarı bulunamadı.");
      setLoading(false);
      return;
    }
    fetch("/api/public/attendance-entry/bootstrap", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const raw = await response.text();
        let result: any = {};
        try { result = raw ? JSON.parse(raw) : {}; } catch { result = { error: raw }; }
        if (!response.ok) throw new Error(result.error || "Yoklama bilgileri alınamadı.");
        return result;
      })
      .then((result: Bootstrap) => setData(result))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Bağlantı kurulamadı."))
      .finally(() => setLoading(false));
  }, [token]);

  const students = useMemo(() => [...(data?.students || [])].sort((a, b) =>
    studentNo(a).localeCompare(studentNo(b), "tr", { numeric: true, sensitivity: "base" })
      || a.name.localeCompare(b.name, "tr")
  ), [data?.students]);

  const toggleLesson = (studentId: string, lesson: number) => {
    if (data?.used || saved) return;
    setAbsenceHours((current) => {
      const hours = current[studentId] || [];
      const next = hours.includes(lesson)
        ? hours.filter((item) => item !== lesson)
        : [...hours, lesson].sort((a, b) => a - b);
      const copy = { ...current };
      if (next.length) copy[studentId] = next;
      else delete copy[studentId];
      return copy;
    });
  };

  const submit = async () => {
    if (!data || data.used || saved) return;
    setSaving(true);
    setError("");
    try {
      const entries = Object.entries(absenceHours).map(([studentId, lessons]) => ({
        studentId,
        studentName: students.find((student) => student.id === studentId)?.name || "",
        lessons,
      }));
      const response = await fetch("/api/public/attendance-entry/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          classroomId: data.classroomId,
          classroomName: data.classroomName,
          entries,
        }),
      });
      const raw = await response.text();
      let result: any = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch { result = { error: raw }; }
      if (!response.ok) throw new Error(result.error || "Yoklama gönderilemedi.");
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Yoklama gönderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100"><LoaderCircle className="h-10 w-10 animate-spin text-cyan-600" /></main>;
  if (error && !data) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl"><WifiOff className="mx-auto h-10 w-10 text-rose-500"/><h1 className="mt-3 font-black">Yoklama Fişi açılamadı</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  if (!data) return null;

  if (data.used || saved) return <main className="flex min-h-screen items-center justify-center bg-emerald-50 p-5"><div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">{saved ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600"/> : <LockKeyhole className="mx-auto h-14 w-14 text-slate-600"/>}<h1 className="mt-4 text-xl font-black">{saved ? "Yoklama kaydedildi" : "Bu yoklama tamamlandı"}</h1><p className="mt-2 text-sm text-slate-500">{data.classroomName} sınıfının {data.date ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${data.date}T12:00:00`)) : ""} tarihli kaydı tekrar değiştirilemez. Gerekli düzeltmeyi okul yönetimi yapabilir.</p></div></main>;


  return <main className="min-h-screen bg-slate-100 pb-28">
    <header className="sticky top-0 z-20 bg-gradient-to-r from-cyan-700 to-cyan-500 px-3 py-2.5 text-white shadow-md">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">e-Nstitü Yoklama Fişi</p>
        <h1 className="mt-0.5 text-lg font-black">{data.classroomName}</h1>
        <p className="mt-0.5 text-[10px] font-bold text-cyan-50">{data.date ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${data.date}T12:00:00`)) : ""} · Görevli: {data.recipientStudentName || "Öğrenci"}</p>
      </div>
    </header>

    <div className="mx-auto max-w-2xl px-2 pt-2">
      <PwaInstallCard
        appName="e-Nstitü Öğrenci"
        storageKey="student"
        compact
      />
    </div>

    <div className="mx-auto max-w-2xl space-y-1.5 p-2">
      {students.map((student) => {
        const selected = absenceHours[student.id] || [];
        return <section key={student.id} className={`rounded-xl border bg-white px-2.5 py-2 shadow-sm ${selected.length ? "border-rose-200" : "border-slate-100"}`}>
          <div className="flex min-w-0 items-center gap-2 leading-none">
            <strong className="shrink-0 text-[11px] font-black text-slate-500">{studentNo(student) || "-"}</strong>
            <span className="min-w-0 truncate text-[12px] font-black text-slate-900">{student.name}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }, (_, item) => item + 1).map((lesson) => <button key={lesson} type="button" onClick={() => toggleLesson(student.id, lesson)} className={`h-7 rounded-md text-[10px] font-black transition ${selected.includes(lesson) ? "bg-rose-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-500"}`}>{lesson}</button>)}
          </div>
        </section>;
      })}

      {error && <div className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur">
      <button disabled={saving} onClick={submit} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-sm font-black text-white shadow-lg disabled:opacity-50">{saving ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5"/>}{saving ? "Kaydediliyor" : "Yoklamayı Kaydet"}</button>
    </div>
  </main>;
}
