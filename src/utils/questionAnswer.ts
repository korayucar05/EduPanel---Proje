const VALID_ANSWERS = new Set(["A", "B", "C", "D", "E"]);

export const getAnswerFromQuestionFileName = (fileName: unknown): string => {
  const rawName = String(fileName || "").split(/[\\/]/).pop()?.trim() || "";
  if (!rawName) return "";
  const dotIndex = rawName.lastIndexOf(".");
  const nameWithoutExtension = (dotIndex > 0 ? rawName.slice(0, dotIndex) : rawName).trim();
  const lastCharacter = nameWithoutExtension.slice(-1).toUpperCase();
  return VALID_ANSWERS.has(lastCharacter) ? lastCharacter : "";
};

export const getQuestionCorrectAnswer = (question: any, _preferFileName = false): string => {
  const savedAnswer = String(question?.correctAnswer || "")
    .trim()
    .toLocaleUpperCase("tr-TR");

  // Sınav Hazırla ekranında kaydedilen cevap tek ve kesin kaynaktır.
  // Görsel dosyasının son harfi, manuel olarak seçilmiş cevabı asla geçersiz kılamaz.
  if (VALID_ANSWERS.has(savedAnswer)) return savedAnswer;

  // Dosya adı yalnızca doğru cevap alanı gerçekten boşsa eski kayıtlar için yedektir.
  return getAnswerFromQuestionFileName(question?.fileName);
};
