import {autonomousStore} from "./autonomousStore";
import type {
  AutonomousAgentType,
  AutonomousContext,
  AutonomousRun,
  AutonomousTask,
} from "./types";

const now=()=>new Date().toISOString();
const id=(prefix:string)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

const taskFrom=({
  agent,
  title,
  detail,
  owner,
  priority,
  dueHours,
  expectedGain,
  sourceEventIds,
}:{
  agent:AutonomousAgentType;
  title:string;
  detail:string;
  owner:AutonomousTask["owner"];
  priority:AutonomousTask["priority"];
  dueHours:number;
  expectedGain?:number;
  sourceEventIds:string[];
}):AutonomousTask=>({
  id:id("task"),
  agent,
  title,
  detail,
  owner,
  priority,
  dueAt:new Date(Date.now()+dueHours*3_600_000).toISOString(),
  expectedGain,
  status:"planned",
  sourceEventIds,
  createdAt:now(),
});

const finalizeRun=(
  run:AutonomousRun,
  tasks:AutonomousTask[],
  summary:string,
)=>{
  for(const task of tasks)autonomousStore.upsertTask(task);
  return autonomousStore.addRun({
    ...run,
    completedAt:now(),
    status:"completed",
    summary,
    createdTaskIds:tasks.map(item=>item.id),
  });
};

export function runMorningAgent(context:AutonomousContext){
  const run:AutonomousRun={
    id:id("morning"),
    agent:"morning",
    startedAt:now(),
    status:"running",
    summary:"",
    createdTaskIds:[],
    processedEventCount:context.events.length,
  };

  const tasks:AutonomousTask[]=[];
  const critical=context.events.filter(item=>item.level==="critical").slice(0,5);
  const warnings=context.events.filter(item=>item.level==="warning").slice(0,5);

  for(const event of critical){
    tasks.push(taskFrom({
      agent:"morning",
      title:event.title,
      detail:event.detail,
      owner:event.source==="guidance"?"guidance":event.source==="parent"?"parent":"management",
      priority:5,
      dueHours:4,
      sourceEventIds:[event.id],
    }));
  }

  for(const event of warnings){
    tasks.push(taskFrom({
      agent:"morning",
      title:event.title,
      detail:event.detail,
      owner:event.source==="attendance"?"management":"teacher",
      priority:4,
      dueHours:24,
      sourceEventIds:[event.id],
    }));
  }

  const summary=critical.length
    ?`Sabah ajanı ${critical.length} kritik ve ${warnings.length} uyarı kaydından ${tasks.length} görev oluşturdu.`
    :`Sabah ajanı ${warnings.length} uyarı kaydını değerlendirdi; kritik olay bulunmadı.`;

  return finalizeRun(run,tasks,summary);
}

export function runDayAgent(context:AutonomousContext){
  const run:AutonomousRun={
    id:id("day"),
    agent:"day",
    startedAt:now(),
    status:"running",
    summary:"",
    createdTaskIds:[],
    processedEventCount:context.events.length,
  };

  const today=context.events.filter(item=>
    new Date(item.occurredAt).toDateString()===new Date().toDateString()
  );
  const tasks:AutonomousTask[]=[];

  const attendance=today.filter(item=>item.source==="attendance"&&(item.level==="critical"||item.level==="warning"));
  if(attendance.length){
    tasks.push(taskFrom({
      agent:"day",
      title:"Gün içi devamsızlık kontrolü",
      detail:`Bugün ${attendance.length} devamsızlık uyarısı oluştu.`,
      owner:"management",
      priority:attendance.some(item=>item.level==="critical")?5:4,
      dueHours:3,
      sourceEventIds:attendance.map(item=>item.id),
    }));
  }

  const homework=today.filter(item=>item.source==="homework"&&(item.level==="critical"||item.level==="warning"));
  if(homework.length){
    tasks.push(taskFrom({
      agent:"academic",
      title:"Ödev ve çalışma düzeni takibi",
      detail:`Bugün ${homework.length} ödev uyarısı işlendi.`,
      owner:"teacher",
      priority:4,
      dueHours:12,
      sourceEventIds:homework.map(item=>item.id),
    }));
  }

  return finalizeRun(
    run,
    tasks,
    `Gün içi ajan ${today.length} olayı değerlendirdi ve ${tasks.length} yeni görev üretti.`,
  );
}

export function runEveningAgent(context:AutonomousContext){
  const run:AutonomousRun={
    id:id("evening"),
    agent:"evening",
    startedAt:now(),
    status:"running",
    summary:"",
    createdTaskIds:[],
    processedEventCount:context.events.length,
  };

  const today=context.events.filter(item=>
    new Date(item.occurredAt).toDateString()===new Date().toDateString()
  );
  const positive=today.filter(item=>item.level==="positive").length;
  const critical=today.filter(item=>item.level==="critical").length;
  const tasks:AutonomousTask[]=[];

  if(critical){
    tasks.push(taskFrom({
      agent:"evening",
      title:"Yarın için kritik takip listesi",
      detail:`Bugün kapanmayan ${critical} kritik olay yarın sabah yeniden değerlendirilmelidir.`,
      owner:"management",
      priority:5,
      dueHours:12,
      sourceEventIds:today.filter(item=>item.level==="critical").map(item=>item.id),
    }));
  }

  const summary=`Akşam ajanı bugün işlenen ${today.length} olayı özetledi. ${positive} olumlu, ${critical} kritik gelişme kaydedildi.`;
  return finalizeRun(run,tasks,summary);
}

export function runAllAutonomousAgents(context:AutonomousContext){
  const hour=new Date().getHours();
  const runs:AutonomousRun[]=[];

  if(hour<11)runs.push(runMorningAgent(context));
  else if(hour<17)runs.push(runDayAgent(context));
  else runs.push(runEveningAgent(context));

  return runs;
}
