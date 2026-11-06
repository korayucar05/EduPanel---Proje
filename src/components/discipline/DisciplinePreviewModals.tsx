import React from "react";
import { FileText, MessageSquare, Printer, X } from "lucide-react";
import { exportHtmlPdf } from '../../pdf/adapters/HtmlPdfAdapter';
import type { BehaviorRecord } from "../behavior/behaviorTypes";

interface DisciplinePreviewModalsProps {
  isWhatsAppPreviewOpen: boolean;
  setIsWhatsAppPreviewOpen: (value: boolean) => void;
  whatsAppMessageText: string;
  setWhatsAppMessageText: (value: string) => void;
  cagriPrintPreviewContent: string | null;
  setCagriPrintPreviewContent: (value: string | null) => void;
  selectedRecordForCagri: BehaviorRecord | null;
  cagriSelectedStudent: string;
  cagriType: string;
  handleActualCagriPrint: () => void;
  yaziliIfadePrintPreviewContent: string | null;
  setYaziliIfadePrintPreviewContent: (value: string | null) => void;
  yaziliIfadeSelectedStudent: string;
  handleActualYaziliIfadePrint: () => void;
  warningLetterPrintPreviewContent: string | null;
  setWarningLetterPrintPreviewContent: (value: string | null) => void;
  selectedWarningForLetter: BehaviorRecord | null;
  setSelectedWarningForLetter: (value: BehaviorRecord | null) => void;
  getRecordStudents: (record: BehaviorRecord) => any[];
  toggleLetterSent: (recordId: string) => void;
  printLetter: (record: BehaviorRecord) => void;
  isToplantiBilgileriModalOpen: boolean;
  setIsToplantiBilgileriModalOpen: (value: boolean) => void;
  toplantiBilgileriStudent: string;
  toplantiBilgileriMeetingWith: string;
  setToplantiBilgileriMeetingWith: (value: string) => void;
  toplantiBilgileriDate: string;
  setToplantiBilgileriDate: (value: string) => void;
  toplantiBilgileriTime: string;
  setToplantiBilgileriTime: (value: string) => void;
}

