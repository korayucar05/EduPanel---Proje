import React from "react";
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  School,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  buildCommandCenterAgenda,
  runCopilotOptimizer,
  runSchoolDigitalTwin,
  type BrainCohortResult,
  type SchoolScenario,
} from "../../intelligence-v2";

const defaultScenario:SchoolScenario={
  weeklyExtraLessonMinutes:120,
  mockExamPerMonth:4,
  guidanceSessionsPerMonth:1,
  parentMeetingsPerMonth:1,
  attendanceReductionDays:1,
};

export function SchoolDigitalTwinDashboard({
  cohort,
}:{
  cohort:BrainCohortResult;
}){
  const [scenario,setScenario]=React.useState<SchoolScenario>(defaultScenario);
  const classrooms=React.useMemo(
    ()=>[...new Set(cohort.ranking.map(item=>item.student.classroom).filter(Boolean))] as string[],
    [cohort],
  );

  const optimizer=React.useMemo(
    ()=>runCopilotOptimizer({
      cohort,
      config:{
        totalMinutes:360,
        minimumSessionMinutes:20,
        maximumSessionMinutes:60,
        sessionStepMinutes:10,
        resourceType:"teacher-support",
        includePriorityLevels:["critical","high","medium"],
        maximumStudents:24,
        classroomFilter:scenario.targetClassroom,
      },
    }),
    [cohort,scenario.targetClassroom],
  );

  const twin=React.useMemo(
    ()=>runSchoolDigitalTwin({cohort,scenario,optimizer}),
    [cohort,scenario,optimizer],
  );
  const agenda=React.useMemo(()=>buildCommandCenterAgenda(twin),[twin]);

  const update=<K extends keyof SchoolScenario>(
    key:K,
    value:SchoolScenario[K],
  )=>setScenario(current=>({...current,[key]:value}));

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-emerald-800 p-6 text-white shadow-lg">
      <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">e-Nstitü Command Center</span>
      <h2 className="mt-2 text-2xl font-black">Okul Dijital İkizi</h2>
      <p className="mt-2 max-w-4xl text-xs leading-6 text-white/80">{twin.executiveSummary.detail}</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Öğrenci",twin.totalStudents,Users],
        ["Brain Endeksi",twin.schoolBrainIndex,Activity],
        ["Ortalama Net",twin.averageNet,TrendingUp],
        ["Kritik",twin.criticalStudentCount,Target],
        ["Senaryo Neti",twin.scenarioImpact.predictedAverageNet,Sparkles],
        ["Beklenen Artış",`+${twin.scenarioImpact.netDifference}`,GraduationCap],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-emerald-600"/><span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span><strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong></div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Senaryo Ayarları</span><h3 className="mt-1 text-sm font-black text-slate-900">Okul Müdahale Simülasyonu</h3></div>

        {[
          ["Haftalık ek etüt",scenario.weeklyExtraLessonMinutes,0,600,30,"dk","weeklyExtraLessonMinutes"],
          ["Aylık deneme",scenario.mockExamPerMonth,0,12,1,"adet","mockExamPerMonth"],
          ["Aylık rehberlik",scenario.guidanceSessionsPerMonth,0,6,1,"görüşme","guidanceSessionsPerMonth"],
          ["Aylık veli görüşmesi",scenario.parentMeetingsPerMonth,0,6,1,"görüşme","parentMeetingsPerMonth"],
          ["Devamsızlık azaltma",scenario.attendanceReductionDays,0,10,1,"gün","attendanceReductionDays"],
        ].map(([label,value,min,max,step,suffix,key]:any)=><label key={key} className="block rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between text-[10px]"><strong className="text-slate-700">{label}</strong><span className="font-black text-emerald-700">{value} {suffix}</span></div><input className="mt-3 w-full accent-emerald-600" type="range" min={min} max={max} step={step} value={value} onChange={event=>update(key,Number(event.target.value) as any)}/></label>)}

        <label className="block">
          <span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Sınıf</span>
          <div className="relative mt-2"><select value={scenario.targetClassroom||""} onChange={event=>update("targetClassroom",event.target.value||undefined)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-black outline-none"><option value="">Tüm okul</option>{classrooms.map(item=><option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div>
        </label>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Bugünün Akademik Gündemi</span>
        <h3 className="mt-1 text-sm font-black text-slate-900">e-Nstitü Brain Öncelikleri</h3>
        <div className="mt-4 space-y-3">{agenda.map(item=><div key={item.rank} className={`rounded-2xl border p-4 ${item.level==="critical"?"border-rose-200 bg-rose-50":item.level==="warning"?"border-amber-200 bg-amber-50":item.level==="positive"?"border-emerald-200 bg-emerald-50":"border-blue-200 bg-blue-50"}`}>
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-xs font-black">{item.rank}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-slate-900">{item.title}</strong>{item.metric&&<span className="rounded-full bg-white/60 px-2 py-1 text-[9px] font-black text-slate-700">{item.metric}</span>}</div><p className="mt-2 text-[10px] leading-5 text-slate-600">{item.detail}</p><div className="mt-3 flex gap-2 rounded-xl bg-white/55 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><span className="text-[10px] leading-5 text-slate-700">{item.action}</span></div></div></div>
        </div>)}</div>
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><School className="h-5 w-5 text-blue-700"/><h3 className="text-sm font-black text-slate-900">Sınıf Akademik Haritası</h3></div>
        <div className="mt-4 space-y-4">{twin.classroomSummaries.slice(0,10).map(item=><div key={item.classroom}>
          <div className="flex items-center justify-between"><div><strong className="text-xs text-slate-800">{item.classroom}</strong><span className="ml-2 text-[9px] text-slate-400">{item.studentCount} öğrenci</span></div><strong className="text-xs text-slate-900">{item.averagePriorityScore}/100</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.averagePriorityScore>=65?"bg-rose-500":item.averagePriorityScore>=40?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.min(100,item.averagePriorityScore)}%`}}/></div>
          <div className="mt-1 text-[9px] text-slate-400">{item.criticalCount} kritik · {item.highCount} yüksek · beklenen +{item.expectedGain} net</div>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-violet-700"/><h3 className="text-sm font-black text-slate-900">Branş Etki Haritası</h3></div>
        <div className="mt-4 divide-y divide-slate-100">{twin.branchSummaries.slice(0,10).map(item=><div key={item.subject} className="flex items-center gap-3 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-xs font-black text-violet-700">{item.priorityStudentCount}</div><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{item.subject}</strong><span className="mt-1 block text-[10px] text-slate-400">Başarı %{item.averageSuccessRate} · +{item.expectedGain} net fırsatı</span></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.impactLevel==="high"?"bg-rose-50 text-rose-700":item.impactLevel==="medium"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>{item.impactLevel==="high"?"Yüksek":item.impactLevel==="medium"?"Orta":"Düşük"}</span></div>)}</div>
      </div>
    </div>

    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-center gap-3"><Bot className="h-5 w-5 text-emerald-700"/><h3 className="text-sm font-black text-emerald-900">e-Nstitü Yönetim Özeti</h3></div>
      <p className="mt-3 text-[11px] leading-6 text-emerald-800">{twin.executiveSummary.headline}. {twin.executiveSummary.detail}</p>
      <div className="mt-3 space-y-2">{twin.recommendations.map((item,index)=><p key={index} className="text-[10px] leading-5 text-emerald-900">• {item}</p>)}</div>
      <p className="mt-3 text-[9px] text-emerald-700">Tahmin güveni: %{twin.scenarioImpact.confidence}. Sonuçlar karar desteği amaçlıdır.</p>
    </div>
  </section>;
}
