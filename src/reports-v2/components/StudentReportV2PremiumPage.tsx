import React from "react";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";
import type { StudentReportV2Data } from "../types";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumMotivationBanner } from "../../hasat-core/ui/PremiumMotivationBanner";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";

const subjectColor=(rate:number)=>rate>=75?"#16a34a":rate>=55?"#f59e0b":"#e11d48";

export function StudentReportV2PremiumPage({report}:{report:StudentReportV2Data}){
  const premium=report.premium;
  if(!premium)return null;

  return (
    <article
      id="hasat-student-report-v2-premium"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow="e-Nstitü · Kişisel Gelişim Merkezi"
        title="Gelişim Analizi ve Kişisel Çalışma Planı"
        subtitle={`${report.examName} · ${report.reportCode}`}
        sideTitle={report.student.name}
        sideDetail={`${report.student.classroom || "-"} / ${report.student.branch || "-"}`}
        accent="violet"
      />

      <section className="mb-5 grid grid-cols-3 gap-4">
        <PremiumMetricCard label="Mevcut Net" value={premium.currentNet.toFixed(2)} accent="blue" className="p-5"/>
        <PremiumMetricCard label="Kısa Vadeli Hedef" value={premium.targetNet.toFixed(2)} accent="green" className="p-5"/>
        <PremiumMetricCard label="Kazanılabilir Net" value={`+${premium.potentialGain.toFixed(2)}`} accent="amber" className="p-5"/>
      </section>

      <PremiumMotivationBanner title="Bu plan senin gelişim yol haritandır." emoji="🗺️">
        En yüksek gelişim potansiyeline sahip dersler önceliklendirilmiştir. Küçük hedefleri düzenli uygulaman, bir sonraki sınavdaki net artışını destekleyecektir.
      </PremiumMotivationBanner>

      <section className="mb-5 mt-5 grid grid-cols-[58%_42%] gap-4">
        <PremiumReportCard accent="rose" className="p-5">
          <PremiumSectionTitle title="Öncelikli Gelişim Alanları" eyebrow="Odak dersler" accent="rose" className="mb-4"/>
          <div className="space-y-4">
            {premium.prioritySubjects.map((item,index)=>(
              <div key={item.subject} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="mb-2 flex justify-between text-[10px]">
                  <strong className="text-slate-700">{index+1}. {item.subject}</strong>
                  <PremiumStatusBadge status={item.successRate>=75?"success":item.successRate>=55?"warning":"risk"}>
                    %{Math.round(item.successRate)}
                  </PremiumStatusBadge>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                  <div className="h-full rounded-full" style={{width:`${Math.max(3,item.successRate)}%`,backgroundColor:subjectColor(item.successRate)}}/>
                </div>
                {Number.isFinite(item.gap)&&(
                  <p className="mt-2 text-[9px] text-slate-500">
                    Ders ortalamasına fark: {item.gap!>=0?"+":""}{item.gap!.toFixed(1)} puan
                  </p>
                )}
              </div>
            ))}
          </div>
        </PremiumReportCard>

        <PremiumReportCard accent="teal" className="p-5">
          <PremiumSectionTitle title="Veli İçin Kısa Özet" eyebrow="Birlikte takip" accent="teal" className="mb-4"/>
          <p className="text-[11px] leading-6 text-slate-700">{premium.parentSummary}</p>
          <div className="mt-6 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-blue-50 p-4">
            <strong className="text-[10px] text-teal-800">Bir sonraki kontrol noktası</strong>
            <p className="mt-2 text-[9px] leading-5 text-teal-900">
              Bu çalışma planı bir sonraki deneme sınavına kadar uygulanmalı; ders bazlı net değişimleri yeniden değerlendirilmelidir.
            </p>
          </div>
        </PremiumReportCard>
      </section>

      <PremiumReportCard accent="blue" className="mb-5 p-5">
        <PremiumSectionTitle title="Haftalık Kişisel Çalışma Planı" eyebrow="Gün gün uygulama" accent="blue" className="mb-4"/>
        <div className="grid grid-cols-3 gap-3">
          {premium.weeklyPlan.map((plan,index)=>(
            <div key={plan.day} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-4">
              <div className="flex items-center justify-between">
                <strong className="text-[11px] text-[#082f58]">{plan.day}</strong>
                <span className="rounded-full bg-blue-600 px-2 py-1 text-[8px] font-black text-white">{plan.estimatedMinutes} dk</span>
              </div>
              <ul className="mt-3 space-y-2">
                {plan.tasks.map((task,taskIndex)=>(
                  <li key={taskIndex} className="flex gap-2 text-[9px] leading-4 text-slate-600">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-sm border border-blue-500 bg-white"/>
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <PremiumReportCard accent="green" className="p-5">
          <PremiumSectionTitle title="Öğrenci İçin Uygulama Kuralları" eyebrow="Başarı alışkanlıkları" accent="green" className="mb-3"/>
          <ol className="space-y-3 text-[10px] leading-5 text-slate-700">
            <li><strong className="text-green-700">1.</strong> Yanlış soruyu yalnızca okumayın; çözümünü kapatıp yeniden çözün.</li>
            <li><strong className="text-green-700">2.</strong> Aynı konuda üç yanlış varsa kısa konu tekrarı yapın.</li>
            <li><strong className="text-green-700">3.</strong> Her çalışma sonunda doğru, yanlış ve süreyi kaydedin.</li>
            <li><strong className="text-green-700">4.</strong> Haftanın sonunda yalnızca yanlış yapılan sorulara dönün.</li>
          </ol>
        </PremiumReportCard>

        <PremiumReportCard accent="violet" className="p-5">
          <PremiumSectionTitle title="Rehberlik / Öğretmen Notu" eyebrow="Profesyonel takip" accent="violet" className="mb-3"/>
          <div className="h-[150px] rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50"/>
          <div className="mt-3 flex justify-between text-[9px] text-slate-500">
            <span>Tarih: ____ / ____ / ______</span>
            <span>İmza: ____________________</span>
          </div>
        </PremiumReportCard>
      </section>

      <PremiumReportFooter
        brandLine="Analiz et · Planla · Uygula · Geliş"
        reportCode={report.reportCode}
        page={2}
        pageCount={8}
        rightText="Bu sayfa mevcut sınav verilerine göre otomatik hazırlanmıştır."
      />
    </article>
  );
}
