import type {
  AcademicDnaProfile,
  ParentSupportPlan,
  PersonalizedAiEvaluation,
  StudentReportV2Data,
  StudentTargetAnalysis,
  SuccessPrediction,
} from "../../reports-v2/types";

export type HasatDataScope = "single-exam" | "multi-exam";

export type StudentExamSnapshot = Pick<
  StudentReportV2Data,
  "examName" | "examDate" | "reportDate" | "totals" | "subjects"
>;

export type IntelligenceContext = {
  current: StudentReportV2Data;
  history?: readonly StudentExamSnapshot[];
  generatedAt?: string;
};

export type RecommendationPriority = 1 | 2 | 3 | 4 | 5;

export type HasatRecommendation = {
  id: string;
  title: string;
  detail: string;
  subject?: string;
  category: "academic" | "habit" | "target" | "family";
  priority: RecommendationPriority;
  weeklyMinutes?: number;
  evidence: string[];
};

export type StudentIntelligenceBundle = {
  version: "1.0";
  generatedAt: string;
  dataScope: HasatDataScope;
  academicDna: AcademicDnaProfile;
  prediction: SuccessPrediction;
  recommendations: HasatRecommendation[];
  targetAnalysis?: StudentTargetAnalysis;
  aiEvaluation?: PersonalizedAiEvaluation;
  parentSupport?: ParentSupportPlan;
};
