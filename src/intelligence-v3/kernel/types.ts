import type {
  BrainCohortResult,
  BrainTimelineCohort,
  EarlyWarningCenterResult,
  UniversitySimulationResult,
} from "../../intelligence-v2";
import type {SchoolDigitalTwinResult} from "../../intelligence-v2/school-twin";
import type {ExecutiveCenterResult} from "../../intelligence-v2/executive";

export type KernelEventType=
  |"kernel:start"
  |"brain:completed"
  |"timeline:completed"
  |"warning:completed"
  |"school-twin:completed"
  |"university:completed"
  |"executive:completed"
  |"recommendations:completed"
  |"kernel:completed"
  |"kernel:error";

export type KernelEvent={
  id:string;
  type:KernelEventType;
  timestamp:string;
  title:string;
  detail?:string;
  durationMs?:number;
  payload?:Record<string,unknown>;
};

export type KernelRecommendationLevel="critical"|"high"|"medium"|"low";
export type KernelRecommendationOwner="management"|"teacher"|"guidance"|"parent";

export type KernelRecommendation={
  id:string;
  title:string;
  detail:string;
  action:string;
  level:KernelRecommendationLevel;
  owner:KernelRecommendationOwner;
  score:number;
  expectedGain?:number;
  classroom?:string;
  subject?:string;
  studentId?:string;
  source:string;
};

export type IntelligenceKernelInput={
  brain:BrainCohortResult;
  timeline?:BrainTimelineCohort;
  warning:EarlyWarningCenterResult;
  schoolTwin:SchoolDigitalTwinResult;
  university:UniversitySimulationResult;
  executive:ExecutiveCenterResult;
  cacheKey:string;
};

export type IntelligenceKernelResult={
  version:"1.0";
  generatedAt:string;
  cacheKey:string;
  brain:BrainCohortResult;
  timeline?:BrainTimelineCohort;
  warning:EarlyWarningCenterResult;
  schoolTwin:SchoolDigitalTwinResult;
  university:UniversitySimulationResult;
  executive:ExecutiveCenterResult;
  recommendations:KernelRecommendation[];
  events:KernelEvent[];
  summary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
  };
  metrics:{
    totalStudents:number;
    brainIndex:number;
    criticalStudents:number;
    projectedCriticalStudents:number;
    expectedNetGain:number;
    expectedPlacementGain:number;
    recommendationCount:number;
    processingMs:number;
  };
};
