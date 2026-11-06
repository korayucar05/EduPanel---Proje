import type {BrainCohortResult,BrainPriorityLevel} from "../brain";
import type {CopilotOptimizerResult} from "../optimizer";

export type SchoolScenario={
  weeklyExtraLessonMinutes:number;
  mockExamPerMonth:number;
  guidanceSessionsPerMonth:number;
  parentMeetingsPerMonth:number;
  attendanceReductionDays:number;
  targetClassroom?:string;
  targetSubject?:string;
};

export type SchoolScenarioImpact={
  baselineAverageNet:number;
  predictedAverageNet:number;
  netDifference:number;
  baselineBrainIndex:number;
  predictedBrainIndex:number;
  brainDifference:number;
  studentsLeavingCriticalRisk:number;
  studentsEnteringCriticalRisk:number;
  expectedTotalNetGain:number;
  confidence:number;
};

export type ClassroomTwinSummary={
  classroom:string;
  studentCount:number;
  averageNet:number;
  averageBrainScore:number;
  averagePriorityScore:number;
  criticalCount:number;
  highCount:number;
  mediumCount:number;
  lowCount:number;
  expectedGain:number;
};

export type BranchTwinSummary={
  subject:string;
  studentCount:number;
  averageSuccessRate:number;
  averageNet:number;
  priorityStudentCount:number;
  expectedGain:number;
  impactLevel:"high"|"medium"|"low";
};

export type SchoolDigitalTwinResult={
  version:"1.0";
  generatedAt:string;
  totalStudents:number;
  schoolBrainIndex:number;
  averageNet:number;
  criticalStudentCount:number;
  highPriorityCount:number;
  classroomSummaries:ClassroomTwinSummary[];
  branchSummaries:BranchTwinSummary[];
  scenario:SchoolScenario;
  scenarioImpact:SchoolScenarioImpact;
  optimizer?:CopilotOptimizerResult;
  executiveSummary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
  };
  recommendations:string[];
};

export type SchoolDigitalTwinInput={
  cohort:BrainCohortResult;
  scenario:SchoolScenario;
  optimizer?:CopilotOptimizerResult;
};
