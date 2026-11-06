import { PdfEngine } from "../core/PdfEngine";
import { mmToPt, safeFileName } from "../core/PdfHelpers";

export interface AnswerKeyItem {
  number: number;
  answer: string;
}

export interface AnswerKeySection {
  title: string;
  answers: AnswerKeyItem[];
}

export interface AnswerKeyBooklet {
  key: string;
  sections: AnswerKeySection[];
}

export interface AnswerKeyPdfInput {
  examName: string;
  booklets: AnswerKeyBooklet[];
}

export interface BookletLayoutQuestion {
  number: number;
  imageUrl?: string;
  contentHeight: number; // toplam blok yüksekliği (mm): yönerge + soru
  questionImageHeight?: number; // yalnız soru görselinin yüksekliği (mm)
  requestedGap?: number;
  placeholder?: boolean;
  answer?: string;
  questionGroupId?: string;
  questionGroupLayout?: "normal" | "full-width-source";
  questionGroupOrder?: number;
  questionGroupSize?: number;
  groupInstruction?: {
    title?: string;
    text?: string;
    imageUrl?: string;
    imageHeight?: number;
    height?: number;
    questionCount?: number;
    mode?: "required" | "free";
    layout?: "normal" | "full-width-source";
  };
}

export interface BookletCurriculumSummaryItem {
  unitName: string;
  topicName?: string;
  outcomeName?: string;
  questionCount: number;
}

export interface BookletLayoutPage {
  testName: string;
  isTestStart: boolean;
  startY: number; // millimetre
  columns: [BookletLayoutQuestion[], BookletLayoutQuestion[]];
  blank?: boolean;
  coverUrl?: string;
  headerUrl?: string;
  curriculumSummary?: BookletCurriculumSummaryItem[];
  fullWidthInstructionY?: number;
  fullWidthGroupInstruction?: {
    groupId?: string;
    title?: string;
    text?: string;
    imageUrl?: string;
    imageHeight?: number;
    height?: number;
    questionCount?: number;
    mode?: "required" | "free";
    layout?: "normal" | "full-width-source";
  };
}

