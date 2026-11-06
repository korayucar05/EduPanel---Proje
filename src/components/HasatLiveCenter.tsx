import React from "react";
import {
  Activity, AlertTriangle, BellRing, BookOpenCheck, CheckCircle2, Clock3,
  Copy, Download, FileText, HeartHandshake, RefreshCw, School, Send,
  Sparkles, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import localforage from "../core/state/AppStateService";
import {
  buildHasatLiveSnapshot, hasatLiveEventBus, publishHasatLiveEvent,
  type LiveEventLevel, type LiveEventSource,
} from "../intelligence-v3";

const REPORT_QUEUE_KEY="exam_whatsapp_report_queue";
type Audience="admin"|"teacher"|"student"|"parent";
type QueuedReport={id:string;title:string;examName?:string;filename:string;createdAt:string;audiences?:Audience[];blob?:Blob;status?:string};

const audienceLabel:Record<Audience,string>={admin:"Yönetici",teacher:"Öğretmen",student:"Öğrenci",parent:"Veli"};
const statusLabel=(status?:string)=>status==="sent"?"Gönderildi":status==="partial"?"Kısmen gönderildi":status==="failed"?"Başarısız":"Hazır";

export default function HasatLiveCenter({students,teachers,classrooms}:{students:any[];teachers:any[];classrooms:any[]}){
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());
  const [title,setTitle]=React.useState("");
  const [detail,setDetail]=React.useState("");
  const [source,setSource]=React.useState<LiveEventSource>("system");
  const [level,setLevel]=React.useState<LiveEventLevel>("info");
  const [reports,setReports]=React.useState<QueuedReport[]>([]);
  const [reportLoading,setReportLoading]=React.useState(false);
  const [audience,setAudience]=React.useState<"all"|Audience>("all");
  const [notice,setNotice]=React.useState("");

  const loadReports=React.useCallback(async()=>{
    setReportLoading(true);
    try{
      const rows=(await localforage.getItem<QueuedReport[]>(REPORT_QUEUE_KEY))||[];
      setReports(Array.isArray(rows)?rows:[]);
    }finally{setReportLoading(false);}
  },[]);

  React.useEffect(()=>{
    loadReports();
    const unsubscribe=hasatLiveEventBus.subscribe(()=>setEvents(hasatLiveEventBus.snapshot()));
    const cleared=()=>setEvents([]);
    const refresh=()=>loadReports();
    window.addEventListener("hasat-live-cleared",cleared);
    window.addEventListener("hasat-report-queue-updated",refresh);
    return()=>{unsubscribe();window.removeEventListener("hasat-live-cleared",cleared);window.removeEventListener("hasat-report-queue-updated",refresh);};
  },[loadReports]);

  const snapshot=React.useMemo(()=>buildHasatLiveSnapshot({events,studentCount:students.length,teacherCount:teachers.length,classroomCount:classrooms.length}),[events,students.length,teachers.length,classrooms.length]);
  const filteredReports=React.useMemo(()=>reports.filter(item=>audience==="all"||(item.audiences||[]).includes(audience)).slice(0,12),[reports,audience]);
  const reportStats=React.useMemo(()=>({
    total:reports.length,
    ready:reports.filter(item=>!item.status||item.status==="ready"||item.status==="queued").length,
    sent:reports.filter(item=>item.status==="sent").length,
    attention:reports.filter(item=>item.status==="failed"||item.status==="partial").length,
  }),[reports]);

  const submit=()=>{if(!title.trim()||!detail.trim())return;publishHasatLiveEvent({source,level,title:title.trim(),detail:detail.trim()});setTitle("");setDetail("");};
  const metricIcon=(key:string)=>key==="attendance"?Clock3:key==="homework"?BookOpenCheck:key==="guidance"?HeartHandshake:key==="parent"?Users:Activity;
  const downloadReport=(report:QueuedReport)=>{
    if(!(report.blob instanceof Blob)){setNotice("Bu raporun PDF dosyası kuyrukta bulunamadı.");return;}
    const url=URL.createObjectURL(report.blob);const link=document.createElement("a");link.href=url;link.download=report.filename||`${report.title}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const copyShareText=async(report:QueuedReport)=>{
    const text=`${report.examName?report.examName+" - ":""}${report.title}\nHASAT tarafından hazırlanan rapor paylaşım için hazırdır.`;
    try{await navigator.clipboard.writeText(text);setNotice("Paylaşım metni panoya kopyalandı.");}catch{setNotice("Metin kopyalanamadı.");}
  };

  return <div className="min-h-full bg-slate-50 p-4 md:p-6"><section className="mx-auto max-w-[1600px] space-y-4">
    <div className="overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-900 p-6 text-white shadow-xl">
      <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü LIVE 2.0</span>
      <h1 className="mt-2 text-3xl font-black">Canlı Akademik ve Rapor İşletim Merkezi</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">{snapshot.briefing.detail} Rapor üretim ve paylaşım kuyruğu da bu merkezden izlenir.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{snapshot.pulse.map(item=>{const Icon=metricIcon(item.key);return <div key={item.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-indigo-600"/><span className={`flex items-center gap-1 text-[10px] font-black ${item.change>0?"text-emerald-600":item.change<0?"text-rose-600":"text-slate-400"}`}>{item.change>0?<TrendingUp className="h-3.5 w-3.5"/>:item.change<0?<TrendingDown className="h-3.5 w-3.5"/>:null}{item.change>0?"+":""}{item.change}</span></div><span className="mt-4 block text-[10px] font-bold text-slate-400">{item.label}</span><strong className="mt-1 block text-3xl font-black text-slate-900">{item.value}</strong></div>})}</div>

    <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-indigo-700"/><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-indigo-600">Canlı Rapor ve Paylaşım Merkezi</span><h2 className="mt-1 text-lg font-black text-slate-900">Üretilen raporları izle, indir ve paylaşıma hazırla</h2></div></div><button type="button" onClick={loadReports} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"><RefreshCw className={`h-4 w-4 ${reportLoading?"animate-spin":""}`}/>Yenile</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{[["Toplam rapor",reportStats.total,FileText],["Gönderime hazır",reportStats.ready,Send],["Gönderildi",reportStats.sent,CheckCircle2],["İncelenmeli",reportStats.attention,AlertTriangle]].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl bg-slate-50 p-4"><Icon className="h-4 w-4 text-indigo-600"/><span className="mt-2 block text-[9px] text-slate-400">{label}</span><strong className="mt-1 block text-2xl text-slate-900">{value}</strong></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">{(["all","admin","teacher","student","parent"] as const).map(item=><button key={item} type="button" onClick={()=>setAudience(item)} className={`rounded-full px-3 py-2 text-[10px] font-black ${audience===item?"bg-indigo-700 text-white":"bg-slate-100 text-slate-600"}`}>{item==="all"?"Tümü":audienceLabel[item]}</button>)}</div>
      {notice&&<div className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">{notice}</div>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{filteredReports.length?filteredReports.map(report=><div key={report.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{report.title}</strong><p className="mt-1 text-[10px] text-slate-500">{report.examName||"Sınav bilgisi yok"} · {report.createdAt?new Date(report.createdAt).toLocaleString("tr-TR"):"Tarih yok"}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${report.status==="sent"?"bg-emerald-100 text-emerald-700":report.status==="failed"||report.status==="partial"?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>{statusLabel(report.status)}</span></div><div className="mt-3 flex flex-wrap gap-1">{(report.audiences||[]).map(item=><span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{audienceLabel[item]}</span>)}</div><div className="mt-4 flex gap-2"><button type="button" onClick={()=>downloadReport(report)} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-700 text-[10px] font-black text-white"><Download className="h-3.5 w-3.5"/>PDF indir</button><button type="button" onClick={()=>copyShareText(report)} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-[10px] font-black text-slate-700"><Copy className="h-3.5 w-3.5"/>Metni kopyala</button></div></div>):<div className="lg:col-span-2 rounded-2xl bg-slate-50 p-8 text-center text-xs text-slate-400">Bu hedef kitle için hazırlanmış rapor bulunmuyor.</div>}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-rose-700"/><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-rose-600">Canlı Brifing</span><h2 className="mt-1 text-lg font-black text-slate-900">{snapshot.briefing.headline}</h2></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4">{[["Okul Sağlık",snapshot.schoolHealthScore,School],["Kritik",snapshot.criticalEventCount,AlertTriangle],["Uyarı",snapshot.warningEventCount,BellRing],["Olumlu",snapshot.positiveEventCount,Sparkles]].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl bg-slate-50 p-4"><Icon className="h-4 w-4 text-indigo-600"/><span className="mt-2 block text-[9px] text-slate-400">{label}</span><strong className="mt-1 block text-xl text-slate-900">{value}</strong></div>)}</div><div className="mt-5 space-y-3">{snapshot.recentEvents.length?snapshot.recentEvents.map(event=><div key={event.id} className={`rounded-2xl border p-4 ${event.level==="critical"?"border-rose-200 bg-rose-50":event.level==="warning"?"border-amber-200 bg-amber-50":event.level==="positive"?"border-emerald-200 bg-emerald-50":"border-blue-200 bg-blue-50"}`}><div className="flex items-start justify-between gap-3"><strong className="text-xs text-slate-900">{event.title}</strong><span className="text-[9px] text-slate-400">{new Date(event.occurredAt).toLocaleString("tr-TR")}</span></div><p className="mt-2 text-[10px] leading-5 text-slate-600">{event.detail}</p></div>):<div className="rounded-2xl bg-slate-50 p-8 text-center text-xs text-slate-400">Henüz canlı olay kaydı yok.</div>}</div></div>
      <div className="space-y-4"><div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Canlı Olay Ekle</span><h2 className="mt-1 text-sm font-black text-slate-900">Okul olayını sisteme işle</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={source} onChange={e=>setSource(e.target.value as LiveEventSource)} className="h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold"><option value="system">Sistem</option><option value="exam">Sınav</option><option value="attendance">Devamsızlık</option><option value="homework">Ödev</option><option value="behavior">Davranış</option><option value="guidance">Rehberlik</option><option value="intervention">Müdahale</option><option value="parent">Veli</option></select><select value={level} onChange={e=>setLevel(e.target.value as LiveEventLevel)} className="h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold"><option value="info">Bilgi</option><option value="positive">Olumlu</option><option value="warning">Uyarı</option><option value="critical">Kritik</option></select></div><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Kısa başlık" className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold"/><textarea value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Olayın açıklaması" className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-xs"/><button type="button" onClick={submit} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 text-xs font-black text-white hover:bg-indigo-800"><Sparkles className="h-4 w-4"/>Canlı olayı işle</button></div><div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-slate-900">Bugünkü Görevler</h2></div><div className="mt-4 divide-y divide-slate-100">{snapshot.actions.length?snapshot.actions.map(item=><div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><strong className="text-xs text-slate-900">{item.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">P{item.priority}</span></div><p className="mt-2 text-[10px] leading-5 text-slate-500">{item.detail}</p><span className="mt-2 block text-[9px] font-bold text-indigo-600">{item.dueDays} gün içinde</span></div>):<p className="py-6 text-center text-xs text-slate-400">Acil görev bulunmuyor.</p>}</div></div></div></div>
  </section></div>;
}
