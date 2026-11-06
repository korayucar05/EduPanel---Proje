import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, FileImage, LoaderCircle, MessageCircle, RefreshCw, Save, Search, Smartphone, UserRoundCheck } from "lucide-react";
import type { Classroom, Student } from "../../types";
import { getAttendanceStudentNumber } from "../../utils/attendanceStudents";
import { isValidMhatsappNumber, loadMhatsappSettings, normalizeMhatsappNumber, sendTextMessage } from "../../lib/mhatsappApi";
import AttendanceOpticalReader from "../AttendanceOpticalReader";
import { createAttendanceEntryLink, loadApprovedAttendanceRecords, loadAttendanceReview, saveAttendanceDayReview, type ApprovedAttendanceRecord, type AttendanceLessonEntry, type AttendanceReviewPayload } from "../../services/attendance/attendanceEntryService";

interface Props { mode: "summary" | "absences" | "unauthorized" | "activities"; date: string; classrooms?: Classroom[]; students?: Student[]; }
type MethodTab = "phone" | "scan" | "review";
type ReviewClass = { classroomId: string; classroomName: string; absentStudents: AttendanceLessonEntry[]; sources: string[] };

const sourceLabel = (value: string) => value === "phone-link" ? "Telefon Linki" : value === "scanned-slip" ? "Taranmış Fiş" : value;
const getStudentPhone = (student: Student) => {
  const raw = (student as any).phone || (student as any).studentPhone || (student as any).mobile || (student as any).gsm || (student as any).telefon || "";
  return normalizeMhatsappNumber(String(raw));
};

