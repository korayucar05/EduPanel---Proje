import type {BrainScoreResult} from "../brain";
import {average,clamp,levelMultiplier,roundToStep} from "./optimizerMath";
import type {
  CopilotAllocation,
  CopilotOptimizerConfig,
  CopilotOptimizerInput,
  CopilotOptimizerResult,
  OptimizerPreset,
} from "./optimizerTypes";

export const optimizerPresets:OptimizerPreset[]=[
  {
    key:"four-hours",
    label:"4 Saatlik Etüt Bütçesi",
    description:"Toplam 240 dakikayı en yüksek beklenen kazanca göre dağıtır.",
    config:{totalMinutes:240,resourceType:"extra-lesson"},
  },
  {
    key:"teacher-six-hours",
    label:"6 Saat Öğretmen Desteği",
    description:"Toplam 360 dakikalık öğretmen desteğini öncelikli öğrencilere dağıtır.",
    config:{totalMinutes:360,resourceType:"teacher-support"},
  },
  {
    key:"guidance-day",
    label:"Rehberlik Günü",
    description:"180 dakikalık rehberlik kapasitesini kritik ve yüksek öncelikli öğrencilere ayırır.",
    config:{
      totalMinutes:180,
      resourceType:"guidance",
      includePriorityLevels:["critical","high"],
      minimumSessionMinutes:20,
      maximumSessionMinutes:40,
    },
  },
];

const defaultConfig:CopilotOptimizerConfig={
  totalMinutes:240,
  minimumSessionMinutes:20,
  maximumSessionMinutes:60,
  sessionStepMinutes:10,
  resourceType:"extra-lesson",
  includePriorityLevels:["critical","high","medium"],
  maximumStudents:20,
};

const readiness=(student:BrainScoreResult)=>
  student.factors.find(item=>item.key==="interventionReadiness")?.score||50;

const interventionEffectiveness=(student:BrainScoreResult)=>
  student.factors.find(item=>item.key==="interventionEffectiveness")?.score||50;

const priorityReason=(student:BrainScoreResult)=>
  student.topReasons[0]||student.headline;

const actionFor=(student:BrainScoreResult,resourceType:CopilotOptimizerConfig["resourceType"])=>
  resourceType==="guidance"
    ?"Kısa rehberlik görüşmesi, hedef netleştirme ve takip tarihi planlayın."
    :resourceType==="parent-meeting"
      ?"Veli görüşmesinde uygulanabilir haftalık destek planı oluşturun."
      :student.recommendedActions[0]||
       "Öncelikli ders için hedefli çalışma ve kısa süreli takip planlayın.";

const studentEfficiency=(student:BrainScoreResult)=>{
  const gain=Math.max(.1,student.expectedGain);
  const interventionReadiness=readiness(student);
  const effectiveness=interventionEffectiveness(student);
  return(
    gain*.36+
    student.priorityScore*.006+
    student.potentialScore*.008+
    interventionReadiness*.007+
    effectiveness*.007
  )*levelMultiplier[student.priorityLevel];
};

const gainPerMinute=(
  student:BrainScoreResult,
  minutes:number,
  maxMinutes:number,
)=>{
  const normalized=Math.max(.15,minutes/Math.max(1,maxMinutes));
  const diminishing=normalized<=.5
    ?normalized*1.18
    :.59+(normalized-.5)*.72;
  return student.expectedGain*clamp(diminishing,0,1);
};

