import React from "react";
import { Award, FileText, Loader2, Play, Sparkles, X } from "lucide-react";
import { Classroom, Teacher } from "../../../types";
import { ScheduleAlgorithm } from "../../../types/schedule";

interface OptimizationWizardModalProps {
  open: boolean;
  selectedAlgorithm: ScheduleAlgorithm;
  selectedScope: "local" | "global";
  viewType: "class" | "teacher";
  selectedId: string;
  classrooms: Classroom[];
  teachers: Teacher[];
  libraries: any[];
  runs: any[];
  totalPenalty: number;
  solverRunning: boolean;
  solverProgress: number;
  solverPaused: boolean;
  unplacedInfo: { count: number; details: any[] };
  onAlgorithmChange: (value: ScheduleAlgorithm) => void;
  onScopeChange: (value: "local" | "global") => void;
  onRun: () => void;
  onTogglePause: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function OptimizationWizardModal(props: OptimizationWizardModalProps) {
  if (!props.open) return null;
  const selectedName = props.selectedId
    ? props.viewType === "class"
      ? props.classrooms.find((item) => item.id === props.selectedId)?.name
      : props.teachers.find((item) => item.id === props.selectedId)?.name
    : "Seçilmedi";

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
      <div className="bg-slate-50 rounded-3xl shadow-2xl border border-slate-100 max-w-[95vw] w-full p-6 relative flex flex-col h-[95vh] max-h-[1600px] overflow-hidden">
        <button onClick={props.onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 z-10"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-500/20 flex items-center justify-center text-indigo-600"><Sparkles className="w-5 h-5" /></div><div><h3 className="text-slate-900 font-black text-lg">Akıllı Dağıtım Ayarları</h3><p className="text-slate-500 text-xs font-semibold">Tek kısıt motoru önce tüm dersleri yerleştirir, sonra kaliteyi iyileştirir.</p></div></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/60 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5"><div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Dağıtım Motoru</div><div className="mt-1 text-xs font-bold text-slate-800">Akıllı Tam Dağıtım</div><p className="mt-1 text-[10px] leading-4 text-slate-600">Hard kurallar korunur; yerleşmeyen bloklar için aynı program üzerinde onarım aranır.</p></div>
              <div><label className="block text-slate-700 font-extrabold text-xs mb-1.5">Optimizasyon Kapsamı</label><select value={props.selectedScope} onChange={(event) => props.onScopeChange(event.target.value as "local" | "global")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"><option value="local">Sadece Seçili {props.viewType === "class" ? "Sınıf" : "Öğretmen"} ({selectedName})</option><option value="global">Tüm Okul Ders Programı</option></select></div>
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/60 space-y-3"><h4 className="text-indigo-900 font-black text-xs flex items-center gap-1.5"><Award className="w-4 h-4" />Yüklü Optimizasyon Motorları</h4><div className="space-y-2 max-h-[140px] overflow-y-auto">{props.libraries.length === 0 ? <div className="text-[10px] text-slate-400 font-bold">Veritabanı bağlantısı kuruluyor...</div> : props.libraries.map((lib) => <div key={lib.id} className="bg-white p-2 rounded-xl border border-indigo-100/30"><div className="flex justify-between"><span className="text-indigo-800 font-black text-[10px]">{lib.name}</span><span className="text-[8px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full">{lib.developer}</span></div><p className="text-slate-500 text-[9px] font-semibold mt-1">{lib.description}</p></div>)}</div></div>
            </div>
            <div className="mt-5 space-y-2"><div className="flex justify-between text-xs font-bold border-b border-slate-50 pb-2"><span className="text-slate-500">Mevcut Ceza Puanı:</span><span className="text-slate-800 font-extrabold">{props.totalPenalty} Puan</span></div><button disabled={props.solverRunning} onClick={props.onRun} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">{props.solverRunning ? <><Loader2 className="w-4 h-4 animate-spin" />Optimizasyon Yapılıyor (%{props.solverProgress})...</> : <><Play className="w-4 h-4" />Optimizasyonu Başlat</>}</button>{props.solverRunning && <div className="flex gap-2"><button onClick={props.onTogglePause} className="flex-1 py-2 text-xs font-bold rounded-xl border bg-amber-50 border-amber-200 text-amber-700">{props.solverPaused ? "Devam Et" : "Duraklat"}</button><button onClick={props.onCancel} className="flex-1 py-2 text-xs font-bold rounded-xl bg-red-50 border border-red-200 text-red-700">İptal Et</button></div>}{props.solverRunning && props.unplacedInfo.count > 0 && <div className="mt-4 p-4 bg-slate-100 border rounded-2xl max-h-[250px] overflow-auto"><div className="flex justify-between"><span className="text-xs font-black">Oluşturulmayan Blok:</span><span className="text-sm font-black text-rose-600">{props.unplacedInfo.count}</span></div>{props.unplacedInfo.details.slice(0, 50).map((item, index) => <div key={index} className="flex justify-between text-[10px] bg-white p-2 rounded-lg border mt-1"><span className="font-bold truncate">{item.courseName}</span><span>{item.className}</span></div>)}</div>}</div>
          </div>
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/60 flex flex-col overflow-hidden min-h-0"><h4 className="text-slate-800 font-black text-xs mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-500" />Çalıştırma Günlükleri</h4><div className="flex-1 overflow-auto border border-slate-100 rounded-xl"><table className="w-full text-left min-w-[450px]"><thead><tr className="bg-slate-50"><th className="p-2.5 text-[10px]">Yöntem</th><th className="p-2.5 text-[10px] text-center">Önceki</th><th className="p-2.5 text-[10px] text-center">Sonraki</th><th className="p-2.5 text-[10px] text-center">Süre</th><th className="p-2.5 text-[10px] text-center">Durum</th></tr></thead><tbody>{props.runs.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-400 text-xs">Kayıt bulunamadı.</td></tr> : props.runs.map((run) => <tr key={run.id} className="border-t"><td className="p-2.5 text-[11px] font-bold">{run.algorithm}</td><td className="p-2.5 text-center text-[11px]">{run.initial_penalty}</td><td className="p-2.5 text-center text-[11px] font-black text-indigo-600">{run.final_penalty}</td><td className="p-2.5 text-center text-[11px]">{run.duration_ms}</td><td className="p-2.5 text-center"><span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{run.status}</span></td></tr>)}</tbody></table></div></div>
        </div>
        <div className="flex justify-end mt-5 pt-4 border-t"><button onClick={props.onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl">Kapat</button></div>
      </div>
    </div>
  );
}

export default React.memo(OptimizationWizardModal);
