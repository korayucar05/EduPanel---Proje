import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, FileImage, Image as ImageIcon, Loader2, ScanText, Type } from "lucide-react";
import { hyphenateTurkishText } from "../question-editor/questionLayout";

type Point = { x: number; y: number };
type SelectionKind = "text" | "image";
type ImageAlignment = "left" | "center" | "right";
type ContentTextRole = "main" | "root";
type AnswerLayout = "1" | "3-2" | "2-2-1" | "5";
type AnswerOption = { letter: string; text: string };
type ContentBlock = { id: number; type: "text"; text: string; role?: ContentTextRole; indented?: boolean } | { id: number; type: "options"; options: AnswerOption[]; layout: AnswerLayout } | { id: number; type: "image"; url: string; align: ImageAlignment; width: number };
type ContentTextSelection = { blockId: number; start: number; end: number };
type Edge = "left" | "right" | "top" | "bottom";
type Selection = { id: number; kind: SelectionKind; pageIndex: number; x: number; y: number; width: number; height: number };
type PageSource = { canvas: HTMLCanvasElement; previewUrl: string; name: string };
type PointerAction = { kind: "draw"; id: number; start: Point; pageIndex: number } | { kind: "move"; start: Point; original: Selection } | { kind: "resize"; start: Point; original: Selection; edge: Edge };

declare global { interface Window { Tesseract?: any; showOpenFilePicker?: (options?: any) => Promise<Array<{ getFile: () => Promise<File> }>>; } }
const PDF_JS_URL = "https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
const QUESTION_FONT_FAMILY = '"MergeOne", sans-serif';
const QUESTION_FONT_SIZE_PT = 11;
const QUESTION_CANVAS_FONT_SIZE_PX = QUESTION_FONT_SIZE_PT * 300 / 72;
const QUESTION_EDITOR_VISUAL_WIDTH_RATIO = 0.68;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isWordCharacter = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}\p{M}'’\-]/u.test(value));
const snapToWordBoundary = (text: string, requestedOffset: number) => {
  const offset = clamp(requestedOffset, 0, text.length);
  if (!isWordCharacter(text[offset - 1]) || !isWordCharacter(text[offset])) return offset;
  let left = offset; let right = offset;
  while (left > 0 && isWordCharacter(text[left - 1])) left -= 1;
  while (right < text.length && isWordCharacter(text[right])) right += 1;
  return offset - left <= right - offset ? left : right;
};
const coalesceAdjacentTextBlocks = (blocks: ContentBlock[], target?: { id: number; offset: number }) => {
  const next: ContentBlock[] = []; let mappedTarget = target ? { ...target } : undefined;
  blocks.forEach((block) => {
    const previous = next[next.length - 1];
    if (block.type === "text" && previous?.type === "text" && block.role === previous.role && Boolean(block.indented) === Boolean(previous.indented)) {
      const previousLength = previous.text.length;
      if (mappedTarget?.id === block.id) mappedTarget = { id: previous.id, offset: previousLength + mappedTarget.offset };
      next[next.length - 1] = { ...previous, text: previous.text + block.text };
    } else next.push(block);
  });
  return { blocks: next, target: mappedTarget };
};

const loadFileImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file); const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı.")); };
  image.src = url;
});
const loadDataImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const normalizeTurkishOcrText = (value: string) => value
  .normalize("NFC")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\s+([,.;:!?%])/g, "$1")
  .replace(/([,.;:!?])(?=[\p{L}\p{N}])/gu, "$1 ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/ *\n */g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const normalizeTurkishOcrParagraph = (value: string) => normalizeTurkishOcrText(value)
  .replace(/\s*\n+\s*/g, " ")
  .replace(/ {2,}/g, " ")
  .trim();
const withoutSoftHyphens = (value: string) => value.replace(/\u00ad/g, "");
const parseAnswerOptions = (value: string) => {
  const normalized = withoutSoftHyphens(value).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const matches = [...normalized.matchAll(/(?:^|\s)([A-E])\s*(?:[\)\].:-]|9(?=[\s,;]|$)[,;]?)\s*/g)];
  if (matches.length < 2) return null;
  if (matches.some((match, index) => match[1].toUpperCase() !== "ABCDE"[index])) return null;
  const stem = normalized.slice(0, matches[0].index ?? 0).trim();
  const options = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length; const end = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length;
    return { letter: match[1].toUpperCase(), text: normalized.slice(start, end).trim() };
  });
  return { stem, options };
};
const optionRows = (options: AnswerOption[], layout: AnswerLayout) => {
  if (layout === "1") return options.map((option) => [option]);
  if (layout === "3-2") return [options.slice(0, 3), options.slice(3, 5)];
  if (layout === "2-2-1") return [options.slice(0, 2), options.slice(2, 4), options.slice(4, 5)];
  return [options.slice(0, 5)];
};
const optionColumnCount = (layout: AnswerLayout) => layout === "1" ? 1 : layout === "3-2" ? 3 : layout === "2-2-1" ? 2 : 5;
const textOffsetAtPoint = (element: HTMLElement, clientX: number, clientY: number) => {
  const ownerDocument = element.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const caret = ownerDocument.caretPositionFromPoint?.(clientX, clientY);
  const fallbackRange = caret ? null : ownerDocument.caretRangeFromPoint?.(clientX, clientY);
  const node = caret?.offsetNode || fallbackRange?.startContainer; const offset = caret?.offset ?? fallbackRange?.startOffset;
  if (!node || offset == null || !element.contains(node)) return clientY < element.getBoundingClientRect().top + element.offsetHeight / 2 ? 0 : withoutSoftHyphens(element.innerText).length;
  const range = ownerDocument.createRange(); range.selectNodeContents(element);
  try { range.setEnd(node, offset); return withoutSoftHyphens(range.toString()).length; } catch { return withoutSoftHyphens(element.innerText).length; }
};
const placeCaretAtTextOffset = (element: HTMLElement, requestedOffset: number) => {
  const selection = window.getSelection(); if (!selection) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let remaining = Math.max(0, requestedOffset); let node = walker.nextNode();
  while (node) {
    const nodeText = node.textContent || ""; const plainLength = withoutSoftHyphens(nodeText).length;
    if (remaining <= plainLength) {
      let domOffset = 0; let plainOffset = 0;
      while (domOffset < nodeText.length && plainOffset < remaining) { if (nodeText[domOffset] !== "\u00ad") plainOffset += 1; domOffset += 1; }
      const range = document.createRange(); range.setStart(node, domOffset); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); element.focus(); return;
    }
    remaining -= plainLength; node = walker.nextNode();
  }
  element.focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); selection.removeAllRanges(); selection.addRange(range);
};

const selectedTextOffsets = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = withoutSoftHyphens(prefix.toString()).length;
  const selectedLength = withoutSoftHyphens(range.toString()).length;
  return selectedLength > 0 ? { start, end: start + selectedLength } : null;
};

