import React from 'react';
import { BookOpen, Printer, Trash2, X } from 'lucide-react';

type ConfirmDialog = { isOpen: boolean; message: string; onConfirm: () => void } | null;

interface Props {
  cellExamSelector: { slotIndex: number; gradeLevel: string } | null;
  currentPlan: any;
  savedPlans: any[];
  selectedTerm: string;
  selectedExamNo: string;
  confirmDialog: ConfirmDialog;
  isPdfOptionsModalOpen: boolean;
  formatTurkishDate: (date: string) => string;
  doExamsConflict: (a: any, b: any) => boolean;
  onCloseCellSelector: () => void;
  onPlanChange: (newPlan: any, updatedPlans: any[]) => void;
  onRequestConfirm: (dialog: NonNullable<ConfirmDialog>) => void;
  onCloseConfirm: () => void;
  onClosePdfOptions: () => void;
  onExportPdf: () => void;
}

export function KelebekPlanModals(props: Props) {
  const {
    cellExamSelector, currentPlan, savedPlans, selectedTerm, selectedExamNo,
    confirmDialog, isPdfOptionsModalOpen, formatTurkishDate, doExamsConflict,
    onCloseCellSelector, onPlanChange, onRequestConfirm, onCloseConfirm,
    onClosePdfOptions, onExportPdf,
  } = props;

  return <>
    {cellExamSelector !== null && currentPlan && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center"><BookOpen className="w-5 h-5" /></div>
              <div>
                <h3 className="font-extrabold text-slate-800">{cellExamSelector.gradeLevel}. Sınıf Sınav Seçimi</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {formatTurkishDate(currentPlan.slots[cellExamSelector.slotIndex]?.dateStr)} • {currentPlan.slots[cellExamSelector.slotIndex]?.dayName} • {currentPlan.slots[cellExamSelector.slotIndex]?.sessionLabel || `${currentPlan.slots[cellExamSelector.slotIndex]?.sessionIndex}. Oturum`}
                </p>
              </div>
            </div>
            <button onClick={onCloseCellSelector} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 bg-slate-50"><div className="space-y-3">
            {(() => {
              const slot = currentPlan.slots[cellExamSelector.slotIndex];
              const existingExamsInSlot = slot.exams || [];
              const gradeKey = cellExamSelector.gradeLevel;
              const unplacedForGrade = (currentPlan.unplacedExams || []).filter((ex: any) => ex.gradeLevel && ex.gradeLevel.includes(gradeKey));
              const placedInThisSlotForGrade = existingExamsInSlot.filter((ex: any) => ex.gradeLevel && ex.gradeLevel.includes(gradeKey));
              const gradeExams = [...placedInThisSlotForGrade, ...unplacedForGrade];
              if (!gradeExams.length) return <div className="text-center py-8 text-slate-400 text-sm font-medium">Bu sınıf seviyesine ait planlanmamış ortak sınav bulunmuyor.</div>;
              return gradeExams.map((exam: any, idx: number) => {
                const isAlreadySelected = existingExamsInSlot.some((ex: any) => ex.id === exam.id);
                const conflictingExam = !isAlreadySelected ? existingExamsInSlot.find((ex: any) => ex.id !== exam.id && doExamsConflict(ex, exam)) : null;
                const hasConflict = !!conflictingExam;
                const executeAction = () => {
                  const newPlan = JSON.parse(JSON.stringify(currentPlan));
                  const targetSlot = newPlan.slots[cellExamSelector.slotIndex];
                  if (isAlreadySelected) {
                    targetSlot.exams = targetSlot.exams.filter((ex: any) => ex.id !== exam.id);
                    if (!newPlan.unplacedExams) newPlan.unplacedExams = [];
                    if (!newPlan.unplacedExams.some((ex: any) => ex.id === exam.id)) newPlan.unplacedExams.push(exam);
                  } else {
                    targetSlot.exams.push(exam);
                    newPlan.unplacedExams = (newPlan.unplacedExams || []).filter((ex: any) => ex.id !== exam.id);
                  }
                  const updatedPlans = savedPlans.some((p: any) => p.id === currentPlan.id) ? savedPlans.map((p: any) => p.id === currentPlan.id ? newPlan : p) : [newPlan, ...savedPlans];
                  onPlanChange(newPlan, updatedPlans);
                };
                return <div key={exam.id || idx} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isAlreadySelected ? 'bg-indigo-50 border-indigo-200' : hasConflict ? 'bg-white border-rose-200 opacity-60' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                  <div><div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">{exam.courseName}{hasConflict && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">Çakışma</span>}</div><div className="text-[11px] text-slate-500 font-medium mt-1">Katılımcı Sınıflar: {exam.classrooms?.join(', ')}</div>{hasConflict && <div className="text-[10px] text-rose-600 font-bold mt-1">Bu oturumda aynı şube/grubun ({conflictingExam.courseName}) sınavı var.</div>}</div>
                  <button disabled={!isAlreadySelected && hasConflict} onClick={() => isAlreadySelected ? onRequestConfirm({isOpen:true,message:'Atamayı iptal etmeyi onaylıyor musunuz?',onConfirm:executeAction}) : executeAction()} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isAlreadySelected ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : hasConflict ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm cursor-pointer'}`}>{isAlreadySelected ? 'Kaldır' : 'Ekle'}</button>
                </div>;
              });
            })()}
          </div></div>
        </div>
      </div>
    )}

    {confirmDialog?.isOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50"><div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"><Trash2 className="w-5 h-5" /></div><h3 className="font-bold text-slate-800 text-sm">Onay Gerekli</h3></div><div className="p-5"><p className="text-slate-600 text-sm font-medium">{confirmDialog.message}</p></div><div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2"><button onClick={onCloseConfirm} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200">İptal</button><button onClick={() => { confirmDialog.onConfirm(); onCloseConfirm(); }} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700">Evet, Onaylıyorum</button></div></div></div>}

    {isPdfOptionsModalOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in print:hidden"><div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 md:p-8 max-w-lg w-full mx-4 relative animate-scale-up"><button onClick={onClosePdfOptions} className="absolute top-5 right-5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full"><X className="w-5 h-5" /></button><div className="mb-5 space-y-2"><div className="flex items-center gap-2 text-indigo-600"><Printer className="w-6 h-6" /><h3 className="font-black text-slate-800 text-lg">Sınav Planı PDF Yazdır</h3></div><p className="text-xs text-slate-400 font-medium">Oluşturulan ortak sınav planını yüksek kalitede, yatay A4 PDF belgesi olarak indirebilirsiniz.</p></div><div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 space-y-3"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Belge Detayları</span><div className="grid grid-cols-2 gap-3 text-xs">{[['Dönem',currentPlan?.term || selectedTerm],['Sınav',currentPlan?.examNo || selectedExamNo],['Oturum Sayısı',`${currentPlan?.slots?.length || 0} Seans`],['Kağıt Boyutu / Düzen','A4 / Yatay']].map(([a,b]) => <div key={a} className="bg-white p-2.5 rounded-xl border border-slate-100"><span className="text-[10px] font-bold text-slate-400 block">{a}</span><span className="font-extrabold text-slate-700">{b}</span></div>)}</div></div><div className="flex items-center justify-end gap-3"><button onClick={onClosePdfOptions} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl uppercase">İptal</button><button onClick={() => { onExportPdf(); onClosePdfOptions(); }} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 uppercase"><Printer className="w-4 h-4" />PDF Olarak İndir</button></div></div></div>}
  </>;
}
