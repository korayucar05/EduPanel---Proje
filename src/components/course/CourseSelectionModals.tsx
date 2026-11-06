import React from "react";
import { Plus, BookOpen, Trash2, X, CalendarDays, Upload, Search, Check, Lock, Unlock, School, Users, Clock, MapPin, Sparkles } from "lucide-react";

export default function CourseSelectionModals(props: any) {
  const { activeCourseIndexForStudents, assignAllClassStudentsToGroup, classCourses, classForm, classrooms, clearClassGroupStudents, deselectAllStudents, electiveClassSelections, electiveModalState, getClassGroupStudentIds, getStudentAssignedGroupInClass, getStudentsForClassName, groupStudentModal, groupStudentSearchTerm, isStudentSelectModalOpen, saveElectiveSelection, selectAllStudents, setElectiveClassSelections, setElectiveModalState, setGroupStudentModal, setGroupStudentSearchTerm, setIsStudentSelectModalOpen, setStudentSearchTerm, studentSearchTerm, students, toggleClassGroupStudent, toggleStudentSelected } = props;
  return (<>
      {/* --- ELECTIVE ASSIGNMENT / CLASS SELECTION MODAL --- */}
      {electiveModalState.isOpen && electiveModalState.course && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-xl w-[95%] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Seçmeli Ders Atama
                </h2>
                <button
                  onClick={() =>
                    setElectiveModalState({
                      isOpen: false,
                      course: null,
                      grade: "",
                      hours: 0,
                      hourOptions: [],
                    })
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Sınıf Seviyesi: {electiveModalState.grade.replace(". Sınıf", "")}
                </span>
                {electiveModalState.course.name}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Hours Selection */}
              {electiveModalState.hourOptions.length > 1 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Haftalık Ders Saati
                  </label>
                  <select
                    value={electiveModalState.hours}
                    onChange={(e) =>
                      setElectiveModalState((prev) => ({
                        ...prev,
                        hours: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 bg-white text-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {electiveModalState.hourOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} Saat
                      </option>
                    ))}
                  </select>
                </div>
              )}

               {/* Classrooms Selection */}
              <div className="space-y-3">
                {(() => {
                  const classesInGrade = (classrooms || []).filter(
                    (c) => c && c.level === electiveModalState.grade,
                  );
                  const classNames = classesInGrade
                    .map((c) => c.name)
                    .filter(Boolean)
                    .join(", ");
                  const isLevelActive = classesInGrade.some(
                    (c) => c && (electiveClassSelections || {})[c.id] !== "none",
                  );

                  if (classesInGrade.length === 0) {
                    return (
                      <div className="text-center p-8 bg-slate-50 border border-slate-100 rounded-2xl">
                        <p className="text-xs text-slate-500 font-semibold mb-3">
                          Bu seviyede ( {electiveModalState.grade} ) hiç sınıf kaydedilmemiş.
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Modülü kapatıp önce "Sınıflar" sekmesinden yeni{" "}
                          {electiveModalState.grade} sınıfı eklemelisiniz.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 transition-all space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                              Sınıf Seviyesi Seçimi
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-800">
                              {electiveModalState.grade} Seviyesindeki Tüm Şubeler
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Tüm şubelere toplu olarak atamak veya kaldırmak için bu seçeneği kullanabilirsiniz.
                            </p>
                          </div>
                          <div className="shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={classesInGrade.length > 0 && classesInGrade.every((c) => (electiveClassSelections || {})[c.id] !== "none")}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const updated = { ...electiveClassSelections };
                                  classesInGrade.forEach((c) => {
                                    if (c) {
                                      updated[c.id] = checked ? "all" : "none";
                                    }
                                  });
                                  setElectiveClassSelections(updated);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                          Şube Bazlı Seçim
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {classesInGrade.map((c) => {
                            const isClassActive = (electiveClassSelections || {})[c.id] !== "none";
                            return (
                              <label
                                key={c.id}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                  isClassActive
                                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-900 font-bold"
                                    : "bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <span className="text-xs">{c.name} Sınıfı</span>
                                <input
                                  type="checkbox"
                                  checked={isClassActive}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setElectiveClassSelections((prev) => ({
                                      ...prev,
                                      [c.id]: checked ? "all" : "none",
                                    }));
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() =>
                  setElectiveModalState({
                    isOpen: false,
                    course: null,
                    grade: "",
                    hours: 0,
                    hourOptions: [],
                  })
                }
                className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-sm"
              >
                İptal
              </button>
              <button
                onClick={saveElectiveSelection}
                className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:-translate-y-0.5 cursor-pointer text-[16.67px]"
              >
                Kaydet ve Ata
              </button>
            </div>
          </div>
        </div>
      )}

      {groupStudentModal.isOpen && groupStudentModal.classId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[115] animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-scaleUp mx-4">
            {(() => {
              const activeClass = classrooms.find((c) => c.id === groupStudentModal.classId);
              const classStudents = activeClass ? getStudentsForClassName(activeClass.name) : [];
              const filteredStudents = classStudents.filter((s) =>
                (s.name || "").toLocaleLowerCase("tr-TR").includes((groupStudentSearchTerm || "").toLocaleLowerCase("tr-TR"))
              );
              const selectedIds = getClassGroupStudentIds(groupStudentModal.classId, groupStudentModal.groupName);

              return (
                <>
                  <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Sınıf İçi Grup Öğrenci Ataması</h3>
                      <p className="text-xs text-indigo-600 font-bold mt-0.5">
                        {activeClass?.name || "Sınıf"} / {groupStudentModal.groupName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupStudentModal({ isOpen: false, classId: null, groupName: "" });
                        setGroupStudentSearchTerm("");
                      }}
                      className="p-1 px-2.5 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg text-sm border border-slate-200/60 font-semibold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <input
                        type="text"
                        placeholder="Öğrenci adı ile ara..."
                        value={groupStudentSearchTerm}
                        onChange={(e) => setGroupStudentSearchTerm(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xs font-semibold bg-slate-50/50"
                      />
                      <button
                        type="button"
                        onClick={assignAllClassStudentsToGroup}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[12.67px] font-black cursor-pointer uppercase transition-colors"
                      >
                        Tümünü Ata
                      </button>
                      <button
                        type="button"
                        onClick={clearClassGroupStudents}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[12.67px] font-black cursor-pointer uppercase transition-colors"
                      >
                        Grubu Temizle
                      </button>
                    </div>

                    <div className="rounded-2xl bg-indigo-50/50 border border-indigo-100 p-3 text-[11px] font-semibold text-indigo-900">
                      Bu ekranda öğrenciler sınıf içi gruplara atanır. Bir öğrenci aynı sınıfta yalnızca bir gruba atanabilir.
                    </div>

                    <div className="border border-slate-100 rounded-2xl max-h-[48vh] overflow-y-auto divide-y divide-slate-50 p-1 bg-slate-50/30">
                      {classStudents.length === 0 ? (
                        <div className="p-8 text-center text-xs font-semibold text-slate-400">
                          Bu sınıfa ait öğrenci kaydı bulunamadı. Öğrenci kartlarında sınıf bilgisini kontrol ediniz.
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-8 text-center text-xs font-semibold text-slate-400">
                          Arama kriterlerine uygun öğrenci bulunamadı.
                        </div>
                      ) : (
                        filteredStudents.map((st) => {
                          const isChecked = selectedIds.includes(st.id);
                          const assignedGroup = getStudentAssignedGroupInClass(groupStudentModal.classId, st.id);
                          return (
                            <label
                              key={st.id}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white rounded-xl transition-colors cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleClassGroupStudent(st.id)}
                                className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700">{st.name}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">
                                  {assignedGroup ? `Mevcut grup: ${assignedGroup}` : "Henüz grup atanmadı"}
                                </p>
                              </div>
                              {isChecked && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black">
                                  {groupStudentModal.groupName}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">
                      {groupStudentModal.groupName} grubundaki öğrenci sayısı: <b className="text-indigo-600 text-xs">{selectedIds.length}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupStudentModal({ isOpen: false, classId: null, groupName: "" });
                        setGroupStudentSearchTerm("");
                      }}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/10 cursor-pointer transition-all hover:-translate-y-0.5"
                    >
                      Kaydet ve Kapat
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {isStudentSelectModalOpen && activeCourseIndexForStudents !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scaleUp mx-4">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800">Seçmeli Ders Öğrenci Yönetimi</h3>
                <p className="text-xs text-indigo-600 font-bold mt-0.5">
                  {classCourses[activeCourseIndexForStudents]?.courseName} ({classForm.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsStudentSelectModalOpen(false);
                  setStudentSearchTerm("");
                }}
                className="p-1 px-2.5 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg text-sm border border-slate-200/60 font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Search Bar & Multi-Select Operations */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Öğrenci adı ile ara..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xs font-semibold bg-slate-50/50"
                />
                
                <button
                  type="button"
                  onClick={() => {
                    const classStudents = students.filter(
                      (s) =>
                        (s.classroom || "") === (classForm.name || "") ||
                        (s.classroom || "").replace(/\s/g, "") === (classForm.name || "").replace(/\s/g, "")
                    );
                    selectAllStudents(classStudents);
                  }}
                  className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black cursor-pointer uppercase transition-colors"
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={deselectAllStudents}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[12.67px] font-black cursor-pointer uppercase transition-colors"
                >
                  Temizle
                </button>

              </div>
              {/* Checklist Scroll Area */}
              <div className="border border-slate-100 rounded-2xl max-h-[40vh] overflow-y-auto divide-y divide-slate-50 p-1 bg-slate-50/30">
                {(() => {
                  const classStudents = students.filter(
                    (s) =>
                      (s.classroom || "") === (classForm.name || "") ||
                      (s.classroom || "").replace(/\s/g, "") === (classForm.name || "").replace(/\s/g, "")
                  );
                  const filtered = classStudents.filter((s) =>
                    (s.name || "").toLowerCase().includes((studentSearchTerm || "").toLowerCase())
                  );
                  const currentSelectedIds = classCourses[activeCourseIndexForStudents]?.studentIds || [];

                  if (classStudents.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs font-semibold text-slate-400">
                        Bu sınıfa ait ('{classForm.name}') henüz öğrenci kaydı bulunmamaktadır.
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs font-semibold text-slate-400">
                        Arama kriterlerine uygun öğrenci bulunamadı.
                      </div>
                    );
                  }

                  return filtered.map((st) => {
                    const isChecked = currentSelectedIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white rounded-xl transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentSelected(st.id)}
                          className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700">{st.name}</p>
                          {st.group && (
                            <p className="text-[10px] text-slate-400 font-semibold">{st.group}</p>
                          )}
                        </div>
                        {isChecked && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black">
                            EKLENDİ
                          </span>
                        )}
                      </label>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500">
                Seçilen Öğrenci Sayısı: <b className="text-indigo-600 text-xs">{(classCourses[activeCourseIndexForStudents]?.studentIds || []).length}</b>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsStudentSelectModalOpen(false);
                  setStudentSearchTerm("");
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/10 cursor-pointer transition-all hover:-translate-y-0.5"
              >
                Değişiklikleri Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      
  </>);
}
