import React from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { examReadEditService } from "../../modules/exam";

const hasCompleteClassInfo = (record: any) => {
  const value = String(record?.gradeLevel || "").trim();
  const hasGrade = /\d+/.test(value);
  const hasSection = Boolean(String(record?.section || "").trim()) || /\d+\s*[-/ ]?\s*[A-Za-zÇĞİÖŞÜçğıöşü]+/.test(value);
  return hasGrade && hasSection;
};

const studentNumberOf = (student: any) => {
  const candidates = [
    student?.studentNumber,
    student?.studentNo,
    student?.schoolNumber,
    student?.schoolNo,
    student?.number,
    student?.okulNo,
    student?.ogrenciNo,
    student?.["öğrenciNo"],
    student?.numara,
    student?.no,
  ];
  const explicit = candidates.find(
    (candidate) => candidate !== undefined && candidate !== null && String(candidate).trim(),
  );
  return explicit === undefined ? String(student?.id ?? "").trim() : String(explicit).trim();
};

type Props = {
  exam: any;
  allStudents: any[];
  studentRecords: any[];
  setStudentRecords: React.Dispatch<React.SetStateAction<any[]>>;
  txtUploadOption: "replace" | "append" | null;
  setTxtUploadOption: React.Dispatch<React.SetStateAction<"replace" | "append" | null>>;
  txtFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleTxtFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  saveStudentRecords: (records: any[]) => void | Promise<void>;
  showToast: (message: string) => void;
  getSmartSuggestionsForStudent: (name: string) => any[];
  handleUpdateStudentField: (id: string, field: string, value: string) => void;
  selectedStudentRecords: string[];
  setSelectedStudentRecords: React.Dispatch<React.SetStateAction<string[]>>;
  handleDeleteStudent: (id: string) => void;
  handleDeleteSelectedStudents: () => void;
  filterErrorType: "Tüm" | "Kitapçık" | "Öğrenci No" | "Sınıf";
  getRecordValidation: (record: any) => { hasMismatch: boolean; reasons: string[] };
};

