import { examAnalysisService } from "../modules/exam/ExamAnalysisService";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { auditLog } from "../core/audit";
import localforage from "localforage";
import ItemAnalysisModule from "./exam/item-analysis/ItemAnalysisModule";
import TopicAnalysisModule from "./exam/topic-analysis/TopicAnalysisModule";
const ReportsModule = lazy(() => import("./exam/reports/ReportsModule"));
import { BulkStudentTTSAnalysisView, LessonTTSAnalysisView, StudentTTSAnalysisView } from "./exam/analysis/ExamTTSAnalysis";
import { StableStudentScorecard } from "./exam/analysis/StableStudentScorecard";
import { RankedListsModal, ReturnWarningModal } from "./exam/analysis/ExamAnalysisModals";
import { ActionPermissionNotice } from "./common";
import { PdfEngine, buildTable } from "../pdf";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";
import type { AccessControlState, PanelUser } from "../lib/accessControl";
import {
  BarChart2,
  Users,
  Award,
  BookOpenCheck,
  TrendingUp,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  X,
  Target,
  Sparkles,
  Award as AwardIcon,
  ChevronDown,
  Info,
  Loader2,
  Printer,
  FileDown,
  FileText,
  Camera,
  Volume2,
  Play,
  Pause,
  Square,
  Share2,
  Copy,
  Download,
  Check,
  MessageCircle,
  ArrowLeft
} from "lucide-react";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { examPipelineService } from "../modules/exam";

type FocusedExamReport={section:string;title:string;tone:string};

const ExamAnalysisCharts = lazy(() => import("./exam/analysis/ExamAnalysisCharts"));
// Evaluator mapper functions (mirrored from QuestionManagerView)
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
  return i;
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

// Returns either configured correct answer, or fallback deterministic key choice
const getAnswerForQuestion = (exam: any, subjectName: string, index: number) => {
  const qData = exam.questions?.[subjectName]?.[index];
  const resolvedAnswer = getQuestionCorrectAnswer(qData);
  if (resolvedAnswer) return resolvedAnswer;
  
  const options = ["A", "B", "C", "D", "E"];
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const answerIdx = Math.abs((hash + index) % 5);
  return options[answerIdx];
};

// Primary Evaluator function for raw answers
export const evaluateStudentRecords = (exam: any) => examPipelineService.evaluate(exam);

function cleanPhone(phone: string) {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "90" + clean.substring(1);
  }
  if (!clean.startsWith("90") && clean.length === 10) {
    clean = "90" + clean;
  }
  return clean;
}

