export type UploadNameInfo =
  | { kind: "normal"; order: number; answer: string; token: ""; isInstruction: false }
  | { kind: "group-question"; order: number; answer: string; token: string; isInstruction: false }
  | { kind: "instruction"; order: number; answer: string; token: string; isInstruction: true };

const normalizeGroupToken = (number: string) =>
  `G${String(Math.max(1, Number(number) || 1)).padStart(2, "0")}`;

/**
 * Kaynak adları: 001_A, 002_B_G02, 001__G02Y veya 001_A_G02Y.
 * Son biçim, cevap işareti bulunan yönerge görsellerini de kabul eder.
 * Eski yüklemeler için S_001_A ve G01_S01_A adları okunabilir kalır.
 */
export const parseUploadFileName = (fileName: string): UploadNameInfo | null => {
  const stem = String(fileName || "").replace(/\.(png|jpe?g)$/i, "").trim();
  let match = stem.match(/^(\d{1,6})_([A-E]?)_(G)(\d{1,3})Y$/i);
  if (match) return { kind: "instruction", order: Number(match[1]), answer: match[2].toUpperCase(), token: normalizeGroupToken(match[4]), isInstruction: true };
  match = stem.match(/^(\d{1,6})_([A-E])_G(\d{1,3})$/i);
  if (match && Number(match[1]) > 0) return { kind: "group-question", order: Number(match[1]), answer: match[2].toUpperCase(), token: normalizeGroupToken(match[3]), isInstruction: false };
  match = stem.match(/^(\d{1,6})_([A-E])$/i);
  if (match && Number(match[1]) > 0) return { kind: "normal", order: Number(match[1]), answer: match[2].toUpperCase(), token: "", isInstruction: false };
  // Eski biçimlerle geri dönük uyumluluk.
  match = stem.match(/^G(\d{1,3})_(?:S0_)?Y$/i);
  if (match) return { kind: "instruction", token: normalizeGroupToken(match[1]), order: 0, answer: "", isInstruction: true };
  match = stem.match(/^G(\d{1,3})_S(\d{1,4})_([A-E])$/i);
  if (match && Number(match[2]) > 0) return { kind: "group-question", token: normalizeGroupToken(match[1]), order: Number(match[2]), answer: match[3].toUpperCase(), isInstruction: false };
  match = stem.match(/^S_?(\d{1,6})_([A-E])$/i);
  return match && Number(match[1]) > 0 ? { kind: "normal", token: "", order: Number(match[1]), answer: match[2].toUpperCase(), isInstruction: false } : null;
};

export const groupInstructionCode = (curriculumCode: string, token: string, order = 1, answer = "") =>
  `${curriculumCode}_${String(order).padStart(3, "0")}_${answer}_${token}Y`;

/** Grup aidiyeti: kaynak dosya ismi veya müfredat kodu eklenmiş kayıt adı. */
export const parseQuestionGroupFileName = (value: unknown): {
  token: string; order: number; isInstruction: boolean;
} | null => {
  let source = String(value || "").trim().split(/[?#]/, 1)[0].replace(/\\/g, "/");
  try { source = decodeURIComponent(source); } catch { /* kodlanmamış ad */ }
  const basename = source.split("/").filter(Boolean).pop() || source;
  const stem = basename.replace(/\.(png|jpe?g)$/i, "");
  const modern = stem.match(/(?:^|_)(\d{1,6})_([A-E]?)_G(\d{1,3})(Y)?$/i);
  if (modern) return {
    token: normalizeGroupToken(modern[3]),
    order: Number(modern[1]),
    isInstruction: Boolean(modern[4]),
  };
  const legacy = stem.match(/(?:^|__)(G\d{1,3}_(?:S\d{1,4}_[A-EY]|Y))$/i);
  const info = legacy ? parseUploadFileName(legacy[1]) : parseUploadFileName(stem);
  return info && info.kind !== "normal" ? { token: info.token, order: info.order, isInstruction: info.isInstruction } : null;
};
