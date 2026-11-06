import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Crop, Database, FileImage, FileText, FolderOpen, MonitorUp, Plus, RefreshCw, Save, Search, ShoppingCart, Trash2, Wand2, X } from "lucide-react";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { getTiffPageCount, renderQuestionSource, type QuestionSourcePage } from "../utils/questionCardSource";
import {
  listQuestionBankRecords,
} from "../lib/localDatabase";

type DocumentKind = "image" | "pdf" | "flipbook";
type LocalDocument = { file: File; kind: DocumentKind; url: string };
type CropSelection = { x: number; y: number; width: number; height: number };
type CropArea = CropSelection & { exclusions: CropSelection[] };
type CardMeta = { code: string; group: string; directive: boolean };
type PageCropState = { selections: CropArea[]; answers: Record<number, string>; metas?: Record<number, CardMeta> };
type SaveMode = "folder" | "bank";
type CurriculumTarget = {
  grade: number;
  courseId: string;
  courseName: string;
  unitId: string;
  topicId: string;
  outcomeId: string;
};
type ExamBasketItem = {
  id: string;
  questionCode: string;
  imageUrl: string;
  answer: string;
  grade: number;
  courseId: string;
  courseName: string;
  unitId: string;
  unitName: string;
  topicId: string;
  topicName: string;
  outcomeId: string;
  outcomeName: string;
  useCount: number;
  lastUsedAt?: string | null;
};
type AutoQuestionTemplate = {
  id: string;
  name: string;
  grade: number;
  courseId: string;
  courseName: string;
  selectedOutcomeIds: string[];
  outcomeQuotas: Record<string, number>;
  preferUnused: boolean;
  balanceAnswers: boolean;
  totalTarget: number;
  createdAt: string;
  updatedAt: string;
};

const QUESTION_BANK_COURSES: Record<number, string> = {
  1: "Türk Dili ve Edebiyatı",
  2: "Tarih",
  3: "Coğrafya",
  4: "Felsefe",
  5: "Din Kültürü ve Ahlak Bilgisi",
  7: "Matematik",
  8: "Fizik",
  9: "Kimya",
  10: "Biyoloji",
};
type DirectoryHandle = {
  name: string;
  entries: () => AsyncIterableIterator<[string, unknown]>;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
};

