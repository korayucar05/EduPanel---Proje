import React from "react";

export function ChartLegend(){
  const items=[
    {label:"Güçlü",detail:"%75 ve üzeri",color:"#16a34a"},
    {label:"Geliştirilebilir",detail:"%55–74",color:"#f59e0b"},
    {label:"Öncelikli",detail:"%55 altı",color:"#e11d48"},
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[8px] font-bold text-slate-500">
      {items.map(item=>(
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:item.color}}/>
          <span>{item.label}</span>
          <span className="text-slate-400">({item.detail})</span>
        </span>
      ))}
    </div>
  );
}
