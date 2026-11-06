import React from "react";
import { X, Calendar } from "lucide-react";

const normalizeExamTypeLabel = (value: unknown) => {
  const key = String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  if (["branş deneme", "branş denemesi", "branch deneme", "branch denemesi", "ders deneme", "ders denemesi"].includes(key)) return "Ders Denemesi";
  if (["ünite tarama", "ünite taraması", "unite tarama", "unite taramasi", "ünite deneme", "ünite denemesi"].includes(key)) return "Ünite Denemesi";
  return String(value || "");
};

export default function ExamDefinitionModal(props: any) {
  const {
    EXAM_STATUS_OPTIONS, PDF_TEMPLATE_OPTIONS, availableOpticForms, availableTargetClassrooms, bookletType, createResultPdf, deleteEditingExam, editingExamId, examCode, examDate, examName, examSource, examStatus, examStructure, examType, generateExamCode, getTotalQuestionCount, gradeLevel, handleExamTypeChange, handleSave, handleSubjectCountChange, includeSubjectAnalysis, institutionName, isFormValid, isSavingExam, opticForm, pdfTemplate, publisherName, resultFilePattern, saveError, sendToParents, sendToStudents, setBookletType, setCreateResultPdf, setExamCode, setExamDate, setExamName, setExamSource, setExamStatus, setGradeLevel, setIncludeSubjectAnalysis, setInstitutionName, setIsModalOpen, setOpticForm, setPdfTemplate, setPublisherName, setResultFilePattern, setSendToParents, setSendToStudents, setShowClassRank, setShowSchoolRank, setShowTurkeyRank, showClassRank, showSchoolRank, showTurkeyRank, targetAudience, targetClassrooms, toggleTargetClassroom, updateTargetClassrooms
  } = props;
  const normalizedExamType = normalizeExamTypeLabel(examType);
  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h3 className="font-extrabold text-slate-800 text-lg">
            {editingExamId ? "Sınavı Güncelle" : "Yeni Sınav Tanımla"}
          </h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
    
        <form onSubmit={handleSave} className="space-y-6">
          {/* Sınav Bilgisi */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Sınav Bilgisi (Kaynak) *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="examSource"
                  value="Sistem"
                  checked={examSource === "Sistem"}
                  onChange={(e) => setExamSource(e.target.value)}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Sistem Sınavı
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="examSource"
                  value="Basılı Yayın"
                  checked={examSource === "Basılı Yayın"}
                  onChange={(e) => setExamSource(e.target.value)}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Basılı Yayın
                </span>
              </label>
            </div>
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sınav Türü */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Sınav Türü *
              </label>
              <select
                value={normalizedExamType}
                onChange={handleExamTypeChange}
                className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
              >
                <option value="TYT">TYT</option>
                <option value="AYT">AYT</option>
                <option value="Ders Denemesi">Ders Denemesi</option>
              </select>
            </div>
    
            {/* Sınıf Düzeyi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Sınıf Düzeyi *
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => {
                  setGradeLevel(e.target.value);
                  setExamCode(generateExamCode(normalizedExamType, e.target.value));
                  updateTargetClassrooms([]);
                }}
                className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
              >
                <option value="9">9. Sınıf</option>
                <option value="10">10. Sınıf</option>
                <option value="11">11. Sınıf</option>
                <option value="12">12. Sınıf</option>
                <option value="YKS">YKS</option>
              </select>
            </div>
    
            {/* Kitapçık */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Kitapçık Seçeneği *
              </label>
              <select
                value={bookletType}
                onChange={(e) => setBookletType(e.target.value)}
                className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
              >
                <option value="A">Tek Kitapçık (A)</option>
                <option value="A-B">İki Kitapçık (A-B)</option>
                <option value="A-B-C-D">Dört Kitapçık (A-B-C-D)</option>
              </select>
            </div>
    
            {/* Optik Form Seçimi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Optik Form Seçimi *
              </label>
              <select
                value={opticForm}
                onChange={(e) => setOpticForm(e.target.value)}
                className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
              >
                {availableOpticForms.length > 0 ? (
                  availableOpticForms.map((form) => (
                    <option key={form.id} value={form.name}>
                      {form.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Standart 120 Soru">
                      Standart 120 Soru Formu
                    </option>
                    <option value="Standart 160 Soru">
                      Standart 160 Soru Formu
                    </option>
                    <option value="Ders Denemesi">Ders Denemesi Formu</option>
                  </>
                )}
              </select>
            </div>
    
            {/* Sınav Tarihi */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Sınav Tarihi ve Saati *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="datetime-local"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700"
                />
              </div>
            </div>
          </div>
    
          {/* Sınavın Adı Bölümü (2 Alan) */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">
              Sınav Adı Bilgileri
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Yayın / Kurum Adı *
                </label>
                <input
                  type="text"
                  placeholder="Örn: 3D Yayınları"
                  value={publisherName}
                  onChange={(e) => setPublisherName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Sınav Adı / Numarası *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Türkiye Geneli Deneme 1"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700"
                />
              </div>
            </div>
          </div>
    
          {/* Kurumsal ve Süreç Bilgileri */}
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4">
            <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-widest">
              Kurumsal ve Süreç Bilgileri
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Sınav Kodu *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                    required
                    className="w-full px-4 py-3 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setExamCode(generateExamCode(examType, gradeLevel))}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700"
                  >
                    Üret
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Uygulayan Kurum *
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium text-slate-700"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Hedef Kitle - {gradeLevel === "YKS" ? "12. Sınıf / YKS" : `${gradeLevel}. Sınıf`} Şubeleri
                  </label>
                  {availableTargetClassrooms.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateTargetClassrooms(availableTargetClassrooms.map((item: any) => item.name))}
                        className="text-[10px] font-black text-emerald-700 hover:text-emerald-900"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => updateTargetClassrooms([])}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-700"
                      >
                        Temizle
                      </button>
                    </div>
                  )}
                </div>
    
                {availableTargetClassrooms.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-emerald-300 bg-white p-3 sm:grid-cols-3 md:grid-cols-4">
                    {availableTargetClassrooms.map((classroom: any) => {
                      const checked = targetClassrooms.includes(classroom.name);
                      return (
                        <label
                          key={classroom.id || classroom.name}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                            checked
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTargetClassroom(classroom.name)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                          />
                          <span className="truncate">{classroom.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    {gradeLevel === "YKS" ? "12. sınıf" : `${gradeLevel}. sınıf`} düzeyinde tanımlı şube bulunamadı. Önce Sınıflar alanından şube oluşturunuz.
                  </div>
                )}
    
                {targetClassrooms.length > 0 && (
                  <p className="text-[10px] font-bold text-emerald-700">
                    Seçilen şubeler: {targetAudience}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Sınav Durumu
                </label>
                <select
                  value={examStatus}
                  onChange={(e) => setExamStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {EXAM_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
    
          {/* Sonuç Bildirim ve PDF Ayarları */}
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-4">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-widest">
              Sonuç Bildirim ve PDF Ayarları
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">PDF Şablonu</label>
                <select
                  value={pdfTemplate}
                  onChange={(e) => setPdfTemplate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {PDF_TEMPLATE_OPTIONS.map((template) => (
                    <option key={template} value={template}>{template}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Sonuç Dosyası Adlandırması</label>
                <input
                  type="text"
                  value={resultFilePattern}
                  onChange={(e) => setResultFilePattern(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium text-slate-700"
                />
                <p className="text-[10px] font-semibold text-slate-500">Kullanılabilir alanlar: {'{YIL}'}, {'{SINAV_KODU}'}, {'{OGR_ADI}'}, {'{OGR_NO}'}, {'{SINIF}'}</p>
              </div>
            </div>
    
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { checked: createResultPdf, setter: setCreateResultPdf, label: "Sonuç PDF'i oluştur" },
                { checked: sendToParents, setter: setSendToParents, label: "Velilere WhatsApp ile gönder" },
                { checked: sendToStudents, setter: setSendToStudents, label: "Öğrencilere WhatsApp ile gönder" },
                { checked: includeSubjectAnalysis, setter: setIncludeSubjectAnalysis, label: "Ders bazlı analiz oluştur" },
                { checked: showSchoolRank, setter: setShowSchoolRank, label: "Okul sıralamasını göster" },
                { checked: showClassRank, setter: setShowClassRank, label: "Sınıf sıralamasını göster" },
                { checked: showTurkeyRank, setter: setShowTurkeyRank, label: "Türkiye geneli sıralamayı göster" },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.setter(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
    
          {/* Sınav Bölümleri ve Soru Sayısı */}
          {(normalizedExamType === "TYT" || normalizedExamType === "AYT" || normalizedExamType === "Ders Denemesi") &&
            examStructure.length > 0 && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center justify-between">
                  <span>Sınav Soru Dağılımı ({normalizedExamType})</span>
                  <span className="text-purple-700 bg-purple-100 px-2 py-1 rounded-lg text-[10px]">
                    Toplam Soru:{" "}
                    {examStructure.reduce(
                      (total, test) =>
                        total +
                        test.subjects.reduce(
                          (sum: number, sub: any) => sum + sub.count,
                          0,
                        ),
                      0,
                    )}
                  </span>
                </h4>
                {normalizedExamType === "Ders Denemesi" && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800">
                    Sınavda kullanılacak derslerin soru sayılarını girin. Soru sayısı 0 bırakılan dersler sınava dahil edilmez.
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {examStructure.map((test, testIndex) => (
                    <div
                      key={testIndex}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                        <h5 className="font-bold text-slate-700 text-xs">
                          {test.testName}
                        </h5>
                      </div>
                      <div className="p-3 space-y-2">
                        {test.subjects.map(
                          (subject: any, subjectIndex: number) => (
                            <div
                              key={subjectIndex}
                              className="flex items-center justify-between"
                            >
                              <span className="text-xs font-medium text-slate-600 truncate mr-2">
                                {subject.name}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={subject.count}
                                onChange={(e) =>
                                  handleSubjectCountChange(
                                    testIndex,
                                    subjectIndex,
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
    
          {!isFormValid && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              {normalizedExamType === "Ders Denemesi" && getTotalQuestionCount(examStructure) === 0
                ? "Ders denemesini kaydetmek için en az bir dersin soru sayısını 1 veya daha büyük girin."
                : "Kaydetmek için Sınav Adı, Yayın/Kurum Adı, Sınav Tarihi, Kurum Adı ve Sınav Kodu alanlarını doldurun."}
            </div>
          )}
          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {saveError}
            </div>
          )}
    
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={editingExamId ? deleteEditingExam : () => setIsModalOpen(false)}
              className={`flex-1 py-3.5 font-bold rounded-xl text-sm transition-colors ${
                editingExamId
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {editingExamId ? "Sınavı Sil" : "İptal"}
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSavingExam}
              className={`flex-1 py-3.5 font-bold rounded-xl text-[16.67px] transition-colors ${
                isFormValid && !isSavingExam
                  ? "bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isSavingExam ? "Kaydediliyor..." : editingExamId ? "Sınavı Güncelle" : "Sınavı Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
