import type {SubjectPerformance} from "../../reports-v2/types";
import {buildAcademicDigitalProfileFromReports} from "../profile/profileBuilder";
import {runBrainScoreEngine} from "../brain";
import {average,clamp,confidenceFrom,deviation,slope,statusFor} from "./dnaMath";
import type {AcademicDna2Cohort,AcademicDna2Dimension,AcademicDna2Input,AcademicDna2Key,AcademicDna2Result,AcademicDnaArchetype} from "./dnaTypes";

const rate=(s:SubjectPerformance)=>Number.isFinite(Number(s.successRate))
  ?Number(s.successRate)
  :s.totalQuestions?s.correct/s.totalQuestions*100:0;
const subjectGroup=(name:string)=>name.toLocaleLowerCase("tr-TR");
const groupAverage=(subjects:SubjectPerformance[],terms:string[])=>{
  const values=subjects
    .filter(s=>terms.some(t=>subjectGroup(s.subjectName).includes(t)))
    .map(rate);
  return values.length?average(values):undefined;
};

const recommendation:Record<AcademicDna2Key,string>={
  learningSpeed:"Yeni konuyu kısa tekrar ve aynı gün hedefli sorularla pekiştirin.",
  knowledgeRetention:"Aralıklı tekrar ve haftalık geri çağırma çalışması uygulayın.",
  attention:"Kısa çalışma blokları ve işlem sonu kontrol rutini kullanın.",
  examEndurance:"Süreli mini denemelerle sınav dayanıklılığını artırın.",
  consistency:"Haftalık sabit çalışma ve kontrol günü belirleyin.",
  analyticalThinking:"Çok adımlı problem ve neden-sonuç sorularına ağırlık verin.",
  readingInterpretation:"Paragraf, metin çözümleme ve kanıt bulma çalışması yapın.",
  problemSolving:"Yanlışları bilgi, yöntem ve işlem hatası olarak sınıflandırın.",
  timeManagement:"Soru başına süre hedefi ve tur tekniği uygulayın.",
  subjectBalance:"Zayıf derslere küçük fakat düzenli ek süre ayırın.",
  growthMomentum:"Yükselişi korumak için erişilebilir kısa dönem hedefleri kullanın.",
  studyDiscipline:"Çalışma kaydı ve günlük görev tamamlama takibi başlatın.",
};
const label:Record<AcademicDna2Key,string>={
  learningSpeed:"Öğrenme Hızı",
  knowledgeRetention:"Bilgi Kalıcılığı",
  attention:"Dikkat",
  examEndurance:"Sınav Dayanıklılığı",
  consistency:"İstikrar",
  analyticalThinking:"Analitik Düşünme",
  readingInterpretation:"Okuma ve Yorumlama",
  problemSolving:"Problem Çözme",
  timeManagement:"Süre Yönetimi",
  subjectBalance:"Ders Dengesi",
  growthMomentum:"Gelişim İvmesi",
  studyDiscipline:"Çalışma Disiplini",
};

function archetype(dimensions:AcademicDna2Dimension[]):AcademicDnaArchetype{
  const map=Object.fromEntries(dimensions.map(item=>[item.key,item.score])) as Record<AcademicDna2Key,number>;
  if(map.analyticalThinking>=75&&map.growthMomentum>=65)return"Analitik Yükseliş";
  if(map.consistency>=72&&map.subjectBalance>=68)return"Dengeli ve İstikrarlı";
  if(map.learningSpeed>=72&&map.consistency<52)return"Hızlı fakat Kırılgan";
  if(map.attention<48)return"Dikkat Odaklı Gelişim";
  if(map.growthMomentum>=62||map.problemSolving>=65)return"Potansiyeli Yüksek";
  return"Temel Güçlendirme";
}

