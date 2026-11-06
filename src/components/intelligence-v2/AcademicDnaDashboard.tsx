import React from "react";
import {Brain,Dna,Search,Sparkles,Target,Users,X} from "lucide-react";
import type {AcademicDna2Cohort,AcademicDna2Dimension,AcademicDna2Result} from "../../intelligence-v2";

const tone=(status:AcademicDna2Dimension["status"])=>
  status==="signature"?"bg-violet-600":
  status==="strong"?"bg-emerald-500":
  status==="developing"?"bg-amber-500":"bg-rose-500";

const statusLabel:Record<AcademicDna2Dimension["status"],string>={
  signature:"İmza Gücü",
  strong:"Güçlü",
  developing:"Gelişiyor",
  priority:"Öncelikli",
};

const normalize=(value:unknown)=>String(value||"").toLocaleLowerCase("tr-TR").trim();

function ProfileCard({profile,onOpen}:{profile:AcademicDna2Result;onOpen:()=>void}){
  return <button type="button" onClick={onOpen} className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">{profile.archetype}</span>
        <h3 className="mt-1 truncate text-sm font-black text-slate-900">{profile.student.name}</h3>
        <p className="mt-1 text-[10px] text-slate-400">{profile.student.classroom||"Sınıf yok"} · Güven %{profile.confidence}</p>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-xl font-black text-violet-700">{Math.round(profile.overallScore)}</div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      {profile.dimensions.slice().sort((a,b)=>a.score-b.score).slice(0,4).map(item=><div key={item.key} className="rounded-2xl bg-slate-50 p-3">
        <div className="flex justify-between gap-2 text-[9px]"><strong className="truncate text-slate-700">{item.label}</strong><span>{Math.round(item.score)}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${tone(item.status)}`} style={{width:`${Math.max(0,Math.min(100,item.score))}%`}}/></div>
      </div>)}
    </div>
    <span className="mt-4 block text-[9px] font-black text-violet-700">12 BOYUTLU PROFİLİ AÇ</span>
  </button>;
}

function ProfileDetail({profile,onClose}:{profile:AcademicDna2Result;onClose:()=>void}){
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[32px] bg-slate-50 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[32px] bg-gradient-to-r from-violet-950 via-indigo-800 to-emerald-700 p-6 text-white">
        <div><span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">{profile.archetype}</span><h2 className="mt-1 text-2xl font-black">{profile.student.name}</h2><p className="mt-2 text-xs text-white/75">{profile.student.classroom||"Sınıf yok"} · Akademik DNA {profile.overallScore}/100 · Güven %{profile.confidence}</p></div>
        <button type="button" onClick={onClose} className="rounded-2xl bg-white/15 p-3 hover:bg-white/25" aria-label="Kapat"><X className="h-5 w-5"/></button>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"><span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">İmza Güçleri</span><p className="mt-2 text-sm font-bold leading-6 text-emerald-950">{profile.signatureStrengths.join(" · ")||"Henüz belirgin bir imza gücü oluşmadı."}</p></div>
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5"><span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Gelişim Öncelikleri</span><p className="mt-2 text-sm font-bold leading-6 text-amber-950">{profile.developmentPriorities.join(" · ")||"Düzenli izleme önerilir."}</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{profile.dimensions.map(item=><div key={item.key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{item.label}</strong><span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-slate-400">{statusLabel[item.status]} · Güven %{item.confidence}</span></div><span className="text-xl font-black text-slate-900">{Math.round(item.score)}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone(item.status)}`} style={{width:`${Math.max(0,Math.min(100,item.score))}%`}}/></div>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">{item.evidence.join(" · ")}</p>
          <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-[10px] font-semibold leading-5 text-slate-700">{item.recommendation}</p>
        </div>)}</div>
        <p className="rounded-2xl bg-slate-100 p-4 text-[9px] leading-5 text-slate-500">{profile.disclaimer}</p>
      </div>
    </div>
  </div>;
}

