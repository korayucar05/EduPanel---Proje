import React from "react";
import type { StudentReportV2Data } from "../types";
import { PremiumReportHeader } from "../../hasat-core/ui/PremiumReportHeader";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";

const statusLabel={
  "not-started":"Başlamadı",
  "in-progress":"Takipte",
  "completed":"Tamamlandı",
};

export function StudentTeacherEvaluationPage({report}:{report:StudentReportV2Data}){
  const evaluation=report.teacherEvaluation||{};
  const hasContent=Boolean(
    evaluation.observation ||
    evaluation.recommendation ||
    evaluation.studentCommitment ||
    evaluation.parentContactNote
  );
  const status=evaluation.followUpStatus||"not-started";

  return (
    <article
      id="hasat-student-report-v2-teacher"
      className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
      style={{fontFamily:"Inter, Arial, sans-serif",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}
    >
      <PremiumReportHeader
        eyebrow="e-Nstitü · Öğretmen Değerlendirme Alanı 1.0"
        title="Öğretmen Görüşü ve Akademik Takip Formu"
        subtitle="İnsan uzmanlığı ile veri analizinin birleştiği son değerlendirme katmanı"
        sideTitle={report.student.name}
        sideDetail={evaluation.teacherName||"Öğretmen değerlendirmesi"}
        accent="violet"
      />

      <section className="mb-5 grid grid-cols-4 gap-4">
        <PremiumReportCard accent="blue" className="p-4">
          <span className="text-[8px] font-black uppercase text-slate-400">Öğretmen</span>
          <strong className="mt-2 block text-[14px] text-[#082f58]">{evaluation.teacherName||"-"}</strong>
          <span className="mt-1 block text-[9px] text-slate-500">{evaluation.teacherTitle||"-"}</span>
        </PremiumReportCard>
        <PremiumReportCard accent="teal" className="p-4">
          <span className="text-[8px] font-black uppercase text-slate-400">Değerlendirme Tarihi</span>
          <strong className="mt-2 block text-[14px] text-[#082f58]">{evaluation.evaluationDate||"-"}</strong>
        </PremiumReportCard>
        <PremiumReportCard accent="amber" className="p-4">
          <span className="text-[8px] font-black uppercase text-slate-400">Sonraki Kontrol</span>
          <strong className="mt-2 block text-[14px] text-[#082f58]">{evaluation.nextReviewDate||"-"}</strong>
        </PremiumReportCard>
        <PremiumReportCard accent={status==="completed"?"green":status==="in-progress"?"amber":"rose"} className="p-4">
          <span className="text-[8px] font-black uppercase text-slate-400">Takip Durumu</span>
          <div className="mt-3">
            <PremiumStatusBadge status={status==="completed"?"success":status==="in-progress"?"warning":"risk"}>
              {statusLabel[status]}
            </PremiumStatusBadge>
          </div>
        </PremiumReportCard>
      </section>

      {!hasContent?(
        <PremiumReportCard accent="amber" className="mb-5 p-10 text-center">
          <div className="text-[48px]">🖋️</div>
          <h2 className="mt-4 text-[22px] font-black text-[#082f58]">Öğretmen değerlendirmesi henüz girilmedi</h2>
          <p className="mx-auto mt-3 max-w-[690px] text-[11px] leading-6 text-slate-600">
            Karne ön izleme ekranındaki “Öğretmen Notu” düğmesinden gözlem, öneri, öğrenci taahhüdü ve veli iletişim notu girildiğinde bu sayfa otomatik olarak tamamlanacaktır.
          </p>
        </PremiumReportCard>
      ):(
        <>
          <section className="mb-5 grid grid-cols-2 gap-4">
            <PremiumReportCard accent="blue" className="min-h-[260px] p-5">
              <PremiumSectionTitle title="Öğretmen Gözlemi" eyebrow="Mevcut akademik durum" accent="blue" className="mb-4"/>
              <p className="whitespace-pre-wrap text-[11px] leading-6 text-slate-700">{evaluation.observation||"-"}</p>
            </PremiumReportCard>

            <PremiumReportCard accent="teal" className="min-h-[260px] p-5">
              <PremiumSectionTitle title="Öğretmen Önerisi" eyebrow="Uygulanabilir müdahale" accent="teal" className="mb-4"/>
              <p className="whitespace-pre-wrap text-[11px] leading-6 text-slate-700">{evaluation.recommendation||"-"}</p>
            </PremiumReportCard>
          </section>

          <section className="mb-5 grid grid-cols-2 gap-4">
            <PremiumReportCard accent="green" className="min-h-[210px] p-5">
              <PremiumSectionTitle title="Öğrenci Taahhüdü" eyebrow="Bir sonraki kontrole kadar" accent="green" className="mb-4"/>
              <p className="whitespace-pre-wrap text-[10px] leading-6 text-slate-700">{evaluation.studentCommitment||"-"}</p>
            </PremiumReportCard>

            <PremiumReportCard accent="orange" className="min-h-[210px] p-5">
              <PremiumSectionTitle title="Veli İletişim Notu" eyebrow="Okul–veli iş birliği" accent="orange" className="mb-4"/>
              <p className="whitespace-pre-wrap text-[10px] leading-6 text-slate-700">{evaluation.parentContactNote||"-"}</p>
            </PremiumReportCard>
          </section>
        </>
      )}

      <PremiumReportCard accent="violet" className="mb-5 p-6">
        <PremiumSectionTitle title="İmza ve Onay" eyebrow="Değerlendirmenin tamamlanması" accent="violet" className="mb-5"/>
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="h-[85px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"/>
            <strong className="mt-3 block text-[10px] text-[#082f58]">Öğrenci</strong>
            <span className="text-[8px] text-slate-400">İmza</span>
          </div>
          <div>
            <div className="h-[85px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"/>
            <strong className="mt-3 block text-[10px] text-[#082f58]">Veli</strong>
            <span className="text-[8px] text-slate-400">İmza</span>
          </div>
          <div>
            <div className="flex h-[85px] items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 px-4">
              <span className="text-[11px] font-black italic text-violet-800">{evaluation.signatureText||""}</span>
            </div>
            <strong className="mt-3 block text-[10px] text-[#082f58]">{evaluation.teacherName||"Öğretmen"}</strong>
            <span className="text-[8px] text-slate-400">İmza / Onay</span>
          </div>
        </div>
      </PremiumReportCard>

      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
        <strong className="block text-[10px] font-black text-blue-800">Profesyonel kullanım notu</strong>
        <p className="mt-2 text-[9px] leading-5 text-blue-900">
          Bu alan, otomatik analizlerin yerine geçmez; öğrenciyi tanıyan öğretmenin gözlemini sisteme ekler. Notlar ölçülebilir, yapıcı ve öğrencinin gelişimine yönelik yazılmalıdır.
        </p>
      </div>

      <PremiumReportFooter
        brandLine="Veriyi öğretmen gözlemiyle tamamla"
        reportCode={report.reportCode}
        page={8}
        pageCount={8}
        rightText="e-Nstitü Öğretmen Değerlendirme 1.0"
      />
    </article>
  );
}