export interface BookletPdfInput {
  examName: string;
  publisherName?: string;
  bookletKey: string;
  pages: BookletLayoutPage[];
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_X_MM = 10;
const MARGIN_Y_MM = 15;
const COLUMN_WIDTH_MM = 90;
const COLUMN_SPACE_MM = 10;
const DIVIDER_X_MM = MARGIN_X_MM + COLUMN_WIDTH_MM + COLUMN_SPACE_MM / 2;
const PAGE_BOTTOM_MM = A4_HEIGHT_MM - MARGIN_Y_MM;

// Ünite Denemesi başlık görseli: önceki 200 × 90 mm alan 8 mm daraltıldı.
// En-boy oranı korunur ve bütün başlık bloğu 8 mm aşağı taşınır.
const UNIT_SCAN_HEADER_WIDTH_MM = 192;
const UNIT_SCAN_HEADER_HEIGHT_MM = 90 * (UNIT_SCAN_HEADER_WIDTH_MM / 200); // 86.4 mm
const UNIT_SCAN_HEADER_X_MM = (A4_WIDTH_MM - UNIT_SCAN_HEADER_WIDTH_MM) / 2;
const UNIT_SCAN_HEADER_Y_MM = 13;
const UNIT_SCAN_CONTENT_START_MM = UNIT_SCAN_HEADER_Y_MM + UNIT_SCAN_HEADER_HEIGHT_MM + 5;

// Başlık görselinin içindeki sabit bilgi alanları. Koordinatlar başlık bloğuna göredir.
const UNIT_SCAN_BOOKLET_X_MM = UNIT_SCAN_HEADER_X_MM + 149;
const UNIT_SCAN_BOOKLET_WIDTH_MM = 40;
const UNIT_SCAN_BOOKLET_Y_MM = UNIT_SCAN_HEADER_Y_MM + 10.5;
// Ünite denemesi adı ile Ünite/Konu/Kazanım bilgi bloğu bundan sonra aynı
// yatay merkez eksenini kullanır. Bu merkez mevcut, kullanıcı tarafından
// onaylanan konumdan türetilir; tüm sonraki ünite denemeleri de buraya ortalanır.
const UNIT_SCAN_SHARED_TEXT_CENTER_MM = (UNIT_SCAN_HEADER_X_MM + 28) + (UNIT_SCAN_HEADER_WIDTH_MM - 16) / 2;
const UNIT_SCAN_TEST_NAME_WIDTH_MM = UNIT_SCAN_HEADER_WIDTH_MM - 16;

const buildGroupRangeText = (rangeStart: number, rangeEnd: number) => {
  const safeStart = Math.max(1, Math.trunc(Number(rangeStart || 1)));
  const safeEnd = Math.max(safeStart, Math.trunc(Number(rangeEnd || safeStart)));
  return safeStart === safeEnd
    ? `${safeStart}. soruyu aşağıdaki bilgiye göre cevaplayınız.`
    : `${safeStart}. ve ${safeEnd}. sorular arasındaki soruları aşağıdaki bilgiye göre cevaplayınız.`;
};
const UNIT_SCAN_TEST_NAME_X_MM = UNIT_SCAN_SHARED_TEXT_CENTER_MM - UNIT_SCAN_TEST_NAME_WIDTH_MM / 2;
const UNIT_SCAN_TEST_NAME_Y_MM = UNIT_SCAN_HEADER_Y_MM + 34.8;
const UNIT_SCAN_SUMMARY_TOP_MM = UNIT_SCAN_HEADER_Y_MM + 40.0;
const UNIT_SCAN_SUMMARY_HEIGHT_MM = 36.5;

const positionText = (text: any, xMm: number, yMm: number, options: Record<string, any> = {}) => ({
  text,
  absolutePosition: { x: mmToPt(xMm), y: mmToPt(yMm) },
  ...options,
});

// absolutePosition ile çizilen düz text öğelerinde `width` her durumda satır kırmayı
// zorlamadığı için, başlık içi metinleri tek kolonlu sabit genişlik kabına alıyoruz.
// Böylece hiçbir ünite/konu/kazanım satırı belirlenen alanın dışına taşamaz.
const positionConstrainedText = (
  text: any,
  xMm: number,
  yMm: number,
  widthMm: number,
  options: Record<string, any> = {},
) => ({
  columns: [{
    width: mmToPt(widthMm),
    text,
    ...options,
  }],
  columnGap: 0,
  absolutePosition: { x: mmToPt(xMm), y: mmToPt(yMm) },
});

const ANSWER_CARD_ACCENTS = ["#4F46E5", "#0D9488", "#C2410C", "#7C3AED"];

function buildAnswerCard(
  input: AnswerKeyPdfInput,
  booklet: AnswerKeyBooklet,
  xMm: number,
  yMm: number,
  cardIndex: number,
) {
  const accent = ANSWER_CARD_ACCENTS[cardIndex % ANSWER_CARD_ACCENTS.length];
  const title = `${String(booklet.key || "A").toLocaleUpperCase("tr-TR")} KİTAPÇIĞI`;
  const content: any[] = [
    {
      canvas: [
        { type: "rect", x: mmToPt(xMm), y: mmToPt(yMm), w: mmToPt(95), h: mmToPt(140), color: "#FFFFFF", lineColor: "#CBD5E1", lineWidth: 0.55 },
        { type: "rect", x: mmToPt(xMm), y: mmToPt(yMm), w: mmToPt(95), h: mmToPt(11), color: accent, lineColor: accent },
      ],
      absolutePosition: { x: 0, y: 0 },
    },
    positionText(`${input.examName.toLocaleUpperCase("tr-TR")} - ${title}`, xMm + 5, yMm + 3.1, {
      color: "#FFFFFF", bold: true, fontSize: 9,
    }),
  ];

  let py = yMm + 17;
  for (const section of booklet.sections || []) {
    content.push({
      canvas: [
        { type: "rect", x: mmToPt(xMm + 4), y: mmToPt(py - 2.8), w: mmToPt(1.5), h: mmToPt(4), color: accent, lineColor: accent },
        { type: "line", x1: mmToPt(xMm + 4), y1: mmToPt(py + 1.2), x2: mmToPt(xMm + 91), y2: mmToPt(py + 1.2), lineColor: "#F1F5F9", lineWidth: 0.4 },
      ],
      absolutePosition: { x: 0, y: 0 },
    });
    content.push(positionText(String(section.title || "SORULAR").toLocaleUpperCase("tr-TR"), xMm + 7, py - 2.8, {
      bold: true, fontSize: 8.5, color: "#0F172A",
    }));
    py += 4.8;

    const answers = [...(section.answers || [])].sort((a, b) => Number(a.number) - Number(b.number));
    answers.forEach((entry, index) => {
      const column = index % 10;
      const row = Math.floor(index / 10);
      const itemX = xMm + 4 + column * 9;
      const itemY = py + row * 4.5;
      const qNo = Math.max(1, Number(entry?.number || index + 1));
      content.push(positionText(`${qNo}.`, itemX, itemY, { fontSize: 7.2, color: "#64748B" }));
      content.push(positionText(String(entry?.answer || "-").toLocaleUpperCase("tr-TR"), itemX + (qNo >= 10 ? 4.2 : 3.2), itemY - 0.2, {
        fontSize: 8, bold: true, color: "#0F172A",
      }));
    });
    py += Math.ceil(answers.length / 10) * 4.5 + 3;
  }
  return content;
}

export function buildAnswerKeyPdfDefinition(input: AnswerKeyPdfInput): Record<string, any> {
  const positions = [
    { x: 8, y: 8 },
    { x: 106, y: 8 },
    { x: 8, y: 150 },
    { x: 106, y: 150 },
  ];
  const booklets = (input.booklets || []).slice(0, 4);
  const content: any[] = [];

  booklets.forEach((booklet, index) => {
    const position = positions[index];
    content.push(...buildAnswerCard(input, booklet, position.x, position.y, index));
  });

  if (booklets.length > 2) {
    content.push({
      canvas: [
        { type: "line", x1: mmToPt(4), y1: mmToPt(148.5), x2: mmToPt(206), y2: mmToPt(148.5), dash: { length: 8, space: 8 }, lineColor: "#94A3B8", lineWidth: 0.4 },
      ],
      absolutePosition: { x: 0, y: 0 },
    });
  }
  if (booklets.length > 1) {
    content.push({
      canvas: [
        { type: "line", x1: mmToPt(103.5), y1: mmToPt(4), x2: mmToPt(103.5), y2: mmToPt(booklets.length > 2 ? 292 : 148), dash: { length: 8, space: 8 }, lineColor: "#94A3B8", lineWidth: 0.4 },
      ],
      absolutePosition: { x: 0, y: 0 },
    });
  }

  return {
    pageSize: "A4",
    pageMargins: [0, 0, 0, 0],
    content,
    info: { title: `${input.examName} Cevap Anahtarı` },
  };
}


type CurriculumTreeOutcome = {
  name: string;
  questionCount: number;
};

type CurriculumTreeTopic = {
  name: string;
  directQuestionCount: number;
  outcomes: CurriculumTreeOutcome[];
};

type CurriculumTreeUnit = {
  name: string;
  directQuestionCount: number;
  topics: CurriculumTreeTopic[];
};

const buildCurriculumSummaryTree = (items: BookletCurriculumSummaryItem[]): CurriculumTreeUnit[] => {
  const units = new Map<string, {
    name: string;
    directQuestionCount: number;
    topics: Map<string, {
      name: string;
      directQuestionCount: number;
      outcomes: Map<string, CurriculumTreeOutcome>;
    }>;
  }>();

  (items || []).forEach((item) => {
    const unitName = String(item?.unitName || "").trim();
    const topicName = String(item?.topicName || "").trim();
    const outcomeName = String(item?.outcomeName || "").trim();
    const questionCount = Math.max(0, Number(item?.questionCount || 0));
    if (!unitName && !topicName && !outcomeName) return;

    const unitKey = (unitName || "MÜFREDAT").toLocaleLowerCase("tr-TR");
    if (!units.has(unitKey)) {
      units.set(unitKey, {
        name: unitName || "MÜFREDAT",
        directQuestionCount: 0,
        topics: new Map(),
      });
    }
    const unit = units.get(unitKey)!;

    if (!topicName) {
      unit.directQuestionCount += questionCount;
      return;
    }

    const topicKey = topicName.toLocaleLowerCase("tr-TR");
    if (!unit.topics.has(topicKey)) {
      unit.topics.set(topicKey, {
        name: topicName,
        directQuestionCount: 0,
        outcomes: new Map(),
      });
    }
    const topic = unit.topics.get(topicKey)!;

    if (!outcomeName) {
      topic.directQuestionCount += questionCount;
      return;
    }

    const outcomeKey = outcomeName.toLocaleLowerCase("tr-TR");
    const existingOutcome = topic.outcomes.get(outcomeKey);
    topic.outcomes.set(outcomeKey, {
      name: outcomeName,
      questionCount: Number(existingOutcome?.questionCount || 0) + questionCount,
    });
  });

  return Array.from(units.values()).map((unit) => ({
    name: unit.name,
    directQuestionCount: unit.directQuestionCount,
    topics: Array.from(unit.topics.values()).map((topic) => ({
      name: topic.name,
      directQuestionCount: topic.directQuestionCount,
      outcomes: Array.from(topic.outcomes.values()),
    })),
  }));
};

const toCurriculumTitleCase = (value: string, type: "unit" | "topic" | "outcome") => {
  let raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  // Müfredat düzeyini ayrıca yazdığımız için adın sonuna daha önce eklenen
  // "Ünitesi / Konusu / Kazanımı" ifadelerini başlıkta tekrar göstermiyoruz.
  if (type === "unit") raw = raw.replace(/\s+(?:ÜNİTESİ|Ünite(?:si)?|ünite(?:si)?)$/u, "");
  if (type === "topic") raw = raw.replace(/\s+(?:KONUSU|Konu(?:su)?|konu(?:su)?)$/u, "");
  if (type === "outcome") raw = raw.replace(/\s+(?:KAZANIMI|Kazanım(?:ı)?|kazanım(?:ı)?)$/u, "");

  const lowerWords = new Set(["ve", "ile", "veya", "ya", "da", "de", "için"]);
  return raw
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1);
    })
    .join(" ");
};

