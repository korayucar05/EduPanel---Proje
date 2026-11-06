import React from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  assignWorkflowOwner,
  autonomousStore,
  buildWorkflowSummary,
  completeWorkflowWithResult,
  createWorkflowFromAutonomousTask,
  updateWorkflowStatus,
  workflowStore,
  type WorkflowAction,
} from "../intelligence-v3";

const ownerLabel={
  management:"Yönetim",
  teacher:"Öğretmen",
  guidance:"Rehberlik",
  parent:"Veli",
} as const;

const statusLabel={
  draft:"Taslak",
  planned:"Planlandı",
  active:"Aktif",
  completed:"Tamamlandı",
  cancelled:"İptal",
} as const;

export default function HasatActionWorkflow({
  teachers,
}:{
  teachers:any[];
}){
  const [version,setVersion]=React.useState(0);
  const [resultAction,setResultAction]=React.useState<WorkflowAction|null>(null);
  const [observedGain,setObservedGain]=React.useState("");
  const [resultNote,setResultNote]=React.useState("");

  React.useEffect(()=>{
    const update=()=>setVersion(value=>value+1);
    window.addEventListener("hasat-workflow-updated",update);
    return()=>window.removeEventListener("hasat-workflow-updated",update);
  },[]);

  const summary=React.useMemo(()=>buildWorkflowSummary(),[version]);

  const importAutonomous=()=>{
    const tasks=autonomousStore.tasks();
    for(const task of tasks)createWorkflowFromAutonomousTask(task);
    setVersion(value=>value+1);
  };

  const changeOwner=(action:WorkflowAction,value:string)=>{
    const teacher=teachers.find(item=>String(item.id)===value);
    assignWorkflowOwner(
      action.id,
      teacher?.id?String(teacher.id):undefined,
      teacher?.name||teacher?.fullName||undefined,
    );
  };

  const complete=()=>{
    if(!resultAction)return;
    completeWorkflowWithResult(
      resultAction.id,
      Number(observedGain)||0,
      resultNote.trim()||undefined,
    );
    setResultAction(null);
    setObservedGain("");
    setResultNote("");
    setVersion(value=>value+1);
  };

  return <div className="min-h-full bg-slate-50 p-4 md:p-6">
    <section className="mx-auto max-w-[1600px] space-y-4">
      <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-900 p-7 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">e-Nstitü Eylem İş Akışı 1.0</span>
            <h1 className="mt-2 text-3xl font-black">Karardan Uygulamaya Müdahale Yönetimi</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">Otonom görevleri sorumlu, tarih, durum ve sonuç ölçümüyle uygulanabilir müdahalelere dönüştürür.</p>
          </div>
          <button type="button" onClick={importAutonomous} className="flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700">
            <Target className="h-4 w-4"/>Otonom Görevleri Aktar
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Toplam",summary.total,Target],
          ["Planlanan",summary.planned,Clock3],
          ["Aktif",summary.active,Activity],
          ["Tamamlanan",summary.completed,CheckCircle2],
          ["Geciken",summary.overdue,Users],
          ["Etkinlik",`%${summary.averageEffectiveness}`,TrendingUp],
        ].map(([label,value,Icon]:any)=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Icon className="h-5 w-5 text-emerald-600"/>
          <span className="mt-4 block text-[10px] font-bold text-slate-400">{label}</span>
          <strong className="mt-1 block text-3xl font-black text-slate-900">{value}</strong>
        </div>)}
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Müdahale Ajandası</span>
            <h2 className="mt-1 text-sm font-black text-slate-900">Görev ve Sonuç Takibi</h2>
          </div>
          <button type="button" onClick={()=>workflowStore.clear()} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">
            <RotateCcw className="h-4 w-4"/>Temizle
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[.1em] text-slate-400">
                <th className="px-3 py-3">Öncelik</th>
                <th className="px-3 py-3">Müdahale</th>
                <th className="px-3 py-3">Sorumlu Türü</th>
                <th className="px-3 py-3">Sorumlu</th>
                <th className="px-3 py-3">Son Tarih</th>
                <th className="px-3 py-3">Beklenen</th>
                <th className="px-3 py-3">Gerçekleşen</th>
                <th className="px-3 py-3">Durum</th>
                <th className="px-3 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {summary.actions.map(action=><tr key={action.id} className="border-b border-slate-100 text-[10px] text-slate-600">
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${action.priority===5?"bg-rose-50 text-rose-700":action.priority===4?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700"}`}>P{action.priority}</span></td>
                <td className="max-w-[320px] px-3 py-3"><strong className="block text-xs text-slate-900">{action.title}</strong><span className="mt-1 line-clamp-2 block text-[9px] text-slate-400">{action.detail}</span></td>
                <td className="px-3 py-3 font-bold">{ownerLabel[action.ownerType]}</td>
                <td className="px-3 py-3">
                  {action.ownerType==="teacher"
                    ?<select value={action.ownerId||""} onChange={event=>changeOwner(action,event.target.value)} className="h-9 min-w-[180px] rounded-xl border border-slate-200 px-2 text-[10px] font-bold">
                      <option value="">Öğretmen seçin</option>
                      {teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name||teacher.fullName}</option>)}
                    </select>
                    :<span>{action.ownerName||ownerLabel[action.ownerType]}</span>}
                </td>
                <td className="px-3 py-3">{action.dueAt?new Date(action.dueAt).toLocaleString("tr-TR"):"—"}</td>
                <td className="px-3 py-3 font-black text-blue-700">{action.expectedGain!==undefined?`+${action.expectedGain.toFixed(2)} net`:"—"}</td>
                <td className="px-3 py-3 font-black text-emerald-700">{action.observedGain!==undefined?`${action.observedGain>=0?"+":""}${action.observedGain.toFixed(2)} net`:"—"}</td>
                <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{statusLabel[action.status]}</span></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {action.status==="planned"&&<button type="button" onClick={()=>updateWorkflowStatus(action.id,"active")} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[9px] font-black text-blue-700"><Play className="mr-1 inline h-3 w-3"/>Başlat</button>}
                    {(action.status==="planned"||action.status==="active")&&<button type="button" onClick={()=>setResultAction(action)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black text-emerald-700">Sonuç Gir</button>}
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
          {!summary.actions.length&&<div className="py-12 text-center text-xs text-slate-400">Henüz müdahale kaydı yok. Otonom görevleri aktarın.</div>}
        </div>
      </div>

      {resultAction&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={()=>setResultAction(null)}>
        <div className="w-full max-w-lg rounded-[30px] bg-white p-6 shadow-2xl" onMouseDown={event=>event.stopPropagation()}>
          <div className="flex items-center gap-3"><UserCheck className="h-5 w-5 text-emerald-700"/><h2 className="text-lg font-black text-slate-900">Müdahale Sonucunu Gir</h2></div>
          <p className="mt-3 text-xs leading-6 text-slate-500">{resultAction.title}</p>
          <label className="mt-5 block">
            <span className="text-[10px] font-black text-slate-500">Gerçekleşen net etkisi</span>
            <input type="number" step=".1" value={observedGain} onChange={event=>setObservedGain(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-black"/>
          </label>
          <label className="mt-4 block">
            <span className="text-[10px] font-black text-slate-500">Sonuç notu</span>
            <textarea value={resultNote} onChange={event=>setResultNote(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-xs"/>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={()=>setResultAction(null)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600">Vazgeç</button>
            <button type="button" onClick={complete} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white">Tamamla ve Hafızaya Kaydet</button>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
