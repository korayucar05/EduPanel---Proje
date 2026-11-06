import React, { useState, useEffect, useRef } from "react";
import { auditLog } from "../core/audit";
import { Plus, X, Search, Calendar, ChevronDown, Heart, MessageSquare, Download, Trash2, Pencil, Check, Send, MessageCircle, FileText, Printer, Users } from "lucide-react";
import localforage from "../core/state/AppStateService";
import { ActionPermissionNotice } from "./common";
import { welfareService } from "../modules/welfare";
import { BehaviorDisciplineModals } from "./behavior/BehaviorDisciplineModals";
import { BehaviorInfoNoteModal } from "./behavior/BehaviorInfoNoteModal";
import { BehaviorWhatsAppModal } from "./behavior/BehaviorWhatsAppModal";
import { deleteTeacherBehaviorSubmission, listTeacherBehaviorSubmissions } from "./behavior/teacherBehaviorCloud";
import { BehaviorRecordModal, BehaviorCatalogModals } from "./behavior/BehaviorEntryAndCatalogModals";
import { printBehaviorComplaint, printBehaviorGroupNotification } from "./behavior/behaviorPrintTools";

// Fail-safe storage utility for iframe environments where storage is blocked or restricted
const memoryStorage: Record<string, any> = {};
export const safeStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    if (welfareService.isDomainCollection(key)) {
      const rows = await welfareService.readCollection<any>(key);
      memoryStorage[key] = rows;
      return rows as T;
    }
    if (memoryStorage[key] !== undefined && memoryStorage[key] !== null) {
      return memoryStorage[key] as T;
    }
    try {
      const value = await localforage.getItem<T>(key);
      if (value !== null && value !== undefined) {
        memoryStorage[key] = value;
        return value;
      }
    } catch (e) {
      console.warn(`localforage read failed for "${key}":`, e);
    }
    try {
      const localValue = sqliteStorage.getItem(key);
      if (localValue !== null) {
        const parsed = JSON.parse(localValue) as T;
        memoryStorage[key] = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn(`sqliteStorage read failed for "${key}":`, e);
    }
    return (memoryStorage[key] as T) || null;
  },
  async setItem<T>(key: string, value: T): Promise<T> {
    if (welfareService.isDomainCollection(key) && Array.isArray(value)) {
      await welfareService.writeCollection(key, value as any[]);
      memoryStorage[key] = value;
      return value;
    }
    memoryStorage[key] = value;
    try {
      await localforage.setItem(key, value);
    } catch (e) {
      console.warn(`localforage write failed for "${key}":`, e);
    }
    try {
      sqliteStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`sqliteStorage write failed for "${key}":`, e);
    }
    return value;
  }
};
import { Student, Teacher } from "../types";

import { sqliteStorage } from "../core/state/SyncStateStore";
const readTeacherPhone = (teacher: any) => {
  const sources = [teacher, teacher?.contact, teacher?.contactInfo, teacher?.personalInfo, teacher?.profile].filter(Boolean);
  const keys = ["phone", "teacherPhone", "telefon", "telefonNo", "cepTelefonu", "cepTelefon", "mobile", "mobilePhone", "phoneNumber", "gsm", "gsmNo", "cellPhone"];
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
  }
  return "";
};

const TEACHER_LINK_FALLBACK_BEHAVIORS = [
  { id: "positive-help", type: "Olumlu" as const, name: "Arkadaşlarına yardımcı olma" },
  { id: "positive-duty", type: "Olumlu" as const, name: "Sorumluluklarını düzenli yerine getirme" },
  { id: "positive-respect", type: "Olumlu" as const, name: "Saygılı ve örnek davranış sergileme" },
  { id: "negative-disrupt", type: "Olumsuz" as const, name: "Ders düzenini bozma" },
  { id: "negative-rule", type: "Olumsuz" as const, name: "Okul kurallarına uymama" },
  { id: "negative-respect", type: "Olumsuz" as const, name: "Saygısız davranış sergileme" },
];

const normalizeStudentSearchText = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();

const matchesStudentSearch = (query: string, ...values: unknown[]) => {
  const searchTerms = normalizeStudentSearchText(query).split(" ").filter(Boolean);
  if (searchTerms.length === 0) return true;

  const searchableText = normalizeStudentSearchText(values.join(" "));
  return searchTerms.every(term => searchableText.includes(term));
};

const getStudentSchoolNumber = (student: Student) => {
  const studentData = student as Student & {
    number?: string | number;
    studentNumber?: string | number;
    studentNo?: string | number;
    schoolNumber?: string | number;
  };

  return String(
    studentData.studentNumber ??
    studentData.studentNo ??
    studentData.schoolNumber ??
    studentData.number ??
    student.id ??
    "",
  );
};

const PROCESSED_BEHAVIOR_RECORD_IDS_KEY = "processedBehaviorRecordIds_v1";
const BEHAVIOR_RECORD_HISTORY_KEY = "behaviorRecordHistory_v1";

export interface BehaviorRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClassroom: string;
  studentNumber: string;
  behaviorType: "Olumlu" | "Olumsuz" | "Gözlem";
  behaviorName: string;
  sanctionType?: string;
  date: string;
  description: string;
  teacherName: string;
  notePrepared?: boolean;
  messageSent?: boolean;
  warningCount?: number;
  boardReason?: string;
  createdAt?: number;
  sentTo?: string;
  sourceRecordId?: string;
  historyRecord?: boolean;
  disciplineStatus?: string;
  archiveSource?: "Uyarı Bildirimi" | "Disiplin Süreci";
  archiveGroupId?: string;
  archivedAt?: number;
  originalSanctionType?: string;
  letterSent?: boolean;
  studentsList?: { id: string; name: string; classroom: string; number: string; }[];
  completedSteps?: Record<string, boolean>;
  recordReason?: "Tutanak" | "Şikayet";
  complainantStudents?: { id: string; name: string; classroom: string; number: string; }[];
  complaintRegulationArticle?: string;
  cagriData?: any;
  ifadeData?: any;
  kararData?: any;
  rehberlikData?: any;
  yaziliIfadeData?: any;
  tebligData?: any;
}

const createBehaviorHistoryCopies = (sourceRecord: BehaviorRecord, sentToDestination: string): BehaviorRecord[] => {
  const sourceStudents = sourceRecord.studentsList?.length
    ? sourceRecord.studentsList
    : [{
        id: sourceRecord.studentId,
        name: sourceRecord.studentName,
        classroom: sourceRecord.studentClassroom,
        number: sourceRecord.studentNumber,
      }];

  return sourceStudents.map((student, index) => ({
    ...sourceRecord,
    id: `history-${sourceRecord.sourceRecordId || sourceRecord.id}-${student.id}`,
    sourceRecordId: sourceRecord.sourceRecordId || sourceRecord.id,
    historyRecord: true,
    studentId: student.id,
    studentName: student.name,
    studentClassroom: student.classroom || "",
    studentNumber: student.number || "",
    studentsList: [],
    notePrepared: true,
    sentTo: sentToDestination,
    createdAt: (sourceRecord.createdAt || Date.now()) + index,
  }));
};

interface CustomBehavior {
  id: string;
  type: "Olumlu" | "Olumsuz";
  name: string;
  regulationName?: string;
  article?: string;
  paragraph?: string;
  sanctionType?: string;
  points?: number;
  content?: string;
}

interface Sanction {
  id: string;
  regulationName: string;
  article: string;
  paragraph: string;
  sanctionType?: string;
  content: string;
  behaviorIds: string[];
}

interface Reward {
  id: string;
  name: string;
  points: number;
  behaviorIds: string[];
}

interface BehaviorModuleProps {
  students: Student[];
  teachers: Teacher[];
  initialFilterType?: string;
  hideFilterHeader?: boolean;
  onOpenDisciplineTab?: (tab: "Uyarı Bildirimi" | "Ön İnceleme" | "Disiplin Süreci" | "Arşiv") => void;
  enforceStudentScope?: boolean;
  scopeReason?: string;
  canManageRecords?: boolean;
}

