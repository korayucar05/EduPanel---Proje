import React from "react";
import { ArrowRight, Target } from "lucide-react";
import { HasatCard } from "../../design-system";

type FamilyTargetCardProps = {
  targetName: string;
  progress: number;
  targetNet: number;
  currentNet: number;
  isDefined: boolean;
  onOpen?: () => void;
};

export function FamilyTargetCard({
  targetName,
  progress,
  targetNet,
  currentNet,
  isDefined,
  onOpen,
}: FamilyTargetCardProps) {
  const bounded = Math.max(0, Math.min(100, progress || 0));

  return (
    <HasatCard onClick={onOpen} className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-amber-100">
              Hedef Takibi
            </span>
            <h3 className="mt-1 max-w-[240px] truncate text-base font-black">
              {isDefined ? targetName : "Hedef henüz tanımlanmadı"}
            </h3>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/16">
            <Target className="h-5 w-5" />
          </div>
        </div>

        {isDefined ? (
          <>
            <div className="mt-4 flex items-end justify-between">
              <strong className="text-4xl font-black">
                %{Math.round(bounded)}
              </strong>
              <ArrowRight className="h-5 w-5 text-amber-100" />
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${bounded}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs leading-5 text-amber-50">
            Hedef üniversite veya program tanımlandığında ilerleme burada
            hesaplanacaktır.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 bg-white">
        <div className="p-3">
          <span className="text-[9px] font-bold text-slate-400">Mevcut Net</span>
          <strong className="mt-1 block text-lg font-black text-slate-900">
            {Number.isFinite(currentNet) ? currentNet.toFixed(1) : "0.0"}
          </strong>
        </div>

        <div className="p-3">
          <span className="text-[9px] font-bold text-slate-400">Hedef Net</span>
          <strong className="mt-1 block text-lg font-black text-slate-900">
            {isDefined && targetNet > 0 ? targetNet.toFixed(1) : "—"}
          </strong>
        </div>
      </div>
    </HasatCard>
  );
}
