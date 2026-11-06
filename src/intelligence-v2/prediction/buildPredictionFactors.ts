import type {AcademicDigitalProfile} from "../core/types";
import type {PredictionFactor} from "./types";
import {linearSlope,average} from "../shared/statistics";

export function buildPredictionFactors({
  profile,
  assumedWeeklyStudyMinutes=0,
  assumedAttendanceRisk=0,
  assumedInterventionEffect=0,
}:{
  profile:AcademicDigitalProfile;
  assumedWeeklyStudyMinutes?:number;
  assumedAttendanceRisk?:number;
  assumedInterventionEffect?:number;
}):PredictionFactor[]{
  const factors:PredictionFactor[]=[];
  const nets=profile.examHistory.map(item=>item.totalNet);
  const slope=linearSlope(nets.slice(-6));

  if(nets.length>=2){
    factors.push({
      key:"net-trend",
      title:"Sınav net eğilimi",
      detail:slope>.8
        ?"Son sınavlarda yükselen net eğilimi tahmini destekliyor."
        :slope<-.8
          ?"Son sınavlardaki düşüş tahmini aşağı yönlü etkiliyor."
          :"Net eğilimi büyük ölçüde dengeli.",
      impact:slope>.8?"positive":slope<-.8?"negative":"neutral",
      weight:Math.min(30,Math.abs(slope)*8),
      metric:`${slope>=0?"+":""}${slope.toFixed(2)} net/sınav`,
    });
  }

  const recentStudy=profile.studyHistory
    .filter(item=>new Date(item.date).getTime()>=Date.now()-28*86_400_000)
    .reduce((sum,item)=>sum+item.minutes,0);
  if(recentStudy>0||assumedWeeklyStudyMinutes>0){
    const weekly=assumedWeeklyStudyMinutes||recentStudy/4;
    factors.push({
      key:"study-time",
      title:"Çalışma süresi",
      detail:`Haftalık yaklaşık ${Math.round(weekly)} dakikalık çalışma tahmine dahil edildi.`,
      impact:weekly>=180?"positive":weekly<60?"negative":"neutral",
      weight:Math.min(20,weekly/30),
      metric:`${Math.round(weekly)} dk/hafta`,
    });
  }

  const attendanceDays=profile.attendanceHistory
    .filter(item=>item.type==="unexcused"||item.type==="full-day")
    .reduce((sum,item)=>sum+(item.durationDays||1),0);
  const attendanceRisk=Math.max(attendanceDays,assumedAttendanceRisk);
  if(attendanceRisk>0){
    factors.push({
      key:"attendance",
      title:"Devamsızlık etkisi",
      detail:`Toplam ${attendanceRisk.toFixed(1)} günlük devamsızlık riski tahmini aşağı yönlü etkileyebilir.`,
      impact:attendanceRisk>=5?"negative":"neutral",
      weight:Math.min(25,attendanceRisk*2),
      metric:`${attendanceRisk.toFixed(1)} gün`,
    });
  }

  const activeInterventions=profile.interventionHistory.filter(item=>item.status==="active");
  if(activeInterventions.length||assumedInterventionEffect!==0){
    const expected=activeInterventions.reduce((sum,item)=>sum+(item.expectedNetGain||0),0)+assumedInterventionEffect;
    factors.push({
      key:"intervention",
      title:"Aktif müdahaleler",
      detail:`${activeInterventions.length} aktif müdahalenin beklenen etkisi değerlendirmeye alındı.`,
      impact:expected>0?"positive":expected<0?"negative":"neutral",
      weight:Math.min(30,Math.abs(expected)*5),
      metric:`${expected>=0?"+":""}${expected.toFixed(1)} net`,
    });
  }

  if(profile.parentInteractions.length){
    const scores=profile.parentInteractions
      .map(item=>item.participationScore)
      .filter((value):value is number=>Number.isFinite(value));
    const parentScore=average(scores);
    if(scores.length){
      factors.push({
        key:"parent-participation",
        title:"Veli katılımı",
        detail:"Veli etkileşim geçmişi tahmin güvenine katkı sağlıyor.",
        impact:parentScore>=70?"positive":parentScore<40?"negative":"neutral",
        weight:10,
        metric:`%${parentScore.toFixed(0)}`,
      });
    }
  }

  return factors.sort((a,b)=>b.weight-a.weight).slice(0,8);
}
