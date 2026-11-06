import React from "react";
import { MessageCircle, X } from "lucide-react";
import type { BehaviorRecord } from "./behaviorTypes";
import type { Student } from "../../types";

interface Props {
  record: BehaviorRecord | null;
  students: Student[];
  onClose: () => void;
  onMarkSent: (record: BehaviorRecord) => Promise<void> | void;
}

export function BehaviorWhatsAppModal({ record, students, onClose, onMarkSent }: Props) {
  if (!record) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#25D366]" />WhatsApp Bildirimi Gönder</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500">Bu olayda birden fazla öğrenci bulunmaktadır. Lütfen WhatsApp bildirimi göndermek istediğiniz öğrencinin velisini seçiniz:</p>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {(record.studentsList || []).map((std) => {
            const studentObj = students.find(s => s.id === std.id);
            const parentName = studentObj?.parentName || "Veli";
            const parentPhone = studentObj?.parentPhone || "Kayıtlı Değil";
            const hasPhone = Boolean(studentObj?.parentPhone);
            return (
              <div key={std.id} className="p-3 border border-slate-150 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                <div className="text-left"><div className="font-bold text-slate-800 text-sm">{std.name}</div><div className="text-xs text-slate-500">{std.classroom} • {parentName} ({parentPhone})</div></div>
                <button disabled={!hasPhone} onClick={() => {
                  if (!studentObj?.parentPhone) return;
                  const text = `Sayın Veli,\n\nÖğrencimiz ${std.name}, ${new Date(record.date).toLocaleDateString("tr-TR")} tarihinde okulumuzda '${record.behaviorName}' ${record.behaviorType === "Olumlu" ? "davranışını sergileyerek örnek olmuştur." : record.behaviorType === "Olumsuz" ? "davranışını sergilemiştir." : "durumu ile gözlemlenmiştir."}\n\n${record.behaviorType === "Olumlu" ? "Öğrencimizi bu olumlu davranışından dolayı tebrik eder, destekleriniz için teşekkür ederiz." : "Öğrencimizin gelişimine destek olmak adına bu durumu bilgilerinize sunarız."}\n\nİyi çalışmalar dileriz.\n\n${record.teacherName || "Okul Yönetimi"}\nÖğretmen`;
                  const cleanPhone = studentObj.parentPhone.replace(/\D/g, "");
                  const a = document.createElement("a");
                  a.href = `https://api.whatsapp.com/send?phone=90${cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(text)}`;
                  a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }} className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${hasPhone ? "bg-[#25D366] text-white hover:bg-[#20ba56] cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}><MessageCircle className="w-3.5 h-3.5" />Gönder</button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2"><button onClick={() => onMarkSent(record)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer">Gönderildi Olarak İşaretle & Kapat</button></div>
      </div>
    </div>
  );
}
