import type {BrainScoreResult} from "../brain";
import type {BrainTimelineResult} from "../timeline";
import {buildStudentEarlyWarning} from "./studentWarningEngine";
import {average,levelFromScore} from "./warningMath";
import type {
  ClassroomEarlyWarning,
  EarlyWarningCenterInput,
  EarlyWarningCenterResult,
  SubjectEarlyWarning,
} from "./types";

export function buildEarlyWarningCenter({
  cohort,
  timeline,
}:EarlyWarningCenterInput):EarlyWarningCenterResult{
  const timelineMap=new Map<string,BrainTimelineResult>(
    (timeline?.timelines||[]).map(item=>[item.student.id,item]),
  );

  const students=cohort.ranking
    .map(student=>buildStudentEarlyWarning({
      student,
      timeline:timelineMap.get(student.student.id),
    }))
    .sort((a,b)=>b.warningScore-a.warningScore);

  const classroomMap=new Map<string,typeof students>();
  for(const student of students){
    const classroom=student.classroom||"Sınıf Bilgisi Yok";
    const list=classroomMap.get(classroom)||[];
    list.push(student);
    classroomMap.set(classroom,list);
  }

  const classroomWarnings:ClassroomEarlyWarning[]=[...classroomMap.entries()]
    .map(([classroom,list])=>{
      const score=average(list.map(item=>item.warningScore));
      const projectedCritical=list.filter(item=>
        item.predictedWarningLevel==="critical"||
        item.estimatedCriticalInExams===1
      ).length;
      const reasons=list.flatMap(item=>item.reasons);
      const reasonCounts=new Map<string,number>();
      for(const reason of reasons){
        reasonCounts.set(reason,(reasonCounts.get(reason)||0)+1);
      }
      const primaryReason=[...reasonCounts.entries()]
        .sort((a,b)=>b[1]-a[1])[0]?.[0]||"Belirgin ortak neden yok.";

      return{
        classroom,
        studentCount:list.length,
        criticalCount:list.filter(item=>item.predictedWarningLevel==="critical").length,
        worseningCount:list.filter(item=>item.trend==="worsening").length,
        averageWarningScore:Number(score.toFixed(1)),
        projectedCriticalCount:projectedCritical,
        primaryReason,
        level:levelFromScore(score),
      };
    })
    .sort((a,b)=>b.averageWarningScore-a.averageWarningScore);

  const subjectMap=new Map<string,{
    count:number;
    worsening:number;
    scores:number[];
  }>();

  for(const brain of cohort.ranking){
    const warning=students.find(item=>item.studentId===brain.student.id);
    for(const item of brain.factors.filter(factor=>factor.key.startsWith("subject:"))){
      const subject=item.key.replace("subject:","");
      const current=subjectMap.get(subject)||{count:0,worsening:0,scores:[]};
      if(item.score<60){
        current.count+=1;
        current.scores.push(item.score);
        if(warning?.trend==="worsening")current.worsening+=1;
      }
      subjectMap.set(subject,current);
    }
  }

  const subjectWarnings:SubjectEarlyWarning[]=[...subjectMap.entries()]
    .filter(([,value])=>value.count>0)
    .map(([subject,value])=>{
      const avg=average(value.scores);
      const warningScore=100-avg+value.worsening*2;
      return{
        subject,
        affectedStudentCount:value.count,
        worseningStudentCount:value.worsening,
        averageFactorScore:Number(avg.toFixed(1)),
        warningScore:Number(warningScore.toFixed(1)),
        level:levelFromScore(warningScore),
        primaryReason:value.worsening>0
          ?`${value.worsening} öğrencide ders performansı düşüş eğiliminde.`
          :`${value.count} öğrencide başarı göstergesi düşük.`,
      };
    })
    .sort((a,b)=>b.warningScore-a.warningScore);

  const criticalNow=students.filter(item=>item.currentPriorityLevel==="critical").length;
  const projectedCritical=students.filter(item=>
    item.predictedWarningLevel==="critical"||
    item.estimatedCriticalInExams===1
  ).length;
  const worseningStudentCount=students.filter(item=>item.trend==="worsening").length;
  const improvingStudentCount=students.filter(item=>item.trend==="improving").length;

  const status=projectedCritical/Math.max(1,students.length)>=.18
    ?"critical"
    :projectedCritical/Math.max(1,students.length)>=.08||
      worseningStudentCount/Math.max(1,students.length)>=.2
      ?"attention"
      :"stable";

  const recommendations=[
    students[0]
      ?`${students[0].studentName} ile başlayan ilk 10 öğrenci için erken müdahale planı oluşturun.`
      :undefined,
    classroomWarnings[0]
      ?`${classroomWarnings[0].classroom} sınıfını yakın izleme grubuna alın.`
      :undefined,
    subjectWarnings[0]
      ?`${subjectWarnings[0].subject} için branş bazlı ortak destek planı oluşturun.`
      :undefined,
    "Her yeni sınav sonrasında risk değişimini yeniden hesaplayın.",
  ].filter(Boolean) as string[];

  return{
    version:"2.0",
    generatedAt:new Date().toISOString(),
    totalStudents:students.length,
    criticalNow,
    projectedCritical,
    worseningStudentCount,
    improvingStudentCount,
    students,
    classroomWarnings,
    subjectWarnings,
    topWarnings:students.slice(0,20),
    summary:{
      status,
      headline:status==="critical"
        ?"Yaklaşan akademik riskler için hızlı müdahale gerekiyor"
        :status==="attention"
          ?"Bazı öğrenci ve sınıflarda risk artışı izleniyor"
          :"Erken uyarı görünümü dengeli",
      detail:`${students.length} öğrenci değerlendirildi. ${criticalNow} öğrenci şu anda kritik, ${projectedCritical} öğrencinin kısa vadede kritik düzeye ulaşma riski bulunuyor. ${worseningStudentCount} öğrenci düşüş eğiliminde.`,
    },
    recommendations,
  };
}
