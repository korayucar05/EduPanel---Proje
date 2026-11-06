import type {BrainCohortResult,BrainPriorityLevel,BrainScoreResult} from "../brain";

export type OptimizerResourceType="extra-lesson"|"teacher-support"|"guidance"|"parent-meeting";

export type CopilotOptimizerConfig={
  totalMinutes:number;
  minimumSessionMinutes:number;
  maximumSessionMinutes:number;
  sessionStepMinutes:number;
  resourceType:OptimizerResourceType;
  includePriorityLevels:BrainPriorityLevel[];
  maximumStudents?:number;
  classroomFilter?:string;
};

export type CopilotAllocation={
  rank:number;
  studentId:string;
  studentName:string;
  studentNumber?:string|number;
  classroom?:string;
  priorityLevel:BrainPriorityLevel;
  priorityScore:number;
  potentialScore:number;
  expectedGain:number;
  allocatedMinutes:number;
  expectedAllocatedGain:number;
  efficiency:number;
  primaryReason:string;
  recommendedAction:string;
};

export type CopilotOptimizerResult={
  version:"1.0";
  generatedAt:string;
  config:CopilotOptimizerConfig;
  totalAvailableMinutes:number;
  allocatedMinutes:number;
  unusedMinutes:number;
  selectedStudentCount:number;
  expectedTotalNetGain:number;
  averageEfficiency:number;
  allocations:CopilotAllocation[];
  excludedStudentCount:number;
  summary:string;
  recommendations:string[];
};

export type CopilotOptimizerInput={
  cohort:BrainCohortResult;
  config:CopilotOptimizerConfig;
};

export type OptimizerPreset={
  key:string;
  label:string;
  description:string;
  config:Partial<CopilotOptimizerConfig>;
};
