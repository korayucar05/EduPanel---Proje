import React from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

type Props = {
  maintenancePreview: any;
  maintenancePreviewLoading: boolean;
  maintenanceRunning: boolean;
  maintenanceResult: any;
  refreshMaintenancePreview: () => void | Promise<void>;
  runMaintenanceOrchestrator: () => void | Promise<void>;
};

export default function QuestionBankMaintenanceSection({
  maintenancePreview,
  maintenancePreviewLoading,
  maintenanceRunning,
  maintenanceResult,
  refreshMaintenancePreview,
  runMaintenanceOrchestrator,
}: Props) {
  return (
<div className="mt-5 rounded-2xl border border-slate-300 bg-slate-50/90 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Otomatik Güvenli Bakım Merkezi
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Yazma günlüğü, sahipsiz dosya, indeks, SQLite ANALYZE, güvenli mod, bütünlük, sağlık ve performans kontrollerini tek akışta yönetir.
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={maintenancePreviewLoading}
        onClick={() => void refreshMaintenancePreview()}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${
            maintenancePreviewLoading ? "animate-spin" : ""
          }`}
        />
        Ön İzlemeyi Yenile
      </button>

      <button
        type="button"
        disabled={maintenanceRunning}
        onClick={() => void runMaintenanceOrchestrator()}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[9px] font-black text-white hover:bg-slate-800 disabled:opacity-40"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {maintenanceRunning
          ? "Güvenli bakım çalışıyor…"
          : "Güvenli Bakımı Çalıştır"}
      </button>
    </div>
  </div>

  {maintenancePreview?.summary && (
    <div className="mt-3 grid gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-white p-3">
        <div className="text-[7px] font-black uppercase text-slate-400">
          Sağlık
        </div>
        <div className="mt-1 text-sm font-black text-slate-800">
          {Number(maintenancePreview.summary.healthScore || 0)}
          {" / 100 • "}
          {maintenancePreview.summary.healthGrade}
        </div>
      </div>
      <div className="rounded-xl bg-white p-3">
        <div className="text-[7px] font-black uppercase text-slate-400">
          Performans
        </div>
        <div className="mt-1 text-sm font-black text-slate-800">
          {maintenancePreview.summary.performanceGrade}
        </div>
      </div>
      <div className="rounded-xl bg-white p-3">
        <div className="text-[7px] font-black uppercase text-slate-400">
          İndeks Etkinliği
        </div>
        <div className="mt-1 text-sm font-black text-slate-800">
          {Number(
            maintenancePreview.summary.indexEffectivenessScore || 0,
          )}
          {" • "}
          {maintenancePreview.summary.indexEffectivenessGrade}
        </div>
      </div>
      <div className="rounded-xl bg-white p-3">
        <div className="text-[7px] font-black uppercase text-slate-400">
          Yazma Durumu
        </div>
        <div
          className={`mt-1 text-sm font-black ${
            maintenancePreview.summary.writable
              ? "text-emerald-700"
              : "text-rose-700"
          }`}
        >
          {maintenancePreview.summary.writable
            ? "Yazılabilir"
            : "Kilitli"}
        </div>
      </div>
    </div>
  )}

  {Array.isArray(maintenancePreview?.criticalReasons) &&
    maintenancePreview.criticalReasons.length > 0 && (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <div className="text-[8px] font-black uppercase text-rose-700">
          Öncelikli Durumlar
        </div>
        <div className="mt-2 space-y-1">
          {maintenancePreview.criticalReasons.map(
            (reason: string, index: number) => (
              <div
                key={`${reason}-${index}`}
                className="text-[8px] font-semibold text-rose-800"
              >
                • {reason}
              </div>
            ),
          )}
        </div>
      </div>
    )}

  {maintenanceResult && (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-[9px] font-black ${
        maintenanceResult.status === "healthy"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : maintenanceResult.status === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {maintenanceResult.status === "healthy"
        ? "Güvenli bakım tamamlandı. Soru bankası sağlıklı."
        : maintenanceResult.status === "warning"
          ? "Güvenli bakım tamamlandı; izlenmesi gereken uyarılar var."
          : maintenanceResult.status === "attention"
            ? "Güvenli bakım tamamlandı; yönetici müdahalesi gereken durum var."
            : maintenanceResult.criticalReasons?.[0] ||
              "Güvenli bakım tamamlanamadı."}
    </div>
  )}

  <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[8px] font-semibold leading-4 text-slate-500">
    Otomatik bakım şu işlemleri bilerek çalıştırmaz:
    {" "}VACUUM, kalıcı karantina temizliği, veritabanı geri yükleme,
    soru silme ve fiziksel soru dosyası kalıcı silme.
  </div>
</div>
  );
}
