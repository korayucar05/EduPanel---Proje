import type {TeacherCohortDecision,TeacherDecision,TeacherDecisionInput,TeacherInterventionLevel} from "./types";

const riskWeight={high:38,medium:20,low:8} as const;
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

const levelFromScore=(score:number):TeacherInterventionLevel=>
  score>=65?"urgent":score>=35?"support":"monitor";

export function buildTeacherDecision(input:TeacherDecisionInput):TeacherDecision{
  const risks=input.intelligence?.risks||[];
  const priorities=input.intelligence?.subjectPriorities||[];
  const highCount=risks.filter(risk=>risk.level==="high").length;
  const mediumCount=risks.filter(risk=>risk.level==="medium").length;
  const baseRisk=risks.reduce((sum,risk)=>sum+riskWeight[risk.level],0);
  const lowSuccess=Math.max(0,55-Number(input.totals.successRate||0))*.7;
  const emptyPenalty=input.totals.empty>0
    ?Math.min(18,input.totals.empty/Math.max(1,input.totals.correct+input.totals.wrong+input.totals.empty)*100*.5)
    :0;
  const score=clamp(Math.round(baseRisk+lowSuccess+emptyPenalty));
  const level=levelFromScore(score);
  const primaryRisk=risks[0];
  const primaryPriority=priorities[0];

  const recommendedActions=[
    primaryRisk?.action,
    primaryPriority
      ?`${primaryPriority.subject} dersi için haftada ${primaryPriority.weeklyMinutes} dakika hedefli çalışma planlayın.`
      :undefined,
    highCount>0
      ?"Bir hafta içinde kısa öğretmen görüşmesi ve yeni kontrol tarihi belirleyin."
      :mediumCount>0
        ?"İki hafta içinde gelişimi tekrar ölçün."
        :"Mevcut çalışma düzenini koruyup aylık kontrol yapın.",
  ].filter(Boolean) as string[];

  const headline=level==="urgent"
    ?"Hızlı öğretmen müdahalesi gerekli"
    :level==="support"
      ?"Planlı akademik destek öneriliyor"
      :"Düzenli izleme yeterli";

  const rationale=[
    primaryRisk?primaryRisk.detail:"Belirgin yüksek risk tespit edilmedi.",
    primaryPriority?`İlk ders önceliği ${primaryPriority.subject}.`:"",
    `Genel başarı oranı %${Number(input.totals.successRate||0).toFixed(1)}.`,
  ].filter(Boolean).join(" ");

  return{
    studentName:input.student.name,
    studentNumber:input.student.number,
    classroom:input.student.classroom||input.student.branch,
    level,
    score,
    headline,
    rationale,
    primaryRisk,
    primaryPriority,
    recommendedActions,
    nextReviewDays:level==="urgent"?7:level==="support"?14:30,
  };
}

export function buildTeacherCohortDecision(inputs:TeacherDecisionInput[]):TeacherCohortDecision{
  const decisions=inputs.map(buildTeacherDecision);
  const subjectMap=new Map<string,{
    count:number;
    successTotal:number;
    minutesTotal:number;
  }>();

  for(const input of inputs){
    for(const priority of input.intelligence?.subjectPriorities||[]){
      const current=subjectMap.get(priority.subject)||{count:0,successTotal:0,minutesTotal:0};
      current.count+=1;
      current.successTotal+=priority.successRate;
      current.minutesTotal+=priority.weeklyMinutes;
      subjectMap.set(priority.subject,current);
    }
  }

  const subjectHotspots=[...subjectMap.entries()]
    .map(([subject,value])=>({
      subject,
      studentCount:value.count,
      averageSuccessRate:Number((value.successTotal/value.count).toFixed(1)),
      suggestedWeeklyMinutes:Math.round(value.minutesTotal/value.count),
    }))
    .sort((a,b)=>b.studentCount-a.studentCount||a.averageSuccessRate-b.averageSuccessRate)
    .slice(0,8);

  return{
    generatedAt:new Date().toISOString(),
    totalStudents:decisions.length,
    urgentStudents:decisions.filter(item=>item.level==="urgent").sort((a,b)=>b.score-a.score),
    supportStudents:decisions.filter(item=>item.level==="support").sort((a,b)=>b.score-a.score),
    monitorStudents:decisions.filter(item=>item.level==="monitor").sort((a,b)=>b.score-a.score),
    subjectHotspots,
  };
}
