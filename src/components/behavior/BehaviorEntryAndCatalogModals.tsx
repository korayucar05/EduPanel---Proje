import React from "react";
import { Calendar, Plus, Search, X, ChevronDown } from "lucide-react";

type CustomBehavior = any;
type Sanction = any;
type Reward = any;

export function BehaviorRecordModal(props: any) {
  const {
    isModalOpen, recordReason, setRecordReason, closeModal, complainantSearchQuery, setComplainantSearchQuery,
    filteredComplainants, selectedComplainantsList, setSelectedComplainantsList, getStudentSchoolNumber,
    complaintRegulationArticle, setComplaintRegulationArticle, searchQuery, setSearchQuery, filteredStudents, allStudents,
    selectedStudentsList, setSelectedStudentsList, selectedStudent, setSelectedStudent, isJointBehavior,
    setIsJointBehavior, behaviorSearchQuery, setBehaviorSearchQuery, filteredBehaviorsForSelect, behaviorName,
    setBehaviorName, behaviorType, setBehaviorType, behaviorSanctionType, setBehaviorSanctionType, description,
    setDescription, studentDescriptions, setStudentDescriptions, date, setDate, saveRecord, isTeacherLinkView, editingRecordId, customBehaviors, normalizeStudentSearchText
  } = props;
  const [pendingStudent, setPendingStudent] = React.useState<any | null>(null);
  const [pendingStudentDescription, setPendingStudentDescription] = React.useState("");
  const [pendingBulkStudents, setPendingBulkStudents] = React.useState<any[]>([]);
  const [bulkSelectionError, setBulkSelectionError] = React.useState("");

  const handleBulkStudentEnter = () => {
    if (!searchQuery.includes(",")) return false;
    const numbers = searchQuery.split(",").map((part: string) => part.trim());
    if (numbers.some((number: string) => !/^\d+$/.test(number))) {
      setBulkSelectionError("Öğrenci numaralarını yalnızca virgülle ayırarak giriniz (örnek: 62, 458, 713).");
      return true;
    }
    const uniqueNumbers = Array.from(new Set(numbers));
    const found: any[] = [];
    const missing: string[] = [];
    for (const number of uniqueNumbers) {
      const matches = (allStudents || []).filter((student: any) => String(getStudentSchoolNumber(student) ?? "").trim() === number);
      if (matches.length !== 1) missing.push(number);
      else found.push(matches[0]);
    }
    if (missing.length) {
      setBulkSelectionError(`Bulunamayan veya birden fazla eşleşen öğrenci numarası: ${missing.join(", ")}. Hiçbir öğrenci eklenmedi.`);
      return true;
    }
    setBulkSelectionError("");
    setPendingBulkStudents(found);
    setPendingStudentDescription("");
    return true;
  };
  const sortedSelectedStudents = React.useMemo(() => {
    const toNumber = (student: any) => {
      const raw = String(getStudentSchoolNumber(student) ?? "").replace(/\D/g, "");
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    };
    return [...selectedStudentsList].sort((a: any, b: any) => {
      const numberDiff = toNumber(a) - toNumber(b);
      if (numberDiff !== 0) return numberDiff;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "tr", { sensitivity: "base" });
    });
  }, [selectedStudentsList, getStudentSchoolNumber]);
  return (
    <>
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0 sticky top-0 bg-white/95 backdrop-blur z-10">
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-teal-600" />
                  Yeni Davranış Girişi
                </h3>
                {/* Kayıt sebebi açılır butonu */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Kayıt Sebebi:</span>
                  <select
                    value={recordReason}
                    onChange={(e) => setRecordReason(e.target.value as "Tutanak" | "Şikayet")}
                    className="bg-transparent text-xs font-bold text-teal-700 focus:outline-none cursor-pointer border-0 p-0 pr-1"
                  >
                    <option value="Tutanak">Tutanak</option>
                    <option value="Şikayet">Şikayet</option>
                  </select>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Complainant Selection section (only shown if recordReason is Şikayet) */}
              {recordReason === "Şikayet" && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    Şikayetçi Öğrenci Seçimi (Birden fazla seçebilirsiniz)
                  </label>
                  
                  {/* Complainant Search Input */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Şikayetçi öğrenci eklemek için arayın (Ad Soyadı veya Okul No)..."
                        value={complainantSearchQuery}
                        onChange={(e) => setComplainantSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />
                    </div>
                    {complainantSearchQuery.length > 1 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto relative z-30 bg-white shadow-lg">
                        {filteredComplainants.length > 0 ? (
                          filteredComplainants
                            .filter(student => !selectedComplainantsList.some(s => s.id === student.id))
                            .map(student => (
                              <button
                                type="button"
                                key={student.id}
                                onClick={() => {
                                  setSelectedComplainantsList([...selectedComplainantsList, student]);
                                  setComplainantSearchQuery("");
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-slate-100 last:border-0 text-sm flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="font-semibold text-slate-800">{student.name}</span>
                                <span className="text-xs text-slate-500 font-medium">{student.classroom} - {student.id}</span>
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500">Öğrenci bulunamadı.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Complainants List */}
                  {selectedComplainantsList.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedComplainantsList.map((student) => (
                        <div key={student.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl animate-fade-in">
                          <div className="w-6 h-6 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold text-xs">
                            {student.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-teal-900 text-xs">{student.name}</div>
                            <div className="text-[10px] text-teal-700 font-medium">{student.classroom} - {student.id}</div>
                            {studentDescriptions?.[student.id] && (
                              <div className="text-[10px] text-slate-500 max-w-[220px] truncate" title={studentDescriptions[student.id]}>
                                {studentDescriptions[student.id]}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedComplainantsList(selectedComplainantsList.filter(s => s.id !== student.id));
                            }}
                            className="text-teal-600 hover:bg-teal-200 p-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Regulation Article Selection */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Şikayet Konusu Yönetmelik Maddesi
                    </label>
                    <select
                      value={complaintRegulationArticle}
                      onChange={(e) => setComplaintRegulationArticle(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-slate-700 font-medium"
                    >
                      <option value="">Belirtilmedi</option>
                      {Array.from(new Set(customBehaviors.filter(b => b.article).map(b => `Madde ${b.article}`))).map((articleText, idx) => (
                        <option key={idx} value={String(articleText)}>{String(articleText)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Behavior Selection and Joint Checkbox */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Davranış Seçimi</label>
                  {!behaviorName ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Davranış ara..."
                          value={behaviorSearchQuery}
                          onChange={(e) => setBehaviorSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        />
                      </div>
                      {behaviorSearchQuery.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto relative z-30 bg-white shadow-lg">
                          {filteredBehaviorsForSelect.length > 0 ? (
                            filteredBehaviorsForSelect.map(behavior => (
                              <button
                                type="button"
                                key={behavior.id}
                                onClick={() => {
                                  setBehaviorType(behavior.type);
                                  setBehaviorName(behavior.name);
                                  setBehaviorSanctionType(behavior.sanctionType);
                                  setBehaviorSearchQuery("");
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-slate-100 last:border-0 text-sm flex flex-col gap-1 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-semibold text-slate-800">{behavior.name}</span>
                                  <span className={`text-xs font-bold px-2 py-1 rounded-md shrink-0 ${
                                    behavior.type === 'Olumlu' ? 'bg-emerald-100 text-emerald-700' :
                                    behavior.type === 'Olumsuz' ? 'bg-rose-100 text-rose-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>{behavior.type}</span>
                                </div>
                                {behavior.article && (
                                  <div className="text-[10px] text-slate-500 font-medium">Madde {behavior.article}: {behavior.content}</div>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500">Davranış bulunamadı.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-xl h-[54px]">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                          behaviorType === 'Olumlu' ? 'bg-emerald-100 text-emerald-700' :
                          behaviorType === 'Olumsuz' ? 'bg-rose-100 text-rose-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {behaviorType.charAt(0)}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-teal-900 text-sm truncate">{behaviorName}</div>
                          <div className="text-xs text-teal-700 font-medium truncate">{behaviorType} {behaviorSanctionType ? `(${behaviorSanctionType})` : ''}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBehaviorName("");
                          setBehaviorSanctionType(undefined);
                        }}
                        className="text-teal-600 hover:bg-teal-200 p-2 rounded-lg transition-colors text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Değiştir
                      </button>
                    </div>
                  )}
                </div>

                {/* Joint Behavior Checkbox */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Davranış İlişkisi</label>
                  <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer select-none transition-all h-[54px] ${
                    isJointBehavior 
                      ? "bg-teal-50/50 border-teal-200 shadow-sm" 
                      : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isJointBehavior}
                      onChange={(e) => setIsJointBehavior(e.target.checked)}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-800 block">Ortak Davranış</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">Birlikte işlendi / Tek kayıt</span>
                    </div>
                  </label>
                </div>
              </div>


              {/* Top Row: Student, Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Student Search & Selection */}
                <div className="space-y-3 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {recordReason === "Şikayet" ? "Şikayet Edilen Öğrenci Seçimi (Birden fazla seçebilirsiniz)" : "Öğrenci Seçimi (Birden fazla seçebilirsiniz)"}
                  </label>
                  
                  {/* Search Input */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Öğrenci eklemek için arayın (Ad Soyadı veya Okul No)..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setBulkSelectionError(""); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && searchQuery.includes(",")) {
                            e.preventDefault();
                            handleBulkStudentEnter();
                          }
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />
                    </div>
                    {bulkSelectionError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{bulkSelectionError}</p>}
                    {!searchQuery.includes(",") && normalizeStudentSearchText(searchQuery).length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto relative z-20 bg-white shadow-lg">
                        {filteredStudents.length > 0 ? (
                          filteredStudents
                            .filter(student => !selectedStudentsList.some(s => s.id === student.id))
                            .map(student => (
                              <button
                                type="button"
                                key={student.id}
                                onClick={() => {
                                  setPendingStudent(student);
                                  setPendingStudentDescription("");
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-slate-100 last:border-0 text-sm flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="font-semibold text-slate-800">{student.name}</span>
                                <span className="text-xs text-slate-500 font-medium">{student.classroom} - {getStudentSchoolNumber(student)}</span>
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500">Öğrenci bulunamadı.</div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarih</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full appearance-none pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Selected Students Grid/List */}
              {selectedStudentsList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 md:col-span-2">
                  {sortedSelectedStudents.map((student) => (
                    <div key={student.id} className="min-w-0 w-full flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl animate-fade-in">
                      <div className="w-6 h-6 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold text-xs">
                        {student.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-teal-900 text-xs">{student.name}</div>
                        <div className="text-[10px] text-teal-700 font-medium">{student.classroom} - {getStudentSchoolNumber(student)}</div>
                        {studentDescriptions?.[student.id] && (
                          <div className="text-[10px] text-slate-500 max-w-[220px] truncate" title={studentDescriptions[student.id]}>
                            {studentDescriptions[student.id]}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedList = selectedStudentsList.filter(s => s.id !== student.id);
                          setSelectedStudentsList(updatedList);
                          setStudentDescriptions((prev: Record<string, string>) => {
                            const next = { ...prev };
                            delete next[student.id];
                            return next;
                          });
                          setSelectedStudent(updatedList[0] || null);
                          if (updatedList.length <= 1) {
                            setIsJointBehavior(false);
                          }
                        }}
                        className="text-teal-600 hover:bg-teal-200 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 shrink-0 sticky bottom-0 z-10">
              <button
                onClick={closeModal}
                className="px-6 py-2.5 rounded-xl font-bold text-[16.67px] text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {!editingRecordId && recordReason === "Tutanak" && !isTeacherLinkView ? "Kapat" : "İptal"}
              </button>
              <button
                onClick={() => saveRecord(recordReason === "Tutanak")}
                disabled={(!selectedStudent && selectedStudentsList.length === 0) || !behaviorName}
                className="px-6 py-2.5 rounded-xl font-bold text-[16.67px] bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isTeacherLinkView
                  ? "Kaydet & Bildir"
                  : editingRecordId
                    ? "Güncelle"
                    : recordReason === "Tutanak"
                      ? "Listeye Ekle"
                      : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingBulkStudents.length > 0 && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-base font-extrabold text-slate-800">Ortak Açıklama</h4>
                <p className="mt-1 text-xs text-slate-600">{pendingBulkStudents.length} öğrenciye aynı fiil ve açıklama uygulanacak.</p>
              </div>
              <button type="button" onClick={() => setPendingBulkStudents([])} aria-label="Kapat" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 p-5">
              <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                {pendingBulkStudents.map((student: any) => (
                  <div key={student.id}>{getStudentSchoolNumber(student)} · {student.name} · {student.classroom}</div>
                ))}
              </div>
              <label className="block text-xs font-bold text-slate-600">Tüm öğrenciler için ortak açıklama</label>
              <textarea autoFocus value={pendingStudentDescription} onChange={(e) => setPendingStudentDescription(e.target.value)}
                placeholder="Ortak açıklamayı yazınız..." className="min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button type="button" onClick={() => setPendingBulkStudents([])} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600">Vazgeç</button>
              <button type="button" onClick={() => {
                const merged = [...selectedStudentsList];
                for (const student of pendingBulkStudents) {
                  if (!merged.some((item: any) => String(item.id) === String(student.id))) merged.push(student);
                }
                setSelectedStudentsList(merged);
                setSelectedStudent(merged[0] || null);
                // Aynı fiil işlenmiş olsa da her öğrenci için ayrı kayıt tutulur.
                setIsJointBehavior(false);
                setDescription(pendingStudentDescription.trim());
                setStudentDescriptions((previous: Record<string, string>) => {
                  const next = { ...previous };
                  for (const student of pendingBulkStudents) next[student.id] = pendingStudentDescription.trim();
                  return next;
                });
                setPendingBulkStudents([]);
                setPendingStudentDescription("");
                setSearchQuery("");
              }} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-700">Öğrencileri Ekle</button>
            </div>
          </div>
        </div>
      )}

      {pendingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h4 className="text-base font-extrabold text-slate-800">Öğrenci Açıklaması</h4>
                <p className="text-xs text-slate-500 mt-0.5">{pendingStudent.name} • {pendingStudent.classroom} • No: {getStudentSchoolNumber(pendingStudent)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setPendingStudent(null); setPendingStudentDescription(""); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Açıklama <span className="font-normal normal-case text-slate-400">(İsteğe Bağlı)</span></label>
              <textarea
                autoFocus
                value={pendingStudentDescription}
                onChange={(e) => setPendingStudentDescription(e.target.value)}
                placeholder="Bu öğrenciye özel açıklama..."
                className="w-full min-h-[120px] resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPendingStudent(null); setPendingStudentDescription(""); }}
                className="px-4 py-2 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  const student = pendingStudent;
                  if (!selectedStudentsList.some((s: any) => s.id === student.id)) {
                    const newList = [...selectedStudentsList, student];
                    setSelectedStudentsList(newList);
                    setStudentDescriptions((prev: Record<string, string>) => ({ ...prev, [student.id]: pendingStudentDescription.trim() }));
                    if (!selectedStudent) setSelectedStudent(student);
                    if (newList.length > 1) setIsJointBehavior(true);
                  }
                  setSearchQuery("");
                  setPendingStudent(null);
                  setPendingStudentDescription("");
                }}
                className="px-5 py-2 rounded-xl font-extrabold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BehaviorCatalogModals(props: any) {
  const {
    customBehaviors, editingBehaviorId, isBehaviorModalOpen, isRewardModalOpen, isSanctionModalOpen,
    newBehaviorArticle, newBehaviorInputName, newBehaviorNamesList, newBehaviorParagraph, newBehaviorPoints,
    newBehaviorRegContent, newBehaviorRegName, newBehaviorSanctionType, newBehaviorType, rewards, safeStorage, sanctions,
    setCustomBehaviors, setEditingBehaviorId, setIsBehaviorModalOpen, setIsRewardModalOpen, setIsSanctionModalOpen,
    setNewBehaviorArticle, setNewBehaviorInputName, setNewBehaviorNamesList, setNewBehaviorParagraph, setNewBehaviorPoints,
    setNewBehaviorRegContent, setNewBehaviorRegName, setNewBehaviorSanctionType, setNewBehaviorType,
    setNewRewardBehaviorIds, setNewRewardName, setNewRewardPoints, newRewardBehaviorIds, newRewardName, newRewardPoints,
    setNewSanctionArticle, setNewSanctionBehaviorIds, setNewSanctionContent, setNewSanctionParagraph,
    setNewSanctionRegName, setNewSanctionType, newSanctionArticle, newSanctionBehaviorIds, newSanctionContent,
    newSanctionParagraph, newSanctionRegName, newSanctionType, setRewards, setSanctions
  } = props;
  return (
    <>
      {isBehaviorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-800">
                {editingBehaviorId ? "Davranış Tanımını Düzenle" : "Yönetmelik ve Davranış Tanımlama"}
              </h3>
              <button
                onClick={() => {
                  setIsBehaviorModalOpen(false);
                  setEditingBehaviorId(null);
                  setNewBehaviorRegName("Ortaöğretim Kurumları Yönetmeliği");
                  setNewBehaviorArticle("164");
                  setNewBehaviorParagraph("");
                  setNewBehaviorSanctionType("Kınama");
                  setNewBehaviorPoints("");
                  setNewBehaviorRegContent("");
                  setNewBehaviorInputName("");
                  setNewBehaviorNamesList([]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Davranış Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBehaviorType("Olumlu")}
                    className={`py-2 rounded-xl text-sm font-bold border transition-colors ${newBehaviorType === "Olumlu" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                  >
                    Olumlu
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBehaviorType("Olumsuz")}
                    className={`py-2 rounded-xl text-sm font-bold border transition-colors ${newBehaviorType === "Olumsuz" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                  >
                    Olumsuz
                  </button>
                </div>
              </div>

              {/* Regulation Fields */}
              <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-black text-teal-700 uppercase tracking-wider">1. Yönetmelik Maddesi Bilgileri</h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Yönetmelik Adı</label>
                  <input
                    type="text"
                    value={newBehaviorRegName}
                    onChange={e => setNewBehaviorRegName(e.target.value)}
                    placeholder="Örn: Ortaöğretim Kurumları Yönetmeliği"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Madde</label>
                    <input
                      type="text"
                      value={newBehaviorArticle}
                      onChange={e => setNewBehaviorArticle(e.target.value)}
                      placeholder="Örn: 164"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Fıkra</label>
                    <input
                      type="text"
                      value={newBehaviorParagraph}
                      onChange={e => setNewBehaviorParagraph(e.target.value)}
                      placeholder="Örn: 1-a"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Yaptırım Türü</label>
                    <div className="relative">
                      <select
                        value={newBehaviorSanctionType}
                        onChange={e => setNewBehaviorSanctionType(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none pr-10"
                      >
                        <option value="Kınama">Kınama</option>
                        <option value="Okuldan kısa süreli uzaklaştırma">Okuldan kısa süreli uzaklaştırma</option>
                        <option value="Okul değiştirme">Okul değiştirme</option>
                        <option value="Örgün eğitim dışına çıkarma">Örgün eğitim dışına çıkarma</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Puan Değeri</label>
                    <input
                      type="number"
                      value={newBehaviorPoints}
                      onChange={e => {
                        const val = e.target.value;
                        setNewBehaviorPoints(val === "" ? "" : Number(val));
                      }}
                      placeholder="Örn: -5"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Metin Kısmı (İçerik)</label>
                  <textarea
                    value={newBehaviorRegContent}
                    onChange={e => setNewBehaviorRegContent(e.target.value)}
                    placeholder="Örn: Okul eşyalarına zarar vermek..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[70px] resize-none"
                  />
                </div>
              </div>

              {editingBehaviorId ? (
                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Davranış Adı</label>
                    <input
                      type="text"
                      value={newBehaviorInputName}
                      onChange={e => setNewBehaviorInputName(e.target.value)}
                      placeholder="Örn: Derse geç kalmak"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-teal-700 uppercase tracking-wider">2. Bu Madde Kapsamına Giren Davranışlar</h4>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBehaviorInputName}
                      onChange={e => setNewBehaviorInputName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = newBehaviorInputName.trim();
                          if (trimmed) {
                            if (newBehaviorNamesList.includes(trimmed)) {
                              alert("Bu davranış zaten listeye eklenmiş.");
                              return;
                            }
                            setNewBehaviorNamesList(prev => [...prev, trimmed]);
                            setNewBehaviorInputName("");
                          }
                        }
                      }}
                      placeholder="Davranış adını yazın ve enter veya ekleye basın..."
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newBehaviorInputName.trim();
                        if (trimmed) {
                          if (newBehaviorNamesList.includes(trimmed)) {
                            alert("Bu davranış zaten listeye eklenmiş.");
                            return;
                          }
                          setNewBehaviorNamesList(prev => [...prev, trimmed]);
                          setNewBehaviorInputName("");
                        }
                      }}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0"
                    >
                      Ekle
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {newBehaviorNamesList.map((name, index) => (
                      <div key={index} className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                        <span className="text-xs font-semibold text-slate-700">{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Bu davranışı listeden silmek istediğinize emin misiniz?")) {
                              setNewBehaviorNamesList(prev => prev.filter((_, i) => i !== index));
                            }
                          }}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {newBehaviorNamesList.length === 0 && (
                      <div className="text-[11px] text-slate-400 italic text-center py-2 bg-white/50 border border-dashed border-slate-200 rounded-xl">
                        Henüz hiçbir davranış eklenmedi. Yukarıdan el ile yazıp ekleyebilirsiniz.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBehaviorModalOpen(false);
                  setNewBehaviorRegName("Ortaöğretim Kurumları Yönetmeliği");
                  setNewBehaviorArticle("164");
                  setNewBehaviorParagraph("");
                  setNewBehaviorSanctionType("Kınama");
                  setNewBehaviorPoints("");
                  setNewBehaviorRegContent("");
                  setNewBehaviorInputName("");
                  setNewBehaviorNamesList([]);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (editingBehaviorId) {
                    if (!newBehaviorInputName.trim()) {
                      alert("Lütfen davranış adını giriniz.");
                      return;
                    }
                    
                    const updatedBehaviors = customBehaviors.map(b => {
                      if (b.id === editingBehaviorId) {
                        return {
                          ...b,
                          type: newBehaviorType,
                          name: newBehaviorInputName.trim(),
                          regulationName: newBehaviorRegName,
                          article: newBehaviorArticle,
                          paragraph: newBehaviorParagraph,
                          sanctionType: newBehaviorSanctionType,
                          points: newBehaviorPoints ? Number(newBehaviorPoints) : undefined,
                          content: newBehaviorRegContent
                        };
                      }
                      return b;
                    });
                    
                    setCustomBehaviors(updatedBehaviors);
                    await safeStorage.setItem("customBehaviors", updatedBehaviors);
                  } else {
                    if (newBehaviorNamesList.length === 0) {
                      alert("Lütfen en az bir davranış ekleyiniz.");
                      return;
                    }
                    
                    const newBehaviors: CustomBehavior[] = newBehaviorNamesList.map(name => ({
                      id: Math.random().toString(36).substring(2, 9),
                      type: newBehaviorType,
                      name: name,
                      regulationName: newBehaviorRegName,
                      article: newBehaviorArticle,
                      paragraph: newBehaviorParagraph,
                      sanctionType: newBehaviorSanctionType,
                      points: newBehaviorPoints ? Number(newBehaviorPoints) : undefined,
                      content: newBehaviorRegContent
                    }));
                    
                    const updatedBehaviors = [...customBehaviors, ...newBehaviors];
                    setCustomBehaviors(updatedBehaviors);
                    await safeStorage.setItem("customBehaviors", updatedBehaviors);

                    if (newBehaviorType === "Olumsuz") {
                      const behaviorIds = newBehaviors.map(b => b.id);
                      const newSanction: Sanction = {
                        id: Math.random().toString(36).substring(2, 9),
                        regulationName: newBehaviorRegName || "Ortaöğretim Kurumları Yönetmeliği",
                        article: newBehaviorArticle || "Belirtilmedi",
                        paragraph: newBehaviorParagraph || "Belirtilmedi",
                        sanctionType: newBehaviorSanctionType || "Belirtilmedi",
                        content: newBehaviorRegContent || "Gerekçe belirtilmemiş",
                        behaviorIds: behaviorIds
                      };
                      const updatedSanctions = [...sanctions, newSanction];
                      setSanctions(updatedSanctions);
                      await safeStorage.setItem("sanctions", updatedSanctions);
                    }
                  }

                  setIsBehaviorModalOpen(false);
                  setEditingBehaviorId(null);
                  setNewBehaviorRegName("Ortaöğretim Kurumları Yönetmeliği");
                  setNewBehaviorArticle("164");
                  setNewBehaviorParagraph("");
                  setNewBehaviorSanctionType("Kınama");
                  setNewBehaviorPoints("");
                  setNewBehaviorRegContent("");
                  setNewBehaviorInputName("");
                  setNewBehaviorNamesList([]);
                }}
                disabled={!editingBehaviorId && newBehaviorNamesList.length === 0}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {isRewardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Yeni Ödül Ekle</h3>
              <button onClick={() => setIsRewardModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ödül Adı</label>
                <input type="text" value={newRewardName} onChange={e => setNewRewardName(e.target.value)} placeholder="Örn: Kantin Çeki" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Puan</label>
                <input type="number" value={newRewardPoints} onChange={e => setNewRewardPoints(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Örn: 50" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İlişkili Olumlu Davranışlar</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {customBehaviors.filter(b => b.type === "Olumlu").map(b => (
                    <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRewardBehaviorIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewRewardBehaviorIds(prev => [...prev, b.id]);
                          else setNewRewardBehaviorIds(prev => prev.filter(id => id !== b.id));
                        }}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{b.name}</span>
                    </label>
                  ))}
                  {customBehaviors.filter(b => b.type === "Olumlu").length === 0 && (
                    <div className="p-3 text-sm text-slate-500 italic">Önce olumlu davranış ekleyiniz.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-3xl">
              <button onClick={() => setIsRewardModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">İptal</button>
              <button
                onClick={async () => {
                  if (!newRewardName || newRewardPoints === "") return;
                  const newReward: Reward = { id: Math.random().toString(36).substring(2, 9), name: newRewardName, points: Number(newRewardPoints), behaviorIds: newRewardBehaviorIds };
                  const updated = [...rewards, newReward];
                  setRewards(updated);
                  await safeStorage.setItem("rewards", updated);
                  setIsRewardModalOpen(false);
                  setNewRewardName("");
                  setNewRewardPoints("");
                  setNewRewardBehaviorIds([]);
                }}
                disabled={!newRewardName || newRewardPoints === ""}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {isSanctionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Yeni Yaptırım Ekle (Yönetmelik)</h3>
              <button
                onClick={() => {
                  setIsSanctionModalOpen(false);
                  setNewSanctionRegName("");
                  setNewSanctionArticle("");
                  setNewSanctionParagraph("");
                  setNewSanctionType("");
                  setNewSanctionContent("");
                  setNewSanctionBehaviorIds([]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Yönetmelik Adı</label>
                <input type="text" value={newSanctionRegName} onChange={e => setNewSanctionRegName(e.target.value)} placeholder="Örn: Ortaöğretim Kurumları Yönetmeliği" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Madde</label>
                  <input type="text" value={newSanctionArticle} onChange={e => setNewSanctionArticle(e.target.value)} placeholder="Örn: 164" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fıkra</label>
                  <input type="text" value={newSanctionParagraph} onChange={e => setNewSanctionParagraph(e.target.value)} placeholder="Örn: 2-a" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Yaptırım Türü</label>
                <input type="text" value={newSanctionType} onChange={e => setNewSanctionType(e.target.value)} placeholder="Örn: Kınama, Uyarı, Okuldan Uzaklaştırma" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İçerik</label>
                <textarea value={newSanctionContent} onChange={e => setNewSanctionContent(e.target.value)} placeholder="Yönetmelik maddesinin içeriği..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[100px] resize-y" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İlişkili Olumsuz Davranışlar</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {customBehaviors.filter(b => b.type === "Olumsuz").map(b => (
                    <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSanctionBehaviorIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewSanctionBehaviorIds(prev => [...prev, b.id]);
                          else setNewSanctionBehaviorIds(prev => prev.filter(id => id !== b.id));
                        }}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{b.name}</span>
                    </label>
                  ))}
                  {customBehaviors.filter(b => b.type === "Olumsuz").length === 0 && (
                    <div className="p-3 text-sm text-slate-500 italic">Önce olumsuz davranış ekleyiniz.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsSanctionModalOpen(false);
                  setNewSanctionRegName("");
                  setNewSanctionArticle("");
                  setNewSanctionParagraph("");
                  setNewSanctionType("");
                  setNewSanctionContent("");
                  setNewSanctionBehaviorIds([]);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newSanctionRegName || !newSanctionArticle || !newSanctionContent) return;
                  const newSanction: Sanction = {
                    id: Math.random().toString(36).substring(2, 9),
                    regulationName: newSanctionRegName,
                    article: newSanctionArticle,
                    paragraph: newSanctionParagraph,
                    sanctionType: newSanctionType || "Belirtilmedi",
                    content: newSanctionContent,
                    behaviorIds: newSanctionBehaviorIds
                  };
                  const updated = [...sanctions, newSanction];
                  setSanctions(updated);
                  await safeStorage.setItem("sanctions", updated);
                  setIsSanctionModalOpen(false);
                  setNewSanctionRegName("");
                  setNewSanctionArticle("");
                  setNewSanctionParagraph("");
                  setNewSanctionType("");
                  setNewSanctionContent("");
                  setNewSanctionBehaviorIds([]);
                }}
                disabled={!newSanctionRegName || !newSanctionArticle || !newSanctionContent}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

