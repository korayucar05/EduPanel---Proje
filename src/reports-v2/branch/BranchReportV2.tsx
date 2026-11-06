import React from "react";
import { PremiumReportCard } from "../../hasat-core/ui/PremiumReportCard";
import { PremiumReportFooter } from "../../hasat-core/ui/PremiumReportFooter";
import type { BranchReportV2Data } from "./buildBranchReportV2Data";

const fmt=(value:number,digits=2)=>Number(value||0).toFixed(digits);

export function BranchReportV2({report}:{report:BranchReportV2Data}){
  const maxClassNet=Math.max(1,...report.classrooms.map(item=>item.averageNet));
  const maxBand=Math.max(1,...report.scoreBands.map(item=>item.count));
  const students=[...report.students].sort((a,b)=>b.net-a.net).slice(0,16);

  return <div id="hasat-branch-report-v2" className="bg-slate-100 p-4 text-slate-800">
    <section className="mx-auto h-[794px] w-[1123px] overflow-hidden bg-white p-5">
      <div className="mb-3 flex items-end justify-between border-b-2 border-slate-900 pb-2">
        <div><span className="text-[7px] font-black uppercase tracking-[.2em] text-slate-500">Branş karşılaştırması</span><h1 className="mt-1 text-[16px] font-black tracking-tight">{report.subjectName} · {report.examName}</h1></div>
        <p className="max-w-[420px] text-right text-[8px] leading-4 text-slate-600">{report.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-[1.05fr_.95fr_.9fr] gap-2">
        <PremiumReportCard className="p-3"><div className="mb-2 flex items-baseline justify-between"><h2 className="text-[10px] font-black">Şube performansı</h2><span className="text-[7px] text-slate-400">Net · başarı</span></div><div className="space-y-1.5">
          {report.classrooms.slice(0,10).map((item,index)=><div key={item.classroom} className="grid grid-cols-[48px_1fr_34px_32px] items-center gap-1.5 text-[8px]"><strong className="truncate">{index+1}. {item.classroom}</strong><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{width:`${Math.max(3,item.averageNet/maxClassNet*100)}%`}}/></div><strong className="text-right">{fmt(item.averageNet,1)}</strong><span className="text-right text-slate-500">%{fmt(item.successRate,0)}</span></div>)}
        </div></PremiumReportCard>

        <PremiumReportCard className="p-3"><h2 className="mb-2 text-[10px] font-black">Dikkat alanları</h2><div className="space-y-1.5">
          {report.attentionItems.slice(0,4).map((item,index)=><div key={index} className={`rounded-lg border px-2 py-1.5 text-[8px] ${item.level==="risk"?"border-rose-200 bg-rose-50":item.level==="warning"?"border-amber-200 bg-amber-50":"border-emerald-200 bg-emerald-50"}`}><strong className="block text-[8px]">{item.title}</strong><span className="mt-0.5 block leading-3 text-slate-600">{item.detail}</span></div>)}
        </div><div className="mt-2 flex h-[54px] items-end gap-2 border-b border-l border-slate-200 px-2 pb-1">{report.scoreBands.map(item=><div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end"><strong className="text-[7px]">{item.count}</strong><div className="mt-0.5 w-3/5 rounded-t bg-indigo-600" style={{height:`${Math.max(4,item.count/maxBand*100)}%`}}/><span className="mt-0.5 text-[6px] text-slate-500">{item.label}</span></div>)}</div></PremiumReportCard>

        <PremiumReportCard className="p-3"><div className="mb-2 flex items-baseline justify-between"><h2 className="text-[10px] font-black">Öncelikli öğrenciler</h2><span className="text-[7px] text-rose-600">{report.riskStudents.length} risk</span></div><div className="space-y-1">
          {report.riskStudents.slice(0,7).map((item,index)=><div key={`${item.studentNumber}-${index}`} className="grid grid-cols-[minmax(0,1fr)_32px_28px] gap-1 rounded bg-rose-50 px-2 py-1 text-[7px]"><span className="truncate font-bold text-rose-900">{item.name} · {item.classroom}</span><strong className="text-right">{fmt(item.net,1)}</strong><span className="text-right">%{fmt(item.successRate,0)}</span></div>)}
          {!report.riskStudents.length&&<p className="pt-4 text-center text-[8px] text-slate-400">Öncelikli risk öğrencisi yok.</p>}
        </div></PremiumReportCard>
      </div>

      <div className="mt-2 grid grid-cols-[1.3fr_.7fr] gap-2">
        <PremiumReportCard className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><h2 className="text-[10px] font-black">İlk 16 öğrenci sıralaması</h2><span className="text-[7px] text-slate-400">Net sırasıyla</span></div><table className="w-full border-collapse text-[7px]"><thead className="bg-slate-900 text-white"><tr>{["#","Öğrenci","Şube","D","Y","B","Net","%"].map(item=><th key={item} className="px-2 py-1 text-left">{item}</th>)}</tr></thead><tbody>{students.map((item,index)=><tr key={`${item.studentNumber}-${index}`} className={index%2?"bg-slate-50":""}><td className="px-2 py-1 font-black">{index+1}</td><td className="max-w-[205px] truncate px-2 py-1 font-bold">{item.name} <span className="font-medium text-slate-400">({item.studentNumber})</span></td><td className="px-2 py-1">{item.classroom}</td><td className="px-2 py-1">{fmt(item.correct,1)}</td><td className="px-2 py-1">{fmt(item.wrong,1)}</td><td className="px-2 py-1">{fmt(item.empty,1)}</td><td className="px-2 py-1 font-black">{fmt(item.net,1)}</td><td className="px-2 py-1">{fmt(item.successRate,0)}</td></tr>)}</tbody></table></PremiumReportCard>
        <PremiumReportCard className="p-3"><h2 className="mb-2 text-[10px] font-black">Kısa eylem planı</h2><div className="space-y-1.5">{report.actionPlan.slice(0,4).map(item=><div key={item.priority} className="grid grid-cols-[16px_1fr] gap-1.5 rounded-lg bg-slate-50 p-1.5"><strong className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-[7px] text-white">{item.priority}</strong><div><strong className="block text-[7px]">{item.title}</strong><span className="block text-[7px] leading-3 text-slate-500">{item.owner}</span></div></div>)}</div></PremiumReportCard>
      </div>
      <PremiumReportFooter brandLine="e-Nstitü · Branş Analiz Merkezi" reportCode={report.examName} rightText="Şube karşılaştırma ve eylem raporu" page={1} pageCount={1}/>
    </section>
  </div>;
}
