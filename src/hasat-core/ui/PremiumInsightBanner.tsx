import React from "react";
import type { PremiumAccent } from "./PremiumReportCard";

const gradients: Record<PremiumAccent, string> = {
  blue: "linear-gradient(110deg,#082f58,#2563eb 52%,#059669)",
  teal: "linear-gradient(110deg,#064e3b,#0f766e 52%,#2563eb)",
  cyan: "linear-gradient(110deg,#164e63,#0891b2 52%,#06b6d4)",
  violet: "linear-gradient(110deg,#312e81,#7c3aed 52%,#2563eb)",
  orange: "linear-gradient(110deg,#7c2d12,#f97316 52%,#f59e0b)",
  rose: "linear-gradient(110deg,#881337,#e11d48 52%,#7c3aed)",
  amber: "linear-gradient(110deg,#78350f,#d97706 52%,#fbbf24)",
  green: "linear-gradient(110deg,#064e3b,#059669 52%,#16a34a)",
  navy: "linear-gradient(110deg,#061f3b,#082f58 52%,#2563eb)",
  none: "linear-gradient(110deg,#061f3b,#082f58 52%,#2563eb)",
};

export function PremiumInsightBanner({
  eyebrow,
  children,
  accent = "blue",
  className = "",
}: React.PropsWithChildren<{
  eyebrow: React.ReactNode;
  accent?: PremiumAccent;
  className?: string;
}>) {
  return (
    <div
      className={`rounded-2xl border-l-4 border-amber-300 px-5 py-5 text-white shadow-[0_12px_30px_rgba(37,99,235,.18)] ${className}`}
      style={{ background: gradients[accent] }}
    >
      <span className="block text-[9px] font-black uppercase tracking-[.2em] text-white/80">
        {eyebrow}
      </span>
      <div className="mt-2 text-[12px] font-semibold leading-6 text-white">{children}</div>
    </div>
  );
}
