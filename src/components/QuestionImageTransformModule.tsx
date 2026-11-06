import React, { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

const WIDTH_PX = Math.round(8 / 2.54 * 300);
const MAX_UPLOAD = 10 * 1024 * 1024;
const dataUrlFromFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("Görsel açılamadı."));
  reader.readAsDataURL(file);
});
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Sonuç görseli yüklenemedi."));
  image.src = url;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of bytes) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Preserve light neutral paper/background pixels while enhancing printed content.
function enhanceContent(ctx: CanvasRenderingContext2D, width: number, height: number, brightness: number, contrast: number, saturation: number) {
  const frame = ctx.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const b = brightness / 100;
  const c = contrast / 100;
  const sat = saturation / 100;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], bl = pixels[i + 2];
    const high = Math.max(r, g, bl), low = Math.min(r, g, bl);
    const neutralBackground = high - low < 12 && (r + g + bl) / 3 >= 185;
    if (neutralBackground) continue;
    const gray = .2126 * r + .7152 * g + .0722 * bl;
    const values = [r, g, bl];
    for (let channel = 0; channel < 3; channel++) {
      const saturated = gray + (values[channel] - gray) * sat;
      pixels[i + channel] = Math.max(0, Math.min(255, (saturated * b - 127.5) * c + 127.5));
    }
  }
  ctx.putImageData(frame, 0, 0);
}
async function toPrintPng(source: string, brightness: number, contrast: number, saturation = 110): Promise<Blob> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH_PX;
  canvas.height = Math.max(1, Math.round(image.naturalHeight / image.naturalWidth * WIDTH_PX));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işleme açılamadı.");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  enhanceContent(ctx, canvas.width, canvas.height, brightness, contrast, saturation);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG oluşturulamadı.")), "image/png"));
  const original = new Uint8Array(await blob.arrayBuffer());
  // PNG header (8) + IHDR chunk (25); pHYs chunk = 21 bytes.
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, Math.round(300 / 0.0254));
  view.setUint32(12, Math.round(300 / 0.0254));
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.slice(4, 17)));
  const encoded = new Uint8Array(original.length + chunk.length);
  encoded.set(original.subarray(0, 33)); encoded.set(chunk, 33); encoded.set(original.subarray(33), 54);
  return new Blob([encoded], { type: "image/png" });
}

