import React from "react";
import { Trash2, X } from "lucide-react";

export type CancelDistributionType = "class_single" | "teacher_single" | "all_classes" | "all_teachers";
export interface CancelDistributionState { isOpen: boolean; type: CancelDistributionType; exceptManual: boolean; }

interface CancelDistributionModalProps {
  value: CancelDistributionState;
  selectedName?: string;
  onChange: (next: CancelDistributionState) => void;
  onClose: () => void;
  onConfirm: (value: CancelDistributionState) => void;
}

function CancelDistributionModal({ value, selectedName, onChange, onClose, onConfirm }: CancelDistributionModalProps) {
  if (!value.isOpen) return null;
  const description = value.type === "class_single"
    ? `Seçili ${selectedName || "sınıf"} sınıfına ait ders programı dağıtımını iptal etmek istiyorsunuz.`
    : value.type === "teacher_single"
      ? `Seçili ${selectedName || "öğretmen"} öğretmenine ait ders programı dağıtımını iptal etmek istiyorsunuz.`
      : value.type === "all_classes"
        ? "Tüm sınıfların haftalık ders programı dağıtımlarını iptal etmek istiyorsunuz."
        : "Tüm öğretmenlerin haftalık ders programı dağıtımlarını iptal etmek istiyorsunuz.";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-rose-500" /><h3 className="text-sm font-extrabold text-slate-900">Dağıtımı İptal Etme Onayı</h3></div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{description} Lütfen bir iptal yöntemi seçin:</p>
        <div className="space-y-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all ${!value.exceptManual ? "border-rose-500 bg-rose-50/20" : "border-slate-100 bg-white hover:border-slate-200"}`}>
            <input type="radio" name="cancelOption" checked={!value.exceptManual} onChange={() => onChange({ ...value, exceptManual: false })} className="mt-0.5" />
            <div><span className="block text-xs font-black text-slate-800">Tümünü İptal Et</span><span className="mt-0.5 block text-[10px] text-slate-500">Programdan tamamen silinir.</span></div>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all ${value.exceptManual ? "border-indigo-500 bg-indigo-50/20" : "border-slate-100 bg-white hover:border-slate-200"}`}>
            <input type="radio" name="cancelOption" checked={value.exceptManual} onChange={() => onChange({ ...value, exceptManual: true })} className="mt-0.5" />
            <div><span className="block text-xs font-black text-slate-800">El ile Yerleştirilenler HARİÇ</span><span className="mt-0.5 block text-[10px] text-slate-500">Yalnızca otomatik dağıtılan dersler temizlenir.</span></div>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Vazgeç</button>
          <button onClick={() => onConfirm(value)} className="cursor-pointer rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/10 hover:bg-rose-500">İptal Etmeyi Onayla</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CancelDistributionModal);
