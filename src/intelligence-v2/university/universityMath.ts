export const clamp=(value:number,min=0,max=100)=>
  Math.max(min,Math.min(max,value));

export const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

export const sigmoid=(value:number)=>1/(1+Math.exp(-value));

export const scoreTypeFromClassroom=(classroom?:string)=>{
  const text=String(classroom||"").toLocaleUpperCase("tr-TR");
  if(text.includes("EA"))return"EA" as const;
  if(text.includes("SÖZ")||text.includes("SOZ"))return"SOZ" as const;
  if(text.includes("DİL")||text.includes("DIL"))return"DIL" as const;
  if(text.includes("SAY"))return"SAY" as const;
  return"TYT" as const;
};

export const rankFromScore=(score:number,scoreType:string)=>{
  const normalized=Math.max(100,Math.min(560,score));
  const base=scoreType==="TYT"?2_500_000:1_200_000;
  const power=scoreType==="TYT"?2.45:2.75;
  const ratio=(560-normalized)/460;
  return Math.max(1,Math.round(base*Math.pow(Math.max(.005,ratio),power)));
};
