import { PdfEngine } from "../core/PdfEngine";

export interface DiplomaPetitionOptions {
  filename: string;
  schoolName: string;
  educationYear: string;
  graduateName: string;
  reason: string;
  requesterName: string;
  requesterRelationship?: string;
  documentDate: string;
}

export async function downloadDiplomaPetition(options: DiplomaPetitionOptions): Promise<void> {
  await PdfEngine.generate({
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [70, 60, 70, 60],
    defaultStyle: {
      fontSize: 12,
      lineHeight: 1.5,
    },
    content: [
      {
        text: `${options.schoolName} Müdürlüğüne,`,
        alignment: "center",
        bold: true,
        fontSize: 14,
      },
      {
        text: `${options.schoolName}'nden ${options.educationYear} eğitim öğretim yılında mezun olan ${options.graduateName} adına Öğrenim Durum Belgesi düzenlenerek tarafıma verilmesini arz ederim.`,
        alignment: "justify",
        margin: [0, 48, 0, 0],
      },
      {
        text: [
          { text: "Belgenin düzenlenme sebebi: ", bold: true },
          { text: options.reason },
        ],
        alignment: "justify",
        margin: [0, 14, 0, 0],
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 210,
            stack: [
              { text: options.documentDate, alignment: "center", margin: [0, 0, 0, 12] },
              { text: options.requesterName, bold: true, alignment: "center" },
              ...(options.requesterRelationship
                ? [{ text: `Yakınlığı: ${options.requesterRelationship}`, alignment: "center", margin: [0, 4, 0, 0] }]
                : []),
              { text: "İmza", bold: true, alignment: "center", margin: [0, 34, 0, 0] },
              { text: "\n\n", alignment: "center" },
            ],
          },
        ],
        margin: [0, 52, 0, 0],
      },
    ],
  }, { filename: options.filename });
}
