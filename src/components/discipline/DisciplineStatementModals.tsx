import React from 'react';
import { FileText, Printer, Save, X } from 'lucide-react';

type DisciplineStatementModalsProps = { ctx: any };

const getRecordStudents = (record: any) => {
  if (Array.isArray(record?.studentsList) && record.studentsList.length > 0) {
    return record.studentsList;
  }

  return [{
    id: record?.studentId || "",
    name: record?.studentName || "",
    classroom: record?.studentClassroom || "",
    number: record?.studentNumber || "",
  }];
};

export function DisciplineStatementModals({ ctx }: DisciplineStatementModalsProps) {
  const {
    ifadeKonusu,
    ifadeMetni,
    ifadeOlayTarihi,
    ifadeSelectedStudent,
    ifadeTarihi,
    isIfadeModalOpen,
    isYaziliIfadeModalOpen,
    selectedRecordForIfade,
    selectedRecordForYaziliIfade,
    students,
    setIfadeKonusu,
    setIfadeMetni,
    setIfadeOlayTarihi,
    setIfadeSelectedStudent,
    setIfadeTarihi,
    setIsIfadeModalOpen,
    setIsYaziliIfadeModalOpen,
    setYaziliIfadeDilekceTarihi,
    setYaziliIfadeKonusu,
    setYaziliIfadeMetni,
    setYaziliIfadeOlayTarihi,
    setYaziliIfadeSaati,
    setYaziliIfadeSelectedStudent,
    setYaziliIfadeTarih,
    setYaziliIfadeTarihi,
    setYaziliIfadeTuru,
    setYaziliIfadeYeri,
    yaziliIfadeDilekceTarihi,
    yaziliIfadeKonusu,
    yaziliIfadeMetni,
    yaziliIfadeOlayTarihi,
    yaziliIfadeSaati,
    yaziliIfadeSelectedStudent,
    yaziliIfadeTarih,
    yaziliIfadeTarihi,
    yaziliIfadeTuru,
    yaziliIfadeYeri,
    handleSaveAndPrintIfade,
    handleSaveYaziliIfadeOnly,
    handleSaveAndPreviewYaziliIfade
  } = ctx;

  return (
    <>
      {isIfadeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Öğrenci İfade Tutanağı Formu</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Öğrenci İfadesi Formu Oluştur</p>
                </div>
              </div>
              <button 
                onClick={() => setIsIfadeModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {selectedRecordForIfade && getRecordStudents(selectedRecordForIfade).length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfadesi Alınacak Öğrenci</label>
                  <select
                    value={ifadeSelectedStudent}
                    onChange={(e) => setIfadeSelectedStudent(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {getRecordStudents(selectedRecordForIfade).map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.classroom} - No: {student.number || student.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Olay Tarihi</label>
                  <input
                    type="date"
                    value={ifadeOlayTarihi}
                    onChange={(e) => setIfadeOlayTarihi(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfade Tarihi</label>
                  <input
                    type="date"
                    value={ifadeTarihi}
                    onChange={(e) => setIfadeTarihi(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfadenin Konusu</label>
                <input
                  type="text"
                  value={ifadeKonusu}
                  onChange={(e) => setIfadeKonusu(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="İfadenin konusunu yazınız..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Öğrenci İfadesi (Opsiyonel)</label>
                <textarea
                  value={ifadeMetni}
                  onChange={(e) => setIfadeMetni(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[120px] resize-none"
                  placeholder="Eğer ifade sistem üzerinden girilecekse buraya yazabilirsiniz. Boş bırakılırsa çıktı üzerinde el ile yazılması için boş çizgiler bırakılır..."
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 italic">Boş bırakılan alanlar çıktıda el ile doldurulmak üzere boş alan olarak ayrılır.</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsIfadeModalOpen(false)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer"
                >
                  İptal Et
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndPrintIfade}
                  className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
                >
                  <Printer className="w-4 h-4" />
                  <span>Kaydet ve Yazdır</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yazılı İfadeler Modali */}
      {isYaziliIfadeModalOpen && selectedRecordForYaziliIfade && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Yazılı İfade Tutanağı Formu</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Öğrenci, Şikayetçi ve Tanık İfade Formları</p>
                </div>
              </div>
              <button 
                onClick={() => setIsYaziliIfadeModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {/* İfade Türü & Tarih (Yanyana) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfade Türü</label>
                  <select
                    value={yaziliIfadeTuru}
                    onChange={(e) => setYaziliIfadeTuru(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="Öğrenci İfadesi">Öğrenci İfadesi</option>
                    {selectedRecordForYaziliIfade?.recordReason === "Şikayet" && (
                      <option value="Şikayetçi (Mağdur) Öğrenci İfadesi">Şikayetçi (Mağdur) Öğrenci İfadesi</option>
                    )}
                    <option value="Tanık İfadesi">Tanık İfadesi</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tarih</label>
                  <input
                    type="date"
                    value={yaziliIfadeTarih}
                    onChange={(e) => setYaziliIfadeTarih(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Öğrenci Seçimi */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfadesi Alınacak Kişi</label>
                {(() => {
                  let studentsList: any[] = [];
                  if (yaziliIfadeTuru === "Öğrenci İfadesi") {
                    studentsList = getRecordStudents(selectedRecordForYaziliIfade);
                  } else if (yaziliIfadeTuru === "Şikayetçi (Mağdur) Öğrenci İfadesi") {
                    studentsList = selectedRecordForYaziliIfade.complainantStudents || [];
                  } else if (yaziliIfadeTuru === "Tanık İfadesi") {
                    studentsList = selectedRecordForYaziliIfade.cagriData?.["witnesses"]?.witnesses || [];
                  }

                  if (studentsList.length === 0) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium">
                        {yaziliIfadeTuru === "Tanık İfadesi" 
                          ? "Çağrı yazısı adımından eklenen tanık öğrenci bulunamadı. Lütfen önce Çağrı Yazısı adımından tanık öğrencileri ekleyiniz." 
                          : "Bu olayda bu türde kayıtlı bir öğrenci bulunmamaktadır."}
                      </div>
                    );
                  }

                  return (
                    <select
                      value={yaziliIfadeSelectedStudent}
                      onChange={(e) => setYaziliIfadeSelectedStudent(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      {studentsList.map((student, idx) => {
                        const val = student.id || student.name;
                        return (
                          <option key={val || idx} value={val}>
                            {student.name} ({student.classroom || "Sınıf Belirtilmedi"} - No: {student.number || "No Belirtilmedi"})
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>

              {/* İfade Bilgileri Bölümü */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">İfade Bilgileri</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">İfade Tarihi</label>
                    <input
                      type="date"
                      value={yaziliIfadeTarihi}
                      onChange={(e) => setYaziliIfadeTarihi(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">İfade Saati</label>
                    <input
                      type="text"
                      placeholder="Örn: 10:30"
                      value={yaziliIfadeSaati}
                      onChange={(e) => setYaziliIfadeSaati(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Olay Tarihi (Fiilin İşlendiği Tarih)</label>
                    <input
                      type="date"
                      value={yaziliIfadeOlayTarihi}
                      onChange={(e) => setYaziliIfadeOlayTarihi(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Dilekçe / Şikayet Tarihi</label>
                    <input
                      type="date"
                      value={yaziliIfadeDilekceTarihi}
                      onChange={(e) => setYaziliIfadeDilekceTarihi(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">İfade Yeri</label>
                  <input
                    type="text"
                    placeholder="Örn: Disiplin Kurulu Odası"
                    value={yaziliIfadeYeri}
                    onChange={(e) => setYaziliIfadeYeri(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* İfadenin Konusu */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfadenin Konusu</label>
                <input
                  type="text"
                  value={yaziliIfadeKonusu}
                  onChange={(e) => setYaziliIfadeKonusu(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="İfadenin konusunu yazınız..."
                />
              </div>

              {/* İfade Metni */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">İfade Metni (Opsiyonel)</label>
                <textarea
                  value={yaziliIfadeMetni}
                  onChange={(e) => setYaziliIfadeMetni(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[120px] resize-none"
                  placeholder="Eğer ifade sistem üzerinden girilecekse buraya yazabilirsiniz. Boş bırakılırsa çıktı üzerinde el ile yazılması için boş çizgiler bırakılır..."
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleSaveYaziliIfadeOnly}
                className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-slate-600 hover:bg-slate-700 shadow-slate-600/10"
              >
                <Save className="w-4 h-4" />
                <span>Kaydet</span>
              </button>
              <span className="text-[11px] text-slate-400 italic hidden sm:inline">Boş bırakılan alanlar çıktıda el ile doldurulmak üzere boş alan olarak ayrılır.</span>
              <button
                type="button"
                onClick={handleSaveAndPreviewYaziliIfade}
                className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-purple-600 hover:bg-purple-700 shadow-purple-600/10"
              >
                <FileText className="w-4 h-4" />
                <span>PDF Önizleme</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
