import React from "react";
import type { SubjectPerformance } from "../types";
import { subjectSuccessRate } from "../utils/reportMath";
import { chartTheme, performanceColor } from "../../hasat-core/theme/chartTheme";
import { ChartLegend } from "../../hasat-core/ui/ChartLegend";

export function BarChart({ subjects }: { subjects: SubjectPerformance[] }) {
  const items = subjects.slice(0, 8);
  const guides=[25,50,75,100];

  return (
    <div className="pt-3">
      <div className="relative h-[250px] rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 pb-7 pt-5">
        <div className="pointer-events-none absolute inset-x-5 bottom-7 top-5">
          {guides.map(value=>(
            <div
              key={value}
              className="absolute left-0 right-0 border-t border-dashed border-slate-200"
              style={{bottom:`${value}%`}}
            >
              <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[7px] font-bold text-slate-300">%{value}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex h-full items-end justify-around gap-3">
          {items.map((subject, index) => {
            const value = subjectSuccessRate(subject);
            const color=chartTheme.colors[index%chartTheme.colors.length];
            const threshold=performanceColor(value);
            return (
              <div key={`${subject.subjectName}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className="mb-2 rounded-full px-2 py-1 text-[9px] font-black text-white shadow-sm" style={{backgroundColor:threshold}}>
                  %{Math.round(value)}
                </span>
                <div className="relative flex h-[calc(100%-48px)] w-full items-end justify-center">
                  <div
                    className="w-[64%] max-w-[46px] rounded-t-xl shadow-[0_6px_15px_rgba(15,42,72,.12)]"
                    style={{
                      height: `${Math.max(5, value)}%`,
                      background:`linear-gradient(180deg,${color},${threshold})`,
                    }}
                  />
                </div>
                <span className="mt-2 max-w-full truncate text-[8px] font-black text-slate-600">
                  {subject.shortName || subject.subjectName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <ChartLegend/>
    </div>
  );
}
