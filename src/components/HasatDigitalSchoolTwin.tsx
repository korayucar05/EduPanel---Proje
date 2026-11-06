import React from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  GraduationCap,
  HeartPulse,
  School,
  ShieldCheck,
  Users,
} from "lucide-react";
import {buildDigitalSchoolTwin,buildHasatLiveSnapshot,hasatLiveEventBus} from "../intelligence-v3";

const metricTone={
  emerald:"border-emerald-200 bg-emerald-50 text-emerald-900",
  blue:"border-blue-200 bg-blue-50 text-blue-900",
  amber:"border-amber-200 bg-amber-50 text-amber-900",
  rose:"border-rose-200 bg-rose-50 text-rose-900",
  violet:"border-violet-200 bg-violet-50 text-violet-900",
  slate:"border-slate-200 bg-slate-50 text-slate-900",
} as const;

const statusLabel={stable:"Dengeli",attention:"Yakın İzleme",critical:"Kritik"} as const;
const statusClass={
  stable:"bg-emerald-100 text-emerald-800",
  attention:"bg-amber-100 text-amber-800",
  critical:"bg-rose-100 text-rose-800",
} as const;

export default function HasatDigitalSchoolTwin({
  students,
  teachers,
  classrooms,
  onNavigate,
}:{
  students:any[];
  teachers:any[];
  classrooms:any[];
  onNavigate?:(tab:string)=>void;
}){
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());
  React.useEffect(()=>hasatLiveEventBus.subscribe(()=>setEvents(hasatLiveEventBus.snapshot())),[]);

  const live=React.useMemo(()=>buildHasatLiveSnapshot({
    events,
    studentCount:students.length,
    teacherCount:teachers.length,
    classroomCount:classrooms.length,
  }),[events,students.length,teachers.length,classrooms.length]);

  const twin=React.useMemo(()=>buildDigitalSchoolTwin({students,teachers,classrooms,live}),[students,teachers,classrooms,live]);

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1650px] space-y-5">
      <header className={`overflow-hidden rounded-[36px] p-7 text-white shadow-xl ${
        twin.status==="critical"?"bg-gradient-to-r from-slate-950 via-rose-950 to-red-900":
        twin.status==="attention"?"bg-gradient-to-r from-slate-950 via-amber-950 to-orange-900":
        "bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-4xl">
            <span className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">e-Nstitü Digital Twin 1.0</span>
            <h1 className="mt-2 text-3xl font-black">Dijital Okul İkizi</h1>
            <p className="mt-3 text-sm leading-7 text-white/75">{twin.summary} Akademik, devam, davranış, risk ve operasyon verileri tek okul modeli içinde birleştiriliyor.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black ${twin.status==="stable"?"bg-emerald-400/20 text-emerald-100":twin.status==="attention"?"bg-amber-400/20 text-amber-100":"bg-rose-400/20 text-rose-100"}`}>{statusLabel[twin.status]}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/80">Veri güveni %{twin.confidence}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/80">Kapsama %{twin.dataCoverage.percentage}</span>
            </div>
          </div>
          <div className="flex h-44 w-44 shrink-0 flex-col items-center justify-center rounded-full border-[10px] border-white/15 bg-white/10 text-center shadow-inner backdrop-blur">
            <HeartPulse className="h-7 w-7 text-white/70"/>
            <strong className="mt-1 text-5xl font-black">{twin.schoolHealthScore}</strong>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/65">Okul Sağlık Puanı</span>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {twin.metrics.map(metric=><article key={metric.key} className={`rounded-3xl border p-5 shadow-sm ${metricTone[metric.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-[.12em] opacity-65">{metric.label}</span>
            <span className="rounded-full bg-white/70 px-2 py-1 text-[8px] font-black">Güven %{metric.confidence}</span>
          </div>
          <strong className="mt-3 block text-3xl font-black">{metric.score}</strong>
          <span className="mt-1 block text-xs font-black">{metric.value}</span>
          <p className="mt-2 text-[10px] leading-5 opacity-70">{metric.detail}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-current opacity-70" style={{width:`${metric.score}%`}}/></div>
        </article>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><GraduationCap className="h-5 w-5 text-indigo-700"/><h2 className="text-sm font-black text-slate-900">Sınıf Düzeyi Dijital İkizleri</h2></div>
            <span className="text-[10px] text-slate-400">Sağlık · Akademik · Devam · Risk</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {twin.grades.map(grade=><article key={grade.grade} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><strong className="text-base text-slate-900">{grade.grade}</strong><span className="mt-1 block text-[10px] text-slate-500">{grade.studentCount} öğrenci</span></div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${statusClass[grade.status]}`}>{statusLabel[grade.status]}</span>
              </div>
              <div className="mt-4 flex items-end justify-between"><strong className="text-4xl text-slate-900">{grade.healthScore}</strong><span className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Sağlık</span></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-blue-700">{grade.academicScore}</strong><span className="text-[8px] text-slate-400">Akademik</span></div>
                <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-emerald-700">{grade.attendanceScore}</strong><span className="text-[8px] text-slate-400">Devam</span></div>
                <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-rose-700">{grade.riskCount}</strong><span className="text-[8px] text-slate-400">Riskli</span></div>
              </div>
            </article>)}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-600"/><h2 className="text-sm font-black text-slate-900">İkiz Uyarıları ve İlk Eylem</h2></div>
          <div className="mt-4 divide-y divide-slate-100">
            {twin.alerts.map(alert=><article key={alert.id} className="py-4">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity==="critical"?"bg-rose-500":alert.severity==="warning"?"bg-amber-500":"bg-emerald-500"}`}/>
                <div><strong className="text-xs text-slate-900">{alert.title}</strong><p className="mt-1 text-[10px] leading-5 text-slate-500">{alert.detail}</p><p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-700">İlk adım: {alert.action}</p></div>
              </div>
            </article>)}
          </div>
          <button type="button" onClick={()=>onNavigate?.("hasat-ai-commander")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white"><ShieldCheck className="h-4 w-4"/>Yönetici Copilot’ta eyleme dönüştür</button>
        </section>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-slate-500"><Users className="h-4 w-4"/><span className="text-[9px] font-black uppercase">Öğrenci</span></div><strong className="mt-2 block text-2xl text-slate-900">{students.length}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-slate-500"><School className="h-4 w-4"/><span className="text-[9px] font-black uppercase">Sınıf</span></div><strong className="mt-2 block text-2xl text-slate-900">{classrooms.length}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-slate-500"><Activity className="h-4 w-4"/><span className="text-[9px] font-black uppercase">Canlı Olay</span></div><strong className="mt-2 block text-2xl text-slate-900">{events.length}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-slate-500"><Database className="h-4 w-4"/><span className="text-[9px] font-black uppercase">Veri Kapsama</span></div><strong className="mt-2 block text-2xl text-slate-900">%{twin.dataCoverage.percentage}</strong></div>
      </section>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[10px] leading-5 text-blue-900"><BarChart3 className="mr-2 inline h-4 w-4"/>Sağlık puanı karar desteği amacıyla üretilir. Veri güveni düşük göstergeler kesin sonuç olarak yorumlanmamalıdır; ilgili kayıtlar arttıkça model otomatik olarak güçlenir.</div>
    </section>
  </div>;
}
