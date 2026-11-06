export type ReportIdentity = {
  reportId: string;
  reportCode?: string;
  title: string;
  generatedAt: string;
  schoolName?: string;
};

export type ReportExportTarget = "screen" | "pdf" | "whatsapp" | "print";
