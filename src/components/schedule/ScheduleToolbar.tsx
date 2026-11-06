import React from "react";
import { BookOpen, Mic, MicOff, RotateCcw, Sparkles, Target, Trash2, Users } from "lucide-react";
import type { Classroom, Teacher } from "../../types";

export type ScheduleViewType = "class" | "teacher";
export type CancelDistributionType =
  | "class_single"
  | "teacher_single"
  | "all_classes"
  | "all_teachers";

interface ScheduleToolbarProps {
  viewType: ScheduleViewType;
  selectedId: string;
  classrooms: Classroom[];
  teachers: Teacher[];
  incompleteClassIds: ReadonlySet<string>;
  incompleteTeacherIds: ReadonlySet<string>;
  onViewTypeChange: (viewType: ScheduleViewType) => void;
  onSelectedIdChange: (id: string) => void;
  onRunClassDistribution: () => void;
  onRunTeacherDistribution: () => void;
  onOpenClassCancel: () => void;
  onOpenTeacherCancel: () => void;
  solverRunning: boolean;
  solverProgress: number;
  solverStats: {
    totalBlocks: number;
    placedBlocks: number;
    remainingBlocks: number;
    stage: string;
  };
  onRunGlobal: () => void;
  onTightenSchedule: () => void;
  onOpenGlobalCancel: () => void;
  voiceListening: boolean;
  voiceFeedback: string;
  voiceTranscript: string;
  voiceSupported: boolean;
  onStartVoice: () => void;
  onStopVoice: () => void;
}

function ScheduleToolbar({
  viewType,
  selectedId,
  classrooms,
  teachers,
  incompleteClassIds,
  incompleteTeacherIds,
  onViewTypeChange,
  onSelectedIdChange,
  onRunClassDistribution,
  onRunTeacherDistribution,
  onOpenClassCancel,
  onOpenTeacherCancel,
  solverRunning,
  solverProgress,
  solverStats,
  onRunGlobal,
  onTightenSchedule,
  onOpenGlobalCancel,
  voiceListening,
  voiceFeedback,
  voiceTranscript,
  voiceSupported,
  onStartVoice,
  onStopVoice,
}: ScheduleToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <button type="button" disabled={solverRunning} onClick={onTightenSchedule} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"><Target className="h-4 w-4" />Programı Sıkılaştır</button>
      {solverRunning && <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2"><div className="flex items-center justify-between text-[10px] font-bold text-slate-600"><span>{solverStats.stage || "Dağıtım yapılıyor..."}</span><span>%{solverProgress}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.max(0,Math.min(100,solverProgress))}%`}} /></div><div className="mt-2 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white px-2 py-1"><div className="text-[9px] font-bold text-slate-400">TOPLAM BLOK</div><div className="text-sm font-black">{solverStats.totalBlocks}</div></div><div className="rounded-lg bg-white px-2 py-1"><div className="text-[9px] font-bold text-slate-400">YERLEŞTİRİLEN</div><div className="text-sm font-black text-emerald-700">{solverStats.placedBlocks}</div></div><div className="rounded-lg bg-white px-2 py-1"><div className="text-[9px] font-bold text-slate-400">KALAN</div><div className="text-sm font-black text-amber-700">{solverStats.remainingBlocks}</div></div></div></div>}
    </div>
  );
}

export default React.memo(ScheduleToolbar);
