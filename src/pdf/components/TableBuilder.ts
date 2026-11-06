import { PDF_COLORS } from "../core/PdfTheme";
import { normalizeWidths } from "../core/PdfHelpers";

export type PdfPrimitiveCell = string | number | {
  text?: string | number;
  lines?: Array<{ text: string | number; bold?: boolean; color?: string }>;
  segments?: Array<{ text: string | number; bold?: boolean; color?: string }>;
  subcells?: Array<{ text: string | number; bold?: boolean; color?: string }>;
  background?: string;
  color?: string;
  bold?: boolean;
  boxed?: boolean;
};

function toContent(cell: PdfPrimitiveCell, header = false): any {
  if (typeof cell !== "object" || cell === null) {
    return { text: String(cell ?? ""), style: header ? "tableHeader" : "tableCell", alignment: header ? "center" : undefined };
  }

  if (cell.lines?.length) {
    return {
      stack: cell.lines.map((line) => ({ text: String(line.text ?? ""), bold: Boolean(line.bold), color: line.color || cell.color })),
      fillColor: cell.background,
      color: cell.color,
      bold: cell.bold,
    };
  }

  if (cell.segments?.length) {
    return {
      text: cell.segments.map((segment) => ({ text: String(segment.text ?? ""), bold: Boolean(segment.bold), color: segment.color || cell.color })),
      fillColor: cell.background,
      color: cell.color,
      bold: cell.bold,
    };
  }

  if (cell.subcells?.length) {
    return {
      stack: [
        ...(cell.text !== undefined ? [{ text: String(cell.text), bold: true, alignment: "center", margin: [0, 0, 0, 2] }] : []),
        {
          table: {
            widths: cell.subcells.map(() => "*"),
            body: [[...cell.subcells.map((subcell) => ({ text: String(subcell.text ?? ""), bold: Boolean(subcell.bold), color: subcell.color, alignment: "center" }))]],
          },
          layout: "noBorders",
        },
      ],
      fillColor: cell.background,
      color: cell.color,
    };
  }

  return {
    text: String(cell.text ?? ""),
    fillColor: cell.background,
    color: cell.color,
    bold: cell.bold || header || cell.boxed,
    alignment: header || cell.boxed ? "center" : undefined,
    margin: cell.boxed ? [2, 3, 2, 3] : undefined,
  };
}

export function buildTable(headers: PdfPrimitiveCell[], rows: PdfPrimitiveCell[][], widths?: number[], options?: { stripedRows?: boolean; centerCells?: boolean; borderColor?: string }): any {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: normalizeWidths(widths, headers.length),
      body: [
        headers.map((cell) => toContent(cell, true)),
        ...rows.map((row, rowIndex) => row.map((cell) => ({
          ...toContent(cell, false),
          alignment: options?.centerCells ? "center" : toContent(cell, false).alignment,
          fillColor: (typeof cell === "object" && cell?.background) || (options?.stripedRows && rowIndex % 2 === 0 ? "#F1F5F9" : undefined),
        }))),
      ],
    },
    layout: {
      hLineColor: () => options?.borderColor || PDF_COLORS.border,
      vLineColor: () => options?.borderColor || PDF_COLORS.border,
      hLineWidth: () => 0.55,
      vLineWidth: () => 0.55,
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}
