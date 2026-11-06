import React, { useEffect, useState } from "react";
import { Database, HardDriveDownload, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";

type Health = {
  ok?: boolean;
  server?: string;
  database?: string;
  databaseLatencyMs?: number;
  version?: string;
  backupAt?: string;
};

const authHeaders = () => {
  const token = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function SuperAdminSystemOperations() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/system/health", { cache: "no-store", headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Sunucu sağlık bilgisi alınamadı.");
      setHealth(data);
    } catch (error: any) {
      setHealth(null);
      setMessage(error?.message || "Sunucu sağlık bilgisi alınamadı.");
    } finally { setBusy(false); }
  };

  const backup = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/system/backup", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Merkezi veritabanı yedeği başlatılamadı.");
      setMessage(data?.message || "Merkezi veritabanı yedeği başarıyla başlatıldı.");
      await refresh();
    } catch (error: any) { setMessage(error?.message || "Yedek işlemi başarısız."); }
    finally { setBusy(false); }
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 bg-cyan-50 p-5">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-700" /><h3 className="font-black text-cyan-950">Merkezi Sunucu ve Veritabanı</h3></div>
          <p className="mt-1 text-xs text-cyan-700">Sadece Süper Admin: servis sağlığı, PostgreSQL bağlantısı ve merkezi yedek.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Kontrol Et</button>
          <button type="button" onClick={() => void backup()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><HardDriveDownload className="h-4 w-4" /> Yedek Al</button>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-4">
        <Card icon={<Server className="h-4 w-4" />} label="API Sunucusu" value={health ? (health.ok === false ? "Sorun" : health.server || "Çalışıyor") : "Bağlantı yok"} />
        <Card icon={<Database className="h-4 w-4" />} label="Veritabanı" value={health?.database || (health ? "Bağlı" : "Bilinmiyor")} />
        <Card icon={<RefreshCw className="h-4 w-4" />} label="DB Gecikme" value={health?.databaseLatencyMs != null ? `${health.databaseLatencyMs} ms` : "—"} />
        <Card icon={<HardDriveDownload className="h-4 w-4" />} label="Son Yedek" value={health?.backupAt ? new Date(health.backupAt).toLocaleString("tr-TR") : "—"} />
      </div>
      {message && <div className="mx-4 mb-4 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{message}</div>}
    </section>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">{icon}</span><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-xs text-slate-900">{value}</strong></div>;
}
