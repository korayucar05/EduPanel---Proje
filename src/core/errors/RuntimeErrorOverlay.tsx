import React, { useEffect, useState } from "react";
import { AlertTriangle, Copy, Home, RefreshCw, X } from "lucide-react";
import type { StoredAppError } from "./errorLogger";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
type RuntimeErrorDetail = StoredAppError & { activeModule?: string };

export default function RuntimeErrorOverlay() {
  const [detail, setDetail] = useState<RuntimeErrorDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<StoredAppError>;
      if (!custom.detail) return;
      const activeModule = sqliteStorage.getItem("hasat_active_tab") || "bilinmiyor";
      setDetail({ ...custom.detail, activeModule });
    };
    window.addEventListener("hasat:runtime-error", handler);
    return () => window.removeEventListener("hasat:runtime-error", handler);
  }, []);

  if (!detail) return null;

  const copyDetails = async () => {
    const text = [
      `Hata No: ${detail.id}`,
      `Modül: ${detail.activeModule || "bilinmiyor"}`,
      `Kaynak: ${detail.source || "runtime"}`,
      `Mesaj: ${detail.message}`,
      detail.stack || "",
    ].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(text); }
    catch { window.prompt("Teknik ayrıntıları kopyalayın:", text); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <section className="w-full max-w-2xl rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-rose-100 p-3 text-rose-700"><AlertTriangle className="h-7 w-7" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">e-Nstitü çalışma zamanı koruması</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Modül çalışırken bir hata oluştu.</h2>
            <p className="mt-2 text-sm text-slate-600">Beyaz ekran yerine bu tanı ekranı gösterildi. Verileriniz silinmedi.</p>
          </div>
          <button type="button" onClick={() => setDetail(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Uyarıyı kapat"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><span className="font-bold text-slate-500">Modül:</span> <span className="font-mono font-bold text-slate-900">{detail.activeModule}</span></div>
          <div><span className="font-bold text-slate-500">Hata No:</span> <span className="font-mono font-bold text-slate-900">{detail.id}</span></div>
          <div className="sm:col-span-2 break-words text-rose-700"><span className="font-bold">Mesaj:</span> {detail.message}</div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><RefreshCw className="h-4 w-4" /> Yenile</button>
          <button type="button" onClick={() => { sqliteStorage.setItem("hasat_active_tab", "dashboard"); window.location.href = window.location.pathname; }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Home className="h-4 w-4" /> Ana panele dön</button>
          <button type="button" onClick={copyDetails} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Copy className="h-4 w-4" /> Teknik bilgiyi kopyala</button>
        </div>
      </section>
    </div>
  );
}
