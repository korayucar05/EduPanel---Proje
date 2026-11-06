import React from "react";
import {Download,Loader2,Printer,X} from "lucide-react";
import {buildInstitutionReportV2Data} from "./buildInstitutionReportV2Data";
import {InstitutionReportV2} from "./InstitutionReportV2";
import {downloadInstitutionReportV2Pdf} from "./exportInstitutionReportV2Pdf";

export default function InstitutionReportV2Modal({exam,results,onClose}:{exam:any;results:any[];onClose:()=>void}){
  const [exporting,setExporting]=React.useState(false);
  const report=React.useMemo(()=>buildInstitutionReportV2Data(exam,results),[exam,results]);
  const download=async()=>{setExporting(true);try{await downloadInstitutionReportV2Pdf(report,`${report.examName.replace(/\s+/g,"_")}_Kurum_Raporu_V2.pdf`);}catch(error:any){window.alert(error?.message||"Kurum raporu PDF oluşturulamadı.");}finally{setExporting(false);}};
  return <div className="fixed inset-0 z-[180] flex flex-col bg-slate-950/85 backdrop-blur-sm"><header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-5 py-3 text-white print:hidden"><div><h2 className="text-sm font-black">Karşılaştırmalı Kurum Sınav Raporu V2 Premium</h2><p className="text-[11px] text-slate-400">Yönetici özeti, şube/ders karşılaştırmaları, risk alanları ve eylem planı</p></div><div className="flex items-center gap-2"><button onClick={download} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500 disabled:opacity-60">{exporting?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}{exporting?"PDF hazırlanıyor":"PDF indir"}</button><button onClick={()=>window.print()} className="rounded-lg p-2 hover:bg-emerald-600" title="Yazdır"><Printer className="h-5 w-5"/></button><button onClick={onClose} className="rounded-lg p-2 hover:bg-rose-600" title="Kapat"><X className="h-5 w-5"/></button></div></header><main className="min-h-0 flex-1 overflow-auto bg-slate-200 p-6 print:overflow-visible print:bg-white print:p-0"><InstitutionReportV2 report={report}/></main></div>;
}
