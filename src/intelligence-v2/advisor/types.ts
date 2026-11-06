import type {AdminDecisionDashboard} from "../../intelligence/admin";
import type {TeacherCohortDecision} from "../../intelligence/teacher";
import type {StudentReportV2Data} from "../../reports-v2/types";

export type AdvisorAudience="admin"|"teacher"|"student"|"parent";

export type AdvisorSourceBundle={
  reports:StudentReportV2Data[];
  admin?:AdminDecisionDashboard;
  teacher?:TeacherCohortDecision;
};

export type AdvisorSuggestion={
  label:string;
  query:string;
};

export type AdvisorAnswer={
  version:"1.0";
  generatedAt:string;
  audience:AdvisorAudience;
  query:string;
  intent:
    |"risk-class"
    |"risk-students"
    |"subject-risk"
    |"priority"
    |"school-summary"
    |"student-summary"
    |"unknown";
  title:string;
  answer:string;
  evidence:string[];
  actions:string[];
  confidence:number;
  matchedEntities:{
    subject?:string;
    classroom?:string;
    studentName?:string;
  };
};
