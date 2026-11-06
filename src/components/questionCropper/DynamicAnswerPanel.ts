
export type AnswerEntry = {
  question:number;
  answer:string;
};

export function createAnswerInputs(cardCount:number){
  return Array.from({length:cardCount},(_,i)=>({
    question:i+1,
    answer:""
  }));
}

export function buildCardFileNames(entries:AnswerEntry[]){
  return entries.map(e=>({
    question:e.question,
    answer:e.answer.toUpperCase(),
    fileName:`${e.question}_${e.answer.toUpperCase()}.jpg`
  }));
}
