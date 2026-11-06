import { PdfEngine } from "../../pdf";
import { buildScheduleDistributionReport, type ScheduleDistributionReportData } from "../../pdf/templates/ScheduleDistributionReportTemplate";

export async function downloadScheduleDistributionPdf(data: ScheduleDistributionReportData) {
  return PdfEngine.generate(buildScheduleDistributionReport(data), {
    mode: "download",
    filename: `ders-dagitim-analiz-raporu-${new Date().toISOString().slice(0,10)}.pdf`,
  });
}
