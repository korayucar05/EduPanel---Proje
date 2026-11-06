import type {InterventionMemoryRecord} from "../autonomous";
import type {LiveSchoolEvent} from "../live";

export type PredictionDirection="rising"|"falling"|"stable"|"insufficient";
export type PredictionRiskLevel="critical"|"high"|"medium"|"low";

export type PredictiveMetric={
  key:string;
  label:string;
  currentValue:number;
  predictedValue:number;
  change:number;
  direction:PredictionDirection;
  confidence:number;
  riskLevel:PredictionRiskLevel;
  reasons:string[];
};

export type PredictiveStudentRisk={
  studentId:string;
  studentName:string;
  classroom?:string;
  currentRisk:number;
  predictedRisk:number;
  riskChange:number;
  riskLevel:PredictionRiskLevel;
  estimatedDaysToCritical?:number;
  reasons:string[];
  recommendations:string[];
  confidence:number;
};

export type PredictiveClassroomRisk={
  classroom:string;
  eventCount:number;
  criticalEventCount:number;
  warningEventCount:number;
  currentRisk:number;
  predictedRisk:number;
  riskChange:number;
  riskLevel:PredictionRiskLevel;
  dominantSource:string;
};

export type PredictiveAiResult={
  version:"1.0";
  generatedAt:string;
  forecastDays:number;
  schoolHealth:PredictiveMetric;
  criticalEvents:PredictiveMetric;
  warningEvents:PredictiveMetric;
  interventionEffectiveness:PredictiveMetric;
  studentRisks:PredictiveStudentRisk[];
  classroomRisks:PredictiveClassroomRisk[];
  summary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
  };
  recommendations:string[];
};

export type PredictiveAiInput={
  events:LiveSchoolEvent[];
  interventionMemory:InterventionMemoryRecord[];
  currentSchoolHealth:number;
  forecastDays?:number;
};