function EditableTextBlock({ block, onChange, onActivate, onSelect, onMergeBackward, onMergeForward }: { block: Extract<ContentBlock, { type: "text" }>; onChange: (text: string) => void; onActivate: () => void; onSelect: (start: number, end: number) => void; onMergeBackward?: () => void; onMergeForward?: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current; const hyphenatedText = hyphenateTurkishText(block.text);
    if (editor && document.activeElement !== editor && editor.innerText !== hyphenatedText) editor.innerText = hyphenatedText;
  }, [block.text]);
  return <div
    ref={editorRef}
    lang="tr"
    role="textbox"
    aria-multiline="true"
    contentEditable
    suppressContentEditableWarning
    spellCheck
    onFocus={onActivate}
    onPointerUp={(event) => {
      onActivate();
      const offsets = selectedTextOffsets(event.currentTarget);
      if (offsets) onSelect(offsets.start, offsets.end);
    }}
    onKeyDown={(event) => {
      if ((event.key !== "Backspace" && event.key !== "Delete") || (!onMergeBackward && !onMergeForward)) return;
      const selection = window.getSelection(); const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!activeRange?.collapsed || !event.currentTarget.contains(activeRange.startContainer)) return;
      const prefix = document.createRange(); prefix.selectNodeContents(event.currentTarget); prefix.setEnd(activeRange.startContainer, activeRange.startOffset);
      const offset = withoutSoftHyphens(prefix.toString()).length; const length = withoutSoftHyphens(event.currentTarget.innerText).length;
      if (event.key === "Backspace" && offset === 0 && onMergeBackward) { event.preventDefault(); onMergeBackward(); }
      if (event.key === "Delete" && offset === length && onMergeForward) { event.preventDefault(); onMergeForward(); }
    }}
    onInput={(event) => onChange(withoutSoftHyphens(event.currentTarget.innerText).replace(/\u00a0/g, " "))}
    onBlur={(event) => { const plainText = withoutSoftHyphens(event.currentTarget.innerText).replace(/\u00a0/g, " "); onChange(plainText); event.currentTarget.innerText = hyphenateTurkishText(plainText); }}
    onPaste={(event) => {
      event.preventDefault();
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    }}
    data-text-block-id={block.id}
    data-placeholder="Türkçe OCR metni…"
    className="whitespace-pre-wrap text-slate-800 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
    style={{ display: "inline", paddingLeft: block.indented ? "3mm" : 0, fontFamily: QUESTION_FONT_FAMILY, fontSize: `${QUESTION_FONT_SIZE_PT}pt`, fontWeight: block.role === "root" ? 600 : 400, WebkitTextStroke: block.role === "root" ? "0.35px currentColor" : undefined, lineHeight: 1.28, hyphens: "manual", overflowWrap: "normal", wordBreak: "normal" }}
  />;
}

function EditableOptionsBlock({ block, onChange, onActivate }: { block: Extract<ContentBlock, { type: "options" }>; onChange: (index: number, text: string) => void; onActivate: () => void }) {
  const columns = optionColumnCount(block.layout);
  return <div data-options-block-id={block.id} className="clear-both w-full" style={{ marginTop: "3mm", fontFamily: QUESTION_FONT_FAMILY, fontSize: `${QUESTION_FONT_SIZE_PT}pt`, fontWeight: 400, lineHeight: 1.28, textAlign: "left" }} onPointerDown={onActivate}>
    {optionRows(block.options, block.layout).map((row, rowIndex) => <div key={rowIndex} className="grid w-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {row.map((option) => {
        const optionIndex = block.options.indexOf(option);
        return <div key={`${option.letter}-${optionIndex}`} className="flex min-w-0 items-start">
          <span className="shrink-0 pr-[1mm]">{option.letter})</span>
          <span
            lang="tr"
            role="textbox"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onFocus={onActivate}
            onInput={(event) => onChange(optionIndex, withoutSoftHyphens(event.currentTarget.innerText).replace(/\u00a0/g, " "))}
            className="min-w-0 flex-1 whitespace-pre-wrap outline-none"
            style={{ hyphens: "manual", overflowWrap: "normal", wordBreak: "normal" }}
          >{hyphenateTurkishText(option.text)}</span>
        </div>;
      })}
    </div>)}
  </div>;
}


