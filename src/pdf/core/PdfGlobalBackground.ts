/**
 * Geriye dönük uyumluluk için korunur.
 *
 * Global PDF arka planı kaldırılmıştır. Belgeye background nesnesi,
 * filigran veya görsel katmanı eklenmez.
 */
export const applyGlobalPdfBackground = (
  documentDefinition: Record<string, any>,
): Record<string, any> => documentDefinition;
