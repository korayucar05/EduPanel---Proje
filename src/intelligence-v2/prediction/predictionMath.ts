import {average,clamp,linearSlope,standardDeviation} from "../shared/statistics";

export const horizonDays=(horizon:"14d"|"30d"|"exam-day",examDate?:string)=>{
  if(horizon==="14d")return 14;
  if(horizon==="30d")return 30;
  if(examDate){
    const days=Math.ceil((new Date(examDate).getTime()-Date.now())/86_400_000);
    return Math.max(1,days);
  }
  return 90;
};

export const recencyWeightedAverage=(values:number[])=>{
  if(!values.length)return 0;
  const weights=values.map((_,index)=>index+1);
  const weightTotal=weights.reduce((sum,value)=>sum+value,0);
  return values.reduce((sum,value,index)=>sum+value*weights[index],0)/weightTotal;
};

export const volatilityScore=(values:number[])=>{
  if(values.length<2)return 100;
  const mean=Math.max(1,Math.abs(average(values)));
  const deviation=standardDeviation(values);
  return clamp(100-(deviation/mean*100*2.2),20,100);
};

export const predictSeriesValue=({
  values,
  days,
  assumedWeeklyStudyMinutes=0,
  assumedAttendanceRisk=0,
  assumedInterventionEffect=0,
}:{
  values:number[];
  days:number;
  assumedWeeklyStudyMinutes?:number;
  assumedAttendanceRisk?:number;
  assumedInterventionEffect?:number;
})=>{
  const current=values.at(-1)||0;
  const slope=linearSlope(values.slice(-6));
  const normalizedPeriods=Math.max(.5,days/21);
  const trendContribution=slope*normalizedPeriods;
  const studyContribution=Math.max(0,assumedWeeklyStudyMinutes)/60*.08*normalizedPeriods;
  const attendancePenalty=Math.max(0,assumedAttendanceRisk)*.06*normalizedPeriods;
  const interventionContribution=Math.max(-10,Math.min(10,assumedInterventionEffect));
  return Math.max(0,current+trendContribution+studyContribution-attendancePenalty+interventionContribution);
};

export const confidenceFromHistory=(values:number[])=>{
  if(!values.length)return 20;
  const historyScore=clamp(values.length/6*100,20,100);
  const stability=volatilityScore(values);
  return clamp(historyScore*.55+stability*.45,20,95);
};

export const trendLabel=(values:number[])=>{
  if(values.length<2)return"insufficient" as const;
  const slope=linearSlope(values.slice(-6));
  const volatility=standardDeviation(values.slice(-6));
  if(volatility>Math.max(4,Math.abs(average(values))*.18))return"volatile" as const;
  if(slope>.8)return"rising" as const;
  if(slope<-.8)return"falling" as const;
  return"stable" as const;
};
