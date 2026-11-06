import type {
  CommanderBriefing,
  CommanderInput,
  CommanderOrder,
  CommanderPriority,
} from "./types";

const levelWeight:Record<CommanderPriority,number>={
  critical:4,
  high:3,
  medium:2,
  low:1,
};

const toPriority=(score:number):CommanderPriority=>{
  if(score>=80)return"critical";
  if(score>=60)return"high";
  if(score>=40)return"medium";
  return"low";
};

export function buildCommanderBriefing({
  live,
  predictive,
  autonomous,
  workflow,
  events,
  decision,
}:CommanderInput):CommanderBriefing{
  const orders:CommanderOrder[]=[];

  for(const student of predictive.studentRisks.slice(0,10)){
    if(student.predictedRisk<55)continue;
    orders.push({
      id:`student-${student.studentId}`,
      title:`${student.studentName} için erken müdahale`,
      detail:student.reasons[0]||"Risk artışı tespit edildi.",
      action:student.recommendations[0]||"Yakın takip başlatın.",
      owner:student.riskLevel==="critical"?"guidance":"teacher",
      priority:student.riskLevel==="critical"
        ?"critical"
        :student.riskLevel==="high"
          ?"high"
          :"medium",
      score:student.predictedRisk,
      dueHours:student.riskLevel==="critical"?24:72,
      source:"predictive-ai",
      sourceIds:[student.studentId],
    });
  }

  for(const classroom of predictive.classroomRisks.slice(0,5)){
    if(classroom.predictedRisk<50)continue;
    orders.push({
      id:`classroom-${classroom.classroom}`,
      title:`${classroom.classroom} sınıfı için yönetim müdahalesi`,
      detail:`Tahmini risk ${classroom.predictedRisk}/100. Baskın alan: ${classroom.dominantSource}.`,
      action:"Sınıf rehber öğretmeni ve ilgili branşlarla kısa müdahale toplantısı yapın.",
      owner:"management",
      priority:toPriority(classroom.predictedRisk),
      score:classroom.predictedRisk,
      dueHours:48,
      source:"predictive-ai",
      sourceIds:[classroom.classroom],
    });
  }

  for(const task of autonomous.tasks
    .filter(item=>item.status==="planned"||item.status==="active")
    .slice(0,10)){
    orders.push({
      id:`autonomous-${task.id}`,
      title:task.title,
      detail:task.detail,
      action:task.status==="active"
        ?"Mevcut görevi tamamlayın ve sonucunu kaydedin."
        :"Görevi başlatın ve sorumlu atayın.",
      owner:task.owner,
      priority:task.priority>=5?"critical":task.priority>=4?"high":"medium",
      score:task.priority*20,
      dueHours:task.dueAt
        ?Math.max(1,Math.round((new Date(task.dueAt).getTime()-Date.now())/3_600_000))
        :72,
      expectedGain:task.expectedGain,
      source:"autonomous-ai",
      sourceIds:[task.id],
    });
  }

  if(workflow.overdue>0){
    orders.push({
      id:"workflow-overdue",
      title:`${workflow.overdue} gecikmiş müdahale bulunuyor`,
      detail:"Planlanan veya aktif müdahalelerin son tarihi geçti.",
      action:"Gecikmiş müdahaleleri bugün yeniden planlayın veya kapatın.",
      owner:"management",
      priority:workflow.overdue>=5?"critical":"high",
      score:Math.min(100,60+workflow.overdue*5),
      dueHours:8,
      source:"action-workflow",
      sourceIds:[],
    });
  }

  if(predictive.interventionEffectiveness.predictedValue<50&&workflow.completed>0){
    orders.push({
      id:"effectiveness-low",
      title:"Müdahale etkinliği düşük seyrediyor",
      detail:`Tahmini etkinlik %${predictive.interventionEffectiveness.predictedValue}.`,
      action:"Düşük etki gösteren müdahale türlerini değiştirin ve güçlü müdahalelere öncelik verin.",
      owner:"management",
      priority:"high",
      score:72,
      dueHours:72,
      source:"intervention-memory",
      sourceIds:[],
    });
  }

  for(const event of events.filter(item=>item.level==="critical").slice(0,5)){
    orders.push({
      id:`event-${event.id}`,
      title:event.title,
      detail:event.detail,
      action:"Olayı doğrulayın, sorumlu belirleyin ve işlem kaydı oluşturun.",
      owner:event.source==="guidance"
        ?"guidance"
        :event.source==="parent"
          ?"parent"
          :"management",
      priority:"critical",
      score:95,
      dueHours:4,
      source:"hasat-live",
      sourceIds:[event.id],
    });
  }

  const unique=orders
    .sort((a,b)=>
      levelWeight[b.priority]-levelWeight[a.priority]||
      b.score-a.score
    )
    .filter((item,index,array)=>
      array.findIndex(candidate=>candidate.id===item.id)===index
    )
    .slice(0,25);

  const status=
    live.criticalEventCount>0||
    predictive.summary.status==="critical"||
    workflow.overdue>=5
      ?"critical"
      :live.warningEventCount>0||
        predictive.summary.status==="attention"||
        workflow.overdue>0
        ?"attention"
        :"stable";

  const title=status==="critical"
    ?"Bugün komuta düzeyinde müdahale gerekiyor"
    :status==="attention"
      ?"Bugün yakın izleme ve görev takibi gerekiyor"
      :"Okul operasyonel görünümü dengeli";

  const agenda=unique.map(order=>({
    orderId:order.id,
    window:order.dueHours<=8?"now" as const:order.dueHours<=24?"today" as const:"week" as const,
    label:order.dueHours<=8?"Hemen":order.dueHours<=24?"Bugün":"Bu hafta",
  }));

  const quickWins=[
    unique.find(item=>item.owner==="teacher"),
    unique.find(item=>item.owner==="guidance"),
    unique.find(item=>item.owner==="management"),
  ].filter(Boolean).slice(0,3).map((item:any)=>({
    title:item.title,
    detail:item.action,
    expectedGain:item.expectedGain?`Yaklaşık +${item.expectedGain} net etki`:`${item.dueHours} saat içinde uygulanabilir`,
  }));

  const evidence=[
    `Canlı okul sağlık skoru: ${live.schoolHealthScore}.`,
    `Tahmini okul sağlık skoru: ${predictive.schoolHealth.predictedValue}.`,
    `Kritik canlı olay: ${live.criticalEventCount}.`,
    `Tahmini kritik öğrenci: ${predictive.studentRisks.filter(item=>item.predictedRisk>=75).length}.`,
    `Aktif otonom görev: ${autonomous.plannedTaskCount}.`,
    `Gecikmiş müdahale: ${workflow.overdue}.`,
    decision.answer,
  ];

  return{
    version:"2.0",
    generatedAt:new Date().toISOString(),
    title,
    summary:`${unique.length} komuta emri üretildi. Öncelik sırasına göre kritik olaylar, tahmini öğrenci riskleri, sınıf riskleri ve gecikmiş müdahaleler ele alındı.`,
    schoolStatus:status,
    orders:unique,
    evidence,
    agenda,
    quickWins,
    metrics:{
      schoolHealth:live.schoolHealthScore,
      predictedSchoolHealth:predictive.schoolHealth.predictedValue,
      criticalEvents:live.criticalEventCount,
      projectedCriticalStudents:predictive.studentRisks.filter(
        item=>item.predictedRisk>=75
      ).length,
      activeTasks:autonomous.plannedTaskCount,
      overdueTasks:workflow.overdue,
      completedInterventions:workflow.completed,
      averageEffectiveness:workflow.averageEffectiveness,
    },
  };
}
