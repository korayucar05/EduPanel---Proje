import React from "react";
import { Calendar as CalendarIcon, CheckSquare, ChevronRight, Info, Square, X } from "lucide-react";

interface KelebekSetupPanelsProps {
  activeSubTab: string;
  associatedJointExams: any[];
  filteredAssociatedJointExams: any[];
  difficultCourses: Record<string, string[]>;
  excludedCourseNames: string[];
  toggleDifficultCourse: (gradeLevel: string, courseName: string) => void;
  toggleExcludedCourse: (courseName: string, gradeLevel: string) => void;
  setActiveSubTab: (tab: "A" | "B" | "C") => void;
  computedDates: any[];
  sortedUniqueDates: string[];
  groupedByDate: Record<string, any[]>;
  examDayColorThemes: readonly any[];
  checkIsPassed: (dateStr: string) => boolean;
  openSessionEditor: (index: number) => void;
  formatTurkishDate: (dateStr: string) => string;
  editingSessionIndex: number | null;
  sessionEditorDraft: any;
  setSessionEditorDraft: React.Dispatch<React.SetStateAction<any>>;
  closeSessionEditor: () => void;
  getDefaultSessionTime: (sessionIndex: number) => string;
  deleteDayAt: (index: number) => void;
  setConfirmDialog: React.Dispatch<React.SetStateAction<any>>;
  saveSessionEditor: () => void;
  onSelectSession: (session: any, index: number) => void;
  isSessionLocked?: (session: any) => boolean;
  getSessionExams?: (session: any) => any[];
}

