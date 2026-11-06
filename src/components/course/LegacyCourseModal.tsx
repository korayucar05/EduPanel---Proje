import React from "react";
import { Plus, BookOpen, Trash2, X, CalendarDays, Upload, Search, Check, Lock, Unlock, School, Users, Clock, MapPin, Sparkles } from "lucide-react";

export default function LegacyCourseModal(props: any) {
  const { classrooms, courseError, courseForm, handleAddCourse, isCourseModalOpen, isTeacherEligibleForCourse, setCourseForm, setIsCourseModalOpen, teachers } = props;
  return (<>
      {/* --- ADD COURSE MODAL --- */}
      {isCourseModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCourseModalOpen(false);
            }
          }}
          id="course-modal-overlay"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  Müfredat ve Ders Atama
                </h3>
              </div>
              <button
                onClick={() => setIsCourseModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {courseError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs mb-4">
                <span className="font-semibold">{courseError}</span>
              </div>
            )}

            <form
              onSubmit={handleAddCourse}
              className="space-y-4 text-xs font-semibold text-slate-600"
            >
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Ders Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: İleri Düzey Organik Kimya"
                  value={courseForm.name}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />

              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Ders Kodu *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: KIM-402"
                    value={courseForm.code}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, code: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Sınıf Salonu *
                  </label>
                  {classrooms.length > 0 ? (
                    <select
                      value={courseForm.classroom}
                      onChange={(e) =>
                        setCourseForm({
                          ...courseForm,
                          classroom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none bg-white text-slate-800"
                    >
                      {[...classrooms]
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, "tr", {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} Salonu
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Örn: 12-A Salonu"
                      value={courseForm.classroom}
                      onChange={(e) =>
                        setCourseForm({
                          ...courseForm,
                          classroom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none text-slate-800"
                    />
                  )}

                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Sorumlu Öğretmen *
                </label>
                <select
                  value={courseForm.teacherId}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, teacherId: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none bg-white text-slate-800"
                  required
                >
                  <option value="">Seçiniz...</option>
                  {teachers
                    .filter((teacher) =>
                      isTeacherEligibleForCourse(teacher, courseForm.name),
                    )
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} — {teacher.branch}
                      </option>
                    ))}
                </select>

              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Öğrenci Sayısı
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="25"
                    value={courseForm.studentCount}
                    onChange={(e) =>
                      setCourseForm({
                        ...courseForm,
                        studentCount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Haftalık Takvim Seansı *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Cuma 14:00 - 16:20"
                    value={courseForm.schedule}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, schedule: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />

                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow-md shadow-indigo-600/10"
                >
                  <Check className="w-4 h-4" />
                  <span>Programı Kesinleştir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>);
}
