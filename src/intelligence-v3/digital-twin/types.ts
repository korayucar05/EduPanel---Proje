export type DigitalTwinTone="emerald"|"blue"|"amber"|"rose"|"violet"|"slate";

export type DigitalTwinMetric={
  key:string;
  label:string;
  score:number;
  value:string;
  detail:string;
  weight:number;
  confidence:number;
  tone:DigitalTwinTone;
};

export type GradeTwin={
  grade:string;
  studentCount:number;
  healthScore:number;
  academicScore:number;
  attendanceScore:number;
  riskCount:number;
  status:"stable"|"attention"|"critical";
};

export type DigitalTwinAlert={
  id:string;
  title:string;
  detail:string;
  severity:"info"|"warning"|"critical";
  action:string;
};

export type DigitalSchoolTwinSnapshot={
  generatedAt:string;
  schoolHealthScore:number;
  status:"stable"|"attention"|"critical";
  confidence:number;
  summary:string;
  metrics:DigitalTwinMetric[];
  grades:GradeTwin[];
  alerts:DigitalTwinAlert[];
  dataCoverage:{available:number;expected:number;percentage:number};
};
