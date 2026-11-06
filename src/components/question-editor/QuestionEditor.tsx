import React, { useEffect, useRef } from "react";
import { FolderOpen, Image as ImageIcon, Save, Type, X } from "lucide-react";
import type { AnswerLayout, EditorStage, QuestionDraft, QuestionImage, SpecialBlock } from "./questionTypes";
import {
  clamp,
  DEFAULT_QUESTION_FONT,
  EDITOR_VISUAL_SCALE,
  formatQuestionHtml,
  getSelectionRangeInValue,
  IMAGE_GAP_PX,
  installRootHighlight,
  installSpecialHighlight,
  QUESTION_CSS_WIDTH_PX,
  ROOT_HIGHLIGHT_NAME,
  SPECIAL_HIGHLIGHT_NAME,
} from "./questionLayout";

type AnnotationSnapshot = {
  rootRanges: QuestionDraft["rootRanges"];
  specialBlocks: QuestionDraft["specialBlocks"];
};

type AnnotationHistory = {
  undo: AnnotationSnapshot[];
  redo: AnnotationSnapshot[];
};

const cloneAnnotationSnapshot = (draft: QuestionDraft): AnnotationSnapshot => ({
  rootRanges: draft.rootRanges.map((range) => ({ ...range })),
  specialBlocks: (draft.specialBlocks || []).map((block) => ({
    ...block,
    items: block.items.map((item) => ({ ...item })),
  })),
});

const EditableQuestionText: React.FC<{
  value: string;
  fontFamily: string;
  fontSize: number;
  answerLayout: AnswerLayout;
  rootRanges: Array<{ start: number; end: number; text?: string }>;
  specialStart: number;
  specialEnd: number;
  specialBlocks: SpecialBlock[];
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
}> = ({
  value,
  fontFamily,
  fontSize,
  answerLayout,
  rootRanges,
  specialStart,
  specialEnd,
  specialBlocks,
  editorRef,
  onChange,
}) => {
  const internalRef = useRef<HTMLDivElement | null>(null);

  const assignRef = (node: HTMLDivElement | null) => {
    internalRef.current = node;
    editorRef.current = node;
  };

  useEffect(() => {
    const element = internalRef.current;
    if (!element) return;

    // Düzenleme alanı yalnız düz metindir. Biçimlendirme DOM'a yazılmaz.
    if (document.activeElement !== element && element.textContent !== value) {
      element.textContent = value;
    }
  }, [value]);

  useEffect(() => {
    const element = internalRef.current;
    if (!element) return;

    installRootHighlight(element, rootRanges);

    return () => {
      const css = CSS as any;
      css.highlights?.delete(ROOT_HIGHLIGHT_NAME);
    };
  }, [rootRanges, value, answerLayout]);

  useEffect(() => {
    const element = internalRef.current;
    if (!element) return;
    installSpecialHighlight(element, specialBlocks);
    return () => {
      const css = CSS as any;
      css.highlights?.delete(SPECIAL_HIGHLIGHT_NAME);
    };
  }, [specialBlocks, value, answerLayout]);

  return <div
    ref={assignRef}
    data-question-editor="true"
    lang="tr"
    contentEditable="plaintext-only"
    suppressContentEditableWarning
    spellCheck
    onInput={(event) =>
      onChange((event.currentTarget.innerText || event.currentTarget.textContent || "").replace(/\u00AD/g, ""))
    }
    onBlur={(event) => {
      const rawText = (event.currentTarget.innerText || event.currentTarget.textContent || "")
        .replace(/\u00AD/g, "");
      onChange(rawText);
      if (event.currentTarget.textContent !== rawText) {
        event.currentTarget.textContent = rawText;
      }
    }}
    className="relative z-10 min-h-full whitespace-pre-wrap outline-none"
    style={{
      fontFamily,
      fontSize: `${fontSize}pt`,
      lineHeight: 1.28,
      textAlign: "justify",
      textAlignLast: "left",
      hyphens: "manual",
      WebkitHyphens: "manual",
      wordBreak: "normal",
      overflowWrap: "normal",
      lineBreak: "auto",
    }}
  />;
};

