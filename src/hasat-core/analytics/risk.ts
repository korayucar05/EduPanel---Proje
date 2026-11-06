export type RiskInput = {
  successRate?: number;
  emptyRate?: number;
  trendDelta?: number;
  volatility?: number;
};

export function calculateAcademicRisk(input: RiskInput) {
  let score = 0;
  const reasons: string[] = [];
  if ((input.successRate ?? 100) < 50) { score += 35; reasons.push("Genel başarı hedefin altında."); }
  else if ((input.successRate ?? 100) < 65) { score += 18; reasons.push("Genel başarı destek gerektiriyor."); }
  if ((input.emptyRate ?? 0) > 20) { score += 25; reasons.push("Boş bırakma oranı yüksek."); }
  else if ((input.emptyRate ?? 0) > 10) { score += 12; reasons.push("Boş bırakma oranı izlenmeli."); }
  if ((input.trendDelta ?? 0) < -3) { score += 25; reasons.push("Sınav eğilimi düşüş yönünde."); }
  if ((input.volatility ?? 0) > 4) { score += 15; reasons.push("Performans dalgalı seyrediyor."); }
  const normalized = Math.min(100, score);
  return {
    score: normalized,
    level: normalized >= 60 ? "high" : normalized >= 30 ? "medium" : "low",
    reasons,
  } as const;
}
