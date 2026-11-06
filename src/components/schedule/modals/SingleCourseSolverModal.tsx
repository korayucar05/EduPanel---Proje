import React from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";

interface SingleCourseSolverModalProps {
  course: any | null;
  solverRunning: boolean;
  solverProgress: number;
  solverPaused: boolean;
  solverResult: any | null;
  onClose: () => void;
  onStart: (course: any) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function SingleCourseSolverModal({
  course,
  solverRunning,
  solverProgress,
  solverPaused,
  solverResult,
  onClose,
  onStart,
  onPause,
  onResume,
  onCancel,
}: SingleCourseSolverModalProps) {
  if (!course) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 text-sm">Ders Dağıtım Paneli</h3>
          </div>
          {!solverRunning && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
          <div className="flex justify-between"><span className="font-medium text-slate-400">Ders Adı:</span><span className="font-bold text-slate-800">{course.courseName}</span></div>
          {course.groupName && <div className="flex justify-between"><span className="font-medium text-slate-400">Grup:</span><span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] uppercase">{course.groupName}</span></div>}
          <div className="flex justify-between"><span className="font-medium text-slate-400">Ders Sınıfı / Türü:</span><span className="font-semibold text-slate-700">{course.className || "Belirtilmedi"} / {course.type || "Seçmeli"}</span></div>
          <div className="flex justify-between"><span className="font-medium text-slate-400">Öğretmen:</span><span className="font-semibold text-slate-700">{[course.teacherName, course.teacherName2].filter(Boolean).join(" - ") || "Atanmadı"}</span></div>
          <div className="flex justify-between"><span className="font-medium text-slate-400">Dağıtılacak Saatler:</span><span className="font-bold text-indigo-600">{course.remaining} Saat</span></div>
        </div>

        {solverRunning ? (
          <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
            <div className="relative flex items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /><span className="absolute text-slate-800 text-xs font-black">{solverProgress}%</span></div>
            <div className="space-y-1"><p className="text-slate-800 font-bold text-sm">Akıllı Algoritma Çalışıyor...</p><p className="text-slate-400 text-xs">Kısıt tabanlı ve genetik yöntemler en uygun gün ve saatleri deniyor.</p></div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-indigo-600 h-full rounded-full transition-all duration-100" style={{ width: `${solverProgress}%` }} /></div>
            <div className="w-full grid grid-cols-3 gap-2 mt-2">
              <button type="button" disabled={solverPaused} onClick={onPause} className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-[11px] font-black text-amber-700 disabled:opacity-40 hover:bg-amber-100">Durdur</button>
              <button type="button" disabled={!solverPaused} onClick={onResume} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2.5 text-[11px] font-black text-emerald-700 disabled:opacity-40 hover:bg-emerald-100">Devam Et</button>
              <button type="button" onClick={onCancel} className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2.5 text-[11px] font-black text-rose-700 hover:bg-rose-100">İptal Et</button>
            </div>
            <div className={`w-full rounded-xl border px-3 py-2 text-[11px] font-bold ${solverPaused ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>{solverPaused ? "Dağıtım duraklatıldı." : "Dağıtım çalışıyor."}</div>
          </div>
        ) : solverResult ? (
          solverResult.success ? (
            <div className="flex flex-col items-center justify-center py-4 gap-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></div>
              <div className="space-y-1"><p className="text-slate-900 font-bold text-sm">Dağıtım Başarıyla Tamamlandı!</p><p className="text-slate-500 text-xs">Seçilen dersin blokları uygun hücrelere yerleştirildi.</p></div>
              <button onClick={onClose} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl">Kapat</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 p-3.5 rounded-2xl text-rose-800"><AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" /><div><p className="font-bold text-xs">Dağıtım Yapılamadı!</p><p className="text-[11px] text-rose-700">Uygun boş hücre bulunamadı veya kısıt çakışması oluştu.</p></div></div>
              <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1.5">{solverResult.reasons?.length ? solverResult.reasons.map((reason: string, index: number) => <div key={index} className="flex items-start gap-2 text-[11px] text-slate-600"><span className="text-rose-500">•</span><span>{reason}</span></div>) : <p className="text-slate-400 text-[11px]">Sınıf veya öğretmen programındaki doluluk/kapalı saatler.</p>}</div>
              <div className="flex gap-2.5"><button onClick={() => onStart(course)} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl"><RefreshCw className="w-3.5 h-3.5" />Yeniden Dene</button><button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl">Kapat</button></div>
            </div>
          )
        ) : (
          <div className="flex gap-2.5"><button onClick={() => onStart(course)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl">Dağıtımı Başlat</button><button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl">Vazgeç</button></div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SingleCourseSolverModal);
