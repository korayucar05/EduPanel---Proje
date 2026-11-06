
export function buildNamedCards(cards:any[], answers:Record<number,string>) {
  return cards.map((card,index)=>({
    ...card,
    answer: answers[index+1] || "",
    fileName: `${index+1}_${answers[index+1] || "X"}.jpg`
  }));
}
