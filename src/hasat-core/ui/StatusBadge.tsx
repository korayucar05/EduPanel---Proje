import React from "react";
import type { HasatTone } from "../theme/tokens";
import { toneStyles } from "../theme/tokens";

export function StatusBadge({ children, tone = "neutral" }: React.PropsWithChildren<{ tone?: HasatTone }>) {
  const style = toneStyles[tone];
  return <span className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black" style={{ background: style.background, borderColor: style.border, color: style.text }}>{children}</span>;
}
