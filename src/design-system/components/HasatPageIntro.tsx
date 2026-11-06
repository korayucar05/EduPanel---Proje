import React from "react";

export function HasatPageIntro({
  eyebrow,
  title,
  description,
}:{
  eyebrow?:string;
  title:string;
  description?:string;
}){
  return <div className="px-1 py-1">
    {eyebrow&&<span className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-600">{eyebrow}</span>}
    <h2 className="mt-1 text-xl font-black text-slate-900">{title}</h2>
    {description&&<p className="mt-2 max-w-[480px] text-[11px] leading-5 text-slate-500">{description}</p>}
  </div>;
}
