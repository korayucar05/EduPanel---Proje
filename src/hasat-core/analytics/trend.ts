export type TrendPoint = { label: string; value: number };
export type TrendState = "rising" | "falling" | "stable" | "volatile" | "insufficient";

export function analyzeTrend(points: TrendPoint[]) {
  const valid = points.filter((point) => Number.isFinite(point.value));
  if (valid.length < 2) return { state: "insufficient" as TrendState, delta: 0, volatility: 0 };
  const delta = valid[valid.length - 1].value - valid[0].value;
  const changes = valid.slice(1).map((point, index) => point.value - valid[index].value);
  const mean = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const volatility = Math.sqrt(changes.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / changes.length);
  const state: TrendState = volatility > Math.max(2.5, Math.abs(mean) * 1.8)
    ? "volatile"
    : delta > 1
      ? "rising"
      : delta < -1
        ? "falling"
        : "stable";
  return { state, delta, volatility };
}
