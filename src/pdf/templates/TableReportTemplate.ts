import { buildPdfFooter } from "../components/PdfFooter";
import { buildPdfHeader } from "../components/PdfHeader";
import { buildTable, type PdfPrimitiveCell } from "../components/TableBuilder";

export interface TableReportSection {
  title: string;
  subtitle?: string;
  headers: PdfPrimitiveCell[];
  rows: PdfPrimitiveCell[][];
  widths?: number[];
}

export interface TableReportDefinitionOptions {
  title: string;
  orientation?: "portrait" | "landscape";
  sections: TableReportSection[];
  logoDataUrl?: string;
  schoolName?: string;
  slogan?: string;
  margins?: [number, number, number, number];
  stripedRows?: boolean;
  centerCells?: boolean;
  borderColor?: string;
}

export function createTableReportDefinition(options: TableReportDefinitionOptions): Record<string, any> {
  const content: any[] = [];
  options.sections.forEach((section, index) => {
    if (index > 0) content.push({ text: "", pageBreak: "before" });
    content.push(buildPdfHeader({
      schoolName: options.schoolName,
      slogan: options.slogan,
      title: options.title,
      sectionTitle: section.title,
      subtitle: section.subtitle,
      logoDataUrl: options.logoDataUrl,
    }));
    content.push(buildTable(section.headers, section.rows, section.widths, {
      stripedRows: options.stripedRows,
      centerCells: options.centerCells,
      borderColor: options.borderColor,
    }));
  });

  return {
    pageSize: "A4",
    pageOrientation: options.orientation || "landscape",
    pageMargins: options.margins || [16, 16, 16, 24],
    footer: buildPdfFooter,
    content,
    info: { title: options.title },
  };
}
