import { PdfEngine } from "../core/PdfEngine";
import { buildPdfFooter } from "../components/PdfFooter";

export interface HtmlPdfOptions {
  filename: string;
  title?: string;
  orientation?: "portrait" | "landscape";
  pageSize?: "A4" | "A5";
  margins?: [number, number, number, number];
  download?: boolean;
}

function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  const originals = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
  const clones = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  const supported = [
    "display", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
    "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontSize", "fontWeight", "fontStyle", "fontFamily", "lineHeight", "textAlign",
    "color", "backgroundColor", "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
    "borderColor", "borderWidth", "borderStyle", "borderRadius", "verticalAlign",
  ];

  originals.forEach((source, index) => {
    const target = clones[index];
    if (!target) return;
    const computed = window.getComputedStyle(source);
    supported.forEach((property) => {
      const value = (computed as any)[property];
      if (value && value !== "normal" && value !== "none" && value !== "0px") {
        (target.style as any)[property] = value;
      }
    });
  });
  return clone;
}

async function loadHtmlToPdfmake(): Promise<(html: string, options?: Record<string, any>) => any> {
  try {
    const module = await import("html-to-pdfmake");
    const converter = (module as any).default ?? module;
    if (typeof converter !== "function") {
      throw new Error("html-to-pdfmake dönüştürücüsü yüklenemedi.");
    }
    return converter;
  } catch (error) {
    console.error("html-to-pdfmake yükleme hatası:", error);
    throw new Error(
      "HTML tabanlı PDF dönüştürücü yüklenemedi. 'npm install html-to-pdfmake pdfmake' komutunu çalıştırıp uygulamayı yeniden başlatınız.",
    );
  }
}

export async function exportHtmlPdf(
  htmlOrElement: string | HTMLElement,
  options: HtmlPdfOptions,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("HTML PDF dönüştürme işlemi yalnızca tarayıcı ortamında kullanılabilir.");
  }

  const html = typeof htmlOrElement === "string"
    ? htmlOrElement
    : cloneWithInlineStyles(htmlOrElement).outerHTML;

  const htmlToPdfmake = await loadHtmlToPdfmake();
  const converted = htmlToPdfmake(html, {
    window,
    defaultStyles: {
      p: { margin: [0, 2, 0, 2] },
      h1: { fontSize: 18, bold: true, margin: [0, 5, 0, 5] },
      h2: { fontSize: 15, bold: true, margin: [0, 4, 0, 4] },
      table: { margin: [0, 3, 0, 3] },
    },
  });

  const documentDefinition = {
    pageSize: options.pageSize || "A4",
    pageOrientation: options.orientation || "portrait",
    pageMargins: options.margins || [24, 24, 24, 28],
    footer: buildPdfFooter,
    content: converted,
    info: { title: options.title || options.filename },
  };

  const blob = await PdfEngine.generate(documentDefinition, {
    mode: "blob",
    filename: options.filename,
  }) as Blob;

  if (options.download !== false) {
    await PdfEngine.generate(documentDefinition, {
      mode: "download",
      filename: options.filename,
    });
  }
  return blob;
}
