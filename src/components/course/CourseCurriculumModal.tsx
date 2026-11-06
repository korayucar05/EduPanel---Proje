import React from "react";
import { BookOpen, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";

export default function CourseCurriculumModal(props: any) {
  const {
    curriculumModalState, getSelectedCurriculumCourse, getCourseCurriculum, downloadCurriculumTemplate,
    handleCurriculumUpload, openCurriculumEditor, setCurriculumModalState, setCurriculumEditor,
    expandedCurriculumUnits, setExpandedCurriculumUnits, expandedCurriculumTopics, setExpandedCurriculumTopics,
    deleteCurriculumItem, curriculumEditor, curriculumForm, setCurriculumForm, saveCurriculumEditor,
  } = props;
  return (
<>
{curriculumModalState.isOpen && (() => {
  const selectedCourse = getSelectedCurriculumCourse();
  const curriculum = getCourseCurriculum(curriculumModalState.courseId);
  const units = Array.isArray(curriculum.units) ? curriculum.units : [];
  const gradeLabel = String(selectedCourse?.gradeLevel || "").trim();
  const courseLabel = String(selectedCourse?.courseName || "Ders").trim();
  const lastCurriculumSegment = (value: any) => {
    const parts = String(value || "").split(".").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : String(value || "");
  };
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden max-h-[92vh] animate-slideUp">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white/90 backdrop-blur-md z-10 sticky top-0">
          <div>
            <h3 className="font-black text-slate-900 text-lg">{gradeLabel ? `${gradeLabel} ` : ""}{courseLabel} Müfredatı</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Ünite → konu → kazanım ağacını manuel oluşturun.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCurriculumEditor("unit")}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-950 text-white hover:bg-purple-900 rounded-xl text-[11px] font-black transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" /> Ünite Ekle
            </button>
            <button
              onClick={() => {
                setCurriculumModalState({ isOpen: false, courseId: null });
                setCurriculumEditor(null);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 min-h-[360px]">
          {units.length === 0 ? (
            <div className="h-[340px] flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-black text-slate-700">Henüz müfredat oluşturulmadı</h4>
              <p className="text-xs font-semibold text-slate-400 mt-1 max-w-md">Ünite ekleyerek ağaç yapısını oluşturmaya başlayın.</p>
              <button
                type="button"
                onClick={() => openCurriculumEditor("unit")}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-950 px-5 py-3 text-xs font-black text-white hover:bg-purple-900"
              >
                <Plus className="w-4 h-4" /> İlk Üniteyi Ekle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map((unit: any) => {
                const unitOpen = expandedCurriculumUnits[unit.id] ?? true;
                const topics = Array.isArray(unit.topics) ? unit.topics : [];
                return (
                  <div key={unit.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="bg-indigo-50/80 px-4 py-3 border-b border-indigo-100/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedCurriculumUnits(prev => ({ ...prev, [unit.id]: !unitOpen }))}
                        className="flex items-center gap-2 text-left"
                      >
                        {unitOpen ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
                        <span className="font-black text-indigo-950 text-sm">{lastCurriculumSegment(unit.id)} - {unit.name}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-indigo-700 border border-indigo-100">{topics.length} konu</span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => openCurriculumEditor("topic", unit.id)} className="rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-indigo-700 border border-indigo-100 hover:bg-indigo-50"><Plus className="inline w-3 h-3 mr-1" />Konu</button>
                        <button type="button" onClick={() => openCurriculumEditor("unit", undefined, undefined, unit)} className="rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 border border-slate-100 hover:bg-slate-50"><Pencil className="inline w-3 h-3 mr-1" />Düzenle</button>
                        <button type="button" onClick={() => deleteCurriculumItem("unit", unit.id)} className="rounded-xl bg-white p-1.5 text-rose-600 border border-rose-100 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {unitOpen && (
                      <div className="p-4 space-y-3">
                        {topics.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">Bu ünitede konu yok. Konu Ekle butonunu kullanabilirsiniz.</div>
                        ) : topics.map((topic: any) => {
                          const topicOpen = expandedCurriculumTopics[topic.id] ?? true;
                          const outcomes = Array.isArray(topic.outcomes) ? topic.outcomes : [];
                          return (
                            <div key={topic.id} className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
                              <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <button type="button" onClick={() => setExpandedCurriculumTopics(prev => ({ ...prev, [topic.id]: !topicOpen }))} className="flex items-center gap-2 text-left">
                                  {topicOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                  <span className="font-black text-slate-800 text-xs">{lastCurriculumSegment(unit.id)}.{lastCurriculumSegment(topic.id)} - {topic.name}</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">{outcomes.length} kazanım</span>
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => openCurriculumEditor("outcome", unit.id, topic.id)} className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 border border-emerald-100 hover:bg-emerald-100"><Plus className="inline w-3 h-3 mr-1" />Kazanım</button>
                                  <button type="button" onClick={() => openCurriculumEditor("topic", unit.id, undefined, topic)} className="rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 border border-slate-100 hover:bg-slate-50"><Pencil className="inline w-3 h-3 mr-1" />Düzenle</button>
                                  <button type="button" onClick={() => deleteCurriculumItem("topic", unit.id, topic.id)} className="rounded-xl bg-white p-1.5 text-rose-600 border border-rose-100 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                              {topicOpen && (
                                <div className="p-3 space-y-2">
                                  {outcomes.length === 0 ? (
                                    <div className="text-[11px] font-semibold text-slate-400 px-2 py-3">Bu konuda kazanım yok.</div>
                                  ) : outcomes.map((outcome: any) => (
                                    <div key={outcome.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 border border-slate-100">
                                      <div className="text-[11px] font-semibold text-slate-700 leading-relaxed">
                                        <span className="font-black text-purple-700 mr-1">{lastCurriculumSegment(unit.id)}.{lastCurriculumSegment(topic.id)}.{lastCurriculumSegment(outcome.id)}</span>
                                        {outcome.name}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button type="button" onClick={() => openCurriculumEditor("outcome", unit.id, topic.id, outcome)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => deleteCurriculumItem("outcome", unit.id, topic.id, outcome.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {curriculumEditor && (
          <div className="border-t border-slate-100 bg-white p-4">
            <div className="rounded-3xl border border-purple-100 bg-purple-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-black text-purple-950">
                  {curriculumEditor.item ? "Düzenle" : "Yeni Ekle"} — {curriculumEditor.type === "unit" ? "Ünite" : curriculumEditor.type === "topic" ? "Konu" : "Kazanım"}
                </h4>
                <button type="button" onClick={() => setCurriculumEditor(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-10">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Ad / Açıklama</label>
                  <input value={curriculumForm.name} onChange={(e) => setCurriculumForm(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-purple-100" placeholder="Ad yazınız" />
                  <div className="mt-1 text-[9px] font-semibold text-purple-600">ID, sınıf ve ders koduna göre otomatik oluşturulur.</div>
                </div>
                <div className="md:col-span-2">
                  <button type="button" onClick={saveCurriculumEditor} className="w-full rounded-2xl bg-purple-950 px-4 py-3 text-[14.67px] font-black text-white hover:bg-purple-900">
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
})()}

</>
  );
}
