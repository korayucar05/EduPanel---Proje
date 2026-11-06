import React from "react";
import {
  Bot,
  CheckCircle2,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  askHasatDecisionCenter,
  buildHasatLiveSnapshot,
  hasatLiveEventBus,
} from "../intelligence-v3";

const suggestions=[
  "Bugün okulda en önemli konu nedir?",
  "Önce hangi görevi yapmalıyım?",
  "Okulun genel durumu nasıl?",
  "Devamsızlıkta dikkat edilmesi gereken ne var?",
  "Ödev durumunu özetle.",
  "Rehberlik için öncelik nedir?",
];

export default function HasatAiDecisionCenter({
  students,
  teachers,
  classrooms,
}:{
  students:any[];
  teachers:any[];
  classrooms:any[];
}){
  const [events,setEvents]=React.useState(()=>hasatLiveEventBus.snapshot());
  const [query,setQuery]=React.useState("");
  const [submitted,setSubmitted]=React.useState("Bugün okulda en önemli konu nedir?");

  React.useEffect(()=>{
    const unsubscribe=hasatLiveEventBus.subscribe(()=>setEvents(hasatLiveEventBus.snapshot()));
    return unsubscribe;
  },[]);

  const snapshot=React.useMemo(
    ()=>buildHasatLiveSnapshot({
      events,
      studentCount:students.length,
      teacherCount:teachers.length,
      classroomCount:classrooms.length,
    }),
    [events,students.length,teachers.length,classrooms.length],
  );

  const answer=React.useMemo(
    ()=>askHasatDecisionCenter({
      query:submitted,
      context:{
        snapshot,
        events:snapshot.recentEvents,
        studentCount:students.length,
        teacherCount:teachers.length,
        classroomCount:classrooms.length,
      },
    }),
    [submitted,snapshot,students.length,teachers.length,classrooms.length],
  );

  const ask=(value=query)=>{
    const clean=value.trim();
    if(!clean)return;
    setQuery(clean);
    setSubmitted(clean);
  };

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1450px] space-y-4">
      <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-black via-slate-950 to-violet-950 p-7 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Bot className="h-7 w-7"/>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü Yapay Zekâ Karar Merkezi</span>
            <h1 className="mt-2 text-3xl font-black">Doğal Dille Okul Yönetimi</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">Canlı okul olaylarını, okul nabzını ve görev listesini tek yanıt içinde yorumlar.</p>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/>
            <input
              value={query}
              onChange={event=>setQuery(event.target.value)}
              onKeyDown={event=>{if(event.key==="Enter")ask();}}
              placeholder="Okulunuzla ilgili sorunuzu yazın..."
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none focus:border-violet-400 focus:bg-white"
            />
          </div>
          <button type="button" onClick={()=>ask()} className="flex h-14 items-center gap-2 rounded-2xl bg-violet-700 px-6 text-sm font-black text-white hover:bg-violet-800">
            <Send className="h-4 w-4"/>Sor
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map(item=><button key={item} type="button" onClick={()=>ask(item)} className="rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-700">{item}</button>)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Sparkles className="h-6 w-6"/>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">e-Nstitü Yanıtı</span>
              <h2 className="mt-1 text-xl font-black text-slate-900">{answer.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{answer.answer}</p>
            </div>
          </div>

          {answer.evidence.length>0&&<div className="mt-6">
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Dayanaklar</span>
            <div className="mt-3 space-y-2">{answer.evidence.map((item,index)=><div key={index} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"/><span className="text-[11px] leading-5 text-slate-600">{item}</span></div>)}</div>
          </div>}

          <div className="mt-5 text-right text-[10px] text-slate-400">Yanıt güveni: %{answer.confidence}</div>
        </div>

        <div className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6">
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">Uygulanabilir Adımlar</span>
          <h2 className="mt-1 text-lg font-black text-emerald-950">Şimdi ne yapılmalı?</h2>
          <div className="mt-4 space-y-3">
            {answer.actions.length?answer.actions.map((item,index)=><div key={index} className="flex gap-3 rounded-2xl bg-white/65 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><span className="text-[11px] leading-6 text-emerald-900">{item}</span></div>):<p className="rounded-2xl bg-white/60 p-5 text-xs text-emerald-800">Acil işlem önerisi bulunmuyor.</p>}
          </div>
        </div>
      </div>
    </section>
  </div>;
}