// Müfredat bilgi alanı Ünite Denemesi adının yatay merkeziyle aynı eksene sabitlenir.
// Son düzenlemeye göre satır genişliği önceki halinden 20 mm artırılmıştır;
// merkez değişmediği için üst başlık ve alt bilgi bloğu aynı eksende kalır.
const UNIT_SCAN_TEST_NAME_CENTER_MM = UNIT_SCAN_SHARED_TEXT_CENTER_MM;
const UNIT_SCAN_SUMMARY_PREVIOUS_WIDTH_MM = (UNIT_SCAN_HEADER_X_MM + UNIT_SCAN_HEADER_WIDTH_MM - 18.2) - (UNIT_SCAN_HEADER_X_MM + 45.3);
const UNIT_SCAN_SUMMARY_AREA_WIDTH_MM = UNIT_SCAN_SUMMARY_PREVIOUS_WIDTH_MM - 10;
const UNIT_SCAN_SUMMARY_AREA_LEFT_MM = UNIT_SCAN_SHARED_TEXT_CENTER_MM - UNIT_SCAN_SUMMARY_AREA_WIDTH_MM / 2;

const fitSingleLineFont = (
  text: string,
  availableWidthMm: number,
  baseFontSize: number,
  minFontSize = 3.15,
) => {
  // pdfmake'de tek satırı önceden ölçen bir API olmadığı için güvenli bir karakter/genişlik
  // tahmini kullanıyoruz. Uzun kazanımlar ikinci sütunun dışına taşmadan küçülür.
  const estimatedWidthMmAtBase = Math.max(1, String(text || '').length) * baseFontSize * 0.115;
  if (estimatedWidthMmAtBase <= availableWidthMm) return baseFontSize;
  return Math.max(minFontSize, baseFontSize * (availableWidthMm / estimatedWidthMmAtBase));
};

