export type WorkflowStatus=
  |"draft"
  |"planned"
  |"active"
  |"completed"
  |"cancelled";

export type WorkflowOwnerType=
  |"management"
  |"teacher"
  |"guidance"
  |"parent";

export type WorkflowAction={
  id:string;
  title:string;
  detail:string;
  ownerType:WorkflowOwnerType;
  ownerId?:string;
  ownerName?:string;
  studentId?:string;
  studentName?:string;
  classroom?:string;
  subject?:string;
  priority:1|2|3|4|5;
  status:WorkflowStatus;
  plannedAt:string;
  dueAt?:string;
  startedAt?:string;
  completedAt?:string;
  expectedGain?:number;
  observedGain?:number;
  effectivenessScore?:number;
  resultNote?:string;
  sourceTaskId?:string;
  sourceEventIds:string[];
  createdAt:string;
  updatedAt:string;
};

export type WorkflowSummary={
  generatedAt:string;
  total:number;
  draft:number;
  planned:number;
  active:number;
  completed:number;
  overdue:number;
  averageExpectedGain:number;
  averageObservedGain:number;
  averageEffectiveness:number;
  actions:WorkflowAction[];
};
