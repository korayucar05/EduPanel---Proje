import { PdfEngine } from "../pdf/core/PdfEngine";
import { urlToDataUrl, chunkArray } from "../pdf/core/PdfHelpers";
import { PDF_COLORS } from "../pdf/core/PdfTheme";
import { buildPdfFooter } from "../pdf/components/PdfFooter";
import { buildPdfHeader } from "../pdf/components/PdfHeader";
import { buildTable, type PdfPrimitiveCell } from "../pdf/components/TableBuilder";
import { buildReportFamilyPdfHeader, type ReportFamilyPdfHeader } from "../pdf/components/ReportFamilyHeader";

const schoolLogoUrl = new URL("../assets/ordu-lisesi-logo.png", import.meta.url).href;
const schoolCampusUrl = new URL("../assets/ordu-lisesi-campus-report.png", import.meta.url).href;

export type PdfCell = PdfPrimitiveCell;
export type PdfAnswerGroup = {
  subject: string;
  answers: { question: string | number; correct: string; student: string }[];
  score?: string | number;
  lostScore?: string | number;
  classroomRank?: string | number;
  institutionRank?: string | number;
  generalRank?: string | number;
  net?: string | number;
  averageNet?: string | number;
  institutionAverageNet?: string | number;
};
export type PdfComparisonAnalysis = {
  subjects: { subject: string; rankings: { classroom: string; rank: number; currentNet: number; historicalNet: number | null; delta: number | null }[] }[];
  alerts: string[];
};
export type PdfSection = {
  title: string;
  subtitle?: string;
  headers: PdfCell[];
  rows: PdfCell[][];
  widths?: number[];
  answerGroups?: PdfAnswerGroup[];
  comparisonAnalysis?: PdfComparisonAnalysis;
};
export type ScorecardHeader = {
  studentName: string;
  reportLabel: string;
  examLabel: string;
  classroom?: string;
  studentNumber?: string | number;
  examDate?: string;
  photoUrl?: string;
  useBrushBackground?: boolean;
  performance: { label: string; questions: string | number; correct: string | number; wrong: string | number; empty: string | number; net: string | number; score: string | number }[];
  rankings: { label: string; rank: string | number; participants: string | number }[];
};

export interface ExportTablePdfOptions {
  orientation?: "portrait" | "landscape";
  rowsPerPage?: number;
  download?: boolean;
  fullWidth?: boolean;
  stripedRows?: boolean;
  centerCells?: boolean;
  horizontalMarginMm?: number;
  columnBorderColor?: string;
  scorecardHeader?: ScorecardHeader;
  designedHeader?: ReportFamilyPdfHeader;
  tableWidthPercent?: number;
  verticalCenter?: boolean;
  tableLeftBorder?: boolean;
  bodyRowHeightPx?: number;
  headBackgroundColor?: string;
  headTextColor?: string;
  headerBandBorderColor?: string;
  reportTitleColor?: string;
  tableTopMarginPx?: number;
}

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
};

