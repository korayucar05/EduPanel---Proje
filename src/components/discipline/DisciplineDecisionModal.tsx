import React from "react";
import { FileText, Printer, X } from "lucide-react";
import type { BehaviorRecord } from "../behavior/behaviorTypes";

interface DisciplineDecisionModalProps {
  open: boolean;
  record: BehaviorRecord | null;
  selectedStudent: string;
  setSelectedStudent: React.Dispatch<React.SetStateAction<string>>;
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSaveAndPrint: () => void | Promise<void>;
}

export function DisciplineDecisionModal({
  open, record: selectedRecordForKarar, selectedStudent: kararSelectedStudent,
  setSelectedStudent: setKararSelectedStudent, data: kararDataState,
  setData: setKararDataState, onClose, onSaveAndPrint: handleSaveAndPrintKarar,
}: DisciplineDecisionModalProps) {
  if (!open || !selectedRecordForKarar) return null;
  return (

        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Okul Ödül ve Disiplin Kurulu Kararı</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Karar formunu doldurun ve kaydedin/yazdırın</p>
                </div>
              </div>
              <button 
                onClick={() => onClose()}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              {selectedRecordForKarar.studentsList && selectedRecordForKarar.studentsList.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İlgili Öğrenci</label>
                  <select
                    value={kararSelectedStudent}
                    onChange={(e) => setKararSelectedStudent(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="">Seçiniz</option>
                    {selectedRecordForKarar.studentsList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.classroom})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Karar No</label>
                  <input
                    type="text"
                    value={kararDataState.kararNo || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, kararNo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Karar Tarihi</label>
                  <input
                    type="date"
                    value={kararDataState.kararTarihi || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, kararTarihi: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Doğum Tarihi</label>
                  <input
                    type="text"
                    value={kararDataState.dogumTarihi || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, dogumTarihi: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">T.C. Kimlik No</label>
                  <input
                    type="text"
                    value={kararDataState.tcNo || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, tcNo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Öğrenim Durumu (Yatılı/Gündüzlü vb.)</label>
                <input
                  type="text"
                  value={kararDataState.ogrenimDurumu || ""}
                  onChange={(e) => setKararDataState({ ...kararDataState, ogrenimDurumu: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Başarı Durumu</label>
                  <input
                    type="text"
                    value={kararDataState.basariDurumu || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, basariDurumu: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sağlık Durumu</label>
                  <input
                    type="text"
                    value={kararDataState.saglikDurumu || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, saglikDurumu: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Ekonomik Durum</label>
                  <input
                    type="text"
                    value={kararDataState.ekonomikDurum || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, ekonomikDurum: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Birlikte Oturma Durumu</label>
                  <input
                    type="text"
                    value={kararDataState.birlikteOturma || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, birlikteOturma: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Anne-Baba Sağ mı?</label>
                  <input
                    type="text"
                    value={kararDataState.anneBabaSag || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, anneBabaSag: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Anne-Baba Öz mü?</label>
                  <input
                    type="text"
                    value={kararDataState.anneBabaOz || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, anneBabaOz: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Ailesi Yanında mı Okuyor?</label>
                  <input
                    type="text"
                    value={kararDataState.ailesiYaninda || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, ailesiYaninda: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Yetiştiği Çevre</label>
                  <input
                    type="text"
                    value={kararDataState.yetistigiCevre || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, yetistigiCevre: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Adres</label>
                <textarea
                  value={kararDataState.adres || ""}
                  onChange={(e) => setKararDataState({ ...kararDataState, adres: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Önceki Cezalar ve Genel Durumu</label>
                <input
                  type="text"
                  value={kararDataState.oncekiCezalar || ""}
                  onChange={(e) => setKararDataState({ ...kararDataState, oncekiCezalar: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Olay Yeri ve Tarihi</label>
                  <input
                    type="text"
                    value={kararDataState.olayYeriTarihi || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, olayYeriTarihi: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Davranışın Çeşidi</label>
                  <input
                    type="text"
                    value={kararDataState.davranisCesidi || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, davranisCesidi: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Davranışın Nedeni</label>
                <textarea
                  value={kararDataState.davranisNedeni || ""}
                  onChange={(e) => setKararDataState({ ...kararDataState, davranisNedeni: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                />
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-700">Olayla İlgili İfadeler ve Deliller</h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Öğrenci İfadesi Özeti</label>
                  <textarea
                    value={kararDataState.ifadeOzeti || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, ifadeOzeti: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Tanıkların İfadesi Özeti</label>
                  <textarea
                    value={kararDataState.tanikOzeti || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, tanikOzeti: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Diğer Deliller</label>
                  <textarea
                    value={kararDataState.digerDeliller || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, digerDeliller: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-700">Hafifleten/Şiddetlendiren Nedenler</h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sınıf Arkadaşları Kanaati</label>
                  <input
                    type="text"
                    value={kararDataState.arkadasKanaati || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, arkadasKanaati: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Öğretmen Kanaati</label>
                  <input
                    type="text"
                    value={kararDataState.ogretmenKanaati || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, ogretmenKanaati: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-700">21. Kurulun Kanaati</h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Madde / Bendi (Örn: 1. fıkrası (a) bendi)</label>
                  <input
                    type="text"
                    value={kararDataState.kurulKanaatiMaddeBendi || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, kurulKanaatiMaddeBendi: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Davranış Karşılığı (Örn: İzinsiz okuldan ayrılmak)</label>
                  <input
                    type="text"
                    value={kararDataState.kurulKanaatiDavranis || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, kurulKanaatiDavranis: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Verilecek Ceza (Örn: Kınama)</label>
                  <input
                    type="text"
                    value={kararDataState.kurulKanaatiCeza || ""}
                    onChange={(e) => setKararDataState({ ...kararDataState, kurulKanaatiCeza: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-700">22. Verilen Cezanın Çeşidi ve Dayandığı Yönetmelik Maddesi</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Madde 12 / (Bendi)</label>
                    <input
                      type="text"
                      value={kararDataState.cezaMaddeBendi || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, cezaMaddeBendi: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Fıkra Numarası</label>
                    <input
                      type="text"
                      value={kararDataState.cezaFikrasi || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, cezaFikrasi: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Kurul Kararı</label>
                <textarea
                  value={kararDataState.kurulKarari || ""}
                  onChange={(e) => setKararDataState({ ...kararDataState, kurulKarari: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[60px]"
                />
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-700">İmza Yetkilileri (Kurul Üyeleri)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">1. Üye (Öğretmen)</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.uye1 || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye1: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Branşı / Unvanı</label>
                    <input
                      type="text"
                      placeholder="Öğretmeni (Örn: Matematik Öğretmeni)"
                      value={kararDataState.uye1Unvan || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye1Unvan: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">2. Üye (Öğretmen)</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.uye2 || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye2: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Branşı / Unvanı</label>
                    <input
                      type="text"
                      placeholder="Öğretmeni (Örn: Kimya Öğretmeni)"
                      value={kararDataState.uye2Unvan || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye2Unvan: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">3. Üye (Okul Aile Birliği Üyesi)</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.uye3 || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye3: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">4. Üye (Onur Kurulu İkinci Başkanı)</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.uye4 || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, uye4: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Okul Disiplin Kurulu Başkanı</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.baskan || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, baskan: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Okul Müdürü</label>
                    <input
                      type="text"
                      placeholder="Adı Soyadı"
                      value={kararDataState.mudur || ""}
                      onChange={(e) => setKararDataState({ ...kararDataState, mudur: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={handleSaveAndPrintKarar}
                className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-purple-600 hover:bg-purple-700 shadow-purple-600/10"
              >
                <Printer className="w-4 h-4" />
                <span>Karar Formunu Kaydet ve Yazdır</span>
              </button>
            </div>
          </div>
        </div>
  );
}
