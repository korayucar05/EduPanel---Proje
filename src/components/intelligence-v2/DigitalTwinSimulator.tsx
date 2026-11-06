import React from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  GraduationCap,
  MessageCircle,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type {AcademicDigitalProfile} from "../../intelligence-v2";
import {
  defaultInterventionScenario,
  runDigitalTwinSimulation,
  type InterventionScenario,
} from "../../intelligence-v2";

const Slider=({
  label,
  value,
  min,
  max,
  step,
  suffix,
  icon:Icon,
  onChange,
}:{
  label:string;
  value:number;
  min:number;
  max:number;
  step:number;
  suffix:string;
  icon:React.ElementType;
  onChange:(value:number)=>void;
})=><div className="rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon className="h-4 w-4"/>
      </span>
      <div>
        <strong className="block text-xs text-slate-900">{label}</strong>
        <span className="text-[9px] text-slate-400">Senaryo değeri</span>
      </div>
    </div>
    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-700">
      {value} {suffix}
    </span>
  </div>
  <input
    className="mt-4 w-full accent-emerald-600"
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={event=>onChange(Number(event.target.value))}
  />
</div>;

export function DigitalTwinSimulator({
  profile,
  examDate,
}:{
  profile:AcademicDigitalProfile;
  examDate?:string;
}){
  const [scenario,setScenario]=React.useState<InterventionScenario>(
    defaultInterventionScenario,
  );

  const result=React.useMemo(
    ()=>runDigitalTwinSimulation({profile,examDate,scenario}),
    [profile,examDate,scenario],
  );

  const update=<K extends keyof InterventionScenario>(
    key:K,
    value:InterventionScenario[K],
  )=>setScenario(current=>({...current,[key]:value}));

  const positive=result.netDifference>0;

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#082f58] via-[#0f4c6d] to-[#13a66d] p-5 text-white shadow-lg">
      <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/70">
        e-Nstitü Digital Twin
      </span>
      <h2 className="mt-2 text-xl font-black">Dijital İkiz & Müdahale Simülatörü</h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-white/85">
        Müdahale seçeneklerini değiştirerek öğrencinin sınav günü tahminindeki beklenen etkiyi görün.
      </p>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.13em] text-slate-400">Temel Tahmin</span>
        <strong className="mt-2 block text-3xl font-black text-slate-900">{result.baseline.predictedNet.toFixed(1)}</strong>
        <span className="text-[10px] text-slate-400">net</span>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <span className="text-[9px] font-black uppercase tracking-[.13em] text-emerald-600">Senaryo Tahmini</span>
        <strong className="mt-2 block text-3xl font-black text-emerald-800">{result.scenario.predictedNet.toFixed(1)}</strong>
        <span className="text-[10px] text-emerald-600">net</span>
      </div>
      <div className={`rounded-2xl border p-4 shadow-sm ${positive?"border-blue-200 bg-blue-50":"border-rose-200 bg-rose-50"}`}>
        <span className={`text-[9px] font-black uppercase tracking-[.13em] ${positive?"text-blue-600":"text-rose-600"}`}>Beklenen Fark</span>
        <div className="mt-2 flex items-center gap-2">
          {positive?<TrendingUp className="h-6 w-6 text-blue-600"/>:<TrendingDown className="h-6 w-6 text-rose-600"/>}
          <strong className={`text-3xl font-black ${positive?"text-blue-800":"text-rose-800"}`}>
            {result.netDifference>=0?"+":""}{result.netDifference.toFixed(1)}
          </strong>
        </div>
        <span className={`text-[10px] ${positive?"text-blue-600":"text-rose-600"}`}>net</span>
      </div>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <Slider label="Haftalık bireysel çalışma" value={scenario.weeklyStudyMinutes} min={0} max={600} step={30} suffix="dk" icon={Clock3} onChange={value=>update("weeklyStudyMinutes",value)}/>
      <Slider label="Haftalık etüt / ek ders" value={scenario.extraLessonMinutes} min={0} max={300} step={30} suffix="dk" icon={GraduationCap} onChange={value=>update("extraLessonMinutes",value)}/>
      <Slider label="Aylık deneme sayısı" value={scenario.mockExamPerMonth} min={0} max={12} step={1} suffix="deneme" icon={CalendarDays} onChange={value=>update("mockExamPerMonth",value)}/>
      <Slider label="Aylık rehberlik görüşmesi" value={scenario.guidanceSessionsPerMonth} min={0} max={6} step={1} suffix="görüşme" icon={MessageCircle} onChange={value=>update("guidanceSessionsPerMonth",value)}/>
      <Slider label="Aylık veli görüşmesi" value={scenario.parentMeetingsPerMonth} min={0} max={6} step={1} suffix="görüşme" icon={Users} onChange={value=>update("parentMeetingsPerMonth",value)}/>
      <Slider label="Devamsızlık riski" value={scenario.attendanceRiskDays} min={0} max={20} step={1} suffix="gün" icon={Activity} onChange={value=>update("attendanceRiskDays",value)}/>
      <Slider label="Günlük soru hedefi" value={scenario.dailyQuestionTarget} min={0} max={200} step={10} suffix="soru" icon={Target} onChange={value=>update("dailyQuestionTarget",value)}/>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.13em] text-violet-600">Açıklanabilir Etkiler</span>
          <h3 className="mt-1 text-sm font-black text-slate-900">Senaryo Etki Dağılımı</h3>
        </div>
        <button
          type="button"
          onClick={()=>setScenario(defaultInterventionScenario())}
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600"
        >
          <RotateCcw className="h-4 w-4"/>Sıfırla
        </button>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {result.effects.map(effect=><div key={effect.key} className="flex items-start gap-3 py-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${effect.netEffect>=0?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>
            {effect.netEffect>=0?<TrendingUp className="h-5 w-5"/>:<TrendingDown className="h-5 w-5"/>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-xs text-slate-900">{effect.title}</strong>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${effect.netEffect>=0?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>
                {effect.netEffect>=0?"+":""}{effect.netEffect.toFixed(2)} net
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">{effect.explanation}</p>
          </div>
        </div>)}
      </div>
    </div>

    <div className={`rounded-3xl border p-5 ${result.recommendation.status==="positive"?"border-emerald-200 bg-emerald-50":result.recommendation.status==="risky"?"border-rose-200 bg-rose-50":"border-slate-200 bg-slate-50"}`}>
      <span className="text-[9px] font-black uppercase tracking-[.13em] text-slate-500">
        e-Nstitü Karar Özeti
      </span>
      <h3 className="mt-1 text-base font-black text-slate-900">{result.recommendation.headline}</h3>
      <p className="mt-2 text-[11px] leading-6 text-slate-600">{result.recommendation.detail}</p>
      <p className="mt-3 text-[9px] text-slate-400">Tahmin güveni: %{result.confidence}. Bu sonuç karar desteği amaçlıdır.</p>
    </div>
  </section>;
}
