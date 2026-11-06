/**
 * Uygulama genelinde sınıf/şube adlarının kullanıcıya tek biçimde görünmesini sağlar.
 * Yalnız gerçek sınıf-şube kalıbını dönüştürür; "9. Sınıf" gibi seviye etiketlerine dokunmaz.
 */
export const normalizeClassroomDisplayName = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const upper = raw.toLocaleUpperCase("tr-TR");
  const match = upper.match(/^(\d{1,2})\s*(?:[-–—_/]|\s)\s*([A-ZÇĞİÖŞÜ]{1,3})$/u)
    || upper.match(/^(\d{1,2})([A-ZÇĞİÖŞÜ]{1,3})$/u);

  if (!match) return raw;
  return `${Number(match[1])}-${match[2]}`;
};

/** Karşılaştırma/eşleştirme için sınıf adını ayraçlardan bağımsız anahtara çevirir. */
export const classroomNameKey = (value: unknown): string =>
  normalizeClassroomDisplayName(value)
    .toLocaleUpperCase("tr-TR")
    .replace(/[\s\-–—_/]+/g, "");
