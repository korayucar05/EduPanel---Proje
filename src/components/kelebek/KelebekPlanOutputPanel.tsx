import React from "react";
import { AlertTriangle, BookOpen, Calendar as CalendarIcon, CheckSquare, ChevronDown, ChevronRight, Edit2, GraduationCap, MessageCircle, Printer, Sparkles, Trash2, UserMinus } from "lucide-react";
import { getNormalizedBaseClassroom, getTeacherForStudent } from "./kelebekConflictUtils";

export function KelebekPlanOutputPanel(props: any) {
  const {
    activeSubTab, resultSubTab, currentPlan, setActiveSubTab, generatePlan, computedDates, formatTurkishDate, classrooms,
    handleExamDrop, moveExamToUnplaced, draggedExamId, draggedSource, setDraggedExamId, setDraggedSource,
    isCompatibleWithSlot, setCellExamSelector, setCurrentPlan, savedPlans, setSavedPlans, cancelSessionPlanning,
    openAbsentModal, absentStudents, selectedClassroomFilter, setSelectedClassroomFilter,
    allAbsentsWithMeta, isAbsentActionsDropdownOpen, setIsAbsentActionsDropdownOpen,
    exportAbsentStudentsPdf, setIsBulkWhatsAppModalOpen, toggleAbsentStudentMakeup,
    updateAbsentStudentMissedExam, generateWhatsAppLink, setConfirmDialog, removeAbsentStudentFromSlot, courses, selectedTerm, selectedExamNo,
    selectedSessionKey,
  } = props;

  if (activeSubTab !== 'C') return null;

  const getSessionKey = (slot: any) => {
    const id = String(slot?.id || '').trim();
    if (id) return id;
    const date = String(slot?.dateStr || 'tarih');
    const time = String(slot?.timeStr || slot?.sessionTime || 'saat');
    const session = Number(slot?.sessionIndex || 1);
    return `${date}_${time}_${session}`;
  };
  const visibleSlotEntries = currentPlan?.slots
    ? currentPlan.slots
        .map((slot: any, actualIndex: number) => ({ slot, actualIndex }))
        .filter(({ slot }: any) => !selectedSessionKey || getSessionKey(slot) === selectedSessionKey)
    : [];

        const totalScheduledExamsCount = visibleSlotEntries.reduce((acc: number, entry: any) => acc + (entry.slot.exams?.length || 0), 0);
        return (
          <div id="subtab_content_c" className="space-y-6 animate-fade-in">
            
            {currentPlan ? (
              <div className="space-y-6">
                {false ? (
                  <div className="bg-white border border-slate-100 rounded-[32px] p-8 md:p-12 text-center space-y-6 shadow-sm">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                      <Sparkles className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="space-y-2 max-w-lg mx-auto">
                      <h3 className="font-extrabold text-slate-800 text-lg">Sınav Takvimi Şablonu Oluşturuldu</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Sınav tarihlerinizi, ders saatlerinizi ve aktif oturumları başarıyla belirlediniz. Şimdi <strong>"Sınav Planla"</strong> butonuna tıklayarak, çakışmasız ve dengeli ders atamalarını yapay zeka algoritmasıyla otomatik gerçekleştirebilirsiniz.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl max-w-md mx-auto text-left border border-slate-100 text-xs text-slate-600 space-y-2">
                      <span className="font-extrabold text-slate-800 block">Şablon Özeti:</span>
                      <div>• Sınav Dönemi: <strong className="text-indigo-600">{currentPlan.term} {currentPlan.examNo}</strong></div>
                      <div>• Sınav Seansı Sayısı: <strong className="text-indigo-600">{currentPlan.slots.length} Seans</strong></div>
                    </div>

                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setActiveSubTab('B')}
                        className="h-11 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase cursor-pointer"
                      >
                        Şablonu Düzenle (B Sekmesi)
                      </button>
                      <button
                        onClick={generatePlan}
                        className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-black rounded-xl text-[14.67px] uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 animate-bounce" />
                        <span>Sınav Planla (Ders Atamalarını Yap)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>

                    {/* VIEW: Sınav Planı Tablo Görünümü */}
                    {resultSubTab === 'table' && (
                      <div className="space-y-6 animate-fade-in">
                        {/* Beautiful Modern Table */}
                        <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm overflow-hidden print:border-none print:shadow-none">
                          <div className="overflow-x-auto max-w-full">
                            <div id="print-kelebek-table" className="p-6 bg-slate-50 min-w-[800px] print:bg-white print:p-0">
                              {/* Printable Header for Table */}
                              <div className="hidden print:flex flex-col items-center text-center border-b-2 border-slate-800 pb-4 mb-6">
                                <span className="text-xl font-black uppercase tracking-tight">{currentPlan.term} {currentPlan.examNo} Ortak Sınav Planı Tablosu</span>
                                <span className="text-xs font-bold text-slate-500 mt-1">Sınıf Seviyelerine Göre Ortak Sınav Dağılımları</span>
                              </div>

                              <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs print:border-slate-400 print:shadow-none">
                                <table className="w-full table-fixed text-left border-collapse border-2 border-slate-200 text-xs">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-700 font-extrabold border-b-2 border-slate-200 uppercase text-[10px] tracking-wider">
                                      <th className="px-2 py-4 border border-slate-200 w-[110px] text-center leading-tight">Sınav Tarihi</th>
                                      <th className="p-4 border border-slate-200 text-indigo-700 bg-indigo-50/10 text-center">9. sınıf</th>
                                      <th className="p-4 border border-slate-200 text-indigo-700 bg-indigo-50/10 text-center">10. sınıf</th>
                                      <th className="p-4 border border-slate-200 text-indigo-700 bg-indigo-50/10 text-center">11. sınıf</th>
                                      <th className="p-4 border border-slate-200 text-indigo-700 bg-indigo-50/10 text-center">12. sınıf</th>
                                      <th className="p-2 border border-slate-200 w-[70px] text-center print:hidden leading-tight">Katılmayan</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y-2 divide-slate-200">
                                    {visibleSlotEntries.map(({ slot, actualIndex: sIdx }: any) => {
                                      const getExamsForGrade = (gradeKey: string) => {
                                        return slot.exams.filter((ex: any) => ex.gradeLevel && ex.gradeLevel.includes(gradeKey));
                                      };

                                      const exams9 = getExamsForGrade("9");
                                      const exams10 = getExamsForGrade("10");
                                      const exams11 = getExamsForGrade("11");
                                      const exams12 = getExamsForGrade("12");

                                      const removeExamFromSlot = (slotIndex: number, examId: string) => {
                                        const targetSlot = currentPlan?.slots?.[slotIndex];
                                        const examObj = targetSlot?.exams?.find((x: any) => String(x.id) === String(examId));
                                        if (!targetSlot || !examObj) return;
                                        if (!window.confirm(`“${examObj.courseName}” kaldırıldığında bu oturumdaki tüm ders atamaları iptal edilecektir. Devam edilsin mi?`)) return;
                                        Promise.resolve(cancelSessionPlanning(slotIndex)).catch((error) => {
                                          console.error("Oturum planı iptal edilemedi:", error);
                                          window.alert("Ders planı kaydedilemedi. Lütfen tekrar deneyiniz.");
                                        });
                                      };

                                      const renderExamsCell = (examsList: any[], slotIndex: number) => {
                                        if (examsList.length === 0) {
                                          return <div className="text-slate-300 italic text-center w-full mt-1.5">+</div>;
                                        }
                                        return (
                                          <div className="space-y-1.5 py-1">
                                            {examsList.map((ex, idx) => (
                                              <div 
                                                key={idx} 
                                                className="group flex items-center justify-between gap-1 font-extrabold text-slate-800 text-[11px] leading-tight bg-slate-50/50 p-1.5 rounded-md border border-transparent hover:border-indigo-200 transition-all"
                                              >
                                                <div className="flex-1 min-w-0 pr-1">
                                                  <div className="truncate">• {ex.courseName}</div>
                                                  <div className="text-[9px] text-indigo-600 font-medium truncate">
                                                    ({ex.classrooms?.join(', ')})
                                                  </div>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeExamFromSlot(slotIndex, ex.id);
                                                  }}
                                                  className="p-1 hover:bg-rose-100 text-rose-500 rounded transition-all cursor-pointer shrink-0 z-10 flex items-center justify-center"
                                                  title="Sınavı Kaldır"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      };

                                      const handleCellClick = (exams: any[], slotIndex: number, gradeKey: string) => {
                                        // If there are exams, we don't necessarily want to toggle the selector immediately if user clicks the whole cell,
                                        // but the user asked for "boş bir hücreye tıklandığında... açılır pencere açın" and "atanmış ise kaldırma özelliği".
                                        // We'll keep the selector opening for now to allow adding MORE exams to the same slot if needed,
                                        // as the removal is handled by the individual buttons now.
                                        setCellExamSelector({ slotIndex, gradeLevel: gradeKey });
                                      };

                                      const formatSessionTime = (label: string) => {
                                        if (!label) return "";
                                        const match = label.match(/\((.*?)\)/);
                                        return match ? match[1] : label.replace(/^[0-9]+\.\s*Oturum\s*/i, '');
                                      };

                                      return (
                                        <tr key={sIdx} className="hover:bg-slate-50/30 transition-colors">
                                          {/* Sınav Tarihi & Saati */}
                                          <td className="px-2 py-4 border border-slate-200 text-center whitespace-nowrap">
                                            <div className="font-bold text-slate-800">{formatTurkishDate(slot.dateStr)}</div>
                                            <div className="text-[10px] text-slate-400 font-medium mb-1">{slot.dayName}</div>
                                            <div className="text-[10px] font-extrabold text-indigo-700 mt-1.5 bg-indigo-50/50 inline-block px-1.5 py-0.5 rounded border border-indigo-100">
                                              {slot.timeStr || 'Saat Belirlenmedi'}
                                            </div>
                                          </td>
                                          {/* 9. Sınıf */}
                                          <td 
                                            className={`p-4 border border-slate-200 align-top cursor-pointer transition-colors ${exams9.length > 0 ? "hover:bg-rose-50/50" : "hover:bg-indigo-50/30"}`}
                                            onClick={() => handleCellClick(exams9, sIdx, "9")}
                                          >
                                            {renderExamsCell(exams9, sIdx)}
                                          </td>
                                          {/* 10. Sınıf */}
                                          <td 
                                            className={`p-4 border border-slate-200 align-top cursor-pointer transition-colors ${exams10.length > 0 ? "hover:bg-rose-50/50" : "hover:bg-indigo-50/30"}`}
                                            onClick={() => handleCellClick(exams10, sIdx, "10")}
                                          >
                                            {renderExamsCell(exams10, sIdx)}
                                          </td>
                                          {/* 11. Sınıf */}
                                          <td 
                                            className={`p-4 border border-slate-200 align-top cursor-pointer transition-colors ${exams11.length > 0 ? "hover:bg-rose-50/50" : "hover:bg-indigo-50/30"}`}
                                            onClick={() => handleCellClick(exams11, sIdx, "11")}
                                          >
                                            {renderExamsCell(exams11, sIdx)}
                                          </td>
                                          {/* 12. Sınıf */}
                                          <td 
                                            className={`p-4 border border-slate-200 align-top cursor-pointer transition-colors ${exams12.length > 0 ? "hover:bg-rose-50/50" : "hover:bg-indigo-50/30"}`}
                                            onClick={() => handleCellClick(exams12, sIdx, "12")}
                                          >
                                            {renderExamsCell(exams12, sIdx)}
                                          </td>
                                          {/* Sınava Girmeyen Ekleme */}
                                          <td className="p-4 align-middle text-center print:hidden">
                                            <button
                                              onClick={() => openAbsentModal(slot.dayIndex !== undefined ? slot.dayIndex : sIdx)}
                                              className="h-8 w-8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center justify-center mx-auto shadow-xs transition-all cursor-pointer"
                                              title="Bu seansa girmeyen öğrenci ekle"
                                            >
                                              <UserMinus className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW 1: Grid/Matrix View */}
                    {resultSubTab === 'grid' && (
                      <div className="space-y-6">
                        {/* Drag-and-drop side-drawer for unplaced exams */}
                        {currentPlan.unplacedExams && currentPlan.unplacedExams.length > 0 && (
                          <div className="bg-rose-50 border border-rose-200 rounded-[24px] p-5 space-y-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                              <div>
                                <span className="text-xs font-extrabold text-rose-800 block uppercase">Yerleştirilemeyen / Kılavuz Dışı Kalan Dersler ({currentPlan.unplacedExams.length})</span>
                                <p className="text-[10px] text-rose-500 leading-relaxed">Sınav yoğunluğundan dolayı otomatik dağıtılamayan dersler aşağıdadır. Bunları takvimdeki boş seanslara sürükleyerek yerleştirebilirsiniz:</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {currentPlan.unplacedExams.map((ex: any) => (
                                <div
                                  key={ex.id}
                                  draggable
                                  onDragStart={() => {
                                    setDraggedExamId(ex.id);
                                    setDraggedSource({ type: "unplaced" });
                                  }}
                                  className="bg-white border border-rose-200 hover:border-indigo-400 p-2.5 rounded-xl shadow-xs text-xs font-bold cursor-grab active:cursor-grabbing flex items-center gap-2 transition-all"
                                >
                                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                  <span>{ex.gradeLevel} - {ex.courseName} ({ex.classrooms.length} Şube)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div id="print-kelebek-schedule" className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
                          {/* Printable Header */}
                          <div className="hidden print:flex flex-col items-center text-center border-b-2 border-slate-800 pb-4 mb-4">
                            <span className="text-xl font-black uppercase tracking-tight">{currentPlan.term} {currentPlan.examNo} Sınav Takvimi</span>
                            <span className="text-xs font-bold text-slate-500 mt-1">Sınav Ortak Planı Matris Dağılımı</span>
                          </div>

                          <div className="flex flex-col gap-6">
                            {currentPlan.days.map((dayLabel, dayIdx) => {
                              const [dateStr, dayName = ""] = dayLabel.includes("|")
                                ? dayLabel.split("|")
                                : [dayLabel.split(" ")[0], dayLabel.split(" ").slice(1).join(" ")];
                              const daySlots = currentPlan.slots
                                .filter(s => s.dateStr === dateStr)
                                .sort((a, b) => Number(a.sessionIndex || 1) - Number(b.sessionIndex || 1));

                              return (
                                <div key={dayIdx} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 print:bg-white print:p-0 print:border-none print:shadow-none break-inside-avoid">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4 print:border-slate-800 print:mb-2">
                                    <div className="flex items-center gap-2">
                                      <CalendarIcon className="w-4.5 h-4.5 text-indigo-600 print:hidden" />
                                      <h3 className="font-black text-slate-800 text-sm md:text-base">{formatTurkishDate(dateStr)} - {dayName}</h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 print:hidden">
                                      {daySlots.length} Oturum Aktif
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-4">
                                    {daySlots.map((slot, sIdx) => {
                                      const isCompatible = draggedExamId ? isCompatibleWithSlot(draggedExamId, slot, draggedSource) : false;

                                      return (
                                        <div
                                          key={sIdx}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={() => {
                                            if (draggedExamId && draggedSource) {
                                              handleExamDrop(draggedExamId, draggedSource, slot.dateStr!, slot.sessionIndex);
                                            }
                                          }}
                                          className={`border rounded-xl p-4 transition-all ${
                                            draggedExamId 
                                              ? isCompatible 
                                                ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20" 
                                                : "bg-slate-100/50 border-dashed border-slate-200 opacity-40"
                                              : "bg-white border-slate-200/60"
                                          } print:border-slate-400 print:shadow-none`}
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-2 mb-3 print:border-slate-300">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded print:border print:border-slate-800 print:bg-white print:text-black">
                                              {slot.timeStr || 'Saat Belirlenmedi'}
                                            </span>
                                            {slot.makeupDateStr && (
                                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 print:bg-white print:text-black print:border-black">
                                                Telafi: {formatTurkishDate(slot.makeupDateStr)}
                                              </span>
                                            )}
                                          </div>

                                          {slot.exams.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic block py-4 text-center print:text-slate-500">
                                              Bu oturum boş (Sürükleyip ders bırakabilirsiniz)
                                            </span>
                                          ) : (
                                            <div className="space-y-3.5">
                                              {slot.exams.map((ex) => (
                                                <div
                                                  key={ex.id}
                                                  draggable
                                                  onDragStart={() => {
                                                    setDraggedExamId(ex.id);
                                                    setDraggedSource({ type: "slot", dateStr: slot.dateStr, sessionIndex: slot.sessionIndex });
                                                  }}
                                                  className="group relative border-l-4 border-indigo-500 pl-3 py-1 bg-slate-50/50 rounded-r-lg cursor-grab active:cursor-grabbing hover:bg-indigo-50/30 transition-all print:border-l-2 print:border-black print:bg-white"
                                                >
                                                  {/* Delete button (returns to unplaced) */}
                                                  <button
                                                    onClick={() => moveExamToUnplaced(ex.id, slot.dateStr!, slot.sessionIndex)}
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 transition-all cursor-pointer print:hidden"
                                                    title="Sınavı Kaldır"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>

                                                  <div className="flex items-baseline justify-between gap-2 flex-wrap pr-4">
                                                    <span className="font-extrabold text-slate-800 text-xs md:text-sm">
                                                      {ex.gradeLevel} - {ex.courseName}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider print:text-slate-800">
                                                      {ex.schedule}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {ex.classrooms.map(cls => (
                                                      <span key={cls} className="text-[9px] font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/50 print:bg-white print:border-slate-400 print:text-black">
                                                        {cls}
                                                      </span>
                                                    ))}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW 2: Classroom Specific Agenda */}
                    {resultSubTab === 'classroom' && (
                      <div className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4 print:hidden">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400 uppercase">Sınıf Seçimi:</span>
                            <div className="relative">
                              <select
                                value={selectedClassroomFilter}
                                onChange={(e) => setSelectedClassroomFilter(e.target.value)}
                                className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 appearance-none focus:outline-none"
                              >
                                {classrooms.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500">Seçili sınıfa ait tüm günlerin sınav programını listeler.</p>
                        </div>

                        {/* Printable classroom schedules */}
                        <div id="print-kelebek-classroom-agenda" className="space-y-8">
                          {classrooms
                            .filter(cls => !selectedClassroomFilter || cls === selectedClassroomFilter)
                            .map(cls => {
                              return (
                                <div key={cls} className="border border-slate-100 rounded-2xl p-6 bg-slate-50/30 print:border-slate-800 print:bg-white print:p-0 print:border-none print:shadow-none break-after-page">
                                  
                                  {/* Printable title */}
                                  <div className="border-b border-slate-100 pb-3 mb-4 print:border-b-2 print:border-slate-800 flex justify-between items-center">
                                    <span className="font-extrabold text-base text-slate-800 flex items-center gap-2 print:text-lg">
                                      <GraduationCap className="w-5 h-5 text-indigo-500 print:hidden" />
                                      {cls} Sınav Giriş Programı
                                    </span>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider print:text-slate-800">
                                      {currentPlan.term} • {currentPlan.examNo}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-4">
                                    {currentPlan.days.map((dayLabel, dayIdx) => {
                                      const [dateStr, dayName = ""] = dayLabel.includes("|")
                                        ? dayLabel.split("|")
                                        : [dayLabel.split(" ")[0], dayLabel.split(" ").slice(1).join(" ")];
                                      
                                      const daySlots = currentPlan.slots
                                        .filter(s => s.dateStr === dateStr)
                                        .sort((a, b) => Number(a.sessionIndex || 1) - Number(b.sessionIndex || 1));
                                      
                                      return (
                                        <div key={dayIdx} className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-xs print:border-slate-400 print:shadow-none">
                                          <h4 className="font-extrabold text-xs text-slate-700 border-b border-slate-50 pb-1.5 mb-2.5 print:border-slate-400 print:text-black">
                                            {formatTurkishDate(dateStr)} - {dayName}
                                          </h4>

                                          <div className="space-y-3">
                                            {daySlots.map((slot, sIdx) => {
                                              const examForClass = slot.exams.find(ex => ex.classrooms.includes(cls));
                                              
                                              return (
                                                <div key={sIdx} className="flex justify-between items-baseline gap-4 py-1 text-xs">
                                                  <span className="font-bold text-slate-400 uppercase text-[10px] print:text-slate-800 shrink-0">
                                                    {slot.sessionLabel || `${sIdx + 1}. Sınav`}:
                                                  </span>
                                                  {examForClass ? (
                                                    <div className="flex flex-col items-end">
                                                      <span className="font-extrabold text-slate-800 text-right print:text-black">
                                                        {examForClass.courseName}
                                                      </span>
                                                      {slot.makeupDateStr && (
                                                        <span className="text-[9px] font-bold text-rose-500 bg-rose-50/50 border border-rose-100/50 px-1.5 py-0.5 rounded mt-0.5">
                                                          Telafi: {formatTurkishDate(slot.makeupDateStr)}
                                                        </span>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400 italic text-right print:text-slate-500">
                                                      Boş (Sınav Yok)
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* VIEW 3: Sınava Katılmayan Öğrenciler Raporu - Modal ile Gösterilecektir */}
                    {false && (
                      <div className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                            <span className="font-extrabold text-slate-800 text-sm">Sınava Katılmayanlar</span>
                          </div>
                          
                          {/* RED ACTIONS DROPDOWN BUTTON ("İşlemler") */}
                          <div className="relative">
                            <button
                              onClick={() => setIsAbsentActionsDropdownOpen(!isAbsentActionsDropdownOpen)}
                              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            >
                              <span>İşlemler</span>
                              <ChevronDown className={`w-4 h-4 transition-transform ${isAbsentActionsDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isAbsentActionsDropdownOpen && (
                              <>
                                {/* Overlay backing to close dropdown when clicking outside */}
                                <div 
                                  className="fixed inset-0 z-40 cursor-default" 
                                  onClick={() => setIsAbsentActionsDropdownOpen(false)} 
                                />
                                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 animate-fade-in">
                                  <button
                                    onClick={() => {
                                      setIsAbsentActionsDropdownOpen(false);
                                      exportAbsentStudentsPdf();
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-extrabold text-slate-700 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Listeyi Yazdır</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setIsAbsentActionsDropdownOpen(false);
                                      setIsBulkWhatsAppModalOpen(true);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-extrabold text-slate-700 flex items-center gap-2 cursor-pointer"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Toplu Mesaj Gönder</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const allAbsentsWithMeta = computedDates.flatMap((d, dIdx) => {
                            if (!d.absentStudents || d.absentStudents.length === 0) return [];
                            return d.absentStudents.map(student => {
                              let finalMissedExam = student.missedExam;
                              // Dynamically compute if missing or just to ensure latest data
                              if (student.missedExamOverride) {
                                finalMissedExam = student.missedExamOverride;
                              } else if (currentPlan && currentPlan.slots && currentPlan.slots[dIdx]) {
                                const slot = currentPlan.slots[dIdx];
                                const slotExams = slot.exams || [];
                                const studentClassNorm = student.classroom ? getNormalizedBaseClassroom(student.classroom) : "";
                                
                                // Try to find the exact exam that matches the previously saved missedExam base name
                                let targetExam = slotExams.find(ex => student.missedExam && student.missedExam.startsWith(ex.courseName));
                                
                                if (!targetExam) {
                                  targetExam = slotExams.find(ex => 
                                    ex.classrooms && ex.classrooms.some(clsLabel => getNormalizedBaseClassroom(clsLabel) === studentClassNorm)
                                  );
                                }
                                
                                if (!targetExam && slotExams.length > 0) {
                                  targetExam = slotExams[0];
                                }
                                
                                if (targetExam) {
                                  const teacherName = getTeacherForStudent(student.classroom, targetExam.courseName, courses);
                                  finalMissedExam = `${targetExam.courseName} (${teacherName})`;
                                }
                              }

                              return {
                                ...student,
                                missedExam: finalMissedExam || "Ortak Sınav",
                                dayIndex: dIdx,
                                dateStr: d.dateStr,
                                dayName: d.dayName,
                                sessionLabel: d.sessionIndex ? `${d.sessionIndex}. Oturum` : "Oturum Belirtilmedi",
                                lessonHour: d.lessonHour,
                                makeupDateStr: d.makeupDateStr,
                                makeupDayName: d.makeupDayName
                              };
                            });
                          });

                          if (allAbsentsWithMeta.length === 0) {
                            return (
                              <div className="text-center py-10 space-y-3">
                                <CheckSquare className="w-12 h-12 text-emerald-500 mx-auto animate-pulse" />
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-700">Tebrikler, Eksiksiz Katılım!</p>
                                  <p className="text-xs text-slate-500">Sınava girmeyen hiçbir öğrenci kaydı bulunamadı.</p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div id="print-kelebek-absents" className="space-y-6">
                              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                                      <th className="p-3 w-10 text-center" title="Telafi Sınavına Girecek">
                                        <CheckSquare className="w-4 h-4 mx-auto text-slate-400" />
                                      </th>
                                      <th className="p-3">Sınav Tarihi / Oturum</th>
                                      <th className="p-3">Öğrenci Sınıf / No</th>
                                      <th className="p-3">Öğrenci Adı Soyadı</th>
                                      <th className="p-3">Asıl Sınav Saati</th>
                                      <th className="p-3 text-rose-600">Girmediği Ortak Sınav</th>
                                      <th className="p-3 text-rose-600">Telafi Sınav Tarihi</th>
                                      <th className="p-3 text-center print:hidden">İşlem</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {allAbsentsWithMeta.map((item, idx) => (
                                      <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${item.canTakeMakeup ? "bg-indigo-50/20" : ""}`}>
                                        <td className="p-3 text-center">
                                          <div className="print:hidden">
                                            <input 
                                              type="checkbox" 
                                              checked={!!item.canTakeMakeup}
                                              onChange={() => toggleAbsentStudentMakeup(item.dayIndex, item.id)}
                                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                              title="Telafi Sınavına Girecek"
                                            />
                                          </div>
                                          <div className="hidden print:flex items-center justify-center">
                                            {item.canTakeMakeup ? (
                                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                                            ) : (
                                              <div className="w-4 h-4 border-2 border-slate-300 rounded"></div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-3 font-extrabold text-slate-700">
                                          <div>{formatTurkishDate(item.dateStr)}</div>
                                          <div className="text-[10px] text-indigo-600 font-bold">{item.dayName} • {item.sessionLabel}</div>
                                        </td>
                                        <td className="p-3 font-bold text-slate-600">
                                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded mr-1.5 text-[10px]">{item.classroom}</span>
                                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">No: {item.studentNumber}</span>
                                        </td>
                                        <td className="p-3 font-extrabold text-slate-800">
                                          {item.name} {item.surname}
                                        </td>
                                        <td className="p-3 font-medium text-slate-500">
                                          {item.lessonHour}. Ders Saati
                                        </td>
                                        <td className="p-3 font-bold text-rose-600">
                                          {item.missedExam || <span className="text-slate-400 italic">Belirtilmedi</span>}
                                        </td>
                                        <td className="p-3">
                                          {item.makeupDateStr ? (
                                            <div className="text-rose-600 font-extrabold">
                                              <div>{formatTurkishDate(item.makeupDateStr)}</div>
                                              <div className="text-[10px] text-rose-500 font-bold">{item.makeupDayName} ({item.lessonHour}. Ders Saati)</div>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 italic">Belirlenmedi</span>
                                          )}
                                        </td>
                                        <td className="p-3 print:hidden">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => {
                                                const newText = window.prompt("Öğretmen bilgisini / Sınav adını düzenle:", item.missedExam || "");
                                                if (newText !== null && newText.trim() !== "") {
                                                  updateAbsentStudentMissedExam(item.dayIndex, item.id, newText.trim());
                                                }
                                              }}
                                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                                              title="Sınav/Öğretmen Bilgisini Düzenle"
                                            >
                                              <Edit2 className="w-3.5 h-3.5 mx-auto" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                const teacherNameMatch = item.missedExam ? item.missedExam.match(/\(([^)]+)\)$/) : null;
                                                const teacherName = teacherNameMatch ? teacherNameMatch[1] : "Öğretmen";
                                                const link = generateWhatsAppLink(teacherName, [item]);
                                                window.open(link, '_blank');
                                              }}
                                              className="p-1.5 hover:bg-[#25D366]/10 text-[#25D366] rounded-lg transition-colors cursor-pointer"
                                              title="Öğretmene WhatsApp ile Bildir"
                                            >
                                              <MessageCircle className="w-3.5 h-3.5 mx-auto" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setConfirmDialog({
                                                  isOpen: true,
                                                  message: "Bu öğrenciyi devamsızlık listesinden kaldırmak istediğinize emin misiniz?",
                                                  onConfirm: () => removeAbsentStudentFromSlot(item.dayIndex, item.id)
                                                });
                                              }}
                                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                              title="Listeden Kaldır"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-[32px] p-12 shadow-sm text-center space-y-4">
                <BookOpen className="w-16 h-16 mx-auto text-indigo-100 animate-bounce" />
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-lg">Sınav Planı Hazırlanmadı</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Şu anda görüntülenecek aktif bir sınav takvimi bulunmuyor. Lütfen Sınav Takvimi sekmesinden parametrelerinizi belirleyerek sınav planınızı oluşturun.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSubTab('B')}
                  className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white px-6 font-extrabold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer text-xs uppercase shadow-md"
                >
                  <span>Sınav Takvimine Git</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
  
          </div>
        );

}


