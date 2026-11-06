import React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ListTree,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  fetchCurrentAssignmentCurriculumTree,
} from "../services/curriculumRepository";

const replaceLegacyExamTerminology = (value: unknown) =>
  String(value || "")
    .replace(/branch denemesi/gi, "Ders Denemesi")
    .replace(/branch deneme/gi, "Ders Denemesi")
    .replace(/branş denemesi/gi, "Ders Denemesi")
    .replace(/branş deneme/gi, "Ders Denemesi")
    .replace(/ünite taraması/gi, "Ünite Denemesi")
    .replace(/ünite tarama/gi, "Ünite Denemesi");

type Props = {
  token?: string;
  teacherId: string;
  teacherName: string;
  onBack: () => void;
};

type QuestionSnapshot = {
  id?: string;
  key?: string;
  questionId?: string;
  question_id?: string;
  code?: string;
  questionCode?: string;
  question_code?: string;
  fileName?: string;
  file_name?: string;
  originalFileName?: string;
  original_file_name?: string;
  imageUrl?: string;
  image_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  storagePath?: string;
  unitName?: string;
  topicName?: string;
  outcomeName?: string;
  unitId?: string;
  topicId?: string;
  outcomeId?: string;
  answer?: string;
  order?: number;
  questionGroupId?: string;
  questionGroupMode?: "required" | "free";
  questionGroupOrder?: number;
  questionGroupSize?: number;
  questionGroupTitle?: string;
  questionGroupInstructionText?: string;
  questionGroupInstructionImageUrl?: string;
};

type AssignmentSummary = {
  id: string;
  assignmentKind?: "exam" | "test";
  workflowType?: "exam-question-selection" | "test-question-selection";
  examId?: string;
  subject?: string;
  testId?: string;
  testName?: string;
  testType?: string;
  grade?: string;
  courseId?: string;
  courseName?: string;
  unitId?: string;
  topicId?: string;
  outcomeId?: string;
  selectedQuestionKeys?: string[];
  selectedQuestionCount?: number;
  requiredQuestionCount?: number;
  maxQuestionCount?: number;
  questionCountMode?: "fixed" | "flexible";
  remainingQuestionCount?: number;
  canComplete?: boolean;
  updatedAt?: string;
  unitName?: string;
  scopeTree?: AssignmentScopeUnit[];
};

type AssignmentScopeOutcome = {
  id: string;
  name: string;
  questions?: QuestionSnapshot[];
};

type AssignmentScopeTopic = {
  id: string;
  name: string;
  outcomes?: AssignmentScopeOutcome[];
};

type AssignmentScopeUnit = {
  id: string;
  name: string;
  topics?: AssignmentScopeTopic[];
};

type AssignmentFilter =
  | { type: "unit"; id: string; name?: string }
  | { type: "topic"; id: string; name?: string; unitId?: string }
  | {
      type: "outcome";
      id: string;
      name?: string;
      topicId?: string;
      topicName?: string;
    }
  | null;

type AssignmentScopePlan = { id?: string; unitId?: string; unitName?: string; topicId?: string; topicName?: string; outcomeId?: string; outcomeName?: string; count?: number; questionCount?: number; requiredQuestionCount?: number };

type AssignmentDetail = AssignmentSummary & {
  scopes?: AssignmentScopePlan[];
  selectionScopes?: AssignmentScopePlan[];
  questionScopes?: AssignmentScopePlan[];
  questionPlan?: AssignmentScopePlan[];
  plan?: AssignmentScopePlan[];
  requirements?: AssignmentScopePlan[];
  availableQuestionSnapshots?: QuestionSnapshot[];
  selectedQuestionSnapshots?: QuestionSnapshot[];
  committedQuestionKeys?: string[];
  selectionRevision?: number;
  scopeTree?: AssignmentScopeUnit[];
  // Yönetici tarafında soru olup olmamasından bağımsız kaydedilen tam müfredat ağacı.
  curriculumScopeTree?: AssignmentScopeUnit[];
  fullScopeTree?: AssignmentScopeUnit[];
};

const normalizeScopeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

const normalizeScopeId = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, "");


const scopeNodeKey = (id: unknown, name: unknown) => {
  const normalizedId = normalizeScopeId(id);
  if (normalizedId) return `id:${normalizedId}`;
  return `name:${normalizeScopeText(name)}`;
};

const mergeQuestionSnapshots = (
  current: QuestionSnapshot[] = [],
  incoming: QuestionSnapshot[] = [],
) => {
  const map = new Map<string, QuestionSnapshot>();
  [...current, ...incoming].forEach((question, index) => {
    const key = questionIdentity(question) || `snapshot-${index}-${String(question?.code || "")}`;
    if (!map.has(key)) map.set(key, question);
  });
  return [...map.values()];
};

const scopeTreeHasContent = (tree: AssignmentScopeUnit[] | undefined | null) =>
  Array.isArray(tree) && tree.length > 0;

const scopeTreeFingerprint = (tree: AssignmentScopeUnit[] | undefined | null) =>
  JSON.stringify(
    (Array.isArray(tree) ? tree : []).map((unit) => ({
      id: String(unit?.id || ""),
      name: normalizeScopeText(unit?.name),
      topics: (unit?.topics || []).map((topic) => ({
        id: String(topic?.id || ""),
        name: normalizeScopeText(topic?.name),
        outcomes: (topic?.outcomes || []).map((outcome) => ({
          id: String(outcome?.id || ""),
          name: normalizeScopeText(outcome?.name),
        })),
      })),
    })),
  );

/**
 * Müfredat ağacını soru havuzundan AYRI tutar. Bir kaynakta soru kaydı olmayan
 * kazanımlar düşürülmüş olsa bile diğer kaynaktaki tam müfredat düğümleri korunur.
 * Böylece öğretmen telefonunda konu açıldığında 0 sorulu kazanımlar da görünür.
 */
const mergeAssignmentScopeTrees = (
  ...sources: Array<AssignmentScopeUnit[] | undefined | null>
): AssignmentScopeUnit[] => {
  const unitOrder: string[] = [];
  const units = new Map<string, AssignmentScopeUnit>();

  const ensureUnit = (raw: AssignmentScopeUnit) => {
    const key = scopeNodeKey(raw?.id, raw?.name);
    if (!key || key === "name:") return null;
    if (!units.has(key)) {
      unitOrder.push(key);
      units.set(key, { id: String(raw?.id || raw?.name || key), name: String(raw?.name || raw?.id || "Ünite"), topics: [] });
    }
    const unit = units.get(key)!;
    if (!unit.name && raw?.name) unit.name = String(raw.name);
    return unit;
  };

  for (const source of sources) {
    for (const rawUnit of Array.isArray(source) ? source : []) {
      const unit = ensureUnit(rawUnit);
      if (!unit) continue;

      const topicOrder: string[] = (unit as any).__topicOrder || [];
      const topicMap: Map<string, AssignmentScopeTopic> = (unit as any).__topicMap || new Map();
      (unit as any).__topicOrder = topicOrder;
      (unit as any).__topicMap = topicMap;

      for (const rawTopic of rawUnit?.topics || []) {
        const topicKey = scopeNodeKey(rawTopic?.id, rawTopic?.name);
        if (!topicKey || topicKey === "name:") continue;
        if (!topicMap.has(topicKey)) {
          topicOrder.push(topicKey);
          topicMap.set(topicKey, { id: String(rawTopic?.id || rawTopic?.name || topicKey), name: String(rawTopic?.name || rawTopic?.id || "Konu"), outcomes: [] });
        }
        const topic = topicMap.get(topicKey)!;
        if (!topic.name && rawTopic?.name) topic.name = String(rawTopic.name);

        const outcomeOrder: string[] = (topic as any).__outcomeOrder || [];
        const outcomeMap: Map<string, AssignmentScopeOutcome> = (topic as any).__outcomeMap || new Map();
        (topic as any).__outcomeOrder = outcomeOrder;
        (topic as any).__outcomeMap = outcomeMap;

        for (const rawOutcome of rawTopic?.outcomes || []) {
          const outcomeKey = scopeNodeKey(rawOutcome?.id, rawOutcome?.name);
          if (!outcomeKey || outcomeKey === "name:") continue;
          if (!outcomeMap.has(outcomeKey)) {
            outcomeOrder.push(outcomeKey);
            outcomeMap.set(outcomeKey, {
              id: String(rawOutcome?.id || rawOutcome?.name || outcomeKey),
              name: String(rawOutcome?.name || rawOutcome?.id || "Kazanım"),
              questions: [],
            });
          }
          const outcome = outcomeMap.get(outcomeKey)!;
          if (!outcome.name && rawOutcome?.name) outcome.name = String(rawOutcome.name);
          outcome.questions = mergeQuestionSnapshots(outcome.questions || [], rawOutcome?.questions || []);
        }
      }
    }
  }

  return unitOrder.map((unitKey) => {
    const unit = units.get(unitKey)!;
    const topicOrder: string[] = (unit as any).__topicOrder || [];
    const topicMap: Map<string, AssignmentScopeTopic> = (unit as any).__topicMap || new Map();
    return {
      id: unit.id,
      name: unit.name,
      topics: topicOrder.map((topicKey) => {
        const topic = topicMap.get(topicKey)!;
        const outcomeOrder: string[] = (topic as any).__outcomeOrder || [];
        const outcomeMap: Map<string, AssignmentScopeOutcome> = (topic as any).__outcomeMap || new Map();
        return {
          id: topic.id,
          name: topic.name,
          outcomes: outcomeOrder.map((outcomeKey) => {
            const outcome = outcomeMap.get(outcomeKey)!;
            return { id: outcome.id, name: outcome.name, questions: outcome.questions || [] };
          }),
        };
      }),
    };
  });
};

const questionIdentity = (question: QuestionSnapshot) =>
  String(
    question.questionId ||
      question.question_id ||
      question.id ||
      question.key ||
      question.questionCode ||
      question.code ||
      "",
  ).trim();

const fileNameGroupPartsOf = (question: QuestionSnapshot | undefined | null) => {
  const candidates = [
    question?.originalFileName,
    question?.original_file_name,
    question?.fileName,
    question?.file_name,
    question?.questionCode,
    question?.question_code,
    question?.code,
  ];
  for (const candidate of candidates) {
    const stem = String(candidate || "").trim().replace(/\.[^.]+$/, "");
    if (!stem) continue;
    const match = stem.match(/(?:^|_)(\d+)_(G[A-Z0-9]+)_([A-E])$/i);
    if (!match) continue;
    return { token: String(match[2] || "").toUpperCase(), order: Math.max(0, Number(match[1] || 0)) };
  }
  return null;
};

const questionGroupIdOf = (question: QuestionSnapshot | undefined | null) => {
  const explicit = String(question?.questionGroupId || "").trim();
  if (explicit) return explicit;
  const parsed = fileNameGroupPartsOf(question);
  if (!parsed?.token) return "";
  const scope = [question?.unitId || "", question?.topicId || "", question?.outcomeId || ""]
    .map((value) => String(value || "").trim()).join(":");
  return `filename-group-fallback:${scope}:${parsed.token}`;
};
const questionGroupModeOf = (question: QuestionSnapshot | undefined | null): "required" | "free" =>
  String(question?.questionGroupMode || "required").toLowerCase() === "free" ? "free" : "required";