export default function QuestionReadEditPanel({
  exam,
  allStudents,
  studentRecords,
  setStudentRecords,
  txtUploadOption,
  setTxtUploadOption,
  txtFileInputRef,
  handleTxtFileChange,
  saveStudentRecords,
  showToast,
  getSmartSuggestionsForStudent,
  handleUpdateStudentField,
  selectedStudentRecords,
  setSelectedStudentRecords,
  handleDeleteStudent,
  handleDeleteSelectedStudents,
  filterErrorType,
  getRecordValidation,
}: Props) {
  return (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full items-center">
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer flex-1 sm:flex-none ${
                  txtUploadOption === "replace"
                    ? "border-green-600 bg-green-50/30 shadow-xs"
                    : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                }`}
              >
                <input
                  type="radio"
                  name="txtUploadOption"
                  value="replace"
                  checked={txtUploadOption === "replace"}
                  onChange={() => setTxtUploadOption("replace")}
                  className="text-green-600 focus:ring-green-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-extrabold text-slate-800 text-xs block whitespace-nowrap">Önceki Dosyaları Sil ve Yeni Dosya Ekle</span>
              </label>

              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer flex-1 sm:flex-none ${
                  txtUploadOption === "append"
                    ? "border-green-600 bg-green-50/30 shadow-xs"
                    : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                }`}
              >
                <input
                  type="radio"
                  name="txtUploadOption"
                  value="append"
                  checked={txtUploadOption === "append"}
                  onChange={() => setTxtUploadOption("append")}
                  className="text-green-600 focus:ring-green-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-extrabold text-slate-800 text-xs block whitespace-nowrap">Önceki Dosyanın Üzerine Ekle</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                id="txt-file-uploader"
                type="file"
                accept=".txt"
                ref={txtFileInputRef}
                onChange={handleTxtFileChange}
                className="hidden"
              />
              <button
                id="btn-upload-txt"
                onClick={() => {
                  if (!txtUploadOption) {
                    showToast("Dosya yüklemek için lütfen önce seçeneklerden birini belirleyin!");
                    return;
                  }
                  txtFileInputRef.current?.click();
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap ${
                  !txtUploadOption
                    ? "bg-slate-300 hover:bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                TXT Dosyası Yükle
              </button>
              <button
                id="btn-save-students"
                onClick={() => saveStudentRecords(studentRecords)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          {studentRecords.length > 0 && (
            <div id="student-records-stats" className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam Öğrenci</span>
                <span className="text-lg font-extrabold text-slate-800">{studentRecords.length}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Eksik Öğrenci No</span>
                <span className={`text-lg font-extrabold ${studentRecords.filter(r => !r.studentNumber).length > 0 ? "text-red-600 font-black" : "text-green-600"}`}>
                  {studentRecords.filter(r => !r.studentNumber).length}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Eksik Sınıf / Şube</span>
                <span className={`text-lg font-extrabold ${studentRecords.filter(r => !hasCompleteClassInfo(r)).length > 0 ? "text-red-600 font-black" : "text-green-600"}`}>
                  {studentRecords.filter(r => !hasCompleteClassInfo(r)).length}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Eksik Kitapçık türü</span>
                <span className={`text-lg font-extrabold ${studentRecords.filter(r => !r.bookletType).length > 0 ? "text-red-600 font-black" : "text-green-600"}`}>
                  {studentRecords.filter(r => !r.bookletType).length}
                </span>
              </div>
            </div>
          )}

          {/* Akıllı Asistan Paneli */}
          {(() => {
            const missingNoRecords = studentRecords.filter(r => !r.studentNumber && r.studentName);
            if (missingNoRecords.length === 0) return null;

            // Find how many have computable suggestions
            const computableSuggestionsCount = missingNoRecords.filter(r => getSmartSuggestionsForStudent(r.studentName).length > 0).length;

            return (
              <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-100/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md border border-emerald-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 Turkish">
                        Akıllı Eksik Öğrenci No Asistanı 💡
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        Öğrenci numarası boş olan <strong className="text-emerald-700">{missingNoRecords.length} öğrenci</strong> bulundu. Sistemdeki kayıtlı öğrenciler taranarak <strong className="text-indigo-700">{computableSuggestionsCount} öğrenci</strong> için ad soyad eşleşmeli numara önerileri hazırlandı!
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => {
                        let filledCount = 0;
                        const updated = studentRecords.map(rec => {
                          if (!rec.studentNumber && rec.studentName) {
                            const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                            if (suggestions.length === 1 || (suggestions.length > 1 && suggestions[0])) {
                              const bestMatch = suggestions[0];
                              filledCount++;
                              return {
                                ...rec,
                                studentNumber: studentNumberOf(bestMatch),
                                gradeLevel: bestMatch.classroom || rec.gradeLevel,
                                studentName: bestMatch.name || rec.studentName
                              };
                            }
                          }
                          return rec;
                        });
                        setStudentRecords(updated);
                        showToast(`Akıllı Asistan ${filledCount} eşleşmeyi otomatik tamamladı!`);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      disabled={computableSuggestionsCount === 0}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Tüm Güvenli Eşleşmeleri Doldur
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {missingNoRecords.slice(0, 6).map((rec) => {
                    const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                    return (
                      <div key={rec.id} className="bg-white border border-slate-200 p-3.5 rounded-xl text-left flex flex-col justify-between hover:border-emerald-300 transition-colors shadow-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-450 mb-1">
                            TXT Satır No: #{studentRecords.findIndex(r => r.id === rec.id) + 1}
                          </div>
                          <div className="font-extrabold text-slate-800 text-xs truncate" title={rec.studentName}>
                            🔍 {rec.studentName || "Bilinmeyen İsim"}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                          {suggestions.length === 0 ? (
                            <div className="text-[10px] font-bold text-slate-400">
                              ⚠️ Sistem de öğrenci kaydı bulunamadı
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-[9px] uppercase font-extrabold text-emerald-600 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3 text-emerald-500" />
                                Olası Eşleşmeler:
                              </div>
                              {suggestions.map((s: any) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    handleUpdateStudentField(rec.id, "studentNumber", studentNumberOf(s));
                                    if (s.classroom) {
                                      handleUpdateStudentField(rec.id, "gradeLevel", s.classroom);
                                    }
                                    if (s.name) {
                                      handleUpdateStudentField(rec.id, "studentName", s.name);
                                    }
                                    showToast(`${s.name} isimli öğrenci bilgileri uygulandı.`);
                                  }}
                                  className="w-full text-left bg-emerald-50/30 hover:bg-emerald-50 border border-emerald-100/50 hover:border-emerald-200 p-1.5 rounded-lg flex items-center justify-between text-[11px] font-medium transition-colors cursor-pointer group"
                                >
                                  <div>
                                    <span className="font-mono font-bold text-slate-900">No: {studentNumberOf(s)}</span>
                                    <p className="text-slate-600 text-[10px] font-semibold truncate max-w-[140px]">{s.name}</p>
                                  </div>
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    Eşleştir
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {missingNoRecords.length > 6 && (
                    <div className="bg-emerald-50/50 border border-emerald-100 border-dashed p-4 rounded-xl flex items-center justify-center text-center text-xs font-bold text-emerald-700">
                      ve {missingNoRecords.length - 6} daha fazla kayıt eksik...
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div id="student-table-container" className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse table-auto relative">
                <thead className="sticky top-0 bg-slate-50 z-20 shadow-xs">
                  <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-4 py-3.5 w-44">Öğrenci Numarası *</th>
                    <th className="px-4 py-3.5 w-36">Sınıf Düzeyi / Şube *</th>
                    <th className="px-4 py-3.5 w-36">Kitapçık Türü *</th>
                    <th className="px-4 py-3.5">Öğrenci Adı Soyadı</th>
                    <th className="px-4 py-3.5">Cevap Anahtarı Karşılıkları</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer text-indigo-600 focus:ring-indigo-500 rounded border-slate-300"
                          title="Tümünü Seç / Kaldır"
                          checked={studentRecords.length > 0 && selectedStudentRecords.length === studentRecords.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentRecords(studentRecords.map((r) => r.id));
                            } else {
                              setSelectedStudentRecords([]);
                            }
                          }}
                        />
                        {selectedStudentRecords.length > 0 && (
                          <button
                            onClick={handleDeleteSelectedStudents}
                            className="text-[9px] text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100"
                            title="Seçilenleri Sil"
                          >
                            Tümünü Sil ({selectedStudentRecords.length})
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {studentRecords
                    .filter(rec => {
                      if (filterErrorType === "Tüm") return true;
                      if (filterErrorType === "Kitapçık") return !rec.bookletType;
                      if (filterErrorType === "Öğrenci No") return !String(rec.studentNumber || "").trim();
                      if (filterErrorType === "Sınıf") return !hasCompleteClassInfo(rec);
                      return true;
                    })
                    .map((rec) => {
                      const originalIndex = studentRecords.findIndex(r => r.id === rec.id);
                      const isNumMissing = !String(rec.studentNumber || "").trim();
                      const isGradeMissing = !hasCompleteClassInfo(rec);
                      const isBookletMissing = !rec.bookletType;
                      const hasRequiredIdentityMissing = isNumMissing || isGradeMissing;
                      const validation = getRecordValidation(rec);
                      const hasRedMismatch =
                        hasRequiredIdentityMissing ||
                        validation.hasMismatch;

                      return (
                        <tr
                          key={rec.id}
                          className={`transition-colors ${
                            hasRedMismatch
                              ? "bg-red-100/90 ring-1 ring-inset ring-red-300 hover:bg-red-100"
                              : "hover:bg-slate-50/40"
                          }`}
                          title={
                            validation.reasons.length > 0
                              ? validation.reasons.join(" ")
                              : hasRequiredIdentityMissing
                              ? "Öğrenci numarası veya sınıf/şube bilgisi eksik."
                              : undefined
                          }
                        >
                          <td className="px-4 py-2 text-center font-bold text-slate-400">
                            {originalIndex + 1}
                          </td>
                          <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.studentNumber || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "studentNumber", e.target.value)}
                            placeholder="BOŞ - (Zorunlu)"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all focus:outline-none focus:ring-1 ${
                              isNumMissing
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                          {isNumMissing && rec.studentName && (() => {
                            const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                            if (suggestions.length === 0) return null;
                            return (
                              <div className="mt-1.5 space-y-1 block max-w-xs">
                                <div className="text-[9px] font-black text-emerald-600 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
                                  <span>Öneri:</span>
                                </div>
                                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                  {suggestions.map((s: any) => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        handleUpdateStudentField(rec.id, "studentNumber", studentNumberOf(s));
                                        if (s.classroom) {
                                          handleUpdateStudentField(rec.id, "gradeLevel", s.classroom);
                                        }
                                        if (s.name) {
                                          handleUpdateStudentField(rec.id, "studentName", s.name);
                                        }
                                        showToast(`${s.name} isimli öğrenci bilgileri uygulandı.`);
                                      }}
                                      className="text-[10px] bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 hover:border-emerald-200 text-emerald-800 font-bold px-2 py-1 rounded text-left transition-all flex items-center justify-between cursor-pointer"
                                      title="Öneriyi Uygula"
                                    >
                                      <span>
                                        No: <span className="font-mono text-emerald-950">{studentNumberOf(s)}</span>
                                        <span className="ml-1 text-[9px] text-slate-500 italic font-normal">({s.name} - {s.classroom})</span>
                                      </span>
                                      <span className="text-[8px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-sm shrink-0">Seç</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.gradeLevel || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "gradeLevel", e.target.value)}
                            placeholder="BOŞ - (Zorunlu)"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold transition-all focus:outline-none focus:ring-1 ${
                              isGradeMissing
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                          {isGradeMissing && (
                            <span className="mt-1 block text-[9px] font-black text-red-700">
                              Sınıf düzeyi ve şube bilgisi zorunludur.
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.bookletType || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "bookletType", e.target.value.toUpperCase())}
                            placeholder="BOŞ - (Zorunlu)"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all focus:outline-none focus:ring-1 uppercase ${
                              isBookletMissing
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.studentName || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "studentName", e.target.value)}
                            placeholder="Ad Soyad girin"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.answers || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "answers", e.target.value.toUpperCase())}
                            placeholder="Örn: ABCDE..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono transition-all focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedStudentRecords.includes(rec.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentRecords((prev) => [...prev, rec.id]);
                                } else {
                                  setSelectedStudentRecords((prev) =>
                                    prev.filter((id) => id !== rec.id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <button
                              onClick={() => handleDeleteStudent(rec.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-red-100"
                              title="Öğrenciyi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Çelişkiler ve Çakışmalar Alanı */}
            {(() => {
              const reconciliation = examReadEditService.reconcile(exam, studentRecords, allStudents);
              const conflictMap = new Map(reconciliation.conflicts.map((item) => [item.recordId, item.reasons]));
              const rows = reconciliation.records.map((record, index) => ({
                record,
                index,
                reasons: conflictMap.get(record.id) || [],
              }));

              const conflictCount = reconciliation.conflicts.length;
              const matchedCount = reconciliation.matchedCount;
              const hasRecords = rows.length > 0;

              return (
                <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className={`w-6 h-6 ${conflictCount > 0 ? "text-red-500" : "text-emerald-500"}`} />
                        Çelişkiler ve Çakışmalar
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        TXT dosyasındaki tüm öğrenci satırları ve sistem eşleştirme sonuçları aşağıda gösterilir.
                      </p>
                    </div>
                    <button
                      onClick={() => saveStudentRecords(studentRecords)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      <Save className="w-4 h-4" />
                      Değişiklikleri Kaydet
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-500">TXT Satırı</div>
                      <div className="text-xl font-black text-slate-900">{rows.length}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="text-[10px] font-bold uppercase text-emerald-700">Sistemle Eşleşen</div>
                      <div className="text-xl font-black text-emerald-800">{matchedCount}</div>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <div className="text-[10px] font-bold uppercase text-red-700">Sorunlu Satır</div>
                      <div className="text-xl font-black text-red-800">{conflictCount}</div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="text-[10px] font-bold uppercase text-blue-700">Sorunsuz Satır</div>
                      <div className="text-xl font-black text-blue-800">{rows.length - conflictCount}</div>
                    </div>
                  </div>

                  {!hasRecords ? (
                    <div className="mt-5 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl p-8 text-center">
                      <p className="text-sm font-semibold text-slate-500">Henüz TXT öğrenci kaydı yüklenmedi.</p>
                    </div>
                  ) : (
                    <div className="mt-5 overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full min-w-[900px] text-left text-xs bg-white">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-3 w-14">Satır</th>
                            <th className="px-3 py-3">Öğrenci No</th>
                            <th className="px-3 py-3">Adı Soyadı</th>
                            <th className="px-3 py-3">Sınıf / Şube</th>
                            <th className="px-3 py-3">Kitapçık</th>
                            <th className="px-3 py-3">Durum / Çelişki</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map(({ record, index, reasons }) => (
                            <tr key={record.id || index} className={reasons.length ? "bg-red-50/70" : "bg-emerald-50/30"}>
                              <td className="px-3 py-3 font-bold text-slate-500">{index + 1}</td>
                              <td className="px-3 py-3 font-mono font-black text-slate-900">{record.studentNumber || "—"}</td>
                              <td className="px-3 py-3 font-bold text-slate-800">{record.studentName || "—"}</td>
                              <td className="px-3 py-3 font-semibold text-slate-700">{record.gradeLevel || "—"}</td>
                              <td className="px-3 py-3 font-black text-slate-700">{record.bookletType || "—"}</td>
                              <td className="px-3 py-3">
                                {reasons.length ? (
                                  <div className="space-y-1">
                                    {reasons.map((reason, reasonIndex) => (
                                      <div key={reasonIndex} className="flex items-start gap-1.5 text-red-700 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                        <span>{reason}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Sistem kaydıyla eşleşti, çelişki yok.
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

        </div>
      
  );
}