export function AcademicDnaDashboard({data}:{data:AcademicDna2Cohort}){
  const [query,setQuery]=React.useState("");
  const [classroom,setClassroom]=React.useState("all");
  const [selected,setSelected]=React.useState<AcademicDna2Result|null>(null);
  const priority=data.dimensionSummary.slice(0,4);
  const classrooms=React.useMemo(()=>[...new Set(data.profiles.map(item=>item.student.classroom).filter(Boolean) as string[])].sort((a,b)=>a.localeCompare(b,"tr")),[data.profiles]);
  const visibleProfiles=React.useMemo(()=>data.profiles.filter(profile=>{
    const matchesClass=classroom==="all"||profile.student.classroom===classroom;
    const haystack=normalize(`${profile.student.name} ${profile.student.number||""} ${profile.student.classroom||""}`);
    return matchesClass&&(!normalize(query)||haystack.includes(normalize(query)));
  }),[data.profiles,classroom,query]);

  if(!data.totalStudents)return <section className="rounded-[30px] border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center"><Dna className="mx-auto h-10 w-10 text-violet-400"/><h2 className="mt-4 text-lg font-black text-slate-900">Akademik DNA için öğrenci verisi bekleniyor</h2><p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-slate-500">Önce bir sınav seçin ve sonuçların öğrenci raporlarına işlendiğinden emin olun. Veri geldiğinde 12 boyutlu akademik profil otomatik üretilecektir.</p></section>;

  return <section className="space-y-4">
    <div className="rounded-3xl bg-gradient-to-r from-violet-950 via-indigo-800 to-emerald-700 p-5 text-white shadow-lg"><div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Dna className="h-6 w-6"/></div><div><span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">e-Nstitü AKADEMİK DNA 2.0</span><h2 className="mt-1 text-xl font-black">Yaşayan Akademik Öğrenme Profili</h2><p className="mt-2 text-xs text-white/80">{data.totalStudents} öğrenci · Ortalama DNA {data.averageScore} · Veri güveni %{data.averageConfidence}</p></div></div></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["DNA Ortalaması",data.averageScore,Dna],["Veri Güveni",`%${data.averageConfidence}`,Brain],["Baskın Profil",data.archetypes[0]?.name||"—",Sparkles],["Öncelikli Boyut",priority[0]?.label||"—",Target]].map(([itemLabel,value,Icon]:any)=><div key={itemLabel} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-violet-700"/><span className="mt-3 block text-[10px] font-bold text-slate-400">{itemLabel}</span><strong className="mt-1 block text-lg font-black text-slate-900">{value}</strong></div>)}</div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Okulun DNA Öncelikleri</h3><div className="mt-4 space-y-4">{data.dimensionSummary.map(item=><div key={item.key}><div className="flex justify-between gap-3 text-xs"><strong>{item.label}</strong><span>{item.average}/100</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.average<48?"bg-rose-500":item.average<68?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.max(0,Math.min(100,item.average))}%`}}/></div><div className="mt-1 text-[9px] text-slate-400">{item.priorityCount} öncelikli · {item.strongCount} güçlü öğrenci</div></div>)}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Akademik Profil Dağılımı</h3><div className="mt-4 space-y-3">{data.archetypes.map(item=><div key={item.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-xs font-black text-violet-700">{item.count}</div><div className="flex-1"><strong className="text-xs text-slate-900">{item.name}</strong><div className="mt-2 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-600" style={{width:`${item.ratio}%`}}/></div></div><span className="text-[10px] font-bold text-slate-500">%{item.ratio}</span></div>)}</div></div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Öğrenci adı, numarası veya sınıfı ara" className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-3 text-xs outline-none focus:border-violet-400"/></label><select value={classroom} onChange={event=>setClassroom(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"><option value="all">Tüm sınıflar</option>{classrooms.map(item=><option key={item} value={item}>{item}</option>)}</select></div></div>

    <div><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-violet-700"/><h3 className="text-sm font-black text-slate-900">Öğrenci Akademik DNA Profilleri</h3></div><span className="text-[10px] font-bold text-slate-400">{visibleProfiles.length} profil</span></div>{visibleProfiles.length?<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{visibleProfiles.map((profile,index)=><ProfileCard key={`${profile.student.id}-${profile.student.number||index}`} profile={profile} onOpen={()=>setSelected(profile)}/>)}</div>:<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-semibold text-slate-500">Arama ölçütlerine uygun öğrenci bulunamadı.</div>}</div>
    {selected&&<ProfileDetail profile={selected} onClose={()=>setSelected(null)}/>} 
  </section>;
}
