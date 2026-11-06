import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  Clock3,
  History,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type {
  BrainTimelineCohort,
  BrainTimelineResult,
} from "../../intelligence-v2";

const trendLabel={
  rising:"Yükseliyor",
  stable:"Dengeli",
  falling:"Düşüyor",
  volatile:"Dalgalı",
  insufficient:"Yetersiz Veri",
} as const;

const trendTone={
  rising:"bg-emerald-50 text-emerald-700 border-emerald-200",
  stable:"bg-blue-50 text-blue-700 border-blue-200",
  falling:"bg-rose-50 text-rose-700 border-rose-200",
  volatile:"bg-amber-50 text-amber-700 border-amber-200",
  insufficient:"bg-slate-50 text-slate-600 border-slate-200",
} as const;

const MiniLine=({
  values,
  stroke="#2563eb",
}:{
  values:number[];
  stroke?:string;
})=>{
  const width=420;
  const height=100;
  if(!values.length)return null;
  const min=Math.min(...values);
  const max=Math.max(...values);
  const range=Math.max(1,max-min);
  const points=values.map((value,index)=>{
    const x=values.length===1?width/2:index/(values.length-1)*width;
    const y=height-12-(value-min)/range*(height-24);
    return`${x},${y}`;
  }).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
    <line x1="0" y1={height-12} x2={width} y2={height-12} stroke="#e2e8f0" strokeWidth="1"/>
    <polyline fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points}/>
    {points.split(" ").map((point,index)=>{
      const [cx,cy]=point.split(",");
      return <circle key={index} cx={cx} cy={cy} r="4.5" fill="white" stroke={stroke} strokeWidth="3"/>;
    })}
  </svg>;
};

