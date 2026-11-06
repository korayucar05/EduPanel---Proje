import type {
  HasatLiveSnapshot,
  LiveActionItem,
  LiveSchoolEvent,
  SchoolPulseMetric,
} from "./types";

const clamp=(value:number,min=0,max=100)=>
  Math.max(min,Math.min(max,value));

const direction=(change:number)=>
  change>.25?"up" as const:change<-.25?"down" as const:"stable" as const;

const metric=(
  key:string,
  label:string,
  value:number,
  previousValue:number,
  inverse=false,
):SchoolPulseMetric=>{
  const change=value-previousValue;
  const effective=inverse?-change:change;
  return{
    key,
    label,
    value:Number(value.toFixed(1)),
    previousValue:Number(previousValue.toFixed(1)),
    change:Number(change.toFixed(1)),
    direction:direction(change),
    health:effective>=2?"good":effective<=-2?"critical":"attention",
  };
};

export function buildHasatLiveSnapshot({
  events,
  studentCount,
  teacherCount,
  classroomCount,
}:{
  events:LiveSchoolEvent[];
  studentCount:number;
  teacherCount:number;
  classroomCount:number;
}):HasatLiveSnapshot{
  const recent=events.filter(item=>
    new Date(item.occurredAt).getTime()>=Date.now()-7*86_400_000
  );
  const previous=events.filter(item=>{
    const time=new Date(item.occurredAt).getTime();
    return time<Date.now()-7*86_400_000&&time>=Date.now()-14*86_400_000;
  });

  const count=(list:LiveSchoolEvent[],level:string)=>
    list.filter(item=>item.level===level).length;
  const sourceCount=(list:LiveSchoolEvent[],source:string)=>
    list.filter(item=>item.source===source).length;

  const critical=count(recent,"critical");
  const warning=count(recent,"warning");
  const positive=count(recent,"positive");
  const previousCritical=count(previous,"critical");
  const previousWarning=count(previous,"warning");
  const previousPositive=count(previous,"positive");

  const academicHealth=clamp(86-critical*4-warning*1.4+positive*.8);
  const previousAcademic=clamp(86-previousCritical*4-previousWarning*1.4+previousPositive*.8);
  const attendanceHealth=clamp(94-sourceCount(recent,"attendance")*2.4);
  const previousAttendance=clamp(94-sourceCount(previous,"attendance")*2.4);
  const homeworkHealth=clamp(90-sourceCount(recent,"homework")*1.9);
  const previousHomework=clamp(90-sourceCount(previous,"homework")*1.9);
  const guidanceHealth=clamp(72+sourceCount(recent,"guidance")*2.2);
  const previousGuidance=clamp(72+sourceCount(previous,"guidance")*2.2);
  const parentHealth=clamp(68+sourceCount(recent,"parent")*1.8);
  const previousParent=clamp(68+sourceCount(previous,"parent")*1.8);

  const pulse=[
    metric("academic","Akademik Sağlık",academicHealth,previousAcademic),
    metric("attendance","Devam Sağlığı",attendanceHealth,previousAttendance),
    metric("homework","Ödev Düzeni",homeworkHealth,previousHomework),
    metric("guidance","Rehberlik Etkileşimi",guidanceHealth,previousGuidance),
    metric("parent","Veli Etkileşimi",parentHealth,previousParent),
  ];

  const actions:LiveActionItem[]=recent
    .filter(item=>item.level==="critical"||item.level==="warning")
    .slice(0,15)
    .map((item,index)=>({
      id:`action-${item.id}`,
      title:item.title,
      detail:item.detail,
      owner:item.source==="guidance"
        ?"guidance"
        :item.source==="parent"
          ?"parent"
          :item.source==="attendance"||item.source==="behavior"
            ?"management"
            :"teacher",
      priority:item.level==="critical"?5:4,
      dueDays:item.level==="critical"?1:3,
      sourceEventId:item.id,
    }));

  const schoolHealthScore=clamp(
    pulse.reduce((sum,item)=>sum+item.value,0)/Math.max(1,pulse.length)
    -critical*1.5
  );

  const headline=critical
    ?`Bugün ${critical} kritik gelişme var`
    :warning
      ?`Bugün ${warning} konu yakın izleme gerektiriyor`
      :"Okulun canlı görünümü dengeli";

  return{
    generatedAt:new Date().toISOString(),
    schoolHealthScore:Number(schoolHealthScore.toFixed(1)),
    criticalEventCount:critical,
    warningEventCount:warning,
    positiveEventCount:positive,
    pulse,
    actions,
    recentEvents:recent.slice(0,30),
    briefing:{
      headline,
      detail:`${studentCount} öğrenci, ${teacherCount} öğretmen ve ${classroomCount} sınıf için son yedi günlük canlı olaylar değerlendirildi.`,
    },
  };
}
