import { Search } from "lucide-react";
import React from "react";
import { FileText, X, Calendar, UserPlus, Users, Plus, Trash2, Printer } from "lucide-react";

type TutanakStudent = {
  id: string;
  name: string;
  classroom: string;
  number: string;
};

interface DisciplineIncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutanakDate: string;
  setTutanakDate: (value: string) => void;
  newTeacherInput: string;
  setNewTeacherInput: (value: string) => void;
  showTeacherSuggestions: boolean;
  setShowTeacherSuggestions: (value: boolean) => void;
  filteredTeachersForSearch: any[];
  tutanakTeachers: string[];
  setTutanakTeachers: React.Dispatch<React.SetStateAction<string[]>>;
  isManualStudent: boolean;
  setIsManualStudent: (value: boolean) => void;
  selectedStudentForTutanak: any | null;
  setSelectedStudentForTutanak: (value: any | null) => void;
  studentSearchTerm: string;
  setStudentSearchTerm: (value: string) => void;
  showStudentSuggestions: boolean;
  setShowStudentSuggestions: (value: boolean) => void;
  filteredStudentsForSearch: any[];
  tutanakStudents: TutanakStudent[];
  setTutanakStudents: React.Dispatch<React.SetStateAction<TutanakStudent[]>>;
  manualStudentName: string;
  setManualStudentName: (value: string) => void;
  manualStudentClassroom: string;
  setManualStudentClassroom: (value: string) => void;
  manualStudentNumber: string;
  setManualStudentNumber: (value: string) => void;
  onPrint: () => void;
}

