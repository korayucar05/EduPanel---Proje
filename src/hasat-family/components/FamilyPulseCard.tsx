import React from "react";
import {Activity,ArrowUpRight,Minus,TriangleAlert} from "lucide-react";
import {HasatCard} from "../../design-system";

export function FamilyPulseCard({status,positive,warning}:{status:string;positive:string;warning?:string}){
  return <HasatCard className="p-4">
    <div className="flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">e-Nstitü Pulse</span><h3 className="mt-1 text-base font-black text-slate-900">Akademik Nabız</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Activity className="h-5 w-5"/></div></div>
    <div className="mt-4 grid gap-2">
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3"><ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><div><strong className="block text-xs text-emerald-900">{status}</strong><p className="mt-1 text-[10px] leading-5 text-emerald-700">{positive}</p></div></div>
      <div className={`flex items-start gap-3 rounded-2xl p-3 ${warning?"bg-amber-50":"bg-slate-50"}`}>{warning?<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/>:<Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/>}<p className={`text-[10px] leading-5 ${warning?"text-amber-800":"text-slate-500"}`}>{warning||"Şu anda belirgin bir risk görünmüyor."}</p></div>
    </div>
  </HasatCard>;
}
