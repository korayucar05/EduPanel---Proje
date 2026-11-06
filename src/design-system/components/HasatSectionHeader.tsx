import React from "react";

export function HasatSectionHeader({
  title,
  eyebrow,
  action,
}:{
  title:string;
  eyebrow?:string;
  action?:React.ReactNode;
}){
  return(
    <div className="flex items-end justify-between gap-4 px-1">
      <div>
        {eyebrow&&<span className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-600">{eyebrow}</span>}
        <h2 className="mt-1 text-base font-black text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}
