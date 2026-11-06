export type Region = {x:number;y:number;width:number;height:number;questionNo:number};

/** Basit belge metni/ocr çıktısından soru başlangıçlarını bulur. */
export async function detectQuestionRegions(text:string = ''):Promise<Region[]>{
 const lines=text.replace(/\r/g,'').split('\n');
 const found:{no:number;line:number}[]=[];
 lines.forEach((l,i)=>{
   const m=l.trim().match(/^(\d+)\s*[\.)]/);
   if(m) found.push({no:Number(m[1]),line:i});
 });
 return found.map((q,i)=>({
   questionNo:q.no,
   x:0,
   y:q.line*40,
   width:1000,
   height:Math.max(80,((found[i+1]?.line ?? lines.length)-q.line)*40)
 }));
}
