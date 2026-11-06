import React from "react";
import {
  Activity,
  Archive,
  CheckCircle2,
  Clock3,
  LineChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  autonomousStore,
  buildInterventionInsights,
} from "../intelligence-v3";

const outcomeLabel={
  pending:"Bekliyor",
  effective:"Etkili",
  limited:"Sınırlı",
  ineffective:"Etkisiz",
} as const;

const outcomeTone={
  pending:"bg-slate-100 text-slate-600",
  effective:"bg-emerald-50 text-emerald-700",
  limited:"bg-amber-50 text-amber-700",
  ineffective:"bg-rose-50 text-rose-700",
} as const;

const targetLabel={
  student:"Öğrenci",
  classroom:"Sınıf",
  subject:"Ders / Branş",
  school:"Okul",
} as const;

function MiniBars({values}:{values:number[]}){
  const max=Math.max(1,...values);
  return <div className="flex h-28 items-end gap-2">
    {values.map((value,index)=><div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="w-full rounded-t-lg bg-indigo-500" style={{height:`${Math.max(4,value/max*92)}px`}}/>
      <span className="text-[8px] font-bold text-slate-400">{value.toFixed(0)}</span>
    </div>)}
  </div>;
}

export default function HasatInterventionInsights(){
  const [version,setVersion]=React.useState(0);

  React.useEffect(()=>{
    const update=()=>setVersion(value=>value+1);
    window.addEventListener("hasat-autonomous-updated",update);
    return()=>window.removeEventListener("hasat-autonomous-updated",update);
  },[]);

  const records=React.useMemo(()=>autonomousStore.memory(),[version]);
  const data=React.useMemo(()=>buildInterventionInsights(records),[records]);

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1600px] space-y-4">
      <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl">
        <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü Intervention Insights 1.0</span>
        <h1 className="mt-2 text-3xl font-black">Kurumsal Müdahale Hafızası</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">{data.summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {[
          ["Toplam",data.totalInterventions,Archive],
          ["Tamamlanan",data.completedInterventions,CheckCircle2],
          ["Bekleyen",data.pendingInterventions,Clock3],
          ["Etkili",data.effectiveInterventions,TrendingUp],
          ["Başarı",`%${data.successRate}`,Target],
          ["Ort. Net",`${data.averageObservedGain>=0?"+":""}${data.averageObservedGain}`,LineChart],
          ["Etkinlik",`%${data.averageEffectiveness}`,Activity],
        ].map(([label,value,Icon]:any)=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Icon className="h-5 w-5 text-indigo-600"/>
          <span className="mt-4 block text-[10px] font-bold text-slate-400">{label}</span>
          <strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong>
        </div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Target className="h-5 w-5 text-indigo-700"/><h2 className="text-sm font-black text-slate-900">Müdahale Türü Etki Analizi</h2></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400">
                <th className="px-3 py-3">Müdahale</th>
                <th className="px-3 py-3">Kayıt</th>
                <th className="px-3 py-3">Etkili</th>
                <th className="px-3 py-3">Başarı</th>
                <th className="px-3 py-3">Beklenen</th>
                <th className="px-3 py-3">Gerçekleşen</th>
                <th className="px-3 py-3">Etkinlik</th>
              </tr></thead>
              <tbody>{data.byType.map(item=><tr key={item.key} className="border-b border-slate-100 text-[10px] text-slate-600">
                <td className="px-3 py-3"><strong className="text-xs text-slate-900">{item.label}</strong></td>
                <td className="px-3 py-3">{item.count}</td>
                <td className="px-3 py-3 font-black text-emerald-700">{item.effectiveCount}</td>
                <td className="px-3 py-3">%{item.successRate}</td>
                <td className="px-3 py-3">{item.averageExpectedGain>=0?"+":""}{item.averageExpectedGain} net</td>
                <td className="px-3 py-3 font-black text-blue-700">{item.averageObservedGain>=0?"+":""}{item.averageObservedGain} net</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.averageEffectiveness>=70?"bg-emerald-50 text-emerald-700":item.averageEffectiveness>=40?"bg-amber-50 text-amber-700":"bg-rose-50 text-rose-700"}`}>%{item.averageEffectiveness}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!data.byType.length&&<p className="py-12 text-center text-xs text-slate-400">Henüz ölçülmüş müdahale bulunmuyor.</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><LineChart className="h-5 w-5 text-blue-700"/><h2 className="text-sm font-black text-slate-900">Aylık Etkinlik Eğilimi</h2></div>
            <div className="mt-5">
              {data.trend.length?<MiniBars values={data.trend.map(item=>item.averageEffectiveness)}/>:<p className="py-12 text-center text-xs text-slate-400">Eğilim için yeterli veri yok.</p>}
            </div>
            <div className="mt-3 grid gap-2" style={{gridTemplateColumns:`repeat(${Math.max(1,data.trend.length)},minmax(0,1fr))`}}>
              {data.trend.map(item=><span key={item.period} className="truncate text-center text-[8px] text-slate-400">{item.period}</span>)}
            </div>
          </div>

          <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-emerald-950">e-Nstitü Öğreniyor</h2></div>
            <div className="mt-4 space-y-3">
              {data.recommendations.length?data.recommendations.map((item,index)=><div key={index} className="rounded-2xl bg-white/65 p-4 text-[10px] leading-5 text-emerald-900">• {item}</div>):<p className="rounded-2xl bg-white/60 p-5 text-xs text-emerald-800">Öneri üretmek için daha fazla sonuç kaydı gerekiyor.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Hedef Türüne Göre Dağılım</h2>
          <div className="mt-4 space-y-3">{data.byTargetType.map(item=><div key={item.key} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between"><strong className="text-xs text-slate-900">{item.label}</strong><span className="text-[10px] font-black text-indigo-700">{item.count}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{width:`${Math.min(100,item.averageEffectiveness)}%`}}/></div>
            <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>%{item.successRate} başarı</span><span>{item.averageObservedGain>=0?"+":""}{item.averageObservedGain} net</span></div>
          </div>)}</div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Son Müdahale Kayıtları</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400">
                <th className="px-3 py-3">Müdahale</th>
                <th className="px-3 py-3">Hedef</th>
                <th className="px-3 py-3">Başlangıç</th>
                <th className="px-3 py-3">Beklenen</th>
                <th className="px-3 py-3">Gerçekleşen</th>
                <th className="px-3 py-3">Sonuç</th>
              </tr></thead>
              <tbody>{data.recentRecords.map(item=><tr key={item.id} className="border-b border-slate-100 text-[10px] text-slate-600">
                <td className="max-w-[280px] px-3 py-3"><strong className="block text-xs text-slate-900">{item.title}</strong><span className="mt-1 block text-[9px] text-slate-400">{item.interventionType}</span></td>
                <td className="px-3 py-3">{targetLabel[item.targetType]}{item.targetLabel?` · ${item.targetLabel}`:""}</td>
                <td className="px-3 py-3">{new Date(item.startedAt).toLocaleDateString("tr-TR")}</td>
                <td className="px-3 py-3">{item.expectedGain!==undefined?`${item.expectedGain>=0?"+":""}${item.expectedGain.toFixed(2)} net`:"—"}</td>
                <td className="px-3 py-3 font-black text-blue-700">{item.observedGain!==undefined?`${item.observedGain>=0?"+":""}${item.observedGain.toFixed(2)} net`:"—"}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${outcomeTone[item.outcome]}`}>{outcomeLabel[item.outcome]}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
