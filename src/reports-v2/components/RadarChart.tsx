import React from "react";
import type { SubjectPerformance } from "../types";
import { subjectSuccessRate } from "../utils/reportMath";
import { chartTheme, performanceColor } from "../../hasat-core/theme/chartTheme";
import { ChartLegend } from "../../hasat-core/ui/ChartLegend";

export function RadarChart({ subjects }: { subjects: SubjectPerformance[] }) {
  const items = subjects.slice(0, 6);
  const center = 140;
  const maxRadius = 92;
  const count = Math.max(items.length, 3);
  const pointAt = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  };

  const grid = [0.25, 0.5, 0.75, 1].map((factor) =>
    Array.from({ length: count }, (_, index) => pointAt(index, maxRadius * factor).join(",")).join(" ")
  );

  const values = items.map((subject, index) =>
    pointAt(index, maxRadius * (subjectSuccessRate(subject) / 100)).join(",")
  ).join(" ");

  return (
    <div className="pt-2">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <svg viewBox="0 0 280 280" className="h-[260px] w-full">
          <defs>
            <linearGradient id="hasatRadarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity=".35"/>
              <stop offset="55%" stopColor="#0891b2" stopOpacity=".28"/>
              <stop offset="100%" stopColor="#059669" stopOpacity=".35"/>
            </linearGradient>
          </defs>

          {grid.map((points, index) => (
            <polygon
              key={index}
              points={points}
              fill={index%2===0?"rgba(37,99,235,.025)":"none"}
              stroke={chartTheme.grid}
              strokeWidth="1"
            />
          ))}

          {Array.from({ length: count }, (_, index) => {
            const [x, y] = pointAt(index, maxRadius);
            return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke={chartTheme.grid} />;
          })}

          <polygon points={values} fill="url(#hasatRadarFill)" stroke="#0891b2" strokeWidth="3" />

          {items.map((subject,index)=>{
            const rate=subjectSuccessRate(subject);
            const [x,y]=pointAt(index,maxRadius*(rate/100));
            return <circle key={`point-${subject.subjectName}`} cx={x} cy={y} r="4.5" fill={performanceColor(rate)} stroke="#fff" strokeWidth="2"/>;
          })}

          {items.map((subject, index) => {
            const [x, y] = pointAt(index, maxRadius + 22);
            const rate=subjectSuccessRate(subject);
            return (
              <g key={subject.subjectName}>
                <text x={x} y={y-3} textAnchor="middle" fontSize="9" fontWeight="800" fill={chartTheme.label}>
                  {subject.shortName || subject.subjectName.slice(0, 12)}
                </text>
                <text x={x} y={y+9} textAnchor="middle" fontSize="8" fontWeight="800" fill={performanceColor(rate)}>
                  %{Math.round(rate)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ChartLegend/>
    </div>
  );
}
