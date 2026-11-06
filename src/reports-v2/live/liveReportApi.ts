import type { StudentReportV2Data } from "../types";
import {
  buildLiveReportUrl,
  publishLiveReport,
  revokeLiveReport,
} from "./liveReportStorage";

export type LiveReportPublishResult={
  mode:"server"|"local";
  token:string;
  url:string;
  createdAt:string;
  expiresAt:string;
};

const baseUrl=()=>"/api";

const publicBaseUrl=()=>String(
  import.meta.env.VITE_HASAT_PUBLIC_APP_URL||window.location.origin
).trim().replace(/\/+$/,"");

export function isServerLiveReportConfigured(){
  return Boolean(baseUrl());
}

export async function publishLiveReportSecure(
  report:StudentReportV2Data,
  validDays=30,
):Promise<LiveReportPublishResult>{
  const api=baseUrl();

  if(!api){
    const local=publishLiveReport(report,validDays);
    return{
      mode:"local",
      token:local.token,
      url:buildLiveReportUrl(local.token),
      createdAt:local.createdAt,
      expiresAt:local.expiresAt,
    };
  }

  const response=await fetch(`${api}/live-reports`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      report,
      validDays,
      reportCode:report.reportCode,
      publicAppUrl:publicBaseUrl(),
    }),
  });

  if(!response.ok){
    const message=await response.text().catch(()=>"");
    throw new Error(message||`Canlı rapor yayımlanamadı (${response.status}).`);
  }

  const payload=await response.json();
  if(!payload?.token||!payload?.expiresAt){
    throw new Error("Canlı rapor sunucusu geçersiz yanıt verdi.");
  }

  // Sunucunun varsayılan localhost adresine bağımlı kalma. Canlı aile bağlantısını
  // her zaman frontend'in güncel genel HTTPS adresiyle üret.
  const url=`${publicBaseUrl()}/?mode=family-report&token=${encodeURIComponent(payload.token)}`;
  return{
    mode:"server",
    token:String(payload.token),
    url:String(url),
    createdAt:String(payload.createdAt||new Date().toISOString()),
    expiresAt:String(payload.expiresAt),
  };
}

export async function revokeLiveReportSecure(result:LiveReportPublishResult){
  if(result.mode==="local"){
    revokeLiveReport(result.token);
    return;
  }

  const api=baseUrl();
  if(!api)throw new Error("Canlı rapor sunucu adresi yapılandırılmamış.");

  const response=await fetch(`${api}/live-reports/${encodeURIComponent(result.token)}`,{
    method:"DELETE",
  });
  if(!response.ok&&response.status!==404){
    throw new Error(`Canlı rapor kaldırılamadı (${response.status}).`);
  }
}

export async function fetchLiveReportSecure(token:string):Promise<StudentReportV2Data|null>{
  const api=baseUrl();
  if(!api)return null;

  const response=await fetch(`${api}/live-reports/${encodeURIComponent(token)}`,{
    method:"GET",
    headers:{"Accept":"application/json"},
  });

  if(response.status===404||response.status===410)return null;
  if(!response.ok)throw new Error(`Canlı rapor alınamadı (${response.status}).`);

  const payload=await response.json();
  return payload?.report||null;
}
