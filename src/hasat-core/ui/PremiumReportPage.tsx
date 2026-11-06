import React from "react";

export function PremiumReportPage({
  children,
  className = "",
  format = "a4",
  id,
}: React.PropsWithChildren<{
  className?: string;
  format?: "a4" | "a3-landscape";
  id?: string;
}>) {
  const size = format === "a3-landscape"
    ? "min-h-[1123px] w-[1588px] p-8"
    : "min-h-[1588px] w-[1123px] p-[34px]";

  return (
    <section
      id={id}
      className={`hasat-premium-page relative mx-auto box-border overflow-hidden bg-white text-slate-800 ${size} ${className}`}
    >
      {children}
    </section>
  );
}
