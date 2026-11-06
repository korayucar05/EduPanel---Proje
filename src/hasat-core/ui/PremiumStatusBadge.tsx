import React from "react";
import type { PremiumStatus } from "./PremiumStatusCard";

const styles: Record<PremiumStatus, {bg:string;color:string;border:string}> = {
  risk:{bg:"#fff1f2",color:"#be123c",border:"#fecdd3"},
  warning:{bg:"#fffbeb",color:"#b45309",border:"#fde68a"},
  success:{bg:"#ecfdf5",color:"#047857",border:"#bbf7d0"},
  info:{bg:"#eff6ff",color:"#1d4ed8",border:"#bfdbfe"},
  neutral:{bg:"#f8fafc",color:"#475569",border:"#e2e8f0"},
};

export function PremiumStatusBadge({
  status="neutral",
  children,
}:React.PropsWithChildren<{status?:PremiumStatus}>){
  const style=styles[status];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wide"
      style={{backgroundColor:style.bg,color:style.color,borderColor:style.border}}
    >
      {children}
    </span>
  );
}
