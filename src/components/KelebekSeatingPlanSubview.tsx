import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, Check, Plus, Trash2, CheckCircle2, AlertTriangle, Search, 
  Sparkles, RefreshCw, Printer, UserCheck, Settings2, X, DoorOpen, HelpCircle, Eye, Calendar 
} from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
interface KelebekSeatingPlanSubviewProps {
  students: any[];
  selectedBSlot: any;
  sittingPattern: 'tekli' | 'ciftli';
  setSittingPattern: (v: 'tekli' | 'ciftli') => void;
  genderRuleActive: boolean;
  setGenderRuleActive: (v: boolean) => void;
  manualPlacementActive: boolean;
  setManualPlacementActive: (v: boolean) => void;
  crossSittingActive: boolean;
  setCrossSittingActive: (v: boolean) => void;
  backupSalons: any[];
  setBackupSalons: (v: any[]) => void;
  inactiveDefaultSalons: string[];
  setInactiveDefaultSalons: React.Dispatch<React.SetStateAction<string[]>>;
  activeExtraSalons: string[];
  setActiveExtraSalons: React.Dispatch<React.SetStateAction<string[]>>;
  manualStudentAssignments: { [studentId: string]: string };
  setManualStudentAssignments: React.Dispatch<React.SetStateAction<{ [studentId: string]: string }>>;
  customRoomCapacities: { [roomName: string]: number };
  setCustomRoomCapacities: React.Dispatch<React.SetStateAction<{ [roomName: string]: number }>>;
  generatedSeating: any;
  setGeneratedSeating: (v: any) => void;
  classCapacities: { [roomName: string]: number };
  classStudentCapacities: { [roomName: string]: number };
  selectedSalonCapacity: number;
  roomTeacherAssignments: Record<string, string>;
  setRoomTeacherAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  allSchoolClassrooms: string[];
  defaultSalons: string[];
  extraSchoolClassrooms: string[];
  examStudents: any[];
  studentCountsByBranch: any[];
  activeRoomsList: any[];
  totalRoomsCapacity: number;
  handleGenerateSeating: () => void;
  getStudentGender: (s: any) => string;
  handleSaveSeating: () => void;
  handleClearSeating: () => void;
  handleSaveSalonSelection: () => void | Promise<void>;
  canSaveSalonSelection: boolean;
  isSavingSalonSelection: boolean;
  isCriteriaModalOpen: boolean;
  setIsCriteriaModalOpen: (v: boolean) => void;
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (v: boolean) => void;
  previewRoomName: string;
  setPreviewRoomName: (v: string) => void;
}

