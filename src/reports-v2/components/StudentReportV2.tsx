import React from "react";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";
import "../studentReportV2Print.css";
import { BarChart } from "./BarChart";
import { RadarChart } from "./RadarChart";
import { ProgressRing } from "./ProgressRing";
import { StudentReportV2PremiumPage } from "./StudentReportV2PremiumPage";
import { StudentAcademicDnaPage } from "./StudentAcademicDnaPage";
import { StudentTargetAnalysisPage } from "./StudentTargetAnalysisPage";
import { StudentAiEvaluationPage } from "./StudentAiEvaluationPage";
import { StudentParentSupportPage } from "./StudentParentSupportPage";
import { StudentSuccessPredictionPage } from "./StudentSuccessPredictionPage";
import { StudentTeacherEvaluationPage } from "./StudentTeacherEvaluationPage";
import type { StudentReportV2Data } from "../types";
import { defaultAcademicComments, subjectSuccessRate } from "../utils/reportMath";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumMetricCard } from "../../hasat-core/ui/PremiumMetricCard";
import { PremiumSectionTitle } from "../../hasat-core/ui/PremiumSectionTitle";
import { PremiumStudentHeader } from "../../hasat-core/ui/PremiumStudentHeader";
import { PremiumSubjectCard } from "../../hasat-core/ui/PremiumSubjectCard";
import { PremiumMotivationBanner } from "../../hasat-core/ui/PremiumMotivationBanner";
import { PremiumStatusBadge } from "../../hasat-core/ui/PremiumStatusBadge";

const subjectAccents = ["#2563eb", "#059669", "#7c3aed", "#f97316", "#0891b2", "#e11d48"];
const subjectTones = ["blue", "teal", "violet", "orange", "green", "rose"] as const;

function motivationFor(report: StudentReportV2Data) {
  const rate = report.totals.successRate;
  const strongest = [...report.subjects].sort((a, b) => subjectSuccessRate(b) - subjectSuccessRate(a))[0];
  if (rate >= 85) {
    return {
      emoji: "🏆",
      title: "Harika bir performans!",
      message: `${strongest?.subjectName || "Derslerinde"} gösterdiğin güçlü başarıyı koruyarak hedeflerine daha da yaklaşabilirsin.`,
    };
  }
  if (rate >= 65) {
    return {
      emoji: "🚀",
      title: "Hedefine doğru ilerliyorsun!",
      message: `${strongest?.subjectName || "Güçlü derslerin"} sana iyi bir temel sağlıyor. Öncelikli alanlara düzenli çalışman hızlı gelişim getirecektir.`,
    };
  }
  return {
    emoji: "💪",
    title: "Her sınav yeni bir başlangıçtır.",
    message: "Bu sonuç yalnızca bugünkü durumunu gösterir. Küçük ve düzenli çalışmalarla bir sonraki sınavda belirgin bir gelişim sağlayabilirsin.",
  };
}

