import React from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  School,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type {AdminDecisionDashboard as AdminDecisionData} from "../../intelligence/admin";

const alertPalette={
  critical:"border-rose-200 bg-rose-50 text-rose-800",
  warning:"border-amber-200 bg-amber-50 text-amber-800",
  info:"border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

export function AdminDecisionDashboard({
  data,
  onStudentSelect,
}:{
  data:AdminDecisionData;
  onStudentSelect?:(studentNumber:string|number|undefined)=>void;
}){
  return <section className="space-y-4">
    <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Toplam Öğrenci",data.totalStudents,Users],
        ["Acil",data.urgentStudentCount,AlertTriangle],
        ["Destek",data.supportStudentCount,BookOpenCheck],
        ["Başarı",`%${data.schoolAverageSuccessRate}`,ShieldCheck],
        ["Ortalama Net",data.schoolAverageNet,School],
        ["Kritik Şube",data.criticalClassCount,Target],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-emerald-600"/>
        <span className="mt-3 block text-[10px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>


    <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-indigo-600">Yönetim Eylem Kuyruğu</span><h3 className="mt-1 text-sm font-black text-slate-900">Önceliklendirilmiş karar ve müdahale planı</h3></div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-indigo-700">{data.priorityActions.length} işlem</span>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {data.priorityActions.map((action,index)=><div key={action.id} className="rounded-2xl border border-indigo-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${action.priority>=5?"bg-rose-50 text-rose-700":action.priority>=4?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700"}`}>{index+1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-xs text-slate-900">{action.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">Öncelik {action.priority}/5</span></div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">{action.detail}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-1 text-[9px] font-black text-slate-400"><ClipboardCheck className="h-3.5 w-3.5"/>SORUMLU</span><strong className="mt-1 block text-[10px] text-slate-700">{action.owner}</strong></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-1 text-[9px] font-black text-slate-400"><CalendarClock className="h-3.5 w-3.5"/>SÜRE</span><strong className="mt-1 block text-[10px] text-slate-700">{action.urgency}</strong></div>
              </div>
              <p className="mt-3 text-[9px] leading-5 text-indigo-700"><strong>Kanıt:</strong> {action.evidence} · <strong>Beklenen etki:</strong> {action.expectedImpact}</p>
            </div>
          </div>
        </div>)}
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Yönetici Uyarıları</h3>
        <div className="mt-4 space-y-3">{data.alerts.map(alert=><div key={alert.key} className={`rounded-2xl border p-4 ${alertPalette[alert.level]}`}>
          <div className="flex items-start justify-between gap-3"><strong className="text-xs">{alert.title}</strong><span className="shrink-0 rounded-full bg-white/60 px-2 py-1 text-[9px] font-black">{alert.metric}</span></div>
          <p className="mt-2 text-[10px] leading-5 opacity-90">{alert.detail}</p>
          <p className="mt-3 rounded-xl bg-white/55 p-3 text-[10px] leading-5"><strong>Önerilen işlem:</strong> {alert.recommendedAction}</p>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Acil Müdahale Gereken Öğrenciler</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {data.urgentStudents.length?data.urgentStudents.slice(0,10).map(student=><button key={`${student.studentNumber}-${student.studentName}`} onClick={()=>onStudentSelect?.(student.studentNumber)} className="flex w-full items-center gap-3 py-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-xs font-black text-rose-700">{student.score}</div>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{student.studentName}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{student.classroom||"Sınıf yok"} · {student.primaryRisk?.title||student.headline}</span></div>
            <ChevronRight className="h-4 w-4 text-slate-300"/>
          </button>):<p className="py-8 text-center text-xs text-slate-400">Acil müdahale grubunda öğrenci yok.</p>}
        </div>
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Sınıf Risk Yoğunluğu</h3>
        <div className="mt-4 space-y-4">{data.classroomRisks.slice(0,8).map(item=><div key={item.classroom}>
          <div className="flex items-center justify-between gap-3"><div><strong className="text-xs text-slate-800">{item.classroom}</strong><span className="ml-2 text-[9px] text-slate-400">{item.studentCount} öğrenci</span></div><strong className="text-xs text-slate-900">{item.riskScore}/100</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.riskScore>=65?"bg-rose-500":item.riskScore>=40?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.min(100,item.riskScore)}%`}}/></div>
          <div className="mt-1 text-[9px] text-slate-400">{item.urgentCount} acil · {item.supportCount} destek · başarı %{item.averageSuccessRate}</div>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Ortak Ders Riskleri</h3>
        <div className="mt-4 divide-y divide-slate-100">{data.subjectRisks.slice(0,8).map(item=><div key={item.subject} className="flex items-center gap-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-xs font-black text-blue-700">{item.priorityCount}</div>
          <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{item.subject}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.priorityCount} öğrencide öncelikli · başarı %{item.averageSuccessRate}</span></div>
          <span className="text-[10px] font-bold text-slate-500">{item.suggestedWeeklyMinutes||0} dk</span>
        </div>)}</div>
      </div>
    </div>
    </>
  </section>;
}
