import type {BrainCohortResult} from "../brain";
import type {SchoolDigitalTwinResult} from "../school-twin";

export type ExecutiveAlertLevel="critical"|"warning"|"positive"|"info";

export type ExecutiveAlert={
  key:string;
  title:string;
  detail:string;
  level:ExecutiveAlertLevel;
  metric?:string;
  action:string;
};

export type ExecutiveTask={
  id:string;
  title:string;
  detail:string;
  owner:"management"|"teacher"|"guidance"|"parent";
  priority:1|2|3|4|5;
  dueDays:number;
  expectedGain?:number;
  classroom?:string;
  subject?:string;
};

export type ExecutiveCenterResult={
  version:"1.0";
  generatedAt:string;
  schoolHealthScore:number;
  brainIndex:number;
  criticalStudentCount:number;
  highPriorityCount:number;
  expectedTotalNetGain:number;
  leadingClassroom?:string;
  leadingSubject?:string;
  alerts:ExecutiveAlert[];
  tasks:ExecutiveTask[];
  classroomMap:Array<{
    classroom:string;
    score:number;
    level:ExecutiveAlertLevel;
    criticalCount:number;
    highCount:number;
  }>;
  summary:{
    status:"stable"|"attention"|"critical";
    headline:string;
    detail:string;
  };
};

export type ExecutiveCenterInput={
  cohort:BrainCohortResult;
  schoolTwin:SchoolDigitalTwinResult;
};
