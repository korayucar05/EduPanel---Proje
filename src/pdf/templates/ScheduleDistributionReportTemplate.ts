import { PDF_COLORS } from "../core/PdfTheme";
import { buildPdfFooter } from "../components/PdfFooter";
import type { InfeasibilityItem } from "../../services/schedule/infeasibilityAnalyzer";
import type { ScheduleValidationResult } from "../../types/scheduleConstraints";

export interface ScheduleDistributionReportData {
  schoolName?: string;
  algorithm?: string;
  generatedAt?: Date;
  durationMs?: number;
  initialPenalty?: number;
  finalPenalty?: number;
  placedBlocks?: number;
  unplacedBlocks?: number;
  validation: ScheduleValidationResult;
  infeasibility: InfeasibilityItem[];
  details?: string;
}

export function buildScheduleDistributionReport(data: ScheduleDistributionReportData): Record<string, any> {
  const date = data.generatedAt || new Date();
  const summaryRows = [
    ["Algoritma", data.algorithm || "CSP + Recursive Backtracking"],
    ["Çalışma süresi", `${Number(data.durationMs || 0).toLocaleString("tr-TR")} ms`],
    ["Ceza", `${data.initialPenalty ?? "-"} → ${data.finalPenalty ?? "-"}`],
    ["Yerleşen / Yerleşmeyen", `${data.placedBlocks ?? "-"} / ${data.unplacedBlocks ?? data.infeasibility.length}`],
    ["Validator", data.validation.valid ? "Başarılı" : `${data.validation.errors.length} hard constraint hatası`],
  ];

  const issueRows = data.validation.errors.map((issue) => [issue.type, issue.message, issue.day || "", issue.hour || ""]);
  const infeasibleRows = data.infeasibility.flatMap((item) => item.reasonDetails.slice(0, 3).map((reason, index) => [
    index === 0 ? `${item.className}\n${item.courseName}` : "",
    index === 0 ? `${item.teacherNames.join(", ") || "Öğretmen yok"}\n${item.duration} saat` : "",
    `${reason.label} (${reason.count})`,
    index === 0 ? item.suggestedActions.slice(0, 2).join("\n") : "",
  ]));

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 38, 28, 32],
    footer: buildPdfFooter,
    info: { title: "Ders Dağıtım Analiz Raporu" },
    content: [
      { text: data.schoolName || "e-Nstitü", style: "schoolName", alignment: "center" },
      { text: "DERS DAĞITIM ANALİZ RAPORU", style: "reportTitle", margin: [0, 4, 0, 2] },
      { text: date.toLocaleString("tr-TR"), alignment: "center", color: PDF_COLORS.muted, fontSize: 8, margin: [0, 0, 0, 12] },
      { table: { widths: [110, "*"], body: summaryRows.map(([a,b]) => [{ text:a, bold:true, fillColor:PDF_COLORS.surface }, b]) }, layout: "lightHorizontalLines", margin: [0,0,0,12] },
      ...(data.details ? [{ text: "Çözücü özeti", style: "sectionTitle", margin: [0,4,0,4] }, { text: data.details, fontSize: 8, color: PDF_COLORS.muted, margin: [0,0,0,10] }] : []),
      { text: "Bağımsız doğrulama", style: "sectionTitle", margin: [0,4,0,4] },
      data.validation.valid
        ? { text: "Program hard constraint doğrulamasından geçti.", color: PDF_COLORS.success, bold: true, margin: [0,0,0,10] }
        : { table: { headerRows:1, widths:[90,"*",70,45], body:[["Tür","Açıklama","Gün","Saat"], ...issueRows] }, layout:"lightHorizontalLines", margin:[0,0,0,10] },
      { text: "Yerleşemeyen dersler ve çözümsüzlük nedenleri", style: "sectionTitle", margin: [0,4,0,4] },
      infeasibleRows.length
        ? { table: { headerRows:1, widths:[100,110,"*",170], body:[["Sınıf / Ders","Öğretmen / Blok","Başlıca neden","Önerilen işlem"], ...infeasibleRows] }, layout:"lightHorizontalLines" }
        : { text: "Yerleşemeyen ders bloğu bulunmuyor.", color: PDF_COLORS.success, bold:true },
    ],
  };
}
