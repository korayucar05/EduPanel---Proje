import type {AutonomousSnapshot} from "../autonomous";
import {askHasatDecisionCenter} from "../decision-center";
import type {HasatLiveSnapshot,LiveSchoolEvent} from "../live";
import type {MissionControlSnapshot} from "./types";

export function buildMissionControlSnapshot({
  live,
  autonomous,
  events,
  studentCount,
  teacherCount,
  classroomCount,
}:{
  live:HasatLiveSnapshot;
  autonomous:AutonomousSnapshot;
  events:LiveSchoolEvent[];
  studentCount:number;
  teacherCount:number;
  classroomCount:number;
}):MissionControlSnapshot{
  const briefing=askHasatDecisionCenter({
    query:"Bugün okulda en önemli konu nedir?",
    context:{
      snapshot:live,
      events,
      studentCount,
      teacherCount,
      classroomCount,
    },
  });

  const status=
    live.criticalEventCount>0||live.schoolHealthScore<60
      ?"critical"
      :live.warningEventCount>0||live.schoolHealthScore<78
        ?"attention"
        :"stable";

  const headline=
    status==="critical"
      ?"Bugün kritik müdahale gereken gelişmeler var"
      :status==="attention"
        ?"Yakın izleme gerektiren konular var"
        :"Okulun canlı görünümü dengeli";

  const cards:MissionControlSnapshot["cards"]=[
    {
      key:"health",
      label:"Okul Sağlık",
      value:live.schoolHealthScore,
      detail:"Canlı okul nabzı",
      tone:live.schoolHealthScore>=80?"emerald":live.schoolHealthScore>=65?"amber":"rose",
    },
    {
      key:"critical",
      label:"Kritik Olay",
      value:live.criticalEventCount,
      detail:"Son 7 gün",
      tone:live.criticalEventCount?"rose":"emerald",
    },
    {
      key:"warnings",
      label:"Uyarı",
      value:live.warningEventCount,
      detail:"Yakın izleme",
      tone:live.warningEventCount?"amber":"emerald",
    },
    {
      key:"tasks",
      label:"Aktif Görev",
      value:autonomous.plannedTaskCount,
      detail:"Otonom ajanda",
      tone:autonomous.plannedTaskCount?"violet":"slate",
    },
    {
      key:"agents",
      label:"Ajan",
      value:autonomous.activeAgentCount,
      detail:"Aktif zekâ katmanı",
      tone:"blue",
    },
    {
      key:"memory",
      label:"Müdahale Hafızası",
      value:autonomous.interventionMemory.length,
      detail:"Kurumsal öğrenme",
      tone:"slate",
    },
  ];

  return{
    generatedAt:new Date().toISOString(),
    status,
    headline,
    detail:`${studentCount} öğrenci, ${teacherCount} öğretmen ve ${classroomCount} sınıf tek merkezde izleniyor.`,
    cards,
    dailyBriefing:briefing,
    live,
    autonomous,
    topTasks:autonomous.tasks
      .filter(item=>item.status==="planned"||item.status==="active")
      .sort((a,b)=>b.priority-a.priority)
      .slice(0,10)
      .map(item=>({
        id:item.id,
        title:item.title,
        detail:item.detail,
        owner:item.owner,
        priority:item.priority,
        status:item.status,
        dueAt:item.dueAt,
      })),
    topEvents:live.recentEvents.slice(0,10).map(item=>({
      id:item.id,
      title:item.title,
      detail:item.detail,
      level:item.level,
      source:item.source,
      occurredAt:item.occurredAt,
    })),
  };
}
