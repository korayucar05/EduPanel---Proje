import React from "react";
import type { AiAdvisorCard, StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumActionPlan } from "../../hasat-core/ui/PremiumActionPlan";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

const cardStyle:Record<AiAdvisorCard["type"],{
  accent:"green"|"amber"|"blue"|"violet";
  emoji:string;
  background:string;
}>={
  strength:{accent:"green",emoji:"🌟",background:"from-green-50 to-white"},
  attention:{accent:"amber",emoji:"⚠️",background:"from-amber-50 to-white"},
  action:{accent:"blue",emoji:"📘",background:"from-blue-50 to-white"},
  potential:{accent:"violet",emoji:"🚀",background:"from-violet-50 to-white"},
};

const decisionStyle={
  strong:{label:"Güçlü",className:"border-emerald-200 bg-emerald-50 text-emerald-800"},
  balanced:{label:"Dengeli",className:"border-blue-200 bg-blue-50 text-blue-800"},
  attention:{label:"Yakın Takip",className:"border-amber-200 bg-amber-50 text-amber-900"},
} as const;

const riskStyle={
  low:{label:"Düşük",className:"border-emerald-200 bg-emerald-50",badge:"bg-emerald-600"},
  medium:{label:"Orta",className:"border-amber-200 bg-amber-50",badge:"bg-amber-500"},
  high:{label:"Yüksek",className:"border-rose-200 bg-rose-50",badge:"bg-rose-600"},
} as const;

