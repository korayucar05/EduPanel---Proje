import React from "react";
import { PremiumReportCard, type PremiumAccent } from "./PremiumReportCard";

const accentColors: Record<PremiumAccent, string> = {
  blue: "#2563eb",
  teal: "#059669",
  cyan: "#0891b2",
  violet: "#7c3aed",
  orange: "#f97316",
  rose: "#e11d48",
  amber: "#d97706",
  green: "#16a34a",
  navy: "#082f58",
  none: "#64748b",
};

export function PremiumSubjectCard({
  title,
  successRate,
  correct,
  wrong,
  empty,
  net,
  accent,
  ring,
}: {
  title: string;
  successRate: number;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  accent: PremiumAccent;
  ring: React.ReactNode;
}) {
  const color = accentColors[accent];
  return (
    <PremiumReportCard accent={accent} className="hasat-subject-card min-h-[235px] overflow-hidden px-3 py-4">
      {ring}
      <div className="mt-3 truncate text-center text-[10px] font-black text-[#082f58]">{title}</div>
      <div className="mt-4 grid grid-cols-3 text-center text-[8px]">
        <div>
          <span className="block font-black text-slate-400">DOĞRU</span>
          <strong className="text-[14px] text-emerald-700">{correct}</strong>
        </div>
        <div>
          <span className="block font-black text-slate-400">YANLIŞ</span>
          <strong className="text-[14px] text-rose-700">{wrong}</strong>
        </div>
        <div>
          <span className="block font-black text-slate-400">BOŞ</span>
          <strong className="text-[14px] text-amber-700">{empty}</strong>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="rounded-full px-3 py-1 text-[9px] font-black text-white" style={{ backgroundColor: color }}>
          {net.toFixed(2)} NET
        </span>
        <span className="text-[10px] font-black" style={{ color }}>%{Math.round(successRate)}</span>
      </div>
    </PremiumReportCard>
  );
}
