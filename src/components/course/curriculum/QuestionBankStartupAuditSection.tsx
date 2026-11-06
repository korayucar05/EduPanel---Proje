import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  startupAudit: any[];
  startupAuditRunning: boolean;
  refreshStartupAudit: (runNow?: boolean) => void | Promise<void>;
};

export default function QuestionBankStartupAuditSection({
  startupAudit,
  startupAuditRunning,
  refreshStartupAudit,
}: Props) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">
            Başlangıç Denetimi
          </div>

          <div className="mt-1 text-[10px] font-semibold text-slate-500">
            Sunucu açılışında soru bankasının şema, indeks ve fiziksel dosya durumunu kaydeder.
          </div>
        </div>

        <button
          type="button"
          disabled={startupAuditRunning}
          onClick={() => void refreshStartupAudit(true)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-[9px] font-black text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              startupAuditRunning ? "animate-spin" : ""
            }`}
          />
          Şimdi Denetle
        </button>
      </div>

      {startupAudit.length > 0 ? (
        <div className="mt-3 space-y-2">
          {startupAudit.slice(0, 5).map((item: any) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white bg-white/90 px-3 py-2"
            >
              <div>
                <div className="text-[9px] font-black text-slate-800">
                  {item.status === "healthy"
                    ? "Sağlıklı"
                    : item.status === "migration_failed"
                      ? "Migration Hatası"
                      : item.status === "missing_files"
                        ? "Eksik Dosya"
                        : item.status === "index_mismatch"
                          ? "İndeks Uyumsuzluğu"
                          : "Salt Okunur"}
                </div>

                <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
                  {item.checkedAt}
                  {" • "}
                  Şema v{Number(item.schemaVersion || 0)}/v
                  {Number(item.targetVersion || 0)}
                </div>
              </div>

              <span
                className={`rounded-lg px-2 py-1 text-[8px] font-black ${
                  item.writable
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {item.writable ? "YAZILABİLİR" : "KİLİTLİ"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-white/80 p-3 text-[9px] font-semibold text-slate-500">
          Henüz başlangıç denetimi kaydı yok.
        </div>
      )}
    </div>
  );
}