export default function QuestionWriterView({ exam }: { exam?: any }) {
  const [phase, setPhase] = useState<"source" | "compose">("source");
  const [pages, setPages] = useState<PageSource[]>([]); const [pageIndex, setPageIndex] = useState(0);
  const [selections, setSelections] = useState<Selection[]>([]); const [activeId, setActiveId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [ocrProgress, setOcrProgress] = useState("");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [selectedContentImageId, setSelectedContentImageId] = useState<number | null>(null);
  const [activeContentTextId, setActiveContentTextId] = useState<number | null>(null);
  const [activeOptionsId, setActiveOptionsId] = useState<number | null>(null);
  const [contentEditorScale, setContentEditorScale] = useState(1);
  const [zoomByPage, setZoomByPage] = useState<Record<number, number>>({});
  const [number, setNumber] = useState(1); const [folder, setFolder] = useState<any>(null);
  const sourceViewportRef = useRef<HTMLDivElement>(null); const sourceFileInputRef = useRef<HTMLInputElement>(null); const pageRef = useRef<HTMLDivElement>(null); const previewRef = useRef<HTMLCanvasElement>(null); const contentEditorFrameRef = useRef<HTMLDivElement>(null); const contentEditorRef = useRef<HTMLDivElement>(null); const contentImageDropGuideRef = useRef<HTMLDivElement>(null); const selectedContentTextRef = useRef<ContentTextSelection | null>(null); const nextId = useRef(1); const actionRef = useRef<PointerAction | null>(null); const contentImageDragRef = useRef<{ id: number; pointerId: number; startX: number; startY: number; element: HTMLElement; moved: boolean } | null>(null); const contentImageResizeRef = useRef<{ id: number; startX: number; startWidth: number } | null>(null);
  const activePage = pages[pageIndex]; const zoom = zoomByPage[pageIndex] || 1;
  const title = useMemo(() => [exam?.publisherName, exam?.examName].filter(Boolean).join(" - ") || "EduPanel", [exam]);

  useEffect(() => { const saved = Number(localStorage.getItem(`question-writer-next:${exam?.id || "main"}`)); if (saved > 0) setNumber(saved); }, [exam?.id]);
  useEffect(() => () => pages.forEach((page) => URL.revokeObjectURL(page.previewUrl)), [pages]);

  const replacePages = (next: PageSource[]) => { setPages((current) => { current.forEach((page) => URL.revokeObjectURL(page.previewUrl)); return next; }); setPageIndex(0); setZoomByPage({}); setSelections([]); setActiveId(null); setStatus(`${next.length} kaynak sayfa hazır.`); };
  const readFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return; setBusy(true); setStatus("");
    try {
      const next: PageSource[] = [];
      for (const file of Array.from(files)) {
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          const pdfjs: any = await import(/* @vite-ignore */ PDF_JS_URL); pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
          const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
          for (let index = 1; index <= pdf.numPages; index += 1) {
            const page = await pdf.getPage(index); const viewport = page.getViewport({ scale: 2.5 }); const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
            next.push({ canvas, previewUrl: canvas.toDataURL("image/png"), name: `${file.name} • Sayfa ${index}` });
          }
        } else if (/^image\/(png|jpeg)/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)) {
          const image = await loadFileImage(file); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")!.drawImage(image, 0, 0);
          next.push({ canvas, previewUrl: canvas.toDataURL("image/png"), name: file.name });
        } else throw new Error(`${file.name} desteklenmiyor.`);
      }
      replacePages(next);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Dosya açılamadı."); } finally { setBusy(false); }
  };
  const openSourcePicker = async () => {
    if (!window.showOpenFilePicker) { sourceFileInputRef.current?.click(); return; }
    try {
      const handles = await window.showOpenFilePicker({
        startIn: "desktop",
        multiple: true,
        excludeAcceptAllOption: true,
        types: [{ description: "PDF, JPG veya PNG", accept: { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] } }],
      });
      await readFiles(await Promise.all(handles.map((handle) => handle.getFile())));
    } catch (error: any) {
      if (error?.name !== "AbortError") sourceFileInputRef.current?.click();
    }
  };
  useEffect(() => {
    const viewport = sourceViewportRef.current;
    if (phase !== "source" || !viewport || !activePage) return;
    const handleSourceZoom = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      setZoomByPage((current) => ({ ...current, [pageIndex]: clamp((current[pageIndex] || 1) + delta, 0.35, 3) }));
    };
    viewport.addEventListener("wheel", handleSourceZoom, { passive: false });
    return () => viewport.removeEventListener("wheel", handleSourceZoom);
  }, [phase, pageIndex, activePage]);
  const pointOnPage = (event: React.PointerEvent): Point => { const bounds = pageRef.current!.getBoundingClientRect(); return { x: clamp((event.clientX - bounds.left) * activePage.canvas.width / bounds.width, 0, activePage.canvas.width), y: clamp((event.clientY - bounds.top) * activePage.canvas.height / bounds.height, 0, activePage.canvas.height) }; };
  const beginDraw = (event: React.PointerEvent) => {
    if (!activePage || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-selection]") && !event.ctrlKey) return;
    event.preventDefault(); event.stopPropagation(); pageRef.current?.setPointerCapture(event.pointerId);
    const point = pointOnPage(event); const id = nextId.current++;
    actionRef.current = { kind: "draw", id, start: point, pageIndex };
    const selection: Selection = { id, kind: "text", pageIndex, x: point.x, y: point.y, width: 0, height: 0 };
    setSelections((current) => [...current, selection]); setActiveId(selection.id);
  };
  const beginMove = (event: React.PointerEvent, selection: Selection) => {
    if (event.button !== 0) return;
    if (event.ctrlKey) { beginDraw(event); return; }
    event.stopPropagation(); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); setActiveId(selection.id); actionRef.current = { kind: "move", start: pointOnPage(event), original: { ...selection } };
  };
  const beginResize = (event: React.PointerEvent, selection: Selection, edge: Edge) => {
    if (event.button !== 0) return;
    if (event.ctrlKey) { beginDraw(event); return; }
    event.stopPropagation(); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); setActiveId(selection.id); actionRef.current = { kind: "resize", start: pointOnPage(event), original: { ...selection }, edge };
  };
  const updatePointer = (event: React.PointerEvent) => {
    const action = actionRef.current; if (!action || !activePage) return; const point = pointOnPage(event);
    setSelections((current) => current.map((selection) => {
      const actionId = action.kind === "draw" ? action.id : action.original.id; if (selection.id !== actionId) return selection;
      if (action.kind === "draw") return { ...selection, x: Math.min(action.start.x, point.x), y: Math.min(action.start.y, point.y), width: Math.abs(point.x - action.start.x), height: Math.abs(point.y - action.start.y) };
      const original = action.original; const dx = point.x - action.start.x; const dy = point.y - action.start.y;
      if (action.kind === "move") return { ...selection, x: clamp(original.x + dx, 0, activePage.canvas.width - original.width), y: clamp(original.y + dy, 0, activePage.canvas.height - original.height) };
      if (action.edge === "left") { const x = clamp(original.x + dx, 0, original.x + original.width - 8); return { ...selection, x, width: original.width + original.x - x }; }
      if (action.edge === "right") return { ...selection, width: clamp(original.width + dx, 8, activePage.canvas.width - original.x) };
      if (action.edge === "top") { const y = clamp(original.y + dy, 0, original.y + original.height - 8); return { ...selection, y, height: original.height + original.y - y }; }
      return { ...selection, height: clamp(original.height + dy, 8, activePage.canvas.height - original.y) };
    }));
  };
  const finishPointer = () => {
    const action = actionRef.current; actionRef.current = null;
    if (action?.kind === "draw") {
      const drawn = selections.find((item) => item.id === action.id); const valid = Boolean(drawn && drawn.width >= 8 && drawn.height >= 8);
      if (!valid) { setSelections((current) => current.filter((item) => item.id !== action.id)); setActiveId((active) => active === action.id ? null : active); }
    }
  };
  const cancelSelection = (event: React.MouseEvent, selectionId: number) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault(); event.stopPropagation(); actionRef.current = null;
    setSelections((current) => current.filter((item) => item.id !== selectionId));
    setActiveId((current) => current === selectionId ? null : current);
  };
  const cropSelection = (selection: Selection) => { const page = pages[selection.pageIndex]; const output = document.createElement("canvas"); output.width = Math.max(1, Math.round(selection.width)); output.height = Math.max(1, Math.round(selection.height)); const context = output.getContext("2d")!; context.imageSmoothingEnabled = false; context.drawImage(page.canvas, selection.x, selection.y, selection.width, selection.height, 0, 0, output.width, output.height); return output; };
  const prepareTurkishOcrImage = (selection: Selection, enhance: boolean, excludedImageAreas: Selection[]) => {
    const source = cropSelection(selection);
    const sourceContext = source.getContext("2d")!;
    sourceContext.fillStyle = "white";
    excludedImageAreas.filter((area) => area.pageIndex === selection.pageIndex).forEach((area) => {
      const left = Math.max(selection.x, area.x); const top = Math.max(selection.y, area.y);
      const right = Math.min(selection.x + selection.width, area.x + area.width); const bottom = Math.min(selection.y + selection.height, area.y + area.height);
      if (right > left && bottom > top) sourceContext.fillRect(left - selection.x, top - selection.y, right - left, bottom - top);
    });
    const scale = Math.min(2.5, 4200 / Math.max(source.width, source.height));
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(source.width * scale)); output.height = Math.max(1, Math.round(source.height * scale));
    const context = output.getContext("2d", { willReadFrequently: true })!;
    context.fillStyle = "white"; context.fillRect(0, 0, output.width, output.height);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(source, 0, 0, output.width, output.height);
    if (enhance) {
      const image = context.getImageData(0, 0, output.width, output.height); const pixels = image.data;
      for (let index = 0; index < pixels.length; index += 4) {
        const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        const contrasted = clamp((gray - 128) * 1.35 + 128, 0, 255);
        pixels[index] = contrasted; pixels[index + 1] = contrasted; pixels[index + 2] = contrasted;
      }
      context.putImageData(image, 0, 0);
    }
    return output;
  };
  const ensureOcr = async () => { if (window.Tesseract) return window.Tesseract; await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("OCR motoru yüklenemedi.")); document.head.appendChild(script); }); return window.Tesseract; };
  const processSelections = async () => {
    const orderedSelections = [...selections].sort((left, right) => left.id - right.id);
    const imageSelections = orderedSelections.filter((item) => item.kind === "image");
    const textCount = orderedSelections.filter((item) => item.kind === "text").length;
    const imageCount = orderedSelections.length - textCount;
    if (!orderedSelections.length) { setStatus("Önce en az bir yazı veya resim alanı seçin."); return; }
    let worker: any = null;
    try {
      setBusy(true); const engine = textCount ? await ensureOcr() : null;
      if (engine?.createWorker) {
        worker = await engine.createWorker("tur", 1, { logger: (message: any) => { if (message?.status === "recognizing text") setOcrProgress(`Türkçe OCR: %${Math.round((message.progress || 0) * 100)}`); } });
      }
      const nextBlocks: ContentBlock[] = [];
      let textIndex = 0;
      for (const selection of orderedSelections) {
        if (selection.kind === "image") {
          nextBlocks.push({ id: selection.id, type: "image", url: cropSelection(selection).toDataURL("image/png"), align: "left", width: 38 });
          continue;
        }
        textIndex += 1; setOcrProgress(`Türkçe yazı alanı ${textIndex}/${textCount} doğrulanıyor…`);
        const enhanced = prepareTurkishOcrImage(selection, true, imageSelections); const natural = prepareTurkishOcrImage(selection, false, imageSelections);
        let first: any; let second: any;
        if (worker) {
          await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "300" }); first = await worker.recognize(enhanced);
          await worker.setParameters({ tessedit_pageseg_mode: "3", preserve_interword_spaces: "1", user_defined_dpi: "300" }); second = await worker.recognize(natural);
        } else {
          first = await engine.recognize(enhanced, "tur"); second = await engine.recognize(natural, "tur");
        }
        const best = Number(first?.data?.confidence || 0) >= Number(second?.data?.confidence || 0) ? first : second;
        const recognizedText = normalizeTurkishOcrParagraph(String(best?.data?.text || ""));
        if (!recognizedText) continue;
        const previousBlock = nextBlocks[nextBlocks.length - 1];
        if (previousBlock?.type === "text") previousBlock.text = [previousBlock.text.trimEnd(), recognizedText].filter(Boolean).join(" ");
        else {
          for (let index = nextBlocks.length - 1; index >= 0; index -= 1) {
            const earlierText = nextBlocks[index];
            if (earlierText.type === "text") { earlierText.text = `${earlierText.text.trimEnd()} `; break; }
          }
          nextBlocks.push({ id: selection.id, type: "text", text: recognizedText });
        }
      }
      const structuredBlocks: ContentBlock[] = []; let detectedOptionsId: number | null = null;
      nextBlocks.forEach((block) => {
        if (block.type !== "text" || detectedOptionsId != null) { structuredBlocks.push(block); return; }
        const parsed = parseAnswerOptions(block.text);
        if (!parsed) { structuredBlocks.push(block); return; }
        if (parsed.stem) structuredBlocks.push({ ...block, text: parsed.stem });
        detectedOptionsId = parsed.stem ? nextId.current++ : block.id;
        structuredBlocks.push({ id: detectedOptionsId, type: "options", options: parsed.options, layout: "1" });
      });
      setContentBlocks(structuredBlocks); setSelectedContentImageId(null); setActiveOptionsId(detectedOptionsId); setActiveContentTextId(structuredBlocks.find((item) => item.type === "text")?.id ?? null); setPhase("compose"); setStatus(`${textCount} Türkçe yazı ve ${imageCount} resim işlendi${detectedOptionsId != null ? "; cevap seçenekleri paragraftan ayrıldı" : ""}.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Seçimler işlenemedi."); } finally { if (worker) await worker.terminate().catch(() => undefined); setBusy(false); setOcrProgress(""); }
  };
  const renderPng = async () => {
    await document.fonts?.load(`${QUESTION_FONT_SIZE_PT}pt "MergeOne"`);
    const canvas = previewRef.current || document.createElement("canvas");
    canvas.width = 1400;
    const measureContext = canvas.getContext("2d")!;
    measureContext.font = `400 ${QUESTION_CANVAS_FONT_SIZE_PX}px ${QUESTION_FONT_FAMILY}`;
    const prepared = await Promise.all(contentBlocks.map(async (block) => block.type === "image" ? { block, image: await loadDataImage(block.url) } : { block }));
    type DrawCommand = { type: "text"; value: string; x: number; y: number } | { type: "image"; image: HTMLImageElement; x: number; y: number; width: number; height: number };
    type ActiveFloat = { align: "left" | "right"; width: number; bottom: number };
    const commands: DrawCommand[] = [];
    const contentWidth = Math.round(8 / 2.54 * 300); const contentX = (canvas.width - contentWidth) / 2; const lineHeight = QUESTION_CANVAS_FONT_SIZE_PX * 1.28; const imageGap = 0;
    let y = 170; let activeFloat: ActiveFloat | null = null;
    const lineArea = () => {
      if (!activeFloat || y >= activeFloat.bottom) { activeFloat = null; return { x: contentX, width: contentWidth }; }
      return activeFloat.align === "left"
        ? { x: contentX + activeFloat.width + imageGap, width: contentWidth - activeFloat.width - imageGap }
        : { x: contentX, width: contentWidth - activeFloat.width - imageGap };
    };
    const visibleWord = (value: string) => withoutSoftHyphens(value);
    const splitHyphenatedWord = (word: string, availableWidth: number) => {
      if (availableWidth <= 0) return null;
      const syllables = word.split("\u00ad"); if (syllables.length < 2) return null;
      let prefix = ""; let best: { head: string; tail: string } | null = null;
      for (let index = 0; index < syllables.length - 1; index += 1) {
        prefix += syllables[index]; const head = `${prefix}-`;
        if (measureContext.measureText(head).width <= availableWidth) best = { head, tail: syllables.slice(index + 1).join("\u00ad") };
      }
      return best;
    };
    const queueTextLine = (words: string[], area: { x: number; width: number }, justify: boolean) => {
      if (!words.length) return;
      const widths = words.map((word) => measureContext.measureText(word).width);
      const wordsWidth = widths.reduce((sum, width) => sum + width, 0); const regularSpace = measureContext.measureText(" ").width;
      const gap = justify && words.length > 1 && area.width > wordsWidth
        ? (area.width - wordsWidth) / (words.length - 1)
        : regularSpace;
      let x = area.x;
      words.forEach((word, index) => { commands.push({ type: "text", value: word, x, y }); x += widths[index] + gap; });
    };
    for (const item of prepared) {
      if (item.block.type === "image") {
        const image = (item as { block: Extract<ContentBlock, { type: "image" }>; image: HTMLImageElement }).image;
        const block = item.block;
        if (activeFloat && y < activeFloat.bottom) y = activeFloat.bottom;
        activeFloat = null;
        const requestedWidth = contentWidth * block.width / 100;
        const scale = Math.min(requestedWidth / image.width, 520 / image.height);
        const width = image.width * scale; const height = image.height * scale;
        if (block.align === "center") {
          commands.push({ type: "image", image, x: contentX + (contentWidth - width) / 2, y, width, height });
          y += height;
        } else {
          const x = block.align === "left" ? contentX : contentX + contentWidth - width;
          commands.push({ type: "image", image, x, y, width, height });
          activeFloat = { align: block.align, width, bottom: y + height };
        }
        continue;
      }
      if (item.block.type === "options") {
        if (activeFloat && y < activeFloat.bottom) y = activeFloat.bottom;
        activeFloat = null;
        y += 3 / 25.4 * 300;
        const columns = optionColumnCount(item.block.layout); const columnWidth = contentWidth / columns;
        optionRows(item.block.options, item.block.layout).forEach((row) => {
          const wrappedOptions = row.map((option) => {
            const words = `${option.letter}) ${option.text}`.trim().split(/\s+/); const lines: string[] = []; let line = "";
            words.forEach((word) => { const candidate = line ? `${line} ${word}` : word; if (line && measureContext.measureText(candidate).width > columnWidth - 8) { lines.push(line); line = word; } else line = candidate; });
            if (line) lines.push(line); return lines;
          });
          const rowLineCount = Math.max(1, ...wrappedOptions.map((lines) => lines.length));
          wrappedOptions.forEach((lines, columnIndex) => lines.forEach((line, lineIndex) => commands.push({ type: "text", value: line, x: contentX + columnIndex * columnWidth, y: y + lineIndex * lineHeight })));
          y += rowLineCount * lineHeight;
        });
        continue;
      }
      const paragraphs = String(item.block.text || " ").split(/\r?\n/);
      paragraphs.forEach((paragraph) => {
        const words = paragraph.trim().split(/\s+/).filter(Boolean).map((word) => hyphenateTurkishText(word));
        if (!words.length) { y += lineHeight; return; }
        while (words.length) {
          const area = lineArea(); const lineWords: string[] = []; let lineWidth = 0; let waitUntilAfterFloat = false;
          while (words.length) {
            const word = words[0]; const visible = visibleWord(word); const spaceWidth = lineWords.length ? measureContext.measureText(" ").width : 0;
            const wordWidth = measureContext.measureText(visible).width;
            if (lineWidth + spaceWidth + wordWidth <= area.width) {
              lineWords.push(visible); lineWidth += spaceWidth + wordWidth; words.shift(); continue;
            }
            const split = splitHyphenatedWord(word, area.width - lineWidth - spaceWidth);
            if (split) { lineWords.push(split.head); words[0] = split.tail; break; }
            if (!lineWords.length && activeFloat && y < activeFloat.bottom) { waitUntilAfterFloat = true; break; }
            if (!lineWords.length) { lineWords.push(visible); words.shift(); }
            break;
          }
          if (waitUntilAfterFloat) { y += lineHeight; continue; }
          queueTextLine(lineWords, area, words.length > 0); y += lineHeight;
        }
      });
    }
    if (activeFloat && y < activeFloat.bottom) y = activeFloat.bottom;
    canvas.height = Math.max(900, y + 100);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#0f172a"; context.font = "700 25px Arial"; context.fillText(title, 70, 65); context.fillStyle = "#16a34a"; context.fillRect(70, 95, 1260, 7);
    context.fillStyle = "#0f172a"; context.font = "700 40px Arial"; context.fillText(`${number}.`, 70, 170); context.font = `400 ${QUESTION_CANVAS_FONT_SIZE_PX}px ${QUESTION_FONT_FAMILY}`;
    commands.forEach((command) => {
      if (command.type === "text") { context.fillStyle = "#0f172a"; context.fillText(command.value, command.x, command.y); }
      else context.drawImage(command.image, command.x, command.y, command.width, command.height);
    });
    context.fillStyle = "#64748b"; context.font = "500 21px Arial"; context.fillText("EduPanel Soru Yaz", 70, canvas.height - 45); return canvas;
  };
  useEffect(() => { if (phase === "compose") void renderPng(); }, [phase, contentBlocks, number, title]);
  useEffect(() => {
    const frame = contentEditorFrameRef.current; if (phase !== "compose" || !frame) return;
    const logicalEightCentimeters = 8 / 2.54 * 96;
    const updateScale = () => setContentEditorScale(frame.clientWidth * QUESTION_EDITOR_VISUAL_WIDTH_RATIO / logicalEightCentimeters);
    updateScale(); const observer = new ResizeObserver(updateScale); observer.observe(frame); return () => observer.disconnect();
  }, [phase]);
  const updateImageBlock = (id: number, changes: Partial<Pick<Extract<ContentBlock, { type: "image" }>, "align" | "width">>) => setContentBlocks((current) => current.map((item) => item.id === id && item.type === "image" ? { ...item, ...changes } : item));
  const applyContentTextAction = (action: "main" | "root" | "indent") => {
    const selected = selectedContentTextRef.current;
    if (!selected || selected.start === selected.end) { setStatus("Önce mouse ile biçimlendirilecek metni seçin."); return; }
    let formattedBlockId: number | null = null;
    setContentBlocks((current) => {
      const targetIndex = current.findIndex((item) => item.id === selected.blockId && item.type === "text");
      const target = current[targetIndex];
      if (targetIndex < 0 || target?.type !== "text") return current;
      const start = clamp(selected.start, 0, target.text.length); const end = clamp(selected.end, start, target.text.length);
      if (start === end) return current;
      const before = target.text.slice(0, start); const selectedText = target.text.slice(start, end); const after = target.text.slice(end);
      const replacement: ContentBlock[] = [];
      if (before) replacement.push({ ...target, text: before });
      formattedBlockId = before ? nextId.current++ : target.id;
      replacement.push(action === "indent"
        ? { ...target, id: formattedBlockId, text: selectedText, indented: !target.indented }
        : { ...target, id: formattedBlockId, text: selectedText, role: action });
      if (after) replacement.push({ ...target, id: nextId.current++, text: after });
      const next = [...current]; next.splice(targetIndex, 1, ...replacement); return next;
    });
    selectedContentTextRef.current = null;
    window.getSelection()?.removeAllRanges();
    if (formattedBlockId != null) setActiveContentTextId(formattedBlockId);
    setStatus(action === "main" ? "Seçili metin ana metin biçimine getirildi." : action === "root" ? "Seçili metin soru kökü olarak biçimlendirildi." : "Seçili metnin girintisi değiştirildi.");
  };
  const applyAnswerLayout = (layout: AnswerLayout) => {
    const existingOptions = (contentBlocks.find((item) => item.type === "options" && item.id === activeOptionsId) || contentBlocks.find((item) => item.type === "options")) as Extract<ContentBlock, { type: "options" }> | undefined;
    if (existingOptions) {
      setContentBlocks((current) => current.map((item) => item.id === existingOptions.id && item.type === "options" ? { ...item, layout } : item));
      setActiveOptionsId(existingOptions.id); setStatus(`Seçenek düzeni ${layout} olarak ayarlandı.`); return;
    }
    const textBlocks = contentBlocks.filter((item): item is Extract<ContentBlock, { type: "text" }> => item.type === "text");
    const preferred = textBlocks.find((item) => item.id === activeContentTextId && parseAnswerOptions(item.text));
    const sourceBlock = preferred || [...textBlocks].reverse().find((item) => parseAnswerOptions(item.text));
    const parsed = sourceBlock ? parseAnswerOptions(sourceBlock.text) : null;
    if (!sourceBlock || !parsed) { setStatus("A)–E) biçiminde cevap seçenekleri bulunamadı."); return; }
    const optionsId = parsed.stem ? nextId.current++ : sourceBlock.id;
    setContentBlocks((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceBlock.id); if (sourceIndex < 0) return current;
      const replacement: ContentBlock[] = [];
      if (parsed.stem) replacement.push({ ...sourceBlock, text: parsed.stem });
      replacement.push({ id: optionsId, type: "options", options: parsed.options, layout });
      const next = [...current]; next.splice(sourceIndex, 1, ...replacement); return next;
    });
    setActiveOptionsId(optionsId); setActiveContentTextId(parsed.stem ? sourceBlock.id : null); setStatus(`Seçenekler ${layout} düzenine yerleştirildi.`);
  };
  const mergeTextBlocks = (id: number, direction: -1 | 1) => {
    const currentIndex = contentBlocks.findIndex((item) => item.id === id);
    let neighborIndex = currentIndex + direction;
    while (neighborIndex >= 0 && neighborIndex < contentBlocks.length && contentBlocks[neighborIndex].type === "image") neighborIndex += direction;
    const currentBlock = contentBlocks[currentIndex]; const neighborBlock = contentBlocks[neighborIndex];
    if (currentBlock?.type !== "text" || neighborBlock?.type !== "text") return;
    const leftBlock = direction === -1 ? neighborBlock : currentBlock; const rightBlock = direction === -1 ? currentBlock : neighborBlock;
    const mergedText = `${leftBlock.text}${rightBlock.text}`; const caretOffset = leftBlock.text.length;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setContentBlocks((current) => {
      const leftIndex = current.findIndex((item) => item.id === leftBlock.id); const rightIndex = current.findIndex((item) => item.id === rightBlock.id);
      if (leftIndex < 0 || rightIndex <= leftIndex || current.slice(leftIndex + 1, rightIndex).some((item) => item.type !== "image")) return current;
      return current
        .filter((item) => item.id !== rightBlock.id)
        .map((item) => item.id === leftBlock.id && item.type === "text" ? { ...item, text: mergedText } : item);
    });
    requestAnimationFrame(() => {
      const editor = contentEditorRef.current?.querySelector<HTMLElement>(`[data-text-block-id="${leftBlock.id}"]`);
      if (editor) { editor.innerText = mergedText; placeCaretAtTextOffset(editor, caretOffset); }
    });
  };
  const resolveContentImageDropTarget = (clientX: number, clientY: number) => {
    const editor = contentEditorRef.current; if (!editor) return null;
    const editorBounds = editor.getBoundingClientRect(); const x = clamp(clientX, editorBounds.left, editorBounds.right); const y = clamp(clientY, editorBounds.top, editorBounds.bottom);
    const textEditors = Array.from(editor.querySelectorAll<HTMLElement>("[data-text-block-id]"))
      .map((element) => ({ element, id: Number(element.dataset.textBlockId), bounds: element.getBoundingClientRect() }))
      .filter((item) => Number.isFinite(item.id));
    if (textEditors.length) {
      const first = textEditors[0]; const last = textEditors[textEditors.length - 1];
      if (y <= first.bounds.top) return { anchorId: first.id, textTarget: { id: first.id, offset: 0 }, placeAfter: false };
      if (y >= last.bounds.bottom) return { anchorId: last.id, textTarget: { id: last.id, offset: withoutSoftHyphens(last.element.innerText).length }, placeAfter: true };
      const nearest = textEditors.reduce((best, item) => {
        const verticalDistance = y < item.bounds.top ? item.bounds.top - y : y > item.bounds.bottom ? y - item.bounds.bottom : 0;
        const horizontalDistance = x < item.bounds.left ? item.bounds.left - x : x > item.bounds.right ? x - item.bounds.right : 0;
        const distance = verticalDistance * 10000 + horizontalDistance;
        return distance < best.distance ? { item, distance } : best;
      }, { item: textEditors[0], distance: Number.POSITIVE_INFINITY }).item;
      return { anchorId: nearest.id, textTarget: { id: nearest.id, offset: textOffsetAtPoint(nearest.element, x, y) }, placeAfter: false };
    }
    const otherImages = Array.from(editor.querySelectorAll<HTMLElement>("[data-content-image]"))
      .filter((element) => Number(element.dataset.contentImageId) !== contentImageDragRef.current?.id)
      .map((element) => ({ id: Number(element.dataset.contentImageId), bounds: element.getBoundingClientRect() }))
      .filter((item) => Number.isFinite(item.id));
    if (!otherImages.length) return { anchorId: undefined, textTarget: undefined, placeAfter: true };
    const nearest = otherImages.reduce((best, item) => Math.abs(y - (item.bounds.top + item.bounds.bottom) / 2) < Math.abs(y - (best.bounds.top + best.bounds.bottom) / 2) ? item : best);
    return { anchorId: nearest.id, textTarget: undefined, placeAfter: y > (nearest.bounds.top + nearest.bounds.bottom) / 2 };
  };
  const placeContentImage = (imageId: number, clientX: number, target: NonNullable<ReturnType<typeof resolveContentImageDropTarget>>) => {
    const bounds = contentEditorRef.current?.getBoundingClientRect(); if (!bounds) return;
    const horizontalRatio = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const align: ImageAlignment = horizontalRatio < 0.46 ? "left" : horizontalRatio > 0.54 ? "right" : "center";
    setContentBlocks((current) => {
      const fromIndex = current.findIndex((item) => item.id === imageId); if (fromIndex < 0) return current;
      const withoutDragged = [...current]; const [dragged] = withoutDragged.splice(fromIndex, 1); const moved = dragged.type === "image" ? { ...dragged, align } : dragged;
      const repaired = coalesceAdjacentTextBlocks(withoutDragged, target.textTarget); const next = repaired.blocks; const repairedTextTarget = repaired.target;
      if (repairedTextTarget) {
        const textIndex = next.findIndex((item) => item.id === repairedTextTarget.id && item.type === "text");
        const textBlock = next[textIndex];
        if (textIndex >= 0 && textBlock?.type === "text") {
          const offset = snapToWordBoundary(textBlock.text, repairedTextTarget.offset); const before = textBlock.text.slice(0, offset); const after = textBlock.text.slice(offset);
          const replacement: ContentBlock[] = [];
          if (before) replacement.push({ ...textBlock, text: before });
          replacement.push(moved);
          if (after) replacement.push(before ? { id: nextId.current++, type: "text", text: after } : { ...textBlock, text: after });
          next.splice(textIndex, 1, ...replacement); return next;
        }
      }
      const anchorIndex = target.anchorId == null ? -1 : next.findIndex((item) => item.id === target.anchorId);
      const insertionIndex = anchorIndex < 0 ? (target.placeAfter ? next.length : 0) : anchorIndex + (target.placeAfter ? 1 : 0);
      next.splice(clamp(insertionIndex, 0, next.length), 0, moved); return next;
    });
    setSelectedContentImageId(imageId);
    setStatus(`Resim ${target.textTarget ? "tam metin konumuna" : "içeriğe"} ${align === "left" ? "sola" : align === "right" ? "sağa" : "ortaya"} yerleştirildi.`);
  };
  const resetContentImageDragStyle = (element: HTMLElement) => {
    element.style.removeProperty("transform"); element.style.removeProperty("z-index"); element.style.removeProperty("opacity"); element.style.removeProperty("pointer-events");
    if (contentImageDropGuideRef.current) contentImageDropGuideRef.current.style.display = "none";
  };
  const beginContentImageMove = (event: React.PointerEvent<HTMLElement>, imageId: number) => {
    if (event.button !== 0 || contentImageResizeRef.current) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedContentImageId(imageId);
    contentImageDragRef.current = { id: imageId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, element: event.currentTarget, moved: false };
  };
  const moveContentImage = (event: React.PointerEvent<HTMLElement>) => {
    const drag = contentImageDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 1) return;
    event.preventDefault(); event.stopPropagation(); drag.moved = true;
    drag.element.style.transform = `translate(${dx / Math.max(contentEditorScale, 0.01)}px, ${dy / Math.max(contentEditorScale, 0.01)}px)`;
    drag.element.style.zIndex = "60"; drag.element.style.opacity = "0.92"; drag.element.style.pointerEvents = "none";
    const editor = contentEditorRef.current; const guide = contentImageDropGuideRef.current;
    if (editor && guide) {
      const editorBounds = editor.getBoundingClientRect(); const scale = Math.max(contentEditorScale, 0.01);
      guide.style.display = "block";
      guide.style.left = `${clamp((event.clientX - editorBounds.left) / scale, 0, editor.offsetWidth)}px`;
      guide.style.top = `${clamp((event.clientY - editorBounds.top) / scale, 0, editor.offsetHeight)}px`;
    }
    const frame = contentEditorFrameRef.current;
    if (frame) {
      const frameBounds = frame.getBoundingClientRect(); const edge = 52;
      if (event.clientY < frameBounds.top + edge) frame.scrollTop -= 18;
      else if (event.clientY > frameBounds.bottom - edge) frame.scrollTop += 18;
    }
  };
  const finishContentImageMove = (event: React.PointerEvent<HTMLElement>, commit: boolean) => {
    const drag = contentImageDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); const target = commit && drag.moved ? resolveContentImageDropTarget(event.clientX, event.clientY) : null;
    resetContentImageDragStyle(drag.element);
    if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
    contentImageDragRef.current = null;
    if (target) placeContentImage(drag.id, event.clientX, target);
  };
  const beginContentImageResize = (event: React.PointerEvent<HTMLButtonElement>, block: Extract<ContentBlock, { type: "image" }>) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    contentImageResizeRef.current = { id: block.id, startX: event.clientX, startWidth: block.width }; setSelectedContentImageId(block.id);
  };
  const resizeContentImage = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = contentImageResizeRef.current; const editorWidth = contentEditorRef.current?.getBoundingClientRect().width || 1; if (!resize) return;
    updateImageBlock(resize.id, { width: Math.round(clamp(resize.startWidth + (resize.startX - event.clientX) * 100 / editorWidth, 15, 100)) });
  };
  const finishContentImageResize = (event: React.PointerEvent<HTMLButtonElement>) => { event.stopPropagation(); contentImageResizeRef.current = null; };
  const chooseFolder = async () => { if (!window.showDirectoryPicker) { setStatus("Chrome veya Edge klasör kaydını destekler."); return; } try { const handle = await window.showDirectoryPicker({ id: "edupanel-question-writer", mode: "readwrite" }); setFolder(handle); let max = 0; for await (const [name] of handle.entries()) { const match = String(name).match(/(\d+)\.png$/i); if (match) max = Math.max(max, Number(match[1])); } if (max) setNumber(max + 1); } catch (error: any) { if (error?.name !== "AbortError") setStatus("Klasör açılamadı."); } };
  const saveAndNext = async () => { if (!contentBlocks.length) { setStatus("Kaydedilecek soru içeriği yok."); return; } try { setBusy(true); const rendered = await renderPng(); const blob = await new Promise<Blob>((resolve, reject) => rendered.toBlob((value) => value ? resolve(value) : reject(new Error("PNG üretilemedi.")), "image/png")); const name = `${String(number).padStart(3, "0")}.png`; if (folder) { const handle = await folder.getFileHandle(name, { create: true }); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); } else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); } const next = number + 1; setNumber(next); localStorage.setItem(`question-writer-next:${exam?.id || "main"}`, String(next)); setContentBlocks([]); setSelectedContentImageId(null); setSelections([]); setPhase("source"); setStatus(`${name} kaydedildi. Yeni soru için kaynak ekranına dönüldü.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Kaydedilemedi."); } finally { setBusy(false); } };
  const activeContentText = contentBlocks.find((item) => item.id === activeContentTextId && item.type === "text") as Extract<ContentBlock, { type: "text" }> | undefined;
  const activeOptionsBlock = (contentBlocks.find((item) => item.id === activeOptionsId && item.type === "options") || contentBlocks.find((item) => item.type === "options")) as Extract<ContentBlock, { type: "options" }> | undefined;

  if (phase === "source") return <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">1. Kaynak ve alan seçimi</p><h2 className="text-xl font-black">Kaynak üzerinde alanları belirleyin</h2></div>
      <button disabled={busy || selections.length === 0} onClick={() => void processSelections()} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <ScanText className="h-4 w-4"/>}Seçimleri İşle ve Devam Et</button>
    </header>
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <input ref={sourceFileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(event) => { void readFiles(event.target.files); event.currentTarget.value = ""; }}/>
      {busy ? <div className="flex flex-1 items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>{ocrProgress || "Kaynak hazırlanıyor…"}</div> : !activePage ? (
        <button type="button" onClick={() => void openSourcePicker()} className="flex flex-1 flex-col items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/[0.03] hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/60">
          <FileImage className="h-16 w-16"/>
          <p className="mt-4 font-bold">PDF, JPG veya PNG seçmek için tıklayın.</p>
          <span className="mt-2 text-xs font-semibold text-slate-600">Dosya seçici Masaüstü konumunda açılır.</span>
          {status && <span className="mt-3 text-xs font-semibold text-rose-300">{status}</span>}
        </button>
      ) : <>
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
          <span className="truncate">{activePage.name.replace(/\s*•\s*Sayfa\s+\d+$/i, "")}</span>
          {pages.length > 1 && <div className="flex gap-1">
            <button type="button" disabled={pageIndex === 0} onClick={() => { setPageIndex((current) => Math.max(0, current - 1)); setActiveId(null); }} className="rounded-lg bg-white/10 p-2 disabled:opacity-25" aria-label="Önceki sayfa" title="Önceki sayfa"><ChevronLeft className="h-4 w-4"/></button>
            <button type="button" disabled={pageIndex === pages.length - 1} onClick={() => { setPageIndex((current) => Math.min(pages.length - 1, current + 1)); setActiveId(null); }} className="rounded-lg bg-white/10 p-2 disabled:opacity-25" aria-label="Sonraki sayfa" title="Sonraki sayfa"><ChevronRight className="h-4 w-4"/></button>
          </div>}
        </div>
        <div ref={sourceViewportRef} className="flex min-h-0 flex-1 overflow-auto overscroll-contain p-4">
          <div ref={pageRef} onPointerDown={beginDraw} onPointerMove={updatePointer} onPointerUp={finishPointer} onPointerCancel={finishPointer} className="relative m-auto shrink-0 touch-none select-none cursor-crosshair shadow-2xl" style={{ aspectRatio: `${activePage.canvas.width}/${activePage.canvas.height}`, width: `${zoom * 100}%`, maxWidth: "none" }}>
            <img src={activePage.previewUrl} draggable={false} className="block h-full w-full"/>
            {selections.filter((item) => item.pageIndex === pageIndex).map((selection) => {
              const sx = 100 / activePage.canvas.width, sy = 100 / activePage.canvas.height, active = selection.id === activeId;
              return <div key={selection.id} data-selection onPointerDown={(event) => beginMove(event, selection)} onDoubleClick={(event) => cancelSelection(event, selection.id)} className={`absolute cursor-move border-2 ${selection.kind === "text" ? "border-cyan-400 bg-cyan-300/10" : "border-amber-400 bg-amber-300/10"} ${active ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""}`} style={{ left: `${selection.x * sx}%`, top: `${selection.y * sy}%`, width: `${selection.width * sx}%`, height: `${selection.height * sy}%` }}>
                {active ? <div className="absolute -top-10 left-0 z-30 flex gap-1 rounded-xl bg-slate-950/95 p-1 shadow-xl" onPointerDown={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => setSelections((current) => current.map((item) => item.id === selection.id ? { ...item, kind: "text" } : item))} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black ${selection.kind === "text" ? "bg-cyan-500 text-slate-950" : "bg-white/10 text-white"}`}><Type className="h-3 w-3"/>METİN</button>
                  <button type="button" onClick={() => setSelections((current) => current.map((item) => item.id === selection.id ? { ...item, kind: "image" } : item))} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black ${selection.kind === "image" ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white"}`}><ImageIcon className="h-3 w-3"/>RESİM</button>
                </div> : <span className={`absolute -top-7 left-0 rounded px-2 py-1 text-[10px] font-black ${selection.kind === "text" ? "bg-cyan-500 text-slate-950" : "bg-amber-400 text-slate-950"}`}>{selection.kind === "text" ? "METİN" : "RESİM"}</span>}
                {active && (["left","right","top","bottom"] as Edge[]).map((edge) => <button key={edge} data-selection aria-label={`${edge} kenarını ayarla`} onPointerDown={(event) => beginResize(event, selection, edge)} className={`absolute z-20 bg-white shadow ring-2 ${selection.kind === "text" ? "ring-cyan-500" : "ring-amber-500"} ${edge === "left" ? "-left-2 top-1/2 h-12 w-4 -translate-y-1/2 cursor-ew-resize rounded-full" : edge === "right" ? "-right-2 top-1/2 h-12 w-4 -translate-y-1/2 cursor-ew-resize rounded-full" : edge === "top" ? "-top-2 left-1/2 h-4 w-12 -translate-x-1/2 cursor-ns-resize rounded-full" : "-bottom-2 left-1/2 h-4 w-12 -translate-x-1/2 cursor-ns-resize rounded-full"}`}/>) }
              </div>;
            })}
          </div>
        </div>
      </>}
    </main>
  </div>;

  return <div className="min-h-[calc(100vh-7rem)] space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-emerald-950 to-teal-700 p-5 text-white">
      <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200">2. Düzenleme + 3. PNG kayıt</p><h2 className="text-2xl font-black">Soruyu doğrulayın ve kaydedin</h2></div>
      <button onClick={() => setPhase("source")} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-black"><ArrowLeft className="h-4 w-4"/>Kaynak seçimlerine dön</button>
    </header>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div><h3 className="font-black">2. Soru içeriği</h3></div>
        <div ref={contentEditorFrameRef} className="mt-2 min-h-[960px] w-full overflow-auto rounded-2xl bg-slate-100 shadow-inner">
          <div
            ref={contentEditorRef}
            lang="tr"
            onPointerDown={(event) => { if (!(event.target as HTMLElement).closest("[data-content-image]")) setSelectedContentImageId(null); }}
            className="relative mx-auto min-h-[480px] overflow-hidden rounded-2xl border border-slate-300 bg-white"
            style={{ width: "8cm", containerType: "inline-size", transform: `scale(${contentEditorScale})`, transformOrigin: "center top", textAlign: "justify", textAlignLast: "left", hyphens: "manual" }}
          >
          {contentBlocks.map((block, index) => block.type === "text" ? (
            <EditableTextBlock
              key={block.id}
              block={block}
              onChange={(text) => { selectedContentTextRef.current = null; setContentBlocks((current) => current.map((item) => item.id === block.id && item.type === "text" ? { ...item, text } : item)); }}
              onActivate={() => { setActiveContentTextId(block.id); setActiveOptionsId(null); }}
              onSelect={(start, end) => { selectedContentTextRef.current = { blockId: block.id, start, end }; }}
              onMergeBackward={contentBlocks.slice(0, index).some((item) => item.type === "text") ? () => mergeTextBlocks(block.id, -1) : undefined}
              onMergeForward={contentBlocks.slice(index + 1).some((item) => item.type === "text") ? () => mergeTextBlocks(block.id, 1) : undefined}
            />
          ) : block.type === "options" ? (
            <EditableOptionsBlock
              key={block.id}
              block={block}
              onActivate={() => { setActiveOptionsId(block.id); setActiveContentTextId(null); setSelectedContentImageId(null); }}
              onChange={(optionIndex, text) => setContentBlocks((current) => current.map((item) => item.id === block.id && item.type === "options" ? { ...item, options: item.options.map((option, index) => index === optionIndex ? { ...option, text } : option) } : item))}
            />
          ) : (
            <figure
              key={block.id}
              data-content-image
              data-content-image-id={block.id}
              draggable={false}
              onPointerDown={(event) => beginContentImageMove(event, block.id)}
              onPointerMove={moveContentImage}
              onPointerUp={(event) => finishContentImageMove(event, true)}
              onPointerCancel={(event) => finishContentImageMove(event, false)}
              onClick={(event) => { event.stopPropagation(); setSelectedContentImageId(block.id); }}
              className="relative touch-none cursor-grab select-none active:cursor-grabbing"
              style={{
                width: `${block.width}%`,
                float: block.align === "center" ? undefined : block.align,
                clear: block.align === "center" ? "both" : "none",
                marginLeft: block.align === "center" ? "auto" : 0,
                marginRight: block.align === "center" ? "auto" : 0,
                marginBottom: 0,
                willChange: "transform",
              }}
            >
              <div className="relative">
                <img draggable={false} src={block.url} alt={`Soru içindeki ${index + 1}. görsel`} className="pointer-events-none block h-auto w-full select-none object-contain"/>
                {selectedContentImageId === block.id && <button
                  type="button"
                  draggable={false}
                  aria-label="Resmi sol alt köşeden boyutlandır"
                  title="Sol alt köşeden tutup resmi büyütün veya küçültün"
                  onPointerDown={(event) => beginContentImageResize(event, block)}
                  onPointerMove={resizeContentImage}
                  onPointerUp={finishContentImageResize}
                  onPointerCancel={finishContentImageResize}
                  className="absolute bottom-0 left-0 z-30 touch-none cursor-nesw-resize rounded-full border border-white bg-cyan-600 shadow"
                  style={{ width: "12pt", height: "12pt", transform: `translate(-35%, 35%) scale(${1 / contentEditorScale})`, transformOrigin: "center" }}
                />}
              </div>
            </figure>
          ))}
            <div ref={contentImageDropGuideRef} aria-hidden="true" className="pointer-events-none absolute z-[70] hidden rounded-full bg-cyan-500 shadow-[0_0_0_2px_rgba(255,255,255,.9)]" style={{ width: 2, height: 18, transform: `translate(-50%, -50%) scale(${1 / Math.max(contentEditorScale, 0.01)})`, transformOrigin: "center" }}/>
            <div className="clear-both"/>
          </div>
        </div>
      </section>
      <aside className="h-fit rounded-3xl border bg-white p-4 shadow-sm xl:sticky xl:top-4">
        <div className="grid gap-2">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyContentTextAction("main")} className={`rounded-xl border px-4 py-3 text-sm font-black ${activeContentText && activeContentText.role !== "root" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Ana metin</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyContentTextAction("root")} className={`rounded-xl border px-4 py-3 text-sm font-black ${activeContentText?.role === "root" ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Soru Kökü</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyContentTextAction("indent")} className={`rounded-xl border px-4 py-3 text-sm font-black ${activeContentText?.indented ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Girinti</button>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Seçenekler</h4>
          <div className="grid grid-cols-2 gap-2">
            {(["1", "3-2", "2-2-1", "5"] as AnswerLayout[]).map((layout) => <button key={layout} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyAnswerLayout(layout)} className={`rounded-xl border px-3 py-3 text-sm font-black ${activeOptionsBlock?.layout === layout ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{layout}</button>)}
          </div>
        </div>
        {status && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-600">{status}</p>}
      </aside>
    </div>
  </div>;
}











