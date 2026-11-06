import React, { useRef } from "react";
import { Download, Heart, X } from "lucide-react";
import { toPng } from "html-to-image";
import type { BehaviorRecord } from "./behaviorTypes";

interface BehaviorInfoNoteModalProps {
  record: BehaviorRecord | null;
  onClose: () => void;
}

export function BehaviorInfoNoteModal({ record, onClose }: BehaviorInfoNoteModalProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  if (!record) return null;

  const tone = record.behaviorType === "Olumlu" ? "emerald" : record.behaviorType === "Olumsuz" ? "rose" : "amber";
  const stripClass = tone === "emerald" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500" : "bg-amber-500";
  const iconClass = tone === "emerald" ? "bg-emerald-50 text-emerald-500" : tone === "rose" ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500";
  const messageClass = tone === "emerald" ? "bg-emerald-50 text-emerald-800" : tone === "rose" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800";

  const download = async () => {
    if (!noteRef.current) return;
    try {
      const dataUrl = await toPng(noteRef.current, { quality: 1, backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Bilgi_Notu_${record.studentName.replace(/\s+/g, "_")}.png`;
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Görsel oluşturulurken bir hata oluştu.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Heart className="w-5 h-5 text-teal-600" />Veli Bilgi Notu</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-8 bg-slate-50 flex justify-center">
          <div ref={noteRef} className="relative w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
            <div className={`h-2 w-full ${stripClass}`} />
            <div className="p-8">
              <div className="flex justify-center mb-6"><div className={`w-16 h-16 rounded-full flex items-center justify-center ${iconClass}`}><Heart className="w-8 h-8" /></div></div>
              <div className="text-center space-y-6">
                <div><h4 className="font-bold text-slate-800 text-lg mb-1">Sayın Veli,</h4><p className="text-sm font-medium text-slate-500">{new Date(record.date).toLocaleDateString("tr-TR")} Tarihli Bilgilendirme</p></div>
                <div className="text-slate-700 text-sm leading-relaxed">Öğrencimiz <span className="font-bold text-slate-900">{record.studentName}</span>, okulumuzda <span className="font-bold text-slate-900">'{record.behaviorName}'</span> {record.behaviorType === "Olumlu" ? "davranışını sergileyerek örnek olmuştur." : record.behaviorType === "Olumsuz" ? "davranışını sergilemiştir." : "durumu ile gözlemlenmiştir."}</div>
                <div className={`text-sm font-medium p-4 rounded-xl ${messageClass}`}>{record.behaviorType === "Olumlu" ? "Öğrencimizi bu olumlu davranışından dolayı tebrik eder, destekleriniz için teşekkür ederiz." : "Öğrencimizin gelişimine destek olmak adına bu durumu bilgilerinize sunarız."}</div>
                <div className="pt-4 border-t border-slate-100"><p className="font-bold text-slate-800 text-sm">{record.teacherName}</p><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">Öğretmen</p></div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">Kapat</button>
          <button onClick={download} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all flex items-center gap-2"><Download className="w-4 h-4" />PNG Olarak İndir</button>
        </div>
      </div>
    </div>
  );
}
