import React from "react";
import { ShieldCheck } from "lucide-react";

type Props = {
  bankDiagnostics: any;
  bankDiagnosticsRunning: boolean;
  runBankDiagnostics: () => void | Promise<void>;
};

export default function QuestionBankDiagnosticsSection({
  bankDiagnostics,
  bankDiagnosticsRunning,
  runBankDiagnostics,
}: Props) {
  return (
<div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Otomatik Tanılama ve Hazırlık Testi
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Soru bankasının gerçek kullanıma hazır olup olmadığını tek testte kontrol eder.
      </div>
    </div>

    <button
      type="button"
      disabled={bankDiagnosticsRunning}
      onClick={() => void runBankDiagnostics()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-[10px] font-black text-white hover:bg-indigo-800 disabled:opacity-50"
    >
      <ShieldCheck className="h-4 w-4" />
      {bankDiagnosticsRunning
        ? "Tanılama çalışıyor…"
        : "Hazırlık Testini Çalıştır"}
    </button>
  </div>

  {bankDiagnostics && (
    <div className="mt-4">
      <div
        className={`rounded-xl border p-4 ${
          bankDiagnostics.grade === "ready"
            ? "border-emerald-200 bg-emerald-50"
            : bankDiagnostics.grade === "warning"
              ? "border-amber-200 bg-amber-50"
              : "border-rose-200 bg-rose-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className={`text-sm font-black ${
                bankDiagnostics.grade === "ready"
                  ? "text-emerald-900"
                  : bankDiagnostics.grade === "warning"
                    ? "text-amber-900"
                    : "text-rose-900"
              }`}
            >
              {bankDiagnostics.grade === "ready"
                ? "Soru bankası kullanıma hazır."
                : bankDiagnostics.grade === "warning"
                  ? "Soru bankası çalışabilir; bazı uyarılar var."
                  : "Soru bankasında giderilmesi gereken hata var."}
            </div>
            <div className="mt-1 text-[9px] font-semibold text-slate-500">
              {bankDiagnostics.summary?.totalChecks || 0} kontrol •{" "}
              {bankDiagnostics.summary?.ok || 0} başarılı •{" "}
              {bankDiagnostics.summary?.warnings || 0} uyarı •{" "}
              {bankDiagnostics.summary?.errors || 0} hata •{" "}
              {bankDiagnostics.summary?.durationMs || 0} ms
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(bankDiagnostics.checks || []).map((check: any) => (
          <div
            key={check.id}
            className={`rounded-xl border p-3 ${
              check.status === "ok"
                ? "border-emerald-100 bg-white"
                : check.status === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-rose-200 bg-rose-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black text-slate-800">
                {check.label}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[8px] font-black ${
                  check.status === "ok"
                    ? "bg-emerald-100 text-emerald-700"
                    : check.status === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {check.status === "ok"
                  ? "HAZIR"
                  : check.status === "warning"
                    ? "UYARI"
                    : "HATA"}
              </span>
            </div>
            <div className="mt-1 text-[9px] font-semibold leading-4 text-slate-500">
              {check.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
  );
}
