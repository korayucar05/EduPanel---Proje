import React from "react";

interface ScheduleActionBarProps {
  solverRunning: boolean;
  solverProgress: number;
  isSolverPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function ScheduleActionBar({
  solverRunning,
  solverProgress,
  isSolverPaused,
  onPause,
  onResume,
  onCancel,
}: ScheduleActionBarProps) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-slate-700">Dağıtım Kontrolü</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${solverRunning ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
            {solverRunning ? `%${solverProgress}` : "Beklemede"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={!solverRunning || isSolverPaused} onClick={onPause} className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-black text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-100">Durdur</button>
          <button type="button" disabled={!solverRunning || !isSolverPaused} onClick={onResume} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-black text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-100">Devam Et</button>
          <button type="button" disabled={!solverRunning} onClick={onCancel} className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-black text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-100">İptal Et</button>
        </div>
        <p className="text-[10px] leading-snug text-slate-500">Dağıtım başlayınca durdurma, devam etme ve iptal işlemleri bu panelden yönetilir.</p>
      </div>
    </>
  );
}

export default React.memo(ScheduleActionBar);
