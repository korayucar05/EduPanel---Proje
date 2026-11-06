import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Calendar as CalendarIcon, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  Check, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Printer, 
  Info, 
  CheckSquare, 
  Square,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  CalendarDays,
  Users,
  X,
  Search,
  FileSpreadsheet,
  UserMinus,
  Plus,
  Edit2,
  MessageCircle,
  Send
} from "lucide-react";
import { PdfEngine, createAbsentStudentsDefinition, createExamPlanDefinition } from "../pdf";
import { examCalendarService } from "../modules/exam";
import { planningService } from "../modules/planning";

import { sqliteStorage } from "../core/state/SyncStateStore";
import { KelebekPlanModals } from './kelebek/KelebekPlanModals';
import { KelebekAbsentManagementModals } from './kelebek/KelebekAbsentManagementModals';
import { KelebekSetupPanels } from './kelebek/KelebekSetupPanels';
import { KelebekPlanActions } from './kelebek/KelebekPlanActions';
import { KelebekPlanOutputPanel } from './kelebek/KelebekPlanOutputPanel';
import { doClassroomsConflict, doExamsConflict, getBaseClassroom, getNormalizedBaseClassroom, getTeacherForStudent } from './kelebek/kelebekConflictUtils';
import KelebekSystemAModule from './KelebekSystemAModule';
interface KelebekSystemBModuleProps {
  students: any[];
  courses: any[];
  classrooms?: any[];
  customCreatedCourses?: any[];
}

interface JointExam {
  id: string;
  gradeLevel: string;
  courseName: string;
  schedule: string;
  weeklyHours: number;
  classrooms: string[];
  isCompulsory?: boolean;
}

interface ScheduleSlot {
  id?: string;
  dayIndex: number;
  sessionIndex: number;
  exams: JointExam[];
  dateStr: string;
  dayName: string;
  sessionLabel: string;
  timeStr?: string;
  makeupDateStr?: string;
  makeupDayName?: string;
  makeupTimeStr?: string;
}

