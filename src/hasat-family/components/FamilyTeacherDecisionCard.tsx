import React from "react";
import {CalendarClock,CheckCircle2,GraduationCap,TriangleAlert} from "lucide-react";
import {HasatCard,HasatStatStrip} from "../../design-system";
import type {TeacherDecision} from "../../intelligence/teacher";

const palette={
  urgent:{
    header:"from-rose-600 to-red-500",
    badge:"bg-rose-100 text-rose-700",
    label:"Acil",
  },
  support:{
    header:"from-amber-500 to-orange-500",
    badge:"bg-amber-100 text-amber-700",
    label:"Destek",
  },
  monitor:{
    header:"from-emerald-600 to-teal-600",
    badge:"bg-emerald-100 text-emerald-700",
    label:"İzleme",
  },
} as const;

export function FamilyTeacherDecisionCard({decision}:{decision:TeacherDecision}){
  const tone=palette[decision.level];
  return <div className="space-y-4">
    <HasatCard className="overflow-hidden p-0">
      <div className={`bg-gradient-to-r ${tone.header} p-5 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-white/75">Öğretmen Karar Motoru</span>
            <h2 className="mt-2 text-lg font-black">{decision.headline}</h2>
            <p className="mt-2 text-[10px] leading-5 text-white/85">{decision.rationale}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <GraduationCap className="h-6 w-6"/>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${tone.badge}`}>{tone.label} düzeyi</span>
          <span className="text-[10px] font-bold text-slate-500">Karar puanı: {decision.score}/100</span>
        </div>
      </div>
    </HasatCard>

    <HasatStatStrip items={[
      {label:"Takip Süresi",value:`${decision.nextReviewDays} gün`},
      {label:"Risk",value:decision.primaryRisk?.level==="high"?"Yüksek":decision.primaryRisk?.level==="medium"?"Orta":"Düşük"},
      {label:"Öncelikli Ders",value:decision.primaryPriority?.subject||"—"},
    ]}/>

    <HasatCard className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <CalendarClock className="h-5 w-5"/>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-blue-600">Müdahale Planı</span>
          <h3 className="mt-1 text-sm font-black text-slate-900">Önerilen Öğretmen Adımları</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">{decision.recommendedActions.map((action,index)=><div key={index} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>
        <p className="text-[10px] leading-5 text-slate-600">{action}</p>
      </div>)}</div>
    </HasatCard>

    {decision.primaryRisk&&<HasatCard className="p-4">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/>
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-amber-600">Birincil Risk</span>
          <h3 className="mt-1 text-sm font-black text-slate-900">{decision.primaryRisk.title}</h3>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">{decision.primaryRisk.detail}</p>
        </div>
      </div>
    </HasatCard>}
  </div>;
}
