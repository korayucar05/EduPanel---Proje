import React from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock3,
  LineChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  autonomousStore,
  buildHasatLiveSnapshot,
  hasatLiveEventBus,
  runPredictiveAi,
} from "../intelligence-v3";

const riskTone={
  critical:"bg-rose-50 text-rose-700 border-rose-200",
  high:"bg-orange-50 text-orange-700 border-orange-200",
  medium:"bg-amber-50 text-amber-700 border-amber-200",
  low:"bg-emerald-50 text-emerald-700 border-emerald-200",
} as const;

const riskLabel={
  critical:"Kritik",
  high:"Yüksek",
  medium:"Orta",
  low:"Düşük",
} as const;

export default function HasatPredictiveAi({
  students,
  teachers,
  classrooms,
}:{
  students:any[];
  teachers:any[];
  classrooms:any[];
}){
  const [version,setVersion]=React.useState(0);
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());
  const [forecastDays,setForecastDays]=React.useState(14);

  React.useEffect(()=>{
    const update=()=>setVersion(value=>value+1);
    const unsubscribe=hasatLiveEventBus.subscribe(()=>{
      setEvents(hasatLiveEventBus.snapshot());
      update();
    });
    window.addEventListener("hasat-autonomous-updated",update);
    return()=>{
      unsubscribe();
      window.removeEventListener("hasat-autonomous-updated",update);
    };
  },[]);

  const live=React.useMemo(
    ()=>buildHasatLiveSnapshot({
      events,
      studentCount:students.length,
      teacherCount:teachers.length,
      classroomCount:classrooms.length,
    }),
    [events,students.length,teachers.length,classrooms.length],
  );

  const memory=React.useMemo(()=>autonomousStore.memory(),[version]);

  const data=React.useMemo(
    ()=>runPredictiveAi({
      events:live.recentEvents,
      interventionMemory:memory,
      currentSchoolHealth:live.schoolHealthScore,
      forecastDays,
    }),
    [live,memory,forecastDays],
  );

  const metrics=[
    data.schoolHealth,
    data.criticalEvents,
    data.warningEvents,
    data.interventionEffectiveness,
  ];

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1650px] space-y-4">
      <div className={`overflow-hidden rounded-[34px] p-7 text-white shadow-xl ${
        data.summary.status==="critical"
          ?"bg-gradient-to-r from-black via-rose-950 to-red-900"
          :data.summary.status==="attention"
            ?"bg-gradient-to-r from-black via-amber-950 to-orange-900"
            :"bg-gradient-to-r from-black via-blue-950 to-indigo-900"
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü Öngörücü Yapay Zekâ 1.0</span>
            <h1 className="mt-2 text-3xl font-black">{data.summary.headline}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">{data.summary.detail}</p>
          </div>
          <label className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <span className="block text-[9px] font-black uppercase tracking-[.13em] text-white/60">Tahmin Ufku</span>
            <select value={forecastDays} onChange={event=>setForecastDays(Number(event.target.value))} className="mt-2 h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-black text-white outline-none">
              <option className="text-slate-900" value={7}>7 gün</option>
              <option className="text-slate-900" value={14}>14 gün</option>
              <option className="text-slate-900" value={30}>30 gün</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(item=><div key={item.key} className={`rounded-3xl border bg-white p-5 shadow-sm ${riskTone[item.riskLevel]}`}>
          <div className="flex items-center justify-between">
            <Brain className="h-5 w-5"/>
            <span className="text-[9px] font-black">Güven %{item.confidence}</span>
          </div>
          <span className="mt-4 block text-[10px] font-bold opacity-65">{item.label}</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div><span className="block text-[9px] opacity-60">Mevcut</span><strong className="text-2xl">{item.currentValue}</strong></div>
            <div className="text-right"><span className="block text-[9px] opacity-60">Tahmin</span><strong className="text-2xl">{item.predictedValue}</strong></div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-black">
            {item.change>0?<TrendingUp className="h-4 w-4"/>:item.change<0?<TrendingDown className="h-4 w-4"/>:<Activity className="h-4 w-4"/>}
            {item.change>0?"+":""}{item.change}
          </div>
        </div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-rose-700"/><h2 className="text-sm font-black text-slate-900">Öğrenci Risk Tahmini</h2></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400">
                <th className="px-3 py-3">Öğrenci</th>
                <th className="px-3 py-3">Sınıf</th>
                <th className="px-3 py-3">Mevcut</th>
                <th className="px-3 py-3">Tahmin</th>
                <th className="px-3 py-3">Değişim</th>
                <th className="px-3 py-3">Kritik Süre</th>
                <th className="px-3 py-3">Neden</th>
                <th className="px-3 py-3">Güven</th>
              </tr></thead>
              <tbody>{data.studentRisks.map(item=><tr key={item.studentId} className="border-b border-slate-100 text-[10px] text-slate-600">
                <td className="px-3 py-3"><strong className="text-xs text-slate-900">{item.studentName}</strong></td>
                <td className="px-3 py-3 font-bold">{item.classroom||"—"}</td>
                <td className="px-3 py-3">{item.currentRisk}</td>
                <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${riskTone[item.riskLevel]}`}>{item.predictedRisk} · {riskLabel[item.riskLevel]}</span></td>
                <td className="px-3 py-3 font-black text-rose-700">{item.riskChange>=0?"+":""}{item.riskChange}</td>
                <td className="px-3 py-3">{item.estimatedDaysToCritical===0?"Şimdi":item.estimatedDaysToCritical?`${item.estimatedDaysToCritical} gün`:"—"}</td>
                <td className="max-w-[300px] px-3 py-3"><span className="line-clamp-2">{item.reasons[0]||"Belirgin neden yok"}</span></td>
                <td className="px-3 py-3">%{item.confidence}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!data.studentRisks.length&&<p className="py-12 text-center text-xs text-slate-400">Öğrenci tahmini için öğrenci bağlantılı canlı olay kaydı gerekiyor.</p>}
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-indigo-700"/><h2 className="text-sm font-black text-slate-900">Sınıf Risk Tahmini</h2></div>
          <div className="mt-4 space-y-4">{data.classroomRisks.slice(0,12).map(item=><div key={item.classroom}>
            <div className="flex items-center justify-between"><div><strong className="text-xs text-slate-900">{item.classroom}</strong><span className="ml-2 text-[9px] text-slate-400">{item.eventCount} olay</span></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${riskTone[item.riskLevel]}`}>{item.predictedRisk}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.riskLevel==="critical"?"bg-rose-500":item.riskLevel==="high"?"bg-orange-500":item.riskLevel==="medium"?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.min(100,item.predictedRisk)}%`}}/></div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>{item.dominantSource}</span><span>{item.riskChange>=0?"+":""}{item.riskChange}</span></div>
          </div>)}</div>
        </div>
      </div>

      <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-emerald-950">e-Nstitü Tahmin Önerileri</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{data.recommendations.map((item,index)=><div key={index} className="rounded-2xl bg-white/65 p-4 text-[10px] leading-5 text-emerald-900">• {item}</div>)}</div>
      </div>
    </section>
  </div>;
}
