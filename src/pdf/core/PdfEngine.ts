import { PdfFonts } from "./PdfFonts";
import { PdfTheme } from "./PdfTheme";
import { safeFileName } from "./PdfHelpers";
import { applyHasatPdfTheme } from "../theme/HasatPdfThemeEngine";

let pdfMakeInstance: any = null;

async function getPdfMake(): Promise<any> {
  if (pdfMakeInstance) return pdfMakeInstance;

  const module: any = await import("pdfmake/build/pdfmake");

  pdfMakeInstance =
    module?.default ||
    module?.pdfMake ||
    module;

  await PdfFonts.ensureInitialized(pdfMakeInstance);

  return pdfMakeInstance;
}

export class PdfEngine {
  static async create(documentDefinition: Record<string, any>): Promise<any> {
    const pdfMake = await getPdfMake();

    const themedDefinition = applyHasatPdfTheme(documentDefinition);

    return pdfMake.createPdf({
      ...themedDefinition,
      defaultStyle: {
        ...PdfTheme.defaultStyle,
        ...(themedDefinition.defaultStyle || {}),
      },
      styles: {
        ...PdfTheme.styles,
        ...(themedDefinition.styles || {}),
      },
    });
  }

  static async generate(
    documentDefinition: Record<string, any>,
    options: any = {}
  ) {
    const pdf = await this.create(documentDefinition);

    const mode = options.mode || "download";
    const filename = safeFileName(options.filename || "rota-rapor.pdf");

    if (mode === "download") return pdf.download(filename);
    if (mode === "open") return pdf.open();
    if (mode === "print") return pdf.print();

    return new Promise((resolve) => pdf.getBlob(resolve));
  }
}
