import React from "react";
import type { StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

const warningStatus={low:"success",medium:"warning",high:"risk"} as const;

export function StudentSuccessPredictionPage({report}:{report:StudentReportV2Data}){
  const prediction=report.successPrediction;
  if(!prediction)return null;

  const range=Math.max(1,prediction.upperNet-prediction.lowerNet);
  const currentPosition=(prediction.currentNet-prediction.lowerNet)/range*100;
  const expectedPosition=(prediction.expectedNet-prediction.lowerNet)/range*100;
  const trajectory=prediction.trajectory||[];
  const values=trajectory.map(item=>item.net);
  const minValue=Math.min(...values,prediction.lowerNet);
  const maxValue=Math.max(...values,prediction.upperNet);
  const chartRange=Math.max(1,maxValue-minValue);
  const points=trajectory.map((item,index)=>({
    ...item,
    x:trajectory.length<=1?50:(index/(trajectory.length-1))*100,
    y:88-((item.net-minValue)/chartRange)*72,
  }));
  const polyline=points.map(item=>`${item.x},${item.y}`).join(" ");
  const riskStatus=prediction.riskLevel==="low"?"success":prediction.riskLevel==="medium"?"warning":"risk";

  return (
    <article
      id="hasat-student-report-v2-prediction"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow="e-Nstitü · Başarı Tahmin ve Erken Risk Motoru 2.0"
        title="Bir Sonraki Sınav İçin Başarı Öngörüsü"
        subtitle="Geçmiş eğilim, Akademik DNA, hata dağılımı ve çalışma fırsatlarına dayalı erken uyarı"
        sideTitle={report.student.name}
        sideDetail={`${prediction.trendLabel} · Risk ${prediction.riskLabel}`}
        accent="navy"
      />

      <section className="mb-5 grid grid-cols-4 gap-4">
        <PremiumMetricCard label="Mevcut Net" value={prediction.currentNet.toFixed(2)} accent="blue"/>
        <PremiumMetricCard label="Beklenen Net" value={prediction.expectedNet.toFixed(2)} accent="teal"/>
        <PremiumMetricCard label="Erken Risk" value={`${Math.round(prediction.riskIndex)}/100`} accent={prediction.riskLevel==="low"?"green":prediction.riskLevel==="medium"?"amber":"rose"}/>
        <PremiumMetricCard label="Müdahale Zamanı" value={prediction.interventionWindow} accent="violet"/>
      </section>

      <section className="mb-5 grid grid-cols-[1.15fr_.85fr] gap-4">
        <PremiumReportCard accent="blue" className="p-5">
          <PremiumSectionTitle
            title="Başarı Eğilimi"
            eyebrow="Son sınavlardan bir sonraki sınava"
            accent="blue"
            action={<PremiumStatusBadge status={prediction.confidence>=70?"success":prediction.confidence>=50?"warning":"risk"}>Güven %{Math.round(prediction.confidence)}</PremiumStatusBadge>}
            className="mb-3"
          />
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4">
            <svg viewBox="0 0 100 100" className="h-[190px] w-full overflow-visible" preserveAspectRatio="none" aria-label="Başarı eğilim grafiği">
              {[16,34,52,70,88].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#dbeafe" strokeWidth=".5"/>) }
              {points.length>1&&<polyline points={polyline} fill="none" stroke="#0f5f8f" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/>}
              {points.map((item,index)=><g key={`${item.label}-${index}`}>
                <circle cx={item.x} cy={item.y} r={item.kind==="forecast"?2.7:2.1} fill={item.kind==="forecast"?"#0d9488":item.kind==="current"?"#082f58":"#3b82f6"} vectorEffect="non-scaling-stroke"/>
                <text x={item.x} y={Math.max(8,item.y-6)} textAnchor="middle" fontSize="3.6" fontWeight="800" fill="#334155">{item.net.toFixed(1)}</text>
                <text x={item.x} y="98" textAnchor="middle" fontSize="3.3" fontWeight="700" fill="#64748b">{item.label}</text>
              </g>)}
            </svg>
          </div>
          <p className="mt-3 text-[9px] font-semibold leading-5 text-slate-700">{prediction.summary}</p>
        </PremiumReportCard>

        <PremiumReportCard accent={prediction.riskLevel==="low"?"green":prediction.riskLevel==="medium"?"amber":"rose"} className="p-5">
          <PremiumSectionTitle title="Erken Risk Kararı" eyebrow="Müdahale önceliği" accent={prediction.riskLevel==="low"?"green":prediction.riskLevel==="medium"?"amber":"rose"} className="mb-4"/>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Risk Seviyesi</span>
              <strong className="mt-1 block text-[28px] font-black text-[#082f58]">{prediction.riskLabel}</strong>
            </div>
            <PremiumStatusBadge status={riskStatus}>{Math.round(prediction.riskIndex)}/100</PremiumStatusBadge>
          </div>
          <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <span className="text-[9px] font-black uppercase tracking-wide text-violet-500">Önerilen müdahale</span>
            <strong className="mt-2 block text-[15px] text-violet-900">{prediction.interventionWindow}</strong>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Tahmin aralığı</span>
            <div className="mt-2 flex items-end justify-between">
              <strong className="text-[18px] text-rose-700">{prediction.lowerNet.toFixed(2)}</strong>
              <span className="text-[9px] font-bold text-slate-400">net</span>
              <strong className="text-[18px] text-emerald-700">{prediction.upperNet.toFixed(2)}</strong>
            </div>
          </div>
        </PremiumReportCard>
      </section>

      <PremiumReportCard accent="rose" className="mb-5 p-5">
        <PremiumSectionTitle title="Erken Uyarı Sinyalleri" eyebrow="Neden ve yapılacak ilk işlem" accent="rose" className="mb-4"/>
        <div className="grid grid-cols-2 gap-3">
          {prediction.earlyWarnings.slice(0,4).map((warning,index)=>(
            <div key={`${warning.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <strong className="text-[10px] text-[#082f58]">{warning.title}</strong>
                <PremiumStatusBadge status={warningStatus[warning.level]}>{warning.level==="high"?"Yüksek":warning.level==="medium"?"Orta":"Düşük"}</PremiumStatusBadge>
              </div>
              <p className="mt-2 text-[9px] leading-5 text-slate-600">{warning.detail}</p>
              <div className="mt-3 rounded-xl border border-white bg-white px-3 py-2 text-[9px] font-semibold leading-4 text-slate-700">
                <span className="font-black text-rose-700">İlk işlem: </span>{warning.action}
              </div>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <section className="mb-5 grid grid-cols-3 gap-4">
        {prediction.scenarios.map(scenario=>{
          const accent=scenario.label==="Gelişim"?"green":scenario.label==="Risk"?"rose":"blue";
          const status=scenario.label==="Gelişim"?"success":scenario.label==="Risk"?"risk":"info";
          return (
            <PremiumReportCard key={scenario.label} accent={accent} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">{scenario.label} Senaryosu</span>
                  <strong className="mt-2 block text-[24px] font-black text-[#082f58]">{scenario.predictedNet.toFixed(2)} net</strong>
                </div>
                <PremiumStatusBadge status={status}>%{scenario.probability}</PremiumStatusBadge>
              </div>
              <p className="mt-3 text-[9px] leading-5 text-slate-600">{scenario.description}</p>
            </PremiumReportCard>
          );
        })}
      </section>

      <PremiumReportCard accent="violet" className="mb-5 p-4">
        <PremiumSectionTitle title="Tahmini Etkileyen Faktörler" eyebrow="Açıklanabilir karar" accent="violet" className="mb-3"/>
        <div className="grid grid-cols-4 gap-3">
          {prediction.drivers.map(driver=>(
            <div key={driver.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-[9px] text-[#082f58]">{driver.title}</strong>
                <PremiumStatusBadge status={driver.impact==="positive"?"success":driver.impact==="negative"?"risk":"neutral"}>{driver.impact==="positive"?"+":driver.impact==="negative"?"−":"="}</PremiumStatusBadge>
              </div>
              <p className="mt-2 text-[8px] leading-4 text-slate-600">{driver.detail}</p>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
        <strong className="block text-[9px] font-black text-amber-800">Kullanım sınırı</strong>
        <p className="mt-1 text-[8px] leading-4 text-amber-900">{prediction.disclaimer}</p>
      </div>

      <PremiumReportFooter
        brandLine="Erken fark et · Zamanında destekle · Gelişimi izle"
        reportCode={report.reportCode}
        page={7}
        pageCount={8}
        rightText="e-Nstitü Başarı Tahmin ve Erken Risk Motoru 2.0"
      />
    </article>
  );
}
