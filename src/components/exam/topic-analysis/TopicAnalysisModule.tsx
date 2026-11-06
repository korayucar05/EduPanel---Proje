import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { exportTablePdf } from "../../../utils/tablePdf";
import ReportFamilyHeader from "../reports/components/ReportFamilyHeader";
import { compareClassroomNames } from "../../../utils/classroomSort";
import { examLearningAnalysisService } from "../../../modules/exam/ExamLearningAnalysisService";

type Props = { exam: any; results: any[] };
type TopicRow = {
  key: string; subject: string; unit: string; topic: string; questions: Set<number>;
  correct: number; wrong: number; blank: number; total: number;
  classes: Record<string,{correct:number;total:number}>;
  questionStats: Record<number,{correct:number;wrong:number;blank:number;total:number;outcome:string}>;
};
type TopicQuestionStat = TopicRow["questionStats"][number];

const rate = (correct:number,total:number) => total ? Math.round(correct/total*100) : 0;
const stateOf = (value:number) => value < 40 ? "Kritik" : value < 60 ? "Geliştirilmeli" : value < 80 ? "Yeterli" : "Güçlü";
const stateTone:Record<string,string> = {
  Kritik:"border-rose-200 bg-rose-50 text-rose-700",
  "Geliştirilmeli":"border-orange-200 bg-orange-50 text-orange-700",
  Yeterli:"border-amber-200 bg-amber-50 text-amber-800",
  "Güçlü":"border-emerald-200 bg-emerald-50 text-emerald-700",
};

export async function exportTopicAnalysisPdf(exam:any, topicRows:TopicRow[],download=true){
  const grouped=topicRows.reduce((map:Record<string,TopicRow[]>,row)=>{map[row.subject]||=[];map[row.subject].push(row);return map},{});
  const sections:any[]=[];
  for(const [subjectName,subjectRows] of Object.entries(grouped)){
    const reportRows=subjectRows.map(row=>{
      const success=rate(row.correct,row.total),state=stateOf(success);
      const values=Object.values(row.classes).map(v=>rate(v.correct,v.total));
      const spread=values.length?Math.max(...values)-Math.min(...values):0;
      const outcomeGroups=Object.entries(row.questionStats).reduce((map:Record<string,string[]>,[no,question])=>{const outcome=question.outcome||"Kazanım belirtilmemiş";map[outcome]||=[];map[outcome].push(no);return map},{});
      const outcomeText=Object.entries(outcomeGroups).map(([outcome,numbers],index)=>`${index+1}. ${outcome} [${numbers.sort((a,b)=>Number(a)-Number(b)).map(no=>`S.${no}`).join(", ")}]`).join("\n");
      const successCell={text:`%${success}`,background:success<40?"#ffe4e6":success<60?"#ffedd5":success<80?"#d1fae5":"#a7f3d0",color:success<40?"#be123c":success<60?"#c2410c":success<80?"#047857":"#065f46",bold:true,boxed:true};
      const statusCell={text:state,background:state==="Güçlü"?"#d1fae5":state==="Kritik"?"#ffe4e6":"#ffedd5",color:state==="Güçlü"?"#047857":state==="Kritik"?"#be123c":"#c2410c",bold:true};
      return [row.unit,row.topic,outcomeText,row.questions.size,row.correct,row.wrong,`%${rate(row.blank,row.total)}`,successCell,`${spread} puan`,statusCell];
    });
    sections.push({title:subjectName,subtitle:`${subjectRows.length} konu`,headers:["Ünite","Konu","Kazanımlar ve Sorular","Soru","Doğru","Yanlış","Boş %","Başarı","Şube Farkı","Durum"],widths:[10,12,31,5,6,6,5,7,8,10],rows:reportRows});
  }
  return await exportTablePdf(`${exam?.examName||"sinav"}-konu-kazanim-degerlendirme.pdf`,"Konu ve Kazanım Değerlendirme",sections,{orientation:"landscape",rowsPerPage:14,download,designedHeader:{variant:"analysis",accent:"topic",schoolName:exam?.schoolName||exam?.institutionName||"ORDU LİSESİ",examName:exam?.examName||"Sınav",examDate:exam?.examDate,reportName:"KONU VE KAZANIM DEĞERLENDİRME",meta:[{label:"DERS",value:"Tümü"},{label:"KAPSAM",value:`${topicRows.length} konu`},{label:"ANALİZ",value:"Kazanım"}]}});
}

export function buildTopicAnalysisRows(results:any[],classroom="Tümü",subject="Tümü"){
  return examLearningAnalysisService.buildTopicRows(results, classroom, subject) as TopicRow[];
}

