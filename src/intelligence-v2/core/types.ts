export type ISODateString=string;
export type StudentId=string;

export type AcademicSubjectSnapshot={
  subject:string;
  correct:number;
  wrong:number;
  empty:number;
  net:number;
  successRate:number;
  score?:number;
};

export type ExamHistoryEntry={
  examId:string;
  examName:string;
  examDate?:ISODateString;
  examType?:string;
  totalNet:number;
  totalScore?:number;
  successRate:number;
  classroomRank?:number;
  institutionRank?:number;
  subjects:AcademicSubjectSnapshot[];
};

export type AttendanceHistoryEntry={
  date:ISODateString;
  type:"full-day"|"half-day"|"late"|"excused"|"unexcused";
  durationDays?:number;
  note?:string;
};

export type StudyHistoryEntry={
  date:ISODateString;
  subject?:string;
  minutes:number;
  questionCount?:number;
  correctCount?:number;
  source:"student"|"teacher"|"parent"|"system";
  note?:string;
};

export type TargetHistoryEntry={
  date:ISODateString;
  university?:string;
  program?:string;
  scoreType?:string;
  targetScore?:number;
  targetNet?:number;
  targetYear?:number;
};

export type InterventionType=
  |"study-plan"
  |"extra-lesson"
  |"teacher-meeting"
  |"parent-meeting"
  |"guidance"
  |"attendance-follow-up"
  |"question-target"
  |"mock-exam"
  |"other";

export type InterventionHistoryEntry={
  id:string;
  type:InterventionType;
  title:string;
  startedAt:ISODateString;
  endedAt?:ISODateString;
  status:"planned"|"active"|"completed"|"cancelled";
  owner?:string;
  weeklyMinutes?:number;
  expectedNetGain?:number;
  observedNetGain?:number;
  note?:string;
};

export type TeacherObservationEntry={
  date:ISODateString;
  teacherName?:string;
  subject?:string;
  observation:string;
  recommendation?:string;
  followUpDate?:ISODateString;
};

export type ParentInteractionEntry={
  date:ISODateString;
  type:"message"|"meeting"|"phone"|"report-view"|"other";
  summary:string;
  participationScore?:number;
};

export type BehaviorHistoryEntry={
  date:ISODateString;
  category:"positive"|"attention"|"discipline"|"guidance";
  title:string;
  detail?:string;
  impactScore?:number;
};

export type PredictionHistoryEntry={
  generatedAt:ISODateString;
  horizonDays:number;
  predictedNet:number;
  lowerNet:number;
  upperNet:number;
  predictedScore?:number;
  confidence:number;
  actualNet?:number;
  actualScore?:number;
  modelVersion:string;
};

export type AcademicDigitalProfile={
  version:"2.0";
  student:{
    id:StudentId;
    number?:string|number;
    name:string;
    classroom?:string;
    branch?:string;
    schoolName?:string;
  };
  examHistory:ExamHistoryEntry[];
  attendanceHistory:AttendanceHistoryEntry[];
  studyHistory:StudyHistoryEntry[];
  targetHistory:TargetHistoryEntry[];
  interventionHistory:InterventionHistoryEntry[];
  teacherObservations:TeacherObservationEntry[];
  parentInteractions:ParentInteractionEntry[];
  behaviorHistory:BehaviorHistoryEntry[];
  predictionHistory:PredictionHistoryEntry[];
  metadata:{
    createdAt:ISODateString;
    updatedAt:ISODateString;
    sourceVersion:string;
  };
};
