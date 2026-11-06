import type {HasatLiveSnapshot,LiveSchoolEvent} from "../live";

export type DecisionIntent=
  |"daily-briefing"
  |"critical-events"
  |"priority-actions"
  |"school-health"
  |"attendance"
  |"homework"
  |"guidance"
  |"parent"
  |"classroom"
  |"unknown";

export type DecisionAnswer={
  version:"1.0";
  generatedAt:string;
  query:string;
  intent:DecisionIntent;
  title:string;
  answer:string;
  evidence:string[];
  actions:string[];
  confidence:number;
};

export type DecisionCenterContext={
  snapshot:HasatLiveSnapshot;
  events:LiveSchoolEvent[];
  studentCount:number;
  teacherCount:number;
  classroomCount:number;
};
