import type {
  AcademicDnaProfile,
  ParentSupportPlan,
  PersonalizedAiEvaluation,
  StudentTargetAnalysis,
  SuccessPrediction,
  SubjectPerformance,
} from "../reports-v2/types";

export type IntelligenceRiskLevel="low"|"medium"|"high";

export type IntelligenceRisk={
  key:string;
  title:string;
  detail:string;
  level:IntelligenceRiskLevel;
  metric?:string;
  action:string;
};

export type SubjectPriority={
  subject:string;
  priority:1|2|3;
  successRate:number;
  net:number;
  suggestedGain:number;
  reason:string;
  weeklyMinutes:number;
};

export type HasatIntelligenceInput={
  studentName:string;
  studentNumber?:string|number;
  subjects:SubjectPerformance[];
  totals:{
    correct:number;
    wrong:number;
    empty:number;
    net:number;
    score?:number;
    successRate:number;
  };
  classroomAverageNet?:number;
  previousNets?:number[];
  targetDefinition?:any;
  currentRank?:number;
};

export type HasatIntelligenceOutput={
  version:"1.0";
  generatedAt:string;
  dataScope:"single-exam"|"multi-exam";
  academicDna:AcademicDnaProfile;
  targetAnalysis:StudentTargetAnalysis;
  successPrediction:SuccessPrediction;
  aiEvaluation:PersonalizedAiEvaluation;
  parentSupport:ParentSupportPlan;
  risks:IntelligenceRisk[];
  subjectPriorities:SubjectPriority[];
  summary:{
    status:"strong"|"balanced"|"attention";
    headline:string;
    detail:string;
  };
};
