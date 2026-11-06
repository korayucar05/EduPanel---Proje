import type {StudentReportV2Data} from "../../reports-v2/types";
import {detectSubject,parseAdvisorQuery} from "./queryParser";
import type {
  AdvisorAnswer,
  AdvisorAudience,
  AdvisorSourceBundle,
  AdvisorSuggestion,
} from "./types";

const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

const studentLabel=(report:StudentReportV2Data)=>
  `${report.student.name}${report.student.classroom?` (${report.student.classroom})`:""}`;

export const defaultAdvisorSuggestions:Record<AdvisorAudience,AdvisorSuggestion[]>={
  admin:[
    {label:"En riskli sınıf",query:"En riskli sınıf hangisi?"},
    {label:"Acil öğrenciler",query:"Acil müdahale gereken öğrenciler kimler?"},
    {label:"Ortak ders riski",query:"Okul genelinde hangi derste risk var?"},
    {label:"Bu haftanın önceliği",query:"Bu hafta yönetimin önceliği ne olmalı?"},
  ],
  teacher:[
    {label:"Riskli öğrenciler",query:"Riskli öğrenciler kimler?"},
    {label:"Ders öncelikleri",query:"Bu hafta ders önceliği ne olmalı?"},
    {label:"Matematik riski",query:"Matematikte zorlanan öğrenciler kimler?"},
    {label:"Destek grubu",query:"Planlı destek gereken öğrenciler kimler?"},
  ],
  student:[
    {label:"Durumum",query:"Bu öğrencinin durumu nedir?"},
    {label:"Önceliğim",query:"Bu hafta önceliğim ne olmalı?"},
  ],
  parent:[
    {label:"Çocuğumun durumu",query:"Bu öğrencinin durumu nedir?"},
    {label:"Destek önerisi",query:"Bu hafta ne yapmalıyız?"},
  ],
};

const availableSubjects=(reports:StudentReportV2Data[])=>[
  ...new Set(reports.flatMap(report=>report.subjects.map(subject=>subject.subjectName))),
];

const unknownAnswer=(
  audience:AdvisorAudience,
  query:string,
):AdvisorAnswer=>({
  version:"1.0",
  generatedAt:new Date().toISOString(),
  audience,
  query,
  intent:"unknown",
  title:"Soruyu henüz yorumlayamadım",
  answer:"Soruyu okul, sınıf, öğrenci riski, ders riski veya haftalık öncelik üzerinden yeniden yazın.",
  evidence:[],
  actions:[
    "Örneğin: En riskli sınıf hangisi?",
    "Örneğin: Matematikte zorlanan öğrenciler kimler?",
  ],
  confidence:35,
  matchedEntities:{},
});

