let initialized = false;

export class PdfFonts {
  static async ensureInitialized(pdfMake: any): Promise<void> {
    if (initialized) return;

    try {
      const pdfFontsModule: any = await import("pdfmake/build/vfs_fonts");

      const moduleAny: any = pdfFontsModule;

      const vfs =
        moduleAny?.pdfMake?.vfs ||
        moduleAny?.vfs ||
        moduleAny?.default?.pdfMake?.vfs ||
        moduleAny?.default?.vfs;

      if (vfs && typeof vfs === "object") {
        pdfMake.vfs = vfs;
      }

      pdfMake.fonts = {
        Roboto: {
          normal: "Roboto-Regular.ttf",
          bold: "Roboto-Medium.ttf",
          italics: "Roboto-Italic.ttf",
          bolditalics: "Roboto-MediumItalic.ttf",
        },
      };

      initialized = true;
    } catch (err) {
      console.error("PDF font initialization failed:", err);
      throw err;
    }
  }
}
