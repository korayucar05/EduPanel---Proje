import React from "react";
import {ArrowUpRight,School,UserRound} from "lucide-react";
import {HasatCard} from "../../design-system";

export function FamilyHeroCard({studentName,schoolName,classroom,score,trend,examName}:{
  studentName:string;schoolName:string;classroom:string;score:number;trend:number;examName:string;
}){
  return <HasatCard elevated className="relative overflow-hidden border-0 bg-gradient-to-br from-[#082f58] via-[#0f4c6d] to-[#13a66d] p-5 text-white">
    <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl"/>
    <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-amber-300/15 blur-2xl"/>
    <img src="/enstitu-logo-reverse.png" alt="" aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-16 w-auto rounded-2xl opacity-20 mix-blend-screen"/>
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/15 backdrop-blur"><UserRound className="h-6 w-6"/></div>
          <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-emerald-100">e-Nstitü AİLE</p><h2 className="mt-1 truncate text-lg font-black">{studentName||"Öğrenci"}</h2></div>
        </div>
        <div className="rounded-full bg-white/12 px-3 py-1.5 text-[10px] font-bold backdrop-blur">{classroom||"Sınıf"}</div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-semibold text-slate-200">Akademik Durum</p><div className="mt-1 flex items-end gap-2"><strong className="text-5xl font-black leading-none">{Math.round(score||0)}</strong><span className="pb-1 text-xs font-semibold text-slate-300">/100</span></div></div>
        <div className="rounded-2xl bg-white/12 px-3 py-2.5 text-right backdrop-blur"><span className="flex items-center justify-end gap-1 text-[10px] font-black text-emerald-200"><ArrowUpRight className="h-3.5 w-3.5"/>{trend>=0?"+":""}{trend.toFixed(1)}</span><span className="mt-1 block text-[9px] text-slate-200">Son sınava göre</span></div>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-black/10 px-3 py-2.5 text-[10px] text-slate-100 ring-1 ring-white/10"><School className="h-4 w-4 shrink-0 text-amber-300"/><span className="truncate">{schoolName||"Okul"}</span><span className="ml-auto truncate text-slate-300">{examName||"Son sınav"}</span></div>
    </div>
  </HasatCard>;
}
