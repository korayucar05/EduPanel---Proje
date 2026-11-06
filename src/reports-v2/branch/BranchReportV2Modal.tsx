import React, {useMemo, useState} from "react";
import { Download, X } from "lucide-react";
import { BranchReportV2 } from "./BranchReportV2";
import { buildBranchReportV2Data, getBranchSubjectNames } from "./buildBranchReportV2Data";
import { exportBranchReportV2Pdf } from "./exportBranchReportV2Pdf";

export function BranchReportV2Modal({exam,results,onClose}:{exam:any;results:any[];onClose:()=>void}){
  const subjects=useMemo(()=>getBranchSubjectNames(results),[results]);
  const [selectedSubject,setSelectedSubject]=useState(subjects[0]||"");
  const [exporting,setExporting]=useState(false);
  const report=useMemo(()=>buildBranchReportV2Data(exam,results,selectedSubject),[exam,results,selectedSubject]);

  const exportPdf=async()=>{
    setExporting(true);
    try{await exportBranchReportV2Pdf(report);}
    finally{setExporting(false);}
  };

  return <div className="fixed inset-0 z-[170] flex flex-col bg-slate-950/70 backdrop-blur-sm">
    <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3 text-white">
      <div>
        <h3 className="font-black">Branş Raporu V2 Premium</h3>
        <p className="mt-1 text-[11px] text-slate-300">Şube karşılaştırması, öğrenci risk listesi ve branş eylem planı</p>
      </div>
      <div className="flex items-center gap-2">
        <select value={selectedSubject} onChange={event=>setSelectedSubject(event.target.value)} className="rounded-xl border border-white/20 bg-white px-3 py-2 text-xs font-bold text-slate-900">
          {subjects.map(item=><option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={exportPdf} disabled={exporting} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black hover:bg-teal-700 disabled:bg-slate-500">
          <Download className="h-4 w-4"/>{exporting?"PDF hazırlanıyor...":"PDF indir"}
        </button>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10" title="Kapat"><X className="h-5 w-5"/></button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto"><BranchReportV2 report={report}/></div>
  </div>;
}
