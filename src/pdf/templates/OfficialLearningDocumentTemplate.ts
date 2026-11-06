import { PdfEngine } from "../core/PdfEngine";
import { urlToDataUrl } from "../core/PdfHelpers";

export interface OfficialLearningDocumentOptions {
  filename: string;
  logoUrl?: string;
  institutionLine: string;
  schoolName: string;
  documentNumber: string;
  documentDate: string;
  subject?: string;
  title: string;
  subtitle: string;
  rows: Array<Array<unknown>>;
  paragraph: string;
  assistantPrincipal: string;
  principal: string;
  note?: string;
  footer: {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    mebCode?: string;
  };
}

export async function downloadOfficialLearningDocument(options: OfficialLearningDocumentOptions): Promise<void> {
  let logo: string | undefined;
  if (options.logoUrl) {
    try { logo = await urlToDataUrl(options.logoUrl); } catch { logo = undefined; }
  }

  const body = options.rows.map(([label, value]) => [
    { text: String(label || ""), bold: true, margin: [2, 1, 2, 1] },
    { text: String(value ?? ""), bold: true, margin: [2, 1, 2, 1] },
  ]);

  await PdfEngine.generate({
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [50, 36, 50, 48],
    content: [
      {
        columns: [
          logo ? { image: logo, width: 76, margin: [0, 0, 0, 0] } : { text: "", width: 76 },
          {
            width: "*",
            stack: [
              { text: "T.C.", alignment: "center", fontSize: 11 },
              { text: options.institutionLine, alignment: "center", bold: true, fontSize: 11 },
              { text: "İlçe Millî Eğitim Müdürlüğü", alignment: "center", fontSize: 11 },
              { text: options.schoolName, alignment: "center", fontSize: 11 },
            ],
          },
          { text: "", width: 76 },
        ],
      },
      {
        columns: [
          { stack: [
            { text: `Sayı   : E-33147656-${options.documentNumber}`, fontSize: 9.5 },
            { text: `Konu  : ${options.subject || "Öğrenim Durum Belgesi"}`, fontSize: 9.5 },
          ] },
          { text: options.documentDate, alignment: "right", fontSize: 9.5 },
        ],
        margin: [0, 10, 0, 0],
      },
      { text: options.title, alignment: "center", bold: true, fontSize: 13, margin: [0, 28, 0, 1] },
      { text: options.subtitle, alignment: "center", bold: true, fontSize: 10.5, margin: [0, 0, 0, 10] },
      {
        table: { widths: ["47%", "53%"], body },
        layout: {
          hLineWidth: () => 0.7, vLineWidth: () => 0.7,
          hLineColor: () => "#111111", vLineColor: () => "#111111",
          paddingLeft: () => 4, paddingRight: () => 4,
          paddingTop: () => 2.5, paddingBottom: () => 2.5,
        },
      },
      { text: options.paragraph, alignment: "justify", fontSize: 9.5, lineHeight: 1.3, margin: [0, 12, 0, 0] },
      {
        columns: [
          { width: "45%", stack: [{ text: options.assistantPrincipal, bold: true, alignment: "center" }, { text: "Müdür Yardımcısı", bold: true, alignment: "center" }] },
          { width: "10%", text: "" },
          { width: "45%", stack: [{ text: options.principal, bold: true, alignment: "center" }, { text: "Okul Müdürü", bold: true, alignment: "center" }] },
        ],
        margin: [0, 32, 0, 0],
      },
      ...(options.note ? [{ text: options.note, bold: true, italics: true, fontSize: 8, margin: [0, 22, 0, 0] }] : []),
    ],
    footer: () => ({
      margin: [50, 0, 50, 12],
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: "#B4B4B4" }],
      columns: [
        { width: "50%", text: `Adres: ${options.footer.address || "-"}\nTelefon: ${options.footer.phone || "-"}\nE-posta: ${options.footer.email || "-"}`, fontSize: 7, margin: [0, 4, 0, 0] },
        { width: "50%", text: `Web: ${options.footer.website || "-"}\nMEB Kodu: ${options.footer.mebCode || "-"}\nBelge elektronik ortamda hazırlanmıştır.`, fontSize: 7, alignment: "right", margin: [0, 4, 0, 0] },
      ],
    }),
  }, { filename: options.filename });
}