const questionGroupOrderOf = (question: QuestionSnapshot | undefined | null) => {
  const explicit = question?.questionGroupOrder;
  if (explicit !== undefined && explicit !== null) return Math.max(0, Number(explicit || 0));
  return Math.max(0, Number(fileNameGroupPartsOf(question)?.order || 0));
};
const questionGroupSizeOf = (question: QuestionSnapshot | undefined | null) => Math.max(0, Number(question?.questionGroupSize || 0));
const isFileNameQuestionGroup = (groupId: string) => {
  const value = String(groupId || "").trim();
  return value.startsWith("filename-group:") || value.startsWith("filename-group-fallback:");
};
const questionGroupTokenOf = (question: QuestionSnapshot | undefined | null) => {
  const parsed = fileNameGroupPartsOf(question);
  if (parsed?.token) return parsed.token;
  const groupId = questionGroupIdOf(question);
  if (!isFileNameQuestionGroup(groupId)) return "";
  const token = groupId.split(":").filter(Boolean).pop() || "";
  return /^G[A-Z0-9]+$/i.test(token) ? token.toUpperCase() : "";
};

const groupQuestionsContiguously = (rows: QuestionSnapshot[]) => {
  const output: QuestionSnapshot[] = [];
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

const imageSource = (question: QuestionSnapshot) => {
  const direct = String(
    question.thumbnailUrl ||
      question.thumbnail_url ||
      question.imageUrl ||
      question.image_url ||
      "",
  ).trim();
  if (direct) return direct;

  // Soru bankası kayıtlarının önemli bir bölümü yalnız storagePath taşır.
  // Görsel URL alanı boş olsa bile soru kartını canonical image endpoint'inden aç.
  const id = questionIdentity(question);
  if (id) return `/api/question-bank/images/${encodeURIComponent(id)}`;
  return String(question.storagePath || "").trim();
};

const assignmentUsesFlexibleCount = (
  assignment: AssignmentSummary | AssignmentDetail | null,
) => {
  if (!assignment) return false;
  const explicitlyExam =
    assignment.assignmentKind === "exam" ||
    assignment.workflowType === "exam-question-selection";
  const isTest =
    !explicitlyExam &&
    (assignment.assignmentKind === "test" ||
      assignment.workflowType === "test-question-selection" ||
      (!assignment.examId && !assignment.subject));
  return (
    assignment.questionCountMode === "flexible" ||
    (isTest &&
      Number(assignment.requiredQuestionCount || 0) === 1 &&
      Number(assignment.maxQuestionCount || 0) > 1)
  );
};

const assignmentRequiredCount = (assignment: AssignmentSummary | AssignmentDetail | null) =>
  assignmentUsesFlexibleCount(assignment)
    ? 0
    : Math.max(
        1,
        Number(
          assignment?.requiredQuestionCount ||
            assignment?.maxQuestionCount ||
            1,
        ),
      );

const assignmentMaxCount = (assignment: AssignmentSummary | AssignmentDetail | null) =>
  assignmentUsesFlexibleCount(assignment)
    ? Math.max(
        1,
        Number(
          assignment?.maxQuestionCount ||
            (assignment as AssignmentDetail | null)?.availableQuestionSnapshots?.length ||
            1,
        ),
      )
    : Math.max(
        assignmentRequiredCount(assignment),
        Number(
          assignment?.maxQuestionCount ||
            assignment?.requiredQuestionCount ||
            1,
        ),
      );

const assignmentKindOf = (assignment: AssignmentSummary | AssignmentDetail | null): "exam" | "test" => {
  if (!assignment) return "test";
  if (assignment.assignmentKind === "exam" || assignment.workflowType === "exam-question-selection") return "exam";
  if (assignment.assignmentKind === "test" || assignment.workflowType === "test-question-selection") return "test";

  const id = String(assignment.id || "");
  if (id.startsWith("qassign-") || assignment.examId || assignment.subject) return "exam";
  return "test";
};

const coveredUnitLabel = (assignment: AssignmentSummary | AssignmentDetail | null) => {
  if (!assignment) return "";
  const names = [
    ...new Set(
      (Array.isArray(assignment.scopeTree) ? assignment.scopeTree : [])
        .map((unit) => String(unit?.name || "").trim())
        .filter(Boolean),
    ),
  ];
  if (names.length > 0) return names.join(" • ");
  return String((assignment as any)?.unitName || "").trim();
};

const testAssignmentScopeName = (assignment: AssignmentSummary) => {
  const tree = Array.isArray(assignment.scopeTree) ? assignment.scopeTree : [];
  const targetUnit = tree.find((unit) =>
    assignment.unitId ? String(unit?.id || "") === String(assignment.unitId) : true,
  ) || tree[0];

  if (String(assignment.testType || "").toLowerCase() === "unit") {
    return String(targetUnit?.name || (assignment as any)?.unitName || "").trim();
  }

  const topics = Array.isArray(targetUnit?.topics) ? targetUnit.topics : [];
  const targetTopic = topics.find((topic) =>
    assignment.topicId ? String(topic?.id || "") === String(assignment.topicId) : true,
  ) || topics[0];

  if (String(assignment.testType || "").toLowerCase() === "topic") {
    return String(targetTopic?.name || (assignment as any)?.topicName || "").trim();
  }

  const outcomes = Array.isArray(targetTopic?.outcomes) ? targetTopic.outcomes : [];
  const targetOutcome = outcomes.find((outcome) =>
    assignment.outcomeId ? String(outcome?.id || "") === String(assignment.outcomeId) : true,
  ) || outcomes[0];

  return String(
    targetOutcome?.name ||
      (assignment as any)?.outcomeName ||
      targetTopic?.name ||
      targetUnit?.name ||
      "",
  ).trim();
};

const testAssignmentSequence = (assignment: AssignmentSummary) => {
  const explicit =
    (assignment as any)?.testNumber ??
    (assignment as any)?.testNo ??
    (assignment as any)?.testSequence ??
    (assignment as any)?.sequence;
  if (Number.isFinite(Number(explicit)) && Number(explicit) > 0) {
    return String(Math.floor(Number(explicit)));
  }

  // Test Tanımla ekranındaki mevcut kural test adını kapsam adı + sıra numarası
  // biçiminde kaydeder. Öğretmen kartı da aynı sıra numarasını kullanır.
  const match = String(assignment.testName || "").match(/(\d+)\s*$/);
  return match?.[1] || "";
};

const testAssignmentSubtitle = (assignment: AssignmentSummary) => {
  const scopeName = testAssignmentScopeName(assignment) ||
    String(assignment.testName || "").replace(/\s+\d+\s*$/, "").trim();
  const sequence = testAssignmentSequence(assignment);
  return [scopeName, sequence ? `Test ${sequence}` : ""].filter(Boolean).join(" • ");
};

const testAssignmentGradeLabel = (assignment: AssignmentSummary) => {
  const raw = String(assignment.grade || "").trim();
  if (!raw) return "";

  const numericMatch = raw.match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
  if (numericMatch?.[1]) return `${numericMatch[1]}. Sınıf`;

  if (/sınıf/i.test(raw)) return raw;
  return `${raw}. Sınıf`;
};

function tokenFromLocation() {
  const pathToken = decodeURIComponent(
    window.location.pathname.match(/^\/t\/([^/]+)\/?$/)?.[1] || "",
  );
  return (
    pathToken ||
    new URLSearchParams(window.location.search).get("token") ||
    ""
  );
}

async function fetchJsonWithTimeout<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const attempt = async (url: string, ms: number) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(
            body?.error ||
              `Sunucu isteği başarısız (${response.status}).`,
          ),
        );
      }

      return body as T;
    } finally {
      window.clearTimeout(timer);
    }
  };

  try {
    return await attempt(path, timeoutMs);
  } catch (firstError) {
    // Telefonda localhost kullanmıyoruz. Yalnız aynı yerel ağda HTTP ile
    // çalışıyorsak bilgisayarın gerçek hostname/IP adresindeki 8787 API'yi
    // ikinci yol olarak deneyebiliriz.
    const canUseDirectLanFallback =
      window.location.protocol === "http:" &&
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    if (!canUseDirectLanFallback) throw firstError;

    const directUrl =
      `http://${window.location.hostname}:8787` +
      (path.startsWith("/") ? path : `/${path}`);

    try {
      return await attempt(directUrl, 4500);
    } catch {
      throw firstError;
    }
  }
}

function Header({
  title,
  subtitle,
  onBack,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-h-[48px] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95"
          aria-label="Geri"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <ClipboardCheck className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-black text-slate-950">{title}</h1>
          <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
            {subtitle}
          </div>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-amber-600 shadow-sm transition active:scale-95 disabled:opacity-50"
            aria-label="Yenile"
          >
            <RefreshCw
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        ) : null}
      </div>
      <div className="-mx-4 mt-3 h-px bg-amber-200" />
    </header>
  );
}

function ErrorCard({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <div className="mt-3 text-sm font-black text-rose-900">
        Görevler alınamadı
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-rose-700">
        {message}
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-4 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black text-white"
      >
        Yeniden Dene
      </button>
    </div>
  );
}

