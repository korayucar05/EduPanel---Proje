import { registerHasatModule } from "../../core/modules";

export { default as LiveStudentReportView } from "../../reports-v2/live/LiveStudentReportView";
export * from "../../reports-v2/types";

export const reportsModule = registerHasatModule({
  id: "hasat.reports",
  name: "Raporlar",
  description: "Sınav, öğrenci ve canlı rapor veri sözleşmeleri.",
  area: "reports",
  version: "2.0.0",
  status: "stable",
  capabilities: ["student-report-v2", "live-report-api", "report-delivery"],
} as const);
