import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, FileSpreadsheet, Info, ShieldCheck } from "lucide-react";
import type { AttendanceOpticalRecord } from "./AttendanceOpticalReader";

type TransferKind = "Kontrol Gerekli" | "Özürsüz Yarım Gün" | "Özürsüz Tam Gün";

type TransferRow = {
  key: string;
  date: string;
  classroomName: string;
  studentNumber: string;
  studentName: string;
  lessons: number[];
  kind: TransferKind;
};

const inferTransferKind = (lessons: number[]): TransferKind => {
  const uniqueLessons = [...new Set(lessons)].sort((a, b) => a - b);
  if (uniqueLessons.length >= 8) return "Özürsüz Tam Gün";
  if (uniqueLessons.length === 4 && (uniqueLessons.every((lesson) => lesson <= 4) || uniqueLessons.every((lesson) => lesson >= 5))) {
    return "Özürsüz Yarım Gün";
  }
  return "Kontrol Gerekli";
};

export default function EOkulAttendanceTransferPreview({ records }: { records: AttendanceOpticalRecord[] }) {
  const rows = useMemo<TransferRow[]>(() => records.flatMap((record) => record.absentStudents.map((student) => ({
    key: `${record.id}-${student.studentId}`,
    date: record.date,
    classroomName: record.classroomName,
    studentNumber: student.studentNumber,
    studentName: student.studentName,
    lessons: student.lessons,
    kind: inferTransferKind(student.lessons),
  }))), [records]);

  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [kinds, setKinds] = useState<Record<string, TransferKind>>({});
  const selectedCount = rows.filter((row) => approved[row.key]).length;

  const exportApprovedRows = () => {
    const exportRows = rows.filter((row) => approved[row.key]).map((row) => ({
      Tarih: row.date.split("-").reverse().join("."),
      Şube: row.classroomName,
      "Okul No": row.studentNumber,
      "Adı Soyadı": row.studentName,
      "İşaretli Dersler": row.lessons.join(", "),
      "e-Okul Giriş Türü": kinds[row.key] || row.kind,
      "Kontrol Durumu": "Onaylandı",
    }));
    if (!exportRows.length) return;
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, "e-Okul Önizleme");
    XLSX.writeFile(workbook, `e-okul-devamsizlik-onizleme-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return <section className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-sky-100 bg-gradient-to-r from-sky-700 to-cyan-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-white/15 p-2"><ShieldCheck className="h-5 w-5" /></span>
        <div><h3 className="text-sm font-black">e-Okul Aktarım Önizlemesi</h3><p className="mt-0.5 text-[11px] font-medium text-sky-50">Optik kayıtları kontrol edin; onaylananları veri giriş listesi olarak hazırlayın.</p></div>
      </div>
      <button type="button" onClick={exportApprovedRows} disabled={!selectedCount} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[14.67px] font-black text-sky-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
        <FileSpreadsheet className="h-4 w-4" /> Onaylananları Excel'e Aktar ({selectedCount})
      </button>
    </div>

    <div className="flex gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 text-[11px] font-semibold leading-relaxed text-amber-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Bu ekran MEB'e otomatik veri göndermez. Ders işaretleri tam/yarım gün bilgisine her zaman doğrudan dönüşmediği için yetkili kullanıcı e-Okul giriş türünü kontrol etmelidir.</span>
    </div>

    {rows.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-black text-slate-500">Aktarıma hazırlanacak devamsızlık kaydı yok.</p><p className="mt-1 text-xs font-medium text-slate-400">Optik fiş okutup kaydettiğinizde öğrenciler burada ayrı satırlar hâlinde görünecek.</p></div> : <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="w-14 px-4 py-3 text-center">Onay</th><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Şube</th><th className="px-4 py-3 text-left">Okul No</th><th className="px-4 py-3 text-left">Öğrenci</th><th className="px-4 py-3 text-left">Girmediği Dersler</th><th className="min-w-52 px-4 py-3 text-left">e-Okul Giriş Türü</th><th className="px-4 py-3 text-left">Durum</th></tr></thead>
        <tbody>{rows.map((row) => {
          const selectedKind = kinds[row.key] || row.kind;
          const isApproved = Boolean(approved[row.key]);
          return <tr key={row.key} className={`border-t border-slate-100 ${isApproved ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}>
            <td className="px-4 py-3 text-center"><input aria-label={`${row.studentName} kaydını onayla`} type="checkbox" checked={isApproved} onChange={(event) => setApproved((current) => ({ ...current, [row.key]: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></td>
            <td className="px-4 py-3 font-bold text-slate-700">{row.date.split("-").reverse().join(".")}</td>
            <td className="px-4 py-3 font-black text-slate-900">{row.classroomName}</td>
            <td className="px-4 py-3 font-bold text-slate-700">{row.studentNumber}</td>
            <td className="px-4 py-3 font-black text-slate-900">{row.studentName}</td>
            <td className="px-4 py-3"><span className="rounded-lg bg-rose-50 px-2 py-1 font-black text-rose-700">{row.lessons.join(", ")}. ders</span></td>
            <td className="px-4 py-3"><select value={selectedKind} onChange={(event) => setKinds((current) => ({ ...current, [row.key]: event.target.value as TransferKind }))} className={`h-9 w-full rounded-lg border px-2 font-bold outline-none ${selectedKind === "Kontrol Gerekli" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}><option>Kontrol Gerekli</option><option>Özürsüz Yarım Gün</option><option>Özürsüz Tam Gün</option></select></td>
            <td className="px-4 py-3">{isApproved ? <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 font-black text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Onaylandı</span> : <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-500">Bekliyor</span>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}
