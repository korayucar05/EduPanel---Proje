import { buildPdfFooter } from "../components/PdfFooter";
import { buildPdfHeader } from "../components/PdfHeader";
import { PDF_COLORS } from "../core/PdfTheme";

export interface AbsentStudentPdfRow {
  canTakeMakeup?: boolean;
  dateStr?: string;
  dayName?: string;
  sessionLabel?: string;
  classroom?: string;
  studentNumber?: string | number;
  name?: string;
  surname?: string;
  missedExam?: string;
}

export function createAbsentStudentsDefinition(rows: AbsentStudentPdfRow[], schoolName: string): Record<string, any> {
  const body = rows.map((item) => [
    { text: item.canTakeMakeup ? "X" : "", alignment: "center", bold: Boolean(item.canTakeMakeup) },
    { text: `${item.dateStr || ""} - ${item.dayName || ""}\n${item.sessionLabel || ""}`.trim() },
    { text: `${item.classroom || "-"}\nNo: ${item.studentNumber || "-"}` },
    { text: `${item.name || ""} ${item.surname || ""}`.trim(), bold: true },
    { text: item.missedExam || "-" },
  ]);

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [18, 16, 18, 24],
    footer: buildPdfFooter,
    content: [
      buildPdfHeader({
        schoolName,
        title: "Sınava Girmeyen Öğrenciler Raporu",
        sectionTitle: `${rows.length} kayıt`,
      }),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [36, 120, 88, 130, "*"],
          body: [
            ["Telafi", "Sınav Tarihi / Oturum", "Sınıf / No", "Öğrenci Adı Soyadı", "Girmediği Ortak Sınav / Öğretmen"].map((text) => ({
              text,
              bold: true,
              alignment: "center",
              color: PDF_COLORS.white,
              fillColor: PDF_COLORS.primary,
            })),
            ...body,
          ],
        },
        layout: {
          hLineColor: () => PDF_COLORS.border,
          vLineColor: () => PDF_COLORS.border,
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
          fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? PDF_COLORS.surface : undefined,
        },
      },
    ],
    info: { title: "Sınava Girmeyen Öğrenciler Raporu" },
  };
}

export interface ExamPlanClassItem {
  baseClass: string;
  group?: string;
}

export interface ExamPlanEntry {
  courseName: string;
  classes: ExamPlanClassItem[];
}

export interface ExamPlanRow {
  dateText?: string;
  dateRowSpan?: number;
  sessionText: string;
  sessionTime?: string;
  makeupDateStr?: string;
  makeupTimeStr?: string;
  makeupSessionText?: string;
  grades: ExamPlanEntry[][];
}

function buildExamCell(entries: ExamPlanEntry[], fontSize: number, classFontSize: number, itemGap: number): any {
  if (!entries.length) return { text: "-", alignment: "center", color: PDF_COLORS.muted, fontSize };
  return {
    alignment: "center",
    stack: entries.map((entry, index) => ({
      margin: [0, index ? itemGap : 0, 0, 0],
      alignment: "center",
      stack: [
        { text: entry.courseName || "Sınav", bold: true, fontSize, color: PDF_COLORS.text, alignment: "center" },
        {
          text: (entry.classes || []).flatMap((item, itemIndex) => {
            const parts: any[] = [{ text: item.baseClass || "", bold: true }];
            if (item.group) parts.push({ text: ` (${String(item.group).toLocaleLowerCase("tr-TR")})`, fontSize: Math.max(4.2, classFontSize - 0.5) });
            if (itemIndex < entry.classes.length - 1) parts.push({ text: ", " });
            return parts;
          }),
          alignment: "center",
          fontSize: classFontSize,
          lineHeight: 1.0,
          margin: [0, 0.5, 0, 0],
        },
      ],
    })),
  };
}