export default function BehaviorModule({ students, teachers, initialFilterType = "All", hideFilterHeader = false, onOpenDisciplineTab, enforceStudentScope = false, scopeReason, canManageRecords = true }: BehaviorModuleProps) {
  const [filterType, setFilterType] = useState(initialFilterType);
  const scopeRecordList = (items: BehaviorRecord[]) => {
    if (!enforceStudentScope) return items;
    const ids = new Set(students.map((student: any) => String(student?.id ?? "").trim()).filter(Boolean));
    const names = new Set(students.map((student: any) => String(student?.fullName ?? student?.name ?? "").trim().toLocaleLowerCase("tr-TR")).filter(Boolean));
    const classes = new Set(students.map((student: any) => String(student?.classroom ?? student?.className ?? "").trim().toLocaleLowerCase("tr-TR")).filter(Boolean));
    return items.filter((record: any) => {
      const recordStudents = Array.isArray(record?.studentsList) && record.studentsList.length
        ? record.studentsList
        : [{ id: record?.studentId, name: record?.studentName, classroom: record?.studentClassroom }];
      return recordStudents.some((student: any) =>
        ids.has(String(student?.id ?? "").trim()) ||
        names.has(String(student?.name ?? "").trim().toLocaleLowerCase("tr-TR")) ||
        classes.has(String(student?.classroom ?? "").trim().toLocaleLowerCase("tr-TR"))
      );
    });
  };

  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [recordHistory, setRecordHistory] = useState<BehaviorRecord[]>([]);
  const processedRecordIdsRef = useRef<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTeacherLinkView, setIsTeacherLinkView] = useState(false);
  const [recordSearchQuery, setRecordSearchQuery] = useState("");
  const [recordStartDate, setRecordStartDate] = useState("");
  const [recordEndDate, setRecordEndDate] = useState("");
  
  // Form States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentsList, setSelectedStudentsList] = useState<Student[]>([]);
  const [isJointBehavior, setIsJointBehavior] = useState(false);
  const [recordReason, setRecordReason] = useState<"Tutanak" | "Şikayet">("Tutanak");
  const [complaintRegulationArticle, setComplaintRegulationArticle] = useState<string>("");
  const [complainantSearchQuery, setComplainantSearchQuery] = useState("");
  const [selectedComplainantsList, setSelectedComplainantsList] = useState<Student[]>([]);
  const [whatsappRecord, setWhatsappRecord] = useState<BehaviorRecord | null>(null);
  const [behaviorType, setBehaviorType] = useState<"Olumlu" | "Olumsuz" | "Gözlem">("Olumlu");
  const [behaviorName, setBehaviorName] = useState("");
  const [behaviorSanctionType, setBehaviorSanctionType] = useState<string | undefined>(undefined);
  const [behaviorSearchQuery, setBehaviorSearchQuery] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [studentDescriptions, setStudentDescriptions] = useState<Record<string, string>>({});
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  // Tutanak states
  const [isTutanakModalOpen, setIsTutanakModalOpen] = useState(false);
  const [tutanakDate, setTutanakDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [tutanakTeachers, setTutanakTeachers] = useState<string[]>([]);
  const [newTeacherInput, setNewTeacherInput] = useState("");
  const [tutanakStudents, setTutanakStudents] = useState<TutanakStudent[]>([]);
  const [selectedRecordIdsForTutanak, setSelectedRecordIdsForTutanak] = useState<string[]>([]);
  const [tutanakBehaviorFilter, setTutanakBehaviorFilter] = useState("Tümü");
  const [tutanakClassFilter, setTutanakClassFilter] = useState("Tümü");
  const [showTeacherSuggestions, setShowTeacherSuggestions] = useState(false);
  const [allTeachersList, setAllTeachersList] = useState<any[]>([]);

  // Şikayet Dilekçesi states
  const [complaintComplainants, setComplaintComplainants] = useState<Array<{
    id: string;
    name: string;
    classroom: string;
    number: string;
  }>>([]);
  const [complaintAccused, setComplaintAccused] = useState<Array<{
    id: string;
    name: string;
    classroom: string;
    number: string;
    behavior?: string;
  }>>([]);
  const [complaintSanction, setComplaintSanction] = useState("Kınama");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintComplainantSearchQuery, setComplaintComplainantSearchQuery] = useState("");
  const [complaintAccusedSearchQuery, setComplaintAccusedSearchQuery] = useState("");
  const [showComplaintComplainantSuggestions, setShowComplaintComplainantSuggestions] = useState(false);
  const [showComplaintAccusedSuggestions, setShowComplaintAccusedSuggestions] = useState(false);

  // Settings UI States
  const [settingsTab, setSettingsTab] = useState<"Davranışlar" | "Ödüller" | "Yaptırımlar">("Davranışlar");

  // Note Modal
  const [selectedRecordForNote, setSelectedRecordForNote] = useState<BehaviorRecord | null>(null);
  const [selectedRecordForStudentList, setSelectedRecordForStudentList] = useState<BehaviorRecord | null>(null);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const stored = (await localforage.getItem<any[]>("school_teachers")) || [];
        const local = JSON.parse(sqliteStorage.getItem("school_teachers") || "[]");
        const merged = new Map<string, any>();
        [...teachers, ...stored, ...local].forEach(teacher => {
          const key = String(teacher?.id || teacher?.name || "");
          if (!key) return;
          const current = merged.get(key);
          if (!current || (!readTeacherPhone(current) && readTeacherPhone(teacher))) merged.set(key, teacher);
        });
        setAllTeachersList(Array.from(merged.values()));
      } catch (e) {
        setAllTeachersList(teachers || []);
        console.error("Error loading teachers for tutanak", e);
      }
    };
    loadTeachers();
  }, [teachers, isTutanakModalOpen]);

  // Behavior Form Modal
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  const [newBehaviorType, setNewBehaviorType] = useState<"Olumlu" | "Olumsuz">("Olumlu");
  const [newBehaviorRegName, setNewBehaviorRegName] = useState("Ortaöğretim Kurumları Yönetmeliği");
  const [newBehaviorArticle, setNewBehaviorArticle] = useState("164");
  const [newBehaviorParagraph, setNewBehaviorParagraph] = useState("");
  const [newBehaviorSanctionType, setNewBehaviorSanctionType] = useState("Kınama");
  const [newBehaviorPoints, setNewBehaviorPoints] = useState<number | "">("");
  const [newBehaviorRegContent, setNewBehaviorRegContent] = useState("");
  const [newBehaviorInputName, setNewBehaviorInputName] = useState("");
  const [newBehaviorNamesList, setNewBehaviorNamesList] = useState<string[]>([]);
  const [editingBehaviorId, setEditingBehaviorId] = useState<string | null>(null);
  const [editingBehaviorName, setEditingBehaviorName] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDisciplineWarningModalOpen, setIsDisciplineWarningModalOpen] = useState(false);
  const [isDisciplineBoardModalOpen, setIsDisciplineBoardModalOpen] = useState(false);
  const [disciplineBoardReason, setDisciplineBoardReason] = useState("");
  const [recordToDiscipline, setRecordToDiscipline] = useState<BehaviorRecord | null>(null);
  const [disciplineWarningKinamaCount, setDisciplineWarningKinamaCount] = useState(1);
  const [jointStudentsDetails, setJointStudentsDetails] = useState<{
    studentName: string;
    classroom: string;
    number: string;
    hasPriorKinama: boolean;
    hasWarnings: boolean;
    isRepeatingThis: boolean;
    priorKinamaCount: number;
    warningCount: number;
    specificCount: number;
  }[]>([]);

  // Reward Form Modal
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardPoints, setNewRewardPoints] = useState<number | "">("");
  const [newRewardBehaviorIds, setNewRewardBehaviorIds] = useState<string[]>([]);

  // Sanction Form Modal
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [newSanctionRegName, setNewSanctionRegName] = useState("");
  const [newSanctionArticle, setNewSanctionArticle] = useState("");
  const [newSanctionParagraph, setNewSanctionParagraph] = useState("");
  const [newSanctionType, setNewSanctionType] = useState("");
  const [newSanctionContent, setNewSanctionContent] = useState("");
  const [newSanctionBehaviorIds, setNewSanctionBehaviorIds] = useState<string[]>([]);

  const behaviorOptions = {
    Olumlu: customBehaviors.filter(b => b.type === "Olumlu"),
    Olumsuz: customBehaviors.filter(b => b.type === "Olumsuz"),
    Gözlem: ["İçe Kapanıklık", "Dikkat Dağınıklığı", "Aşırı Hareketlilik", "Arkadaş İlişkilerinde Sorun", "Aile İçi Sorun Şüphesi"]
  };

  const toggleSelectRecordForTutanak = (recordId: string) => {
    setSelectedRecordIdsForTutanak((prev) => {
      if (prev.includes(recordId)) {
        return prev.filter((id) => id !== recordId);
      }

      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) return prev;

      const selectedDate = prev
        .map(id => records.find(record => record.id === id)?.date)
        .find(Boolean);

      if (selectedDate && targetRecord.date !== selectedDate) {
        alert("Yalnızca aynı tarihteki davranış kayıtları tek tutanakta birleştirilebilir.");
        return prev;
      }

      return [...prev, recordId];
    });
  };

  const openTutanakModalForRecords = (recordIds: string[]) => {
    const availableRecords = [...records, ...recordHistory];
    const selectedRecords = recordIds
      .map(id => availableRecords.find(record => record.id === id))
      .filter((record): record is BehaviorRecord => Boolean(record));

    if (selectedRecords.length === 0) {
      alert("Tutanak hazırlanacak davranış kaydı bulunamadı.");
      return;
    }

    const isComplaintMode = selectedRecords.some(record => record.recordReason === "Şikayet");
    const selectedDate = selectedRecords[0]?.date || "";
    const modalRecords = isComplaintMode
      ? selectedRecords
      : availableRecords.filter(record =>
          record.date === selectedDate &&
          record.behaviorType === "Olumsuz" &&
          record.recordReason !== "Şikayet" &&
          !record.historyRecord
        ).filter((record, index, rows) => rows.findIndex(item => item.id === record.id) === index);

    const preSelectedStudents: typeof tutanakStudents = [];
    const preSelectedComplainants: typeof complaintComplainants = [];
    let initialDescription = "";
    let initialSanction = "Kınama";

    modalRecords.forEach(record => {
      if (record.description) {
        initialDescription = [initialDescription, record.description].filter(Boolean).join("\n");
      }
      initialSanction = record.complaintRegulationArticle || record.sanctionType || initialSanction;

      if (record.studentsList?.length) {
        record.studentsList.forEach(student => {
          preSelectedStudents.push({
            id: student.id,
            name: student.name,
            classroom: student.classroom || "Belirtilmedi",
            number: student.number || "Belirtilmedi",
            behavior: record.behaviorName,
            sourceRecordId: record.id,
          });
        });
      } else {
        preSelectedStudents.push({
          id: record.studentId,
          name: record.studentName,
          classroom: record.studentClassroom || "Belirtilmedi",
          number: record.studentNumber || "Belirtilmedi",
          behavior: record.behaviorName,
          sourceRecordId: record.id,
        });
      }

      record.complainantStudents?.forEach(student => {
        if (!preSelectedComplainants.some(item => item.id === student.id)) {
          preSelectedComplainants.push({
            id: student.id,
            name: student.name,
            classroom: student.classroom || "Belirtilmedi",
            number: student.number || "Belirtilmedi",
          });
        }
      });
    });

    if (preSelectedStudents.length === 0) {
      alert("Seçilen davranış kaydında tutanağa eklenecek öğrenci bilgisi bulunamadı.");
      return;
    }

    setSelectedRecordIdsForTutanak(modalRecords.map(record => record.id));
    setTutanakStudents(preSelectedStudents);
    setTutanakBehaviorFilter("Tümü");
    setTutanakClassFilter("Tümü");
    setTutanakTeachers([]);
    setComplaintComplainants(preSelectedComplainants);
    setComplaintAccused(preSelectedStudents);
    setComplaintSanction(initialSanction);
    setComplaintDescription(initialDescription);
    setComplaintComplainantSearchQuery("");
    setComplaintAccusedSearchQuery("");
    setIsTutanakModalOpen(true);
  };

  const handlePrintTutanak = () => {
    const availableRecords = [...records, ...recordHistory];
    const selectedRecords = selectedRecordIdsForTutanak
      .map(id => availableRecords.find(record => record.id === id))
      .filter((record): record is BehaviorRecord => Boolean(record));
    const sourceRecord = selectedRecords[0];

    printBehaviorGroupNotification({
      students: filteredTutanakStudents,
      behaviorName: tutanakBehaviorFilter !== "Tümü"
        ? tutanakBehaviorFilter
        : sourceRecord?.behaviorName || filteredTutanakStudents[0]?.behavior || "İstenmeyen Davranışlar",
      behaviorType: "Olumsuz",
      behaviorDate: sourceRecord?.date || tutanakDate,
      notificationDate: tutanakDate,
      teachers: tutanakTeachers,
    });
  };

  const handlePrintComplaint = () => printBehaviorComplaint({
    complainants: complaintComplainants,
    accused: complaintAccused,
    description: complaintDescription,
    date: tutanakDate,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const teacherParam = searchParams.get("teacher");
    const isAddRecord = searchParams.get("addRecord");

    if (isAddRecord === "true") {
      const teacher = searchParams.get("t");
      const studentsStr = searchParams.get("s");
      const behavior = searchParams.get("b");
      const reason = searchParams.get("r");
      
      if (teacher && studentsStr && behavior) {
        // Auto add record
        const addIncomingRecord = async () => {
           const savedRecords = await safeStorage.getItem<BehaviorRecord[]>("behaviorRecords") || [];
           
           const newRecord: BehaviorRecord = {
             id: `REC-${Date.now()}`,
             studentId: "0",
             studentName: decodeURIComponent(studentsStr),
             studentClassroom: "",
             studentNumber: "",
             studentsList: [{id: "0", name: decodeURIComponent(studentsStr), classroom: "", number: ""}],
             behaviorType: "Olumsuz",
             behaviorName: decodeURIComponent(behavior),
             sanctionType: "Kınama",
             date: new Date().toISOString().split("T")[0],
             description: "Öğretmen tarafından iletildi.",
             teacherName: decodeURIComponent(teacher),
             createdAt: Date.now(),
             recordReason: (decodeURIComponent(reason || "Tutanak")) as "Tutanak" | "Şikayet",
             complainantStudents: []
           };
           
           const updatedRecords = [newRecord, ...savedRecords];
           setRecords(updatedRecords);
           await safeStorage.setItem("behaviorRecords", updatedRecords);
           alert("Öğretmenden gelen davranış kaydı başarıyla eklendi!");
        };
        addIncomingRecord();
      }
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (teacherParam) {
      // Decode params
      const decodedTeacher = decodeURIComponent(teacherParam);

      // Open the modal
      setIsModalOpen(true);
      setIsTeacherLinkView(true);
      setSelectedTeacher(decodedTeacher);
      
      // Default to "Olumsuz" behavior tab since this is usually for incidents, or leave as default.
      setBehaviorType("Olumsuz");
      
      // Clean up the URL so it doesn't happen on reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    const loadRecords = async () => {
      const savedHistory = await safeStorage.getItem<BehaviorRecord[]>(BEHAVIOR_RECORD_HISTORY_KEY) || [];
      setRecordHistory(savedHistory);
      const savedRecords = await safeStorage.getItem<BehaviorRecord[]>("behaviorRecords");
      if (savedRecords) {
        let hasChanges = false;
        const normalizedSavedRecords = savedRecords.map((r, index) => {
          if (r.createdAt === undefined) {
            hasChanges = true;
            // Assign a decreasing timestamp based on index so elements at the end have older timestamps
            return {
              ...r,
              createdAt: Date.now() - (index * 1000)
            };
          }
          return r;
        });
        const [previouslyProcessedIds, disciplineBoardRecords, disciplineWarnings] = await Promise.all([
          safeStorage.getItem<string[]>(PROCESSED_BEHAVIOR_RECORD_IDS_KEY).then(value => value || []),
          safeStorage.getItem<BehaviorRecord[]>("disciplineBoardRecords").then(value => value || []),
          safeStorage.getItem<BehaviorRecord[]>("disciplineWarnings").then(value => value || []),
        ]);
        const processedIds = Array.from(new Set([
          ...previouslyProcessedIds,
          ...disciplineBoardRecords.map(record => record.id),
          ...disciplineWarnings.map(record => record.id),
          ...normalizedSavedRecords.filter(record => record.notePrepared).map(record => record.id),
        ]));
        const migratedHistory = [...disciplineBoardRecords, ...disciplineWarnings]
          .flatMap(record => createBehaviorHistoryCopies(record, record.sentTo || (disciplineWarnings.some(item => item.id === record.id) ? "Uyarı Bildirimi" : "Ön İnceleme")));
        const mergedHistory = [...migratedHistory, ...savedHistory].filter(
          (record, index, rows) => rows.findIndex(item => item.id === record.id) === index,
        );
        setRecordHistory(scopeRecordList(mergedHistory));
        if (mergedHistory.length !== savedHistory.length) {
          await safeStorage.setItem(BEHAVIOR_RECORD_HISTORY_KEY, mergedHistory);
        }
        processedRecordIdsRef.current = new Set(processedIds);
        const updatedSavedRecords = normalizedSavedRecords.filter(record => !processedIds.includes(record.id));
        if (updatedSavedRecords.length !== normalizedSavedRecords.length || processedIds.length !== previouslyProcessedIds.length) {
          hasChanges = true;
          await safeStorage.setItem(PROCESSED_BEHAVIOR_RECORD_IDS_KEY, processedIds);
        }
        void Promise.allSettled(
          processedIds.map(id => fetch(`/api/public/behavior-link/records/${encodeURIComponent(id)}`, { method: "DELETE" })),
        );
        setRecords(scopeRecordList(updatedSavedRecords));
        if (hasChanges) {
          await safeStorage.setItem("behaviorRecords", updatedSavedRecords);
        }
      }
      
      // One-time clear of all registered behaviors as requested by the user
      const hasCleared = await safeStorage.getItem<string>("hasClearedBehaviors_v1");
      if (!hasCleared) {
        await safeStorage.setItem("customBehaviors", []);
        setCustomBehaviors([]);
        await safeStorage.setItem("hasClearedBehaviors_v1", "true");
      } else {
        const savedBehaviors = await safeStorage.getItem<CustomBehavior[]>("customBehaviors");
        if (savedBehaviors) {
          // Remove specific unwanted default behaviors
          const unwantedNames = ["Örnek Davranış", "Yardımlaşma", "Dersi Bölme", "Geç Kalma"];
          const filteredBehaviors = savedBehaviors.filter(b => !unwantedNames.includes(b.name));
          
          if (filteredBehaviors.length !== savedBehaviors.length) {
            setCustomBehaviors(filteredBehaviors);
            await safeStorage.setItem("customBehaviors", filteredBehaviors);
          } else {
            setCustomBehaviors(savedBehaviors);
          }
        }
      }

      const savedSanctions = await safeStorage.getItem<Sanction[]>("sanctions");
      if (savedSanctions) {
        setSanctions(savedSanctions);
      }

      const savedRewards = await safeStorage.getItem<Reward[]>("rewards");
      if (savedRewards) {
        setRewards(savedRewards);
      }
    };
    loadRecords();
  }, []);

  useEffect(() => {
    let active = true;
    const importTeacherRecords = async () => {
      try {
        const legacyResponse = await fetch("/api/public/behavior-link/records", { cache: "no-store" }).catch(() => null);
        const legacyRemote = legacyResponse?.ok ? await legacyResponse.json().catch(() => []) : [];
        const cloudRemote = await listTeacherBehaviorSubmissions().catch(() => []);
        const remote = [...(Array.isArray(legacyRemote) ? legacyRemote : []), ...(Array.isArray(cloudRemote) ? cloudRemote : [])];
        if (!active) return;
        const local = (await safeStorage.getItem<BehaviorRecord[]>("behaviorRecords")) || [];
        const [storedProcessedIds, disciplineBoardRecords, disciplineWarnings] = await Promise.all([
          safeStorage.getItem<string[]>(PROCESSED_BEHAVIOR_RECORD_IDS_KEY).then(value => value || []),
          safeStorage.getItem<BehaviorRecord[]>("disciplineBoardRecords").then(value => value || []),
          safeStorage.getItem<BehaviorRecord[]>("disciplineWarnings").then(value => value || []),
        ]);
        const processedIds = new Set([
          ...storedProcessedIds,
          ...disciplineBoardRecords.map(record => record.id),
          ...disciplineWarnings.map(record => record.id),
        ]);
        processedIds.forEach(id => processedRecordIdsRef.current.add(id));
        const merged = [...local, ...remote]
          .filter(record => !record.notePrepared && !processedRecordIdsRef.current.has(record.id))
          .filter((record, index, rows) => rows.findIndex(item => item.id === record.id) === index)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const activeRecords = merged.filter(record => !processedRecordIdsRef.current.has(record.id));
        setRecords(scopeRecordList(activeRecords));
        await safeStorage.setItem("behaviorRecords", activeRecords);
        const cloudIds = new Set((Array.isArray(cloudRemote) ? cloudRemote : []).map((record: any) => String(record?.id || "")).filter(Boolean));
        const importedCloudIds = activeRecords.map((record: any) => String(record?.id || "")).filter(id => cloudIds.has(id));
        void Promise.allSettled(importedCloudIds.map(id => deleteTeacherBehaviorSubmission(id)));
      } catch {}
    };
    importTeacherRecords();
    window.addEventListener("focus", importTeacherRecords);
    const timer = window.setInterval(importTeacherRecords, 10000);
    return () => { active = false; window.removeEventListener("focus", importTeacherRecords); window.clearInterval(timer); };
  }, []);

  const saveRecord = async (keepOpen = false) => {
    if (!canManageRecords) { alert("Bu rol davranış kaydı ekleyemez veya düzenleyemez."); return; }
    let finalStudents = [...selectedStudentsList];
    if (finalStudents.length === 0 && selectedStudent) {
      finalStudents = [selectedStudent];
    }

    if (finalStudents.length === 0 || !behaviorName) {
      alert("Lütfen en az bir öğrenci ve davranış seçiniz.");
      return;
    }

    const complainantStdsList = recordReason === "Şikayet" 
      ? selectedComplainantsList.map(s => ({
          id: s.id,
          name: s.name,
          classroom: s.classroom || "",
          number: s.id || ""
        }))
      : [];

    const auditBeforeRecord = editingRecordId ? records.find((record) => record.id === editingRecordId) : undefined;
    let updatedRecords = [...records];

    if (isJointBehavior && finalStudents.length > 1) {
      const firstStudent = finalStudents[0];
      const recStdsList = finalStudents.map(s => ({
        id: s.id,
        name: s.name,
        classroom: s.classroom || "",
        number: s.id || ""
      }));
      const joinedNames = finalStudents.map(s => s.name).join(", ");

      if (editingRecordId) {
        updatedRecords = records.map(r => {
          if (r.id === editingRecordId) {
            return {
              ...r,
              studentId: firstStudent.id,
              studentName: joinedNames,
              studentClassroom: firstStudent.classroom || "",
              studentNumber: firstStudent.id || "",
              studentsList: recStdsList,
              behaviorType,
              behaviorName,
              sanctionType: behaviorSanctionType,
              date,
              description,
              teacherName: selectedTeacher || "",
              createdAt: r.createdAt || Date.now(),
              recordReason,
              complainantStudents: complainantStdsList,
              complaintRegulationArticle: recordReason === "Şikayet" ? complaintRegulationArticle : undefined,
            };
          }
          return r;
        });
      } else {
        const newRecord: BehaviorRecord = {
          id: Math.random().toString(36).substring(2, 9),
          studentId: firstStudent.id,
          studentName: joinedNames,
          studentClassroom: firstStudent.classroom || "",
          studentNumber: firstStudent.id || "",
          studentsList: recStdsList,
          behaviorType,
          behaviorName,
          sanctionType: behaviorSanctionType,
          date,
          description,
          teacherName: selectedTeacher || "",
          createdAt: Date.now(),
          recordReason,
          complainantStudents: complainantStdsList,
          complaintRegulationArticle: recordReason === "Şikayet" ? complaintRegulationArticle : undefined,
        };
        updatedRecords = [newRecord, ...records];
      }
    } else {
      // Single student or multiple separate students (not joint)
      if (editingRecordId) {
        const firstStudent = finalStudents[0];
        updatedRecords = records.map(r => {
          if (r.id === editingRecordId) {
            return {
              ...r,
              studentId: firstStudent.id,
              studentName: firstStudent.name,
              studentClassroom: firstStudent.classroom || "",
              studentNumber: firstStudent.id || "",
              studentsList: [], // empty for separate
              behaviorType,
              behaviorName,
              sanctionType: behaviorSanctionType,
              date,
              description,
              teacherName: selectedTeacher || "",
              createdAt: r.createdAt || Date.now(),
              recordReason,
              complainantStudents: complainantStdsList,
              complaintRegulationArticle: recordReason === "Şikayet" ? complaintRegulationArticle : undefined,
            };
          }
          return r;
        });

        // Add the rest as separate records
        for (let i = 1; i < finalStudents.length; i++) {
          const std = finalStudents[i];
          const extraRecord: BehaviorRecord = {
            id: Math.random().toString(36).substring(2, 9),
            studentId: std.id,
            studentName: std.name,
            studentClassroom: std.classroom || "",
            studentNumber: std.id || "",
            studentsList: [],
            behaviorType,
            behaviorName,
            sanctionType: behaviorSanctionType,
            date,
            description,
            teacherName: selectedTeacher || "",
            createdAt: Date.now() + i,
            recordReason,
            complainantStudents: complainantStdsList,
            complaintRegulationArticle: recordReason === "Şikayet" ? complaintRegulationArticle : undefined,
          };
          updatedRecords = [extraRecord, ...updatedRecords];
        }
      } else {
        const newRecords: BehaviorRecord[] = finalStudents.map((std, idx) => ({
          id: Math.random().toString(36).substring(2, 9),
          studentId: std.id,
          studentName: std.name,
          studentClassroom: std.classroom || "",
          studentNumber: std.id || "",
          studentsList: [],
          behaviorType,
          behaviorName,
          sanctionType: behaviorSanctionType,
          date,
          description,
          teacherName: selectedTeacher || "",
          createdAt: Date.now() + idx,
          recordReason,
          complainantStudents: complainantStdsList,
          complaintRegulationArticle: recordReason === "Şikayet" ? complaintRegulationArticle : undefined,
        }));
        updatedRecords = [...newRecords, ...records];
      }
    }

    setRecords(updatedRecords);
    
    if (isTeacherLinkView) {
      const stdNames = finalStudents.map(s => s.name).join(", ");
      const typeStr = behaviorType === "Olumlu" ? "Olumlu" : behaviorType === "Olumsuz" ? "Olumsuz" : "Gözlem";
      const baseUrl = `${String(import.meta.env.VITE_HASAT_PUBLIC_APP_URL || "https://dersbende.com.tr").replace(/\/+$/, "")}${window.location.pathname}`;
      const addRecordUrl = `${baseUrl}?addRecord=true&t=${encodeURIComponent(selectedTeacher || "")}&s=${encodeURIComponent(stdNames)}&b=${encodeURIComponent(behaviorName)}&r=${encodeURIComponent(recordReason)}`;
      
      const whatsappText = `Yeni Davranış Kaydı:\n\nÖğretmen: ${selectedTeacher}\nÖğrenci(ler): ${stdNames}\nDavranış: ${behaviorName} (${typeStr})\n\nSisteme Kaydetmek İçin Tıklayın:\n${addRecordUrl}`;
      const a = document.createElement('a');
      a.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    await safeStorage.setItem("behaviorRecords", updatedRecords);
    void auditLog.record({
      action: editingRecordId ? "update" : "create", module: "behavior", targetType: "behaviorRecord",
      targetId: editingRecordId || updatedRecords[0]?.id,
      summary: `${finalStudents.map((student) => student.name).join(", ")} için davranış kaydı ${editingRecordId ? "güncellendi" : "oluşturuldu"}`,
      metadata: { behaviorName, behaviorType, studentCount: finalStudents.length },
      before: auditBeforeRecord,
      after: editingRecordId ? updatedRecords.find((record) => record.id === editingRecordId) : updatedRecords[0],
    });
    
    const shouldContinue = keepOpen && !editingRecordId && recordReason === "Tutanak" && !isTeacherLinkView;
    if (shouldContinue) {
      setSearchQuery("");
      setSelectedStudent(null);
      setSelectedStudentsList([]);
      setIsJointBehavior(false);
      setBehaviorName("");
      setBehaviorSanctionType(undefined);
      setBehaviorSearchQuery("");
      setDescription("");
      setStudentDescriptions({});
      return;
    }

    // Reset and close
    closeModal();
  };

  const deleteRecord = (id: string) => {
    if (!canManageRecords) { alert("Bu rol davranış kaydı silemez."); return; }
    setDeleteRecordId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteRecord = async () => {
    if (!canManageRecords) { alert("Bu rol davranış kaydı silemez."); return; }
    if (deleteRecordId) {
      if (recordHistory.some(record => record.id === deleteRecordId)) {
        const updatedHistory = recordHistory.filter(record => record.id !== deleteRecordId);
        setRecordHistory(updatedHistory);
        await safeStorage.setItem(BEHAVIOR_RECORD_HISTORY_KEY, updatedHistory);
        void auditLog.record({ action: "delete", module: "behavior", targetType: "behaviorHistory", targetId: deleteRecordId, summary: "Davranış geçmişi kaydı silindi" });
        setDeleteRecordId(null);
        setIsDeleteModalOpen(false);
        return;
      }
      const deletedRecord = records.find((record) => record.id === deleteRecordId);
      const updatedRecords = records.filter(r => r.id !== deleteRecordId);
      setRecords(updatedRecords);
      await safeStorage.setItem("behaviorRecords", updatedRecords);
      void auditLog.record({ action: "delete", module: "behavior", targetType: "behaviorRecord", targetId: deleteRecordId, summary: "Davranış kaydı silindi", before: deletedRecord });
      setDeleteRecordId(null);
      setIsDeleteModalOpen(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSearchQuery("");
    setSelectedStudent(null);
    setSelectedStudentsList([]);
    setIsJointBehavior(false);
    setRecordReason("Tutanak");
    setComplainantSearchQuery("");
    setSelectedComplainantsList([]);
    setComplaintRegulationArticle("");
    setBehaviorType("Olumlu");
    setBehaviorName("");
    setBehaviorSanctionType(undefined);
    setBehaviorSearchQuery("");
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setStudentDescriptions({});
    setSelectedTeacher("");
    setEditingRecordId(null);
  };

  const continueAddingStudentsToRecord = (record: BehaviorRecord) => {
    if (!canManageRecords) { alert("Bu rol davranış kaydını düzenleyemez."); return; }

    const stdsList: Student[] = [];
    if (record.studentsList && record.studentsList.length > 0) {
      record.studentsList.forEach(item => {
        const found = students.find(s => s.id === item.id);
        if (found) {
          stdsList.push(found);
        } else {
          stdsList.push({
            id: item.id,
            name: item.name,
            classroom: item.classroom,
            phone: "",
            parentName: "",
            parentPhone: "",
            status: "Aktif",
            registerDate: "",
            avatar: ""
          } as Student);
        }
      });
    } else {
      const found = students.find(s => s.id === record.studentId);
      if (found) {
        stdsList.push(found);
      } else {
        stdsList.push({
          id: record.studentId,
          name: record.studentName,
          classroom: record.studentClassroom,
          phone: "",
          parentName: "",
          parentPhone: "",
          status: "Aktif",
          registerDate: "",
          avatar: ""
        } as Student);
      }
    }

    const complainantsList: Student[] = [];
    if (record.complainantStudents && record.complainantStudents.length > 0) {
      record.complainantStudents.forEach(item => {
        const found = students.find(s => s.id === item.id);
        if (found) {
          complainantsList.push(found);
        } else {
          complainantsList.push({
            id: item.id,
            name: item.name,
            classroom: item.classroom,
            phone: "",
            parentName: "",
            parentPhone: "",
            status: "Aktif",
            registerDate: "",
            avatar: ""
          } as Student);
        }
      });
    }

    setSelectedStudentsList(stdsList);
    setSelectedStudent(stdsList[0] || null);
    // Ok ile devam edilen kayıt, yeni öğrenci eklendiğinde aynı toplu kayıt olarak korunur.
    setIsJointBehavior(true);
    setSelectedComplainantsList(complainantsList);
    setRecordReason(record.recordReason || "Tutanak");
    setComplaintRegulationArticle(record.complaintRegulationArticle || "");
    setBehaviorType(record.behaviorType);
    setBehaviorName(record.behaviorName);
    setBehaviorSanctionType(record.sanctionType);
    setDate(record.date);
    setDescription(record.description || "");
    setSelectedTeacher(record.teacherName || "");
    setSearchQuery("");
    setBehaviorSearchQuery("");
    setEditingRecordId(record.id);
    setIsModalOpen(true);
  };

  const handleSendForProcessing = async (record: BehaviorRecord) => {
    if (!canManageRecords) { alert("Bu rol kaydı işleme sevk edemez."); return; }

    const normalizeBehaviorName = (value: unknown) =>
      String(value || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

    const belongsToStudent = (candidate: BehaviorRecord, studentId: string) => {
      if (candidate.studentId === studentId) return true;
      return Boolean(candidate.studentsList?.some(student => student.id === studentId));
    };

    const isNegative = (candidate: BehaviorRecord) =>
      String(candidate.behaviorType || "").toLocaleLowerCase("tr-TR").trim() === "olumsuz";

    const routeToGuidance = async (sourceRecord: BehaviorRecord) => {
      const response = await fetch("/api/guidance/behavior-records/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: sourceRecord }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Kayıt rehberlik servisine gönderilemedi.");
      }
      await markAsSent(sourceRecord.id, "Rehberlik Servisi");
    };

    // Olumlu davranışlar rehberlikte doğrudan olumlu davranış arşivine gider.
    if (String(record.behaviorType || "").toLocaleLowerCase("tr-TR").trim() === "olumlu") {
      try {
        await routeToGuidance(record);
        alert("Olumlu davranış Rehberlik > Olumlu Davranışlar alanına kaydedildi.");
      } catch (error: any) {
        alert(error?.message || "Olumlu davranış rehberliğe gönderilemedi.");
      }
      return;
    }

    // Bu otomatik yönlendirme kuralı yalnız olumsuz davranış kayıtları içindir.
    if (!isNegative(record)) {
      setRecordToDiscipline(record);
      setDisciplineBoardReason(record.sanctionType || "Detaylı İnceleme");
      setIsDisciplineBoardModalOpen(true);
      return;
    }

    const [storedWarnings, storedBoardRecords, storedArchiveRecords, storedHistory] = await Promise.all([
      safeStorage.getItem<BehaviorRecord[]>("disciplineWarnings").then(value => value || []),
      safeStorage.getItem<BehaviorRecord[]>("disciplineBoardRecords").then(value => value || []),
      safeStorage.getItem<BehaviorRecord[]>("disciplineArchiveRecords").then(value => value || []),
      safeStorage.getItem<BehaviorRecord[]>(BEHAVIOR_RECORD_HISTORY_KEY).then(value => value || []),
    ]);

    // Öğrencinin bugüne kadarki bütün olumsuz davranışlarını tek listede topla.
    // sourceRecordId/id ile tekilleştirme yapıldığı için aynı kayıt farklı arşivlerde olsa bile bir kez sayılır.
    const allKnownNegativeRecords = [
      ...records,
      ...recordHistory,
      ...storedHistory,
      ...storedWarnings,
      ...storedBoardRecords,
      ...storedArchiveRecords,
    ].filter(isNegative);

    const getRoutingStats = (studentId: string) => {
      const currentKey = String(record.sourceRecordId || record.id || "");
      const previous = allKnownNegativeRecords
        .filter(candidate => belongsToStudent(candidate, studentId))
        .filter(candidate => String(candidate.sourceRecordId || candidate.id || "") !== currentKey)
        .filter((candidate, index, rows) => {
          const key = String(candidate.sourceRecordId || candidate.id || "");
          return rows.findIndex(item => String(item.sourceRecordId || item.id || "") === key) === index;
        });

      const currentBehavior = normalizeBehaviorName(record.behaviorName);
      const sameBehaviorCount = previous.filter(
        candidate => normalizeBehaviorName(candidate.behaviorName) === currentBehavior,
      ).length;

      const priorDistinctBehaviorNames = new Set(
        previous
          .map(candidate => normalizeBehaviorName(candidate.behaviorName))
          .filter(Boolean),
      );

      const distinctCountWithCurrent = new Set([
        ...priorDistinctBehaviorNames,
        currentBehavior,
      ].filter(Boolean)).size;

      return {
        sameBehaviorCount,
        priorNegativeCount: previous.length,
        distinctCountWithCurrent,
        shouldPreInspect: sameBehaviorCount >= 1 || distinctCountWithCurrent >= 3,
      };
    };

    const studentRefs = record.studentsList?.length
      ? record.studentsList.map(student => ({ id: student.id, name: student.name }))
      : [{ id: record.studentId, name: record.studentName }];

    const routingResults = studentRefs.map(student => ({
      ...student,
      stats: getRoutingStats(student.id),
    }));

    // Ortak davranışta öğrencilerden biri Ön İnceleme eşiğine ulaştıysa kayıt Ön İnceleme'ye gider.
    const preInspectionStudent = routingResults.find(item => item.stats.shouldPreInspect);

    if (preInspectionStudent) {
      const reason = preInspectionStudent.stats.sameBehaviorCount >= 1
        ? `${preInspectionStudent.name || "Öğrenci"}: aynı olumsuz davranışın ikinci kez tekrarı`
        : `${preInspectionStudent.name || "Öğrenci"}: üçüncü farklı olumsuz davranış`;

      try {
        await welfareService.sendBehaviorToDiscipline(record as any, "Ön İnceleme", {
          boardReason: reason,
          routingRule: preInspectionStudent.stats.sameBehaviorCount >= 1
            ? "same-negative-second-time"
            : "third-distinct-negative",
        });
        await markAsSent(record.id, "Ön İnceleme");
        alert(`Kayıt Disiplin > Ön İnceleme alanına gönderildi.\n\nNeden: ${reason}`);
      } catch (error: any) {
        alert(error?.message || "Kayıt Ön İnceleme'ye gönderilemedi.");
      }
      return;
    }

    // İlk olumsuz davranış veya ikinci fakat FARKLI olumsuz davranış rehberlik servisine gider.
    try {
      await routeToGuidance(record);
      const firstStudent = routingResults[0];
      const reason = firstStudent?.stats.priorNegativeCount === 0
        ? "Öğrencinin ilk olumsuz davranışı"
        : "Önceki olumsuz davranıştan farklı ikinci davranış";
      alert(`Kayıt görüşülmek üzere Rehberlik Servisine gönderildi.\n\n${reason}.`);
    } catch (error: any) {
      alert(error?.message || "Kayıt rehberlik servisine gönderilemedi.");
    }
  };

  const confirmSendToDisciplineBoard = async () => {
    if (!recordToDiscipline) return;
    await welfareService.sendBehaviorToDiscipline(recordToDiscipline as any, "Ön İnceleme", { boardReason: disciplineBoardReason });
    processedRecordIdsRef.current.add(recordToDiscipline.id);
    setRecords(current => current.filter(record => record.id !== recordToDiscipline.id));
    setIsDisciplineBoardModalOpen(false);
    setRecordToDiscipline(null);
    alert("Kayıt, Disiplin > Ön İnceleme sekmesine gönderildi.");
  };

  const sendToKurulaSevk = async (record: BehaviorRecord) => {
    await welfareService.sendBehaviorToDiscipline(record as any, "Ön İnceleme");
    processedRecordIdsRef.current.add(record.id);
    setRecords(current => current.filter(item => item.id !== record.id));
    alert("Kayıt Ön İnceleme'ye gönderildi.");
  };

  const confirmSendToDisciplineWarning = async () => {
    if (!recordToDiscipline) return;
    await welfareService.sendBehaviorToDiscipline(recordToDiscipline as any, "Uyarı Bildirimi", { warningCount: disciplineWarningKinamaCount });
    processedRecordIdsRef.current.add(recordToDiscipline.id);
    setRecords(current => current.filter(record => record.id !== recordToDiscipline.id));
    setIsDisciplineWarningModalOpen(false);
    setRecordToDiscipline(null);
    alert("Kayıt, Disiplin > Uyarı Bildirimi sekmesine gönderildi.");
  };

  const handleSendWhatsAppInline = async (record: BehaviorRecord) => {
    const recStds = record.studentsList && record.studentsList.length > 0 
      ? record.studentsList 
      : [{ id: record.studentId, name: record.studentName, classroom: record.studentClassroom, number: record.studentNumber }];
    
    if (recStds.length > 1) {
      setWhatsappRecord(record);
    } else {
      const std = recStds[0];
      const studentObj = students.find(s => s.id === std.id);
      const phone = studentObj?.parentPhone || "";
      if (!phone) {
        alert("Velinin telefon numarası kayıtlı değil.");
        return;
      }
      const text = `Sayın Veli,\n\nÖğrencimiz ${std.name}, ${new Date(record.date).toLocaleDateString('tr-TR')} tarihinde okulumuzda '${record.behaviorName}' ${record.behaviorType === 'Olumlu' ? 'davranışını sergileyerek örnek olmuştur.' : record.behaviorType === 'Olumsuz' ? 'davranışını sergilemiştir.' : 'durumu ile gözlemlenmiştir.'}\n\n${record.behaviorType === 'Olumlu' ? 'Öğrencimizi bu olumlu davranışından dolayı tebrik eder, destekleriniz için teşekkür ederiz.' : 'Öğrencimizin gelişimine destek olmak adına bu durumu bilgilerinize sunarız.'}\n\nİyi çalışmalar dileriz.\n\n${record.teacherName || "Okul Yönetimi"}\nÖğretmen`;
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://api.whatsapp.com/send?phone=90${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(text)}`;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      const updatedRecords = records.map((r) =>
        r.id === record.id ? { ...r, messageSent: true } : r
      );
      setRecords(updatedRecords);
      await safeStorage.setItem("behaviorRecords", updatedRecords);
    }
  };

  const markAsSent = async (id: string, _sentToDestination?: string) => {
    const sourceRecord = records.find(record => record.id === id)
      || (await safeStorage.getItem<BehaviorRecord[]>("behaviorRecords") || []).find(record => record.id === id);
    const sentToDestination = _sentToDestination || "Disiplin İşlemi";

    if (sourceRecord) {
      const historyCopies = createBehaviorHistoryCopies(sourceRecord, sentToDestination);
      const storedHistory = await safeStorage.getItem<BehaviorRecord[]>(BEHAVIOR_RECORD_HISTORY_KEY) || [];
      const mergedHistory = [...historyCopies, ...storedHistory].filter(
        (record, index, rows) => rows.findIndex(item => item.id === record.id) === index,
      );
      setRecordHistory(scopeRecordList(mergedHistory));
      await safeStorage.setItem(BEHAVIOR_RECORD_HISTORY_KEY, mergedHistory);
    }

    processedRecordIdsRef.current.add(id);
    setRecords(currentRecords => currentRecords.filter(record => record.id !== id));

    const processedIds = await safeStorage.getItem<string[]>(PROCESSED_BEHAVIOR_RECORD_IDS_KEY) || [];
    if (!processedIds.includes(id)) {
      await safeStorage.setItem(PROCESSED_BEHAVIOR_RECORD_IDS_KEY, [...processedIds, id]);
    }
    const storedRecords = await safeStorage.getItem<BehaviorRecord[]>("behaviorRecords") || [];
    const updatedRecords = storedRecords.filter(record => record.id !== id);
    await safeStorage.setItem("behaviorRecords", updatedRecords);

    try {
      if (sourceRecord) {
        await fetch(`/api/database/collections/behaviorRecords/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...sourceRecord,
            notePrepared: true,
            sentTo: sentToDestination,
          }),
        });
      }
      await fetch(`/api/public/behavior-link/records/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Yerel işlem kimliği kaydı, bağlantı hatasında kaydın yeniden görünmesini engeller.
    }
  };

  const handlePrepareNote = async (record: BehaviorRecord) => {
    setSelectedRecordForNote(record);
    if (!record.notePrepared) {
      await markAsSent(record.id, "Disiplin İşlemi");
    }
  };

  const filteredStudents = students
    .filter(student => matchesStudentSearch(
      searchQuery,
      student.name,
      getStudentSchoolNumber(student),
      student.id,
    ))
    .slice(0, 50);

  const filteredComplainants = students.filter(s => 
    s.name.toLowerCase().includes(complainantSearchQuery.toLowerCase()) || 
    s.id?.includes(complainantSearchQuery)
  );

  const filteredComplaintComplainantsSearch = students.filter(s =>
    s.name.toLowerCase().includes(complaintComplainantSearchQuery.toLowerCase()) ||
    s.id?.includes(complaintComplainantSearchQuery)
  );

  const filteredComplaintAccusedSearch = students.filter(s =>
    s.name.toLowerCase().includes(complaintAccusedSearchQuery.toLowerCase()) ||
    s.id?.includes(complaintAccusedSearchQuery)
  );

  const isComplaintSelected = selectedRecordIdsForTutanak.some(id => {
    const match = records.find(r => r.id === id);
    return match?.recordReason === "Şikayet";
  });

  const filteredTeachersForSearch = allTeachersList.filter(t => 
    t.name?.toLowerCase().includes(newTeacherInput.toLowerCase())
  );

  const tutanakBehaviorOptions = Array.from(new Set(
    tutanakStudents.map(student => String(student.behavior || "").trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));

  const tutanakClassOptions = Array.from(new Set(
    tutanakStudents.map(student => String(student.classroom || "").trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }));

  const filteredTutanakStudents = [...tutanakStudents]
    .filter(student => tutanakBehaviorFilter === "Tümü" || student.behavior === tutanakBehaviorFilter)
    .filter(student => tutanakClassFilter === "Tümü" || student.classroom === tutanakClassFilter)
    .sort((a, b) => {
      if (tutanakBehaviorFilter === "Tümü") {
        const behaviorCompare = String(a.behavior || "").localeCompare(String(b.behavior || ""), "tr", { sensitivity: "base" });
        if (behaviorCompare !== 0) return behaviorCompare;
      }
      const classCompare = String(a.classroom || "").localeCompare(String(b.classroom || ""), "tr", { numeric: true, sensitivity: "base" });
      if (classCompare !== 0) return classCompare;
      const numberA = Number(String(a.number || "").replace(/\D/g, ""));
      const numberB = Number(String(b.number || "").replace(/\D/g, ""));
      const safeA = Number.isFinite(numberA) ? numberA : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isFinite(numberB) ? numberB : Number.MAX_SAFE_INTEGER;
      if (safeA !== safeB) return safeA - safeB;
      return String(a.name || "").localeCompare(String(b.name || ""), "tr", { sensitivity: "base" });
    });

  const allBehaviorsList = [
    ...customBehaviors.map(b => ({ id: b.id, name: b.name, type: b.type, sanctionType: b.sanctionType, article: b.article, content: b.content })),
    ...(behaviorOptions["Gözlem"] as string[]).map((name, index) => ({ id: `gozlem-${index}`, name, type: "Gözlem" as const, sanctionType: undefined, article: undefined, content: undefined }))
  ];

  const filteredBehaviorsForSelect = allBehaviorsList.filter(b => {
    const searchTerms = behaviorSearchQuery.toLowerCase().split(' ').filter(Boolean);
    return searchTerms.length === 0 || searchTerms.every(term => 
      b.name.toLowerCase().includes(term) ||
      (b.article && b.article.toLowerCase().includes(term)) ||
      (b.content && b.content.toLowerCase().includes(term))
    );
  });

  const recordsForSelectedView = filterType === "Olumlu"
    ? [...records, ...recordHistory].filter(
        (record, index, rows) => rows.findIndex(item => item.id === record.id) === index,
      )
    : records;

  const filteredRecords = recordsForSelectedView.filter(r => {
    let matchesType = false;
    if (filterType === "All") {
      matchesType = !r.notePrepared;
    } else if (filterType === "Olumsuz") {
      matchesType = r.behaviorType === "Olumsuz" && !r.notePrepared;
    } else if (filterType === "Olumlu") {
      matchesType = true; // Kayıt Listesi lists everything
    } else {
      matchesType = r.behaviorType === filterType;
    }
    const matchesSearch = (() => {
      if (r.studentsList && r.studentsList.length > 0) {
        return r.studentsList.some(student =>
          matchesStudentSearch(recordSearchQuery, student.name, student.number, student.id)
        );
      }
      return matchesStudentSearch(
        recordSearchQuery,
        r.studentName,
        r.studentNumber,
        r.studentId,
      );
    })();
    
    let matchesDate = true;
    if (recordStartDate || recordEndDate) {
      const recordDate = new Date(r.date);
      recordDate.setHours(0, 0, 0, 0);
      
      if (recordStartDate) {
        const start = new Date(recordStartDate);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) matchesDate = false;
      }
      
      if (recordEndDate) {
        const end = new Date(recordEndDate);
        end.setHours(0, 0, 0, 0);
        if (recordDate > end) matchesDate = false;
      }
    }
    
    return matchesType && matchesSearch && matchesDate;
  });

  return (
    <div
      id="behavior-module-container"
      className="mx-auto w-full max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0"
    >
      {!canManageRecords && <ActionPermissionNotice message="Davranış kayıtlarını inceleyebilirsiniz; ancak bu rol ile kayıt ekleme, düzenleme, silme veya disiplin sürecine sevk işlemi yapılamaz." />}
      {/* Filter and Add Button */}
      {!hideFilterHeader && (
        <div className="bg-white border-2 border-dashed border-teal-600 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center overflow-x-auto gap-1.5 bg-teal-600 bg-theme-pattern p-1.5 rounded-2xl w-full scrollbar-hide shrink-0 h-[52px]">
            {["All", "Olumlu"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border text-center whitespace-nowrap h-[40px] ${
                  filterType === type
                    ? "bg-white text-teal-700 shadow-sm border-transparent"
                    : "text-teal-50 hover:text-white hover:bg-teal-700/50 border-white"
                }`}
              >
                {type === "All" ? "Davranış Kaydı" : "Davranış Listesi"}
              </button>
            ))}
            <div className="h-6 w-px bg-teal-800/50 self-center mx-1 shrink-0" />
            {(["Uyarı Bildirimi", "Ön İnceleme", "Disiplin Süreci", "Arşiv"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => onOpenDisciplineTab?.(tab)}
                className="flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border border-white bg-amber-800 text-amber-50 hover:bg-amber-900 hover:text-white text-center whitespace-nowrap h-[40px]"
              >
                {tab}
              </button>
            ))}
            {filterType === "All" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-none bg-white hover:bg-teal-50 text-teal-700 font-bold text-xs px-5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap h-[40px] border border-white"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Yeni Davranış Girişi</span>
              </button>
            )}
          </div>
        </div>
      )}

      {filterType === "Davranışlar / Ödüller - Yaptırımlar" ? (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
          <div className="flex items-center gap-4 p-6 border-b border-slate-100 bg-slate-50">
            {["Davranışlar", "Ödüller"].map(tab => (
              <button
                key={tab}
                onClick={() => setSettingsTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${settingsTab === tab ? "bg-teal-600 text-white shadow-md shadow-teal-600/20" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
              >
                {tab === "Davranışlar" ? "Olumsuz davranışlar" : "Olumlu davranışlar"}
              </button>
            ))}
          </div>
          
          <div className="p-6 lg:p-8 flex-1">
            {settingsTab === "Davranışlar" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-lg font-bold text-slate-800">Davranış Listesi</h3>
                  <div className="flex items-center gap-2">
                    {customBehaviors.length > 0 && (
                      <button
                        onClick={async () => {
                          if (confirm("Sistemdeki TÜM davranışları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
                            setCustomBehaviors([]);
                            await safeStorage.setItem("customBehaviors", []);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Tümünü Sil
                      </button>
                    )}
                    <button
                      onClick={() => setIsBehaviorModalOpen(true)}
                      className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Davranış Ekle
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider">
                        <th className="px-6 py-4">Davranış Adı</th>
                        <th className="px-6 py-4">Yönetmelik Maddesi</th>
                        <th className="px-6 py-4">Yaptırım Türü</th>
                        <th className="px-6 py-4">Yönetmelik Bilgisi</th>
                        <th className="px-6 py-4 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                      {[...customBehaviors].sort((a, b) => {
                        const pA = a.paragraph || "";
                        const pB = b.paragraph || "";
                        if (!pA && pB) return 1;
                        if (pA && !pB) return -1;
                        return pA.localeCompare(pB, "tr", { numeric: true, sensitivity: "base" });
                      }).map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${b.type === 'Olumlu' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                              <span>{b.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs break-words font-medium text-[11px]">
                            {b.content || <span className="text-slate-400 italic font-normal">-</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-800">{b.sanctionType || <span className="text-slate-400 italic font-normal">-</span>}</span>
                              {b.points !== undefined && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${Number(b.points) < 0 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                  {b.points > 0 ? `+${b.points}` : b.points} Puan
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium text-[11px]">
                            {b.regulationName ? (
                              <div className="space-y-0.5">
                                <div className="text-slate-800 font-bold">{b.regulationName}</div>
                                <div className="text-slate-500 font-medium">
                                  {b.article}. madde {b.paragraph ? `- ${b.paragraph}` : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-normal">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingBehaviorId(b.id);
                                  setNewBehaviorType(b.type);
                                  setNewBehaviorRegName(b.regulationName || "Ortaöğretim Kurumları Yönetmeliği");
                                  setNewBehaviorArticle(b.article || "164");
                                  setNewBehaviorParagraph(b.paragraph || "");
                                  setNewBehaviorSanctionType(b.sanctionType || "Kınama");
                                  setNewBehaviorPoints(b.points !== undefined ? b.points : "");
                                  setNewBehaviorRegContent(b.content || "");
                                  setNewBehaviorInputName(b.name);
                                  setIsBehaviorModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm("Bu davranışı silmek istediğinize emin misiniz?")) {
                                    const updated = customBehaviors.filter(cb => cb.id !== b.id);
                                    setCustomBehaviors(updated);
                                    await safeStorage.setItem("customBehaviors", updated);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {customBehaviors.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400 italic font-medium bg-slate-50/50">
                            Kayıtlı davranış bulunmuyor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settingsTab === "Ödüller" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">Ödül Listesi</h3>
                  <button
                    onClick={() => setIsRewardModalOpen(true)}
                    className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ödül Ekle
                  </button>
                </div>
                <div className="space-y-3">
                  {rewards.map(reward => (
                    <div key={reward.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800">{reward.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-lg">+{reward.points} Puan</span>
                          <button
                            onClick={async () => {
                              if (confirm("Bu ödülü silmek istediğinize emin misiniz?")) {
                                const updated = rewards.filter(r => r.id !== reward.id);
                                setRewards(updated);
                                await safeStorage.setItem("rewards", updated);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">İlişkili Davranışlar:</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {reward.behaviorIds.map(bid => {
                          const b = customBehaviors.find(cb => cb.id === bid);
                          return b ? <span key={bid} className="bg-white border border-slate-200 px-2 py-1 rounded text-xs text-slate-600">{b.name}</span> : null;
                        })}
                      </div>
                    </div>
                  ))}
                  {rewards.length === 0 && <div className="text-sm text-slate-500 italic">Kayıtlı ödül yok.</div>}
                </div>
              </div>
            )}

            {settingsTab === "Yaptırımlar" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">Yaptırım Listesi (Yönetmelik)</h3>
                  <button
                    onClick={() => setIsSanctionModalOpen(true)}
                    className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Yaptırım Ekle
                  </button>
                </div>
                <div className="space-y-4">
                  {sanctions.map(sanction => (
                    <div key={sanction.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <div className="font-bold text-slate-800">{sanction.regulationName}</div>
                          <div className="text-sm text-rose-600 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                            <span>Madde {sanction.article} - Fıkra {sanction.paragraph}</span>
                            {sanction.sanctionType && sanction.sanctionType !== "Belirtilmedi" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {sanction.sanctionType}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm("Bu yaptırımı silmek istediğinize emin misiniz?")) {
                              const updated = sanctions.filter(s => s.id !== sanction.id);
                              setSanctions(updated);
                              await safeStorage.setItem("sanctions", updated);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                        {sanction.content}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">İlişkili Olumsuz Davranışlar</div>
                        <div className="flex flex-wrap gap-2">
                          {sanction.behaviorIds.map(bid => {
                            const b = customBehaviors.find(cb => cb.id === bid);
                            return b ? <span key={bid} className="bg-rose-50 border border-rose-100 px-2 py-1 rounded text-xs font-semibold text-rose-700">{b.name}</span> : null;
                          })}
                          {sanction.behaviorIds.length === 0 && <span className="text-xs text-slate-400 italic">Eşleştirilmiş davranış yok</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sanctions.length === 0 && <div className="text-sm text-slate-500 italic">Kayıtlı yaptırım (yönetmelik) yok.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Öğrenci adı, soyadı veya numarası ile ara..."
                value={recordSearchQuery}
                onChange={(e) => setRecordSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-slate-500">Başlangıç:</span>
                <input
                  type="date"
                  value={recordStartDate}
                  onChange={(e) => setRecordStartDate(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none text-slate-700"
                />
              </div>
              <span className="text-slate-400">-</span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-slate-500">Bitiş:</span>
                <input
                  type="date"
                  value={recordEndDate}
                  onChange={(e) => setRecordEndDate(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none text-slate-700"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedRecordIdsForTutanak.length === 0) {
                    alert("Yazdırmak için önce bir tutanak kaydı seçiniz.");
                    return;
                  }
                  openTutanakModalForRecords(selectedRecordIdsForTutanak);
                }}
                className="p-2.5 text-[#8b5a2b] hover:bg-[#8b5a2b]/10 border border-slate-200 rounded-xl transition-colors shrink-0"
                title="Tutanak Yazdır / PDF"
                aria-label="Tutanak Yazdır / PDF"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {filteredRecords.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 font-medium">Davranış kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <div key={record.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 md:w-32 shrink-0">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-600">{new Date(record.date).toLocaleDateString('tr-TR')}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Heart className={`w-4 h-4 shrink-0 ${record.behaviorType === 'Olumsuz' ? 'text-red-500' : record.behaviorType === 'Olumlu' ? 'text-slate-800' : 'text-amber-500'}`} />
                        <span className={`text-sm font-bold ${record.behaviorType === 'Olumsuz' ? 'text-red-600' : record.behaviorType === 'Olumlu' ? 'text-slate-900' : 'text-amber-600'}`}>
                          {record.behaviorName}
                          {record.sanctionType && <span className="text-xs ml-2 text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full font-bold border border-rose-200">Yaptırım: {record.sanctionType}</span>}
                        </span>
                        {record.notePrepared ? (
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border ${
                            record.sentTo === "Uyarı Bildirimi"
                              ? "text-yellow-800 bg-yellow-100 border-yellow-300 animate-pulse-subtle"
                              : "text-indigo-700 bg-indigo-50 border-indigo-200"
                          }`}>
                            Sevk Edilen Yer: {record.sentTo || "Disiplin İşlemi"}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full shrink-0">
                            Gönderim: Beklemede
                          </span>
                        )}
                      </div>
                      {record.description && (
                        <span className="text-xs text-slate-500 italic truncate max-w-xs mt-1 md:mt-0 md:ml-2">{record.description}</span>
                      )}
                    </div>
                  </div>

                  <div className="md:w-auto shrink-0 flex items-center justify-between md:justify-end gap-2 mt-2 md:mt-0">
                    <button
                      onClick={() => handleSendWhatsAppInline(record)}
                      disabled={record.messageSent}
                      className={`p-2 rounded-xl transition-colors shrink-0 ${record.messageSent ? 'text-slate-300 cursor-not-allowed' : 'text-[#25D366] hover:bg-[#25D366]/10'}`}
                      title="WhatsApp'tan Gönder"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                    {!record.historyRecord && (
                      <button
                        onClick={() => {
                        const stdsList: Student[] = [];
                        if (record.studentsList && record.studentsList.length > 0) {
                          record.studentsList.forEach(item => {
                            const found = students.find(s => s.id === item.id);
                            if (found) {
                              stdsList.push(found);
                            } else {
                              stdsList.push({
                                id: item.id,
                                name: item.name,
                                classroom: item.classroom,
                                phone: "",
                                parentName: "",
                                parentPhone: "",
                                status: "Aktif",
                                registerDate: "",
                                avatar: ""
                              } as Student);
                            }
                          });
                        } else {
                          const found = students.find(s => s.id === record.studentId);
                          if (found) {
                            stdsList.push(found);
                          } else {
                            stdsList.push({
                              id: record.studentId,
                              name: record.studentName,
                              classroom: record.studentClassroom,
                              phone: "",
                              parentName: "",
                              parentPhone: "",
                              status: "Aktif",
                              registerDate: "",
                              avatar: ""
                            } as Student);
                          }
                        }
                        setSelectedStudentsList(stdsList);
                        setSelectedStudent(stdsList[0] || null);
                        setIsJointBehavior(stdsList.length > 1);
                        
                        const complainantsList: Student[] = [];
                        if (record.complainantStudents && record.complainantStudents.length > 0) {
                          record.complainantStudents.forEach(item => {
                            const found = students.find(s => s.id === item.id);
                            if (found) {
                              complainantsList.push(found);
                            } else {
                              complainantsList.push({
                                id: item.id,
                                name: item.name,
                                classroom: item.classroom,
                                phone: "",
                                parentName: "",
                                parentPhone: "",
                                status: "Aktif",
                                registerDate: "",
                                avatar: ""
                              } as Student);
                            }
                          });
                        }
                        setSelectedComplainantsList(complainantsList);
                        setRecordReason(record.recordReason || "Tutanak");
                        setComplaintRegulationArticle(record.complaintRegulationArticle || "");

                        setBehaviorType(record.behaviorType);
                        setBehaviorName(record.behaviorName);
                        setBehaviorSanctionType(record.sanctionType);
                        setDate(record.date);
                        setDescription(record.description || "");
                        setEditingRecordId(record.id);
                        setIsModalOpen(true);
                      }}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-colors shrink-0"
                        title="Düzenle"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                      title="Sil"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    {record.notePrepared ? (
                      <div className="p-2 text-emerald-600 bg-emerald-50 rounded-xl" title="İşlem İçin Gönderildi">
                        <Check className="w-5 h-5" />
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRecordForStudentList(record)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors shrink-0"
                        title="Kayıtlı Öğrencileri Göster"
                        aria-label="Kayıtlı Öğrencileri Göster"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    )}

                    {/* Tutanak İçin Seç Tik Alanı */}
                    {record.behaviorType === "Olumsuz" && !record.historyRecord && (() => {
                      const selectedDate = selectedRecordIdsForTutanak
                        .map(id => records.find(selectedRecord => selectedRecord.id === id)?.date)
                        .find(Boolean);
                      const isSelected = selectedRecordIdsForTutanak.includes(record.id);
                      const isTutanakDisabled = !isSelected && Boolean(selectedDate && record.date !== selectedDate);

                      return (
                        <div className={`flex items-center gap-1.5 shrink-0 bg-emerald-50 border border-emerald-200 p-1.5 rounded-xl h-[40px] ml-1 transition-opacity ${
                          isTutanakDisabled ? "opacity-40 cursor-not-allowed select-none pointer-events-none" : ""
                        }`}>
                          <button
                            disabled={isTutanakDisabled}
                            onClick={() => toggleSelectRecordForTutanak(record.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-emerald-600 border-emerald-700 text-white shadow-sm"
                                : "bg-white border-emerald-300 text-transparent hover:border-emerald-400"
                            }`}
                            title={isSelected ? "Seçimi Kaldır" : isTutanakDisabled ? "Farklı tarihli kayıtlar aynı tutanakta birleştirilemez" : (record.recordReason === "Şikayet" ? "Şikayet Dilekçesi için Seç" : "Tutanak için Seç")}
                          >
                            <Check className={`w-3.5 h-3.5 stroke-[3px] ${isSelected ? "block" : "hidden"}`} />
                          </button>
                          <span className="text-[10px] font-bold text-emerald-800 select-none px-1">
                            {record.recordReason === "Şikayet" ? "Şikayet Dilekçesi" : "Tutanak"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      <BehaviorRecordModal {...{
        isModalOpen, recordReason, setRecordReason, closeModal, complainantSearchQuery, setComplainantSearchQuery,
        filteredComplainants, selectedComplainantsList, setSelectedComplainantsList, getStudentSchoolNumber,
        complaintRegulationArticle, setComplaintRegulationArticle, searchQuery, setSearchQuery, filteredStudents, allStudents: students,
        selectedStudentsList, setSelectedStudentsList, selectedStudent, setSelectedStudent, isJointBehavior,
        setIsJointBehavior, behaviorSearchQuery, setBehaviorSearchQuery, filteredBehaviorsForSelect, behaviorName,
        setBehaviorName, behaviorType, setBehaviorType, behaviorSanctionType, setBehaviorSanctionType, description,
        setDescription, studentDescriptions, setStudentDescriptions, date, setDate, saveRecord, isTeacherLinkView, editingRecordId, customBehaviors, normalizeStudentSearchText
      }} />
      <BehaviorCatalogModals {...{
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
      }} />
      <BehaviorInfoNoteModal
        record={selectedRecordForNote}
        onClose={() => setSelectedRecordForNote(null)}
      />

      {selectedRecordForStudentList && (() => {
        const listedStudents = (selectedRecordForStudentList.studentsList?.length
          ? [...selectedRecordForStudentList.studentsList]
          : [{
              id: selectedRecordForStudentList.studentId,
              name: selectedRecordForStudentList.studentName,
              classroom: selectedRecordForStudentList.studentClassroom,
              number: selectedRecordForStudentList.studentNumber,
            }])
          .sort((left, right) => {
            const leftNumber = String(left.number || "").trim();
            const rightNumber = String(right.number || "").trim();
            if (!leftNumber && rightNumber) return 1;
            if (leftNumber && !rightNumber) return -1;
            return leftNumber.localeCompare(rightNumber, "tr-TR", { numeric: true, sensitivity: "base" });
          });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSelectedRecordForStudentList(null)}>
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-800">Kayıtlı Öğrenciler</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecordForStudentList(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                  aria-label="Kapat"
                  title="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4">
                <div className="space-y-2">
                  {listedStudents.map((student, index) => (
                    <div key={`${student.id || index}-${student.number || index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <span className="min-w-14 text-center text-xs font-black text-slate-500">{student.number || "-"}</span>
                      <span className="text-sm font-bold text-slate-800">{student.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <BehaviorDisciplineModals
        isWarningOpen={isDisciplineWarningModalOpen}
        isBoardOpen={isDisciplineBoardModalOpen}
        isDeleteOpen={isDeleteModalOpen}
        hasRecordToDiscipline={Boolean(recordToDiscipline)}
        warningKinamaCount={disciplineWarningKinamaCount}
        boardReason={disciplineBoardReason}
        jointStudentsDetails={jointStudentsDetails}
        onCancelWarning={() => { setIsDisciplineWarningModalOpen(false); setRecordToDiscipline(null); }}
        onConfirmWarning={confirmSendToDisciplineWarning}
        onCancelBoard={() => { setIsDisciplineBoardModalOpen(false); setRecordToDiscipline(null); }}
        onConfirmBoard={confirmSendToDisciplineBoard}
        onCancelDelete={() => { setDeleteRecordId(null); setIsDeleteModalOpen(false); }}
        onConfirmDelete={confirmDeleteRecord}
      />

      {/* Tutanak / Şikayet Dilekçesi Oluşturma Modali */}
      {isTutanakModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp">
            
            {isComplaintSelected ? (
              // ŞİKAYET DİLEKÇESİ MODU
              <>
                {/* Header */}
                <div className="px-6 py-4 bg-teal-50 border-b border-teal-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-600/10 text-teal-700 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-black text-slate-800 tracking-tight">Şikayet Dilekçesi Oluştur</h3>
                      <p className="text-[11px] font-semibold text-slate-500">Seçilen şikayet kaydı için şikayet dilekçesi hazırlayın ve yazdırın</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsTutanakModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 space-y-6">
                  {/* Tarih ve Yaptırım Seçimi */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Tarih */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Dilekçe Tarihi</label>
                      <input
                        type="date"
                        value={tutanakDate}
                        onChange={(e) => setTutanakDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 font-medium"
                      />
                    </div>

                    {/* Şikayet Konusu Yönetmelik Maddesi */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Şikayet Konusu Yönetmelik Maddesi</label>
                      <select
                        value={complaintSanction}
                        onChange={(e) => setComplaintSanction(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 font-medium cursor-pointer"
                      >
                        <option value="">Seçiniz...</option>
                        {Array.from(new Set(customBehaviors.filter(b => b.article).map(b => `Madde ${b.article}: ${b.content || b.name}`))).map((articleText, idx) => (
                          <option key={idx} value={articleText}>{articleText}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Şikayetçi Öğrenciler */}
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-4 h-4 text-teal-600" />
                      Şikayetçi Öğrenciler ({complaintComplainants.length})
                    </label>
                    
                    {/* Şikayetçi Ekleme Arama Kutusu */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Yeni şikayetçi eklemek için arayın (Ad veya No)..."
                        value={complaintComplainantSearchQuery}
                        onChange={(e) => {
                          setComplaintComplainantSearchQuery(e.target.value);
                          setShowComplaintComplainantSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => {
                          if (complaintComplainantSearchQuery.length > 0) setShowComplaintComplainantSuggestions(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowComplaintComplainantSuggestions(false), 200);
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />

                      {showComplaintComplainantSuggestions && filteredComplaintComplainantsSearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto overflow-hidden divide-y divide-slate-100">
                          {filteredComplaintComplainantsSearch
                            .filter(s => !complaintComplainants.some(c => c.id === s.id))
                            .map((student, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setComplaintComplainants([...complaintComplainants, {
                                    id: student.id,
                                    name: student.name,
                                    classroom: student.classroom || "Belirtilmedi",
                                    number: student.id
                                  }]);
                                  setComplaintComplainantSearchQuery("");
                                  setShowComplaintComplainantSuggestions(false);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer flex justify-between"
                              >
                                <span>{student.name}</span>
                                <span className="text-slate-400 font-medium">{student.classroom}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Şikayetçi Listesi Chip'leri */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {complaintComplainants.map((student, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-100 text-teal-800 rounded-lg text-xs font-bold animate-fade-in">
                          <span>{student.name} ({student.classroom})</span>
                          <button
                            type="button"
                            onClick={() => setComplaintComplainants(complaintComplainants.filter((_, i) => i !== idx))}
                            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-teal-100 text-teal-500 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Şikayet Edilen Öğrenciler */}
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-4 h-4 text-rose-600" />
                      Şikayet Edilen Öğrenciler ({complaintAccused.length})
                    </label>

                    {/* Şikayet Edilen Ekleme Arama Kutusu */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Şikayet edilen eklemek için arayın (Ad veya No)..."
                        value={complaintAccusedSearchQuery}
                        onChange={(e) => {
                          setComplaintAccusedSearchQuery(e.target.value);
                          setShowComplaintAccusedSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => {
                          if (complaintAccusedSearchQuery.length > 0) setShowComplaintAccusedSuggestions(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowComplaintAccusedSuggestions(false), 200);
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />

                      {showComplaintAccusedSuggestions && filteredComplaintAccusedSearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto overflow-hidden divide-y divide-slate-100">
                          {filteredComplaintAccusedSearch
                            .filter(s => !complaintAccused.some(c => c.id === s.id))
                            .map((student, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setComplaintAccused([...complaintAccused, {
                                    id: student.id,
                                    name: student.name,
                                    classroom: student.classroom || "Belirtilmedi",
                                    number: student.id,
                                    behavior: "Mevzuata aykırı olumsuz davranış"
                                  }]);
                                  setComplaintAccusedSearchQuery("");
                                  setShowComplaintAccusedSuggestions(false);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer flex justify-between"
                              >
                                <span>{student.name}</span>
                                <span className="text-slate-400 font-medium">{student.classroom}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Şikayet Edilenler Listesi */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {complaintAccused.map((student, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-2.5 bg-rose-50/50 border border-rose-100 text-rose-950 rounded-lg text-xs font-bold animate-fade-in w-full">
                          <div className="flex items-center justify-between">
                            <span>{student.name} ({student.classroom})</span>
                            <button
                              type="button"
                              onClick={() => setComplaintAccused(complaintAccused.filter((_, i) => i !== idx))}
                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-rose-600 uppercase tracking-wide">Şikayete Konu Davranış:</span>
                            <input
                              type="text"
                              value={student.behavior || ""}
                              onChange={(e) => {
                                const updated = [...complaintAccused];
                                updated[idx] = { ...updated[idx], behavior: e.target.value };
                                setComplaintAccused(updated);
                              }}
                              placeholder="Davranış detayı giriniz..."
                              className="flex-1 px-2 py-1 bg-white border border-rose-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Olay Açıklaması */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Olay Açıklaması ve Detaylar</label>
                    <textarea
                      value={complaintDescription}
                      onChange={(e) => setComplaintDescription(e.target.value)}
                      placeholder="Şikayete konu olayın detaylı açıklaması..."
                      className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsTutanakModalOpen(false)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer"
                  >
                    İptal Et
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintComplaint}
                    disabled={complaintComplainants.length === 0 || complaintAccused.length === 0}
                    className={`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer ${
                      complaintComplainants.length === 0 || complaintAccused.length === 0
                        ? "bg-slate-300 shadow-none cursor-not-allowed opacity-60"
                        : "bg-teal-600 hover:bg-teal-700 shadow-teal-600/10"
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Dilekçeyi Yazdır / PDF</span>
                  </button>
                </div>
              </>
            ) : (
              // TUTANAK MODU (Mevcut Davranış Tespit Tutanağı)
              <>
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#8b5a2b]/10 text-[#8b5a2b] rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-black text-slate-800 tracking-tight">Davranış Tespit Tutanağı</h3>
                      <p className="text-[11px] font-semibold text-slate-500">Seçilen öğrenciler için toplu davranış tespit tutanağı hazırlayın</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsTutanakModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                  <div className="space-y-6">
                    
                    {/* Tarih ve Nöbetçi Öğretmen Ekleme */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      {/* Sol Sütun: Tarih */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tutanak Tarihi</label>
                        <input
                          type="date"
                          value={tutanakDate}
                          onChange={(e) => setTutanakDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]/50 focus:border-[#8b5a2b] text-slate-700 font-medium"
                        />
                      </div>

                      {/* Sağ Sütun: Nöbetçi Öğretmen Ekleme */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          İmzalayacak Nöbetçi Öğretmenler
                        </label>
                        
                        <div className="relative">
                          <div className="flex gap-2 relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Öğretmen adı soyadı..."
                              value={newTeacherInput}
                              onChange={(e) => {
                                setNewTeacherInput(e.target.value);
                                setShowTeacherSuggestions(e.target.value.length > 0);
                              }}
                              onFocus={() => {
                                if (newTeacherInput.length > 0) setShowTeacherSuggestions(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowTeacherSuggestions(false), 200);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (newTeacherInput.trim() !== "") {
                                    if (!tutanakTeachers.includes(newTeacherInput.trim())) {
                                      setTutanakTeachers([...tutanakTeachers, newTeacherInput.trim()]);
                                    }
                                    setNewTeacherInput("");
                                    setShowTeacherSuggestions(false);
                                  }
                                }
                              }}
                              className="w-full pl-9 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]/50 focus:border-[#8b5a2b] text-slate-700 font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newTeacherInput.trim() !== "") {
                                  if (!tutanakTeachers.includes(newTeacherInput.trim())) {
                                    setTutanakTeachers([...tutanakTeachers, newTeacherInput.trim()]);
                                  }
                                  setNewTeacherInput("");
                                  setShowTeacherSuggestions(false);
                                }
                              }}
                              className="px-4 py-2 bg-[#8b5a2b] hover:bg-[#a06833] text-white font-bold rounded-xl transition-colors cursor-pointer shrink-0 text-sm"
                            >
                              Ekle
                            </button>
                          </div>
                          
                          {/* Suggestions Dropdown */}
                          {showTeacherSuggestions && filteredTeachersForSearch.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto overflow-hidden divide-y divide-slate-100">
                              {filteredTeachersForSearch.map((teacher, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (teacher.name && !tutanakTeachers.includes(teacher.name)) {
                                      setTutanakTeachers([...tutanakTeachers, teacher.name]);
                                    }
                                    setNewTeacherInput("");
                                    setShowTeacherSuggestions(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-[#8b5a2b]/10 hover:text-[#8b5a2b] transition-colors cursor-pointer"
                                >
                                  {teacher.name} {teacher.branch ? `(${teacher.branch})` : ""}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3 min-h-[32px]">
                          {tutanakTeachers.length === 0 ? (
                            <span className="text-[11px] text-slate-400 font-medium italic py-1">Henüz öğretmen eklenmedi...</span>
                          ) : (
                            tutanakTeachers.map((teacher, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold">
                                <span>{teacher}</span>
                                <button
                                  type="button"
                                  onClick={() => setTutanakTeachers(tutanakTeachers.filter((_, i) => i !== idx))}
                                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Davranışa Göre Yazdır</label>
                        <select
                          value={tutanakBehaviorFilter}
                          onChange={(e) => setTutanakBehaviorFilter(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]/50 focus:border-[#8b5a2b] text-slate-700 font-medium cursor-pointer"
                        >
                          <option value="Tümü">Tüm Davranışlar</option>
                          {tutanakBehaviorOptions.map(behavior => (
                            <option key={behavior} value={behavior}>{behavior}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Sınıfa Göre Yazdır</label>
                        <select
                          value={tutanakClassFilter}
                          onChange={(e) => setTutanakClassFilter(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]/50 focus:border-[#8b5a2b] text-slate-700 font-medium cursor-pointer"
                        >
                          <option value="Tümü">Tüm Sınıflar</option>
                          {tutanakClassOptions.map(classroom => (
                            <option key={classroom} value={classroom}>{classroom}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="w-full h-px bg-slate-200" />

                    {/* Eklenen Öğrenciler Listesi */}
                    {filteredTutanakStudents.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Tutanaktaki Öğrenci Listesi ({filteredTutanakStudents.length})</h4>
                          </div>
                        </div>
                        
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 uppercase tracking-wider text-[10px] text-slate-500">
                              <th className="px-4 py-3 text-center w-12">Sınıf</th>
                              <th className="px-4 py-3 text-center w-16">No</th>
                              <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Öğrenci Adı Soyadı</th>
                              <th className="px-4 py-3 font-bold text-slate-700">Geliştirilmesi Gereken Davranış</th>
                              <th className="px-4 py-3 text-center w-12">İşlem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredTutanakStudents.map((student, idx) => (
                              <tr key={`${student.sourceRecordId || "record"}-${student.id}-${student.behavior || idx}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-center font-bold text-slate-800">{student.classroom}</td>
                                <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{student.number}</td>
                                <td className="px-4 py-3 font-extrabold text-slate-900">{student.name}</td>
                                <td className="px-4 py-3 text-slate-600 line-clamp-1">{student.behavior || 'Belirtilmedi'}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setTutanakStudents(tutanakStudents.filter((item) => !(
                                      item.sourceRecordId === student.sourceRecordId &&
                                      item.id === student.id &&
                                      item.behavior === student.behavior
                                    )))}
                                    className="w-6 h-6 inline-flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="Listeden Çıkar"
                                  >
                                    <X className="w-4 h-4" />
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
                    onClick={() => setIsTutanakModalOpen(false)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer"
                  >
                    İptal Et
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintTutanak}
                    disabled={filteredTutanakStudents.length === 0}
                    className={`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 ${
                      filteredTutanakStudents.length === 0
                        ? "bg-slate-300 shadow-none cursor-not-allowed opacity-60"
                        : "cursor-pointer bg-[#8b5a2b] hover:bg-[#a06833] shadow-[#8b5a2b]/10"
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Tutanağı Yazdır / PDF</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      <BehaviorWhatsAppModal
        record={whatsappRecord}
        students={students}
        onClose={() => setWhatsappRecord(null)}
        onMarkSent={async (record) => {
          const updatedRecords = records.map((r) =>
            r.id === record.id ? { ...r, messageSent: true } : r
          );
          setRecords(updatedRecords);
          await safeStorage.setItem("behaviorRecords", updatedRecords);
          setWhatsappRecord(null);
        }}
      />
    </div>
  );
}
