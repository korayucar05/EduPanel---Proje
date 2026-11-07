import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Calendar as CalendarIcon, Clock, Users, BookOpen, GraduationCap, ChevronDown, Check, Save, Edit3, Trash2, Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle, Printer, Download, Settings2, Eye, Sparkles, DoorOpen, Calendar, Search, Hourglass, Lock, Unlock } from "lucide-react";
import KelebekSeatingPlanSubview from "./KelebekSeatingPlanSubview";
import KelebekASeatingModals, { type SeatingCriteria } from "./kelebek/KelebekASeatingModals";
import { compareClassroomNames } from "../utils/classroomSort";
import { planningService, planningStateRepository, seatingPlanRepository } from "../modules/planning";
import { loadSchoolBuildingLayouts, loadSchoolBuildingLayoutsFromDatabase } from "./schoolBuildingLayoutStore";
import { PdfEngine } from "../pdf";
import { preloadScheduleData } from "../services/schedule/schedulePersistenceCache";

import { sqliteStorage } from "../core/state/SyncStateStore";
import appStateService from "../core/state/AppStateService";
interface KelebekSystemAModuleProps {
  students: any[];
  courses: any[];
  embedded?: boolean;
  embeddedView?: 'sorular' | 'yerlesim' | 'bilgiler' | 'planlar';
  selectedTermValue?: string;
  selectedExamNoValue?: string;
  planningLocked?: boolean;
  onPlanningLockedChange?: (locked: boolean) => void | Promise<void>;
  selectedSessionKeyValue?: string | null;
}

const DEFAULT_SEATING_CRITERIA: SeatingCriteria = {
  avoidSameBranchSide: true,
  avoidSameExamCluster: false,
  alternateBranches: false,
  avoidSameBranchFrontBack: true,
  avoidSameBranchDiagonal: true,
  alternateBooklets: false,
  minSameBranchDistance: false,
  balanceBranchesAcrossRooms: true,
  avoidSequentialOrder: false,
  reshuffleEachExam: false,
  distributeEmptySeats: true,
  protectSpecialNeeds: false,
  objectiveOnly: true,
  showSupervisorDetails: false,
};

