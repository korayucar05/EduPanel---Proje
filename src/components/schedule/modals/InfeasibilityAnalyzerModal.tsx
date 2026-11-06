import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, Search, X } from "lucide-react";
import type { InfeasibilityItem } from "../../../services/schedule/infeasibilityAnalyzer";
import { summarizeInfeasibility } from "../../../services/schedule/infeasibilityAnalyzer";

interface Props { open: boolean; onClose: () => void; items: InfeasibilityItem[]; }

export default function InfeasibilityAnalyzerModal({ open, onClose, items }: Props) {
  const [query, setQuery] = useState("");
  const [onlyZeroDomain, setOnlyZeroDomain] = useState(false);
  const summary = useMemo(() => summarizeInfeasibility(items), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.className} ${item.courseName} ${item.teacherNames.join(" ")} ${item.reasons.join(" ")}`.toLocaleLowerCase("tr-TR");
    return (!query || haystack.includes(query.toLocaleLowerCase("tr-TR"))) && (!onlyZeroDomain || item.legalCandidateSlots === 0);
  }), [items, onlyZeroDomain, query]);
  if (!open) return null;

  return <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-6 py-5">
        <div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><AlertTriangle className="h-5 w-5 text-amber-500"/>Yerleşemeyen Ders Analizi</h3><p className="mt-1 text-xs font-semibold text-slate-500">Her blok için domain, kapalı saat, öğretmen ve grup çakışmalarını açıklar.</p></div>
        <button onClick={onClose} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-50"><X className="h-5 w-5"/></button>
      </header>
      <div className="grid grid-cols-2 gap-3 border-b bg-slate-50 px-6 py-4 md:grid-cols-4">
        <Stat label="Yerleşmeyen blok" value={summary.totalBlocks}/><Stat label="Domaini sıfır" value={summary.zeroDomainBlocks}/><Stat label="Yasal adayı olan" value={summary.totalBlocks-summary.zeroDomainBlocks}/><Stat label="Filtrelenen" value={filtered.length}/>
      </div>
      <div className="flex flex-wrap gap-2 border-b px-6 py-3">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border bg-white px-3"><Search className="h-4 w-4 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Sınıf, ders veya öğretmen ara" className="h-10 flex-1 bg-transparent text-xs outline-none"/></label>
        <button onClick={()=>setOnlyZeroDomain((v)=>!v)} className={`inline-flex items-center gap-2 rounded-xl border px-4 text-xs font-black ${onlyZeroDomain?"border-rose-300 bg-rose-50 text-rose-700":"border-slate-200 bg-white text-slate-600"}`}><Filter className="h-4 w-4"/>Sadece domaini sıfır</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {summary.topReasons.length>0&&<div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-800">En sık nedenler</h4><div className="flex flex-wrap gap-2">{summary.topReasons.map((reason)=><span key={reason.label} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-amber-900 shadow-sm">{reason.label}: {reason.count}</span>)}</div></div>}
        <div className="space-y-4">{filtered.map((item)=><article key={item.blockId} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-black text-slate-900">{item.className} / {item.courseName}</h4><p className="mt-1 text-xs font-semibold text-slate-500">{item.teacherNames.join(", ")||"Öğretmen atanmamış"} · {item.duration} saatlik blok</p></div><span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.legalCandidateSlots===0?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-800"}`}>{item.legalCandidateSlots}/{item.totalCandidateSlots} uygun aday</span></div>
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">{item.summary}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">{item.reasonDetails.map((reason)=><div key={reason.code} className={`rounded-xl border p-3 ${reason.severity==="critical"?"border-rose-200 bg-rose-50":reason.severity==="warning"?"border-amber-200 bg-amber-50":"border-sky-200 bg-sky-50"}`}><div className="flex justify-between gap-2 text-xs font-black"><span>{reason.label}</span><span>{reason.count}</span></div><p className="mt-1 text-[11px] font-medium text-slate-600">{reason.detail}</p></div>)}</div>
          {item.suggestedActions.length>0&&<div className="mt-3"><h5 className="mb-1 text-[11px] font-black uppercase text-emerald-700">Önerilen düzeltmeler</h5>{item.suggestedActions.map((action)=><p key={action} className="flex items-start gap-2 py-1 text-xs font-semibold text-slate-700"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"/>{action}</p>)}</div>}
        </article>)}{filtered.length===0&&<div className="py-16 text-center text-sm font-bold text-slate-400">Gösterilecek yerleşemeyen ders bulunamadı.</div>}</div>
      </div>
    </div>
  </div>;
}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-xl border bg-white p-3"><div className="text-xl font-black text-slate-900">{value}</div><div className="text-[10px] font-bold uppercase text-slate-500">{label}</div></div>}
