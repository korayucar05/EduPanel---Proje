import React from "react";
import { Link, X } from "lucide-react";
import { isValidMhatsappNumber, loadMhatsappSettings, normalizeMhatsappNumber, sendTextMessage } from "../../lib/mhatsappApi";



type LinkItem = { name: string; url: string; phone?: string };

type Props = {
  open: boolean;
  items: LinkItem[];
  sendingName: string;
  onSendingNameChange: (name: string) => void;
  onClose: () => void;
};

export function TeacherBehaviorLinkModal({ open, items, sendingName, onSendingNameChange, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Link className="w-5 h-5 text-teal-600" />Öğretmen Davranış Linkleri</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {items.length > 0 ? (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3 animate-slide-up max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between sticky top-0 bg-teal-50 pb-2 z-10">
                <p className="text-xs font-bold text-teal-800">Öğretmenlere Özel Güvenli Linkler ({items.length})</p>
                <button onClick={() => { navigator.clipboard.writeText(items.map(u => `${u.name}:\n${u.url}`).join("\n\n")); alert("Tüm linkler kopyalandı!"); }} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-sm">Tümünü Kopyala</button>
              </div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-700">{item.name}</p>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={item.url} className="flex-1 bg-white border border-teal-200 rounded-lg px-3 py-1.5 text-[10px] text-slate-600 outline-none" />
                      <button onClick={() => { navigator.clipboard.writeText(item.url); alert(`${item.name} için link kopyalandı!`); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded-lg text-[10px] font-bold cursor-pointer shrink-0">Kopyala</button>
                      <button
                        disabled={sendingName === item.name}
                        onClick={async () => {
                          const phone = normalizeMhatsappNumber(item.phone || "");
                          if (!isValidMhatsappNumber(phone)) return alert(`${item.name} için geçerli telefon numarası bulunamadı.`);
                          const settings = loadMhatsappSettings();
                          if (!settings.token?.trim()) return alert("WhatsApp API tokenı Mesaj Araçları alanından kaydedilmelidir.");
                          onSendingNameChange(item.name);
                          try {
                            const teacherMessage =
                              `Sayın ${item.name},\n\n` +
                              `e-Nstitü Öğretmen davranış kayıt ekranınız hazırdır.\n` +
                              `Okul öğrencileri için olumlu veya olumsuz davranış kaydı oluşturmak üzere aşağıdaki kişisel bağlantınızı kullanabilirsiniz.\n\n` +
                              `${item.url}\n\n` +
                              `Bu bağlantı yalnızca öğretmen davranış kaydı içindir.`;

                            const maskedPhone =
                              phone.length >= 10
                                ? `${phone.slice(0, 4)}••••${phone.slice(-4)}`
                                : phone;

                            const approved = window.confirm(
                              `ÖĞRETMEN DAVRANIŞ LİNKİ GÖNDERİM ONAYI\n\n` +
                              `Alıcı: ${item.name}\n` +
                              `Telefon: ${maskedPhone}\n\n` +
                              `Gönderilecek içerik yalnızca öğretmen davranış bağlantısıdır.\n` +
                              `Öğrenci/veli akademik raporu gönderilmeyecektir.\n\n` +
                              `Gönderilsin mi?`
                            );
                            if (!approved) return;

                            const result = await sendTextMessage(settings, [phone], teacherMessage);

                            if (!result.ok) throw new Error(result.error || "Bağlantı gönderilemedi.");
                            alert(`Öğretmen davranış bağlantısı ${item.name} öğretmenine gönderildi.\nAlıcı: ${maskedPhone}`);
                          } catch (error: any) { alert(error?.message || "Bağlantı gönderilemedi."); }
                          finally { onSendingNameChange(""); }
                        }}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >{sendingName === item.name ? "Gönderiliyor" : "WhatsApp"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="p-8 text-center text-slate-500 text-sm font-medium">Öğretmen listesi bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}
