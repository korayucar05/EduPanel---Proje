
export function normalizeAnswerKey(text:string){
  return text
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(Boolean)
    .map(line=>{
      const m=line.match(/(\d+)\s*[-,;:]\s*([A-E])/i);
      return m ? {question:Number(m[1]),answer:m[2].toUpperCase()} : null;
    })
    .filter(Boolean);
}

export function createAnswerFileName(no:number,answer:string){
  return `${no}_${answer}.jpg`;
}
