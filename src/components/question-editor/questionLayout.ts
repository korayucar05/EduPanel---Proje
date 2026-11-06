import type { AnswerLayout, QuestionRootRange, SpecialBlock } from "./questionTypes";

export const DEFAULT_QUESTION_FONT = "MergeOne";
export const QUESTION_CSS_WIDTH_PX = (8 / 2.54) * 96;
export const EDITOR_VISUAL_SCALE = 1.55;
export const IMAGE_GAP_PX = (1 / 25.4) * 96;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TURKISH_VOWELS = "aeıioöuüAEIİOÖUÜ";
const TURKISH_LETTER_RE = /^[A-Za-zÇĞİÖŞÜçğıöşü]+$/;
const isTurkishVowel = (char: string): boolean => TURKISH_VOWELS.includes(char);

const turkishSyllableBreakPoints = (word: string): number[] => {
  if (word.length < 5) return [];
  if (!TURKISH_LETTER_RE.test(word)) return [];
  if (/^[A-ZÇĞİÖŞÜ]{2,}$/.test(word)) return []; // kısaltma / kod

  const vowelIndexes: number[] = [];
  for (let index = 0; index < word.length; index += 1) {
    if (isTurkishVowel(word[index])) vowelIndexes.push(index);
  }
  if (vowelIndexes.length < 2) return [];

  const points: number[] = [];
  for (let index = 0; index < vowelIndexes.length - 1; index += 1) {
    const currentVowel = vowelIndexes[index];
    const nextVowel = vowelIndexes[index + 1];

    // Türkçede iki ünlü arasında sessiz yoksa iki ünlü ayrı hece kabul edilir.
    // Sessiz(ler) varsa son sessiz sonraki heceye bırakılır:
    // ki-tap, öğ-ret-men, kont-rol benzeri düzen.
    const point = nextVowel === currentVowel + 1
      ? currentVowel + 1
      : nextVowel - 1;

    // Tarayıcı yalnız gerekirse bu hece sınırında tire gösterir.
    // En az iki karakter iki tarafta kalsın; böylece uzun kelime bütünüyle alt satıra atılmaz.
    if (point >= 2 && word.length - point >= 2) points.push(point);
  }

  return [...new Set(points)].sort((a, b) => a - b);
};

const turkishHyphenateWord = (word: string): string => {
  const points = turkishSyllableBreakPoints(word);
  if (!points.length) return word;

  let result = "";
  let previous = 0;
  for (const point of points) {
    result += word.slice(previous, point) + "\u00AD";
    previous = point;
  }
  result += word.slice(previous);
  return result;
};

const shouldSkipHyphenationToken = (token: string): boolean => {
  if (!token) return true;
  if (/https?:\/\//i.test(token) || /www\./i.test(token)) return true;
  if (/\d/.test(token)) return true;
  if (/[=+×÷<>^_{}\[\]\\/]/.test(token)) return true;
  if (/^[A-E][\)\].:-]?$/i.test(token)) return true;
  if (/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.?$/i.test(token)) return true;
  return false;
};

const hyphenateTurkishToken = (token: string): string => {
  if (shouldSkipHyphenationToken(token)) return token;

  // Noktalama işaretlerini kelimenin dışında tut; yalnız harflerden oluşan çekirdeği hecele.
  const match = token.match(/^([^A-Za-zÇĞİÖŞÜçğıöşü]*)([A-Za-zÇĞİÖŞÜçğıöşü]+)([^A-Za-zÇĞİÖŞÜçğıöşü]*)$/);
  if (!match) return token;
  const [, prefix, word, suffix] = match;
  return `${prefix}${turkishHyphenateWord(word)}${suffix}`;
};

export const hyphenateTurkishText = (value: string): string =>
  value.split(/(\s+)/).map((part) =>
    /^\s+$/.test(part) ? part : hyphenateTurkishToken(part)
  ).join("");


