export const PDF_COLORS = {
  primary: "#173A72",
  primaryLight: "#EFF6FF",
  success: "#15803D",
  successLight: "#DCFCE7",
  danger: "#B91C1C",
  dangerLight: "#FEE2E2",
  warning: "#B45309",
  warningLight: "#FEF3C7",
  text: "#0F172A",
  muted: "#64748B",
  border: "#CBD5E1",
  surface: "#F8FAFC",
  white: "#FFFFFF",
} as const;

export const PdfTheme = {
  defaultStyle: {
    font: "Roboto",
    fontSize: 9,
    color: PDF_COLORS.text,
    lineHeight: 1.15,
  },
  styles: {
    schoolName: { fontSize: 17, bold: true, color: PDF_COLORS.primary },
    reportTitle: { fontSize: 15, bold: true, color: PDF_COLORS.text, alignment: "center" },
    sectionTitle: { fontSize: 12, bold: true, color: PDF_COLORS.primary },
    tableHeader: { fontSize: 8, bold: true, color: PDF_COLORS.primary, alignment: "center" },
    tableCell: { fontSize: 8, color: PDF_COLORS.text },
    smallMuted: { fontSize: 7, color: PDF_COLORS.muted },
  },
};
