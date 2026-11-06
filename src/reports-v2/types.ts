


export type AiAdvisorCard = {
  type: "strength" | "attention" | "action" | "potential";
  title: string;
  message: string;
  metric?: string;
};




export type TeacherEvaluation = {
  teacherName?: string;
  teacherTitle?: string;
  evaluationDate?: string;
  nextReviewDate?: string;
  followUpStatus?: "not-started" | "in-progress" | "completed";
  observation?: string;
  recommendation?: string;
  studentCommitment?: string;
  parentContactNote?: string;
  signatureText?: string;
  updatedAt?: string;
};

export type SuccessPredictionScenario = {
  label: "Koruma" | "Gelişim" | "Risk";
  predictedNet: number;
  predictedScore?: number;
  probability: number;
  description: string;
};

export type SuccessPrediction = {
  version: "1.0" | "2.0";
  dataScope: "single-exam" | "multi-exam";
  confidence: number;
  currentNet: number;
  expectedNet: number;
  lowerNet: number;
  upperNet: number;
  expectedScore?: number;
  lowerScore?: number;
  upperScore?: number;
  trendLabel: "Yükseliş" | "Durağan" | "Dalgalı" | "Düşüş" | "Veri Yetersiz";
  riskIndex: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskLabel: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  interventionWindow: string;
  trajectory: Array<{
    label: string;
    net: number;
    kind: "history" | "current" | "forecast";
  }>;
  earlyWarnings: Array<{
    level: "low" | "medium" | "high";
    title: string;
    detail: string;
    action: string;
  }>;
  scenarios: SuccessPredictionScenario[];
  drivers: Array<{
    title: string;
    impact: "positive" | "negative" | "neutral";
    detail: string;
  }>;
  summary: string;
  disclaimer: string;
};

export type ParentSupportPlan = {
  version: "1.0";
  summary: string;
  academicSnapshot?: {
    dnaScore: number;
    confidence: number;
    strongestDimension: string;
    priorityDimension: string;
    status: "strong" | "balanced" | "attention";
    statusLabel: string;
  };
  conversationGuide?: {
    ask: string;
    say: string;
    avoid: string;
  };
  strengths: string[];
  developmentAreas: string[];
  homeSupportActions: Array<{
    title: string;
    detail: string;
    frequency: string;
  }>;
  monthlyCheckpoints: Array<{
    week: string;
    focus: string;
    parentAction: string;
    successIndicator: string;
  }>;
  communicationNote: string;
  encouragementMessage: string;
  disclaimer: string;
};

export type PersonalizedAiEvaluation = {
  version: "1.0" | "2.0";
  dataScope: "single-exam" | "multi-exam";
  confidence: number;
  decisionSummary: {
    status: "strong" | "balanced" | "attention";
    headline: string;
    rationale: string;
  };
  advisorCards: AiAdvisorCard[];
  riskSignals: Array<{
    level: "low" | "medium" | "high";
    title: string;
    detail: string;
  }>;
  studentMessage: string;
  parentMessage: string;
  teacherMessage: string;
  nextActions: Array<{
    title: string;
    detail: string;
    priority: 1 | 2 | 3 | 4 | 5;
  }>;
  sevenDayPlan: Array<{
    day: string;
    focus: string;
    tasks: string[];
    minutes: number;
    successCheck: string;
  }>;
  evidence: string[];
  disclaimer: string;
};

export type StudentTargetDefinition = {
  university?: string;
  program?: string;
  scoreType?: string;
  targetScore?: number;
  targetNet?: number;
  targetYear?: number;
  targetRank?: number;
  sourceNote?: string;
  updatedAt?: string;
};