export function StudentAiEvaluationPage({report}:{report:StudentReportV2Data}){
  const ai=report.aiEvaluation;
  if(!ai)return null;
  const decision=decisionStyle[ai.decisionSummary.status];

  return (
    <article
      id="hasat-student-report-v2-ai"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow={`e-Nstitü · Kişiye Özel AI Değerlendirme ${ai.version}`}
        title="Akademik Danışmanlık ve 7 Günlük Eylem Planı"
        subtitle="Sınav sonucu, Akademik DNA ve hedef analizinin açıklanabilir değerlendirmesi"
        sideTitle={report.student.name}
        sideDetail={ai.dataScope==="single-exam"?"Tek sınav değerlendirmesi":"Çoklu sınav değerlendirmesi"}
        accent="teal"
      />

      <section className="mb-4 grid grid-cols-3 gap-4">
        <PremiumMetricCard label="AI Güven Skoru" value={`%${Math.round(ai.confidence)}`} accent="teal"/>
        <PremiumMetricCard label="Risk Sinyali" value={ai.riskSignals.length} accent="amber"/>
        <PremiumMetricCard label="7 Günlük Görev" value={ai.sevenDayPlan.length} accent="violet"/>
      </section>

      <div className={`mb-4 rounded-2xl border px-5 py-4 ${decision.className}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[8px] font-black uppercase tracking-[0.18em]">AI karar özeti</span>
            <h3 className="mt-1 text-[17px] font-black">{ai.decisionSummary.headline}</h3>
            <p className="mt-2 text-[9px] font-semibold leading-5">{ai.decisionSummary.rationale}</p>
          </div>
          <span className="shrink-0 rounded-full border border-current px-4 py-2 text-[9px] font-black uppercase tracking-wider">{decision.label}</span>
        </div>
      </div>

      <section className="mb-4 grid grid-cols-4 gap-3">
        {ai.advisorCards.map(card=>{
          const style=cardStyle[card.type];
          return (
            <PremiumReportCard key={card.type} accent={style.accent} className={`bg-gradient-to-br ${style.background} p-4`}>
              <div className="text-[21px]">{style.emoji}</div>
              <strong className="mt-2 block text-[10px] font-black text-[#082f58]">{card.title}</strong>
              {card.metric&&<span className="mt-1 block text-[15px] font-black text-teal-700">{card.metric}</span>}
              <p className="mt-2 text-[8px] font-semibold leading-4 text-slate-600">{card.message}</p>
            </PremiumReportCard>
          );
        })}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-4">
        <PremiumReportCard accent="amber" className="p-4">
          <PremiumSectionTitle title="Risk ve Müdahale Sinyalleri" eyebrow="Önceliklendirilmiş takip" accent="amber" className="mb-3"/>
          <div className="space-y-2">
            {ai.riskSignals.slice(0,4).map((risk,index)=>{
              const style=riskStyle[risk.level];
              return (
                <div key={`${risk.title}-${index}`} className={`rounded-xl border px-3 py-2 ${style.className}`}>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[7px] font-black text-white ${style.badge}`}>{style.label}</span>
                    <strong className="text-[9px] font-black text-slate-800">{risk.title}</strong>
                  </div>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">{risk.detail}</p>
                </div>
              );
            })}
          </div>
        </PremiumReportCard>

        <PremiumReportCard accent="blue" className="p-4">
          <PremiumSectionTitle title="AI Öğrenciye Sesleniyor" eyebrow="Kişisel akademik değerlendirme" accent="blue" className="mb-3"/>
          <p className="rounded-xl bg-gradient-to-r from-blue-50 via-white to-teal-50 px-4 py-3 text-[9px] font-semibold leading-5 text-slate-700">{ai.studentMessage}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
              <strong className="text-[8px] font-black text-teal-800">Veli yaklaşımı</strong>
              <p className="mt-1 text-[7.5px] leading-4 text-slate-600">{ai.parentMessage}</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
              <strong className="text-[8px] font-black text-violet-800">Öğretmen müdahalesi</strong>
              <p className="mt-1 text-[7.5px] leading-4 text-slate-600">{ai.teacherMessage}</p>
            </div>
          </div>
        </PremiumReportCard>
      </section>

      <PremiumReportCard accent="teal" className="mb-4 p-4">
        <PremiumSectionTitle title="7 Günlük Uygulama Planı" eyebrow="Her gün ölçülebilir tek adım" accent="teal" className="mb-3"/>
        <div className="grid grid-cols-7 gap-2">
          {ai.sevenDayPlan.map((item,index)=>(
            <div key={item.day} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-1">
                <strong className="text-[8px] font-black text-[#082f58]">{item.day}</strong>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[6.5px] font-bold text-teal-700">{item.minutes} dk</span>
              </div>
              <p className="mt-1 text-[7px] font-black text-teal-700">{item.focus}</p>
              <ul className="mt-1.5 space-y-1">
                {item.tasks.slice(0,3).map((task,taskIndex)=><li key={taskIndex} className="text-[6.5px] leading-3 text-slate-600">• {task}</li>)}
              </ul>
              <p className="mt-2 border-t border-slate-200 pt-1.5 text-[6px] font-semibold leading-3 text-slate-500">✓ {item.successCheck}</p>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <div className="mb-4">
        <PremiumActionPlan
          title="Kişiye Özel Öncelikli Eylemler"
          eyebrow="Bir sonraki sınava kadar"
          items={ai.nextActions.slice(0,4).map(item=>({
            priority:item.priority,
            title:item.title,
            detail:item.detail,
            owner:item.priority<=2?"Öğrenci + öğretmen":"Öğrenci / veli",
          }))}
          accent="teal"
        />
      </div>

      <div className="grid grid-cols-[1fr_1.5fr] gap-4">
        <PremiumReportCard accent="navy" className="p-4">
          <PremiumSectionTitle title="Veri Dayanakları" eyebrow="Açıklanabilirlik" accent="navy" className="mb-2"/>
          <div className="space-y-1.5">
            {ai.evidence.slice(0,4).map((item,index)=>(
              <div key={index} className="flex items-start gap-2 text-[7px] leading-3.5 text-slate-600">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#082f58] text-[6px] font-black text-white">{index+1}</span>
                {item}
              </div>
            ))}
          </div>
        </PremiumReportCard>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <strong className="block text-[8px] font-black text-amber-800">Kullanım notu</strong>
          <p className="mt-1 text-[7px] leading-4 text-amber-900">{ai.disclaimer}</p>
        </div>
      </div>

      <PremiumReportFooter
        brandLine="Analiz et · Anla · Uygula · Geliş"
        reportCode={report.reportCode}
        page={5}
        pageCount={8}
        rightText={`e-Nstitü AI Değerlendirme ${ai.version}`}
      />
    </article>
  );
}
