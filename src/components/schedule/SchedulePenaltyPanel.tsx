import React from "react";
import { ShieldAlert } from "lucide-react";

interface SchedulePenaltyPanelProps {
  visible: boolean;
  details: any[];
}

function SchedulePenaltyPanel({ visible, details }: SchedulePenaltyPanelProps) {
  if (!visible) return null;
  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Ceza Detayları ve İyileştirme Fırsatları
        </h3>
        <span className="text-xs font-semibold text-slate-400">Sınıf ve öğretmen programlarındaki iyileştirme alanları.</span>
      </div>
      {details.length === 0 ? (
        <div className="py-6 text-center text-xs font-bold text-slate-400">Ceza puanı bulunmuyor.</div>
      ) : (
        <div className="grid max-h-[250px] grid-cols-1 gap-3 overflow-y-auto pr-2 md:grid-cols-2 lg:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.id} className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/30 p-3">
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${detail.type === "teacher_unwanted_day" ? "bg-red-500" : "bg-amber-500"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-extrabold text-slate-900">{detail.targetName}</span>
                  <span className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-500">{detail.points} Puan</span>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-500">{detail.description}</p>
                <div className="mt-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{detail.day} {detail.hours ? `• ${detail.hours}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { SchedulePenaltyPanel };
export default React.memo(SchedulePenaltyPanel);
