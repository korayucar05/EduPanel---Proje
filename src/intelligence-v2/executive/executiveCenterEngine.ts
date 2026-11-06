import {buildExecutiveAlerts} from "./earlyWarningCenter";
import {buildExecutiveTasks} from "./executiveAgenda";
import type {ExecutiveCenterInput,ExecutiveCenterResult} from "./types";

const clamp=(value:number,min=0,max=100)=>
  Math.max(min,Math.min(max,value));

export function buildExecutiveCenter(
  input:ExecutiveCenterInput,
):ExecutiveCenterResult{
  const {cohort,schoolTwin}=input;
  const criticalRate=cohort.totalStudents
    ?cohort.criticalCount/cohort.totalStudents*100
    :0;
  const highRate=cohort.totalStudents
    ?cohort.highCount/cohort.totalStudents*100
    :0;

  const schoolHealthScore=clamp(
    schoolTwin.schoolBrainIndex*.62+
    (100-criticalRate)*.24+
    (100-highRate)*.14
  );

  const alerts=buildExecutiveAlerts(input);
  const tasks=buildExecutiveTasks(input);
  const status=alerts.some(item=>item.level==="critical")
    ?"critical"
    :alerts.filter(item=>item.level==="warning").length>=2
      ?"attention"
      :"stable";

  const classroomMap=schoolTwin.classroomSummaries.map(item=>({
    classroom:item.classroom,
    score:item.averagePriorityScore,
    level:item.averagePriorityScore>=65
      ?"critical"
      :item.averagePriorityScore>=40
        ?"warning"
        :"positive",
    criticalCount:item.criticalCount,
    highCount:item.highCount,
  })) as ExecutiveCenterResult["classroomMap"];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    schoolHealthScore:Number(schoolHealthScore.toFixed(1)),
    brainIndex:Number(schoolTwin.schoolBrainIndex.toFixed(1)),
    criticalStudentCount:cohort.criticalCount,
    highPriorityCount:cohort.highCount,
    expectedTotalNetGain:Number(
      schoolTwin.scenarioImpact.expectedTotalNetGain.toFixed(1)
    ),
    leadingClassroom:schoolTwin.classroomSummaries[0]?.classroom,
    leadingSubject:schoolTwin.branchSummaries[0]?.subject,
    alerts,
    tasks,
    classroomMap,
    summary:{
      status,
      headline:status==="critical"
        ?"Bugün yönetim müdahalesi gereken kritik alanlar var"
        :status==="attention"
          ?"Yakın izleme gerektiren akademik alanlar var"
          :"Okul akademik görünümü dengeli",
      detail:[
        `Okul sağlık skoru ${schoolHealthScore.toFixed(1)}.`,
        `${cohort.criticalCount} kritik, ${cohort.highCount} yüksek öncelikli öğrenci bulunuyor.`,
        `Planlanan müdahalelerin toplam beklenen etkisi +${schoolTwin.scenarioImpact.expectedTotalNetGain.toFixed(1)} nettir.`,
      ].join(" "),
    },
  };
}
