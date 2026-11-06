import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Printer,
  QrCode,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { Student } from "../types";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { syncCollectionToLocalDatabase } from "../lib/localDatabase";
import appStateService from "../core/state/AppStateService";

interface Props {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

type View = "menu" | "deleted" | "new" | "excel" | "qr" | "commitment";
const DELETED_KEY = "student_deleted_records_v1";

const getGrade = (student: Student) => {
  const match = String(student.classroom || "").trim().match(/^(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const normalizeGroup = (group?: string) => {
  const value = String(group || "").trim().toLocaleUpperCase("tr-TR");
  if (value === "SAY" || value === "SAYISAL") return "SAY";
  if (value === "EA" || value === "EŞİT AĞIRLIK") return "EA";
  if (value === "DİL") return "DİL";
  if (value === "SÖZ" || value === "SÖZEL") return "SÖZ";
  return "";
};

export default function StudentArchiveModule({ students, setStudents }: Props) {
  const [view, setView] = useState<View>("menu");
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
  const [qrUrl, setQrUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [copied, setCopied] = useState(false);
  const [commitmentGrade, setCommitmentGrade] = useState("");
  const [commitmentClassroom, setCommitmentClassroom] = useState("");

  const refreshDeleted = () => {
    try {
      const parsed = JSON.parse(sqliteStorage.getItem(DELETED_KEY) || "[]");
      setDeletedRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDeletedRecords([]);
    }
  };

  useEffect(() => {
    if (view === "deleted") refreshDeleted();
  }, [view]);

  useEffect(() => {
    if (view !== "qr") return;
    let cancelled = false;
    setQrError("");
    const origin = window.location.origin;
    const isPublicOrigin = !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?$/i.test(origin);
    if (isPublicOrigin) {
      setQrUrl(`${origin}/?mode=student-register`);
      return;
    }
    setQrUrl("");
    fetch("/api/public/student-registration/link", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "QR kayıt bağlantısı hazırlanamadı.");
        if (!cancelled) setQrUrl(String(data.url || ""));
      })
      .catch((error) => !cancelled && setQrError(error instanceof Error ? error.message : "QR kayıt bağlantısı hazırlanamadı."));
    return () => { cancelled = true; };
  }, [view]);

  const academicYearStart = useMemo(() => {
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 8, 1);
  }, []);

  const newStudents = useMemo(() => students
    .filter((student) => {
      if (!student.registerDate) return false;
      const date = new Date(student.registerDate);
      return Number.isFinite(date.getTime()) && date >= academicYearStart;
    })
    .slice()
    .sort((a, b) => String(b.registerDate || "").localeCompare(String(a.registerDate || ""))), [students, academicYearStart]);

  const gradeOptions = useMemo(() => Array.from(new Set(students.map(getGrade).filter((item): item is number => item !== null))).sort((a, b) => a - b), [students]);
  const classroomOptions = useMemo(() => {
    if (!commitmentGrade) return [];
    return Array.from(new Set(students.filter((student) => getGrade(student) === Number(commitmentGrade)).map((student) => String(student.classroom || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }));
  }, [students, commitmentGrade]);
  const commitmentStudents = useMemo(() => students
    .filter((student) => String(student.classroom || "").trim() === commitmentClassroom)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "tr", { numeric: true })), [students, commitmentClassroom]);

  const persistStudents = async (next: Student[]) => {
    setStudents(next);
    try {
      await Promise.all([
        syncCollectionToLocalDatabase("students", next),
        syncCollectionToLocalDatabase("school_students", next),
        appStateService.setItem("school_students", next),
      ]);
      sqliteStorage.setItem("school_students", JSON.stringify(next));
      window.localStorage.setItem("school_students", JSON.stringify(next));
    } catch (error) {
      console.error("Öğrenci kayıtları veritabanına yazılamadı:", error);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "Öğrenci No": "1234",
      "Adı": "Ahmet",
      "Soyadı": "Yılmaz",
      "Sınıf": "9-A",
      "Grup": "",
      "Öğrencinin Telefonu": "",
      "Velinin Adı Soyadı": "",
      "Velinin Telefonu": "",
      "Doğum Tarihi(GG.AA.YY)": "01.01.2011",
      "Doğum Yeri": "",
      "Açık Adres": "",
      "Okul Puanı (OOB)": "",
      "Durum": "Aktif",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ogrenciler");
    XLSX.writeFile(wb, "ogrenci_kayit_sablonu.xlsx");
  };

  const importExcel = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result;
        if (!(buffer instanceof ArrayBuffer)) throw new Error("Dosya okunamadı.");
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        const headerValue = (row: any, names: string[]) => {
          const entry = Object.entries(row).find(([key]) => names.some((name) => String(key).toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]/gi, "") === name));
          return entry ? String(entry[1] ?? "").trim() : "";
        };
        const existing = new Set(students.map((student) => String(student.id).trim()));
        const added: Student[] = [];
        for (const row of rows) {
          const id = headerValue(row, ["öğrencino", "ogrencino", "okulno", "numara", "no"]);
          const first = headerValue(row, ["adı", "adi", "ad"]);
          const last = headerValue(row, ["soyadı", "soyadi", "soyad"]);
          const full = headerValue(row, ["adsoyad", "adısoyadı", "adisoyadi"]);
          const name = `${first} ${last}`.trim() || full;
          const classroom = headerValue(row, ["sınıf", "sinif", "sınıfşube", "sinifsube", "şube", "sube"])
            .replace(/(\d+)\s*[-/.]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/g, "$1-$2")
            .toLocaleUpperCase("tr-TR");
          if (!id || !name || !classroom || existing.has(id)) continue;
          existing.add(id);
          added.push({
            id,
            name,
            classroom,
            group: normalizeGroup(headerValue(row, ["grup", "alan"])) || undefined,
            phone: headerValue(row, ["öğrencinintelefonu", "ogrencinintelefonu", "telefon"]),
            parentName: headerValue(row, ["velininadısoyadı", "velininadisoyadi", "veliadsoyad"]),
            parentPhone: headerValue(row, ["velinintelefonu", "velitelefonu"]),
            registerDate: new Date().toISOString(),
            status: "Aktif",
            avatar: "",
          } as Student);
        }
        if (!added.length) {
          alert("Aktarılabilecek yeni öğrenci bulunamadı.");
          return;
        }
        await persistStudents([...added, ...students]);
        alert(`${added.length} öğrenci başarıyla kaydedildi.`);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Excel dosyası okunamadı.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const createCommitmentPdf = async (mode: "download" | "print") => {
    if (!commitmentClassroom || commitmentStudents.length === 0) {
      alert("PDF oluşturmak için sınıf / şube seçiniz.");
      return;
    }
    const { PdfEngine } = await import("../pdf");
    const content: any[] = [];
    commitmentStudents.forEach((student, index) => {
      if (index && index % 4 === 0) content.push({ text: "", pageBreak: "after" });
      content.push({
        table: {
          widths: [80, "*", 80, "*"],
          body: [
            ["Öğrenci No", String(student.id || "—"), "Sınıf / Şube", String(student.classroom || "—")],
            ["Ad Soyad", String(student.name || "—"), "Grup / Alan", String(student.group || "—")],
            ["Öğrenci Tel", String(student.phone || "—"), "Veli", String(student.parentName || "—")],
            ["Veli Tel", String(student.parentPhone || "—"), "", ""],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 5],
      }, {
        text: "Verdiğim bilgilerin doğru olduğunu taahhüt ederim.\n\nTarih: …… / …… / 20……                         Öğrenci Adı Soyadı: ____________________                         İmza: ____________________",
        fontSize: 8.5,
        italics: true,
        margin: [2, 0, 0, 10],
      });
    });
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [28, 24, 28, 24],
      content: [
        { text: "ÖĞRENCİ BİLGİ TAAHHÜTNAMESİ", alignment: "center", fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        { text: commitmentClassroom, alignment: "center", fontSize: 11, bold: true, color: "#475569", margin: [0, 0, 0, 10] },
        ...content,
      ],
    }, { mode, filename: `${commitmentClassroom.replace(/\s+/g, "_")}_ogrenci_bilgi_taahhutnamesi.pdf` });
  };

