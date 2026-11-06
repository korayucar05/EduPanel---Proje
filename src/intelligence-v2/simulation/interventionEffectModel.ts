import type {
  InterventionEffectBreakdown,
  InterventionScenario,
} from "./types";

const clamp=(value:number,min:number,max:number)=>
  Math.max(min,Math.min(max,value));

export function estimateInterventionEffects(
  scenario:InterventionScenario,
):InterventionEffectBreakdown[]{
  const effects:InterventionEffectBreakdown[]=[];

  if(scenario.weeklyStudyMinutes>0){
    const hours=scenario.weeklyStudyMinutes/60;
    const effect=clamp(hours*.42,0,5.5);
    effects.push({
      key:"weekly-study",
      title:"Haftalık çalışma süresi",
      netEffect:Number(effect.toFixed(2)),
      confidence:72,
      explanation:`Haftalık ${Math.round(scenario.weeklyStudyMinutes)} dakikalık düzenli çalışma için kontrollü net artışı öngörüldü.`,
    });
  }

  if(scenario.extraLessonMinutes>0){
    const effect=clamp(scenario.extraLessonMinutes/60*.55,0,4.5);
    effects.push({
      key:"extra-lesson",
      title:"Etüt / ek ders",
      netEffect:Number(effect.toFixed(2)),
      confidence:76,
      explanation:`Haftalık ${Math.round(scenario.extraLessonMinutes)} dakikalık etüt desteğinin hedefli öğrenmeye katkısı hesaplandı.`,
    });
  }

  if(scenario.mockExamPerMonth>0){
    const effect=clamp(scenario.mockExamPerMonth*.28,0,2.5);
    effects.push({
      key:"mock-exam",
      title:"Deneme sıklığı",
      netEffect:Number(effect.toFixed(2)),
      confidence:68,
      explanation:`Ayda ${scenario.mockExamPerMonth} deneme; süre yönetimi, sınav dayanıklılığı ve hata farkındalığı etkisiyle değerlendirildi.`,
    });
  }

  if(scenario.guidanceSessionsPerMonth>0){
    const effect=clamp(scenario.guidanceSessionsPerMonth*.18,0,1.4);
    effects.push({
      key:"guidance",
      title:"Rehberlik görüşmesi",
      netEffect:Number(effect.toFixed(2)),
      confidence:58,
      explanation:`Ayda ${scenario.guidanceSessionsPerMonth} rehberlik görüşmesinin plan ve motivasyon üzerindeki dolaylı etkisi hesaba katıldı.`,
    });
  }

  if(scenario.parentMeetingsPerMonth>0){
    const effect=clamp(scenario.parentMeetingsPerMonth*.12,0,1);
    effects.push({
      key:"parent-meeting",
      title:"Veli görüşmesi",
      netEffect:Number(effect.toFixed(2)),
      confidence:52,
      explanation:`Ayda ${scenario.parentMeetingsPerMonth} veli görüşmesinin takip ve düzen üzerindeki destekleyici etkisi değerlendirildi.`,
    });
  }

  if(scenario.dailyQuestionTarget>0){
    const effect=clamp(scenario.dailyQuestionTarget/50*.8,0,3.2);
    effects.push({
      key:"daily-question",
      title:"Günlük soru hedefi",
      netEffect:Number(effect.toFixed(2)),
      confidence:64,
      explanation:`Günlük ${scenario.dailyQuestionTarget} soruluk hedefin düzenli uygulanması varsayımıyla net etkisi tahmin edildi.`,
    });
  }

  if(scenario.attendanceRiskDays>0){
    const effect=-clamp(scenario.attendanceRiskDays*.32,0,6);
    effects.push({
      key:"attendance-risk",
      title:"Devamsızlık riski",
      netEffect:Number(effect.toFixed(2)),
      confidence:78,
      explanation:`${scenario.attendanceRiskDays.toFixed(1)} günlük devamsızlık riskinin öğrenme sürekliliğine olumsuz etkisi hesaba katıldı.`,
    });
  }

  return effects;
}

export function totalInterventionNetEffect(
  effects:InterventionEffectBreakdown[],
){
  const raw=effects.reduce((sum,item)=>sum+item.netEffect,0);
  const positive=effects.filter(item=>item.netEffect>0).length;
  const diminishingFactor=positive>3?.88:positive>1?.95:1;
  return Number((raw*diminishingFactor).toFixed(2));
}
