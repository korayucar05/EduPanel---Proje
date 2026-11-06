
export type AutoCropArea = {
  x:number;
  y:number;
  width:number;
  height:number;
};

export function buildCropAreas(markers: {x:number;y:number}[], pageWidth:number, pageHeight:number):AutoCropArea[] {
  if (!markers.length) return [];

  const sorted = [...markers].sort((a,b)=>a.y-b.y || a.x-b.x);

  return sorted.map((m, index) => {
    const next = sorted[index + 1];
    return {
      x: m.x,
      y: m.y,
      width: next ? Math.max(50, next.x - m.x) : pageWidth - m.x,
      height: next ? Math.max(80, next.y - m.y) : pageHeight - m.y
    };
  });
}
