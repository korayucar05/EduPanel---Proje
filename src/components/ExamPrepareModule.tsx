import { CURRICULUM_UPDATED_EVENT, loadAuthoritativeCurriculumStore, readLegacyCurriculumStore, type CurriculumStore } from "../services/curriculumRepository";
import React, { useState, useEffect, useRef } from "react";
import {
  ClipboardCheck,
  Plus,
  FileText,
  X,
  Calendar,
  Settings,
  FileSearch,
  LockKeyhole,
  LockKeyholeOpen,
  ListChecks,
  BookOpen,
  BarChart2,
  Trash2,
} from "lucide-react";
import QuestionManagerView from "./QuestionManagerView";
import localforage from "localforage";
import { sqliteStorage } from "../lib/sqliteStorageBridge";
import { teacherService } from "../modules/teacher";

const DEFAULT_TYT_STRUCTURE = [
  {
    testName: "Türkçe Testi",
    subjects: [{ name: "Türkçe", count: 40 }],
  },
  {
    testName: "Sosyal Bilimler Testi",
    subjects: [
      { name: "Tarih", count: 5 },
      { name: "Coğrafya", count: 5 },
      { name: "Felsefe", count: 5 },
      { name: "Din Kültürü", count: 5 },
    ],
  },
  {
    testName: "Temel Matematik Testi",
    subjects: [{ name: "Matematik", count: 40 }],
  },
  {
    testName: "Fen Bilimleri Testi",
    subjects: [
      { name: "Fizik", count: 7 },
      { name: "Kimya", count: 7 },
      { name: "Biyoloji", count: 6 },
    ],
  },
];

const DEFAULT_AYT_STRUCTURE = [
  {
    testName: "Matematik Testi",
    subjects: [{ name: "Matematik", count: 40 }],
  },
  {
    testName: "Fen Bilimleri Testi",
    subjects: [
      { name: "Fizik", count: 14 },
      { name: "Kimya", count: 13 },
      { name: "Biyoloji", count: 13 },
    ],
  },
  {
    testName: "Türk Dili ve Edebiyatı - Sosyal Bilimler-1 Testi",
    subjects: [
      { name: "Türk Dili ve Edebiyatı", count: 24 },
      { name: "Tarih-1", count: 10 },
      { name: "Coğrafya-1", count: 6 },
    ],
  },
  {
    testName: "Sosyal Bilimler-2 Testi",
    subjects: [
      { name: "Tarih-2", count: 11 },
      { name: "Coğrafya-2", count: 11 },
      { name: "Felsefe Grubu", count: 12 },
      { name: "Din Kültürü", count: 6 },
    ],
  },
  {
    testName: "Yabancı Dil Testi",
    subjects: [{ name: "Yabancı Dil", count: 80 }],
  },
];

const BRANCH_SUBJECTS = [
  "Türk Dili ve Edebiyatı", "Matematik", "Fizik", "Kimya", "Biyoloji",
  "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi", "İngilizce", "Almanca"
];

const EXAM_STATUS_OPTIONS = [
  "Hazırlanıyor",
  "Sorular Girildi",
  "PDF Oluşturuldu",
  "Optikler Okundu",
  "Değerlendirildi",
  "Sonuçlar Gönderildi",
];

const PDF_TEMPLATE_OPTIONS = [
  "Standart Karne",
  "Kurumsal Karne",
  "HASAT Analiz Karnesi",
  "Üniversite Sınavı Karnesi",
];



const OPTIC_ANSWER_AREA_COUNT = 4;

const normalizeOpticCourseKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const legacyOpticAreaIndexForCourse = (courseName: unknown, fallbackIndex: number) => {
  const key = normalizeOpticCourseKey(courseName);
  if (/turk|edebiyat|yabanci dil|ingiliz|almanca|fransiz/.test(key)) return 0;
  if (/tarih|cograf|felsefe|din kulturu|sosyal/.test(key)) return 1;
  if (/matematik/.test(key)) return 2;
  if (/fizik|kimya|biyoloji|fen bilim/.test(key)) return 3;
  return Math.min(Math.max(fallbackIndex, 0), OPTIC_ANSWER_AREA_COUNT - 1);
};

const opticAreaIndexOf = (field: any, fallbackIndex = 0) => {
  const match = String(field?.id || "").match(/^area-(\d)-/);
  if (match) {
    const parsed = Number(match[1]) - 1;
    if (parsed >= 0 && parsed < OPTIC_ANSWER_AREA_COUNT) return parsed;
  }
  return legacyOpticAreaIndexForCourse(field?.courseName, fallbackIndex);
};

const buildOpticAreaLayout = (template: any) => {
  const groups: any[][] = Array.from(
    { length: OPTIC_ANSWER_AREA_COUNT },
    () => [],
  );
  const fields = [...(Array.isArray(template?.answerFields) ? template.answerFields : [])]
    .sort((left: any, right: any) => Number(left?.startColumn || 0) - Number(right?.startColumn || 0));

  fields.forEach((field: any, index: number) => {
    groups[opticAreaIndexOf(field, Math.min(index, OPTIC_ANSWER_AREA_COUNT - 1))].push(field);
  });

  const explicitStarts =
    Array.isArray(template?.answerAreaStarts) && template.answerAreaStarts.length === OPTIC_ANSWER_AREA_COUNT
      ? template.answerAreaStarts.map((value: any) => Math.max(0, Number(value) || 0))
      : [0, 0, 0, 0];

  const starts = groups.map((group, areaIndex) => {
    if (explicitStarts[areaIndex] > 0) return explicitStarts[areaIndex];
    const candidates = group
      .map((field: any) => Number(field?.startColumn || 0))
      .filter((value: number) => value > 0);
    return candidates.length ? Math.min(...candidates) : 0;
  });

  return { groups, starts };
};

const normalizeExamTypeValue = (value: unknown) => {
  const raw = String(value || "").trim();
  const key = raw
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

  if ([
    "ders deneme", "ders denemesi",
  ].includes(key)) return "Ders Denemesi";

  if (["branş deneme", "branş denemesi", "branşlar denemesi", "branch deneme", "branch denemesi"].includes(key)) return "Branşlar Denemesi";

  if ([
    "ünite tarama", "ünite taraması",
    "unite tarama", "unite taramasi",
    "ünite deneme", "ünite denemesi",
    "unite deneme", "unite denemesi",
  ].includes(key)) return "Ünite Denemesi";

  if (["konu deneme", "konu denemesi"].includes(key)) return "Konu Denemesi";

  return raw;
};

const replaceLegacyExamTerminology = (value: unknown) =>
  String(value || "")
    .replace(/branch denemesi/gi, "Ders Denemesi")
    .replace(/branch deneme/gi, "Ders Denemesi")
    .replace(/branş denemesi/gi, "Ders Denemesi")
    .replace(/branş deneme/gi, "Ders Denemesi")
    .replace(/ünite taraması/gi, "Ünite Denemesi")
    .replace(/ünite tarama/gi, "Ünite Denemesi");

const generateExamCode = (type = "TYT", grade = "YKS") => {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-4);
  const normalizedType = normalizeExamTypeValue(type);
  const typeCode =
    normalizedType === "Branşlar Denemesi"
      ? "BD"
      : normalizedType === "Ders Denemesi"
      ? "DD"
      : normalizedType === "Ünite Denemesi"
        ? "UD"
        : normalizedType === "Konu Denemesi" ? "KD" : normalizedType;
  const prefix = grade === "YKS" ? typeCode : `${grade}${typeCode}`;
  return `${prefix}-${year}-${seq}`.replace(/\s+/g, "").toUpperCase();
};

const getGradeDisplayName = (grade: string) =>
  grade === "YKS" ? "YKS" : `${grade}. Sınıf`;

const getExamTypeDisplayName = (type: string) =>
  normalizeExamTypeValue(type);

const normalizeExamNamePart = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

const getSavedExamCourseNames = (exam: any) => {
  const explicitNames = Array.isArray(exam?.selectedCourseNames)
    ? exam.selectedCourseNames
    : [];
  const singleName = String(exam?.selectedCourseName || "").trim();
  const structureNames = Array.isArray(exam?.examStructure)
    ? exam.examStructure.flatMap((test: any) =>
        Array.isArray(test?.subjects)
          ? test.subjects.map((subject: any) => String(subject?.name || "").trim())
          : [],
      )
    : [];

  return Array.from(
    new Set(
      [...explicitNames, ...(singleName ? [singleName] : []), ...structureNames]
        .map((name: any) => String(name || "").trim())
        .filter(Boolean),
    ),
  );
};

const getSavedExamCourseOptions = (exam: any) => {
  const totals = new Map<string, { name: string; count: number }>();

  const addCourse = (rawName: unknown, rawCount: unknown = 0) => {
    const name = String(rawName || "").trim();
    if (!name) return;
    const key = normalizeExamNamePart(name);
    const count = Math.max(0, Number(rawCount) || 0);
    const current = totals.get(key);
    if (current) {
      current.count += count;
    } else {
      totals.set(key, { name, count });
    }
  };

  if (Array.isArray(exam?.examStructure)) {
    exam.examStructure.forEach((test: any) => {
      if (!Array.isArray(test?.subjects)) return;
      test.subjects.forEach((subject: any) => addCourse(subject?.name, subject?.count));
    });
  }

  getSavedExamCourseNames(exam).forEach((name) => addCourse(name, 0));
  return Array.from(totals.values());
};

const buildAutomaticExamName = (
  allExams: any[],
  grade: string,
  type: string,
  courseNames: string[] = [],
) => {
  const normalizedType = normalizeExamTypeValue(type);
  const isCourseBasedExam = ["Ders Denemesi", "Branşlar Denemesi", "Ünite Denemesi", "Konu Denemesi"].includes(normalizedType);
  const normalizedCourseKey = Array.from(
    new Set(courseNames.map((name) => normalizeExamNamePart(name)).filter(Boolean)),
  )
    .sort((a, b) => a.localeCompare(b, "tr"))
    .join("||");

  // Branş/ünite sınavlarında ders seçilmeden eksik bir sınav adı üretmeyelim.
  if (isCourseBasedExam && !normalizedCourseKey) return "";

  const matchingExams = allExams.filter((exam: any) => {
    if (String(exam?.gradeLevel || "") !== String(grade)) return false;
    if (normalizeExamTypeValue(exam?.examType) !== normalizedType) return false;
    if (!isCourseBasedExam) return true;

    const savedCourseKey = Array.from(
      new Set(
        getSavedExamCourseNames(exam)
          .map((name) => normalizeExamNamePart(name))
          .filter(Boolean),
      ),
    )
      .sort((a, b) => a.localeCompare(b, "tr"))
      .join("||");

    return savedCourseKey === normalizedCourseKey;
  });

  const highestExistingSequence = matchingExams.reduce((highest: number, exam: any) => {
    const match = String(exam?.examName || "").trim().match(/(\d+)\s*$/);
    const sequence = match ? Number(match[1]) : 0;
    return Math.max(highest, Number.isFinite(sequence) ? sequence : 0);
  }, 0);
  const nextSequence = Math.max(highestExistingSequence, matchingExams.length) + 1;

  const courseLabel = isCourseBasedExam
    ? courseNames.map((name) => String(name || "").trim()).filter(Boolean).join(" + ")
    : "";
  const parts = [
    getGradeDisplayName(grade),
    courseLabel,
    getExamTypeDisplayName(normalizedType),
    String(nextSequence),
  ].filter(Boolean);

  return parts.join(" ");
};

const getTotalQuestionCount = (structure: any[] = []) =>
  structure.reduce(
    (total: number, test: any) =>
      total +
      (test.subjects || []).reduce(
        (sum: number, sub: any) => sum + Number(sub.count || 0),
        0,
      ),
    0,
  );

