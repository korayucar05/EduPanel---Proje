import type {AcademicDigitalProfile} from "../core/types";
import type {AcademicPrediction} from "../prediction";

export type InterventionScenario={
  weeklyStudyMinutes:number;
  extraLessonMinutes:number;
  mockExamPerMonth:number;
  guidanceSessionsPerMonth:number;
  parentMeetingsPerMonth:number;
  attendanceRiskDays:number;
  dailyQuestionTarget:number;
};

export type InterventionEffectBreakdown={
  key:string;
  title:string;
  netEffect:number;
  scoreEffect?:number;
  confidence:number;
  explanation:string;
};

export type DigitalTwinSimulation={
  version:"1.0";
  generatedAt:string;
  profileUpdatedAt:string;
  baseline:AcademicPrediction;
  scenario:AcademicPrediction;
  scenarioInput:InterventionScenario;
  netDifference:number;
  scoreDifference?:number;
  confidence:number;
  effects:InterventionEffectBreakdown[];
  recommendation:{
    status:"positive"|"neutral"|"risky";
    headline:string;
    detail:string;
  };
};

export type SimulationEngineInput={
  profile:AcademicDigitalProfile;
  examDate?:string;
  scenario:InterventionScenario;
};
