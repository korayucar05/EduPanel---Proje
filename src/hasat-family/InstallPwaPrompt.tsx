import React from "react";
import { Download, Share2, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||(navigator as any).standalone===true;

export function InstallPwaPrompt(){
  const [installEvent,setInstallEvent]=React.useState<BeforeInstallPromptEvent|null>(()=>(window as any).__hasatPwaInstallPrompt||null);
  const [dismissed,setDismissed]=React.useState(false);
  const [installed,setInstalled]=React.useState(()=>isStandalone());
  const [showIosHelp,setShowIosHelp]=React.useState(false);

  React.useEffect(()=>{
    const sync=()=>setInstallEvent((window as any).__hasatPwaInstallPrompt||null);
    const before=(event:Event)=>{event.preventDefault();(window as any).__hasatPwaInstallPrompt=event as BeforeInstallPromptEvent;setInstallEvent(event as BeforeInstallPromptEvent);};
    const done=()=>{(window as any).__hasatPwaInstallPrompt=null;setInstalled(true);setInstallEvent(null);setDismissed(true);};
    sync();
    window.addEventListener("beforeinstallprompt",before);
    window.addEventListener("hasat:pwa-install-ready",sync);
    window.addEventListener("appinstalled",done);
    window.addEventListener("hasat:pwa-installed",done);
    return()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("hasat:pwa-install-ready",sync);window.removeEventListener("appinstalled",done);window.removeEventListener("hasat:pwa-installed",done);};
  },[]);

  if(dismissed||installed)return null;

  const install=async()=>{
    const prompt=installEvent||(window as any).__hasatPwaInstallPrompt;
    if(prompt){
      await prompt.prompt();
      const choice=await prompt.userChoice;
      (window as any).__hasatPwaInstallPrompt=null;
      setInstallEvent(null);
      if(choice.outcome==="accepted")setDismissed(true);
      return;
    }
    if(isIos()){
      setShowIosHelp(true);
      return;
    }
    window.alert("Chrome’da sağ üstteki ⋮ menüsüne dokunun → ‘Yükle ve kısayol oluştur’ → ‘Uygulamayı yükle’. ");
  };

  return <div className="fixed inset-x-3 bottom-4 z-[100] mx-auto max-w-md rounded-3xl border border-emerald-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl print:hidden">
    <button onClick={()=>setDismissed(true)} className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4"/></button>
    <div className="flex items-center gap-3 pr-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 text-xl font-black text-white">H</div>
      <div className="min-w-0 flex-1">
        <strong className="block text-sm font-black text-slate-900">e-Nstitü AİLE’yi ana ekrana ekleyin</strong>
        <span className="mt-1 block text-[11px] leading-5 text-slate-500">Dijital karnenize uygulama gibi tek dokunuşla ulaşın.</span>
      </div>
      <button onClick={install} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><Download className="h-4 w-4"/>Ekle</button>
    </div>
    {showIosHelp&&<div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-900">
      <div className="flex gap-2"><Share2 className="mt-0.5 h-4 w-4 shrink-0"/><div><strong>iPhone / iPad:</strong><br/>Safari’de <b>Paylaş</b> simgesine dokunun → <b>Ana Ekrana Ekle</b> → <b>Ekle</b>.</div></div>
    </div>}
  </div>;
}
