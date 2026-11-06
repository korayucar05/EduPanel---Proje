import React from "react";
import {AlertTriangle,ChevronRight,ShieldCheck} from "lucide-react";
import {HasatCard} from "../../design-system";
import type {ReportIntelligenceRisk} from "../../reports-v2/types";

const tone={
  high:{box:"bg-rose-50 border-rose-100",icon:"bg-rose-100 text-rose-700",text:"text-rose-800",badge:"bg-rose-100 text-rose-700",label:"Yüksek"},
  medium:{box:"bg-amber-50 border-amber-100",icon:"bg-amber-100 text-amber-700",text:"text-amber-800",badge:"bg-amber-100 text-amber-700",label:"Orta"},
  low:{box:"bg-emerald-50 border-emerald-100",icon:"bg-emerald-100 text-emerald-700",text:"text-emerald-800",badge:"bg-emerald-100 text-emerald-700",label:"Düşük"},
} as const;

export function FamilyRiskCard({risks,onOpen}:{risks:ReportIntelligenceRisk[];onOpen?:()=>void}){
  if(!risks.length){
    return <HasatCard className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5"/></div>
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Erken Uyarı</span><h3 className="mt-1 text-sm font-black text-slate-900">Belirgin risk görünmüyor</h3></div>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-slate-500">Mevcut sınav verisinde öncelikli bir akademik risk tespit edilmedi.</p>
    </HasatCard>;
  }

  const primary=risks[0];
  const palette=tone[primary.level];

  return <HasatCard onClick={onOpen} className={`p-4 ${palette.box}`}>
    <div className="flex items-start gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${palette.icon}`}><AlertTriangle className="h-5 w-5"/></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Erken Uyarı</span><span className={`rounded-full px-2 py-1 text-[8px] font-black ${palette.badge}`}>{palette.label}</span></div>
        <h3 className={`mt-1 text-sm font-black ${palette.text}`}>{primary.title}</h3>
        <p className="mt-2 text-[10px] leading-5 text-slate-600">{primary.detail}</p>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[9px] font-semibold text-slate-500">{risks.length} risk alanı tespit edildi</span><ChevronRight className="h-4 w-4 text-slate-400"/></div>
      </div>
    </div>
  </HasatCard>;
}