export function runAcademicDnaEngine2(input:AcademicDna2Input):AcademicDna2Result{
  const {report}=input;
  const profile=input.profile||buildAcademicDigitalProfileFromReports([report]);
  const brain=input.brain||runBrainScoreEngine({report,profile});
  const subjects=report.subjects||[];
  const rates=subjects.map(rate);
  const history=profile.examHistory;
  const nets=history.map(item=>item.totalNet);
  const netSlope=slope(nets.slice(-6));
  const volatility=deviation(nets.slice(-6));
  const total=Math.max(1,report.totals.correct+report.totals.wrong+report.totals.empty);
  const emptyRate=report.totals.empty/total*100;
  const wrongRate=report.totals.wrong/total*100;
  const studyMinutes=profile.studyHistory
    .filter(item=>Date.now()-new Date(item.date).getTime()<=28*86_400_000)
    .reduce((sum,item)=>sum+item.minutes,0);
  const verbal=groupAverage(subjects,["türk","edeb","tarih","coğraf","felse"]);
  const quantitative=groupAverage(subjects,["matem","fizik","kimya","biyoloji"]);
  const previous=report.academicDna?.dimensions||[];
  const old=(key:string)=>previous.find(item=>item.key===key)?.score;

  const raw:Record<AcademicDna2Key,{score:number;trend:number;evidence:string[]}>={
    learningSpeed:{
      score:clamp(52+netSlope*9+(brain.potentialScore-50)*.25),
      trend:netSlope,
      evidence:[`${history.length} sınav verisi`,`Net eğimi ${netSlope>=0?"+":""}${netSlope.toFixed(2)}`],
    },
    knowledgeRetention:{
      score:clamp(68-volatility*7+Math.max(0,netSlope)*4),
      trend:-volatility,
      evidence:[`Net oynaklığı ${volatility.toFixed(2)}`,history.length>=3?"Çoklu sınav kalıcılık göstergesi":"Geçmiş veri sınırlı"],
    },
    attention:{
      score:clamp(old("attention")??100-wrongRate*1.5-emptyRate*.7),
      trend:-wrongRate/10,
      evidence:[`Yanlış oranı %${wrongRate.toFixed(1)}`,`Boş oranı %${emptyRate.toFixed(1)}`],
    },
    examEndurance:{
      score:clamp(100-emptyRate*2.4-volatility*3),
      trend:-emptyRate/10,
      evidence:[`${report.totals.empty} boş soru`,`Sonuç istikrarı ${Math.max(0,100-volatility*10).toFixed(0)}/100`],
    },
    consistency:{
      score:clamp(old("consistency")??100-volatility*10),
      trend:-volatility,
      evidence:[`${history.length} sınav kaydı`,`Oynaklık ${volatility.toFixed(2)}`],
    },
    analyticalThinking:{
      score:clamp(old("analyticalThinking")??quantitative??average(rates)),
      trend:netSlope,
      evidence:[quantitative!==undefined?`Sayısal ders ortalaması %${quantitative.toFixed(1)}`:"Genel ders performansı kullanıldı"],
    },
    readingInterpretation:{
      score:clamp(old("readingInterpretation")??verbal??average(rates)),
      trend:netSlope,
      evidence:[verbal!==undefined?`Sözel ders ortalaması %${verbal.toFixed(1)}`:"Genel ders performansı kullanıldı"],
    },
    problemSolving:{
      score:clamp(old("problemSolving")??(quantitative!==undefined?quantitative-wrongRate*.25:report.totals.successRate-wrongRate*.15)),
      trend:netSlope,
      evidence:[`Başarı %${report.totals.successRate.toFixed(1)}`,`Yanlış oranı %${wrongRate.toFixed(1)}`],
    },
    timeManagement:{
      score:clamp(old("timeManagement")??100-emptyRate*2.7),
      trend:-emptyRate/10,
      evidence:[`Boş oranı %${emptyRate.toFixed(1)}`,`${total} soru üzerinden hesaplandı`],
    },
    subjectBalance:{
      score:clamp(old("branchBalance")??100-deviation(rates)*2),
      trend:-deviation(rates)/10,
      evidence:[`Dersler arası sapma ${deviation(rates).toFixed(1)}`],
    },
    growthMomentum:{
      score:clamp(50+netSlope*13),
      trend:netSlope,
      evidence:[`Son dönem net eğimi ${netSlope>=0?"+":""}${netSlope.toFixed(2)}`,brain.expectedGain?`+${brain.expectedGain.toFixed(1)} net fırsatı`:"Kazanç fırsatı sınırlı"],
    },
    studyDiscipline:{
      score:clamp(studyMinutes?studyMinutes/12:brain.factors.find(item=>item.key==="studyDiscipline")?.score??45),
      trend:0,
      evidence:[studyMinutes?`Son 28 günde ${studyMinutes} dakika çalışma`:"Çalışma kaydı henüz sınırlı"],
    },
  };

  const confidence=confidenceFrom(
    history.length,
    subjects.length+profile.studyHistory.length+profile.teacherObservations.length,
  );
  const dimensions=(Object.keys(raw) as AcademicDna2Key[]).map(key=>({
    key,
    label:label[key],
    score:Number(raw[key].score.toFixed(1)),
    confidence:Number(clamp(confidence+(raw[key].evidence.length-1)*2,25,98).toFixed(0)),
    status:statusFor(raw[key].score),
    trend:Number(raw[key].trend.toFixed(2)),
    evidence:raw[key].evidence,
    recommendation:recommendation[key],
  }));
  const overallScore=Number(average(dimensions.map(item=>item.score)).toFixed(1));
  const profileType=archetype(dimensions);
  const strengths=dimensions
    .filter(item=>item.status==="signature"||item.status==="strong")
    .sort((a,b)=>b.score-a.score)
    .slice(0,4)
    .map(item=>item.label);
  const priorities=dimensions
    .filter(item=>item.status==="priority"||item.status==="developing")
    .sort((a,b)=>a.score-b.score)
    .slice(0,4)
    .map(item=>item.label);

  return{
    version:"2.0",
    generatedAt:new Date().toISOString(),
    student:{
      id:profile.student.id,
      name:profile.student.name,
      number:profile.student.number,
      classroom:profile.student.classroom||profile.student.branch,
    },
    overallScore,
    confidence:Number(confidence.toFixed(0)),
    archetype:profileType,
    dimensions,
    signatureStrengths:strengths,
    developmentPriorities:priorities,
    summary:`${profileType} profili. DNA skoru ${overallScore}/100. Güçlü alanlar: ${strengths.join(", ")||"henüz belirgin değil"}. Öncelikler: ${priorities.join(", ")||"düzenli izleme"}.`,
    disclaimer:"Akademik DNA, mevcut e-Nstitü verilerinden üretilen açıklanabilir bir karar destek profilidir; psikolojik tanı veya kesin yetenek ölçümü değildir.",
  };
}

