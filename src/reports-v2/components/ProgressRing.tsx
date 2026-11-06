import React from "react";
import { performanceColor } from "../../hasat-core/theme/chartTheme";

export function ProgressRing({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  const radius = 38;
  const circumference = Math.PI * 2 * radius;
  const offset = circumference - (normalized / 100) * circumference;
  const thresholdColor=performanceColor(normalized);
  const ringColor=accent||thresholdColor;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-[96px] w-[96px] drop-shadow-sm">
        <defs>
          <linearGradient id={`ring-${Math.round(normalized)}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ringColor}/>
            <stop offset="100%" stopColor={thresholdColor}/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="#ffffff" stroke="#e8eef6" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#ring-${Math.round(normalized)})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="53" textAnchor="middle" fontSize="18" fontWeight="900" fill="#082f58">
          %{Math.round(normalized)}
        </text>
        <text x="50" y="66" textAnchor="middle" fontSize="6.5" fontWeight="800" fill={thresholdColor}>
          {normalized>=75?"GÜÇLÜ":normalized>=55?"GELİŞİYOR":"ÖNCELİKLİ"}
        </text>
      </svg>
      {label?<span className="mt-1 text-center text-[10px] font-black text-slate-700">{label}</span>:null}
    </div>
  );
}