export function runCopilotOptimizer({
  cohort,
  config,
}:CopilotOptimizerInput):CopilotOptimizerResult{
  const resolved:CopilotOptimizerConfig={
    ...defaultConfig,
    ...config,
    includePriorityLevels:config.includePriorityLevels?.length
      ?config.includePriorityLevels
      :defaultConfig.includePriorityLevels,
  };

  const eligible=cohort.ranking
    .filter(student=>resolved.includePriorityLevels.includes(student.priorityLevel))
    .filter(student=>
      !resolved.classroomFilter||
      student.student.classroom===resolved.classroomFilter
    )
    .sort((a,b)=>
      studentEfficiency(b)-studentEfficiency(a)||
      b.priorityScore-a.priorityScore
    );

  const selected=eligible.slice(0,resolved.maximumStudents||eligible.length);
  let remaining=Math.max(0,resolved.totalMinutes);
  const minuteMap=new Map<string,number>();

  for(const student of selected){
    if(remaining<resolved.minimumSessionMinutes)break;
    const minutes=Math.min(resolved.minimumSessionMinutes,remaining);
    minuteMap.set(student.student.id,minutes);
    remaining-=minutes;
  }

  while(remaining>=resolved.sessionStepMinutes){
    const candidates=selected
      .filter(student=>
        (minuteMap.get(student.student.id)||0)<resolved.maximumSessionMinutes
      )
      .map(student=>{
        const current=minuteMap.get(student.student.id)||0;
        const next=Math.min(
          resolved.maximumSessionMinutes,
          current+resolved.sessionStepMinutes,
        );
        const currentGain=gainPerMinute(
          student,
          current,
          resolved.maximumSessionMinutes,
        );
        const nextGain=gainPerMinute(
          student,
          next,
          resolved.maximumSessionMinutes,
        );
        return{
          student,
          marginalGain:nextGain-currentGain,
          nextMinutes:next,
        };
      })
      .sort((a,b)=>
        b.marginalGain-a.marginalGain||
        b.student.priorityScore-a.student.priorityScore
      );

    const best=candidates[0];
    if(!best||best.marginalGain<=0)break;
    const increment=Math.min(
      resolved.sessionStepMinutes,
      remaining,
      best.nextMinutes-(minuteMap.get(best.student.student.id)||0),
    );
    if(increment<=0)break;
    minuteMap.set(
      best.student.student.id,
      (minuteMap.get(best.student.student.id)||0)+increment,
    );
    remaining-=increment;
  }

  const allocations:CopilotAllocation[]=selected
    .filter(student=>(minuteMap.get(student.student.id)||0)>0)
    .map(student=>{
      const allocatedMinutes=minuteMap.get(student.student.id)||0;
      const expectedAllocatedGain=gainPerMinute(
        student,
        allocatedMinutes,
        resolved.maximumSessionMinutes,
      );
      return{
        rank:0,
        studentId:student.student.id,
        studentName:student.student.name,
        studentNumber:student.student.number,
        classroom:student.student.classroom,
        priorityLevel:student.priorityLevel,
        priorityScore:student.priorityScore,
        potentialScore:student.potentialScore,
        expectedGain:student.expectedGain,
        allocatedMinutes,
        expectedAllocatedGain:Number(expectedAllocatedGain.toFixed(2)),
        efficiency:Number(
          (expectedAllocatedGain/Math.max(1,allocatedMinutes)*60).toFixed(2)
        ),
        primaryReason:priorityReason(student),
        recommendedAction:actionFor(student,resolved.resourceType),
      };
    })
    .sort((a,b)=>
      b.expectedAllocatedGain-a.expectedAllocatedGain||
      b.priorityScore-a.priorityScore
    )
    .map((allocation,index)=>({...allocation,rank:index+1}));

  const allocatedMinutes=allocations.reduce(
    (sum,item)=>sum+item.allocatedMinutes,
    0,
  );
  const expectedTotalNetGain=allocations.reduce(
    (sum,item)=>sum+item.expectedAllocatedGain,
    0,
  );

  const recommendations=[
    allocations.length
      ?`İlk ${Math.min(5,allocations.length)} öğrenciyle bir hafta içinde müdahaleye başlayın.`
      :"Seçilen ölçütlere uygun öğrenci bulunamadı.",
    remaining>0
      ?`${remaining} dakikalık kapasite kullanılmadı; öğrenci sınırını veya öncelik seviyelerini genişletebilirsiniz.`
      :undefined,
    allocations.some(item=>item.priorityLevel==="critical")
      ?"Kritik öğrenciler için müdahale sonrası yedi günlük kontrol tarihi belirleyin."
      :undefined,
    "Planı uyguladıktan sonra gerçekleşen net artışını müdahale hafızasına kaydedin.",
  ].filter(Boolean) as string[];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    config:resolved,
    totalAvailableMinutes:resolved.totalMinutes,
    allocatedMinutes,
    unusedMinutes:Math.max(0,resolved.totalMinutes-allocatedMinutes),
    selectedStudentCount:allocations.length,
    expectedTotalNetGain:Number(expectedTotalNetGain.toFixed(2)),
    averageEfficiency:Number(
      average(allocations.map(item=>item.efficiency)).toFixed(2)
    ),
    allocations,
    excludedStudentCount:Math.max(0,cohort.totalStudents-eligible.length),
    summary:allocations.length
      ?`${resolved.totalMinutes} dakikalık kaynak ${allocations.length} öğrenciye dağıtıldı. Toplam beklenen akademik kazanç +${expectedTotalNetGain.toFixed(2)} nettir.`
      :"Belirlenen kaynak ve filtrelerle uygun dağıtım üretilemedi.",
    recommendations,
  };
}
