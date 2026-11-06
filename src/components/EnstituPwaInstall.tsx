import React from "react";
import { CheckCircle2, Download, ExternalLink, Share2, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

declare global {
  interface Window {
    __enstituPwaInstallPrompt?: BeforeInstallPromptEvent | null;
    __hasatPwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const isPortalRoute = () => /^\/(?:t|ogrenci|veli)\/[^/]+\/?$/i.test(window.location.pathname);

const isIosDevice = () => {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const iosVersion = () => {
  const ua = navigator.userAgent || "";
  const direct = ua.match(/OS (\d+)[._](\d+)/i);
  if (direct) return { major: Number(direct[1] || 0), minor: Number(direct[2] || 0) };
  const version = ua.match(/Version\/(\d+)\.(\d+)/i);
  return version ? { major: Number(version[1] || 0), minor: Number(version[2] || 0) } : null;
};

const isStandalone = () => {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

export default function EnstituPwaInstall() {
  const portalRoute = isPortalRoute();
  const isIos = isIosDevice();
  const version = React.useMemo(() => (isIos ? iosVersion() : null), [isIos]);
  const [standalone, setStandalone] = React.useState(isStandalone);
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(
    () => window.__enstituPwaInstallPrompt || window.__hasatPwaInstallPrompt || null,
  );
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!portalRoute) return;

    try {
      localStorage.setItem(
        "enstitu:pwa:last-portal",
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
    } catch {}

    const showIfReady = () => {
      const current = window.__enstituPwaInstallPrompt || window.__hasatPwaInstallPrompt || null;
      if (current) setPromptEvent(current);
    };

    const installed = () => {
      setStandalone(true);
      setOpen(false);
      setPromptEvent(null);
    };

    const syncMode = () => {
      const installedNow = isStandalone();
      setStandalone(installedNow);
      if (installedNow) setOpen(false);
    };

    const mode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("enstitu:pwa-install-ready", showIfReady);
    window.addEventListener("hasat:pwa-install-ready", showIfReady);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("focus", syncMode);
    window.addEventListener("pageshow", syncMode);
    document.addEventListener("visibilitychange", syncMode);
    mode.addEventListener?.("change", syncMode);

    if (!isStandalone()) {
      showIfReady();
      const autoOpenTimer = window.setTimeout(() => setOpen(true), 900);
      return () => {
        window.clearTimeout(autoOpenTimer);
        window.removeEventListener("enstitu:pwa-install-ready", showIfReady);
        window.removeEventListener("hasat:pwa-install-ready", showIfReady);
        window.removeEventListener("appinstalled", installed);
        window.removeEventListener("focus", syncMode);
        window.removeEventListener("pageshow", syncMode);
        document.removeEventListener("visibilitychange", syncMode);
        mode.removeEventListener?.("change", syncMode);
      };
    }

    return () => {
      window.removeEventListener("enstitu:pwa-install-ready", showIfReady);
      window.removeEventListener("hasat:pwa-install-ready", showIfReady);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("focus", syncMode);
      window.removeEventListener("pageshow", syncMode);
      document.removeEventListener("visibilitychange", syncMode);
      mode.removeEventListener?.("change", syncMode);
    };
  }, [portalRoute]);

  if (!portalRoute || standalone) return null;

  const install = async () => {
    const current = promptEvent || window.__enstituPwaInstallPrompt || window.__hasatPwaInstallPrompt;
    if (!current) return;
    setBusy(true);
    try {
      await current.prompt();
      const choice = await current.userChoice;
      window.__enstituPwaInstallPrompt = null;
      window.__hasatPwaInstallPrompt = null;
      setPromptEvent(null);
      if (choice.outcome === "accepted") {
        setOpen(false);
        setStandalone(true);
      } else {
        setOpen(false);
        setDismissed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    if (dismissed) return null;
    if (!promptEvent && !isIos) return null;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[100000] flex min-h-12 items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-xs font-black text-white shadow-2xl"
      >
        <Download className="h-4 w-4" />
        {isIos ? "iPhone’a Kur" : "Ana Ekrana Ekle"}
      </button>
    );
  }

  const olderIos = Boolean(version && (version.major < 16 || (version.major === 16 && version.minor < 4)));
  const ios26OrNewer = Boolean(version && version.major >= 26);

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">e-Nstitü</span>
            <h2 className="mt-1 text-xl font-black text-slate-950">e-Nstitü’yü telefonuma kur</h2>
            <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">
              Bir kez ekleyin; bundan sonra e-Nstitü simgesine dokunarak doğrudan uygulamayı açın.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setDismissed(true);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
            aria-label="Kurulum penceresini kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isIos ? (
          <div className="mt-5 space-y-3">
            {!window.isSecureContext && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-[10px] font-black leading-5 text-red-800">
                iPhone kurulumu için e-Nstitü HTTPS üzerinden açılmalıdır. Adresi https:// ile açın.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div className="space-y-2 text-[11px] font-bold leading-5 text-slate-700">
                  <p><strong>1.</strong> Tarayıcının <strong>Paylaş</strong> düğmesine dokunun.</p>
                  <p><strong>2.</strong> Listeden <strong>Ana Ekrana Ekle</strong> seçeneğini açın.</p>
                  {ios26OrNewer && <p><strong>3.</strong> <strong>Web Uygulaması Olarak Aç</strong> seçeneği açık kalsın.</p>}
                  <p><strong>{ios26OrNewer ? "4" : "3"}.</strong> Sağ üstteki <strong>Ekle</strong> düğmesine dokunun.</p>
                </div>
              </div>
            </div>

            {olderIos && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold leading-5 text-amber-900">
                Bu iPhone eski bir iOS sürümü kullanıyor. “Ana Ekrana Ekle” görünmüyorsa bağlantıyı Safari’de açın ve aynı adımları uygulayın.
              </div>
            )}

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold leading-5 text-sky-900">
              “Ana Ekrana Ekle” paylaşım listesinde görünmüyorsa listenin en altındaki <strong>Eylemleri Düzenle</strong> bölümünden etkinleştirin.
            </div>

            {!olderIos && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold leading-5 text-violet-900">
                Kurulumdan sonra e-Nstitü’yü <strong>Ana Ekrandaki ikonundan</strong> açın ve uygulama içindeki <strong>Kapalıyken Mesaj Bildirimi</strong> seçeneğini bir kez etkinleştirin. Bundan sonra yeni mesajlar uygulama kapalıyken de Kilit Ekranı ve Bildirim Merkezi’nde görünebilir.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (isStandalone()) {
                  setStandalone(true);
                  setOpen(false);
                } else {
                  setOpen(false);
                }
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-black text-teal-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              Kurulum adımlarını tamamladım
            </button>

            <p className="flex items-center justify-center gap-1 text-center text-[9px] font-bold leading-4 text-slate-400">
              <ExternalLink className="h-3 w-3" />
              Apple güvenlik gereği iPhone’da son “Ekle” dokunuşunu kullanıcıdan ister.
            </p>
          </div>
        ) : promptEvent ? (
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-4 text-sm font-black text-white shadow-lg active:scale-[0.99] disabled:bg-slate-400"
          >
            <Download className="h-5 w-5" />
            {busy ? "Kurulum açılıyor…" : "TELEFONUMA KUR"}
          </button>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] font-bold leading-5 text-amber-900">
              Bu telefonda doğrudan kurulum düğmesi henüz tarayıcı tarafından verilmedi. e-Nstitü kurulum uygunluğunu otomatik izliyor; hazır olduğunda <strong>TELEFONUMA KUR</strong> düğmesi burada etkinleşir.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
