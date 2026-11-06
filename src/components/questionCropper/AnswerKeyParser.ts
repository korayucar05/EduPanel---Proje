
export type AnswerMap = Record<number,string>;

export function parseAnswerKey(text:string): AnswerMap {
  const result: AnswerMap = {};

  text.split(/\r?\n/).forEach(line => {
    const match = line.match(/(\d+)\s*[-,;:]\s*([A-Ea-e])/);
    if (match) {
      result[Number(match[1])] = match[2].toUpperCase();
    }
  });

  return result;
}

export function createCardName(
  questionNo:number,
  answer:string,
  prefix:string=""
){
  const base = prefix ? prefix + "_" : "";
  return `${base}${questionNo}_${answer}.jpg`;
}