const FormattedQuestionText: React.FC<{
  value: string;
  fontFamily: string;
  fontSize: number;
  answerLayout: AnswerLayout;
  rootRanges: Array<{ start: number; end: number; text?: string }>;
  specialStart: number;
  specialEnd: number;
  specialBlocks: SpecialBlock[];
}> = ({
  value,
  fontFamily,
  fontSize,
  answerLayout,
  rootRanges,
  specialStart,
  specialEnd,
  specialBlocks,
}) => <div
  lang="tr"
  className="relative z-10 min-h-full whitespace-pre-wrap"
  style={{
    fontFamily,
    fontSize: `${fontSize}pt`,
    lineHeight: 1.28,
    textAlign: "justify",
    textAlignLast: "left",
    hyphens: "manual",
    WebkitHyphens: "manual",
    wordBreak: "normal",
    overflowWrap: "normal",
    lineBreak: "auto",
  }}
  dangerouslySetInnerHTML={{
    __html: formatQuestionHtml(value, answerLayout, rootRanges, specialStart, specialEnd, specialBlocks),
  }}
/>;


const QuestionTextWithBlockImages: React.FC<{
  draft: QuestionDraft;
  editorStage: "edit" | "preview";
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onSelectImage: (id: string) => void;
  selectedImageId: string | null;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>, image: QuestionImage) => void;
  onDragMove: (event: React.PointerEvent<HTMLDivElement>, imageId: string) => void;
  onDragEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, image: QuestionImage) => void;
  onResizeMove: (event: React.PointerEvent<HTMLButtonElement>, imageId: string) => void;
  onResizeEnd: () => void;
}> = ({
  draft,
  editorStage,
  editorRef,
  onChange,
  onSelectImage,
  selectedImageId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}) => {
  const imageGeometry = (image: QuestionImage) => {
    const widthPx = QUESTION_CSS_WIDTH_PX * image.widthPercent / 100;
    const heightPx = widthPx / Math.max(0.2, image.aspectRatio);
    const gap = IMAGE_GAP_PX;

    const imageLeft =
      image.flow === "text-left"
        ? QUESTION_CSS_WIDTH_PX - widthPx
        : image.flow === "text-right"
          ? 0
          : clamp(
              QUESTION_CSS_WIDTH_PX * image.xPercent / 100,
              0,
              Math.max(0, QUESTION_CSS_WIDTH_PX - widthPx),
            );

    return {
      widthPx,
      heightPx,
      imageLeft,
      exclusionTop: Math.max(0, image.yPx - gap),
      exclusionBottom: Math.max(0, image.yPx + heightPx + gap),
    };
  };

  return <div
    className="relative z-10 min-h-full flow-root"
    style={{
      fontFamily: draft.fontFamily,
      fontSize: `${draft.fontSize}pt`,
      lineHeight: 1.28,
      textAlign: "justify",
      textAlignLast: "left",
    }}
  >
    {/* 
      Görünmez float/shape elemanları resmin gerçek geometrisini metin akışına bildirir.
      Önemli fark: float elemanına margin-top vermiyoruz. Shape polygon'u yalnız resmin
      bulunduğu Y aralığında alan kapatır; bu nedenle resmin üstündeki satırlar aşağı itilmez.
    */}
    {draft.images.map((image) => {
      const geometry = imageGeometry(image);
      const floatWidth =
        image.flow === "block"
          ? QUESTION_CSS_WIDTH_PX
          : geometry.widthPx + IMAGE_GAP_PX;

      const floatHeight = Math.max(
        1,
        geometry.exclusionBottom,
      );

      const topPercent = clamp(
        geometry.exclusionTop / floatHeight * 100,
        0,
        100,
      );
      const bottomPercent = clamp(
        geometry.exclusionBottom / floatHeight * 100,
        0,
        100,
      );

      // Rectangle-shaped exclusion only around the image's vertical band.
      const shape = `polygon(
        0 ${topPercent}%,
        100% ${topPercent}%,
        100% ${bottomPercent}%,
        0 ${bottomPercent}%
      )`;

      return <span
        key={`shape-${image.id}`}
        aria-hidden="true"
        className="pointer-events-none block"
        style={{
          float:
            image.flow === "text-left"
              ? "right"
              : "left",
          clear: image.flow === "block" ? "both" : "none",
          width: `${floatWidth}px`,
          height: `${floatHeight}px`,
          shapeOutside: shape,
          clipPath: "inset(100%)",
          margin: 0,
          padding: 0,
        }}
      />;
    })}

    {editorStage === "edit"
      ? <EditableQuestionText
          key={draft.id}
          value={draft.content}
          fontFamily={draft.fontFamily}
          fontSize={draft.fontSize}
          answerLayout={draft.answerLayout}
          rootRanges={draft.rootRanges}
          specialStart={draft.specialStart}
          specialEnd={draft.specialEnd}
          specialBlocks={draft.specialBlocks || []}
          editorRef={editorRef}
          onChange={onChange}
        />
      : <FormattedQuestionText
          value={draft.content}
          fontFamily={draft.fontFamily}
          fontSize={draft.fontSize}
          answerLayout={draft.answerLayout}
          rootRanges={draft.rootRanges}
          specialStart={draft.specialStart}
          specialEnd={draft.specialEnd}
          specialBlocks={draft.specialBlocks || []}
        />}

    {/* Resimler görünür katmanda absolute; metin akışını doğrudan itmezler. */}
    {draft.images.map((image) => {
      const geometry = imageGeometry(image);
      const selected = selectedImageId === image.id;

      return <div
        key={`image-${image.id}`}
        className={`absolute z-30 select-none ${
          editorStage === "edit"
            ? `cursor-move ${selected ? "ring-2 ring-emerald-400" : ""}`
            : ""
        }`}
        style={{
          left: `${geometry.imageLeft}px`,
          top: `${Math.max(0, image.yPx)}px`,
          width: `${geometry.widthPx}px`,
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (editorStage === "edit") onSelectImage(image.id);
        }}
        onPointerDown={(event) => {
          if (editorStage === "edit") onDragStart(event, image);
        }}
        onPointerMove={(event) => {
          if (editorStage === "edit") onDragMove(event, image.id);
        }}
        onPointerUp={(event) => {
          if (editorStage === "edit") onDragEnd(event);
        }}
      >
        <div
          className={`relative ${
            editorStage === "edit"
              ? "border-2 border-emerald-500 shadow-md"
              : ""
          }`}
        >
          <img
            src={image.dataUrl}
            alt="Soru görseli"
            draggable={false}
            className="block h-auto w-full bg-white"
          />

          {editorStage === "edit" && <button
            type="button"
            aria-label="Resmi yeniden boyutlandır"
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-emerald-600 shadow"
            onPointerDown={(event) => onResizeStart(event, image)}
            onPointerMove={(event) => onResizeMove(event, image.id)}
            onPointerUp={onResizeEnd}
          />}
        </div>
      </div>;
    })}
  </div>;
};