export default function KelebekSystemAModule({
  students,
  courses,
  embedded = false,
  embeddedView,
  selectedTermValue,
  selectedExamNoValue,
  planningLocked = false,
  onPlanningLockedChange,
  selectedSessionKeyValue = null,
}: KelebekSystemAModuleProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [examSessions, setExamSessions] = useState<any[]>([]);

  // Form State
  const [term, setTerm] = useState("");
  const [examNo, setExamNo] = useState("");
  const [examDate, setExamDate] = useState("");
  const [lessonHour, setLessonHour] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  
  const [examList, setExamList] = useState<any[]>([]); // Sınavların listesi
  const [editingSession, setEditingSession] = useState<any>(null);
  const [editingExamList, setEditingExamList] = useState<any[]>([]);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'session' | 'exam' | 'editExam';
    idToDelete: string | null;
    message: string;
  }>({
    isOpen: false,
    type: 'session',
    idToDelete: null,
    message: ''
  });

  useEffect(() => {
    planningService.getExamSessions().then((saved: any[]) => {
      if (Array.isArray(saved)) setExamSessions(saved);
    }).catch(err => console.error("Sınav oturumları yüklenemedi:", err));
  }, []);

  const [selectedTerm, setSelectedTerm] = useState<string>(selectedTermValue || "1. Dönem");
  const [selectedExamNo, setSelectedExamNo] = useState<string>(selectedExamNoValue || "1. Yazılı");

  useEffect(() => {
    if (selectedTermValue) setSelectedTerm(selectedTermValue);
  }, [selectedTermValue]);

  useEffect(() => {
    if (selectedExamNoValue) setSelectedExamNo(selectedExamNoValue);
  }, [selectedExamNoValue]);

  const [bPlan, setBPlan] = useState<any | null>(null);
  const [selectedBSlot, setSelectedBSlot] = useState<any | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getSessionWorkflowKey = (slot: any) => {
    const id = String(slot?.id || '').trim();
    if (id) return id;
    const date = String(slot?.dateStr || 'tarih');
    const time = String(slot?.timeStr || slot?.sessionTime || 'saat');
    const session = Number(slot?.sessionIndex || 1);
    return `${date}_${time}_${session}`;
  };
  const [embeddedToolbarTarget, setEmbeddedToolbarTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!embedded) {
      setEmbeddedToolbarTarget(null);
      return;
    }
    const target = document.getElementById('integrated-seating-session-toolbar');
    setEmbeddedToolbarTarget(target);
  }, [embedded, embeddedView]);

  const [uploadedQuestions, setUploadedQuestions] = useState<{[key: string]: {fileName: string, uploadedAt: string}}>({});
  const [uploadModalState, setUploadModalState] = useState<{
    isOpen: boolean;
    examKey: string | null;
    examData: any | null;
  }>({
    isOpen: false,
    examKey: null,
    examData: null
  });
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const loadUploadedQuestions = async () => {
      const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_');
      try {
        const saved = await planningService.getUploadedQuestions(selectedTerm, selectedExamNo);
        if (saved) {
          setUploadedQuestions(saved as any);
        } else {
          setUploadedQuestions({});
        }
      } catch (err) {
        console.error("Error loading uploaded questions:", err);
        setUploadedQuestions({});
      }
    };
    loadUploadedQuestions();
  }, [selectedTerm, selectedExamNo]);

  const handleSaveQuestions = async (examKey: string, fileName: string) => {
    const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_');
    const updated = {
      ...uploadedQuestions,
      [examKey]: {
        fileName,
        uploadedAt: new Date().toLocaleString("tr-TR")
      }
    };
    setUploadedQuestions(updated);
    try {
      await planningService.saveUploadedQuestions(selectedTerm, selectedExamNo, updated);
    } catch (err) {
      console.error("Error saving uploaded questions:", err);
    }
  };

  const handleClearQuestions = async (examKey: string) => {
    const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_');
    const updated = { ...uploadedQuestions };
    delete updated[examKey];
    setUploadedQuestions(updated);
    try {
      await planningService.saveUploadedQuestions(selectedTerm, selectedExamNo, updated);
    } catch (err) {
      console.error("Error clearing questions:", err);
    }
  };

  const [activeView, setActiveView] = useState<'sorular' | 'yerlesim' | 'bilgiler' | 'planlar'>(embeddedView || 'sorular');

  useEffect(() => {
    if (embeddedView) setActiveView(embeddedView);
  }, [embeddedView]);
  const [planlarViewMode, setPlanlarViewMode] = useState<'salon' | 'sinif'>('sinif');
  const [isClassPdfModalOpen, setIsClassPdfModalOpen] = useState(false);
  const [isRoomPdfModalOpen, setIsRoomPdfModalOpen] = useState(false);
  const [selectedPdfClasses, setSelectedPdfClasses] = useState<string[]>([]);
  const [selectedPdfRooms, setSelectedPdfRooms] = useState<string[]>([]);
  const [selectedClassList, setSelectedClassList] = useState<string>('');
  const [classStudentSearch, setClassStudentSearch] = useState<string>('');
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewRoomName, setPreviewRoomName] = useState("");
  const [generatedSeating, setGeneratedSeating] = useState<any | null>(null);
  const [slotPlanStatuses, setSlotPlanStatuses] = useState<Record<string, { hasPlan: boolean; generatedAt?: string; roomsCount?: number; seatedCount?: number }>>({});

  useEffect(() => {
    const loadAllSlotStatuses = async () => {
      if (!bPlan?.slots) return;
      const statuses: typeof slotPlanStatuses = {};
      for (const slot of bPlan.slots) {
        const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_') + "_slot_" + slot.sessionIndex;
        try {
          const saved: any = await planningService.getSeating(selectedTerm, selectedExamNo, Number(slot.sessionIndex || 1));
          if (saved && saved.generatedSeating) {
            statuses[slot.id || slot.sessionIndex] = {
              hasPlan: true,
              generatedAt: saved.generatedSeating.generatedAt || "",
              roomsCount: saved.generatedSeating.rooms?.length || 0,
              seatedCount: saved.generatedSeating.rooms?.reduce((acc: number, r: any) => {
                const count = r.desks.flatMap((d: any) => [d.left, d.right]).filter(Boolean).length;
                return acc + count;
              }, 0) || 0
            };
          } else {
            statuses[slot.id || slot.sessionIndex] = { hasPlan: false };
          }
        } catch (e) {
          statuses[slot.id || slot.sessionIndex] = { hasPlan: false };
        }
      }
      setSlotPlanStatuses(statuses);
    };
    loadAllSlotStatuses();
  }, [bPlan, selectedTerm, selectedExamNo, generatedSeating]);

  // Seating Configuration States
  const [sittingPattern, setSittingPattern] = useState<'tekli' | 'ciftli'>('ciftli');
  const [genderRuleActive, setGenderRuleActive] = useState<boolean>(true);
  const [manualPlacementActive, setManualPlacementActive] = useState<boolean>(false);
  const [crossSittingActive, setCrossSittingActive] = useState<boolean>(false);
  const [seatingCriteria, setSeatingCriteria] = useState<SeatingCriteria>({ ...DEFAULT_SEATING_CRITERIA });
  const [backupSalons, setBackupSalons] = useState<{ id: string; name: string; capacity: number; isActive: boolean }[]>([]);
  const [inactiveDefaultSalons, setInactiveDefaultSalons] = useState<string[]>([]); // Default salons that have been deselected
  const [savedInactiveDefaultSalons, setSavedInactiveDefaultSalons] = useState<string[]>([]);
  const [roomTeacherAssignments, setRoomTeacherAssignments] = useState<Record<string, string>>({});
  const [savedRoomTeacherAssignments, setSavedRoomTeacherAssignments] = useState<Record<string, string>>({});
  const [isSavingSalonSelection, setIsSavingSalonSelection] = useState(false);
  const [activeExtraSalons, setActiveExtraSalons] = useState<string[]>([]); // Other school classrooms selected as extra
  const [manualStudentAssignments, setManualStudentAssignments] = useState<{[studentId: string]: string}>({}); // studentId -> salon name (legacy compatibility)
  const [fixedSeatAssignments, setFixedSeatAssignments] = useState<Record<string, { studentId: string; roomName: string; deskId: number; side: 'left' | 'right' }>>({});
  const [placementInfoRoomName, setPlacementInfoRoomName] = useState<string>("");
  const [selectedFixedSeat, setSelectedFixedSeat] = useState<{ roomName: string; deskId: number; side: 'left' | 'right'; seatNumber: number } | null>(null);

  useEffect(() => {
    if (!selectedFixedSeat) return;
    const handleOutsideFixedSeatClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-fixed-seat-ui="true"]')) return;
      setSelectedFixedSeat(null);
      setPlacementStudentSearch('');
    };
    document.addEventListener('mousedown', handleOutsideFixedSeatClick);
    return () => document.removeEventListener('mousedown', handleOutsideFixedSeatClick);
  }, [selectedFixedSeat]);
  const [placementStudentSearch, setPlacementStudentSearch] = useState("");
  const [isGeneratingSeating, setIsGeneratingSeating] = useState(false);
  const [isCancellingSeating, setIsCancellingSeating] = useState(false);
  const [placementProgress, setPlacementProgress] = useState({ current: 0, total: 0, stage: "" });
  const lastDistributionSignatureRef = useRef<string>("");
  const [placementIssue, setPlacementIssue] = useState<any | null>(null);
  const [retryCriteriaDraft, setRetryCriteriaDraft] = useState<SeatingCriteria>({ ...DEFAULT_SEATING_CRITERIA });
  const [retryAllowRecentRoomRepeat, setRetryAllowRecentRoomRepeat] = useState(false);
  const [retryOptionsSaved, setRetryOptionsSaved] = useState(false);
  const [customRoomCapacities, setCustomRoomCapacities] = useState<{[roomName: string]: number}>({}); // roomName -> custom desks count
  const [isPublishingExamAnnouncements, setIsPublishingExamAnnouncements] = useState(false);
  const repairedLockedAnnouncementRef = useRef<string>("");

  // Current Generated Placement
  const [newBackupName, setNewBackupName] = useState("");
  const [newBackupCapacity, setNewBackupCapacity] = useState(30);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [selectedRoomToView, setSelectedRoomToView] = useState<string>("");

  const handlePrint = () => {
    window.print();
  };

  const formatOturumLabel = (slot: any) => {
    if (!slot) return "";
    const dateParts = slot.dateStr ? slot.dateStr.split('-') : [];
    let formattedDate = slot.dateStr;
    if (dateParts.length === 3) {
      formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
    }
    return `${formattedDate} (${slot.dayName || ""}) • ${slot.sessionIndex}. Oturum`;
  };

  const getStudentGender = (student: any) => {
    if (student.gender) return student.gender;
    if (student.cinsiyet) return student.cinsiyet;
    // Stable hash fallback for student name or id
    const val = (student.name || "") + (student.id || "");
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = val.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 2 === 0 ? "Kız" : "Erkek";
  };

  // Grup adları fiziksel derslik adı değildir; ancak seçmeli sınavlarda
  // öğrenci katılımını belirlemek için parantez içindeki grup korunmalıdır.
  const physicalRoomName = (value: unknown) => String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const normalizeRoom = (value: unknown) =>
    physicalRoomName(value).replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
  const normalizeGroup = (value: unknown) =>
    String(value || "").trim().toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ0-9]/g, "");
  const matchesExamClassroom = (student: any, examClassroom: string) => {
    if (normalizeRoom(student?.classroom) !== normalizeRoom(examClassroom)) return false;
    const examGroupText = String(examClassroom || "").match(/\(([^)]*)\)\s*$/)?.[1]?.trim() || "";
    if (!examGroupText) return true; // Ortak ders: şubenin tüm öğrencileri.
    const actualGroupText = String(student?.group || student?.groupName ||
      String(student?.classroom || "").match(/\(([^)]*)\)\s*$/)?.[1] || "").trim();
    if (!actualGroupText) return false; // Grubu bilinmeyen öğrenci seçmeli sınava alınmaz.
    const allowedGroups = examGroupText.split(/[,;/]+/).map(normalizeGroup).filter(Boolean);
    const actualGroups = actualGroupText.split(/[,;/]+/).map(normalizeGroup).filter(Boolean);
    return actualGroups.some((actual) => allowedGroups.some((allowed) =>
      actual === allowed || (actual.length >= 4 && allowed.length >= 4 &&
        (actual.includes(allowed) || allowed.includes(actual)))));
  };
  const allSchoolClassrooms = useMemo(() => {
    const unique = Array.from(new Set(students.map((s) => physicalRoomName(s.classroom)).filter(Boolean)));
    return unique.sort(compareClassroomNames);
  }, [students]);

  const [classCapacities, setClassCapacities] = useState<{[roomName: string]: number}>({});
  const [classStudentCapacities, setClassStudentCapacities] = useState<{[roomName: string]: number}>({});
  const [roomLocations, setRoomLocations] = useState<{[roomName: string]: { buildingName: string; floorName: string }}>({});
  const [buildingClassrooms, setBuildingClassrooms] = useState<string[]>([]);
  const [roomLayoutGeometry, setRoomLayoutGeometry] = useState<Record<string, { deskColumns: 3 | 4; deskRows: number; activeDesks: boolean[] }>>({});
  const [roomLayoutElements, setRoomLayoutElements] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const normalizeClassroomKey = (value: unknown) =>
      String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");

    const applyBuildingLayouts = (buildings: any[]) => {
      const deskCapacities: {[roomName: string]: number} = {};
      const studentCapacities: {[roomName: string]: number} = {};
      const locations: {[roomName: string]: { buildingName: string; floorName: string }} = {};
      const geometries: Record<string, { deskColumns: 3 | 4; deskRows: number; activeDesks: boolean[] }> = {};
      const elementsByRoom: Record<string, any[]> = {};
      const roomByName = new Map<string, any>();

      const roomsFromBuildings: string[] = [];
      buildings.forEach((building) => {
        (building.floors || []).forEach((floor: any) => {
          (floor.rooms || []).forEach((room: any) => {
            if (String(room.name || "").trim()) roomsFromBuildings.push(String(room.name).trim());
            const roomKey = normalizeClassroomKey(room.name);
            roomByName.set(roomKey, room);
            locations[roomKey] = { buildingName: String(building.name || "Bina"), floorName: String(floor.name || "") };
            const deskColumns: 3 | 4 = Number(room?.deskColumns) === 3 ? 3 : 4;
            const deskRows = Math.max(1, Number(room?.deskRows) || 1);
            const slotCount = deskColumns * deskRows;
            const activeDesks = Array.from({ length: slotCount }, (_, index) => room?.activeDesks?.[index] !== false);
            const rawElements = room?.elements || room?.objects || room?.layoutObjects || room?.fixedObjects || room?.features || room?.items || [];
            elementsByRoom[roomKey] = Array.isArray(rawElements) ? rawElements : [];
            geometries[roomKey] = { deskColumns, deskRows, activeDesks };
          });
        });
      });

      const plannedRooms = (selectedBSlot?.exams || []).flatMap((exam: any) =>
        (exam.classrooms || []).map((room: string) => physicalRoomName(room)));
      const uniqueBuildingRooms = Array.from(new Set(roomsFromBuildings)).sort(compareClassroomNames);
      setBuildingClassrooms(uniqueBuildingRooms);
      Array.from(new Set([...uniqueBuildingRooms, ...allSchoolClassrooms, ...plannedRooms])).forEach((cls) => {
        const normalizedKey = normalizeClassroomKey(cls);
        const room = roomByName.get(normalizedKey);
        if (!room) {
          deskCapacities[cls] = 0;
          studentCapacities[cls] = 0;
          deskCapacities[normalizedKey] = 0;
          studentCapacities[normalizedKey] = 0;
          return;
        }
        const activeDeskCount = Array.isArray(room.activeDesks)
          ? room.activeDesks.filter(Boolean).length
          : Math.max(0, Math.ceil(Number(room.capacity || 0) / 2));
        const studentCapacity = activeDeskCount * 2;
        deskCapacities[cls] = activeDeskCount;
        studentCapacities[cls] = studentCapacity;
        deskCapacities[normalizedKey] = activeDeskCount;
        studentCapacities[normalizedKey] = studentCapacity;
      });

      setClassCapacities(deskCapacities);
      setClassStudentCapacities(studentCapacities);
      setRoomLocations(locations);
      setRoomLayoutGeometry(geometries);
      setRoomLayoutElements(elementsByRoom);
    };

    const refreshClassroomCapacities = async () => {
      // Tanımlamalar / Sınıflar fiziksel oturma krokisini ayrı bir kalıcı anahtarda
      // tutar. Bina katalogundaki varsayılan 4 sütun bu krokinin üzerine geçmemeli.
      // İlk yüklemede eski yerleşimi göstermek yerine iki kaynağı birleştirerek uygula.
      try {
        const stored = await loadSchoolBuildingLayoutsFromDatabase();
        const buildings = stored.length ? stored : loadSchoolBuildingLayouts();
        const merged = await Promise.all(buildings.map(async (building: any) => ({
          ...building,
          floors: await Promise.all((building.floors || []).map(async (floor: any) => ({
            ...floor,
            rooms: await Promise.all((floor.rooms || []).map(async (room: any) => {
              const id = String(room?.classroomId || room?.id || "").trim();
              const name = String(room?.name || "").trim();
              const byId = id ? await appStateService.getItem<any>(`classroom_seating_layout_${id}`).catch(() => null) : null;
              const byName = name ? await appStateService.getItem<any>(`seating_plan_${name}`).catch(() => null) : null;
              const saved = byId && byName
                ? (Date.parse(String(byName.updatedAt || "")) > Date.parse(String(byId.updatedAt || "")) ? byName : byId)
                : byId || byName;
              if (!saved || !Array.isArray(saved.activeDesks)) return room;
              const deskColumns: 3 | 4 = Number(saved.deskColumns) === 3 ? 3 : 4;
              const deskRows = Math.max(1, Number(saved.deskRows) || Number(room.deskRows) || 1);
              const count = deskColumns * deskRows;
              const activeDesks = Array.from({ length: count }, (_, index) => saved.activeDesks[index] !== false);
              return { ...room, deskColumns, deskRows, activeDesks, capacity: activeDesks.filter(Boolean).length * 2 };
            })),
          }))),
        })));
        applyBuildingLayouts(merged);
      } catch (error) {
        console.warn("Sınıf oturma krokisi okunamadı; bina yerleşimi kullanılıyor:", error);
        applyBuildingLayouts(loadSchoolBuildingLayouts());
      }
    };

    void refreshClassroomCapacities();
    const onLayoutChanged = () => { void refreshClassroomCapacities(); };
    window.addEventListener("enstitu-school-building-layout-changed", onLayoutChanged);
    return () => window.removeEventListener("enstitu-school-building-layout-changed", onLayoutChanged);
  }, [allSchoolClassrooms, selectedBSlot]);

  const plannedSalonNames = useMemo(() => {
    const rooms = new Set<string>();
    (selectedBSlot?.exams || []).forEach((exam: any) => {
      (exam.classrooms || []).forEach((cls: string) => {
        const name = physicalRoomName(cls);
        if (name) rooms.add(normalizeRoom(name));
      });
    });
    return rooms;
  }, [selectedBSlot]);

  const defaultSalons = useMemo(() => {
    if (!selectedBSlot?.exams) return [];
    // Bina Bilgileri'ndeki bütün fiziksel salonlar listelenir. Yalnızca bu
    // oturumda sınavı olan sınıfların salonları başlangıçta işaretli olur.
    const rooms = new Set<string>(buildingClassrooms);
    (selectedBSlot.exams || []).forEach((exam: any) => {
      (exam.classrooms || []).forEach((cls: string) => {
        const name = physicalRoomName(cls);
        if (name) rooms.add(name);
      });
    });
    return [...rooms].sort(compareClassroomNames);
  }, [selectedBSlot, buildingClassrooms]);

  const unplannedDefaultSalons = useMemo(() =>
    defaultSalons.filter((room) => !plannedSalonNames.has(normalizeRoom(room))),
  [defaultSalons, plannedSalonNames]);

  const extraSchoolClassrooms = useMemo(() => {
    const defaultsClean = new Set(defaultSalons.map(s => s.replace(/[\s\-\/]/g, "").toUpperCase()));
    return allSchoolClassrooms.filter(cls => {
      const cleanCls = cls.replace(/[\s\-\/]/g, "").toUpperCase();
      return !defaultsClean.has(cleanCls);
    });
  }, [allSchoolClassrooms, defaultSalons]);

  const examStudents = useMemo(() => {
    if (!selectedBSlot?.exams || !students || students.length === 0) return [];
    
    const matched: any[] = [];
    selectedBSlot.exams.forEach((exam: any) => {
      const examClasses = exam.classrooms || [];
      // Seçmeli/grup dersi: yalnızca dersin atanmış olduğu grubun öğrencileri.
      // Aynı şubedeki diğer grubun öğrencileri bu sınava dahil edilmez.
      const list = students.filter(s =>
        examClasses.some((c: string) => matchesExamClassroom(s, c))
      );
      list.forEach(s => {
        if (!matched.some(m => m.id === s.id)) {
          matched.push({
            ...s,
            examCourse: exam.courseName,
            examGrade: exam.gradeLevel
          });
        }
      });
    });
    return matched;
  }, [selectedBSlot, students]);

  const studentCountsByBranch = useMemo(() => {
    const counts: { [branch: string]: { total: number; examCourse: string; examGrade: string } } = {};
    examStudents.forEach(s => {
      const branch = s.classroom || "Belirtilmemiş";
      if (!counts[branch]) {
        counts[branch] = {
          total: 0,
          examCourse: s.examCourse,
          examGrade: s.examGrade
        };
      }
      counts[branch].total += 1;
    });
    return Object.entries(counts).map(([branch, info]) => ({
      branch,
      ...info
    })).sort((a, b) => a.branch.localeCompare(b.branch));
  }, [examStudents]);

  const activeRoomsList = useMemo(() => {
    const list: { name: string; type: 'default'; baseDesks: number; capacity: number; buildingName: string; floorName: string; deskColumns: 3 | 4; deskRows: number; activeDesks: boolean[] }[] = [];
    const normalizeRoomKey = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const inactive = new Set(inactiveDefaultSalons.map(normalizeRoomKey));
    const deskCapacityByKey = new Map(
      Object.entries(classCapacities).map(([name, capacity]) => [normalizeRoomKey(name), Number(capacity || 0)]),
    );
    const studentCapacityByKey = new Map(
      Object.entries(classStudentCapacities).map(([name, capacity]) => [normalizeRoomKey(name), Number(capacity || 0)]),
    );

    defaultSalons.forEach((room) => {
      const roomKey = normalizeRoomKey(room);
      if (inactive.has(roomKey)) return;
      const layoutCapacity = Number(studentCapacityByKey.get(roomKey) || 0);
      const customCapacityEntry = Object.entries(customRoomCapacities).find(([name]) => normalizeRoomKey(name) === roomKey);
      const desks = customCapacityEntry
        ? Number(customCapacityEntry[1] || 0)
        : Number(deskCapacityByKey.get(roomKey) || 0);
      if (layoutCapacity <= 0) return;

      // Bina Bilgileri'ndeki `capacity` öğrenci kapasitesidir. Yerleştirme motoru
      // bu değeri sıra sayısına çevirip yeniden yarıya düşürmemelidir.
      // Seçilen salonun ekranda görünen kapasitesi ile motorun kullanacağı
      // kapasite ve üreteceği koltuk sayısı birebir aynı tutulur.
      const seatingCapacity = layoutCapacity;
      const geometry = roomLayoutGeometry[roomKey];
      const deskColumns: 3 | 4 = geometry?.deskColumns === 3 ? 3 : 4;
      const deskRows = Math.max(1, Number(geometry?.deskRows || Math.ceil(Math.max(1, desks) / deskColumns)));
      const gridCount = deskColumns * deskRows;
      const activeDesks = Array.from({ length: gridCount }, (_, index) => geometry?.activeDesks?.[index] !== false);
      const planDesks = activeDesks.filter(Boolean).length;
      const location = roomLocations[roomKey];
      list.push({
        name: room,
        type: 'default',
        baseDesks: planDesks,
        capacity: seatingCapacity,
        buildingName: location?.buildingName || 'Bina Bilgisi Yok',
        floorName: location?.floorName || '',
        deskColumns,
        deskRows,
        activeDesks,
      });
    });

    return list;
  }, [defaultSalons, inactiveDefaultSalons, customRoomCapacities, classCapacities, classStudentCapacities, roomLocations, roomLayoutGeometry]);

  const totalRoomsCapacity = useMemo(() => {
    return activeRoomsList.reduce((acc, r) => acc + r.capacity, 0);
  }, [activeRoomsList]);

  const selectedSalonCapacity = useMemo(() => {
    const normalizeRoomKey = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const capacityByRoom = new Map(
      Object.entries(classStudentCapacities).map(([name, capacity]) => [normalizeRoomKey(name), Number(capacity || 0)]),
    );
    const inactive = new Set(inactiveDefaultSalons.map(normalizeRoomKey));
    return defaultSalons.reduce((total, room) => {
      const roomKey = normalizeRoomKey(room);
      if (inactive.has(roomKey)) return total;
      return total + Number(capacityByRoom.get(roomKey) || 0);
    }, 0);
  }, [defaultSalons, inactiveDefaultSalons, classStudentCapacities]);

  const normalizeClassroomKey = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");

  const selectedExamStudentCount = useMemo(() => {
    const inactiveRooms = new Set(inactiveDefaultSalons.map(normalizeClassroomKey));
    return studentCountsByBranch.reduce((total, item: any) => {
      return total + (!inactiveRooms.has(normalizeClassroomKey(item.branch)) ? Number(item.total || 0) : 0);
    }, 0);
  }, [inactiveDefaultSalons, studentCountsByBranch]);

  const salonSelectionReady = !!selectedBSlot && activeRoomsList.length > 0;

  const salonSelectionChanged = useMemo(() => {
    const normalize = (items: string[]) => items
      .map((value) => normalizeClassroomKey(value))
      .filter(Boolean)
      .sort();
    return JSON.stringify(normalize(inactiveDefaultSalons)) !== JSON.stringify(normalize(savedInactiveDefaultSalons));
  }, [inactiveDefaultSalons, savedInactiveDefaultSalons]);

  const salonTeacherAssignmentsChanged = useMemo(() => {
    const normalizeMap = (source: Record<string, string>) => Object.entries(source || {})
      .map(([room, teacher]) => [normalizeClassroomKey(room), String(teacher || '').trim()] as const)
      .filter(([room]) => !!room)
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    return JSON.stringify(normalizeMap(roomTeacherAssignments)) !== JSON.stringify(normalizeMap(savedRoomTeacherAssignments));
  }, [roomTeacherAssignments, savedRoomTeacherAssignments]);

  const canSaveSalonSelection = salonSelectionReady && (salonSelectionChanged || salonTeacherAssignmentsChanged) && !isSavingSalonSelection;

  useEffect(() => {
    const loadSeatingConfig = async () => {
      if (!selectedBSlot) {
        setGeneratedSeating(null);
        setSavedInactiveDefaultSalons([]);
        setRoomTeacherAssignments({});
        setSavedRoomTeacherAssignments({});
        return;
      }
      const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_') + "_slot_" + selectedBSlot.sessionIndex;
      try {
        const saved = await planningService.getSeating(selectedTerm, selectedExamNo, Number(selectedBSlot.sessionIndex || 1));
        if (saved) {
          const parsed = saved as any;
          setSittingPattern('ciftli');
          setGenderRuleActive(parsed.genderRuleActive !== false);
          setManualPlacementActive(!!parsed.manualPlacementActive || Object.keys(parsed.fixedSeatAssignments || {}).length > 0);
          setCrossSittingActive(!!parsed.crossSittingActive);
          setSeatingCriteria({ ...DEFAULT_SEATING_CRITERIA, ...(parsed.seatingCriteria || {}), avoidSameExamCluster: false, minSameBranchDistance: false, showSupervisorDetails: false });
          setBackupSalons([]);
          const savedInactive = Array.isArray(parsed.inactiveDefaultSalons) ? parsed.inactiveDefaultSalons : [];
          // Önceden elle kaydedilmiş seçimler ve yerleştirmeler korunur.
          // Eski sürümde hiç seçim kaydedilmemişse salonları sınavı olan
          // sınıflara göre ilk kez ayarla (eski 'tümü işaretli' davranışı değil).
          const hasSavedSelection = parsed.salonSelectionInitialized === true ||
            savedInactive.length > 0 || Boolean(parsed.generatedSeating);
          const loadedInactiveSalons = hasSavedSelection ? savedInactive : unplannedDefaultSalons;
          setInactiveDefaultSalons(loadedInactiveSalons);
          setSavedInactiveDefaultSalons(loadedInactiveSalons);
          const loadedRoomTeacherAssignments = parsed.roomTeacherAssignments && typeof parsed.roomTeacherAssignments === 'object'
            ? parsed.roomTeacherAssignments
            : {};
          setRoomTeacherAssignments(loadedRoomTeacherAssignments);
          setSavedRoomTeacherAssignments(loadedRoomTeacherAssignments);
          setActiveExtraSalons([]);
          setManualStudentAssignments(parsed.manualStudentAssignments || {});
          setFixedSeatAssignments(parsed.fixedSeatAssignments || {});
          setCustomRoomCapacities(parsed.customRoomCapacities || {});
          setGeneratedSeating(parsed.generatedSeating || null);
        } else {
          setSittingPattern('tekli');
          setGenderRuleActive(true);
          setManualPlacementActive(false);
          setCrossSittingActive(false);
          setSeatingCriteria({ ...DEFAULT_SEATING_CRITERIA });
          setBackupSalons([]);
          setInactiveDefaultSalons(unplannedDefaultSalons);
          setSavedInactiveDefaultSalons(unplannedDefaultSalons);
          setRoomTeacherAssignments({});
          setSavedRoomTeacherAssignments({});
          setActiveExtraSalons([]);
          setManualStudentAssignments({});
          setFixedSeatAssignments({});
          setCustomRoomCapacities({});
          setGeneratedSeating(null);
        }
      } catch (err) {
        console.error("Error loading seating config:", err);
      }
    };
    loadSeatingConfig();
  }, [selectedBSlot, selectedTerm, selectedExamNo, defaultSalons, unplannedDefaultSalons]);

  const saveSeatingConfig = async (updatedFields: any) => {
    if (!selectedBSlot) return;
    const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_') + "_slot_" + selectedBSlot.sessionIndex;
    
    const currentConfig = {
      sittingPattern,
      genderRuleActive,
      manualPlacementActive,
      crossSittingActive,
      seatingCriteria,
      backupSalons,
      inactiveDefaultSalons,
      salonSelectionInitialized: true,
      activeExtraSalons,
      roomTeacherAssignments,
      manualStudentAssignments,
      fixedSeatAssignments,
      customRoomCapacities,
      generatedSeating,
      ...updatedFields
    };

    try {
      await planningService.saveSeating(selectedTerm, selectedExamNo, Number(selectedBSlot.sessionIndex || 1), currentConfig);
    } catch (err) {
      console.error("Error saving seating config:", err);
    }
  };

  const getExamDisplayNameForStudent = (student: any) => {
    const studentClass = String(student?.classroom || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const matchingExam = selectedBSlot?.exams?.find((exam: any) => {
      if (student?.examCourse && String(exam?.courseName || "") === String(student.examCourse || "")) return true;
      return exam?.classrooms?.some((cls: string) => String(cls || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR") === studentClass);
    });
    const explicitName = String(matchingExam?.examName || matchingExam?.name || matchingExam?.title || "").trim();
    if (explicitName) return explicitName;
    const courseName = String(matchingExam?.courseName || student?.examCourse || "Sınav").trim();
    return `${courseName} Sınavı`;
  };

  const getExamDisplayNameForClass = (className: string) => {
    const classKey = String(className || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const matchingExam = selectedBSlot?.exams?.find((exam: any) =>
      exam?.classrooms?.some((cls: string) => String(cls || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR") === classKey)
    );
    const explicitName = String(matchingExam?.examName || matchingExam?.name || matchingExam?.title || "").trim();
    if (explicitName) return explicitName;
    const courseName = String(matchingExam?.courseName || "Sınav").trim();
    return `${courseName} Sınavı`;
  };

  const formatPlacementDate = (value: unknown) => {
    const dateStr = String(value || "").trim();
    const parts = dateStr.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
  };

  const buildDistributionSignature = (rooms: any[] = []) =>
    [...rooms]
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "tr"))
      .map((room: any) => {
        const deskPart = [...(room?.desks || [])]
          .sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0))
          .map((desk: any) => {
            const leftId = String(desk?.left?.id || desk?.left?.studentId || desk?.left?.number || "-");
            const rightId = String(desk?.right?.id || desk?.right?.studentId || desk?.right?.number || "-");
            return `${desk?.id}:${leftId},${rightId}`;
          })
          .join(";");
        return `${room?.name || "-"}=>${deskPart}`;
      })
      .join("|");

  useEffect(() => {
    const savedSignature = String(generatedSeating?.distributionSignature || "").trim();
    if (savedSignature) lastDistributionSignatureRef.current = savedSignature;
  }, [generatedSeating?.distributionSignature]);

  const normalizeAnnouncementKey = (value: unknown) => String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü_-]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  const getLockedExamAnnouncementContext = () => {
    const rawExamTime = String(
      selectedBSlot?.timeStr || selectedBSlot?.startTime || selectedBSlot?.sessionTime || selectedBSlot?.examTime || ""
    ).trim();
    const examTime = rawExamTime.match(/\d{1,2}:\d{2}/)?.[0] || rawExamTime || "-";
    const examDateRaw = String(selectedBSlot?.dateStr || "").trim();
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(examDateRaw)
      ? examDateRaw
      : (() => {
          const match = examDateRaw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
          return match ? `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}` : examDateRaw;
        })();
    const examStart = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) && /^\d{1,2}:\d{2}$/.test(examTime)
      ? new Date(`${normalizedDate}T${examTime}:00+03:00`)
      : null;

    let examEnd: Date | null = null;
    if (examStart && Number.isFinite(examStart.getTime())) {
      const currentMinutes = Number(examTime.split(":")[0]) * 60 + Number(examTime.split(":")[1]);
      const nextSlotMinutes = (bPlan?.slots || [])
        .filter((slot: any) => String(slot?.dateStr || "") === examDateRaw)
        .map((slot: any) => String(slot?.timeStr || slot?.sessionTime || "").match(/\d{1,2}:\d{2}/)?.[0] || "")
        .filter(Boolean)
        .map((time: string) => {
          const [hour, minute] = time.split(":").map(Number);
          return { time, minutes: hour * 60 + minute };
        })
        .filter((entry: any) => entry.minutes > currentMinutes)
        .sort((a: any, b: any) => a.minutes - b.minutes)[0];
      examEnd = nextSlotMinutes
        ? new Date(`${normalizedDate}T${nextSlotMinutes.time}:00+03:00`)
        : new Date(examStart.getTime() + 60 * 60 * 1000);
    }

    const planKey = `${selectedTerm}-${selectedExamNo}-${examDateRaw || "tarih"}-slot-${selectedBSlot?.sessionIndex || 1}`
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    return {
      planKey,
      examTime,
      examDateRaw,
      examDate: formatPlacementDate(examDateRaw),
      expiresAt: examEnd && Number.isFinite(examEnd.getTime()) ? examEnd.toISOString() : "",
    };
  };

  const clearLockedExamAnnouncements = async () => {
    const { planKey, examDateRaw } = getLockedExamAnnouncementContext();
    const currentSessionIndex = Number(selectedBSlot?.sessionIndex || 1);
    try {
      const response = await fetch("/api/database/collections/studentAppAnnouncements", { cache: "no-store" });
      if (!response.ok) return;
      const rows = await response.json().catch(() => []);
      const currentRows = (Array.isArray(rows) ? rows : []).filter((row: any) => {
        const source = String(row?.source || "");
        if (!["exam-seating", "exam-plan-lock"].includes(source)) return false;
        if (String(row?.planKey || "") === planKey) return true;
        // Eski sürümlerde planKey yoktu; aynı tarih/oturumdaki eski öğrenci duyurusunu da temizle.
        return source === "exam-seating" &&
          String(row?.examDate || row?.date || "") === examDateRaw &&
          Number(row?.sessionIndex || 1) === currentSessionIndex;
      });
      await Promise.allSettled(currentRows.map(async (row: any) => {
        const id = String(row?.id || "").trim();
        if (!id) return;
        const deleteResponse = await fetch(`/api/database/collections/studentAppAnnouncements/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!deleteResponse.ok && deleteResponse.status !== 404) throw new Error("Duyuru silinemedi.");
      }));
    } catch (error) {
      console.warn("Kilitli sınav duyuruları temizlenemedi:", error);
    }
  };

  const publishLockedExamAnnouncements = async (result: any) => {
    const placements: Array<{ student: any; room: any; seatNum: number | string }> = [];
    (result?.rooms || []).forEach((room: any) => {
      (room?.desks || []).forEach((desk: any) => {
        if (desk?.left) placements.push({ student: desk.left, room, seatNum: desk.seatNumLeft });
        if (desk?.right) placements.push({ student: desk.right, room, seatNum: desk.seatNumRight });
      });
    });

    if (!selectedBSlot || !placements.length) return { saved: 0, failed: 1 };

    const now = new Date().toISOString();
    const { planKey, examTime, examDateRaw, examDate, expiresAt } = getLockedExamAnnouncementContext();
    let currentScheduleData: any = {};
    try { currentScheduleData = await preloadScheduleData(); } catch { currentScheduleData = {}; }

    // Aynı oturum daha önce kilitlenmişse eski hedef kayıtlarını temizle; güncel dağıtım tek kaynak olsun.
    await clearLockedExamAnnouncements();

    const examEntries = (selectedBSlot?.exams || []).map((exam: any) => ({
      gradeLevel: String(exam?.gradeLevel || ""),
      courseName: String(exam?.courseName || "Sınav"),
      classrooms: Array.isArray(exam?.classrooms) ? exam.classrooms.map((item: any) => String(item || "")).filter(Boolean) : [],
    }));

    const roomAssignments = (result?.rooms || []).map((room: any) => {
      const roomStudents = (room?.desks || []).flatMap((desk: any) => [desk?.left, desk?.right]).filter(Boolean);
      return {
        roomName: String(room?.name || ""),
        buildingName: String(room?.buildingName || ""),
        floorName: String(room?.floorName || ""),
        teacherName: resolveSupervisorName(room, roomStudents, currentScheduleData) || "Belirlenmedi",
      };
    });

    const records: any[] = [];

    placements.forEach(({ student, room, seatNum }) => {
      const studentId = String(student?.id || student?.studentId || "").trim();
      if (!studentId) return;
      const studentKey = normalizeAnnouncementKey(studentId) || String(studentId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const examName = getExamDisplayNameForStudent(student);
      const courseName = String(examName || "Sınav").replace(/\s*Sınavı$/i, "").trim() || "Sınav";
      const buildingName = String(room?.buildingName || "Bina Bilgisi Yok");
      const floorName = String(room?.floorName || "");
      const roomName = String(room?.name || "");
      const roomStudents = (room?.desks || []).flatMap((desk: any) => [desk?.left, desk?.right]).filter(Boolean);
      const supervisorName = resolveSupervisorName(room, roomStudents, currentScheduleData);
      const announcementId = `exam-seat-announcement-${planKey}-${studentKey}`;
      records.push({
        id: announcementId,
        title: "SINAV BİLGİSİ",
        content: [
          `Sınav: ${examName}`,
          `Tarih / Saat: ${examDate} / ${examTime}`,
          `Bina: ${buildingName}${floorName ? ` / ${floorName}` : ""}`,
          `Sınav Salonu: ${roomName}`,
          `Sıra No: ${seatNum}`,
          `Görevli Öğretmen: ${supervisorName || "Belirlenmedi"}`,
        ].join("\n"),
        date: examDateRaw || examDate,
        tag: "Önemli",
        source: "exam-seating",
        announcementType: "exam-seat",
        recipientType: "student",
        recipientStudentId: studentId,
        recipientStudentNumber: String(student?.number || student?.studentNumber || ""),
        recipientStudentName: String(student?.name || student?.fullName || ""),
        classroom: String(student?.classroom || ""),
        examName,
        courseName,
        examDate: examDateRaw,
        examTime,
        buttonTitle: `${examDate} / ${examTime}`,
        buttonSubtitle: courseName,
        buildingName,
        floorName,
        roomName,
        seatNumber: seatNum,
        supervisorName,
        sessionIndex: Number(selectedBSlot?.sessionIndex || 1),
        planKey,
        publishedOnLock: true,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
    });

    const adminContent = [
      `Tarih / Saat: ${examDate} / ${examTime}`,
      ...examEntries.map((exam: any) => `${exam.gradeLevel || "Sınıf"} - ${exam.courseName}: ${exam.classrooms.join(", ") || "Şube bilgisi yok"}`),
      ...roomAssignments.map((room: any) => `${room.roomName}: ${room.teacherName}${room.floorName ? ` (${room.floorName})` : ""}`),
    ].join("\n");
    records.push({
      id: `exam-plan-admin-${planKey}`,
      title: "ORTAK SINAV PLANI",
      content: adminContent,
      date: examDateRaw || examDate,
      tag: "Önemli",
      source: "exam-plan-lock",
      announcementType: "exam-plan-admin",
      recipientType: "admin",
      examDate: examDateRaw,
      examTime,
      sessionIndex: Number(selectedBSlot?.sessionIndex || 1),
      exams: examEntries,
      roomAssignments,
      planKey,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    const teacherGroups = new Map<string, { teacherName: string; rooms: any[] }>();
    roomAssignments.forEach((room: any) => {
      const teacherName = String(room?.teacherName || "").trim();
      if (!teacherName || teacherName === "Belirlenmedi") return;
      const key = normalizeAnnouncementKey(teacherName);
      if (!key) return;
      const current = teacherGroups.get(key) || { teacherName, rooms: [] };
      current.rooms.push(room);
      teacherGroups.set(key, current);
    });

    teacherGroups.forEach((group, teacherKey) => {
      const examSummary = examEntries.map((exam: any) => `${exam.gradeLevel || "Sınıf"} ${exam.courseName}`).join(" • ");
      const assignedRooms = group.rooms.map((room: any) => room.roomName).filter(Boolean);
      records.push({
        id: `exam-plan-teacher-${planKey}-${teacherKey}`,
        title: "ORTAK SINAV GÖREVİ",
        content: [
          `Tarih / Saat: ${examDate} / ${examTime}`,
          `Görev Yeri: ${assignedRooms.join(", ")}`,
          `Oturumdaki Sınavlar: ${examSummary || "Sınav bilgisi yok"}`,
        ].join("\n"),
        date: examDateRaw || examDate,
        tag: "Önemli",
        source: "exam-plan-lock",
        announcementType: "exam-plan-teacher",
        recipientType: "teacher",
        recipientTeacherName: group.teacherName,
        recipientTeacherKey: teacherKey,
        assignedRooms,
        exams: examEntries,
        roomAssignments: group.rooms,
        examDate: examDateRaw,
        examTime,
        sessionIndex: Number(selectedBSlot?.sessionIndex || 1),
        planKey,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
    });

    let saved = 0;
    let failed = 0;
    for (let offset = 0; offset < records.length; offset += 20) {
      const chunk = records.slice(offset, offset + 20);
      const results = await Promise.allSettled(chunk.map(async (record: any) => {
        const response = await fetch(`/api/database/collections/studentAppAnnouncements/${encodeURIComponent(record.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        if (!response.ok) throw new Error("Duyuru kaydedilemedi.");
      }));
      results.forEach((item) => item.status === "fulfilled" ? saved += 1 : failed += 1);
    }
    return { saved, failed };
  };

  const clearPlacementAnnouncementsForStudents = async (_result: any) => {
    await clearLockedExamAnnouncements();
  };

  // Oturum bazlı kilit sisteminde daha önce kilitlenmiş bir plan açıldığında
  // mobil duyuru kaydı eksik kalmış olabilir. Kilitli ve yerleşimi hazır planı
  // bir kez idempotent biçimde yeniden yayınlayarak mobil tarafı kendiliğinden onar.
  useEffect(() => {
    if (!planningLocked || !selectedBSlot || !generatedSeating?.rooms?.length || isPublishingExamAnnouncements) return;
    const context = getLockedExamAnnouncementContext();
    const signature = `${context.planKey}:${String(generatedSeating?.generatedAt || generatedSeating?.distributionSignature || "ready")}`;
    if (repairedLockedAnnouncementRef.current === signature) return;
    repairedLockedAnnouncementRef.current = signature;

    void (async () => {
      try {
        const result = await publishLockedExamAnnouncements(generatedSeating);
        if (result.failed > 0) repairedLockedAnnouncementRef.current = "";
      } catch (error) {
        repairedLockedAnnouncementRef.current = "";
        console.warn("Kilitli ortak sınav mobil duyurusu otomatik yenilenemedi:", error);
      }
    })();
  }, [planningLocked, selectedBSlot, generatedSeating, isPublishingExamAnnouncements]);

  const openPlacementIssueModal = (issue: any, criteriaSource: SeatingCriteria = seatingCriteria, allowRecentRoomRepeatSource = false) => {
    setRetryCriteriaDraft({ ...criteriaSource });
    setRetryAllowRecentRoomRepeat(allowRecentRoomRepeatSource);
    setRetryOptionsSaved(false);
    setPlacementIssue(issue);
  };

  const handleGenerateSeating = async (generationOptions?: { allowRecentRoomRepeat?: boolean; criteriaOverride?: SeatingCriteria }) => {
    if (isGeneratingSeating) return false;
    const allowRecentRoomRepeat = Boolean(generationOptions?.allowRecentRoomRepeat);
    const requestedCriteria = generationOptions?.criteriaOverride || seatingCriteria;

    if (!selectedBSlot) {
      alert("Lütfen önce sınav oturumunu seçiniz.");
      return false;
    }
    if (activeRoomsList.length === 0) {
      openPlacementIssueModal({
        title: "Yerleştirme Başlatılamadı",
        unseatedCount: examStudents.length,
        reasons: ["Aktif sınav salonu seçilmedi."],
        recommendations: ["Sınav Salonları bölümünden en az bir salon seçip seçimleri kaydediniz."],
        students: examStudents,
      }, requestedCriteria);
      return false;
    }
    if (examStudents.length === 0) {
      alert("Bu oturumda sınava girecek öğrenci bulunmuyor.");
      return false;
    }
    if (totalRoomsCapacity < examStudents.length) {
      const missingCapacity = examStudents.length - totalRoomsCapacity;
      openPlacementIssueModal({
        title: "Salon Kapasitesi Yetersiz",
        unseatedCount: missingCapacity,
        reasons: [`${examStudents.length} öğrenci için seçili salonların toplam kapasitesi ${totalRoomsCapacity}. En az ${missingCapacity} kişilik ek kapasite gerekiyor.`],
        recommendations: ["Sınav Salonları bölümünden ek salon seçiniz veya daha yüksek kapasiteli salonları işaretleyiniz."],
        students: examStudents.slice(totalRoomsCapacity),
        capacityOnly: true,
      }, requestedCriteria);
      return false;
    }

    setIsGeneratingSeating(true);
    setPlacementProgress({ current: 0, total: 1, stage: "Yerleşim hazırlanıyor..." });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const criteria: SeatingCriteria = {
      ...requestedCriteria,
      avoidSameExamCluster: false,
      minSameBranchDistance: false,
      showSupervisorDetails: false,
      alternateBooklets: false,
      alternateBranches: false,
      avoidSequentialOrder: false,
      reshuffleEachExam: false,
      protectSpecialNeeds: false,
      objectiveOnly: true,
    };
    const normalizeBranch = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const normalizeHistoryRoom = (value: unknown) => String(value || "").replace(/[\s\-\/]/g, "").toLocaleUpperCase("tr-TR");
    const recentRoomHistory = new Map<string, Set<string>>();
    const allRoomHistory = new Map<string, Map<string, number>>();
    const currentExamDateMs = (() => {
      const value = String(selectedBSlot?.dateStr || "").trim();
      const ms = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
      return Number.isFinite(ms) ? ms : NaN;
    })();

    try {
      setPlacementProgress({ current: 0, total: 1, stage: "Geçmiş sınav salonları kontrol ediliyor..." });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      const [seatingRecords, planningStates] = await Promise.all([
        seatingPlanRepository.findAll(),
        planningStateRepository.findAll(),
      ]);
      const stateByExam = new Map<string, any>();
      planningStates.forEach((state: any) => {
        stateByExam.set(`${state.selectedTerm}__${state.selectedExamNo}`, state);
      });

      const resolveRecordDate = (record: any) => {
        const state = stateByExam.get(`${record.selectedTerm}__${record.selectedExamNo}`);
        const plans = Array.isArray(state?.savedPlans) ? state.savedPlans : [];
        for (const plan of plans) {
          const slot = (Array.isArray(plan?.slots) ? plan.slots : []).find((item: any) => Number(item?.sessionIndex) === Number(record?.sessionIndex));
          if (slot?.dateStr) return String(slot.dateStr);
        }
        return String(record?.config?.examDate || record?.config?.generatedSeating?.examDate || record?.config?.dateStr || "");
      };

      seatingRecords.forEach((record: any) => {
        if (
          String(record?.selectedTerm) === String(selectedTerm) &&
          String(record?.selectedExamNo) === String(selectedExamNo) &&
          Number(record?.sessionIndex) === Number(selectedBSlot?.sessionIndex || 1)
        ) return;

        const recordDate = resolveRecordDate(record);
        const recordDateMs = Date.parse(recordDate.length === 10 ? `${recordDate}T12:00:00` : recordDate);
        const within15Days = Number.isFinite(currentExamDateMs) && Number.isFinite(recordDateMs) &&
          Math.abs(currentExamDateMs - recordDateMs) <= 15 * 24 * 60 * 60 * 1000;
        const rooms = record?.config?.generatedSeating?.rooms;
        if (!Array.isArray(rooms)) return;
        rooms.forEach((historyRoom: any) => {
          const roomKey = normalizeHistoryRoom(historyRoom?.name);
          if (!roomKey) return;
          (historyRoom?.desks || []).forEach((desk: any) => {
            [desk?.left, desk?.right].filter(Boolean).forEach((historyStudent: any) => {
              const studentId = String(historyStudent?.id || historyStudent?.studentId || "").trim();
              if (!studentId) return;
              const roomCounts = allRoomHistory.get(studentId) || new Map<string, number>();
              roomCounts.set(roomKey, (roomCounts.get(roomKey) || 0) + 1);
              allRoomHistory.set(studentId, roomCounts);
              if (within15Days) {
                const recentRooms = recentRoomHistory.get(studentId) || new Set<string>();
                recentRooms.add(roomKey);
                recentRoomHistory.set(studentId, recentRooms);
              }
            });
          });
        });
      });
    } catch (historyError) {
      console.warn("Geçmiş sınav salonu yerleşimleri okunamadı:", historyError);
    }
    const sameBranch = (a: any, b: any) => normalizeBranch(a?.classroom) !== "" && normalizeBranch(a?.classroom) === normalizeBranch(b?.classroom);
    const normalizeExamPart = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
    const examGroupKey = (student: any) => {
      const grade = normalizeExamPart(student?.examGrade || String(student?.classroom || "").match(/\d{1,2}/)?.[0] || "");
      const course = normalizeExamPart(student?.examCourse || "");
      return grade && course ? `${grade}__${course}` : "";
    };
    const sameExamGroup = (a: any, b: any) => {
      const aKey = examGroupKey(a);
      return aKey !== "" && aKey === examGroupKey(b);
    };
    const gradeLevelKey = (student: any) => {
      const raw = String(student?.examGrade || student?.classroom || "").trim();
      return raw.match(/\d{1,2}/)?.[0] || normalizeExamPart(raw);
    };
    const sameGradeLevel = (a: any, b: any) => {
      const aKey = gradeLevelKey(a);
      return aKey !== "" && aKey === gradeLevelKey(b);
    };
    const hasSpecialNeed = (student: any) => Boolean(
      student?.specialNeeds || student?.specialNeed || student?.examAccommodation || student?.accessibilityNeed ||
      student?.tedbir || student?.ozelGereksinim || student?.özelGereksinim || student?.physicalAccessNeed
    );

    const parseBookletTypes = (value: unknown) => {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim().toUpperCase()).filter((item) => ["A", "B", "C", "D"].includes(item));
      }
      return String(value || "")
        .toUpperCase()
        .split(/[^A-D]+/)
        .map((item) => item.trim())
        .filter((item) => ["A", "B", "C", "D"].includes(item));
    };

    const getBookletTypesForStudent = (student: any) => {
      const studentTypes = parseBookletTypes(student?.bookletTypes || student?.bookletType || student?.booklet);
      if (studentTypes.length > 0) return Array.from(new Set(studentTypes));
      const studentClass = normalizeBranch(student?.classroom);
      const matchingExam = selectedBSlot?.exams?.find((exam: any) => {
        if (student?.examCourse && exam?.courseName === student.examCourse) return true;
        return exam?.classrooms?.some((cls: string) => matchesExamClassroom(student, cls));
      });
      const examTypes = parseBookletTypes(matchingExam?.bookletTypes || matchingExam?.bookletType || matchingExam?.booklets);
      return examTypes.length > 0 ? Array.from(new Set(examTypes)) : ["A"];
    };

    const getSeatBookletType = (student: any, seat: any) => {
      const types = getBookletTypesForStudent(student);
      if (!criteria.alternateBooklets || types.length <= 1) return types[0] || "A";
      const index = types.length >= 4
        ? Math.abs((seat.r * 2 + seat.x) % types.length)
        : Math.abs((seat.r + seat.x) % types.length);
      return types[index] || types[0] || "A";
    };

    const manualAssignedSet = new Set<string>();
    const fixedAssignmentsResolved: Array<{ assignment: { studentId: string; roomName: string; deskId: number; side: 'left' | 'right' }; student: any }> = [];
    Object.values(fixedSeatAssignments || {}).forEach((assignment) => {
      const stdId = String(assignment?.studentId || "");
      // Eski elle yerleştirme kayıtları, bu oturumda sınavı olmayan grupların
      // öğrencilerini yeniden sınava dahil edemez.
      const rawStudent = examStudents.find((s) => String(s.id) === stdId);
      if (!rawStudent) return;
      const matchExam = selectedBSlot?.exams?.find((ex: any) => {
        const sClass = normalizeBranch(rawStudent.classroom);
        return ex.classrooms?.some((c: string) => matchesExamClassroom(rawStudent, c));
      });
      const student = {
        ...rawStudent,
        examCourse: rawStudent.examCourse || (matchExam ? matchExam.courseName : "Ortak Sınav"),
        examGrade: rawStudent.examGrade || (matchExam ? matchExam.gradeLevel : (rawStudent.classroom ? `${rawStudent.classroom.replace(/\D/g, "")}. Sınıf` : "")),
      };
      manualAssignedSet.add(stdId);
      fixedAssignmentsResolved.push({ assignment, student });
    });

    const manualAssignmentsByRoom: Record<string, any[]> = {};
    if (manualPlacementActive) {
      Object.entries(manualStudentAssignments).forEach(([stdId, roomName]) => {
        if (manualAssignedSet.has(String(stdId))) return;
        const rName = roomName as string;
        const rawStudent = examStudents.find((s) => String(s.id) === String(stdId));
        if (!rawStudent) return;
        const matchExam = selectedBSlot?.exams?.find((ex: any) => {
          const sClass = normalizeBranch(rawStudent.classroom);
          return ex.classrooms?.some((c: string) => matchesExamClassroom(rawStudent, c));
        });
        const student = {
          ...rawStudent,
          examCourse: rawStudent.examCourse || (matchExam ? matchExam.courseName : "Ortak Sınav"),
          examGrade: rawStudent.examGrade || (matchExam ? matchExam.gradeLevel : (rawStudent.classroom ? `${rawStudent.classroom.replace(/\D/g, "")}. Sınıf` : "")),
        };
        manualAssignedSet.add(String(stdId));
        (manualAssignmentsByRoom[rName] ||= []).push(student);
      });
    }

    const autoStudents = examStudents.filter((student) => !manualAssignedSet.has(student.id));
    const totalCapacity = activeRoomsList.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
    const globalBranchTotals = examStudents.reduce((acc: Record<string, number>, student: any) => {
      const key = normalizeBranch(student.classroom) || "BILINMIYOR";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Otomatik dağıtımda bütün seçili salonları aynı anda kullanmak yerine önce
    // gerekli EN AZ salon sayısını bul. Aynı salon sayısında ise toplam kapasitesi
    // öğrenci sayısına en yakın kombinasyonu seç; böylece açılan salonlar olabildiğince dolar.
    const forcedRoomNames = new Set<string>([
      ...fixedAssignmentsResolved.map(({ assignment }) => String(assignment.roomName || "")),
      ...Object.keys(manualAssignmentsByRoom),
    ].filter(Boolean));
    const roomCapacityOf = (roomName: string) => Number(activeRoomsList.find((room) => room.name === roomName)?.capacity || 0);
    const forcedRooms = activeRoomsList.filter((room) => forcedRoomNames.has(room.name));
    const optionalRooms = activeRoomsList.filter((room) => !forcedRoomNames.has(room.name));
    const forcedCapacity = forcedRooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
    const remainingNeed = Math.max(0, examStudents.length - forcedCapacity);

    const findCompactOptionalRoomNames = () => {
      if (remainingNeed <= 0) return [] as string[];
      const sortedCaps = optionalRooms.map((room) => Number(room.capacity || 0)).sort((a, b) => b - a);
      let minCount = 0;
      let possibleCapacity = 0;
      while (minCount < sortedCaps.length && possibleCapacity < remainingNeed) {
        possibleCapacity += sortedCaps[minCount];
        minCount += 1;
      }
      if (possibleCapacity < remainingNeed) return optionalRooms.map((room) => room.name);

      // Tam minCount adet salonla, ihtiyacı karşılayan en küçük kapasite toplamını bul.
      let states = new Map<string, { sum: number; names: string[] }>();
      states.set('0__0', { sum: 0, names: [] });
      optionalRooms.forEach((room) => {
        const cap = Number(room.capacity || 0);
        const snapshot = Array.from(states.values());
        snapshot.forEach((state) => {
          if (state.names.length >= minCount) return;
          const names = [...state.names, room.name];
          const sum = state.sum + cap;
          const key = `${names.length}__${sum}`;
          if (!states.has(key)) states.set(key, { sum, names });
        });
      });
      const candidates = Array.from(states.values())
        .filter((state) => state.names.length === minCount && state.sum >= remainingNeed)
        .sort((a, b) => a.sum - b.sum);
      return candidates[0]?.names || optionalRooms
        .slice()
        .sort((a, b) => Number(b.capacity || 0) - Number(a.capacity || 0))
        .slice(0, minCount)
        .map((room) => room.name);
    };

    const compactOptionalRoomNames = findCompactOptionalRoomNames();
    const baseCompactRoomNames = new Set<string>([...forcedRooms.map((room) => room.name), ...compactOptionalRoomNames]);
    const extraRoomCandidates = optionalRooms
      .filter((room) => !baseCompactRoomNames.has(room.name))
      .slice()
      .sort((a, b) => Number(b.capacity || 0) - Number(a.capacity || 0));

    const roomNamesForAttempt = (extraRoomCount = 0) => {
      const names = new Set(baseCompactRoomNames);
      extraRoomCandidates.slice(0, Math.max(0, extraRoomCount)).forEach((room) => names.add(room.name));
      return names;
    };

    const makeRoomsStructure = (allowedRoomNames: Set<string>) => {
      const roomsStructure: Record<string, { name: string; buildingName: string; floorName: string; deskColumns: 3 | 4; deskRows: number; desks: any[] }> = {};
      activeRoomsList.filter((room) => allowedRoomNames.has(room.name)).forEach((room) => {
        const cols: 3 | 4 = room.deskColumns === 3 ? 3 : 4;
        const rows = Math.max(1, Number(room.deskRows || 1));
        const slotCount = cols * rows;
        let activeSeq = 0;
        const desks = Array.from({ length: slotCount }, (_, id) => {
          const active = room.activeDesks?.[id] !== false;
          const desk = {
            id,
            r: Math.floor(id / cols),
            c: id % cols,
            active,
            left: null,
            right: null,
            seq: active ? activeSeq++ : -1,
            seatNumLeft: null as number | null,
            seatNumRight: null as number | null,
          };
          return desk;
        });

        // PDF ile birebir aynı S düzeni: yalnız aktif sütun/satırlar numara alır.
        // 1. aktif sütun öğretmen tarafindan arkaya, 2. sütun arkadan öne,
        // 3. sütun tekrar önden arkaya devam eder. Her sırada iki öğrenci yeri vardır.
        const activeColumns = Array.from({ length: cols }, (_, colIndex) => colIndex)
          .filter((colIndex) => Array.from({ length: rows }, (_, rowIndex) => room.activeDesks?.[rowIndex * cols + colIndex] !== false).some(Boolean));
        const activeRows = Array.from({ length: rows }, (_, rowIndex) => rowIndex)
          .filter((rowIndex) => activeColumns.some((colIndex) => room.activeDesks?.[rowIndex * cols + colIndex] !== false));
        let nextSeatNumber = 1;
        activeColumns.forEach((physicalColIndex, visibleColIndex) => {
          const rowOrder = [...activeRows];
          if (visibleColIndex % 2 === 1) rowOrder.reverse();
          rowOrder.forEach((physicalRowIndex) => {
            const desk = desks[physicalRowIndex * cols + physicalColIndex];
            if (!desk || desk.active === false) return;
            desk.seatNumLeft = nextSeatNumber++;
            desk.seatNumRight = nextSeatNumber++;
          });
        });
        roomsStructure[room.name] = {
          name: room.name,
          buildingName: room.buildingName,
          floorName: room.floorName,
          deskColumns: cols,
          deskRows: rows,
          desks,
        };
      });
      return roomsStructure;
    };

    const shuffle = <T,>(items: T[]) => {
      const next = [...items];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    };

    const branchRoundRobin = (items: any[], randomize: boolean) => {
      if (!criteria.alternateBranches) {
        return (randomize || criteria.avoidSequentialOrder) ? shuffle(items) : [...items];
      }
      const groups: Record<string, any[]> = {};
      items.forEach((student) => {
        const key = normalizeBranch(student.classroom) || "BILINMIYOR";
        (groups[key] ||= []).push(student);
      });
      let branches = Object.keys(groups);
      if (randomize) branches = shuffle(branches);
      branches.forEach((branch) => {
        if (randomize || criteria.avoidSequentialOrder) groups[branch] = shuffle(groups[branch]);
      });
      const result: any[] = [];
      let hasMore = true;
      while (hasMore) {
        hasMore = false;
        branches.forEach((branch) => {
          const next = groups[branch].shift();
          if (next) {
            result.push(next);
            hasMore = true;
          }
        });
      }
      return result;
    };

    const gradeRoundRobin = (items: any[]) => {
      const groups: Record<string, any[]> = {};
      items.forEach((student) => {
        const key = gradeLevelKey(student) || "BILINMIYOR";
        (groups[key] ||= []).push(student);
      });
      let levels = shuffle(Object.keys(groups));
      levels.forEach((level) => { groups[level] = shuffle(groups[level]); });
      const result: any[] = [];
      while (levels.some((level) => groups[level].length > 0)) {
        levels.forEach((level) => {
          const next = groups[level].shift();
          if (next) result.push(next);
        });
        levels = levels.filter((level) => groups[level].length > 0);
      }
      return result;
    };

    type PlacedSeat = { roomName: string; desk: any; side: "left" | "right"; r: number; x: number; student: any; bookletType: string };
    const attemptPlacement = (attemptIndex: number, extraRoomCount = 0) => {
      const allowedRoomNames = roomNamesForAttempt(extraRoomCount);
      const roomsStructure = makeRoomsStructure(allowedRoomNames);
      const roomFillOrder = Array.from(allowedRoomNames)
        .map((name) => ({ name, capacity: roomCapacityOf(name) }))
        .sort((a, b) => b.capacity - a.capacity || a.name.localeCompare(b.name, 'tr'))
        .map((room) => room.name);
      const roomFillRank = new Map(roomFillOrder.map((name, index) => [name, index]));
      const placedByRoom: Record<string, PlacedSeat[]> = {};
      const roomBranchCounts: Record<string, Record<string, number>> = {};
      const roomTotals: Record<string, number> = {};
      Object.keys(roomsStructure).forEach((roomName) => {
        placedByRoom[roomName] = [];
        roomBranchCounts[roomName] = {};
        roomTotals[roomName] = 0;
      });

      const getSeats = (roomName?: string) => {
        const roomEntries = roomName ? [[roomName, roomsStructure[roomName]]] as const : Object.entries(roomsStructure);
        const seats: any[] = [];
        roomEntries.forEach(([name, room]) => {
          if (!room) return;
          const roomCapacity = Number(activeRoomsList.find((item) => item.name === name)?.capacity || 0);
          room.desks.forEach((desk: any) => {
            if (desk.active === false) return;
            if (!desk.left && Number(desk.seatNumLeft || 0) <= roomCapacity) {
              seats.push({ roomName: name, desk, side: "left" as const, r: desk.r, x: desk.c * 2 });
            }
            if (!desk.right && Number(desk.seatNumRight || 0) <= roomCapacity) {
              seats.push({ roomName: name, desk, side: "right" as const, r: desk.r, x: desk.c * 2 + 1 });
            }
          });
        });
        return seats;
      };

      const preferNeverUsedInLast15Days = (student: any, candidates: any[]) => {
        if (allowRecentRoomRepeat) return candidates;
        const studentId = String(student?.id || student?.studentId || "").trim();
        const recentRooms = studentId ? recentRoomHistory.get(studentId) : undefined;
        if (!recentRooms || recentRooms.size === 0) return candidates;
        return candidates.filter((seat) => !recentRooms.has(normalizeHistoryRoom(seat.roomName)));
      };

      const scoreSeat = (student: any, seat: any) => {
        let score = Math.random() * 0.25;
        const branchKey = normalizeBranch(student.classroom) || "BILINMIYOR";
        const bookletType = getSeatBookletType(student, seat);
        const placed = placedByRoom[seat.roomName] || [];
        const studentId = String(student?.id || student?.studentId || "").trim();
        const historyRoomKey = normalizeHistoryRoom(seat.roomName);
        if (studentId && recentRoomHistory.get(studentId)?.has(historyRoomKey)) score += 5000;
        const historicalUseCount = studentId ? Number(allRoomHistory.get(studentId)?.get(historyRoomKey) || 0) : 0;
        if (historicalUseCount > 0) score += historicalUseCount * 250;

        // Minimum sayıda salon kullanıldıktan sonra salonları sırayla doldur.
        // İlk salonlarda uygun yer varken sonraki salonlara gereksiz yayılmayı güçlü biçimde engeller.
        const fillRank = Number(roomFillRank.get(seat.roomName) || 0);
        score += fillRank * 1200;

        placed.forEach((other) => {
          const dr = Math.abs(seat.r - other.r);
          const dx = Math.abs(seat.x - other.x);
          if (dr === 0 && dx === 0) return;
          const isSide = dr === 0 && dx === 1;
          const isFrontBack = dr === 1 && dx === 0;
          const isDiagonal = dr === 1 && dx === 1;
          const isEightNeighbor = isSide || isFrontBack || isDiagonal;

          if (sameExamGroup(student, other.student)) {
            if (criteria.avoidSameBranchSide && isSide) score += 100;
            if (criteria.avoidSameBranchDiagonal && isDiagonal) score += 50;
          }
          if (criteria.avoidSameBranchFrontBack && isFrontBack && sameGradeLevel(student, other.student)) score += 500;
          if (sameBranch(student, other.student)) {
            if (criteria.alternateBranches && isSide) score += 35;
            if (criteria.minSameBranchDistance && Math.max(dr, dx) <= 2) score += Math.max(10, 40 - Math.max(dr, dx) * 12);
          }
          if (criteria.avoidSameExamCluster && isEightNeighbor && sameExamGroup(student, other.student)) score += 35;
          if (criteria.alternateBooklets && isSide && bookletType === other.bookletType && getBookletTypesForStudent(student).length > 1) score += 100;
          if (criteria.distributeEmptySeats && totalCapacity > examStudents.length && Math.max(dr, dx) <= 1) score += 12;
        });

        if (criteria.balanceBranchesAcrossRooms) {
          const roomCapacity = Number(activeRoomsList.find((room) => room.name === seat.roomName)?.capacity || 0);
          const ideal = totalCapacity > 0 ? (globalBranchTotals[branchKey] || 0) * (roomCapacity / totalCapacity) : 0;
          const nextCount = (roomBranchCounts[seat.roomName]?.[branchKey] || 0) + 1;
          if (nextCount > ideal + 1) score += (nextCount - ideal - 1) * 30;
        }

        if (criteria.protectSpecialNeeds && hasSpecialNeed(student)) {
          score += seat.r * 18;
          const deskCol = seat.desk.c;
          const roomColumnCount = Number(roomsStructure[seat.roomName]?.deskColumns || 4);
          const isAisle = deskCol === 0 || deskCol === roomColumnCount - 1;
          if (isAisle) score -= 25;
        }

        return score;
      };

      // Tikli "aynı sınav" komşuluk kriterleri kesin kuraldır.
      // Uygun başka koltuk aranır; kriteri bozacak koltuk aday listesinden çıkarılır.
      const violatesHardSameExamCriteria = (student: any, seat: any) => {
        const placed = placedByRoom[seat.roomName] || [];
        return placed.some((other) => {
          const dr = Math.abs(seat.r - other.r);
          const dx = Math.abs(seat.x - other.x);
          const isSide = dr === 0 && dx === 1;
          const isDiagonal = dr === 1 && dx === 1;
          const isPhysicalFrontBack = dr === 1 && dx === 0;
          if (sameExamGroup(student, other.student)) {
            if (criteria.avoidSameBranchSide && isSide) return true;
            if (criteria.avoidSameBranchDiagonal && isDiagonal) return true;
          }
          // Arka arkaya kuralı ders adına değil sınıf seviyesine göre kesin uygulanır.
          if (criteria.avoidSameBranchFrontBack && isPhysicalFrontBack && sameGradeLevel(student, other.student)) return true;
          return false;
        });
      };

      const filterHardSameExamCandidates = (student: any, candidates: any[]) =>
        candidates.filter((seat) => !violatesHardSameExamCriteria(student, seat));

      let runningPenalty = 0;
      const placeAtSeat = (student: any, seat: any) => {
        const bookletType = getSeatBookletType(student, seat);
        const enriched = { ...student, bookletType };
        seat.desk[seat.side] = enriched;
        const placedSeat: PlacedSeat = { ...seat, student: enriched, bookletType };
        placedByRoom[seat.roomName].push(placedSeat);
        const branchKey = normalizeBranch(student.classroom) || "BILINMIYOR";
        roomBranchCounts[seat.roomName][branchKey] = (roomBranchCounts[seat.roomName][branchKey] || 0) + 1;
        roomTotals[seat.roomName] += 1;
      };

      const manualUnseatedStudents: any[] = [];
      const unseatedDetails: Array<{ student: any; reason: string }> = [];

      // Yerleşim Bilgileri ekranında belirli hücrelere sabitlenen öğrenciler
      // her otomatik dağıtım denemesinde önce aynı fiziksel koltuğa yerleştirilir.
      fixedAssignmentsResolved.forEach(({ assignment, student }) => {
        const room = roomsStructure[assignment.roomName];
        const desk = room?.desks?.find((item: any) => Number(item.id) === Number(assignment.deskId));
        const side = assignment.side === 'right' ? 'right' : 'left';
        const roomCapacity = Number(activeRoomsList.find((item) => item.name === assignment.roomName)?.capacity || 0);
        const seatNumber = Number(side === 'left' ? desk?.seatNumLeft : desk?.seatNumRight);
        if (!room || !desk || desk.active === false || !seatNumber || seatNumber > roomCapacity || desk[side]) {
          manualUnseatedStudents.push(student);
          unseatedDetails.push({ student, reason: "Elle sabitlenen koltuk artık kullanılabilir değil veya salon kapasitesinin dışında." });
          return;
        }
        const seat = {
          roomName: assignment.roomName,
          desk,
          side,
          r: Number(desk.r || 0),
          x: Number(desk.c || 0) * 2 + (side === 'right' ? 1 : 0),
        };
        runningPenalty += scoreSeat(student, seat);
        placeAtSeat(student, seat);
      });

      Object.entries(manualAssignmentsByRoom).forEach(([roomName, assigned]) => {
        assigned.forEach((student) => {
          const allRoomCandidates = getSeats(roomName);
          const candidates = filterHardSameExamCandidates(student, allRoomCandidates);
          if (candidates.length === 0) {
            manualUnseatedStudents.push(student);
            unseatedDetails.push({
              student,
              reason: allRoomCandidates.length === 0
                ? "Elle seçilen salonda boş ve kullanılabilir koltuk kalmadı."
                : "Elle seçilen salonda sınıf seviyesi / sınav komşuluk kriterlerini bozmayan uygun koltuk kalmadı.",
            });
            return;
          }
          let bestSeat = candidates[0];
          let bestScore = Number.POSITIVE_INFINITY;
          candidates.forEach((seat) => {
            const score = scoreSeat(student, seat);
            if (score < bestScore) {
              bestScore = score;
              bestSeat = seat;
            }
          });
          runningPenalty += bestScore;
          placeAtSeat(student, bestSeat);
        });
      });

      const orderedStudents = gradeRoundRobin(branchRoundRobin(autoStudents, true));
      const unseatedStudents: any[] = [...manualUnseatedStudents];
      orderedStudents.forEach((student) => {
        const allCandidates = getSeats();
        const historyCandidates = preferNeverUsedInLast15Days(student, allCandidates);
        const candidates = filterHardSameExamCandidates(student, historyCandidates);
        if (candidates.length === 0) {
          unseatedStudents.push(student);
          if (allCandidates.length === 0) {
            unseatedDetails.push({ student, reason: "Seçili salonlarda boş koltuk kalmadı." });
          } else if (historyCandidates.length === 0) {
            unseatedDetails.push({ student, reason: "15 gün içinde daha önce bulunduğu salonların dışında uygun boş salon kalmadı." });
          } else {
            unseatedDetails.push({ student, reason: "Sınıf seviyesi / sınav komşuluk kriterlerini bozmayan uygun koltuk kalmadı." });
          }
          return;
        }
        let bestSeat = candidates[0];
        let bestScore = Number.POSITIVE_INFINITY;
        candidates.forEach((seat) => {
          const score = scoreSeat(student, seat);
          if (score < bestScore) {
            bestScore = score;
            bestSeat = seat;
          }
        });
        runningPenalty += bestScore;
        placeAtSeat(student, bestSeat);
      });

      return { roomsStructure, placedByRoom, roomBranchCounts, roomTotals, unseatedStudents, unseatedDetails, runningPenalty };
    };

    const evaluatePlacement = (attempt: ReturnType<typeof attemptPlacement>) => {
      const violations = {
        sameExamSide: 0,
        sameExamFrontBack: 0,
        sameExamDiagonal: 0,
        sameExamNeighbor: 0,
        sameBookletSide: 0,
        sameBranchDistance: 0,
        branchConcentration: 0,
      };
      let penalty = 0;
      Object.entries(attempt.placedByRoom).forEach(([roomName, seats]) => {
        for (let i = 0; i < seats.length; i++) {
          for (let j = i + 1; j < seats.length; j++) {
            const a = seats[i];
            const b = seats[j];
            const dr = Math.abs(a.r - b.r);
            const dx = Math.abs(a.x - b.x);
            const isSide = dr === 0 && dx === 1;
            const isFrontBack = dr === 1 && dx === 0;
            const isDiagonal = dr === 1 && dx === 1;
            const isEightNeighbor = isSide || isFrontBack || isDiagonal;
            if (sameExamGroup(a.student, b.student)) {
              if (criteria.avoidSameBranchSide && isSide) { violations.sameExamSide++; penalty += 100; }
              if (criteria.avoidSameBranchDiagonal && isDiagonal) { violations.sameExamDiagonal++; penalty += 50; }
            }
            if (criteria.avoidSameBranchFrontBack && isFrontBack && sameGradeLevel(a.student, b.student)) { violations.sameExamFrontBack++; penalty += 500; }
            if (sameBranch(a.student, b.student) && criteria.minSameBranchDistance && Math.max(dr, dx) <= 2) { violations.sameBranchDistance++; penalty += 25; }
            if (criteria.avoidSameExamCluster && isEightNeighbor && sameExamGroup(a.student, b.student)) { violations.sameExamNeighbor++; penalty += 35; }
            if (criteria.alternateBooklets && isSide && a.bookletType === b.bookletType && getBookletTypesForStudent(a.student).length > 1) { violations.sameBookletSide++; penalty += 100; }
          }
        }
        const roomTotal = attempt.roomTotals[roomName] || 0;
        if (criteria.balanceBranchesAcrossRooms && roomTotal >= 4) {
          Object.values(attempt.roomBranchCounts[roomName] || {}).forEach((count) => {
            const maxReasonable = Math.ceil(roomTotal * 0.6);
            if (count > maxReasonable) {
              violations.branchConcentration += count - maxReasonable;
              penalty += (count - maxReasonable) * 30;
            }
          });
        }
      });
      return { violations, penalty };
    };

    const attemptsPerRoomPlan = Math.max(10, Math.min(18, Math.ceil(examStudents.length / 40) + 10));
    const fallbackAttemptsPerRoomPlan = Math.max(4, Math.min(7, Math.ceil(attemptsPerRoomPlan / 2)));
    const maxExtraRooms = Math.max(0, activeRoomsList.length - baseCompactRoomNames.size);
    let best: any = null;
    let repeatedFallback: any = null;
    let progressCurrent = 0;
    const totalProgress = attemptsPerRoomPlan + maxExtraRooms * fallbackAttemptsPerRoomPlan;
    setPlacementProgress({ current: 0, total: totalProgress, stage: `Kompakt dağıtım deneniyor (0/${totalProgress})` });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Önce minimum salon sayısıyla çöz. Ancak bu salonlarda kesin kriterler nedeniyle
    // tüm öğrenciler yerleşemiyorsa bir salon daha açıp tekrar dene. Tam çözüm bulunduğu
    // anda daha fazla salon açma.
    for (let extraRoomCount = 0; extraRoomCount <= maxExtraRooms; extraRoomCount++) {
      let fullCandidateFound = false;
      const attemptsThisRoomPlan = extraRoomCount === 0 ? attemptsPerRoomPlan : fallbackAttemptsPerRoomPlan;
      for (let attemptIndex = 0; attemptIndex < attemptsThisRoomPlan; attemptIndex++) {
        progressCurrent += 1;
        const activeRoomCount = Math.min(activeRoomsList.length, baseCompactRoomNames.size + extraRoomCount);
        setPlacementProgress({ current: progressCurrent, total: totalProgress, stage: `${activeRoomCount} salonla farklı kombinasyon deneniyor (${attemptIndex + 1}/${attemptsThisRoomPlan})` });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const attempt = attemptPlacement(attemptIndex, extraRoomCount);
        const evaluation = evaluatePlacement(attempt);
        const usedRooms = Object.values(attempt.roomTotals).filter((count) => Number(count) > 0).length;
        const score = evaluation.penalty + attempt.unseatedStudents.length * 100000 + usedRooms * 10000;
        const attemptRooms = Object.values(attempt.roomsStructure).map((room: any) => ({ ...room, desks: [...room.desks].sort((a: any, b: any) => a.id - b.id) }));
        const signature = buildDistributionSignature(attemptRooms);
        const candidate = { ...attempt, ...evaluation, score, signature, usedRooms };
        const isFullPlacement = attempt.unseatedStudents.length === 0;
        if (isFullPlacement) fullCandidateFound = true;
        if (signature && signature === lastDistributionSignatureRef.current) {
          if (!repeatedFallback || score < repeatedFallback.score) repeatedFallback = candidate;
          continue;
        }
        if (!best || score < best.score) best = candidate;
        if (isFullPlacement && evaluation.penalty === 0) break;
      }
      if (fullCandidateFound) break;
    }
    if (repeatedFallback && (!best || repeatedFallback.score < best.score)) best = repeatedFallback;

    const rooms = Object.values(best.roomsStructure)
      .filter((room: any) => Number(best.roomTotals?.[room.name] || 0) > 0)
      .map((room: any) => ({
        ...room,
        desks: [...room.desks].sort((a: any, b: any) => a.id - b.id),
      }));

    const relaxSuggestions: string[] = [];
    if (best.violations.sameExamDiagonal > 0 && criteria.avoidSameBranchDiagonal) relaxSuggestions.push("Aynı sınav öğrencilerinin çapraz oturmaması");
    if (best.violations.branchConcentration > 0 && criteria.balanceBranchesAcrossRooms) relaxSuggestions.push("Şubelerin salonlara dengeli dağıtılması");
    if (best.violations.sameExamNeighbor > 0 && criteria.avoidSameExamCluster) relaxSuggestions.push("Aynı ders/sınav grubunun kümelenmemesi");
    if (best.violations.sameExamFrontBack > 0 && criteria.avoidSameBranchFrontBack) relaxSuggestions.push("Aynı sınıf seviyesi öğrencilerinin arka arkaya oturmaması");
    if (best.violations.sameBookletSide > 0 && criteria.alternateBooklets) relaxSuggestions.push("Komşu kitapçıkların farklı olması");
    if (best.violations.sameExamSide > 0 && criteria.avoidSameBranchSide) relaxSuggestions.push("Aynı sınav öğrencilerinin yan yana oturmaması");

    const result = {
      rooms,
      unseatedCount: best.unseatedStudents.length,
      unseatedStudents: best.unseatedStudents,
      penaltyScore: best.penalty,
      criteriaViolations: best.violations,
      relaxSuggestions,
      generatedAt: new Date().toLocaleTimeString("tr-TR") + " " + new Date().toLocaleDateString("tr-TR"),
      examDate: String(selectedBSlot?.dateStr || ""),
      sessionIndex: Number(selectedBSlot?.sessionIndex || 1),
      distributionSignature: String(best?.signature || ""),
    };

    setGeneratedSeating(result);

    if (best.unseatedStudents.length > 0) {
      await saveSeatingConfig({ generatedSeating: result, seatingCriteria: criteria, examDate: String(selectedBSlot?.dateStr || "") });
      const reasonCounts = new Map<string, number>();
      (best.unseatedDetails || []).forEach((detail: any) => {
        const reason = String(detail?.reason || "Uygun koltuk bulunamadı.");
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      });
      const reasons = Array.from(reasonCounts.entries()).map(([reason, count]) => `${count} öğrenci: ${reason}`);
      const recommendations: string[] = [];
      if ((best.unseatedDetails || []).some((detail: any) => String(detail?.reason || "").includes("15 gün"))) {
        recommendations.push("15 günlük aynı salon tekrar yasağını yalnız bu dağıtım için gevşetebilirsiniz.");
      }
      if ((best.unseatedDetails || []).some((detail: any) => String(detail?.reason || "").includes("sabit"))) {
        recommendations.push("Yerleşim Bilgileri ekranındaki geçersiz sabit öğrenci yerlerini kaldırabilir veya başka koltuğa sabitleyebilirsiniz.");
      }
      if ((best.unseatedDetails || []).some((detail: any) => String(detail?.reason || "").includes("boş koltuk"))) {
        recommendations.push("Sınav Salonları bölümünden ek salon/kapasite seçebilirsiniz.");
      }
      if ((best.unseatedDetails || []).some((detail: any) => String(detail?.reason || "").includes("komşuluk kriterlerini"))) {
        recommendations.push("Yerleşim Kriterleri bölümünde sınıf seviyesi / sınav komşuluk kurallarından gerekli olanların tikini kaldırıp yeniden dağıtabilirsiniz.");
      }
      if (relaxSuggestions.length > 0) {
        recommendations.push("Komşuluk ve dağılım kriterlerinden gerekli olanların tikini kaldırarak motoru daha esnek çalıştırabilirsiniz.");
      }
      openPlacementIssueModal({
        title: "Yerleştirme Tamamlanamadı",
        unseatedCount: best.unseatedStudents.length,
        reasons: reasons.length ? reasons : [`${best.unseatedStudents.length} öğrenci için uygun yer bulunamadı.`],
        recommendations,
        students: best.unseatedStudents,
        relaxSuggestions,
        penaltyScore: best.penalty,
      }, criteria, allowRecentRoomRepeat);
      return false;
    }

    setPlacementProgress({ current: placementProgress.total || 1, total: placementProgress.total || 1, stage: "Yerleşim kaydediliyor..." });
    await saveSeatingConfig({ generatedSeating: result, seatingCriteria: criteria, examDate: String(selectedBSlot?.dateStr || "") });
    setPlacementIssue(null);
    lastDistributionSignatureRef.current = String(result.distributionSignature || buildDistributionSignature(result.rooms || []));
    return true;
    } catch (error) {
      console.error("Yerleşim planı oluşturulamadı:", error);
      openPlacementIssueModal({
        title: "Yerleştirme İşlemi Tamamlanamadı",
        unseatedCount: 0,
        reasons: [String((error as any)?.message || "Yerleştirme sırasında beklenmeyen bir hata oluştu.")],
        recommendations: ["Kriterleri gözden geçirip kaydedin ve dağıtımı yeniden deneyin."],
        students: [],
      }, requestedCriteria, allowRecentRoomRepeat);
      return false;
    } finally {
      setIsGeneratingSeating(false);
      setPlacementProgress((prev) => ({ ...prev, stage: "" }));
    }
  };


  const handlePlanningLockToggle = async () => {
    if (!onPlanningLockedChange || isPublishingExamAnnouncements) return;
    setIsPublishingExamAnnouncements(true);
    try {
      if (planningLocked) {
        await clearLockedExamAnnouncements();
        await onPlanningLockedChange(false);
        return;
      }

      if (!generatedSeating?.rooms?.length || Number(generatedSeating?.unseatedCount || 0) > 0) {
        alert("Plan kilitlenmeden önce yerleşim planı eksiksiz oluşturulmalıdır.");
        return;
      }

      // Son salon/görevli öğretmen seçimlerini kilitlemeden önce kalıcılaştır.
      await saveSeatingConfig({ generatedSeating, roomTeacherAssignments });
      const publishResult = await publishLockedExamAnnouncements(generatedSeating);
      await onPlanningLockedChange(true);
      if (publishResult.failed > 0) {
        alert(`Plan kilitlendi; ancak ${publishResult.failed} mobil duyuru kaydı oluşturulamadı. Kilidi açıp tekrar kilitleyerek yeniden deneyebilirsiniz.`);
      }
    } catch (error) {
      console.error("Plan kilidi / mobil duyuru işlemi başarısız:", error);
      alert("Plan kilidi sırasında mobil duyurular hazırlanamadı.");
    } finally {
      setIsPublishingExamAnnouncements(false);
    }
  };


  const escapeXml = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const formatRoomTitle = (value: unknown) => `${String(value || '-').replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR')} SINAV SALONU YERLEŞİM PLANI`;

  const splitStudentNameForDesk = (value: unknown) => {
    const fullName = String(value || '').trim();
    if (!fullName) return { firstLine: '', secondLine: '' };
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstLine: fullName, secondLine: '' };
    return {
      firstLine: parts.slice(0, -1).join(' '),
      secondLine: parts[parts.length - 1],
    };
  };

  const resolveScheduledRoomTeacherName = (room: any, scheduleDataOverride: any = null) => {
    try {
      let scheduleData = scheduleDataOverride;
      if (!scheduleData || typeof scheduleData !== 'object') {
        const scheduleRaw = sqliteStorage.getItem('scheduleData');
        scheduleData = scheduleRaw ? JSON.parse(scheduleRaw) : {};
      }

      let classrooms: any[] = [];
      try {
        const classroomRaw = sqliteStorage.getItem('school_classrooms');
        classrooms = classroomRaw ? JSON.parse(classroomRaw) : [];
      } catch { classrooms = []; }

      const normalizeName = (value: unknown) => String(value || '').replace(/[\s\-\/]/g, '').toLocaleUpperCase('tr-TR');
      const matchedClass = (Array.isArray(classrooms) ? classrooms : []).find((item: any) =>
        normalizeName(item?.name || item?.className) === normalizeName(room?.name)
      );
      if (!matchedClass?.id) return '';

      const slotDay = String(selectedBSlot?.dayName || '').trim() || (() => {
        const date = new Date(`${String(selectedBSlot?.dateStr || '')}T12:00:00+03:00`);
        return Number.isFinite(date.getTime())
          ? date.toLocaleDateString('tr-TR', { weekday: 'long', timeZone: 'Europe/Istanbul' }).replace(/^./, (char) => char.toLocaleUpperCase('tr-TR'))
          : 'Pazartesi';
      })();
      let slotLessonHour: number | string = selectedBSlot?.lessonHour || selectedBSlot?.sessionIndex || 1;
      if (selectedBSlot?.sessionLabel && !selectedBSlot?.lessonHour) {
        const match = String(selectedBSlot.sessionLabel).match(/(\d+)\.\s*Ders/i);
        if (match) slotLessonHour = Number(match[1]);
      }

      const keys = [
        `class_${matchedClass.id}_${slotDay}_${slotLessonHour}`,
        `class_${matchedClass.id}_${slotDay}_${String(slotLessonHour)}`,
      ];
      for (const key of keys) {
        const rawCell = scheduleData?.[key];
        if (!rawCell) continue;
        const assignments = (Array.isArray(rawCell) ? rawCell : [rawCell]).filter(Boolean);
        const scheduledTeacher = assignments
          .flatMap((assignment: any) => [assignment?.teacherName, assignment?.teacherName2])
          .find((value: unknown) => String(value || '').trim().length > 0);
        if (scheduledTeacher) return String(scheduledTeacher).trim();
      }
    } catch (error) {
      console.warn('[Yerleşim Planı] Ders dağıtım tablosundan salon öğretmeni okunamadı.', error);
    }
    return '';
  };

  const resolveSupervisorName = (room: any, roomStudents: any[] = [], scheduleDataOverride: any = null) => {
    const roomKey = normalizeClassroomKey(room?.name);
    const assignedTeacherEntry = Object.entries(roomTeacherAssignments || {}).find(([roomName]) => normalizeClassroomKey(roomName) === roomKey);
    const assignedTeacherName = String(assignedTeacherEntry?.[1] || '').trim();
    if (assignedTeacherName) return assignedTeacherName;

    const directRoomName = [room?.supervisorName, room?.invigilatorName]
      .find((value) => String(value || '').trim().length > 0);
    if (directRoomName) return String(directRoomName).trim();

    const scheduledTeacher = resolveScheduledRoomTeacherName(room, scheduleDataOverride);
    if (scheduledTeacher) return scheduledTeacher;

    const directSlotName = [selectedBSlot?.supervisorName, selectedBSlot?.invigilatorName]
      .find((value) => String(value || '').trim().length > 0);
    if (directSlotName) return String(directSlotName).trim();

    // Son yedek: sınav kaydında öğretmen alanı varsa onu kullan.
    const normalizeClassKey = (value: unknown) => String(value || '').replace(/[\s\-\/]/g, '').toLocaleUpperCase('tr-TR');
    const roomClasses = new Set(roomStudents.map((student: any) => normalizeClassKey(student?.classroom)));
    const matchedExam = (selectedBSlot?.exams || []).find((exam: any) =>
      Array.isArray(exam?.classrooms) && exam.classrooms.some((cls: string) => roomClasses.has(normalizeClassKey(cls)))
    );
    const examTeacherName = matchedExam && [
      matchedExam?.teacherName,
      matchedExam?.teacher,
      matchedExam?.courseTeacher,
      matchedExam?.invigilatorName,
      matchedExam?.gorevliOgretmen,
      matchedExam?.supervisorName,
    ].find((value) => String(value || '').trim().length > 0);
    return String(examTeacherName || '').trim();
  };

  const buildDeskSvg = (desk: any, targetWidthPt?: number, targetHeightPt?: number, fourColumnCompact = false) => {
    // pdfmake SVG ölçülerini CSS px kabul edip 72/96 oranıyla PDF noktasına çevirir.
    // 3 sütunlu salonlarda SVG'nin kendi ölçüsünü gerçek tablo hücresiyle eşitle ki
    // sağ tarafta gizli boşluk kalmasın ve 8 sıra A4'e sığabilsin.
    const isThreeColumnCompact = Boolean(targetWidthPt && targetHeightPt && !fourColumnCompact);
    const width = targetWidthPt ? Math.max(150, Math.round(targetWidthPt * 4 / 3)) : 168;
    const height = targetHeightPt ? Math.max(68, Math.round(targetHeightPt * 4 / 3)) : 112;
    const dividerX = width / 2;
    const leftSeat = String(desk?.seatNumLeft || '-');
    const rightSeat = String(desk?.seatNumRight || '-');
    const classNumLeft = desk?.left ? `${desk.left.classroom || '-'} - ${desk.left.number || desk.left.id || '-'}` : '';
    const classNumRight = desk?.right ? `${desk.right.classroom || '-'} - ${desk.right.number || desk.right.id || '-'}` : '';
    const leftNameParts = splitStudentNameForDesk(desk?.left?.name);
    const rightNameParts = splitStudentNameForDesk(desk?.right?.name);
    const fillLeft = desk?.left ? '#0F172A' : '#94A3B8';
    const fillRight = desk?.right ? '#0F172A' : '#94A3B8';
    const seatBox = Math.max(15, Math.min(19, Math.round(width * 0.075)));
    const topY = 7;
    const seatTextY = topY + seatBox * 0.72;
    const compactNameY = Math.max(31, Math.round(height * 0.36));
    const nameLine1Y = fourColumnCompact ? Math.max(29, Math.round(height * 0.34)) : Math.max(36, Math.round(height * 0.40));
    const nameLine2Y = fourColumnCompact ? nameLine1Y + 12 : nameLine1Y + 14;
    const signatureY = isThreeColumnCompact
      ? Math.max(compactNameY + 27, height - 13)
      : fourColumnCompact
        ? Math.max(nameLine2Y + 12, height - 9)
        : Math.max(nameLine2Y + 18, height - 17);
    const compactFont = width >= 210 ? 9.5 : 9.0;
    const standardNameFont = fourColumnCompact ? 9.3 : 10.3;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <rect x="1.5" y="1.5" rx="10" ry="10" width="${width - 3}" height="${height - 3}" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.3"/>
        <line x1="${dividerX}" y1="23" x2="${dividerX}" y2="${height - 12}" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="4 3"/>

        <rect x="7" y="${topY}" rx="4" ry="4" width="${seatBox}" height="${seatBox}" fill="#DC2626"/>
        <text x="${7 + seatBox / 2}" y="${seatTextY}" text-anchor="middle" font-size="9" font-weight="700" fill="#FFFFFF">${escapeXml(leftSeat)}</text>
        <text x="${12 + seatBox}" y="${seatTextY}" text-anchor="start" font-size="6.7" font-weight="700" fill="#334155">${escapeXml(classNumLeft)}</text>

        <rect x="${dividerX + 7}" y="${topY}" rx="4" ry="4" width="${seatBox}" height="${seatBox}" fill="#DC2626"/>
        <text x="${dividerX + 7 + seatBox / 2}" y="${seatTextY}" text-anchor="middle" font-size="9" font-weight="700" fill="#FFFFFF">${escapeXml(rightSeat)}</text>
        <text x="${dividerX + 12 + seatBox}" y="${seatTextY}" text-anchor="start" font-size="6.7" font-weight="700" fill="#334155">${escapeXml(classNumRight)}</text>

        ${isThreeColumnCompact
          ? `<text x="${width * 0.25}" y="${compactNameY}" text-anchor="middle" font-size="${compactFont}" font-weight="700" fill="${fillLeft}">${escapeXml(leftNameParts.firstLine || 'BOŞ')}</text>
             <text x="${width * 0.25}" y="${compactNameY + 12}" text-anchor="middle" font-size="${compactFont}" font-weight="700" fill="${fillLeft}">${escapeXml(leftNameParts.secondLine || '')}</text>
             <text x="${width * 0.75}" y="${compactNameY}" text-anchor="middle" font-size="${compactFont}" font-weight="700" fill="${fillRight}">${escapeXml(rightNameParts.firstLine || 'BOŞ')}</text>
             <text x="${width * 0.75}" y="${compactNameY + 12}" text-anchor="middle" font-size="${compactFont}" font-weight="700" fill="${fillRight}">${escapeXml(rightNameParts.secondLine || '')}</text>`
          : `<text x="${width * 0.25}" y="${nameLine1Y}" text-anchor="middle" font-size="${standardNameFont}" font-weight="700" fill="${fillLeft}">${escapeXml(leftNameParts.firstLine || 'BOŞ')}</text>
             <text x="${width * 0.25}" y="${nameLine2Y}" text-anchor="middle" font-size="${standardNameFont}" font-weight="700" fill="${fillLeft}">${escapeXml(leftNameParts.secondLine || '')}</text>
             <text x="${width * 0.75}" y="${nameLine1Y}" text-anchor="middle" font-size="${standardNameFont}" font-weight="700" fill="${fillRight}">${escapeXml(rightNameParts.firstLine || 'BOŞ')}</text>
             <text x="${width * 0.75}" y="${nameLine2Y}" text-anchor="middle" font-size="${standardNameFont}" font-weight="700" fill="${fillRight}">${escapeXml(rightNameParts.secondLine || '')}</text>`}

        <text x="${width * 0.25}" y="${signatureY}" text-anchor="middle" font-size="7" fill="#64748B">İmza: ____________</text>
        <text x="${width * 0.75}" y="${signatureY}" text-anchor="middle" font-size="7" fill="#64748B">İmza: ____________</text>
      </svg>`;
  };

  const applySnakeSeatNumbers = (desks: any[], deskColumns: number, deskRows: number) => {
    let nextSeatNumber = 1;
    for (let colIndex = 0; colIndex < deskColumns; colIndex += 1) {
      const rowIndexes = Array.from({ length: deskRows }, (_, rowIndex) => rowIndex);
      if (colIndex % 2 === 1) rowIndexes.reverse();
      rowIndexes.forEach((rowIndex) => {
        const deskId = rowIndex * deskColumns + colIndex;
        const desk = desks[deskId];
        if (!desk || desk.active === false) return;
        desk.seatNumLeft = nextSeatNumber++;
        desk.seatNumRight = nextSeatNumber++;
      });
    }
    return desks;
  };

  const getActiveGridAxes = (activeDesks: boolean[], physicalColumns: number, physicalRows: number) => {
    const activeColumns = Array.from({ length: physicalColumns }, (_, colIndex) => colIndex)
      .filter((colIndex) => Array.from({ length: physicalRows }, (_, rowIndex) => activeDesks[rowIndex * physicalColumns + colIndex] !== false).some(Boolean));
    const activeRows = Array.from({ length: physicalRows }, (_, rowIndex) => rowIndex)
      .filter((rowIndex) => activeColumns.some((colIndex) => activeDesks[rowIndex * physicalColumns + colIndex] !== false));
    return {
      activeColumns: activeColumns.length ? activeColumns : Array.from({ length: physicalColumns }, (_, index) => index),
      activeRows: activeRows.length ? activeRows : Array.from({ length: physicalRows }, (_, index) => index),
    };
  };

  const applySnakeSeatNumbersToActiveGrid = (
    desks: any[],
    physicalColumns: number,
    activeColumns: number[],
    activeRows: number[],
  ) => {
    let nextSeatNumber = 1;
    activeColumns.forEach((physicalColIndex, visibleColIndex) => {
      const rowIndexes = [...activeRows];
      if (visibleColIndex % 2 === 1) rowIndexes.reverse();
      rowIndexes.forEach((physicalRowIndex) => {
        const deskId = physicalRowIndex * physicalColumns + physicalColIndex;
        const desk = desks[deskId];
        if (!desk || desk.active === false) return;
        desk.seatNumLeft = nextSeatNumber++;
        desk.seatNumRight = nextSeatNumber++;
      });
    });
    return desks;
  };

  const getRoomElementGroups = (elements: any[] = []) => {
    const groups = { top: [] as any[], bottom: [] as any[], left: [] as any[], right: [] as any[] };
    (elements || []).forEach((element: any) => {
      const x = Number(element?.x || 0);
      const y = Number(element?.y || 0);
      const distances = {
        top: y,
        bottom: Math.abs(100 - y),
        left: x,
        right: Math.abs(100 - x),
      };
      const side = Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] as 'top' | 'bottom' | 'left' | 'right';
      groups[side].push(element);
    });
    groups.top.sort((a, b) => Number(a?.x || 0) - Number(b?.x || 0));
    groups.bottom.sort((a, b) => Number(a?.x || 0) - Number(b?.x || 0));
    groups.left.sort((a, b) => Number(a?.y || 0) - Number(b?.y || 0));
    groups.right.sort((a, b) => Number(a?.y || 0) - Number(b?.y || 0));
    return groups;
  };

  const buildElementBadge = (element: any, align: 'left' | 'center' | 'right' = 'center') => {
    const type = String(element?.type || 'window');
    const label = type === 'board' ? 'Tahta' : type === 'teacher-desk' ? 'Öğretmen Masası' : type === 'door' ? 'Kapı' : 'Pencere';
    const iconSvg = type === 'board'
      ? '<rect x="2" y="5" width="26" height="14" rx="2" fill="#0F172A" stroke="#334155" stroke-width="1"/><rect x="10" y="20" width="10" height="3" rx="1" fill="#64748B"/>'
      : type === 'teacher-desk'
      ? '<rect x="4" y="8" width="22" height="12" rx="2" fill="#C084FC" stroke="#7C3AED" stroke-width="1"/><rect x="7" y="20" width="3" height="5" fill="#7C3AED"/><rect x="20" y="20" width="3" height="5" fill="#7C3AED"/>'
      : type === 'door'
      ? '<rect x="8" y="4" width="14" height="20" rx="2" fill="#F59E0B" stroke="#B45309" stroke-width="1"/><circle cx="19" cy="14" r="1.4" fill="#7C2D12"/>'
      : '<rect x="5" y="5" width="20" height="18" rx="2" fill="#DBEAFE" stroke="#2563EB" stroke-width="1"/><line x1="15" y1="5" x2="15" y2="23" stroke="#2563EB" stroke-width="1"/><line x1="5" y1="14" x2="25" y2="14" stroke="#2563EB" stroke-width="1"/>';
    return {
      table: {
        widths: [90],
        body: [[{
          stack: [
            { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="28" viewBox="0 0 30 28">${iconSvg}</svg>`, alignment: align, margin: [0, 0, 0, 1] },
            { text: label, alignment: align, fontSize: 6.6, bold: true, color: '#334155' },
          ],
          fillColor: '#F8FAFC',
          margin: [2, 2, 2, 2],
          border: [true, true, true, true],
        }]],
      },
      layout: {
        hLineColor: () => '#CBD5E1',
        vLineColor: () => '#CBD5E1',
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
      margin: [0, 0, 0, 4],
    };
  };

  const buildRoomEnvironmentBlock = (elements: any[], gridBlock: any) => {
    const groups = getRoomElementGroups(elements);
    const topItems = groups.top.map((el) => buildElementBadge(el));
    const bottomItems = groups.bottom.map((el) => buildElementBadge(el));
    const leftItems = groups.left.map((el) => buildElementBadge(el, 'left'));
    const rightItems = groups.right.map((el) => buildElementBadge(el, 'right'));
    const content: any[] = [];
    if (topItems.length) {
      content.push({ columns: topItems.map((item) => ({ width: 'auto', ...item })), alignment: 'center', columnGap: 6, margin: [0, 0, 0, 6] });
    }
    content.push({
      columns: [
        { width: leftItems.length ? 95 : 0, stack: leftItems },
        { width: '*', stack: [gridBlock] },
        { width: rightItems.length ? 95 : 0, stack: rightItems },
      ],
      columnGap: 8,
    });
    if (bottomItems.length) {
      content.push({ columns: bottomItems.map((item) => ({ width: 'auto', ...item })), alignment: 'center', columnGap: 6, margin: [0, 6, 0, 0] });
    }
    return content;
  };

  const resolveTeacherDeskSide = (elements: any[] = []): 'top' | 'bottom' | 'left' | 'right' => {
    const normalized = Array.isArray(elements) ? elements : [];
    const teacherElement = normalized.find((element: any) => {
      const type = String(element?.type || '').toLocaleLowerCase('tr-TR');
      return type === 'teacher-desk' || type === 'teacher_desk' || type === 'teacherdesk' || type === 'teacher';
    }) || normalized.find((element: any) => String(element?.type || '').toLocaleLowerCase('tr-TR') === 'board');
    if (!teacherElement) return 'top';
    const x = Number(teacherElement?.x || 0);
    const y = Number(teacherElement?.y || 0);
    const distances = {
      top: y,
      bottom: Math.abs(100 - y),
      left: x,
      right: Math.abs(100 - x),
    };
    return (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] as 'top' | 'bottom' | 'left' | 'right') || 'top';
  };

  const buildTeacherDeskPlacementBlock = (elements: any[] = [], gridBlock: any) => {
    const teacherSide = resolveTeacherDeskSide(elements);
    const teacherLabel = {
      text: 'ÖĞRETMEN KÜRSÜSÜ',
      fontSize: 8,
      bold: true,
      color: '#64748B',
      margin: [0, 0, 0, 6],
    } as any;

    if (teacherSide === 'bottom') {
      return { stack: [gridBlock, { ...teacherLabel, alignment: 'center', margin: [0, 6, 0, 0] }] };
    }

    if (teacherSide === 'left' || teacherSide === 'right') {
      return {
        stack: [
          {
            columns: [
              teacherSide === 'left'
                ? { width: 'auto', text: 'ÖĞRETMEN KÜRSÜSÜ', fontSize: 8, bold: true, color: '#64748B', alignment: 'left' }
                : { width: '*', text: '' },
              teacherSide === 'left'
                ? { width: '*', text: '' }
                : { width: 'auto', text: 'ÖĞRETMEN KÜRSÜSÜ', fontSize: 8, bold: true, color: '#64748B', alignment: 'right' },
            ],
            margin: [0, 0, 0, 6],
          },
          gridBlock,
        ],
      };
    }

    return { stack: [{ ...teacherLabel, alignment: 'center' }, gridBlock] };
  };

  const buildRoomTitleBar = (roomName: unknown, pageWidth: number, leftRightMargin: number, bottomMargin = 6, pageBreak?: 'before') => ({
    table: {
      widths: [pageWidth],
      body: [[{
        text: formatRoomTitle(roomName),
        bold: true,
        color: '#FFFFFF',
        fontSize: 12.5,
        alignment: 'center',
        fillColor: '#000000',
        margin: [0, 6, 0, 6],
      }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [-leftRightMargin, 0, -leftRightMargin, bottomMargin],
    pageBreak,
  });

  const buildExamMetaLine = (examTime: string, bottomMargin = 8) => ({
    text: [
      { text: 'Sınav Tarihi: ', color: '#6B7280', bold: false },
      { text: `${formatPlacementDate(selectedBSlot?.dateStr)}`, color: '#111827', bold: true },
      { text: '    Sınav Saati: ', color: '#6B7280', bold: false },
      { text: `${examTime}`, color: '#111827', bold: true },
    ],
    fontSize: 8,
    alignment: 'center',
    margin: [0, 0, 0, bottomMargin],
  });

  const buildRoomPlanFooterNote = (teacherName?: string) => ({
    stack: [
      {
        text: [
          { text: 'Sayın ', color: '#475569', bold: false },
          { text: teacherName || 'Öğretmen bilgisi bulunamadı', color: '#111827', bold: true },
        ],
        fontSize: 7.2,
        margin: [0, 0, 0, 3],
      },
      {
        text: '• Not: Sınava giren öğrencilere ilgili alanı tükenmez kalemle imzalatınız. Sınava girmeyen öğrencilere ise kırmızı kalemle "Girmedi" yazınız.',
        fontSize: 7,
        color: '#475569',
        bold: true,
        margin: [0, 0, 0, 2],
      },
      {
        text: '• Bu belgeyi imzalayarak Sınav kağıtları ile teslim ediniz',
        fontSize: 7,
        color: '#475569',
        bold: true,
        margin: [0, 0, 0, 4],
      },
    ],
  });

  const saveRoomSeatingPdf = async (room: any) => {
    // PDF, ekrandaki kaydedilmiş dağıtımın birebir çıktısı olmalı.
    // Canlı bina geometrisine göre öğrencileri yeniden sıralamak koltukları değiştiriyordu.
    const deskColumns: 3 | 4 = Number(room?.deskColumns) === 3 ? 3 : 4;
    const deskRows = Math.max(1, Number(room?.deskRows || 1));
    const slotCount = deskColumns * deskRows;
    const sourceDeskById = new Map<number, any>((room?.desks || []).map((desk: any) => [Number(desk?.id), desk]));
    const activeDesks = Array.from({ length: slotCount }, (_, index) => sourceDeskById.get(index)?.active !== false);
    const pdfDesks = Array.from({ length: slotCount }, (_, id) => {
      const sourceDesk = sourceDeskById.get(id);
      const active = activeDesks[id] !== false;
      if (!active) return { id, active: false, left: null, right: null, seatNumLeft: null, seatNumRight: null };
      return {
        id,
        active: true,
        left: sourceDesk?.left || null,
        right: sourceDesk?.right || null,
        seatNumLeft: sourceDesk?.seatNumLeft ?? null,
        seatNumRight: sourceDesk?.seatNumRight ?? null,
      };
    });
    const { activeColumns, activeRows } = getActiveGridAxes(activeDesks, deskColumns, deskRows);
    const visibleColumnCount = activeColumns.length;
    const visibleRowCount = activeRows.length;

    const pageOrientation: "portrait" = "portrait";
    const pageHeight = 842;
    const pageWidth = 595;
    const leftRightMargin = visibleColumnCount === 3 ? 28.35 : 20; // yalnız 3 AKTİF sütunda sağ/sol 1 cm
    const interDeskGap = 14.2; // 5 mm
    const footerReserved = visibleColumnCount === 3 ? 92 : 98;
    const titleBlockHeight = visibleColumnCount === 3 ? 38 : 52;
    const teacherLabelHeight = visibleColumnCount === 3 ? 14 : 18;
    const usablePageWidth = pageWidth - leftRightMargin * 2;
    const deskCellWidth = Math.floor((usablePageWidth - interDeskGap * (visibleColumnCount - 1)) / visibleColumnCount);
    const availableGridHeight = Math.max(260, pageHeight - 28 - footerReserved - titleBlockHeight - teacherLabelHeight - 40);
    const eightRowHeight = Math.floor((availableGridHeight - 7 * 14.2) / 8);
    const calculatedRowHeight = Math.floor((availableGridHeight - Math.max(0, visibleRowCount - 1) * 14.2) / Math.max(1, visibleRowCount));
    const rowCellHeight = visibleColumnCount === 3
      ? Math.max(68.2, Math.min(76.2, eightRowHeight + 12.2))
      : visibleColumnCount === 4
        ? Math.min(calculatedRowHeight, Math.max(42, Math.min(56, calculatedRowHeight)) + 28.35)
        : Math.max(54, calculatedRowHeight);
    const deskById = new Map<number, any>(pdfDesks.map((desk: any) => [Number(desk.id), desk] as [number, any]));
    const placements = pdfDesks.flatMap((desk: any) => [desk?.left, desk?.right]).filter(Boolean);
    let currentScheduleData: any = {};
    try { currentScheduleData = await preloadScheduleData(); } catch { currentScheduleData = {}; }
    const supervisorName = resolveScheduledRoomTeacherName(room, currentScheduleData);

    const examBreakdownMap = new Map<string, { grade: number; examName: string; count: number }>();
    placements.forEach((student: any) => {
      const grade = Number(String(student?.classroom || '').match(/(\d{1,2})/)?.[1] || 99);
      const examName = String(getExamDisplayNameForStudent(student) || 'Sınav').replace(/\s*Sınavı$/i, '').trim() || 'Sınav';
      const key = `${grade}|${examName}`;
      const current = examBreakdownMap.get(key);
      examBreakdownMap.set(key, { grade, examName, count: (current?.count || 0) + 1 });
    });
    const examBreakdown = Array.from(examBreakdownMap.values()).sort((a, b) =>
      a.grade - b.grade || a.examName.localeCompare(b.examName, 'tr-TR')
    );

    const roomGrid = activeRows.map((physicalRowIndex) => {
      const cells: any[] = [];
      activeColumns.forEach((physicalColIndex, visibleColIndex) => {
        const id = physicalRowIndex * deskColumns + physicalColIndex;
        const desk: any = deskById.get(id);
        if (desk && desk.active !== false) {
          cells.push({
            svg: buildDeskSvg(
              desk,
              visibleColumnCount === 3 || visibleColumnCount === 4 ? deskCellWidth : undefined,
              visibleColumnCount === 3 || visibleColumnCount === 4 ? rowCellHeight : undefined,
              visibleColumnCount === 4,
            ),
            width: deskCellWidth,
            height: rowCellHeight,
            margin: [0, 0, 0, 0],
          });
        } else {
          cells.push({ text: '', border: [false, false, false, false], fillColor: '#FFFFFF', width: deskCellWidth });
        }
        if (visibleColIndex < activeColumns.length - 1) {
          cells.push({ text: '', border: [false, false, false, false], width: interDeskGap });
        }
      });
      return cells;
    });
    const roomGridWidths = Array.from({ length: visibleColumnCount * 2 - 1 }, (_, index) => index % 2 === 0 ? deskCellWidth : interDeskGap);
    const examTime = String(selectedBSlot?.timeStr || selectedBSlot?.startTime || selectedBSlot?.sessionTime || selectedBSlot?.examTime || '-').trim() || '-';

    const gridBlock = {
      table: { widths: roomGridWidths, body: roomGrid },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: (rowIndex: number, node: any) => rowIndex === (node?.table?.body?.length || 1) - 1 ? 0 : 14.2,
      },
      margin: [0, 0, 0, 0],
    };
    const roomKey = String(room?.name || '').replace(/[\s\-\/]/g, '').toLocaleUpperCase('tr-TR');
    const teacherDeskBlock = buildTeacherDeskPlacementBlock(roomLayoutElements[roomKey] || [], gridBlock);

    const footerBox = {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              columns: [
                {
                  width: '*',
                  stack: examBreakdown.length > 0
                    ? examBreakdown.map((item) => ({
                        columns: [
                          {
                            width: 43,
                            text: `${item.grade}. Sınıf :`,
                            fontSize: 6.5,
                            bold: false,
                            color: '#475569',
                          },
                          {
                            width: '*',
                            text: [
                              { text: item.examName, color: '#111827', bold: true },
                              { text: ` (${item.count} öğrenci)`, color: '#475569', bold: false },
                            ],
                            fontSize: 6.5,
                          },
                        ],
                        columnGap: 2,
                        margin: [0, 0, 0, 1],
                      }))
                    : [{ text: 'Sınav bilgisi bulunamadı', fontSize: 6.5, color: '#475569' }],
                },
                {
                  width: 180,
                  margin: [-56.7, 0, 0, 0],
                  relativePosition: { x: -56.7, y: 0 },
                  stack: [
                    { text: 'İmza', fontSize: 6.5, bold: false, color: '#94A3B8', alignment: 'center', margin: [0, 4, 0, 0] },
                  ],
                },
              ],
              columnGap: 10,
            },
          ],
          margin: [7, 6, 7, 6],
        }]],
      },
      layout: {
        hLineColor: () => '#94A3B8',
        vLineColor: () => '#94A3B8',
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };

    const documentDefinition: any = {
      pageSize: 'A4',
      pageOrientation,
      pageMargins: [leftRightMargin, visibleColumnCount === 3 ? 12 : 20, leftRightMargin, footerReserved],
      footer: () => ({
        margin: [leftRightMargin, 0, leftRightMargin, 28.35],
        stack: [buildRoomPlanFooterNote(supervisorName), footerBox],
      }),
      content: [
        buildRoomTitleBar(room.name, pageWidth, leftRightMargin, visibleColumnCount === 3 ? 2 : 4),
        buildExamMetaLine(examTime, visibleColumnCount === 3 ? 5 : 10),
        teacherDeskBlock,
      ],
      defaultStyle: { fontSize: 7 },
    };

    const fileDate = String(selectedBSlot?.dateStr || 'tarih').replace(/[^0-9A-Za-zçğıöşüÇĞİÖŞÜ_-]+/g, '_');
    const roomName = String(room?.name || 'sinif').replace(/[^0-9A-Za-zçğıöşüÇĞİÖŞÜ_-]+/g, '_');
    await PdfEngine.generate(documentDefinition, { mode: 'download', filename: `${roomName}_Yerlesim_Plani_${fileDate}.pdf` });
  };

  const saveAllClassListsPdf = async (classNames: string[] = sortedClassListNames) => {
    const selectedClassNames = classNames.filter((className) => sortedClassListNames.includes(className));
    if (!generatedSeating || selectedClassNames.length === 0) {
      alert("Kaydedilecek sınıf listesi bulunamadı.");
      return;
    }

    const examTime = String(
      selectedBSlot?.timeStr ||
      selectedBSlot?.startTime ||
      selectedBSlot?.sessionTime ||
      selectedBSlot?.examTime ||
      "-"
    ).trim() || "-";

    const content: any[] = [];
    selectedClassNames.forEach((className, classIndex) => {
      const rows = studentsByClass[className] || [];
      const examName = getExamDisplayNameForClass(className);
      content.push({
        text: `${String(className).toLocaleUpperCase("tr-TR")} SINIFI SINAV DAĞITIM LİSTESİ`,
        bold: true,
        fontSize: 15,
        alignment: "center",
        margin: [0, 0, 0, 7],
        pageBreak: classIndex > 0 ? "before" : undefined,
      });
      content.push({
        text: `Sınav Tarihi: ${formatPlacementDate(selectedBSlot?.dateStr)}    Sınav Saati: ${examTime}`,
        fontSize: 11,
        bold: true,
        alignment: "center",
        color: "#0F172A",
        margin: [0, 0, 0, 5],
      });
      content.push({
        text: String(examName || "Sınav"),
        fontSize: 10,
        bold: true,
        alignment: "center",
        color: "#1E293B",
        margin: [0, 0, 0, 12],
      });
      content.push({
        table: {
          headerRows: 1,
          widths: [22, 42, "*", 46, 46, 58, 36],
          body: [
            [
              { text: "Sıra", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Öğrenci No", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Adı Soyadı", bold: true, fillColor: "#E2E8F0" },
              { text: "Bina", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Kat", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Sınav Salonu", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Sıra No", bold: true, alignment: "center", fillColor: "#E2E8F0" },
            ],
            ...rows.map((student: any, rowIndex: number) => {
              const fillColor = rowIndex % 2 === 0 ? "#FFFFFF" : "#F1F5F9";
              return [
                { text: String(rowIndex + 1), fillColor, alignment: "center" },
                { text: String(student.number || "-"), fillColor, alignment: "center" },
                { text: String(student.name || "-"), fillColor, bold: true },
                { text: String(student.buildingName || "-"), fillColor, alignment: "center" },
                { text: String(student.floorName || "-"), fillColor, alignment: "center" },
                { text: String(student.roomName || "-"), fillColor, alignment: "center" },
                { text: String(student.seatNum || "-"), fillColor, bold: true, alignment: "center" },
              ];
            }),
          ],
        },
        margin: [0, 0, 0, 0],
        layout: {
          hLineColor: () => "#CBD5E1",
          vLineColor: () => "#E2E8F0",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 5.5,
          paddingBottom: () => 5.5,
        },
        fontSize: 7,
      });
    });

    const fileDate = String(selectedBSlot?.dateStr || "tarih").replace(/[^0-9A-Za-zçğıöşüÇĞİÖŞÜ_-]+/g, "_");
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      // Yaklaşık 2 cm sağ/sol boşluk
      pageMargins: [57, 28, 57, 28],
      content,
      defaultStyle: { fontSize: 7 },
    }, {
      mode: "download",
      filename: `Tum_Sinif_Listeleri_${fileDate}.pdf`,
    });
  };

  const saveAllRoomSeatingPdf = async (roomNames?: string[]) => {
    const availableRooms = generatedSeating?.rooms || [];
    const roomsToExport = roomNames?.length ? availableRooms.filter((room: any) => roomNames.includes(room.name)) : availableRooms;
    if (!roomsToExport.length) {
      alert("Kaydedilecek oturma planı bulunamadı.");
      return;
    }

    const examTime = String(selectedBSlot?.timeStr || selectedBSlot?.startTime || selectedBSlot?.sessionTime || selectedBSlot?.examTime || "-").trim() || "-";
    let currentScheduleData: any = {};
    try { currentScheduleData = await preloadScheduleData(); } catch { currentScheduleData = {}; }
    const pageWidth = 595;
    const leftRightMargin = 20;
    const interDeskGap = 14.2;
    const usablePageWidth = pageWidth - leftRightMargin * 2;
    const content: any[] = [];
    const roomFooters: any[] = [];

    roomsToExport.forEach((room: any, roomIndex: number) => {
      // Toplu PDF de ekrandaki kaydedilmiş dağıtımı aynen kullanmalı.
      const deskColumns: 3 | 4 = Number(room?.deskColumns) === 3 ? 3 : 4;
      const deskRows = Math.max(1, Number(room?.deskRows || 1));
      const slotCount = deskColumns * deskRows;
      const sourceDeskById = new Map<number, any>((room?.desks || []).map((desk: any) => [Number(desk?.id), desk]));
      const activeDesks = Array.from({ length: slotCount }, (_, index) => sourceDeskById.get(index)?.active !== false);
      const pdfDesks = Array.from({ length: slotCount }, (_, id) => {
        const sourceDesk = sourceDeskById.get(id);
        const active = activeDesks[id] !== false;
        if (!active) return { id, active: false, left: null, right: null, seatNumLeft: null, seatNumRight: null };
        return {
          id,
          active: true,
          left: sourceDesk?.left || null,
          right: sourceDesk?.right || null,
          seatNumLeft: sourceDesk?.seatNumLeft ?? null,
          seatNumRight: sourceDesk?.seatNumRight ?? null,
        };
      });
      const { activeColumns, activeRows } = getActiveGridAxes(activeDesks, deskColumns, deskRows);
      const visibleColumnCount = activeColumns.length;
      const visibleRowCount = activeRows.length;

      const pageHeight = 842;
      const footerReserved = 98;
      const titleBlockHeight = 52;
      const teacherLabelHeight = 18;
      const roomSideMargin = visibleColumnCount === 3 ? 28.35 : leftRightMargin;
      const roomUsableWidth = pageWidth - roomSideMargin * 2;
      const deskCellWidth = Math.floor((roomUsableWidth - interDeskGap * (visibleColumnCount - 1)) / visibleColumnCount);
      const availableGridHeight = Math.max(260, pageHeight - 28 - footerReserved - titleBlockHeight - teacherLabelHeight - 40);
      const eightRowHeight = Math.floor((availableGridHeight - 7 * 14.2) / 8);
      const calculatedRowHeight = Math.floor((availableGridHeight - Math.max(0, visibleRowCount - 1) * 14.2) / Math.max(1, visibleRowCount));
      const rowCellHeight = visibleColumnCount === 3
        ? Math.max(68.2, Math.min(76.2, eightRowHeight + 12.2))
        : visibleColumnCount === 4
          ? Math.min(calculatedRowHeight, Math.max(42, Math.min(56, calculatedRowHeight)) + 28.35)
          : Math.max(54, calculatedRowHeight);
      const deskById = new Map<number, any>(pdfDesks.map((desk: any) => [Number(desk.id), desk]));
      const roomGrid = activeRows.map((physicalRowIndex) => {
        const cells: any[] = [];
        activeColumns.forEach((physicalColIndex, visibleColIndex) => {
          const id = physicalRowIndex * deskColumns + physicalColIndex;
          const desk: any = deskById.get(id);
          if (desk && desk.active !== false) {
            cells.push({
              svg: buildDeskSvg(
                desk,
                visibleColumnCount === 3 || visibleColumnCount === 4 ? deskCellWidth : undefined,
                visibleColumnCount === 3 || visibleColumnCount === 4 ? rowCellHeight : undefined,
                visibleColumnCount === 4,
              ),
              width: deskCellWidth,
              height: rowCellHeight,
              margin: [0, 0, 0, 0],
            });
          } else {
            cells.push({ text: '', border: [false, false, false, false], fillColor: '#FFFFFF', width: deskCellWidth });
          }
          if (visibleColIndex < activeColumns.length - 1) {
            cells.push({ text: '', border: [false, false, false, false], width: interDeskGap });
          }
        });
        return cells;
      });
      const roomGridWidths = Array.from({ length: visibleColumnCount * 2 - 1 }, (_, index) => index % 2 === 0 ? deskCellWidth : interDeskGap);

      const placedStudents = pdfDesks.flatMap((desk: any) => [desk.left, desk.right]).filter(Boolean);
      const breakdown = new Map<string, { grade: number; examName: string; count: number }>();
      placedStudents.forEach((student: any) => {
        const grade = Number(String(student?.classroom || '').match(/(\d{1,2})/)?.[1] || 99);
        const examName = String(getExamDisplayNameForStudent(student) || 'Sınav').replace(/\s*Sınavı$/i, '').trim() || 'Sınav';
        const key = `${grade}|${examName}`;
        const current = breakdown.get(key);
        breakdown.set(key, { grade, examName, count: (current?.count || 0) + 1 });
      });
      const breakdownRows = Array.from(breakdown.values()).sort((a, b) =>
        a.grade - b.grade || a.examName.localeCompare(b.examName, 'tr-TR')
      );
      const supervisorName = resolveScheduledRoomTeacherName(room, currentScheduleData);
      const footerBoxSingle = {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              {
                columns: [
                  {
                    width: '*',
                    stack: breakdownRows.length > 0
                      ? breakdownRows.map((item) => ({
                          columns: [
                            { width: 43, text: `${item.grade}. Sınıf :`, fontSize: 6.5, color: '#475569' },
                            {
                              width: '*',
                              text: [
                                { text: item.examName, color: '#111827', bold: true },
                                { text: ` (${item.count} öğrenci)`, color: '#475569', bold: false },
                              ],
                              fontSize: 6.5,
                            },
                          ],
                          columnGap: 4,
                          margin: [0, 0, 0, 1],
                        }))
                      : [{ text: 'Sınav bilgisi bulunamadı', fontSize: 6.5, color: '#475569' }],
                  },
                  {
                    width: 180,
                    margin: [-56.7, 0, 0, 0],
                    relativePosition: { x: -56.7, y: 0 },
                    stack: [
                      { text: 'İmza', fontSize: 6.5, bold: false, color: '#94A3B8', alignment: 'center', margin: [0, 4, 0, 0] },
                    ],
                  },
                ],
                columnGap: 10,
              },
            ],
            margin: [7, 6, 7, 6],
          }]],
        },
        layout: {
          hLineColor: () => '#94A3B8',
          vLineColor: () => '#94A3B8',
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      };
      roomFooters.push({ box: footerBoxSingle, supervisorName });

      content.push(buildRoomTitleBar(room.name, pageWidth, leftRightMargin, 4, roomIndex > 0 ? 'before' : undefined));
      content.push(buildExamMetaLine(examTime, 10));
      const roomCenterInset = Math.max(0, roomSideMargin - leftRightMargin);
      const roomKey = String(room?.name || '').replace(/[\s\-\/]/g, '').toLocaleUpperCase('tr-TR');
      const roomGridBlock = { table: { widths: roomGridWidths, body: roomGrid }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 14.2 }, margin: [roomCenterInset, 0, roomCenterInset, 0] };
      content.push(buildTeacherDeskPlacementBlock(roomLayoutElements[roomKey] || [], roomGridBlock));
    });

    const fileDate = String(selectedBSlot?.dateStr || 'tarih').replace(/[^0-9A-Za-zçğıöşüÇĞİÖŞÜ_-]+/g, '_');
    await PdfEngine.generate({ pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [leftRightMargin, 20, leftRightMargin, 98], footer: (currentPage: number) => {
      const currentFooter = roomFooters[currentPage - 1] || roomFooters[0] || {};
      return { margin: [leftRightMargin, 0, leftRightMargin, 28.35], stack: [buildRoomPlanFooterNote(currentFooter.supervisorName), currentFooter.box] };
    }, content, defaultStyle: { fontSize: 7 } }, { mode: 'download', filename: `Tum_Yerlesim_Planlari_${fileDate}.pdf` });
  };

  const handleSaveSeating = async () => {
    await saveSeatingConfig({ generatedSeating });
    alert("Yerleşim planı ve salon tercihleri başarıyla kaydedildi!");
    setActiveView('planlar');
  };

  const handleSaveSalonSelection = async () => {
    if (!selectedBSlot) {
      alert("Lütfen önce sınav oturumunu seçiniz.");
      return;
    }
    if (activeRoomsList.length === 0) {
      alert("Lütfen en az bir sınav salonu seçiniz.");
      return;
    }
    if ((!salonSelectionChanged && !salonTeacherAssignmentsChanged) || isSavingSalonSelection) return;

    const selectedSalons = activeRoomsList.map((room) => ({
      name: room.name,
      capacity: room.capacity,
      buildingName: room.buildingName,
      floorName: room.floorName,
      deskColumns: room.deskColumns,
      deskRows: room.deskRows,
      activeDesks: room.activeDesks,
    }));

    setIsSavingSalonSelection(true);
    try {
      const currentConfig = {
        sittingPattern,
        genderRuleActive,
        manualPlacementActive,
        crossSittingActive,
        seatingCriteria,
        backupSalons: [],
        inactiveDefaultSalons,
        salonSelectionInitialized: true,
        activeExtraSalons: [],
        roomTeacherAssignments,
        manualStudentAssignments,
        customRoomCapacities,
        generatedSeating,
        selectedSalons,
        selectedSalonCapacity,
      };
      await planningService.saveSeating(selectedTerm, selectedExamNo, Number(selectedBSlot.sessionIndex || 1), currentConfig);
      setSavedInactiveDefaultSalons([...inactiveDefaultSalons]);
      setSavedRoomTeacherAssignments({ ...roomTeacherAssignments });
      alert(`${selectedSalons.length} sınav salonu, toplam ${selectedSalonCapacity} kişilik kapasite ve görevli öğretmen seçimleri veritabanına kaydedildi.`);
    } catch (err) {
      console.error("Sınav salonları kaydedilemedi:", err);
      alert("Sınav salonları kaydedilemedi. Lütfen tekrar deneyiniz.");
    } finally {
      setIsSavingSalonSelection(false);
    }
  };

  const handleClearSeating = async () => {
    if (isCancellingSeating) return;
    const seatingToClear = generatedSeating;
    setIsCancellingSeating(true);
    try {
      if (seatingToClear) {
        lastDistributionSignatureRef.current = String(
          seatingToClear?.distributionSignature || buildDistributionSignature(seatingToClear?.rooms || [])
        );
        await clearPlacementAnnouncementsForStudents(seatingToClear);
      }
      setGeneratedSeating(null);
      setPlacementIssue(null);
      setPlacementProgress({ current: 0, total: 0, stage: "" });
      await saveSeatingConfig({ generatedSeating: null });
    } catch (error) {
      console.error("Dağıtım iptal edilemedi:", error);
      alert("Dağıtım iptal edilirken bir sorun oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setIsCancellingSeating(false);
    }
  };

  useEffect(() => {
    if (!activeRoomsList.length) {
      setPlacementInfoRoomName("");
      setSelectedFixedSeat(null);
      return;
    }
    if (!placementInfoRoomName || !activeRoomsList.some((room) => room.name === placementInfoRoomName)) {
      setPlacementInfoRoomName(activeRoomsList[0].name);
      setSelectedFixedSeat(null);
    }
  }, [activeRoomsList, placementInfoRoomName]);

  const placementInfoRoom = useMemo(
    () => activeRoomsList.find((room) => room.name === placementInfoRoomName) || activeRoomsList[0] || null,
    [activeRoomsList, placementInfoRoomName]
  );

  const placementInfoDesks = useMemo(() => {
    if (!placementInfoRoom) return [] as any[];
    const cols = Number(placementInfoRoom.deskColumns) === 3 ? 3 : 4;
    const rows = Math.max(1, Number(placementInfoRoom.deskRows || 1));
    const desks = Array.from({ length: cols * rows }, (_, id) => ({
      id,
      active: placementInfoRoom.activeDesks?.[id] !== false,
      leftSeatNumber: null as number | null,
      rightSeatNumber: null as number | null,
    }));

    // Otomatik dağıtım motorunun makeRoomsStructure fonksiyonuyla aynı fiziksel
    // satır/sütun ve aktif hücre numaralandırmasını kullan.
    // Pasif sıralar fiziksel konumlarını korur, fakat koltuk numarası almaz.
    const activeColumns = Array.from({ length: cols }, (_, colIndex) => colIndex)
      .filter((colIndex) => Array.from({ length: rows }, (_, rowIndex) =>
        placementInfoRoom.activeDesks?.[rowIndex * cols + colIndex] !== false).some(Boolean));
    const activeRows = Array.from({ length: rows }, (_, rowIndex) => rowIndex)
      .filter((rowIndex) => activeColumns.some((colIndex) =>
        placementInfoRoom.activeDesks?.[rowIndex * cols + colIndex] !== false));
    let nextSeatNumber = 1;
    activeColumns.forEach((physicalColIndex, visibleColIndex) => {
      const rowOrder = [...activeRows];
      if (visibleColIndex % 2 === 1) rowOrder.reverse();
      rowOrder.forEach((physicalRowIndex) => {
        const desk = desks[physicalRowIndex * cols + physicalColIndex];
        if (!desk || desk.active === false) return;
        desk.leftSeatNumber = nextSeatNumber++;
        desk.rightSeatNumber = nextSeatNumber++;
      });
    });
    // Tanımlamalar / Sınıflar ekranında tüm sıraları kapalı olan fiziksel sütun
    // sabit yerleşimde bir oturma sütunu gibi gösterilmez. Masa kimlikleri
    // korunur: mevcut sabitlemeler ve dağıtım kayıtları yeniden yazılmaz.
    // Kısmen kapalı bir sütunda ise kapalı hücreler yerlerinde kalır.
    if (activeColumns.length > 0 && activeColumns.length < cols) {
      return desks.filter((desk) => activeColumns.includes(desk.id % cols));
    }
    return desks;
  }, [placementInfoRoom]);

  const placementInfoVisibleColumns = useMemo(() => {
    if (!placementInfoRoom) return 3;
    const cols = Number(placementInfoRoom.deskColumns) === 3 ? 3 : 4;
    const rows = Math.max(1, Number(placementInfoRoom.deskRows) || 1);
    const visible = Array.from({ length: cols }, (_, col) => col).filter((col) =>
      Array.from({ length: rows }, (_, row) => row).some((row) =>
        placementInfoRoom.activeDesks?.[row * cols + col] !== false));
    return visible.length || cols;
  }, [placementInfoRoom]);

  const getFixedAssignmentAtSeat = (roomName: string, deskId: number, side: 'left' | 'right') =>
    Object.values(fixedSeatAssignments || {}).find((assignment) =>
      assignment.roomName === roomName && Number(assignment.deskId) === Number(deskId) && assignment.side === side
    );

  const getStudentById = (studentId: string) =>
    examStudents.find((student: any) => String(student.id) === String(studentId)) ||
    students.find((student: any) => String(student.id) === String(studentId));

  const placementStudentSearchResults = useMemo(() => {
    const query = placementStudentSearch.trim().toLocaleUpperCase('tr-TR');
    if (!query) return [] as any[];
    return examStudents
      .filter((student: any) => {
        const haystack = `${student?.number || ''} ${student?.name || ''} ${student?.classroom || ''}`.toLocaleUpperCase('tr-TR');
        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [placementStudentSearch, examStudents]);

  const persistFixedSeatAssignment = async (student: any) => {
    if (!selectedFixedSeat) return;
    const studentId = String(student?.id || '').trim();
    if (!studentId) {
      alert('Öğrenci kimliği bulunamadı.');
      return;
    }

    const nextAssignments = { ...fixedSeatAssignments };
    Object.keys(nextAssignments).forEach((key) => {
      const assignment = nextAssignments[key];
      const sameStudent = String(assignment.studentId) === studentId;
      const sameSeat = assignment.roomName === selectedFixedSeat.roomName &&
        Number(assignment.deskId) === Number(selectedFixedSeat.deskId) &&
        assignment.side === selectedFixedSeat.side;
      if (sameStudent || sameSeat) delete nextAssignments[key];
    });
    nextAssignments[studentId] = {
      studentId,
      roomName: selectedFixedSeat.roomName,
      deskId: selectedFixedSeat.deskId,
      side: selectedFixedSeat.side,
    };

    const nextManualAssignments = Object.fromEntries(
      Object.values(nextAssignments).map((assignment) => [assignment.studentId, assignment.roomName])
    );
    setFixedSeatAssignments(nextAssignments);
    setManualStudentAssignments(nextManualAssignments);
    setManualPlacementActive(true);
    await saveSeatingConfig({
      fixedSeatAssignments: nextAssignments,
      manualStudentAssignments: nextManualAssignments,
      manualPlacementActive: true,
    });
    setPlacementStudentSearch('');
    setSelectedFixedSeat(null);
  };

  const removeFixedSeatAssignmentAt = async (roomName: string, deskId: number, side: 'left' | 'right') => {
    const nextAssignments = { ...fixedSeatAssignments };
    Object.keys(nextAssignments).forEach((key) => {
      const assignment = nextAssignments[key];
      if (
        assignment.roomName === roomName &&
        Number(assignment.deskId) === Number(deskId) &&
        assignment.side === side
      ) {
        delete nextAssignments[key];
      }
    });
    const nextManualAssignments = Object.fromEntries(
      Object.values(nextAssignments).map((assignment) => [assignment.studentId, assignment.roomName])
    );
    setFixedSeatAssignments(nextAssignments);
    setManualStudentAssignments(nextManualAssignments);
    setManualPlacementActive(Object.keys(nextAssignments).length > 0);
    await saveSeatingConfig({
      fixedSeatAssignments: nextAssignments,
      manualStudentAssignments: nextManualAssignments,
      manualPlacementActive: Object.keys(nextAssignments).length > 0,
    });
    setPlacementStudentSearch('');
    setSelectedFixedSeat(null);
  };

  const removeFixedSeatAssignment = async () => {
    if (!selectedFixedSeat) return;
    await removeFixedSeatAssignmentAt(selectedFixedSeat.roomName, selectedFixedSeat.deskId, selectedFixedSeat.side);
  };

  const updateSeatingCriterion = async (key: keyof SeatingCriteria, checked: boolean) => {
    const nextCriteria = { ...seatingCriteria, [key]: checked };
    setSeatingCriteria(nextCriteria);
    await saveSeatingConfig({ seatingCriteria: nextCriteria });
  };

  const inlineSeatingCriteria: Array<{ key: keyof SeatingCriteria; label: string }> = [
    { key: 'avoidSameBranchSide', label: 'Aynı sınav öğrencileri yan yana oturmasın.' },
    { key: 'avoidSameBranchFrontBack', label: 'Aynı sınav öğrencileri arka arkaya oturmasın.' },
    { key: 'avoidSameBranchDiagonal', label: 'Aynı sınav öğrencileri çapraz oturmasın.' },
    { key: 'balanceBranchesAcrossRooms', label: 'Şubeler salonlara dengeli dağıtılmalı.' },
    { key: 'distributeEmptySeats', label: 'Boş sıralar öğrencilerin arasına dengeli dağıtılmalı.' },
  ];

  // Helper to format Turkish dates
  const studentsByClass = useMemo(() => {
    if (!generatedSeating) return {};
    const groups: Record<string, any[]> = {};
    generatedSeating.rooms.forEach((room: any) => {
      room.desks.forEach((desk: any) => {
        if (desk.left) {
          const c = desk.left.classroom || 'Bilinmiyor';
          if (!groups[c]) groups[c] = [];
          groups[c].push({ ...desk.left, buildingName: room.buildingName || 'Bina Bilgisi Yok', floorName: room.floorName || '', roomName: room.name, deskSeq: desk.seq, seatNum: desk.seatNumLeft });
        }
        if (desk.right) {
          const c = desk.right.classroom || 'Bilinmiyor';
          if (!groups[c]) groups[c] = [];
          groups[c].push({ ...desk.right, buildingName: room.buildingName || 'Bina Bilgisi Yok', floorName: room.floorName || '', roomName: room.name, deskSeq: desk.seq, seatNum: desk.seatNumRight });
        }
      });
    });
    // Sort within each class
    Object.keys(groups).forEach(c => {
      groups[c].sort((a, b) => {
        if (a.number && b.number) return parseInt(a.number) - parseInt(b.number);
        return a.name.localeCompare(b.name);
      });
    });
    return groups;
  }, [generatedSeating]);

  const sortedClassListNames = useMemo(
    () => Object.keys(studentsByClass).sort(compareClassroomNames),
    [studentsByClass]
  );

  useEffect(() => {
    if (!sortedClassListNames.length) {
      setSelectedClassList('');
      return;
    }
    if (!selectedClassList || !sortedClassListNames.includes(selectedClassList)) {
      setSelectedClassList(sortedClassListNames[0]);
    }
  }, [sortedClassListNames, selectedClassList]);

  const normalizedClassStudentSearch = classStudentSearch.trim().toLocaleUpperCase('tr-TR');
  const visibleClassGroups = useMemo(() => {
    return sortedClassListNames
      .map((className) => {
        const rows = (studentsByClass[className] || []).filter((student: any) => {
          if (!normalizedClassStudentSearch) return true;
          const haystack = [student?.name, student?.number, student?.id, className, student?.roomName, student?.buildingName, student?.floorName]
            .map((value) => String(value || '').toLocaleUpperCase('tr-TR'))
            .join(' ');
          return haystack.includes(normalizedClassStudentSearch);
        });
        return { className, rows };
      })
      .filter((group) => group.rows.length > 0);
  }, [normalizedClassStudentSearch, sortedClassListNames, studentsByClass]);

  const classListRows = useMemo(
    () => visibleClassGroups.flatMap((group) => group.rows.map((student: any) => ({ ...student, sourceClassName: group.className }))),
    [visibleClassGroups]
  );

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

  // Load plans reactively from the B-module database
  useEffect(() => {
    const fetchBPlan = async () => {
      const suffix = "_" + selectedTerm.replace(/\s+/g, '_') + "_" + selectedExamNo.replace(/\s+/g, '_');
      try {
        const planningState = await planningService.getState(selectedTerm, selectedExamNo);
        const savedPlansData = planningState?.savedPlans;
        const plan = planningState?.currentPlan || (Array.isArray(savedPlansData) ? savedPlansData[0] : null);
        if (plan) {
          setBPlan(plan);
          if (plan.slots && plan.slots.length > 0) {
            const requestedSlot = selectedSessionKeyValue
              ? plan.slots.find((slot: any) => getSessionWorkflowKey(slot) === selectedSessionKeyValue)
              : null;
            // Kayıtlı oturum bulunduğunda, geçici seçim anahtarı kaybolmuş olsa
            // bile salon ekranı boş kalmamalı.
            setSelectedBSlot(requestedSlot || plan.slots.find((slot: any) => (slot.exams || []).length > 0) || plan.slots[0]);
          } else {
            setSelectedBSlot(null);
          }
        } else {
          setBPlan(null);
          setSelectedBSlot(null);
        }
      } catch (err) {
        console.error("Error loading B plan in A module:", err);
        setBPlan(null);
        setSelectedBSlot(null);
      }
    };
    fetchBPlan();
  }, [selectedTerm, selectedExamNo, selectedSessionKeyValue, embedded]);

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

  const handleManualSaveSessions = async () => {
    try {
      await planningService.saveExamSessions(examSessions);
      alert("Ortak sınav oturum planları başarıyla kaydedildi!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Kaydetme işlemi sırasında bir hata oluştu!");
    }
  };

  const filteredSessions = useMemo(() => {
    return examSessions.filter(session => {
      const termMatch = !selectedTerm || !session.term || session.term === selectedTerm;
      const examNoMatch = !selectedExamNo || !session.examNo || session.examNo === selectedExamNo;
      return termMatch && examNoMatch;
    });
  }, [examSessions, selectedTerm, selectedExamNo]);

  const academicYear = getAcademicYear();

  const lessonHours = [
    { value: "1", label: "1. Ders (08:30)" },
    { value: "2", label: "2. Ders (09:20)" },
    { value: "3", label: "3. Ders (10:10)" },
    { value: "4", label: "4. Ders (11:00)" },
    { value: "5", label: "5. Ders (11:50)" },
    { value: "6", label: "6. Ders (13:10)" },
    { value: "7", label: "7. Ders (14:00)" },
    { value: "8", label: "8. Ders (14:50)" },
  ];

  const terms = ["1. Dönem", "2. Dönem"];
  const examNos = ["1. Yazılı", "2. Yazılı", "3. Yazılı"];
  const grades = ["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"];

  // Unique courses for dropdown
  const uniqueCourses = useMemo(() => {
    const unique = new Set(courses.map(c => c.name));
    return Array.from(unique);
  }, [courses]);

  // Unique branches based on grade
  const availableBranches = useMemo(() => {
    if (!gradeLevel) return [];
    const prefix = gradeLevel.split(".")[0]; // "9", "10", "11", "12"
    const branches = new Set<string>();
    students.forEach(s => {
      if (s.classroom && s.classroom.startsWith(prefix)) {
        branches.add(s.classroom);
      }
    });
    return Array.from(branches).sort();
  }, [gradeLevel, students]);

  const handleAddCourseExam = () => {
    if (!gradeLevel || !selectedCourse || selectedBranches.length === 0) {
      alert("Lütfen sınıf seviyesi, ders ve en az bir şube seçin.");
      return;
    }
    
    // Aynı ders saatinde bir şubeye ikinci bir sınav eklenmesini engelle
    const conflictingBranches = selectedBranches.filter(branch => 
      examList.some(exam => exam.gradeLevel === gradeLevel && exam.branches.includes(branch))
    );

    if (conflictingBranches.length > 0) {
      alert(`Bu oturumda (ders saatinde) şu şubelere zaten sınav tanımlanmış: ${conflictingBranches.join(", ")}`);
      return;
    }

    if (examDate && lessonHour) {
      const conflictingOtherSessionBranches = selectedBranches.filter(branch => 
        examSessions.some(session => 
          session.examDate === examDate && 
          session.lessonHour === lessonHour &&
          session.exams.some((e: any) => e.gradeLevel === gradeLevel && e.branches.includes(branch))
        )
      );

      if (conflictingOtherSessionBranches.length > 0) {
        alert(`Seçili tarih ve ders saatinde şu şubelere zaten başka bir oturumda sınav tanımlanmış: ${conflictingOtherSessionBranches.join(", ")}`);
        return;
      }
    }

    setExamList([...examList, {
      id: Date.now().toString(),
      gradeLevel,
      course: selectedCourse,
      branches: selectedBranches,
    }]);

    // Reset these fields
    setGradeLevel("");
    setSelectedCourse("");
    setSelectedBranches([]);
  };

  const handleSaveSession = () => {
    if (!term || !examNo || !examDate || !lessonHour || examList.length === 0) {
      alert("Lütfen dönem, yazılı no, tarih, ders saati seçin ve en az bir ders sınavı ekleyin.");
      return;
    }

    const newSession = {
      id: Date.now().toString(),
      academicYear,
      term,
      examNo,
      examDate,
      lessonHour,
      exams: examList
    };

    const updatedSessions = [newSession, ...examSessions];
    setExamSessions(updatedSessions);
    planningService.saveExamSessions(updatedSessions).catch(err => console.error("Sınav oturumları kaydedilemedi:", err));
    setIsModalOpen(false);
    
    // Reset form
    setTerm("");
    setExamNo("");
    setExamDate("");
    setLessonHour("");
    setGradeLevel("");
    setSelectedCourse("");
    setSelectedBranches([]);
    setExamList([]);
  };

  const toggleBranch = (branch: string) => {
    if (selectedBranches.includes(branch)) {
      setSelectedBranches(prev => prev.filter(b => b !== branch));
    } else {
      setSelectedBranches(prev => [...prev, branch]);
    }
  };

  const handleOpenEditSession = (session: any) => {
    setEditingSession(session);
    setEditingExamList([...session.exams]);
    setGradeLevel("");
    setSelectedCourse("");
    setSelectedBranches([]);
  };

  const handleSaveEditedSession = () => {
    if (!editingSession) return;
    
    const updatedSessions = examSessions.map(s => {
      if (s.id === editingSession.id) {
        return { ...s, exams: editingExamList };
      }
      return s;
    });
    
    setExamSessions(updatedSessions);
    planningService.saveExamSessions(updatedSessions).catch(err => console.error("Sınav oturumları kaydedilemedi:", err));
    setEditingSession(null);
    setEditingExamList([]);
    setGradeLevel("");
    setSelectedCourse("");
    setSelectedBranches([]);
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirm.idToDelete) return;
    
    if (deleteConfirm.type === 'session') {
      const updated = examSessions.filter(s => s.id !== deleteConfirm.idToDelete);
      setExamSessions(updated);
      planningService.saveExamSessions(updated).catch(err => console.error("Sınav oturumları kaydedilemedi:", err));
    } else if (deleteConfirm.type === 'exam') {
      setExamList(prev => prev.filter(e => e.id !== deleteConfirm.idToDelete));
    } else if (deleteConfirm.type === 'editExam') {
      setEditingExamList(prev => prev.filter(e => e.id !== deleteConfirm.idToDelete));
    }
    
    setDeleteConfirm({ isOpen: false, type: 'session', idToDelete: null, message: '' });
  };

  const handleDeleteSession = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'session',
      idToDelete: id,
      message: 'Bu ortak sınav oturumunu silmek istediğinize emin misiniz?'
    });
  };

  const handleAddCourseExamToEdit = () => {
    if (!gradeLevel || !selectedCourse || selectedBranches.length === 0) {
      alert("Lütfen sınıf seviyesi, ders ve en az bir şube seçin.");
      return;
    }
    
    // Aynı ders saatinde bir şubeye ikinci bir sınav eklenmesini engelle
    const conflictingBranches = selectedBranches.filter(branch => 
      editingExamList.some(exam => exam.gradeLevel === gradeLevel && exam.branches.includes(branch))
    );

    if (conflictingBranches.length > 0) {
      alert(`Bu oturumda (ders saatinde) şu şubelere zaten sınav tanımlanmış: ${conflictingBranches.join(", ")}`);
      return;
    }

    if (editingSession?.examDate && editingSession?.lessonHour) {
      const conflictingOtherSessionBranches = selectedBranches.filter(branch => 
        examSessions.some(session => 
          session.id !== editingSession.id &&
          session.examDate === editingSession.examDate && 
          session.lessonHour === editingSession.lessonHour &&
          session.exams.some((e: any) => e.gradeLevel === gradeLevel && e.branches.includes(branch))
        )
      );

      if (conflictingOtherSessionBranches.length > 0) {
        alert(`Seçili tarih ve ders saatinde şu şubelere zaten başka bir oturumda sınav tanımlanmış: ${conflictingOtherSessionBranches.join(", ")}`);
        return;
      }
    }

    setEditingExamList([...editingExamList, {
      id: Date.now().toString(),
      gradeLevel,
      course: selectedCourse,
      branches: selectedBranches,
    }]);

    setGradeLevel("");
    setSelectedCourse("");
    setSelectedBranches([]);
  };

  const renderSessionSelector = () => {
    if (embedded) {
      const examTime = String(selectedBSlot?.timeStr || selectedBSlot?.sessionTime || '').trim();
      return (
        <div className="border-2 border-dashed border-rose-300 bg-rose-50/40 p-2 py-1 px-4 rounded-2xl flex items-center gap-2 text-left select-none h-[56px]">
          <Clock className="w-4 h-4 text-rose-500 shrink-0" />
          <div className="text-xs">
            <div className="font-extrabold text-slate-800 leading-tight">
              {selectedBSlot ? `${formatTurkishDate(selectedBSlot.dateStr)} (${selectedBSlot.dayName || ""})` : "Oturum Seçilmedi"}
            </div>
            <div className="text-[10px] font-bold text-rose-600 mt-0.5 leading-none">
              {selectedBSlot ? (examTime || "Saat Belirlenmedi") : "Ortak Sınav Planlama ekranından oturum seçiniz"}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="border-2 border-dashed border-rose-300 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50/60 p-2 py-1 px-4 rounded-2xl flex items-center gap-2 transition-all cursor-pointer text-left select-none h-[56px]"
        >
          <Clock className="w-4 h-4 text-rose-500 shrink-0" />
          <div className="text-xs">
            <div className="font-extrabold text-slate-800 leading-tight">
              {selectedBSlot ? `${formatTurkishDate(selectedBSlot.dateStr)} (${selectedBSlot.dayName || ""})` : "Oturum Seçilmedi"}
            </div>
            <div className="text-[10px] font-bold text-rose-600 mt-0.5 leading-none">
              {selectedBSlot ? (String(selectedBSlot?.timeStr || selectedBSlot?.sessionTime || '').trim() || "Saat Belirlenmedi") : "Lütfen Oturum Seçiniz"}
            </div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform text-rose-400 ml-1.5 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
              {bPlan?.slots && bPlan.slots.length > 0 ? (
                bPlan.slots.map((slot: any, index: number) => {
                  const formattedDate = formatTurkishDate(slot.dateStr);
                  const label = `${formattedDate} (${slot.dayName || ""}) • ${String(slot?.timeStr || slot?.sessionTime || '').trim() || 'Saat Belirlenmedi'}`;
                  return (
                    <button
                      key={slot.id || index}
                      type="button"
                      onClick={() => {
                        setSelectedBSlot(slot);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-extrabold flex items-center gap-2 transition-colors ${selectedBSlot?.id === slot.id ? 'text-violet-600 bg-violet-50/50' : 'text-slate-700'}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedBSlot?.id === slot.id ? 'bg-violet-600' : 'bg-slate-300'}`} />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-slate-400 text-center font-semibold">
                  Planlanmış oturum bulunmuyor.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPlanViewActions = () => (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => setPlanlarViewMode('sinif')}
        className={`h-11 px-5 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black shadow-3xs transition-all cursor-pointer active:scale-95 ${planlarViewMode === 'sinif' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-violet-50 hover:bg-violet-100 border border-violet-100 hover:border-violet-200 text-violet-700'}`}
      >
        <Users className="w-4 h-4 shrink-0" />
        <span>Sınav Salonu Sınıf Listeleri</span>
      </button>

      <button
        type="button"
        onClick={() => setPlanlarViewMode('salon')}
        className={`h-11 px-5 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black shadow-3xs transition-all cursor-pointer active:scale-95 ${planlarViewMode === 'salon' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-violet-50 hover:bg-violet-100 border border-violet-100 hover:border-violet-200 text-violet-700'}`}
      >
        <DoorOpen className="w-4 h-4 shrink-0" />
        <span>Sınav Salonu Yerleşim Bilgileri</span>
      </button>
    </div>
  );

  return (
    <div className={embedded
      ? "flex w-full flex-col space-y-6 pb-8"
      : "mx-auto flex h-full w-full max-w-[1450px] flex-col space-y-6 overflow-y-auto px-6 pb-8 pt-0 md:px-10 md:pt-0"
    }>
      
      {!embedded && (
        <>
          {/* Dynamic Header Block with School Name, Year, Term Select, Written Select & "Planı" */}
          <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 p-5 rounded-3xl border border-slate-200/60 shadow-xs print:hidden shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-800 font-extrabold text-base md:text-lg">
              <span className="text-indigo-600 font-black tracking-tight">{getSchoolName()}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600 font-semibold">{getAcademicYear()} Eğitim Öğretim Yılı</span>
            </div>
          </div>
        </>
      )}

      {embedded && embeddedToolbarTarget && createPortal(renderSessionSelector(), embeddedToolbarTarget)}

      {(!embedded || activeView === 'sorular') && (
        <div className="bg-white border-2 border-dashed border-violet-600 rounded-3xl p-4 shrink-0 print:hidden flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {!embedded && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-violet-600 bg-theme-pattern p-1.5 rounded-2xl flex flex-row items-center justify-start gap-1 w-fit shadow-inner min-h-[56px] border-4 border-white">
                <button
                  type="button"
                  onClick={() => setActiveView('sorular')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wide select-none transition-all cursor-pointer ${activeView === 'sorular' ? 'bg-white text-violet-700 shadow-md' : 'text-white hover:bg-white/10'}`}
                >
                  Soruları Yükle
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('yerlesim')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wide select-none transition-all cursor-pointer ${activeView === 'yerlesim' ? 'bg-white text-violet-700 shadow-md' : 'text-white hover:bg-white/10'}`}
                  title="Sınav salonlarını belirle"
                >
                  Sınav Salonları
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('bilgiler')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wide select-none transition-all cursor-pointer ${activeView === 'bilgiler' ? 'bg-white text-violet-700 shadow-md' : 'text-white hover:bg-white/10'}`}
                  title="Sabit öğrenci yerlerini ve yerleşim kriterlerini belirle"
                >
                  Yerleşim Bilgileri
                </button>
                <button
                  type="button"
                  disabled={!generatedSeating}
                  onClick={() => setActiveView('planlar')}
                  className={`px-10 py-2.5 rounded-xl text-xs font-black tracking-wide select-none transition-all ${activeView === 'planlar' ? 'bg-white text-violet-700 shadow-md' : 'text-white hover:bg-white/10'} ${!generatedSeating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={!generatedSeating ? "Yerleşim planı oluşturulmadan bu sekmeye geçemezsiniz." : ""}
                >
                  Planlar
                </button>
              </div>
              {renderSessionSelector()}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {activeView === 'sorular' && (
              <button
                type="button"
                onClick={handleManualSaveSessions}
                disabled={planningLocked}
                className={`px-5 py-2.5 rounded-xl text-white text-[14.67px] font-black flex items-center gap-1.5 shadow-sm transition-all shrink-0 animate-fade-in ${planningLocked ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'}`}
              >
                <Save className="w-4 h-4" />
                <span>Kaydet</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm flex flex-col">
        {selectedBSlot ? (
          <div className="space-y-6">


            {activeView === 'sorular' ? (
              selectedBSlot.exams && selectedBSlot.exams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedBSlot.exams.map((exam: any, idx: number) => {
                    const examKey = `${selectedBSlot.dateStr}_${selectedBSlot.sessionIndex}_${exam.gradeLevel}_${exam.courseName}`;
                    const isUploaded = !!uploadedQuestions[examKey];
                    const currentFile = uploadedQuestions[examKey];
                    
                    return (
                      <button
                        key={exam.id || idx}
                        type="button"
                        disabled={planningLocked}
                        onClick={() => {
                          setUploadModalState({
                            isOpen: true,
                            examKey,
                            examData: exam
                          });
                          setSelectedFile(null);
                        }}
                        className={`w-full p-5 border rounded-3xl flex flex-col items-start text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer group relative overflow-hidden ${
                          isUploaded 
                            ? 'bg-gradient-to-br from-orange-50/20 to-white border-orange-300 hover:border-orange-500 hover:from-orange-50/40' 
                            : 'bg-gradient-to-br from-violet-50/20 to-white border-slate-200/80 hover:border-violet-300 hover:from-violet-50/40 hover:to-indigo-50/20'
                        }`}
                      >
                        {isUploaded && (
                          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100/30 rounded-bl-full flex items-start justify-end p-2 pointer-events-none">
                            <CheckCircle2 className="w-4 h-4 text-orange-600 mr-1 mt-1 animate-pulse" />
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-3 w-full justify-between">
                          <span className={`px-3 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-wide ${
                            isUploaded ? 'bg-orange-600 text-white' : 'bg-violet-600 text-white'
                          }`}>
                            {exam.gradeLevel}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                            isUploaded ? 'bg-orange-100/60 text-orange-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {exam.classrooms ? `${exam.classrooms.length} Grup/Şube` : "Grup Yok"}
                          </span>
                        </div>
                        
                        <h3 className={`text-sm font-black mb-2 transition-colors ${
                          isUploaded ? 'text-slate-800 group-hover:text-orange-700' : 'text-slate-800 group-hover:text-violet-700'
                        }`}>
                          {exam.courseName} Sınavı
                        </h3>
                        
                        {isUploaded && currentFile && (
                          <div className="flex items-center gap-1.5 text-[10px] text-orange-700 font-extrabold bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-xl mb-2 max-w-full truncate animate-fade-in">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{currentFile.fileName}</span>
                          </div>
                        )}
                        
                        <div className={`w-full border-t my-2 ${isUploaded ? 'border-orange-100' : 'border-slate-100'}`} />

                        <div className="flex flex-col gap-1.5 w-full mt-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            isUploaded ? 'text-orange-400' : 'text-slate-400'
                          }`}>
                            Sınava Girecek Sınıflar:
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {exam.classrooms && exam.classrooms.map((cls: string, cIdx: number) => (
                              <span 
                                key={cIdx} 
                                className={`px-2.5 py-1 border text-[10px] font-black rounded-lg shadow-2xs transition-colors ${
                                  isUploaded 
                                    ? 'bg-orange-50/20 border-orange-200/40 text-orange-800 hover:bg-orange-50/40' 
                                    : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-white'
                                }`}
                              >
                                {cls}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                  <CalendarIcon className="w-16 h-16 mb-4 text-slate-200 animate-pulse" />
                  <p className="text-xs font-bold text-slate-600">Bu Oturum İçin Tanımlanmış Ortak Sınav Bulunmuyor</p>
                  <p className="text-[11px] text-slate-400 mt-1">Lütfen "Sınav Takvimi" sayfasından bu oturuma sınav ataması yapınız.</p>
                </div>
              )
            ) : activeView === 'yerlesim' ? (
              <div className={planningLocked ? "pointer-events-none select-none opacity-65" : ""}>
              <KelebekSeatingPlanSubview
                students={students}
                selectedBSlot={selectedBSlot}
                sittingPattern={sittingPattern}
                setSittingPattern={setSittingPattern}
                genderRuleActive={genderRuleActive}
                setGenderRuleActive={setGenderRuleActive}
                manualPlacementActive={manualPlacementActive}
                setManualPlacementActive={setManualPlacementActive}
                crossSittingActive={crossSittingActive}
                setCrossSittingActive={setCrossSittingActive}
                backupSalons={backupSalons}
                setBackupSalons={setBackupSalons}
                inactiveDefaultSalons={inactiveDefaultSalons}
                setInactiveDefaultSalons={setInactiveDefaultSalons}
                activeExtraSalons={activeExtraSalons}
                setActiveExtraSalons={setActiveExtraSalons}
                manualStudentAssignments={manualStudentAssignments}
                setManualStudentAssignments={setManualStudentAssignments}
                customRoomCapacities={customRoomCapacities}
                setCustomRoomCapacities={setCustomRoomCapacities}
                generatedSeating={generatedSeating}
                setGeneratedSeating={setGeneratedSeating}
                classCapacities={classCapacities}
                classStudentCapacities={classStudentCapacities}
                selectedSalonCapacity={selectedSalonCapacity}
                roomTeacherAssignments={roomTeacherAssignments}
                setRoomTeacherAssignments={setRoomTeacherAssignments}
                allSchoolClassrooms={allSchoolClassrooms}
                defaultSalons={defaultSalons}
                extraSchoolClassrooms={extraSchoolClassrooms}
                examStudents={examStudents}
                studentCountsByBranch={studentCountsByBranch}
                activeRoomsList={activeRoomsList}
                totalRoomsCapacity={totalRoomsCapacity}
                handleGenerateSeating={handleGenerateSeating}
                getStudentGender={getStudentGender}
                handleSaveSeating={handleSaveSeating}
                handleClearSeating={handleClearSeating}
                handleSaveSalonSelection={handleSaveSalonSelection}
                canSaveSalonSelection={canSaveSalonSelection}
                isSavingSalonSelection={isSavingSalonSelection}
                isCriteriaModalOpen={isCriteriaModalOpen}
                setIsCriteriaModalOpen={setIsCriteriaModalOpen}
                isPreviewModalOpen={isPreviewModalOpen}
                setIsPreviewModalOpen={setIsPreviewModalOpen}
                previewRoomName={previewRoomName}
                setPreviewRoomName={setPreviewRoomName}
              />
              </div>
            ) : activeView === 'bilgiler' ? (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-6 animate-fade-in">
                <div className={`bg-white border border-slate-200 rounded-3xl p-5 shadow-sm min-w-0 ${planningLocked ? 'pointer-events-none select-none opacity-65' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Sabit Öğrenci Yerleşimi</h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">Hücreye yerleştirilen öğrenciler otomatik dağıtımda yer değiştirmez.</p>
                    </div>
                    <div className="w-full md:w-64">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Sınıf / Sınav Salonu</label>
                      <select
                        value={placementInfoRoomName}
                        onChange={(e) => {
                          setPlacementInfoRoomName(e.target.value);
                          setSelectedFixedSeat(null);
                          setPlacementStudentSearch('');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      >
                        {activeRoomsList.map((room) => (
                          <option key={room.name} value={room.name}>{room.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!placementInfoRoom ? (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                      <DoorOpen className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="text-xs font-black text-slate-600">Önce Sınav Salonları bölümünden salon seçiniz.</p>
                    </div>
                  ) : (
                    <>
                      {selectedFixedSeat && (
                        <div data-fixed-seat-ui="true" className="mb-5 p-4 rounded-2xl border border-violet-200 bg-violet-50/50 relative">
                          <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <div className="shrink-0">
                              <p className="text-[10px] font-black uppercase text-violet-500">Seçili Öğrenci Hücresi</p>
                              <p className="text-sm font-black text-slate-800">{selectedFixedSeat.roomName} • Sıra {selectedFixedSeat.seatNumber}</p>
                            </div>
                            <div className="relative flex-1">
                              <input
                                autoFocus
                                value={placementStudentSearch}
                                onChange={(e) => setPlacementStudentSearch(e.target.value)}
                                placeholder="Öğrenci no veya adı soyadı ile ara..."
                                className="w-full px-4 py-3 rounded-xl border border-violet-200 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-200"
                              />
                              {placementStudentSearch.trim() && (
                                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                  {placementStudentSearchResults.length > 0 ? placementStudentSearchResults.map((student: any) => (
                                    <button
                                      key={student.id}
                                      type="button"
                                      onClick={() => persistFixedSeatAssignment(student)}
                                      className="w-full px-3 py-2.5 text-left border-b last:border-b-0 border-slate-100 hover:bg-violet-50 transition-colors"
                                    >
                                      <p className="text-xs font-black text-slate-800">{student.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400">No: {student.number || student.id} • {student.classroom}</p>
                                    </button>
                                  )) : (
                                    <div className="px-3 py-3 text-xs font-semibold text-slate-400">Öğrenci bulunamadı.</div>
                                  )}
                                </div>
                              )}
                            </div>
                            {getFixedAssignmentAtSeat(selectedFixedSeat.roomName, selectedFixedSeat.deskId, selectedFixedSeat.side) && (
                              <button
                                type="button"
                                onClick={removeFixedSeatAssignment}
                                className="px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[10px] font-black hover:bg-red-100"
                              >
                                Sabitlemeyi Kaldır
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50/60 border border-slate-200 rounded-3xl p-5 overflow-x-auto">
                        <div className="max-w-5xl mx-auto">
                          <div className="mb-7 mx-auto max-w-md rounded-xl border border-slate-200 bg-white py-2 text-center text-[10px] font-black text-slate-500 tracking-wider">ÖĞRETMEN KÜRSÜSÜ / TAHTA</div>
                          <div
                            className="grid gap-x-5 gap-y-4"
                            style={{ gridTemplateColumns: `repeat(${placementInfoVisibleColumns}, minmax(150px, 1fr))` }}
                          >
                            {placementInfoDesks.map((desk: any) => {
                              if (!desk.active) {
                                return <div key={desk.id} aria-label="Kullanıma kapalı sıra" className="min-h-24 rounded-2xl border border-dashed border-slate-200 bg-slate-100/70 flex items-center justify-center text-[10px] font-bold text-slate-400">Kapalı Sıra</div>;
                              }
                              const renderSeat = (side: 'left' | 'right', seatNumber: number) => {
                                const assignment = getFixedAssignmentAtSeat(placementInfoRoom.name, desk.id, side);
                                const student = assignment ? getStudentById(assignment.studentId) : null;
                                const isSelected = selectedFixedSeat?.roomName === placementInfoRoom.name && selectedFixedSeat?.deskId === desk.id && selectedFixedSeat?.side === side;
                                return (
                                  <button
                                    data-fixed-seat-ui="true"
                                    type="button"
                                    onClick={() => {
                                      setSelectedFixedSeat({ roomName: placementInfoRoom.name, deskId: desk.id, side, seatNumber });
                                      setPlacementStudentSearch('');
                                    }}
                                    onDoubleClick={(event) => {
                                      if (!student) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void removeFixedSeatAssignmentAt(placementInfoRoom.name, desk.id, side);
                                    }}
                                    title={student ? 'Çift tıklayarak sabit yerleşimi kaldırın' : 'Öğrenci yerleştirmek için tıklayın'}
                                    className={`min-h-24 p-2.5 text-center transition-all ${
                                      isSelected ? 'bg-violet-100 ring-2 ring-violet-400 ring-inset' : student ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'bg-white hover:bg-violet-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center text-[9px] font-black">{seatNumber}</span>
                                      {student && <span className="text-[8px] font-black text-emerald-600 uppercase">Sabit</span>}
                                    </div>
                                    {student ? (
                                      <>
                                        <p className="text-[10px] font-black text-slate-800 leading-tight">{student.name}</p>
                                        <p className="text-[9px] font-bold text-slate-500 mt-1">{student.classroom} • {student.number || student.id}</p>
                                      </>
                                    ) : (
                                      <p className="text-[10px] font-bold text-slate-300 mt-4">Öğrenci Seç</p>
                                    )}
                                  </button>
                                );
                              };
                              return (
                                <div key={desk.id} className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xs divide-x divide-slate-300">
                                  {renderSeat('left', Number(desk.leftSeatNumber))}
                                  {renderSeat('right', Number(desk.rightSeatNumber))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-white border border-violet-200 rounded-3xl shadow-sm overflow-hidden self-start xl:sticky xl:top-4">
                  <div className="p-5 border-b border-violet-100 bg-violet-50/50">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Settings2 className="w-4 h-4 text-violet-600" /> Yerleşim Kriterleri</h3>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Tikli kurallar otomatik yerleşim motorunda uygulanır.</p>
                    <p className="text-[10px] font-black text-amber-700 mt-2 leading-relaxed">Sabit kural: Bir öğrenci 15 gün içindeki başka bir sınavda aynı sınav salonuna ikinci kez yerleştirilmez. Daha eski salon tekrarları da mümkün olduğunca önlenir.</p>
                  </div>
                  <div className="p-4 max-h-[610px] overflow-y-auto space-y-2">
                    {inlineSeatingCriteria.map((criterion) => (
                      <label key={criterion.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={planningLocked}
                          checked={Boolean(seatingCriteria[criterion.key])}
                          onChange={(e) => updateSeatingCriterion(criterion.key, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-[10px] font-bold text-slate-600 leading-relaxed">{criterion.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-4 border-t border-violet-100 bg-slate-50">
                    <button
                      type="button"
                      disabled={planningLocked || isGeneratingSeating || isCancellingSeating}
                      onClick={async () => {
                        if (generatedSeating && Number(generatedSeating?.unseatedCount || 0) === 0) {
                          await handleClearSeating();
                          return;
                        }
                        await handleGenerateSeating();
                      }}
                      className={`w-full px-4 py-3 rounded-xl text-white text-xs font-black shadow-sm transition-colors flex items-center justify-center gap-2 ${
                        planningLocked ? 'bg-slate-300 cursor-not-allowed' : isGeneratingSeating || isCancellingSeating ? 'bg-red-400 cursor-wait' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {(isGeneratingSeating || isCancellingSeating) && <Hourglass className="w-4 h-4 animate-pulse" />}
                      {isCancellingSeating
                        ? 'Dağıtım İptal Ediliyor...'
                        : isGeneratingSeating
                          ? `Yerleşim Yapılıyor${placementProgress.total > 1 ? ` (${placementProgress.current}/${placementProgress.total})` : '...'}`
                          : generatedSeating && Number(generatedSeating?.unseatedCount || 0) === 0
                            ? 'Dağıtımı İptal Et'
                            : 'Yerleşim Planını Oluştur'}
                    </button>
                    {isGeneratingSeating && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-black text-red-700">
                          <span>{placementProgress.stage || 'İşlem sürüyor...'}</span>
                          <span>{placementProgress.total > 1 ? `${placementProgress.current}/${placementProgress.total}` : '...'}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-red-100 overflow-hidden">
                          <div
                            className="h-full bg-red-600 transition-all duration-200"
                            style={{ width: `${placementProgress.total > 0 ? Math.max(6, Math.min(100, (placementProgress.current / placementProgress.total) * 100)) : 6}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] text-slate-400 font-semibold mt-2 text-center">Sabitlenen öğrenciler bu işlem sırasında yer değiştirmez.</p>
                    {generatedSeating && Number(generatedSeating?.unseatedCount || 0) === 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePlanningLockToggle}
                          disabled={isPublishingExamAnnouncements}
                          className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm ${isPublishingExamAnnouncements ? 'opacity-50 cursor-wait' : ''} ${planningLocked ? 'bg-slate-800 border-slate-800 text-white hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600'}`}
                          title={planningLocked ? 'Plan kilidini aç ve mobil duyuruları geri çek' : 'Planı kilitle ve mobil duyuruları yayınla'}
                        >
                          {planningLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                        </button>
                        <span className={`text-[9px] font-black ${planningLocked ? 'text-slate-700' : 'text-slate-400'}`}>
                          {planningLocked ? 'PLAN KİLİTLİ' : 'PLAN KİLİDİ AÇIK'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Planlar View */
              <div className="space-y-6 animate-fade-in">


                
{/* PLACEMENT RESULTS VIEW */}
      {generatedSeating ? (
        <div className="space-y-8 animate-fade-in">
          


          {/* Unplaced Students Warning */}
          {generatedSeating.unseatedCount > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-3xl p-6 flex items-start gap-4 animate-bounce">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-red-800">Yerleştirilemeyen Öğrenciler Var! ({generatedSeating.unseatedCount} Öğrenci)</h4>
                <p className="text-xs font-semibold text-red-700/80 mt-1">Sınav salonları kapasitesi yetersiz olduğu için aşağıdaki öğrenciler yerleştirilemedi. Lütfen daha fazla salon ekleyin veya çiftli oturma düzenine geçin.</p>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {generatedSeating.unseatedStudents.map((student: any) => (
                    <span key={student.id} className="px-2.5 py-1 bg-white border border-red-200 text-[10px] font-black text-red-800 rounded-lg">
                      {student.name} ({student.classroom})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="print:hidden bg-white border-2 border-slate-200 rounded-[28px] p-4 shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="shrink-0">
              {renderPlanViewActions()}
            </div>

            {planlarViewMode === 'sinif' ? (
              <div className="flex flex-1 items-end justify-end gap-3 min-w-0">
                <label className="block w-full max-w-2xl">
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Öğrenci Ara</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={classStudentSearch}
                      onChange={(event) => setClassStudentSearch(event.target.value)}
                      placeholder="Ad, soyad, öğrenci numarası, sınıf veya salon ara..."
                      className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400"
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPdfClasses([...sortedClassListNames]);
                    setIsClassPdfModalOpen(true);
                  }}
                  className="h-11 px-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPdfRooms((generatedSeating?.rooms || []).map((room: any) => room.name));
                    setIsRoomPdfModalOpen(true);
                  }}
                  className="h-11 px-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
            )}
          </div>

          {planlarViewMode === 'salon' ? (
            <div className="w-full">
          {/* Printable Layout Title (Only in Print) */}
          <div className="hidden print:block border-b-2 border-slate-800 pb-4 text-center space-y-1">
            <h1 className="text-xl font-bold uppercase">ŞEHİT BÜLENT YURTSEVEN ANADOLU LİSESİ</h1>
            <h2 className="text-lg font-black uppercase">SINAV SALONLARI YERLEŞİM PLANI</h2>
            <p className="text-xs font-bold text-slate-600">
              {formatOturumLabel(selectedBSlot)}
            </p>
            <p className="text-[10px] font-bold text-slate-500">
              Yazılı No: {selectedBSlot?.exams?.[0]?.gradeLevel} • Tarih: {selectedBSlot?.dateStr}
            </p>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 gap-8 print:grid-cols-1 print:gap-12">
            {generatedSeating.rooms.map((room: any, roomIndex: number) => {
              const placedStudents = room.desks.flatMap((d: any) => [d.left, d.right]).filter(Boolean);
              
              return (
                <div key={room.name} className="bg-white border-2 border-slate-200 rounded-[32px] p-6 shadow-xs flex flex-col gap-5 print:border-slate-800 print:rounded-none print:p-4 print:shadow-none break-inside-avoid break-after-page">
                  
                  {/* Room Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:border-slate-800">
                    <div>
                      <h4 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <DoorOpen className="w-5 h-5 text-indigo-500 print:hidden" />
                        {room.name} Sınav Salonu
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 print:text-slate-600">
                        Toplam Sıra: <strong>{room.desks.filter((desk: any) => desk.active !== false).length}</strong> • Yerleşen: <strong>{placedStudents.length}</strong> Öğrenci
                      </p>
                    </div>
                    
                  </div>

                  {/* Dynamic Visual Desk/Seating Layout Grid (Visually Stunning) */}
                  {(selectedRoomToView === room.name || true) && (
                    <div className="mt-2 space-y-3 pt-3 border-t border-slate-100/60 print:border-slate-800">
                      {/* Bina Bilgileri'ndeki gerçek 3/4 sütunlu çift kişilik sıra düzeni */}
                      <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: `repeat(${Number(room.deskColumns) === 3 ? 3 : 4}, minmax(0, 1fr))` }}
                      >
                        {room.desks.map((desk: any) => {
                          if (desk.active === false) {
                            return <div key={desk.id} className="min-h-[86px] print:min-h-[74px]" aria-hidden="true" />;
                          }
                          const renderStudentSeat = (student: any, seatNumber: any) => (
                            <div className="h-full min-h-[72px] p-1.5 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center text-center leading-tight print:border-slate-500">
                              <p className="text-[9px] font-black text-slate-900 break-words w-full">{student?.name || "BOŞ"}</p>
                              {student ? (
                                <>
                                  <p className="text-[8px] font-extrabold text-indigo-700 mt-1">Sınıf: {student.classroom || "-"}</p>
                                  <p className="text-[8px] font-bold text-slate-600">No: {student.number || student.id?.slice?.(0, 4) || "-"}</p>
                                </>
                              ) : (
                                <p className="text-[8px] font-bold text-slate-300 mt-1">Öğrenci Yeri</p>
                              )}
                              <p className="text-[11px] font-black text-red-600 mt-1">{seatNumber}</p>
                            </div>
                          );

                          return (
                            <div
                              key={desk.id}
                              className="p-2 border-2 rounded-xl bg-slate-50/60 border-slate-300 print:border-slate-800"
                            >
                              <div className="grid grid-cols-2 gap-1.5">
                                {renderStudentSeat(desk.left, desk.seatNumLeft)}
                                {renderStudentSeat(desk.right, desk.seatNumRight)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {visibleClassGroups.map((group) => (
                <div key={group.className} className="bg-white border-2 border-slate-200 rounded-[32px] p-5 shadow-xs flex flex-col print:border-slate-800 print:rounded-none print:p-4 print:shadow-none break-inside-avoid">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-3 print:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase">{group.className} SINIFI SINAV DAĞITIM LİSTESİ</h3>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1">{group.rows.length} öğrenci</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-700 overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="border-b-2 border-slate-200 print:border-slate-800">
                          <th className="py-2 px-2 w-10">Sıra</th>
                          <th className="py-2 px-2 w-20">Öğrenci No</th>
                          <th className="py-2 px-2 w-48">Adı Soyadı</th>
                          <th className="py-2 px-2 w-16">Sınıfı</th>
                          <th className="py-2 px-2 w-20">Bina</th>
                          <th className="py-2 px-2 w-20">Kat</th>
                          <th className="py-2 px-2 w-24">Sınav Salonu</th>
                          <th className="py-2 px-2 w-16">Sıra No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((student: any, idx: number) => (
                          <tr
                            key={`${student.id || student.number || student.name}-${idx}`}
                            className={`border-b border-slate-100 print:border-slate-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                          >
                            <td className="py-2 px-2 font-black text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-2 font-black">{student.number || '-'}</td>
                            <td className="py-2 px-2 font-bold">{student.name}</td>
                            <td className="py-2 px-2 font-extrabold text-slate-700">{group.className}</td>
                            <td className="py-2 px-2 font-bold text-slate-700">{student.buildingName}</td>
                            <td className="py-2 px-2 font-bold text-slate-600">{student.floorName || '-'}</td>
                            <td className="py-2 px-2 text-indigo-700 font-extrabold">{student.roomName}</td>
                            <td className="py-2 px-2 font-black text-rose-700">{student.seatNum}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {visibleClassGroups.length === 0 && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[28px] p-10 text-center text-xs font-bold text-slate-400">
                  Öğrenci bulunamadı.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-16 text-center max-w-lg mx-auto print:hidden space-y-4">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
          <div>
            <h4 className="text-sm font-black text-slate-700">Henüz Yerleşim Planı Yapılmadı</h4>
            <p className="text-xs font-semibold text-slate-400 mt-1">Sınav salonlarını seçin, <strong>Yerleşim Bilgileri</strong> bölümünde kriterleri belirleyin ve <strong>"Yerleşim Planını Oluştur"</strong> butonuna basın.</p>
          </div>
        </div>
      )}





              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
            <Clock className="w-16 h-16 mb-4 text-slate-200 animate-pulse" />
            <p className="text-xs font-bold text-slate-600">Lütfen Bir Sınav Oturumu Seçiniz</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Dönem ve yazılı bazında planlanan oturumları görmek için yukarıdaki <strong>"Oturum bilgileri"</strong> açılır butonuna tıklayınız.
            </p>
          </div>
        )}
      </div>

      {isClassPdfModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4 print:hidden">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800">Sınıf Listeleri PDF Seçimi</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">PDF'ye eklenecek sınıfları seçiniz.</p>
              </div>
              <button type="button" onClick={() => setIsClassPdfModalOpen(false)} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortedClassListNames.length > 0 && selectedPdfClasses.length === sortedClassListNames.length}
                  onChange={(event) => setSelectedPdfClasses(event.target.checked ? [...sortedClassListNames] : [])}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-black text-slate-700">Tüm Sınıflar</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedClassListNames.map((className) => {
                  const checked = selectedPdfClasses.includes(className);
                  return (
                    <label key={className} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${checked ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setSelectedPdfClasses((prev) => event.target.checked ? [...prev, className] : prev.filter((item) => item !== className))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] font-black text-slate-700">{className}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button type="button" onClick={() => setIsClassPdfModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600">İptal</button>
              <button
                type="button"
                disabled={selectedPdfClasses.length === 0}
                onClick={async () => {
                  if (!selectedPdfClasses.length) return;
                  await saveAllClassListsPdf(selectedPdfClasses);
                  setIsClassPdfModalOpen(false);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white ${selectedPdfClasses.length ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {isRoomPdfModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4 print:hidden">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800">Salon Yerleşim PDF Seçimi</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">PDF'ye eklenecek salonları seçiniz.</p>
              </div>
              <button type="button" onClick={() => setIsRoomPdfModalOpen(false)} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(generatedSeating?.rooms?.length || 0) > 0 && selectedPdfRooms.length === (generatedSeating?.rooms?.length || 0)}
                  onChange={(event) => setSelectedPdfRooms(event.target.checked ? (generatedSeating?.rooms || []).map((room: any) => room.name) : [])}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-black text-slate-700">Tüm Salonlar</span>
              </label>
              <div className="space-y-2">
                {(generatedSeating?.rooms || []).map((room: any) => {
                  const checked = selectedPdfRooms.includes(room.name);
                  return (
                    <label key={room.name} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${checked ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setSelectedPdfRooms((prev) => event.target.checked ? [...prev, room.name] : prev.filter((item) => item !== room.name))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-700">{room.name}</p>
                        <p className="text-[9px] font-semibold text-slate-400">{room.buildingName || 'Bina Bilgisi Yok'} {room.floorName ? `• ${room.floorName}` : ''}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button type="button" onClick={() => setIsRoomPdfModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600">İptal</button>
              <button
                type="button"
                disabled={selectedPdfRooms.length === 0}
                onClick={async () => {
                  if (!selectedPdfRooms.length) return;
                  await saveAllRoomSeatingPdf(selectedPdfRooms);
                  setIsRoomPdfModalOpen(false);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white ${selectedPdfRooms.length ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <KelebekASeatingModals
        isPreviewModalOpen={isPreviewModalOpen}
        generatedSeating={generatedSeating}
        handlePrint={handlePrint}
        setIsPreviewModalOpen={setIsPreviewModalOpen}
        previewRoomName={previewRoomName}
        setPreviewRoomName={setPreviewRoomName}
        sittingPattern={sittingPattern}
        getStudentGender={getStudentGender}
        isCriteriaModalOpen={isCriteriaModalOpen}
        setIsCriteriaModalOpen={setIsCriteriaModalOpen}
        setSittingPattern={setSittingPattern}
        genderRuleActive={genderRuleActive}
        setGenderRuleActive={setGenderRuleActive}
        crossSittingActive={crossSittingActive}
        setCrossSittingActive={setCrossSittingActive}
        manualPlacementActive={manualPlacementActive}
        setManualPlacementActive={setManualPlacementActive}
        seatingCriteria={seatingCriteria}
        setSeatingCriteria={setSeatingCriteria}
        onGenerateSeating={handleGenerateSeating}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-violet-500" />
                Sınav Bilgileri
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 ml-1">Eğitim Öğretim Yılı</label>
                <input 
                  type="text" 
                  value={academicYear} 
                  disabled
                  className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 ml-1">Dönem</label>
                <div className="relative">
                  <select 
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    <option value="" disabled>Dönem Seç</option>
                    {terms.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 ml-1">Yazılı No</label>
                <div className="relative">
                  <select 
                    value={examNo}
                    onChange={(e) => setExamNo(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    <option value="" disabled>No Seç</option>
                    {examNos.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 ml-1">Sınav Tarihi</label>
                <div className="relative">
                  <input 
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 ml-1">Ders Saati</label>
                <div className="relative">
                  <select 
                    value={lessonHour}
                    onChange={(e) => setLessonHour(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    <option value="" disabled>Saat Seç</option>
                    {lessonHours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <hr className="border-slate-100 my-2" />
            
            <div className="flex flex-col gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                Sınav Yapılacak Ders ve Şubeler
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 ml-1">Sınıf Seviyesi</label>
                  <div className="relative">
                    <select 
                      value={gradeLevel}
                      onChange={(e) => {
                        setGradeLevel(e.target.value);
                        setSelectedBranches([]);
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    >
                      <option value="" disabled>Sınıf Seviyesi Seçiniz</option>
                      {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 ml-1">Ders</label>
                  <div className="relative">
                    <select 
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    >
                      <option value="" disabled>Ders Seçiniz</option>
                      {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {gradeLevel && (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-xs font-bold text-slate-600 ml-1">Şubeler / Gruplar</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableBranches.map(branch => (
                      <button
                        key={branch}
                        onClick={() => toggleBranch(branch)}
                        className={`px-3 h-7 rounded-lg text-xs font-bold transition-all border ${
                          selectedBranches.includes(branch)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {selectedBranches.includes(branch) && <Check className="w-3 h-3 inline-block mr-1" />}
                        {branch}
                      </button>
                    ))}
                    {availableBranches.length === 0 && (
                      <span className="text-sm text-slate-400 italic py-2">Bu seviyede şube bulunamadı.</span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddCourseExam}
                className="mt-2 w-full h-8 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-lg transition-colors text-[14.67px] shadow-sm flex items-center justify-center cursor-pointer"
              >
                Ders Sınavını Ekle
              </button>
            </div>

            {examList.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-extrabold text-slate-800 text-sm">Eklenecek Ders Sınavları ({examList.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {examList.map(exam => (
                    <div key={exam.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800">{exam.gradeLevel} - {exam.course}</span>
                        <span className="text-xs font-medium text-slate-500 mt-1">Şubeler: {exam.branches.join(", ")}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            type: 'exam',
                            idToDelete: exam.id,
                            message: 'Bu ders sınavını silmek istediğinize emin misiniz?'
                          });
                        }}
                        className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSaveSession}
              className="mt-4 w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[14.67px] rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Sınavı Kaydet
            </button>
          </div>
        </div>
      )}
      {editingSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-violet-500" />
                Sınav Yapılacak Dersleri Düzenle
              </h2>
              <button 
                onClick={() => {
                  setEditingSession(null);
                  setGradeLevel("");
                  setSelectedCourse("");
                  setSelectedBranches([]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Oturum Bilgileri</span>
                  <span className="font-bold text-slate-800 text-sm mt-1">{editingSession.term} • {editingSession.examNo}</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Tarih</span>
                    <span className="font-bold text-slate-800 text-sm mt-1">{editingSession.examDate}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Saat</span>
                    <span className="font-bold text-slate-800 text-sm mt-1">{lessonHours.find(h => h.value === editingSession.lessonHour)?.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div className="flex flex-col gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h3 className="font-extrabold text-slate-800 text-sm mb-2">Yeni Ders Sınavı Ekle</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 ml-1">Sınıf Seviyesi</label>
                  <div className="relative">
                    <select 
                      value={gradeLevel}
                      onChange={(e) => {
                        setGradeLevel(e.target.value);
                        setSelectedBranches([]);
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
                    >
                      <option value="" disabled>Seviye Seçiniz</option>
                      {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 ml-1">Ders</label>
                  <div className="relative">
                    <select 
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
                    >
                      <option value="" disabled>Ders Seçiniz</option>
                      {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {gradeLevel && (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-xs font-bold text-slate-600 ml-1">Şubeler / Gruplar</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableBranches.map(branch => (
                      <button
                        key={branch}
                        onClick={() => toggleBranch(branch)}
                        className={`px-3 h-7 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          selectedBranches.includes(branch)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {selectedBranches.includes(branch) && <Check className="w-3 h-3 inline-block mr-1" />}
                        {branch}
                      </button>
                    ))}
                    {availableBranches.length === 0 && (
                      <span className="text-sm text-slate-400 italic py-2">Bu seviyede şube bulunamadı.</span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddCourseExamToEdit}
                className="mt-2 w-full h-8 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-lg transition-colors text-[14.67px] shadow-sm cursor-pointer flex items-center justify-center"
              >
                Ders Sınavını Ekle
              </button>
            </div>

            {editingExamList.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="font-extrabold text-slate-800 text-sm">Ders Sınavları ({editingExamList.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editingExamList.map(exam => (
                    <div key={exam.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800">{exam.gradeLevel} - {exam.course}</span>
                        <span className="text-xs font-medium text-slate-500 mt-1">Şubeler: {exam.branches.join(", ")}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            type: 'editExam',
                            idToDelete: exam.id,
                            message: 'Bu ders sınavını silmek istediğinize emin misiniz?'
                          });
                        }}
                        className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                        title="Ders Sınavını Çıkar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 font-medium text-sm">
                Bu oturuma eklenmiş ders sınavı bulunmuyor.
              </div>
            )}

            <div className="flex gap-4 mt-2">
              <button
                onClick={() => {
                  setEditingSession(null);
                  setGradeLevel("");
                  setSelectedCourse("");
                  setSelectedBranches([]);
                }}
                className="flex-1 h-8 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center justify-center"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEditedSession}
                className="flex-[2] h-8 bg-violet-600 hover:bg-violet-700 text-white font-black text-[14.67px] rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soru Yükleme Modalı */}
      {uploadModalState.isOpen && uploadModalState.examData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-slide-up border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-orange-600" />
                  Sınav Soruları Yükle
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {uploadModalState.examData.gradeLevel} • {uploadModalState.examData.courseName} Sınavı
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalState({ isOpen: false, examKey: null, examData: null })}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content / Upload Area */}
            <div className="space-y-4">
              {uploadedQuestions[uploadModalState.examKey!] ? (
                /* Already Uploaded State */
                <div className="p-5 bg-orange-50/40 border border-orange-200 rounded-2xl flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center animate-bounce">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-700">Yüklenmiş Sınav Sorusu</h4>
                    <p className="text-xs font-extrabold text-orange-700 mt-1 max-w-[320px] truncate mx-auto">
                      {uploadedQuestions[uploadModalState.examKey!].fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Yüklenme Tarihi: {uploadedQuestions[uploadModalState.examKey!].uploadedAt}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        alert(`"${uploadedQuestions[uploadModalState.examKey!].fileName}" dosyası indiriliyor...`);
                      }}
                      className="flex-1 h-9 bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>İndir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearQuestions(uploadModalState.examKey!)}
                      className="flex-1 h-9 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Soru Dosyasını Sil</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Upload Zone */
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setSelectedFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-[24px] p-8 text-center transition-all flex flex-col items-center justify-center gap-3 relative min-h-[180px] ${
                    dragActive 
                      ? 'border-orange-500 bg-orange-50/20 shadow-inner' 
                      : selectedFile 
                        ? 'border-emerald-400 bg-emerald-50/10' 
                        : 'border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="file"
                    id="exam-questions-file-picker"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  
                  {selectedFile ? (
                    <>
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="max-w-[320px]">
                        <p className="text-xs font-black text-slate-800 truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Boyut: {(selectedFile.size / 1024).toFixed(1)} KB • Tür: {selectedFile.type || "Bilinmiyor"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="text-rose-500 hover:text-rose-600 text-[10px] font-black underline cursor-pointer relative z-25 mt-1"
                      >
                        Dosyayı Çıkar
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center group-hover:text-slate-500">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-700">
                          Dosyayı buraya sürükleyin veya <span className="text-orange-600 underline">tıklayın</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          Desteklenen formatlar: PDF, Word (doc, docx), Excel, Görsel (.png, .jpg)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Alert info if no file selected */}
            {!uploadedQuestions[uploadModalState.examKey!] && !selectedFile && (
              <div className="p-3.5 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-150">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-slate-500 leading-normal">
                  Seçilen sınıf ve ders düzeyine ait resmi soru kâğıdı veya kitapçık PDF/Word belgesini yükleyiniz. Dosya, bu ortak sınavın soru arşivi olarak kaydedilecektir.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setUploadModalState({ isOpen: false, examKey: null, examData: null })}
                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Kapat
              </button>
              
              {!uploadedQuestions[uploadModalState.examKey!] && (
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={() => {
                    if (selectedFile) {
                      handleSaveQuestions(uploadModalState.examKey!, selectedFile.name);
                      setUploadModalState({ isOpen: false, examKey: null, examData: null });
                      setSelectedFile(null);
                    }
                  }}
                  className={`flex-1 h-11 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    selectedFile 
                      ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Soruları Kaydet</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Placement Retry / Recommendation Modal */}
      {placementIssue && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[30px] w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-red-100 bg-red-50/70 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">{placementIssue.title || 'Yerleştirme Tamamlanamadı'}</h2>
                  <p className="text-xs font-bold text-red-700 mt-1">
                    {Number(placementIssue.unseatedCount || 0) > 0
                      ? `${placementIssue.unseatedCount} öğrenci yerleştirilemedi.`
                      : 'Yerleştirme işlemi tamamlanamadı.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlacementIssue(null)}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {Array.isArray(placementIssue.reasons) && placementIssue.reasons.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2">Neden Yerleştirilemedi?</h3>
                  <div className="space-y-2">
                    {placementIssue.reasons.map((reason: string, index: number) => (
                      <div key={`${reason}-${index}`} className="p-3 rounded-xl border border-red-100 bg-red-50 text-[11px] font-bold text-red-800">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(placementIssue.students) && placementIssue.students.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2">Yerleştirilemeyen Öğrenciler</h3>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded-xl border border-slate-100 p-3 bg-slate-50">
                    {placementIssue.students.slice(0, 80).map((student: any, index: number) => (
                      <span key={`${student?.id || student?.number || index}-${index}`} className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-black text-slate-700">
                        {student?.name || 'Öğrenci'}{student?.classroom ? ` • ${student.classroom}` : ''}{student?.number ? ` • ${student.number}` : ''}
                      </span>
                    ))}
                    {placementIssue.students.length > 80 && (
                      <span className="px-2 py-1 text-[9px] font-black text-slate-500">+{placementIssue.students.length - 80} öğrenci</span>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(placementIssue.recommendations) && placementIssue.recommendations.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-xs font-black text-amber-900 mb-2">Dağıtım İçin Öneriler</h3>
                  <div className="space-y-1.5">
                    {placementIssue.recommendations.map((item: string, index: number) => (
                      <p key={`${item}-${index}`} className="text-[10px] font-bold text-amber-800">• {item}</p>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Yeniden Dağıtım Seçenekleri</h3>
                    <p className="text-[9px] font-semibold text-slate-400 mt-1">Tikleri değiştirin, önce Kaydet'e basın; sonra dağıtımı yeniden çalıştırın.</p>
                  </div>
                  {retryOptionsSaved && (
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[9px] font-black text-emerald-700">Kaydedildi</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {inlineSeatingCriteria.map((criterion) => (
                    <label key={`retry-${criterion.key}`} className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(retryCriteriaDraft[criterion.key])}
                        onChange={(e) => {
                          setRetryCriteriaDraft((prev) => ({ ...prev, [criterion.key]: e.target.checked }));
                          setRetryOptionsSaved(false);
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-[10px] font-bold text-slate-600 leading-relaxed">{criterion.label}</span>
                    </label>
                  ))}
                  <label className="md:col-span-2 flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retryAllowRecentRoomRepeat}
                      onChange={(e) => {
                        setRetryAllowRecentRoomRepeat(e.target.checked);
                        setRetryOptionsSaved(false);
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[10px] font-bold text-amber-900 leading-relaxed">
                      Bu dağıtım için 15 günlük aynı salon tekrar yasağını gevşet. Yalnız başka türlü yerleşemeyen öğrencilerde aynı salon tekrarına izin ver.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
              {placementIssue.capacityOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setPlacementIssue(null);
                    setActiveView('yerlesim');
                  }}
                  className="sm:mr-auto px-4 py-3 rounded-xl border border-violet-200 bg-white text-violet-700 text-xs font-black hover:bg-violet-50"
                >
                  Sınav Salonlarına Git
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  setSeatingCriteria({ ...retryCriteriaDraft });
                  await saveSeatingConfig({ seatingCriteria: retryCriteriaDraft });
                  setRetryOptionsSaved(true);
                }}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>
              <button
                type="button"
                disabled={!retryOptionsSaved || isGeneratingSeating}
                onClick={async () => {
                  setPlacementIssue(null);
                  const created = await handleGenerateSeating({
                    allowRecentRoomRepeat: retryAllowRecentRoomRepeat,
                    criteriaOverride: retryCriteriaDraft,
                  });
                  if (created) setActiveView('planlar');
                }}
                className={`px-5 py-3 rounded-xl text-white text-xs font-black flex items-center justify-center gap-2 ${
                  retryOptionsSaved && !isGeneratingSeating ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'
                }`}
              >
                {isGeneratingSeating ? <Hourglass className="w-4 h-4 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                {isGeneratingSeating
                  ? `Dağıtım Yapılıyor${placementProgress.total > 1 ? ` (${placementProgress.current}/${placementProgress.total})` : '...'}`
                  : 'Dağıtımı Yeniden Yap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-xl flex flex-col items-center text-center animate-slide-up">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Silme Onayı</h2>
            <p className="text-sm font-medium text-slate-500 mb-6">{deleteConfirm.message}</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, type: 'session', idToDelete: null, message: '' })}
                className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDeleteAction}
                className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
