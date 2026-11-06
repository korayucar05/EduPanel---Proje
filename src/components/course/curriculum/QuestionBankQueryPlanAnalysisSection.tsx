import React from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

type Props = {
  queryPlanAnalysis: any;
  queryPlanLoading: boolean;
  refreshQueryPlanAnalysis: () => void | Promise<void>;

  indexEffectiveness: any;
  indexEffectivenessLoading: boolean;
  refreshIndexEffectiveness: () => void | Promise<void>;

  indexRecommendations: any;
  indexApplyRunning: boolean;
  applyRecommendedIndexes: () => void | Promise<void>;
};

export default function QuestionBankQueryPlanAnalysisSection({
  queryPlanAnalysis,
  queryPlanLoading,
  refreshQueryPlanAnalysis,
  indexEffectiveness,
  indexEffectivenessLoading,
  refreshIndexEffectiveness,
  indexRecommendations,
  indexApplyRunning,
  applyRecommendedIndexes,
}: Props) {
  return (
    <>
<div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Sorgu Planı ve İndeks Denetimi
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Temel soru bankası sorgularının SQLite indekslerini gerçekten kullanıp kullanmadığını denetler.
      </div>
    </div>

    <button
      type="button"
      disabled={queryPlanLoading}
      onClick={() => void refreshQueryPlanAnalysis()}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 text-[9px] font-black text-indigo-800 hover:bg-indigo-50 disabled:opacity-40"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${
          queryPlanLoading ? "animate-spin" : ""
        }`}
      />
      {queryPlanLoading ? "Denetleniyor…" : "Yeniden Denetle"}
    </button>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-3">
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[7px] font-black uppercase text-slate-400">
        Kontrol Edilen
      </div>
      <div className="mt-1 text-sm font-black text-slate-800">
        {Number(queryPlanAnalysis.checkedQueries || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[7px] font-black uppercase text-slate-400">
        İndeksli
      </div>
      <div className="mt-1 text-sm font-black text-emerald-700">
        {Number(queryPlanAnalysis.indexedQueries || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[7px] font-black uppercase text-slate-400">
        Tam Tarama
      </div>
      <div className={`mt-1 text-sm font-black ${
        Number(queryPlanAnalysis.fullScanQueries || 0) > 0
          ? "text-rose-700"
          : "text-emerald-700"
      }`}>
        {Number(queryPlanAnalysis.fullScanQueries || 0)}
      </div>
    </div>
  </div>

  <div className="mt-3 space-y-2">
    {(queryPlanAnalysis.results || []).map((item: any) => (
      <div
        key={item.id}
        className="rounded-xl border border-white bg-white/80 px-3 py-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-black text-slate-800">
            {item.label}
          </div>
          <div
            className={`rounded-lg px-2 py-1 text-[8px] font-black ${
              item.fullScan
                ? "bg-rose-100 text-rose-700"
                : item.usesIndex
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {item.fullScan
              ? "Tam Tarama"
              : item.usesIndex
                ? "İndeks Kullanıyor"
                : "Bilgi"}
          </div>
        </div>
        {Array.isArray(item.details) && item.details.length > 0 && (
          <div className="mt-1 break-all font-mono text-[7px] leading-3 text-slate-500">
            {item.details.join(" • ")}
          </div>
        )}
      </div>
    ))}
  </div>

  {indexEffectiveness && (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        indexEffectiveness.healthy
          ? "border-emerald-200 bg-emerald-50/80"
          : "border-amber-200 bg-amber-50/80"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[8px] font-black uppercase text-slate-500">
            İndeks Etkinlik Puanı
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span
              className={`text-2xl font-black ${
                indexEffectiveness.healthy
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {Number(indexEffectiveness.score || 0)}
            </span>
            <span className="pb-0.5 text-[8px] font-black text-slate-400">
              /100 • {indexEffectiveness.grade}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={indexEffectivenessLoading}
          onClick={() => void refreshIndexEffectiveness()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[8px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3 w-3 ${
              indexEffectivenessLoading ? "animate-spin" : ""
            }`}
          />
          Doğrula
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Tam Tarama
          </div>
          <div className="mt-0.5 text-[10px] font-black text-slate-800">
            {Number(indexEffectiveness.fullScanCount || 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Eksik İndeks
          </div>
          <div className="mt-0.5 text-[10px] font-black text-slate-800">
            {Number(indexEffectiveness.missingRecommendedIndexes || 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Performans
          </div>
          <div className="mt-0.5 text-[10px] font-black text-slate-800">
            {indexEffectiveness.performanceGrade}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Ortalama
          </div>
          <div className="mt-0.5 text-[10px] font-black text-slate-800">
            {Number(indexEffectiveness.averageLatencyMs || 0)} ms
          </div>
        </div>
      </div>

      <div className="mt-2 text-[8px] font-semibold text-slate-600">
        {indexEffectiveness.recommendation}
      </div>
    </div>
  )}

  {indexRecommendations && (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[8px] font-black uppercase text-slate-500">
            Akıllı İndeks Önerileri
          </div>
          <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
            Yalnız tam tarama yapan temel sorgular için eksik indeks önerilir.
          </div>
        </div>

        {Number(indexRecommendations.actionableCount || 0) > 0 && (
          <button
            type="button"
            disabled={indexApplyRunning}
            onClick={() => void applyRecommendedIndexes()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-700 px-3 text-[8px] font-black text-white hover:bg-indigo-800 disabled:opacity-40"
          >
            <ShieldCheck className="h-3 w-3" />
            {indexApplyRunning
              ? "Uygulanıyor…"
              : `${Number(indexRecommendations.actionableCount)} İndeksi Uygula`}
          </button>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {(indexRecommendations.recommendations || []).map((item: any) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[8px] font-black text-slate-700">
                {item.name}
              </div>
              <div className="mt-0.5 text-[7px] font-semibold text-slate-500">
                {item.reason}
              </div>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-[7px] font-black ${
                item.needed
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {item.needed ? "ÖNERİLİYOR" : "GEREKMİYOR"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  <div className="mt-3 text-[9px] font-semibold text-indigo-800">
    {queryPlanAnalysis.recommendation}
  </div>
</div>
    </>
  );
}