export function createExamPlanDefinition(options: {
  schoolName: string;
  title: string;
  rows: ExamPlanRow[];
}): Record<string, any> {
  // A4 yatay: 297 x 210 mm. PDFMake ölçüleri point cinsindedir.
  // İstenen fiziksel boşluklar:
  // - üst: 10 mm (başlık bu çizgiden başlar)
  // - sağ/sol: 8 mm
  // - tablonun son çizgisi: alttan 8 mm
  const MM_TO_PT = 72 / 25.4;
  const PAGE_HEIGHT = 210 * MM_TO_PT;
  const topMargin = 10 * MM_TO_PT;
  const sideMargin = 8 * MM_TO_PT;
  const bottomMargin = 8 * MM_TO_PT;

  const rowCount = Math.max(1, options.rows.length);
  const contentDensity = options.rows.reduce((total, row) =>
    total + row.grades.reduce((sum, gradeEntries) => sum + gradeEntries.length, 0), 0);
  const densityPerRow = contentDensity / rowCount;

  const veryDense = rowCount > 14 || contentDensity > 52 || densityPerRow > 4.2;
  const dense = veryDense || rowCount > 10 || contentDensity > 34 || densityPerRow > 3.0;

  const examFontSize = veryDense ? 4.8 : dense ? 5.4 : 6.1;
  const classFontSize = veryDense ? 4.3 : dense ? 4.9 : 5.6;
  const tableFontSize = veryDense ? 4.9 : dense ? 5.5 : 6.2;
  const headerFontSize = veryDense ? 5.7 : dense ? 6.2 : 6.8;
  const titleFontSize = veryDense ? 8.7 : dense ? 9.5 : 10.5;
  const cellPadding = veryDense ? 0.8 : dense ? 1.1 : 1.5;
  const itemGap = veryDense ? 0.6 : dense ? 0.9 : 1.3;

  const formatTrDate = (value?: string) => {
    const parts = String(value || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "");
  };

  const body: any[][] = [];
  options.rows.forEach((row) => {
    const sessionStack: any[] = [
      { text: row.sessionText || "Oturum", bold: true, fontSize: tableFontSize, alignment: "center" },
    ];
    if (row.sessionTime) {
      sessionStack.push({ text: `(${row.sessionTime})`, bold: false, fontSize: Math.max(4.3, tableFontSize - 0.5), alignment: "center", margin: [0, 1, 0, 0] });
    }
    const makeupDateText = row.makeupDateStr ? formatTrDate(row.makeupDateStr) : "-";
    const makeupTimeStack: any[] = [
      { text: row.makeupTimeStr || "-", alignment: "center", fontSize: tableFontSize },
    ];
    if (row.makeupDateStr || row.makeupTimeStr) {
      makeupTimeStack.push({
        text: `(${row.makeupSessionText || row.sessionText || "Oturum"})`,
        alignment: "center",
        fontSize: Math.max(4.2, tableFontSize - 0.8),
        margin: [0, 0.5, 0, 0],
        color: PDF_COLORS.muted,
      });
    }

    const common = [
      { stack: sessionStack, alignment: "center", margin: [0, 0, 0, 0] },
      ...row.grades.map((entries) => buildExamCell(entries, examFontSize, classFontSize, itemGap)),
      { text: makeupDateText, alignment: "center", fontSize: tableFontSize },
      { stack: makeupTimeStack, alignment: "center" },
    ];
    if (row.dateText) {
      body.push([
        {
          text: row.dateText,
          rowSpan: Math.max(1, row.dateRowSpan || 1),
          alignment: "center",
          bold: true,
          fontSize: tableFontSize,
          lineHeight: 1.0,
        },
        ...common,
      ]);
    } else {
      body.push([{}, ...common]);
    }
  });



  const headers = [
    "Sınav Tarihi",
    "Oturum",
    "9. Sınıf Sınavları",
    "10. Sınıf Sınavları",
    "11. Sınıf Sınavları",
    "12. Sınıf Sınavları",
    "Telafi Tarihi",
    "Telafi Saati",
  ];
  const tableBody = [
    headers.map((text) => ({
      text,
      bold: true,
      alignment: "center",
      color: PDF_COLORS.white,
      fillColor: "#4F46E5",
      fontSize: headerFontSize,
      lineHeight: 1.0,
    })),
    ...body,
  ];

  // Başlık üst kenardan tam 10 mm'de başlar. Başlık + boşluk için kompakt sabit alan ayırıp,
  // tablonun kalan yüksekliğini sayfanın altından 8 mm'de bitecek şekilde satırlara dağıtıyoruz.
  // Satır yükseklikleri sabitlenmez. PDFMake her satırı, o satırdaki en yüksek hücrenin
  // gerçek içerik yüksekliğine göre otomatik hesaplar. Böylece hücrenin altındaki gereksiz
  // boşluk kaldırılır ve en alttaki bilginin hemen sonrasında satır biter.

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [sideMargin, topMargin, sideMargin, bottomMargin],
    content: [
      {
        text: options.title,
        alignment: "center",
        bold: true,
        fontSize: titleFontSize,
        color: PDF_COLORS.text,
        margin: [0, 0, 0, veryDense ? 4 : 6],
        lineHeight: 1.0,
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [58, 48, "*", "*", "*", "*", 52, 48],
          body: tableBody,
        },
        layout: {
          hLineColor: () => PDF_COLORS.border,
          vLineColor: () => PDF_COLORS.border,
          hLineWidth: () => 0.45,
          vLineWidth: () => 0.45,
          paddingLeft: () => cellPadding,
          paddingRight: () => cellPadding,
          paddingTop: (rowIndex: number) => rowIndex === 0 ? 3 : Math.max(0.6, cellPadding * 0.65),
          paddingBottom: (rowIndex: number) => rowIndex === 0 ? 3 : Math.max(0.6, cellPadding * 0.65),
          fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? "#F8FAFC" : undefined,
        },
      },
    ],
    defaultStyle: { fontSize: tableFontSize, lineHeight: 1.0 },
    info: { title: options.title },
  };
}
