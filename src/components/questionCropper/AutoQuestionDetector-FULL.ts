
export type QuestionPoint = {
  x:number;
  y:number;
  width:number;
  height:number;
  number?:string;
};

export function detectQuestionBlocks(points: QuestionPoint[], pageWidth:number, pageHeight:number){
  const sorted=[...points].sort((a,b)=>a.y-b.y || a.x-b.x);

  return sorted.map((p,i)=>{
    const next=sorted[i+1];
    const sameRow=next && Math.abs(next.y-p.y)<80;

    return {
      id:i+1,
      number:p.number ?? String(i+1),
      x:p.x,
      y:p.y,
      width:sameRow ? Math.max(100,next.x-p.x) : pageWidth-p.x,
      height:next ? Math.max(150,next.y-p.y) : pageHeight-p.y
    };
  });
}
