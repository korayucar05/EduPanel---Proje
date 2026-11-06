/**
 * PDF belgesinin kendi mimarisini korur.
 *
 * Global arka plan, filigran veya sayfa görseli uygulanmaz.
 * Her PDF; kendi documentDefinition içeriği, renkleri, kartları,
 * tabloları ve sayfa düzeniyle oluşturulur.
 */
export function applyHasatPdfTheme(
  documentDefinition: Record<string, any>,
): Record<string, any> {
  return documentDefinition;
}