export function DisciplinePreviewModals(props: DisciplinePreviewModalsProps) {
  const {
    isWhatsAppPreviewOpen, setIsWhatsAppPreviewOpen, whatsAppMessageText, setWhatsAppMessageText,
    cagriPrintPreviewContent, setCagriPrintPreviewContent, selectedRecordForCagri, cagriSelectedStudent,
    cagriType, handleActualCagriPrint, yaziliIfadePrintPreviewContent, setYaziliIfadePrintPreviewContent,
    yaziliIfadeSelectedStudent, handleActualYaziliIfadePrint, warningLetterPrintPreviewContent,
    setWarningLetterPrintPreviewContent, selectedWarningForLetter, setSelectedWarningForLetter,
    getRecordStudents, toggleLetterSent, printLetter, isToplantiBilgileriModalOpen,
    setIsToplantiBilgileriModalOpen, toplantiBilgileriStudent, toplantiBilgileriMeetingWith,
    setToplantiBilgileriMeetingWith, toplantiBilgileriDate, setToplantiBilgileriDate,
    toplantiBilgileriTime, setToplantiBilgileriTime,
  } = props;

  return (
    <>
      {/* WhatsApp Önizleme Modali */}
      {isWhatsAppPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-[#25D366]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-inner">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">WhatsApp Davetiye Önizlemesi</h3>
                  <p className="text-xs text-[#25D366] font-bold mt-0.5">Mesaj içeriğini düzenleyip gönderebilirsiniz</p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppPreviewOpen(false)}
                className="p-2 hover:bg-[#25D366]/20 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Mesaj İçeriği</label>
              <textarea
                value={whatsAppMessageText}
                onChange={(e) => setWhatsAppMessageText(e.target.value)}
                className="w-full h-64 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 resize-none font-sans"
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsWhatsAppPreviewOpen(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessageText)}`;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
                  setIsWhatsAppPreviewOpen(false);
                }}
                className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer bg-[#25D366] hover:bg-[#20b858] shadow-[#25D366]/10"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp'ta Gönder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Çağrı Yazısı Önizleme Modali */}
      {cagriPrintPreviewContent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Yazdır - Ön İzleme</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Çağrı yazısını yazdırabilirsiniz</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const element = document.getElementById("cagri-preview-container");
                    if (element) {
                      let stdName = "";
                      if (selectedRecordForCagri) {
                        const std = selectedRecordForCagri.studentsList?.find(s => s.id === cagriSelectedStudent);
                        if (std) {
                          stdName = std.name;
                        } else {
                          stdName = selectedRecordForCagri.studentName || "";
                        }
                      }
                      const filename = `Cagri_Yazisi_${(stdName || cagriType).replace(/\s+/g, "_")}.pdf`;
                      void exportHtmlPdf(element, {
                        filename,
                        title: 'Çağrı Yazısı',
                        pageSize: 'A5',
                        orientation: 'portrait',
                        margins: [28, 28, 28, 28],
                      });
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-blue-600/10"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF İndir</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleActualCagriPrint();
                    setCagriPrintPreviewContent(null);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-emerald-600/10"
                >
                  <Printer className="w-4 h-4" />
                  <span>PDF Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCagriPrintPreviewContent(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer ml-2 relative z-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
              <div id="cagri-preview-container" className="bg-white mx-auto" dangerouslySetInnerHTML={{ __html: cagriPrintPreviewContent }} />
            </div>
          </div>
        </div>
      )}

      {/* Yazılı İfade Önizleme Modali */}
      {yaziliIfadePrintPreviewContent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Yazılı İfade Tutanağı - Ön İzleme</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Öğrenci ifade tutanağını yazdırabilirsiniz</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const element = document.getElementById("yazili-ifade-preview-container");
                    if (element) {
                      void exportHtmlPdf(element, {
                        filename: `Yazili_Ifade_Tutanagi_${yaziliIfadeSelectedStudent || "Ogrenci"}.pdf`,
                        title: 'Yazılı İfade Tutanağı',
                        pageSize: 'A4',
                        orientation: 'portrait',
                        margins: [28, 28, 28, 28],
                      });
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-blue-600/10"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF İndir</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleActualYaziliIfadePrint();
                    setYaziliIfadePrintPreviewContent(null);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-emerald-600/10"
                >
                  <Printer className="w-4 h-4" />
                  <span>PDF Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setYaziliIfadePrintPreviewContent(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer ml-2 relative z-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
              <div id="yazili-ifade-preview-container" className="bg-white mx-auto" dangerouslySetInnerHTML={{ __html: yaziliIfadePrintPreviewContent }} />
            </div>
          </div>
        </div>
      )}

      {/* Yazılı Uyarı Mektubu Önizleme Modali */}
      {warningLetterPrintPreviewContent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Yazılı Uyarı Mektubu - Ön İzleme</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Öğrenci uyarı mektubunu yazdırabilir veya indirebilirsiniz</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const element = document.getElementById("warning-letter-preview-container");
                    if (element && selectedWarningForLetter) {
                      const students = getRecordStudents(selectedWarningForLetter);
                      const filename = students.length === 1 
                        ? `Uyari_Mektubu_${students[0].name.replace(/\s+/g, "_")}.pdf`
                        : `Uyari_Mektubu_Toplu_${students.length}_Ogrenci.pdf`;
                      void exportHtmlPdf(element, {
                        filename,
                        title: 'Öğrenci Uyarı Mektubu',
                        pageSize: 'A4',
                        orientation: 'portrait',
                        margins: [28, 28, 28, 28],
                      });
                      if (!selectedWarningForLetter.letterSent) {
                        toggleLetterSent(selectedWarningForLetter.id);
                      }
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-blue-600/10"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF İndir</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedWarningForLetter) {
                      printLetter(selectedWarningForLetter);
                      if (!selectedWarningForLetter.letterSent) {
                        toggleLetterSent(selectedWarningForLetter.id);
                      }
                      setWarningLetterPrintPreviewContent(null);
                      setSelectedWarningForLetter(null);
                    }
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center gap-2 cursor-pointer shadow-emerald-600/10"
                >
                  <Printer className="w-4 h-4" />
                  <span>PDF Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWarningLetterPrintPreviewContent(null);
                    setSelectedWarningForLetter(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer ml-2 relative z-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
              <div id="warning-letter-preview-container" className="bg-white mx-auto" dangerouslySetInnerHTML={{ __html: warningLetterPrintPreviewContent }} />
            </div>
          </div>
        </div>
      )}

      {/* Toplantı Bilgileri Modali */}
      {isToplantiBilgileriModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Toplantı Bilgileri</h3>
                  <p className="text-xs text-blue-600 font-bold mt-0.5">Toplantı detaylarını görüntüleyin</p>
                </div>
              </div>
              <button
                onClick={() => setIsToplantiBilgileriModalOpen(false)}
                className="p-2 hover:bg-blue-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Olumsuz Davranışın Sahibi Öğrenci</label>
                <input
                  type="text"
                  value={toplantiBilgileriStudent}
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Kimle Görüşülecek</label>
                <input
                  type="text"
                  value={toplantiBilgileriMeetingWith}
                  onChange={(e) => setToplantiBilgileriMeetingWith(e.target.value)}
                  placeholder="Örn: Veli, Sınıf Öğretmeni..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Toplantı Tarihi</label>
                  <input
                    type="date"
                    value={toplantiBilgileriDate}
                    onChange={(e) => setToplantiBilgileriDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Toplantı Saati</label>
                  <input
                    type="time"
                    value={toplantiBilgileriTime}
                    onChange={(e) => setToplantiBilgileriTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsToplantiBilgileriModalOpen(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs cursor-pointer shadow-blue-600/10"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
