import type {InterventionMemoryRecord} from "../autonomous";
import type {LiveSchoolEvent} from "../live";
import {
  average,
  clamp,
  directionFrom,
  riskLevelFrom,
  slope,
} from "./predictionMath";
import type {
  PredictiveAiInput,
  PredictiveAiResult,
  PredictiveClassroomRisk,
  PredictiveMetric,
  PredictiveStudentRisk,
} from "./types";

const dayKey=(date:string)=>{
  const value=new Date(date);
  if(Number.isNaN(value.getTime()))return"unknown";
  return value.toISOString().slice(0,10);
};

const dailySeries=(
  events:LiveSchoolEvent[],
  predicate:(event:LiveSchoolEvent)=>boolean,
  days=14,
)=>{
  const today=new Date();
  const values:number[]=[];
  for(let offset=days-1;offset>=0;offset-=1){
    const date=new Date(today);
    date.setDate(today.getDate()-offset);
    const key=date.toISOString().slice(0,10);
    values.push(events.filter(event=>
      dayKey(event.occurredAt)===key&&predicate(event)
    ).length);
  }
  return values;
};

const metricFrom=({
  key,
  label,
  current,
  predicted,
  confidence,
  inverse=false,
  reasons,
}:{
  key:string;
  label:string;
  current:number;
  predicted:number;
  confidence:number;
  inverse?:boolean;
  reasons:string[];
}):PredictiveMetric=>{
  const change=predicted-current;
  const riskScore=inverse
    ?clamp(100-predicted)
    :clamp(predicted*12);
  return{
    key,
    label,
    currentValue:Number(current.toFixed(1)),
    predictedValue:Number(predicted.toFixed(1)),
    change:Number(change.toFixed(1)),
    direction:directionFrom(change),
    confidence:Math.round(clamp(confidence)),
    riskLevel:riskLevelFrom(riskScore),
    reasons,
  };
};

const studentRisk=(
  studentId:string,
  events:LiveSchoolEvent[],
  forecastDays:number,
):PredictiveStudentRisk=>{
  const sorted=[...events].sort((a,b)=>
    String(a.occurredAt).localeCompare(String(b.occurredAt))
  );
  const weights={critical:25,warning:12,info:3,positive:-8} as const;
  const currentRisk=clamp(
    sorted.reduce((sum,event)=>sum+weights[event.level],0)/
    Math.max(1,sorted.length)*2+
    sorted.filter(event=>event.level==="critical").length*12+
    sorted.filter(event=>event.level==="warning").length*5
  );

  const recent=sorted.slice(-6);
  const riskSeries=recent.map((event,index)=>
    clamp(
      (index+1)*2+
      (event.level==="critical"?35:
        event.level==="warning"?18:
        event.level==="positive"?-10:5)
    )
  );
  const trend=slope(riskSeries);
  const predictedRisk=clamp(currentRisk+trend*forecastDays/3);
  const riskChange=predictedRisk-currentRisk;
  const first=sorted[0];

  const sourceCounts=new Map<string,number>();
  for(const event of sorted){
    sourceCounts.set(event.source,(sourceCounts.get(event.source)||0)+1);
  }
  const dominantSource=[...sourceCounts.entries()]
    .sort((a,b)=>b[1]-a[1])[0]?.[0];

  const reasons=[
    sorted.filter(event=>event.level==="critical").length
      ?`${sorted.filter(event=>event.level==="critical").length} kritik olay kaydı var.`
      :undefined,
    sorted.filter(event=>event.level==="warning").length
      ?`${sorted.filter(event=>event.level==="warning").length} uyarı kaydı var.`
      :undefined,
    dominantSource
      ?`En sık tekrar eden alan: ${dominantSource}.`
      :undefined,
    trend>1
      ?"Risk eğilimi yükseliyor."
      :trend<-.5
        ?"Risk eğilimi düşüyor."
        :undefined,
  ].filter(Boolean) as string[];

  const recommendations=[
    predictedRisk>=75
      ?"Yedi gün içinde yönetim ve rehberlik müdahalesi başlatın."
      :predictedRisk>=58
        ?"İki hafta içinde hedefli takip planı oluşturun."
        :undefined,
    dominantSource==="attendance"
      ?"Devamsızlık ve derse katılım durumunu kontrol edin."
      :undefined,
    dominantSource==="homework"
      ?"Ödev ve çalışma düzeni için kısa takip planı oluşturun."
      :undefined,
    dominantSource==="behavior"
      ?"Davranış ve rehberlik kayıtlarını birlikte değerlendirin."
      :undefined,
  ].filter(Boolean) as string[];

  return{
    studentId,
    studentName:first?.studentName||"Öğrenci",
    classroom:first?.classroom,
    currentRisk:Number(currentRisk.toFixed(1)),
    predictedRisk:Number(predictedRisk.toFixed(1)),
    riskChange:Number(riskChange.toFixed(1)),
    riskLevel:riskLevelFrom(predictedRisk),
    estimatedDaysToCritical:
      predictedRisk>=75
        ?0
        :riskChange>0
          ?Math.max(1,Math.round((75-currentRisk)/(riskChange/forecastDays)))
          :undefined,
    reasons,
    recommendations,
    confidence:Math.round(clamp(45+events.length*5)),
  };
};