export default function QuestionImageTransformModule() {
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sourceDims, setSourceDims] = useState("");
  const [resultDims, setResultDims] = useState("");
  const [resultMode, setResultMode] = useState<"ai" | "quick" | "">("");
  const fileInput = useRef<HTMLInputElement>(null);
  const runningRequest = useRef<AbortController | null>(null);
  useEffect(() => () => runningRequest.current?.abort(), []);
  useEffect(() => {
    if (!result) { setPreview(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(result);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        enhanceContent(ctx, canvas.width, canvas.height, brightness, contrast, resultMode === "quick" ? 100 : 110);
        if (!cancelled) setPreview(canvas.toDataURL("image/png"));
      } catch { if (!cancelled) setPreview(result); }
    })();
    return () => { cancelled = true; };
  }, [result, resultMode, brightness, contrast]);
  const clear = () => {
    runningRequest.current?.abort(); runningRequest.current = null;
    setSource(""); setResult(""); setResultMode(""); setName(""); setSourceDims(""); setResultDims(""); setError(""); setNotice(""); setBrightness(100); setContrast(100); setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Yalnızca JPG, PNG ve WEBP görselleri yüklenebilir."); return; }
    if (file.size > MAX_UPLOAD) { setError("Görsel en fazla 10 MB olabilir."); return; }
    try {
      runningRequest.current?.abort();
      const dataUrl = await dataUrlFromFile(file);
      const image = await loadImage(dataUrl);
      setSource(dataUrl); setSourceDims(`${image.naturalWidth} × ${image.naturalHeight} px`);
      setName(file.name); setResult(""); setResultMode(""); setResultDims(""); setNotice(""); setError(""); setBrightness(100); setContrast(100);
    } catch (e) { setError(e instanceof Error ? e.message : "Görsel açılamadı."); }
  };
  const quickImprove = async () => {
    if (!source || busy) return;
    setError(""); setNotice("");
    try {
      const file = await toPrintPng(source, 106, 112);
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("PNG okunamadı.")); reader.readAsDataURL(file); });
      const image = await loadImage(url);
      setResult(url); setResultMode("quick");
      setResultDims(`${image.naturalWidth} × ${image.naturalHeight} px`);
      setBrightness(100); setContrast(100);
      setNotice("Hızlı iyileştirme tamamlandı: Orijinal yazılar, ölçüler ve şıklar korunarak kontrast ve çözünürlük düzenlendi. Bu seçenek şekli yeniden çizmez ve metni yeniden dizmez.");
    } catch (e) { setError(e instanceof Error ? e.message : "İyileştirme başarısız."); }
  };
  const transform = async () => {
    if (!source || busy) return;
    const controller = new AbortController(); runningRequest.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 50000);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/question-image/reimagine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: source }), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.image) throw new Error(data?.error || `Dönüştürme tamamlanamadı (HTTP ${response.status}).`);
      const outputImage = await loadImage(data.image);
      setResult(data.image); setResultMode("ai");
      setResultDims(`${outputImage.naturalWidth} × ${outputImage.naturalHeight} px`);
      setNotice("Dönüştürme tamamlandı. Görseldeki tüm soru metinlerini, sayıları, seçenekleri ve şekil etiketlerini kaynakla karşılaştırıp onaylayın.");
    } catch (e) {
      setError(controller.signal.aborted ? "İşlem 50 saniye içinde tamamlanamadı veya iptal edildi. Hızlı İyileştir seçeneği internet gerektirmez." : e instanceof Error ? e.message : "Görsel dönüştürülemedi.");
    } finally { window.clearTimeout(timeoutId); if (runningRequest.current === controller) { runningRequest.current = null; setBusy(false); } }
  };
  const download = async () => {
    if (!result) return;
    try {
      setError("");
      const file = await toPrintPng(result, brightness, contrast, resultMode === "quick" ? 100 : 110);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url; link.download = `soru-resmi-donusturuldu-${Date.now()}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { setError(e instanceof Error ? e.message : "PNG indirilemedi."); }
  };
  return <div className="mx-auto max-w-[1550px] space-y-5 px-4 py-5 text-slate-800">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,1fr)_minmax(360px,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b p-4"><h3 className="text-base font-extrabold">1. Orijinal soru görseli</h3>{source && <button onClick={clear} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-rose-600 disabled:opacity-50"><Trash2 size={15}/> Temizle</button>}</div>
        <div className="p-4">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])}/>
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-5 text-sm font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"><ImagePlus size={20}/>{source ? "Başka soru görseli seç" : "Soru görseli yükle (JPG / PNG / WEBP)"}</button>
          {source ? <><div className="mt-4 flex min-h-52 justify-center rounded-xl bg-slate-100 p-3"><img src={source} alt="Orijinal soru" className="max-h-[760px] max-w-full object-contain"/></div><div className="mt-2 break-all text-xs text-slate-500">{name} · {sourceDims}</div></> : <div className="mt-5 rounded-xl bg-slate-50 p-7 text-center text-sm leading-6 text-slate-500">Orijinal soruyu tüm metinleri, şıkları ve şekilleri görünecek biçimde yükleyin.</div>}
          <button type="button" disabled={!source || busy} onClick={quickImprove} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-40"><Sparkles size={18}/> Hızlı İyileştir (anında · internet gerektirmez)</button>
          <button type="button" disabled={!source || busy} onClick={transform} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 text-sm font-extrabold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <><RefreshCw size={18} className="animate-spin"/> Görsel yeniden hazırlanıyor…</> : <><Sparkles size={18}/>{result ? "Yeniden Dönüştür" : "Resmi Yeniden Tasarla"}</>}</button>
          <p className="mt-2 text-xs text-slate-500">Yapay zekâ ile yeniden çizim daha uzun sürebilir ve metin/ölçüleri değiştirebilir. Hızlı İyileştir görseli yeniden çizmeden netleştirir. Yapay zekâ seçeneği için; sunucuda GEMINI_API_KEY bulunmalıdır. Yüklediğiniz görsel işlenmek üzere model hizmetine gönderilir.</p>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h3 className="text-base font-extrabold">2. {resultMode === "quick" ? "Hızlı iyileştirilmiş soru" : "Yeniden tasarlanmış soru"}</h3><span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">{resultMode === "quick" ? "Orijinal yazı korunur" : "Yapay zekâ · punto garanti değil"}</span></div>
        <div className="p-4">
          {result ? <><div className="flex min-h-52 justify-center rounded-xl bg-slate-100 p-3"><img src={preview || result} alt="Dönüştürülmüş soru" className="max-h-[760px] max-w-full object-contain"/></div><div className="mt-2 text-xs text-slate-500">{resultMode === "quick" ? "Hızlı iyileştirme" : "Model çıktısı"}: {resultDims} · PNG indirildiğinde 8 cm genişliğe ve 300 DPI bilgisine dönüştürülür.</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{([["Parlaklık", brightness, setBrightness], ["Kontrast", contrast, setContrast]] as const).map(([label, value, setter]) => <label key={label} className="block text-xs font-semibold text-slate-700"><span className="flex justify-between"><span>{label}</span><span>{value}%</span></span><input type="range" min="70" max="140" value={value} onChange={(e) => setter(Number(e.target.value))} className="mt-2 w-full accent-indigo-700"/></label>)}</div>
            <button onClick={download} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-extrabold text-white hover:bg-emerald-800"><Download size={18}/> Baskıya Hazır PNG İndir</button>
          </> : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-500"><Sparkles className="mb-3 text-slate-400" size={34}/>{busy ? "Yapay zekâ soruyu görsel olarak yeniden oluşturuyor…" : "Dönüştürme sonrası sonuç burada görüntülenecek. Orijinal ve yeni soruyu yan yana karşılaştırabilirsiniz."}</div>}
        </div>
      </section>
    </div>
    {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"><ShieldCheck size={17} className="mr-2 inline"/>{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <p className="text-xs leading-relaxed text-slate-500">Not: Görsel üreten yapay zekâ soru metninde, rakamlarda, seçeneklerde veya şekil detaylarında hata yapabilir. Bu yöntem tam 11 punto veya kusursuz metin aktarımını teknik olarak garanti etmez. Harf harf kesin tipografi gerektiğinde yanındaki “Yeniden Yazmak” sekmesini kullanın. Orijinal dosyanız ve müfredat verileriniz değiştirilmez.</p>
  </div>;
}
