import type {InterventionMemoryRecord} from "../autonomous";
import type {
  InterventionInsightGroup,
  InterventionInsightsResult,
  InterventionTrendPoint,
} from "./types";

const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

const safeNumbers=(values:Array<number|undefined>)=>
  values.filter((value):value is number=>Number.isFinite(value));

const buildGroup=(
  key:string,
  label:string,
  records:InterventionMemoryRecord[],
):InterventionInsightGroup=>{
  const completed=records.filter(item=>item.outcome!=="pending");
  const effective=completed.filter(item=>item.outcome==="effective");
  const limited=completed.filter(item=>item.outcome==="limited");
  const ineffective=completed.filter(item=>item.outcome==="ineffective");

  return{
    key,
    label,
    count:records.length,
    completedCount:completed.length,
    effectiveCount:effective.length,
    limitedCount:limited.length,
    ineffectiveCount:ineffective.length,
    pendingCount:records.filter(item=>item.outcome==="pending").length,
    averageExpectedGain:Number(
      average(safeNumbers(records.map(item=>item.expectedGain))).toFixed(2)
    ),
    averageObservedGain:Number(
      average(safeNumbers(completed.map(item=>item.observedGain))).toFixed(2)
    ),
    averageEffectiveness:Number(
      average(safeNumbers(completed.map(item=>item.effectivenessScore))).toFixed(1)
    ),
    successRate:completed.length
      ?Number((effective.length/completed.length*100).toFixed(1))
      :0,
  };
};

const monthKey=(value:string)=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return"Belirsiz";
  return new Intl.DateTimeFormat("tr-TR",{
    year:"numeric",
    month:"short",
  }).format(date);
};

export function buildInterventionInsights(
  records:InterventionMemoryRecord[],
):InterventionInsightsResult{
  const completed=records.filter(item=>item.outcome!=="pending");
  const effective=completed.filter(item=>item.outcome==="effective");

  const typeMap=new Map<string,InterventionMemoryRecord[]>();
  const targetMap=new Map<string,InterventionMemoryRecord[]>();
  const periodMap=new Map<string,InterventionMemoryRecord[]>();

  for(const record of records){
    const type=record.interventionType||"Diğer";
    typeMap.set(type,[...(typeMap.get(type)||[]),record]);

    const target=record.targetType||"school";
    targetMap.set(target,[...(targetMap.get(target)||[]),record]);

    const period=monthKey(record.completedAt||record.startedAt);
    periodMap.set(period,[...(periodMap.get(period)||[]),record]);
  }

  const byType=[...typeMap.entries()]
    .map(([key,items])=>buildGroup(key,key,items))
    .sort((a,b)=>b.averageEffectiveness-a.averageEffectiveness||b.count-a.count);

  const targetLabel={
    student:"Öğrenci",
    classroom:"Sınıf",
    subject:"Ders / Branş",
    school:"Okul",
  } as const;

  const byTargetType=[...targetMap.entries()]
    .map(([key,items])=>buildGroup(
      key,
      targetLabel[key as keyof typeof targetLabel]||key,
      items,
    ))
    .sort((a,b)=>b.count-a.count);

  const trend:InterventionTrendPoint[]=[...periodMap.entries()]
    .map(([period,items])=>{
      const periodCompleted=items.filter(item=>item.outcome!=="pending");
      return{
        period,
        count:items.length,
        averageObservedGain:Number(
          average(safeNumbers(periodCompleted.map(item=>item.observedGain))).toFixed(2)
        ),
        averageEffectiveness:Number(
          average(safeNumbers(periodCompleted.map(item=>item.effectivenessScore))).toFixed(1)
        ),
      };
    })
    .slice(-12);

  const strongestIntervention=byType.find(item=>item.completedCount>0);
  const weakestIntervention=[...byType]
    .filter(item=>item.completedCount>0)
    .sort((a,b)=>a.averageEffectiveness-b.averageEffectiveness)[0];

  const averageExpectedGain=average(
    safeNumbers(records.map(item=>item.expectedGain))
  );
  const averageObservedGain=average(
    safeNumbers(completed.map(item=>item.observedGain))
  );
  const averageEffectiveness=average(
    safeNumbers(completed.map(item=>item.effectivenessScore))
  );

  const recommendations=[
    strongestIntervention
      ?`${strongestIntervention.label} müdahaleleri %${strongestIntervention.successRate} başarı oranıyla en güçlü sonuçları üretiyor.`
      :undefined,
    weakestIntervention&&weakestIntervention.averageEffectiveness<45
      ?`${weakestIntervention.label} müdahalelerinde yöntem, süre veya hedef grup yeniden değerlendirilmelidir.`
      :undefined,
    records.some(item=>item.outcome==="pending")
      ?`${records.filter(item=>item.outcome==="pending").length} müdahalenin sonuç ölçümü henüz tamamlanmadı.`
      :undefined,
    completed.length
      ?"Yeni önerilerde geçmişte yüksek etkinlik gösteren müdahalelere daha yüksek öncelik verin."
      :undefined,
  ].filter(Boolean) as string[];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    totalInterventions:records.length,
    completedInterventions:completed.length,
    pendingInterventions:records.length-completed.length,
    effectiveInterventions:effective.length,
    averageExpectedGain:Number(averageExpectedGain.toFixed(2)),
    averageObservedGain:Number(averageObservedGain.toFixed(2)),
    averageEffectiveness:Number(averageEffectiveness.toFixed(1)),
    successRate:completed.length
      ?Number((effective.length/completed.length*100).toFixed(1))
      :0,
    strongestIntervention,
    weakestIntervention,
    byType,
    byTargetType,
    trend,
    recentRecords:[...records]
      .sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)))
      .slice(0,30),
    recommendations,
    summary:records.length
      ?`${records.length} müdahale kaydı incelendi. ${completed.length} müdahalenin sonucu ölçüldü; ortalama gerçekleşen etki ${averageObservedGain>=0?"+":""}${averageObservedGain.toFixed(2)} net ve ortalama etkinlik %${averageEffectiveness.toFixed(1)}.`
      :"Kurumsal müdahale hafızasında henüz kayıt bulunmuyor.",
  };
}