export type StudentTargetAnalysis = {
  isDefined: boolean;
  definition: StudentTargetDefinition;
  currentScore: number;
  currentNet: number;
  scoreGap?: number;
  netGap?: number;
  completionRate?: number;
  currentRank?: number;
  rankGap?: number;
  rankProximity?: number;
  probability?: {
    current: number;
    steady: number;
    plusTwoHours: number;
    plusFiveHours: number;
  };
  opportunities: Array<{
    subject: string;
    currentNet: number;
    successRate: number;
    suggestedGain: number;
    targetNet: number;
    projectedRank?: number;
    efficiencyScore: number;
    efficiencyLabel: "Düşük" | "Orta" | "Yüksek" | "Çok yüksek";
  }>;
  milestones: Array<{
    label: string;
    targetNet: number;
    targetScore?: number;
  }>;
  weeklyHours: Array<{
    subject: string;
    hours: number;
    reason: string;
  }>;
  summary: string;
  disclaimer: string;
};

export type AcademicDnaDimension = {
  key:
    | "analyticalThinking"
    | "readingInterpretation"
    | "problemSolving"
    | "attention"
    | "timeManagement"
    | "branchBalance"
    | "academicResilience"
    | "consistency";
  label: string;
  score: number;
  confidence: 1 | 2 | 3 | 4 | 5;
  confidenceLabel: "Düşük" | "Sınırlı" | "Orta" | "İyi" | "Yüksek";
  evidence: string;
  status: "strong" | "developing" | "priority";
};

export type AcademicDnaProfile = {
  version: "1.0";
  dataScope: "single-exam" | "multi-exam";
  overallScore: number;
  overallConfidence: number;
  dimensions: AcademicDnaDimension[];
  summary: string;
  strengths: string[];
  priorities: string[];
  disclaimer: string;
};

export type SubjectPerformance = {
  subjectName: string;
  shortName?: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  totalQuestions: number;
  successRate?: number;
  averageRate?: number;
};

export type RankingMetric = {
  label: string;
  rank: number | string;
  participants: number | string;
};



export type ReportIntelligenceRisk = {
  key: string;
  title: string;
  detail: string;
  level: "low" | "medium" | "high";
  metric?: string;
  action: string;
};

export type ReportSubjectPriority = {
  subject: string;
  priority: 1 | 2 | 3;
  successRate: number;
  net: number;
  suggestedGain: number;
  reason: string;
  weeklyMinutes: number;
};

export type ReportIntelligenceSummary = {
  status: "strong" | "balanced" | "attention";
  headline: string;
  detail: string;
};

export type StudentReportV2Data = {
  reportTitle: string;
  examName: string;
  examDate?: string;
  reportDate?: string;
  reportCode?: string;
  schoolName: string;
  student: {
    name: string;
    number?: string | number;
    classroom?: string;
    branch?: string;
    photoUrl?: string;
  };
  totals: {
    correct: number;
    wrong: number;
    empty: number;
    net: number;
    score?: number;
    successRate: number;
    classroomAverageNet?: number;
  };
  rankings: RankingMetric[];
  subjects: SubjectPerformance[];
  academicComments?: string[];
  studySuggestions?: Array<{
    subject: string;
    suggestion: string;
  }>;
  motto?: string;
  metadata?: {
    booklet?: string;
    examType?: string;
  };
  premium?: {
    prioritySubjects: Array<{ subject: string; successRate: number; averageRate?: number; gap?: number }>;
    weeklyPlan: Array<{ day: string; tasks: string[]; estimatedMinutes: number }>;
    parentSummary: string;
    targetNet: number;
    currentNet: number;
    potentialGain: number;
  };
  academicDna?: AcademicDnaProfile;
  targetAnalysis?: StudentTargetAnalysis;
  aiEvaluation?: PersonalizedAiEvaluation;
  parentSupport?: ParentSupportPlan;
  successPrediction?: SuccessPrediction;
  teacherEvaluation?: TeacherEvaluation;
  intelligence?: {
    version: "1.0";
    generatedAt: string;
    dataScope: "single-exam" | "multi-exam";
    risks: ReportIntelligenceRisk[];
    subjectPriorities: ReportSubjectPriority[];
    summary: ReportIntelligenceSummary;
  };
};
