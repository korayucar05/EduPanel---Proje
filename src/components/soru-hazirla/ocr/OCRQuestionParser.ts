export function parseQuestionNumber(text:string){
 const m=text.match(/^(\d+)[\.)]/);
 return m?Number(m[1]):null;
}
