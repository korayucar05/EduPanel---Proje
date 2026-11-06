import type {ReportIntelligenceRisk,ReportSubjectPriority,StudentReportV2Data} from "../../reports-v2/types";

export type TeacherInterventionLevel="monitor"|"support"|"urgent";

export type TeacherDecision={
  studentName:string;
  studentNumber?:string|number;
  classroom?:string;
  level:TeacherInterventionLevel;
  score:number;
  headline:string;
  rationale:string;
  primaryRisk?:ReportIntelligenceRisk;
  primaryPriority?:ReportSubjectPriority;
  recommendedActions:string[];
  nextReviewDays:number;
};

export type TeacherCohortDecision={
  generatedAt:string;
  totalStudents:number;
  urgentStudents:TeacherDecision[];
  supportStudents:TeacherDecision[];
  monitorStudents:TeacherDecision[];
  subjectHotspots:Array<{
    subject:string;
    studentCount:number;
    averageSuccessRate:number;
    suggestedWeeklyMinutes:number;
  }>;
};

export type TeacherDecisionInput=Pick<
  StudentReportV2Data,
  "student"|"totals"|"subjects"|"intelligence"|"teacherEvaluation"|"aiEvaluation"
>;
