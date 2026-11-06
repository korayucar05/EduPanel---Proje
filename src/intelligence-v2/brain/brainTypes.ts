import type {StudentReportV2Data} from "../../reports-v2/types";
import type {AcademicDigitalProfile} from "../core/types";

export type BrainPriorityLevel="critical"|"high"|"medium"|"low";
export type BrainFactorKey=
  |"academicRisk"|"growthPotential"|"studyDiscipline"|"targetProximity"
  |"interventionReadiness"|"motivationTrend"|"subjectBalance"|"attendanceRisk"
  |"emptyQuestionRisk"|"timeManagement"|"fragility"|"stability"
  |"successMomentum"|"predictionConfidence"|"interventionEffectiveness";
export type BrainFactor={key:BrainFactorKey;label:string;score:number;weight:number;contribution:number;direction:"priority"|"strength";evidence:string};
export type BrainScoreResult={version:"5.1";generatedAt:string;student:{id:string;name:string;number?:string|number;classroom?:string};currentNet:number;confidence:number;brainScore:number;priorityScore:number;potentialScore:number;expectedGain:number;priorityLevel:BrainPriorityLevel;stars:1|2|3|4|5;headline:string;summary:string;factors:BrainFactor[];topReasons:string[];recommendedActions:string[]};
export type BrainEngineInput={report:StudentReportV2Data;profile?:AcademicDigitalProfile};
export type BrainCohortResult={generatedAt:string;totalStudents:number;brainIndex:number;criticalCount:number;highCount:number;mediumCount:number;lowCount:number;ranking:BrainScoreResult[];classroomSummary:Array<{classroom:string;studentCount:number;brainIndex:number;criticalCount:number;expectedGain:number}>;todayAgenda:Array<{rank:number;title:string;detail:string;score:number;level:BrainPriorityLevel}>};
