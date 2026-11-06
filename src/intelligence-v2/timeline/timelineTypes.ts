import type {AcademicDna2Result} from "../dna";
import type {BrainScoreResult} from "../brain";
import type {StudentReportV2Data} from "../../reports-v2/types";

export type BrainTimelineTrend="rising"|"stable"|"falling"|"volatile"|"insufficient";
export type InterventionOutcome="effective"|"limited"|"ineffective"|"pending";

export type BrainTimelinePoint={
  examId:string;
  examName:string;
  examDate:string;
  net:number;
  successRate:number;
  score?:number;
  brainScore:number;
  priorityScore:number;
  potentialScore:number;
  expectedGain:number;
  riskLevel:BrainScoreResult["priorityLevel"];
  academicDnaScore:number;
  academicDnaConfidence:number;
};

export type InterventionMemoryItem={
  id:string;
  date:string;
  title:string;
  type:string;
  status:string;
  expectedNetGain?:number;
  observedNetGain?:number;
  outcome:InterventionOutcome;
  effectivenessScore:number;
  explanation:string;
};

export type BrainTimelineResult={
  version:"1.0";
  generatedAt:string;
  student:{
    id:string;
    name:string;
    number?:string|number;
    classroom?:string;
  };
  points:BrainTimelinePoint[];
  trend:BrainTimelineTrend;
  netChange:number;
  successRateChange:number;
  brainScoreChange:number;
  priorityScoreChange:number;
  bestPeriod?:BrainTimelinePoint;
  criticalPeriod?:BrainTimelinePoint;
  interventionMemory:InterventionMemoryItem[];
  summary:string;
  recommendations:string[];
  confidence:number;
};

export type BrainTimelineSnapshotInput={
  report:StudentReportV2Data;
  brain:BrainScoreResult;
  dna:AcademicDna2Result;
};

export type BrainTimelineInput={
  snapshots:BrainTimelineSnapshotInput[];
};

export type BrainTimelineCohort={
  generatedAt:string;
  totalStudents:number;
  sufficientHistoryCount:number;
  risingCount:number;
  stableCount:number;
  fallingCount:number;
  volatileCount:number;
  averageNetChange:number;
  averageBrainChange:number;
  timelines:BrainTimelineResult[];
  interventionSummary:Array<{
    type:string;
    count:number;
    effectiveCount:number;
    averageObservedGain:number;
    effectivenessRate:number;
  }>;
};
