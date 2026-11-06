import React from "react";

export function HasatStatStrip({
  items,
}:{
  items:Array<{label:string;value:string|number;detail?:string}>;
}){
  return <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${Math.max(1,items.length)},minmax(0,1fr))`}}>
    {items.map(item=><div key={item.label} className="rounded-2xl border border-white/80 bg-white/88 p-3 text-center shadow-sm backdrop-blur">
      <span className="block text-[9px] font-bold text-slate-400">{item.label}</span>
      <strong className="mt-1 block text-lg font-black text-slate-900">{item.value}</strong>
      {item.detail&&<span className="mt-1 block text-[9px] text-slate-400">{item.detail}</span>}
    </div>)}
  </div>;
}
