import React from "react";
import { FileX2, Loader2, RefreshCw, WifiOff } from "lucide-react";
import type { StudentReportV2Data } from "../types";
import { fetchIndependentLiveReport, fetchIndependentPermanentStudentProfile, resolveIndependentShortCode } from "./independentLiveReportApi";
import { FamilyApp as HasatFamilyApp } from "../../modules/family";
import PwaInstallCard from "../../components/pwa/PwaInstallCard";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export default function LiveStudentReportView(){
  const searchParams = new URLSearchParams(window.location.search);
  const queryToken=searchParams.get("token")||"";
  const audience=searchParams.get("audience")==="student"?"student":"parent";
  const appName=audience==="student"?"e-Nstitü Öğrenci":"e-Nstitü Aile";
  const shortCode=(window.location.pathname.match(/^\/r\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7})\/?$/i)?.[1]||"").toUpperCase();
  const permanentCode=(window.location.pathname.match(/^\/s\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8})\/?$/i)?.[1]||"").toUpperCase();
  const [resolvedShortToken,setResolvedShortToken]=React.useState("");
  const token=queryToken||resolvedShortToken||(!shortCode&&!permanentCode?sqliteStorage.getItem("hasat_family_last_token")||"":"");
  const [report,setReport]=React.useState<StudentReportV2Data|null>(null);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState("");
  const [retryKey,setRetryKey]=React.useState(0);
  const [online,setOnline]=React.useState(()=>navigator.onLine);

  React.useEffect(()=>{
    let active=true;
    if(!shortCode)return()=>{active=false;};
    void resolveIndependentShortCode(shortCode).then(value=>{if(active)setResolvedShortToken(value||"");});
    return()=>{active=false;};
  },[shortCode]);

  React.useEffect(()=>{
    if(queryToken)sqliteStorage.setItem("hasat_family_last_token",queryToken);
    if(resolvedShortToken)sqliteStorage.setItem("hasat_family_last_token",resolvedShortToken);
  },[queryToken,resolvedShortToken]);

  React.useEffect(()=>{
    const onOnline=()=>setOnline(true);
    const onOffline=()=>setOnline(false);
    window.addEventListener("online",onOnline);
    window.addEventListener("offline",onOffline);
    return()=>{
      window.removeEventListener("online",onOnline);
      window.removeEventListener("offline",onOffline);
    };
  },[]);

  React.useEffect(()=>{
    let active=true;
    setLoading(true);
    setError("");
    if(!token&&!permanentCode){
      if(shortCode)return;
      setLoading(false);
      setError("Bu cihazda kayıtlı e-Nstitü AİLE bağlantısı bulunamadı. WhatsApp'taki güncel bağlantıyı yeniden açın.");
      return()=>{active=false;};
    }
    const loader=permanentCode
      ?fetchIndependentPermanentStudentProfile(permanentCode)
      :fetchIndependentLiveReport(token);
    loader
      .then(value=>{if(active)setReport(value);})
      .catch(reason=>{if(active)setError(reason?.message||"Canlı akademik dosya açılamadı.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,shortCode,permanentCode,retryKey]);

  React.useEffect(()=>{
    document.title=report?`${report.student.name} · ${appName}`:appName;
    const currentStart = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    let manifest=document.querySelector('link[rel="manifest"]') as HTMLLinkElement|null;
    if(!manifest){manifest=document.createElement("link");manifest.rel="manifest";document.head.appendChild(manifest);}
    manifest.href=`/api/pwa/manifest?role=${audience}&start=${encodeURIComponent(currentStart)}&v=13`;

    let appleIcon=document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement|null;
    if(!appleIcon){appleIcon=document.createElement("link");appleIcon.rel="apple-touch-icon";document.head.appendChild(appleIcon);}
    appleIcon.href="/pwa/enstitu-icon-180.png?v=13";

    let favicon=document.querySelector('link[rel="icon"]') as HTMLLinkElement|null;
    if(!favicon){favicon=document.createElement("link");favicon.rel="icon";document.head.appendChild(favicon);}
    favicon.href="/pwa/enstitu-icon-64.png?v=13";

    let theme=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null;
    if(!theme){theme=document.createElement("meta");theme.name="theme-color";document.head.appendChild(theme);}
    theme.content="#0b4f4a";
    let robots=document.querySelector('meta[name="robots"]') as HTMLMetaElement|null;
    if(!robots){robots=document.createElement("meta");robots.name="robots";document.head.appendChild(robots);}
    robots.content="noindex,nofollow,noarchive";
  },[report,permanentCode,audience,appName]);

  if(loading)return <div className="flex min-h-screen items-center justify-center bg-[#eff5f8] p-6"><div className="rounded-3xl bg-white p-8 text-center shadow-xl"><Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600"/><p className="mt-4 text-sm font-black text-slate-600">{appName} hazırlanıyor...</p><p className="mt-2 text-[10px] text-slate-400">Öğrencinin canlı akademik dosyası güvenli biçimde yükleniyor.</p></div></div>;
  if(!report)return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">{online?<FileX2 className="mx-auto h-14 w-14 text-rose-500"/>:<WifiOff className="mx-auto h-14 w-14 text-amber-500"/>}<h1 className="mt-5 text-xl font-black">{online?"Akademik dosya açılamadı":"İnternet bağlantısı yok"}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{online?"Bağlantı geçersiz, erişim kaldırılmış veya süresi dolmuş olabilir.":"İnternet bağlantınızı kontrol edip yeniden deneyin."}</p>{error&&<p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button onClick={()=>setRetryKey(value=>value+1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white hover:bg-emerald-700"><RefreshCw className="h-4 w-4"/>Yeniden Dene</button></div></div>;
  return <>
    <div className="bg-[#eff5f8] px-3 pt-3">
      <div className="mx-auto max-w-3xl">
        <PwaInstallCard
          appName={appName}
          storageKey={audience === "student" ? "student" : "parent"}
          compact
        />
      </div>
    </div>
    <HasatFamilyApp report={report} token={token}/>
  </>;
}
