import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";

type RankingStudentPanelProps={
  adminRankingSelected:any;
  adminRankingSelectedIndex:any;
  adminRankingFilteredRows:any;
  moveAdminRankingSelection:any;
  setAdminRankingSelected:any;
  safeFixed:any;
  adminRankingSelectedHistory:any;
  adminRankingSelectedTrend:any;
  adminRankingSelectedInsight:any;
  adminRankingSelectedBenchmarks:any;
  adminRankingSelectedActionPlan:any;
  adminRankingPlanChecks:any;
  adminRankingPlanProgress:any;
  adminRankingPlanCompleted:any;
  resetAdminRankingPlanChecks:any;
  toggleAdminRankingPlanCheck:any;
  adminRankingMode:any;
  setShowStudentReportV2:any;
  setShowWhatsAppModal:any;
  exportSelectedStudentActionPlan:any;
  copyAdminRankingStudentSummary:any;
};

export default function RankingStudentPanel({
  adminRankingSelected,
  adminRankingSelectedIndex,
  adminRankingFilteredRows,
  moveAdminRankingSelection,
  setAdminRankingSelected,
  safeFixed,
  adminRankingSelectedHistory,
  adminRankingSelectedTrend,
  adminRankingSelectedInsight,
  adminRankingSelectedBenchmarks,
  adminRankingSelectedActionPlan,
  adminRankingPlanChecks,
  adminRankingPlanProgress,
  adminRankingPlanCompleted,
  resetAdminRankingPlanChecks,
  toggleAdminRankingPlanCheck,
  adminRankingMode,
  setShowStudentReportV2,
  setShowWhatsAppModal,
  exportSelectedStudentActionPlan,
  copyAdminRankingStudentSummary
}:RankingStudentPanelProps){
  return (
    <aside className="min-h-0 overflow-auto rounded-xl border border-slate-300 bg-white p-4 shadow-lg">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><UserRound className="h-5 w-5"/></span><div><h3 className="text-sm font-black text-slate-900">{adminRankingSelected.studentName}</h3><p className="mt-1 text-[9px] font-bold text-slate-500">{adminRankingSelected.studentNumber} · {adminRankingSelected.classroom}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={()=>moveAdminRankingSelection(-1)} disabled={adminRankingSelectedIndex<=0} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Önceki öğrenci"><ChevronLeft className="h-4 w-4"/></button><button type="button" onClick={()=>moveAdminRankingSelection(1)} disabled={adminRankingSelectedIndex<0||adminRankingSelectedIndex>=adminRankingFilteredRows.length-1} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Sonraki öğrenci"><ChevronRight className="h-4 w-4"/></button><button type="button" onClick={()=>setAdminRankingSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4"/></button></div></div>
                    <div className={`mt-4 rounded-2xl border p-4 ${adminRankingSelected.academicStatus?.tone==="rose"?"border-rose-200 bg-rose-50":adminRankingSelected.academicStatus?.tone==="amber"?"border-amber-200 bg-amber-50":adminRankingSelected.academicStatus?.tone==="blue"?"border-blue-200 bg-blue-50":"border-emerald-200 bg-emerald-50"}`}><div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Akademik Durum</span><strong className="mt-1 block text-sm font-black text-slate-900">{adminRankingSelected.academicStatus?.label}</strong></div><div className="text-right"><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Risk Puanı</span><strong className="mt-1 block text-2xl font-black text-slate-900">{adminRankingSelected.riskScore}</strong></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80"><div className={`${adminRankingSelected.riskScore>=65?"bg-rose-500":adminRankingSelected.riskScore>=45?"bg-amber-500":adminRankingSelected.riskScore>=25?"bg-blue-500":"bg-emerald-500"} h-full rounded-full`} style={{width:`${adminRankingSelected.riskScore}%`}}/></div></div>
                    <div className="mt-4 grid grid-cols-2 gap-2">{[["Toplam Net",safeFixed(adminRankingSelected.totalNet,2)],["Başarı Yüzdesi",`%${safeFixed(adminRankingSelected.successRate,1)}`],["Genel Puan",safeFixed(adminRankingSelected.score,2)],["Şube Sırası",adminRankingSelected.classroomRank],["Kurum Sırası",adminRankingSelected.institutionRank],["Genel Sıra",adminRankingSelected.generalRank],["Doğru / Yanlış",`${adminRankingSelected.totalCorrect} / ${adminRankingSelected.totalWrong}`],["Boş",adminRankingSelected.totalEmpty]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-slate-50 p-3"><span className="text-[8px] font-bold text-slate-400">{label}</span><strong className="mt-1 block text-base font-black text-slate-900">{value}</strong></div>)}</div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">Son Sınav Eğilimi</span><strong className="mt-1 block text-xs font-black text-slate-900">Son {adminRankingSelectedHistory.length||0} sınav</strong></div>
                        {adminRankingSelectedTrend&&<span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${adminRankingSelectedTrend.direction==="up"?"bg-emerald-100 text-emerald-700":adminRankingSelectedTrend.direction==="down"?"bg-rose-100 text-rose-700":"bg-blue-100 text-blue-700"}`}>{adminRankingSelectedTrend.direction==="up"?"Yükseliyor":adminRankingSelectedTrend.direction==="down"?"Düşüyor":"Dengeli"} · {adminRankingSelectedTrend.change>0?"+":""}{safeFixed(adminRankingSelectedTrend.change,2)} net</span>}
                      </div>
                      {adminRankingSelectedHistory.length>0?<>
                        <div className="mt-4 flex h-24 items-end gap-2">
                          {adminRankingSelectedHistory.map((item,index)=>{
                            const min=adminRankingSelectedTrend?.min||0;
                            const max=adminRankingSelectedTrend?.max||0;
                            const range=Math.max(1,max-min);
                            const height=28+Math.max(0,Math.min(68,(item.net-min)/range*68));
                            const isLast=index===adminRankingSelectedHistory.length-1;
                            return <div key={`${item.id}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                              <span className={`text-[8px] font-black ${isLast?"text-indigo-700":"text-slate-500"}`}>{safeFixed(item?.net,2)}</span>
                              <div className={`w-full max-w-8 rounded-t-lg ${isLast?"bg-indigo-600":"bg-slate-300"}`} style={{height:`${height}%`}} title={`${item.examName}: ${safeFixed(item?.net,2)} net`}/>
                              <span className="max-w-full truncate text-[7px] font-bold text-slate-400" title={item.examName}>{item.examName}</span>
                            </div>;
                          })}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-white p-2.5"><span className="text-[7px] font-bold text-slate-400">İlk Net</span><strong className="mt-1 block text-xs font-black text-slate-900">{safeFixed(adminRankingSelectedTrend?.first,2)}</strong></div>
                          <div className="rounded-xl bg-white p-2.5"><span className="text-[7px] font-bold text-slate-400">Son Net</span><strong className="mt-1 block text-xs font-black text-slate-900">{safeFixed(adminRankingSelectedTrend?.last,2)}</strong></div>
                          <div className="rounded-xl bg-white p-2.5"><span className="text-[7px] font-bold text-slate-400">Son Kurum Sırası</span><strong className="mt-1 block text-xs font-black text-slate-900">{adminRankingSelectedHistory[adminRankingSelectedHistory.length-1]?.institutionRank||"—"}</strong></div>
                        </div>
                      </>:<p className="mt-3 rounded-xl bg-white p-3 text-[9px] leading-5 text-slate-500">Öğrencinin geçmiş sınav eğilimini göstermek için eşleşen sınav sonucu bulunamadı.</p>}
                    </div>
                    {adminRankingSelectedInsight&&<>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><span className="text-[8px] font-black uppercase tracking-[.12em] text-emerald-700">Güçlü Ders</span><strong className="mt-2 block text-sm font-black text-emerald-950">{adminRankingSelectedInsight.strongest?.name||"—"}</strong><div className="mt-2 flex items-end justify-between"><span className="text-[9px] text-emerald-700">Ders neti</span><span className="text-xl font-black text-emerald-800">{safeFixed(adminRankingSelectedInsight.strongest?.net,2)||"0.00"}</span></div></div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><span className="text-[8px] font-black uppercase tracking-[.12em] text-amber-700">Gelişim Alanı</span><strong className="mt-2 block text-sm font-black text-amber-950">{adminRankingSelectedInsight.support?.name||"—"}</strong><div className="mt-2 flex items-end justify-between"><span className="text-[9px] text-amber-700">Ders neti</span><span className="text-xl font-black text-amber-800">{safeFixed(adminRankingSelectedInsight.support?.net,2)||"0.00"}</span></div></div>
                      </div>
                      {adminRankingSelectedBenchmarks.length>0&&<div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">Ders Karşılaştırması</span><strong className="mt-1 block text-xs font-black text-slate-900">Öğrenci · Şube · Kurum</strong></div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black text-slate-600">{adminRankingSelectedBenchmarks.length} ders</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {adminRankingSelectedBenchmarks.map((item:any)=>{
                            const positive=item.institutionDelta>=0;
                            return <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3"><strong className="truncate text-[10px] text-slate-800" title={item.name}>{item.name}</strong><span className={`rounded-full px-2 py-1 text-[8px] font-black ${positive?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{positive?'+':''}{safeFixed(item?.institutionDelta,2)} kurum farkı</span></div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-white p-2"><span className="block text-[7px] font-bold text-slate-400">Öğrenci</span><strong className="mt-1 block text-[10px] text-indigo-700">{safeFixed(item?.net,2)}</strong></div>
                                <div className="rounded-lg bg-white p-2"><span className="block text-[7px] font-bold text-slate-400">Şube Ort.</span><strong className="mt-1 block text-[10px] text-slate-700">{safeFixed(item?.classroomAverage,2)}</strong></div>
                                <div className="rounded-lg bg-white p-2"><span className="block text-[7px] font-bold text-slate-400">Kurum Ort.</span><strong className="mt-1 block text-[10px] text-slate-700">{safeFixed(item?.institutionAverage,2)}</strong></div>
                              </div>
                            </div>;
                          })}
                        </div>
                      </div>}
                      {adminRankingSelectedActionPlan.length>0&&<div className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-violet-700"/><div><span className="block text-[8px] font-black uppercase tracking-[.12em] text-violet-700">Kişiselleştirilmiş Çalışma Planı</span><strong className="mt-1 block text-xs font-black text-violet-950">Öncelik sırasına göre ilk 3 ders</strong></div></div>
                          <div className="flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black text-violet-700">%{adminRankingPlanProgress} tamamlandı</span><button type="button" onClick={resetAdminRankingPlanChecks} title="İlerlemeyi sıfırla" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-600 hover:bg-violet-100"><RotateCcw className="h-3.5 w-3.5"/></button></div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80"><div className="h-full rounded-full bg-violet-600 transition-all" style={{width:`${adminRankingPlanProgress}%`}}/></div>
                        <div className="mt-2 flex items-center justify-between text-[8px] font-bold text-violet-700"><span>{adminRankingPlanCompleted} / {adminRankingSelectedActionPlan.length} görev tamamlandı</span><span>7 günlük plan</span></div>
                        <div className="mt-3 space-y-2">{adminRankingSelectedActionPlan.map((item:any,index:number)=>{
                          const completed=Boolean(adminRankingPlanChecks[item.name]);
                          const tone=item.priority==="high"?"border-rose-200 bg-rose-50 text-rose-700":item.priority==="medium"?"border-amber-200 bg-amber-50 text-amber-700":"border-emerald-200 bg-emerald-50 text-emerald-700";
                          const label=item.priority==="high"?"Yüksek Öncelik":item.priority==="medium"?"Orta Öncelik":"Başarıyı Koru";
                          return <div key={item.name} className={`rounded-xl border p-3 shadow-sm transition ${completed?'border-emerald-200 bg-emerald-50/90':'border-white/70 bg-white/80'}`}>
                            <div className="flex items-start gap-3"><button type="button" onClick={()=>toggleAdminRankingPlanCheck(item.name)} title={completed?'Görevi tamamlanmadı olarak işaretle':'Görevi tamamlandı olarak işaretle'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${completed?'bg-emerald-600 text-white':'bg-violet-100 text-[9px] font-black text-violet-700 hover:bg-violet-200'}`}>{completed?<CheckCircle2 className="h-4 w-4"/>:index+1}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className={`truncate text-[10px] ${completed?'text-emerald-900 line-through decoration-emerald-400':'text-slate-900'}`} title={item.name}>{item.name}</strong><div className="flex items-center gap-1.5">{completed&&<span className="rounded-full bg-emerald-100 px-2 py-1 text-[7px] font-black text-emerald-700">Tamamlandı</span>}<span className={`rounded-full border px-2 py-1 text-[7px] font-black ${tone}`}>{label}</span></div></div><p className={`mt-1 text-[8px] leading-4 ${completed?'text-emerald-700':'text-slate-500'}`}>{item.focus}</p></div></div>
                            <div className="mt-2 grid grid-cols-3 gap-2"><div className="rounded-lg bg-slate-50 p-2 text-center"><span className="block text-[7px] text-slate-400">Başarı</span><strong className="text-[9px] text-slate-800">%{item.success}</strong></div><div className="rounded-lg bg-slate-50 p-2 text-center"><span className="block text-[7px] text-slate-400">Kurum Farkı</span><strong className={`text-[9px] ${item.institutionDelta>=0?'text-emerald-700':'text-rose-700'}`}>{item.institutionDelta>0?'+':''}{safeFixed(item?.institutionDelta,2)}</strong></div><div className="rounded-lg bg-slate-50 p-2 text-center"><span className="block text-[7px] text-slate-400">Şube Farkı</span><strong className={`text-[9px] ${item.classroomDelta>=0?'text-emerald-700':'text-rose-700'}`}>{item.classroomDelta>0?'+':''}{safeFixed(item?.classroomDelta,2)}</strong></div></div>
                            <div className="mt-2 flex items-start gap-2 rounded-lg bg-violet-50 p-2.5"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600"/><span className="text-[8px] leading-4 text-violet-900">{item.weeklyAction}</span></div>
                          </div>;
                        })}</div>
                      </div>}
                      <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-700"/><span className="text-[8px] font-black uppercase tracking-[.12em] text-indigo-700">e-Nstitü Akademik Yorumu</span></div><p className="mt-2 text-[10px] leading-5 text-slate-700">{adminRankingSelectedInsight.status}. Kurum içinde yaklaşık üst %{adminRankingSelectedInsight.percentile} dilimde. En güçlü dersi <strong>{adminRankingSelectedInsight.strongest?.name||"-"}</strong> ({safeFixed(adminRankingSelectedInsight.strongest?.net,2)||"0.00"} net); öncelikli destek alanı <strong>{adminRankingSelectedInsight.support?.name||"-"}</strong> ({safeFixed(adminRankingSelectedInsight.support?.net,2)||"0.00"} net).</p><div className="mt-3 space-y-2">{(Array.isArray(adminRankingSelectedInsight.recommendations)?adminRankingSelectedInsight.recommendations:[]).map((recommendation:string,index:number)=><div key={index} className="flex gap-2 rounded-xl bg-white/70 p-2.5 text-[9px] leading-4 text-slate-700"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"/>{recommendation}</div>)}</div></div>
                    </>}
                    <div className="mt-4"><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">Ders Performansı</span><div className="mt-2 space-y-2">{(Array.isArray(adminRankingSelected.subjects)?adminRankingSelected.subjects:[]).map((subject:any)=><div key={subject.name} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-slate-800">{subject.name}</strong><span className="text-[10px] font-black text-indigo-700">{safeFixed(subject?.net,2)} net</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${subject.totalQuestions&&subject.net/subject.totalQuestions>=.8?'bg-emerald-500':subject.totalQuestions&&subject.net/subject.totalQuestions>=.6?'bg-lime-500':subject.totalQuestions&&subject.net/subject.totalQuestions>=.4?'bg-amber-500':'bg-rose-500'}`} style={{width:`${subject.totalQuestions?Math.max(0,Math.min(100,subject.net/subject.totalQuestions*100)):0}%`}}/></div><div className="mt-2 flex justify-between text-[8px] text-slate-500"><span>D {subject.correct} · Y {subject.wrong} · B {subject.empty}</span><span>{adminRankingMode==='classroom'?'Şube':'Kurum'} {adminRankingMode==='classroom'?subject.classroomRank:subject.institutionRank}.</span></div></div>)}</div></div>
                    <div className="mt-4 grid gap-2"><button type="button" onClick={()=>setShowStudentReportV2(true)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-[10px] font-black text-white hover:bg-indigo-800"><Eye className="h-4 w-4"/>Öğrenci Karnesini Aç</button><div className="grid grid-cols-3 gap-2"><button type="button" onClick={()=>setShowWhatsAppModal(true)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-2 py-3 text-[8px] font-black text-white hover:bg-emerald-800"><MessageCircle className="h-4 w-4"/>WhatsApp</button><button type="button" onClick={exportSelectedStudentActionPlan} className="flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-2 py-3 text-[8px] font-black text-white hover:bg-violet-800"><Download className="h-4 w-4"/>Plan PDF</button><button type="button" onClick={copyAdminRankingStudentSummary} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-3 text-[8px] font-black text-slate-700 hover:bg-slate-50"><FileText className="h-4 w-4"/>Özeti Kopyala</button></div></div>
                  </aside>
  );
}
