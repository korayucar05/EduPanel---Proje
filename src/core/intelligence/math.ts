export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
};

export const average = (values: readonly number[], fallback = 0) => {
  const safe = values.filter(Number.isFinite);
  return safe.length ? safe.reduce((sum, value) => sum + value, 0) / safe.length : fallback;
};

export const weightedAverage = (
  values: ReadonlyArray<{ value: number; weight: number }>,
  fallback = 0,
) => {
  const safe = values.filter(item => Number.isFinite(item.value) && item.weight > 0);
  const weight = safe.reduce((sum, item) => sum + item.weight, 0);
  return weight
    ? safe.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
    : fallback;
};

export const standardDeviation = (values: readonly number[]) => {
  const safe = values.filter(Number.isFinite);
  if (safe.length < 2) return 0;
  const mean = average(safe);
  return Math.sqrt(average(safe.map(value => (value - mean) ** 2)));
};

export const linearSlope = (values: readonly number[]) => {
  const safe = values.filter(Number.isFinite);
  if (safe.length < 2) return 0;
  const xMean = (safe.length - 1) / 2;
  const yMean = average(safe);
  let numerator = 0;
  let denominator = 0;
  safe.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  return denominator ? numerator / denominator : 0;
};

export const confidenceFromSample = (sampleSize: number, dimensions = 1) =>
  clamp(35 + Math.min(45, sampleSize * 9) + Math.min(20, dimensions * 2));
