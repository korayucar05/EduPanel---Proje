import React,{useState} from 'react';
import {detectQuestionRegions} from './ocr/QuestionRegionDetector';

export default function DocumentQuestionDetector(){
 const [status,setStatus]=useState('Hazır');
 const [regions,setRegions]=useState<any[]>([]);
 const [text,setText]=useState('');
 const [fileName,setFileName]=useState('');

 const loadFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
   const f=e.target.files?.[0];
   if(!f)return;
   setFileName(f.name);
   const reader=new FileReader();
   reader.onload=()=>setText(String(reader.result||''));
   reader.readAsText(f);
 };
 const start=async()=>{
  setStatus('Sorular aranıyor...');
  const result=await detectQuestionRegions(text);
  setRegions(result);
  setStatus(result.length?`Algılandı: ${result.length} soru`:'Soru bulunamadı');
 };
 return <div className="rounded-2xl border bg-white p-4 space-y-3">
  <div className="font-black text-cyan-800">Otomatik Soru Algılama</div>
  <input type="file" accept=".txt,.ocr,.text" onChange={loadFile}/>
  {fileName&&<div className="text-xs">{fileName}</div>}
  <textarea className="w-full min-h-32 border rounded p-2" placeholder="OCR metnini yapıştırın veya dosya yükleyin" value={text} onChange={e=>setText(e.target.value)}/>
  <button className="rounded bg-cyan-700 text-white px-4 py-2" onClick={start}>🔍 Soruları Algıla</button>
  <div>{status}</div>
  {regions.map(r=><div key={r.questionNo}>Soru {r.questionNo}: y:{r.y} yükseklik:{r.height}</div>)}
 </div>
}
