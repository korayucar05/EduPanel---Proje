import React from "react";
import {BookOpenCheck,Clock3,TrendingUp} from "lucide-react";
import {HasatCard} from "../../design-system";
import type {ReportSubjectPriority} from "../../reports-v2/types";

export function FamilyPriorityCard({priorities,onOpen}:{priorities:ReportSubjectPriority[];onOpen?:()=>void}){
  if(!priorities.length)return null;
  return <HasatCard onClick={onOpen} className="overflow-hidden p-0">
    <div className="bg-gradient-to-r from-[#0f4c6d] to-[#13a66d] p-4 text-white">
      <div className="flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-100">Ders Öncelikleri</span><h3 className="mt-1 text-base font-black">Bu Hafta Nereden Başlamalı?</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/14"><BookOpenCheck className="h-5 w-5"/></div></div>
    </div>
    <div className="divide-y divide-slate-100 bg-white">{priorities.slice(0,3).map((item,index)=><div key={`${item.subject}-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Öncelik {item.priority}</span><h4 className="mt-1 truncate text-sm font-black text-slate-900">{item.subject}</h4></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">%{Math.round(item.successRate)}</span></div>
      <p className="mt-2 text-[10px] leading-5 text-slate-500">{item.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2"><span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700"><Clock3 className="h-3 w-3"/>{item.weeklyMinutes} dk/hafta</span><span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700"><TrendingUp className="h-3 w-3"/>+{item.suggestedGain.toFixed(1)} net fırsatı</span></div>
    </div>)}</div>
  </HasatCard>;
}
