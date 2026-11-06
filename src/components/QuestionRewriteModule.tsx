import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileImage, ImagePlus, RotateCcw, Sparkles, Upload, X } from "lucide-react";

const DPI = 300;
const CARD_WIDTH = Math.round(8 / 2.54 * DPI);
const FONT_SIZE = Math.round(11 / 72 * DPI);
const MARGIN = 42;
const INNER = CARD_WIDTH - MARGIN * 2;
const LINE = Math.round(FONT_SIZE * 1.32);
const DEFAULT_OPTIONS = ["", "", "", "", ""];
const FONT = 'Arial, "Liberation Sans", sans-serif';

type PreparedCard = { canvas: HTMLCanvasElement; height: number };

// Türkçe metindeki uzun kelimeler için güvenli son çare. Otomatik heceleme
// anlamı bozabileceği için kullanıcı tarafından eklenen yumuşak tire önceliklidir.
const measureText = (ctx: CanvasRenderingContext2D, text: string) => ctx.measureText(text).width;
const wrap = (ctx: CanvasRenderingContext2D, input: string, width: number): string[] => {
  const result: string[] = [];
  for (const paragraph of input.replace(/\r/g, "").split("\n")) {
    if (!paragraph.trim()) { result.push(""); continue; }
    let row = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = row ? `${row} ${word}` : word;
      if (measureText(ctx, candidate) <= width) { row = candidate; continue; }
      if (row) result.push(row);
      row = word;
      if (measureText(ctx, row) > width) {
        let remaining = row;
        while (measureText(ctx, remaining) > width) {
          let n = 1;
          while (n < remaining.length && measureText(ctx, `${remaining.slice(0, n + 1)}-`) <= width) n++;
          const cut = Math.max(1, n);
          result.push(`${remaining.slice(0, cut)}-`);
          remaining = remaining.slice(cut);
        }
        row = remaining;
      }
    }
    result.push(row);
  }
  return result;
};

function drawJustified(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, font: string): number {
  ctx.font = font;
  const paragraphs = text.replace(/\r/g, "").split("\n");
  for (const paragraph of paragraphs) {
    const lines = wrap(ctx, paragraph, width);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const words = line.split(" ");
      if (index < lines.length - 1 && words.length > 1) {
        const naturalWidth = words.reduce((sum, word) => sum + measureText(ctx, word), 0);
        const space = (width - naturalWidth) / (words.length - 1);
        let pos = x;
        for (const word of words) { ctx.fillText(word, pos, y); pos += measureText(ctx, word) + space; }
      } else ctx.fillText(line, x, y);
      y += LINE;
    }
  }
  return y;
}

function createCard(introduction: string, question: string, options: string[], image: HTMLImageElement | null, brightness: number, contrast: number, imageScale: number): PreparedCard {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  let ctx = canvas.getContext("2d")!;
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  const introLines = wrap(ctx, introduction, INNER);
  const questionLines = wrap(ctx, question, INNER);
  const imageWidth = image ? Math.round(INNER * imageScale / 100) : 0;
  const imageHeight = image ? Math.round(image.height / image.width * imageWidth) : 0;
  const labels = ["A", "B", "C", "D", "E"];
  const optionHeights = options.map((option) => option.trim() ? Math.max(1, wrap(ctx, option.trim(), INNER - 82).length) * LINE + 13 : 0);
  const introHeight = introduction.trim() ? introLines.length * LINE + 24 : 0;
  const questionHeight = question.trim() ? questionLines.length * LINE + 28 : 0;
  const computedHeight = MARGIN * 2 + introHeight + (image ? imageHeight + 35 : 0) + questionHeight + optionHeights.reduce((a, b) => a + b, 0) + 12;
  canvas.height = Math.max(240, computedHeight);
  ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.textBaseline = "alphabetic";
  let y = MARGIN + FONT_SIZE;
  if (introduction.trim()) {
    y = drawJustified(ctx, introduction.trim(), MARGIN, y, INNER, `${FONT_SIZE}px ${FONT}`) + 24;
  }
  if (image) {
    const ix = (CARD_WIDTH - imageWidth) / 2;
    const top = y - FONT_SIZE + 5;
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(image, ix, top, imageWidth, imageHeight);
    ctx.restore();
    y = top + imageHeight + 35 + FONT_SIZE;
  }
  if (question.trim()) {
    y = drawJustified(ctx, question.trim(), MARGIN, y, INNER, `bold ${FONT_SIZE}px ${FONT}`) + 28;
  }
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  for (let i = 0; i < 5; i++) {
    if (!options[i]?.trim()) continue;
    ctx.fillText(`${labels[i]})`, MARGIN, y);
    y = drawJustified(ctx, options[i].trim(), MARGIN + 82, y, INNER - 82, `${FONT_SIZE}px ${FONT}`) + 13;
  }
  return { canvas, height: canvas.height };
}

// PNG pHYs parçası ile çıktı dosyasına fiziksel 300 DPI bilgisi yazılır.
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function png300dpi(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG oluşturulamadı")), "image/png"));
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  const pixelsPerMeter = Math.round(DPI / 0.0254);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.slice(4, 17)));
  const result = new Uint8Array(buffer.length + chunk.length);
  result.set(buffer.subarray(0, 33)); // PNG imzası + IHDR (25 B)
  result.set(chunk, 33);
  result.set(buffer.subarray(33), 33 + chunk.length);
  return new Blob([result], { type: "image/png" });
}

