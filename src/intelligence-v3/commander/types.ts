import type {AutonomousSnapshot} from "../autonomous";
import type {DecisionAnswer} from "../decision-center";
import type {HasatLiveSnapshot,LiveSchoolEvent} from "../live";
import type {PredictiveAiResult} from "../predictive";
import type {WorkflowSummary} from "../action-workflow";

export type CommanderPriority="critical"|"high"|"medium"|"low";

export type CommanderOrder={
  id:string;
  title:string;
  detail:string;
  action:string;
  owner:"management"|"teacher"|"guidance"|"parent";
  priority:CommanderPriority;
  score:number;
  dueHours:number;
  expectedGain?:number;
  source:string;
  sourceIds:string[];
};

export type CommanderTimeWindow="now"|"today"|"week";

export type CommanderAgendaItem={
  orderId:string;
  window:CommanderTimeWindow;
  label:string;
};

export type CommanderQuickWin={
  title:string;
  detail:string;
  expectedGain:string;
};

export type CommanderBriefing={
  version:"2.0";
  generatedAt:string;
  title:string;
  summary:string;
  schoolStatus:"stable"|"attention"|"critical";
  orders:CommanderOrder[];
  evidence:string[];
  agenda:CommanderAgendaItem[];
  quickWins:CommanderQuickWin[];
  metrics:{
    schoolHealth:number;
    predictedSchoolHealth:number;
    criticalEvents:number;
    projectedCriticalStudents:number;
    activeTasks:number;
    overdueTasks:number;
    completedInterventions:number;
    averageEffectiveness:number;
  };
};

export type CommanderInput={
  live:HasatLiveSnapshot;
  predictive:PredictiveAiResult;
  autonomous:AutonomousSnapshot;
  workflow:WorkflowSummary;
  events:LiveSchoolEvent[];
  decision:DecisionAnswer;
};
