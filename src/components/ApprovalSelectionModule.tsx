import React, { useEffect, useMemo, useState } from "react";
import { Check, FileDown, Save, Search } from "lucide-react";
import type { Classroom, Student } from "../types";
import { getStudentClassroom, getStudentName, getStudentNumber } from "../core/student/studentIdentity";
import appStateService from "../core/state/AppStateService";
import { PdfEngine } from "../pdf/core/PdfEngine";

type ApprovalData = { variables: string[]; marks: Record<string, string> };
const keyFor = (id: string) => `assignment_approval_variables_v1_${id}`;
const sort = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });
export default function ApprovalSelectionModule({ students, definitionId, definitionTitle }: { students: Student[]; classrooms: Classroom[]; definitionId: string; definitionTitle: string }) {
  const [data, setData] = useState<ApprovalData>({ variables: [], marks: {} });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [variable, setVariable] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [message, setMessage] = useState("");
  const roster = useMemo(() => students.filter(s => String(s.status || "Aktif").toLocaleLowerCase("tr-TR") !== "pasif")
    .map(s => ({ id: String(s.id || getStudentNumber(s)).trim(), name: getStudentName(s), no: getStudentNumber(s), classroom: getStudentClassroom(s) || String(s.classId || "") }))
    .filter(s => s.id && s.name).sort((a, b) => sort(a.classroom, b.classroom) || sort(a.no, b.no) || sort(a.name, b.name)), [students]);
  const filtered = useMemo(() => roster.filter(s => !data.marks[s.id] && !selected.includes(s.id) && (!query || `${s.name} ${s.no}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")))), [roster, data.marks, selected, query]);
  const selectedRows = useMemo(() => roster.filter(s => selected.includes(s.id) || Boolean(data.marks[s.id])), [roster, selected, data.marks]);
  useEffect(() => {
    let mounted = true;
    setLoading(true); setData({ variables: [], marks: {} }); setVariable(""); setSelected([]); setMessage("");
    appStateService.getItem<ApprovalData>(keyFor(definitionId)).then(saved => {
      if (!mounted) return;
      const variables = Array.isArray(saved?.variables) ? saved.variables.filter(v => typeof v === "string") : [];
      setData({ variables, marks: saved?.marks && typeof saved.marks === "object" ? saved.marks : {} });
      setVariable(variables[0] || "");
    }).catch(() => { if (mounted) setMessage("Onay kayıtları yüklenemedi. Lütfen yeniden açın."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [definitionId]);
  const persist = async (next: ApprovalData, notice: string) => {
    if (saving || loading) return;
    setSaving(true); setMessage("");
    try { await appStateService.setItem(keyFor(definitionId), next); setData(next); setMessage(notice); }
    catch { setMessage("Kayıt yapılamadı. Yeniden deneyin."); }
    finally { setSaving(false); }
  };
  const markSelected = async () => {
    if (!selected.length) return;
    const marks = { ...data.marks };
    selected.forEach(id => { marks[id] = variable || "Seçilmedi"; });
    await persist({ ...data, marks }, "Öğrencilerin değişkenleri kaydedildi.");
    setSelected([]);
  };
  const clearSelected = async () => {
    if (!selected.length) return;
    const marks = { ...data.marks };
    selected.forEach(id => { delete marks[id]; });
    await persist({ ...data, marks }, "Seçili öğrencilerin işaretlemeleri kaldırıldı.");
    setSelected([]);
  };
  // Onay takip çıktılarında henüz değişken seçilmemiş öğrenciler de sınıf listesinde yer alır.
  // "Seçilmedi" önceki kayıtlardan gelen işaretleme değeri olduğundan boş gösterilir.
  const displayedVariable = (id: string) => {
    const value = String(data.marks[id] || "").trim();
    return value === "Seçilmedi" ? "" : value;
  };
  const exportGroups = useMemo(() => {
    const groups = new Map<string, typeof roster>();
    roster.forEach((person) => {
      const classroom = person.classroom || "Sınıf Belirtilmemiş";
      const group = groups.get(classroom) || [];
      group.push(person);
      groups.set(classroom, group);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => sort(a, b))
      .map(([classroom, people]) => ({
        classroom,
        people: [...people].sort((a, b) => sort(a.no, b.no) || sort(a.name, b.name)),
      }));
  }, [roster]);
  const exportTitle = (definitionTitle || "Onay Listesi").trim();
  const exportFileBase = (exportTitle.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "Onay_Listesi");

  const exportExcel = async () => {
    if (loading || !roster.length) return;
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.utils.book_new();
      const sheetNames = new Set<string>();
      exportGroups.forEach(({ classroom, people }) => {
        const rows: (string | number)[][] = [
          [exportTitle.toLocaleUpperCase("tr-TR")],
          [`${classroom} SINIFI`],
          [],
          ["S.", "Sınıf", "No.", "Adı Soyadı", "Onay Değişkeni"],
          ...people.map((person, index) => [index + 1, person.classroom, person.no, person.name, displayedVariable(person.id)]),
        ];
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        ];
        sheet["!cols"] = [{ wch: 5 }, { wch: 13 }, { wch: 11 }, { wch: 35 }, { wch: 24 }];
        sheet["!margins"] = { left: .25, right: .25, top: .5, bottom: .5, header: .2, footer: .2 };
        sheet["!pageSetup"] = { paperSize: 9, orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
        const baseName = classroom.replace(/[\\/:*?\[\]]/g, " ").trim().slice(0, 31) || "Sınıf";
        let sheetName = baseName;
        let suffix = 2;
        while (sheetNames.has(sheetName)) {
          const tail = `-${suffix++}`;
          sheetName = baseName.slice(0, 31 - tail.length) + tail;
        }
        sheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(book, sheet, sheetName);
      });
      XLSX.writeFile(book, `${exportFileBase}.xlsx`);
    } catch (err) { setMessage(`Excel oluşturulamadı: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`); }
  };
  const exportPdf = async () => {
    if (generatingPdf || loading) return;
    if (!roster.length) { setMessage("PDF için öğrenci kaydı bulunamadı."); return; }
    setGeneratingPdf(true); setMessage("");
    try {
      const content: any[] = [];
      exportGroups.forEach(({ classroom, people }, groupIndex) => {
        content.push({
          text: exportTitle.toLocaleUpperCase("tr-TR"),
          alignment: "center", bold: true, fontSize: 13,
          margin: [0, 0, 0, 6],
          ...(groupIndex > 0 ? { pageBreak: "before" } : {}),
        });
        content.push({ text: `${classroom} SINIFI`, alignment: "center", bold: true, fontSize: 10, margin: [0, 0, 0, 12] });
        const tableRows = [
          ["S.", "Sınıf", "No.", "Adı Soyadı", "Onay Değişkeni"].map(value => ({
            text: value, bold: true, color: "#ffffff", fillColor: "#174067", fontSize: 9, margin: [4, 5, 4, 5],
          })),
          ...people.map((person, index) =>
            [String(index + 1), person.classroom || "—", person.no || "—", person.name, displayedVariable(person.id)]
              .map(value => ({ text: value, fontSize: 8.5, margin: [4, 3, 4, 3], fillColor: index % 2 ? "#f1f5f9" : "#ffffff" })))
        ];
        content.push({
          table: { headerRows: 1, widths: [22, 55, 45, "*", 120], body: tableRows },
          layout: "lightHorizontalLines",
        });
      });
      await PdfEngine.generate({
        pageSize: "A4", pageOrientation: "portrait", pageMargins: [28, 38, 28, 35],
        content,
        footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: "right", margin: [0, 4, 28, 0], fontSize: 8 }),
      }, { filename: `${exportFileBase}.pdf` });
    } catch (err) { setMessage(`PDF oluşturulamadı: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`); }
    finally { setGeneratingPdf(false); }
  };
  const removeMark = async (id: string) => {
    const marks = { ...data.marks };
    delete marks[id];
    await persist({ ...data, marks }, "Öğrenci işaretlemesi kaldırıldı.");
  };
  return <div className="mx-auto max-w-7xl space-y-5 p-4">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-900">Öğrenci Seçimi</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Öğrenci adı veya numarası ara..." className="w-full rounded-xl border border-yellow-400 bg-yellow-200 py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-yellow-600" /></div>
            <select value={variable} onChange={e => setVariable(e.target.value)} className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold"><option value="">Değişken seçiniz</option>{data.variables.map(v => <option key={v} value={v}>{v}</option>)}</select>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs font-black"><button type="button" onClick={() => setSelected(s => [...new Set([...s, ...filtered.map(p => p.id)])])} className="text-teal-700">Tümünü seç</button><button type="button" onClick={() => setSelected([])} className="text-slate-500">Seçimi temizle</button><span className="ml-auto text-slate-500">{filtered.length} kişi</span></div>
          <div className="mt-3 max-h-[500px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {filtered.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-teal-50">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => setSelected(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} className="h-4 w-4 accent-teal-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-slate-900" title={p.name}>{p.name}</span>
                <span className="text-xs font-bold text-slate-600">{p.classroom || "—"} · No: {p.no || "—"}</span>
              </span>
              <span className="shrink-0 text-xs font-black text-teal-800">Seçilebilir</span>
            </label>)}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-black text-slate-900">Seçilen Öğrenciler</h2><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => void exportPdf()} disabled={generatingPdf || loading || !roster.length} className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40"><FileDown className="h-4 w-4" />PDF</button><button type="button" onClick={() => void exportExcel()} disabled={loading || !roster.length} className="rounded-lg bg-emerald-700 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40">Excel</button><button type="button" disabled={saving || loading || !selected.length} onClick={() => void markSelected()} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" />Kaydet</button><button type="button" disabled={saving || loading || !selected.length} onClick={() => setSelected([])} className="rounded-lg bg-orange-500 px-2.5 py-2 text-xs font-black text-white hover:bg-orange-600 disabled:opacity-40">Seçimi Temizle</button></div></div>
          <div className="mt-2 max-h-[500px] overflow-y-auto rounded-lg bg-white px-2 py-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_22px] gap-2 border-b border-slate-200 px-1 py-1 text-[11px] font-black text-slate-500"><span>Adı Soyadı</span><span>Değişken</span><span /></div>
            {selectedRows.map(p => <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_22px] items-center gap-2 border-b border-slate-100 px-1 py-1 text-xs leading-tight last:border-0">
              <span className="truncate font-semibold text-slate-900" title={`${p.name} (${p.classroom} / ${p.no})`}>{p.name}</span>
              <span className="truncate text-teal-700" title={data.marks[p.id] || variable || "Henüz kaydedilmedi"}>{data.marks[p.id] || variable || "Seçilmedi"}</span>
              {data.marks[p.id] ? <button type="button" disabled={saving || loading} onClick={() => void removeMark(p.id)} title="İşaretlemeyi kaldır" aria-label={`${p.name} işaretlemesini kaldır`} className="text-sm text-red-500 disabled:opacity-40">×</button> : <button type="button" onClick={() => setSelected(ids => ids.filter(id => id !== p.id))} title="Seçimden çıkar" aria-label={`${p.name} seçimini kaldır`} className="text-sm text-red-500">×</button>}
            </div>)}
            {!selectedRows.length && <p className="py-3 text-sm text-slate-400">Henüz kimse seçilmedi.</p>}
          </div>
        </div>
      </div>
      {message && <p role="status" className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700"><Check className="h-4 w-4" /> {message}</p>}
    </section>
  </div>;
}