export function KelebekSetupPanels(props: KelebekSetupPanelsProps) {
  const {
    activeSubTab, associatedJointExams, filteredAssociatedJointExams, difficultCourses, excludedCourseNames,
    toggleDifficultCourse, toggleExcludedCourse, setActiveSubTab, computedDates, sortedUniqueDates, groupedByDate,
    examDayColorThemes, checkIsPassed, openSessionEditor, formatTurkishDate, editingSessionIndex, sessionEditorDraft,
    setSessionEditorDraft, closeSessionEditor, getDefaultSessionTime, deleteDayAt, setConfirmDialog, saveSessionEditor,
    onSelectSession, isSessionLocked, getSessionExams,
  } = props;

  return (
    <>
      {/* SUB-TAB A: Associated / Joint Courses Setup */}
      {activeSubTab === 'A' && (
        <div id="subtab_content_a" className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6 animate-fade-in print:hidden">
          {associatedJointExams.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <Info className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="text-sm">Aralarında ilişki kurulan ortak veya zorunlu ders bulunamadı.</p>
              <p className="text-xs text-slate-300 mt-1">Lütfen "Ders Sınıf Atama" panelinden derslerin şube ve gruplarını kontrol edin.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-[120px]">Sınıf Seviyesi</th>
                    <th className="py-3.5 px-4">Ortak Ders Adı</th>
                    <th className="py-3.5 px-4 w-[110px] text-center">Haftalık Saat</th>
                    <th className="py-3.5 px-4">İlişkili Sınıf Şube ve Grupları</th>
                    <th className="py-3.5 px-4 w-[140px] text-center">Zor Ders mi? (Günde 1 Sınav)</th>
                    <th className="py-3.5 px-4 w-[180px] text-center">Sınava Dahil Edilsin mi?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredAssociatedJointExams.map(joint => {
                    const isZor = (difficultCourses[joint.gradeLevel] || []).includes(joint.courseName);
                    const isEx = excludedCourseNames.some(ex => 
                      joint.courseName.toLowerCase() === ex.toLowerCase() || 
                      joint.courseName.toLowerCase().includes(ex.toLowerCase())
                    );
                    
                    return (
                      <tr key={joint.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                            {joint.gradeLevel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-800 text-sm">
                          {joint.courseName}
                          {joint.isCompulsory && (
                            <span className="ml-2 text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Zorunlu
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                          {joint.weeklyHours} Saat
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {joint.classrooms.map(cls => (
                              <span key={cls} className="text-[10px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                                {cls}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleDifficultCourse(joint.gradeLevel, joint.courseName)}
                            className={`mx-auto flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer ${
                              isZor ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100"
                            }`}
                            title="Zor ders durumunu değiştir"
                          >
                            {isZor ? (
                              <CheckSquare className="w-5.5 h-5.5" />
                            ) : (
                              <Square className="w-5.5 h-5.5 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <select
                            value={isEx ? "excluded" : "included"}
                            onChange={() => toggleExcludedCourse(joint.courseName, joint.gradeLevel)}
                            className={`mx-auto px-3 py-1.5 border rounded-xl text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                              isEx
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            }`}
                          >
                            <option value="included">Sınava Dahil (Aktif)</option>
                            <option value="excluded">Sınav Dışı (Pasif)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Guidelines Box */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-extrabold text-slate-800 block">Bilgilendirme ve Planlama Kuralları</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Aralarında ilişki kurulan bu ortak dersler kesinlikle birbirinden ayrılmadan aynı gün ve aynı saatte tek oturumda sınava tabi tutulacaktır. 
                Burada belirlediğiniz <strong>Zor Dersler</strong>, öğrencilerin sınav yükünü hafifletmek adına aynı güne birden fazla gelmeyecek şekilde akıllıca takvimlendirilir.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end items-center gap-4">
            <button
              onClick={() => setActiveSubTab('B')}
              className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white px-6 font-extrabold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-xs uppercase tracking-wider shadow-md"
            >
              <span>Sonraki: Sınav Takvimine Git</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB B: Compact Exam Session Calendar */}
      {activeSubTab === 'B' && (
        <div id="subtab_content_b" className="bg-white border border-slate-100 rounded-[28px] p-4 md:p-5 shadow-sm animate-fade-in print:hidden">
          {computedDates.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Henüz sınav oturumu oluşturulmadı.</p>
          <p className="text-[11px] text-slate-400">Yukarıdaki “Oturum Ekle” butonuyla ilk kartı oluşturun.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUniqueDates.map((dateStr, dayIndex) => {
                const theme = examDayColorThemes[dayIndex % examDayColorThemes.length];
                const sessions = [...(groupedByDate[dateStr] || [])].sort(
                  (a, b) => (a.dInfo.sessionIndex || 1) - (b.dInfo.sessionIndex || 1),
                );

                return (
                  <div
                    key={dateStr}
                    className="grid grid-cols-1 gap-2"
                  >
                    {sessions.map(({ dInfo, index }) => {
                      const isPassed = checkIsPassed(dInfo.dateStr);
                      const sessionExams = getSessionExams?.(dInfo) || [];
                      return (
                        <div
                          key={dInfo.id || `${dInfo.dateStr}_${dInfo.sessionIndex}_${index}`}
                          className={`w-full min-h-[76px] px-3 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            isPassed
                              ? 'bg-slate-50 border-slate-200 opacity-80'
                              : theme.card
                          }`}
                        >
                          <div className="flex items-stretch gap-3 h-full">
                            <button
                              type="button"
                              onClick={() => onSelectSession(dInfo, index)}
                              className="flex flex-1 min-w-0 items-center gap-4 text-left px-2 py-1 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/25"
                              title="Bu sınav oturumunu seç"
                            >
                              <div className="w-[145px] shrink-0 self-center">
                                <div className={`text-[13px] font-black leading-tight ${isPassed ? 'text-slate-700' : theme.text}`}>
                                  {dInfo.dateStr ? formatTurkishDate(dInfo.dateStr) : "Tarih Belirlenmedi"}
                                </div>
                                <div className={`text-[11px] font-black mt-1 ${isPassed ? 'text-slate-500' : theme.subtext}`}>
                                  {dInfo.timeStr || getDefaultSessionTime(dInfo.sessionIndex || 1)}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 border-l border-current/15 pl-4 py-0.5">
                                {sessionExams.length > 0 ? (
                                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                    {sessionExams.map((exam: any, examIndex: number) => {
                                      const classroomText = Array.isArray(exam?.classrooms) && exam.classrooms.length
                                        ? exam.classrooms.join(", ")
                                        : String(exam?.gradeLevel || "Sınıf/Şube Belirlenmedi");
                                      return (
                                        <div key={exam?.id || `${exam?.courseName || 'exam'}_${examIndex}`} className="min-w-[260px] max-w-full text-[11px] leading-4">
                                          <span className={`font-black ${isPassed ? 'text-slate-600' : theme.text}`}>{classroomText}</span>
                                          <span className={`mx-1.5 font-black ${isPassed ? 'text-slate-400' : theme.subtext}`}>—</span>
                                          <span className={`font-extrabold ${isPassed ? 'text-slate-700' : theme.text}`}>{exam?.courseName || "Ders Belirlenmedi"}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className={`text-[11px] font-bold ${isPassed ? 'text-slate-400' : theme.subtext}`}>
                                    Henüz sınıf/şube ve ders belirlenmedi.
                                  </div>
                                )}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => openSessionEditor(index)}
                              className={`shrink-0 self-center px-3 py-2 rounded-xl border text-[11px] font-black transition-all ${
                                isPassed
                                  ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer'
                                  : `${theme.badge} hover:brightness-95 cursor-pointer`
                              }`}
                              title="Oturum tarih ve saatini güncelle"
                            >
                              Güncelle
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Session editor modal */}
      {editingSessionIndex !== null && sessionEditorDraft && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Pencereyi kapat"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] cursor-default"
            onClick={closeSessionEditor}
          />
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{editingSessionIndex === -1 ? 'Oturum Ekle' : 'Oturumu Güncelle'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Tarih ve saat bilgilerini belirleyin; kayıttan sonra sınav planlamasına geçilir.</p>
              </div>
              <button
                type="button"
                onClick={closeSessionEditor}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sınav Tarihi</span>
                <input
                  type="date"
                  value={sessionEditorDraft.dateStr}
                  onChange={(e) => setSessionEditorDraft(prev => prev ? { ...prev, dateStr: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sınav Saati</span>
                <input
                  type="time"
                  value={sessionEditorDraft.timeStr}
                  onChange={(e) => setSessionEditorDraft(prev => prev ? { ...prev, timeStr: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-600">Oturum</span>
                <select
                  value={sessionEditorDraft.sessionIndex}
                  onChange={(e) => {
                    const nextSession = Number(e.target.value);
                    setSessionEditorDraft(prev => prev ? {
                      ...prev,
                      sessionIndex: nextSession,
                      timeStr: prev.timeStr || getDefaultSessionTime(nextSession),
                    } : prev);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-sm font-black text-violet-700 focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value={1}>1. Oturum</option>
                  <option value={2}>2. Oturum</option>
                  <option value={3}>3. Oturum</option>
                </select>
              </label>

              <div className="hidden sm:block" />

              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Telafi Sınavı Tarihi</span>
                <input
                  type="date"
                  value={sessionEditorDraft.makeupDateStr}
                  onChange={(e) => setSessionEditorDraft(prev => prev ? { ...prev, makeupDateStr: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 rounded-xl border border-rose-100 bg-rose-50/40 text-sm font-bold text-slate-700 focus:outline-none focus:border-rose-400"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Telafi Sınavı Saati</span>
                <input
                  type="time"
                  value={sessionEditorDraft.makeupTimeStr}
                  onChange={(e) => setSessionEditorDraft(prev => prev ? { ...prev, makeupTimeStr: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 rounded-xl border border-rose-100 bg-rose-50/40 text-sm font-bold text-slate-700 focus:outline-none focus:border-rose-400"
                />
              </label>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
              {editingSessionIndex === -1 ? <div /> : (
                <button
                  type="button"
                  onClick={() => {
                    const indexToDelete = editingSessionIndex;
                    closeSessionEditor();
                    setConfirmDialog({
                      isOpen: true,
                      message: "Bu sınav oturumunu silmek istediğinize emin misiniz?",
                      onConfirm: () => deleteDayAt(indexToDelete),
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  Oturumu Sil
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeSessionEditor}
                  className="px-4 py-2 rounded-xl text-xs font-black text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={saveSessionEditor}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-violet-600 hover:bg-violet-700 shadow-sm cursor-pointer"
                >
                  Kaydet ve Sınav Planlamaya Geç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}


