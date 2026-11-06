import React from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  Database,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type {IntelligenceKernelResult} from "../../intelligence-v3";

const levelTone={
  critical:"border-rose-200 bg-rose-50 text-rose-800",
  high:"border-orange-200 bg-orange-50 text-orange-800",
  medium:"border-amber-200 bg-amber-50 text-amber-800",
  low:"border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

export function IntelligenceKernelDashboard({
  data,
}:{
  data:IntelligenceKernelResult;
}){
  return <section className="space-y-4">
    <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
      {[
        ["Öğrenci",data.metrics.totalStudents,Users],
        ["Brain",data.metrics.brainIndex,Brain],
        ["Kritik",data.metrics.criticalStudents,AlertTriangle],
        ["Yaklaşan Kritik",data.metrics.projectedCriticalStudents,Activity],
        ["Net Etkisi",`+${data.metrics.expectedNetGain.toFixed(1)}`,TrendingUp],
        ["Yerleşme",`+${data.metrics.expectedPlacementGain}`,Target],
        ["Öneri",data.metrics.recommendationCount,Sparkles],
        ["İşlem",`${data.metrics.processingMs} ms`,Clock3],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-indigo-600"/>
        <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-lg font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-violet-700"/>
          <h3 className="text-sm font-black text-slate-900">Merkezi Öneri Motoru</h3>
        </div>
        <div className="mt-4 space-y-3">{data.recommendations.slice(0,15).map((item,index)=><div key={item.id} className={`rounded-2xl border p-4 ${levelTone[item.level]}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-xs font-black">{index+1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-xs">{item.title}</strong>
                <span className="rounded-full bg-white/60 px-2 py-1 text-[9px] font-black">{item.score.toFixed(0)}</span>
              </div>
              <p className="mt-2 text-[10px] leading-5 opacity-85">{item.detail}</p>
              <div className="mt-3 flex gap-2 rounded-xl bg-white/55 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>
                <span className="text-[10px] leading-5">{item.action}</span>
              </div>
            </div>
          </div>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-blue-700"/>
          <h3 className="text-sm font-black text-slate-900">Intelligence Timeline</h3>
        </div>
        <div className="mt-4 divide-y divide-slate-100">{data.events.map(event=><div key={event.id} className="py-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500"/>
            <div className="min-w-0 flex-1">
              <strong className="block text-xs text-slate-900">{event.title}</strong>
              {event.detail&&<p className="mt-1 text-[10px] leading-5 text-slate-500">{event.detail}</p>}
              <span className="mt-1 block text-[9px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString("tr-TR")}{event.durationMs!==undefined?` · ${event.durationMs} ms`:""}</span>
            </div>
          </div>
        </div>)}</div>
      </div>
    </div>
    </>
  </section>;
}