export default function KelebekSystemBModule({ students, courses, classrooms = [], customCreatedCourses = [] }: KelebekSystemBModuleProps) {
  // Navigation tabs: 'A' | 'B' | 'C'
  const [activeSubTab, setActiveSubTab] = useState<'A' | 'B' | 'C'>('B');
  const [integratedSeatingView, setIntegratedSeatingView] = useState<'sorular' | 'yerlesim' | 'bilgiler' | 'planlar' | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("Tüm Sınıflar");
  const [isAssocSettingsLoaded, setIsAssocSettingsLoaded] = useState<boolean>(false);
  
  // Basic Config State
  const [daysCount, setDaysCount] = useState<number>(5);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [selectedTerm, setSelectedTerm] = useState<string>("1. Dönem");
  const [selectedExamNo, setSelectedExamNo] = useState<string>("1. Yazılı");
  const [planningLocks, setPlanningLocks] = useState<Record<string, boolean>>({});
  const [selectedWorkflowSlotKey, setSelectedWorkflowSlotKey] = useState<string | null>(null);
  const planningLocked = selectedWorkflowSlotKey ? Boolean(planningLocks[selectedWorkflowSlotKey]) : false;
  
  // Interactive Cell Selector State
  const [cellExamSelector, setCellExamSelector] = useState<{slotIndex: number, gradeLevel: string} | null>(null);
  
  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);

  // Compact exam-session card editor. Changes are committed only when the user presses Save.
  const [editingSessionIndex, setEditingSessionIndex] = useState<number | null>(null);
  const [sessionEditorDraft, setSessionEditorDraft] = useState<{
    dateStr: string;
    timeStr: string;
    sessionIndex: number;
    makeupDateStr: string;
    makeupTimeStr: string;
  } | null>(null);
  const [calendarSaveError, setCalendarSaveError] = useState<string | null>(null);
  
  // Custom Date and Active Slots States
  const [startDate, setStartDate] = useState<string>("2026-07-06");
  const [activeSlotsConfig, setActiveSlotsConfig] = useState<{ [dateStr: string]: boolean[] }>({});
  const [sessionHours, setSessionHours] = useState<string[]>(["09:40", "11:00", "14:00", "15:30"]);

  const [customDays, setCustomDays] = useState<string[]>([
    "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"
  ]);

  // Excluded courses (courses user does not want to schedule, e.g. Rehberlik, Beden Eğitimi)
  const [excludedCourseNames, setExcludedCourseNames] = useState<string[]>([
    "Rehberlik", "Beden Eğitimi", "Görsel Sanatlar", "Müzik", "Beden Eğitimi ve Spor"
  ]);

  // Difficult Courses State (per grade level)
  const [difficultCourses, setDifficultCourses] = useState<{ [gradeLevel: string]: string[] }>({
    "9. Sınıf": ["Matematik", "Fizik", "Kimya"],
    "10. Sınıf": ["Matematik", "Fizik", "Kimya"],
    "11. Sınıf": ["Matematik", "Fizik", "Kimya", "Seçmeli Matematik"],
    "12. Sınıf": ["Matematik", "Fizik", "Kimya", "Seçmeli Matematik"]
  });

  // Saved/Loaded Plans
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const loadedTermExamRef = useRef<{ term: string, examNo: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<{
    id: string;
    term: string;
    examNo: string;
    slots: ScheduleSlot[];
    days: string[];
    unplacedExams?: JointExam[];
    startDate?: string;
    daysCount?: number;
    sessionsPerDay?: number;
  } | null>(null);

  // Active view tab for results: 'table' | 'grid' | 'classroom' | 'absent'
  const [resultSubTab, setResultSubTab] = useState<'table' | 'grid' | 'classroom' | 'absent'>('table');
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isAbsentActionsDropdownOpen, setIsAbsentActionsDropdownOpen] = useState(false);
  const [selectedClassroomFilter, setSelectedClassroomFilter] = useState<string>("");
  const [isAbsentReportModalOpen, setIsAbsentReportModalOpen] = useState(false);
  const [isPdfOptionsModalOpen, setIsPdfOptionsModalOpen] = useState(false);

  // States for adding absent student via popup
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMissedExam, setSelectedMissedExam] = useState<string>("");
  const [absentStudentSearchQuery, setAbsentStudentSearchQuery] = useState("");
  const [selectedStudentForAbsent, setSelectedStudentForAbsent] = useState<any | null>(null);
  const [isBulkWhatsAppModalOpen, setIsBulkWhatsAppModalOpen] = useState(false);

  const generateWhatsAppLink = (teacherName: string, students: any[]) => {
    const makeupStudents = students.filter(s => s.canTakeMakeup);
    const noMakeupStudents = students.filter(s => !s.canTakeMakeup);
    
    let text = `Sayın ${teacherName},\n\nSınavlarınıza katılamayan öğrencilerin listesi aşağıdadır:\n`;
    if (makeupStudents.length > 0) {
      text += `\n✅ *Telafiye Girebilecek Öğrenciler:*\n`;
      makeupStudents.forEach(s => {
        const courseName = s.missedExam ? s.missedExam.split(' (')[0] : "Ortak Sınav";
        text += `- ${s.name} ${s.surname} (${s.classroom} - No: ${s.studentNumber}) - ${courseName}\n`;
      });
    }
    if (noMakeupStudents.length > 0) {
      text += `\n❌ *Telafiye Giremeyecek Öğrenciler:*\n`;
      noMakeupStudents.forEach(s => {
        const courseName = s.missedExam ? s.missedExam.split(' (')[0] : "Ortak Sınav";
        text += `- ${s.name} ${s.surname} (${s.classroom} - No: ${s.studentNumber}) - ${courseName}\n`;
      });
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const autoSaveAssoc = async (newDifficult: typeof difficultCourses, newExcluded: string[]) => {
    try {
      const suffix = getKeySuffix(selectedTerm, selectedExamNo);
      await planningService.saveCourseSettings(selectedTerm, selectedExamNo, newDifficult, newExcluded);
    } catch (error) {
      console.error("Ortak ders ayarları otomatik kaydetme hatası:", error);
    }
  };

  const getKeySuffix = (term: string, examNo: string) => {
    return "_" + term.replace(/\s+/g, '_') + "_" + examNo.replace(/\s+/g, '_');
  };

  const getSessionWorkflowKey = (slot: any) => {
    const id = String(slot?.id || '').trim();
    if (id) return id;
    const date = String(slot?.dateStr || 'tarih');
    const time = String(slot?.timeStr || slot?.sessionTime || 'saat');
    const session = Number(slot?.sessionIndex || 1);
    return `${date}_${time}_${session}`;
  };

  const findPlanSlotForCalendarSession = (session: any) => {
    if (!currentPlan?.slots?.length || !session) return null;
    return currentPlan.slots.find((slot: any) =>
      (slot?.id && session?.id && String(slot.id) === String(session.id)) ||
      (String(slot?.dateStr || '') === String(session?.dateStr || '') &&
       Number(slot?.sessionIndex || 1) === Number(session?.sessionIndex || 1))
    ) || null;
  };

  // Sınav takvimi kalıcılığı artık merkezi ExamCalendarService üzerinden yönetilir.
  // UI katmanı SQLite yardımcılarını doğrudan çağırmaz.
  const readExamCalendarFromSQLite = async (term: string, examNo: string) =>
    examCalendarService.get(term, examNo);

  const writeExamCalendarToSQLite = async (nextDates: any[]) => {
    await examCalendarService.save({
      selectedTerm,
      selectedExamNo,
      startDate,
      daysCount,
      sessionsPerDay,
      computedDates: nextDates,
    });
  };

  // 1. On Mount: Load the last selected term/examNo combination
  useEffect(() => {
    const loadSelections = async () => {
      try {
        const lastSelections = await planningService.getLastSelection() as any;
        if (lastSelections) {
          if (lastSelections.selectedTerm) setSelectedTerm(lastSelections.selectedTerm);
          if (lastSelections.selectedExamNo) setSelectedExamNo(lastSelections.selectedExamNo);
        }
      } catch (e) {
        console.error("Error loading last selections:", e);
      } finally {
        setIsInitialLoadDone(true);
      }
    };
    loadSelections();
  }, []);

  // 2. Reactive Loader: Load data specific to [selectedTerm, selectedExamNo]
  useEffect(() => {
    if (!isInitialLoadDone) return;

    const loadDataForExam = async () => {
      setIsLoadingConfig(true);
      const suffix = getKeySuffix(selectedTerm, selectedExamNo);
      
      // Save last selections
      planningService.saveLastSelection({ selectedTerm, selectedExamNo }).catch(err => console.error(err));

      try {
        // 1. Load saved plans and current plan
        const planningState = await planningService.getState(selectedTerm, selectedExamNo);
        const loadedPlanningLocks: Record<string, boolean> = planningState?.planningLocks && typeof planningState.planningLocks === 'object'
          ? { ...planningState.planningLocks } as Record<string, boolean>
          : {};
        const savedPlansData = planningState?.savedPlans;
        if (savedPlansData && Array.isArray(savedPlansData)) {
          setSavedPlans(savedPlansData);
          if (savedPlansData.length > 0) {
            setCurrentPlan(planningState?.currentPlan || savedPlansData[0]);
          } else {
            setCurrentPlan(null);
          }
        } else {
          setSavedPlans([]);
          setCurrentPlan(null);
        }

        // Kilit artık oturum bazındadır. Eski tekil kilit kaydı varsa ilk planlı
        // oturuma bir kez aktarılır; yeni oturumlar bu nedenle bloke olmaz.
        if (Object.keys(loadedPlanningLocks).length === 0 && planningState?.planningLocked && savedPlansData?.[0]?.slots?.length) {
          const firstPlannedSlot = savedPlansData[0].slots.find((slot: any) => (slot?.exams || []).length > 0) || savedPlansData[0].slots[0];
          if (firstPlannedSlot) loadedPlanningLocks[getSessionWorkflowKey(firstPlannedSlot)] = true;
        }
        setPlanningLocks(loadedPlanningLocks);
        setSelectedWorkflowSlotKey(null);
        setIntegratedSeatingView(null);

        // 2. Load exam calendar config directly from the single local SQLite database.
        // Legacy localforage is read only once as a migration fallback when SQLite has no record.
        let savedConfigData: any = null;
        try {
          savedConfigData = await readExamCalendarFromSQLite(selectedTerm, selectedExamNo);
        } catch (error) {
          console.error("Sınav takvimi SQLite kaydı okunamadı:", error);
        }


        if (savedConfigData) {
          const savedConfig: any = savedConfigData;
          if (savedConfig.computedDates) {
            const preparedDates = savedConfig.computedDates.map((d: any, idx: number) => ({
              ...d,
              id: d.id || `day_loaded_${idx}_${Date.now()}`
            }));
            // Sort preparedDates chronologically
            preparedDates.sort((a: any, b: any) => {
              const dateCompare = (a.dateStr || "").localeCompare(b.dateStr || "");
              if (dateCompare !== 0) return dateCompare;
              const aSession = a.sessionIndex || 1;
              const bSession = b.sessionIndex || 1;
              return aSession - bSession;
            });
            setComputedDates(preparedDates);
          } else {
            setComputedDates([]);
          }
          if (savedConfig.startDate) setStartDate(savedConfig.startDate);
          if (savedConfig.daysCount) setDaysCount(savedConfig.daysCount);
          if (savedConfig.sessionsPerDay) setSessionsPerDay(savedConfig.sessionsPerDay);
        } else {
          setComputedDates([]);
          setStartDate("2026-07-06");
          setDaysCount(5);
          setSessionsPerDay(2);
        }

        // 3. Load sub-tab A (Associated courses) settings
        let loadedDifficult: any = null;
        let loadedExcluded: any = null;

        loadedDifficult = planningState?.difficultCourses || null;
        loadedExcluded = planningState?.excludedCourseNames || null;

        // Planlama durumu artık tek kaynak olarak PlanningService/SQLite üzerinden okunur.

        // Apply to state
        if (loadedDifficult) {
          setDifficultCourses(loadedDifficult);
        } else {
          setDifficultCourses({
            "9. Sınıf": ["Matematik", "Fizik", "Kimya"],
            "10. Sınıf": ["Matematik", "Fizik", "Kimya"],
            "11. Sınıf": ["Matematik", "Fizik", "Kimya", "Seçmeli Matematik"],
            "12. Sınıf": ["Matematik", "Fizik", "Kimya", "Seçmeli Matematik"]
          });
        }

        if (loadedExcluded) {
          setExcludedCourseNames(loadedExcluded);
        } else {
          setExcludedCourseNames([
            "Rehberlik", "Beden Eğitimi", "Görsel Sanatlar", "Müzik", "Beden Eğitimi ve Spor"
          ]);
        }
        setIsAssocSettingsLoaded(true);

      } catch (e) {
        console.error("Error loading specific B configs:", e);
      } finally {
        loadedTermExamRef.current = { term: selectedTerm, examNo: selectedExamNo };
        setIsLoadingConfig(false);
      }
    };

    loadDataForExam();
  }, [isInitialLoadDone, selectedTerm, selectedExamNo]);


  // Helper to get grade level from classroom name (e.g. "9 - A" -> "9. Sınıf")
  const getGradeLevel = (classroom: string): string => {
    if (!classroom) return "Diğer";
    const match = classroom.match(/^(\d+)/);
    if (match) {
      return `${match[0]}. Sınıf`;
    }
    return "Diğer";
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

  // Helper to parse weekly hours from schedule string (e.g. "Haftalık 4 Saat" -> 4)
  const parseWeeklyHours = (schedule: string): number => {
    const match = String(schedule || "").match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 2;
  };

  // Extract all unique classroom names from students and courses
  const allClassrooms = useMemo(() => {
    const classes = new Set<string>();
    students.forEach(s => {
      if (s.classroom) classes.add(s.classroom.trim());
    });
    courses.forEach(c => {
      if (c.classroom) classes.add(c.classroom.trim());
    });
    return Array.from(classes).sort((a, b) => {
      return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
    });
  }, [students, courses]);

  // Group Courses into Joint Exams (Ortak Sınavlar)
  // Two course entries are "common" if they have the exact same grade level, base name, and weekly hours.
  const jointExams = useMemo(() => {
    const groups: { [key: string]: JointExam } = {};

    courses.forEach(c => {
      if (!c.name || !c.classroom) return;
      const courseNameClean = c.name.trim();
      
      // HDT ile başlayan dersler sınav planlamasına dahil edilmez.
      if (courseNameClean.toUpperCase().startsWith("HDT") || (c.code && c.code.trim().toUpperCase().startsWith("HDT"))) {
        return;
      }

      const gradeLvl = getGradeLevel(c.classroom);
      const hours = parseWeeklyHours(c.schedule);

      // We clean the course name to group them together. E.g. "Matematik (1. Grup)" and "Matematik" become "Matematik".
      const baseName = courseNameClean.replace(/\s*\([^)]+\)$/, "").trim();

      // Check if this course is compulsory (Zorunlu) in any classroom setup or custom created courses
      const classroomObj = classrooms.find(cls => cls.name === c.classroom);
      const assignedCourseObj = classroomObj?.assignedCourses?.find(ac => 
        ac.courseName.trim().toLowerCase() === c.name.trim().toLowerCase()
      );
      const isCompulsory = assignedCourseObj?.type === "compulsory" || assignedCourseObj?.type === "Zorunlu Ders";
      
      const customCourse = customCreatedCourses.find(cc => 
        cc.gradeLevel === gradeLvl && 
        cc.courseName.trim().toLowerCase() === baseName.toLowerCase()
      );
      const isCompulsoryFromCustom = customCourse?.courseType === "Zorunlu Ders";

      const isCompulsoryByName = (name: string): boolean => {
        const lower = name.toLowerCase();
        // Standard compulsory courses in Turkish High Schools
        if (lower.includes("edebiyat") || lower.includes("tarih") || lower.includes("din") || lower.includes("felsefe") || lower.includes("ingilizce") || lower.includes("inkilap") || lower.includes("rehberlik") || lower.includes("beden") || lower.includes("gorsel") || lower.includes("muzik") || lower.includes("almanca")) {
          if (!lower.includes("secmeli") && !lower.includes("sec.") && !lower.startsWith("s.")) {
            return true;
          }
        }
        return false;
      };

      const isZorunlu = isCompulsory || isCompulsoryFromCustom || isCompulsoryByName(baseName);

      // Group key: GradeLevel_BaseCourseName_Hours
      // (This perfectly aligns with "Mesela 9. Sınıf matematik ile 10. Sınıf matematik ortak değildir.")
      const key = `${gradeLvl}_${baseName}_${hours}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          gradeLevel: gradeLvl,
          courseName: baseName,
          schedule: c.schedule || `Haftalık ${hours} Saat`,
          weeklyHours: hours,
          classrooms: [],
          isCompulsory: isZorunlu
        };
      } else {
        if (isZorunlu) {
          groups[key].isCompulsory = true;
        }
      }

      // "Bir ders, ders saati sayısı aynı olmak ve aynı sınıf düzeyinde olmak şartıyla hangi şubelere veya gruplara atanmışsa bu ders o şubeler veya gruplar için ortaktır."
      // We label branches and groups beautifully
      let displayGroup = c.groupName || "";
      if (displayGroup && students && students.length > 0) {
        const studentClassNorm = c.classroom ? getNormalizedBaseClassroom(c.classroom) : "";
        const studentsInClass = students.filter(s => s.classroom && getNormalizedBaseClassroom(s.classroom) === studentClassNorm);
        
        // Find if any students in this class actually have a group assigned
        const hasAnyStudentWithGroup = studentsInClass.some(s => s.group && s.group.trim());
        if (hasAnyStudentWithGroup) {
          const actualStudentGroups = new Set(
            studentsInClass
              .map(s => (s.group || "").trim().toUpperCase())
              .filter(Boolean)
          );
          const courseGroups = displayGroup
            .split(",")
            .map(g => g.trim().toUpperCase())
            .filter(Boolean);
          
          const validGroups = courseGroups.filter(g => {
            return actualStudentGroups.has(g) || Array.from(actualStudentGroups).some(asg => asg.includes(g) || g.includes(asg));
          });
          if (validGroups.length > 0) {
            displayGroup = validGroups.join(", ");
          }
        }
      }

      const is12A = c.classroom && (
        c.classroom.trim() === "12-A" || 
        c.classroom.trim() === "12 A" || 
        c.classroom.trim() === "12A" || 
        c.classroom.trim().toLowerCase() === "12 a" || 
        c.classroom.trim().toLowerCase() === "12-a"
      );
      const isSMatematik = c.name && (
        c.name.toLowerCase().includes("s. matematik") || 
        c.name.toLowerCase().includes("seçmeli matematik") || 
        c.name.toLowerCase().includes("s.matematik")
      );
      if (is12A && isSMatematik && displayGroup.toLowerCase().includes("eşit ağırlık")) {
        displayGroup = "";
      }
      const label = c.classroom + (displayGroup ? ` (${displayGroup})` : "");
      if (!groups[key].classrooms.includes(label)) {
        groups[key].classrooms.push(label);
      }
    });


    // Eksik şubeleri classrooms[].assignedCourses üzerinden tamamla.
    // courses dizisinde bir şube kaydı eksik olsa bile, sınıf/ders/öğretmen ekranında
    // aynı ders aynı haftalık saat ile atanmışsa ortak sınav grubuna dahil edilir.
    classrooms.forEach(classroom => {
      const classroomName = String(classroom?.name || "").trim();
      if (!classroomName) return;

      const gradeLvl = getGradeLevel(classroomName);

      (classroom.assignedCourses || []).forEach((assigned: any) => {
        const rawCourseName = String(assigned?.courseName || "").trim();
        if (!rawCourseName) return;

        // HDT dersleri sınav planlamasına dahil edilmez.
        if (rawCourseName.toLocaleUpperCase("tr-TR").startsWith("HDT")) return;

        const baseName = rawCourseName.replace(/\s*\([^)]+\)$/, "").trim();

        const assignedHours =
          Number(assigned?.weeklyHours || assigned?.hours || 0) ||
          parseWeeklyHours(String(assigned?.schedule || ""));

        if (!assignedHours) return;

        // Var olan joint exam anahtarını Türkçe büyük/küçük harf farkına dayanıklı bul.
        const normalizedTargetName = baseName
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("tr-TR");

        const matchingKey = Object.keys(groups).find(groupKey => {
          const group = groups[groupKey];
          const normalizedGroupName = String(group.courseName || "")
            .replace(/\s+/g, " ")
            .toLocaleLowerCase("tr-TR");

          return (
            group.gradeLevel === gradeLvl &&
            normalizedGroupName === normalizedTargetName &&
            Number(group.weeklyHours || 0) === Number(assignedHours)
          );
        });

        if (!matchingKey) return;

        const group = groups[matchingKey];

        // Grup bilgisi varsa etikete ekle; aynı sınıfın grup kayıtlarını ayırt et.
        let displayGroup = String(assigned?.groupName || "").trim();

        // "Ortak", "Genel", "Tümü" gibi tüm sınıfı ifade eden grup adlarını gösterme.
        const normalizedGroup = displayGroup.toLocaleLowerCase("tr-TR");
        if (
          normalizedGroup === "ortak" ||
          normalizedGroup === "genel" ||
          normalizedGroup === "tümü" ||
          normalizedGroup === "tum" ||
          normalizedGroup === "all"
        ) {
          displayGroup = "";
        }

        const label = classroomName + (displayGroup ? ` (${displayGroup})` : "");

        // Aynı şubeyi farklı yazım biçimleriyle iki kez ekleme.
        const normalizeLabel = (value: string) =>
          String(value || "")
            .replace(/\s+/g, "")
            .replace(/-/g, "")
            .toLocaleLowerCase("tr-TR");

        const labelKey = normalizeLabel(label);
        const exists = group.classrooms.some((existing: string) => {
          const existingKey = normalizeLabel(existing);

          // Tam etiket eşleşmesi
          if (existingKey === labelKey) return true;

          // Eğer yeni kayıt grup bilgisizse, aynı temel sınıf daha önce grup bilgili
          // kaydedilmiş olabilir. Bu durumda temel sınıfı yine de eksik sayma.
          const baseExisting = normalizeLabel(String(existing).split("(")[0]);
          const baseNew = normalizeLabel(classroomName);

          return !displayGroup && baseExisting === baseNew;
        });

        if (!exists) {
          group.classrooms.push(label);
        }
      });
    });

    // Sort classrooms in each group
    Object.values(groups).forEach(g => {
      g.classrooms.sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
    });

    return Object.values(groups).sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) {
        return a.gradeLevel.localeCompare(b.gradeLevel, "tr", { numeric: true });
      }
      return a.courseName.localeCompare(b.courseName, "tr");
    });
  }, [courses, classrooms, customCreatedCourses]);

  // Active exams list (filter out excluded/passive courses)
  const activeExams = useMemo(() => {
    return jointExams.filter(exam => {
      return !excludedCourseNames.some(ex => 
        exam.courseName.toLowerCase() === ex.toLowerCase() || 
        exam.courseName.toLowerCase().includes(ex.toLowerCase())
      );
    });
  }, [jointExams, excludedCourseNames]);

  // Unique course names per grade level to let user choose difficult ones
  const uniqueCourseNamesByGrade = useMemo(() => {
    const map: { [grade: string]: string[] } = {
      "9. Sınıf": [],
      "10. Sınıf": [],
      "11. Sınıf": [],
      "12. Sınıf": [],
      "Diğer": []
    };

    courses.forEach(c => {
      if (!c.name || !c.classroom) return;
      const nameClean = c.name.trim();
      const grade = getGradeLevel(c.classroom);
      if (map[grade] && !map[grade].includes(nameClean)) {
        map[grade].push(nameClean);
      }
    });

    // Sort names alphabetically
    Object.keys(map).forEach(grade => {
      map[grade].sort((a, b) => a.localeCompare(b, "tr"));
    });

    return map;
  }, [courses]);

  // Toggle Excluded Course
  const toggleExcludedCourse = (courseName: string, gradeLevel?: string) => {
    setExcludedCourseNames(prev => {
      const is12thGradeMatOrUyg = (name: string, gr?: string) => {
        if (!name) return false;
        const isGrade12 = gr === "12. Sınıf" || gr === "12.Sınıf" || gr === "12 Sınıf" || (gr && gr.includes("12"));
        if (!isGrade12) return false;
        const n = name.toLowerCase();
        const matchesMat = n.includes("s. matematik") || n.includes("s.matematik") || n.includes("seçmeli matematik") || n.includes("seç. matematik");
        return matchesMat;
      };

      let updated: string[];
      if (is12thGradeMatOrUyg(courseName, gradeLevel)) {
        const relatedCourseNames = jointExams
          .filter(j => is12thGradeMatOrUyg(j.courseName, j.gradeLevel))
          .map(j => j.courseName);
        
        if (!relatedCourseNames.includes(courseName)) {
          relatedCourseNames.push(courseName);
        }

        const isCurrentlyExcluded = prev.some(c => c.toLowerCase() === courseName.toLowerCase());

        if (isCurrentlyExcluded) {
          updated = prev.filter(c => !relatedCourseNames.some(rc => rc.toLowerCase() === c.toLowerCase()));
        } else {
          const newExcluded = [...prev];
          relatedCourseNames.forEach(rc => {
            if (!newExcluded.some(c => c.toLowerCase() === rc.toLowerCase())) {
              newExcluded.push(rc);
            }
          });
          updated = newExcluded;
        }
      } else {
        if (prev.includes(courseName)) {
          updated = prev.filter(c => c !== courseName);
        } else {
          updated = [...prev, courseName];
        }
      }
      autoSaveAssoc(difficultCourses, updated);
      return updated;
    });
  };

  // Toggle Difficult Course status
  const toggleDifficultCourse = (gradeLevel: string, courseName: string) => {
    setDifficultCourses(prev => {
      const current = prev[gradeLevel] || [];
      let updated: typeof difficultCourses;
      if (current.includes(courseName)) {
        updated = {
          ...prev,
          [gradeLevel]: current.filter(c => c !== courseName)
        };
      } else {
        updated = {
          ...prev,
          [gradeLevel]: [...current, courseName]
        };
      }
      autoSaveAssoc(updated, excludedCourseNames);
      return updated;
    });
  };

  // Helper to generate count weekday dates starting from startStr
  const getWeekdayDates = (startStr: string, count: number) => {
    if (!startStr) return [];
    const list: { dateStr: string; dayName: string }[] = [];
    let current = new Date(startStr);
    if (isNaN(current.getTime())) {
      current = new Date();
    }
    
    const daysOfWeekTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    
    let iterations = 0;
    while (list.length < count && iterations < 100) {
      iterations++;
      const dayVal = current.getDay();
      if (dayVal !== 0 && dayVal !== 6) { // Skip Sunday (0) and Saturday (6)
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;
        list.push({
          dateStr: formattedDate,
          dayName: daysOfWeekTr[dayVal]
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return list;
  };

  // Keep computedDates as state to allow customizable calendar & custom day labels
  interface AbsentStudent {
    id: string;
    name: string;
    surname: string;
    studentNumber: string;
    classroom: string;
    missedExam?: string;
    missedExamOverride?: string;
    canTakeMakeup?: boolean;
  }
  const [computedDates, setComputedDates] = useState<{ 
    id?: string;
    dateStr: string; 
    dayName: string; 
    lessonHour: number; 
    sessionIndex?: number;
    timeStr?: string;
    makeupDateStr?: string; 
    makeupDayName?: string;
    makeupTimeStr?: string;
    absentStudents?: AbsentStudent[];
  }[]>([]);

  const [absentSearchText, setAbsentSearchText] = useState<{ [index: number]: string }>({});

  const addAbsentStudentToSlot = (index: number, student: any, missedExam?: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        const absentList = copy[index].absentStudents || [];
        if (!absentList.some(s => s.id === student.id)) {
          let computedMissedExam = missedExam || "Ortak Sınav";
          
          if (currentPlan && currentPlan.slots && currentPlan.slots[index]) {
            const slot = currentPlan.slots[index];
            const slotExams = slot.exams || [];
            const studentClassNorm = student.classroom ? getNormalizedBaseClassroom(student.classroom) : "";
            
            // 1. Find joint exam for this classroom
            // If user provided a selectedMissedExam (which is the exact exam name), use it to find the exam.
            let targetExam = missedExam ? slotExams.find(ex => ex.courseName === missedExam) : undefined;
            
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
              computedMissedExam = `${targetExam.courseName} (${teacherName})`;
            }
          }

          copy[index] = {
            ...copy[index],
            absentStudents: [
              ...absentList,
              {
                id: student.id,
                name: student.name || "",
                surname: student.surname || "",
                studentNumber: student.studentNumber || student.id || "",
                classroom: student.classroom || "",
                missedExam: computedMissedExam
              }
            ]
          };
        }
      }
      // Auto-save configuration to keep absent records persisted
      const dataToSave = {
        computedDates: copy,
        selectedTerm,
        selectedExamNo,
        startDate,
        daysCount,
        sessionsPerDay
      };
      return copy;
    });
  };

  const removeAbsentStudentFromSlot = (index: number, studentId: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        const absentList = copy[index].absentStudents || [];
        copy[index] = {
          ...copy[index],
          absentStudents: absentList.filter(s => s.id !== studentId)
        };
      }
      // Auto-save configuration to keep absent records persisted
      const dataToSave = {
        computedDates: copy,
        selectedTerm,
        selectedExamNo,
        startDate,
        daysCount,
        sessionsPerDay
      };
      return copy;
    });
  };

  const toggleAbsentStudentMakeup = (index: number, studentId: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        const absentList = copy[index].absentStudents || [];
        copy[index] = {
          ...copy[index],
          absentStudents: absentList.map(s => s.id === studentId ? { ...s, canTakeMakeup: !s.canTakeMakeup } : s)
        };
      }
      const dataToSave = {
        computedDates: copy,
        selectedTerm,
        selectedExamNo,
        startDate,
        daysCount,
        sessionsPerDay
      };
      return copy;
    });
  };

  const updateAbsentStudentMissedExam = (dayIndex: number, studentId: string, overrideText: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[dayIndex]) {
        const absentList = copy[dayIndex].absentStudents || [];
        const studentIndex = absentList.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          const updatedStudent = { ...absentList[studentIndex], missedExamOverride: overrideText };
          absentList[studentIndex] = updatedStudent;
          copy[dayIndex] = { ...copy[dayIndex], absentStudents: absentList };
        }
      }
      // Auto-save configuration
      const dataToSave = {
        computedDates: copy,
        selectedTerm,
        selectedExamNo,
        startDate,
        daysCount,
        sessionsPerDay
      };
      return copy;
    });
  };

  const updateDateAt = (index: number, newDateStr: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        let dayName = copy[index].dayName;
        const d = new Date(newDateStr);
        if (!isNaN(d.getTime())) {
          const daysOfWeekTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
          dayName = daysOfWeekTr[d.getDay()];
        }
        copy[index] = { ...copy[index], dateStr: newDateStr, dayName };
      }
      return copy;
    });
  };

  const updateLessonHourAt = (index: number, newHour: number) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], lessonHour: newHour };
      }
      return copy;
    });
  };

  const updateSessionIndexAt = (index: number, newSession: number) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], sessionIndex: newSession };
      }
      return copy;
    });
  };

  const updateMakeupDateAt = (index: number, newDateStr: string) => {
    setComputedDates(prev => {
      const copy = [...prev];
      if (copy[index]) {
        let makeupDayName = "";
        if (newDateStr) {
          const d = new Date(newDateStr);
          if (!isNaN(d.getTime())) {
            const daysOfWeekTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
            makeupDayName = daysOfWeekTr[d.getDay()];
          }
        }
        copy[index] = { ...copy[index], makeupDateStr: newDateStr, makeupDayName };
      }
      return copy;
    });
  };

  const getDefaultSessionTime = (sessionIndex: number) => {
    return sessionHours[Math.max(0, Math.min(sessionHours.length - 1, sessionIndex - 1))] || "09:00";
  };

  const openSessionEditor = (index: number) => {
    const slot = computedDates[index];
    if (!slot) return;
    const normalizedSession = slot.sessionIndex || 1;
    setEditingSessionIndex(index);
    setSessionEditorDraft({
      dateStr: slot.dateStr || "",
      timeStr: slot.timeStr || getDefaultSessionTime(normalizedSession),
      sessionIndex: normalizedSession,
      makeupDateStr: slot.makeupDateStr || "",
      makeupTimeStr: slot.makeupTimeStr || "",
    });
  };

  const closeSessionEditor = () => {
    setEditingSessionIndex(null);
    setSessionEditorDraft(null);
  };

  const saveSessionEditor = async () => {
    if (editingSessionIndex === null || !sessionEditorDraft) return;
    const draft = sessionEditorDraft;
    const copy = [...computedDates];
    const examDate = draft.dateStr ? new Date(`${draft.dateStr}T00:00:00`) : null;
    const makeupDate = draft.makeupDateStr ? new Date(`${draft.makeupDateStr}T00:00:00`) : null;
    const daysOfWeekTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const isNewSession = editingSessionIndex === -1;

    let updatedSession: any;
    if (isNewSession) {
      updatedSession = {
        id: "day_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        dateStr: draft.dateStr,
        dayName: examDate && !isNaN(examDate.getTime()) ? daysOfWeekTr[examDate.getDay()] : "",
        lessonHour: 1,
        timeStr: draft.timeStr,
        sessionIndex: draft.sessionIndex,
        makeupDateStr: draft.makeupDateStr,
        makeupDayName: makeupDate && !isNaN(makeupDate.getTime()) ? daysOfWeekTr[makeupDate.getDay()] : "",
        makeupTimeStr: draft.makeupTimeStr,
      };
      copy.push(updatedSession);
    } else {
      const current = copy[editingSessionIndex];
      if (!current) return;
      updatedSession = {
        ...current,
        dateStr: draft.dateStr,
        dayName: examDate && !isNaN(examDate.getTime()) ? daysOfWeekTr[examDate.getDay()] : current.dayName,
        timeStr: draft.timeStr,
        sessionIndex: draft.sessionIndex,
        makeupDateStr: draft.makeupDateStr,
        makeupDayName: makeupDate && !isNaN(makeupDate.getTime()) ? daysOfWeekTr[makeupDate.getDay()] : "",
        makeupTimeStr: draft.makeupTimeStr,
      };
      copy[editingSessionIndex] = updatedSession;
    }

    // Oturumun kimliğini koruyarak mevcut ders planını yeni tarih/saate taşı.
    const oldSession = !isNewSession ? computedDates[editingSessionIndex] : null;
    const oldKey = oldSession ? getSessionWorkflowKey(oldSession) : "";
    const updatedPlan = currentPlan ? {
      ...currentPlan,
      slots: (currentPlan.slots || []).map((slot: any) => {
        const matched = oldSession && (
          (slot.id && oldSession.id && String(slot.id) === String(oldSession.id)) ||
          (String(slot.dateStr || "") === String(oldSession.dateStr || "") && Number(slot.sessionIndex || 1) === Number(oldSession.sessionIndex || 1))
        );
        return matched ? { ...slot, ...updatedSession, exams: slot.exams || [] } : slot;
      }),
    } : null;
    if (updatedPlan) {
      setCurrentPlan(updatedPlan);
      const updatedPlans = savedPlans.some(p => p.id === updatedPlan.id)
        ? savedPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
        : [updatedPlan, ...savedPlans];
      setSavedPlans(updatedPlans);
      try { await planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan); }
      catch (error) { console.error("Oturum plan değişikliği kaydedilemedi:", error); }
    }
    if (oldKey && planningLocks[oldKey]) {
      const nextLocks = { ...planningLocks };
      delete nextLocks[oldKey];
      nextLocks[getSessionWorkflowKey(updatedSession)] = true;
      setPlanningLocks(nextLocks);
      void planningService.saveState(selectedTerm, selectedExamNo, { planningLocks: nextLocks }).catch(console.error);
    }
    setComputedDates(copy);
    closeSessionEditor();
    setSelectedWorkflowSlotKey(getSessionWorkflowKey(updatedSession));
    setIntegratedSeatingView(null);
    setActiveSubTab('C');
    setResultSubTab('table');
    try {
      await persistExamCalendarImmediately(copy);
      setCalendarSaveError(null);
    } catch (err) {
      console.error("Oturum değişiklikleri veritabanına kaydedilemedi:", err);
      setCalendarSaveError("Oturum ekranda güncellendi ancak yerel veritabanına kaydedilemedi. Lütfen bağlantıyı kontrol edip tekrar deneyin.");
    }
  };

  const handleManualSaveConfig = async () => {
    try {
      const suffix = getKeySuffix(selectedTerm, selectedExamNo);
      
      // Save config
      const configToSave = {
        computedDates,
        selectedTerm,
        selectedExamNo,
        startDate,
        daysCount,
        sessionsPerDay
      };
      await writeExamCalendarToSQLite(computedDates);
      
      // Save current plan
      if (currentPlan) {
        const planExists = savedPlans.some(p => p.id === currentPlan.id);
        let updatedPlans;
        if (planExists) {
          updatedPlans = savedPlans.map(p => p.id === currentPlan.id ? currentPlan : p);
        } else {
          updatedPlans = [currentPlan, ...savedPlans];
        }
        setSavedPlans(updatedPlans);
        await planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, currentPlan);
      }

      // Save course assoc configs
      await planningService.saveCourseSettings(selectedTerm, selectedExamNo, difficultCourses, excludedCourseNames);

      const finalPlans = currentPlan
        ? (savedPlans.some(p => p.id === currentPlan.id)
            ? savedPlans.map(p => p.id === currentPlan.id ? currentPlan : p)
            : [currentPlan, ...savedPlans])
        : savedPlans;

      await planningService.saveState(selectedTerm, selectedExamNo, {
        savedPlans: finalPlans,
        currentPlan,
        difficultCourses,
        excludedCourseNames,
      });

      alert("Tüm yapılandırma ve planlama bilgileri kalıcı olarak kaydedildi!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Kaydetme işlemi sırasında bir hata oluştu!");
    }
  };

  const handlePlanningLockChange = async (nextLocked: boolean) => {
    if (!selectedWorkflowSlotKey) {
      alert("Önce Ortak Sınav Planlama ekranından bir oturum seçiniz.");
      return;
    }
    const previousLocks = { ...planningLocks };
    const nextLocks = { ...planningLocks, [selectedWorkflowSlotKey]: nextLocked };
    if (!nextLocked) delete nextLocks[selectedWorkflowSlotKey];
    setPlanningLocks(nextLocks);
    try {
      await planningService.saveState(selectedTerm, selectedExamNo, {
        planningLocks: nextLocks,
        // Eski global kilit yeni oturumların çalışmasını engellemesin.
        planningLocked: false,
      });
    } catch (error) {
      console.error("Plan kilidi kaydedilemedi:", error);
      setPlanningLocks(previousLocks);
      alert("Plan kilidi kaydedilemedi.");
    }
  };

  const persistExamCalendarImmediately = async (nextDates: typeof computedDates) => {
    // TEK kaynak: data/edupanel.db -> kelebekExamCalendars koleksiyonu.
    // Başka app_state/localforage/mirror kaydı yapılmaz.
    await writeExamCalendarToSQLite(nextDates);
  };

  const addNewDay = () => {
    let lastDate = new Date();
    if (computedDates.length > 0) {
      const sortedDates = [...computedDates]
        .filter(item => item.dateStr)
        .sort((a, b) => String(a.dateStr || '').localeCompare(String(b.dateStr || '')));
      const last = sortedDates[sortedDates.length - 1];
      if (last?.dateStr) lastDate = new Date(`${last.dateStr}T00:00:00`);
    }
    lastDate.setDate(lastDate.getDate() + 1);
    while (lastDate.getDay() === 0 || lastDate.getDay() === 6) lastDate.setDate(lastDate.getDate() + 1);
    const year = lastDate.getFullYear();
    const month = String(lastDate.getMonth() + 1).padStart(2, "0");
    const day = String(lastDate.getDate()).padStart(2, "0");
    setEditingSessionIndex(-1);
    setSessionEditorDraft({
      dateStr: `${year}-${month}-${day}`,
      timeStr: getDefaultSessionTime(1),
      sessionIndex: 1,
      makeupDateStr: "",
      makeupTimeStr: "",
    });
  };

  const deleteDayAt = async (index: number) => {
    const removed = computedDates[index];
    if (!removed) return;
    const removedKey = getSessionWorkflowKey(removed);
    // Oturum yönetimi yerleşim planı ve plan kilidi durumundan bağımsızdır.
    // Silme onayı KelebekSetupPanels içerisinden alınır.
    const next = computedDates.filter((_, idx) => idx !== index);
    // Oturum kaldırılınca ona ait sınavları kaybetmeden atanmamış listesine geri al.
    // Böylece silinen oturum eski plan kayıtlarından tekrar oluşmaz.
    if (currentPlan) {
      const removedSlots = (currentPlan.slots || []).filter((slot: any) =>
        (slot.id && removed.id && String(slot.id) === String(removed.id)) ||
        (String(slot.dateStr || "") === String(removed.dateStr || "") && Number(slot.sessionIndex || 1) === Number(removed.sessionIndex || 1))
      );
      const remainingSlots = (currentPlan.slots || []).filter((slot: any) => !removedSlots.includes(slot));
      const unplaced = [...(currentPlan.unplacedExams || [])];
      const remainingIds = new Set(remainingSlots.flatMap((slot: any) => (slot.exams || []).map((exam: any) => String(exam.id))));
      const unplacedIds = new Set(unplaced.map((exam: any) => String(exam.id)));
      removedSlots.forEach((slot: any) => (slot.exams || []).forEach((exam: any) => {
        const id = String(exam.id || "");
        if (id && !remainingIds.has(id) && !unplacedIds.has(id)) {
          unplaced.push(exam);
          unplacedIds.add(id);
        }
      }));
      const updatedPlan = { ...currentPlan, slots: remainingSlots, unplacedExams: unplaced };
      const updatedPlans = savedPlans.some(p => p.id === currentPlan.id)
        ? savedPlans.map(p => p.id === currentPlan.id ? updatedPlan : p)
        : [updatedPlan, ...savedPlans];
      try {
        await planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan);
        setCurrentPlan(updatedPlan);
        setSavedPlans(updatedPlans);
        await planningService.saveSeating(selectedTerm, selectedExamNo, Number(removed.sessionIndex || 1), {});
      } catch (error) {
        console.error("Oturuma bağlı sınav planı silinemedi:", error);
        setCalendarSaveError("Oturumun bağlı planı kaydedilemedi. Silme işlemi iptal edildi.");
        return;
      }
    }
    try {
      await persistExamCalendarImmediately(next);
      setComputedDates(next);
      const nextLocks = { ...planningLocks };
      delete nextLocks[removedKey];
      setPlanningLocks(nextLocks);
      if (selectedWorkflowSlotKey === removedKey) {
        setSelectedWorkflowSlotKey(null);
        setIntegratedSeatingView(null);
        setActiveSubTab('B');
      }
      await planningService.saveState(selectedTerm, selectedExamNo, { planningLocks: nextLocks, planningLocked: false });
      setCalendarSaveError(null);
    } catch (error) {
      console.error("Silinen oturum veritabanından kaldırılamadı:", error);
      setCalendarSaveError("Oturum takvimden kaldırılamadı. Lütfen bağlantıyı kontrol edip tekrar deneyin.");
    }
  };

  const selectSessionForWorkflow = (session: any) => {
    const planSlot = findPlanSlotForCalendarSession(session);
    const selectedSlot = planSlot || session;
    setSelectedWorkflowSlotKey(getSessionWorkflowKey(selectedSlot));

    if (planSlot && Array.isArray(planSlot.exams) && planSlot.exams.length > 0) {
      // Hazırlanmış oturum: doğrudan soru yükleme ve sonraki salon/yerleşim akışı.
      setActiveSubTab('B');
      setIntegratedSeatingView('sorular');
      return;
    }

    // Henüz ders/sınıf planı olmayan oturum önce Sınav Planla ekranına gider.
    setIntegratedSeatingView(null);
    setActiveSubTab('C');
    setResultSubTab('table');
  };

  const openIntegratedViewForSelectedSession = (view: 'sorular' | 'yerlesim' | 'bilgiler' | 'planlar') => {
    if (!selectedWorkflowSlotKey) {
      setIntegratedSeatingView(null);
      setActiveSubTab('B');
      alert("Önce Ortak Sınav Planlama ekranından bir sınav oturumu seçiniz.");
      return;
    }
    setIntegratedSeatingView(view);
  };

  const checkIsPassed = (dateStr: string) => {
    if (!dateStr || dateStr === "Tarih Seçilmedi") return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    return d.getTime() < today.getTime();
  };

  const groupedByDate = useMemo(() => {
    const groups: { [dateStr: string]: { dInfo: typeof computedDates[0]; index: number }[] } = {};
    computedDates.forEach((dInfo, index) => {
      const dStr = dInfo.dateStr || "Tarih Seçilmedi";
      if (!groups[dStr]) {
        groups[dStr] = [];
      }
      groups[dStr].push({ dInfo, index });
    });
    return groups;
  }, [computedDates]);

  const sortedUniqueDates = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => {
      if (a === "Tarih Seçilmedi") return 1;
      if (b === "Tarih Seçilmedi") return -1;
      return a.localeCompare(b);
    });
  }, [groupedByDate]);

  // Each exam date owns a stable visual theme. Sessions on the same date share the same color.
  const examDayColorThemes = [
    { card: 'bg-violet-50 border-violet-200 hover:border-violet-400', badge: 'bg-violet-600 text-white border-violet-600', text: 'text-violet-950', subtext: 'text-violet-700' },
    { card: 'bg-sky-50 border-sky-200 hover:border-sky-400', badge: 'bg-sky-600 text-white border-sky-600', text: 'text-sky-950', subtext: 'text-sky-700' },
    { card: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400', badge: 'bg-emerald-600 text-white border-emerald-600', text: 'text-emerald-950', subtext: 'text-emerald-700' },
    { card: 'bg-amber-50 border-amber-200 hover:border-amber-400', badge: 'bg-amber-500 text-white border-amber-500', text: 'text-amber-950', subtext: 'text-amber-800' },
    { card: 'bg-rose-50 border-rose-200 hover:border-rose-400', badge: 'bg-rose-600 text-white border-rose-600', text: 'text-rose-950', subtext: 'text-rose-700' },
    { card: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400', badge: 'bg-cyan-600 text-white border-cyan-600', text: 'text-cyan-950', subtext: 'text-cyan-700' },
    { card: 'bg-fuchsia-50 border-fuchsia-200 hover:border-fuchsia-400', badge: 'bg-fuchsia-600 text-white border-fuchsia-600', text: 'text-fuchsia-950', subtext: 'text-fuchsia-700' },
    { card: 'bg-lime-50 border-lime-200 hover:border-lime-400', badge: 'bg-lime-600 text-white border-lime-600', text: 'text-lime-950', subtext: 'text-lime-800' },
  ] as const;

  const getFilteredStudentsForIndex = (index: number) => {
    const query = (absentSearchText[index] || "").trim().toLowerCase();
    if (!query) return [];
    const alreadyAddedIds = new Set((computedDates[index]?.absentStudents || []).map((s: any) => s.id));
    return students.filter(s => {
      if (alreadyAddedIds.has(s.id)) return false;
      const nameMatch = (s.name || "").toLowerCase().includes(query);
      const numMatch = String(s.id || "").toLowerCase().includes(query);
      const classMatch = (s.classroom || "").toLowerCase().includes(query);
      return nameMatch || numMatch || classMatch;
    }).slice(0, 5);
  };

  const openAbsentModal = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    setAbsentStudentSearchQuery("");
    setSelectedStudentForAbsent(null);
    if (currentPlan) {
      const slot = currentPlan.slots[dayIndex];
      if (slot && slot.exams && slot.exams.length > 0) {
        setSelectedMissedExam(slot.exams[0].courseName);
      } else {
        setSelectedMissedExam("Ortak Sınav");
      }
    }
    setIsAbsentModalOpen(true);
  };

  const searchedStudentsForAbsent = useMemo(() => {
    const q = absentStudentSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const alreadyAddedIds = new Set<string>();
    if (selectedDayIndex !== null && computedDates[selectedDayIndex]) {
      const absents = computedDates[selectedDayIndex].absentStudents || [];
      absents.forEach((s: any) => alreadyAddedIds.add(s.id));
    }
    return students.filter(s => {
      if (alreadyAddedIds.has(s.id)) return false;
      const fullName = `${s.name || ""} ${s.surname || ""}`.toLowerCase();
      const num = String(s.studentNumber || s.id || "").toLowerCase();
      return fullName.includes(q) || num.includes(q);
    });
  }, [students, absentStudentSearchQuery, selectedDayIndex, computedDates]);

  const slotExams = useMemo(() => {
    if (selectedDayIndex === null || !currentPlan) return [];
    const slot = currentPlan.slots[selectedDayIndex];
    return slot ? (slot.exams || []) : [];
  }, [selectedDayIndex, currentPlan]);

  // Keep computedDates sorted by date and session index chronologically
  useEffect(() => {
    if (!isInitialLoadDone) return;
    if (isLoadingConfig) return;
    if (computedDates.length === 0) return;
    
    // Check if it is already sorted to avoid infinite loops
    let isSorted = true;
    for (let i = 0; i < computedDates.length - 1; i++) {
      const a = computedDates[i];
      const b = computedDates[i + 1];
      
      const dateCompare = (a.dateStr || "").localeCompare(b.dateStr || "");
      if (dateCompare > 0) {
        isSorted = false;
        break;
      } else if (dateCompare === 0) {
        const aSession = a.sessionIndex || 1;
        const bSession = b.sessionIndex || 1;
        if (aSession > bSession) {
          isSorted = false;
          break;
        }
      }
    }
    
    if (!isSorted) {
      setComputedDates(prev => {
        return [...prev].sort((a, b) => {
          const dateCompare = (a.dateStr || "").localeCompare(b.dateStr || "");
          if (dateCompare !== 0) return dateCompare;
          const aSession = a.sessionIndex || 1;
          const bSession = b.sessionIndex || 1;
          return aSession - bSession;
        });
      });
    }
  }, [computedDates, isInitialLoadDone, isLoadingConfig]);

  // Auto-save B-module config state instantly to localforage on any changes
  useEffect(() => {
    if (!isInitialLoadDone) return;
    if (isLoadingConfig) return;
    if (!loadedTermExamRef.current || loadedTermExamRef.current.term !== selectedTerm || loadedTermExamRef.current.examNo !== selectedExamNo) {
      return;
    }
    persistExamCalendarImmediately(computedDates).catch(err => {
      console.error("Sınav takvimi SQLite otomatik kayıt hatası:", err);
      setCalendarSaveError("Sınav takvimi yerel veritabanına kaydedilemedi. Veri ekranda korunuyor.");
    });
  }, [isInitialLoadDone, isLoadingConfig, computedDates, selectedTerm, selectedExamNo, startDate, daysCount, sessionsPerDay]);

  // Build the planning model from the exam calendar as the single source of truth.
  // Same-date sessions remain separate slots, while the day list contains each date only once.
  const buildPlanCalendar = (dates: typeof computedDates, previousSlots: ScheduleSlot[] = []) => {
    const sortedDates = [...dates].sort((a, b) => {
      const dateCompare = String(a.dateStr || "").localeCompare(String(b.dateStr || ""));
      if (dateCompare !== 0) return dateCompare;
      return Number(a.sessionIndex || 1) - Number(b.sessionIndex || 1);
    });

    const slots: ScheduleSlot[] = sortedDates.map((dInfo, dIdx) => {
      let existingSlot = previousSlots.find(s => s.id === dInfo.id);
      if (!existingSlot) {
        existingSlot = previousSlots.find(
          s => s.dateStr === dInfo.dateStr && Number(s.sessionIndex || 1) === Number(dInfo.sessionIndex || 1)
        );
      }

      const sessionIndex = Number(dInfo.sessionIndex || 1);
      const timeStr = dInfo.timeStr || getDefaultSessionTime(sessionIndex);

      return {
        id: dInfo.id || `calendar_slot_${dInfo.dateStr}_${sessionIndex}`,
        dayIndex: dIdx,
        sessionIndex,
        exams: existingSlot?.exams || [],
        dateStr: dInfo.dateStr,
        dayName: dInfo.dayName,
        sessionLabel: `${sessionIndex}. Oturum`,
        timeStr,
        makeupDateStr: dInfo.makeupDateStr,
        makeupDayName: dInfo.makeupDayName,
        makeupTimeStr: dInfo.makeupTimeStr
      };
    });

    const uniqueDays = Array.from(
      new Map(
        sortedDates.map(d => [d.dateStr, { dateStr: d.dateStr, dayName: d.dayName }])
      ).values()
    );

    return {
      slots,
      days: uniqueDays.map(d => `${d.dateStr}|${d.dayName || ""}`)
    };
  };

  // Auto-sync B-module dates & slot configurations directly to currentPlan
  useEffect(() => {
    if (!isInitialLoadDone) return;
    if (isLoadingConfig) return;
    if (!loadedTermExamRef.current || loadedTermExamRef.current.term !== selectedTerm || loadedTermExamRef.current.examNo !== selectedExamNo) {
      return;
    }
    if (computedDates.length === 0) return;

    setCurrentPlan(prevPlan => {
      const planId = prevPlan?.id || "plan_" + Date.now().toString();
      const term = selectedTerm;
      const examNo = selectedExamNo;
      
      const { slots, days } = buildPlanCalendar(computedDates, prevPlan?.slots || []);

      // Ders-sınıf atamaları sonradan değiştiğinde daha önce kaydedilmiş planın
      // eski classrooms listesini taşımaya devam etmesini engelle. Plan içindeki
      // sınavın gün/saat yerleşimini koru, fakat dersin güncel tanımını
      // (özellikle tüm şube/grup listesini) activeExams kaynağından yenile.
      const activeExamById = new Map<string, JointExam>(
        activeExams.map(exam => [exam.id, exam] as [string, JointExam])
      );
      const syncExamDefinition = (exam: JointExam): JointExam => {
        const latest = activeExamById.get(exam.id);
        if (!latest) return exam;
        return {
          ...exam,
          ...latest,
          classrooms: [...(latest.classrooms || [])],
        };
      };

      const syncedSlots = slots.map(slot => ({
        ...slot,
        exams: (slot.exams || []).map(syncExamDefinition),
      }));

      let unplacedExams = (prevPlan?.unplacedExams || []).map(syncExamDefinition);
      if (unplacedExams.length === 0 && (!prevPlan || prevPlan.slots?.every(s => !s.exams || s.exams.length === 0))) {
        unplacedExams = [...activeExams];
      } else {
        const scheduledExamIds = new Set(syncedSlots.flatMap(s => s.exams?.map(e => e.id) || []));
        const activeUnscheduled = activeExams.filter(e => !scheduledExamIds.has(e.id));
        const currentUnplacedIds = new Set(unplacedExams.map(e => e.id));
        
        activeUnscheduled.forEach(e => {
          if (!currentUnplacedIds.has(e.id)) {
            unplacedExams.push(e);
          }
        });
        const activeExamsIds = new Set(activeExams.map(e => e.id));
        unplacedExams = unplacedExams.filter(e => activeExamsIds.has(e.id));
      }

      const updatedPlan = {
        id: planId,
        term,
        examNo,
        slots: syncedSlots,
        days,
        unplacedExams,
        startDate,
        daysCount,
        sessionsPerDay
      };

      // Update savedPlans and save to localforage inside a non-blocking timeout
      setTimeout(() => {
        setSavedPlans(prevPlans => {
          const exists = prevPlans.some(p => p.id === planId);
          let updatedPlans;
          if (exists) {
            updatedPlans = prevPlans.map(p => p.id === planId ? updatedPlan : p);
          } else {
            updatedPlans = [updatedPlan, ...prevPlans];
          }
          const suffix = getKeySuffix(selectedTerm, selectedExamNo);
          planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan).catch(err => console.error(err));
          return updatedPlans;
        });
      }, 0);

      return updatedPlan;
    });
  }, [isInitialLoadDone, computedDates, selectedTerm, selectedExamNo, startDate, daysCount, sessionsPerDay, activeExams]);

  // Sınav planlaması tamamlandığında PDF üretimini yalnızca bir kez tetikler.
  const autoPdfPlanIdRef = useRef<string | null>(null);

  // RUN SCHEDULING ALGORITHM (Now uses user-selected active weekday dates and slots!)
  const generatePlan = () => {
    const { slots, days } = buildPlanCalendar(computedDates);

    if (slots.length === 0) {
      alert("Lütfen en az bir adet sınav günü ve saati ekleyiniz!");
      return;
    }

    const unplacedExams: JointExam[] = [...activeExams];

    // Save the plan to state
    const newPlan = {
      id: "plan_" + Date.now().toString(),
      term: selectedTerm,
      examNo: selectedExamNo,
      slots: slots,
      days,
      unplacedExams: unplacedExams,
      startDate: startDate,
      daysCount: daysCount,
      sessionsPerDay: sessionsPerDay
    };

    autoPdfPlanIdRef.current = newPlan.id;
    setCurrentPlan(newPlan);
    
    // Auto-save plan to localforage
    const updatedPlans = [newPlan, ...savedPlans.filter(p => p.id !== newPlan.id)];
    setSavedPlans(updatedPlans);
    planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, newPlan).catch(err => console.error(err));

    setActiveSubTab('C');
    setResultSubTab('table');
    if (allClassrooms.length > 0) {
      setSelectedClassroomFilter(allClassrooms[0]);
    }
  };

  // Drag-and-drop state
  const [draggedExamId, setDraggedExamId] = useState<string | null>(null);
  const [draggedSource, setDraggedSource] = useState<{
    type: "slot" | "unplaced";
    dateStr?: string;
    sessionIndex?: number;
  } | null>(null);

  // Check if an exam can be placed in a slot (classroom conflict checker)
  const isCompatibleWithSlot = (examId: string, destSlot: ScheduleSlot, source: any) => {
    if (!currentPlan) return false;

    // Find exam
    let examObj: JointExam | null = null;
    if (source.type === "unplaced") {
      examObj = currentPlan.unplacedExams?.find(e => e.id === examId) || null;
    } else {
      const sSlot = currentPlan.slots.find(s => s.dateStr === source.dateStr && s.sessionIndex === source.sessionIndex);
      examObj = sSlot?.exams.find(e => e.id === examId) || null;
    }

    if (!examObj) return false;

    // If source slot is same as dest slot, it is compatible
    if (source.type === "slot" && source.dateStr === destSlot.dateStr && source.sessionIndex === destSlot.sessionIndex) {
      return true;
    }

    const hasOverlap = destSlot.exams.some(eSlot => doExamsConflict(examObj, eSlot));
    return !hasOverlap;
  };

  const handleExamDrop = (
    examId: string,
    source: { type: "slot" | "unplaced"; dateStr?: string; sessionIndex?: number },
    destDateStr: string,
    destSessionIndex: number
  ) => {
    if (!currentPlan) return;

    let examObj: JointExam | null = null;
    const updatedPlan = JSON.parse(JSON.stringify(currentPlan));

    if (source.type === "unplaced") {
      const idx = updatedPlan.unplacedExams?.findIndex((e: any) => e.id === examId) ?? -1;
      if (idx !== -1) {
        examObj = updatedPlan.unplacedExams[idx];
      }
    } else {
      const sSlot = updatedPlan.slots.find((s: any) => s.dateStr === source.dateStr && s.sessionIndex === source.sessionIndex);
      if (sSlot) {
        const idx = sSlot.exams.findIndex((e: any) => e.id === examId);
        if (idx !== -1) {
          examObj = sSlot.exams[idx];
        }
      }
    }

    if (!examObj) return;

    // Validate destination compatibility
    const destSlot = updatedPlan.slots.find((s: any) => s.dateStr === destDateStr && s.sessionIndex === destSessionIndex);
    if (!destSlot) return;

    const otherExams = destSlot.exams.filter((e: any) => e.id !== examId);
    const conflictingExams = otherExams.filter((eSlot: any) => doExamsConflict(examObj, eSlot));

    if (conflictingExams.length > 0) {
      const conflictDescriptions: string[] = [];
      conflictingExams.forEach((eSlot: any) => {
        examObj.classrooms.forEach((cls: string) => {
          eSlot.classrooms.forEach((cSlot: string) => {
            if (doClassroomsConflict(cls, cSlot)) {
              conflictDescriptions.push(`• ${cls} şubesi bu oturumda zaten "${eSlot.courseName}" sınavına atanmış.`);
            } else if (examObj.isCompulsory || eSlot.isCompulsory) {
              const base1 = getBaseClassroom(cls);
              const base2 = getBaseClassroom(cSlot);
              if (base1 && base2 && base1 === base2) {
                if (examObj.isCompulsory) {
                  conflictDescriptions.push(`• "${examObj.courseName}" (Zorunlu Ders) sınavı olduğu için, aynı sınıfa (${base1}) bağlı diğer şubelerin sınavları ("${eSlot.courseName}") ile çakışmaktadır.`);
                } else {
                  conflictDescriptions.push(`• Bu oturumda "${eSlot.courseName}" (Zorunlu Ders) sınavı olduğu için, o sınıfın diğer şubesi/grubu olan "${cls}" için başka bir sınav planlanamaz.`);
                }
              }
            }
          });
        });
      });

      const uniqueDescriptions = Array.from(new Set(conflictDescriptions));

      alert(`Sınav Çakışması!\n\n${uniqueDescriptions.join("\n")}`);
      return;
    }

    // Success! Remove from source
    if (source.type === "unplaced") {
      updatedPlan.unplacedExams = (updatedPlan.unplacedExams || []).filter((e: any) => e.id !== examId);
    } else {
      const sSlot = updatedPlan.slots.find((s: any) => s.dateStr === source.dateStr && s.sessionIndex === source.sessionIndex);
      if (sSlot) {
        sSlot.exams = sSlot.exams.filter((e: any) => e.id !== examId);
      }
    }

    // Add to destination
    destSlot.exams.push(examObj);

    setCurrentPlan(updatedPlan);
    const updatedPlans = savedPlans.map(p => p.id === currentPlan.id ? updatedPlan : p);
    setSavedPlans(updatedPlans);
    planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan).catch(err => console.error(err));

    // Reset drag states
    setDraggedExamId(null);
    setDraggedSource(null);
  };

  const moveExamToUnplaced = (examId: string, sourceDateStr: string, sourceSessionIndex: number) => {
    if (!currentPlan) return;
    setConfirmDialog({
      isOpen: true,
      message: "Bu dersin sınav atamasını iptal etmeyi onaylıyor musunuz?",
      onConfirm: () => {
        const updatedPlan = JSON.parse(JSON.stringify(currentPlan));
        const sSlot = updatedPlan.slots.find((s: any) => s.dateStr === sourceDateStr && s.sessionIndex === sourceSessionIndex);
        if (sSlot) {
          const examObj = sSlot.exams.find((e: any) => e.id === examId);
          if (examObj) {
            sSlot.exams = sSlot.exams.filter((e: any) => e.id !== examId);
            if (!updatedPlan.unplacedExams) updatedPlan.unplacedExams = [];
            updatedPlan.unplacedExams.push(examObj);
            
            setCurrentPlan(updatedPlan);
            const updatedPlans = savedPlans.some(p => p.id === currentPlan.id)
              ? savedPlans.map(p => p.id === currentPlan.id ? updatedPlan : p)
              : [updatedPlan, ...savedPlans];
            setSavedPlans(updatedPlans);
            planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan).catch(err => console.error(err));
          }
        }
      }
    });
  };

  // Delete saved plan
  const autoScheduleRemainingExams = () => {
    if (!currentPlan) return;
    const updatedPlan = JSON.parse(JSON.stringify(currentPlan));
    
    let remaining = [...(updatedPlan.unplacedExams || [])];
    
    for (let i = 0; i < remaining.length; i++) {
      const examObj = remaining[i];
      let placed = false;
      
      for (const slot of updatedPlan.slots) {
        const hasOverlap = slot.exams.some((eSlot: any) => doExamsConflict(examObj, eSlot));
        if (!hasOverlap) {
          slot.exams.push(examObj);
          placed = true;
          break;
        }
      }
      
      if (placed) {
        remaining[i] = null;
      }
    }
    
    updatedPlan.unplacedExams = remaining.filter((x: any) => x !== null);
    
    setCurrentPlan(updatedPlan);
    const updatedPlans = savedPlans.map(p => p.id === currentPlan.id ? updatedPlan : p);
    setSavedPlans(updatedPlans);
    planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan).catch(err => console.error(err));
  };

  const cancelSessionPlanning = async (slotIndex: number) => {
    if (!currentPlan) return;

    const updatedPlan = JSON.parse(JSON.stringify(currentPlan));
    const targetSlot = updatedPlan.slots?.[slotIndex];
    if (!targetSlot) return;

    const examsToReturn: JointExam[] = Array.isArray(targetSlot.exams) ? [...targetSlot.exams] : [];
    targetSlot.exams = [];

    if (!Array.isArray(updatedPlan.unplacedExams)) updatedPlan.unplacedExams = [];
    const existingIds = new Set(updatedPlan.unplacedExams.map((exam: any) => String(exam?.id || '')));
    examsToReturn.forEach((exam: JointExam) => {
      const examId = String(exam?.id || '');
      if (!examId || existingIds.has(examId)) return;
      updatedPlan.unplacedExams.push(exam);
      existingIds.add(examId);
    });

    const updatedPlans = savedPlans.some((plan) => plan.id === currentPlan.id)
      ? savedPlans.map((plan) => plan.id === currentPlan.id ? updatedPlan : plan)
      : [updatedPlan, ...savedPlans];

    await planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan);
    setCurrentPlan(updatedPlan);
    setSavedPlans(updatedPlans);

    // Bu oturumun sınav içeriği değiştiği için salon/yerleşim planı artık geçerli değildir.
    // Aynı oturuma ait A-modülü planını temizleyerek yeniden planlama zorunlu hale getirilir.
    const sessionIndex = Number(targetSlot.sessionIndex || slotIndex + 1);
    await planningService.saveSeating(selectedTerm, selectedExamNo, sessionIndex, {});
  };

  const handleDeletePlan = (id: string) => {
    const updated = savedPlans.filter(p => p.id !== id);
    setSavedPlans(updated);
    planningService.savePlans(selectedTerm, selectedExamNo, updated, currentPlan).catch(err => console.error(err));
    if (currentPlan && currentPlan.id === id) {
      setCurrentPlan(null);
      setActiveSubTab('C');
    }
  };

  const handleClearPlan = (id: string) => {
    const planToClear = savedPlans.find(p => p.id === id);
    if (!planToClear) return;

    // Deep copy
    const updatedPlan = JSON.parse(JSON.stringify(planToClear));
    
    // Collect all exams from slots and unplaced list
    const allExams: JointExam[] = [];
    if (updatedPlan.slots) {
      updatedPlan.slots.forEach((slot: any) => {
        if (slot.exams) {
          allExams.push(...slot.exams);
          slot.exams = []; // Clear the slot
        }
      });
    }

    if (updatedPlan.unplacedExams) {
      allExams.push(...updatedPlan.unplacedExams);
    }

    // De-duplicate exams just in case, using id or courseName
    const seenIds = new Set<string>();
    const uniqueExams: JointExam[] = [];
    allExams.forEach(exam => {
      if (exam && exam.id && !seenIds.has(exam.id)) {
        seenIds.add(exam.id);
        uniqueExams.push(exam);
      }
    });

    updatedPlan.unplacedExams = uniqueExams;

    // Update state
    if (currentPlan && currentPlan.id === id) {
      setCurrentPlan(updatedPlan);
    }

    const updatedPlans = savedPlans.map(p => p.id === id ? updatedPlan : p);
    setSavedPlans(updatedPlans);
    planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, updatedPlan).catch(err => console.error(err));
  };

  // Filter courses that have class-level relations (either compulsory, or assigned to multiple classrooms)
  const associatedJointExams = useMemo(() => {
    return jointExams.filter(joint => joint.isCompulsory || joint.classrooms.length > 1);
  }, [jointExams]);

  // Filter associated joint exams with search term and grade level filter
  const filteredAssociatedJointExams = useMemo(() => {
    const cleanLvl = (lvl: string) => (lvl || "").replace(/\s+/g, '').replace('.', '').toLowerCase();
    const filterClean = cleanLvl(selectedGradeFilter);

    return associatedJointExams.filter(joint => {
      const nameMatch = joint.courseName.toLowerCase().includes(searchTerm.toLowerCase());
      const classMatch = joint.classrooms.some(cls => cls.toLowerCase().includes(searchTerm.toLowerCase()));
      const gradeMatch = joint.gradeLevel.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isGradeMatch = selectedGradeFilter === "Tüm Sınıflar" || cleanLvl(joint.gradeLevel) === filterClean;

      return (nameMatch || classMatch || gradeMatch) && isGradeMatch;
    });
  }, [associatedJointExams, searchTerm, selectedGradeFilter]);

  // Helper: Print handling
  const triggerPrint = () => {
    window.focus();
    window.print();
  };

  const exportAbsentStudentsPdf = async () => {
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
          if (!targetExam && slotExams.length > 0) targetExam = slotExams[0];
          if (targetExam) {
            const teacherName = getTeacherForStudent(student.classroom, targetExam.courseName, courses);
            finalMissedExam = `${targetExam.courseName} (${teacherName})`;
          }
        }
        return {
          ...student,
          missedExam: finalMissedExam || "Ortak Sınav",
          dateStr: d.dateStr,
          dayName: d.dayName,
          sessionLabel: d.sessionIndex ? `${d.sessionIndex}. Oturum` : "Oturum Belirtilmedi",
        };
      });
    });

    if (allAbsentsWithMeta.length === 0) return;
    await PdfEngine.generate(
      createAbsentStudentsDefinition(allAbsentsWithMeta, getSchoolName()),
      { filename: "sinava_girmeyenler_raporu.pdf" },
    );
  };

  const getSchoolName = () => {
    try {
      const saved = sqliteStorage.getItem("school_info");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed.name;
      }
      const savedA = sqliteStorage.getItem("school_info_a_profile");
      if (savedA) {
        const parsedA = JSON.parse(savedA);
        if (parsedA && parsedA.instLine3) return parsedA.instLine3;
      }
    } catch (e) {
      console.error(e);
    }
    return "ORDU LİSESİ";
  };

  const getAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  const exportExamPlanPdf = async (planOverride?: any) => {
    const plan = planOverride || currentPlan;
    if (!plan || !Array.isArray(plan.slots) || plan.slots.length === 0) {
      alert("PDF oluşturmak için tamamlanmış bir sınav planı bulunamadı.");
      return;
    }

    const schoolName = getSchoolName();
    const acadYear = getAcademicYear();
    const normalizeTerm = (value: string) => {
      const raw = String(value || "").trim();
      if (!raw) return "1. Dönem";
      return /dönem/i.test(raw) ? raw : `${raw}. Dönem`;
    };
    const normalizeWrittenNo = (value: string) => {
      const raw = String(value || "").trim();
      if (!raw) return "1. Yazılı";
      const numberMatch = raw.match(/\d+/);
      if (numberMatch) return `${numberMatch[0]}. Yazılı`;
      return /yazılı/i.test(raw) ? raw : `${raw} Yazılı`;
    };
    const titleText = `${acadYear} Eğitim Öğretim Yılı ${schoolName} ${normalizeTerm(plan.term || selectedTerm)} ${normalizeWrittenNo(plan.examNo || selectedExamNo)} Planlaması`;

    const formatClassAndGroup = (rawLabel: string) => {
      const raw = String(rawLabel || "").trim();
      const groupMatch = raw.match(/\(([^)]+)\)\s*$/);
      const group = groupMatch ? String(groupMatch[1] || "").trim() : "";
      const classPart = groupMatch ? raw.slice(0, groupMatch.index).trim() : raw;
      const classMatch = classPart.match(/^(\d+)\s*[-.\s]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)$/);
      const baseClass = classMatch
        ? `${classMatch[1]}.${classMatch[2].toLocaleUpperCase("tr-TR")}`
        : classPart.replace(/\s+/g, "").replace(/-/g, ".");
      return { baseClass, group: group.replace(/\s+/g, " ").trim() };
    };

    const buildExamEntries = (examsList: any[]) => {
      if (!examsList || examsList.length === 0) return [];
      const parsedByExam = examsList.map((exam: any) => ({
        exam,
        parsedClasses: (exam.classrooms || []).map((label: string) => formatClassAndGroup(label)),
      }));
      return parsedByExam.map(({ exam, parsedClasses }: any) => ({
        courseName: exam.courseName || "Sınav",
        classes: parsedClasses.map((item: any) => ({
          baseClass: item.baseClass,
          group: item.group ? item.group.toLocaleLowerCase("tr-TR") : "",
        })),
      }));
    };

    const formatSessionTime = (slot: any) => {
      const direct = String(slot?.timeStr || "").trim();
      if (direct) return direct;
      const label = String(slot?.sessionLabel || "");
      const match = label.match(/\((.*?)\)/);
      return match ? String(match[1] || "").trim() : "";
    };
    const formatTurkishDate = (dateString: string) => {
      if (!dateString) return "";
      const parts = String(dateString).split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
    };

    const groupedSlots: { dateStr: string; dayName: string; slots: any[] }[] = [];
    [...plan.slots]
      .sort((a: any, b: any) => String(a.dateStr || "").localeCompare(String(b.dateStr || "")) || Number(a.sessionIndex || 0) - Number(b.sessionIndex || 0))
      .forEach((slot: any) => {
        const last = groupedSlots[groupedSlots.length - 1];
        if (last && last.dateStr === slot.dateStr) last.slots.push(slot);
        else groupedSlots.push({ dateStr: slot.dateStr, dayName: slot.dayName || "", slots: [slot] });
      });

    const rows: any[] = [];
    groupedSlots.forEach((group) => {
      group.slots.forEach((slot: any, index: number) => {
        const getExamsForGrade = (gradeKey: string) =>
          (slot.exams || []).filter((exam: any) => exam.gradeLevel && String(exam.gradeLevel).includes(gradeKey));
        rows.push({
          dateText: index === 0 ? `${formatTurkishDate(group.dateStr)}\n${group.dayName}` : undefined,
          dateRowSpan: index === 0 ? group.slots.length : undefined,
          sessionText: `${slot.sessionIndex || index + 1}. Oturum`,
          sessionTime: formatSessionTime(slot),
          makeupDateStr: slot.makeupDateStr || "",
          makeupTimeStr: slot.makeupTimeStr || "",
          makeupSessionText: `${slot.sessionIndex || index + 1}. Oturum`,
          grades: ["9", "10", "11", "12"].map((grade) => buildExamEntries(getExamsForGrade(grade))),
        });
      });
    });

    const filename = `${schoolName.replace(/\s+/g, "_")}_${acadYear}_${normalizeTerm(plan.term || selectedTerm).replace(/\s+/g, "_")}_${normalizeWrittenNo(plan.examNo || selectedExamNo).replace(/\s+/g, "_")}_Sinav_Plani.pdf`;
    await PdfEngine.generate(
      createExamPlanDefinition({ schoolName, title: titleText, rows }),
      { filename },
    );
  };

  // Sınavların tamamı yerleştirildiğinde yatay A4 PDF otomatik üretilir.
  useEffect(() => {
    if (!currentPlan || autoPdfPlanIdRef.current !== currentPlan.id) return;
    const scheduledCount = (currentPlan.slots || []).reduce(
      (sum: number, slot: any) => sum + (slot.exams?.length || 0),
      0,
    );
    const remainingCount = currentPlan.unplacedExams?.length || 0;
    if (scheduledCount > 0 && remainingCount === 0) {
      const completedPlan = currentPlan;
      autoPdfPlanIdRef.current = null;
      window.setTimeout(() => exportExamPlanPdf(completedPlan), 250);
    }
  }, [currentPlan]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1450px] flex-col space-y-6 overflow-y-auto px-4 pb-12 pt-0 md:px-8 md:pt-0">
      
      {/* Dynamic Header Block with School Name, Year, Term Select, Written Select & "Planı" */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 p-5 rounded-3xl border border-slate-200/60 shadow-xs print:hidden shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-800 font-extrabold text-base md:text-lg">
          <span className="text-indigo-600 font-black tracking-tight">{getSchoolName()}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-semibold">{getAcademicYear()} Eğitim Öğretim Yılı</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-white/80 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-100 shadow-xs">
          {isLoadingConfig && (
            <div className="flex items-center gap-1.5 px-2 text-[10px] font-black text-violet-600 uppercase tracking-wider animate-pulse border-r border-slate-100 mr-1">
              <div className="w-2 h-2 rounded-full bg-violet-600 animate-ping" />
              <span>Yükleniyor</span>
            </div>
          )}
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider pl-2 pr-1">Dönem:</span>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="1. Dönem">1. Dönem</option>
            <option value="2. Dönem">2. Dönem</option>
          </select>

          <span className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">Yazılı:</span>
          <select
            value={selectedExamNo}
            onChange={(e) => setSelectedExamNo(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="1. Yazılı">1. Yazılı</option>
            <option value="2. Yazılı">2. Yazılı</option>
            <option value="3. Yazılı">3. Yazılı</option>
          </select>
          <span className="text-xs font-black text-slate-800 pr-2 pl-1">Planı</span>
        </div>
      </div>

      {/* Sınav Hazırla Style Navigation Buttons */}
      <div className="bg-white border-2 border-dashed border-violet-600 rounded-3xl p-4 shrink-0 print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="bg-violet-600 bg-theme-pattern p-1.5 rounded-2xl flex flex-row flex-wrap items-center justify-start gap-1 w-fit shadow-inner min-h-[56px]">
          <button
            id="btn_subtab_b"
            onClick={() => { setIntegratedSeatingView(null); setActiveSubTab('B'); }}
            className={`flex items-center justify-center gap-1.5 px-5 min-w-[150px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === null && activeSubTab === 'B'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Ortak Sınav Planlama
          </button>
          <button
            id="btn_subtab_c"
            onClick={() => { if (!selectedWorkflowSlotKey) { setIntegratedSeatingView(null); setActiveSubTab('B'); alert('Önce Ortak Sınav Planlama ekranından bir sınav oturumu seçiniz.'); return; } setIntegratedSeatingView(null); setActiveSubTab('C'); }}
            className={`flex items-center justify-center gap-1.5 px-5 min-w-[150px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === null && activeSubTab === 'C'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Sınav Planla
          </button>
          <button
            type="button"
            onClick={() => openIntegratedViewForSelectedSession('sorular')}
            className={`flex items-center justify-center gap-1.5 px-4 min-w-[145px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === 'sorular'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Soruları Yükle
          </button>
          <button
            type="button"
            onClick={() => openIntegratedViewForSelectedSession('yerlesim')}
            className={`flex items-center justify-center gap-1.5 px-4 min-w-[145px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === 'yerlesim'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Sınav Salonları
          </button>
          <button
            type="button"
            onClick={() => openIntegratedViewForSelectedSession('bilgiler')}
            className={`flex items-center justify-center gap-1.5 px-4 min-w-[155px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === 'bilgiler'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Yerleşim Bilgileri
          </button>
          <button
            type="button"
            onClick={() => openIntegratedViewForSelectedSession('planlar')}
            className={`flex items-center justify-center gap-1.5 px-4 min-w-[120px] rounded-xl text-[13px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[44px] ${
              integratedSeatingView === 'planlar'
                ? "bg-white text-violet-700 shadow-sm border-white"
                : "text-white hover:bg-violet-700/80 border-white/60 hover:border-white"
            }`}
          >
            Planlar
          </button>
        </div>

        {integratedSeatingView && (
          <div
            id="integrated-seating-session-toolbar"
            className="ml-auto flex min-h-[56px] items-center justify-end shrink-0"
          />
        )}

        {integratedSeatingView === null && activeSubTab === 'B' && (
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={addNewDay}
              className="px-5 py-2.5 rounded-xl text-white text-[14.67px] font-black flex items-center gap-1.5 shadow-sm transition-all shrink-0 bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Oturum Ekle</span>
            </button>
            {calendarSaveError && (
              <button
                type="button"
                onClick={() => setCalendarSaveError(null)}
                className="max-w-[420px] text-left text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-100"
                title="Kapatmak için tıklayın"
              >
                {calendarSaveError}
              </button>
            )}
          </div>
        )}

        {integratedSeatingView === null && activeSubTab === 'A' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                id="assoc_search_input"
                type="text"
                placeholder="Ders adı, seviye veya şube ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Class Dropdown */}
            <div className="relative w-full sm:w-44">
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer appearance-none"
              >
                <option value="Tüm Sınıflar">Tüm Sınıflar</option>
                <option value="9. Sınıf">9. Sınıf</option>
                <option value="10. Sınıf">10. Sınıf</option>
                <option value="11. Sınıf">11. Sınıf</option>
                <option value="12. Sınıf">12. Sınıf</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Kaydet Button */}
            <button
              type="button"
              onClick={handleManualSaveConfig}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[14.67px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0 animate-fade-in"
            >
              <Save className="w-4 h-4" />
              <span>Kaydet</span>
            </button>
          </div>
        )}

        {integratedSeatingView === null && activeSubTab === 'C' && currentPlan && (
          <div className={planningLocked ? "pointer-events-none select-none opacity-60" : ""}>
            <KelebekPlanActions
              activeSubTab={activeSubTab}
              currentPlan={currentPlan}
              handleManualSaveConfig={handleManualSaveConfig}
              isActionsDropdownOpen={isActionsDropdownOpen}
              setIsActionsDropdownOpen={setIsActionsDropdownOpen}
              setIsAbsentReportModalOpen={setIsAbsentReportModalOpen}
              setIsPdfOptionsModalOpen={setIsPdfOptionsModalOpen}
              autoScheduleRemainingExams={autoScheduleRemainingExams}
              setConfirmDialog={setConfirmDialog}
              handleClearPlan={handleClearPlan}
            />
          </div>
        )}
    </div>

      {integratedSeatingView ? (
        <KelebekSystemAModule
          students={students}
          courses={courses}
          embedded
          embeddedView={integratedSeatingView}
          selectedTermValue={selectedTerm}
          selectedExamNoValue={selectedExamNo}
          planningLocked={planningLocked}
          onPlanningLockedChange={handlePlanningLockChange}
          selectedSessionKeyValue={selectedWorkflowSlotKey}
        />
      ) : (
        <div className={planningLocked && activeSubTab === 'C' ? "pointer-events-none select-none opacity-70" : ""}>
      <KelebekSetupPanels
        activeSubTab={activeSubTab}
        associatedJointExams={associatedJointExams}
        filteredAssociatedJointExams={filteredAssociatedJointExams}
        difficultCourses={difficultCourses}
        excludedCourseNames={excludedCourseNames}
        toggleDifficultCourse={toggleDifficultCourse}
        toggleExcludedCourse={toggleExcludedCourse}
        setActiveSubTab={setActiveSubTab}
        computedDates={computedDates}
        sortedUniqueDates={sortedUniqueDates}
        groupedByDate={groupedByDate}
        examDayColorThemes={examDayColorThemes}
        checkIsPassed={checkIsPassed}
        openSessionEditor={openSessionEditor}
        formatTurkishDate={formatTurkishDate}
        editingSessionIndex={editingSessionIndex}
        sessionEditorDraft={sessionEditorDraft}
        setSessionEditorDraft={setSessionEditorDraft}
        closeSessionEditor={closeSessionEditor}
        getDefaultSessionTime={getDefaultSessionTime}
        deleteDayAt={deleteDayAt}
        setConfirmDialog={setConfirmDialog}
        saveSessionEditor={saveSessionEditor}
        onSelectSession={selectSessionForWorkflow}
        isSessionLocked={(session: any) => Boolean(planningLocks[getSessionWorkflowKey(findPlanSlotForCalendarSession(session) || session)])}
        getSessionExams={(session: any) => findPlanSlotForCalendarSession(session)?.exams || []}
      />

      <KelebekPlanOutputPanel
        activeSubTab={activeSubTab}
      resultSubTab={resultSubTab}
        currentPlan={currentPlan}
        setActiveSubTab={setActiveSubTab}
        generatePlan={generatePlan}
        computedDates={computedDates}
        formatTurkishDate={formatTurkishDate}
        classrooms={classrooms}
        handleExamDrop={handleExamDrop}
        moveExamToUnplaced={moveExamToUnplaced}
        draggedExamId={draggedExamId}
        draggedSource={draggedSource}
        setDraggedExamId={setDraggedExamId}
        setDraggedSource={setDraggedSource}
        isCompatibleWithSlot={isCompatibleWithSlot}
        setCellExamSelector={setCellExamSelector}
        setCurrentPlan={setCurrentPlan}
        savedPlans={savedPlans}
        setSavedPlans={setSavedPlans}
        openAbsentModal={openAbsentModal}
        selectedClassroomFilter={selectedClassroomFilter}
        setSelectedClassroomFilter={setSelectedClassroomFilter}
        isAbsentActionsDropdownOpen={isAbsentActionsDropdownOpen}
        setIsAbsentActionsDropdownOpen={setIsAbsentActionsDropdownOpen}
        exportAbsentStudentsPdf={exportAbsentStudentsPdf}
        setIsBulkWhatsAppModalOpen={setIsBulkWhatsAppModalOpen}
        toggleAbsentStudentMakeup={toggleAbsentStudentMakeup}
        updateAbsentStudentMissedExam={updateAbsentStudentMissedExam}
        generateWhatsAppLink={generateWhatsAppLink}
        setConfirmDialog={setConfirmDialog}
        removeAbsentStudentFromSlot={removeAbsentStudentFromSlot}
        cancelSessionPlanning={cancelSessionPlanning}
        courses={courses}
        selectedSessionKey={selectedWorkflowSlotKey}
      />
        </div>
      )}

      <KelebekAbsentManagementModals
        isAbsentModalOpen={isAbsentModalOpen}
        setIsAbsentModalOpen={setIsAbsentModalOpen}
        selectedDayIndex={selectedDayIndex}
        computedDates={computedDates}
        formatTurkishDate={formatTurkishDate}
        removeAbsentStudentFromSlot={removeAbsentStudentFromSlot}
        absentStudentSearchQuery={absentStudentSearchQuery}
        setAbsentStudentSearchQuery={setAbsentStudentSearchQuery}
        searchedStudentsForAbsent={searchedStudentsForAbsent}
        selectedStudentForAbsent={selectedStudentForAbsent}
        setSelectedStudentForAbsent={setSelectedStudentForAbsent}
        currentPlan={currentPlan}
        selectedMissedExam={selectedMissedExam}
        addAbsentStudentToSlot={addAbsentStudentToSlot}
        getNormalizedBaseClassroom={getNormalizedBaseClassroom}
        getTeacherForStudent={getTeacherForStudent}
        courses={courses}
        isBulkWhatsAppModalOpen={isBulkWhatsAppModalOpen}
        setIsBulkWhatsAppModalOpen={setIsBulkWhatsAppModalOpen}
        generateWhatsAppLink={generateWhatsAppLink}
        isAbsentReportModalOpen={isAbsentReportModalOpen}
        setIsAbsentReportModalOpen={setIsAbsentReportModalOpen}
        exportAbsentStudentsPdf={exportAbsentStudentsPdf}
        toggleAbsentStudentMakeup={toggleAbsentStudentMakeup}
        updateAbsentStudentMissedExam={updateAbsentStudentMissedExam}
        setConfirmDialog={setConfirmDialog}
      />

      <KelebekPlanModals
        cellExamSelector={cellExamSelector}
        currentPlan={currentPlan}
        savedPlans={savedPlans}
        selectedTerm={selectedTerm}
        selectedExamNo={selectedExamNo}
        confirmDialog={confirmDialog}
        isPdfOptionsModalOpen={isPdfOptionsModalOpen}
        formatTurkishDate={formatTurkishDate}
        doExamsConflict={doExamsConflict}
        onCloseCellSelector={() => setCellExamSelector(null)}
        onPlanChange={(newPlan, updatedPlans) => {
          setCurrentPlan(newPlan);
          setSavedPlans(updatedPlans);
          planningService.savePlans(selectedTerm, selectedExamNo, updatedPlans, newPlan).catch(err => console.error(err));
        }}
        onRequestConfirm={(dialog) => setConfirmDialog(dialog)}
        onCloseConfirm={() => setConfirmDialog(null)}
        onClosePdfOptions={() => setIsPdfOptionsModalOpen(false)}
        onExportPdf={() => exportExamPlanPdf()}
      />

      {/* Print-only CSS rules to override layout styling nicely */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-kelebek-schedule, #print-kelebek-schedule *,
          #print-kelebek-classroom-agenda, #print-kelebek-classroom-agenda *,
          #print-kelebek-absents, #print-kelebek-absents *,
          #print-kelebek-table, #print-kelebek-table * {
            visibility: visible;
          }
          #print-kelebek-schedule,
          #print-kelebek-classroom-agenda,
          #print-kelebek-absents,
          #print-kelebek-table {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .break-after-page {
            page-break-after: always;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
