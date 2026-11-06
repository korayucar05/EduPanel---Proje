import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  bankMaintenanceRunning: any;
  bankIntegrity: any;
  bankMaintenanceResult: any;
  runQuestionBankOptimization: () => void | Promise<void>;
  runMissingRecordCleanup: () => void | Promise<void>;
  runOrphanFileCleanup: () => void | Promise<void>;
};

export default function QuestionBankMaintenanceToolsSection({
  bankMaintenanceRunning,
  bankIntegrity,
  bankMaintenanceResult,
  runQuestionBankOptimization,
  runMissingRecordCleanup,
  runOrphanFileCleanup,
}: Props) {
  return (
<div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Bakım ve Onarım Araçları
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Eksik/sahipsiz dosyaları güvenli biçimde temizler ve SQLite indekslerini optimize eder.
      </div>
    </div>

    <button
      type="button"
      disabled={Boolean(bankMaintenanceRunning)}
      onClick={() => void runQuestionBankOptimization()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[10px] font-black text-white hover:bg-slate-800 disabled:opacity-50"
    >
      <RefreshCw
        className={`h-4 w-4 ${
          bankMaintenanceRunning === "optimize"
            ? "animate-spin"
            : ""
        }`}
      />
      {bankMaintenanceRunning === "optimize"
        ? "Optimize ediliyor…"
        : "Bankayı Optimize Et"}
    </button>
  </div>

  <div className="mt-3 grid gap-3 md:grid-cols-2">
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div className="text-[10px] font-black text-rose-900">
        Eksik Fiziksel Dosya
      </div>
      <div className="mt-1 text-[9px] font-semibold text-rose-600">
        Metadata kaydı var fakat soru görseli disk üzerinde yok.
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xl font-black text-rose-900">
          {Number(bankIntegrity?.missingFiles?.length || 0)}
        </span>
        <button
          type="button"
          disabled={
            Boolean(bankMaintenanceRunning) ||
            Number(bankIntegrity?.missingFiles?.length || 0) <= 0
          }
          onClick={() => void runMissingRecordCleanup()}
          className="rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-black text-white disabled:opacity-40"
        >
          {bankMaintenanceRunning === "missing"
            ? "Temizleniyor…"
            : "Bozuk Kayıtları Temizle"}
        </button>
      </div>
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-[10px] font-black text-amber-900">
        Sahipsiz Fiziksel Dosya
      </div>
      <div className="mt-1 text-[9px] font-semibold text-amber-600">
        Diskte dosya var fakat hiçbir soru metadata kaydı bu dosyaya bağlı değil.
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xl font-black text-amber-900">
          {Number(bankIntegrity?.orphanFiles?.length || 0)}
        </span>
        <button
          type="button"
          disabled={
            Boolean(bankMaintenanceRunning) ||
            Number(bankIntegrity?.orphanFiles?.length || 0) <= 0
          }
          onClick={() => void runOrphanFileCleanup()}
          className="rounded-lg bg-amber-600 px-3 py-2 text-[9px] font-black text-white disabled:opacity-40"
        >
          {bankMaintenanceRunning === "orphans"
            ? "Siliniyor…"
            : "Sahipsiz Dosyaları Sil"}
        </button>
      </div>
    </div>
  </div>

  {bankMaintenanceResult && (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        bankMaintenanceResult.type === "error"
          ? "border-rose-200 bg-rose-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      {bankMaintenanceResult.type === "error" ? (
        <div className="text-[10px] font-black text-rose-800">
          {bankMaintenanceResult.error}
        </div>
      ) : bankMaintenanceResult.type === "missing" ? (
        <div className="text-[10px] font-black text-emerald-800">
          {bankMaintenanceResult.markedDeleted || 0} eksik dosyalı kayıt güvenli biçimde pasife alındı.
        </div>
      ) : bankMaintenanceResult.type === "orphans" ? (
        <div className="text-[10px] font-black text-emerald-800">
          {bankMaintenanceResult.removed || 0} sahipsiz fiziksel dosya temizlendi.
        </div>
      ) : (
        <div className="text-[10px] font-black text-emerald-800">
          Soru bankası optimize edildi • {bankMaintenanceResult.indexedRecords || 0} kayıt indekslendi • {bankMaintenanceResult.durationMs || 0} ms
        </div>
      )}
    </div>
  )}
</div>
  );
}

