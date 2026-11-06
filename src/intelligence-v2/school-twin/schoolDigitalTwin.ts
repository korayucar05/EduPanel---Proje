import {average,clamp} from "./schoolTwinMath";
import type {
  BranchTwinSummary,
  ClassroomTwinSummary,
  SchoolDigitalTwinInput,
  SchoolDigitalTwinResult,
} from "./types";

const scenarioMultiplier=({
  weeklyExtraLessonMinutes,
  mockExamPerMonth,
  guidanceSessionsPerMonth,
  parentMeetingsPerMonth,
  attendanceReductionDays,
}:SchoolDigitalTwinInput["scenario"])=>{
  const lesson=Math.min(4.5,weeklyExtraLessonMinutes/60*.32);
  const mock=Math.min(2.2,mockExamPerMonth*.22);
  const guidance=Math.min(1.2,guidanceSessionsPerMonth*.16);
  const parent=Math.min(.8,parentMeetingsPerMonth*.1);
  const attendance=Math.min(2.4,attendanceReductionDays*.24);
  return lesson+mock+guidance+parent+attendance;
};

export function runSchoolDigitalTwin({
  cohort,
  scenario,
  optimizer,
}:SchoolDigitalTwinInput):SchoolDigitalTwinResult{
  const ranking=cohort.ranking||[];
  const filtered=scenario.targetClassroom
    ?ranking.filter(item=>item.student.classroom===scenario.targetClassroom)
    :ranking;

  const averageNet=average(filtered.map(item=>item.currentNet));
  const schoolBrainIndex=average(filtered.map(item=>item.brainScore));
  const criticalStudentCount=filtered.filter(item=>item.priorityLevel==="critical").length;
  const highPriorityCount=filtered.filter(item=>item.priorityLevel==="high").length;

  const classroomMap=new Map<string,typeof ranking>();
  for(const student of ranking){
    const classroom=student.student.classroom||"Sınıf Bilgisi Yok";
    const list=classroomMap.get(classroom)||[];
    list.push(student);
    classroomMap.set(classroom,list);
  }

  const classroomSummaries:ClassroomTwinSummary[]=[...classroomMap.entries()]
    .map(([classroom,students])=>({
      classroom,
      studentCount:students.length,
      averageNet:Number(average(students.map(item=>item.currentNet)).toFixed(2)),
      averageBrainScore:Number(average(students.map(item=>item.brainScore)).toFixed(1)),
      averagePriorityScore:Number(average(students.map(item=>item.priorityScore)).toFixed(1)),
      criticalCount:students.filter(item=>item.priorityLevel==="critical").length,
      highCount:students.filter(item=>item.priorityLevel==="high").length,
      mediumCount:students.filter(item=>item.priorityLevel==="medium").length,
      lowCount:students.filter(item=>item.priorityLevel==="low").length,
      expectedGain:Number(students.reduce((sum,item)=>sum+item.expectedGain,0).toFixed(2)),
    }))
    .sort((a,b)=>b.averagePriorityScore-a.averagePriorityScore);

  const subjectMap=new Map<string,{
    studentCount:number;
    successRates:number[];
    nets:number[];
    priorityCount:number;
    expectedGain:number;
  }>();

  for(const student of ranking){
    for(const factor of student.factors){
      if(!factor.key.startsWith("subject:"))continue;
      const subject=factor.key.replace("subject:","");
      const current=subjectMap.get(subject)||{
        studentCount:0,
        successRates:[],
        nets:[],
        priorityCount:0,
        expectedGain:0,
      };
      current.studentCount+=1;
      current.successRates.push(factor.score);
      current.nets.push(student.currentNet);
      if(student.priorityLevel==="critical"||student.priorityLevel==="high"){
        current.priorityCount+=1;
      }
      current.expectedGain+=student.expectedGain;
      subjectMap.set(subject,current);
    }
  }

  const branchSummaries:BranchTwinSummary[]=[...subjectMap.entries()]
    .map(([subject,value])=>({
      subject,
      studentCount:value.studentCount,
      averageSuccessRate:Number(average(value.successRates).toFixed(1)),
      averageNet:Number(average(value.nets).toFixed(2)),
      priorityStudentCount:value.priorityCount,
      expectedGain:Number(value.expectedGain.toFixed(2)),
      impactLevel:(value.priorityCount>=Math.max(8,value.studentCount*.35)
        ?"high"
        :value.priorityCount>=Math.max(4,value.studentCount*.2)
          ?"medium"
          :"low") as BranchTwinSummary["impactLevel"],
    }))
    .sort((a,b)=>
      b.priorityStudentCount-a.priorityStudentCount||
      a.averageSuccessRate-b.averageSuccessRate
    );

  const baseEffect=scenarioMultiplier(scenario);
  const optimizerEffect=optimizer?.expectedTotalNetGain||0;
  const perStudentOptimizerGain=filtered.length
    ?optimizerEffect/filtered.length
    :0;
  const predictedAverageNet=averageNet+baseEffect+perStudentOptimizerGain;
  const predictedBrainIndex=clamp(
    schoolBrainIndex+
    baseEffect*1.4+
    Math.min(6,perStudentOptimizerGain*1.8)
  );

  const studentsLeavingCriticalRisk=Math.min(
    criticalStudentCount,
    Math.floor((baseEffect+perStudentOptimizerGain)/1.5),
  );

  const status=criticalStudentCount/Math.max(1,filtered.length)>=.2
    ?"critical"
    :criticalStudentCount/Math.max(1,filtered.length)>=.08
      ?"attention"
      :"stable";

  const headline=status==="critical"
    ?"Okul genelinde yoğun akademik müdahale gerekiyor"
    :status==="attention"
      ?"Belirli sınıf ve derslerde yakın izleme gerekiyor"
      :"Okul akademik görünümü dengeli";

  const recommendations=[
    classroomSummaries[0]
      ?`${classroomSummaries[0].classroom} sınıfını ilk müdahale grubu olarak ele alın.`
      :undefined,
    branchSummaries[0]
      ?`${branchSummaries[0].subject} için branş bazlı ortak destek planı oluşturun.`
      :undefined,
    optimizer?.allocations?.length
      ?`Copilot planındaki ilk ${Math.min(10,optimizer.allocations.length)} öğrenci için kaynak dağıtımını başlatın.`
      :undefined,
    scenario.weeklyExtraLessonMinutes>0
      ?"Ek ders uygulamasını iki haftalık ara ölçümle takip edin."
      :undefined,
  ].filter(Boolean) as string[];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    totalStudents:filtered.length,
    schoolBrainIndex:Number(schoolBrainIndex.toFixed(1)),
    averageNet:Number(averageNet.toFixed(2)),
    criticalStudentCount,
    highPriorityCount,
    classroomSummaries,
    branchSummaries,
    scenario,
    scenarioImpact:{
      baselineAverageNet:Number(averageNet.toFixed(2)),
      predictedAverageNet:Number(predictedAverageNet.toFixed(2)),
      netDifference:Number((predictedAverageNet-averageNet).toFixed(2)),
      baselineBrainIndex:Number(schoolBrainIndex.toFixed(1)),
      predictedBrainIndex:Number(predictedBrainIndex.toFixed(1)),
      brainDifference:Number((predictedBrainIndex-schoolBrainIndex).toFixed(1)),
      studentsLeavingCriticalRisk,
      studentsEnteringCriticalRisk:0,
      expectedTotalNetGain:Number(
        ((predictedAverageNet-averageNet)*filtered.length).toFixed(2)
      ),
      confidence:Math.round(clamp(
        58+
        Math.min(22,filtered.length/5)+
        (optimizer?8:0)
      )),
    },
    optimizer,
    executiveSummary:{
      status,
      headline,
      detail:[
        `${filtered.length} öğrenci değerlendirildi.`,
        `Okul Brain Endeksi ${schoolBrainIndex.toFixed(1)}, ortalama net ${averageNet.toFixed(2)}.`,
        `Senaryo uygulanırsa ortalama netin ${predictedAverageNet.toFixed(2)} seviyesine çıkması bekleniyor.`,
      ].join(" "),
    },
    recommendations,
  };
}
