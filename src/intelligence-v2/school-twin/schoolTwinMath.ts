export const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

export const clamp=(value:number,min=0,max=100)=>
  Math.max(min,Math.min(max,value));