const estimateWrappedLineCount = (text: string, widthMm: number, fontSize: number) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;

  // 12 pt kazanım metinlerinde güvenli bir yaklaşık satır hesabı.
  const charWidthMm = Math.max(0.72, fontSize * 0.17);
  let lines = 1;
  let currentWidth = 0;

  words.forEach((word) => {
    const wordWidth = word.length * charWidthMm;
    const separatorWidth = currentWidth > 0 ? charWidthMm : 0;
    if (currentWidth > 0 && currentWidth + separatorWidth + wordWidth > widthMm) {
      lines += 1;
      currentWidth = wordWidth;
    } else {
      currentWidth += separatorWidth + wordWidth;
    }
  });

  return Math.max(1, lines);
};

const buildCurriculumSummaryElements = (page: BookletLayoutPage): any[] => {
  const tree = buildCurriculumSummaryTree(page.curriculumSummary || []);
  if (!tree.length) return [];

  const areaLeft = UNIT_SCAN_SUMMARY_AREA_LEFT_MM;
  const areaWidth = UNIT_SCAN_SUMMARY_AREA_WIDTH_MM;
  const areaHeight = 35;
  // Ünite/Konu/Kazanım bloğu üst başlıkla aynı yatay merkezde sabitlenir;
  // kullanıcı isteğine göre başlangıç 2 mm aşağı alınır.
  const areaTop = UNIT_SCAN_SUMMARY_TOP_MM + Math.max(0, (UNIT_SCAN_SUMMARY_HEIGHT_MM - areaHeight) / 2) + 2;

  const HEADER_FONT_SIZE = 8.2;
  const DETAIL_FONT_SIZE = 8.2;
  const HEADER_LINE_MM = 3.7;
  const DETAIL_LINE_MM = 3.7;
  const BLOCK_GAP_MM = 0.8;

  type RenderBlock = {
    headerRich: any[];
    headerPlain: string;
    detailRich?: any[];
    detailPlain?: string;
    headerLines: number;
    detailLines: number;
    startsNewUnit: boolean;
  };

  const blocks: RenderBlock[] = [];

  tree.forEach((unit) => {
    const unitName = toCurriculumTitleCase(unit.name, 'unit').toLocaleUpperCase('tr-TR');

    if (!unit.topics.length) {
      const unitCountText = unit.directQuestionCount > 0
        ? ` (${Math.max(0, Number(unit.directQuestionCount || 0))} soru)`
        : '';
      const headerPlain = `${unitName}${unitCountText}`;
      blocks.push({
        headerRich: [
          { text: unitName, color: '#DC2626', bold: true },
          unitCountText ? { text: unitCountText, color: '#DC2626', bold: true } : null,
        ].filter(Boolean),
        headerPlain,
        headerLines: estimateWrappedLineCount(headerPlain, areaWidth, HEADER_FONT_SIZE),
        detailLines: 0,
        startsNewUnit: true,
      });
      return;
    }

    unit.topics.forEach((topic, topicIndex) => {
      const topicName = toCurriculumTitleCase(topic.name, 'topic');
      const topicCountText = topic.directQuestionCount > 0
        ? ` (${Math.max(0, Number(topic.directQuestionCount || 0))} soru)`
        : '';
      const headerPlain = `${unitName} / ${topicName}${topicCountText}`;

      const detailRich: any[] = [];
      const detailPlainParts: string[] = [];
      topic.outcomes.forEach((outcome, outcomeIndex) => {
        const outcomeName = toCurriculumTitleCase(outcome.name, 'outcome');
        const outcomeText = `${outcomeName} (${Math.max(0, Number(outcome.questionCount || 0))} soru)`;
        if (outcomeIndex > 0) {
          detailRich.push({ text: ' - ', color: '#DC2626', bold: true });
        }
        detailRich.push({ text: outcomeText, color: '#111827', bold: false });
        detailPlainParts.push(outcomeText);
      });

      const detailPlain = detailPlainParts.join(' - ');
      blocks.push({
        // Ünite / Konu aynı satırın tek ortalanmış metin bloğudur.
        // Ünite kırmızı-büyük harf, konu koyu siyah gösterilir.
        headerRich: [
          { text: unitName, color: '#DC2626', bold: true },
          { text: ' / ', color: '#111827', bold: true },
          { text: `${topicName}${topicCountText}`, color: '#000000', bold: true },
        ],
        headerPlain,
        detailRich: detailRich.length ? detailRich : undefined,
        detailPlain: detailPlain || undefined,
        headerLines: estimateWrappedLineCount(headerPlain, areaWidth, HEADER_FONT_SIZE),
        detailLines: detailPlain ? estimateWrappedLineCount(detailPlain, areaWidth - 2, DETAIL_FONT_SIZE) : 0,
        startsNewUnit: topicIndex === 0,
      });
    });
  });

  if (!blocks.length) return [];

  const estimatedHeight = blocks.reduce((sum, block, index) => {
    const newUnitExtraGap = index > 0 && block.startsNewUnit ? 1 : 0;
    return sum
      + newUnitExtraGap
      + block.headerLines * HEADER_LINE_MM
      + block.detailLines * DETAIL_LINE_MM
      + BLOCK_GAP_MM;
  }, 0);

  // Sarı bandın yatay genişliği kesin sınırdır; metinler bu alan içinde kelime bazında sarılır.
  // Tüm blok da 35 mm'lik kullanılabilir yükseklik içinde dikey ortalanır.
  let y = areaTop + Math.max(0, (areaHeight - estimatedHeight) / 2);
  const elements: any[] = [];

  blocks.forEach((block, index) => {
    // Yeni bir ünite başladığında önceki bloktan 1 mm daha fazla düşey boşluk bırak.
    if (index > 0 && block.startsNewUnit) y += 1;

    elements.push(positionConstrainedText(block.headerRich, areaLeft, y, areaWidth, {
      alignment: 'center',
      fontSize: HEADER_FONT_SIZE,
      lineHeight: 1,
    }));
    y += block.headerLines * HEADER_LINE_MM;

    if (block.detailRich?.length) {
      elements.push(positionConstrainedText(block.detailRich, areaLeft + 1, y, areaWidth - 2, {
        alignment: 'center',
        fontSize: DETAIL_FONT_SIZE,
        lineHeight: 1,
      }));
      y += block.detailLines * DETAIL_LINE_MM;
    }

    y += BLOCK_GAP_MM;
  });

  return elements;
};

