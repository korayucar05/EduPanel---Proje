import React from "react";
import type { StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

const rank=(value?:number)=>value?value.toLocaleString("tr-TR"):"-";

export function StudentTargetAnalysisPage({report}:{report:StudentReportV2Data}){
  const target=report.targetAnalysis;
  if(!target)return null;
  const d=target.definition;
  const targetName=[d.university,d.program].filter(Boolean).join(" · ")||"Hedef henüz tanımlanmadı";
  const probability=target.probability;
  return <article id="hasat-student-report-v2-target" className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800" style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
    <PremiumReportHeader eyebrow="e-Nstitü · Hedef Üniversite Motoru 2.0" title="Hedefe Uzaklık ve Kazanç Analizi" subtitle={targetName} sideTitle={report.student.name} sideDetail={d.targetYear?`${d.targetYear} hedefi`:"Kişisel hedef planı"} accent="orange"/>

    <section className="mb-5 grid grid-cols-5 gap-3">
      <PremiumMetricCard label="Mevcut Net" value={target.currentNet.toFixed(2)} accent="blue"/>
      <PremiumMetricCard label="Hedef Net" value={d.targetNet!==undefined?Number(d.targetNet).toFixed(2):"-"} accent="green"/>
      <PremiumMetricCard label="Mevcut Sıra" value={rank(target.currentRank)} accent="violet"/>
      <PremiumMetricCard label="Hedef Sıra" value={rank(d.targetRank)} accent="rose"/>
      <PremiumMetricCard label="Hedefe Yakınlık" value={target.rankProximity!==undefined?`%${Math.round(target.rankProximity)}`:target.completionRate!==undefined?`%${Math.round(target.completionRate)}`:"-"} accent="amber"/>
    </section>

    <PremiumReportCard accent="orange" className="mb-5 p-5">
      <PremiumSectionTitle title="e-Nstitü Hedef Değerlendirmesi" eyebrow="Mevcut durum · hedef farkı · tahmini ilerleme" accent="orange" className="mb-3"/>
      <p className="text-[11px] font-semibold leading-6 text-slate-700">{target.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.scoreType&&<PremiumStatusBadge status="info">{d.scoreType}</PremiumStatusBadge>}
        {target.netGap!==undefined&&<PremiumStatusBadge status="warning">Net farkı: {target.netGap.toFixed(2)}</PremiumStatusBadge>}
        {target.rankGap!==undefined&&<PremiumStatusBadge status="risk">Sıra farkı: {rank(target.rankGap)}</PremiumStatusBadge>}
        {d.sourceNote&&<PremiumStatusBadge status="neutral">{d.sourceNote}</PremiumStatusBadge>}
      </div>
    </PremiumReportCard>

    {!target.isDefined?<PremiumReportCard accent="amber" className="mb-5 p-8 text-center"><div className="text-[50px]">🎯</div><h2 className="mt-4 text-[22px] font-black text-[#082f58]">Öğrenci hedefi tanımlanmayı bekliyor</h2><p className="mx-auto mt-3 max-w-[650px] text-[11px] leading-6 text-slate-600">“Hedef Tanımla” bölümünden üniversite, bölüm, hedef net ve hedef sıralama bilgilerini girin.</p></PremiumReportCard>:<>
      {probability&&<PremiumReportCard accent="violet" className="mb-5 p-5">
        <PremiumSectionTitle title="Hedefe Ulaşma Senaryoları" eyebrow="Performans ve çalışma süresine dayalı eğitimsel tahmin" accent="violet" className="mb-4"/>
        <div className="grid grid-cols-4 gap-3">
          {[['Bugünkü performans',probability.current],['Aynı tempoyla',probability.steady],['Haftada +2 saat',probability.plusTwoHours],['Haftada +5 saat',probability.plusFiveHours]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-center"><span className="text-[9px] font-bold text-slate-500">{label}</span><strong className="mt-2 block text-[28px] font-black text-violet-700">%{value}</strong><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600" style={{width:`${value}%`}}/></div></div>)}
        </div>
      </PremiumReportCard>}

      <section className="mb-5 grid grid-cols-[62%_38%] gap-4">
        <PremiumReportCard accent="rose" className="p-5">
          <PremiumSectionTitle title="Ders Bazlı Kazanç Analizi" eyebrow="Nereye çalışırsam daha çok kazanırım?" accent="rose" className="mb-4"/>
          <div className="space-y-2.5">{target.opportunities.map((item,index)=><div key={item.subject} className="grid grid-cols-[150px_1fr_95px_95px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div><strong className="block text-[10px] text-[#082f58]">{index+1}. {item.subject}</strong><span className="text-[8px] text-slate-400">{item.currentNet.toFixed(2)} → {item.targetNet.toFixed(2)} net</span></div><div><div className="h-2.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500" style={{width:`${Math.max(8,item.efficiencyScore)}%`}}/></div><span className="mt-1 block text-[8px] text-slate-500">Yatırım verimi: {item.efficiencyLabel}</span></div><strong className="text-right text-[15px] font-black text-green-700">+{item.suggestedGain.toFixed(2)}</strong><span className="text-right text-[9px] font-bold text-violet-700">{item.projectedRank?`≈ ${rank(item.projectedRank)}`:"Sıra verisi yok"}</span></div>)}</div>
        </PremiumReportCard>
        <PremiumReportCard accent="blue" className="p-5">
          <PremiumSectionTitle title="Aşamalı Hedef Takvimi" eyebrow="Dört kontrol noktası" accent="blue" className="mb-4"/>
          <div className="space-y-3">{target.milestones.map((item,index)=><div key={item.label} className="grid grid-cols-[32px_1fr] items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#082f58] text-[10px] font-black text-white">{index+1}</span><div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><strong className="block text-[9px] text-blue-900">{item.label}</strong><span className="text-[14px] font-black text-[#082f58]">{item.targetNet.toFixed(2)} net</span></div></div>)}</div>
        </PremiumReportCard>
      </section>

      <PremiumReportCard accent="teal" className="mb-5 p-5"><PremiumSectionTitle title="Haftalık Ders Yatırımı" eyebrow="Net kazancına göre süre dağılımı" accent="teal" className="mb-4"/><div className="grid grid-cols-5 gap-3">{target.weeklyHours.map(item=><div key={item.subject} className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-4"><strong className="block truncate text-[10px] text-[#082f58]">{item.subject}</strong><span className="mt-3 block text-[24px] font-black text-teal-700">{item.hours.toFixed(1)}</span><span className="text-[8px] font-bold uppercase text-slate-400">saat / hafta</span><p className="mt-3 text-[8px] leading-4 text-slate-500">{item.reason}</p></div>)}</div></PremiumReportCard>
    </>}

    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"><strong className="block text-[10px] font-black text-amber-800">Tahmin kullanım notu</strong><p className="mt-2 text-[9px] leading-5 text-amber-900">{target.disclaimer}</p></div>
    <PremiumReportFooter brandLine="Hedefini belirle · Yolunu planla · Başarıyı hasat et" reportCode={report.reportCode} page={4} pageCount={8} rightText="e-Nstitü Hedef Motoru 2.0"/>
  </article>;
}
