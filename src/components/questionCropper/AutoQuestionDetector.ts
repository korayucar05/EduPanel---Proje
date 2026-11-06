
export type OCRCandidate = {
  text:string;
  x:number;
  y:number;
  width:number;
  height:number;
  confidence?:number;
};

export function filterQuestionNumbers(items: OCRCandidate[]) {
  return items.filter(item => {
    const t = item.text.trim();

    // Renk bağımsız: sadece soru numarası biçimi
    if (!/^\d+\.$/.test(t)) return false;

    if (item.width < 3 || item.height < 3) return false;

    return true;
  }).sort((a,b)=>a.y-b.y || a.x-b.x);
}

export function buildQuestionRegions(
  numbers: OCRCandidate[],
  pageWidth:number,
  pageHeight:number
){
  return numbers.map((n,index)=>{
    const next=numbers[index+1];

    return {
      id:index+1,
      number:n.text,
      x:n.x,
      y:n.y,
      width: next && Math.abs(next.y-n.y)<100
        ? Math.max(40,next.x-n.x)
        : pageWidth-n.x,
      height: next
        ? Math.max(100,next.y-n.y)
        : pageHeight-n.y
    };
  });
}

// Eski modüllerle uyumluluk için korundu.
export function detectQuestionBoxes(
  items: OCRCandidate[],
  pageWidth:number,
  pageHeight:number
){
  const numbers = filterQuestionNumbers(items);
  return buildQuestionRegions(numbers,pageWidth,pageHeight);
}
