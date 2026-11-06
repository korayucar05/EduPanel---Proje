import type {AcademicDigitalProfile} from "../core/types";

export type PredictionHorizon="14d"|"30d"|"exam-day";

export type PredictionFactorImpact="positive"|"negative"|"neutral";

export type PredictionFactor={
  key:string;
  title:string;
  detail:string;
  impact:PredictionFactorImpact;
  weight:number;
  metric?:string;
};

export type SubjectPrediction={
  subject:string;
  currentNet:number;
  predictedNet:number;
  lowerNet:number;
  upperNet:number;
  trend:"up"|"stable"|"down"|"insufficient";
  confidence:number;
};

export type AcademicPrediction={
  version:"2.0";
  generatedAt:string;
  horizon:PredictionHorizon;
  horizonDays:number;
  dataScope:"single-exam"|"multi-exam";
  currentNet:number;
  predictedNet:number;
  lowerNet:number;
  upperNet:number;
  currentScore?:number;
  predictedScore?:number;
  confidence:number;
  trend:"rising"|"stable"|"falling"|"volatile"|"insufficient";
  subjectPredictions:SubjectPrediction[];
  factors:PredictionFactor[];
  summary:string;
  disclaimer:string;
};

export type PredictionEngineInput={
  profile:AcademicDigitalProfile;
  horizon:PredictionHorizon;
  examDate?:string;
  assumedWeeklyStudyMinutes?:number;
  assumedAttendanceRisk?:number;
  assumedInterventionEffect?:number;
};