export function runPredictiveAi({
  events,
  interventionMemory,
  currentSchoolHealth,
  forecastDays=14,
}:PredictiveAiInput):PredictiveAiResult{
  const criticalSeries=dailySeries(
    events,
    event=>event.level==="critical",
  );
  const warningSeries=dailySeries(
    events,
    event=>event.level==="warning",
  );

  const criticalCurrent=average(criticalSeries.slice(-3));
  const warningCurrent=average(warningSeries.slice(-3));
  const criticalPredicted=Math.max(
    0,
    criticalCurrent+slope(criticalSeries)*forecastDays/3,
  );
  const warningPredicted=Math.max(
    0,
    warningCurrent+slope(warningSeries)*forecastDays/3,
  );

  const healthChange=
    -(criticalPredicted-criticalCurrent)*4-
    (warningPredicted-warningCurrent)*1.5;
  const predictedHealth=clamp(currentSchoolHealth+healthChange);

  const completed=interventionMemory.filter(item=>item.outcome!=="pending");
  const effectivenessValues=completed
    .map(item=>item.effectivenessScore)
    .filter((value):value is number=>Number.isFinite(value));
  const currentEffectiveness=average(effectivenessValues);
  const recentEffectiveness=average(effectivenessValues.slice(0,5));
  const predictedEffectiveness=clamp(
    currentEffectiveness+
    (recentEffectiveness-currentEffectiveness)*.45
  );

  const studentMap=new Map<string,LiveSchoolEvent[]>();
  for(const event of events){
    if(!event.studentId)continue;
    const list=studentMap.get(event.studentId)||[];
    list.push(event);
    studentMap.set(event.studentId,list);
  }

  const studentRisks=[...studentMap.entries()]
    .map(([studentId,list])=>studentRisk(studentId,list,forecastDays))
    .sort((a,b)=>b.predictedRisk-a.predictedRisk)
    .slice(0,50);

  const classroomMap=new Map<string,LiveSchoolEvent[]>();
  for(const event of events){
    if(!event.classroom)continue;
    const list=classroomMap.get(event.classroom)||[];
    list.push(event);
    classroomMap.set(event.classroom,list);
  }

  const classroomRisks:PredictiveClassroomRisk[]=[...classroomMap.entries()]
    .map(([classroom,list])=>{
      const currentRisk=clamp(
        list.filter(item=>item.level==="critical").length*18+
        list.filter(item=>item.level==="warning").length*8+
        list.filter(item=>item.level==="positive").length*-4
      );
      const recent=list.slice(-8);
      const trend=slope(recent.map((item,index)=>
        clamp(index*2+
          (item.level==="critical"?30:
            item.level==="warning"?14:
            item.level==="positive"?-8:4)
        )
      ));
      const predictedRisk=clamp(currentRisk+trend*forecastDays/3);
      const sourceCounts=new Map<string,number>();
      for(const item of list){
        sourceCounts.set(item.source,(sourceCounts.get(item.source)||0)+1);
      }
      return{
        classroom,
        eventCount:list.length,
        criticalEventCount:list.filter(item=>item.level==="critical").length,
        warningEventCount:list.filter(item=>item.level==="warning").length,
        currentRisk:Number(currentRisk.toFixed(1)),
        predictedRisk:Number(predictedRisk.toFixed(1)),
        riskChange:Number((predictedRisk-currentRisk).toFixed(1)),
        riskLevel:riskLevelFrom(predictedRisk),
        dominantSource:[...sourceCounts.entries()]
          .sort((a,b)=>b[1]-a[1])[0]?.[0]||"system",
      };
    })
    .sort((a,b)=>b.predictedRisk-a.predictedRisk);

  const schoolHealth=metricFrom({
    key:"school-health",
    label:"Okul Sağlık Skoru",
    current:currentSchoolHealth,
    predicted:predictedHealth,
    confidence:70+Math.min(20,events.length/4),
    inverse:true,
    reasons:[
      criticalPredicted>criticalCurrent
        ?"Kritik olayların artması bekleniyor."
        :"Kritik olaylar dengeli veya düşüş eğiliminde.",
      warningPredicted>warningCurrent
        ?"Uyarı olaylarında artış eğilimi var."
        :"Uyarı olayları dengeli.",
    ],
  });

  const criticalEvents=metricFrom({
    key:"critical-events",
    label:"Günlük Kritik Olay",
    current:criticalCurrent,
    predicted:criticalPredicted,
    confidence:65+Math.min(25,events.length/5),
    reasons:[
      `Son 14 günlük eğim ${slope(criticalSeries).toFixed(2)}.`,
    ],
  });

  const warningEvents=metricFrom({
    key:"warning-events",
    label:"Günlük Uyarı Olayı",
    current:warningCurrent,
    predicted:warningPredicted,
    confidence:65+Math.min(25,events.length/5),
    reasons:[
      `Son 14 günlük eğim ${slope(warningSeries).toFixed(2)}.`,
    ],
  });

  const interventionEffectiveness=metricFrom({
    key:"intervention-effectiveness",
    label:"Müdahale Etkinliği",
    current:currentEffectiveness,
    predicted:predictedEffectiveness,
    confidence:50+Math.min(35,completed.length*4),
    inverse:true,
    reasons:[
      completed.length
        ?`${completed.length} tamamlanmış müdahale sonucu kullanıldı.`
        :"Tahmin için tamamlanmış müdahale sonucu bulunmuyor.",
    ],
  });

  const projectedCriticalStudents=studentRisks.filter(
    item=>item.predictedRisk>=75
  ).length;

  const status=
    schoolHealth.predictedValue<60||projectedCriticalStudents>=5
      ?"critical"
      :schoolHealth.predictedValue<78||projectedCriticalStudents>0
        ?"attention"
        :"stable";

  const recommendations=[
    studentRisks[0]
      ?`${studentRisks[0].studentName} ile başlayan ilk risk grubunu yakın izlemeye alın.`
      :undefined,
    classroomRisks[0]
      ?`${classroomRisks[0].classroom} sınıfı için erken müdahale toplantısı planlayın.`
      :undefined,
    criticalPredicted>criticalCurrent
      ?"Kritik olay artışını azaltmak için günlük görev kapanış kontrolü uygulayın."
      :undefined,
    predictedEffectiveness<50&&completed.length
      ?"Müdahale yöntemlerini geçmiş etkinlik sonuçlarına göre yeniden seçin."
      :undefined,
  ].filter(Boolean) as string[];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    forecastDays,
    schoolHealth,
    criticalEvents,
    warningEvents,
    interventionEffectiveness,
    studentRisks,
    classroomRisks,
    summary:{
      status,
      headline:status==="critical"
        ?"Önümüzdeki dönemde kritik risk artışı bekleniyor"
        :status==="attention"
          ?"Bazı öğrenci ve sınıflarda risk artışı bekleniyor"
          :"Tahmini okul görünümü dengeli",
      detail:`${forecastDays} günlük tahminde okul sağlık skorunun ${currentSchoolHealth.toFixed(1)} seviyesinden ${predictedHealth.toFixed(1)} seviyesine ulaşması; ${projectedCriticalStudents} öğrencinin kritik risk düzeyinde olması bekleniyor.`,
    },
    recommendations,
  };
}