  const printQr = () => {
    if (!qrUrl) return;
    const popup = window.open("", "_blank", "width=760,height=1000");
    if (!popup) return;
    const image = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(qrUrl)}`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Öğrenci Kayıt QR</title><style>@page{size:A5 portrait;margin:12mm}body{font-family:Arial;text-align:center;color:#0f172a}img{width:112mm;height:112mm;margin:8mm auto}</style></head><body><h1>ÖĞRENCİ BİLGİ KAYIT FORMU</h1><img src="${image}"><p>${qrUrl}</p><script>document.querySelector('img').addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
    popup.document.close();
  };

  const header = (title: string) => (
    <div className="mb-4 flex items-center gap-3">
      <button type="button" onClick={() => setView("menu")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Arşiv</button>
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
    </div>
  );

  if (view === "deleted" || view === "new") {
    const rows = view === "deleted" ? deletedRecords : newStudents;
    return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {header(view === "deleted" ? "Kaydı Silinenler" : "Sene İçinde Yeni Gelenler")}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-900 text-white"><tr><th className="px-3 py-3">Öğrenci No</th><th className="px-3 py-3">Ad Soyad</th><th className="px-3 py-3">Sınıf</th><th className="px-3 py-3">Tarih</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((student: any, index: number) => <tr key={`${student.id}-${index}`}><td className="px-3 py-2 font-mono font-bold">{student.id || "—"}</td><td className="px-3 py-2 font-black">{student.name || "—"}</td><td className="px-3 py-2">{student.classroom || "—"}</td><td className="px-3 py-2 text-slate-500">{view === "deleted" ? (student.deletedAt ? new Date(student.deletedAt).toLocaleString("tr-TR") : "—") : (student.registerDate || "—")}</td></tr>)}</tbody></table>
        {rows.length === 0 && <div className="p-10 text-center text-sm font-bold text-slate-400">Kayıt bulunamadı.</div>}
      </div>
    </div>;
  }

  if (view === "excel") return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{header("Excel ile Toplu Kayıt")}<div className="grid gap-4 md:grid-cols-2"><button type="button" onClick={downloadTemplate} className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-left"><FileSpreadsheet className="h-8 w-8 text-blue-600"/><div className="mt-3 font-black">Excel Şablonunu İndir</div></button><label className="cursor-pointer rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-6"><FileSpreadsheet className="h-8 w-8 text-emerald-600"/><div className="mt-3 font-black">Excel Dosyası Seç</div><input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { importExcel(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label></div></div>;

  if (view === "qr") return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{header("QR Kod ile Kayıt")}<div className="mx-auto max-w-xl text-center">{qrUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrUrl)}`} alt="Öğrenci kayıt QR" className="mx-auto h-64 w-64 rounded-2xl border bg-white p-3"/> : <div className="p-10 font-bold text-slate-500">{qrError || "Bağlantı hazırlanıyor..."}</div>}<div className="mt-4 flex flex-wrap justify-center gap-2"><button disabled={!qrUrl} onClick={() => { navigator.clipboard.writeText(qrUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Copy className="h-4 w-4"/>{copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}</button><a href={qrUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700"><ExternalLink className="h-4 w-4"/>Aç</a><button disabled={!qrUrl} onClick={printQr} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Printer className="h-4 w-4"/>Yazdır</button></div></div></div>;

  if (view === "commitment") return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{header("Öğrenci Bilgi Taahhütnamesi")}<div className="grid gap-3 md:grid-cols-[220px_1fr_auto_auto]"><select value={commitmentGrade} onChange={(e) => { setCommitmentGrade(e.target.value); setCommitmentClassroom(""); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-black"><option value="">Sınıf seviyesi</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}. Sınıf</option>)}</select><select value={commitmentClassroom} onChange={(e) => setCommitmentClassroom(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-black"><option value="">Sınıf / Şube</option>{classroomOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><button onClick={() => void createCommitmentPdf("print")} className="rounded-xl bg-slate-900 px-4 text-xs font-black text-white">Yazdır</button><button onClick={() => void createCommitmentPdf("download")} className="rounded-xl bg-violet-700 px-4 text-xs font-black text-white">PDF İndir</button></div><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">{commitmentClassroom ? `${commitmentClassroom}: ${commitmentStudents.length} öğrenci` : "Sınıf / şube seçiniz."}</div></div>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button type="button" onClick={() => setView("excel")} className="rounded-3xl border border-emerald-200 bg-white p-6 text-left shadow-sm hover:border-emerald-400"><FileSpreadsheet className="h-8 w-8 text-emerald-600"/><h3 className="mt-4 text-lg font-black">Excel ile Toplu Kayıt</h3><p className="mt-2 text-xs font-semibold text-slate-500">Excel dosyasındaki öğrencileri toplu olarak sisteme aktarın.</p></button>
        <button type="button" onClick={() => setView("deleted")} className="rounded-3xl border border-rose-200 bg-white p-6 text-left shadow-sm hover:border-rose-400"><Trash2 className="h-8 w-8 text-rose-600"/><h3 className="mt-4 text-lg font-black">Kaydı Silinenler</h3><p className="mt-2 text-xs font-semibold text-slate-500">Sistemden silinen öğrenci kayıtlarını görüntüleyin.</p></button>
        <button type="button" onClick={() => setView("new")} className="rounded-3xl border border-blue-200 bg-white p-6 text-left shadow-sm hover:border-blue-400"><UserPlus className="h-8 w-8 text-blue-600"/><h3 className="mt-4 text-lg font-black">Sene İçinde Yeni Gelenler</h3><p className="mt-2 text-xs font-semibold text-slate-500">Bu eğitim-öğretim yılı içinde kaydedilen öğrencileri görüntüleyin.</p></button>
        <button type="button" onClick={() => setView("commitment")} className="rounded-3xl border border-violet-200 bg-white p-6 text-left shadow-sm hover:border-violet-400"><ClipboardCheck className="h-8 w-8 text-violet-600"/><h3 className="mt-4 text-lg font-black">Taahhütname</h3><p className="mt-2 text-xs font-semibold text-slate-500">Öğrenci bilgi taahhütnamelerini sınıf bazında hazırlayın.</p></button>
        <button type="button" onClick={() => setView("qr")} className="rounded-3xl border border-cyan-200 bg-white p-6 text-left shadow-sm hover:border-cyan-400"><QrCode className="h-8 w-8 text-cyan-600"/><h3 className="mt-4 text-lg font-black">QR Kod ile Kayıt</h3><p className="mt-2 text-xs font-semibold text-slate-500">Ortak öğrenci kayıt QR kodunu açın ve paylaşın.</p></button>
      </div>
    </div>
  );
}
