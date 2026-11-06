import React from "react";
import { Download } from "lucide-react";

type Props = {
  supportBundleLoading: boolean;
  downloadSupportBundle: () => void | Promise<void>;
};

export default function QuestionBankTechnicalSupportSection({
  supportBundleLoading,
  downloadSupportBundle,
}: Props) {
  return (
<div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Teknik Destek Raporu
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        SQLite veritabanı, soru görselleri, öğrenci/öğretmen verileri ve soru metinleri olmadan yalnız teknik sağlık bilgisini JSON olarak dışa aktarır.
      </div>
    </div>
    <button
      type="button"
      disabled={supportBundleLoading}
      onClick={() => void downloadSupportBundle()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-700 px-4 text-[10px] font-black text-white hover:bg-sky-800 disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {supportBundleLoading ? "Hazırlanıyor…" : "Destek Raporunu İndir"}
    </button>
  </div>
</div>
  );
}
