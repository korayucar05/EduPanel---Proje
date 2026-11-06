import React from "react";
import { Plus, BookOpen, Trash2, X, CalendarDays, Upload, Search, Check, Lock, Unlock, School, Users, Clock, MapPin, Sparkles } from "lucide-react";

export default function EditCustomCourseModal(props: any) {
  const { classrooms, editingCustomCourse, handleSaveEditedCustomCourse, isEditingCompulsoryLocked, setEditingCustomCourse, setIsEditingCompulsoryLocked } = props;
  return (<>
      {/* --- EDIT CUSTOM COURSE MODAL --- */}
      {editingCustomCourse && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingCustomCourse(null);
            }
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  Dersi Düzenle
                </h3>
              </div>
              <button
                onClick={() => setEditingCustomCourse(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedCustomCourse} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">Sınıf Seviyesi</label>
                  <select
                    value={editingCustomCourse.gradeLevel}
                    onChange={(e) => setEditingCustomCourse({ ...editingCustomCourse, gradeLevel: e.target.value })}
                    className="w-full h-[42px] px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    disabled
                  >
                    <option value="9. Sınıf">9. Sınıf</option>
                    <option value="10. Sınıf">10. Sınıf</option>
                    <option value="11. Sınıf">11. Sınıf</option>
                    <option value="12. Sınıf">12. Sınıf</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">Ders Türü</label>
                  <select
                    value={editingCustomCourse.courseType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      let updated = { ...editingCustomCourse, courseType: newType };
                      if (newType === "Zorunlu Ders") {
                        const levelClasses = classrooms.filter(c => c.level === editingCustomCourse.gradeLevel);
                        const allClassroomIds = levelClasses.map(c => c.id);
                        updated.selectedClassrooms = allClassroomIds;
                        
                        const classGroups = { ...(editingCustomCourse.classGroups || {}) };
                        levelClasses.forEach(cls => {
                          if (cls.groups && cls.groups.length > 0) {
                            classGroups[cls.id] = [...cls.groups];
                          }
                        });
                        updated.classGroups = classGroups;
                      }
                      setEditingCustomCourse(updated);
                    }}
                    className="w-full h-[42px] px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="Zorunlu Ders">Zorunlu Ders</option>
                    <option value="Seçmeli Ders">Seçmeli Ders</option>
                  </select>
                </div>
                <div className="md:col-span-5 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">Ders Adı</label>
                  <input
                    type="text"
                    value={editingCustomCourse.courseName}
                    onChange={(e) => setEditingCustomCourse({ ...editingCustomCourse, courseName: e.target.value })}
                    className="w-full h-[42px] px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    placeholder="Ders adı giriniz"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">Saat</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={editingCustomCourse.weeklyHours}
                    onChange={(e) => setEditingCustomCourse({ ...editingCustomCourse, weeklyHours: Math.max(1, parseInt(e.target.value) || 2) })}
                    className="w-full h-[42px] px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600">Atanacak Şubeler ve Gruplar</label>
                  {editingCustomCourse.courseType === "Zorunlu Ders" && (
                    <button
                      type="button"
                      onClick={() => {
                        const newLocked = !isEditingCompulsoryLocked;
                        setIsEditingCompulsoryLocked(newLocked);
                        if (newLocked) {
                          const levelClasses = classrooms.filter(c => c.level === editingCustomCourse.gradeLevel);
                          const allClassroomIds = levelClasses.map(c => c.id);
                          const classGroups = { ...(editingCustomCourse.classGroups || {}) };
                          levelClasses.forEach(cls => {
                            if (cls.groups && cls.groups.length > 0) {
                              classGroups[cls.id] = [...cls.groups];
                            } else {
                              classGroups[cls.id] = [];
                            }
                          });
                          setEditingCustomCourse({
                            ...editingCustomCourse,
                            selectedClassrooms: allClassroomIds,
                            classGroups: classGroups
                          });
                        } else {
                          if (editingCustomCourse.selectedClassrooms.length === 0) {
                            const levelClasses = classrooms.filter(c => c.level === editingCustomCourse.gradeLevel);
                            const allClassroomIds = levelClasses.map(c => c.id);
                            const classGroups = { ...(editingCustomCourse.classGroups || {}) };
                            levelClasses.forEach(cls => {
                              if (cls.groups && cls.groups.length > 0) {
                                classGroups[cls.id] = [...cls.groups];
                              } else {
                                classGroups[cls.id] = [];
                              }
                            });
                            setEditingCustomCourse({
                              ...editingCustomCourse,
                              selectedClassrooms: allClassroomIds,
                              classGroups: classGroups
                            });
                          }
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer ${
                        isEditingCompulsoryLocked
                          ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {isEditingCompulsoryLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Seçimleri Düzenlemek İçin Kilidi Aç</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Seçimler Serbest (Kilitle)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  {(() => {
                    const levelClasses = [...classrooms]
                      .filter(c => c.level === editingCustomCourse.gradeLevel)
                      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

                    if (levelClasses.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 font-semibold py-1">
                          Bu sınıf seviyesinde henüz şube bulunmuyor.
                        </p>
                      );
                    }

                    return (
                      <>
                        {(editingCustomCourse.courseType !== "Zorunlu Ders" || !isEditingCompulsoryLocked) && (
                          <div className="flex items-center justify-end">
                             <button
                               type="button"
                               onClick={() => {
                                 const allLevelClassIds = levelClasses.map(c => c.id);
                                 if (editingCustomCourse.selectedClassrooms.length === allLevelClassIds.length) {
                                   setEditingCustomCourse({
                                     ...editingCustomCourse,
                                     selectedClassrooms: [],
                                     classGroups: {},
                                     isCommonElective: false,
                                     targetGroups: [],
                                   });
                                 } else {
                                   const nextClassGroups = { ...(editingCustomCourse.classGroups || {}) };
                                   levelClasses.forEach(cls => {
                                     nextClassGroups[cls.id] = Array.from(
                                       new Set((cls.groups || []).map(group => group.toLocaleUpperCase("tr-TR"))),
                                     );
                                   });
                                   setEditingCustomCourse({
                                     ...editingCustomCourse,
                                     selectedClassrooms: allLevelClassIds,
                                     classGroups: nextClassGroups,
                                     isCommonElective: true,
                                     targetGroups: ["ORTAK"],
                                   });
                                 }
                               }}
                               className="text-[10px] text-indigo-600 font-bold hover:underline px-2"
                             >
                               {editingCustomCourse.selectedClassrooms.length === levelClasses.length ? "Tüm Şube Seçimlerini Kaldır" : "Tüm Şubeleri Seç"}
                             </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                          {levelClasses.map(cls => {
                            const isChecked = (editingCustomCourse.courseType === "Zorunlu Ders" && isEditingCompulsoryLocked) ? true : editingCustomCourse.selectedClassrooms.includes(cls.id);
                            const classGroupsArray = editingCustomCourse.classGroups && editingCustomCourse.classGroups[cls.id] ? editingCustomCourse.classGroups[cls.id] : [];
                            const hasGroups = cls.groups && cls.groups.length > 0;
                            const groupsToRender = hasGroups ? cls.groups : [];
                            const isAllGroupsSelected = isChecked && hasGroups && groupsToRender.every(g => classGroupsArray.includes(g));
                            
                            return (
                              <div
                                key={cls.id}
                                className={`flex flex-col gap-2 p-3 border rounded-xl transition-all ${
                                  isChecked
                                    ? "bg-white border-indigo-200 shadow-sm"
                                    : "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100"
                                }`}
                                style={isChecked && isAllGroupsSelected && hasGroups ? { borderColor: "#ef4444", backgroundColor: "#fffbfa" } : undefined}
                              >
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={editingCustomCourse.courseType === "Zorunlu Ders" && isEditingCompulsoryLocked}
                                      onChange={(e) => {
                                        let newSelected = [...editingCustomCourse.selectedClassrooms];
                                        const nextClassGroups = { ...(editingCustomCourse.classGroups || {}) };
                                        if (e.target.checked) {
                                          newSelected = Array.from(new Set([...newSelected, cls.id]));
                                        } else {
                                          newSelected = newSelected.filter(id => id !== cls.id);
                                          delete nextClassGroups[cls.id];
                                        }
                                        setEditingCustomCourse({
                                          ...editingCustomCourse,
                                          selectedClassrooms: newSelected,
                                          classGroups: nextClassGroups,
                                          isCommonElective: false,
                                          targetGroups: [],
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500/20 w-4 h-4 disabled:opacity-50"
                                    />
                                    <span className="text-sm font-bold text-slate-800">{cls.name}</span>
                                  </label>

                                  {isChecked && editingCustomCourse.courseType === "Seçmeli Ders" && hasGroups && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currentClassGroups = { ...(editingCustomCourse.classGroups || {}) };
                                          if (isAllGroupsSelected) {
                                            currentClassGroups[cls.id] = [];
                                          } else {
                                            currentClassGroups[cls.id] = [...groupsToRender];
                                          }

                                          const allLevelClassesSelected = levelClasses.every(item =>
                                            editingCustomCourse.selectedClassrooms.includes(item.id),
                                          );
                                          const everyClassHasAllGroups = levelClasses.every(item => {
                                            const available = item.groups || [];
                                            const selected = currentClassGroups[item.id] || [];
                                            return available.every(group => selected.includes(group));
                                          });
                                          const nextIsCommon = allLevelClassesSelected && everyClassHasAllGroups;

                                          setEditingCustomCourse({
                                            ...editingCustomCourse,
                                            classGroups: currentClassGroups,
                                            isCommonElective: nextIsCommon,
                                            targetGroups: nextIsCommon ? ["ORTAK"] : [],
                                          });
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-[10px] font-extrabold cursor-pointer select-none"
                                        style={{
                                          borderColor: isAllGroupsSelected ? "#ef4444" : "#cbd5e1",
                                          color: isAllGroupsSelected ? "#b91c1c" : "#64748b",
                                          backgroundColor: isAllGroupsSelected ? "#fef2f2" : "#f8fafc"
                                        }}
                                      >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAllGroupsSelected ? "border-red-500 bg-red-50 text-red-600" : "border-slate-300 bg-white text-transparent"}`}>
                                          <Check className={`w-3 h-3 stroke-[4] ${isAllGroupsSelected ? "text-red-600 block" : "hidden"}`} />
                                        </div>
                                        <span>Ortak Ders</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                                
                                {isChecked && hasGroups && (
                                  <div className="pl-7 pt-1 border-t border-slate-100 mt-1 flex flex-wrap gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 w-full mb-1">Dersin Verileceği Gruplar (İsteğe Bağlı)</span>
                                    {(() => {
                                      const groupsToRenderLocal = groupsToRender;
                                      return groupsToRenderLocal.map(groupName => {
                                        const isGroupChecked = (editingCustomCourse.courseType === "Zorunlu Ders" && isEditingCompulsoryLocked) ? true : classGroupsArray.includes(groupName);
                                        return (
                                          <label key={groupName} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer text-[10px] font-bold transition-colors ${isGroupChecked ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                            <input 
                                              type="checkbox" 
                                              checked={isGroupChecked}
                                              disabled={editingCustomCourse.courseType === "Zorunlu Ders" && isEditingCompulsoryLocked}
                                              onChange={(e) => {
                                                const currentClassGroups = { ...(editingCustomCourse.classGroups || {}) };
                                                let updatedGroups = [...(currentClassGroups[cls.id] || [])];
                                                
                                                if (e.target.checked) {
                                                  updatedGroups.push(groupName);
                                                } else {
                                                  updatedGroups = updatedGroups.filter(g => g !== groupName);
                                                }
                                                
                                                currentClassGroups[cls.id] = updatedGroups;
                                                setEditingCustomCourse({ ...editingCustomCourse, classGroups: currentClassGroups });
                                              }}
                                              className="rounded text-indigo-600 focus:ring-indigo-500/20 w-3 h-3 disabled:opacity-50"
                                            />
                                            {groupName}
                                          </label>
                                        );
                                      });
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingCustomCourse(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>);
}
