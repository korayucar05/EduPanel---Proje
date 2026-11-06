import type {BrainEngineInput,BrainFactor,BrainFactorKey} from "./brainTypes";
import {average,clamp,slope,std} from "./brainScoring";
const labels:Record<BrainFactorKey,string>={academicRisk:"Akademik Risk",growthPotential:"Gelişim Potansiyeli",studyDiscipline:"Çalışma Disiplini",targetProximity:"Hedefe Yakınlık",interventionReadiness:"Müdahaleye Açıklık",motivationTrend:"Motivasyon Eğilimi",subjectBalance:"Ders Dengesi",attendanceRisk:"Devamsızlık Riski",emptyQuestionRisk:"Boş Soru Riski",timeManagement:"Süre Yönetimi",fragility:"Kırılganlık",stability:"İstikrar",successMomentum:"Başarı İvmesi",predictionConfidence:"Tahmin Güveni",interventionEffectiveness:"Müdahale Etkinliği"};
const weights:Record<BrainFactorKey,number>={academicRisk:16,growthPotential:12,studyDiscipline:6,targetProximity:7,interventionReadiness:8,motivationTrend:5,subjectBalance:6,attendanceRisk:7,emptyQuestionRisk:7,timeManagement:5,fragility:5,stability:5,successMomentum:5,predictionConfidence:3,interventionEffectiveness:3};
export function buildBrainFactors({report,profile}:BrainEngineInput):BrainFactor[]{
 const subjects=report.subjects||[], rates=subjects.map(s=>Number(s.successRate||0)), total=Math.max(1,report.totals.correct+report.totals.wrong+report.totals.empty), empty=report.totals.empty/total*100, wrong=report.totals.wrong/total*100;
 const nets=profile?.examHistory.map(e=>e.totalNet)??[report.totals.net], sl=slope(nets.slice(-6)), vol=std(nets.slice(-6));
 const recentStudy=profile?.studyHistory.filter(x=>Date.now()-new Date(x.date).getTime()<=28*86400000).reduce((s,x)=>s+x.minutes,0)??0;
 const absence=profile?.attendanceHistory.reduce((s,x)=>s+(x.durationDays||1),0)??0;
 const interventions=profile?.interventionHistory.filter(x=>x.status==="active"||x.status==="completed")??[];
 const observed=interventions.map(x=>x.observedNetGain).filter((x):x is number=>Number.isFinite(x));
 const target=report.targetAnalysis; const targetProx=target?.isDefined?clamp(target.completionRate||0):50;
 const prediction=report.successPrediction; const confidence=prediction?.confidence??(nets.length>=3?70:35);
 const raw:Record<BrainFactorKey,{score:number;direction:"priority"|"strength";evidence:string}>={
  academicRisk:{score:clamp(100-report.totals.successRate),direction:"priority",evidence:`Başarı %${report.totals.successRate.toFixed(1)}`},
  growthPotential:{score:clamp(45+(100-report.totals.successRate)*.45+Math.max(0,sl)*8),direction:"strength",evidence:`İvme ${sl>=0?"+":""}${sl.toFixed(2)} net/sınav`},
  studyDiscipline:{score:recentStudy?clamp(recentStudy/12):50,direction:"strength",evidence:recentStudy?`Son 28 günde ${recentStudy} dk çalışma`:`Çalışma geçmişi sınırlı`},
  targetProximity:{score:targetProx,direction:"strength",evidence:target?.isDefined?`Hedef tamamlama %${targetProx.toFixed(0)}`:`Hedef tanımlı değil`},
  interventionReadiness:{score:clamp((100-report.totals.successRate)*.55+(report.intelligence?.subjectPriorities?.[0]?.suggestedGain||0)*8),direction:"strength",evidence:`Öncelikli gelişim alanı ${report.intelligence?.subjectPriorities?.[0]?.subject||"belirsiz"}`},
  motivationTrend:{score:clamp(50+sl*10),direction:"strength",evidence:`Net eğilimi ${sl>=0?"yukarı":"aşağı"}`},
  subjectBalance:{score:clamp(100-std(rates)*2),direction:"strength",evidence:`Dersler arası sapma ${std(rates).toFixed(1)}`},
  attendanceRisk:{score:clamp(absence*8),direction:"priority",evidence:`Toplam ${absence.toFixed(1)} gün devamsızlık`},
  emptyQuestionRisk:{score:clamp(empty*3),direction:"priority",evidence:`Boş oranı %${empty.toFixed(1)}`},
  timeManagement:{score:clamp(100-empty*2.5),direction:"strength",evidence:`Boş soru ${report.totals.empty}`},
  fragility:{score:clamp(vol*8+wrong*.7),direction:"priority",evidence:`Net oynaklığı ${vol.toFixed(2)}`},
  stability:{score:clamp(100-vol*10),direction:"strength",evidence:`${nets.length} sınav verisi`},
  successMomentum:{score:clamp(50+sl*12),direction:"strength",evidence:`Son dönem eğimi ${sl.toFixed(2)}`},
  predictionConfidence:{score:clamp(confidence),direction:"strength",evidence:`Tahmin güveni %${confidence.toFixed(0)}`},
  interventionEffectiveness:{score:observed.length?clamp(50+average(observed)*12):50,direction:"strength",evidence:observed.length?`Ortalama müdahale etkisi +${average(observed).toFixed(1)} net`:`Müdahale geçmişi sınırlı`},
 };
 return (Object.keys(raw) as BrainFactorKey[]).map(key=>({key,label:labels[key],score:Number(raw[key].score.toFixed(1)),weight:weights[key],contribution:Number((raw[key].score*weights[key]/100).toFixed(2)),direction:raw[key].direction,evidence:raw[key].evidence}));
}
