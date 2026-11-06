import React from "react";

export type PremiumAccent =
  | "blue"
  | "cyan"
  | "teal"
  | "violet"
  | "orange"
  | "rose"
  | "amber"
  | "green"
  | "navy"
  | "none";

const accentMap: Record<PremiumAccent, string> = {
  blue: "#2563eb",
  cyan: "#0891b2",
  teal: "#059669",
  violet: "#7c3aed",
  orange: "#f97316",
  rose: "#e11d48",
  amber: "#f59e0b",
  green: "#16a34a",
  navy: "#082f58",
  none: "transparent",
};

export function PremiumReportCard({
  children,
  className = "",
  accent = "none",
  as: Component = "div",
}: React.PropsWithChildren<{
  className?: string;
  accent?: PremiumAccent;
  as?: React.ElementType;
}>) {
  return (
    <Component
      className={`hasat-premium-card rounded-2xl border border-slate-200 bg-white ${className}`}
      style={{
        borderTopColor: accentMap[accent],
        borderTopWidth: accent === "none" ? undefined : 4,
      }}
    >
      {children}
    </Component>
  );
}
