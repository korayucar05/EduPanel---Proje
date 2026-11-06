import React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock3,
  Cpu,
  RadioTower,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  buildAutonomousSnapshot,
  buildHasatLiveSnapshot,
  buildMissionControlSnapshot,
  hasatLiveEventBus,
} from "../intelligence-v3";

const toneClass={
  blue:"border-blue-200 bg-blue-50 text-blue-800",
  emerald:"border-emerald-200 bg-emerald-50 text-emerald-800",
  amber:"border-amber-200 bg-amber-50 text-amber-800",
  rose:"border-rose-200 bg-rose-50 text-rose-800",
  violet:"border-violet-200 bg-violet-50 text-violet-800",
  slate:"border-slate-200 bg-slate-50 text-slate-800",
} as const;

const ownerLabel={
  management:"Yönetim",
  teacher:"Öğretmen",
  guidance:"Rehberlik",
  parent:"Veli",
} as const;

export default function HasatMissionControl({
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

  const autonomous=React.useMemo(()=>buildAutonomousSnapshot(),[version]);

  const data=React.useMemo(
    ()=>buildMissionControlSnapshot({
      live,
      autonomous,
      events:live.recentEvents,
      studentCount:students.length,
      teacherCount:teachers.length,
      classroomCount:classrooms.length,
    }),
    [live,autonomous,students.length,teachers.length,classrooms.length],
  );

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1650px] space-y-4">
      <div className={`overflow-hidden rounded-[36px] p-7 text-white shadow-xl ${
        data.status==="critical"
          ?"bg-gradient-to-r from-black via-rose-950 to-red-900"
          :data.status==="attention"
            ?"bg-gradient-to-r from-black via-amber-950 to-orange-900"
            :"bg-gradient-to-r from-black via-slate-950 to-emerald-950"
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">e-Nstitü Mission Control</span>
            <h1 className="mt-2 text-3xl font-black">{data.headline}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">{data.detail}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-right backdrop-blur">
            <span className="block text-[9px] uppercase tracking-[.15em] text-white/60">Son Güncelleme</span>
            <strong className="mt-1 block text-sm">{new Date(data.generatedAt).toLocaleString("tr-TR")}</strong>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {data.cards.map(card=><div key={card.key} className={`rounded-3xl border p-5 shadow-sm ${toneClass[card.tone]}`}>
          <span className="block text-[9px] font-black uppercase tracking-[.12em] opacity-65">{card.label}</span>
          <strong className="mt-2 block text-3xl font-black">{card.value}</strong>
          <span className="mt-2 block text-[10px] opacity-70">{card.detail}</span>
        </div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Bot className="h-6 w-6"/>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Günün AI Brifingi</span>
              <h2 className="mt-1 text-xl font-black text-slate-900">{data.dailyBriefing.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{data.dailyBriefing.answer}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={()=>onNavigate?.("hasat-decision")} className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white"><Bot className="h-4 w-4"/>Yapay Zekâ Karar Merkezi</button>
            <button type="button" onClick={()=>onNavigate?.("hasat-live")} className="flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white"><RadioTower className="h-4 w-4"/>e-Nstitü Canlı</button>
            <button type="button" onClick={()=>onNavigate?.("hasat-autonomous")} className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white"><Cpu className="h-4 w-4"/>Otonom Yapay Zekâ</button>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Target className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-slate-900">Bugünün Öncelikleri</h2></div>
          <div className="mt-4 divide-y divide-slate-100">
            {data.topTasks.length?data.topTasks.map((task,index)=><div key={task.id} className="py-3">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${task.priority===5?"bg-rose-50 text-rose-700":task.priority===4?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700"}`}>{index+1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="text-xs text-slate-900">{task.title}</strong>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{ownerLabel[task.owner as keyof typeof ownerLabel]||task.owner}</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">{task.detail}</p>
                </div>
              </div>
            </div>):<p className="py-8 text-center text-xs text-slate-400">Aktif görev bulunmuyor.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Activity className="h-5 w-5 text-blue-700"/><h2 className="text-sm font-black text-slate-900">Canlı Okul Nabzı</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.live.pulse.map(item=><div key={item.key} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                <span className={`text-[10px] font-black ${item.change>0?"text-emerald-600":item.change<0?"text-rose-600":"text-slate-400"}`}>{item.change>0?"+":""}{item.change}</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <strong className="text-2xl text-slate-900">{item.value}</strong>
                {item.direction==="up"?<TrendingUp className="h-5 w-5 text-emerald-600"/>:item.direction==="down"?<AlertTriangle className="h-5 w-5 text-rose-600"/>:<Activity className="h-5 w-5 text-slate-400"/>}
              </div>
            </div>)}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-indigo-700"/><h2 className="text-sm font-black text-slate-900">Son Gelişmeler</h2></div>
          <div className="mt-4 divide-y divide-slate-100">
            {data.topEvents.length?data.topEvents.map(event=><div key={event.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-xs text-slate-900">{event.title}</strong>
                  <p className="mt-1 text-[10px] leading-5 text-slate-500">{event.detail}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black ${event.level==="critical"?"bg-rose-50 text-rose-700":event.level==="warning"?"bg-amber-50 text-amber-700":event.level==="positive"?"bg-emerald-50 text-emerald-700":"bg-blue-50 text-blue-700"}`}>{event.source}</span>
              </div>
            </div>):<p className="py-8 text-center text-xs text-slate-400">Henüz canlı olay kaydı yok.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h2 className="text-sm font-black text-emerald-950">e-Nstitü Yönetim Özeti</h2></div>
        <p className="mt-3 text-[11px] leading-6 text-emerald-900">{data.dailyBriefing.answer}</p>
      </div>
    </section>
  </div>;
}
