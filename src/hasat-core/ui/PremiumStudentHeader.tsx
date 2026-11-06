import React from "react";
import { PremiumReportCard } from "./PremiumReportCard";

export function PremiumStudentHeader({
  reportTitle,
  examName,
  examDate,
  reportDate,
}: {
  reportTitle: React.ReactNode;
  examName: React.ReactNode;
  examDate: React.ReactNode;
  reportDate: React.ReactNode;
}) {
  return (
    <header className="hasat-student-premium-header mb-5 flex items-start justify-between gap-8 rounded-[20px] px-6 py-5 text-white">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-white/80 bg-white/10 text-3xl font-black text-white shadow-lg">
          H
        </div>
        <div>
          <h1 className="text-[41px] font-black leading-none tracking-tight text-white">e-Nstitü</h1>
          <p className="mt-2 max-w-[280px] text-[11px] font-black uppercase leading-4 tracking-wide text-white/80">
            Hedefli Akademik Süreç Analiz Takibi
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-right">
        <h2 className="text-[25px] font-black uppercase tracking-wide text-white">{reportTitle}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Sınav Adı", examName],
            ["Sınav Tarihi", examDate],
            ["Rapor Tarihi", reportDate],
          ].map(([label, value], index) => (
            <PremiumReportCard
              key={String(label)}
              accent={(["blue", "teal", "amber"] as const)[index]}
              className="bg-white/95 px-4 py-3 text-left"
            >
              <span className="block text-[8px] font-black uppercase tracking-wide text-slate-500">{label}</span>
              <strong className="mt-1 block truncate text-[11px] text-[#082f58]">{value}</strong>
            </PremiumReportCard>
          ))}
        </div>
      </div>
    </header>
  );
}
