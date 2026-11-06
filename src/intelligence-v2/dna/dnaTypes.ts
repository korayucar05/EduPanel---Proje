import type {StudentReportV2Data} from "../../reports-v2/types";
import type {AcademicDigitalProfile} from "../core/types";
import type {BrainScoreResult} from "../brain";

export type AcademicDna2Key=
  |"learningSpeed"|"knowledgeRetention"|"attention"|"examEndurance"
  |"consistency"|"analyticalThinking"|"readingInterpretation"
  |"problemSolving"|"timeManagement"|"subjectBalance"
  |"growthMomentum"|"studyDiscipline";

export type AcademicDna2Status="signature"|"strong"|"developing"|"priority";
export type AcademicDna2Dimension={
  key:AcademicDna2Key;
  label:string;
  score:number;
  confidence:number;
  status:AcademicDna2Status;
  trend:number;
  evidence:string[];
  recommendation:string;
};
export type AcademicDnaArchetype=
  |"Analitik Yükseliş"|"Dengeli ve İstikrarlı"|"Hızlı fakat Kırılgan"
  |"Potansiyeli Yüksek"|"Dikkat Odaklı Gelişim"|"Temel Güçlendirme";
export type AcademicDna2Result={
  version:"2.0";
  generatedAt:string;
  student:{id:string;name:string;number?:string|number;classroom?:string};
  overallScore:number;
  confidence:number;
  archetype:AcademicDnaArchetype;
  dimensions:AcademicDna2Dimension[];
  signatureStrengths:string[];
  developmentPriorities:string[];
  summary:string;
  disclaimer:string;
};
export type AcademicDna2Input={report:StudentReportV2Data;profile?:AcademicDigitalProfile;brain?:BrainScoreResult};
export type AcademicDna2Cohort={
  generatedAt:string;
  totalStudents:number;
  averageScore:number;
  averageConfidence:number;
  archetypes:Array<{name:AcademicDnaArchetype;count:number;ratio:number}>;
  dimensionSummary:Array<{key:AcademicDna2Key;label:string;average:number;priorityCount:number;strongCount:number}>;
  profiles:AcademicDna2Result[];
};
