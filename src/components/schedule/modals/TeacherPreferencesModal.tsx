import React from "react";
import { Settings, X } from "lucide-react";
import { Teacher } from "../../../types";

interface TeacherPreferencesModalProps {
  open: boolean;
  teachers: Teacher[];
  days: readonly string[];
  unwantedTeacherDays: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  onClose: () => void;
}

function TeacherPreferencesModal({
  open,
  teachers,
  days,
  unwantedTeacherDays,
  onChange,
  onClose,
}: TeacherPreferencesModalProps) {
  if (!open) return null;

  const toggleDay = (teacherId: string, day: string) => {
    const current = unwantedTeacherDays[teacherId] || [];
    const updated = current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day];
    onChange({ ...unwantedTeacherDays, [teacherId]: updated });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600" aria-label="Kapat">
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">Öğretmen İstemediği Günler Tercihi</h3>
            <p className="text-xs font-semibold text-slate-500">Seçilen günlere ders atandığında sistem ceza puanı uygular.</p>
          </div>
        </div>
        <div className="my-2 flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 divide-y divide-slate-100">
            {teachers.map((teacher) => {
              const unwanted = unwantedTeacherDays[teacher.id] || [];
              return (
                <div key={teacher.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-slate-900">{teacher.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">{teacher.branch}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {days.map((day) => {
                      const active = unwanted.includes(day);
                      return (
                        <button key={day} type="button" onClick={() => toggleDay(teacher.id, day)} className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-all ${active ? "border-rose-200 bg-rose-50 font-black text-rose-700 shadow-sm" : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-slate-50 pt-4">
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700">Kapat ve Güncelle</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TeacherPreferencesModal);
