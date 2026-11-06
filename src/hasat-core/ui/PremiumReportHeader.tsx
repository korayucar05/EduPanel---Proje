import React from "react";
import type { PremiumAccent } from "./PremiumReportCard";

const gradients: Record<PremiumAccent, string> = {
  blue: "linear-gradient(115deg,#082f58 0%,#2563eb 54%,#0891b2 100%)",
  teal: "linear-gradient(115deg,#082f58 0%,#0f766e 50%,#16a34a 100%)",
  cyan: "linear-gradient(115deg,#164e63 0%,#0891b2 52%,#06b6d4 100%)",
  violet: "linear-gradient(115deg,#312e81 0%,#7c3aed 55%,#0891b2 100%)",
  orange: "linear-gradient(115deg,#7c2d12 0%,#f97316 55%,#f59e0b 100%)",
  rose: "linear-gradient(115deg,#881337 0%,#e11d48 55%,#7c3aed 100%)",
  amber: "linear-gradient(115deg,#78350f 0%,#d97706 55%,#fbbf24 100%)",
  green: "linear-gradient(115deg,#064e3b 0%,#059669 55%,#16a34a 100%)",
  navy: "linear-gradient(115deg,#061f3b 0%,#082f58 55%,#2563eb 100%)",
  none: "linear-gradient(115deg,#061f3b 0%,#082f58 55%,#2563eb 100%)",
};

export function PremiumReportHeader({
  eyebrow,
  title,
  subtitle,
  sideTitle,
  sideDetail,
  accent = "blue",
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  sideTitle?: React.ReactNode;
  sideDetail?: React.ReactNode;
  accent?: PremiumAccent;
}) {
  return (
    <header
      className="hasat-premium-header mb-6 flex items-start justify-between gap-8 rounded-2xl px-6 py-5 text-white"
      style={{ background: gradients[accent] }}
    >
      <div>
        <span className="text-[9px] font-black uppercase tracking-[.22em] text-white/80">
          {eyebrow}
        </span>
        <h1 className="mt-2 text-[28px] font-black text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-[11px] font-semibold text-white/75">{subtitle}</p>
        ) : null}
      </div>
      {(sideTitle || sideDetail) ? (
        <div className="text-right">
          {sideTitle ? (
            <strong className="block text-[20px] font-black text-white">{sideTitle}</strong>
          ) : null}
          {sideDetail ? (
            <span className="mt-1 block text-[10px] font-semibold text-white/70">{sideDetail}</span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
