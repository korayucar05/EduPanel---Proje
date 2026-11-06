import React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { getQuestionCorrectAnswer } from "../../utils/questionAnswer";

interface QuestionDetailModalProps {
  exam: any;
  activeQuestion: any;
  activeSubject: any;
  currentQuestionData: any;
  currentSubjectName: string;
  questionCount: number;
  curriculumTree: any[];
  expandedUnit: string | null;
  setExpandedUnit: (value: string | null) => void;
  expandedTopic: string | null;
  setExpandedTopic: (value: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  handleDeleteQuestion: () => void | Promise<void>;
  handleModalClose: () => void;
  handlePrevQuestion: () => void;
  handleNextQuestion: () => void;
  updateQuestionData: (field: string, value: any) => void | Promise<void>;
  handleCurriculumSelect: (unit: string, topic?: string, outcome?: string) => void | Promise<void>;
}

export default function QuestionDetailModal(props: QuestionDetailModalProps) {
  const { exam, activeQuestion, activeSubject, currentQuestionData, currentSubjectName, questionCount, curriculumTree, expandedUnit, setExpandedUnit, expandedTopic, setExpandedTopic, fileInputRef, handleFileUpload, handleDeleteQuestion, handleModalClose, handlePrevQuestion, handleNextQuestion, updateQuestionData, handleCurriculumSelect } = props;
  if (activeQuestion === null || exam.examSource === "Basılı Yayın") return null;
  return (
  <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex p-4 sm:p-8 items-center justify-center">
    <div className="bg-white w-full h-full max-w-[1600px] flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-2xl relative">
      <button
        onClick={handleModalClose}
        className="absolute right-4 top-4 z-50 bg-white/50 hover:bg-white text-slate-700 p-2 rounded-full transition-colors backdrop-blur-md shadow-sm"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Viewer Area */}
      <div className="flex-1 bg-slate-100 relative flex items-center justify-center p-8 group">
        {exam.examSource === "Basılı Yayın" ? (
          <div className="text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl space-y-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <FileText className="w-10 h-10 text-red-650" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">
                Basılı Yayın Modu
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
                Bu sınav <strong className="text-slate-800">Basılı Yayın</strong> tipinde hazırlandığı için, optik cevapları ve kazanımları işlemek amacıyla soru görseli yüklenmesi veya soru havuzundan seçme yapılmasına gerek yoktur.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2.5 text-left text-xs">
              <div className="flex items-center gap-2 text-slate-705">
                <span className="w-5 h-5 bg-red-50 text-red-700 font-bold rounded-lg flex items-center justify-center">1</span>
                <span>Sağ menüden bu sorunun müfredat kazanım bilgisini girin.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-705">
                <span className="w-5 h-5 bg-red-50 text-red-700 font-bold rounded-lg flex items-center justify-center">2</span>
                <span>Soru için doğru cevap seçeneğini (A, B, C, D, E) belirleyin.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-705">
                <span className="w-5 h-5 bg-red-50 text-red-700 font-bold rounded-lg flex items-center justify-center">3</span>
                <span>Varsa diğer kitapçıklardaki (A-B-C-D) çapraz soru sıralamasını belirleyin.</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
              DEĞİŞİKLİKLER ANLIK OLARAK KAYDEDİLMEKTEDİR
            </div>
          </div>
        ) : currentQuestionData?.duplicateMessage ? (
          <div className="text-center p-8 bg-red-50 rounded-3xl border border-red-200 shadow-xl max-w-lg">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-red-700 mb-2">
              Çakışma Tespit Edildi
            </h3>
            <p className="text-red-600 font-bold text-lg">
              {currentQuestionData.duplicateMessage}
            </p>
          </div>
        ) : currentQuestionData?.imageUrl ? (
          <img
            src={currentQuestionData.imageUrl}
            alt="Soru"
            className="max-w-full max-h-full object-contain drop-shadow-xl rounded-lg"
          />
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border border-slate-200">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">
              Soru Görseli Yok
            </h3>
            <p className="text-slate-500 mt-2">
              Sağ taraftan soru görselini yükleyin.
            </p>
          </div>
        )}

        {/* Navigation Overlays */}
        <div className="absolute inset-y-0 left-4 flex items-center">
          <button
            onClick={handlePrevQuestion}
            disabled={activeQuestion.questionIndex === 0}
            className="p-4 bg-white/80 hover:bg-white text-slate-800 rounded-full shadow-lg backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <button
            onClick={handleNextQuestion}
            disabled={activeQuestion.questionIndex === questionCount - 1}
            className="p-4 bg-white/80 hover:bg-white text-slate-800 rounded-full shadow-lg backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-8 h-8 rotate-180" />
          </button>
        </div>

        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-sm text-sm font-bold text-slate-800 w-max">
            {currentSubjectName} - Soru {activeQuestion.questionIndex + 1} /{" "}
            {questionCount}
          </div>
          {(currentQuestionData?.unit || currentQuestionData?.topic || currentQuestionData?.outcome) && (
            <div className="bg-white/95 backdrop-blur px-4 py-3 rounded-2xl shadow-sm flex flex-col gap-1.5 w-max max-w-sm lg:max-w-md border border-slate-100">
              {currentQuestionData?.unit && (
                <span className="text-xs font-bold text-green-700 leading-tight">
                  <span className="text-green-900 bg-green-100 px-1.5 py-0.5 rounded mr-1">Ünite</span> 
                  {currentQuestionData.unit}
                </span>
              )}
              {currentQuestionData?.topic && (
                <span className="text-[11px] font-bold text-green-600 leading-tight">
                  <span className="text-green-900 bg-green-100 px-1.5 py-0.5 rounded mr-1">Konu</span> 
                  {currentQuestionData.topic}
                </span>
              )}
              {currentQuestionData?.outcome && (
                <span className="text-[10px] font-semibold text-green-500 leading-tight">
                  <span className="text-green-900 bg-green-100 px-1.5 py-0.5 rounded mr-1">Kazanım</span> 
                  {currentQuestionData.outcome}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Curriculum Info Sidebar */}
      <div className="w-full lg:w-[400px] shrink-0 bg-white border-l border-slate-100 flex flex-col max-h-full overflow-y-auto">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="font-extrabold text-lg text-slate-800">
            Soru Bilgileri
          </h3>
          <p className="text-xs font-medium text-slate-500">
            Görsel ve müfredat eşleştirmesi
          </p>
          <div className="mt-3 inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
            Doğru Cevap: {getQuestionCorrectAnswer(currentQuestionData, exam.examSource === "Sistem") || "-"}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {exam.examSource !== "Basılı Yayın" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Soru Dosyası Yükle (Görsel)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 border border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-purple-600">
                      {currentQuestionData?.imageUrl
                        ? "Görseli Değiştir"
                        : "Görsel Seç"}
                    </span>
                  </button>
                  {currentQuestionData?.imageUrl && (
                    <button
                      onClick={handleDeleteQuestion}
                      className="w-10 flex-none border border-dashed border-red-300 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                      title="Sil"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {exam.examSource === "Basılı Yayın" && (
            <div className="space-y-4 bg-red-50/50 p-5 rounded-2xl border border-red-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-6 -mt-6"></div>
              <h4 className="text-xs font-extrabold text-red-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-red-100 pb-2">
                <FileText className="w-4 h-4 text-red-600" />
                Basılı Yayın Özel Ayarları
              </h4>

              {/* 1. Soru Kazanımı */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Soru Kazanımı (Müfredat)
                </label>
                <textarea
                  value={currentQuestionData?.outcome || ""}
                  onChange={(e) => updateQuestionData("outcome", e.target.value)}
                  placeholder="Müfredat kazanımını buraya yazabilir veya aşağıdaki listeden seçebilirsiniz."
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-705 bg-white border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              {/* 2. Doğru Cevap Şıkkı */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Doğru Cevap Şıkkı
                </label>
                <div className="flex gap-2.5">
                  {["A", "B", "C", "D", "E"].map((opt) => {
                    const isSelected = currentQuestionData?.correctAnswer?.toUpperCase() === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateQuestionData("correctAnswer", opt)}
                        className={`w-9 h-9 rounded-full font-black text-xs border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-red-600 border-red-600 text-white shadow-sm scale-110"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Diğer Kitapçıklardaki Soru Numarası */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Kitapçık Soru Numaraları
                </label>
                <p className="text-[10px] text-slate-500 leading-normal mb-1">
                  Bu sorunun diğer kitapçıklardaki soru sıralamasını belirleyin (1 - {questionCount} arası).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(exam.bookletType ? exam.bookletType.split("-").map((s: string) => s.trim().toUpperCase()) : ["A"]).map((bKey: string) => {
                    const currentVal = currentQuestionData?.bookletNumbers?.[bKey] ?? "";
                    return (
                      <div key={bKey} className="flex items-center gap-1.5 bg-white border border-slate-200 p-2 rounded-xl">
                        <span className="font-extrabold text-[10px] text-red-700 w-7 text-center bg-red-50 border border-red-100 py-1 rounded">
                          {bKey}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max={questionCount}
                          value={currentVal}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            let num: any = "";
                            if (valStr !== "") {
                              num = Math.max(1, Math.min(questionCount, Number(valStr)));
                            }
                            const currentBookletNumbers = { ...(currentQuestionData?.bookletNumbers || {}) };
                            currentBookletNumbers[bKey] = num;
                            updateQuestionData("bookletNumbers", currentBookletNumbers);
                          }}
                          placeholder={`${activeQuestion.questionIndex + 1}`}
                          className="w-full bg-transparent border-none p-0 text-slate-800 text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest border-b pb-2">
              Müfredat Bilgileri
            </h4>

            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500">
                  Sınıf Düzeyi
                </label>
                <div className="bg-slate-100 rounded-xl p-2 font-semibold text-xs text-slate-700">
                  {exam.gradeLevel}. Sınıf
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500">
                  Ders
                </label>
                <div className="bg-slate-100 rounded-xl p-2 font-semibold text-xs text-slate-700 truncate" title={currentSubjectName}>
                  {currentSubjectName}
                </div>
              </div>
            </div>

            {currentQuestionData?.imageUrl ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  {curriculumTree.map((unit, uIndex) => (
                    <div key={uIndex} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`curriculum_select_${activeQuestion?.questionIndex}`}
                          checked={
                            currentQuestionData?.unit === unit.name &&
                            !currentQuestionData?.topic
                          }
                          onChange={() => handleCurriculumSelect(unit.name)}
                          className="w-5 h-5 text-green-600 accent-green-600"
                        />
                        <button
                          onClick={() => {
                            setExpandedUnit(
                              expandedUnit === unit.name ? null : unit.name,
                            );
                            if (expandedUnit !== unit.name)
                              setExpandedTopic(null); // Reset topic
                          }}
                          className="flex-1 text-left px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex justify-between items-center transition-colors shadow-sm"
                        >
                          <span className="text-sm truncate pr-2">
                            {unit.name}
                          </span>
                          {expandedUnit === unit.name ? (
                            <ChevronDown className="w-5 h-5 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 flex-shrink-0" />
                          )}
                        </button>
                      </div>

                      {expandedUnit === unit.name && (
                        <div className="pl-6 space-y-1 mt-1">
                          {unit.topics.map((topic, tIndex) => (
                            <div key={tIndex} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`curriculum_select_${activeQuestion?.questionIndex}`}
                                  checked={
                                    currentQuestionData?.unit ===
                                      unit.name &&
                                    currentQuestionData?.topic ===
                                      topic.name &&
                                    !currentQuestionData?.outcome
                                  }
                                  onChange={() =>
                                    handleCurriculumSelect(
                                      unit.name,
                                      topic.name,
                                    )
                                  }
                                  className="w-5 h-5 text-green-500 accent-green-500"
                                />
                                <button
                                  onClick={() =>
                                    setExpandedTopic(
                                      expandedTopic === topic.name
                                        ? null
                                        : topic.name,
                                    )
                                  }
                                  className="flex-1 text-left px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl flex justify-between items-center text-xs transition-colors shadow-sm"
                                >
                                  <span className="truncate pr-2">
                                    {topic.name}
                                  </span>
                                  {expandedTopic === topic.name ? (
                                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                  )}
                                </button>
                              </div>

                              {expandedTopic === topic.name && (
                                <div className="pl-6 space-y-1 mt-1">
                                  {topic.outcomes.map((outcome, oIndex) => (
                                    <div
                                      key={oIndex}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="radio"
                                        name={`curriculum_select_${activeQuestion?.questionIndex}`}
                                        checked={
                                          currentQuestionData?.unit ===
                                            unit.name &&
                                          currentQuestionData?.topic ===
                                            topic.name &&
                                          currentQuestionData?.outcome ===
                                            outcome.name
                                        }
                                        onChange={() =>
                                          handleCurriculumSelect(
                                            unit.name,
                                            topic.name,
                                            outcome.name,
                                          )
                                        }
                                        className="w-5 h-5 text-green-400 accent-green-400"
                                      />
                                      <div className="flex-1 text-left px-4 py-2 bg-green-400 text-white font-medium rounded-xl text-[10px] leading-tight shadow-sm">
                                        {outcome.name}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                 <ImageIcon className="w-8 h-8 text-amber-300" />
                 <p className="text-xs font-bold text-amber-700">Müfredat seçebilmek için lütfen önce soruyu yükleyin veya klasörden seçin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
