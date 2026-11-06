import React, { useEffect, useState } from "react";
import { Download, MessageCircle, Save, Settings, Wifi, WifiOff, X } from "lucide-react";
import MessagesModule from "./MessagesModule";
import {
  loadMhatsappSettings,
  MhatsappSettings,
  saveMhatsappSettings,
} from "../lib/mhatsappApi";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function MobileMessagesApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<MhatsappSettings>(() => loadMhatsappSettings());
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const saveSettings = () => {
    saveMhatsappSettings(settings);
    setSettingsVersion(version => version + 1);
    setSettingsOpen(false);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-emerald-800/20 bg-emerald-700 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] text-white shadow-lg">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-2xl bg-white/15 p-2.5"><MessageCircle className="h-6 w-6" /></span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">e-Nstitü Mesaj</h1>
              <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-100">
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {online ? "Sunucu bağlantısı hazır" : "Çevrimdışı"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!standalone && installPrompt && (
              <button type="button" onClick={install} className="rounded-xl bg-white/15 p-2.5 hover:bg-white/25" title="Telefona yükle" aria-label="Telefona yükle">
                <Download className="h-5 w-5" />
              </button>
            )}
            <button type="button" onClick={() => { setSettings(loadMhatsappSettings()); setSettingsOpen(true); }} className="rounded-xl bg-white/15 p-2.5 hover:bg-white/25" title="API ayarları" aria-label="API ayarları">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl p-3 sm:p-4">
        {!settings.token && (
          <button type="button" onClick={() => setSettingsOpen(true)} className="mb-3 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs font-bold text-amber-800">
            Mesaj göndermek için önce sağ üstteki ayarlardan API tokenını kaydedin.
          </button>
        )}
        {!standalone && !installPrompt && (
          <p className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800">
            Uygulamayı telefona eklemek için tarayıcı menüsünden “Ana Ekrana Ekle” seçeneğini kullanabilirsiniz.
          </p>
        )}
        <MessagesModule mobile settingsRefresh={settingsVersion} />
      </main>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Mesaj API Ayarları</h2>
                <p className="text-xs font-semibold text-slate-500">Ayarlar yalnızca bu telefonda saklanır.</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-600">API Token
                <input type="password" className={`${inputClass} mt-1`} value={settings.token} onChange={event => setSettings({ ...settings, token: event.target.value })} placeholder="mHatsapp API token" />
              </label>
              <label className="block text-xs font-black text-slate-600">API Adresi
                <input className={`${inputClass} mt-1`} value={settings.baseUrl} onChange={event => setSettings({ ...settings, baseUrl: event.target.value })} />
              </label>
              <label className="block text-xs font-black text-slate-600">Toplu gönderim bekleme süresi (ms)
                <input type="number" min={0} className={`${inputClass} mt-1`} value={settings.delayMs} onChange={event => setSettings({ ...settings, delayMs: Number(event.target.value || 0) })} />
              </label>
              <button type="button" onClick={saveSettings} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[16.67px] font-black text-white shadow-lg shadow-emerald-600/20">
                <Save className="h-4 w-4" /> Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
