import React from "react";
import { AlertTriangle, ChevronDown, Printer, Save, Sparkles, Trash2 } from "lucide-react";

interface KelebekPlanActionsProps {
  currentPlan: any;
  activeSubTab: 'A' | 'B' | 'C';
  handleManualSaveConfig: () => void;
  isActionsDropdownOpen: boolean;
  setIsActionsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAbsentReportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPdfOptionsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  autoScheduleRemainingExams: () => void;
  setConfirmDialog: React.Dispatch<React.SetStateAction<any>>;
  handleClearPlan: (planId: string) => void;
}

export function KelebekPlanActions(props: KelebekPlanActionsProps) {
  const { activeSubTab, currentPlan, handleManualSaveConfig, isActionsDropdownOpen, setIsActionsDropdownOpen,
    setIsAbsentReportModalOpen, setIsPdfOptionsModalOpen, autoScheduleRemainingExams, setConfirmDialog, handleClearPlan } = props;
  return (
    <>
        {activeSubTab === 'C' && currentPlan && (
          <div className="flex items-center gap-2">
            {/* Kaydet Button */}
            <button
              type="button"
              onClick={handleManualSaveConfig}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[14.67px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0 animate-fade-in"
            >
              <Save className="w-4 h-4" />
              <span>Kaydet</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                className="h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
              >
                <span>İşlemler</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isActionsDropdownOpen && (
              <>
                {/* Overlay backing to close dropdown when clicking outside */}
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsActionsDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 animate-fade-in">
                  
                  <button
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setIsAbsentReportModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-extrabold flex items-center gap-2 cursor-pointer text-slate-700"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sınava Katılmayan Öğrenciler</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setIsPdfOptionsModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-extrabold text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>PDF Yazdır</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      autoScheduleRemainingExams();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-extrabold text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Ortak Sınav Planla</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      if (currentPlan) {
                        setConfirmDialog({
                          isOpen: true,
                          message: "Bu sınav planındaki tüm atanan dersleri temizlemek istediğinize emin misiniz? Sınav tarihleri, oturumlar ve sınıf sütunları silinmeyecektir.",
                          onConfirm: () => handleClearPlan(currentPlan.id)
                        });
                      }
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-rose-50 text-xs font-extrabold text-rose-600 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Planı Temizle</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
