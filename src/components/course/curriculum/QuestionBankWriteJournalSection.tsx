import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";

type Props = {
  writeJournalStatus: any;
  writeJournalCleaning: boolean;
  writeJournalRecovering: boolean;

  cleanWriteJournal: () => void | Promise<void>;
  recoverPendingWrites: () => void | Promise<void>;
};

export default function QuestionBankWriteJournalSection({
  writeJournalStatus,
  writeJournalCleaning,
  writeJournalRecovering,
  cleanWriteJournal,
  recoverPendingWrites,
}: Props) {
  return (
    <div className="mt-5 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">
            Çökme Dayanımlı Yazma Günlüğü
          </div>
          <div className="mt-1 text-[10px] font-semibold text-slate-500">
            Dosya yazımı ile SQLite metadata kaydı arasında yarım kalan soru yüklemelerini izler.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={writeJournalCleaning}
            onClick={() => void cleanWriteJournal()}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-3 text-[9px] font-black text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {writeJournalCleaning
              ? "Temizleniyor…"
              : "30 Günden Eski Günlüğü Temizle"}
          </button>

          <button
            type="button"
            disabled={
              writeJournalRecovering ||
              Number(writeJournalStatus?.counts?.pending || 0) <= 0
            }
            onClick={() => void recoverPendingWrites()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-fuchsia-700 px-3 text-[9px] font-black text-white hover:bg-fuchsia-800 disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                writeJournalRecovering ? "animate-spin" : ""
              }`}
            />
            {writeJournalRecovering
              ? "Kurtarılıyor…"
              : `Yarım İşlemleri Kurtar (${Number(
                  writeJournalStatus?.counts?.pending || 0
                )})`}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[8px] font-black uppercase text-slate-400">
            Bekleyen
          </div>
          <div className="mt-1 text-lg font-black text-amber-800">
            {Number(writeJournalStatus?.counts?.pending || 0)}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[8px] font-black uppercase text-slate-400">
            Tamamlanan
          </div>
          <div className="mt-1 text-lg font-black text-emerald-800">
            {Number(writeJournalStatus?.counts?.committed || 0)}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[8px] font-black uppercase text-slate-400">
            Kurtarılan
          </div>
          <div className="mt-1 text-lg font-black text-blue-800">
            {Number(writeJournalStatus?.counts?.recovered || 0)}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-3">
          <div className="text-[8px] font-black uppercase text-slate-400">
            Hatalı
          </div>
          <div className="mt-1 text-lg font-black text-rose-800">
            {Number(
              writeJournalStatus?.counts?.["recovery-failed"] || 0
            ) + Number(writeJournalStatus?.counts?.failed || 0)}
          </div>
        </div>
      </div>

      {Number(writeJournalStatus?.counts?.pending || 0) === 0 && (
        <div className="mt-3 text-[9px] font-black text-emerald-700">
          Yarım kalmış soru yazma işlemi yok.
        </div>
      )}

      <div
        className={`mt-2 text-[9px] font-black ${
          writeJournalStatus?.healthy
            ? "text-emerald-700"
            : "text-rose-700"
        }`}
      >
        {writeJournalStatus?.healthy
          ? "Yazma günlüğü sağlıklı."
          : "Yazma günlüğünde müdahale gerektiren kayıt var."}
      </div>
    </div>
  );
}
