export const clamp=(value:number,min:number,max:number)=>
  Math.max(min,Math.min(max,value));

export const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

export const roundToStep=(value:number,step:number)=>
  Math.max(step,Math.round(value/step)*step);

export const levelMultiplier={
  critical:1.18,
  high:1.08,
  medium:.92,
  low:.72,
} as const;
