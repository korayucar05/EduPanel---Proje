import React from "react";
import type {HasatTone} from "../tokens";
import {hasatToneClasses} from "../tokens";
import {HasatCard} from "./HasatCard";

export function HasatMetricCard({
  label,
  value,
  detail,
  icon:Icon,
  tone="emerald",
}:{
  label:string;
  value:string|number;
  detail?:string;
  icon?:React.ElementType;
  tone?:HasatTone;
}){
  const palette=hasatToneClasses[tone];
  return(
    <HasatCard tone={tone} className="p-4">
      {Icon&&<div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-white ${palette.text} shadow-sm`}><Icon className="h-5 w-5"/></div>}
      <span className="mt-3 block text-[9px] font-black uppercase tracking-[.12em] text-slate-400">{label}</span>
      <strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong>
      {detail&&<span className="mt-1 block text-[10px] font-semibold text-slate-500">{detail}</span>}
    </HasatCard>
  );
}