export type QuestionEditorProps = {
  drafts: QuestionDraft[];
  activeDraftIndex: number;
  activeDraft: QuestionDraft;
  editorStage: EditorStage;
  fontStatus: "loading" | "ready" | "error";
  ocrFolderName: string;
  editorSurfaceRef: React.MutableRefObject<HTMLDivElement | null>;
  questionTextEditorRef: React.MutableRefObject<HTMLDivElement | null>;
  selectedEditorImageId: string | null;
  resizingQuestionHeight: { startClientY: number; startHeightPx: number } | null;
  draggingImageId: string | null;
  resizingImageId: string | null;
  onClose: () => void;
  onSetActiveDraft: (index: number) => void;
  onSetEditorStage: (stage: EditorStage) => void;
  onSelectEditorImage: (id: string | null) => void;
  onSetResizingQuestionHeight: (value: { startClientY: number; startHeightPx: number } | null) => void;
  onUpdateDraft: (index: number, patch: Partial<QuestionDraft>) => void;
  onUpdateImage: (index: number, imageId: string, patch: Partial<QuestionImage>) => void;
  onBeginImageDrag: (event: React.PointerEvent<HTMLDivElement>, image: QuestionImage) => void;
  onMoveImageDrag: (event: React.PointerEvent<HTMLDivElement>, index: number) => void;
  onEndImageDrag: () => void;
  onBeginImageResize: (event: React.PointerEvent<HTMLButtonElement>, image: QuestionImage) => void;
  onMoveImageResize: (event: React.PointerEvent<HTMLButtonElement>, index: number) => void;
  onEndImageResize: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onSavePng: (index: number) => void | Promise<void>;
  onChooseFolder: () => void | Promise<void>;
  onError: (message: string) => void;
};