export default function AttendanceDailyWorkflow({ mode, date, classrooms = [], students = [] }: Props) {
  const [records, setRecords] = useState<ApprovedAttendanceRecord[]>([]);
  const [reviewClasses, setReviewClasses] = useState<ReviewClass[]>([]);
  const [tab, setTab] = useState<MethodTab>("review");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const buildReview = (data: AttendanceReviewPayload): ReviewClass[] => {
    if (data.finalRecords.length) return data.finalRecords.map((item) => ({ classroomId: item.classroomId, classroomName: item.classroomName, absentStudents: item.absentStudents || [], sources: item.sources || ["Yönetici Kaydı"] }));
    const map = new Map<string, ReviewClass>();
    const ensure = (classroomId: string, classroomName: string) => {
      const key = classroomId || classroomName;
      if (!map.has(key)) map.set(key, { classroomId, classroomName, absentStudents: [], sources: [] });
      return map.get(key)!;
    };
    const merge = (target: ReviewClass, entry: AttendanceLessonEntry) => {
      const current = target.absentStudents.find((item) => item.studentId === entry.studentId);
      if (current) current.lessons = [...new Set([...current.lessons, ...(entry.lessons || [])])].sort((a, b) => a - b);
      else target.absentStudents.push({ ...entry, lessons: [...(entry.lessons || [])].sort((a, b) => a - b) });
    };
    data.mobile.forEach((submission) => {
      const target = ensure(submission.classroomId, submission.classroomName);
      if (!target.sources.includes("phone-link")) target.sources.push("phone-link");
      (submission.entries || []).forEach((entry: any) => merge(target, { ...entry, lessons: entry.lessons || entry.skippedLessons || [] }));
    });
    data.optical.forEach((optical) => {
      const target = ensure(optical.classroomId, optical.classroomName);
      if (!target.sources.includes("scanned-slip")) target.sources.push("scanned-slip");
      (optical.absentStudents || []).forEach((entry) => merge(target, entry));
    });
    return [...map.values()].sort((a, b) => a.classroomName.localeCompare(b.classroomName, "tr"));
  };

  const refresh = async () => {
    setLoading(true); setNotice("");
    try {
      if (mode === "summary") {
        const data = await loadAttendanceReview(date);
        setReviewClasses(buildReview(data));
      } else setRecords(await loadApprovedAttendanceRecords(mode, date));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Kayıtlar okunamadı."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [date, mode]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return students.filter((student) => {
      if (!q) return true;
      const text = `${student.name || ""} ${getAttendanceStudentNumber(student)} ${(student as any).classroom || (student as any).className || ""}`.toLocaleLowerCase("tr-TR");
      return text.includes(q);
    }).slice(0, 120);
  }, [students, search]);

  const getStudentClassKey = (student: Student) => String(
    (student as any).classroomId ||
    (student as any).classId ||
    (student as any).classroom ||
    (student as any).className ||
    (student as any).branch ||
    ""
  ).trim().toLocaleUpperCase("tr-TR");

  const toggleDutyStudent = (student: Student) => {
    const alreadySelected = selectedStudentIds.includes(student.id);
    if (alreadySelected) {
      setSelectedStudentIds((current) => current.filter((id) => id !== student.id));
      return;
    }
    const classKey = getStudentClassKey(student);
    if (!classKey) {
      setNotice(`${student.name}: sınıf/şube bilgisi bulunamadığı için görevli seçilemedi.`);
      return;
    }
    const sameClassCount = selectedStudentIds
      .map((id) => students.find((item) => item.id === id))
      .filter((item): item is Student => Boolean(item))
      .filter((item) => getStudentClassKey(item) === classKey).length;
    if (sameClassCount >= 2) {
      const className = (student as any).classroom || (student as any).className || (student as any).branch || classKey;
      setNotice(`${className} sınıfı için en fazla 2 görevli öğrenci seçilebilir.`);
      return;
    }
    setNotice("");
    setSelectedStudentIds((current) => [...current, student.id]);
  };

  const selectedByClass = useMemo(() => {
    const counts = new Map<string, number>();
    selectedStudentIds.forEach((id) => {
      const student = students.find((item) => item.id === id);
      if (!student) return;
      const key = getStudentClassKey(student);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [selectedStudentIds, students]);

  const sendLinks = async () => {
    if (!selectedStudentIds.length) return setNotice("En az bir görevli öğrenci seçiniz.");
    setSending(true); setNotice("");
    const settings = loadMhatsappSettings();
    let sent = 0; const errors: string[] = [];
    for (const studentId of selectedStudentIds) {
      const student = students.find((item) => item.id === studentId);
      if (!student) continue;
      const phone = getStudentPhone(student);
      if (!isValidMhatsappNumber(phone)) { errors.push(`${student.name}: telefon numarası yok/geçersiz`); continue; }
      try {
        const link = await createAttendanceEntryLink(date, student.id);
        const classroomName = String(link.classroomName || (student as any).classroom || (student as any).className || (student as any).branch || "").trim();
        if (!classroomName) throw new Error("Öğrencinin sınıf/şube bilgisi bulunamadı.");
        if (!/^https:\/\//i.test(link.url)) throw new Error("Yoklama bağlantısı genel HTTPS adresi değil; mesaj gönderilmedi.");
        const message = `Sayın ${student.name}, ${new Intl.DateTimeFormat("tr-TR").format(new Date(`${date}T12:00:00`))} tarihli ${classroomName} sınıfının günlük yoklamasını aşağıdaki kişisel bağlantıdan giriniz. Bağlantı kayıt yapıldıktan sonra tekrar kullanılamaz.\n\n${link.url}`;
        const result = await sendTextMessage(settings, [phone], message);
        if (!result.ok) throw new Error(result.error || "WhatsApp gönderimi başarısız.");
        sent += 1;
      } catch (error) { errors.push(`${student.name}: ${error instanceof Error ? error.message : "gönderilemedi"}`); }
    }
    setSending(false);
    if (sent > 0) setSelectedStudentIds([]);
    setNotice(`${sent} görevli öğrenciye kişisel yoklama bağlantısı gönderildi.${errors.length ? ` ${errors.length} gönderim başarısız: ${errors.slice(0, 3).join(" • ")}` : ""}`);
  };

  const toggleLesson = (classroomId: string, studentId: string, lesson: number) => setReviewClasses((current) => current.map((group) => {
    if (group.classroomId !== classroomId) return group;
    const absent = group.absentStudents.find((item) => item.studentId === studentId);
    if (!absent) return group;
    const lessons = absent.lessons.includes(lesson) ? absent.lessons.filter((item) => item !== lesson) : [...absent.lessons, lesson].sort((a, b) => a - b);
    return { ...group, absentStudents: lessons.length ? group.absentStudents.map((item) => item.studentId === studentId ? { ...item, lessons } : item) : group.absentStudents.filter((item) => item.studentId !== studentId) };
  }));
  const addAbsentStudent = (classroomId: string, student: Student, lesson: number) => setReviewClasses((current) => current.map((group) => group.classroomId !== classroomId ? group : {
    ...group,
    absentStudents: [...group.absentStudents, { studentId: student.id, studentName: student.name, studentNumber: getAttendanceStudentNumber(student), lessons: [lesson] }],
  }));
  const saveReview = async () => {
    setSaving(true); setNotice("");
    try { await saveAttendanceDayReview(date, reviewClasses); setNotice("Düzeltilmiş günlük yoklama kaydedildi."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Düzeltmeler kaydedilemedi."); }
    finally { setSaving(false); }
  };

  if (mode !== "summary") return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-black text-slate-800">{mode === "absences" ? "Devamsızlıklar" : mode === "activities" ? "Faaliyetler" : "İzinsiz Gidenler"}</h2><p className="text-xs font-bold text-slate-400">{new Intl.DateTimeFormat("tr-TR").format(new Date(`${date}T12:00:00`))} · {records.length} kayıt</p></div><button onClick={refresh} className="rounded-xl bg-slate-100 p-2 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    {notice && <div className="m-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">{notice}</div>}
    <div className="divide-y divide-slate-100">{records.length ? records.map((record) => <div key={record.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><strong className="text-sm text-slate-900">{record.studentName}</strong><p className="text-xs font-bold text-slate-400">{record.classroomName}</p></div><span className="text-xs font-black text-slate-600">{record.skippedLessons?.length ? `Okulda olmadığı dersler: ${record.skippedLessons.join(", ")}` : (record.status || "-")}</span><small className="text-[10px] font-bold text-slate-400">{record.approvedByName}</small></div>) : <div className="p-10 text-center text-sm font-bold text-slate-400">Bu tarih için kayıt bulunmuyor.</div>}</div>
  </section>;

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 p-2">
        <button onClick={() => setTab("phone")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black ${tab === "phone" ? "bg-cyan-600 text-white" : "text-slate-600"}`}><Smartphone className="h-4 w-4"/>1. Telefon Linki</button>
        <button onClick={() => setTab("scan")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black ${tab === "scan" ? "bg-orange-500 text-white" : "text-slate-600"}`}><FileImage className="h-4 w-4"/>2. Taranmış Fiş</button>
        <button onClick={() => { setTab("review"); void refresh(); }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black ${tab === "review" ? "bg-slate-900 text-white" : "text-slate-600"}`}><ClipboardCheck className="h-4 w-4"/>Kontrol ve Düzeltme</button>
      </div>
      {tab === "phone" && <div className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-800">Görevli Öğrenciye Yoklama Linki</h2><p className="mt-1 text-xs font-bold text-slate-400">Her sınıftan en fazla 2 görevli öğrenci seçilir. Her öğrenci yalnız kendi sınıfının yoklama fişini görür.</p></div><button onClick={sendLinks} disabled={sending || !selectedStudentIds.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-xs font-black text-white disabled:opacity-40">{sending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <MessageCircle className="h-4 w-4"/>}{sending ? "Gönderiliyor" : `Link Gönder (${selectedStudentIds.length})`}</button></div>
        <div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci adı, numarası veya sınıfı ile ara" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm"/></div>
        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{filteredStudents.map((student) => { const selected = selectedStudentIds.includes(student.id); const cls = (student as any).classroom || (student as any).className || (student as any).branch || ""; const classKey = getStudentClassKey(student); const classSelectedCount = classKey ? (selectedByClass.get(classKey) || 0) : 0; return <button key={student.id} onClick={() => toggleDutyStudent(student)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}><UserRoundCheck className="h-4 w-4"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{student.name}</strong><small className="text-[10px] font-bold text-slate-400">{getAttendanceStudentNumber(student)} · {cls || "Sınıf yok"}</small></span>{classKey && <span className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-black ${classSelectedCount >= 2 ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>{classSelectedCount}/2</span>}</button>; })}</div>
      </div>}
      {tab === "scan" && <div className="bg-slate-50 p-3"><AttendanceOpticalReader classrooms={classrooms} students={students} initialDate={date} /></div>}
      {tab === "review" && <div>
        <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-black text-slate-800">Birleşik Yoklama Kontrolü</h2><p className="text-xs font-bold text-slate-400">Telefon ve optik okuma sonuçları aynı ekranda. Yalnız gelmeyen öğrenciler gösterilir.</p></div><button onClick={refresh} className="rounded-xl bg-slate-100 p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/></button></div>
        <div className="space-y-3 p-4">{reviewClasses.length ? reviewClasses.map((group) => {
          const classStudents = students.filter((student: any) => String(student.classroomId || student.classId || "") === group.classroomId || String(student.classroom || student.className || "") === group.classroomName);
          const candidates = classStudents.filter((student) => !group.absentStudents.some((item) => item.studentId === student.id));
          return <section key={group.classroomId} className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3"><div><strong className="text-sm text-slate-900">{group.classroomName}</strong><p className="text-[10px] font-bold text-slate-400">Kaynak: {group.sources.map(sourceLabel).join(" + ") || "Yönetici"}</p></div><span className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-700">{group.absentStudents.length} gelmeyen</span></div>
            <div className="divide-y divide-slate-100">{group.absentStudents.map((student) => <div key={student.studentId} className="grid gap-2 px-4 py-3 lg:grid-cols-[220px_1fr]"><div><strong className="text-xs text-slate-900">{student.studentName}</strong><p className="text-[10px] font-bold text-slate-400">No: {student.studentNumber || "-"}</p></div><div className="grid grid-cols-8 gap-1">{Array.from({ length: 8 }, (_, idx) => idx + 1).map((lesson) => <button key={lesson} onClick={() => toggleLesson(group.classroomId, student.studentId, lesson)} className={`h-8 rounded-lg text-[10px] font-black ${student.lessons.includes(lesson) ? "bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-500"}`}>{lesson}</button>)}</div></div>)}</div>
            {candidates.length > 0 && <details className="border-t border-slate-100 p-3"><summary className="cursor-pointer text-[11px] font-black text-cyan-700">Eksik öğrenci ekle / düzelt</summary><div className="mt-2 grid max-h-40 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3">{candidates.map((student) => <button key={student.id} onClick={() => addAbsentStudent(group.classroomId, student, 1)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[10px] font-bold text-slate-600">{getAttendanceStudentNumber(student)} · {student.name}</button>)}</div></details>}
          </section>;
        }) : <div className="p-10 text-center text-sm font-bold text-slate-400">Bu tarih için telefon veya taranmış fiş kaydı bulunmuyor.</div>}</div>
        <div className="border-t border-slate-100 p-4"><button onClick={saveReview} disabled={saving || !reviewClasses.length} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white disabled:opacity-40">{saving ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5"/>}Düzeltmeleri Kaydet</button></div>
      </div>}
    </section>
    {notice && <div className="flex items-start gap-2 rounded-xl bg-cyan-50 p-3 text-sm font-bold text-cyan-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>{notice}</div>}
  </div>;
}