function buildBookletPageElements(input: BookletPdfInput, page: BookletLayoutPage, pageNumber: number): any[] {
  if (page.blank) return [positionText("", 0, 0)];
  if (page.coverUrl) {
    return [{ image: page.coverUrl, width: mmToPt(A4_WIDTH_MM), height: mmToPt(A4_HEIGHT_MM), absolutePosition: { x: 0, y: 0 } }];
  }

  const items: any[] = [
    {
      canvas: [
        { type: "ellipse", x: mmToPt(A4_WIDTH_MM - 4), y: mmToPt(8), r1: mmToPt(13), r2: mmToPt(13), color: "#EFF6FF", lineColor: "#EFF6FF" },
        { type: "ellipse", x: mmToPt(3), y: mmToPt(A4_HEIGHT_MM - 18), r1: mmToPt(9), r2: mmToPt(9), color: "#F0FDFA", lineColor: "#F0FDFA" },
        { type: "line", x1: mmToPt(DIVIDER_X_MM), y1: mmToPt(page.fullWidthGroupInstruction ? page.startY : (page.headerUrl ? UNIT_SCAN_CONTENT_START_MM : MARGIN_Y_MM)), x2: mmToPt(DIVIDER_X_MM), y2: mmToPt(A4_HEIGHT_MM - MARGIN_Y_MM), lineColor: "#CBD5E1", lineWidth: 0.4 },
      ],
      absolutePosition: { x: 0, y: 0 },
    },
    positionText(`—  ${pageNumber}  —`, A4_WIDTH_MM / 2 - 6, A4_HEIGHT_MM - 11, { fontSize: 8, color: "#64748B" }),
    positionText(`${input.examName.toLocaleUpperCase("tr-TR")} - KİTAPÇIK: ${input.bookletKey.toLocaleUpperCase("tr-TR")}`, MARGIN_X_MM, A4_HEIGHT_MM - 11, { fontSize: 7.5, color: "#64748B" }),
  ];
  if (input.publisherName) {
    items.push(positionText(input.publisherName.toLocaleUpperCase("tr-TR"), A4_WIDTH_MM - MARGIN_X_MM - 45, A4_HEIGHT_MM - 11, {
      fontSize: 7.5, color: "#64748B", width: mmToPt(45), alignment: "right",
    }));
  }

  if (page.isTestStart) {
    if (page.headerUrl) {
      // Ölçme Araçları > Tasarım > Ünite Tarama Başlıkları'nda bu ders için
      // kayıtlı tasarım varsa düz metin başlık yerine doğrudan onu kullan.
      // Alan sabittir: 20 cm × 9 cm. Tasarım bu ölçüde sayfaya yerleşir.
      items.push({
        image: page.headerUrl,
        width: mmToPt(UNIT_SCAN_HEADER_WIDTH_MM),
        height: mmToPt(UNIT_SCAN_HEADER_HEIGHT_MM),
        absolutePosition: { x: mmToPt(UNIT_SCAN_HEADER_X_MM), y: mmToPt(UNIT_SCAN_HEADER_Y_MM) },
      });

      // Ders adının altındaki kırmızı kutunun üzerine kitapçık harfi.
      // Son konum: önceki konumundan 4 mm aşağı; harf büyük ve kalın görünümde korunur.
      const bookletLabel = String(input.bookletKey || "A").toLocaleUpperCase("tr-TR");
      const bookletTextOptions = {
        width: mmToPt(UNIT_SCAN_BOOKLET_WIDTH_MM),
        alignment: "center",
        bold: true,
        fontSize: 30.5,
        color: "#FFFFFF",
      };
      items.push(positionText(bookletLabel, UNIT_SCAN_BOOKLET_X_MM, UNIT_SCAN_BOOKLET_Y_MM, bookletTextOptions));
      // Roboto'nun mevcut bold karşılığı Medium olduğu için harfi görsel olarak daha kalınlaştır.
      items.push(positionText(bookletLabel, UNIT_SCAN_BOOKLET_X_MM + 0.12, UNIT_SCAN_BOOKLET_Y_MM, bookletTextOptions));

      // Kırmızı çizginin altındaki boş alan: sınav/ünite denemesi adı.
      // Alan son düzene göre toplam 5 mm daha sağa taşınır; tüm sonraki deneme adları bu yeni alan içinde ortalanır.
      const examNameLabel = String(input.examName || "").toLocaleUpperCase("tr-TR");
      const examNameTextOptions = {
        width: mmToPt(UNIT_SCAN_TEST_NAME_WIDTH_MM),
        alignment: "center",
        bold: true,
        fontSize: 13.2,
        color: "#DC2626",
      };
      items.push(positionConstrainedText(examNameLabel, UNIT_SCAN_TEST_NAME_X_MM, UNIT_SCAN_TEST_NAME_Y_MM, UNIT_SCAN_TEST_NAME_WIDTH_MM, {
        alignment: examNameTextOptions.alignment,
        bold: examNameTextOptions.bold,
        fontSize: examNameTextOptions.fontSize,
        color: examNameTextOptions.color,
      }));
      // Aynı metni çok küçük ofsetle ikinci kez çizerek daha kalın görünüm ver.
      items.push(positionConstrainedText(examNameLabel, UNIT_SCAN_TEST_NAME_X_MM + 0.12, UNIT_SCAN_TEST_NAME_Y_MM, UNIT_SCAN_TEST_NAME_WIDTH_MM, {
        alignment: examNameTextOptions.alignment,
        bold: examNameTextOptions.bold,
        fontSize: examNameTextOptions.fontSize,
        color: examNameTextOptions.color,
      }));

      // Kesik çizgili bilgi alanı: sınavda gerçekten kullanılan ünite-konu-kazanım dağılımı.
      items.push(...buildCurriculumSummaryElements(page));
    } else {
      // O derse özel kayıt yoksa mevcut sade başlık güvenli yedek olarak kalır.
      items.push({
        canvas: [{ type: "rect", x: mmToPt(MARGIN_X_MM), y: mmToPt(15), w: mmToPt(A4_WIDTH_MM - MARGIN_X_MM * 2), h: mmToPt(12), r: mmToPt(2), color: "#F8FAFC", lineColor: "#4F46E5", lineWidth: 1.4 }],
        absolutePosition: { x: 0, y: 0 },
      });
      items.push(positionText(page.testName.toLocaleUpperCase("tr-TR"), MARGIN_X_MM, 18.4, {
        width: mmToPt(A4_WIDTH_MM - MARGIN_X_MM * 2), alignment: "center", bold: true, fontSize: 10.5, color: "#DC2626",
      }));
    }
  }

  const fullWidthInstruction = page.fullWidthGroupInstruction;
  if (fullWidthInstruction) {
    const groupId = String(fullWidthInstruction.groupId || "");
    const groupQuestions = [...page.columns[0], ...page.columns[1]]
      .filter((question) => !groupId || String(question.questionGroupId || "") === groupId)
      .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
    const rangeStart = Math.max(1, Number(groupQuestions[0]?.number || page.columns[0][0]?.number || page.columns[1][0]?.number || 1));
    const instructionCount = Math.max(1, Number(fullWidthInstruction.questionCount || groupQuestions.length || 1));
    const rangeEnd = rangeStart + instructionCount - 1;
    const rangeText = buildGroupRangeText(rangeStart, rangeEnd);
    const instructionStack: any[] = [{
      text: rangeText,
      bold: true,
      fontSize: 9.2,
      color: "#0F172A",
      margin: [0, 0, 0, mmToPt(1.4)],
    }];
    if (String(fullWidthInstruction.title || "").trim()) {
      instructionStack.push({
        text: String(fullWidthInstruction.title || "").trim(),
        bold: true,
        fontSize: 8.8,
        color: "#1D4ED8",
        margin: [0, 0, 0, mmToPt(1)],
      });
    }
    if (String(fullWidthInstruction.text || "").trim()) {
      instructionStack.push({
        text: String(fullWidthInstruction.text || "").trim(),
        fontSize: 8.2,
        lineHeight: 1.16,
        color: "#334155",
        margin: [0, 0, 0, fullWidthInstruction.imageUrl ? mmToPt(1.5) : 0],
      });
    }
    if (fullWidthInstruction.imageUrl) {
      instructionStack.push({
        image: fullWidthInstruction.imageUrl,
        width: mmToPt(A4_WIDTH_MM - MARGIN_X_MM * 2 - 8),
        height: mmToPt(Math.max(8, Number(fullWidthInstruction.imageHeight || 20))),
        alignment: "center",
      });
    }
    items.push({
      table: {
        widths: [mmToPt(A4_WIDTH_MM - MARGIN_X_MM * 2 - 1.5)],
        body: [[{
          stack: instructionStack,
          fillColor: "#F8FAFC",
          margin: [mmToPt(2.5), mmToPt(1.8), mmToPt(2.5), mmToPt(1.8)],
        }]],
      },
      layout: {
        hLineColor: () => "#CBD5E1",
        vLineColor: () => "#CBD5E1",
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      width: mmToPt(A4_WIDTH_MM - MARGIN_X_MM * 2),
      absolutePosition: {
        x: mmToPt(MARGIN_X_MM),
        y: mmToPt(Math.max(MARGIN_Y_MM, Number(page.fullWidthInstructionY ?? (page.startY - Number(fullWidthInstruction.height || 0) - 3)))),
      },
    });
  }

  // PDF kitapçığında görsel okuma sırası kesin olarak SOL -> SAĞ'dır.
  // Önceki sürümde veri kolonları ile fiziksel kolonlar ters eşleşebildiği için
  // 1. soru sağ sütunda görünüyordu. Render aşamasında fiziksel sütunları
  // soru numarasına göre kuruyoruz; böylece 1. soru her zaman soldadır.
  const orderedQuestions = [...page.columns[0], ...page.columns[1]];
  const leftCount = page.columns[0].length;
  const physicalColumns: [BookletLayoutQuestion[], BookletLayoutQuestion[]] = [
    orderedQuestions.slice(0, leftCount),
    orderedQuestions.slice(leftCount),
  ];

  physicalColumns.forEach((columnItems, columnIndex) => {
    if (!columnItems.length) return;
    let y = page.startY;
    const x = columnIndex === 0 ? MARGIN_X_MM : DIVIDER_X_MM + COLUMN_SPACE_MM / 2;

    columnItems.forEach((question) => {
      const questionImageHeight = Math.max(0.1, Number(question.questionImageHeight ?? question.contentHeight ?? 20));
      const instruction = question.groupInstruction;
      const instructionCount = Math.max(1, Number(instruction?.questionCount || question.questionGroupSize || 1));
      const rangeStart = Math.max(1, Number(question.number || 1));
      const rangeEnd = rangeStart + instructionCount - 1;
      const rangeText = buildGroupRangeText(rangeStart, rangeEnd);

      const questionRow: any = {
        columns: [
          {
            text: `${question.number}.`,
            width: mmToPt(8),
            alignment: "center",
            bold: true,
            fontSize: 10,
            color: "#DC2626",
            margin: [0, mmToPt(0.6), 0, 0],
          },
          question.imageUrl
            ? {
                image: question.imageUrl,
                width: mmToPt(COLUMN_WIDTH_MM - 8),
                height: mmToPt(questionImageHeight),
              }
            : {
                stack: [
                  {
                    canvas: [{
                      type: "rect", x: 0, y: 0,
                      w: mmToPt(COLUMN_WIDTH_MM - 8), h: mmToPt(questionImageHeight),
                      lineColor: "#CBD5E1", lineWidth: 0.55, dash: { length: 5, space: 5 },
                    }],
                  },
                  {
                    text: "(Bu soru numarası için soru yüklenmemiştir)",
                    width: mmToPt(COLUMN_WIDTH_MM - 8),
                    alignment: "center",
                    fontSize: 8,
                    color: "#94A3B8",
                    margin: [0, -mmToPt(questionImageHeight / 2 + 1.5), 0, 0],
                  },
                ],
                width: mmToPt(COLUMN_WIDTH_MM - 8),
              },
        ],
        columnGap: 0,
        width: mmToPt(COLUMN_WIDTH_MM),
      };

      const stack: any[] = [];
      if (instruction && question.questionGroupLayout !== "full-width-source" && instruction.layout !== "full-width-source") {
        const instructionStack: any[] = [
          {
            text: rangeText,
            bold: true,
            fontSize: 8.7,
            color: "#0F172A",
            margin: [0, 0, 0, mmToPt(1.2)],
          },
        ];
        if (String(instruction.title || "").trim()) {
          instructionStack.push({
            text: String(instruction.title || "").trim(),
            bold: true,
            fontSize: 8.2,
            color: "#1D4ED8",
            margin: [0, 0, 0, mmToPt(1)],
          });
        }
        if (String(instruction.text || "").trim()) {
          instructionStack.push({
            text: String(instruction.text || "").trim(),
            fontSize: 7.8,
            lineHeight: 1.16,
            color: "#334155",
            margin: [0, 0, 0, instruction.imageUrl ? mmToPt(1.5) : 0],
          });
        }
        if (instruction.imageUrl) {
          instructionStack.push({
            image: instruction.imageUrl,
            width: mmToPt(COLUMN_WIDTH_MM - 8),
            height: mmToPt(Math.max(8, Number(instruction.imageHeight || 20))),
            alignment: "center",
          });
        }
        stack.push({
          table: {
            widths: [mmToPt(COLUMN_WIDTH_MM - 1.5)],
            body: [[{
              stack: instructionStack,
              fillColor: "#F8FAFC",
              margin: [mmToPt(2), mmToPt(1.7), mmToPt(2), mmToPt(1.7)],
            }]],
          },
          layout: {
            hLineColor: () => "#CBD5E1",
            vLineColor: () => "#CBD5E1",
            hLineWidth: () => 0.7,
            vLineWidth: () => 0.7,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
          margin: [0, 0, 0, mmToPt(2)],
        });
      }
      stack.push(questionRow);

      items.push({
        stack,
        width: mmToPt(COLUMN_WIDTH_MM),
        absolutePosition: { x: mmToPt(x), y: mmToPt(y) },
      });

      y += question.contentHeight + Math.max(0, Number(question.requestedGap ?? 0));
    });
  });

  return items;
}

export function buildQuestionBookletPdfDefinition(input: BookletPdfInput): Record<string, any> {
  const content: any[] = [];
  input.pages.forEach((page, index) => {
    content.push({ text: "", pageBreak: index > 0 ? "before" : undefined, fontSize: 1 });
    content.push(...buildBookletPageElements(input, page, index + 1));
  });
  return {
    pageSize: "A4",
    pageMargins: [0, 0, 0, 0],
    content,
    info: { title: `${input.examName} ${input.bookletKey} Kitapçığı` },
  };
}

export async function downloadAnswerKeyPdf(input: AnswerKeyPdfInput): Promise<void> {
  await PdfEngine.generate(buildAnswerKeyPdfDefinition(input), {
    filename: `${safeFileName(input.examName)}_Cevap_Anahtari.pdf`,
  });
}

export async function downloadQuestionBookletPdf(input: BookletPdfInput): Promise<void> {
  await PdfEngine.generate(buildQuestionBookletPdfDefinition(input), {
    filename: `${safeFileName(input.examName)}_Kitapcik_${input.bookletKey}.pdf`,
  });
}
