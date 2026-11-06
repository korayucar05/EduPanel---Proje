export const reportPalette = {
  blue: "#2563eb",
  teal: "#059669",
  violet: "#7c3aed",
  orange: "#f97316",
  rose: "#e11d48",
  amber: "#f59e0b",
  green: "#16a34a",
  cyan: "#0891b2",
  navy: "#082f58",
  slate: "#64748b",
} as const;

export const reportChartColors = [
  reportPalette.blue,
  reportPalette.teal,
  reportPalette.violet,
  reportPalette.orange,
  reportPalette.rose,
  reportPalette.cyan,
  reportPalette.amber,
  reportPalette.green,
] as const;