export default function KelebekSeatingPlanSubview({
  students,
  selectedBSlot,
  sittingPattern,
  setSittingPattern,
  genderRuleActive,
  setGenderRuleActive,
  manualPlacementActive,
  setManualPlacementActive,
  crossSittingActive,
  setCrossSittingActive,
  backupSalons,
  setBackupSalons,
  inactiveDefaultSalons,
  setInactiveDefaultSalons,
  activeExtraSalons,
  setActiveExtraSalons,
  manualStudentAssignments,
  setManualStudentAssignments,
  customRoomCapacities,
  setCustomRoomCapacities,
  generatedSeating,
  setGeneratedSeating,
  classCapacities,
  classStudentCapacities,
  selectedSalonCapacity,
  roomTeacherAssignments,
  setRoomTeacherAssignments,
  allSchoolClassrooms,
  defaultSalons,
  extraSchoolClassrooms,
  examStudents,
  studentCountsByBranch,
  activeRoomsList,
  totalRoomsCapacity,
  handleGenerateSeating,
  getStudentGender,
  handleSaveSeating,
  handleClearSeating,
  handleSaveSalonSelection,
  canSaveSalonSelection,
  isSavingSalonSelection,
  isCriteriaModalOpen,
  setIsCriteriaModalOpen,
  isPreviewModalOpen,
  setIsPreviewModalOpen,
  previewRoomName,
  setPreviewRoomName,
}: KelebekSeatingPlanSubviewProps) {

  // Local UI States
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [selectedRoomToView, setSelectedRoomToView] = useState<string>("");

  // Schedule and Classrooms loader for matching teachers
  const [scheduleData, setScheduleData] = useState<Record<string, any>>({});
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [dutyAssignments, setDutyAssignments] = useState<any[]>([]);

  useEffect(() => {
    const loadScheduleAndClassrooms = async () => {
      try {
        const lf = await import("../core/state/AppStateService");
        
        // Load scheduleData
        const savedSchedule = sqliteStorage.getItem("scheduleData");
        if (savedSchedule) {
          setScheduleData(JSON.parse(savedSchedule));
        } else {
          const lfSaved = await lf.default.getItem<string>("scheduleData");
          if (lfSaved) {
            setScheduleData(JSON.parse(lfSaved));
          }
        }

        // Load classrooms
        const savedClassrooms = sqliteStorage.getItem("school_classrooms");
        if (savedClassrooms) {
          setClassrooms(JSON.parse(savedClassrooms));
        } else {
          const lfClassrooms = await lf.default.getItem<any[]>("school_classrooms");
          if (lfClassrooms) {
            setClassrooms(lfClassrooms);
          }
        }

        // Load teachers
        const savedTeachers = sqliteStorage.getItem("school_teachers");
        if (savedTeachers) {
          const parsedTeachers = JSON.parse(savedTeachers);
          setTeachers(Array.isArray(parsedTeachers) ? parsedTeachers : []);
        } else {
          const lfTeachers = await lf.default.getItem<any[]>("school_teachers");
          setTeachers(Array.isArray(lfTeachers) ? lfTeachers : []);
        }

        // Load weekly duty assignments. Duty teachers are highlighted only if they are free at the exam hour.
        const savedDuties = sqliteStorage.getItem("school_duty_assignments_v1");
        if (savedDuties) {
          const parsedDuties = JSON.parse(savedDuties);
          setDutyAssignments(Array.isArray(parsedDuties) ? parsedDuties : []);
        } else {
          const lfDuties = await lf.default.getItem<any[]>("school_duty_assignments_v1");
          setDutyAssignments(Array.isArray(lfDuties) ? lfDuties : []);
        }
      } catch (e) {
        console.error("Error loading schedule/classrooms in subview:", e);
      }
    };
    loadScheduleAndClassrooms();
  }, []);

  const normalizeTeacherName = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');

  const getSelectedSlotDayAndHour = () => {
    const day = String(selectedBSlot?.dayName || '').trim() || 'Pazartesi';
    let lessonHour: number | string = selectedBSlot?.lessonHour || selectedBSlot?.sessionIndex || 1;
    if (selectedBSlot?.sessionLabel && !selectedBSlot?.lessonHour) {
      const match = String(selectedBSlot.sessionLabel).match(/(\d+)\.\s*Ders/i);
      if (match) lessonHour = Number(match[1]);
    }
    return { day, lessonHour };
  };

  const getRoomTeacher = (roomName: string) => {
    if (!classrooms || classrooms.length === 0 || !selectedBSlot) return null;
    const matchedCls = classrooms.find(c => c && c.name && c.name.trim().toLowerCase() === roomName.trim().toLowerCase());
    if (!matchedCls) return null;

    const { day: slotDay, lessonHour: slotLessonHour } = getSelectedSlotDayAndHour();

    const key1 = `class_${matchedCls.id}_${slotDay}_${slotLessonHour}`;
    const key2 = `class_${matchedCls.id}_${slotDay}_${String(slotLessonHour)}`;
    
    const cell = scheduleData[key1] || scheduleData[key2];
    if (!cell) return null;

    const arr = Array.isArray(cell) ? cell : [cell];
    const activeLesson = arr[0];
    if (!activeLesson) return null;

    return {
      teacherName: activeLesson.teacherName || activeLesson.teacherName2 || null,
      courseName: activeLesson.courseName || null
    };
  };

  const busyTeacherNames = useMemo(() => {
    const busy = new Set<string>();
    if (!selectedBSlot) return busy;
    const { day, lessonHour } = getSelectedSlotDayAndHour();
    (classrooms || []).forEach((cls: any) => {
      if (!cls?.id) return;
      const raw = scheduleData?.[`class_${cls.id}_${day}_${lessonHour}`] || scheduleData?.[`class_${cls.id}_${day}_${String(lessonHour)}`];
      const assignments = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
      assignments.forEach((assignment: any) => {
        [assignment?.teacherName, assignment?.teacherName2].forEach((name) => {
          const normalized = normalizeTeacherName(name);
          if (normalized) busy.add(normalized);
        });
      });
    });
    return busy;
  }, [scheduleData, classrooms, selectedBSlot]);

  const dutyTeacherNames = useMemo(() => {
    const result = new Set<string>();
    const { day } = getSelectedSlotDayAndHour();
    (dutyAssignments || []).forEach((assignment: any) => {
      if (String(assignment?.day || '').trim().toLocaleLowerCase('tr-TR') !== day.toLocaleLowerCase('tr-TR')) return;
      const normalized = normalizeTeacherName(assignment?.teacherName);
      // Nöbetçi öğretmenin o saatte dersi varsa alternatif listede hiç gösterilmez.
      if (normalized && !busyTeacherNames.has(normalized)) result.add(normalized);
    });
    return result;
  }, [dutyAssignments, selectedBSlot, busyTeacherNames]);

  const freeTeacherOptions = useMemo(() => {
    const seen = new Set<string>();
    return (teachers || [])
      .map((teacher: any) => String(teacher?.name || '').trim())
      .filter(Boolean)
      .filter((name: string) => {
        const normalized = normalizeTeacherName(name);
        if (!normalized || seen.has(normalized) || busyTeacherNames.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .sort((a: string, b: string) => {
        const aDuty = dutyTeacherNames.has(normalizeTeacherName(a)) ? 0 : 1;
        const bDuty = dutyTeacherNames.has(normalizeTeacherName(b)) ? 0 : 1;
        if (aDuty !== bDuty) return aDuty - bDuty;
        return a.localeCompare(b, 'tr');
      });
  }, [teachers, busyTeacherNames, dutyTeacherNames]);

  const getAssignedTeacherForRoom = (roomName: string) => {
    const roomKey = normalizeClassroomKey(roomName);
    const stored = Object.entries(roomTeacherAssignments || {}).find(([name]) => normalizeClassroomKey(name) === roomKey)?.[1];
    return String(stored || getRoomTeacher(roomName)?.teacherName || '').trim();
  };

  const setAssignedTeacherForRoom = (roomName: string, teacherName: string) => {
    setRoomTeacherAssignments((prev) => ({ ...prev, [roomName]: teacherName }));
  };

  // Ders programındaki öğretmeni ilk değer olarak otomatik getir; kullanıcı değiştirirse seçimi koru.
  useEffect(() => {
    if (!activeRoomsList.length) return;
    setRoomTeacherAssignments((prev) => {
      let changed = false;
      const next = { ...prev };
      activeRoomsList.forEach((room: any) => {
        const roomName = String(room?.name || '').trim();
        if (!roomName) return;
        const existing = Object.entries(next).find(([name]) => normalizeClassroomKey(name) === normalizeClassroomKey(roomName))?.[1];
        if (String(existing || '').trim()) return;
        const automatic = String(getRoomTeacher(roomName)?.teacherName || '').trim();
        if (automatic) {
          next[roomName] = automatic;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeRoomsList, scheduleData, classrooms, selectedBSlot]);

  const getTeacherOptionsForRoom = (roomName: string) => {
    const current = getAssignedTeacherForRoom(roomName);
    const options = [...freeTeacherOptions];
    if (current && !options.some((name) => normalizeTeacherName(name) === normalizeTeacherName(current))) {
      options.unshift(current);
    }
    return options;
  };

  // Helper to format Turkish dates
  const formatTurkishDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    const monthNames = [
      "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];
    
    return `${day} ${monthNames[month]} ${year}`;
  };

  // Filtered students for manual placement
  const filteredManualStudents = useMemo(() => {
    const q = manualSearchQuery.toLowerCase();
    const listToSearch = students || [];
    
    // If search query is empty, return only assigned students
    if (!manualSearchQuery.trim()) {
      return listToSearch.filter(s => !!manualStudentAssignments[s.id]).map(s => {
        const found = examStudents.find(es => es.id === s.id);
        if (found) return found;
        const matchExam = selectedBSlot?.exams?.find((ex: any) => {
          const sClass = (s.classroom || "").replace(/[\s\-\/]/g, "").toUpperCase();
          return ex.classrooms?.some((c: string) => c.replace(/[\s\-\/]/g, "").toUpperCase() === sClass);
        });
        return {
          ...s,
          examCourse: matchExam ? matchExam.courseName : "Ortak Sınav",
          examGrade: matchExam ? matchExam.gradeLevel : (s.classroom ? `${s.classroom.replace(/\D/g, "")}. Sınıf` : "")
        };
      });
    }

    return listToSearch
      .filter(s => 
        (s.name || "").toLowerCase().includes(q) || 
        (s.number || "").toLowerCase().includes(q) || 
        (s.classroom || "").toLowerCase().includes(q)
      )
      .map(s => {
        const found = examStudents.find(es => es.id === s.id);
        if (found) return found;
        
        // Find matching exam for their classroom/grade level if possible
        const matchExam = selectedBSlot?.exams?.find((ex: any) => {
          const sClass = (s.classroom || "").replace(/[\s\-\/]/g, "").toUpperCase();
          return ex.classrooms?.some((c: string) => c.replace(/[\s\-\/]/g, "").toUpperCase() === sClass);
        });

        return {
          ...s,
          examCourse: matchExam ? matchExam.courseName : "Ortak Sınav",
          examGrade: matchExam ? matchExam.gradeLevel : (s.classroom ? `${s.classroom.replace(/\D/g, "")}. Sınıf` : "")
        };
      });
  }, [students, examStudents, manualSearchQuery, selectedBSlot, manualStudentAssignments]);

  // Handle default salon toggle
  const toggleDefaultSalon = (room: string) => {
    const roomKey = normalizeClassroomKey(room);
    setInactiveDefaultSalons(prev => {
      const isInactive = prev.some((item) => normalizeClassroomKey(item) === roomKey);
      return isInactive
        ? prev.filter((item) => normalizeClassroomKey(item) !== roomKey)
        : [...prev, room];
    });
  };

  // Handle extra school salon toggle
  const toggleExtraSalon = (room: string) => {
    setActiveExtraSalons(prev => 
      prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
    );
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Check if manual assignment capacity has overflowed the room
  const getManualAssignedCount = (roomName: string) => {
    return Object.values(manualStudentAssignments).filter(r => r === roomName).length;
  };

  const gradeStudentCounts = useMemo(() => {
    const counts: Record<number, number> = { 9: 0, 10: 0, 11: 0, 12: 0 };
    examStudents.forEach((student: any) => {
      const source = String(student?.examGrade || student?.classroom || "");
      const match = source.match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
      const grade = match ? Number(match[1]) : 0;
      if (counts[grade] !== undefined) counts[grade] += 1;
    });
    return counts;
  }, [examStudents]);

  const normalizeClassroomKey = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");

  const selectionReady = examStudents.length > 0 && selectedSalonCapacity >= examStudents.length;
  const roomCapacityByKey = useMemo(() => new Map(
    Object.entries(classStudentCapacities).map(([name, capacity]) => [normalizeClassroomKey(name), Number(capacity || 0)]),
  ), [classStudentCapacities]);
  const selectedSalonCount = studentCountsByBranch.filter((item: any) => {
    const key = normalizeClassroomKey(item.branch);
    const active = !inactiveDefaultSalons.some((room) => normalizeClassroomKey(room) === key);
    return active && Number(roomCapacityByKey.get(key) || 0) > 0;
  }).length;

  const getClassGrade = (value: unknown) => {
    const match = String(value || '').match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
    return match ? Number(match[1]) : 0;
  };

  const salonBranchesByGrade = useMemo(() => {
    const groups: Record<number, any[]> = { 9: [], 10: [], 11: [], 12: [] };
    studentCountsByBranch.forEach((item: any) => {
      const grade = getClassGrade(item?.branch);
      if (groups[grade]) groups[grade].push(item);
    });
    Object.values(groups).forEach((items) => {
      items.sort((a: any, b: any) => String(a?.branch || '').localeCompare(String(b?.branch || ''), 'tr', { numeric: true }));
    });
    return groups;
  }, [studentCountsByBranch]);

  return (
    <div className="space-y-6 animate-fade-in print:p-0">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 print:hidden items-stretch min-h-[640px]">
        {/* SOL: SINAV SALONLARI */}
        <div className="min-w-0 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col h-full space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-indigo-500" />
                Sınav Salonlarını Belirle
              </h3>
              <span className="text-[11px] font-black bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                KAPASİTE {selectedSalonCapacity}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 flex-1 overflow-y-auto pr-1 max-h-[520px] content-start">
              {[9, 10, 11, 12].map((grade) => (
                <div key={grade} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/40 p-2.5">
                  <div className="mb-2 rounded-xl bg-white border border-slate-100 px-2 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">{grade}. SINIF</p>
                  </div>
                  <div className="space-y-2">
                    {salonBranchesByGrade[grade].map((item: any) => {
                      const room = String(item.branch || "Belirtilmemiş");
                      const roomCapacity = Number(roomCapacityByKey.get(normalizeClassroomKey(room)) || 0);
                      const hasBuildingCapacity = roomCapacity > 0;
                      const isActive = hasBuildingCapacity && !inactiveDefaultSalons.some(
                        (inactiveRoom) => normalizeClassroomKey(inactiveRoom) === normalizeClassroomKey(room),
                      );

                      return (
                        <label
                          key={room}
                          className={`flex items-start gap-2 p-2.5 border rounded-xl transition-all select-none cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 border-indigo-200 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-indigo-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            disabled={!hasBuildingCapacity}
                            onChange={() => hasBuildingCapacity && toggleDefaultSalon(room)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-black text-slate-800">{room}</p>
                            <p className={`mt-0.5 text-[9px] font-bold leading-tight ${hasBuildingCapacity ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {hasBuildingCapacity ? `Kapasite: ${roomCapacity}` : 'Kapasite yok'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                    {salonBranchesByGrade[grade].length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-2 py-4 text-center text-[9px] font-bold text-slate-300">
                        Sınıf yok
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {studentCountsByBranch.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                Bu oturumda sınavı bulunan sınıf/şube kaydı yok.
              </div>
            )}

            {/* Öğrenci, kapasite ve salon sayısı sınıfların altında yan yana. */}
            <div className={`grid grid-cols-3 gap-3 rounded-2xl border px-4 py-3 ${
              selectionReady ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'
            }`}>
              <div className="min-w-0 border-r border-slate-200/70 pr-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Sınava Girecek Öğrenci Sayısı</p>
                <p className="mt-1 text-xl font-black text-slate-800">{examStudents.length}</p>
              </div>
              <div className="min-w-0 border-r border-slate-200/70 px-1 pr-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Seçilen Salonların Toplam Kapasitesi</p>
                <p className="mt-1 text-xl font-black text-slate-800">{selectedSalonCapacity}</p>
              </div>
              <div className="min-w-0 pl-1">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Seçilen Salon Sayısı</p>
                <p className="mt-1 text-xl font-black text-slate-800">{selectedSalonCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ: SALON GÖREVLİ ÖĞRETMENLERİ */}
        <div className="min-w-0 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col h-full">
            <div className="border-b border-slate-50 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Salon Görevli Öğretmenleri
              </h3>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                Ders programındaki öğretmen otomatik gelir. Gerekirse dersi olmayan başka bir öğretmen seçebilirsiniz.
              </p>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 max-h-[570px]">
              {activeRoomsList.length > 0 ? activeRoomsList.map((room: any) => {
                const roomName = String(room?.name || '');
                const automaticInfo = getRoomTeacher(roomName);
                const selectedTeacher = getAssignedTeacherForRoom(roomName);
                const options = getTeacherOptionsForRoom(roomName);
                return (
                  <div key={roomName} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-800">{roomName}</p>
                        {automaticInfo?.courseName && (
                          <p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">{automaticInfo.courseName}</p>
                        )}
                      </div>
                      {selectedTeacher && dutyTeacherNames.has(normalizeTeacherName(selectedTeacher)) && !busyTeacherNames.has(normalizeTeacherName(selectedTeacher)) && (
                        <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[8px] font-black text-red-600">NÖBETÇİ</span>
                      )}
                    </div>
                    <select
                      value={selectedTeacher}
                      onChange={(e) => setAssignedTeacherForRoom(roomName, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-black text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Öğretmen seçiniz</option>
                      {options.map((teacherName) => {
                        const isDuty = dutyTeacherNames.has(normalizeTeacherName(teacherName)) && !busyTeacherNames.has(normalizeTeacherName(teacherName));
                        return (
                          <option key={teacherName} value={teacherName} className={isDuty ? 'text-red-600 font-bold' : ''}>
                            {teacherName}{isDuty ? ' — Nöbetçi' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[10px] font-bold text-slate-400">
                  Önce soldan sınav salonlarını seçiniz.
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={!canSaveSalonSelection}
                onClick={() => void handleSaveSalonSelection()}
                className={`w-full px-5 py-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black shadow-sm transition-all active:scale-95 ${
                  canSaveSalonSelection
                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white cursor-pointer shadow-emerald-600/10'
                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60'
                }`}
                title={canSaveSalonSelection ? 'Salon ve görevli öğretmen seçimlerini veritabanına kaydet' : 'Kaydedilecek bir değişiklik yok.'}
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{isSavingSalonSelection ? 'Kaydediliyor...' : 'Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}

// Helpers inside subview
function formatOturumLabel(slot: any) {
  if (!slot) return "";
  const dateParts = slot.dateStr ? slot.dateStr.split('-') : [];
  let formattedDate = slot.dateStr;
  if (dateParts.length === 3) {
    formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
  }
  return `${formattedDate} (${slot.dayName || ""}) • ${slot.sessionIndex}. Oturum`;
}
