import React from "react";

export function ReportCard({
  children,
  className = "",
  as: Component = "div",
}: React.PropsWithChildren<{ className?: string; as?: React.ElementType }>) {
  return (
    <Component className={`rounded-[15px] border border-slate-200 bg-white shadow-[0_1px_8px_rgba(15,23,42,.04)] ${className}`}>
      {children}
    </Component>
  );
}
