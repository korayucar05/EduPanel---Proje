import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  bankIndexStatus: any;
  bankIndexRebuilding: boolean;
  rebuildBankIndex: () => void | Promise<void>;
};

export default function QuestionBankSqliteIndexSection({
  bankIndexStatus,
  bankIndexRebuilding,
  rebuildBankIndex,
}: Props) {
  return (
<div className={`mt-5 rounded-2xl border p-4 ${
  bankIndexStatus?.ok
    ? "border-emerald-200 bg-emerald-50/70"
    : "border-amber-200 bg-amber-50/70"
}`}>
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">SQLite Soru İndeksi</div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Büyük soru bankasında arama ve filtreleme gerçek SQLite indeksleri üzerinden çalışır.
      </div>
    </div>
    <button
      type="button"
      disabled={bankIndexRebuilding}
      onClick={() => void rebuildBankIndex()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-[10px] font-black text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${bankIndexRebuilding ? "animate-spin" : ""}`} />
      {bankIndexRebuilding ? "İndeksleniyor…" : "İndeksi Yeniden Oluştur"}
    </button>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">Kaynak Kayıt</div>
      <div className="mt-1 text-lg font-black text-slate-900">
        {Number(bankIndexStatus?.sourceRecords || 0).toLocaleString("tr-TR")}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">İndeksli Kayıt</div>
      <div className="mt-1 text-lg font-black text-slate-900">
        {Number(bankIndexStatus?.indexedRecords || 0).toLocaleString("tr-TR")}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">SQLite İndeksi</div>
      <div className="mt-1 text-lg font-black text-slate-900">
        {Number(bankIndexStatus?.indexCount || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">Kullanım Kaydı</div>
      <div className="mt-1 text-lg font-black text-slate-900">
        {Number(bankIndexStatus?.totalUsage || 0).toLocaleString("tr-TR")}
      </div>
    </div>
  </div>

  <div className={`mt-3 text-[9px] font-black ${
    bankIndexStatus?.ok ? "text-emerald-700" : "text-amber-700"
  }`}>
    {bankIndexStatus?.ok
      ? "İndeks kaynak soru kayıtlarıyla senkron."
      : "İndeks ile kaynak kayıt sayısı farklı. Yeniden indeksleme önerilir."}
  </div>
</div>
  );
}
