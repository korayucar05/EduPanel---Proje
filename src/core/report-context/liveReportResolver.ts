import type {ReportContext} from "./reportContext";

export type LiveReportPayload<TReport=any>={
  schemaVersion:"hasat-live-report-1";
  report:TReport;
  context:{
    examName:string;
    studentNumber:string;
    studentName:string;
    classroom:string;
    audience:string;
    createdAt:string;
  };
};


export type LiveReportPublicationStatus={
  readCount:number;
  firstReadAt?:string;
  lastReadAt?:string;
  revokedAt?:string;
  expired:boolean;
  createdAt?:string;
  expiresAt?:string;
};

export type LiveReportPublication={
  token:string;
  revokeSecret:string;
  url:string;
  qrDataUrl?:string;
  createdAt:string;
  expiresAt:string;
};

const apiBase=()=>{
  // Tarayıcı her zaman ana e-Nstitü origin'indeki /api yolunu kullanır.
  // Vite bu yolu yerel 8787 canlı rapor sunucusuna proxy eder.
  // Böylece ikinci Cloudflare tüneli, CORS ve değişen API URL problemi ortadan kalkar.
  return "/api";
};

const withTimeout=async(
  input:RequestInfo|URL,
  init:RequestInit={},
  timeoutMs=20000,
)=>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(input,{...init,signal:controller.signal});
  }catch(error:any){
    if(error?.name==="AbortError"){
      throw new Error("Canlı rapor sunucusu 20 saniye içinde yanıt vermedi.");
    }
    if(error instanceof TypeError&&/fetch/i.test(String(error?.message||""))){
      throw new Error(
        "e-Nstitü canlı rapor API'sine bağlanamadı. Programı npm run dev ile yeniden başlatın."
      );
    }
    throw error;
  }finally{
    window.clearTimeout(timer);
  }
};



const publicAppBase=()=>{
  const configured=String(import.meta.env.VITE_HASAT_PUBLIC_APP_URL||"").trim().replace(/\/+$/,"" );
  if(configured){
    try{
      const url=new URL(configured);
      const host=url.hostname.toLowerCase();
      const privateHost=host==="localhost"||host==="127.0.0.1"||host==="::1"||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith(".local");
      if(url.protocol==="https:"&&!privateHost)return configured;
    }catch{}
  }
  try{
    const current=new URL(window.location.origin);
    const host=current.hostname.toLowerCase();
    const privateHost=host==="localhost"||host==="127.0.0.1"||host==="::1"||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith(".local");
    if(current.protocol==="https:"&&!privateHost)return current.origin;
  }catch{}
  return configured||window.location.origin.replace(/\/+$/,"" );
};

const normalizePublicationUrl=(value:unknown)=>{
  const raw=String(value||"").trim();
  if(!raw)return"";
  try{return new URL(raw,window.location.origin).toString();}
  catch{return raw;}
};

const readError=async(response:Response)=>{
  try{
    const body=await response.json();
    return body?.error||body?.message||`Sunucu hatası (${response.status}).`;
  }catch{
    return`Sunucu hatası (${response.status}).`;
  }
};

export function createLiveReportPayload<TReport>(
  context:ReportContext,
  report:TReport,
):LiveReportPayload<TReport>{
  return{
    schemaVersion:"hasat-live-report-1",
    report,
    context:{
      examName:context.examName,
      studentNumber:context.studentNumber,
      studentName:context.studentName,
      classroom:context.classroom,
      audience:context.audience,
      createdAt:context.createdAt,
    },
  };
}

export async function publishLiveReportFromContext<TReport>(
  context:ReportContext,
  report:TReport,
  validDays=30,
):Promise<LiveReportPublication>{
  const payload=createLiveReportPayload(context,report);
  const response=await withTimeout(`${apiBase()}/live-reports`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      report:payload.report,
      context:payload.context,
      schemaVersion:payload.schemaVersion,
      validDays,
      publicAppUrl:String(import.meta.env.VITE_HASAT_PUBLIC_APP_URL||window.location.origin).trim().replace(/\/+$/,""),
    }),
  });

  if(!response.ok)throw new Error(await readError(response));
  const publication=await response.json();

  if(!publication?.token||!publication?.url||!publication?.revokeSecret){
    throw new Error("Canlı rapor sunucusu eksik yanıt verdi.");
  }

  // Sunucu yanlışlıkla localhost URL döndürse bile WhatsApp'a gönderilecek bağlantı
  // her zaman güncel genel e-Nstitü HTTPS origin'i ile yeniden kurulur.
  const audience = context.audience === "student" ? "student" : "parent";
  const publicUrl=`${publicAppBase()}/?mode=family-report&audience=${audience}&token=${encodeURIComponent(String(publication.token))}`;
  return{
    ...publication,
    url:normalizePublicationUrl(publicUrl),
  } as LiveReportPublication;
}

export async function fetchLiveReportByToken<TReport=any>(
  token:string,
):Promise<{report:TReport;expiresAt?:string;context?:any}|null>{
  if(!token)return null;

  const response=await withTimeout(
    `${apiBase()}/live-reports/${encodeURIComponent(token)}`,
    {headers:{"Accept":"application/json"}},
  );

  if(response.status===404||response.status===410)return null;
  if(!response.ok)throw new Error(await readError(response));

  const payload=await response.json();
  return{
    report:payload?.report,
    expiresAt:payload?.expiresAt,
    context:payload?.context,
  };
}

export async function revokeLiveReportPublication(
  publication:LiveReportPublication,
):Promise<void>{
  const response=await withTimeout(
    `${apiBase()}/live-reports/${encodeURIComponent(publication.token)}`,
    {
      method:"DELETE",
      headers:{
        "Content-Type":"application/json",
        "X-e-Nstitü-Revoke-Secret":publication.revokeSecret,
      },
    },
  );

  if(response.status===404)return;
  if(!response.ok)throw new Error(await readError(response));
}

export async function fetchLiveReportPublicationStatus(
  publication:LiveReportPublication,
):Promise<LiveReportPublicationStatus>{
  const response=await withTimeout(
    `${apiBase()}/live-reports/${encodeURIComponent(publication.token)}/status`,
    {
      headers:{
        "Accept":"application/json",
        "X-e-Nstitü-Revoke-Secret":publication.revokeSecret,
      },
    },
  );
  if(!response.ok)throw new Error(await readError(response));
  return await response.json() as LiveReportPublicationStatus;
}

