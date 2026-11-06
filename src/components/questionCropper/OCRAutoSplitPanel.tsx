import React, {useMemo, useState} from "react";

export type OCRSplitQuestion = {
  no:number;
  text:string;
  options:string[];
};

function splitOCR(text:string):OCRSplitQuestion[]{
  const rows=text.replace(/\r/g,"").split("\n");
  const result:OCRSplitQuestion[]=[];
  let current:OCRSplitQuestion|null=null;
  for(const raw of rows){
    const line=raw.trim();
    if(!line) continue;
    const q=line.match(/^(\d+)[\.\)]\s*(.*)/);
    const opt=line.match(/^([A-E])[\)\.]\s*(.*)/i);
    if(q){
      if(current) result.push(current);
      current={no:Number(q[1]), text:q[2], options:[]};
    }else if(opt && current){
      current.options.push(`${opt[1].toUpperCase()}) ${opt[2]}`);
    }else if(current){
      current.text += " " + line;
    }
  }
  if(current) result.push(current);
  return result;
}

export default function OCRAutoSplitPanel(){
  const [ocr,setOcr]=useState("");
  const questions=useMemo(()=>splitOCR(ocr),[ocr]);

  return <div className="rounded-2xl border bg-white p-4">
    <div className="text-sm font-black text-cyan-800">OCR Otomatik Soru Ayırma</div>
    <textarea
      className="mt-3 min-h-40 w-full rounded-xl border p-3 text-sm"
      placeholder="OCR metnini buraya yapıştırın..."
      value={ocr}
      onChange={e=>setOcr(e.target.value)}
    />
    <div className="mt-4 grid gap-3">
      {questions.map(q=><div key={q.no} className="rounded-xl bg-slate-50 p-3">
        <b>{q.no}. Soru</b>
        <div>{q.text}</div>
        {q.options.map(o=><div key={o}>{o}</div>)}
      </div>)}
    </div>
  </div>
}
