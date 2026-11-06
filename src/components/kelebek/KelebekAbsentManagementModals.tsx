import { Save } from "lucide-react";
import React from 'react';
import { AlertTriangle, Check, CheckSquare, Edit2, MessageCircle, Plus, Printer, Search, Send, Trash2, X } from 'lucide-react';

interface Props { [key: string]: any }

export function KelebekAbsentManagementModals(props: Props) {
  const {
    isAbsentModalOpen, setIsAbsentModalOpen, selectedDayIndex, computedDates, formatTurkishDate,
    removeAbsentStudentFromSlot, absentStudentSearchQuery, setAbsentStudentSearchQuery, searchedStudentsForAbsent,
    selectedStudentForAbsent, setSelectedStudentForAbsent, currentPlan, selectedMissedExam, addAbsentStudentToSlot,
    getNormalizedBaseClassroom, getTeacherForStudent, courses, isBulkWhatsAppModalOpen, setIsBulkWhatsAppModalOpen,
    generateWhatsAppLink, isAbsentReportModalOpen, setIsAbsentReportModalOpen, exportAbsentStudentsPdf,
    toggleAbsentStudentMakeup, updateAbsentStudentMissedExam, setConfirmDialog
  } = props;
  return <>
      {/* Sınava Katılmayan Öğrenci Ekleme Çılır Penceresi (Modal) */}
      {isAbsentModalOpen && selectedDayIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in print:hidden">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 md:p-8 max-w-lg w-full mx-4 max-h-[90vh] flex flex-col relative animate-scale-up">
            {/* Close Button */}
            <button
              onClick={() => setIsAbsentModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-5 space-y-1">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-black text-slate-800 text-base">Sınava Girmeyen Öğrenci Ekle</h3>
              </div>
              {computedDates[selectedDayIndex] && (
                <p className="text-xs text-slate-500 font-medium">
                  {formatTurkishDate(computedDates[selectedDayIndex].dateStr)} • {computedDates[selectedDayIndex].sessionIndex}. Oturum ({computedDates[selectedDayIndex].lessonHour}. Ders)
                </p>
              )}
            </div>

            {/* Content Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin">
              {/* Show currently added students for this slot */}
              {computedDates[selectedDayIndex] && computedDates[selectedDayIndex].absentStudents && computedDates[selectedDayIndex].absentStudents.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Bu Oturuma Eklenen Öğrenciler ({computedDates[selectedDayIndex].absentStudents.length})</span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2 w-[80px]">Sınıf/No</th>
                          <th className="p-2">Ad Soyad</th>
                          <th className="p-2">Girmediği Ders</th>
                          <th className="p-2 text-center w-[50px]">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {computedDates[selectedDayIndex].absentStudents.map((absStudent) => (
                          <tr key={absStudent.id} className="hover:bg-slate-50">
                            <td className="p-2 font-medium">
                              <div className="flex items-center gap-1">
                                <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-[9px]">{absStudent.classroom}</span>
                                <span className="text-[10px]">No:{absStudent.studentNumber}</span>
                              </div>
                            </td>
                            <td className="p-2 font-bold text-slate-800">{absStudent.name} {absStudent.surname}</td>
                            <td className="p-2 text-rose-600 font-medium text-[10px] leading-tight">{absStudent.missedExam || "Ortak Sınav"}</td>
                            <td className="p-2 text-center">
                              <button 
                                onClick={() => removeAbsentStudentFromSlot(selectedDayIndex, absStudent.id)}
                                className="p-1 hover:bg-rose-100 text-rose-500 rounded transition-colors" 
                                title="Listeden Çıkar"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Student Search bar */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Öğrenci Arama (Ad Soyad / Okul No)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={absentStudentSearchQuery}
                    onChange={(e) => {
                      setAbsentStudentSearchQuery(e.target.value);
                      setSelectedStudentForAbsent(null); // Clear selected student when query changes
                    }}
                    placeholder="Öğrenci adı, soyadı veya okul numarası yazın..."
                    className="w-full h-10 pl-9 pr-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-medium transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Searched students list */}
              {absentStudentSearchQuery.trim() !== "" && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Arama Sonuçları ({searchedStudentsForAbsent.length})</span>
                  {searchedStudentsForAbsent.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto scrollbar-thin">
                      {searchedStudentsForAbsent.map((student) => {
                        const isSelected = selectedStudentForAbsent?.id === student.id;
                        return (
                          <button
                            key={student.id}
                            onClick={() => setSelectedStudentForAbsent(student)}
                            className={`w-full p-3 text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                              isSelected ? "bg-indigo-50 text-indigo-900 font-extrabold" : "bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <span className="font-extrabold block">{student.name}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">{student.classroom}</span>
                                <span>No: {student.id}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic text-center py-4">Öğrenci bulunamadı.</p>
                  )}
                </div>
              )}

              {/* Show Selected Student Confirmation Details */}
              {selectedStudentForAbsent && (() => {
                let computedMissedExam = "Ortak Sınav";
                if (currentPlan && currentPlan.slots && currentPlan.slots[selectedDayIndex]) {
                  const slot = currentPlan.slots[selectedDayIndex];
                  const slotExams = slot.exams || [];
                  const studentClassNorm = selectedStudentForAbsent.classroom ? getNormalizedBaseClassroom(selectedStudentForAbsent.classroom) : "";
                  
                  let targetExam = selectedMissedExam ? slotExams.find(ex => ex.courseName === selectedMissedExam) : undefined;
                  
                  if (!targetExam) {
                    targetExam = slotExams.find(ex => 
                      ex.classrooms && ex.classrooms.some(clsLabel => getNormalizedBaseClassroom(clsLabel) === studentClassNorm)
                    );
                  }
                  
                  if (!targetExam && slotExams.length > 0) {
                    targetExam = slotExams[0];
                  }
                  
                  if (targetExam) {
                    const teacherName = getTeacherForStudent(selectedStudentForAbsent.classroom, targetExam.courseName, courses);
                    computedMissedExam = `${targetExam.courseName} (${teacherName})`;
                  }
                }
                
                return (
                  <div className="space-y-3">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <span className="font-extrabold text-emerald-900">Seçilen Öğrenci Onayı:</span>
                        <p className="text-slate-600 font-medium">
                          {selectedStudentForAbsent.name} (Sınıf: {selectedStudentForAbsent.classroom}, No: {selectedStudentForAbsent.id})
                        </p>
                      </div>
                    </div>
                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3.5 text-xs text-rose-700 font-bold flex items-center gap-2">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0"></div>
                      <span>Girmediği Ortak Sınav: {computedMissedExam}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action buttons footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsAbsentModalOpen(false)}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                disabled={!selectedStudentForAbsent}
                onClick={() => {
                  if (selectedStudentForAbsent && selectedDayIndex !== null) {
                    addAbsentStudentToSlot(selectedDayIndex, selectedStudentForAbsent, selectedMissedExam);
                    setIsAbsentModalOpen(false);
                  }
                }}
                className={`h-10 px-5 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedStudentForAbsent
                    ? "bg-rose-600 hover:bg-rose-700 shadow-sm"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Listeye Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toplu WhatsApp Mesajı Modal */}
      {isBulkWhatsAppModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in print:hidden">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 md:p-8 max-w-lg w-full mx-4 max-h-[90vh] flex flex-col relative animate-scale-up">
            <button
              onClick={() => setIsBulkWhatsAppModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-5 space-y-1">
              <div className="flex items-center gap-2 text-[#25D366]">
                <MessageCircle className="w-5 h-5" />
                <h3 className="font-black text-slate-800 text-base">Toplu WhatsApp Bildirimi</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">Öğretmenlere devamsızlık bilgisini WhatsApp üzerinden iletin.</p>
            </div>
            
            <div className="overflow-y-auto flex-1 min-h-0 pr-2 space-y-3 custom-scrollbar">
              {(() => {
                const allAbsentsWithMeta = computedDates.flatMap((d, dIdx) => {
                  if (!d.absentStudents) return [];
                  return d.absentStudents.map(student => {
                    let finalMissedExam = student.missedExam;
                    if (student.missedExamOverride) {
                      finalMissedExam = student.missedExamOverride;
                    } else if (currentPlan && currentPlan.slots && currentPlan.slots[dIdx]) {
                      const slot = currentPlan.slots[dIdx];
                      const slotExams = slot.exams || [];
                      const studentClassNorm = student.classroom ? getNormalizedBaseClassroom(student.classroom) : "";
                      let targetExam = slotExams.find(ex => student.missedExam && student.missedExam.startsWith(ex.courseName));
                      if (!targetExam) {
                        targetExam = slotExams.find(ex => ex.classrooms && ex.classrooms.some(clsLabel => getNormalizedBaseClassroom(clsLabel) === studentClassNorm));
                      }
                      if (!targetExam && slotExams.length > 0) {
                        targetExam = slotExams[0];
                      }
                      if (targetExam) {
                        const tName = getTeacherForStudent(student.classroom, targetExam.courseName, courses);
                        finalMissedExam = `${targetExam.courseName} (${tName})`;
                      }
                    }
                    return { ...student, missedExam: finalMissedExam || "Ortak Sınav" };
                  });
                });

                const teacherMap = new Map<string, any[]>();
                allAbsentsWithMeta.forEach(student => {
                  const teacherNameMatch = student.missedExam ? student.missedExam.match(/\(([^)]+)\)$/) : null;
                  const teacherName = teacherNameMatch ? teacherNameMatch[1] : "Öğretmen";
                  if (!teacherMap.has(teacherName)) teacherMap.set(teacherName, []);
                  teacherMap.get(teacherName)!.push(student);
                });

                if (teacherMap.size === 0) {
                  return (
                    <div className="text-center py-10 space-y-3">
                      <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-500">Bildirilecek öğrenci bulunmuyor.</p>
                    </div>
                  );
                }

                return Array.from(teacherMap.entries()).map(([tName, students], idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-700 text-sm">{tName}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{students.length} Öğrenci</div>
                    </div>
                    <button
                      onClick={() => {
                        const link = generateWhatsAppLink(tName, students);
                        window.open(link, '_blank');
                      }}
                      className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Gönder</span>
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sınava Katılmayan Öğrenciler Raporu Açılır Penceresi (Modal) */}
      {isAbsentReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in print:hidden">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 md:p-8 max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col relative animate-scale-up">
            {/* Close Button */}
            <button
              onClick={() => setIsAbsentReportModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 animate-pulse" />
                <div>
                  <h3 className="font-black text-slate-800 text-lg">Sınava Katılmayan Öğrenciler Raporu</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Sınav döneminde ortak sınavlara girmeyen ve mazeretli/katılmayan olarak işaretlenen tüm öğrencilerin listesi</p>
                </div>
              </div>
              
              {/* Actions & WhatsApp buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={exportAbsentStudentsPdf}
                  className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[14.67px] font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Listeyi Yazdır (PDF)</span>
                </button>

                <button
                  onClick={() => setIsBulkWhatsAppModalOpen(true)}
                  className="h-9 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Toplu Mesaj Gönder</span>
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-1">
              {(() => {
                const allAbsentsWithMeta = computedDates.flatMap((d, dIdx) => {
                  if (!d.absentStudents || d.absentStudents.length === 0) return [];
                  return d.absentStudents.map(student => {
                    let finalMissedExam = student.missedExam;
                    if (student.missedExamOverride) {
                      finalMissedExam = student.missedExamOverride;
                    } else if (currentPlan && currentPlan.slots && currentPlan.slots[dIdx]) {
                      const slot = currentPlan.slots[dIdx];
                      const slotExams = slot.exams || [];
                      const studentClassNorm = student.classroom ? getNormalizedBaseClassroom(student.classroom) : "";
                      
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
                    <div className="text-center py-16 space-y-3">
                      <CheckSquare className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                      <div className="space-y-1">
                        <p className="text-base font-bold text-slate-700">Tebrikler, Eksiksiz Katılım!</p>
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

            {/* Footer with Save/Close button */}
            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setIsAbsentReportModalOpen(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Save className="w-4 h-4" />
                <span>Değişiklikleri Kaydet ve Kapat</span>
              </button>
            </div>
          </div>
        </div>
      )}


  </>;
}

