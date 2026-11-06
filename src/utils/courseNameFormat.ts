export function formatCourseName(value: unknown): string {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";

  return text
    .split(" ")
    .map((word, index) => {
      const cleaned = word.trim();
      if (!cleaned) return "";

      const lower = cleaned.toLocaleLowerCase("tr-TR");

      // "ve" bağlacı her durumda küçük yazılır.
      if (lower === "ve") return "ve";

      // Noktalı/kısaltmalı başlangıçları koruyarak her kelimeyi başlık biçimine getir.
      // Örn: "TÜRK DİLİ VE EDEBİYATI" -> "Türk Dili ve Edebiyatı"
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}
