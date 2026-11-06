import React from "react";
import type { PremiumAccent } from "./PremiumReportCard";

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
  none: "#082f58",
};

export function PremiumSectionTitle({
  title,
  eyebrow,
  accent = "navy",
  action,
  className = "",
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  accent?: PremiumAccent;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow ? (
          <span
            className="block text-[9px] font-black uppercase tracking-[.18em]"
            style={{ color: colorMap[accent] }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h2 className="mt-1 text-[15px] font-black text-[#082f58]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
