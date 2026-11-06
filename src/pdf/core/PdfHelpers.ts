export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Görsel yüklenemedi: ${response.status}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Görsel okunamadı."));
    reader.readAsDataURL(blob);
  });
}

export function safeFileName(value: string): string {
  const normalized = String(value || "rapor.pdf")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.toLocaleLowerCase("tr-TR").endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}

export function normalizeWidths(widths: number[] | undefined, count: number): Array<number | string> {
  if (!widths?.length) return Array.from({ length: count }, () => "*");
  const sum = widths.reduce((total, item) => total + Math.max(0, Number(item) || 0), 0) || 100;
  return widths.slice(0, count).map((item) => `${(Math.max(0, Number(item) || 0) / sum) * 100}%`);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}

export function mmToPt(value: number): number {
  return (Number(value) || 0) * 72 / 25.4;
}
