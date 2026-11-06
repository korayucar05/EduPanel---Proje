import { parseQuestionGroupFileName } from "../utils/questionUploadFileName";
import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  Image as ImageIcon,
  X,
  CheckCircle2,
  FolderOpen,
  ListChecks,
  ListTree,
  BookOpen,
  Download,
  Send,
  FileText,
  Eye,
  Trash2,
  AlertTriangle,
  Save,
  Plus,
  BarChart2,
  Sparkles,
  Lightbulb,
  Lock,
  Unlock,
  Link2
} from "lucide-react";
import { fetchCollectionFromLocalDatabase, listQuestionBankRecords, upsertLocalDocument } from "../lib/localDatabase";
import { buildQuestionBookletPdfDefinition, downloadAnswerKeyPdf, downloadQuestionBookletPdf, PdfEngine, type BookletCurriculumSummaryItem, type BookletLayoutPage, type BookletLayoutQuestion, type BookletPdfInput } from "../pdf";
import { getAnswerFromQuestionFileName, getQuestionCorrectAnswer } from "../utils/questionAnswer";
import { evaluateExamRecords } from "../modules/exam/ExamPipelineService";
import {
  CURRICULUM_UPDATED_EVENT,
  loadAuthoritativeCurriculumStore,
  readLegacyCurriculumStore,
  resolveCurriculumEntry,
} from "../services/curriculumRepository";

const hasCompleteClassInfo = (record: any) => {
  const value = String(record?.gradeLevel || "").trim();
  const hasGrade = /\d+/.test(value);
  const hasSection = Boolean(String(record?.section || "").trim()) || /\d+\s*[-/ ]?\s*[A-Za-zÇĞİÖŞÜçğıöşü]+/.test(value);
  return hasGrade && hasSection;
};

// Helper to read/compress file as data URL
const readAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const getQuestionIndexForBooklet = (bookletName: string, i: number, count: number) => {
  const norm = bookletName.toUpperCase().trim();
  if (norm === "B") {
    return count - 1 - i;
  }
  if (norm === "C") {
    return (i + Math.floor(count / 2)) % count;
  }
  if (norm === "D") {
    return count - 1 - ((i + Math.floor(count / 3)) % count);
  }
  return i; // A (and other/default) booklet is normal order
};

const getAutomaticBookletQuestionNumber = (bookletName: string, originalIndex: number, count: number) => {
  const norm = bookletName.toUpperCase().trim();
  if (norm === "A") return originalIndex + 1;
  for (let printedIndex = 0; printedIndex < count; printedIndex += 1) {
    if (getQuestionIndexForBooklet(norm, printedIndex, count) === originalIndex) {
      return printedIndex + 1;
    }
  }
  return originalIndex + 1;
};

const getPrintedPublicationAQuestionNumberFromFileName = (fileName: string) => {
  const stem = fileNameGroupStemOf(fileName);
  const match = stem.match(/^0*(\d+)(?:$|[_\-\s])/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const getPrintedQuestionIndex = (exam: any, bookletKey: string, targetNum1Based: number, subjectName: string, count: number) => {
  const normBookletKey = bookletKey.toUpperCase().trim();
  const subjectQuestions = exam.questions?.[subjectName] || {};
  
  for (let originalIdx = 0; originalIdx < count; originalIdx++) {
    const q = subjectQuestions[originalIdx];
    if (q) {
      const savedNum = q.bookletNumbers?.[normBookletKey];
      if (savedNum !== undefined && savedNum !== null && savedNum !== "") {
        if (Number(savedNum) === targetNum1Based) {
          return originalIdx;
        }
      }
    }
  }
  
  return getQuestionIndexForBooklet(normBookletKey, targetNum1Based - 1, count);
};

const fileNameGroupStemOf = (value: any) => {
  let source = String(value || "").trim();
  if (!source) return "";
  source = source.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  try { source = decodeURIComponent(source); } catch {}
  source = source.split("/").filter(Boolean).pop() || source;
  return source.replace(/\.[^.]+$/, "").trim();
};

const fileNameGroupPartsFromValue = (value: any) => {
  const modern = parseQuestionGroupFileName(value);
  if (modern) return { token: modern.token, order: modern.order };
  const stem = fileNameGroupStemOf(value);
  if (!stem) return null;

  // Grup dosya adının kaynak gerçeği: ..._<sıra>_<Gxx>[_A-E]...
  // Cevap harfinden sonra eski kopya/ek ibareleri bulunsa bile grup bilgisi korunur.
  const matches = Array.from(stem.matchAll(/(?:^|_)(\d+)_(G[A-Z0-9]+)(?:_([A-E]))?(?=_|$)/gi));
  const match = matches.length ? matches[matches.length - 1] : null;
  if (!match) return null;
  return {
    token: String(match[2] || "").toUpperCase(),
    order: Math.max(0, Number(match[1] || 0)),
  };
};

const fileNameGroupPartsOf = (question: any) => {
  const candidates = [
    question?.originalFileName,
    question?.original_file_name,
    question?.fileName,
    question?.file_name,
    question?.questionCode,
    question?.question_code,
    question?.code,
    // Eski sınav kayıtlarında dosya adı ayrı alan olarak kalmamış olabilir.
    // Bu durumda fiziksel dosya yolunun basename'i aynı Gxx kuralını taşır.
    question?.storagePath,
    question?.storage_path,
    question?.imageUrl,
    question?.image_url,
    question?.thumbnailUrl,
    question?.thumbnail_url,
  ];
  for (const candidate of candidates) {
    const parsed = fileNameGroupPartsFromValue(candidate);
    if (parsed) return parsed;
  }
  return null;
};

const questionGroupIdOf = (question: any) => {
  const explicit = String(question?.questionGroupId || question?.groupId || "").trim();
  if (explicit) return explicit;
  const parsed = fileNameGroupPartsOf(question);
  if (!parsed?.token) return "";
  const scope = [
    question?.systemCourseId || question?.courseId || question?.course_id || "",
    question?.systemUnitId || question?.unitId || question?.unit_id || "",
    question?.systemTopicId || question?.topicId || question?.topic_id || "",
    question?.systemOutcomeId || question?.outcomeId || question?.outcome_id || "",
  ].map((value) => String(value || "").trim()).join(":");
  return `filename-group-fallback:${scope}:${parsed.token}`;
};
type QuestionGroupLayout = "normal" | "full-width-source";
const questionGroupModeOf = (question: any): "required" | "free" =>
  String(question?.questionGroupMode || question?.groupMode || "required").toLowerCase() === "free" ? "free" : "required";
const questionGroupLayoutOf = (question: any): QuestionGroupLayout =>
  String(question?.questionGroupLayout || question?.groupLayout || "normal").toLowerCase() === "full-width-source"
    ? "full-width-source"
    : "normal";
const questionGroupOrderOf = (question: any) => {
  const parsed = fileNameGroupPartsOf(question);
  const explicitGroupId = String(question?.questionGroupId || question?.groupId || "").trim();

  // Gxx ile isimlendirilmiş gruplarda sıra bilgisinin tek kaynağı DOSYA ADIDIR.
  // Eski kayıtlarda questionGroupOrder alanı 1,2,3... olarak kalmış olsa bile
  // bu değer PDF sırasını değiştiremez. Gruptaki en küçük dosya numarası öncüldür.
  if (parsed && (!explicitGroupId || isFileNameQuestionGroup(explicitGroupId))) {
    return Math.max(0, Number(parsed.order || 0));
  }

  const explicit = question?.questionGroupOrder ?? question?.groupOrder;
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return Math.max(0, Number(explicit || 0));
  }
  return Math.max(0, Number(parsed?.order || 0));
};
const questionGroupSizeOf = (question: any) => Math.max(0, Number(question?.questionGroupSize ?? question?.groupSize ?? 0));
const questionGroupTitleOf = (question: any) => String(question?.questionGroupTitle || question?.groupTitle || "").trim();
const questionGroupInstructionTextOf = (question: any) =>
  String(question?.questionGroupInstructionText || question?.groupInstructionText || "").trim();
const questionGroupInstructionImageOf = (question: any) =>
  String(question?.questionGroupInstructionImageUrl || question?.groupInstructionImageUrl || "").trim();

const legacyGroupLeaderSourceIndex = (rows: Array<{ sourceIndex: number; question: Record<string, unknown> }>, groupId: string): number | undefined => {
  if (!isFileNameQuestionGroup(groupId) || rows.length < 2) return undefined;
  if (rows.some((row) => questionGroupInstructionImageOf(row.question))) return undefined;
  const modernRows = rows.map((row) => ({ row, info: [row.question.fileName, row.question.questionCode, row.question.imageUrl].map(parseQuestionGroupFileName).find(Boolean) }));
  if (modernRows.some(({ info }) => info)) {
    return modernRows.find(({ info }) => info?.isInstruction)?.row.sourceIndex;
  }
  return [...rows].sort((left, right) =>
    questionGroupOrderOf(left.question) - questionGroupOrderOf(right.question) || left.sourceIndex - right.sourceIndex,
  )[0]?.sourceIndex;
};

type FileNameQuestionGroupInfo = {
  token: string;
  order: number;
  isInstruction: boolean;
};

const questionGroupInfoFromFileName = (fileName: string): FileNameQuestionGroupInfo | null => {
  const modern = parseQuestionGroupFileName(fileName);
  if (modern) return modern;
  const stem = fileNameGroupStemOf(fileName);
  if (!stem) return null;

  const instructionMatch = stem.match(/(?:^|_)(G[A-Z0-9]+)_METIN(?=_|$)/i);
  if (instructionMatch) {
    return { token: instructionMatch[1].toUpperCase(), order: 0, isInstruction: true };
  }

  const parsed = fileNameGroupPartsFromValue(stem);
  if (!parsed) return null;
  return {
    token: parsed.token,
    order: Math.max(1, Number(parsed.order || 1)),
    isInstruction: false,
  };
};

const isFileNameQuestionGroup = (groupId: string) => {
  const value = String(groupId || "").trim();
  return value.startsWith("filename-group:") || value.startsWith("filename-group-fallback:");
};

const questionGroupTokenOf = (question: any) => {
  const parsed = fileNameGroupPartsOf(question);
  if (parsed?.token) return parsed.token;
  const groupId = questionGroupIdOf(question);
  if (!isFileNameQuestionGroup(groupId)) return "";
  const parts = groupId.split(":").map((value) => value.trim()).filter(Boolean);
  const token = parts[parts.length - 1] || "";
  return /^G[A-Z0-9]+$/i.test(token) ? token.toUpperCase() : "";
};

const clearQuestionGroupMetadata = (question: any) => {
  const next = { ...(question || {}) };
  [
    "questionGroupId", "groupId", "questionGroupMode", "groupMode",
    "questionGroupLayout", "groupLayout",
    "questionGroupOrder", "groupOrder", "questionGroupSize", "groupSize",
    "questionGroupTitle", "groupTitle",
    "questionGroupInstructionText", "groupInstructionText",
    "questionGroupInstructionImageUrl", "groupInstructionImageUrl",
  ].forEach((key) => delete next[key]);
  return next;
};

const applyQuestionGroupMetadata = (
  question: any,
  input: { id: string; mode: "required" | "free"; layout: QuestionGroupLayout; order: number; size: number; title?: string; instructionText?: string; instructionImageUrl?: string },
) => ({
  ...(question || {}),
  questionGroupId: input.id,
  questionGroupMode: input.mode,
  questionGroupLayout: input.layout,
  questionGroupOrder: input.order,
  questionGroupSize: input.size,
  questionGroupTitle: input.title || "",
  questionGroupInstructionText: input.instructionText || "",
  questionGroupInstructionImageUrl: input.instructionImageUrl || "",
});

const placeQuestionGroupMembersContiguously = (subjectQuestions: any, groupId: string) => {
  const source = subjectQuestions || {};
  const populatedSlots = Object.keys(source)
    .map(Number)
    .filter((index) => Number.isFinite(index) && Boolean(source?.[index]?.imageUrl))
    .sort((a, b) => a - b);
  const orderedQuestions = populatedSlots.map((index) => source[index]);
  const grouped = orderedQuestions
    .filter((question) => questionGroupIdOf(question) === groupId)
    .sort((a, b) => questionGroupOrderOf(a) - questionGroupOrderOf(b));
  if (grouped.length < 2) return source;

  const firstGroupPosition = orderedQuestions.findIndex((question) => questionGroupIdOf(question) === groupId);
  if (firstGroupPosition < 0) return source;
  const remaining = orderedQuestions.filter((question) => questionGroupIdOf(question) !== groupId);
  const beforeCount = orderedQuestions
    .slice(0, firstGroupPosition)
    .filter((question) => questionGroupIdOf(question) !== groupId).length;
  const reordered = [
    ...remaining.slice(0, beforeCount),
    ...grouped,
    ...remaining.slice(beforeCount),
  ];
  const next = { ...source };
  populatedSlots.forEach((slot, position) => {
    next[slot] = reordered[position];
  });
  return next;
};

const groupedQuestionSourceOrder = (rawIndices: number[], sourceQuestions: any) => {
  const valid = rawIndices.filter((index) => Number.isFinite(index));
  const validSet = new Set(valid);
  const membersByGroup = new Map<string, number[]>();
  valid.forEach((index) => {
    const question = sourceQuestions?.[index];
    const groupId = questionGroupIdOf(question);
    if (!groupId) return;
    const members = membersByGroup.get(groupId) || [];
    members.push(index);
    membersByGroup.set(groupId, members);
  });
  membersByGroup.forEach((members, groupId) => {
    const all = Object.keys(sourceQuestions || {})
      .map(Number)
      .filter((index) => Number.isFinite(index) && validSet.has(index) && questionGroupIdOf(sourceQuestions?.[index]) === groupId)
      .sort((a, b) => questionGroupOrderOf(sourceQuestions?.[a]) - questionGroupOrderOf(sourceQuestions?.[b]) || a - b);
    membersByGroup.set(groupId, all);
  });

  const seenGroups = new Set<string>();
  const seenIndices = new Set<number>();
  const output: number[] = [];
  valid.forEach((index) => {
    if (seenIndices.has(index)) return;
    const question = sourceQuestions?.[index];
    const groupId = questionGroupIdOf(question);
    if (!groupId) {
      output.push(index);
      seenIndices.add(index);
      return;
    }
    if (seenGroups.has(groupId)) return;
    seenGroups.add(groupId);
    (membersByGroup.get(groupId) || [index]).forEach((memberIndex) => {
      if (!seenIndices.has(memberIndex)) {
        output.push(memberIndex);
        seenIndices.add(memberIndex);
      }
    });
  });
  valid.forEach((index) => {
    if (!seenIndices.has(index)) output.push(index);
  });
  return output;
};

const groupQuestionRowsContiguously = (rows: any[]) => {
  const output: any[] = [];
  const handledGroups = new Set<string>();
  rows.forEach((question) => {
    const groupId = questionGroupIdOf(question);
    if (!groupId) {
      output.push(question);
      return;
    }
    if (handledGroups.has(groupId)) return;
    handledGroups.add(groupId);
    const members = rows
      .filter((row) => questionGroupIdOf(row) === groupId)
      .sort((a, b) => questionGroupOrderOf(a) - questionGroupOrderOf(b));
    output.push(...members);
  });
  return output;
};

const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
};

// pdfmake cannot embed an application-relative image path such as
// "api/question-bank/files/...jpg" directly. The browser <img> can render it,
// but pdfmake treats that string as an image-dictionary key and throws
// "Invalid image ... not found in virtual file system". Convert server-backed
// question images to data URLs before they enter the booklet definition.
const toPdfImageDataUrl = async (source: string): Promise<string> => {
  const value = String(source || "").trim();
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return value;

  let fetchUrl = value;
  if (!/^(https?:)?\/\//i.test(fetchUrl)) {
    fetchUrl = `/${fetchUrl.replace(/^\/+/, "")}`;
  }

  const response = await fetch(fetchUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Soru görseli alınamadı (${response.status}): ${fetchUrl}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error(`Soru dosyası görsel değil: ${fetchUrl}`);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Soru görseli okunamadı."));
    reader.readAsDataURL(blob);
  });
};



export default function QuestionManagerView({
  exam,
  onBack,
  onUpdateExam,
  onEvaluationComplete,
  allExams = [],
  activeTab = "questions",
  getTeachersForSubject,
  onAssignQuestionTeacher,
  onClearQuestionTeacher,
  readEditOpticSelector,
}: any) {
  const [activeTestIndex, setActiveTestIndex] = useState(0);
  const [activeSubjectIndex, setActiveSubjectIndex] = useState(0);
  // Müfredat başka ekranda güncellendiğinde bu görünümün localStorage'daki
  // en yeni ağacı yeniden okumasını sağlar.
  const [curriculumStorageRevision, setCurriculumStorageRevision] = useState(0);
  const [authoritativeCurriculumStore, setAuthoritativeCurriculumStore] =
    useState<Record<string, any>>(() => readLegacyCurriculumStore());

  // Sınav Hazırla artık localStorage/SQLite kopyalarından müfredat seçmez.
  // Sunucudaki courseCurriculums koleksiyonu tek kaynaktır; yerel kayıt yalnız
  // ilk geçişte sunucu boşsa bir defalık migration için kullanılır.
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const refreshCurriculum = async (migrateLegacy = false) => {
      if (busy) return;
      busy = true;
      try {
        const store = await loadAuthoritativeCurriculumStore({ migrateLegacy });
        if (!cancelled) {
          setAuthoritativeCurriculumStore((current) =>
            JSON.stringify(current) === JSON.stringify(store) ? current : store,
          );
          setCurriculumStorageRevision((value) => value + 1);
        }
      } catch (error) {
        console.warn("Canlı müfredat verisi sınav ekranında okunamadı", error);
      } finally {
        busy = false;
      }
    };

    void refreshCurriculum(true);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "course_curriculums_v1") void refreshCurriculum(false);
    };
    const onFocus = () => { void refreshCurriculum(false); };
    const onVisibility = () => { if (!document.hidden) void refreshCurriculum(false); };
    const onCurriculumEvent = () => { void refreshCurriculum(false); };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(CURRICULUM_UPDATED_EVENT, onCurriculumEvent as EventListener);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CURRICULUM_UPDATED_EVENT, onCurriculumEvent as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // States for Student Optical TXT File Imports ("Eksiklikleri Tamamla")
  const [studentRecords, setStudentRecords] = useState<any[]>(exam.studentTxtRecords || []);
  const [showAppendOrReplaceModal, setShowAppendOrReplaceModal] = useState<any[] | null>(null);
  const [txtUploadOption, setTxtUploadOption] = useState<"replace" | "append" | null>("replace");
  const [showDeficienciesDropdown, setShowDeficienciesDropdown] = useState(false);
  const [filterErrorType, setFilterErrorType] = useState<"Tüm" | "Kitapçık" | "Öğrenci No" | "Sınıf">("Tüm");
  const [evaluateOption, setEvaluateOption] = useState<"new" | "all" | null>(null);
  const [showEvaluateSuccessModal, setShowEvaluateSuccessModal] = useState(false);
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [selectedStudentRecords, setSelectedStudentRecords] = useState<string[]>([]);
  const [openStudentCorrectionId, setOpenStudentCorrectionId] = useState<string | null>(null);
  const txtFileInputRef = useRef<HTMLInputElement>(null);

  const [allStudents, setAllStudents] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;

    const loadRegisteredStudents = async () => {
      try {
        const currentRows = await fetchCollectionFromLocalDatabase("students");
        if (!cancelled && Array.isArray(currentRows) && currentRows.length > 0) {
          setAllStudents(currentRows);
          return;
        }
      } catch (error) {
        console.warn("Güncel öğrenci veritabanı sınav okuma ekranında okunamadı.", error);
      }

      try {
        const lf = await import("../lib/localDatabaseForage");
        const saved: any = await lf.default.getItem("school_students");
        if (!cancelled && Array.isArray(saved) && saved.length > 0) {
          setAllStudents(saved);
          return;
        }
      } catch {}

      try {
        const ls = localStorage.getItem("school_students");
        const parsed = ls ? JSON.parse(ls) : [];
        if (!cancelled && Array.isArray(parsed)) setAllStudents(parsed);
      } catch {}
    };

    void loadRegisteredStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeTurkish = (str: string) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .trim();
  };

  const getSmartSuggestionsForStudent = (name: string) => {
    if (!name || name.trim().length < 2) return [];
    const normalizedSearch = normalizeTurkish(name);
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
    if (searchWords.length === 0) return [];

    return allStudents
      .map((student: any) => {
        const normalizedRegName = normalizeTurkish(getSystemStudentName(student));
        const regWords = normalizedRegName.split(/\s+/);
        
        let score = 0;
        if (normalizedRegName === normalizedSearch) {
          score += 100;
        } else if (normalizedRegName.includes(normalizedSearch) || normalizedSearch.includes(normalizedRegName)) {
          score += 50;
        }

        searchWords.forEach(sWord => {
          regWords.forEach(rWord => {
            if (rWord === sWord) {
              score += 20;
            } else if (rWord.includes(sWord) || sWord.includes(rWord)) {
              score += 5;
            }
          });
        });

        return { student, score };
      })
      .filter((item: any) => item.score > 20)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((item: any) => item.student);
  };

  const normalizeIdentityText = (value: any) => {
    const compact = normalizeTurkish(String(value || ""))
      .replace(/[^a-z0-9]/g, "");
    if (!compact) return "";
    return /^\d+$/.test(compact)
      ? compact.replace(/^0+/, "") || "0"
      : compact;
  };

  const getExplicitSystemStudentNumber = (student: any) => {
    const candidates = [
      student?.studentNumber,
      student?.studentNo,
      student?.schoolNumber,
      student?.schoolNo,
      student?.number,
      student?.okulNo,
      student?.ogrenciNo,
      student?.["öğrenciNo"],
      student?.numara,
    ];
    return candidates
      .map((value) => String(value ?? "").trim())
      .find(Boolean) || "";
  };

  const getSystemStudentNumber = (student: any) =>
    getExplicitSystemStudentNumber(student) || String(student?.id ?? "").trim();

  const getSystemStudentName = (student: any) =>
    String(
      student?.name ||
      student?.fullName ||
      [student?.firstName, student?.lastName].filter(Boolean).join(" ") ||
      "",
    ).trim();

  const getSystemStudentClass = (student: any) =>
    String(
      student?.classroom ||
      student?.gradeLevel ||
      student?.className ||
      [student?.grade, student?.section].filter(Boolean).join(" ") ||
      "",
    ).trim();

  const getExamBookletKeys = () => {
    const keys = String(exam?.bookletType || "A")
      .split(/[-,;/]+/)
      .map((value) => value.trim().toLocaleUpperCase("tr-TR"))
      .filter(Boolean);
    return keys.length > 0 ? keys : ["A"];
  };

  const getDefaultBookletType = () => {
    const keys = getExamBookletKeys();
    return keys.length === 1 ? keys[0] : "";
  };

  const extractGradeAndSection = (value: any) => {
    const raw = String(value || "").trim();
    const gradeMatch = raw.match(/\b(9|10|11|12)\b/);
    const compact = normalizeTurkish(raw).replace(/[^a-z0-9]/g, "");
    const sectionMatch = compact.match(/(?:9|10|11|12)([a-z]+)/);

    return {
      grade: gradeMatch?.[1] || "",
      section: sectionMatch?.[1] || "",
    };
  };

  const getExamGrade = () => {
    const raw = String(exam?.gradeLevel || "").trim();
    if (raw.toLocaleUpperCase("tr-TR") === "YKS") return "12";
    return raw.match(/\b(9|10|11|12)\b/)?.[1] || "";
  };

  const findSystemStudentForRecord = (record: any) => {
    const recordNumber = normalizeIdentityText(record?.studentNumber);
    if (!recordNumber) return null;

    // Önce gerçek okul numarası alanlarında TAM eşleşme aranır.
    // Veritabanı belge kimliği öğrenci numarası olarak değerlendirilmez.
    const explicitMatches = allStudents.filter((student: any) => {
      const systemNumber = normalizeIdentityText(getExplicitSystemStudentNumber(student));
      return Boolean(systemNumber && systemNumber === recordNumber);
    });
    if (explicitMatches.length === 1) return explicitMatches[0];
    if (explicitMatches.length > 1) return null;

    // Yalnız çok eski kayıtlarda açık okul numarası alanı hiç yoksa `id`
    // geriye dönük uyumluluk için son çare olarak kullanılabilir.
    const legacyMatches = allStudents.filter((student: any) => {
      if (getExplicitSystemStudentNumber(student)) return false;
      const systemNumber = normalizeIdentityText(student?.id);
      return Boolean(systemNumber && systemNumber === recordNumber);
    });
    return legacyMatches.length === 1 ? legacyMatches[0] : null;
  };

  const enrichRecordFromSystem = (record: any) => {
    const systemStudent = findSystemStudentForRecord(record);
    if (!systemStudent) return record;

    const systemName = getSystemStudentName(systemStudent);
    const systemClass = getSystemStudentClass(systemStudent);
    const defaultBooklet = getDefaultBookletType();

    return {
      ...record,
      studentName: String(record?.studentName || "").trim() || systemName,
      gradeLevel: String(record?.gradeLevel || "").trim() || systemClass,
      bookletType:
        String(record?.bookletType || "").trim().toLocaleUpperCase("tr-TR") ||
        defaultBooklet,
      matchedSystemStudentId: getSystemStudentNumber(systemStudent),
      systemMatched: true,
    };
  };

  const getRecordValidation = (record: any) => {
    const reasons: string[] = [];
    const recordNumber = normalizeIdentityText(record?.studentNumber);
    const bookletType = String(record?.bookletType || "").trim();
    const systemStudent = findSystemStudentForRecord(record);

    // Optik kaydında öğrenciyi yalnız okul numarasıyla tanıyoruz.
    // Ad-soyad, sınıf ve şube yazımı doğrulama hatası oluşturmaz.
    if (!recordNumber) {
      reasons.push("Öğrenci numarası boş bırakılamaz.");
    } else if (allStudents.length > 0 && !systemStudent) {
      reasons.push("Öğrenci numarası sistemde kayıtlı bir öğrenciyle eşleşmiyor.");
    }

    if (!bookletType) {
      reasons.push("Kitapçık türü boş bırakılamaz.");
    }

    return {
      hasMismatch: reasons.length > 0,
      reasons,
    };
  };

  const getUsedSystemStudentNumbers = (excludeRecordId?: string) => {
    const used = new Set<string>();
    studentRecords.forEach((record) => {
      if (record?.id === excludeRecordId) return;
      const matched = findSystemStudentForRecord(record);
      if (!matched) return;
      const number = normalizeIdentityText(getSystemStudentNumber(matched));
      if (number) used.add(number);
    });
    return used;
  };

  const getAvailableStudentCorrectionOptions = (record: any) => {
    const usedNumbers = getUsedSystemStudentNumbers(record?.id);
    const wantedName = normalizeTurkish(String(record?.studentName || ""));
    const wantedClass = normalizeTurkish(String(record?.gradeLevel || ""));
    const wantedWords = wantedName.split(/\s+/).filter((word) => word.length > 1);

    return allStudents
      .map((student: any) => {
        const number = getExplicitSystemStudentNumber(student);
        const normalizedNumber = normalizeIdentityText(number);
        if (!number || !normalizedNumber || usedNumbers.has(normalizedNumber)) return null;

        const name = getSystemStudentName(student);
        const classroom = getSystemStudentClass(student);
        const normalizedName = normalizeTurkish(name);
        const normalizedClass = normalizeTurkish(classroom);
        const nameWords = normalizedName.split(/\s+/).filter(Boolean);
        let score = 0;

        if (wantedName && normalizedName === wantedName) score += 300;
        else if (wantedName && (normalizedName.includes(wantedName) || wantedName.includes(normalizedName))) score += 140;

        wantedWords.forEach((wantedWord) => {
          nameWords.forEach((nameWord) => {
            if (wantedWord === nameWord) score += 45;
            else if (wantedWord.includes(nameWord) || nameWord.includes(wantedWord)) score += 12;
          });
        });

        if (wantedClass && normalizedClass === wantedClass) score += 80;
        else if (wantedClass && normalizedClass && (normalizedClass.includes(wantedClass) || wantedClass.includes(normalizedClass))) score += 30;

        return { student, number, name, classroom, score };
      })
      .filter(Boolean)
      .sort((left: any, right: any) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.number).localeCompare(String(right.number), "tr", { numeric: true });
      })
      .slice(0, 12);
  };

  const applySystemStudentCorrection = (recordId: string, student: any) => {
    const number = getExplicitSystemStudentNumber(student);
    const name = getSystemStudentName(student);
    const classroom = getSystemStudentClass(student);
    setStudentRecords((current) => current.map((record) =>
      record.id === recordId
        ? {
            ...record,
            studentNumber: number,
            studentName: name || record.studentName,
            gradeLevel: classroom || record.gradeLevel,
            matchedSystemStudentId: number,
            systemMatched: true,
          }
        : record,
    ));
    setOpenStudentCorrectionId(null);
    showToast(`${name || number} öğrenci bilgileri satıra uygulandı.`);
  };

  const getStudentRecordConflicts = (records: any[]) => {
    const numberCounts = new Map<string, number>();
    records.forEach((record) => {
      const key = normalizeIdentityText(record?.studentNumber);
      if (key) numberCounts.set(key, (numberCounts.get(key) || 0) + 1);
    });

    return records.flatMap((record) => {
      const reasons = [...getRecordValidation(record).reasons];
      const key = normalizeIdentityText(record?.studentNumber);
      if (key && (numberCounts.get(key) || 0) > 1) {
        reasons.push("Aynı öğrenci numarası birden fazla optik kaydında bulunuyor.");
      }
      return reasons.length > 0
        ? [{ recordId: record.id, studentNumber: record.studentNumber, reasons }]
        : [];
    });
  };

  React.useEffect(() => {
    setStudentRecords(exam.studentTxtRecords || []);
  }, [exam.id, exam.studentTxtRecords]);

  React.useEffect(() => {
    if (allStudents.length === 0) return;
    setStudentRecords((current) => {
      let changed = false;
      const next = current.map((record) => {
        const enriched = enrichRecordFromSystem(record);
        if (
          enriched.studentName !== record.studentName ||
          enriched.gradeLevel !== record.gradeLevel ||
          enriched.bookletType !== record.bookletType ||
          enriched.systemMatched !== record.systemMatched ||
          enriched.matchedSystemStudentId !== record.matchedSystemStudentId
        ) changed = true;
        return enriched;
      });
      return changed ? next : current;
    });
  }, [allStudents]);

  // Selected question for modal: { testIndex, subjectIndex, questionIndex }
  const [activeQuestion, setActiveQuestion] = useState<any | null>(null);
  // Soru kartı önizlemesi: Soru 1 / Soru 2 ... kartlarına tıklanınca açılır.
  // Bu durum müfredat düzenleme için kullanılan activeQuestion'dan bilinçli olarak ayrıdır.
  const [questionPreviewIndex, setQuestionPreviewIndex] = useState<number | null>(null);
  const [showAnswerKeyEntryModal, setShowAnswerKeyEntryModal] = useState(false);
  const [answerKeyExcelLoading, setAnswerKeyExcelLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const answerKeyExcelInputRef = useRef<HTMLInputElement>(null);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [questionBank, setQuestionBank] = useState<Record<string, string[]>>({});
  

  
  const [showTeacherMessageModal, setShowTeacherMessageModal] = useState(false);
  const [showNotification, setShowNotification] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [systemQuestionModalOpen, setSystemQuestionModalOpen] = useState(false);
  const [systemQuestions, setSystemQuestions] = useState<any[]>([]);
  const [selectedSystemQuestionIds, setSelectedSystemQuestionIds] = useState<Set<string>>(new Set());
  const [systemQuestionsLoading, setSystemQuestionsLoading] = useState(false);
  const [systemUnitId, setSystemUnitId] = useState<string>("");
  const [systemTopicId, setSystemTopicId] = useState<string>("");
  const [systemOutcomeId, setSystemOutcomeId] = useState<string>("");
  const [systemQuestionViewerIndex, setSystemQuestionViewerIndex] = useState(0);

  const [questionGroupSelectionMode, setQuestionGroupSelectionMode] = useState(false);
  const [questionGroupSelectedIndices, setQuestionGroupSelectedIndices] = useState<Set<number>>(new Set());
  const [questionGroupEditorOpen, setQuestionGroupEditorOpen] = useState(false);
  const [questionGroupEditingId, setQuestionGroupEditingId] = useState("");
  const [questionGroupDraft, setQuestionGroupDraft] = useState<{
    title: string;
    instructionText: string;
    instructionImageUrl: string;
    mode: "required" | "free";
    layout: QuestionGroupLayout;
  }>({ title: "", instructionText: "", instructionImageUrl: "", mode: "required", layout: "normal" });
  const questionGroupImageInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => {
      setShowNotification("");
    }, 3000);
  };

  // Soru cevapları ve müfredat seçimleri yalnız React state içinde kalmaz.
  // Her değişiklik sınav belgesine doğrudan, sıralı biçimde SQLite'a yazılır.
  // Böylece kullanıcı seçimden hemen sonra sayfayı yenilese bile son onaylı
  // soru metadatası tarayıcı state'ine bağlı kalmaz.
  const latestExamRef = useRef<any>(exam);
  const questionMetadataWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    latestExamRef.current = exam;
  }, [exam]);

  const persistQuestionMetadataExam = async (nextExam: any) => {
    const examId = String(nextExam?.id || "").trim();
    const revision = Date.now();
    const persistedExam = {
      ...nextExam,
      questionDataRevision: Math.max(
        revision,
        Number(nextExam?.questionDataRevision || 0) + 1,
      ),
      questionDataUpdatedAt: new Date(revision).toISOString(),
    };

    // Parent state + localStorage güncellemesi beklemeden görünümü güncel tutar.
    latestExamRef.current = persistedExam;
    onUpdateExam(persistedExam);

    if (!examId) return persistedExam;

    const snapshot = JSON.parse(JSON.stringify(persistedExam));
    const write = questionMetadataWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await upsertLocalDocument("exams", examId, snapshot);
      });
    questionMetadataWriteQueueRef.current = write;
    await write;
    return persistedExam;
  };

  const buildQuestionMetadataExam = (
    subjectName: string,
    qIndex: number,
    patch: Record<string, any>,
  ) => {
    const baseExam = latestExamRef.current || exam;
    const nextQuestions = JSON.parse(JSON.stringify(baseExam?.questions || {}));
    if (!nextQuestions[subjectName]) nextQuestions[subjectName] = {};

    const visibleQuestion = questions?.[subjectName]?.[qIndex];
    const storedQuestion = nextQuestions?.[subjectName]?.[qIndex];
    const currentQuestion = {
      ...(visibleQuestion || {}),
      ...(storedQuestion || {}),
    };
    const nextQuestion = {
      ...currentQuestion,
      ...patch,
    };

    nextQuestions[subjectName][qIndex] = nextQuestion;
    return {
      nextQuestion,
      nextExam: {
        ...baseExam,
        questions: nextQuestions,
      },
    };
  };

  // Kitapçık oluşturulduktan sonra kullanıcı kilidi kapatırsa Soru İşlemleri
  // salt-okunur hale gelir. Kilit sınav kaydının içinde tutulduğu için program
  // kapatılıp yeniden açıldığında da aynı durum korunur.
  const isQuestionEditingLocked = Boolean(
    exam?.bookletLayoutLock?.questionsLocked && exam?.bookletLayoutLock?.booklets,
  );

  const blockQuestionMutationWhenLocked = () => {
    if (!isQuestionEditingLocked) return false;
    showToast("Kitapçık kilitli. Soru ekleme, silme ve değiştirme için önce PDF Hazırlık alanındaki kilidi açınız.");
    return true;
  };

  React.useEffect(() => {
    const saved = localStorage.getItem("curriculumQuestionBank");
    if (saved) {
      try {
        setQuestionBank(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const normalizeOpticName = (value: any) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");

  /**
   * TXT sütun kuralı:
   * Kullanıcı sütunları 1 tabanlı tanımlar.
   * Örnek: startColumn=57, columnCount=30 => TXT'de 57..86.
   * JavaScript: rawLine.slice(56, 86)
   *
   * CEVAP ALANLARINDA trim() YAPILMAZ.
   * Çünkü boş bırakılmış soru da gerçek bir sütundur ve konumu korunmalıdır.
   */
  const sliceTxtColumns = (
    rawLine: string,
    startColumn: number,
    columnCount: number,
  ) => {
    const start = Math.floor(Number(startColumn || 0));
    const count = Math.floor(Number(columnCount || 0));

    if (start < 1 || count < 1) return "";

    const startIndex = start - 1;
    return String(rawLine || "")
      .slice(startIndex, startIndex + count)
      .padEnd(count, " ");
  };

  const loadSelectedOpticTemplate = async () => {
    const rawOptic = exam?.opticForm;

    const candidateIds = [
      exam?.opticFormId,
      exam?.opticTemplateId,
      exam?.opticExamConfig?.templateId,
      typeof rawOptic === "object" ? rawOptic?.id : "",
      exam?.opticTemplate?.id,
      exam?.opticFormSnapshot?.id,
      exam?.selectedOpticTemplate?.id,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const candidateNames = [
      exam?.opticExamConfig?.templateName,
      typeof rawOptic === "object"
        ? rawOptic?.name || rawOptic?.label
        : rawOptic,
      exam?.opticTemplate?.name,
      exam?.opticFormSnapshot?.name,
      exam?.selectedOpticTemplate?.name,
      exam?.opticName,
    ]
      .map(normalizeOpticName)
      .filter(Boolean);

    const legacyFieldLabel = (value: unknown) =>
      String(value || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ş/g, "S")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]/g, "");

    const identityKeyForLegacyLabel = (label: unknown) => {
      const key = legacyFieldLabel(label);
      if (key.includes("OKUL") && key.includes("KOD")) return "schoolCode";
      if (key.includes("OGRENCI") && (key.includes("NO") || key.includes("NUMARA"))) return "studentNo";
      if ((key.includes("AD") && key.includes("SOYAD")) || key.includes("OGRENCIADISOYADI")) return "fullName";
      if (key.includes("KITAP")) return "bookletType";
      if (key.includes("SUBE")) return "branch";
      if (key === "ALAN" || key === "ALANI") return "area";
      if (key.includes("SINIF")) return "classLevel";
      return "";
    };

    const convertLegacyTemplate = (source: any) => {
      if (!source || typeof source !== "object") return null;

      const currentIdentityFields = Array.isArray(source?.identityFields)
        ? source.identityFields.filter(Boolean)
        : [];
      const currentAnswerFields = Array.isArray(source?.answerFields)
        ? source.answerFields.filter(Boolean)
        : [];

      if (currentIdentityFields.length > 0 || currentAnswerFields.length > 0) {
        return source;
      }

      const legacyFields: any[] = Array.isArray(source?.fields)
        ? source.fields.filter(Boolean)
        : [];

      if (legacyFields.length === 0 && source?.txtCoords && typeof source.txtCoords === "object") {
        const mathLabel = String(source?.examKind || source?.templateKind || "")
          .toLocaleUpperCase("tr-TR") === "AYT"
          ? "Matematik"
          : "Temel Matematik";
        const txtCoordLabels: Record<string, string> = {
          schoolCode: "Okul Kodu",
          studentNo: "Öğrenci No",
          grade: "Sınıf Düzeyi",
          classLevel: "Sınıf Düzeyi",
          section: "Şube",
          branch: "Şube",
          fullName: "Öğrenci Adı Soyadı",
          area: "Alan",
          booklet: "Kitapçık",
          bookletType: "Kitapçık",
          turkce: "Türkçe",
          sosyal: "Sosyal Bilimler",
          matematik: mathLabel,
          fen: "Fen Bilimleri",
        };

        Object.entries(source.txtCoords).forEach(([key, coordinate]: [string, any], index) => {
          const start = Number(coordinate?.start ?? coordinate?.startColumn ?? 0);
          const count = Number(coordinate?.length ?? coordinate?.columnCount ?? 0);
          if (start < 1 || count < 1) return;
          legacyFields.push({
            id: `legacy-txt-${key}-${index}`,
            fieldName: txtCoordLabels[key] || key,
            columnStart: start,
            columnCount: count,
          });
        });
      }

      if (legacyFields.length === 0) return source;

      const identityFields: any[] = [];
      const answerFields: any[] = [];

      legacyFields.forEach((field: any, index: number) => {
        const label = String(field?.fieldName || field?.name || field?.label || "").trim();
        const startColumn = Number(
          field?.columnStart ?? field?.startColumn ?? field?.start ?? 0,
        );
        const columnCount = Number(
          field?.columnCount ?? field?.length ?? field?.count ?? 0,
        );
        if (!label || startColumn < 1 || columnCount < 1) return;

        const identityKey = identityKeyForLegacyLabel(label);
        if (identityKey) {
          identityFields.push({
            id: String(field?.id || `legacy-identity-${index}`),
            key: identityKey,
            label,
            startColumn,
            columnCount,
          });
          return;
        }

        answerFields.push({
          id: String(field?.id || `legacy-answer-${index}`),
          courseName: label,
          startColumn,
          columnCount,
        });
      });

      return {
        ...source,
        identityFields,
        answerFields,
      };
    };

    const hasUsableTemplateData = (source: any) => Boolean(
      source && typeof source === "object" && (
        (Array.isArray(source?.identityFields) && source.identityFields.length > 0) ||
        (Array.isArray(source?.answerFields) && source.answerFields.length > 0) ||
        (Array.isArray(source?.fields) && source.fields.length > 0) ||
        (source?.txtCoords && typeof source.txtCoords === "object")
      )
    );

    let templates: any[] = [];

    try {
      const { listOpticTemplates } = await import(
        "../lib/opticTemplateApi"
      );
      templates = await listOpticTemplates();
    } catch (error) {
      console.warn("Optik şablon API üzerinden okunamadı:", error);
    }

    // Eski/yerel Optik Form Yönetimi kayıtları halen birçok sınavın gerçek
    // TXT sütun koordinatlarını taşır. Oku-Düzenle bu kayıtları da okuyabilmelidir.
    let legacyTemplates: any[] = [];
    try {
      const localforage = await import("localforage");
      const saved = await localforage.default.getItem("opticForms") as any[] | null;
      if (Array.isArray(saved)) legacyTemplates.push(...saved.filter(Boolean));
    } catch (error) {
      console.warn("Optik şablon localforage üzerinden okunamadı:", error);
    }
    try {
      const saved = window.localStorage.getItem("opticForms");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) legacyTemplates.push(...parsed.filter(Boolean));
    } catch (error) {
      console.warn("Optik şablon localStorage üzerinden okunamadı:", error);
    }

    const uniqueLegacyTemplates = Array.from(
      new Map(
        legacyTemplates.map((form: any, index: number) => [
          String(form?.id || normalizeOpticName(form?.name || form?.label) || `legacy-${index}`),
          form,
        ]),
      ).values(),
    );

    // Sınav kaydına gömülen şablon kopyası sınavın kendi kalıcı kaynağıdır.
    // Eski sınavlarda snapshot farklı alan adlarıyla tutulmuş olabilir.
    const embeddedCandidates = [
      exam?.opticTemplate,
      exam?.opticFormSnapshot,
      exam?.selectedOpticTemplate,
      typeof rawOptic === "object" ? rawOptic : null,
    ].filter((item: any) => hasUsableTemplateData(item));
    const embeddedTemplate = embeddedCandidates[0] || null;

    const matchedCanonical =
      templates.find((form: any) =>
        candidateIds.includes(String(form?.id || "").trim()),
      ) ||
      templates.find((form: any) =>
        candidateNames.includes(normalizeOpticName(form?.name)),
      );

    const matchedLegacy =
      uniqueLegacyTemplates.find((form: any) =>
        candidateIds.includes(String(form?.id || "").trim()),
      ) ||
      uniqueLegacyTemplates.find((form: any) =>
        candidateNames.includes(normalizeOpticName(form?.name || form?.label)),
      );

    const embeddedConverted = convertLegacyTemplate(embeddedTemplate);
    const canonicalConverted = convertLegacyTemplate(matchedCanonical);
    const legacyConverted = convertLegacyTemplate(matchedLegacy);

    const template =
      embeddedConverted ||
      canonicalConverted ||
      legacyConverted ||
      // Sınavda isim/id yoksa ve yalnızca tek şablon varsa güvenli yedek.
      convertLegacyTemplate(templates.length === 1 ? templates[0] : null) ||
      convertLegacyTemplate(uniqueLegacyTemplates.length === 1 ? uniqueLegacyTemplates[0] : null);

    const specialConfig = exam?.opticExamConfig || {};

    const normalizeAnswerField = (field: any, index: number) => {
      const startColumn = Number(
        field?.startColumn ??
        field?.columnStart ??
        field?.start ??
        field?.startCol ??
        0,
      );
      const explicitCount = Number(
        field?.columnCount ??
        field?.questionCount ??
        field?.count ??
        field?.length ??
        0,
      );
      const endColumn = Number(field?.endColumn ?? field?.endCol ?? 0);
      const columnCount =
        explicitCount > 0
          ? explicitCount
          : startColumn > 0 && endColumn >= startColumn
            ? endColumn - startColumn + 1
            : 0;

      return {
        ...field,
        id: String(field?.id || `answer-${index}`),
        courseName: String(
          field?.courseName ||
          field?.examLabel ||
          field?.fieldName ||
          field?.label ||
          field?.name ||
          `Cevap ${index + 1}`,
        ).trim(),
        startColumn,
        columnCount,
      };
    };

    const normalizeAnswerFieldSet = (fields: any) =>
      (Array.isArray(fields) ? fields : [])
        .filter(Boolean)
        .map(normalizeAnswerField)
        .filter(
          (field: any) =>
            field.courseName && field.startColumn > 0 && field.columnCount > 0,
        );

    // Kimlik alanları için öncelik:
    // 1) sınava kaydedilmiş snapshot
    // 2) kanonik/yerel optik şablon
    // 3) eski sınav içine gömülü opticTemplate
    const identityFields =
      Array.isArray(specialConfig?.identityFields) &&
      specialConfig.identityFields.length > 0
        ? specialConfig.identityFields
        : Array.isArray(template?.identityFields) &&
            template.identityFields.length > 0
          ? template.identityFields
          : Array.isArray(exam?.opticTemplate?.identityFields)
            ? exam.opticTemplate.identityFields
            : [];

    // Ders cevap alanları birden fazla eski/yeni kaynaktan gelebiliyor.
    // Özellikle eski Optik Form Yönetimi kaydında TXT koordinatları dururken
    // yeni SQLite şablonunda yalnız kimlik alanları bulunabildiği için tek kaynağa
    // güvenmek cevapları sessizce boş bırakabiliyordu. Tüm geçerli adayları koruyoruz;
    // TXT okunurken gerçek A-E verisini üreten koordinat seti otomatik seçilecek.
    const answerFieldCandidates: any[][] = [];
    const addAnswerCandidate = (fields: any) => {
      const normalized = normalizeAnswerFieldSet(fields);
      if (normalized.length === 0) return;
      const signature = normalized
        .map((field: any) => `${field.courseName}:${field.startColumn}:${field.columnCount}`)
        .join("|");
      const duplicate = answerFieldCandidates.some(
        (candidate) =>
          candidate
            .map((field: any) => `${field.courseName}:${field.startColumn}:${field.columnCount}`)
            .join("|") === signature,
      );
      if (!duplicate) answerFieldCandidates.push(normalized);
    };

    if (Array.isArray(specialConfig?.answerFields) && specialConfig.answerFields.length > 0) {
      addAnswerCandidate(specialConfig.answerFields);
    }
    if (specialConfig?.isSpecial) {
      addAnswerCandidate(specialConfig?.columns);
    }
    addAnswerCandidate(template?.answerFields);
    addAnswerCandidate(embeddedConverted?.answerFields);
    addAnswerCandidate(canonicalConverted?.answerFields);
    addAnswerCandidate(legacyConverted?.answerFields);
    addAnswerCandidate(exam?.opticTemplate?.answerFields);

    const structure = Array.isArray(exam?.examStructure)
      ? exam.examStructure
      : [];
    const structureAnswerFields = structure.flatMap((test: any) =>
      (Array.isArray(test?.subjects) ? test.subjects : []).map(
        (subject: any, index: number) => ({
          id: `structure-answer-${normalizeOpticName(subject?.name)}-${index}`,
          courseName: String(subject?.name || "").trim(),
          startColumn: Number(
            subject?.opticStartColumn ?? subject?.startColumn ?? 0,
          ),
          columnCount: Number(
            subject?.opticColumnCount ?? subject?.count ?? 0,
          ),
        }),
      ),
    );
    addAnswerCandidate(structureAnswerFields);

    const answerFields: any[] = answerFieldCandidates[0] || [];

    if (identityFields.length === 0 && answerFields.length === 0) {
      console.warn("Sınav için optik şablon bulunamadı.", {
        candidateIds,
        candidateNames,
        availableTemplates: [
          ...templates,
          ...uniqueLegacyTemplates,
        ].map((item: any) => ({
          id: item?.id,
          name: item?.name,
        })),
        examOpticForm: exam?.opticForm,
        opticFormId: exam?.opticFormId,
        opticExamConfig: exam?.opticExamConfig,
      });
      return null;
    }

    return {
      id:
        template?.id ||
        candidateIds[0] ||
        exam?.opticTemplate?.id ||
        "",
      name:
        template?.name ||
        exam?.opticExamConfig?.templateName ||
        (typeof rawOptic === "string" ? rawOptic : "") ||
        exam?.opticTemplate?.name ||
        "",
      identityFields,
      answerFields,
      answerFieldCandidates,
      preferPrimaryAnswerFields:
        Array.isArray(specialConfig?.answerFields) &&
        specialConfig.answerFields.length > 0,
    };
  };

  const normalizeFieldLabel = (value: any) =>
    String(value || "")
      .toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ş/g, "S")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C")
      .replace(/[^A-Z0-9]/g, "");

  const parseTxtFileContents = (text: string, opticTemplate: any) => {
    const lines = String(text || "").split(/\r?\n/);
    const parsed: any[] = [];

    const identityFields = Array.isArray(opticTemplate?.identityFields)
      ? opticTemplate.identityFields
          .filter(Boolean)
          .map((field: any, index: number) => ({
            id: String(field?.id || field?.key || `identity-${index}`),
            key: String(field?.key || ""),
            label: String(field?.label || field?.name || field?.key || `Alan ${index + 1}`),
            startColumn: Number(field?.startColumn || 0),
            columnCount: Number(field?.columnCount || 0),
          }))
          .filter(
            (field: any) =>
              field.startColumn > 0 && field.columnCount > 0,
          )
      : [];

    const normalizeParserAnswerFields = (fields: any) =>
      (Array.isArray(fields) ? fields : [])
        .filter(Boolean)
        .map((field: any, index: number) => ({
          id: String(field?.id || `answer-${index}`),
          courseName: String(
            field?.courseName ||
            field?.examLabel ||
            field?.fieldName ||
            field?.label ||
            field?.name ||
            "",
          ).trim(),
          startColumn: Number(
            field?.startColumn ??
            field?.columnStart ??
            field?.start ??
            field?.startCol ??
            0,
          ),
          columnCount: Number(
            field?.columnCount ??
            field?.questionCount ??
            field?.count ??
            field?.length ??
            0,
          ),
        }))
        .filter(
          (field: any) =>
            field.courseName &&
            field.startColumn > 0 &&
            field.columnCount > 0,
        );

    const primaryAnswerFields = normalizeParserAnswerFields(
      opticTemplate?.answerFields,
    );
    const candidateAnswerFieldSets = [
      primaryAnswerFields,
      ...(Array.isArray(opticTemplate?.answerFieldCandidates)
        ? opticTemplate.answerFieldCandidates.map(normalizeParserAnswerFields)
        : []),
    ].filter((fields: any[]) => fields.length > 0);

    // Yanlış/eskimiş cevap koordinatı kimlik alanlarını yine doğru okuyabilir,
    // fakat cevap dilimi tamamen boş kalır. İlk gerçek öğrenci satırlarından A-E
    // yoğunluğunu ölçüp cevap üreten koordinat setini seçiyoruz. Boş cevaplar
    // gerçek soru pozisyonu olduğu için trim yapılmaz.
    const sampleLines = lines
      .filter((line) => line && line.trim())
      .filter((line) => {
        const lower = line.trim().toLocaleLowerCase("tr-TR");
        return !(
          lower.startsWith("#") ||
          (lower.includes("öğrenci") && lower.includes("no") && lower.includes("cevap")) ||
          (lower.includes("student") && lower.includes("number"))
        );
      })
      .slice(0, 20);

    const scoreAnswerFieldSet = (fields: any[]) => {
      let validLetters = 0;
      let invalidLetters = 0;
      let nonEmptyRows = 0;
      for (const line of sampleLines) {
        let rowHasAnswer = false;
        for (const field of fields) {
          const value = sliceTxtColumns(line, field.startColumn, field.columnCount)
            .toLocaleUpperCase("tr-TR");
          const compact = value.replace(/\s/g, "");
          if (compact) rowHasAnswer = true;
          for (const ch of compact) {
            if (/[ABCDE]/.test(ch)) validLetters += 1;
            else invalidLetters += 1;
          }
        }
        if (rowHasAnswer) nonEmptyRows += 1;
      }
      return validLetters * 10 + nonEmptyRows * 3 - invalidLetters * 8;
    };

    // Tarih alanı için güvenli koordinat kurtarması:
    // Kullanıcının tanımladığı sütun esas alınır. Yalnız bu pencere örnek
    // öğrenci satırlarında gerçekten boşsa, yakın çevredeki ve BAŞKA bir
    // tanımlı ders alanıyla çakışmayan pencereler kontrol edilir. Güçlü ve
    // tutarlı A-E verisi bulunursa sadece bu TXT okumasında Tarih o pencereden
    // alınır. Kayıtlı optik şablon değiştirilmez.
    const resolveHistoryStartColumn = (field: any, allFields: any[]) => {
      if (normalizeFieldLabel(field?.courseName) !== "TARIH") return field;
      const configuredStart = Number(field?.startColumn || 0);
      const count = Number(field?.columnCount || 0);
      if (configuredStart < 1 || count < 1 || sampleLines.length < 2) return field;

      const measure = (startColumn: number) => {
        let validLetters = 0;
        let rowsWithLetters = 0;
        for (const line of sampleLines) {
          const value = sliceTxtColumns(line, startColumn, count)
            .toLocaleUpperCase("tr-TR");
          const rowLetters = Array.from(value).filter((ch) => /[ABCDE]/.test(ch)).length;
          validLetters += rowLetters;
          if (rowLetters > 0) rowsWithLetters += 1;
        }
        return { startColumn, validLetters, rowsWithLetters };
      };

      const primary = measure(configuredStart);
      // Tanımlı Tarih penceresinde anlamlı cevap verisi varsa koordinata dokunma.
      if (primary.validLetters >= Math.max(3, sampleLines.length)) return field;

      const overlapsOtherField = (startColumn: number) => {
        const endColumn = startColumn + count - 1;
        return allFields.some((other: any) => {
          if (String(other?.id || "") === String(field?.id || "")) return false;
          const otherStart = Number(other?.startColumn || 0);
          const otherCount = Number(other?.columnCount || 0);
          if (otherStart < 1 || otherCount < 1) return false;
          const otherEnd = otherStart + otherCount - 1;
          return startColumn <= otherEnd && endColumn >= otherStart;
        });
      };

      const nearby = Array.from({ length: 24 }, (_, index) => configuredStart - 12 + index)
        .filter((startColumn) => startColumn > 0 && startColumn !== configuredStart)
        .filter((startColumn) => !overlapsOtherField(startColumn))
        .map(measure)
        .sort((a, b) => b.validLetters - a.validLetters || b.rowsWithLetters - a.rowsWithLetters);

      const best = nearby[0];
      if (!best) return field;
      const minimumRows = Math.max(2, Math.ceil(sampleLines.length * 0.6));
      const minimumLetters = Math.max(6, sampleLines.length * Math.min(3, Math.max(1, Math.ceil(count * 0.25))));
      const clearlyBetter = best.validLetters >= primary.validLetters + sampleLines.length * 2;

      if (best.rowsWithLetters >= minimumRows && best.validLetters >= minimumLetters && clearlyBetter) {
        console.warn(
          `[Optik TXT] Tarih ${configuredStart}-${configuredStart + count - 1} aralığında boş göründü; ` +
          `${best.startColumn}-${best.startColumn + count - 1} aralığında tutarlı cevap verisi bulundu. ` +
          `Okuma bu TXT için geçici olarak ${best.startColumn}. sütundan yapılıyor.`,
        );
        return { ...field, startColumn: best.startColumn };
      }

      return field;
    };

    const selectedAnswerFields = (
      Array.isArray(opticTemplate?.answerFields) &&
      opticTemplate.answerFields.length > 0 &&
      opticTemplate?.preferPrimaryAnswerFields === true
        ? primaryAnswerFields
        : candidateAnswerFieldSets.length > 0
          ? [...candidateAnswerFieldSets].sort(
              (a, b) => scoreAnswerFieldSet(b) - scoreAnswerFieldSet(a),
            )[0]
          : []
    );
    const answerFields = selectedAnswerFields.map((field: any) =>
      resolveHistoryStartColumn(field, selectedAnswerFields),
    );

    for (const rawLine of lines) {
      if (!rawLine || !rawLine.trim()) continue;

      const lowerLine = rawLine.trim().toLocaleLowerCase("tr-TR");
      if (
        lowerLine.startsWith("#") ||
        (lowerLine.includes("öğrenci") &&
          lowerLine.includes("no") &&
          lowerLine.includes("cevap")) ||
        (lowerLine.includes("student") &&
          lowerLine.includes("number"))
      ) {
        continue;
      }

      // Yeni optik sisteminde şablon varsa fixed-width TXT dışında tahmin yapılmaz.
      // Her değer yalnızca kendi 1-tabanlı sütun koordinatından okunur.
      if (identityFields.length > 0 || answerFields.length > 0) {
        const fieldValues: Record<string, string> = {};
        const identityValues: Record<string, string> = {};

        for (const field of identityFields) {
          const rawValue = sliceTxtColumns(
            rawLine,
            field.startColumn,
            field.columnCount,
          );

          // Kimlik alanlarında dış boşluklar veri değildir.
          const value = rawValue.trim();
          identityValues[field.key] = value;
          fieldValues[field.label] = value;
        }

        for (const field of answerFields) {
          // Cevap alanında boşluklar korunur.
          const value = sliceTxtColumns(
            rawLine,
            field.startColumn,
            field.columnCount,
          ).toLocaleUpperCase("tr-TR");

          fieldValues[field.courseName] = value;
        }

        const studentNumberRaw =
          identityValues.studentNo ||
          fieldValues["Öğrenci No"] ||
          "";

        const studentNumber = (() => {
          const compact = String(studentNumberRaw)
            .trim()
            .replace(/\s+/g, "");
          if (!compact) return "";
          const noLeadingZero = compact.replace(/^0+/, "");
          return noLeadingZero || "0";
        })();

        const studentName =
          identityValues.fullName ||
          fieldValues["Adı Soyadı"] ||
          fieldValues["Öğrenci Adı Soyadı"] ||
          "";

        const classLevel =
          identityValues.classLevel ||
          fieldValues["Sınıfı"] ||
          fieldValues["Sınıf"] ||
          "";

        const branch =
          identityValues.branch ||
          fieldValues["Şubesi"] ||
          fieldValues["Şube"] ||
          "";

        const area =
          identityValues.area ||
          fieldValues["Alanı"] ||
          fieldValues["Alan"] ||
          "";

        const bookletType = String(
          identityValues.bookletType ||
          fieldValues["Kitapçık Türü"] ||
          fieldValues["Kitapçık"] ||
          getDefaultBookletType(),
        )
          .trim()
          .toLocaleUpperCase("tr-TR");

        // answers yalnız geriye dönük ekranlar için birleştirilir.
        // Değerlendirmede esas kaynak fieldValues[dersAdı] olmalıdır.
        // Burada da her dersin tam sütun uzunluğu korunur.
        const answers = answerFields
          .map((field: any) => fieldValues[field.courseName] || "")
          .join("");

        const classroom = [classLevel, branch]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" ");

        parsed.push({
          id: Math.random().toString(36).substring(2, 9),
          studentNumber,
          studentNo: studentNumber,
          studentName: String(studentName).trim(),
          fullName: String(studentName).trim(),
          gradeLevel: classroom,
          classroom,
          className: classroom,
          classLevel: String(classLevel || "").trim(),
          section: String(branch || "").trim(),
          branch: String(branch || "").trim(),
          area: String(area || "").trim(),
          schoolCode: String(identityValues.schoolCode || "").trim(),
          bookletType,
          booklet: bookletType,
          answers,
          fieldValues,
          answerFields: Object.fromEntries(
            answerFields.map((field: any) => [
              field.courseName,
              fieldValues[field.courseName] || "",
            ]),
          ),
          opticTemplateName:
            opticTemplate?.name || exam?.opticForm || "",
          rawLine,
        });

        continue;
      }

      // Şablon yoksa yalnızca eski dosyalar için esnek yedek okuyucu.
      const trimmedLine = rawLine.trim();
      const delimiter = trimmedLine.includes(";")
        ? ";"
        : trimmedLine.includes(",")
          ? ","
          : trimmedLine.includes("\t")
            ? "\t"
            : null;

      let studentNumber = "";
      let gradeLevel = "";
      let bookletType = "";
      let studentName = "";
      let answers = "";

      if (delimiter) {
        const parts = trimmedLine
          .split(delimiter)
          .map((part) => part.trim());

        const numberPartIndex = parts.findIndex(
          (part) => /^\d+$/.test(part) && part.length <= 10,
        );
        if (numberPartIndex >= 0) {
          studentNumber = parts[numberPartIndex];
        }

        const booklet = parts.find((part) =>
          /^[A-D]$/i.test(part),
        );
        if (booklet) bookletType = booklet.toUpperCase();

        const grade = parts.find((part) =>
          /^(9|10|11|12)([-/\s]?[A-Za-zÇĞİÖŞÜ])?$/i.test(
            part,
          ),
        );
        if (grade) gradeLevel = grade;

        const answer = parts.find(
          (part) =>
            part.length > 3 &&
            /^[A-E\-*\s]+$/i.test(part),
        );
        if (answer) answers = answer.toUpperCase();

        const name = parts.find(
          (part) =>
            /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(part) &&
            part !== grade &&
            part !== booklet,
        );
        if (name) studentName = name;
      }

      parsed.push({
        id: Math.random().toString(36).substring(2, 9),
        studentNumber: studentNumber
          .trim()
          .replace(/^0+/, "") || "",
        gradeLevel: gradeLevel.trim(),
        bookletType:
          bookletType.trim().toUpperCase() || getDefaultBookletType(),
        studentName: studentName.trim(),
        answers,
        fieldValues: {},
        rawLine,
      });
    }

    return parsed;
  };

  const decodeTxtFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // UTF-8 BOM bulunan dosyaları doğrudan UTF-8 olarak oku.
    const hasUtf8Bom =
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf;

    const decode = (encoding: string) => {
      try {
        return new TextDecoder(encoding, { fatal: false }).decode(buffer).replace(/^\uFEFF/, "");
      } catch {
        return "";
      }
    };

    if (hasUtf8Bom) return decode("utf-8");

    const utf8Text = decode("utf-8");
    const windowsText = decode("windows-1254");

    // Hatalı kodlamada oluşan � işaretlerini sayarak daha temiz olan metni seç.
    const corruptionScore = (value: string) =>
      (value.match(/�/g) || []).length +
      (value.match(/Ã.|Ä.|Å./g) || []).length;

    if (!windowsText) return utf8Text;
    if (!utf8Text) return windowsText;

    return corruptionScore(utf8Text) <= corruptionScore(windowsText)
      ? utf8Text
      : windowsText;
  };

  const handleTxtFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!txtUploadOption) {
      showToast("Lütfen dosya yüklemek için önce seçeneklerden birini belirleyin!");
      e.target.value = "";
      return;
    }

    try {
      const text = await decodeTxtFile(file);

      if (!text || !text.trim()) {
        showToast("TXT dosyası boş veya okunamıyor. Lütfen geçerli bir TXT dosyası seçin.");
        return;
      }

      let selectedTemplate = await loadSelectedOpticTemplate();

      // Optik Ayarları başka ekranda kaydedildiğinde bu bileşendeki `exam` nesnesi
      // kısa süreliğine eski kalabilir. TXT yüklemeyi bu yüzden durdurma; aynı sınavın
      // kalıcı kaydındaki en güncel opticTemplate / opticExamConfig bilgisini yedek
      // kaynak olarak kullan.
      if (!selectedTemplate) {
        let latestExam: any = null;
        try {
          const localforage = await import("localforage");
          const storedExams = await localforage.default.getItem<any[]>("exams");
          if (Array.isArray(storedExams)) {
            latestExam = storedExams.find((item: any) => String(item?.id || "") === String(exam?.id || "")) || null;
          }
        } catch (error) {
          console.warn("Güncel sınav kaydı localforage üzerinden okunamadı:", error);
        }
        if (!latestExam) {
          try {
            const raw = window.localStorage.getItem("exams");
            const storedExams = raw ? JSON.parse(raw) : [];
            if (Array.isArray(storedExams)) {
              latestExam = storedExams.find((item: any) => String(item?.id || "") === String(exam?.id || "")) || null;
            }
          } catch (error) {
            console.warn("Güncel sınav kaydı localStorage üzerinden okunamadı:", error);
          }
        }

        const embedded = latestExam?.opticTemplate || latestExam?.opticFormSnapshot || null;
        const config = latestExam?.opticExamConfig || null;
        const identityFields = Array.isArray(config?.identityFields) && config.identityFields.length > 0
          ? config.identityFields
          : Array.isArray(embedded?.identityFields)
            ? embedded.identityFields
            : [];
        const answerFields = Array.isArray(config?.answerFields) && config.answerFields.length > 0
          ? config.answerFields
          : Array.isArray(embedded?.answerFields)
            ? embedded.answerFields
            : [];

        if (identityFields.length > 0 || answerFields.length > 0) {
          selectedTemplate = {
            ...(embedded || {}),
            id: config?.templateId || embedded?.id || latestExam?.opticFormId || "",
            name: config?.templateName || embedded?.name || latestExam?.opticForm || "Optik Şablon",
            identityFields,
            answerFields,
            preferPrimaryAnswerFields: answerFields.length > 0,
          };
        }
      }

      // Şablon bulunamasa bile dosya yüklemesini engelleme. Ayraçlı eski TXT'ler
      // esnek okuyucu ile açılabilir; fixed-width dosyada ise aşağıdaki anlamlı kayıt
      // kontrolü kullanıcıya açık uyarı verir.
      const parsed = parseTxtFileContents(text, selectedTemplate || null);
      const meaningfulRecords = parsed.filter(
        (record: any) =>
          record.studentNumber ||
          record.studentName ||
          record.gradeLevel ||
          record.bookletType ||
          record.answers ||
          (record.fieldValues &&
            Object.keys(record.fieldValues).length > 0),
      );

      if (parsed.length === 0) {
        showToast("TXT dosyasında okunabilir öğrenci satırı bulunamadı.");
        return;
      }

      if (!selectedTemplate && meaningfulRecords.length === 0) {
        showToast(
          `TXT açıldı; ancak sütunlar çözümlenemedi. Sınav için optik şablonu yeniden seçin: ${
            typeof exam.opticForm === "object"
              ? exam.opticForm?.name || exam.opticForm?.label || "Optik seçilmedi"
              : exam.opticForm || "Optik seçilmedi"
          }`,
        );
        return;
      }

      if (txtUploadOption === "replace") {
        setStudentRecords(parsed.map((record: any) => enrichRecordFromSystem(record)));
        showToast(
          selectedTemplate
            ? `${parsed.length} öğrenci, "${selectedTemplate.name || "Optik Şablon"}" sütun koordinatlarına göre yüklendi.`
            : `${parsed.length} öğrenci kaydı esnek TXT okuyucu ile yüklendi.`,
        );
      } else if (txtUploadOption === "append") {
        setStudentRecords((currentRecords) => [
          ...currentRecords,
          ...parsed.map((record: any) => enrichRecordFromSystem(record)),
        ]);
        showToast(`${parsed.length} yeni öğrenci kaydı mevcut listenin üzerine eklendi.`);
      }
    } catch (error) {
      console.error("TXT dosyası okunamadı:", error);
      showToast("TXT dosyası okunurken hata oluştu. Dosyanın bozuk olmadığını kontrol edin.");
    } finally {
      e.target.value = "";
    }
  };

  const saveStudentRecords = async (updatedRecords: any[]) => {
    const normalizedRecords = updatedRecords.map((record) => {
      const enriched = enrichRecordFromSystem(record);
      return {
        ...enriched,
        bookletType:
          String(enriched?.bookletType || "").trim().toLocaleUpperCase("tr-TR") ||
          getDefaultBookletType(),
      };
    });
    const conflicts = getStudentRecordConflicts(normalizedRecords);
    if (conflicts.length > 0) {
      showToast("Çelişen veya çakışan kayıtlar düzeltilmeden kaydetme yapılamaz.");
      return;
    }

    try {
      await Promise.resolve(
        onUpdateExam({
          ...exam,
          studentTxtRecords: normalizedRecords,
        }),
      );
      setStudentRecords(normalizedRecords);
      showToast(
        "Öğrenci bilgileri başarıyla sınav üzerine kalıcı olarak kaydedildi.",
      );
    } catch (error) {
      console.error("Öğrenci TXT kayıtları kaydedilemedi:", error);
      showToast("Öğrenci bilgileri kalıcı olarak kaydedilemedi.");
    }
  };

  const handleAddEmptyStudent = () => {
    const newStudent = {
      id: Math.random().toString(36).substring(2, 9),
      studentNumber: "",
      gradeLevel: "",
      bookletType: "",
      studentName: "",
      answers: "",
      rawLine: ""
    };
    setStudentRecords([...studentRecords, newStudent]);
  };

  const handleUpdateStudentField = (id: string, field: string, value: string) => {
    const updated = studentRecords.map((rec) => {
      if (rec.id === id) {
        const changed = { ...rec, [field]: value };
        return field === "studentNumber"
          ? enrichRecordFromSystem(changed)
          : changed;
      }
      return rec;
    });
    setStudentRecords(updated);
  };

  const handleDeleteStudent = (id: string) => {
    const filtered = studentRecords.filter(rec => rec.id !== id);
    setStudentRecords(filtered);
    setSelectedStudentRecords(prev => prev.filter(rId => rId !== id));
  };

  const handleDeleteSelectedStudents = () => {
    if (selectedStudentRecords.length === 0) return;
    if (window.confirm(`${selectedStudentRecords.length} öğrenci kaydını silmek istediğinize emin misiniz?`)) {
       const filtered = studentRecords.filter(rec => !selectedStudentRecords.includes(rec.id));
       setStudentRecords(filtered);
       setSelectedStudentRecords([]);
    }
  };


  const normalizeExamTypeKey = (value: unknown) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
      .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const replaceLegacyExamTerminology = (value: unknown) =>
    String(value || "")
      .replace(/branch denemesi/gi, "Ders Denemesi")
      .replace(/branch deneme/gi, "Ders Denemesi")
      .replace(/branş denemesi/gi, "Ders Denemesi")
      .replace(/branş deneme/gi, "Ders Denemesi")
      .replace(/ünite taraması/gi, "Ünite Denemesi")
      .replace(/ünite tarama/gi, "Ünite Denemesi");

  const isCourseBasedExamType = (value: unknown) => {
    const key = normalizeExamTypeKey(value);
    return [
      "ders deneme", "ders denemesi",
      "konu deneme", "konu denemesi",
      "brans deneme", "brans denemesi",
      "branch deneme", "branch denemesi",
      "unite deneme", "unite denemesi",
      "unite tarama", "unite taramasi",
    ].includes(key);
  };

  const examStructure = exam.examStructure || [];
  const activeTest = examStructure[activeTestIndex];
  const activeSubject = activeTest?.subjects?.[activeSubjectIndex];

  // Initialize questions if needed. Öğretmenin canlı seçimi doğrudan
  // teacherTestAssignments kaydından gelir; exam prop'u birkaç saniye geriden
  // gelse bile Soru İşlemleri aynı kesin seçimi gösterir.
  const [liveTeacherQuestionsBySubject, setLiveTeacherQuestionsBySubject] = useState<Record<string, any[]>>({});
  const baseQuestions = exam.questions || {};
  const questions = React.useMemo(() => {
    const merged: Record<string, any> = { ...(baseQuestions || {}) };
    Object.entries(liveTeacherQuestionsBySubject).forEach(([subjectName, teacherRows]) => {
      const existingRows = Object.values(merged[subjectName] || {})
        .filter((question: any) => String(question?.source || "") !== "teacher-selection");
      merged[subjectName] = Object.fromEntries(
        [...(Array.isArray(teacherRows) ? teacherRows : []), ...existingRows]
          .map((question: any, index: number) => [index, question]),
      );
    });
    return merged;
  }, [exam.questions, liveTeacherQuestionsBySubject]);
  const isFlexibleCourseBasedExam = isCourseBasedExamType(exam?.examType);
  const isUnitScanExam = [
    "unite deneme", "unite denemesi",
    "unite tarama", "unite taramasi",
  ].includes(
    normalizeExamTypeKey(exam?.examType),
  );
  const activeFilledQuestionCount = activeSubject
    ? Object.values(questions[activeSubject.name] || {}).filter((q: any) => q?.imageUrl).length
    : 0;
  const questionCount = isFlexibleCourseBasedExam
    ? Math.max(Number(activeSubject?.count || 0), activeFilledQuestionCount)
    : Number(activeSubject?.count || 0);

  const displayedSubjectCount = (subject: any) => {
    const configured = Math.max(0, Number(subject?.count || 0));
    if (!isFlexibleCourseBasedExam) return configured;
    const filled = Object.values(questions[String(subject?.name || "")] || {})
      .filter((question: any) => Boolean(question?.imageUrl)).length;
    return Math.max(configured, filled);
  };

  const withUpdatedSubjectCount = (structure: any[], subjectName: string, count: number) =>
    (structure || []).map((test: any) => ({
      ...test,
      subjects: (test.subjects || []).map((subject: any) =>
        String(subject?.name || "") === String(subjectName)
          ? { ...subject, count: Math.max(0, Number(count || 0)) }
          : subject,
      ),
    }));
  const questionGroupMembers = (groupId: string) => {
    if (!activeSubject || !groupId) return [] as Array<{ index: number; question: any }>;
    return Object.entries(questions?.[activeSubject.name] || {})
      .map(([key, question]: any) => ({ index: Number(key), question }))
      .filter((row) => Number.isFinite(row.index) && row.question?.imageUrl && questionGroupIdOf(row.question) === groupId)
      .sort((a, b) => questionGroupOrderOf(a.question) - questionGroupOrderOf(b.question) || a.index - b.index);
  };

  const resetQuestionGroupSelection = () => {
    setQuestionGroupSelectionMode(false);
    setQuestionGroupSelectedIndices(new Set());
  };

  const startQuestionGroupSelection = () => {
    if (blockQuestionMutationWhenLocked()) return;
    setQuestionGroupSelectionMode(true);
    setQuestionGroupSelectedIndices(new Set());
    setQuestionGroupEditingId("");
    setQuestionGroupDraft({ title: "", instructionText: "", instructionImageUrl: "", mode: "required", layout: "normal" });
  };

  const openExistingQuestionGroupEditor = (groupId: string) => {
    if (blockQuestionMutationWhenLocked()) return;
    const members = questionGroupMembers(groupId);
    if (!members.length) return;
    const first = members[0].question;
    setQuestionGroupEditingId(groupId);
    setQuestionGroupSelectedIndices(new Set(members.map((row) => row.index)));
    setQuestionGroupDraft({
      title: questionGroupTitleOf(first),
      instructionText: questionGroupInstructionTextOf(first),
      instructionImageUrl: questionGroupInstructionImageOf(first),
      mode: questionGroupModeOf(first),
      layout: questionGroupLayoutOf(first),
    });
    setQuestionGroupSelectionMode(false);
    setQuestionGroupEditorOpen(true);
  };

  const toggleQuestionGroupSelectionIndex = (index: number) => {
    if (!activeSubject) return;
    const question = questions?.[activeSubject.name]?.[index];
    if (!question?.imageUrl) return;
    const existingGroupId = questionGroupIdOf(question);
    if (existingGroupId) {
      openExistingQuestionGroupEditor(existingGroupId);
      return;
    }
    setQuestionGroupSelectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const openNewQuestionGroupEditor = () => {
    if (!activeSubject) return;
    const selected = [...questionGroupSelectedIndices]
      .sort((a, b) => a - b)
      .filter((index) => Boolean(questions?.[activeSubject.name]?.[index]?.imageUrl));
    if (selected.length < 2) {
      showToast("Soru grubu oluşturmak için en az iki soru seçiniz.");
      return;
    }
    const hasExistingGroup = selected.some((index) => questionGroupIdOf(questions?.[activeSubject.name]?.[index]));
    if (hasExistingGroup) {
      showToast("Seçilen sorulardan biri zaten bir soru grubunda. Önce mevcut grup etiketinden grubu düzenleyin veya çözün.");
      return;
    }
    setQuestionGroupEditingId("");
    setQuestionGroupDraft({ title: "", instructionText: "", instructionImageUrl: "", mode: "required", layout: "normal" });
    setQuestionGroupEditorOpen(true);
  };

  const handleQuestionGroupInstructionImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      showToast("Yönerge görseli bir resim dosyası olmalıdır.");
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setQuestionGroupDraft((current) => ({ ...current, instructionImageUrl: dataUrl }));
  };

  const persistQuestionGroupToBank = async (
    groupId: string,
    memberRows: Array<{ index: number; question: any }>,
    draft: typeof questionGroupDraft,
  ) => {
    const canonicalIds = memberRows
      .map(({ question }) => String(question?.systemQuestionId || question?.questionId || question?.question_id || "").trim())
      .filter(Boolean);
    const uniqueCanonicalIds = [...new Set(canonicalIds)];
    if (uniqueCanonicalIds.length < 2) return { persisted: false, partial: uniqueCanonicalIds.length > 0 };
    const response = await fetch("/api/question-bank/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        mode: draft.mode,
        layout: draft.layout,
        title: draft.title,
        instructionText: draft.instructionText,
        instructionImageUrl: draft.instructionImageUrl,
        questionIds: uniqueCanonicalIds,
      }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(body?.error || "Soru grubu soru bankasına kaydedilemedi."));
    return { persisted: true, partial: uniqueCanonicalIds.length !== memberRows.length };
  };

  const saveQuestionGroup = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject) return;
    const selectedIndices = [...questionGroupSelectedIndices].sort((a, b) => a - b);
    const memberRows = selectedIndices
      .map((index) => ({ index, question: questions?.[activeSubject.name]?.[index] }))
      .filter((row) => Boolean(row.question?.imageUrl));
    if (memberRows.length < 2) {
      showToast("Soru grubu için en az iki soru bulunmalıdır.");
      return;
    }

    const groupId = questionGroupEditingId || `qg-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
    const newQuestions = JSON.parse(JSON.stringify(questions || {}));
    if (!newQuestions[activeSubject.name]) newQuestions[activeSubject.name] = {};
    memberRows.forEach((row, order) => {
      newQuestions[activeSubject.name][row.index] = applyQuestionGroupMetadata(
        newQuestions[activeSubject.name][row.index],
        {
          id: groupId,
          mode: questionGroupDraft.mode,
          layout: questionGroupDraft.layout,
          order,
          size: memberRows.length,
          title: questionGroupDraft.title.trim(),
          instructionText: questionGroupDraft.instructionText.trim(),
          instructionImageUrl: questionGroupDraft.instructionImageUrl,
        },
      );
    });
    // Grup oluşturulduğu anda soruları mevcut ilk grup konumunda peş peşe getir.
    // Böylece yalnız PDF'de değil Soru İşlemleri ekranında da blok bütünlüğü korunur.
    newQuestions[activeSubject.name] = placeQuestionGroupMembersContiguously(
      newQuestions[activeSubject.name],
      groupId,
    );
    onUpdateExam({ ...exam, questions: newQuestions });

    try {
      const result = await persistQuestionGroupToBank(groupId, memberRows, questionGroupDraft);
      setQuestionGroupEditorOpen(false);
      resetQuestionGroupSelection();
      if (result.partial) {
        showToast("Soru grubu sınava kaydedildi. Klasörden yüklenen sorular yalnız bu sınavda gruba bağlı kalır; sistem soruları ayrıca soru bankasına kaydedildi.");
      } else if (result.persisted) {
        showToast(`${memberRows.length} soruluk yönerge grubu sınava ve soru bankasına kaydedildi.`);
      } else {
        showToast(`${memberRows.length} soruluk yönerge grubu sınava kaydedildi.`);
      }
    } catch (error) {
      setQuestionGroupEditorOpen(false);
      resetQuestionGroupSelection();
      showToast(`Grup sınava kaydedildi ancak soru bankasına yazılamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    }
  };

  const dissolveQuestionGroup = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject || !questionGroupEditingId) return;
    const groupId = questionGroupEditingId;
    const members = questionGroupMembers(groupId);
    const newQuestions = JSON.parse(JSON.stringify(questions || {}));
    members.forEach(({ index }) => {
      newQuestions[activeSubject.name][index] = clearQuestionGroupMetadata(newQuestions[activeSubject.name][index]);
    });
    onUpdateExam({ ...exam, questions: newQuestions });
    try {
      await fetch(`/api/question-bank/groups/${encodeURIComponent(groupId)}`, { method: "DELETE", cache: "no-store" });
    } catch {}
    setQuestionGroupEditorOpen(false);
    resetQuestionGroupSelection();
    showToast("Soru grubu çözüldü. Sorular artık bağımsız seçilebilir.");
  };

  useEffect(() => {
    resetQuestionGroupSelection();
    setQuestionGroupEditorOpen(false);
    setQuestionGroupEditingId("");
  }, [exam?.id, activeTestIndex, activeSubjectIndex]);

  const [teacherSelectionSyncing, setTeacherSelectionSyncing] = useState(false);
  const [teacherSelectionInfo, setTeacherSelectionInfo] = useState("");

  // Soru İşlemleri bileşeni sınav değiştiğinde aynı instance içinde kalabilir.
  // Önceki sınavın canlı öğretmen sorularını yeni sınav ekrana gelir gelmez temizle.
  useEffect(() => {
    setLiveTeacherQuestionsBySubject({});
    setTeacherSelectionInfo("");
  }, [exam?.id]);
  // Branş öğretmeni seçimi kontrollü select içinde sunucu cevabını beklerken
  // eski değere geri sıçramasın. Her ders için son kullanıcı seçimini yerelde tutarız.
  const [questionAssigneeDraftBySubject, setQuestionAssigneeDraftBySubject] = useState<Record<string, string>>({});
  const [questionAssigneeSavingBySubject, setQuestionAssigneeSavingBySubject] = useState<Record<string, boolean>>({});

  // Yönetici bir soruyu sınavdan sildiği anda sunucu cevabını beklemeden
  // 4 saniyelik öğretmen senkronuna karşı yerel olarak da engelle. Parent exam
  // güncellemesi geldiğinde aynı kimlikler kalıcı exclusion alanına taşınmış olur.
  const localExcludedTeacherQuestionIdsRef = useRef<Record<string, Set<string>>>({});

  useEffect(() => {
    const stored = exam?.teacherSelectionExcludedQuestionIdsBySubject || {};
    Object.entries(stored).forEach(([subject, ids]: any) => {
      const bucket = localExcludedTeacherQuestionIdsRef.current[subject] || new Set<string>();
      (Array.isArray(ids) ? ids : []).forEach((id: any) => {
        const value = String(id || "").trim();
        if (value) bucket.add(value);
      });
      localExcludedTeacherQuestionIdsRef.current[subject] = bucket;
    });
  }, [JSON.stringify(exam?.teacherSelectionExcludedQuestionIdsBySubject || {})]);

  const rememberLocallyExcludedQuestion = (subjectName: string, question: any) => {
    const questionId = String(
      question?.systemQuestionId || question?.questionId || question?.id || question?.question_id || question?.key || "",
    ).trim();
    if (!questionId) return "";
    const bucket = localExcludedTeacherQuestionIdsRef.current[subjectName] || new Set<string>();
    bucket.add(questionId);
    localExcludedTeacherQuestionIdsRef.current[subjectName] = bucket;
    return questionId;
  };

  const canonicalTeacherQuestionIdCandidates = (question: any) =>
    [...new Set([
      question?._selectionKey,
      question?.selectionKey,
      question?.questionId,
      question?.question_id,
      question?.id,
      question?.key,
      question?.questionCode,
      question?.code,
    ].map((value) => String(value || "").trim()).filter(Boolean))];

  const canonicalTeacherQuestionId = (question: any) =>
    String(
      question?.questionId ||
      question?.question_id ||
      question?.id ||
      question?._selectionKey ||
      question?.selectionKey ||
      question?.key ||
      question?.questionCode ||
      question?.code ||
      "",
    ).trim();

  const syncTeacherSelectionsToExam = async (silent = false) => {
    if (!exam?.id) return false;
    // Kilitli kitapçıkta öğretmenin daha sonra yaptığı seçimler de soru listesini
    // değiştiremez. Böylece kilit yalnız ekrandaki butonları değil canlı senkronu da kapsar.
    if (isQuestionEditingLocked) return true;
    setTeacherSelectionSyncing(true);
    try {
      const assignmentRows = Object.values(exam?.questionAssignments || {}) as any[];
      const exactAssignmentIds = [...new Set(
        assignmentRows
          .map((a:any) => String(a?.id || a?.__documentId || "").trim())
          .filter(Boolean),
      )];

      // En güvenilir yol: Soru İşlemleri ekranındaki sınavın kendi görev kimliklerini
      // tek tek sunucudan oku. Böylece sunucudaki exams kopyası güncel olmasa bile
      // öğretmenin telefonda yazdığı teacherTestAssignments kaydı doğrudan bulunur.
      const exactResults = await Promise.allSettled(
        exactAssignmentIds.map((assignmentId) =>
          fetch(`/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`, { cache: "no-store" }),
        ),
      );

      // Masaüstü kendi elindeki görev kimliklerini sunucuya gönderir. Bu uç doğrudan
      // teacherTestAssignments kaydını döndürür; exams kaydı veya tarayıcı önbelleği
      // geride olsa bile öğretmenin "Sisteme Gönder" yaptığı soru burada görünür.
      const assignmentRefs = assignmentRows.map((assignment:any) => ({
        id: String(assignment?.id || assignment?.__documentId || "").trim(),
        subject: String(assignment?.subject || assignment?.courseName || assignment?.lessonName || "").trim(),
      }));
      const structureSubjects = (Array.isArray(examStructure) ? examStructure : [])
        .flatMap((test:any) => Array.isArray(test?.subjects) ? test.subjects : [])
        .map((subject:any) => String(subject?.name || "").trim())
        .filter(Boolean);

      const [contextResult, collectionResult, scopedResult] = await Promise.allSettled([
        fetch("/api/question-bank/teacher-assignments/selected-for-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            assignmentRefs,
            subjects: structureSubjects,
            examId: String(exam?.id || ""),
            examCode: String(exam?.examCode || ""),
            examName: String(exam?.examName || exam?.name || ""),
            examType: String(exam?.examType || ""),
            gradeLevel: String(exam?.gradeLevel || exam?.grade || ""),
          }),
        }),
        fetch("/api/database/collections/teacherTestAssignments", { cache: "no-store" }),
        fetch(`/api/exams/${encodeURIComponent(String(exam.id))}/teacher-selections`, { cache: "no-store" }),
      ]);

      const parseBodyRows = (body:any): any[] => {
        if (Array.isArray(body?.assignments)) return body.assignments;
        if (Array.isArray(body)) return body;
        if (Array.isArray(body?.rows)) return body.rows;
        if (Array.isArray(body?.data)) return body.data;
        if (Array.isArray(body?.items)) return body.items;
        if (Array.isArray(body?.records)) return body.records;
        const single = body?.data || body?.item || body?.record || body;
        return single && typeof single === "object" && !Array.isArray(single) ? [single] : [];
      };

      const parseSettledResponse = async (result:any) => {
        if (result?.status !== "fulfilled") return [] as any[];
        const response:Response = result.value;
        const body:any = await response.json().catch(() => null);
        if (!response.ok) return [] as any[];
        return parseBodyRows(body);
      };

      const exactRowsNested = await Promise.all(exactResults.map(parseSettledResponse));
      const exactRows = exactRowsNested.flat();
      const contextRows:any[] = await parseSettledResponse(contextResult);
      const collectionRows:any[] = await parseSettledResponse(collectionResult);
      const scopedRows:any[] = await parseSettledResponse(scopedResult);
      if (!exactRows.length && !contextRows.length && !collectionRows.length && !scopedRows.length) {
        throw new Error("Öğretmen soru seçimleri sunucudan okunamadı.");
      }

      // Aynı görevi tek kayda indir. Genel liste ve sınava özel sonuçlardan sonra
      // tam görev-id ile okunan kayıt uygulanır; dolayısıyla masaüstü ekranda daima
      // öğretmenin en son kaydettiği committedQuestionKeys/snapshot'lar kullanılır.
      const rowMap = new Map<string, any>();
      [...collectionRows, ...scopedRows, ...exactRows, ...contextRows].forEach((row:any, index:number) => {
        const id = String(row?.id || row?.__documentId || row?.assignmentId || `row-${index}`).trim();
        const previous = rowMap.get(id) || {};
        const previousSnapshots = Array.isArray(previous?.selectedQuestionSnapshots) ? previous.selectedQuestionSnapshots.filter(Boolean) : [];
        const rowSnapshots = Array.isArray(row?.selectedQuestionSnapshots) ? row.selectedQuestionSnapshots.filter(Boolean) : [];
        // Sınava özel endpoint soru anahtarlarını bankadan hydrate ederek daha zengin
        // snapshot döndürebilir. Daha sonra gelen ham görev kaydı bu snapshot'ları silmesin.
        const selectedQuestionSnapshots = rowSnapshots.length ? rowSnapshots : previousSnapshots;
        rowMap.set(id, { ...previous, ...row, selectedQuestionSnapshots, id: row?.id || previous?.id || id });
      });
      const rows:any[] = [...rowMap.values()];
      const assignmentIds = new Set(
        assignmentRows
          .map((a:any) => String(a?.id || a?.__documentId || "").trim())
          .filter(Boolean),
      );
      const normalizeAssignmentLabel = (value:any) => String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i");
      const assignmentSubjects = new Set([
        ...assignmentRows
          .map((a:any) => normalizeAssignmentLabel(a?.subject || a?.courseName || a?.lessonName || ""))
          .filter(Boolean),
        ...(Array.isArray(examStructure) ? examStructure : [])
          .flatMap((test:any) => Array.isArray(test?.subjects) ? test.subjects : [])
          .map((subject:any) => normalizeAssignmentLabel(subject?.name || ""))
          .filter(Boolean),
        normalizeAssignmentLabel(exam?.selectedCourseName || ""),
      ].filter(Boolean));
      const examId = String(exam?.id || "").trim();
      const examCode = String(exam?.examCode || "").trim();
      const examName = normalizeAssignmentLabel(exam?.examName || exam?.name || "");
      // KRİTİK: Yeni bir sınav, sınıf + ders + sınav türü aynı diye eski sınavın
      // öğretmen seçimini devralmamalıdır. Eşleştirme yalnız bu sınava ait kesin
      // kimliklerle yapılır: görev id'si, sınav id'si veya benzersiz sınav kodu.
      // Ders/sınıf/tür ve yalnız sınav adı üzerinden yapılan gevşek eşleştirme
      // eski Ünite Denemesi / Ders Denemesi sorularını yeni kayda taşıyordu.
      const sameExam = rows.filter((a:any) => {
        const assignmentId = String(a?.id || a?.__documentId || a?.assignmentId || "").trim();
        const rowExamId = String(a?.examId || a?.testId || "").trim();
        const rowExamCode = String(a?.examCode || "").trim();

        const exactAssignmentMatch = Boolean(assignmentId && assignmentIds.has(assignmentId));
        const exactExamIdMatch = Boolean(examId && rowExamId && rowExamId === examId);
        const exactExamCodeMatch = Boolean(examCode && rowExamCode && rowExamCode === examCode);

        return exactAssignmentMatch || exactExamIdMatch || exactExamCodeMatch;
      });
      if (!sameExam.length) {
        setLiveTeacherQuestionsBySubject({});
        setTeacherSelectionInfo("Bu sınav için öğretmen görevi bulunamadı.");
        return false;
      }
      // Tek kaynak teacherTestAssignments kaydıdır. Eski API sürümleri
      // selectionProtocolVersion alanını yazmadığı için geçerli snapshot/anahtar
      // varsa protokol numarasına bakmadan aynı kesin seçim olarak kabul edilir.
      const assignmentProgress = (a:any) => {
        const snapshots = Array.isArray(a?.selectedQuestionSnapshots)
          ? a.selectedQuestionSnapshots.filter(Boolean)
          : [];
        const keys = Array.isArray(a?.committedQuestionKeys)
          ? a.committedQuestionKeys.filter(Boolean)
          : Array.isArray(a?.selectedQuestionKeys)
            ? a.selectedQuestionKeys.filter(Boolean)
            : [];
        const requiredCount = Number(a?.requiredQuestionCount || a?.maxQuestionCount || a?.requiredCount || 0);
        return { selectedCount: Math.max(snapshots.length, keys.length), requiredCount, isComplete: !!a?.completedAt };
      };
      const incomplete = sameExam.filter((a:any) => !assignmentProgress(a).isComplete);
      const nextQuestions:any = JSON.parse(JSON.stringify(exam.questions || {}));
      const liveBySubject: Record<string, any[]> = {};
      let imported = 0;

      // Öğretmenin telefonda yaptığı seçimler görev tamamlanmayı beklemeden canlı olarak
      // sınava aktarılır. Böylece ayrıca "Öğretmen Seçimlerini Al" butonuna ihtiyaç kalmaz.
      const normalizeSubject = (value:any) => String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i");

      sameExam.forEach((a:any) => {
        const subject = String(a?.__resolvedSubjectName || a?.courseName || a?.subject || a?.courseId || "").trim();
        if (!subject) return;
        const subjectNorm = normalizeSubject(subject);
        const structureSubject = (examStructure || [])
          .flatMap((test:any) => Array.isArray(test?.subjects) ? test.subjects : [])
          .find((item:any) => normalizeSubject(item?.name) === subjectNorm);
        const existingQuestionKey = Object.keys(nextQuestions || {})
          .find((key) => normalizeSubject(key) === subjectNorm);
        const subjectKey = String(structureSubject?.name || existingQuestionKey || subject);
        // Tek kaynak: teacherTestAssignments içindeki gönderilmiş soru snapshot'ları.
        // Backend yeniden başlatılmamış/eski sürümde olsa bile aynı kaydı okuyabilmek
        // için selectionProtocolVersion zorunlu değildir.
        const snaps:any[] = Array.isArray(a?.selectedQuestionSnapshots)
          ? a.selectedQuestionSnapshots.filter(Boolean)
          : [];
        const rawCommittedKeys:any[] = Array.isArray(a?.committedQuestionKeys)
          ? a.committedQuestionKeys
          : Array.isArray(a?.selectedQuestionKeys)
            ? a.selectedQuestionKeys
            : [];
        const committedIds = new Set([
          ...rawCommittedKeys.map((item:any) => String(item || "").trim()).filter(Boolean),
          ...snaps.map((q:any) => canonicalTeacherQuestionId(q)).filter(Boolean),
        ]);

        const existingManual = Object.values(nextQuestions[subjectKey] || {})
          .filter((question: any) => question?.imageUrl && question?.source !== "teacher-selection");
        const teacherIds = new Set(
          snaps.map((question: any) => canonicalTeacherQuestionId(question)).filter(Boolean),
        );
        const manualWithoutDuplicates = existingManual.filter((question: any) => {
          const id = String(question?.systemQuestionId || question?.questionId || question?.id || "").trim();
          return !id || !teacherIds.has(id);
        });

        // Snapshot eksik olsa bile committedQuestionKeys kesin seçim kaynağıdır.
        // Her anahtar için bir satır üret; varsa snapshot ile zenginleştir. Böylece öğretmen
        // ekranında gönderilmiş görünen soru masaüstünde hiçbir zaman kaybolmaz.
        const sourceRows:any[] = [...committedIds].map((questionId) => {
          const snapshot = snaps.find((q:any) => canonicalTeacherQuestionIdCandidates(q).includes(questionId));
          return snapshot ? { ...snapshot, questionId } : { id: questionId, questionId, _selectionKey: questionId };
        });
        const teacherQuestions = sourceRows.map((q:any) => {
          const canonicalId = canonicalTeacherQuestionId(q) ||
            canonicalTeacherQuestionIdCandidates(q).find((id) => committedIds.has(id)) || "";
          const imageUrl = String(
            q?.imageUrl || q?.image_url || q?.thumbnailUrl || q?.thumbnail_url ||
            q?.storagePath || q?.storage_path ||
            (canonicalId ? `/api/question-bank/images/${encodeURIComponent(canonicalId)}` : ""),
          );

          // Yönetici Soru İşlemleri ekranında cevabı veya müfredatı elle
          // düzelttiyse 4 saniyelik öğretmen senkronu bu düzeltmeyi eski
          // assignment snapshot'ıyla geri alamaz.
          const existingTeacherQuestion = Object.values(nextQuestions[subjectKey] || {})
            .find((existing: any) =>
              canonicalTeacherQuestionId(existing) === canonicalId ||
              canonicalTeacherQuestionIdCandidates(existing).includes(canonicalId),
            ) as any;
          const preserveAnswer = Boolean(existingTeacherQuestion?.answerManuallyCorrected);
          const preserveCurriculum = Boolean(existingTeacherQuestion?.curriculumManuallyCorrected);

          const snapshotUnit = q?.unitName || q?.unit_name || q?.unit || q?.systemUnitName || "";
          const snapshotTopic = q?.topicName || q?.topic_name || q?.topic || q?.systemTopicName || "";
          const snapshotOutcome = q?.outcomeName || q?.outcome_name || q?.outcome || q?.systemOutcomeName || "";

          imported++;
          return {
            id: canonicalId,
            questionId: canonicalId,
            imageUrl,
            correctAnswer: preserveAnswer
              ? String(existingTeacherQuestion?.correctAnswer || existingTeacherQuestion?.answer || "")
              : String(q?.correctAnswer || q?.answer || q?.correct_answer || ""),
            answer: preserveAnswer
              ? String(existingTeacherQuestion?.answer || existingTeacherQuestion?.correctAnswer || "")
              : String(q?.answer || q?.correctAnswer || q?.correct_answer || ""),
            correct_answer: preserveAnswer
              ? String(existingTeacherQuestion?.correct_answer || existingTeacherQuestion?.correctAnswer || existingTeacherQuestion?.answer || "")
              : String(q?.correct_answer || q?.correctAnswer || q?.answer || ""),
            answerManuallyCorrected: preserveAnswer || Boolean(q?.answerManuallyCorrected),
            answerUpdatedAt: preserveAnswer
              ? String(existingTeacherQuestion?.answerUpdatedAt || "")
              : String(q?.answerUpdatedAt || ""),
            // Öğretmen mobilindeki snapshot müfredat bilgisini kaybetmeden taşı.
            // Yönetici elle değiştirdiyse ise sınav üzerindeki kesin kayıt önceliklidir.
            unit: preserveCurriculum ? String(existingTeacherQuestion?.unit || "") : String(snapshotUnit),
            topic: preserveCurriculum ? String(existingTeacherQuestion?.topic || "") : String(snapshotTopic),
            outcome: preserveCurriculum ? String(existingTeacherQuestion?.outcome || "") : String(snapshotOutcome),
            unitName: preserveCurriculum ? String(existingTeacherQuestion?.unitName || existingTeacherQuestion?.unit || "") : String(snapshotUnit),
            topicName: preserveCurriculum ? String(existingTeacherQuestion?.topicName || existingTeacherQuestion?.topic || "") : String(snapshotTopic),
            outcomeName: preserveCurriculum ? String(existingTeacherQuestion?.outcomeName || existingTeacherQuestion?.outcome || "") : String(snapshotOutcome),
            systemQuestionId: canonicalId,
            systemCourseId: preserveCurriculum
              ? String(existingTeacherQuestion?.systemCourseId || q?.courseId || q?.course_id || a?.courseId || a?.course_id || "")
              : String(q?.courseId || q?.course_id || a?.courseId || a?.course_id || ""),
            systemUnitId: preserveCurriculum
              ? String(existingTeacherQuestion?.systemUnitId || existingTeacherQuestion?.unitId || "")
              : String(q?.systemUnitId || q?.unitId || q?.unit_id || ""),
            systemTopicId: preserveCurriculum
              ? String(existingTeacherQuestion?.systemTopicId || existingTeacherQuestion?.topicId || "")
              : String(q?.systemTopicId || q?.topicId || q?.topic_id || ""),
            systemOutcomeId: preserveCurriculum
              ? String(existingTeacherQuestion?.systemOutcomeId || existingTeacherQuestion?.outcomeId || "")
              : String(q?.systemOutcomeId || q?.outcomeId || q?.outcome_id || ""),
            unitId: preserveCurriculum
              ? String(existingTeacherQuestion?.unitId || existingTeacherQuestion?.systemUnitId || "")
              : String(q?.unitId || q?.unit_id || q?.systemUnitId || ""),
            topicId: preserveCurriculum
              ? String(existingTeacherQuestion?.topicId || existingTeacherQuestion?.systemTopicId || "")
              : String(q?.topicId || q?.topic_id || q?.systemTopicId || ""),
            outcomeId: preserveCurriculum
              ? String(existingTeacherQuestion?.outcomeId || existingTeacherQuestion?.systemOutcomeId || "")
              : String(q?.outcomeId || q?.outcome_id || q?.systemOutcomeId || ""),
            curriculumManuallyCorrected: preserveCurriculum || Boolean(q?.curriculumManuallyCorrected),
            curriculumUpdatedAt: preserveCurriculum
              ? String(existingTeacherQuestion?.curriculumUpdatedAt || "")
              : String(q?.curriculumUpdatedAt || ""),
            columnSpan: Number(q?.columnSpan || existingTeacherQuestion?.columnSpan || 1) === 2 ? 2 : 1,
            teacherAssignmentId: String(a?.id || a?.__documentId || ""),
            teacherId: String(a?.teacherId || ""),
            source: "teacher-selection",
          };
        }).filter((question:any) => Boolean(question?.id));

        liveBySubject[subjectKey] = teacherQuestions;
        nextQuestions[subjectKey] = Object.fromEntries(
          [...teacherQuestions, ...manualWithoutDuplicates].map((question: any, index: number) => [index, question]),
        );
      });

      setLiveTeacherQuestionsBySubject(liveBySubject);

      let nextStructure = examStructure;
      if (isFlexibleCourseBasedExam) {
        nextStructure = JSON.parse(JSON.stringify(examStructure));
        for (const test of nextStructure) {
          for (const subject of (test.subjects || [])) {
            const count = Object.values(nextQuestions[subject.name] || {}).filter((q:any) => q?.imageUrl).length;
            subject.count = count;
          }
        }
      }

      const questionsChanged = JSON.stringify(nextQuestions) !== JSON.stringify(exam.questions || {});
      const structureChanged = JSON.stringify(nextStructure) !== JSON.stringify(examStructure);
      if (questionsChanged || structureChanged) {
        onUpdateExam({
          ...exam,
          questions: nextQuestions,
          examStructure: nextStructure,
          teacherSelectionImportedAt: new Date().toISOString(),
        });
      }
      const message = incomplete.length
        ? `${imported} soru otomatik aktarıldı. ${incomplete.length} öğretmen görevi devam ediyor.`
        : `${imported} öğretmen seçimi sınava otomatik aktarıldı.`;
      setTeacherSelectionInfo(message);
      if (!silent) showToast(message);
      return incomplete.length === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Öğretmen seçimleri alınamadı.";
      setTeacherSelectionInfo(message);
      if (!silent) showToast(message);
      return false;
    } finally { setTeacherSelectionSyncing(false); }
  };

  useEffect(() => {
    if (activeTab !== "questions" || !exam?.id) return;

    let disposed = false;
    const sync = () => {
      if (!disposed) void syncTeacherSelectionsToExam(true);
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [
    activeTab,
    exam?.id,
    exam?.examCode,
    JSON.stringify(exam?.questionAssignments || {}),
    JSON.stringify(exam?.questions || {}),
    Boolean(exam?.bookletLayoutLock?.questionsLocked),
  ]);

  const removeTeacherSelectionAtSource = async (question: any, subjectName: string) => {
    // Soruyu kimin seçtiğine bakma. Yönetici çöp kutusuna bastığında aynı soru
    // aktif bir öğretmen görevinde bulunuyorsa görev kaydından da temizlenir.
    const questionId = String(
      question?.systemQuestionId || question?.questionId || question?.id || question?.question_id || question?.key || "",
    ).trim();
    if (!questionId) {
      showToast("Soru sınavdan kaldırılıyor; öğretmen görev kaydında soru kimliği bulunamadı.");
      return true;
    }

    const assignmentId = String(question?.teacherAssignmentId || "").trim();
    try {
      const response = await fetch(
        "/api/question-bank/teacher-assignments/remove-selected-question-by-context",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            assignmentId,
            examId: String(exam?.id || ""),
            examCode: String(exam?.examCode || ""),
            subjectName,
          }),
          cache: "no-store",
        },
      );
      if (response.ok) return true;

      if (assignmentId) {
        const fallback = await fetch(
          `/api/question-bank/teacher-assignments/${encodeURIComponent(assignmentId)}/remove-selected-question`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId }),
            cache: "no-store",
          },
        );
        if (fallback.ok) return true;
      }

      const body = await response.json().catch(() => ({}));
      console.warn(
        "Öğretmen seçimi görevden temizlenemedi; soru sınavdan yine de kaldırılacak.",
        body?.error || response.status,
      );
    } catch (error) {
      console.warn(
        "Öğretmen seçimi görevden temizlenemedi; soru sınavdan yine de kaldırılacak.",
        error,
      );
    }

    // Görev temizliği hata verse dahi çöp kutusunun sınavdan kaldırma işlemini
    // engelleme. Sınavdaki exclusion kaydı 4 saniyelik senkronun geri eklemesini önler.
    return true;
  };

  // structure: { [subjectName]: { [index]: { imageUrl, fileName, grade, unit, topic, outcome } } }

  const findDuplicateQuestionContent = (fileName: string, subjectName: string) => {
    for (const dExam of allExams) {
      if (dExam.id === exam.id) continue;
      const dQuestions = dExam.questions || {};
      const subjectQuestions = dQuestions[subjectName] || {};
      for (const qIndex in subjectQuestions) {
        if (subjectQuestions[qIndex]?.fileName === fileName) {
          return { examName: replaceLegacyExamTerminology(dExam.examName), questionNumber: parseInt(qIndex) + 1 };
        }
      }
    }
    const subjectQuestions = (exam.questions || {})[subjectName] || {};
    for (const qIndex in subjectQuestions) {
       if (subjectQuestions[qIndex]?.fileName === fileName) {
          return { examName: replaceLegacyExamTerminology(exam.examName), questionNumber: parseInt(qIndex) + 1 };
       }
    }
    return null;
  };

  const handleQuestionClick = (index: number) => {
    setActiveQuestion({
      testIndex: activeTestIndex,
      subjectIndex: activeSubjectIndex,
      questionIndex: index,
    });
  };

  const handleModalClose = () => {
    setActiveQuestion(null);
  };

  const [selectedBankFolderId, setSelectedBankFolderId] = useState<string | null>(null);
  const getExamQuestionNumberingMode = (sourceExam: any): "restart-per-subject" | "continuous" => {
    const examType = String(sourceExam?.examType || sourceExam?.type || "").trim().toLocaleUpperCase("tr-TR");
    const examModel = String(sourceExam?.branchExamModel || "").trim().toLocaleUpperCase("tr-TR");
    // TYT/AYT türü veya Branşlar Denemesi TYT/AYT modeli: dersler arasında
    // soru numarası aynı test boyunca devam eder; yeni test 1'den başlar.
    if (examType === "TYT" || examType === "AYT" ||
        (examType === "BRANŞLAR DENEMESİ" && (examModel === "TYT" || examModel === "AYT"))) {
      return "continuous";
    }
    return sourceExam?.questionNumberingMode === "continuous" || sourceExam?.continueQuestionNumbers === true
      ? "continuous"
      : "restart-per-subject";
  };

  const [questionNumberingMode, setQuestionNumberingMode] = useState<"restart-per-subject" | "continuous">(
    () => getExamQuestionNumberingMode(exam),
  );

  // Yeni Sınav Tanımla / Sınavı Güncelle ekranındaki
  // "Soru numaraları devam etsin" seçeneğini PDF hazırlık ekranına taşı.
  // Özellikle Sosyal Bilimler (Tarih-Coğrafya-Felsefe-Din) ve Fen Bilimleri
  // (Fizik-Kimya-Biyoloji) içindeki ders geçişlerinde numara kaldığı yerden devam eder.
  useEffect(() => {
    setQuestionNumberingMode(getExamQuestionNumberingMode(exam));
  }, [exam?.id, exam?.examType, exam?.branchExamModel, exam?.questionNumberingMode, exam?.continueQuestionNumbers]);

  // Branşlar Denemesi sınavlarının TYT/AYT modelleri de test > ders yapısını korur.
  // Serbest modelde her ders kendi testidir; mevcut düz liste davranışı korunur.
  const examTypeForQuestionManager = String(exam?.examType || exam?.type || "").trim().toLocaleUpperCase("tr-TR");
  const isTytQuestionManager = examTypeForQuestionManager === "TYT" ||
    examTypeForQuestionManager === "AYT" ||
    (examTypeForQuestionManager === "BRANŞLAR DENEMESİ" &&
      ["TYT", "AYT"].includes(String(exam?.branchExamModel || "").trim().toLocaleUpperCase("tr-TR")));
  const tytAreaDisplayName = (test: any) => {
    const raw = String(test?.testName || test?.name || "Alan").replace(/\s+Testi$/iu, "").trim();
    const key = raw.toLocaleUpperCase("tr-TR");
    if (key.includes("SOSYAL BİLİMLER") || key.includes("SOSYAL BILIMLER")) return "Sosyal Bilimler";
    if (key.includes("FEN BİLİMLERİ") || key.includes("FEN BILIMLERI")) return "Fen Bilimleri";
    if (key.includes("TEMEL MATEMATİK") || key.includes("TEMEL MATEMATIK") || key === "MATEMATİK" || key === "MATEMATIK") return "Matematik";
    if (key.includes("TÜRKÇE") || key.includes("TURKCE")) return "Türkçe";
    return raw || "Alan";
  };

  const currentSubjectName =
    examStructure[activeTestIndex]?.subjects[activeSubjectIndex]?.name || "";

  const normalizeSystemQuestionLabel = (value: unknown) =>
    String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
      .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
      .replace(/\([^)]*\)/g, "").replace(/\b(dersi|ders)\b/g, "")
      .replace(/[^a-z0-9]/g, "");

  // Müfredat kayıtlarının bazı eski sürümlerinde kimlikler boş olup yalnız adlar tutuluyor.
  // Sistemden soru seçiminde ünite / konu / kazanımın yine de seçilebilir ve filtrelenebilir
  // olması için kimlik yoksa normalize edilmiş addan kararlı bir değer üret.
  const systemCurriculumUnitValue = (row: any) => {
    const label = String(row?.unitName || row?.unit_name || row?.unit || row?.systemUnitName || "").trim();
    if (label) return `name:${normalizeSystemQuestionLabel(label)}`;
    return String(row?.unitId || row?.unit_id || row?.systemUnitId || "").trim();
  };

  const systemCurriculumTopicValue = (row: any) => {
    const label = String(row?.topicName || row?.topic_name || row?.topic || row?.systemTopicName || "").trim();
    if (label) return `name:${normalizeSystemQuestionLabel(label)}`;
    return String(row?.topicId || row?.topic_id || row?.systemTopicId || "").trim();
  };

  const systemCurriculumOutcomeValue = (row: any) => {
    const label = String(row?.outcomeName || row?.outcome_name || row?.outcome || row?.systemOutcomeName || "").trim();
    if (label) return `name:${normalizeSystemQuestionLabel(label)}`;
    return String(row?.outcomeId || row?.outcome_id || row?.systemOutcomeId || "").trim();
  };

  const normalizeBlueprintScopeRow = (scope: any) => ({
    ...scope,
    subject: String(scope?.subject || scope?.courseName || scope?.lessonName || scope?.lesson || "").trim(),
    courseId: String(scope?.courseId || scope?.course_id || scope?.curriculumCourseId || "").trim(),
    grade: String(scope?.grade || scope?.gradeLevel || exam?.gradeLevel || "").match(/\d{1,2}/)?.[0] || "",
    unitId: String(scope?.unitId || scope?.unit_id || scope?.selectedUnitId || scope?.unit?.id || "").trim(),
    unitName: String(scope?.unitName || scope?.unit_name || scope?.selectedUnitName || scope?.unit?.name || scope?.unit || "").trim(),
    topicId: String(scope?.topicId || scope?.topic_id || scope?.selectedTopicId || scope?.topic?.id || "").trim(),
    topicName: String(scope?.topicName || scope?.topic_name || scope?.selectedTopicName || scope?.topic?.name || scope?.topic || "").trim(),
    outcomeId: String(scope?.outcomeId || scope?.outcome_id || scope?.selectedOutcomeId || scope?.outcome?.id || "").trim(),
    outcomeName: String(scope?.outcomeName || scope?.outcome_name || scope?.selectedOutcomeName || scope?.outcome?.name || scope?.outcome || "").trim(),
  });

  const getAllExamCurriculumScopes = () => {
    const collected: any[] = [];
    const blueprintRows = Array.isArray(exam?.questionBlueprint)
      ? exam.questionBlueprint
      : [];

    // Sınavın güncel questionBlueprint kaydı varsa kapsamın tek gerçek kaynağı odur.
    // Öğretmen görevinin eski scopes alanını bununla birleştirmek, güncellemede
    // çıkarılmış bir ünitenin tekrar kapsama dönmesine neden oluyordu.
    if (blueprintRows.length > 0) {
      collected.push(...blueprintRows);
    } else {
      Object.values(exam?.questionAssignments || {}).forEach((assignment: any) => {
        if (Array.isArray(assignment?.scopes)) {
          assignment.scopes.forEach((scope: any) => collected.push({
            ...scope,
            subject: scope?.subject || assignment?.subject || assignment?.courseName || "",
            courseId: scope?.courseId || assignment?.courseId || "",
            grade: scope?.grade || assignment?.grade || exam?.gradeLevel || "",
          }));
        }
      });
    }

    // Eski sınav kayıtlarıyla uyumluluk: kapsam bazı sürümlerde doğrudan sınavın üzerinde tutuluyordu.
    const directScope = normalizeBlueprintScopeRow({
      subject: currentSubjectName || exam?.selectedCourseName || "",
      courseId: exam?.selectedCourseId || exam?.courseId || "",
      grade: exam?.gradeLevel || "",
      unitId: exam?.selectedUnitId || exam?.unitId || "",
      unitName: exam?.selectedUnitName || exam?.unitName || exam?.unit || "",
      topicId: exam?.selectedTopicId || exam?.topicId || "",
      topicName: exam?.selectedTopicName || exam?.topicName || exam?.topic || "",
      outcomeId: exam?.selectedOutcomeId || exam?.outcomeId || "",
      outcomeName: exam?.selectedOutcomeName || exam?.outcomeName || exam?.outcome || "",
    });
    if (directScope.unitId || directScope.unitName || directScope.topicId || directScope.topicName || directScope.outcomeId || directScope.outcomeName) {
      collected.push(directScope);
    }

    const unique = new Map<string, any>();
    collected.map(normalizeBlueprintScopeRow).forEach((scope: any) => {
      if (!(scope.unitId || scope.unitName || scope.topicId || scope.topicName || scope.outcomeId || scope.outcomeName)) return;
      const key = [scope.courseId, scope.grade, normalizeSystemQuestionLabel(scope.subject), scope.unitId, normalizeSystemQuestionLabel(scope.unitName), scope.topicId, normalizeSystemQuestionLabel(scope.topicName), scope.outcomeId, normalizeSystemQuestionLabel(scope.outcomeName)].join("|");
      if (!unique.has(key)) unique.set(key, scope);
    });
    return Array.from(unique.values());
  };

  const getActiveSubjectBlueprintScopes = () => {
    const allScopes = getAllExamCurriculumScopes();
    const subjectKey = normalizeSystemQuestionLabel(currentSubjectName);
    const bySubject = allScopes.filter((scope: any) => {
      const scopeSubject = normalizeSystemQuestionLabel(scope?.subject || scope?.courseName || "");
      return Boolean(scopeSubject && subjectKey && (scopeSubject === subjectKey || scopeSubject.includes(subjectKey) || subjectKey.includes(scopeSubject)));
    });
    if (bySubject.length > 0) return bySubject;

    const selectedCourseIds = Array.isArray(exam?.selectedCourseIds)
      ? exam.selectedCourseIds.map((value: any) => String(value || "")).filter(Boolean)
      : [];
    const singleSelectedCourseId = selectedCourseIds.length === 1
      ? selectedCourseIds[0]
      : String(exam?.selectedCourseId || exam?.courseId || "").trim();
    if (singleSelectedCourseId) {
      const byCourse = allScopes.filter((scope: any) => String(scope?.courseId || "") === singleSelectedCourseId);
      if (byCourse.length > 0) return byCourse;
    }

    // Tek dersli Branş/Ünite sınavlarında eski kayıtta ders adı değişmiş olsa bile kapsamı kaybetmeyelim.
    const structureSubjects = (examStructure || []).flatMap((test: any) => test?.subjects || []);
    if (structureSubjects.length === 1 && allScopes.length > 0) return allScopes;
    return [];
  };

  const activeCurriculumScopes = getActiveSubjectBlueprintScopes();
  const currentSubjectKey = normalizeSystemQuestionLabel(currentSubjectName);
  const currentCurriculumCourseId = String(
    activeCurriculumScopes.find((scope: any) => String(scope?.courseId || "").trim())?.courseId ||
      ((Array.isArray(exam?.selectedCourseIds) && exam.selectedCourseIds.length === 1) ? exam.selectedCourseIds[0] : "") ||
      exam?.selectedCourseId ||
      "",
  );

  // Soru kartlarında görünen numara ders içi indeks değildir.
  // "Soru numaraları devam etsin" seçiliyse aynı test içindeki önceki derslerin
  // soru sayıları toplanır. Örn. Sosyal Bilimler: Tarih 1-5 ise Coğrafya 6'dan,
  // Felsefe 11'den, Din Kültürü 16'dan başlar. Yeni teste geçildiğinde sayaç yeniden başlar.
  const getQuestionDisplayNumber = (
    testIndex: number,
    subjectIndex: number,
    localQuestionIndex: number,
  ) => {
    if (questionNumberingMode !== "continuous") return localQuestionIndex + 1;
    const test = examStructure[testIndex];
    const subjects = Array.isArray(test?.subjects) ? test.subjects : [];
    const previousCount = subjects
      .slice(0, Math.max(0, subjectIndex))
      .reduce((sum: number, subject: any) => sum + Math.max(0, Number(subject?.count || 0)), 0);
    return previousCount + localQuestionIndex + 1;
  };

  const activeSubjectStartNumber = getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, 0);

  const systemQuestionMatchesScope = (question: any, scope: any) => {
    const normalize = (value: any) => normalizeSystemQuestionLabel(value);
    const sameIdOrName = (
      expectedId: any,
      actualId: any,
      expectedName: any,
      actualName: any,
    ) => {
      const expectedIdText = String(expectedId || "").trim();
      const actualIdText = String(actualId || "").trim();
      if (expectedIdText && actualIdText && expectedIdText === actualIdText) return true;
      const expectedNameText = normalize(expectedName);
      const actualNameText = normalize(actualName);
      if (!expectedIdText && !expectedNameText) return true;
      return Boolean(expectedNameText && actualNameText && expectedNameText === actualNameText);
    };

    return (
      sameIdOrName(
        scope?.unitId,
        question?.unitId || question?.unit_id,
        scope?.unitName,
        question?.unitName || question?.unit_name || question?.unit,
      ) &&
      sameIdOrName(
        scope?.topicId,
        question?.topicId || question?.topic_id,
        scope?.topicName,
        question?.topicName || question?.topic_name || question?.topic,
      ) &&
      sameIdOrName(
        scope?.outcomeId,
        question?.outcomeId || question?.outcome_id,
        scope?.outcomeName,
        question?.outcomeName || question?.outcome_name || question?.outcome,
      )
    );
  };

  const canonicalCurriculumCourseId = (value: unknown) =>
    String(value || "").trim().replace(/^CURR-(?:9|10|11|12)-/i, "");

  // Müfredat ekranındaki canonical soru sayımı courseId'yi yalnız sınav kaydından
  // okumaz; ünite/konu/kazanım hiyerarşisindeki 9.3.... biçiminden de gerçek
  // ders kimliğini çıkarır. Sistemden soru seçimi de aynı kuralı kullanmalı.
  const canonicalCurriculumCourseIdFromHierarchy = (
    fallbackCourseId: unknown,
    unitId: unknown,
    topicId: unknown,
    outcomeId: unknown = "",
  ) => {
    for (const value of [outcomeId, topicId, unitId]) {
      const parts = String(value || "").split(".").filter(Boolean);
      if (parts.length >= 2 && /^(9|10|11|12)$/.test(parts[0])) return parts[1];
    }
    return canonicalCurriculumCourseId(fallbackCourseId);
  };

  const sameCurriculumNode = (
    wantedId: unknown,
    wantedName: unknown,
    nodeId: unknown,
    nodeName: unknown,
  ) => {
    const wi = String(wantedId || "").trim();
    const ni = String(nodeId || "").trim();
    if (wi && ni && wi === ni) return true;
    const wn = normalizeSystemQuestionLabel(wantedName);
    const nn = normalizeSystemQuestionLabel(nodeName);
    return Boolean(wn && nn && wn === nn);
  };

  // Sınav kaydındaki scope eski bir id/name taşısa bile onu ekrandaki tek otorite
  // müfredat ağacındaki güncel düğüme bağla. Böylece soru bankasının canonical
  // id'leriyle karşılaştırma isim/alias farkından dolayı sıfıra düşmez.
  const resolvePickerScopeAgainstCurriculum = (scope: any) => {
    const source = normalizeBlueprintScopeRow(scope || {});
    const unit = (curriculumTree || []).find((row: any) =>
      sameCurriculumNode(source.unitId, source.unitName, row?.id, row?.name),
    );
    if (!unit) return source;

    const topic = source.topicId || source.topicName
      ? (unit.topics || []).find((row: any) =>
          sameCurriculumNode(source.topicId, source.topicName, row?.id, row?.name),
        )
      : null;
    const outcome = topic && (source.outcomeId || source.outcomeName)
      ? (topic.outcomes || []).find((row: any) =>
          sameCurriculumNode(source.outcomeId, source.outcomeName, row?.id, row?.name),
        )
      : null;

    return {
      ...source,
      unitId: String(unit?.id || source.unitId || ""),
      unitName: String(unit?.name || source.unitName || ""),
      topicId: String(topic?.id || source.topicId || ""),
      topicName: String(topic?.name || source.topicName || ""),
      outcomeId: String(outcome?.id || source.outcomeId || ""),
      outcomeName: String(outcome?.name || source.outcomeName || ""),
    };
  };

  const enrichCanonicalQuestionCurriculum = (question: any) => {
    const unitId = String(question?.unitId || question?.unit_id || question?.systemUnitId || "").trim();
    const topicId = String(question?.topicId || question?.topic_id || question?.systemTopicId || "").trim();
    const outcomeId = String(question?.outcomeId || question?.outcome_id || question?.systemOutcomeId || "").trim();

    let unit = (curriculumTree || []).find((row: any) => String(row?.id || "").trim() === unitId);
    if (!unit) {
      unit = (curriculumTree || []).find((row: any) =>
        normalizeSystemQuestionLabel(row?.name) === normalizeSystemQuestionLabel(question?.unitName || question?.unit_name || question?.unit),
      );
    }

    let topic = unit && (unit.topics || []).find((row: any) => String(row?.id || "").trim() === topicId);
    if (!topic && unit) {
      topic = (unit.topics || []).find((row: any) =>
        normalizeSystemQuestionLabel(row?.name) === normalizeSystemQuestionLabel(question?.topicName || question?.topic_name || question?.topic),
      );
    }

    let outcome = topic && (topic.outcomes || []).find((row: any) => String(row?.id || "").trim() === outcomeId);
    if (!outcome && topic) {
      outcome = (topic.outcomes || []).find((row: any) =>
        normalizeSystemQuestionLabel(row?.name) === normalizeSystemQuestionLabel(question?.outcomeName || question?.outcome_name || question?.outcome),
      );
    }

    return {
      ...question,
      unitId,
      topicId,
      outcomeId,
      unitName: String(question?.unitName || question?.unit_name || question?.unit || unit?.name || ""),
      topicName: String(question?.topicName || question?.topic_name || question?.topic || topic?.name || ""),
      outcomeName: String(question?.outcomeName || question?.outcome_name || question?.outcome || outcome?.name || ""),
    };
  };

  const openSystemQuestionPicker = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    const grade = Number(String(exam?.gradeLevel === "YKS" ? "12" : exam?.gradeLevel || "").match(/\d{1,2}/)?.[0] || 0);
    if (!grade || !currentSubjectName) {
      showToast("Sistem sorularını açmak için sınavın sınıf düzeyi ve dersi belirlenmelidir.");
      return;
    }

    const isScopedCourseExam = isCourseBasedExamType(exam?.examType);
    const rawSelectedScopes = getActiveSubjectBlueprintScopes();
    let selectedScopes = rawSelectedScopes;

    // Ünite Denemesi tek ders içinde bir veya birden fazla üniteyi kapsayabilir.
    // Her seçili ünite sınavda tam ünite kapsamı olarak kullanılır; konu/kazanım
    // sınav tanımında ayrıca daraltılmaz.
    if (isUnitScanExam && rawSelectedScopes.length > 0) {
      const unitMap = new Map<string, any>();
      rawSelectedScopes.forEach((scope: any) => {
        const key = String(scope?.unitId || "").trim() || `name:${normalizeSystemQuestionLabel(scope?.unitName)}`;
        if (!key || unitMap.has(key)) return;
        unitMap.set(key, {
          ...scope,
          topicId: "",
          topicName: "",
          outcomeId: "",
          outcomeName: "",
          scopeType: "unit",
          includeAllTopics: true,
          includeAllOutcomes: true,
        });
      });
      selectedScopes = Array.from(unitMap.values());
    }

    // Ekranda kullanılacak scope'ları authoritative müfredat ağacındaki gerçek
    // kimliklere çevir. Özellikle yeni oluşturulan aynı ders/tür sınavlarında eski
    // scope alias'ı kalmışsa bu adım canonical soru kayıtlarıyla yeniden eşler.
    selectedScopes = selectedScopes.map(resolvePickerScopeAgainstCurriculum);

    if (isScopedCourseExam && selectedScopes.length === 0) {
      showToast("Bu ders için sınav kaydında ünite / konu / kazanım kapsamı bulunamadı. Sınav tanımındaki müfredat planını kontrol edin.");
      return;
    }

    setSystemQuestionModalOpen(true);
    setSystemQuestionViewerIndex(0);
    setSystemQuestionsLoading(true);
    setSelectedSystemQuestionIds(new Set());
    setSystemUnitId("");
    setSystemTopicId("");
    setSystemOutcomeId("");

    const readAllQuestionPages = async (params: any) => {
      const result: any[] = [];
      let offset = 0;
      let total = 0;
      do {
        const payload: any = await listQuestionBankRecords({ ...params, limit: 500, offset });
        const page = Array.isArray(payload?.questions)
          ? payload.questions
          : Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.rows)
                ? payload.rows
                : Array.isArray(payload?.data)
                  ? payload.data
                  : [];
        result.push(...page);
        total = Number(payload?.total || result.length);
        offset += page.length;
        if (!page.length) break;
      } while (offset < total);
      return result;
    };

    const questionCourseMatchesScope = (question: any, scope: any) => {
      const expectedCourseId = canonicalCurriculumCourseIdFromHierarchy(
        scope?.courseId || currentCurriculumCourseId,
        scope?.unitId,
        scope?.topicId,
        scope?.outcomeId,
      );
      const actualCourseId = canonicalCurriculumCourseIdFromHierarchy(
        question?.courseId || question?.course_id,
        question?.unitId || question?.unit_id,
        question?.topicId || question?.topic_id,
        question?.outcomeId || question?.outcome_id,
      );
      if (expectedCourseId && actualCourseId && expectedCourseId === actualCourseId) return true;

      const scopeSubject = normalizeSystemQuestionLabel(scope?.subject || currentSubjectName);
      const questionSubject = normalizeSystemQuestionLabel(
        question?.courseName || question?.course_name || question?.subjectName || question?.subject || "",
      );
      return Boolean(
        scopeSubject && questionSubject &&
        (scopeSubject === questionSubject || scopeSubject.includes(questionSubject) || questionSubject.includes(scopeSubject))
      );
    };

    try {
      let filtered: any[] = [];

      if (isScopedCourseExam) {
        // Soru bankası soruları tek kullanımlıdır. Ünite Denemesi dahil bütün sınav/test
        // türleri yalnız usage=unused canonical havuzunu görür. Kullanılmış soru orijinal
        // dosyası yerinde kalsa da başka bir sınav/testte yeniden seçilemez.
        const scopedRows: any[] = [];

        if (isUnitScanExam) {
          // Müfredat ekranının kullandığıyla aynı veri kümesi: bu sınıfın TÜM aktif
          // canonical soru kayıtları. Önce müfredat ağacıyla isimleri zenginleştir,
          // sonra ders + seçili ünite üzerinden süz. Böylece API yalnız id döndürse de
          // ünite/konu/kazanım sayaçları ve soru listesi aynı anda doğru çalışır.
          const allGradeRows = (await readAllQuestionPages({ status: "active", grade, usage: "unused" }))
            .map(enrichCanonicalQuestionCurriculum);

          const selectedUnitScopes = selectedScopes
            .map(resolvePickerScopeAgainstCurriculum)
            .filter((scope: any) => scope?.unitId || scope?.unitName);

          for (const scope of selectedUnitScopes) {
            const scopeGrade = Number(String(scope?.grade || grade).match(/\d{1,2}/)?.[0] || grade);
            const rowsForScope = allGradeRows.filter((question: any) => {
              const questionGrade = Number(String(question?.grade || scopeGrade).match(/\d{1,2}/)?.[0] || scopeGrade);
              if (questionGrade && scopeGrade && questionGrade !== scopeGrade) return false;
              if (!questionCourseMatchesScope(question, scope)) return false;

              return sameCurriculumNode(
                scope?.unitId,
                scope?.unitName,
                question?.unitId || question?.unit_id,
                question?.unitName || question?.unit_name || question?.unit,
              );
            });
            scopedRows.push(...rowsForScope);
          }
        } else {
          // Ders Denemesi ve diğer kapsamlı sınavlarda mevcut "kullanılmamış soru"
          // davranışını koru.
          for (const scope of selectedScopes) {
            const scopeGrade = Number(String(scope?.grade || grade).match(/\d{1,2}/)?.[0] || grade);
            const courseId = canonicalCurriculumCourseId(scope?.courseId || currentCurriculumCourseId);
            const params: any = {
              status: "active",
              grade: scopeGrade,
              usage: "unused",
            };
            if (courseId) params.courseId = courseId;
            if (scope?.unitId) params.unitId = String(scope.unitId);
            if (scope?.topicId) params.topicId = String(scope.topicId);
            if (scope?.outcomeId) params.outcomeId = String(scope.outcomeId);

            let rowsForScope = await readAllQuestionPages(params);

            if (rowsForScope.length === 0) {
              const broadParams: any = { status: "active", grade: scopeGrade, usage: "unused" };
              if (courseId) broadParams.courseId = courseId;
              let broadRows = await readAllQuestionPages(broadParams);
              if (broadRows.length === 0 && courseId) {
                broadRows = await readAllQuestionPages({ status: "active", grade: scopeGrade, usage: "unused" });
              }
              rowsForScope = broadRows.filter((question: any) =>
                questionCourseMatchesScope(question, scope) && systemQuestionMatchesScope(question, scope),
              );
            } else {
              rowsForScope = rowsForScope.filter((question: any) => systemQuestionMatchesScope(question, scope));
            }

            scopedRows.push(...rowsForScope);
          }
        }

        const unique = new Map<string, any>();
        scopedRows.forEach((question: any, index: number) => {
          const key = String(
            question?.id || question?.questionId || question?.question_id || question?.storagePath || question?.fileName ||
            `${question?.unitId || question?.unitName || ""}|${question?.topicId || question?.topicName || ""}|${question?.outcomeId || question?.outcomeName || ""}|${index}`,
          );
          if (!unique.has(key)) unique.set(key, question);
        });
        filtered = Array.from(unique.values());
      } else {
        // TYT / AYT gibi sınavlarda mevcut ders bazlı havuz davranışını koru.
        const rows = await readAllQuestionPages({ status: "active", grade, usage: "unused" });
        const target = normalizeSystemQuestionLabel(currentSubjectName);
        const curriculumCourseCatalog = [
          { id: 1, name: "Türk Dili ve Edebiyatı" },
          { id: 2, name: "Tarih" },
          { id: 3, name: "Coğrafya" },
          { id: 4, name: "Felsefe" },
          { id: 5, name: "Din Kültürü ve Ahlak Bilgisi" },
          { id: 7, name: "Matematik" },
          { id: 8, name: "Fizik" },
          { id: 9, name: "Kimya" },
          { id: 10, name: "Biyoloji" },
        ];
        const matchingCourseIds = new Set<string>();
        for (const catalogCourse of curriculumCourseCatalog) {
          const name = normalizeSystemQuestionLabel(catalogCourse.name);
          if (name && target && (name === target || name.includes(target) || target.includes(name))) {
            matchingCourseIds.add(String(catalogCourse.id));
            matchingCourseIds.add(`CURR-${grade}-${catalogCourse.id}`);
          }
        }
        filtered = rows.filter((q: any) => {
          const rawCourseId = String(q.courseId || q.course_id || "");
          const canonicalCourseId = canonicalCurriculumCourseId(rawCourseId);
          if (rawCourseId && (matchingCourseIds.has(rawCourseId) || matchingCourseIds.has(canonicalCourseId))) return true;
          const label = normalizeSystemQuestionLabel(q.courseName || q.course_name || q.subjectName || q.subject || "");
          return Boolean(label && target && (label === target || label.includes(target) || target.includes(label)));
        });
      }

      // Canonical API çoğunlukla yalnız hiyerarşi id'lerini döndürür. Modalın
      // sayaçları ise isim tabanlı kararlı anahtarlar kullanır. Her durumda güncel
      // müfredat adlarını ekleyip tek biçime getir.
      filtered = filtered.map(enrichCanonicalQuestionCurriculum);
      setSystemQuestions(filtered);

      // Tek bir ünite/konu/kazanım tanımlıysa pencere açılır açılmaz o kapsam seçili görünsün.
      // Soru bankasındaki gerçek kimliği kullanarak eski/yeni ID farklarında boş select oluşmasını önle.
      if (isScopedCourseExam && selectedScopes.length > 0) {
        const uniqueNames = (key: "unitName" | "topicName" | "outcomeName") =>
          Array.from(new Set(selectedScopes.map((scope: any) => normalizeSystemQuestionLabel(scope?.[key])).filter(Boolean)));
        const oneUnit = uniqueNames("unitName");
        const oneTopic = uniqueNames("topicName");
        const oneOutcome = uniqueNames("outcomeName");
        const sample = filtered.find((question: any) => selectedScopes.some((scope: any) => systemQuestionMatchesScope(question, scope)));
        if (oneUnit.length === 1) {
          const scope = selectedScopes.find((row: any) => normalizeSystemQuestionLabel(row?.unitName) === oneUnit[0]);
          setSystemUnitId(systemCurriculumUnitValue(sample || scope));
        }
        if (!isUnitScanExam && oneTopic.length === 1) {
          const scope = selectedScopes.find((row: any) => normalizeSystemQuestionLabel(row?.topicName) === oneTopic[0]);
          const topicSample = filtered.find((question: any) => systemQuestionMatchesScope(question, scope || {}));
          setSystemTopicId(systemCurriculumTopicValue(topicSample || scope));
        }
        if (!isUnitScanExam && oneOutcome.length === 1) {
          const scope = selectedScopes.find((row: any) => normalizeSystemQuestionLabel(row?.outcomeName) === oneOutcome[0]);
          const outcomeSample = filtered.find((question: any) => systemQuestionMatchesScope(question, scope || {}));
          setSystemOutcomeId(systemCurriculumOutcomeValue(outcomeSample || scope));
        }
      }

      if (isScopedCourseExam && filtered.length === 0) {
        showToast("Sınavda tanımlanan ünite / konu / kazanım bulundu; ancak bu kapsamda kullanılmamış sistem sorusu bulunamadı.");
      }
    } catch (error: any) {
      setSystemQuestions([]);
      showToast(error?.message || "Sistemdeki sorular okunamadı.");
    } finally {
      setSystemQuestionsLoading(false);
    }
  };

  const addSelectedSystemQuestions = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject) return;
    const chosen = systemQuestions.filter((q: any, index: number) =>
      selectedSystemQuestionIds.has(String(q.id || q.questionId || index)),
    );
    if (!chosen.length) return showToast("Lütfen en az bir soru seçin.");

    const subjectName = activeSubject.name;
    const newQuestions = JSON.parse(JSON.stringify(questions));
    if (!newQuestions[subjectName]) newQuestions[subjectName] = {};

    const usedIndices = Object.keys(newQuestions[subjectName])
      .map((key) => Number(key))
      .filter((index) => Number.isFinite(index) && newQuestions[subjectName][index]?.imageUrl)
      .sort((a, b) => a - b);
    const existingQuestionIds = new Set(
      usedIndices
        .map((index) => String(newQuestions[subjectName][index]?.systemQuestionId || "").trim())
        .filter(Boolean),
    );
    const uniqueChosen = chosen.filter((question: any) => {
      const id = String(question?.id || question?.questionId || "").trim();
      return !id || !existingQuestionIds.has(id);
    });

    // Yönerge grubundaki sorular hangi sırada işaretlenmiş olursa olsun sınava
    // tek blok ve kendi grup sırasıyla eklenir. Böylece 1. ve 6. soru arasında
    // başka bir soru giremez.
    const sourceOrder = new Map<any, number>();
    systemQuestions.forEach((question: any, index: number) => sourceOrder.set(question, index));
    const orderedChosen: any[] = [];
    const handledGroups = new Set<string>();
    [...uniqueChosen]
      .sort((a, b) => (sourceOrder.get(a) ?? 0) - (sourceOrder.get(b) ?? 0))
      .forEach((question: any) => {
        const groupId = questionGroupIdOf(question);
        if (!groupId) {
          orderedChosen.push(question);
          return;
        }
        if (handledGroups.has(groupId)) return;
        handledGroups.add(groupId);
        const members = uniqueChosen
          .filter((row: any) => questionGroupIdOf(row) === groupId)
          .sort((a: any, b: any) => questionGroupOrderOf(a) - questionGroupOrderOf(b));
        orderedChosen.push(...members);
      });

    if (!isFlexibleCourseBasedExam) {
      const alreadyFilled = usedIndices.length;
      if (alreadyFilled + orderedChosen.length > questionCount) {
        return showToast(`${activeSubject.name} için tanımlanan ${questionCount} soru sınırı aşılamaz.`);
      }
    }

    const emptySlots = isFlexibleCourseBasedExam
      ? []
      : Array.from({ length: questionCount }, (_, i) => i).filter(
          (i) => !newQuestions[subjectName][i]?.imageUrl,
        );
    let nextFlexibleIndex = usedIndices.length ? Math.max(...usedIndices) + 1 : 0;
    const toAdd = isFlexibleCourseBasedExam
      ? orderedChosen
      : orderedChosen.slice(0, emptySlots.length);

    // Soru bankası soruları tek kullanımlıktır. Ekrandaki unused havuz bayat kalmış
    // olsa bile sunucudan yeniden kontrol et; başka bir sınav/testte kullanılan soru
    // bu sınava eklenmeden önce kesin olarak engellenir.
    const examUsageId = String(exam?.id || exam?.examCode || exam?.examName || "").trim();
    const questionIdsToReserve = [...new Set(
      toAdd.map((q: any) => String(q?.id || q?.questionId || q?.question_id || "").trim()).filter(Boolean),
    )];
    if (examUsageId && questionIdsToReserve.length > 0) {
      try {
        const conflictResponse = await fetch("/api/question-bank/usage/check-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ examId: examUsageId, questionIds: questionIdsToReserve }),
        });
        const conflictBody = await conflictResponse.json().catch(() => ({}));
        if (!conflictResponse.ok) {
          throw new Error(String(conflictBody?.error || "Soru kullanım durumu kontrol edilemedi."));
        }
        const conflicts = Array.isArray(conflictBody?.conflicts) ? conflictBody.conflicts.map(String) : [];
        if (conflicts.length > 0) {
          showToast(`${conflicts.length} soru başka bir sınav/testte kullanıldığı için yeniden seçilemez. Soru havuzunu yenileyip tekrar deneyiniz.`);
          return;
        }

        const reservedNow: string[] = [];
        for (const q of toAdd) {
          const questionId = String(q?.id || q?.questionId || q?.question_id || "").trim();
          if (!questionId) continue;
          const usageResponse = await fetch("/api/question-bank/usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              questionId,
              examId: examUsageId,
              examName: String(exam?.examName || ""),
              source: "QuestionManagerView",
            }),
          });
          const usageBody = await usageResponse.json().catch(() => ({}));
          if (usageResponse.ok) {
            if (usageResponse.status === 201) reservedNow.push(questionId);
            continue;
          }
          if (usageResponse.status === 409 && usageBody?.duplicateUsage && !usageBody?.usedByOtherExam) {
            continue;
          }

          await Promise.allSettled(
            reservedNow.map((reservedQuestionId) => fetch("/api/question-bank/usage", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionId: reservedQuestionId, examId: examUsageId }),
            })),
          );
          showToast(String(usageBody?.error || "Seçilen sorulardan biri daha önce başka bir sınav/testte kullanılmıştır."));
          return;
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Soru kullanım durumu kontrol edilemedi.");
        return;
      }
    }

    const groupSizeById = new Map<string, number>();
    systemQuestions.forEach((row: any) => {
      const groupId = questionGroupIdOf(row);
      if (!groupId) return;
      groupSizeById.set(groupId, Number(groupSizeById.get(groupId) || 0) + 1);
    });

    toAdd.forEach((q: any, n: number) => {
      const slot = isFlexibleCourseBasedExam ? nextFlexibleIndex++ : emptySlots[n];
      const imageUrl = String(
        q.imageUrl || q.image_url || q.imageDataUrl || q.thumbnailUrl || q.thumbnail_url ||
        (q.id || q.questionId ? `/api/question-bank/images/${encodeURIComponent(String(q.id || q.questionId))}` : ""),
      ).trim();
      newQuestions[subjectName][slot] = {
        ...(newQuestions[subjectName][slot] || {}),
        imageUrl,
        fileName: q.fileName || q.file_name || q.code || `Sistem Sorusu ${slot + 1}`,
        originalFileName: q.originalFileName || q.original_file_name || "",
        questionCode: q.questionCode || q.question_code || q.code || "",
        correctAnswer: q.correctAnswer || q.answer || q.correct_answer || "",
        unit: q.unitName || q.unit_name || q.unit || "",
        topic: q.topicName || q.topic_name || q.topic || "",
        outcome: q.outcomeName || q.outcome_name || q.outcome || "",
        systemQuestionId: q.id || q.questionId || q.question_id || "",
        systemCourseId: q.courseId || q.course_id || currentCurriculumCourseId || "",
        systemUnitId: q.unitId || q.unit_id || "",
        systemTopicId: q.topicId || q.topic_id || "",
        systemOutcomeId: q.outcomeId || q.outcome_id || "",
        columnSpan: Number(q.columnSpan || q.column_span || 1) === 2 ? 2 : 1,
        questionGroupId: questionGroupIdOf(q),
        questionGroupMode: questionGroupModeOf(q),
        questionGroupLayout: questionGroupLayoutOf(q),
        questionGroupOrder: questionGroupOrderOf(q),
        questionGroupSize: questionGroupIdOf(q)
          ? Math.max(questionGroupSizeOf(q), Number(groupSizeById.get(questionGroupIdOf(q)) || 0))
          : 0,
        questionGroupTitle: questionGroupTitleOf(q),
        questionGroupInstructionText: questionGroupInstructionTextOf(q),
        questionGroupInstructionImageUrl: questionGroupInstructionImageOf(q),
        // Öğretmen görevlendirilmiş olsa bile yönetici tarafından yapılan seçimler
        // ayrı tutulur ve öğretmen senkronizasyonunda korunur.
        source: "admin-selection",
      };
    });

    // Sistemden seçilen bir Gxx grubunun üyeleri, sınav soru dizisinde de tek blok
    // halinde tutulur. Önceden silinmiş/boş kalmış slotlar olsa bile araya bağımsız
    // soru girmesine izin verme.
    const addedGroupIds = [...new Set(
      toAdd.map((question: any) => questionGroupIdOf(question)).filter(Boolean),
    )];
    addedGroupIds.forEach((groupId) => {
      newQuestions[subjectName] = placeQuestionGroupMembersContiguously(
        newQuestions[subjectName],
        String(groupId),
      );
    });

    const nextCount = Object.values(newQuestions[subjectName] || {}).filter(
      (question: any) => question?.imageUrl,
    ).length;
    const nextStructure = isFlexibleCourseBasedExam
      ? withUpdatedSubjectCount(examStructure, subjectName, nextCount)
      : examStructure;

    onUpdateExam({ ...exam, questions: newQuestions, examStructure: nextStructure });

    setSystemQuestionModalOpen(false);
    setSelectedSystemQuestionIds(new Set());
    showToast(`${toAdd.length} sistem sorusu sınava eklendi.`);
  };


  // Fetch Curriculum Data from LocalStorage
  const getGradeString = (gl: string) => {
    if (gl === "YKS" || gl === "12") return "12. Sınıf";
    return `${gl}. Sınıf`;
  };

  const normalizeCurriculumLabel = (value: unknown) =>
    String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[çÇ]/g, "c")
      .replace(/[ğĞ]/g, "g")
      .replace(/[ıİ]/g, "i")
      .replace(/[öÖ]/g, "o")
      .replace(/[şŞ]/g, "s")
      .replace(/[üÜ]/g, "u")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(dersi|ders)\b/g, "")
      .replace(/[^a-z0-9]/g, "");

  const normalizeGradeLevel = (value: unknown) => {
    const grade = String(value || "").match(/\d{1,2}/)?.[0];
    return grade || (String(value || "").toLocaleUpperCase("tr-TR") === "YKS" ? "12" : "");
  };

  const mapCurriculumUnits = (units: any[]) =>
    (Array.isArray(units) ? units : []).map((unit: any, unitIndex: number) => ({
      id: unit.id || `unit-${unitIndex}-${unit.name}`,
      name: unit.name,
      topics: (Array.isArray(unit.topics) ? unit.topics : []).map((topic: any, topicIndex: number) => ({
        id: topic.id || `topic-${unitIndex}-${topicIndex}-${topic.name}`,
        name: topic.name,
        outcomes: (Array.isArray(topic.outcomes) ? topic.outcomes : []).map((outcome: any, outcomeIndex: number) => ({
          id: outcome.id || `outcome-${unitIndex}-${topicIndex}-${outcomeIndex}-${outcome.name}`,
          name: outcome.name,
        })),
      })),
    }));

  const getCourseManagerCurriculum = () => {
    try {
      const grade = normalizeGradeLevel(exam.gradeLevel);
      const subject = String(currentSubjectName || "").trim();

      // Önce doğrudan canlı repository'den ders/sınıf eşleşmesini çöz.
      let entry = resolveCurriculumEntry(authoritativeCurriculumStore, {
        grade,
        courseName: subject,
      });

      // Seçmeli/özel derslerde isim sabit katalogda olmayabilir. Ders katalog
      // kaydı yalnız courseId'yi bulmak için kullanılır; müfredatın kendisi yine
      // sunucudaki tek courseCurriculums kaynağından alınır.
      if (!entry) {
        let courses: any[] = [];
        try {
          const raw = localStorage.getItem("custom_created_courses");
          courses = raw ? JSON.parse(raw) : [];
        } catch {
          courses = [];
        }
        const matchingCourse = (Array.isArray(courses) ? courses : []).find((course: any) =>
          normalizeGradeLevel(course?.gradeLevel) === grade &&
          normalizeCurriculumLabel(course?.courseName || course?.name) === normalizeCurriculumLabel(subject),
        );
        if (matchingCourse) {
          entry = resolveCurriculumEntry(authoritativeCurriculumStore, {
            courseId: matchingCourse.id || matchingCourse.courseId,
            grade,
            courseName: subject,
          });
        }
      }

      if (entry && Array.isArray(entry.curriculum?.units)) {
        return mapCurriculumUnits(entry.curriculum.units);
      }
    } catch (error) {
      console.warn("Canlı müfredat verisi soru işlemlerine aktarılırken okunamadı", error);
    }
    return [];
  };

  const getCurriculumData = () => {
    // Tek kaynak kuralı: eski curriculumData / rota / SQLite kayıtlarına geri
    // düşme. Repository boşsa gerçek hata görünür; eski kazanım tekrar canlanmaz.
    return getCourseManagerCurriculum();
  };

  const curriculumTree = getCurriculumData();


  /*
   * ÖĞRETMEN MOBİL GÖREVİ – TAM MÜFREDAT SNAPSHOT'I
   * ------------------------------------------------
   * Soru havuzu, soru kaydı bulunmayan kazanımları doğal olarak taşıyamaz.
   * Bu nedenle öğretmen görevine yalnız soru snapshot'ı değil, sınav kapsamındaki
   * TAM ünite -> konu -> kazanım ağacını da ayrıca kaydediyoruz.
   *
   * Öğretmen telefonunda görülen "0 kazanım" hatasının gerçek nedeni şuydu:
   * teacherTestAssignments kaydında konu vardı ancak curriculumScopeTree yoktu
   * (veya boştu). Aşağıdaki senkronizasyon hem yeni görevlendirmeleri hem de
   * yönetici bu ekranı tekrar açtığında eski görevleri otomatik onarır.
   */
  const teacherCurriculumRepairRef = useRef<Set<string>>(new Set());

  const countCurriculumOutcomes = (tree: any[]) =>
    (Array.isArray(tree) ? tree : []).reduce(
      (unitTotal: number, unit: any) =>
        unitTotal +
        (Array.isArray(unit?.topics) ? unit.topics : []).reduce(
          (topicTotal: number, topic: any) =>
            topicTotal + (Array.isArray(topic?.outcomes) ? topic.outcomes.length : 0),
          0,
        ),
      0,
    );

  // Yalnız kazanım sayısını karşılaştırmak yeterli değildir. Müfredatta bir
  // kazanım silinip yerine yenisi eklendiğinde toplam sayı aynı kalabilir.
  // Bu imza; ünite, konu ve kazanım kimlik/adlarını birlikte izler. Böylece
  // içerik değiştiği anda öğretmen görevindeki snapshot yenilenir.
  const curriculumTreeFingerprint = (tree: any[]) => {
    const normalizeNode = (value: any) => normalizeSystemQuestionLabel(String(value || ""));
    const safe = (Array.isArray(tree) ? tree : []).map((unit: any) => ({
      id: String(unit?.id || ""),
      name: normalizeNode(unit?.name),
      topics: (Array.isArray(unit?.topics) ? unit.topics : []).map((topic: any) => ({
        id: String(topic?.id || ""),
        name: normalizeNode(topic?.name),
        outcomes: (Array.isArray(topic?.outcomes) ? topic.outcomes : []).map((outcome: any) => ({
          id: String(outcome?.id || ""),
          name: normalizeNode(outcome?.name),
        })),
      })),
    }));
    return JSON.stringify(safe);
  };

  const buildTeacherCurriculumScopeTree = () => {
    const sameNode = (idA: any, nameA: any, idB: any, nameB: any) => {
      const aId = String(idA || "").trim();
      const bId = String(idB || "").trim();
      if (aId && bId && aId === bId) return true;
      const aName = normalizeSystemQuestionLabel(nameA);
      const bName = normalizeSystemQuestionLabel(nameB);
      return Boolean(aName && bName && aName === bName);
    };

    const sourceScopes = Array.isArray(activeCurriculumScopes)
      ? activeCurriculumScopes
      : [];
    const result: any[] = [];
    const unitMap = new Map<string, any>();

    const ensureUnit = (unit: any) => {
      const key = String(unit?.id || `name:${normalizeSystemQuestionLabel(unit?.name)}`);
      if (!unitMap.has(key)) {
        const node = {
          id: String(unit?.id || unit?.name || key),
          name: String(unit?.name || unit?.id || "Ünite"),
          topics: [],
        };
        unitMap.set(key, node);
        result.push(node);
      }
      return unitMap.get(key);
    };

    const pushTopic = (targetUnit: any, topic: any, scope: any) => {
      const topicKey = String(topic?.id || `name:${normalizeSystemQuestionLabel(topic?.name)}`);
      let targetTopic = (targetUnit.topics || []).find(
        (row: any) => String(row?.id || `name:${normalizeSystemQuestionLabel(row?.name)}`) === topicKey,
      );
      if (!targetTopic) {
        targetTopic = {
          id: String(topic?.id || topic?.name || topicKey),
          name: String(topic?.name || topic?.id || "Konu"),
          outcomes: [],
        };
        targetUnit.topics.push(targetTopic);
      }

      const sourceOutcomes = Array.isArray(topic?.outcomes) ? topic.outcomes : [];
      const scopedOutcome = scope?.outcomeId || scope?.outcomeName
        ? sourceOutcomes.find((outcome: any) =>
            sameNode(scope?.outcomeId, scope?.outcomeName, outcome?.id, outcome?.name),
          )
        : null;
      const outcomes = scopedOutcome ? [scopedOutcome] : sourceOutcomes;

      outcomes.forEach((outcome: any, outcomeIndex: number) => {
        const outcomeId = String(
          outcome?.id ||
          `outcome-${String(topic?.id || topic?.name || "topic")}-${outcomeIndex}`,
        );
        const exists = (targetTopic.outcomes || []).some((row: any) =>
          sameNode(row?.id, row?.name, outcomeId, outcome?.name),
        );
        if (!exists) {
          targetTopic.outcomes.push({
            id: outcomeId,
            name: String(outcome?.name || outcome?.id || "Kazanım"),
            questions: [],
          });
        }
      });
    };

    // Sınav tanımında kayıtlı kapsamı esas al. Konu seçilmişse o konunun tüm
    // kazanımları; yalnız ünite seçilmişse ünitenin tüm konu/kazanımları gider.
    sourceScopes.forEach((scope: any) => {
      const unit = (curriculumTree || []).find((row: any) =>
        sameNode(scope?.unitId, scope?.unitName, row?.id, row?.name),
      );
      if (!unit) return;
      const targetUnit = ensureUnit(unit);

      const selectedTopic = scope?.topicId || scope?.topicName
        ? (unit.topics || []).find((topic: any) =>
            sameNode(scope?.topicId, scope?.topicName, topic?.id, topic?.name),
          )
        : null;

      if (selectedTopic) pushTopic(targetUnit, selectedTopic, scope);
      else (unit.topics || []).forEach((topic: any) => pushTopic(targetUnit, topic, scope));
    });

    // Eski sınavlarda kapsam satırı kaybolmuşsa, aktif dersin gerçek müfredatını
    // tamamen snapshot'la. Bu, soru kaydı 0 olan kazanımların da görünmesini sağlar.
    if (result.length === 0 && Array.isArray(curriculumTree) && curriculumTree.length > 0) {
      return curriculumTree.map((unit: any) => ({
        id: String(unit?.id || unit?.name || "unit"),
        name: String(unit?.name || unit?.id || "Ünite"),
        topics: (unit?.topics || []).map((topic: any) => ({
          id: String(topic?.id || topic?.name || "topic"),
          name: String(topic?.name || topic?.id || "Konu"),
          outcomes: (topic?.outcomes || []).map((outcome: any, outcomeIndex: number) => ({
            id: String(outcome?.id || `outcome-${String(topic?.id || "topic")}-${outcomeIndex}`),
            name: String(outcome?.name || outcome?.id || "Kazanım"),
            questions: [],
          })),
        })),
      }));
    }

    return result;
  };

  const repairTeacherAssignmentCurriculum = async (
    subjectName: string,
    teacherId: string,
    options: { silent?: boolean } = {},
  ) => {
    const curriculumScopeTree = buildTeacherCurriculumScopeTree();
    const expectedOutcomeCount = countCurriculumOutcomes(curriculumScopeTree);
    if (expectedOutcomeCount <= 0) {
      if (!options.silent) {
        showToast(
          "Bu dersin müfredat kazanımları yönetici ekranında bulunamadı. Önce Müfredat Oluştur alanındaki ünite-konu-kazanım kaydını kontrol edin.",
        );
      }
      return false;
    }

    try {
      const response = await fetch(
        "/api/database/collections/teacherTestAssignments",
        { cache: "no-store" },
      );
      const payload: any = await response.json().catch(() => []);
      const rows: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : [];

      const subjectKey = normalizeSystemQuestionLabel(subjectName);
      const sameExam = (row: any) => {
        const linked = String(row?.examId || row?.testId || row?.examCode || "").trim();
        const rowName = normalizeSystemQuestionLabel(row?.testName || row?.examName || row?.name || "");
        const currentExamName = normalizeSystemQuestionLabel(exam?.examName || exam?.name || "");
        return (
          (!!exam?.id && linked === String(exam.id)) ||
          (!!exam?.examCode && (linked === String(exam.examCode) || String(row?.examCode || "") === String(exam.examCode))) ||
          (!!rowName && !!currentExamName && rowName === currentExamName)
        );
      };
      const sameSubject = (row: any) => {
        const rowSubject = normalizeSystemQuestionLabel(
          row?.subject || row?.courseName || row?.lessonName || row?.courseId || "",
        );
        return Boolean(
          rowSubject && subjectKey &&
          (rowSubject === subjectKey || rowSubject.includes(subjectKey) || subjectKey.includes(rowSubject)),
        );
      };

      const candidates = rows
        .filter((row: any) => !teacherId || String(row?.teacherId || "") === String(teacherId))
        .filter(sameSubject)
        .sort((a: any, b: any) =>
          String(b?.updatedAt || b?.createdAt || "").localeCompare(
            String(a?.updatedAt || a?.createdAt || ""),
          ),
        );

      const exactCandidates = candidates.filter(sameExam);
      // Aynı öğretmenin aynı derste birden fazla görevi olabilir. Sınav bağı
      // bulunuyorsa sadece doğru sınavı güncelle; sınav bağı olmayan eski kayıtta
      // yalnız tek aday varsa güvenli geriye uyumluluk uygula.
      const target = exactCandidates[0] || (candidates.length === 1 ? candidates[0] : null);
      if (!target) return false;

      const currentTree = target?.curriculumScopeTree || target?.fullScopeTree || [];
      const currentFingerprint = curriculumTreeFingerprint(currentTree);
      const expectedFingerprint = curriculumTreeFingerprint(curriculumScopeTree);
      const normalizedAssignmentScopes = (Array.isArray(activeCurriculumScopes) ? activeCurriculumScopes : [])
        .map((scope: any) => ({
          ...scope,
          topicId: isUnitScanExam ? "" : scope?.topicId,
          topicName: isUnitScanExam ? "" : scope?.topicName,
          outcomeId: isUnitScanExam ? "" : scope?.outcomeId,
          outcomeName: isUnitScanExam ? "" : scope?.outcomeName,
          scopeType: isUnitScanExam ? "unit" : scope?.scopeType,
          includeAllTopics: isUnitScanExam ? true : scope?.includeAllTopics,
          includeAllOutcomes: isUnitScanExam ? true : scope?.includeAllOutcomes,
        }));
      const scopeFingerprint = (rows: any[]) => JSON.stringify(
        (Array.isArray(rows) ? rows : [])
          .map((scope: any) => ({
            courseId: String(scope?.courseId || ""),
            unitId: String(scope?.unitId || ""),
            unitName: normalizeSystemQuestionLabel(scope?.unitName || ""),
            topicId: String(scope?.topicId || ""),
            topicName: normalizeSystemQuestionLabel(scope?.topicName || ""),
            outcomeId: String(scope?.outcomeId || ""),
            outcomeName: normalizeSystemQuestionLabel(scope?.outcomeName || ""),
          }))
          .sort((a: any, b: any) =>
            `${a.courseId}|${a.unitId}|${a.topicId}|${a.outcomeId}`.localeCompare(
              `${b.courseId}|${b.unitId}|${b.topicId}|${b.outcomeId}`,
              "tr-TR",
            ),
          ),
      );
      const currentScopeFingerprint = scopeFingerprint(
        Array.isArray(target?.scopes) ? target.scopes : [],
      );
      const expectedScopeFingerprint = scopeFingerprint(normalizedAssignmentScopes);

      // Müfredat ağacı kadar görev kapsamı da güncel olmalıdır. Aksi halde scopeTree
      // çok üniteli görünse bile telefon canlı müfredatı eski tek scope ile daraltır.
      if (
        currentFingerprint === expectedFingerprint &&
        currentScopeFingerprint === expectedScopeFingerprint
      ) return true;

      const assignmentId = String(target?.id || target?.__documentId || "").trim();
      if (!assignmentId) return false;

      const next = {
        ...target,
        // TAM müfredat ağacı soru listesinden bağımsızdır.
        // scopeTree de birebir yenilenir; böylece herhangi bir eski endpoint
        // curriculumScopeTree alanını atsa bile mobil ekran eski kazanımlara düşmez.
        scopes: normalizedAssignmentScopes,
        selectionScopes: normalizedAssignmentScopes,
        questionScopes: normalizedAssignmentScopes,
        scopeTree: curriculumScopeTree,
        curriculumScopeTree,
        fullScopeTree: curriculumScopeTree,
        curriculumSnapshotVersion: 5,
        curriculumSnapshotOutcomeCount: expectedOutcomeCount,
        curriculumSnapshotFingerprint: expectedFingerprint,
        curriculumSnapshotUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saveResponse = await fetch(
        `/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
          cache: "no-store",
        },
      );
      if (!saveResponse.ok) {
        const body = await saveResponse.json().catch(() => ({}));
        throw new Error(String(body?.error || "Öğretmen görevi müfredatla güncellenemedi."));
      }
      return true;
    } catch (error) {
      console.warn("Öğretmen görevi tam müfredatla güncellenemedi", error);
      if (!options.silent) {
        showToast(
          error instanceof Error
            ? error.message
            : "Öğretmen görevi müfredatla güncellenemedi.",
        );
      }
      return false;
    }
  };

  // Eski görevleri de geriye dönük onar: yönetici sınavdaki ilgili dersi açtığında,
  // assignment kaydına curriculumScopeTree eklenir. Öğretmenin görevi silip yeniden
  // oluşturmasına gerek kalmaz; telefonda sayfa yenilemesi yeterlidir.
  const currentSubjectAssignment = Object.values(exam?.questionAssignments || {}).find(
    (assignment: any) =>
      normalizeSystemQuestionLabel(assignment?.subject || assignment?.courseName || "") ===
      normalizeSystemQuestionLabel(currentSubjectName),
  ) as any;
  const currentTeacherCurriculumTree = buildTeacherCurriculumScopeTree();
  const currentTeacherCurriculumFingerprint = curriculumTreeFingerprint(currentTeacherCurriculumTree);
  const curriculumRepairKey = [
    String(exam?.id || exam?.examCode || ""),
    normalizeSystemQuestionLabel(currentSubjectName),
    String(currentSubjectAssignment?.teacherId || ""),
    currentTeacherCurriculumFingerprint,
    String(curriculumStorageRevision),
  ].join("|");

  useEffect(() => {
    const teacherId = String(currentSubjectAssignment?.teacherId || "").trim();
    if (!teacherId || countCurriculumOutcomes(currentTeacherCurriculumTree) <= 0) return;
    if (teacherCurriculumRepairRef.current.has(curriculumRepairKey)) return;
    teacherCurriculumRepairRef.current.add(curriculumRepairKey);
    void repairTeacherAssignmentCurriculum(currentSubjectName, teacherId, { silent: true });
  }, [curriculumRepairKey]);

  const handleSelectFromBank = (imgUrl: string) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeQuestion) return;
    const { subjectName, qIndex } = activeQuestion;
    const newQuestions = { ...questions };
    if (!newQuestions[currentSubjectName]) newQuestions[currentSubjectName] = {};
    if (!newQuestions[currentSubjectName][activeQuestion.questionIndex])
      newQuestions[currentSubjectName][activeQuestion.questionIndex] = {};
    
    newQuestions[currentSubjectName][activeQuestion.questionIndex].imageUrl = imgUrl;

    // Resolve curriculum from selected folder id
    if (selectedBankFolderId) {
      let foundUnit = "";
      let foundTopic = "";
      let foundOutcome = "";
      
      for (const u of curriculumTree) {
        if (u.id === selectedBankFolderId) {
          foundUnit = u.name;
          break;
        }
        for (const t of u.topics) {
          if (t.id === selectedBankFolderId) {
            foundUnit = u.name;
            foundTopic = t.name;
            break;
          }
          for (const o of t.outcomes) {
            if (o.id === selectedBankFolderId) {
              foundUnit = u.name;
              foundTopic = t.name;
              foundOutcome = o.name;
              break;
            }
          }
          if (foundUnit) break;
        }
        if (foundUnit) break;
      }
      
      if (foundUnit) newQuestions[currentSubjectName][activeQuestion.questionIndex].unit = foundUnit;
      if (foundTopic) newQuestions[currentSubjectName][activeQuestion.questionIndex].topic = foundTopic;
      if (foundOutcome) newQuestions[currentSubjectName][activeQuestion.questionIndex].outcome = foundOutcome;
    }

    const updatedExam = { ...exam, questions: newQuestions };
    onUpdateExam(updatedExam);
    setShowFolderModal(false);
  };

  const handlePrevQuestion = () => {
    if (!activeQuestion) return;
    if (activeQuestion.questionIndex > 0) {
      setActiveQuestion({
        ...activeQuestion,
        questionIndex: activeQuestion.questionIndex - 1,
      });
    }
  };

  const handleNextQuestion = () => {
    if (!activeQuestion) return;
    if (activeQuestion.questionIndex < questionCount - 1) {
      setActiveQuestion({
        ...activeQuestion,
        questionIndex: activeQuestion.questionIndex + 1,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (blockQuestionMutationWhenLocked()) {
      e.currentTarget.value = "";
      return;
    }
    if (
      !activeQuestion ||
      !e.target.files ||
      e.target.files.length === 0 ||
      !activeSubject
    )
      return;
    const file = e.target.files[0];
    if (questionGroupInfoFromFileName(file.name)?.isInstruction) {
      e.target.value = "";
      showToast("Yönerge kartını bağlı sorularıyla birlikte toplu yükleyin.");
      return;
    }

    const duplicate = findDuplicateQuestionContent(file.name, activeSubject.name);

    const imageUrl = await readAsDataURL(file);
    const subjectName = activeSubject.name;
    const qIndex = activeQuestion.questionIndex;

    const newQuestions = { ...questions };
    if (!newQuestions[subjectName]) newQuestions[subjectName] = {};
    if (!newQuestions[subjectName][qIndex])
      newQuestions[subjectName][qIndex] = {};

    newQuestions[subjectName][qIndex].imageUrl = imageUrl;
    newQuestions[subjectName][qIndex].fileName = file.name;
    const answerFromFileName = getAnswerFromQuestionFileName(file.name);
    if (answerFromFileName) newQuestions[subjectName][qIndex].correctAnswer = answerFromFileName;
    if (duplicate) {
      newQuestions[subjectName][qIndex].duplicateMessage = `Bu soru (${duplicate.examName}) adlı denemede ${duplicate.questionNumber}. soru olarak kullanılmıştır.`;
    } else {
      delete newQuestions[subjectName][qIndex].duplicateMessage;
    }

    const updatedExam = { ...exam, questions: newQuestions };
    onUpdateExam(updatedExam);
    showToast("Soru başarıyla kaydedildi.");
  };

  const handleBulkFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (blockQuestionMutationWhenLocked()) {
      e.currentTarget.value = "";
      return;
    }
    if (!e.target.files || e.target.files.length === 0 || !activeSubject) return;

    const allFiles = Array.from(e.target.files) as File[];
    const files = allFiles.length > 100 ? allFiles.slice(0, 100) : allFiles;
    if (allFiles.length > 100) {
      alert("En fazla 100 dosya tek seferde yüklenebilir. Sadece ilk 100 dosya işlenecek.");
    }
    e.target.value = "";

    const subjectName = activeSubject.name;
    const newQuestions = JSON.parse(JSON.stringify(questions));
    if (!newQuestions[subjectName]) newQuestions[subjectName] = {};

    const instructionFiles = files.filter(
      (file) => questionGroupInfoFromFileName(file.name)?.isInstruction,
    );
    const questionFiles = files.filter(
      (file) => !questionGroupInfoFromFileName(file.name)?.isInstruction,
    );

    if (questionFiles.length === 0) {
      showToast("Yüklenecek soru görseli bulunamadı. G01_S0_Y yönerge kartı tek başına soru olarak yüklenmez.");
      return;
    }

    if (exam.examSource === "Basılı Yayın") {
      const numberedFiles = questionFiles.map((file, selectionIndex) => ({
        file,
        selectionIndex,
        aQuestionNumber: getPrintedPublicationAQuestionNumberFromFileName(file.name),
      }));
      const invalidFiles = numberedFiles.filter((item) => !item.aQuestionNumber);
      if (invalidFiles.length > 0) {
        alert(
          `Basılı yayın soru görsellerinin dosya adı A kitapçığı soru numarası olmalıdır. Örnek: 1.png, 2.jpg, 3.png.\n\nNumarası okunamayan dosya: ${invalidFiles[0].file.name}`,
        );
        return;
      }

      const outOfRange = numberedFiles.find(
        (item) => Number(item.aQuestionNumber) < 1 || Number(item.aQuestionNumber) > questionCount,
      );
      if (outOfRange) {
        alert(
          `${outOfRange.file.name}: A kitapçığı soru numarası 1-${questionCount} arasında olmalıdır.`,
        );
        return;
      }

      const seenANumbers = new Set<number>();
      const duplicateNumber = numberedFiles.find((item) => {
        const number = Number(item.aQuestionNumber);
        if (seenANumbers.has(number)) return true;
        seenANumbers.add(number);
        return false;
      });
      if (duplicateNumber) {
        alert(`A kitapçığında ${duplicateNumber.aQuestionNumber}. soru için birden fazla görsel seçildi.`);
        return;
      }

      numberedFiles.sort(
        (left, right) => Number(left.aQuestionNumber) - Number(right.aQuestionNumber) || left.selectionIndex - right.selectionIndex,
      );

      setUploadProgress({ current: 0, total: numberedFiles.length });
      let processed = 0;
      for (const item of numberedFiles) {
        const aQuestionNumber = Number(item.aQuestionNumber);
        const questionIndex = aQuestionNumber - 1;
        const fileToUpload = item.file;
        const duplicate = findDuplicateQuestionContent(fileToUpload.name, subjectName);
        const imageUrl = await readAsDataURL(fileToUpload);
        const currentQuestion = newQuestions[subjectName][questionIndex] || {};
        const bookletNumbers: Record<string, number> = {
          ...(currentQuestion.bookletNumbers || {}),
          A: aQuestionNumber,
        };

        const nextQuestion = {
          ...currentQuestion,
          imageUrl,
          fileName: fileToUpload.name,
          bookletNumbers,
        };
        const answerFromFileName = getAnswerFromQuestionFileName(fileToUpload.name);
        if (answerFromFileName) nextQuestion.correctAnswer = answerFromFileName;
        if (duplicate) {
          nextQuestion.duplicateMessage =
            `Bu soru (${duplicate.examName}) adlı denemede ${duplicate.questionNumber}. soru olarak kullanılmıştır.`;
        } else {
          delete nextQuestion.duplicateMessage;
        }
        newQuestions[subjectName][questionIndex] = nextQuestion;
        processed += 1;
        setUploadProgress({ current: processed, total: numberedFiles.length });
      }

      onUpdateExam({ ...exam, questions: newQuestions });
      setUploadProgress(null);
      showToast(
        `${processed} soru A kitapçığı soru numarasına göre kaydedildi. Diğer kitapçık soru numaralarını soru satırlarından veya Excel ile belirleyebilirsiniz.`,
      );
      return;
    }

    const instructionImageByToken = new Map<string, string>();
    for (const instructionFile of instructionFiles) {
      const info = questionGroupInfoFromFileName(instructionFile.name);
      if (!info?.isInstruction) continue;
      instructionImageByToken.set(info.token, await readAsDataURL(instructionFile));
    }

    // Dosya seçim sırası işletim sistemine göre değişebilse de aynı Gxx grubundaki
    // sorular daima kendi dosya sıra numaralarına göre peş peşe işlenir.
    const orderedQuestionChunks: File[][] = [];
    const handledGroupTokens = new Set<string>();
    questionFiles.forEach((file, originalIndex) => {
      const info = questionGroupInfoFromFileName(file.name);
      if (!info || info.isInstruction) {
        orderedQuestionChunks.push([file]);
        return;
      }
      if (handledGroupTokens.has(info.token)) return;
      handledGroupTokens.add(info.token);
      const members = questionFiles
        .map((candidate, candidateIndex) => ({
          file: candidate,
          index: candidateIndex,
          info: questionGroupInfoFromFileName(candidate.name),
        }))
        .filter((candidate) => candidate.info?.token === info.token && !candidate.info?.isInstruction)
        .sort((left, right) =>
          Number(left.info?.order || 0) - Number(right.info?.order || 0) ||
          left.index - right.index,
        )
        .map((candidate) => candidate.file);
      orderedQuestionChunks.push(members.length ? members : [file]);
    });

    const existingIndices = Object.keys(newQuestions[subjectName])
      .map((key) => Number(key))
      .filter((index) => Number.isFinite(index) && newQuestions[subjectName][index]?.imageUrl)
      .sort((a, b) => a - b);

    const fixedEmptySlots = Array.from({ length: questionCount }, (_, i) => i).filter(
      (i) => !newQuestions[subjectName][i]?.imageUrl,
    );

    const filesToProcess: File[] = [];
    if (isFlexibleCourseBasedExam) {
      orderedQuestionChunks.forEach((chunk) => filesToProcess.push(...chunk));
    } else {
      let remaining = fixedEmptySlots.length;
      orderedQuestionChunks.forEach((chunk) => {
        // Zorunlu bir Gxx grubunun yalnız bir bölümünü yükleyip grubu bozma.
        if (chunk.length <= remaining) {
          filesToProcess.push(...chunk);
          remaining -= chunk.length;
        }
      });
    }

    const slots = [...fixedEmptySlots];
    if (isFlexibleCourseBasedExam) {
      let nextIndex = existingIndices.length ? Math.max(...existingIndices) + 1 : 0;
      while (slots.length < filesToProcess.length) {
        slots.push(nextIndex++);
      }
    }

    const groupMembersByToken = new Map<string, File[]>();
    filesToProcess.forEach((file) => {
      const info = questionGroupInfoFromFileName(file.name);
      if (!info || info.isInstruction) return;
      const members = groupMembersByToken.get(info.token) || [];
      members.push(file);
      groupMembersByToken.set(info.token, members);
    });

    const filesToProcessCount = filesToProcess.length;
    setUploadProgress({ current: 0, total: filesToProcessCount });

    let processed = 0;
    const createdGroupTokens = new Set<string>();
    for (let fileIndex = 0; fileIndex < filesToProcessCount; fileIndex += 1) {
      const fileToUpload = filesToProcess[fileIndex];
      const slot = slots[fileIndex];
      const duplicate = findDuplicateQuestionContent(fileToUpload.name, subjectName);
      const imageUrl = await readAsDataURL(fileToUpload);
      if (!newQuestions[subjectName][slot]) newQuestions[subjectName][slot] = {};
      newQuestions[subjectName][slot].imageUrl = imageUrl;
      newQuestions[subjectName][slot].fileName = fileToUpload.name;
      const answerFromFileName = getAnswerFromQuestionFileName(fileToUpload.name);
      if (answerFromFileName) newQuestions[subjectName][slot].correctAnswer = answerFromFileName;
      if (duplicate) {
        newQuestions[subjectName][slot].duplicateMessage =
          `Bu soru (${duplicate.examName}) adlı denemede ${duplicate.questionNumber}. soru olarak kullanılmıştır.`;
      } else {
        delete newQuestions[subjectName][slot].duplicateMessage;
      }

      const groupInfo = questionGroupInfoFromFileName(fileToUpload.name);
      const groupMembers = groupInfo ? groupMembersByToken.get(groupInfo.token) || [] : [];
      if (groupInfo && !groupInfo.isInstruction && groupMembers.length >= 2) {
        const instructionImageUrl = instructionImageByToken.get(groupInfo.token) || "";
        const groupId = `filename-group:${String(exam?.id || "exam")}:${String(subjectName)}:${groupInfo.token}`;
        newQuestions[subjectName][slot] = applyQuestionGroupMetadata(
          newQuestions[subjectName][slot],
          {
            id: groupId,
            mode: "required",
            layout: instructionImageUrl ? "full-width-source" : "normal",
            order: groupInfo.order,
            size: groupMembers.length,
            title: "",
            instructionText: "",
            instructionImageUrl,
          },
        );
        createdGroupTokens.add(groupInfo.token);
      }

      processed += 1;
      setUploadProgress({ current: processed, total: filesToProcessCount });
    }

    if (!isFlexibleCourseBasedExam && processed < questionFiles.length) {
      alert(
        `Uyarı: Seçilen soru sayısı (${questionFiles.length}) planlanan boş soru alanından daha fazla. Grup bütünlüğünü korumak için ${questionFiles.length - processed} soru yüklenemedi.`,
      );
    }

    const nextCount = Object.values(newQuestions[subjectName] || {}).filter(
      (question: any) => question?.imageUrl,
    ).length;
    const nextStructure = isFlexibleCourseBasedExam
      ? withUpdatedSubjectCount(examStructure, subjectName, nextCount)
      : examStructure;

    onUpdateExam({ ...exam, questions: newQuestions, examStructure: nextStructure });
    setUploadProgress(null);
    showToast(
      `${processed} soru başarıyla kaydedildi.${createdGroupTokens.size > 0 ? ` ${createdGroupTokens.size} bağlantılı soru grubu dosya adından otomatik tanındı.` : ""}`,
    );
  };

  const handleDeleteQuestion = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeQuestion || !activeSubject) return;
    const subjectName = activeSubject.name;
    const qIndex = activeQuestion.questionIndex;

    const newQuestions = JSON.parse(JSON.stringify(questions));
    if (newQuestions[subjectName] && newQuestions[subjectName][qIndex]) {
      const removedQuestion = newQuestions[subjectName][qIndex];
      // Öğretmen tarafından seçilmiş bir soru yalnız sınav ekranından silinirse
      // periyodik senkronizasyon aynı soruyu yeniden ekler. Önce kaynak görevdeki
      // seçimi kaldır; sonra sınav kartını sil.
      rememberLocallyExcludedQuestion(subjectName, removedQuestion);
      // Önce ekrandan/sınav kaydından kaldır. Öğretmen görev kaydı temizliği
      // ağ üzerinden ayrıca yapılır; ağ hatası yönetici silmesini engelleyemez.
      void removeTeacherSelectionAtSource(removedQuestion, subjectName);
      if (removedQuestion?.systemQuestionId) {
        void fetch("/api/question-bank/usage", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: String(removedQuestion.systemQuestionId),
            examId: String(exam?.id || exam?.examCode || ""),
          }),
        }).catch(() => undefined);
      }

      if (isFlexibleCourseBasedExam) {
        const remaining = Object.entries(newQuestions[subjectName])
          .filter(([key, question]: any) => Number(key) !== qIndex && question?.imageUrl)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, question]) => question);
        newQuestions[subjectName] = Object.fromEntries(
          remaining.map((question, index) => [index, question]),
        );
      } else {
        newQuestions[subjectName][qIndex] = {};
      }
    }

    const nextCount = isFlexibleCourseBasedExam
      ? Object.values(newQuestions[subjectName] || {}).filter((question: any) => question?.imageUrl).length
      : questionCount;
    const nextStructure = isFlexibleCourseBasedExam
      ? withUpdatedSubjectCount(examStructure, subjectName, nextCount)
      : examStructure;
    const removedForExclusion = questions?.[subjectName]?.[qIndex] || {};
    const nextExcluded = withSuppressedTeacherQuestion(exam, subjectName, removedForExclusion);
    onUpdateExam({
      ...exam,
      questions: newQuestions,
      examStructure: nextStructure,
      teacherSelectionExcludedQuestionIdsBySubject: nextExcluded,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (isFlexibleCourseBasedExam) setActiveQuestion(null);
  };

  const handleBookletCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, booklet: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const imageUrl = await readAsDataURL(file);
    const newBookletCovers = { ...(exam.bookletCovers || {}) };
    newBookletCovers[booklet] = imageUrl;
    onUpdateExam({ ...exam, bookletCovers: newBookletCovers });
    e.target.value = "";
  };

  const handleDeleteBookletCover = (booklet: string) => {
    const newBookletCovers = { ...(exam.bookletCovers || {}) };
    delete newBookletCovers[booklet];
    onUpdateExam({ ...exam, bookletCovers: newBookletCovers });
  };

  const updateQuestionData = (field: string, value: any) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeQuestion || !activeSubject) return;
    const subjectName = activeSubject.name;
    const qIndex = activeQuestion.questionIndex;

    const newQuestions = { ...questions };
    if (!newQuestions[subjectName]) newQuestions[subjectName] = {};
    if (!newQuestions[subjectName][qIndex])
      newQuestions[subjectName][qIndex] = {};

    newQuestions[subjectName][qIndex][field] = value;

    const updatedExam = { ...exam, questions: newQuestions };
    onUpdateExam(updatedExam);
  };

  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  React.useEffect(() => {
    if (!activeQuestion || !activeSubject) return;
    const qIndex = activeQuestion.questionIndex;
    const qData = questions[activeSubject.name]?.[qIndex] || {};

    let resolvedUnit = String(qData.unit || "").trim();
    let resolvedTopic = String(qData.topic || "").trim();
    let resolvedOutcome = String(qData.outcome || "").trim();
    const unitId = String(qData.systemUnitId || qData.unitId || "").trim();
    const topicId = String(qData.systemTopicId || qData.topicId || "").trim();
    const outcomeId = String(qData.systemOutcomeId || qData.outcomeId || "").trim();

    for (const unit of curriculumTree) {
      const unitMatches = unitId && String(unit?.id) === unitId;
      for (const topic of (unit?.topics || [])) {
        const topicMatches = topicId && String(topic?.id) === topicId;
        const outcome = (topic?.outcomes || []).find(
          (item: any) => outcomeId && String(item?.id) === outcomeId,
        );
        if (!resolvedUnit && (unitMatches || topicMatches || outcome)) resolvedUnit = String(unit?.name || "");
        if (!resolvedTopic && (topicMatches || outcome)) resolvedTopic = String(topic?.name || "");
        if (!resolvedOutcome && outcome) resolvedOutcome = String(outcome?.name || "");
      }
    }

    setExpandedUnit(resolvedUnit || null);
    setExpandedTopic(resolvedTopic || null);

    if (!isQuestionEditingLocked && resolvedUnit && (
      resolvedUnit !== String(qData.unit || "") ||
      resolvedTopic !== String(qData.topic || "") ||
      resolvedOutcome !== String(qData.outcome || "")
    )) {
      const newQuestions = { ...questions };
      if (!newQuestions[activeSubject.name]) newQuestions[activeSubject.name] = {};
      newQuestions[activeSubject.name][qIndex] = {
        ...qData,
        unit: resolvedUnit,
        topic: resolvedTopic,
        outcome: resolvedOutcome,
      };
      onUpdateExam({ ...exam, questions: newQuestions });
    }
  }, [
    activeQuestion?.questionIndex,
    activeQuestion?.subjectIndex,
    activeQuestion?.testIndex,
    curriculumTree,
  ]);

  const persistSystemQuestionCurriculum = async (
    qData: any,
    unitName: string,
    topicName?: string,
    outcomeName?: string,
  ) => {
    const questionId = String(qData?.systemQuestionId || "").trim();
    if (!questionId) return true;

    const unit = curriculumTree.find((item: any) => item.name === unitName);
    const topic = unit?.topics?.find((item: any) => item.name === (topicName || ""));
    const outcome = topic?.outcomes?.find((item: any) => item.name === (outcomeName || ""));

    try {
      const response = await fetch(`/api/question-bank/questions/${encodeURIComponent(questionId)}/curriculum`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: Number(exam.gradeLevel || 0),
          courseId: String(qData?.systemCourseId || currentCurriculumCourseId || ""),
          unitId: String(unit?.id || ""),
          topicId: String(topic?.id || ""),
          outcomeId: String(outcome?.id || ""),
          unitName: String(unitName || ""),
          topicName: String(topicName || ""),
          outcomeName: String(outcomeName || ""),
        }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Soru müfredat bilgisi kaydedilemedi.");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Soru müfredat bilgisi kaydedilemedi.");
      return false;
    }
  };

  const handleCurriculumSelect = async (
    unit: string,
    topic?: string,
    outcome?: string,
  ) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeQuestion || !activeSubject) return;
    const subjectName = activeSubject.name;
    const qIndex = activeQuestion.questionIndex;

    const unitRow = curriculumTree.find((item: any) => item.name === unit);
    const topicRow = unitRow?.topics?.find((item: any) => item.name === (topic || ""));
    const outcomeRow = topicRow?.outcomes?.find((item: any) => item.name === (outcome || ""));
    const updatedAt = new Date().toISOString();

    const { nextExam, nextQuestion } = buildQuestionMetadataExam(subjectName, qIndex, {
      unit: unit || "",
      topic: topic || "",
      outcome: outcome || "",
      unitName: unit || "",
      topicName: topic || "",
      outcomeName: outcome || "",
      unitId: String(unitRow?.id || ""),
      topicId: String(topicRow?.id || ""),
      outcomeId: String(outcomeRow?.id || ""),
      systemUnitId: String(unitRow?.id || ""),
      systemTopicId: String(topicRow?.id || ""),
      systemOutcomeId: String(outcomeRow?.id || ""),
      systemCourseId: String(
        questions?.[subjectName]?.[qIndex]?.systemCourseId ||
        currentCurriculumCourseId ||
        "",
      ),
      curriculumManuallyCorrected: true,
      curriculumUpdatedAt: updatedAt,
    });

    try {
      await persistQuestionMetadataExam(nextExam);
    } catch (error) {
      showToast(
        `Konu/kazanım SQLite'a kaydedilemedi: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
      return;
    }

    const sourceSaved = await persistSystemQuestionCurriculum(nextQuestion, unit, topic, outcome);
    if (sourceSaved) showToast("Konu/kazanım bilgisi kalıcı olarak kaydedildi.");
  };

  const updateQuestionDataAtIndex = (qIndex: number, field: string, value: any) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject) return;
    const subjectName = activeSubject.name;

    const newQuestions = { ...questions };
    if (!newQuestions[subjectName]) newQuestions[subjectName] = {};
    if (!newQuestions[subjectName][qIndex])
      newQuestions[subjectName][qIndex] = {};

    newQuestions[subjectName][qIndex][field] = value;

    const updatedExam = { ...exam, questions: newQuestions };
    onUpdateExam(updatedExam);
  };

  const saveQuestionCorrectAnswerAtIndex = async (qIndex: number, rawAnswer: string) => {
    // Doğru cevap düzeltmesi kitapçık kilidinden bağımsızdır. Kilit soru görselini,
    // sırasını ve müfredatını korur; yanlış algılanmış A-E cevabı yine düzeltilebilir.
    if (!activeSubject) return;

    const answer = String(rawAnswer || "").trim().toUpperCase();
    if (!["A", "B", "C", "D", "E"].includes(answer)) return;

    const subjectName = activeSubject.name;
    const currentQuestion = questions?.[subjectName]?.[qIndex] || {};
    const answerUpdatedAt = new Date().toISOString();

    const { nextExam, nextQuestion } = buildQuestionMetadataExam(subjectName, qIndex, {
      correctAnswer: answer,
      answer,
      correct_answer: answer,
      answerManuallyCorrected: true,
      answerUpdatedAt,
    });

    // Önce sınavın kendisini SQLite'a doğrudan yazıp sunucudan onay alırız.
    // Başarı mesajı bu kayıt tamamlanmadan gösterilmez.
    try {
      await persistQuestionMetadataExam(nextExam);
    } catch (error) {
      showToast(
        `Doğru cevap SQLite'a kaydedilemedi: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
      return;
    }

    // Sistemden/öğretmen havuzundan gelen sorularda kanonik soru bankasındaki
    // cevabı da güncelleriz. Sonraki sınavlarda aynı soru yeniden seçildiğinde
    // yanlış dosya adı cevabı tekrar gelmez.
    const source = String(currentQuestion?.source || "").trim().toLowerCase();
    const canonicalQuestionId = String(
      nextQuestion?.systemQuestionId ||
      (["system", "admin-selection", "teacher-selection"].includes(source)
        ? (nextQuestion?.questionId || nextQuestion?.question_id || nextQuestion?.id || "")
        : ""),
    ).trim();

    if (!canonicalQuestionId) {
      showToast(`Doğru cevap ${answer} olarak kalıcı kaydedildi.`);
      return;
    }

    try {
      const response = await fetch(
        `/api/question-bank/questions/${encodeURIComponent(canonicalQuestionId)}/answer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Soru bankası cevabı güncellenemedi."));
      }
      showToast(`Doğru cevap ${answer} olarak sınava ve soru bankasına kalıcı kaydedildi.`);
    } catch (error) {
      // Sınav üzerindeki kalıcı SQLite kaydı korunur; yalnız kaynak havuza yazılamadığını bildiririz.
      showToast(
        `Doğru cevap sınavda ${answer} olarak kalıcı kaydedildi. Soru bankasına yazılamadı: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
    }
  };

  // Test bazlı soru numaraları: her yeni test 1'den başlar; ders geçişinde devam eder.
  // Soru kayıtları ise geriye dönük uyumluluk için ders içi 0 tabanlı indeksle tutulur.
  const getExcelSubjectTestOffset = (subjectName: string) => {
    if (!isTytQuestionManager) return 0;
    for (const test of (Array.isArray(examStructure) ? examStructure : [])) {
      const subjects = Array.isArray(test?.subjects) ? test.subjects : [];
      let offset = 0;
      for (const subject of subjects) {
        if (String(subject?.name || "").trim() === subjectName) return offset;
        offset += Math.max(0, Number(subject?.count) || 0);
      }
    }
    return 0;
  };

  const downloadAllSubjectsAnswerKeyTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Ders Adı", "A Kitapçığı Soru Numarası", "A Kitapçığı Cevap Anahtarı", "B Kitapçığı Soru Numarası"];
      const rows: Array<Array<string | number>> = [headers];
      for (const test of (Array.isArray(examStructure) ? examStructure : [])) {
        let numberWithinTest = 0;
        for (const subject of (Array.isArray(test?.subjects) ? test.subjects : [])) {
          const name = String(subject?.name || "").trim();
          const count = Math.max(0, Math.floor(Number(subject?.count) || 0));
          if (!name) continue;
          for (let number = 1; number <= count; number += 1) {
            rows.push([name, isTytQuestionManager ? numberWithinTest + number : number, "", ""]);
          }
          numberWithinTest += count;
        }
      }
      if (rows.length === 1) throw new Error("Şablon için önce sınav dersleri ve soru sayıları tanımlanmalıdır.");
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = [{ wch: 32 }, { wch: 29 }, { wch: 32 }, { wch: 30 }];
      sheet["!autofilter"] = { ref: `A1:D${rows.length}` };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Cevap Anahtarı");
      const filename = String(exam?.examName || exam?.name || "Sinav").replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
      XLSX.writeFile(book, `${filename}_Cevap_Anahtari_Sablonu.xlsx`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Excel şablonu hazırlanamadı.");
    }
  };

  // Sınavın tüm derslerini tek Excel dosyasından, tek kalıcı sınav yazmasıyla kaydeder.
  // Bütün satırlar doğrulanmadan hiçbir kayıt değiştirilmez.
  const handleAllSubjectsAnswerKeyExcelUpload = async (file?: File) => {
    if (!file || answerKeyExcelLoading) return;
    if (blockQuestionMutationWhenLocked()) return;
    setAnswerKeyExcelLoading(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Excel çalışma sayfası bulunamadı.");
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" });
      const norm = (value: unknown) => String(value ?? "").trim().toLocaleUpperCase("tr-TR")
        .replace(/[Çç]/g, "C").replace(/[Ğğ]/g, "G").replace(/[İIıi]/g, "I")
        .replace(/[Öö]/g, "O").replace(/[Şş]/g, "S").replace(/[Üü]/g, "U")
        .replace(/[^A-Z0-9]/g, "");
      const numeric = (value: unknown) => {
        const raw = String(value ?? "").trim();
        return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : 0;
      };
      const headersIndex = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => norm(cell).includes("CEVAP")));
      if (headersIndex < 0) throw new Error("Sütun başlıkları bulunamadı. 'Tüm Derslerin Excel Şablonunu İndir' dosyasını kullanınız.");
      const headers = rows[headersIndex].map(norm);
      const col = (names: string[]) => headers.findIndex((h: string) => names.some((name) => h.includes(name)));
      const subjectCol = col(["DERSADI", "DERSISMI"]);
      const aCol = col(["AKITAPCIGISORUNUMARASI", "AKITAPCIGISORUNO", "AKITAPCIKSORUNUMARASI", "ASORUNUMARASI", "ASORUNO"]);
      const answerCol = col(["AKITAPCIGICEVAPANAHTARI", "AKITAPCIGICEVAP", "ACEVAPANAHTARI", "ACEVAP", "DOGRUCEVAP"]);
      const bCol = col(["BKITAPCIGISORUNUMARASI", "BKITAPCIGISORUNO", "BKITAPCIKSORUNUMARASI", "BSORUNUMARASI", "BSORUNO"]);
      const cCol = col(["CKITAPCIGISORUNUMARASI", "CKITAPCIGISORUNO", "CSORUNUMARASI", "CSORUNO"]);
      const dCol = col(["DKITAPCIGISORUNUMARASI", "DKITAPCIGISORUNO", "DSORUNUMARASI", "DSORUNO"]);
      if (subjectCol < 0 || aCol < 0 || answerCol < 0) {
        throw new Error("Excel'de Ders Adı, A Kitapçığı Soru Numarası ve A Kitapçığı Cevap Anahtarı sütunları bulunmalıdır.");
      }
      const bookletKeys = String(exam.bookletType || "A").split("-").map((v: string) => v.trim().toUpperCase());
      if (bookletKeys.includes("B") && bCol < 0) throw new Error("B kitapçığı sütunu bulunamadı.");
      const subjects: Array<{ name: string; count: number; offset: number }> = [];
      for (const test of (Array.isArray(examStructure) ? examStructure : [])) {
        let offset = 0;
        for (const subject of (Array.isArray(test?.subjects) ? test.subjects : [])) {
          const name = String(subject?.name || "").trim();
          const count = Math.max(0, Math.floor(Number(subject?.count) || 0));
          if (name && count) subjects.push({ name, count, offset: isTytQuestionManager ? offset : 0 });
          offset += count;
        }
      }
      if (!subjects.length) throw new Error("Bu sınavda kayıtlı ders ve soru sayısı bulunamadı.");
      const subjectMap = new Map(subjects.map((subject) => [norm(subject.name), subject]));
      if (subjectMap.size !== subjects.length) throw new Error("Sınavda aynı isimde birden fazla ders bulundu. Toplu eşleştirme yapılamıyor.");
      // Soru aralığının test genelinde mi (11-20) yoksa eski ders içi mi
      // (1-10) olduğunu dersin bütün satırlarına bakarak belirle.
      const globalNumbers = new Map<string, boolean>();
      for (const subject of subjects) {
        const values = rows.slice(headersIndex + 1)
          .filter((row: any[]) => norm(row?.[subjectCol]) === norm(subject.name))
          .map((row: any[]) => numeric(row?.[aCol]));
        globalNumbers.set(subject.name, Boolean(subject.offset > 0 && values.length === subject.count &&
          values.every((v: number) => v > subject.offset && v <= subject.offset + subject.count)));
      }
      const incoming = new Map<string, Array<{ aNo: number; answer: string; booklets: Record<string, number> }>>();
      const errors: string[] = [];
      for (let i = headersIndex + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        if (!row.some((v: unknown) => String(v ?? "").trim())) continue;
        const subject = subjectMap.get(norm(row[subjectCol]));
        if (!subject) { errors.push(`${i + 1}. satır: ders sınavda bulunamadı (${String(row[subjectCol])}).`); continue; }
        const number = numeric(row[aCol]);
        const aNo = globalNumbers.get(subject.name) ? number - subject.offset : number;
        const answer = String(row[answerCol] ?? "").trim().toUpperCase();
        if (aNo < 1 || aNo > subject.count || !["A", "B", "C", "D", "E"].includes(answer)) {
          errors.push(`${i + 1}. satır: ${subject.name} soru numarası veya cevabı geçersiz.`);
          continue;
        }
        const booklets: Record<string, number> = { A: aNo };
        let valid = true;
        for (const [key, column] of [["B", bCol], ["C", cCol], ["D", dCol]] as Array<[string, number]>) {
          if (column < 0 || !String(row[column] ?? "").trim()) {
            if (bookletKeys.includes(key)) { errors.push(`${i + 1}. satır: ${key} kitapçığı soru numarası boş.`); valid = false; }
            continue;
          }
          const raw = numeric(row[column]);
          const local = globalNumbers.get(subject.name) ? raw - subject.offset : raw;
          if (local < 1 || local > subject.count) { errors.push(`${i + 1}. satır: ${key} kitapçığı soru numarası geçersiz.`); valid = false; }
          else booklets[key] = local;
        }
        if (!valid) continue;
        const entries = incoming.get(subject.name) || [];
        entries.push({ aNo, answer, booklets });
        incoming.set(subject.name, entries);
      }
      if (errors.length) throw new Error(errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n${errors.length - 5} hata daha var.` : ""));
      for (const subject of subjects) {
        const entries = incoming.get(subject.name) || [];
        if (entries.length !== subject.count) throw new Error(`${subject.name}: ${subject.count} cevap bekleniyor, Excel'de ${entries.length} adet var.`);
        const aNumbers = new Set(entries.map((row) => row.aNo));
        if (aNumbers.size !== subject.count) throw new Error(`${subject.name}: A kitapçığında tekrarlanan soru numarası bulunuyor.`);
        for (const key of ["B", "C", "D"]) {
          if (!bookletKeys.includes(key)) continue;
          const nums = entries.map((row) => row.booklets[key]);
          if (nums.some((n) => !n) || new Set(nums).size !== subject.count) throw new Error(`${subject.name}: ${key} kitapçığının soru numaraları eksik veya tekrarlı.`);
        }
      }
      const baseExam = latestExamRef.current || exam;
      const nextQuestions = JSON.parse(JSON.stringify(baseExam?.questions || {}));
      const updatedAt = new Date().toISOString();
      for (const subject of subjects) {
        const name = subject.name;
        if (!nextQuestions[name]) nextQuestions[name] = {};
        for (const row of (incoming.get(name) || [])) {
          const index = row.aNo - 1;
          const previous = { ...(questions?.[name]?.[index] || {}), ...(nextQuestions[name][index] || {}) };
          nextQuestions[name][index] = {
            ...previous, correctAnswer: row.answer, answer: row.answer, correct_answer: row.answer,
            answerManuallyCorrected: true, answerUpdatedAt: updatedAt,
            bookletNumbers: { ...(previous.bookletNumbers || {}), ...row.booklets },
          };
        }
      }
      // Toplu Excel: bütün dersleri tek sınav belgesi olarak kaydeder.
      // 10 saniyede veritabanı onayı gelmezse sahte başarı bildirimi gösterilmez.
      let bulkSaveTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          persistQuestionMetadataExam({ ...baseExam, questions: nextQuestions }),
          new Promise<never>((_, reject) => {
            bulkSaveTimeout = setTimeout(() => reject(new Error(
              "10 saniye içinde veritabanından kayıt onayı alınamadı. Kayıt tamamlanmış varsayılmayacak; lütfen tekrar yüklemeden önce cevapları kontrol edin."
            )), 10000);
          }),
        ]);
      } finally {
        if (bulkSaveTimeout !== undefined) clearTimeout(bulkSaveTimeout);
      }
      setShowAnswerKeyEntryModal(false);
      showToast(`İşlem tamamlanmıştır. ${subjects.length} dersin ${subjects.reduce((sum, s) => sum + s.count, 0)} cevabı kaydedildi.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel cevapları kaydedilemedi.";
      showToast(`Toplu Excel kaydı tamamlanamadı: ${message}`);
      alert(message);
    } finally {
      setAnswerKeyExcelLoading(false);
      if (answerKeyExcelInputRef.current) answerKeyExcelInputRef.current.value = "";
    }
  };

  const handleAnswerKeyExcelUpload = async (file?: File) => {
    if (!file || !activeSubject) return;
    if (blockQuestionMutationWhenLocked()) return;

    const subjectName = activeSubject.name;
    const normalizeExcelText = (value: unknown) => String(value ?? "")
      .trim()
      .toLocaleUpperCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Ç/g, "C")
      .replace(/Ğ/g, "G")
      .replace(/İ/g, "I")
      .replace(/Ö/g, "O")
      .replace(/Ş/g, "S")
      .replace(/Ü/g, "U")
      .replace(/[^A-Z0-9]/g, "");
    const validAnswer = (value: unknown) => {
      const answer = String(value ?? "").trim().toLocaleUpperCase("tr-TR");
      return ["A", "B", "C", "D", "E"].includes(answer) ? answer : "";
    };
    const positiveInt = (value: unknown) => {
      const cleaned = String(value ?? "").trim().replace(/[^0-9]/g, "");
      if (!cleaned) return 0;
      const num = Number(cleaned);
      return Number.isInteger(num) && num > 0 ? num : 0;
    };

    setAnswerKeyExcelLoading(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", raw: false });
      if (!workbook.SheetNames.length) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");

      const subjectKey = normalizeExcelText(subjectName);
      const sheetName = workbook.SheetNames.find((name: string) => {
        const key = normalizeExcelText(name);
        return key && subjectKey && (key.includes(subjectKey) || subjectKey.includes(key));
      }) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "", raw: false });
      if (!matrix.length) throw new Error("Excel sayfası boş.");

      const firstNonEmptyRow = matrix.findIndex((row: any[]) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""));
      if (firstNonEmptyRow < 0) throw new Error("Excel sayfasında veri bulunamadı.");

      let headerRowIndex = -1;
      for (let rowIndex = firstNonEmptyRow; rowIndex < Math.min(matrix.length, firstNonEmptyRow + 12); rowIndex += 1) {
        const keys = (matrix[rowIndex] || []).map(normalizeExcelText);
        if (keys.some((key: string) => key.includes("CEVAP") || key.includes("ANAHTAR"))) {
          headerRowIndex = rowIndex;
          break;
        }
      }

      let subjectCol = -1;
      let aQuestionCol = -1;
      let answerCol = -1;
      let bQuestionCol = -1;
      let cQuestionCol = -1;
      let dQuestionCol = -1;
      let dataStartRow = firstNonEmptyRow;

      if (headerRowIndex >= 0) {
        const headers = (matrix[headerRowIndex] || []).map(normalizeExcelText);
        const findHeader = (aliases: string[]) => headers.findIndex((header: string) =>
          aliases.some((alias) => header === alias || header.includes(alias)),
        );
        subjectCol = findHeader(["DERSADI", "DERSISMI", "DERS"]);
        aQuestionCol = findHeader([
          "AKITAPCIGISORUNUMARASI", "AKITAPCIGISORUNO", "AKITAPCIKSORUNUMARASI", "AKITAPCIKSORUNO", "ASORUNUMARASI", "ASORUNO", "ASORU",
        ]);
        if (aQuestionCol < 0) aQuestionCol = findHeader(["SORUNUMARASI", "SORUNO"]);
        answerCol = findHeader([
          "AKITAPCIGICEVAPANAHTARI", "AKITAPCIGICEVAP", "AKITAPCIKCEVAP", "ACEVAPANAHTARI", "ACEVAP", "DOGRUCEVAP", "CEVAPANAHTARI", "CEVAP",
        ]);
        bQuestionCol = findHeader([
          "BKITAPCIGISORUNUMARASI", "BKITAPCIGISORUNO", "BKITAPCIKSORUNUMARASI", "BKITAPCIKSORUNO", "BSORUNUMARASI", "BSORUNO", "BSORU",
        ]);
        cQuestionCol = findHeader([
          "CKITAPCIGISORUNUMARASI", "CKITAPCIGISORUNO", "CKITAPCIKSORUNUMARASI", "CKITAPCIKSORUNO", "CSORUNUMARASI", "CSORUNO", "CSORU",
        ]);
        dQuestionCol = findHeader([
          "DKITAPCIGISORUNUMARASI", "DKITAPCIGISORUNO", "DKITAPCIKSORUNUMARASI", "DKITAPCIKSORUNO", "DSORUNUMARASI", "DSORUNO", "DSORU",
        ]);
        dataStartRow = headerRowIndex + 1;
      } else {
        const sample = matrix[firstNonEmptyRow] || [];
        if (validAnswer(sample[0]) && positiveInt(sample[1])) {
          answerCol = 0;
          bQuestionCol = 1;
          dataStartRow = firstNonEmptyRow;
        } else if (positiveInt(sample[0]) && validAnswer(sample[1])) {
          aQuestionCol = 0;
          answerCol = 1;
          bQuestionCol = sample.length > 2 ? 2 : -1;
          cQuestionCol = sample.length > 3 ? 3 : -1;
          dQuestionCol = sample.length > 4 ? 4 : -1;
          dataStartRow = firstNonEmptyRow;
        }
      }

      if (answerCol < 0) {
        throw new Error("Excel'de A kitapçığı cevap sütunu bulunamadı. 'Cevap' veya 'A Cevap' başlığı kullanılmalıdır.");
      }

      const bookletKeys = String(exam.bookletType || "A")
        .split("-")
        .map((value: string) => value.trim().toLocaleUpperCase("tr-TR"))
        .filter((value: string) => ["A", "B", "C", "D"].includes(value));
      if (bookletKeys.includes("B") && bQuestionCol < 0) {
        throw new Error("Bu sınav A-B kitapçıklı. Excel'de 'B Kitapçığı Soru No' sütunu bulunamadı.");
      }

      // Hem eski (her derste 1'den başlayan) Excel dosyalarını hem de
      // yeni (aynı test içinde devam eden) şablonu okuyabiliriz.
      const testOffset = getExcelSubjectTestOffset(subjectName);
      const uploadedANumbers = matrix.slice(dataStartRow)
        .filter((row: any[]) => subjectCol < 0 || normalizeExcelText(row?.[subjectCol]) === subjectKey)
        .map((row: any[]) => aQuestionCol >= 0 ? positiveInt(row?.[aQuestionCol]) : 0)
        .filter(Boolean);
      const usesTestNumbers = isTytQuestionManager && testOffset > 0 &&
        uploadedANumbers.length > 0 &&
        uploadedANumbers.every((value: number) => value > testOffset && value <= testOffset + questionCount);
      const toLocalNumber = (value: number) => usesTestNumbers ? value - testOffset : value;

      type ExcelAnswerRow = { aNo: number; answer: string; bookletNumbers: Record<string, number> };
      const parsedRows: ExcelAnswerRow[] = [];
      const errors: string[] = [];
      const seenA = new Set<number>();
      const seenByBooklet: Record<string, Set<number>> = { B: new Set(), C: new Set(), D: new Set() };
      let implicitANo = 0;

      for (let rowIndex = dataStartRow; rowIndex < matrix.length; rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        if (subjectCol >= 0 && normalizeExcelText(row[subjectCol]) !== subjectKey) continue;
        const hasAnyValue = row.some((cell: unknown) => String(cell ?? "").trim() !== "");
        if (!hasAnyValue) continue;

        implicitANo += 1;
        const aNo = aQuestionCol >= 0 ? toLocalNumber(positiveInt(row[aQuestionCol])) : implicitANo;
        const answer = validAnswer(row[answerCol]);
        const excelRow = rowIndex + 1;

        if (!aNo || aNo > questionCount) {
          errors.push(`${excelRow}. satır: A kitapçığı soru numarası 1-${questionCount} arasında olmalıdır.`);
          continue;
        }
        if (!answer) {
          errors.push(`${excelRow}. satır: A kitapçığı cevabı A, B, C, D veya E olmalıdır.`);
          continue;
        }
        if (seenA.has(aNo)) {
          errors.push(`${excelRow}. satır: A kitapçığı ${aNo}. soru birden fazla kez yazılmış.`);
          continue;
        }

        const bookletNumbers: Record<string, number> = { A: aNo };
        const columnByBooklet: Record<string, number> = { B: bQuestionCol, C: cQuestionCol, D: dQuestionCol };
        let rowHasError = false;
        for (const bookletKey of ["B", "C", "D"]) {
          const columnIndex = columnByBooklet[bookletKey];
          if (columnIndex < 0) continue;
          const raw = String(row[columnIndex] ?? "").trim();
          if (!raw) continue;
          const number = positiveInt(raw);
          if (!number || number > questionCount) {
            errors.push(`${excelRow}. satır: ${bookletKey} kitapçığı soru numarası 1-${questionCount} arasında olmalıdır.`);
            rowHasError = true;
            break;
          }
          if (seenByBooklet[bookletKey].has(number)) {
            errors.push(`${excelRow}. satır: ${bookletKey} kitapçığında ${number}. soru numarası birden fazla kez kullanılmış.`);
            rowHasError = true;
            break;
          }
          bookletNumbers[bookletKey] = number;
        }
        if (rowHasError) continue;
        if (bookletKeys.includes("B") && !bookletNumbers.B) {
          errors.push(`${excelRow}. satır: B kitapçığı soru numarası boş.`);
          continue;
        }

        seenA.add(aNo);
        for (const bookletKey of ["B", "C", "D"]) {
          if (bookletNumbers[bookletKey]) seenByBooklet[bookletKey].add(bookletNumbers[bookletKey]);
        }
        parsedRows.push({ aNo, answer, bookletNumbers });
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 6).join("\n") + (errors.length > 6 ? `\n... ${errors.length - 6} hata daha var.` : ""));
      }
      if (parsedRows.length !== questionCount) {
        throw new Error(`Excel'de ${parsedRows.length} geçerli soru bulundu. ${subjectName} için ${questionCount} soru bekleniyor.`);
      }
      for (let number = 1; number <= questionCount; number += 1) {
        if (!seenA.has(number)) throw new Error(`A kitapçığında ${number}. soru Excel'de bulunamadı.`);
      }
      if (bookletKeys.includes("B") && seenByBooklet.B.size !== questionCount) {
        throw new Error(`B kitapçığında ${questionCount} farklı soru numarası bulunmalıdır.`);
      }

      const baseExam = latestExamRef.current || exam;
      const nextQuestions = JSON.parse(JSON.stringify(baseExam?.questions || {}));
      if (!nextQuestions[subjectName]) nextQuestions[subjectName] = {};
      const updatedAt = new Date().toISOString();

      parsedRows.forEach(({ aNo, answer, bookletNumbers }) => {
        const qIndex = aNo - 1;
        const visibleQuestion = questions?.[subjectName]?.[qIndex] || {};
        const storedQuestion = nextQuestions?.[subjectName]?.[qIndex] || {};
        const currentQuestion = { ...visibleQuestion, ...storedQuestion };
        nextQuestions[subjectName][qIndex] = {
          ...currentQuestion,
          correctAnswer: answer,
          answer,
          correct_answer: answer,
          answerManuallyCorrected: true,
          answerUpdatedAt: updatedAt,
          bookletNumbers: {
            ...(currentQuestion?.bookletNumbers || {}),
            ...bookletNumbers,
          },
        };
      });

      // Kalıcı kayıt yanıtı gelmezse yükleme göstergesi süresiz açık kalmasın.
      // Yalnızca gerçek kayıt tamamlandığında başarı bildirimi verilir.
      let saveTimeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          persistQuestionMetadataExam({ ...baseExam, questions: nextQuestions }),
          new Promise<never>((_, reject) => {
            saveTimeoutId = setTimeout(() => reject(new Error(
              "Excel okundu ancak kayıt işlemi zamanında tamamlanmadı. Lütfen bağlantıyı ve veritabanı durumunu kontrol edip tekrar deneyin."
            )), 25000);
          }),
        ]);
      } finally {
        if (saveTimeoutId !== undefined) clearTimeout(saveTimeoutId);
      }
      setShowAnswerKeyEntryModal(false);
      showToast(`${subjectName}: Cevap anahtarı ve kitapçık eşleştirmesi başarıyla kaydedildi.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel cevap anahtarı okunamadı.";
      showToast(`Excel kaydı tamamlanamadı: ${message}`);
      alert(message);
    } finally {
      setAnswerKeyExcelLoading(false);
      if (answerKeyExcelInputRef.current) answerKeyExcelInputRef.current.value = "";
    }
  };

  const saveQuestionColumnSpanAtIndex = async (qIndex: number, rawColumnSpan: number) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject) return;

    const columnSpan: 1 | 2 = Number(rawColumnSpan) === 2 ? 2 : 1;
    const subjectName = activeSubject.name;
    const currentQuestion = questions?.[subjectName]?.[qIndex] || {};
    const columnSpanUpdatedAt = new Date().toISOString();

    const { nextExam, nextQuestion } = buildQuestionMetadataExam(subjectName, qIndex, {
      columnSpan,
      columnSpanUpdatedAt,
    });

    try {
      await persistQuestionMetadataExam(nextExam);
    } catch (error) {
      showToast(
        `Sütun genişliği SQLite'a kaydedilemedi: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
      return;
    }

    const source = String(currentQuestion?.source || "").trim().toLowerCase();
    const canonicalQuestionId = String(
      nextQuestion?.systemQuestionId ||
      (["system", "admin-selection", "teacher-selection"].includes(source)
        ? (nextQuestion?.questionId || nextQuestion?.question_id || nextQuestion?.id || "")
        : ""),
    ).trim();

    if (!canonicalQuestionId) {
      showToast(`Soru ${columnSpan} sütun olarak kalıcı kaydedildi.`);
      return;
    }

    try {
      const response = await fetch(
        `/api/question-bank/questions/${encodeURIComponent(canonicalQuestionId)}/column-span`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnSpan }),
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Soru bankası sütun genişliği güncellenemedi."));
      }
      showToast(`Soru ${columnSpan} sütun olarak sınava ve soru bankasına kalıcı kaydedildi.`);
    } catch (error) {
      showToast(
        `Sütun genişliği sınavda ${columnSpan} olarak kalıcı kaydedildi. Soru bankasına yazılamadı: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
    }
  };

  const handleCurriculumSelectAtIndex = async (
    qIndex: number,
    unit: string,
    topic?: string,
    outcome?: string,
  ) => {
    if (blockQuestionMutationWhenLocked()) return;
    if (!activeSubject) return;
    const subjectName = activeSubject.name;

    const unitRow = curriculumTree.find((item: any) => item.name === unit);
    const topicRow = unitRow?.topics?.find((item: any) => item.name === (topic || ""));
    const outcomeRow = topicRow?.outcomes?.find((item: any) => item.name === (outcome || ""));
    const updatedAt = new Date().toISOString();

    const { nextExam, nextQuestion } = buildQuestionMetadataExam(subjectName, qIndex, {
      unit: unit || "",
      topic: topic || "",
      outcome: outcome || "",
      unitName: unit || "",
      topicName: topic || "",
      outcomeName: outcome || "",
      unitId: String(unitRow?.id || ""),
      topicId: String(topicRow?.id || ""),
      outcomeId: String(outcomeRow?.id || ""),
      systemUnitId: String(unitRow?.id || ""),
      systemTopicId: String(topicRow?.id || ""),
      systemOutcomeId: String(outcomeRow?.id || ""),
      systemCourseId: String(
        questions?.[subjectName]?.[qIndex]?.systemCourseId ||
        currentCurriculumCourseId ||
        "",
      ),
      curriculumManuallyCorrected: true,
      curriculumUpdatedAt: updatedAt,
    });

    try {
      await persistQuestionMetadataExam(nextExam);
    } catch (error) {
      showToast(
        `Konu/kazanım SQLite'a kaydedilemedi: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      );
      return;
    }

    const sourceSaved = await persistSystemQuestionCurriculum(nextQuestion, unit, topic, outcome);
    if (sourceSaved) showToast("Konu/kazanım bilgisi kalıcı olarak kaydedildi.");
  };

  const getFlatCurriculumOptions = () => {
    const list: { label: string; unit: string; topic?: string; outcome?: string }[] = [];
    curriculumTree.forEach((unit: any) => {
      list.push({ label: unit.name, unit: unit.name });
      if (unit.topics) {
        unit.topics.forEach((topic: any) => {
          list.push({ label: `   ${topic.name}`, unit: unit.name, topic: topic.name });
          if (topic.outcomes) {
            topic.outcomes.forEach((out: any) => {
              list.push({ label: `      ${out.name}`, unit: unit.name, topic: topic.name, outcome: out.name });
            });
          }
        });
      }
    });
    return list;
  };

  const normalizeAnswerValue = (value: unknown) => {
    const answer = String(value || "").trim().toLocaleUpperCase("tr-TR");
    return ["A", "B", "C", "D", "E"].includes(answer) ? answer : "";
  };

  const buildLegacyLockedAnswerLookup = async () => {
    const lookup = new Map<string, string>();
    const tasks: Promise<void>[] = [];

    (exam.examStructure || []).forEach((test: any) => {
      (test.subjects || []).forEach((subj: any) => {
        const subjectName = String(subj?.name || test?.testName || "").trim();
        const source = questions?.[subj.name] || exam.questions?.[subj.name] || {};
        Object.values(source || {}).forEach((question: any) => {
          const rawImageUrl = String(question?.imageUrl || "").trim();
          const answer = normalizeAnswerValue(getQuestionCorrectAnswer(question, exam.examSource === "Sistem"));
          if (!subjectName || !rawImageUrl || !answer) return;
          tasks.push((async () => {
            try {
              const pdfImageUrl = await toPdfImageDataUrl(rawImageUrl);
              if (pdfImageUrl) lookup.set(`${subjectName}::${pdfImageUrl}`, answer);
            } catch {
              // Eski sabit kitapçıklarda görsel yeniden çözülemezse yanlış cevap
              // üretmek yerine cevap anahtarında "-" bırakılır.
            }
          })());
        });
      });
    });

    await Promise.all(tasks);
    return lookup;
  };

  const upgradeBookletLayoutLockForEvaluation = async () => {
    const currentLock = exam?.bookletLayoutLock;
    if (!currentLock?.booklets || typeof currentLock.booklets !== "object") return currentLock;

    const questionLookup = new Map<string, { sourceIndex: number; answer: string }>();
    const tasks: Promise<void>[] = [];

    (exam.examStructure || []).forEach((test: any) => {
      (test.subjects || []).forEach((subj: any) => {
        const subjectName = String(subj?.name || test?.testName || "").trim();
        const source = questions?.[subj.name] || exam.questions?.[subj.name] || {};
        Object.entries(source || {}).forEach(([rawIndex, question]: [string, any]) => {
          const sourceIndex = Number(rawIndex);
          const rawImageUrl = String(question?.imageUrl || "").trim();
          if (!subjectName || !Number.isInteger(sourceIndex) || sourceIndex < 0 || !rawImageUrl) return;
          const answer = normalizeAnswerValue(getQuestionCorrectAnswer(question, exam.examSource === "Sistem"));
          tasks.push((async () => {
            try {
              const pdfImageUrl = await toPdfImageDataUrl(rawImageUrl);
              if (pdfImageUrl) questionLookup.set(`${subjectName}::${pdfImageUrl}`, { sourceIndex, answer });
            } catch {
              // Görsel çözülemezse mevcut kilit kaydını bozmadan bırak.
            }
          })());
        });
      });
    });

    await Promise.all(tasks);
    if (!questionLookup.size) return currentLock;

    const nextLock = JSON.parse(JSON.stringify(currentLock));
    const assets = nextLock?.assets && typeof nextLock.assets === "object" ? nextLock.assets : {};
    Object.values(nextLock.booklets || {}).forEach((booklet: any) => {
      (Array.isArray(booklet?.pages) ? booklet.pages : []).forEach((page: any) => {
        const subjectName = String(page?.testName || "").trim();
        const rawColumns = Array.isArray(page?.columns) ? page.columns : [[], []];
        rawColumns.forEach((column: any[]) => {
          (Array.isArray(column) ? column : []).forEach((item: any) => {
            const assetKey = String(item?.imageAsset || "");
            const imageUrl = assetKey ? String(assets?.[assetKey] || "") : "";
            const matched = imageUrl ? questionLookup.get(`${subjectName}::${imageUrl}`) : undefined;
            if (!matched) return;
            item.sourceIndex = matched.sourceIndex;
            if (matched.answer) item.answer = matched.answer;
          });
        });
      });
    });
    return nextLock;
  };

  const generateAnswerKeyData = async () => {
    const bookletKeys = (exam.bookletType
      ? exam.bookletType.split("-").map((value: string) => value.trim().toLocaleUpperCase("tr-TR")).filter(Boolean)
      : ["A"]
    ).slice(0, 4);

    const lockedInputs = lockedBookletInputs || unpackBookletLayoutLock(exam?.bookletLayoutLock);
    const needsLegacyLookup = bookletKeys.some((key: string) =>
      (lockedInputs?.[key]?.pages || []).some((page: any) =>
        (page?.columns || []).some((column: any[]) =>
          (column || []).some((item: any) => !normalizeAnswerValue(item?.answer) && Boolean(item?.imageUrl)),
        ),
      ),
    );
    const legacyLookup = needsLegacyLookup ? await buildLegacyLockedAnswerLookup() : new Map<string, string>();

    const booklets = bookletKeys.map((bookletKey: string) => {
      const input = lockedInputs?.[bookletKey] || null;
      const sectionOrder: string[] = [];
      const sectionAnswers = new Map<string, Array<{ number: number; answer: string }>>();

      if (input) {
        (input.pages || []).forEach((page: any) => {
          const sectionTitle = String(page?.testName || "SORULAR").trim() || "SORULAR";
          const pageItems = ([0, 1] as const).flatMap((columnIndex) => page?.columns?.[columnIndex] || []);
          if (!pageItems.length) return;
          if (!sectionAnswers.has(sectionTitle)) {
            sectionAnswers.set(sectionTitle, []);
            sectionOrder.push(sectionTitle);
          }

          pageItems.forEach((item: any) => {
            const number = Math.max(1, Number(item?.number || 0));
            const storedAnswer = normalizeAnswerValue(item?.answer);
            const legacyAnswer = item?.imageUrl
              ? normalizeAnswerValue(legacyLookup.get(`${sectionTitle}::${String(item.imageUrl)}`))
              : "";
            sectionAnswers.get(sectionTitle)!.push({
              number,
              answer: storedAnswer || legacyAnswer || "-",
            });
          });
        });
      } else {
        // Sabit yerleşim bulunmayan eski kayıtlar için yalnız mevcut soru sırası
        // kullanılır. Normal akışta cevap anahtarı butonu zaten sabit kitapçık
        // oluşturulmadan aktif olmaz.
        (exam.examStructure || []).forEach((test: any) => {
          let numberWithinTest = 0;
          (test.subjects || []).forEach((subj: any) => {
            const sectionTitle = String(subj?.name || test?.testName || "SORULAR").trim() || "SORULAR";
            const totalQuestions = Number(subj?.count || 0);
            const source = questions?.[subj.name] || exam.questions?.[subj.name] || {};
            const rows: Array<{ number: number; answer: string }> = [];
            for (let index = 0; index < totalQuestions; index++) {
              const sourceIndex = exam.examSource === "Basılı Yayın"
                ? getPrintedQuestionIndex(exam, bookletKey, index + 1, subj.name, totalQuestions)
                : getQuestionIndexForBooklet(bookletKey, index, totalQuestions);
              rows.push({
                number: isTytQuestionManager ? numberWithinTest + index + 1 : index + 1,
                answer: normalizeAnswerValue(getQuestionCorrectAnswer(source?.[sourceIndex], exam.examSource === "Sistem")) || "-",
              });
            }
            numberWithinTest += totalQuestions;
            sectionOrder.push(sectionTitle);
            sectionAnswers.set(sectionTitle, rows);
          });
        });
      }

      return {
        key: bookletKey,
        sections: sectionOrder.map((title) => ({
          title,
          answers: (sectionAnswers.get(title) || []).sort((a, b) => a.number - b.number),
        })),
      };
    });

    return { booklets };
  };

  const handleDownloadPDF = async () => {
    showToast("Cevap anahtarı PDF'i sabit kitapçık sırasına göre oluşturuluyor...");
    const { booklets } = await generateAnswerKeyData();
    await downloadAnswerKeyPdf({
      examName: replaceLegacyExamTerminology(exam.examName),
      booklets,
    });
    showToast(`${booklets.length} kitapçığın cevap anahtarı indirildi!`);
  };

  const handleSendWhatsApp = async () => {
    const { booklets } = await generateAnswerKeyData();
    let text = `*${replaceLegacyExamTerminology(exam.examName)} Cevap Anahtarı*\n\n`;

    booklets.forEach((booklet: any) => {
      text += `*${booklet.key} KİTAPÇIĞI*\n`;
      (booklet.sections || []).forEach((section: any) => {
        text += `_${replaceLegacyExamTerminology(section.title)}_\n`;
        (section.answers || []).forEach((entry: any, idx: number) => {
          text += `${entry.number}-${entry.answer} `;
          if ((idx + 1) % 5 === 0) text += "\n";
        });
        text += "\n";
      });
      text += "\n";
    });

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getStoredExamHeaderDesign = async (
    courseName: string,
    gradeLevel?: unknown,
  ): Promise<string> => {
    // Ölçme Araçları > Tasarım > Ünite Denemeleri ile AYNI depo anahtarı.
    // Yeni yapı sınıf + ders bazlıdır: örn. "9::coğrafya".
    const storeKey = "edupanel_exam_tool_exam_headers_v1";

    // Tasarım ekranındaki anahtar üretimiyle birebir aynı normalizasyon.
    const normalizeStoreKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, " ");

    // Eski kayıtlar / farklı yazımlar için yalnız eşleştirmede kullanılan gevşek normalizasyon.
    const normalizeMatchKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");

    const grade = String(gradeLevel || "").match(/\d{1,2}/)?.[0] || "";
    const courseStoreKey = normalizeStoreKey(courseName);
    const courseMatchKey = normalizeMatchKey(courseName);

    let designs: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(storeKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) designs = parsed;
    } catch {}

    let asset: any = null;

    // 1) Öncelik: Tasarım > Ünite Denemeleri ekranında seçilen SINIF + DERS kaydı.
    if (grade && courseStoreKey) {
      asset = designs[`${grade}::${courseStoreKey}`] || null;
    }

    // 2) Anahtar farklı yazılmış olsa bile asset üzerindeki gradeLevel/courseName ile kesin eşleştir.
    if (!asset && grade && courseMatchKey) {
      const exactGradeCourse = Object.entries(designs).find(([key, value]: [string, any]) => {
        const storedGrade = String(value?.gradeLevel || key.split("::")[0] || "").match(/\d{1,2}/)?.[0] || "";
        const storedCourse = normalizeMatchKey(value?.courseName || key.split("::").slice(1).join("::"));
        return storedGrade === grade && storedCourse === courseMatchKey;
      });
      asset = exactGradeCourse?.[1] || null;
    }

    // 3) Eski ders-bazlı kayıtlar varsa geriye dönük uyumluluk.
    if (!asset && courseStoreKey) {
      asset = designs[courseStoreKey] || null;
    }
    if (!asset && courseMatchKey) {
      const legacy = Object.entries(designs).find(([key, value]: [string, any]) => {
        const storedGrade = String(value?.gradeLevel || "").match(/\d{1,2}/)?.[0] || "";
        if (grade && storedGrade && storedGrade !== grade) return false;
        const storedCourse = normalizeMatchKey(value?.courseName || key);
        return storedCourse === courseMatchKey;
      });
      asset = legacy?.[1] || null;
    }

    const source = String(asset?.dataUrl || "").trim();
    if (!source) return "";

    // pdfmake JPG/PNG data URL'lerini doğrudan kullanabilir. SVG tasarımlarını
    // da kitapçıkta güvenilir biçimde göstermek için PNG'ye rasterize et.
    if (!/^data:image\/svg\+xml/i.test(source)) return await toPdfImageDataUrl(source);

    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1200, img.naturalWidth || 1200);
          canvas.height = Math.max(120, img.naturalHeight || 120);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Ünite denemesi başlığı dönüştürülemedi.");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch (error) { reject(error); }
      };
      img.onerror = () => reject(new Error(`${courseName} ünite tarama başlığı okunamadı.`));
      img.src = source;
    });
  };

  const buildOptimizedBookletInput = async (bookletKey: string): Promise<BookletPdfInput> => {
    type LayoutQuestion = BookletLayoutQuestion & { requestedGap: number; sourceIndex?: number; subjectName?: string };
    type PlannedPage = Omit<BookletLayoutPage, "testName" | "isTestStart">;

    const questionBankCurriculumById = new Map<string, any>();
    const loadedQuestionBankScopes = new Set<string>();

    const loadQuestionBankCurriculumFor = async (question: any) => {
      const questionId = String(
        question?.systemQuestionId || question?.questionId || question?.question_id || question?.id || "",
      ).trim();
      if (!questionId) return null;
      if (questionBankCurriculumById.has(questionId)) return questionBankCurriculumById.get(questionId);

      const grade = Number(normalizeGradeLevel(exam?.gradeLevel) || 0);
      const preferredCourseId = String(
        question?.systemCourseId || question?.courseId || question?.course_id || "",
      ).trim();

      const loadScope = async (courseId: string) => {
        const scopeKey = `${grade}|${courseId || "*"}`;
        if (loadedQuestionBankScopes.has(scopeKey)) return;
        loadedQuestionBankScopes.add(scopeKey);
        let offset = 0;
        let total = 0;
        do {
          try {
            const payload: any = await listQuestionBankRecords({
              status: "active",
              ...(grade ? { grade } : {}),
              ...(courseId ? { courseId } : {}),
              limit: 500,
              offset,
            });
            const rows = Array.isArray(payload?.questions)
              ? payload.questions
              : Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.items)
                  ? payload.items
                  : Array.isArray(payload?.rows)
                    ? payload.rows
                    : Array.isArray(payload?.data)
                      ? payload.data
                      : [];
            rows.forEach((row: any) => {
              const id = String(row?.id || row?.questionId || row?.question_id || "").trim();
              if (id) questionBankCurriculumById.set(id, row);
            });
            total = Number(payload?.total || rows.length || 0);
            offset += rows.length;
            if (!rows.length || questionBankCurriculumById.has(questionId)) break;
          } catch {
            break;
          }
        } while (offset < total);
      };

      // Önce görevdeki ders kimliğiyle dar sorgu yap. Eski görevlerde courseId alias
      // kalmışsa, soru bulunamadığında aynı sınıfın tüm kayıtlarında exact ID ara.
      await loadScope(preferredCourseId);
      if (!questionBankCurriculumById.has(questionId) && preferredCourseId) {
        await loadScope("");
      }

      return questionBankCurriculumById.get(questionId) || null;
    };

    const resolvePdfQuestionCurriculum = async (question: any, subjectName: string) => {
      let unitName = String(
        question?.unitName || question?.unit_name || question?.unit || question?.systemUnitName || "",
      ).trim();
      let topicName = String(
        question?.topicName || question?.topic_name || question?.topic || question?.systemTopicName || "",
      ).trim();
      let outcomeName = String(
        question?.outcomeName || question?.outcome_name || question?.outcome || question?.systemOutcomeName || "",
      ).trim();
      let courseId = String(
        question?.systemCourseId || question?.courseId || question?.course_id || "",
      ).trim();
      let unitId = String(question?.systemUnitId || question?.unitId || question?.unit_id || "").trim();
      let topicId = String(question?.systemTopicId || question?.topicId || question?.topic_id || "").trim();
      let outcomeId = String(question?.systemOutcomeId || question?.outcomeId || question?.outcome_id || "").trim();

      // Görev kaydında yalnız soru kimliği kalmışsa canonical soru bankasından
      // hiyerarşi kimliklerini yeniden bul. Bu, eski seçimlerdeki boş başlık alanını
      // kendiliğinden onarır ve kullanıcıdan soruyu yeniden seçmesini istemez.
      if (!unitName || !topicName || !outcomeName || !unitId || !topicId || !outcomeId) {
        const bankRow = await loadQuestionBankCurriculumFor(question);
        if (bankRow) {
          courseId ||= String(bankRow?.courseId || bankRow?.course_id || "").trim();
          unitId ||= String(bankRow?.unitId || bankRow?.unit_id || "").trim();
          topicId ||= String(bankRow?.topicId || bankRow?.topic_id || "").trim();
          outcomeId ||= String(bankRow?.outcomeId || bankRow?.outcome_id || "").trim();
          unitName ||= String(bankRow?.unitName || bankRow?.unit_name || bankRow?.unit || "").trim();
          topicName ||= String(bankRow?.topicName || bankRow?.topic_name || bankRow?.topic || "").trim();
          outcomeName ||= String(bankRow?.outcomeName || bankRow?.outcome_name || bankRow?.outcome || "").trim();
        }
      }

      const candidateTrees: any[][] = [];
      const pushTree = (units: any[]) => {
        if (!Array.isArray(units) || units.length === 0) return;
        const mapped = mapCurriculumUnits(units);
        if (mapped.length) candidateTrees.push(mapped);
      };

      // PDF oluşturulurken aktif ekrandaki ders başka bir ders olsa bile, her dersin
      // kendi canlı müfredatını çöz. Böylece kitapçık özeti activeSubject'a bağlı kalmaz.
      try {
        const entry = resolveCurriculumEntry(authoritativeCurriculumStore, {
          courseId,
          grade: normalizeGradeLevel(exam?.gradeLevel),
          courseName: subjectName,
        });
        if (entry?.curriculum?.units) pushTree(entry.curriculum.units);
      } catch {}

      if (Array.isArray(curriculumTree) && curriculumTree.length > 0) {
        candidateTrees.push(curriculumTree);
      }

      // Eski öğretmen görevlerinde yalnız müfredat kimlikleri bulunabiliyor. Ders adı
      // veya courseId eşleşmese bile kimlikleri bütün authoritative store içinde ara.
      if ((!unitName || !topicName || !outcomeName) && (unitId || topicId || outcomeId)) {
        Object.values(authoritativeCurriculumStore || {}).forEach((curriculum: any) => {
          pushTree(curriculum?.units || curriculum?.curriculum?.units || []);
        });
      }

      const fillFromTree = (tree: any[]) => {
        for (const unit of tree || []) {
          const unitMatches = Boolean(unitId && String(unit?.id || "") === unitId);
          for (const topic of unit?.topics || []) {
            const topicMatches = Boolean(topicId && String(topic?.id || "") === topicId);
            const outcome = (topic?.outcomes || topic?.objectives || []).find(
              (item: any) => outcomeId && String(item?.id || "") === outcomeId,
            );
            if (!unitName && (unitMatches || topicMatches || outcome)) unitName = String(unit?.name || "").trim();
            if (!topicName && (topicMatches || outcome)) topicName = String(topic?.name || "").trim();
            if (!outcomeName && outcome) outcomeName = String(outcome?.name || "").trim();
          }
        }
      };

      candidateTrees.forEach(fillFromTree);
      return { unitName, topicName, outcomeName };
    };

    const pageHeight = 297;
    const marginY = 15;
    const colWidth = 90;
    const pageBottom = pageHeight - marginY;
    const outputPages: BookletLayoutPage[] = [];

    const coverUrl = exam.bookletCovers?.[bookletKey];
    if (coverUrl) {
      try {
        const pdfCoverUrl = await toPdfImageDataUrl(coverUrl);
        await getImageDimensions(pdfCoverUrl);
        outputPages.push({
          testName: "",
          isTestStart: false,
          startY: 0,
          columns: [[], []],
          coverUrl: pdfCoverUrl,
        });
      } catch (error) {
        console.error(`Booklet ${bookletKey} cover loading error:`, error);
      }
    }

    // Branş/Ders Denemesi ve Ünite Denemesinde nihai soru numarası, soru seçilme
    // sırasına göre değil PDF'deki fiziksel okuma sırasına göre verilir:
    // 1. sayfa sol sütun -> sağ sütun -> 2. sayfa sol sütun -> sağ sütun ...
    // Ders değişse bile sayaç kaldığı yerden devam eder. Her kitapçık kendi
    // yerleşimi tamamlandıktan sonra aynı 1..N numara dizisini yeniden kurar.
    let bookletReadingOrderNumber = 1;

    // Yerleştirme algoritması çalışırken her sorunun benzersiz bir geçici numaraya
    // ihtiyacı vardır. Bu sayaç yalnız paketleme/kimlik amacıyla kullanılır; PDF'de
    // görünen nihai numara aşağıda yerleşim kesinleştikten sonra yeniden atanır.
    let unitScanDisplayNumber = 1;

    for (const test of exam.examStructure || []) {
      // TYT/AYT'de her testin soruları 1'den başlar; test içindeki dersler
      // sıra numarasını kaldığı yerden sürdürür.
      if (isTytQuestionManager) bookletReadingOrderNumber = 1;
      let displayNumber = isUnitScanExam ? unitScanDisplayNumber : 1;

      for (const subject of test.subjects || []) {
        if (!isUnitScanExam && questionNumberingMode === "restart-per-subject") displayNumber = 1;

        // Soru İşlemleri ekranında görünen canlı öğretmen seçimleri `questions`
        // birleşimindedir. PDF de aynı kaynağı kullanmalı; yalnız exam.questions
        // okunursa telefondan yeni gönderilen soruların müfredat bilgisi kaybolur.
        const questionsForSubject = questions?.[subject.name] || exam.questions?.[subject.name] || {};
        const requestedGap = exam.questionGaps?.[subject.name] ?? 4;
        const subjectItems: LayoutQuestion[] = [];
        const curriculumSummaryMap = new Map<string, BookletCurriculumSummaryItem>();
        const liveQuestionCount = Object.values(questionsForSubject).filter(
          (row: any) => Boolean(row?.imageUrl),
        ).length;
        const subjectCountForPdf = isUnitScanExam
          ? Math.max(Number(subject?.count || 0), liveQuestionCount)
          : Number(subject?.count || 0);

        const populatedSourceIndices = Object.keys(questionsForSubject || {})
          .map(Number)
          .filter((index) => Number.isFinite(index) && Boolean(questionsForSubject?.[index]?.imageUrl))
          .sort((a, b) => a - b);

        let rawSourceOrder: number[];
        if (exam.examSource === "Basılı Yayın") {
          rawSourceOrder = Array.from({ length: subjectCountForPdf }, (_, index) =>
            getPrintedQuestionIndex(exam, bookletKey, index + 1, subject.name, subjectCountForPdf),
          );
        } else if (isFlexibleCourseBasedExam && populatedSourceIndices.length > 0) {
          // Esnek sınavlarda soru slotları silme/geri alma işlemlerinden sonra seyrek
          // kalabilir (örn. 0,1,4,7). PDF artık 0..N-1 varsayımı yapmaz; gerçek dolu
          // slotların tamamını kitapçık permütasyonuna sokar. Böylece bir Gxx grubunun
          // son üyesi yüksek bir slotta kaldığı için PDF dışında kalamaz.
          const populatedCount = populatedSourceIndices.length;
          rawSourceOrder = Array.from({ length: populatedCount }, (_, index) => {
            const position = getQuestionIndexForBooklet(bookletKey, index, populatedCount);
            return populatedSourceIndices[position] ?? populatedSourceIndices[index];
          }).filter((index): index is number => Number.isFinite(index));
        } else {
          rawSourceOrder = Array.from({ length: subjectCountForPdf }, (_, index) =>
            getQuestionIndexForBooklet(bookletKey, index, subjectCountForPdf),
          );
        }

        const orderedSourceIndices = exam.examSource === "Basılı Yayın"
          ? rawSourceOrder
          : groupedQuestionSourceOrder(rawSourceOrder, questionsForSubject);

        const orderedSourceRows = orderedSourceIndices.map((sourceIndex) => ({
          sourceIndex,
          question: questionsForSubject[sourceIndex],
        }));
        const groupRowsById = new Map<string, Array<{ sourceIndex: number; question: any }>>();
        orderedSourceRows.forEach((row) => {
          const groupId = questionGroupIdOf(row.question);
          if (!groupId) return;
          const members = groupRowsById.get(groupId) || [];
          members.push(row);
          groupRowsById.set(groupId, members);
        });
        groupRowsById.forEach((rows) => {
          rows.sort((left, right) => questionGroupOrderOf(left.question) - questionGroupOrderOf(right.question) || left.sourceIndex - right.sourceIndex);
        });

        // Dosya adından oluşturulan gruplarda sabit olarak "1" aranmaz.
        // O gruptaki en küçük sıra değeri hangi dosyadaysa o dosya öncül/kaynak olur.
        const fileNameGroupLeaderSourceIndex = new Map<string, number>();
        groupRowsById.forEach((rows, groupId) => {
          const leaderIndex = legacyGroupLeaderSourceIndex(rows, groupId);
          if (leaderIndex !== undefined) fileNameGroupLeaderSourceIndex.set(groupId, leaderIndex);
        });

        const visibleGroupCounts = new Map<string, number>();
        groupRowsById.forEach((rows, groupId) => {
          const leaderSourceIndex = fileNameGroupLeaderSourceIndex.get(groupId);
          const printableCount = leaderSourceIndex === undefined
            ? rows.length
            : rows.filter((row) => row.sourceIndex !== leaderSourceIndex).length;
          visibleGroupCounts.set(groupId, Math.max(1, printableCount || rows.length || 1));
        });
        const renderedGroupInstructions = new Set<string>();
        const displayQuestionGroupOrder = (question: any, sourceIndex: number) => {
          const groupId = questionGroupIdOf(question);
          const rows = groupRowsById.get(groupId) || [];
          const leaderSourceIndex = fileNameGroupLeaderSourceIndex.get(groupId);
          if (leaderSourceIndex === undefined) return questionGroupOrderOf(question);
          const printableRows = rows.filter((row) => row.sourceIndex !== leaderSourceIndex);
          const position = printableRows.findIndex((row) => row.sourceIndex === sourceIndex);
          return position >= 0 ? position + 1 : 0;
        };

        const makeGroupInstruction = async (question: any) => {
          const groupId = questionGroupIdOf(question);
          if (!groupId || renderedGroupInstructions.has(groupId)) return null;
          renderedGroupInstructions.add(groupId);

          const title = questionGroupTitleOf(question);
          const text = questionGroupInstructionTextOf(question);
          const leaderSourceIndex = fileNameGroupLeaderSourceIndex.get(groupId);
          const leaderRow = leaderSourceIndex === undefined
            ? undefined
            : (groupRowsById.get(groupId) || []).find((row) => row.sourceIndex === leaderSourceIndex);
          const explicitInstructionImage = questionGroupInstructionImageOf(question);
          const rawInstructionImage = leaderRow
            ? String(leaderRow.question?.imageUrl || "")
            : explicitInstructionImage;
          // Dosya adından kurulan gruplarda öncül her zaman kendi sütunu genişliğinde gösterilir.
          // Elle tanımlanan veya yalnız METIN görseli kullanan eski grupların mevcut düzeni korunur.
          const layout = leaderRow ? "normal" : questionGroupLayoutOf(question);
          const isFullWidthSource = layout === "full-width-source";
          let imageUrl = "";
          let imageHeight = 0;
          if (rawInstructionImage) {
            try {
              imageUrl = await toPdfImageDataUrl(rawInstructionImage);
              const imageDimensions = await getImageDimensions(imageUrl);
              const imageWidth = isFullWidthSource ? 182 : (colWidth - 8);
              imageHeight = Math.min(isFullWidthSource ? 92 : 55, Math.max(8, imageWidth * (imageDimensions.height / imageDimensions.width)));
            } catch (error) {
              console.warn("Soru grubu yönerge görseli PDF'e hazırlanamadı:", error);
            }
          }
          const approximateTextLines = text
            ? Math.max(1, text.split(/\n/).reduce((sum: number, line: string) => sum + Math.max(1, Math.ceil(line.length / (isFullWidthSource ? 100 : 48))), 0))
            : 0;
          const height = 10 + (title ? 4 : 0) + approximateTextLines * 3.5 + (imageUrl ? imageHeight + 3 : 0) + 2;
          return {
            title,
            text,
            imageUrl,
            imageHeight,
            height,
            questionCount: Math.max(1, Number(visibleGroupCounts.get(groupId) || 1)),
            mode: questionGroupModeOf(question),
            layout,
          } as const;
        };

        for (let orderIndex = 0; orderIndex < orderedSourceRows.length; orderIndex++) {
          const { sourceIndex, question } = orderedSourceRows[orderIndex];
          const groupId = questionGroupIdOf(question);
          const leaderSourceIndex = groupId ? fileNameGroupLeaderSourceIndex.get(groupId) : undefined;
          if (leaderSourceIndex !== undefined && sourceIndex === leaderSourceIndex) continue;

          const groupInstruction = question ? await makeGroupInstruction(question) : null;
          const groupLayout = question ? (groupInstruction?.layout || questionGroupLayoutOf(question)) : "normal";
          const instructionHeight = groupLayout === "full-width-source"
            ? 0
            : Math.max(0, Number(groupInstruction?.height || 0));

          if (question?.imageUrl) {
            const curriculum = await resolvePdfQuestionCurriculum(question, subject.name);
            if (curriculum.unitName || curriculum.topicName || curriculum.outcomeName) {
              const summaryKey = [
                curriculum.unitName.toLocaleLowerCase("tr-TR"),
                curriculum.topicName.toLocaleLowerCase("tr-TR"),
                curriculum.outcomeName.toLocaleLowerCase("tr-TR"),
              ].join("|");
              const current = curriculumSummaryMap.get(summaryKey);
              curriculumSummaryMap.set(summaryKey, {
                unitName: curriculum.unitName,
                topicName: curriculum.topicName,
                outcomeName: curriculum.outcomeName,
                questionCount: Number(current?.questionCount || 0) + 1,
              });
            }

            try {
              const pdfImageUrl = await toPdfImageDataUrl(question.imageUrl);
              const dimensions = await getImageDimensions(pdfImageUrl);
              const questionImageHeight = (colWidth - 8) * (dimensions.height / dimensions.width);
              subjectItems.push({
                number: displayNumber++,
                imageUrl: pdfImageUrl,
                contentHeight: questionImageHeight + instructionHeight,
                questionImageHeight,
                requestedGap,
                placeholder: false,
                sourceIndex,
                subjectName: subject.name,
                answer: getQuestionCorrectAnswer(question, exam.examSource === "Sistem") || "-",
                questionGroupId: groupId || undefined,
                questionGroupLayout: groupId ? groupLayout : undefined,
                questionGroupOrder: groupId ? displayQuestionGroupOrder(question, sourceIndex) : undefined,
                questionGroupSize: groupId ? Number(visibleGroupCounts.get(groupId) || questionGroupSizeOf(question) || 1) : undefined,
                groupInstruction: groupInstruction || undefined,
              });
            } catch {
              const questionImageHeight = 20;
              subjectItems.push({
                number: displayNumber++,
                contentHeight: questionImageHeight + instructionHeight,
                questionImageHeight,
                requestedGap,
                placeholder: true,
                sourceIndex,
                subjectName: subject.name,
                answer: getQuestionCorrectAnswer(question, exam.examSource === "Sistem") || "-",
                questionGroupId: groupId || undefined,
                questionGroupLayout: groupId ? groupLayout : undefined,
                questionGroupOrder: groupId ? displayQuestionGroupOrder(question, sourceIndex) : undefined,
                questionGroupSize: groupId ? Number(visibleGroupCounts.get(groupId) || questionGroupSizeOf(question) || 1) : undefined,
                groupInstruction: groupInstruction || undefined,
              });
            }
          } else {
            const questionImageHeight = 20;
            subjectItems.push({
              number: displayNumber++,
              contentHeight: questionImageHeight + instructionHeight,
              questionImageHeight,
              requestedGap,
              placeholder: true,
              sourceIndex,
              subjectName: subject.name,
              answer: getQuestionCorrectAnswer(question, exam.examSource === "Sistem") || "-",
              questionGroupId: groupId || undefined,
              questionGroupLayout: groupId ? groupLayout : undefined,
              questionGroupOrder: groupId ? displayQuestionGroupOrder(question, sourceIndex) : undefined,
              questionGroupSize: groupId ? Number(visibleGroupCounts.get(groupId) || questionGroupSizeOf(question) || 1) : undefined,
              groupInstruction: groupInstruction || undefined,
            });
          }
        }

        if (isUnitScanExam) unitScanDisplayNumber = displayNumber;

        let subjectHeaderUrl = "";
        try {
          subjectHeaderUrl = await getStoredExamHeaderDesign(
            subject.name || test.testName,
            normalizeGradeLevel(exam?.gradeLevel),
          );
        } catch (error) {
          console.warn(`${subject.name || test.testName} ünite denemesi başlığı yüklenemedi:`, error);
        }

        const curriculumSummary = Array.from(curriculumSummaryMap.values());
        const subjectFirstPageStartY = subjectHeaderUrl ? 105 : 34;

        // Branş/Ders Denemesi ve Ünite Denemesinde soru sırası yerleşimin ölçütü değildir.
        // Her ders kendi başlığının altında bağımsız kalır; o derse ait bütün soruların
        // gerçek yükseklikleri + kullanıcı tarafından verilen soru aralığı birlikte
        // değerlendirilir. Birden fazla paketleme stratejisi denenir ve en az sayfa,
        // en fazla erken-sayfa doluluğu ve en dengeli sütun kullanımını veren yerleşim seçilir.
        // Yerleşim kesinleşince görünür soru numaraları fiziksel okuma sırasına göre
        // yeniden verilir; böylece sütun içinde 1'er artar ve sayfa değişince devam eder.
        const buildEconomicalSubjectPages = (items: LayoutQuestion[]): PlannedPage[] => {
          const firstCapacity = Math.max(1, pageBottom - subjectFirstPageStartY);
          const regularStartY = marginY + 3;
          const regularCapacity = Math.max(1, pageBottom - regularStartY);
          const bookletSeed = String(bookletKey || "A")
            .toLocaleUpperCase("tr-TR")
            .split("")
            .reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 17), 0);

          const safeHeight = (item: LayoutQuestion) => Math.max(0.1, Number(item?.contentHeight || 0));
          const safeGap = (item: LayoutQuestion) => Math.max(0, Number(item?.requestedGap || 0));
          const footprint = (item: LayoutQuestion) => safeHeight(item) + safeGap(item);
          const columnCapacity = (columnIndex: number) => columnIndex < 2 ? firstCapacity : regularCapacity;

          // Yerleştirme hesabında HER soru, kendi gerçek yüksekliği + kullanıcı tarafından
          // "Her sorudan sonra boş kalacak alan" olarak belirlenen mesafe kadar yer kaplar.
          // Son sorunun boşluğu da hesaba dahildir; böylece paketleme ve PDF çizimi aynı ölçüyü kullanır.
          const columnUsedHeight = (column: LayoutQuestion[]) =>
            column.reduce((sum, item) => sum + footprint(item), 0);
          const appendUsedHeight = (column: LayoutQuestion[], item: LayoutQuestion) =>
            columnUsedHeight(column) + footprint(item);
          const fitsColumn = (column: LayoutQuestion[], item: LayoutQuestion, capacity: number) => {
            const nextUsed = appendUsedHeight(column, item);
            // Normal bir sütundan daha uzun tek soru kaybolmasın; boş sütuna tek başına konabilir.
            // Taşma aday puanında cezalandırılır.
            return nextUsed <= capacity + 0.01 || (column.length === 0 && footprint(item) > regularCapacity);
          };
          const hashFor = (item: LayoutQuestion, salt: number) => {
            let value = ((Number(item.number || 0) + 1) * 2654435761 + (bookletSeed + salt * 1013904223)) >>> 0;
            value ^= value >>> 16;
            value = Math.imul(value, 2246822519) >>> 0;
            value ^= value >>> 13;
            return value >>> 0;
          };

          type PackedCandidate = {
            bins: LayoutQuestion[][];
            pages: number;
            overflow: number;
            weightedPageIndex: number;
            emptySquare: number;
            maxEmpty: number;
            signature: string;
          };

          const trimBins = (rawBins: LayoutQuestion[][]) => {
            const bins = rawBins.map((column) => [...column]);
            let last = bins.length - 1;
            while (last >= 0 && bins[last].length === 0) last -= 1;
            const needed = Math.max(2, Math.ceil((last + 1) / 2) * 2);
            while (bins.length < needed) bins.push([]);
            return bins.slice(0, needed);
          };

          const compactEarlier = (rawBins: LayoutQuestion[][]) => {
            const bins = rawBins.map((column) => [...column]);
            // Son sütunlardan başlayarak bütün soruları mümkün olan en erken sütuna taşı.
            // Bu adım özellikle ilk sayfada başlık nedeniyle daha kısa olan sütunlarla sonraki
            // tam boy sütunlar arasındaki gereksiz boşlukları azaltır.
            let changed = true;
            let guard = 0;
            while (changed && guard++ < 8) {
              changed = false;
              for (let from = bins.length - 1; from >= 0; from -= 1) {
                for (let itemIndex = bins[from].length - 1; itemIndex >= 0; itemIndex -= 1) {
                  const item = bins[from][itemIndex];
                  let bestTarget = -1;
                  let bestRemaining = Number.POSITIVE_INFINITY;
                  for (let to = 0; to < from; to += 1) {
                    const capacity = columnCapacity(to);
                    if (!fitsColumn(bins[to], item, capacity)) continue;
                    const remaining = Math.max(0, capacity - appendUsedHeight(bins[to], item));
                    if (remaining < bestRemaining - 0.01) {
                      bestRemaining = remaining;
                      bestTarget = to;
                    }
                  }
                  if (bestTarget >= 0) {
                    bins[from].splice(itemIndex, 1);
                    bins[bestTarget].push(item);
                    changed = true;
                  }
                }
              }
            }
            return trimBins(bins);
          };

          const scoreCandidate = (rawBins: LayoutQuestion[][]): PackedCandidate => {
            const bins = trimBins(rawBins);
            const pages = Math.max(1, Math.ceil(bins.length / 2));
            let overflow = 0;
            let weightedPageIndex = 0;
            let emptySquare = 0;
            let maxEmpty = 0;

            bins.forEach((column, columnIndex) => {
              const capacity = columnCapacity(columnIndex);
              const used = columnUsedHeight(column);
              overflow += Math.max(0, used - capacity);
              const empty = Math.max(0, capacity - used);
              emptySquare += empty * empty;
              maxEmpty = Math.max(maxEmpty, empty);
              weightedPageIndex += Math.floor(columnIndex / 2) * column.length;
            });

            return {
              bins,
              pages,
              overflow,
              weightedPageIndex,
              emptySquare,
              maxEmpty,
              signature: bins.map((column) => column.map((item) => item.number).join(",")).join("|"),
            };
          };

          const orderVariants: LayoutQuestion[][] = [];
          const byHeightDesc = [...items].sort((a, b) =>
            footprint(b) - footprint(a) || hashFor(a, 1) - hashFor(b, 1));
          const byHeightAsc = [...items].sort((a, b) =>
            footprint(a) - footprint(b) || hashFor(a, 2) - hashFor(b, 2));
          const byFootprintDesc = [...items].sort((a, b) =>
            (safeHeight(b) + safeGap(b)) - (safeHeight(a) + safeGap(a)) || hashFor(a, 3) - hashFor(b, 3));
          const seeded = [...items].sort((a, b) => hashFor(a, 4) - hashFor(b, 4));
          const original = [...items];
          const reversed = [...items].reverse();

          const zigzag: LayoutQuestion[] = [];
          let low = 0;
          let high = byHeightDesc.length - 1;
          while (low <= high) {
            zigzag.push(byHeightDesc[low++]);
            if (low <= high) zigzag.push(byHeightDesc[high--]);
          }

          orderVariants.push(byHeightDesc, byHeightAsc, byFootprintDesc, zigzag, seeded, original, reversed);

          // Aynı verim düzeyinde farklı kitapçıklarda farklı fiziksel konumlar oluşması için
          // yükseklik sıralamasını bozmadan küçük deterministik bant varyasyonları üret.
          for (let variant = 0; variant < 5; variant += 1) {
            const banded = [...byHeightDesc];
            const bandSize = 3 + ((bookletSeed + variant) % 4);
            for (let start = 0; start < banded.length; start += bandSize) {
              const band = banded.slice(start, start + bandSize)
                .sort((a, b) => hashFor(a, 20 + variant + start) - hashFor(b, 20 + variant + start));
              banded.splice(start, band.length, ...band);
            }
            orderVariants.push(banded);
          }

          const placementModes = ["best", "early", "balanced", "seeded"] as const;
          const candidateMap = new Map<string, PackedCandidate>();

          const packWith = (ordered: LayoutQuestion[], mode: typeof placementModes[number], salt: number) => {
            const bins: LayoutQuestion[][] = [[], []];

            ordered.forEach((item) => {
              const fitting: Array<{ index: number; remaining: number; used: number }> = [];
              bins.forEach((column, index) => {
                const capacity = columnCapacity(index);
                if (!fitsColumn(column, item, capacity)) return;
                const nextUsed = appendUsedHeight(column, item);
                fitting.push({ index, remaining: Math.max(0, capacity - nextUsed), used: nextUsed });
              });

              if (!fitting.length) {
                bins.push([], []);
                const newIndex = bins.length - 2;
                bins[newIndex].push(item);
                return;
              }

              let chosen = fitting[0];
              if (mode === "best") {
                chosen = fitting.sort((a, b) => a.remaining - b.remaining || a.index - b.index)[0];
              } else if (mode === "early") {
                chosen = fitting.sort((a, b) =>
                  Math.floor(a.index / 2) - Math.floor(b.index / 2) || a.remaining - b.remaining || a.index - b.index)[0];
              } else if (mode === "balanced") {
                chosen = fitting.sort((a, b) => {
                  const aPair = a.index % 2 === 0 ? a.index + 1 : a.index - 1;
                  const bPair = b.index % 2 === 0 ? b.index + 1 : b.index - 1;
                  const aPairUsed = aPair < bins.length ? columnUsedHeight(bins[aPair]) : 0;
                  const bPairUsed = bPair < bins.length ? columnUsedHeight(bins[bPair]) : 0;
                  const aBalance = Math.abs(a.used - aPairUsed);
                  const bBalance = Math.abs(b.used - bPairUsed);
                  return aBalance - bBalance || a.remaining - b.remaining || a.index - b.index;
                })[0];
              } else {
                chosen = fitting.sort((a, b) => {
                  const aNoise = (hashFor(item, salt + a.index) % 1000) / 1000;
                  const bNoise = (hashFor(item, salt + b.index) % 1000) / 1000;
                  // Verimi koru: önce kalan alan, ancak 8 mm içinde kalan eşdeğer
                  // seçeneklerde kitapçığa özgü deterministik dağılımı kullan.
                  const aBand = Math.floor(a.remaining / 8);
                  const bBand = Math.floor(b.remaining / 8);
                  return aBand - bBand || aNoise - bNoise || a.remaining - b.remaining;
                })[0];
              }

              bins[chosen.index].push(item);
            });

            const compacted = compactEarlier(bins);
            const candidate = scoreCandidate(compacted);
            if (!candidateMap.has(candidate.signature)) candidateMap.set(candidate.signature, candidate);
          };

          orderVariants.forEach((ordered, orderIndex) => {
            placementModes.forEach((mode, modeIndex) => packWith(ordered, mode, 100 + orderIndex * 17 + modeIndex * 31));
          });

          // Küçük/orta soru gruplarında iki sütunluk sayfa için sınırlı kombinasyon araması.
          // Her adımda en dolu iki sütunu arayan beam yaklaşımı, klasik best-fit'in kaçırdığı
          // kombinasyonları yakalar; arama sınırı UI'nin kilitlenmesini önler.
          if (items.length > 2 && items.length <= 36) {
            type BeamState = { left: LayoutQuestion[]; right: LayoutQuestion[]; rest: LayoutQuestion[]; score: number };
            const choosePage = (remaining: LayoutQuestion[], leftCap: number, rightCap: number, salt: number) => {
              let states: BeamState[] = [{ left: [], right: [], rest: [], score: 0 }];
              const ordered = [...remaining].sort((a, b) => footprint(b) - footprint(a) || hashFor(a, salt) - hashFor(b, salt));
              const beamWidth = remaining.length <= 20 ? 1200 : 450;

              ordered.forEach((item) => {
                const next: BeamState[] = [];
                states.forEach((state) => {
                  next.push({ ...state, rest: [...state.rest, item] });
                  if (fitsColumn(state.left, item, leftCap)) {
                    next.push({ ...state, left: [...state.left, item] });
                  }
                  if (fitsColumn(state.right, item, rightCap)) {
                    next.push({ ...state, right: [...state.right, item] });
                  }
                });

                const scored = next.map((state) => {
                  const leftUsed = columnUsedHeight(state.left);
                  const rightUsed = columnUsedHeight(state.right);
                  const count = state.left.length + state.right.length;
                  const fill = leftUsed + rightUsed;
                  const balance = Math.abs((leftCap - leftUsed) - (rightCap - rightUsed));
                  const diversity = ((hashFor(item, salt + count + state.left.length * 7) % 997) / 997) * 0.01;
                  return { ...state, score: -(count * 100000 + fill * 100) + balance + diversity };
                });
                scored.sort((a, b) => a.score - b.score);

                const unique = new Map<string, BeamState>();
                for (const state of scored) {
                  const key = `${state.left.map((x) => x.number).sort((a,b)=>a-b).join(",")}|${state.right.map((x) => x.number).sort((a,b)=>a-b).join(",")}`;
                  if (!unique.has(key)) unique.set(key, state);
                  if (unique.size >= beamWidth) break;
                }
                states = Array.from(unique.values());
              });

              states.sort((a, b) => {
                const aCount = a.left.length + a.right.length;
                const bCount = b.left.length + b.right.length;
                if (aCount !== bCount) return bCount - aCount;
                const aUsed = columnUsedHeight(a.left) + columnUsedHeight(a.right);
                const bUsed = columnUsedHeight(b.left) + columnUsedHeight(b.right);
                if (Math.abs(aUsed - bUsed) > 0.01) return bUsed - aUsed;
                const aBalance = Math.abs((leftCap - columnUsedHeight(a.left)) - (rightCap - columnUsedHeight(a.right)));
                const bBalance = Math.abs((leftCap - columnUsedHeight(b.left)) - (rightCap - columnUsedHeight(b.right)));
                return aBalance - bBalance;
              });
              return states[0];
            };

            for (let beamVariant = 0; beamVariant < 3; beamVariant += 1) {
              let remaining = [...items];
              const bins: LayoutQuestion[][] = [];
              let page = 0;
              while (remaining.length && page < 100) {
                const cap = page === 0 ? firstCapacity : regularCapacity;
                const selected = choosePage(remaining, cap, cap, 500 + beamVariant * 73 + page * 19);
                const chosenNumbers = new Set([
                  ...selected.left.map((item) => item.number),
                  ...selected.right.map((item) => item.number),
                ]);

                if (!chosenNumbers.size) {
                  // Başlıklı ilk sayfanın kısa sütunlarına sığmayan ama normal sayfaya
                  // sığabilecek soruyu taşırma; ilk sayfayı yalnız başlıkla bırakıp tam boy
                  // sütuna geçir. Normal sütuna da sığmayan tek soru varsa ilerlemeyi garanti
                  // etmek için o soruyu tek başına yerleştir.
                  const canFitRegular = remaining.some((item) => footprint(item) <= regularCapacity + 0.01);
                  if (page === 0 && canFitRegular) {
                    bins.push([], []);
                  } else {
                    bins.push([remaining[0]], []);
                    remaining = remaining.slice(1);
                  }
                } else {
                  bins.push(selected.left, selected.right);
                  remaining = remaining.filter((item) => !chosenNumbers.has(item.number));
                }
                page += 1;
              }
              const compacted = compactEarlier(bins);
              const candidate = scoreCandidate(compacted);
              if (!candidateMap.has(candidate.signature)) candidateMap.set(candidate.signature, candidate);
            }
          }

          const candidates = Array.from(candidateMap.values());
          if (!candidates.length) {
            return [{ startY: subjectFirstPageStartY, columns: [items, []] }];
          }

          candidates.sort((a, b) =>
            a.overflow - b.overflow ||
            a.pages - b.pages ||
            a.weightedPageIndex - b.weightedPageIndex ||
            a.maxEmpty - b.maxEmpty ||
            a.emptySquare - b.emptySquare ||
            a.signature.localeCompare(b.signature));

          const best = candidates[0];
          // Kaliteden ödün vermeden kitapçıklar arasında farklı bir iyi çözüm seç.
          // Sayfa sayısı ve taşma aynı, erken sayfa doluluğu en iyi değerden en fazla 1 sapmış,
          // maksimum boşluğu da 8 mm'den fazla kötüleşmemiş adaylar eşdeğer kabul edilir.
          const equivalent = candidates.filter((candidate) =>
            Math.abs(candidate.overflow - best.overflow) < 0.01 &&
            candidate.pages === best.pages &&
            candidate.weightedPageIndex <= best.weightedPageIndex + 1 &&
            candidate.maxEmpty <= best.maxEmpty + 8);
          const selected = equivalent.length
            ? equivalent[bookletSeed % Math.min(equivalent.length, 6)]
            : best;

          // Aynı ekonomik yerleşimin A/B/C/D kitapçıklarında da birebir aynı görünmesini
          // engelle. Bir sütunun toplam yüksekliği soru sırasından etkilenmediği için bu
          // yeniden sıralama verimi bozmaz; yalnız fiziksel soru yerlerini değiştirir.
          const variedBins = selected.bins.map((column, columnIndex) => {
            if (column.length <= 1) return [...column];
            return [...column].sort((a, b) =>
              hashFor(a, 900 + columnIndex * 37) - hashFor(b, 900 + columnIndex * 37));
          });

          // Eşit kapasiteli sağ/sol sütunları da bazı kitapçık ve sayfalarda yer değiştirerek
          // aynı sorunun başka kitapçıkta aynı fiziksel konuma düşme olasılığını azalt.
          for (let pageIndex = 0; pageIndex < selected.pages; pageIndex += 1) {
            const leftIndex = pageIndex * 2;
            const rightIndex = leftIndex + 1;
            if (((bookletSeed + pageIndex) % 2) === 1 && variedBins[rightIndex]?.length) {
              const tmp = variedBins[leftIndex];
              variedBins[leftIndex] = variedBins[rightIndex];
              variedBins[rightIndex] = tmp;
            }
          }

          // Sütun yerleşimi kesinleştikten sonra sütunun sonunda kalan kullanılabilir alanı
          // o sütundaki soru sayısına eşit böl. Her pay, kullanıcının belirlediği boşluğa eklenir.
          // Böylece sayfa sayısı artmadan sütunlar alt sınıra kadar dengeli ve düzenli görünür.
          const spreadRemainingSpace = (column: LayoutQuestion[], capacity: number): LayoutQuestion[] => {
            if (!column.length) return [];
            const used = columnUsedHeight(column);
            const leftover = Math.max(0, capacity - used);
            if (leftover <= 0.01) return column.map((item) => ({ ...item }));
            const extraPerQuestion = leftover / column.length;
            return column.map((item) => ({
              ...item,
              requestedGap: safeGap(item) + extraPerQuestion,
            }));
          };

          const subjectPages: PlannedPage[] = [];
          for (let pageIndex = 0; pageIndex < selected.pages; pageIndex += 1) {
            const startY = pageIndex === 0 ? subjectFirstPageStartY : regularStartY;
            const capacity = pageBottom - startY;
            subjectPages.push({
              startY,
              columns: [
                spreadRemainingSpace(variedBins[pageIndex * 2] || [], capacity),
                spreadRemainingSpace(variedBins[pageIndex * 2 + 1] || [], capacity),
              ],
            });
          }
          return subjectPages;
        };

        let subjectPages: PlannedPage[];
        const subjectHasQuestionGroups = subjectItems.some((item: any) => Boolean(item?.questionGroupId));
        if (isFlexibleCourseBasedExam && !subjectHasQuestionGroups) {
          subjectPages = buildEconomicalSubjectPages(subjectItems);
        } else {
          // Yönerge grubu olan derslerde grup bütünlüğünü korumak için sıralı yerleşim
          // kullanılır. Böylece yönerge + bağlı sorular sütun/sayfa değişse bile peş peşe kalır.
          // Grup olmayan diğer sınav türlerinin mevcut sıra/yerleşim davranışına dokunma.
          subjectPages = [{ startY: subjectFirstPageStartY, columns: [[], []] }];
          let pageIndex = 0;
          let columnIndex = 0;
          let usedHeight = 0;

          const pushFreshPage = () => {
            subjectPages.push({ startY: marginY + 3, columns: [[], []] });
            pageIndex += 1;
            columnIndex = 0;
            usedHeight = 0;
          };

          const advanceColumn = () => {
            columnIndex += 1;
            usedHeight = 0;
            if (columnIndex > 1) pushFreshPage();
          };

          const pageHasQuestions = (page: PlannedPage) => page.columns[0].length > 0 || page.columns[1].length > 0;

          let itemIndex = 0;
          while (itemIndex < subjectItems.length) {
            const item = subjectItems[itemIndex];
            const groupId = String((item as any)?.questionGroupId || "").trim();
            const chunk: LayoutQuestion[] = [];
            if (groupId) {
              let cursor = itemIndex;
              while (cursor < subjectItems.length && String((subjectItems[cursor] as any)?.questionGroupId || "").trim() === groupId) {
                chunk.push(subjectItems[cursor]);
                cursor += 1;
              }
            } else {
              chunk.push(item);
            }

            const groupLayout = groupId ? String((chunk[0] as any)?.questionGroupLayout || "normal") : "normal";
            const fullWidthSource = groupLayout === "full-width-source";

            if (fullWidthSource) {
              // İki sütun genişliğindeki ortak kaynak hiçbir zaman önceki soruların yanına sıkıştırılmaz.
              // Sayfadaki iki sütun da boş değilse grup yeni sayfadan başlar. Böylece kaynak üstte,
              // ona bağlı sorular ise kaynağın hemen altında iki sütun halinde okunur.
              if (pageHasQuestions(subjectPages[pageIndex]) || columnIndex !== 0 || usedHeight > 0) {
                pushFreshPage();
              }

              const firstItem = chunk[0] as any;
              const instruction = firstItem?.groupInstruction;
              const instructionHeight = Math.max(0, Number(instruction?.height || 0));
              if (instruction) {
                const page = subjectPages[pageIndex] as any;
                const instructionY = page.startY;
                page.fullWidthInstructionY = instructionY;
                page.fullWidthGroupInstruction = {
                  ...instruction,
                  groupId,
                };
                // Her iki fiziksel sütun ortak kaynağın altından başlar.
                page.startY = instructionY + instructionHeight + 3;
              }
              columnIndex = 0;
              usedHeight = 0;

              for (const chunkItem of chunk) {
                while (true) {
                  const page = subjectPages[pageIndex];
                  const capacity = pageBottom - page.startY;
                  const remainingHeight = capacity - usedHeight;
                  const neededHeight = chunkItem.contentHeight + chunkItem.requestedGap;
                  if (neededHeight <= remainingHeight || page.columns[columnIndex].length === 0) {
                    page.columns[columnIndex].push(chunkItem);
                    usedHeight += neededHeight;
                    break;
                  }
                  advanceColumn();
                }
              }
              itemIndex += chunk.length;
              continue;
            }

            const currentPage = subjectPages[pageIndex];
            const currentCapacity = pageBottom - currentPage.startY;
            const chunkHeight = chunk.reduce((sum, row) => sum + row.contentHeight + row.requestedGap, 0);
            const canFitAsOneBlock = groupId && chunk.length > 1 && chunkHeight <= currentCapacity + 0.01;

            // Normal yönerge gruplarında mevcut tek-sütun blok davranışı korunur.
            if (canFitAsOneBlock && currentPage.columns[columnIndex].length > 0 && chunkHeight > currentCapacity - usedHeight + 0.01) {
              advanceColumn();
            } else if (groupId && chunk.length > 1 && chunkHeight > currentCapacity + 0.01 && currentPage.columns[columnIndex].length > 0) {
              advanceColumn();
            }

            for (const chunkItem of chunk) {
              while (true) {
                const page = subjectPages[pageIndex];
                const capacity = pageBottom - page.startY;
                const remainingHeight = capacity - usedHeight;
                const neededHeight = chunkItem.contentHeight + chunkItem.requestedGap;

                if (neededHeight <= remainingHeight || page.columns[columnIndex].length === 0) {
                  page.columns[columnIndex].push(chunkItem);
                  usedHeight += neededHeight;
                  break;
                }
                advanceColumn();
              }
            }
            itemIndex += chunk.length;
          }
        }

        // Ekonomik yerleşim bittikten SONRA numaralandır. Seçilme/kazanım sırası veya
        // paketleme sırasında kullanılan geçici numara PDF'deki soru numarasını belirlemez.
        // Her kitapçıkta:
        //   1) ilk sayfanın sol sütunu yukarıdan aşağı,
        //   2) aynı sayfanın sağ sütunu yukarıdan aşağı,
        //   3) sonraki sayfanın sol ve sağ sütunları aynı sırayla
        // okunur ve numara her soruda tam 1 artar. Ders değişirse sayaç sıfırlanmaz.
        if (isFlexibleCourseBasedExam) {
          subjectPages.forEach((page) => {
            for (const columnIndex of [0, 1] as const) {
              page.columns[columnIndex].forEach((item) => {
                item.number = bookletReadingOrderNumber++;
              });
            }
          });
        }

        subjectPages.forEach((page, index) => {
          outputPages.push({
            ...page,
            testName: subject.name || test.testName,
            isTestStart: index === 0,
            headerUrl: index === 0 ? subjectHeaderUrl : "",
            curriculumSummary: index === 0 ? curriculumSummary : [],
          });
        });
      }
    }

    return {
      examName: replaceLegacyExamTerminology(exam.examName),
      publisherName: exam.publisherName,
      bookletKey,
      pages: outputPages,
    };
  };

  const bookletKeysForPlacement = exam.bookletType
    ? exam.bookletType.split("-").map((value: string) => value.trim()).filter(Boolean)
    : ["A"];

  // Yerleşim; soru listesi, cevaplar, ders/soru sayıları ve kullanıcının verdiği soru-sonrası
  // boşluk değiştiği anda geçersiz sayılır. Görselin tamamını imzaya koymuyoruz;
  // soru kimliği + görsel uzunluğu + doğru cevap değişikliği güvenli biçimde yakalamaya yeterlidir.
  const currentPlacementSignature = JSON.stringify({
    bookletType: exam.bookletType || "A",
    gaps: exam.questionGaps || {},
    structure: (exam.examStructure || []).map((test: any) => ({
      testName: test?.testName || "",
      subjects: (test?.subjects || []).map((subj: any) => {
        const source = questions?.[subj.name] || exam.questions?.[subj.name] || {};
        const questionSignature = Object.keys(source || {})
          .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
          .map((key) => {
            const q: any = source?.[key] || {};
            const id = q?.systemQuestionId || q?.questionId || q?.question_id || q?.id || q?.fileName || "";
            const answer = getQuestionCorrectAnswer(q, exam.examSource === "Sistem") || "-";
            const groupId = questionGroupIdOf(q);
            if (!groupId) {
              return `${key}:${String(id)}:${String(q?.imageUrl || "").length}:${answer}`;
            }
            const groupOrder = questionGroupOrderOf(q);
            const groupSize = questionGroupSizeOf(q);
            const fileName = String(q?.fileName || q?.file_name || "");
            return `${key}:${String(id)}:${String(q?.imageUrl || "").length}:${answer}:GROUP:${groupId}:${groupOrder}:${groupSize}:${fileName}`;
          });
        return { name: subj?.name || "", count: Number(subj?.count || 0), questionSignature };
      }),
    })),
  });

  const packBookletLayoutLock = (
    inputs: Record<string, BookletPdfInput>,
    sourceSignature: string,
  ) => {
    const assets: Record<string, string> = {};
    const assetKeys = new Map<string, string>();

    const storeAsset = (value: unknown) => {
      const source = String(value || "");
      if (!source) return "";
      const existing = assetKeys.get(source);
      if (existing) return existing;
      const key = `asset_${assetKeys.size + 1}`;
      assetKeys.set(source, key);
      assets[key] = source;
      return key;
    };

    const booklets: Record<string, any> = {};
    Object.entries(inputs || {}).forEach(([rawKey, input]) => {
      const key = String(rawKey || input?.bookletKey || "A").trim().toUpperCase();
      booklets[key] = {
        examName: input?.examName || "",
        publisherName: input?.publisherName || "",
        bookletKey: key,
        pages: (input?.pages || []).map((page: any) => ({
          testName: page?.testName || "",
          isTestStart: Boolean(page?.isTestStart),
          startY: Number(page?.startY || 0),
          blank: Boolean(page?.blank),
          coverAsset: storeAsset(page?.coverUrl),
          headerAsset: storeAsset(page?.headerUrl),
          curriculumSummary: Array.isArray(page?.curriculumSummary)
            ? page.curriculumSummary.map((item: any) => ({ ...item }))
            : [],
          fullWidthInstructionY: Number.isFinite(Number(page?.fullWidthInstructionY))
            ? Number(page.fullWidthInstructionY)
            : undefined,
          fullWidthGroupInstruction: page?.fullWidthGroupInstruction
            ? {
                groupId: String(page.fullWidthGroupInstruction?.groupId || ""),
                title: String(page.fullWidthGroupInstruction?.title || ""),
                text: String(page.fullWidthGroupInstruction?.text || ""),
                imageAsset: storeAsset(page.fullWidthGroupInstruction?.imageUrl),
                imageHeight: Number(page.fullWidthGroupInstruction?.imageHeight || 0),
                height: Number(page.fullWidthGroupInstruction?.height || 0),
                questionCount: Number(page.fullWidthGroupInstruction?.questionCount || 0),
                mode: page.fullWidthGroupInstruction?.mode,
                layout: page.fullWidthGroupInstruction?.layout,
              }
            : undefined,
          columns: ([0, 1] as const).map((columnIndex) =>
            (page?.columns?.[columnIndex] || []).map((item: any) => ({
              number: Number(item?.number || 0),
              contentHeight: Number(item?.contentHeight || 0),
              questionImageHeight: Number(item?.questionImageHeight || 0),
              requestedGap: Math.max(0, Number(item?.requestedGap || 0)),
              placeholder: Boolean(item?.placeholder),
              answer: normalizeAnswerValue(item?.answer) || "-",
              sourceIndex: Number.isInteger(Number(item?.sourceIndex)) && Number(item?.sourceIndex) >= 0
                ? Number(item.sourceIndex)
                : undefined,
              questionGroupId: String(item?.questionGroupId || "") || undefined,
              questionGroupLayout: item?.questionGroupLayout || undefined,
              questionGroupOrder: Number.isFinite(Number(item?.questionGroupOrder))
                ? Number(item.questionGroupOrder)
                : undefined,
              questionGroupSize: Number.isFinite(Number(item?.questionGroupSize))
                ? Number(item.questionGroupSize)
                : undefined,
              groupInstruction: item?.groupInstruction
                ? {
                    title: String(item.groupInstruction?.title || ""),
                    text: String(item.groupInstruction?.text || ""),
                    imageAsset: storeAsset(item.groupInstruction?.imageUrl),
                    imageHeight: Number(item.groupInstruction?.imageHeight || 0),
                    height: Number(item.groupInstruction?.height || 0),
                    questionCount: Number(item.groupInstruction?.questionCount || 0),
                    mode: item.groupInstruction?.mode,
                    layout: item.groupInstruction?.layout,
                  }
                : undefined,
              imageAsset: storeAsset(item?.imageUrl),
            })),
          ),
        })),
      };
    });

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      bookletType: String(exam?.bookletType || "A").trim().toUpperCase(),
      sourceSignature,
      questionsLocked: Boolean(exam?.bookletLayoutLock?.questionsLocked),
      questionsLockedAt: exam?.bookletLayoutLock?.questionsLockedAt || null,
      assets,
      booklets,
    };
  };

  const unpackBookletLayoutLock = (lock: any): Record<string, BookletPdfInput> | null => {
    if (!lock || Number(lock?.version || 0) !== 1 || !lock?.booklets || typeof lock.booklets !== "object") {
      return null;
    }

    const assets = lock?.assets && typeof lock.assets === "object" ? lock.assets : {};
    const readAsset = (key: unknown) => {
      const assetKey = String(key || "");
      return assetKey ? String(assets?.[assetKey] || "") : "";
    };

    const restored: Record<string, BookletPdfInput> = {};
    Object.entries(lock.booklets).forEach(([rawKey, rawInput]: [string, any]) => {
      const key = String(rawKey || rawInput?.bookletKey || "A").trim().toUpperCase();
      restored[key] = {
        examName: String(rawInput?.examName || ""),
        publisherName: String(rawInput?.publisherName || ""),
        bookletKey: key,
        pages: (Array.isArray(rawInput?.pages) ? rawInput.pages : []).map((page: any) => {
          const rawColumns = Array.isArray(page?.columns) ? page.columns : [[], []];
          const hydrateInstruction = (rawInstruction: any) => {
            if (!rawInstruction) return undefined;
            const instructionImageUrl = readAsset(rawInstruction?.imageAsset);
            return {
              title: String(rawInstruction?.title || ""),
              text: String(rawInstruction?.text || ""),
              ...(instructionImageUrl ? { imageUrl: instructionImageUrl } : {}),
              imageHeight: Number(rawInstruction?.imageHeight || 0),
              height: Number(rawInstruction?.height || 0),
              questionCount: Number(rawInstruction?.questionCount || 0),
              mode: rawInstruction?.mode,
              layout: rawInstruction?.layout,
            };
          };
          const hydrateColumn = (rows: any[]) =>
            (Array.isArray(rows) ? rows : []).map((item: any) => {
              const imageUrl = readAsset(item?.imageAsset);
              const groupInstruction = hydrateInstruction(item?.groupInstruction);
              return {
                number: Number(item?.number || 0),
                ...(imageUrl ? { imageUrl } : {}),
                contentHeight: Number(item?.contentHeight || 0),
                questionImageHeight: Number(item?.questionImageHeight || 0) || undefined,
                requestedGap: Math.max(0, Number(item?.requestedGap || 0)),
                placeholder: Boolean(item?.placeholder),
                answer: normalizeAnswerValue(item?.answer) || undefined,
                ...(String(item?.questionGroupId || "").trim() ? { questionGroupId: String(item.questionGroupId) } : {}),
                ...(item?.questionGroupLayout ? { questionGroupLayout: item.questionGroupLayout } : {}),
                ...(Number.isFinite(Number(item?.questionGroupOrder)) ? { questionGroupOrder: Number(item.questionGroupOrder) } : {}),
                ...(Number.isFinite(Number(item?.questionGroupSize)) ? { questionGroupSize: Number(item.questionGroupSize) } : {}),
                ...(groupInstruction ? { groupInstruction } : {}),
              };
            });

          const coverUrl = readAsset(page?.coverAsset);
          const headerUrl = readAsset(page?.headerAsset);
          const fullWidthGroupInstruction = hydrateInstruction(page?.fullWidthGroupInstruction);
          return {
            testName: String(page?.testName || ""),
            isTestStart: Boolean(page?.isTestStart),
            startY: Number(page?.startY || 0),
            columns: [
              hydrateColumn(rawColumns[0]),
              hydrateColumn(rawColumns[1]),
            ] as [BookletLayoutQuestion[], BookletLayoutQuestion[]],
            ...(page?.blank ? { blank: true } : {}),
            ...(coverUrl ? { coverUrl } : {}),
            ...(headerUrl ? { headerUrl } : {}),
            ...(Number.isFinite(Number(page?.fullWidthInstructionY)) ? { fullWidthInstructionY: Number(page.fullWidthInstructionY) } : {}),
            ...(fullWidthGroupInstruction
              ? {
                  fullWidthGroupInstruction: {
                    ...fullWidthGroupInstruction,
                    groupId: String(page?.fullWidthGroupInstruction?.groupId || ""),
                  },
                }
              : {}),
            curriculumSummary: Array.isArray(page?.curriculumSummary)
              ? page.curriculumSummary.map((item: any) => ({ ...item }))
              : [],
          };
        }),
      };
    });

    return Object.keys(restored).length ? restored : null;
  };

  const [placedBookletInputs, setPlacedBookletInputs] = useState<Record<string, BookletPdfInput> | null>(null);
  const [placedLayoutSignature, setPlacedLayoutSignature] = useState("");
  const [placementLoading, setPlacementLoading] = useState(false);
  const [bookletCreateLoading, setBookletCreateLoading] = useState(false);
  const [lockedBookletInputs, setLockedBookletInputs] = useState<Record<string, BookletPdfInput> | null>(() =>
    unpackBookletLayoutLock(exam?.bookletLayoutLock),
  );

  const isQuestionPlacementReady = Boolean(
    placedBookletInputs && placedLayoutSignature === currentPlacementSignature,
  );

  const normalizedBookletKeysForPlacement = bookletKeysForPlacement.map((value: string) =>
    String(value || "A").trim().toUpperCase(),
  );
  const lockedBookletType = String(exam?.bookletLayoutLock?.bookletType || "").trim().toUpperCase();
  const currentBookletType = String(exam?.bookletType || "A").trim().toUpperCase();
  const isLockedBookletReady = Boolean(
    lockedBookletInputs &&
    lockedBookletType === currentBookletType &&
    String(exam?.bookletLayoutLock?.sourceSignature || "") === currentPlacementSignature &&
    normalizedBookletKeysForPlacement.every((key) => Boolean(lockedBookletInputs?.[key])),
  );
  const canPreviewBooklets = Boolean(isQuestionPlacementReady || isLockedBookletReady);
  // Yeni bir yerleşim ön izleniyorsa eski sabit kitapçık indirilmesin. Kullanıcı
  // "Kitapçık Oluştur" diyene kadar yalnız Ön İzleme açık kalır.
  const canDownloadLockedBooklets = Boolean(
    isLockedBookletReady && !isQuestionPlacementReady && !placementLoading && !bookletCreateLoading,
  );

  useEffect(() => {
    setLockedBookletInputs(unpackBookletLayoutLock(exam?.bookletLayoutLock));
  }, [
    exam?.id,
    exam?.bookletLayoutLock?.version,
    exam?.bookletLayoutLock?.createdAt,
    exam?.bookletLayoutLock?.bookletType,
    exam?.bookletLayoutLock?.questionsLocked,
  ]);

  const [previewBookletKey, setPreviewBookletKey] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewPdfError, setPreviewPdfError] = useState("");
  const previewRequestRef = useRef(0);

  // Yeni sınava geçildiğinde önceki sınavın yerleşim taslağı/ön izlemesi kesinlikle
  // taşınmasın. Aynı sınıf-ders-tür ve aynı soru adedi olsa dahi kitapçık yeni
  // sınav için baştan "Soruları Yerleştir" akışıyla hazırlanmalıdır.
  useEffect(() => {
    setPlacedBookletInputs(null);
    setPlacedLayoutSignature("");
    setLockedBookletInputs(unpackBookletLayoutLock(exam?.bookletLayoutLock));
    setPreviewBookletKey(null);
    setPreviewPdfLoading(false);
    setPreviewPdfError("");
    setPreviewPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [exam?.id]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const closeBookletPreview = () => {
    previewRequestRef.current += 1;
    setPreviewBookletKey(null);
    setPreviewPdfLoading(false);
    setPreviewPdfError("");
    setPreviewPdfUrl(null);
  };

  const handlePlaceQuestions = async () => {
    if (placementLoading || bookletCreateLoading) return;
    setPlacementLoading(true);
    closeBookletPreview();
    try {
      const nextInputs: Record<string, BookletPdfInput> = {};
      for (const rawKey of bookletKeysForPlacement) {
        const key = String(rawKey || "A").trim().toUpperCase();
        nextInputs[key] = await buildOptimizedBookletInput(key);
      }
      setPlacedBookletInputs(nextInputs);
      setPlacedLayoutSignature(currentPlacementSignature);
      showToast("Sorular yerleştirildi. Ön İzleme ile kontrol edip Kitapçık Oluştur butonuna basınız.");
    } catch (error: any) {
      console.error("Soru yerleşimi hazırlanamadı:", error);
      setPlacedBookletInputs(null);
      setPlacedLayoutSignature("");
      showToast(error?.message || "Sorular yerleştirilemedi.");
    } finally {
      setPlacementLoading(false);
    }
  };

  const handleCreateBooklets = async () => {
    if (bookletCreateLoading) return;
    if (!isQuestionPlacementReady || !placedBookletInputs) {
      showToast("Önce Soruları Yerleştir butonuna basıp kitapçıkları Ön İzleme ile kontrol ediniz.");
      return;
    }

    setBookletCreateLoading(true);
    closeBookletPreview();
    try {
      // Ön izlemede onaylanan gerçek PDF yerleşimini, görselleri tekilleştirerek sınav
      // kaydının içine sabitle. Bu kayıt ExamPrepareModule tarafından SQLite/localforage'a
      // yazıldığı için uygulama kapatılıp yeniden açılsa da aynı sayfa/sütun/soru konumları korunur.
      const lock = packBookletLayoutLock(placedBookletInputs, currentPlacementSignature);
      const restored = unpackBookletLayoutLock(lock);
      if (!restored) throw new Error("Kitapçık yerleşimi sabitlenemedi.");

      const archiveQuestionIds = [...new Set(
        Object.values(questions || {})
          .flatMap((subjectQuestions: any) => Object.values(subjectQuestions || {}))
          .map((question: any) => String(
            question?.systemQuestionId ||
            question?.questionId ||
            question?.question_id ||
            question?.id ||
            "",
          ).trim())
          .filter(Boolean),
      )];
      if (archiveQuestionIds.length > 0) {
        const archiveResponse = await fetch("/api/question-bank/archive-selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            examId: String(exam?.id || exam?.examCode || exam?.examName || ""),
            examName: String(exam?.examName || ""),
            questionIds: archiveQuestionIds,
            source: "Kitapçık Oluştur",
          }),
        });
        const archiveBody = await archiveResponse.json().catch(() => ({}));
        if (!archiveResponse.ok) {
          throw new Error(String(archiveBody?.error || "Sınav soru klasörü oluşturulamadı."));
        }
        if (Array.isArray(archiveBody?.skipped) && archiveBody.skipped.length > 0) {
          console.warn("Bazı sınav soruları kazanım klasörüne arşivlenemedi:", archiveBody.skipped);
        }
      }

      setLockedBookletInputs(restored);
      onUpdateExam({
        ...exam,
        bookletLayoutLock: lock,
      });

      // Artık taslak değil, sabit kayıt PDF kaynağıdır. Böylece PDF oluşturma sırasında
      // algoritma yeniden çalışmaz ve A/B/C/D kitapçıklarında hiçbir soru yer değiştirmez.
      setPlacedBookletInputs(null);
      setPlacedLayoutSignature("");
      showToast("Kitapçıklar sabitlendi. PDF çıktıları artık bu yerleşimden oluşturulacak.");
    } catch (error: any) {
      console.error("Kitapçıklar sabitlenemedi:", error);
      showToast(error?.message || "Kitapçıklar oluşturulamadı.");
    } finally {
      setBookletCreateLoading(false);
    }
  };

  const handleToggleQuestionEditingLock = () => {
    if (!isLockedBookletReady || !exam?.bookletLayoutLock) {
      showToast("Önce Soruları Yerleştir ve Kitapçık Oluştur işlemini tamamlayınız.");
      return;
    }

    const nextLocked = !isQuestionEditingLocked;
    const lockChangedAt = new Date().toISOString();
    const nextLock = {
      ...exam.bookletLayoutLock,
      questionsLocked: nextLocked,
      questionsLockedAt: nextLocked ? lockChangedAt : null,
    };

    if (nextLocked) {
      setSystemQuestionModalOpen(false);
      setShowFolderModal(false);
      setSelectedSystemQuestionIds(new Set());
    }

    onUpdateExam({
      ...exam,
      finalizedAt: exam?.finalizedAt || (nextLocked ? lockChangedAt : undefined),
      bookletLayoutLock: nextLock,
    });
    showToast(
      nextLocked
        ? "Kitapçık kilitlendi. Soru İşlemleri artık değiştirilemez."
        : "Kitapçık kilidi açıldı. Soru İşlemleri yeniden düzenlenebilir.",
    );
  };

  const getPreviewBookletInput = (bookletKey: string): BookletPdfInput | null => {
    const key = String(bookletKey || "A").trim().toUpperCase();
    if (isQuestionPlacementReady) {
      const input = placedBookletInputs?.[key] || null;
      if (!input) showToast(`${key} kitapçığı için soru yerleşimi bulunamadı.`);
      return input;
    }
    if (isLockedBookletReady) {
      const input = lockedBookletInputs?.[key] || null;
      if (!input) showToast(`${key} kitapçığının sabit kaydı bulunamadı.`);
      return input;
    }
    showToast("Önce Soruları Yerleştir butonuna basınız.");
    return null;
  };

  const getLockedBookletInput = (bookletKey: string): BookletPdfInput | null => {
    if (isQuestionPlacementReady) {
      showToast("Yeni yerleşim henüz sabitlenmedi. Ön izlemeyi kontrol edip Kitapçık Oluştur butonuna basınız.");
      return null;
    }
    if (!isLockedBookletReady) {
      showToast("PDF oluşturmadan önce Soruları Yerleştir ve ardından Kitapçık Oluştur işlemini tamamlayınız.");
      return null;
    }
    const key = String(bookletKey || "A").trim().toUpperCase();
    const input = lockedBookletInputs?.[key] || null;
    if (!input) showToast(`${key} kitapçığının sabit kaydı bulunamadı.`);
    return input;
  };

  const downloadOptimizedBooklet = async (bookletKey: string) => {
    const input = getLockedBookletInput(bookletKey);
    if (!input) return false;
    await downloadQuestionBookletPdf(input);
    return true;
  };

  const handleDownloadExamPDF = async () => {
    if (!canDownloadLockedBooklets) {
      if (isQuestionPlacementReady) {
        showToast("Ön izlemeyi kontrol edip Kitapçık Oluştur butonuna basınız.");
      } else {
        showToast("Önce Soruları Yerleştir, ardından Kitapçık Oluştur işlemini tamamlayınız.");
      }
      return;
    }
    showToast(`${bookletKeysForPlacement.length} adet sabit sınav kitapçığı pdfmake ile oluşturuluyor...`);
    for (const bookletKey of bookletKeysForPlacement) await downloadOptimizedBooklet(bookletKey);
    showToast("Tüm sabit sınav kitapçıkları başarıyla oluşturuldu ve indirildi!");
  };

  const handleDownloadSingleBooklet = async (bookletKey: string) => {
    if (!canDownloadLockedBooklets) {
      if (isQuestionPlacementReady) {
        showToast("Ön izlemeyi kontrol edip Kitapçık Oluştur butonuna basınız.");
      } else {
        showToast("Önce Soruları Yerleştir, ardından Kitapçık Oluştur işlemini tamamlayınız.");
      }
      return;
    }
    showToast(`${bookletKey.toUpperCase()} kitapçığı sabit yerleşimden oluşturuluyor...`);
    const downloaded = await downloadOptimizedBooklet(bookletKey);
    if (downloaded) showToast(`${bookletKey.toUpperCase()} Kitapçığı PDF'i başarıyla indirildi!`);
  };

  const handlePreviewBooklet = async (bookletKey: string) => {
    if (!canPreviewBooklets) {
      showToast("Önce Soruları Yerleştir butonuna basınız.");
      return;
    }
    const input = getPreviewBookletInput(bookletKey);
    if (!input) return;

    const requestId = ++previewRequestRef.current;
    setPreviewBookletKey(bookletKey);
    setPreviewPdfLoading(true);
    setPreviewPdfError("");
    setPreviewPdfUrl(null);

    try {
      const definition = buildQuestionBookletPdfDefinition(input);
      const blob = await PdfEngine.generate(definition, { mode: "blob" }) as Blob;
      if (requestId !== previewRequestRef.current) return;
      setPreviewPdfUrl(URL.createObjectURL(blob));
    } catch (error: any) {
      if (requestId !== previewRequestRef.current) return;
      console.error("Kitapçık ön izleme oluşturulamadı:", error);
      setPreviewPdfError(error?.message || "Gerçek PDF ön izlemesi oluşturulamadı.");
    } finally {
      if (requestId === previewRequestRef.current) setPreviewPdfLoading(false);
    }
  };

  const currentQuestionData =
    currentSubjectName && activeQuestion
      ? questions[currentSubjectName]?.[activeQuestion.questionIndex] || {}
      : {};

  const previewQuestionIndices = activeSubject
    ? Object.keys(questions[activeSubject.name] || {})
        .map((key) => Number(key))
        .filter((index) => Number.isFinite(index) && !!questions[activeSubject.name]?.[index]?.imageUrl)
        .sort((a, b) => a - b)
    : [];

  const previewQuestionData =
    questionPreviewIndex !== null && activeSubject
      ? questions[activeSubject.name]?.[questionPreviewIndex] || {}
      : {};
  const previewCorrectAnswer = getQuestionCorrectAnswer(previewQuestionData);
  const previewSavedAnswer = String(
    previewQuestionData?.correctAnswer || previewQuestionData?.answer || previewQuestionData?.correct_answer || "",
  ).trim().toUpperCase();

  const previewPosition = questionPreviewIndex === null
    ? -1
    : previewQuestionIndices.indexOf(questionPreviewIndex);

  const showPreviousPreviewQuestion = () => {
    if (previewPosition <= 0) return;
    setQuestionPreviewIndex(previewQuestionIndices[previewPosition - 1]);
  };

  const showNextPreviewQuestion = () => {
    if (previewPosition < 0 || previewPosition >= previewQuestionIndices.length - 1) return;
    setQuestionPreviewIndex(previewQuestionIndices[previewPosition + 1]);
  };

  const withSuppressedTeacherQuestion = (
    sourceExam: any,
    subjectName: string,
    question: any,
  ) => {
    // Kaynağı yönetici/öğretmen/sistem ne olursa olsun silinen soru tekrar
    // otomatik senkronla sınava dönmemelidir.
    const questionId = rememberLocallyExcludedQuestion(subjectName, question);
    if (!questionId) return sourceExam?.teacherSelectionExcludedQuestionIdsBySubject || {};

    const current = sourceExam?.teacherSelectionExcludedQuestionIdsBySubject || {};
    const subjectIds = new Set(
      Array.isArray(current?.[subjectName]) ? current[subjectName].map(String) : [],
    );
    subjectIds.add(questionId);
    return { ...current, [subjectName]: Array.from(subjectIds) };
  };

  const findQuestionAssignmentForSubject = (subjectName: string) =>
    Object.values(exam?.questionAssignments || {}).find(
      (assignment: any) =>
        normalizeSystemQuestionLabel(assignment?.subject || assignment?.courseName || assignment?.lessonName || "") ===
        normalizeSystemQuestionLabel(subjectName),
    ) as any;

  const replaceExamQuestionAssignment = (
    subjectName: string,
    nextAssignment: any | null,
    mode: "admin" | "teacher",
    sourceExam: any = exam,
  ) => {
    const currentAssignments = sourceExam?.questionAssignments || {};
    const nextAssignments: Record<string, any> = {};
    let replaced = false;

    Object.entries(currentAssignments).forEach(([key, value]: any) => {
      const sameSubject =
        normalizeSystemQuestionLabel(value?.subject || value?.courseName || value?.lessonName || "") ===
        normalizeSystemQuestionLabel(subjectName);
      if (!sameSubject) {
        nextAssignments[key] = value;
        return;
      }
      if (nextAssignment && !replaced) {
        nextAssignments[key] = nextAssignment;
        replaced = true;
      }
    });

    if (nextAssignment && !replaced) {
      nextAssignments[subjectName] = nextAssignment;
    }

    onUpdateExam({
      ...sourceExam,
      questionAssignments: nextAssignments,
      questionSelectionModeBySubject: {
        ...(sourceExam?.questionSelectionModeBySubject || {}),
        [subjectName]: mode,
      },
    });
  };

  const withPreservedTeacherSelectionsAsAdminQuestions = (
    sourceExam: any,
    subjectName: string,
    snapshots: any[],
  ) => {
    if (isQuestionEditingLocked) return sourceExam;
    if (!Array.isArray(snapshots) || snapshots.length === 0) return sourceExam;

    const nextQuestions: any = JSON.parse(JSON.stringify(sourceExam?.questions || {}));
    const currentRows = Object.values(nextQuestions?.[subjectName] || {}).filter(
      (question: any) => question?.imageUrl,
    ) as any[];

    const existingIds = new Set(
      currentRows
        .map((question: any) =>
          String(
            question?.systemQuestionId ||
            question?.questionId ||
            question?.id ||
            "",
          ).trim(),
        )
        .filter(Boolean),
    );

    const imported = snapshots
      .filter(Boolean)
      .filter((snapshot: any) => {
        const id = String(
          snapshot?.id ||
          snapshot?.questionId ||
          snapshot?.question_id ||
          snapshot?.key ||
          "",
        ).trim();
        if (!id) return true;
        if (existingIds.has(id)) return false;
        existingIds.add(id);
        return true;
      })
      .map((q: any) => {
        const id = String(
          q?.id || q?.questionId || q?.question_id || q?.key || "",
        ).trim();
        return {
          id,
          questionId: id,
          systemQuestionId: id,
          imageUrl: String(
            q?.imageUrl ||
            q?.image_url ||
            q?.thumbnailUrl ||
            q?.thumbnail_url ||
            q?.storagePath ||
            q?.storage_path ||
            (id ? `/api/question-bank/images/${encodeURIComponent(id)}` : ""),
          ),
          correctAnswer:
            q?.correctAnswer || q?.answer || q?.correct_answer || "",
          unit: q?.unitName || q?.unit || "",
          topic: q?.topicName || q?.topic || "",
          outcome: q?.outcomeName || q?.outcome || "",
          columnSpan: Number(q?.columnSpan || q?.column_span || 1) === 2 ? 2 : 1,
          source: "admin-selection",
        };
      })
      .filter((question: any) => question?.imageUrl);

    if (imported.length === 0) return sourceExam;

    const mergedRows = [...currentRows, ...imported];
    nextQuestions[subjectName] = Object.fromEntries(
      mergedRows.map((question: any, index: number) => [index, question]),
    );

    let nextStructure = sourceExam?.examStructure || examStructure;
    if (isFlexibleCourseBasedExam) {
      nextStructure = withUpdatedSubjectCount(
        nextStructure,
        subjectName,
        mergedRows.length,
      );
    }

    return {
      ...sourceExam,
      questions: nextQuestions,
      examStructure: nextStructure,
    };
  };

  const releaseQuestionAssignmentForSubject = async (subjectName: string) => {
    if (blockQuestionMutationWhenLocked()) return null;
    const assigned = findQuestionAssignmentForSubject(subjectName);
    const assignmentId = String(assigned?.id || assigned?.__documentId || "").trim();
    let preservedQuestionSnapshots: any[] = [];

    // Seçilmiş sorular sınav üzerinde aynen kalır. Sadece devam eden öğretmen
    // görevi kaldırılır; yönetici aynı sınav üzerinde soru seçmeye devam eder.
    try {
      const response = await fetch(
        "/api/question-bank/teacher-assignments/release-by-context",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            examId: String(exam?.id || ""),
            examCode: String(exam?.examCode || ""),
            subjectName,
          }),
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Soru seçme görevi kaldırılamadı."));
      }
      preservedQuestionSnapshots = Array.isArray(body?.preservedQuestionSnapshots)
        ? body.preservedQuestionSnapshots.filter(Boolean)
        : [];
    } catch (error) {
      // Yeni endpoint bulunmayan geçiş kurulumlarında mevcut görevi doğrudan silmeyi dene.
      if (assignmentId) {
        try {
          await fetch(`/api/database/collections/teacherTestAssignmentSelections/${encodeURIComponent(assignmentId)}`, { method: "DELETE", cache: "no-store" });
          await fetch(`/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE", cache: "no-store" });
        } catch { /* yerel güncelleme yine uygulanır */ }
      }
      console.warn("Öğretmen görevi sunucudan kaldırılamadı; yönetici modu yerel olarak açılıyor.", error);
    }

    // Parent tarafta ayrıca öğretmen ataması tutuluyorsa onu da best-effort temizle.
    // Bu çağrının başarısız olması yönetici moduna geçişi engellemez.
    if (typeof onClearQuestionTeacher === "function") {
      try {
        await Promise.resolve(onClearQuestionTeacher(subjectName));
      } catch (error) {
        console.warn("Üst bileşendeki öğretmen görevi temizlenemedi:", error);
      }
    }

    const nextExam = withPreservedTeacherSelectionsAsAdminQuestions(
      exam,
      subjectName,
      preservedQuestionSnapshots,
    );
    replaceExamQuestionAssignment(subjectName, null, "admin", nextExam);
    setQuestionAssigneeDraftBySubject((current) => ({ ...current, [subjectName]: "" }));
    showToast("Öğretmen görevi iptal edildi. Mevcut seçilmiş sorular korundu; yönetici soru seçmeye devam edebilir.");
  };

  const completeQuestionAssignmentForSubject = async (subjectName: string) => {
    const assigned = findQuestionAssignmentForSubject(subjectName);
    const assignmentId = String(assigned?.id || assigned?.__documentId || "").trim();
    if (!assignmentId) {
      showToast("Sonlandırılacak aktif soru seçimi görevi bulunamadı.");
      return;
    }

    if (assigned?.completedAt || String(assigned?.selectionStatus || "").toLowerCase() === "completed") {
      showToast("Bu soru seçimi görevi zaten sonlandırılmış.");
      return;
    }

    const approved = window.confirm(
      `${assigned?.teacherName || "Öğretmen"} için soru seçimi görevini sonlandırmak istediğinizden emin misiniz?\n\nÖğretmenin şu ana kadar seçtiği sorular korunacak; görev öğretmen uygulamasından kapanacaktır.`,
    );
    if (!approved) return;

    try {
      const response = await fetch(
        `/api/question-bank/teacher-assignments/${encodeURIComponent(assignmentId)}/complete-by-admin`,
        { method: "POST", cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Soru seçimi görevi sonlandırılamadı."));
      }

      const completedAssignment = body?.assignment || {
        ...assigned,
        selectionStatus: "completed",
        completedAt: new Date().toISOString(),
        completedBy: "admin",
      };
      replaceExamQuestionAssignment(subjectName, completedAssignment, "teacher");
      showToast(
        `${completedAssignment?.teacherName || assigned?.teacherName || "Öğretmen"} için soru seçimi görevi yönetici tarafından sonlandırıldı.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Soru seçimi görevi sonlandırılamadı.",
      );
    }
  };

  const buildFreshQuestionAssignmentForSubject = (
    subjectName: string,
    teacherId: string,
    teacherName: string,
    assigned: any,
  ) => {
    const now = new Date().toISOString();
    const curriculumScopeTree = buildTeacherCurriculumScopeTree();
    const singleScope = activeCurriculumScopes?.[0] || {};
    const configuredCount = Math.max(0, Number(activeSubject?.count || 0));
    const flexibleCount = configuredCount <= 0;
    const safeExamId = String(exam?.id || exam?.examCode || exam?.name || "exam")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "exam";
    const safeSubject = String(subjectName || "ders")
      .toLocaleLowerCase("tr-TR")
      .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ders";
    const assignmentId = String(assigned?.id || assigned?.__documentId || `exam-assignment-${safeExamId}-${safeSubject}`);

    return {
      ...(assigned || {}),
      id: assignmentId,
      assignmentKind: "exam",
      workflowType: "exam-question-selection",
      testId: String(exam?.id || exam?.examCode || assignmentId),
      examId: String(exam?.id || ""),
      examCode: String(exam?.examCode || ""),
      testName: replaceLegacyExamTerminology(exam?.examName || exam?.name || "Sınav"),
      examName: replaceLegacyExamTerminology(exam?.examName || exam?.name || "Sınav"),
      testType: replaceLegacyExamTerminology(exam?.examType || ""),
      grade: String(exam?.gradeLevel || ""),
      courseId: String(singleScope?.courseId || currentCurriculumCourseId || assigned?.courseId || ""),
      courseName: subjectName,
      subject: subjectName,
      unitId: String(singleScope?.unitId || assigned?.unitId || ""),
      unitName: String(singleScope?.unitName || assigned?.unitName || ""),
      topicId: isUnitScanExam ? "" : String(singleScope?.topicId || assigned?.topicId || ""),
      topicName: isUnitScanExam ? "" : String(singleScope?.topicName || assigned?.topicName || ""),
      outcomeId: isUnitScanExam ? "" : String(singleScope?.outcomeId || assigned?.outcomeId || ""),
      outcomeName: isUnitScanExam ? "" : String(singleScope?.outcomeName || assigned?.outcomeName || ""),
      teacherId,
      teacherName,
      scopeTree: curriculumScopeTree,
      curriculumScopeTree,
      fullScopeTree: curriculumScopeTree,
      availableQuestionSnapshots: Array.isArray(assigned?.availableQuestionSnapshots) ? assigned.availableQuestionSnapshots : [],
      selectedQuestionKeys: Array.isArray(assigned?.selectedQuestionKeys) ? assigned.selectedQuestionKeys : [],
      selectedQuestionSnapshots: Array.isArray(assigned?.selectedQuestionSnapshots) ? assigned.selectedQuestionSnapshots : [],
      questionCountMode: flexibleCount ? "flexible" : "fixed",
      requiredQuestionCount: flexibleCount ? 0 : configuredCount,
      maxQuestionCount: flexibleCount ? 5000 : configuredCount,
      selectionStatus: "in_progress",
      completedAt: "",
      createdAt: String(assigned?.createdAt || now),
      updatedAt: now,
    };
  };

  const reassignQuestionAssignmentForSubject = async (
    subjectName: string,
    teacherId: string,
    teacherName: string,
  ) => {
    if (blockQuestionMutationWhenLocked()) return null;
    const assigned = findQuestionAssignmentForSubject(subjectName);

    if (
      String(assigned?.teacherId || "") === teacherId &&
      !assigned?.completedAt &&
      String(assigned?.selectionStatus || "").toLowerCase() !== "completed"
    ) {
      setQuestionAssigneeDraftBySubject((current) => ({ ...current, [subjectName]: teacherId }));
      return assigned;
    }

    // Ana görevlendirme akışı ExamPrepareModule'dedir. Önceki sürümlerde bu
    // bileşen kendi endpoint'inden ayrı görev yazdığı için masaüstü sınav kaydı ile
    // öğretmen mobil görevi iki farklı kaynağa ayrılıyordu. Parent callback varsa
    // yalnız onu kullan; böylece exams + teacherTestAssignments tek işlemde güncellenir.
    if (typeof onAssignQuestionTeacher === "function") {
      const savedAssignment = await Promise.resolve(
        onAssignQuestionTeacher(subjectName, teacherId),
      );
      if (!savedAssignment) {
        throw new Error("Soru seçme görevi kaydedilemedi.");
      }
      // Sunucu mobil bağlantının kanonik teacherId değerini kaydedebilir; bu id
      // masaüstündeki öğretmen kataloğu id'sinden farklı olabilir. Select değerinde
      // kullanıcının seçtiği katalog id'sini tut ki seçenek boş görünmesin.
      setQuestionAssigneeDraftBySubject((current) => ({
        ...current,
        [subjectName]: teacherId,
      }));
      showToast(
        assigned
          ? `Soru seçme görevi ${savedAssignment?.teacherName || teacherName} öğretmenine aktarıldı. Mevcut seçimler korundu.`
          : `Soru seçme görevi ${savedAssignment?.teacherName || teacherName} öğretmenine verildi.`,
      );
      return savedAssignment;
    }

    // Bağımsız kullanım için geri dönüş: aynı atomik sunucu endpoint'i.
    const assignmentId = String(assigned?.id || assigned?.__documentId || "").trim();
    const seedAssignment = buildFreshQuestionAssignmentForSubject(
      subjectName,
      teacherId,
      teacherName,
      assigned,
    );
    const response = await fetch(
      "/api/question-bank/teacher-assignments/reassign-by-context",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          examId: String(exam?.id || ""),
          examCode: String(exam?.examCode || ""),
          subjectName,
          teacherId,
          teacherName,
          seedAssignment,
          examSnapshot: exam,
        }),
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(body?.error || "Soru seçme görevi öğretmene verilemedi."));
    }

    const nextAssignment = body?.assignment || seedAssignment;
    const nextExam = body?.exam && String(body.exam?.id || "") === String(exam?.id || "")
      ? body.exam
      : null;
    if (nextExam) {
      onUpdateExam(nextExam);
    } else {
      replaceExamQuestionAssignment(subjectName, nextAssignment, "teacher");
    }
    setQuestionAssigneeDraftBySubject((current) => ({
      ...current,
      [subjectName]: teacherId,
    }));
    await repairTeacherAssignmentCurriculum(
      subjectName,
      String(nextAssignment?.teacherId || teacherId),
      { silent: true },
    );
    showToast(
      assigned
        ? `Soru seçme görevi ${nextAssignment?.teacherName || teacherName} öğretmenine aktarıldı. Mevcut seçimler korundu.`
        : `Soru seçme görevi ${nextAssignment?.teacherName || teacherName} öğretmenine verildi.`,
    );
    return nextAssignment;
  };

  const handleDeletePreviewQuestion = async () => {
    if (blockQuestionMutationWhenLocked()) return;
    if (questionPreviewIndex === null || !activeSubject) return;

    const subjectName = activeSubject.name;
    const qIndex = questionPreviewIndex;
    const currentIndices = [...previewQuestionIndices];
    const currentPosition = currentIndices.indexOf(qIndex);
    const newQuestions = JSON.parse(JSON.stringify(questions));
    const removedQuestion = newQuestions?.[subjectName]?.[qIndex];

    if (!removedQuestion?.imageUrl) return;
    rememberLocallyExcludedQuestion(subjectName, removedQuestion);
    // Çöp kutusu her durumda anında çalışır. Kaynak görev temizliği başarısız
    // olsa bile exclusion kaydı sorunun otomatik olarak geri gelmesini engeller.
    void removeTeacherSelectionAtSource(removedQuestion, subjectName);

    if (removedQuestion?.systemQuestionId) {
      void fetch("/api/question-bank/usage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: String(removedQuestion.systemQuestionId),
          examId: String(exam?.id || exam?.examCode || ""),
        }),
      }).catch(() => undefined);
    }

    let nextPreviewIndex: number | null = null;

    if (isFlexibleCourseBasedExam) {
      const remaining = Object.entries(newQuestions[subjectName] || {})
        .filter(([key, question]: any) => Number(key) !== qIndex && question?.imageUrl)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, question]) => question);

      newQuestions[subjectName] = Object.fromEntries(
        remaining.map((question, index) => [index, question]),
      );

      if (remaining.length > 0) {
        // Silinen sorudan sonraki soru, yeniden indeksleme sonrası aynı indekse gelir.
        // Son soru silindiyse bir önceki soru açık kalır.
        nextPreviewIndex = Math.min(qIndex, remaining.length - 1);
      }
    } else {
      newQuestions[subjectName][qIndex] = {};
      const remainingIndices = Object.keys(newQuestions[subjectName] || {})
        .map((key) => Number(key))
        .filter((index) => Number.isFinite(index) && !!newQuestions[subjectName]?.[index]?.imageUrl)
        .sort((a, b) => a - b);

      const nextAfterDeleted = remainingIndices.find((index) => index > qIndex);
      nextPreviewIndex = nextAfterDeleted ?? remainingIndices[remainingIndices.length - 1] ?? null;
    }

    const nextCount = isFlexibleCourseBasedExam
      ? Object.values(newQuestions[subjectName] || {}).filter((question: any) => question?.imageUrl).length
      : questionCount;
    const nextStructure = isFlexibleCourseBasedExam
      ? withUpdatedSubjectCount(examStructure, subjectName, nextCount)
      : examStructure;

    const nextExcluded = withSuppressedTeacherQuestion(exam, subjectName, removedQuestion);
    onUpdateExam({
      ...exam,
      questions: newQuestions,
      examStructure: nextStructure,
      teacherSelectionExcludedQuestionIdsBySubject: nextExcluded,
    });
    setQuestionPreviewIndex(nextPreviewIndex);
    showToast("Soru sınavdan kaldırıldı.");
  };

  return (
    <div className="space-y-6">
      {activeTab === "questions" ? (
      <>
      {isQuestionEditingLocked && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 shadow-sm">
          <Lock className="h-5 w-5 shrink-0" />
          <div>
            <div className="text-xs font-black">Soru İşlemleri Kilitli</div>
            <div className="mt-0.5 text-[11px] font-semibold text-rose-700">
              Kitapçık sabitlendi. Soru ekleme, silme, görsel/müfredat değiştirme ve öğretmen seçimlerinin canlı aktarımı durduruldu. Yanlış algılanmış doğru cevap A-E düğmelerinden yine düzeltilebilir.
            </div>
          </div>
        </div>
      )}
      <div className="bg-white border rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Subject Selector */}
        <div className="w-full md:w-64 shrink-0 space-y-4 border-r pr-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {isTytQuestionManager ? "TEST / DERS" : "DERS"}
            </label>
            <div className="space-y-1">
              {isTytQuestionManager
                ? examStructure.map((test: any, testIndex: number) => {
                    const subjects = Array.isArray(test?.subjects) ? test.subjects : [];
                    const isAreaSelected = activeTestIndex === testIndex;
                    const areaQuestionCount = subjects.reduce(
                      (sum: number, sub: any) => sum + displayedSubjectCount(sub),
                      0,
                    );
                    return (
                      <div
                        key={`tyt-area-${testIndex}-${test?.testName || test?.name || "area"}`}
                        className={`rounded-xl ${isAreaSelected ? "bg-green-50/70" : ""}`}
                      >
                        <div
                          className={`w-full px-3 py-2 text-left text-sm font-bold ${isAreaSelected ? "text-green-800" : "text-slate-700"}`}
                        >
                          {tytAreaDisplayName(test)}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            ({areaQuestionCount} Soru)
                          </span>
                        </div>
                        <div className="space-y-0.5 pb-1 pl-3">
                          {subjects.map((sub: any, subjectIndex: number) => {
                            const isSelected = activeTestIndex === testIndex && activeSubjectIndex === subjectIndex;
                            return (
                              <button
                                key={`tyt-subject-${testIndex}-${subjectIndex}-${sub?.name || "subject"}`}
                                type="button"
                                className={`w-full rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold transition-colors ${isSelected ? "border-l-4 border-green-600 bg-green-100 pl-2 text-green-900" : "text-slate-600 hover:bg-slate-50"}`}
                                onClick={() => {
                                  setActiveTestIndex(testIndex);
                                  setActiveSubjectIndex(subjectIndex);
                                }}
                              >
                                {sub.name}{" "}
                                <span className="text-[11px] font-normal text-slate-400">
                                  ({displayedSubjectCount(sub)} Soru)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                : examStructure.flatMap((test: any, testIndex: number) =>
                    (test.subjects || []).map((sub: any, subjectIndex: number) => {
                      const isSelected = activeTestIndex === testIndex && activeSubjectIndex === subjectIndex;
                      return (
                        <button
                          key={`${testIndex}-${subjectIndex}-${sub.name}`}
                          className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${isSelected ? "bg-green-100 text-green-850 font-bold border-l-4 border-green-600 pl-2" : "hover:bg-slate-50 text-slate-600"}`}
                          onClick={() => {
                            setActiveTestIndex(testIndex);
                            setActiveSubjectIndex(subjectIndex);
                          }}
                        >
                          {sub.name}{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            ({displayedSubjectCount(sub)} Soru)
                          </span>
                        </button>
                      );
                    }),
                  )}
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={bulkFileInputRef}
                onChange={handleBulkFileUpload}
              />
              <button
                type="button"
                disabled={!activeSubject || isQuestionEditingLocked}
                onClick={() => {
                  if (blockQuestionMutationWhenLocked()) return;
                  bulkFileInputRef.current?.click();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                Soru Görsellerini Yükle
              </button>
              <button
                type="button"
                disabled={!activeSubject || isQuestionEditingLocked}
                onClick={() => setShowAnswerKeyEntryModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ListChecks className="h-4 w-4" />
                Cevap Anahtarını Gir
              </button>
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h3 className="text-lg font-bold text-slate-800">
              {activeSubject?.name} Soruları
            </h3>

            {exam.examSource !== "Basılı Yayın" && (
              <div className="flex gap-3 items-center flex-wrap">
                <button
                  type="button"
                  onClick={startQuestionGroupSelection}
                  disabled={isQuestionEditingLocked}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all text-xs cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Link2 className="w-4 h-4" />
                  Soru Grubu Oluştur
                </button>
                <button
                  type="button"
                  onClick={openSystemQuestionPicker}
                  disabled={isQuestionEditingLocked}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition-all text-xs cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BookOpen className="w-4 h-4" />
                  Soruları Sistemden Al
                </button>
                <button
                  onClick={() => {
                    if (blockQuestionMutationWhenLocked()) return;
                    bulkFileInputRef.current?.click();
                  }}
                  disabled={isQuestionEditingLocked}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-all text-xs cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  Klasörden Soru Yükle
                </button>
              </div>
            )}
          </div>

          {questionGroupSelectionMode && exam.examSource !== "Basılı Yayın" ? (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-indigo-900">
                  <Link2 className="h-4 w-4" /> Soru Grubu Seçimi
                </div>
                <div className="mt-1 text-[11px] font-semibold text-indigo-700">
                  Aynı yönergeye bağlı soruların kartlarına tıklayın. Sorular mevcut sınav sırasına göre gruplandırılacaktır.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm">{questionGroupSelectedIndices.size} soru seçildi</span>
                <button
                  type="button"
                  onClick={openNewQuestionGroupEditor}
                  disabled={questionGroupSelectedIndices.size < 2}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Yönergeyi Tanımla
                </button>
                <button type="button" onClick={resetQuestionGroupSelection} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100">İptal</button>
              </div>
            </div>
          ) : null}

          {exam.examSource !== "Basılı Yayın" && activeSubject && isFlexibleCourseBasedExam && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
              {(() => {
                const subjectName = String(activeSubject?.name || "");
                const assigned = Object.values(exam?.questionAssignments || {}).find(
                  (assignment: any) =>
                    String(assignment?.subject || assignment?.courseName || "")
                      .trim()
                      .toLocaleLowerCase("tr-TR") === subjectName.trim().toLocaleLowerCase("tr-TR"),
                ) as any;
                const teacherCandidates =
                  typeof getTeachersForSubject === "function"
                    ? getTeachersForSubject(subjectName)
                    : [];
                const normalizeTeacherUiName = (value: unknown) =>
                  String(value || "")
                    .trim()
                    .toLocaleUpperCase("tr-TR")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^A-Z0-9]+/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                const assignedCandidate = teacherCandidates.find((teacher: any) =>
                  String(teacher?.id || "") === String(assigned?.teacherId || "") ||
                  (normalizeTeacherUiName(teacher?.name || teacher?.teacherName) &&
                    normalizeTeacherUiName(teacher?.name || teacher?.teacherName) ===
                      normalizeTeacherUiName(assigned?.teacherName)),
                );
                const selectedTeacherValue = String(
                  questionAssigneeDraftBySubject[subjectName] ??
                  assignedCandidate?.id ??
                  "",
                );
                const assignedCompleted = Boolean(
                  assigned?.completedAt ||
                  String(assigned?.selectionStatus || "").toLowerCase() === "completed",
                );

                return (
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                    <div className="min-w-[320px] flex-1">
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-amber-800">
                        Branş Öğretmeni
                      </label>
                      <select
                        value={selectedTeacherValue}
                        disabled={Boolean(questionAssigneeSavingBySubject[subjectName]) || isQuestionEditingLocked}
                        onChange={async (event) => {
                          const teacherId = event.target.value;
                          if (!teacherId) return;
                          const previousTeacherId = selectedTeacherValue;
                          setQuestionAssigneeDraftBySubject((current) => ({ ...current, [subjectName]: teacherId }));
                          setQuestionAssigneeSavingBySubject((current) => ({ ...current, [subjectName]: true }));
                          const selectedTeacher = teacherCandidates.find(
                            (teacher: any) => String(teacher?.id || "") === String(teacherId),
                          );
                          const teacherName = String(
                            selectedTeacher?.name || selectedTeacher?.teacherName || teacherId,
                          );
                          try {
                            await reassignQuestionAssignmentForSubject(
                              subjectName,
                              String(teacherId),
                              teacherName,
                            );
                          } catch (error) {
                            setQuestionAssigneeDraftBySubject((current) => ({ ...current, [subjectName]: previousTeacherId }));
                            console.error("Soru seçme görevi değiştirilemedi:", error);
                            showToast(
                              error instanceof Error
                                ? error.message
                                : "Soru seçme görevi değiştirilemedi.",
                            );
                          } finally {
                            setQuestionAssigneeSavingBySubject((current) => ({ ...current, [subjectName]: false }));
                          }
                        }}
                        className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
                      >
                        <option value="">Branş öğretmeni seçiniz</option>
                        {teacherCandidates.map((teacher: any) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                      {teacherCandidates.length === 0 ? (
                        <div className="mt-1 text-[10px] font-bold text-rose-600">
                          Bu dersin branşına atanmış öğretmen bulunamadı. Öğretmen İşlemleri / ders atamalarını kontrol ediniz.
                        </div>
                      ) : null}
                    </div>

                    {assigned?.teacherName ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`rounded-xl border px-3 py-2 text-[11px] font-black ${assignedCompleted ? "border-slate-200 bg-slate-100 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                          {assignedCompleted ? "Görev Sonlandırıldı" : "Görevlendirildi"}: {assigned.teacherName}
                        </div>
                        {!assignedCompleted ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void completeQuestionAssignmentForSubject(subjectName)}
                              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              Görevi Sonlandır
                            </button>
                            <button
                              type="button"
                              onClick={() => void releaseQuestionAssignmentForSubject(subjectName)}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-black text-rose-700 transition-colors hover:bg-rose-50"
                            >
                              Görevi İptal Et
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="xl:basis-full text-[10px] font-bold text-slate-600">
                      Öğretmen görevlendirilmiş olsa da yönetici “Soruları Sistemden Al” alanından soru seçebilir ve seçilmiş soruları düzenleyebilir.
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {exam.examSource === "Basılı Yayın" ? (
            <div
              className="grid gap-3 pb-4"
              style={{
                gridAutoFlow: "column",
                gridTemplateRows: `repeat(${Math.max(1, Math.ceil(questionCount / 2))}, minmax(0, auto))`,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
              {Array.from({ length: questionCount }).map((_, i) => {
                const qData = questions[activeSubject?.name]?.[i];
                const bookletKeys = (exam.bookletType ? exam.bookletType.split("-").map((s: string) => s.trim().toUpperCase()) : ["A"]);
                const otherBooklets = bookletKeys.filter((k: string) => k !== "A");
                const isConfigured = !!qData?.outcome && !!qData?.correctAnswer;

                return (
                  <div 
                    key={i} 
                    className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 bg-white border border-slate-200 hover:border-green-400 p-3 rounded-2xl shadow-xs transition-all duration-300 relative"
                  >
                    {/* Part 1: Question No & Answers */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-8 h-8 rounded-xl font-extrabold flex items-center justify-center text-xs border shrink-0 ${isConfigured ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-105 text-red-700"}`}>
                        {getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)}
                      </span>
                      <div className="flex gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                        {["A", "B", "C", "D", "E"].map((opt) => {
                          const isSelected = qData?.correctAnswer?.toUpperCase() === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                void saveQuestionCorrectAnswerAtIndex(i, opt);
                              }}
                              className={`w-6 h-6 rounded font-black text-[10px] flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-green-100 border border-green-300 text-green-700 shadow-xs scale-105"
                                  : "hover:bg-slate-200 text-slate-500 border border-transparent"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Part 2: Curriculum Dropdown */}
                    <div className="flex-1 min-w-0">
                      {(() => {
                        const hasCurriculum = !!qData?.outcome || !!qData?.topic || !!qData?.unit;
                        return (
                          <select
                            value={
                              qData?.outcome
                                ? `outcome:${qData.outcome}`
                                        : qData?.topic
                                ? `topic:${qData.topic}`
                                : qData?.unit
                                ? `unit:${qData.unit}`
                                : ""
                            }
                            disabled={isQuestionEditingLocked}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                void handleCurriculumSelectAtIndex(i, "", "", "");
                              } else {
                                const separatorIndex = val.indexOf(":");
                                const type = separatorIndex >= 0 ? val.slice(0, separatorIndex) : val;
                                const name = separatorIndex >= 0 ? val.slice(separatorIndex + 1) : "";
                                if (type === "outcome") {
                                  const opt = getFlatCurriculumOptions().find(o => o.outcome === name);
                                  void handleCurriculumSelectAtIndex(i, opt?.unit || "", opt?.topic || "", name);
                                } else if (type === "topic") {
                                  const opt = getFlatCurriculumOptions().find(o => o.topic === name && !o.outcome);
                                  void handleCurriculumSelectAtIndex(i, opt?.unit || "", name, "");
                                } else if (type === "unit") {
                                  void handleCurriculumSelectAtIndex(i, name, "", "");
                                }
                              }
                            }}
                            className={`w-full border rounded-xl px-2 py-1.5 text-xs outline-none cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap transition-all ${
                              hasCurriculum
                                ? qData?.outcome
                                  ? "bg-green-50 border-green-200 text-slate-900 font-normal hover:bg-green-100 hover:border-green-300 focus:ring-green-150 focus:border-green-400"
                                  : qData?.topic
                                    ? "bg-green-50 border-green-200 text-black font-bold hover:bg-green-100 hover:border-green-300 focus:ring-green-150 focus:border-green-400"
                                    : "bg-green-50 border-green-200 text-red-600 font-bold hover:bg-green-100 hover:border-green-300 focus:ring-green-150 focus:border-green-400"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 focus:ring-red-500/20 focus:border-red-500"
                            }`}
                          >
                            <option value="">-- Kazanım Yok --</option>
                            {getFlatCurriculumOptions().map((opt, idx) => {
                              const valueKey = opt.outcome
                                ? `outcome:${opt.outcome}`
                                : opt.topic
                                ? `topic:${opt.topic}`
                                : `unit:${opt.unit}`;
                              return (
                                <option
                                  key={idx}
                                  value={valueKey}
                                  style={{
                                    color: !opt.topic ? "#dc2626" : "#000000",
                                    fontWeight: !opt.topic || (Boolean(opt.topic) && !opt.outcome) ? 700 : 400,
                                  }}
                                >
                                  {opt.label}
                                </option>
                              );
                            })}
                          </select>
                        );
                      })()}
                    </div>

                    {/* Part 3: Booklet map selects */}
                    {otherBooklets.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 hover:bg-slate-100/50 p-1 rounded-xl border border-slate-200 transition-all">
                        {otherBooklets.map((bKey) => {
                          const currentVal = qData?.bookletNumbers?.[bKey] ?? "";
                          const isBookletMapped = !!currentVal;

                          const selectedNumbersInOtherQuestions = new Set<number>();
                          if (activeSubject?.name) {
                            const subjectQuestions = questions[activeSubject.name] || [];
                            for (let j = 0; j < questionCount; j++) {
                              if (j !== i) {
                                const otherQVal = subjectQuestions[j]?.bookletNumbers?.[bKey];
                                if (otherQVal) selectedNumbersInOtherQuestions.add(Number(otherQVal));
                              }
                            }
                          }

                          return (
                            <div
                              key={bKey}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border transition-all ${
                                isBookletMapped
                                  ? "bg-green-50 border-green-200 text-green-800"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              <span className={`font-extrabold text-[9px] uppercase ${isBookletMapped ? "text-green-700" : "text-slate-400"}`}>
                                {bKey}
                              </span>
                              <select
                                value={currentVal}
                                disabled={isQuestionEditingLocked}
                                onChange={(e) => {
                                  const valStr = e.target.value;
                                  const currentBookletNumbers = { ...(qData?.bookletNumbers || {}) };
                                  currentBookletNumbers[bKey] = valStr === "" ? "" : Number(valStr);
                                  updateQuestionDataAtIndex(i, "bookletNumbers", currentBookletNumbers);
                                }}
                                className={`bg-transparent border-none text-[13px] leading-none font-extrabold outline-none cursor-pointer pr-1 transition-colors ${
                                  isBookletMapped ? "text-green-800 font-extrabold" : "text-slate-700"
                                }`}
                              >
                                <option value="">({getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)})</option>
                                {Array.from({ length: questionCount }).map((_, idx) => {
                                  const optionVal = idx + 1;
                                  if (selectedNumbersInOtherQuestions.has(optionVal)) return null;
                                  return (
                                    <option key={idx} value={optionVal}>
                                      {questionNumberingMode === "continuous"
                                        ? activeSubjectStartNumber + optionVal - 1
                                        : optionVal}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {Array.from({ length: questionCount }).map((_, i) => {
                const qData = questions[activeSubject?.name]?.[i];
                const hasImage = !!qData?.imageUrl;
                const isConfigured = hasImage && !!qData?.unit;
                const currentCorrectAnswer = getQuestionCorrectAnswer(qData);
                const currentGroupId = questionGroupIdOf(qData);
                const isGroupSelectionSelected = questionGroupSelectedIndices.has(i);

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (!hasImage) return;
                      if (questionGroupSelectionMode) {
                        toggleQuestionGroupSelectionIndex(i);
                        return;
                      }
                      setQuestionPreviewIndex(i);
                    }}
                    aria-label={hasImage ? `Soru ${getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)} önizlemesini aç` : `Soru ${getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)} boş`}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${hasImage ? "hover:scale-105 cursor-pointer" : "cursor-default"} relative overflow-hidden group ${isGroupSelectionSelected ? "border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100" : isConfigured ? "border-green-500 bg-green-50" : hasImage ? "border-amber-400 bg-amber-50" : "border-dashed border-slate-300 bg-slate-50"}`}
                  >
                    {currentGroupId ? (
                      <span className="absolute right-1 top-1 z-20 inline-flex items-center gap-0.5 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow">
                        <Link2 className="h-2.5 w-2.5" /> {questionGroupSizeOf(qData) || questionGroupMembers(currentGroupId).length}
                      </span>
                    ) : null}
                    {hasImage ? (
                      <span className={`absolute bottom-1 right-1 z-20 rounded-md px-1.5 py-0.5 text-[8px] font-black shadow ${Number(qData?.columnSpan || 1) === 2 ? "bg-fuchsia-600 text-white" : "bg-slate-700/80 text-white"}`}>
                        {Number(qData?.columnSpan || 1) === 2 ? "2 SÜTUN" : "1 SÜTUN"}
                      </span>
                    ) : null}
                    {questionGroupSelectionMode && hasImage ? (
                      <span className={`absolute left-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-md border-2 text-[9px] font-black ${isGroupSelectionSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-white bg-slate-700/75 text-white"}`}>
                        {isGroupSelectionSelected ? "✓" : "+"}
                      </span>
                    ) : null}
                    {qData?.duplicateMessage ? (
                      <>
                        <div className="absolute inset-0 bg-red-100 flex flex-col items-center justify-center p-2 z-10 text-center">
                          <span className="text-xs font-black text-red-700 mb-1">{getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)}</span>
                          <span className="text-[8px] font-bold text-red-600 leading-tight">ÇAKIŞMA</span>
                        </div>
                      </>
                    ) : hasImage ? (
                      <>
                        <div
                          className="absolute inset-0 opacity-20 bg-cover bg-center"
                          style={{ backgroundImage: `url(${qData.imageUrl})` }}
                        ></div>
                        <CheckCircle2
                          className={`w-5 h-5 z-10 ${isConfigured ? "text-green-600" : "text-amber-500"}`}
                        />
                        <span className="text-xs font-black z-10 text-slate-800">
                          Soru {getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)}
                        </span>
                        {currentCorrectAnswer ? (
                          <span className="z-10 rounded-md border border-slate-300 bg-white/90 px-1.5 py-0.5 text-[9px] font-black text-slate-700 shadow-sm">
                            Cevap: {currentCorrectAnswer}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-black text-slate-400 group-hover:text-red-650">
                          {getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, i)}
                        </span>
                        <ImageIcon className="w-4 h-4 text-slate-300 group-hover:text-red-500" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Kaydet Butonu */}
          {(exam.examSource === "Basılı Yayın" || Array.from({ length: questionCount }).every((_, i) => !!questions[activeSubject?.name]?.[i]?.imageUrl)) && (
            <div className="mt-8 flex justify-center w-full">
              <button
                onClick={() => {
                  onUpdateExam(exam);
                  showToast("Sınav bilgileri ve kazanımları başarıyla kaydedildi.");
                }}
                className="bg-red-650 hover:bg-red-700 text-white px-12 py-3 rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                Girilen Bilgileri Kaydet
              </button>
            </div>
          )}
        </div>
      </div>

      </>
      ) : null}

      {/* Booklet Setup Section */}
      {activeTab === "booklets" && exam.bookletType ? (
        <div className="space-y-6">
          <div className="rounded-3xl border-2 border-black bg-white p-5 shadow-md">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-2 text-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-green-600" />
                  <h3 className="text-base font-extrabold">Her Sorudan Sonra Boş Kalacak Alan</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlaceQuestions}
                    disabled={placementLoading || bookletCreateLoading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    <ListChecks className="h-4 w-4" />
                    {placementLoading
                      ? "Sorular Yerleştiriliyor..."
                      : isQuestionPlacementReady || isLockedBookletReady
                        ? "Soruları Yeniden Yerleştir"
                        : "Soruları Yerleştir"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateBooklets}
                    disabled={!isQuestionPlacementReady || placementLoading || bookletCreateLoading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    <Save className="h-4 w-4" />
                    {bookletCreateLoading ? "Kitapçık Sabitleniyor..." : "Kitapçık Oluştur"}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleQuestionEditingLock}
                    disabled={!isLockedBookletReady || bookletCreateLoading}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 ${
                      isQuestionEditingLocked
                        ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-slate-300 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                    title={
                      !isLockedBookletReady
                        ? "Önce Kitapçık Oluştur işlemini tamamlayın"
                        : isQuestionEditingLocked
                          ? "Soru İşlemleri kilitli — açmak için tıklayın"
                          : "Soru İşlemlerini kilitle"
                    }
                    aria-label={isQuestionEditingLocked ? "Soru İşlemleri kilidini aç" : "Soru İşlemlerini kilitle"}
                  >
                    {isQuestionEditingLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {exam.examStructure?.flatMap((test: any) =>
                  (test.subjects || []).map((subj: any) => {
                    const gap = Number(exam.questionGaps?.[subj.name] ?? 4);
                    return (
                      <label
                        key={`${replaceLegacyExamTerminology(test.testName)}-${subj.name}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{subj.name}</span>
                        <input
                          type="number"
                          min="0"
                          max="70"
                          step="1"
                          value={gap}
                          onChange={(event) => {
                            const newVal = Math.max(0, Math.min(70, Number(event.target.value) || 0));
                            const newGaps = { ...(exam.questionGaps || {}) };
                            newGaps[subj.name] = newVal;
                            onUpdateExam({ ...exam, questionGaps: newGaps });
                          }}
                          className="w-20 rounded-lg border border-green-300 bg-white px-2 py-1.5 text-center text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-green-300"
                        />
                      </label>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* PDF and Outputs Dashboard Section */}
      {activeTab === "booklets" ? (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">

          {exam.examSource === "Basılı Yayın" ? (
            <div className="space-y-6">
              {/* Header with quick download action */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50/50 border border-red-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-550 animate-pulse"></span>
                    <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">Kitapçık Cevap Anahtarları</h4>
                  </div>
                  <p className="text-xs text-slate-505 font-medium leading-relaxed">
                    Aşağıda sınav kitapçıklarının soru bazlı resmi cevapları listelenmiştir. Resmi PDF sürümünü indirmek için aşağıdaki butonu kullanın.
                  </p>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  disabled={!canDownloadLockedBooklets}
                  className="flex items-center gap-1.5 px-5 py-3 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm shrink-0 whitespace-nowrap active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  <Download className="w-4 h-4" />
                  Cevap Anahtarı PDF İndir
                </button>
              </div>

              {/* Booklets Answer Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {(exam.bookletType ? exam.bookletType.split("-").map((s: string) => s.trim().toUpperCase()) : ["A"]).map((bookletKey) => (
                  <div key={bookletKey} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-green-400 transition-all duration-300">
                    <div className="space-y-4">
                      {/* Booklet Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-black text-green-750 bg-green-50 px-3 py-1.5 rounded-xl uppercase tracking-wider border border-green-200 font-sans">
                          {bookletKey} KİTAPÇIĞI
                        </span>
                        <span className="text-xs text-slate-400 font-bold font-sans">
                          Cevap Anahtarı Tablosu
                        </span>
                      </div>

                      {/* Subjects & Question Answers */}
                      <div className="space-y-4">
                        {(exam.examStructure || []).map((test: any, testIdx: number) => (
                          <div key={testIdx} className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-700 uppercase tracking-widest bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                              {replaceLegacyExamTerminology(test.testName)}
                            </h5>
                            
                            {test.subjects.map((subj: any, sIdx: number) => {
                              const totalQuestions = subj.count;
                              return (
                                <div key={sIdx} className="space-y-1.5 pl-1">
                                  {test.subjects.length > 1 && (
                                    <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                      {subj.name}
                                    </h6>
                                  )}
                                  
                                  {/* Grid of answers */}
                                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-8 gap-1.5">
                                    {Array.from({ length: totalQuestions }).map((_, qIdx) => {
                                      const originalIndex = getPrintedQuestionIndex(exam, bookletKey, qIdx + 1, subj.name, totalQuestions);
                                      const q = exam.questions?.[subj.name]?.[originalIndex];
                                      let ansVal = "-";
                                      if (q) {
                                        if (q.correctAnswer && ["A", "B", "C", "D", "E"].includes(q.correctAnswer.toUpperCase())) {
                                          ansVal = q.correctAnswer.toUpperCase();
                                        } else if (q.fileName) {
                                          const dotIndex = q.fileName.lastIndexOf('.');
                                          if (dotIndex !== -1) {
                                            const lastChar = q.fileName.slice(dotIndex - 1, dotIndex).toUpperCase();
                                            if (["A", "B", "C", "D", "E"].includes(lastChar)) {
                                              ansVal = lastChar;
                                            }
                                          }
                                        }
                                      }
                                      const qNum = qIdx + 1;
                                      
                                      return (
                                        <div 
                                          key={qIdx} 
                                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all ${
                                            ansVal !== "-"
                                              ? "bg-green-50 border-green-200 text-green-800 font-black"
                                              : "bg-slate-50 border-slate-200 text-slate-400"
                                          }`}
                                        >
                                          <span className="text-[9px] font-bold opacity-60 leading-none mb-0.5">
                                            S.{qNum}
                                          </span>
                                          <span className="text-[11px] font-extrabold tracking-tight leading-none font-sans">
                                            {ansVal}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[860px] grid-cols-4 gap-4">
                  {(exam.bookletType ? exam.bookletType.split("-").map((s: string) => s.trim()) : ["A"]).map((bookletKey) => (
                    <div
                      key={bookletKey}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-indigo-300 hover:shadow-md"
                    >
                      <h4 className="text-center text-base font-extrabold text-slate-800">
                        {bookletKey} Kitapçığı
                      </h4>

                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          onClick={() => handlePreviewBooklet(bookletKey)}
                          disabled={!canPreviewBooklets || placementLoading || bookletCreateLoading}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <Eye className="h-4 w-4" />
                          Ön İzleme
                        </button>
                        <button
                          onClick={() => handleDownloadSingleBooklet(bookletKey)}
                          disabled={!canDownloadLockedBooklets}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                        >
                          <Download className="h-4 w-4" />
                          PDF İndir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Cevap Anahtarı ve Paylaşım</h4>
                      <p className="mt-1 text-xs text-slate-550">
                        Sınav kitapçıklarının cevap anahtarını indirin veya WhatsApp ile paylaşın.
                      </p>
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={!canDownloadLockedBooklets}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <Download className="h-4 w-4" />
                      Cevap Anahtarı İndir
                    </button>
                    <button
                      onClick={handleSendWhatsApp}
                      disabled={!canDownloadLockedBooklets}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-650 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <Send className="h-4 w-4" />
                      WhatsApp ile Paylaş
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Oku-Düzenle (Eksiklikleri Tamamla) Section */}
      {activeTab === "read-edit" ? (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <label 
                  className={`flex h-11 items-center gap-3 px-3 rounded-xl border-2 transition-all cursor-pointer ${
                    txtUploadOption === "replace"
                      ? "border-green-600 bg-green-50/30 shadow-xs"
                      : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="txtUploadOption"
                    value="replace"
                    checked={txtUploadOption === "replace"}
                    onChange={() => setTxtUploadOption("replace")}
                    className="text-green-600 focus:ring-green-600 h-4 w-4 cursor-pointer"
                  />
                  <span className="font-extrabold text-slate-800 text-xs block whitespace-nowrap">Önceki Dosyaları Sil ve Yeni Dosya Ekle</span>
                </label>

                <label 
                  className={`flex h-11 items-center gap-3 px-3 rounded-xl border-2 transition-all cursor-pointer ${
                    txtUploadOption === "append"
                      ? "border-green-600 bg-green-50/30 shadow-xs"
                      : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="txtUploadOption"
                    value="append"
                    checked={txtUploadOption === "append"}
                    onChange={() => setTxtUploadOption("append")}
                    className="text-green-600 focus:ring-green-600 h-4 w-4 cursor-pointer"
                  />
                  <span className="font-extrabold text-slate-800 text-xs block whitespace-nowrap">Önceki Dosyanın Üzerine Ekle</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  id="txt-file-uploader"
                  type="file"
                  accept=".txt,text/plain"
                  ref={txtFileInputRef}
                  onChange={handleTxtFileChange}
                  className="hidden"
                />
                <button
                  id="btn-upload-txt"
                  type="button"
                  onClick={() => {
                    if (!txtUploadOption) {
                      showToast("Dosya yüklemek için lütfen önce seçeneklerden birini belirleyin!");
                      return;
                    }
                    if (txtFileInputRef.current) {
                      txtFileInputRef.current.value = "";
                      txtFileInputRef.current.click();
                    }
                  }}
                  className={`flex h-11 items-center gap-2 px-4 rounded-xl font-bold text-xs transition-colors shadow-sm whitespace-nowrap ${
                    !txtUploadOption
                      ? "bg-slate-300 hover:bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                      : "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  TXT Dosyası Yükle
                </button>
                <button
                  id="btn-save-students"
                  onClick={() => saveStudentRecords(studentRecords)}
                  disabled={getStudentRecordConflicts(studentRecords).length > 0}
                  className="flex h-11 items-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  <Save className="w-4 h-4" />
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </div>

          {/* Akıllı Asistan Paneli */}
          {(() => {
            const missingNoRecords = studentRecords.filter(r => !r.studentNumber && r.studentName);
            if (missingNoRecords.length === 0) return null;

            // Find how many have computable suggestions
            const computableSuggestionsCount = missingNoRecords.filter(r => getSmartSuggestionsForStudent(r.studentName).length > 0).length;

            return (
              <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-100/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md border border-emerald-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 Turkish">
                        Akıllı Eksik Öğrenci No Asistanı 💡
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        Öğrenci numarası boş olan <strong className="text-emerald-700">{missingNoRecords.length} öğrenci</strong> bulundu. Sistemdeki kayıtlı öğrenciler taranarak <strong className="text-indigo-700">{computableSuggestionsCount} öğrenci</strong> için ad soyad eşleşmeli numara önerileri hazırlandı!
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => {
                        let filledCount = 0;
                        const updated = studentRecords.map(rec => {
                          if (!rec.studentNumber && rec.studentName) {
                            const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                            if (suggestions.length === 1 || (suggestions.length > 1 && suggestions[0])) {
                              const bestMatch = suggestions[0];
                              filledCount++;
                              return {
                                ...rec,
                                studentNumber: bestMatch.id,
                                gradeLevel: bestMatch.classroom || rec.gradeLevel,
                                studentName: bestMatch.name || rec.studentName
                              };
                            }
                          }
                          return rec;
                        });
                        setStudentRecords(updated);
                        showToast(`Akıllı Asistan ${filledCount} eşleşmeyi otomatik tamamladı!`);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      disabled={computableSuggestionsCount === 0}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Tüm Güvenli Eşleşmeleri Doldur
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {missingNoRecords.slice(0, 6).map((rec) => {
                    const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                    return (
                      <div key={rec.id} className="bg-white border border-slate-200 p-3.5 rounded-xl text-left flex flex-col justify-between hover:border-emerald-300 transition-colors shadow-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-450 mb-1">
                            TXT Satır No: #{studentRecords.findIndex(r => r.id === rec.id) + 1}
                          </div>
                          <div className="font-extrabold text-slate-800 text-xs truncate" title={rec.studentName}>
                            🔍 {rec.studentName || "Bilinmeyen İsim"}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                          {suggestions.length === 0 ? (
                            <div className="text-[10px] font-bold text-slate-400">
                              ⚠️ Sistem de öğrenci kaydı bulunamadı
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-[9px] uppercase font-extrabold text-emerald-600 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3 text-emerald-500" />
                                Olası Eşleşmeler:
                              </div>
                              {suggestions.map((s: any) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    handleUpdateStudentField(rec.id, "studentNumber", getSystemStudentNumber(s));
                                    if (s.classroom) {
                                      handleUpdateStudentField(rec.id, "gradeLevel", s.classroom);
                                    }
                                    if (s.name) {
                                      handleUpdateStudentField(rec.id, "studentName", s.name);
                                    }
                                    showToast(`${s.name} isimli öğrenci bilgileri uygulandı.`);
                                  }}
                                  className="w-full text-left bg-emerald-50/30 hover:bg-emerald-50 border border-emerald-100/50 hover:border-emerald-200 p-1.5 rounded-lg flex items-center justify-between text-[11px] font-medium transition-colors cursor-pointer group"
                                >
                                  <div>
                                    <span className="font-mono font-bold text-slate-900">No: {s.id}</span>
                                    <p className="text-slate-600 text-[10px] font-semibold truncate max-w-[140px]">{s.name}</p>
                                  </div>
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    Eşleştir
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {missingNoRecords.length > 6 && (
                    <div className="bg-emerald-50/50 border border-emerald-100 border-dashed p-4 rounded-xl flex items-center justify-center text-center text-xs font-bold text-emerald-700">
                      ve {missingNoRecords.length - 6} daha fazla kayıt eksik...
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div id="student-table-container" className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse table-auto relative">
                <thead className="sticky top-0 bg-slate-50 z-20 shadow-xs">
                  <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-4 py-3.5 w-44">Öğrenci Numarası</th>
                    <th className="px-4 py-3.5 w-36">Sınıf Düzeyi / Şube</th>
                    <th className="px-4 py-3.5 w-36">Kitapçık Türü</th>
                    <th className="px-4 py-3.5">Öğrenci Adı Soyadı</th>
                    <th className="px-4 py-3.5">Cevap Anahtarı Karşılıkları</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer text-indigo-600 focus:ring-indigo-500 rounded border-slate-300"
                          title="Tümünü Seç / Kaldır"
                          checked={studentRecords.length > 0 && selectedStudentRecords.length === studentRecords.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentRecords(studentRecords.map((r) => r.id));
                            } else {
                              setSelectedStudentRecords([]);
                            }
                          }}
                        />
                        {selectedStudentRecords.length > 0 && (
                          <button
                            onClick={handleDeleteSelectedStudents}
                            className="text-[9px] text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100"
                            title="Seçilenleri Sil"
                          >
                            Tümünü Sil ({selectedStudentRecords.length})
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {studentRecords
                    .filter(rec => {
                      if (filterErrorType === "Tüm") return true;
                      if (filterErrorType === "Kitapçık") return !rec.bookletType;
                      if (filterErrorType === "Öğrenci No") return !String(rec.studentNumber || "").trim();
                      if (filterErrorType === "Sınıf") return !hasCompleteClassInfo(rec);
                      return true;
                    })
                    .map((rec) => {
                      const originalIndex = studentRecords.findIndex(r => r.id === rec.id);
                      const isNumMissing = !String(rec.studentNumber || "").trim();
                      const isGradeMissing = !hasCompleteClassInfo(rec);
                      const isBookletMissing = !rec.bookletType;
                      const isBookletAmbiguous = isBookletMissing && getExamBookletKeys().length > 1;
                      const validation = getRecordValidation(rec);
                      const hasRedMismatch = validation.hasMismatch;

                      const correctionOptions = hasRedMismatch
                        ? getAvailableStudentCorrectionOptions(rec)
                        : [];
                      const isCorrectionOpen = openStudentCorrectionId === rec.id;
                      const hasStudentNumberProblem = validation.reasons.some((reason) =>
                        reason.includes("Öğrenci numarası"),
                      );

                      return (
                        <React.Fragment key={rec.id}>
                        <tr
                          className={`transition-colors ${
                            hasRedMismatch
                              ? "bg-red-100/90 ring-1 ring-inset ring-red-300 hover:bg-red-100"
                              : "hover:bg-slate-50/40"
                          }`}
                          title={
                            validation.reasons.length > 0
                              ? validation.reasons.join(" ")
                              : undefined
                          }
                        >
                          <td className="px-2 py-2 text-center font-bold text-slate-400">
                            <div className="flex items-center justify-center gap-1.5">
                              <span>{originalIndex + 1}</span>
                              {hasRedMismatch && validation.reasons.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setOpenStudentCorrectionId(isCorrectionOpen ? null : rec.id)}
                                  className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[9px] font-black transition-all cursor-pointer ${
                                    isCorrectionOpen
                                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                                      : "border-red-300 bg-white text-red-600 hover:bg-red-50"
                                  }`}
                                  title={`Düzeltme seçenekleri: ${validation.reasons.join(" ")}`}
                                  aria-expanded={isCorrectionOpen}
                                >
                                  <AlertTriangle size={11} strokeWidth={2.4} />
                                  Düzelt
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.studentNumber || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "studentNumber", e.target.value)}
                            placeholder="Boş bırakılabilir"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all focus:outline-none focus:ring-1 ${
                              validation.hasMismatch
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                          {isNumMissing && rec.studentName && (() => {
                            const suggestions = getSmartSuggestionsForStudent(rec.studentName);
                            if (suggestions.length === 0) return null;
                            return (
                              <div className="mt-1.5 space-y-1 block max-w-xs">
                                <div className="text-[9px] font-black text-emerald-600 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
                                  <span>Öneri:</span>
                                </div>
                                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                  {suggestions.map((s: any) => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        handleUpdateStudentField(rec.id, "studentNumber", getSystemStudentNumber(s));
                                        if (s.classroom) {
                                          handleUpdateStudentField(rec.id, "gradeLevel", s.classroom);
                                        }
                                        if (s.name) {
                                          handleUpdateStudentField(rec.id, "studentName", s.name);
                                        }
                                        showToast(`${s.name} isimli öğrenci bilgileri uygulandı.`);
                                      }}
                                      className="text-[10px] bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 hover:border-emerald-200 text-emerald-800 font-bold px-2 py-1 rounded text-left transition-all flex items-center justify-between cursor-pointer"
                                      title="Öneriyi Uygula"
                                    >
                                      <span>
                                        No: <span className="font-mono text-emerald-950">{getSystemStudentNumber(s)}</span>
                                        <span className="ml-1 text-[9px] text-slate-500 italic font-normal">({s.name} - {s.classroom})</span>
                                      </span>
                                      <span className="text-[8px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-sm shrink-0">Seç</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.gradeLevel || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "gradeLevel", e.target.value)}
                            placeholder="Boş bırakılabilir"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold transition-all focus:outline-none focus:ring-1 ${
                              validation.hasMismatch
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.bookletType || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "bookletType", e.target.value.toUpperCase())}
                            placeholder={getDefaultBookletType() ? `Boşsa ${getDefaultBookletType()}` : "Kitapçık seçin"}
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all focus:outline-none focus:ring-1 uppercase ${
                              isBookletAmbiguous
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-slate-200 bg-white text-slate-800 focus:ring-green-600 focus:border-green-600"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.studentName || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "studentName", e.target.value)}
                            placeholder="Ad Soyad girin"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={rec.answers || ""}
                            onChange={(e) => handleUpdateStudentField(rec.id, "answers", e.target.value.toUpperCase())}
                            placeholder="Örn: ABCDE..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono transition-all focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedStudentRecords.includes(rec.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentRecords((prev) => [...prev, rec.id]);
                                } else {
                                  setSelectedStudentRecords((prev) =>
                                    prev.filter((id) => id !== rec.id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <button
                              onClick={() => handleDeleteStudent(rec.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-red-100"
                              title="Öğrenciyi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {hasRedMismatch && isCorrectionOpen && (
                        <tr className="bg-red-50/70">
                          <td colSpan={7} className="px-4 py-3 border-y border-red-200">
                            <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex items-center gap-2 text-xs font-black text-red-700">
                                    <AlertTriangle className="h-4 w-4" />
                                    Bu kaydı düzelt
                                  </div>
                                  <div className="mt-1 text-[10px] font-semibold text-slate-600">
                                    {validation.reasons.join(" • ")}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenStudentCorrectionId(null)}
                                  className="self-start rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
                                >
                                  Kapat
                                </button>
                              </div>

                              {hasStudentNumberProblem && (
                                <div className="mt-3">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-700">
                                        Sistemde henüz başka optik kaydıyla eşleşmeyen öğrenciler
                                      </div>
                                      <div className="text-[9px] font-medium text-slate-500">
                                        Ad-soyad ve sınıf bilgisi en yakın olanlar önce gösterilir. Bir öğrenciyi seçtiğinizde doğru okul numarası satıra uygulanır.
                                      </div>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 border border-emerald-100">
                                      {correctionOptions.length} öneri
                                    </span>
                                  </div>
                                  {correctionOptions.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                      {correctionOptions.map((option: any) => (
                                        <button
                                          key={`${rec.id}-${option.number}`}
                                          type="button"
                                          onClick={() => applySystemStudentCorrection(rec.id, option.student)}
                                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-black text-slate-900 truncate">{option.name || "İsimsiz öğrenci"}</span>
                                            <span className="shrink-0 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-700">
                                              {option.number}
                                            </span>
                                          </div>
                                          <div className="mt-1 text-[9px] font-semibold text-slate-500">
                                            {option.classroom || "Sınıf bilgisi yok"}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[10px] font-semibold text-slate-500">
                                      Başka optik kaydıyla eşleşmemiş uygun öğrenci bulunamadı.
                                    </div>
                                  )}
                                </div>
                              )}

                              {isBookletMissing && (
                                <div className="mt-3 border-t border-slate-100 pt-3">
                                  <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-700">
                                    Kitapçık türünü seç
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {getExamBookletKeys().map((bookletKey) => (
                                      <button
                                        key={`${rec.id}-${bookletKey}`}
                                        type="button"
                                        onClick={() => {
                                          handleUpdateStudentField(rec.id, "bookletType", bookletKey);
                                          setOpenStudentCorrectionId(null);
                                        }}
                                        className="min-w-12 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                                      >
                                        {bookletKey}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                        </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Çelişkiler ve Çakışmalar Alanı */}
            {(() => {
              const conflictDetails = getStudentRecordConflicts(studentRecords);
              const hasConflicts = conflictDetails.length > 0;

              return (
                <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className={`w-6 h-6 ${hasConflicts ? 'text-red-500' : 'text-amber-500'}`} />
                        Çelişkiler ve Çakışmalar
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Öğrenci optik formlarındaki olası uyumsuzlukları ve çakışmaları inceleyin.
                      </p>
                    </div>
                    <button
                      onClick={() => saveStudentRecords(studentRecords)}
                      disabled={hasConflicts}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                    >
                      <Save className="w-4 h-4" />
                      Değişiklikleri Kaydet
                    </button>
                  </div>
                  <div className={`mt-6 border-2 ${hasConflicts ? 'border-red-200 bg-red-50' : 'border-dashed border-slate-200 bg-slate-50'} rounded-2xl p-6 text-center`}>
                    {!hasConflicts ? (
                      <p className="text-sm font-semibold text-slate-500 py-2">
                        Şu an için çelişki veya çakışma tespit edilmedi.
                      </p>
                    ) : (
                      <div className="text-left space-y-4">
                        <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                          <AlertTriangle className="w-5 h-5" />
                          <span>Kaydetmeden Önce Düzeltilmesi Gereken Çelişkiler Var</span>
                        </div>
                        <div className="overflow-hidden border border-red-200 rounded-xl">
                          <table className="w-full text-left text-xs bg-white">
                            <thead className="bg-red-50 text-red-800 font-bold border-b border-red-200">
                              <tr>
                                <th className="px-4 py-2">Öğrenci Numarası</th>
                                <th className="px-4 py-2">Çelişki / Çakışma</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 text-slate-700">
                              {conflictDetails.map((item, index) => (
                                <tr key={`${item.recordId}-${index}`}>
                                  <td className="px-4 py-2 font-bold text-slate-800">
                                    {String(item.studentNumber || "").trim() || "Numara yok"}
                                  </td>
                                  <td className="px-4 py-2 font-semibold text-red-700">
                                    {item.reasons.join(" • ")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

        </div>
      ) : null}

      {activeTab === "evaluate" ? (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-green-600" />
                Sınavı Değerlendir
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Okutulan optik form sonuçlarına göre sınav istatistiklerini ve raporları görüntüleyin.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex-1 w-full">
              <div className="flex flex-col gap-3">
                <label 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    evaluateOption === "new"
                      ? "border-green-600 bg-white shadow-xs"
                      : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="evaluateOption"
                    value="new"
                    checked={evaluateOption === "new"}
                    onChange={() => setEvaluateOption("new")}
                    className="text-green-600 focus:ring-green-600 h-4 w-4"
                  />
                  <span className="font-extrabold text-slate-800 text-xs block">Yeni Eklenen Dosyaları Değerlendir</span>
                </label>

                <label 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    evaluateOption === "all"
                      ? "border-green-600 bg-white shadow-xs"
                      : "border-slate-200/70 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="evaluateOption"
                    value="all"
                    checked={evaluateOption === "all"}
                    onChange={() => setEvaluateOption("all")}
                    className="text-green-600 focus:ring-green-600 h-4 w-4"
                  />
                  <span className="font-extrabold text-slate-800 text-xs block">Tüm Dosyaları Tekrar Değerlendir</span>
                </label>
              </div>
            </div>

            {evaluateOption && (
              <div className="flex items-center md:items-end h-full">
                <button
                  onClick={async () => {
                    if (evaluationBusy) return;
                    setEvaluationBusy(true);
                    try {
                      const { fetchCollectionFromLocalDatabase, upsertLocalDocument } = await import("../lib/localDatabase");
                      // Mobil elektronik optikler doğrudan sunucudaki sınava kaydolur.
                      // Yerel TXT listesi eski ya da boş olabilir: değerlendirme öncesinde
                      // gerçek gönderimleri kayıpsız olarak sunucudan yeniden oku.
                      const storedExams = await fetchCollectionFromLocalDatabase("exams");
                      const serverExam = (Array.isArray(storedExams) ? storedExams : []).find(
                        (entry: any) => String(entry?.id || "") === String(exam.id),
                      );
                      if (!serverExam) throw new Error("Sınavın sunucu kaydı bulunamadı.");
                      const serverRecords = Array.isArray(serverExam.studentTxtRecords) ? serverExam.studentTxtRecords : [];
                      const localRecords = Array.isArray(studentRecords) ? studentRecords : [];
                      const isElectronicExam = String(exam?.answeringMethod || serverExam?.answeringMethod || "").toLocaleLowerCase("tr-TR") === "elektronik" ||
                        serverRecords.some((record: any) => record?.source === "electronic-optic");
                      const recordById = new Map<string, any>();
                      for (const record of [...localRecords, ...serverRecords]) {
                        const id = String(record?.id || record?.studentNumber || "").trim();
                        if (id) recordById.set(id, record);
                      }
                      const records = Array.from(recordById.values());
                      if (!records.length) {
                        throw new Error(isElectronicExam
                          ? "Henüz elektronik cevap gönderen öğrenci bulunmuyor. Önce katılım kayıtlarını yenileyin."
                          : "Değerlendirilecek öğrenci TXT kaydı bulunamadı.");
                      }
                      const conflicts = getStudentRecordConflicts(records);
                      if (conflicts.length > 0) {
                        throw new Error("Öğrenci numarası veya kitapçık bilgisinde çakışan kayıtlar var. Değerlendirmeden önce düzeltin.");
                      }
                      const normalizedRecords = records.map((record: any) => {
                        const enriched = enrichRecordFromSystem(record);
                        return {
                          ...enriched,
                          bookletType: String(enriched?.bookletType || "").trim().toLocaleUpperCase("tr-TR") || getDefaultBookletType(),
                          fieldValues: enriched?.fieldValues && typeof enriched.fieldValues === "object" ? { ...enriched.fieldValues } : {},
                          answerFields: enriched?.answerFields && typeof enriched.answerFields === "object" ? { ...enriched.answerFields } : {},
                        };
                      });
                      const opticTemplateSnapshot = await loadSelectedOpticTemplate();
                      const upgradedBookletLayoutLock = await upgradeBookletLayoutLockForEvaluation();
                      const examForEvaluation = {
                        ...serverExam,
                        ...exam,
                        studentTxtRecords: normalizedRecords,
                        bookletLayoutLock: upgradedBookletLayoutLock || exam?.bookletLayoutLock || serverExam?.bookletLayoutLock,
                        opticTemplate: exam?.opticTemplate || serverExam?.opticTemplate ||
                          (opticTemplateSnapshot ? JSON.parse(JSON.stringify(opticTemplateSnapshot)) : null),
                        evaluationInputSnapshot: {
                          studentTxtRecords: JSON.parse(JSON.stringify(normalizedRecords)),
                          opticTemplate: opticTemplateSnapshot ? JSON.parse(JSON.stringify(opticTemplateSnapshot)) : exam?.opticTemplate || serverExam?.opticTemplate || null,
                          capturedAt: new Date().toISOString(),
                        },
                        isEvaluated: true,
                        examStatus: "Değerlendirildi",
                        evaluatedAt: new Date().toISOString(),
                      };
                      (examForEvaluation as any).evaluationResults = evaluateExamRecords(examForEvaluation);
                      if (!(examForEvaluation as any).evaluationResults?.length) {
                        throw new Error("Öğrenci kayıtlarından değerlendirme sonucu üretilemedi.");
                      }
                      // Başarı yalnızca sunucu yazmayı onayladıktan sonra gösterilir.
                      await upsertLocalDocument("exams", String(exam.id), examForEvaluation);
                      onUpdateExam(examForEvaluation);
                      setStudentRecords(normalizedRecords);
                      setShowEvaluateSuccessModal(true);
                    } catch (error: any) {
                      console.error("Sınav değerlendirme hatası:", error);
                      showToast(error?.message || "Sınav değerlendirme işlemi tamamlanamadı.");
                    } finally {
                      setEvaluationBusy(false);
                    }
                  }}
                  disabled={evaluationBusy}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-extrabold text-sm transition-colors shadow-sm cursor-pointer whitespace-nowrap h-full disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  <BarChart2 className="w-5 h-5" />
                  {evaluationBusy ? "Değerlendiriliyor…" : "Sınavı Değerlendir"}
                </button>
              </div>
            )}
          </div>
          
        </div>
      ) : null}



      {questionGroupEditorOpen && activeSubject ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-indigo-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Link2 className="h-5 w-5 text-indigo-600" />
                  {questionGroupEditingId ? "Soru Grubunu Düzenle" : "Ortak Yönerge / Soru Grubu"}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">
                  {questionGroupSelectedIndices.size} soru bu yönergeye bağlı. Yönerge soru sayısına dahil edilmez.
                </div>
              </div>
              <button type="button" onClick={() => setQuestionGroupEditorOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700">Grup Başlığı <span className="font-semibold text-slate-400">(isteğe bağlı)</span></label>
                  <input
                    value={questionGroupDraft.title}
                    onChange={(event) => setQuestionGroupDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Örn. Harita yorumlama soruları"
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700">Grup Davranışı</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionGroupDraft((current) => ({ ...current, mode: "required" }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${questionGroupDraft.mode === "required" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      Zorunlu Grup
                      <span className="mt-0.5 block text-[9px] font-semibold opacity-70">Bir soru seçilince tümü seçilir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionGroupDraft((current) => ({ ...current, mode: "free" }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${questionGroupDraft.mode === "free" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      Serbest Grup
                      <span className="mt-0.5 block text-[9px] font-semibold opacity-70">Aynı yönergeden tek tek seçilebilir</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-700">PDF Yerleşimi</label>
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setQuestionGroupDraft((current) => ({ ...current, layout: "normal" }))}
                    className={`rounded-xl border-2 px-3 py-3 text-left text-xs font-black ${questionGroupDraft.layout === "normal" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    Normal · 1 Sütun
                    <span className="mt-1 block text-[9px] font-semibold opacity-70">Yönerge ve bağlı sorular mevcut tek sütun akışında kalır.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionGroupDraft((current) => ({ ...current, layout: "full-width-source" }))}
                    className={`rounded-xl border-2 px-3 py-3 text-left text-xs font-black ${questionGroupDraft.layout === "full-width-source" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    2 Sütun · Tam Genişlik + Alt Sorular
                    <span className="mt-1 block text-[9px] font-semibold opacity-70">Ortak metin/görsel iki sütunu kaplar; bağlı sorular hemen altında tekrar iki sütuna dağıtılır.</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-700">Yönerge / Açıklama</label>
                <textarea
                  value={questionGroupDraft.instructionText}
                  onChange={(event) => setQuestionGroupDraft((current) => ({ ...current, instructionText: event.target.value }))}
                  rows={5}
                  placeholder="Örn. Aşağıdaki harita ve açıklamadan yararlanarak soruları cevaplayınız."
                  className="w-full resize-y rounded-2xl border-2 border-slate-200 px-3 py-3 text-sm font-semibold leading-relaxed outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700">Yönerge Görseli <span className="font-semibold text-slate-400">(isteğe bağlı)</span></label>
                  {questionGroupDraft.instructionImageUrl ? (
                    <button type="button" onClick={() => setQuestionGroupDraft((current) => ({ ...current, instructionImageUrl: "" }))} className="text-[10px] font-black text-rose-600 hover:underline">Görseli kaldır</button>
                  ) : null}
                </div>
                <input ref={questionGroupImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleQuestionGroupInstructionImage} />
                {questionGroupDraft.instructionImageUrl ? (
                  <button type="button" onClick={() => questionGroupImageInputRef.current?.click()} className="flex min-h-36 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-3">
                    <img src={questionGroupDraft.instructionImageUrl} alt="Yönerge görseli" className="max-h-64 w-full object-contain" />
                  </button>
                ) : (
                  <button type="button" onClick={() => questionGroupImageInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 px-4 py-6 text-xs font-black text-indigo-700 hover:bg-indigo-50">
                    <UploadCloud className="h-4 w-4" /> Yönerge Görseli Yükle
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Kitapçıkta Görünüm</div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  N–M. soruları aşağıdaki açıklamaya göre cevaplayınız.
                </div>
                <div className="mt-1 text-[11px] font-semibold text-slate-600">
                  {questionGroupDraft.layout === "full-width-source"
                    ? "Yönerge/görsel sayfanın iki sütununu birden kaplar. Bağlı sorular aynı kaynağın hemen altında sol sütundan başlayarak sağ sütuna devam eder; blok önceki soruların yanına sıkıştırılmaz."
                    : "N ve M kitapçık yerleşiminden sonra otomatik hesaplanır. Grup hangi kitapçıkta nereye taşınırsa taşınsın yönerge ve bağlı sorular peş peşe kalır."}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <div>
                {questionGroupEditingId ? (
                  <button type="button" onClick={() => void dissolveQuestionGroup()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100">Grubu Çöz</button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuestionGroupEditorOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Vazgeç</button>
                <button type="button" onClick={() => void saveQuestionGroup()} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700">{questionGroupEditingId ? "Grubu Güncelle" : "Grubu Kaydet"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {systemQuestionModalOpen && (() => {
        const questionKey = (q: any, index: number) => String(
          q?.id ||
          q?.questionId ||
          q?.question_id ||
          q?.key ||
          q?.questionCode ||
          q?.question_code ||
          q?.code ||
          q?.storagePath ||
          q?.fileName ||
          `question-${index}`,
        );
        // Ünite Denemesi ekranında adlar soru kayıtlarından değil, GÜNCEL müfredat
        // ağacından çözülür. Bazı eski soru kayıtlarında yalnız ID vardır; bu durumda
        // ekranda "Konu" / "Kazanım" gibi genel etiketler görünmemelidir.
        const modalScopeUnit = (activeCurriculumScopes || [])[0] || {};
        const wantedGrade = normalizeGradeLevel(exam?.gradeLevel);
        const wantedUnitName = normalizeSystemQuestionLabel(modalScopeUnit?.unitName || "");
        const wantedUnitId = String(modalScopeUnit?.unitId || "").trim();
        let modalCurriculumTree = Array.isArray(curriculumTree) ? curriculumTree : [];

        const treeHasWantedUnit = (tree: any[]) => (tree || []).some((unit: any) => {
          const sameId = Boolean(wantedUnitId && String(unit?.id || "").trim() === wantedUnitId);
          const sameName = Boolean(wantedUnitName && normalizeSystemQuestionLabel(unit?.name) === wantedUnitName);
          return sameId || sameName;
        });

        // Ders kimliği eski bir alias yüzünden çözülememiş olsa bile, sunucudan gelen
        // authoritative store içindeki aynı sınıf + aynı üniteyi bularak gerçek
        // konu/kazanım adlarını kullan. Bu yalnız görüntü fallback'idir; veri kaynağı
        // yine tek authoritative curriculum store'dur.
        if (!treeHasWantedUnit(modalCurriculumTree) && (wantedUnitId || wantedUnitName)) {
          for (const curriculum of Object.values(authoritativeCurriculumStore || {})) {
            if (!curriculum || typeof curriculum !== "object") continue;
            const metaGrade = normalizeGradeLevel((curriculum as any)?.__curriculumMeta?.grade || (curriculum as any)?.grade || (curriculum as any)?.gradeLevel);
            if (wantedGrade && metaGrade && wantedGrade !== metaGrade) continue;
            const candidateTree = mapCurriculumUnits((curriculum as any)?.units || []);
            if (treeHasWantedUnit(candidateTree)) {
              modalCurriculumTree = candidateTree;
              break;
            }
          }
        }

        const curriculumUnitNameById = new Map<string, string>();
        const curriculumTopicNameById = new Map<string, string>();
        const curriculumOutcomeNameById = new Map<string, string>();
        (modalCurriculumTree || []).forEach((unit: any) => {
          const uid = String(unit?.id || "").trim();
          if (uid) curriculumUnitNameById.set(uid, String(unit?.name || uid));
          (unit?.topics || []).forEach((topic: any) => {
            const tid = String(topic?.id || "").trim();
            if (tid) curriculumTopicNameById.set(tid, String(topic?.name || tid));
            (topic?.outcomes || []).forEach((outcome: any) => {
              const oid = String(outcome?.id || "").trim();
              if (oid) curriculumOutcomeNameById.set(oid, String(outcome?.name || oid));
            });
          });
        });

        // Canonical soru API'si ünite/konu/kazanım ADLARINI değil yalnız kimlikleri
        // döndürüyor. Müfredat satırları ise adları taşıyor. Önceki karşılaştırmada
        // müfredat satırı `name:...`, soru satırı ise `9.3.1...` anahtarıyla tutulduğu
        // için aynı kazanımın soruları ekranda 0/0 görünüyordu. Kimliği güncel
        // müfredat adlarına çevirip iki kaynağı aynı kararlı anahtarda buluştur.
        const rawUnitId = (q: any) => String(q?.unitId || q?.unit_id || q?.systemUnitId || "").trim();
        const rawTopicId = (q: any) => String(q?.topicId || q?.topic_id || q?.systemTopicId || "").trim();
        const rawOutcomeId = (q: any) => String(q?.outcomeId || q?.outcome_id || q?.systemOutcomeId || "").trim();

        const unitLabel = (q: any) => String(
          q?.unitName || q?.unit_name || q?.unit || q?.systemUnitName ||
          curriculumUnitNameById.get(rawUnitId(q)) || modalScopeUnit?.unitName || "Ünite"
        );
        const topicLabel = (q: any) => String(
          q?.topicName || q?.topic_name || q?.topic || q?.systemTopicName ||
          curriculumTopicNameById.get(rawTopicId(q)) || "Konu"
        );
        const outcomeLabel = (q: any) => String(
          q?.outcomeName || q?.outcome_name || q?.outcome || q?.systemOutcomeName ||
          curriculumOutcomeNameById.get(rawOutcomeId(q)) || "Kazanım"
        );

        const stableCurriculumValue = (label: unknown, rawId: string) => {
          const normalized = normalizeSystemQuestionLabel(label);
          return normalized ? `name:${normalized}` : rawId;
        };
        const unitValue = (q: any) => stableCurriculumValue(unitLabel(q), rawUnitId(q));
        const topicValue = (q: any) => stableCurriculumValue(topicLabel(q), rawTopicId(q));
        const outcomeValue = (q: any) => stableCurriculumValue(outcomeLabel(q), rawOutcomeId(q));
        const imageOf = (q: any) => String(q?.imageUrl || q?.image_url || q?.imageDataUrl || q?.thumbnailUrl || q?.thumbnail_url || "").trim();

        const uniqueOptions = (rows: any[], valueOf: (q: any) => string, labelOf: (q: any) => string) => {
          const map = new Map<string, string>();
          rows.forEach((q) => {
            const value = valueOf(q);
            if (value && !map.has(value)) map.set(value, labelOf(q));
          });
          return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
        };

        // Sınavda yalnız ünite seçilmişse o ünitenin TÜM konu ve kazanımlarını,
        // yalnız konu seçilmişse o konunun TÜM kazanımlarını gerçek müfredat ağacından
        // genişlet. Böylece soru sayısı 0 olan başlıklar da ekranda kaybolmaz.
        const pickerCurriculumScopes = (() => {
          if (!isUnitScanExam) return activeCurriculumScopes;
          const unitMap = new Map<string, any>();
          (activeCurriculumScopes || []).forEach((scope: any) => {
            const key = String(scope?.unitId || "").trim() || `name:${normalizeSystemQuestionLabel(scope?.unitName)}`;
            if (key && !unitMap.has(key)) {
              unitMap.set(key, { ...scope, topicId: "", topicName: "", outcomeId: "", outcomeName: "", scopeType: "unit", includeAllTopics: true, includeAllOutcomes: true });
            }
          });
          return Array.from(unitMap.values());
        })();
        const curriculumOptionRows: any[] = [];
        const sameCurriculumNode = (idA: any, nameA: any, idB: any, nameB: any) => {
          const aId = String(idA || "").trim();
          const bId = String(idB || "").trim();
          if (aId && bId && aId === bId) return true;
          const aName = normalizeSystemQuestionLabel(nameA);
          const bName = normalizeSystemQuestionLabel(nameB);
          return Boolean(aName && bName && aName === bName);
        };

        pickerCurriculumScopes.forEach((scope: any) => {
          const unit = (modalCurriculumTree || []).find((row: any) =>
            sameCurriculumNode(scope?.unitId, scope?.unitName, row?.id, row?.name),
          );

          if (!unit) {
            curriculumOptionRows.push({
              unitId: scope?.unitId || "", unitName: scope?.unitName || "",
              topicId: scope?.topicId || "", topicName: scope?.topicName || "",
              outcomeId: scope?.outcomeId || "", outcomeName: scope?.outcomeName || "",
              __curriculumOnly: true,
            });
            return;
          }

          const selectedTopic = scope?.topicId || scope?.topicName
            ? (unit.topics || []).find((row: any) =>
                sameCurriculumNode(scope?.topicId, scope?.topicName, row?.id, row?.name),
              )
            : null;

          const pushTopic = (topic: any) => {
            const selectedOutcome = scope?.outcomeId || scope?.outcomeName
              ? (topic.outcomes || []).find((row: any) =>
                  sameCurriculumNode(scope?.outcomeId, scope?.outcomeName, row?.id, row?.name),
                )
              : null;
            const outcomes = selectedOutcome ? [selectedOutcome] : (topic.outcomes || []);

            if (!outcomes.length) {
              curriculumOptionRows.push({
                unitId: unit.id, unitName: unit.name,
                topicId: topic.id, topicName: topic.name,
                outcomeId: "", outcomeName: "", __curriculumOnly: true,
              });
              return;
            }
            outcomes.forEach((outcome: any) => curriculumOptionRows.push({
              unitId: unit.id, unitName: unit.name,
              topicId: topic.id, topicName: topic.name,
              outcomeId: outcome.id, outcomeName: outcome.name, __curriculumOnly: true,
            }));
          };

          if (selectedTopic) {
            pushTopic(selectedTopic);
          } else {
            (unit.topics || []).forEach(pushTopic);
          }
        });

        // Müfredat ağacı bulunamazsa en azından sınavda kaydedilmiş kapsamı göster.
        if (curriculumOptionRows.length === 0) {
          pickerCurriculumScopes.forEach((scope: any) => curriculumOptionRows.push({
            unitId: scope?.unitId || "", unitName: scope?.unitName || "",
            topicId: scope?.topicId || "", topicName: scope?.topicName || "",
            outcomeId: scope?.outcomeId || "", outcomeName: scope?.outcomeName || "",
            __curriculumOnly: true,
          }));
        }
        // Bu açılır pencerede ünite listesi yalnız sınav hazırlanırken seçilmiş
        // ünitelerden oluşur. Konu ve kazanım seçenekleri de soldan sağa seçime göre
        // daralır; soru alanı yalnız kazanım seçildikten sonra açılır.
        const selectedExamUnitOptions = uniqueOptions(
          curriculumOptionRows.length > 0 ? curriculumOptionRows : pickerCurriculumScopes,
          unitValue,
          unitLabel,
        );
        const unitOptions = selectedExamUnitOptions;
        const unitFiltered = systemUnitId
          ? systemQuestions.filter((q: any) => unitValue(q) === systemUnitId)
          : [];
        const curriculumUnitFiltered = systemUnitId
          ? curriculumOptionRows.filter((q: any) => unitValue(q) === systemUnitId)
          : [];
        const topicOptions = systemUnitId
          ? uniqueOptions([...curriculumUnitFiltered, ...unitFiltered], topicValue, topicLabel)
          : [];
        const topicFiltered = systemTopicId
          ? unitFiltered.filter((q: any) => topicValue(q) === systemTopicId)
          : [];
        const curriculumTopicFiltered = systemTopicId
          ? curriculumUnitFiltered.filter((q: any) => topicValue(q) === systemTopicId)
          : [];
        const outcomeOptions = systemTopicId
          ? uniqueOptions([...curriculumTopicFiltered, ...topicFiltered], outcomeValue, outcomeLabel)
          : [];
        const visibleQuestions = systemOutcomeId
          ? groupQuestionRowsContiguously(
              topicFiltered.filter((q: any) => outcomeValue(q) === systemOutcomeId),
            )
          : [];

        const countQuestions = (predicate: (question: any) => boolean) => systemQuestions.filter(predicate).length;
        const unitCount = (value: string) => countQuestions((question: any) => unitValue(question) === value);
        const topicCount = (value: string) => countQuestions((question: any) =>
          (!systemUnitId || unitValue(question) === systemUnitId) && topicValue(question) === value,
        );
        const outcomeCount = (value: string) => countQuestions((question: any) =>
          (!systemUnitId || unitValue(question) === systemUnitId) &&
          (!systemTopicId || topicValue(question) === systemTopicId) &&
          outcomeValue(question) === value,
        );

        // Seçim Set'i tüm kazanımlar için ortaktır. Filtre/kazanım değiştiğinde bu Set
        // yeniden oluşturulmadığı için önceki tikler korunur. Aşağıdaki sayaçlar da
        // aynı global seçim üzerinden hesaplanır.
        const draftSelectedRows = systemQuestions.filter((question: any, index: number) =>
          selectedSystemQuestionIds.has(questionKey(question, index)),
        );
        const existingExamSelectedRows = Object.values((questions as any)?.[currentSubjectName] || {})
          .filter((question: any) => question?.imageUrl)
          .map((question: any) => ({
            ...question,
            unitId: question?.systemUnitId || question?.unitId || "",
            unitName: question?.unitName || question?.unit || "",
            topicId: question?.systemTopicId || question?.topicId || "",
            topicName: question?.topicName || question?.topic || "",
            outcomeId: question?.systemOutcomeId || question?.outcomeId || "",
            outcomeName: question?.outcomeName || question?.outcome || "",
          }));
        const selectedQuestionRows = [...existingExamSelectedRows, ...draftSelectedRows];
        const selectedTopicCount = (value: string) => selectedQuestionRows.filter((question: any) =>
          (!systemUnitId || unitValue(question) === systemUnitId) && topicValue(question) === value,
        ).length;
        const selectedOutcomeCount = (topic: string, outcome: string) => selectedQuestionRows.filter((question: any) =>
          (!systemUnitId || unitValue(question) === systemUnitId) && topicValue(question) === topic && outcomeValue(question) === outcome,
        ).length;

        // Payda, öğretmen ekranındaki gibi "bu kapsamda toplam kullanılabilir havuz"u
        // gösterir. Sınava daha önce eklenip usage=used olduğu için API'nin unused
        // listesinden düşen soruları da havuz toplamına geri ekleriz; böylece 1/51
        // seçim sonrası 1/50'ye dönüşmez.
        const poolIdentity = (question: any, index = 0) => String(
          question?.systemQuestionId || question?.id || question?.questionId || question?.question_id ||
          question?.key || question?.questionCode || question?.question_code || question?.code ||
          question?.storagePath || question?.fileName || `pool-${index}`,
        );
        const availablePoolIds = new Set(systemQuestions.map((question: any, index: number) => poolIdentity(question, index)));
        const existingRowsOutsideUnusedPool = existingExamSelectedRows.filter((question: any, index: number) =>
          !availablePoolIds.has(poolIdentity(question, index)),
        );
        const topicPoolCount = (topic: string, availableCount: number) =>
          availableCount + existingRowsOutsideUnusedPool.filter((question: any) =>
            (!systemUnitId || unitValue(question) === systemUnitId) && topicValue(question) === topic,
          ).length;
        const outcomePoolCount = (topic: string, outcome: string, availableCount: number) =>
          availableCount + existingRowsOutsideUnusedPool.filter((question: any) =>
            (!systemUnitId || unitValue(question) === systemUnitId) &&
            topicValue(question) === topic && outcomeValue(question) === outcome,
          ).length;

        const activeSubjectQuestions = Object.values((questions as any)?.[currentSubjectName] || {}).filter(
          (question: any) => question?.imageUrl,
        ).length;
        const remainingSystemQuestionCapacity = isFlexibleCourseBasedExam
          ? Number.POSITIVE_INFINITY
          : Math.max(0, Number(questionCount || 0) - activeSubjectQuestions);

        // Seçilen sınav kapsamını ağaç halinde göster. Önce gerçek müfredat satırlarını
        // ekleyerek 0 sorulu konu/kazanımları koru; ardından soru bankasındaki kayıtlarla
        // adetleri artır.
        const hierarchyCurriculumRows = systemUnitId
          ? curriculumOptionRows.filter((row: any) => unitValue(row) === systemUnitId)
          : curriculumOptionRows;
        const hierarchyQuestions = systemUnitId
          ? systemQuestions.filter((question: any) => unitValue(question) === systemUnitId)
          : systemQuestions;
        const hierarchyTopicMap = new Map<string, { value: string; label: string; count: number; outcomes: Map<string, { value: string; label: string; count: number }> }>();

        hierarchyCurriculumRows.forEach((row: any) => {
          const tValue = topicValue(row);
          if (!tValue) return;
          if (!hierarchyTopicMap.has(tValue)) {
            hierarchyTopicMap.set(tValue, { value: tValue, label: topicLabel(row), count: 0, outcomes: new Map() });
          }
          const topicNode = hierarchyTopicMap.get(tValue)!;
          const oValue = outcomeValue(row);
          if (oValue && !topicNode.outcomes.has(oValue)) {
            topicNode.outcomes.set(oValue, { value: oValue, label: outcomeLabel(row), count: 0 });
          }
        });

        hierarchyQuestions.forEach((question: any) => {
          const tValue = topicValue(question);
          if (!tValue) return;
          if (!hierarchyTopicMap.has(tValue)) {
            hierarchyTopicMap.set(tValue, { value: tValue, label: topicLabel(question), count: 0, outcomes: new Map() });
          }
          const topicNode = hierarchyTopicMap.get(tValue)!;
          topicNode.count += 1;
          const oValue = outcomeValue(question);
          if (!oValue) return;
          if (!topicNode.outcomes.has(oValue)) {
            topicNode.outcomes.set(oValue, { value: oValue, label: outcomeLabel(question), count: 0 });
          }
          topicNode.outcomes.get(oValue)!.count += 1;
        });
        const hierarchyTopics = Array.from(hierarchyTopicMap.values())
          .filter((topic) => isUnitScanExam || !systemTopicId || topic.value === systemTopicId);
        const topicRequiresOutcomeChoice = Boolean(
          systemTopicId &&
          !systemOutcomeId &&
          hierarchyTopics.some((topic) => topic.value === systemTopicId && topic.outcomes.size > 0),
        );
        const selectedUnitLabel = (() => {
          if (isUnitScanExam && pickerCurriculumScopes.length > 1 && !systemUnitId) {
            const names = pickerCurriculumScopes
              .map((scope: any) => {
                const wantedId = String(scope?.unitId || "").trim();
                const wantedName = normalizeSystemQuestionLabel(scope?.unitName || "");
                const matched = (modalCurriculumTree || []).find((unit: any) =>
                  (wantedId && String(unit?.id || "").trim() === wantedId) ||
                  (wantedName && normalizeSystemQuestionLabel(unit?.name) === wantedName),
                );
                return String(matched?.name || scope?.unitName || "").trim();
              })
              .filter(Boolean);
            return names.join(" • ") || "Üniteler";
          }

          const scope = pickerCurriculumScopes?.[0] || {};
          const wantedId = String(systemUnitId || scope?.unitId || "").trim();
          const wantedName = normalizeSystemQuestionLabel(scope?.unitName || "");
          const matched = (modalCurriculumTree || []).find((unit: any) =>
            (wantedId && String(unit?.id || "").trim() === wantedId) ||
            (wantedName && normalizeSystemQuestionLabel(unit?.name) === wantedName),
          );
          return String(
            matched?.name ||
            unitOptions.find((option) => option.value === systemUnitId)?.label ||
            scope?.unitName ||
            "Ünite"
          );
        })();

        return (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setSystemQuestionModalOpen(false);
                  setSelectedSystemQuestionIds(new Set());
                }}
                className="absolute right-4 top-4 z-20 rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                aria-label="Kapat"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 pr-16 md:grid-cols-3">
                <label>
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ünite</span>
                  <select
                    value={systemUnitId}
                    onChange={(event) => {
                      setSystemUnitId(event.target.value);
                      setSystemTopicId("");
                      setSystemOutcomeId("");
                      setSystemQuestionViewerIndex(0);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Ünite seçiniz</option>
                    {selectedExamUnitOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Konu</span>
                  <select
                    value={systemTopicId}
                    disabled={!systemUnitId}
                    onChange={(event) => {
                      setSystemTopicId(event.target.value);
                      setSystemOutcomeId("");
                      setSystemQuestionViewerIndex(0);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{systemUnitId ? "Konu seçiniz" : "Önce ünite seçiniz"}</option>
                    {topicOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Kazanım</span>
                  <select
                    value={systemOutcomeId}
                    disabled={!systemTopicId}
                    onChange={(event) => {
                      setSystemOutcomeId(event.target.value);
                      setSystemQuestionViewerIndex(0);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{systemTopicId ? "Kazanım seçiniz" : "Önce konu seçiniz"}</option>
                    {outcomeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label} ({outcomeCount(option.value)} soru)</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {systemQuestionsLoading ? (
                  <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 text-sm font-bold text-emerald-700">
                    Sistem soru bankası okunuyor…
                  </div>
                ) : systemQuestions.length === 0 ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                    <BookOpen className="mb-3 h-10 w-10 text-slate-300" />
                    <div className="text-sm font-extrabold text-slate-700">Bu sınav kapsamı için sistemde soru bulunamadı.</div>
                  </div>
                ) : !systemUnitId ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-6 text-center text-sm font-extrabold text-slate-600">
                    Yukarıdan ünite seçiniz.
                  </div>
                ) : !systemTopicId ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-6 text-center text-sm font-extrabold text-slate-600">
                    Seçtiğiniz ünitenin konularından birini seçiniz.
                  </div>
                ) : !systemOutcomeId ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-6 text-center text-sm font-extrabold text-slate-600">
                    Seçtiğiniz konunun kazanımlarından birini seçiniz.
                  </div>
                ) : visibleQuestions.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-500">
                    Seçtiğiniz ünite / konu / kazanım için soru bulunamadı.
                  </div>
                ) : (() => {
                  const safeViewerIndex = Math.max(0, Math.min(systemQuestionViewerIndex, visibleQuestions.length - 1));
                  const question = visibleQuestions[safeViewerIndex];
                  const absoluteIndex = systemQuestions.indexOf(question);
                  const key = questionKey(question, absoluteIndex);
                  const selected = selectedSystemQuestionIds.has(key);
                  const imageUrl = imageOf(question);
                  const currentGroupId = questionGroupIdOf(question);
                  const currentGroupMode = questionGroupModeOf(question);
                  const currentGroupExpectedSize = questionGroupSizeOf(question);
                  const currentGroupMembers = currentGroupId
                    ? systemQuestions
                        .map((row: any, index: number) => ({ row, index }))
                        .filter(({ row }) => questionGroupIdOf(row) === currentGroupId)
                        .sort((a, b) => questionGroupOrderOf(a.row) - questionGroupOrderOf(b.row))
                    : [];
                  const currentGroupKeys = currentGroupMembers.map(({ row, index }) => questionKey(row, index));
                  const currentGroupToken = questionGroupTokenOf(question);
                  const currentGroupLeaderKey = currentGroupMembers.length
                    ? questionKey(currentGroupMembers[0].row, currentGroupMembers[0].index)
                    : "";
                  const currentIsGroupLeader = Boolean(currentGroupId && currentGroupLeaderKey && currentGroupLeaderKey === key);
                  const selectGroupTogether = Boolean(
                    currentGroupId &&
                    (currentGroupMode === "required" || isFileNameQuestionGroup(currentGroupId)) &&
                    currentGroupKeys.length > 1
                  );
                  const requiredGroupIsIncomplete = Boolean(
                    currentGroupId &&
                    selectGroupTogether &&
                    currentGroupExpectedSize > 0 &&
                    currentGroupMembers.length < currentGroupExpectedSize
                  );
                  const toggleCurrentQuestion = () => {
                    if (requiredGroupIsIncomplete) {
                      showToast(`Bu soru ${currentGroupExpectedSize} soruluk zorunlu bir yönerge grubunda. Grubun tüm soruları bu sınav kapsamındaki havuzda bulunmadığı için kısmi seçim yapılamaz.`);
                      return;
                    }
                    setSelectedSystemQuestionIds((current) => {
                      const next = new Set(current);
                      if (selectGroupTogether) {
                        const allSelected = currentGroupKeys.every((groupKey) => next.has(groupKey));
                        if (allSelected) {
                          currentGroupKeys.forEach((groupKey) => next.delete(groupKey));
                          return next;
                        }
                        const additionalCount = currentGroupKeys.filter((groupKey) => !next.has(groupKey)).length;
                        if (Number.isFinite(remainingSystemQuestionCapacity) && next.size + additionalCount > remainingSystemQuestionCapacity) {
                          showToast(`Bu ${currentGroupKeys.length} soruluk yönerge grubu dersin kalan soru kapasitesine sığmıyor.`);
                          return current;
                        }
                        currentGroupKeys.forEach((groupKey) => next.add(groupKey));
                        return next;
                      }
                      if (next.has(key)) {
                        next.delete(key);
                        return next;
                      }
                      if (Number.isFinite(remainingSystemQuestionCapacity) && next.size >= remainingSystemQuestionCapacity) {
                        showToast(`Bu ders için ${questionCount} soru sınırına ulaşıldı. Önce bir seçimi kaldırın.`);
                        return current;
                      }
                      next.add(key);
                      return next;
                    });
                  };
                  const goPrevious = () =>
                    setSystemQuestionViewerIndex((current) =>
                      visibleQuestions.length <= 1 ? 0 : (current - 1 + visibleQuestions.length) % visibleQuestions.length,
                    );
                  const goNext = () =>
                    setSystemQuestionViewerIndex((current) =>
                      visibleQuestions.length <= 1 ? 0 : (current + 1) % visibleQuestions.length,
                    );

                  return (
                    <div className="mx-auto w-full max-w-5xl">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-800">
                            {outcomeLabel(question) || "Kazanım soruları"}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                            {topicLabel(question)} · {safeViewerIndex + 1} / {visibleQuestions.length}
                          </div>
                          {currentGroupId ? (
                            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-rose-700 bg-rose-600 px-3 py-1.5 text-[10px] font-black text-white shadow-md ring-2 ring-rose-200">
                              <Link2 className="h-3.5 w-3.5" />
                              GRUP SORUSU{currentGroupToken ? ` · ${currentGroupToken}` : ""} · {currentIsGroupLeader ? "ÖNCÜL" : "BAĞLI"} · {currentGroupExpectedSize || currentGroupMembers.length} PARÇA
                            </div>
                          ) : null}
                        </div>
                        <div className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                          selected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {selected ? "Sınava seçildi" : "Henüz seçilmedi"}
                        </div>
                      </div>

                      <div className={`relative overflow-hidden rounded-3xl border-2 bg-white shadow-sm ${
                        selected
                          ? "border-emerald-500 ring-2 ring-emerald-100"
                          : currentGroupId
                            ? "border-rose-500 ring-2 ring-rose-100"
                            : "border-slate-200"
                      }`}>
                        {currentGroupId && (questionGroupInstructionTextOf(question) || questionGroupInstructionImageOf(question) || questionGroupTitleOf(question)) ? (
                          <button
                            type="button"
                            onClick={toggleCurrentQuestion}
                            className="block w-full border-b border-indigo-100 bg-indigo-50/60 px-5 py-3 text-left transition hover:bg-indigo-100/70"
                            title={currentGroupMode === "required" ? "Yönerge grubunun tamamını seç / seçimden çıkar" : "Bu yönergeye bağlı soruyu seç / seçimden çıkar"}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Ortak Yönerge</div>
                              <div className="text-[9px] font-black text-indigo-600">{currentGroupMode === "required" ? "Grubu seç" : "Bağlı soru"}</div>
                            </div>
                            {questionGroupTitleOf(question) ? <div className="mt-1 text-xs font-black text-slate-800">{questionGroupTitleOf(question)}</div> : null}
                            {questionGroupInstructionTextOf(question) ? <div className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-700">{questionGroupInstructionTextOf(question)}</div> : null}
                            {questionGroupInstructionImageOf(question) ? <img src={questionGroupInstructionImageOf(question)} alt="Ortak yönerge" className="mt-2 max-h-44 w-full object-contain" /> : null}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={goPrevious}
                          disabled={visibleQuestions.length <= 1}
                          className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Önceki soru"
                        >
                          <ChevronLeft className="h-7 w-7" />
                        </button>

                        <button
                          type="button"
                          onClick={toggleCurrentQuestion}
                          className="flex min-h-[360px] w-full items-center justify-center bg-slate-50 px-16 py-5"
                          title={selected ? "Soruyu seçimden çıkar" : "Soruyu sınava dahil et"}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="Sistem sorusu" className="max-h-[54vh] w-full object-contain" />
                          ) : (
                            <div className="px-6 text-center text-sm font-bold text-slate-400">Soru görseli bulunamadı</div>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={goNext}
                          disabled={visibleQuestions.length <= 1}
                          className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Sonraki soru"
                        >
                          <ChevronRight className="h-7 w-7" />
                        </button>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
                          <div className="min-w-0 text-[10px] font-semibold text-slate-500">
                            <div className="truncate">{unitLabel(question)} / {topicLabel(question)}</div>
                            <div className="mt-0.5 truncate font-bold text-slate-700">{outcomeLabel(question)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={toggleCurrentQuestion}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
                            }`}
                          >
                            <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                              selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"
                            }`}>
                              {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                            </span>
                            {selected ? "Sınava Dahil Edildi" : "Sınava Dahil Et"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <div className="text-xs font-extrabold text-slate-700">
                  {selectedSystemQuestionIds.size} soru seçildi
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSystemQuestionModalOpen(false);
                      setSelectedSystemQuestionIds(new Set());
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={selectedSystemQuestionIds.size === 0}
                    onClick={addSelectedSystemQuestions}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Seçilen Soruları Ekle ({selectedSystemQuestionIds.size})
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showAnswerKeyEntryModal && activeSubject && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => !answerKeyExcelLoading && setShowAnswerKeyEntryModal(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-600 px-5 py-4 text-white">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Cevap Anahtarı / Kitapçık Eşleştirme</div>
                <h3 className="mt-1 text-base font-black">{activeSubject.name}</h3>
              </div>
              <button
                type="button"
                disabled={answerKeyExcelLoading}
                onClick={() => setShowAnswerKeyEntryModal(false)}
                className="rounded-xl bg-white/15 p-2 transition hover:bg-white/25 disabled:opacity-50"
                aria-label="Cevap anahtarı penceresini kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold leading-6 text-blue-950">
                Şablonda her dersin adı ve A kitapçığındaki soru numaraları hazırdır. <b>A kitapçığı cevaplarını</b> ve varsa <b>B kitapçığındaki karşılık soru numaralarını</b> doldurun.
                Excel dosyasındaki tüm dersler birlikte doğrulanır ve tek seferde kaydedilir.
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[600px] table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-600">
                    <tr>
                      <th className="w-1/4 px-3 py-3">Ders Adı</th>
                      <th className="w-1/4 px-3 py-3">A Kitapçığı Soru No</th>
                      <th className="w-1/4 px-3 py-3">A Kitapçığı Cevap Anahtarı</th>
                      <th className="w-1/4 px-3 py-3">B Kitapçığında Karşılık Soru No</th>
                    </tr>
                  </thead>
                  <tbody className="font-semibold text-slate-700">
                    <tr className="border-t border-slate-200"><td className="px-3 py-3">{activeSubject.name}</td><td className="px-3 py-3">1</td><td className="px-3 py-3">A</td><td className="px-3 py-3">7</td></tr>
                    <tr className="border-t border-slate-100"><td className="px-3 py-3">{activeSubject.name}</td><td className="px-3 py-3">2</td><td className="px-3 py-3">C</td><td className="px-3 py-3">3</td></tr>
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => void downloadAllSubjectsAnswerKeyTemplate()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-3 text-xs font-black text-blue-800 transition hover:bg-blue-100"
              >
                <Download className="h-4 w-4" /> Tüm Derslerin Excel Şablonunu İndir
              </button>

              <input
                ref={answerKeyExcelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleAllSubjectsAnswerKeyExcelUpload(file);
                }}
              />
              <button
                type="button"
                disabled={answerKeyExcelLoading}
                onClick={() => answerKeyExcelInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                <UploadCloud className="h-5 w-5" />
                {answerKeyExcelLoading ? "Tüm Dersler Kaydediliyor..." : "Tüm Derslerin Cevaplarını Yükle"}
              </button>

              <p className="text-center text-[10px] font-semibold leading-5 text-slate-400">
                .xlsx ve .xls dosyaları desteklenir. Excel'de C/D kitapçığı sütunları varsa onlar da otomatik alınır.
              </p>
            </div>
          </div>
        </div>
      )}

      {questionPreviewIndex !== null && activeSubject && previewQuestionData?.imageUrl && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={() => setQuestionPreviewIndex(null)}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Soru Önizleme</div>
                <div className="text-sm font-extrabold text-slate-900">
                  {activeSubject.name} · Soru {getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, questionPreviewIndex)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {questionGroupIdOf(previewQuestionData) ? (
                  <button
                    type="button"
                    onClick={() => openExistingQuestionGroupEditor(questionGroupIdOf(previewQuestionData))}
                    disabled={isQuestionEditingLocked}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Ortak yönerge grubunu düzenle"
                  >
                    <Link2 className="h-4 w-4" /> Grup ({questionGroupSizeOf(previewQuestionData) || questionGroupMembers(questionGroupIdOf(previewQuestionData)).length})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleDeletePreviewQuestion}
                  disabled={isQuestionEditingLocked}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                  aria-label="Soruyu sil"
                  title="Soruyu sil"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionPreviewIndex(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Önizlemeyi kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {questionGroupIdOf(previewQuestionData) && (questionGroupInstructionTextOf(previewQuestionData) || questionGroupInstructionImageOf(previewQuestionData) || questionGroupTitleOf(previewQuestionData)) ? (
              <div className="border-b border-indigo-100 bg-indigo-50/70 px-6 py-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-indigo-700"><Link2 className="h-3.5 w-3.5" /> Ortak Yönerge · {questionGroupModeOf(previewQuestionData) === "required" ? "Zorunlu Grup" : "Serbest Grup"}</div>
                {questionGroupTitleOf(previewQuestionData) ? <div className="mt-1 text-sm font-black text-slate-900">{questionGroupTitleOf(previewQuestionData)}</div> : null}
                {questionGroupInstructionTextOf(previewQuestionData) ? <div className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-700">{questionGroupInstructionTextOf(previewQuestionData)}</div> : null}
                {questionGroupInstructionImageOf(previewQuestionData) ? <img src={questionGroupInstructionImageOf(previewQuestionData)} alt="Ortak yönerge" className="mt-2 max-h-36 w-full object-contain" /> : null}
              </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-100 px-16 py-5 sm:px-20">
              <button
                type="button"
                onClick={showPreviousPreviewQuestion}
                disabled={previewPosition <= 0}
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-25 sm:left-5"
                aria-label="Önceki soru"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>

              <div className="flex h-full max-h-[78vh] w-full items-center justify-center overflow-auto rounded-2xl bg-white p-3 shadow-inner">
                <img
                  src={previewQuestionData.imageUrl}
                  alt={`Soru ${getQuestionDisplayNumber(activeTestIndex, activeSubjectIndex, questionPreviewIndex)}`}
                  className="max-h-[74vh] max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <button
                type="button"
                onClick={showNextPreviewQuestion}
                disabled={previewPosition < 0 || previewPosition >= previewQuestionIndices.length - 1}
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-25 sm:right-5"
                aria-label="Sonraki soru"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Soru Genişliği
                </span>
                {[1, 2].map((span) => {
                  const selected = Number(previewQuestionData?.columnSpan || 1) === span;
                  return (
                    <button
                      key={`column-span-${span}`}
                      type="button"
                      disabled={isQuestionEditingLocked}
                      onClick={() => {
                        if (questionPreviewIndex === null) return;
                        void saveQuestionColumnSpanAtIndex(questionPreviewIndex, span);
                      }}
                      className={`rounded-xl border px-4 py-2 text-[11px] font-black transition-all ${
                        selected
                          ? "border-fuchsia-500 bg-fuchsia-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                      title={`${span} sütun genişliğinde kaydet`}
                    >
                      {span} Sütun
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Doğru Cevap
                </span>
                {["A", "B", "C", "D", "E"].map((option) => {
                  const selected = previewCorrectAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        if (questionPreviewIndex === null) return;
                        void saveQuestionCorrectAnswerAtIndex(questionPreviewIndex, option);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-black transition-all ${
                        selected
                          ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                      title={`Doğru cevap ${option} olarak kaydet`}
                    >
                      {option}
                    </button>
                  );
                })}
                {previewCorrectAnswer && !/^[A-E]$/.test(previewSavedAnswer) ? (
                  <span className="ml-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                    Dosya adından algılandı — değiştirilebilir
                  </span>
                ) : previewSavedAnswer ? (
                  <span className="ml-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    Kaydedilen cevap: {previewSavedAnswer}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-center text-[11px] font-bold text-slate-500">
                {previewPosition + 1} / {previewQuestionIndices.length} · Pencerenin dışına tıklayarak kapatabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      )}

      {previewBookletKey !== null && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeBookletPreview();
          }}
        >
          <div className="flex h-[96vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Gerçek PDF Ön İzleme</div>
                <div className="truncate text-sm font-extrabold text-slate-900">
                  {previewBookletKey.toUpperCase()} KİTAPÇIĞI - {replaceLegacyExamTerminology(exam.examName)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSingleBooklet(previewBookletKey)}
                  disabled={!canDownloadLockedBooklets}
                  className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  <Download className="h-4 w-4" />
                  PDF İndir
                </button>
                <button
                  type="button"
                  onClick={closeBookletPreview}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Ön izlemeyi kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-3">
              {previewPdfLoading ? (
                <div className="flex h-full items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-500">
                  Gerçek kitapçık tasarımı hazırlanıyor...
                </div>
              ) : previewPdfError ? (
                <div className="flex h-full items-center justify-center rounded-xl bg-white p-6 text-center text-sm font-bold text-red-600">
                  {previewPdfError}
                </div>
              ) : previewPdfUrl ? (
                <iframe
                  src={`${previewPdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                  title={`${previewBookletKey.toUpperCase()} Kitapçığı PDF Ön İzleme`}
                  className="h-full w-full rounded-xl border-0 bg-white"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showNotification && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-max z-[200] max-w-[90vw]">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-4">
             <CheckCircle2 className="w-5 h-5 text-green-400" />
             <span className="font-medium text-sm sm:text-base">{showNotification}</span>
          </div>
        </div>
      )}

      {uploadProgress && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 w-[90%] max-w-sm">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <h3 className="text-xl font-bold text-slate-800">Sorular Yükleniyor</h3>
            <p className="text-slate-600 font-medium font-mono text-lg">
              {uploadProgress.current} / {uploadProgress.total}
            </p>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {showEvaluateSuccessModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col items-center p-8 relative transform transition-all text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Başarılı!</h3>
            <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
              Sınav Analizler İçin Hazırdır
            </p>
            <button
              onClick={() => {
                setShowEvaluateSuccessModal(false);
                if (onEvaluationComplete) onEvaluationComplete();
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
