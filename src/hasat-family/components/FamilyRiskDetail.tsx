import React from "react";
import {AlertTriangle,CheckCircle2} from "lucide-react";
import {HasatCard,HasatEmptyState,HasatPageIntro} from "../../design-system";
import type {ReportIntelligenceRisk} from "../../reports-v2/types";

export function FamilyRiskDetail({risks}:{risks:ReportIntelligenceRisk[]}){
  return <div className="space-y-4">
    <HasatPageIntro eyebrow="Erken Uyarı" title="Akademik Riskler" description="Riskler sınav verisinden hesaplanır ve her biri için uygulanabilir bir sonraki adım gösterilir."/>
    {risks.length?risks.map((risk,index)=><HasatCard key={`${risk.key}-${index}`} className="p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${risk.level==="high"?"bg-rose-50 text-rose-700":risk.level==="medium"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}><AlertTriangle className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black text-slate-900">{risk.title}</h3>{risk.metric&&<span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{risk.metric}</span>}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">{risk.detail}</p><div className="mt-3 flex gap-2 rounded-2xl bg-emerald-50 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><p className="text-[10px] leading-5 text-emerald-800">{risk.action}</p></div></div>
      </div>
    </HasatCard>):<HasatEmptyState title="Belirgin akademik risk yok" description="Mevcut sınav verisinde öncelikli müdahale gerektiren bir risk tespit edilmedi." icon={CheckCircle2}/>}
  </div>;
}
