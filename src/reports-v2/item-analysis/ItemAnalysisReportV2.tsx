import React from "react";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";
import { PremiumStatusCard } from "../../hasat-core/ui/PremiumStatusCard";
import { PremiumActionPlan } from "../../hasat-core/ui/PremiumActionPlan";
import { ChartLegend } from "../../hasat-core/ui/ChartLegend";
import type { ItemAnalysisReportData } from "./buildItemAnalysisReportData";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumInsightBanner } from "../../hasat-core/ui/PremiumInsightBanner";

export function ItemAnalysisReportV2({report}:{report:ItemAnalysisReportData}){
  const maxCount=Math.max(1,...report.items.map(item=>item.totalResponses));
  return <div id="hasat-item-analysis-report-v2" className="space-y-6 bg-slate-100 p-6 text-slate-800">
    <section className="mx-auto min-h-[1123px] w-[1588px] bg-white p-8">
      <PremiumReportHeader
        eyebrow="e-Nstitü · Madde Analiz Merkezi"
        title="Madde Analizi V2 Premium"
        subtitle={`${report.schoolName} · ${report.examName}`}
        sideTitle={report.selectedSubject}
        sideDetail={report.generatedAt}
        accent="violet"
      />

      <section className="mb-5 grid grid-cols-6 gap-3">
        {[
          ["Soru",report.summary.totalQuestions],
          ["Öğrenci",report.summary.studentCount],
          ["Ort. Doğru",`%${report.summary.averageCorrectRate.toFixed(1)}`],
          ["Zor Soru",report.summary.difficultQuestionCount],
          ["Çok Kolay",report.summary.easyQuestionCount],
          ["Yüksek Boş",report.summary.highEmptyQuestionCount],
        ].map(([label,value],index)=>{
          const accents=["blue","teal","violet","orange","rose","amber"] as const;
          return <PremiumMetricCard key={String(label)} label={label} value={value} accent={accents[index]}/>;
        })}
      <PremiumReportFooter
        brandLine="e-Nstitü · Madde Analiz Merkezi"
        reportCode={report.examName}
        page={1}
        pageCount={2}
      />
    </section>

      <PremiumInsightBanner eyebrow="e-Nstitü AI Madde Sonucu" accent="violet" className="mb-5">
        {report.executiveSummary}
      </PremiumInsightBanner>

      <PremiumReportCard className="mb-5 p-5">
        <h2 className="mb-4 text-[14px] font-black">Soru Başarı Haritası</h2>
        {report.items.length?<div className="grid grid-cols-10 gap-2">
          {report.items.map(item=>{
            const style=item.qualityLevel==="risk"?"border-rose-300 bg-rose-50 text-rose-800":item.qualityLevel==="warning"?"border-amber-300 bg-amber-50 text-amber-800":"border-emerald-300 bg-emerald-50 text-emerald-800";
            return <div key={item.questionNumber} className={`rounded-xl border p-3 text-center ${style}`}>
              <strong className="block text-[11px]">{item.questionNumber}. Soru</strong>
              <span className="mt-1 block text-[16px] font-black">%{item.correctRate.toFixed(1)}</span>
              <span className="mt-1 block text-[8px] font-bold">{item.difficultyLabel}</span>
            </div>;
          })}
        </div>:<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] font-semibold text-amber-800">Soru bazlı öğrenci cevapları bulunamadı. Optik cevapların ve cevap anahtarının sonuç kayıtlarına eklenmesi gerekir.</p>}
      </PremiumReportCard>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <PremiumReportCard className="p-5">
          <h2 className="mb-3 text-[14px] font-black">En Zor 10 Soru</h2>
          <div className="space-y-2">
            {report.hardestItems.map(item=><div key={item.questionNumber} className="grid grid-cols-[70px_1fr_70px_70px] items-center rounded-lg bg-rose-50 px-3 py-2 text-[10px]">
              <strong>{item.questionNumber}. Soru</strong>
              <div className="h-2 overflow-hidden rounded-full bg-rose-100"><div className="h-full bg-rose-600" style={{width:`${Math.max(2,item.correctRate)}%`}}/></div>
              <span className="text-right font-black">%{item.correctRate.toFixed(1)}</span>
              <span className="text-right text-slate-500">Boş %{item.emptyRate.toFixed(1)}</span>
            </div>)}
          </div>
        </PremiumReportCard>
        <PremiumReportCard className="p-5">
          <h2 className="mb-3 text-[14px] font-black">En Kolay 10 Soru</h2>
          <div className="space-y-2">
            {report.easiestItems.map(item=><div key={item.questionNumber} className="grid grid-cols-[70px_1fr_70px_70px] items-center rounded-lg bg-emerald-50 px-3 py-2 text-[10px]">
              <strong>{item.questionNumber}. Soru</strong>
              <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-emerald-600" style={{width:`${Math.max(2,item.correctRate)}%`}}/></div>
              <span className="text-right font-black">%{item.correctRate.toFixed(1)}</span>
              <span className="text-right text-slate-500">Boş %{item.emptyRate.toFixed(1)}</span>
            </div>)}
          </div>
        </PremiumReportCard>
      <PremiumReportFooter
        brandLine={`${report.schoolName} · ${report.selectedSubject}`}
        page={2}
        pageCount={2}
        rightText="Soru kalite ve madde değerlendirme raporu"
      />
    </section>

      <PremiumReportCard className="p-5">
        <h2 className="mb-4 text-[14px] font-black">Dikkat Alanları</h2>
        <div className="grid grid-cols-4 gap-3">
          {report.attentionItems.map((item,index)=>(
          <PremiumStatusCard key={index} status={item.level} title={item.title}>
            {item.detail}
          </PremiumStatusCard>
        ))}
        </div>
      </PremiumReportCard>
    </section>

    <section className="mx-auto min-h-[1123px] w-[1588px] bg-white p-8">
      <header className="mb-5">
        <span className="text-[10px] font-black uppercase tracking-[.18em] text-violet-700">Detaylı Soru Analizi</span>
        <h2 className="mt-2 text-[24px] font-black">{report.selectedSubject} · Seçenek Dağılımları</h2>
      </header>

      <PremiumReportCard className="mb-5 overflow-hidden">
        <table className="w-full border-collapse text-[9px]">
          <thead className="bg-slate-900 text-white">
            <tr>{["Soru","Doğru","Yanlış","Boş","Başarı","Zorluk","A","B","C","D","E"].map(item=><th key={item} className="px-3 py-3 text-left">{item}</th>)}</tr>
          </thead>
          <tbody>
            {report.items.slice(0,40).map((item,index)=><tr key={item.questionNumber} className={index%2?"bg-slate-50":"bg-white"}>
              <td className="px-3 py-2 font-black">{item.questionNumber}</td>
              <td className="px-3 py-2">{item.correctCount}</td>
              <td className="px-3 py-2">{item.wrongCount}</td>
              <td className="px-3 py-2">{item.emptyCount}</td>
              <td className="px-3 py-2 font-black">%{item.correctRate.toFixed(1)}</td>
              <td className="px-3 py-2">{item.difficultyLabel}</td>
              {item.optionStats.map(option=><td key={option.option} className="px-3 py-2">{option.count} <span className="text-slate-400">(%{option.rate.toFixed(0)})</span></td>)}
            </tr>)}
          </tbody>
        </table>
      </PremiumReportCard>

      <PremiumActionPlan
        items={report.actionPlan}
        title="e-Nstitü AI Madde Eylem Planı"
        eyebrow="Soru kalitesi öncelikleri"
        accent="violet"
      />
    </section>
  </div>;
}
