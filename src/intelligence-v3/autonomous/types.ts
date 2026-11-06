import type {HasatLiveSnapshot,LiveSchoolEvent} from "../live";

export type AutonomousAgentType=
  |"morning"
  |"day"
  |"evening"
  |"academic"
  |"guidance"
  |"parent"
  |"university"
  |"executive";

export type AutonomousAgentStatus="idle"|"running"|"completed"|"error";

export type AutonomousTask={
  id:string;
  agent:AutonomousAgentType;
  title:string;
  detail:string;
  owner:"management"|"teacher"|"guidance"|"parent";
  priority:1|2|3|4|5;
  dueAt?:string;
  expectedGain?:number;
  status:"planned"|"active"|"completed"|"cancelled";
  sourceEventIds:string[];
  createdAt:string;
};

export type AutonomousRun={
  id:string;
  agent:AutonomousAgentType;
  startedAt:string;
  completedAt?:string;
  status:AutonomousAgentStatus;
  summary:string;
  createdTaskIds:string[];
  processedEventCount:number;
  error?:string;
};

export type InterventionMemoryRecord={
  id:string;
  interventionType:string;
  title:string;
  startedAt:string;
  completedAt?:string;
  targetType:"student"|"classroom"|"subject"|"school";
  targetId?:string;
  targetLabel?:string;
  expectedGain?:number;
  observedGain?:number;
  effectivenessScore?:number;
  outcome:"pending"|"effective"|"limited"|"ineffective";
  notes?:string;
};

export type AutonomousSnapshot={
  generatedAt:string;
  activeAgentCount:number;
  plannedTaskCount:number;
  completedTaskCount:number;
  morningBriefing:string;
  eveningSummary:string;
  tasks:AutonomousTask[];
  runs:AutonomousRun[];
  interventionMemory:InterventionMemoryRecord[];
  agentStates:Array<{
    agent:AutonomousAgentType;
    status:AutonomousAgentStatus;
    lastRunAt?:string;
    taskCount:number;
  }>;
};

export type AutonomousContext={
  live:HasatLiveSnapshot;
  events:LiveSchoolEvent[];
  studentCount:number;
  teacherCount:number;
  classroomCount:number;
};
