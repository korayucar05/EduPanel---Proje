import React from "react";
import {
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  runUniversitySimulation,
  type BrainCohortResult,
  type UniversityScenario,
} from "../../intelligence-v2";

const defaultScenario:UniversityScenario={
  mathematicsNetGain:2,
  turkishNetGain:1,
  scienceNetGain:1,
  socialNetGain:0,
  aytMathematicsNetGain:2,
  aytScienceNetGain:1,
  aytLiteratureNetGain:1,
  aytSocialNetGain:0,
  weeklyStudyMinutes:240,
  attendanceReductionDays:1,
};

const statusTone={
  reachable:"bg-emerald-50 text-emerald-700",
  borderline:"bg-amber-50 text-amber-700",
  distant:"bg-rose-50 text-rose-700",
  undefined:"bg-slate-50 text-slate-500",
} as const;

const statusLabel={
  reachable:"Ulaşılabilir",
  borderline:"Sınırda",
  distant:"Uzak",
  undefined:"Tanımsız",
} as const;

export function UniversityIntelligenceDashboard({
  cohort,
}:{
  cohort:BrainCohortResult;
}){
  const [scenario,setScenario]=React.useState<UniversityScenario>(defaultScenario);
  const [isFormOpen,setIsFormOpen]=React.useState(false);
  const result=React.useMemo(
    ()=>runUniversitySimulation({cohort,scenario}),
    [cohort,scenario],
  );

  const update=<K extends keyof UniversityScenario>(
    key:K,
    value:UniversityScenario[K],
  )=>setScenario(current=>({...current,[key]:value}));

  const controls:Array<[string,keyof UniversityScenario,number,number,number,string]>=[
    ["TYT Matematik","mathematicsNetGain",0,10,.5,"net"],
    ["TYT Türkçe","turkishNetGain",0,10,.5,"net"],
    ["TYT Fen","scienceNetGain",0,10,.5,"net"],
    ["TYT Sosyal","socialNetGain",0,10,.5,"net"],
    ["AYT Matematik","aytMathematicsNetGain",0,15,.5,"net"],
    ["AYT Fen","aytScienceNetGain",0,15,.5,"net"],
    ["AYT Edebiyat","aytLiteratureNetGain",0,15,.5,"net"],
    ["AYT Sosyal","aytSocialNetGain",0,15,.5,"net"],
    ["Haftalık Çalışma","weeklyStudyMinutes",0,900,30,"dk"],
    ["Devamsızlık Azaltma","attendanceReductionDays",0,10,1,"gün"],
  ];

  return <section className="space-y-4">
    <button type="button" onClick={()=>setIsFormOpen(current=>!current)} aria-expanded={isFormOpen} className="w-full overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-violet-900 to-fuchsia-800 p-6 text-left text-white shadow-xl transition hover:brightness-110">
      <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">e-Nstitü University Intelligence</span>
      <h2 className="mt-2 text-2xl font-black">Üniversite Yerleşme Simülatörü</h2>
      <p className="mt-2 max-w-4xl text-xs leading-6 text-white/80">{result.summary}</p>
      <span className="mt-4 block text-[10px] font-black text-white/80">{isFormOpen?"Formu kapat":"Simülasyonu aç"}</span>
    </button>

    {isFormOpen&&<>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Öğrenci",result.totalStudents,Users],
        ["Mevcut Yerleşme",result.estimatedPlacedStudents,GraduationCap],
        ["Senaryo Sonrası",result.estimatedPlacedStudentsAfterScenario,TrendingUp],
        ["Yerleşme Artışı",`+${result.placementGain}`,Sparkles],
        ["İlk 100 Bin Artışı",`+${result.first100kGain}`,Trophy],
        ["Ort. Puan Artışı",`+${result.averageScoreGain}`,Target],
      ].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Icon className="h-5 w-5 text-violet-600"/>
        <span className="mt-3 block text-[9px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Senaryo</span><h3 className="mt-1 text-sm font-black text-slate-900">Net ve Çalışma Varsayımları</h3></div>
        {controls.map(([label,key,min,max,step,suffix])=><label key={String(key)} className="block rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center justify-between text-[10px]"><strong className="text-slate-700">{label}</strong><span className="font-black text-violet-700">{scenario[key]} {suffix}</span></div>
          <input className="mt-3 w-full accent-violet-600" type="range" min={min} max={max} step={step} value={Number(scenario[key])} onChange={event=>update(key,Number(event.target.value) as any)}/>
        </label>)}
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-blue-700"/><h3 className="text-sm font-black text-slate-900">Puan Türü Etki Özeti</h3></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{result.scoreTypeSummary.map(item=><div key={item.scoreType} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between"><strong className="text-sm text-slate-900">{item.scoreType}</strong><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black text-violet-700">{item.studentCount} öğrenci</span></div>
            <div className="mt-4 flex items-end justify-between"><div><span className="text-[9px] text-slate-400">Mevcut Olasılık</span><strong className="mt-1 block text-xl text-slate-800">%{item.averageProbability}</strong></div><div className="text-right"><span className="text-[9px] text-slate-400">Senaryo</span><strong className="mt-1 block text-xl text-emerald-700">%{item.averageProbabilityAfterScenario}</strong></div></div>
            <p className="mt-3 text-[10px] font-black text-blue-700">Yerleşme değişimi: {item.placementGain>=0?"+":""}{item.placementGain}</p>
          </div>)}</div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><BookOpenCheck className="h-5 w-5 text-emerald-700"/><h3 className="text-sm font-black text-slate-900">En Yüksek Etki Beklenen Öğrenciler</h3></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead><tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400"><th className="px-3 py-3">Öğrenci</th><th className="px-3 py-3">Sınıf</th><th className="px-3 py-3">Tür</th><th className="px-3 py-3">Mevcut</th><th className="px-3 py-3">Senaryo</th><th className="px-3 py-3">Olasılık Artışı</th><th className="px-3 py-3">Sıralama</th><th className="px-3 py-3">Durum</th></tr></thead>
              <tbody>{result.highImpactStudents.slice(0,20).map(item=><tr key={item.studentId} className="border-b border-slate-100 text-[10px] text-slate-600">
                <td className="px-3 py-3"><strong className="block text-xs text-slate-900">{item.studentName}</strong><span className="text-[9px] text-slate-400">{item.studentNumber||""}</span></td>
                <td className="px-3 py-3 font-bold">{item.classroom||"—"}</td>
                <td className="px-3 py-3 font-black text-violet-700">{item.scoreType}</td>
                <td className="px-3 py-3">%{item.currentProbability}</td>
                <td className="px-3 py-3 font-black text-emerald-700">%{item.predictedProbability}</td>
                <td className="px-3 py-3 font-black text-blue-700">+{item.probabilityChange}</td>
                <td className="px-3 py-3">{item.predictedRanking.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${statusTone[item.status]}`}>{statusLabel[item.status]}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">e-Nstitü Üniversite Stratejisi</span>
      <div className="mt-3 space-y-2">{result.recommendations.map((item,index)=><p key={index} className="text-[10px] leading-5 text-emerald-900">• {item}</p>)}</div>
      <p className="mt-3 text-[9px] text-emerald-700">Tahmin güveni: %{result.confidence}. Bu sürüm açıklanabilir karar desteği modelidir; resmî YKS yerleştirme sonucu değildir.</p>
    </div>
    </>}
  </section>;
}
