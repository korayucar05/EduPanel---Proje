import React from "react";
import type { HasatTone } from "../theme/tokens";
import { toneStyles } from "../theme/tokens";

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: HasatTone;
  className?: string;
}) {
  const style = toneStyles[tone];
  return (
    <div className={`rounded-[15px] border p-4 text-center ${className}`} style={{ background: style.background, borderColor: style.border }}>
      <span className="block text-[10px] font-black uppercase" style={{ color: style.text }}>{label}</span>
      <strong className="mt-2 block text-[26px] font-black text-[#0d2f5f]">{value}</strong>
      {detail ? <span className="mt-1 block text-[10px] font-bold text-slate-500">{detail}</span> : null}
    </div>
  );
}
