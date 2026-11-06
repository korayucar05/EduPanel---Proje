import type {StudentReportV2Data} from "../../reports-v2/types";
import type {TeacherDecision} from "../teacher";

export type AdminAlertLevel="info"|"warning"|"critical";

export type AdminAlert={
  key:string;
  title:string;
  detail:string;
  level:AdminAlertLevel;
  metric:string;
  recommendedAction:string;
};

export type ClassroomRiskSummary={
  classroom:string;
  studentCount:number;
  urgentCount:number;
  supportCount:number;
  monitorCount:number;
  averageSuccessRate:number;
  averageNet:number;
  riskScore:number;
};

export type GradeRiskSummary={
  grade:string;
  studentCount:number;
  urgentCount:number;
  averageSuccessRate:number;
  averageNet:number;
  riskScore:number;
};

export type SubjectRiskSummary={
  subject:string;
  studentCount:number;
  priorityCount:number;
  averageSuccessRate:number;
  averageNet:number;
  suggestedWeeklyMinutes:number;
};

export type AdminActionOwner="Yönetim"|"Rehberlik"|"Zümre"|"Sınıf Rehber Öğretmeni";
export type AdminActionUrgency="Bugün"|"3 gün içinde"|"Bu hafta"|"İzleme döngüsü";

export type AdminPriorityAction={
  id:string;
  priority:number;
  title:string;
  detail:string;
  owner:AdminActionOwner;
  urgency:AdminActionUrgency;
  expectedImpact:string;
  evidence:string;
};

export type AdminDecisionDashboard={
  version:"2.0";
  generatedAt:string;
  totalStudents:number;
  urgentStudentCount:number;
  supportStudentCount:number;
  monitorStudentCount:number;
  schoolAverageSuccessRate:number;
  schoolAverageNet:number;
  criticalClassCount:number;
  alerts:AdminAlert[];
  priorityActions:AdminPriorityAction[];
  urgentStudents:TeacherDecision[];
  classroomRisks:ClassroomRiskSummary[];
  gradeRisks:GradeRiskSummary[];
  subjectRisks:SubjectRiskSummary[];
  executiveSummary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
    decisionSentence:string;
  };
};

export type AdminDecisionInput=StudentReportV2Data[];