export default function QuestionEditor(props: QuestionEditorProps) {
  const {
    drafts, activeDraftIndex, activeDraft, editorStage, fontStatus, ocrFolderName,
    editorSurfaceRef, questionTextEditorRef, selectedEditorImageId, resizingQuestionHeight,
    draggingImageId, resizingImageId, onClose, onSetActiveDraft, onSetEditorStage,
    onSelectEditorImage, onSetResizingQuestionHeight, onUpdateDraft, onUpdateImage,
    onBeginImageDrag, onMoveImageDrag, onEndImageDrag, onBeginImageResize,
    onMoveImageResize, onEndImageResize, onSavePng, onChooseFolder, onError,
  } = props;

  const annotationHistoryRef = useRef<Record<string, AnnotationHistory>>({});

  const historyFor = (draftId: string): AnnotationHistory => {
    if (!annotationHistoryRef.current[draftId]) {
      annotationHistoryRef.current[draftId] = { undo: [], redo: [] };
    }
    return annotationHistoryRef.current[draftId];
  };

  const pushAnnotationHistory = () => {
    const history = historyFor(activeDraft.id);
    history.undo.push(cloneAnnotationSnapshot(activeDraft));
    if (history.undo.length > 50) history.undo.shift();
    history.redo = [];
  };

  const undoAnnotation = () => {
    const history = historyFor(activeDraft.id);
    const previous = history.undo.pop();
    if (!previous) {
      onError("Geri alınacak biçimlendirme işlemi yok.");
      return;
    }
    history.redo.push(cloneAnnotationSnapshot(activeDraft));
    onUpdateDraft(activeDraftIndex, {
      rootRanges: previous.rootRanges,
      specialBlocks: previous.specialBlocks,
    });
    onError("");
  };

  const redoAnnotation = () => {
    const history = historyFor(activeDraft.id);
    const next = history.redo.pop();
    if (!next) {
      onError("Yinelenecek biçimlendirme işlemi yok.");
      return;
    }
    history.undo.push(cloneAnnotationSnapshot(activeDraft));
    onUpdateDraft(activeDraftIndex, {
      rootRanges: next.rootRanges,
      specialBlocks: next.specialBlocks,
    });
    onError("");
  };

  const applyQuestionRoot = () => {
    const editor = questionTextEditorRef.current;
    if (!editor) return;
    const offsets = getSelectionRangeInValue(editor, activeDraft.content);
    if (!offsets || offsets.start === offsets.end) {
      onError("Önce Soru Alanı içinden soru kökü olacak yazıyı seçin.");
      return;
    }
    const selectedText = window.getSelection()?.toString().replace(/\u00AD/g, "") || "";
    const next = [...activeDraft.rootRanges];
    if (!next.some((r) => r.start === offsets.start && r.end === offsets.end && r.text === selectedText)) {
      pushAnnotationHistory();
      next.push({ start: offsets.start, end: offsets.end, text: selectedText });
      onUpdateDraft(activeDraftIndex, { rootRanges: next });
    }
    window.getSelection()?.removeAllRanges();
    onError("");
  };

  const applySpecialArea = () => {
    const editor = questionTextEditorRef.current;
    if (!editor) return;

    const offsets = getSelectionRangeInValue(editor, activeDraft.content);
    if (!offsets || offsets.start === offsets.end) {
      onError("Önce I., II., III. gibi maddeleri seçin.");
      return;
    }

    const content = activeDraft.content;
    const rawStart = clamp(offsets.start, 0, content.length);
    const rawEnd = clamp(offsets.end, rawStart, content.length);
    const lineStart = content.lastIndexOf("\n", Math.max(0, rawStart - 1)) + 1;
    const nextBreak = content.indexOf("\n", rawEnd);
    const lineEnd = nextBreak < 0 ? content.length : nextBreak;
    const selectedLines = content.slice(lineStart, lineEnd).split("\n");
    const romanRe = /^\s*([Iİıi1lL(]{1,4}|[Iİıi1lL(]*[VvXx][Iİıi1lL(]*)\.\s*(.+)$/;

    const romanRows = selectedLines
      .map((line, index) => ({ line, index, match: line.match(romanRe) }))
      .filter((row) => Boolean(row.match));

    if (!romanRows.length) {
      onError("Seçilen alanda I., II., III. biçiminde madde bulunamadı.");
      return;
    }

    // Yalnız ilk ve son Roman maddesi arasını blok yap; normal satırlar seçime karışmaz.
    const first = romanRows[0].index;
    const last = romanRows[romanRows.length - 1].index;
    let blockStart = lineStart;
    for (let index = 0; index < first; index += 1) blockStart += selectedLines[index].length + 1;
    let blockEnd = blockStart;
    for (let index = first; index <= last; index += 1) {
      blockEnd += selectedLines[index].length;
      if (index < last) blockEnd += 1;
    }

    const sourceText = content.slice(blockStart, blockEnd);
    const normalizeRomanMarker = (token: string) =>
      token
        .replace(/[İıi1lL(]/g, "I")
        .replace(/[vV]/g, "V")
        .replace(/[xX]/g, "X")
        .toUpperCase();

    const items = sourceText.split("\n").map((line) => line.match(romanRe)).filter(Boolean).map((match) => ({
      marker: `${normalizeRomanMarker((match as RegExpMatchArray)[1])}.`,
      text: (match as RegExpMatchArray)[2].trim(),
    }));

    if (!items.length) {
      onError("Özel Alan maddeleri oluşturulamadı.");
      return;
    }

    const current = activeDraft.specialBlocks || [];
    const duplicate = current.some((block) =>
      block.start === blockStart && block.end === blockEnd && block.sourceText === sourceText
    );
    if (duplicate) {
      window.getSelection()?.removeAllRanges();
      onError("");
      return;
    }

    const nextBlocks = [
      ...current.filter((block) => block.end <= blockStart || block.start >= blockEnd),
      {
        id: `special-${blockStart}-${blockEnd}`,
        start: blockStart,
        end: blockEnd,
        sourceText,
        items,
      },
    ].sort((a, b) => a.start - b.start);

    // Kritik: contentEditable DOM'una hiçbir HTML eklenmez/değiştirilmez.
    pushAnnotationHistory();
    onUpdateDraft(activeDraftIndex, { specialBlocks: nextBlocks });
    window.getSelection()?.removeAllRanges();
    onError("");
  };

  const removeSpecialBlock = (id: string) => {
    const nextBlocks = (activeDraft.specialBlocks || []).filter((block) => block.id !== id);
    if (nextBlocks.length === (activeDraft.specialBlocks || []).length) return;
    pushAnnotationHistory();
    onUpdateDraft(activeDraftIndex, { specialBlocks: nextBlocks });
    onError("");
  };

  return <div className="fixed inset-0 z-[150] flex flex-col bg-slate-100">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div>
        <h3 className="font-black text-slate-900">{editorStage === "edit" ? "OCR Soru Düzenleyici" : "Soru Önizlemesi"}</h3>
        <p className="text-xs text-slate-500">Soru düzeni artık bağımsız QuestionEditor bileşeni tarafından yönetiliyor.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {drafts.map((draft, index) => <button key={draft.id} type="button" onClick={() => { onSetActiveDraft(index); onSetEditorStage("edit"); onSelectEditorImage(null); }} className={`rounded-lg px-3 py-2 text-xs font-black ${activeDraftIndex === index ? "bg-violet-600 text-white" : draft.saved ? "bg-emerald-100 text-emerald-800" : "border border-slate-200 bg-white text-slate-600"}`}>{index + 1}. Soru{draft.saved ? " ✓" : ""}</button>)}
        <button type="button" onClick={onClose} className="ml-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-500"><X className="h-5 w-5" /></button>
      </div>
    </header>

    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="overflow-auto p-5">
        <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><h4 className="font-black text-slate-900">{editorStage === "edit" ? "Soru Alanı" : "Soru Önizlemesi"}</h4><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600">8,0 cm</span></div>
          <div className="overflow-auto rounded-xl bg-slate-200 p-6">
            <div className="mx-auto" style={{ width: `${QUESTION_CSS_WIDTH_PX * EDITOR_VISUAL_SCALE}px`, height: `${activeDraft.heightPx * EDITOR_VISUAL_SCALE}px` }}>
              <div style={{ transform: `scale(${EDITOR_VISUAL_SCALE})`, transformOrigin: "top left", width: `${QUESTION_CSS_WIDTH_PX}px` }}>
                <div ref={editorSurfaceRef} onClick={() => editorStage === "edit" && onSelectEditorImage(null)} className={`relative flow-root bg-white shadow-xl ${editorStage === "edit" ? "ring-2 ring-violet-200" : ""}`} style={{ width: "8cm", height: `${activeDraft.heightPx}px`, overflow: "hidden", padding: "0.1cm 0", fontFamily: activeDraft.fontFamily, fontSize: `${activeDraft.fontSize}pt`, lineHeight: 1.28 }} onPointerCancel={() => { onEndImageDrag(); onEndImageResize(); }}>
                  <QuestionTextWithBlockImages draft={activeDraft} editorStage={editorStage} editorRef={questionTextEditorRef} onChange={(value) => onUpdateDraft(activeDraftIndex, { content: value })} onSelectImage={(id) => onSelectEditorImage(id)} selectedImageId={selectedEditorImageId} onDragStart={onBeginImageDrag} onDragMove={(event, imageId) => { if (draggingImageId === imageId) onMoveImageDrag(event, activeDraftIndex); }} onDragEnd={onEndImageDrag} onResizeStart={onBeginImageResize} onResizeMove={(event, imageId) => { if (resizingImageId === imageId) onMoveImageResize(event, activeDraftIndex); }} onResizeEnd={onEndImageResize} />
                  {editorStage === "edit" && <button type="button" aria-label="Soru alanı yüksekliğini değiştir" className="absolute bottom-0 left-0 z-50 h-3 w-full cursor-ns-resize border-t border-violet-300 bg-violet-100/70" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSetResizingQuestionHeight({ startClientY: event.clientY, startHeightPx: activeDraft.heightPx }); }} onPointerMove={(event) => { if (!resizingQuestionHeight) return; const delta=(event.clientY-resizingQuestionHeight.startClientY)/EDITOR_VISUAL_SCALE; onUpdateDraft(activeDraftIndex,{heightPx:clamp(resizingQuestionHeight.startHeightPx+delta,180,1800)}); }} onPointerUp={() => onSetResizingQuestionHeight(null)} />}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">{editorStage === "edit" ? <button type="button" onClick={() => onSetEditorStage("preview")} className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white">Önizle</button> : <><button type="button" onClick={() => onSetEditorStage("edit")} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700">Düzelt</button><button type="button" onClick={() => void onSavePng(activeDraftIndex)} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-black text-white"><Save className="h-4 w-4" />Onayla ve PNG Kaydet</button></>}</div>
        </section>
      </main>

      <aside className="overflow-y-auto border-l border-slate-200 bg-white p-5"><div className="space-y-5">
        <section><h4 className="mb-3 flex items-center gap-2 text-sm font-black text-red-600"><Type className="h-4 w-4" />Yazı Ayarları</h4>
          <button type="button" disabled={editorStage === "preview"} onMouseDown={(e)=>e.preventDefault()} onClick={applyQuestionRoot} className="mb-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white disabled:bg-slate-300">Seçileni Soru Kökü Yap</button>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={editorStage === "preview"} onClick={undoAnnotation} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">Geri Al</button>
            <button type="button" disabled={editorStage === "preview"} onClick={redoAnnotation} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">Yinele</button>
          </div>
          <button type="button" disabled={editorStage === "preview"} onMouseDown={(e)=>e.preventDefault()} onClick={applySpecialArea} className="mb-3 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700 disabled:bg-slate-100">Özel Alan Oluştur</button>
          {(activeDraft.specialBlocks || []).length > 0 && <div className="mb-3 space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-2">
            <div className="text-[10px] font-black uppercase tracking-wide text-red-600">Özel Alan Blokları</div>
            {(activeDraft.specialBlocks || []).map((block, index) => <div key={block.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-[10px] text-slate-700">
              <span className="min-w-0 truncate"><b>Blok {index + 1}:</b> {block.items.map((item) => item.marker).join(" ")}</span>
              <button type="button" disabled={editorStage === "preview"} onClick={() => removeSpecialBlock(block.id)} className="shrink-0 rounded-md border border-red-200 px-2 py-1 font-black text-red-600">Kaldır</button>
            </div>)}
          </div>}
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Varsayılan yazı tipi</span><select value={activeDraft.fontFamily} disabled className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm"><option value={DEFAULT_QUESTION_FONT}>Merge One Regular</option></select></label>
          <div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${fontStatus === "ready" ? "bg-emerald-50 text-emerald-700" : fontStatus === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{fontStatus === "ready" ? "✓ Merge One Regular yüklendi." : fontStatus === "error" ? "Merge One Regular yüklenemedi." : "Merge One Regular yükleniyor..."}</div>
          <label className="mt-3 block"><span className="mb-1 block text-xs font-bold text-slate-600">Punto</span><input type="number" min={8} max={20} value={activeDraft.fontSize} disabled={editorStage === "preview"} onChange={(event)=>onUpdateDraft(activeDraftIndex,{fontSize:clamp(Number(event.target.value)||11,8,20)})} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
        </section>

        <section className="border-t border-slate-100 pt-5"><h4 className="mb-3 flex items-center gap-2 text-sm font-black text-red-600"><ImageIcon className="h-4 w-4" />Resim İşlemleri</h4>
          {activeDraft.images.length===0 ? <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Bu soruda seçilmiş resim/şekil yok.</div> : <><div className="mb-3 space-y-2">{activeDraft.images.map((image,index)=><button key={image.id} type="button" disabled={editorStage==="preview"} onClick={()=>onSelectEditorImage(image.id)} className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left ${selectedEditorImageId===image.id?"border-emerald-500 bg-emerald-50":"border-slate-200 bg-white"}`}><img src={image.dataUrl} alt="" className="h-10 w-14 object-contain"/><span className="text-xs font-black text-slate-700">Resim {index+1}</span></button>)}</div><div className="grid gap-2">{([['text-left','Yazılar soldan aksın'],['block','Yazılar alttan ve üstten aksın'],['text-right','Yazılar sağdan aksın']] as const).map(([flow,label])=><button key={flow} type="button" disabled={editorStage==="preview"||!selectedEditorImageId} onClick={()=>selectedEditorImageId&&onUpdateImage(activeDraftIndex,selectedEditorImageId,{flow})} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${activeDraft.images.find(i=>i.id===selectedEditorImageId)?.flow===flow?"border-emerald-600 bg-emerald-600 text-white":"border-slate-200 bg-slate-50 text-slate-700"}`}>{label}</button>)}</div></>}
        </section>

        <section className="border-t border-slate-100 pt-5"><h4 className="mb-3 text-sm font-black text-red-600">Seçenek Düzeni</h4><div className="grid grid-cols-2 gap-2">{(["1","2-2-1","3-2","5"] as AnswerLayout[]).map(layout=><button key={layout} type="button" disabled={editorStage==="preview"} onClick={()=>onUpdateDraft(activeDraftIndex,{answerLayout:layout})} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${activeDraft.answerLayout===layout?"border-violet-600 bg-violet-600 text-white":"border-slate-200 bg-slate-50 text-slate-700"}`}>{layout}</button>)}</div></section>

        <section className="border-t border-slate-100 pt-5"><h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><Save className="h-4 w-4 text-cyan-600" />Kayıt</h4><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Sorunun dosya adı</span><div className="flex overflow-hidden rounded-xl border border-slate-200"><input value={activeDraft.fileName} disabled={editorStage==="preview"} onChange={(e)=>onUpdateDraft(activeDraftIndex,{fileName:e.target.value})} className="h-10 min-w-0 flex-1 px-3 text-sm outline-none"/><span className="flex items-center bg-slate-100 px-2 text-xs font-bold text-slate-500">.png</span></div></label><div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Son PNG klasörü: <b>{ocrFolderName||"Henüz seçilmedi"}</b></div><button type="button" disabled={editorStage==="preview"} onClick={()=>void onChooseFolder()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700"><FolderOpen className="h-4 w-4"/>Klasörü Değiştir</button></section>
      </div></aside>
    </div>
  </div>;
}