export function askHasatAdvisor({
  query,
  audience,
  sources,
}:{
  query:string;
  audience:AdvisorAudience;
  sources:AdvisorSourceBundle;
}):AdvisorAnswer{
  const parsed=parseAdvisorQuery(query);
  const reports=sources.reports||[];
  const subjects=availableSubjects(reports);
  const subject=detectSubject(parsed.normalized,subjects);

  if(parsed.intent==="risk-class"&&sources.admin){
    const top=sources.admin.classroomRisks[0];
    if(!top)return unknownAnswer(audience,query);
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title:`En riskli sınıf: ${top.classroom}`,
      answer:`${top.classroom} sınıfı ${top.riskScore}/100 risk puanıyla ilk sıradadır. Sınıfta ${top.urgentCount} acil ve ${top.supportCount} destek grubunda öğrenci bulunmaktadır.`,
      evidence:[
        `Başarı ortalaması %${top.averageSuccessRate}`,
        `Ortalama net ${top.averageNet}`,
        `${top.studentCount} öğrenci değerlendirildi`,
      ],
      actions:[
        "Sınıf rehber öğretmeniyle öğrenci bazlı risk listesini inceleyin.",
        "Öncelikli dersler için branş öğretmenleriyle kısa müdahale planı oluşturun.",
      ],
      confidence:92,
      matchedEntities:{classroom:top.classroom},
    };
  }

  if(parsed.intent==="risk-students"){
    const students=sources.teacher?.urgentStudents
      ||sources.admin?.urgentStudents
      ||[];
    const top=students.slice(0,10);
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title:"Acil müdahale gereken öğrenciler",
      answer:top.length
        ?`${top.length} öncelikli öğrenci listelendi: ${top.map(item=>item.studentName).join(", ")}.`
        :"Mevcut veride acil müdahale grubunda öğrenci bulunmuyor.",
      evidence:top.map(item=>
        `${item.studentName}: ${item.score}/100 karar puanı · ${item.primaryRisk?.title||item.headline}`
      ),
      actions:top.length?[
        "İlk 5 öğrenci için bir hafta içinde öğretmen görüşmesi planlayın.",
        "Her öğrenciye takip tarihi ve sorumlu öğretmen atayın.",
      ]:["Aylık erken uyarı kontrolünü sürdürün."],
      confidence:90,
      matchedEntities:{},
    };
  }

  if(parsed.intent==="subject-risk"){
    const selectedSubject=subject||sources.admin?.subjectRisks[0]?.subject;
    if(!selectedSubject)return unknownAnswer(audience,query);

    const matching=reports
      .map(report=>{
        const subjectResult=report.subjects.find(item=>item.subjectName===selectedSubject);
        return subjectResult?{report,subjectResult}:null;
      })
      .filter(Boolean) as Array<{
        report:StudentReportV2Data;
        subjectResult:StudentReportV2Data["subjects"][number];
      }>;

    const risky=matching
      .filter(item=>Number(item.subjectResult.successRate||0)<55)
      .sort((a,b)=>Number(a.subjectResult.successRate||0)-Number(b.subjectResult.successRate||0));

    const avg=average(matching.map(item=>Number(item.subjectResult.successRate||0)));

    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title:`${selectedSubject} risk görünümü`,
      answer:`${selectedSubject} dersinde ortalama başarı %${avg.toFixed(1)}. ${risky.length} öğrenci %55 başarı eşiğinin altındadır.`,
      evidence:risky.slice(0,10).map(item=>
        `${studentLabel(item.report)}: %${Number(item.subjectResult.successRate||0).toFixed(1)} · ${item.subjectResult.net.toFixed(2)} net`
      ),
      actions:[
        `${selectedSubject} için ortak kazanım ve soru analizi yapın.`,
        "Başarı eşiği altındaki öğrenciler için kısa hedefli çalışma grubu oluşturun.",
      ],
      confidence:88,
      matchedEntities:{subject:selectedSubject},
    };
  }

  if(parsed.intent==="priority"){
    const alert=sources.admin?.alerts[0];
    const hotspot=sources.teacher?.subjectHotspots[0];
    const studentPriority=reports[0]?.intelligence?.subjectPriorities?.[0];

    const title=alert?.title||(
      hotspot?`${hotspot.subject} öncelikli ders alanı`:
      studentPriority?`${studentPriority.subject} ilk çalışma önceliği`:
      "Bu haftanın önceliği"
    );
    const answer=alert?.detail||(
      hotspot
        ?`${hotspot.subject}, ${hotspot.studentCount} öğrencide öncelikli alan olarak görülüyor.`
        :studentPriority
          ?`${studentPriority.subject} için haftada ${studentPriority.weeklyMinutes} dakika hedefli çalışma öneriliyor.`
          :"Mevcut veride belirgin bir ortak öncelik oluşmadı."
    );

    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title,
      answer,
      evidence:[
        alert?.metric,
        hotspot?`Ortalama başarı %${hotspot.averageSuccessRate}`:undefined,
        studentPriority?`Tahmini +${studentPriority.suggestedGain.toFixed(1)} net fırsatı`:undefined,
      ].filter(Boolean) as string[],
      actions:[
        alert?.recommendedAction,
        hotspot?`${hotspot.subject} için ortak çalışma planı hazırlayın.`:undefined,
        studentPriority?studentPriority.reason:undefined,
      ].filter(Boolean) as string[],
      confidence:84,
      matchedEntities:{subject:hotspot?.subject||studentPriority?.subject},
    };
  }

  if(parsed.intent==="school-summary"&&sources.admin){
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title:sources.admin.executiveSummary.headline,
      answer:sources.admin.executiveSummary.detail,
      evidence:[
        `${sources.admin.urgentStudentCount} acil öğrenci`,
        `${sources.admin.supportStudentCount} destek öğrencisi`,
        `Genel başarı %${sources.admin.schoolAverageSuccessRate}`,
        `Ortalama net ${sources.admin.schoolAverageNet}`,
      ],
      actions:sources.admin.alerts.slice(0,3).map(item=>item.recommendedAction),
      confidence:94,
      matchedEntities:{},
    };
  }

  if(parsed.intent==="student-summary"&&reports.length){
    const report=reports[0];
    const summary=report.intelligence?.summary;
    const topPriority=report.intelligence?.subjectPriorities?.[0];
    const topRisk=report.intelligence?.risks?.[0];

    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      audience,
      query,
      intent:parsed.intent,
      title:summary?.headline||`${report.student.name} akademik özeti`,
      answer:summary?.detail||`${report.student.name} için başarı oranı %${report.totals.successRate.toFixed(1)}, toplam net ${report.totals.net.toFixed(2)}.`,
      evidence:[
        topRisk?.detail,
        topPriority?`${topPriority.subject}: ilk çalışma önceliği`:undefined,
      ].filter(Boolean) as string[],
      actions:[
        topRisk?.action,
        topPriority?`${topPriority.subject} için haftada ${topPriority.weeklyMinutes} dakika çalışma.`:undefined,
      ].filter(Boolean) as string[],
      confidence:86,
      matchedEntities:{studentName:report.student.name,subject:topPriority?.subject},
    };
  }

  return unknownAnswer(audience,query);
}
