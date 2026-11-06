export const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const average=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
export const std=(v:number[])=>{if(v.length<2)return 0;const m=average(v);return Math.sqrt(average(v.map(x=>(x-m)**2)));};
export const slope=(v:number[])=>{if(v.length<2)return 0;const n=v.length,x=(n-1)/2,y=average(v);let a=0,b=0;for(let i=0;i<n;i++){a+=(i-x)*(v[i]-y);b+=(i-x)**2;}return b?a/b:0;};
export const weighted=(items:Array<{score:number;weight:number}>)=>{const total=items.reduce((s,i)=>s+i.weight,0)||1;return clamp(items.reduce((s,i)=>s+i.score*i.weight,0)/total);};
