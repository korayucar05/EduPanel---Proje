import React from "react";

type Props = {
  datasetProfile: any;
  formatBytes: (value: number) => string;
};

export default function QuestionBankDatasetProfileSection({
  datasetProfile,
  formatBytes,
}: Props) {
  if (!datasetProfile) return null;

  return (
    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">
            Büyük Veri Dayanıklılığı
          </div>

          <div className="mt-1 text-[10px] font-semibold text-slate-500">
            Soru bankası büyüdükçe sayfalama, örnekleme ve bellek sınırlarını veri hacmine göre ayarlar.
          </div>
        </div>

        <div className="rounded-xl bg-blue-700 px-3 py-2 text-[9px] font-black text-white">
          {datasetProfile.className === "small"
            ? "KÜÇÜK"
            : datasetProfile.className === "medium"
              ? "ORTA"
              : datasetProfile.className === "large"
                ? "BÜYÜK"
                : datasetProfile.className === "very-large"
                  ? "ÇOK BÜYÜK"
                  : "AŞIRI BÜYÜK"}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Aktif Soru
          </div>
          <div className="mt-1 text-sm font-black text-slate-800">
            {Number(datasetProfile.active || 0)}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Toplam Boyut
          </div>
          <div className="mt-1 text-sm font-black text-slate-800">
            {formatBytes(Number(datasetProfile.totalBytes || 0))}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Önerilen Sayfa
          </div>
          <div className="mt-1 text-sm font-black text-slate-800">
            {Number(datasetProfile.recommendedPageSize || 50)}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Bakım Örneği
          </div>
          <div className="mt-1 text-sm font-black text-slate-800">
            {Number(datasetProfile.maintenanceSampleSize || 100)}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
        <div className="text-[8px] font-black uppercase text-slate-500">
          Aktif Koruma Kuralları
        </div>

        <div className="mt-2 space-y-1">
          {(datasetProfile.protections || []).map(
            (item: string, index: number) => (
              <div
                key={`${item}-${index}`}
                className="text-[8px] font-semibold text-slate-600"
              >
                • {item}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
