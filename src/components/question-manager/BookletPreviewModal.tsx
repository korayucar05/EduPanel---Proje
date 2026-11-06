import React from "react";
import { BookOpen, Download, X } from "lucide-react";

interface BookletPreviewModalProps {
  exam: any;
  previewBookletKey: string | null;
  onClose: () => void;
  onDownload: (bookletKey: string) => void | Promise<void>;
  getPrintedQuestionIndex: (exam: any, bookletKey: string, targetNum1Based: number, subjectName: string, count: number) => number;
  getQuestionIndexForBooklet: (bookletName: string, index: number, count: number) => number;
}

export default function BookletPreviewModal({
  exam, previewBookletKey, onClose, onDownload, getPrintedQuestionIndex, getQuestionIndexForBooklet,
}: BookletPreviewModalProps) {
  if (previewBookletKey === null) return null;
  return (
  <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex p-4 sm:p-6 items-center justify-center overflow-y-auto">
    <div className="bg-slate-100 w-full max-w-[1250px] h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200">
      {/* Modal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <BookOpen className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              {previewBookletKey.toUpperCase()} KİTAPÇIĞI ÖN İZLEME
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {exam.examName} — Düzen & Çıktı Kontrolü
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDownload(previewBookletKey)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            PDF İndir
          </button>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Preview Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 flex flex-col items-center">
        {/* Cover Page */}
        <div className="bg-white w-full max-w-[800px] aspect-[1/1.414] shadow-xl border border-slate-250 rounded-2xl overflow-hidden relative p-8 flex flex-col justify-between shrink-0">
          {exam.bookletCovers?.[previewBookletKey] ? (
            <img
              src={exam.bookletCovers[previewBookletKey]}
              alt="Cover"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <>
              {/* Mockup Cover design */}
              <div className="border-4 border-slate-900 h-full p-8 flex flex-col justify-between">
                <div className="text-center space-y-4">
                  <span className="text-sm font-black text-slate-500 tracking-wider">
                    {exam.publisherName?.toUpperCase() || "SAYGIN YAYINCILIK"}
                  </span>
                  <div className="h-0.5 bg-slate-950 w-24 mx-auto font-bold"></div>
                </div>

                <div className="text-center space-y-6">
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none px-4">
                    {exam.examName.toUpperCase()}
                  </h1>
                  <p className="text-base font-bold text-slate-500 uppercase tracking-widest">
                    {exam.examType} - {exam.gradeLevel} SINAVI
                  </p>
                </div>

                <div className="flex justify-center my-6">
                  <div className="border-8 border-slate-900 w-28 h-28 flex items-center justify-center font-black text-6xl text-slate-900 rounded-2xl bg-slate-50 shadow-md">
                    {previewBookletKey.toUpperCase()}
                  </div>
                </div>

                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 pb-8">
                  <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider text-center border-b pb-2">
                    Öğrenci Bilgileri & Kurallar
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-500">Adı:</span>
                        <div className="border-b-2 border-slate-300 flex-1"></div>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-500">Soyadı:</span>
                        <div className="border-b-2 border-slate-300 flex-1"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-500">Sınıfı:</span>
                        <div className="border-b-2 border-slate-300 flex-1"></div>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-500">No:</span>
                        <div className="border-b-2 border-slate-300 flex-1"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-5 text-center leading-tight font-medium">
                    Bu kitapçıkta toplam {
                      (exam.examStructure || []).reduce(
                        (total: number, test: any) =>
                          total +
                          test.subjects.reduce(
                            (sum: number, sub: any) => sum + sub.count,
                            0,
                          ),
                        0,
                      )
                    } soru bulunmaktadır. Sınav süresi {exam.duration || 40} dakikadır. Başarılar dileriz.
                  </p>
                </div>
              </div>
            </>
          )}
          {/* Visual page indicator banner */}
          <div className="absolute bottom-2 right-4 text-[10px] font-bold text-slate-400 font-mono">SAYFA 1 / KAPAK</div>
        </div>

        {/* Inner Questions pages - Two Column layout simulation */}
        <div className="bg-white w-full max-w-[800px] shadow-xl border border-slate-200 rounded-2xl p-6 relative flex flex-col justify-start shrink-0 min-h-[90vh]">
          <div className="border-b-2 border-slate-100 pb-3 mb-4 flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider font-sans">
            <span>{exam.examName}</span>
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{previewBookletKey.toUpperCase()} KİTAPÇIĞI</span>
          </div>

          <div className="grid grid-cols-2 gap-6 flex-1 relative">
            {/* Subtle divider line */}
            <div className="absolute top-0 bottom-0 left-1/2 -ml-[1px] w-[2px] bg-slate-100"></div>

            {/* Inside left column simulation */}
            <div className="space-y-6">
              <h3 className="bg-slate-100 text-slate-800 text-[11px] font-black px-3 py-1.5 rounded-lg border border-slate-200 text-center uppercase tracking-wider mb-4">
                Sınav Soruları (Sol Sütun)
              </h3>
              {(() => {
                let globalQNum = 0;
                return (exam.examStructure || []).map((test: any) => {
                  return test.subjects.map((subj: any) => {
                    const subjectName = subj.name;
                    const questionsForSubject = exam.questions?.[subjectName] || {};
                    
                    return Array.from({ length: subj.count }).map((_, i) => {
                      globalQNum++;
                      // Only render odd numbered questions in left column for visual layout look
                      if (globalQNum % 2 === 0) return null;

                      const qIndexForBooklet = exam.examSource === "Basılı Yayın" ? getPrintedQuestionIndex(exam, previewBookletKey, i + 1, subj.name, subj.count) : getQuestionIndexForBooklet(previewBookletKey, i, subj.count);
                      const q = questionsForSubject[qIndexForBooklet];

                      return (
                        <div key={`${subjectName}-${i}`} className="space-y-2 border-b border-dashed border-slate-100 pb-4 last:border-0">
                          <span className="bg-slate-800 text-white font-extrabold text-[10px] px-2 py-0.5 rounded inline-block">
                            {globalQNum}
                          </span>
                          {q && q.imageUrl ? (
                            <img 
                              src={q.imageUrl} 
                              alt={`Soru ${globalQNum}`} 
                              referrerPolicy="no-referrer"
                              className="w-full max-h-[220px] object-contain rounded border border-slate-100 shadow-xs" 
                            />
                          ) : (
                            <div className="border border-dashed border-slate-350 bg-slate-50 rounded-lg p-4 text-center">
                              <span className="text-[10px] text-slate-400 font-medium font-sans">Soru henüz yüklenmemiştir</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                  });
                });
              })()}
            </div>

            {/* Inside right column simulation */}
            <div className="space-y-6">
              <h3 className="bg-slate-100 text-slate-800 text-[11px] font-black px-3 py-1.5 rounded-lg border border-slate-200 text-center uppercase tracking-wider mb-4">
                Sınav Soruları (Sağ Sütun)
              </h3>
              {(() => {
                let globalQNum = 0;
                return (exam.examStructure || []).map((test: any) => {
                  return test.subjects.map((subj: any) => {
                    const subjectName = subj.name;
                    const questionsForSubject = exam.questions?.[subjectName] || {};
                    
                    return Array.from({ length: subj.count }).map((_, i) => {
                      globalQNum++;
                      // Only render even numbered questions in right column
                      if (globalQNum % 2 !== 0) return null;

                      const qIndexForBooklet = exam.examSource === "Basılı Yayın" ? getPrintedQuestionIndex(exam, previewBookletKey, i + 1, subj.name, subj.count) : getQuestionIndexForBooklet(previewBookletKey, i, subj.count);
                      const q = questionsForSubject[qIndexForBooklet];

                      return (
                        <div key={`${subjectName}-${i}`} className="space-y-2 border-b border-dashed border-slate-100 pb-4 last:border-0">
                          <span className="bg-slate-800 text-white font-extrabold text-[10px] px-2 py-0.5 rounded inline-block">
                            {globalQNum}
                          </span>
                          {q && q.imageUrl ? (
                            <img 
                              src={q.imageUrl} 
                              alt={`Soru ${globalQNum}`} 
                              referrerPolicy="no-referrer"
                              className="w-full max-h-[220px] object-contain rounded border border-slate-100 shadow-xs" 
                            />
                          ) : (
                            <div className="border border-dashed border-slate-300 bg-slate-50 rounded-lg p-4 text-center">
                              <span className="text-[10px] text-slate-400 font-medium font-sans">Soru henüz yüklenmemiştir</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                  });
                });
              })()}
            </div>
          </div>

          {/* Footer bar */}
          <div className="mt-8 border-t-2 border-slate-100 pt-3 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            <span>{exam.publisherName || "Sınav Kitapçığı"}</span>
            <span>SAYFA 2 / İÇERİK</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

