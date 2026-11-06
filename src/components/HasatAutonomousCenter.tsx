import React from "react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  autonomousStore,
  buildAutonomousSnapshot,
  buildHasatLiveSnapshot,
  hasatLiveEventBus,
  runAllAutonomousAgents,
} from "../intelligence-v3";

const agentLabel={
  morning:"Sabah Agent",
  day:"Gün İçi Agent",
  evening:"Akşam Agent",
  academic:"Academic Agent",
  guidance:"Guidance Agent",
  parent:"Parent Agent",
  university:"University Agent",
  executive:"Executive Agent",
} as const;

const ownerLabel={
  management:"Yönetim",
  teacher:"Öğretmen",
  guidance:"Rehberlik",
  parent:"Veli",
} as const;

export default function HasatAutonomousCenter({
  students,
  teachers,
  classrooms,
}:{
  students:any[];
  teachers:any[];
  classrooms:any[];
}){
  const [version,setVersion]=React.useState(0);
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());

  React.useEffect(()=>{
    const update=()=>setVersion(value=>value+1);
    const unsubscribe=hasatLiveEventBus.subscribe(()=>{
      setEvents(hasatLiveEventBus.snapshot());
      update();
    });
    window.addEventListener("hasat-autonomous-updated",update);
    return()=>{
      unsubscribe();
      window.removeEventListener("hasat-autonomous-updated",update);
    };
  },[]);

  const live=React.useMemo(
    ()=>buildHasatLiveSnapshot({
      events,
      studentCount:students.length,
      teacherCount:teachers.length,
      classroomCount:classrooms.length,
    }),
    [events,students.length,teachers.length,classrooms.length],
  );

  const snapshot=React.useMemo(()=>buildAutonomousSnapshot(),[version]);

  const runAgents=()=>{
    runAllAutonomousAgents({
      live,
      events:live.recentEvents,
      studentCount:students.length,
      teacherCount:teachers.length,
      classroomCount:classrooms.length,
    });
    setVersion(value=>value+1);
  };

  const updateTask=(id:string,status:"active"|"completed"|"cancelled")=>{
    const task=autonomousStore.tasks().find(item=>item.id===id);
    if(!task)return;
    autonomousStore.upsertTask({...task,status});
  };

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1600px] space-y-4">
      <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-black via-slate-950 to-blue-950 p-7 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Cpu className="h-7 w-7"/>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü Otonom Yapay Zekâ 1.0</span>
              <h1 className="mt-2 text-3xl font-black">Otonom Okul Yönetim Ajanları</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">Canlı okul olaylarını analiz eder, görev üretir ve müdahale sonuçlarını kurumsal hafızada tutar.</p>
            </div>
          </div>
          <button type="button" onClick={runAgents} className="flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700">
            <Play className="h-4 w-4"/>Ajanları Çalıştır
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Aktif Ajan",snapshot.activeAgentCount,Bot],
          ["Planlanan Görev",snapshot.plannedTaskCount,Target],
          ["Tamamlanan",snapshot.completedTaskCount,CheckCircle2],
          ["Müdahale Hafızası",snapshot.interventionMemory.length,TrendingUp],
          ["Canlı Olay",live.recentEvents.length,Sparkles],
        ].map(([label,value,Icon]:any)=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Icon className="h-5 w-5 text-blue-600"/>
          <span className="mt-4 block text-[10px] font-bold text-slate-400">{label}</span>
          <strong className="mt-1 block text-3xl font-black text-slate-900">{value}</strong>
        </div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Ajan Durumları</h2>
            <div className="mt-4 divide-y divide-slate-100">{snapshot.agentStates.map(item=><div key={item.agent} className="flex items-center gap-3 py-3">
              <div className={`h-3 w-3 rounded-full ${item.status==="completed"?"bg-emerald-500":item.status==="running"?"animate-pulse bg-blue-500":item.status==="error"?"bg-rose-500":"bg-slate-300"}`}/>
              <div className="min-w-0 flex-1"><strong className="block text-xs text-slate-900">{agentLabel[item.agent]}</strong><span className="mt-1 block text-[9px] text-slate-400">{item.lastRunAt?new Date(item.lastRunAt).toLocaleString("tr-TR"):"Henüz çalışmadı"}</span></div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{item.taskCount} görev</span>
            </div>)}</div>
          </div>

          <div className="rounded-[30px] border border-indigo-200 bg-indigo-50 p-5">
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-indigo-700">Sabah Brifingi</span>
            <p className="mt-3 text-[11px] leading-6 text-indigo-900">{snapshot.morningBriefing}</p>
          </div>

          <div className="rounded-[30px] border border-violet-200 bg-violet-50 p-5">
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-700">Akşam Özeti</span>
            <p className="mt-3 text-[11px] leading-6 text-violet-900">{snapshot.eveningSummary}</p>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Otonom Ajanda</span><h2 className="mt-1 text-sm font-black text-slate-900">Üretilen Görevler</h2></div>
            <button type="button" onClick={()=>autonomousStore.clear()} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600"><RotateCcw className="h-4 w-4"/>Temizle</button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {snapshot.tasks.length?snapshot.tasks.map(task=><div key={task.id} className="py-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${task.priority===5?"bg-rose-50 text-rose-700":task.priority===4?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700"}`}>P{task.priority}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="block text-xs text-slate-900">{task.title}</strong><span className="mt-1 block text-[9px] text-slate-400">{agentLabel[task.agent]} · {ownerLabel[task.owner]}</span></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{task.status}</span></div>
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">{task.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.status==="planned"&&<button type="button" onClick={()=>updateTask(task.id,"active")} className="rounded-lg bg-blue-50 px-3 py-1.5 text-[9px] font-black text-blue-700">Başlat</button>}
                    {(task.status==="planned"||task.status==="active")&&<button type="button" onClick={()=>updateTask(task.id,"completed")} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">Tamamla</button>}
                    {(task.status==="planned"||task.status==="active")&&<button type="button" onClick={()=>updateTask(task.id,"cancelled")} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[9px] font-black text-rose-700">İptal</button>}
                  </div>
                </div>
              </div>
            </div>):<p className="py-10 text-center text-xs text-slate-400">Henüz otonom görev oluşturulmadı.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-indigo-700"/><h2 className="text-sm font-black text-slate-900">Ajan Çalışma Geçmişi</h2></div>
        <div className="mt-4 divide-y divide-slate-100">{snapshot.runs.slice(0,20).map(run=><div key={run.id} className="py-3">
          <div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-slate-900">{agentLabel[run.agent]}</strong><p className="mt-1 text-[10px] leading-5 text-slate-500">{run.summary}</p></div><span className="text-[9px] text-slate-400">{new Date(run.startedAt).toLocaleString("tr-TR")}</span></div>
        </div>)}</div>
      </div>
    </section>
  </div>;
}
