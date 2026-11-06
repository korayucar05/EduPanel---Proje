import React from "react";
import type { AcademicDnaDimension, StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

const statusColor=(status:AcademicDnaDimension["status"])=>
  status==="strong"?"#16a34a":status==="developing"?"#f59e0b":"#e11d48";

function ConfidenceStars({value}:{value:number}){
  return (
    <span className="tracking-[2px] text-amber-500">
      {"★".repeat(value)}<span className="text-slate-200">{"★".repeat(5-value)}</span>
    </span>
  );
}

function DnaRadar({dimensions}:{dimensions:AcademicDnaDimension[]}){
  const items=dimensions.slice(0,8);
  const center=150;
  const radius=100;
  const count=Math.max(3,items.length);
  const point=(index:number,r:number)=>{
    const angle=-Math.PI/2+Math.PI*2*index/count;
    return [center+Math.cos(angle)*r,center+Math.sin(angle)*r];
  };
  const grids=[.25,.5,.75,1].map(factor=>
    Array.from({length:count},(_,index)=>point(index,radius*factor).join(",")).join(" ")
  );
  const values=items.map((item,index)=>point(index,radius*item.score/100).join(",")).join(" ");

  return (
    <svg viewBox="0 0 300 300" className="h-[315px] w-full">
      <defs>
        <linearGradient id="dnaFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity=".38"/>
          <stop offset="52%" stopColor="#7c3aed" stopOpacity=".30"/>
          <stop offset="100%" stopColor="#059669" stopOpacity=".38"/>
        </linearGradient>
      </defs>
      {grids.map((points,index)=>(
        <polygon key={index} points={points} fill={index%2?"none":"rgba(37,99,235,.025)"} stroke="#dbe5f1"/>
      ))}
      {items.map((_,index)=>{
        const [x,y]=point(index,radius);
        return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="#dbe5f1"/>;
      })}
      <polygon points={values} fill="url(#dnaFill)" stroke="#2563eb" strokeWidth="3"/>
      {items.map((item,index)=>{
        const [x,y]=point(index,radius*item.score/100);
        return <circle key={`p-${item.key}`} cx={x} cy={y} r="5" fill={statusColor(item.status)} stroke="#fff" strokeWidth="2"/>;
      })}
      {items.map((item,index)=>{
        const [x,y]=point(index,radius+28);
        return (
          <g key={item.key}>
            <text x={x} y={y-3} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#475569">
              {item.label.length>18?item.label.slice(0,17)+"…":item.label}
            </text>
            <text x={x} y={y+9} textAnchor="middle" fontSize="9" fontWeight="900" fill={statusColor(item.status)}>
              {Math.round(item.score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StudentAcademicDnaPage({report}:{report:StudentReportV2Data}){
  const dna=report.academicDna;
  if(!dna)return null;

  return (
    <article
      id="hasat-student-report-v2-dna"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow="e-Nstitü · Akademik DNA 1.0"
        title="Öğrencinin Akademik Öğrenme Profili"
        subtitle={`${report.examName} · açıklanabilir gösterge sistemi`}
        sideTitle={report.student.name}
        sideDetail={dna.dataScope==="single-exam"?"Tek sınav ön profili":"Çoklu sınav gelişim profili"}
        accent="blue"
      />

      <section className="mb-5 grid grid-cols-3 gap-4">
        <PremiumMetricCard label="DNA Genel Skoru" value={dna.overallScore.toFixed(1)} accent="blue"/>
        <PremiumMetricCard label="Veri Güveni" value={`${dna.overallConfidence.toFixed(1)} / 5`} accent="amber"/>
        <PremiumMetricCard label="Analiz Boyutu" value={dna.dimensions.length} accent="violet"/>
      </section>

      <section className="mb-5 grid grid-cols-[44%_56%] gap-4">
        <PremiumReportCard accent="violet" className="p-5">
          <PremiumSectionTitle title="Akademik DNA Haritası" eyebrow="Bütüncül görünüm" accent="violet"/>
          <DnaRadar dimensions={dna.dimensions}/>
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[9px] font-semibold leading-4 text-blue-900">
            {dna.summary}
          </p>
        </PremiumReportCard>

        <PremiumReportCard accent="blue" className="p-5">
          <PremiumSectionTitle title="DNA Bileşenleri" eyebrow="Puan, güven ve kanıt" accent="blue" className="mb-4"/>
          <div className="space-y-3">
            {dna.dimensions.map(item=>(
              <div key={item.key} className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-3">
                <div className="grid grid-cols-[150px_1fr_62px] items-center gap-3">
                  <div>
                    <strong className="block text-[10px] text-[#082f58]">{item.label}</strong>
                    <span className="mt-1 block text-[8px] text-slate-400">
                      Güven: <ConfidenceStars value={item.confidence}/>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:`${Math.max(3,item.score)}%`,
                        background:`linear-gradient(90deg,#2563eb,${statusColor(item.status)})`,
                      }}
                    />
                  </div>
                  <div className="text-right">
                    <strong className="block text-[18px] font-black" style={{color:statusColor(item.status)}}>
                      {Math.round(item.score)}
                    </strong>
                    <PremiumStatusBadge status={item.status==="strong"?"success":item.status==="developing"?"warning":"risk"}>
                      {item.status==="strong"?"Güçlü":item.status==="developing"?"Gelişiyor":"Öncelikli"}
                    </PremiumStatusBadge>
                  </div>
                </div>
                <p className="mt-2 border-t border-slate-100 pt-2 text-[8px] leading-4 text-slate-500">
                  {item.evidence}
                </p>
              </div>
            ))}
          </div>
        </PremiumReportCard>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <PremiumReportCard accent="green" className="p-5">
          <PremiumSectionTitle title="Güçlü Akademik Alanlar" eyebrow="Korunması gerekenler" accent="green" className="mb-4"/>
          <div className="space-y-3">
            {(dna.strengths.length?dna.strengths:["Henüz belirgin güçlü alan yok"]).map((item,index)=>(
              <div key={item} className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[10px] font-bold text-green-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white">{index+1}</span>
                {item}
              </div>
            ))}
          </div>
        </PremiumReportCard>

        <PremiumReportCard accent="rose" className="p-5">
          <PremiumSectionTitle title="Gelişim Öncelikleri" eyebrow="Bir sonraki odak" accent="rose" className="mb-4"/>
          <div className="space-y-3">
            {dna.priorities.map((item,index)=>(
              <div key={item} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white">{index+1}</span>
                {item}
              </div>
            ))}
          </div>
        </PremiumReportCard>
      </section>

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <strong className="block text-[10px] font-black text-amber-800">Bilimsel kullanım notu</strong>
        <p className="mt-2 text-[9px] leading-5 text-amber-900">{dna.disclaimer}</p>
        {dna.dataScope==="single-exam"&&(
          <p className="mt-2 text-[9px] leading-5 text-amber-900">
            Bu sürüm tek sınava dayalı bir ön profildir. Yeni sınavlar eklendikçe istikrar, gelişim hızı ve zaman yönetimi göstergelerinin güven düzeyi artacaktır.
          </p>
        )}
      </div>

      <PremiumReportFooter
        brandLine="Potansiyeli ölç · Gelişimi yönet · Başarıyı hasat et"
        reportCode={report.reportCode}
        page={3}
        pageCount={8}
        rightText="e-Nstitü Akademik DNA 1.0"
      />
    </article>
  );
}
