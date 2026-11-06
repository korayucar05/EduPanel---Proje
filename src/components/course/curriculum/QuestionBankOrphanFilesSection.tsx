import React from "react";
import { Archive, RefreshCw } from "lucide-react";

type Props = {
  orphanScan: any;
  orphanScanning: boolean;
  orphanQuarantining: boolean;

  scanOrphanFiles: () => void | Promise<void>;
  quarantineOrphanFiles: () => void | Promise<void>;

  formatBytes: (bytes: number) => string;
};

export default function QuestionBankOrphanFilesSection({
  orphanScan,
  orphanScanning,
  orphanQuarantining,
  scanOrphanFiles,
  quarantineOrphanFiles,
  formatBytes,
}: Props) {
  return (
    <>
<div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Sahipsiz Dosya Denetimi
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Diskte bulunan fakat aktif soru metadata kaydıyla eşleşmeyen JPG/PNG dosyalarını tespit eder. Dosyalar doğrudan silinmez.
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={orphanScanning}
        onClick={() => void scanOrphanFiles()}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 text-[9px] font-black text-orange-800 hover:bg-orange-50 disabled:opacity-40"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${orphanScanning ? "animate-spin" : ""}`} />
        {orphanScanning ? "Taranıyor…" : "Yeniden Tara"}
      </button>
      <button
        type="button"
        disabled={
          orphanQuarantining ||
          Number(orphanScan?.orphanCount || 0) <= 0
        }
        onClick={() => void quarantineOrphanFiles()}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-orange-700 px-3 text-[9px] font-black text-white hover:bg-orange-800 disabled:opacity-40"
      >
        <Archive className="h-3.5 w-3.5" />
        {orphanQuarantining
          ? "Karantinaya alınıyor…"
          : `Karantinaya Al (${Number(orphanScan?.orphanCount || 0)})`}
      </button>
    </div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-3">
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[8px] font-black uppercase text-slate-400">
        Aktif Kayıt
      </div>
      <div className="mt-1 text-lg font-black text-slate-800">
        {Number(orphanScan?.knownRecords || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[8px] font-black uppercase text-slate-400">
        Sahipsiz Dosya
      </div>
      <div className={`mt-1 text-lg font-black ${
        Number(orphanScan?.orphanCount || 0) > 0
          ? "text-orange-800"
          : "text-emerald-800"
      }`}>
        {Number(orphanScan?.orphanCount || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[8px] font-black uppercase text-slate-400">
        Sahipsiz Boyut
      </div>
      <div className="mt-1 text-lg font-black text-slate-800">
        {formatBytes(Number(orphanScan?.orphanBytes || 0))}
      </div>
    </div>
  </div>

  {orphanScan?.quarantineDirectory && (
    <div className="mt-3 rounded-xl border border-orange-200 bg-white/80 px-3 py-2 text-[9px] font-semibold text-orange-800">
      Karantina: {orphanScan.quarantineDirectory}
    </div>
  )}
</div>
    </>
  );
}