function buildScorecardHeader(header: ScorecardHeader, logoDataUrl?: string): any {
  const infoRows = [
    ["Adı Soyadı", header.studentName],
    ["Sınıf / Şube", header.classroom || "-"],
    ["Numarası", header.studentNumber || "-"],
    ["Sınav Adı", header.examLabel || "-"],
    ["Sınav Tarihi", header.examDate || "-"],
  ];

  const performanceBody = [
    [{ text: "Düzey", bold: true }, { text: "D", bold: true }, { text: "Y", bold: true }, { text: "B", bold: true }, { text: "Net", bold: true }, { text: "Puan", bold: true }],
    ...header.performance.map((item) => [item.label, item.correct, item.wrong, item.empty, item.net, item.score]),
  ];

  const rankingBody = [
    [{ text: "Düzey", bold: true }, { text: "Sıra", bold: true }, { text: "Katılım", bold: true }],
    ...header.rankings.map((item) => [item.label, item.rank, item.participants]),
  ];

  const identityCell: any = header.photoUrl
    ? { image: header.photoUrl, fit: [66, 82], alignment: "center", margin: [0, 2, 0, 2] }
    : { text: header.studentName.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join(""), fontSize: 24, bold: true, color: PDF_COLORS.primary, alignment: "center", margin: [0, 26, 0, 26] };

  return {
    stack: [
      {
        columns: [
          ...(logoDataUrl ? [{ image: logoDataUrl, width: 38, height: 38 }] : []),
          { text: "ORDU LİSESİ", fontSize: 18, bold: true, color: PDF_COLORS.primary, margin: [8, 8, 0, 0] },
        ],
        width: "auto",
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
      { text: header.reportLabel, fontSize: 16, bold: true, color: PDF_COLORS.danger, alignment: "center", margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ["42%", "35%", "23%"],
          body: [[
            {
              table: {
                widths: [72, "*"],
                body: [[
                  identityCell,
                  {
                    table: { widths: [72, "*"], body: infoRows.map(([label, value]) => [{ text: label, bold: true, fontSize: 7 }, { text: String(value), fontSize: 7 }]) },
                    layout: "lightHorizontalLines",
                  },
                ]],
              },
              layout: "noBorders",
            },
            {
              stack: [
                { text: "Öğrenci Sınav Performansı", bold: true, color: PDF_COLORS.success, alignment: "center", margin: [0, 0, 0, 4] },
                { table: { widths: ["*", "*", "*", "*", "*", "*"], body: performanceBody }, layout: "lightHorizontalLines" },
              ],
            },
            {
              stack: [
                { text: "Sıralama", bold: true, color: PDF_COLORS.success, alignment: "center", margin: [0, 0, 0, 4] },
                { table: { widths: ["*", "*", "*"], body: rankingBody }, layout: "lightHorizontalLines" },
              ],
            },
          ]],
        },
        layout: {
          hLineColor: () => PDF_COLORS.danger,
          vLineColor: () => PDF_COLORS.danger,
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 10],
      },
    ],
  };
}

