export const hasatTokens = {
  colors: {
    navy: "#0d2f5f",
    teal: "#029c83",
    green: "#18a05e",
    blue: "#3479c9",
    purple: "#7056b8",
    orange: "#ef760d",
    pink: "#e74372",
    red: "#d92d45",
    text: "#172033",
    muted: "#657188",
    border: "#dce3ec",
    surface: "#f7f9fc",
    white: "#ffffff",
  },
  radius: { card: 15, compact: 11 },
  shadow: { card: "0 1px 8px rgba(15,23,42,.04)" },
  report: { widthPx: 1123, minHeightPx: 1588, paddingPx: 34 },
} as const;

export type HasatTone = "success" | "warning" | "danger" | "info" | "neutral";

export const toneStyles: Record<HasatTone, { background: string; border: string; text: string }> = {
  success: { background: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  warning: { background: "#fffbeb", border: "#fde68a", text: "#b45309" },
  danger: { background: "#fff1f2", border: "#fecdd3", text: "#be123c" },
  info: { background: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  neutral: { background: "#f8fafc", border: "#e2e8f0", text: "#475569" },
};
