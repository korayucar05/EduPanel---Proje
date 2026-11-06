import {autonomousStore} from "./autonomousStore";
import type {AutonomousAgentType,AutonomousSnapshot} from "./types";

const agents:AutonomousAgentType[]=[
  "morning",
  "day",
  "evening",
  "academic",
  "guidance",
  "parent",
  "university",
  "executive",
];

export function buildAutonomousSnapshot():AutonomousSnapshot{
  const tasks=autonomousStore.tasks();
  const runs=autonomousStore.runs();
  const memory=autonomousStore.memory();

  const morningRun=runs.find(item=>item.agent==="morning");
  const eveningRun=runs.find(item=>item.agent==="evening");

  return{
    generatedAt:new Date().toISOString(),
    activeAgentCount:agents.length,
    plannedTaskCount:tasks.filter(item=>item.status==="planned"||item.status==="active").length,
    completedTaskCount:tasks.filter(item=>item.status==="completed").length,
    morningBriefing:morningRun?.summary||"Sabah ajanı henüz çalışmadı.",
    eveningSummary:eveningRun?.summary||"Akşam ajanı henüz çalışmadı.",
    tasks,
    runs,
    interventionMemory:memory,
    agentStates:agents.map(agent=>{
      const last=runs.find(item=>item.agent===agent);
      return{
        agent,
        status:last?.status||"idle",
        lastRunAt:last?.completedAt||last?.startedAt,
        taskCount:tasks.filter(item=>item.agent===agent).length,
      };
    }),
  };
}
