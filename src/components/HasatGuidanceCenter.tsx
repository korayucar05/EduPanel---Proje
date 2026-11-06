import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, HeartHandshake, Search, ShieldAlert, Users, PhoneCall } from "lucide-react";

type Props={students:any[];onNavigate?:(tab:string)=>void};
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const text=(...v:any[])=>v.find(x=>typeof x==="string"&&x.trim())?.trim()||"";

function buildRisk(student:any){
  const gpa=num(student.gpa??student.oob??student.average??student.gradeAverage);
  const absence=num(student.absenceDays??student.totalAbsence??student.devamsizlik??student.absence);
  const behavior=num(student.behaviorCount??student.negativeBehaviorCount??student.disciplineCount);
  const parentContact=Boolean(student.parentContacted??student.parentInterviewDate??student.lastParentContact);
  let score=0; const reasons:string[]=[];
  if(gpa>0&&gpa<50){score+=35;reasons.push("Akademik başarı kritik eşikte");}
  else if(gpa>0&&gpa<65){score+=20;reasons.push("Akademik destek ihtiyacı");}
  if(absence>=15){score+=35;reasons.push("Devamsızlık yüksek");}
  else if(absence>=8){score+=20;reasons.push("Devamsızlık izlenmeli");}
  if(behavior>=3){score+=25;reasons.push("Tekrarlayan davranış kaydı");}
  else if(behavior>0){score+=10;reasons.push("Davranış kaydı mevcut");}
  if(!parentContact&&score>=30){score+=10;reasons.push("Veli görüşmesi bekleniyor");}
  score=Math.min(100,score);
  const level=score>=70?"Kritik":score>=45?"Yüksek":score>=20?"Orta":"Düşük";
  return {score,level,reasons,gpa,absence,behavior,parentContact};
}

export default function HasatGuidanceCenter({students=[] ,onNavigate}:Props){
 const [query,setQuery]=useState(""); const [level,setLevel]=useState("Tümü");
 const rows=useMemo(()=>students.filter(Boolean).map(s=>({student:s,risk:buildRisk(s)})).sort((a,b)=>b.risk.score-a.risk.score),[students]);
 const filtered=rows.filter(({student,risk})=>{const hay=text(student.name,student.fullName,`${student.firstName||""} ${student.lastName||""}`); const cls=text(student.className,student.classroom,student.class); const no=text(student.number,student.studentNumber); const q=query.toLocaleLowerCase("tr-TR"); return (!q||`${hay} ${cls} ${no}`.toLocaleLowerCase("tr-TR").includes(q))&&(level==="Tümü"||risk.level===level)});
 const critical=rows.filter(x=>x.risk.level==="Kritik").length, high=rows.filter(x=>x.risk.level==="Yüksek").length, parent=rows.filter(x=>x.risk.score>=30&&!x.risk.parentContact).length;
 return <div className="min-h-full bg-slate-50 p-4 md:p-6 space-y-5">
  <section className="rounded-3xl bg-gradient-to-r from-rose-950 via-violet-950 to-indigo-950 p-6 text-white shadow-xl">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[11px] font-black uppercase tracking-[.2em] text-rose-200">e-Nstitü GUIDANCE 1.0</div><h1 className="mt-2 text-3xl font-black">Rehberlik Merkezi</h1><p className="mt-2 max-w-2xl text-sm text-white/75">Akademik, devamsızlık, davranış ve veli iletişimi sinyallerini tek öğrenci profili altında birleştirir.</p></div><HeartHandshake className="h-12 w-12 text-rose-200"/></div>
  </section>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
   ["Değerlendirilen",rows.length,Users],["Kritik",critical,ShieldAlert],["Yüksek Risk",high,AlertTriangle],["Veli Görüşmesi",parent,PhoneCall]
  ].map(([l,v,I]:any)=><div key={l} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><I className="h-5 w-5 text-violet-700"/><span className="mt-3 block text-xs font-bold text-slate-500">{l}</span><strong className="mt-1 block text-2xl font-black text-slate-900">{v}</strong></div>)}</section>
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-3"><label className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Öğrenci adı, numarası veya sınıfı" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-400"/></label><select value={level} onChange={e=>setLevel(e.target.value)} className="rounded-xl border border-slate-200 px-4 text-sm font-bold">{["Tümü","Kritik","Yüksek","Orta","Düşük"].map(x=><option key={x}>{x}</option>)}</select></div></section>
  <section className="grid gap-4 xl:grid-cols-2">{filtered.slice(0,30).map(({student,risk},i)=>{const name=text(student.name,student.fullName,`${student.firstName||""} ${student.lastName||""}`)||`Öğrenci ${i+1}`; const cls=text(student.className,student.classroom,student.class)||"Sınıf yok"; return <article key={student.id||student.number||i} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black ${risk.score>=70?"bg-rose-100 text-rose-700":risk.score>=45?"bg-orange-100 text-orange-700":risk.score>=20?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>{risk.score}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-black text-slate-900">{name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{risk.level}</span></div><p className="mt-1 text-xs text-slate-500">{cls} · No: {text(student.number,student.studentNumber)||"-"}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-slate-50 p-2"><b>{risk.gpa||"-"}</b><span className="block text-[10px] text-slate-400">Ortalama</span></div><div className="rounded-xl bg-slate-50 p-2"><b>{risk.absence}</b><span className="block text-[10px] text-slate-400">Devamsızlık</span></div><div className="rounded-xl bg-slate-50 p-2"><b>{risk.behavior}</b><span className="block text-[10px] text-slate-400">Davranış</span></div></div><div className="mt-4 space-y-2">{(risk.reasons.length?risk.reasons:["Rutin izleme yeterli"]).map(r=><div key={r} className="flex gap-2 text-xs text-slate-600"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600"/>{r}</div>)}</div><div className="mt-4 flex gap-2"><button onClick={()=>onNavigate?.("behavior")} className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white">Kayıtları Aç</button><button onClick={()=>onNavigate?.("messages")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Veliye Ulaş</button></div></article>})}</section>
  {filtered.length===0&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Seçilen ölçütlere uygun öğrenci bulunamadı.</div>}
 </div>
}