declare global { interface Window { showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" }) => Promise<DirectoryHandle>; showOpenFilePicker?: (options?: { id?: string; multiple?: boolean; types?: Array<{description?: string; accept: Record<string, string[]>}> }) => Promise<Array<{getFile: () => Promise<File>}> >; } }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const QUESTION_CARD_DPI = 400;
const questionCardWidthMm = (widthPx: number) => Math.max(0, widthPx) * 25.4 / QUESTION_CARD_DPI;
const formatMillimeterWidth = (widthPx: number) => questionCardWidthMm(widthPx).toFixed(1).replace(".", ",");
const resolveDocumentKind = (file: File): DocumentKind | null => {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR");
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  if (["image/jpeg", "image/png", "image/tiff", "image/x-tiff"].includes(file.type) || ["jpg", "jpeg", "png", "tif", "tiff"].includes(extension || "")) return "image";
  if (file.type === "text/html" || extension === "html" || extension === "htm") return "flipbook";
  return null;
};
const canvasToPngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG oluşturulamadı.")), "image/png", 1));

const cropIntersection = (area: CropSelection, candidate: CropSelection): CropSelection | null => {
  const left = Math.max(area.x, candidate.x);
  const top = Math.max(area.y, candidate.y);
  const right = Math.min(area.x + area.width, candidate.x + candidate.width);
  const bottom = Math.min(area.y + area.height, candidate.y + candidate.height);
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : null;
};

const sameCropSelection = (left: CropSelection, right: CropSelection) =>
  Math.abs(left.x - right.x) < 0.5 &&
  Math.abs(left.y - right.y) < 0.5 &&
  Math.abs(left.width - right.width) < 0.5 &&
  Math.abs(left.height - right.height) < 0.5;
const refineCropToColoredPixels = (canvas: HTMLCanvasElement, rough: CropSelection) => {
  const left = clamp(Math.floor(rough.x), 0, canvas.width - 1); const top = clamp(Math.floor(rough.y), 0, canvas.height - 1);
  const right = clamp(Math.ceil(rough.x + rough.width), left + 1, canvas.width); const bottom = clamp(Math.ceil(rough.y + rough.height), top + 1, canvas.height);
  const width = right - left; const height = bottom - top; const pixels = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(left, top, width, height).data;
  const colored = new Uint8Array(width * height);
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const chroma = maxChannel - minChannel;
    const brightness = (red + green + blue) / 3;

    // Tarama kaynaklarında görülen açık ve orta-açık nötr gri nokta/leke ve
    // kağıt tonu soru sınırlarını gereksiz yere büyütmesin. Daha önce yalnız
    // çok açık gri pikseller eleniyordu; taramadaki biraz daha koyu gri
    // noktalar da artık koordinat hesabına dahil edilmez.
    const isLightNeutralGray = chroma <= 22 && brightness >= 165;
    const isMeaningfulInk = brightness <= 225 || chroma >= 30;
    if (alpha > 24 && !isLightNeutralGray && isMeaningfulInk) colored[pixel] = 1;
  }
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const pixel = y * width + x; if (!colored[pixel]) continue;
    let neighborCount = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue; const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && colored[ny * width + nx]) neighborCount += 1;
    }
    if (neighborCount < 2) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) return rough;
  return { x: left + minX, y: top + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

export default function QuestionPrepareModule() {
  const fileInputRef = useRef<HTMLInputElement>(null); const sourceCanvasRef = useRef<HTMLCanvasElement>(null); const documentViewportRef = useRef<HTMLElement>(null);
  const digitalVideoRef = useRef<HTMLVideoElement>(null);
  const digitalStreamRef = useRef<MediaStream | null>(null);
  const digitalRequestRef = useRef(0);
  const [digitalBusy, setDigitalBusy] = useState(false);
  const [digitalSourceOpen, setDigitalSourceOpen] = useState(false);
  const [digitalSourceKind, setDigitalSourceKind] = useState<"zkitap" | "flipbook" | "screen">("zkitap");
  const [digitalSourceActive, setDigitalSourceActive] = useState(false);
  const digitalStageRef = useRef<HTMLDivElement>(null);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [digitalPan, setDigitalPan] = useState({ x: 0, y: 0 });
  const [digitalDrag, setDigitalDrag] = useState<{ mode: "pan" | "select"; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [digitalSelection, setDigitalSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [digitalSelectMode, setDigitalSelectMode] = useState(false);
  const [digitalBridgeReady, setDigitalBridgeReady] = useState(false);
  const [digitalBridgeWindows, setDigitalBridgeWindows] = useState<Array<{handle:string; title:string}>>([]);
  const [digitalBridgeHandle, setDigitalBridgeHandle] = useState("");
  const digitalBridgeUrl = "http://127.0.0.1:17891";
  const cropDragRef = useRef<{ pointerId: number; startX: number; startY: number; mode: "card" | "exclude" } | null>(null);
  const cropResizeDragRef = useRef<{ pointerId: number; index: number; handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"; startX: number; startY: number; original: CropArea } | null>(null);
  const cropSelectionRef = useRef<CropSelection | null>(null); const renderIdRef = useRef(0);
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1); const [sourceFiles, setSourceFiles] = useState<File[]>([]); const [sourcePages, setSourcePages] = useState<QuestionSourcePage[]>([]); const [selection, setSelection] = useState<CropSelection | null>(null);
  const [persistentWidthIndicator, setPersistentWidthIndicator] = useState<{ page: number; index: number } | null>(null);
  const pageCount = sourcePages.length || 1;
  const [pageCropStates, setPageCropStates] = useState<Record<number, PageCropState>>({});
  const cropSelections = pageCropStates[pageNumber]?.selections || [];
  const cropAnswers = pageCropStates[pageNumber]?.answers || {};
  const cropMetas = pageCropStates[pageNumber]?.metas || {};
  const setCardMeta = (index: number, patch: Partial<CardMeta>) => setPageCropStates(current => {
    const page = current[pageNumber] || { selections: [], answers: {} };
    const previous = page.metas?.[index] || { code: "", group: "", directive: false };
    return { ...current, [pageNumber]: { ...page, metas: { ...page.metas, [index]: { ...previous, ...patch } } } };
  });
  const totalCards = Object.values(pageCropStates).reduce((total, page) => total + page.selections.length, 0);
  const setCropSelections = (value: React.SetStateAction<CropArea[]>) => setPageCropStates(current => {
    const page = current[pageNumber] || { selections: [], answers: {} };
    return { ...current, [pageNumber]: { ...page, selections: typeof value === "function" ? value(page.selections) : value } };
  });
  const setCropAnswers = (value: React.SetStateAction<Record<number, string>>) => setPageCropStates(current => {
    const page = current[pageNumber] || { selections: [], answers: {} };
    return { ...current, [pageNumber]: { ...page, answers: typeof value === "function" ? value(page.answers) : value } };
  });
  const [baseName, setBaseName] = useState("1");
  const [lastCardUrl, setLastCardUrl] = useState(""); const [lastSavedName, setLastSavedName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [status, setStatus] = useState("");
  const savingRef = useRef(false);
  const [documentZoom, setDocumentZoom] = useState(1);
  const [saveMode, setSaveMode] = useState<SaveMode>("folder");
  const [curriculumStoreVersion, setCurriculumStoreVersion] = useState(0);
  const [bankTarget, setBankTarget] = useState<CurriculumTarget>(() => {
    try {
      const raw = sqliteStorage.getItem("question_prepare_bank_target_v1");
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === "object") {
        return {
          grade: Number(saved.grade || 9),
          courseId: String(saved.courseId || ""),
          courseName: String(saved.courseName || ""),
          unitId: String(saved.unitId || ""),
          topicId: String(saved.topicId || ""),
          outcomeId: String(saved.outcomeId || ""),
        };
      }
    } catch {}
    return {
      grade: 9,
      courseId: "",
      courseName: "",
      unitId: "",
      topicId: "",
      outcomeId: "",
    };
  });
  const [bankBrowserOpen, setBankBrowserOpen] = useState(false);
  const [bankBrowserLoading, setBankBrowserLoading] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankQuestionTotal, setBankQuestionTotal] = useState(0);
  const [bankQuestionOffset, setBankQuestionOffset] = useState(0);
  const [bankOnlyUnused, setBankOnlyUnused] = useState(true);
  const [bankPreviewQuestion, setBankPreviewQuestion] = useState<any>(null);
  const [examId, setExamId] = useState("");
  const [examName, setExamName] = useState("");
  const [examBasket, setExamBasket] = useState<ExamBasketItem[]>([]);
  const [examSaving, setExamSaving] = useState(false);
  const [autoSelectOpen, setAutoSelectOpen] = useState(false);
  const [autoSelectCount, setAutoSelectCount] = useState(20);
  const [autoSelectLoading, setAutoSelectLoading] = useState(false);
  const [autoSelectSelectedOutcomes, setAutoSelectSelectedOutcomes] = useState<string[]>([]);
  const [autoSelectOutcomeQuotas, setAutoSelectOutcomeQuotas] = useState<Record<string, number>>({});
  const [autoSelectBalanceAnswers, setAutoSelectBalanceAnswers] = useState(true);
  const [autoSelectPreferUnused, setAutoSelectPreferUnused] = useState(true);
  const [autoTemplateName, setAutoTemplateName] = useState("");
  const [autoTemplates, setAutoTemplates] = useState<AutoQuestionTemplate[]>(() => {
    try {
      const raw = sqliteStorage.getItem("question_auto_select_templates_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedAutoTemplateId, setSelectedAutoTemplateId] = useState("");

  useEffect(() => {
    try {
      sqliteStorage.setItem(
        "question_prepare_bank_target_v1",
        JSON.stringify(bankTarget),
      );
    } catch {}
  }, [bankTarget]);



  const curriculumCatalog = useMemo(() => {
    curriculumStoreVersion;
    let store: Record<string, any> = {};
    try {
      const raw = sqliteStorage.getItem("course_curriculums_v1");
      store = raw ? JSON.parse(raw) : {};
    } catch {
      store = {};
    }

    return [9, 10, 11, 12].map((grade) => {
      const courses = Object.entries(QUESTION_BANK_COURSES)
        .map(([courseId, courseName]) => {
          const virtualId = `CURR-${grade}-${courseId}`;
          const curriculum = store[`curriculum_${virtualId}`] || { units: [] };
          return {
            id: virtualId,
            numericId: Number(courseId),
            courseName,
            curriculum,
          };
        })
        .filter((course) => Array.isArray(course.curriculum?.units) && course.curriculum.units.length > 0);
      return { grade, courses };
    });
  }, [curriculumStoreVersion]);

  const targetGradeEntry = curriculumCatalog.find((entry) => entry.grade === bankTarget.grade);
  const targetCourse = targetGradeEntry?.courses.find((course) => course.id === bankTarget.courseId);
  const targetUnit = targetCourse?.curriculum?.units?.find((unit: any) => String(unit.id) === String(bankTarget.unitId));
  const targetTopic = targetUnit?.topics?.find((topic: any) => String(topic.id) === String(bankTarget.topicId));

  useEffect(() => () => { if (document) URL.revokeObjectURL(document.url); }, [document]);
  useEffect(() => () => { if (lastCardUrl) URL.revokeObjectURL(lastCardUrl); }, [lastCardUrl]);
  useEffect(() => {
    if (!document || document.kind === "flipbook") return;
    let active = true;
    const loadedPdfs: import("pdfjs-dist").PDFDocumentProxy[] = [];
    setBusy(true); setError("");
    void (async () => {
      const pages: QuestionSourcePage[] = [];
      for (const file of sourceFiles) {
        if (!active) return;
        if (resolveDocumentKind(file) === "pdf") {
          const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
          const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
          if (!active) { await pdf.destroy(); return; }
          loadedPdfs.push(pdf);
          for (let number = 1; number <= pdf.numPages; number += 1) pages.push({ kind: "pdf", pdf, number, name: `${file.name} · Sayfa ${number}` });
        } else {
          const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR") || "";
          if (extension === "tif" || extension === "tiff" || ["image/tiff", "image/x-tiff"].includes(file.type)) {
            const tiffPageCount = await getTiffPageCount(file);
            for (let pageIndex = 0; pageIndex < tiffPageCount; pageIndex += 1) {
              pages.push({
                kind: "image",
                file,
                pageIndex,
                pageCount: tiffPageCount,
                name: tiffPageCount > 1 ? `${file.name} · Sayfa ${pageIndex + 1}` : file.name,
              });
            }
          } else {
            pages.push({ kind: "image", file, name: file.name });
          }
        }
      }
      if (active) { setSourcePages(pages); setStatus(`${sourceFiles.length} dosya, ${pages.length} sayfa hazır.`); }
    })().catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : "Belge açılamadı."); setBusy(false); } });
    return () => { active = false; loadedPdfs.forEach(pdf => { void pdf.destroy(); }); };
  }, [document, sourceFiles]);
  useEffect(() => {
    const source = sourcePages[pageNumber - 1];
    if (!document || !source || !sourceCanvasRef.current) return;
    const renderId = ++renderIdRef.current;
    setBusy(true); setError(""); setSelection(null);
    cropDragRef.current = null; cropResizeDragRef.current = null; cropSelectionRef.current = null;
    void renderQuestionSource(source).then(rendered => {
      try {
        if (renderId !== renderIdRef.current || !sourceCanvasRef.current) return;
        const canvas = sourceCanvasRef.current;
        canvas.width = rendered.width; canvas.height = rendered.height;
        canvas.getContext("2d")!.drawImage(rendered, 0, 0);
        setStatus(`${source.name} · ${canvas.width} × ${canvas.height} px · ${source.kind === "pdf" ? "400 DPI" : "Orijinal çözünürlük"}`);
      } finally { rendered.width = 0; rendered.height = 0; }
    }).catch(reason => { if (renderId === renderIdRef.current) setError(reason instanceof Error ? reason.message : "Belge görüntülenemedi."); })
      .finally(() => { if (renderId === renderIdRef.current) setBusy(false); });
    return () => { renderIdRef.current += 1; };
  }, [document, sourcePages, pageNumber]);
  useEffect(() => {
    if (!document) return;
    const handleDocumentKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = Boolean(
        target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        )
      );

      if (event.key === "Escape" && !digitalSourceOpen && !savingRef.current) {
        setDocument(null);
        return;
      }

      if (
        isEditableTarget ||
        digitalSourceOpen ||
        savingRef.current ||
        document.kind === "flipbook" ||
        sourcePages.length <= 1
      ) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPageNumber((value) => Math.max(1, value - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPageNumber((value) => Math.min(sourcePages.length, value + 1));
      }
    };

    window.addEventListener("keydown", handleDocumentKeys);
    return () => window.removeEventListener("keydown", handleDocumentKeys);
  }, [document, digitalSourceOpen, sourcePages.length]);
  useEffect(() => {
    const viewport = documentViewportRef.current; if (!document || !viewport) return;
    const zoomDocument = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault(); event.stopPropagation();
      const direction = event.deltaY < 0 ? 1 : -1;
      setDocumentZoom((current) => clamp(Math.round((current + direction * 0.1) * 10) / 10, 0.3, 4));
    };
    viewport.addEventListener("wheel", zoomDocument, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomDocument);
  }, [document]);

  const bridgeCall = async (path: string, payload?: unknown) => {
    const response = await fetch(`${digitalBridgeUrl}${path}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) throw new Error(`Köprü hatası: ${response.status}`);
    return response.json();
  };
  const refreshDigitalBridge = async () => {
    try {
      const data = await bridgeCall("/windows");
      const windows = Array.isArray(data?.windows) ? data.windows : [];
      setDigitalBridgeWindows(windows);
      setDigitalBridgeReady(true);
      if (!digitalBridgeHandle && windows[0]?.handle) setDigitalBridgeHandle(String(windows[0].handle));
    } catch {
      setDigitalBridgeReady(false);
      setDigitalBridgeWindows([]);
    }
  };
  const bridgeInput = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!digitalBridgeHandle) return;
    try { await bridgeCall("/input", { handle: digitalBridgeHandle, action, ...extra }); }
    catch { setDigitalBridgeReady(false); setError("Dijital Kaynak Köprüsü ile bağlantı kesildi."); }
  };
  useEffect(() => {
    if (!digitalSourceOpen || digitalSourceKind !== "zkitap") return;
    void refreshDigitalBridge();
    const timer = window.setInterval(() => void refreshDigitalBridge(), 4000);
    return () => window.clearInterval(timer);
  }, [digitalSourceOpen, digitalSourceKind]);

  const resetDigitalView = () => { setDigitalZoom(1); setDigitalPan({ x: 0, y: 0 }); setDigitalSelection(null); setDigitalSelectMode(false); };
  const digitalPoint = (event: React.PointerEvent) => {
    const rect = digitalStageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onDigitalPointerDown = (event: React.PointerEvent) => {
    const point = digitalPoint(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (digitalSelectMode) {
      setDigitalSelection({ x: point.x, y: point.y, width: 0, height: 0 });
      setDigitalDrag({ mode: "select", startX: point.x, startY: point.y, panX: digitalPan.x, panY: digitalPan.y });
    } else {
      setDigitalDrag({ mode: "pan", startX: point.x, startY: point.y, panX: point.x, panY: point.y });
      if (digitalSourceKind === "zkitap" && digitalBridgeReady) {
        const rect = digitalStageRef.current?.getBoundingClientRect();
        if (rect) void bridgeInput("mousedown", { nx: point.x / rect.width, ny: point.y / rect.height });
      }
    }
  };
  const onDigitalPointerMove = (event: React.PointerEvent) => {
    if (!digitalDrag) return;
    const point = digitalPoint(event);
    if (digitalDrag.mode === "select") {
      const x=Math.min(digitalDrag.startX,point.x), y=Math.min(digitalDrag.startY,point.y);
      setDigitalSelection({x,y,width:Math.abs(point.x-digitalDrag.startX),height:Math.abs(point.y-digitalDrag.startY)});
    } else if (digitalSourceKind === "zkitap" && digitalBridgeReady) {
      const rect=digitalStageRef.current?.getBoundingClientRect();
      if(rect) void bridgeInput("mousemove",{nx:point.x/rect.width,ny:point.y/rect.height});
    }
  };
  const onDigitalPointerUp = (event: React.PointerEvent) => {
    if (digitalDrag?.mode === "pan" && digitalSourceKind === "zkitap" && digitalBridgeReady) {
      const point=digitalPoint(event); const rect=digitalStageRef.current?.getBoundingClientRect();
      if(rect) void bridgeInput("mouseup",{nx:point.x/rect.width,ny:point.y/rect.height});
    }
    setDigitalDrag(null);
  };
  const onDigitalWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    if (!digitalSelectMode && digitalSourceKind === "zkitap" && digitalBridgeReady) {
      const point=digitalPoint(event as any); const rect=digitalStageRef.current?.getBoundingClientRect();
      if(rect) void bridgeInput("wheel",{nx:point.x/rect.width,ny:point.y/rect.height,delta:event.deltaY<0?120:-120});
      return;
    }
    setDigitalZoom(v => Math.min(4, Math.max(.35, v * (event.deltaY < 0 ? 1.1 : .9))));
  };

  const stopDigitalSource = () => {
    digitalRequestRef.current += 1;
    setDigitalBusy(false);
    setDigitalSelection(null);
    digitalStreamRef.current?.getTracks().forEach((track) => track.stop());
    digitalStreamRef.current = null;
    if (digitalVideoRef.current) digitalVideoRef.current.srcObject = null;
    setDigitalSourceActive(false);
  };
  const openDigitalSource = (kind: "zkitap" | "flipbook" | "screen") => {
    resetDigitalView();
    if (!digitalSourceActive) setDigitalSourceKind(kind);
    setDigitalSourceOpen(true);
    setError("");
  };
  const startDigitalSource = async () => {
    if (digitalBusy) return;
    if (!window.isSecureContext) { setError("Ekran paylaşımı için uygulamayı HTTPS veya localhost üzerinden açın."); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) { setError("Bu tarayıcı ekran yakalamayı desteklemiyor. Masaüstü Chrome veya Edge kullanın; alternatif olarak ekran görüntüsünü PNG/JPG yükleyin."); return; }
    const request = ++digitalRequestRef.current;
    setDigitalBusy(true); setError("");
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      if (request !== digitalRequestRef.current || !digitalVideoRef.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      digitalStreamRef.current?.getTracks().forEach(track => track.stop());
      digitalStreamRef.current = acquired;
      const stream = acquired;
      const video = digitalVideoRef.current;
      video.srcObject = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (digitalStreamRef.current === stream) stopDigitalSource();
      }, { once: true });
      await video.play();
      if (request !== digitalRequestRef.current) return;
      resetDigitalView();
      setDigitalSourceActive(true);
    } catch (reason) {
      acquired?.getTracks().forEach(track => track.stop());
      if (request !== digitalRequestRef.current) return;
      if (acquired && digitalStreamRef.current === acquired) stopDigitalSource();
      setError(reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "Paylaşım başlatılmadı. Sekme / pencere seç düğmesiyle yeniden deneyebilirsiniz."
        : "Dijital kaynak açılamadı: " + (reason instanceof Error ? reason.message : "Bilinmeyen hata"));
    } finally {
      if (request === digitalRequestRef.current) setDigitalBusy(false);
    }
  };
  const captureDigitalPage = async (selectionOnly = false) => {
    if (digitalBusy) return;
    const video = digitalVideoRef.current;
    const stage = digitalStageRef.current;
    if (!video || !stage || !digitalSourceActive || !video.videoWidth || !video.videoHeight) { setError("Önce Z-Kitap, Flipbook veya ekran penceresini bağlayın."); return; }
    const request = digitalRequestRef.current;
    setDigitalBusy(true);
    setError("");
    try {
    if (cropSelections.length && !window.confirm("Yeni sayfa mevcut kart seçimlerini temizleyecek. Kaydetmediğiniz kartlar varsa önce kaydedin. Yeni sayfa aktarılsın mı?")) return;
    const full = window.document.createElement("canvas"); full.width=video.videoWidth; full.height=video.videoHeight;
    const fullCtx=full.getContext("2d"); if(!fullCtx) throw new Error("Görüntü oluşturulamadı."); fullCtx.drawImage(video,0,0,full.width,full.height);
    let output=full;
    if (selectionOnly && digitalSelection && digitalSelection.width > 8 && digitalSelection.height > 8) {
      const stageRect = stage.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;
      const left = digitalSelection.x + stageRect.left - videoRect.left;
      const top = digitalSelection.y + stageRect.top - videoRect.top;
      const sx = Math.max(0, Math.floor(left * scaleX));
      const sy = Math.max(0, Math.floor(top * scaleY));
      const right = Math.min(video.videoWidth, Math.ceil((left + digitalSelection.width) * scaleX));
      const bottom = Math.min(video.videoHeight, Math.ceil((top + digitalSelection.height) * scaleY));
      const sw = right - sx, sh = bottom - sy;
      if (sw < 1 || sh < 1) { setError("Seçim görüntünün dışında. Görüntü üzerinde bir soru alanı seçin."); return; }
      const roughCrop=window.document.createElement("canvas"); roughCrop.width=Math.round(sw); roughCrop.height=Math.round(sh);
      roughCrop.getContext("2d")?.drawImage(full,sx,sy,sw,sh,0,0,roughCrop.width,roughCrop.height);
      const refined=refineCropToColoredPixels(roughCrop,{x:0,y:0,width:roughCrop.width,height:roughCrop.height});
      const crop=window.document.createElement("canvas"); crop.width=Math.max(1,Math.round(refined.width)); crop.height=Math.max(1,Math.round(refined.height));
      crop.getContext("2d")?.drawImage(roughCrop,refined.x,refined.y,refined.width,refined.height,0,0,crop.width,crop.height); output=crop;
      setStatus(`Kaba seçim otomatik düzeltildi: ${crop.width} × ${crop.height} px`);
    }
    const blob = await canvasToPngBlob(output);
    const label=digitalSourceKind==="zkitap"?"Z-Kitap":digitalSourceKind==="flipbook"?"Flipbook":"Ekran";
    const file=new File([blob],`${label}-${Date.now()}.png`,{type:"image/png"});
    if (request !== digitalRequestRef.current) return;
    loadDocument(file); setDigitalSourceOpen(false); resetDigitalView();
    setStatus(`${label} kaynağı soru çalışma alanına aktarıldı. Bundan sonra PDF kaynaktaki otomatik koordinat, seçim, kırpma, cevap ve soru bankası kayıt motoru aynen çalışır.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Görüntü aktarılamadı."); }
    finally { if (request === digitalRequestRef.current) setDigitalBusy(false); }
  };
  useEffect(() => () => {
    digitalRequestRef.current += 1;
    digitalStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const openFilePicker = async () => {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({ id: "rota-soru-dosyalari", multiple: true, types: [{ description: "Soru belgeleri", accept: { "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/tiff": [".tif", ".tiff"] } }] });
        const files = await Promise.all(handles.map((handle) => handle.getFile()));
        loadDocument(files[0], files);
        return;
      } catch (reason) { if (reason instanceof DOMException && reason.name === "AbortError") return; }
    }
    fileInputRef.current?.click();
  };
  const loadDocument = (file?: File, files: File[] = []) => {
    if (!file || busy) return;
    const selected = files.length ? files : [file];
    const kind = resolveDocumentKind(file);
    if (!kind || selected.some(item => !resolveDocumentKind(item)) || (selected.length > 1 && selected.some(item => resolveDocumentKind(item) === "flipbook"))) {
      setError("PDF, JPG, PNG ve TIF/TIFF dosyalarını birlikte; HTML flipbook belgesini tek başına açın."); return;
    }
    setError(""); setStatus(""); setSelection(null); setPersistentWidthIndicator(null); setPageCropStates({}); setSourcePages([]);
    setDocumentZoom(kind === "image" ? 1.8 : 1); setPageNumber(1);
    setSourceFiles(selected); setDocument({ file, kind, url: URL.createObjectURL(file) });
  };
  const sourcePoint = (clientX: number, clientY: number) => { const canvas = sourceCanvasRef.current; if (!canvas) return null; const bounds = canvas.getBoundingClientRect(); return { x: clamp((clientX - bounds.left) * canvas.width / Math.max(1, bounds.width), 0, canvas.width), y: clamp((clientY - bounds.top) * canvas.height / Math.max(1, bounds.height), 0, canvas.height) }; };
  const beginCrop = (event: React.PointerEvent<HTMLCanvasElement>) => { if (event.button !== 0 || busy) return; const point = sourcePoint(event.clientX, event.clientY); if (!point) return; event.preventDefault(); setPersistentWidthIndicator(null); event.currentTarget.setPointerCapture(event.pointerId); cropDragRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y, mode: "card" }; const next = { x: point.x, y: point.y, width: 0, height: 0 }; cropSelectionRef.current = next; setSelection(next); };
  const moveCrop = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = cropDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; const point = sourcePoint(event.clientX, event.clientY); if (!point) return; event.preventDefault(); const next = { x: Math.min(drag.startX, point.x), y: Math.min(drag.startY, point.y), width: Math.abs(point.x - drag.startX), height: Math.abs(point.y - drag.startY) }; cropSelectionRef.current = next; setSelection(next); };
  const finishCrop = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = cropDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; cropDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const rough = cropSelectionRef.current;
    if (!rough || rough.width < 2 || rough.height < 2) { cropSelectionRef.current = null; setSelection(null); return; }
    cropSelectionRef.current = null; setSelection(null);
    const refined = refineCropToColoredPixels(event.currentTarget, rough);
    const intersections = cropSelections
      .map((area, index) => ({ index, intersection: cropIntersection(area, refined) }))
      .filter((item): item is { index: number; intersection: CropSelection } => Boolean(item.intersection));

    if (intersections.length > 0) {
      setCropSelections((current) => current.map((area, index) => {
        const match = intersections.find((item) => item.index === index);
        if (!match) return area;
        const exclusions = Array.isArray(area.exclusions) ? [...area.exclusions] : [];
        if (!exclusions.some((excluded) => sameCropSelection(excluded, match.intersection))) exclusions.push(match.intersection);
        return { ...area, exclusions };
      }));
      setError("");
      setStatus(`Çizilen alan ${intersections.length} kartla kesişti. Yalnız kesişen bölüm karttan çıkarıldı; yeni kart oluşturulmadı.`);
      return;
    }

    const nextIndex = cropSelections.length;
    setCropSelections((current) => [...current, { ...refined, exclusions: [] }]);
    setPersistentWidthIndicator({ page: pageNumber, index: nextIndex });
    setError("");
    setStatus(`${nextIndex + 1}. kart alanı eklendi: X ${Math.floor(refined.x)}, Y ${Math.floor(refined.y)}, ${Math.ceil(refined.width)} × ${Math.ceil(refined.height)} px`);
  };
  const beginCropResize = (index: number, handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw", event: React.PointerEvent<HTMLElement>) => {
    if (busy) return;
    const point = sourcePoint(event.clientX, event.clientY);
    const area = cropSelections[index];
    if (!point || !area) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropResizeDragRef.current = { pointerId: event.pointerId, index, handle, startX: point.x, startY: point.y, original: { ...area, exclusions: [...(area.exclusions || [])] } };
  };
  const moveCropResize = (event: React.PointerEvent<HTMLElement>) => {
    const drag = cropResizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = sourceCanvasRef.current;
    const point = sourcePoint(event.clientX, event.clientY);
    if (!canvas || !point) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const minSize = 4;
    let left = drag.original.x;
    let top = drag.original.y;
    let right = drag.original.x + drag.original.width;
    let bottom = drag.original.y + drag.original.height;
    if (drag.handle.includes("w")) left = clamp(drag.original.x + dx, 0, right - minSize);
    if (drag.handle.includes("e")) right = clamp(drag.original.x + drag.original.width + dx, left + minSize, canvas.width);
    if (drag.handle.includes("n")) top = clamp(drag.original.y + dy, 0, bottom - minSize);
    if (drag.handle.includes("s")) bottom = clamp(drag.original.y + drag.original.height + dy, top + minSize, canvas.height);
    const resized: CropArea = { x: left, y: top, width: right - left, height: bottom - top, exclusions: [] };
    resized.exclusions = (drag.original.exclusions || [])
      .map((excluded) => cropIntersection(resized, excluded))
      .filter((excluded): excluded is CropSelection => Boolean(excluded));
    setCropSelections((current) => current.map((area, index) => index === drag.index ? resized : area));
  };
  const finishCropResize = (event: React.PointerEvent<HTMLElement>) => {
    const drag = cropResizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    cropResizeDragRef.current = null;
    setPersistentWidthIndicator({ page: pageNumber, index: drag.index });
    const area = cropSelections[drag.index];
    if (area) setStatus(`${drag.index + 1}. kart alanı yeniden boyutlandırıldı.`);
  };

  const removeCropAtPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = sourcePoint(event.clientX, event.clientY); if (!point) return;
    const targetIndex = cropSelections.findLastIndex((area) => point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height);
    if (targetIndex < 0) return;
    event.preventDefault(); cropDragRef.current = null; cropResizeDragRef.current = null; cropSelectionRef.current = null; setSelection(null); setPersistentWidthIndicator(null);
    setCropSelections((current) => current.filter((_, index) => index !== targetIndex));
    setCropAnswers((current) => {
      const next: Record<number, string> = {};
      (Object.entries(current) as Array<[string, string]>).forEach(([key, answer]) => {
        const index = Number(key);
        if (index < targetIndex) next[index] = answer;
        if (index > targetIndex) next[index - 1] = answer;
      });
      return next;
    });
    setPageCropStates(current => {
      const page = current[pageNumber]; if (!page) return current;
      const metas: Record<number, CardMeta> = {};
      Object.entries(page.metas || {}).forEach(([key, meta]) => {
        const index = Number(key);
        if (index < targetIndex) metas[index] = meta;
        if (index > targetIndex) metas[index - 1] = meta;
      });
      return { ...current, [pageNumber]: { ...page, metas } };
    });
    setError(""); setStatus(`${targetIndex + 1}. kart alanı çift tıklamayla kaldırıldı.`);
  };
  const chooseFolder = async () => {
    if (!window.showDirectoryPicker) { setError("Klasöre doğrudan kayıt için Chrome veya Edge kullanın."); return null; }
    try {
      const selected = await window.showDirectoryPicker({ id: "edupanel-question-cards", mode: "readwrite", startIn: "desktop" });
      const permission = selected.requestPermission ? await selected.requestPermission({ mode: "readwrite" }) : "granted";
      if (permission !== "granted") { setError("Klasöre yazma izni verilmedi."); return null; }
      setStatus(`Kayıt klasörü hazır: ${selected.name}`); setError(""); return selected;
    } catch (reason: any) { if (reason?.name !== "AbortError") setError("Kayıt klasörü seçilemedi."); return null; }
  };
  const persistAutoTemplates = (templates: AutoQuestionTemplate[]) => {
    setAutoTemplates(templates);
    sqliteStorage.setItem(
      "question_auto_select_templates_v1",
      JSON.stringify(templates),
    );
  };

  const saveAutoQuestionTemplate = () => {
    const name = autoTemplateName.trim();
    if (!name) {
      setError("Şablon için bir isim yazın.");
      return;
    }
    if (!bankTarget.courseId) {
      setError("Şablon kaydetmek için önce ders seçin.");
      return;
    }

    const selectedOutcomeIds =
      autoSelectSelectedOutcomes.length > 0
        ? autoSelectSelectedOutcomes
        : bankTarget.outcomeId
          ? [bankTarget.outcomeId]
          : [];

    if (selectedOutcomeIds.length === 0) {
      setError("Şablon kaydetmek için en az bir kazanım seçin.");
      return;
    }

    const now = new Date().toISOString();
    const existing = autoTemplates.find(
      (item) =>
        item.id === selectedAutoTemplateId ||
        item.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"),
    );

    const template: AutoQuestionTemplate = {
      id: existing?.id || `question-template-${Date.now()}`,
      name,
      grade: bankTarget.grade,
      courseId: bankTarget.courseId,
      courseName: bankTarget.courseName,
      selectedOutcomeIds,
      outcomeQuotas: selectedOutcomeIds.reduce<Record<string, number>>(
        (acc, outcomeId) => {
          acc[outcomeId] = Math.max(
            0,
            Number(autoSelectOutcomeQuotas[outcomeId] || 0),
          );
          return acc;
        },
        {},
      ),
      preferUnused: autoSelectPreferUnused,
      balanceAnswers: autoSelectBalanceAnswers,
      totalTarget: Math.max(
        1,
        Number(autoSelectQuotaTotal || autoSelectCount || 1),
      ),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const next = existing
      ? autoTemplates.map((item) => (item.id === existing.id ? template : item))
      : [...autoTemplates, template];

    persistAutoTemplates(
      [...next].sort((a, b) =>
        a.name.localeCompare(b.name, "tr-TR"),
      ),
    );
    setSelectedAutoTemplateId(template.id);
    setAutoTemplateName(template.name);
    setError("");
    setStatus(`"${template.name}" otomatik soru seçim şablonu kaydedildi.`);
  };

  const loadAutoQuestionTemplate = (templateId: string) => {
    const template = autoTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const gradeEntry = curriculumCatalog.find(
      (entry) => entry.grade === template.grade,
    );
    const course = gradeEntry?.courses?.find(
      (item) => item.id === template.courseId,
    );

    if (!course) {
      setError(
        `"${template.name}" şablonunun dersi mevcut müfredatta bulunamadı.`,
      );
      return;
    }

    const firstOutcomeId = template.selectedOutcomeIds[0] || "";
    let matchedUnit: any = null;
    let matchedTopic: any = null;

    for (const unit of course.curriculum?.units || []) {
      for (const topic of unit.topics || []) {
        if (
          (topic.outcomes || []).some(
            (outcome: any) => String(outcome.id) === String(firstOutcomeId),
          )
        ) {
          matchedUnit = unit;
          matchedTopic = topic;
          break;
        }
      }
      if (matchedUnit) break;
    }

    setBankTarget({
      grade: template.grade,
      courseId: template.courseId,
      courseName: template.courseName,
      unitId: String(matchedUnit?.id || ""),
      topicId: String(matchedTopic?.id || ""),
      outcomeId: firstOutcomeId,
    });
    setAutoSelectSelectedOutcomes([...template.selectedOutcomeIds]);
    setAutoSelectOutcomeQuotas({ ...template.outcomeQuotas });
    setAutoSelectPreferUnused(template.preferUnused);
    setAutoSelectBalanceAnswers(template.balanceAnswers);
    setAutoSelectCount(template.totalTarget);
    setSelectedAutoTemplateId(template.id);
    setAutoTemplateName(template.name);
    setError("");
    setStatus(`"${template.name}" şablonu yüklendi.`);
  };

  const deleteAutoQuestionTemplate = () => {
    if (!selectedAutoTemplateId) return;
    const template = autoTemplates.find(
      (item) => item.id === selectedAutoTemplateId,
    );
    if (!template) return;

    const next = autoTemplates.filter(
      (item) => item.id !== selectedAutoTemplateId,
    );
    persistAutoTemplates(next);
    setSelectedAutoTemplateId("");
    setAutoTemplateName("");
    setStatus(`"${template.name}" şablonu silindi.`);
  };

  const availableTargetOutcomes = useMemo(() => {
    const rows: Array<{
      id: string;
      label: string;
      unitId: string;
      unitName: string;
      topicId: string;
      topicName: string;
      outcomeName: string;
    }> = [];
    (targetCourse?.curriculum?.units || []).forEach((unit: any) => {
      (unit.topics || []).forEach((topic: any) => {
        (topic.outcomes || []).forEach((outcome: any) => {
          rows.push({
            id: String(outcome.id),
            label: `${outcome.id} • ${outcome.name || outcome.text || ""}`,
            unitId: String(unit.id),
            unitName: String(unit.name || unit.id || ""),
            topicId: String(topic.id),
            topicName: String(topic.name || topic.id || ""),
            outcomeName: String(outcome.name || outcome.text || outcome.id || ""),
          });
        });
      });
    });
    return rows;
  }, [targetCourse]);

  const toggleAutoSelectOutcome = (outcomeId: string) => {
    setAutoSelectSelectedOutcomes((current) => {
      const isSelected = current.includes(outcomeId);
      setAutoSelectOutcomeQuotas((quotas) => {
        const next = { ...quotas };
        if (isSelected) {
          delete next[outcomeId];
        } else if (!Number(next[outcomeId] || 0)) {
          next[outcomeId] = 1;
        }
        return next;
      });
      return isSelected
        ? current.filter((id) => id !== outcomeId)
        : [...current, outcomeId];
    });
  };

  const setAutoSelectOutcomeQuota = (outcomeId: string, count: number) => {
    const safeCount = Math.max(0, Math.min(100, Number(count || 0)));
    setAutoSelectOutcomeQuotas((current) => ({
      ...current,
      [outcomeId]: safeCount,
    }));
    setAutoSelectSelectedOutcomes((current) => {
      if (safeCount > 0 && !current.includes(outcomeId)) return [...current, outcomeId];
      if (safeCount === 0 && current.includes(outcomeId)) {
        return current.filter((id) => id !== outcomeId);
      }
      return current;
    });
  };

  const autoSelectQuotaTotal = autoSelectSelectedOutcomes.reduce(
    (total, outcomeId) =>
      total + Math.max(0, Number(autoSelectOutcomeQuotas[outcomeId] || 0)),
    0,
  );

  const distributeAutoSelectQuotasEvenly = (totalCount: number) => {
    const ids =
      autoSelectSelectedOutcomes.length > 0
        ? autoSelectSelectedOutcomes
        : bankTarget.outcomeId
          ? [bankTarget.outcomeId]
          : [];
    if (ids.length === 0) return;
    const safeTotal = Math.max(ids.length, Math.min(200, Number(totalCount || ids.length)));
    const base = Math.floor(safeTotal / ids.length);
    let remainder = safeTotal % ids.length;
    const next: Record<string, number> = {};
    ids.forEach((id) => {
      next[id] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    });
    setAutoSelectOutcomeQuotas((current) => ({ ...current, ...next }));
    setAutoSelectCount(safeTotal);
  };

  const autoSelectQuestions = async () => {
    if (!bankTarget.courseId) {
      setError("Otomatik seçim için önce ders seçin.");
      return;
    }

    const selectedOutcomeIds =
      autoSelectSelectedOutcomes.length > 0
        ? autoSelectSelectedOutcomes
        : bankTarget.outcomeId
          ? [bankTarget.outcomeId]
          : [];

    if (selectedOutcomeIds.length === 0) {
      setError("En az bir kazanım seçin.");
      return;
    }

    const quotaMode = selectedOutcomeIds.some(
      (id) => Number(autoSelectOutcomeQuotas[id] || 0) > 0,
    );

    const requestedByOutcome: Record<string, number> = {};
    if (quotaMode) {
      selectedOutcomeIds.forEach((id) => {
        requestedByOutcome[id] = Math.max(
          0,
          Math.min(100, Number(autoSelectOutcomeQuotas[id] || 0)),
        );
      });
    } else {
      const requestedCount = Math.max(1, Math.min(200, Number(autoSelectCount || 0)));
      const base = Math.floor(requestedCount / selectedOutcomeIds.length);
      let remainder = requestedCount % selectedOutcomeIds.length;
      selectedOutcomeIds.forEach((id) => {
        requestedByOutcome[id] = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      });
    }

    const requestedTotal = Object.values(requestedByOutcome).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (requestedTotal <= 0) {
      setError("Kazanımlar için en az 1 soru kotası belirleyin.");
      return;
    }

    setAutoSelectLoading(true);
    try {
      const answerCounts: Record<string, number> = {
        A: 0, B: 0, C: 0, D: 0, E: 0,
      };
      examBasket.forEach((item) => {
        const answer = String(item.answer || "").toUpperCase();
        if (answerCounts[answer] !== undefined) answerCounts[answer] += 1;
      });

      const selected: any[] = [];
      const shortages: Array<{ outcomeId: string; requested: number; found: number }> = [];

      const scoreQuestion = (question: any) => {
        const useCount = Number(question.useCount || 0);
        const unusedBonus = autoSelectPreferUnused && useCount === 0 ? -1000 : 0;
        const lastUsed = question.lastUsedAt
          ? new Date(question.lastUsedAt).getTime()
          : 0;
        return unusedBonus + useCount * 100 + lastUsed / 1e13 + Math.random();
      };

      for (const outcomeId of selectedOutcomeIds) {
        const quota = Number(requestedByOutcome[outcomeId] || 0);
        if (quota <= 0) continue;

        const meta = availableTargetOutcomes.find((item) => item.id === outcomeId);
        const result = await listQuestionBankRecords({
          status: "active",
          grade: bankTarget.grade,
          courseId: bankTarget.courseId,
          outcomeId,
          limit: 500,
          offset: 0,
        });

        const group = (result?.questions || [])
          .filter(
            (question: any) =>
              !examBasket.some((item) => item.id === question.id) &&
              !selected.some((item) => item.id === question.id),
          )
          .map((question: any) => ({
            ...question,
            __unitId: meta?.unitId || question.unitId || "",
            __unitName: meta?.unitName || question.unitId || "",
            __topicId: meta?.topicId || question.topicId || "",
            __topicName: meta?.topicName || question.topicId || "",
            __outcomeName: meta?.outcomeName || question.outcomeId || "",
          }))
          .sort((a: any, b: any) => scoreQuestion(a) - scoreQuestion(b));

        const pickedForOutcome: any[] = [];

        while (pickedForOutcome.length < quota && group.length > 0) {
          let bestIndex = 0;

          if (autoSelectBalanceAnswers) {
            let bestScore = Number.POSITIVE_INFINITY;
            group.forEach((question: any, index: number) => {
              const answer = String(question.answer || "").toUpperCase();
              const balancePenalty = answerCounts[answer] ?? 999;
              const usagePenalty = Number(question.useCount || 0) * 10;
              const recencyPenalty = question.lastUsedAt
                ? new Date(question.lastUsedAt).getTime() / 1e13
                : 0;
              const score =
                balancePenalty * 1000 +
                usagePenalty * 10 +
                recencyPenalty +
                index / 1000;
              if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
              }
            });
          }

          const [picked] = group.splice(bestIndex, 1);
          if (!picked) break;
          pickedForOutcome.push(picked);
          const answer = String(picked.answer || "").toUpperCase();
          if (answerCounts[answer] !== undefined) answerCounts[answer] += 1;
        }

        selected.push(...pickedForOutcome);

        if (pickedForOutcome.length < quota) {
          shortages.push({
            outcomeId,
            requested: quota,
            found: pickedForOutcome.length,
          });
        }
      }

      if (selected.length === 0) {
        setError("Seçilen kazanımlarda uygun soru bulunamadı.");
        return;
      }

      const newItems: ExamBasketItem[] = selected.map((question) => ({
        id: question.id,
        questionCode: question.questionCode || question.fileName || question.id,
        imageUrl: question.imageUrl || "",
        answer: String(question.answer || ""),
        grade: bankTarget.grade,
        courseId: bankTarget.courseId,
        courseName: bankTarget.courseName,
        unitId: question.__unitId || question.unitId || "",
        unitName: question.__unitName || question.unitId || "",
        topicId: question.__topicId || question.topicId || "",
        topicName: question.__topicName || question.topicId || "",
        outcomeId: question.outcomeId || "",
        outcomeName: question.__outcomeName || question.outcomeId || "",
        useCount: Number(question.useCount || 0),
        lastUsedAt: question.lastUsedAt || null,
      }));

      setExamBasket((current) => [...current, ...newItems]);
      setAutoSelectOpen(false);
      setError("");

      if (shortages.length > 0) {
        const shortageText = shortages
          .map(
            (item) =>
              `${item.outcomeId}: ${item.requested} istendi, ${item.found} bulundu`,
          )
          .join(" • ");
        setStatus(
          `${newItems.length} soru otomatik seçildi. Bazı kazanımların kotası tamamlanamadı: ${shortageText}`,
        );
      } else {
        setStatus(
          `${newItems.length} soru, kazanım kotalarına uygun olarak otomatik seçildi.`,
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Otomatik soru seçimi yapılamadı.",
      );
    } finally {
      setAutoSelectLoading(false);
    }
  };


  const loadBankQuestionsForTarget = async (offset = 0, onlyUnused = bankOnlyUnused) => {
    if (!bankTarget.outcomeId || !bankTarget.courseId) {
      setError("Önce ders, ünite, konu ve kazanım seçin.");
      return;
    }
    setBankBrowserLoading(true);
    try {
      const result = await listQuestionBankRecords({
        status: "active",
        grade: bankTarget.grade,
        courseId: bankTarget.courseId,
        unitId: bankTarget.unitId || undefined,
        topicId: bankTarget.topicId || undefined,
        outcomeId: bankTarget.outcomeId,
        usage: onlyUnused ? "unused" : undefined,
        limit: 24,
        offset,
      });
      setBankQuestions(Array.isArray(result?.questions) ? result.questions : []);
      setBankQuestionTotal(Number(result?.total || 0));
      setBankQuestionOffset(offset);
      setError("");
    } catch (reason) {
      setBankQuestions([]);
      setBankQuestionTotal(0);
      setError(reason instanceof Error ? reason.message : "Soru bankası okunamadı.");
    } finally {
      setBankBrowserLoading(false);
    }
  };

  const openBankBrowser = async () => {
    if (!bankTarget.outcomeId) {
      setError("Soru bankasını açmadan önce kazanım seçin.");
      return;
    }
    setBankBrowserOpen(true);
    setBankQuestionOffset(0);
    await loadBankQuestionsForTarget(0, bankOnlyUnused);
  };

  const addQuestionToExamBasket = async (question: any) => {
    if (!question?.id) return;
    if (examBasket.some((item) => item.id === question.id)) {
      setError("Bu soru sınav sepetinde zaten var.");
      return;
    }

    const outcome = targetTopic?.outcomes?.find(
      (item: any) => String(item.id) === String(bankTarget.outcomeId),
    );

    setExamBasket((current) => [
      ...current,
      {
        id: question.id,
        questionCode: question.questionCode || question.fileName || question.id,
        imageUrl: question.imageUrl || "",
        answer: String(question.answer || ""),
        grade: bankTarget.grade,
        courseId: bankTarget.courseId,
        courseName: bankTarget.courseName,
        unitId: bankTarget.unitId,
        unitName: String(targetUnit?.name || bankTarget.unitId || ""),
        topicId: bankTarget.topicId,
        topicName: String(targetTopic?.name || bankTarget.topicId || ""),
        outcomeId: bankTarget.outcomeId,
        outcomeName: String(outcome?.name || outcome?.text || bankTarget.outcomeId || ""),
        useCount: Number(question.useCount || 0),
        lastUsedAt: question.lastUsedAt || null,
      },
    ]);
    setError("");
  };

  const removeQuestionFromExamBasket = (questionId: string) => {
    setExamBasket((current) => current.filter((item) => item.id !== questionId));
  };

  const finalizeExamBasket = async () => {
    const requestedExamCode = examId.trim();
    const requestedExamName = examName.trim();
    if (!requestedExamCode) {
      setError("Sınav soru sepetini aktarmak için bir sınav kodu yazın.");
      return;
    }
    if (examBasket.length === 0) {
      setError("Sınav sepetinde soru bulunmuyor.");
      return;
    }

    setExamSaving(true);
    try {
      const transfer = {
        id: `question-transfer-${Date.now()}`,
        requestedExamCode,
        requestedExamName: requestedExamName || requestedExamCode,
        createdAt: new Date().toISOString(),
        source: "QuestionPrepareModule",
        items: examBasket,
      };
      sqliteStorage.setItem("question_prepare_exam_transfer_v1", JSON.stringify(transfer));
      setStatus(
        `${examBasket.length} soru gerçek sınava aktarılmak üzere hazırlandı. Sınav Hazırla ekranında hedef sınavın Sorular bölümünü açıp “Soru Hazırla Sepetini Aktar” düğmesine basın.`,
      );
      setBankBrowserOpen(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sınav soru sepeti aktarıma hazırlanamadı.");
    } finally {
      setExamSaving(false);
    }
  };


  const renderCropBlob = async (canvas: HTMLCanvasElement, area: CropArea) => {
    const left = clamp(Math.floor(area.x), 0, canvas.width - 1);
    const top = clamp(Math.floor(area.y), 0, canvas.height - 1);
    const right = clamp(Math.ceil(area.x + area.width), left + 1, canvas.width);
    const bottom = clamp(Math.ceil(area.y + area.height), top + 1, canvas.height);
    const output = window.document.createElement("canvas");
    const scale = 1; // PDF sources are already rendered at 400 DPI; retain raster source pixels.
    output.width = Math.max(1, Math.round((right - left) * scale));
    output.height = Math.max(1, Math.round((bottom - top) * scale));
    const context = output.getContext("2d")!;
    context.imageSmoothingEnabled = false; // 1:1 pixel copy; do not resample source image.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, left, top, right - left, bottom - top, 0, 0, output.width, output.height);
    // Preserve source pixels exactly; no automatic contrast/colour enhancement.
    context.fillStyle = "#ffffff";
    area.exclusions.forEach((excluded) => {
      const excludedLeft = clamp(Math.floor((excluded.x - left) * scale), 0, output.width);
      const excludedTop = clamp(Math.floor((excluded.y - top) * scale), 0, output.height);
      const excludedRight = clamp(Math.ceil((excluded.x + excluded.width - left) * scale), excludedLeft, output.width);
      const excludedBottom = clamp(Math.ceil((excluded.y + excluded.height - top) * scale), excludedTop, output.height);
      context.fillRect(excludedLeft, excludedTop, excludedRight - excludedLeft, excludedBottom - excludedTop);
    });
    const blob = await canvasToPngBlob(output);
    output.width = 0; output.height = 0;
    return blob;
  };

  const chooseBankGrade = (grade: number) => {
    const entry = curriculumCatalog.find((item) => item.grade === grade);
    const course = entry?.courses?.[0];
    const unit = course?.curriculum?.units?.[0];
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setBankTarget({
      grade,
      courseId: course?.id || "",
      courseName: course?.courseName || "",
      unitId: String(unit?.id || ""),
      topicId: String(topic?.id || ""),
      outcomeId: String(outcome?.id || ""),
    });
  };

  const chooseBankCourse = (courseId: string) => {
    const course = targetGradeEntry?.courses.find((item) => item.id === courseId);
    const unit = course?.curriculum?.units?.[0];
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setBankTarget((current) => ({
      ...current,
      courseId,
      courseName: course?.courseName || "",
      unitId: String(unit?.id || ""),
      topicId: String(topic?.id || ""),
      outcomeId: String(outcome?.id || ""),
    }));
  };

  const chooseBankUnit = (unitId: string) => {
    const unit = targetCourse?.curriculum?.units?.find((item: any) => String(item.id) === String(unitId));
    const topic = unit?.topics?.[0];
    const outcome = topic?.outcomes?.[0];
    setBankTarget((current) => ({
      ...current,
      unitId,
      topicId: String(topic?.id || ""),
      outcomeId: String(outcome?.id || ""),
    }));
  };

  const chooseBankTopic = (topicId: string) => {
    const topic = targetUnit?.topics?.find((item: any) => String(item.id) === String(topicId));
    const outcome = topic?.outcomes?.[0];
    setBankTarget((current) => ({
      ...current,
      topicId,
      outcomeId: String(outcome?.id || ""),
    }));
  };

  const saveCrops = async () => {
    if (busy || savingRef.current) return;
    const canvas = sourceCanvasRef.current; const firstNumber = Number(baseName);
    const allStates = { ...pageCropStates, [pageNumber]: { selections: cropSelections, answers: cropAnswers } };
    const jobs = Object.entries(allStates).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([page, state]) => state.selections.map((area, index) => ({ page: Number(page), area, answer: state.answers[index], meta: state.metas?.[index] })));
    if (!canvas || !jobs.length) { setError("Önce belge üzerinde bir veya daha fazla alan seçin."); return; }
    if (!/^[A-Za-z0-9]+$/.test(baseName.trim())) { setError("İlk kart kodu yalnızca harf ve rakam içerebilir."); return; }
    if (/^\d+$/.test(baseName.trim()) && (!Number.isSafeInteger(firstNumber) || firstNumber < 0)) { setError("Geçerli bir ilk kart numarası yazın."); return; }
    if (/^\d+$/.test(baseName.trim()) && !Number.isSafeInteger(firstNumber + jobs.length)) { setError("Kart numarası güvenli sayı sınırını aşıyor."); return; }
    for (const [index, job] of jobs.entries()) {
      const code = (job.meta?.code || (/^\d+$/.test(baseName.trim()) ? String(firstNumber + index) : `${baseName.trim()}${index + 1}`)).trim();
      const group = (job.meta?.group || "").trim();
      if (!/^[A-Za-z0-9]+$/.test(code)) { setError(`${index + 1}. kart kodu yalnızca harf ve rakam içermeli.`); return; }
      if (group && !/^(0[1-9]|[1-9][0-9])$/.test(group)) { setError(`${index + 1}. kartın grup kodu iki haneli olmalı (01–99).`); return; }
      if (job.meta?.directive && !group) { setError(`${index + 1}. yönerge kartına grup kodu girilmelidir.`); return; }
    }
    const fileNames = jobs.map((job, index) => {
      const defaultCode = /^\d+$/.test(baseName.trim()) ? String(firstNumber + index) : `${baseName.trim()}${index + 1}`;
      const code = (job.meta?.code || defaultCode).trim();
      const group = (job.meta?.group || "").trim();
      const answer = /^[A-E]$/.test(job.answer || "") ? job.answer : "";
      return `${code}_${answer}${group ? `_${group}${job.meta?.directive ? "Y" : ""}` : ""}.png`;
    });
    if (new Set(fileNames.map(name => name.toLocaleLowerCase("tr-TR"))).size !== fileNames.length) { setError("Birden fazla kart aynı dosya adını kullanıyor. Her karta farklı isim verin."); return; }
    const targetFolder = await chooseFolder(); if (!targetFolder) return;
    savingRef.current = true; setBusy(true); setError("");
    let savedCount = 0;
    let renderedSource: HTMLCanvasElement | null = null;
    try {
      const currentPermission = targetFolder.queryPermission ? await targetFolder.queryPermission({ mode: "readwrite" }) : "granted";
      if (currentPermission !== "granted") throw new Error("Klasör yazma izni sona ermiş. Kayıt klasörünü yeniden seçin.");
      const existingNames = new Set<string>(); for await (const [name] of targetFolder.entries()) existingNames.add(name.toLocaleLowerCase("tr-TR"));
      const conflicts = fileNames.filter((name) => existingNames.has(name.toLocaleLowerCase("tr-TR")));
      if (conflicts.length) { setError(`Bu dosyalar klasörde zaten var: ${conflicts.join(", ")}. Mevcut dosyaların üzerine yazılmadı.`); return; }
      let finalPreview: { url: string; name: string } | null = null;
      let renderedPage = 0;
      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        if (renderedPage !== job.page) {
          if (renderedSource) { renderedSource.width = 0; renderedSource.height = 0; }
          const source = sourcePages[job.page - 1];
          if (!source) throw new Error(`${job.page}. sayfanın kaynağı bulunamadı.`);
          renderedSource = await renderQuestionSource(source); renderedPage = job.page;
        }
        setStatus(`Kart ${index + 1}/${jobs.length} · Sayfa ${job.page} kaydediliyor…`);
        const blob = await renderCropBlob(renderedSource!, job.area); const fileName = fileNames[index];
        const handle = await targetFolder.getFileHandle(fileName, { create: true }); const writable = await handle.createWritable();
        await writable.write(blob); await writable.close(); savedCount += 1;
        if (index === jobs.length - 1) finalPreview = { url: URL.createObjectURL(blob), name: fileName };
      }
      if (finalPreview) { setLastCardUrl(finalPreview.url); setLastSavedName(finalPreview.name); }
      setStatus(`${fileNames.join(", ")} dosyaları ${targetFolder.name} klasörüne PNG olarak kaydedildi.`);
    } catch (reason) { setError(`${savedCount}/${jobs.length} kart kaydedildi. ${reason instanceof Error ? reason.message : "Resim kartları kaydedilemedi."}`); }
    finally { if (renderedSource) { renderedSource.width = 0; renderedSource.height = 0; } savingRef.current = false; setBusy(false); }
  };

  return <section className="min-h-full bg-slate-50 p-4 md:p-6">
    <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.html,.htm,application/pdf,image/jpeg,image/png,image/tiff,image/x-tiff,text/html" className="hidden" multiple onChange={(event) => { const files = Array.from(event.target.files || []); const first = files[0]; loadDocument(first, files); event.currentTarget.value = ""; }}/>
    <div className="mx-auto flex min-h-[calc(100vh-11rem)] max-w-[1800px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="max-w-xl text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-700"><FolderOpen className="h-10 w-10"/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-cyan-700">İlk adım</p><h2 className="mt-2 text-3xl font-black text-slate-900">Hazırlanacak belgeyi açın</h2><p className="mt-3 text-sm font-medium leading-6 text-slate-500">PDF, JPG, PNG, TIF/TIFF veya HTML flipbook belgesini tam ekran çalışma penceresine alın.</p><div className="mt-7 flex flex-wrap items-center justify-center gap-3"><button type="button" disabled={busy} onClick={openFilePicker} className="inline-flex items-center gap-3 rounded-2xl bg-cyan-700 px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-cyan-800"><FolderOpen className="h-5 w-5"/> Belge Seç</button></div>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}</div></div>
    {(digitalSourceOpen || digitalSourceActive) && <div hidden={!digitalSourceOpen} className="fixed inset-0 z-[10040] bg-slate-950 text-white"><div className="flex h-[100dvh] w-screen flex-col"><header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">Dijital Kaynak Çalışma Alanı</p><h3 className="text-lg font-black">Z-Kitap · Flipbook · Ekran</h3></div>{digitalSourceKind === "zkitap" && <div className="flex min-w-[320px] items-center gap-2 rounded-xl bg-white/5 px-3 py-2"><span className={`h-2.5 w-2.5 rounded-full ${digitalBridgeReady?"bg-emerald-400":"bg-rose-400"}`}/><span className="text-[10px] font-black">{digitalBridgeReady?"KÖPRÜ BAĞLI":"KÖPRÜ KAPALI"}</span><select value={digitalBridgeHandle} onChange={(e)=>setDigitalBridgeHandle(e.target.value)} className="max-w-[260px] flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-bold text-white"><option value="">Kontrol edilecek pencere…</option>{digitalBridgeWindows.map(w=><option key={w.handle} value={w.handle}>{w.title}</option>)}</select><button type="button" onClick={()=>void refreshDigitalBridge()} className="rounded-lg bg-white/10 px-2 py-1.5 text-[9px] font-black">YENİLE</button></div>}<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDigitalSelectMode(false)} className={`rounded-xl px-3 py-2 text-xs font-black ${!digitalSelectMode?"bg-sky-600":"bg-white/10"}`}>KİTABI KULLAN</button><button type="button" onClick={() => {setDigitalSelectMode(true);setDigitalSelection(null)}} className={`rounded-xl px-3 py-2 text-xs font-black ${digitalSelectMode?"bg-emerald-600":"bg-white/10"}`}>SORU ALANI SEÇ</button><button type="button" onClick={() => setDigitalZoom(v=>Math.max(.35,v-.15))} className="rounded-xl bg-white/10 px-3 py-2 font-black">−</button><span className="min-w-14 text-center text-xs font-black">{Math.round(digitalZoom*100)}%</span><button type="button" onClick={() => setDigitalZoom(v=>Math.min(4,v+.15))} className="rounded-xl bg-white/10 px-3 py-2 font-black">+</button><button type="button" onClick={resetDigitalView} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">SIĞDIR</button><button type="button" onClick={() => {stopDigitalSource();setDigitalSourceOpen(false)}} className="rounded-xl bg-rose-500/20 p-2 text-rose-100"><X className="h-5 w-5"/></button></div></header>{error && <p role="alert" className="bg-rose-950 px-4 py-3 text-sm text-rose-100">{error}</p>}<div className="flex min-h-0 flex-1"><aside className="w-44 shrink-0 space-y-2 overflow-y-auto border-r border-white/10 bg-slate-900 p-3 lg:w-56">{([["zkitap","Z-KİTAP / UYGULAMA"],["flipbook","FLIPBOOK / WEB"],["screen","EKRAN / PENCERE"]] as const).map(([kind,label])=><button key={kind} type="button" onClick={()=>setDigitalSourceKind(kind)} className={`w-full rounded-xl px-3 py-3 text-left text-xs font-black ${digitalSourceKind===kind?"bg-violet-600":"bg-white/5 text-slate-300"}`}>{label}</button>)}<button type="button" disabled={digitalBusy} onClick={()=>void startDigitalSource()} className="mt-4 w-full rounded-xl bg-sky-600 px-3 py-3 text-xs font-black">{digitalSourceActive?"BAŞKA PENCERE SEÇ":"PENCEREYİ SEÇ"}</button><div className="grid grid-cols-2 gap-2"><button type="button" disabled={digitalSourceKind !== "zkitap" || !digitalBridgeReady} onClick={()=>void bridgeInput("key",{key:"LEFT"})} className="rounded-lg bg-white/10 px-2 py-2 text-[9px] font-black disabled:opacity-30">← GERİ</button><button type="button" disabled={digitalSourceKind !== "zkitap" || !digitalBridgeReady} onClick={()=>void bridgeInput("key",{key:"RIGHT"})} className="rounded-lg bg-white/10 px-2 py-2 text-[9px] font-black disabled:opacity-30">İLERİ →</button><button type="button" disabled={digitalSourceKind !== "zkitap" || !digitalBridgeReady} onClick={()=>void bridgeInput("key",{key:"PAGEDOWN"})} className="rounded-lg bg-white/10 px-2 py-2 text-[9px] font-black disabled:opacity-30">SAYFA ↓</button><button type="button" disabled={digitalSourceKind !== "zkitap" || !digitalBridgeReady} onClick={()=>void bridgeInput("key",{key:"PAGEUP"})} className="rounded-lg bg-white/10 px-2 py-2 text-[9px] font-black disabled:opacity-30">SAYFA ↑</button></div><p className="rounded-xl bg-white/5 p-3 text-[10px] font-semibold leading-5 text-slate-300">Web / flipbook sayfasını kendi sekmesinde açın ve büyütün. Rota’ya dönüp TÜM SAYFAYI AKTAR düğmesine basın; ardından birden fazla soru alanı seçip kaydedin. Köprü yalnızca Z-Kitap uzaktan kontrolü için isteğe bağlıdır.</p></aside><main ref={digitalStageRef} onPointerDown={onDigitalPointerDown} onPointerMove={onDigitalPointerMove} onPointerUp={onDigitalPointerUp} onPointerCancel={onDigitalPointerUp} onWheel={onDigitalWheel} className={`relative min-w-0 flex-1 overflow-hidden bg-black touch-none ${digitalSelectMode?"cursor-crosshair":"cursor-grab active:cursor-grabbing"}`}><div className="absolute inset-0 flex items-center justify-center" style={{transform:`translate(${digitalPan.x}px, ${digitalPan.y}px) scale(${digitalZoom})`,transformOrigin:"center center"}}><video ref={digitalVideoRef} muted playsInline className="max-h-full max-w-full select-none object-contain" draggable={false}/></div>{digitalSelection && <div className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,.28)]" style={{left:digitalSelection.x,top:digitalSelection.y,width:digitalSelection.width,height:digitalSelection.height}}><span className="absolute -top-7 left-0 rounded bg-emerald-500 px-2 py-1 text-[9px] font-black text-white">SORU ALANI</span></div>}{!digitalSourceActive && <div className="absolute inset-0 flex items-center justify-center"><div className="flex flex-col items-center text-center"><span className="text-sm font-black text-white">Z-KİTAP PENCERESİNİ ORTADA GÖRMEK İÇİN</span><span className="mt-2 text-xs font-semibold text-slate-300">Masaüstündeki pencereyi seçin</span><button type="button" disabled={digitalBusy} onClick={(e)=>{e.stopPropagation();void startDigitalSource()}} className="mt-4 rounded-2xl bg-violet-600 px-7 py-5 text-sm font-black shadow-2xl"><MonitorUp className="mx-auto mb-2 h-7 w-7"/>SEKME / PENCERE SEÇ</button></div></div>}</main></div><footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-900 px-4 py-3"><div className="text-[10px] font-semibold text-slate-400">Z-kitap penceresinde sayfayı açın ve aktarın. PDF ile aynı araçlarla soruları kırpıp kaydedin. Sonraki sayfa için kaynağa dönün; pencere paylaşımı açık kalır.</div><div className="flex gap-2"><button type="button" disabled={digitalBusy || !digitalSourceActive} onClick={()=>void captureDigitalPage(false)} className="rounded-xl bg-slate-700 px-4 py-3 text-xs font-black disabled:opacity-40">SAYFAYI AL VE SORULARI KIRP</button><button type="button" disabled={digitalBusy||!digitalSourceActive||!digitalSelection||digitalSelection.width<8||digitalSelection.height<8} onClick={()=>void captureDigitalPage(true)} className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black disabled:opacity-40">SEÇİLİ ALANI AKTAR</button></div></footer></div></div>}
    {autoSelectOpen && <div className="fixed inset-0 z-[10025] flex items-center justify-center bg-black/80 p-5">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-black text-violet-300"><Wand2 className="h-5 w-5"/>Otomatik Soru Seçimi</div>
            <div className="mt-1 text-[10px] font-semibold text-slate-400">{bankTarget.grade}. sınıf • {bankTarget.courseName || "Ders"}</div>
          </div>
          <button type="button" onClick={() => setAutoSelectOpen(false)} className="rounded-xl bg-white/10 p-2"><X className="h-5 w-5"/></button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-violet-300">
                <Save className="h-3.5 w-3.5" /> Sınav Şablonları
              </div>

              <select
                value={selectedAutoTemplateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAutoTemplateId(id);
                  if (id) loadAutoQuestionTemplate(id);
                }}
                className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-slate-800 px-2 text-[9px] font-bold text-white"
              >
                <option value="">Kayıtlı şablon seç…</option>
                {autoTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              <input
                value={autoTemplateName}
                onChange={(e) => setAutoTemplateName(e.target.value)}
                placeholder="Örn. 10. Sınıf Matematik 1. Yazılı"
                className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-slate-800 px-3 text-[9px] font-bold text-white outline-none focus:border-violet-400"
              />

              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={saveAutoQuestionTemplate}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-[9px] font-black text-white hover:bg-violet-500"
                >
                  {selectedAutoTemplateId ? "Şablonu Güncelle" : "Şablonu Kaydet"}
                </button>
                <button
                  type="button"
                  onClick={deleteAutoQuestionTemplate}
                  disabled={!selectedAutoTemplateId}
                  className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[9px] font-black text-rose-200 disabled:opacity-30"
                >
                  Sil
                </button>
              </div>

              {autoTemplates.length > 0 && (
                <div className="mt-2 text-[8px] font-semibold text-slate-500">
                  {autoTemplates.length} kayıtlı sınav şablonu
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Toplam soru hedefi
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={autoSelectCount}
                onChange={(e) => setAutoSelectCount(Number(e.target.value || 1))}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-800 px-3 text-sm font-black"
              />
              <button
                type="button"
                onClick={() => distributeAutoSelectQuotasEvenly(autoSelectCount)}
                disabled={!autoSelectSelectedOutcomes.length && !bankTarget.outcomeId}
                className="mt-2 w-full rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[9px] font-black text-violet-200 disabled:opacity-40"
              >
                Toplamı kazanımlara eşit dağıt
              </button>
              <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-[10px] font-black text-slate-300">
                Kazanım kotaları toplamı: {autoSelectQuotaTotal}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-amber-200 bg-white p-3">
              <span className="text-[10px] font-black">Kullanılmamışları öncele</span>
              <input type="checkbox" checked={autoSelectPreferUnused} onChange={(e) => setAutoSelectPreferUnused(e.target.checked)} className="h-4 w-4"/>
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-amber-200 bg-white p-3">
              <span className="text-[10px] font-black">Cevapları dengeli dağıt</span>
              <input type="checkbox" checked={autoSelectBalanceAnswers} onChange={(e) => setAutoSelectBalanceAnswers(e.target.checked)} className="h-4 w-4"/>
            </label>

            <div className="rounded-xl bg-violet-500/10 p-3 text-[9px] font-semibold leading-4 text-violet-200">
              Seçim, kazanımlar arasında dönüşümlü yapılır. Kullanılmamış ve daha az kullanılmış sorular öne alınır.
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase text-slate-400">Kazanımlar</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const ids = availableTargetOutcomes.map((item) => item.id); setAutoSelectSelectedOutcomes(ids); setAutoSelectOutcomeQuotas((current) => { const next = { ...current }; ids.forEach((id) => { if (!Number(next[id] || 0)) next[id] = 1; }); return next; }); }} className="text-[9px] font-black text-violet-300">Tümünü seç</button>
                <button type="button" onClick={() => { setAutoSelectSelectedOutcomes([]); setAutoSelectOutcomeQuotas({}); }} className="text-[9px] font-black text-slate-500">Temizle</button>
              </div>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/40 p-2">
              {availableTargetOutcomes.length === 0 ? <div className="p-6 text-center text-[10px] font-bold text-slate-500">Bu ders için müfredat kazanımı bulunamadı.</div> : availableTargetOutcomes.map((outcome) => {
                const checked = autoSelectSelectedOutcomes.includes(outcome.id);
                return <div key={outcome.id} className={`flex items-start gap-3 rounded-xl border p-2.5 transition ${checked ? "border-violet-400 bg-violet-500/15" : "border-transparent bg-white/5 hover:bg-white/10"}`}>
                  <button type="button" onClick={() => toggleAutoSelectOutcome(outcome.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-black ${checked ? "border-violet-300 bg-violet-400 text-slate-950" : "border-white/20"}`}>{checked ? "✓" : ""}</span>
                    <span className="text-[9px] font-bold leading-4 text-slate-200">{outcome.label}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setAutoSelectOutcomeQuota(outcome.id, Math.max(0, Number(autoSelectOutcomeQuotas[outcome.id] || 0) - 1))} className="h-7 w-7 rounded-lg bg-white/10 text-[11px] font-black text-white">−</button>
                    <input type="number" min="0" max="100" value={Number(autoSelectOutcomeQuotas[outcome.id] || 0)} onChange={(e) => setAutoSelectOutcomeQuota(outcome.id, Number(e.target.value || 0))} className="h-7 w-11 rounded-lg border border-white/10 bg-slate-800 text-center text-[9px] font-black text-white outline-none"/>
                    <button type="button" onClick={() => setAutoSelectOutcomeQuota(outcome.id, Number(autoSelectOutcomeQuotas[outcome.id] || 0) + 1)} className="h-7 w-7 rounded-lg bg-white/10 text-[11px] font-black text-white">+</button>
                  </div>
                </div>;
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/40 px-5 py-4">
          <div className="text-[10px] font-bold text-slate-500">
            {autoSelectSelectedOutcomes.length || (bankTarget.outcomeId ? 1 : 0)} kazanım • {autoSelectQuotaTotal} soru kotası
          </div>
          <button type="button" disabled={autoSelectLoading || (!autoSelectSelectedOutcomes.length && !bankTarget.outcomeId) || autoSelectQuotaTotal <= 0} onClick={() => void autoSelectQuestions()} className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-black text-white disabled:opacity-40"><Wand2 className={`h-4 w-4 ${autoSelectLoading ? "animate-pulse" : ""}`}/>{autoSelectLoading ? "Sorular seçiliyor…" : "Sepeti Otomatik Hazırla"}</button>
        </div>
      </div>
    </div>}

    {bankBrowserOpen && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[10020] flex bg-slate-950/95 text-white">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-300"><Database className="h-5 w-5"/>Soru Bankası • {bankTarget.courseName || "Ders"}</div>
            <div className="mt-1 truncate text-[10px] font-semibold text-slate-400">{bankTarget.outcomeId} kazanımı • {bankQuestionTotal} soru</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const next = !bankOnlyUnused; setBankOnlyUnused(next); setBankQuestionOffset(0); void loadBankQuestionsForTarget(0, next); }} className={`rounded-xl border px-3 py-2 text-[10px] font-black ${bankOnlyUnused ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-white/15 bg-white text-slate-700 shadow-sm"}`}>{bankOnlyUnused ? "Yalnız kullanılmamış" : "Tüm sorular"}</button>
            <button type="button" onClick={() => setBankBrowserOpen(false)} className="rounded-xl bg-white/10 p-2 hover:bg-rose-500"><X className="h-5 w-5"/></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {bankBrowserLoading ? <div className="flex h-full items-center justify-center text-sm font-black text-slate-300"><RefreshCw className="mr-2 h-5 w-5 animate-spin"/>Sorular yükleniyor…</div> : bankQuestions.length === 0 ? <div className="flex h-full min-h-64 items-center justify-center text-sm font-bold text-slate-500">Bu filtrede soru bulunamadı.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{bankQuestions.map((question: any) => {
            const selected = examBasket.some((item) => item.id === question.id);
            return <div key={question.id} className={`overflow-hidden rounded-2xl border bg-slate-900 ${selected ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-white/10"}`}>
              <button type="button" onClick={() => setBankPreviewQuestion(question)} className="flex h-48 w-full items-center justify-center bg-white"><img src={question.thumbnailUrl || question.imageUrl} alt={question.questionCode || question.fileName} loading="lazy" decoding="async" className="h-full w-full object-contain"/></button>
              <div className="p-3">
                <div className="truncate font-mono text-[10px] font-black text-emerald-300">{question.questionCode || question.fileName}</div>
                <div className="mt-1 flex items-center justify-between text-[9px] font-bold text-slate-400"><span>Cevap {question.answer}</span><span>{Number(question.useCount || 0) > 0 ? `${question.useCount} kullanım` : "Kullanılmamış"}</span></div>
                <button type="button" disabled={selected} onClick={() => void addQuestionToExamBasket(question)} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[10px] font-black text-white disabled:bg-emerald-950 disabled:text-emerald-400"><Plus className="h-4 w-4"/>{selected ? "Sepette" : "Sınava Ekle"}</button>
              </div>
            </div>;
          })}</div>}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-slate-900 px-4 py-3">
          <div className="text-[10px] font-bold text-slate-400">{bankQuestionTotal > 0 ? `${bankQuestionOffset + 1}–${Math.min(bankQuestionOffset + 24, bankQuestionTotal)} / ${bankQuestionTotal}` : "0 sonuç"}</div>
          <div className="flex gap-2">
            <button type="button" disabled={bankQuestionOffset <= 0 || bankBrowserLoading} onClick={() => void loadBankQuestionsForTarget(Math.max(0, bankQuestionOffset - 24), bankOnlyUnused)} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black disabled:opacity-30">← Önceki</button>
            <button type="button" disabled={bankQuestionOffset + 24 >= bankQuestionTotal || bankBrowserLoading} onClick={() => void loadBankQuestionsForTarget(bankQuestionOffset + 24, bankOnlyUnused)} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black disabled:opacity-30">Sonraki →</button>
          </div>
        </div>
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-slate-900">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-cyan-300"><ShoppingCart className="h-5 w-5"/>Sınav Soru Sepeti</div>
          <div className="mt-1 text-[9px] font-semibold text-slate-500">Seçilen sorular gerçek sınavın Sorular bölümüne aktarılmak üzere hazırlanır.</div>
          <input value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="Sınav kodu / aktarım etiketi" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-cyan-400"/>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="Sınav adı" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-cyan-400"/>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {examBasket.length === 0 ? <div className="flex h-48 items-center justify-center text-center text-[10px] font-bold text-slate-500">Henüz soru seçilmedi.</div> : <div className="space-y-2">{examBasket.map((item, index) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white p-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-[10px] font-black text-cyan-300">{index + 1}</span>
            <img src={item.imageUrl} alt={item.questionCode} className="h-12 w-16 shrink-0 rounded bg-white object-contain"/>
            <div className="min-w-0 flex-1"><div className="truncate font-mono text-[9px] font-black text-slate-200">{item.questionCode}</div><div className="mt-0.5 text-[8px] font-bold text-slate-500">Cevap {item.answer} • {item.outcomeId}</div></div>
            <button type="button" onClick={() => removeQuestionFromExamBasket(item.id)} className="shrink-0 rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4"/></button>
          </div>)}</div>}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black text-slate-400"><span>Toplam</span><span>{examBasket.length} soru</span></div>
          <button type="button" disabled={examSaving || examBasket.length === 0 || !examId.trim()} onClick={() => void finalizeExamBasket()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-xs font-black text-white disabled:opacity-40"><Check className="h-4 w-4"/>{examSaving ? "Kaydediliyor…" : "Sınav Hazırla’ya Aktar"}</button>
        </div>
      </aside>
    </div>}

    {bankPreviewQuestion && <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/90 p-6" onClick={() => setBankPreviewQuestion(null)}>
      <div className="relative max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setBankPreviewQuestion(null)} className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-2 text-slate-900"><X className="h-5 w-5"/></button>
        <img src={bankPreviewQuestion.imageUrl} alt={bankPreviewQuestion.questionCode} className="max-h-[86vh] max-w-[90vw] rounded-xl bg-white object-contain"/>
      </div>
    </div>}

    {document && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex flex-col bg-slate-950">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 text-white md:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">{document.kind === "image" ? <FileImage className="h-5 w-5"/> : <FileText className="h-5 w-5"/>}</span><div className="min-w-0"><p className="truncate text-sm font-black">{document.file.name}</p><p className="text-xs font-semibold text-slate-400">{status || "Mouse ile kesilecek alanı seçin"}</p></div></div><div className="flex flex-wrap items-end gap-2"><div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase tracking-wide text-slate-300">İlk kart kodu</label><input type="text" value={baseName} onChange={(event) => setBaseName(event.target.value)} className="h-10 w-24 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-cyan-400"/></div><button type="button" disabled={!totalCards || busy || document.kind === "flipbook"} onClick={() => void saveCrops()} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-600 px-5 text-sm font-black text-white shadow-md hover:bg-red-700 disabled:opacity-40"><Save className="h-4 w-4"/> Kaydet</button><button type="button" disabled={busy} onClick={openFilePicker} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-xs font-black text-slate-900"><RefreshCw className="h-4 w-4"/> Başka belge</button><button type="button" disabled={busy} onClick={() => setDocument(null)} aria-label="Kapat" className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200"><X className="h-5 w-5"/></button></div></header>
      <div className="flex min-h-0 flex-1"><main ref={documentViewportRef} className="relative min-h-0 flex-1 overflow-auto bg-slate-800 p-4">{busy && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 text-sm font-black text-white">Belge yüksek kalitede hazırlanıyor…</div>}{error && !busy && <div className="absolute inset-4 z-20 flex items-center justify-center rounded-2xl border border-rose-400/30 bg-slate-950/90 p-8 text-center text-sm font-bold text-rose-200">Belge sayfası gösterilemedi: {error}</div>}<div className="sticky left-3 top-3 z-10 mb-2 flex w-fit items-center gap-1 rounded-xl bg-slate-950/90 p-1.5 text-xs font-black text-cyan-100 shadow-lg"><button type="button" aria-label="Uzaklaştır" onClick={() => setDocumentZoom((current) => clamp(Math.round((current - 0.1) * 10) / 10, 0.3, 4))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lg leading-none text-white hover:bg-white/20">−</button><button type="button" title="%100 yakınlaştırmaya dön" onClick={() => setDocumentZoom(1)} className="min-w-16 rounded-lg bg-cyan-400/15 px-2 py-2 text-center text-cyan-100 hover:bg-cyan-400/25">%{Math.round(documentZoom * 100)}</button><button type="button" aria-label="Yaklaştır" onClick={() => setDocumentZoom((current) => clamp(Math.round((current + 0.1) * 10) / 10, 0.3, 4))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lg leading-none text-white hover:bg-white/20">+</button><span className="ml-1 hidden whitespace-nowrap px-1 text-[10px] font-bold text-slate-300 sm:inline">Ctrl + tekerlek</span></div>{document.kind === "flipbook" ? <div style={{ zoom: documentZoom }}><iframe src={document.url} title={document.file.name} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-full min-h-[calc(100vh-8rem)] w-full border-0 bg-white"/></div> : <div className="flex min-h-full items-start justify-center"><div className="relative inline-block shadow-2xl" style={{ zoom: documentZoom }}><canvas ref={sourceCanvasRef} onPointerDown={beginCrop} onPointerMove={moveCrop} onPointerUp={finishCrop} onPointerCancel={finishCrop} onDoubleClick={removeCropAtPoint} className="block max-w-full cursor-crosshair touch-none bg-white" style={{ maxHeight: "calc(100vh - 7rem)" }}/>{sourceCanvasRef.current && cropSelections.map((area, index) => <div key={index} className="pointer-events-none absolute border border-emerald-400 bg-emerald-300/5" style={{ left: `${area.x / sourceCanvasRef.current!.width * 100}%`, top: `${area.y / sourceCanvasRef.current!.height * 100}%`, width: `${area.width / sourceCanvasRef.current!.width * 100}%`, height: `${area.height / sourceCanvasRef.current!.height * 100}%` }}><div className="pointer-events-auto absolute left-0 top-0 flex -translate-y-full items-stretch" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}><div className="flex w-fit items-center rounded-l bg-emerald-500 px-2 py-1 text-[11px] font-black text-white">{index + 1}</div><div className="flex w-fit gap-0.5 rounded-r bg-amber-200 p-1 shadow-lg">{["A","B","C","D","E"].map((answer) => <button type="button" key={answer} aria-label={`${index + 1}. kart doğru cevap ${answer}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setCropAnswers((current) => ({ ...current, [index]: answer })); }} className={`flex h-6 w-6 items-center justify-center rounded border border-red-200 text-[9px] font-black transition ${cropAnswers[index] === answer ? "bg-red-600 text-white" : "bg-white text-red-700 hover:bg-red-50"}`}>{answer}</button>)}</div></div><div className="pointer-events-auto absolute left-0 top-0 flex translate-y-1 items-center gap-1 rounded-lg bg-slate-950/90 p-1 shadow-xl" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
  <input aria-label={`${index + 1}. kart adı`} title="Serbest kart adı (harf/rakam)" value={cropMetas[index]?.code || ""} placeholder={/^\d+$/.test(baseName.trim()) ? String(Number(baseName) + index) : `${baseName}${index + 1}`} onChange={(event) => setCardMeta(index, { code: event.target.value })} className="w-16 rounded bg-white px-1 py-1 text-[10px] font-bold text-slate-900" />
  <input aria-label={`${index + 1}. kart grup kodu`} title="Grup kodu: 01–99; boş bırakılırsa bağımsız soru" value={cropMetas[index]?.group || ""} placeholder="Grup" maxLength={2} onChange={(event) => setCardMeta(index, { group: event.target.value.replace(/\D/g, "").slice(0, 2) })} className="w-12 rounded bg-white px-1 py-1 text-[10px] font-bold text-slate-900" />
  <label className="flex items-center gap-0.5 whitespace-nowrap text-[9px] font-black text-white"><input type="checkbox" checked={!!cropMetas[index]?.directive} onChange={(event) => setCardMeta(index, { directive: event.target.checked })} />Yönerge</label>
</div><div className="pointer-events-auto absolute -left-1.5 top-0 h-full w-3 cursor-ew-resize" onPointerDown={(event) => beginCropResize(index, "w", event)} onPointerMove={moveCropResize} onPointerUp={finishCropResize} onPointerCancel={finishCropResize}/><div className="pointer-events-auto absolute -right-1.5 top-0 h-full w-3 cursor-ew-resize" onPointerDown={(event) => beginCropResize(index, "e", event)} onPointerMove={moveCropResize} onPointerUp={finishCropResize} onPointerCancel={finishCropResize}/><div className="pointer-events-auto absolute left-0 -top-1.5 h-3 w-full cursor-ns-resize" onPointerDown={(event) => beginCropResize(index, "n", event)} onPointerMove={moveCropResize} onPointerUp={finishCropResize} onPointerCancel={finishCropResize}/><div className="pointer-events-auto absolute left-0 -bottom-1.5 h-3 w-full cursor-ns-resize" onPointerDown={(event) => beginCropResize(index, "s", event)} onPointerMove={moveCropResize} onPointerUp={finishCropResize} onPointerCancel={finishCropResize}/>{([ ["nw","-left-2 -top-2 cursor-nwse-resize"], ["ne","-right-2 -top-2 cursor-nesw-resize"], ["sw","-left-2 -bottom-2 cursor-nesw-resize"], ["se","-right-2 -bottom-2 cursor-nwse-resize"] ] as const).map(([handle, position]) => <button key={handle} type="button" aria-label={`${index + 1}. kart ${handle} köşesinden yeniden boyutlandır`} className={`pointer-events-auto absolute h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow ${position}`} onPointerDown={(event) => beginCropResize(index, handle, event)} onPointerMove={moveCropResize} onPointerUp={finishCropResize} onPointerCancel={finishCropResize}/>)}{(cropResizeDragRef.current?.index === index || (persistentWidthIndicator?.page === pageNumber && persistentWidthIndicator.index === index)) && <div className="pointer-events-none absolute right-1 top-1 rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-black text-white shadow-lg">↔ {formatMillimeterWidth(area.width)} mm</div>}</div>)}{sourceCanvasRef.current && cropSelections.flatMap((area) => area.exclusions).map((excluded, index) => <div key={`excluded-${index}`} className="pointer-events-none absolute border-2 border-dashed border-rose-500" style={{ left: `${excluded.x / sourceCanvasRef.current!.width * 100}%`, top: `${excluded.y / sourceCanvasRef.current!.height * 100}%`, width: `${excluded.width / sourceCanvasRef.current!.width * 100}%`, height: `${excluded.height / sourceCanvasRef.current!.height * 100}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(244,63,94,.17) 0, rgba(244,63,94,.17) 5px, rgba(255,255,255,.72) 5px, rgba(255,255,255,.72) 10px)" }} />)}{selection && sourceCanvasRef.current && <div className="pointer-events-none absolute border border-cyan-300 bg-cyan-300/5 shadow-[0_0_0_9999px_rgba(2,6,23,.20)]" style={{ left: `${selection.x / sourceCanvasRef.current.width * 100}%`, top: `${selection.y / sourceCanvasRef.current.height * 100}%`, width: `${selection.width / sourceCanvasRef.current.width * 100}%`, height: `${selection.height / sourceCanvasRef.current.height * 100}%` }}><div className="absolute right-1 top-1 rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-black text-white shadow-lg">↔ {formatMillimeterWidth(selection.width)} mm</div></div>}</div></div>}{(document.kind === "pdf" || document.kind === "image") && pageCount > 1 && <div className="sticky bottom-3 mx-auto mt-3 flex w-fit items-center gap-3 rounded-2xl bg-slate-950/90 p-2 text-white"><button type="button" disabled={pageNumber <= 1 || busy} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} className="rounded-xl p-2 disabled:opacity-30"><ChevronLeft className="h-5 w-5"/></button><span className="min-w-20 text-center text-xs font-black">{pageNumber} / {pageCount}</span><button type="button" disabled={pageNumber >= pageCount || busy} onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))} className="rounded-xl p-2 disabled:opacity-30"><ChevronRight className="h-5 w-5"/></button></div>}</main>
      </div>
    </div>}
  </section>;
}




