export function StudentReportV2({ report }: { report: StudentReportV2Data }) {
  const comments = report.academicComments?.length
    ? report.academicComments
    : defaultAcademicComments(report);
  const motivation = motivationFor(report);

  return (
    <div id="hasat-student-report-v2-document" className="space-y-8 print:space-y-0">
      <article
        id="hasat-student-report-v2"
        className="relative mx-auto box-border min-h-[1588px] w-[1123px] bg-white p-[34px] text-slate-800"
        style={{ fontFamily: "Inter, Arial, sans-serif", WebkitPrintColorAdjust:"exact", printColorAdjust:"exact" }}
      >
        <PremiumStudentHeader
          reportTitle={report.reportTitle}
          examName={report.examName}
          examDate={report.examDate || "-"}
          reportDate={report.reportDate || "-"}
        />

        <section className="mb-5 grid grid-cols-[42%_58%] gap-4">
          <PremiumReportCard accent="blue" className="flex min-h-[220px] gap-5 p-5">
            <div className="h-[180px] w-[135px] shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-blue-100 to-teal-100 shadow-md">
              {report.student.photoUrl ? (
                <img src={report.student.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl font-black text-blue-300">
                  {report.student.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-2">
              <span className="text-[9px] font-black uppercase tracking-[.16em] text-blue-600">Öğrenci Profili</span>
              <h3 className="mt-2 truncate text-[24px] font-black text-[#082f58]">{report.student.name}</h3>
              <dl className="mt-5 space-y-4 text-[11px]">
                {[
                  ["Öğrenci Numarası", report.student.number || "-"],
                  ["Sınıfı", report.student.classroom || "-"],
                  ["Şubesi", report.student.branch || "-"],
                  ["Okulu", report.schoolName],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                    <dt className="font-bold text-slate-400">{label}</dt>
                    <dd className="truncate font-black text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </PremiumReportCard>

          <div className="space-y-4">
            <PremiumReportCard accent="teal" className="grid min-h-[105px] grid-cols-4 divide-x divide-slate-200 px-3 py-3">
              {report.rankings.slice(0, 4).map((item, index) => (
                <div key={item.label} className="flex flex-col items-center justify-center px-3 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wide text-teal-600">{item.label}</span>
                  <strong className="mt-2 text-[30px] font-black text-[#082f58]">{item.rank}{item.rank!=="-"?".":""}</strong>
                  <span className="text-[9px] font-bold text-slate-400">/ {item.participants}</span>
                </div>
              ))}
            </PremiumReportCard>

            <div className="grid min-h-[95px] grid-cols-4 gap-3">
              {[
                ["Puan", report.totals.score?.toFixed(2) || "-", "blue"],
                ["Net", report.totals.net.toFixed(2), "teal"],
                ["Başarı", `%${Math.round(report.totals.successRate)}`, "violet"],
                ["Sınıf Ort.", report.totals.classroomAverageNet?.toFixed(2) || "-", "amber"],
              ].map(([label, value, accent]) => (
                <PremiumMetricCard
                  key={label}
                  label={label}
                  value={value}
                  accent={accent as "blue"|"teal"|"violet"|"amber"}
                />
              ))}
            </div>
          </div>
        </section>

        <PremiumMotivationBanner title={motivation.title} emoji={motivation.emoji}>
          {motivation.message}
        </PremiumMotivationBanner>

        <PremiumSectionTitle
          className="mb-3 mt-5"
          eyebrow="Ders Performansları"
          title="Genel Başarı Özeti"
          accent="blue"
        />

        <section className="mb-3 grid grid-cols-6 gap-3">
          {report.subjects.slice(0, 6).map((subject, index) => {
            const success = subjectSuccessRate(subject);
            return (
              <PremiumSubjectCard
                key={subject.subjectName}
                title={subject.shortName || subject.subjectName}
                successRate={success}
                correct={subject.correct}
                wrong={subject.wrong}
                empty={subject.empty}
                net={subject.net}
                accent={subjectTones[index % subjectTones.length]}
                ring={
                  <ProgressRing
                    value={success}
                    label=""
                    accent={subjectAccents[index % subjectAccents.length]}
                  />
                }
              />
            );
          })}
        </section>

        {report.subjects.length>6&&(
          <PremiumReportCard accent="cyan" className="mb-5 px-4 py-3">
            <PremiumSectionTitle title="Diğer Dersler" eyebrow="Ek sonuçlar" accent="teal" className="mb-3"/>
            <div className="grid grid-cols-4 gap-2">
              {report.subjects.slice(6).map(subject=>(
                <div key={subject.subjectName} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px]">
                  <strong className="max-w-[120px] truncate text-slate-700">{subject.subjectName}</strong>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-teal-700">{subject.net.toFixed(2)} net</span>
                    <PremiumStatusBadge status={subjectSuccessRate(subject)>=75?"success":subjectSuccessRate(subject)>=55?"warning":"risk"}>
                      %{Math.round(subjectSuccessRate(subject))}
                    </PremiumStatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </PremiumReportCard>
        )}

        <section className="mb-5 grid grid-cols-2 gap-4">
          <PremiumReportCard accent="blue" className="p-4">
            <PremiumSectionTitle title="Derslere Göre Başarı Grafiği" eyebrow="Karşılaştırma" accent="blue"/>
            <BarChart subjects={report.subjects} />
          </PremiumReportCard>
          <PremiumReportCard accent="violet" className="p-4">
            <PremiumSectionTitle title="Başarı Radar Grafiği" eyebrow="Akademik profil" accent="violet"/>
            <RadarChart subjects={report.subjects} />
          </PremiumReportCard>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-4">
          <PremiumReportCard accent="teal" className="min-h-[270px] p-5">
            <PremiumSectionTitle title="e-Nstitü Akademik Yorumu" eyebrow="Kişisel değerlendirme" accent="teal"/>

            {report.academicDna&&(() => {
              const strongest=report.academicDna.dimensions
                .slice()
                .sort((a,b)=>b.score-a.score)[0];
              const priority=report.academicDna.dimensions
                .slice()
                .sort((a,b)=>a.score-b.score)[0];
              return (
                <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-teal-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[.15em] text-violet-600">Akademik DNA özeti</span>
                      <div className="mt-1 flex items-end gap-2">
                        <strong className="text-[24px] leading-none text-[#082f58]">{report.academicDna.overallScore.toFixed(1)}</strong>
                        <span className="pb-0.5 text-[9px] font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                      <span className="block text-[8px] font-bold uppercase text-slate-400">Veri güveni</span>
                      <strong className="text-[12px] text-violet-700">{report.academicDna.overallConfidence.toFixed(1)} / 5</strong>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                      <span className="block font-bold text-emerald-600">En güçlü özellik</span>
                      <strong className="mt-0.5 block text-slate-700">{strongest?.label||"Henüz belirlenmedi"}</strong>
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2">
                      <span className="block font-bold text-amber-600">Gelişim önceliği</span>
                      <strong className="mt-0.5 block text-slate-700">{priority?.label||"Henüz belirlenmedi"}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 space-y-2 text-[10px] leading-5 text-slate-600">
              {comments.slice(0,3).map((comment, index) => (
                <p key={index} className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                  <span>{comment}</span>
                </p>
              ))}
            </div>
            <blockquote className="mt-4 rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 px-4 py-3 text-[11px] font-black italic text-[#082f58]">
              “{report.motto || "Başarı, küçük çabaların istikrarlı biçimde birikmesidir."}”
            </blockquote>
          </PremiumReportCard>

          <PremiumReportCard accent="orange" className="min-h-[270px] p-5">
            <PremiumSectionTitle title="Çalışma Önerileri" eyebrow="Bir sonraki adım" accent="orange"/>
            <div className="mt-4 space-y-2">
              {(report.studySuggestions || []).slice(0, 6).map((item, index) => (
                <div key={`${item.subject}-${index}`} className="grid grid-cols-[115px_1fr] items-center rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-3">
                  <strong className="text-[10px] text-orange-800">{item.subject}</strong>
                  <span className="text-[9px] text-slate-600">{item.suggestion}</span>
                </div>
              ))}
            </div>
          </PremiumReportCard>
        </section>

        <PremiumReportFooter
          brandLine="Planlı Çalış · Doğru Analiz · Yüksek Başarı"
          reportCode={report.reportCode || "-"}
          page={1}
          pageCount={8}
        />
      </article>

      <div className="print:break-before-page">
        <StudentReportV2PremiumPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentAcademicDnaPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentTargetAnalysisPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentAiEvaluationPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentParentSupportPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentSuccessPredictionPage report={report}/>
      </div>
      <div className="print:break-before-page">
        <StudentTeacherEvaluationPage report={report}/>
      </div>
    </div>
  );
}
