import React from "react";
import { PremiumReportCard } from "./PremiumReportCard";
import { PremiumSectionTitle } from "./PremiumSectionTitle";

export type PremiumActionItem={
  priority:number;
  title:string;
  detail:string;
  owner?:string;
};

export function PremiumActionPlan({
  title="e-Nstitü AI Eylem Planı",
  eyebrow="Uygulanabilir adımlar",
  items,
  accent="teal",
}:{
  title?:string;
  eyebrow?:string;
  items:PremiumActionItem[];
  accent?:"blue"|"teal"|"violet"|"orange"|"rose"|"amber"|"green"|"navy";
}){
  return (
    <PremiumReportCard accent={accent} className="p-5">
      <PremiumSectionTitle
        title={title}
        eyebrow={eyebrow}
        accent={accent}
        action={
          <span className="rounded-full bg-slate-900 px-3 py-1 text-[8px] font-black uppercase text-white">
            {items.length} öncelik
          </span>
        }
        className="mb-4"
      />
      <div className="space-y-3">
        {items.map(item=>(
          <div
            key={item.priority}
            className="grid grid-cols-[38px_1fr_155px] items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#082f58] text-[11px] font-black text-white">
              {item.priority}
            </span>
            <div>
              <strong className="block text-[10px] text-[#082f58]">{item.title}</strong>
              <span className="mt-1 block text-[9px] leading-4 text-slate-500">{item.detail}</span>
            </div>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-[8px] font-black text-teal-700">
              {item.owner || "Sorumlu birim"}
            </span>
          </div>
        ))}
      </div>
    </PremiumReportCard>
  );
}
