import React,{useMemo,useState} from "react";
import {Download,X} from "lucide-react";
import {buildItemAnalysisReportData,getItemAnalysisSubjectNames} from "./buildItemAnalysisReportData";
import {ItemAnalysisReportV2} from "./ItemAnalysisReportV2";
import {exportItemAnalysisReportV2Pdf} from "./exportItemAnalysisReportV2Pdf";

export function ItemAnalysisReportV2Modal({exam,results,onClose}:{exam:any;results:any[];onClose:()=>void}){
  const subjects=useMemo(()=>getItemAnalysisSubjectNames(results),[results]);
  const [selectedSubject,setSelectedSubject]=useState(subjects[0]||"");
  const [exporting,setExporting]=useState(false);
  const report=useMemo(()=>buildItemAnalysisReportData(exam,results,selectedSubject),[exam,results,selectedSubject]);
  const exportPdf=async()=>{setExporting(true);try{await exportItemAnalysisReportV2Pdf(report);}finally{setExporting(false);}};
  return <div className="fixed inset-0 z-[180] flex flex-col bg-slate-950/70 backdrop-blur-sm">
    <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3 text-white">
      <div><h3 className="font-black">Madde Analizi V2 Premium</h3><p className="mt-1 text-[11px] text-slate-300">Soru başarısı, seçenek dağılımı ve madde eylem planı</p></div>
      <div className="flex items-center gap-2">
        <select value={selectedSubject} onChange={event=>setSelectedSubject(event.target.value)} className="rounded-xl border border-white/20 bg-white px-3 py-2 text-xs font-bold text-slate-900">{subjects.map(item=><option key={item}>{item}</option>)}</select>
        <button onClick={exportPdf} disabled={exporting} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black hover:bg-violet-700 disabled:bg-slate-500"><Download className="h-4 w-4"/>{exporting?"PDF hazırlanıyor...":"PDF indir"}</button>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5"/></button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto"><ItemAnalysisReportV2 report={report}/></div>
  </div>;
}