export default function ExamAnalysisModule({
  onNavigate,
  initialMode = "analysis",
  allowedStudents,
  scopeConfigured = true,
  scopeReason,
  canPublishReports = true,
  accessState,
  currentUser,
  examScope = "general",
}: {
  onNavigate?: (tab: string, context?: any) => void;
  initialMode?: "analysis" | "reports";
  allowedStudents?: any[];
  scopeConfigured?: boolean;
  scopeReason?: string;
  canPublishReports?: boolean;
  accessState?: AccessControlState;
  currentUser?: PanelUser;
  examScope?: "general" | "trial-club" | "all";
} = {}) {
  const isReportsMode = initialMode === "reports";
  const isTrialClubExam = React.useCallback((exam: any) => {
    const participantGroup = String(exam?.participantGroup || "").trim().toLowerCase();
    if (participantGroup === "trial-club") return true;
    const label = String(exam?.participantLabel || exam?.targetAudience || "").toLocaleLowerCase("tr-TR");
    return label.includes("deneme kulüb");
  }, []);
  const matchesExamScope = React.useCallback((exam: any) => {
    if (examScope === "all") return true;
    const trialClub = isTrialClubExam(exam);
    return examScope === "trial-club" ? trialClub : !trialClub;
  }, [examScope, isTrialClubExam]);
  const [focusedReport,setFocusedReport]=useState<FocusedExamReport|null>(null);
  const allowedStudentKeys = React.useMemo(() => {
    if (!allowedStudents) return null;
    const keys = new Set<string>();
    const add = (value: unknown) => {
      const normalized = String(value ?? "").trim().toLocaleLowerCase("tr-TR");
      if (normalized) keys.add(normalized);
    };
    allowedStudents.forEach((student: any) => {
      add(student?.id);
      add(student?.studentNumber ?? student?.studentNo ?? student?.schoolNumber ?? student?.number);
      add(student?.fullName ?? student?.name ?? student?.studentName);
    });
    return keys;
  }, [allowedStudents]);

  const scopeExam = React.useCallback((exam: any) => {
    if (!allowedStudentKeys) return exam;
    const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
    const scopedRecords = records.filter((record: any) => {
      const candidates = [
        record?.studentId,
        record?.studentNumber,
        record?.studentNo,
        record?.schoolNumber,
        record?.studentName,
        record?.fullName,
      ].map((value) => String(value ?? "").trim().toLocaleLowerCase("tr-TR")).filter(Boolean);
      return candidates.some((value) => allowedStudentKeys.has(value));
    });
    return { ...exam, studentTxtRecords: scopedRecords };
  }, [allowedStudentKeys]);

  const [evaluatedExams, setEvaluatedExams] = useState<any[]>([]);
  const lastGoodEvaluatedExamsRef = React.useRef<any[]>([]);
  const analysisRetryTimerRef = React.useRef<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examSelectFocused, setExamSelectFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<"sınav" | "öğrenci" | "ders">("sınav");
  const [activeLetterTab, setActiveLetterTab] = useState<"A" | "B" | "C" | "D" | "E">(isReportsMode ? "C" : "A");
  
  // Student Analysis states
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [studentImages, setStudentImages] = useState<{ [key: string]: string }>({});
  const [selectedMultiExamIds, setSelectedMultiExamIds] = useState<string[]>([]);
  const [scorecardSearchQuery, setScorecardSearchQuery] = useState("");
  const [scorecardShowSuggestions, setScorecardShowSuggestions] = useState(false);
  const [comboboxSearchTerm, setComboboxSearchTerm] = useState("");
  const [comboboxDropdownOpen, setComboboxDropdownOpen] = useState(false);
  const [returningToPrepare, setReturningToPrepare] = useState(false);
  const [showReturnWarning, setShowReturnWarning] = useState(false);

  useEffect(() => {
    localforage.getItem("student_images").then((saved: any) => {
      if (saved) {
        setStudentImages(saved);
      }
    });
  }, []);

  const handleUploadImage = async (studentNo: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const key = `${selectedExamId}_${studentNo}`;
      const updated = { ...studentImages, [key]: base64 };
      setStudentImages(updated);
      await localforage.setItem("student_images", updated);
    };
    reader.readAsDataURL(file);
  };

  // Subject Analysis states
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Chart Classroom comparison state
  const [selectedChartClassroom, setSelectedChartClassroom] = useState<string>("");

  // Ranked List Modal & PDF Export states
  const [showRankedListsModal, setShowRankedListsModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfGeneratingOption, setPdfGeneratingOption] = useState<string | null>(null);

  const applyEvaluatedExams = React.useCallback((savedExams: any[]) => {
    const evaluated: any[] = Array.isArray(savedExams)
      ? savedExams.filter(matchesExamScope).map(scopeExam)
      : [];

    if (evaluated.length > 0) {
      lastGoodEvaluatedExamsRef.current = evaluated;
    }

    setEvaluatedExams(evaluated);
    setSelectedExamId((current) => {
      if (evaluated.length === 0) return null;
      return current && evaluated.some((exam) => String(exam.id) === String(current))
        ? current
        : String(evaluated[0].id);
    });
  }, [matchesExamScope, scopeExam]);

  const readCachedEvaluatedExams = React.useCallback(async () => {
    try {
      const cached = await localforage.getItem<any[]>("exams");
      if (!Array.isArray(cached)) return [];
      return cached.filter((exam: any) => {
        if (exam?.isEvaluated === true) return true;
        if (String(exam?.examStatus || "").toLocaleLowerCase("tr-TR") === "değerlendirildi") return true;
        if (examScope !== "trial-club") return false;
        const participantGroup = String(exam?.participantGroup || "").trim().toLocaleLowerCase("tr-TR");
        const participantLabel = String(exam?.participantLabel || exam?.targetAudience || "").toLocaleLowerCase("tr-TR");
        const isTrialClub = participantGroup === "trial-club" || participantLabel.includes("deneme kulüb");
        return isTrialClub && Array.isArray(exam?.studentTxtRecords) && exam.studentTxtRecords.length > 0;
      });
    } catch {
      return [];
    }
  }, [examScope]);

  const fetchExams = React.useCallback(async () => {
    try {
      const savedExams = await examPipelineService.listEvaluated();
      const normalizedSavedExams = Array.isArray(savedExams) ? savedExams : [];

      // Daha önce sınav varken sunucu bir anda boş liste döndürürse bunu hemen
      // gerçek silme olarak kabul etme. Tarayıcıdaki son sağlam değerlendirilmiş
      // sınav kopyası da boşsa ancak o zaman liste gerçekten boşaltılır.
      if (normalizedSavedExams.length === 0 && lastGoodEvaluatedExamsRef.current.length > 0) {
        const cached = await readCachedEvaluatedExams();
        if (cached.length > 0) {
          applyEvaluatedExams(cached);
          if (analysisRetryTimerRef.current === null) {
            analysisRetryTimerRef.current = window.setTimeout(() => {
              analysisRetryTimerRef.current = null;
              void fetchExams();
            }, 2000);
          }
          return;
        }
      }

      applyEvaluatedExams(normalizedSavedExams);
      if (analysisRetryTimerRef.current !== null) {
        window.clearTimeout(analysisRetryTimerRef.current);
        analysisRetryTimerRef.current = null;
      }
    } catch (error) {
      // Sunucu/SQLite geçici olarak okunamadığında bunu "sınav yok" şeklinde
      // yorumlama. Son sağlam listeyi ekranda tut; mümkünse tarayıcıdaki son
      // sağlam sınav kopyasından besle ve arka planda tekrar dene.
      const cached = await readCachedEvaluatedExams();
      if (cached.length > 0) {
        applyEvaluatedExams(cached);
      } else if (lastGoodEvaluatedExamsRef.current.length > 0) {
        setEvaluatedExams(lastGoodEvaluatedExamsRef.current);
      }
      console.warn("Sınav Analiz/Raporları sınav listesi geçici olarak okunamadı; mevcut liste korunuyor:", error);
      if (analysisRetryTimerRef.current === null) {
        analysisRetryTimerRef.current = window.setTimeout(() => {
          analysisRetryTimerRef.current = null;
          void fetchExams();
        }, 2000);
      }
    }
  }, [applyEvaluatedExams, readCachedEvaluatedExams]);

  useEffect(() => {
    void fetchExams();
    return () => {
      if (analysisRetryTimerRef.current !== null) {
        window.clearTimeout(analysisRetryTimerRef.current);
        analysisRetryTimerRef.current = null;
      }
    };
  }, [fetchExams]);

  // Birleşik Karne ilk açıldığında yalnız öğrencinin gerçekten girdiği sınavları seç.
  useEffect(() => {
    const activeStudentObj =
      selectedStudent ||
      (calculatedResults.length > 0 ? sortedCalculatedResults[0] : null);

    if (activeStudentObj && evaluatedExams.length > 0) {
      const studentNo = String(activeStudentObj.studentNumber || "");
      const taken = evaluatedExams
        .filter((candidateExam) =>
          evaluateStudentRecords(candidateExam).some(
            (record: any) =>
              String(record?.studentNumber || "") === studentNo,
          ),
        )
        .map((candidateExam) => candidateExam.id);

      setSelectedMultiExamIds(taken);
    } else {
      setSelectedMultiExamIds([]);
    }
  }, [selectedStudent, evaluatedExams, selectedExamId]);

  const activeExam = React.useMemo(
    () => evaluatedExams.find((exam) => String(exam.id) === String(selectedExamId || "")),
    [evaluatedExams, selectedExamId],
  );

  useEffect(() => {
    if (!isReportsMode) return;
    // Sınav değiştiğinde önceki sınavın açık rapor görünümünü/PDF bağlamını taşımayın.
    setFocusedReport(null);
  }, [isReportsMode, selectedExamId]);

  const handleReturnToExamPrepare = async () => {
    if (!activeExam || returningToPrepare) return;
    setReturningToPrepare(true);
    try {
      const returnedExam: any = await examPipelineService.returnToPreparation(activeExam.id);
      try {
        const cachedExams = await localforage.getItem<any[]>("exams");
        if (Array.isArray(cachedExams)) {
          const nextCachedExams = cachedExams.some((exam: any) => String(exam?.id) === String(returnedExam.id))
            ? cachedExams.map((exam: any) => String(exam?.id) === String(returnedExam.id) ? returnedExam : exam)
            : [...cachedExams, returnedExam];
          await localforage.setItem("exams", nextCachedExams);
        }
      } catch (error) {
        console.warn("Hazırlığa dönen sınavın yerel yedeği güncellenemedi:", error);
      }
      sqliteStorage.setItem("exam_prepare_initial_id", returnedExam.id);
      sqliteStorage.setItem("exam_prepare_transfer_payload", JSON.stringify(returnedExam));
      setEvaluatedExams((current) => current.filter((exam) => exam.id !== returnedExam.id));
      setSelectedExamId(null);
      setSelectedStudent(null);
      onNavigate?.("exam-prepare", { initialExamId: returnedExam.id, examId: returnedExam.id, selectedExamId: returnedExam.id, exam: returnedExam });
    } catch (error) {
      console.error("Sınav Hazırla ekranına dönüş hatası:", error);
      window.alert(`Sınav Hazırla ekranına dönülemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    } finally {
      setReturningToPrepare(false);
    }
  };

  // Perform calculations only when the selected exam or permission scope changes.
  // Previously this expensive ranking/evaluation ran on every report UI state change,
  // which made Sınav Raporları feel slow and could keep stale derived views alive.
  const calculatedResults = React.useMemo(
    () => (activeExam ? examAnalysisService.resultsForExam(activeExam, allowedStudentKeys) : []),
    [activeExam, allowedStudentKeys],
  );
  
  // Sort results by rank (highest net to lowest) once per result set.
  const sortedCalculatedResults = React.useMemo(
    () => [...calculatedResults].sort((a, b) => b.totals.net - a.totals.net),
    [calculatedResults],
  );

  const evaluateReportExam = React.useCallback(
    (selectedExam: any) => examAnalysisService.resultsForExam(selectedExam, allowedStudentKeys),
    [allowedStudentKeys],
  );

  // Generate Sample Data for quick preview
  const handleLoadSample = async () => {
    const sampleExam = {
      id: "exam-sample-tyt",
      examName: "Gelişim Serisi TYT Deneme Sınavı - 1",
      publisherName: "Limit Yayınları",
      examDate: "2026-06-21",
      examSource: "Sistem Sınavı",
      examType: "TYT",
      gradeLevel: "YKS",
      opticForm: "Standart 120 Soru",
      isEvaluated: true,
      examStructure: [
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
      ],
      questions: {
        "Türkçe": {},
        "Tarih": {},
        "Coğrafya": {},
        "Felsefe": {},
        "Din Kültürü": {},
        "Matematik": {},
        "Fizik": {},
        "Kimya": {},
        "Biyoloji": {}
      },
      studentTxtRecords: []
    };

    const options = ["A", "B", "C", "D", "E"];
    const subjectsList = [
      { name: "Türkçe", count: 40, topics: ["Paragraf Okuma", "Yazım Kuralları", "Noktalama İşaretleri", "Sözcük Öbekleri", "Cümle Yorumu"] },
      { name: "Tarih", count: 5, topics: ["Kurtuluş Savaşı", "Selçuklu Devleti", "İlk Çağ Uygarlıkları", "Atatürk İlkeleri", "Osmanlı Kültür Sanat"] },
      { name: "Coğrafya", count: 5, topics: ["Harita Bilgisi", "Nüfus Dağılımı", "İklim Tipleri", "Doğal Afetler", "Türkiye'nin Konumu"] },
      { name: "Felsefe", count: 5, topics: ["Bilgi Felsefesi", "Varlık Felsefesi", "Siyaset ve Devlet", "Ahlak Felsefesi", "Estetik Bilimleri"] },
      { name: "Din Kültürü", count: 5, topics: ["Akaid ve Kelam", "Kuran-ı Kerim Mealleri", "İbadet Yükümlülükleri", "Peygamber Hayatları", "Ahlaki Erdemler"] },
      { name: "Matematik", count: 40, topics: ["Sayılar Teorisi", "Denklemler ve Eşitsizlikler", "Problemler", "Kümeler ve Kartezyen", "Fonksiyonlar", "Polinomlar", "Üçgenler", "Dörtgenler", "Prizmalar"] },
      { name: "Fizik", count: 7, topics: ["Basınç ve Kaldırma Kuvveti", "Elektrostatik", "Elektrik Akımı", "Optik Kırılmalar", "Isı ve Sıcaklık", "Hareket Kuvvet", "Dalga Mekaniği"] },
      { name: "Kimya", count: 7, topics: ["Atom Yapısı", "Periyodik Cetvel", "Kimyasal Bağlar", "Maddenin Fiziksel Halleri", "Mol Kavramı", "Asitler ve Bazlar", "Kimya Her Yerde"] },
      { name: "Biyoloji", count: 6, topics: ["Hücre Yapısı", "Canlıların Ortak Özellikleri", "Kalıtım Sistemleri", "Ekoloji ve Çevre", "Sınıflandırma", "Hücre Bölünmeleri"] },
    ];

    subjectsList.forEach((sub) => {
      for (let i = 0; i < sub.count; i++) {
        const correctOpt = options[(i * 3 + 2) % 5];
        const topicName = sub.topics[i % sub.topics.length];
        (sampleExam.questions as any)[sub.name][i] = {
          correctAnswer: correctOpt,
          grade: "12",
          unit: "TYT Konuları",
          topic: topicName,
          outcome: `${topicName} detaylı kazanımı`
        };
      }
    });

    const studentsRaw = [
      { name: "Arda Güler", classroom: "12-A", id: "1024" },
      { name: "Buse Karaca", classroom: "12-A", id: "1032" },
      { name: "Deniz Yılmaz", classroom: "12-B", id: "1055" },
      { name: "Canberk Coşkun", classroom: "12-B", id: "1064" },
      { name: "Zeynep Demir", classroom: "12-A", id: "1011" },
      { name: "Emre Erdem", classroom: "12-C", id: "1072" },
      { name: "Elif Şen", classroom: "12-C", id: "1085" },
      { name: "Mert Karadoğan", classroom: "12-A", id: "1042" },
      { name: "Gizem Polat", classroom: "12-B", id: "1103" },
      { name: "Kerem Aktürkoğlu", classroom: "12-B", id: "1120" },
      { name: "Selin Bakır", classroom: "12-C", id: "1142" },
      { name: "Okan Buruk", classroom: "12-A", id: "1150" },
      { name: "Volkan Demirel", classroom: "12-B", id: "1165" },
      { name: "Melis Alkan", classroom: "12-A", id: "1180" },
      { name: "Doruk Öztürk", classroom: "12-C", id: "1198" }
    ];

    studentsRaw.forEach((stud, idx) => {
      const bType = idx % 2 === 0 ? "A" : "B";
      const accuracyChance = 0.4 + (idx % 5) * 0.12; // 40% to 88%

      let ansStr = "";
      subjectsList.forEach((sub) => {
        for (let i = 0; i < sub.count; i++) {
          const originalIdx = getPrintedQuestionIndex(sampleExam, bType, i + 1, sub.name, sub.count);
          const qCorrect = (sampleExam.questions as any)[sub.name][originalIdx].correctAnswer;
          const roll = Math.random();

          if (roll < accuracyChance) {
            ansStr += qCorrect;
          } else if (roll < accuracyChance + 0.15) {
            const wrongOptions = options.filter(o => o !== qCorrect);
            ansStr += wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          } else {
            ansStr += "-";
          }
        }
      });

      (sampleExam.studentTxtRecords as any[]).push({
        id: `rec-sample-${Date.now()}-${idx}`,
        studentNumber: stud.id,
        gradeLevel: stud.classroom,
        bookletType: bType,
        studentName: stud.name,
        answers: ansStr,
        rawLine: `${stud.id} ${stud.classroom} ${bType} ${stud.name.padEnd(20)} ${ansStr}`
      } as any);
    });

    const saved: any = await localforage.getItem("exams");
    const examsList = Array.isArray(saved) ? saved : [];
    await localforage.setItem("exams", [sampleExam, ...examsList.filter(e => e.id !== "exam-sample-tyt")]);
    setSelectedExamId(sampleExam.id);
    setSelectedSubject("Türkçe");
    fetchExams();
  };

  // Keep a selected subject set if active tab changes to Subject Tab and nothing selected
  useEffect(() => {
    if (activeTab === "ders" && activeExam && !selectedSubject) {
      const questionsData = activeExam.questions || {};
      const subjectsWithQuestions = Object.keys(questionsData).filter(s => Object.keys(questionsData[s]).length > 0);
      if (subjectsWithQuestions.length > 0) {
        setSelectedSubject(subjectsWithQuestions[0]);
      } else {
        const structure = activeExam.examStructure || [];
        if (structure.length > 0 && structure[0].subjects.length > 0) {
          setSelectedSubject(structure[0].subjects[0].name);
        }
      }
    }
  }, [activeTab, activeExam, selectedSubject]);

  if (evaluatedExams.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto min-h-[500px] flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-10 max-w-lg text-center space-y-6">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-2 text-orange-550 mx-auto">
            <BarChart2 className="w-8 h-8 text-orange-700" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-800">
            Değerlendirilmiş Sınav Bulunamadı
          </h3>
          <p className="text-sm text-slate-500 font-medium">
            Sınav Analiz Merkezi'nin grafiklerini ve raporlarını tam kapasiteyle incelemek için öncelikle hazırladığınız sınavlara ait öğrenci optik dosyalarını okutup değerlendirmeniz gerekir. Ortalama netler, şeref listesi ve ders kazanım grafikleri anında çizilir!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
            <button
              onClick={handleLoadSample}
              className="w-full sm:w-auto px-6 py-3.5 bg-orange-700 hover:bg-orange-850 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Örnek Analiz Verisi Yükle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Aggregate stats calculations for active exam
  // 1. Participant count
  const totalParticipants = sortedCalculatedResults.length;

  // 2. Average Net
  const averageNet = totalParticipants > 0
    ? Number((sortedCalculatedResults.reduce((sum, r) => sum + r.totals.net, 0) / totalParticipants).toFixed(2))
    : 0;

  // 3. Max and Min net
  const maxNet = totalParticipants > 0 ? sortedCalculatedResults[0].totals.net : 0;
  const minNet = totalParticipants > 0 ? sortedCalculatedResults[totalParticipants - 1].totals.net : 0;

  // PDF Generator Function Supporting English or Turkish encoding completely
  const handleGeneratePDF = async (option: string, classFilter?: string) => {
    if (!canPublishReports) { alert("Bu rol rapor oluşturma veya yayınlama yetkisine sahip değil."); return; }
    setPdfLoading(true);
    const optionLabels: Record<string, string> = {
      KURUM_GENEL: "Kurum Genel Sıralı Liste",
      KURUM_SIRALI: "Kurum Sıralı Liste",
      TUM_SINIFLAR_AYRI_KAGIT: "Tüm Sınıflar Sıralı Liste",
    };
    const optionLabel = option === "TEK_SINIF" && classFilter
      ? `${classFilter} Şubesi Sıralı Liste`
      : optionLabels[option] || "Sıralı Liste";
    setPdfGeneratingOption(optionLabel);

    try {
      if (sortedCalculatedResults.length === 0) {
        alert("Sıralı liste dökümü alabilmek için değerlendirilmiş en az bir öğrenci kaydı bulunmalıdır.");
        return;
      }

      const examTitle = activeExam?.examName || "Sınav Sonuçları";
      const publisher = activeExam?.publisherName || "";
      const examDateStr = activeExam?.examDate || "";
      const sortedStudents = [...sortedCalculatedResults];
      const getClassRankInfo = (student: any) => {
        const classStudents = sortedStudents
          .filter((item) => item.classroom === student.classroom)
          .sort((a, b) => b.totals.net - a.totals.net);
        return `${classStudents.findIndex((item) => item.recordId === student.recordId) + 1} / ${classStudents.length}`;
      };
      const meta = (participation: number, netAverage: number) => ({
        columns: [
          { text: `${publisher}${publisher ? " • " : ""}${examTitle}`, color: "#64748B", fontSize: 8 },
          { text: `Sınav Tarihi: ${examDateStr} | Katılım: ${participation} | Net Ort.: ${netAverage}`, alignment: "right", color: "#64748B", fontSize: 8 },
        ],
        margin: [0, 0, 0, 8],
      });
      const generalRows = (students: any[]) => students.map((student, index) => [
        index + 1, student.studentNumber, student.studentName, student.classroom,
        student.bookletType, student.totals.correct, student.totals.wrong,
        student.totals.empty, student.totals.net.toFixed(2),
      ]);
      const rankedRows = (students: any[]) => students.map((student, index) => [
        index + 1, getClassRankInfo(student), student.studentNumber, student.studentName,
        student.classroom, student.bookletType, student.totals.correct,
        student.totals.wrong, student.totals.empty, student.totals.net.toFixed(2),
      ]);

      // The ranked-list card uses the supplied landscape school-list form.
      // Subjects stay data-driven because exam structures differ between exams.
      const reportStudents = option === "TEK_SINIF" && classFilter
        ? sortedStudents.filter((student) => student.classroom === classFilter)
        : sortedStudents;
      const subjectNames = Array.from(new Set(
        sortedStudents.flatMap((student) => student.subjects.map((subject: any) => subject.subjectName)),
      ));
      const classrooms = Array.from(new Set(sortedStudents.map((student) => student.classroom)))
        .sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true, sensitivity: "base" }));
      const classRanks = new Map<string, number>();
      classrooms.forEach((classroom) => sortedStudents
        .filter((student) => student.classroom === classroom)
        .sort((a, b) => b.totals.net - a.totals.net)
        .forEach((student, index) => classRanks.set(String(student.recordId ?? student.studentNumber ?? ""), index + 1)));
      const schoolRanks = new Map([...sortedStudents]
        .sort((a, b) => b.totals.net - a.totals.net)
        .map((student, index) => [student.recordId, index + 1]));
      const avg = (values: number[]) => values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
      const subjectOf = (student: any, name: string) => student.subjects.find((subject: any) => subject.subjectName === name);
      const pdfCell = (text: unknown, extra: Record<string, unknown> = {}) => ({
        text: String(text ?? ""), alignment: "center", fontSize: 5.2, margin: [1, 2, 1, 2], ...extra,
      });
      const green = "#5B9F73";
      const lime = "#DDE589";
      const red = "#E50046";
      const summaryBody: any[] = [
        [pdfCell("", { fillColor: green }), ...subjectNames.flatMap((name) => [pdfCell(name.toLocaleUpperCase("tr-TR"), { colSpan: 2, bold: true, color: "#FFFFFF", fillColor: green }), {}]), pdfCell("TOPLAM", { colSpan: 2, bold: true, color: "#FFFFFF", fillColor: red }), {}, pdfCell("Okul\nKatılım", { bold: true, color: "#FFFFFF", fillColor: red })],
        [pdfCell("Soru Sayısı", { bold: true, fillColor: lime }), ...subjectNames.flatMap((name) => [pdfCell(subjectOf(sortedStudents[0], name)?.totalQuestions ?? "", { colSpan: 2 }), {}]), pdfCell("", { colSpan: 2 }), {}, pdfCell(sortedStudents.length)],
        [pdfCell("Net Ortalaması", { bold: true, fillColor: lime }), ...subjectNames.flatMap((name) => [pdfCell(avg(sortedStudents.map((student) => subjectOf(student, name)?.net ?? 0)).toFixed(2), { colSpan: 2 }), {}]), pdfCell(avg(sortedStudents.map((student) => student.totals.net)).toFixed(2), { colSpan: 2 }), {}, pdfCell("")],
        [pdfCell("ŞUBELER", { bold: true, color: "#FFFFFF", fillColor: green }), ...subjectNames.flatMap(() => [pdfCell("Net", { bold: true, fillColor: lime }), pdfCell("Sıra", { bold: true, fillColor: lime })]), pdfCell("Net", { bold: true, fillColor: lime }), pdfCell("Sıra", { bold: true, fillColor: lime }), pdfCell("Şube\nKatılım", { bold: true, color: "#FFFFFF", fillColor: red })],
      ];
      const classTotalAverages = classrooms.map((classroom) => ({ classroom, value: avg(sortedStudents.filter((student) => student.classroom === classroom).map((student) => student.totals.net)) })).sort((a, b) => b.value - a.value);
      classrooms.forEach((classroom) => {
        const members = sortedStudents.filter((student) => student.classroom === classroom);
        summaryBody.push([pdfCell(classroom, { bold: true, fillColor: lime }), ...subjectNames.flatMap((name) => {
          const value = avg(members.map((student) => subjectOf(student, name)?.net ?? 0));
          const order = classrooms.map((item) => ({ item, value: avg(sortedStudents.filter((student) => student.classroom === item).map((student) => subjectOf(student, name)?.net ?? 0)) })).sort((a, b) => b.value - a.value);
          return [pdfCell(value.toFixed(2)), pdfCell(order.findIndex((item) => item.item === classroom) + 1)];
        }), pdfCell(avg(members.map((student) => student.totals.net)).toFixed(2)), pdfCell(classTotalAverages.findIndex((item) => item.classroom === classroom) + 1), pdfCell(members.length)]);
      });
      const studentHeader1 = [pdfCell("S", { rowSpan: 2, bold: true, color: "#FFFFFF", fillColor: green }), pdfCell("No", { rowSpan: 2, bold: true, color: "#FFFFFF", fillColor: green }), pdfCell("Şube", { rowSpan: 2, bold: true, color: "#FFFFFF", fillColor: green }), pdfCell("ADI SOYADI", { rowSpan: 2, bold: true, color: "#FFFFFF", fillColor: green }), ...subjectNames.flatMap((name) => [pdfCell(name.toLocaleUpperCase("tr-TR"), { colSpan: 3, bold: true, color: "#FFFFFF", fillColor: green }), {}, {}]), pdfCell("TOPLAM", { colSpan: 3, bold: true, color: "#FFFFFF", fillColor: red }), {}, {}];
      const studentHeader2 = [{}, {}, {}, {}, ...subjectNames.flatMap(() => [pdfCell("Net", { bold: true, color: "#FFFFFF", fillColor: green }), pdfCell("Şube", { bold: true, fillColor: lime }), pdfCell("Okul", { bold: true, fillColor: lime })]), pdfCell("Net", { bold: true, color: "#FFFFFF", fillColor: red }), pdfCell("Şube", { bold: true, fillColor: lime }), pdfCell("Okul", { bold: true, fillColor: lime })];
      const studentBody = [studentHeader1, studentHeader2, ...reportStudents.map((student, index) => [pdfCell(index + 1), pdfCell(student.studentNumber), pdfCell(student.classroom), pdfCell(student.studentName, { alignment: "left", bold: true }), ...subjectNames.flatMap((name) => {
        const byClass = sortedStudents.filter((item) => item.classroom === student.classroom).sort((a, b) => (subjectOf(b, name)?.net ?? 0) - (subjectOf(a, name)?.net ?? 0));
        const bySchool = [...sortedStudents].sort((a, b) => (subjectOf(b, name)?.net ?? 0) - (subjectOf(a, name)?.net ?? 0));
        return [pdfCell((subjectOf(student, name)?.net ?? 0).toFixed(2)), pdfCell(byClass.findIndex((item) => item.recordId === student.recordId) + 1), pdfCell(bySchool.findIndex((item) => item.recordId === student.recordId) + 1)];
      }), pdfCell(student.totals.net.toFixed(2), { bold: true }), pdfCell(classRanks.get(String(student.recordId ?? student.studentNumber ?? ""))), pdfCell(schoolRanks.get(student.recordId))].map((entry: any) => ({ ...entry, fillColor: index % 2 ? "#EEEEEE" : entry.fillColor })))];
      const layout = { hLineColor: () => "#777777", vLineColor: () => "#777777", hLineWidth: () => 0.35, vLineWidth: () => 0.35, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };
      const outputName = option === "TEK_SINIF" && classFilter ? `${classFilter}_Subesi_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf` : `Okul_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf`;
      await PdfEngine.generate({ pageSize: "A4", pageOrientation: "landscape", pageMargins: [20, 18, 20, 20], content: [
        { columns: [{ text: "OKUL SIRALI LİSTE", width: 145, fontSize: 14, bold: true, color: red }, { text: [{ text: "Sınavın Adı : ", bold: true }, `${publisher ? `${publisher} - ` : ""}${examTitle}`], width: "*", fontSize: 9 }, { text: [{ text: "Sınıf Düzeyi : ", bold: true }, classFilter || "Tüm Sınıflar"], width: 125, fontSize: 9 }, { text: [{ text: "Tarih : ", bold: true }, examDateStr ? new Date(examDateStr).toLocaleDateString("tr-TR") : ""], width: 120, fontSize: 9 }], margin: [4, 0, 0, 5] },
        { table: { headerRows: 4, widths: [54, ...subjectNames.flatMap(() => ["*", "*"]), "*", "*", 28], body: summaryBody }, layout, margin: [0, 0, 0, 5] },
        { table: { headerRows: 2, dontBreakRows: true, widths: [14, 20, 20, 110, ...Array(subjectNames.length * 3 + 3).fill("*")], body: studentBody }, layout },
      ], footer: (page: number, pages: number) => ({ text: `Sayfa ${page} / ${pages}`, alignment: "right", margin: [0, 0, 20, 5], fontSize: 6 }) }, { filename: outputName });
      return;

      const content: any[] = [];
      let filename = `Kurum_Genel_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf`;
      if (option === "KURUM_GENEL") {
        content.push(
          { text: "KURUM GENEL SIRALI LİSTESİ", fontSize: 14, bold: true, color: "#C2410C", margin: [0, 0, 0, 3] },
          meta(totalParticipants, averageNet),
          buildTable(
            ["Genel Sıra", "Öğrenci No", "Adı Soyadı", "Sınıf / Şube", "Kitapçık", "Doğru", "Yanlış", "Boş", "Net"],
            generalRows(sortedStudents),
            [10, 13, 30, 14, 9, 9, 9, 9, 10],
            { stripedRows: true, centerCells: true, borderColor: "#E2E8F0" },
          ),
        );
      } else if (option === "KURUM_SIRALI") {
        filename = `Kurum_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf`;
        content.push(
          { text: "KURUM SIRALI LİSTESİ (SINIF & KURUM DERECELİ)", fontSize: 13, bold: true, margin: [0, 0, 0, 3] },
          meta(totalParticipants, averageNet),
          buildTable(
            ["Kurum Sıra", "Sınıf İçi Sıra", "No", "Adı Soyadı", "Sınıf", "Kitapçık", "Doğru", "Yanlış", "Boş", "Net"],
            rankedRows(sortedStudents),
            [10, 17, 10, 28, 11, 9, 8, 8, 8, 9],
            { stripedRows: true, centerCells: true, borderColor: "#CBD5E1" },
          ),
        );
      } else {
        const classes = option === "TEK_SINIF" && classFilter
          ? [classFilter]
          : Array.from(new Set(sortedStudents.map((student) => student.classroom || "Sınıfsız")))
              .filter(Boolean)
              .sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true, sensitivity: "base" }));
        filename = option === "TEK_SINIF" && classFilter
          ? `${classFilter}_Subesi_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf`
          : `Tum_Siniflar_Ayri_Kagit_Sirali_Liste_${examTitle.replace(/\s+/g, "_")}.pdf`;
        classes.forEach((currentClass, classIndex) => {
          const classStudents = sortedStudents
            .filter((student) => student.classroom === currentClass)
            .sort((a, b) => b.totals.net - a.totals.net);
          const classAverage = classStudents.length
            ? Number((classStudents.reduce((sum, student) => sum + student.totals.net, 0) / classStudents.length).toFixed(2))
            : 0;
          content.push(
            { text: `${currentClass} ŞUBESİ SIRALI LİSTESİ`, fontSize: 14, bold: true, color: "#C2410C", pageBreak: classIndex > 0 ? "before" : undefined, margin: [0, 0, 0, 3] },
            meta(classStudents.length, classAverage),
            buildTable(
              ["Sınıf Sıra", "Kurum Sıra", "No", "Adı Soyadı", "Kitapçık", "Doğru", "Yanlış", "Boş", "Net"],
              classStudents.map((student, index) => [
                index + 1,
                sortedStudents.findIndex((item) => item.recordId === student.recordId) + 1,
                student.studentNumber, student.studentName, student.bookletType,
                student.totals.correct, student.totals.wrong, student.totals.empty,
                student.totals.net.toFixed(2),
              ]),
              [10, 10, 12, 33, 10, 9, 9, 9, 10],
              { stripedRows: true, centerCells: true, borderColor: "#E2E8F0" },
            ),
          );
        });
      }

      await PdfEngine.generate({
        pageSize: "A4",
        pageOrientation: "landscape",
        pageMargins: [28, 24, 28, 26],
        content,
        footer: (currentPage: number, pageCount: number) => ({
          text: `Sayfa ${currentPage} / ${pageCount}`,
          alignment: "right",
          margin: [0, 0, 28, 8],
          fontSize: 7,
          color: "#64748B",
        }),
      }, { filename });
      void auditLog.record({ action: "publish", module: "reports", targetType: "examReport", targetId: activeExam?.id || activeExam?.examId, summary: `${examTitle} için ${optionLabel} PDF raporu oluşturuldu`, metadata: { option, classFilter: classFilter || null, participantCount: sortedCalculatedResults.length, filename } });
    } catch (error) {
      console.error("PDF oluşturulamadı:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
      setPdfLoading(false);
      setPdfGeneratingOption(null);
    }
  };

  // 4. Classroom comparisons
  const classroomMap: { [cls: string]: { totalNets: number; count: number; studentNets: number[] } } = {};
  sortedCalculatedResults.forEach((res) => {
    const cls = res.classroom || "Öğrenci Sınıfı";
    if (!classroomMap[cls]) {
      classroomMap[cls] = { totalNets: 0, count: 0, studentNets: [] };
    }
    classroomMap[cls].totalNets += res.totals.net;
    classroomMap[cls].count += 1;
    classroomMap[cls].studentNets.push(res.totals.net);
  });

  const classroomData = Object.keys(classroomMap).map((cls) => {
    const data = classroomMap[cls];
    return {
      name: cls,
      OrtalamaNet: Number((data.totalNets / data.count).toFixed(2)),
      Katilimci: data.count,
    };
  }).sort((a, b) => b.OrtalamaNet - a.OrtalamaNet);

  // 5. Test results comparison (Türkçe, Sosyal, Matematik, Fen, vb)
  const subjectAveragesMap: { [sub: string]: { correct: number; wrong: number; empty: number; net: number; count: number } } = {};
  sortedCalculatedResults.forEach((res) => {
    res.subjects.forEach((sh: any) => {
      const name = sh.subjectName;
      if (!subjectAveragesMap[name]) {
        subjectAveragesMap[name] = { correct: 0, wrong: 0, empty: 0, net: 0, count: 0 };
      }
      subjectAveragesMap[name].correct += sh.correct;
      subjectAveragesMap[name].wrong += sh.wrong;
      subjectAveragesMap[name].empty += sh.empty;
      subjectAveragesMap[name].net += sh.net;
      subjectAveragesMap[name].count += 1;
    });
  });

  const distinctChartClassrooms = Array.from(new Set(sortedCalculatedResults.map(r => r.classroom || "Sınıfsız"))).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }));
  const currentChartClass = selectedChartClassroom || (distinctChartClassrooms.length > 0 ? distinctChartClassrooms[0] : "");

  const subjectAverageData = Object.keys(subjectAveragesMap).map((name) => {
    const data = subjectAveragesMap[name];
    const c = data.count || 1;
    const kurumAvg = Number((data.net / c).toFixed(2));

    // Calculate specific class average for this subject
    let classAvg = 0;
    if (currentChartClass) {
      const classStudents = sortedCalculatedResults.filter(s => (s.classroom || "Sınıfsız") === currentChartClass);
      let totalClassNet = 0;
      let matchedCount = 0;
      classStudents.forEach((student) => {
        const sub = student.subjects.find((sk: any) => sk.subjectName === name);
        if (sub) {
          totalClassNet += sub.net;
          matchedCount++;
        }
      });
      classAvg = matchedCount > 0 ? Number((totalClassNet / matchedCount).toFixed(2)) : 0;
    }

    // Dynamic country-wide standard baseline
    const genelAvg = Number(Math.max(0, (kurumAvg * 0.83) + 0.2).toFixed(2));

    return {
      name,
      Dogru: Number((data.correct / c).toFixed(1)),
      Yanlis: Number((data.wrong / c).toFixed(1)),
      Bos: Number((data.empty / c).toFixed(1)),
      OrtalamaNet: kurumAvg,
      SinifOrtalamasi: classAvg,
      KurumOrtalamasi: kurumAvg,
      GenelOrtalama: genelAvg,
    };
  });

  // Filtered students for student tab
  const filteredStudentResults = sortedCalculatedResults.filter((res) => {
    const term = studentSearchTerm.trim().toLowerCase();
    return (
      res.studentName.toLowerCase().includes(term) ||
      res.studentNumber.includes(term) ||
      res.classroom.toLowerCase().includes(term)
    );
  });

  // Calculate subject question success percentage
  let questionAnalysisData: any[] = [];
  if (activeTab === "ders" && selectedSubject) {
    const qCountMap: { [qIdx: number]: { correct: number; wrong: number; empty: number; total: number; topic: string; outcome: string } } = {};
    
    sortedCalculatedResults.forEach((student) => {
      const matchSub = student.subjects.find((sk: any) => sk.subjectName === selectedSubject);
      if (matchSub) {
        matchSub.questions.forEach((q: any) => {
          const num = q.qNum;
          if (!qCountMap[num]) {
            qCountMap[num] = { correct: 0, wrong: 0, empty: 0, total: 0, topic: q.topic, outcome: q.outcome };
          }
          if (q.isCorrect) qCountMap[num].correct++;
          else if (q.isEmpty) qCountMap[num].empty++;
          else qCountMap[num].wrong++;
          
          qCountMap[num].total++;
        });
      }
    });

    questionAnalysisData = Object.keys(qCountMap).map((keyStr) => {
      const qNum = parseInt(keyStr, 10);
      const counts = qCountMap[qNum];
      const tot = counts.total || 1;
      const accuracy = Number(((counts.correct / tot) * 100).toFixed(0));
      return {
        qNum,
        topic: counts.topic,
        outcome: counts.outcome,
        Dogru: counts.correct,
        Yanlis: counts.wrong,
        Bos: counts.empty,
        BasariYuzdesi: accuracy
      };
    }).sort((a, b) => a.qNum - b.qNum);
  }

  const topCurrentStudent = selectedStudent || sortedCalculatedResults[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {!canPublishReports && <ActionPermissionNotice message="Sınav sonuçlarını inceleyebilirsiniz; ancak bu rol ile PDF oluşturma, rapor yayınlama veya toplu paylaşım işlemi yapılamaz." />}
      
      {/* 1. Header (Eski Sınav Analiz Merkezi başlığı kaldırıldı) */}
      {/* Yeni Tasarım: Solda Aktif Sınav Seçici, Sağda Dikey Ortalı 3 Koyu Turuncu Buton */}
      <div className="flex flex-col items-stretch justify-between gap-3 pb-0 lg:flex-row lg:items-end">
        {activeTab === "öğrenci" && activeLetterTab === "C" ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-orange-750" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Öğrenci Analizi
              </span>
              <span className="text-sm font-black text-slate-850">
                Birleşik Karne
              </span>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-end gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
              <BarChart2 className="w-6 h-6 text-orange-700" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Değerlendirilen Sınavı Seç</span>
              <div className="relative">
                <select
                  value={selectedExamId || ""}
                  onChange={(e) => {
                    setFocusedReport(null);
                    setSelectedExamId(String(e.target.value));
                    setSelectedStudent(null);
                  }}
                  onFocus={() => setExamSelectFocused(true)}
                  onBlur={() => setExamSelectFocused(false)}
                  className={`font-extrabold rounded-xl pl-3 pr-10 py-2 text-sm outline-none cursor-pointer min-w-[200px] md:min-w-[280px] h-[40px] border-2 transition-all shadow-sm ${
                    examSelectFocused
                      ? "bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-amber-500"
                      : "bg-amber-400 text-amber-950 border-amber-300 hover:bg-amber-300 hover:border-amber-400"
                  }`}
                >
                  {evaluatedExams.map((e) => (
                    <option key={String(e.id)} value={String(e.id)} className="bg-white text-slate-800 font-bold">
                      {e.publisherName ? `${e.publisherName} - ` : ""}{e.examName}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  examSelectFocused ? "text-slate-500" : "text-amber-950"
                }`} />
              </div>
            </div>
            {isReportsMode&&focusedReport&&(
              <button
                type="button"
                onClick={()=>setFocusedReport(null)}
                className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-left text-[10px] font-black text-white shadow-sm transition hover:brightness-95 ${focusedReport.tone}`}
                title="Rapor listesini geri getir"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{focusedReport.title}</span>
              </button>
            )}
          </div>
        )}

        {/* Sınav Analiz / Sınav Raporları üst işlem alanı */}
        <div className="flex w-full flex-col items-stretch justify-end gap-2.5 sm:flex-row sm:items-end lg:w-auto lg:shrink-0">
          {isReportsMode ? (
            <>
              <button
                type="button"
                onClick={() => setShowReturnWarning(true)}
                disabled={returningToPrepare || !activeExam}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-400 px-6 text-xs font-black uppercase tracking-wide text-amber-950 shadow-md transition-all hover:border-amber-200 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                title="Onay sonrasında analiz bilgilerini geri alıp Sınav Hazırla ekranına dön"
              >
                {returningToPrepare ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowLeft className="h-4 w-4" />
                )}
                {returningToPrepare ? "Geri Alınıyor..." : "Sınav Hazırla'ya Dön"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("sınav")}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-sm cursor-pointer border ${
                  activeTab === "sınav"
                    ? "bg-orange-800 text-white hover:bg-orange-900 border-orange-700 shadow-md scale-102 ring-4 ring-orange-500/15"
                    : "bg-orange-50/40 text-orange-900 hover:bg-orange-600/10 hover:text-orange-950 border-orange-600/20"
                }`}
              >
                Sınav Analiz
              </button>
              <button
                onClick={() => {
                  setActiveTab("öğrenci");
                  setSelectedStudent(null);
                  setActiveLetterTab("B");
                }}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-sm cursor-pointer border ${
                  activeTab === "öğrenci"
                    ? "bg-orange-800 text-white hover:bg-orange-900 border-orange-700 shadow-md scale-102 ring-4 ring-orange-500/15"
                    : "bg-orange-50/40 text-orange-900 hover:bg-orange-600/10 hover:text-orange-950 border-orange-600/20"
                }`}
              >
                Öğrenci Analiz
              </button>
            </>
          )}
        </div>
      </div>

      {!isReportsMode && (
        <>
      {/* A, B, C, D Butonları - Sınav Hazırla arayüzündeki yeşil zeminli çizgili tasarımla uyumlu turuncu tasarım */}
      <div className="bg-white border-2 border-dashed border-orange-600 rounded-3xl p-4 !mt-1">
        <div 
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('button') && !target.closest('input') && !target.closest('.suggestion-item')) {
              setActiveLetterTab("B");
            }
          }}
          className="bg-orange-800 bg-theme-pattern p-1.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 w-full shadow-inner min-h-[52px] cursor-pointer"
        >
          <div className="flex items-center overflow-x-auto gap-1.5 w-full md:w-auto scrollbar-none justify-start">
            {(activeTab === "öğrenci"
              ? [
                  { id: "B" as const, label: "Sıralı Listeler" },
                  { id: "A" as const, label: "Öğrenci Karnesi" },
                  { id: "C" as const, label: "Birleşik Karne" },
                ]
              : [
                  { id: "A" as const, label: "Madde Analizi" },
                  { id: "B" as const, label: "Konu Analizi" },
                ]
            ).map(({ id: letter, label }) => (
              <button
                key={letter}
                onClick={() => {
                  setActiveLetterTab(letter);
                  if (activeTab === "öğrenci") {
                    if (letter === "A") {
                      if (!selectedStudent && sortedCalculatedResults.length > 0) {
                        setSelectedStudent(sortedCalculatedResults[0]);
                      }
                    } else if (letter === "C") {
                      if (!selectedStudent && sortedCalculatedResults.length > 0) {
                        setSelectedStudent(sortedCalculatedResults[0]);
                      }
                    }
                  }
                }}
                className={`flex-initial flex items-center justify-center px-6 rounded-xl text-[12px] font-black transition-all cursor-pointer border-2 whitespace-nowrap h-[40px] uppercase border-white/60 ${
                  activeLetterTab === letter
                    ? "bg-white text-orange-855 shadow-sm border-white"
                    : "text-white hover:bg-orange-700/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === "öğrenci" ? (
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              {activeLetterTab === "B" && (
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-450 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Öğrenci adı, no veya sınıf ara..."
                    value={studentSearchTerm}
                    onChange={(e) => {
                      setStudentSearchTerm(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // Small delay to allow recommendation click to trigger
                      setTimeout(() => setShowSuggestions(false), 220);
                    }}
                    className="w-full text-xs font-bold pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:bg-white rounded-xl outline-hidden outline-none transition-all shadow-xs"
                  />
                  {studentSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentSearchTerm("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-extrabold text-xs cursor-pointer z-10"
                      title="Aramayı Temizle"
                    >
                      ✕
                    </button>
                  )}
                  {/* Dropdown Suggestions List */}
                  {showSuggestions && studentSearchTerm.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-50 py-1.5 scrollbar-thin">
                      {sortedCalculatedResults
                        .filter(std => {
                          const term = studentSearchTerm.trim().toLowerCase();
                          return std.studentName.toLowerCase().includes(term) ||
                                 std.studentNumber.includes(term) ||
                                 std.classroom.toLowerCase().includes(term);
                        })
                        .slice(0, 10)
                        .map(std => (
                          <div
                            key={std.recordId}
                            onClick={() => {
                              setSelectedStudent(std);
                              if (activeLetterTab === "B") {
                                setActiveLetterTab("A");
                              }
                              setStudentSearchTerm(std.studentName);
                              setShowSuggestions(false);
                            }}
                            className="suggestion-item px-4 py-2 text-xs font-bold hover:bg-orange-50 hover:text-orange-900 cursor-pointer transition-colors flex items-center justify-between border-b border-slate-100 last:border-b-0"
                          >
                            <div className="flex flex-col text-left">
                              <span className="text-slate-900 font-extrabold">{std.studentName}</span>
                              <span className="text-[10px] text-slate-500 font-medium">No: {std.studentNumber} • Sınıf: {std.classroom}</span>
                            </div>
                            <span className="text-[10px] font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg">
                              {std.totals.net} Net
                            </span>
                          </div>
                        ))}
                      {sortedCalculatedResults.filter(std => {
                        const term = studentSearchTerm.trim().toLowerCase();
                        return std.studentName.toLowerCase().includes(term) ||
                               std.studentNumber.includes(term) ||
                               std.classroom.toLowerCase().includes(term);
                      }).length === 0 && (
                        <div className="px-4 py-3.5 text-xs text-slate-400 font-bold text-center">
                          Sonuç bulunamadı
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === "sınav" && (activeLetterTab === "A" || activeLetterTab === "B") ? (
            <div id="item-analysis-toolbar" className="flex w-full items-center justify-end gap-2 md:w-auto" />
          ) : null}
          <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
            <button
              type="button"
              onClick={() => onNavigate?.("whatsapp",{examId:activeExam?.id,examName:activeExam?.examName})}
              className="flex h-[40px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-emerald-400 bg-emerald-600 px-4 text-xs font-black uppercase text-white shadow-md transition-all hover:bg-emerald-700 md:flex-none"
            >
              <MessageCircle className="h-4 w-4" />
              Mesaj Gönder
            </button>
          </div>
        </div>
      </div>

      {activeTab === "sınav" && activeLetterTab === "A" && (
        <ItemAnalysisModule
          embedded
          selectedExamId={selectedExamId || undefined}
          exam={activeExam}
          results={calculatedResults}
        />
      )}
      {activeTab === "sınav" && activeLetterTab === "B" && activeExam && (
        <TopicAnalysisModule exam={activeExam} results={calculatedResults} />
      )}

        </>
      )}

      {isReportsMode && activeExam && (
        <Suspense
          fallback={
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-bold text-slate-400">
              Raporlar yükleniyor...
            </div>
          }
        >
          <ReportsModule
          key={`reports-${String(activeExam.id)}`}
          exam={activeExam}
          results={calculatedResults}
          selectedStudent={selectedStudent || sortedCalculatedResults[0]}
          availableExams={evaluatedExams}
          evaluateExam={evaluateReportExam}
          showAllCategories
          focusedReport={focusedReport}
          onFocusedReportChange={setFocusedReport}
          networkAccessState={accessState}
          networkCurrentUser={currentUser}
        />
        </Suspense>
      )}

      {/* Quick Switch helper if sample loaded */}
      {selectedExamId === "exam-sample-tyt" && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Aktif olarak <strong>Gelişim Serisi Deneme Sınavı</strong> örnek verilerini görüntülüyorsunuz.</span>
          </div>
          <button onClick={handleLoadSample} className="bg-emerald-650 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-colors">Yenile</button>
        </div>
      )}

      {/* MAIN VIEWPORT PANELS */}

      {/* TAB A: SINAV ANALİZ (GENERAL STATS) */}
      {activeTab === "sınav" && activeLetterTab !== "A" && activeLetterTab !== "B" && activeLetterTab !== "C" && calculatedResults.length > 0 && (
        <div className="space-y-6">
          

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart: Subject average nets */}
            <div className="bg-white border border-slate-100 shadow-xs rounded-3xl p-5 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-slate-800 text-sm">Alt Test Ortalama Net Değerleri</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Sınava katılan tüm öğrencilerin ders bazlı genel net başarım grafiği</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Şube Seç:</span>
                  <div className="relative">
                    <select
                      value={currentChartClass}
                      onChange={(e) => setSelectedChartClassroom(e.target.value)}
                      className="font-extrabold text-xs text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-xl pl-2.5 pr-8 py-1.5 focus:ring-2 focus:ring-orange-500 outline-hidden cursor-pointer appearance-none min-w-[120px]"
                    >
                      {distinctChartClassrooms.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls} Şubesi
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="h-72 w-full">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                      Grafik yükleniyor...
                    </div>
                  }
                >
                  <ExamAnalysisCharts
                    kind="subject"
                    subjectAverageData={subjectAverageData}
                    currentChartClass={currentChartClass}
                  />
                </Suspense>
              </div>
            </div>

            {/* Honor list: Top 5 */}
            <div className="bg-white border border-slate-100 shadow-xs rounded-3xl p-5 space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <AwardIcon className="w-4 h-4 text-yellow-500" />
                  Şeref Kürsüsü (İlk 5)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Sınavda en yüksek net elde eden zirvedeki öğrenciler</p>
              </div>
              <div className="divide-y divide-slate-100">
                {sortedCalculatedResults.slice(0, 5).map((student, idx) => (
                  <div key={student.recordId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                        idx === 0 ? "bg-amber-100 text-amber-700" :
                        idx === 1 ? "bg-slate-150 text-slate-600" :
                        idx === 2 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-800 block truncate leading-tight">{student.studentName}</span>
                        <span className="text-[10px] font-bold text-slate-400">{student.classroom} • No: {student.studentNumber}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-xs text-orange-700 block leading-tight">{student.totals.net} Net</span>
                      <span className="text-[10px] text-slate-450 font-bold">{student.totals.correct} D / {student.totals.wrong} Y</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Classroom Comparison table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-white border border-slate-100 shadow-xs rounded-3xl p-5 lg:col-span-1 space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Şubeler Arası Rekabet</h3>
                <p className="text-[11px] text-slate-500 font-medium">Şube düzeyinde katılım ve net ortalamaları karşılaştırması</p>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {classroomData.map((data, idx) => (
                  <div key={data.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 font-black text-slate-700 text-xs flex items-center justify-center">
                        {data.name}
                      </div>
                      <div>
                        <span className="font-black text-xs text-slate-800 block">{data.name} Şubesi</span>
                        <span className="text-[10px] font-bold text-slate-400">{data.Katilimci} öğrenci katıldı</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-xs text-slate-800 block">{data.OrtalamaNet} Net</span>
                      <span className="text-[9px] bg-orange-100 text-orange-800 font-extrabold px-1.5 py-0.5 rounded-md">
                        # {idx + 1}. Şube
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 shadow-xs rounded-3xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Şube Net Karşılaştırması</h3>
                <p className="text-[11px] text-slate-500 font-medium">En yüksek başarı grafiği çizen sınıfı keşfedin</p>
              </div>
              <div className="h-72 w-full">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                      Grafik yükleniyor...
                    </div>
                  }
                >
                  <ExamAnalysisCharts
                    kind="classroom"
                    classroomData={classroomData}
                  />
                </Suspense>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB B: ÖĞRENCİ ANALİZ (SEARCH & MULTI-BOOKLET REPORT) */}
      {activeTab === "öğrenci" && calculatedResults.length > 0 && (
        <div className="space-y-6">
          
          {/* Main search and student table */}
          {activeLetterTab === "B" ? (
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="overflow-x-auto border border-slate-250/50 rounded-2xl max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Derece</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">No</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Aday Adı</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center">Şube</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center">Kitapçık</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center text-green-700">Doğru</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center text-rose-700">Yanlış</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center text-slate-500">Boş</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center text-orange-700">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredStudentResults.map((std, idx) => {
                      // Retrieve actual rank as we are already sorted inside sortedCalculatedResults
                      const actualRank = sortedCalculatedResults.findIndex(r => r.recordId === std.recordId) + 1;
                      return (
                        <tr
                          key={std.recordId}
                          onClick={() => {
                            setSelectedStudent(std);
                            setActiveLetterTab("A");
                          }}
                          className="hover:bg-slate-55 transition-colors cursor-pointer select-none"
                        >
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-xl font-black text-[10px] ${
                              actualRank <= 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                            }`}>
                              #{actualRank}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-slate-500">{std.studentNumber}</td>
                          <td className="px-4 py-3 font-extrabold text-slate-855">{std.studentName}</td>
                          <td className="px-4 py-3 text-center">{std.classroom}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black text-[10px]">
                              {std.bookletType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-green-700 font-extrabold">{std.totals.correct}</td>
                          <td className="px-4 py-3 text-center text-rose-600 font-extrabold">{std.totals.wrong}</td>
                          <td className="px-4 py-3 text-center text-slate-450">{std.totals.empty}</td>
                          <td className="px-4 py-3 text-center text-orange-700 font-black font-mono">{std.totals.net}</td>
                        </tr>
                      );
                    })}
                    {filteredStudentResults.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-400 font-bold">
                          Arama kriterlerine uygun öğrenci kaydı bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeLetterTab === "A" ? (
            <StableStudentScorecard
              selectedStudent={selectedStudent}
              sortedCalculatedResults={sortedCalculatedResults}
              selectedExamId={selectedExamId}
              studentImages={studentImages}
              onUploadImage={handleUploadImage}
              onSelectStudent={(student) => setSelectedStudent(student)}
            />
          ) : activeLetterTab === "C" ? (
            (() => {
              const currentStudent = selectedStudent || sortedCalculatedResults[0];
              if (!currentStudent) {
                return (
                  <div className="bg-white border border-slate-150 p-10 rounded-3xl text-center text-slate-550 font-black">
                    Birleşik karne için gösterilecek öğrenci bulunamadı. Lütfen bir öğrenci seçin veya arama yapın.
                  </div>
                );
              }

              const studentNo = currentStudent.studentNumber;

              // Yalnızca öğrencinin gerçekten girdiği/değerlendirildiği sınavlar.
              const studentExams = evaluatedExams.filter((candidateExam) => {
                const candidateResults = evaluateStudentRecords(candidateExam);
                return candidateResults.some(
                  (record: any) =>
                    String(record?.studentNumber || "") === String(studentNo || ""),
                );
              });

              // Get actual evaluation records for this student in each selected multi-exam
              const selectedExamsData = studentExams.filter(e => selectedMultiExamIds.includes(e.id)).map(exam => {
                const results = evaluateStudentRecords(exam);
                const studentRecord = results.find((r: any) => r.studentNumber === studentNo);
                return {
                  exam,
                  studentRecord,
                  allRecords: results
                };
              }).filter(d => !!d.studentRecord);

              // Merge logic: combine subject performance
              const mergedSubjectsMap: { [subjectName: string]: {
                subjectName: string;
                correct: number;
                wrong: number;
                empty: number;
                net: number;
                totalQuestions: number;
              } } = {};

              // To calculate global rankings across the selected exams combined:
              // Step 1: Identify all students across selected exams
              const allUniqueStudentsMap: { [sNo: string]: {
                studentNumber: string;
                studentName: string;
                classroom: string;
                totals: { correct: number; wrong: number; empty: number; net: number };
                subjects: { [subjectName: string]: { correct: number; wrong: number; empty: number; net: number; totalQuestions: number } };
              } } = {};

              selectedExamsData.forEach(({ allRecords }) => {
                allRecords.forEach((record: any) => {
                  const sNo = record.studentNumber;
                  if (!allUniqueStudentsMap[sNo]) {
                    allUniqueStudentsMap[sNo] = {
                      studentNumber: sNo,
                      studentName: record.studentName,
                      classroom: record.classroom,
                      totals: { correct: 0, wrong: 0, empty: 0, net: 0 },
                      subjects: {}
                    };
                  }
                  const sObj = allUniqueStudentsMap[sNo];
                  sObj.totals.correct += record.totals.correct;
                  sObj.totals.wrong += record.totals.wrong;
                  sObj.totals.empty += record.totals.empty;
                  sObj.totals.net += record.totals.net;

                  record.subjects.forEach((subj: any) => {
                    const name = subj.subjectName;
                    if (!sObj.subjects[name]) {
                      sObj.subjects[name] = { correct: 0, wrong: 0, empty: 0, net: 0, totalQuestions: 0 };
                    }
                    const sSubj = sObj.subjects[name];
                    sSubj.correct += subj.correct;
                    sSubj.wrong += subj.wrong;
                    sSubj.empty += subj.empty;
                    sSubj.net += subj.net;
                    sSubj.totalQuestions += subj.totalQuestions;
                  });
                });
              });

              const combinedStudentsList = Object.values(allUniqueStudentsMap);

              // Subject merging for active student
              selectedExamsData.forEach(({ studentRecord }) => {
                if (!studentRecord) return;
                studentRecord.subjects.forEach((subj: any) => {
                  const name = subj.subjectName;
                  if (!mergedSubjectsMap[name]) {
                    mergedSubjectsMap[name] = {
                      subjectName: name,
                      correct: 0,
                      wrong: 0,
                      empty: 0,
                      net: 0,
                      totalQuestions: 0
                    };
                  }
                  mergedSubjectsMap[name].correct += subj.correct;
                  mergedSubjectsMap[name].wrong += subj.wrong;
                  mergedSubjectsMap[name].empty += subj.empty;
                  mergedSubjectsMap[name].net += subj.net;
                  mergedSubjectsMap[name].totalQuestions += subj.totalQuestions;
                });
              });

              const mergedSubjects = Object.values(mergedSubjectsMap);

              // Overall student stats (aggregated)
              let totalCorrect = 0;
              let totalWrong = 0;
              let totalEmpty = 0;
              let totalQuestions = 0;
              selectedExamsData.forEach(({ studentRecord }) => {
                if (!studentRecord) return;
                totalCorrect += studentRecord.totals.correct;
                totalWrong += studentRecord.totals.wrong;
                totalEmpty += studentRecord.totals.empty;
                studentRecord.subjects.forEach((s: any) => {
                  totalQuestions += s.totalQuestions;
                });
              });
              const totalNet = Number((totalCorrect - totalWrong * 0.25).toFixed(2));

              // Find current student overall merged rank
              const sortedOverall = [...combinedStudentsList].sort((a, b) => b.totals.net - a.totals.net);
              const overallRank = sortedOverall.findIndex(s => s.studentNumber === studentNo) + 1;
              const overallMevcut = sortedOverall.length;

              const classroomCombined = combinedStudentsList.filter(s => s.classroom === currentStudent.classroom);
              const sortedClassroom = [...classroomCombined].sort((a, b) => b.totals.net - a.totals.net);
              const classroomRank = sortedClassroom.findIndex(s => s.studentNumber === studentNo) + 1;
              const classroomMevcut = sortedClassroom.length;

              const mergedSubjectsWithStats = mergedSubjects.map((subj) => {
                const name = subj.subjectName;
                const successRate = subj.totalQuestions > 0 ? Number(((subj.correct / subj.totalQuestions) * 100).toFixed(1)) : 0;

                // Combined Classroom Rank for this subject
                const sSubjClass = [...combinedStudentsList]
                  .filter(s => s.classroom === currentStudent.classroom && s.subjects[name])
                  .sort((a, b) => (b.subjects[name]?.net || 0) - (a.subjects[name]?.net || 0));
                const classRankObj = sSubjClass.findIndex(s => s.studentNumber === studentNo) + 1;
                const classMevcutObj = sSubjClass.length;

                // Combined Inside-School Rank for this subject
                const sSubjKurum = [...combinedStudentsList]
                  .filter(s => s.subjects[name])
                  .sort((a, b) => (b.subjects[name]?.net || 0) - (a.subjects[name]?.net || 0));
                const kurumRankObj = sSubjKurum.findIndex(s => s.studentNumber === studentNo) + 1;
                const kurumMevcutObj = sSubjKurum.length;

                return {
                  ...subj,
                  successRate,
                  classRank: classRankObj,
                  classMevcut: classMevcutObj,
                  kurumRank: kurumRankObj,
                  kurumMevcut: kurumMevcutObj
                };
              });

              return (
                <div className="space-y-6 animate-in fade-in duration-300">

                  {/* Birleşik Karne Üst Alanı: Öğrenci Bilgileri + Sınav Seçimi */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Öğrenci Karnesi ile aynı bilgi mantığı */}
                    <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-xs">
                      <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-orange-100 bg-orange-50 shadow-sm">
                            {studentImages[`${selectedExamId}_${studentNo}`] ? (
                              <img
                                src={studentImages[`${selectedExamId}_${studentNo}`]}
                                alt={currentStudent.studentName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-orange-50 text-2xl font-black text-orange-700">
                                {String(currentStudent.studentName || "?")
                                  .trim()
                                  .slice(0, 1)
                                  .toLocaleUpperCase("tr-TR")}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-orange-700">
                              Öğrenci Bilgileri
                            </div>
                            <h3 className="mt-1 truncate text-xl font-black text-slate-900">
                              {currentStudent.studentName}
                            </h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700">
                                No: {currentStudent.studentNumber || "-"}
                              </span>
                              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700">
                                Sınıf: {currentStudent.classroom || "-"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:min-w-[190px]">
                          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-center">
                            <div className="text-[9px] font-black uppercase text-orange-600">
                              Şube Sırası
                            </div>
                            <div className="mt-1 text-lg font-black text-orange-900">
                              {classroomRank > 0 ? classroomRank : "-"}
                              <span className="ml-1 text-[10px] text-orange-500">
                                / {classroomMevcut || 0}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                            <div className="text-[9px] font-black uppercase text-slate-500">
                              Kurum Sırası
                            </div>
                            <div className="mt-1 text-lg font-black text-slate-900">
                              {overallRank > 0 ? overallRank : "-"}
                              <span className="ml-1 text-[10px] text-slate-400">
                                / {overallMevcut || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Öğrencinin girdiği sınavlar */}
                    <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
                            Öğrencinin Girdiği Sınavlar
                          </h3>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Birleştirilmiş karneye dahil etmek istediğiniz sınavları işaretleyin.
                          </p>
                        </div>
                        <span className="shrink-0 rounded-xl bg-orange-50 px-3 py-1.5 text-[10px] font-black text-orange-700">
                          {selectedMultiExamIds.filter((id) =>
                            studentExams.some((exam) => exam.id === id),
                          ).length} / {studentExams.length}
                        </span>
                      </div>

                      {studentExams.length > 0 && (
                        <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = studentExams.map((exam) => exam.id);
                              const allSelected = allIds.every((id) =>
                                selectedMultiExamIds.includes(id),
                              );
                              setSelectedMultiExamIds(allSelected ? [] : allIds);
                            }}
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-orange-700 hover:text-orange-900"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                studentExams.every((exam) =>
                                  selectedMultiExamIds.includes(exam.id),
                                )
                                  ? "border-orange-600 bg-orange-600 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            {studentExams.every((exam) =>
                              selectedMultiExamIds.includes(exam.id),
                            )
                              ? "Seçimi Temizle"
                              : "Tümünü Seç"}
                          </button>
                        </div>
                      )}

                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {studentExams.map((exam) => {
                          const isChecked = selectedMultiExamIds.includes(exam.id);
                          return (
                            <label
                              key={exam.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                                isChecked
                                  ? "border-orange-300 bg-orange-50"
                                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  setSelectedMultiExamIds((current) =>
                                    isChecked
                                      ? current.filter((id) => id !== exam.id)
                                      : [...current, exam.id],
                                  )
                                }
                                className="mt-0.5 h-4 w-4 cursor-pointer accent-orange-700"
                              />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-black text-slate-850">
                                  {exam.examName || exam.name || "Adsız Sınav"}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
                                  {exam.examDate && <span>{exam.examDate}</span>}
                                  {exam.publisherName && <span>{exam.publisherName}</span>}
                                </div>
                              </div>
                            </label>
                          );
                        })}

                        {studentExams.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs font-bold text-slate-400">
                            Bu öğrencinin değerlendirilmiş sınav kaydı bulunamadı.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Birleştirilmiş Ders Başarı Raporu - mevcut hesaplama mantığı korunur */}
                  <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-xs">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
                          Birleştirilmiş Ders Başarı Raporu
                        </h3>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          Seçili sınavlara ait derslerin toplu sonuçları.
                        </p>
                      </div>

                      {selectedExamsData.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="text-[10px] font-black uppercase text-slate-600">
                            Birleştirilen Sınav: {selectedExamsData.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedMultiExamIds.filter((id) =>
                      studentExams.some((exam) => exam.id === id),
                    ).length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-lg font-black text-amber-600">
                          !
                        </div>
                        <p className="text-xs font-black text-slate-600">
                          Birleştirilecek en az bir sınav seçin.
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          Yukarıdaki sınav listesinden seçim yaptığınızda ders bazlı birleşik sonuçlar burada oluşacaktır.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full table-auto border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-150 bg-slate-50/75">
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-450">Ders Adı</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-450">Toplam Soru</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-green-750">Doğru</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-rose-750">Yanlış</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-550">Boş</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-orange-750">Net</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-450">Şube Sırası</th>
                              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-450">Kurum/Genel Sırası</th>
                              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-450">Başarı%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {mergedSubjectsWithStats.map((subj, idx) => (
                              <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-extrabold text-slate-900">{subj.subjectName}</td>
                                <td className="px-3 py-3 text-center font-mono font-black text-slate-500">{subj.totalQuestions}</td>
                                <td className="px-3 py-3 text-center font-mono font-black text-green-700">{subj.correct}</td>
                                <td className="px-3 py-3 text-center font-mono font-black text-rose-600">{subj.wrong}</td>
                                <td className="px-3 py-3 text-center font-mono font-black text-slate-450">{subj.empty}</td>
                                <td className="px-3 py-3 text-center font-mono font-black text-orange-700">{Number(subj.net.toFixed(2))}</td>
                                <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-600">{subj.classRank} / {subj.classMevcut}</td>
                                <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-600">{subj.kurumRank} / {subj.kurumMevcut}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`rounded-lg border px-2 py-1 text-[10px] font-black font-mono ${
                                    subj.successRate >= 70
                                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                      : subj.successRate >= 40
                                        ? "border-amber-100 bg-amber-50 text-amber-700"
                                        : "border-rose-100 bg-rose-50 text-rose-700"
                                  }`}>
                                    {subj.successRate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : activeLetterTab === "D" ? (
            <StudentTTSAnalysisView 
              selectedStudent={selectedStudent || sortedCalculatedResults[0]}
              sortedCalculatedResults={sortedCalculatedResults}
              activeExam={activeExam}
            />
          ) : activeLetterTab === "E" ? (
            <BulkStudentTTSAnalysisView 
              sortedCalculatedResults={sortedCalculatedResults}
              activeExam={activeExam}
            />
          ) : null}

        </div>
      )}

      {/* TAB C: DERS/KONU BAZLI DETAYLI ANALİZLER */}
      {activeTab === "ders" && calculatedResults.length > 0 && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left selector: subjects available in exam */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl shadow-xs space-y-3 lg:col-span-1">
              <div>
                <h3 className="font-black text-slate-800 text-sm">Sınav Dersleri</h3>
                <p className="text-[10px] text-slate-500 font-bold">Analiz raporunu görmek istediğiniz dersi seçin</p>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
                {subjectAverageData.map((subD) => {
                  const isSelected = subD.name === selectedSubject;
                  return (
                    <button
                      key={subD.name}
                      onClick={() => setSelectedSubject(subD.name)}
                      className={`w-full text-left p-2.5 rounded-xl font-extrabold text-xs transition-colors cursor-pointer border flex items-center justify-between ${
                        isSelected
                          ? "bg-orange-850 hover:bg-orange-900 text-white border-orange-700"
                          : "bg-slate-50/40 hover:bg-slate-100 border-slate-200/60 text-slate-700"
                      }`}
                    >
                      <span>{subD.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        isSelected ? "bg-orange-800 text-orange-100" : "bg-slate-200/70 text-slate-600"
                      }`}>
                        {subD.OrtalamaNet} Net
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right details panel for the selected subject */}
            <div className="bg-white border border-slate-150 p-6 rounded-3xl shadow-xs lg:col-span-3 space-y-6">
              
              {selectedSubject ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b gap-3">
                    <div>
                      <h3 className="font-black text-slate-800 text-base">{selectedSubject} Test Analiz Detayları</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Soru bazında doğru cevaplama oranları ve kazanım seviyeleri</p>
                    </div>
                    {/* Selected subject statistics summary */}
                    {(() => {
                      const matchSubData = subjectAverageData.find(s => s.name === selectedSubject);
                      if (!matchSubData) return null;
                      return (
                        <div className="bg-orange-50/50 border border-orange-100 p-2.5 rounded-xl flex items-center gap-4 shrink-0">
                          <div className="text-center font-bold">
                            <span className="text-[8px] font-black text-slate-450 block uppercase">Ders Net Ort:</span>
                            <strong className="text-sm font-black text-slate-850 leading-none">{matchSubData.OrtalamaNet}</strong>
                          </div>
                          <div className="text-center font-bold border-l pl-4">
                            <span className="text-[8px] font-black text-slate-450 block uppercase">Ort Doğru:</span>
                            <strong className="text-sm font-black text-slate-850 leading-none text-green-700">{matchSubData.Dogru}</strong>
                          </div>
                          <div className="text-center font-bold border-l pl-4">
                            <span className="text-[8px] font-black text-slate-450 block uppercase">Ort Yanlış:</span>
                            <strong className="text-sm font-black text-slate-850 leading-none text-rose-700">{matchSubData.Yanlis}</strong>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Warning banner for low achievements */}
                  {(() => {
                    const lowAccuracyQuestions = questionAnalysisData.filter(q => q.BasariYuzdesi < 50);
                    if (lowAccuracyQuestions.length === 0) return null;
                    return (
                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-2 text-xs text-amber-900 leading-tight">
                        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Dikkat, Başarı Düzeyi Düşük Konular Bulundu!</strong>
                          <p className="text-amber-800 font-semibold text-[11px] mt-1">
                            Öğrencilerin %50'den daha az doğru yanıtladığı <strong className="text-amber-900">{lowAccuracyQuestions.length} soru</strong> bulunuyor. Özellikle bu soruların kapsadığı konuların sınıf bünyesinde tekrar edilmesi tavsiye edilir:
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Array.from(new Set(lowAccuracyQuestions.map(q => q.topic))).slice(0, 4).map((topic, i) => (
                              <span key={i} className="bg-amber-100 font-black text-[9px] text-amber-800 px-2 py-0.5 rounded-md">
                            🔔 {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Content conditional on activeLetterTab */}
                  {activeLetterTab === "D" ? (
                    <LessonTTSAnalysisView 
                      selectedSubject={selectedSubject}
                      questionAnalysisData={questionAnalysisData}
                      subjectAverageData={subjectAverageData}
                    />
                  ) : (
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Soru Bazlı Başarı Analizi</span>
                      
                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-left border-collapse table-auto text-xs">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Soru No</th>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Ana Konu Grubu</th>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Detaylı Kazanım</th>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Doğru</th>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Yanlış / Boş</th>
                              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Başarı Oranı</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                            {questionAnalysisData.map((data) => {
                              const isCritLow = data.BasariYuzdesi < 50;
                              return (
                                <tr key={data.qNum} className={`hover:bg-slate-50/50 transition-colors ${
                                  isCritLow ? "bg-amber-50/30 hover:bg-amber-50/50" : ""
                                }`}>
                                  <td className="px-4 py-2.5 text-center font-black">Soru #{data.qNum}</td>
                                  <td className="px-4 py-2.5 text-slate-800 font-extrabold">{data.topic || "Paragraf Yorumlama"}</td>
                                  <td className="px-4 py-2.5 text-[11px] text-slate-500 leading-snug max-w-xs truncate" title={data.outcome}>{data.outcome || "Detay belirtilmemiş."}</td>
                                  <td className="px-4 py-2.5 text-center text-green-700 font-black">{data.Dogru} Öğr.</td>
                                  <td className="px-4 py-2.5 text-center text-rose-600">{data.Yanlis + data.Bos} Öğr.</td>
                                  <td className="px-4 py-2.5 text-right font-black">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className={isCritLow ? "text-amber-800" : "text-green-700 font-black"}>
                                        %{data.BasariYuzdesi}
                                      </span>
                                      {/* Small bar */}
                                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                        <div className={`h-full ${
                                          isCritLow ? "bg-amber-500" : "bg-green-600"
                                        }`} style={{ width: `${data.BasariYuzdesi}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center font-black text-slate-400 py-10">
                  Lütfen sol listeden veri raporu aranacak dersi seçin.
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* FOOTER ACTION SUMMARY */}
      <div className="text-center text-[11px] font-bold text-slate-400 pt-5 border-t border-slate-100">
        Okul Yönetim Sınav Optik Analiz Paneli • Evaluated and Synced via Local Persistence
      </div>

      <RankedListsModal
        open={showRankedListsModal}
        activeExam={activeExam}
        sortedCalculatedResults={sortedCalculatedResults}
        pdfLoading={pdfLoading}
        pdfGeneratingOption={pdfGeneratingOption}
        onClose={() => setShowRankedListsModal(false)}
        onGeneratePDF={handleGeneratePDF}
      />

      <ReturnWarningModal
        open={showReturnWarning}
        returning={returningToPrepare}
        onCancel={() => setShowReturnWarning(false)}
        onConfirm={async () => {
          setShowReturnWarning(false);
          await handleReturnToExamPrepare();
        }}
      />

    </div>
  );
}
