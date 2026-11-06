import type {BrainScoreResult} from "../brain";
import type {BrainTimelineResult} from "../timeline";
import {clamp,levelFromScore} from "./warningMath";
import type {StudentEarlyWarning} from "./types";

const factor=(student:BrainScoreResult,key:string)=>
  student.factors.find(item=>item.key===key)?.score;

const factorBelow=(student:BrainScoreResult,threshold:number)=>
  student.factors
    .filter(item=>item.score<threshold)
    .sort((a,b)=>a.score-b.score);

export function buildStudentEarlyWarning({
  student,
  timeline,
}:{
  student:BrainScoreResult;
  timeline?:BrainTimelineResult;
}):StudentEarlyWarning{
  const timelineTrend=timeline?.trend||"insufficient";
  const brainChange=timeline?.brainScoreChange||0;
  const priorityChange=timeline?.priorityScoreChange||0;
  const netChange=timeline?.netChange||0;

  const attendance=factor(student,"attendanceRisk") ?? 60;
  const stability=factor(student,"stability") ?? 60;
  const momentum=factor(student,"successMomentum") ?? 60;
  const timeManagement=factor(student,"timeManagement") ?? 60;
  const emptyRisk=factor(student,"emptyQuestionRisk") ?? 60;
  const interventionReadiness=factor(student,"interventionReadiness") ?? 50;

  let score=
    student.priorityScore*.46+
    (100-stability)*.12+
    (100-momentum)*.10+
    (100-attendance)*.08+
    (100-timeManagement)*.08+
    (100-emptyRisk)*.08+
    (100-interventionReadiness)*.04;

  if(timelineTrend==="falling")score+=12;
  if(timelineTrend==="volatile")score+=7;
  if(priorityChange>10)score+=8;
  if(brainChange<-8)score+=7;
  if(netChange<-3)score+=6;

  const warningScore=clamp(score);
  const predictedWarningLevel=levelFromScore(warningScore);
  const riskIncrease=clamp(
    Math.max(0,priorityChange)*.8+
    Math.max(0,-brainChange)*.6+
    Math.max(0,-netChange)*1.8+
    (timelineTrend==="falling"?12:timelineTrend==="volatile"?6:0),
    0,
    100,
  );

  const reasons:string[]=[];
  if(timelineTrend==="falling")reasons.push("Son sınavlarda düşüş eğilimi var.");
  if(timelineTrend==="volatile")reasons.push("Sınav performansı dalgalı.");
  if(priorityChange>8)reasons.push(`Müdahale önceliği ${priorityChange.toFixed(1)} puan arttı.`);
  if(netChange<-2)reasons.push(`Toplam net ${Math.abs(netChange).toFixed(2)} azaldı.`);
  if(stability<50)reasons.push("Akademik istikrar düşük.");
  if(attendance<50)reasons.push("Devamsızlık riski yükseliyor.");
  if(timeManagement<50)reasons.push("Süre yönetimi zayıf.");
  if(emptyRisk<50)reasons.push("Boş soru riski yüksek.");

  if(!reasons.length){
    for(const item of factorBelow(student,55).slice(0,3)){
      reasons.push(`${item.label} göstergesi düşük (${item.score.toFixed(0)}/100).`);
    }
  }

  const recommendedActions=[
    predictedWarningLevel==="critical"
      ?"Yedi gün içinde öğretmen ve rehberlik görüşmesi planlayın."
      :predictedWarningLevel==="high"
        ?"İki hafta içinde kısa müdahale ve yeniden ölçüm uygulayın."
        :undefined,
    timeManagement<50
      ?"Haftada iki süreli mini deneme uygulayın."
      :undefined,
    emptyRisk<50
      ?"Boş bırakılan soruları ders ve neden bazında inceleyin."
      :undefined,
    attendance<50
      ?"Devamsızlık ve derse katılım verilerini kontrol edin."
      :undefined,
    student.recommendedActions[0],
  ].filter(Boolean) as string[];

  const estimatedCriticalInExams=
    predictedWarningLevel==="critical"
      ?0
      :riskIncrease>=28
        ?1
        :riskIncrease>=15
          ?2
          :undefined;

  return{
    studentId:student.student.id,
    studentName:student.student.name,
    studentNumber:student.student.number,
    classroom:student.student.classroom,
    currentPriorityLevel:student.priorityLevel,
    predictedWarningLevel,
    trend:timelineTrend==="falling"
      ?"worsening"
      :timelineTrend==="rising"
        ?"improving"
        :timelineTrend==="stable"
          ?"stable"
          :timelineTrend==="volatile"
            ?"worsening"
            :"insufficient",
    warningScore:Number(warningScore.toFixed(1)),
    riskIncrease:Number(riskIncrease.toFixed(1)),
    estimatedCriticalInExams,
    reasons:reasons.slice(0,5),
    recommendedActions:[...new Set(recommendedActions)].slice(0,5),
    confidence:Math.round(clamp(
      student.confidence*.65+
      (timeline?.confidence||35)*.35
    )),
  };
}
