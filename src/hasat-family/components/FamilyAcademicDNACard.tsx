import React from "react";
import {Dna} from "lucide-react";
import {HasatCard} from "../../design-system";
import type {AcademicDNAItem} from "./familyTypes";

export function FamilyAcademicDNACard({items,onOpen}:{items:AcademicDNAItem[];onOpen?:()=>void}){
  return <HasatCard onClick={onOpen} className="p-4">
    <div className="flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Akademik DNA</span><h3 className="mt-1 text-base font-black text-slate-900">Öğrenme Profili</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Dna className="h-5 w-5"/></div></div>
    {items.length?<div className="mt-4 space-y-3">{items.slice(0,5).map((item,index)=><div key={`${item.label}-${index}`}><div className="flex items-center justify-between text-[10px]"><span className="font-bold text-slate-600">{item.label}</span><strong className="text-slate-900">%{Math.round(item.value)}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-700" style={{width:`${Math.max(0,Math.min(100,item.value))}%`}}/></div></div>)}</div>:<div className="mt-4 rounded-2xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-500">Akademik DNA için henüz yeterli sınav verisi bulunmuyor.</div>}
  </HasatCard>;
}
