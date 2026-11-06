import React from "react";
import type { PremiumAccent } from "./PremiumReportCard";
import { PremiumReportCard } from "./PremiumReportCard";

const colorMap: Record<PremiumAccent, string> = {
  blue: "#2563eb",
  teal: "#059669",
  cyan: "#0891b2",
  violet: "#7c3aed",
  orange: "#f97316",
  rose: "#e11d48",
  amber: "#d97706",
  green: "#16a34a",
  navy: "#082f58",
  none: "#475569",
};

export function PremiumMetricCard({
  label,
  value,
  detail,
  accent = "blue",
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  accent?: PremiumAccent;
  className?: string;
}) {
  return (
    <PremiumReportCard accent={accent} className={`px-4 py-4 text-center ${className}`}>
      <span className="block text-[9px] font-black uppercase tracking-[.08em] text-slate-500">
        {label}
      </span>
      <strong
        className="mt-2 block text-[24px] font-black"
        style={{ color: colorMap[accent] }}
      >
        {value}
      </strong>
      {detail ? (
        <span className="mt-1 block text-[9px] font-bold text-slate-400">{detail}</span>
      ) : null}
    </PremiumReportCard>
  );
}
