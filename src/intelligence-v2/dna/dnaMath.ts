export const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
export const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
export const deviation=(values:number[])=>{
  if(values.length<2)return 0;
  const mean=average(values);
  return Math.sqrt(average(values.map(value=>(value-mean)**2)));
};
export const slope=(values:number[])=>{
  if(values.length<2)return 0;
  const n=values.length,x=(n-1)/2,y=average(values);
  let top=0,bottom=0;
  values.forEach((value,index)=>{top+=(index-x)*(value-y);bottom+=(index-x)**2;});
  return bottom?top/bottom:0;
};
export const statusFor=(score:number):"signature"|"strong"|"developing"|"priority"=>
  score>=82?"signature":score>=68?"strong":score>=48?"developing":"priority";
export const confidenceFrom=(history:number,evidence:number)=>clamp(28+Math.min(42,history*8)+Math.min(30,evidence*5),25,96);