export default function TopicAnalysisModule({ exam, results }:Props) {
  const [classroom,setClassroom]=useState("Tümü");
  const [subject,setSubject]=useState("Tümü");
  const [status,setStatus]=useState("Tümü");
  const [focus,setFocus]=useState("");
  const [expanded,setExpanded]=useState("");
  const reportRef=useRef<HTMLDivElement>(null);

  const classrooms=useMemo(()=>["Tümü",...Array.from(new Set(results.map(r=>r.classroom))).sort(compareClassroomNames)], [results]);
  const subjects=useMemo(()=>["Tümü",...Array.from(new Set(results.flatMap(r=>r.subjects.map((s:any)=>s.subjectName)))).sort()], [results]);

  const topics=useMemo(()=>buildTopicAnalysisRows(results,classroom,subject),[results,classroom,subject]);

  const classSpread=(row:TopicRow)=>{const values=Object.values(row.classes).map(v=>rate(v.correct,v.total));return values.length?Math.max(...values)-Math.min(...values):0};
  const blankRate=(row:TopicRow)=>rate(row.blank,row.total);
  const matchesFocus=(row:TopicRow)=>!focus||(focus==="critical"&&rate(row.correct,row.total)<40)||(focus==="blank"&&blankRate(row)>=20)||(focus==="spread"&&classSpread(row)>=20)||(focus==="dense"&&row.questions.size>=3&&rate(row.correct,row.total)<50)||(focus==="single"&&row.questions.size===1);
  const filtered=topics.filter(row=>(status==="Tümü"||stateOf(rate(row.correct,row.total))===status)&&matchesFocus(row));
  const focusItems=[
    {id:"critical",label:"Kritik konular",detail:"Başarı < %40",count:topics.filter(r=>rate(r.correct,r.total)<40).length,tone:"border-rose-200 bg-rose-50 text-rose-700"},
    {id:"blank",label:"Fazla boş",detail:"Boş ≥ %20",count:topics.filter(r=>blankRate(r)>=20).length,tone:"border-amber-200 bg-amber-50 text-amber-800"},
    {id:"spread",label:"Şube farkı",detail:"Fark ≥ 20 puan",count:topics.filter(r=>classSpread(r)>=20).length,tone:"border-violet-200 bg-violet-50 text-violet-700"},
    {id:"dense",label:"Yoğun ama zayıf",detail:"≥3 soru, başarı < %50",count:topics.filter(r=>r.questions.size>=3&&rate(r.correct,r.total)<50).length,tone:"border-orange-200 bg-orange-50 text-orange-800"},
    {id:"single",label:"Tek soruyla ölçülen",detail:"Güven sınırlı",count:topics.filter(r=>r.questions.size===1).length,tone:"border-slate-200 bg-slate-50 text-slate-700"},
  ].filter(x=>x.count>0);

  const exportCsv=()=>{const lines=[["Ders","Ünite","Konu","Soru Sayısı","Doğru","Yanlış","Boş","Başarı %","Şube Farkı","Durum"],...filtered.map(r=>[r.subject,r.unit,r.topic,r.questions.size,r.correct,r.wrong,r.blank,rate(r.correct,r.total),classSpread(r),stateOf(rate(r.correct,r.total))])];const blob=new Blob(["\ufeff"+lines.map(x=>x.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="konu-analizi.csv";a.click();URL.revokeObjectURL(url)};
  return <>
    <div className="space-y-4 pt-2">
      <ReportFamilyHeader variant="analysis" accent="topic" schoolName={exam?.schoolName||exam?.institutionName||"ORDU LİSESİ"} examName={exam?.examName||"Sınav"} examDate={exam?.examDate} reportName="KONU VE KAZANIM DEĞERLENDİRME" meta={[{label:"DERS",value:subject},{label:"KONU",value:filtered.length},{label:"SINIF",value:classroom}]} compact/>
      <section className="flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">{focusItems.map(item=><button key={item.id} onClick={()=>setFocus(focus===item.id?"":item.id)} className={`rounded-xl border px-3 py-2 text-left text-[10px] font-black ${item.tone} ${focus===item.id?"ring-2 ring-orange-700 ring-offset-2":""}`}>{item.label}<span className="ml-2 rounded bg-white/70 px-1.5 py-0.5">{item.count}</span><span className="ml-2 opacity-70">{item.detail}</span></button>)}{focus&&<button onClick={()=>setFocus("")} className="rounded-xl border bg-slate-50 px-3 text-[10px] font-black text-slate-600">Tüm konular</button>}</section>
      <div ref={reportRef} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-2 border-b p-4 md:grid-cols-[1fr_1fr_180px]"><select value={classroom} onChange={e=>setClassroom(e.target.value)} className="rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-xs font-black text-orange-950">{classrooms.map(x=><option key={x}>{x==="Tümü"?"Tüm Sınıf / Şubeler":x}</option>)}</select><select value={subject} onChange={e=>setSubject(e.target.value)} className="rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-xs font-black text-orange-950">{subjects.map(x=><option key={x}>{x==="Tümü"?"Tüm Dersler":x}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-xs font-bold"><option>Tümü</option><option>Kritik</option><option>Geliştirilmeli</option><option>Yeterli</option><option>Güçlü</option></select></div>
        <div className="overflow-x-auto"><table className="w-full table-fixed text-left text-[11px]"><colgroup><col className="w-[11%]"/><col className="w-[12%]"/><col className="w-[31%]"/><col className="w-[5%]"/><col className="w-[5%]"/><col className="w-[5%]"/><col className="w-[5%]"/><col className="w-[10%]"/><col className="w-[7%]"/><col className="w-[9%]"/></colgroup><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Ders / Ünite","Konu","Kazanımlar ve Bağlı Sorular","Soru","Doğru","Yanlış","Boş","Başarı","Şube farkı","Durum"].map(h=><th key={h} className="px-2 py-3">{h}</th>)}</tr></thead><tbody>{filtered.map(row=>{const success=rate(row.correct,row.total);const questionEntries=Object.entries(row.questionStats) as [string,TopicQuestionStat][];const groups=questionEntries.reduce<Record<string,string[]>>((acc,[no,q])=>{const outcome=q.outcome||"Kazanım belirtilmemiş";acc[outcome]||=[];acc[outcome].push(no);return acc},{});return <tr key={row.key} className="border-t align-top hover:bg-orange-50/40"><td className="px-2 py-3"><b>{row.subject}</b><p className="text-[10px] text-slate-400">{row.unit}</p></td><td className="break-words px-2 py-3 font-bold">{row.topic}</td><td className="space-y-2 px-2 py-3">{Object.entries(groups).map(([outcome,numbers],index)=><div key={outcome} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2"><div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-black uppercase tracking-wider text-orange-700">Kazanım {index+1}</span><p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-700">{outcome}</p></div><div className="flex max-w-[150px] flex-wrap justify-end gap-1">{numbers.sort((a,b)=>Number(a)-Number(b)).map(no=><span key={no} className="rounded-md bg-orange-800 px-1.5 py-1 text-[9px] font-black text-white">S.{no}</span>)}</div></div></div>)}</td><td className="px-2 py-3 text-center font-black">{row.questions.size}</td><td className="px-2 py-3 text-center text-emerald-600">{row.correct}</td><td className="px-2 py-3 text-center text-rose-600">{row.wrong}</td><td className="px-2 py-3">{row.blank}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><div className="h-2 min-w-0 flex-1 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${success<40?"bg-rose-500":success<60?"bg-orange-500":success<80?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${success}%`}}/></div><b>%{success}</b></div></td><td className="px-2 py-3 text-center text-[10px] font-black">{classSpread(row)} puan</td><td className="px-2 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${stateTone[stateOf(success)]}`}>{stateOf(success)}</span></td></tr>})}</tbody></table>{!filtered.length&&<p className="p-10 text-center text-sm font-bold text-slate-400">Seçilen ölçütlere uygun konu bulunamadı.</p>}</div>
      </div>
    </div></>;
}

function ExpandedTopic({row}:{row:TopicRow}){
  const classes=Object.entries(row.classes).map(([name,v])=>({name,value:rate(v.correct,v.total)})).sort((a,b)=>b.value-a.value);
  const questions=Object.entries(row.questionStats).sort(([a],[b])=>Number(a)-Number(b));
  const outcomes=questions.reduce((groups:Record<string,typeof questions>,question)=>{
    const outcome=question[1].outcome||"Kazanım belirtilmemiş";
    groups[outcome]||=[]; groups[outcome].push(question); return groups;
  },{});
  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div className="rounded-2xl border bg-white p-4">
      <h4 className="mb-3 text-xs font-black">Şubeler arası karşılaştırma</h4>
      {classes.map(x=><div key={x.name} className="mb-2 flex items-center gap-2 text-[10px] font-bold"><span className="w-12">{x.name}</span><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-600" style={{width:`${x.value}%`}}/></div><span className="w-8">%{x.value}</span></div>)}
    </div>
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-black">Kazanımlar ve bağlı sorular</h4><span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-700">{Object.keys(outcomes).length} kazanım</span></div>
      <div className="space-y-3">{Object.entries(outcomes).map(([outcome,items],index)=><section key={outcome} className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex flex-col gap-2 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[9px] font-black uppercase tracking-wider text-orange-700">Kazanım {index+1}</span><h5 className="mt-0.5 text-xs font-black text-slate-800">{outcome}</h5></div><div className="flex flex-wrap gap-1">{items.map(([no])=><span key={no} className="rounded-lg bg-orange-800 px-2 py-1 text-[10px] font-black text-white">Soru {no}</span>)}</div></div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(([no,q])=>{const success=rate(q.correct,q.total);return <div key={no} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-[10px] font-black">Soru {no}</span><span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${success<40?"bg-rose-50 text-rose-700":success<60?"bg-orange-50 text-orange-700":success<80?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-700"}`}>%{success}</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${success<40?"bg-rose-500":success<60?"bg-orange-500":success<80?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${success}%`}}/></div><div className="mt-2 flex justify-between text-[9px] font-bold text-slate-500"><span className="text-emerald-600">{q.correct} doğru</span><span className="text-rose-600">{q.wrong} yanlış</span><span>{q.blank} boş</span></div></div>})}</div>
      </section>)}</div>
    </div>
  </div>;
}


