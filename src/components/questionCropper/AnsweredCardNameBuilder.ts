
export function createAnsweredCardNames(
 cards:{id:number}[],
 answers:{questionNo:number,answer:string}[]
){
 return cards.map((card,index)=>{
   const a=answers[index];
   return {
     ...card,
     fileName:`${a.questionNo}_${a.answer}.jpg`
   };
 });
}
