import type {InterventionMemoryRecord} from "../autonomous";

export type InterventionInsightGroup={
  key:string;
  label:string;
  count:number;
  completedCount:number;
  effectiveCount:number;
  limitedCount:number;
  ineffectiveCount:number;
  pendingCount:number;
  averageExpectedGain:number;
  averageObservedGain:number;
  averageEffectiveness:number;
  successRate:number;
};

export type InterventionTrendPoint={
  period:string;
  count:number;
  averageObservedGain:number;
  averageEffectiveness:number;
};

export type InterventionInsightsResult={
  version:"1.0";
  generatedAt:string;
  totalInterventions:number;
  completedInterventions:number;
  pendingInterventions:number;
  effectiveInterventions:number;
  averageExpectedGain:number;
  averageObservedGain:number;
  averageEffectiveness:number;
  successRate:number;
  strongestIntervention?:InterventionInsightGroup;
  weakestIntervention?:InterventionInsightGroup;
  byType:InterventionInsightGroup[];
  byTargetType:InterventionInsightGroup[];
  trend:InterventionTrendPoint[];
  recentRecords:InterventionMemoryRecord[];
  recommendations:string[];
  summary:string;
};
