import type {BrainCohortResult,BrainPriorityLevel,BrainScoreResult} from "../brain";
import type {BrainTimelineCohort,BrainTimelineResult} from "../timeline";

export type EarlyWarningLevel="critical"|"high"|"medium"|"low";
export type EarlyWarningTrend="worsening"|"stable"|"improving"|"insufficient";

export type StudentEarlyWarning={
  studentId:string;
  studentName:string;
  studentNumber?:string|number;
  classroom?:string;
  currentPriorityLevel:BrainPriorityLevel;
  predictedWarningLevel:EarlyWarningLevel;
  trend:EarlyWarningTrend;
  warningScore:number;
  riskIncrease:number;
  estimatedCriticalInExams?:number;
  reasons:string[];
  recommendedActions:string[];
  confidence:number;
};

export type ClassroomEarlyWarning={
  classroom:string;
  studentCount:number;
  criticalCount:number;
  worseningCount:number;
  averageWarningScore:number;
  projectedCriticalCount:number;
  primaryReason:string;
  level:EarlyWarningLevel;
};

export type SubjectEarlyWarning={
  subject:string;
  affectedStudentCount:number;
  worseningStudentCount:number;
  averageFactorScore:number;
  warningScore:number;
  level:EarlyWarningLevel;
  primaryReason:string;
};

export type EarlyWarningCenterResult={
  version:"2.0";
  generatedAt:string;
  totalStudents:number;
  criticalNow:number;
  projectedCritical:number;
  worseningStudentCount:number;
  improvingStudentCount:number;
  students:StudentEarlyWarning[];
  classroomWarnings:ClassroomEarlyWarning[];
  subjectWarnings:SubjectEarlyWarning[];
  topWarnings:StudentEarlyWarning[];
  summary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
  };
  recommendations:string[];
};

export type EarlyWarningCenterInput={
  cohort:BrainCohortResult;
  timeline?:BrainTimelineCohort;
};
