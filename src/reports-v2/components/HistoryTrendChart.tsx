import React from "react";
import type { HistoryPoint } from "../utils/academicHistory";

export function HistoryTrendChart({points}:{points:HistoryPoint[]}){
  if(points.length<2)return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-500">Gelişim grafiği için en az iki sınav sonucu gerekir.</div>;
  const width=520,height=220,padding=34;
  const nets=points.map(point=>point.net);
  const min=Math.min(...nets),max=Math.max(...nets);
  const range=Math.max(1,max-min);
  const coords=points.map((point,index)=>({
    x:padding+(index/(points.length-1))*(width-padding*2),
    y:height-padding-((point.net-min)/range)*(height-padding*2),
    point,
  }));
  const polyline=coords.map(item=>`${item.x},${item.y}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
    {[0,.25,.5,.75,1].map(level=>{const y=padding+level*(height-padding*2);return <line key={level} x1={padding} x2={width-padding} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1"/>;})}
    <polyline points={polyline} fill="none" stroke="#029c83" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    {coords.map(({x,y,point},index)=><g key={point.examId}>
      <circle cx={x} cy={y} r="5" fill="#ffffff" stroke="#029c83" strokeWidth="3"/>
      <text x={x} y={y-12} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0d2f5f">{point.net.toFixed(2)}</text>
      <text x={x} y={height-10} textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748b">{index+1}. Sınav</text>
    </g>)}
  </svg>;
}
