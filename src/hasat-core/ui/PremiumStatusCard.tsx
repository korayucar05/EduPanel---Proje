import React from "react";

export type PremiumStatus = "risk" | "warning" | "success" | "info" | "neutral";

const styles: Record<PremiumStatus, {
  border:string;
  background:string;
  title:string;
  icon:string;
}> = {
  risk: {
    border:"#fecdd3",
    background:"linear-gradient(135deg,#fff1f2,#ffffff)",
    title:"#be123c",
    icon:"⚠",
  },
  warning: {
    border:"#fde68a",
    background:"linear-gradient(135deg,#fffbeb,#ffffff)",
    title:"#b45309",
    icon:"!",
  },
  success: {
    border:"#bbf7d0",
    background:"linear-gradient(135deg,#ecfdf5,#ffffff)",
    title:"#047857",
    icon:"✓",
  },
  info: {
    border:"#bfdbfe",
    background:"linear-gradient(135deg,#eff6ff,#ffffff)",
    title:"#1d4ed8",
    icon:"i",
  },
  neutral: {
    border:"#e2e8f0",
    background:"linear-gradient(135deg,#f8fafc,#ffffff)",
    title:"#475569",
    icon:"•",
  },
};

export function PremiumStatusCard({
  status = "neutral",
  title,
  children,
  className = "",
}: React.PropsWithChildren<{
  status?: PremiumStatus;
  title: React.ReactNode;
  className?: string;
}>) {
  const style=styles[status];
  return (
    <div
      className={`hasat-premium-status-card rounded-2xl border p-4 ${className}`}
      style={{borderColor:style.border,background:style.background}}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
          style={{backgroundColor:style.title}}
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <strong className="block text-[10px] font-black" style={{color:style.title}}>
            {title}
          </strong>
          <div className="mt-2 text-[9px] font-semibold leading-4 text-slate-600">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
