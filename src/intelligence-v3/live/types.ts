export type LiveEventSource=
  |"exam"
  |"attendance"
  |"homework"
  |"behavior"
  |"guidance"
  |"intervention"
  |"parent"
  |"system";

export type LiveEventLevel="info"|"positive"|"warning"|"critical";

export type LiveSchoolEvent={
  id:string;
  source:LiveEventSource;
  level:LiveEventLevel;
  occurredAt:string;
  title:string;
  detail:string;
  studentId?:string;
  studentName?:string;
  classroom?:string;
  subject?:string;
  metric?:number;
  metadata?:Record<string,unknown>;
};

export type SchoolPulseMetric={
  key:string;
  label:string;
  value:number;
  previousValue?:number;
  change:number;
  direction:"up"|"down"|"stable";
  health:"good"|"attention"|"critical";
};

export type LiveActionItem={
  id:string;
  title:string;
  detail:string;
  owner:"management"|"teacher"|"guidance"|"parent";
  priority:1|2|3|4|5;
  dueDays:number;
  sourceEventId?:string;
};

export type HasatLiveSnapshot={
  generatedAt:string;
  schoolHealthScore:number;
  criticalEventCount:number;
  warningEventCount:number;
  positiveEventCount:number;
  pulse:SchoolPulseMetric[];
  actions:LiveActionItem[];
  recentEvents:LiveSchoolEvent[];
  briefing:{
    headline:string;
    detail:string;
  };
};
