
export type Marker = {
  x:number;
  y:number;
  number?:string;
};

export type CropCard = {
  id:number;
  x:number;
  y:number;
  width:number;
  height:number;
};

export function createCropCards(
  markers: Marker[],
  pageWidth:number,
  pageHeight:number
): CropCard[] {
  const sorted = [...markers].sort((a,b)=>a.y-b.y || a.x-b.x);

  return sorted.map((item,index)=>{
    const next = sorted[index+1];
    return {
      id:index+1,
      x:item.x,
      y:item.y,
      width: next ? Math.max(100,next.x-item.x) : pageWidth-item.x,
      height: next ? Math.max(150,next.y-item.y) : pageHeight-item.y
    };
  });
}
