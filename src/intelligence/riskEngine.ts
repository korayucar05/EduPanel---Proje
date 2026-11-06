import type {AcademicDnaProfile,SubjectPerformance,SuccessPrediction} from "../reports-v2/types";
import type {IntelligenceRisk,SubjectPriority} from "./types";

const rate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ?Number(subject.successRate)
  :subject.totalQuestions?subject.correct/subject.totalQuestions*100:0;

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

export function buildSubjectPriorities(subjects:SubjectPerformance[]):SubjectPriority[]{
  return [...subjects]
    .sort((a,b)=>rate(a)-rate(b))
    .slice(0,5)
    .map((subject,index)=>{
      const successRate=rate(subject);
      const suggestedGain=Math.max(0,(70-successRate)/100*Math.max(4,subject.totalQuestions*.45));
      const priority=(index===0?1:index<3?2:3) as 1|2|3;
      const weeklyMinutes=priority===1?120:priority===2?90:60;
      return{
        subject:subject.subjectName,
        priority,
        successRate:Number(successRate.toFixed(1)),
        net:Number(subject.net.toFixed(2)),
        suggestedGain:Number(suggestedGain.toFixed(2)),
        reason:successRate<45
          ?"Başarı oranı kritik eşik altında."
          :successRate<60
            ?"Temel kazanımlarda düzenli destek gerekli."
            :"Hedef artışı için kontrollü geliştirme alanı.",
        weeklyMinutes,
      };
    });
}

export function buildAcademicRisks({
  subjects,
  totals,
  academicDna,
  prediction,
}:{
  subjects:SubjectPerformance[];
  totals:{correct:number;wrong:number;empty:number;net:number;successRate:number};
  academicDna:AcademicDnaProfile;
  prediction:SuccessPrediction;
}):IntelligenceRisk[]{
  const risks:IntelligenceRisk[]=[];
  const responses=Math.max(1,totals.correct+totals.wrong+totals.empty);
  const wrongRate=totals.wrong/responses*100;
  const emptyRate=totals.empty/responses*100;
  const weakest=[...subjects].sort((a,b)=>rate(a)-rate(b))[0];

  if(emptyRate>=15){
    risks.push({
      key:"time-management",
      title:"Süre yönetimi riski",
      detail:`Soruların %${emptyRate.toFixed(1)}'i boş bırakılmıştır.`,
      level:emptyRate>=25?"high":"medium",
      metric:`%${emptyRate.toFixed(1)} boş`,
      action:"Haftada iki kez süreli mini deneme ve boş soru analizi yapılmalı.",
    });
  }

  if(wrongRate>=28){
    risks.push({
      key:"wrong-pattern",
      title:"Yanlış soru yoğunluğu",
      detail:`Yanlış oranı %${wrongRate.toFixed(1)} düzeyindedir.`,
      level:wrongRate>=40?"high":"medium",
      metric:`%${wrongRate.toFixed(1)} yanlış`,
      action:"Yanlışlar bilgi, işlem ve dikkat kaynaklı olarak sınıflandırılmalı.",
    });
  }

  if(weakest&&rate(weakest)<45){
    risks.push({
      key:`subject-${weakest.subjectName}`,
      title:`${weakest.subjectName} öncelikli risk alanı`,
      detail:`Ders başarı oranı %${rate(weakest).toFixed(1)} ve net ${weakest.net.toFixed(2)} düzeyindedir.`,
      level:rate(weakest)<30?"high":"medium",
      metric:`%${rate(weakest).toFixed(1)}`,
      action:"Kısa konu tekrarı, hedefli soru çözümü ve haftalık kontrol uygulanmalı.",
    });
  }

  const attention=academicDna.dimensions.find(item=>item.key==="attention");
  if(attention&&attention.score<50){
    risks.push({
      key:"attention",
      title:"Dikkat göstergesi düşük",
      detail:`Akademik DNA dikkat puanı ${Math.round(attention.score)} olarak hesaplandı.`,
      level:attention.score<35?"high":"medium",
      metric:`${Math.round(attention.score)}/100`,
      action:"Kısa çalışma blokları ve işlem sonu kontrol rutini uygulanmalı.",
    });
  }

  if(prediction.trendLabel==="Dalgalı"){
    risks.push({
      key:"trend",
      title:"Başarı eğilimi dalgalı",
      detail:prediction.summary,
      level:"medium",
      action:"Haftalık görev tamamlama ve sınav netleri birlikte izlenmeli.",
    });
  }

  return risks.slice(0,5);
}

export function buildIntelligenceSummary({
  totals,
  risks,
  priorities,
  prediction,
}:{
  totals:{net:number;successRate:number};
  risks:IntelligenceRisk[];
  priorities:SubjectPriority[];
  prediction:SuccessPrediction;
}){
  const high=risks.filter(item=>item.level==="high").length;
  const medium=risks.filter(item=>item.level==="medium").length;
  const status=high>0?"attention":medium>1?"attention":totals.successRate>=70?"strong":"balanced";
  const headline=status==="strong"
    ?"Akademik görünüm güçlü"
    :status==="attention"
      ?"Öncelikli müdahale alanları var"
      :"Akademik görünüm dengeli";
  const priority=priorities[0];
  const detail=[
    `Mevcut net ${totals.net.toFixed(2)}, başarı oranı %${totals.successRate.toFixed(1)}.`,
    priority?`İlk çalışma önceliği ${priority.subject}.`:"",
    prediction.dataScope==="multi-exam"
      ?`Eğilim ${prediction.trendLabel.toLocaleLowerCase("tr-TR")}.`
      :"Geçmiş sınav sayısı tahmin için henüz sınırlı.",
  ].filter(Boolean).join(" ");
  return{status,headline,detail} as const;
}