function StudentTimeline({timeline}:{timeline:BrainTimelineResult}){
  const latest=timeline.points.at(-1);
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-4">
      {[
        ["Sınav",timeline.points.length,History],
        ["Net Değişimi",`${timeline.netChange>=0?"+":""}${timeline.netChange.toFixed(2)}`,TrendingUp],
        ["Brain Değişimi",`${timeline.brainScoreChange>=0?"+":""}${timeline.brainScoreChange.toFixed(1)}`,Activity],
        ["Güven",`%${timeline.confidence}`,ShieldCheck],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-indigo-600"/>
        <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-blue-600">Akademik Eğri</span><h3 className="mt-1 text-sm font-black text-slate-900">Net Zaman Tüneli</h3></div>
          <span className={`rounded-full border px-3 py-1 text-[9px] font-black ${trendTone[timeline.trend]}`}>{trendLabel[timeline.trend]}</span>
        </div>
        <div className="mt-4"><MiniLine values={timeline.points.map(point=>point.net)}/></div>
        <div className="mt-1 grid gap-2" style={{gridTemplateColumns:`repeat(${Math.max(1,timeline.points.length)},minmax(0,1fr))`}}>
          {timeline.points.map(point=><div key={point.examId} className="min-w-0 text-center"><strong className="block truncate text-[9px] text-slate-700">{point.net.toFixed(1)}</strong><span className="mt-1 block truncate text-[8px] text-slate-400">{point.examName}</span></div>)}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">e-Nstitü Brain</span><h3 className="mt-1 text-sm font-black text-slate-900">Brain Score Zaman Tüneli</h3></div>
          <span className="text-[10px] font-black text-violet-700">{latest?.brainScore.toFixed(1)||"—"}/100</span>
        </div>
        <div className="mt-4"><MiniLine values={timeline.points.map(point=>point.brainScore)} stroke="#7c3aed"/></div>
        <p className="mt-3 text-[10px] leading-5 text-slate-500">{timeline.summary}</p>
      </div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CalendarClock className="h-5 w-5"/></div>
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Müdahale Hafızası</span><h3 className="mt-1 text-sm font-black text-slate-900">Uygulanan Müdahaleler ve Sonuçları</h3></div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {timeline.interventionMemory.length?timeline.interventionMemory.map(item=><div key={item.id} className="flex items-start gap-3 py-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.outcome==="effective"?"bg-emerald-50 text-emerald-700":item.outcome==="ineffective"?"bg-rose-50 text-rose-700":item.outcome==="limited"?"bg-amber-50 text-amber-700":"bg-slate-50 text-slate-500"}`}>
            {item.outcome==="effective"?<ArrowUpRight className="h-5 w-5"/>:item.outcome==="ineffective"?<ArrowDownRight className="h-5 w-5"/>:<Clock3 className="h-5 w-5"/>}
          </div>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-slate-900">{item.title}</strong><span className="text-[9px] font-bold text-slate-400">{item.date}</span></div><p className="mt-1 text-[10px] leading-5 text-slate-500">{item.explanation}</p></div>
          {item.observedNetGain!==undefined&&<span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{item.observedNetGain>=0?"+":""}{item.observedNetGain.toFixed(1)} net</span>}
        </div>):<div className="py-8 text-center text-xs text-slate-400">Kayıtlı müdahale geçmişi bulunmuyor.</div>}
      </div>
    </div>

    {timeline.recommendations.length>0&&<div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <span className="text-[9px] font-black uppercase tracking-[.14em] text-amber-700">e-Nstitü Önerileri</span>
      <div className="mt-3 space-y-2">{timeline.recommendations.map((item,index)=><p key={index} className="text-[10px] leading-5 text-amber-900">• {item}</p>)}</div>
    </div>}
  </div>;
}

export function BrainTimelineDashboard({data}:{data:BrainTimelineCohort}){
  const [studentId,setStudentId]=React.useState(data.timelines[0]?.student.id||"");
  React.useEffect(()=>{
    if(!data.timelines.some(item=>item.student.id===studentId)){
      setStudentId(data.timelines[0]?.student.id||"");
    }
  },[data,studentId]);

  const selected=data.timelines.find(item=>item.student.id===studentId)||data.timelines[0];

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-800 p-5 text-white shadow-lg">
      <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/70">e-Nstitü Brain Timeline</span>
      <h2 className="mt-2 text-xl font-black">Akademik Zaman Tüneli & Müdahale Hafızası</h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-white/80">{data.totalStudents} öğrenci değerlendirildi; {data.sufficientHistoryCount} öğrencide en az iki sınav bulundu.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Öğrenci",data.totalStudents],
        ["Yükselen",data.risingCount],
        ["Dengeli",data.stableCount],
        ["Düşen",data.fallingCount],
        ["Dalgalı",data.volatileCount],
        ["Ort. Net Değişimi",`${data.averageNetChange>=0?"+":""}${data.averageNetChange}`],
      ].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="block text-[9px] font-bold text-slate-400">{label}</span><strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong></div>)}
    </div>

    {data.timelines.length?<div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-[9px] font-black uppercase tracking-[.13em] text-slate-400">Öğrenci Seçimi</label>
      <div className="relative mt-2">
        <select value={studentId} onChange={event=>setStudentId(event.target.value)} className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-xs font-black text-slate-800 outline-none focus:border-indigo-400">
          {data.timelines.map(item=><option key={item.student.id} value={item.student.id}>{item.student.name} · {item.student.classroom||"Sınıf yok"} · {trendLabel[item.trend]}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
      </div>
    </div>:null}

    {selected?<StudentTimeline timeline={selected}/>:<div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">Zaman tüneli oluşturulabilecek öğrenci verisi bulunamadı.</div>}

    {data.interventionSummary.length>0&&<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><RotateCcw className="h-5 w-5 text-cyan-700"/><h3 className="text-sm font-black text-slate-900">Kurum Müdahale Etkinliği</h3></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.interventionSummary.map(item=><div key={item.type} className="rounded-2xl bg-slate-50 p-4"><strong className="block text-xs text-slate-900">{item.type}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.count} uygulama · {item.effectiveCount} etkili</span><div className="mt-3 flex justify-between text-[10px]"><span className="font-bold text-emerald-700">%{item.effectivenessRate} etkinlik</span><span className="font-bold text-blue-700">{item.averageObservedGain>=0?"+":""}{item.averageObservedGain} net</span></div></div>)}</div>
    </div>}
  </section>;
}
