import type {AutonomousSnapshot} from "../autonomous";
import type {DecisionAnswer} from "../decision-center";
import type {HasatLiveSnapshot} from "../live";

export type MissionControlStatus="stable"|"attention"|"critical";

export type MissionControlCard={
  key:string;
  label:string;
  value:string|number;
  detail:string;
  tone:"blue"|"emerald"|"amber"|"rose"|"violet"|"slate";
};

export type MissionControlSnapshot={
  generatedAt:string;
  status:MissionControlStatus;
  headline:string;
  detail:string;
  cards:MissionControlCard[];
  dailyBriefing:DecisionAnswer;
  live:HasatLiveSnapshot;
  autonomous:AutonomousSnapshot;
  topTasks:Array<{
    id:string;
    title:string;
    detail:string;
    owner:string;
    priority:number;
    status:string;
    dueAt?:string;
  }>;
  topEvents:Array<{
    id:string;
    title:string;
    detail:string;
    level:string;
    source:string;
    occurredAt:string;
  }>;
};
