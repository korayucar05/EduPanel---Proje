import React from "react";


import { AlertTriangle } from "lucide-react";
type Props = {
  bankVersion: any;
  bankWriteState: any;
  migrationRecoveryLoading: boolean;
  openMigrationRecoveryPlan: () => void | Promise<void>;
};

export default function QuestionBankSchemaVersionSection({
  bankVersion,
  bankWriteState,
  migrationRecoveryLoading,
  openMigrationRecoveryPlan,
}: Props) {
  return (
<div
  className={`mt-5 rounded-2xl border p-4 ${
    bankVersion?.upToDate
      ? "border-indigo-200 bg-indigo-50/70"
      : "border-amber-200 bg-amber-50/70"
  }`}
>
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Soru Bankası Şema Sürümü
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Veritabanı migration geçmişi ve hedef şema sürümü.
      </div>
    </div>
    <div
      className={`rounded-xl px-3 py-2 text-[11px] font-black ${
        bankVersion?.upToDate
          ? "bg-indigo-700 text-white"
          : "bg-amber-500 text-white"
      }`}
    >
      v{Number(bankVersion?.schemaVersion || 0)}
      {" / "}
      v{Number(bankVersion?.targetSchemaVersion || 0)}
    </div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-3">
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">
        Mevcut Şema
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">
        v{Number(bankVersion?.schemaVersion || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">
        Hedef Şema
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">
        v{Number(bankVersion?.targetSchemaVersion || 0)}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 p-3">
      <div className="text-[9px] font-black uppercase text-slate-400">
        Migration
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">
        {Number(bankVersion?.migrationCount || 0)}
      </div>
    </div>
  </div>

  <div className={`mt-3 rounded-xl border px-3 py-2 ${
    bankWriteState?.readOnly
      ? "border-rose-200 bg-rose-50"
      : "border-emerald-200 bg-emerald-50"
  }`}>
    <div className={`text-[9px] font-black ${
      bankWriteState?.readOnly
        ? "text-rose-700"
        : "text-emerald-700"
    }`}>
      {bankWriteState?.readOnly
        ? "YAZMA KİLİDİ AKTİF — soru bankası salt okunur durumda."
        : "YAZMA DURUMU NORMAL — soru bankası yeni kayıt kabul ediyor."}
    </div>
  </div>

  <div
    className={`mt-3 text-[9px] font-black ${
      bankVersion?.upToDate
        ? "text-indigo-700"
        : "text-amber-700"
    }`}
  >
    {bankVersion?.upToDate
      ? "Soru bankası şeması güncel."
      : "Şema sürümü geride. Sunucuyu yeniden başlatıp migration sonuçlarını kontrol edin."}
  </div>

  <div className="mt-3 rounded-xl border border-white/80 bg-white/70 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-[9px] font-black uppercase text-slate-500">
        Migration Güvenliği
      </div>
      <span
        className={`rounded px-2 py-0.5 text-[8px] font-black ${
          bankVersion?.safety?.status === "failed"
            ? "bg-rose-100 text-rose-700"
            : bankVersion?.safety?.status === "running"
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {bankVersion?.safety?.status === "failed"
          ? "BAŞARISIZ"
          : bankVersion?.safety?.status === "running"
            ? "ÇALIŞIYOR"
            : "GÜVENLİ"}
      </span>
    </div>

    {bankVersion?.safety?.backupPath && (
      <div className="mt-2 break-all text-[8px] font-semibold text-slate-500">
        Migration öncesi yedek: {bankVersion.safety.backupPath}
      </div>
    )}

    {bankVersion?.safety?.lastError && (
      <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[8px] font-black text-rose-700">
        {bankVersion.safety.lastError}
      </div>
    )}
    {bankVersion?.safety?.status === "failed" && (
      <button
        type="button"
        disabled={migrationRecoveryLoading}
        onClick={() => void openMigrationRecoveryPlan()}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-black text-white hover:bg-rose-700 disabled:opacity-50"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {migrationRecoveryLoading
          ? "Kurtarma planı hazırlanıyor…"
          : "Migration Kurtarma Planını Aç"}
      </button>
    )}

    {Array.isArray(bankVersion?.pendingVersions) &&
      bankVersion.pendingVersions.length > 0 && (
        <div className="mt-2 text-[8px] font-black text-amber-700">
          Bekleyen migration: {bankVersion.pendingVersions.join(", ")}
        </div>
      )}
  </div>
</div>
  );
}

