import React from "react";
import { Activity, BookOpenCheck, BrainCircuit, ChevronRight, FileText, GraduationCap, Home, Loader2, MessageCircle, Share2, Sparkles, Target, TrendingUp, UserRoundCheck } from "lucide-react";
import type { StudentReportV2Data } from "../reports-v2/types";
import { fetchIndependentLiveReport } from "../reports-v2/live/independentLiveReportApi";
import { InstallPwaPrompt } from "./InstallPwaPrompt";

const pct=(value:any)=>Number.isFinite(Number(value))?Math.round(Number(value)):0;
const fmt=(value:any)=>Number.isFinite(Number(value))?Number(value).toFixed(2):"-";

function FamilyCard({icon,title,subtitle,children,onClick}:{icon:React.ReactNode;title:string;subtitle?:string;children?:React.ReactNode;onClick?:()=>void}){
  return <button onClick={onClick} className="w-full rounded-3xl border border-white/80 bg-white p-5 text-left shadow-[0_12px_35px_rgba(15,42,72,.08)] transition active:scale-[.99]">
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 text-white">{icon}</div>
      <div className="min-w-0 flex-1">
        <strong className="block text-[15px] font-black text-slate-900">{title}</strong>
        {subtitle&&<span className="mt-1 block text-[11px] leading-5 text-slate-500">{subtitle}</span>}
        {children}
      </div>
      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300"/>
    </div>
  </button>;
}

