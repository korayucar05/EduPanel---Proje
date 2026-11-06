import React from "react";
import { ShieldCheck } from "lucide-react";

type Props = {
  databaseOptimization: any;
  databaseOptimizationRunning: boolean;
  executeDatabaseAnalyze: () => void | Promise<void>;
};

export default function QuestionBankDatabaseOptimizationSection({
  databaseOptimization,
  databaseOptimizationRunning,
  executeDatabaseAnalyze,
}: Props) {
  if (!databaseOptimization) return null;

  return (
                <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        SQLite Veritabanı Optimizasyonu
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        Veritabanı boyutu, boş sayfalar, indeksler ve performans regresyonunu birlikte değerlendirir.
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={databaseOptimizationRunning}
                      onClick={() => void executeDatabaseAnalyze()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-700 px-3 text-[9px] font-black text-white hover:bg-cyan-800 disabled:opacity-40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {databaseOptimizationRunning
                        ? "ANALYZE çalışıyor…"
                        : "Güvenli ANALYZE"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        DB Boyutu
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {(Number(databaseOptimization.databaseBytes || 0) / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Geri Kazanılabilir
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {(Number(databaseOptimization.reclaimableBytes || 0) / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Boş Sayfa
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        %{Number(databaseOptimization.freeRatio || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        İndeks
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(databaseOptimization.indexCount || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(databaseOptimization.recommendations || []).map((item: any) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border px-3 py-2 ${
                          item.priority === "warning"
                            ? "border-amber-200 bg-amber-50"
                            : "border-white bg-white/80"
                        }`}
                      >
                        <div className="text-[9px] font-black text-slate-800">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-[8px] font-semibold leading-4 text-slate-600">
                          {item.description}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-[8px] font-semibold text-slate-500">
                    VACUUM otomatik çalıştırılmaz; dosya yeniden yazdığı için yalnız ayrıca yönetici onayıyla uygulanmalıdır.
                  </div>
                </div>
  );
}