import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  buildEarlyWarningCenter,
  type BrainCohortResult,
  type BrainTimelineCohort,
} from "../../intelligence-v2";

const levelTone={
  critical:"bg-rose-50 text-rose-700 border-rose-200",
  high:"bg-orange-50 text-orange-700 border-orange-200",
  medium:"bg-amber-50 text-amber-700 border-amber-200",
  low:"bg-emerald-50 text-emerald-700 border-emerald-200",
} as const;

const levelLabel={
  critical:"Kritik",
  high:"Yüksek",
  medium:"Orta",
  low:"Düşük",
} as const;

export function EarlyWarningCenterDashboard({
  cohort,
  timeline,
}:{
  cohort:BrainCohortResult;
  timeline?:BrainTimelineCohort;
}){
  const data=React.useMemo(
    ()=>buildEarlyWarningCenter({cohort,timeline}),
    [cohort,timeline],
  );
  const [isFormOpen,setIsFormOpen]=React.useState(false);

  return <section className="space-y-4">
    <button type="button" onClick={()=>setIsFormOpen(current=>!current)} aria-expanded={isFormOpen} className={`w-full overflow-hidden rounded-3xl p-6 text-left text-white shadow-xl transition hover:brightness-110 ${
      data.summary.status==="critical"
        ?"bg-gradient-to-r from-rose-900 via-red-800 to-orange-700"
        :data.summary.status==="attention"
          ?"bg-gradient-to-r from-amber-800 via-orange-700 to-yellow-600"
          :"bg-gradient-to-r from-slate-900 via-blue-900 to-emerald-800"
    }`}>
      <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">e-Nstitü Early Warning 2.0</span>
      <h2 className="mt-2 text-2xl font-black">Erken Uyarı Merkezi</h2>
      <p className="mt-2 max-w-4xl text-xs leading-6 text-white/85">{data.summary.detail}</p>
      <span className="mt-4 block text-[10px] font-black text-white/80">{isFormOpen?"Formu kapat":"Erken uyarı formunu aç"}</span>
    </button>

    {isFormOpen&&<>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Öğrenci",data.totalStudents,Users],
        ["Şu An Kritik",data.criticalNow,ShieldAlert],
        ["Yaklaşan Kritik",data.projectedCritical,AlertTriangle],
        ["Düşüş Eğilimi",data.worseningStudentCount,TrendingDown],
        ["Gelişim Eğilimi",data.improvingStudentCount,TrendingUp],
        ["Riskli Sınıf",data.classroomWarnings[0]?.classroom||"—",Building2],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-rose-600"/>
        <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-rose-700"/><h3 className="text-sm font-black text-slate-900">Yaklaşan Riskler</h3></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400"><th className="px-3 py-3">Öğrenci</th><th className="px-3 py-3">Sınıf</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Artış</th><th className="px-3 py-3">Tahmin</th><th className="px-3 py-3">Neden</th><th className="px-3 py-3">Güven</th></tr></thead>
            <tbody>{data.topWarnings.map(item=><tr key={item.studentId} className="border-b border-slate-100 text-[10px] text-slate-600">
              <td className="px-3 py-3"><strong className="block text-xs text-slate-900">{item.studentName}</strong><span className="text-[9px] text-slate-400">{item.studentNumber||""}</span></td>
              <td className="px-3 py-3 font-bold">{item.classroom||"—"}</td>
              <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${levelTone[item.predictedWarningLevel]}`}>{levelLabel[item.predictedWarningLevel]}</span></td>
              <td className="px-3 py-3 font-black text-rose-700">+{item.riskIncrease.toFixed(1)}</td>
              <td className="px-3 py-3">{item.estimatedCriticalInExams===0?"Şimdi":item.estimatedCriticalInExams?`${item.estimatedCriticalInExams} sınav içinde`:"—"}</td>
              <td className="max-w-[300px] px-3 py-3"><span className="line-clamp-2">{item.reasons[0]||"Belirgin neden yok"}</span></td>
              <td className="px-3 py-3">%{item.confidence}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-amber-700"/><h3 className="text-sm font-black text-slate-900">İlk Müdahale Listesi</h3></div>
        <div className="mt-4 divide-y divide-slate-100">{data.topWarnings.slice(0,10).map((item,index)=><div key={item.studentId} className="py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-xs font-black text-rose-700">{index+1}</div>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{item.studentName}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.classroom||"Sınıf yok"} · {item.warningScore}/100</span><p className="mt-2 text-[10px] leading-5 text-slate-500">{item.recommendedActions[0]||"Yakın takip planlayın."}</p></div>
          </div>
        </div>)}</div>
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-blue-700"/><h3 className="text-sm font-black text-slate-900">Sınıf Erken Uyarı Haritası</h3></div>
        <div className="mt-4 space-y-4">{data.classroomWarnings.slice(0,12).map(item=><div key={item.classroom}>
          <div className="flex items-center justify-between"><div><strong className="text-xs text-slate-800">{item.classroom}</strong><span className="ml-2 text-[9px] text-slate-400">{item.projectedCriticalCount} yaklaşan kritik</span></div><strong className="text-xs text-slate-900">{item.averageWarningScore}/100</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.level==="critical"?"bg-rose-500":item.level==="high"?"bg-orange-500":item.level==="medium"?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.min(100,item.averageWarningScore)}%`}}/></div>
          <p className="mt-1 text-[9px] text-slate-400">{item.primaryReason}</p>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Activity className="h-5 w-5 text-violet-700"/><h3 className="text-sm font-black text-slate-900">Ders Erken Uyarıları</h3></div>
        <div className="mt-4 divide-y divide-slate-100">{data.subjectWarnings.slice(0,12).map(item=><div key={item.subject} className="flex items-center gap-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-xs font-black text-violet-700">{item.worseningStudentCount}</div>
          <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{item.subject}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.affectedStudentCount} öğrenci · {item.primaryReason}</span></div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${levelTone[item.level]}`}>{levelLabel[item.level]}</span>
        </div>)}</div>
      </div>
    </div>

    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">e-Nstitü Müdahale Önerileri</span>
      <div className="mt-3 space-y-2">{data.recommendations.map((item,index)=><div key={index} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><p className="text-[10px] leading-5 text-emerald-900">{item}</p></div>)}</div>
    </div>
    </>}
  </section>;
}
