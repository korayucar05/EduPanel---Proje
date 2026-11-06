import { PDF_COLORS } from "../core/PdfTheme";

export function buildPdfFooter(currentPage: number, pageCount: number): any {
  return {
    margin: [20, 0, 20, 6],
    columns: [
      { text: "e-Nstitü • Hedefli Akademik Süreç Analiz Takibi", fontSize: 7, color: PDF_COLORS.muted },
      { text: `${currentPage} / ${pageCount}`, alignment: "right", fontSize: 7, color: PDF_COLORS.muted },
    ],
  };
}
