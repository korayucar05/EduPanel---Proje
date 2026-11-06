import React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  Clock3,
  School,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  buildExecutiveCenter,
  runCopilotOptimizer,
  runSchoolDigitalTwin,
  type BrainCohortResult,
} from "../../intelligence-v2";

const alertTone={
  critical:"border-rose-200 bg-rose-50",
  warning:"border-amber-200 bg-amber-50",
  positive:"border-emerald-200 bg-emerald-50",
  info:"border-blue-200 bg-blue-50",
} as const;

const ownerLabel={
  management:"Yönetim",
  teacher:"Öğretmen",
  guidance:"Rehberlik",
  parent:"Veli",
} as const;

export function ExecutiveIntelligenceCenter({
  cohort,
}:{
  cohort:BrainCohortResult;
}){
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
      },
    }),
    [cohort],
  );

  const schoolTwin=React.useMemo(
    ()=>runSchoolDigitalTwin({
      cohort,
      optimizer,
      scenario:{
        weeklyExtraLessonMinutes:120,
        mockExamPerMonth:4,
        guidanceSessionsPerMonth:1,
        parentMeetingsPerMonth:1,
        attendanceReductionDays:1,
      },
    }),
    [cohort,optimizer],
  );

  const data=React.useMemo(
    ()=>buildExecutiveCenter({cohort,schoolTwin}),
    [cohort,schoolTwin],
  );
  const [isFormOpen,setIsFormOpen]=React.useState(false);

  return <section className="space-y-4">
    <button type="button" onClick={()=>setIsFormOpen(current=>!current)} aria-expanded={isFormOpen} className="w-full overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-emerald-800 p-6 text-left text-white shadow-xl transition hover:brightness-110">
      <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">e-Nstitü Executive Intelligence Center</span>
      <h2 className="mt-2 text-2xl font-black">Veriden Karara, Karardan Başarıya</h2>
      <p className="mt-2 max-w-4xl text-xs leading-6 text-white/80">{data.summary.detail}</p>
      <span className="mt-4 block text-[10px] font-black text-white/80">{isFormOpen?"Formu kapat":"Karar merkezini aç"}</span>
    </button>

    {isFormOpen&&<>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Okul Sağlık Skoru",data.schoolHealthScore,School],
        ["Brain Endeksi",data.brainIndex,Brain],
        ["Kritik Öğrenci",data.criticalStudentCount,AlertTriangle],
        ["Yüksek Öncelik",data.highPriorityCount,Users],
        ["Beklenen Net Artışı",`+${data.expectedTotalNetGain}`,TrendingUp],
        ["İlk Müdahale",data.leadingClassroom||"—",Target],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-emerald-600"/>
        <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-violet-700"/>
          <div>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Bugünün Akademik Gündemi</span>
            <h3 className="mt-1 text-sm font-black text-slate-900">{data.summary.headline}</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">{data.alerts.map(alert=><div key={alert.key} className={`rounded-2xl border p-4 ${alertTone[alert.level]}`}>
          <div className="flex items-start justify-between gap-3"><strong className="text-xs text-slate-900">{alert.title}</strong>{alert.metric&&<span className="rounded-full bg-white/60 px-2 py-1 text-[9px] font-black text-slate-700">{alert.metric}</span>}</div>
          <p className="mt-2 text-[10px] leading-5 text-slate-600">{alert.detail}</p>
          <div className="mt-3 flex gap-2 rounded-xl bg-white/55 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><span className="text-[10px] leading-5 text-slate-700">{alert.action}</span></div>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-blue-700"/><h3 className="text-sm font-black text-slate-900">Bugünün Görevleri</h3></div>
        <div className="mt-4 divide-y divide-slate-100">{data.tasks.slice(0,10).map(task=><div key={task.id} className="py-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-xs text-slate-900">{task.title}</strong><span className="mt-1 block text-[10px] text-slate-400">{ownerLabel[task.owner]} · {task.dueDays} gün içinde</span></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">P{task.priority}</span></div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">{task.detail}</p>
        </div>)}</div>
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-blue-700"/><h3 className="text-sm font-black text-slate-900">Canlı Akademik Radar</h3></div>
        <div className="mt-4 space-y-4">{data.classroomMap.slice(0,12).map(item=><div key={item.classroom}>
          <div className="flex items-center justify-between"><div><strong className="text-xs text-slate-800">{item.classroom}</strong><span className="ml-2 text-[9px] text-slate-400">{item.criticalCount} kritik · {item.highCount} yüksek</span></div><strong className="text-xs text-slate-900">{item.score}/100</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.level==="critical"?"bg-rose-500":item.level==="warning"?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${Math.min(100,item.score)}%`}}/></div>
        </div>)}</div>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h3 className="text-sm font-black text-emerald-900">e-Nstitü Öneriyor</h3></div>
        <p className="mt-3 text-[11px] leading-6 text-emerald-800">
          {data.leadingSubject?`${data.leadingSubject} zümresiyle ortak kazanım değerlendirmesi yapılması, `:""}
          {data.leadingClassroom?`${data.leadingClassroom} sınıfındaki öncelikli öğrencilere hedefli destek verilmesi `:""}
          beklenen akademik etkiyi artıracaktır.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/60 p-3"><span className="text-[9px] text-emerald-700">Beklenen Kazanç</span><strong className="mt-1 block text-lg text-emerald-900">+{data.expectedTotalNetGain}</strong></div>
          <div className="rounded-2xl bg-white/60 p-3"><span className="text-[9px] text-emerald-700">Öncelikli Sınıf</span><strong className="mt-1 block text-lg text-emerald-900">{data.leadingClassroom||"—"}</strong></div>
          <div className="rounded-2xl bg-white/60 p-3"><span className="text-[9px] text-emerald-700">Öncelikli Branş</span><strong className="mt-1 block text-lg text-emerald-900">{data.leadingSubject||"—"}</strong></div>
        </div>
      </div>
    </div>
    </>}
  </section>;
}
