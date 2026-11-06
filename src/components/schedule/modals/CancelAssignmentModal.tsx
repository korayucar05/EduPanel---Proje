import React from "react";
import { Trash2, X } from "lucide-react";

interface CancelingAssignment {
  day: string;
  hour: number;
  assignment: any;
}

interface CancelAssignmentModalProps {
  value: CancelingAssignment | null;
  onClose: () => void;
  onConfirm: (value: CancelingAssignment) => void;
}

function CancelAssignmentModal({ value, onClose, onConfirm }: CancelAssignmentModalProps) {
  if (!value) return null;
  const assignment = value.assignment || {};
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex w-full max-w-md flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Kapat"><X className="h-5 w-5" /></button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
          <div><h3 className="text-base font-black tracking-tight text-slate-900">Ders Atamasını İptal Et</h3><p className="text-xs font-semibold text-slate-500">Seçilen ders programdan kaldırılacaktır.</p></div>
        </div>
        <div className="mb-5 space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50 p-4">
          <div className="text-xs"><span className="block font-semibold text-slate-500">Ders Adı:</span><span className="text-sm font-extrabold text-slate-900">{assignment.courseName}</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="block font-semibold text-slate-500">Öğretmen:</span><span className="font-bold text-slate-800">{[assignment.teacherName, assignment.teacherName2].filter(Boolean).join(" & ") || "Atanmadı"}</span></div>
            <div><span className="block font-semibold text-slate-500">Sınıf:</span><span className="font-bold text-slate-800">{assignment.className || "Belirtilmedi"}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-1 text-xs">
            <div><span className="block font-semibold text-slate-500">Gün:</span><span className="font-extrabold uppercase text-indigo-600">{value.day}</span></div>
            <div><span className="block font-semibold text-slate-500">Saat:</span><span className="font-extrabold text-indigo-600">{value.hour}. Saat</span></div>
          </div>
        </div>
        <p className="mb-6 text-xs font-medium leading-relaxed text-slate-600">Bu ders bloğunun atamasını iptal etmek istediğinize emin misiniz?</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Vazgeç</button>
          <button type="button" onClick={() => onConfirm(value)} className="cursor-pointer rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-red-200 hover:bg-red-700">Atamayı İptal Et</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CancelAssignmentModal);
