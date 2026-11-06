import { parseQuestionGroupFileName } from "../utils/questionUploadFileName";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart2,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileSearch,
  Image as ImageIcon,
  ListChecks,
  Lock,
  Minus,
  RotateCcw,
  Printer,
  Save,
  UserCheck,
  RefreshCw,
  Unlock,
} from "lucide-react";
import { isValidMhatsappNumber, loadMhatsappSettings, normalizeMhatsappNumber, sendTextMessage } from "../lib/mhatsappApi";

import { sqliteStorage } from "../core/state/SyncStateStore";
import {
  checkQuestionBankExamConflicts,
  recordQuestionBankUsage,
  removeQuestionBankUsage,
} from "../lib/localDatabase";

type CurriculumQuestion = {
  id?: string;
  order?: number;
  answer?: string;
  code?: string;
  fileName?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  thumbnailUrl?: string;
  storagePath?: string;
  mimeType?: string;
  createdAt?: string;
};

type CurriculumOutcome =
  | string
  | {
      id?: string;
      name?: string;
      questions?: CurriculumQuestion[];
    };

type CurriculumTopic = {
  id: string;
  name: string;
  questions?: CurriculumQuestion[];
  outcomes?: CurriculumOutcome[];
  objectives?: CurriculumOutcome[];
};

type CurriculumUnit = {
  id: string;
  name: string;
  questions?: CurriculumQuestion[];
  topics?: CurriculumTopic[];
};

type CatalogCourse = {
  id: string;
  name: string;
  grade: string;
  units: CurriculumUnit[];
};

type ScopeLevel = "unit" | "topic" | "outcome";

type QuestionBankItem = {
  key: string;
  scopeLevel: ScopeLevel;
  courseId: string;
  courseName: string;
  grade: string;
  unitId: string;
  unitName: string;
  topicId: string;
  topicName: string;
  outcomeId: string;
  outcomeName: string;
  questionId: string;
  order: number;
  answer: string;
  code: string;
  fileName: string;
  imageUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  columnSpan?: 1 | 2;
  questionGroupId?: string;
  questionGroupMode?: "required" | "free";
  questionGroupLayout?: "normal" | "full-width-source";
  questionGroupOrder?: number;
  questionGroupSize?: number;
  questionGroupTitle?: string;
  questionGroupInstructionText?: string;
  questionGroupInstructionImageUrl?: string;
  questionGroupInstructionQuestionId?: string;
  pdfGroupLeaderImageUrl?: string;
  pdfGroupInstructionHeightMm?: number;
  pdfGroupQuestionCount?: number;
  pdfGroupQuestionKeys?: string[];
  pdfGroupInstructionVisible?: boolean;
  // PDF üretiminde eski snapshot/canonical farklarından bağımsız kesin Gxx çözümü.
  pdfDetectedGroupToken?: string;
  pdfDetectedGroupOrder?: number;
  pdfResolvedGroupId?: string;
};

type QuestionBankApiRecord = {
  id?: string;
  questionId?: string;
  questionCode?: string;
  code?: string;
  grade?: number | string;
  courseId?: string;
  unitId?: string;
  topicId?: string;
  outcomeId?: string;
  answer?: string;
  order?: number;
  fileName?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  storagePath?: string;
  status?: string;
  question_id?: string;
  question_code?: string;
  course_id?: string;
  unit_id?: string;
  topic_id?: string;
  outcome_id?: string;
  file_name?: string;
  image_url?: string;
  thumbnail_url?: string;
  storage_path?: string;
  columnSpan?: 1 | 2;
  column_span?: number;
  use_count?: number;
  questionType?: "exam" | "study";
  question_type?: "exam" | "study";
  questionGroupId?: string;
  questionGroupMode?: "required" | "free";
  questionGroupLayout?: "normal" | "full-width-source";
  questionGroupOrder?: number;
  questionGroupSize?: number;
  questionGroupTitle?: string;
  questionGroupInstructionText?: string;
  questionGroupInstructionImageUrl?: string;
  questionGroupInstructionQuestionId?: string;
};

type TestDefinitionType = "unit" | "topic" | "outcome";
type TestDefinition = {
  name: string;
  type: TestDefinitionType;
  grade: string;
  courseId: string;
  unitId: string;
  topicId: string;
  outcomeId: string;
  columnCount?: 2 | 3;
  questionSpacing?: number;
  showAnswersInPdf?: boolean;
};

type SavedTestDefinition = TestDefinition & {
  id: string;
  createdAt: string;
  updatedAt: string;
  status?: "active" | "cancelled";
  cancelledAt?: string;
  selectedQuestionKeys?: string[];
  selectedQuestionSnapshots?: QuestionBankItem[];

  // Test soru seçimi öğretmene verildiğinde test tanımı hemen kaydedilir;
  // testin soru seti ise öğretmen "Gönder" dediğinde tamamlanır.
  questionSelectionMode?: "admin" | "teacher";
  assignedTeacherId?: string;
  assignedTeacherName?: string;
  requiredQuestionCount?: number;
  questionCountMode?: "fixed" | "flexible";
  buildStatus?: "draft" | "awaiting_teacher" | "ready";
  readyAt?: string;
  finalizedAt?: string;
  questionsLocked?: boolean;
  questionsLockedAt?: string;
};

const savedTestQuestionsLocked = (saved?: SavedTestDefinition | null) => {
  if (!saved) return false;
  if (typeof saved.questionsLocked === "boolean") return saved.questionsLocked;
  return Boolean(saved.finalizedAt);
};

type ScopeTestPicker = {
  title: string;
  tests: SavedTestDefinition[];
} | null;

type TeacherLinkSummary = {
  id: string;
  teacherId: string;
  teacherName: string;
  phone?: string;
  token?: string;
  url?: string;
  active?: boolean;
  expiresAt?: string;
};

type TeacherAssignmentScopeOutcome = {
  id: string;
  name: string;
  questions?: QuestionBankItem[];
};

type TeacherAssignmentScopeTopic = {
  id: string;
  name: string;
  outcomes: TeacherAssignmentScopeOutcome[];
};

type TeacherAssignmentScopeUnit = {
  id: string;
  name: string;
  topics: TeacherAssignmentScopeTopic[];
};

type TeacherTestAssignment = {
  assignmentKind?: "exam" | "test";
  workflowType?: "exam-question-selection" | "test-question-selection";
  id: string;
  testId: string;
  testName: string;
  testType: TestDefinitionType;
  grade: string;
  courseId: string;
  courseName: string;
  unitId: string;
  topicId: string;
  outcomeId: string;
  teacherId: string;
  teacherName: string;
  scopeTree: TeacherAssignmentScopeUnit[];
  questionPoolUpdatedAt?: string;
  questionPoolLocked?: boolean;
  requiredQuestionCount?: number;
  maxQuestionCount?: number;
  questionCountMode?: "fixed" | "flexible";
  availableQuestionSnapshots?: QuestionBankItem[];
  selectedQuestionKeys: string[];
  selectedQuestionSnapshots: QuestionBankItem[];
  selectedQuestionCount?: number;
  remainingQuestionCount?: number;
  selectionStatus?: "in_progress" | "completed";
  selectionRevision?: number;
  questionUsageLocked?: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type TestScopeSummary = {
  type: "Kazanım Testi" | "Konu Testi" | "Ünite Testi" | "Karma Test";
  description: string;
  topicCount: number;
  outcomeCount: number;
};

const passiveButtonClass =
  "flex h-[40px] flex-initial cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-white/60 px-5 text-[11px] font-bold text-white/75 opacity-80";

const readJson = (key: string, fallback: any) => {
  try {
    return JSON.parse(sqliteStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
};

const gradeNumber = (value: any) =>
  String(value || "").match(/\d{1,2}/)?.[0] || "";

const normalizeName = (value: any) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

const normalizeCatalogToken = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "");

const TEST_PANEL_CURRICULUM_COURSE_NAMES: Record<string, string> = {
  "1": "Türk Dili ve Edebiyatı",
  "2": "Tarih",
  "3": "Coğrafya",
  "4": "Felsefe",
  "5": "Din Kültürü ve Ahlak Bilgisi",
  "7": "Matematik",
  "8": "Fizik",
  "9": "Kimya",
  "10": "Biyoloji",
};

// Müfredatta ders kodu temel dersi (örn. 7 = Matematik) temsil ederken okulda
// aynı ders "S. Matematik" / "Seçmeli Matematik" adıyla tanımlanabilir. Test
// Paneli dersleri yalnızca görünen ada göre değil, bu temel ders ailesine göre
// de eşleştirir; kullanıcıya ise okulda kullanılan gerçek ders adını gösterir.
const TEST_PANEL_CANONICAL_COURSE_TOKENS = new Set(
  Object.values(TEST_PANEL_CURRICULUM_COURSE_NAMES).map(normalizeCatalogToken),
);

const normalizeCourseFamilyToken = (value: unknown) => {
  const token = normalizeCatalogToken(value);
  if (!token) return "";

  const candidates = [
    token.replace(/^SECMELI/, ""),
    token.replace(/^SEC/, ""),
    token.replace(/^S/, ""),
  ].filter(Boolean);

  const canonical = candidates.find((candidate) =>
    TEST_PANEL_CANONICAL_COURSE_TOKENS.has(candidate),
  );

  return canonical || token;
};

const isElectiveCourseDisplayName = (value: unknown) => {
  const text = String(value || "").trim();
  return /^(?:S\s*\.|S\s+|SEÇMELİ\s+|SECMELI\s+)/i.test(text);
};

const canonicalCourseId = (courseId: unknown, ...hierarchyIds: unknown[]) => {
  for (const value of hierarchyIds) {
    const parts = String(value || "").split(".").filter(Boolean);
    if (parts.length >= 2 && /^(9|10|11|12)$/.test(parts[0])) return parts[1];
  }
  const raw = String(courseId || "");
  const virtual = raw.match(/^CURR-(?:9|10|11|12)-(.+)$/i);
  return virtual?.[1] || raw;
};

const outcomeIdOf = (outcome: CurriculumOutcome, index: number) =>
  typeof outcome === "string"
    ? outcome
    : String(outcome?.id || outcome?.name || `outcome-${index}`);

const outcomeNameOf = (outcome: CurriculumOutcome) =>
  typeof outcome === "string"
    ? outcome
    : String(outcome?.name || outcome?.id || "Kazanım");

type TestPanelCatalogRuntimeSources = {
  classrooms?: any[];
  courses?: any[];
  customCreatedCourses?: any[];
};

function loadCourseCatalog(runtimeSources: TestPanelCatalogRuntimeSources = {}): CatalogCourse[] {
  const curriculumStores = {
    ...readJson("rota_curriculum_store_v1", {}),
    ...readJson("course_curriculums_v1", {}),
  };

  const storedCustomCourses = readJson("custom_created_courses", []);
  const storedSchoolCourses = readJson("school_courses", []);
  const storedSchoolClassrooms = readJson("school_classrooms", []);
  const selectedByGrade = readJson("curriculum_selected_courses_by_grade_v1", {});

  // App.tsx okul verilerini öncelikle localForage/aktif React state üzerinden
  // yükler. Test Paneli yalnız sqliteStorage anahtarlarını okursa özellikle
  // S. Matematik gibi özel adlandırılmış dersler aktif ekranda var olduğu halde
  // katalogda kaybolabilir. Bu yüzden çalışan uygulamanın güncel state'i birinci
  // kaynak; SQLite aynası yalnız geri dönüş kaynağıdır.
  const runtimeCustomCourses = Array.isArray(runtimeSources.customCreatedCourses)
    ? runtimeSources.customCreatedCourses
    : [];
  const runtimeSchoolCourses = Array.isArray(runtimeSources.courses)
    ? runtimeSources.courses
    : [];
  const runtimeSchoolClassrooms = Array.isArray(runtimeSources.classrooms)
    ? runtimeSources.classrooms
    : [];

  const customCourses = [
    ...runtimeCustomCourses,
    ...(Array.isArray(storedCustomCourses) ? storedCustomCourses : []),
  ];
  const schoolCourses = [
    ...runtimeSchoolCourses,
    ...(Array.isArray(storedSchoolCourses) ? storedSchoolCourses : []),
  ];
  const schoolClassrooms = [
    ...runtimeSchoolClassrooms,
    ...(Array.isArray(storedSchoolClassrooms) ? storedSchoolClassrooms : []),
  ];

  const courseSources = [...customCourses, ...schoolCourses];

  type RecoverableCourse = {
    name: string;
    grade: string;
    ids: string[];
  };

  const recoverableCourses: RecoverableCourse[] = [];

  const addRecoverableCourse = (
    rawName: unknown,
    rawGrade: unknown,
    ...rawIds: unknown[]
  ) => {
    const name = String(rawName || "").trim();
    const grade = gradeNumber(rawGrade);
    if (!name || !grade) return;

    const ids = rawIds
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const identity = `${grade}-${normalizeCatalogToken(name)}`;
    const existing = recoverableCourses.find(
      (item) => `${item.grade}-${normalizeCatalogToken(item.name)}` === identity,
    );

    if (existing) {
      existing.ids = [...new Set([...existing.ids, ...ids])];
      return;
    }

    recoverableCourses.push({ name, grade, ids });
  };

  courseSources.forEach((course: any) => {
    addRecoverableCourse(
      course?.courseName || course?.name,
      course?.gradeLevel || course?.level || course?.grade,
      course?.id,
      course?.courseId,
      course?.curriculumCourseId,
      course?.courseCode,
      course?.code,
    );
  });

  if (Array.isArray(schoolClassrooms)) {
    schoolClassrooms.forEach((classroom: any) => {
      const grade =
        gradeNumber(classroom?.level) ||
        gradeNumber(classroom?.gradeLevel) ||
        gradeNumber(classroom?.name);

      (Array.isArray(classroom?.assignedCourses)
        ? classroom.assignedCourses
        : []
      ).forEach((course: any) => {
        addRecoverableCourse(
          course?.courseName || course?.name,
          grade,
          course?.id,
          course?.courseId,
          course?.curriculumCourseId,
          course?.courseCode,
          course?.code,
        );
      });
    });
  }

  if (selectedByGrade && typeof selectedByGrade === "object") {
    Object.entries(selectedByGrade).forEach(([gradeKey, names]) => {
      const grade = gradeNumber(gradeKey);
      if (!grade || !Array.isArray(names)) return;
      names.forEach((name) => addRecoverableCourse(name, grade));
    });
  }

  const hierarchyMetadata = (curriculum: any) => {
    const candidates: unknown[] = [];

    (Array.isArray(curriculum?.units) ? curriculum.units : []).forEach(
      (unit: any) => {
        candidates.push(unit?.id);
        (Array.isArray(unit?.topics) ? unit.topics : []).forEach(
          (topic: any) => {
            candidates.push(topic?.id);
            const outcomes = Array.isArray(topic?.outcomes)
              ? topic.outcomes
              : Array.isArray(topic?.objectives)
                ? topic.objectives
                : [];
            outcomes.forEach((outcome: any) => {
              if (outcome && typeof outcome === "object") {
                candidates.push(outcome?.id);
              }
            });
          },
        );
      },
    );

    for (const value of candidates) {
      const match = String(value || "").match(/^(9|10|11|12)\.([^.]+)/);
      if (match) return { grade: match[1], courseCode: match[2] };
    }

    return { grade: "", courseCode: "" };
  };

  const catalog: CatalogCourse[] = [];
  const seen = new Set<string>();

  Object.entries(curriculumStores || {}).forEach(([storageKey, rawCurriculum]) => {
    const curriculum = (rawCurriculum || {}) as any;
    const storageCourseId = String(storageKey).replace(/^curriculum_/, "");
    const virtualMatch = storageCourseId.match(
      /^CURR-(9|10|11|12)-(.+)$/i,
    );
    const hierarchy = hierarchyMetadata(curriculum);

    const inferredGrade =
      gradeNumber(curriculum?.grade) ||
      gradeNumber(curriculum?.gradeLevel) ||
      gradeNumber(virtualMatch?.[1]) ||
      gradeNumber(hierarchy.grade);

    const inferredCourseCode = String(
      curriculum?.courseCode ||
        curriculum?.courseId ||
        hierarchy.courseCode ||
        virtualMatch?.[2] ||
        "",
    ).trim();

    const storageToken = normalizeCatalogToken(storageCourseId);
    const codeToken = normalizeCatalogToken(inferredCourseCode);
    const suffixToken = normalizeCatalogToken(virtualMatch?.[2] || "");
    const knownCourseNameByCode =
      TEST_PANEL_CURRICULUM_COURSE_NAMES[inferredCourseCode] ||
      TEST_PANEL_CURRICULUM_COURSE_NAMES[String(virtualMatch?.[2] || "")] ||
      "";

    const source = courseSources.find((course: any) => {
      const ids = [
        course?.id,
        course?.courseId,
        course?.curriculumCourseId,
        course?.courseCode,
        course?.code,
      ]
        .map((value) => normalizeCatalogToken(value))
        .filter(Boolean);

      const courseGrade =
        gradeNumber(course?.gradeLevel) ||
        gradeNumber(course?.level) ||
        gradeNumber(course?.grade);

      const idMatch =
        ids.includes(storageToken) ||
        (codeToken && ids.includes(codeToken)) ||
        (suffixToken && ids.includes(suffixToken));

      const courseName = String(course?.courseName || course?.name || "").trim();
      const familyMatch = Boolean(
        knownCourseNameByCode &&
          courseName &&
          normalizeCourseFamilyToken(courseName) ===
            normalizeCourseFamilyToken(knownCourseNameByCode),
      );

      return (idMatch || familyMatch) &&
        (!inferredGrade || !courseGrade || courseGrade === inferredGrade);
    });

    const recoveredCourse = recoverableCourses.find((course) => {
      if (inferredGrade && course.grade !== inferredGrade) return false;

      const nameToken = normalizeCatalogToken(course.name);
      const idTokens = course.ids.map(normalizeCatalogToken);

      const familyMatch = Boolean(
        knownCourseNameByCode &&
          normalizeCourseFamilyToken(course.name) ===
            normalizeCourseFamilyToken(knownCourseNameByCode),
      );

      return Boolean(
        idTokens.includes(storageToken) ||
          (codeToken && idTokens.includes(codeToken)) ||
          (suffixToken && idTokens.includes(suffixToken)) ||
          (suffixToken && nameToken === suffixToken) ||
          (codeToken && nameToken === codeToken) ||
          familyMatch,
      );
    });

    const grade =
      gradeNumber(curriculum?.grade) ||
      gradeNumber(curriculum?.gradeLevel) ||
      gradeNumber(source?.gradeLevel) ||
      gradeNumber(source?.level) ||
      gradeNumber(source?.grade) ||
      recoveredCourse?.grade ||
      inferredGrade;

    const storedCourseName = String(curriculum?.courseName || "").trim();
    const sourceCourseName = String(source?.courseName || source?.name || "").trim();
    const recoveredCourseName = String(recoveredCourse?.name || "").trim();

    // Eski kayıtlarda courseName yalnızca "Matematik" olarak kalmış olabilir.
    // Aynı sınıfta seçili gerçek ders adı "S. Matematik" ise onu koru.
    const electiveRecoveredName = [recoveredCourseName, sourceCourseName].find(
      (candidate) =>
        candidate &&
        isElectiveCourseDisplayName(candidate) &&
        normalizeCourseFamilyToken(candidate) ===
          normalizeCourseFamilyToken(storedCourseName || knownCourseNameByCode),
    );

    const name = String(
      electiveRecoveredName ||
        storedCourseName ||
        sourceCourseName ||
        recoveredCourseName ||
        knownCourseNameByCode ||
        "",
    ).trim();

    const units = Array.isArray(curriculum?.units) ? curriculum.units : [];

    if (!name || !grade) return;

    const dedupeKey = `${grade}-${normalizeName(name)}`;
    if (seen.has(dedupeKey)) {
      const existingIndex = catalog.findIndex(
        (item) =>
          item.grade === grade &&
          normalizeName(item.name) === normalizeName(name),
      );
      const existingUnits =
        existingIndex >= 0 && Array.isArray(catalog[existingIndex]?.units)
          ? catalog[existingIndex].units
          : [];

      // Aynı sınıf/ders için birden fazla müfredat kaydı varsa, Yeni Test
      // penceresinde ünite/konu seçilebilmesi için dolu müfredat kaydını koru.
      if (existingIndex >= 0 && existingUnits.length === 0 && units.length > 0) {
        catalog[existingIndex] = {
          id: storageCourseId,
          name,
          grade,
          units,
        };
      }
      return;
    }
    seen.add(dedupeKey);

    catalog.push({
      id: storageCourseId,
      name,
      grade,
      units,
    });
  });

  return catalog.sort(
    (a, b) =>
      Number(a.grade) - Number(b.grade) ||
      a.name.localeCompare(b.name, "tr-TR"),
  );
}

function toQuestionItem(
  course: CatalogCourse,
  unit: CurriculumUnit,
  question: CurriculumQuestion,
  questionIndex: number,
  scopeLevel: ScopeLevel,
  topic?: CurriculumTopic,
  outcome?: CurriculumOutcome,
  outcomeIndex = 0,
): QuestionBankItem {
  const topicId = topic ? String(topic.id) : "";
  const topicName = topic ? String(topic.name || topic.id) : "";
  const outcomeId =
    outcome && typeof outcome !== "string"
      ? outcomeIdOf(outcome, outcomeIndex)
      : outcome
        ? outcomeIdOf(outcome, outcomeIndex)
        : "";
  const outcomeName = outcome ? outcomeNameOf(outcome) : "";

  const answerForCard = String(question?.answer || "").toUpperCase();
  const questionCardName = (base: string) => {
    const clean = String(base || `Soru ${questionIndex + 1}`)
      .replace(/\.[^/.]+$/, "")
      .replace(/\s+/g, "_");
    return `${clean}_${answerForCard || "CEVAP_YOK"}`;
  };

  const questionId = String(
    question?.id ||
      question?.code ||
      question?.fileName ||
      `question-${questionIndex}`,
  );

  return {
    key: [
      course.id,
      String(unit.id),
      topicId || "-",
      outcomeId || "-",
      scopeLevel,
      questionId,
    ].join("::"),
    scopeLevel,
    courseId: course.id,
    courseName: course.name,
    grade: course.grade,
    unitId: String(unit.id),
    unitName: String(unit.name || unit.id),
    topicId,
    topicName,
    outcomeId,
    outcomeName,
    questionId,
    order: Number(question?.order || questionIndex + 1),
    answer: String(question?.answer || "").toUpperCase(),
    code: questionCardName(
      question?.code ||
        question?.fileName ||
        `Soru ${questionIndex + 1}`,
    ),
    fileName: String(question?.fileName || ""),
    imageUrl: String(
      question?.imageUrl ||
        question?.imageDataUrl ||
        "",
    ),
    thumbnailUrl: String(question?.thumbnailUrl || ""),
    storagePath: String(question?.storagePath || ""),
  };
}

const fileNameQuestionGroupStem = (value: unknown) => {
  let source = String(value || "").trim();
  if (!source) return "";
  source = source.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  try { source = decodeURIComponent(source); } catch {}
  source = source.split("/").filter(Boolean).pop() || source;
  return source.replace(/\.(?:png|jpe?g|webp)$/i, "").trim();
};

const fileNameQuestionGroupPartsFromValue = (value: unknown) => {
  const modern = parseQuestionGroupFileName(value);
  if (modern) return { token: modern.token, order: modern.order, modern: true, isInstruction: modern.isInstruction };
  const stem = fileNameQuestionGroupStem(value);
  if (!stem) return null;

  /*
   * Gxx tespiti PDF için olabildiğince toleranslıdır. Kayıtlar zaman içinde
   * ..._001_G01_A, G01_001_A, ...-001-G01-A veya farklı ayraçlarla saklanmış
   * olabilir. Aynı grubun ilk sıra numaralı kartını kesin olarak yönerge
   * ayırabilmek için Gxx token'ını ayraçtan bağımsız yakalıyoruz.
   */
  // Gxx yalnız bağımsız bir dosya adı tokenıysa grup kabul edilir.
  // Örn. `_G01_`, `-G02-`, `.G03.` geçerlidir; `img1`, `page2` gibi
  // kelimelerin içindeki g+rakama kesinlikle grup muamelesi yapılmaz.
  const tokenMatches = Array.from(
    stem.matchAll(/(?:^|[_\-.\s])(G\d{1,3})(?=$|[_\-.\s])/gi),
  );
  const tokenMatch = tokenMatches.length ? tokenMatches[tokenMatches.length - 1] : null;
  if (!tokenMatch) return null;

  const rawToken = String(tokenMatch[1] || "").toUpperCase();
  const tokenNumber = Number(rawToken.replace(/\D/g, ""));
  const token = Number.isFinite(tokenNumber)
    ? `G${String(tokenNumber).padStart(2, "0")}`
    : rawToken;
  const fullMatch = String(tokenMatch[0] || "");
  const tokenOffsetInMatch = Math.max(0, fullMatch.toUpperCase().lastIndexOf(rawToken));
  const tokenIndex = Number(tokenMatch.index || 0) + tokenOffsetInMatch;

  const beforeText = stem.slice(0, tokenIndex);
  const afterText = stem.slice(tokenIndex + rawToken.length);
  const beforeNumbers = Array.from(beforeText.matchAll(/(?:^|[_\-.\s])(\d+)(?=$|[_\-.\s])/g));
  const afterNumbers = Array.from(afterText.matchAll(/(?:^|[_\-.\s])(\d+)(?=$|[_\-.\s])/g));
  const newStyleQuestionOrder = afterText.match(/(?:^|[_\-.\s])S[_-]?(\d+)(?=$|[_\-.\s])/i)?.[1] || "";
  const nearestBefore = beforeNumbers.length ? beforeNumbers[beforeNumbers.length - 1][1] : "";
  const nearestAfter = newStyleQuestionOrder || (afterNumbers.length ? afterNumbers[0][1] : "");

  return {
    order: Math.max(0, Number(nearestBefore || nearestAfter || 0)),
    token,
    modern: false,
    isInstruction: false,
  };
};

const fileNameQuestionGroupParts = (question: Partial<QuestionBankItem> | QuestionBankApiRecord | null | undefined) => {
  const candidates = [
    (question as any)?.originalFileName,
    (question as any)?.original_file_name,
    (question as any)?.originalName,
    (question as any)?.original_name,
    (question as any)?.fileName,
    (question as any)?.file_name,
    (question as any)?.name,
    (question as any)?.displayName,
    (question as any)?.display_name,
    (question as any)?.code,
    (question as any)?.questionCode,
    (question as any)?.question_code,
    (question as any)?.questionId,
    (question as any)?.question_id,
    (question as any)?.id,
    (question as any)?.key,
    (question as any)?.storagePath,
    (question as any)?.storage_path,
    (question as any)?.imageUrl,
    (question as any)?.image_url,
    (question as any)?.thumbnailUrl,
    (question as any)?.thumbnail_url,
  ];
  for (const candidate of candidates) {
    const parsed = fileNameQuestionGroupPartsFromValue(candidate);
    if (parsed) return parsed;
  }
  return null;
};

const questionGroupIdForTest = (question: Partial<QuestionBankItem> | QuestionBankApiRecord | null | undefined) => {
  const pdfResolved = String((question as any)?.pdfResolvedGroupId || "").trim();
  if (pdfResolved) return pdfResolved;

  const explicit = String((question as any)?.questionGroupId || (question as any)?.groupId || "").trim();
  const parsed = fileNameQuestionGroupParts(question);
  const explicitTokenMatch = explicit.match(/G\d{1,3}/i)?.[0] || "";
  const tokenNumber = Number(String(parsed?.token || explicitTokenMatch).replace(/\D/g, ""));
  const normalizedToken = Number.isFinite(tokenNumber) && tokenNumber > 0
    ? `G${String(tokenNumber).padStart(2, "0")}`
    : String(parsed?.token || explicitTokenMatch || "").toUpperCase();

  /*
   * KESİN Gxx GRUP KİMLİĞİ KURALI:
   * Dosya/kod/kayıt alanlarından herhangi birinde G01, G02... bulunuyorsa
   * questionGroupId / groupId ne olursa olsun grup kimliğini Gxx belirler.
   * Eski kayıtlarda her kartın questionGroupId değeri farklı kalabildiği için
   * explicit kimliği öncelemek aynı G01 kartlarını ayrı normal sorulara
   * bölüyordu. Scope + Gxx anahtarı bütün kartları zorunlu olarak tek grupta
   * birleştirir. Explicit kimlik yalnız Gxx hiç bulunamadığında kullanılır.
   */
  if (normalizedToken) {
    const scope = [
      (question as any)?.courseId || (question as any)?.course_id || "",
      (question as any)?.unitId || (question as any)?.unit_id || "",
      (question as any)?.topicId || (question as any)?.topic_id || "",
      (question as any)?.outcomeId || (question as any)?.outcome_id || "",
    ].map((value) => String(value || "").trim()).join(":");
    return `filename-group-fallback:${scope}:${normalizedToken}`;
  }

  return explicit;
};

const questionGroupOrderForTest = (question: Partial<QuestionBankItem> | QuestionBankApiRecord | null | undefined) => {
  const pdfDetectedOrder = Number((question as any)?.pdfDetectedGroupOrder || 0);
  if (pdfDetectedOrder > 0) return pdfDetectedOrder;

  const parsed = fileNameQuestionGroupParts(question);

  // Gxx ile isimlendirilmiş bir grupta sıra her koşulda dosya adındaki sıra
  // değerinden gelir. Grup metadata'sı daha önce farklı kaydedilmiş olsa bile
  // en küçük sıra numaralı ilk JPEG kart yönerge/öncül kabul edilir.
  if (parsed && Number(parsed.order || 0) > 0) {
    return Math.max(0, Number(parsed.order || 0));
  }

  const explicit = (question as any)?.questionGroupOrder;
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return Math.max(0, Number(explicit || 0));
  }

  // Grup sıra metadata'sı yoksa soru kaydının kendi sıra alanı son güvenli fallback'tir.
  const recordOrder = (question as any)?.order;
  if (recordOrder !== undefined && recordOrder !== null && recordOrder !== "") {
    return Math.max(0, Number(recordOrder || 0));
  }
  return 0;
};

const isFileNameQuestionGroupForTest = (groupId: string) => {
  const value = String(groupId || "").trim();
  return value.startsWith("filename-group:") || value.startsWith("filename-group-fallback:") || value.startsWith("filename-group-inferred:");
};

const questionGroupTokenForTest = (question: Partial<QuestionBankItem> | QuestionBankApiRecord | null | undefined) => {
  const parsed = fileNameQuestionGroupParts(question);
  if (parsed?.token) return parsed.token;

  // Eski/yeni grup metadata biçiminden bağımsız olarak Gxx belirtecini bul.
  // Böylece soru kodu yeniden adlandırılmış olsa bile grup yönergesi kaybolmaz.
  const explicitGroupId = String((question as any)?.questionGroupId || "");
  const explicitMatch = explicitGroupId.match(/(?:^|[:_\-])(G[A-Z0-9]+)(?=$|[:_\-])/i);
  if (explicitMatch?.[1]) return explicitMatch[1].toUpperCase();

  const groupId = questionGroupIdForTest(question);
  const tokenMatch = String(groupId || "").match(/(?:^|[:_\-])(G[A-Z0-9]+)(?=$|[:_\-])/i);
  return tokenMatch?.[1] ? tokenMatch[1].toUpperCase() : "";
};

const groupQuestionRowsForTest = (rows: QuestionBankItem[]) => {
  const source = Array.isArray(rows) ? rows : [];
  const output: QuestionBankItem[] = [];
  const handledGroups = new Set<string>();
  source.forEach((question) => {
    const groupId = questionGroupIdForTest(question);
    if (!groupId) {
      output.push(question);
      return;
    }
    if (handledGroups.has(groupId)) return;
    handledGroups.add(groupId);
    const members = source
      .filter((row) => questionGroupIdForTest(row) === groupId)
      .sort((left, right) =>
        questionGroupOrderForTest(left) - questionGroupOrderForTest(right) ||
        String(left.key).localeCompare(String(right.key), "tr-TR", { numeric: true }),
      );
    output.push(...members);
  });
  return output;
};

const fileNameGroupLeaderForTest = (rows: QuestionBankItem[], groupId: string) => {
  if (!isFileNameQuestionGroupForTest(groupId)) return null;
  const members = rows
    .filter((row) => questionGroupIdForTest(row) === groupId)
    .sort((left, right) =>
      questionGroupOrderForTest(left) - questionGroupOrderForTest(right) ||
      String(left.key).localeCompare(String(right.key), "tr-TR", { numeric: true }),
    );

  // Yeni adlandırmada G01_S0_Y ayrı bir yönerge görselidir ve questionIds içine
  // hiç girmez. Bu nedenle ilk gerçek grup sorusunu "öncül" diye düşürme.
  const hasSeparateInstruction = members.some((row) =>
    Boolean(String(row.questionGroupInstructionImageUrl || "").trim()),
  );
  if (hasSeparateInstruction) return null;
  const explicitInstruction = members.find((row) => fileNameQuestionGroupParts(row)?.isInstruction);
  if (explicitInstruction) return explicitInstruction;
  if (members.some((row) => fileNameQuestionGroupParts(row)?.modern)) return null;

  // Sadece eski verilerde, ayrı yönerge görseli yoksa ilk kart legacy öncül olabilir.
  return members.length >= 2 ? members[0] : null;
};

const isFileNameGroupLeaderForTest = (question: QuestionBankItem, rows: QuestionBankItem[]) => {
  const groupId = questionGroupIdForTest(question);
  if (!groupId) return false;
  const leader = fileNameGroupLeaderForTest(rows, groupId);
  return Boolean(leader && String(leader.key) === String(question.key));
};

const QUESTION_GROUP_SELECTION_PALETTES = [
  {
    button: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100",
    badge: "bg-emerald-600",
    text: "text-emerald-900",
    icon: "text-emerald-700",
    marker: "border-emerald-500 bg-emerald-50 text-emerald-800",
  },
  {
    button: "border-amber-300 bg-amber-50 hover:bg-amber-100",
    badge: "bg-amber-500",
    text: "text-amber-950",
    icon: "text-amber-700",
    marker: "border-amber-500 bg-amber-50 text-amber-900",
  },
  {
    button: "border-sky-300 bg-sky-50 hover:bg-sky-100",
    badge: "bg-sky-600",
    text: "text-sky-900",
    icon: "text-sky-700",
    marker: "border-sky-500 bg-sky-50 text-sky-800",
  },
  {
    button: "border-violet-300 bg-violet-50 hover:bg-violet-100",
    badge: "bg-violet-600",
    text: "text-violet-900",
    icon: "text-violet-700",
    marker: "border-violet-500 bg-violet-50 text-violet-800",
  },
  {
    button: "border-orange-300 bg-orange-50 hover:bg-orange-100",
    badge: "bg-orange-600",
    text: "text-orange-900",
    icon: "text-orange-700",
    marker: "border-orange-500 bg-orange-50 text-orange-800",
  },
] as const;

const effectiveQuestionCountForTest = (rows: QuestionBankItem[]) => {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  return safeRows.reduce(
    (count, question) => count + (isFileNameGroupLeaderForTest(question, safeRows) ? 0 : 1),
    0,
  );
};

function apiRecordToQuestionItem(
  record: QuestionBankApiRecord,
  catalog: CatalogCourse[],
): QuestionBankItem {
  const courseId = String(record.courseId || record.course_id || "");
  const unitId = String(record.unitId || record.unit_id || "");
  const topicId = String(record.topicId || record.topic_id || "");
  const outcomeId = String(record.outcomeId || record.outcome_id || "");

  const course = catalog.find(
    (item) => canonicalCourseId(item.id, unitId, topicId, outcomeId) === courseId,
  );
  const unit = course?.units?.find((item) => String(item.id) === unitId);
  const topic = unit?.topics?.find((item) => String(item.id) === topicId);
  const outcomes = topic?.outcomes || topic?.objectives || [];
  const outcome = outcomes.find(
    (item, index) => outcomeIdOf(item, index) === outcomeId,
  );

  const questionId = String(
    record.questionId ||
      record.question_id ||
      record.id ||
      record.questionCode ||
      record.question_code ||
      record.code ||
      record.fileName ||
      record.file_name ||
      "",
  );

  const scopeLevel: ScopeLevel = outcomeId
    ? "outcome"
    : topicId
      ? "topic"
      : "unit";

  return {
    key:
      questionId ||
      [
        courseId,
        unitId,
        topicId || "-",
        outcomeId || "-",
        String(
          record.questionCode ||
            record.question_code ||
            record.code ||
            record.fileName ||
            record.file_name ||
            "",
        ),
      ].join("::"),
    scopeLevel,
    courseId: course?.id || courseId,
    courseName: course?.name || courseId || "Ders",
    grade: gradeNumber(record.grade) || course?.grade || "",
    unitId,
    unitName: String(unit?.name || unitId || "Ünite"),
    topicId,
    topicName: String(topic?.name || topicId || ""),
    outcomeId,
    outcomeName: outcome ? outcomeNameOf(outcome) : outcomeId,
    questionId,
    order: Number(record.order || 0),
    answer: String(record.answer || "").toUpperCase(),
    code: String(
      record.questionCode ||
        record.question_code ||
        record.code ||
        record.fileName ||
        record.file_name ||
        questionId ||
        "Soru",
    ),
    fileName: String(record.fileName || record.file_name || ""),
    imageUrl: String(record.imageUrl || record.image_url || ""),
    thumbnailUrl: String(record.thumbnailUrl || record.thumbnail_url || ""),
    storagePath: String(record.storagePath || record.storage_path || ""),
    columnSpan: Number(record.columnSpan || record.column_span || 1) === 2 ? 2 : 1,
    questionGroupId: questionGroupIdForTest(record) || undefined,
    questionGroupMode: String(record.questionGroupMode || "required").toLowerCase() === "free" ? "free" : "required",
    questionGroupLayout: String(record.questionGroupLayout || "normal").toLowerCase() === "full-width-source" ? "full-width-source" : "normal",
    questionGroupOrder: questionGroupOrderForTest(record),
    questionGroupSize: Math.max(0, Number(record.questionGroupSize || 0)),
    questionGroupTitle: String(record.questionGroupTitle || ""),
    questionGroupInstructionText: String(record.questionGroupInstructionText || ""),
    questionGroupInstructionImageUrl: String(record.questionGroupInstructionImageUrl || ""),
    questionGroupInstructionQuestionId: String(record.questionGroupInstructionQuestionId || ""),
  };
}

function extractQuestionRows(payload: any): QuestionBankApiRecord[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.questions)) return payload.questions;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}