export function DisciplineIncidentReportModal({
  isOpen, onClose, tutanakDate, setTutanakDate, newTeacherInput, setNewTeacherInput,
  showTeacherSuggestions, setShowTeacherSuggestions, filteredTeachersForSearch,
  tutanakTeachers, setTutanakTeachers, isManualStudent, setIsManualStudent,
  selectedStudentForTutanak, setSelectedStudentForTutanak, studentSearchTerm,
  setStudentSearchTerm, showStudentSuggestions, setShowStudentSuggestions,
  filteredStudentsForSearch, tutanakStudents, setTutanakStudents, manualStudentName,
  setManualStudentName, manualStudentClassroom, setManualStudentClassroom,
  manualStudentNumber, setManualStudentNumber, onPrint,
}: DisciplineIncidentReportModalProps) {
  if (!isOpen) return null;
  return (

        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Davranış Tespit Tutanağı</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Hızlı ve düzenli bir şekilde resmi evrak formatında tutanak hazırlayın</p>
                </div>
              </div>
              <button
                onClick={() => onClose()}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {/* Tarih ve Öğretmen Belirleme Satırı */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {/* Sol Sütun: Tarih Seçimi */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3 text-left">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Tarih Belirleme
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Tutanak Tarihi</label>
                    <input
                      type="date"
                      value={tutanakDate}
                      onChange={(e) => setTutanakDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 font-bold text-slate-700"
                    />
                  </div>
                </div>

                {/* Sağ Sütun: Nöbetçi Öğretmen Ekleme */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3 relative text-left">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    İmzalayacak Nöbetçi Öğretmenler
                  </div>
                  
                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Öğretmen ismi yazın veya seçin..."
                        value={newTeacherInput}
                        onFocus={() => setShowTeacherSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowTeacherSuggestions(false), 200)}
                        onChange={(e) => {
                          setNewTeacherInput(e.target.value);
                          setShowTeacherSuggestions(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-700 font-medium"
                      />
                      
                      {/* Suggestions Dropdown */}
                      {showTeacherSuggestions && filteredTeachersForSearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto overflow-hidden divide-y divide-slate-100">
                          {filteredTeachersForSearch.map((teacher, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                if (teacher.name && !tutanakTeachers.includes(teacher.name)) {
                                  setTutanakTeachers([...tutanakTeachers, teacher.name]);
                                }
                                setNewTeacherInput("");
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
                            >
                              {teacher.name} {teacher.branch ? `(${teacher.branch})` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTeacherInput.trim() !== "" && !tutanakTeachers.includes(newTeacherInput.trim())) {
                          setTutanakTeachers([...tutanakTeachers, newTeacherInput.trim()]);
                          setNewTeacherInput("");
                        }
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center justify-center cursor-pointer shadow-sm shadow-emerald-600/10"
                    >
                      Ekle
                    </button>
                  </div>

                  {/* Added Teachers Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tutanakTeachers.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Henüz nöbetçi öğretmen eklenmedi. (En az bir adet eklenmesi önerilir)</p>
                    ) : (
                      tutanakTeachers.map((teacher, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-bold text-emerald-800">
                          {teacher}
                          <button
                            type="button"
                            onClick={() => setTutanakTeachers(tutanakTeachers.filter((t) => t !== teacher))}
                            className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded-full hover:bg-emerald-100/50 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Öğrenci Ekleme Bölümü */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-4 text-left">
                {/* Ekleme Modu Başlığı ve Seçici */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Öğrenci Belirleme
                  </div>
                  <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualStudent(false);
                        setSelectedStudentForTutanak(null);
                        setStudentSearchTerm("");
                      }}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        !isManualStudent
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Öğrenci Ara
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualStudent(true);
                        setSelectedStudentForTutanak(null);
                        setStudentSearchTerm("");
                      }}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        isManualStudent
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      El İle (Manuel) Gir
                    </button>
                  </div>
                </div>

                {!isManualStudent ? (
                  /* MOD 1: Öğrenci Arayarak Ekleme */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-left">
                    {/* Öğrenci Arama Inputu */}
                    <div className="md:col-span-9 relative text-left">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Öğrenci Arayın (İsim veya Okul No)</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
                        <input
                          type="text"
                          placeholder="İsim veya okul numarası yazın..."
                          value={studentSearchTerm}
                          onFocus={() => setShowStudentSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowStudentSuggestions(false), 200)}
                          onChange={(e) => {
                            setStudentSearchTerm(e.target.value);
                            setShowStudentSuggestions(true);
                            if (selectedStudentForTutanak) {
                              setSelectedStudentForTutanak(null);
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-700 font-medium"
                        />
                      </div>

                      {/* Student Autocomplete Dropdown */}
                      {showStudentSuggestions && filteredStudentsForSearch.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                          {filteredStudentsForSearch.map((student, idx) => {
                            const studentNo = student.number || student.id || "";
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForTutanak(student);
                                  setStudentSearchTerm(`${student.name} (${student.classroom || "Sınıfsız"} - No: ${studentNo})`);
                                  setShowStudentSuggestions(false);
                                }}
                                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <span>{student.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/50">
                                  {student.classroom || "Sınıfsız"} • No: {studentNo}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Ekle Butonu */}
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedStudentForTutanak) {
                            alert("Lütfen arama listesinden bir öğrenci seçin.");
                            return;
                          }
                          
                          const alreadyExists = tutanakStudents.some(s => s.id === selectedStudentForTutanak.id);
                          if (alreadyExists) {
                            alert("Bu öğrenci zaten tutanak listesine eklenmiş.");
                            return;
                          }

                          const studentNo = selectedStudentForTutanak.number || selectedStudentForTutanak.id || "Belirtilmedi";

                          setTutanakStudents([
                            ...tutanakStudents,
                            {
                              id: selectedStudentForTutanak.id,
                              name: selectedStudentForTutanak.name,
                              classroom: selectedStudentForTutanak.classroom || "Belirtilmedi",
                              number: studentNo,
                            }
                          ]);

                          // Clear student inputs
                          setStudentSearchTerm("");
                          setSelectedStudentForTutanak(null);
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/15"
                      >
                        <Plus className="w-4 h-4" />
                        Listeye Ekle
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MOD 2: El ile Manuel Giriş */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-left">
                    {/* Manuel Öğrenci Adı Soyadı */}
                    <div className="md:col-span-4 relative text-left">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Öğrenci Adı Soyadı</label>
                      <input
                        type="text"
                        placeholder="Örn: Ahmet Yılmaz"
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-700 font-medium"
                      />
                    </div>

                    {/* Sınıfı */}
                    <div className="md:col-span-3 relative text-left">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Sınıfı</label>
                      <input
                        type="text"
                        placeholder="Örn: 10-A"
                        value={manualStudentClassroom}
                        onChange={(e) => setManualStudentClassroom(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-700 font-medium font-bold"
                      />
                    </div>

                    {/* Okul Numarası */}
                    <div className="md:col-span-3 relative text-left">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-left">Okul Numarası</label>
                      <input
                        type="text"
                        placeholder="Örn: 482"
                        value={manualStudentNumber}
                        onChange={(e) => setManualStudentNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-700 font-mono font-bold"
                      />
                    </div>

                    {/* Manuel Ekle Butonu */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (manualStudentName.trim() === "") {
                            alert("Lütfen öğrenci adı soyadını girin.");
                            return;
                          }

                          const manualId = `manual-${Date.now()}`;
                          const alreadyExists = tutanakStudents.some(s => s.name.toLocaleLowerCase("tr-TR") === manualStudentName.trim().toLocaleLowerCase("tr-TR") && s.number === (manualStudentNumber.trim() || "Belirtilmedi"));
                          if (alreadyExists) {
                            alert("Bu öğrenci zaten tutanak listesine eklenmiş.");
                            return;
                          }

                          setTutanakStudents([
                            ...tutanakStudents,
                            {
                              id: manualId,
                              name: manualStudentName.trim(),
                              classroom: manualStudentClassroom.trim() || "Belirtilmedi",
                              number: manualStudentNumber.trim() || "Belirtilmedi",
                            }
                          ]);

                          // Clear manual inputs
                          setManualStudentName("");
                          setManualStudentClassroom("");
                          setManualStudentNumber("");
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/15"
                      >
                        <Plus className="w-4 h-4" />
                        Listeye Ekle
                      </button>
                    </div>
                  </div>
                )}

                {/* Seçilen Öğrenci Detay Kartı (Sadece Arama Modunda Varsa) */}
                {!isManualStudent && selectedStudentForTutanak && (
                  <div className="p-3 bg-white border border-emerald-100 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-100 text-emerald-800 rounded-md flex items-center justify-center font-bold text-[10px]">
                        {selectedStudentForTutanak.name.charAt(0)}
                      </div>
                      <span className="font-extrabold text-slate-800">{selectedStudentForTutanak.name}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-semibold">{selectedStudentForTutanak.classroom || "Sınıfsız"} - No: {selectedStudentForTutanak.number || selectedStudentForTutanak.id}</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Öğrenci Seçildi</span>
                  </div>
                )}
              </div>

              {/* Eklenen Öğrenciler Listesi Tablosu */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-left">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Tutanaktaki Öğrenci Listesi ({tutanakStudents.length})</span>
                  {tutanakStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTutanakStudents([])}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                    >
                      Tümünü Temizle
                    </button>
                  )}
                </div>

                {tutanakStudents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-1">
                    <p>Tutanağa henüz hiç öğrenci eklenmedi.</p>
                    <p className="text-[10px] text-slate-400">Yukarıdaki arama alanını kullanarak öğrencileri arayıp listeye ekleyebilirsiniz.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-center w-16">Sınıf</th>
                          <th className="px-4 py-3 text-center w-24">No</th>
                          <th className="px-4 py-3 font-bold text-slate-700">Öğrenci Adı Soyadı</th>
                          <th className="px-4 py-3 text-center w-16">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tutanakStudents.map((student, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{student.classroom}</td>
                            <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{student.number}</td>
                            <td className="px-4 py-3 font-extrabold text-slate-900">{student.name}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setTutanakStudents(tutanakStudents.filter((s, i) => i !== idx))}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Öğrenciyi Tutanaktan Çıkar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer"
              >
                İptal Et
              </button>
              <button
                type="button"
                onClick={onPrint}
                disabled={tutanakStudents.length === 0}
                className={`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer ${
                  tutanakStudents.length === 0
                    ? "bg-slate-300 shadow-none cursor-not-allowed opacity-60"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10"
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Tutanağı Yazdır / PDF</span>
              </button>
            </div>
          </div>
        </div>
  );
}

