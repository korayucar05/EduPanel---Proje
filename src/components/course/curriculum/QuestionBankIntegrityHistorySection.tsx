import React from "react";
import { Download, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

type Props = {
  integrityHistory: any[];
  integrityRunning: boolean;
  integrityChanges: any;
  integrityRecommendations: any;
  refreshIntegrityHistory: (runNow?: boolean) => void | Promise<void>;

  safeActions: any[];
  safeActionRunning: string | null;
  safeActionResult: any;

  executeSafeRecommendation: (item: any) => void | Promise<void>;

  safeActionAudit: any[];
  safeActionAuditLoading: boolean;
  safeActionAuditCleaning: boolean;
  safeActionAuditExporting: boolean;

  safeActionAuditFilter: string;
  setSafeActionAuditFilter: React.Dispatch<React.SetStateAction<string>>;

  refreshSafeActionAudit: () => void | Promise<void>;
  exportSafeActionAudit: () => void | Promise<void>;
  cleanSafeActionAudit: () => void | Promise<void>;
};

export default function QuestionBankIntegrityHistorySection({
  integrityHistory,
  integrityRunning,
  integrityChanges,
  integrityRecommendations,
  refreshIntegrityHistory,

  safeActions,
  safeActionRunning,
  safeActionResult,
  executeSafeRecommendation,

  safeActionAudit,
  safeActionAuditLoading,
  safeActionAuditCleaning,
  safeActionAuditExporting,
  safeActionAuditFilter,
  setSafeActionAuditFilter,

  refreshSafeActionAudit,
  exportSafeActionAudit,
  cleanSafeActionAudit,
}: Props) {
  return (
    <>
<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-black text-slate-900">
        Soru Bankası Bütünlük Geçmişi
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        Soru sayısı, indeks, eksik dosya, sahipsiz dosya, karantina ve yazma günlüğü durumunu zaman içinde karşılaştırır.
      </div>
    </div>
    <button
      type="button"
      disabled={integrityRunning}
      onClick={() => void refreshIntegrityHistory(true)}
      className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-[9px] font-black text-white hover:bg-emerald-800 disabled:opacity-40"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${integrityRunning ? "animate-spin" : ""}`} />
      {integrityRunning ? "Kontrol ediliyor…" : "Yeni Bütünlük Kaydı"}
    </button>
  </div>

  {Array.isArray(integrityRecommendations?.recommendations) &&
    integrityRecommendations.recommendations.length > 0 && (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9px] font-black text-slate-900">
            Sistem Önerileri
          </div>
          <div className={`rounded-full px-2 py-1 text-[8px] font-black ${
            integrityRecommendations.severity === "critical"
              ? "bg-rose-700 text-white"
              : integrityRecommendations.severity === "warning"
                ? "bg-amber-600 text-white"
                : "bg-emerald-700 text-white"
          }`}>
            {integrityRecommendations.severity === "critical"
              ? "ÖNCELİKLİ MÜDAHALE"
              : integrityRecommendations.severity === "warning"
                ? "KONTROL ÖNERİLİYOR"
                : "SORUN YOK"}
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {integrityRecommendations.recommendations
            .slice(0, 6)
            .map((item: any) => (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-2 ${
                  item.priority === "critical"
                    ? "border-rose-100 bg-rose-50"
                    : item.priority === "warning"
                      ? "border-amber-100 bg-amber-50"
                      : "border-emerald-100 bg-emerald-50"
                }`}
              >
                <div className="text-[9px] font-black text-slate-800">
                  {item.title}
                </div>
                <div className="mt-0.5 text-[8px] font-semibold leading-4 text-slate-600">
                  {item.description}
                </div>

                {item.action && (
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={
                        safeActionRunning === item.action ||
                        (
                          item.action !== "support-bundle" &&
                          !safeActions.some(
                            (action: any) =>
                              action.id === item.action &&
                              !action.destructive,
                          )
                        )
                      }
                      onClick={() =>
                        void executeSafeRecommendation(item)
                      }
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-black text-white disabled:opacity-40 ${
                        item.priority === "critical"
                          ? "bg-rose-700 hover:bg-rose-800"
                          : item.priority === "warning"
                            ? "bg-amber-700 hover:bg-amber-800"
                            : "bg-emerald-700 hover:bg-emerald-800"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {safeActionRunning === item.action
                        ? "İşlem yapılıyor…"
                        : item.action === "support-bundle"
                          ? "Teknik Raporu Al"
                          : item.action === "recover-writes"
                            ? "Yarım Yazmaları Kurtar"
                            : item.action === "quarantine-orphans"
                              ? "Karantinaya Al"
                              : item.action === "integrity-snapshot"
                                ? "Bütünlük Kaydı Oluştur"
                                : item.action === "safe-mode-recheck"
                                  ? "Yeniden Kontrol Et"
                                  : "Güvenli İşlemi Çalıştır"}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    )}

  <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[9px] font-black text-slate-900">
          Güvenli Eylem Geçmişi
        </div>
        <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
          Bakım sırasında çalıştırılan güvenli işlemlerin denetim kaydı.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={safeActionAuditFilter}
          onChange={(event) => {
            setSafeActionAuditFilter(event.target.value);
            setTimeout(() => void refreshSafeActionAudit(), 0);
          }}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[8px] font-black text-slate-700"
        >
          <option value="">Tümü</option>
          <option value="success">Başarılı</option>
          <option value="failed">Hatalı</option>
          <option value="running">Çalışıyor</option>
        </select>

        <button
          type="button"
          disabled={safeActionAuditExporting}
          onClick={() => void exportSafeActionAudit()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[8px] font-black text-blue-800 hover:bg-blue-100 disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          {safeActionAuditExporting ? "Aktarılıyor…" : "JSON Dışa Aktar"}
        </button>

        <button
          type="button"
          disabled={safeActionAuditCleaning}
          onClick={() => void cleanSafeActionAudit()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[8px] font-black text-rose-800 hover:bg-rose-100 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" />
          {safeActionAuditCleaning ? "Temizleniyor…" : "90+ Gün Temizle"}
        </button>

        <button
          type="button"
          disabled={safeActionAuditLoading}
          onClick={() => void refreshSafeActionAudit()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[8px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3 w-3 ${
              safeActionAuditLoading ? "animate-spin" : ""
            }`}
          />
          Yenile
        </button>
      </div>
    </div>

    {safeActionAudit.length > 0 ? (
      <div className="mt-2 max-h-52 space-y-1.5 overflow-auto pr-1">
        {safeActionAudit.slice(0, 15).map((item: any) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[8px] font-black text-slate-800">
                {item.label}
              </div>
              <div className="mt-0.5 text-[7px] font-semibold text-slate-500">
                {item.startedAt}
                {Number(item.durationMs || 0) > 0
                  ? ` • ${Number(item.durationMs)} ms`
                  : ""}
              </div>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-[7px] font-black ${
                item.status === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : item.status === "failed"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {item.status === "success"
                ? "BAŞARILI"
                : item.status === "failed"
                  ? "HATA"
                  : "ÇALIŞIYOR"}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-2 text-[8px] font-semibold text-slate-500">
        Henüz güvenli eylem kaydı yok.
      </div>
    )}
  </div>

  {safeActionResult && (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-[9px] font-black ${
        safeActionResult.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {safeActionResult.success
        ? `${safeActionResult.label || "Güvenli işlem"} tamamlandı.`
        : safeActionResult.message ||
          "Güvenli işlem tamamlanamadı."}
    </div>
  )}

  {integrityChanges?.latest?.hasPrevious && (
    <div className={`mt-3 rounded-xl border px-3 py-3 ${
      integrityChanges.latest.severity === "critical"
        ? "border-rose-200 bg-rose-50"
        : integrityChanges.latest.severity === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[9px] font-black text-slate-800">
          Son Kontrolde Değişiklik Analizi
        </div>
        <div className={`rounded-full px-2 py-1 text-[8px] font-black ${
          integrityChanges.latest.severity === "critical"
            ? "bg-rose-700 text-white"
            : integrityChanges.latest.severity === "warning"
              ? "bg-amber-600 text-white"
              : "bg-emerald-700 text-white"
        }`}>
          {integrityChanges.latest.severity === "critical"
            ? "KRİTİK"
            : integrityChanges.latest.severity === "warning"
              ? "UYARI"
              : "NORMAL"}
        </div>
      </div>

      {Array.isArray(integrityChanges.latest.reasons) &&
        integrityChanges.latest.reasons.length > 0 && (
          <div className="mt-2 space-y-1">
            {integrityChanges.latest.reasons.map(
              (reason: string, index: number) => (
                <div
                  key={`${reason}-${index}`}
                  className="text-[9px] font-semibold text-slate-700"
                >
                  • {reason}
                </div>
              ),
            )}
          </div>
        )}

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Soru Farkı
          </div>
          <div className="text-[10px] font-black text-slate-800">
            {Number(integrityChanges.latest.delta?.activeRecords || 0) > 0 ? "+" : ""}
            {Number(integrityChanges.latest.delta?.activeRecords || 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Eksik Dosya Farkı
          </div>
          <div className="text-[10px] font-black text-slate-800">
            {Number(integrityChanges.latest.delta?.missingFiles || 0) > 0 ? "+" : ""}
            {Number(integrityChanges.latest.delta?.missingFiles || 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Sahipsiz Farkı
          </div>
          <div className="text-[10px] font-black text-slate-800">
            {Number(integrityChanges.latest.delta?.orphanFiles || 0) > 0 ? "+" : ""}
            {Number(integrityChanges.latest.delta?.orphanFiles || 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-2">
          <div className="text-[7px] font-black uppercase text-slate-400">
            Hatalı Yazma Farkı
          </div>
          <div className="text-[10px] font-black text-slate-800">
            {Number(integrityChanges.latest.delta?.failedWrites || 0) > 0 ? "+" : ""}
            {Number(integrityChanges.latest.delta?.failedWrites || 0)}
          </div>
        </div>
      </div>
    </div>
  )}

  {integrityHistory.length > 0 ? (
    <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
      {integrityHistory.slice(0, 10).map((item: any) => (
        <div
          key={item.id}
          className="grid gap-2 rounded-xl border border-white bg-white/90 px-3 py-2 sm:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]"
        >
          <div>
            <div className={`text-[9px] font-black ${
              item.status === "healthy"
                ? "text-emerald-700"
                : item.status === "warning"
                  ? "text-amber-700"
                  : "text-rose-700"
            }`}>
              {item.status === "healthy"
                ? "SAĞLIKLI"
                : item.status === "warning"
                  ? "UYARI"
                  : "MÜDAHALE"}
            </div>
            <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
              {item.checkedAt}
            </div>
          </div>
          <div>
            <div className="text-[7px] font-black uppercase text-slate-400">Aktif</div>
            <div className="text-[10px] font-black text-slate-800">{Number(item.activeRecords || 0)}</div>
          </div>
          <div>
            <div className="text-[7px] font-black uppercase text-slate-400">Eksik</div>
            <div className="text-[10px] font-black text-slate-800">{Number(item.missingFiles || 0)}</div>
          </div>
          <div>
            <div className="text-[7px] font-black uppercase text-slate-400">Sahipsiz</div>
            <div className="text-[10px] font-black text-slate-800">{Number(item.orphanFiles || 0)}</div>
          </div>
          <div>
            <div className="text-[7px] font-black uppercase text-slate-400">Bekleyen Yazma</div>
            <div className="text-[10px] font-black text-slate-800">{Number(item.pendingWrites || 0)}</div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="mt-3 rounded-xl bg-white/80 p-3 text-[9px] font-semibold text-slate-500">
      Henüz bütünlük geçmişi yok.
    </div>
  )}
</div>
    </>
  );
}

