import React from "react";

export function SectionTitle({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return <h3 className={`text-[15px] font-black uppercase text-[#0d2f5f] ${className}`}>{children}</h3>;
}
