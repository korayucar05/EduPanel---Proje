import React from "react";
import { CalendarDays, X } from "lucide-react";
import type { Teacher } from "../../../types";

interface TeacherSchedulePreviewModalProps {
  teacher: Teacher | null;
  scheduleData: Record<string, any>;
  days: readonly string[];
  hours: readonly number[];
  onClose: () => void;
}

export default function TeacherSchedulePreviewModal({
  teacher,
  scheduleData,
  days,
  hours,
  onClose,
}: TeacherSchedulePreviewModalProps) {
  if (!teacher) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><CalendarDays className="h-5 w-5" /></div>
            <div><h3 className="text-sm font-black text-slate-900">{teacher.name} · Öğretmen Programı</h3><p className="text-[11px] font-semibold text-slate-500">{teacher.branch || "Branş belirtilmedi"}</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full min-w-[680px] table-fixed border-collapse text-center">
            <thead><tr><th className="w-12 border border-slate-200 bg-slate-50 py-2 text-[10px] text-slate-500">Saat</th>{days.map((day) => <th key={day} className="border border-slate-200 bg-slate-50 py-2 text-[11px] font-black text-slate-700">{day}</th>)}</tr></thead>
            <tbody>{hours.map((hour) => <tr key={hour}><td className="border border-slate-200 bg-slate-50 py-3 text-xs font-black text-slate-600">{hour}</td>{days.map((day) => {
              const raw = scheduleData[`teacher_${teacher.id}_${day}_${hour}`];
              const lessons = Array.isArray(raw) ? raw : raw ? [raw] : [];
              return <td key={day} className="h-16 border border-slate-200 p-1 align-middle">{lessons.map((lesson: any, index: number) => <div key={`${lesson.blockId || lesson.courseName}-${index}`} className="rounded-lg bg-indigo-50 px-1 py-1 text-[10px] font-black leading-tight text-indigo-900"><div>{lesson.courseName}</div><div className="mt-0.5 text-[9px] font-semibold text-indigo-600">{lesson.className}</div></div>)}</td>;
            })}</tr>)}</tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-[10px] font-semibold text-slate-500">Bu önizleme, dağıtılmamış dersin öğretmendeki uygun saatlerini kontrol etmek içindir.</div>
      </div>
    </div>
  );
}
