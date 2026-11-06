
import React, {useMemo, useState} from "react";

type Props = {
  selectedCardCount:number;
  onApply:(items:{cardIndex:number; questionNo:number; answer:string; fileName:string}[])=>void;
};

export default function AnswerCreateModal({selectedCardCount,onApply}:Props){
  const [startNo,setStartNo]=useState(1);
  const [answers,setAnswers]=useState<string[]>(
    Array.from({length:selectedCardCount},()=> "")
  );

  const rows = useMemo(()=>answers.map((answer,index)=>{
    const questionNo=startNo+index;
    return {
      cardIndex:index+1,
      questionNo,
      answer,
      fileName:`${questionNo}_${answer || "X"}.jpg`
    };
  }),[answers,startNo]);

  return (
    <div className="answer-modal">
      <h3>CEVAPLARI OLUŞTUR</h3>

      <div>
        {rows.map((row,index)=>(
          <div key={index} className="answer-row">
            <span>{row.questionNo}_</span>
            <input
              maxLength={1}
              value={answers[index]}
              onChange={e=>{
                const copy=[...answers];
                copy[index]=e.target.value.toUpperCase();
                setAnswers(copy);
              }}
              placeholder="A"
            />
          </div>
        ))}
      </div>

      <label>
        Soru başlangıç numarası
        <input
          type="number"
          value={startNo}
          onChange={e=>setStartNo(Number(e.target.value))}
        />
      </label>

      <button onClick={()=>onApply(rows)}>
        Uygula
      </button>
    </div>
  );
}