const normalizeRomanOcrToken = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[İıi1lL(]/g, "I")
    .replace(/[vV]/g, "V")
    .replace(/[xX]/g, "X");

  // Yalnızca geçerli Roma işaretleri kalsın.
  return /^[IVX]+$/.test(cleaned) ? cleaned : value.trim();
};

const normalizeRomanOcrInText = (value: string): string =>
  value
    // I., II., III. gibi madde başlarını düzelt.
    .replace(
      /(^|\n|\s)([Iİıi1lL(]{1,4}|[Iİıi1lL(]*[VvXx][Iİıi1lL(]*)\s*\./g,
      (_match, prefix: string, token: string) =>
        `${prefix}${normalizeRomanOcrToken(token)}.`
    )
    // "Yalnız I", "Yalnız II" vb. kalıplarda OCR'nin İ/1/ı/l okumasını düzelt.
    .replace(
      /\b(Yalnız)\s+([Iİıi1lL(]{1,4}|[Iİıi1lL(]*[VvXx][Iİıi1lL(]*)\b/gi,
      (_match, word: string, token: string) =>
        `${word} ${normalizeRomanOcrToken(token)}`
    );


const normalizeRomanLikeOptionText = (value: string): string => {
  const normalizeToken = (token: string) => {
    const cleaned = token
      .replace(/[İıi1lL(]/g, "I")
      .replace(/[vV]/g, "V")
      .replace(/[xX]/g, "X")
      .toUpperCase();
    return /^[IVX]+$/.test(cleaned) ? cleaned : token;
  };

  return String(value || "")
    // "Yalnız 1", "Yalnız İİ", "Yalnız (" gibi bağlamlar.
    .replace(
      /\b(Yalnız)\s+([Iİıi1lL(]{1,4}|[Iİıi1lL(]*[VvXx][Iİıi1lL(]*)/gi,
      (_m, word: string, token: string) => `${word} ${normalizeToken(token)}`
    )
    // "1, II ve III", "(, II ve III" gibi seçenek içi bağımsız Roman öğeler.
    .replace(
      /(^|[\s,;\/])([Iİıi1lL(]{1,4}|[Iİıi1lL(]*[VvXx][Iİıi1lL(]*)(?=$|[\s,;.)])/g,
      (_m, prefix: string, token: string) => `${prefix}${normalizeToken(token)}`
    );
};

const parseQuestionOptions = (value: string): {
  stem: string;
  options: Array<{ letter: string; text: string }>;
} => {
  const normalized = normalizeRomanOcrInText(value).replace(/\r/g, "").trim();
  const optionRegex = /(?:^|\n|\s)([A-E])\s*[\)\].:-]\s*/g;
  const matches = [...normalized.matchAll(optionRegex)];
  if (!matches.length) return { stem: normalized, options: [] };

  const firstIndex = matches[0].index ?? normalized.length;
  const stem = normalized.slice(0, firstIndex).trim();
  const options = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length
      ? (matches[index + 1].index ?? normalized.length)
      : normalized.length;
    return { letter: match[1].toUpperCase(), text: normalizeRomanLikeOptionText(normalized.slice(start, end).trim()) };
  });
  return { stem, options };
};

const optionRowsForLayout = (
  options: Array<{ letter: string; text: string }>,
  layout: AnswerLayout,
): Array<Array<{ letter: string; text: string }>> => {
  const byLetter = new Map(options.map((item) => [item.letter, item]));
  const ordered = "ABCDE".split("").map((letter) =>
    byLetter.get(letter) || { letter, text: "" }
  );
  if (layout === "1") return ordered.map((item) => [item]);
  if (layout === "2-2-1") return [
    [ordered[0], ordered[1]],
    [ordered[2], ordered[3]],
    [{ letter: "", text: "" }, ordered[4]],
  ];
  if (layout === "3-2") return [
    [ordered[0], ordered[1], ordered[2]],
    [ordered[3], ordered[4], { letter: "", text: "" }],
  ];
  return [ordered];
};

const ROMAN_ITEM_RE = /^\s*((?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.)\s*(.*)$/i;

const renderPlainText = (value: string): string =>
  escapeHtml(hyphenateTurkishText(value)).replace(/\n/g, "<br/>");

const renderQuestionRootText = (
  value: string,
  absoluteStart: number,
  rootRanges: QuestionRootRange[],
): string => {
  if (!value) return "";
  const segmentEnd = absoluteStart + value.length;
  const overlaps = rootRanges
    .map((range) => ({
      start: Math.max(absoluteStart, range.start),
      end: Math.min(segmentEnd, range.end),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (!overlaps.length) return renderPlainText(value);

  const parts: string[] = [];
  let cursor = absoluteStart;
  for (const range of overlaps) {
    if (range.start > cursor) {
      parts.push(renderPlainText(value.slice(cursor - absoluteStart, range.start - absoluteStart)));
    }
    parts.push(
      `<span aria-hidden="true" style="display:block;height:1mm;line-height:0;margin:0;padding:0;"></span>` +
      `<span data-question-root="true" style="font-family:'${DEFAULT_QUESTION_FONT}',sans-serif;` +
      `font-weight:400;-webkit-text-stroke:0.5px currentColor;text-shadow:0 0 0 currentColor;` +
      `display:inline;margin:0;padding:0;line-height:inherit;vertical-align:baseline;">${
        renderPlainText(value.slice(range.start - absoluteStart, range.end - absoluteStart))
      }</span>` +
      `<span aria-hidden="true" style="display:block;height:1mm;line-height:0;margin:0;padding:0;"></span>`
    );
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < segmentEnd) {
    parts.push(renderPlainText(value.slice(cursor - absoluteStart)));
  }
  return parts.join("");
};

const renderSpecialBlock = (block: SpecialBlock): string => {
  const rows = block.items.map((item) =>
    `<div data-special-item="true" style="display:grid;grid-template-columns:4mm minmax(0,1fr);` +
    `column-gap:0;width:100%;margin:0;padding:0;` +
    `font-family:'${DEFAULT_QUESTION_FONT}',sans-serif;font-size:11pt;line-height:1.28;">` +
      `<span style="margin:0;padding:0;white-space:nowrap;text-align:left;">${escapeHtml(item.marker)}</span>` +
      `<span style="min-width:0;margin:0;padding:0;text-align:left;word-break:normal;overflow-wrap:normal;hyphens:manual;">${escapeHtml(hyphenateTurkishText(item.text))}</span>` +
    `</div>`
  ).join("");

  return `<div data-special-block="${escapeHtml(block.id)}" ` +
    `style="display:block;width:calc(100% - 3mm);margin:0 0 0 3mm;padding:0;line-height:1.28;">${rows}</div>`;
};

const resolveSpecialBlocks = (stem: string, blocks: SpecialBlock[]): SpecialBlock[] => {
  const resolved: SpecialBlock[] = [];
  const used = new Set<string>();

  for (const block of blocks) {
    if (!block.sourceText || !block.items.length) continue;
    const candidates: number[] = [];
    for (let pos = stem.indexOf(block.sourceText); pos >= 0; pos = stem.indexOf(block.sourceText, pos + 1)) {
      candidates.push(pos);
    }
    if (!candidates.length) continue;
    const start = candidates.sort((a, b) => Math.abs(a - block.start) - Math.abs(b - block.start))[0];
    const key = `${start}:${block.sourceText}`;
    if (used.has(key)) continue;
    used.add(key);
    resolved.push({ ...block, start, end: start + block.sourceText.length });
  }

  return resolved.sort((a, b) => a.start - b.start);
};

const formatStemWithBlocks = (
  stem: string,
  rootRanges: QuestionRootRange[],
  specialBlocks: SpecialBlock[],
): string => {
  const blocks = resolveSpecialBlocks(stem, specialBlocks)
    .filter((block, index, all) => index === 0 || block.start >= all[index - 1].end);

  if (!blocks.length) return renderQuestionRootText(stem, 0, rootRanges);

  const parts: string[] = [];
  let cursor = 0;
  for (const block of blocks) {
    if (block.start > cursor) {
      parts.push(renderQuestionRootText(stem.slice(cursor, block.start), cursor, rootRanges));
    }
    parts.push(renderSpecialBlock(block));
    cursor = block.end;
  }
  if (cursor < stem.length) {
    parts.push(renderQuestionRootText(stem.slice(cursor), cursor, rootRanges));
  }
  return parts.join("");
};

export const formatQuestionHtml = (
  value: string,
  answerLayout: AnswerLayout,
  rootRanges: QuestionRootRange[],
  specialStart: number,
  specialEnd: number,
  specialBlocks: SpecialBlock[] = [],
): string => {
  const parsed = parseQuestionOptions(value);
  // specialStart/specialEnd yalnız eski kayıt uyumluluğu için parametrede tutuluyor.
  void specialStart;
  void specialEnd;
  const stemHtml = formatStemWithBlocks(parsed.stem, rootRanges, specialBlocks);

  const rows = optionRowsForLayout(parsed.options, answerLayout);
  const optionHtml = parsed.options.length
    ? `<div data-part="answers" style="margin-top:2mm;">${
        rows.map((row) =>
          `<div style="display:grid;grid-template-columns:repeat(${row.length},minmax(0,1fr));column-gap:2mm;margin:0 0 0.5mm 0;">${
            row.map((option) =>
              `<div style="min-width:0;text-align:left;white-space:normal;word-break:normal;overflow-wrap:normal;hyphens:manual;">${
                option.letter
                  ? `<span style="font-weight:400;">${option.letter})</span> ${escapeHtml(hyphenateTurkishText(option.text))}`
                  : ""
              }</div>`
            ).join("")
          }</div>`
        ).join("")
      }</div>`
    : "";

  return `<div data-part="stem" style="margin:0;white-space:pre-wrap;">${stemHtml}</div>${optionHtml}`;
};






export const ROOT_HIGHLIGHT_NAME = "question-root-highlight";
export const SPECIAL_HIGHLIGHT_NAME = "question-special-highlight";

const normalizeVisibleText = (value: string): string =>
  value.replace(/\u00AD/g, "");

const collectTextNodes = (container: HTMLElement): Text[] => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
};

const findExactDomRangeForText = (
  container: HTMLElement,
  selectedText: string,
  preferredStart: number,
): Range | null => {
  const nodes = collectTextNodes(container);
  const combined = nodes.map((node) => normalizeVisibleText(node.data)).join("");
  const needle = normalizeVisibleText(selectedText);

  if (!needle) return null;

  const matches: number[] = [];
  for (
    let index = combined.indexOf(needle);
    index >= 0;
    index = combined.indexOf(needle, index + 1)
  ) {
    matches.push(index);
  }
  if (!matches.length) return null;

  const bestStart = matches.sort(
    (a, b) => Math.abs(a - preferredStart) - Math.abs(b - preferredStart)
  )[0];
  const bestEnd = bestStart + needle.length;

  let absolute = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;

  for (const node of nodes) {
    const raw = node.data;
    const visible = normalizeVisibleText(raw);

    if (!startNode && bestStart <= absolute + visible.length) {
      let visibleCount = 0;
      for (let index = 0; index <= raw.length; index += 1) {
        if (absolute + visibleCount >= bestStart) {
          startNode = node;
          startOffset = index;
          break;
        }
        if (index < raw.length && raw[index] !== "\u00AD") visibleCount += 1;
      }
    }

    if (!endNode && bestEnd <= absolute + visible.length) {
      let visibleCount = 0;
      for (let index = 0; index <= raw.length; index += 1) {
        if (absolute + visibleCount >= bestEnd) {
          endNode = node;
          endOffset = index;
          break;
        }
        if (index < raw.length && raw[index] !== "\u00AD") visibleCount += 1;
      }
    }

    absolute += visible.length;
    if (startNode && endNode) break;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.data.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.data.length));
    return range;
  } catch {
    return null;
  }
};

export const installRootHighlight = (
  container: HTMLElement,
  ranges: QuestionRootRange[],
) => {
  const css = CSS as any;
  const HighlightCtor = (window as any).Highlight;
  if (!css.highlights || !HighlightCtor) return;

  const domRanges = ranges
    .map((range) => {
      if (range.text) {
        return findExactDomRangeForText(container, range.text, range.start);
      }
      return null;
    })
    .filter((range): range is Range => Boolean(range));

  if (!domRanges.length) {
    css.highlights.delete(ROOT_HIGHLIGHT_NAME);
    return;
  }

  css.highlights.set(ROOT_HIGHLIGHT_NAME, new HighlightCtor(...domRanges));
};


export const installSpecialHighlight = (
  container: HTMLElement,
  blocks: SpecialBlock[],
) => {
  const css = CSS as any;
  const HighlightCtor = (window as any).Highlight;
  if (!css.highlights || !HighlightCtor) return;

  const domRanges = blocks
    .map((block) => findExactDomRangeForText(container, block.sourceText, block.start))
    .filter((range): range is Range => Boolean(range));

  if (!domRanges.length) {
    css.highlights.delete(SPECIAL_HIGHLIGHT_NAME);
    return;
  }
  css.highlights.set(SPECIAL_HIGHLIGHT_NAME, new HighlightCtor(...domRanges));
};


export const getSelectionRangeInValue = (
  container: HTMLElement,
  value: string,
): { start: number; end: number } | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const selectedText = selection.toString().replace(/\u00AD/g, "");
  if (!selectedText.trim()) return null;

  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const approximateOffset = pre.toString().replace(/\u00AD/g, "").length;

  const exactMatches: number[] = [];
  for (let index = value.indexOf(selectedText); index >= 0; index = value.indexOf(selectedText, index + 1)) {
    exactMatches.push(index);
  }
  if (exactMatches.length) {
    const start = exactMatches.sort(
      (a, b) => Math.abs(a - approximateOffset) - Math.abs(b - approximateOffset)
    )[0];
    return { start, end: start + selectedText.length };
  }

  // Tarayıcı DOM'u boşlukları değiştirmişse normalize edilmiş metin üzerinden eşleştir.
  const buildNormalized = (source: string): { normalized: string; map: number[] } => {
    let normalized = "";
    const map: number[] = [];
    let inWhitespace = false;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index] === "\u00AD" ? "" : source[index];
      if (!char) continue;
      if (/\s/.test(char)) {
        if (!inWhitespace) {
          map.push(index);
          normalized += " ";
          inWhitespace = true;
        }
      } else {
        map.push(index);
        normalized += char;
        inWhitespace = false;
      }
    }
    return { normalized, map };
  };

  const raw = buildNormalized(value);
  const selected = buildNormalized(selectedText).normalized.trim();
  const normalizedStart = raw.normalized.indexOf(selected);
  if (normalizedStart < 0) return null;

  const start = raw.map[normalizedStart] ?? 0;
  const normalizedEndIndex = normalizedStart + selected.length - 1;
  const end = Math.min(value.length, (raw.map[normalizedEndIndex] ?? start) + 1);
  return { start, end };
};


const getCaretOffsetFromPoint = (
  container: HTMLElement,
  clientX: number,
  clientY: number,
): number | null => {
  let range: Range | null = null;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (doc.caretPositionFromPoint) {
    const caret = doc.caretPositionFromPoint(clientX, clientY);
    if (caret) {
      range = document.createRange();
      range.setStart(caret.offsetNode, caret.offset);
      range.collapse(true);
    }
  } else if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(clientX, clientY);
  }

  if (!range || !container.contains(range.startContainer)) return null;

  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().replace(/\u00AD/g, "").length;
};

const splitTextAtOffset = (
  value: string,
  offset: number,
): { before: string; after: string } => {
  const safe = clamp(offset, 0, value.length);
  return { before: value.slice(0, safe), after: value.slice(safe) };
};

