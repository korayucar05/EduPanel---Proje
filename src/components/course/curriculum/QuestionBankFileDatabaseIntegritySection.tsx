import React from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

type Props = {
  bankIntegrity: any;
  bankHealthLoading: boolean;
  integrityProblemCount: number;
  runQuestionBankIntegrity: () => void | Promise<void>;
};

export default function QuestionBankFileDatabaseIntegritySection({
  bankIntegrity,
  bankHealthLoading,
  integrityProblemCount,
  runQuestionBankIntegrity,
}: Props) {
  return (
    <>
<div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <div>
    <div className="text-sm font-black text-slate-900">Dosya–Veritabanı Bütünlüğü</div>
    <div className="mt-1 text-[10px] font-semibold text-slate-500">
      Kayıp dosya, sahipsiz dosya ve mükerrer görsel parmak izlerini tarar.
    </div>
  </div>
  <button
    type="button"
    disabled={bankHealthLoading}
    onClick={runQuestionBankIntegrity}
    className="inline-flex h-10 items-center gap-2 rounded-xl bg-purple-950 px-4 text-[11px] font-black text-white transition hover:bg-purple-900 disabled:opacity-50"
  >
    <RefreshCw className={`h-4 w-4 ${bankHealthLoading ? "animate-spin" : ""}`} />
    Bütünlüğü Kontrol Et
  </button>
</div>

{bankIntegrity && (
  <div
    className={`mt-3 rounded-2xl border p-4 ${
      bankIntegrity.ok
        ? "border-emerald-200 bg-emerald-50"
        : "border-rose-200 bg-rose-50"
    }`}
  >
    <div className="flex items-start gap-3">
      {bankIntegrity.ok ? (
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
      ) : (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-black ${
            bankIntegrity.ok ? "text-emerald-900" : "text-rose-900"
          }`}
        >
          {bankIntegrity.ok
            ? "Soru bankası bütünlüğü sağlıklı."
            : `${integrityProblemCount} bütünlük sorunu bulundu.`}
        </div>
        {!bankIntegrity.ok && (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl bg-white/70 p-3">
              <div className="text-[9px] font-black uppercase text-rose-500">Kayıp Dosya</div>
              <div className="mt-1 text-lg font-black text-rose-900">
                {bankIntegrity.missingFiles?.length || 0}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 p-3">
              <div className="text-[9px] font-black uppercase text-rose-500">Sahipsiz Dosya</div>
              <div className="mt-1 text-lg font-black text-rose-900">
                {bankIntegrity.orphanFiles?.length || 0}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 p-3">
              <div className="text-[9px] font-black uppercase text-rose-500">Mükerrer Görsel</div>
              <div className="mt-1 text-lg font-black text-rose-900">
                {bankIntegrity.duplicateHashes?.length || 0}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}
    </>
  );
}

