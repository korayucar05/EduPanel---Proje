import { registerHasatModule } from "../../core/modules";

export * from "../../core/intelligence";

export const intelligenceModule = registerHasatModule({
  id: "hasat.intelligence",
  name: "e-Nstitü Intelligence Engine",
  description: "Akademik DNA, başarı tahmini, öneri ve öğrenci raporu karar destek çekirdeği.",
  area: "ai",
  version: "1.0.0",
  status: "beta",
  dependencies: ["hasat.reports"],
  capabilities: [
    "academic-dna",
    "success-prediction",
    "student-recommendations",
    "student-report-enrichment",
  ],
} as const);
