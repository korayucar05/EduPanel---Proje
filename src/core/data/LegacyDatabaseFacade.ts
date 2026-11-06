/**
 * Geçiş dönemi veri kapısı.
 *
 * UI katmanının src/lib/localDatabase içindeki HTTP/SQLite ayrıntılarını doğrudan
 * import etmesini engeller. Yeni domain kodu mümkün olduğunda özel Service /
 * Repository kullanmalıdır; bu facade yalnızca henüz domainleştirilmemiş ekranlar
 * için kontrollü uyumluluk yüzeyidir.
 */
export {
  createLocalDatabaseBackup,
  fetchAcademicCatalogFromLocalDatabase,
  fetchCollectionFromLocalDatabase,
  searchLostDocumentRecords,
  syncAcademicCatalogToLocalDatabase,
  syncCollectionToLocalDatabase,
  upsertLocalDocument,
} from "../../lib/localDatabase";
