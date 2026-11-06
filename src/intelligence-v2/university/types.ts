import type {BrainCohortResult,BrainScoreResult} from "../brain";

export type UniversityScoreType="TYT"|"SAY"|"EA"|"SOZ"|"DIL";

export type UniversityTarget={
  id:string;
  university?:string;
  program?:string;
  scoreType:UniversityScoreType;
  targetRanking?:number;
  targetScore?:number;
  targetProbability?:number;
};

export type UniversityScenario={
  mathematicsNetGain:number;
  turkishNetGain:number;
  scienceNetGain:number;
  socialNetGain:number;
  aytMathematicsNetGain:number;
  aytScienceNetGain:number;
  aytLiteratureNetGain:number;
  aytSocialNetGain:number;
  weeklyStudyMinutes:number;
  attendanceReductionDays:number;
};

export type StudentPlacementEstimate={
  studentId:string;
  studentName:string;
  studentNumber?:string|number;
  classroom?:string;
  scoreType:UniversityScoreType;
  currentNet:number;
  predictedNet:number;
  currentScore?:number;
  predictedScore:number;
  currentRanking?:number;
  predictedRanking:number;
  currentProbability:number;
  predictedProbability:number;
  probabilityChange:number;
  target?:UniversityTarget;
  status:"reachable"|"borderline"|"distant"|"undefined";
  confidence:number;
  primaryNeed?:string;
};

export type UniversitySimulationResult={
  version:"1.0";
  generatedAt:string;
  scenario:UniversityScenario;
  totalStudents:number;
  estimatedPlacedStudents:number;
  estimatedPlacedStudentsAfterScenario:number;
  placementGain:number;
  first100kCount:number;
  first100kCountAfterScenario:number;
  first100kGain:number;
  averageProbability:number;
  averageProbabilityAfterScenario:number;
  averageScoreGain:number;
  averageRankingImprovement:number;
  students:StudentPlacementEstimate[];
  highImpactStudents:StudentPlacementEstimate[];
  scoreTypeSummary:Array<{
    scoreType:UniversityScoreType;
    studentCount:number;
    averageProbability:number;
    averageProbabilityAfterScenario:number;
    placementGain:number;
  }>;
  recommendations:string[];
  summary:string;
  confidence:number;
};

export type UniversitySimulationInput={
  cohort:BrainCohortResult;
  scenario:UniversityScenario;
};