function buildSubjectSummary(groups: PdfAnswerGroup[]): any {
  const rows = groups.map((group) => {
    let correct = 0;
    let wrong = 0;
    let empty = 0;
    group.answers.forEach((answer) => {
      const expected = String(answer.correct || "").trim().toLocaleUpperCase("tr-TR");
      const student = String(answer.student || "").trim().toLocaleUpperCase("tr-TR");
      if (!student || student === "-") empty += 1;
      else if (student === expected) correct += 1;
      else wrong += 1;
    });
    const net = toNumber(group.net, correct - wrong / 4);
    const rate = group.answers.length ? (net / group.answers.length) * 100 : 0;
    const comment = rate >= 85 ? "Mükemmel" : rate >= 70 ? "İyi" : rate >= 50 ? "Gelişiyor" : "Destek Gerekli";
    return [
      { text: group.subject, bold: true, fillColor: PDF_COLORS.surface },
      group.answers.length, correct, wrong, empty, group.net ?? net.toFixed(2), group.averageNet ?? "-", group.institutionAverageNet ?? "-",
      group.score ?? "-", group.lostScore ?? "-", group.classroomRank ?? "-", group.institutionRank ?? "-", group.generalRank ?? "-", comment,
    ];
  });

  return {
    margin: [0, 10, 0, 0],
    table: {
      headerRows: 2,
      widths: ["12%", "5%", "5%", "5%", "5%", "6%", "6%", "6%", "6%", "6%", "6%", "6%", "6%", "10%"],
      body: [
        [
          { text: "Ders", rowSpan: 2, bold: true }, { text: "Soru", rowSpan: 2, bold: true }, { text: "Doğru", rowSpan: 2, bold: true },
          { text: "Yanlış", rowSpan: 2, bold: true }, { text: "Boş", rowSpan: 2, bold: true }, { text: "Net", rowSpan: 2, bold: true },
          { text: "Ortalama Net", colSpan: 2, bold: true, alignment: "center" }, {}, { text: "Puan", rowSpan: 2, bold: true },
          { text: "Kaybolan", rowSpan: 2, bold: true }, { text: "Sıralamalar", colSpan: 3, bold: true, alignment: "center" }, {}, {},
          { text: "Yorum", rowSpan: 2, bold: true },
        ],
        [{}, {}, {}, {}, {}, {}, "Sınıf", "Kurum", {}, {}, "Sınıf", "Kurum", "Genel", {}],
        ...rows,
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 7,
  };
}

function buildAnswerComparison(groups: PdfAnswerGroup[]): any {
  const rows = groups.map((group) => {
    const cells: any[] = group.answers.slice(0, 40).map((answer) => ({
      stack: [
        { text: String(answer.correct || "-"), fontSize: 6, bold: true, alignment: "center" },
        { text: String(answer.student || "-"), fontSize: 6, alignment: "center", color: String(answer.student || "").toLocaleUpperCase("tr-TR") === String(answer.correct || "").toLocaleUpperCase("tr-TR") ? PDF_COLORS.success : PDF_COLORS.danger },
      ],
      margin: [0, 1, 0, 1],
    }));
    while (cells.length < 40) cells.push({ stack: [{ text: "", fontSize: 6 }, { text: "", fontSize: 6 }], margin: [0, 1, 0, 1] });
    return [{ text: group.subject, fontSize: 6, bold: true, color: PDF_COLORS.primary }, ...cells];
  });

  return {
    margin: [0, 8, 0, 0],
    stack: [
      { text: "CEVAP KARŞILAŞTIRMA", bold: true, fontSize: 8, color: PDF_COLORS.primary, margin: [0, 0, 0, 3] },
      {
        table: { widths: [46, ...Array.from({ length: 40 }, () => "*")], body: rows },
        layout: { hLineWidth: () => 0.35, vLineWidth: () => 0.35, hLineColor: () => PDF_COLORS.border, vLineColor: () => PDF_COLORS.border, paddingLeft: () => 0.4, paddingRight: () => 0.4, paddingTop: () => 0.3, paddingBottom: () => 0.3 },
      },
    ],
  };
}

export async function exportTablePdf(filename: string, title: string, sections: PdfSection[], options: ExportTablePdfOptions = {}): Promise<Blob> {
  let logoDataUrl: string | undefined;
  let campusDataUrl: string | undefined;
  try { logoDataUrl = await urlToDataUrl(schoolLogoUrl); } catch { logoDataUrl = undefined; }
  try { campusDataUrl = await urlToDataUrl(schoolCampusUrl); } catch { campusDataUrl = undefined; }

  const content: any[] = [];
  let pageStarted = false;

  for (const section of sections) {
    const chunks = chunkArray(section.rows || [], options.rowsPerPage || (options.orientation === "portrait" ? 18 : 14));
    for (let index = 0; index < chunks.length; index += 1) {
      if (pageStarted) content.push({ text: "", pageBreak: "before" });
      pageStarted = true;

      if (options.designedHeader) {
        content.push(buildReportFamilyPdfHeader({
          ...options.designedHeader,
          sectionTitle: section.title,
          sectionSubtitle: section.subtitle,
        }, logoDataUrl, campusDataUrl));
      } else if (options.scorecardHeader && content.length === 0) {
        content.push(buildScorecardHeader(options.scorecardHeader, logoDataUrl));
      } else {
        content.push(buildPdfHeader({
          schoolName: "ORDU LİSESİ",
          slogan: "Ordunun taa kendisi",
          title,
          sectionTitle: section.title,
          subtitle: `${section.subtitle || ""}${chunks.length > 1 ? ` - Sayfa ${index + 1}/${chunks.length}` : ""}`,
          logoDataUrl,
        }));
      }

      if (options.tableTopMarginPx) content.push({ text: "", margin: [0, Math.round(options.tableTopMarginPx * 0.55), 0, 0] });

      content.push(buildTable(section.headers, chunks[index], section.widths, {
        stripedRows: options.stripedRows,
        centerCells: options.centerCells,
        borderColor: options.columnBorderColor,
      }));

      if (section.answerGroups?.length && index === chunks.length - 1) {
        content.push(buildSubjectSummary(section.answerGroups));
        content.push(buildAnswerComparison(section.answerGroups));
      }
    }
  }

  const marginMm = options.horizontalMarginMm ?? (options.fullWidth ? 0 : options.orientation === "portrait" ? 5 : 2);
  const points = Math.max(0, marginMm * 2.83465);
  const definition = {
    pageSize: "A4",
    pageOrientation: options.orientation || "landscape",
    pageMargins: [points, options.scorecardHeader ? 14 : 16, points, 24],
    footer: buildPdfFooter,
    content,
    info: { title },
  };

  const blob = await PdfEngine.generate(definition, { mode: "blob", filename }) as Blob;
  if (options.download !== false) await PdfEngine.generate(definition, { mode: "download", filename });
  return blob;
}
