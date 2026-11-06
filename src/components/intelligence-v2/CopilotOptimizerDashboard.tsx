import React from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  optimizerPresets,
  runCopilotOptimizer,
  type BrainCohortResult,
  type CopilotOptimizerConfig,
  type OptimizerResourceType,
} from "../../intelligence-v2";

const levelLabel={
  critical:"Kritik",
  high:"Yüksek",
  medium:"Orta",
  low:"Düşük",
} as const;

const resourceLabel:Record<OptimizerResourceType,string>={
  "extra-lesson":"Etüt / Ek Ders",
  "teacher-support":"Öğretmen Desteği",
  "guidance":"Rehberlik",
  "parent-meeting":"Veli Görüşmesi",
};

const defaultConfig:CopilotOptimizerConfig={
  totalMinutes:240,
  minimumSessionMinutes:20,
  maximumSessionMinutes:60,
  sessionStepMinutes:10,
  resourceType:"extra-lesson",
  includePriorityLevels:["critical","high","medium"],
  maximumStudents:20,
};

export function CopilotOptimizerDashboard({
  cohort,
}:{
  cohort:BrainCohortResult;
}){
  const [config,setConfig]=React.useState<CopilotOptimizerConfig>(defaultConfig);
  const [classroom,setClassroom]=React.useState("");

  const classrooms=React.useMemo(
    ()=>[...new Set(cohort.ranking.map(item=>item.student.classroom).filter(Boolean))] as string[],
    [cohort],
  );

  const resolved=React.useMemo(
    ()=>({...config,classroomFilter:classroom||undefined}),
    [config,classroom],
  );

  const result=React.useMemo(
    ()=>runCopilotOptimizer({cohort,config:resolved}),
    [cohort,resolved],
  );

  const applyPreset=(key:string)=>{
    const preset=optimizerPresets.find(item=>item.key===key);
    if(!preset)return;
    setConfig(current=>({...current,...preset.config}));
  };

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-violet-900 to-indigo-800 p-5 text-white shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Bot className="h-6 w-6"/>
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/70">e-Nstitü Copilot Optimizer</span>
          <h2 className="mt-1 text-xl font-black">Kaynağı en yüksek akademik etkiye dağıtın</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-white/80">Etüt, öğretmen desteği ve rehberlik süresini Brain Score, gelişim potansiyeli ve beklenen net kazancına göre planlar.</p>
        </div>
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      {optimizerPresets.map(preset=><button key={preset.key} type="button" onClick={()=>applyPreset(preset.key)} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700">{preset.label}</button>)}
    </div>

    <div className="grid gap-3 lg:grid-cols-4">
      <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Toplam Kaynak</span>
        <div className="mt-2 flex items-center gap-2"><Clock3 className="h-4 w-4 text-violet-600"/><input type="number" min={30} step={30} value={config.totalMinutes} onChange={event=>setConfig(current=>({...current,totalMinutes:Math.max(0,Number(event.target.value)||0)}))} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-black outline-none focus:border-violet-400"/><span className="text-[10px] text-slate-400">dk</span></div>
      </label>

      <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Kaynak Türü</span>
        <div className="relative mt-2"><select value={config.resourceType} onChange={event=>setConfig(current=>({...current,resourceType:event.target.value as OptimizerResourceType}))} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-black outline-none focus:border-violet-400">{Object.entries(resourceLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div>
      </label>

      <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Sınıf Filtresi</span>
        <div className="relative mt-2"><select value={classroom} onChange={event=>setClassroom(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-black outline-none focus:border-violet-400"><option value="">Tüm sınıflar</option>{classrooms.map(item=><option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div>
      </label>

      <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">En Fazla Öğrenci</span>
        <div className="mt-2 flex items-center gap-2"><Users className="h-4 w-4 text-violet-600"/><input type="number" min={1} max={100} value={config.maximumStudents||20} onChange={event=>setConfig(current=>({...current,maximumStudents:Math.max(1,Number(event.target.value)||1)}))} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-black outline-none focus:border-violet-400"/></div>
      </label>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ["Kaynak",`${result.totalAvailableMinutes} dk`,Clock3],
        ["Dağıtılan",`${result.allocatedMinutes} dk`,GraduationCap],
        ["Öğrenci",result.selectedStudentCount,Users],
        ["Beklenen Kazanç",`+${result.expectedTotalNetGain} net`,TrendingUp],
        ["Verimlilik",`${result.averageEfficiency} net/saat`,Target],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-violet-600"/><span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span><strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong></div>)}
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Optimum Dağıtım</span><h3 className="mt-1 text-sm font-black text-slate-900">Öğrenci Kaynak Planı</h3></div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-[9px] font-black text-violet-700">{resourceLabel[config.resourceType]}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400"><th className="px-3 py-3">#</th><th className="px-3 py-3">Öğrenci</th><th className="px-3 py-3">Sınıf</th><th className="px-3 py-3">Öncelik</th><th className="px-3 py-3">Süre</th><th className="px-3 py-3">Beklenen Kazanç</th><th className="px-3 py-3">Verim</th><th className="px-3 py-3">Gerekçe</th></tr></thead>
          <tbody>{result.allocations.map(item=><tr key={item.studentId} className="border-b border-slate-100 text-[10px] text-slate-600"><td className="px-3 py-3 font-black text-slate-900">{item.rank}</td><td className="px-3 py-3"><strong className="block text-xs text-slate-900">{item.studentName}</strong><span className="text-[9px] text-slate-400">{item.studentNumber||""}</span></td><td className="px-3 py-3 font-bold">{item.classroom||"—"}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{levelLabel[item.priorityLevel]}</span></td><td className="px-3 py-3 font-black text-violet-700">{item.allocatedMinutes} dk</td><td className="px-3 py-3 font-black text-emerald-700">+{item.expectedAllocatedGain.toFixed(2)} net</td><td className="px-3 py-3">{item.efficiency.toFixed(2)} net/saat</td><td className="max-w-[280px] px-3 py-3"><span className="line-clamp-2">{item.primaryReason}</span></td></tr>)}</tbody>
        </table>
      </div>
      {!result.allocations.length&&<div className="py-10 text-center text-xs text-slate-400">Seçili koşullara uygun öğrenci bulunamadı.</div>}
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-700"/><h3 className="text-sm font-black text-emerald-900">e-Nstitü Copilot Özeti</h3></div>
        <p className="mt-3 text-[11px] leading-6 text-emerald-800">{result.summary}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Uygulama Adımları</span>
        <div className="mt-3 space-y-2">{result.recommendations.map((item,index)=><div key={index} className="flex gap-2 rounded-2xl bg-slate-50 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><span className="text-[10px] leading-5 text-slate-600">{item}</span></div>)}</div>
      </div>
    </div>
  </section>;
}
