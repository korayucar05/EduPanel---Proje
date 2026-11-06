import React from "react";
import { ArrowLeft, FileDown, FileText, Info, Loader2, Printer, X } from "lucide-react";

type RankedListsModalProps = {
  open: boolean;
  activeExam: any;
  sortedCalculatedResults: any[];
  pdfLoading: boolean;
  pdfGeneratingOption: string | null;
  onClose: () => void;
  onGeneratePDF: (option: string, classFilter?: string) => void | Promise<void>;
};

export function RankedListsModal({
  open,
  activeExam,
  sortedCalculatedResults,
  pdfLoading,
  pdfGeneratingOption,
  onClose,
  onGeneratePDF,
}: RankedListsModalProps) {
  if (!open) return null;
  const distinctClasses = Array.from(
    new Set(sortedCalculatedResults.map((r) => r.classroom || "Sınıfsız")),
  )
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true, sensitivity: "base" }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in" onClick={() => !pdfLoading && onClose()} />
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-xl w-full max-h-[90vh] overflow-y-auto relative z-10 p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-250">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1 pr-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Printer className="w-5 h-5 text-orange-600" />
              Sıralı Liste Döküm Merkezi
            </h3>
            <p className="text-xs text-slate-500 font-bold leading-normal">
              Sınav: <span className="text-orange-850 font-black">{activeExam?.publisherName ? `${activeExam.publisherName} - ` : ""}{activeExam?.examName}</span>
            </p>
          </div>
          <button disabled={pdfLoading} onClick={onClose} className="p-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {pdfLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
            <Loader2 className="w-12 h-12 text-orange-650 animate-spin" />
            <div className="space-y-1.5 px-6">
              <h4 className="font-extrabold text-slate-800 text-sm">Sıralı Liste PDF Dosyası Hazırlanıyor</h4>
              <p className="text-xs text-slate-500 font-bold max-w-sm">{pdfGeneratingOption} hazırlanıyor ve özel Türkçe yazı tipleri indiriliyor. Lütfen sayfayı kapatmayınız...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Genel Kurum Raporları</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button onClick={() => onGeneratePDF("KURUM_GENEL")} className="p-4 rounded-2xl border border-slate-200/80 hover:border-orange-200 bg-slate-50/50 hover:bg-orange-50/20 text-left transition-all hover:scale-[1.01] flex flex-col justify-between h-32 group cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-black group-hover:scale-110 transition-transform"><FileText className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-black text-slate-800">Kurum Genel Sıralı Liste</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5 leading-snug">Kurumdaki tüm öğrencileri genel net sıralamasına göre listeler.</p></div>
              </button>
              <button onClick={() => onGeneratePDF("KURUM_SIRALI")} className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/30 text-left transition-all hover:scale-[1.01] flex flex-col justify-between h-32 group cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-slate-200/80 text-slate-700 flex items-center justify-center font-black group-hover:scale-110 transition-transform"><FileDown className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-black text-slate-800">Kurum Sıralı Liste</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5 leading-snug">Öğrencilerin sınıf içi ve kurum içi genel sıralarını yan yana dökümler.</p></div>
              </button>
              <button onClick={() => onGeneratePDF("TUM_SINIFLAR_AYRI_KAGIT")} className="p-4 rounded-2xl border border-rose-150 hover:border-rose-300 bg-rose-50/10 hover:bg-rose-50/30 text-left transition-all hover:scale-[1.01] flex flex-col justify-between h-36 group cursor-pointer sm:col-span-2">
                <span className="self-end px-2 py-0.5 rounded-full bg-rose-100 text-[8px] font-black text-rose-800 uppercase tracking-wider">Ayrı Sayfalar</span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-black group-hover:scale-110 transition-transform -mt-4"><Printer className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-black text-slate-800">Tüm Sınıflar Sıralı Liste</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5 leading-snug">Her sınıfın sıralı listesini ayrı sayfalar halinde tek PDF dosyasında birleştirir.</p></div>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Şubelere Göre Bireysel Listeler</span>
              {distinctClasses.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-medium italic">Sınav kapsamında şube/sınıf bilgisi bulunmamaktadır.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {distinctClasses.map((clsName) => (
                    <button key={String(clsName)} onClick={() => onGeneratePDF("TEK_SINIF", String(clsName))} className="p-2.5 rounded-xl border border-slate-150 bg-slate-50/40 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-black text-center cursor-pointer transition-colors hover:border-slate-300 flex items-center justify-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />{String(clsName)} Listesi
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-slate-50 border p-3 rounded-2xl text-[10px] text-slate-500 leading-normal font-bold">ℹ️ <strong>Doğru Kodlama İpucu:</strong> PDF ve listeler Türkçe karakter duyarlı, A4 yazıcı standardında hazırlanır.</div>
          </div>
        )}
      </div>
    </div>
  );
}

type ReturnWarningModalProps = {
  open: boolean;
  returning: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ReturnWarningModal({ open, returning, onCancel, onConfirm }: ReturnWarningModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Info className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-black text-slate-900">UYARI</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Sınav Hazırla ekranına döndüğünüzde seçili sınava ait değerlendirme, analiz ve rapor sonuçları geri alınacak; TXT/optik değerlendirme kayıtları temizlenecektir.</p>
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-800">Siz onay vermeden sınav bilgilerinde hiçbir değişiklik yapılmayacaktır.</p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={returning} className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:opacity-50">İptal</button>
          <button type="button" onClick={onConfirm} disabled={returning} className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-amber-950 hover:bg-amber-400 disabled:opacity-50">
            {returning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}Onayla ve Sınav Hazırla'ya Dön
          </button>
        </div>
      </div>
    </div>
  );
}
