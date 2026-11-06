import type { PDFDocumentProxy } from "pdfjs-dist";

export type QuestionSourcePage =
  | { kind: "image"; file: File; name: string; pageIndex?: number; pageCount?: number }
  | { kind: "pdf"; pdf: PDFDocumentProxy; number: number; name: string };

const isTiffFile = (file: File) => {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR") || "";
  return ["image/tiff", "image/x-tiff"].includes(file.type) || extension === "tif" || extension === "tiff";
};

const requestTiffDecode = async (file: File, pageIndex: number, metadataOnly = false) => {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR") === "tif" ? ".tif" : ".tiff";
  const response = await fetch(`/api/question-prepare/decode-tiff?page=${Math.max(0, pageIndex)}${metadataOnly ? "&metadata=1" : ""}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Tiff-Extension": extension,
    },
    body: file,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || `${file.name}: TIFF dosyası okunamadı.`));
  }
  return response;
};

export const getTiffPageCount = async (file: File): Promise<number> => {
  if (!isTiffFile(file)) return 1;
  const response = await requestTiffDecode(file, 0, true);
  const body = await response.json().catch(() => ({}));
  const pageCount = Number(body?.pageCount || 1);
  return Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 1;
};

const renderTiffToCanvas = async (
  file: File,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) => {
  const response = await requestTiffDecode(file, pageIndex, false);
  const width = Number(response.headers.get("X-Image-Width") || 0);
  const height = Number(response.headers.get("X-Image-Height") || 0);
  if (!width || !height) throw new Error(`${file.name}: TIFF boyutları okunamadı.`);
  const rgba = new Uint8ClampedArray(await response.arrayBuffer());
  if (rgba.length !== width * height * 4) throw new Error(`${file.name}: TIFF piksel verisi eksik.`);
  canvas.width = width;
  canvas.height = height;
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
};

const drawImageBlobToCanvas = async (blob: Blob, name: string, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`${name}: görsel okunamadı.`));
      image.src = url;
    });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export async function renderQuestionSource(source: QuestionSourcePage): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Görüntü alanı oluşturulamadı.");
  if (source.kind === "pdf") {
    const page = await source.pdf.getPage(source.number);
    try {
      const viewport = page.getViewport({ scale: 400 / 72 });
      if (viewport.width * viewport.height > 80_000_000 || Math.max(viewport.width, viewport.height) > 16384) {
        throw new Error(`${source.name}: 400 DPI sayfa tarayıcı bellek sınırını aşıyor.`);
      }
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport, background: "white" }).promise;
    } finally { page.cleanup(); }
  } else if (isTiffFile(source.file)) {
    // TIFF dosyası PNG/JPG dosyasına çevrilmeden, yalnızca ekranda göstermek için
    // piksel verisi çözülür. Kaynak File nesnesi TIFF olarak kalır.
    await renderTiffToCanvas(source.file, Number(source.pageIndex || 0), canvas, context);
  } else {
    await drawImageBlobToCanvas(source.file, source.name, canvas, context);
  }
  return canvas;
}
