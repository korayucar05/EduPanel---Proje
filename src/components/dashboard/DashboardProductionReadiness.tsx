import React from "react";
import { AlertTriangle, CheckCircle2, CloudCog, Copy, RefreshCw, ShieldCheck, WifiOff, ClipboardCheck } from "lucide-react";
import { productionAcceptanceService, type ProductionAcceptanceResult } from "../../core/production";
import type { DecisionTaskScope } from "../../core/data";

const tone = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

const StatusIcon = ({ status }: { status: "passed" | "warning" | "failed" }) => {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4" />;
  return <WifiOff className="h-4 w-4" />;
};

export default function DashboardProductionReadiness({ taskScope, refreshKey = 0 }: { taskScope: DecisionTaskScope; refreshKey?: number }) {
  const [result, setResult] = React.useState<ProductionAcceptanceResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copyState, setCopyState] = React.useState("İkinci cihaz testini kopyala");
  const [reportCopyState, setReportCopyState] = React.useState("Tanı raporunu kopyala");

  const run = React.useCallback(async () => {
    setLoading(true);
    try {
      setResult(await productionAcceptanceService.run(taskScope));
    } finally {
      setLoading(false);
    }
  }, [taskScope.schoolId, taskScope.userId, refreshKey]);

  React.useEffect(() => {
    void run();
  }, [run]);

  const copySecondDeviceSteps = async () => {
    const text = [
      "e-Nstitü İkinci Cihaz Senkronizasyon Kabul Testi",
      `Kurum: ${taskScope.schoolId}`,
      "1. Birinci cihazda e-Nstitü Brain kararını göreve çevirin.",
      "2. Bulut senkron düğmesine basın ve görevin 'Senkronize' olduğunu doğrulayın.",
      "3. İkinci cihazda aynı kurum kullanıcısıyla oturum açın.",
      "4. Dashboard > Yönetim Görev Panosu bölümünde görevin göründüğünü doğrulayın.",
      "5. İkinci cihazda göreve kısa bir not ekleyin ve bulut senkron yapın.",
      "6. Birinci cihazı yenileyin; notun geldiğini doğrulayın.",
      "7. Test sonucunu tarih, kullanıcı ve cihaz adıyla kayıt altına alın.",
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopyState("Kopyalandı");
    window.setTimeout(() => setCopyState("İkinci cihaz testini kopyala"), 1800);
  };


  const copyDiagnosticReport = async () => {
    if (!result) return;
    const lines = [
      "e-Nstitü CANLI PRODUCTION DIAGNOSTICS",
      `Kurum: ${taskScope.schoolId}`,
      `Hazırlık: %${result.score}`,
      `Karar: ${result.ready ? "ÜRETİME HAZIR" : "ENGEL VAR"}`,
      `Başarısız: ${result.failedCount} · Uyarı: ${result.warningCount}`,
      `Test: ${new Date(result.testedAt).toLocaleString("tr-TR")}`,
      "",
      ...result.checks.map((item) => `${item.status.toUpperCase()} | ${item.label} | ${item.detail}`),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setReportCopyState("Kopyalandı");
    window.setTimeout(() => setReportCopyState("Tanı raporunu kopyala"), 1800);
  };

  const scoreTone = !result ? "text-slate-400" : result.score >= 85 ? "text-emerald-600" : result.score >= 60 ? "text-amber-600" : "text-rose-600";

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Üretim Kabul Merkezi</span>
          <h2 className="mt-1 text-lg font-black text-slate-900">Canlı sistem hazırlık kontrolü</h2>
          <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">Sunucu, yerel veri, Firebase oturumu, kurum üyeliği ve Firestore erişimi tek testte doğrulanır.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
            <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Hazırlık</span>
            <strong className={`text-xl font-black ${scoreTone}`}>{result ? `%${result.score}` : "—"}</strong>
          </div>
          <button type="button" onClick={() => void run()} disabled={loading} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-black text-white disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Test ediliyor" : "Testi yenile"}
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${result.ready ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <div>
            <span className={`text-[9px] font-black uppercase tracking-[.14em] ${result.ready ? "text-emerald-600" : "text-rose-600"}`}>Canlı üretim kararı</span>
            <p className={`mt-1 text-sm font-black ${result.ready ? "text-emerald-900" : "text-rose-900"}`}>{result.ready ? "Üretime hazır — canlı kontrollerde engel yok" : `${result.failedCount} engel bulundu — final release için çözülmeli`}</p>
            <p className="mt-1 text-[9px] text-slate-500">Uyarı: {result.warningCount} · Başarısız: {result.failedCount}</p>
          </div>
          <button type="button" onClick={() => void copyDiagnosticReport()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
            <ClipboardCheck className="h-4 w-4" /> {reportCopyState}
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(result?.checks || []).map((item) => (
          <div key={item.id} className={`rounded-2xl border p-4 ${tone[item.status]}`}>
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <strong className="text-[10px] font-black">{item.label}</strong>
            </div>
            <p className="mt-2 text-[9px] leading-4 opacity-80">{item.detail}</p>
          </div>
        ))}
        {!result && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">Kabul testi hazırlanıyor.</div>}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
          <div className="flex items-start gap-3">
            <CloudCog className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <strong className="text-xs font-black text-violet-900">İkinci cihaz kabul testi</strong>
              <p className="mt-1 text-[9px] leading-4 text-violet-700">Gerçek çoklu cihaz doğrulaması otomatik olarak taklit edilmez. İki ayrı tarayıcı veya bilgisayarda aynı kurum hesabıyla kısa bir manuel test yapılmalıdır.</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => void copySecondDeviceSteps()} className="flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-[10px] font-black text-violet-700 hover:bg-violet-50">
          <Copy className="h-4 w-4" /> {copyState}
        </button>
      </div>

      {result?.membership && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[9px] font-bold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Kurum: {result.membership.schoolId} · Rol: {result.membership.role} · Kullanıcı: {result.membership.displayName || result.membership.uid}
        </div>
      )}
      {result && <p className="mt-3 text-right text-[8px] font-bold text-slate-400">Son test: {new Date(result.testedAt).toLocaleString("tr-TR")}</p>}
    </article>
  );
}
