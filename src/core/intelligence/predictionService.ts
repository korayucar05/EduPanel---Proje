import type { SuccessPrediction } from "../../reports-v2/types";
import type { IntelligenceContext } from "./types";
import { clamp, confidenceFromSample, linearSlope, round, standardDeviation } from "./math";

export const predictStudentSuccess = ({ current, history = [] }: IntelligenceContext): SuccessPrediction => {
  const nets = [...history.map(item => Number(item.totals.net) || 0), Number(current.totals.net) || 0];
  const slope = linearSlope(nets);
  const volatility = standardDeviation(nets);
  const expectedNet = Math.max(0, current.totals.net + slope * 1.25);
  const margin = Math.max(1.5, volatility * .75 + (history.length ? 1 : 4));
  const confidence = round(confidenceFromSample(nets.length, current.subjects.length));
  const trendLabel: SuccessPrediction["trendLabel"] = history.length === 0
    ? "Veri Yetersiz"
    : volatility > Math.max(5, Math.abs(slope) * 3) ? "Dalgalı"
    : slope > .35 ? "Yükseliş"
    : slope < -.35 ? "Dalgalı"
    : "Durağan";

  const scoreRatio = current.totals.score && current.totals.net
    ? current.totals.score / current.totals.net
    : undefined;
  const scoreOf = (net: number) => scoreRatio ? round(net * scoreRatio, 2) : undefined;
  const riskIndex = round(clamp(
    45 + Math.max(0, -slope) * 8 + Math.min(25, volatility * 2) - Math.max(0, slope) * 5,
  ));
  const riskLevel: SuccessPrediction["riskLevel"] = riskIndex >= 80 ? "critical" : riskIndex >= 60 ? "high" : riskIndex >= 35 ? "medium" : "low";
  const riskLabel: SuccessPrediction["riskLabel"] = riskLevel === "critical" ? "Kritik" : riskLevel === "high" ? "Yüksek" : riskLevel === "medium" ? "Orta" : "Düşük";
  const interventionWindow = riskLevel === "critical" ? "24 saat içinde" : riskLevel === "high" ? "3 gün içinde" : riskLevel === "medium" ? "Bu hafta" : "Rutin takip";
  const trajectory: SuccessPrediction["trajectory"] = [
    ...history.slice(-4).map((item, index) => ({ label: item.examName || `Geçmiş ${index + 1}`, net: round(Number(item.totals.net) || 0, 2), kind: "history" as const })),
    { label: current.examName || "Güncel", net: round(current.totals.net, 2), kind: "current" as const },
    { label: "Öngörü", net: round(expectedNet, 2), kind: "forecast" as const },
  ];
  const earlyWarnings: SuccessPrediction["earlyWarnings"] = [];
  if (slope < -.35) earlyWarnings.push({ level: riskLevel === "critical" ? "high" : "medium", title: "Net düşüş eğilimi", detail: `Sınav başına yaklaşık ${round(Math.abs(slope), 2)} net düşüş görülüyor.`, action: "Öncelikli derslerde kısa dönem müdahale planı oluşturun." });
  if (volatility > 5) earlyWarnings.push({ level: "medium", title: "Dalgalı performans", detail: `Net standart sapması ${round(volatility, 2)}.`, action: "Sınav sonrası yanlış/boş nedenlerini sınıflandırın." });

  return {
    version: "1.0",
    dataScope: history.length ? "multi-exam" : "single-exam",
    confidence,
    currentNet: round(current.totals.net, 2),
    expectedNet: round(expectedNet, 2),
    lowerNet: round(Math.max(0, expectedNet - margin), 2),
    upperNet: round(expectedNet + margin, 2),
    expectedScore: scoreOf(expectedNet),
    lowerScore: scoreOf(Math.max(0, expectedNet - margin)),
    upperScore: scoreOf(expectedNet + margin),
    trendLabel,
    riskIndex,
    riskLevel,
    riskLabel,
    interventionWindow,
    trajectory,
    earlyWarnings,
    scenarios: [
      { label: "Koruma", predictedNet: round(current.totals.net, 2), predictedScore: scoreOf(current.totals.net), probability: round(clamp(confidence + 8)), description: "Mevcut çalışma düzeninin korunduğu senaryo." },
      { label: "Gelişim", predictedNet: round(expectedNet + Math.max(1, Math.abs(slope)), 2), predictedScore: scoreOf(expectedNet + Math.max(1, Math.abs(slope))), probability: round(clamp(confidence - 10)), description: "Öncelikli derslerde düzenli müdahale uygulandığı senaryo." },
      { label: "Risk", predictedNet: round(Math.max(0, expectedNet - margin), 2), predictedScore: scoreOf(Math.max(0, expectedNet - margin)), probability: round(clamp(100 - confidence + volatility * 2)), description: "Çalışma düzeninin bozulduğu veya dalgalanmanın sürdüğü senaryo." },
    ],
    drivers: [
      { title: "Net eğilimi", impact: slope > .2 ? "positive" : slope < -.2 ? "negative" : "neutral", detail: `Sınav başına yaklaşık ${round(slope, 2)} net değişim.` },
      { title: "Performans oynaklığı", impact: volatility > 5 ? "negative" : "neutral", detail: `Net standart sapması ${round(volatility, 2)}.` },
      { title: "Veri kapsamı", impact: history.length >= 2 ? "positive" : "neutral", detail: `${nets.length} sınav tahmine dahil edildi.` },
    ],
    summary: history.length
      ? `Mevcut eğilim korunursa beklenen net ${round(expectedNet, 2)} civarındadır.`
      : "Tahmin tek sınava dayanıyor; yeni sınavlarla güven düzeyi artacaktır.",
    disclaimer: "Bu tahmin kesin sonuç değildir; kayıtlı sınav verilerinden üretilen olasılıksal karar desteğidir.",
  };
};
