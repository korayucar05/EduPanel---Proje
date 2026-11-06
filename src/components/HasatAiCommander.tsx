import React from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Command,
  Cpu,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  askHasatDecisionCenter,
  autonomousStore,
  buildAutonomousSnapshot,
  buildCommanderBriefing,
  buildHasatLiveSnapshot,
  buildWorkflowSummary,
  hasatLiveEventBus,
  runPredictiveAi,
  workflowStore,
} from "../intelligence-v3";

const priorityTone={
  critical:"border-rose-200 bg-rose-50 text-rose-800",
  high:"border-orange-200 bg-orange-50 text-orange-800",
  medium:"border-amber-200 bg-amber-50 text-amber-800",
  low:"border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

const ownerLabel={
  management:"Yönetim",
  teacher:"Öğretmen",
  guidance:"Rehberlik",
  parent:"Veli",
} as const;

const greeting=()=>{
  const hour=new Date().getHours();
  if(hour<12)return"Günaydın";
  if(hour<18)return"İyi günler";
  return"İyi akşamlar";
};

export default function HasatAiCommander({
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
  const [version,setVersion]=React.useState(0);
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());

  React.useEffect(()=>{
    const update=()=>setVersion(value=>value+1);
    const unsubscribe=hasatLiveEventBus.subscribe(()=>{
      setEvents(hasatLiveEventBus.snapshot());
      update();
    });
    window.addEventListener("hasat-autonomous-updated",update);
    window.addEventListener("hasat-workflow-updated",update);
    return()=>{
      unsubscribe();
      window.removeEventListener("hasat-autonomous-updated",update);
      window.removeEventListener("hasat-workflow-updated",update);
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

  const autonomous=React.useMemo(()=>buildAutonomousSnapshot(),[version]);
  const workflow=React.useMemo(()=>buildWorkflowSummary(),[version]);
  const predictive=React.useMemo(
    ()=>runPredictiveAi({
      events:live.recentEvents,
      interventionMemory:autonomous.interventionMemory,
      currentSchoolHealth:live.schoolHealthScore,
      forecastDays:14,
    }),
    [live,autonomous],
  );

  const decision=React.useMemo(
    ()=>askHasatDecisionCenter({
      query:"Bugün okulda en önemli konu nedir?",
      context:{
        snapshot:live,
        events:live.recentEvents,
        studentCount:students.length,
        teacherCount:teachers.length,
        classroomCount:classrooms.length,
      },
    }),
    [live,students.length,teachers.length,classrooms.length],
  );

  const data=React.useMemo(
    ()=>buildCommanderBriefing({
      live,
      predictive,
      autonomous,
      workflow,
      events:live.recentEvents,
      decision,
    }),
    [live,predictive,autonomous,workflow,decision],
  );

  const importOrder=(orderId:string)=>{
    const order=data.orders.find(item=>item.id===orderId);
    if(!order)return;
    workflowStore.upsert({
      id:`workflow-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      title:order.title,
      detail:order.detail,
      ownerType:order.owner,
      priority:order.priority==="critical"?5:order.priority==="high"?4:3,
      status:"planned",
      plannedAt:new Date().toISOString(),
      dueAt:new Date(Date.now()+order.dueHours*3_600_000).toISOString(),
      expectedGain:order.expectedGain,
      sourceEventIds:order.sourceIds,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    });
  };

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1650px] space-y-4">
      <div className={`overflow-hidden rounded-[36px] p-7 text-white shadow-xl ${
        data.schoolStatus==="critical"
          ?"bg-gradient-to-r from-black via-red-950 to-rose-900"
          :data.schoolStatus==="attention"
            ?"bg-gradient-to-r from-black via-orange-950 to-amber-900"
            :"bg-gradient-to-r from-black via-slate-950 to-blue-950"
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Command className="h-7 w-7"/>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">e-Nstitü Yönetici Copilot 2.0</span>
              <h1 className="mt-2 text-3xl font-black">{greeting()}, Koray Hocam</h1>
              <p className="mt-2 text-base font-black text-white/90">{data.title}</p>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">{data.summary}</p>
            </div>
          </div>
          <button type="button" onClick={()=>onNavigate?.("hasat-workflow")} className="flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700">
            <Target className="h-4 w-4"/>Eylem İş Akışı
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        {[
          ["Okul Sağlık",data.metrics.schoolHealth,ShieldAlert],
          ["Tahmini Sağlık",data.metrics.predictedSchoolHealth,TrendingUp],
          ["Kritik Olay",data.metrics.criticalEvents,AlertTriangle],
          ["Tahmini Kritik",data.metrics.projectedCriticalStudents,Bot],
          ["Aktif Görev",data.metrics.activeTasks,Cpu],
          ["Geciken",data.metrics.overdueTasks,Clock3],
          ["Tamamlanan",data.metrics.completedInterventions,CheckCircle2],
          ["Etkinlik",`%${data.metrics.averageEffectiveness}`,Sparkles],
        ].map(([label,value,Icon]:any)=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Icon className="h-5 w-5 text-rose-600"/>
          <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
          <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
        </div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {[
          ["now","Hemen Ele Alınacaklar","İlk 8 saat"],
          ["today","Bugün Tamamlanacaklar","24 saat içinde"],
          ["week","Bu Haftanın Takibi","Planlı izleme"],
        ].map(([window,title,subtitle])=>{
          const items=data.agenda
            .filter(item=>item.window===window)
            .map(item=>data.orders.find(order=>order.id===item.orderId))
            .filter(Boolean)
            .slice(0,4);
          return <div key={window} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">{subtitle}</span>
            <h2 className="mt-1 text-sm font-black text-slate-900">{title}</h2>
            <div className="mt-4 space-y-2">{items.length?items.map((item:any)=><div key={item.id} className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2"><strong className="text-[10px] leading-5 text-slate-800">{item.title}</strong><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[8px] font-black text-slate-500">{ownerLabel[item.owner]}</span></div>
              <p className="mt-1 text-[9px] leading-4 text-slate-500">{item.action}</p>
            </div>):<p className="py-5 text-center text-[10px] text-slate-400">Bu zaman aralığında görev yok.</p>}</div>
          </div>;
        })}
      </div>

      {data.quickWins.length>0&&<div className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-emerald-950">Bugünün Hızlı Kazanımları</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{data.quickWins.map((item,index)=><div key={`${item.title}-${index}`} className="rounded-2xl bg-white/70 p-4">
          <strong className="text-xs text-emerald-950">{item.title}</strong>
          <p className="mt-2 text-[10px] leading-5 text-emerald-900">{item.detail}</p>
          <span className="mt-3 block text-[9px] font-black text-emerald-700">{item.expectedGain}</span>
        </div>)}</div>
      </div>}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Command className="h-5 w-5 text-rose-700"/><h2 className="text-sm font-black text-slate-900">Yönetsel Eylem Planı</h2></div>
          <div className="mt-4 space-y-3">
            {data.orders.map((order,index)=><div key={order.id} className={`rounded-2xl border p-4 ${priorityTone[order.priority]}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-xs font-black">{index+1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><strong className="block text-xs">{order.title}</strong><span className="mt-1 block text-[9px] opacity-65">{ownerLabel[order.owner]} · {order.dueHours} saat içinde</span></div>
                    <span className="rounded-full bg-white/60 px-2 py-1 text-[9px] font-black">{order.score.toFixed(0)}</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 opacity-80">{order.detail}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 gap-2 rounded-xl bg-white/55 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>
                      <span className="text-[10px] leading-5">{order.action}</span>
                    </div>
                    <button type="button" onClick={()=>importOrder(order.id)} className="rounded-xl bg-black px-3 py-2.5 text-[9px] font-black text-white">
                      <Play className="mr-1 inline h-3.5 w-3.5"/>İş Akışına Al
                    </button>
                  </div>
                </div>
              </div>
            </div>)}
            {!data.orders.length&&<p className="py-10 text-center text-xs text-slate-400">Bugün için ek yönetsel işlem gerektiren durum bulunmuyor.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Bot className="h-5 w-5 text-violet-700"/><h2 className="text-sm font-black text-slate-900">AI Dayanakları</h2></div>
            <div className="mt-4 space-y-2">{data.evidence.map((item,index)=><div key={index} className="rounded-2xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">{item}</div>)}</div>
          </div>

          <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-emerald-950">Günün Yönetici Özeti</h2></div>
            <p className="mt-3 text-[11px] leading-6 text-emerald-900">{data.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={()=>onNavigate?.("hasat-predictive-ai")} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white">Öngörücü Yapay Zekâ</button>
              <button type="button" onClick={()=>onNavigate?.("hasat-autonomous")} className="rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white">Otonom Yapay Zekâ</button>
              <button type="button" onClick={()=>onNavigate?.("hasat-intervention-insights")} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-black text-white">Müdahale Hafızası</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
