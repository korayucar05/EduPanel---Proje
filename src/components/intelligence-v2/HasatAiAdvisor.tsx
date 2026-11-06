import React from "react";
import {
  CheckCircle2,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  askHasatAdvisor,
  defaultAdvisorSuggestions,
  type AdvisorAudience,
  type AdvisorSourceBundle,
} from "../../intelligence-v2";

export function HasatAiAdvisor({
  audience,
  sources,
}:{
  audience:AdvisorAudience;
  sources:AdvisorSourceBundle;
}){
  const [query,setQuery]=React.useState("");
  const [submitted,setSubmitted]=React.useState("");

  const answer=React.useMemo(
    ()=>submitted?askHasatAdvisor({query:submitted,audience,sources}):null,
    [submitted,audience,sources],
  );

  const ask=(value=query)=>{
    const clean=value.trim();
    if(!clean)return;
    setQuery(clean);
    setSubmitted(clean);
  };

  return <section className="space-y-4">
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
          <input
            value={query}
            onChange={event=>setQuery(event.target.value)}
            onKeyDown={event=>{if(event.key==="Enter")ask();}}
            placeholder="Örneğin: En riskli sınıf hangisi?"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-semibold outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>
        <button
          type="button"
          onClick={()=>ask()}
          className="flex h-12 items-center gap-2 rounded-2xl bg-violet-700 px-4 text-xs font-black text-white hover:bg-violet-800"
        >
          <Send className="h-4 w-4"/>Sor
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {defaultAdvisorSuggestions[audience].map(item=><button
          key={item.query}
          type="button"
          onClick={()=>ask(item.query)}
          className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700"
        >
          {item.label}
        </button>)}
      </div>
    </div>

    {answer&&<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <Sparkles className="h-5 w-5"/>
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">e-Nstitü Yanıtı</span>
          <h3 className="mt-1 text-base font-black text-slate-900">{answer.title}</h3>
          <p className="mt-3 text-xs leading-6 text-slate-600">{answer.answer}</p>
        </div>
      </div>

      {answer.evidence.length>0&&<div className="mt-5">
        <span className="text-[9px] font-black uppercase tracking-[.13em] text-slate-400">Dayanaklar</span>
        <div className="mt-2 space-y-2">{answer.evidence.map((item,index)=><div key={index} className="rounded-2xl bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-600">{item}</div>)}</div>
      </div>}

      {answer.actions.length>0&&<div className="mt-5">
        <span className="text-[9px] font-black uppercase tracking-[.13em] text-emerald-600">Önerilen İşlemler</span>
        <div className="mt-2 space-y-2">{answer.actions.map((item,index)=><div key={index} className="flex gap-2 rounded-2xl bg-emerald-50 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><span className="text-[10px] leading-5 text-emerald-800">{item}</span></div>)}</div>
      </div>}

      <div className="mt-4 text-right text-[9px] text-slate-400">Yanıt güveni: %{answer.confidence}</div>
    </div>}
  </section>;
}
