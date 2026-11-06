import React from "react";
import { Check, Download, MonitorSmartphone, Share2, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  appName: string;
  storageKey: string;
  compact?: boolean;
};

const isStandalone = () => {
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia?.("(display-mode: standalone)")?.matches || iosStandalone;
};

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export default function PwaInstallCard({ appName, storageKey, compact = false }: Props) {
  const persistedKey = `enstitu_pwa_installed_${storageKey}`;
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const [hidden, setHidden] = React.useState(() =>
    isStandalone() || window.localStorage.getItem(persistedKey) === "1"
  );

  React.useEffect(() => {
    if (hidden) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      window.localStorage.setItem(persistedKey, "1");
      setHidden(true);
      setShowHelp(false);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [hidden, persistedKey]);

  const rememberInstalled = () => {
    window.localStorage.setItem(persistedKey, "1");
    setHidden(true);
    setShowHelp(false);
  };

  const install = async () => {
    if (isStandalone()) {
      rememberInstalled();
      return;
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") rememberInstalled();
        setPromptEvent(null);
        return;
      } catch {
        // Browser native prompt failed; fall through to instructions.
      }
    }

    setShowHelp(true);
  };

  if (hidden) return null;

  return (
    <div className={compact ? "rounded-2xl border border-emerald-200 bg-white shadow-sm" : "rounded-2xl border border-emerald-200 bg-gradient-to-r from-white to-emerald-50 shadow-sm"}>
      <div className={compact ? "flex items-center gap-2 p-2.5" : "flex items-center gap-3 p-3"}>
        <span className={compact ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"}>
          <MonitorSmartphone className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>

        <div className="min-w-0 flex-1">
          <strong className={compact ? "block truncate text-xs font-black text-slate-900" : "block truncate text-sm font-black text-slate-900"}>
            {appName}’i cihaza ekleyin
          </strong>
          {!compact && (
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
              Bir sonraki kullanımda bağlantı aramadan tek dokunuşla açın.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={install}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-[0.98]"
        >
          <Download className="h-4 w-4" />
          Cihaza Ekle
        </button>

        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Kurulum kartını kapat"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showHelp && (
        <div className="border-t border-emerald-100 px-3 pb-3 pt-2.5">
          {isIos() ? (
            <div className="space-y-2 text-[11px] font-semibold leading-5 text-slate-600">
              <div className="flex gap-2">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>
                  Safari’de <b>Paylaş</b> simgesine dokunun → <b>Ana Ekrana Ekle</b> → <b>Ekle</b>.
                </span>
              </div>
              <button
                type="button"
                onClick={rememberInstalled}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black text-white"
              >
                <Check className="h-3.5 w-3.5" />
                Kurulumu yaptım
              </button>
            </div>
          ) : (
            <div className="text-[11px] font-semibold leading-5 text-slate-600">
              Tarayıcı kurulum penceresi açılmadıysa menüden <b>Uygulamayı yükle</b> veya <b>Ana ekrana ekle</b> seçeneğini kullanın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