export default function ExamPrepareModule({ setAppActiveTab, initialExamId, onInitialExamHandled }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examSource, setExamSource] = useState("Sistem");
  const [examType, setExamType] = useState("TYT");
  const [branchExamModel, setBranchExamModel] = useState<"TYT" | "AYT" | "Serbest">("Serbest");
  const [gradeLevel, setGradeLevel] = useState("YKS");
  const [participantGroup, setParticipantGroup] = useState<"school" | "trial-club">("school");
  const [bookletType, setBookletType] = useState("A");
  const [answeringMethod, setAnsweringMethod] = useState<"Optik" | "Elektronik">("Optik");
  const [continueQuestionNumbers, setContinueQuestionNumbers] = useState(false);
  const [examDate, setExamDate] = useState("");
  const [electronicDurationMinutes, setElectronicDurationMinutes] = useState(120);
  const [opticForm, setOpticForm] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [examName, setExamName] = useState("");
  const [examCode, setExamCode] = useState("");
  const [institutionName, setInstitutionName] = useState("Ordu Lisesi");
  const [targetAudience, setTargetAudience] = useState("");
  const [examStatus, setExamStatus] = useState("Hazırlanıyor");
  const [createResultPdf, setCreateResultPdf] = useState(true);
  const [sendToParents, setSendToParents] = useState(false);
  const [sendToStudents, setSendToStudents] = useState(false);
  const [showSchoolRank, setShowSchoolRank] = useState(true);
  const [showClassRank, setShowClassRank] = useState(true);
  const [showTurkeyRank, setShowTurkeyRank] = useState(false);
  const [includeSubjectAnalysis, setIncludeSubjectAnalysis] = useState(true);
  const [pdfTemplate, setPdfTemplate] = useState("HASAT Analiz Karnesi");
  const [resultFilePattern, setResultFilePattern] = useState("{YIL}_{SINAV_KODU}_{OGR_ADI}_{OGR_NO}.pdf");
  const [examStructure, setExamStructure] = useState<any[]>(
    DEFAULT_TYT_STRUCTURE,
  );
  const [questionBlueprint, setQuestionBlueprint] = useState<any[]>([]);
  const [selectedExamCourseId, setSelectedExamCourseId] = useState("");
  const [selectedExamCourseIds, setSelectedExamCourseIds] = useState<string[]>([]);
  const [blueprintDraft, setBlueprintDraft] = useState<any>({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
  const [editingBlueprintRowId, setEditingBlueprintRowId] = useState<string | null>(null);
  const [editingBlueprintCount, setEditingBlueprintCount] = useState<number>(1);
  const [questionAssignments, setQuestionAssignments] = useState<Record<string, any>>({});
  const [teacherSelectionBySubject, setTeacherSelectionBySubject] = useState<Record<string, string>>({});
  const [exams, setExams] = useState<any[]>([]);
  const [examLockSavingId, setExamLockSavingId] = useState<string | null>(null);
  const [examLockClock, setExamLockClock] = useState(() => Date.now());
  const [examGradeFilter, setExamGradeFilter] = useState("");
  const examsRef = useRef<any[]>([]);
  const persistedExamRefs = useRef<Map<string, any>>(new Map());
  const examPersistChainRef = useRef<Promise<void>>(Promise.resolve());
  const [examSavePending, setExamSavePending] = useState(false);
  const examSavePendingRef = useRef(false);
  const deletingExamIdsRef = useRef<Set<string>>(new Set());
  // Silinen sınavlar, tarayıcıdaki eski kopyalardan tekrar oluşturulmasın.
  const deletedExamIdsRef = useRef<Set<string>>(new Set());
  const deletedExamStorageKey = "enstitu_deleted_exam_ids_v1";
  const [examStorageReady, setExamStorageReady] = useState(false);
  const [availableOpticForms, setAvailableOpticForms] = useState<any[]>([]);
  const [managingExam, setManagingExam] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"exams" | "questions" | "optic-settings" | "booklets" | "read-edit" | "evaluate">("exams");
  const [electronicSyncBusy, setElectronicSyncBusy] = useState(false);
  const [electronicNotice, setElectronicNotice] = useState("");
  const [electronicRoster, setElectronicRoster] = useState<any[]>([]);
  const [electronicRosterError, setElectronicRosterError] = useState("");
  const [electronicRosterLoading, setElectronicRosterLoading] = useState(false);
  const isManagedElectronicExam = Boolean(managingExam && String(managingExam.answeringMethod || "").toLocaleLowerCase("tr-TR").includes("elektronik"));
  const [isOpticDetailsOpen, setIsOpticDetailsOpen] = useState(false);
  const [opticDraft, setOpticDraft] = useState<any | null>(null);
  const [opticCoursePickerArea, setOpticCoursePickerArea] = useState<number | null>(null);
  const [transferredExamId, setTransferredExamId] = useState<string | null>(null);


  React.useEffect(() => {
    const storedTransferId = localStorage.getItem("exam_prepare_initial_id");
    if (storedTransferId) {
      setTransferredExamId(storedTransferId);
    }
  }, []);

  React.useEffect(() => {
    // Açılışta bağımsız veri kaynaklarını sırayla beklemek yerine aynı anda başlat.
    // Sonuç birleştirme kuralları değişmez; yalnız bekleme süresi kısalır.
    try {
      const stored = JSON.parse(localStorage.getItem(deletedExamStorageKey) || "[]");
      deletedExamIdsRef.current = new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch { deletedExamIdsRef.current = new Set(); }
    const savedExamsPromise = localforage.getItem("exams").catch(() => null);
    const assignmentRowsPromise = fetch("/api/database/collections/teacherTestAssignments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [] as any[];
        const body: any = await response.json().catch(() => []);
        return Array.isArray(body)
          ? body
          : Array.isArray(body?.rows)
            ? body.rows
            : Array.isArray(body?.data)
              ? body.data
              : [];
      })
      .catch(() => [] as any[]);

    // SQLite ana kaynaktır; eski tarayıcı kayıtları yalnızca ilk geçişte kullanılır.
    import("../lib/localDatabase").then(({ fetchCollectionFromLocalDatabase }) =>
      fetchCollectionFromLocalDatabase("exams")
    ).catch(() => []).then(async (databaseExams: any[]) => {
      const savedExams: any = await savedExamsPromise;
      let legacyExams: any[] = [];
      try {
        const raw = localStorage.getItem("exams");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) legacyExams = parsed;
      } catch {}

      const questionRevisionOf = (row: any) => {
        const explicit = Number(row?.questionDataRevision || 0);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        const timestamp = Date.parse(String(row?.questionDataUpdatedAt || ""));
        return Number.isFinite(timestamp) ? timestamp : 0;
      };

      // SQLite ana kaynak olmaya devam eder; ancak kullanıcı cevap/kazanım seçip
      // hemen F5 yaparsa son HTTP yazımı tarayıcı kapanırken yarım kalabilir.
      // Bu nedenle yalnız soru metadatasında, daha yeni revision taşıyan yerel
      // kopyayı SQLite satırının üzerine kurtarıyoruz. Sonraki effect bunu tekrar
      // SQLite'a yazar ve iki kaynak yeniden eşitlenir.
      const localCandidates = [
        ...(Array.isArray(savedExams) ? savedExams : []),
        ...legacyExams,
      ];
      const latestLocalById = new Map<string, any>();
      localCandidates.forEach((row: any) => {
        const id = String(row?.id || "").trim();
        if (!id) return;
        const current = latestLocalById.get(id);
        if (!current || questionRevisionOf(row) > questionRevisionOf(current)) {
          latestLocalById.set(id, row);
        }
      });

      let resolvedExams: any[] = [];
      if (databaseExams.length > 0) {
        const databaseIds = new Set<string>();
        resolvedExams = databaseExams.map((databaseExam: any) => {
          const id = String(databaseExam?.id || "").trim();
          if (id) databaseIds.add(id);
          const localExam = id ? latestLocalById.get(id) : null;
          if (!localExam || questionRevisionOf(localExam) <= questionRevisionOf(databaseExam)) {
            return databaseExam;
          }
          return {
            ...databaseExam,
            questions: JSON.parse(JSON.stringify(localExam?.questions || {})),
            questionDataRevision: Number(localExam?.questionDataRevision || questionRevisionOf(localExam) || 0),
            questionDataUpdatedAt: String(localExam?.questionDataUpdatedAt || ""),
          };
        });

        // Yeni sınav SQLite'a yazılmadan tarayıcı yenilenmişse tamamen kaybolmasın.
        latestLocalById.forEach((localExam, id) => {
          if (!databaseIds.has(id)) resolvedExams.push(localExam);
        });
      } else if (Array.isArray(savedExams) && savedExams.length > 0) {
        resolvedExams = savedExams;
      } else {
        resolvedExams = legacyExams;
      }

      // Silinen sınavları eski localforage/localStorage kopyalarından kurtarma.
      resolvedExams = resolvedExams.filter((row: any) =>
        !deletedExamIdsRef.current.has(String(row?.id || "").trim()),
      );

      // teacherTestAssignments ortak görev kaynağıdır. Önceki sürümlerde görev
      // sunucuya yazılıp exams belgesine yansımamış olabiliyordu. Uygulama açılırken
      // açık öğretmen görevlerini sınav kartlarına geri bağla; böylece “kaydedildi”
      // denildikten sonra sekme değiştirince öğretmen seçimi kaybolmaz.
      try {
        const assignmentRows: any[] = await assignmentRowsPromise;
        if (assignmentRows.length > 0) {
          resolvedExams = resolvedExams.map((exam: any) => {
            const examIds = new Set(
              [exam?.id, exam?.examCode].map((value) => String(value || "").trim()).filter(Boolean),
            );
            const linked = assignmentRows.filter((assignment: any) => {
              if (assignment?.completedAt) return false;
              const assignmentKind = String(assignment?.assignmentKind || "").toLowerCase();
              const workflowType = String(assignment?.workflowType || "").toLowerCase();
              if (assignmentKind && assignmentKind !== "exam" && workflowType !== "exam-question-selection") return false;
              const refs = [assignment?.testId, assignment?.examId, assignment?.examCode]
                .map((value) => String(value || "").trim())
                .filter(Boolean);
              return refs.some((value) => examIds.has(value));
            });
            if (!linked.length) return exam;

            const nextAssignments: Record<string, any> = { ...(exam?.questionAssignments || {}) };
            linked.forEach((assignment: any) => {
              const subject = String(assignment?.subject || assignment?.courseName || "").trim();
              if (!subject) return;
              const normalized = subject.toLocaleLowerCase("tr-TR");
              const existingKey = Object.entries(nextAssignments).find(([, value]: any) =>
                String(value?.subject || value?.courseName || "").trim().toLocaleLowerCase("tr-TR") === normalized
              )?.[0];
              const key = existingKey || `${String(assignment?.grade || exam?.gradeLevel || "")}__${subject}`;
              nextAssignments[key] = assignment;
            });
            return {
              ...exam,
              questionAssignments: nextAssignments,
            };
          });
        }
      } catch (error) {
        console.warn("Açık öğretmen soru görevleri sınavlara bağlanamadı:", error);
      }

      examsRef.current = resolvedExams;
      // Yalnız SQLite'tan gerçekten okunmuş kayıtları "kalıcı" kabul et.
      // Sunucu okuması başarısız olup tarayıcıdaki sağlam yedeğe düşüldüyse
      // bu sınavlar değişmiş kabul edilir ve aşağıdaki güvenli UPSERT akışıyla
      // SQLite'a tek tek geri yazılır; hiçbir zaman koleksiyonun tamamı silinmez.
      persistedExamRefs.current = new Map(
        databaseExams
          .map((exam: any) => [String(exam?.id || "").trim(), exam] as const)
          .filter(([id]) => Boolean(id)),
      );
      setExams(resolvedExams);
      await localforage.setItem("exams", resolvedExams);
      try { localStorage.setItem("exams", JSON.stringify(resolvedExams)); } catch {}
      setExamStorageReady(true);
    });

    // Optik Form Yönetimi tek kaynak kabul edilir. Eski localStorage/localforage
    // kayıtları ve sabit örnek optik adları bu listede kesinlikle gösterilmez.
    import("../lib/opticTemplateApi")
      .then(({ listOpticTemplates }) => listOpticTemplates())
      .then((forms: any[]) => {
        const managedForms = Array.isArray(forms)
          ? forms.filter((form: any) => String(form?.id || "").trim() && String(form?.name || "").trim())
          : [];
        setAvailableOpticForms(managedForms);
      })
      .catch((error) => {
        console.warn("Optik Form Yönetimi kayıtları yüklenemedi:", error);
        setAvailableOpticForms([]);
      });
  }, []);

  React.useEffect(() => {
    const refreshManagedOpticForms = async () => {
      try {
        const { listOpticTemplates } = await import("../lib/opticTemplateApi");
        const forms = await listOpticTemplates();
        const managedForms = Array.isArray(forms)
          ? forms.filter((form: any) => String(form?.id || "").trim() && String(form?.name || "").trim())
          : [];
        setAvailableOpticForms(managedForms);
      } catch (error) {
        console.warn("Optik Form Yönetimi kayıtları yenilenemedi:", error);
        setAvailableOpticForms([]);
      }
    };

    // Oku-Düzenle ekranına her gelişte güncel SQLite optik listesini al.
    if (activeTab === "read-edit" || activeTab === "optic-settings") {
      void refreshManagedOpticForms();
    }

    // Optik Form Yönetimi yeni kayıt/güncelleme/silme sonrası bu olayı yayınlar.
    const handleOpticTemplatesChanged = () => {
      void refreshManagedOpticForms();
    };
    window.addEventListener("edupanel:optic-templates-changed", handleOpticTemplatesChanged);
    return () => window.removeEventListener("edupanel:optic-templates-changed", handleOpticTemplatesChanged);
  }, [activeTab]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setExamLockClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Bu yönetici işlem kilidi elektronik optiğin öğrenci erişiminden bağımsızdır.
  // Süre biliniyorsa sınav bitişiyle, diğerlerinde değerlendirme/yayınla kapanır.
  const isExamAdminLocked = (exam: any): boolean => {
    if (typeof exam?.adminEditLocked === "boolean") return exam.adminEditLocked;
    if (exam?.isEvaluated || exam?.electronicResultsPublished) return true;
    const time = Date.parse(String(exam?.examDate || ""));
    const minutes = Number(exam?.electronicDurationMinutes ?? exam?.examDurationMinutes ?? exam?.durationMinutes ?? exam?.examDuration);
    return Number.isFinite(time) && Number.isFinite(minutes) && minutes > 0 && examLockClock >= time + minutes * 60000;
  };

  const toggleExamAdminLock = async (exam: any) => {
    const id = String(exam?.id || "");
    if (!id || examLockSavingId) return;
    const locked = isExamAdminLocked(exam);
    const message = locked
      ? "Sınavın yönetici işlem kilidi açılsın mı? Bu işlem öğrencilere yeniden cevaplama hakkı vermez."
      : "Sınavın yönetici düzenleme ve silme işlemleri kilitlensin mi?";
    if (!window.confirm(message)) return;
    setExamLockSavingId(id);
    try {
      const { upsertLocalDocument } = await import("../lib/localDatabase");
      const newest = examsRef.current.find((row: any) => String(row.id) === id) || exam;
      const updated = { ...newest, adminEditLocked: !locked };
      await upsertLocalDocument("exams", id, updated);
      persistedExamRefs.current.set(id, updated);
      const next = examsRef.current.map((row: any) => String(row.id) === id ? updated : row);
      examsRef.current = next;
      setExams(next);
      try { localStorage.setItem("exams", JSON.stringify(next)); } catch {}
      void localforage.setItem("exams", next).catch(console.error);
    } catch (error: any) {
      alert(`Sınav işlem kilidi kaydedilemedi: ${error?.message || "Sunucu hatası"}`);
    } finally {
      setExamLockSavingId(null);
    }
  };

  React.useEffect(() => {
    examsRef.current = exams;
  }, [exams]);

  React.useEffect(() => {
    if (!examStorageReady) return;

    // Tarayıcıdaki son sağlam kopyayı güncel tut. SQLite tarafında ise bütün
    // sınav koleksiyonunu silip yeniden yazmak yerine yalnız değişen sınav
    // belgelerini UPSERT et. Böylece geçici/eksik bir UI snapshot'ı diğer
    // sınavları yanlışlıkla silemez. Silme işlemi yalnız açık silme akışında
    // ilgili belgeye DELETE gönderilerek yapılır.
    localforage.setItem("exams", exams).catch(console.error);
    try { localStorage.setItem("exams", JSON.stringify(exams)); } catch {}

    const changedExams = exams.filter((exam: any) => {
      const id = String(exam?.id || "").trim();
      return Boolean(id) && !deletingExamIdsRef.current.has(id) && !deletedExamIdsRef.current.has(id) && persistedExamRefs.current.get(id) !== exam;
    });
    if (changedExams.length === 0) return;

    const snapshots = changedExams.map((exam: any) => ({
      id: String(exam?.id || "").trim(),
      exam,
    }));

    examPersistChainRef.current = examPersistChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const { upsertLocalDocument } = await import("../lib/localDatabase");
        for (const { id, exam } of snapshots) {
          if (deletingExamIdsRef.current.has(id) || deletedExamIdsRef.current.has(id)) continue;
          await upsertLocalDocument("exams", id, exam);
          persistedExamRefs.current.set(id, exam);
        }
      })
      .catch((error) => {
        console.error("Sınav SQLite kaydı güncellenemedi; mevcut sınavlar korunuyor:", error);
      });
  }, [exams, examStorageReady]);

  const handleExamTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = normalizeExamTypeValue(e.target.value);
    setExamType(newType);
    setBranchExamModel("TYT");
    setExamCode(generateExamCode(newType, gradeLevel));
    setSelectedExamCourseId("");
    setSelectedExamCourseIds([]);
    setQuestionBlueprint([]);
    setBlueprintDraft({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
    setQuestionAssignments({});
    setTeacherSelectionBySubject({});
    if (newType === "TYT") {
      setContinueQuestionNumbers(true);
      setExamStructure(JSON.parse(JSON.stringify(DEFAULT_TYT_STRUCTURE)));
    } else if (newType === "AYT") {
      setExamStructure(JSON.parse(JSON.stringify(DEFAULT_AYT_STRUCTURE)));
    } else if (newType === "Ders Denemesi" || newType === "Branşlar Denemesi") {
      setExamStructure(newType === "Branşlar Denemesi"
        ? DEFAULT_TYT_STRUCTURE.map((test) => ({ ...test, testName: test.testName === "Temel Matematik Testi" ? "Matematik Testi" : test.testName, subjects: [] }))
        : [{ testName: newType, subjects: [] }]);
      if (newType === "Branşlar Denemesi") setContinueQuestionNumbers(true);
    } else if (newType === "Konu Denemesi") {
      setExamStructure([{ testName: "Konu Denemesi", subjects: [] }]);
    } else if (newType === "Ünite Denemesi") {
      setExamStructure([{ testName: "Ünite Denemesi", subjects: [] }]);
    }
  };

  const handleSubjectCountChange = (
    testIndex: number,
    subjectIndex: number,
    newCount: number,
  ) => {
    const newStructure = JSON.parse(JSON.stringify(examStructure));
    newStructure[testIndex].subjects[subjectIndex].count = newCount;
    setExamStructure(newStructure);
  };

  const toggleBranchSubject = (subjectName: string) => {
    const current = examStructure?.[0]?.subjects || [];
    const exists = current.some((s: any) => s.name === subjectName);
    const subjects = exists
      ? current.filter((s: any) => s.name !== subjectName)
      : [...current, { name: subjectName, count: 1 }];
    if (exists) setQuestionBlueprint((rows) => rows.filter((row: any) => row.subject !== subjectName));
    setExamStructure([{ testName: "Ders Denemesi", subjects }]);
  };

  const updateBranchSubjectCount = (subjectName: string, count: number) => {
    const current = examStructure?.[0]?.subjects || [];
    setExamStructure([{
      testName: "Ders Denemesi",
      subjects: current.map((s: any) => s.name === subjectName ? { ...s, count: Math.max(1, count || 1) } : s),
    }]);
  };

  const normalizeLabel = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  const [examCurriculumStore, setExamCurriculumStore] = useState<CurriculumStore>(readLegacyCurriculumStore);
  const [examCurriculumError, setExamCurriculumError] = useState("");
  useEffect(() => {
    if (!isModalOpen) return;
    let stopped = false;
    let requestId = 0;
    const refresh = async () => {
      const currentRequest = ++requestId;
      try {
        const store = await loadAuthoritativeCurriculumStore();
        if (!stopped && currentRequest === requestId) {
          setExamCurriculumStore(store);
          setExamCurriculumError("");
        }
      } catch (error) {
        if (!stopped && currentRequest === requestId) setExamCurriculumError(error instanceof Error ? error.message : String(error));
      }
    };
    void refresh();
    window.addEventListener(CURRICULUM_UPDATED_EVENT, refresh);
    return () => { stopped = true; window.removeEventListener(CURRICULUM_UPDATED_EVENT, refresh); };
  }, [isModalOpen]);
  const curriculumCatalogForBlueprint = React.useMemo(() => {
    const stores = examCurriculumStore;
    let sourceCourses: any[] = [];
    for (const key of ["custom_created_courses", "school_courses"]) {
      try { const parsed = JSON.parse(sqliteStorage.getItem(key) || "[]"); if (Array.isArray(parsed)) sourceCourses.push(...parsed); } catch {}
    }
    const courses: any[] = [];
    Object.entries(stores).forEach(([storageKey, raw]: any) => {
      const curriculum = raw || {};
      const id = String(storageKey).replace(/^curriculum_/, "");
      const source = sourceCourses.find((item:any) => String(item.id || item.courseId || "") === id) || {};
      const grade = String(curriculum.grade || curriculum.gradeLevel || curriculum.__curriculumMeta?.grade || source.gradeLevel || source.level || id.match(/^CURR-(9|10|11|12)-/)?.[1] || "").match(/\d{1,2}/)?.[0] || "";
      const name = String(curriculum.courseName || curriculum.name || curriculum.__curriculumMeta?.courseName || source.courseName || source.name || "").trim();
      if (grade && name && Array.isArray(curriculum.units)) courses.push({ id, grade, name, units: curriculum.units });
    });
    return courses;
  }, [examCurriculumStore, isModalOpen, gradeLevel]);

  const availableBlueprintCourses = React.useMemo(() => {
    const allowedGrades = gradeLevel === "YKS" ? ["9", "10", "11", "12"] : [String(gradeLevel)];
    // TYT modelinde Türkçe, Türk Dili ve Edebiyatı'ndan bağımsız bir müfredattır.
    // Türkçe müfredatı yönetici tarafından tanımlanınca, sınıf düzeyi başka olsa da
    // gerçek ders kaydı seçilebilir; boş/sahte müfredat oluşturulmaz.
    const isTytBranch = examType === "Branşlar Denemesi" && branchExamModel === "TYT";
    const matching = curriculumCatalogForBlueprint
      .filter((course: any) => allowedGrades.includes(String(course.grade)) ||
        (isTytBranch && normalizeLabel(course.name) === normalizeLabel("Türkçe")));
    // TYT'de müfredat henüz tanımlı olmasa bile Türkçe, Edebiyat'tan ayrı
    // bir ders olarak seçilebilsin. Müfredat eklenince gerçek ders kimliği kullanılır.
    if (isTytBranch && !matching.some((course: any) => normalizeLabel(course.name) === normalizeLabel("Türkçe"))) {
      matching.push({ id: "tyt-turkce-independent", grade: String(gradeLevel === "YKS" ? "9" : gradeLevel), name: "Türkçe", units: [] });
    }
    return matching.sort((a: any, b: any) => Number(a.grade) - Number(b.grade) || String(a.name).localeCompare(String(b.name), "tr"));
  }, [curriculumCatalogForBlueprint, gradeLevel, examType, branchExamModel]);

  const blueprintCourseFor = (subjectName: string, courseId?: string) => {
    if (courseId) {
      const exact = curriculumCatalogForBlueprint.find((course: any) => String(course.id) === String(courseId));
      if (exact) return exact;
    }
    const target = normalizeLabel(subjectName);
    const allowedGrades = gradeLevel === "YKS" ? ["9", "10", "11", "12"] : [String(gradeLevel)];
    return curriculumCatalogForBlueprint.find((course: any) => allowedGrades.includes(String(course.grade)) && (normalizeLabel(course.name) === target || normalizeLabel(course.name).includes(target) || target.includes(normalizeLabel(course.name))));
  };

  const syncBranchStructureFromBlueprint = (rows: any[]) => {
    const totals = new Map<string, number>();
    rows.forEach((row: any) => totals.set(row.subject, (totals.get(row.subject) || 0) + Number(row.count || 0)));
    if (examType === "Branşlar Denemesi") {
      setExamStructure((current) => current.map((test: any) => ({
        ...test,
        subjects: (test.subjects || []).map((subject: any) => ({
          ...subject, blueprintCount: totals.get(subject.name) || 0,
        })),
      })));
      return;
    }
    setExamStructure([{ testName: examType, subjects: Array.from(totals.entries()).map(([name, count]) => ({ name, count })) }]);
  };

  const selectedExamCourses = React.useMemo(() => {
    const selectedSet = new Set(selectedExamCourseIds.map(String));
    return availableBlueprintCourses.filter((course: any) => selectedSet.has(String(course.id)));
  }, [availableBlueprintCourses, selectedExamCourseIds]);

  const cleanAssignmentStateForCourses = (allowedCourseIds: string[]) => {
    const allowed = new Set(allowedCourseIds.map(String));
    const allowedKeys = new Set(
      availableBlueprintCourses
        .filter((course: any) => allowed.has(String(course.id)))
        .map((course: any) => `${String(course.grade || "")}__${String(course.name || "")}`),
    );
    setQuestionAssignments((current) => Object.fromEntries(
      Object.entries(current).filter(([key, value]: any) => {
        const courseId = String(value?.courseId || "");
        if (courseId) return allowed.has(courseId);
        return allowedKeys.has(key);
      }),
    ));
    setTeacherSelectionBySubject((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => allowedKeys.has(key)),
    ));
  };

  const changeBranchExamModel = (model: "TYT" | "AYT" | "Serbest") => {
    setBranchExamModel(model);
    setExamStructure(model === "TYT"
      ? DEFAULT_TYT_STRUCTURE.map((test) => ({ ...test, testName: test.testName === "Temel Matematik Testi" ? "Matematik Testi" : test.testName, subjects: [] }))
      : model === "AYT"
        ? DEFAULT_AYT_STRUCTURE.map((test) => ({ ...test, subjects: [] }))
        : []);
    setSelectedExamCourseId("");
    setSelectedExamCourseIds([]);
    setQuestionBlueprint([]);
    setQuestionAssignments({});
    setTeacherSelectionBySubject({});
    setBlueprintDraft({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
    setContinueQuestionNumbers(true);
  };

  const addModelSubject = (testIndex: number, courseId: string) => {
    const course = availableBlueprintCourses.find((item: any) => String(item.id) === String(courseId));
    if (!course || (branchExamModel !== "Serbest" && testIndex < 0)) return;
    if (examStructure.some((test: any) => (test.subjects || []).some((subject: any) => String(subject.courseId) === String(course.id)))) return;
    setExamStructure((current) => branchExamModel === "Serbest"
      ? [...current, { testName: course.name, subjects: [{ courseId: String(course.id), name: course.name, count: 1 }] }]
      : current.map((test: any, index: number) => index === testIndex
        ? { ...test, subjects: [...(test.subjects || []), { courseId: String(course.id), name: course.name, count: 1 }] }
        : test));
    setSelectedExamCourseIds((current) => current.includes(String(course.id)) ? current : [...current, String(course.id)]);
    setSelectedExamCourseId(String(course.id));
    setBlueprintDraft({ courseId: String(course.id), unitId: "", topicId: "", outcomeId: "", count: 1 });
  };

  const removeModelSubject = (testIndex: number, subjectIndex: number) => {
    const removed = examStructure[testIndex]?.subjects?.[subjectIndex];
    if (!removed) return;
    const id = String(removed.courseId || "");
    setExamStructure((current) => current.map((test: any, index: number) => index === testIndex
      ? { ...test, subjects: test.subjects.filter((_: any, i: number) => i !== subjectIndex) }
      : test));
    setSelectedExamCourseIds((ids) => ids.filter((item) => item !== id));
    setQuestionBlueprint((rows) => rows.filter((row: any) => String(row.courseId) !== id));
    if (selectedExamCourseId === id) setSelectedExamCourseId("");
  };

  const moveModelTest = (testIndex: number, direction: number) => {
    setExamStructure((current) => {
      const tests = [...current];
      const target = testIndex + direction;
      if (target < 0 || target >= tests.length) return current;
      [tests[testIndex], tests[target]] = [tests[target], tests[testIndex]];
      return tests;
    });
  };

  const moveModelSubject = (testIndex: number, subjectIndex: number, direction: number) => {
    setExamStructure((current) => current.map((test: any, index: number) => {
      if (index !== testIndex) return test;
      const subjects = [...test.subjects];
      const target = subjectIndex + direction;
      if (target < 0 || target >= subjects.length) return test;
      [subjects[subjectIndex], subjects[target]] = [subjects[target], subjects[subjectIndex]];
      return { ...test, subjects };
    }));
  };

  const toggleMultipleExamCourse = (courseId: string) => {
    const normalizedId = String(courseId);
    const exists = selectedExamCourseIds.some((id) => String(id) === normalizedId);
    if (exists) {
      const nextIds = selectedExamCourseIds.filter((id) => String(id) !== normalizedId);
      const nextActive = String(selectedExamCourseId) === normalizedId ? String(nextIds[0] || "") : selectedExamCourseId;
      setSelectedExamCourseIds(nextIds);
      setSelectedExamCourseId(nextActive);
      setBlueprintDraft({ courseId: nextActive, unitId: "", topicId: "", outcomeId: "", count: 1 });
      setQuestionBlueprint((rows) => {
        const next = rows.filter((row: any) => String(row.courseId) !== normalizedId);
        syncBranchStructureFromBlueprint(next);
        return next;
      });
      cleanAssignmentStateForCourses(nextIds);
      return;
    }

    const nextIds = examType === "Ders Denemesi" ? [normalizedId] : [...selectedExamCourseIds, normalizedId];
    if (examType === "Ders Denemesi" && selectedExamCourseIds.length > 0) {
      setQuestionBlueprint([]);
      setQuestionAssignments({});
      setTeacherSelectionBySubject({});
      setExamStructure([{ testName: "Ders Denemesi", subjects: [] }]);
    }
    setSelectedExamCourseIds(nextIds);
    setSelectedExamCourseId(normalizedId);
    setBlueprintDraft({ courseId: normalizedId, unitId: "", topicId: "", outcomeId: "", count: 1 });
  };

  const activateBlueprintCourse = (courseId: string) => {
    setSelectedExamCourseId(courseId);
    setBlueprintDraft({ courseId, unitId: "", topicId: "", outcomeId: "", count: 1 });
  };

  const resetBlueprintDraft = () => setBlueprintDraft({ courseId: selectedExamCourseId, unitId: "", topicId: "", outcomeId: "", count: 1 });

  // ÜNİTE TARAMA: tek ders + bir veya birden fazla ünite.
  // Konu/kazanım ayrıca seçilmez. Basılı Yayın kaynağında toplam soru sayısı sınav tanımında belirtilir.
  // Her seçili ünitenin tüm konu ve kazanımları sınav kapsamına dahil edilir.
  const selectUnitScanCourse = (courseId: string) => {
    const normalizedId = String(courseId || "");
    setSelectedExamCourseId(normalizedId);
    setSelectedExamCourseIds(normalizedId ? [normalizedId] : []);
    setBlueprintDraft({ courseId: normalizedId, unitId: "", topicId: "", outcomeId: "", count: 0 });
    setQuestionBlueprint([]);
    setQuestionAssignments({});
    setTeacherSelectionBySubject({});

    const course = availableBlueprintCourses.find((item: any) => String(item.id) === normalizedId);
    setExamStructure([{
      testName: "Ünite Denemesi",
      subjects: course ? [{ name: String(course.name || ""), count: 0 }] : [],
    }]);
  };

  const unitScanQuestionCount = Math.max(0, Number(examStructure?.[0]?.subjects?.[0]?.count || 0));

  const updateUnitScanQuestionCount = (value: number) => {
    const normalizedCount = Math.max(0, Math.floor(Number(value) || 0));
    const selectedCourse = availableBlueprintCourses.find((item: any) =>
      String(item.id) === String(selectedExamCourseId),
    );
    const existingSubjectName = String(examStructure?.[0]?.subjects?.[0]?.name || "");
    const subjectName = String(selectedCourse?.name || existingSubjectName || "");

    setExamStructure([{
      testName: "Ünite Denemesi",
      subjects: subjectName ? [{ name: subjectName, count: normalizedCount }] : [],
    }]);
  };

  const toggleUnitScanUnit = (unitId: string) => {
    const course = availableBlueprintCourses.find((item: any) =>
      String(item.id) === String(selectedExamCourseId),
    );
    const unit = course?.units?.find((item: any) => String(item.id) === String(unitId));
    if (!course || !unit) return;

    setBlueprintDraft({
      courseId: String(selectedExamCourseId || ""),
      unitId: "",
      topicId: "",
      outcomeId: "",
      count: 0,
    });

    setQuestionBlueprint((rows: any[]) => {
      const alreadySelected = rows.some((row: any) =>
        String(row?.courseId || "") === String(course.id || "") &&
        String(row?.unitId || "") === String(unit.id || ""),
      );

      return alreadySelected
        ? rows.filter((row: any) =>
            !(
              String(row?.courseId || "") === String(course.id || "") &&
              String(row?.unitId || "") === String(unit.id || "")
            ),
          )
        : [
            ...rows,
            {
              id: `unit-plan-${String(course.id)}-${String(unit.id)}`,
              subject: String(course.name || ""),
              courseId: String(course.id || ""),
              grade: String(course.grade || gradeLevel || ""),
              unitId: String(unit.id || ""),
              unitName: String(unit.name || ""),
              topicId: "",
              topicName: "",
              outcomeId: "",
              outcomeName: "",
              scopeType: "unit",
              includeAllTopics: true,
              includeAllOutcomes: true,
              count: 0,
            },
          ];
    });

    const existingCount = Number(
      examStructure?.[0]?.subjects?.find((subject: any) =>
        String(subject?.name || "") === String(course.name || ""),
      )?.count || 0,
    );
    setExamStructure([{
      testName: "Ünite Denemesi",
      subjects: [{ name: String(course.name || ""), count: Math.max(0, existingCount) }],
    }]);
  };

  const addBlueprintDraftToList = () => {
    const course = availableBlueprintCourses.find((item: any) => String(item.id) === String(selectedExamCourseId || blueprintDraft.courseId));
    const unit = course?.units?.find((item: any) => String(item.id) === String(blueprintDraft.unitId));
    const topic = unit?.topics?.find((item: any) => String(item.id) === String(blueprintDraft.topicId));
    const outcomes = topic?.outcomes || topic?.objectives || [];
    const outcome = blueprintDraft.outcomeId === "__ALL_OUTCOMES__" ? null : outcomes.find((item: any, index: number) => String(typeof item === "string" ? item : item?.id || item?.name || `outcome-${index}`) === String(blueprintDraft.outcomeId));
    const wholeUnit = blueprintDraft.topicId === "__ALL_TOPICS__";
    const wholeTopic = !wholeUnit && (examType === "Konu Denemesi" || blueprintDraft.outcomeId === "__ALL_OUTCOMES__");
    if (examType === "Konu Denemesi" && wholeUnit) return;
    const count = Math.max(1, Number(blueprintDraft.count) || 1);
    if (!course || !unit || (!wholeUnit && !topic) || (!wholeUnit && !wholeTopic && !outcome)) return;
    const row = {
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      subject: String(course.name || ""), courseId: String(course.id || ""), grade: String(course.grade || ""),
      unitId: String(unit.id || ""), unitName: String(unit.name || ""),
      topicId: wholeUnit ? "" : String(topic?.id || ""), topicName: wholeUnit ? "" : String(topic?.name || ""),
      outcomeId: (wholeUnit || wholeTopic) ? "" : String(typeof outcome === "string" ? outcome : outcome?.id || outcome?.name || ""),
      outcomeName: (wholeUnit || wholeTopic) ? "" : String(typeof outcome === "string" ? outcome : outcome?.name || outcome?.id || ""),
      scopeType: wholeUnit ? "unit" : wholeTopic ? "topic" : "outcome",
      includeAllTopics: wholeUnit,
      includeAllOutcomes: wholeUnit || wholeTopic,
      count,
    };
    setQuestionBlueprint((rows) => { const next = [...rows, row]; syncBranchStructureFromBlueprint(next); return next; });
    resetBlueprintDraft();
  };

  const addAllUnitsToBlueprint = () => {
    const course = availableBlueprintCourses.find((item: any) => String(item.id) === String(selectedExamCourseId));
    if (!course || !Array.isArray(course.units) || course.units.length === 0) return;
    const perUnitCount = Math.max(1, Number(blueprintDraft.count) || 1);
    setQuestionBlueprint((rows) => {
      const existingUnitIds = new Set(rows.filter((row: any) => String(row.courseId) === String(course.id) && row.scopeType === "unit").map((row: any) => String(row.unitId)));
      const added = course.units.filter((unit: any) => !existingUnitIds.has(String(unit.id))).map((unit: any, index: number) => ({
        id: `plan-all-${Date.now()}-${index}`,
        subject: String(course.name || ""), courseId: String(course.id), grade: String(course.grade || ""),
        unitId: String(unit.id), unitName: String(unit.name || ""),
        topicId: "", topicName: "", outcomeId: "", outcomeName: "",
        scopeType: "unit", includeAllTopics: true, includeAllOutcomes: true, count: perUnitCount,
      }));
      const next = [...rows, ...added];
      syncBranchStructureFromBlueprint(next);
      return next;
    });
  };

  const removeBlueprintRow = (id: string) => setQuestionBlueprint((rows) => {
    const next = rows.filter((row) => row.id !== id);
    syncBranchStructureFromBlueprint(next);
    return next;
  });

  const startBlueprintCountEdit = (row: any) => {
    setEditingBlueprintRowId(String(row.id));
    setEditingBlueprintCount(Math.max(1, Number(row.count) || 1));
  };

  const saveBlueprintCountEdit = (id: string) => {
    setQuestionBlueprint((rows) => {
      const next = rows.map((row) => row.id === id ? { ...row, count: Math.max(1, Number(editingBlueprintCount) || 1) } : row);
      syncBranchStructureFromBlueprint(next);
      return next;
    });
    setEditingBlueprintRowId(null);
  };

  const [persistedTeacherRows, setPersistedTeacherRows] = useState<any[]>([]);

  useEffect(() => {
    // Öğretmen listesi yalnız "Yeni/Güncelle" penceresinde değil, Soru İşlemleri
    // ekranında da gerekir. Aksi halde QuestionManagerView branş öğretmeni açılır
    // listesini boş alır.
    if (!isModalOpen && !managingExam) return;
    let cancelled = false;
    const loadTeachers = async () => {
      const rows: any[] = [];
      const add = (value: any) => {
        if (Array.isArray(value)) rows.push(...value.filter(Boolean));
        else if (value && typeof value === "object") rows.push(...Object.values(value).filter(Boolean));
      };
      // Öğretmenler uygulamanın Repository/SQLite katmanından okunur.
      // Öğretmen İşlemleri ekranının kullandığı gerçek kaynak budur.
      try { add(await teacherService.list()); } catch {}
      // Eski kurulumlarla uyumluluk için önceki depoları da yedek kaynak olarak tara.
      try { add(await localforage.getItem("school_teachers")); } catch {}
      try { add(await localforage.getItem("teachers")); } catch {}
      if (!cancelled) setPersistedTeacherRows(rows);
    };
    void loadTeachers();
    return () => { cancelled = true; };
  }, [isModalOpen, managingExam?.id]);

  const teacherCatalogForAssignment = React.useMemo(() => {
    // Sistemde kayıtlı öğretmenleri ve ders/branş eşleşmelerini mevcut kayıt kaynaklarından birleştir.
    const rows: any[] = [...persistedTeacherRows];
    const preferredKeys = [
      "teachers", "school_teachers", "teacher_list", "teacherList", "staff", "personnel",
      "teacherAssignments", "teacher_assignments", "course_teacher_assignments", "courseTeacherAssignments",
      "lessonTeacherAssignments", "teacherCourses", "teacher_courses", "dersOgretmenAtamalari", "ogretmenler",
    ];

    const pushStoredValue = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) rows.push(...value.filter(Boolean));
      else if (typeof value === "object") {
        Object.values(value).forEach((item:any) => {
          if (Array.isArray(item)) rows.push(...item.filter(Boolean));
          else if (item && typeof item === "object") rows.push(item);
        });
      }
    };

    // Bilinen SQLite/localStorage anahtarlarını oku.
    preferredKeys.forEach((key) => {
      let parsed: any = null;
      try { parsed = JSON.parse(sqliteStorage.getItem(key) || "null"); } catch {}
      pushStoredValue(parsed);
      parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
      pushStoredValue(parsed);
    });

    // Uygulamanın farklı sürümlerinde öğretmen kayıt anahtarı değişmişse de yakala.
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || "";
        if (!/(teacher|ogretmen|öğretmen|personel|staff|ders.*atama|course.*assign)/i.test(key)) continue;
        let parsed: any = null;
        try { parsed = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
        pushStoredValue(parsed);
      }
    } catch {}

    const map = new Map<string, any>();
    rows.filter(Boolean).forEach((raw:any, index:number) => {
      const teacher = raw.teacher || raw.ogretmen || raw.person || raw.personnel || raw.user || raw;
      const id = String(
        teacher.id || teacher.teacherId || teacher.ogretmenId || teacher.userId || teacher.tc || teacher.tcKimlikNo ||
        raw.teacherId || raw.ogretmenId || raw.userId || `teacher-${index}`
      );
      const name = String(
        teacher.name || teacher.fullName || teacher.adSoyad || teacher.ad_soyad || teacher.teacherName ||
        teacher.ogretmenAdi || teacher.ogretmenAdSoyad || raw.teacherName || raw.ogretmenAdi || raw.adSoyad || ""
      ).trim();
      if (!name) return;

      const courseValues = [
        teacher.branch, teacher.branchName, teacher.brans, teacher.bransAdi, teacher.alan, teacher.subject,
        teacher.subjectName, teacher.course, teacher.courseName, teacher.ders, teacher.dersAdi, teacher.lessonName,
        raw.branch, raw.branchName, raw.brans, raw.bransAdi, raw.alan, raw.subject, raw.subjectName,
        raw.course, raw.courseName, raw.ders, raw.dersAdi, raw.lessonName,
        teacher.branches, teacher.subjects, teacher.courses, teacher.lessons, teacher.dersler,
        raw.branches, raw.subjects, raw.courses, raw.lessons, raw.dersler,
      ]
        .flatMap((v:any) => Array.isArray(v) ? v : (v ? [v] : []))
        .map((v:any) => String(typeof v === "object" ? (
          v.name || v.branch || v.branchName || v.brans || v.bransAdi || v.subject || v.subjectName ||
          v.courseName || v.ders || v.dersAdi || v.lessonName || ""
        ) : v).trim())
        .filter(Boolean);

      const previous = map.get(id);
      map.set(id, { id, name, courses: Array.from(new Set([...(previous?.courses || []), ...courseValues])) });
    });
    return Array.from(map.values()).sort((a:any,b:any)=>a.name.localeCompare(b.name,"tr"));
  }, [isModalOpen, persistedTeacherRows]);

  const teachersForSubject = (subject: string) => {
    const aliases: Record<string, string[]> = {
      "türk dili ve edebiyatı": ["türk dili ve edebiyatı", "edebiyat", "türkçe"],
      "din kültürü ve ahlak bilgisi": ["din kültürü ve ahlak bilgisi", "din kültürü", "dkab"],
      "yabancı dil": ["yabancı dil", "ingilizce", "almanca", "fransızca"],
      "felsefe grubu": ["felsefe grubu", "felsefe"],
    };
    const clean = (value:string) => normalizeLabel(value).replace(/-\d+$/g, "").trim();
    const target = clean(subject);
    const accepted = new Set([target, ...(aliases[target] || []).map(clean)]);
    return teacherCatalogForAssignment.filter((teacher:any) => (teacher.courses || []).some((course:string) => {
      const value = clean(course);
      return Array.from(accepted).some((candidate) => value === candidate || value.includes(candidate) || candidate.includes(value));
    }));
  };

  const assignTeacherToSubject = async (
    subject: string,
    grade: string,
    explicitTeacherId?: string,
    sourceExam?: any,
  ) => {
    const effectiveGrade = String(sourceExam?.gradeLevel || grade || gradeLevel || "");
    const key = `${effectiveGrade}__${subject}`;
    const teacherId = String(explicitTeacherId || teacherSelectionBySubject[key] || "");
    const teacher = teacherCatalogForAssignment.find((item:any) => String(item.id) === teacherId);
    if (!teacher) { window.alert("Önce branş öğretmeni seçiniz."); return null; }

    const sourceBlueprint = Array.isArray(sourceExam?.questionBlueprint)
      ? sourceExam.questionBlueprint
      : questionBlueprint;
    const sourceAssignments = sourceExam?.questionAssignments && typeof sourceExam.questionAssignments === "object"
      ? sourceExam.questionAssignments
      : questionAssignments;
    const scopes = sourceBlueprint.filter((row:any) =>
      String(row.subject || "").trim().toLocaleLowerCase("tr-TR") === subject.trim().toLocaleLowerCase("tr-TR") &&
      (!String(row.grade || "").trim() || String(row.grade || "") === effectiveGrade)
    );
    if (!scopes.length) { window.alert("Bu ders için kayıtlı sınav kapsamı bulunamadı."); return null; }

    const existingAssignment:any =
      sourceAssignments[key] ||
      Object.values(sourceAssignments || {}).find((item:any) =>
        String(item?.subject || item?.courseName || "").trim().toLocaleLowerCase("tr-TR") ===
        subject.trim().toLocaleLowerCase("tr-TR")
      ) ||
      null;
    const assignmentId = existingAssignment?.id || existingAssignment?.__documentId || `qassign-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const requiredCount = scopes.reduce((sum:number,row:any)=>sum+Number(row.count||0),0);
    const now = new Date().toISOString();

    // Öğretmen değiştirildiğinde görev sıfırlanmaz. Aynı görevin daha önce seçilmiş
    // soruları ve ilerleme bilgisi yeni öğretmene devredilir. Önce sınav kaydını,
    // ardından ortak veritabanındaki güncel görevi esas alıyoruz.
    let previousAssignment:any = existingAssignment || null;
    try {
      const previousResponse = await fetch(`/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
      if (previousResponse.ok) {
        const previousBody:any = await previousResponse.json().catch(() => null);
        const candidate = previousBody?.data || previousBody?.item || previousBody?.record || previousBody;
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) previousAssignment = candidate;
      }
    } catch {}

    // Öğretmen telefonu görevleri yerel tarayıcı kaydından değil ortak API/veritabanından okur.
    // Bu nedenle görevlendirme anında soru havuzunu hazırlayıp teacherTestAssignments koleksiyonuna yazıyoruz.
    try {
      const allQuestions:any[] = [];
      const seen = new Set<string>();

      for (const scope of scopes) {
        const params = new URLSearchParams();
        params.set("status", "active");
        params.set("usage", "unused");
        params.set("grade", String(scope.grade || grade || gradeLevel || ""));
        if (scope.courseId) params.set("courseId", String(scope.courseId));
        if (scope.unitId) params.set("unitId", String(scope.unitId));
        if (scope.topicId) params.set("topicId", String(scope.topicId));
        if (scope.outcomeId) params.set("outcomeId", String(scope.outcomeId));
        params.set("limit", "500");

        const readRows = (payload:any): any[] => Array.isArray(payload) ? payload : Array.isArray(payload?.questions) ? payload.questions : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.records) ? payload.records : Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : [];
        const normalizeLabel = (value:any) => String(value ?? "")
          .toLocaleLowerCase("tr-TR")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
          .replace(/[^a-z0-9]+/g, " ").trim();
        const sameValue = (a:any, b:any) => !!normalizeLabel(a) && normalizeLabel(a) === normalizeLabel(b);
        const firstValue = (raw:any, keys:string[]) => keys.map(k => raw?.[k]).find(v => v !== undefined && v !== null && String(v).trim() !== "");
        const scopeMatches = (raw:any) => {
          const unitId = firstValue(raw, ["unitId","unit_id","unitKey","unit_key"]);
          const topicId = firstValue(raw, ["topicId","topic_id","topicKey","topic_key"]);
          const outcomeId = firstValue(raw, ["outcomeId","outcome_id","outcomeKey","outcome_key","learningOutcomeId","learning_outcome_id"]);
          const unitName = firstValue(raw, ["unitName","unit_name","unit","unitTitle","unit_title"]);
          const topicName = firstValue(raw, ["topicName","topic_name","topic","topicTitle","topic_title"]);
          const outcomeName = firstValue(raw, ["outcomeName","outcome_name","outcome","outcomeTitle","outcome_title","learningOutcome","learning_outcome","acquisitionName","acquisition_name","kazanim","kazanım"]);
          const idOrName = (wantedId:any, actualId:any, wantedName:any, actualName:any) => {
            if (!wantedId && !wantedName) return true;
            if (wantedId && actualId && String(wantedId) === String(actualId)) return true;
            return sameValue(wantedName, actualName);
          };
          return idOrName(scope.unitId, unitId, scope.unitName, unitName)
            && idOrName(scope.topicId, topicId, scope.topicName, topicName)
            && idOrName(scope.outcomeId, outcomeId, scope.outcomeName, outcomeName);
        };

        let response = await fetch(`/api/question-bank/questions?${params.toString()}`, { cache: "no-store" });
        let payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(payload?.error || "Soru havuzu okunamadı."));
        let rows = readRows(payload);

        // Eski soru kayıtlarında görünen ünite/konu/kazanım aynı olsa da ID'ler yeni
        // müfredat ağacındaki ID'lerden farklı olabiliyor. Kesin ID sorgusu sonuç vermezse
        // dersi/sınıfı geniş okuyup adları normalize ederek gerçek kapsamı eşleştiriyoruz.
        if (!rows.length) {
          const fallbackParams = new URLSearchParams();
          fallbackParams.set("status", "active");
        fallbackParams.set("usage", "unused");
          fallbackParams.set("grade", String(scope.grade || grade || gradeLevel || ""));
          if (scope.courseId) fallbackParams.set("courseId", String(scope.courseId));
          fallbackParams.set("limit", "1000");
          response = await fetch(`/api/question-bank/questions?${fallbackParams.toString()}`, { cache: "no-store" });
          payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(payload?.error || "Soru havuzu okunamadı."));
          rows = readRows(payload).filter(scopeMatches);
        }

        // courseId de eski/yeni ders tanımlarında değişmiş olabilir. Son güvenli geri dönüş:
        // 9. sınıfın aktif sorularını okuyup ders adı + kapsam adlarıyla eşleştir.
        if (!rows.length) {
          const broadParams = new URLSearchParams();
          broadParams.set("status", "active");
        broadParams.set("usage", "unused");
          broadParams.set("grade", String(scope.grade || grade || gradeLevel || ""));
          broadParams.set("limit", "2000");
          response = await fetch(`/api/question-bank/questions?${broadParams.toString()}`, { cache: "no-store" });
          payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(payload?.error || "Soru havuzu okunamadı."));
          const expectedCourse = scope.subject || subject;
          rows = readRows(payload).filter((raw:any) => {
            const courseName = firstValue(raw, ["courseName","course_name","subject","subjectName","subject_name","lessonName","lesson_name","ders"]);
            const courseOk = !courseName || sameValue(expectedCourse, courseName);
            return courseOk && scopeMatches(raw);
          });
        }

        rows.forEach((raw:any, index:number) => {
          const qid = String(raw.questionId || raw.question_id || raw.id || raw.key || raw.questionCode || raw.question_code || raw.code || raw.fileName || raw.file_name || `${scope.id}-${index}`);
          if (!qid || seen.has(qid)) return;
          seen.add(qid);
          allQuestions.push({
            ...raw,
            id: qid,
            key: qid,
            questionId: qid,
            code: String(raw.questionCode || raw.question_code || raw.code || raw.fileName || raw.file_name || qid),
            imageUrl: String(raw.imageUrl || raw.image_url || ""),
            thumbnailUrl: String(raw.thumbnailUrl || raw.thumbnail_url || ""),
            storagePath: String(raw.storagePath || raw.storage_path || ""),
            unitId: String(raw.unitId || raw.unit_id || scope.unitId || ""),
            unitName: String(raw.unitName || raw.unit_name || scope.unitName || ""),
            topicId: String(raw.topicId || raw.topic_id || scope.topicId || ""),
            topicName: String(raw.topicName || raw.topic_name || scope.topicName || ""),
            outcomeId: String(raw.outcomeId || raw.outcome_id || scope.outcomeId || ""),
            outcomeName: String(raw.outcomeName || raw.outcome_name || scope.outcomeName || ""),
          });
        });
      }

      if (!allQuestions.length) {
        window.alert("Seçilen ünite / konu / kazanım kapsamlarında veri tabanında aktif soru bulunamadı. Görevlendirme yapılmadı.");
        return;
      }

      const scopeTree = scopes.map((scope:any) => ({
        id: String(scope.unitId || scope.id),
        name: String(scope.unitName || "Ünite"),
        requiredQuestionCount: Number(scope.count || 0),
        topics: scope.topicId ? [{
          id: String(scope.topicId),
          name: String(scope.topicName || "Konu"),
          requiredQuestionCount: Number(scope.count || 0),
          outcomes: scope.outcomeId ? [{
            id: String(scope.outcomeId),
            name: String(scope.outcomeName || "Kazanım"),
            requiredQuestionCount: Number(scope.count || 0),
            questions: allQuestions.filter((q:any) => String(q.outcomeId) === String(scope.outcomeId)),
          }] : [],
        }] : [],
      }));

      const assignment:any = {
        assignmentKind: "exam",
        workflowType: "exam-question-selection",
        id: assignmentId,
        testId: String(sourceExam?.id || editingExamId || sourceExam?.examCode || examCode || assignmentId),
        examId: String(sourceExam?.id || editingExamId || sourceExam?.examCode || examCode || assignmentId),
        examCode: String(sourceExam?.examCode || examCode || ""),
        testName: String(sourceExam?.examName || examName || sourceExam?.examCode || examCode || "Sınav Soru Seçimi"),
        examName: String(sourceExam?.examName || examName || ""),
        testType: normalizeExamTypeValue(sourceExam?.examType || examType),
        grade: effectiveGrade,
        courseId: String(scopes[0]?.courseId || ""),
        courseName: subject,
        subject: subject,
        teacherId: String(teacher.id),
        teacherName: teacher.name,
        scopes: JSON.parse(JSON.stringify(scopes)),
        scopeTree,
        availableQuestionSnapshots: allQuestions,
        questionCountMode:
          normalizeExamTypeValue(sourceExam?.examType || examType) === "Ünite Denemesi" || requiredCount <= 0
            ? "flexible"
            : "fixed",
        requiredQuestionCount:
          normalizeExamTypeValue(sourceExam?.examType || examType) === "Ünite Denemesi" || requiredCount <= 0
            ? 0
            : requiredCount,
        maxQuestionCount:
          normalizeExamTypeValue(sourceExam?.examType || examType) === "Ünite Denemesi" || requiredCount <= 0
            ? Math.max(1, allQuestions.length)
            : requiredCount,
        // Öğretmen değişse bile yarım kalan seçim aynen devredilir.
        selectedQuestionKeys: Array.isArray(previousAssignment?.selectedQuestionKeys)
          ? previousAssignment.selectedQuestionKeys.slice(
              0,
              normalizeExamTypeValue(sourceExam?.examType || examType) === "Ünite Denemesi" || requiredCount <= 0
                ? Math.max(1, allQuestions.length)
                : requiredCount,
            )
          : [],
        selectedQuestionSnapshots: Array.isArray(previousAssignment?.selectedQuestionSnapshots)
          ? previousAssignment.selectedQuestionSnapshots.slice(
              0,
              normalizeExamTypeValue(sourceExam?.examType || examType) === "Ünite Denemesi" || requiredCount <= 0
                ? Math.max(1, allQuestions.length)
                : requiredCount,
            )
          : [],
        selectionStatus: "in_progress",
        completedAt: "",
        createdAt: previousAssignment?.createdAt || existingAssignment?.createdAt || now,
        reassignedFromTeacherId: previousAssignment?.teacherId && String(previousAssignment.teacherId) !== String(teacher.id) ? String(previousAssignment.teacherId) : previousAssignment?.reassignedFromTeacherId || "",
        reassignedFromTeacherName: previousAssignment?.teacherName && String(previousAssignment.teacherId) !== String(teacher.id) ? String(previousAssignment.teacherName) : previousAssignment?.reassignedFromTeacherName || "",
        reassignedAt: previousAssignment?.teacherId && String(previousAssignment.teacherId) !== String(teacher.id) ? now : previousAssignment?.reassignedAt || "",
        updatedAt: now,
      };

      // Görevlendirmeyi tek sunucu endpoint'i üzerinden atomik kaydet. Endpoint
      // öğretmenin aktif mobil bağlantısını çözer, görevi teacherTestAssignments'a
      // ve aynı anda exams belgesine yazar. Böylece masaüstü “atanmış” gösterirken
      // mobilin boş kalması veya sekme değişince atamanın kaybolması engellenir.
      const saveResponse = await fetch("/api/question-bank/teacher-assignments/reassign-by-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          examId: String(sourceExam?.id || editingExamId || ""),
          examCode: String(sourceExam?.examCode || examCode || ""),
          subjectName: subject,
          teacherId: String(teacher.id),
          teacherName: teacher.name,
          seedAssignment: assignment,
          examSnapshot: sourceExam || null,
        }),
        cache: "no-store",
      });
      const saveBody = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(String(saveBody?.error || "Öğretmen görevlendirmesi ortak veritabanına kaydedilemedi."));

      const savedAssignment = saveBody?.assignment || assignment;
      setQuestionAssignments((current) => ({ ...current, [key]: savedAssignment }));

      if (sourceExam?.id) {
        const serverExam =
          saveBody?.exam && String(saveBody.exam?.id || "") === String(sourceExam.id)
            ? saveBody.exam
            : null;
        const nextExam = serverExam || {
          ...sourceExam,
          questionAssignments: {
            ...(sourceExam.questionAssignments || {}),
            [key]: savedAssignment,
          },
          questionSelectionModeBySubject: {
            ...(sourceExam.questionSelectionModeBySubject || {}),
            [subject]: "teacher",
          },
        };
        handleUpdateExam(nextExam);
      }

      window.alert(`${savedAssignment.teacherName || teacher.name} görevlendirildi. Görev öğretmenin telefonundaki Soru İşlemleri ekranına gönderildi.`);
      return savedAssignment;
    } catch (error) {
      console.error("Öğretmen soru seçimi görevlendirme hatası:", error);
      window.alert(error instanceof Error ? error.message : "Öğretmen görevlendirmesi kaydedilemedi.");
      return null;
    }
  };

  const persistQuestionAssignments = (savedExams:any[]) => {
    const records = savedExams.flatMap((exam:any) => Object.values(exam.questionAssignments || {}).map((assignment:any) => ({
      ...(assignment as any), examId: exam.id, examName: exam.examName, examCode: exam.examCode, examType: normalizeExamTypeValue(exam.examType),
      gradeLevel: exam.gradeLevel, examDate: exam.examDate,
    })));
    try { sqliteStorage.setItem("question_selection_assignments_v1", JSON.stringify(records)); } catch {}
    try { localStorage.setItem("question_selection_assignments_v1", JSON.stringify(records)); } catch {}
  };

  const openNewExamModal = () => {
    setEditingExamId(null);
    setQuestionAssignments({});
    setTeacherSelectionBySubject({});
    setPublisherName("");
    setExamName(buildAutomaticExamName(exams, "YKS", "TYT", []));
    setExamDate("");
    setElectronicDurationMinutes(120);
    setExamSource("Sistem");
    setExamType("TYT");
    setBranchExamModel("Serbest");
    setExamCode(generateExamCode("TYT", "YKS"));
    setInstitutionName("Ordu Lisesi");
    setTargetAudience("");
    setExamStatus("Hazırlanıyor");
    setCreateResultPdf(true);
    setSendToParents(false);
    setSendToStudents(false);
    setShowSchoolRank(true);
    setShowClassRank(true);
    setShowTurkeyRank(false);
    setIncludeSubjectAnalysis(true);
    setPdfTemplate("HASAT Analiz Karnesi");
    setResultFilePattern("{YIL}_{SINAV_KODU}_{OGR_ADI}_{OGR_NO}.pdf");
    setExamStructure(JSON.parse(JSON.stringify(DEFAULT_TYT_STRUCTURE)));
    setQuestionBlueprint([]);
    setSelectedExamCourseId("");
    setSelectedExamCourseIds([]);
    setBlueprintDraft({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
    setGradeLevel("YKS");
    setParticipantGroup("school");
    setBookletType("A");
    setAnsweringMethod("Optik");
    setContinueQuestionNumbers(true);
    setOpticForm(
      availableOpticForms.length > 0
        ? availableOpticForms[0].name
        : "",
    );
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!isModalOpen || editingExamId || participantGroup === "trial-club") return;
    const selectedCourseNamesForName = selectedExamCourses.map((course: any) =>
      String(course?.name || "").trim(),
    );
    setExamName(
      buildAutomaticExamName(
        exams,
        gradeLevel,
        examType,
        selectedCourseNamesForName,
      ),
    );
  }, [
    isModalOpen,
    editingExamId,
    participantGroup,
    gradeLevel,
    examType,
    exams,
    selectedExamCourses,
  ]);

  const openEditExamModal = (exam: any) => {
    setEditingExamId(exam.id);
    setExamSource(exam.examSource);
    setExamType(normalizeExamTypeValue(exam.examType));
    setBranchExamModel(exam.branchExamModel === "TYT" || exam.branchExamModel === "AYT" ? exam.branchExamModel : "Serbest");
    setGradeLevel(exam.gradeLevel);
    setParticipantGroup(exam.participantGroup === "trial-club" ? "trial-club" : "school");
    setBookletType(exam.bookletType);
    setAnsweringMethod(exam.answeringMethod === "Elektronik" ? "Elektronik" : "Optik");
    setContinueQuestionNumbers(
      exam.questionNumberingMode === "continuous" ||
      exam.continueQuestionNumbers === true ||
      (normalizeExamTypeValue(exam.examType) === "TYT" && exam.questionNumberingMode == null && exam.continueQuestionNumbers == null),
    );
    setExamDate(exam.examDate);
    setElectronicDurationMinutes(Math.max(1, Number(exam.electronicDurationMinutes || 120)));
    setOpticForm(exam.opticForm);
    setPublisherName(exam.publisherName || "");
    setExamName(replaceLegacyExamTerminology(exam.examName || ""));
    setExamCode(exam.examCode || generateExamCode(normalizeExamTypeValue(exam.examType), exam.gradeLevel));
    setInstitutionName(exam.institutionName || "Ordu Lisesi");
    setTargetAudience(exam.targetAudience || "");
    setExamStatus(exam.examStatus || (exam.isEvaluated ? "Değerlendirildi" : "Hazırlanıyor"));
    setCreateResultPdf(exam.resultSettings?.createResultPdf ?? true);
    setSendToParents(exam.resultSettings?.sendToParents ?? false);
    setSendToStudents(exam.resultSettings?.sendToStudents ?? false);
    setShowSchoolRank(exam.resultSettings?.showSchoolRank ?? true);
    setShowClassRank(exam.resultSettings?.showClassRank ?? true);
    setShowTurkeyRank(exam.resultSettings?.showTurkeyRank ?? false);
    setIncludeSubjectAnalysis(exam.resultSettings?.includeSubjectAnalysis ?? true);
    setPdfTemplate(exam.resultSettings?.pdfTemplate || "HASAT Analiz Karnesi");
    setResultFilePattern(exam.resultSettings?.resultFilePattern || "{YIL}_{SINAV_KODU}_{OGR_ADI}_{OGR_NO}.pdf");
    setExamStructure(
      exam.examStructure
        ? JSON.parse(JSON.stringify(exam.examStructure)).map((test: any) => ({
            ...test,
            testName: replaceLegacyExamTerminology(test?.testName || ""),
          }))
        : [],
    );
    const savedBlueprint = Array.isArray(exam.questionBlueprint) ? JSON.parse(JSON.stringify(exam.questionBlueprint)) : [];
    const blueprintCourseIds = Array.from(new Set(savedBlueprint.map((row: any) => String(row?.courseId || "")).filter(Boolean)));
    const savedCourseIds = Array.isArray(exam.selectedCourseIds)
      ? exam.selectedCourseIds.map((id: any) => String(id || "")).filter(Boolean)
      : (blueprintCourseIds.length > 0 ? blueprintCourseIds : [String(exam.selectedCourseId || "")].filter(Boolean));
    const preferredSavedCourseId = String(exam.selectedCourseId || savedBlueprint?.[0]?.courseId || "");
    const savedCourseId = savedCourseIds.includes(preferredSavedCourseId)
      ? preferredSavedCourseId
      : String(savedCourseIds[0] || preferredSavedCourseId || "");
    const savedUnitScanScope = normalizeExamTypeValue(exam.examType) === "Ünite Denemesi"
      ? savedBlueprint.find((row: any) => String(row?.unitId || "").trim())
      : null;
    const savedUnitId = String(
      savedUnitScanScope?.unitId || exam?.selectedUnitId || exam?.unitId || "",
    );
    setQuestionBlueprint(savedBlueprint);
    setSelectedExamCourseIds(savedCourseIds);
    setSelectedExamCourseId(savedCourseId);
    setBlueprintDraft({
      courseId: savedCourseId,
      unitId: savedUnitId,
      topicId: "",
      outcomeId: "",
      count: normalizeExamTypeValue(exam.examType) === "Ünite Denemesi" ? 0 : 1,
    });
    setQuestionAssignments(exam.questionAssignments ? JSON.parse(JSON.stringify(exam.questionAssignments)) : {});
    setTeacherSelectionBySubject(Object.fromEntries(Object.entries(exam.questionAssignments || {}).map(([key, value]:any) => [key, value?.teacherId || ""])));
    setIsModalOpen(true);
  };

  useEffect(() => {
    const effectiveInitialExamId = initialExamId || transferredExamId;
    if (!examStorageReady || !effectiveInitialExamId) return;

    const transferredExam = exams.find(
      (exam) => exam.id === effectiveInitialExamId,
    );
    if (!transferredExam) return;

    setActiveTab("exams");
    openEditExamModal(transferredExam);

    try {
      localStorage.removeItem("exam_prepare_initial_id");
    } catch {}

    setTransferredExamId(null);
    onInitialExamHandled?.();
  }, [
    examStorageReady,
    initialExamId,
    transferredExamId,
    exams,
  ]);

  const resolveSelectedOpticTemplate = () => {
    const selectedValue = String(opticForm || "").trim();
    const normalizedSelected = selectedValue.toLocaleLowerCase("tr-TR");

    return (
      availableOpticForms.find(
        (form: any) => String(form?.id || "") === selectedValue,
      ) ||
      availableOpticForms.find(
        (form: any) =>
          String(form?.name || "")
            .trim()
            .toLocaleLowerCase("tr-TR") === normalizedSelected,
      ) ||
      null
    );
  };

  const examStartTimestampForSave = (value: string): number => {
    const raw = String(value || "").trim().replace(" ", "T");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return 0;
    const parsed = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+03:00`);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (examSavePendingRef.current) return;
    examSavePendingRef.current = true;
    setExamSavePending(true);
    try {

    const effectiveQuestionAssignments = Object.fromEntries(Object.entries(questionAssignments).map(([key, assignment]:any) => {
      const assignmentSubject = String(assignment.subject || assignment.courseName || "").trim();
      const scopes = questionBlueprint.filter((row:any) => String(row.subject || "").trim() === assignmentSubject && String(row.grade || "") === String(assignment.grade || ""));
      return [key, {
        ...assignment,
        subject: assignmentSubject,
        courseName: String(assignment.courseName || assignmentSubject),
        scopes: JSON.parse(JSON.stringify(scopes)),
        requiredCount: scopes.reduce((sum:number,row:any)=>sum+Number(row.count||0),0)
      }];
    }));

    const selectedOpticTemplate = resolveSelectedOpticTemplate();
    const selectedOpticName =
      selectedOpticTemplate?.name || String(opticForm || "").trim();
    const selectedOpticId =
      selectedOpticTemplate?.id || "";

    const isCourseBasedExam = ["Ders Denemesi", "Branşlar Denemesi", "Ünite Denemesi", "Konu Denemesi"].includes(examType);
    const selectedCourseIdsForSave = isCourseBasedExam
      ? (examType === "Ders Denemesi" ? selectedExamCourseIds.slice(0, 1) : selectedExamCourseIds).map(String).filter(Boolean)
      : [];
    const orderedCourseIdsForSave = examType === "Branşlar Denemesi"
      ? examStructure.flatMap((test: any) => (test.subjects || []).map((subject: any) => String(subject.courseId || ""))).filter(Boolean)
      : selectedCourseIdsForSave;
    const selectedCoursesForSave = orderedCourseIdsForSave.map((id: string) => availableBlueprintCourses.find((course: any) => String(course.id) === id)).filter(Boolean);
    const primarySelectedCourse = selectedCoursesForSave.find((course: any) => String(course.id) === String(selectedExamCourseId)) || selectedCoursesForSave[0] || null;

    let updatedExams;

    if (editingExamId) {
      updatedExams = exams.map((ex) =>
        ex.id === editingExamId
          ? {
              ...ex,
              examSource,
              examType,
              branchExamModel: examType === "Branşlar Denemesi" ? branchExamModel : null,
              gradeLevel,
              participantGroup,
              participantLabel: participantGroup === "trial-club" ? "Deneme Kulübü" : "Okul Öğrencileri",
              selectedCourseId: isCourseBasedExam ? String(primarySelectedCourse?.id || "") : "",
              selectedCourseName: isCourseBasedExam ? String(primarySelectedCourse?.name || "") : "",
              selectedCourseIds: orderedCourseIdsForSave,
              selectedCourseNames: selectedCoursesForSave.map((course: any) => String(course.name || "")),
              courseSelectionMode: isCourseBasedExam && selectedCourseIdsForSave.length > 1 ? "multiple" : "single",
              selectedUnitId: examType === "Ünite Denemesi" ? String(questionBlueprint[0]?.unitId || "") : "",
              selectedUnitName: examType === "Ünite Denemesi" ? String(questionBlueprint[0]?.unitName || "") : "",
              selectedUnitIds: examType === "Ünite Denemesi"
                ? questionBlueprint.map((row: any) => String(row?.unitId || "")).filter(Boolean)
                : [],
              selectedUnitNames: examType === "Ünite Denemesi"
                ? questionBlueprint.map((row: any) => String(row?.unitName || "")).filter(Boolean)
                : [],
              bookletType,
              answeringMethod,
              continueQuestionNumbers: examType === "Branşlar Denemesi" ? true : continueQuestionNumbers,
              questionNumberingMode: (examType === "Branşlar Denemesi" || continueQuestionNumbers) ? "continuous" : "restart-per-subject",
              examDate,
              examStartsAt: examStartTimestampForSave(examDate),
              electronicDurationMinutes,
              opticForm: selectedOpticName,
              opticFormId: selectedOpticId,
              opticTemplate: selectedOpticTemplate
                ? JSON.parse(JSON.stringify(selectedOpticTemplate))
                : ex.opticTemplate || null,
              publisherName,
              examName,
              examCode: examCode || generateExamCode(examType, gradeLevel),
              institutionName,
              targetAudience,
              examStatus,
              resultSettings: {
                createResultPdf,
                sendToParents,
                sendToStudents,
                showSchoolRank,
                showClassRank,
                showTurkeyRank,
                includeSubjectAnalysis,
                pdfTemplate,
                resultFilePattern,
              },
              examStructure,
              questionBlueprint,
              questionAssignments: effectiveQuestionAssignments,
            }
          : ex,
      );
    } else {
      const newExam = {
        id: `exam-${Date.now()}`,
        examSource,
        examType,
        branchExamModel: examType === "Branşlar Denemesi" ? branchExamModel : null,
        gradeLevel,
        participantGroup,
        participantLabel: participantGroup === "trial-club" ? "Deneme Kulübü" : "Okul Öğrencileri",
        selectedCourseId: isCourseBasedExam ? String(primarySelectedCourse?.id || "") : "",
        selectedCourseName: isCourseBasedExam ? String(primarySelectedCourse?.name || "") : "",
        selectedCourseIds: orderedCourseIdsForSave,
        selectedCourseNames: selectedCoursesForSave.map((course: any) => String(course.name || "")),
        courseSelectionMode: isCourseBasedExam && selectedCourseIdsForSave.length > 1 ? "multiple" : "single",
        selectedUnitId: examType === "Ünite Denemesi" ? String(questionBlueprint[0]?.unitId || "") : "",
        selectedUnitName: examType === "Ünite Denemesi" ? String(questionBlueprint[0]?.unitName || "") : "",
              selectedUnitIds: examType === "Ünite Denemesi"
                ? questionBlueprint.map((row: any) => String(row?.unitId || "")).filter(Boolean)
                : [],
              selectedUnitNames: examType === "Ünite Denemesi"
                ? questionBlueprint.map((row: any) => String(row?.unitName || "")).filter(Boolean)
                : [],
        bookletType,
        answeringMethod,
        continueQuestionNumbers: examType === "Branşlar Denemesi" ? true : continueQuestionNumbers,
        questionNumberingMode: (examType === "Branşlar Denemesi" || continueQuestionNumbers) ? "continuous" : "restart-per-subject",
        examDate,
        examStartsAt: examStartTimestampForSave(examDate),
        electronicDurationMinutes,
        opticForm: selectedOpticName,
        opticFormId: selectedOpticId,
        opticTemplate: selectedOpticTemplate
          ? JSON.parse(JSON.stringify(selectedOpticTemplate))
          : null,
        publisherName,
        examName,
        examCode: examCode || generateExamCode(examType, gradeLevel),
        institutionName,
        targetAudience,
        examStatus,
        resultSettings: {
          createResultPdf,
          sendToParents,
          sendToStudents,
          showSchoolRank,
          showClassRank,
          showTurkeyRank,
          includeSubjectAnalysis,
          pdfTemplate,
          resultFilePattern,
        },
        examStructure,
        questionBlueprint,
        questionAssignments: effectiveQuestionAssignments,

        // Her yeni sınav bağımsız ve boş başlar. Aynı sınıf + ders + sınav türünde
        // daha önce hazırlanmış bir sınav olsa bile soru, kitapçık yerleşimi veya
        // öğretmen seçim aktarımı yeni kayda miras kalmaz.
        questions: {},
        bookletLayoutLock: null,
        teacherSelectionImportedAt: null,
      };

      updatedExams = [...exams, newExam];
    }

    // Öğrenci portalı sınav bilgilerini sunucudaki `exams` koleksiyonundan okur.
    // Tarayıcıda gösterilen başarı durumu, SQLite kaydı doğrulanmadan verilmemeli.
    const savedExam = updatedExams.find((item: any) =>
      String(item?.id || "") === String(editingExamId || updatedExams[updatedExams.length - 1]?.id || "")
    );
    if (!savedExam) {
      alert("Kaydedilecek sınav bulunamadı.");
      return;
    }
    try {
      // Daha eski bir otomatik yazma, yeni tarih/saat kaydını sonradan ezmesin.
      // Bir önceki kayıt kuyruğu sonsuza dek beklerse kullanıcıya açık hata ver.
      const waitFor = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı. Sunucu bağlantısını kontrol edin.`)), ms))]);
      await waitFor(examPersistChainRef.current.catch(() => undefined), 10000, "Önceki sınav kaydı");
      const { upsertLocalDocument, fetchCollectionFromLocalDatabase } = await import("../lib/localDatabase");
      await waitFor(upsertLocalDocument("exams", String(savedExam.id), savedExam), 12000, "Sınav güncelleme");
      const serverExams = await waitFor(fetchCollectionFromLocalDatabase("exams"), 10000, "Sınav doğrulama");
      const confirmed = (Array.isArray(serverExams) ? serverExams : []).find((row: any) =>
        String(row?.id || "") === String(savedExam.id)
      );
      if (!confirmed || String(confirmed.examDate || "") !== String(savedExam.examDate || "") ||
          Number(confirmed.electronicDurationMinutes || 120) !== Number(savedExam.electronicDurationMinutes || 120)) {
        throw new Error("Sunucudaki sınav tarihi, saati ve süresi doğrulanamadı.");
      }
      persistedExamRefs.current.set(String(savedExam.id), savedExam);
    } catch (error: any) {
      console.error("Sınav sunucuya kaydedilemedi:", error);
      alert(`Sınav sunucuya kaydedilemedi. Öğrenci uygulamasına aktarılmadı. ${String(error?.message || "Lütfen yeniden deneyin.")}`);
      return;
    }

    setExams(updatedExams);
    persistQuestionAssignments(updatedExams);

    if (editingExamId) {
      const refreshedManagingExam = updatedExams.find(
        (savedExam: any) => savedExam.id === editingExamId,
      );
      if (refreshedManagingExam) {
        setManagingExam(refreshedManagingExam);
      }
    }

    try {
      localforage.setItem("exams", updatedExams);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        alert("Depolama alanı doldu! Lütfen daha az görsel ekleyin veya eski sınavları silin.");
      } else {
        alert("Sınav kaydedilirken bir hata oluştu.");
      }
    }

    setIsModalOpen(false);
    setEditingExamId(null);

    // Reset form
    setPublisherName("");
    setExamName("");
    setExamDate("");
    setElectronicDurationMinutes(120);
    setExamSource("Sistem");
    setExamType("TYT");
    setBranchExamModel("Serbest");
    setExamCode(generateExamCode("TYT", "YKS"));
    setInstitutionName("Ordu Lisesi");
    setTargetAudience("");
    setExamStatus("Hazırlanıyor");
    setCreateResultPdf(true);
    setSendToParents(false);
    setSendToStudents(false);
    setShowSchoolRank(true);
    setShowClassRank(true);
    setShowTurkeyRank(false);
    setIncludeSubjectAnalysis(true);
    setPdfTemplate("HASAT Analiz Karnesi");
    setResultFilePattern("{YIL}_{SINAV_KODU}_{OGR_ADI}_{OGR_NO}.pdf");
    setGradeLevel("YKS");
    setParticipantGroup("school");
    setSelectedExamCourseId("");
    setSelectedExamCourseIds([]);
    setBlueprintDraft({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
    setBookletType("A");
    setAnsweringMethod("Optik");
    setOpticForm(availableOpticForms.length > 0 ? availableOpticForms[0].name : "");
    } finally {
      examSavePendingRef.current = false;
      setExamSavePending(false);
    }
  };

  const isCourseBasedExamForm = ["Ders Denemesi", "Branşlar Denemesi", "Ünite Denemesi", "Konu Denemesi"].includes(examType);
  const isUnitScanForm = examType === "Ünite Denemesi";
  const everySelectedCourseHasBlueprint = examSource === "Basılı Yayın" && !isUnitScanForm
    ? (!isCourseBasedExamForm || selectedExamCourseIds.length > 0)
    : !isCourseBasedExamForm
      ? true
    : isUnitScanForm
      ? (
          selectedExamCourseIds.length === 1 &&
          questionBlueprint.length > 0 &&
          questionBlueprint.every((row: any) =>
            String(row?.courseId || "") === String(selectedExamCourseIds[0] || "") &&
            Boolean(String(row?.unitId || "").trim()) &&
            !String(row?.topicId || "").trim() &&
            !String(row?.outcomeId || "").trim()
          )
        )
      : (
          selectedExamCourseIds.length > 0 &&
          (examType !== "Ders Denemesi" || selectedExamCourseIds.length === 1) &&
          selectedExamCourseIds.every((courseId) =>
            questionBlueprint.some((row: any) => String(row.courseId) === String(courseId)),
          )
        );

  const hasRequiredPublishedUnitScanQuestionCount =
    !(examSource === "Basılı Yayın" && isUnitScanForm) || unitScanQuestionCount > 0;

  const branchModelReady = examType !== "Branşlar Denemesi" || (
    examStructure.length > 0 && examStructure.every((test: any) => String(test.testName || "").trim() &&
      (branchExamModel === "Serbest" ? (test.subjects || []).length > 0 : true) &&
      (test.subjects || []).every((subject: any) => Number(subject.count) > 0 &&
        (examSource === "Basılı Yayın" || questionBlueprint.filter((row: any) => String(row.courseId) === String(subject.courseId))
          .reduce((sum: number, row: any) => sum + Number(row.count || 0), 0) === Number(subject.count))))
  );
  const isFormValid =
    branchModelReady &&
    examName.trim() !== "" &&
    examDate !== "" &&
    institutionName.trim() !== "" &&
    examCode.trim() !== "" &&
    everySelectedCourseHasBlueprint &&
    hasRequiredPublishedUnitScanQuestionCount;

  const handleUpdateExam = (updatedExam: any) => {
    // `exams` closure'ı arka arkaya yapılan cevap/kazanım tıklamalarında bir
    // render geriden kalabiliyordu. Ref'i aynı anda güncelleyerek hiçbir soru
    // metadatasının sonraki değişiklik tarafından eski snapshot ile ezilmesine
    // izin vermiyoruz.
    const sourceExams = examsRef.current.length > 0 ? examsRef.current : exams;
    const updatedExams = sourceExams.map((ex) =>
      ex.id === updatedExam.id ? updatedExam : ex,
    );
    examsRef.current = updatedExams;
    setExams(updatedExams);
    setManagingExam(updatedExam);
    persistQuestionAssignments(updatedExams);

    // Tarayıcı kopyaları anında güncellenir. F5 senaryosunda bu kopya başlangıçta
    // questionDataRevision üzerinden SQLite ile uzlaştırılır.
    try { localStorage.setItem("exams", JSON.stringify(updatedExams)); } catch {}
    Promise.resolve(localforage.setItem("exams", updatedExams)).catch((e: any) => {
      if (e?.name === "QuotaExceededError") {
        alert("Depolama alanı doldu! Lütfen daha az görsel ekleyin veya eski sınavları silin.");
      } else {
        console.error("Sınav yerel kayda yazılamadı:", e);
      }
    });

  };

  // Sunucu veya veritabanı yanıt vermediğinde yönetim butonları sonsuza dek kilitli kalmasın.
  // Zaman aşımı kayıt başarısı anlamına gelmez; kullanıcıya açık hata gösterilir.
  const withElectronicTimeout = <T,>(operation: Promise<T>, label: string, ms = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} 12 saniye içinde yanıt vermedi. Sunucu bağlantısını kontrol edip yeniden deneyin.`)), ms);
    });
    return Promise.race([operation, timeout]).finally(() => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    });
  };

  // Öğrenci gönderimleri doğrudan sunucuda oluşur. Önce kanonik sınavı yeniden
  // okumadan tarayıcıdaki eski sınav nesnesini kaydetmek bu kayıtları ezebilir.
  const refreshElectronicExam = async () => {
    if (!managingExam?.id) return null;
    setElectronicSyncBusy(true);
    setElectronicNotice("");
    try {
      const { fetchCollectionFromLocalDatabase } = await import("../lib/localDatabase");
      const rows = await withElectronicTimeout(fetchCollectionFromLocalDatabase("exams"), "Katılım yenileme");
      const fresh = (Array.isArray(rows) ? rows : []).find((row: any) => String(row?.id || "") === String(managingExam.id));
      if (!fresh) throw new Error("Sınavın sunucudaki kaydı bulunamadı.");
      const merged = { ...managingExam, ...fresh, studentTxtRecords: Array.isArray(fresh.studentTxtRecords) ? fresh.studentTxtRecords : [] };
      const next = examsRef.current.map((item: any) => String(item.id) === String(merged.id) ? merged : item);
      examsRef.current = next;
      setExams(next);
      setManagingExam(merged);
      persistedExamRefs.current.set(String(merged.id), merged);
      setElectronicNotice("Katılım kayıtları sunucudan yenilendi.");
      return merged;
    } catch (error: any) {
      setElectronicNotice(error?.message || "Kayıtlar yenilenemedi.");
      return null;
    } finally {
      setElectronicSyncBusy(false);
    }
  };

  // Cevap vermeyenler, kaydedilmiş cevaplar ile hedef öğrenci listesinin farkıdır.
  // Yalnız cevap veren sayısına bakılarak eksik katılımcı hesaplanmaz.
  const normalizeStudentNumber = (value: any) => String(value ?? "").trim().replace(/^0+(?=\d)/, "");
  const extractStudentNumber = (row: any) => normalizeStudentNumber(row?.studentNumber ?? row?.studentNo ?? row?.schoolNumber ?? row?.number ?? row?.ogrenciNo ?? row?.no ?? row?.id);
  const extractStudentClass = (row: any) => String(row?.classroom ?? row?.className ?? row?.class ?? row?.branch ?? row?.sinif ?? "").trim().toLocaleUpperCase("tr-TR").replace(/[\s_/-]+/g, "");
  const extractStudentName = (row: any) => String(row?.studentName ?? row?.fullName ?? row?.nameSurname ?? row?.name ?? row?.adSoyad ?? "").trim();
  const electronicSubmittedNumbers = new Set(
    (Array.isArray(managingExam?.studentTxtRecords) ? managingExam.studentTxtRecords : [])
      .filter((row: any) => row?.source === "electronic-optic")
      .map(extractStudentNumber).filter(Boolean),
  );
  const electronicNonResponders = electronicRoster.filter((row: any) => !electronicSubmittedNumbers.has(extractStudentNumber(row)));
  const electronicRosterEligible = Boolean(managingExam && (managingExam.participantGroup === "trial-club" || /^(9|10|11|12)$/.test(String(managingExam.gradeLevel))));
  const loadElectronicRoster = React.useCallback(async () => {
    if (!managingExam?.id || !electronicRosterEligible) {
      setElectronicRoster([]);
      setElectronicRosterError("Hedef öğrenci grubu belirlenemedi. Katılımcı listesi kesinleşmeden cevap vermeyenler hesaplanamaz.");
      return;
    }
    setElectronicRosterLoading(true);
    setElectronicRosterError("");
    try {
      const { fetchCollectionFromLocalDatabase } = await import("../lib/localDatabase");
      const sources = managingExam.participantGroup === "trial-club"
        ? ["trial_club_registrations"]
        : ["school_students", "students"];
      const result = await withElectronicTimeout(Promise.all(sources.map((name) => fetchCollectionFromLocalDatabase(name))), "Öğrenci listesi yükleme");
      const merged = new Map<string, any>();
      result.forEach((rows: any) => (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        if (!row || row.active === false || row.status === "inactive") return;
        const number = extractStudentNumber(row);
        if (!number) return;
        if (managingExam.participantGroup !== "trial-club") {
          const classroom = extractStudentClass(row);
          if (!classroom.startsWith(String(managingExam.gradeLevel))) return;
        }
        // İlk kaynak öncelikli: school_students, ardından legacy students.
        if (!merged.has(number)) merged.set(number, row);
      }));
      if (merged.size === 0) throw new Error("Bu sınav için kayıtlı öğrenci listesi bulunamadı; cevap vermeyen sayısı hesaplanamıyor.");
      setElectronicRoster(Array.from(merged.values()).sort((a, b) =>
        extractStudentClass(a).localeCompare(extractStudentClass(b), "tr", { numeric: true }) ||
        Number(extractStudentNumber(a)) - Number(extractStudentNumber(b))));
    } catch (error: any) {
      setElectronicRoster([]);
      setElectronicRosterError(error?.message || "Öğrenci listesi alınamadı.");
    } finally { setElectronicRosterLoading(false); }
  }, [managingExam?.id, managingExam?.gradeLevel, managingExam?.participantGroup, electronicRosterEligible]);

  React.useEffect(() => {
    if (activeTab === "optic-settings" && isManagedElectronicExam) void loadElectronicRoster();
  }, [activeTab, isManagedElectronicExam, loadElectronicRoster]);

  const printElectronicNonResponders = () => {
    if (electronicRosterLoading || electronicRosterError || !electronicRoster.length) return;
    const escapeHtml = (value: any) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
    const rows = electronicNonResponders.map((student, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(extractStudentClass(student))}</td><td>${escapeHtml(extractStudentNumber(student))}</td><td>${escapeHtml(extractStudentName(student))}</td></tr>`).join("");
    const popup = window.open("", "_blank", "width=900,height=850");
    if (!popup) { setElectronicRosterError("PDF yazdırma penceresi engellendi. Açılır pencerelere izin verin."); return; }
    popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>Cevap Vermeyen Öğrenciler</title><style>@page{size:A4 portrait;margin:15mm}body{font:12px Arial,sans-serif;color:#111}h1{text-align:center;font-size:18px}p{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:6px;text-align:left}th{background:#eee}thead{display:table-header-group}</style></head><body><h1>ELEKTRONİK DENEME - CEVAP VERMEYEN ÖĞRENCİLER</h1><p>${escapeHtml(managingExam.examName)} · ${escapeHtml(managingExam.gradeLevel)} · ${electronicNonResponders.length} öğrenci</p><table><thead><tr><th>Sıra</th><th>Sınıf</th><th>Öğrenci No</th><th>Ad Soyad</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  };

  // Geç katılım için ana sınav tarihini değiştirmeden yalnız seçilen öğrenciye erişim ver.
  const openElectronicLateSession = async () => {
    if (!managingExam?.id || electronicSyncBusy) return;
    const studentNumber = window.prompt("Sonradan sınava girecek öğrencinin okul numarası:", "")?.trim();
    if (!studentNumber) return;
    if (!/^\d{1,12}$/.test(studentNumber)) {
      window.alert("Geçerli bir öğrenci okul numarası giriniz."); return;
    }
    const minutesText = window.prompt("Ek sınav süresi (dakika):", String(managingExam.electronicDurationMinutes || managingExam.durationMinutes || 120));
    if (minutesText === null) return;
    const minutes = Number(minutesText);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
      window.alert("Süre 1–600 dakika arasında tam sayı olmalıdır."); return;
    }
    if (!window.confirm(`${studentNumber} numaralı öğrenciye şimdi başlayacak ${minutes} dakikalık geç katılım hakkı verilsin mi? Daha önce yayımlanmış sonuçlar yeniden değerlendirme tamamlanana kadar gizlenecektir.`)) return;
    setElectronicSyncBusy(true);
    try {
      const { fetchCollectionFromLocalDatabase, upsertLocalDocument } = await import("../lib/localDatabase");
      const rows = await withElectronicTimeout(fetchCollectionFromLocalDatabase("exams"), "Sınav kaydını okuma");
      const fresh = (Array.isArray(rows) ? rows : []).find((row: any) => String(row?.id) === String(managingExam.id));
      if (!fresh) throw new Error("Sınavın sunucudaki kaydı bulunamadı.");
      const hasAnswer = (Array.isArray(fresh.studentTxtRecords) ? fresh.studentTxtRecords : []).some((record: any) =>
        record?.source === "electronic-optic" && String(record?.studentNumber || "").replace(/^0+(?=\d)/, "") === studentNumber.replace(/^0+(?=\d)/, "") && Boolean(record?.finalizedAt));
      if (hasAnswer) throw new Error("Bu öğrencinin optiği daha önce kesinleştirilmiş. Mevcut cevaplar değiştirilmedi.");
      const startsAt = Date.now();
      const updated = {
        ...fresh,
        electronicLateWindows: {
          ...(fresh.electronicLateWindows && typeof fresh.electronicLateWindows === "object" ? fresh.electronicLateWindows : {}),
          [studentNumber.replace(/^0+(?=\d)/, "")]: { startsAt, endsAt: startsAt + minutes * 60_000 },
        },
        electronicWasPublishedBeforeLate: fresh.electronicResultsPublished === true || fresh.electronicWasPublishedBeforeLate === true,
        electronicResultsPublished: false,
        electronicPublishedAt: null,
        electronicAutoEvaluationStatus: "late-session-open",
      };
      await withElectronicTimeout(upsertLocalDocument("exams", String(fresh.id), updated), "Geç katılım yetkisi");
      const storedRows = await withElectronicTimeout(fetchCollectionFromLocalDatabase("exams"), "Geç katılım doğrulama");
      const verified = (Array.isArray(storedRows) ? storedRows : []).find((row: any) => String(row?.id) === String(fresh.id));
      if (Number(verified?.electronicLateWindows?.[studentNumber.replace(/^0+(?=\d)/, "")]?.startsAt) !== startsAt)
        throw new Error("Geç katılım kaydı sunucuda doğrulanamadı.");
      persistedExamRefs.current.set(String(verified.id), verified);
      const next = examsRef.current.map((item: any) => String(item.id) === String(verified.id) ? verified : item);
      examsRef.current = next;
      setExams(next);
      setManagingExam(verified);
      const message = `${studentNumber} numaralı öğrenci için ${minutes} dakika geç katılım açıldı. Ana sınav tarihi değiştirilmedi. Öğrenci uygulamasını yenileyebilir.`;
      setElectronicNotice(message);
      window.alert(message);
    } catch (error: any) {
      const message = `Geç katılım açılamadı: ${error?.message || "Sunucu hatası"}`;
      setElectronicNotice(message);
      window.alert(message);
    } finally { setElectronicSyncBusy(false); }
  };

  // Geç gelen cevaplar sunucunun otomatik değerlendirmesine girdikten sonra
  // yalnız eksiksiz sonuçlar yönetici onayıyla tekrar yayımlanabilir.
  const publishLateElectronicResults = async () => {
    if (!managingExam?.id || electronicSyncBusy) return;
    setElectronicSyncBusy(true);
    setElectronicNotice("Geç katılan öğrencilerin değerlendirmeleri kontrol ediliyor...");
    try {
      const { fetchCollectionFromLocalDatabase, upsertLocalDocument } = await import("../lib/localDatabase");
      const readExam = async () => {
        const rows = await withElectronicTimeout(fetchCollectionFromLocalDatabase("exams"), "Geç katılım sonuçlarını okuma");
        return (Array.isArray(rows) ? rows : []).find((item: any) => String(item?.id) === String(managingExam.id));
      };
      const fresh = await readExam();
      if (!fresh) throw new Error("Sınav sunucuda bulunamadı.");
      const records = (Array.isArray(fresh.studentTxtRecords) ? fresh.studentTxtRecords : []).filter((record: any) => record.source === "electronic-optic" && record.finalizedAt);
      const results = Array.isArray(fresh.evaluationResults) ? fresh.evaluationResults : [];
      const numberOf = (value: any) => String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      const missing = records.filter((record: any) => !results.some((result: any) =>
        (numberOf(record.studentNumber) && numberOf(record.studentNumber) === numberOf(result.studentNumber)) ||
        (String(record.id || "") && String(record.id) === String(result.recordId || ""))));
      if (!fresh.isEvaluated || !results.length || missing.length) {
        throw new Error(`${missing.length} öğrencinin değerlendirmesi henüz hazır değil. Sunucu otomatik değerlendirmesini tamamladıktan sonra tekrar deneyin. Cevap anahtarlarını da kontrol edin.`);
      }
      if (!window.confirm(`${results.length} öğrenci sonucu (geç katılımcılar dahil) öğrencilere yayımlansın mı?`)) return;
      const updated = { ...fresh, electronicResultsPublished: true, electronicWasPublishedBeforeLate: false, electronicPublishedAt: new Date().toISOString() };
      await withElectronicTimeout(upsertLocalDocument("exams", String(fresh.id), updated), "Geç katılım sonuçlarını yayımlama");
      const verified = await readExam();
      if (!verified?.electronicResultsPublished || !verified?.isEvaluated) throw new Error("Yayın sunucuda doğrulanamadı.");
      const next = examsRef.current.map((item: any) => String(item.id) === String(verified.id) ? verified : item);
      examsRef.current = next; setExams(next); setManagingExam(verified);
      const message = `İşlem tamamlandı. ${results.length} öğrencinin sonuçları (geç katılanlar dahil) yayımlandı.`;
      setElectronicNotice(message); window.alert(message);
    } catch (error: any) {
      const message = error?.message || "Geç katılım değerlendirmesi tamamlanamadı.";
      setElectronicNotice(message); window.alert(message);
    } finally { setElectronicSyncBusy(false); }
  };

  const updateElectronicPublication = async (publish: boolean) => {
    if (!managingExam?.id || electronicSyncBusy) return;
    const fresh = await refreshElectronicExam();
    if (!fresh) return;
    const records = Array.isArray(fresh.studentTxtRecords) ? fresh.studentTxtRecords.filter((record: any) => record.source === "electronic-optic") : [];
    if (publish && !records.length) {
      setElectronicNotice("Henüz kesin gönderim yapan öğrenci yok. Sonuç yayımlanamaz.");
      return;
    }
    if (publish && !fresh.isEvaluated) {
      setElectronicNotice("Önce Değerlendir bölümünde sınavı değerlendirin.");
      return;
    }
    if (!window.confirm(publish ? "Elektronik deneme sonuçları öğrenci ve velilere yayımlansın mı?" : "Yayımlanan elektronik deneme sonuçları yeniden gizlensin mi?")) return;
    setElectronicSyncBusy(true);
    setElectronicNotice(publish ? "Sonuçların yayımlanması doğrulanıyor..." : "Yayından kaldırma doğrulanıyor...");
    try {
      const { upsertLocalDocument, fetchCollectionFromLocalDatabase } = await import("../lib/localDatabase");
      const updated = {
        ...fresh,
        electronicResultsPublished: publish,
        electronicPublishedAt: publish ? new Date().toISOString() : null,
      };
      await withElectronicTimeout(upsertLocalDocument("exams", String(updated.id), updated), "Sonuç yayımlama kaydı");
      // Başarı, yalnızca yazma isteğinin dönüşüne değil sunucudan okunan son duruma dayanır.
      const storedRows = await withElectronicTimeout(fetchCollectionFromLocalDatabase("exams"), "Sonuç yayın durumunu doğrulama");
      const verified = (Array.isArray(storedRows) ? storedRows : []).find((row: any) => String(row?.id || "") === String(updated.id));
      if (!verified || verified.electronicResultsPublished !== publish) {
        throw new Error("Sunucudaki sonuç yayın durumu doğrulanamadı. Lütfen tekrar kontrol edin.");
      }
      persistedExamRefs.current.set(String(verified.id), verified);
      const next = examsRef.current.map((item: any) => String(item.id) === String(verified.id) ? verified : item);
      examsRef.current = next;
      setExams(next);
      setManagingExam(verified);
      const message = publish
        ? "İşlem tamamlanmıştır. Sınav sonuçları başarıyla yayımlandı."
        : "İşlem tamamlanmıştır. Sınav sonuçları yayından kaldırıldı.";
      setElectronicNotice(message);
      window.alert(message);
    } catch (error: any) {
      const message = `Sonuç yayınlama işlemi doğrulanamadı: ${error?.message || "Sunucu hatası"}`;
      setElectronicNotice(message);
      window.alert(message);
    } finally {
      setElectronicSyncBusy(false);
    }
  };

  const handleDeleteExam = async (exam: any) => {
    const examId = String(exam?.id || "").trim();
    if (!examId) {
      window.alert("Silinecek sınavın kimliği bulunamadı.");
      return;
    }

    const examLabel = String(exam?.examName || exam?.examCode || "Bu sınav").trim();
    const locallyFinalized = Boolean(
      exam?.finalizedAt ||
      exam?.isFinalized === true ||
      exam?.bookletLayoutLock?.questionsLocked === true
    );
    if (locallyFinalized) {
      window.alert(`"${examLabel}" kesinleştirilmiştir. Kesinleştirilmiş sınav silinemez.`);
      return;
    }

    try {
      const statusResponse = await fetch(`/api/exams/${encodeURIComponent(examId)}/delete-status`, { cache: "no-store" });
      const statusBody = await statusResponse.json().catch(() => ({}));
      if (statusResponse.ok && statusBody?.finalized) {
        window.alert(`"${examLabel}" kesinleştirilmiştir. Kesinleştirilmiş sınav silinemez.`);
        return;
      }
      if (!statusResponse.ok && statusResponse.status !== 404) {
        throw new Error(String(statusBody?.error || "Sınav silme durumu doğrulanamadı."));
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Sınav silme durumu doğrulanamadı.");
      return;
    }

    const approved = window.confirm(
      `"${examLabel}" sınavı silinsin mi?\n\nBu sınava atanmış/seçilmiş sorular serbest bırakılacak ve öğretmen soru seçme görevleri kaldırılacaktır.`,
    );
    if (!approved) return;

    try {
      const assignmentIds = new Set<string>();
      const releasedQuestionKeys = new Set<string>();
      const usageExamIds = new Set<string>([examId]);
      if (exam?.examCode) usageExamIds.add(String(exam.examCode));

      const collectQuestionKeys = (value: any) => {
        if (!value) return;
        const candidates = [
          value.selectedQuestionKeys,
          value.questionKeys,
          value.selectedQuestions,
          value.questions,
          value.selectedQuestionSnapshots,
        ];
        candidates.forEach((list: any) => {
          if (!Array.isArray(list)) return;
          list.forEach((item: any) => {
            const raw = typeof item === "string" || typeof item === "number"
              ? item
              : item?.questionId ?? item?.question_id ?? item?.key ?? item?.id ?? item?.code ?? item?.questionCode;
            const key = String(raw ?? "").trim();
            if (key) releasedQuestionKeys.add(key);
          });
        });
      };

      // Sınav kartında doğrudan saklanmış soru/görev bilgilerini de serbest bırak.
      collectQuestionKeys(exam);
      Object.values(exam?.questionAssignments || {}).forEach((assignment: any) => {
        const id = String(assignment?.id || "").trim();
        if (id) assignmentIds.add(id);
        const linkedExamId = String(assignment?.testId || assignment?.examId || "").trim();
        if (linkedExamId) usageExamIds.add(linkedExamId);
        collectQuestionKeys(assignment);
      });

      // Ortak görev koleksiyonunu TEK KEZ oku. Hem eski hem yeni görev biçimlerini
      // sınav id/kod/ad ve karttaki assignment id üzerinden yakala.
      let allAssignments: any[] = [];
      try {
        const response = await fetch("/api/database/collections/teacherTestAssignments", { cache: "no-store" });
        const rows = await response.json().catch(() => []);
        if (response.ok && Array.isArray(rows)) allAssignments = rows;
      } catch (error) {
        console.warn("Öğretmen görevleri listelenemedi; karttaki görevler temizlenecek.", error);
      }

      allAssignments.forEach((assignment: any) => {
        const assignmentId = String(assignment?.id || "").trim();
        const assignmentExamId = String(assignment?.testId || assignment?.examId || "").trim();
        const sameExam =
          (assignmentId && assignmentIds.has(assignmentId)) ||
          assignmentExamId === examId ||
          (!!exam?.examCode && (assignmentExamId === String(exam.examCode) || String(assignment?.examCode || "") === String(exam.examCode))) ||
          (!!exam?.examName && String(assignment?.testName || assignment?.examName || "").trim() === String(exam.examName).trim());
        if (!sameExam) return;
        if (assignmentId) assignmentIds.add(assignmentId);
        if (assignmentExamId) usageExamIds.add(assignmentExamId);
        collectQuestionKeys(assignment);
      });

      // Önceden kuyruğa alınan sınav UPSERT işlemleri silinen kaydı geri getirmesin.
      deletingExamIdsRef.current.add(examId);
      await examPersistChainRef.current.catch(() => undefined);

      // Silme isteğini gönder; eski sunucu sürümündeki özel uç nokta hata
      // döndürürse genel belge silme uç noktasını da deneyerek doğrula.
      const deleteResponse = await fetch(`/api/exams/${encodeURIComponent(examId)}`, {
        method: "DELETE", cache: "no-store",
      });
      const deleteResult = await deleteResponse.json().catch(() => ({}));
      let deleteFailure = !deleteResponse.ok
        ? String(deleteResult?.error || `Sınav silinemedi (HTTP ${deleteResponse.status}).`)
        : "";

      // Ana kayıt varlığını doğrudan SQLite koleksiyonundan doğrula. Özel
      // uç noktanın arşiv temizliği sonrası hata dönmesi silmeyi başarısız
      // göstermemeli; ancak kayıt hâlâ varsa silinmiş sayılmamalıdır.
      const readExamsFromServer = async (): Promise<any[]> => {
        const response = await fetch("/api/database/collections/exams", { cache: "no-store" });
        if (!response.ok) throw new Error(`Sınav kayıtları doğrulanamadı (HTTP ${response.status}).`);
        const records = await response.json();
        if (!Array.isArray(records)) throw new Error("Sunucudan geçerli sınav listesi alınamadı.");
        return records;
      };
      let verifiedRows = await readExamsFromServer();
      if (verifiedRows.some((item: any) => String(item?.id || "").trim() === examId)) {
        // Kesinleştirme kuralı genel uç noktada da korunur. Bu yol yalnızca
        // özel uç nokta hatalı/eksik çalıştığında kalan kaydı kaldırır.
        const fallback = await fetch(`/api/database/collections/exams/${encodeURIComponent(examId)}`, {
          method: "DELETE", cache: "no-store",
        });
        const fallbackResult = await fallback.json().catch(() => ({}));
        if (!fallback.ok) {
          throw new Error(`Sınav silinemedi: ${String(fallbackResult?.error || deleteFailure || `HTTP ${fallback.status}`)}`);
        }
        verifiedRows = await readExamsFromServer();
      }
      if (verifiedRows.some((item: any) => String(item?.id || "").trim() === examId)) {
        throw new Error(`"${examLabel}" sunucu veritabanında hâlâ kayıtlı. Silme doğrulanamadı.${deleteFailure ? ` Sunucu yanıtı: ${deleteFailure}` : ""}`);
      }

      // Ana kayıt başarıyla silindikten sonra öğretmen görevlerini kaldır.
      // Yalnız görevi kaldırma hatası sınav kaydını geri getirmez.
      const failedAssignments: string[] = [];
      await Promise.all(Array.from(assignmentIds).map(async (assignmentId) => {
        try {
          const response = await fetch(
            `/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`,
            { method: "DELETE", cache: "no-store" },
          );
          if (!response.ok && response.status !== 404) failedAssignments.push(assignmentId);
        } catch {
          failedAssignments.push(assignmentId);
        }
      }));
      if (failedAssignments.length) console.warn("Kaldırılamayan öğretmen görevleri:", failedAssignments);

      const releaseJobs: Promise<any>[] = [];
      releasedQuestionKeys.forEach((questionId) => {
        usageExamIds.forEach((linkedExamId) => {
          releaseJobs.push(fetch("/api/question-bank/usage", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, examId: linkedExamId }),
          }));
        });
      });
      await Promise.allSettled(releaseJobs);
      persistedExamRefs.current.delete(examId);
      deletedExamIdsRef.current.add(examId);
      try { localStorage.setItem(deletedExamStorageKey, JSON.stringify([...deletedExamIdsRef.current])); } catch {}

      const nextExams = examsRef.current.filter((item: any) => String(item?.id || "") !== examId);
      examsRef.current = nextExams;
      setExams(nextExams);
      persistQuestionAssignments(nextExams);
      await localforage.setItem("exams", nextExams);
      try { localStorage.setItem("exams", JSON.stringify(nextExams)); } catch {}

      // Eski tarayıcı önbelleğinde kalan görevleri de temizle.
      for (const storage of [localStorage, sqliteStorage] as any[]) {
        try {
          const raw = storage.getItem("question_selection_assignments_v1");
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((assignment: any) => {
              const aid = String(assignment?.id || "").trim();
              const linked = String(assignment?.testId || assignment?.examId || "").trim();
              return !assignmentIds.has(aid) && linked !== examId && linked !== String(exam?.examCode || "");
            });
            storage.setItem("question_selection_assignments_v1", JSON.stringify(cleaned));
          }
        } catch {}
      }

      if (String(managingExam?.id || "") === examId) {
        setManagingExam(null);
        setActiveTab("exams");
      }
      if (editingExamId === examId) {
        setEditingExamId(null);
        setIsModalOpen(false);
      }

      window.alert(
        `Sınav silindi. ${assignmentIds.size} öğretmen görevi kaldırıldı; ${releasedQuestionKeys.size} seçilmiş/atanmış soru serbest bırakıldı ve başka sınavlarda yeniden kullanılabilir.`,
      );
    } catch (error) {
      deletingExamIdsRef.current.delete(examId);
      console.error("Sınav, görev ve soru rezervasyonları silinemedi:", error);
      window.alert(error instanceof Error ? error.message : "Sınav silinirken bağlı soru kayıtları temizlenemedi.");
    }
  };

  const normalizeOpticLookupName = (value: unknown) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");

  const identityKeyFromOpticLabel = (value: unknown) => {
    const key = String(value || "")
      .toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ş/g, "S")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C")
      .replace(/[^A-Z0-9]/g, "");

    if (key.includes("OKUL") && key.includes("KOD")) return "schoolCode";
    if (key.includes("OGRENCI") && (key.includes("NO") || key.includes("NUMARA"))) return "studentNo";
    if ((key.includes("AD") && key.includes("SOYAD")) || key.includes("OGRENCIADISOYADI")) return "fullName";
    if (key.includes("KITAP")) return "bookletType";
    if (key.includes("SUBE")) return "branch";
    if (key === "ALAN" || key === "ALANI") return "area";
    if (key.includes("SINIF")) return "classLevel";
    return "";
  };

  const managedOpticTemplateToDraft = (template: any) => {
    const identityFields = Array.isArray(template?.identityFields)
      ? template.identityFields
      : [];
    const answerFields = Array.isArray(template?.answerFields)
      ? template.answerFields
      : [];

    return {
      ...template,
      __managedOpticTemplate: true,
      __previousName: String(template?.name || "").trim(),
      examKind: normalizeExamTypeValue(managingExam?.examType || "TYT"),
      fields: [
        ...identityFields.map((field: any, index: number) => ({
          id: String(field?.id || `identity-${field?.key || index}`),
          fieldName: String(field?.label || field?.key || "").trim(),
          columnStart: Number(field?.startColumn || 0) || "",
          columnCount: Number(field?.columnCount || 0) || "",
          direction: "Dikey",
          optionSet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          __opticKind: "identity",
          __identityKey: String(field?.key || ""),
        })),
        ...answerFields.map((field: any, index: number) => ({
          id: String(field?.id || `answer-${index}`),
          fieldName: String(field?.courseName || "").trim(),
          columnStart: Number(field?.startColumn || 0) || "",
          columnCount: Number(field?.columnCount || 0) || "",
          direction: "Dikey",
          optionSet: "ABCDE",
          __opticKind: "answer",
        })),
      ],
    };
  };

  const openOpticDetails = async () => {
    if (!managingExam) return;

    const linkedIds = [
      managingExam?.opticFormId,
      managingExam?.opticTemplateId,
      managingExam?.opticExamConfig?.templateId,
      managingExam?.opticTemplate?.id,
      typeof managingExam?.opticForm === "object" ? managingExam.opticForm?.id : "",
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const linkedNames = [
      typeof managingExam?.opticForm === "object"
        ? managingExam.opticForm?.name || managingExam.opticForm?.label
        : managingExam?.opticForm,
      managingExam?.opticExamConfig?.templateName,
      managingExam?.opticTemplate?.name,
      managingExam?.opticName,
    ]
      .map(normalizeOpticLookupName)
      .filter(Boolean);

    // Optik Form Yönetimi artık SQLite/API tabanlıdır. Önce güncel kanonik
    // kayıtları kullan; eski tarayıcı kayıtları yalnızca geriye uyumluluk için yedektir.
    let managedForms: any[] = Array.isArray(availableOpticForms)
      ? availableOpticForms.filter(Boolean)
      : [];

    try {
      const { listOpticTemplates } = await import("../lib/opticTemplateApi");
      const apiForms = await listOpticTemplates();
      if (Array.isArray(apiForms)) {
        managedForms = apiForms.filter(Boolean);
        setAvailableOpticForms(managedForms);
      }
    } catch (error) {
      console.warn("Optik Form Yönetimi kayıtları API üzerinden okunamadı:", error);
    }

    const linkedManaged =
      managedForms.find((form: any) => linkedIds.includes(String(form?.id || "").trim())) ||
      managedForms.find((form: any) => linkedNames.includes(normalizeOpticLookupName(form?.name)));

    if (linkedManaged) {
      setOpticDraft(managedOpticTemplateToDraft(linkedManaged));
      setIsOpticDetailsOpen(true);
      return;
    }

    // Sınavın içine daha önce gömülmüş kanonik şablon varsa bağlantı kaydı
    // eksik olsa bile bilgileri kaybetmeden aç.
    const embeddedTemplate = managingExam?.opticTemplate;
    if (
      embeddedTemplate &&
      (Array.isArray(embeddedTemplate?.identityFields) || Array.isArray(embeddedTemplate?.answerFields))
    ) {
      setOpticDraft(managedOpticTemplateToDraft(embeddedTemplate));
      setIsOpticDetailsOpen(true);
      return;
    }

    let forms: any[] = [];
    try {
      const lfForms = await localforage.getItem<any[]>("opticForms");
      if (Array.isArray(lfForms)) forms = lfForms.filter(Boolean);
    } catch (error) {
      console.warn("Eski optik formlar localforage üzerinden okunamadı:", error);
    }

    if (forms.length === 0) {
      try {
        const saved = localStorage.getItem("opticForms");
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) forms = parsed.filter(Boolean);
      } catch (error) {
        console.warn("Eski optik formlar localStorage üzerinden okunamadı:", error);
      }
    }

    const linkedLegacy =
      forms.find((form) => linkedIds.includes(String(form?.id || "").trim())) ||
      forms.find((form) => linkedNames.includes(normalizeOpticLookupName(form?.name || form?.label)));

    if (!linkedLegacy) {
      const linkedLabel =
        (typeof managingExam?.opticForm === "object"
          ? managingExam.opticForm?.name || managingExam.opticForm?.label
          : managingExam?.opticForm) ||
        managingExam?.opticExamConfig?.templateName ||
        managingExam?.opticFormId ||
        "Optik seçilmemiş";
      alert(`Bu sınava bağlı optik şablon bulunamadı: ${linkedLabel}`);
      return;
    }

    setOpticDraft({
      ...linkedLegacy,
      __managedOpticTemplate: false,
      __previousName: String(linkedLegacy?.name || "").trim(),
      examKind: normalizeExamTypeValue(linkedLegacy.examKind || managingExam?.examType || "TYT"),
      fields: Array.isArray(linkedLegacy.fields)
        ? linkedLegacy.fields.map((field: any) => ({
            ...field,
            examKind: normalizeExamTypeValue(field?.examKind || linkedLegacy.examKind || managingExam?.examType || "TYT"),
          }))
        : [],
    });
    setIsOpticDetailsOpen(true);
  };

  const updateOpticDraftField = (index: number, key: string, value: string) => {
    setOpticDraft((prev: any) => {
      if (!prev) return prev;
      const nextFields = [...(prev.fields || [])];
      nextFields[index] = { ...nextFields[index], [key]: value };
      return { ...prev, fields: nextFields };
    });
  };

  const addOpticDraftField = () => {
    setOpticDraft((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: [
          ...(prev.fields || []),
          {
            id: `field-${Date.now()}`,
            examKind: normalizeExamTypeValue(prev.examKind || managingExam?.examType || "TYT"),
            fieldName: "Yeni Alan",
            columnStart: "",
            columnCount: "",
            direction: "Dikey",
            optionSet: "0123456789",
          },
        ],
      };
    });
  };

  const removeOpticDraftField = (index: number) => {
    setOpticDraft((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: (prev.fields || []).filter((_: any, fieldIndex: number) => fieldIndex !== index),
      };
    });
  };

  const saveOpticDetails = async () => {
    if (!opticDraft) return;

    const cleanName = String(opticDraft.name || "").trim();
    if (!cleanName) {
      alert("Optik şablon adı boş bırakılamaz.");
      return;
    }

    if (opticDraft.__managedOpticTemplate) {
      try {
        const draftFields = Array.isArray(opticDraft.fields) ? opticDraft.fields : [];
        const originalIdentityFields = Array.isArray(opticDraft.identityFields)
          ? opticDraft.identityFields
          : [];

        const identityByKey = new Map(
          originalIdentityFields.map((field: any) => [String(field?.key || ""), { ...field }]),
        );

        draftFields.forEach((field: any) => {
          const identityKey = String(
            field?.__identityKey ||
            (field?.__opticKind === "identity" ? identityKeyFromOpticLabel(field?.fieldName) : ""),
          ).trim();
          if (!identityKey) return;

          const current = identityByKey.get(identityKey) || {
            key: identityKey,
            label: String(field?.fieldName || identityKey),
          };
          identityByKey.set(identityKey, {
            ...current,
            key: identityKey,
            label: String(field?.fieldName || current?.label || identityKey).trim(),
            startColumn: Math.max(0, Number(field?.columnStart || 0) || 0),
            columnCount: Math.max(0, Number(field?.columnCount || 0) || 0),
          });
        });

        // Modalden kaldırılan kimlik alanı varsa eski koordinatın sessizce geri
        // gelmemesi için o alanı tanımsız (0/0) bırak.
        for (const [key, field] of identityByKey.entries()) {
          const stillPresent = draftFields.some((draftField: any) =>
            String(draftField?.__identityKey || "") === key,
          );
          if (!stillPresent) {
            identityByKey.set(key, { ...field, startColumn: 0, columnCount: 0 });
          }
        }

        const answerFields = draftFields
          .filter((field: any) => {
            if (field?.__opticKind === "identity" || field?.__identityKey) return false;
            return !identityKeyFromOpticLabel(field?.fieldName);
          })
          .map((field: any, index: number) => ({
            id: String(field?.id || `answer-${Date.now()}-${index}`),
            courseName: String(field?.fieldName || "").trim(),
            startColumn: Math.max(0, Number(field?.columnStart || 0) || 0),
            columnCount: Math.max(0, Number(field?.columnCount || 0) || 0),
          }))
          .filter((field: any) => field.courseName && field.startColumn > 0 && field.columnCount > 0);

        const currentTemplateKind = String(opticDraft?.templateKind || "");
        const templateKind = currentTemplateKind === "TYT" || currentTemplateKind === "AYT"
          ? currentTemplateKind
          : "Özel";

        const { updateOpticTemplate, listOpticTemplates } = await import("../lib/opticTemplateApi");
        const savedTemplate = await updateOpticTemplate(String(opticDraft.id), {
          name: cleanName,
          templateKind: templateKind as any,
          identityFields: Array.from(identityByKey.values()) as any,
          answerFields,
          answerAreaStarts: buildOpticAreaLayout({
            answerFields,
            answerAreaStarts: opticDraft?.answerAreaStarts,
          }).starts,
        });
        const refreshedForms = await listOpticTemplates();
        setAvailableOpticForms(refreshedForms);

        const previousName = String(opticDraft.__previousName || managingExam?.opticForm || cleanName).trim();
        const updatedExams = exams.map((exam) => {
          const sameId = String(exam?.opticFormId || exam?.opticTemplateId || "").trim() === String(savedTemplate.id);
          const sameName = normalizeOpticLookupName(
            typeof exam?.opticForm === "object" ? exam.opticForm?.name : exam?.opticForm,
          ) === normalizeOpticLookupName(previousName);
          const isCurrentExam = exam.id === managingExam?.id;
          return isCurrentExam || sameId || sameName
            ? {
                ...exam,
                opticForm: savedTemplate.name,
                opticFormId: savedTemplate.id,
                opticTemplate: JSON.parse(JSON.stringify(savedTemplate)),
              }
            : exam;
        });

        setExams(updatedExams);
        await localforage.setItem("exams", updatedExams);
        try { localStorage.setItem("exams", JSON.stringify(updatedExams)); } catch {}

        const updatedManagingExam = managingExam
          ? {
              ...managingExam,
              opticForm: savedTemplate.name,
              opticFormId: savedTemplate.id,
              opticTemplate: JSON.parse(JSON.stringify(savedTemplate)),
            }
          : managingExam;
        setManagingExam(updatedManagingExam);
        setOpticDraft(managedOpticTemplateToDraft(savedTemplate));
        setIsOpticDetailsOpen(false);
        window.dispatchEvent(new CustomEvent("edupanel:optic-templates-changed"));
        alert("Optik bilgileri güncellendi.");
        return;
      } catch (error) {
        console.error("Optik şablon SQLite/API üzerinde güncellenemedi:", error);
        alert(error instanceof Error ? error.message : "Optik bilgileri güncellenemedi.");
        return;
      }
    }

    // Eski sınav/şablon kayıtları için mevcut yerel akış korunur.
    let forms: any[] = [];
    try {
      const lfForms = await localforage.getItem<any[]>("opticForms");
      if (Array.isArray(lfForms)) forms = lfForms.filter(Boolean);
    } catch (error) {
      console.warn(error);
    }
    if (forms.length === 0) {
      try {
        const saved = localStorage.getItem("opticForms");
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) forms = parsed.filter(Boolean);
      } catch (error) {
        console.warn(error);
      }
    }

    const original = forms.find((form) => form?.id === opticDraft.id);
    const previousName = original?.name || managingExam?.opticForm || cleanName;
    const updatedTemplate = {
      ...opticDraft,
      name: cleanName,
      updatedAt: new Date().toISOString(),
    };
    const updatedForms = forms.some((form) => form?.id === updatedTemplate.id)
      ? forms.map((form) => form?.id === updatedTemplate.id ? updatedTemplate : form)
      : [updatedTemplate, ...forms];

    await localforage.setItem("opticForms", updatedForms);
    localStorage.setItem("opticForms", JSON.stringify(updatedForms));

    const updatedExams = exams.map((exam) => {
      const isCurrentExam = exam.id === managingExam?.id;
      const usesSameTemplate = String(exam.opticForm || "").trim() === String(previousName).trim();
      return isCurrentExam || usesSameTemplate ? { ...exam, opticForm: cleanName } : exam;
    });
    setExams(updatedExams);
    await localforage.setItem("exams", updatedExams);

    const updatedManagingExam = managingExam ? { ...managingExam, opticForm: cleanName } : managingExam;
    setManagingExam(updatedManagingExam);
    setOpticDraft(updatedTemplate);
    setIsOpticDetailsOpen(false);
    alert("Optik bilgileri güncellendi.");
  };

  const linkedOpticTemplate = (() => {
    if (!managingExam) return null;

    const currentIds = [
      managingExam?.opticFormId,
      managingExam?.opticTemplateId,
      managingExam?.opticTemplate?.id,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const currentNames = [
      typeof managingExam?.opticForm === "object"
        ? managingExam.opticForm?.name
        : managingExam?.opticForm,
      managingExam?.opticTemplate?.name,
    ]
      .map((value) => String(value || "").trim().toLocaleLowerCase("tr-TR"))
      .filter(Boolean);

    return (
      availableOpticForms.find((form: any) =>
        currentIds.includes(String(form?.id || "").trim()),
      ) ||
      availableOpticForms.find((form: any) =>
        currentNames.includes(
          String(form?.name || "").trim().toLocaleLowerCase("tr-TR"),
        ),
      ) ||
      (managingExam?.opticTemplate &&
      (Array.isArray(managingExam.opticTemplate?.identityFields) ||
        Array.isArray(managingExam.opticTemplate?.answerFields))
        ? managingExam.opticTemplate
        : null)
    );
  })();

  const baseLinkedOpticAreaLayout = linkedOpticTemplate
    ? buildOpticAreaLayout(linkedOpticTemplate)
    : { groups: [[], [], [], []], starts: [0, 0, 0, 0] };

  const opticExamCourseOptions = managingExam
    ? getSavedExamCourseOptions(managingExam)
    : [];

  const currentOpticExamConfig = (() => {
    if (!managingExam || !linkedOpticTemplate) return null;
    const saved = managingExam?.opticExamConfig;
    const sameTemplate =
      String(saved?.templateId || "").trim() === String(linkedOpticTemplate?.id || "").trim();
    return sameTemplate ? saved : null;
  })();

  const linkedOpticAreaLayout = (() => {
    if (!linkedOpticTemplate) return { groups: [[], [], [], []], starts: [0, 0, 0, 0] };
    const savedFields = Array.isArray(currentOpticExamConfig?.answerFields)
      ? currentOpticExamConfig.answerFields
      : [];
    if (!savedFields.length) {
      return { groups: [[], [], [], []], starts: baseLinkedOpticAreaLayout.starts };
    }
    return buildOpticAreaLayout({
      answerAreaStarts: baseLinkedOpticAreaLayout.starts,
      answerFields: savedFields,
    });
  })();

  const normalizeExamOpticFields = (fields: any[], starts: number[]) => {
    const groups: any[][] = Array.from({ length: OPTIC_ANSWER_AREA_COUNT }, () => []);
    fields.forEach((field: any, index: number) => {
      const areaIndex = opticAreaIndexOf(field, Math.min(index, OPTIC_ANSWER_AREA_COUNT - 1));
      groups[areaIndex].push(field);
    });

    return groups.flatMap((group, areaIndex) => {
      let nextStart = Math.max(0, Number(starts[areaIndex]) || 0);
      return group.map((field: any) => {
        const count = Math.max(0, Number(field?.columnCount || 0));
        const normalized = {
          ...field,
          id: String(field?.id || `area-${areaIndex + 1}-${Date.now()}`),
          startColumn: nextStart,
          columnCount: count,
        };
        nextStart += count;
        return normalized;
      });
    });
  };

  const saveOpticExamFields = (fields: any[]) => {
    if (!managingExam || !linkedOpticTemplate) return;
    const starts = baseLinkedOpticAreaLayout.starts.map((value: any) => Math.max(0, Number(value) || 0));
    const normalizedFields = normalizeExamOpticFields(fields, starts);
    handleUpdateExam({
      ...managingExam,
      opticExamConfig: {
        templateId: linkedOpticTemplate.id,
        templateName: linkedOpticTemplate.name,
        answerAreaStarts: starts,
        answerFields: normalizedFields,
      },
    });
  };

  const handleOpticSettingsTemplateChange = (templateId: string) => {
    if (!managingExam) return;
    const selected = availableOpticForms.find(
      (form: any) => String(form?.id || "") === String(templateId || ""),
    );
    if (!selected) return;

    const selectedLayout = buildOpticAreaLayout(selected);
    const previousConfig = managingExam?.opticExamConfig;
    const preserveFields =
      String(previousConfig?.templateId || "").trim() === String(selected.id || "").trim() &&
      Array.isArray(previousConfig?.answerFields)
        ? previousConfig.answerFields
        : [];

    const normalizedFields = normalizeExamOpticFields(
      preserveFields,
      selectedLayout.starts,
    );

    handleUpdateExam({
      ...managingExam,
      opticForm: selected.name,
      opticFormId: selected.id,
      opticTemplate: JSON.parse(JSON.stringify(selected)),
      opticExamConfig: {
        templateId: selected.id,
        templateName: selected.name,
        answerAreaStarts: selectedLayout.starts,
        answerFields: normalizedFields,
      },
    });
    setOpticCoursePickerArea(null);
  };

  const addOpticExamCourse = (areaIndex: number, courseName: string) => {
    if (!linkedOpticTemplate || !courseName) return;
    const starts = baseLinkedOpticAreaLayout.starts;
    if (!(Number(starts[areaIndex]) > 0)) return;

    const allFields = linkedOpticAreaLayout.groups.flat();
    const normalizedCourse = normalizeOpticCourseKey(courseName);
    if (allFields.some((field: any) => normalizeOpticCourseKey(field?.courseName) === normalizedCourse)) {
      setOpticCoursePickerArea(null);
      return;
    }

    const course = opticExamCourseOptions.find(
      (item: any) => normalizeOpticCourseKey(item?.name) === normalizedCourse,
    );
    const areaFields = linkedOpticAreaLayout.groups[areaIndex] || [];
    const nextField = {
      id: `area-${areaIndex + 1}-${Date.now()}`,
      courseName: courseName,
      startColumn: Number(starts[areaIndex]) || 0,
      columnCount: Math.max(0, Number(course?.count || 0)),
    };
    saveOpticExamFields([
      ...linkedOpticAreaLayout.groups.flatMap((group: any[]) => group),
      nextField,
    ]);
    setOpticCoursePickerArea(null);
  };

  const updateOpticExamCourse = (fieldId: string, patch: any) => {
    const fields = linkedOpticAreaLayout.groups.flat().map((field: any) =>
      String(field?.id || "") === String(fieldId) ? { ...field, ...patch } : field,
    );
    saveOpticExamFields(fields);
  };

  const removeOpticExamCourse = (fieldId: string) => {
    const fields = linkedOpticAreaLayout.groups
      .flat()
      .filter((field: any) => String(field?.id || "") !== String(fieldId));
    saveOpticExamFields(fields);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-white border-2 border-dashed border-green-600 rounded-3xl p-4">
        <div className="bg-green-600 bg-theme-pattern p-1.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 w-full shadow-inner min-h-[52px]">
          {/* Sol Kısım: Sınav Hazırla Butonları */}
          <div className="flex items-center overflow-x-auto gap-1 w-full md:w-auto scrollbar-hide justify-start">
            <button
              onClick={() => {
                setActiveTab("exams");
                setManagingExam(null);
              }}
              className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                activeTab === "exams"
                  ? "bg-white text-green-700 shadow-sm border-white"
                  : "text-white hover:bg-green-700/80 border-white/60"
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              Sınavlar
            </button>
            <button
              onClick={() => {
                setActiveTab("questions");
              }}
              className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                activeTab === "questions"
                  ? "bg-white text-green-700 shadow-sm border-white"
                  : "text-white hover:bg-green-700/80 border-white/60"
              }`}
            >
              <ListChecks className="w-4 h-4 shrink-0" />
              Soru İşlemleri
            </button>
            <button
              onClick={() => {
                setActiveTab("optic-settings");
              }}
              className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                activeTab === "optic-settings"
                  ? "bg-white text-green-700 shadow-sm border-white"
                  : "text-white hover:bg-green-700/80 border-white/60"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              Optik Ayarları
            </button>
            {(!managingExam || managingExam.examSource !== "Basılı Yayın") && (
              <button
                onClick={() => {
                  setActiveTab("booklets");
                }}
                className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                  activeTab === "booklets"
                    ? "bg-white text-green-700 shadow-sm border-white"
                    : "text-white hover:bg-green-700/80 border-white/60"
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                PDF Hazırlık
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab("read-edit");
              }}
              className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                activeTab === "read-edit"
                  ? "bg-white text-green-700 shadow-sm border-white"
                  : "text-white hover:bg-green-700/80 border-white/60"
              }`}
            >
              <FileSearch className="w-4 h-4 shrink-0" />
              Oku-Düzenle
            </button>
            <button
              onClick={() => {
                setActiveTab("evaluate");
              }}
              className={`flex-initial flex items-center justify-center gap-1.5 px-5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] ${
                activeTab === "evaluate"
                  ? "bg-white text-green-700 shadow-sm border-white"
                  : "text-white hover:bg-green-700/80 border-white/60"
              }`}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              Değerlendir
            </button>
          </div>

          {/* Orta/Sağ Kısım: Sarı Renkli Sınav Adı */}
          {activeTab !== "exams" && managingExam && (
            <div className="py-1 md:py-0 px-4 flex items-center justify-center md:justify-end flex-1 max-w-full overflow-hidden">
              <span className="font-extrabold text-yellow-300 text-xs md:text-sm tracking-wide text-center md:text-right drop-shadow-sm truncate">
                {managingExam.publisherName ? `${managingExam.publisherName} - ` : ""}{managingExam.examName}
              </span>
            </div>
          )}

          {activeTab === "exams" && (
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <select
                value={examGradeFilter}
                onChange={(e) => setExamGradeFilter(e.target.value)}
                aria-label="Sınavları sınıf düzeyine göre filtrele"
                className="h-[40px] w-[125px] rounded-xl border-2 border-white/70 bg-white px-3 text-center text-xs font-extrabold text-green-800 shadow-sm outline-none focus:ring-2 focus:ring-yellow-300"
              >
                <option value="">Tüm Sınıflar</option>
                {["9", "10", "11", "12"].map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sağ Kısım: Yeni Sınav Butonu (Zemin yeşil olduğu için sarı tonla daha belirgin yapıldı) */}
          {activeTab === "exams" && (
            <div className="flex items-center justify-center md:justify-end md:pr-1 w-full md:w-auto">
              <button
                onClick={openNewExamModal}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl font-extrabold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Yeni Sınav Oluştur
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab !== "exams" && managingExam ? (
        activeTab === "optic-settings" ? (
          isManagedElectronicExam ? (
            <section className="space-y-5 rounded-3xl border border-sky-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-blue-900">Elektronik Optik Yönetimi</h2>
                  <p className="text-xs font-semibold text-slate-500">Fiziksel optik form veya sütun tanımı gerekmez. Öğrenci cevap formu sınavın ders ve soru dağılımından otomatik oluşturulur.</p>
                </div>
                <button type="button" disabled={electronicSyncBusy} onClick={() => void refreshElectronicExam()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-800 disabled:opacity-50">{electronicSyncBusy ? "Yenileniyor..." : "Katılımı Yenile"}</button>
              </div>
              {electronicNotice && <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-900">{electronicNotice}</div>}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Toplam soru</div><div className="mt-1 text-2xl font-black text-slate-900">{getTotalQuestionCount(managingExam.examStructure || [])}</div></div>
                <div className="rounded-2xl bg-sky-50 p-4"><div className="text-xs font-bold text-sky-700">Elektronik cevap gönderen</div><div className="mt-1 text-2xl font-black text-sky-950">{(managingExam.studentTxtRecords || []).filter((row: any) => row.source === "electronic-optic").length}</div></div>
                <div className="rounded-2xl bg-rose-50 p-4">
                  <div className="text-xs font-bold text-rose-700">Cevap vermeyen</div>
                  <div className="mt-1 text-2xl font-black text-rose-950">{electronicRosterLoading ? "…" : electronicRosterError ? "—" : electronicNonResponders.length}</div>
                  <button type="button" disabled={electronicRosterLoading || Boolean(electronicRosterError) || !electronicRoster.length} onClick={printElectronicNonResponders} className="mt-2 rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">PDF Liste</button>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Sonuç durumu</div><div className="mt-2 text-sm font-black text-slate-900">{managingExam.electronicResultsPublished ? "Yayımlandı" : managingExam.isEvaluated ? "Yayım bekliyor" : "Değerlendirme bekliyor"}</div></div>
              </div>
              {electronicRosterError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{electronicRosterError}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                {(managingExam.examStructure || []).map((test: any, index: number) => (
                  <div key={index} className="overflow-hidden rounded-2xl border border-sky-100">
                    <div className="bg-sky-100 px-4 py-2 text-sm font-black text-sky-950">{test.testName || `${index + 1}. Test`}</div>
                    <div className="divide-y divide-slate-100">{(test.subjects || []).filter((subject: any) => Number(subject.count) > 0).map((subject: any, i: number) => (
                      <div key={i} className="flex justify-between px-4 py-2 text-xs font-bold"><span>{subject.name}</span><span>{subject.count} soru</span></div>
                    ))}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <div className="text-sm font-black text-amber-950">Sonradan Sınava Girecek Öğrenci</div>
                  <p className="text-xs text-amber-900">Öğrenci numarasıyla ayrı süre açın. Asıl sınav tarihini değiştirmeyin. Yeni cevap sonrası sonuçlar yeniden değerlendirilir; yayımlama yönetici onayıyla yapılır.</p>
                  {Object.entries(managingExam.electronicLateWindows || {}).filter(([, value]: any) => Number(value?.endsAt) > Date.now()).map(([number, value]: any) => (
                    <div key={number} className="mt-1 text-xs font-bold text-amber-900">{number} · Bitiş: {new Date(Number(value.endsAt)).toLocaleString("tr-TR")}</div>
                  ))}
                </div>
                <button type="button" disabled={electronicSyncBusy} onClick={() => void openElectronicLateSession()}
                  className="rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Geç Katılım Aç</button>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-black text-slate-900">Kesin Gönderim Kayıtları</h3>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {(managingExam.studentTxtRecords || []).filter((row: any) => row.source === "electronic-optic").map((row: any) => (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-bold">{row.studentNumber} · {row.studentName} · {row.classroom}</span>
                      <span className="text-slate-500">{row.bookletType} kitapçığı · {row.submittedAt ? new Date(row.submittedAt).toLocaleString("tr-TR") : "Gönderildi"}</span>
                    </div>
                  ))}
                  {!(managingExam.studentTxtRecords || []).some((row: any) => row.source === "electronic-optic") && <p className="text-xs text-slate-500">Henüz kesin gönderim bulunmuyor. Yenile butonuyla güncel kayıtları alabilirsiniz.</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div><div className="text-sm font-black text-indigo-950">Sonuç Yayınlama</div><p className="text-xs text-indigo-800">Önce Oku-Düzenle bölümünde cevap anahtarını kontrol edin, ardından Değerlendir bölümünü tamamlayın. Yayınlanana kadar sonuçlar mobilde gizli kalır.</p></div>
                <button type="button" disabled={electronicSyncBusy} onClick={() => void publishLateElectronicResults()} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-900 disabled:opacity-50">Geç Katılanları Değerlendir / Yayımla</button>
                <button type="button" disabled={electronicSyncBusy} onClick={() => void updateElectronicPublication(!managingExam.electronicResultsPublished)} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{managingExam.electronicResultsPublished ? "Yayından Kaldır" : "Sonuçları Yayımla"}</button>
              </div>
            </section>
          ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-3">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:col-start-1 lg:row-start-1 lg:mb-0">
              <div className="w-full">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                  Ölçme Araçları &gt; Optik Formlar
                </div>
                <label className="mt-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Kullanılacak Optik
                </label>
                <select
                  value={linkedOpticTemplate ? String(linkedOpticTemplate.id || "") : ""}
                  onChange={(event) => handleOpticSettingsTemplateChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="">
                    {availableOpticForms.length > 0 ? "Optik form seçiniz" : "Kayıtlı optik form bulunamadı"}
                  </option>
                  {availableOpticForms.map((form: any) => (
                    <option key={form.id} value={form.id}>{form.name}</option>
                  ))}
                </select>
              </div>
              {linkedOpticTemplate && (
                <div className="rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700">
                  {linkedOpticTemplate.name}
                </div>
              )}
            </div>

            {!linkedOpticTemplate ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center lg:col-span-2">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <Settings className="h-7 w-7" />
                </div>
                <h3 className="text-base font-black text-slate-800">Kullanılacak optiği seçin</h3>
                <p className="mt-2 max-w-md text-xs font-semibold text-slate-500">
                  Liste, Ölçme Araçları &gt; Optik Formlar bölümündeki kayıtlı optiklerden gelir.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:contents">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 lg:col-start-1 lg:row-start-2">
                  <div className="mb-2">
                    <h4 className="text-xs font-black text-slate-900">Sabit Bilgi Alanları</h4>
                    <p className="text-[9px] font-semibold text-slate-400">
                      Seçilen optik formdan sabit olarak alınır.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {(linkedOpticTemplate.identityFields || []).map((field: any) => (
                      <div
                        key={field.key || field.label}
                        className="grid grid-cols-[1fr_48px_44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <div className="truncate text-[9px] font-black text-slate-800">
                          {field.label}
                        </div>
                        <div className="text-center">
                          <div className="text-[6px] font-black uppercase text-slate-400">Başl.</div>
                          <div className="text-[9px] font-black text-slate-800">
                            {Number(field.startColumn || 0) > 0 ? field.startColumn : "—"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[6px] font-black uppercase text-slate-400">Sütun</div>
                          <div className="text-[9px] font-black text-slate-800">
                            {Number(field.columnCount || 0) > 0 ? field.columnCount : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                  <div className="mb-2">
                    <h4 className="text-xs font-black text-slate-900">Optik Cevap Alanları</h4>
                    <p className="text-[9px] font-semibold text-slate-400">
                      Başlangıç sütunları seçilen optikten sabit gelir. Dersler yalnız bu sınavın tanımlı derslerinden eklenir.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: OPTIC_ANSWER_AREA_COUNT }).map((_, areaIndex) => {
                      const areaStart = Number(baseLinkedOpticAreaLayout.starts[areaIndex] || 0);
                      const areaFields = linkedOpticAreaLayout.groups[areaIndex] || [];
                      const usedCourseKeys = new Set(
                        linkedOpticAreaLayout.groups.flat().map((field: any) => normalizeOpticCourseKey(field?.courseName)),
                      );
                      const availableCoursesForArea = opticExamCourseOptions.filter(
                        (course: any) => !usedCourseKeys.has(normalizeOpticCourseKey(course?.name)),
                      );

                      return (
                        <div
                          key={areaIndex}
                          className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/20"
                        >
                          <div className="bg-violet-950 px-3 py-2.5 text-white">
                            <div className="text-[9px] font-black uppercase tracking-wider">
                              {areaIndex + 1}. Alan
                            </div>
                            <div className="mt-1 text-[8px] font-bold text-violet-200">
                              TXT başlangıç sütunu
                            </div>
                            <div className="mt-0.5 text-xl font-black">
                              {areaStart > 0 ? areaStart : "Tanımsız"}
                            </div>
                          </div>

                          <div className="space-y-1.5 p-2">
                            {areaFields.map((field: any, index: number) => (
                              <div
                                key={field.id || `${areaIndex}-${index}`}
                                className="rounded-xl border border-violet-100 bg-white p-2"
                              >
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={String(field.courseName || "")}
                                    onChange={(event) => {
                                      const selectedName = event.target.value;
                                      const course = opticExamCourseOptions.find(
                                        (item: any) => normalizeOpticCourseKey(item?.name) === normalizeOpticCourseKey(selectedName),
                                      );
                                      updateOpticExamCourse(field.id, {
                                        courseName: selectedName,
                                        columnCount: Math.max(0, Number(course?.count || field.columnCount || 0)),
                                      });
                                    }}
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-violet-200"
                                  >
                                    {opticExamCourseOptions.map((course: any) => {
                                      const courseKey = normalizeOpticCourseKey(course?.name);
                                      const isCurrent = courseKey === normalizeOpticCourseKey(field?.courseName);
                                      const usedElsewhere = !isCurrent && linkedOpticAreaLayout.groups.flat().some(
                                        (other: any) => String(other?.id || "") !== String(field?.id || "") && normalizeOpticCourseKey(other?.courseName) === courseKey,
                                      );
                                      return (
                                        <option key={course.name} value={course.name} disabled={usedElsewhere}>
                                          {course.name}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeOpticExamCourse(field.id)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"
                                    title="Dersi kaldır"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-1.5 grid grid-cols-[1fr_72px] items-end gap-2">
                                  <div>
                                    <div className="text-[7px] font-black uppercase text-slate-400">Başlangıç</div>
                                    <div className="text-[10px] font-black text-violet-800">{field.startColumn || areaStart || "—"}</div>
                                  </div>
                                  <div>
                                    <label className="text-[7px] font-black uppercase text-slate-400">Soru</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={Number(field.columnCount || 0)}
                                      onChange={(event) => updateOpticExamCourse(field.id, {
                                        columnCount: Math.max(0, Number(event.target.value) || 0),
                                      })}
                                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-center text-[9px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-violet-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            {opticCoursePickerArea === areaIndex ? (
                              <select
                                autoFocus
                                defaultValue=""
                                onBlur={() => setOpticCoursePickerArea(null)}
                                onChange={(event) => addOpticExamCourse(areaIndex, event.target.value)}
                                className="w-full rounded-xl border border-violet-300 bg-white px-2 py-2 text-[9px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-violet-200"
                              >
                                <option value="" disabled>Ders seçiniz</option>
                                {availableCoursesForArea.map((course: any) => (
                                  <option key={course.name} value={course.name}>
                                    {course.name}{course.count > 0 ? ` (${course.count} soru)` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                type="button"
                                disabled={areaStart <= 0 || availableCoursesForArea.length === 0}
                                onClick={() => setOpticCoursePickerArea(areaIndex)}
                                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-violet-300 px-2 py-2 text-[9px] font-black text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Ders Ekle
                              </button>
                            )}

                            {areaStart <= 0 && (
                              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[8px] font-bold text-amber-700">
                                Bu alanın başlangıç sütunu Optik Form Yönetimi'nde tanımlanmalıdır.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
          )
        ) : (
          <div className="space-y-4">
            <QuestionManagerView
          exam={managingExam}
          onBack={() => {
            setManagingExam(null);
            setActiveTab("exams");
          }}
          onEvaluationComplete={() => {
            setManagingExam(null);
            setActiveTab("exams");
            if (setAppActiveTab) setAppActiveTab("exam-analysis");
          }}
          onUpdateExam={handleUpdateExam}
          allExams={exams}
          activeTab={activeTab}
          readEditOpticSelector={activeTab === "read-edit" ? (
            <div className="w-full lg:w-[320px]">
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-600">Optik Form Seçimi</label>
              <select
                value={(() => {
                  const currentId = String(managingExam.opticFormId || "").trim();
                  const currentName = String(managingExam.opticForm || "").trim().toLocaleLowerCase("tr-TR");
                  const linked = availableOpticForms.find((form: any) =>
                    (currentId && String(form?.id || "") === currentId) ||
                    (currentName && String(form?.name || "").trim().toLocaleLowerCase("tr-TR") === currentName)
                  );
                  return linked ? String(linked.id) : "";
                })()}
                onChange={(e) => {
                  const selected = availableOpticForms.find(
                    (form: any) => String(form?.id || "") === e.target.value,
                  );
                  if (!selected) return;
                  const nextExam = {
                    ...managingExam,
                    opticForm: selected.name,
                    opticFormId: selected.id,
                    opticTemplate: JSON.parse(JSON.stringify(selected)),
                  };
                  handleUpdateExam(nextExam);
                }}
                className="w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-300"
              >
                <option value="" disabled>
                  {availableOpticForms.length > 0
                    ? "Optik form seçiniz"
                    : "Optik Form Yönetimi'nde kayıtlı optik yok"}
                </option>
                {availableOpticForms.map((form: any) => (
                  <option key={form.id} value={form.id}>{form.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          getTeachersForSubject={teachersForSubject}
          onAssignQuestionTeacher={async (subjectName: string, teacherId: string) => {
            if (!managingExam) return null;
            return await assignTeacherToSubject(
              subjectName,
              String(managingExam.gradeLevel || ""),
              teacherId,
              managingExam,
            );
          }}
          onClearQuestionTeacher={(subjectName: string) => {
            if (!managingExam) return;
            const normalized = String(subjectName || "").trim().toLocaleLowerCase("tr-TR");
            const nextAssignments = Object.fromEntries(
              Object.entries(managingExam.questionAssignments || {}).filter(([, value]: any) =>
                String(value?.subject || value?.courseName || "").trim().toLocaleLowerCase("tr-TR") !== normalized
              ),
            );
            handleUpdateExam({
              ...managingExam,
              questionAssignments: nextAssignments,
            });
          }}
            />
          </div>
        )
      ) : activeTab !== "exams" && !managingExam ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Lütfen bir sınav seçin
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            İşlem yapabilmek için Sınavlar sekmesinden bir sınav seçmeniz gerekmektedir.
          </p>
        </div>
      ) : exams.filter(e => !examGradeFilter || String(e.gradeLevel) === examGradeFilter).length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Henüz hazırlanacak sınav bulunmuyor
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            "Yeni Sınav Oluştur" butonuna tıklayarak yeni sınav hazırlayabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {exams.filter(e => !examGradeFilter || String(e.gradeLevel) === examGradeFilter).map((exam) => (
            <div
              key={exam.id}
              onClick={() => {
                setActiveTab("questions");
                setManagingExam(exam);
              }}
              className={`min-w-0 rounded-2xl border p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer ${String(exam?.participantGroup || "").toLowerCase() === "trial-club" || String(exam?.participantLabel || "").toLocaleLowerCase("tr-TR").includes("deneme kulüb") ? "bg-amber-900 border-amber-800" : "bg-white border-slate-200"}`}
            >
              <div className="flex flex-wrap justify-between items-start mb-2 gap-1.5">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${String(exam?.participantGroup || "").toLowerCase() === "trial-club" || String(exam?.participantLabel || "").toLocaleLowerCase("tr-TR").includes("deneme kulüb") ? "bg-amber-100 text-amber-950" : "bg-purple-100 text-purple-700"}`}>
                  {getExamTypeDisplayName(exam.examType)} - {exam.gradeLevel}
                </span>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  {exam.examStatus || (exam.isEvaluated ? "Değerlendirildi" : "Hazırlanıyor")}
                </span>
              </div>
              <h3 className={`break-words text-[13px] font-black leading-snug mb-3 ${String(exam?.participantGroup || "").toLowerCase() === "trial-club" || String(exam?.participantLabel || "").toLocaleLowerCase("tr-TR").includes("deneme kulüb") ? "text-white" : "text-red-600"}`}>
                {exam.publisherName ? `${exam.publisherName} - ` : ""}{replaceLegacyExamTerminology(exam.examName)}
              </h3>

              <div className="mt-auto space-y-1.5 text-[11px] text-slate-500">
                <div className="flex flex-wrap justify-between items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" /> Tarih:
                  </span>
                  <span className="font-semibold text-slate-700">
                    {exam.examDate
                      ? new Date(exam.examDate).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={examLockSavingId !== null}
                  onClick={(event) => { event.stopPropagation(); void toggleExamAdminLock(exam); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left transition ${isExamAdminLocked(exam) ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"} disabled:opacity-60`}
                  title="Yönetici işlem kilidini aç/kapat (öğrenci optiğinin zamanını değiştirmez)"
                >
                  <span className="inline-flex items-center gap-2 font-black">
                    {isExamAdminLocked(exam) ? <LockKeyhole className="h-4 w-4" /> : <LockKeyholeOpen className="h-4 w-4" />}
                    {isExamAdminLocked(exam) ? "Kilitli" : "Kilit açık"}
                  </span>
                  <span className="text-[10px] font-bold">{examLockSavingId === String(exam.id) ? "Kaydediliyor…" : isExamAdminLocked(exam) ? "Aç" : "Kilitle"}</span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                {Boolean(exam?.finalizedAt || exam?.isFinalized === true || exam?.bookletLayoutLock?.questionsLocked === true) ? (
                  <span className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-700">
                    KESİNLEŞTİ · SİLİNEMEZ
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExamAdminLocked(exam)) { alert("Düzenleme için önce sınav kartındaki kilidi açın."); return; }
                      void handleDeleteExam(exam);
                    }}
                    className="inline-flex min-w-[86px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100"
                    title="Sınav kartını sil"
                  >
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isExamAdminLocked(exam)) { alert("Güncellemek için önce sınav kartındaki kilidi açın."); return; }
                    openEditExamModal(exam);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-purple-100 bg-purple-50 py-2.5 text-xs font-bold text-purple-700 transition-all hover:bg-purple-100"
                >
                  <Settings className="w-4 h-4" />
                  Güncelle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-5 md:p-7 max-w-6xl w-[96vw] shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-[220px] flex-[1.3] space-y-1">
                <label className="block text-[11px] font-black text-slate-600">Sınav / Deneme Adı</label>
                <input type="text"
                  placeholder={participantGroup === "trial-club" || editingExamId ? "Denemenin adını yazınız..." : "Sınıf, ders ve sınav türüne göre otomatik oluşturulur"}
                  value={examName}
                  onChange={(e) => { if (editingExamId || participantGroup === "trial-club") setExamName(e.target.value); }}
                  readOnly={!editingExamId && participantGroup !== "trial-club"}
                  required maxLength={240}
                  className={`h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-extrabold text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 ${!editingExamId && participantGroup !== "trial-club" ? "cursor-default" : ""}`}
                  aria-label="Sınav adı" />
              </div>
              <div className="w-[225px] shrink-0 space-y-1">
                <label className="block text-[11px] font-black text-slate-600">Sınav Tarihi ve Saati</label>
                <input type="datetime-local" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                  required aria-label="Sınav tarihi"
                  className="h-11 w-full rounded-xl border border-green-600 bg-green-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none" />
              </div>
              <div className="min-w-[230px] flex-1 space-y-1">
                <div className="text-[11px] font-black text-slate-600">Sınav Kaynağı</div>
                <div className="flex h-11 flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700">
                  <input type="radio" name="examSource" value="Sistem" checked={examSource === "Sistem"}
                    onChange={(e) => setExamSource(e.target.value)} className="accent-rose-700" />
                  Sistem Sınavı
                </label>
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700">
                  <input type="radio" name="examSource" value="Basılı Yayın" checked={examSource === "Basılı Yayın"}
                    onChange={(e) => setExamSource(e.target.value)} className="accent-rose-700" />
                  Basılı Yayın
                </label>
                </div>
              </div>
              {answeringMethod === "Elektronik" && (
                <label className="flex w-[135px] shrink-0 flex-col gap-1 text-[11px] font-black text-indigo-900">
                  Sınav süresi (dk)
                  <input type="number" min={1} max={600} step={1} required value={electronicDurationMinutes}
                    onChange={(event) => setElectronicDurationMinutes(Math.max(1, Math.min(600, Number(event.target.value) || 1)))}
                    className="w-full rounded-xl border border-indigo-400 bg-indigo-50 px-3 py-2.5 text-sm font-black text-indigo-900" />
                </label>
              )}
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="self-center rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Pencereyi kapat"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Temel Sınav Bilgileri */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className={`grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 ${examType === "Branşlar Denemesi" ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Sınıf Düzeyi *</label>
                    <select value={gradeLevel} onChange={(e) => {
                      const nextGrade = e.target.value;
                      setGradeLevel(nextGrade);
                      setExamCode(generateExamCode(examType, nextGrade));
                      if (["Ders Denemesi", "Branşlar Denemesi", "Ünite Denemesi", "Konu Denemesi"].includes(examType)) {
                        setSelectedExamCourseId("");
                        setSelectedExamCourseIds([]);
                                            setQuestionBlueprint([]);
                        setBlueprintDraft({ courseId: "", unitId: "", topicId: "", outcomeId: "", count: 1 });
                        setQuestionAssignments({});
                        setTeacherSelectionBySubject({});
                        setExamStructure(examType === "Branşlar Denemesi"
                          ? branchExamModel === "TYT"
                            ? DEFAULT_TYT_STRUCTURE.map((test) => ({ ...test, testName: test.testName === "Temel Matematik Testi" ? "Matematik Testi" : test.testName, subjects: [] }))
                            : branchExamModel === "AYT"
                              ? DEFAULT_AYT_STRUCTURE.map((test) => ({ ...test, subjects: [] }))
                              : []
                          : [{ testName: examType, subjects: [] }]);
                      }
                    }} className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer">
                      <option value="9">9. Sınıf</option><option value="10">10. Sınıf</option><option value="11">11. Sınıf</option><option value="12">12. Sınıf</option><option value="YKS">YKS</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Katılımcılar *</label>
                    <select
                      value={participantGroup}
                      onChange={(e) => {
                        const nextGroup = e.target.value === "trial-club" ? "trial-club" : "school";
                        if (!editingExamId && nextGroup === "trial-club" && participantGroup !== "trial-club") setExamName("");
                        setParticipantGroup(nextGroup);
                      }}
                      className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="school">Okul Öğrencileri</option>
                      <option value="trial-club">Deneme Kulübü</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Sınav Türü *</label>
                    <select value={examType} onChange={handleExamTypeChange} className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer">
                      <option value="TYT">TYT</option>
                      <option value="AYT">AYT</option>
                      <option value="Ders Denemesi">Ders Denemesi</option>
                      <option value="Branşlar Denemesi">Branşlar Denemesi</option>
                      {editingExamId && examType === "Ünite Denemesi" ? <option value="Ünite Denemesi">Ünite Denemesi (Eski Kayıt)</option> : null}
                      {editingExamId && examType === "Konu Denemesi" ? <option value="Konu Denemesi">Konu Denemesi (Eski Kayıt)</option> : null}
                    </select>
                  </div>
                  {examType === "Branşlar Denemesi" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Sınav Modeli *</label>
                      <select value={branchExamModel} onChange={(e) => changeBranchExamModel(e.target.value as "TYT" | "AYT" | "Serbest")}
                        className="w-full rounded-xl border border-green-600 bg-green-50 px-3 py-3 text-sm font-bold text-slate-800">
                        <option value="TYT">TYT</option><option value="AYT">AYT</option><option value="Serbest">Serbest</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Cevaplama Şekli *</label>
                    <select
                      value={answeringMethod}
                      onChange={(e) => setAnsweringMethod(e.target.value === "Elektronik" ? "Elektronik" : "Optik")}
                      className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="Optik">Optik</option>
                      <option value="Elektronik">Elektronik</option>
                    </select>
                  </div>

                  {examCurriculumError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">Müfredat okunamadı: {examCurriculumError}</p>}
                  {examType === "Ünite Denemesi" && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">Ders *</label>
                        <select
                          value={selectedExamCourseId}
                          onChange={(e) => selectUnitScanCourse(e.target.value)}
                          className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                        >
                          <option value="">Ders seçiniz</option>
                          {availableBlueprintCourses.map((course: any) => (
                            <option key={`unit-scan-course-${course.grade}-${course.id}`} value={course.id}>
                              {gradeLevel === "YKS" ? `${course.grade}. Sınıf — ` : ""}{course.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">Ünite / Üniteler *</label>
                        <div className={`max-h-56 overflow-y-auto rounded-xl border p-2 ${
                          selectedExamCourseId
                            ? "border-green-600 bg-green-50"
                            : "border-slate-300 bg-slate-100"
                        }`}>
                          {!selectedExamCourseId ? (
                            <div className="px-2 py-3 text-xs font-bold text-slate-400">Önce ders seçiniz.</div>
                          ) : (() => {
                            const selectedCourse = availableBlueprintCourses.find((course: any) =>
                              String(course.id) === String(selectedExamCourseId),
                            );
                            const units = Array.isArray(selectedCourse?.units) ? selectedCourse.units : [];
                            if (units.length === 0) {
                              return <div className="px-2 py-3 text-xs font-bold text-slate-400">Bu ders için ünite bulunamadı.</div>;
                            }
                            return (
                              <div className="space-y-1">
                                {units.map((unit: any) => {
                                  const checked = questionBlueprint.some((row: any) =>
                                    String(row?.courseId || "") === String(selectedExamCourseId) &&
                                    String(row?.unitId || "") === String(unit.id),
                                  );
                                  return (
                                    <label
                                      key={`unit-scan-unit-${unit.id}`}
                                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-xs font-bold transition ${
                                        checked ? "bg-white text-emerald-900 shadow-sm" : "text-slate-700 hover:bg-white/70"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleUnitScanUnit(String(unit.id))}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                      />
                                      <span className="leading-4">{unit.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  )}

                  {examSource === "Basılı Yayın" && examType === "Ünite Denemesi" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Soru Sayısı *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={unitScanQuestionCount > 0 ? unitScanQuestionCount : ""}
                        onChange={(e) => updateUnitScanQuestionCount(Number(e.target.value))}
                        placeholder="Örn: 20"
                        required
                        className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-bold text-slate-700"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Kitapçık Seçeneği *</label>
                    <select value={bookletType} onChange={(e) => setBookletType(e.target.value)} className="w-full px-3 py-3 bg-green-50 border border-green-600 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer">
                      <option value="A">Tek Kitapçık (A)</option><option value="A-B">İki Kitapçık (A-B)</option><option value="A-B-C-D">Dört Kitapçık (A-B-C-D)</option>
                    </select>
                  </div>

                </div>
              </div>

              {examType === "Branşlar Denemesi" && (
                <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-sm md:p-5 space-y-4">
                  {branchExamModel === "Serbest" && (
                    <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5">
                      <input type="checkbox" checked={continueQuestionNumbers}
                        onChange={(e) => setContinueQuestionNumbers(e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-red-600" />
                      <span className="whitespace-nowrap text-xs font-black text-red-700">Soru numaraları devam etsin</span>
                    </label>
                  )}

                  {branchExamModel === "Serbest" && (
                    <div className="rounded-2xl border border-dashed border-indigo-300 bg-white/90 p-3">
                      <label className="mb-2 block text-xs font-black text-slate-700">Yeni ders ekle</label>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) addModelSubject(-1, e.target.value); }}
                        className="w-full rounded-xl border border-indigo-300 bg-white px-3 py-3 text-sm font-bold text-slate-800 shadow-sm"
                      >
                        <option value="">+ Ders ekle (ayrı test kartı oluşur)</option>
                        {availableBlueprintCourses
                          .filter((course: any) => !examStructure.some((item: any) => (item.subjects || []).some((sub: any) => String(sub.courseId) === String(course.id))))
                          .map((course: any) => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {examStructure.map((test: any, testIndex: number) => {
                      const subjects = Array.isArray(test?.subjects) ? test.subjects : [];
                      const totalQuestions = subjects.reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.count) || 0), 0);
                      return <div key={`${branchExamModel}-${testIndex}`} className="flex min-h-[360px] flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-2 text-white">
                          <div className="text-sm font-black leading-5 break-words">{test.testName}</div>
                          {branchExamModel === "Serbest" && (
                            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] font-black">
                              <button type="button" title="Testi yukarı al" disabled={testIndex === 0} onClick={() => moveModelTest(testIndex, -1)} className="rounded-full bg-white/15 px-2 py-1 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40">Yukarı</button>
                              <button type="button" title="Testi aşağı al" disabled={testIndex === examStructure.length - 1} onClick={() => moveModelTest(testIndex, 1)} className="rounded-full bg-white/15 px-2 py-1 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40">Aşağı</button>
                              <button type="button" onClick={() => { const id = String(subjects?.[0]?.courseId || ""); setExamStructure((tests) => tests.filter((_, i) => i !== testIndex)); setSelectedExamCourseIds((ids) => ids.filter((item) => item !== id)); setQuestionBlueprint((rows) => rows.filter((row: any) => String(row.courseId) !== id)); }} className="rounded-full bg-rose-500/90 px-2 py-1 text-white transition hover:bg-rose-500">Sil</button>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          {branchExamModel !== "Serbest" && (
                            <div className="mb-4 border-b border-slate-100 pb-4">
                              <select
                                value=""
                                onChange={(e) => { if (e.target.value) addModelSubject(testIndex, e.target.value); }}
                                className="w-full rounded-xl border border-emerald-400 bg-emerald-50 px-3 py-3 text-sm font-bold text-slate-700"
                              >
                                <option value="">+ Ders seçerek ekle</option>
                                {availableBlueprintCourses
                                  .filter((course: any) => !examStructure.some((item: any) => (item.subjects || []).some((sub: any) => String(sub.courseId) === String(course.id))))
                                  .map((course: any) => (
                                    <option key={course.id} value={course.id}>{gradeLevel === "YKS" || (branchExamModel === "TYT" && String(course.grade) !== String(gradeLevel)) ? `${course.grade}. Sınıf — ` : ""}{course.name}</option>
                                  ))}
                              </select>
                            </div>
                          )}
                          <div className="flex-1 space-y-3">
                            {subjects.map((subject: any, subjectIndex: number) => {
                              return <div key={`${subject.courseId}-${subjectIndex}`} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 shadow-sm">
                                <div className="whitespace-normal text-[12px] font-extrabold leading-5 text-slate-900">{subject.name}</div>
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    aria-label={`${subject.name} soru sayısı`}
                                    value={subject.count}
                                    onChange={(e) => handleSubjectCountChange(testIndex, subjectIndex, Math.max(1, Number(e.target.value) || 1))}
                                    className="h-8 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center text-xs font-black text-slate-800"
                                  />
                                  <button type="button" title="Dersi çıkar" onClick={() => removeModelSubject(testIndex, subjectIndex)} className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-700 transition hover:bg-rose-100">Sil</button>
                                </div>
                              </div>;
                            })}
                          </div>


                        </div>
                      </div>;
                    })}
                  </div>
                </div>
              )}

              {examType === "Ünite Denemesi" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Ünite Denemesi Kapsamı</div>
                  {questionBlueprint.length > 0 ? (
                    <div className="mt-2">
                      <div className="text-sm font-black text-slate-900">{questionBlueprint[0]?.subject}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {questionBlueprint.map((row: any) => (
                          <span
                            key={`unit-scope-chip-${row.id || row.unitId}`}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-black text-red-600"
                          >
                            {row.unitName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs font-bold text-slate-500">Dersi seçin ve sınava dahil edilecek bir veya birden fazla üniteyi işaretleyin. Konu/kazanım ayrıca seçilmez.</div>
                  )}
                </div>
              )}

              {examSource !== "Basılı Yayın" && (examType === "Ders Denemesi" || examType === "Branşlar Denemesi" || examType === "Konu Denemesi") && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-4">
                  <div className="rounded-2xl border border-indigo-100 bg-white/90 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Soru Planı</div>
                    <div className="mt-0.5 text-xs font-bold text-slate-700">
                      {selectedExamCourseIds.length > 1
                        ? "Önce dersi seçin; ardından o derse ait ünite, konu ve kazanım planını oluşturun."
                        : "Seçilen ders için ünite, konu ve kazanım planını oluşturun."}
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 gap-2 ${selectedExamCourseIds.length > 1 ? "xl:grid-cols-[1.15fr_1.2fr_1.2fr_1.6fr_105px_90px]" : "xl:grid-cols-[1.25fr_1.25fr_1.7fr_105px_90px]"} xl:items-end`}>
                    {(() => {
                      const course = availableBlueprintCourses.find((item: any) => String(item.id) === String(selectedExamCourseId));
                      const unit = course?.units?.find((item: any) => String(item.id) === String(blueprintDraft.unitId));
                      const topic = unit?.topics?.find((item: any) => String(item.id) === String(blueprintDraft.topicId));
                      const outcomes = topic?.outcomes || topic?.objectives || [];
                      return <>
                        {selectedExamCourseIds.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Ders</label>
                            <select
                              value={selectedExamCourseId}
                              onChange={(e) => activateBlueprintCourse(e.target.value)}
                              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold"
                            >
                              <option value="">Ders seçiniz</option>
                              {selectedExamCourses.map((selectedCourse: any) => (
                                <option key={`blueprint-course-${selectedCourse.id}`} value={selectedCourse.id}>
                                  {gradeLevel === "YKS" ? `${selectedCourse.grade}. Sınıf — ` : ""}{selectedCourse.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Ünite</label><select disabled={!course} value={blueprintDraft.unitId} onChange={(e) => setBlueprintDraft((d:any)=>({ ...d, unitId:e.target.value, topicId:"", outcomeId:"" }))} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold disabled:bg-slate-100"><option value="">Ünite seçiniz</option>{(course?.units||[]).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Konu</label><select disabled={!unit} value={blueprintDraft.topicId} onChange={(e) => setBlueprintDraft((d:any)=>({ ...d, topicId:e.target.value, outcomeId:e.target.value === "__ALL_TOPICS__" ? "" : "" }))} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold disabled:bg-slate-100"><option value="">Konu seçiniz</option><option value="__ALL_TOPICS__">Tüm Konular (Üniteden Sor)</option>{(unit?.topics||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Kazanım</label><select disabled={examType === "Konu Denemesi" || !topic || blueprintDraft.topicId === "__ALL_TOPICS__"} value={examType === "Konu Denemesi" ? "__ALL_OUTCOMES__" : blueprintDraft.outcomeId} onChange={(e) => setBlueprintDraft((d:any)=>({ ...d, outcomeId:e.target.value }))} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold disabled:bg-slate-100"><option value="">Kazanım seçiniz</option><option value="__ALL_OUTCOMES__">Tüm Kazanımlar (Konudan Sor)</option>{outcomes.map((o:any,i:number)=>{const id=String(typeof o==="string"?o:o?.id||o?.name||`outcome-${i}`); const name=String(typeof o==="string"?o:o?.name||o?.id||id); return <option key={id} value={id}>{name}</option>})}</select></div>
                      </>;
                    })()}
                    <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-wide text-slate-600">Soru Sayısı</label><input type="number" min="1" value={blueprintDraft.count} onChange={(e)=>setBlueprintDraft((d:any)=>({...d,count:Math.max(1,Number(e.target.value)||1)}))} className="w-full rounded-xl border-2 border-indigo-300 bg-white px-2 py-2.5 text-center text-sm font-black text-indigo-950" /></div>
                    <button type="button" onClick={addBlueprintDraftToList} disabled={!selectedExamCourseId || !blueprintDraft.unitId || !blueprintDraft.topicId || (blueprintDraft.topicId !== "__ALL_TOPICS__" && !blueprintDraft.outcomeId && examType !== "Konu Denemesi")} className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">+ Ekle</button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={addAllUnitsToBlueprint} disabled={!selectedExamCourseId} className="rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-xs font-black text-indigo-800 disabled:opacity-40">Seçilen Dersin Tüm Ünitelerini Ekle</button>
                    <span className="text-[10px] font-semibold text-slate-600">Tüm üniteler eklendiğinde her ünite için üstteki soru sayısı kullanılır; soru sayılarını daha sonra ayrı ayrı düzenleyebilirsiniz.</span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white">
                    {questionBlueprint.length === 0 ? <div className="px-4 py-7 text-center text-xs font-semibold text-slate-400">Üniteyi seçin; ünitenin tamamını, bir konunun tamamını veya belirli bir kazanımı seçip soru sayısını girerek <b>Ekle</b> butonuna basınız.</div> : (() => {
                      const grouped = questionBlueprint.reduce((acc:any[], row:any) => {
                        const key = `${row.grade || ""}__${row.subject}`;
                        let group = acc.find((g:any) => g.key === key);
                        if (!group) { group = { key, subject: row.subject, grade: row.grade, rows: [], total: 0 }; acc.push(group); }
                        group.rows.push(row);
                        group.total += Number(row.count || 0);
                        return acc;
                      }, []);
                      return <div className="divide-y divide-slate-200">{grouped.map((group:any) => <div key={group.key} className="px-4 py-3">
                        <div className="mb-2 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                          <div className="text-xs font-black text-rose-700">{gradeLevel === "YKS" && group.grade ? `${group.grade}. Sınıf · ` : ""}{group.subject} <span className="text-slate-900">({group.total} soru)</span></div>
                          {(() => {
                            const assignmentKey = `${group.grade || ""}__${group.subject}`;
                            const assigned = questionAssignments[assignmentKey];
                            const candidates = teachersForSubject(group.subject);
                            return <div className="flex flex-wrap items-center gap-2">
                              <select value={teacherSelectionBySubject[assignmentKey] || assigned?.teacherId || ""} onChange={(e)=>setTeacherSelectionBySubject((current)=>({...current,[assignmentKey]:e.target.value}))} className="min-w-[210px] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-slate-800">
                                <option value="">Öğretmen seçiniz</option>
                                {candidates.map((teacher:any)=><option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                              </select>
                              <button type="button" onClick={()=>assignTeacherToSubject(group.subject, group.grade)} className="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-amber-600">Öğretmeni Görevlendir</button>
                              {assigned ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700">Görevlendirildi: {assigned.teacherName}</span> : null}
                            </div>;
                          })()}
                        </div>
                        <div className="space-y-1">{group.rows.map((row:any, rowIndex:number) => <div key={row.id} className="grid grid-cols-[24px_1fr_auto] gap-2 items-center py-1">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-black text-indigo-700">{rowIndex + 1}</span>
                          <div className="min-w-0 text-[11px] font-semibold leading-5 text-slate-500">
                            <span>{row.unitName}</span>
                            {row.topicName ? <> → <span className={row.scopeType === "topic" ? "font-black text-slate-950" : ""}>{row.topicName}</span></> : null}
                            {row.outcomeName ? <> → <span className={row.scopeType === "outcome" ? "font-black text-slate-950" : ""}>{row.outcomeName}</span></> : null}
                            {editingBlueprintRowId === row.id ? (
                              <span className="ml-2 inline-flex items-center gap-1 align-middle">
                                <input type="number" min="1" value={editingBlueprintCount} onChange={(e)=>setEditingBlueprintCount(Math.max(1, Number(e.target.value)||1))} className="w-16 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-center text-[11px] font-black text-slate-900" />
                                <span className="text-slate-500">soru</span>
                              </span>
                            ) : <span className="font-black text-indigo-600"> ({row.count} soru)</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {editingBlueprintRowId === row.id ? <>
                              <button type="button" onClick={()=>saveBlueprintCountEdit(row.id)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100">Kaydet</button>
                              <button type="button" onClick={()=>setEditingBlueprintRowId(null)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-200">İptal</button>
                            </> : <button type="button" onClick={()=>startBlueprintCountEdit(row)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100">Düzenle</button>}
                            <button type="button" onClick={()=>removeBlueprintRow(row.id)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100">Sil</button>
                          </div>
                        </div>)}</div>
                      </div>)}</div>;
                    })()}
                  </div>
                </div>
              )}

              {/* Sınav Bölümleri ve Soru Sayısı */}
              {(examType === "TYT" || examType === "AYT") &&
                examStructure.length > 0 && (
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center justify-between">
                      <span>Sınav Soru Dağılımı ({examType})</span>
                      <span className="text-purple-700 bg-purple-100 px-2 py-1 rounded-lg text-[10px]">
                        Toplam Soru:{" "}
                        {examStructure.reduce(
                          (total, test) =>
                            total +
                            test.subjects.reduce(
                              (sum: number, sub: any) => sum + sub.count,
                              0,
                            ),
                          0,
                        )}
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {examStructure.map((test, testIndex) => (
                        <div
                          key={testIndex}
                          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                        >
                          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                            <h5 className="font-bold text-slate-700 text-xs">
                              {test.testName}
                            </h5>
                          </div>
                          <div className="p-3 space-y-2">
                            {test.subjects.map(
                              (subject: any, subjectIndex: number) => (
                                <div
                                  key={subjectIndex}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-xs font-medium text-slate-600 truncate mr-2">
                                    {subject.name}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={subject.count}
                                    onChange={(e) =>
                                      handleSubjectCountChange(
                                        testIndex,
                                        subjectIndex,
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-sm transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || examSavePending}
                  className={`flex-1 py-3.5 font-bold rounded-xl text-sm transition-colors ${
                    isFormValid && !examSavePending
                      ? "bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {examSavePending ? "Sunucuya Kaydediliyor…" : editingExamId ? "Sınavı Güncelle" : "Sınavı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOpticDetailsOpen && opticDraft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-violet-950 px-6 py-5 text-white">
              <div>
                <h3 className="text-lg font-black">Optik Bilgileri</h3>
                <p className="mt-1 text-xs font-semibold text-violet-200">
                  {managingExam?.publisherName ? `${managingExam.publisherName} - ` : ""}{managingExam?.examName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpticDetailsOpen(false)}
                className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Optik adı</label>
                  <input
                    value={opticDraft.name || ""}
                    onChange={(e) => setOpticDraft({ ...opticDraft, name: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Sınav türü</label>
                  <select
                    value={normalizeExamTypeValue(opticDraft.examKind || managingExam?.examType || "TYT")}
                    onChange={(e) => setOpticDraft({ ...opticDraft, examKind: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="TYT">TYT</option>
                    <option value="AYT">AYT</option>
                    <option value="Ders Denemesi">Ders Denemesi</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800">Optik alanları</h4>
                  <p className="text-xs font-semibold text-slate-500">Alan adını ve sütun bilgilerini doğrudan düzenleyebilirsiniz.</p>
                </div>
                <button
                  type="button"
                  onClick={addOpticDraftField}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-100 px-3 py-2 text-xs font-black text-violet-800 hover:bg-violet-200"
                >
                  <Plus className="h-4 w-4" /> Alan Ekle
                </button>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Alan adı</th>
                      <th className="px-3 py-3">Başlangıç sütunu</th>
                      <th className="px-3 py-3">Sütun sayısı</th>
                      <th className="px-3 py-3">Yön</th>
                      <th className="px-3 py-3">Karakterler</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(opticDraft.fields || []).map((field: any, index: number) => (
                      <tr key={field.id || index} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <input
                            value={field.fieldName || ""}
                            onChange={(e) => updateOpticDraftField(index, "fieldName", e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={field.columnStart || ""}
                            onChange={(e) => updateOpticDraftField(index, "columnStart", e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-28 rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={field.columnCount || ""}
                            onChange={(e) => updateOpticDraftField(index, "columnCount", e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-28 rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={field.direction || "Dikey"}
                            onChange={(e) => updateOpticDraftField(index, "direction", e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          >
                            <option value="Dikey">Dikey</option>
                            <option value="Yatay">Yatay</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={field.optionSet || ""}
                            onChange={(e) => updateOpticDraftField(index, "optionSet", e.target.value)}
                            className="w-32 rounded-xl border border-slate-200 px-3 py-2 font-bold"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeOpticDraftField(index)}
                            className="rounded-lg bg-rose-50 px-3 py-2 font-black text-rose-600 hover:bg-rose-100"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(opticDraft.fields || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center font-semibold text-slate-400">Tanımlı optik alan bulunmuyor.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsOpticDetailsOpen(false)}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={saveOpticDetails}
                className="rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white hover:bg-violet-800"
              >
                Optiği Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
