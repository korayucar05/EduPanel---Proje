import React, { useEffect, useState } from "react";
import { ScanLine, WifiOff } from "lucide-react";
import type { Classroom, Student } from "../types";
import AttendanceOpticalReader from "./AttendanceOpticalReader";

import { runtimeSessionStorage } from "../lib/runtimeSessionStorage";
export default function MobileAttendanceScannerView() {
  const [accessToken] = useState(() => {
    const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
    if (hashToken) {
      try { runtimeSessionStorage.setItem("attendance_access_token", hashToken); } catch { /* Depolama kapalıysa sekme boyunca state kullanılır. */ }
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return hashToken;
    }
    try { return runtimeSessionStorage.getItem("attendance_access_token") || ""; } catch { return ""; }
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/attendance-optical/bootstrap", {
      cache: "no-store",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Okul verileri alınamadı.");
        setStudents(Array.isArray(data.students) ? data.students : []);
        setClassrooms(Array.isArray(data.classrooms) ? data.classrooms : []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Okul sistemine bağlanılamadı."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="rounded-3xl bg-white p-8 text-center shadow-xl"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500"></span><p className="mt-4 text-sm font-black text-slate-700">Okul verileri yükleniyor...</p></div></main>;
  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl"><WifiOff className="mx-auto h-10 w-10 text-rose-500"/><h1 className="mt-4 text-lg font-black text-slate-900">Bağlantı kurulamadı</h1><p className="mt-2 text-sm font-medium text-slate-500">{error}</p><p className="mt-3 text-xs font-bold text-slate-400">Bağlantının süresi dolmuş olabilir veya okul sistemi şu anda kapalı olabilir. Yönetimden yeni bağlantı isteyin.</p></div></main>;

  return <main className="min-h-screen bg-slate-100 p-3 md:p-6">
    <header className="mx-auto mb-4 flex max-w-7xl items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 p-4 text-white shadow-lg">
      <span className="rounded-xl bg-white/15 p-2.5"><ScanLine className="h-6 w-6" /></span>
      <div><h1 className="text-lg font-black">Mobil Optik Yoklama</h1><p className="text-xs font-medium text-orange-50">Okunan fişler doğrudan okul sistemine kaydedilir.</p></div>
    </header>
    <AttendanceOpticalReader classrooms={classrooms} students={students} initialDate={new Date().toISOString().slice(0, 10)} remoteMode accessToken={accessToken} />
  </main>;
}