function databaseQuestionName(question: Partial<QuestionBankItem> | null | undefined): string {
  const raw = String(
    question?.fileName ||
      question?.code ||
      question?.questionId ||
      "Soru",
  ).trim();
  if (!raw) return "Soru";

  const normalized = raw.replace(/\\/g, "/").split(/[?#]/, 1)[0];
  const baseName = normalized.split("/").filter(Boolean).pop() || normalized;
  return baseName.replace(/\.[A-Za-z0-9]{2,5}$/i, "").trim() || "Soru";
}

function curriculumQuestionCodeForDisplay(question: Partial<QuestionBankItem> | null | undefined): string {
  const baseId = String(question?.outcomeId || question?.topicId || "").trim();
  const databaseName = databaseQuestionName(question);
  const parsedGroup = fileNameQuestionGroupParts(question as any);
  const parsedAnswer = databaseName.match(/_([A-E])$/i)?.[1]?.toUpperCase() || "";
  const answer = String(question?.answer || parsedAnswer || "").trim().toUpperCase();
  const order = Math.max(
    0,
    Number(parsedGroup?.order || question?.questionGroupOrder || question?.order || 0),
  );

  // Müfredat kimliği biliniyorsa görünen ve eşleşmede kullanılan kodu her zaman
  // müfredat tabanlı canonical biçimde üret. Kısa/veritabanı dosya adı parantezde
  // ayrıca gösterilir; böylece grup dosya adı Soru İşlemleri kapsamını bozmaz.
  if (baseId && order > 0 && /^[A-E]$/.test(answer)) {
    const paddedOrder = String(order).padStart(3, "0");
    const groupToken = parsedGroup?.token || questionGroupTokenForTest(question as any);
    return groupToken
      ? `${baseId}_${paddedOrder}_${groupToken}_${answer}`
      : `${baseId}_${paddedOrder}_${answer}`;
  }

  return String(question?.code || question?.questionId || databaseName || "Soru").trim() || "Soru";
}

function curriculumQuestionDisplayName(question: Partial<QuestionBankItem> | null | undefined): string {
  const curriculumCode = curriculumQuestionCodeForDisplay(question);
  const databaseName = databaseQuestionName(question);

  if (!databaseName || databaseName === "Soru" || databaseName === curriculumCode) {
    return curriculumCode;
  }

  return `${curriculumCode} (${databaseName})`;
}

function answerFromQuestionCard(question: QuestionBankItem): string {
  /*
   * Soru kartı adlandırma kuralı:
   * Kartın / kodun en son harfi doğru cevaptır.
   * Önce doğrudan answer alanını kullanırız; boşsa kartın code, fileName
   * veya questionId değerinden dosya uzantısını temizleyip son A-E harfini alırız.
   */
  const explicit = String(question.answer || "")
    .trim()
    .toUpperCase();

  if (/^[A-E]$/.test(explicit)) return explicit;

  const candidates = [
    question.code,
    question.fileName,
    question.questionId,
  ];

  for (const rawValue of candidates) {
    let value = String(rawValue || "").trim();
    if (!value) continue;

    // .png / .jpg / .jpeg / .webp / .gif / .pdf vb. dosya uzantısını kaldır.
    value = value.replace(/\.[A-Za-z0-9]{2,5}$/i, "");

    // Sondaki boşluk / tire / alt çizgi / parantez benzeri işaretleri temizle.
    value = value.replace(/[\s_\-().[\]{}]+$/g, "");

    const lastCharacter = value.slice(-1).toUpperCase();
    if (/^[A-E]$/.test(lastCharacter)) {
      return lastCharacter;
    }

    // Kart adı "... C  " gibi biterse son cevap harfini yine yakala.
    const match = value.toUpperCase().match(/([A-E])[^A-ZÇĞİÖŞÜ]*$/);
    if (match) return match[1];
  }

  return "";
}

function resolveQuestionImage(question: QuestionBankItem): string {
  const direct = String(question.imageUrl || "").trim();
  if (direct) return direct;

  /*
   * Eski Müfredat kayıtlarında görsel yalnız imageDataUrl üzerinden tutulabiliyordu.
   * toQuestionItem bunu imageUrl alanına taşır. Buradaki storagePath fallback'i,
   * API kayıtlarında imageUrl eksik kalmışsa sunucunun soru görseli yolunu kullanır.
   */
  const storagePath = String(question.storagePath || "").trim();
  if (!storagePath) return "";

  // storagePath tek başına bir disk yoludur; doğrulanmamış bir endpoint uydurmayız.
  // Eğer kayıt zaten HTTP/API URL biçimindeyse onu kullan.
  if (
    storagePath.startsWith("/") ||
    storagePath.startsWith("http://") ||
    storagePath.startsWith("https://") ||
    storagePath.startsWith("data:")
  ) {
    return storagePath;
  }
  return "";
}

function resolveQuestionPreviewImage(question: QuestionBankItem): string {
  const thumbnail = String(question.thumbnailUrl || "").trim();
  if (thumbnail) return thumbnail;
  return resolveQuestionImage(question);
}

function deriveTestScope(
  questions: QuestionBankItem[],
): TestScopeSummary | null {
  if (questions.length === 0) return null;

  const courseKeys = new Set(
    questions.map((q) => `${q.grade}::${q.courseId}`),
  );
  const unitKeys = new Set(
    questions.map((q) => `${q.courseId}::${q.unitId}`),
  );
  const topicKeys = new Set(
    questions
      .filter((q) => q.topicId)
      .map((q) => `${q.courseId}::${q.unitId}::${q.topicId}`),
  );
  const outcomeKeys = new Set(
    questions
      .filter((q) => q.outcomeId)
      .map(
        (q) =>
          `${q.courseId}::${q.unitId}::${q.topicId}::${q.outcomeId}`,
      ),
  );

  const hasUnitLevelQuestion = questions.some(
    (q) => q.scopeLevel === "unit",
  );
  const hasTopicLevelQuestion = questions.some(
    (q) => q.scopeLevel === "topic",
  );

  if (courseKeys.size > 1 || unitKeys.size > 1) {
    return {
      type: "Karma Test",
      description: "Birden fazla ders veya üniteden soru seçildi.",
      topicCount: topicKeys.size,
      outcomeCount: outcomeKeys.size,
    };
  }

  const first = questions[0];

  /*
   * 1) Tüm sorular tek kazanımdansa ve daha üst düzey doğrudan soru yoksa:
   *    Kazanım Testi.
   */
  if (
    !hasUnitLevelQuestion &&
    !hasTopicLevelQuestion &&
    outcomeKeys.size === 1 &&
    topicKeys.size <= 1
  ) {
    return {
      type: "Kazanım Testi",
      description:
        first.outcomeName ||
        first.topicName ||
        first.unitName,
      topicCount: topicKeys.size,
      outcomeCount: outcomeKeys.size,
    };
  }

  /*
   * 2) Tüm sorular tek konu içindeyse; ister konu düzeyinden ister o
   *    konunun birden fazla kazanımından seçilmiş olsun: Konu Testi.
   */
  if (
    !hasUnitLevelQuestion &&
    topicKeys.size === 1
  ) {
    return {
      type: "Konu Testi",
      description: first.topicName || first.unitName,
      topicCount: topicKeys.size,
      outcomeCount: outcomeKeys.size,
    };
  }

  /*
   * 3) Aynı ünite içinde ünite düzeyi soru varsa veya birden fazla
   *    konu/kazanım dağılımı varsa: Ünite Testi.
   *    Ünite düzeyinde doğrudan soru seçilmesi şart değildir.
   */
  return {
    type: "Ünite Testi",
    description: first.unitName,
    topicCount: topicKeys.size,
    outcomeCount: outcomeKeys.size,
  };
}

const PDF_PRINT_STYLE = `
@media print {
  @page { size: A4 portrait; margin: 0; }
  body * { visibility: hidden !important; }
  .pdf-print-workspace,
  .pdf-print-workspace * { visibility: visible !important; }
  .pdf-print-workspace {
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    width: 210mm !important;
    margin: 0 !important; padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  .pdf-print-controls,
  .pdf-print-workspace > aside { display: none !important; }
  .pdf-print-preview {
    overflow: visible !important;
    margin: 0 !important; padding: 0 !important;
    background: #fff !important;
  }
  .pdf-print-pages {
    transform: none !important;
    width: 210mm !important;
    display: block !important;
  }
  .pdf-a4-page {
    width: 210mm !important;
    height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
  }
  .pdf-a4-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
}
`;

const ED_GOTHIC_FONT_STYLE = `
@font-face {
  font-family: "Ed-Gothic";
  src:
    url("/fonts/Ed-Gothic.woff2") format("woff2"),
    url("/fonts/Ed-Gothic.woff") format("woff"),
    url("/fonts/Ed-Gothic.ttf") format("truetype"),
    url("/fonts/Ed-Gothic.otf") format("opentype");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "MSYHBD";
  src:
    url("/fonts/msyhbd.woff2") format("woff2"),
    url("/fonts/msyhbd.woff") format("woff"),
    url("/fonts/msyhbd.ttf") format("truetype"),
    url("/fonts/msyhbd.otf") format("opentype");
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}
`;

export default function TestExamPreparer({
  classrooms = [],
  courses = [],
  customCreatedCourses = [],
}: TestPanelCatalogRuntimeSources) {
  const [saveNotice, setSaveNotice] = useState("");
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [headerDesignVersion, setHeaderDesignVersion] = useState(0);
  const [pdfHeaderTitleBgColor, setPdfHeaderTitleBgColor] =
    useState("#0f766e");
  const [activeTopTab, setActiveTopTab] = useState<"define" | "create" | "pdf">("define");

  const [testDefinition, setTestDefinition] = useState<TestDefinition>(() => {
    const saved = readJson("edupanel_test_builder_v2", {});
    const rawType = String(saved?.testType || "unit");
    return {
      name: String(saved?.testName || ""),
      type: (["unit", "topic", "outcome"].includes(rawType)
        ? rawType
        : "unit") as TestDefinitionType,
      grade: String(saved?.grade || ""),
      courseId: String(saved?.courseId || ""),
      unitId: String(saved?.unitId || ""),
      topicId: String(saved?.topicId || ""),
      outcomeId: String(saved?.outcomeId || ""),
      columnCount: saved?.columnCount === 3 ? 3 : 2,
      questionSpacing: Number(saved?.questionSpacing || 10),
      showAnswersInPdf: saved?.showAnswersInPdf !== false,
    };
  });

  const [savedTests, setSavedTests] = useState<SavedTestDefinition[]>(() => {
    const stored = readJson("edupanel_saved_tests_v1", []);
    return Array.isArray(stored) ? stored : [];
  });

  const [isNewTestEditorOpen, setIsNewTestEditorOpen] = useState(false);
  const [draftTestDefinition, setDraftTestDefinition] =
    useState<TestDefinition>({
      name: "",
      type: "unit",
      grade: "",
      courseId: "",
      unitId: "",
      topicId: "",
      outcomeId: "",
      columnCount: 2,
      questionSpacing: 10,
      showAnswersInPdf: true,
    });

  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [testListGrade, setTestListGrade] = useState("");
  const [testListCourseId, setTestListCourseId] = useState("");
  const [expandedTestUnits, setExpandedTestUnits] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedTestTopics, setExpandedTestTopics] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeTestUnitKey, setActiveTestUnitKey] = useState("");
  const [activeTestOutcomeKey, setActiveTestOutcomeKey] = useState("");
  const [testLockBusyId, setTestLockBusyId] = useState("");
  const [scopeTestPicker, setScopeTestPicker] = useState<ScopeTestPicker>(null);
  const [teacherLinks, setTeacherLinks] = useState<TeacherLinkSummary[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<
    TeacherTestAssignment[]
  >([]);
  const [assigningTest, setAssigningTest] =
    useState<SavedTestDefinition | null>(null);
  const [assigningTeacherId, setAssigningTeacherId] = useState("");
  const [assigningQuestionCount, setAssigningQuestionCount] = useState(10);

  useEffect(() => {
    setActiveTestUnitKey("");
    setActiveTestOutcomeKey("");
  }, [testListGrade, testListCourseId]);

  // Test Tanımla ekranında yönetici yalnız soruları seçecek öğretmeni belirler.
  // Soru sayısı önceden sınırlandırılmaz; seçilen soru sayısı PDF yerleşiminde hesaplanır.
  const [draftTeacherId, setDraftTeacherId] = useState("");

  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentBusyText, setAssignmentBusyText] = useState("");
  const [adminFinalizeBusy, setAdminFinalizeBusy] = useState(false);
  const teacherFinalizationBusyRef = useRef<Set<string>>(new Set());
  const teacherFinalizedAssignmentRef = useRef<Set<string>>(new Set());
  const teacherSummaryRequestBusyRef = useRef(false);

  const catalog = useMemo(
    () => loadCourseCatalog({ classrooms, courses, customCreatedCourses }),
    [catalogVersion, classrooms, courses, customCreatedCourses],
  );

  const pdfCourse = catalog.find(
    (course) => course.id === testDefinition.courseId,
  );

  const pdfUnit = pdfCourse?.units?.find(
    (unit) => String(unit.id) === String(testDefinition.unitId),
  );

  const pdfTopic = pdfUnit?.topics?.find(
    (topic) => String(topic.id) === String(testDefinition.topicId),
  );

  const pdfOutcomes =
    pdfTopic?.outcomes ||
    pdfTopic?.objectives ||
    [];

  const pdfOutcome = pdfOutcomes.find(
    (outcome, index) =>
      outcomeIdOf(outcome, index) === String(testDefinition.outcomeId),
  );

  /*
   * ÜST BAŞLIK HİYERARŞİSİ
   * - Ana başlık Kazanım ise: üst başlık = Konu adı
   * - Ana başlık Konu ise:    üst başlık = Ünite adı
   * - Ana başlık Ünite ise:   üst başlık yok
   */
  const pdfUpperTitle =
    testDefinition.type === "outcome"
      ? String(pdfTopic?.name || "")
      : testDefinition.type === "topic"
        ? String(pdfUnit?.name || "")
        : "";

  /*
   * TEST NUMARASI
   * Öncelik aktif test adının sonundaki otomatik sıra numarasıdır.
   * Eski bir kayıt numarasızsa aynı kapsamda daha önce hazırlanmış test
   * sayısına göre sıra hesaplanır.
   */
  const pdfTestNumber = (() => {
    const nameMatch = String(testDefinition.name || "").match(/(\d+)\s*$/);
    if (nameMatch) return Number(nameMatch[1]);

    const sameScope = savedTests.filter(
      (test) =>
        test.grade === testDefinition.grade &&
        test.courseId === testDefinition.courseId &&
        test.type === testDefinition.type &&
        test.unitId === testDefinition.unitId &&
        (testDefinition.type === "unit" ||
          test.topicId === testDefinition.topicId) &&
        (testDefinition.type !== "outcome" ||
          test.outcomeId === testDefinition.outcomeId),
    );

    const activeIndex = sameScope.findIndex(
      (test) =>
        test.name === testDefinition.name &&
        test.unitId === testDefinition.unitId &&
        test.topicId === testDefinition.topicId &&
        test.outcomeId === testDefinition.outcomeId,
    );

    return activeIndex >= 0
      ? sameScope.length - activeIndex
      : sameScope.length + 1;
  })();

  /*
   * ÖLÇME ARAÇLARI → TEST BAŞLIKLARI
   *
   * Yeni tasarım deposu:
   *   edupanel_exam_tool_test_headers_v1
   *
   * Eski tasarımlar varsa uyumluluk için ikinci kaynak olarak korunur.
   */
  const pdfHeaderDesigns = useMemo(() => {
    const current = readJson(
      "edupanel_exam_tool_test_headers_v1",
      {},
    );
    const legacy = readJson(
      "edupanel_test_header_designs_v1",
      {},
    );

    return {
      ...(legacy && typeof legacy === "object" ? legacy : {}),
      ...(current && typeof current === "object" ? current : {}),
    };
  }, [headerDesignVersion]);

  const pdfCourseDesignKey = normalizeName(
    pdfCourse?.name ||
      (testDefinition.courseId === "2" ? "Tarih" : "") ||
      "",
  );

  const pdfStoredHeaderDesign = (() => {
    if (!pdfHeaderDesigns || typeof pdfHeaderDesigns !== "object") {
      return null;
    }

    const exact = pdfHeaderDesigns?.[pdfCourseDesignKey];
    if (exact?.dataUrl) return exact;

    const target = pdfCourseDesignKey;
    const entries = Object.entries(pdfHeaderDesigns) as Array<
      [string, any]
    >;

    /*
     * Katalog adı "Tarih", "Tarih 9", "9. Sınıf Tarih" gibi değişse de
     * Ölçme Araçları'nda yüklenen "Tarih" tasarımını eşleştir.
     */
    const compatible = entries.find(([key, asset]) => {
      const storedKey = normalizeName(
        asset?.courseName || key || "",
      );

      if (!storedKey || !target) return false;
      if (storedKey === target) return true;

      const targetWords = target
        .split(/[^a-zçğıöşü0-9]+/i)
        .filter(Boolean);
      const storedWords = storedKey
        .split(/[^a-zçğıöşü0-9]+/i)
        .filter(Boolean);

      return (
        targetWords.includes(storedKey) ||
        storedWords.includes(target) ||
        target.includes(storedKey) ||
        storedKey.includes(target)
      );
    });

    return compatible?.[1] || null;
  })();

  const pdfHeaderSource = String(
    pdfStoredHeaderDesign?.dataUrl || "",
  );

  /*
   * Cevap anahtarı hücre zemini, yüklenen test başlığında ana test
   * başlığının yazıldığı zeminle eşleşir. JPG/PNG/SVG için görseli küçük
   * bir canvas'a çizip ana başlık bölgesinden temsilî rengi örnekliyoruz.
   */
  useEffect(() => {
    if (!pdfHeaderSource) {
      setPdfHeaderTitleBgColor("#0f766e");
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
        });
        if (!ctx) return;

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        /*
         * Ana test adı başlığın sağ-orta bölümündedir. Yazının kendisini
         * değil zemini yakalamak için bu bölgedeki doygun/koyu piksellerin
         * medyanına yakın ortalamasını kullan.
         */
        const sample = ctx.getImageData(
          Math.floor(canvas.width * 0.48),
          Math.floor(canvas.height * 0.32),
          Math.floor(canvas.width * 0.34),
          Math.max(1, Math.floor(canvas.height * 0.42)),
        ).data;

        const pixels: Array<[number, number, number]> = [];
        for (let i = 0; i < sample.length; i += 4) {
          const r = sample[i];
          const g = sample[i + 1];
          const b = sample[i + 2];
          const a = sample[i + 3];
          if (a < 180) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max - min;
          const brightness = (r + g + b) / 3;

          // Beyaz kâğıt ve siyah yazıyı örnekten çıkar.
          if (brightness > 242 || brightness < 28) continue;
          if (saturation < 12 && brightness > 205) continue;
          pixels.push([r, g, b]);
        }

        if (pixels.length > 0) {
          const avg = pixels.reduce(
            (acc, [r, g, b]) => [
              acc[0] + r,
              acc[1] + g,
              acc[2] + b,
            ],
            [0, 0, 0],
          );
          const count = pixels.length;
          const color = `rgb(${Math.round(avg[0] / count)}, ${Math.round(
            avg[1] / count,
          )}, ${Math.round(avg[2] / count)})`;
          setPdfHeaderTitleBgColor(color);
        }
      } catch (error) {
        console.warn("Test başlığı zemin rengi okunamadı:", error);
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        console.warn("Test başlığı renk örneklemesi için açılamadı.");
      }
    };
    image.src = pdfHeaderSource;

    return () => {
      cancelled = true;
    };
  }, [pdfHeaderSource]);

  /*
   * 1. SAYFA TEST BAŞLIĞI FİZİKSEL ALANI
   *
   * A4 genişliği: 210 mm
   * Sol boşluk:     5 mm
   * Sağ boşluk:    5 mm
   * Kullanılabilir: 200 mm
   *
   * Alan sayfanın üst kenarından 3 mm aşağıda başlar ve alt kenarı 23 mm'dedir.
   * Görsel JPG / PNG / SVG fark etmeksizin bu alanın içine oranı
   * bozulmadan object-contain ile yerleştirilir.
   */
  const pdfHeaderLeftMm = 5;
  const pdfHeaderRightMm = 5;
  const pdfHeaderTopMm = 3;
  const pdfHeaderBottomMm = 23;
  const pdfHeaderWidthMm =
    210 - pdfHeaderLeftMm - pdfHeaderRightMm;
  const pdfHeaderHeightMm =
    pdfHeaderBottomMm - pdfHeaderTopMm;

  const [pdfBuilderState, setPdfBuilderState] = useState<any>(() =>
    readJson("edupanel_test_builder_v2", {}),
  );
  const [pdfImageRatios, setPdfImageRatios] = useState<Record<string, number>>(
    {},
  );
  const [pdfCanonicalQuestionRows, setPdfCanonicalQuestionRows] = useState<QuestionBankItem[]>([]);
  const [pdfManualColumns, setPdfManualColumns] = useState<string[][] | null>(
    null,
  );
  const [pdfPlacementMode, setPdfPlacementMode] = useState<
    "sequential" | "optimized"
  >("sequential");
  const [pdfZoom, setPdfZoom] = useState(1);
  const pdfPreviewRef = useRef<HTMLDivElement | null>(null);
  const [pdfLayoutSettings, setPdfLayoutSettings] = useState(() => {
    const saved = readJson("edupanel_pdf_layout_settings_v6", {});
    const mainTitleTop = Number(saved?.mainTitleTop ?? 13.1);

    return {
      mainTitleTop,
      mainTitleRight: Number(saved?.mainTitleRight ?? 92.6),

      // Üst başlık, ana başlığın varsayılan olarak tam 10 mm üzerindedir.
      upperTitleTop: Number(saved?.upperTitleTop ?? 8.9),
      upperTitleRight: Number(saved?.upperTitleRight ?? 93),

      testNoTop: Number(saved?.testNoTop ?? 10.5),
      testNoRight: Number(saved?.testNoRight ?? 82.2),
    };
  });

  const updatePdfLayoutSetting = (
    key:
      | "mainTitleTop"
      | "mainTitleRight"
      | "upperTitleTop"
      | "upperTitleRight"
      | "testNoTop"
      | "testNoRight",
    value: number,
  ) => {
    setPdfLayoutSettings((current) => {
      const next = {
        ...current,
        [key]: Number.isFinite(value) ? value : 0,
      };
      sqliteStorage.setItem(
        "edupanel_pdf_layout_settings_v6",
        JSON.stringify(next),
      );
      return next;
    });
  };

  /*
   * PDF SORU ALANI — SABİT FİZİKSEL SINIRLAR
   *
   * 1. sayfa:
   * - Test başlığı alanı v59 konumundan 2 mm yukarı taşınmıştır.
   * - Başlığın ALT kenarı kağıdın üstünden tam 23 mm'dedir.
   * - İlk sayfadaki her sütunun ilk soru numarası ve soru kartı başlıktan 3 mm sonra, 26 mm'den başlar.
   * - Başlık görselinin doğal oranı soru alanının başlangıcını değiştirmez.
   */
  const pdfPage1ColumnsTopMm = 26;

  /*
   * Eski hazırlanmış testlerde selectedQuestionSnapshots, soru bankasındaki son
   * Gxx / grup metadata'sını taşımayabiliyor. PDF oluşturulurken seçili soruların
   * güncel canonical kayıtlarını yeniden okuyup snapshot'larla birleştiriyoruz.
   * Böylece daha önce hazırlanmış testlerde de grubun ilk kartı yönerge olarak
   * tanınır; eski snapshot yüzünden normal soru numarası almaz.
   */
  const pdfSelectedKeySignature = JSON.stringify(
    Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? pdfBuilderState.selectedQuestionKeys.map(String)
      : [],
  );

  const pdfSelectedQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    const snapshots = Array.isArray(pdfBuilderState?.selectedQuestionSnapshots)
      ? pdfBuilderState.selectedQuestionSnapshots
      : [];
    snapshots.forEach((question: any) => {
      const id = String(question?.questionId || question?.question_id || question?.key || "").trim();
      if (id) ids.add(id);
    });
    (Array.isArray(pdfBuilderState?.selectedQuestionKeys) ? pdfBuilderState.selectedQuestionKeys : [])
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => ids.add(value));
    return [...ids];
  }, [pdfSelectedKeySignature, pdfBuilderState?.selectedQuestionSnapshots]);

  useEffect(() => {
    let cancelled = false;
    const selectedKeys = Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? pdfBuilderState.selectedQuestionKeys.map(String).filter(Boolean)
      : [];
    if (selectedKeys.length === 0 || !testDefinition.grade || !testDefinition.courseId) {
      setPdfCanonicalQuestionRows([]);
      return () => { cancelled = true; };
    }

    const loadCanonicalRows = async () => {
      try {
        const records: QuestionBankApiRecord[] = [];

        // Önce yalnız bu testte seçilmiş canonical soru kayıtlarını kimlikleriyle
        // doğrudan oku. Böylece eski test snapshot'ı müfredat filtresine takılsa
        // bile güncel questionGroupId / questionGroupOrder metadata'sı mutlaka gelir.
        if (pdfSelectedQuestionIds.length > 0) {
          const chunkSize = 80;
          for (let start = 0; start < pdfSelectedQuestionIds.length; start += chunkSize) {
            const ids = pdfSelectedQuestionIds.slice(start, start + chunkSize);
            const exactParams = new URLSearchParams();
            exactParams.set("status", "active");
            exactParams.set("ids", ids.join(","));
            exactParams.set("limit", String(Math.max(1, ids.length)));
            const response = await fetch(`/api/question-bank/questions?${exactParams.toString()}`, { cache: "no-store" });
            if (!response.ok) continue;
            const payload = await response.json().catch(() => ({}));
            records.push(...extractQuestionRows(payload));
          }
        }

        // Eski kayıtlarda selectedQuestionKeys gerçek question_id değilse mevcut
        // müfredat kapsam sorgusu güvenli fallback olarak çalışmaya devam eder.
        if (records.length < pdfSelectedQuestionIds.length) {
          const params = new URLSearchParams();
          params.set("status", "active");
          params.set("grade", String(testDefinition.grade || ""));
          params.set(
            "courseId",
            canonicalCourseId(
              testDefinition.courseId,
              testDefinition.unitId,
              testDefinition.topicId,
              testDefinition.outcomeId,
            ),
          );
          if (testDefinition.unitId) params.set("unitId", String(testDefinition.unitId));
          if (testDefinition.type !== "unit" && testDefinition.topicId) {
            params.set("topicId", String(testDefinition.topicId));
          }
          if (testDefinition.type === "outcome" && testDefinition.outcomeId) {
            params.set("outcomeId", String(testDefinition.outcomeId));
          }
          params.set("limit", "500");

          let offset = 0;
          let total = 0;
          do {
            params.set("offset", String(offset));
            const response = await fetch(`/api/question-bank/questions?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) break;
            const payload = await response.json().catch(() => ({}));
            const rows = extractQuestionRows(payload);
            records.push(...rows);
            total = Math.max(records.length, Number(payload?.total || records.length));
            offset += rows.length;
            if (rows.length === 0) break;
          } while (offset < total);
        }

        if (cancelled) return;
        const uniqueById = new Map<string, QuestionBankApiRecord>();
        records.forEach((record: any) => {
          const id = String(record?.questionId || record?.question_id || record?.id || record?.questionCode || record?.question_code || "").trim();
          if (id) uniqueById.set(id, record);
        });
        const normalized = [...uniqueById.values()].map((record) => apiRecordToQuestionItem(record, catalog));
        setPdfCanonicalQuestionRows(normalized);
      } catch {
        if (!cancelled) setPdfCanonicalQuestionRows([]);
      }
    };

    void loadCanonicalRows();
    return () => { cancelled = true; };
  }, [
    pdfSelectedKeySignature,
    pdfSelectedQuestionIds,
    testDefinition.grade,
    testDefinition.courseId,
    testDefinition.unitId,
    testDefinition.topicId,
    testDefinition.outcomeId,
    testDefinition.type,
    catalogVersion,
  ]);

  const pdfCanonicalQuestionByIdentity = useMemo(() => {
    const map = new Map<string, QuestionBankItem>();
    pdfCanonicalQuestionRows.forEach((question) => {
      [
        question.key,
        question.questionId,
        question.code,
        question.fileName,
        question.storagePath,
      ].forEach((identity) => {
        const value = String(identity || "").trim();
        if (value && !map.has(value)) map.set(value, question);
      });
    });
    return map;
  }, [pdfCanonicalQuestionRows]);

  const pdfRawSelectedQuestions: QuestionBankItem[] = (() => {
    const snapshots = Array.isArray(pdfBuilderState?.selectedQuestionSnapshots)
      ? (pdfBuilderState.selectedQuestionSnapshots as QuestionBankItem[])
      : [];
    const selectedKeys = Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? pdfBuilderState.selectedQuestionKeys.map(String).filter(Boolean)
      : [];

    const snapshotByIdentity = new Map<string, QuestionBankItem>();
    snapshots.forEach((snapshot) => {
      [snapshot.key, snapshot.questionId, snapshot.code, snapshot.fileName, snapshot.storagePath]
        .map((identity) => String(identity || "").trim())
        .filter(Boolean)
        .forEach((identity) => {
          if (!snapshotByIdentity.has(identity)) snapshotByIdentity.set(identity, snapshot);
        });
    });

    const mergeQuestion = (snapshot: QuestionBankItem | undefined, canonical: QuestionBankItem | undefined) => {
      if (!snapshot && !canonical) return null;
      if (!snapshot) return canonical || null;
      if (!canonical) return snapshot;
      const snapshotGroup = fileNameQuestionGroupParts(snapshot);
      const canonicalGroup = fileNameQuestionGroupParts(canonical);
      const snapshotToken = snapshotGroup?.token || questionGroupTokenForTest(snapshot);
      const canonicalToken = canonicalGroup?.token || questionGroupTokenForTest(canonical);
      const detectedToken = snapshotToken || canonicalToken || "";
      const detectedOrder = Math.max(
        0,
        Number(
          snapshotGroup?.order ||
            canonicalGroup?.order ||
            snapshot.questionGroupOrder ||
            canonical.questionGroupOrder ||
            snapshot.order ||
            canonical.order ||
            0,
        ),
      );

      return {
        ...snapshot,
        ...canonical,
        // Seçili testte kullanılan anahtar değişmesin; yalnız canonical metadata yenilensin.
        key: snapshot.key || canonical.key,
        imageUrl: canonical.imageUrl || snapshot.imageUrl,
        thumbnailUrl: canonical.thumbnailUrl || snapshot.thumbnailUrl,
        // Canonical kayıt eskiyse Gxx bilgisi snapshot'tan; snapshot eskiyse canonical
        // kayıttan korunur. Böylece merge Gxx bilgisini hiçbir zaman silemez.
        pdfDetectedGroupToken: detectedToken || undefined,
        pdfDetectedGroupOrder: detectedOrder || undefined,
      } as QuestionBankItem;
    };

    if (selectedKeys.length > 0) {
      return selectedKeys
        .map((key) => {
          const snapshot = snapshotByIdentity.get(key);
          const canonical = [
            key,
            snapshot?.questionId,
            snapshot?.code,
            snapshot?.fileName,
            snapshot?.storagePath,
          ]
            .map((identity) => String(identity || "").trim())
            .filter(Boolean)
            .map((identity) => pdfCanonicalQuestionByIdentity.get(identity))
            .find(Boolean);
          return mergeQuestion(snapshot, canonical);
        })
        .filter((question): question is QuestionBankItem => Boolean(question));
    }

    return snapshots.map((snapshot) => {
      const canonical = [snapshot.key, snapshot.questionId, snapshot.code, snapshot.fileName, snapshot.storagePath]
        .map((identity) => String(identity || "").trim())
        .filter(Boolean)
        .map((identity) => pdfCanonicalQuestionByIdentity.get(identity))
        .find(Boolean);
      return mergeQuestion(snapshot, canonical) || snapshot;
    });
  })();

  // PDF GRUP KİMLİĞİ — nihai ve scope bağımsız çözüm.
  // Aynı testte G01/G02 belirteci hangi kayıt alanında bulunursa bulunsun,
  // ünite/konu/kazanım farkı grubu parçalayamaz. Gxx test içindeki grup kimliğidir.
  const pdfSourceGroupParts = (question: QuestionBankItem | undefined | null) => {
    if (!question) return { groupId: "", token: "", order: 0 };

    const detectedTokenRaw = String((question as any)?.pdfDetectedGroupToken || "").trim();
    const parsed = fileNameQuestionGroupParts(question);
    const explicitGroupId = String((question as any)?.questionGroupId || (question as any)?.groupId || "").trim();
    const explicitToken = explicitGroupId.match(/(?:^|[:_\-.\s])(G\d{1,3})(?=$|[:_\-.\s])/i)?.[1] || "";
    const rawToken = detectedTokenRaw || parsed?.token || explicitToken || questionGroupTokenForTest(question);
    const tokenNumber = Number(String(rawToken || "").replace(/\D/g, ""));
    const token = Number.isFinite(tokenNumber) && tokenNumber > 0
      ? `G${String(tokenNumber).padStart(2, "0")}`
      : String(rawToken || "").toUpperCase();

    const detectedOrder = Number((question as any)?.pdfDetectedGroupOrder || 0);
    const order = detectedOrder > 0
      ? detectedOrder
      : Math.max(0, Number(parsed?.order || question.questionGroupOrder || question.order || 0));

    if (token) {
      // Grup tokenı test içinde benzersizdir. Sadece ders kimliği ile sınırla;
      // outcome/topic scope'u aynı yönerge grubunu parçalayamaz.
      const courseScope = [question.grade || "", question.courseId || ""]
        .map((value) => String(value || "").trim())
        .join(":");
      return {
        groupId: `pdf-gxx-group:${courseScope}:${token}`,
        token,
        order,
      };
    }

    return {
      groupId: explicitGroupId,
      token: "",
      order: Math.max(0, Number(question.questionGroupOrder || question.order || 0)),
    };
  };

  // Dosya adından oluşan Gxx gruplarında en küçük sıra değerli dosya öncüldür.
  // Öncül soru numarası almaz; kendisinden sonraki bağlı sorular PDF'de tek blok
  // halinde tutulur ve öncül görseli grubun ilk gerçek sorusundan önce yönerge
  // kutusu içinde gösterilir.
  const pdfSelectedQuestions: QuestionBankItem[] = (() => {
    const ordered = groupQuestionRowsForTest(pdfRawSelectedQuestions);
    const output: QuestionBankItem[] = [];
    const handledGroups = new Set<string>();

    ordered.forEach((question) => {
      const groupId = pdfSourceGroupParts(question).groupId;
      if (!groupId) {
        output.push(question);
        return;
      }
      if (handledGroups.has(groupId)) return;
      handledGroups.add(groupId);

      const members = ordered
        .filter((row) => pdfSourceGroupParts(row).groupId === groupId)
        .sort((left, right) =>
          pdfSourceGroupParts(left).order - pdfSourceGroupParts(right).order ||
          String(left.key).localeCompare(String(right.key), "tr-TR", { numeric: true }),
        );

      /*
       * KESİN PDF GRUP KURALI — TEK KAYNAK:
       * - Bir grup en az 2 kayıt içeriyorsa, sıra numarası en küçük olan ilk kayıt
       *   HER ZAMAN yönergedir. Eski instructionImageUrl / snapshot metadata'sı
       *   bu kararı değiştiremez.
       * - Yönerge PDF soru dizisine HİÇ GİRMEZ; dolayısıyla kırmızı soru numarası
       *   ve cevap anahtarı hücresi alamaz.
       * - Kalan kayıtlar gerçek sorulardır ve aralarına başka soru girmeden
       *   peş peşe tutulur. İlk gerçek sorunun üstünde, bu gerçek soruların PDF'de
       *   aldığı numaralarla zorunlu yönerge başlığı + ilk kartın görseli gösterilir.
       */
      if (members.length >= 2) {
        const storedInstructionImage = members
          .map((row) => String(row.questionGroupInstructionImageUrl || "").trim())
          .find(Boolean) || "";
        const storedInstructionQuestionId = members
          .map((row) => String(row.questionGroupInstructionQuestionId || "").trim())
          .find(Boolean) || "";

        let leader: QuestionBankItem | null = null;
        let printable: QuestionBankItem[] = members;
        let leaderImage = storedInstructionImage;

        if (storedInstructionImage) {
          // Yeni doğru veritabanı modeli: yönerge grup kaydında ayrı tutulur.
          // Eski hazırlanmış test snapshot'ında yönerge hâlâ seçiliyse kimliğinden
          // bulup çıkar; seçili değilse hiçbir gerçek soruyu düşürme.
          let instructionIndex = -1;
          if (storedInstructionQuestionId) {
            instructionIndex = members.findIndex((row) =>
              [row.questionId, row.key].map(String).includes(storedInstructionQuestionId),
            );
          }
          if (instructionIndex < 0) {
            const storedRealQuestionCount = Math.max(
              0,
              ...members.map((row) => Number(row.questionGroupSize || 0)),
            );
            // Eski snapshot yönerge kimliğini taşımıyorsa ama grupta veritabanının
            // bildirdiği gerçek soru sayısından bir fazla kart varsa, fazladan ilk
            // sıra kartı eski yönergedir. Gerçek sorulardan hiçbirini düşürme.
            if (storedRealQuestionCount > 0 && members.length > storedRealQuestionCount) {
              instructionIndex = 0;
            }
          }
          if (instructionIndex >= 0) {
            leader = members[instructionIndex];
            printable = members.filter((_, index) => index !== instructionIndex);
          }
        } else if (members.some((row) => fileNameQuestionGroupParts(row)?.modern)) {
          leader = members.find((row) => fileNameQuestionGroupParts(row)?.isInstruction) || null;
          printable = members.filter((row) => row !== leader);
          leaderImage = leader ? resolveQuestionImage(leader) : "";
        } else {
          // Eski kayıt fallback'i: ayrı yönerge metadata'sı yoksa ilk sıra kartı yönergedir.
          leader = members[0];
          printable = members.slice(1);
          leaderImage = resolveQuestionImage(leader);
        }

        if (printable.length === 0) return;
        const printableKeys = printable.map((row) => String(row.key));
        const metaSource = printable[0] || leader || members[0];

        printable.forEach((member, index) => {
          output.push({
            ...member,
            questionGroupId: groupId,
            pdfResolvedGroupId: groupId,
            pdfDetectedGroupToken: pdfSourceGroupParts(member).token || undefined,
            pdfDetectedGroupOrder: index + 1,
            questionGroupOrder: index + 1,
            questionGroupSize: printable.length,
            questionGroupTitle: index === 0 ? String(member.questionGroupTitle || metaSource?.questionGroupTitle || "") : "",
            questionGroupInstructionText: index === 0 ? String(member.questionGroupInstructionText || metaSource?.questionGroupInstructionText || "") : "",
            questionGroupInstructionImageUrl: "",
            pdfGroupInstructionVisible: index === 0,
            pdfGroupLeaderImageUrl: index === 0 ? leaderImage : "",
            pdfGroupQuestionCount: printable.length,
            pdfGroupQuestionKeys: printableKeys,
          });
        });
        return;
      }

      // Tek üyeli kayıt gerçek grup değildir; soru olarak normal akışta kalır.
      output.push(question);
    });

    return output;
  })();

  const pdfQuestionCount = pdfSelectedQuestions.length;
  const pdfColumnCount =
    Number(pdfBuilderState?.columnCount || testDefinition.columnCount) === 3
      ? 3
      : 2;
  const pdfQuestionSpacing = Math.max(
    0,
    Number(
      pdfBuilderState?.questionSpacing ??
        testDefinition.questionSpacing ??
        10,
    ) || 0,
  );
  // PDF cevap görünürlüğünde aktif test tanımı tek kaynaktır.
  // Builder içinde eski bir değer kalmış olsa bile tik kaldırıldığında cevaplar
  // PDF'ye kesinlikle basılmamalıdır.
  const pdfShowAnswers = testDefinition.showAnswersInPdf !== false;

  useEffect(() => {
    const syncPdfBuilder = (event?: Event) => {
      const custom = event as CustomEvent<any>;
      setPdfBuilderState(
        custom?.detail || readJson("edupanel_test_builder_v2", {}),
      );
    };

    window.addEventListener(
      "edupanel:test-builder-updated",
      syncPdfBuilder as EventListener,
    );
    return () =>
      window.removeEventListener(
        "edupanel:test-builder-updated",
        syncPdfBuilder as EventListener,
      );
  }, []);


  useEffect(() => {
    if (!savedTests.length || !teacherAssignments.length) {
      return;
    }

    let cancelled = false;

    const stableQuestionSignature = (rows: QuestionBankItem[]) =>
      rows
        .map((question) =>
          [
            String(question.unitId || ""),
            String(question.topicId || ""),
            String(question.outcomeId || ""),
            String(
              question.storagePath ||
                question.fileName ||
                question.questionId ||
                question.code ||
                question.key ||
                "",
            ),
          ].join("::"),
        )
        .filter(Boolean)
        .sort()
        .join("|");

    const synchronizeTeacherQuestionPools = async () => {
      let changed = false;

      for (const assignment of teacherAssignments) {
        if (cancelled) return;

        const saved = savedTests.find(
          (test) => String(test.id) === String(assignment.testId),
        );
        if (!saved) continue;
        if (savedTestQuestionsLocked(saved)) continue;

        /*
         * Görev havuzu öğretmen ilk soruyu seçene kadar canlı kalır.
         * Böylece görev verildikten sonra aynı kapsama yüklenen yeni sorular
         * mevcut öğretmen görevine de dahil olabilir.
         *
         * İlk seçimden sonra questionPoolLocked=true olur ve havuz sabitlenir.
         */
        const hasTeacherSelection =
          Array.isArray(assignment.selectedQuestionKeys) &&
          assignment.selectedQuestionKeys.length > 0;

        if (
          assignment.questionPoolLocked === true &&
          hasTeacherSelection &&
          Array.isArray(assignment.availableQuestionSnapshots)
        ) {
          continue;
        }

        const lastPoolSync =
          Date.parse(String(assignment.questionPoolUpdatedAt || "")) || 0;
        if (Date.now() - lastPoolSync < 3_000) continue;

        const nextAvailable = await loadCanonicalQuestionsForTest(saved);
        const nextScopeTree = buildAssignmentScopeTree(saved, nextAvailable);

        const currentAvailable = Array.isArray(
          assignment.availableQuestionSnapshots,
        )
          ? assignment.availableQuestionSnapshots
          : [];

        const currentSignature =
          stableQuestionSignature(currentAvailable);
        const nextSignature =
          stableQuestionSignature(nextAvailable);

        const currentTreeSignature = JSON.stringify(
          (assignment.scopeTree || []).map((unit: any) => ({
            id: unit?.id,
            topics: (unit?.topics || []).map((topic: any) => ({
              id: topic?.id,
              outcomes: (topic?.outcomes || []).map((outcome: any) => ({
                id: outcome?.id,
                questions: stableQuestionSignature(
                  Array.isArray(outcome?.questions)
                    ? outcome.questions
                    : [],
                ),
              })),
            })),
          })),
        );

        const nextTreeSignature = JSON.stringify(
          nextScopeTree.map((unit) => ({
            id: unit.id,
            topics: unit.topics.map((topic) => ({
              id: topic.id,
              outcomes: topic.outcomes.map((outcome) => ({
                id: outcome.id,
                questions: stableQuestionSignature(
                  outcome.questions || [],
                ),
              })),
            })),
          })),
        );

        if (
          currentSignature === nextSignature &&
          currentTreeSignature === nextTreeSignature
        ) {
          continue;
        }

        const nextAssignment: TeacherTestAssignment = {
          ...assignment,
          scopeTree: nextScopeTree,
          availableQuestionSnapshots: nextAvailable,
          questionPoolUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          const response = await fetch(
            `/api/database/collections/teacherTestAssignments/${encodeURIComponent(
              nextAssignment.id,
            )}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(nextAssignment),
            },
          );
          if (response.ok) changed = true;
        } catch (error) {
          console.warn(
            "Öğretmen soru havuzu eşitlenemedi:",
            nextAssignment.id,
            error,
          );
        }
      }

      if (!cancelled && changed) {
        await loadTeacherAssignmentData();
      }
    };

    void synchronizeTeacherQuestionPools();

    return () => {
      cancelled = true;
    };
  }, [
    savedTests,
    catalog,
    teacherAssignments.length,
  ]);


  useEffect(() => {
    if (!testDefinition.name) return;

    // Builder ve ekranda aktif test farklıysa seçimleri hiçbir teste yazma.
    // Testler arasında geçişte React state güncellemeleri farklı renderlarda
    // tamamlanabildiği için bu kimlik kontrolü eski testin sorularının yeni
    // teste ya da boş listenin önceki teste yazılmasını engeller.
    if (String(pdfBuilderState?.testName || "") !== String(testDefinition.name)) {
      return;
    }

    const activeIndex = savedTests.findIndex(
      (saved) =>
        saved.name === testDefinition.name &&
        saved.type === testDefinition.type &&
        saved.grade === testDefinition.grade &&
        saved.courseId === testDefinition.courseId &&
        saved.unitId === testDefinition.unitId &&
        saved.topicId === testDefinition.topicId &&
        saved.outcomeId === testDefinition.outcomeId,
    );

    if (activeIndex < 0) return;

    const keys = Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? pdfBuilderState.selectedQuestionKeys.map(String)
      : [];
    const snapshots = Array.isArray(
      pdfBuilderState?.selectedQuestionSnapshots,
    )
      ? pdfBuilderState.selectedQuestionSnapshots
      : [];

    const active = savedTests[activeIndex];
    if (savedTestQuestionsLocked(active)) return;
    const sameKeys =
      JSON.stringify(active.selectedQuestionKeys || []) ===
      JSON.stringify(keys);
    const sameSnapshots =
      JSON.stringify(active.selectedQuestionSnapshots || []) ===
      JSON.stringify(snapshots);

    if (sameKeys && sameSnapshots) return;

    const next = [...savedTests];
    next[activeIndex] = {
      ...active,
      selectedQuestionKeys: keys,
      selectedQuestionSnapshots: snapshots,
      updatedAt: new Date().toISOString(),
    };

    setSavedTests(next);
    sqliteStorage.setItem(
      "edupanel_saved_tests_v1",
      JSON.stringify(next),
    );
  }, [
    pdfBuilderState?.updatedAt,
    testDefinition.name,
    testDefinition.type,
    testDefinition.grade,
    testDefinition.courseId,
    testDefinition.unitId,
    testDefinition.topicId,
    testDefinition.outcomeId,
  ]);

  useEffect(() => {
    let cancelled = false;

    const sources = pdfSelectedQuestions.flatMap((question) => {
      const rows = [{ key: String(question.key), url: resolveQuestionImage(question) }];
      if (question.pdfGroupInstructionVisible && question.pdfGroupLeaderImageUrl) {
        rows.push({ key: `${String(question.key)}::group-instruction`, url: String(question.pdfGroupLeaderImageUrl) });
      }
      return rows;
    });

    sources.forEach(({ key, url }) => {
      if (!url || pdfImageRatios[key]) return;

      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        const ratio =
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? image.naturalWidth / image.naturalHeight
            : 1.35;
        setPdfImageRatios((current) => ({
          ...current,
          [key]: Math.max(0.25, ratio),
        }));
      };
      image.onerror = () => {
        if (cancelled) return;
        setPdfImageRatios((current) => ({
          ...current,
          [key]: 1.35,
        }));
      };
      image.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [pdfSelectedQuestions, pdfImageRatios]);

  const pdfColumnWidthMm =
    (200 - 5 * (pdfColumnCount - 1)) / pdfColumnCount;

  const pdfQuestionColumnSpan = (question: QuestionBankItem): 1 | 2 =>
    Number(question?.columnSpan || 1) === 2 && pdfColumnCount >= 2 ? 2 : 1;

  const pdfQuestionVisualWidthMm = (question: QuestionBankItem) => {
    const span = pdfQuestionColumnSpan(question);
    return pdfColumnWidthMm * span + 5 * (span - 1);
  };

  const pdfQuestionVisualHeightMm = (question: QuestionBankItem) => {
    const ratio = Math.max(0.05, pdfImageRatios[question.key] || 1.35);
    // Görsel her zaman kendisine ayrılan standart genişliğin TAMAMINI kullanır.
    // Uzun görseller yükseklik yüzünden yatayda daraltılmaz.
    const visualHeight = pdfQuestionVisualWidthMm(question) / ratio;
    return Math.max(14, visualHeight);
  };

  const pdfGroupInstructionHeightMm = (question: QuestionBankItem) => {
    if (!question.pdfGroupInstructionVisible) return 0;
    const groupQuestionCount = Math.max(1, Number(question.pdfGroupQuestionCount || question.questionGroupSize || 1));
    // Uzun numara listelerinde (örn. 4, 5, 6, 7 ve 8) hatırlatma metni
    // ikinci satıra inse bile kesinlikle kırpılmasın.
    const textHeightMm = groupQuestionCount >= 4 ? 10 : 8;
    const imageUrl = String(question.pdfGroupLeaderImageUrl || question.questionGroupInstructionImageUrl || "");
    if (!imageUrl) return textHeightMm;
    const ratio = Math.max(0.05, pdfImageRatios[`${String(question.key)}::group-instruction`] || 1.35);
    // Yönerge kartı da bağlı sorularla aynı standart genişliği tam kullanır.
    const imageHeightMm = Math.max(12, pdfQuestionVisualWidthMm(question) / ratio);
    return textHeightMm + imageHeightMm + 3;
  };

  const pdfQuestionHeightMm = (question: QuestionBankItem) => {
    // 4 mm soru numarası + TAM 1 mm boşluk + soru kartı + sorular arası mesafe.
    // Grup başlangıcındaki öncül/yönerge kutusu soru numarası almaz ve aynı blok
    // içinde ilk gerçek sorunun üstünde yer kaplar.
    const numberBadgeHeightMm = 4;
    const numberToQuestionGapMm = 1;

    return (
      pdfGroupInstructionHeightMm(question) +
      (question.pdfGroupInstructionVisible ? 1 : 0) +
      numberBadgeHeightMm +
      numberToQuestionGapMm +
      pdfQuestionVisualHeightMm(question) +
      pdfQuestionSpacing
    );
  };

  /*
   * 1. SAYFA ALT SINIRI:
   * Sütunun kullanılabilir alanı sayfa altından 8 mm yukarıda biter.
   * Son soru kartından sonra da minimum soru-sonrası boşluk korunur;
   * varsa kalan serbest alan diğer sorularla birlikte eşit paylaştırılır.
   */
  const pdfPage1BottomMm = 8;

  /*
   * 2. SAYFA ALT SINIRI:
   * Cevap anahtarı bottom=8 mm ve height=6 mm olduğundan üst kenarı
   * sayfa altından 14 mm yukarıdadır.
   * Soru sütununun kullanılabilir alanı cevap anahtarının üst kenarından
   * 3 mm yukarıda biter. Son sorunun soru-sonrası boşluğu da bu alanın içindedir.
   * Dolayısıyla soru sütununun alt sınırı: 14 + 3 = 17 mm.
   */
  const pdfAnswerStripBottomMm = 8;
  const pdfAnswerStripHeightMm = 6;
  const pdfPage2AnswerGapMm = 3;
  const pdfPage2ColumnsBottomMm = pdfShowAnswers
    ? pdfAnswerStripBottomMm +
      pdfAnswerStripHeightMm +
      pdfPage2AnswerGapMm
    : pdfPage1BottomMm;

  const pdfPage2ColumnsTopMm = 8;

  const pdfColumnCapacities = Array.from(
    { length: pdfColumnCount * 2 },
    (_, index) =>
      index < pdfColumnCount
        ? Math.max(
            0,
            297 - pdfPage1ColumnsTopMm - pdfPage1BottomMm,
          )
        : Math.max(
            0,
            297 - pdfPage2ColumnsTopMm - pdfPage2ColumnsBottomMm,
          ),
  );

  const pdfLayoutOptions = useMemo(() => {
    type LayoutQuestion = {
      question: QuestionBankItem;
      key: string;
      height: number;
      span: 1 | 2;
      originalIndex: number;
    };

    type LayoutBlock = {
      items: LayoutQuestion[];
      originalIndex: number;
      totalHeight: number;
      questionCount: number;
      isGroup: boolean;
    };

    type LayoutResult = {
      columns: string[][];
      spacerHeights: Record<string, number>;
      overflowKeys: string[];
      usedHeights: number[];
      placedCount: number;
      placedHeight: number;
      balancePenalty: number;
      usedColumnCount: number;
      lastUsedColumnIndex: number;
      firstOverflowOriginalIndex: number;
    };

    const items: LayoutQuestion[] = pdfSelectedQuestions.map(
      (question, originalIndex) => ({
        question,
        key: String(question.key),
        height: pdfQuestionHeightMm(question),
        span: pdfQuestionColumnSpan(question),
        originalIndex,
      }),
    );

    const originalIndexByKey = new Map(
      items.map((item) => [item.key, item.originalIndex]),
    );

    /*
     * Grup soruları tek bir yerleşim bloğu olarak ele alınır.
     * Dosya adındaki Gxx kuralı ve grup içi sıra burada korunur.
     * Böylece gerek normal sıralamada gerek "Soruları Yerleştir"
     * optimizasyonunda grubun arasına başka soru girmez.
     */
    const handledGroups = new Set<string>();
    const blocks: LayoutBlock[] = [];

    items.forEach((item) => {
      const groupId = questionGroupIdForTest(item.question);
      if (!groupId) {
        blocks.push({
          items: [item],
          originalIndex: item.originalIndex,
          totalHeight: item.height,
          questionCount: 1,
          isGroup: false,
        });
        return;
      }

      if (handledGroups.has(groupId)) return;
      handledGroups.add(groupId);

      const members = items
        .filter(
          (candidate) =>
            questionGroupIdForTest(candidate.question) === groupId,
        )
        .sort(
          (left, right) =>
            questionGroupOrderForTest(left.question) -
              questionGroupOrderForTest(right.question) ||
            left.originalIndex - right.originalIndex,
        );

      const normalizedMembers = members.length ? members : [item];
      blocks.push({
        items: normalizedMembers,
        originalIndex: Math.min(
          ...normalizedMembers.map((member) => member.originalIndex),
        ),
        totalHeight: normalizedMembers.reduce(
          (sum, member) => sum + member.height,
          0,
        ),
        questionCount: normalizedMembers.length,
        isGroup: true,
      });
    });

    blocks.sort(
      (left, right) => left.originalIndex - right.originalIndex,
    );

    const finalizeLayout = (
      columns: string[][],
      usedHeights: number[],
      overflowKeys: string[],
      spacerHeights: Record<string, number>,
    ): LayoutResult => {
      const normalizedOverflow = [...overflowKeys].sort(
        (left, right) =>
          (originalIndexByKey.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (originalIndexByKey.get(right) ?? Number.MAX_SAFE_INTEGER),
      );
      const placedCount = Math.max(
        0,
        items.length - normalizedOverflow.length,
      );
      const placedHeight = items
        .filter((item) => !normalizedOverflow.includes(item.key))
        .reduce((sum, item) => sum + item.height, 0);
      const fillRatios = usedHeights.map((used, index) => {
        const capacity = pdfColumnCapacities[index] || 1;
        return used / capacity;
      });
      const averageFill =
        fillRatios.length > 0
          ? fillRatios.reduce((sum, value) => sum + value, 0) /
            fillRatios.length
          : 0;
      const balancePenalty = fillRatios.reduce(
        (sum, value) => sum + Math.abs(value - averageFill),
        0,
      );
      const usedIndexes = usedHeights
        .map((value, index) => (value > 0.01 ? index : -1))
        .filter((index) => index >= 0);
      const firstOverflowOriginalIndex =
        normalizedOverflow.length > 0
          ? Math.min(
              ...normalizedOverflow.map(
                (key) =>
                  originalIndexByKey.get(key) ??
                  Number.MAX_SAFE_INTEGER,
              ),
            )
          : Number.MAX_SAFE_INTEGER;

      return {
        columns,
        spacerHeights,
        overflowKeys: normalizedOverflow,
        usedHeights,
        placedCount,
        placedHeight,
        balancePenalty,
        usedColumnCount: usedIndexes.length,
        lastUsedColumnIndex:
          usedIndexes.length > 0
            ? Math.max(...usedIndexes)
            : -1,
        firstOverflowOriginalIndex,
      };
    };

    type PlacementSimulation = {
      columns: string[][];
      spacerHeights: Record<string, number>;
      usedHeights: number[];
      startColumnIndex: number;
      endColumnIndex: number;
      remainingAfter: number;
    };

    let spacerSequence = 0;
    const simulateBlockPlacement = (
      sourceColumns: string[][],
      sourceSpacerHeights: Record<string, number>,
      sourceUsedHeights: number[],
      block: LayoutBlock,
      requestedStartColumn: number,
    ): PlacementSimulation | null => {
      const columns = sourceColumns.map((column) => [...column]);
      const spacerHeights = { ...sourceSpacerHeights };
      const usedHeights = [...sourceUsedHeights];
      const maxCapacity = Math.max(...pdfColumnCapacities, 0);
      const blockHasWideQuestion = block.items.some((item) => item.span === 2);

      const addSpacer = (columnIndex: number, height: number, reason: string) => {
        if (height <= 0.01) return;
        spacerSequence += 1;
        const key = `__pdf-layout-spacer__${spacerSequence}__${reason}`;
        columns[columnIndex].push(key);
        spacerHeights[key] = height;
        usedHeights[columnIndex] += height;
      };

      /*
       * Eski grup davranışı aynen korunur: tamamı 1 sütun olan bir grup tek
       * sütuna sığıyorsa parçalanmaz, uygun sonraki sütuna blok halinde geçer.
       */
      if (
        block.isGroup &&
        !blockHasWideQuestion &&
        block.totalHeight <= maxCapacity + 0.01
      ) {
        for (
          let columnIndex = requestedStartColumn;
          columnIndex < columns.length;
          columnIndex += 1
        ) {
          const capacity = pdfColumnCapacities[columnIndex] || 0;
          if (
            usedHeights[columnIndex] + block.totalHeight >
            capacity + 0.01
          ) {
            continue;
          }

          block.items.forEach((item) => {
            columns[columnIndex].push(item.key);
            usedHeights[columnIndex] += item.height;
          });

          return {
            columns,
            spacerHeights,
            usedHeights,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex,
            remainingAfter: Math.max(
              0,
              capacity - usedHeights[columnIndex],
            ),
          };
        }

        return null;
      }

      let columnIndex = Math.max(0, requestedStartColumn);
      let firstPlacedColumn = -1;
      let previousPlacedColumn = -1;

      for (const item of block.items) {
        if (item.span === 2) {
          let placedWide = false;
          let searchColumn = columnIndex;

          while (searchColumn < columns.length) {
            const pageIndex = Math.floor(searchColumn / pdfColumnCount);
            const pageStart = pageIndex * pdfColumnCount;
            let localStart = searchColumn - pageStart;

            /*
             * 3 sütunlu kitapçıkta geniş soru için tek izin verilen çift
             * 1. + 2. sütundur. 2. + 3. sütun çifti hiçbir zaman kullanılmaz.
             */
            if (pdfColumnCount === 3 && localStart !== 0) {
              searchColumn = pageStart + pdfColumnCount;
              continue;
            }

            if (localStart >= pdfColumnCount - 1) {
              searchColumn = pageStart + pdfColumnCount;
              continue;
            }

            const firstColumn = pageStart + localStart;
            const secondColumn = firstColumn + 1;
            if (secondColumn >= columns.length) break;

            const sharedTop = Math.max(
              usedHeights[firstColumn] || 0,
              usedHeights[secondColumn] || 0,
            );
            const sharedCapacity = Math.min(
              pdfColumnCapacities[firstColumn] || 0,
              pdfColumnCapacities[secondColumn] || 0,
            );

            if (sharedTop + item.height <= sharedCapacity + 0.01) {
              addSpacer(
                firstColumn,
                sharedTop - (usedHeights[firstColumn] || 0),
                `align-left-${item.originalIndex}`,
              );
              addSpacer(
                secondColumn,
                sharedTop - (usedHeights[secondColumn] || 0),
                `align-right-${item.originalIndex}`,
              );

              columns[firstColumn].push(item.key);
              usedHeights[firstColumn] += item.height;
              addSpacer(secondColumn, item.height, `wide-${item.originalIndex}`);

              if (firstPlacedColumn < 0) firstPlacedColumn = firstColumn;
              previousPlacedColumn = firstColumn;
              columnIndex = firstColumn;
              placedWide = true;
              break;
            }

            // Aynı sayfadaki bir sonraki iki-sütun çifti denenebilir; çift yoksa
            // sonraki sayfanın sol sütunundan devam edilir.
            if (localStart + 1 < pdfColumnCount - 1) {
              searchColumn = firstColumn + 1;
            } else {
              searchColumn = pageStart + pdfColumnCount;
            }
          }

          if (!placedWide) return null;
          continue;
        }

        while (columnIndex < columns.length) {
          const capacity = pdfColumnCapacities[columnIndex] || 0;
          if (
            usedHeights[columnIndex] + item.height <=
            capacity + 0.01
          ) {
            break;
          }
          columnIndex += 1;
        }

        if (columnIndex >= columns.length) return null;

        if (
          block.isGroup &&
          previousPlacedColumn >= 0 &&
          columnIndex > previousPlacedColumn
        ) {
          for (
            let continuation = previousPlacedColumn + 1;
            continuation <= columnIndex;
            continuation += 1
          ) {
            if ((columns[continuation] || []).length > 0) {
              return null;
            }
          }
        }

        if (firstPlacedColumn < 0) firstPlacedColumn = columnIndex;
        columns[columnIndex].push(item.key);
        usedHeights[columnIndex] += item.height;
        previousPlacedColumn = columnIndex;
      }

      if (firstPlacedColumn < 0 || previousPlacedColumn < 0) {
        return null;
      }

      return {
        columns,
        spacerHeights,
        usedHeights,
        startColumnIndex: firstPlacedColumn,
        endColumnIndex: previousPlacedColumn,
        remainingAfter: Math.max(
          0,
          (pdfColumnCapacities[previousPlacedColumn] || 0) -
            usedHeights[previousPlacedColumn],
        ),
      };
    };

    /*
     * BUTONA BASILMADAN ÖNCE:
     * Soru seçim sırası korunur. İlk sayfanın ilk sütunundan başlanır;
     * sütun dolunca sıradaki sütuna, sonra ikinci sayfaya geçilir.
     * Beş soru ilk sütuna sığıyorsa beşi de ilk sütunda kalır.
     */
    const buildSequentialLayout = (): LayoutResult => {
      let columns = Array.from(
        { length: pdfColumnCount * 2 },
        () => [] as string[],
      );
      let usedHeights = Array.from(
        { length: pdfColumnCount * 2 },
        () => 0,
      );
      const overflowKeys: string[] = [];
      let spacerHeights: Record<string, number> = {};
      let currentColumnIndex = 0;

      for (const block of blocks) {
        let startColumnIndex = currentColumnIndex;

        if (
          block.isGroup &&
          block.items.every((item) => item.span === 1) &&
          startColumnIndex < columns.length &&
          block.totalHeight <=
            (pdfColumnCapacities[startColumnIndex] || 0) + 0.01 &&
          usedHeights[startColumnIndex] > 0 &&
          usedHeights[startColumnIndex] + block.totalHeight >
            (pdfColumnCapacities[startColumnIndex] || 0) + 0.01
        ) {
          startColumnIndex += 1;
        }

        const placement = simulateBlockPlacement(
          columns,
          spacerHeights,
          usedHeights,
          block,
          startColumnIndex,
        );

        if (!placement) {
          overflowKeys.push(...block.items.map((item) => item.key));
          continue;
        }

        columns = placement.columns;
        spacerHeights = placement.spacerHeights;
        usedHeights = placement.usedHeights;
        currentColumnIndex = placement.endColumnIndex;
      }

      return finalizeLayout(columns, usedHeights, overflowKeys, spacerHeights);
    };

    type OptimizerMode = "compact-fit" | "best-fit";

    const buildOptimizedLayout = (
      orderedBlocks: LayoutBlock[],
      mode: OptimizerMode,
    ): LayoutResult => {
      let columns = Array.from(
        { length: pdfColumnCount * 2 },
        () => [] as string[],
      );
      let usedHeights = Array.from(
        { length: pdfColumnCount * 2 },
        () => 0,
      );
      const overflowKeys: string[] = [];
      let spacerHeights: Record<string, number> = {};

      for (const block of orderedBlocks) {
        const candidates: PlacementSimulation[] = [];

        for (
          let startColumnIndex = 0;
          startColumnIndex < columns.length;
          startColumnIndex += 1
        ) {
          const placement = simulateBlockPlacement(
            columns,
            spacerHeights,
            usedHeights,
            block,
            startColumnIndex,
          );
          if (!placement) continue;
          candidates.push(placement);

          if (mode === "compact-fit") {
            /*
             * İlk uygun erken sütun zaten en kompakt adaydır.
             * Aynı blok için daha sağdaki sütunları gereksiz yere denemeyiz.
             */
            break;
          }
        }

        if (candidates.length === 0) {
          overflowKeys.push(...block.items.map((item) => item.key));
          continue;
        }

        const selected =
          mode === "best-fit"
            ? candidates.reduce((best, candidate) => {
                if (
                  candidate.endColumnIndex !== best.endColumnIndex
                ) {
                  return candidate.endColumnIndex <
                    best.endColumnIndex
                    ? candidate
                    : best;
                }
                if (
                  Math.abs(
                    candidate.remainingAfter - best.remainingAfter,
                  ) > 0.01
                ) {
                  return candidate.remainingAfter <
                    best.remainingAfter
                    ? candidate
                    : best;
                }
                return candidate.startColumnIndex <
                  best.startColumnIndex
                  ? candidate
                  : best;
              }, candidates[0])
            : candidates[0];

        columns = selected.columns;
        spacerHeights = selected.spacerHeights;
        usedHeights = selected.usedHeights;
      }

      return finalizeLayout(columns, usedHeights, overflowKeys, spacerHeights);
    };

    const sequential = buildSequentialLayout();

    /*
     * 3 SÜTUN + 2 SÜTUNLUK SORU EKONOMİK YERLEŞİMİ
     * ------------------------------------------------
     * Geniş soru yalnız 1. ve 2. sütunu kaplar. Geniş sorunun üstünde veya
     * altında kalan normal sorular, soru sırası bozulmadan iki sütuna dengeli
     * ama sütun-sıralı biçimde paylaştırılır:
     *
     *   2 soru  -> 1. sütunda 1, 2. sütunda 1
     *   3 soru  -> 1. sütunda 2, 2. sütunda 1
     *   4 soru  -> 1. sütunda 2, 2. sütunda 2
     *
     * Böylece örneğin geniş Soru 3'ün altında yalnız Soru 4 ve Soru 5
     * kalıyorsa yan yana gelir; alt boşluk daha fazlaysa önce 1. sütun,
     * sonra 2. sütun doldurulur. Bu iki sütunluk alan bittikten sonra akış
     * 3. sütunda devam eder.
     *
     * Gxx/grup blokları burada TEK PARÇA kabul edilir; grup üyeleri iki
     * sütuna bölünmez. İçinde bizzat geniş soru bulunan karmaşık bir grup
     * varsa mevcut grup yerleşim algoritmasına geri dönülür.
     */
    const buildThreeColumnWideOptimizedLayout = (): LayoutResult => {
      let columns = Array.from(
        { length: pdfColumnCount * 2 },
        () => [] as string[],
      );
      let usedHeights = Array.from(
        { length: pdfColumnCount * 2 },
        () => 0,
      );
      let spacerHeights: Record<string, number> = {};
      let blockIndex = 0;

      const appendBlockToColumn = (
        block: LayoutBlock,
        columnIndex: number,
      ) => {
        block.items.forEach((item) => {
          columns[columnIndex].push(item.key);
          usedHeights[columnIndex] += item.height;
        });
      };

      type PairPartition = {
        count: number;
        split: number;
        leftHeight: number;
        rightHeight: number;
      };

      const choosePairPartition = (
        run: LayoutBlock[],
        leftColumn: number,
        rightColumn: number,
        reserveWideHeight = 0,
        requireAll = false,
      ): PairPartition | null => {
        const leftCapacity = pdfColumnCapacities[leftColumn] || 0;
        const rightCapacity = pdfColumnCapacities[rightColumn] || 0;
        const startLeft = usedHeights[leftColumn] || 0;
        const startRight = usedHeights[rightColumn] || 0;
        const maxCount = requireAll ? run.length : run.length;

        for (
          let count = maxCount;
          count >= (requireAll ? maxCount : 1);
          count -= 1
        ) {
          const prefix = run.slice(0, count);
          const prefixHeights = [0];
          prefix.forEach((block) => {
            prefixHeights.push(
              prefixHeights[prefixHeights.length - 1] +
                block.totalHeight,
            );
          });
          const totalHeight = prefixHeights[prefixHeights.length - 1];
          let best: (PairPartition & {
            balance: number;
            countBalance: number;
          }) | null = null;

          for (let split = 0; split <= count; split += 1) {
            const leftHeight = prefixHeights[split];
            const rightHeight = totalHeight - leftHeight;
            const leftAfter = startLeft + leftHeight;
            const rightAfter = startRight + rightHeight;

            if (
              leftAfter > leftCapacity + 0.01 ||
              rightAfter > rightCapacity + 0.01
            ) {
              continue;
            }

            if (reserveWideHeight > 0) {
              const sharedTop = Math.max(leftAfter, rightAfter);
              const sharedCapacity = Math.min(
                leftCapacity,
                rightCapacity,
              );
              if (
                sharedTop + reserveWideHeight >
                sharedCapacity + 0.01
              ) {
                continue;
              }
            }

            const balance = Math.abs(leftAfter - rightAfter);
            const desiredLeftCount = Math.ceil(count / 2);
            const countBalance = Math.abs(split - desiredLeftCount);
            const candidate = {
              count,
              split,
              leftHeight,
              rightHeight,
              balance,
              countBalance,
            };

            if (
              !best ||
              candidate.balance < best.balance - 0.01 ||
              (Math.abs(candidate.balance - best.balance) <= 0.01 &&
                candidate.countBalance < best.countBalance) ||
              (Math.abs(candidate.balance - best.balance) <= 0.01 &&
                candidate.countBalance === best.countBalance &&
                candidate.split > best.split)
            ) {
              best = candidate;
            }
          }

          if (best) {
            return {
              count: best.count,
              split: best.split,
              leftHeight: best.leftHeight,
              rightHeight: best.rightHeight,
            };
          }

          if (requireAll) break;
        }

        return null;
      };

      const placePairPartition = (
        run: LayoutBlock[],
        partition: PairPartition,
        leftColumn: number,
        rightColumn: number,
      ) => {
        run
          .slice(0, partition.split)
          .forEach((block) => appendBlockToColumn(block, leftColumn));
        run
          .slice(partition.split, partition.count)
          .forEach((block) => appendBlockToColumn(block, rightColumn));
      };

      for (let pageIndex = 0; pageIndex < 2 && blockIndex < blocks.length; pageIndex += 1) {
        const pageStart = pageIndex * pdfColumnCount;
        const leftColumn = pageStart;
        const rightColumn = pageStart + 1;
        const thirdColumn = pageStart + 2;
        let pairFinished = false;

        while (!pairFinished && blockIndex < blocks.length) {
          const currentBlock = blocks[blockIndex];
          const currentHasWide = currentBlock.items.some(
            (item) => item.span === 2,
          );

          if (currentHasWide) {
            const placement = simulateBlockPlacement(
              columns,
              spacerHeights,
              usedHeights,
              currentBlock,
              leftColumn,
            );

            if (!placement || placement.startColumnIndex !== leftColumn) {
              pairFinished = true;
              break;
            }

            columns = placement.columns;
            spacerHeights = placement.spacerHeights;
            usedHeights = placement.usedHeights;
            blockIndex += 1;
            continue;
          }

          let nextWideIndex = blockIndex;
          while (
            nextWideIndex < blocks.length &&
            blocks[nextWideIndex].items.every((item) => item.span === 1)
          ) {
            nextWideIndex += 1;
          }

          const normalRun = blocks.slice(blockIndex, nextWideIndex);
          const nextWideBlock =
            nextWideIndex < blocks.length
              ? blocks[nextWideIndex]
              : null;

          /*
           * Sıradaki geniş soruya kadar olan normal soruların tamamı ve geniş
           * soru aynı 1+2 sütun alanına sığıyorsa, normal soruları dengeli
           * olarak paylaştırıp geniş soruyu hemen altlarına yerleştir.
           */
          if (nextWideBlock) {
            const wideHeight = nextWideBlock.totalHeight;
            const beforeWidePartition = choosePairPartition(
              normalRun,
              leftColumn,
              rightColumn,
              wideHeight,
              true,
            );

            if (beforeWidePartition) {
              placePairPartition(
                normalRun,
                beforeWidePartition,
                leftColumn,
                rightColumn,
              );
              blockIndex = nextWideIndex;
              continue;
            }
          }

          /*
           * Geniş sorudan sonraki (veya sayfadaki son) normal akıştan mümkün
           * olan en uzun öneki 1+2 sütun altında tut. Seçilen önek iki sütuna
           * dengeli ve sütun-sıralı bölünür. Kalan sorular 3. sütuna geçer.
           */
          const partition = choosePairPartition(
            normalRun,
            leftColumn,
            rightColumn,
          );

          if (!partition) {
            pairFinished = true;
            break;
          }

          placePairPartition(
            normalRun,
            partition,
            leftColumn,
            rightColumn,
          );
          blockIndex += partition.count;

          if (partition.count < normalRun.length || !nextWideBlock) {
            pairFinished = true;
          }
        }

        /*
         * 1+2 sütun alanı tamamlandıktan sonra sıradaki normal bloklar 3.
         * sütunda yukarıdan aşağı devam eder. Geniş soru 3. sütuna geçmez;
         * bir sonraki sayfanın 1+2 sütunundan başlar.
         */
        while (blockIndex < blocks.length) {
          const block = blocks[blockIndex];
          if (block.items.some((item) => item.span === 2)) break;
          const capacity = pdfColumnCapacities[thirdColumn] || 0;
          if (
            usedHeights[thirdColumn] + block.totalHeight >
            capacity + 0.01
          ) {
            break;
          }
          appendBlockToColumn(block, thirdColumn);
          blockIndex += 1;
        }
      }

      const overflowKeys = blocks
        .slice(blockIndex)
        .flatMap((block) => block.items.map((item) => item.key));

      return finalizeLayout(
        columns,
        usedHeights,
        overflowKeys,
        spacerHeights,
      );
    };

    /*
     * "SORULARI YERLEŞTİR" BUTONU:
     * İki A4 sayfanın bütün sütunları için farklı yerleşim sıraları denenir.
     * Öncelik sırası:
     *   1) iki sayfaya EN FAZLA soru sığdırmak,
     *   2) aynı soru adedinde daha AZ sütun/sayfa kullanmak,
     *   3) aynı durumda daha erken seçilmiş soruları korumak,
     *   4) yine eşitse kullanılabilir alanı daha verimli doldurmak.
     *
     * Bu hesap yalnız butona basıldığında ekranda kullanılır.
     */
    const byAverageHeightAscending = [...blocks].sort(
      (left, right) =>
        left.totalHeight / Math.max(1, left.questionCount) -
          right.totalHeight / Math.max(1, right.questionCount) ||
        left.originalIndex - right.originalIndex,
    );
    const byHeightAscending = [...blocks].sort(
      (left, right) =>
        left.totalHeight - right.totalHeight ||
        left.originalIndex - right.originalIndex,
    );
    const byHeightDescending = [...blocks].sort(
      (left, right) =>
        right.totalHeight - left.totalHeight ||
        left.originalIndex - right.originalIndex,
    );

    const optimizedCandidates: LayoutResult[] = [
      buildOptimizedLayout(blocks, "compact-fit"),
      buildOptimizedLayout(blocks, "best-fit"),
      buildOptimizedLayout(
        byAverageHeightAscending,
        "compact-fit",
      ),
      buildOptimizedLayout(
        byAverageHeightAscending,
        "best-fit",
      ),
      buildOptimizedLayout(byHeightAscending, "compact-fit"),
      buildOptimizedLayout(byHeightAscending, "best-fit"),
      buildOptimizedLayout(byHeightDescending, "compact-fit"),
    ];

    const genericOptimized = optimizedCandidates.reduce(
      (best, candidate) => {
        if (candidate.placedCount !== best.placedCount) {
          return candidate.placedCount > best.placedCount
            ? candidate
            : best;
        }

        if (
          candidate.usedColumnCount !== best.usedColumnCount
        ) {
          return candidate.usedColumnCount <
            best.usedColumnCount
            ? candidate
            : best;
        }

        if (
          candidate.lastUsedColumnIndex !==
          best.lastUsedColumnIndex
        ) {
          return candidate.lastUsedColumnIndex <
            best.lastUsedColumnIndex
            ? candidate
            : best;
        }

        if (
          candidate.firstOverflowOriginalIndex !==
          best.firstOverflowOriginalIndex
        ) {
          return candidate.firstOverflowOriginalIndex >
            best.firstOverflowOriginalIndex
            ? candidate
            : best;
        }

        if (
          Math.abs(
            candidate.placedHeight - best.placedHeight,
          ) > 0.01
        ) {
          return candidate.placedHeight > best.placedHeight
            ? candidate
            : best;
        }

        return candidate.balancePenalty < best.balancePenalty
          ? candidate
          : best;
      },
      optimizedCandidates[0] || sequential,
    );

    const hasWideQuestion = items.some((item) => item.span === 2);
    const hasComplexWideGroup = blocks.some(
      (block) =>
        block.items.some((item) => item.span === 2) &&
        (block.isGroup || block.items.length !== 1),
    );
    const optimized =
      pdfColumnCount === 3 && hasWideQuestion && !hasComplexWideGroup
        ? buildThreeColumnWideOptimizedLayout()
        : genericOptimized;

    return { sequential, optimized };
  }, [
    pdfSelectedQuestions,
    pdfColumnCount,
    pdfQuestionSpacing,
    pdfColumnWidthMm,
    pdfImageRatios,
    pdfPage1ColumnsTopMm,
    pdfShowAnswers,
  ]);

  const pdfAutoLayout =
    pdfPlacementMode === "optimized"
      ? pdfLayoutOptions.optimized
      : pdfLayoutOptions.sequential;

  const pdfAutoColumns = pdfAutoLayout.columns;
  const pdfLayoutSpacerHeights = pdfAutoLayout.spacerHeights || {};
  const pdfOverflowKeys = pdfAutoLayout.overflowKeys;
  const pdfHasTwoColumnQuestions = pdfSelectedQuestions.some(
    (question) => pdfQuestionColumnSpan(question) === 2,
  );


  useEffect(() => {
    setPdfManualColumns(null);
    setPdfPlacementMode("sequential");
  }, [
    pdfBuilderState?.updatedAt,
    pdfColumnCount,
    pdfQuestionSpacing,
    testDefinition.name,
  ]);

  // PDF'de elle sürükleyip soru sırası değiştirme kaldırıldı.
  // Fiziksel yerleşim yalnız seçilen akış + Soruları Yerleştir algoritmasıyla belirlenir.
  const pdfColumns = pdfAutoColumns;

  const pdfQuestionByKey = useMemo(
    () =>
      new Map(
        pdfSelectedQuestions.map((question) => [question.key, question]),
      ),
    [pdfSelectedQuestions],
  );

  const pdfDisplayOrder = useMemo(() => {
    const order = new Map<string, number>();
    let sequence = 1;

    /*
     * Geniş soru bulunan düzende ekonomik yerleşim fiziksel konumu değiştirir
     * ama soru numarasını değiştirmez. Numara, seçim/sınav sırasına bağlıdır.
     */
    if (pdfHasTwoColumnQuestions) {
      pdfSelectedQuestions.forEach((question) => {
        const key = String(question.key);
        if (!order.has(key)) {
          order.set(key, sequence);
          sequence += 1;
        }
      });
      return order;
    }

    pdfColumns.forEach((column) => {
      column.forEach((key) => {
        if (pdfLayoutSpacerHeights[key] != null) return;
        if (!order.has(key)) {
          order.set(key, sequence);
          sequence += 1;
        }
      });
    });

    return order;
  }, [
    pdfColumns,
    pdfLayoutSpacerHeights,
    pdfHasTwoColumnQuestions,
    pdfSelectedQuestions,
  ]);

  const pdfOverflowQuestions = pdfOverflowKeys
    .map((key) =>
      pdfSelectedQuestions.find((question) => question.key === key),
    )
    .filter((question): question is QuestionBankItem => Boolean(question));

  /*
   * Uyarı standardı:
   * Önce iki sayfaya sığabilen optimum soru grubu oluşturulur.
   * Sayfalar dolduktan SONRA 5 ek soru daha seçildiğinde uyarı görünür.
   */
  const pdfEnoughQuestions = pdfOverflowQuestions.length >= 5;

  const printPdfDocument = () => {
    window.print();
  };

  const savePdfDocument = async () => {
    const cleanFilePart = (value: unknown) =>
      String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ");

    const gradeText = cleanFilePart(
      testDefinition.grade || pdfBuilderState?.grade || "",
    );
    const courseText = cleanFilePart(
      pdfCourse?.name || pdfBuilderState?.courseName || "",
    );
    const testText = cleanFilePart(
      testDefinition.name || pdfBuilderState?.testName || "",
    );

    const pdfTitle = [
      gradeText ? `${gradeText}. Sınıf` : "",
      courseText,
      testText,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Test";

    /*
     * PDF KAYDET = testin nihai soru listesini de kalıcılaştırır.
     * Yönetici fazla soruları çıkardıktan sonra ekranda kalan soru seti hem
     * hazırlanmış test kaydına hem de varsa öğretmen görev kaydına yazılır.
     * Böylece ekran yeniden açıldığında eski görev listesi nihai setin üstüne
     * yazamaz ve sorular kaybolmaz/değişmez.
     */
    const finalKeys = Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? [...new Set(pdfBuilderState.selectedQuestionKeys.map(String).filter(Boolean))]
      : [];
    const finalKeySet = new Set(finalKeys);
    const finalSnapshotMap = new Map<string, QuestionBankItem>();
    [
      ...(Array.isArray(pdfBuilderState?.selectedQuestionSnapshots)
        ? pdfBuilderState.selectedQuestionSnapshots
        : []),
      ...pdfSelectedQuestions,
    ].forEach((question: QuestionBankItem) => {
      const key = String(question?.key || question?.questionId || "");
      if (key && finalKeySet.has(key)) finalSnapshotMap.set(key, question);
    });
    const finalSnapshots = finalKeys
      .map((key) => finalSnapshotMap.get(String(key)))
      .filter(Boolean) as QuestionBankItem[];
    const finalEffectiveQuestionCount = effectiveQuestionCountForTest(finalSnapshots);

    const activeIndex = savedTests.findIndex(
      (saved) =>
        saved.name === testDefinition.name &&
        saved.type === testDefinition.type &&
        saved.grade === testDefinition.grade &&
        saved.courseId === testDefinition.courseId &&
        saved.unitId === testDefinition.unitId &&
        saved.topicId === testDefinition.topicId &&
        saved.outcomeId === testDefinition.outcomeId,
    );

    if (activeIndex >= 0 && finalKeys.length > 0) {
      const now = new Date().toISOString();
      const activeSaved = savedTests[activeIndex];
      const finalQuestionIds = [...new Set(
        finalSnapshots.map((question) => String(question.questionId || question.key || "").trim()).filter(Boolean),
      )];

      // Test kesinleşmeden hemen önce merkezi kullanım tablosunu kontrol et ve bütün
      // soruları bu teste rezerve et. Başka bir sınav/testte kullanılan soru varsa
      // test kaydı/PDF kesinleştirilmez.
      const conflictCheck = await checkQuestionBankExamConflicts(String(activeSaved.id), finalQuestionIds);
      const conflicts = Array.isArray(conflictCheck?.conflicts) ? conflictCheck.conflicts.map(String) : [];
      if (conflicts.length > 0) {
        showNotice(`${conflicts.length} soru başka bir sınav/testte kullanıldığı için bu test kaydedilemez. Soru havuzunu yenileyip farklı soru seçiniz.`);
        return;
      }

      const reservedNow: string[] = [];
      try {
        for (let index = 0; index < finalSnapshots.length; index += 1) {
          const question = finalSnapshots[index];
          const questionId = String(question.questionId || question.key || "").trim();
          if (!questionId) continue;
          const usageResult = await recordQuestionBankUsage({
            questionId,
            examId: String(activeSaved.id),
            examName: String(activeSaved.name),
            questionNumber: index + 1,
            source: "TestExamPreparer",
          });
          if (!usageResult?.duplicateUsage) reservedNow.push(questionId);
        }
      } catch (error) {
        await Promise.allSettled(
          reservedNow.map((questionId) => removeQuestionBankUsage(questionId, String(activeSaved.id))),
        );
        showNotice(error instanceof Error ? error.message : "Test soruları kullanım için kilitlenemedi.");
        return;
      }

      // Test kesinleştirildiğinde soru bankasında test adıyla oluşturulan geçici
      // kopya klasörü kaldırılır. Kullanım kayıtları silinmez; orijinal sorular
      // kendi kazanım klasörlerinde kalır ve başka sınav/testte yeniden seçilemez.
      try {
        const archiveCleanupResponse = await fetch(
          `/api/question-bank/archive/${encodeURIComponent(String(activeSaved.id))}`,
          { method: "DELETE", cache: "no-store" },
        );
        const archiveCleanupBody = await archiveCleanupResponse.json().catch(() => ({}));
        if (!archiveCleanupResponse.ok) {
          throw new Error(String(archiveCleanupBody?.error || "Test soru klasörü temizlenemedi."));
        }
      } catch (error) {
        await Promise.allSettled(
          reservedNow.map((questionId) => removeQuestionBankUsage(questionId, String(activeSaved.id))),
        );
        showNotice(error instanceof Error ? error.message : "Test soru klasörü temizlenemedi.");
        return;
      }

      const nextSavedTests = [...savedTests];
      nextSavedTests[activeIndex] = {
        ...activeSaved,
        selectedQuestionKeys: finalKeys,
        selectedQuestionSnapshots: finalSnapshots,
        buildStatus: "ready",
        readyAt: activeSaved.readyAt || now,
        finalizedAt: activeSaved.finalizedAt || now,
        questionsLocked: true,
        questionsLockedAt: activeSaved.questionsLockedAt || now,
        updatedAt: now,
      };
      setSavedTests(nextSavedTests);
      sqliteStorage.setItem("edupanel_saved_tests_v1", JSON.stringify(nextSavedTests));

      const assignment = assignmentForTest(activeSaved.id);
      if (assignment) {
        const finalizedAssignment: TeacherTestAssignment = {
          ...assignment,
          selectedQuestionKeys: finalKeys,
          selectedQuestionSnapshots: finalSnapshots,
          selectedQuestionCount: finalEffectiveQuestionCount,
          remainingQuestionCount: 0,
          selectionStatus: "completed",
          questionPoolLocked: true,
          questionUsageLocked: true,
          completedAt: assignment.completedAt || now,
          updatedAt: now,
        };
        try {
          await fetchTeacherAssignmentApi(
            `/api/database/collections/teacherTestAssignments/${encodeURIComponent(finalizedAssignment.id)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(finalizedAssignment),
            },
          );
          await loadTeacherAssignmentData();
        } catch (error) {
          console.warn("Nihai öğretmen soru listesi kaydedilemedi:", error);
        }
      }

      showNotice(`"${activeSaved.name}" kaydedildi. ${finalEffectiveQuestionCount} soru kalıcı olarak teste bağlandı ve yeniden seçime kapatıldı.`);
    }

    const previousTitle = document.title;
    let restored = false;
    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
    };

    document.title = pdfTitle;
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
    window.setTimeout(restoreTitle, 30_000);
  };

  const reflowPdfQuestions = () => {
    setPdfManualColumns(null);
    setPdfPlacementMode("optimized");
  };

  const removePdfQuestion = (questionKey: string) => {
    const activeSaved = savedTests.find(
      (saved) =>
        saved.name === testDefinition.name &&
        saved.type === testDefinition.type &&
        saved.grade === testDefinition.grade &&
        saved.courseId === testDefinition.courseId &&
        saved.unitId === testDefinition.unitId &&
        saved.topicId === testDefinition.topicId &&
        saved.outcomeId === testDefinition.outcomeId,
    );
    if (savedTestQuestionsLocked(activeSaved)) {
      showNotice("Kilitli testte sorular silinemez. Önce test kilidini açınız.");
      return;
    }
    const normalizedQuestionKey = String(questionKey || "");
    const stored = readJson("edupanel_test_builder_v2", {});
    const current = {
      ...stored,
      ...(pdfBuilderState || {}),
    };
    const nextKeys = Array.isArray(current?.selectedQuestionKeys)
      ? current.selectedQuestionKeys
          .map(String)
          .filter((key: string) => key !== normalizedQuestionKey)
      : [];

    const nextSnapshots = Array.isArray(
      current?.selectedQuestionSnapshots,
    )
      ? current.selectedQuestionSnapshots.filter(
          (question: QuestionBankItem) => {
            const key = String(
              question?.key || question?.questionId || question?.code || "",
            );
            return key !== normalizedQuestionKey;
          },
        )
      : [];

    const next = {
      ...current,
      selectedQuestionKeys: nextKeys,
      selectedQuestionSnapshots: nextSnapshots,
      updatedAt: new Date().toISOString(),
    };

    sqliteStorage.setItem(
      "edupanel_test_builder_v2",
      JSON.stringify(next),
    );
    setPdfBuilderState(next);
    setPdfManualColumns(null);

    window.dispatchEvent(
      new CustomEvent("edupanel:test-builder-updated", {
        detail: next,
      }),
    );
  };

  useEffect(() => {
    const preview = pdfPreviewRef.current;
    if (!preview) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      event.stopPropagation();

      const direction = event.deltaY < 0 ? 1 : -1;
      setPdfZoom((current) => {
        const next = current + direction * 0.1;
        return Math.min(2, Math.max(0.5, Number(next.toFixed(2))));
      });
    };

    preview.addEventListener("wheel", handleWheel, { passive: false });
    return () => preview.removeEventListener("wheel", handleWheel);
  }, []);


  const renderPdfHeader = () => {
    if (!pdfHeaderSource) return null;

    return (
      <div
        className="absolute z-10 flex items-center justify-center overflow-hidden"
        style={{
          top: `${pdfHeaderTopMm}mm`,
          left: `${pdfHeaderLeftMm}mm`,
          right: `${pdfHeaderRightMm}mm`,
          width: `${pdfHeaderWidthMm}mm`,
          height: `${pdfHeaderHeightMm}mm`,
        }}
      >
        <img
          src={pdfHeaderSource}
          alt={`${pdfCourse?.name || "Test"} test başlığı`}
          draggable={false}
          className="block h-full w-full"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center center",
          }}
        />
      </div>
    );
  };
  const renderPdfTestTopic = () => {
    const rawTopicText = String(testDefinition.name || "").trim();
    if (!rawTopicText) return null;

    // Otomatik test adının sonundaki sayı test numarasıdır.
    // Örnek: "İlk Türk Devletleri 2" => başlık: "İlk Türk Devletleri", no: "2"
    const numberMatch = rawTopicText.match(/(?:\s+|[-–—]\s*)(\d+)\s*$/);
    const testNumber = numberMatch?.[1] || "";
    const topicText = numberMatch
      ? rawTopicText.slice(0, numberMatch.index).trim()
      : rawTopicText;

    return (
      <>
        <style>{ED_GOTHIC_FONT_STYLE + PDF_PRINT_STYLE}</style>

        {/* 
          TEST BAŞLIĞI KALICI YERLEŞİM STANDARDI
          - Tasarım Merkezi başlığındaki yeşil bloğun SOL kenarı referanstır.
          - Test başlığının SON HARFİ bu yeşil kenardan TAM 3 mm solda biter.
          - Üst konum bütün testlerde: 12.5 mm.
          - Başlığın SON HARFİ bu sağ sınırı hiçbir zaman geçemez.
          - Kısa/uzun bütün başlıklar aynı noktaya sağdan yaslanır.
          - Test numarası başlıktan bağımsız konumlandırılır.
        */}
        {pdfUpperTitle && (
          <div
            className="absolute z-20 text-black"
            style={{
              top: `${pdfLayoutSettings.upperTitleTop}mm`,
              left: "5mm",
              right: `${pdfLayoutSettings.upperTitleRight}mm`,
              textAlign: "right",
              whiteSpace: "nowrap",
              overflow: "hidden",
              fontFamily: '"Blogger_Sans", sans-serif',
              fontSize: "8pt",
              lineHeight: 1,
              fontWeight: 300,
              color: "#000000",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {pdfUpperTitle.toLocaleUpperCase("tr-TR")}
          </div>
        )}

        <div
          className="absolute z-20 text-black"
          style={{
            top: `${pdfLayoutSettings.mainTitleTop}mm`,
            left: "5mm",
            right: `${pdfLayoutSettings.mainTitleRight}mm`,
            textAlign: "right",
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: '"Ed-Gothic", sans-serif',
            fontSize: "16pt",
            lineHeight: 1.1,
            fontWeight: 400,
            color: "#dc2626",
          }}
        >
          {topicText}
        </div>

        <span
          className="absolute z-20"
          style={{
            top: `${pdfLayoutSettings.testNoTop}mm`,
            right: `${pdfLayoutSettings.testNoRight}mm`,
            fontFamily: '"MSYHBD", sans-serif',
            fontSize: "20pt",
            lineHeight: 1,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {pdfTestNumber}
        </span>
      </>
    );
  };

  const renderPdfColumn = (
    pageNumber: 1 | 2,
    localColumnIndex: number,
  ) => {
    const globalColumnIndex =
      (pageNumber - 1) * pdfColumnCount + localColumnIndex;
    const questionKeys = pdfColumns[globalColumnIndex] || [];
    const capacity = pdfColumnCapacities[globalColumnIndex];
    const used = questionKeys.reduce((sum, key) => {
      const spacerHeight = Number(pdfLayoutSpacerHeights[key] || 0);
      if (spacerHeight > 0) return sum + spacerHeight;
      const question = pdfQuestionByKey.get(key);
      return question ? sum + pdfQuestionHeightMm(question) : sum;
    }, 0);

    /*
     * "Sorular Arası Mesafe" değeri her sorunun SONUNDA bırakılacak
     * minimum boşluktur; son soru da bu kurala dahildir.
     *
     * Sütunda minimum boşluklar ayrıldıktan sonra serbest alan kalırsa,
     * bu alan sütundaki soru sayısına bölünür ve HER sorunun altındaki
     * boşluğa eşit olarak eklenir. Böylece aynı sütundaki tüm soruların
     * soru-sonrası mesafesi aynı olur.
     */
    const realQuestionCount = questionKeys.filter(
      (key) => pdfLayoutSpacerHeights[key] == null,
    ).length;
    const distributableGap =
      !pdfHasTwoColumnQuestions && realQuestionCount > 0
        ? Math.max(0, capacity - used) / realQuestionCount
        : 0;

    const isOverflow = used > capacity + 0.1;

    return (
      <div
        key={`pdf-column-${pageNumber}-${localColumnIndex}`}
        className={`relative h-full min-w-0 ${
          isOverflow ? "bg-red-50/40" : ""
        }`}
      >
        {localColumnIndex < pdfColumnCount - 1 && (
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 border-r border-dashed border-slate-300"
            style={{ right: "-2.5mm" }}
          />
        )}

        <div className="flex h-full flex-col">
          {questionKeys.map((key, index) => {
            const spacerHeight = Number(pdfLayoutSpacerHeights[key] || 0);
            if (spacerHeight > 0) {
              return (
                <div
                  key={key}
                  aria-hidden="true"
                  className="shrink-0"
                  style={{ height: `${spacerHeight}mm` }}
                />
              );
            }

            const question = pdfQuestionByKey.get(key);
            if (!question) return null;

            const baseHeight = pdfQuestionHeightMm(question);

            // Her soru kendi minimum alt boşluğunu taşır. Sütunda kalan
            // serbest yükseklik de bütün sorulara eşit eklenir.
            const allocatedHeight = baseHeight + distributableGap;

            const visualHeight = pdfQuestionVisualHeightMm(question);
            const questionSpan = pdfQuestionColumnSpan(question);
            const questionWidth = pdfQuestionVisualWidthMm(question);
            const instructionHeight = pdfGroupInstructionHeightMm(question);
            const imageUrl = resolveQuestionImage(question);
            const groupId = questionGroupIdForTest(question);
            const groupQuestionCount = Math.max(1, Number(question.pdfGroupQuestionCount || question.questionGroupSize || 1));
            const rangeStart = Math.max(1, Number(pdfDisplayOrder.get(key) || index + 1));
            const storedGroupQuestionKeys = Array.isArray(question.pdfGroupQuestionKeys)
              ? question.pdfGroupQuestionKeys.map(String)
              : [];
            const actualGroupQuestionNumbers = storedGroupQuestionKeys
              .map((groupQuestionKey) => pdfDisplayOrder.get(groupQuestionKey))
              .filter((value): value is number => Number.isFinite(value));
            const groupQuestionNumbers = actualGroupQuestionNumbers.length === groupQuestionCount
              ? actualGroupQuestionNumbers
              : Array.from(
                  { length: groupQuestionCount },
                  (_, offset) => rangeStart + offset,
                );
            const groupQuestionNumberText = groupQuestionNumbers.length <= 1
              ? `${groupQuestionNumbers[0]}.`
              : `${groupQuestionNumbers.slice(0, -1).join(", ")} ve ${groupQuestionNumbers[groupQuestionNumbers.length - 1]}.`;
            const groupRangeText = groupQuestionNumbers.length <= 1
              ? `${groupQuestionNumberText} soruyu aşağıdaki bilgilere göre cevaplayınız.`
              : `${groupQuestionNumberText} soruları aşağıdaki bilgilere göre cevaplayınız.`;
            const groupInstructionImage = String(question.pdfGroupLeaderImageUrl || question.questionGroupInstructionImageUrl || "");

            return (
              <div
                key={key}
                className="group relative cursor-default overflow-hidden rounded-[1.5mm] border border-transparent bg-white"
                style={{
                  height: `${allocatedHeight}mm`,
                  width: `${questionWidth}mm`,
                  zIndex: questionSpan === 2 ? 20 : undefined,
                }}
                title={
                  questionSpan === 2
                    ? "Bu soru 2 sütun genişliğinde yerleştirilir."
                    : groupId
                      ? "Grup soruları yönergesiyle birlikte ve kesintisiz tutulur."
                      : "Soru sırası otomatik PDF akışına göre korunur."
                }
              >
                {question.pdfGroupInstructionVisible ? (
                  <div
                    className="absolute left-0 right-0 overflow-hidden rounded-[1.2mm] border-[0.45mm] border-slate-900 bg-white"
                    style={{ top: "0mm", height: `${instructionHeight}mm`, padding: "1.4mm" }}
                  >
                    <div className="rounded-[0.8mm] border-[0.35mm] border-slate-900 bg-white px-[1.2mm] py-[0.8mm] text-[7.4pt] font-black leading-tight text-black">
                      {groupRangeText}
                    </div>
                    {question.questionGroupTitle ? (
                      <div className="mt-[0.8mm] text-[6.5pt] font-black text-slate-900">{question.questionGroupTitle}</div>
                    ) : null}
                    {question.questionGroupInstructionText ? (
                      <div className="mt-[0.6mm] whitespace-pre-wrap text-[6.2pt] font-semibold leading-tight text-slate-700">{question.questionGroupInstructionText}</div>
                    ) : null}
                    {groupInstructionImage ? (
                      <img
                        src={groupInstructionImage}
                        alt="Grup öncülü"
                        draggable={false}
                        className="mt-[1mm] block w-full object-top"
                        style={{ width: "100%", height: "auto" }}
                      />
                    ) : null}
                  </div>
                ) : null}

                <div
                  className="absolute z-10 flex items-center justify-center rounded-[1.2mm] border border-red-700 bg-red-600 text-white shadow-sm"
                  style={{
                    left: "0mm",
                    top: `${instructionHeight + (question.pdfGroupInstructionVisible ? 1 : 0)}mm`,
                    minWidth: "4mm",
                    height: "4mm",
                    paddingLeft: "0.6mm",
                    paddingRight: "0.6mm",
                    fontSize: "8pt",
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                  aria-label={`Soru ${pdfDisplayOrder.get(key) || index + 1}`}
                >
                  {pdfDisplayOrder.get(key) || index + 1}
                </div>

                {/* 
                  KRİTİK STANDART:
                  Numara alanı 0-4 mm.
                  4-5 mm arası TAM 1 mm boşluk.
                  Soru kartı HER ZAMAN 5 mm noktasından başlar.
                  Sütunda kalan ek alan soru kartının ÜSTÜNE eklenmez;
                  yalnız kartın ALTINDA boşluk olarak kalır.
                */}
                <div
                  className="absolute left-0 right-0 overflow-hidden"
                  style={{
                    top: `${instructionHeight + (question.pdfGroupInstructionVisible ? 1 : 0) + 5}mm`,
                    height: `${visualHeight}mm`,
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={question.code}
                      draggable={false}
                      className="block object-top"
                      style={{
                        width: "100%",
                        height: "auto",
                        maxWidth: "100%",
                      }}
                    />
                  ) : (
                    <div
                      className="flex w-full items-center justify-center border border-dashed border-slate-200 text-[6px] text-slate-400"
                      style={{ height: `${visualHeight}mm` }}
                    >
                      {question.code}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isOverflow && (
          <div className="absolute bottom-1 left-1 right-1 rounded bg-red-600 px-1 py-0.5 text-center text-[5px] font-black text-white">
            SÜTUN TAŞIYOR
          </div>
        )}
      </div>
    );
  };

  const renderPdfColumns = (pageNumber: 1 | 2) => {
    const columnStyle: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${pdfColumnCount}, minmax(0, 1fr))`,
      gap: "5mm",
      position: "absolute",
      left: "5mm",
      right: "5mm",
      top:
        pageNumber === 1
          ? `${pdfPage1ColumnsTopMm}mm`
          : `${pdfPage2ColumnsTopMm}mm`,
      /*
       * 1. sayfa: top 26 mm, bottom 8 mm.
       * 2. sayfa: cevap anahtarı üst kenarı bottom 14 mm;
       * soru alanı bunun 3 mm üstünde, yani bottom 17 mm.
       */
      bottom:
        pageNumber === 2
          ? `${pdfPage2ColumnsBottomMm}mm`
          : `${pdfPage1BottomMm}mm`,
    };

    return (
      <div style={columnStyle}>
        {Array.from({ length: pdfColumnCount }).map((_, columnIndex) =>
          renderPdfColumn(pageNumber, columnIndex),
        )}
      </div>
    );
  };

  const renderAnswerStrip = () => {
    if (!pdfShowAnswers) return null;

    const placedQuestionKeys = new Set(
      pdfColumns
        .flat()
        .filter((key) => pdfLayoutSpacerHeights[key] == null),
    );
    const orderedQuestions = pdfHasTwoColumnQuestions
      ? pdfSelectedQuestions.filter((question) =>
          placedQuestionKeys.has(String(question.key)),
        )
      : pdfColumns
          .flat()
          .map((key) => pdfQuestionByKey.get(key))
          .filter((question): question is QuestionBankItem => Boolean(question));

    if (orderedQuestions.length === 0) return null;

    /*
     * Cevap anahtarı standardı:
     * - Tek satır.
     * - 28 soru için sabit hücre ölçüsü.
     * - Daha az soru varsa hücreler küçülmez; grup sayfada yatay ortalanır.
     * - Soru numarası üstte, cevap aynı hücre içinde çok az aşağıda.
     */
    const maxAnswerCount = 28;
    const answerBoxWidthMm = 6.4;
    const answerBoxHeightMm = pdfAnswerStripHeightMm;
    const answerGapMm = 0.7;

    return (
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: "5mm",
          right: "5mm",
          bottom: `${pdfAnswerStripBottomMm}mm`,
          height: `${answerBoxHeightMm}mm`,
          gap: `${answerGapMm}mm`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {orderedQuestions.slice(0, maxAnswerCount).map((question, index) => {
          const answer = answerFromQuestionCard(question);
          const displayedQuestionNumber =
            pdfDisplayOrder.get(String(question.key)) || index + 1;

          return (
            <div
              key={`answer-${question.key}`}
              className="flex shrink-0 flex-col items-center justify-center rounded-[1.2mm] border border-slate-400 bg-white text-black"
              style={{
                width: `${answerBoxWidthMm}mm`,
                height: `${answerBoxHeightMm}mm`,
              }}
            >
              <span
                className="text-[5.5pt] font-medium leading-none text-slate-700"
                style={{ transform: "translateY(-0.35mm)" }}
              >
                {displayedQuestionNumber}
              </span>

              <span
                className="text-[6.5pt] font-black leading-none text-red-700"
                style={{ marginTop: "0.55mm" }}
              >
                {answer || "?"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const fetchCollection = async <T,>(collection: string): Promise<T[]> => {
    const response = await fetch(
      `/api/database/collections/${encodeURIComponent(collection)}`,
      { cache: "no-store" },
    );
    const body = await response.json().catch(() => ([]));
    if (!response.ok) {
      throw new Error(
        String((body as any)?.error || `${collection} okunamadı.`),
      );
    }
    return Array.isArray(body) ? (body as T[]) : [];
  };

  const loadTeacherAssignmentData = async () => {
    try {
      const [links, assignments, teachers] = await Promise.all([
        fetchCollection<any>("behaviorTeacherLinks"),
        fetchCollection<TeacherTestAssignment>("teacherTestAssignments"),
        fetchCollection<any>("school_teachers").catch(() => []),
      ]);

      const readPhone = (item: any) =>
        String(
          item?.phone ||
            item?.teacherPhone ||
            item?.telefon ||
            item?.gsm ||
            item?.mobile ||
            "",
        );

      const findTeacher = (link: any) =>
        teachers.find(
          (item: any) =>
            String(item?.id || "") === String(link?.teacherId || ""),
        ) ||
        teachers.find(
          (item: any) =>
            String(item?.name || "").toLocaleLowerCase("tr-TR") ===
            String(link?.teacherName || "").toLocaleLowerCase("tr-TR"),
        );

      const now = Date.now();
      const usableLinks = links
        .filter((item) => {
          if (item?.active === false) return false;
          if (item?.expiresAt && Date.parse(item.expiresAt) < now) return false;
          return item?.teacherId && item?.teacherName;
        })
        .map((item) => {
          const teacherRow = findTeacher(item);
          const token = String(item?.token || "");
          return {
            id: String(item.id || item.teacherId),
            teacherId: String(item.teacherId || ""),
            teacherName: String(item.teacherName || ""),
            phone: readPhone(teacherRow) || readPhone(item),
            token,
            url:
              String(item?.url || "") ||
              (token
                ? `${window.location.origin}/t/${encodeURIComponent(token)}`
                : ""),
            active: item.active !== false,
            expiresAt: String(item.expiresAt || ""),
          };
        })
        .sort((a, b) =>
          a.teacherName.localeCompare(b.teacherName, "tr-TR"),
        );

      setTeacherLinks(usableLinks);
      const sortedAssignments = (Array.isArray(assignments) ? assignments : []).sort((a, b) =>
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
      );
      setTeacherAssignments(sortedAssignments);

      // Summary endpoint'i olmasa bile ortak koleksiyonda tamamlanmış TEST
      // görevlerini yönetici test kaydına aktar. Sınav görevleri ayıklanır.
      window.setTimeout(() => {
        sortedAssignments
          .filter(
            (assignment) =>
              assignment.assignmentKind !== "exam" &&
              assignment.workflowType !== "exam-question-selection" &&
              (assignment.selectionStatus === "completed" ||
                Boolean(assignment.completedAt)),
          )
          .forEach((assignment) => {
            void applyCompletedTeacherSelection(assignment);
          });
      }, 0);
    } catch {
      // Test Paneli temel işlevi bozulmasın; görevlendirme alanı sessizce boş kalır.
    }
  };

  /*
   * Test Paneli açılışı öğretmen görevlendirme servisinden bağımsızdır.
   * Görev verisi yalnız görevlendirme özelliği gerçekten kullanıldığında
   * yüklenir. Böylece 8787/proxy problemi Test Panelini düşüremez.
   */

  const applyCompletedTeacherSelection = async (
    summary: TeacherTestAssignment,
  ) => {
    // Sınav hazırlama görevleri aynı koleksiyonu kullanır; Test Paneli yalnız
    // "test" türündeki görevi kendi test kaydına dönüştürür.
    if (
      summary.assignmentKind === "exam" ||
      summary.workflowType === "exam-question-selection"
    ) {
      return;
    }

    const assignmentId = String(summary.id || "");
    const testId = String(summary.testId || "");
    if (!assignmentId || !testId) return;
    if (teacherFinalizationBusyRef.current.has(assignmentId)) return;
    if (teacherFinalizedAssignmentRef.current.has(assignmentId)) return;

    const saved = savedTests.find(
      (test) => String(test.id || "") === testId,
    );
    if (!saved || saved.status === "cancelled") return;
    if (savedTestQuestionsLocked(saved)) return;

    teacherFinalizationBusyRef.current.add(assignmentId);

    try {
      // Öncelik resmi final-selection endpoint'indedir. Bazı kurulumlarda bu
      // endpoint bulunmasa bile öğretmen telefonu seçimi doğrudan ortak
      // teacherTestAssignments kaydına yazdığı için summary verisi güvenli
      // geri dönüş kaynağı olarak kullanılabilir.
      let body: any = {};
      try {
        const response = await fetchTeacherAssignmentApi(
          `/api/question-bank/teacher-assignments/${encodeURIComponent(
            assignmentId,
          )}/final-selection`,
          {},
          1800,
        );
        const responseBody = await response.json().catch(() => ({}));
        if (response.ok) body = responseBody;
      } catch {
        body = {};
      }

      if (!Array.isArray(body?.selectedQuestionKeys)) {
        body = {
          ...summary,
          selectedQuestionKeys: summary.selectedQuestionKeys || [],
          selectedQuestionSnapshots: summary.selectedQuestionSnapshots || [],
          updatedAt: summary.updatedAt || new Date().toISOString(),
        };
      }

      const finalKeys: string[] = Array.isArray(body?.selectedQuestionKeys)
        ? Array.from(
            new Set<string>(
              (body.selectedQuestionKeys as unknown[]).map((value) =>
                String(value),
              ),
            ),
          )
        : [];
      const finalSnapshots =
        Array.isArray(body?.selectedQuestionSnapshots) &&
        body.selectedQuestionSnapshots.length > 0
          ? body.selectedQuestionSnapshots
          : Array.isArray(summary.selectedQuestionSnapshots)
            ? summary.selectedQuestionSnapshots
            : [];

      // Öğretmen/yönetici soru seçimini tamamladığı anda test henüz kesinleşmemiş
      // olsa da sorular kendi kazanım klasörlerinde test adıyla açılan geçici
      // klasöre kopyalanır. Kesinleştirmede bu klasör mevcut kurala göre silinir.
      await syncDraftTestQuestionArchive(
        String(saved.id || testId),
        String(saved.name || summary.testName || "Test"),
        finalKeys,
        finalSnapshots,
      );

      const sameSelection =
        JSON.stringify((saved.selectedQuestionKeys || []).map(String).sort()) ===
        JSON.stringify([...finalKeys].sort());

      if (!sameSelection || finalSnapshots.length > 0) {
        setSavedTests((current) => {
          const next = current.map((test) =>
            String(test.id || "") === testId
              ? {
                  ...test,
                  selectedQuestionKeys: finalKeys,
                  selectedQuestionSnapshots: finalSnapshots,
                  questionSelectionMode: "teacher" as const,
                  assignedTeacherId: String(
                    body?.teacherId || summary.teacherId || test.assignedTeacherId || "",
                  ),
                  assignedTeacherName: String(
                    body?.teacherName || summary.teacherName || test.assignedTeacherName || "",
                  ),
                  requiredQuestionCount:
                    summary.questionCountMode === "flexible" ||
                    test.questionCountMode === "flexible"
                      ? finalKeys.length
                      : Math.max(
                          1,
                          Number(
                            summary.requiredQuestionCount ||
                              test.requiredQuestionCount ||
                              finalKeys.length ||
                              1,
                          ),
                        ),
                  questionCountMode:
                    summary.questionCountMode || test.questionCountMode || "fixed",
                  buildStatus: "ready" as const,
                  readyAt: String(body?.updatedAt || new Date().toISOString()),
                  updatedAt: String(body?.updatedAt || new Date().toISOString()),
                }
              : test,
          );

          sqliteStorage.setItem(
            "edupanel_saved_tests_v1",
            JSON.stringify(next),
          );
          return next;
        });

        const activeTestMatches =
          testDefinition.name === saved.name &&
          testDefinition.grade === saved.grade &&
          testDefinition.courseId === saved.courseId &&
          testDefinition.unitId === saved.unitId &&
          testDefinition.topicId === saved.topicId &&
          testDefinition.outcomeId === saved.outcomeId;

        if (activeTestMatches) {
          applyBuilderForTest(
            {
              name: saved.name,
              type: saved.type,
              grade: saved.grade,
              courseId: saved.courseId,
              unitId: saved.unitId,
              topicId: saved.topicId,
              outcomeId: saved.outcomeId,
              columnCount: saved.columnCount === 3 ? 3 : 2,
              questionSpacing: Number(saved.questionSpacing || 10),
              showAnswersInPdf: saved.showAnswersInPdf !== false,
            },
            finalKeys,
            finalSnapshots,
          );
        }

        showNotice(
          `${String(body?.teacherName || summary.teacherName || "Öğretmen")} soru seçimini tamamladı. ${finalKeys.length} soru teste aktarıldı.`,
        );
      }

      teacherFinalizedAssignmentRef.current.add(assignmentId);
    } catch (error) {
      console.error("Öğretmen final seçimi yönetici teste aktarılamadı:", error);
    } finally {
      teacherFinalizationBusyRef.current.delete(assignmentId);
    }
  };

  const loadTeacherAssignmentSummary = async () => {
    if (teacherSummaryRequestBusyRef.current) return;
    if (document.visibilityState !== "visible") return;

    teacherSummaryRequestBusyRef.current = true;
    try {
      const response = await fetchTeacherAssignmentApi(
        "/api/question-bank/teacher-assignments/summary",
        {},
        1800,
      );
      const body = await response.json().catch(() => ([]));
      if (!response.ok) {
        throw new Error(
          String((body as any)?.error || "Öğretmen görev özeti okunamadı."),
        );
      }

      const summaries: TeacherTestAssignment[] = Array.isArray(body)
        ? body
        : [];

      setTeacherAssignments((current) => {
        const currentMap = new Map<string, TeacherTestAssignment>(
          current.map(
            (assignment) =>
              [String(assignment.id || ""), assignment] as [
                string,
                TeacherTestAssignment,
              ],
          ),
        );

        return summaries.map((summary) => {
          const previous = currentMap.get(String(summary.id || ""));
          return {
            ...(previous || ({} as TeacherTestAssignment)),
            ...summary,
            selectedQuestionKeys: Array.isArray(summary.selectedQuestionKeys)
              ? summary.selectedQuestionKeys.map(String)
              : previous?.selectedQuestionKeys || [],
            selectedQuestionSnapshots:
              previous?.selectedQuestionSnapshots || [],
            availableQuestionSnapshots:
              previous?.availableQuestionSnapshots || [],
            scopeTree: previous?.scopeTree || [],
          };
        });
      });

      for (const summary of summaries) {
        const assignmentId = String(summary.id || "");
        const completed =
          summary.selectionStatus === "completed" ||
          Boolean(summary.completedAt);

        if (!completed && assignmentId) {
          teacherFinalizedAssignmentRef.current.delete(assignmentId);
        }

        if (completed) {
          void applyCompletedTeacherSelection(summary);
        }
      }
    } catch (error) {
      console.error("Öğretmen görev özeti okunamadı:", error);
    } finally {
      teacherSummaryRequestBusyRef.current = false;
    }
  };

  /*
   * Öğretmene test görevi verildiyse yönetici ekranı görevin tamamlanmasını
   * otomatik izler. Yönetici "Görevi Sonlandır" dediği anda
   * seçimler SavedTestDefinition kaydına alınır ve buildStatus=ready olur.
   * Sınav görevleri bu izleme akışına dahil edilmez.
   */
  const pendingTeacherTestSignature = savedTests
    .filter(
      (test) =>
        test.status !== "cancelled" &&
        test.questionSelectionMode === "teacher" &&
        test.buildStatus !== "ready",
    )
    .map((test) => `${test.id}:${test.updatedAt}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!pendingTeacherTestSignature) return;

    let stopped = false;

    const refreshTeacherTestAssignments = async () => {
      await loadTeacherAssignmentData();
      if (!stopped) {
        await loadTeacherAssignmentSummary();
      }
    };

    void refreshTeacherTestAssignments();

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refreshTeacherTestAssignments();
      }
    }, 8000);

    const onFocus = () => void refreshTeacherTestAssignments();
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [pendingTeacherTestSignature]);

  const assignmentForTest = (testId: string) =>
    teacherAssignments.find(
      (item) =>
        String(item.testId || "") === String(testId || "") &&
        item.assignmentKind !== "exam" &&
        item.workflowType !== "exam-question-selection",
    );

  const fetchTeacherAssignmentApi = async (
    path: string,
    init: RequestInit = {},
    proxyTimeoutMs = 2000,
  ): Promise<Response> => {
    /*
     * AbortController bazı tarayıcı/Vite kombinasyonlarında
     * "signal is aborted without reason" hatasını modül seviyesine
     * taşıyabiliyor. Bu küçük görev API isteklerinde fetch'i abort etmiyoruz;
     * yalnız Promise.race ile bekleme süresini sınırlandırıyoruz.
     */
    const run = async (url: string, timeoutMs: number) => {
      let timer = 0;

      try {
        return await Promise.race<Response>([
          fetch(url, {
            ...init,
            cache: init.cache || "no-store",
          }),
          new Promise<Response>((_, reject) => {
            timer = window.setTimeout(() => {
              reject(
                new Error(
                  `API isteği ${Math.ceil(timeoutMs / 1000)} saniyede yanıt vermedi.`,
                ),
              );
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    };

    try {
      return await run(path, proxyTimeoutMs);
    } catch (proxyError) {
      const directUrl =
        `${window.location.protocol}//${window.location.hostname}:8787${path}`;

      try {
        return await run(directUrl, 4000);
      } catch (directError) {
        const directMessage =
          directError instanceof Error
            ? directError.message
            : "Doğrudan API bağlantısı kurulamadı.";
        const proxyMessage =
          proxyError instanceof Error
            ? proxyError.message
            : "Proxy API bağlantısı kurulamadı.";

        /*
         * Kritik kural: görevlendirme servisi erişilemezse Test Paneli
         * exception ile düşmez. Çağıran kod normal HTTP hatası gibi işler.
         */
        return new Response(
          JSON.stringify({
            error:
              `Görevlendirme API bağlantısı kurulamadı. ` +
              `Proxy: ${proxyMessage} Doğrudan: ${directMessage}`,
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
  };

  const reservedQuestionKeysForTest = (
    targetTestId: string,
  ): Set<string> => {
    const reserved = new Set<string>();
    const targetId = String(targetTestId || "");

    savedTests.forEach((saved) => {
      if (String(saved.id || "") === targetId) return;
      if (saved.status === "cancelled") return;
      if (!savedTestQuestionsLocked(saved)) return;

      (saved.selectedQuestionKeys || []).forEach((key) => {
        const normalized = String(key || "").trim();
        if (normalized) reserved.add(normalized);
      });
    });

    /*
     * Yalnız kilitli ve iptal edilmemiş testlerin öğretmen seçimleri
     * rezervasyon sayılır. Kilit açıldığında soru başka testler için yeniden
     * seçilebilir hale gelir.
     */
    teacherAssignments.forEach((assignment) => {
      if (String(assignment.testId || "") === targetId) return;

      const ownerTest = savedTests.find(
        (saved) =>
          String(saved.id || "") === String(assignment.testId || ""),
      );
      if (!ownerTest || ownerTest.status === "cancelled") return;
      if (!savedTestQuestionsLocked(ownerTest)) return;

      (assignment.selectedQuestionKeys || []).forEach((key) => {
        const normalized = String(key || "").trim();
        if (normalized) reserved.add(normalized);
      });
    });

    return reserved;
  };

  const loadCanonicalQuestionsForTest = async (
    saved: SavedTestDefinition,
  ): Promise<QuestionBankItem[]> => {
    const params = new URLSearchParams();
    params.set("status", "active");
    params.set("grade", saved.grade);
    params.set(
      "courseId",
      canonicalCourseId(saved.courseId, saved.unitId, saved.topicId, saved.outcomeId),
    );
    params.set("questionType", "study");
    params.set("usage", "unused");
    if (saved.unitId) params.set("unitId", saved.unitId);
    if (saved.type !== "unit" && saved.topicId) params.set("topicId", saved.topicId);
    if (saved.type === "outcome" && saved.outcomeId) params.set("outcomeId", saved.outcomeId);
    params.set("limit", "500");

    const records: QuestionBankApiRecord[] = [];
    let offset = 0;
    let total = 0;
    do {
      params.set("offset", String(offset));
      const response = await fetchTeacherAssignmentApi(
        `/api/question-bank/questions?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(String(body?.error || "Öğretmen soru havuzu okunamadı."));
      }
      const payload = await response.json();
      const rows = extractQuestionRows(payload).filter(
        (record) =>
          String(record?.status || "active").toLowerCase() === "active" &&
          String(record?.questionType || record?.question_type || "study").toLowerCase() === "study",
      );
      records.push(...rows);
      total = Number(payload?.total || records.length);
      offset += rows.length;
      if (rows.length === 0) break;
    } while (offset < total);

    const unique = new Map<string, QuestionBankItem>();
    records
      .map((record) => apiRecordToQuestionItem(record, catalog))
      .forEach((question) => {
        const identity = String(
          question.questionId || question.storagePath || question.code || question.key,
        );
        if (identity && !unique.has(identity)) unique.set(identity, question);
      });
    const reserved = reservedQuestionKeysForTest(saved.id);
    return [...unique.values()].filter(
      (question) => !reserved.has(String(question.key)),
    );
  };

  const buildAssignmentScopeTree = (
    saved: SavedTestDefinition,
    availableQuestions: QuestionBankItem[] = [],
  ): TeacherAssignmentScopeUnit[] => {
    const course = catalog.find((item) => item.id === saved.courseId);
    const unit = course?.units.find(
      (item) => String(item.id) === String(saved.unitId),
    );
    if (!unit) return [];

    const allTopics = unit.topics || [];
    const topics =
      saved.type === "unit"
        ? allTopics
        : allTopics.filter(
            (topic) => String(topic.id) === String(saved.topicId),
          );

    return [
      {
        id: String(unit.id),
        name: String(unit.name || unit.id),
        topics: topics.map((topic) => {
          const allOutcomes = topic.outcomes || topic.objectives || [];
          const outcomes =
            saved.type === "outcome"
              ? allOutcomes.filter(
                  (outcome, index) =>
                    outcomeIdOf(outcome, index) === saved.outcomeId,
                )
              : allOutcomes;

          const outcomeNodes: TeacherAssignmentScopeOutcome[] = outcomes.map(
            (outcome, index) => {
              const id = outcomeIdOf(outcome, index);
              return {
                id,
                name: outcomeNameOf(outcome),
                questions: availableQuestions.filter(
                  (question) =>
                    String(question.topicId) === String(topic.id) &&
                    String(question.outcomeId) === String(id),
                ),
              };
            },
          );

          const directTopicQuestions = availableQuestions.filter(
            (question) =>
              String(question.topicId) === String(topic.id) &&
              !String(question.outcomeId || "").trim(),
          );
          if (directTopicQuestions.length > 0) {
            outcomeNodes.unshift({
              id: `${topic.id}::__topic__`,
              name: `${topic.name} – Konu Soruları`,
              questions: directTopicQuestions,
            });
          }

          return {
            id: String(topic.id),
            name: String(topic.name || topic.id),
            outcomes: outcomeNodes,
          };
        }),
      },
    ];
  };

  const assignmentAvailableQuestions = (
    _saved: SavedTestDefinition,
    availableQuestions: QuestionBankItem[] = [],
  ): QuestionBankItem[] => availableQuestions;

  const saveTeacherAssignmentForTest = async (
    savedTest: SavedTestDefinition,
    teacherId: string,
    rawQuestionCount: number,
    resetSelection = false,
  ) => {
    const teacher = teacherLinks.find(
      (item) => String(item.teacherId) === String(teacherId),
    );
    if (!teacher) {
      throw new Error(
        "Soruları seçecek öğretmen bulunamadı. Öğretmen telefon bağlantısını kontrol edin.",
      );
    }

    const existing = assignmentForTest(savedTest.id);
    const flexibleQuestionCount = Number(rawQuestionCount || 0) <= 0;
    const requestedQuestionCount = flexibleQuestionCount
      ? 1
      : Math.max(1, Math.floor(Number(rawQuestionCount || 0)));
    const now = new Date().toISOString();

    setAssignmentBusy(true);
    setAssignmentBusyText("Soru havuzu hazırlanıyor…");

    try {
      const availableQuestions = await loadCanonicalQuestionsForTest(savedTest);

      if (availableQuestions.length === 0) {
        throw new Error(
          "Bu test kapsamında öğretmene gönderilebilecek aktif soru bulunamadı.",
        );
      }

      if (!flexibleQuestionCount && requestedQuestionCount > availableQuestions.length) {
        throw new Error(
          `Bu kapsamda ${availableQuestions.length} kullanılabilir soru var. Yönetici en fazla ${availableQuestions.length} soru seçtirebilir.`,
        );
      }

      const assignment: TeacherTestAssignment = {
        assignmentKind: "test",
        workflowType: "test-question-selection",
        id: existing?.id || `test-assignment-${savedTest.id}`,
        testId: savedTest.id,
        testName: savedTest.name,
        testType: savedTest.type,
        grade: savedTest.grade,
        courseId: savedTest.courseId,
        courseName:
          catalog.find((item) => item.id === savedTest.courseId)?.name ||
          savedTest.courseId,
        unitId: savedTest.unitId,
        topicId: savedTest.topicId,
        outcomeId: savedTest.outcomeId,
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
        scopeTree: buildAssignmentScopeTree(savedTest, availableQuestions),
        availableQuestionSnapshots: availableQuestions,
        questionPoolUpdatedAt: now,
        questionPoolLocked:
          !resetSelection &&
          existing?.teacherId === teacher.teacherId &&
          Array.isArray(existing?.selectedQuestionKeys) &&
          existing.selectedQuestionKeys.length > 0,
        requiredQuestionCount: flexibleQuestionCount ? 1 : requestedQuestionCount,
        maxQuestionCount: flexibleQuestionCount
          ? availableQuestions.length
          : requestedQuestionCount,
        questionCountMode: flexibleQuestionCount ? "flexible" : "fixed",
        selectedQuestionKeys: (
          !resetSelection && existing?.teacherId === teacher.teacherId
            ? existing?.selectedQuestionKeys || []
            : []
        ).slice(
          0,
          flexibleQuestionCount ? availableQuestions.length : requestedQuestionCount,
        ),
        selectedQuestionSnapshots: (
          !resetSelection && existing?.teacherId === teacher.teacherId
            ? existing?.selectedQuestionSnapshots || []
            : []
        ).slice(
          0,
          flexibleQuestionCount ? availableQuestions.length : requestedQuestionCount,
        ),
        selectionStatus: "in_progress",
        completedAt: "",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      setAssignmentBusyText("Test görevi kaydediliyor…");
      const response = await fetchTeacherAssignmentApi(
        `/api/database/collections/teacherTestAssignments/${encodeURIComponent(
          assignment.id,
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assignment),
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(body?.error || "Test soru seçimi görevlendirmesi kaydedilemedi."),
        );
      }

      const phone = normalizeMhatsappNumber(teacher.phone || "");
      const settings = loadMhatsappSettings();
      const teacherUrl = teacher.url || "";
      let deliveryMessage = "";

      if (!teacherUrl) {
        deliveryMessage =
          " Öğretmenin e-Nstitü telefon bağlantısı bulunamadığı için WhatsApp bildirimi gönderilemedi.";
      } else if (!isValidMhatsappNumber(phone)) {
        deliveryMessage =
          " Öğretmenin geçerli telefon numarası bulunamadığı için WhatsApp bildirimi gönderilemedi.";
      } else if (!settings.token?.trim()) {
        deliveryMessage =
          " WhatsApp API tokenı bulunamadığı için bildirim gönderilemedi.";
      } else {
        const text =
          `Sayın ${teacher.teacherName},\n\n` +
          `e-Nstitü üzerinden "${savedTest.name}" için TEST SORU SEÇİM GÖREVİ tanımlanmıştır.\n\n` +
          (flexibleQuestionCount
            ? `Telefon uygulamasındaki "Soru İşlemleri" bölümünden uygun gördüğünüz sayıda soru seçip "Soruları Gönder ve Testi Oluştur" butonuna basınız.\n\n`
            : `Okul yöneticisi bu test için ${requestedQuestionCount} soru belirlemiştir. Telefon uygulamasındaki "Soru İşlemleri" bölümünden tam ${requestedQuestionCount} soru seçip "Soruları Gönder ve Testi Oluştur" butonuna basınız.\n\n`) +
          `${teacherUrl}`;

        const delivery = await sendTextMessage(settings, [phone], text);
        deliveryMessage = delivery.ok
          ? " WhatsApp bildirimi öğretmene gönderildi."
          : ` WhatsApp bildirimi gönderilemedi: ${
              delivery.error || "Bilinmeyen hata"
            }`;
      }

      await loadTeacherAssignmentData();

      return {
        assignment,
        teacher,
        requestedQuestionCount: flexibleQuestionCount ? 0 : requestedQuestionCount,
        deliveryMessage,
      };
    } finally {
      setAssignmentBusy(false);
      setAssignmentBusyText("");
    }
  };

  const assignTestToTeacher = async () => {
    if (!assigningTest || !assigningTeacherId) return;

    try {
      const result = await saveTeacherAssignmentForTest(
        assigningTest,
        assigningTeacherId,
        assigningQuestionCount,
      );

      setAssigningTest(null);
      setAssigningTeacherId("");
      setAssigningQuestionCount(10);
      showNotice(
        `"${assigningTest.name}" için ${result.teacher.teacherName} ${result.requestedQuestionCount} soru seçmek üzere görevlendirildi.${result.deliveryMessage}`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Test soru seçimi görevlendirmesi kaydedilemedi.",
      );
    }
  };

  const testListGrades = useMemo(
    () =>
      [...new Set(catalog.map((course) => course.grade))]
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b)),
    [catalog],
  );

  const testListCourses = useMemo(
    () =>
      catalog
        .filter((course) => course.grade === testListGrade)
        .sort((a, b) => a.name.localeCompare(b.name, "tr-TR")),
    [catalog, testListGrade],
  );

  const testSequenceNumber = (name: string) => {
    const match = String(name || "").trim().match(/(\d+)\s*$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };

  const visibleSavedTests = useMemo(
    () =>
      [...savedTests].sort((left, right) => {
        const leftCreatedAt = Date.parse(String(left.createdAt || left.updatedAt || "")) || 0;
        const rightCreatedAt = Date.parse(String(right.createdAt || right.updatedAt || "")) || 0;
        if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;
        return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
      }),
    [savedTests],
  );

  const testListCourse = catalog.find(
    (course) => course.id === testListCourseId,
  );
  const testListUnits = testListCourse?.units || [];

  // SAYI KURALI:
  // Her düğüm yalnızca DOĞRUDAN kendi adına hazırlanmış testleri sayar.
  // Alt kazanımlardaki testler konu sayısına; konu/kazanım testleri ünite sayısına
  // kesinlikle eklenmez.
  const testsForScope = (
    type: TestDefinitionType,
    unitId: string,
    topicId = "",
    outcomeId = "",
  ) =>
    savedTests.filter(
      (test) =>
        test.grade === testListGrade &&
        test.courseId === testListCourseId &&
        test.type === type &&
        test.unitId === unitId &&
        (type === "unit" || test.topicId === topicId) &&
        (type !== "outcome" || test.outcomeId === outcomeId),
    );

  const testsForOutcomeTree = (unitId: string, topicId: string, outcomeId: string) =>
    savedTests
      .filter(
        (test) =>
          test.grade === testListGrade &&
          test.courseId === testListCourseId &&
          test.type === "outcome" &&
          String(test.unitId) === String(unitId) &&
          String(test.topicId) === String(topicId) &&
          String(test.outcomeId) === String(outcomeId),
      )
      .sort((left, right) => {
        const numberDifference = testSequenceNumber(left.name) - testSequenceNumber(right.name);
        if (numberDifference !== 0) return numberDifference;
        return String(left.name || "").localeCompare(String(right.name || ""), "tr-TR", { numeric: true });
      });

  const openScopeTests = (
    title: string,
    tests: SavedTestDefinition[],
  ) => {
    if (tests.length === 0) return;
    setScopeTestPicker({ title, tests });
  };

  const definitionGrades = useMemo(
    () =>
      [...new Set(catalog.map((course) => course.grade))]
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b)),
    [catalog],
  );

  const definitionCourses = useMemo(
    () =>
      catalog
        .filter((course) => course.grade === draftTestDefinition.grade)
        .sort((a, b) => a.name.localeCompare(b.name, "tr-TR")),
    [catalog, draftTestDefinition.grade],
  );

  const definitionCourse = definitionCourses.find(
    (course) => course.id === draftTestDefinition.courseId,
  );
  const definitionUnits = definitionCourse?.units || [];
  const definitionUnit = definitionUnits.find(
    (unit) => String(unit.id) === draftTestDefinition.unitId,
  );
  const definitionTopics = definitionUnit?.topics || [];
  const definitionTopic = definitionTopics.find(
    (topic) => String(topic.id) === draftTestDefinition.topicId,
  );
  const definitionOutcomes =
    definitionTopic?.outcomes || definitionTopic?.objectives || [];
  const definitionOutcome = definitionOutcomes.find(
    (outcome, index) =>
      outcomeIdOf(outcome, index) === draftTestDefinition.outcomeId,
  );

  const automaticTestBaseName =
    draftTestDefinition.type === "unit"
      ? String(definitionUnit?.name || "")
      : draftTestDefinition.type === "topic"
        ? String(definitionTopic?.name || "")
        : definitionOutcome
          ? outcomeNameOf(definitionOutcome)
          : "";

  const automaticTestSequence = useMemo(() => {
    if (!automaticTestBaseName) return 1;

    if (editingTestId) {
      const editing = savedTests.find((test) => test.id === editingTestId);
      if (editing) {
        const match = editing.name.match(/(\d+)\s*$/);
        if (match) return Number(match[1]);
      }
    }

    const sameScope = savedTests.filter(
      (test) =>
        test.id !== editingTestId &&
        test.grade === draftTestDefinition.grade &&
        test.courseId === draftTestDefinition.courseId &&
        test.type === draftTestDefinition.type &&
        test.unitId === draftTestDefinition.unitId &&
        (draftTestDefinition.type === "unit" ||
          test.topicId === draftTestDefinition.topicId) &&
        (draftTestDefinition.type !== "outcome" ||
          test.outcomeId === draftTestDefinition.outcomeId),
    );

    // İlk test = 1, aynı kapsamda bir önceki test varsa = 2, vb.
    return sameScope.length + 1;
  }, [
    automaticTestBaseName,
    editingTestId,
    savedTests,
    draftTestDefinition.grade,
    draftTestDefinition.courseId,
    draftTestDefinition.type,
    draftTestDefinition.unitId,
    draftTestDefinition.topicId,
    draftTestDefinition.outcomeId,
  ]);

  const editingSavedTest = editingTestId
    ? savedTests.find((test) => test.id === editingTestId)
    : undefined;

  // Test kapsamı güncellendiğinde otomatik test adı da yeni ünite/konu/kazanıma
  // göre yenilenir; mevcut test sıra numarası korunur.
  const automaticTestName = automaticTestBaseName
    ? `${automaticTestBaseName} ${automaticTestSequence}`
    : editingSavedTest?.name || "";

  const definitionTypeLabel = (type: TestDefinitionType) =>
    type === "unit"
      ? "Ünite Testi"
      : type === "topic"
        ? "Konu Testi"
        : "Kazanım Testi";

  const showNotice = (message: string) => {
    setSaveNotice(message);
    window.setTimeout(() => setSaveNotice(""), 2600);
  };

  const savedTestQuestionIds = (saved: SavedTestDefinition) => {
    const snapshotIds = (saved.selectedQuestionSnapshots || [])
      .map((question) => String(question?.questionId || question?.key || "").trim())
      .filter(Boolean);
    const fallbackKeys = (saved.selectedQuestionKeys || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return [...new Set([...snapshotIds, ...fallbackKeys])];
  };

  const toggleSavedTestQuestionLock = async (saved: SavedTestDefinition) => {
    if (testLockBusyId) return;
    const currentlyLocked = savedTestQuestionsLocked(saved);
    const questionIds = savedTestQuestionIds(saved);
    if (!currentlyLocked && questionIds.length === 0) {
      showNotice("Kilitlemek için testte en az bir soru bulunmalıdır.");
      return;
    }

    setTestLockBusyId(String(saved.id));
    try {
      if (!currentlyLocked) {
        const conflictCheck = await checkQuestionBankExamConflicts(
          String(saved.id),
          questionIds,
        );
        const conflicts = Array.isArray(conflictCheck?.conflicts)
          ? conflictCheck.conflicts.map(String)
          : [];
        if (conflicts.length > 0) {
          throw new Error(
            `${conflicts.length} soru başka bir test/sınavda kilitli olduğu için bu test kilitlenemedi.`,
          );
        }

        const response = await fetch("/api/question-bank/archive-selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            examId: String(saved.id),
            examName: String(saved.name || "Test"),
            questionIds,
            source: "TestExamPreparer-Lock",
            lockUsage: true,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(body?.error || "Test soruları kilitlenemedi."));
        }
      } else {
        for (const questionId of questionIds) {
          const response = await fetch("/api/question-bank/usage", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              questionId,
              examId: String(saved.id),
            }),
          });
          if (!response.ok && response.status !== 404) {
            const body = await response.json().catch(() => ({}));
            throw new Error(String(body?.error || "Test soru kilidi kaldırılamadı."));
          }
        }
        const archiveResponse = await fetch(
          `/api/question-bank/archive/${encodeURIComponent(String(saved.id))}`,
          { method: "DELETE", cache: "no-store" },
        );
        if (!archiveResponse.ok && archiveResponse.status !== 404) {
          const body = await archiveResponse.json().catch(() => ({}));
          throw new Error(String(body?.error || "Test soru arşivi temizlenemedi."));
        }
      }

      const now = new Date().toISOString();
      const nextSavedTests = savedTests.map((item) =>
        String(item.id) === String(saved.id)
          ? {
              ...item,
              questionsLocked: !currentlyLocked,
              questionsLockedAt: !currentlyLocked ? now : "",
              updatedAt: now,
            }
          : item,
      );
      setSavedTests(nextSavedTests);
      sqliteStorage.setItem(
        "edupanel_saved_tests_v1",
        JSON.stringify(nextSavedTests),
      );
      setCatalogVersion((value) => value + 1);
      window.dispatchEvent(new CustomEvent("edupanel:curriculum-updated"));
      showNotice(
        !currentlyLocked
          ? `"${saved.name}" kilitlendi. Sorular artık silinemez ve başka testlerde kullanılamaz.`
          : `"${saved.name}" kilidi açıldı. Soru listesi yeniden düzenlenebilir.`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Test kilidi değiştirilemedi.",
      );
    } finally {
      setTestLockBusyId("");
    }
  };

  const syncDraftTestQuestionArchive = async (
    testId: string,
    testName: string,
    selectedQuestionKeys: string[] = [],
    selectedQuestionSnapshots: QuestionBankItem[] = [],
  ) => {
    const snapshotIds = selectedQuestionSnapshots
      .map((question) => String(question?.questionId || question?.key || "").trim())
      .filter(Boolean);
    const questionIds = [...new Set(
      (snapshotIds.length > 0 ? snapshotIds : selectedQuestionKeys.map(String))
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    )];
    if (!testId || !testName || questionIds.length === 0) return null;

    const response = await fetch("/api/question-bank/archive-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        examId: String(testId),
        examName: String(testName),
        questionIds,
        source: "TestExamPreparer-Draft",
        lockUsage: false,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(body?.error || "Test soru klasörü oluşturulamadı."));
    }
    return body;
  };

  const setActiveTestShowAnswersInPdf = (checked: boolean) => {
    const nextDefinition: TestDefinition = {
      ...testDefinition,
      showAnswersInPdf: checked,
    };
    setTestDefinition(nextDefinition);

    const now = new Date().toISOString();
    const nextSavedTests = savedTests.map((saved) => {
      const isActive =
        saved.name === testDefinition.name &&
        saved.type === testDefinition.type &&
        saved.grade === testDefinition.grade &&
        saved.courseId === testDefinition.courseId &&
        saved.unitId === testDefinition.unitId &&
        saved.topicId === testDefinition.topicId &&
        saved.outcomeId === testDefinition.outcomeId;

      return isActive
        ? { ...saved, showAnswersInPdf: checked, updatedAt: now }
        : saved;
    });

    setSavedTests(nextSavedTests);
    sqliteStorage.setItem(
      "edupanel_saved_tests_v1",
      JSON.stringify(nextSavedTests),
    );

    const currentBuilder = readJson("edupanel_test_builder_v2", {});
    const nextBuilder = {
      ...currentBuilder,
      showAnswersInPdf: checked,
      updatedAt: now,
    };
    sqliteStorage.setItem(
      "edupanel_test_builder_v2",
      JSON.stringify(nextBuilder),
    );
    setPdfBuilderState(nextBuilder);
    window.dispatchEvent(
      new CustomEvent("edupanel:test-builder-updated", {
        detail: nextBuilder,
      }),
    );
  };

  const persistActiveTest = (definition: TestDefinition) => {
    const current = readJson("edupanel_test_builder_v2", {});
    sqliteStorage.setItem(
      "edupanel_test_builder_v2",
      JSON.stringify({
        ...current,
        testName: definition.name,
        testType: definition.type,
        grade: definition.grade,
        courseId: definition.courseId,
        unitId: definition.unitId,
        topicId: definition.type === "unit" ? "" : definition.topicId,
        outcomeId:
          definition.type === "outcome" ? definition.outcomeId : "",
        columnCount: definition.columnCount === 3 ? 3 : 2,
        questionSpacing: Number(definition.questionSpacing || 10),
        showAnswersInPdf: definition.showAnswersInPdf !== false,
        updatedAt: new Date().toISOString(),
      }),
    );
  };

  const applyBuilderForTest = (
    definition: TestDefinition,
    selectedQuestionKeys: string[] = [],
    selectedQuestionSnapshots: QuestionBankItem[] = [],
  ) => {
    const current = readJson("edupanel_test_builder_v2", {});
    const next = {
      ...current,
      activeTestId: definition.name,
      testName: definition.name,
      testType: definition.type,
      grade: definition.grade,
      courseId: definition.courseId,
      unitId: definition.unitId,
      topicId: definition.type === "unit" ? "" : definition.topicId,
      outcomeId:
        definition.type === "outcome" ? definition.outcomeId : "",
      columnCount: definition.columnCount === 3 ? 3 : 2,
      questionSpacing: Number(definition.questionSpacing || 10),
      showAnswersInPdf: definition.showAnswersInPdf !== false,
      selectedQuestionKeys: [...selectedQuestionKeys],
      selectedQuestionSnapshots: [...selectedQuestionSnapshots],
      updatedAt: new Date().toISOString(),
    };

    sqliteStorage.setItem(
      "edupanel_test_builder_v2",
      JSON.stringify(next),
    );
    setPdfBuilderState(next);
    setPdfManualColumns(null);

    window.dispatchEvent(
      new CustomEvent("edupanel:test-builder-updated", {
        detail: next,
      }),
    );
  };


  const openNewTest = () => {
    setEditingTestId(null);
    setDraftTeacherId("");
    void loadTeacherAssignmentData();

    /*
     * Yeni Test penceresi yalnız bir TANIM penceresidir. Burada aktif builder'ı
     * temizlemek, henüz testDefinition eski testi gösterirken boş soru listesinin
     * eski test kaydının üzerine yazılmasına neden oluyordu. Mevcut testin soru
     * setine dokunmuyoruz; yeni test ilk kez Soru İşlemleri'ne açıldığında kendi
     * (boş) builder'ı useSavedTest/applyBuilderForTest tarafından yüklenir.
     */

    setDraftTestDefinition({
      name: "",
      type: "unit",
      grade: testListGrade || "",
      courseId: testListCourseId || "",
      unitId: "",
      topicId: "",
      outcomeId: "",
      columnCount: 2,
      questionSpacing: 10,
      showAnswersInPdf: true,
    });
    setIsNewTestEditorOpen(true);
  };

  const editSavedTest = (saved: SavedTestDefinition) => {
    if (savedTestQuestionsLocked(saved)) {
      showNotice("Kilitli testin bilgileri düzenlenemez. Önce test kilidini açınız.");
      return;
    }
    setEditingTestId(saved.id);
    const existingAssignment = assignmentForTest(saved.id);
    setDraftTeacherId(
      String(
        existingAssignment?.teacherId ||
          saved.assignedTeacherId ||
          "",
      ),
    );
    void loadTeacherAssignmentData();
    setDraftTestDefinition({
      name: saved.name,
      type: saved.type,
      grade: saved.grade,
      courseId: saved.courseId,
      unitId: saved.unitId,
      topicId: saved.topicId,
      outcomeId: saved.outcomeId,
      columnCount: saved.columnCount === 3 ? 3 : 2,
      questionSpacing: Number(saved.questionSpacing || 10),
      showAnswersInPdf: saved.showAnswersInPdf !== false,
    });
    setIsNewTestEditorOpen(true);
  };

  const saveNewTest = async () => {
    if (!automaticTestName) return;
    if (!draftTeacherId) {
      showNotice("Soruları seçecek öğretmeni belirleyiniz.");
      return;
    }

    const now = new Date().toISOString();
    const definition: TestDefinition = {
      ...draftTestDefinition,
      name: automaticTestName,
      topicId:
        draftTestDefinition.type === "unit"
          ? ""
          : draftTestDefinition.topicId,
      outcomeId:
        draftTestDefinition.type === "outcome"
          ? draftTestDefinition.outcomeId
          : "",
      columnCount: draftTestDefinition.columnCount === 3 ? 3 : 2,
      questionSpacing: Number(draftTestDefinition.questionSpacing || 10),
      showAnswersInPdf: draftTestDefinition.showAnswersInPdf !== false,
    };

    const editingOriginal = editingTestId
      ? savedTests.find((saved) => saved.id === editingTestId)
      : undefined;
    if (editingOriginal && savedTestQuestionsLocked(editingOriginal)) {
      showNotice("Kilitli testin bilgileri kaydedilemez. Önce test kilidini açınız.");
      return;
    }
    const existingAssignment = editingTestId
      ? assignmentForTest(editingTestId)
      : undefined;

    const scopeChanged = Boolean(
      editingOriginal &&
        (editingOriginal.type !== definition.type ||
          editingOriginal.grade !== definition.grade ||
          editingOriginal.courseId !== definition.courseId ||
          editingOriginal.unitId !== definition.unitId ||
          editingOriginal.topicId !== definition.topicId ||
          editingOriginal.outcomeId !== definition.outcomeId),
    );

    const teacherChanged = Boolean(
      existingAssignment &&
        String(existingAssignment.teacherId || "") !== String(draftTeacherId),
    );
    const existingCompleted = Boolean(
      existingAssignment &&
        (existingAssignment.selectionStatus === "completed" ||
          existingAssignment.completedAt),
    );
    const questionCountChanged = Boolean(
      existingAssignment &&
        !existingCompleted &&
        existingAssignment.questionCountMode !== "flexible",
    );

    const testId =
      editingTestId ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `test-${Date.now()}`);

    const baseRecord: SavedTestDefinition = {
      ...(editingOriginal || ({} as SavedTestDefinition)),
      ...definition,
      id: testId,
      createdAt: editingOriginal?.createdAt || now,
      updatedAt: now,
      questionSelectionMode: "teacher",
      assignedTeacherId: draftTeacherId,
      assignedTeacherName:
        teacherLinks.find(
          (item) => String(item.teacherId) === String(draftTeacherId),
        )?.teacherName ||
        editingOriginal?.assignedTeacherName ||
        "",
      requiredQuestionCount: 0,
      questionCountMode: "flexible",
      selectedQuestionKeys:
        scopeChanged || teacherChanged
          ? []
          : Array.isArray(editingOriginal?.selectedQuestionKeys)
            ? editingOriginal!.selectedQuestionKeys
            : [],
      selectedQuestionSnapshots:
        scopeChanged || teacherChanged
          ? []
          : Array.isArray(editingOriginal?.selectedQuestionSnapshots)
            ? editingOriginal!.selectedQuestionSnapshots
            : [],
      questionsLocked: editingOriginal
        ? savedTestQuestionsLocked(editingOriginal)
        : false,
      questionsLockedAt: editingOriginal?.questionsLockedAt || "",
      buildStatus:
        existingCompleted &&
        !scopeChanged &&
        !teacherChanged &&
        !questionCountChanged
          ? "ready"
          : "awaiting_teacher",
      readyAt:
        existingCompleted &&
        !scopeChanged &&
        !teacherChanged &&
        !questionCountChanged
          ? editingOriginal?.readyAt || existingAssignment?.completedAt || now
          : "",
    };

    const mustCreateOrRefreshAssignment =
      !existingAssignment ||
      scopeChanged ||
      teacherChanged ||
      questionCountChanged ||
      !existingCompleted;

    try {
      let assignmentResult:
        | Awaited<ReturnType<typeof saveTeacherAssignmentForTest>>
        | null = null;

      if (mustCreateOrRefreshAssignment) {
        assignmentResult = await saveTeacherAssignmentForTest(
          baseRecord,
          draftTeacherId,
          0,
          scopeChanged || teacherChanged,
        );
      }

      const finalRecord: SavedTestDefinition = {
        ...baseRecord,
        assignedTeacherId:
          assignmentResult?.teacher.teacherId || baseRecord.assignedTeacherId,
        assignedTeacherName:
          assignmentResult?.teacher.teacherName || baseRecord.assignedTeacherName,
        buildStatus:
          mustCreateOrRefreshAssignment && !existingCompleted
            ? "awaiting_teacher"
            : baseRecord.buildStatus,
      };

      let nextSavedTests: SavedTestDefinition[];
      if (editingTestId) {
        nextSavedTests = savedTests.map((saved) =>
          saved.id === editingTestId ? finalRecord : saved,
        );
      } else {
        nextSavedTests = [finalRecord, ...savedTests];
      }

      setSavedTests(nextSavedTests);
      sqliteStorage.setItem(
        "edupanel_saved_tests_v1",
        JSON.stringify(nextSavedTests),
      );

      if (editingTestId) {
        setTestListGrade(definition.grade);
        setTestListCourseId(definition.courseId);

        const editingActive =
          testDefinition.name === editingOriginal?.name;

        if (
          finalRecord.buildStatus === "ready" &&
          editingActive
        ) {
          const activeDefinition: TestDefinition = {
            name: finalRecord.name,
            type: finalRecord.type,
            grade: finalRecord.grade,
            courseId: finalRecord.courseId,
            unitId: finalRecord.unitId,
            topicId: finalRecord.topicId,
            outcomeId: finalRecord.outcomeId,
            columnCount: finalRecord.columnCount === 3 ? 3 : 2,
            questionSpacing: Number(finalRecord.questionSpacing || 10),
            showAnswersInPdf: finalRecord.showAnswersInPdf !== false,
          };

          setTestDefinition(activeDefinition);
          applyBuilderForTest(
            activeDefinition,
            finalRecord.selectedQuestionKeys || [],
            finalRecord.selectedQuestionSnapshots || [],
          );
        }
      }

      setIsNewTestEditorOpen(false);
      setEditingTestId(null);

      const teacherName =
        assignmentResult?.teacher.teacherName ||
        finalRecord.assignedTeacherName ||
        "Öğretmen";

      showNotice(
        finalRecord.buildStatus === "ready"
          ? `"${finalRecord.name}" güncellendi.`
          : `"${finalRecord.name}" tanımlandı. ${teacherName} uygun gördüğü sayıda soru seçmek üzere görevlendirildi.${
              assignmentResult?.deliveryMessage || ""
            }`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Test kaydı ve öğretmen görevlendirmesi tamamlanamadı.",
      );
    }
  };

  const cancelTeacherQuestionAssignment = async (
    saved: SavedTestDefinition,
  ) => {
    const assignment = assignmentForTest(saved.id);
    if (!assignment) {
      showNotice("Bu test için aktif öğretmen görevi bulunamadı.");
      return;
    }

    const completed =
      assignment.selectionStatus === "completed" ||
      Boolean(assignment.completedAt);

    if (completed) {
      showNotice(
        "Öğretmen bu görevi tamamlamış. Tamamlanmış soru seçimi iptal edilemez.",
      );
      return;
    }

    const approved = window.confirm(
      `"${saved.name}" için öğretmen soru seçimi görevini iptal etmek istediğinizden emin misiniz?\n\nTest de iptal edilecek, öğretmenin yarım seçtiği sorular serbest bırakılacak ve başka testlerde yeniden kullanılabilecektir.`,
    );
    if (!approved) return;

    try {
      const response = await fetchTeacherAssignmentApi(
        `/api/question-bank/teacher-assignments/${encodeURIComponent(
          assignment.id,
        )}/cancel`,
        { method: "DELETE" },
        1800,
      );

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(body?.error || "Öğretmen görevi iptal edilemedi."),
        );
      }

      const now = new Date().toISOString();
      const nextSavedTests = savedTests.map((test) =>
        test.id === saved.id
          ? {
              ...test,
              status: "cancelled" as const,
              cancelledAt: now,
              selectedQuestionKeys: [],
              selectedQuestionSnapshots: [],
              updatedAt: now,
            }
          : test,
      );

      setSavedTests(nextSavedTests);
      sqliteStorage.setItem(
        "edupanel_saved_tests_v1",
        JSON.stringify(nextSavedTests),
      );

      setTeacherAssignments((current) =>
        current.filter(
          (item) => String(item.id || "") !== String(assignment.id || ""),
        ),
      );

      const cancellingActive =
        testDefinition.name === saved.name &&
        testDefinition.type === saved.type &&
        testDefinition.grade === saved.grade &&
        testDefinition.courseId === saved.courseId &&
        testDefinition.unitId === saved.unitId &&
        testDefinition.topicId === saved.topicId &&
        testDefinition.outcomeId === saved.outcomeId;

      if (cancellingActive) {
        applyBuilderForTest(
          {
            name: saved.name,
            type: saved.type,
            grade: saved.grade,
            courseId: saved.courseId,
            unitId: saved.unitId,
            topicId: saved.topicId,
            outcomeId: saved.outcomeId,
            columnCount: saved.columnCount === 3 ? 3 : 2,
            questionSpacing: Number(saved.questionSpacing || 10),
            showAnswersInPdf: saved.showAnswersInPdf !== false,
          },
          [],
          [],
        );
      }

      showNotice(
        `"${saved.name}" öğretmen görevi ile birlikte iptal edildi. Yarım seçilen sorular serbest bırakıldı.`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Öğretmen görevi iptal edilemedi.",
      );
    }
  };

  const completeTeacherQuestionAssignmentAsAdmin = async (
    saved: SavedTestDefinition,
  ) => {
    const assignment = assignmentForTest(saved.id);
    if (!assignment) {
      showNotice("Bu test için aktif öğretmen görevi bulunamadı.");
      return;
    }

    const completed =
      assignment.selectionStatus === "completed" ||
      Boolean(assignment.completedAt);
    if (completed) {
      showNotice("Bu soru seçimi görevi zaten sonlandırılmış.");
      return;
    }

    const selectedCount = Array.isArray(assignment.selectedQuestionKeys)
      ? assignment.selectedQuestionKeys.length
      : 0;
    const approved = window.confirm(
      `"${saved.name}" için ${assignment.teacherName || "öğretmen"} soru seçimi görevini sonlandırmak istediğinizden emin misiniz?\n\nŞu ana kadar seçilmiş ${selectedCount} soru korunacak ve görev öğretmen uygulamasından kapanacaktır.`,
    );
    if (!approved) return;

    try {
      const response = await fetchTeacherAssignmentApi(
        `/api/question-bank/teacher-assignments/${encodeURIComponent(assignment.id)}/complete-by-admin`,
        { method: "POST" },
        1800,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Öğretmen görevi sonlandırılamadı."));
      }

      const completedAssignment: TeacherTestAssignment = body?.assignment || {
        ...assignment,
        selectionStatus: "completed",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setTeacherAssignments((current) =>
        current.map((item) =>
          String(item.id || "") === String(assignment.id || "")
            ? completedAssignment
            : item,
        ),
      );

      await applyCompletedTeacherSelection(completedAssignment);
      showNotice(
        `"${saved.name}" soru seçimi görevi yönetici tarafından sonlandırıldı.`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Öğretmen görevi sonlandırılamadı.",
      );
    }
  };

  const cancelSavedTest = (saved: SavedTestDefinition) => {
    if (saved.status === "cancelled") return;
    if (savedTestQuestionsLocked(saved)) {
      showNotice("Kilitli test iptal edilemez. Önce test kilidini açınız.");
      return;
    }

    const approved = window.confirm(
      `"${saved.name}" adlı testi iptal etmek istediğinizden emin misiniz?\n\nBu teste ayrılmış sorular serbest kalacak ve başka testlerde yeniden kullanılabilecektir.`,
    );
    if (!approved) return;

    const now = new Date().toISOString();
    const nextSavedTests = savedTests.map((test) =>
      test.id === saved.id
        ? {
            ...test,
            status: "cancelled" as const,
            cancelledAt: now,
            updatedAt: now,
          }
        : test,
    );

    setSavedTests(nextSavedTests);
    sqliteStorage.setItem(
      "edupanel_saved_tests_v1",
      JSON.stringify(nextSavedTests),
    );

    const teacherAssignment = assignmentForTest(saved.id);
    if (teacherAssignment) {
      void fetchTeacherAssignmentApi(
        `/api/database/collections/teacherTestAssignments/${encodeURIComponent(
          teacherAssignment.id,
        )}`,
        { method: "DELETE" },
      ).finally(() => {
        void loadTeacherAssignmentData();
      });
    }

    showNotice(
      `"${saved.name}" iptal edildi. Bu teste ayrılmış sorular yeniden kullanılabilir hale getirildi.`,
    );
  };

  const useSavedTest = (saved: SavedTestDefinition) => {
    if (saved.status === "cancelled") {
      showNotice("İptal edilmiş test açılamaz. Soruları serbest bırakılmıştır.");
      return;
    }

    const definition: TestDefinition = {
      name: saved.name,
      type: saved.type,
      grade: saved.grade,
      courseId: saved.courseId,
      unitId: saved.unitId,
      topicId: saved.topicId,
      outcomeId: saved.outcomeId,
      columnCount: saved.columnCount === 3 ? 3 : 2,
      questionSpacing: Number(saved.questionSpacing || 10),
      showAnswersInPdf: saved.showAnswersInPdf !== false,
    };

    setTestDefinition(definition);

    const teacherAssignment = assignmentForTest(saved.id);

    /*
     * Hazırlanmış testin kendi soru listesi kanonik kayıttır. Özellikle yönetici
     * fazla soruları çıkardıktan sonra öğretmen görevinin daha eski listesi testi
     * yeniden açarken kayıtlı testin üzerine yazmamalıdır. Kayıtlı testte henüz
     * soru yoksa öğretmen görevi güvenli geri dönüş kaynağı olarak kullanılır.
     */
    const savedKeys = Array.isArray(saved.selectedQuestionKeys)
      ? saved.selectedQuestionKeys.map(String)
      : [];
    const assignmentKeys = Array.isArray(teacherAssignment?.selectedQuestionKeys)
      ? teacherAssignment!.selectedQuestionKeys.map(String)
      : [];
    const selectedKeys = savedKeys.length > 0 ? savedKeys : assignmentKeys;

    const savedSnapshots = Array.isArray(saved.selectedQuestionSnapshots)
      ? saved.selectedQuestionSnapshots
      : [];
    const assignmentSnapshots = Array.isArray(teacherAssignment?.selectedQuestionSnapshots)
      ? teacherAssignment!.selectedQuestionSnapshots
      : [];
    const selectedKeySet = new Set(selectedKeys.map(String));
    const snapshotMap = new Map<string, QuestionBankItem>();
    [...assignmentSnapshots, ...savedSnapshots].forEach((item: any) => {
      const key = String(item?.key || item?.questionId || item?.code || "");
      if (key && selectedKeySet.has(key)) snapshotMap.set(key, item);
    });
    const selectedSnapshots = selectedKeys
      .map((key) => snapshotMap.get(String(key)))
      .filter(Boolean) as QuestionBankItem[];

    applyBuilderForTest(definition, selectedKeys, selectedSnapshots);

    setActiveTopTab("create");
    showNotice(
      saved.questionSelectionMode === "teacher" && saved.buildStatus !== "ready"
        ? `"${saved.name}" Soru İşlemleri'ne açıldı. Yönetici de kalan soruları seçip testi tamamlayabilir.`
        : `"${saved.name}" Soru İşlemleri'ne açıldı.`,
    );
  };

  useEffect(() => {
    if (!testDefinition.name) return;

    const activeSaved = savedTests.find(
      (saved) =>
        saved.name === testDefinition.name &&
        saved.type === testDefinition.type &&
        saved.grade === testDefinition.grade &&
        saved.courseId === testDefinition.courseId &&
        saved.unitId === testDefinition.unitId &&
        saved.topicId === testDefinition.topicId &&
        saved.outcomeId === testDefinition.outcomeId,
    );
    if (!activeSaved) return;
    if (savedTestQuestionsLocked(activeSaved)) return;

    const assignment = assignmentForTest(activeSaved.id);
    if (!assignment) return;

    /*
     * Öğretmen görevi sürerken yönetici de aynı testi tamamlayabilir.
     * Bu nedenle öğretmenin yeni seçimlerini yönetici listesinin üzerine yazmak
     * yerine mevcut listeyle birleştiriyoruz. Görev tamamlandıktan sonra ise
     * tamamlanmış görev kaydı resmi final liste olarak kullanılır.
     */
    const assignmentKeys = Array.isArray(assignment.selectedQuestionKeys)
      ? assignment.selectedQuestionKeys.map(String)
      : [];
    const assignmentSnapshots = Array.isArray(
      assignment.selectedQuestionSnapshots,
    )
      ? assignment.selectedQuestionSnapshots
      : [];

    const currentKeys = Array.isArray(pdfBuilderState?.selectedQuestionKeys)
      ? pdfBuilderState.selectedQuestionKeys.map(String)
      : [];
    const currentSnapshots = Array.isArray(
      pdfBuilderState?.selectedQuestionSnapshots,
    )
      ? pdfBuilderState.selectedQuestionSnapshots
      : [];

    const assignmentCompleted =
      assignment.selectionStatus === "completed" || Boolean(assignment.completedAt);

    const savedKeys = Array.isArray(activeSaved.selectedQuestionKeys)
      ? activeSaved.selectedQuestionKeys.map(String)
      : [];
    const savedSnapshots = Array.isArray(activeSaved.selectedQuestionSnapshots)
      ? activeSaved.selectedQuestionSnapshots
      : [];
    const savedUpdatedAt = Date.parse(String(activeSaved.updatedAt || "")) || 0;
    const assignmentUpdatedAt = Date.parse(String(assignment.updatedAt || "")) || 0;

    // Yönetici öğretmen seçimi sonrasında listede değişiklik yaptıysa kayıtlı
    // test daha yenidir. Tamamlanmış öğretmen görevi eski soruyu tekrar eklemesin.
    const preferSavedCompletedSelection = Boolean(
      assignmentCompleted &&
        savedKeys.length > 0 &&
        savedUpdatedAt > assignmentUpdatedAt,
    );

    const nextKeys = assignmentCompleted
      ? preferSavedCompletedSelection
        ? [...new Set(savedKeys)]
        : [...new Set(assignmentKeys)]
      : [...new Set([...currentKeys, ...assignmentKeys])];

    const snapshotMap = new Map<string, QuestionBankItem>();
    [...currentSnapshots, ...assignmentSnapshots, ...savedSnapshots].forEach((item: any) => {
      const key = String(item?.key || item?.questionId || item?.code || "");
      if (key) snapshotMap.set(key, item);
    });
    const nextSnapshots = nextKeys
      .map((key) => snapshotMap.get(String(key)))
      .filter(Boolean) as QuestionBankItem[];

    const sameKeys =
      JSON.stringify(nextKeys) === JSON.stringify(currentKeys);
    const sameSnapshots =
      JSON.stringify(nextSnapshots.map((item) => String(item?.key || ""))) ===
      JSON.stringify(currentSnapshots.map((item: any) => String(item?.key || "")));

    if (sameKeys && sameSnapshots) return;

    applyBuilderForTest(
      testDefinition,
      nextKeys,
      nextSnapshots,
    );
  }, [
    teacherAssignments,
    testDefinition.name,
    testDefinition.type,
    testDefinition.grade,
    testDefinition.courseId,
    testDefinition.unitId,
    testDefinition.topicId,
    testDefinition.outcomeId,
  ]);


  const activeSavedTestForTeacherSelection = savedTests.find(
    (saved) =>
      saved.name === testDefinition.name &&
      saved.type === testDefinition.type &&
      saved.grade === testDefinition.grade &&
      saved.courseId === testDefinition.courseId &&
      saved.unitId === testDefinition.unitId &&
      saved.topicId === testDefinition.topicId &&
      saved.outcomeId === testDefinition.outcomeId,
  );

  const activeTeacherSelectionAssignment =
    activeSavedTestForTeacherSelection
      ? assignmentForTest(activeSavedTestForTeacherSelection.id)
      : undefined;

  const teacherSelectedQuestionKeysForActiveTest = Array.isArray(
    activeTeacherSelectionAssignment?.selectedQuestionKeys,
  )
    ? activeTeacherSelectionAssignment!.selectedQuestionKeys.map(String)
    : [];

  const activeTeacherSelectionSnapshots: QuestionBankItem[] = Array.isArray(
    activeTeacherSelectionAssignment?.selectedQuestionSnapshots,
  )
    ? activeTeacherSelectionAssignment!.selectedQuestionSnapshots as QuestionBankItem[]
    : [];
  const activeTeacherSelectionCount =
    effectiveQuestionCountForTest(activeTeacherSelectionSnapshots) +
    Math.max(0, teacherSelectedQuestionKeysForActiveTest.length - activeTeacherSelectionSnapshots.length);
  const activeTeacherSelectionCompleted =
    activeTeacherSelectionAssignment?.selectionStatus === "completed" ||
    Boolean(activeTeacherSelectionAssignment?.completedAt);

  const activeFlexibleQuestionCount = Boolean(
    activeTeacherSelectionAssignment?.questionCountMode === "flexible" ||
      activeSavedTestForTeacherSelection?.questionCountMode === "flexible",
  );

  const activeRequiredQuestionCount = Math.max(
    1,
    Number(
      activeTeacherSelectionAssignment?.requiredQuestionCount ||
        activeSavedTestForTeacherSelection?.requiredQuestionCount ||
        1,
    ),
  );

  const activeAdminSelectedQuestionKeys: string[] = Array.isArray(
    pdfBuilderState?.selectedQuestionKeys,
  )
    ? Array.from(
        new Set<string>(
          pdfBuilderState.selectedQuestionKeys.map(String).filter(Boolean),
        ),
      )
    : [];

  const activeAdminSnapshotMap = new Map<string, QuestionBankItem>();
  [
    ...(Array.isArray(activeTeacherSelectionAssignment?.availableQuestionSnapshots)
      ? activeTeacherSelectionAssignment.availableQuestionSnapshots
      : []),
    ...(Array.isArray(activeTeacherSelectionAssignment?.selectedQuestionSnapshots)
      ? activeTeacherSelectionAssignment.selectedQuestionSnapshots
      : []),
    ...(Array.isArray(pdfBuilderState?.selectedQuestionSnapshots)
      ? pdfBuilderState.selectedQuestionSnapshots
      : []),
  ].forEach((item: any) => {
    const key = String(item?.key || item?.questionId || item?.code || "");
    if (key) activeAdminSnapshotMap.set(key, item);
  });

  const activeAdminSelectedSnapshots = activeAdminSelectedQuestionKeys
    .map((key) => activeAdminSnapshotMap.get(String(key)))
    .filter(Boolean) as QuestionBankItem[];
  const activeAdminMissingSnapshotCount = Math.max(
    0,
    activeAdminSelectedQuestionKeys.length - activeAdminSelectedSnapshots.length,
  );
  const activeAdminEffectiveCount =
    effectiveQuestionCountForTest(activeAdminSelectedSnapshots) + activeAdminMissingSnapshotCount;

  const canAdminFinalizeActiveTest = Boolean(
    activeSavedTestForTeacherSelection &&
      activeTeacherSelectionAssignment &&
      !activeTeacherSelectionCompleted &&
      (activeFlexibleQuestionCount
        ? activeAdminEffectiveCount > 0
        : activeAdminEffectiveCount === activeRequiredQuestionCount),
  );

  const completeActiveTestAsAdmin = async () => {
    const saved = activeSavedTestForTeacherSelection;
    const assignment = activeTeacherSelectionAssignment;
    if (!saved || !assignment || activeTeacherSelectionCompleted) return;

    const selectedKeys = activeAdminSelectedQuestionKeys;
    const selectedSnapshots = activeAdminSelectedSnapshots;
    const selectedEffectiveCount = activeAdminEffectiveCount;
    if (
      activeFlexibleQuestionCount
        ? selectedEffectiveCount < 1
        : selectedEffectiveCount !== activeRequiredQuestionCount
    ) {
      showNotice(
        activeFlexibleQuestionCount
          ? "Testi tamamlamak için en az bir soru seçilmelidir."
          : `Testi tamamlamak için tam ${activeRequiredQuestionCount} soru seçilmelidir. Şu anda ${selectedEffectiveCount} soru seçili.`,
      );
      return;
    }

    const now = new Date().toISOString();
    setAdminFinalizeBusy(true);
    try {
      await syncDraftTestQuestionArchive(
        String(saved.id || ""),
        String(saved.name || "Test"),
        selectedKeys,
        selectedSnapshots,
      );
      const finalizedAssignment: TeacherTestAssignment = {
        ...assignment,
        selectedQuestionKeys: selectedKeys,
        selectedQuestionSnapshots: selectedSnapshots,
        selectedQuestionCount: selectedEffectiveCount,
        remainingQuestionCount: 0,
        selectionStatus: "completed",
        selectionRevision: Number(assignment.selectionRevision || 0) + 1,
        completedAt: now,
        updatedAt: now,
      };

      const response = await fetchTeacherAssignmentApi(
        `/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignment.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...finalizedAssignment,
            completedBy: "admin",
          }),
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Yönetici soru seçimi kaydedilemedi."));
      }

      setTeacherAssignments((current) =>
        current.map((item) =>
          String(item.id || "") === String(assignment.id || "")
            ? finalizedAssignment
            : item,
        ),
      );

      const nextSavedTests = savedTests.map((item) =>
        String(item.id || "") === String(saved.id || "")
          ? {
              ...item,
              selectedQuestionKeys: selectedKeys,
              selectedQuestionSnapshots: selectedSnapshots,
              buildStatus: "ready" as const,
              readyAt: now,
              updatedAt: now,
            }
          : item,
      );
      setSavedTests(nextSavedTests);
      sqliteStorage.setItem("edupanel_saved_tests_v1", JSON.stringify(nextSavedTests));
      teacherFinalizedAssignmentRef.current.add(String(assignment.id || ""));

      applyBuilderForTest(testDefinition, selectedKeys, selectedSnapshots);
      showNotice(
        `"${saved.name}" yönetici tarafından ${selectedKeys.length} soruyla tamamlandı. Öğretmenin açık soru seçimi görevi kapatıldı.`,
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Yönetici soru seçimi tamamlanamadı.",
      );
    } finally {
      setAdminFinalizeBusy(false);
    }
  };

  /*
   * SORU TEKRAR KULLANIM KURALI
   * Bir soru başka bir testte kullanılmışsa yeni test oluştururken gösterilmez.
   * Kaynaklar:
   *   1) Yöneticinin kayıtlı testleri
   *   2) Öğretmenin linkten yaptığı resmi seçimler
   *
   * Aktif testin kendi soruları bu listeden hariç tutulur; böylece aynı test
   * yeniden açıldığında düzenlenebilir.
   */
  const usedQuestionKeysOutsideActiveTest = useMemo(() => {
    const used = new Set<string>();
    const activeTestId = String(
      activeSavedTestForTeacherSelection?.id || "",
    );

    savedTests.forEach((saved) => {
      if (String(saved.id || "") === activeTestId) return;
      if (saved.status === "cancelled") return;
      if (!savedTestQuestionsLocked(saved)) return;

      (saved.selectedQuestionKeys || []).forEach((key) =>
        used.add(String(key)),
      );
    });

    teacherAssignments.forEach((assignment) => {
      if (String(assignment.testId || "") === activeTestId) return;

      const ownerTest = savedTests.find(
        (saved) =>
          String(saved.id || "") === String(assignment.testId || ""),
      );
      if (!ownerTest || ownerTest.status === "cancelled") return;

      (assignment.selectedQuestionKeys || []).forEach((key) =>
        used.add(String(key)),
      );
    });

    return used;
  }, [
    savedTests,
    teacherAssignments,
    activeSavedTestForTeacherSelection?.id,
  ]);



  useEffect(() => {
    const refreshCatalog = () =>
      setCatalogVersion((value) => value + 1);

    window.addEventListener("storage", refreshCatalog);
    window.addEventListener("edupanel:curriculum-updated", refreshCatalog);
    window.addEventListener("focus", refreshCatalog);

    return () => {
      window.removeEventListener("storage", refreshCatalog);
      window.removeEventListener("edupanel:curriculum-updated", refreshCatalog);
      window.removeEventListener("focus", refreshCatalog);
    };
  }, []);

  useEffect(() => {
    const handleHeaderDesignUpdate = () =>
      setHeaderDesignVersion((value) => value + 1);

    window.addEventListener(
      "edupanel:test-header-design-updated",
      handleHeaderDesignUpdate,
    );

    return () =>
      window.removeEventListener(
        "edupanel:test-header-design-updated",
        handleHeaderDesignUpdate,
      );
  }, []);

  const persistUnlockedQuestionRemoval = async (
    nextKeys: string[],
    nextSnapshots: QuestionBankItem[],
    removedQuestions: QuestionBankItem[],
  ) => {
    const saved = activeSavedTestForTeacherSelection;
    if (!saved || savedTestQuestionsLocked(saved)) return;

    const normalizedKeys = [...new Set(nextKeys.map(String).filter(Boolean))];
    const keySet = new Set(normalizedKeys);
    const snapshotMap = new Map<string, QuestionBankItem>();
    nextSnapshots.forEach((question) => {
      const key = String(question?.key || question?.questionId || question?.code || "");
      if (key && keySet.has(key)) snapshotMap.set(key, question);
    });
    const normalizedSnapshots = normalizedKeys
      .map((key) => snapshotMap.get(String(key)))
      .filter(Boolean) as QuestionBankItem[];

    const removedQuestionIds = [...new Set(
      removedQuestions
        .map((question) => String(question?.questionId || question?.key || "").trim())
        .filter(Boolean),
    )];
    const now = new Date().toISOString();

    try {
      // Kilit açıkken testten çıkarılan soru bu teste ait kullanım kaydını da
      // kaybeder; böylece başka test ve sınavlarda yeniden seçilebilir.
      await Promise.all(
        removedQuestionIds.map(async (questionId) => {
          const response = await fetch("/api/question-bank/usage", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              questionId,
              examId: String(saved.id),
            }),
          });
          if (!response.ok && response.status !== 404) {
            const body = await response.json().catch(() => ({}));
            throw new Error(String(body?.error || "Soru kullanım kaydı kaldırılamadı."));
          }
        }),
      );

      // Taslak arşivde de yalnız testte kalan sorular bulunsun.
      if (normalizedKeys.length > 0) {
        await syncDraftTestQuestionArchive(
          String(saved.id),
          String(saved.name || "Test"),
          normalizedKeys,
          normalizedSnapshots,
        );
      } else {
        const archiveResponse = await fetch(
          `/api/question-bank/archive/${encodeURIComponent(String(saved.id))}`,
          { method: "DELETE", cache: "no-store" },
        );
        if (!archiveResponse.ok && archiveResponse.status !== 404) {
          const body = await archiveResponse.json().catch(() => ({}));
          throw new Error(String(body?.error || "Test soru arşivi temizlenemedi."));
        }
      }

      const nextSavedTests = savedTests.map((item) =>
        String(item.id) === String(saved.id)
          ? {
              ...item,
              selectedQuestionKeys: normalizedKeys,
              selectedQuestionSnapshots: normalizedSnapshots,
              updatedAt: now,
            }
          : item,
      );

      const assignment = assignmentForTest(saved.id);
      let nextAssignment: TeacherTestAssignment | null = null;
      if (assignment) {
        const missingSnapshotCount = Math.max(
          0,
          normalizedKeys.length - normalizedSnapshots.length,
        );
        nextAssignment = {
          ...assignment,
          selectedQuestionKeys: normalizedKeys,
          selectedQuestionSnapshots: normalizedSnapshots,
          selectedQuestionCount:
            effectiveQuestionCountForTest(normalizedSnapshots) + missingSnapshotCount,
          updatedAt: now,
        };
        const response = await fetchTeacherAssignmentApi(
          `/api/database/collections/teacherTestAssignments/${encodeURIComponent(String(assignment.id))}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextAssignment),
            cache: "no-store",
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(body?.error || "Test soru listesi güncellenemedi."));
        }
      }

      setSavedTests(nextSavedTests);
      sqliteStorage.setItem(
        "edupanel_saved_tests_v1",
        JSON.stringify(nextSavedTests),
      );
      if (nextAssignment) {
        setTeacherAssignments((current) =>
          current.map((item) =>
            String(item.id) === String(nextAssignment!.id) ? nextAssignment! : item,
          ),
        );
      }

      setCatalogVersion((value) => value + 1);
      window.dispatchEvent(new CustomEvent("edupanel:curriculum-updated"));
      showNotice(
        removedQuestionIds.length > 1
          ? `${removedQuestionIds.length} soru testten çıkarıldı ve yeniden kullanıma açıldı.`
          : "Soru testten çıkarıldı ve yeniden kullanıma açıldı.",
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Soru testten çıkarılırken kullanım kaydı güncellenemedi.",
      );
    }
  };


  return (
    <div className="mx-auto max-w-7xl px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {saveNotice && (
        <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-xl">
          <Check className="h-4 w-4" />
          {saveNotice}
        </div>
      )}

      <div className="rounded-3xl border-2 border-dashed border-green-600 bg-white p-4">
        <div className="bg-theme-pattern flex min-h-[52px] w-full flex-col items-center justify-between gap-4 rounded-2xl bg-green-600 p-1.5 shadow-inner md:flex-row">
          <div className="scrollbar-hide flex w-full items-center justify-start gap-1 overflow-x-auto md:w-auto">
            <select
              value={testListGrade}
              onChange={(event) => {
                setTestListGrade(event.target.value);
                setTestListCourseId("");
                setScopeTestPicker(null);
                setExpandedTestUnits(new Set());
                setExpandedTestTopics(new Set());
                setActiveTopTab("define");
              }}
              className="h-[40px] w-[132px] flex-none rounded-xl border-2 border-yellow-300 bg-yellow-300 px-3 text-[11px] font-black text-slate-900 outline-none"
              aria-label="Sınıf Seviyesi"
            >
              <option value="">Sınıf Seviyesi</option>
              {testListGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}. Sınıf
                </option>
              ))}
            </select>

            <select
              value={testListCourseId}
              disabled={!testListGrade}
              onChange={(event) => {
                setTestListCourseId(event.target.value);
                setScopeTestPicker(null);
                setExpandedTestUnits(new Set());
                setExpandedTestTopics(new Set());
                setActiveTopTab("define");
              }}
              className="h-[40px] w-[190px] flex-none rounded-xl border-2 border-yellow-300 bg-yellow-300 px-3 text-[11px] font-black text-slate-900 outline-none disabled:cursor-not-allowed disabled:border-yellow-200 disabled:bg-yellow-100 disabled:text-slate-500"
              aria-label="Ders"
            >
              <option value="">
                {testListGrade ? "Ders" : "Önce Sınıf"}
              </option>
              {testListCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setScopeTestPicker(null);
                setTestListGrade("");
                setTestListCourseId("");
                setExpandedTestUnits(new Set());
                setExpandedTestTopics(new Set());
                setActiveTestUnitKey("");
                setActiveTestOutcomeKey("");
                setActiveTopTab("define");
              }}
              className={`flex h-[40px] flex-initial items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-5 text-[13px] font-black shadow-sm transition ${
                activeTopTab === "define"
                  ? "border-white bg-white text-green-700"
                  : "border-white/60 bg-green-600 text-white"
              }`}
            >
              <ListChecks className="h-4 w-4 shrink-0" />
              Hazırlanmış Testler
            </button>

            <button
              type="button"
              onClick={() => setActiveTopTab("create")}
              className={`flex h-[40px] flex-initial items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-5 text-[13.67px] font-bold shadow-sm transition ${
                activeTopTab === "create"
                  ? "border-white bg-white text-green-700"
                  : "border-white/60 bg-green-600 text-white"
              }`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              Soru İşlemleri
            </button>

            <button
              type="button"
              onClick={() => setActiveTopTab("pdf")}
              className={`flex h-[40px] flex-initial items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-5 text-[13px] font-black shadow-sm transition ${
                activeTopTab === "pdf"
                  ? "border-white bg-white text-green-700"
                  : "border-white/60 bg-green-600 text-white"
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              PDF Oluştur
            </button>

          </div>

          <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
            <button
              type="button"
              onClick={openNewTest}
              className="flex h-[40px] items-center justify-center whitespace-nowrap rounded-xl border-2 border-red-600 bg-red-600 px-5 text-[12px] font-black text-white shadow-sm transition hover:border-red-700 hover:bg-red-700"
            >
              + Yeni Test
            </button>

          </div>
        </div>
      </div>

      {activeTopTab === "define" ? (
        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {visibleSavedTests.length > 0 ? (
            <div className="border-b border-slate-200 p-5">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Hazırlanmış Testler
              </div>
              <div className="space-y-2">
                {visibleSavedTests.map((saved) => (
                  <div
                    key={`latest-${saved.id}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800"
                  >
                    {saved.name}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!testListGrade || !testListCourseId ? null : (
            <div className="p-5">
              <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-700">
                {testListGrade}. Sınıf - {testListCourse?.name || ""} testleri
              </div>
              {testListUnits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-400">
                  Bu ders için müfredat bulunamadı.
                </div>
              ) : (
                <div className="space-y-4">
                  {testListUnits.map((unit, unitIndex) => {
                    const unitKey = String(unit.id || `unit-${unitIndex}`);
                    const isUnitOpen = activeTestUnitKey === unitKey;

                    return (
                      <div key={unitKey} className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTestUnitKey((current) => current === unitKey ? "" : unitKey);
                            setActiveTestOutcomeKey("");
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white transition ${
                            isUnitOpen ? "bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          <span>{unitIndex + 1}. ÜNİTE · {unit.name}</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-white transition-transform ${isUnitOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isUnitOpen ? (
                          <div className="divide-y divide-slate-100">
                            <div className="flex flex-wrap items-center gap-2 bg-blue-50 px-5 py-3">
                              <button type="button" onClick={() => {
                                openNewTest();
                                setDraftTestDefinition((current) => ({ ...current, type: "unit", unitId: String(unit.id), topicId: "", outcomeId: "" }));
                              }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Yeni Ünite Testi</button>
                              <button type="button" disabled={testsForScope("unit", String(unit.id)).length === 0}
                                onClick={() => openScopeTests(`${unit.name} · Ünite Testleri`, testsForScope("unit", String(unit.id)))}
                                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-40">
                                Ünite Testleri ({testsForScope("unit", String(unit.id)).length})
                              </button>
                            </div>
                            {(unit.topics || []).map((topic, topicIndex) => (
                              <div key={String(topic.id || topicIndex)} className="bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/70 px-5 py-2.5 text-[12px] font-black text-blue-700">
                                  <span>{unitIndex + 1}.{topicIndex + 1}. KONU · {topic.name}</span>
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => {
                                      openNewTest();
                                      setDraftTestDefinition((current) => ({ ...current, type: "topic", unitId: String(unit.id), topicId: String(topic.id), outcomeId: "" }));
                                    }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Yeni Konu Testi</button>
                                    <button type="button" disabled={testsForScope("topic", String(unit.id), String(topic.id)).length === 0}
                                      onClick={() => openScopeTests(`${topic.name} · Konu Testleri`, testsForScope("topic", String(unit.id), String(topic.id)))}
                                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-40">
                                      Konu Testleri ({testsForScope("topic", String(unit.id), String(topic.id)).length})
                                    </button>
                                  </div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                  {(topic.outcomes || topic.objectives || []).map((outcome, outcomeIndex) => {
                                    const outcomeId = outcomeIdOf(outcome, outcomeIndex);
                                    const outcomeKey = `${String(unit.id)}::${String(topic.id)}::${String(outcomeId)}`;
                                    const outcomeTests = testsForOutcomeTree(String(unit.id), String(topic.id), String(outcomeId));
                                    const isOpen = activeTestOutcomeKey === outcomeKey;

                                    return (
                                      <div key={outcomeKey} className={isOpen ? "bg-emerald-50/30" : "bg-white"}>
                                        <div className={`flex w-full items-center gap-2 transition ${
                                          isOpen ? "bg-emerald-50" : "hover:bg-slate-50"
                                        }`}>
                                          <button
                                            type="button"
                                            onClick={() => setActiveTestOutcomeKey(isOpen ? "" : outcomeKey)}
                                            className="flex min-w-0 flex-1 items-center gap-3 px-6 py-3 text-left"
                                          >
                                            <span className={`flex h-6 min-w-6 items-center justify-center rounded-lg text-[10px] font-black ${
                                              isOpen ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                                            }`}>
                                              {outcomeIndex + 1}
                                            </span>
                                            <span className="min-w-0 flex-1 text-[11px] font-bold leading-5 text-slate-800">
                                              {outcomeNameOf(outcome)} <span className={outcomeTests.length > 0 ? "font-black text-red-700" : "font-bold text-slate-500"}>({outcomeTests.length} test)</span>
                                            </span>
                                            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                          </button>
                                        </div>

                                        {isOpen ? (
                                          <div className="border-t border-emerald-100 bg-white px-6 py-3">
                                            {outcomeTests.length === 0 ? (
                                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-[11px] font-semibold text-slate-400">
                                                Bu kazanıma ait hazırlanmış test bulunamadı.
                                              </div>
                                            ) : (
                                              <div className="space-y-2">
                                                {outcomeTests.map((test) => (
                                                  <div
                                                    key={test.id}
                                                    className="group flex min-h-[54px] items-center gap-2 overflow-hidden rounded-xl border-2 border-slate-200 bg-[#eef5f8] px-2 py-1.5 transition hover:border-red-500 hover:bg-[#e4f0f6]"
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => useSavedTest(test)}
                                                      className="min-w-0 flex-1 px-2 py-2 text-left"
                                                      title={`${test.name} — Teste geç ve Soru İşlemleri'ni aç`}
                                                    >
                                                      <div className="truncate whitespace-nowrap text-sm font-black text-slate-800">{test.name}</div>
                                                    </button>

                                                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                                      <button
                                                        type="button"
                                                        disabled={savedTestQuestionsLocked(test)}
                                                        onClick={() => editSavedTest(test)}
                                                        className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                                        title={savedTestQuestionsLocked(test) ? "Kilitli testin bilgileri düzenlenemez." : "Test bilgilerini düzenle"}
                                                      >
                                                        Bilgileri Düzenle
                                                      </button>
                                                      <button
                                                        type="button"
                                                        disabled={testLockBusyId === String(test.id)}
                                                        onClick={() => void toggleSavedTestQuestionLock(test)}
                                                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-black transition disabled:cursor-wait disabled:opacity-60 ${
                                                          savedTestQuestionsLocked(test)
                                                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                        }`}
                                                        title={savedTestQuestionsLocked(test) ? "Kilidi aç; soru listesi yeniden düzenlenebilir olsun" : "Testi kilitle; soruları başka testlerde kullanıma kapat"}
                                                      >
                                                        {savedTestQuestionsLocked(test) ? (
                                                          <Lock className="h-3.5 w-3.5" />
                                                        ) : (
                                                          <Unlock className="h-3.5 w-3.5" />
                                                        )}
                                                        {savedTestQuestionsLocked(test) ? "Kilitli" : "Kilit Açık"}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      ) : activeTopTab === "create" ? (
        <>
          <NewTestForm
          catalog={catalog}
          testDefinition={testDefinition}
          teacherSelectedQuestionKeys={teacherSelectedQuestionKeysForActiveTest}
          usedQuestionKeys={usedQuestionKeysOutsideActiveTest}
          pdfEnoughQuestions={pdfEnoughQuestions}
          selectionLocked={savedTestQuestionsLocked(activeSavedTestForTeacherSelection)}
          refreshToken={catalogVersion}
          onQuestionsRemoved={persistUnlockedQuestionRemoval}
          onNotice={showNotice}
          onRefreshCatalog={() =>
            setCatalogVersion((value) => value + 1)
          }
        />
        </>
      ) : (
        <>
          <div className="pdf-print-workspace mt-5 flex min-h-[760px] items-start gap-3">
          <aside className="sticky top-3 w-[178px] shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {[
              {
                title: "Ana Başlık",
                topKey: "mainTitleTop" as const,
                rightKey: "mainTitleRight" as const,
                top: pdfLayoutSettings.mainTitleTop,
                right: pdfLayoutSettings.mainTitleRight,
                cardClass: "border-sky-200 bg-sky-50",
                titleClass: "text-sky-900",
              },
              {
                title: "Üst Başlık",
                topKey: "upperTitleTop" as const,
                rightKey: "upperTitleRight" as const,
                top: pdfLayoutSettings.upperTitleTop,
                right: pdfLayoutSettings.upperTitleRight,
                cardClass: "border-violet-200 bg-violet-50",
                titleClass: "text-violet-900",
              },
              {
                title: "Test No",
                topKey: "testNoTop" as const,
                rightKey: "testNoRight" as const,
                top: pdfLayoutSettings.testNoTop,
                right: pdfLayoutSettings.testNoRight,
                cardClass: "border-amber-200 bg-amber-50",
                titleClass: "text-amber-900",
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`mb-2.5 rounded-xl border p-2.5 last:mb-0 ${item.cardClass}`}
              >
                <div className={`mb-2 text-[10px] font-black ${item.titleClass}`}>
                  {item.title}
                </div>

                <label className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-slate-600">
                    Yukarıdan
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={item.top}
                    onChange={(event) =>
                      updatePdfLayoutSetting(
                        item.topKey,
                        Number(event.target.value),
                      )
                    }
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-bold text-slate-800 outline-none focus:border-violet-300"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-slate-600">
                    Sağdan
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={item.right}
                    onChange={(event) =>
                      updatePdfLayoutSetting(
                        item.rightKey,
                        Number(event.target.value),
                      )
                    }
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-bold text-slate-800 outline-none focus:border-violet-300"
                  />
                </label>
              </div>
            ))}

            <button
              type="button"
              onClick={reflowPdfQuestions}
              className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-[9px] font-black text-emerald-700 hover:bg-emerald-100"
              title="Seçili soruları iki A4 sayfaya mümkün olan en fazla soru sığacak şekilde ekonomik olarak yeniden yerleştirir. Bu butona basılmadan önce sorular seçim sırasıyla ilk sütundan başlayarak peş peşe dizilir."
            >
              Soruları Yerleştir
            </button>

            {pdfOverflowQuestions.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2">
                <div className="text-[9px] font-black text-amber-900">
                  Artan Sorular ({pdfOverflowQuestions.length})
                </div>
                <div className="mt-1 text-[7px] font-semibold leading-3 text-amber-700">
                  İki sayfaya sığmayan soruyu testten çıkarmak için tıklayın.
                </div>

                <div className="mt-2 max-h-[145px] space-y-1 overflow-y-auto pr-0.5">
                  {pdfOverflowQuestions.map((question) => (
                    <button
                      key={`overflow-${question.key}`}
                      type="button"
                      onClick={() =>
                        removePdfQuestion(question.key)
                      }
                      className="block w-full truncate rounded-md border border-amber-200 bg-white px-2 py-1.5 text-left text-[8px] font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                      title="Tıklayarak testten çıkar"
                    >
                      {question.code || question.key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const defaults = {
                  mainTitleTop: 13.1,
                  mainTitleRight: 92.6,
                  upperTitleTop: 8.9,
                  upperTitleRight: 93,
                  testNoTop: 10.5,
                  testNoRight: 82.2,
                };
                setPdfLayoutSettings(defaults);
                sqliteStorage.setItem(
                  "edupanel_pdf_layout_settings_v6",
                  JSON.stringify(defaults),
                );
              }}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-black text-slate-600 hover:bg-slate-50"
            >
              Varsayılan Konumlar
            </button>

            <label className="mt-2 flex cursor-pointer select-none items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2">
              <input
                type="checkbox"
                checked={testDefinition.showAnswersInPdf !== false}
                onChange={(event) =>
                  setActiveTestShowAnswersInPdf(event.target.checked)
                }
                className="h-4 w-4 shrink-0 cursor-pointer accent-rose-600"
              />
              <span className="text-[9px] font-black text-rose-700">
                Cevaplar Yazdırılsın
              </span>
            </label>
          </aside>

          <div
            ref={pdfPreviewRef}
            className="pdf-print-preview relative min-w-0 flex-1 overflow-auto rounded-2xl bg-slate-200/70 p-3 pr-16"
          >
            <div className="pdf-print-controls absolute right-3 top-3 z-40 flex w-fit items-center gap-1 rounded-lg border border-slate-300 bg-white/95 p-1 shadow-md backdrop-blur">
              <button
                type="button"
                onClick={savePdfDocument}
                title="PDF Kaydet"
                aria-label="PDF Kaydet"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-red-600"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={printPdfDocument}
                title="Yazdır"
                aria-label="Yazdır"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>

            <div
              className="pdf-print-pages flex origin-top flex-col items-center gap-8"
              style={{
                transform: `scale(${pdfZoom})`,
                transformOrigin: "top center",
                width: `${100 / pdfZoom}%`,
              }}
            >
              {[1, 2].map((page) => (
                <div
                  key={`a4-page-${page}`}
                  className="pdf-a4-page relative shrink-0 bg-white shadow-xl"
                  style={{
                    width: "210mm",
                    height: "297mm",
                  }}
                >
                  {page === 1 && renderPdfHeader()}
                  {page === 1 && renderPdfTestTopic()}
                  {renderPdfColumns(page as 1 | 2)}
                  {page === 2 && renderAnswerStrip()}
                  <div
                    className="absolute text-[8pt] font-medium text-slate-500"
                    style={{ right: "4mm", bottom: "4mm" }}
                  >
                    {page}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

      {scopeTestPicker && (
        <div className="fixed inset-0 z-[108] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-600">
                  Hazırlanan Testler
                </div>
                <h3 className="mt-1 text-lg font-black text-slate-950">
                  {scopeTestPicker.title}
                </h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  Aç, düzenle veya kilitle işlemini doğrudan bu test üzerinden yapabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScopeTestPicker(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {scopeTestPicker.tests.map((saved) => (
                <div
                  key={saved.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-950">
                        {saved.name}
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-slate-500">
                        {definitionTypeLabel(saved.type)} •{" "}
                        {saved.columnCount === 3 ? 3 : 2} sütun •{" "}
                        {Number(saved.questionSpacing || 10)} mm
                      </div>
                      {saved.status === "cancelled" ? (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-[9px] font-black text-slate-600">
                          İPTAL EDİLDİ · SORULAR SERBEST
                        </div>
                      ) : assignmentForTest(saved.id) && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-800">
                          <UserCheck className="h-3 w-3" />
                          {assignmentForTest(saved.id)!.teacherName} ·{" "}
                          {assignmentForTest(saved.id)!.questionCountMode === "flexible"
                            ? `${assignmentForTest(saved.id)!.selectedQuestionKeys?.length || 0} soru`
                            : `${assignmentForTest(saved.id)!.selectedQuestionKeys?.length || 0}/${Math.max(
                                1,
                                Number(assignmentForTest(saved.id)!.requiredQuestionCount || 1),
                              )}`} ·{" "}
                          {assignmentForTest(saved.id)!.completedAt ||
                          assignmentForTest(saved.id)!.selectionStatus === "completed"
                            ? "Tamamlandı"
                            : "Seçim sürüyor"}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {assignmentForTest(saved.id) &&
                        !assignmentForTest(saved.id)!.completedAt &&
                        assignmentForTest(saved.id)!.selectionStatus !== "completed" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setScopeTestPicker(null);
                                void completeTeacherQuestionAssignmentAsAdmin(saved);
                              }}
                              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"
                            >
                              Görevi Sonlandır
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setScopeTestPicker(null);
                                void cancelTeacherQuestionAssignment(saved);
                              }}
                              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                            >
                              Görevi İptal Et
                            </button>
                          </>
                        )}

                      <button
                        type="button"
                        disabled={saved.status === "cancelled"}
                        onClick={() => {
                          if (saved.status === "cancelled") return;
                          setScopeTestPicker(null);
                          useSavedTest(saved);
                        }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        Aç
                      </button>

                      <button
                        type="button"
                        disabled={savedTestQuestionsLocked(saved)}
                        onClick={() => {
                          setScopeTestPicker(null);
                          editSavedTest(saved);
                        }}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        title={savedTestQuestionsLocked(saved) ? "Kilitli testin bilgileri düzenlenemez." : "Test bilgilerini düzenle"}
                      >
                        Düzenle
                      </button>

                      {saved.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={savedTestQuestionsLocked(saved)}
                          onClick={() => {
                            cancelSavedTest(saved);
                            setScopeTestPicker(null);
                          }}
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          İptal Et
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={testLockBusyId === String(saved.id)}
                        onClick={() => void toggleSavedTestQuestionLock(saved)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black transition disabled:cursor-wait disabled:opacity-60 ${
                          savedTestQuestionsLocked(saved)
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={savedTestQuestionsLocked(saved) ? "Kilidi aç" : "Testi kilitle"}
                      >
                        {savedTestQuestionsLocked(saved) ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                        {savedTestQuestionsLocked(saved) ? "Kilitli" : "Kilit Açık"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}



      {isNewTestEditorOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                {editingTestId ? "Test Düzenle" : "Yeni Test"}
              </div>

              <button
                type="button"
                onClick={() => setIsNewTestEditorOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col">
                <span className="min-h-[28px] text-[10px] font-black uppercase leading-4 tracking-wide text-slate-600">
                  Sınıf Seviyesi
                </span>
                <select
                  value={draftTestDefinition.grade}
                  onChange={(event) =>
                    setDraftTestDefinition((current) => ({
                      ...current,
                      grade: event.target.value,
                      courseId: "",
                      unitId: "",
                      topicId: "",
                      outcomeId: "",
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="">Sınıf seçiniz</option>
                  {definitionGrades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}. Sınıf
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="min-h-[28px] text-[10px] font-black uppercase leading-4 tracking-wide text-slate-600">
                  Ders
                </span>
                <select
                  value={draftTestDefinition.courseId}
                  disabled={!draftTestDefinition.grade}
                  onChange={(event) =>
                    setDraftTestDefinition((current) => ({
                      ...current,
                      courseId: event.target.value,
                      unitId: "",
                      topicId: "",
                      outcomeId: "",
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {draftTestDefinition.grade
                      ? "Ders seçiniz"
                      : "Önce sınıf seçiniz"}
                  </option>
                  {definitionCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                <span className="min-h-[28px] text-[10px] font-black uppercase leading-4 tracking-wide text-slate-600">
                  Soru Seçimi İçin Görevlendirilecek Öğretmen
                </span>
                <select
                  value={draftTeacherId}
                  onChange={(event) => setDraftTeacherId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">
                    {teacherLinks.length > 0
                      ? "Öğretmen seçiniz"
                      : "Öğretmen bulunamadı"}
                  </option>
                  {teacherLinks.map((teacher) => (
                    <option key={teacher.teacherId} value={teacher.teacherId}>
                      {teacher.teacherName}
                    </option>
                  ))}
                </select>
              </label>
            </div>


            <div className="mt-6">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                Test Türü
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  ["unit", "Ünite Testi"],
                  ["topic", "Konu Testi"],
                  ["outcome", "Kazanım Testi"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDraftTestDefinition((current) => ({
                        ...current,
                        type: value,
                        topicId:
                          value === "unit" ? "" : current.topicId,
                        outcomeId:
                          value === "outcome" ? current.outcomeId : "",
                      }))
                    }
                    className={`rounded-xl border px-3 py-3 text-xs font-black transition ${
                      draftTestDefinition.type === value
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {draftTestDefinition.type === value ? "✓ " : ""}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                Ünite
              </span>
              <select
                value={draftTestDefinition.unitId}
                disabled={!draftTestDefinition.courseId}
                onChange={(event) =>
                  setDraftTestDefinition((current) => ({
                    ...current,
                    unitId: event.target.value,
                    topicId: "",
                    outcomeId: "",
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {draftTestDefinition.courseId
                    ? "Ünite adını seçiniz"
                    : "Önce ders seçiniz"}
                </option>
                {definitionUnits.map((unit) => (
                  <option key={String(unit.id)} value={String(unit.id)}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>

            {draftTestDefinition.type !== "unit" && (
              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                  Konu
                </span>
                <select
                  value={draftTestDefinition.topicId}
                  disabled={!draftTestDefinition.unitId}
                  onChange={(event) =>
                    setDraftTestDefinition((current) => ({
                      ...current,
                      topicId: event.target.value,
                      outcomeId: "",
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {draftTestDefinition.unitId
                      ? "Konu adını seçiniz"
                      : "Önce ünite seçiniz"}
                  </option>
                  {definitionTopics.map((topic) => (
                    <option key={String(topic.id)} value={String(topic.id)}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {draftTestDefinition.type === "outcome" && (
              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                  Kazanım
                </span>
                <select
                  value={draftTestDefinition.outcomeId}
                  disabled={!draftTestDefinition.topicId}
                  onChange={(event) =>
                    setDraftTestDefinition((current) => ({
                      ...current,
                      outcomeId: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {draftTestDefinition.topicId
                      ? "Kazanımı seçiniz"
                      : "Önce konu seçiniz"}
                  </option>
                  {definitionOutcomes.map((outcome, index) => (
                    <option
                      key={outcomeIdOf(outcome, index)}
                      value={outcomeIdOf(outcome, index)}
                    >
                      {outcomeNameOf(outcome)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                  Test Sütun Düzeni
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[2, 3].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() =>
                        setDraftTestDefinition((current) => ({
                          ...current,
                          columnCount: count as 2 | 3,
                        }))
                      }
                      className={`h-10 rounded-xl border text-xs font-black transition ${
                        (draftTestDefinition.columnCount || 2) === count
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {count} Sütun
                    </button>
                  ))}
                </div>
              </div>

              <label>
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                  Sorular Arası Mesafe
                </span>
                <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={Number(draftTestDefinition.questionSpacing || 10)}
                    onChange={(event) =>
                      setDraftTestDefinition((current) => ({
                        ...current,
                        questionSpacing: Math.max(
                          0,
                          Math.min(50, Number(event.target.value) || 0),
                        ),
                      }))
                    }
                    className="min-w-0 flex-1 px-3 py-2.5 text-sm font-black text-slate-800 outline-none"
                  />
                  <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-500">
                    mm
                  </span>
                </div>
              </label>

            </div>

            <div className="mt-6">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                Otomatik Test Adı
              </div>
              <div className="mt-2 rounded-2xl border-2 border-amber-400 bg-amber-300 px-5 py-4 text-center text-base font-black text-black shadow-sm">
                {automaticTestName ||
                  "Kapsam seçildiğinde test adı ve sıra numarası otomatik oluşacak"}
              </div>
            </div>

            <button
              type="button"
              disabled={
                !draftTestDefinition.grade ||
                !draftTestDefinition.courseId ||
                !draftTestDefinition.unitId ||
                (draftTestDefinition.type !== "unit" &&
                  !draftTestDefinition.topicId) ||
                (draftTestDefinition.type === "outcome" &&
                  !draftTestDefinition.outcomeId) ||
                !automaticTestName ||
                !draftTeacherId ||
                assignmentBusy
              }
              onClick={() => void saveNewTest()}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {assignmentBusy
                ? assignmentBusyText || "Görev hazırlanıyor…"
                : editingTestId
                  ? "Değişiklikleri Kaydet ve Görevlendir"
                  : "Testi Tanımla ve Öğretmeni Görevlendir"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function NewTestForm({
  catalog,
  testDefinition,
  teacherSelectedQuestionKeys = [],
  usedQuestionKeys,
  pdfEnoughQuestions = false,
  selectionLocked = false,
  refreshToken = 0,
  onQuestionsRemoved,
  onNotice,
  onRefreshCatalog,
}: {
  catalog: CatalogCourse[];
  testDefinition: TestDefinition;
  teacherSelectedQuestionKeys?: string[];
  usedQuestionKeys?: Set<string>;
  pdfEnoughQuestions?: boolean;
  selectionLocked?: boolean;
  refreshToken?: number;
  onQuestionsRemoved?: (
    nextKeys: string[],
    nextSnapshots: QuestionBankItem[],
    removedQuestions: QuestionBankItem[],
  ) => void | Promise<void>;
  onNotice: (message: string) => void;
  onRefreshCatalog: () => void;
}) {
  const savedBuilder = useMemo(
    () => readJson("edupanel_test_builder_v2", {}),
    [],
  );

  const [grade, setGrade] = useState(
    String(savedBuilder?.grade || ""),
  );
  const [courseId, setCourseId] = useState(
    String(savedBuilder?.courseId || ""),
  );
  const [unitId, setUnitId] = useState(
    String(savedBuilder?.unitId || ""),
  );
  const [topicId, setTopicId] = useState(
    String(savedBuilder?.topicId || ""),
  );
  const [outcomeId, setOutcomeId] = useState(
    String(savedBuilder?.outcomeId || ""),
  );
  const [columnCount, setColumnCount] = useState<2 | 3>(
    savedBuilder?.columnCount === 3 ? 3 : 2,
  );
  const [questionSpacing, setQuestionSpacing] = useState(
    Number(savedBuilder?.questionSpacing || 10),
  );
  const [selectedQuestionKeys, setSelectedQuestionKeys] = useState<
    string[]
  >(
    Array.isArray(savedBuilder?.selectedQuestionKeys)
      ? savedBuilder.selectedQuestionKeys.map(String)
      : [],
  );
  const [selectedQuestionSnapshots, setSelectedQuestionSnapshots] = useState<
    QuestionBankItem[]
  >(
    Array.isArray(savedBuilder?.selectedQuestionSnapshots)
      ? savedBuilder.selectedQuestionSnapshots
      : [],
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [onlySelected, setOnlySelected] = useState(false);

  const selectionHydrationRef = useRef<{
    testName: string;
    keysSignature: string;
    snapshotsSignature: string;
  } | null>(null);

  useEffect(() => {
    if (!testDefinition.name.trim()) return;

    const activeBuilder = readJson("edupanel_test_builder_v2", {});
    const hydratedKeys = Array.isArray(activeBuilder?.selectedQuestionKeys)
      ? activeBuilder.selectedQuestionKeys.map(String)
      : [];
    const hydratedSnapshots = Array.isArray(activeBuilder?.selectedQuestionSnapshots)
      ? activeBuilder.selectedQuestionSnapshots
      : [];

    selectionHydrationRef.current = {
      testName: testDefinition.name,
      keysSignature: JSON.stringify(hydratedKeys),
      snapshotsSignature: JSON.stringify(
        hydratedSnapshots.map((item: any) =>
          String(item?.key || item?.questionId || item?.code || ""),
        ),
      ),
    };

    setGrade(testDefinition.grade || "");
    setCourseId(testDefinition.courseId || "");
    setUnitId(testDefinition.unitId || "");
    setTopicId(testDefinition.type === "unit" ? "" : testDefinition.topicId || "");
    setOutcomeId(testDefinition.type === "outcome" ? testDefinition.outcomeId || "" : "");
    setColumnCount(testDefinition.columnCount === 3 ? 3 : 2);
    setQuestionSpacing(Number(testDefinition.questionSpacing || 10));
    setSelectedQuestionKeys(hydratedKeys);
    setSelectedQuestionSnapshots(hydratedSnapshots);
    setOnlySelected(false);
  }, [
    testDefinition.name,
    testDefinition.type,
    testDefinition.grade,
    testDefinition.courseId,
    testDefinition.unitId,
    testDefinition.topicId,
    testDefinition.outcomeId,
    testDefinition.columnCount,
    testDefinition.questionSpacing,
  ]);

  useEffect(() => {
    const syncSelectionFromBuilder = (event?: Event) => {
      const custom = event as CustomEvent<any>;
      const builder = custom?.detail || readJson("edupanel_test_builder_v2", {});
      if (String(builder?.testName || "") !== String(testDefinition.name || "")) {
        return;
      }

      const nextKeys = Array.isArray(builder?.selectedQuestionKeys)
        ? builder.selectedQuestionKeys.map(String)
        : [];
      const nextSnapshots = Array.isArray(builder?.selectedQuestionSnapshots)
        ? builder.selectedQuestionSnapshots
        : [];

      const nextKeysSignature = JSON.stringify(nextKeys);
      const nextSnapshotsSignature = JSON.stringify(
        nextSnapshots.map((item: any) =>
          String(item?.key || item?.questionId || item?.code || ""),
        ),
      );

      const currentKeysSignature = JSON.stringify(selectedQuestionKeys.map(String));
      const currentSnapshotsSignature = JSON.stringify(
        selectedQuestionSnapshots.map((item: any) =>
          String(item?.key || item?.questionId || item?.code || ""),
        ),
      );

      // Kendi yazdığımız builder olayı aynı state'i geri taşıyorsa yeniden
      // hydration başlatmayız. Aksi halde sonraki gerçek kullanıcı seçimi
      // gereksiz yere engellenebilirdi.
      if (
        currentKeysSignature === nextKeysSignature &&
        currentSnapshotsSignature === nextSnapshotsSignature
      ) {
        return;
      }

      selectionHydrationRef.current = {
        testName: testDefinition.name,
        keysSignature: nextKeysSignature,
        snapshotsSignature: nextSnapshotsSignature,
      };

      setSelectedQuestionKeys(nextKeys);
      setSelectedQuestionSnapshots(nextSnapshots);
    };

    window.addEventListener(
      "edupanel:test-builder-updated",
      syncSelectionFromBuilder as EventListener,
    );
    return () =>
      window.removeEventListener(
        "edupanel:test-builder-updated",
        syncSelectionFromBuilder as EventListener,
      );
  }, [testDefinition.name, selectedQuestionKeys, selectedQuestionSnapshots]);

  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState("");
  const [questionBankRefreshVersion, setQuestionBankRefreshVersion] = useState(0);
  const questionBankCatalogRef = useRef(catalog);
  const questionBankRequestIdRef = useRef(0);

  useEffect(() => {
    questionBankCatalogRef.current = catalog;
  }, [catalog]);


  // Canonical soru bankası başka bir modülde veya doğrudan API üzerinden
  // değişmiş olabilir. Bu blok üst-sekme state'inin scope'una bağlı değildir.
  // Bileşen ilk mount olduğunda zaten loadQuestionBank çalışır; pencere yeniden
  // odaklandığında veya görünür olduğunda da havuzu tekrar okuruz.
  useEffect(() => {
    const refreshCanonicalBank = () => {
      if (document.visibilityState === "visible") {
        setQuestionBankRefreshVersion((value) => value + 1);
      }
    };

    window.addEventListener("focus", refreshCanonicalBank);
    document.addEventListener("visibilitychange", refreshCanonicalBank);
    return () => {
      window.removeEventListener("focus", refreshCanonicalBank);
      document.removeEventListener("visibilitychange", refreshCanonicalBank);
    };
  }, []);

  useEffect(() => {
    const requestId = ++questionBankRequestIdRef.current;
    const controller = new AbortController();

    const loadQuestionBank = async () => {
      if (!grade || !courseId) {
        if (requestId === questionBankRequestIdRef.current) {
          setQuestionBank([]);
          setQuestionBankError("");
          setQuestionBankLoading(false);
        }
        return;
      }

      setQuestionBankLoading(true);
      setQuestionBankError("");

      try {
        const params = new URLSearchParams();
        params.set("status", "active");
        params.set("grade", grade);
        params.set(
          "courseId",
          canonicalCourseId(courseId, unitId, topicId, outcomeId),
        );
        params.set("questionType", "study");
        params.set("usage", "unused");
        // Konu/kazanım sayaçlarının tamamını aynı anda doğru gösterebilmek için
        // soru havuzunu ünite düzeyinde alıyoruz. Aktif konu/kazanım filtresi
        // aşağıdaki scopedQuestions hesabında istemci tarafında uygulanıyor.
        if (unitId) params.set("unitId", unitId);
        params.set("limit", "500");
        params.set("offset", "0");

        const response = await fetch(
          `/api/question-bank/questions?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            String(
              body?.error ||
                `Soru bankası okunamadı (${response.status}).`,
            ),
          );
        }

        const payload = await response.json();
        const records = extractQuestionRows(payload).filter(
          (record) =>
            String(record?.status || "active").toLowerCase() === "active" &&
            String(
              record?.questionType ||
                record?.question_type ||
                "study",
            ).toLowerCase() === "study",
        );

        const rows = records
          .map((record) =>
            apiRecordToQuestionItem(
              record,
              questionBankCatalogRef.current,
            ),
          )
          .filter((question) =>
            Boolean(question.questionId || question.code),
          )
          .sort(
            (a, b) =>
              a.unitName.localeCompare(b.unitName, "tr-TR") ||
              a.topicName.localeCompare(b.topicName, "tr-TR") ||
              a.outcomeName.localeCompare(b.outcomeName, "tr-TR") ||
              a.order - b.order ||
              a.code.localeCompare(b.code, "tr-TR"),
          );

        if (requestId === questionBankRequestIdRef.current) {
          setQuestionBank(rows);
        }
      } catch (error) {
        if (
          requestId === questionBankRequestIdRef.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setQuestionBank([]);
          setQuestionBankError(
            error instanceof Error
              ? error.message
              : "Canonical soru bankası okunamadı.",
          );
        }
      } finally {
        if (requestId === questionBankRequestIdRef.current) {
          setQuestionBankLoading(false);
        }
      }
    };

    void loadQuestionBank();

    return () => {
      controller.abort();
    };
  }, [
    grade,
    courseId,
    unitId,
    topicId,
    outcomeId,
    questionBankRefreshVersion,
    refreshToken,
  ]);

  const courses = useMemo(
    () =>
      catalog
        .filter((course) => course.grade === grade)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "tr-TR"),
        ),
    [catalog, grade],
  );

  const selectedCourse = courses.find(
    (course) => course.id === courseId,
  );
  const units = selectedCourse?.units || [];
  const selectedUnit = units.find(
    (unit) => String(unit.id) === unitId,
  );
  const topics = selectedUnit?.topics || [];
  const selectedTopic = topics.find(
    (topic) => String(topic.id) === topicId,
  );
  const outcomes =
    selectedTopic?.outcomes ||
    selectedTopic?.objectives ||
    [];
  const selectedOutcome = outcomes.find(
    (item, index) => outcomeIdOf(item, index) === outcomeId,
  );

  const scopedQuestions = useMemo(() => {
    return questionBank.filter((question) => {
      if (grade && question.grade && question.grade !== grade) return false;
      if (
        courseId &&
        canonicalCourseId(question.courseId, question.unitId, question.topicId, question.outcomeId) !==
          canonicalCourseId(courseId, unitId, topicId, outcomeId)
      ) return false;
      if (unitId && question.unitId !== unitId) return false;
      if (topicId && question.topicId !== topicId) return false;
      if (outcomeId && question.outcomeId !== outcomeId) return false;

      if (outcomeId) return question.scopeLevel === "outcome";
      if (topicId) return question.scopeLevel === "topic" || question.scopeLevel === "outcome";
      return question.scopeLevel === "topic" || question.scopeLevel === "outcome";
    });
  }, [
    questionBank,
    grade,
    courseId,
    unitId,
    topicId,
    outcomeId,
  ]);

  const availableQuestions = useMemo(
    () =>
      scopedQuestions.filter(
        (question) => !usedQuestionKeys?.has(String(question.key)),
      ),
    [scopedQuestions, usedQuestionKeys],
  );

  const reservedQuestions = useMemo(
    () =>
      scopedQuestions.filter((question) =>
        usedQuestionKeys?.has(String(question.key)),
      ),
    [scopedQuestions, usedQuestionKeys],
  );

  /*
   * Yönetici görünümünde seçilebilir sorular daima önce gelir.
   * Başka aktif testte kullanılan sorular en sona alınır ve pasif gösterilir.
   */
  const filteredQuestions = useMemo(
    () => groupQuestionRowsForTest([...availableQuestions, ...reservedQuestions]),
    [availableQuestions, reservedQuestions],
  );


  const activeOutcomeQuestionStats = useMemo(() => {
    const allInScope = questionBank.filter((question) => {
      if (
        courseId &&
        canonicalCourseId(question.courseId, question.unitId, question.topicId, question.outcomeId) !==
          canonicalCourseId(courseId, unitId, topicId, outcomeId)
      ) return false;
      if (unitId && question.unitId !== unitId) return false;
      if (topicId && question.topicId !== topicId) return false;
      if (outcomeId && question.outcomeId !== outcomeId) return false;
      return true;
    });

    const used = allInScope.filter((question) =>
      usedQuestionKeys?.has(String(question.key)),
    ).length;

    return {
      total: allInScope.length,
      used,
      available: Math.max(0, allInScope.length - used),
    };
  }, [
    questionBank,
    courseId,
    unitId,
    topicId,
    outcomeId,
    usedQuestionKeys,
  ]);

  const selectedQuestions = useMemo(() => {
    const activeMap = new Map(
      questionBank.map((question) => [String(question.key), question]),
    );
    const snapshotMap = new Map(
      selectedQuestionSnapshots.map((question) => [
        String(question.key || question.questionId || question.code),
        question,
      ]),
    );

    const rows = selectedQuestionKeys
      .map(
        (key) =>
          activeMap.get(String(key)) ||
          snapshotMap.get(String(key)) ||
          null,
      )
      .filter(Boolean) as QuestionBankItem[];
    return groupQuestionRowsForTest(rows);
  }, [
    questionBank,
    selectedQuestionKeys,
    selectedQuestionSnapshots,
  ]);

  const selectedQuestionGroupPaletteById = useMemo(() => {
    const orderedGroupIds: string[] = [];
    selectedQuestions.forEach((question) => {
      const groupId = questionGroupIdForTest(question);
      if (groupId && !orderedGroupIds.includes(groupId)) orderedGroupIds.push(groupId);
    });
    return new Map(
      orderedGroupIds.map((groupId, index) => [
        groupId,
        QUESTION_GROUP_SELECTION_PALETTES[index % QUESTION_GROUP_SELECTION_PALETTES.length],
      ]),
    );
  }, [selectedQuestions]);

  // Müfredat ağacında seçilmiş soru sayısı yerine, o konu/kazanım için
  // halen seçilebilir soru havuzunda kaç soru bulunduğunu gösterir.
  const questionPoolScopeCounts = useMemo(() => {
    const byTopic = new Map<string, number>();
    const byOutcome = new Map<string, number>();

    for (const question of questionBank) {
      const topicKey = [
        String(question.unitId || ""),
        String(question.topicId || ""),
      ].join("::");
      byTopic.set(topicKey, (byTopic.get(topicKey) || 0) + 1);

      const outcomeKey = [
        String(question.unitId || ""),
        String(question.topicId || ""),
        String(question.outcomeId || ""),
      ].join("::");
      byOutcome.set(outcomeKey, (byOutcome.get(outcomeKey) || 0) + 1);
    }

    return { byTopic, byOutcome };
  }, [questionBank]);

  const teacherSelectedQuestionKeySet = useMemo(
    () => new Set(teacherSelectedQuestionKeys.map(String)),
    [teacherSelectedQuestionKeys],
  );

  /*
   * Seçilmiş sorular aktif bankadan düşse bile anahtar/snapshot korunur.
   * Böylece soru bankasından arşivlenen bir soru geçmiş testten kaybolmaz.
   */

  const scopeSummary = useMemo(
    () => deriveTestScope(selectedQuestions),
    [selectedQuestions],
  );

  const viewerQuestions = useMemo(() => {
    const filteredKeys = new Set(filteredQuestions.map((question) => String(question.key)));
    const withSelectedSnapshots = groupQuestionRowsForTest([
      ...filteredQuestions,
      ...selectedQuestions.filter(
        (question) => !filteredKeys.has(String(question.key)),
      ),
    ]);
    if (!onlySelected) return withSelectedSnapshots;
    const selectedSet = new Set(selectedQuestionKeys.map(String));
    return withSelectedSnapshots.filter((question) =>
      selectedSet.has(String(question.key)),
    );
  }, [
    filteredQuestions,
    selectedQuestions,
    onlySelected,
    selectedQuestionKeys,
  ]);

  const currentQuestion =
    viewerQuestions[currentQuestionIndex] || null;

  const currentQuestionReserved = Boolean(
    currentQuestion &&
      usedQuestionKeys?.has(String(currentQuestion.key)),
  );

  const currentQuestionGroupId = currentQuestion ? questionGroupIdForTest(currentQuestion) : "";
  const currentQuestionGroupMembers = useMemo(
    () => currentQuestionGroupId
      ? questionBank
          .filter((row) => questionGroupIdForTest(row) === currentQuestionGroupId)
          .sort((left, right) => questionGroupOrderForTest(left) - questionGroupOrderForTest(right))
      : [],
    [questionBank, currentQuestionGroupId],
  );
  const currentQuestionGroupLeader = currentQuestionGroupMembers[0] || null;
  const currentQuestionGroupHasSeparateInstruction = currentQuestionGroupMembers.some((row) =>
    Boolean(String(row.questionGroupInstructionImageUrl || "").trim()),
  );
  const currentQuestionIsGroupLeader = Boolean(
    !currentQuestionGroupHasSeparateInstruction &&
    currentQuestion &&
    currentQuestionGroupLeader &&
    String(currentQuestion.key) === String(currentQuestionGroupLeader.key),
  );
  const currentQuestionGroupToken = currentQuestion ? questionGroupTokenForTest(currentQuestion) : "";
  const currentQuestionGroupPalette = currentQuestionGroupId
    ? selectedQuestionGroupPaletteById.get(currentQuestionGroupId)
    : undefined;

  const currentAvailableQuestionPosition = useMemo(() => {
    if (!currentQuestion || currentQuestionReserved) return 0;
    const index = availableQuestions.findIndex(
      (question) => question.key === currentQuestion.key,
    );
    return index >= 0 ? index + 1 : 0;
  }, [
    currentQuestion,
    currentQuestionReserved,
    availableQuestions,
  ]);

  // Önizleme geçişlerini seri tutmak için mevcut sorunun çevresindeki küçük
  // thumbnail görsellerini önceden tarayıcı cache'ine al.
  useEffect(() => {
    if (viewerQuestions.length === 0) return;

    const indexes = new Set<number>();
    for (let delta = -3; delta <= 6; delta += 1) {
      const index =
        (currentQuestionIndex + delta + viewerQuestions.length) %
        viewerQuestions.length;
      indexes.add(index);
    }

    indexes.forEach((index) => {
      const src = resolveQuestionPreviewImage(viewerQuestions[index]);
      if (!src) return;
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [viewerQuestions, currentQuestionIndex]);

  useEffect(() => {
    viewerQuestions.slice(0, 12).forEach((question) => {
      const src = resolveQuestionPreviewImage(question);
      if (!src) return;
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [viewerQuestions]);

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [grade, courseId, unitId, topicId, outcomeId, onlySelected]);

  useEffect(() => {
    if (
      currentQuestionIndex > viewerQuestions.length - 1 &&
      viewerQuestions.length > 0
    ) {
      setCurrentQuestionIndex(viewerQuestions.length - 1);
    }
  }, [viewerQuestions.length, currentQuestionIndex]);

  useEffect(() => {
    const hydration = selectionHydrationRef.current;
    if (hydration && hydration.testName === testDefinition.name) {
      const keysSignature = JSON.stringify(selectedQuestionKeys.map(String));
      const snapshotsSignature = JSON.stringify(
        selectedQuestionSnapshots.map((item: any) =>
          String(item?.key || item?.questionId || item?.code || ""),
        ),
      );

      // Test değiştiği anda bu effect bir kez eski testin local state'iyle
      // çalışabilir. Hydration tamamlanana kadar eski listeyi yeni teste yazma.
      if (
        keysSignature !== hydration.keysSignature ||
        snapshotsSignature !== hydration.snapshotsSignature
      ) {
        return;
      }
      selectionHydrationRef.current = null;
    }

    const payload = {
      grade,
      courseId,
      unitId,
      topicId,
      outcomeId,
      testName: testDefinition.name,
      testType: testDefinition.type,
      columnCount,
      questionSpacing,
      showAnswersInPdf: testDefinition.showAnswersInPdf !== false,
      selectedQuestionKeys,
      selectedQuestionSnapshots: selectedQuestions,
      testScope: scopeSummary?.type || "",
      updatedAt: new Date().toISOString(),
    };

    sqliteStorage.setItem(
      "edupanel_test_builder_v2",
      JSON.stringify(payload),
    );

    window.dispatchEvent(
      new CustomEvent("edupanel:test-builder-updated", {
        detail: payload,
      }),
    );
  }, [
    grade,
    courseId,
    unitId,
    topicId,
    outcomeId,
    testDefinition.name,
    testDefinition.type,
    testDefinition.showAnswersInPdf,
    columnCount,
    questionSpacing,
    selectedQuestionKeys,
    selectedQuestions,
    scopeSummary?.type,
  ]);

  const groupMembersForSelection = (question: QuestionBankItem) => {
    const groupId = questionGroupIdForTest(question);
    if (!groupId) return [question];
    const members = questionBank
      .filter((row) => questionGroupIdForTest(row) === groupId)
      .sort((left, right) =>
        questionGroupOrderForTest(left) - questionGroupOrderForTest(right) ||
        String(left.key).localeCompare(String(right.key), "tr-TR", { numeric: true }),
      );
    return members.length > 0 ? members : [question];
  };

  const toggleQuestion = (question: QuestionBankItem) => {
    if (selectionLocked) {
      onNotice("Kilitli testte soru listesi değiştirilemez. Önce test kilidini açınız.");
      return;
    }
    const members = groupMembersForSelection(question);
    const groupId = questionGroupIdForTest(question);
    const reservedMember = members.find((member) => usedQuestionKeys?.has(String(member.key)));
    if (reservedMember) {
      onNotice(
        groupId
          ? "Bu grubun en az bir parçası başka aktif bir testte kullanılıyor. Grup birlikte seçilemez."
          : "Bu soru başka aktif bir testte kullanılıyor. Test iptal edilir veya silinirse soru yeniden seçilebilir.",
      );
      return;
    }

    const memberKeys = members.map((member) => String(member.key));
    const memberKeySet = new Set(memberKeys);
    const allSelected = memberKeys.every((key) => selectedQuestionKeys.includes(key));

    const withoutGroupKeys = selectedQuestionKeys.filter(
      (key) => !memberKeySet.has(String(key)),
    );
    const nextKeys = allSelected
      ? withoutGroupKeys
      : [...withoutGroupKeys, ...memberKeys];

    const withoutGroupSnapshots = selectedQuestionSnapshots.filter(
      (item) => !memberKeySet.has(String(item.key)),
    );
    const nextSnapshots = allSelected
      ? withoutGroupSnapshots
      : [...withoutGroupSnapshots, ...members];

    setSelectedQuestionKeys(nextKeys);
    setSelectedQuestionSnapshots(nextSnapshots);

    if (allSelected) {
      void onQuestionsRemoved?.(nextKeys, nextSnapshots, members);
    }

    const token = questionGroupTokenForTest(question);
    onNotice(
      groupId
        ? allSelected
          ? `${token || "Soru"} grubu testten çıkarıldı.`
          : `${token || "Soru"} grubu öncül ve bağlı sorularıyla birlikte teste eklendi.`
        : allSelected
          ? "Soru testten çıkarıldı."
          : "Soru teste eklendi.",
    );
  };

  const goPrevious = () => {
    if (viewerQuestions.length === 0) return;
    setCurrentQuestionIndex((current) =>
      current <= 0 ? viewerQuestions.length - 1 : current - 1,
    );
  };

  const goNext = () => {
    if (viewerQuestions.length === 0) return;
    setCurrentQuestionIndex((current) =>
      current >= viewerQuestions.length - 1 ? 0 : current + 1,
    );
  };

  // Soru görselinin/gövdesinin ortasına tıklamak doğrudan seçim / seçimden kaldırma anlamına gelir.
  // Grup sorularında mevcut Gxx kuralı korunur; grup birlikte seçilir veya birlikte kaldırılır.
  const toggleQuestionAndGoNext = (question: QuestionBankItem) => {
    if (selectionLocked) {
      onNotice("Kilitli testte soru listesi değiştirilemez. Önce test kilidini açınız.");
      return;
    }
    const members = groupMembersForSelection(question);
    const groupId = questionGroupIdForTest(question);
    const reservedMember = members.find((member) => usedQuestionKeys?.has(String(member.key)));
    if (reservedMember) {
      onNotice(
        groupId
          ? "Bu grubun en az bir parçası başka aktif bir testte kullanılıyor. Grup birlikte seçilemez."
          : "Bu soru başka aktif bir testte kullanılıyor. Test iptal edilir veya silinirse soru yeniden seçilebilir.",
      );
      return;
    }

    toggleQuestion(question);

    // Tekil soruda bir sonraki soruya geç. Grup seçildiyse/kaldırıldıysa aynı grubun
    // diğer parçalarını atlayıp gruptan sonraki ilk soruyu göster.
    if (!groupId) {
      goNext();
      return;
    }

    setCurrentQuestionIndex((current) => {
      if (viewerQuestions.length <= 1) return current;
      for (let step = 1; step < viewerQuestions.length; step += 1) {
        const candidateIndex = (current + step) % viewerQuestions.length;
        const candidate = viewerQuestions[candidateIndex];
        if (questionGroupIdForTest(candidate) !== groupId) return candidateIndex;
      }
      return current;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerQuestions.length]);

  const clearSelected = () => {
    if (selectionLocked) {
      onNotice("Kilitli testte soru listesi değiştirilemez. Önce test kilidini açınız.");
      return;
    }
    const removedQuestions = [...selectedQuestions];
    setSelectedQuestionKeys([]);
    setSelectedQuestionSnapshots([]);
    setOnlySelected(false);
    if (removedQuestions.length > 0) {
      void onQuestionsRemoved?.([], [], removedQuestions);
    } else {
      onNotice("Teste eklenen sorular temizlendi.");
    }
  };


  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

  if (!testDefinition.name.trim()) {
    return (
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto max-w-lg rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-6 py-10">
          <div className="text-base font-black text-slate-900">
            Önce sınıf seviyesi ve ders seçerek bir test açın.
          </div>
          <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            Kaydedilmiş teste tıkladığınızda bu ekran o testin kapsamıyla otomatik açılır.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900">
                Test İçeriği
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-700">
                <span className="font-black">
                  {testDefinition.grade}. Sınıf
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-black">
                  {selectedCourse?.name || "Ders"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onRefreshCatalog}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              title="Müfredat verisini yenile"
              aria-label="Müfredat verisini yenile"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-1 pl-1 text-[10px] font-normal lowercase text-slate-500">
              {testDefinition.type === "unit"
                ? "ünite testi"
                : testDefinition.type === "topic"
                  ? "konu testi"
                  : "kazanım testi"}
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-3 text-sm font-black leading-5 text-black">
              {testDefinition.name}
            </div>
          </div>

          {testDefinition.type !== "outcome" ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                  Konu ve Kazanımlar
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTopicId(
                      testDefinition.type === "topic"
                        ? testDefinition.topicId
                        : "",
                    );
                    setOutcomeId("");
                    setOnlySelected(false);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-black transition ${
                    (
                      testDefinition.type === "unit"
                        ? !topicId && !outcomeId
                        : topicId === testDefinition.topicId && !outcomeId
                    )
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {testDefinition.type === "unit" ? "Tüm Ünite" : "Tüm Konu"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                {(
                  testDefinition.type === "topic"
                    ? selectedTopic
                      ? [selectedTopic]
                      : []
                    : selectedUnit?.topics || []
                ).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-[10px] font-semibold text-slate-400">
                    Bu ünitede konu bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-0">
                    {(
                      testDefinition.type === "topic"
                        ? selectedTopic
                          ? [selectedTopic]
                          : []
                        : selectedUnit?.topics || []
                    ).map((topic) => {
                      const topicKey = String(topic.id);
                      const topicQuestionCount =
                        questionPoolScopeCounts.byTopic.get(
                          [String(unitId), String(topicKey)].join("::"),
                        ) || 0;
                      const topicOutcomes =
                        topic.outcomes || topic.objectives || [];
                      const topicActive =
                        topicId === topicKey && !outcomeId;

                      return (
                        <div key={topicKey}>
                          <button
                            type="button"
                            onClick={() => {
                              setTopicId(topicKey);
                              setOutcomeId("");
                              setOnlySelected(false);
                            }}
                            className={`flex w-full items-center rounded-xl px-3 py-1.5 text-left transition ${
                              topicActive
                                ? "bg-orange-100 ring-1 ring-orange-300"
                                : "hover:bg-white"
                            }`}
                          >
                            <span className="mr-2 mt-[5px] h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                            <span className="min-w-0 flex-1 text-[13px] font-black leading-5 text-slate-800">
                              {topic.name}{" "}
                              <span className="text-black">({topicQuestionCount})</span>
                            </span>
                          </button>

                          {topicOutcomes.length > 0 && (
                            <div className="ml-[18px] border-l border-slate-300 pl-2">
                              {topicOutcomes.map((outcome, outcomeIndex) => {
                                const outcomeKey = outcomeIdOf(
                                  outcome,
                                  outcomeIndex,
                                );
                                const outcomeQuestionCount =
                                  questionPoolScopeCounts.byOutcome.get(
                                    [String(unitId), String(topicKey), String(outcomeKey)].join("::"),
                                  ) || 0;
                                const outcomeActive =
                                  topicId === topicKey &&
                                  outcomeId === outcomeKey;

                                return (
                                  <button
                                    key={outcomeKey}
                                    type="button"
                                    onClick={() => {
                                      setTopicId(topicKey);
                                      setOutcomeId(outcomeKey);
                                      setOnlySelected(false);
                                    }}
                                    className={`relative flex w-full items-center rounded-lg px-3 py-1 text-left transition ${
                                      outcomeActive
                                        ? "bg-orange-50 ring-1 ring-orange-200"
                                        : "hover:bg-white"
                                    }`}
                                  >
                                    <span className="absolute -left-[9px] top-1/2 h-px w-2 bg-slate-300" />
                                    <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                    <span className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-slate-700">
                                      {outcomeNameOf(outcome)}{" "}
                                      <span className="font-black text-black">({outcomeQuestionCount})</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <SelectField
                label="Ders"
                value={courseId}
                onChange={(value) => {
                  setCourseId(value);
                  setUnitId("");
                  setTopicId("");
                  setOutcomeId("");
                }}
                className={inputClass}
                disabled
                options={courses.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                placeholder="Ders"
              />

              <SelectField
                label="Ünite"
                value={unitId}
                onChange={(value) => {
                  setUnitId(value);
                  setTopicId("");
                  setOutcomeId("");
                }}
                className={inputClass}
                disabled
                options={units.map((item) => ({
                  value: String(item.id),
                  label: item.name,
                }))}
                placeholder="Ünite"
              />

              <SelectField
                label="Konu"
                value={topicId}
                onChange={(value) => {
                  setTopicId(value);
                  setOutcomeId("");
                }}
                className={inputClass}
                disabled
                options={topics.map((item) => ({
                  value: String(item.id),
                  label: item.name,
                }))}
                placeholder="Konu"
              />

              {testDefinition.type === "outcome" && (
                <SelectField
                  label="Kazanım"
                  value={outcomeId}
                  onChange={setOutcomeId}
                  className={inputClass}
                  disabled
                  options={outcomes.map((item, index) => ({
                    value: outcomeIdOf(item, index),
                    label: outcomeNameOf(item),
                  }))}
                  placeholder="Kazanım"
                />
              )}
            </div>
          )}


        </aside>

        <main className="min-w-0 bg-slate-50/60 p-4">
          {pdfEnoughQuestions && (
            <div className="mb-3 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-center text-xs font-black text-emerald-950 shadow-sm">
              Yeterli sayıda soru seçilmiştir. İki A4 sayfaya sığan optimum soru grubu oluşturuldu ve ayrıca en az 5 yedek soru seçildi.
            </div>
          )}

          {outcomeId && activeOutcomeQuestionStats.used > 0 ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-4 text-amber-900">
              Bu kazanımda toplam{" "}
              <strong>{activeOutcomeQuestionStats.total}</strong> soru var.
              Bunların{" "}
              <strong>{activeOutcomeQuestionStats.used}</strong> tanesi başka
              aktif testlerde kullanılıyor ve seçilebilir sorulardan sonra pasif
              olarak gösteriliyor. Bu test için{" "}
              <strong>{activeOutcomeQuestionStats.available}</strong> soru
              kullanılabilir.
            </div>
          ) : null}

          {!grade ? (
            <EmptyState
              title="Test kapsamı eksik"
              description="Sınıf seviyesi ve ders seçimini kontrol edip ilgili testi yeniden açın."
            />
          ) : !courseId ? (
            <EmptyState
              title="Ders bilgisi bulunamadı"
              description="Ders seçimini kontrol edip ilgili testi yeniden açın."
            />
          ) : questionBankLoading && questionBank.length === 0 ? (
            <EmptyState
              title="Soru bankası okunuyor"
              description="Veritabanındaki aktif soru kayıtları ve soru görselleri getiriliyor."
            />
          ) : questionBankError && questionBank.length === 0 ? (
            <EmptyState
              title="Soru bankasına ulaşılamadı"
              description={questionBankError}
            />
          ) : !outcomeId ? (
            <EmptyState
              title="Kazanım seçiniz"
              description={
                topicId
                  ? "Konu yalnızca kazanımları gruplar. Soruları görmek için bu konunun altındaki bir kazanıma tıklayın."
                  : unitId
                    ? "Ünite yalnızca konuları gruplar. Önce konuya, ardından bir kazanıma tıklayın. Sorular yalnızca kazanım düzeyinde gösterilir."
                    : "Sorular yalnızca kazanımlara bağlıdır. Ünite → Konu → Kazanım yolunu izleyerek bir kazanım seçin."
              }
            />
          ) : viewerQuestions.length === 0 ? (
            <EmptyState
              title={
                onlySelected
                  ? "Bu kapsamda seçilmiş soru yok"
                  : "Bu kapsamda veritabanı sorusu bulunmuyor"
              }
              description={
                onlySelected
                  ? "Kapsamdaki Sorular görünümüne dönerek soru seçebilirsiniz."
                  : "Bu kazanıma bağlı aktif soru kaydı bulunamadı."
              }
            />
          ) : currentQuestion ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-[13px] font-black text-slate-800">
                    {currentQuestionReserved
                      ? `Kullanılmış · ${availableQuestions.length} seçilebilir`
                      : `${currentAvailableQuestionPosition}/${availableQuestions.length}`}
                  </div>
                  {currentQuestionGroupId ? (
                    <span className="inline-flex items-center rounded-full border-2 border-rose-700 bg-rose-600 px-3 py-1 text-[9px] font-black text-white shadow-sm ring-2 ring-rose-100">
                      🔗 GRUP {currentQuestionGroupToken || "SORU"} · {currentQuestionIsGroupLeader ? "ÖNCÜL" : "BAĞLI"} · BİRLİKTE SEÇİLİR
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 max-w-full flex-1 truncate text-right text-[10px] font-bold text-slate-500">
                  {curriculumQuestionDisplayName(currentQuestion)}
                </div>
              </div>

              <div className="relative flex h-[620px] min-h-[620px] max-h-[620px] items-center justify-center overflow-hidden bg-white px-8 py-3">
                <button
                  type="button"
                  onClick={goPrevious}
                  className="absolute left-4 top-[310px] z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:scale-105 hover:bg-slate-50"
                  title="Önceki soru"
                  aria-label="Önceki soru"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>

                <div
                  role="button"
                  tabIndex={currentQuestionReserved ? -1 : 0}
                  onClick={() => toggleQuestionAndGoNext(currentQuestion)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleQuestionAndGoNext(currentQuestion);
                    }
                  }}
                  title={
                    currentQuestionReserved
                      ? "Bu soru başka bir testte kullanılıyor"
                      : "Soruyu seçmek veya seçimden kaldırmak için tıklayın"
                  }
                  className={`relative flex h-full min-h-0 w-full max-w-[1120px] items-center justify-center overflow-hidden rounded-2xl border-4 p-1 transition ${
                    currentQuestionReserved
                      ? "border-slate-300 bg-slate-100/60 opacity-75"
                      : teacherSelectedQuestionKeySet.has(currentQuestion.key)
                        ? "border-red-500 bg-red-50/30"
                        : selectedQuestionKeys.includes(currentQuestion.key)
                          ? "border-green-500 bg-green-50/30"
                          : "border-transparent bg-white"
                  } ${
                    currentQuestionReserved
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  {currentQuestionGroupId ? (
                    <div
                      className={`pointer-events-none absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-[10px] font-black shadow-md ${
                        currentQuestionGroupPalette?.marker || "border-violet-500 bg-violet-50 text-violet-800"
                      }`}
                    >
                      <span aria-hidden="true">🔗</span>
                      <span>
                        {currentQuestionGroupToken || "GRUP"} · {currentQuestionIsGroupLeader ? "YÖNERGE" : "BAĞLI SORU"}
                      </span>
                    </div>
                  ) : null}

                  {resolveQuestionPreviewImage(currentQuestion) ? (
                    <>
                      <img
                        key={currentQuestion.key}
                        src={resolveQuestionPreviewImage(currentQuestion)}
                        alt={currentQuestion.code}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        className="h-full max-h-full w-auto max-w-full object-contain"
                        onLoad={(event) => {
                          event.currentTarget.style.display = "block";
                        }}
                        onError={(event) => {
                          const image = event.currentTarget;
                          image.style.display = "none";
                          const fallback =
                            image.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div className="hidden h-full flex-col items-center justify-center overflow-hidden px-6 py-10 text-center">
                        <ImageIcon className="h-12 w-12 text-rose-300" />
                        <span className="mt-3 text-xs font-black text-rose-600">
                          Soru görseli yüklenemedi
                        </span>
                        <span className="mt-1 max-w-xl break-all text-[9px] font-semibold text-slate-400">
                          {currentQuestion.storagePath ||
                            currentQuestion.imageUrl ||
                            currentQuestion.code}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                      <ImageIcon className="h-12 w-12 text-slate-300" />
                      <span className="mt-3 text-xs font-black text-slate-500">
                        {currentQuestion.code}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold text-slate-400">
                        Soru görsel bağlantısı bulunamadı.
                      </span>
                    </div>
                  )}

                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 top-[310px] z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:scale-105 hover:bg-slate-50"
                  title="Sonraki soru"
                  aria-label="Sonraki soru"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-slate-800">
                    {curriculumQuestionDisplayName(currentQuestion)}
                  </div>
                </div>

                {currentQuestion.answer && (
                  <span className="rounded-xl bg-amber-100 px-3 py-2 text-[10px] font-black text-amber-900">
                    Doğru Cevap: {currentQuestion.answer}
                  </span>
                )}

                <div className="text-[9px] font-semibold text-slate-400">
                  Klavyeden ← ve → tuşlarıyla da gezebilirsiniz.
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-800">
                  Teste Eklenen Sorular
                </h4>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Test türü bu listedeki gerçek soru dağılımına göre otomatik belirlenir.
                </p>
              </div>

              {selectedQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelected}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                >
                  <Minus className="h-4 w-4" />
                  Listeyi Temizle
                </button>
              )}
            </div>

            {selectedQuestions.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-[10px] font-bold text-slate-400">
                Henüz teste soru eklenmedi.
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedQuestions.map((question, index) => {
                  const groupId = questionGroupIdForTest(question);
                  const groupPalette = groupId
                    ? selectedQuestionGroupPaletteById.get(groupId)
                    : undefined;
                  const teacherSelected = teacherSelectedQuestionKeySet.has(question.key);
                  const buttonClass = groupPalette
                    ? groupPalette.button
                    : teacherSelected
                      ? "border-red-200 bg-red-50 hover:bg-red-100"
                      : "border-green-200 bg-green-50 hover:bg-green-100";
                  const badgeClass = groupPalette
                    ? groupPalette.badge
                    : teacherSelected
                      ? "bg-red-600"
                      : "bg-green-600";
                  const textClass = groupPalette
                    ? groupPalette.text
                    : teacherSelected
                      ? "text-red-900"
                      : "text-green-900";
                  const iconClass = groupPalette
                    ? groupPalette.icon
                    : teacherSelected
                      ? "text-red-700"
                      : "text-green-700";

                  return (
                    <button
                      type="button"
                      key={question.key}
                      onClick={() => toggleQuestion(question)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${buttonClass} ${
                        teacherSelected && groupPalette ? "ring-2 ring-red-200" : ""
                      }`}
                      title="Testten çıkar"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-black text-white ${badgeClass}`}
                      >
                        {isFileNameGroupLeaderForTest(question, selectedQuestions) ? "Ö" : index + 1}
                      </span>
                      <span className={`max-w-[180px] truncate text-[10px] font-black ${textClass}`}>
                        {groupId ? `🔗 ${questionGroupTokenForTest(question) || "GRUP"} · ` : ""}{curriculumQuestionDisplayName(question)}
                      </span>
                      <Minus className={`h-3.5 w-3.5 ${iconClass}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}


function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        <BookOpen className="h-8 w-8" />
      </span>
      <h4 className="mt-4 text-sm font-black text-slate-700">
        {title}
      </h4>
      <p className="mt-2 max-w-md text-[10px] font-semibold leading-5 text-slate-400">
        {description}
      </p>


    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  className: string;
}) {
  return (
    <label className="mb-3 block text-[10px] font-black uppercase tracking-wide text-slate-600">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
