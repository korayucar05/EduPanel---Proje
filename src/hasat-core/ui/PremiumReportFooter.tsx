import React from "react";

export function PremiumReportFooter({
  brandLine,
  reportCode,
  page,
  pageCount,
  rightText,
}: {
  brandLine?: React.ReactNode;
  reportCode?: React.ReactNode;
  page?: number;
  pageCount?: number;
  rightText?: React.ReactNode;
}) {
  return (
    <footer className="hasat-premium-footer grid grid-cols-[1.15fr_.85fr_1fr] items-center rounded-2xl border border-slate-200 px-5 py-4 text-[9px] text-slate-500">
      <strong className="text-[11px] text-[#082f58]">
        {brandLine || "e-Nstitü · Hedefli Akademik Süreç Analiz Takibi"}
      </strong>
      <div className="text-center">
        {reportCode ? <span className="font-bold">Rapor Kodu: {reportCode}</span> : null}
        {page && pageCount ? (
          <span className="ml-3 rounded-full bg-white px-2.5 py-1 font-black text-blue-700 shadow-sm">
            {page} / {pageCount}
          </span>
        ) : null}
      </div>
      <span className="text-right font-semibold text-slate-600">
        {rightText || "Bu rapor e-Nstitü Akademik Analiz Sistemi tarafından hazırlanmıştır."}
      </span>
    </footer>
  );
}
