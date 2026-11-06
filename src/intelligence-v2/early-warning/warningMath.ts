export const clamp=(value:number,min=0,max=100)=>
  Math.max(min,Math.min(max,value));

export const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

export const levelFromScore=(score:number)=>{
  if(score>=75)return"critical" as const;
  if(score>=58)return"high" as const;
  if(score>=38)return"medium" as const;
  return"low" as const;
};
