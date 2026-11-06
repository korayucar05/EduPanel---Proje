import React from 'react';
import { FileText, MessageSquare, Plus, Save, Search, Trash2, Users, X } from 'lucide-react';

type DisciplineCallModalProps = { ctx: any };

export function DisciplineCallModal({ ctx }: DisciplineCallModalProps) {
  const {
    cagriDate,
    cagriManualWitnessClass,
    cagriManualWitnessName,
    cagriManualWitnessNumber,
    cagriMeetingDate,
    cagriMeetingPlace,
    cagriMeetingTime,
    cagriSelectedStudent,
    cagriSelectedWitnessForAdd,
    cagriShowWitnessSuggestions,
    cagriType,
    cagriWitnessSearchMode,
    cagriWitnessSearchTerm,
    cagriWitnesses,
    filteredWitnessesForSearch,
    handleSaveAndPreviewCagriPusulasi,
    handleSaveCagriPusulasi,
    handleWhatsAppPreview,
    isCagriPusulasiModalOpen,
    selectedRecordForCagri,
    setCagriDate,
    setCagriManualWitnessClass,
    setCagriManualWitnessName,
    setCagriManualWitnessNumber,
    setCagriMeetingDate,
    setCagriMeetingPlace,
    setCagriMeetingTime,
    setCagriSelectedStudent,
    setCagriSelectedWitnessForAdd,
    setCagriShowWitnessSuggestions,
    setCagriType,
    setCagriWitnessSearchMode,
    setCagriWitnessSearchTerm,
    setCagriWitnesses,
    setIsCagriPusulasiModalOpen
  } = ctx;

  return (
    <>
      {isCagriPusulasiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Çağrı Yazısı</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Çağrı Yazısı Oluştur</p>
                </div>
              </div>
              <button
                onClick={() => setIsCagriPusulasiModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Çağrı Türü</label>
                  <select
                    value={cagriType}
                    onChange={(e) => setCagriType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="Öğrenci Çağrı Yazısı">Öğrenci Çağrı Yazısı</option>
                    <option value="Tanık Çağrı Yazısı">Tanık Çağrı Yazısı</option>
                    {selectedRecordForCagri?.recordReason === "Şikayet" && (
                      <option value="Şikayetçi (Mağdur) Çağrı Yazısı">Şikayetçi (Mağdur) Çağrı Yazısı</option>
                    )}
                    <option value="Veli Çağrı Yazısı">Veli Çağrı Yazısı</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Düzenlenme Tarihi</label>
                  <input
                    type="date"
                    value={cagriDate}
                    onChange={(e) => setCagriDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider border-b border-amber-200/50 pb-2">Toplantı Bilgileri</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Toplantı Tarihi</label>
                    <input
                      type="date"
                      value={cagriMeetingDate}
                      onChange={(e) => setCagriMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Toplantı Saati</label>
                    <input
                      type="time"
                      value={cagriMeetingTime}
                      onChange={(e) => setCagriMeetingTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Toplantı Yeri</label>
                    <input
                      type="text"
                      placeholder="Örn: Müdür Odası"
                      value={cagriMeetingPlace}
                      onChange={(e) => setCagriMeetingPlace(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              {cagriType === "Tanık Çağrı Yazısı" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tanık Öğrenci Ekle</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setCagriWitnessSearchMode("search")}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${cagriWitnessSearchMode === "search" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"} cursor-pointer`}
                      >
                        Arama
                      </button>
                      <button
                        type="button"
                        onClick={() => setCagriWitnessSearchMode("manual")}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${cagriWitnessSearchMode === "manual" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"} cursor-pointer`}
                      >
                        El İle Yaz
                      </button>
                    </div>
                  </div>

                  {cagriWitnessSearchMode === "search" ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-left items-end">
                      <div className="md:col-span-9 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="İsim veya okul numarası yazın..."
                          value={cagriWitnessSearchTerm}
                          onFocus={() => setCagriShowWitnessSuggestions(true)}
                          onBlur={() => setTimeout(() => setCagriShowWitnessSuggestions(false), 200)}
                          onChange={(e) => {
                            setCagriWitnessSearchTerm(e.target.value);
                            setCagriShowWitnessSuggestions(true);
                            if (cagriSelectedWitnessForAdd) {
                              setCagriSelectedWitnessForAdd(null);
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-700 font-medium"
                        />
                        {cagriShowWitnessSuggestions && filteredWitnessesForSearch.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                            {filteredWitnessesForSearch.map((student, idx) => {
                              const studentNo = student.number || student.id || "";
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setCagriSelectedWitnessForAdd(student);
                                    setCagriWitnessSearchTerm(`${student.name} (${student.classroom || "Sınıfsız"} - No: ${studentNo})`);
                                    setCagriShowWitnessSuggestions(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors flex items-center justify-between cursor-pointer"
                                >
                                  <span>{student.name}</span>
                                  <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/50">
                                    {student.classroom || "Sınıfsız"} • No: {studentNo}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!cagriSelectedWitnessForAdd) {
                              alert("Lütfen arama listesinden bir öğrenci seçin.");
                              return;
                            }
                            const alreadyExists = cagriWitnesses.some(s => s.id === cagriSelectedWitnessForAdd.id);
                            if (alreadyExists) {
                              alert("Bu öğrenci zaten listeye eklenmiş.");
                              return;
                            }
                            const studentNo = cagriSelectedWitnessForAdd.number || cagriSelectedWitnessForAdd.id || "Belirtilmedi";
                            setCagriWitnesses([
                              ...cagriWitnesses,
                              {
                                id: cagriSelectedWitnessForAdd.id,
                                name: cagriSelectedWitnessForAdd.name,
                                classroom: cagriSelectedWitnessForAdd.classroom || "Belirtilmedi",
                                number: studentNo,
                              }
                            ]);
                            setCagriWitnessSearchTerm("");
                            setCagriSelectedWitnessForAdd(null);
                          }}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/15"
                        >
                          <Plus className="w-4 h-4" />
                          Listeye Ekle
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-left">
                      <div className="md:col-span-4 relative text-left">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Öğrenci Adı Soyadı</label>
                        <input
                          type="text"
                          placeholder="Örn: Ahmet Yılmaz"
                          value={cagriManualWitnessName}
                          onChange={(e) => setCagriManualWitnessName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-700 font-medium"
                        />
                      </div>
                      <div className="md:col-span-3 relative text-left">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Sınıfı</label>
                        <input
                          type="text"
                          placeholder="Örn: 10-A"
                          value={cagriManualWitnessClass}
                          onChange={(e) => setCagriManualWitnessClass(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-700 font-medium font-bold"
                        />
                      </div>
                      <div className="md:col-span-3 relative text-left">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Okul No</label>
                        <input
                          type="text"
                          placeholder="Örn: 1453"
                          value={cagriManualWitnessNumber}
                          onChange={(e) => setCagriManualWitnessNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-700 font-medium font-mono"
                        />
                      </div>
                      <div className="md:col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (!cagriManualWitnessName.trim()) {
                              alert("Lütfen öğrenci adı ve soyadı girin.");
                              return;
                            }
                            const manualId = `manual-${Date.now()}`;
                            const alreadyExists = cagriWitnesses.some(s => s.name.toLocaleLowerCase("tr-TR") === cagriManualWitnessName.trim().toLocaleLowerCase("tr-TR") && s.number === (cagriManualWitnessNumber.trim() || "Belirtilmedi"));
                            if (alreadyExists) {
                              alert("Bu öğrenci zaten listeye eklenmiş.");
                              return;
                            }
                            setCagriWitnesses([
                              ...cagriWitnesses,
                              {
                                id: manualId,
                                name: cagriManualWitnessName.trim(),
                                classroom: cagriManualWitnessClass.trim() || "Belirtilmedi",
                                number: cagriManualWitnessNumber.trim() || "Belirtilmedi",
                              }
                            ]);
                            setCagriManualWitnessName("");
                            setCagriManualWitnessClass("");
                            setCagriManualWitnessNumber("");
                          }}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/15"
                        >
                          <Plus className="w-4 h-4" />
                          Listeye Ekle
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-left mt-4">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Tanık Listesi ({cagriWitnesses.length})</span>
                      {cagriWitnesses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCagriWitnesses([])}
                          className="text-[10px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                        >
                          Tümünü Temizle
                        </button>
                      )}
                    </div>
                    {cagriWitnesses.length === 0 ? (
                      <div className="py-6 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 text-slate-300">
                          <Users className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-medium text-slate-500">Henüz tanık öğrenci eklenmemiş.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-24">Sınıf</th>
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-24">Okul No</th>
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">Adı Soyadı</th>
                              <th className="px-4 py-2 border-b border-slate-200 w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {cagriWitnesses.map((student, idx) => (
                              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-center font-bold text-slate-800">{student.classroom}</td>
                                <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{student.number}</td>
                                <td className="px-4 py-3 font-extrabold text-slate-900">{student.name}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setCagriWitnesses(cagriWitnesses.filter((s, i) => i !== idx))}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : cagriType === "Şikayetçi (Mağdur) Çağrı Yazısı" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Şikayetçi (Mağdur) Öğrenci Listesi</label>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-left">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Şikayetçi Listesi ({selectedRecordForCagri?.complainantStudents?.length || 0})</span>
                    </div>
                    {(!selectedRecordForCagri?.complainantStudents || selectedRecordForCagri.complainantStudents.length === 0) ? (
                      <div className="py-6 px-4 text-center">
                        <p className="text-xs font-medium text-slate-500">Bu olayda kayıtlı şikayetçi öğrenci bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-24">Sınıf</th>
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-24">Okul No</th>
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">Adı Soyadı</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {selectedRecordForCagri.complainantStudents.map((student) => (
                              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-center font-bold text-slate-800">{student.classroom}</td>
                                <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{student.number}</td>
                                <td className="px-4 py-3 font-extrabold text-slate-900">{student.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                selectedRecordForCagri && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Öğrenci Seçimi</label>
                    <select
                      value={cagriSelectedStudent}
                      onChange={(e) => setCagriSelectedStudent(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    >
                      <option value="">Seçiniz (Boş bırakmak için)</option>
                      {selectedRecordForCagri.studentsList?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.classroom})</option>
                      ))}
                      {!selectedRecordForCagri.studentsList && (
                        <option value={selectedRecordForCagri.studentId}>{selectedRecordForCagri.studentName} ({selectedRecordForCagri.studentClassroom})</option>
                      )}
                    </select>
                  </div>
                )
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 rounded-b-3xl">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleSaveCagriPusulasi}
                  className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-amber-600 hover:bg-amber-700 shadow-amber-600/10"
                >
                  <Save className="w-4 h-4" />
                  <span>Kaydet</span>
                </button>
                <span className="text-xs text-slate-400 italic hidden sm:block">Boş bırakılan alanlar çıktıda el ile doldurulmak üzere boş alan olarak ayrılır.</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleWhatsAppPreview}
                  className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 shadow-blue-600/10"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Mesaj Gönder</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndPreviewCagriPusulasi}
                  className="px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF Önizleme</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