export function buildAcademicDnaCohort(inputs:AcademicDna2Input[]):AcademicDna2Cohort{
  const profiles=inputs.map(runAcademicDnaEngine2);
  const archetypeMap=new Map<AcademicDnaArchetype,number>();
  profiles.forEach(profile=>archetypeMap.set(profile.archetype,(archetypeMap.get(profile.archetype)||0)+1));
  const keys=profiles[0]?.dimensions.map(item=>item.key)||[];

  return{
    generatedAt:new Date().toISOString(),
    totalStudents:profiles.length,
    averageScore:Number(average(profiles.map(profile=>profile.overallScore)).toFixed(1)),
    averageConfidence:Number(average(profiles.map(profile=>profile.confidence)).toFixed(1)),
    archetypes:[...archetypeMap.entries()]
      .map(([name,count])=>({name,count,ratio:Number((count/Math.max(1,profiles.length)*100).toFixed(1))}))
      .sort((a,b)=>b.count-a.count),
    dimensionSummary:keys.map(key=>{
      const dimensions=profiles
        .map(profile=>profile.dimensions.find(item=>item.key===key))
        .filter((item):item is AcademicDna2Dimension=>Boolean(item));
      return{
        key,
        label:label[key],
        average:Number(average(dimensions.map(item=>item.score)).toFixed(1)),
        priorityCount:dimensions.filter(item=>item.status==="priority").length,
        strongCount:dimensions.filter(item=>item.status==="signature"||item.status==="strong").length,
      };
    }).sort((a,b)=>a.average-b.average),
    profiles:profiles.sort((a,b)=>a.overallScore-b.overallScore),
  };
}
