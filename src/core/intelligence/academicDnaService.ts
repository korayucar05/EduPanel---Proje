import type {
  AcademicDnaDimension,
  AcademicDnaProfile,
  StudentReportV2Data,
} from "../../reports-v2/types";
import type { IntelligenceContext } from "./types";
import { average, clamp, confidenceFromSample, round, standardDeviation } from "./math";

const confidenceLevel = (value: number): AcademicDnaDimension["confidence"] =>
  value >= 85 ? 5 : value >= 70 ? 4 : value >= 55 ? 3 : value >= 40 ? 2 : 1;

const confidenceLabel = (value: number): AcademicDnaDimension["confidenceLabel"] =>
  value >= 85 ? "Yüksek" : value >= 70 ? "İyi" : value >= 55 ? "Orta" : value >= 40 ? "Sınırlı" : "Düşük";

const statusFor = (score: number): AcademicDnaDimension["status"] =>
  score >= 75 ? "strong" : score < 50 ? "priority" : "developing";

const subjectRate = (subject: StudentReportV2Data["subjects"][number]) => {
  if (Number.isFinite(Number(subject.successRate))) return clamp(Number(subject.successRate));
  return subject.totalQuestions > 0 ? clamp(subject.correct / subject.totalQuestions * 100) : 0;
};

const dimension = (
  key: AcademicDnaDimension["key"],
  label: string,
  score: number,
  confidence: number,
  evidence: string,
): AcademicDnaDimension => ({
  key,
  label,
  score: round(clamp(score)),
  confidence: confidenceLevel(confidence),
  confidenceLabel: confidenceLabel(confidence),
  evidence,
  status: statusFor(score),
});

export const createAcademicDna = ({ current, history = [] }: IntelligenceContext): AcademicDnaProfile => {
  const subjects = current.subjects || [];
  const rates = subjects.map(subjectRate);
  const totalQuestions = subjects.reduce((sum, subject) => sum + Math.max(0, subject.totalQuestions || 0), 0);
  const wrongRate = totalQuestions ? current.totals.wrong / totalQuestions * 100 : 0;
  const emptyRate = totalQuestions ? current.totals.empty / totalQuestions * 100 : 0;
  const balance = clamp(100 - standardDeviation(rates) * 1.7);
  const general = clamp(current.totals.successRate);
  const historicalRates = [...history.map(item => clamp(item.totals.successRate)), general];
  const consistency = clamp(100 - standardDeviation(historicalRates) * 2.4);
  const resilience = history.length
    ? clamp(55 + (general - average(history.map(item => item.totals.successRate))) * 2)
    : clamp(50 + general * .35);
  const confidence = confidenceFromSample(history.length + 1, subjects.length);

  const dimensions: AcademicDnaDimension[] = [
    dimension("analyticalThinking", "Analitik Düşünme", average([general, balance]), confidence,
      `Ders başarı ortalaması %${round(average(rates))}; branş dengesi %${round(balance)}.`),
    dimension("readingInterpretation", "Okuma ve Yorumlama", general * .82 + (100 - emptyRate) * .18, confidence - 5,
      `Genel başarı %${round(general)}; boş bırakma oranı %${round(emptyRate)}.`),
    dimension("problemSolving", "Problem Çözme", general * .72 + (100 - wrongRate) * .28, confidence,
      `Yanlış cevap oranı %${round(wrongRate)}; toplam net ${round(current.totals.net, 2)}.`),
    dimension("attention", "Dikkat", 100 - wrongRate * 1.65 - emptyRate * .35, confidence,
      `${current.totals.wrong} yanlış ve ${current.totals.empty} boş cevap üzerinden hesaplandı.`),
    dimension("timeManagement", "Zaman Yönetimi", 100 - emptyRate * 2.1, confidence - 5,
      `Boş cevap oranı %${round(emptyRate)}.`),
    dimension("branchBalance", "Dersler Arası Denge", balance, confidence,
      `${subjects.length} dersin başarı dağılımı karşılaştırıldı.`),
    dimension("academicResilience", "Akademik Dayanıklılık", resilience, confidence - (history.length ? 0 : 20),
      history.length ? `${history.length + 1} sınavlık değişim incelendi.` : "Tek sınav verisiyle sınırlı tahmin üretildi."),
    dimension("consistency", "İstikrar", consistency, confidence - (history.length ? 0 : 25),
      history.length ? `Sınavlar arası başarı oynaklığı ${round(standardDeviation(historicalRates))} puan.` : "İstikrar için geçmiş sınav verisi gerekiyor."),
  ];

  const overallScore = round(average(dimensions.map(item => item.score)));
  const strengths = dimensions.filter(item => item.status === "strong").sort((a,b) => b.score-a.score).slice(0,3).map(item => item.label);
  const priorities = dimensions.filter(item => item.status === "priority").sort((a,b) => a.score-b.score).slice(0,3).map(item => item.label);

  return {
    version: "1.0",
    dataScope: history.length ? "multi-exam" : "single-exam",
    overallScore,
    overallConfidence: round(average(dimensions.map(item => item.confidence * 20))),
    dimensions,
    summary: strengths.length
      ? `${current.student.name} için en güçlü akademik göstergeler: ${strengths.join(", ")}.`
      : `${current.student.name} için akademik göstergeler gelişim aşamasındadır.`,
    strengths,
    priorities,
    disclaimer: "Akademik DNA yalnızca sisteme kaydedilmiş sınav verilerinden üretilen karar destek göstergesidir.",
  };
};