export default function HasatFamilyView(){
  const token=new URLSearchParams(window.location.search).get("token")||"";
  const [report,setReport]=React.useState<StudentReportV2Data|null>(null);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState("");
  const [section,setSection]=React.useState<string|null>(null);

  React.useEffect(()=>{
    let active=true;
    fetchIndependentLiveReport(token)
      .then(value=>{if(active)setReport(value);})
      .catch(reason=>{if(active)setError(reason?.message||"Rapor açılamadı.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token]);

  const share=async()=>{
    const title=report?`${report.student.name} · e-Nstitü AİLE`:"e-Nstitü AİLE";
    const text=report?`${report.student.name} için güncel akademik dosya hazır.`:"e-Nstitü AİLE bağlantısı";
    if(navigator.share){await navigator.share({title,text,url:window.location.href});return;}
    await navigator.clipboard.writeText(window.location.href);
    window.alert("Bağlantı kopyalandı.");
  };

  if(loading)return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="h-10 w-10 animate-spin text-emerald-600"/></div>;
  if(!report)return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><h1 className="text-xl font-black">Akademik dosya açılamadı</h1><p className="mt-3 text-sm text-slate-500">{error||"Bağlantı geçersiz veya süresi dolmuş olabilir."}</p></div></div>;

  const subjects=[...(report.subjects||[])].sort((a:any,b:any)=>(b.successRate||0)-(a.successRate||0));
  const strongest=subjects[0];
  const weakest=subjects[subjects.length-1];
  const dna=report.academicDna;
  const target=report.targetAnalysis;
  const ai=report.aiEvaluation;
  const teacher=report.teacherEvaluation;

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_28%),linear-gradient(180deg,#eef8f3_0%,#f4f7fb_45%,#eef2f7_100%)] pb-28 text-slate-900">
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/85 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-3"><img src="/enstitu-aile.png" alt="e-Nstitü AİLE" className="h-11 w-11 rounded-2xl object-cover shadow-sm"/><div><strong className="block text-[17px] font-black">e-Nstitü AİLE</strong><span className="text-[10px] font-semibold text-slate-400">Canlı Akademik Dosya</span></div></div>
        <button onClick={share} className="rounded-2xl bg-slate-900 p-3 text-white"><Share2 className="h-5 w-5"/></button>
      </div>
    </header>

    <main className="mx-auto max-w-md space-y-4 px-4 py-5">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#082f58] via-blue-700 to-emerald-600 p-6 text-white shadow-2xl">
        <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/65">{report.schoolName}</span>
        <h1 className="mt-3 text-[26px] font-black leading-tight">{report.student.name}</h1>
        <p className="mt-1 text-[12px] font-semibold text-white/70">{report.student.classroom||""} {report.student.branch?`· ${report.student.branch}`:""}</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[["Net",fmt(report.totals?.net)],["Başarı",`%${pct(report.totals?.successRate)}`],["Puan",fmt(report.totals?.score)]].map(([label,value])=><div key={label} className="rounded-2xl bg-white/12 px-3 py-4 text-center backdrop-blur"><span className="block text-[9px] font-black uppercase text-white/60">{label}</span><strong className="mt-2 block text-[19px] font-black">{value}</strong></div>)}
        </div>
        <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3"><span className="text-[10px] text-white/60">Son sınav</span><strong className="mt-1 block text-[12px]">{report.examName}</strong></div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg"><TrendingUp className="h-7 w-7 text-emerald-600"/><span className="mt-4 block text-[10px] font-black uppercase text-slate-400">Güçlü Ders</span><strong className="mt-2 block text-sm text-slate-900">{strongest?.subjectName||"-"}</strong><span className="mt-1 block text-xs font-black text-emerald-600">%{pct(strongest?.successRate)}</span></div>
        <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-lg"><Activity className="h-7 w-7 text-amber-600"/><span className="mt-4 block text-[10px] font-black uppercase text-slate-400">Öncelikli Alan</span><strong className="mt-2 block text-sm text-slate-900">{weakest?.subjectName||"-"}</strong><span className="mt-1 block text-xs font-black text-amber-600">%{pct(weakest?.successRate)}</span></div>
      </section>

      <FamilyCard icon={<FileText className="h-6 w-6"/>} title="Son Sınav Sonuçları" subtitle="Ders bazlı doğru, yanlış, boş ve net değerleri" onClick={()=>setSection(section==="exam"?null:"exam")}>{section==="exam"&&<div className="mt-4 space-y-2">{subjects.map((s:any)=><div key={s.subjectName} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[11px]"><strong>{s.subjectName}</strong><span>{fmt(s.net)} net · %{pct(s.successRate)}</span></div>)}</div>}</FamilyCard>

      <FamilyCard icon={<BrainCircuit className="h-6 w-6"/>} title="Akademik DNA" subtitle={dna?`Genel profil skoru ${fmt(dna.overallScore)} · veri güveni ${fmt(dna.overallConfidence)}/5`:"Akademik profil henüz oluşmadı"} onClick={()=>setSection(section==="dna"?null:"dna")}>{section==="dna"&&dna&&<div className="mt-4 space-y-3">{dna.dimensions?.map((d:any)=><div key={d.key}><div className="mb-1 flex justify-between text-[10px] font-bold"><span>{d.label}</span><span>{pct(d.score)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{width:`${pct(d.score)}%`}}/></div></div>)}</div>}</FamilyCard>

      <FamilyCard icon={<Target className="h-6 w-6"/>} title="Hedef Üniversite" subtitle={target?.isDefined?[target.definition?.university,target.definition?.program].filter(Boolean).join(" · "):"Henüz hedef tanımlanmadı"} onClick={()=>setSection(section==="target"?null:"target")}>{section==="target"&&target&&<div className="mt-4 grid grid-cols-3 gap-2">{[["Mevcut",fmt(target.currentNet)],["Hedef",fmt(target.definition?.targetNet)],["Kalan",fmt(target.netGap)]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-3 text-center"><span className="block text-[9px] text-slate-400">{a}</span><strong className="mt-1 block text-sm">{b}</strong></div>)}</div>}</FamilyCard>

      <FamilyCard icon={<Sparkles className="h-6 w-6"/>} title="e-Nstitü AI Değerlendirmesi" subtitle={ai?.studentMessage||"Kişisel değerlendirme hazırlanıyor"} onClick={()=>setSection(section==="ai"?null:"ai")}>{section==="ai"&&ai&&<div className="mt-4 rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50 p-4 text-[11px] leading-6 text-slate-700">{ai.parentMessage||ai.studentMessage}</div>}</FamilyCard>

      <FamilyCard icon={<UserRoundCheck className="h-6 w-6"/>} title="Öğretmen Notları" subtitle={teacher?.observation||"Henüz öğretmen değerlendirmesi girilmedi"} onClick={()=>setSection(section==="teacher"?null:"teacher")}>{section==="teacher"&&teacher&&<div className="mt-4 space-y-3 text-[11px] leading-5"><div className="rounded-xl bg-violet-50 p-3"><strong>Gözlem</strong><p className="mt-1 text-slate-600">{teacher.observation||"-"}</p></div><div className="rounded-xl bg-emerald-50 p-3"><strong>Öneri</strong><p className="mt-1 text-slate-600">{teacher.recommendation||"-"}</p></div></div>}</FamilyCard>

      <FamilyCard icon={<BookOpenCheck className="h-6 w-6"/>} title="Çalışma Planı" subtitle="Bu hafta uygulanacak kişisel görevler" onClick={()=>setSection(section==="plan"?null:"plan")}>{section==="plan"&&<div className="mt-4 space-y-2">{report.premium?.weeklyPlan?.slice(0,5).map((p:any)=><div key={p.day} className="rounded-xl bg-slate-50 p-3"><strong className="text-[11px]">{p.day}</strong><p className="mt-1 text-[10px] leading-5 text-slate-500">{p.tasks?.join(" · ")}</p></div>)}</div>}</FamilyCard>
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/70 bg-white/90 px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl print:hidden"><div className="mx-auto grid max-w-md grid-cols-4"><button className="flex flex-col items-center gap-1 p-2 text-emerald-700"><Home className="h-5 w-5"/><span className="text-[9px] font-black">Ana Sayfa</span></button><button className="flex flex-col items-center gap-1 p-2 text-slate-400"><TrendingUp className="h-5 w-5"/><span className="text-[9px] font-bold">Gelişim</span></button><button className="flex flex-col items-center gap-1 p-2 text-slate-400"><GraduationCap className="h-5 w-5"/><span className="text-[9px] font-bold">Hedef</span></button><button onClick={share} className="flex flex-col items-center gap-1 p-2 text-slate-400"><MessageCircle className="h-5 w-5"/><span className="text-[9px] font-bold">Paylaş</span></button></div></nav>
    <InstallPwaPrompt/>
  </div>;
}