export default function TeacherQuestionSelectionView({
  token: propToken,
  teacherName,
  onBack,
}: Props) {
  const token = React.useMemo(
    () => String(propToken || tokenFromLocation() || ""),
    [propToken],
  );

  const [assignments, setAssignments] = React.useState<AssignmentSummary[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
  const [assignmentsError, setAssignmentsError] = React.useState("");

  const [detail, setDetail] = React.useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");

  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [committedKeys, setCommittedKeys] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<AssignmentFilter>(null);
  const [scopeTreeOpen, setScopeTreeOpen] = React.useState(false);
  const [showSelectionSummary, setShowSelectionSummary] = React.useState(false);
  // Mobil ekranda kapsam tıklandığında soru bankasını doğrudan sunucudan da okuruz.
  // Görev kaydındaki snapshot havuzu eski/boş olsa bile öğretmen güncel soruları görebilir.
  const [liveScopeQuestions, setLiveScopeQuestions] = React.useState<QuestionSnapshot[]>([]);
  const [liveScopeLoading, setLiveScopeLoading] = React.useState(false);
  const [liveScopeError, setLiveScopeError] = React.useState("");
  // Test açıldığında dersin soru bankasını bir kez yükle. Böylece hem havuz sayıları
  // kapsam listesindeyken görünür hem de konu/kazanıma dokununca aynı veri açılır.
  const [assignmentBankQuestions, setAssignmentBankQuestions] = React.useState<QuestionSnapshot[]>([]);
  const [, setAssignmentBankLoading] = React.useState(false);
  const [questionAction, setQuestionAction] = React.useState<{
    question: QuestionSnapshot;
    unit: AssignmentScopeUnit;
    topic: AssignmentScopeTopic;
    outcome: AssignmentScopeOutcome;
  } | null>(null);
  const [questionActionBusy, setQuestionActionBusy] = React.useState(false);
  const [questionActionError, setQuestionActionError] = React.useState("");
  const longPressRef = React.useRef<{ timer: number | null; x: number; y: number; key: string }>({
    timer: null, x: 0, y: 0, key: "",
  });
  const suppressQuestionClickRef = React.useRef(false);

  const revisionRef = React.useRef(0);

  const loadAssignments = React.useCallback(async () => {
    if (!token) {
      setAssignmentsError("Öğretmen bağlantı anahtarı bulunamadı.");
      setAssignmentsLoading(false);
      return;
    }

    setAssignmentsLoading(true);
    setAssignmentsError("");

    try {
      const rows = await fetchJsonWithTimeout<AssignmentSummary[]>(
        `/api/behavior/teacher-links/${encodeURIComponent(
          token,
        )}/question-assignments`,
      );
      // Açık görev listesinin tamamlanma kararı sunucuda verilir. İstemci tarafında
      // selectionStatus alanını tekrar filtrelemek, eski bir seçim kaydındaki
      // "completed" değerinin yeni görevlendirmeyi yanlışlıkla gizlemesine yol açıyordu.
      const openRows = (Array.isArray(rows) ? rows : []).filter(
        (assignment: any) => !assignment?.completedAt,
      );
      const hydratedRows = await Promise.all(
        openRows.map(async (assignment: AssignmentSummary) => {
          try {
            const liveTree = await fetchCurrentAssignmentCurriculumTree(assignment);
            return scopeTreeHasContent(liveTree)
              ? { ...assignment, scopeTree: liveTree as AssignmentScopeUnit[] }
              : assignment;
          } catch {
            return assignment;
          }
        }),
      );
      setAssignments(hydratedRows);
    } catch (error) {
      setAssignments([]);
      setAssignmentsError(
        error instanceof Error
          ? error.message
          : "Görev listesi okunamadı.",
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadAssignments();

    // Yönetici sınavı sildiğinde öğretmenin açık telefon ekranında görev
    // beklemeden düşsün. Uygulama yeniden öne geldiğinde ve kısa aralıklarla
    // ortak görev koleksiyonunu tekrar kontrol ederiz.
    const refresh = () => { void loadAssignments(); };
    const onVisibility = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [loadAssignments]);

  React.useEffect(() => {
    if (!detail || assignmentsLoading) return;
    const stillExists = assignments.some((item) => String(item.id || "") === String(detail.id || ""));
    if (!stillExists) {
      setDetail(null);
      setSelectedKeys([]);
      setCommittedKeys([]);
      setActiveFilter(null);
      setScopeTreeOpen(false);
      setNotice("");
    }
  }, [assignments, assignmentsLoading, detail]);

  const openAssignment = async (assignmentId: string) => {
    setDetailLoading(true);
    setDetailError("");
    setNotice("");

    try {
      const publicDetail = await fetchJsonWithTimeout<AssignmentDetail>(
        `/api/behavior/teacher-links/${encodeURIComponent(
          token,
        )}/question-assignments/${encodeURIComponent(assignmentId)}`,
      );

      // Gerçek neden: öğretmen-link detay endpoint'i bazı sürümlerde görev özetini
      // döndürüyor fakat availableQuestionSnapshots / scopeTree.questions alanlarını
      // taşımıyor. Bu yüzden kapsam adları görünürken soru listesi boş kalıyordu.
      // Aynı görevin ham teacherTestAssignments kaydını da okuyup soru havuzunu
      // eksiksiz birleştiriyoruz. Liste endpoint'i çalıştığı sürece bu istek de aynı
      // Enstitü API'sine gider; telefon tarafında ayrı/yerel bir soru kaynağı yoktur.
      let rawAssignment: any = null;
      try {
        const rawResponse = await fetchJsonWithTimeout<any>(
          `/api/database/collections/teacherTestAssignments/${encodeURIComponent(assignmentId)}`,
        );
        rawAssignment = rawResponse?.data || rawResponse?.item || rawResponse?.record || rawResponse;
      } catch {
        rawAssignment = null;
      }

      const assignmentEnvelope = {
        ...(publicDetail as any),
        ...(rawAssignment && typeof rawAssignment === "object" && !Array.isArray(rawAssignment)
          ? rawAssignment
          : {}),
      };

      // KALICI ÇÖZÜM: Müfredat isimleri teacherTestAssignments snapshot'ından
      // okunmaz. Telefon görevi açtığı anda sunucudaki tek courseCurriculums
      // kaynağını okur ve görev kapsamını (ünite/konu/kazanım) o canlı ağaç
      // üzerinde uygular. Böylece yönetici müfredatı değiştirdiğinde eski
      // kazanımlar telefon görevinde yaşamaya devam edemez.
      // V9: mobil ekran müfredatı doğrudan courseCurriculums kayıt metadata'sına
      // göre çözer. Görevdeki scopeTree/curriculumScopeTree ASLA ekran kaynağı değildir.
      // Canlı müfredat bulunamazsa eski snapshot'ı göstermek yerine açık hata veririz.
      const liveCurriculumTree = await fetchCurrentAssignmentCurriculumTree(
        assignmentEnvelope,
      ) as AssignmentScopeUnit[];
      if (!scopeTreeHasContent(liveCurriculumTree)) {
        throw new Error(
          `${String(assignmentEnvelope?.grade || "").trim()} ${String(assignmentEnvelope?.courseName || assignmentEnvelope?.subject || "").trim()} için güncel müfredat sunucuda bulunamadı. Yönetici Müfredat Oluştur ekranında dersi bir kez kaydetmelidir.`.trim(),
        );
      }

      const mergedScopeTree = mergeAssignmentScopeTrees(liveCurriculumTree);

      const next: AssignmentDetail = {
        ...(publicDetail as any),
        ...(rawAssignment && typeof rawAssignment === "object" && !Array.isArray(rawAssignment) ? rawAssignment : {}),
        // Hiçbir zaman "sorusu var mı?" filtresine göre kazanım düşürme.
        scopeTree: mergedScopeTree,
        curriculumScopeTree: mergedScopeTree,
        // V9: eski görev havuzu ekranda kullanılmaz. Kullanılabilir soru sayıları
        // yalnız canlı canonical soru bankasından hesaplanır.
        availableQuestionSnapshots: [],
        selectedQuestionSnapshots: Array.isArray(publicDetail.selectedQuestionSnapshots)
          ? publicDetail.selectedQuestionSnapshots
          : [],
        selectedQuestionKeys: Array.isArray(publicDetail.selectedQuestionKeys)
          ? publicDetail.selectedQuestionKeys
          : [],
        committedQuestionKeys: Array.isArray(publicDetail.committedQuestionKeys)
          ? publicDetail.committedQuestionKeys
          : [],
      };

      const initialKeys = Array.isArray(next.selectedQuestionKeys)
        ? [...new Set(next.selectedQuestionKeys.map(String))]
        : [];

      revisionRef.current = Math.max(
        0,
        Number(next.selectionRevision || 0),
      );

      const initialCommittedKeys = Array.isArray(next.committedQuestionKeys)
        ? [...new Set(next.committedQuestionKeys.map(String))]
        : [];

      setSelectedKeys(initialKeys);
      setCommittedKeys(initialCommittedKeys);
      setDetail(next);

      // Teste ilk girişte doğrudan soru havuzunu açma; önce görev kapsamlarını göster.
      setActiveFilter(null);
      setScopeTreeOpen(true);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Görev ayrıntısı okunamadı.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // Yönetici müfredatı değiştirdikten sonra öğretmen görevi açık kalsa bile
  // canlı courseCurriculums koleksiyonunu periyodik olarak kontrol et. Artık
  // assignment snapshot'ının güncellenmesini beklemeyiz; telefon doğrudan tek
  // kaynaktan güncel ünite-konu-kazanım ağacını alır. Soru seçimleri korunur.
  React.useEffect(() => {
    const assignmentId = String(detail?.id || "").trim();
    if (!assignmentId) return;

    let disposed = false;
    let refreshingSnapshot = false;

    const refreshCurrentCurriculumSnapshot = async () => {
      if (disposed || refreshingSnapshot) return;
      refreshingSnapshot = true;
      try {
        const liveTree = await fetchCurrentAssignmentCurriculumTree(
          detail,
        ) as AssignmentScopeUnit[];
        if (!scopeTreeHasContent(liveTree) || disposed) return;

        const nextTree = mergeAssignmentScopeTrees(liveTree);
        const previousFingerprint = scopeTreeFingerprint(detail?.scopeTree);
        const nextFingerprint = scopeTreeFingerprint(nextTree);
        if (!nextFingerprint || previousFingerprint === nextFingerprint) return;

        setDetail((previous) => {
          if (!previous || String(previous.id || "") !== assignmentId) return previous;
          return {
            ...previous,
            scopeTree: nextTree,
            curriculumScopeTree: nextTree,
            curriculumSnapshotVersion: Date.now(),
            curriculumSnapshotUpdatedAt: new Date().toISOString(),
          } as AssignmentDetail;
        });
        // Seçili soru anahtarlarına dokunma. Yalnız görünür kapsamı başa al ki
        // silinmiş eski bir kazanımın ekranında kalınmasın.
        setActiveFilter(null);
        setScopeTreeOpen(true);
        setNotice("Müfredat güncellendi. Güncel konu ve kazanımlar yüklendi.");
      } catch {
        // Arka plan senkronu sessizdir; normal görev akışını kesmez.
      } finally {
        refreshingSnapshot = false;
      }
    };

    const onFocus = () => { void refreshCurrentCurriculumSnapshot(); };
    const onVisibility = () => { if (!document.hidden) void refreshCurrentCurriculumSnapshot(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => { void refreshCurrentCurriculumSnapshot(); }, 15000);
    void refreshCurrentCurriculumSnapshot();

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [detail?.id, scopeTreeFingerprint(detail?.scopeTree)]);

  const questions = React.useMemo(() => {
    const unique = new Map<string, QuestionSnapshot>();

    const addQuestion = (question: QuestionSnapshot | null | undefined) => {
      if (!question) return;
      const key = questionIdentity(question);
      if (key && !unique.has(key)) unique.set(key, question);
    };

    const availableRows = Array.isArray(detail?.availableQuestionSnapshots)
      ? detail!.availableQuestionSnapshots!
      : [];

    availableRows.forEach(addQuestion);

    const units = Array.isArray(detail?.scopeTree) ? detail!.scopeTree! : [];
    units.forEach((unit) => {
      (unit.topics || []).forEach((topic) => {
        (topic.outcomes || []).forEach((outcome) => {
          (outcome.questions || []).forEach((question) => {
            /*
             * ScopeTree düğümündeki bağlam bilgisi eksikse burada tamamlarız.
             * Böylece öğretmen ekranındaki filtre her zaman müfredat ağacıyla
             * aynı unit/topic/outcome kimliklerini kullanır.
             */
            addQuestion({
              ...question,
              unitId: question.unitId || unit.id,
              unitName: question.unitName || unit.name,
              topicId: question.topicId || topic.id,
              topicName: question.topicName || topic.name,
              outcomeId: question.outcomeId || outcome.id,
              outcomeName: question.outcomeName || outcome.name,
            });
          });
        });
      });
    });

    return [...unique.values()];
  }, [detail]);

  const scopeUnits = React.useMemo(
    () => (Array.isArray(detail?.scopeTree) ? detail!.scopeTree! : []),
    [detail],
  );

  const allKnownQuestions = React.useMemo(() => {
    const unique = new Map<string, QuestionSnapshot>();
    const addRows = (rows: QuestionSnapshot[] | undefined) => {
      (Array.isArray(rows) ? rows : []).forEach((question) => {
        const key = questionIdentity(question);
        if (key) unique.set(key, question);
      });
    };

    addRows(questions);
    addRows(assignmentBankQuestions);
    addRows(liveScopeQuestions);
    addRows(detail?.selectedQuestionSnapshots);

    return [...unique.values()];
  }, [questions, assignmentBankQuestions, liveScopeQuestions, detail?.selectedQuestionSnapshots]);

  const questionByKey = React.useMemo(() => {
    const map = new Map<string, QuestionSnapshot>();
    allKnownQuestions.forEach((question) => {
      const key = questionIdentity(question);
      if (key) map.set(key, question);
    });
    return map;
  }, [allKnownQuestions]);

  const fileGroupLeaderKey = React.useCallback((groupId: string) => {
    if (!isFileNameQuestionGroup(groupId)) return "";
    const members = allKnownQuestions
      .filter((question) => questionGroupIdOf(question) === groupId)
      .sort((left, right) =>
        questionGroupOrderOf(left) - questionGroupOrderOf(right) ||
        questionIdentity(left).localeCompare(questionIdentity(right), "tr-TR", { numeric: true }),
      );
    return members.length >= 2 ? questionIdentity(members[0]) : "";
  }, [allKnownQuestions]);

  const isNonNumberedGroupLeaderKey = React.useCallback((key: string) => {
    const question = questionByKey.get(String(key));
    if (!question) return false;
    const groupId = questionGroupIdOf(question);
    if (!groupId || !isFileNameQuestionGroup(groupId)) return false;
    return fileGroupLeaderKey(groupId) === String(key);
  }, [questionByKey, fileGroupLeaderKey]);

  const effectiveSelectedCount = React.useCallback((keys: string[]) =>
    keys.reduce((count, key) => count + (isNonNumberedGroupLeaderKey(String(key)) ? 0 : 1), 0),
  [isNonNumberedGroupLeaderKey]);

  React.useEffect(() => {
    if (!detail) {
      setAssignmentBankQuestions([]);
      setAssignmentBankLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadAssignmentBank = async () => {
      setAssignmentBankLoading(true);
      try {
        // Canonical soru bankası endpoint'i tek istekte en fazla 500 kayıt döndürür.
        // Tüm sayfaları okuyarak sayaçların eski snapshot veya ilk 500 kayıtla
        // sınırlı kalmasını engelliyoruz.
        const records: any[] = [];
        let offset = 0;
        const pageSize = 500;
        for (let page = 0; page < 40; page += 1) {
          const params = new URLSearchParams();
          params.set("status", "active");
          params.set("usage", "unused");
          params.set("limit", String(pageSize));
          params.set("offset", String(offset));
          if (detail.grade) params.set("grade", String(detail.grade));
          const payload = await fetchJsonWithTimeout<any>(`/api/question-bank/questions?${params.toString()}`);
          const pageRows = Array.isArray(payload) ? payload : Array.isArray(payload?.questions) ? payload.questions : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.records) ? payload.records : Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : [];
          records.push(...pageRows);
          const total = Number(payload?.total ?? records.length);
          if (pageRows.length < pageSize || records.length >= total) break;
          offset += pageRows.length;
        }
        const rows = records.map((record: any) => ({
          ...record,
          id: String(record.questionId || record.question_id || record.id || record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
          questionId: String(record.questionId || record.question_id || record.id || ""),
          questionCode: String(record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
          code: String(record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
          unitId: String(record.unitId || record.unit_id || ""), unitName: String(record.unitName || record.unit_name || record.unit || ""),
          topicId: String(record.topicId || record.topic_id || ""), topicName: String(record.topicName || record.topic_name || record.topic || ""),
          outcomeId: String(record.outcomeId || record.outcome_id || ""), outcomeName: String(record.outcomeName || record.outcome_name || record.outcome || ""),
          imageUrl: String(record.imageUrl || record.image_url || ""), thumbnailUrl: String(record.thumbnailUrl || record.thumbnail_url || ""),
          storagePath: String(record.storagePath || record.storage_path || ""),
        }));

        const unitIds = new Set<string>();
        const unitNames = new Set<string>();
        const topicIds = new Set<string>();
        const topicNames = new Set<string>();
        const outcomeIds = new Set<string>();
        const outcomeNames = new Set<string>();
        (Array.isArray(detail.scopeTree) ? detail.scopeTree : []).forEach((unit) => {
          if (unit?.id) unitIds.add(normalizeScopeId(unit.id));
          if (unit?.name) unitNames.add(normalizeScopeText(unit.name));
          (unit?.topics || []).forEach((topic) => {
            if (topic?.id) topicIds.add(normalizeScopeId(topic.id));
            if (topic?.name) topicNames.add(normalizeScopeText(topic.name));
            (topic?.outcomes || []).forEach((outcome) => {
              if (outcome?.id) outcomeIds.add(normalizeScopeId(outcome.id));
              if (outcome?.name) outcomeNames.add(normalizeScopeText(outcome.name));
            });
          });
        });

        const targetCourseName = normalizeScopeText(detail.courseName || detail.subject);
        const filteredRows = rows.filter((record: any) => {
          const rowCourseName = normalizeScopeText(record.courseName || record.course_name || record.subject || record.lessonName);
          if (targetCourseName && rowCourseName && targetCourseName !== rowCourseName) return false;

          const outcomeMatch =
            (record.outcomeId && outcomeIds.has(normalizeScopeId(record.outcomeId))) ||
            (record.outcomeName && outcomeNames.has(normalizeScopeText(record.outcomeName)));
          if (outcomeMatch) return true;

          const topicMatch =
            (record.topicId && topicIds.has(normalizeScopeId(record.topicId))) ||
            (record.topicName && topicNames.has(normalizeScopeText(record.topicName)));
          if (topicMatch) return true;

          const unitMatch =
            (record.unitId && unitIds.has(normalizeScopeId(record.unitId))) ||
            (record.unitName && unitNames.has(normalizeScopeText(record.unitName)));
          return unitMatch || (unitIds.size === 0 && topicIds.size === 0 && outcomeIds.size === 0);
        });

        setAssignmentBankQuestions(filteredRows);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setAssignmentBankQuestions([]);
      } finally { if (!controller.signal.aborted) setAssignmentBankLoading(false); }
    };
    void loadAssignmentBank();
    return () => controller.abort();
  }, [detail]);

  React.useEffect(() => {
    if (!detail || !activeFilter) {
      setLiveScopeQuestions([]);
      setLiveScopeError("");
      setLiveScopeLoading(false);
      return;
    }

    const controller = new AbortController();

    const rowsFromPayload = (payload: any): any[] =>
      Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.questions)
          ? payload.questions
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.records)
              ? payload.records
              : Array.isArray(payload?.rows)
                ? payload.rows
                : Array.isArray(payload?.data)
                  ? payload.data
                  : [];

    const toSnapshot = (record: any): QuestionSnapshot => ({
      ...record,
      id: String(record.questionId || record.question_id || record.id || record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
      questionId: String(record.questionId || record.question_id || record.id || ""),
      questionCode: String(record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
      code: String(record.questionCode || record.question_code || record.code || record.fileName || record.file_name || ""),
      unitId: String(record.unitId || record.unit_id || ""),
      unitName: String(record.unitName || record.unit_name || record.unit || ""),
      topicId: String(record.topicId || record.topic_id || ""),
      topicName: String(record.topicName || record.topic_name || record.topic || ""),
      outcomeId: String(record.outcomeId || record.outcome_id || ""),
      outcomeName: String(record.outcomeName || record.outcome_name || record.outcome || ""),
      imageUrl: String(record.imageUrl || record.image_url || record.imageDataUrl || record.image_data_url || ""),
      thumbnailUrl: String(record.thumbnailUrl || record.thumbnail_url || ""),
      storagePath: String(record.storagePath || record.storage_path || ""),
    });

    const belongsToActiveScope = (q: QuestionSnapshot) => {
      const id = normalizeScopeId(activeFilter.id);
      const name = normalizeScopeText(activeFilter.name);
      if (activeFilter.type === "outcome") {
        const outcomeOk =
          (!!id && normalizeScopeId(q.outcomeId) === id) ||
          (!!name && normalizeScopeText(q.outcomeName) === name);
        const topicId = normalizeScopeId(activeFilter.topicId);
        const topicName = normalizeScopeText(activeFilter.topicName);
        const topicOk =
          (!topicId && !topicName) ||
          (!!topicId && normalizeScopeId(q.topicId) === topicId) ||
          (!!topicName && normalizeScopeText(q.topicName) === topicName);
        return outcomeOk && topicOk;
      }
      if (activeFilter.type === "topic") {
        return (
          (!!id && normalizeScopeId(q.topicId) === id) ||
          (!!name && normalizeScopeText(q.topicName) === name)
        );
      }
      return (
        (!!id && normalizeScopeId(q.unitId) === id) ||
        (!!name && normalizeScopeText(q.unitName) === name)
      );
    };

    const fetchBank = async (params: URLSearchParams) => {
      const payload = await fetchJsonWithTimeout<any>(`/api/question-bank/questions?${params.toString()}`);
      return rowsFromPayload(payload)
        .filter((record: any) => String(record?.status || "active").toLowerCase() === "active")
        .map(toSnapshot);
    };

    const loadLiveScopeQuestions = async () => {
      setLiveScopeLoading(true);
      setLiveScopeError("");
      try {
        /*
         * Mobil görevdeki courseId/grade değeri eski görevlerde soru bankasındaki
         * canonical değerle aynı olmayabiliyor. Bu nedenle kapsam sorgusunu ders
         * filtresine kilitlemiyoruz; ünite/konu/kazanım kimliği esas alınıyor.
         */
        const scoped = new URLSearchParams();
        scoped.set("status", "active");
        scoped.set("usage", "unused");
        scoped.set("limit", "1000");
        scoped.set("offset", "0");

        if (activeFilter.type === "unit") scoped.set("unitId", String(activeFilter.id || ""));
        if (activeFilter.type === "topic") scoped.set("topicId", String(activeFilter.id || ""));
        if (activeFilter.type === "outcome") scoped.set("outcomeId", String(activeFilter.id || ""));

        let rows = (await fetchBank(scoped)).filter(belongsToActiveScope);

        /*
         * Bazı eski soru kayıtlarında API'nin kapsam parametreleri eşleşmiyor.
         * İlk sorgu boşsa aktif soru bankasını geniş okuyup istemci tarafında
         * ID/ad eşleştirmesi yapıyoruz. Böylece eski görevler de açılabilir.
         */
        if (rows.length === 0) {
          const broad = new URLSearchParams();
          broad.set("status", "active");
          broad.set("usage", "unused");
          broad.set("limit", "5000");
          broad.set("offset", "0");
          rows = (await fetchBank(broad)).filter(belongsToActiveScope);
        }

        const unique = new Map<string, QuestionSnapshot>();
        rows.forEach((row) => {
          const key = questionIdentity(row);
          if (key && !unique.has(key)) unique.set(key, row);
        });
        setLiveScopeQuestions([...unique.values()]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setLiveScopeQuestions([]);
          setLiveScopeError(error instanceof Error ? error.message : "Soru havuzu okunamadı.");
        }
      } finally {
        if (!controller.signal.aborted) setLiveScopeLoading(false);
      }
    };

    void loadLiveScopeQuestions();
    return () => controller.abort();
  }, [detail, activeFilter]);

  const visibleQuestions = React.useMemo(() => {
    if (!activeFilter) return questions;
    // Kapsama tıklanınca canonical soru bankasından gelen canlı sonuç önceliklidir.
    if (liveScopeQuestions.length > 0) return liveScopeQuestions;
    const bankSource = assignmentBankQuestions;

    const units = Array.isArray(detail?.scopeTree) ? detail!.scopeTree! : [];

    if (activeFilter.type === "outcome") {
      for (const unit of units) {
        for (const topic of unit.topics || []) {
          const outcome = (topic.outcomes || []).find(
            (item) =>
              normalizeScopeId(item.id) === normalizeScopeId(activeFilter.id) ||
              normalizeScopeText(item.name) ===
                normalizeScopeText(activeFilter.name),
          );

          if (outcome) {
            const nodeQuestions = Array.isArray(outcome.questions)
              ? outcome.questions
              : [];

            if (nodeQuestions.length > 0) {
              return nodeQuestions.map((question) => ({
                ...question,
                unitId: question.unitId || unit.id,
                unitName: question.unitName || unit.name,
                topicId: question.topicId || topic.id,
                topicName: question.topicName || topic.name,
                outcomeId: question.outcomeId || outcome.id,
                outcomeName: question.outcomeName || outcome.name,
              }));
            }
          }
        }
      }

      const targetOutcomeId = normalizeScopeId(activeFilter.id);
      const targetOutcomeName = normalizeScopeText(activeFilter.name);
      const targetTopicId = normalizeScopeId(activeFilter.topicId);
      const targetTopicName = normalizeScopeText(activeFilter.topicName);

      return bankSource.filter((question) => {
        const questionOutcomeId = normalizeScopeId(question.outcomeId);
        const questionOutcomeName = normalizeScopeText(question.outcomeName);
        const questionTopicId = normalizeScopeId(question.topicId);
        const questionTopicName = normalizeScopeText(question.topicName);

        const outcomeMatches =
          (targetOutcomeId && questionOutcomeId === targetOutcomeId) ||
          (targetOutcomeName && questionOutcomeName === targetOutcomeName);

        const topicMatches =
          (!targetTopicId && !targetTopicName) ||
          (targetTopicId && questionTopicId === targetTopicId) ||
          (targetTopicName && questionTopicName === targetTopicName);

        return Boolean(outcomeMatches && topicMatches);
      });
    }

    if (activeFilter.type === "topic") {
      for (const unit of units) {
        const topic = (unit.topics || []).find(
          (item) =>
            normalizeScopeId(item.id) === normalizeScopeId(activeFilter.id) ||
            normalizeScopeText(item.name) ===
              normalizeScopeText(activeFilter.name),
        );

        if (topic) {
          const topicQuestions: QuestionSnapshot[] = [];
          (topic.outcomes || []).forEach((outcome) => {
            (outcome.questions || []).forEach((question) => {
              topicQuestions.push({
                ...question,
                unitId: question.unitId || unit.id,
                unitName: question.unitName || unit.name,
                topicId: question.topicId || topic.id,
                topicName: question.topicName || topic.name,
                outcomeId: question.outcomeId || outcome.id,
                outcomeName: question.outcomeName || outcome.name,
              });
            });
          });

          if (topicQuestions.length > 0) return topicQuestions;
        }
      }

      const targetTopicId = normalizeScopeId(activeFilter.id);
      const targetTopicName = normalizeScopeText(activeFilter.name);

      return bankSource.filter((question) => {
        const questionTopicId = normalizeScopeId(question.topicId);
        const questionTopicName = normalizeScopeText(question.topicName);

        return Boolean(
          (targetTopicId && questionTopicId === targetTopicId) ||
            (targetTopicName && questionTopicName === targetTopicName),
        );
      });
    }

    if (activeFilter.type === "unit") {
      const targetUnitId = normalizeScopeId(activeFilter.id);
      const targetUnitName = normalizeScopeText(activeFilter.name);

      return bankSource.filter((question) => {
        const questionUnitId = normalizeScopeId(question.unitId);
        const questionUnitName = normalizeScopeText(question.unitName);

        return Boolean(
          (targetUnitId && questionUnitId === targetUnitId) ||
            (targetUnitName && questionUnitName === targetUnitName),
        );
      });
    }

    return [];
  }, [questions, activeFilter, detail, liveScopeQuestions, assignmentBankQuestions]);


  const orderedVisibleQuestions = React.useMemo(() => {
    const matchesActiveFilter = (question: QuestionSnapshot) => {
      if (!activeFilter) return true;
      if (activeFilter.type === "outcome") {
        return (
          normalizeScopeId(question.outcomeId) === normalizeScopeId(activeFilter.id) ||
          (!!activeFilter.name && normalizeScopeText(question.outcomeName) === normalizeScopeText(activeFilter.name))
        );
      }
      if (activeFilter.type === "topic") {
        return (
          normalizeScopeId(question.topicId) === normalizeScopeId(activeFilter.id) ||
          (!!activeFilter.name && normalizeScopeText(question.topicName) === normalizeScopeText(activeFilter.name))
        );
      }
      return (
        normalizeScopeId(question.unitId) === normalizeScopeId(activeFilter.id) ||
        (!!activeFilter.name && normalizeScopeText(question.unitName) === normalizeScopeText(activeFilter.name))
      );
    };

    const unique = new Map<string, QuestionSnapshot>();
    [...visibleQuestions, ...((detail?.selectedQuestionSnapshots || []).filter(matchesActiveFilter))].forEach((question) => {
      const key = questionIdentity(question);
      if (key && !unique.has(key)) unique.set(key, question);
    });

    const sorted = [...unique.values()].sort((a, b) => {
      const aSelected = selectedKeys.includes(questionIdentity(a)) ? 1 : 0;
      const bSelected = selectedKeys.includes(questionIdentity(b)) ? 1 : 0;
      return bSelected - aSelected;
    });
    return groupQuestionsContiguously(sorted);
  }, [visibleQuestions, detail?.selectedQuestionSnapshots, activeFilter, selectedKeys]);

  const selectedDistribution = React.useMemo(() => {
    const selected = selectedKeys
      .map((key) => questionByKey.get(String(key)))
      .filter(Boolean) as QuestionSnapshot[];

    return scopeUnits.map((unit) => ({
      id: unit.id,
      name: unit.name,
      count: selected.filter(
        (question) => String(question.unitId || "") === String(unit.id),
      ).length,
      topics: (unit.topics || []).map((topic) => ({
        id: topic.id,
        name: topic.name,
        count: selected.filter(
          (question) => String(question.topicId || "") === String(topic.id),
        ).length,
        outcomes: (topic.outcomes || []).map((outcome) => ({
          id: outcome.id,
          name: outcome.name,
          count: selected.filter(
            (question) =>
              String(question.outcomeId || "") === String(outcome.id),
          ).length,
        })),
      })),
    }));
  }, [scopeUnits, selectedKeys, questionByKey]);

  const selectedCountForUnit = React.useCallback(
    (unitId: string) =>
      selectedKeys.reduce((count, key) => {
        const question = questionByKey.get(String(key));
        return (
          count +
          (String(question?.unitId || "") === String(unitId) ? 1 : 0)
        );
      }, 0),
    [selectedKeys, questionByKey],
  );

  const selectedCountForTopic = React.useCallback(
    (topicId: string) =>
      selectedKeys.reduce((count, key) => {
        const question = questionByKey.get(String(key));
        return (
          count +
          (String(question?.topicId || "") === String(topicId) ? 1 : 0)
        );
      }, 0),
    [selectedKeys, questionByKey],
  );

  const selectedCountForOutcome = React.useCallback(
    (outcomeId: string) =>
      selectedKeys.reduce((count, key) => {
        const question = questionByKey.get(String(key));
        return (
          count +
          (String(question?.outcomeId || "") === String(outcomeId) ? 1 : 0)
        );
      }, 0),
    [selectedKeys, questionByKey],
  );

  const activeOutcomeContext = React.useMemo(() => {
    if (!activeFilter || activeFilter.type !== "outcome") return null;
    for (const unit of scopeUnits) {
      for (const topic of unit.topics || []) {
        const outcome = (topic.outcomes || []).find((item) =>
          normalizeScopeId(item.id) === normalizeScopeId(activeFilter.id) ||
          (!!activeFilter.name && normalizeScopeText(item.name) === normalizeScopeText(activeFilter.name)),
        );
        if (outcome) return { unit, topic, outcome };
      }
    }
    return null;
  }, [activeFilter, scopeUnits]);

  const effectiveScopes = React.useMemo<AssignmentScopePlan[]>(() => {
    if (!detail) return [];
    const anyDetail = detail as any;
    const candidates = [detail.scopes, detail.selectionScopes, detail.questionScopes, detail.questionPlan, detail.plan, detail.requirements];
    const rows = candidates.find((value) => Array.isArray(value) && value.length > 0) as AssignmentScopePlan[] | undefined;
    if (rows) {
      return rows.map((scope: any) => ({
        ...scope,
        unitId: scope.unitId ?? scope.unit_id, unitName: scope.unitName ?? scope.unit_name ?? scope.unit,
        topicId: scope.topicId ?? scope.topic_id, topicName: scope.topicName ?? scope.topic_name ?? scope.topic,
        outcomeId: scope.outcomeId ?? scope.outcome_id, outcomeName: scope.outcomeName ?? scope.outcome_name ?? scope.outcome,
        count: Number(scope.count ?? scope.questionCount ?? scope.requiredQuestionCount ?? scope.question_count ?? 0),
      }));
    }
    // Bazı sunucu sürümleri soru adetlerini doğrudan scopeTree düğümlerinde taşır.
    const inferred: AssignmentScopePlan[] = [];
    (Array.isArray(detail.scopeTree) ? detail.scopeTree : []).forEach((unit: any) => {
      const unitCount = Number(unit.count ?? unit.questionCount ?? unit.requiredQuestionCount ?? unit.required_count ?? 0);
      if (unitCount > 0) inferred.push({ unitId: unit.id, unitName: unit.name, count: unitCount });
      (unit.topics || []).forEach((topic: any) => {
        const topicCount = Number(topic.count ?? topic.questionCount ?? topic.requiredQuestionCount ?? topic.required_count ?? 0);
        if (topicCount > 0) inferred.push({ unitId: unit.id, unitName: unit.name, topicId: topic.id, topicName: topic.name, count: topicCount });
        (topic.outcomes || []).forEach((outcome: any) => {
          const outcomeCount = Number(outcome.count ?? outcome.questionCount ?? outcome.requiredQuestionCount ?? outcome.required_count ?? 0);
          if (outcomeCount > 0) inferred.push({ unitId: unit.id, unitName: unit.name, topicId: topic.id, topicName: topic.name, outcomeId: outcome.id, outcomeName: outcome.name, count: outcomeCount });
        });
      });
    });
    if (inferred.length) return inferred;
    // Eski/tek-kapsamlı görev kayıtları için geriye dönük uyumluluk.
    if (detail.outcomeId || detail.topicId || detail.unitId) {
      return [{
        unitId: detail.unitId, topicId: detail.topicId, outcomeId: detail.outcomeId,
        unitName: anyDetail.unitName, topicName: anyDetail.topicName, outcomeName: anyDetail.outcomeName,
        count: assignmentUsesFlexibleCount(detail)
          ? 0
          : Number(detail.requiredQuestionCount ?? detail.maxQuestionCount ?? 0),
      }];
    }
    return [];
  }, [detail]);

  const scopeRequirement = React.useCallback((filter: AssignmentFilter) => {
    if (!filter || assignmentUsesFlexibleCount(detail)) return 0;
    const norm = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
    const match = effectiveScopes.find((scope) => {
      if (filter.type === "outcome") {
        return (
          (scope.outcomeId && String(scope.outcomeId) === String(filter.id)) ||
          (!!filter.name && norm(scope.outcomeName) === norm(filter.name))
        );
      }
      if (filter.type === "topic") {
        return !scope.outcomeId && (
          (scope.topicId && String(scope.topicId) === String(filter.id)) ||
          (!!filter.name && norm(scope.topicName) === norm(filter.name))
        );
      }
      return !scope.topicId && (
        (scope.unitId && String(scope.unitId) === String(filter.id)) ||
        (!!filter.name && norm(scope.unitName) === norm(filter.name))
      );
    });
    if (match) return Math.max(0, Number(match?.count ?? match?.questionCount ?? match?.requiredQuestionCount ?? 0));

    // Görev endpoint'i `scopes` alanını eksik/eskimiş döndürse bile ekrandaki
    // scopeTree düğümünde yazılı soru adedini kullan. Önceki kod 0 döndürdüğü
    // için butonu disabled yapıyor ve kazanıma dokununca hiçbir ekran açılmıyordu.
    for (const unit of (Array.isArray(detail?.scopeTree) ? detail!.scopeTree! : [])) {
      if (filter.type === "unit" && (String(unit.id) === String(filter.id) || (!!filter.name && norm(unit.name) === norm(filter.name)))) {
        return Math.max(0, Number((unit as any).requiredQuestionCount ?? (unit as any).questionCount ?? (unit as any).count ?? 0));
      }
      for (const topic of unit.topics || []) {
        if (filter.type === "topic" && (String(topic.id) === String(filter.id) || (!!filter.name && norm(topic.name) === norm(filter.name)))) {
          return Math.max(0, Number((topic as any).requiredQuestionCount ?? (topic as any).questionCount ?? (topic as any).count ?? 0));
        }
        for (const outcome of topic.outcomes || []) {
          if (filter.type === "outcome" && (String(outcome.id) === String(filter.id) || (!!filter.name && norm(outcome.name) === norm(filter.name)))) {
            return Math.max(0, Number((outcome as any).requiredQuestionCount ?? (outcome as any).questionCount ?? (outcome as any).count ?? 0));
          }
        }
      }
    }
    return 0;
  }, [effectiveScopes, detail]);

  const poolCountForFilter = React.useCallback((filter: AssignmentFilter) => {
    if (!filter) return 0;
    const norm = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
    // V9: payda yalnız CANLI canonical soru bankasından gelir. Eski görevdeki
    // availableQuestionSnapshots veya scopeTree.questions hiçbir şekilde sayaca
    // eklenmez; böylece eski 183/67 gibi sayılar tekrar görünemez.
    const uniqueSource = new Map<string, QuestionSnapshot>();
    assignmentBankQuestions.forEach((question, index) => {
      const key = questionIdentity(question) || `pool-${index}-${String(question?.code || "")}`;
      if (!uniqueSource.has(key)) uniqueSource.set(key, question);
    });
    const source = [...uniqueSource.values()];
    const matched = source.filter((q) => {
      if (filter.type === "outcome") {
        return String(q.outcomeId || "") === String(filter.id) || (!!filter.name && norm(q.outcomeName) === norm(filter.name));
      }
      if (filter.type === "topic") {
        return String(q.topicId || "") === String(filter.id) || (!!filter.name && norm(q.topicName) === norm(filter.name));
      }
      return String(q.unitId || "") === String(filter.id) || (!!filter.name && norm(q.unitName) === norm(filter.name));
    }).length;
    return matched;
  }, [assignmentBankQuestions]);

  const selectedCountForFilter = React.useCallback((filter: AssignmentFilter) => {
    if (!filter) return 0;
    return selectedKeys.reduce((count, key) => {
      if (isNonNumberedGroupLeaderKey(String(key))) return count;
      const q = questionByKey.get(String(key));
      if (!q) return count;
      if (filter.type === "outcome") return count + (String(q.outcomeId || "") === String(filter.id) ? 1 : 0);
      if (filter.type === "topic") return count + (String(q.topicId || "") === String(filter.id) ? 1 : 0);
      return count + (String(q.unitId || "") === String(filter.id) ? 1 : 0);
    }, 0);
  }, [selectedKeys, questionByKey, isNonNumberedGroupLeaderKey]);

  const flexibleCount = assignmentUsesFlexibleCount(detail);

  const requiredCount = assignmentRequiredCount(detail);
  const maxCount = assignmentMaxCount(detail);
  const selectedEffectiveCount = effectiveSelectedCount(selectedKeys);
  const activeRequiredCount = scopeRequirement(activeFilter);
  const activeSelectedCount = selectedCountForFilter(activeFilter);

  const keysForFilter = React.useCallback((
    keys: string[],
    filter: AssignmentFilter,
  ) => {
    if (!filter) return [];
    return keys.filter((key) => {
      const q = questionByKey.get(String(key));
      if (!q) return false;
      if (filter.type === "outcome") {
        return normalizeScopeId(q.outcomeId) === normalizeScopeId(filter.id) ||
          (!!filter.name && normalizeScopeText(q.outcomeName) === normalizeScopeText(filter.name));
      }
      if (filter.type === "topic") {
        return normalizeScopeId(q.topicId) === normalizeScopeId(filter.id) ||
          (!!filter.name && normalizeScopeText(q.topicName) === normalizeScopeText(filter.name));
      }
      return normalizeScopeId(q.unitId) === normalizeScopeId(filter.id) ||
        (!!filter.name && normalizeScopeText(q.unitName) === normalizeScopeText(filter.name));
    });
  }, [questionByKey]);

  const activeSelectedKeys = React.useMemo(
    () => keysForFilter(selectedKeys, activeFilter),
    [selectedKeys, activeFilter, keysForFilter],
  );

  const activeCommittedKeys = React.useMemo(
    () => keysForFilter(committedKeys, activeFilter),
    [committedKeys, activeFilter, keysForFilter],
  );

  const activePendingKeys = React.useMemo(() => {
    const committed = new Set(activeCommittedKeys);
    return activeSelectedKeys.filter((key) => !committed.has(key));
  }, [activeSelectedKeys, activeCommittedKeys]);

  const sendActiveSelection = async () => {
    if (!detail || !activeFilter || saving || activePendingKeys.length === 0) return;

    const nextRevision = revisionRef.current + 1;
    revisionRef.current = nextRevision;

    const committedSet = new Set(committedKeys);
    const keysToSend = activeSelectedKeys.filter((key) => !committedSet.has(key));
    const serverSelectedKeys = [...new Set([...committedKeys, ...keysToSend])];
    const serverKeySet = new Set(serverSelectedKeys);
    const snapshots = allKnownQuestions.filter((question) =>
      serverKeySet.has(questionIdentity(question)),
    );

    setSaving(true);
    setNotice("");
    try {
      const response = await fetchJsonWithTimeout<any>(
        `/api/behavior/teacher-links/${encodeURIComponent(
          token,
        )}/question-assignments/${encodeURIComponent(
          detail.id,
        )}/selection`,
        {
          method: "POST",
          body: JSON.stringify({
            selectedQuestionKeys: serverSelectedKeys,
            selectedQuestionSnapshots: snapshots,
            commitQuestionKeys: keysToSend,
            selectionStatus: "in_progress",
            selectionRevision: nextRevision,
          }),
        },
      );

      const nextCommitted = Array.isArray(response?.committedQuestionKeys)
        ? [...new Set(response.committedQuestionKeys.map(String).filter(Boolean))]
        : serverSelectedKeys;

      setCommittedKeys(nextCommitted);
      // Gönderilmeyi bekleyen başka kazanımlardaki yerel seçimleri silme.
      // Sunucu yalnız gönderilmiş soruları tutar; öğretmenin açık oturumundaki
      // diğer geçici seçimler, kendi kazanımında Gönder denene kadar korunur.
      setSelectedKeys((current) => [...new Set([...current, ...nextCommitted])]);
      revisionRef.current = Math.max(
        nextRevision,
        Number(response?.selectionRevision || 0),
      );
      setNotice(`${keysToSend.length} soru sisteme gönderildi.`);
    } catch (error) {
      revisionRef.current = Math.max(0, nextRevision - 1);
      setNotice(error instanceof Error ? error.message : "Sorular sisteme gönderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const toggleQuestion = (question: QuestionSnapshot) => {
    if (!detail || saving) return;

    const key = questionIdentity(question);
    if (!key) return;

    if (!activeFilter) {
      setNotice("Önce soru seçilecek konu veya kazanımı açınız.");
      return;
    }

    const groupId = questionGroupIdOf(question);
    const groupMode = questionGroupModeOf(question);
    const selectGroupTogether = Boolean(groupId && (groupMode === "required" || isFileNameQuestionGroup(groupId)));
    if (selectGroupTogether) {
      const uniqueMembers = new Map<string, QuestionSnapshot>();
      allKnownQuestions
        .filter((row) => questionGroupIdOf(row) === groupId)
        .sort((a, b) => questionGroupOrderOf(a) - questionGroupOrderOf(b))
        .forEach((row) => {
          const memberKey = questionIdentity(row);
          if (memberKey && !uniqueMembers.has(memberKey)) uniqueMembers.set(memberKey, row);
        });
      const members = [...uniqueMembers.values()];
      const memberKeys = members.map(questionIdentity).filter(Boolean);
      const expectedSize = questionGroupSizeOf(question);
      if (expectedSize > 0 && memberKeys.length < expectedSize) {
        setNotice(`Bu soru ${expectedSize} soruluk zorunlu yönerge grubunda. Grubun tüm soruları görev havuzunda bulunmadığı için kısmi seçim yapılamaz.`);
        return;
      }
      const committedInGroup = memberKeys.filter((memberKey) => committedKeys.includes(memberKey));
      const allSelected = memberKeys.length > 0 && memberKeys.every((memberKey) => selectedKeys.includes(memberKey));
      if (allSelected) {
        if (committedInGroup.length > 0) {
          setNotice("Bu yönerge grubunun bazı soruları sisteme gönderilmiş. Gönderilmiş grup topluca seçimden çıkarılamaz.");
          return;
        }
        setSelectedKeys((current) => current.filter((item) => !memberKeys.includes(item)));
        setNotice("");
        return;
      }

      const additionalKeys = memberKeys.filter((memberKey) => !selectedKeys.includes(memberKey));
      const additionalEffectiveCount = effectiveSelectedCount(additionalKeys);
      const printableGroupCount = effectiveSelectedCount(memberKeys);
      if (selectedEffectiveCount + additionalEffectiveCount > maxCount) {
        setNotice(`Bu ${printableGroupCount} soruluk yönerge grubu görevin kalan soru kapasitesine sığmıyor.`);
        return;
      }
      const activeGroupKeys = keysForFilter(memberKeys, activeFilter);
      const activeAdditionalCount = effectiveSelectedCount(
        activeGroupKeys.filter((memberKey) => !selectedKeys.includes(memberKey)),
      );
      if (activeRequiredCount > 0 && activeSelectedCount + activeAdditionalCount > activeRequiredCount) {
        setNotice(`Bu yönerge grubu seçilirse aktif konu/kazanım için belirlenen ${activeRequiredCount} soru sınırı aşılır.`);
        return;
      }
      setSelectedKeys((current) => [...new Set([...current, ...memberKeys])]);
      setNotice(`${printableGroupCount} soruluk yönerge grubu öncülüyle birlikte seçildi.`);
      return;
    }

    if (committedKeys.includes(key)) return;
    const exists = selectedKeys.includes(key);
    if (!exists && activeRequiredCount > 0 && activeSelectedCount >= activeRequiredCount) {
      setNotice(`Bu konu/kazanım için ${activeRequiredCount} soru seçimi tamamlandı.`);
      return;
    }
    if (!exists && selectedEffectiveCount >= maxCount) {
      setNotice(`Bu görevde en fazla ${maxCount} soru seçebilirsiniz.`);
      return;
    }
    setSelectedKeys((current) =>
      exists ? current.filter((item) => item !== key) : [...current, key],
    );
    setNotice("");
  };

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressRef.current.timer !== null) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }, []);

  React.useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const beginQuestionLongPress = (
    event: React.PointerEvent<HTMLButtonElement>,
    question: QuestionSnapshot,
  ) => {
    if (!activeOutcomeContext || saving || questionActionBusy) return;
    clearLongPressTimer();
    longPressRef.current.x = event.clientX;
    longPressRef.current.y = event.clientY;
    longPressRef.current.key = questionIdentity(question);
    longPressRef.current.timer = window.setTimeout(() => {
      suppressQuestionClickRef.current = true;
      setQuestionActionError("");
      setQuestionAction({
        question,
        unit: activeOutcomeContext.unit,
        topic: activeOutcomeContext.topic,
        outcome: activeOutcomeContext.outcome,
      });
      longPressRef.current.timer = null;
    }, 650);
  };

  const moveQuestionLongPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (longPressRef.current.timer === null) return;
    if (
      Math.abs(event.clientX - longPressRef.current.x) > 12 ||
      Math.abs(event.clientY - longPressRef.current.y) > 12
    ) clearLongPressTimer();
  };

  const endQuestionLongPress = () => clearLongPressTimer();

  const updateQuestionSnapshotEverywhere = React.useCallback(
    (questionId: string, patch: Partial<QuestionSnapshot> | null) => {
      const updateRows = (rows: QuestionSnapshot[]) =>
        rows
          .map((row) => {
            if (questionIdentity(row) !== questionId) return row;
            return patch ? { ...row, ...patch } : null;
          })
          .filter(Boolean) as QuestionSnapshot[];

      setAssignmentBankQuestions((rows) => updateRows(rows));
      setLiveScopeQuestions((rows) => updateRows(rows));
      setDetail((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          selectedQuestionSnapshots: updateRows(previous.selectedQuestionSnapshots || []),
          availableQuestionSnapshots: updateRows(previous.availableQuestionSnapshots || []),
        };
      });
    },
    [],
  );

  const moveQuestionToOutcome = async (targetOutcome: AssignmentScopeOutcome) => {
    if (!detail || !questionAction || questionActionBusy) return;
    const questionId = questionIdentity(questionAction.question);
    if (!questionId) return;

    setQuestionActionBusy(true);
    setQuestionActionError("");
    try {
      const result = await fetchJsonWithTimeout<any>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/question-assignments/${encodeURIComponent(detail.id)}/questions/${encodeURIComponent(questionId)}/hierarchy`,
        {
          method: "PATCH",
          body: JSON.stringify({
            unitId: questionAction.unit.id,
            unitName: questionAction.unit.name,
            topicId: questionAction.topic.id,
            topicName: questionAction.topic.name,
            outcomeId: targetOutcome.id,
            outcomeName: targetOutcome.name,
          }),
        },
      );

      updateQuestionSnapshotEverywhere(questionId, {
        unitId: String(questionAction.unit.id),
        unitName: String(questionAction.unit.name),
        topicId: String(questionAction.topic.id),
        topicName: String(questionAction.topic.name),
        outcomeId: String(targetOutcome.id),
        outcomeName: String(targetOutcome.name),
        questionCode: String(result?.question?.questionCode || questionAction.question.questionCode || ""),
        code: String(result?.question?.questionCode || questionAction.question.code || ""),
      });
      setLiveScopeQuestions((rows) => rows.filter((row) => questionIdentity(row) !== questionId));
      setQuestionAction(null);
      suppressQuestionClickRef.current = false;
      setNotice("");
    } catch (error) {
      setQuestionActionError(error instanceof Error ? error.message : "Soru başka kazanıma taşınamadı.");
    } finally {
      setQuestionActionBusy(false);
    }
  };

  const removeQuestionFromCurriculum = async () => {
    if (!detail || !questionAction || questionActionBusy) return;
    const questionId = questionIdentity(questionAction.question);
    if (!questionId) return;

    setQuestionActionBusy(true);
    setQuestionActionError("");
    try {
      const result = await fetchJsonWithTimeout<any>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/question-assignments/${encodeURIComponent(detail.id)}/questions/${encodeURIComponent(questionId)}/outside-curriculum`,
        { method: "DELETE" },
      );
      updateQuestionSnapshotEverywhere(questionId, null);
      setSelectedKeys(
        Array.isArray(result?.selectedQuestionKeys)
          ? result.selectedQuestionKeys.map(String)
          : selectedKeys.filter((key) => String(key) !== questionId),
      );
      revisionRef.current = Math.max(revisionRef.current, Number(result?.selectionRevision || 0));
      setQuestionAction(null);
      suppressQuestionClickRef.current = false;
      setNotice("");
    } catch (error) {
      setQuestionActionError(error instanceof Error ? error.message : "Soru kazanım dışına çıkarılamadı.");
    } finally {
      setQuestionActionBusy(false);
    }
  };


  if (detail) {
    const currentAssignmentKind = assignmentKindOf(detail);

    return (
      <main className="h-[100dvh] overflow-hidden bg-gradient-to-b from-amber-50/60 via-white to-white text-slate-800">
        <div className="mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white shadow-xl">
          <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 text-slate-900">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!saving) {
                    if (activeFilter) {
                      // Soru ekranından bir önceki kapsam listesine dön.
                      setActiveFilter(null);
                      setScopeTreeOpen(true);
                      setNotice("");
                    } else {
                      // Kapsam listesinden görev/test listesine dön.
                      setDetail(null);
                      setSelectedKeys([]);
                      setCommittedKeys([]);
                      setDetailError("");
                      setScopeTreeOpen(false);
                                    }
                  }
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 active:scale-95"
                aria-label="Geri"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-base font-black text-red-600">
                    {detail.testName ? replaceLegacyExamTerminology(detail.testName) : (currentAssignmentKind === "exam" ? "Sınav Soru Görevi" : "Test Soru Görevi")}
                  </h1>
                  {!scopeTreeOpen && activeOutcomeContext ? (
                    <div className="mt-0.5 min-w-0">
                      <div className="truncate text-[10px] font-black uppercase tracking-wide text-slate-800">
                        {activeOutcomeContext.unit.name}
                      </div>
                      <div className="truncate text-[9px] font-bold text-slate-500">
                        {activeOutcomeContext.topic.name}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>


            </div>
          </header>

          {scopeTreeOpen && scopeUnits.length > 0 ? (
            <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-b border-slate-200 bg-slate-50 px-3 py-3">
              <div className="space-y-4">
                {scopeUnits.map((unit) => {
                  const unitFilter: AssignmentFilter = {
                    type: "unit",
                    id: String(unit.id),
                    name: unit.name,
                  };
                  return (
                    <div key={unit.id} className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 bg-red-600 px-3 py-3">
                        <div className="min-w-0 flex-1 text-[12px] font-black uppercase leading-5 text-white">
                          {unit.name}
                        </div>
                        <div className="shrink-0 rounded-lg bg-white/95 px-2 py-1 text-[9px] font-black">
                          <span className="text-red-600">Seçilen: {selectedCountForUnit(String(unit.id))}</span>
                          <span className="ml-1 text-slate-500">/ Havuz: {poolCountForFilter(unitFilter)}</span>
                        </div>
                      </div>
                      <div className="space-y-3 p-3">
                        {(unit.topics || []).map((topic) => {
                          const topicFilter: AssignmentFilter = {
                            type: "topic", id: String(topic.id), name: topic.name, unitId: String(unit.id),
                          };
                          return (
                            <div key={topic.id} className="overflow-hidden rounded-xl border border-red-100 bg-white">
                              <div className="flex items-center justify-between gap-2 bg-red-100 px-3 py-2.5">
                                <div className="min-w-0 flex-1 text-[11px] font-black leading-4 text-slate-950">{topic.name}</div>
                                <div className="shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black">
                                  <span className="text-red-600">Seçilen: {selectedCountForTopic(String(topic.id))}</span>
                                  <span className="ml-1 text-slate-500">/ Havuz: {poolCountForFilter(topicFilter)}</span>
                                </div>
                              </div>
                              <div className="bg-white px-3">
                                {(topic.outcomes || []).map((outcome, outcomeIndex) => {
                                  const outcomeFilter: AssignmentFilter = {
                                    type: "outcome", id: String(outcome.id), name: outcome.name,
                                    topicId: String(topic.id), topicName: topic.name,
                                  };
                                  const poolCount = poolCountForFilter(outcomeFilter);
                                  const selectedCount = selectedCountForOutcome(String(outcome.id));
                                  return (
                                    <button
                                      key={outcome.id || `outcome-${outcomeIndex}`}
                                      type="button"
                                      onClick={() => { setActiveFilter(outcomeFilter); setScopeTreeOpen(false); setNotice(""); }}
                                      className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-1 py-3 text-left active:scale-[0.995] last:border-b-0"
                                    >
                                      <span className="min-w-0 flex-1 text-[10px] font-bold leading-4 text-slate-900">{outcome.name}</span>
                                      <span className="shrink-0 whitespace-nowrap text-[10px] font-black">
                                        <span className="text-slate-900">(</span>
                                        <span className="text-red-600">{selectedCount}</span>
                                        <span className="text-slate-900">/{poolCount})</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!scopeTreeOpen && activeOutcomeContext && activeFilter?.type === "outcome" ? (
            <section className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0 flex-1 text-[11px] font-black leading-4 text-slate-900">
                  {activeOutcomeContext.outcome.name}
                </div>
                <div className="shrink-0 whitespace-nowrap text-[10px] font-black">
                  <span className="text-slate-900">(</span>
                  <span className="text-red-600">{selectedCountForOutcome(String(activeOutcomeContext.outcome.id))}</span>
                  <span className="text-slate-900">/{poolCountForFilter(activeFilter)})</span>
                </div>
              </div>
            </section>
          ) : null}

          {notice ? (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">
              {notice}
            </div>
          ) : null}

          {detailError ? (
            <div className="shrink-0 p-3">
              <ErrorCard
                message={detailError}
                retry={() => void openAssignment(detail.id)}
              />
            </div>
          ) : null}

          {!scopeTreeOpen && activeFilter?.type === "outcome" ? (
            <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              {liveScopeLoading ? (
                <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center text-[10px] font-black text-blue-700">Soru havuzu yükleniyor…</div>
              ) : null}
              {liveScopeError ? (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold text-amber-800">{liveScopeError}</div>
              ) : null}
              <div className="space-y-3">
                {orderedVisibleQuestions.map((question, index) => {
                  const key = questionIdentity(question);
                  const selected = selectedKeys.includes(key);
                  const src = imageSource(question);
                  const groupId = questionGroupIdOf(question);
                  const groupMembersInView = groupId
                    ? orderedVisibleQuestions
                        .filter((row) => questionGroupIdOf(row) === groupId)
                        .sort((a, b) => questionGroupOrderOf(a) - questionGroupOrderOf(b))
                    : [];
                  const isFirstVisibleGroupMember = Boolean(
                    groupId && groupMembersInView.length > 0 && questionIdentity(groupMembersInView[0]) === key,
                  );
                  const groupToken = questionGroupTokenOf(question);
                  const isGroupLeader = isFirstVisibleGroupMember;
                  const groupSelectedCount = groupId
                    ? groupMembersInView.filter((row) => selectedKeys.includes(questionIdentity(row))).length
                    : 0;
                  return (
                    <React.Fragment key={key || `question-${index}`}>
                      {isFirstVisibleGroupMember ? (
                        <button
                          type="button"
                          onClick={() => void toggleQuestion(question)}
                          disabled={saving || questionActionBusy || committedKeys.includes(key)}
                          className="block w-full overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/70 text-left shadow-sm transition hover:bg-indigo-100/70 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-indigo-100 px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Ortak Yönerge</div>
                            <div className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-indigo-700">
                              {questionGroupModeOf(question) === "required" ? "Zorunlu Grup" : "Serbest Grup"} · {questionGroupSizeOf(question) || groupMembersInView.length} soru · {groupSelectedCount} seçili
                            </div>
                          </div>
                          <div className="px-3 py-3">
                            {question.questionGroupTitle ? <div className="text-xs font-black text-slate-900">{question.questionGroupTitle}</div> : null}
                            {question.questionGroupInstructionText ? <div className="mt-1 whitespace-pre-wrap text-[11px] font-semibold leading-5 text-slate-700">{question.questionGroupInstructionText}</div> : null}
                            {question.questionGroupInstructionImageUrl ? <img src={question.questionGroupInstructionImageUrl} alt="Ortak yönerge" className="mt-2 max-h-52 w-full object-contain" /> : null}
                            {!question.questionGroupTitle && !question.questionGroupInstructionText && !question.questionGroupInstructionImageUrl ? (
                              <div className="text-[11px] font-semibold text-slate-600">Bu sorular aynı yönerge grubuna bağlıdır.</div>
                            ) : null}
                            <div className="mt-2 text-[9px] font-black text-indigo-600">{questionGroupModeOf(question) === "required" ? "Yönergeye dokununca grubun tamamı seçilir." : "Yönergeye dokununca ilk bağlı soru seçilir."}</div>
                          </div>
                        </button>
                      ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (suppressQuestionClickRef.current) { suppressQuestionClickRef.current = false; return; }
                        void toggleQuestion(question);
                      }}
                      onPointerDown={(event) => beginQuestionLongPress(event, question)}
                      onPointerMove={moveQuestionLongPress}
                      onPointerUp={endQuestionLongPress}
                      onPointerCancel={endQuestionLongPress}
                      onPointerLeave={endQuestionLongPress}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (!activeOutcomeContext) return;
                        suppressQuestionClickRef.current = true;
                        setQuestionActionError("");
                        setQuestionAction({ question, unit: activeOutcomeContext.unit, topic: activeOutcomeContext.topic, outcome: activeOutcomeContext.outcome });
                      }}
                      disabled={saving || questionActionBusy || committedKeys.includes(key)}
                      className={`w-full overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition active:scale-[0.99] ${selected ? "border-emerald-500 ring-2 ring-emerald-100" : groupId ? "border-rose-500 ring-2 ring-rose-100" : "border-slate-200"} ${committedKeys.includes(key) ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                        <span className="text-xs font-black text-slate-700">Soru {index + 1}</span>
                        {groupId ? (
                          <span className="inline-flex items-center gap-1 rounded-full border-2 border-rose-700 bg-rose-600 px-2.5 py-1 text-[9px] font-black text-white shadow-sm ring-2 ring-rose-100">
                            🔗 GRUP{groupToken ? ` ${groupToken}` : ""} · {isGroupLeader ? "ÖNCÜL" : "BAĞLI"} · BİRLİKTE SEÇİLİR
                          </span>
                        ) : null}
                      </div>
                      <div className="flex min-h-44 items-center justify-center bg-white p-2">
                        {src ? (
                          <img
                            src={src}
                            alt={String(question.questionCode || question.code || `Soru ${index + 1}`)}
                            loading={index < 3 ? "eager" : "lazy"}
                            decoding="async"
                            className="max-h-[58vh] w-full object-contain"
                            draggable={false}
                          />
                        ) : (
                          <div className="p-6 text-center text-xs font-bold text-slate-400">Soru görseli bulunamadı.</div>
                        )}
                      </div>
                    </button>
                    </React.Fragment>
                  );
                })}
              </div>
              {!liveScopeLoading && orderedVisibleQuestions.length === 0 ? (
                <div className="rounded-[18px] border border-slate-200 bg-white p-6 text-center shadow-sm">
                  <ListTree className="mx-auto h-8 w-8 text-slate-300" />
                  <div className="mt-3 text-sm font-black text-slate-700">Bu kazanımda soru bulunamadı</div>
                </div>
              ) : null}
            </section>
          ) : null}

          {!scopeTreeOpen && activeFilter?.type === "outcome" ? (<footer className="shrink-0 border-t border-slate-200 bg-white p-3">
            <button
              type="button"
              disabled={saving || activeSelectedKeys.length === 0 || activePendingKeys.length === 0}
              onClick={() => void sendActiveSelection()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg disabled:bg-slate-200 disabled:text-slate-400"
            >
              <CheckCircle2 className="h-5 w-5" />
              {saving
                ? "Sisteme gönderiliyor…"
                : `Sisteme Gönder · ${activeSelectedKeys.length} soru`}
            </button>
            <div className="mt-2 text-center text-[10px] font-bold text-slate-500">
              Gönderilen sorular bu testte seçili kalır ve başka testlerin soru havuzunda tekrar gösterilmez.
            </div>
          </footer>) : null}
        </div>

        {questionAction ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-3 sm:items-center"
            onClick={() => {
              if (!questionActionBusy) { setQuestionAction(null); setQuestionActionError(""); suppressQuestionClickRef.current = false; }
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-slate-900">Sorunun kazanımını değiştir</div>
                  <div className="mt-1 truncate text-[9px] font-semibold text-slate-500">{questionAction.topic.name}</div>
                </div>
                <button type="button" disabled={questionActionBusy} onClick={() => { setQuestionAction(null); setQuestionActionError(""); suppressQuestionClickRef.current = false; }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-label="Kapat">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 max-h-[45vh] space-y-1.5 overflow-y-auto">
                {(questionAction.topic.outcomes || [])
                  .filter((outcome) => String(outcome.id) !== String(questionAction.outcome.id))
                  .map((outcome) => (
                    <button key={outcome.id} type="button" disabled={questionActionBusy} onClick={() => void moveQuestionToOutcome(outcome)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] font-bold text-slate-900 active:bg-slate-50 disabled:opacity-50">
                      <span className="min-w-0 flex-1">{outcome.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
              </div>
              {questionActionError ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[9px] font-bold text-red-700">{questionActionError}</div> : null}
              <button type="button" disabled={questionActionBusy} onClick={() => void removeQuestionFromCurriculum()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-3 text-[10px] font-black text-red-700 ring-1 ring-red-200 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                {questionActionBusy ? "İşleniyor…" : "Kazanım dışı"}
              </button>
            </div>
          </div>
        ) : null}

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/60 via-white to-white p-3 text-slate-900">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[24px] border border-amber-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <Header
          title="Soru İşlemleri"
          subtitle={teacherName}
          onBack={onBack}
          onRefresh={() => void loadAssignments()}
          refreshing={assignmentsLoading}
        />

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Soru Seçim Görevlerim
          </div>

          {assignmentsLoading ? (
            <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-slate-4000" />
              <div className="mt-4 text-sm font-black text-slate-500">
                Görevler yükleniyor…
              </div>
              <div className="mt-2 text-[10px] font-semibold text-slate-400">
                En fazla birkaç saniye sürer.
              </div>
            </div>
          ) : assignmentsError ? (
            <div className="mt-5">
              <ErrorCard
                message={assignmentsError}
                retry={() => void loadAssignments()}
              />
            </div>
          ) : assignments.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-amber-100 bg-amber-50/35 px-5 py-12 text-center">
              <ClipboardCheck className="mx-auto h-9 w-9 text-slate-300" />
              <div className="mt-4 text-sm font-black text-slate-700">
                Aktif soru seçimi göreviniz yok
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                Yönetici size sınav veya test için soru seçimi görevi verdiğinde burada görünecektir.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {assignments.map((assignment) => {
                const isTestAssignment = assignmentKindOf(assignment) === "test";
                const unitLabel = coveredUnitLabel(assignment) || "Ünite bilgisi";
                const gradeLabel = testAssignmentGradeLabel(assignment);
                const courseName = String(assignment.courseName || assignment.subject || "Ders").trim();
                const courseTestTitle = [gradeLabel, courseName, "Testi"].filter(Boolean).join(" ");
                const testSubtitle = testAssignmentSubtitle(assignment);

                return (
                  <button
                    type="button"
                    key={assignment.id}
                    onClick={() => void openAssignment(assignment.id)}
                    disabled={detailLoading}
                    className={`w-full rounded-[18px] border p-4 text-left shadow-[0_5px_16px_rgba(15,23,42,0.05)] transition active:scale-[0.99] ${
                      isTestAssignment
                        ? "border-[#cfe3ea] bg-[#edf6f8]"
                        : "border-yellow-400 bg-yellow-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-red-600">
                          {isTestAssignment
                            ? courseTestTitle
                            : assignment.testName
                              ? replaceLegacyExamTerminology(assignment.testName)
                              : "Soru Seçimi Görevi"}
                        </div>
                        <div className="mt-1 truncate text-[10px] font-black text-slate-700">
                          {isTestAssignment ? testSubtitle || unitLabel : unitLabel}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {detailLoading ? (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-center text-xs font-black text-slate-500">
              Görev ayrıntısı açılıyor…
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
