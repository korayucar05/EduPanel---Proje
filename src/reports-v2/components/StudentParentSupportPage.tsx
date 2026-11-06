import React from "react";
import type { StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

export function StudentParentSupportPage({report}:{report:StudentReportV2Data}){
  const parent=report.parentSupport;
  if(!parent)return null;

  return (
    <article
      id="hasat-student-report-v2-parent"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow="e-Nstitü · Veli Destek Asistanı 1.0"
        title="Veli Özeti ve Ev Destek Planı"
        subtitle="Teknik verilerin sade, anlaşılır ve uygulanabilir özeti"
        sideTitle={report.student.name}
        sideDetail={`${report.examName} · ${report.reportCode}`}
        accent="green"
      />

      <PremiumReportCard accent="green" className="mb-5 p-6">
        <PremiumSectionTitle title="Sayın Veli" eyebrow="Genel değerlendirme" accent="green" className="mb-4"/>
        <p className="text-[12px] font-semibold leading-7 text-slate-700">{parent.summary}</p>

        {parent.academicSnapshot&&(
          <div className="mt-5 grid grid-cols-[150px_1fr_1fr] gap-3 rounded-2xl border border-green-100 bg-gradient-to-r from-green-50 via-white to-teal-50 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm">
              <div>
                <span className="block text-[8px] font-black uppercase tracking-wide text-green-600">Akademik DNA</span>
                <strong className="mt-1 block text-[24px] leading-none text-[#082f58]">{parent.academicSnapshot.dnaScore}</strong>
              </div>
              <div className="ml-auto text-right">
                <span className="block text-[8px] font-bold text-slate-400">Güven</span>
                <strong className="text-[11px] text-teal-700">{parent.academicSnapshot.confidence}/5</strong>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-3">
              <span className="block text-[8px] font-black uppercase text-emerald-600">Güçlü akademik özellik</span>
              <strong className="mt-1 block text-[10px] text-emerald-900">{parent.academicSnapshot.strongestDimension}</strong>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-3">
              <span className="block text-[8px] font-black uppercase text-amber-600">Öncelikli gelişim alanı</span>
              <strong className="mt-1 block text-[10px] text-amber-900">{parent.academicSnapshot.priorityDimension}</strong>
              <span className="mt-1 block text-[8px] font-semibold text-slate-500">{parent.academicSnapshot.statusLabel}</span>
            </div>
          </div>
        )}
      </PremiumReportCard>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <PremiumReportCard accent="green" className="p-5">
          <PremiumSectionTitle title="Güçlü Yönler" eyebrow="Korunması gerekenler" accent="green" className="mb-4"/>
          <div className="space-y-3">
            {(parent.strengths.length?parent.strengths:["Henüz belirgin güçlü alan yok"]).map((item,index)=>(
              <div key={item} className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-[10px] font-black text-white">{index+1}</span>
                <span className="text-[10px] font-bold text-green-900">{item}</span>
              </div>
            ))}
          </div>
        </PremiumReportCard>

        <PremiumReportCard accent="rose" className="p-5">
          <PremiumSectionTitle title="Gelişim Alanları" eyebrow="Evde desteklenebilecekler" accent="rose" className="mb-4"/>
          <div className="space-y-3">
            {(parent.developmentAreas.length?parent.developmentAreas:["Düzenli çalışma alışkanlığının korunması"]).map((item,index)=>(
              <div key={item} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white">{index+1}</span>
                <span className="text-[10px] font-bold text-rose-900">{item}</span>
              </div>
            ))}
          </div>
        </PremiumReportCard>
      </section>

      <PremiumReportCard accent="blue" className="mb-5 p-5">
        <PremiumSectionTitle title="Evde Nasıl Destek Olabilirsiniz?" eyebrow="Baskısız ve yapıcı takip" accent="blue" className="mb-4"/>
        <div className="grid grid-cols-2 gap-3">
          {parent.homeSupportActions.map((item,index)=>(
            <div key={item.title} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <strong className="text-[10px] text-[#082f58]">{index+1}. {item.title}</strong>
                <PremiumStatusBadge status="info">{item.frequency}</PremiumStatusBadge>
              </div>
              <p className="mt-3 text-[9px] leading-5 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <PremiumReportCard accent="violet" className="mb-5 p-5">
        <PremiumSectionTitle title="Bir Aylık Veli Takip Planı" eyebrow="Hafta hafta kontrol" accent="violet" className="mb-4"/>
        <div className="grid grid-cols-4 gap-3">
          {parent.monthlyCheckpoints.map((item,index)=>(
            <div key={item.week} className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index+1}</span>
              <strong className="mt-3 block text-[10px] text-violet-900">{item.week}</strong>
              <span className="mt-2 block text-[9px] font-black text-[#082f58]">{item.focus}</span>
              <p className="mt-3 text-[8px] leading-4 text-slate-600"><strong>Veli görevi:</strong> {item.parentAction}</p>
              <p className="mt-2 text-[8px] leading-4 text-green-700"><strong>Başarı göstergesi:</strong> {item.successIndicator}</p>
            </div>
          ))}
        </div>
      </PremiumReportCard>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <PremiumReportCard accent="teal" className="p-5">
          <PremiumSectionTitle title="Evde Konuşma Rehberi" eyebrow="Sor · destekle · kıyaslama" accent="teal" className="mb-3"/>
          {parent.conversationGuide?(
            <div className="space-y-2 text-[9px] leading-5">
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-blue-900"><strong>Sorun:</strong> “{parent.conversationGuide.ask}”</div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900"><strong>Söyleyin:</strong> “{parent.conversationGuide.say}”</div>
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-900"><strong>Kaçının:</strong> {parent.conversationGuide.avoid}</div>
            </div>
          ):(
            <p className="text-[10px] leading-6 text-slate-700">{parent.communicationNote}</p>
          )}
        </PremiumReportCard>

        <PremiumReportCard accent="amber" className="p-5">
          <PremiumSectionTitle title="Çocuğunuza Söyleyebileceğiniz Cümle" eyebrow="Olumlu destek" accent="amber" className="mb-3"/>
          <blockquote className="rounded-xl bg-amber-50 px-4 py-4 text-[11px] font-black italic leading-6 text-amber-900">
            “{parent.encouragementMessage}”
          </blockquote>
          <p className="mt-3 text-[8px] leading-4 text-slate-500"><strong>Okul–veli notu:</strong> {parent.communicationNote}</p>
        </PremiumReportCard>
      </section>

      <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
        <strong className="block text-[10px] font-black text-rose-800">Önemli kullanım notu</strong>
        <p className="mt-2 text-[9px] leading-5 text-rose-900">{parent.disclaimer}</p>
      </div>

      <PremiumReportFooter
        brandLine="Destekle · Güven ver · Gelişimi birlikte izle"
        reportCode={report.reportCode}
        page={6}
        pageCount={8}
        rightText="e-Nstitü Veli Destek Asistanı 1.0"
      />
    </article>
  );
}
