import React from "react";
import { RefreshCw, Trash2, Undo2 } from "lucide-react";

type Props = {
  quarantineInventory: any;
  quarantineLoading: boolean;
  quarantineRestoring: string | null;
  quarantinePurging: boolean;
  quarantinePurgeResult: any;

  refreshQuarantineInventory: () => void | Promise<void>;
  restoreQuarantinedFile: (quarantinePath: string) => void | Promise<void>;
  purgeOldQuarantine: () => void | Promise<void>;

  formatBytes: (value: number) => string;
};

export default function QuestionBankQuarantineVaultSection({
  quarantineInventory,
  quarantineLoading,
  quarantineRestoring,
  quarantinePurging,
  quarantinePurgeResult,
  refreshQuarantineInventory,
  restoreQuarantinedFile,
  purgeOldQuarantine,
  formatBytes,
}: Props) {
  return (
<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Karantina Kasası
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Sahipsiz olduğu için ayrılmış dosyalar burada tutulur. Dosyalar silinmeden önce gerektiğinde özgün konumlarına geri alınabilir.
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={quarantineLoading}
        onClick={() => void refreshQuarantineInventory()}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-[9px] font-black text-amber-800 hover:bg-amber-50 disabled:opacity-40"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${quarantineLoading ? "animate-spin" : ""}`} />
        {quarantineLoading ? "Yükleniyor…" : "Kasayı Yenile"}
      </button>
      <button
        type="button"
        disabled={quarantinePurging}
        onClick={() => void purgeOldQuarantine()}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-700 px-3 text-[9px] font-black text-white hover:bg-rose-800 disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {quarantinePurging
          ? "Temizleniyor…"
          : "30 Günden Eski Dosyaları Sil"}
      </button>
    </div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2">
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[8px] font-black uppercase text-slate-400">
        Karantinadaki Dosya
      </div>
      <div className="mt-1 text-lg font-black text-amber-800">
        {Number(quarantineInventory?.count || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[8px] font-black uppercase text-slate-400">
        Toplam Boyut
      </div>
      <div className="mt-1 text-lg font-black text-slate-800">
        {formatBytes(Number(quarantineInventory?.totalBytes || 0))}
      </div>
    </div>
  </div>

  {Array.isArray(quarantineInventory?.items) &&
    quarantineInventory.items.length > 0 && (
      <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
        {quarantineInventory.items.slice(0, 30).map((item: any) => (
          <div
            key={item.quarantinePath}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white bg-white/90 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[9px] font-black text-slate-800">
                {item.originalPath}
              </div>
              <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
                {item.batch} • {formatBytes(Number(item.sizeBytes || 0))}
              </div>
            </div>
            <button
              type="button"
              disabled={quarantineRestoring === item.quarantinePath}
              onClick={() =>
                void restoreQuarantinedFile(item.quarantinePath)
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-700 px-2.5 text-[8px] font-black text-white hover:bg-amber-800 disabled:opacity-40"
            >
              <Undo2 className="h-3 w-3" />
              {quarantineRestoring === item.quarantinePath
                ? "Geri alınıyor…"
                : "Geri Yükle"}
            </button>
          </div>
        ))}
      </div>
    )}

  {Number(quarantineInventory?.count || 0) === 0 && (
    <div className="mt-3 text-[9px] font-black text-emerald-700">
      Karantina kasası boş.
    </div>
  )}
  {quarantinePurgeResult && (
    <div className="mt-3 rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-[9px] font-semibold text-slate-600">
      Temizlik tamamlandı: {Number(quarantinePurgeResult.removedFiles || 0)} dosya,
      {" "}{formatBytes(Number(quarantinePurgeResult.removedBytes || 0))} alan,
      {" "}{Number(quarantinePurgeResult.removedBatches || 0)} karantina grubu kalıcı olarak silindi.
    </div>
  )}
</div>
  );
}
