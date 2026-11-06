import {buildTeacherDecision} from "../teacher";
import type {
  AdminAlert,
  AdminDecisionDashboard,
  AdminDecisionInput,
  AdminPriorityAction,
  ClassroomRiskSummary,
  GradeRiskSummary,
  SubjectRiskSummary,
} from "./types";

const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

const gradeOf=(classroom:string)=>{
  const match=String(classroom||"").match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
  return match?`${match[1]}. Sınıf`:"Düzey Bilgisi Yok";
};

export function buildAdminDecisionDashboard(
  reports:AdminDecisionInput,
):AdminDecisionDashboard{
  const decisions=reports.map(buildTeacherDecision);
  const totalStudents=reports.length;

  const urgentStudents=decisions
    .filter(item=>item.level==="urgent")
    .sort((a,b)=>b.score-a.score);
  const supportStudents=decisions.filter(item=>item.level==="support");
  const monitorStudents=decisions.filter(item=>item.level==="monitor");

  const schoolAverageSuccessRate=average(
    reports.map(report=>Number(report.totals.successRate||0)),
  );
  const schoolAverageNet=average(
    reports.map(report=>Number(report.totals.net||0)),
  );

  const classroomMap=new Map<string,{reports:typeof reports;decisions:typeof decisions}>();
  reports.forEach((report,index)=>{
    const classroom=String(report.student.classroom||report.student.branch||"Sınıf Bilgisi Yok");
    const current=classroomMap.get(classroom)||{reports:[],decisions:[]};
    current.reports.push(report);
    current.decisions.push(decisions[index]);
    classroomMap.set(classroom,current);
  });

  const classroomRisks:ClassroomRiskSummary[]=[...classroomMap.entries()]
    .map(([classroom,value])=>{
      const urgentCount=value.decisions.filter(item=>item.level==="urgent").length;
      const supportCount=value.decisions.filter(item=>item.level==="support").length;
      const monitorCount=value.decisions.filter(item=>item.level==="monitor").length;
      const riskScore=average(value.decisions.map(item=>item.score));
      return{
        classroom,
        studentCount:value.reports.length,
        urgentCount,
        supportCount,
        monitorCount,
        averageSuccessRate:Number(average(value.reports.map(item=>Number(item.totals.successRate||0))).toFixed(1)),
        averageNet:Number(average(value.reports.map(item=>Number(item.totals.net||0))).toFixed(2)),
        riskScore:Number(riskScore.toFixed(1)),
      };
    })
    .sort((a,b)=>b.riskScore-a.riskScore);

  const gradeMap=new Map<string,ClassroomRiskSummary[]>();
  classroomRisks.forEach(item=>{
    const grade=gradeOf(item.classroom);
    gradeMap.set(grade,[...(gradeMap.get(grade)||[]),item]);
  });
  const gradeRisks:GradeRiskSummary[]=[...gradeMap.entries()].map(([grade,items])=>({
    grade,
    studentCount:items.reduce((sum,item)=>sum+item.studentCount,0),
    urgentCount:items.reduce((sum,item)=>sum+item.urgentCount,0),
    averageSuccessRate:Number(average(items.map(item=>item.averageSuccessRate)).toFixed(1)),
    averageNet:Number(average(items.map(item=>item.averageNet)).toFixed(2)),
    riskScore:Number(average(items.map(item=>item.riskScore)).toFixed(1)),
  })).sort((a,b)=>b.riskScore-a.riskScore);

  const subjectMap=new Map<string,{studentCount:number;priorityCount:number;successRates:number[];nets:number[];minutes:number[]}>();
  for(const report of reports){
    for(const subject of report.subjects||[]){
      const current=subjectMap.get(subject.subjectName)||{studentCount:0,priorityCount:0,successRates:[],nets:[],minutes:[]};
      current.studentCount+=1;
      current.successRates.push(Number(subject.successRate||0));
      current.nets.push(Number(subject.net||0));
      const priority=report.intelligence?.subjectPriorities?.find(item=>item.subject===subject.subjectName);
      if(priority){
        current.priorityCount+=1;
        current.minutes.push(priority.weeklyMinutes);
      }
      subjectMap.set(subject.subjectName,current);
    }
  }

  const subjectRisks:SubjectRiskSummary[]=[...subjectMap.entries()]
    .map(([subject,value])=>({
      subject,
      studentCount:value.studentCount,
      priorityCount:value.priorityCount,
      averageSuccessRate:Number(average(value.successRates).toFixed(1)),
      averageNet:Number(average(value.nets).toFixed(2)),
      suggestedWeeklyMinutes:Math.round(average(value.minutes)),
    }))
    .sort((a,b)=>b.priorityCount-a.priorityCount||a.averageSuccessRate-b.averageSuccessRate)
    .slice(0,12);

  const alerts:AdminAlert[]=[];
  const urgentRate=totalStudents?urgentStudents.length/totalStudents*100:0;
  if(urgentRate>=15) alerts.push({
    key:"urgent-student-density",
    title:"Acil müdahale gerektiren öğrenci yoğunluğu",
    detail:`Öğrencilerin %${urgentRate.toFixed(1)}'i acil müdahale grubundadır.`,
    level:urgentRate>=30?"critical":"warning",
    metric:`${urgentStudents.length} öğrenci`,
    recommendedAction:"Rehberlik, sınıf rehber öğretmeni ve branş öğretmenleriyle öğrenci bazlı müdahale toplantısı planlayın.",
  });

  const riskyClass=classroomRisks[0];
  if(riskyClass&&riskyClass.riskScore>=45) alerts.push({
    key:`classroom-${riskyClass.classroom}`,
    title:`${riskyClass.classroom} sınıfında risk yoğunluğu`,
    detail:`Sınıf risk puanı ${riskyClass.riskScore}/100, başarı ortalaması %${riskyClass.averageSuccessRate}.`,
    level:riskyClass.riskScore>=65?"critical":"warning",
    metric:`${riskyClass.urgentCount} acil`,
    recommendedAction:"Şube bazlı ders, devamsızlık ve rehberlik verilerini birlikte inceleyin.",
  });

  const riskySubject=subjectRisks[0];
  if(riskySubject&&riskySubject.priorityCount>0) alerts.push({
    key:`subject-${riskySubject.subject}`,
    title:`${riskySubject.subject} ortak gelişim alanı`,
    detail:`${riskySubject.priorityCount} öğrencide öncelikli ders olarak belirlenmiştir. Ortalama başarı %${riskySubject.averageSuccessRate}.`,
    level:riskySubject.priorityCount>=Math.max(5,totalStudents*.25)?"critical":"warning",
    metric:`${riskySubject.priorityCount} öğrenci`,
    recommendedAction:"Branş zümresiyle ortak kazanım, soru ve müdahale planı oluşturun.",
  });

  if(schoolAverageSuccessRate<50&&totalStudents>0) alerts.push({
    key:"school-success",
    title:"Kurum başarı ortalaması kritik eşik altında",
    detail:`Genel başarı oranı %${schoolAverageSuccessRate.toFixed(1)} düzeyindedir.`,
    level:"critical",
    metric:`%${schoolAverageSuccessRate.toFixed(1)}`,
    recommendedAction:"Sınıf ve ders bazlı önceliklendirilmiş akademik iyileştirme planı başlatın.",
  });

  if(!alerts.length&&totalStudents>0) alerts.push({
    key:"stable",
    title:"Kurum akademik görünümü dengeli",
    detail:"Mevcut veride kritik yoğunlukta ortak bir risk alanı bulunmamaktadır.",
    level:"info",
    metric:`${totalStudents} öğrenci`,
    recommendedAction:"Aylık izleme döngüsünü ve erken uyarı kontrollerini sürdürün.",
  });

  const priorityActions:AdminPriorityAction[]=[];
  if(urgentStudents.length) priorityActions.push({
    id:"urgent-students",
    priority:5,
    title:`${urgentStudents.length} öğrenci için bireysel müdahale dosyası açın`,
    detail:"En yüksek risk puanlı öğrencilerden başlayarak öğrenci, veli ve öğretmen görüşmelerini tek eylem planında birleştirin.",
    owner:"Rehberlik",
    urgency:urgentRate>=25?"Bugün":"3 gün içinde",
    expectedImpact:"Kritik öğrenci risklerinde hızlı düşüş",
    evidence:`Acil grup oranı %${urgentRate.toFixed(1)}`,
  });
  if(riskyClass&&riskyClass.riskScore>=40) priorityActions.push({
    id:`class-${riskyClass.classroom}`,
    priority:riskyClass.riskScore>=65?5:4,
    title:`${riskyClass.classroom} şubesi için iyileştirme toplantısı yapın`,
    detail:"Sınıf rehber öğretmeni, ilgili branşlar ve rehberlik servisiyle ortak nedenleri ve ilk iki haftalık müdahaleyi belirleyin.",
    owner:"Sınıf Rehber Öğretmeni",
    urgency:riskyClass.riskScore>=65?"3 gün içinde":"Bu hafta",
    expectedImpact:"Şube risk yoğunluğunda azalma",
    evidence:`Risk ${riskyClass.riskScore}/100 · ${riskyClass.urgentCount} acil öğrenci`,
  });
  if(riskySubject&&riskySubject.priorityCount>0) priorityActions.push({
    id:`subject-${riskySubject.subject}`,
    priority:riskySubject.priorityCount>=Math.max(5,totalStudents*.25)?5:4,
    title:`${riskySubject.subject} zümre müdahale planını başlatın`,
    detail:"Ortak kazanım eksiklerini belirleyin; kısa tarama, etüt ve yeniden ölçme takvimi hazırlayın.",
    owner:"Zümre",
    urgency:"Bu hafta",
    expectedImpact:`${riskySubject.priorityCount} öğrencide ders bazlı gelişim`,
    evidence:`Başarı %${riskySubject.averageSuccessRate} · öneri ${riskySubject.suggestedWeeklyMinutes||0} dk/hafta`,
  });
  if(schoolAverageSuccessRate<60&&totalStudents>0) priorityActions.push({
    id:"school-plan",
    priority:schoolAverageSuccessRate<50?5:3,
    title:"Kurum akademik iyileştirme hedefini güncelleyin",
    detail:"Sınıf ve ders bazlı iki ölçülebilir hedef belirleyin; sonraki deneme sınavında ilerlemeyi aynı göstergelerle karşılaştırın.",
    owner:"Yönetim",
    urgency:schoolAverageSuccessRate<50?"3 gün içinde":"Bu hafta",
    expectedImpact:"Kurum genelinde ölçülebilir ilerleme",
    evidence:`Genel başarı %${schoolAverageSuccessRate.toFixed(1)}`,
  });
  if(!priorityActions.length) priorityActions.push({
    id:"routine-monitoring",
    priority:2,
    title:"Dengeli görünümü koruma planını sürdürün",
    detail:"Erken uyarı kontrollerini aylık olarak yenileyin ve sınıf/ders değişimlerini karşılaştırın.",
    owner:"Yönetim",
    urgency:"İzleme döngüsü",
    expectedImpact:"Risklerin kritik düzeye çıkmadan fark edilmesi",
    evidence:"Kritik ortak risk bulunmadı",
  });
  priorityActions.sort((a,b)=>b.priority-a.priority);

  const criticalCount=alerts.filter(item=>item.level==="critical").length;
  const warningCount=alerts.filter(item=>item.level==="warning").length;
  const status=criticalCount>0?"critical":warningCount>1?"attention":"stable";
  const headline=status==="critical"?"Yönetim müdahalesi gereken kritik alanlar var":status==="attention"?"Yakın izleme gerektiren akademik alanlar var":"Kurum akademik görünümü dengeli";
  const detail=[
    `${totalStudents} öğrenci değerlendirildi.`,
    `${urgentStudents.length} acil, ${supportStudents.length} destek, ${monitorStudents.length} izleme grubunda.`,
    `Genel başarı %${schoolAverageSuccessRate.toFixed(1)}, ortalama net ${schoolAverageNet.toFixed(2)}.`,
  ].join(" ");
  const firstAction=priorityActions[0];
  const decisionSentence=firstAction
    ?`İlk yönetim kararı: ${firstAction.title} Sorumlu: ${firstAction.owner}; süre: ${firstAction.urgency.toLocaleLowerCase("tr-TR")}.`
    :"Mevcut izleme döngüsünü sürdürün.";

  return{
    version:"2.0",
    generatedAt:new Date().toISOString(),
    totalStudents,
    urgentStudentCount:urgentStudents.length,
    supportStudentCount:supportStudents.length,
    monitorStudentCount:monitorStudents.length,
    schoolAverageSuccessRate:Number(schoolAverageSuccessRate.toFixed(1)),
    schoolAverageNet:Number(schoolAverageNet.toFixed(2)),
    criticalClassCount:classroomRisks.filter(item=>item.riskScore>=65).length,
    alerts,
    priorityActions,
    urgentStudents,
    classroomRisks,
    gradeRisks,
    subjectRisks,
    executiveSummary:{status,headline,detail,decisionSentence},
  };
}
