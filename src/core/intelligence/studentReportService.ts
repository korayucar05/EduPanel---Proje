import type { IntelligenceContext, StudentIntelligenceBundle } from "./types";
import { createAcademicDna } from "./academicDnaService";
import { predictStudentSuccess } from "./predictionService";
import { generateRecommendations } from "./recommendationService";

export const createStudentIntelligence = (context: IntelligenceContext): StudentIntelligenceBundle => ({
  version: "1.0",
  generatedAt: context.generatedAt || new Date().toISOString(),
  dataScope: context.history?.length ? "multi-exam" : "single-exam",
  academicDna: createAcademicDna(context),
  prediction: predictStudentSuccess(context),
  recommendations: generateRecommendations(context),
  targetAnalysis: context.current.targetAnalysis,
  aiEvaluation: context.current.aiEvaluation,
  parentSupport: context.current.parentSupport,
});

export const enrichStudentReport = (context: IntelligenceContext) => {
  const intelligence = createStudentIntelligence(context);
  return {
    ...context.current,
    academicDna: intelligence.academicDna,
    successPrediction: intelligence.prediction,
    studySuggestions: intelligence.recommendations
      .filter(item => item.category === "academic")
      .map(item => ({ subject: item.subject || "Genel", suggestion: item.detail })),
  };
};
