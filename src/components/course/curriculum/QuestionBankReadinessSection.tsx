import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  productionReadiness: any;
  productionReadinessLoading: boolean;
  refreshProductionReadiness: () => void | Promise<void>;
  technicalDiagnosticsOpen: boolean;
  setTechnicalDiagnosticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function QuestionBankReadinessSection({
  productionReadiness,
  productionReadinessLoading,
  refreshProductionReadiness,
  technicalDiagnosticsOpen,
  setTechnicalDiagnosticsOpen,
}: Props) {
  if (!productionReadiness) return null;

  return (
    <>
              {productionReadiness && (
                <div className={`mt-5 rounded-2xl border p-4 ${
                  productionReadiness.status === "ready"
                    ? "border-emerald-200 bg-emerald-50/70"
                    : productionReadiness.status === "warning"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-rose-200 bg-rose-50/70"
                }`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">Soru Bankası Sistem Durumu</div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-600">
                        {productionReadiness.operatorMessage}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className={`rounded-xl px-3 py-2 text-[9px] font-black text-white ${
                        productionReadiness.status === "ready"
                          ? "bg-emerald-700"
                          : productionReadiness.status === "warning"
                            ? "bg-amber-600"
                            : "bg-rose-700"
                      }`}>
                        {productionReadiness.status === "ready"
                          ? "HAZIR"
                          : productionReadiness.status === "warning"
                            ? "BAKIM ÖNERİLİYOR"
                            : "MÜDAHALE GEREKLİ"}
                      </div>
                      <button
                        type="button"
                        disabled={productionReadinessLoading}
                        onClick={() => void refreshProductionReadiness()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[8px] font-black text-slate-700 disabled:opacity-40"
                      >
                        <RefreshCw className={`h-3 w-3 ${productionReadinessLoading ? "animate-spin" : ""}`} />
                        Yenile
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">Sağlık</div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(productionReadiness.health?.score || 0)} / 100 • {productionReadiness.health?.grade}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">Aktif Soru</div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(productionReadiness.dataset?.active || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">Kontroller</div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Math.max(0, Number(productionReadiness.checks?.length || 0) - Number(productionReadiness.failedCount || 0))}
                        {" / "}{Number(productionReadiness.checks?.length || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {(productionReadiness.checks || []).map((check: any) => (
                      <div key={check.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/75 px-3 py-2">
                        <div>
                          <div className="text-[8px] font-black text-slate-700">{check.label}</div>
                          <div className="text-[7px] font-semibold text-slate-500">{check.detail}</div>
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[7px] font-black ${
                          check.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}>
                          {check.ok ? "TAMAM" : "KONTROL"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTechnicalDiagnosticsOpen((value) => !value)}
                    className="mt-3 text-[8px] font-black text-slate-500 underline underline-offset-2"
                  >
                    {technicalDiagnosticsOpen ? "Teknik ayrıntıları gizle" : "Teknik bakım ayrıntılarını göster"}
                  </button>
                </div>
              )}
    </>
  );
}