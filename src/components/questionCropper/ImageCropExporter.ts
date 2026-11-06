
export async function exportCrop(canvas:HTMLCanvasElement, area:any){
  const c=document.createElement("canvas");
  c.width=area.width;
  c.height=area.height;

  const ctx=c.getContext("2d");
  if(!ctx) return null;

  ctx.drawImage(canvas, area.x, area.y, area.width, area.height, 0,0,area.width,area.height);

  return c.toDataURL("image/jpeg",0.92);
}
