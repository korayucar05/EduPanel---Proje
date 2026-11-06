export const average=(values:number[])=>values.length
  ?values.reduce((sum,value)=>sum+value,0)/values.length
  :0;

export const standardDeviation=(values:number[])=>{
  if(values.length<2)return 0;
  const mean=average(values);
  const variance=average(values.map(value=>(value-mean)**2));
  return Math.sqrt(variance);
};

export const linearSlope=(values:number[])=>{
  if(values.length<2)return 0;
  const n=values.length;
  const xMean=(n-1)/2;
  const yMean=average(values);
  let numerator=0;
  let denominator=0;
  for(let index=0;index<n;index+=1){
    numerator+=(index-xMean)*(values[index]-yMean);
    denominator+=(index-xMean)**2;
  }
  return denominator?numerator/denominator:0;
};

export const clamp=(value:number,min:number,max:number)=>
  Math.max(min,Math.min(max,value));