export default function QuestionRewriteModule() {
  const [intro, setIntro] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([...DEFAULT_OPTIONS]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [imageScale, setImageScale] = useState(100);
  const [error, setError] = useState("");
  const [previewHeight, setPreviewHeight] = useState(0);
  const preview = useRef<HTMLCanvasElement>(null);
  const sourceFile = useRef<HTMLInputElement>(null);
  const render = useCallback(() => createCard(intro, question, options, image, brightness, contrast, imageScale), [intro, question, options, image, brightness, contrast, imageScale]);

  useEffect(() => {
    const output = render();
    if (preview.current) {
      preview.current.width = output.canvas.width;
      preview.current.height = output.canvas.height;
      preview.current.getContext("2d")?.drawImage(output.canvas, 0, 0);
      setPreviewHeight(output.height);
    }
  }, [render]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Görsel yalnızca PNG, JPG veya WEBP olabilir."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Görsel 25 MB sınırını aşıyor."); return; }
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    loaded.onload = () => { setImage(loaded); setImageName(file.name); setError(""); URL.revokeObjectURL(url); };
    loaded.onerror = () => { setError("Görsel okunamadı."); URL.revokeObjectURL(url); };
    loaded.src = url;
  };
  const download = async () => {
    try {
      if (!intro.trim() && !question.trim() && !options.some((v) => v.trim())) { setError("Önce soru metnini veya seçenekleri girin."); return; }
      setError("");
      const file = await png300dpi(render().canvas);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `soru-yeniden-yazildi-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "PNG oluşturulamadı."); }
  };
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  return <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 text-slate-800">
    <div className="grid gap-5 xl:grid-cols-[minmax(370px,1fr)_minmax(400px,1fr)]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-base font-extrabold">1. Soru metni ve seçenekler</h3><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">Arial · 11 punto</span></div>
          <label className="mb-1 block text-xs font-bold text-slate-600">Açıklama / soru öncesi metin</label>
          <textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Şeklin üstündeki açıklamayı buraya yazın..." className={`${inputClass} resize-y`}/>
          <label className="mb-1 mt-3 block text-xs font-bold text-slate-600">Soru kökü (kalın yazılır)</label>
          <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Bu görsele göre ...?" className={`${inputClass} resize-y`}/>
          <div className="mt-4 space-y-2">{options.map((option, i) => <label key={i} className="flex items-center gap-3"><span className="w-6 shrink-0 text-sm font-extrabold">{"ABCDE"[i]})</span><input className={inputClass} value={option} onChange={(e) => setOptions((old) => old.map((x, j) => j === i ? e.target.value : x))} placeholder={`${"ABCDE"[i]} seçeneği`}/></label>)}</div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">Metinler değiştirilebilir; içerik otomatik olarak yeniden ifade edilmez. Uzun satırlar 8 cm alana göre sarılır; iki yana yaslama uygulanır. Özel yazım ve heceleme için kaydetmeden önce önizlemeyi kontrol edin.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="text-base font-extrabold">2. Şekil / görsel</h3><button onClick={() => { setImage(null); setImageName(""); if (sourceFile.current) sourceFile.current.value = ""; }} disabled={!image} className="flex items-center gap-1 text-xs font-semibold text-slate-500 disabled:opacity-30"><X className="h-4 w-4"/> Kaldır</button></div>
          <input ref={sourceFile} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])}/>
          <button onClick={() => sourceFile.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50 px-4 py-7 text-sm font-bold text-teal-800 hover:border-teal-400"><ImagePlus className="h-5 w-5"/>{imageName || "Şekil ekle (PNG / JPG / WEBP)"}</button>
          {image && <div className="mt-4 space-y-4">{([["Parlaklık", brightness, setBrightness], ["Kontrast", contrast, setContrast], ["Görsel genişliği", imageScale, setImageScale]] as const).map(([label, value, setter]) => <label key={label} className="block"><span className="flex justify-between text-xs font-bold"><span>{label}</span><span>{value}%</span></span><input type="range" min={label === "Görsel genişliği" ? 30 : 50} max={label === "Görsel genişliği" ? 100 : 160} value={value} onChange={(e) => setter(Number(e.target.value))} className="mt-2 w-full accent-teal-700"/></label>)}<button onClick={() => { setBrightness(100); setContrast(100); setImageScale(100); }} className="flex items-center gap-1 text-xs font-bold text-slate-600"><RotateCcw className="h-4 w-4"/> Görsel ayarlarını sıfırla</button></div>}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">Görselin oranı korunur. Kaynak görüntü otomatik değiştirilmez; parlaklık, kontrast ve boyut yalnızca bu çıktıda uygulanır. Şeklin içindeki yazılar için kaynak görselin okunaklı olması gerekir.</p>
        </section>
      </div>
      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"><h3 className="flex items-center gap-2 font-extrabold"><FileImage className="h-5 w-5 text-teal-700"/> 3. Canlı baskı önizlemesi</h3><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">8 cm × otomatik • {CARD_WIDTH} px × {previewHeight} px</span></div>
          <div className="flex justify-center bg-slate-100 p-5"><canvas ref={preview} className="h-auto w-full max-w-[480px] border border-slate-200 bg-white shadow-lg" style={{ imageRendering: "auto" }}/></div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="text-xs text-slate-500">Çıktı: PNG • 300 DPI • beyaz zemin</span><button onClick={download} className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-teal-800"><Download className="h-4 w-4"/> Baskıya Hazır PNG</button></div>
        </section>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Metin tanıma (OCR) bu sürümde otomatik değildir: görselden alınan soru metnini kutulara yazmanız gerekir. Görselin kendisindeki yazılar ya da şekiller yapay zekâyla yeniden çizilmez. Son baskıdan önce metni ve şekli mutlaka kontrol edin.</div>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      </div>
    </div>
  </div>;
}
